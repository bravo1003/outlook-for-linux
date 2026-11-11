/**
 * Outlook mail notifier [outlook]
 *
 * Outlook on the web raises its desktop notifications from its service worker
 * after a Web Push message. Electron ships no push service
 * (`pushManager.subscribe` rejects with "push service not available"), so in
 * this app Outlook never raises a single desktop notification for new mail.
 *
 * What Outlook does do, while the page is open, is show its own in-app
 * notifications ("Notifications in Outlook" in its settings) in a dedicated
 * pane. This module watches that pane and turns each new in-app notification
 * into a desktop notification through the page's `Notification`, which
 * preload.js already routes to the system (notificationMethod) - so mail,
 * calendar reminders and mentions all reach the notification daemon, and
 * Outlook's own rules (Focused Inbox, per-category toggles) still decide what
 * is worth notifying about.
 *
 * The pane is found by its `data-app-section` attribute, which is not
 * localised. Inside it, each notification is a button whose aria-label reads
 * like "New mail from <sender>". Layout as of 2026-11:
 *
 *   <div aria-live="polite" data-app-section="NotificationPane">
 *     <button aria-label="New mail from Ryan Wang" aria-roledescription="Notification">
 *       <div aria-hidden="true">(avatar)</div>
 *       <div aria-hidden="true">
 *         <div><div>Ryan Wang</div><button title="Close"></button></div>
 *         <div><div><span>Hello there</span></div></div>
 *         <div>May the force be with you.</div>
 *       </div>
 *     </button>
 *   </div>
 *
 * If Outlook changes that layout, readToast() degrades to the aria-label as
 * the title and the remaining text as the body rather than dropping the
 * notification.
 */

const PANE_SELECTOR = '[data-app-section="NotificationPane"]';
const PANE_POLL_MS = 2000;
const DEDUP_MS = 30000;
const MAX_BODY = 240;

function clean(text) {
  return typeof text === "string" ? text.replace(/\s+/g, " ").trim() : "";
}

/**
 * Build the desktop notification for one in-app notification.
 * Pure, so it is unit-tested without a DOM.
 *
 * @param {{label?: string, sender?: string, subject?: string, preview?: string}} parts
 * @returns {{title: string, body: string, key: string} | null}
 */
function buildNotification(parts) {
  const label = clean(parts?.label);
  const sender = clean(parts?.sender);
  const subject = clean(parts?.subject);
  const preview = clean(parts?.preview);
  const title = sender || label;
  if (!title) return null;
  let body = [subject, preview].filter(Boolean).join("\n");
  if (body.length > MAX_BODY) body = body.slice(0, MAX_BODY - 1) + "…";
  return { title, body, key: `${label}|${title}|${subject}` };
}

/** Text of an element, leaving out nested buttons (the Close button). */
function textWithoutButtons(element) {
  if (!element) return "";
  if (element.tagName === "BUTTON") return "";
  if (!element.children || element.children.length === 0) return element.textContent || "";
  let text = "";
  for (const child of element.children) {
    text += " " + textWithoutButtons(child);
  }
  return text;
}

/**
 * Read the parts of one notification button.
 * @param {Element} button
 */
function readToast(button) {
  const label = button.getAttribute("aria-label") || "";
  const content = button.lastElementChild;
  const rows = content && content.children ? [...content.children] : [];
  if (rows.length >= 2) {
    return {
      label,
      sender: textWithoutButtons(rows[0]),
      subject: textWithoutButtons(rows[1]),
      preview: rows[2] ? textWithoutButtons(rows[2]) : "",
    };
  }
  // Unknown layout: keep the notification, with the label as its title. The
  // button's own children are read, since textWithoutButtons skips buttons.
  const text = [...(button.children || [])].map(textWithoutButtons).join(" ");
  return { label, sender: "", subject: text, preview: "" };
}

/** A notification button, as opposed to the Close button inside it. */
function isToast(button) {
  return (
    button.hasAttribute("aria-roledescription") ||
    button.querySelector("button") !== null
  );
}

/**
 * Open what a notification refers to: click the in-app notification while it
 * is still shown (Outlook opens the item), otherwise select the message in
 * the list by sender and subject.
 */
function openFromToast(button, parts) {
  if (button.isConnected) {
    button.click();
    return;
  }
  const sender = clean(parts.sender);
  const subject = clean(parts.subject);
  if (!sender && !subject) return;
  for (const row of document.querySelectorAll("[role=option][data-convid]")) {
    const label = row.getAttribute("aria-label") || "";
    if ((!sender || label.includes(sender)) && (!subject || label.includes(subject))) {
      row.click();
      return;
    }
  }
}

class OutlookMailNotifier {
  init(config) {
    if (config?.disableNotifications) return;
    this.pane = null;
    this.observer = null;
    this.seen = new WeakSet();
    this.recent = new Map();
    this.attach();
    setInterval(() => this.attach(), PANE_POLL_MS);
    console.info("[OUTLOOK_NOTIFIER] Watching Outlook's notification pane");
  }

  // The pane is created by Outlook on demand and may be replaced on
  // re-render, so keep looking for it instead of observing the whole page.
  attach() {
    const pane = document.querySelector(PANE_SELECTOR);
    if (!pane || pane === this.pane) return;
    this.observer?.disconnect();
    this.pane = pane;
    this.observer = new MutationObserver(() => this.scan());
    this.observer.observe(pane, { childList: true, subtree: true });
    this.scan();
  }

  scan() {
    for (const button of this.pane.querySelectorAll("button[aria-label]")) {
      if (this.seen.has(button) || !isToast(button)) continue;
      this.seen.add(button);
      try {
        this.notify(button);
      } catch (err) {
        console.error("[OUTLOOK_NOTIFIER] Failed to forward a notification:", err);
      }
    }
  }

  notify(button) {
    const parts = readToast(button);
    const notification = buildNotification(parts);
    if (!notification) return;

    // Outlook re-renders a notification as a new element now and then.
    const now = Date.now();
    for (const [key, at] of this.recent) {
      if (now - at > DEDUP_MS) this.recent.delete(key);
    }
    if (this.recent.has(notification.key)) return;
    this.recent.set(notification.key, now);

    // Someone looking at Outlook already sees the in-app notification.
    if (document.hasFocus()) return;

    const desktop = new Notification(notification.title, { body: notification.body });
    desktop.onclick = () => openFromToast(button, parts);
  }
}

exports = module.exports = new OutlookMailNotifier();
module.exports.buildNotification = buildNotification;
module.exports.readToast = readToast;
module.exports.isToast = isToast;

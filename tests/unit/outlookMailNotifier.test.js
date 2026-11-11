const test = require("node:test");
const assert = require("node:assert");

const {
  buildNotification,
  readToast,
  isToast,
} = require("../../app/browser/tools/outlookMailNotifier");

// Minimal stand-in for the few Element members the notifier reads.
function el(tag, attrs = {}, content = []) {
  const kids = typeof content === "string" ? [] : content;
  const findButton = (nodes) => {
    for (const n of nodes) {
      if (n.tagName === "BUTTON") return n;
      const inner = findButton(n.children);
      if (inner) return inner;
    }
    return null;
  };
  return {
    tagName: tag.toUpperCase(),
    children: kids,
    textContent: typeof content === "string" ? content : kids.map((k) => k.textContent).join(""),
    getAttribute: (name) => (name in attrs ? attrs[name] : null),
    hasAttribute: (name) => name in attrs,
    get lastElementChild() {
      return kids.at(-1) ?? null;
    },
    querySelector: (selector) => (selector === "button" ? findButton(kids) : null),
  };
}

// The in-app new-mail notification as Outlook rendered it (2026-11).
function newMailToast() {
  return el("button", { "aria-label": "New mail from Ryan Wang", "aria-roledescription": "Notification" }, [
    el("div", { "aria-hidden": "true" }, [el("span", {}, "RW")]),
    el("div", { "aria-hidden": "true" }, [
      el("div", {}, [el("div", {}, "Ryan Wang"), el("button", { title: "Close" }, [el("span", {}, "")])]),
      el("div", {}, [el("div", {}, [el("span", {}, "Hello there")])]),
      el("div", {}, "May the force be with you.\r\n"),
    ]),
  ]);
}

test("readToast splits sender, subject and preview, ignoring the Close button", () => {
  const parts = readToast(newMailToast());
  assert.strictEqual(parts.label, "New mail from Ryan Wang");
  assert.strictEqual(parts.sender.trim(), "Ryan Wang");
  assert.strictEqual(parts.subject.trim(), "Hello there");
  assert.strictEqual(parts.preview.trim(), "May the force be with you.");
});

test("buildNotification titles with the sender and puts subject and preview in the body", () => {
  const n = buildNotification(readToast(newMailToast()));
  assert.strictEqual(n.title, "Ryan Wang");
  assert.strictEqual(n.body, "Hello there\nMay the force be with you.");
});

test("an unknown layout still yields a notification titled by the aria-label", () => {
  const toast = el("button", { "aria-label": "Reminder: Standup" }, [el("div", {}, "in 5 minutes")]);
  const n = buildNotification(readToast(toast));
  assert.strictEqual(n.title, "Reminder: Standup");
  assert.strictEqual(n.body, "in 5 minutes");
});

test("buildNotification drops empty notifications and truncates long bodies", () => {
  assert.strictEqual(buildNotification({}), null);
  assert.strictEqual(buildNotification({ label: "  " }), null);
  const n = buildNotification({ sender: "A", subject: "x".repeat(500) });
  assert.ok(n.body.length <= 240 && n.body.endsWith("…"));
});

test("the same notification gets the same dedup key", () => {
  const a = buildNotification(readToast(newMailToast()));
  const b = buildNotification(readToast(newMailToast()));
  assert.strictEqual(a.key, b.key);
});

test("isToast accepts notification buttons and rejects their Close button", () => {
  const toast = newMailToast();
  assert.strictEqual(isToast(toast), true);
  const close = toast.children[1].children[0].children[1];
  assert.strictEqual(close.getAttribute("title"), "Close");
  assert.strictEqual(isToast(close), false);
});

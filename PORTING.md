# Porting upstream releases into this fork

This fork tracks [IsmaelMartinez/teams-for-linux](https://github.com/IsmaelMartinez/teams-for-linux).
The point of how it is built is that taking a new upstream release should be a
merge, not a re-derivation.

## History

- **1.0.x** (2026-09) — the original port, on upstream `main` of 2026-09-20
  (just before v2.23.0).
- **1.1.0** (2026-11) — the original fork commits had been deleted from the
  repository, so the port was recovered from the app bundle of the installed
  1.0.1 package (`/opt/outlook-for-linux/resources/app.asar`) onto its original
  upstream base, then replayed onto upstream v2.31.1. `package.json` had to be
  rebranded by hand, because electron-builder rewrites it when packing. The
  release workflow the 1.0.x fork had (see "CI in this fork") was not in the
  bundle and is not recovered.

## The design

Upstream's tree is left where it is. Nothing Teams-specific has been deleted,
no files have been moved or mass-renamed, and internal identifiers still say
"Teams". Instead the app resolves a **target** at runtime and switches
behaviour on it.

Three new files carry the mechanism:

- `app/helpers/outlookHosts.js` — `isOutlookHost(hostname)` and the
  `OUTLOOK_HOSTS` list. A deliberate copy of the matcher in `teamsHosts.js`
  rather than a shared import, so upstream can rewrite that file freely
  without conflicting here.
- `app/helpers/appTarget.js` — `resolveTarget(config)` returns `"outlook"` or
  `"teams"` based purely on the configured `app.url`, plus the preload modules
  that only make sense against Teams (`TEAMS_ONLY_BROWSER_MODULES`) and the
  ones this fork adds for Outlook (`OUTLOOK_ONLY_BROWSER_MODULES`).
- `app/browser/tools/outlookMailNotifier.js` — desktop notifications for
  Outlook; see "Desktop notifications" below.

An unrecognised, missing or unparseable URL resolves to `"teams"`, so a broken
config degrades to upstream behaviour rather than silently disabling features.

Everything else is a handful of small edits at existing seams, each marked
`[outlook]` or explained in a comment where it is not obvious:

| File | Change |
| --- | --- |
| `app/config/options.js` | `app.{title,url,partition}` defaults, and the deprecated flat equivalents |
| `app/browser/preload.js` | Teams-only modules and `ActivityManager` skipped on the Outlook target (inside upstream's indexed module loop, which is hardened against page script patching `Array`/`Set` built-ins - do not reintroduce `modules.filter`); `outlookMailNotifier` added to the module table; the drag-drop/paste path restore accepts either app's hosts |
| `app/index.js` | App name, desktop-entry name, and the Teams link schemes (`PROTOCOL_SCHEMES`) are only claimed when targeting Teams |
| `app/mainAppWindow/index.js` | Outlook origins added to the auth, cookie and CSP lists; Outlook's own popups open in-app instead of in the system browser; `formatWindowTitle` leaves a page title that already ends with `app.title` alone (Outlook's titles end with "Outlook", the default) |
| `app/mainAppWindow/browserWindowManager.js` | Dark background colour that matches Outlook instead of the Teams purple |
| `app/menus/index.js` | Theme restart dialog names Outlook for Linux |
| `app/notificationSystem/notificationToast.html` | Branding |
| `app/downloadManager/jobViewEmitter.js` | KDE JobView icon name |
| `scripts/*` | Point at this fork's appdata file |
| `package.json` | Branding, appId, executable name, desktop entry (`--ozone-platform=wayland`), removed the `protocols` declaration |

Upstream tests adapted to the fork (keep these when they conflict):

| Test | Change |
| --- | --- |
| `tests/unit/protocolLink.test.js` | The packaged-schemes check is skipped when `package.json` declares no protocols |
| `tests/unit/themeSelectionFlow.test.js` | Expects the dialog to say "Outlook for Linux" |

Total in v1.1.0: about 240 changed lines across 14 upstream files (most of it
the branding in `package.json` and the comments explaining each change). That
is the number to keep small — every line added to an existing upstream file is
a line that can conflict later.

## Desktop notifications

Outlook on the web raises its desktop notifications from its service worker,
after a Web Push message. Electron ships no push service —
`pushManager.subscribe()` rejects with *"push service not available"* — so
Outlook never raises one in this app, whatever its settings say. The
`notificationMethod` routing in `preload.js` works (a page `new Notification()`
reaches the notification daemon); Outlook just never calls it.

What Outlook does do while the page is open is render its own in-app
notifications ("Notifications in Outlook" in its settings) in a pane marked
`data-app-section="NotificationPane"`. `outlookMailNotifier` watches that pane
and forwards each new notification (mail, calendar reminders, mentions) as a
desktop notification. It sends nothing while Outlook has focus, since its own
in-app notification is then visible. Clicking the desktop notification clicks
the in-app one while it is still shown, otherwise selects the message in the
list.

If notifications stop after an Outlook redesign, check that the pane attribute
and the layout documented at the top of `outlookMailNotifier.js` still match:
open DevTools (`"webDebug": true` in `config.json`) and inspect a notification
while it is on screen. `tests/unit/outlookMailNotifier.test.js` holds the
layout the parser expects.

## Taking a new upstream release

```bash
git remote add upstream https://github.com/IsmaelMartinez/teams-for-linux.git   # once
git fetch upstream
git merge upstream/main
git show upstream/main:README.md > README.upstream.md
```

Conflicts to expect, and what to do with them:

- **`README.md`** — always conflicts; this fork's README replaced it. Keep
  ours: `git checkout --ours README.md`. Upstream's text is kept separately in
  `README.upstream.md` (the last command above refreshes it).
- **`com.github.IsmaelMartinez.teams_for_linux.appdata.xml`** — deleted here
  and replaced by `com.github.bravo1003.outlook_for_linux.appdata.xml`. Git
  reports a modify/delete conflict on every upstream release. Keep it deleted
  (`git rm`).
- **`package.json`** — usually merges, but check `version`, that `name` stayed
  `outlook-for-linux`, that `build.protocols` did not come back, and re-check
  the `build` block if upstream restructured packaging. Same for the `name`
  fields in `package-lock.json`.
- **`.github/workflows/`** — the upstream workflows listed below were deleted.
  Upstream changes to any of them come back as modify/delete conflicts; keep
  them deleted with `git rm`.
- **`.github/CODEOWNERS`, `.github/FUNDING.yml`**, `release-please-config.json`
  and `.release-please-manifest.json` — deleted for the same reason, same
  resolution.
- **`app/browser/preload.js`** — upstream edits its module table and loop
  often. Keep upstream's version of the loop and re-apply the target check
  inside it; keep the `outlookMailNotifier` entry at the end of the table.

Then verify:

```bash
npm ci
npm run test:unit                          # includes this fork's target tests
npx eslint app scripts tests
npm run start:dev
```

`tests/unit/appTarget.test.js` is the regression net for the fork itself: it
asserts that the Outlook target skips the Teams-only modules, that a
Teams-targeted config still loads all of upstream's, and that **every module
name in either list still exists in `preload.js`'s module table** — if
upstream renames a module, that last test fails until the list is updated.

## When upstream adds a new browser module

New entries in the `modules` array in `app/browser/preload.js` load on **both**
targets by default. If the new module reaches into Teams internals (Teams
`data-tid` selectors, the React tree, calling, presence), add its name to
`TEAMS_ONLY_BROWSER_MODULES` in `app/helpers/appTarget.js`. Leaving it out is
not usually fatal — most such modules no-op without Teams — but it costs
startup work and fills the console with failures that look like bugs, and one
(navigationButtons) broke mail search outright.

## Running next to Teams for Linux

Both apps can run at the same time: they have separate names, desktop entries
and config directories, and this build does not claim the Teams link schemes.
One upstream feature needs care: the opt-in D-Bus control service
(`dbusControl.enabled`) defaults to Teams for Linux's bus name. If you enable
it here, also set `dbusControl.busName` to something distinct, e.g.
`com.github.bravo1003.outlook_for_linux`.

## Reverting to Teams

Set `app.url` back to `https://teams.cloud.microsoft` in
`~/.config/outlook-for-linux/config.json`. Every Teams subsystem is still in
the tree and comes back, and the Outlook-only modules stop loading. The
branding and the link-scheme registration in the desktop entry do not — those
are build-time, not runtime.

## CI in this fork

Upstream's CI assumes upstream's infrastructure: Snap Store and Flathub
credentials, a Docusaurus site deployed to its own Pages, release-please
version-bump PRs, and label bots driven by its issue workflow. None of that
applies here, and on a fork those jobs fail loudly rather than quietly, so
they were removed: `build.yml`, `comment-artifacts.yml`,
`cross-distro-smoke.yml`, `dependabot-auto-merge.yml`, `docs.yml`,
`flathub-beta-bump.yml`, `flatpak-smoke.yml`, `release-please.yml`,
`remove-awaiting-feedback.yml`, `review-reply-marker.yml`, `snap-release.yml`,
`snap.yml`, `stale.yml`.

`CODEOWNERS` and `FUNDING.yml` went too: the first would have requested
review from the upstream maintainer on every pull request opened here, and
the second would have put a Sponsor button on this fork that funds upstream.

What remains: `codeql-analysis.yml` and `osv-scanner.yml`, both
self-contained. The 1.0.x fork also had a manual `release.yml` that built and
attached packages to a draft GitHub release; it was not recovered, so
releases are built locally for now (below). Pushes are not linted or tested
by CI; run the verify commands above before pushing.

## Cutting a release

1. Bump the version: `npm version X.Y.Z --no-git-tag-version` (updates
   `package.json` and `package-lock.json`).
2. Add a matching `<release>` entry with notes to
   `com.github.bravo1003.outlook_for_linux.appdata.xml`. The build fails
   without one — that check is what keeps the changelog honest.
3. Build and install the Debian package:

   ```bash
   npm ci
   npm run generate-release-info
   npx electron-builder --linux deb --x64
   sudo apt install ./dist/outlook-for-linux_X.Y.Z_amd64.deb
   ```

   Other targets: `--linux rpm tar.gz AppImage`.
4. Commit, tag `vX.Y.Z`, and push.

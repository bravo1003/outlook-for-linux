# Porting upstream releases into this fork

This fork tracks [IsmaelMartinez/teams-for-linux](https://github.com/IsmaelMartinez/teams-for-linux).
The point of how it is built is that taking a new upstream release should be a
merge, not a re-derivation.

## The design

Upstream's tree is left where it is. Nothing Teams-specific has been deleted,
no files have been moved or mass-renamed, and internal identifiers still say
"Teams". Instead the app resolves a **target** at runtime and switches
behaviour on it.

Two new files carry the whole mechanism:

- `app/helpers/outlookHosts.js` — `isOutlookHost(hostname)` and the
  `OUTLOOK_HOSTS` list. A deliberate copy of the matcher in `teamsHosts.js`
  rather than a shared import, so upstream can rewrite that file freely
  without conflicting here.
- `app/helpers/appTarget.js` — `resolveTarget(config)` returns `"outlook"` or
  `"teams"` based purely on the configured `app.url`, plus the list of
  preload modules that only make sense against Teams.

An unrecognised, missing or unparseable URL resolves to `"teams"`, so a broken
config degrades to upstream behaviour rather than silently disabling features.

Everything else is a handful of small edits at existing seams:

| File | Change |
| --- | --- |
| `app/config/options.js` | `app.{title,url,partition}` defaults, and the deprecated flat equivalents |
| `app/browser/preload.js` | Skips Teams-only modules and `ActivityManager` on the Outlook target; the drag-drop/paste path restore accepts either app's hosts |
| `app/index.js` | App name, desktop-entry name, and only claims the `msteams:` scheme when targeting Teams |
| `app/mainAppWindow/index.js` | Outlook origins added to the auth, cookie and CSP lists; Outlook's own popups open in-app instead of in the system browser |
| `app/downloadManager/jobViewEmitter.js` | KDE JobView icon name |
| `package.json` | Branding, appId, executable name, desktop entry, removed the `msteams` protocol declaration |

Total: about 145 changed lines across eight upstream files. That is the number
to keep small — every line added to an existing upstream file is a line that
can conflict later.

## Taking a new upstream release

```bash
git remote add upstream https://github.com/IsmaelMartinez/teams-for-linux.git   # once
git fetch upstream
git merge upstream/main
```

Conflicts to expect, and what to do with them:

- **`README.md`** — always conflicts; this fork's README replaced it. Keep
  ours: `git checkout --ours README.md`. If you want upstream's new text,
  it is preserved separately as `README.upstream.md`, which merges cleanly.
- **`com.github.IsmaelMartinez.teams_for_linux.appdata.xml`** — deleted here
  and replaced by `com.github.bravo1003.outlook_for_linux.appdata.xml`. Git
  reports a modify/delete conflict on every upstream release. Keep it deleted
  (`git rm`) and add the new version's entry to this fork's appdata file.
- **`package.json`** — usually merges, but check `version`, and re-check the
  `build` block if upstream restructured packaging.

Then verify:

```bash
npm ci
npm run test:unit                          # includes this fork's target tests
npx eslint app scripts tests
npm run start:dev
```

`tests/unit/appTarget.test.js` is the regression net for the fork itself: it
asserts both that the Outlook target skips the Teams-only modules **and** that
a Teams-targeted config still loads all of them. If upstream renames a preload
module, that second assertion is what tells you `TEAMS_ONLY_BROWSER_MODULES`
has gone stale.

## When upstream adds a new browser module

New entries in the `modules` array in `app/browser/preload.js` load on **both**
targets by default. If the new module reaches into Teams internals, add its
name to `TEAMS_ONLY_BROWSER_MODULES` in `app/helpers/appTarget.js`. Leaving it
out is not fatal — `reactHandler` fails its environment validation and the
module no-ops — but it costs startup work and fills the console with failures
that look like bugs.

## Reverting to Teams

Set `app.url` back to `https://teams.cloud.microsoft` in
`~/.config/outlook-for-linux/config.json`. Every Teams subsystem is still in
the tree and comes back. The branding and the `msteams:` scheme registration
do not — those are build-time, not runtime.

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
- **`.github/workflows/`** — thirteen upstream workflows were deleted (see
  below). Upstream changes to any of them come back as modify/delete
  conflicts; keep them deleted with `git rm`.
- **`.github/CODEOWNERS`, `.github/FUNDING.yml`**, `release-please-config.json`
  and `.release-please-manifest.json` — deleted for the same reason, same
  resolution.

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

## CI in this fork

Upstream's CI assumes upstream's infrastructure: Snap Store and Flathub
credentials, a Docusaurus site deployed to its own Pages, release-please
version-bump PRs, and label bots driven by its issue workflow. None of that
applies here, and on a fork those jobs fail loudly rather than quietly, so
they were removed.

What remains:

| Workflow | Trigger | Why it stayed |
| --- | --- | --- |
| `release.yml` | Manual (`workflow_dispatch`) | This fork's release build |
| `codeql-analysis.yml` | Push, PR, weekly | Self-contained, free on public repos |
| `osv-scanner.yml` | PR, weekly | Self-contained dependency scanning |

Removed: `build.yml`, `comment-artifacts.yml`, `cross-distro-smoke.yml`,
`dependabot-auto-merge.yml`, `docs.yml`, `flathub-beta-bump.yml`,
`flatpak-smoke.yml`, `release-please.yml`, `remove-awaiting-feedback.yml`,
`review-reply-marker.yml`, `snap-release.yml`, `snap.yml`, `stale.yml`.

`CODEOWNERS` and `FUNDING.yml` went too: the first would have requested
review from the upstream maintainer on every pull request opened here, and
the second would have put a Sponsor button on this fork that funds upstream.

Note that deleting `build.yml` also removed the push/PR lint-and-test run.
The release workflow gates on lint, unit tests and `npm audit` before it
builds, so a release cannot ship red — but day-to-day pushes are not checked.
Add a small `ci.yml` running `npm run lint && npm run test:unit` if you want
that back.

## Cutting a release

1. Bump `version` in `package.json` (and `package-lock.json`).
2. Add a matching `<release>` entry with notes to
   `com.github.bravo1003.outlook_for_linux.appdata.xml`. The build fails
   without one — that check is what keeps the changelog honest.
3. Commit and push.
4. Actions → **Release** → *Run workflow*, enter the version (no leading `v`),
   and leave **draft** ticked to review before it goes live.

The workflow refuses to run if the version input disagrees with
`package.json`, or if the tag already exists. It builds deb, rpm, tar.gz and
AppImage for x64, attaches them to the GitHub release, and also uploads them
as a workflow artifact so a botched draft can be deleted and recreated
without rebuilding.

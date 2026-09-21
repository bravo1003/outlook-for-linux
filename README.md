# Outlook for Linux

**Unofficial Microsoft Outlook client for Linux** — a desktop app that wraps Outlook on the web with Linux desktop integration.

✅ **System notifications**
✅ **System tray with unread badge** (badge support varies by desktop environment)
✅ **Multiple account profiles**
✅ **WebAuthn / FIDO2 security keys** for sign-in
✅ **Download manager with KDE JobView and Unity LauncherEntry progress**

> [!NOTE]
> This is an independent project, not affiliated with Microsoft. Some features are limited by what Outlook on the web exposes.

## Relationship to teams-for-linux

This is a fork of [IsmaelMartinez/teams-for-linux](https://github.com/IsmaelMartinez/teams-for-linux),
re-pointed at Outlook on the web. It is not a rewrite: the upstream tree is kept
intact so that new upstream releases can be merged in rather than re-derived.
See [PORTING.md](PORTING.md) for how that works and how to pull in a new
upstream version.

Upstream's own README is preserved as [README.upstream.md](README.upstream.md),
and its documentation under `docs/` still describes the Teams build — treat it as
reference for the shared plumbing (config, profiles, downloads, tray), not as a
description of this app's feature set.

Licensed GPL-3.0-or-later, the same as upstream.

## What this build does and does not have

Everything upstream that is not specific to the Teams web app carries over:
configuration, multi-account profiles, the tray icon and unread badge, system
notifications, the download manager, spell checking, client certificates,
WebAuthn, custom CSS, proxy and connection handling.

The Teams-only subsystems are switched off rather than deleted, because they
depend on internals (`teams2CoreServices`) that Outlook has no equivalent of:

| Not available | Why |
| --- | --- |
| Presence / status, MQTT and Home Assistant integration | Reads the Teams presence service |
| Calls, meetings, the join-meeting dialog, incoming-call toasts | Teams calling stack |
| Screen sharing, mic and camera overrides, speaking indicator | Only used during Teams calls |
| Custom backgrounds, custom stickers | Teams meeting and chat features |
| Teams theme sync and the in-app settings bridge | Reads Teams' React client preferences |
| `msteams:` deep links | This build does not claim the scheme; a real Teams client keeps it |

## Run from source

```bash
npm ci
npm start          # or: npm run start:dev  (adds --no-sandbox)
```

## Build packages

```bash
npm run dist:linux            # deb, rpm, tar.gz, AppImage
npm run dist:linux:deb
npm run dist:linux:appimage
```

## Configuration

Configuration lives at `~/.config/outlook-for-linux/config.json` and uses the
upstream schema — see [docs/configuration.md](docs/configuration.md).

The one option that defines this fork is the URL it loads:

```json
{
  "app": {
    "title": "Outlook",
    "url": "https://outlook.office.com/mail/",
    "partition": "persist:outlook-4-linux"
  }
}
```

For a personal Microsoft account, set `app.url` to `https://outlook.live.com/mail/`
and add that host to `app/helpers/outlookHosts.js`.

Pointing `app.url` back at `https://teams.cloud.microsoft` restores the full
Teams feature set at runtime — the code for it is all still present.

## Icons

The icon set is generated, not hand-drawn, so it stays easy to restyle:

```bash
python3 scripts/generate-outlook-icons.py
```

It writes `app/assets/icons/` and `build/icons/`. The mark is a plain envelope;
Microsoft's Outlook logo is a trademark and is deliberately not reproduced.

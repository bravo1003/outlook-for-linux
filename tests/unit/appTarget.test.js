const test = require("node:test");
const assert = require("node:assert");

const {
  TARGET_OUTLOOK,
  TARGET_TEAMS,
  resolveTarget,
  isOutlookTarget,
  isBrowserModuleEnabled,
} = require("../../app/helpers/appTarget");

const OUTLOOK = { app: { url: "https://outlook.office.com/mail/" } };
const TEAMS = { app: { url: "https://teams.cloud.microsoft" } };

test("resolveTarget reads the nested app.url", () => {
  assert.strictEqual(resolveTarget(OUTLOOK), TARGET_OUTLOOK);
  assert.strictEqual(resolveTarget(TEAMS), TARGET_TEAMS);
});

test("resolveTarget still honours the deprecated flat url", () => {
  assert.strictEqual(
    resolveTarget({ url: "https://outlook.office365.com/mail/" }),
    TARGET_OUTLOOK,
  );
  assert.strictEqual(
    resolveTarget({ url: "https://teams.microsoft.com" }),
    TARGET_TEAMS,
  );
});

test("resolveTarget prefers app.url over the deprecated flat url", () => {
  const config = {
    app: { url: "https://outlook.office.com/mail/" },
    url: "https://teams.cloud.microsoft",
  };
  assert.strictEqual(resolveTarget(config), TARGET_OUTLOOK);
});

test("resolveTarget falls back to Teams for a missing or unparseable url", () => {
  // A broken config must degrade to upstream behaviour rather than silently
  // disabling the Teams feature set.
  for (const config of [{}, null, undefined, { app: {} }, { url: "not a url" }, { url: 42 }]) {
    assert.strictEqual(resolveTarget(config), TARGET_TEAMS, JSON.stringify(config));
  }
});

test("isOutlookTarget agrees with resolveTarget", () => {
  assert.strictEqual(isOutlookTarget(OUTLOOK), true);
  assert.strictEqual(isOutlookTarget(TEAMS), false);
});

test("the Outlook target skips Teams-only preload modules and keeps the shared ones", () => {
  for (const name of ["theme", "settings", "customStickers", "speakingIndicator", "mqttStatusMonitor"]) {
    assert.strictEqual(isBrowserModuleEnabled(name, OUTLOOK), false, name);
  }
  for (const name of ["zoom", "shortcuts", "trayIconRenderer", "navigationButtons", "webauthnOverride"]) {
    assert.strictEqual(isBrowserModuleEnabled(name, OUTLOOK), true, name);
  }
});

test("a Teams-targeted config loads every module, exactly as upstream does", () => {
  for (const name of ["theme", "settings", "customStickers", "zoom", "trayIconRenderer"]) {
    assert.strictEqual(isBrowserModuleEnabled(name, TEAMS), true, name);
  }
});

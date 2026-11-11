const test = require("node:test");
const assert = require("node:assert");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const {
  TARGET_OUTLOOK,
  TARGET_TEAMS,
  TEAMS_ONLY_BROWSER_MODULES,
  OUTLOOK_ONLY_BROWSER_MODULES,
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
  for (const name of ["zoom", "shortcuts", "trayIconRenderer", "webauthnOverride"]) {
    assert.strictEqual(isBrowserModuleEnabled(name, OUTLOOK), true, name);
  }
});

test("navigationButtons never loads against Outlook", () => {
  // Regression: the module anchors on the top-bar search region and falls back
  // to the generic `[role="search"]` selector, which Outlook's own search box
  // matches. Injecting there, and re-injecting on every re-render, broke mail
  // search entirely. It stays a Teams-only module.
  assert.strictEqual(isBrowserModuleEnabled("navigationButtons", OUTLOOK), false);
  assert.strictEqual(isBrowserModuleEnabled("navigationButtons", TEAMS), true);
});

test("a Teams-targeted config loads every module, exactly as upstream does", () => {
  for (const name of ["theme", "settings", "customStickers", "zoom", "trayIconRenderer", "navigationButtons"]) {
    assert.strictEqual(isBrowserModuleEnabled(name, TEAMS), true, name);
  }
});

test("Outlook-only modules load on the Outlook target and never on Teams", () => {
  for (const name of OUTLOOK_ONLY_BROWSER_MODULES) {
    assert.strictEqual(isBrowserModuleEnabled(name, OUTLOOK), true, name);
    assert.strictEqual(isBrowserModuleEnabled(name, TEAMS), false, name);
  }
});

test("every gated module name exists in preload's module table", () => {
  // The regression net for upstream renames: a module renamed upstream would
  // silently drop out of TEAMS_ONLY_BROWSER_MODULES and start loading against
  // Outlook again. Fails until the set is updated to the new name.
  const source = readFileSync(join(__dirname, "../../app/browser/preload.js"), "utf8");
  const names = new Set([...source.matchAll(/\{\s*name:\s*"([^"]+)",\s*path:/g)].map((m) => m[1]));
  assert.ok(names.size > 10, "parsed preload's module table");
  for (const name of [...TEAMS_ONLY_BROWSER_MODULES, ...OUTLOOK_ONLY_BROWSER_MODULES]) {
    assert.ok(names.has(name), `${name} is not in app/browser/preload.js`);
  }
});

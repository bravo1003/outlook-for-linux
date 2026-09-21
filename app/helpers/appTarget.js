// Which Microsoft web app this build is pointed at.
//
// This fork loads Outlook on the web instead of Teams, but it keeps the
// upstream teams-for-linux tree intact so `git merge upstream/main` stays a
// routine operation. Rather than deleting the Teams-only subsystems, they are
// gated behind the target resolved here: a build whose configured URL is an
// Outlook host skips them, and a build pointed back at Teams behaves exactly
// as upstream does.
//
// Resolution is driven purely by `app.url` (or the deprecated flat `url`), so
// switching targets needs no code change - a user who points the config at
// teams.cloud.microsoft gets the full Teams feature set back.

const { isOutlookHost } = require("./outlookHosts");

const TARGET_OUTLOOK = "outlook";
const TARGET_TEAMS = "teams";

/**
 * Browser-side (preload) modules that depend on Teams internals and have no
 * Outlook equivalent. Loading them against Outlook is harmless - `reactHandler`
 * fails its environment validation and the modules no-op - but skipping them
 * avoids the wasted work and the misleading console noise.
 *
 * Grouped by why they are Teams-only:
 *  - React internals:  settings, theme, timestampCopyOverride
 *  - Presence/status:  mqttStatusMonitor
 *  - Calls & meetings: meetingStartDetector, speakingIndicator, the mic and
 *                      camera overrides, preventDeviceSwitching
 *  - Teams chat UI:    customStickers
 */
const TEAMS_ONLY_BROWSER_MODULES = new Set([
  "settings",
  "theme",
  "timestampCopyOverride",
  "mqttStatusMonitor",
  "meetingStartDetector",
  "overrideMicConstraints",
  "disableAutogain",
  "ignoreSystemMute",
  "speakingIndicator",
  "cameraResolution",
  "cameraAspectRatio",
  "customStickers",
  "preventDeviceSwitching",
]);

/**
 * The URL the app is configured to load, tolerating both the current nested
 * `app.url` and the deprecated flat `url`.
 *
 * @param {object} config - Application configuration
 * @returns {string|undefined}
 */
function getConfiguredUrl(config) {
  return config?.app?.url ?? config?.url;
}

/**
 * Resolve the target from configuration.
 *
 * Defaults to Teams when the URL is missing or unparseable, so a broken config
 * degrades to upstream behaviour rather than silently disabling features.
 *
 * @param {object} config - Application configuration
 * @returns {"outlook"|"teams"}
 */
function resolveTarget(config) {
  const url = getConfiguredUrl(config);
  if (typeof url !== "string") {
    return TARGET_TEAMS;
  }
  try {
    return isOutlookHost(new URL(url).hostname)
      ? TARGET_OUTLOOK
      : TARGET_TEAMS;
  } catch {
    return TARGET_TEAMS;
  }
}

/**
 * @param {object} config - Application configuration
 * @returns {boolean}
 */
function isOutlookTarget(config) {
  return resolveTarget(config) === TARGET_OUTLOOK;
}

/**
 * Whether a preload module should be loaded for the configured target.
 *
 * @param {string} moduleName - Name as listed in preload's module table
 * @param {object} config - Application configuration
 * @returns {boolean}
 */
function isBrowserModuleEnabled(moduleName, config) {
  if (!isOutlookTarget(config)) {
    return true;
  }
  return !TEAMS_ONLY_BROWSER_MODULES.has(moduleName);
}

module.exports = {
  TARGET_OUTLOOK,
  TARGET_TEAMS,
  TEAMS_ONLY_BROWSER_MODULES,
  getConfiguredUrl,
  resolveTarget,
  isOutlookTarget,
  isBrowserModuleEnabled,
};

// The hosts Outlook on the web is served from. Tenants behind Defender for
// Cloud Apps load it at `<host>.mcas.ms`, which counts as the underlying host.
//
// `outlook.office365.com` is the legacy alias Microsoft still redirects from,
// so a sign-in that bounces through it must stay inside the app rather than
// being treated as an external link and handed to the system browser.
//
// The matcher below is deliberately a copy of the one in `teamsHosts.js`
// rather than a shared import: keeping this file standalone means upstream
// can rewrite `teamsHosts.js` freely without this overlay conflicting.
const OUTLOOK_HOSTS = ["outlook.office.com", "outlook.office365.com"];
const MCAS_SUFFIX = ".mcas.ms";

/**
 * Whether a hostname is one of the Outlook hosts or an immediate subdomain of
 * one. Only one label is allowed in front, so `evil.com.outlook.office.com`
 * does not pass.
 *
 * @param {string} hostname - Lower-case hostname, as `URL.hostname` yields it
 * @returns {boolean}
 */
function isOutlookHost(hostname) {
  if (typeof hostname !== "string") {
    return false;
  }
  if (hostname.endsWith(MCAS_SUFFIX)) {
    hostname = hostname.slice(0, -MCAS_SUFFIX.length);
  }
  return OUTLOOK_HOSTS.some(
    (domain) =>
      hostname === domain ||
      (hostname.endsWith("." + domain) &&
        !hostname.slice(0, -(domain.length + 1)).includes(".")),
  );
}

module.exports = { OUTLOOK_HOSTS, isOutlookHost };

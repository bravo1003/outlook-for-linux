const test = require("node:test");
const assert = require("node:assert");

const { isOutlookHost, OUTLOOK_HOSTS } = require("../../app/helpers/outlookHosts");

test("isOutlookHost accepts the Outlook hosts, one subdomain label and the MCAS proxy", () => {
  for (const host of OUTLOOK_HOSTS) {
    assert.strictEqual(isOutlookHost(host), true, host);
    assert.strictEqual(isOutlookHost(`eu.${host}`), true, host);
    assert.strictEqual(isOutlookHost(`${host}.mcas.ms`), true, host);
  }
});

test("isOutlookHost declines look-alikes, Teams hosts and non-strings", () => {
  for (const host of [
    "evil.com.outlook.office.com",
    "outlook.office.com.evil.com",
    "a.b.outlook.office.com",
    "teams.cloud.microsoft",
    "login.microsoftonline.com",
    "",
    undefined,
  ]) {
    assert.strictEqual(isOutlookHost(host), false, String(host));
  }
});

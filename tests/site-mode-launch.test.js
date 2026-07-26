// tests/site-mode-launch.test.js — the owner-controlled SITE_LAUNCHED env override.
// The override must win over the DB flag and the cache, in BOTH directions, so the
// site can always be opened or closed from the host dashboard without a super key.

const sm = require('../src/services/site-mode');

afterEach(() => { delete process.env.SITE_LAUNCHED; sm._clearCacheForTests(); });

describe('SITE_LAUNCHED env override', () => {
  test('parses launched/gated aliases in both directions', () => {
    for (const v of ['true', 'open', 'launched', '1', 'yes', 'on', 'TRUE', ' Open ']) {
      process.env.SITE_LAUNCHED = v;
      expect(sm.envOverride()).toBe(false);   // false = NOT pre-launch = open
    }
    for (const v of ['false', 'gated', 'prelaunch', '0', 'no', 'off']) {
      process.env.SITE_LAUNCHED = v;
      expect(sm.envOverride()).toBe(true);    // true = pre-launch = gated
    }
    delete process.env.SITE_LAUNCHED;
    expect(sm.envOverride()).toBe(null);      // unset → no override
  });

  test('isPrelaunch honours the override without touching the DB', async () => {
    process.env.SITE_LAUNCHED = 'true';
    expect(await sm.isPrelaunch()).toBe(false);   // OPEN
    sm._clearCacheForTests();
    process.env.SITE_LAUNCHED = 'false';
    expect(await sm.isPrelaunch()).toBe(true);    // GATED
  });

  test('an unrecognised value is ignored (no override)', () => {
    process.env.SITE_LAUNCHED = 'maybe';
    expect(sm.envOverride()).toBe(null);
  });
});

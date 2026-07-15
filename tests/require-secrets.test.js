// tests/require-secrets.test.js — locks in FAIL-CLOSED boot.
//
// The DEV_PAYMENTS bug shipped because absence of config meant "free" instead of
// "stop". These tests assert the app refuses to start in production when any
// required secret is missing, when dev payments are on, or when a key that was
// committed to git is still in use.
//
// Every test here is capable of failing: each asserts a specific throw, and the
// happy-path test proves the guard is not simply throwing at everything.

const {
  assertProductionSecrets, isProduction, REQUIRED_IN_PRODUCTION, COMPROMISED_KEYS
} = require('../src/config/require-secrets');

// A complete, valid production environment. Individual tests break ONE thing.
const goodEnv = (over = {}) => ({
  NODE_ENV: 'production',
  JWT_SECRET: 'a-long-random-jwt-secret-value',
  DATABASE_URL: 'postgresql://u:p@host.pooler.supabase.com:6543/postgres',
  SUPER_ADMIN_KEY: 'sbk_super_9f2c1a77b4e6d3',
  ADMIN_API_KEY: 'sbk_admin_1c4e7b90a2f5d8',
  RAZORPAY_KEY_ID: 'rzp_live_realkeyid',
  RAZORPAY_KEY_SECRET: 'real_razorpay_secret_value',
  ...over
});

describe('isProduction', () => {
  test('NODE_ENV=production or VERCEL means production', () => {
    expect(isProduction({ NODE_ENV: 'production' })).toBe(true);
    expect(isProduction({ VERCEL: '1' })).toBe(true);
    expect(isProduction({ NODE_ENV: 'development' })).toBe(false);
    expect(isProduction({})).toBe(false);
  });
});

describe('development is never blocked', () => {
  test('an empty env in development is allowed (guard is production-only)', () => {
    const r = assertProductionSecrets({ NODE_ENV: 'development' });
    expect(r.ok).toBe(true);
    expect(r.production).toBe(false);
  });
});

describe('production boots only with a complete, safe environment', () => {
  test('a fully-configured production env is accepted', () => {
    // Proves the guard is discriminating, not just always-throwing.
    expect(() => assertProductionSecrets(goodEnv())).not.toThrow();
    expect(assertProductionSecrets(goodEnv()).ok).toBe(true);
  });

  // The core of 0.4: EVERY required secret gets a boot assertion.
  test.each(REQUIRED_IN_PRODUCTION)('refuses to start when %s is missing', (key) => {
    const env = goodEnv();
    delete env[key];
    expect(() => assertProductionSecrets(env)).toThrow(new RegExp(`${key} is not set`));
  });

  test.each(REQUIRED_IN_PRODUCTION)('refuses to start when %s is blank', (key) => {
    expect(() => assertProductionSecrets(goodEnv({ [key]: '   ' }))).toThrow(new RegExp(`${key} is not set`));
  });
});

describe('DEV_PAYMENTS can never be on in production', () => {
  test('DEV_PAYMENTS=true refuses to boot (every membership would be free)', () => {
    expect(() => assertProductionSecrets(goodEnv({ DEV_PAYMENTS: 'true' })))
      .toThrow(/DEV_PAYMENTS=true/);
  });

  test('the placeholder Razorpay key refuses to boot (it silently simulates payments)', () => {
    expect(() => assertProductionSecrets(goodEnv({ RAZORPAY_KEY_ID: 'rzp_test_xxxxxxxx' })))
      .toThrow(/placeholder value/);
  });

  test('DEV_PAYMENTS=false is fine', () => {
    expect(() => assertProductionSecrets(goodEnv({ DEV_PAYMENTS: 'false' }))).not.toThrow();
  });
});

describe('keys committed to git are rejected in production (0.5 rotation, enforced)', () => {
  test.each([...COMPROMISED_KEYS])('rejects the public key %s', (leaked) => {
    // Whichever variable it is used for, a git-committed key must not authenticate.
    const key = leaked.includes('super') ? 'SUPER_ADMIN_KEY' : 'ADMIN_API_KEY';
    expect(() => assertProductionSecrets(goodEnv({ [key]: leaked })))
      .toThrow(/committed to git and is public — rotate it/);
  });

  test('short secrets are rejected', () => {
    expect(() => assertProductionSecrets(goodEnv({ SUPER_ADMIN_KEY: 'short' }))).toThrow(/shorter than/);
    expect(() => assertProductionSecrets(goodEnv({ JWT_SECRET: 'tiny' }))).toThrow(/shorter than/);
  });
});

describe('demo data cannot be seeded in production', () => {
  test('SEED_DEMO=true refuses to boot', () => {
    expect(() => assertProductionSecrets(goodEnv({ SEED_DEMO: 'true' }))).toThrow(/SEED_DEMO=true/);
  });
});

describe('the error is actionable', () => {
  test('reports every problem at once, not one at a time', () => {
    const env = goodEnv({ DEV_PAYMENTS: 'true' });
    delete env.JWT_SECRET;
    delete env.SUPER_ADMIN_KEY;
    let msg = '';
    try { assertProductionSecrets(env); } catch (e) { msg = e.message; }
    expect(msg).toMatch(/JWT_SECRET is not set/);
    expect(msg).toMatch(/SUPER_ADMIN_KEY is not set/);
    expect(msg).toMatch(/DEV_PAYMENTS=true/);
    expect(msg).toMatch(/Refusing to start in production/);
  });
});

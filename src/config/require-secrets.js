// config/require-secrets.js — fail closed, loudly, at boot.
//
// The rule: in production, absence of configuration must mean STOP, never a
// permissive default. The DEV_PAYMENTS bug is the canonical example — a missing
// RAZORPAY_KEY_ID silently turned payments into free simulated orders, so the
// absence of config meant "free" instead of "refuse to start".
//
// Pure function over an env object so it is unit-testable without booting Express.

// Secrets that MUST exist in production. Missing → refuse to boot.
const REQUIRED_IN_PRODUCTION = [
  'JWT_SECRET',            // signs logins
  'DATABASE_URL',          // the database
  'SUPER_ADMIN_KEY',       // audited chat-content access — highest-value secret
  'ADMIN_API_KEY',         // moderator panel
  'RAZORPAY_KEY_ID',       // absence of these = DEV_PAYMENTS = free memberships
  'RAZORPAY_KEY_SECRET'
];

// Keys that were committed to git (README, dev panels) and are therefore public
// forever. They must never authenticate anything in production.
const COMPROMISED_KEYS = new Set([
  'sambandh-super-dev-key',
  'sambandh-admin-dev-key'
]);

const MIN_SECRET_LENGTH = 16;

function isProduction(env) {
  return env.NODE_ENV === 'production' || !!env.VERCEL;
}

// Throws a single, actionable error listing everything that is wrong. Returns a
// summary when the environment is acceptable.
function assertProductionSecrets(env = process.env) {
  if (!isProduction(env)) return { production: false, ok: true, problems: [] };

  const problems = [];

  for (const key of REQUIRED_IN_PRODUCTION) {
    const val = env[key];
    if (!val || !String(val).trim()) problems.push(`${key} is not set`);
  }

  // Dev payments simulate orders and mark them captured — never in production.
  if (env.DEV_PAYMENTS === 'true') {
    problems.push('DEV_PAYMENTS=true — simulated payments must never run in production (every membership would be free)');
  }
  if (env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_ID.startsWith('rzp_test_xxx')) {
    problems.push('RAZORPAY_KEY_ID is the placeholder value — this silently enables simulated (free) payments');
  }

  // Demo profiles are not real users; they must not exist in production.
  if (env.SEED_DEMO === 'true') problems.push('SEED_DEMO=true — demo profiles must not be seeded in production');

  for (const key of ['SUPER_ADMIN_KEY', 'ADMIN_API_KEY']) {
    const val = env[key];
    if (!val) continue;                                  // already reported above
    if (COMPROMISED_KEYS.has(val)) {
      problems.push(`${key} is a key that was committed to git and is public — rotate it`);
    } else if (String(val).length < MIN_SECRET_LENGTH) {
      problems.push(`${key} is shorter than ${MIN_SECRET_LENGTH} characters — use a long random value`);
    }
  }
  if (env.JWT_SECRET && String(env.JWT_SECRET).length < MIN_SECRET_LENGTH) {
    problems.push(`JWT_SECRET is shorter than ${MIN_SECRET_LENGTH} characters — use a long random value`);
  }

  if (problems.length) {
    throw new Error(
      'Refusing to start in production — the environment is unsafe:\n' +
      problems.map(p => `  · ${p}`).join('\n') +
      '\nSet these in your host\'s environment settings and redeploy. This check fails closed by design.'
    );
  }
  return { production: true, ok: true, problems: [] };
}

module.exports = { assertProductionSecrets, isProduction, REQUIRED_IN_PRODUCTION, COMPROMISED_KEYS, MIN_SECRET_LENGTH };

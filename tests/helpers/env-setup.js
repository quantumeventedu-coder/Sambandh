// tests/helpers/env-setup.js — runs before every test file (jest setupFiles).
//
// Tests execute in EXPLICIT dev mode. routes-auth now derives DEV_MODE from an
// explicit opt-in (never from a missing OTP provider), so the suite must set it
// here — otherwise the dev OTP path is off and auth tests can't sign in. A test
// that specifically exercises PRODUCTION behaviour sets NODE_ENV='production' at
// its own top; IS_PROD then forces DEV_MODE false regardless of this flag.
process.env.DEV_MODE = 'true';

module.exports = {
  testEnvironment: 'node',

  // src/ must be in `roots` or collectCoverageFrom('src/**') matches NOTHING and
  // coverage silently reports only the files tests happened to import — which is
  // how routes-payment.js sat at zero coverage without anyone noticing.
  // testMatch keeps test discovery confined to tests/.
  roots: ['<rootDir>/tests', '<rootDir>/src'],
  testMatch: ['<rootDir>/tests/**/*.test.js'],

  // The mongod binary is pre-fetched by `npm run test:setup` (version pinned in
  // package.json), so nothing downloads mid-test any more. 20s is generous for a
  // real test — anything slower is a bug worth seeing, not a timeout to widen.
  testTimeout: 20000,

  // Coverage is measured over ALL of src/, not just files the tests happen to
  // import — otherwise untested files silently drop out of the denominator and
  // the percentage becomes a lie.
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/seed-demo.js',        // demo fixtures, not product code
    '!src/db/odm.js'            // 2-line engine switch
  ],
  coverageReporters: ['text-summary', 'lcov', 'json-summary'],
  coverageDirectory: 'coverage',

  // RATCHET, not a wish.
  //
  // The mandated destination is: global 70/70/75/75 · routes-payment 95/100/95 ·
  // routes-auth 90/95/90 · pg-odm 90/90/90. Today the honest numbers are far
  // below that (auth and pg-odm are at ZERO — nothing tests them). Setting the
  // gate to the destination would make CI red on every PR, and a gate that always
  // fails gets deleted by the first person it blocks — leaving no gate at all.
  //
  // So these are pinned just under CURRENT measured coverage: they cannot be met
  // by accident, they block any regression starting now, and each new test lets
  // us raise them. Raise the number in the same PR that adds the tests.
  //
  //   file                  now (b/f/l)      destination
  //   routes-payment.js     55 / 79 / 71  →  95 / 100 / 95  (@ts-check'd; webhook tested)
  //   routes-auth.js        19 / 25 / 30  →  90 /  95 / 90   (guards+password done; OTP/Google/2FA/passkey next)
  //   db/pg-odm.js          44 / 61 / 60  →  90 /  90 / 90   (real-Postgres integration test via pglite)
  //   global                26 / 38 / 30  →  70 /  70 / 75
  coverageThreshold: {
    global: { branches: 26, functions: 38, lines: 30, statements: 31 },
    './src/routes-payment.js': { branches: 55, functions: 78, lines: 70, statements: 65 },
    './src/routes-auth.js': { branches: 18, functions: 25, lines: 29, statements: 27 },
    './src/db/pg-odm.js': { branches: 42, functions: 60, lines: 59, statements: 50 },
    './src/config/require-secrets.js': { branches: 95, functions: 100, lines: 100, statements: 100 }
  }
};

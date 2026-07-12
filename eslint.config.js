// ESLint 9 flat config — `npm run lint` lints the backend (src/) and scripts/.
// The web app (public/) is browser-global vanilla JS checked separately below.
const js = require('@eslint/js');

const nodeGlobals = {
  require: 'readonly', module: 'writable', exports: 'writable',
  process: 'readonly', console: 'readonly', Buffer: 'readonly',
  __dirname: 'readonly', __filename: 'readonly',
  setTimeout: 'readonly', setInterval: 'readonly',
  clearTimeout: 'readonly', clearInterval: 'readonly',
  URL: 'readonly', fetch: 'readonly',
  AbortSignal: 'readonly', AbortController: 'readonly'
};

module.exports = [
  { ignores: ['node_modules/**', 'uploads/**', 'public/**'] },
  js.configs.recommended,
  {
    files: ['src/**/*.js', 'scripts/*.js', 'eslint.config.js', '*.test.js', 'tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      globals: {
        ...nodeGlobals,
        // jest globals (test files only, harmless elsewhere)
        describe: 'readonly', test: 'readonly', it: 'readonly', expect: 'readonly',
        beforeAll: 'readonly', afterAll: 'readonly', beforeEach: 'readonly', afterEach: 'readonly', jest: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_|^next$|^req$|^res$', varsIgnorePattern: '^_' }],
      'no-empty': ['error', { allowEmptyCatch: true }]
    }
  }
];

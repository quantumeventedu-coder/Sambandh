// tests/helpers/launch.js — flip the site OUT of pre-launch for tests that exercise
// post-launch behaviour (the reading/astro/discover tier gates). Pre-launch is the
// fail-safe default, so any test of a launch-gated route as a normal user must call
// this first (in a beforeEach — db.clear() between tests wipes the AppConfig).
const AppConfig = require('../../src/models/AppConfig');
const siteMode = require('../../src/services/site-mode');

async function launch() {
  await AppConfig.findOneAndUpdate(
    { key: 'singleton' },
    { $set: { prelaunch: false } },
    { upsert: true }
  );
  siteMode._clearCacheForTests();
}

module.exports = { launch };

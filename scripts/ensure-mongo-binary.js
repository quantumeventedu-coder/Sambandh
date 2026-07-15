// scripts/ensure-mongo-binary.js — pre-fetch the pinned mongod binary BEFORE jest runs.
//
// Why this exists: two suites (recommender, reputation-engine) need a real Mongo.
// Without this, mongodb-memory-server downloads the binary *during* the first test,
// which (a) makes a cold/offline machine fail, and (b) forced the 60s testTimeout
// hack. A suite that fails for environmental reasons trains people to ignore red —
// which is precisely why the payment bugs went unnoticed.
//
// Run by `npm run test:setup` (and `test:ci`). Idempotent and fast when cached.
// The version + downloadDir are pinned in package.json → config.mongodbMemoryServer.

const { MongoMemoryServer } = require('mongodb-memory-server');

(async () => {
  const t0 = Date.now();
  try {
    const mem = await MongoMemoryServer.create();   // downloads only if not cached
    const uri = mem.getUri();
    await mem.stop();
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`[test:setup] mongod binary ready in ${secs}s (${uri.split('/')[2]})`);
  } catch (err) {
    console.error('[test:setup] FAILED to obtain the mongod binary:', err.message);
    console.error('[test:setup] Tests need it offline. Check network/proxy, or pre-seed ./.cache/mongodb-binaries.');
    process.exit(1);
  }
})();

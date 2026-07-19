// @ts-check
// src/lib/health.js — liveness vs. readiness, the way orchestrators expect them.
//
//   GET /health        liveness  — "the process is up". Always 200 if we can
//                                   answer at all. Cheap; no dependencies touched.
//   GET /health/ready  readiness — "up AND able to serve": actually round-trips
//                                   the database. 200 when healthy, 503 when not,
//                                   so a load balancer stops routing to a node
//                                   whose DB has gone away.
//
// The legacy GET /health body is preserved (ok/time/db/devMode) so nothing that
// already scrapes it breaks.

const START = Date.now();

/**
 * Probe the database over whichever engine is active. Prefers a real round-trip
 * (pg-odm.ping / mongoose admin ping) and falls back to the connection state.
 * @param {any} db  the odm module (mongoose-compatible)
 * @returns {Promise<boolean>}
 */
async function dbHealthy(db) {
  try {
    if (typeof db.ping === 'function') return await db.ping();       // pg-odm real round-trip
    const conn = db.connection;
    if (conn && conn.db && conn.db.admin) {                          // real mongoose
      await conn.db.admin().ping();
      return true;
    }
    return !!(conn && conn.readyState === 1);
  } catch {
    return false;
  }
}

/**
 * Mount /health (liveness) and /health/ready (readiness) on the app.
 * @param {import('express').Express} app
 * @param {any} db
 */
function mountHealth(app, db) {
  app.get('/health', (req, res) => {
    res.json({
      ok: true,
      time: new Date(),
      db: db.connection && db.connection.readyState === 1 ? 'connected' : 'disconnected',
      devMode: process.env.DEV_MODE === 'true',
      uptimeSec: Math.round((Date.now() - START) / 1000)
    });
  });

  app.get('/health/ready', async (req, res, next) => {
    try {
      const ok = await dbHealthy(db);
      res.status(ok ? 200 : 503).json({
        ok,
        checks: { db: ok ? 'up' : 'down' },
        uptimeSec: Math.round((Date.now() - START) / 1000)
      });
    } catch (err) { next(err); }
  });
}

module.exports = { mountHealth, dbHealthy };

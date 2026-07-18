// tests/helpers/pg-db.js — run the real models against REAL Postgres (pglite),
// i.e. the engine production uses (pg-odm), not Mongoose.
//
// IMPORTANT: require this module BEFORE any ../src/models/* in a test file. It
// sets DATABASE_URL, which is what src/db/odm.js reads (at import time) to choose
// the pg engine. Requiring a model first would bind it to Mongoose instead.
//
//   const db = require('./helpers/pg-db');   // must be first
//   const User = require('../src/models/User');
//   beforeAll(db.start); afterAll(db.stop); afterEach(db.clear);

// Setting DATABASE_URL is what flips odm.js to the pg engine. Under --runInBand
// all test files share one process, so we must NOT leak it to later files that
// still use Mongoose — save the prior value and restore it in stop().
const PRIOR_DATABASE_URL = process.env.DATABASE_URL;
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://pglite/test';

const { PGlite } = require('@electric-sql/pglite');
const pgodm = require('../../src/db/pg-odm');

let db = null;

// Fresh in-process Postgres; wire pg-odm to it via the test-only seam.
async function start() {
  db = new PGlite();
  await db.waitReady;
  pgodm._internal._setPoolForTests({ query: (t, p) => db.query(t, p || []), end: () => db.close() });
}

async function stop() {
  pgodm._internal._setPoolForTests(null);
  if (db) { await db.close(); db = null; }
  // Restore so subsequent (still-Mongoose) test files aren't flipped to pg-odm.
  if (PRIOR_DATABASE_URL === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = PRIOR_DATABASE_URL;
}

// Truncate every table between tests (keeps tables + indexes, so pg-odm's
// ensured-table cache stays valid — faster than dropping/recreating).
async function clear() {
  if (!db) return;
  const r = await db.query("select tablename from pg_tables where schemaname = 'public'");
  for (const row of r.rows) await db.query(`truncate table "${row.tablename}"`);
}

module.exports = { start, stop, clear, Types: pgodm.Types };

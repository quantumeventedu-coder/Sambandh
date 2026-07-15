# ADR-001: Postgres over MongoDB

**Status:** Accepted
**Date:** 2026-07-15 (backfilled — the decision was made earlier and never written down)

## Context

The repo ships **both** `mongoose` and `pg` in `package.json`, and `src/db/odm.js`
switches engine at import time on `process.env.DATABASE_URL`:

```js
module.exports = process.env.DATABASE_URL ? require('./pg-odm') : require('mongoose');
```

That is architectural indecision shipped to production. Its real costs, observed:

- **Every query is tested on the path production does not use.** The test suite
  runs on `mongodb-memory-server` (Mongoose); production runs Postgres via
  `pg-odm.js`. So `routes-payment.js` and `routes-auth.js` were validated against
  an engine no user ever touches.
- **`pg-odm.js` is 669 lines re-implementing Mongoose semantics on JSONB.** Every
  Mongo operator it does not support is a latent bug; every one it does support is
  maintenance owned forever.
- **A bug can hide in the branch not exercised.** The dev/prod split was also the
  direct cause of a boot failure: `odm.js` reads `DATABASE_URL` at *import* time,
  so dotenv loading late silently selected the wrong engine.
- **The Mongo test dependency was the reason the suite was unreliable** — it
  downloaded a mongod binary at test time, and an always-red suite is a suite
  nobody reads.

## Options

1. **Standardise on MongoDB.** Keep Mongoose, drop `pg-odm`. Simple, and the tests
   already match. But the data is relational (users ↔ chats ↔ messages ↔ payments),
   the production database is already Supabase Postgres, and moving off it means a
   migration plus losing SQL, constraints and transactions.
2. **Standardise on Postgres.** Delete Mongoose, the in-memory Mongo fallback, and
   every dual-path branch. Relational data gets a relational store; JSONB covers the
   genuinely flexible fields. Cost: `pg-odm` must eventually go (ADR to follow), and
   the tests must move to a real Postgres.
3. **Keep both.** Rejected. It is the only option that is *definitely* wrong: it
   guarantees every model is written twice, every query tested twice, and one path
   untested.

## Decision

**Postgres.** Reasons, in order:

- The data is relational and already lives in Supabase Postgres in production.
- JSONB covers the flexible profile/claims fields without a second database.
- One database means **one code path to reason about at 3am**.
- It removes the Mongo binary download that made the test suite unreliable.

## Consequences

- **Mongoose, the in-memory Mongo fallback, and all dual-path branches get deleted.**
  Local development then requires a real Postgres (container or Supabase), which is
  a genuine loss of "clone and run with zero setup".
- **Tests must move off `mongodb-memory-server`** to a real Postgres (Testcontainers
  or a CI service container). Until that lands, the suites still exercise Mongoose —
  i.e. **not** production. This is a known, temporary lie and must be closed early.
- `pg-odm.js` becomes the single data path, raising the urgency of replacing it with
  a typed, SQL-first library (see the ORM ADR) rather than growing it.
- `src/db/odm.js` (the engine switch) disappears, and with it the import-order
  fragility that already caused one boot failure.
- Anything relying on Mongo-only operators must be rewritten. `pg-odm` already
  omits unsupported operators from SQL and filters in JS, so behaviour is a superset
  — but that fallback is slower and must be audited as models migrate.

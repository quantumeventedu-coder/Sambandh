# Sambandh — Operations Runbook

The one page to read when the site is misbehaving. Pairs with
[`06-security-checklist.md`](06-security-checklist.md) and
[`DEPLOY-PERSISTENT.md`](DEPLOY-PERSISTENT.md).

---

## 1. What runs where

- **App**: Express 4 + a vanilla SPA (`public/`), no build step. `npm start` →
  `node src/server.js`. Long-running mode listens on `PORT` (prod uses **3010**).
- **Serverless**: on Vercel, `api/index.js` drives requests; there is **no**
  in-process cron and **no** Socket.io realtime (the app degrades to REST sends).
- **Data engine** is chosen at boot by `src/db/odm.js`:
  - `DATABASE_URL` set → **Postgres** via `pg-odm` (Supabase). Use the **session
    pooler host** (`…pooler.supabase.com`), never `db.<ref>` (IPv6-only).
  - else `MONGODB_URI` → Mongoose (Atlas).
  - else (local dev only) → in-memory MongoDB; **data resets on restart**.

## 2. Health & tracing

| Endpoint | Meaning | Use |
|---|---|---|
| `GET /health` | **Liveness** — process is up. Always 200. | Uptime pings, "is it running". |
| `GET /health/ready` | **Readiness** — up **and** the DB answers `select 1`. 200 / **503**. | Load-balancer drain, deploy gate. |

Every request gets an `x-request-id` (an inbound one from a proxy is honoured and
propagated). It is echoed on the response header and stamped on every log line for
that request (`reqId`). **When a user reports an error, ask for the `reqId` from the
response** — it pins the exact log line.

## 3. Logs

Structured JSON (pino), one line per request on finish: `method, path (route
pattern), status, ms, reqId`. Levels: 5xx→`error`, 4xx→`warn`, else `info`.
`LOG_LEVEL` overrides (prod default `info`, dev `debug`, test `silent`).

**PII is never logged.** `src/lib/logger.js` `redact()` censors sensitive keys at
any depth and scrubs value-shaped PII (emails, phone runs, JWTs, base64 images)
out of free text. If you are adding a log call with user data, log the **reqId or
the object** and let the logger scrub it — do not hand-format PII into a message.

## 4. Error codes (client-facing)

The API returns `{ error, code, reqId? }`. Stable `code`s (see `src/lib/errors.js`):
`validation` (400), `unauthenticated` (401), `forbidden` (403), `not_found` (404),
`conflict` (409), `rate_limited` (429), `payload_too_large` (413), `internal` (500).
**5xx bodies are masked** — the real message is only in the server log (with stack).

## 5. Boot / config (fail-closed)

`src/config/require-secrets.js` runs at boot. In **production** every required
secret must be present and not a known-compromised value, or the app refuses to
start. `JWT_SECRET` missing → hard stop. Non-fatal issues log as `[CONFIG]`
warnings and **do not** block boot.

> **Incident lesson (do not repeat):** a fail-closed guard on `SEED_DEMO` was
> shipped to auto-deploying `main` and blanked signup in production. `SEED_DEMO` is
> now a **warning**, never a boot-blocker; the real guard is that demo seeding runs
> **only when NODE_ENV ≠ production**, whatever the flag says. Never add a
> boot-blocking guard for a *non-secret* convenience flag on an auto-deploy branch.

## 6. Common incidents

| Symptom | Likely cause | Action |
|---|---|---|
| Signup/login blank or 500 at boot | a required secret missing / fail-closed stop | check boot logs for `[CONFIG]` / `JWT_SECRET`; set the secret; redeploy |
| `EMAXCONNSESSION: max clients … session mode` | serverless on the **session** pooler | set `PG_TRANSACTION_POOL=true` (or run on Vercel) → uses `:6543` transaction pooler |
| `/health/ready` → 503 but `/health` 200 | DB unreachable, process fine | check Supabase status / pooler host / network allowlist; LB should already be draining |
| Realtime chat silent on prod | Vercel has no Socket.io | expected — SPA falls back to REST; for realtime run the long-running server |
| Mongo `querySrv/ENOTFOUND` locally | ISP DNS can't resolve SRV | boot auto-retries via Google DNS; else set `USE_MEMORY_DB=true` for dev |

## 7. DPDP data requests (India DPDP Act 2023)

- **Access / portability (§11):** user hits `GET /api/me/data-export` (authed) →
  full JSON of *their* records. Isolation is tested: it never contains another
  member's data. If someone emails a request, have them use the in-app export.
- **Erasure (§12):** `POST /api/auth/delete-account` sets `status.deletedAt` and
  deactivates, with a **30-day grace**: logging in within 30 days **cancels**
  the deletion; past 30 days the account is locked out (`403 deleted`) and is
  eligible for hard purge.
- Guarantees are pinned by `tests/dpdp-lifecycle.test.js` — keep them green.

## 8. Deploy & rollback

- `main` is branch-protected (required checks) and **auto-deploys**. Never push
  straight to `main`; open a PR, let CI (Gate 0 + coverage) pass, merge.
- CLI deploys/PRs go through `gh` (must be authenticated).
- **Rollback** = revert the merge commit and let the auto-deploy redeploy the
  prior state; then fix forward on a branch. Prefer revert over force-push.

## 9. Pre-merge local gate

```
npm test                       # full suite (real Postgres via pglite)
npx tsc --noEmit               # @ts-check'd files must pass
npx eslint src/ --max-warnings=0
LOG_LEVEL=silent JWT_SECRET=x node src/server.js   # boots clean; /health/ready → {db:up}
```

## 10. Known gap — schema migrations

`pg-odm` currently **ensures tables on demand** (lazy `CREATE TABLE IF NOT
EXISTS`, cached in `ensuredTables`). There is no versioned migration history yet.
A real migration tool (e.g. Drizzle) would be a **parallel** schema authority and
must be reconciled with the ODM's ensure-table path before adoption — this is a
deliberate open item, not an oversight. Until then, additive JSONB columns are
safe; destructive schema changes need a manual, reviewed SQL step.

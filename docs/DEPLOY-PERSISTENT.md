# Deploying Sambandh on a persistent host (Render / Railway / Fly / VPS)

Sambandh is a **stateful, real-time** app. Vercel's serverless functions can't
give it what it needs; a single long-lived Node process can. Moving to a
persistent host makes all of this work **as already built** — no code changes:

| Capability | Vercel (serverless) | Persistent host |
|---|---|---|
| Real-time chat (Socket.io: live delivery, typing, match/reveal alerts) | ❌ REST send only | ✅ full realtime |
| Login reliability (OTP + passkey challenge stores) | ⚠️ break across lambdas | ✅ one process, reliable |
| Cron jobs (membership expiry, nightly risk/karma, AI retrain) | ❌ never run | ✅ run on schedule |
| Rate limiting | ⚠️ per-lambda | ✅ shared |
| Uploaded photos | ❌ ephemeral `/tmp` | ✅ local disk or Supabase Storage |

The server already binds `process.env.PORT` (falls back to 3001), and
`startCrons()` + Socket.io run automatically whenever `process.env.VERCEL` is
**not** set — i.e. everywhere except Vercel. Nothing to change in code.

---

## Option A — Render (recommended, simplest)

Render reads `render.yaml` in the repo (a "Blueprint").

1. Push this repo to GitHub (already done).
2. Go to **render.com → New → Blueprint**, connect the `Sambandh` repo, pick `main`.
3. Render shows the `sambandh` web service from `render.yaml`. Click **Apply**.
4. Open the service → **Environment** and set the values marked `sync: false`:
   - `DATABASE_URL` — the Supabase **pooler** URL
     `postgresql://postgres.ktprmoaiavoxvkzdqeif:<password>@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres`
   - `JWT_SECRET`, `ADMIN_API_KEY`, `SUPER_ADMIN_KEY` — your existing values (or fresh ones)
   - Optional now, feature lights up when set: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
     (photos), `ANTHROPIC_API_KEY` (AI), `GOOGLE_CLIENT_ID` (Google login),
     `RAZORPAY_*` (real payments)
5. Render builds (`npm install`) and starts (`node src/server.js`), health-checking
   `/health`. First boot connects to Supabase (and seeds demo data if `SEED_DEMO=true`).
6. **Custom domain:** service → **Settings → Custom Domains → Add**
   `www.sambandh.online` and `sambandh.online`. Render gives you a CNAME/ALIAS —
   set it at your DNS registrar, then Render issues TLS automatically. Remove the
   domain from Vercel first (a domain can only point to one place).

Verify: open `https://<your-service>.onrender.com/health` → `{"ok":true,"db":"connected"}`.

## Option B — Railway

1. **railway.app → New Project → Deploy from GitHub repo** → `Sambandh`.
2. Railway auto-detects Node and uses the `Procfile` (`web: node src/server.js`).
3. **Variables** tab → add the same env vars as above.
4. **Settings → Networking → Generate Domain** (or add the custom domain), then
   point DNS at it.

## Option C — Any container host (Fly.io, Cloud Run, a VPS)

A `Dockerfile` + `.dockerignore` are included.

```bash
docker build -t sambandh .
docker run -p 3001:3001 --env-file .env sambandh
# open http://localhost:3001/health
```

Fly.io: `fly launch` (it detects the Dockerfile), then `fly secrets set DATABASE_URL=… JWT_SECRET=…`.

---

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | ✅ | Supabase Postgres (pooler host) |
| `JWT_SECRET` | ✅ | signs login tokens |
| `ADMIN_API_KEY` | ✅ | admin panel |
| `SUPER_ADMIN_KEY` | ✅ | owner panel (chat access for legal, LLM control) |
| `CORS_ORIGINS` | recommended | comma-separated allowed origins |
| `SEED_DEMO` | optional | `true` seeds demo profiles; `false` for real launch |
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | optional | persistent photo storage |
| `ANTHROPIC_API_KEY` | optional | full AI (else deterministic rules) |
| `GOOGLE_CLIENT_ID` | optional | Google sign-in button |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | optional | real payments |

Do **not** set `VERCEL` or `DEV_MODE` on a persistent host — the app auto-detects
a normal server and runs the full realtime + cron stack, with no dev artifacts.

## Photos: local disk vs Supabase Storage

With no `SUPABASE_*` set, uploads go to `./uploads` on the host's disk. That works
on a single instance, but is lost on a redeploy unless the host has a **persistent
disk** (Render: add a Disk mounted at `/app/uploads`). Cleaner: set
`SUPABASE_URL` + `SUPABASE_SERVICE_KEY` and photos live in Supabase Storage —
survives redeploys and scales.

## Scaling past one instance

The starter setup runs one process (handles a lot — Socket.io does tens of
thousands of concurrent connections). To run **multiple** instances later, add:
- **Redis** for the OTP/passkey-challenge/rate-limit stores and the Socket.io
  adapter (so realtime + login work across instances), and
- **Supabase Storage** for uploads (above).

Both are additive; the single-instance deploy above is production-ready for launch
and the pitch.

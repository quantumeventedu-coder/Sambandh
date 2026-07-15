# Sambandh — connections, made meaningful

India's verified, honest dating platform — government ID verification, the Karma Book
honesty engine, four explicit intent modes, anonymous-first chat, real astrology +
engagement compatibility. **Single source of truth:
[docs/00-master-spec.md](docs/00-master-spec.md) (Master Engineering Specification
v2.0, July 2026)** — PRD, SRS, TDD, and architecture blueprint in one document.
Implements: likes/passes with mutual matching, city-centroid distance ranking,
user blocking + incognito lists, OTP lockout + token blacklist, IST-midnight rate
limits, escalation rate tiers, nightly cron batch (fraud scan, age recompute, karma
recovery, 30-day document deletion, DPDP account erasure), moderation audit log,
and report auto-escalation.

---

## Run it (one command)

```
npm run dev
```

This starts everything and **opens the app in your browser automatically**.
Or just **double-click `Start Sambandh.cmd`** in this folder — same thing, no
terminal needed. Keep the window open while using the app; close it (or Ctrl+C)
to stop.

| What | URL |
|---|---|
| **Homepage** (features, pricing, FAQ) | http://localhost:3010 |
| **The app** (mobile-first web) | http://localhost:3010/app |
| **Moderator panel** | http://localhost:3010/admin.html — paste your `ADMIN_API_KEY` (remembered for the session) |
| **Super admin panel** (owner) | http://localhost:3010/superadmin.html — paste your `SUPER_ADMIN_KEY` (full access incl. audited chat inspection) |
| Health check | http://localhost:3010/health |

Other commands: `npm start` (server only, no browser) · `npm run dev:watch`
(auto-restart on code changes, for development).

No MongoDB, Firebase, or Razorpay account needed to run locally:

- **Database** — tries your Atlas `MONGODB_URI` first (retrying with Google DNS for
  the SRV issue); if unreachable it starts an **in-memory MongoDB** automatically
  (data resets on restart) and seeds 5 demo users: Priya, Meera, Rohit (karma-flagged),
  Arjun, Ananya (anonymous).
- **OTP login** — in dev mode the 6-digit OTP is shown on screen and in the server
  console. Log in with any phone number.
- **Payments** — simulated in dev mode (`DEV_PAYMENTS=true`). There is **no free
  tier**: every member pays the one-time join fee (CHF 1 men · CHF 5 women ·
  CHF 3 non-binary — all prices in CHF). Optional upgrades: Sambandh Pro CHF 6/mo
  (unlimited messaging), Sambandh Max CHF 15/mo (Pro + see-who-liked-you +
  advanced filters). Karma escalations CHF 0.50–1. Real Razorpay signature
  verification ready for live keys.
- **Karma Book AI** — runs automatically every 30 messages when `ANTHROPIC_API_KEY`
  is set; otherwise the platform-behavior checks (exclusivity vs. active chats,
  account-age lies, fraud patterns) still work without the LLM.

## What's implemented

**Web app (public/)** — welcome → phone OTP → profile → ID verification
(DigiLocker instant / upload) → selfie liveness → profession (instant registry check
for doctors/lawyers/CAs/architects, 24h manual review for the rest) → join fee →
intent picker (marriage / dating / casual / friendship) → astrology → photos
(EXIF-stripped client-side) → then: ranked Discover feed with filters, profile detail
with karma flags + activity transparency + paid escalation, real-time chat
(Socket.io) with anonymous mode + mutual reveal + free-tier limits, My Karma Book,
astrology + engagement compatibility, notifications, settings (privacy toggles,
data export, pause, delete, payment history).

**Admin panel (public/admin.html)** — verification queue (approve/reject) and
reports queue (warn / suspend 24h / 7d / ban) with 24h SLA per IT Rules 2021.

**API (src/)** — ~45 endpoints across auth, verification, discover, profile, chat,
karma, compatibility, payments, reports, notifications, account. Plus Socket.io
events: `join_chat`, `send_message`, `new_message`, `message_read`, `typing`,
`user_online`. See `docs/` for design docs and `api-examples/` for runnable requests.

## Before public launch (from the build reference)

1. Fix persistent DB: repair the Atlas SRV string (or use a `mongodb://` non-SRV
   string) — the in-memory DB is dev-only.
2. Firebase Auth for real SMS OTP → set `FIREBASE_PROJECT_ID` + service account,
   remove `DEV_MODE=true`.
3. Razorpay live keys (needs company PAN) → remove `DEV_PAYMENTS=true`.
4. Cloudflare R2 keys for photo/document storage (local `uploads/` used until then).
5. DigiLocker / Hyperverge keys for real ID verification (dev mode auto-approves).
6. ProKerala API for real Vedic guna milan (internal approximation used until then,
   and labeled as such in the UI).
7. `ANTHROPIC_API_KEY` for the Karma Book LLM analysis.
8. Change `ADMIN_API_KEY` and `JWT_SECRET` to strong secrets.
9. Legal: company registration, GST, Grievance Officer, DPO, ToS + Privacy Policy
   (DPDP Act 2023), penetration test. See the Legal section of the build reference.

## Project layout

```
src/
├── server.js               ← Express + Socket.io + static web app + DB fallback
├── routes-auth.js          ← OTP login (dev + Firebase), profile, photos, delete
├── routes-verification.js  ← ID / selfie / profession / education + admin queue
├── routes-discover.js      ← ranked feed (trust×.30 + karma×.25 + intent×.20 + …)
├── routes-chat.js          ← chats, messages, reveal, block, free-tier limits
├── routes-compat.js        ← astrology (guna milan) + engagement compatibility
├── routes-karma.js         ← karma summaries, paid escalation, disputes
├── routes-payment.js       ← Razorpay orders/verify/webhook/history (+ dev mode)
├── routes-report.js        ← user reports + moderation actions
├── routes-notifications.js ← notification feed
├── routes-me.js            ← settings, pause, DPDP data export
├── karma-book.js           ← claim extraction, lies, contradictions, manipulation
├── reputation-engine.js    ← behavioral trait scoring (respect/depth/humor/…)
├── sockets-chat.js         ← real-time chat with JWT auth
├── seed-demo.js            ← demo users (SEED_DEMO=true)
└── models/                 ← 13 Mongoose models
public/
├── index.html + app.js + styles.css   ← the web app (all screens)
└── admin.html                          ← moderator panel
```

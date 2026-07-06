# 01 — Tech Stack

## TL;DR

For a solo or small-team build of Sambandh, use:

**Next.js + Node/Express + MongoDB Atlas + Cloudflare R2 + Razorpay + Socket.io**

This stack is:
- Cheap to start (free tier or <$50/month for first 500 users)
- All JavaScript (one language across frontend + backend)
- Easy to hire for in India
- Scales to 100K+ users without re-architecting

---

## Frontend: Next.js 14

Use Next.js with App Router. Reasons:
- Server-side rendering = faster first load = better SEO
- Free hosting on Vercel (300k pageviews/month free tier)
- Built-in image optimization (you'll have many profile photos)
- TypeScript support out of the box

Alternatives considered: plain React (worse SEO), SvelteKit (smaller hiring pool in India), Flutter Web (heavy bundles).

---

## Backend: Node.js + Express

A single Express server handling REST APIs + Socket.io for real-time chat.

```
backend/
├── server.js              ← entry point
├── routes/                ← REST endpoints
│   ├── auth.js
│   ├── profile.js
│   ├── verification.js
│   ├── chat.js
│   ├── payment.js
│   └── reputation.js
├── models/                ← Mongoose schemas
├── services/              ← business logic
│   ├── reputation-engine.js
│   ├── astrology-service.js
│   ├── verification-service.js
│   └── payment-service.js
├── middleware/            ← auth, rate-limit, validation
└── sockets/               ← Socket.io handlers
```

Alternatives considered:
- **NestJS**: more structured but slower to learn
- **Python/FastAPI**: nice for AI work but doubles your language burden
- **Go**: faster runtime but smaller hiring pool, harder iteration

---

## Database: MongoDB Atlas

**Why MongoDB over PostgreSQL:**
- Profile schemas evolve quickly (you'll add fields constantly in the first 6 months)
- Embedded documents are perfect for chat messages + reputation arrays
- Free M0 tier (512MB) covers your first ~10K users
- Atlas has Mumbai region for low-latency Indian access

**Where MongoDB is wrong:** financial transactions need stronger guarantees. For payments, store the source of truth in a separate Postgres instance OR use MongoDB transactions carefully.

**Collections you'll have:**
- `users` — profile data
- `verifications` — every claim a user made + its status
- `chats` — chat metadata (participants, anonymity status, intent)
- `messages` — individual messages (sharded by chatId)
- `reputation` — derived behavioral scores per user
- `compatibility` — cached astrology + engagement scores per user pair
- `payments` — Razorpay transaction records
- `reports` — abuse reports for moderation
- `audit_log` — every sensitive action (verification, reveal, payment)

See `docs/02-data-model.md` for full schemas.

---

## File storage: Cloudflare R2

**Why R2 over AWS S3:**
- No egress fees (huge — profile photos get downloaded constantly)
- S3-compatible API (use the AWS SDK as-is)
- ~50% cheaper than S3 for the same storage
- Cloudflare's CDN is included automatically

**What goes in R2:**
- Profile photos (`users/{userId}/photos/{photoId}.jpg`)
- Verification documents (`verification/{userId}/{docType}/{timestamp}.pdf`) — encrypted at rest
- Voice notes (V2)

**What does NOT go in R2:**
- Chat text → MongoDB
- Sensitive ID numbers (Aadhaar) → never store, only verify via DigiLocker

---

## Real-time chat: Socket.io

Socket.io for chat messages because:
- Reliable fallback to long-polling on bad networks (relevant in India)
- Easy room management (one room per chat)
- Built-in reconnection

**Pattern:**
```
User A sends message
  → Socket.io server receives
  → Save to MongoDB (messages collection)
  → Emit to room (User B receives in real-time)
  → Async: queue for reputation analysis
```

For scale beyond 10K concurrent users, add Redis pub/sub. Not needed at launch.

---

## Auth: Firebase Auth (recommended) or Auth0

**Use Firebase Auth for V1** because:
- Free up to 10K monthly active users
- Phone OTP works reliably in India (uses Google's infra)
- Email/password as fallback
- Easy to swap out later if you outgrow it

Switch to Auth0 if you need: enterprise SSO, advanced MFA, or compliance certifications.

---

## Payments: Razorpay

The only serious choice for India.
- Accepts UPI, cards, netbanking, wallets
- Auto-handles GST invoicing
- Webhook system for verifying payments server-side
- ~2% transaction fee (varies by method)

**For your model:** boys pay $1 (~₹83) once, girls pay $5 (~₹415) once. These are tiny amounts — UPI is essential because most users won't bother typing card details for ₹83.

See `docs/04-pricing-and-payments.md` for full integration.

---

## Verification APIs

**For ID verification (Aadhaar, PAN, Driving License):**
- DigiLocker API (govt-backed, free)
- OR Karza, IDfy, Hyperverge (paid, ~₹3-10 per verification)

**For profession verification:**
- Manual review queue is unavoidable for V1 (no API can verify "I'm a software engineer at Razorpay")
- Build a simple admin panel where you upload + check: degree certificate, employer letter, LinkedIn link
- For doctors: cross-check NMC registration number (free public lookup)
- For lawyers: cross-check Bar Council registration
- For CAs: ICAI registration

See `docs/03-verification-flow.md` for the full process.

---

## Astrology: ProKerala API

Real Vedic guna milan requires birth date, time, and place. Don't try to compute this yourself.

- ProKerala: ~₹2-3 per kundli match request
- AstroSage: similar pricing
- Cache results for 30 days (the same two birth charts always produce the same match)

---

## AI for behavior scoring: OpenAI GPT-4 or Anthropic Claude

After every chat session ends (or every N messages), send a summary to the LLM:

```
Analyze this chat for behavioral signals. Return JSON:
{
  "respect": 0-10,
  "responsiveness": 0-10,
  "depth": 0-10,
  "humor": 0-10,
  "directness": 0-10,
  "tags_positive": [...],
  "tags_negative": [...],
  "red_flags": [...]
}
```

Cost: ~$0.01 per analysis if you batch by chat. For 1000 chats/day = $10/day = $300/month.

**Don't analyze every message** — wastes money and context. Analyze chunks of 20–50 messages.

---

## Hosting: Vercel + Railway

- **Frontend (Next.js)** → Vercel free tier
- **Backend (Express + Socket.io)** → Railway or Render ($5–20/month)
- **MongoDB** → Atlas Mumbai region ($0–60/month)
- **R2 storage** → ~$5/month for 100GB

**Total at launch: ~$30/month**, scales linearly.

---

## What you DON'T need yet

Don't add these until you actually need them:
- Kubernetes / Docker orchestration
- Microservices
- GraphQL
- Redis (until 10K+ DAU)
- Elasticsearch (use MongoDB text search until 100K+ users)
- Separate analytics warehouse
- A/B testing platform

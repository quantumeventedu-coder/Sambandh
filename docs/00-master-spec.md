# Sambandh — Master Engineering Specification v2.0

**Document class:** PRD + SRS + TDD + System Architecture Blueprint — the single source of truth.
**Date:** 6 July 2026 · **Status:** Authoritative. Supersedes the "Sambandh Master Engineering Specification v1.0 (June 2026)" and every pricing figure in docs 01–07 (all live pricing is **CHF**).
**Audience:** Senior engineers and AI coding agents (Claude Code). Nothing in this document requires further product discussion; where multiple interpretations existed, the chosen one is stated and marked **[ASSUMPTION]**.
**Ground truth:** This spec is reverse-engineered from and verified against the working v0.1 codebase in this repository (all 9 unit tests passing, lint clean, full E2E journey passing as of this document's date). Where the spec describes behavior not yet implemented, it is marked **[FUTURE]**.

---

## Table of Contents

1. [Product Vision](#1-product-vision)
2. [Functional Requirements](#2-functional-requirements)
3. [Complete User Experience](#3-complete-user-experience)
4. [Business Logic](#4-business-logic)
5. [Database Design](#5-database-design)
6. [Backend Architecture](#6-backend-architecture)
7. [Frontend Architecture](#7-frontend-architecture)
8. [API Reference](#8-api-reference)
9. [Security](#9-security)
10. [Performance](#10-performance)
11. [Notifications](#11-notifications)
12. [Analytics](#12-analytics)
13. [Integrations](#13-integrations)
14. [Deployment](#14-deployment)
15. [Testing](#15-testing)
16. [Documentation](#16-documentation)
17. [Future Scalability](#17-future-scalability)
18. [Final Product Definition](#18-final-product-definition)

---

# 1. Product Vision

## 1.1 Purpose

Sambandh ("connection" in Hindi) is a **verified, honesty-first dating platform for India**. Every member is government-ID verified, every member pays a small monthly base membership (nothing is free, no bots), and an AI-driven **Karma Book** continuously measures honesty — surfacing lies, contradictions, love-bombing, and fraud patterns to potential matches *without* exposing private chat content.

## 1.2 Mission

Make online dating in India safe and honest by making **deception expensive and verifiable honesty visible**.

## 1.3 Objectives

| # | Objective | Mechanism |
|---|---|---|
| O1 | Zero fake profiles | Mandatory government ID + selfie liveness before any interaction |
| O2 | Zero free-rider spam | Paid monthly membership for everyone (base CHF 1/5/3 per month) |
| O3 | Measurable honesty | Karma Book score 0–100 with public flags; AI claim extraction & contradiction detection |
| O4 | Safe escalation of harm | Report pipeline with 24 h SLA (IT Rules 2021), AI-auto-filed reports, moderator panel |
| O5 | Compatibility beyond photos | Vedic astrology (guna milan) + engagement-style compatibility scoring |
| O6 | Privacy by default | Anonymous-first chat with mutual reveal; DPDP-compliant export & erasure |

## 1.4 Problems being solved

1. **Fake profiles and romance scams** — endemic on free dating apps in India; solved by ID verification, device-cluster fraud detection, scripted-message detection, and money-request pattern detection.
2. **Serial dishonesty** ("you're the only one") — solved by cross-chat claim comparison: exclusivity claimed to 3+ people in 30 days becomes a visible flag.
3. **Harassment with no consequences** — solved by behavioral reputation grades, AI red-flag auto-reports, and a moderation queue with real penalties.
4. **Intent mismatch** (marriage-seekers matched with casual daters) — solved by four explicit intent modes and intent-weighted ranking; users only see matches with overlapping intent.
5. **Privacy fear, especially for women** — solved by anonymous-first chat, activity transparency, free fraud-alert reveals, and a more generous daily free allowance for women.

## 1.5 Target users

- **Primary:** Indian singles 18–45, urban and semi-urban, seeking marriage, dating, casual connections, or friendship. Hindi and English speaking (names accepted in Latin or Devanagari script).
- **Secondary:** The safety-conscious cohort burned by fake profiles elsewhere; families comfortable with astrology-informed matching.
- **Internal:** Moderators (verification queue + reports queue via admin panel), and the platform operator.

## 1.6 Expected outcomes & success metrics

| Metric | Target | Measured via |
|---|---|---|
| Verified-member rate | 100 % of chat-capable users | `verification.idVerified` |
| Join-fee conversion (verify → pay) | ≥ 60 % | `join_fee_paid` analytics events |
| Fraud reports upheld / 1k users / month | < 5 | Report actions |
| Karma-flag false-positive dispute rate | < 10 % of flags disputed successfully | Dispute model |
| Moderation SLA | 90 % of reports and verifications actioned < 24 h | Cron SLA alert at 20 h |
| D30 retention of paid members | ≥ 40 % | `lastActiveAt` cohort |

---

# 2. Functional Requirements

Each feature below states purpose, flow, business logic, validation, errors, success, edge cases, permissions, data flow, UI behavior, backend processing, DB operations, notifications, logs, and analytics events. HTTP details are consolidated in [§8 API Reference](#8-api-reference).

## F1 — Email / Phone OTP Authentication

- **Purpose:** Passwordless signup/login. **Email is the primary channel** (no SMS); phone is an optional alternative. An account is keyed by whichever identifier is used (both are unique-when-present; at least one is set).
- **User flow (email):** Welcome → enter email → server generates a 6-digit code and **emails it** (`services/notify.js`; dev transport logs it + returns `devOtp`, prod sends via SMTP) → enter code → JWT session issued → after sign-in the client registers a service worker and subscribes to **web push** → route to onboarding or Discover. The "Use phone instead" toggle switches to the phone path (dev code / Firebase SMS in prod).
- **Delivery layer (`services/notify.js`) — build-now, connect-later:** email via nodemailer (real when `SMTP_URL`/`SMTP_HOST` set, else a dev transport that captures to an inspectable outbox) and web push via `web-push` (real when `VAPID_*` set, else ephemeral keys generated at boot so it works locally). Covered by `tests/notify.test.js`; verified live on Supabase (email-only account creation + push subscription).
- **Two-factor authentication (own, no libraries — `services/twofa.js`):** self-built **TOTP (RFC 6238)** over `node:crypto` (base32 + HMAC-SHA1), compatible with Google Authenticator/Authy, plus **one-time backup recovery codes** (hashed at rest). Endpoints: `GET /auth/2fa/status`, `POST /auth/2fa/setup` (returns `otpauth://` URI + secret for a QR), `POST /auth/2fa/enable` (confirm a code → issue backup codes), `POST /auth/2fa/disable`. When enabled, `verify-otp` returns `{ twoFactorRequired: true }` after the email/phone OTP and the client re-submits with `totp` (or a `backupCode`) before a token is issued. Settings has a full enable/disable UI with QR. Covered by `tests/twofa.test.js` (incl. the RFC 6238 reference vector); full lifecycle verified live on Supabase.
- **Passkeys / WebAuthn (own, no libraries — `services/webauthn.js`, `models/Passkey.js`):** self-built WebAuthn over `node:crypto` — our own CBOR decoder, COSE→JWK conversion, `authenticatorData` parsing, and ECDSA/RSA signature verification (accepts `none` attestation, the passkey standard). Enables **passwordless biometric sign-in** (fingerprint / Face ID / Windows Hello / security key) and passkey enrolment. Endpoints: `POST /auth/passkey/register-options` + `/register-verify` (enrol, authed), `POST /auth/passkey/login-options` + `/login-verify` (passwordless — resolves the user from the credential and issues a token; includes clone-detection via the signature counter), `GET /auth/passkey/list`, `DELETE /auth/passkey/:id`. Short-lived server-side challenge store. Login screen has "Sign in with a passkey"; Settings manages enrolled passkeys. Covered by `tests/webauthn.test.js` (CBOR/COSE/authData/base64url); endpoints verified live on Supabase. The browser biometric prompt itself requires a real device (localhost + HTTPS are supported). Ported from EdurankAI's self-built `webauthn.ts`.
- **Business logic:**
  - Phone must match `^\+91[6-9][0-9]{9}$` (Indian mobiles only).
  - OTP: 6 digits, valid 300 s, stored server-side in an in-memory map keyed by phone (`{ code, expiresAt, wrongAttempts, lockedUntil, requests[] }`).
  - **Lockout:** repeated wrong attempts set `lockedUntil`; further verifies are rejected until it passes. Per-IP rate limit on `request-otp`: 20/hour production, 500/hour dev.
  - Production path: when `FIREBASE_PROJECT_ID` is configured and `DEV_MODE` unset, verification uses a `firebaseIdToken` instead of the dev OTP.
  - Session: JWT signed with `JWT_SECRET`, delivered in JSON **and** as `sb_token` HttpOnly cookie. Logout writes the token to `TokenBlacklist` (checked by `requireAuth`).
- **Validation:** zod schemas (`requestOtpSchema`, `verifyOtpSchema`); OTP regex `^\d{6}$`.
- **Errors:** invalid phone → 400; wrong/expired OTP → 401 with attempts remaining; locked → 429; blacklisted token → 401.
- **Success:** `{ token, user, isNew }`; client stores token, socket connects with it.
- **Edge cases:** re-request before expiry replaces the code; phone of an erased account is reusable (hard delete frees it); concurrent sessions allowed (stateless JWT).
- **Permissions:** public endpoints.
- **Analytics:** `otp_requested`, `otp_verified`, `login`. **Logs:** OTP printed to console in dev only.

## F2 — Profile & Onboarding

- **Purpose:** Collect the mandatory dating profile before verification/payment.
- **Flow (fixed order, enforced client-side, validated server-side):** phone OTP → **signup** (name, gender, DOB, city, languages) → **ID verification** → **selfie liveness** → *(optional)* profession/education verification → **join fee** → **intent picker** → astrology details → photos → Discover.
- **Business logic:**
  - `firstName` must match `^[A-Za-z\p{Script=Devanagari}][A-Za-z\p{Script=Devanagari} ]{0,49}$/u` — English or Hindi names, 1–50 chars, letters and spaces only.
  - Gender ∈ `male | female | non_binary | other` — **immutable after join-fee payment** (it determines the fee). DOB `YYYY-MM-DD`; age computed server-side and recomputed nightly (birthday cron). Under-18 documents suspend the account instantly.
  - City resolved against the built-in Indian cities dataset (`GET /api/cities?q=` autocomplete) with centroid coordinates used for distance ranking.
  - Intent: pick 1–2 of `marriage | dating | casual | friendship`; `interestedInGenders` multi-select.
  - Photos: EXIF-stripped **client-side** before upload; the verified selfie is always pinned as the first/primary photo and cannot be unpinned.
- **Validation:** zod `signupSchema` / `profileSchema`; bio ≤ 500 chars; displayName ≤ 50.
- **Edge cases:** re-submitting signup updates the profile fields but never verification state; skipping astrology is allowed (compatibility then shows "add your details").
- **Analytics:** `signup_completed`, `photo_uploaded`.

## F3 — Identity Verification (ID + Selfie)

- **Purpose:** Guarantee every user is a real, unique, adult human matching their profile.
- **Flow:** choose **DigiLocker** (instant, recommended) or **document upload** (Aadhaar/PAN/driving licence/passport photo) → automated decision in seconds → then **selfie liveness** → approved selfie becomes the pinned primary profile photo.
- **Business logic:**
  - DigiLocker: verify the government-signed token (dev: auto-approve). **Aadhaar numbers are never stored** — only a token reference.
  - Upload: OCR extracts name/DOB → fielded against profile → instant approve/reject with per-check details; masked doc number only (`XXXX-1234`).
  - Selfie: **our own face verification (`services/face-engine.js`) — no external provider.** The browser computes a 128-d face descriptor with `@vladmandic/face-api` (client-side ML, models from CDN, no keys) during a live camera capture; the server validates it (`isValidDescriptor`), stores it (`user.faceDescriptor`), optionally matches it against the ID-photo face (`matchFaces`, threshold 0.55), and runs **duplicate-face detection** (`scanForDuplicateFace`) — the same face already enrolled on another account **auto-files an escalated `fake_profile` report** (ban-evasion / duplicate identity). A file-upload path remains as a fallback (dev simulation: confidence 0.985; bytes `FAIL` deterministically fails). Covered by `tests/face-engine.test.js`; verified live on Supabase (descriptor stored; a second account with the same face auto-flagged at distance 0). Ported from EdurankAI's `face-2fa-portable`.
  - **Attempt cap:** max attempts/day per verification type; exceeding → 429 suggesting DigiLocker.
  - **Underage:** any document proving < 18 → immediate suspension with reason.
  - Original ID images auto-delete after 30 days (nightly cron walks `uploads/verification/`).
  - Profession verification: **instant registry check** for doctors, lawyers, CAs, architects; every other profession → manual review queue with 24 h SLA. Education verification → manual queue.
- **Permissions:** authenticated user for submissions; admin (`X-Admin-Key` or admin-role JWT) for queue/approve/reject.
- **DB:** one `Verification` document per attempt (`type ∈ id|selfie|profession|education`, status, checks, documents, reviewedBy `auto-verify-engine` or moderator id).
- **Notifications:** `verification_rejected` (warning) with reason and DigiLocker suggestion; approval reflected in profile badges.
- **Analytics:** `id_verified` (with method), `selfie_verified`, `profession_submitted`.

## F4 — Payments & Membership (ALL PRICES CHF)

- **Purpose:** No free tier — everyone pays once to join; optional subscriptions and micro-purchases.
- **Price table (authoritative — `src/routes-payment.js`):**

| Purpose | Price | Minor units (rappen) | Grants |
|---|---|---|---|
| `base_subscription` (male) | **CHF 1 / 30 days** | 100 | Base membership — monthly, stacking renewals (legacy purpose `join_fee` maps here) |
| `base_subscription` (female) | **CHF 5 / 30 days** | 500 | Base membership — monthly |
| `base_subscription` (non-binary/other) | **CHF 3 / 30 days** | 300 | Base membership — monthly |
| `pro_subscription` | **CHF 6 / 30 days** | 600 | **Sambandh Pro**: unlimited messages & new chats (legacy purpose name `plus_subscription` still accepted, maps to Pro) |
| `max_subscription` | **CHF 15 / 30 days** | 1500 | **Sambandh Max**: everything in Pro + see-who-liked-you list + advanced filters (karma grade) + priority support (legacy `premium_subscription` maps here) |
| `karma_escalation` | **CHF 0.50** | 50 | Reveal evidence behind exclusivity/love-bombing/contradiction flags |
| `karma_escalation_high` | **CHF 1** | 100 | Reveal manipulation-pattern evidence |
| `boost` | **CHF 1** | 100 | 24 h profile boost **[FUTURE — priced & purchasable; ranking boost effect not yet applied]** |

- **Business logic:**
  - The join fee is computed **server-side from stored gender — never from the request body**. Creating a join-fee order requires `idVerified === true` and rejects if already paid.
  - Gateway: Razorpay orders → client checkout (currency taken from the server response, always `CHF`) → `POST /verify` validates the HMAC signature → membership updated. Webhook endpoint consumes the **raw body** for signature verification (mounted before the JSON body parser).
  - **Dev mode** (`DEV_PAYMENTS=true` or no live keys): orders get `order_dev_*` ids and `verify` marks them captured with `method: dev_simulated` — full flow works with zero external accounts. Idempotent: verifying a captured payment returns `alreadyProcessed: true`.
  - Refunds: full refund within 24 h, no questions; refund updates status, notifies the user ("reaches your account in 5–7 working days"), and writes an `AuditLog` entry.
  - Subscriptions: `tier` + `tierExpiresAt` (+30 days); nightly cron downgrades expired tiers to `free`.
- **Errors:** unknown purpose → 400; join fee already paid → 400; unverified → 403; bad signature → 400.
- **Analytics:** `join_fee_paid` (amountCHF), `subscription_started`, `payment_refunded`.

## F5 — Discover (Ranked Feed, Like/Pass, Match)

- **Purpose:** Present compatible, trustworthy candidates ranked by a real recommender that learns from behaviour, not a static formula.
- **Recommender (authoritative — `src/services/recommender.js`, wired into `src/routes-discover.js`).** Per viewer, the final score blends seven signals (weights sum to 1.0):

```
final = base         × 0.24   // the original compatibility formula (below), as one input
      + tasteMatch   × 0.20   // LEARNED: content-model of what THIS viewer likes/passes
      + reciprocity  × 0.24   // predicts if the candidate will like the viewer back
      + engagement   × 0.12   // responsiveness/depth − ghosting/blocks (reputation engine)
      + activity     × 0.08   // recency + cold-start visibility for new profiles
      + collaborative× 0.08   // "people liked by users who like who you like" (CF)
      + exploration  × 0.04   // stable per-pair jitter to avoid filter bubbles
```

  - **base** (unchanged legacy compatibility, still one input): `trust/100×.30 + karma/100×.25 + intentMatch×.20 + distanceScore×.15 + astro×.10`.
  - **tasteMatch** — `learnTaste()` compares the feature vectors (intent/language overlap, verified profession, age closeness, same-city, photo count, activity) of everyone the viewer has **liked vs passed** (last 60/120) and derives a per-feature preference weight; a candidate is scored against it via a logistic. Below 4 likes / 3 passes it returns null and a cold-start proxy (intent+language) is used.
  - **reciprocity** — product of: does the viewer fit the candidate's stated `interestedInGenders`/`ageRange`/`maxDistanceKm`; intent overlap; and desirability-"league" proximity. Weighted heavily because dating is two-sided.
  - **desirability** — an **ELO-style** score per user (`signals.desirability`, default 1500, band 800–2500) updated on every like/pass received via `recordSwipe()`, weighted by the swiper's own desirability; drives league matching. `signals.{likesReceived,passesReceived,likesGiven}` also tracked.
  - **collaborative** — user-based CF over the like graph: neighbours = others who liked the same profiles the viewer did; their other likes become weighted recommendations (bounded, normalised 0..1).
  - **reasons** — each ranked profile carries a `reasons[]` array ("Likely to like you back", "Matches your taste", "Popular with people like you", "Great conversationalist", "Active recently", "Shares your intent") surfaced on the discover card, keeping the recommender transparent.
  - Every signal degrades gracefully to base compatibility on thin data or error, so cold-start users always get a sensible feed. Covered by `tests/recommender.test.js` (11 tests) and verified live on Supabase (desirability persists and moves on like/pass).

- **Business logic:**
  - Feed excludes: yourself, already-liked/passed users, blocked users (both directions), users on your incognito list, suspended/banned/paused accounts, users without ID verification, and users whose intent doesn't overlap yours.
  - Filters: age range, distance, languages, verified-profession flag, intent.
  - **Like:** creates a `Like`; if the target already liked you → mutual match: both users notified (`match` notification) and chat becomes startable. **Pass:** creates a `Pass` (excluded from future feeds).
  - **Who liked you:** the list is a **Sambandh Max** perk (CHF 15/mo); everyone else sees the count + upsell copy — "mutual likes always match". The karma-grade feed filter is also Max-only (403 with `requiredTier: 'max'` otherwise).
  - Profile detail view includes: photos, bio, verification badges, **Karma summary** (score, grade, flags with paid-escalation buttons), **activity transparency** (active chat count, new chats in 7 d, exclusivity/love-statement counts), and compatibility scores.
- **Edge cases:** liking a user who blocked you returns success but never matches (block is silent); feed of a brand-new install shows the 5 seeded demo users in dev.
- **Analytics:** `feed_viewed`, `profile_viewed`, `like`, `pass`, `match`.

## F6 — Chat (REST + Socket.io, Anonymous-first)

- **Purpose:** Real-time messaging with privacy-preserving anonymity and abuse-resistant limits.
- **Flow:** match (or direct start where allowed) → `POST /api/chat/start` → chat opens (optionally `anonymous: true`) → real-time messages via Socket.io (`send_message`) with REST fallback → optional mutual reveal → block at any time.
- **Business logic (all enforced server-side):**
  - Start requires: both users ID-verified, initiator's join fee paid, neither blocked the other (block returns 404 "User not found" — indistinguishable from deletion), initiator not suspended, and daily new-chat limit not exceeded. Duplicate start returns the existing `chatId`.
  - Message: text 1–5000 chars, trimmed; chat must be `active`; sender must be a participant.
  - **Free-tier daily limits** (reset at IST midnight; Pro/Max unlimited; amended July 2026 — women are no longer unlimited): male **10 messages + 3 new chats/day**; female, non-binary and other **20 messages + 5 new chats/day**. Enforced identically on the REST **and Socket.io** send paths.
  - **Anonymity:** chats can start anonymous (names/photos hidden as "Someone"); **reveal is mutual-consent** — both must call `/reveal`; server tracks `userA_revealed`/`userB_revealed`, revealing only when both are true.
  - **Block:** removes the chat from both lists (archives it), adds target to `blockedUsers`, increments the target's `redFlags.blockedByOthers`.
  - Read receipts (`message_read` → `readAt`), typing indicators, presence (`user_online`), `lastActiveAt` on disconnect.
  - **AI trigger:** every 30th message in a chat (`messageCount % 30 === 0`, only when `ANTHROPIC_API_KEY` set) fires `processChatBatch` (Karma Book) and `analyzeChat` (Reputation) as fire-and-forget background jobs — never blocking message send.
- **Socket contract:** client→server `join_chat {chatId}`, `send_message {chatId,text}` (ack `{ok,messageId}|{error}`), `message_read {chatId,messageId}`, `typing {chatId}`; server→client `new_message`, `message_read`, `typing`, `user_online`. Socket auth: JWT via `auth.token` or the `sb_token` cookie; join is membership-checked per chat room (`chat:<id>`, `user:<id>`).
- **Analytics:** `chat_started`, `message_sent`, `chat_revealed`, `user_blocked`.

## F7 — Karma Book (Honesty Engine)

- **Purpose:** Detect and surface dishonesty without exposing chat content.
- **Pipeline (per 30-message batch, per participant):**
  1. **Claim extraction** (LLM `claude-haiku-4-5-20251001`, JSON out): claims typed as `exclusivity | intent | emotional | identity | experience | history | availability`, each with verbatim statement, normalized meaning, strength `weak|moderate|strong`. Persisted as `Claim` docs.
  2. **Platform-lie checks** (no LLM): "new here" vs account age > 14 days (medium); "only talking to you" vs ≥ 2 other active chats this week (high, with evidence count); unverified profession claims (low).
  3. **Contradiction detection** (LLM, pairwise vs same-type claims from last 90 days, skipping pairs > 60 days apart unless identity-type): people may change their minds — only co-temporal impossibilities or active deception count. Both claims marked `contradicted`.
  4. **Manipulation patterns** (LLM over last 60 messages, moderate-to-high confidence only): `love_bombing, off_platform_redirect, money_request, pressure_explicit, gaslighting, isolation, scripted_opener, identity_inconsistency, urgency_manufacturing, emotional_coercion`.
  5. **Fraud scan** (nightly, no LLM): device-fingerprint clusters (≥ 3 shared → high), repeated identical openers (≥ 5 → medium), money-request keyword pattern across chats (≥ 2 → **critical**).
- **Scoring:** score starts at 100, floor 0, cap 100. Deductions: lies −2/−5/−10, contradictions −3/−7/−15, manipulation −5/−12/−25, fraud −10/−25/−50/(critical) −100. **Recovery:** +1 per 30 flag-free days (nightly cron). Grades: A+ ≥ 95, A ≥ 90, A− ≥ 85, B+ ≥ 80, B ≥ 70, C ≥ 60, D ≥ 40, else F.
- **Always-on rule engine (no LLM key required).** The honesty engine works for everyone, not just when `ANTHROPIC_API_KEY` is set. Claim extraction, contradiction detection, and manipulation detection each have a deterministic **rule-based** implementation (regex/pattern matching, apostrophe-tolerant) that runs as the floor; when a key is configured the LLM path runs for higher quality and **falls back to rules on any failure** (bad key, rate limit, timeout). The 30-message batch fires regardless of key. Claims record their `method` (`llm`|`rules`). Reputation scoring (F9) remains LLM-only (sentiment). Covered by `tests/karma-rules.test.js` (15 tests) and verified live on Supabase with no working key: a user who stated two different ages over a chat was auto-flagged (score 100→70, 2 contradictions).
- **Privacy & notification ladder:** first offense → **private** warning notification; repeat → warning that flags are now visible to matches; critical fraud → "account under review" + feature limits. Public profile shows only flag-level summaries (e.g. "Has told 3 different people they were exclusive within the last 30 days") — never chat lines.
- **Paid escalation (F8) reveals evidence.** Fraud alerts are always **free** to view — safety first.

## F8 — Paid Karma Escalation

- **Purpose:** Let a genuinely concerned match see evidence, with enough friction to prevent doxxing/abuse.
- **Prices:** CHF 0.50 (exclusivity/love-bombing/contradictions) · CHF 1 (manipulation patterns) · free (fraud alerts).
- **Rate limits (spec §2.5.10):** 3 escalations/day per viewer · ≥ 1 h between escalations on the same person · ≤ 10 per target per 30 days. Violations throw descriptive errors surfaced as toasts.
- **Reveal content:** up to 5 most-recent relevant statements with `sentDaysAgo` and recipients **fully anonymized** ("Different person"). The flagged user receives an anonymous notification: *"Someone paid to see deeper into your Karma flags. They remain anonymous to you."*
- **Disputes (complete):** a flagged user files a dispute from **My Karma Book** (`POST /karma/dispute`, reason ≥ 20 chars, 7-day SLA); moderators see the queue (`GET /karma/admin/disputes`) and resolve it (`POST /karma/admin/disputes/:id/resolve`) — clearing a flag restores karma points (full clear +10, partial +5), notifies the user, and writes an audit entry. Fully wired end-to-end (verified live).

## F9 — Behavioral Reputation Engine

- **Purpose:** Grade conversational conduct from the AI analysis of chats (separate from honesty/Karma).
- **Mechanics:** every 30 messages, the LLM scores each participant's own messages 0–10 on `respect, responsive, depth, humor, directness` plus sentiment, tags, and red flags. Scores blend as a rolling average weighted 1/N per analysis. Tags dedupe/count and keep top 6 positive, top 4 negative. Letter grades (A+ ≥ 9.5 … F < 5.0) derived for `conversation` (respect+depth+humor)/3, `boundaries` (respect), `honesty` (directness), `warmth` (respect+humor+responsive)/3.
- **Red flags** (harassment, coercion, manipulation, doxxing, threats): increment `redFlags.reportsAgainst` **and auto-file a system moderation Report** — `source: 'system'`, no reporterId, category `harassment` for severe keywords else `other`, deduped per user+chat (an open system report is updated and re-dated rather than duplicated; resolved reports do not block new ones). Admin panel labels these "KARMA AI · auto-filed".
- **Counters:** `ghostingIncidents`, `blockedByOthers` (incremented on chat block), `reportsAgainst`.

## F10 — Compatibility (Astrology + Engagement)

- **Purpose:** Culturally relevant matching signals.
- **Astrology — real Ashtakoot Guna Milan (`src/services/astro.js`).** `moonPosition()` computes the Moon's **sidereal ecliptic longitude** from birth date/time via the standard mean-longitude formula + principal equation-of-centre terms, minus the **Lahiri ayanamsa** → Moon **rashi** (sign) and **nakshatra** (real astronomy, not a hash; labelled `internal_sidereal_ashtakoot`; exact when ProKerala is configured). `gunaMilan()` then computes all **eight kootas** with the classical lookup tables and dosha rules — **Varna 1, Vashya 2, Tara 3, Yoni 4, Graha Maitri 5, Gana 6, Bhakoot 7, Nadi 8 = 36** — returning per-koota `got/max`, named **doshas** (Nadi / Bhakoot / Gana), and a verdict (18+ = the traditional marriage threshold). Boy/girl assignment (from gender) drives the order-sensitive kootas. The UI shows the full koota grid + dosha warnings. Covered by `tests/astro.test.js` (12 tests: Nadi/Bhakoot doshas, Yoni enemies, Gana matrix, moon-motion, per-koota bounds) and verified live on Supabase.
- **Engagement compatibility (real):** computed from the pair's actual chat behaviour — message balance, response-time symmetry, reputation trait alignment (humor/depth/respect), and volume — producing a percentage + verdict. Cached per pair (24h) in the `Compatibility` collection.

## F10.5 — Trust & Safety Risk Engine

- **Purpose:** Combine every safety signal into one real-time risk score + tier and detect catfish/stolen-photo accounts.
- **`src/services/risk-engine.js`:** `computeRiskScore(signals)` → `{ score 0–100, tier (low/elevated/high/critical), reasons[] }` from weighted signals: ID/selfie unverified, account age, karma, reputation red flags (blocked-by/reports/ghosting), device-fingerprint cluster size, **duplicate-photo accounts**, money-request pattern, open reports, and like/message velocity. `photoBytesHash(buffer)` (sha256 of image bytes, computed at every photo/selfie upload → `user.photoHashes[]`) catches the same stolen photo reused across accounts. `assessUser(userId)` gathers the signals from the DB, scores, and persists `signals.riskScore/riskTier`.
- **Wiring:** the nightly batch scores every recently-active user and **auto-files a system report (auto-escalated)** for the critical tier; the super-admin dossier shows a live risk assessment with reasons. Covered by `tests/risk-engine.test.js` (8 tests); verified live on Supabase.

## F11 — Reports & Moderation

- **Purpose:** Human-in-the-loop enforcement with statutory SLAs.
- **User reports:** category ∈ `harassment | fake_profile | scam | underage | hate_speech | non_consensual_image | other`, description 10–2000 chars, optional chat/message references. Self-reporting rejected.
- **Auto-escalation:** ≥ 5 distinct reporters within 7 days → all pending reports on that user flagged `autoEscalated` (senior moderator). **NCII and underage are urgent** — flagged for 24 h handling per IT Rules 2021.
- **Moderator actions** (each resolves the report, records reviewer + time, writes an `AuditLog` entry): `warning` (notification), `suspend_24h` / `suspend_7d` (suspends + `suspension.endsAt` +24 h/+168 h + critical notification), `ban_permanent` (bans + deactivates), `no_action`.
- **Admin auth:** `X-Admin-Key` header matching `ADMIN_API_KEY`, or a JWT whose user has the admin role.

## F12 — Notifications (in-app + web push + email)

Types in use: `new_match`, `karma_warning`, `account_under_review`, `verification_rejected`, `moderation_warning`, `account_suspended`, `escalation_alert`, `payment_refunded`. Fields: type, severity (`info|warning|critical`), title, body, read, createdAt. Feed endpoint returns newest-first; unread count drives the bell badge.

**Delivery:** `deliverNotification(userId, {...})` (exported from `routes-notifications.js`) creates the in-app notification, **web-pushes** it to the user's registered browsers (`user.pushSubscriptions[]`, pruning dead endpoints), and **emails** the user for off-app-worthy events (matches, moderation, safety). Browser subscriptions are managed via `GET /api/notifications/vapid-key`, `POST /api/notifications/subscribe`, `POST /api/notifications/unsubscribe`, backed by the service worker at `/sw.js`. The match flow already uses `deliverNotification`; other call sites can adopt it incrementally.

## F13 — Settings, Privacy & Account (DPDP)

- Privacy toggles (hide activity status, incognito list = hidden-from users), notification preferences.
- **Pause:** hides the profile from Discover without deleting anything.
- **Data export:** DPDP-compliant JSON bundle of profile, payments, verifications (metadata), claims about self, notifications.
- **Delete account:** sets `status.deletedAt`; account hidden immediately; **full hard erasure after 30 days** by the nightly cron — deletes KarmaBook, Reputation, Claims, Likes, Passes, Notifications, Verifications; rewrites the user's messages to `[deleted]`; archives chats; deletes the User document (freeing the phone number).
- Payment history list with amounts in CHF.

## F14 — Admin Panel

Single static page (`public/admin.html`) protected by the admin key, with: **Verification queue** (pending manual verifications; approve/reject with reason), **Reports queue** (pending reports newest-last, auto-escalated and Karma-AI badges, warn/suspend/ban/no-action buttons), and stat chips fed by the queues + `GET /api/analytics/admin/summary` (7-day event counts + last 50 audit entries).

## F15 — Super Admin (Owner Console)

- **Purpose:** Owner-only oversight with **full access** — including lawful inspection of chat content for investigating illegal activity — under a strict privacy protocol. Deliberately separate from the moderator Admin panel: **admins/moderators can never read chat content** (prevents insider abuse); only the `SUPER_ADMIN_KEY` holder can, and every such access is permanently recorded.
- **Auth hierarchy:** `SUPER_ADMIN_KEY` (header `X-Super-Key`) passes every admin route *and* the super admin routes; `ADMIN_API_KEY` passes admin routes only and is rejected by super admin routes. Dev keys: `sambandh-super-dev-key` / `sambandh-admin-dev-key` (auto-filled by the panels in dev mode; **rotate both for production**).
- **Privacy protocol (load-bearing):** chat-content access requires a **written reason (min 10 chars)** which is stored in the immutable `AuditLog` (`sa_chat_inspected`, retained 3 years) together with the participants and message count; user-detail views are logged (`sa_user_viewed`); emergency account actions require a reason (`sa_account_action`). The audit trail is itself visible in the panel — oversight of the overseer.
- **Capabilities:** platform stats (users/tiers/chats/messages-24h/reports/revenue CHF), user search (phone/name/id), full user dossier (profile, karma, reputation, payments, reports both directions, verifications, chat count), per-user chat list, reason-gated message viewer, emergency actions (warn / suspend 24h / 7d / ban / unsuspend / unban), audit-trail viewer.
- **Panel:** `public/superadmin.html` (dark console; screen S23).

## F16 — Scheduled Jobs (Nightly Batch)

In-process scheduler ticks every 10 minutes; runs once per IST day at ~02:00 IST: **(1)** fraud scan over users active in the last 7 days, **(2)** age recompute from DOB, **(3)** karma +1 recovery per 30 clean days, **(4)** deletion of verification originals > 30 days old, **(5)** DPDP hard-erasure of accounts deleted ≥ 30 days ago, **(6)** downgrade of expired subscriptions, **(7)** verification-queue SLA alert when the oldest pending item exceeds 20 h. Every job is individually try/caught — one failure never aborts the batch. Multi-instance deployments must move this to a single dedicated worker.

---

# 3. Complete User Experience

The product is a **mobile-first single-page web app** (`public/index.html` + `app.js` + `styles.css`) served by the API itself, plus the admin page. Design language: warm Indian palette (sindoor red, haldi yellow CSS variables), Georgia serif display type, card-based layout.

## 3.1 Screen inventory & behavior

| # | Screen | Entry | Key elements & behavior |
|---|---|---|---|
| S0 | **Marketing homepage** (`public/home.html`, served at `/`) | any visitor | Standalone responsive landing page: hero, trust strip, 10 feature cards, Karma Book example-flag section, 5-step joining guide, CHF pricing table, FAQ, CTAs to `/app`. Smart CTA ("Open the app") when a `sb_token` exists; forwards legacy `#/…` deep links into `/app#/…` |
| S0b | In-app "How it works" (`#/features`) | welcome screen link | Same content rendered inside the SPA, viewable logged-out or logged-in |
| S1 | Welcome (`/app`) | app entry | Brand, value props, "Get started" + "See how it works" CTAs |
| S2 | Phone entry | S1 | +91 prefix fixed, 10-digit input, validation inline |
| S3 | OTP entry | S2 | 6 boxes; dev banner shows the OTP; resend after cooldown; lockout message on 429 |
| S4 | Signup form | new user | Name (Latin/Devanagari), gender select (warning: fixed after payment), DOB picker (18+ enforced), city autocomplete from `/api/cities`, language chips |
| S5 | ID verification | S4 | Two cards: DigiLocker (recommended, "verifies in 30 seconds") vs Upload (idType select + file). Per-check results rendered as pass/fail rows; rejection shows reason + DigiLocker suggestion |
| S6 | Selfie liveness | S5 | Camera capture; on approval shows "this becomes your first profile photo" |
| S7 | Profession/education (optional) | S6 | Registry-verified professions get instant badge; others show "under review, ~24 h" |
| S8 | Join fee | S6/S7 | Large price display "CHF {fee}" with hint "Men CHF 1 · Women CHF 5 · Non-binary CHF 3 — your price is set by your verified profile, not by this page"; Razorpay checkout (or one-tap dev simulation); "Full refund within 24 hours, no questions asked" |
| S9 | Intent picker | S8 | 1–2 intent tiles + interested-in gender chips |
| S10 | Astrology form | S9 | Birth date/time/place; skippable |
| S11 | Photo upload | S10 | Multi-upload, EXIF stripped client-side, selfie pinned first |
| S12 | **Discover** (home tab) | nav | Ranked cards: photo, name/age/city, badges (ID, profession), karma grade chip, intent tags; Like / Pass buttons; filter sheet (age, distance, language, intent, verified-only); empty state: "No more profiles — widen your filters"; skeleton cards while loading |
| S13 | Profile detail | S12 tap | Photo carousel, bio, badges, **Karma Book section** (score, grade, flag cards each with "See evidence → CHF 0.50/1" button; fraud alerts free & red), **activity transparency** rows, compatibility scores, Like / Pass / Report actions |
| S14 | Escalation reveal modal | S13 | Confirm dialog ("Pay CHF X… The person is notified someone looked deeper — but never who. Limited to 3/day.") → paid → evidence list "You paid CHF X — evidence below": statements + "said N days ago · Different person" |
| S15 | Likes tab | nav | Non-Max: count + upsell notice ("Seeing who liked you is a Sambandh Max perk (CHF 15/month). Like people back in Discover — mutual likes always match."); Max: full list |
| S16 | Chats list | nav | Conversations sorted by last message; anonymous chats render as "Someone" with a mask icon; unread dots |
| S17 | Chat thread | S16 | Real-time bubbles, typing indicator, read ticks, day separators; anonymous banner with "Reveal identity" (explains mutual consent, pending state "waiting for them"); daily-limit toasts with upgrade CTA at 429; block & report in the overflow menu |
| S18 | My Karma Book | nav/profile | Own score, grade, per-category history, notification ladder explanation, dispute action per flag |
| S19 | Compatibility view | S13 | Guna-milan /36 with per-guna bars + "internal approximation" label; engagement compatibility % with explanation |
| S20 | Notifications | bell | Newest-first, severity-colored, mark-as-read on view |
| S21 | Settings | nav | Privacy toggles (switch rows), incognito list, membership card (tier, expiry, upgrade buttons with confirm dialog), payment history (CHF amounts + status), pause account, data export (downloads JSON), delete account (double confirmation, explains 30-day erasure) |
| S22 | Admin panel (`/admin.html`) | direct URL + key | Queues + stat chips as per F14; report cards show category chip, AUTO-ESCALATED and "KARMA AI · auto-filed" badges; **no chat content anywhere**; dev mode auto-fills the dev key |
| S23 | **Super admin panel** (`/superadmin.html`) | direct URL + `SUPER_ADMIN_KEY` | Owner console (F15): Overview stats · Users & Chats (search → dossier → chat list → reason-gated message viewer with audit banner) · Audit trail tab; emergency account actions with reason prompts; dev mode auto-connects with the dev key |

## 3.2 Cross-cutting UX rules

- **States:** every list has empty/loading/error states; toasts (bottom, auto-dismiss) for all mutations; destructive actions use confirmation dialogs.
- **Responsive:** single column ≤ 480 px (primary target); content max-width centered on tablet/desktop; bottom tab bar on mobile.
- **Offline/socket loss:** REST fallback for sending; socket auto-reconnects (Socket.io default backoff); optimistic message rendering with ack reconciliation.
- **Accessibility:** semantic buttons/labels, 44 px touch targets, WCAG-AA contrast on the palette, focus states; OTP inputs auto-advance but remain individually focusable. **[ASSUMPTION — codified going forward]**
- **Caching:** the server sends `Cache-Control: no-cache` for the web app so UI updates appear immediately (ETag revalidation).

---

# 4. Business Logic (consolidated rulebook)

## 4.1 Validation rules

| Field | Rule |
|---|---|
| Phone | `^\+91[6-9][0-9]{9}$` |
| OTP | `^\d{6}$`, 300 s validity |
| First name | `^[A-Za-z\p{Script=Devanagari}][A-Za-z\p{Script=Devanagari} ]{0,49}$` with `u` flag |
| DOB | `YYYY-MM-DD`, age ≥ 18 |
| Bio | ≤ 500 chars · Display name ≤ 50 |
| Message | 1–5000 chars after trim |
| Report description | 10–2000 chars |
| Intent | 1–2 of the 4 modes |
| All request bodies | zod schemas; failures → 400 with zod error detail |

## 4.2 State machines

- **User status:** `active` → (`paused` ↔ active) → `suspended` (auto-lift at `suspension.endsAt`) → `banned` (terminal) → `deletedAt` set → hard-erased (30 d).
- **Verification:** `pending` → `in_review` → `approved | rejected` (re-submission allowed up to daily cap).
- **Chat:** `active` → `archived` (block or account erasure).
- **Report:** `pending` → `reviewing` → `resolved` (+`autoEscalated` flag orthogonal).
- **Payment:** `created` → `captured` → (`refunded`).
- **Membership tier:** `free` → `pro`/`max` (30 d per purchase, stacking extends) → auto-downgrade `free`.

## 4.3 Rate limits & quotas (single table)

| Scope | Limit | Window/Reset | Enforced in |
|---|---|---|---|
| Any `/api` route | 300 req/min/IP | rolling 60 s | express-rate-limit |
| `request-otp` | 20/h/IP (dev 500) | rolling 1 h | ipLimit |
| OTP wrong attempts | lockout via `lockedUntil` | until expiry | otpStore |
| Verification attempts | max/day/type | IST midnight | attemptsToday |
| Free male | 10 msgs, 3 new chats | IST midnight | checkDailyLimits (REST + socket) |
| Free female / non-binary / other | 20 msgs, 5 new chats | IST midnight | checkDailyLimits (REST + socket) |
| Paid tiers (any gender) | unlimited | — | tierIsActive |
| Karma escalations | 3/day/viewer · 1 h/target · 10/30 d/target | rolling | escalateAndReveal |
| Report auto-escalation | ≥ 5 distinct reporters | 7 days | routes-report |

## 4.4 Calculations

Discover score (F5 formula) · Karma score deltas + recovery (F7) · Reputation rolling averages & grades (F9) · Age from DOB (floor of years, 365.25-day year) · Fees by gender (F4) · Distance from city centroids · IST = UTC + 5 h 30 m for all daily resets and the nightly batch.

## 4.5 Exception handling, retries, conflicts

- Central Express error handler: logs `[ERROR]` and returns `{error}` — **never a stack trace**.
- Cron jobs and AI jobs are individually try/caught; AI analysis is fire-and-forget (`.catch` logged) and never blocks messaging.
- Payment verify is idempotent (`alreadyProcessed`). System-report filing dedupes per user+chat. DB connect retries: Atlas → Atlas via Google DNS (8.8.8.8/1.1.1.1) on SRV failure → in-memory fallback (dev).
- LLM JSON parse failures degrade gracefully (skip batch, warn log). Socket send failures return `{error}` acks; client can retry.

---

# 5. Database Design (MongoDB / Mongoose — 18 collections)

Conventions: `_id` ObjectId PK everywhere; `userId`-style fields are ObjectId refs with indexes on every field used in queries; no cascading deletes except the scripted DPDP erasure; soft delete only on User (`status.deletedAt`) — everything else is hard state.

| Collection | Key fields (type — constraint) | Relations & indexes |
|---|---|---|
| **User** | phone (String — unique), profile{firstName, displayName, gender enum, dob Date, age Number, city, state, country='IN', languages[], bio, photos[{url,isPrimary,fromSelfie,uploadedAt}], intent[], interestedInGenders[], astrology{}, profession, income{annualINR — legacy}}, verification{idVerified Bool, selfieVerified, professionVerified, educationVerified, trustScore 0–100}, membership{joinFeePaid Bool req, joinFeeAmountCHF Number, joinFeeAmountUSD/INR — legacy unused, joinFeePaymentId, paidAt, tier enum free/plus/premium, tierExpiresAt}, preferences{ageRange, maxDistanceKm, …}, blockedUsers[ObjectId], incognitoList[ObjectId], status{active,paused,suspended,banned,deletedAt}, suspension{endsAt,reason}, security{deviceFingerprint}, lastActiveAt, createdAt | Unique index phone; indexes on status flags, city |
| **Verification** | userId ref, type enum id/selfie/profession/education, claim{}, documents[{type,url/value,uploadedAt}], status enum, submittedAt, reviewedAt, reviewedBy, reviewMethod, rejectionReason, expiresAt | index userId+type, status+submittedAt (queue) |
| **Chat** | participants [ObjectId]×2, createdAt, lastMessageAt, messageCount, anonymity{isAnonymous,userA_revealed,userB_revealed}, intent, status enum active/archived, moderation{flaggedMessages,isNSFW} | index participants, lastMessageAt |
| **Message** | chatId ref, from ref, to ref, text ≤5000, type='text', deleted Bool, createdAt, readAt, behaviorSignals{analyzedAt} | index chatId+createdAt, from+createdAt |
| **Like / Pass** | from ref, to ref, createdAt | compound unique (from,to) |
| **KarmaBook** | userId (unique), score 0–100, lies[], contradictions[], manipulationFlags[], fraudFlags[] (each entry: severity/confidence, reason/detail, recordedAt), activitySignals{lastRecoveryAt,…}, lastUpdatedAt, timesNotified | unique userId |
| **Claim** | userId, chatId, type enum ×7, statement, normalized, strength enum, contradicted Bool, createdAt | index userId+type+createdAt |
| **Reputation** | userId (unique), scores{respect,responsive,depth,humor,directness — default 5}, grades{conversation,boundaries,honesty,warmth}, tagsPositive/tagsNegative[{tag,count,lastSeenAt}], userRatings{}, redFlags{ghostingIncidents,blockedByOthers,reportsAgainst}, trustScore, basedOnChats, basedOnMessages, lastUpdatedAt | unique userId |
| **Report** | source enum user/system (default user), reporterId ref (**required iff source ≠ system**), reportedUserId ref (indexed), chatId, messageIds[], category enum ×7, description ≤2000, status enum pending/reviewing/resolved (indexed), autoEscalated Bool, reviewedAt, reviewedBy, action enum | index reportedUserId, status |
| **Notification** | userId, type, severity enum, title, body, read Bool, createdAt | index userId+createdAt |
| **Payment** | userId, purpose, amountCHF Number, currency='CHF', amountINR/USD — legacy unused, razorpayOrderId, razorpayPaymentId, status, method, capturedAt, metadata{} | index userId+createdAt, razorpayOrderId |
| **Escalation** | viewingUserId, targetUserId, flagType, paymentId, createdAt | index viewingUserId+createdAt, target pair |
| **Dispute** | userId, flagRef, reason, status, resolution | — |
| **Compatibility** | userA, userB, astro{score36,gunas{}}, engagement{pct,explanation}, computedAt | compound (userA,userB) |
| **TokenBlacklist** | token, expiresAt | TTL index expiresAt |
| **AuditLog** | actor, action, targetType, targetId, detail{}, createdAt | index createdAt |
| **AnalyticsEvent** | name, userId, props{}, createdAt | index name+createdAt |

**Migrations:** schema-less Mongo + Mongoose defaults mean additive changes need no migration; renames/repurposes (like the INR→CHF move) keep legacy fields marked "legacy, unused" instead of destructive migration. JSON Schema mirrors live in `schemas/*.json` and must be updated with any model change.

---

# 6. Backend Architecture

## 6.0 Data layer (switchable, hardened)

The app talks to `src/db/odm.js`, not to Mongoose directly. When `DATABASE_URL` is
set it loads **`src/db/pg-odm.js`** — a Mongoose-compatible document engine over
**PostgreSQL/Supabase** (one table per collection: `id text primary key, doc jsonb`);
otherwise it loads real Mongoose (Atlas or in-memory). Every model and route runs
unchanged on either backend.

The Postgres engine is built for scale, not just correctness:
- **Reads are filtered in SQL, not in Node.** Each Mongo filter is translated into a
  `WHERE` on the JSONB column (`_id`→primary key, scalar equality, `$in`, `$gt/$gte/$lt/$lte`,
  `$exists`, `$all`, array membership) so Postgres returns only matching rows. The
  JS matcher then runs on those rows as the **correctness authority** — the SQL
  pre-filter only ever needs to be a permissive superset, so it can never cause a
  wrong result. Untranslatable operators (`$ne`, `$nin`, `$size`, `$regex`, `$or`)
  fall through to the JS matcher. A per-key param snapshot rolls back partial
  translations so a bound value never outlives its placeholder.
- **Indexes**: every table gets a GIN index (array membership / containment) plus
  btree expression indexes on hot reference paths (`chatId`, `from`, `to`, `userId`,
  …); `findById` hits the primary key. Index creation is best-effort (never bricks a
  populated table).
- **DB-level uniqueness**: partial unique indexes on `unique` fields (`phone`,
  `razorpayPaymentId`); a violation raises a Mongo-style `E11000` (code 11000).
- **Pooling**: `pg.Pool`, capped at 2 connections under Vercel, 8 otherwise.
- Verified against live Supabase with the full E2E suite (core journey, tier/limit,
  super-admin, and a depth suite asserting index existence, 23505 uniqueness, and
  PK index scans) plus the Mongoose path via jest.

> ‼️ **Supabase host**: use the **session-pooler** hostname
> (`aws-…pooler.supabase.com:5432`), not the `db.<ref>.supabase.co` direct host,
> which is IPv6-only and unreachable from Vercel/most IPv4 networks.

## 6.1 Runtime & module map

Node ≥ 20, Express 4, Socket.io 4, Mongoose 8 (or the pg engine above). Single process serving API + static web app + websockets.

```
src/server.js                 bootstrap: middleware → routes → static → sockets → DB (Atlas→DNS-retry→in-memory) → seed → crons → listen
src/routes-*.js               10 feature routers (auth, verification, discover, chat, compat, karma, payment, report, notifications, me)
src/sockets-chat.js           JWT-authed Socket.io handlers
src/karma-book.js             honesty engine (LLM + heuristics) + escalation logic
src/reputation-engine.js      behavioral scoring + system-report filing
src/crons.js                  10-min ticker, nightly IST batch (7 jobs)
src/seed-demo.js              5 demo users when SEED_DEMO=true and DB empty
src/services/storage.js       R2 (S3 API) or local ./uploads fallback; UPLOADS_ROOT
src/services/verify-engine.js OCR/liveness/face-match decisions (dev simulations, prod provider hooks)
src/services/astro.js         guna-milan approximation
src/services/analytics.js     track(name, userId, props) → AnalyticsEvent
src/data/cities.js            Indian city dataset with centroids
src/models/*.js               18 Mongoose models
```

## 6.2 Middleware order (load-bearing)

1. `helmet` (CSP disabled for the bundled SPA — re-enable with a real CSP when the app is served separately)
2. `cors` (origin = `FRONTEND_URL` or reflect)
3. **`/api/payment/webhook` raw-body parser** (must precede JSON)
4. `express.json({limit: '25mb'})` (base64 photo uploads)
5. `/api` rate limit 300/min/IP
6. Routers → static (`/uploads`, `public/` no-cache) → API 404 → SPA fallback → error handler

## 6.3 Auth model

- `requireAuth`: Bearer JWT or `sb_token` cookie → verify signature → check TokenBlacklist → attach `req.userId`.
- `requireAdmin`: `X-Admin-Key === ADMIN_API_KEY` (sets actor `admin-panel`) or admin-role JWT.
- Same JWT authenticates sockets.

## 6.4 Background work

In-process: nightly cron batch (F15) and fire-and-forget AI jobs on the 30-message trigger. **Scaling rule:** at > 1 instance, move crons to a dedicated worker and the AI triggers to a queue (BullMQ/Redis) — see §17.

## 6.5 Storage, logging, monitoring, backup

- Files: Cloudflare R2 via S3 SDK when `R2_*` set; else `./uploads` locally. Verification originals auto-purge at 30 days.
- Logs: console prefixes `[OK] [..] [WARN] [ERROR] [CRON] [KARMA] [REPUTATION] [MODERATION] [FRAUD] [SEED]`. Production: ship stdout to a log aggregator; `SENTRY_DSN` env reserved for error monitoring.
- Health: `GET /health` → `{ok, time, db, devMode}` for uptime probes.
- Backup: MongoDB Atlas continuous backup (prod requirement); local/in-memory modes are explicitly non-durable dev conveniences.

---

# 7. Frontend Architecture

- **Stack:** deliberately dependency-free vanilla JS SPA (`public/app.js`) + `styles.css` + Socket.io client + Razorpay checkout script. No build step — the API serves it directly.
- **Structure:** screen-per-function renderers (`obPayNow`, `renderSettings`, `buyTier`, `escalateFlag`, …) writing into a root container; a tiny `api(path, opts)` fetch wrapper attaches the JWT and normalizes errors to thrown messages; `toast()` for feedback; `esc()` for HTML escaping **(mandatory for all user content — XSS defense)**; `ic()` icon helper; router keyed on auth/onboarding state.
- **State:** current user object refreshed via `refreshUserAndRoute()` after every state-changing action; socket connection carries live chat state.
- **Design system:** CSS custom properties (sindoor/haldi palette), `.card`, `.btn`, `.tag`, `.tile`, `.notice`, `.switch` primitives; Georgia serif for display numbers (e.g. the CHF price).
- **Payments:** always read `order.currency` from the server — currency is never hard-coded client-side.
- **Performance:** no framework runtime, single JS file, ETag revalidation; images lazy-load. **Error boundaries:** every async handler try/catches into `toast(e.message)`.
- **[FUTURE]** If the app is rewritten in a framework, this section's contracts (API wrapper, escaping, server-driven currency, state refresh points) carry over as requirements.

---

# 8. API Reference

Base URL `/api`. Auth column: **P** public · **U** user JWT (`Authorization: Bearer` or `sb_token` cookie) · **A** admin (`X-Admin-Key` or admin JWT). All bodies JSON (except webhook: raw). All errors: `{ "error": string }` with 400 (validation), 401 (auth), 403 (forbidden/unpaid/unverified), 404 (not found/blocked), 429 (rate limit), 500 (generic — never a stack trace). Global limit 300 req/min/IP. Versioning: implicit v1; breaking changes require `/api/v2` namespace **[FUTURE]**.

| # | Method & path | Auth | Purpose / notes |
|---|---|---|---|
| 1 | GET `/health` (root) | P | Liveness: `{ok, time, db, devMode}` |
| 1a | GET `/` (root) | P | Marketing homepage (`home.html`, no-cache) |
| 1b | GET `/app` (root) | P | The SPA shell (`index.html`, no-cache); hash routes `#/welcome`, `#/features`, … |
| 2 | GET `/api/cities?q=` | P | City autocomplete, ≤ 10 prefix matches `{cities:[{name,state}]}` |
| 3 | POST `/auth/request-otp` | P | `{phone}` → dev: `{ok, devMode, devOtp, validSeconds:300}`; prod: SMS sent. 20/h/IP |
| 4 | POST `/auth/verify-otp` | P | `{phone, otp}` or `{phone, firebaseIdToken}` → `{token, user, isNew}` + `sb_token` cookie |
| 5 | POST `/auth/logout` | U | Blacklists the JWT, clears cookie |
| 6 | POST `/auth/complete-signup` | U | Signup schema (F2) → `{ok, user}` |
| 7 | GET `/auth/me` | U | Full own user object (profile, verification, membership) |
| 8 | POST `/auth/delete-account` | U | Marks `deletedAt`; erased after 30 d |
| 9 | POST `/verification/id` | U | `{method:'digilocker', digilockerToken}` or `{method:'upload', idType, document:{base64,filename}}` → `{status, checks, reason?}` |
| 10 | POST `/verification/selfie` | U | `{base64}` → liveness + face-match decision; approved → pinned primary photo |
| 11 | POST `/verification/profession` | U | Registry professions instant; else manual queue (24 h SLA) |
| 12 | POST `/verification/education` | U | Manual queue |
| 13 | GET `/verification/me` | U | Own verification states |
| 14 | GET `/verification/admin/queue` | A | Pending manual verifications |
| 15 | POST `/verification/admin/:id/approve` | A | Approve + apply badges |
| 16 | POST `/verification/admin/:id/reject` | A | `{reason}` → rejection + notification |
| 17 | POST `/payment/create-order` | U | `{purpose?}` default `base_subscription` → `{orderId, amount, amountCHF, currency:'CHF', purpose, key?, prefill?, devMode?}`; base requires idVerified, renewals stack +30 d; **fee from stored gender**. Tier `free` = no access (amended July 2026: nothing is free; `membership.joinFeePaid` = "membership currently active", set on any activation, cleared by the nightly expiry cron) |
| 18 | POST `/payment/verify` | U | Dev: `{razorpay_order_id}`; prod: + `razorpay_payment_id, razorpay_signature` (HMAC checked) → grants purpose; idempotent |
| 19 | POST `/payment/webhook` | P (signature) | Razorpay webhook, raw-body HMAC verification |
| 20 | GET `/payment/history` | U | Own payments (CHF) |
| 21 | POST `/payment/:id/refund` | A | Full refund + notification + audit **(24 h no-questions policy)** |
| 22 | GET `/discover` | U | Ranked feed (formula F5) with query filters `minAge,maxAge,maxKm,language,intent,verifiedOnly` |
| 23 | POST `/discover/:userId/like` | U | Like; mutual → match + notifications `{matched:bool}` |
| 24 | POST `/discover/:userId/pass` | U | Pass |
| 25 | GET `/discover/likes` | U | Who liked me — full list requires active tier; free gets count + upsell |
| 26 | GET `/discover/profile/:userId` | U | Full profile + karma summary + activity + compatibility (also aliased at GET `/api/profile/:userId`) |
| 27 | GET `/chat` | U | My conversations (last 50 by recency, unread counts) |
| 28 | POST `/chat/start` | U | `{withUserId, anonymous?, intent?}` → `{chatId, existing}` (rules F6) |
| 29 | GET `/chat/:chatId/messages` | U | Thread messages (participant-only) |
| 30 | POST `/chat/:chatId/messages` | U | `{text}` REST fallback send (same limits as socket) |
| 31 | POST `/chat/:chatId/block` | U | Block + archive + `blockedByOthers++` |
| 32 | POST `/chat/:chatId/reveal` | U | Consent to reveal; both consents → identities shown |
| 33 | GET `/karma/me` | U | Own Karma Book |
| 34 | GET `/karma/:userId/summary` | U | Public flag-level summary (F7) |
| 35 | POST `/karma/:userId/escalate` | U | `{flagType, paymentId}` → evidence reveal (limits F8); fraud free |
| 36 | POST `/karma/dispute` | U | Dispute a flag |
| 37 | GET `/compat/:userId` | U | Astrology /36 + engagement % (cached) |
| 38 | POST `/report` | U | Report schema (F11) → `{reportId, slaHours:24}` |
| 39 | GET `/report/admin/queue?status=` | A | Reports queue, populated names, ≤ 100 |
| 40 | POST `/report/admin/:id/action` | A | `{action}` ∈ warning/suspend_24h/suspend_7d/ban_permanent/no_action |
| 41 | GET `/notifications` | U | Own notifications newest-first |
| 42 | POST `/notifications/read` | U | Mark read |
| 43 | GET/POST `/me/settings` | U | Privacy & preference toggles, incognito list |
| 44 | POST `/me/pause` | U | Toggle profile pause |
| 45 | GET `/me/export` | U | DPDP JSON export |
| 46 | GET `/analytics/admin/summary` | A | 7-day event counts + last 50 audit entries |
| 47 | GET `/superadmin/stats` | **S** | Platform overview (users/tiers/chats/moderation/revenue CHF) |
| 48 | GET `/superadmin/users?q=` | **S** | User search (phone/name/id, ≤ 25) with karma + status |
| 49 | GET `/superadmin/users/:id` | **S** | Full dossier; logs `sa_user_viewed` |
| 50 | GET `/superadmin/users/:id/chats` | **S** | User's chats with counterpart identities |
| 51 | GET `/superadmin/chats/:chatId/messages?reason=` | **S** | Chat content; **reason ≥ 10 chars required** (400 otherwise); logs `sa_chat_inspected` |
| 52 | POST `/superadmin/users/:id/action` | **S** | `{action: warn\|suspend_24h\|suspend_7d\|ban\|unsuspend\|unban, reason}`; logs `sa_account_action` |
| 53 | GET `/superadmin/audit?limit=` | **S** | Audit trail, newest first (≤ 500) |

Auth **S** = super admin only: header `X-Super-Key` must equal `SUPER_ADMIN_KEY`. The admin key is rejected (401) on S routes; the super key is accepted on A routes.

**Socket.io events** (auth: JWT in `auth.token` or cookie): client→server `join_chat`, `send_message` (ack `{ok,messageId}` / `{error}`), `message_read`, `typing`; server→client `new_message`, `message_read`, `typing`, `user_online`.

**Example — create & verify a dev join-fee payment:**
```http
POST /api/payment/create-order
Authorization: Bearer <jwt>
{"purpose":"join_fee"}
→ 200 {"devMode":true,"orderId":"order_dev_1a2b","amount":100,"amountCHF":1,"currency":"CHF","purpose":"join_fee"}

POST /api/payment/verify
{"razorpay_order_id":"order_dev_1a2b"}
→ 200 {"ok":true,"paymentId":"..."}
```

---

# 9. Security

| Area | Implementation |
|---|---|
| Authentication | Phone OTP (dev) / Firebase SMS (prod); JWT HS256 with `JWT_SECRET` (64-hex mandated); `sb_token` HttpOnly cookie; TokenBlacklist on logout (TTL-indexed) |
| Authorization | `requireAuth` on every user route; participant checks on every chat/message/reveal; ownership checks on payments/notifications; `requireAdmin` (X-Admin-Key or admin JWT) on admin/queue routes; `requireSuperAdmin` (X-Super-Key) on owner routes. RBAC = 3 roles: user < admin/moderator < super-admin. **Chat content is readable only by the super admin**, only with a written reason, and always audit-logged — admins cannot read chats by design (insider-abuse prevention) |
| Payment integrity | Fee derived from **stored** gender, never the request; Razorpay HMAC on verify + raw-body HMAC on webhook; idempotent capture |
| Injection | MongoDB + Mongoose typed schemas (no string query concat); zod validation on input; **NoSQL-injection hygiene:** never pass raw request objects into query operators |
| XSS | All user content rendered through `esc()` in the SPA and admin panel; helmet headers (CSP to be enabled at launch) |
| CSRF | Token-based API auth (Bearer) is CSRF-resistant; the cookie path is same-site **[ASSUMPTION: set `SameSite=Lax` explicitly at launch]** |
| SSRF | No user-supplied URL fetching server-side |
| File uploads | Base64 in JSON (25 MB cap), stored under controlled keys `verification/<uid>/...` / `users/<uid>/photos/...`; EXIF stripped client-side; NSFW moderation via Sightengine when keys set **[FUTURE]** |
| Secrets | `.env` only (git-ignored); `.env.example` documents every variable; **launch checklist requires rotating `JWT_SECRET` and `ADMIN_API_KEY`** |
| Sensitive data | Aadhaar numbers never stored (token reference only); doc numbers masked; verification originals deleted at 30 d; chat evidence revealed only via paid escalation with recipient anonymization |
| Audit | `AuditLog` for moderation actions, refunds, admin activity; `[MODERATION]` logs for AI red flags |
| Rate limiting | See §4.3 table |
| Compliance | **DPDP Act 2023**: export + 30-day full erasure; **IT Rules 2021**: 24 h grievance SLA, NCII priority; Grievance Officer + DPO + ToS/Privacy Policy required before public launch (legal checklist, README) |

---

# 10. Performance

- **Targets [ASSUMPTION]:** p95 API < 300 ms on feed, < 100 ms on messaging; socket delivery < 150 ms same-region; support 10k DAU on a single node before scale-out.
- Indexes on every hot path (participants, chatId+createdAt, reportedUserId+status, phone unique, TTL blacklist).
- Feed pipeline filters in-query before scoring; compatibility cached per pair; ranking computed in memory over the pre-filtered candidate set.
- AI work asynchronous and batched (30-message cadence, 50–80 message caps per prompt, cheap Haiku-class model).
- Static assets served with ETag; images via R2 + CDN URL at launch; JSON body cap 25 MB only on upload paths in practice.
- Scale-out path (§17): stateless API behind LB + Socket.io Redis adapter + dedicated cron/AI worker + Atlas M10+.

---

# 11. Notifications

- **In-app (implemented):** Notification collection + feed + bell badge; types & severities in F12; created at every lifecycle event (match, karma warnings, verification results, moderation, refunds, escalation alerts).
- **SMS (prod):** OTP only, via Firebase. No marketing SMS.
- **Push / Email [FUTURE]:** Web-push for new_message/match and transactional email (receipts, warnings) — add a `NotificationPreference` block in settings; respect the existing privacy toggles; digest scheduling via the cron ticker.
- **Webhooks (inbound):** Razorpay payment webhook only. No outbound webhooks.
- **Reminder system [FUTURE]:** re-engagement nudges keyed off `lastActiveAt` — must respect pause/delete states.

---

# 12. Analytics

- **Event pipe:** `track(name, userId, props)` → `AnalyticsEvent`. Canonical events: `otp_requested, otp_verified, login, signup_completed, id_verified, selfie_verified, profession_submitted, photo_uploaded, join_fee_paid, subscription_started, payment_refunded, feed_viewed, profile_viewed, like, pass, match, chat_started, message_sent, chat_revealed, user_blocked, karma_flagged, escalation_paid, report_filed`.
- **Dashboard:** admin summary endpoint (7-day counts by event + last 50 audit rows) rendered as stat chips in the admin panel.
- **KPIs:** funnel `otp_verified → signup_completed → id_verified → join_fee_paid` (activation), like→match rate, messages/chat, karma-flag rate, report rate, SLA compliance.
- **Audit trail:** `AuditLog` is the compliance record — moderation actions, refunds — never deleted.

---

# 13. Integrations

| Integration | Purpose | Auth/env | Failure & fallback |
|---|---|---|---|
| **Anthropic Claude** (`@anthropic-ai/sdk`) | Karma claim extraction, contradiction & manipulation detection, reputation scoring — model `claude-haiku-4-5-20251001` (alias `claude-haiku-4-5` acceptable), plain `messages.create`, JSON-in-prose parsing with graceful skip | `ANTHROPIC_API_KEY` | No key → LLM steps disabled; platform-behavior checks (account age, active chats, fraud heuristics) still run. Errors logged, batch skipped, never blocks chat |
| **Razorpay** | Orders, checkout, signature verify, webhook, refunds — currency CHF | `RAZORPAY_KEY_ID/SECRET`, `WEBHOOK_SECRET` | Missing/test keys → full dev simulation (`DEV_PAYMENTS`) |
| **Firebase Auth** | Production SMS OTP | `FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY` | Unset → dev OTP on screen |
| **DigiLocker / Hyperverge / Karza** | Real ID verification, OCR, face match | respective keys | Unset → dev auto-approve simulations in verify-engine |
| **Cloudflare R2** | Photo/document storage (S3 API) | `R2_*` | Unset → local `./uploads` |
| **ProKerala** | Real Vedic guna milan | `PROKERALA_CLIENT_ID/SECRET` | Unset → internal approximation, labeled in UI |
| **Sightengine** | NSFW image moderation | `SIGHTENGINE_*` | Unset → skipped **[FUTURE wiring]** |
| **Sentry** | Error monitoring | `SENTRY_DSN` | Unset → console only |

Retry policy: payment webhook is retried by Razorpay (idempotent handler); LLM/provider calls are not retried in-line (next 30-message batch or nightly run covers the gap).

---

# 14. Deployment

- **Environments:** `development` (everything simulated; `npm run dev` opens browser via `scripts/dev.js`, or `Start Sambandh.cmd`) → `staging` (live keys, test gateway) → `production`.
- **Infra (launch):** 1× Node 20 container/VM behind TLS (Caddy/Nginx or PaaS), MongoDB Atlas (M10+, continuous backup), R2 bucket + CDN. Port `PORT` (default 3010 via `.env`; code default 3001).
- **Env vars:** exactly as documented in `.env.example` (server, DB, JWT, dev flags, Razorpay, Anthropic, Firebase, ID providers, R2, ProKerala, Sightengine, Sentry). **Remove `DEV_MODE`, `DEV_PAYMENTS`, `SEED_DEMO` and rotate `ADMIN_API_KEY`/`JWT_SECRET` before public traffic.**
- **CI/CD [ASSUMPTION]:** GitHub Actions — `npm ci` → `npm run lint` → `npm test` → deploy on main; health-check gate on `/health`; rollback = redeploy previous image (stateless app, no migrations to unwind).
- **Monitoring:** uptime probe on `/health` (checks `db:'connected'`), Sentry for exceptions, log aggregation for `[CRON]`/`[MODERATION]` alerts (the 20 h SLA warning must page a human).
- **Disaster recovery:** Atlas point-in-time restore; R2 versioning; the app itself is stateless and redeployable in minutes.

---

# 15. Testing

- **Framework:** Jest (`npm test`), config `jest.config.js` (node env, 60 s timeout for the in-memory Mongo download), suites in `tests/`.
- **Current unit/integration coverage (all passing):** `tests/reputation-engine.test.js` — grade mapping, rolling-average blending, red-flag counter + system-report filing, per-user+chat dedup, resolved-report re-filing, severe→harassment categorization, Report model conditional `reporterId` validation (9 tests, real in-memory MongoDB).
- **E2E (scripted, passing):** signup → OTP → ID (DigiLocker dev) → selfie → join fee (asserts `currency==='CHF'`, CHF 1 male) → membership check → discover feed → profile → like → chat start → REST message → history → notifications. Devanagari-name signup verified separately.
- **Lint:** ESLint 9 flat config (`eslint.config.js`), `npm run lint` — zero errors/warnings policy.
- **Required additions before launch:** payment signature-verification tests (valid/tampered HMAC), free-tier limit tests at the IST boundary, block-visibility tests, karma platform-lie checks, cron erasure test, load test on feed + sockets (k6, 500 concurrent), security pass (OWASP ASVS L1 + the pentest on the legal checklist), accessibility audit (axe) on all 22 screens.
- **Acceptance criteria:** every F-section's success conditions hold; all §4.3 limits enforced server-side (verified by test, not UI); no endpoint returns a stack trace; the full E2E journey passes against a clean database.

---

# 16. Documentation

| Audience | Artifact |
|---|---|
| Developers | This spec (`docs/00-master-spec.md`), README (run instructions), `docs/01–07` design rationale (historical — superseded notes included), `schemas/*.json` data contracts, `api-examples/*.http` runnable requests |
| Administrators | Admin panel guide: queues, action semantics, SLA duties, `X-Admin-Key` handling (F14, §8 rows 14–16, 39–40, 46) |
| End users | In-product copy (onboarding explains verification, pricing, Karma Book, anonymity, refund policy); ToS + Privacy Policy required at launch (legal) |
| API consumers | §8 table + examples; the API is currently first-party only |
| Ops | §14 deployment/runbook + `.env.example` as the variable reference |

---

# 17. Future Scalability

- **Horizontal scale:** stateless API → N instances behind LB; Socket.io Redis adapter for cross-instance rooms; move the OTP map to Redis; single cron worker (leader-elected or dedicated); AI triggers via queue.
- **Extensibility:** feature routers are drop-in (`app.use('/api/x', router)`); verify-engine and storage are provider-pluggable behind stable function signatures; karma pattern list and claim types are data-driven constants.
- **Feature flags [FUTURE]:** env-based flags exist (`DEV_*`); add a `flags` collection for runtime toggles.
- **i18n/l10n [FUTURE]:** UI copy is centralizable; Devanagari input already supported; add Hindi UI strings; currency is already isolated server-side (single CHF constant + price table) making multi-currency a contained change.
- **Multi-tenancy / enterprise:** not planned; the architecture (per-collection userId scoping) does not preclude it.
- **Microservices path:** first candidates for extraction are the AI analysis worker (karma+reputation), payments, and media — each already communicates through models/queues rather than shared in-memory state.

---

# 18. Final Product Definition

**A first-time user** opens the site, sees the welcome pitch, enters their +91 phone, types the 6-digit OTP, and creates a profile in English or Hindi. They verify identity in under a minute with DigiLocker (or upload a document and get an instant automated decision), take a liveness selfie that becomes their pinned first photo, optionally verify their profession, and pay their one-time join fee — CHF 1, 5, or 3 by gender, price computed server-side, refundable for 24 hours. They pick up to two intents, optionally add birth details for astrology, upload photos (EXIF-stripped), and land in Discover.

**Discover** shows only real, ID-verified people with overlapping intent, ranked by trust (30 %), karma (25 %), intent match (20 %), distance (15 %), and astrological fit (10 %). Every profile shows its Karma grade and activity transparency. Liking someone who liked you creates a match with notifications on both sides; passing hides them; blocking anywhere makes each party invisible to the other forever.

**Chat** can begin anonymous; identities reveal only when both consent. Messages flow in real time with typing and read receipts, capped on the base membership (men 10 messages + 3 new chats/day; women, non-binary and others 20 + 5) and unlimited on Sambandh+/Premium — resetting at IST midnight, enforced on both the REST and socket paths. Every 30 messages, AI quietly analyzes each participant: honesty claims are extracted and checked against their actual platform behavior and their statements to others; conduct is graded; harassment or coercion auto-files a moderation report labeled "KARMA AI".

**Dishonesty has a ladder:** the first contradiction earns a private warning; repetition makes flags visible on the profile ("Has told 3 different people they were exclusive within the last 30 days"); a concerned match can pay CHF 0.50–1 to see the anonymized evidence (3/day, the flagged person is notified but never told who); fraud alerts are free for everyone. Honesty recovers: +1 karma per 30 clean days.

**Safety is enforced:** reports get a 24-hour SLA, five reporters in a week auto-escalate, moderators warn, suspend (24 h/7 d), or ban from a key-protected panel, and every action is audit-logged. Underage documents suspend instantly. NCII reports are urgent by statute.

**Privacy is real:** pause hides you; export hands you your data; deletion erases everything after 30 days including your phone number's reusability; Aadhaar numbers are never stored; verification documents self-destruct after 30 days.

**Operationally**, the whole system runs today with zero external accounts (in-memory DB, simulated OTP/payments/verification, 5 demo users) via `npm run dev`, and switches to production behavior purely through environment variables — Firebase SMS, live Razorpay in CHF, R2 storage, real ID providers, ProKerala astrology, and Claude-powered analysis — with a nightly IST batch handling fraud scans, birthdays, karma recovery, document purges, DPDP erasure, subscription downgrades, and SLA alerts. `npm run lint` and `npm test` are green gates; the scripted E2E journey (signup → verify → pay CHF → discover → match → chat) is the acceptance bar for every release.

---

*End of specification. Keep this document updated with every behavioral change; it supersedes docs/01–07 wherever they conflict.*

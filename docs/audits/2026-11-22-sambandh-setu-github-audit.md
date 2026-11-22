# Audit — github.com/ujala100/Sambandh-Setu (22 Nov 2026)

Scope: the whole repository at `61f2343` (12 commits, 20–21 Nov 2026, three authors) — Expo
React Native app (`frontend/`), Node/Express API (`backend/backend/`), Python FastAPI
"Setu Guide" AI service (`setu_ai/`). Static review plus a secret scan of every commit. The
deployed services were not probed and no code from the repo was executed.

**Verdict:** a well-designed product concept and a careful AI-service design, but the backend
is not safe to put in front of real people. Two issues allow taking over any account. The
concepts were ported into Sambandh Setu; none of this code was.

## Critical

1. **Any account can be taken over.** `POST /auth/otp/request` returns the OTP in the response
   when the *client* sends `isPhone: true` (`authController.js` L42, L76–85). Request a code for
   any email with `isPhone:true`, then call `/auth/otp/verify` with `purpose:"login"` and a new
   `password`; L179–181 silently replace the victim's password.
2. **Phone numbers are never verified.** The app turns a phone into `digits@sambandhsetu.local`
   and displays the code it receives (`frontend/src/services/api.ts` `toEmail`, `sendOtp`).
3. **Fake profiles with a public password in production.** `seedUsers.js` creates 10 members
   with password `Password123!`; it runs on every build (`build.sh`) and when the database is
   empty (`config/db.js`). Anyone can log in as "aanya" and chat with real members.

## High

4. Verify-OTP changes an existing account's password without the current password.
5. OTP codes are written to logs in plain text with the email (`otpService.js` L59–62).
6. `GET /profiles/:userId` and `/discover` return every profile field, including family
   (religion/caste), preferences and builder answers, to any signed-in user. There is no
   blocking, and paused or deactivated profiles still appear in Discover.
7. The AI service is public and unauthenticated (CORS `*`, no key). Anyone can call it with
   any `user_id`, spending the Gemini quota. Behind Render's proxy all users share one 60/min IP bucket.
8. A match's interests, lifestyle and location are sent to Gemini without that person's consent.
9. No age gate: new profiles default to age 26; DOB → age ignores month and day.
10. "Delete account" only logs out while telling the user everything is permanently removed.
    The blocked-users list is hard-coded sample data, and there are no block, report or unmatch
    endpoints. That is a DPDP and IT Rules 2021 problem.

## Medium

11. Chat history order is random after the SQL migration (sorted by random hex ids), so cursor pagination is broken.
12. Either person can advance the shared 8-stage journey alone, all the way to "Decision".
13. The chat profile fabricates data: always `online: true`, city "Bengaluru" when any routine
    is set, age 28 and interests "Travel, Books" by default.
14. Photos never leave the phone: `avatarUrl` stores a local `file://` path, so others never see them.
15. Postgres TLS uses `rejectUnauthorized:false`; the example env allows CORS from `*`.
16. The default limit on `/auth` is 5 requests per hour per IP for everything, including login.
17. The query builder maps unknown keys straight to column names. That is safe today but a
    latent injection path. Escaped regex text breaks searches such as "C++".
18. Without `DATABASE_URL` it uses SQLite on Render's ephemeral disk, so data is lost on every deploy.

## Operations and quality

- CI never runs: the workflows sit in `backend/.github` and `setu_ai/.github`, not the repo
  root. `backend-ci` points at the wrong folder, and Node 20 has no `node:sqlite`.
- The docs still describe MongoDB (41 references); `check-prod-config` requires `MONGODB_URI`.
- Committed junk: `backend/backend/.mongo_data/`, and `frontend/.expo/` cache paths too long
  to check out on Windows. `frontend/.env` is committed but holds only public values.
- The crisis reply has no Indian helpline numbers, and detection is English-only.
- The landing-page design shows invented statistics (70% / 80% / 85%) and a testimonial. Do not ship them.
- **No real secrets** were found in any commit. Gitleaks configuration and Sentry scrubbing are present.

## Strengths worth keeping (and kept)

The 8-stage journey and Reflect with per-answer sharing; the Setu Guide safety rules (no
outcome predictions, no deciding for the user, consent-field allowlist, fallbacks); 96
knowledge-base chunks and evaluation sets; HMAC-hashed OTPs with timing-safe compare.

## Compared with the live Sambandh (www.sambandh.online)

| | Sambandh-Setu repo | Live Sambandh → Sambandh Setu |
|---|---|---|
| Clients | Expo app + web export | Web SPA + Capacitor shell (Android/iOS) on one API, `/api/v1` |
| Sign-in | Email OTP (bypassable), fake phone OTP, password | Email OTP fail-closed in production, password, Google, passkeys, TOTP 2FA, token revocation |
| Verification | None | Live face check, ID and profession checks |
| Safety | No block/report/delete | Block, report, moderation queue, DPDP export and erasure |
| Matching | List + requests | Ranked Discover with swipe deck, mutual likes, anonymous-first chat |
| AI | Public Gemini service | Self-hosted-first engine, memory, graph, web research, Lakshan with human review |
| Data | SQLite/Neon, schema DDL | Supabase Postgres (pg-odm) with DB-level constraints |
| Tests | ~16 backend files (CI not running) | 115 suites, 1,112 tests passing |

## What was ported into Sambandh Setu

Concepts and content only: the 8-stage journey (fixed so both people must complete each
stage), the 10 Reflect questions from the wireframes with per-answer sharing, the Setu Guide
intents and safety principles, and the 96-chunk knowledge base. All re-implemented and tested.

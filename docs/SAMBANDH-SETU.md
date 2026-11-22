# Sambandh Setu — build notes (22 Nov 2026)

Branch: `feat/sambandh-setu` (not merged, not deployed). This rebuilds the live
Sambandh (www.sambandh.online) as **Sambandh Setu**: the Setu designs, the Setu
Journey, and the Sambandh Setu Intelligence Engine, on the existing backend.

## 1. What already existed (kept, reused)

Express API (~300 routes) on Supabase Postgres through `pg-odm` (Mongoose-compatible),
JWT + passkeys + Google sign-in, face verification, Discover/likes/matching, chat
(Socket.io on persistent hosts, REST polling on Vercel), Lakshan/Karma Book, CHF
payments, DPDP export/delete, block/report, Capacitor shell, an in-house neural match
model (`services/nn`, consent-gated training). Nothing working was rewritten.

## 2. What was added

| Area | Where | Notes |
|---|---|---|
| Model layer (self-hosted first) | `src/intelligence/models/` | OpenAI-compatible (vLLM, llama.cpp server, LM Studio, TGI) and native Ollama providers; optional external provider only when `SETU_ALLOW_EXTERNAL=true` and always ordered after self-hosted models; **Setu Core** CPU fallback that is always available. Routing by task and complexity (small/large tier), automatic failover, circuit breaker, streaming, JSON output with validation and one repair, tool-calling loop, embeddings, health with GPU data (Ollama `/api/ps` VRAM, vLLM `/metrics` KV-cache), latency/token metrics. |
| Memory | `src/intelligence/memory.js`, `models/Memory.js` | Episodic / semantic / project / procedural / explicit. Owner-scoped at the data layer, AES-256-GCM encrypted at rest, keywords stored only as keyed hashes. Hybrid retrieval: embeddings + BM25 + knowledge-graph overlap + time window + recency + confidence, with per-result reasons. Supersede-with-history, versioned corrections, dedupe/reinforce, explicit beats inferred. Sensitive inferences (health, religion/caste, sexuality, politics, credentials) are never auto-saved. |
| Cross-chat context | `src/intelligence/context.js` | Resolves "that project", "the other conversation", "what we discussed last week"; related conversations; "you asked this before"; open tasks/deadlines; rolling conversation summaries. |
| Knowledge graph | `src/intelligence/graph.js` | Per-user entities and relations with provenance, confidence, validFrom/validTo; functional facts supersede (history kept), repeats reinforce. |
| Extraction | `src/intelligence/extract.js` | Model path (schema-validated JSON) and rule path: decisions, tasks, deadlines (Indian date formats), commitments, preferences, facts, goals, requirements, procedures, entities (incl. 110+ Indian cities). |
| Web intelligence | `src/intelligence/web/` | SearXNG (self-hosted) or Brave; SSRF-safe fetch (IP checks inside DNS lookup, redirects re-validated, size/time caps); robots.txt (RFC 9309) + crawl-delay; readable-HTML and basic PDF extraction; source quality with reasons; conflict detection across sources; numbered citations; never claims a search it did not do. |
| Research agent | `src/intelligence/agent.js` | Plan → search → read → gap follow-up → cited synthesis; step/fetch/time limits, progress, cancellation; runs as a durable job. |
| Lakshan intelligence | `src/intelligence/lakshan.js` | 10-step contradiction analysis with epistemic labels (verified / self-reported / unverified), time-gap and context reasoning, confidence, plain-language explanation. **Automated output is private and has no public effect**; members can acknowledge, add context or appeal; only a moderator confirmation moves the public (`reviewedScore`) grade or shows a flag. |
| Controlled learning | `src/intelligence/learning.js` | Feedback adjusts confidence of the memories used; corrections become versioned memory; evaluation examples only with `aiTrainingConsent`, PII-redacted, no user id; nightly decay/expiry. No model-weight training on private chats. |
| Jobs | `src/intelligence/jobs.js` | DB-backed queue with atomic claim; interval worker on persistent hosts, Vercel Cron on serverless. |
| Assistant (Setu Guide) | `src/intelligence/assistant.js`, `routes-intelligence.js` | One pipeline for all clients; crisis replies (Tele-MANAS 14416, 112) bypass models; prompt-injection fencing; authorised platform context (a chat only for participants and only if the member enabled it); SSE streaming; feedback; conversation history management. |
| Setu Journey | `routes-journey.js`, `data/setu-journey.js` | 8 stages; a stage completes only when both complete; pause/resume by the pauser only; Reflect with the 10 questions from the designs and per-answer sharing. |
| Public profiles + SEO | `routes-public.js` | `/u/<username>` server-rendered; opt-in, and indexing is a second opt-in; JSON-LD ProfilePage, canonical, OG; sitemap and robots; Android App Links / iOS Universal Links files. |
| Apps API | `routes-v1.js` | `/api/v1/*` aliases every `/api/*` route; `/api/v1/meta`; push device registration; FCM HTTP v1 sender for Android and iOS. |
| Admin | `superadmin.html` (Intelligence tab), `admin.html` (Lakshan review) | Models, health, GPU, latency, tokens, jobs, quality, search config; aggregates only. |
| Frontend | `public/home.html`, `public/setu.js`, `public/setu.css` | New homepage; app tab bar Home · Discover · Setu Guide · Chats · Me; Home dashboard, swipe deck, Setu Guide, Memory, Guide settings, Public profile, Journey, Reflect, Lakshan observations. No emojis in the new UI. |

## 3. Running a self-hosted model

The engine works with **no model** (basic mode). To turn on a real model:

**This laptop (RTX A2000, 4 GB VRAM)** — install Ollama, then:
```
ollama pull qwen2.5:3b          # ~2 GB, fits 4 GB VRAM (Q4)
ollama pull nomic-embed-text
SETU_LLM_PROVIDER=ollama
SETU_LLM_BASE_URL=http://127.0.0.1:11434
SETU_LLM_MODEL=qwen2.5:3b
SETU_EMBED_MODEL=nomic-embed-text
```
**Production** — Vercel cannot host a GPU. Run vLLM on a GPU VM (e.g. one L4/A10G 24 GB:
`qwen2.5-14b-instruct-awq` for chat, a small model for extraction, `bge-m3` for embeddings)
behind HTTPS with a bearer token, then set `SETU_LLM_BASE_URL`, `SETU_LLM_MODEL`,
`SETU_LLM_API_KEY`, `SETU_EMBED_MODEL`, or add models in Super admin → Intelligence.
Changing the embedding model is safe: vectors are only compared within the same model, and
keyword/graph retrieval keeps working meanwhile.

**Web research** — run SearXNG (Docker), enable `json` in `search.formats`, set `SEARXNG_URL`.

Other env vars: see `.env.example` (MEMORY_KEY, CRON_SECRET, FCM_SERVICE_ACCOUNT_JSON,
ANDROID_CERT_SHA256, APPLE_TEAM_ID…).

## 4. Verified

- New tests: `intelligence-core` (35), `intelligence-engine` (24, real Postgres via pglite),
  `setu-routes` (12). Full suite: 115 suites / 1,112 tests passing.
- Production DB (read-only probe): compatible; 14 new tables are created on first use;
  no username conflicts; no member's public Lakshan grade changes today.
- Local server on an isolated in-memory DB: 17/17 end-to-end checks; screenshots of the
  homepage (desktop + 390 px phone) and the app screens, no horizontal overflow.

## 5. Not done yet (honest list)

- No GPU model or SearXNG is deployed, so production answers run in basic mode until one is.
- Vercel Hobby runs the cron once a day; queued jobs wait until then (Pro or an external
  scheduler fixes this). Most memory extraction runs inline, so this rarely matters.
- Streaming on Vercel may arrive in one piece depending on the function runtime.
- The 295 wireframes are covered for the main flows; account/phone/email change screens,
  Family Access, Help & Support and the remaining Settings sub-pages still use the existing
  app screens.
- The native apps are not built or published: needs Android Studio/Xcode, store accounts,
  Firebase, signing keys (steps in `mobile/README.md`).
- Older app screens still contain a few emoji glyphs (location gate, chat header).
- The memory index is in-process cosine over a member's own memories (fine to thousands per
  member); move to pgvector when that grows.

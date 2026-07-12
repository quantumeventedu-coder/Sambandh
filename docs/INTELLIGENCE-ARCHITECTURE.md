# Sambandh Intelligence Platform — Architecture Specification

**Status:** grounded in the shipping codebase. Every "Built" claim below points at a
real module you can open. The roadmap sections are honestly labelled as *near-term*
(buildable on the current stack) or *research* (multi-year, funded-team scope). This
document deliberately does **not** claim a custom foundation model or AGI — see §10.

---

## 1. What Sambandh actually is

A **Human Relationship Intelligence Platform**: it maintains an *evolving, multi-signal*
model of people and pairs, and uses it for verified, honesty-first matching across
**dating, marriage, friendship, and professional/networking** — with a Community layer
and an astrology layer on top.

It is **not one LLM**. It is a set of **independent, cooperating engines**, most of them
**deterministic** (no hallucination, explainable, cheap), with an LLM used only as an
optional language layer. This is the core architectural bet and it is already true today.

## 2. Design principles (and where each is enforced)

| Principle | Meaning | Enforced by |
|---|---|---|
| Humans evolve | no permanent labels | ELO desirability + per-viewer taste learning (`recommender.js`); psychology re-derived per chat |
| Evidence over assumption | estimate from many signals | 8-signal compatibility (`compatibility.js`); reputation from behaviour |
| Explicit uncertainty | predictions carry confidence | `psychology.js` returns `confidence` and `"Unknown"` until enough data |
| Consent-centric | only shared/observable data | `preferences.aiTrainingConsent`; data export/delete; super-admin chat access is audit-logged |
| Explainability | say *why* | discover `reasons[]`; compatibility component breakdown; astro provenance labels |

## 3. Layered architecture (mapped to real modules)

```
Interaction (routes-*, sockets-chat)                     ← REST + Socket.io
      │  events: register, profile, like/pass, message, pay, verify, room post
      ▼
Signal extraction
   · psychology.js   (attachment · Big Five/OCEAN · love language from chat)
   · reputation-engine.js (respect/responsive/depth/humor from behaviour)
   · risk-engine.js  (trust/fraud signals)
   · flag-engine.js  (12 red-flag + 6 positive rules)
      ▼
Person model (models/User: signals.desirability, verification, karma/Lakshan, astro chart)
      ▼
Relationship model (models/Compatibility per pair; engagement recomputed as they chat)
      ▼
Decision / ranking
   · recommender.js  (7 blended signals + learned taste + collaborative filtering)
   · trainer.js      (self-trained logistic model on consented swipe outcomes)
   · compatibility.js (the §6 weighted formula)
      ▼
Presentation (discover cards · compatibility screen · Lakshan Book · astrology section)
```

Every stage is a separate module with a pure function surface, independently unit-tested
(134 tests today).

## 4. Data philosophy — four categories, never conflated

- **Facts** — user-provided profile fields (`User.profile`, `User.claims`).
- **Observations** — platform events (messages, likes, response times, room posts).
- **Inferences** — engine estimates *with confidence* (attachment style, OCEAN, karma).
- **Predictions** — forward-looking (reciprocity likelihood, desirability league).

Verification claims (ID/profession) are checked against evidence, never trusted blindly.

## 5. The engines (Built — real files)

| Engine | File | In | Out |
|---|---|---|---|
| Astrology | `services/astro-engine.js` | birth date/time/place | 9 grahas, Lagna, houses, D9/D10, yogas, doshas, Vimshottari dasha, transits, panchang |
| Psychology | `services/psychology.js` | interleaved chat msgs | attachment style, Big Five, love language (+confidence) |
| Flags | `services/flag-engine.js` | messages + context | 12 red-flag + 6 positive rules → karma delta |
| Reputation | `reputation-engine.js` | chat batches | respect/responsive/depth/humor scores + tags |
| Risk | `services/risk-engine.js` | verification + signals | risk score/tier + reasons |
| Compatibility | `services/compatibility.js` | all of the above | 0–99 score + per-dimension breakdown + warnings |
| Recommender | `services/recommender.js` | viewer + candidates | ranked feed + reasons; learns per-viewer taste |
| Self-learning model | `services/trainer.js` | consented swipe outcomes | logistic weights, retrained offline/nightly |
| Karma/Lakshan | `karma-book.js` | claims + contradictions | honesty score + flags (rule-based; LLM optional) |

## 6. Multidimensional compatibility (Built, §4.2 formula)

Compatibility is a **weighted blend of independent dimensions**, each with its own
contribution (not one opaque score):

`Vedic 20 · Yoni 10 · Gana 8 · Attachment 15 · Big Five 10 · Love language 7 ·
Engagement 20 · Karma 10 (+ up to 5 intent/language bonus)`, capped at 99, with hard
safety caps (D/F karma → ≤40, critical fraud flag → 0). A **relationship lens**
(romance / friendship / business) reweights the astrological factors for the use-case.
See `services/intelligence.js` + `routes-compat.js`.

## 7. Learning strategy (Built + near-term)

- **Built:** `trainer.js` trains a small logistic-regression ranking model on
  **anonymised, consented** swipe outcomes (features: age/intent/language/profession/
  distance/trust/desirability-gap/photo/verification). Retrainable from the super-admin
  **AI Engine** panel, blends into discover ranking. This is a *real, self-improving,
  own model trained on organic data* — the honest version of "our own model."
- **Near-term:** offline eval harness (holdout accuracy already reported), fairness
  checks, versioned deploys behind the same panel.
- The LLM layer (Anthropic, optional) is used for **language** (chart Q&A, karma
  interpretation) with a deterministic rule fallback — never as the intelligence core.

## 8. Event model (Near-term — the next real step)

Today most signals are recomputed from stored rows. The next architectural step is an
append-only **event log** (`events` table on Postgres: `id, userId, type, payload jsonb,
createdAt`) so behaviour is derived from sequences, replayable as engines improve:
`UserJoined, ProfileUpdated, Liked, Passed, MessageSent, ReplyDelayed, RoomPosted,
MatchAccepted, CoachingShown`. Feature extractors read the log; summary views stay for
speed. This is concretely buildable on the current stack in days, not years.

## 9. Privacy, consent, governance (Built)

- **Consent:** `aiTrainingConsent` gates model training; only anonymised outcomes used.
- **Rights:** data export (JSON) + delete (erased ≤30 days) in-app.
- **Access:** only the **super-admin** can read chat content, each access requires a
  written reason and is written to an immutable `AuditLog` (oversight of the overseer).
- **Diagnostics:** super-admin **System Test** console exercises every engine live.

## 10. Honest scope — what is and isn't built

**Built and running:** everything in §3–§9 (deterministic multi-engine intelligence,
multidimensional compatibility, a self-trained ranking model, verification, Lakshan,
astrology, community, privacy/audit).

**Near-term, buildable on this stack:** event log (§8), surfaced confidence in the UI,
a coaching nudge from existing signals, richer offline eval, RAG over a curated
knowledge base for the LLM answers.

**Research / multi-year / funded-team (NOT built, and not to be faked):** a custom
**foundation model trained from scratch**, distributed GPU training, an autodiff/tensor
engine, a full vector knowledge-graph, and multi-agent orchestration. Training a
foundation LLM is a multi-million-dollar, multi-team effort; Sambandh deliberately uses
**deterministic engines + an existing LLM (Anthropic) + its own small self-trained
ranking model** instead. This is a feature, not a gap: it's explainable, cheap, private,
and shippable today — and it's the honest story that survives technical due diligence.

---

*This spec is intentionally grounded: it documents a system that exists and a roadmap that
is buildable, and it draws a clear line at claims that would not withstand scrutiny.*

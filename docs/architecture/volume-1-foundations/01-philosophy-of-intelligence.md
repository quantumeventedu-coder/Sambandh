# Volume I · Chapter 1 — Philosophy of Intelligence

## Objective

Before a single model is chosen, one question must be answered: **what does
"intelligence" mean inside Sambandh?** If we cannot define it, every subsystem is
built on assumption. This chapter fixes the definition the rest of the manual
depends on, and — unusually for a philosophy chapter — ties each principle to the
place in the code where it is already enforced.

## The definition we commit to

Intelligence, for Sambandh, is **not** the ability to produce fluent language. It
is the ability to:

1. **Observe** reality through many channels.
2. **Represent** what was observed without losing time or provenance.
3. **Infer** hidden traits *with explicit uncertainty*.
4. **Predict** future outcomes probabilistically.
5. **Decide** — rank, recommend, warn — from those inferences.
6. **Adapt** as new evidence arrives.
7. **Explain** every conclusion.

A fluent chatbot does #1 and stops. Sambandh's value is #2–#7, and almost all of
it is **deterministic** — which is why it is explainable and cheap.

## Five design principles (and where each is enforced)

| Principle | Meaning | Enforced in code |
|---|---|---|
| **Humans evolve** | no permanent labels | ELO desirability updates on every swipe (`recommender.js` → `recordSwipe`, [L239](../../src/services/recommender.js)); psychology is re-derived per conversation |
| **Evidence over assumption** | estimate from many signals, never one | 8-dimension blend in `compatibility.js` (`computeCompatibility`, [L62](../../src/services/compatibility.js)) |
| **Explicit uncertainty** | every inference carries confidence | `attachmentStyle` returns `{ style, confidence }` and `'Unknown'` under 8 messages (`psychology.js` [L86](../../src/services/psychology.js)) |
| **Consent-centric** | learn only from opted-in, anonymised data | `captureSwipe` returns early unless `preferences.aiTrainingConsent` (`trainer.js` [L50](../../src/services/trainer.js)) |
| **Explainability** | always say *why* | `recommender.js` `score()` returns `reasons[]` ([L226](../../src/services/recommender.js)); `compatibility.js` returns a per-component breakdown |

These are not aspirations. Open the files; the enforcement is there.

## Why "not one LLM" is the whole thesis

The tempting architecture is: pour everything into one large model and let it
decide. We reject it, for reasons that are engineering facts, not preferences:

- **Explainability.** A logistic model's weights are inspectable
  (`trainer.js` exposes them via `stats()`, [L131](../../src/services/trainer.js));
  a compatibility score decomposes into named contributions. A single opaque model
  can rank a match but cannot *defend* the ranking to a user or a regulator.
- **Cost & latency.** A Vedic chart, an attachment estimate, and a compatibility
  score are microseconds of arithmetic. Routing each through an LLM would be
  slower and orders of magnitude more expensive at 1M+ users.
- **Truthfulness.** Deterministic engines do not hallucinate. A birth-chart is
  computed from ephemeris math (`astro-engine.js`), not generated as plausible text.
- **Honesty under scrutiny.** "We use deterministic engines plus a small
  self-trained ranking model plus Anthropic for language" is a claim that holds up
  when a reviewer opens the repo. "We built our own foundation model" would not.

The LLM ([`llm.js`](../../src/services/llm.js)) sits *on top*, phrasing answers the
engines already computed, with a deterministic rule fallback when it is absent.

## What intelligence is *not*, here

- It is not a permanent judgement of a person. Estimates decay and update.
- It is not certainty. Every inference is a best estimate given current evidence.
- It is not a single number. Even the compatibility score decomposes into eight
  named, individually defensible components.

## Consequences carried into the rest of Volume I

1. Represent people as *evolving state*, not static rows (Ch 4).
2. Keep four information classes separate — facts, observations, inferences,
   predictions (Ch 2–3).
3. Treat **time** as a first-class computational dimension (Ch 5).
4. Fuse **many** observation channels; distrust any single one (Ch 6).
5. Attach **confidence and provenance** to everything inferred.

Every later volume is an elaboration of these five commitments.

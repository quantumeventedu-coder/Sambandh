# Volume I · Chapter 4 — Computational State

## Objective

Design the AI's **internal representation of a human being** — not a database row,
but an evolving, layered, confidence-aware estimate that many engines can update
without stepping on each other. This is the most consequential representation
choice in the platform: if it is poor, every model built on it is poor.

## 4.1 A person is a state estimate, not a record

Inside Sambandh a person is not a profile, a chat log, or a JSON document. It is the
system's **best current estimate** of their state, continuously refined as evidence
arrives. The estimate is not the person — it is what the platform believes given
what it has observed. `User(t)` changes with every interaction.

## 4.2 Requirements

The state representation must evolve continuously, tolerate missing observations,
carry uncertainty, stay explainable, remain modular, be cheap to compute, and scale
to millions of users. These pull in different directions; the resolution is
**layering**.

## 4.3 Why static profiles fail

Name, age, education, profession, interests explain almost nothing about
communication, trust, collaboration, or how a relationship will evolve — those
emerge only from *sequences* of observations. So the architecture splits **identity**
(changes slowly) from **state** (changes continuously). In the code, identity lives
in `User.profile`/`User.claims`; state lives in `User.signals` (desirability,
likesReceived, …) and in the per-conversation psychology derivations.

## 4.4 Multi-layer state (each layer evolves independently)

| Layer | Contents | Where it lives today |
|---|---|---|
| **Identity** | languages, education, profession, declared interests | `User.profile`, `User.claims` |
| **Behavioural** | communication rhythm, planning consistency, initiation | derived by `psychology.js` per conversation |
| **Relationship** | shared history, engagement, continuity | `models/Compatibility` (per pair) |
| **Goal** | dating / marriage / friendship / networking | `User.intent` (array) |
| **Growth** | change over time — new interests, improved responsiveness | desirability trajectory in `User.signals`; recomputed psychology |

Separating layers means a career change (Identity) does not disturb communication
estimates (Behavioural), and coaching that improves responsiveness (Behavioural)
does not rewrite declared interests (Identity). Low coupling, easy maintenance.

## 4.5 The state-update philosophy

Every observation asks one question: **does this provide enough evidence to move the
estimate?** Most single events should not. One delayed reply must not redefine
"communication reliability"; repeated delays over months should gradually shift it.
This is exactly why `psychology.attachmentStyle` gates on **variance and rate over
many messages** (e.g. avoidant requires `avgDelayHrs > 4` *and* corroborating
markers, [L101](../../src/services/psychology.js)) rather than reacting to any one
message — and why desirability moves in bounded ELO increments (`+24`/`−12`, weighted
and clamped to `[800, 2500]`, [recommender.js L247](../../src/services/recommender.js))
rather than lurching.

## 4.6 Confidence-aware representation

Every estimated property carries a confidence, and the code distinguishes
"no evidence" from "conflicting evidence" from "high-confidence":

- `attachmentStyle` returns `{ style, confidence }`, `'Unknown'`/`0` under 8
  messages ([L86](../../src/services/psychology.js)).
- Compatibility dimensions default to a **neutral 0.5** when a signal is absent
  rather than guessing a value ([compatibility.js L83](../../src/services/compatibility.js)).
- The trained model ships its own `accuracy` from an 80/20 holdout
  ([trainer.js L95](../../src/services/trainer.js)) — the model's confidence in
  itself.

## 4.7 State versioning & lifetimes

State evolves through versions rather than destructive overwrites, so history is
replayable and algorithms are comparable. Properties also have different lifetimes:
conversation context (very short), recent-activity patterns (short), communication
style (medium), core interests (long), identity (very long). Recognising lifetimes
stops stale data from dominating — the recommender's `activityScore` decays a
profile's recency over ~30 days ([L143](../../src/services/recommender.js)), while
`User.profile` identity fields persist untouched.

## 4.8 Relationships are first-class state

Most platforms compute compatibility once. Sambandh models the **relationship
itself** as evolving state: `models/Compatibility` holds the per-pair score and its
engagement inputs, recomputed as the two people actually chat. This lets the
platform ask "how has this pair changed over the last six months?" — not only "are
they compatible today?" The relationship has a history independent of either
individual, which is a genuine differentiator, not a slogan: the engagement sub-score
(`messageBalance, responseTimeMatch, depthAlignment, humorAlignment, volume`,
[compatibility.js L50](../../src/services/compatibility.js)) is literally a property
of the pair, not of either person.

## 4.9 State consistency across engines

Because psychology, reputation, risk, and the recommender all contribute, the
architecture enforces: observations recorded once; derived estimates versioned;
updates preserve provenance; temporal ordering maintained; observed facts kept
separate from inferred estimates. Today each engine is a **pure function** with no
shared mutable state, which makes consistency trivial — they cannot race because
they don't write to each other's inputs.

## 4.10 Explainable state evolution

Every significant change is traceable: `current estimate → derived feature →
observed events → original activity`. The compatibility component breakdown and the
recommender's `reasons[]` are the user-facing surface of this lineage.

## 4.11 Complexity, failure modes, testing

- **Scale:** state is derived on demand from bounded inputs; per-pair relationship
  state is O(#messages in that pair).
- **Missing data:** neutral defaults everywhere, never a confident guess.
- **Contradiction:** kept, not resolved destructively (Ch 7 covers declared-vs-
  observed conflict).
- **Testing:** each layer's derivation is a separately unit-tested pure function.

> **Next:** Chapter 5 elevates *time* from a column to a computational dimension —
> drift, habit formation, confidence decay, and relationship stages.

# Volume I · Chapter 2 — A Working Definition of Intelligence

## Objective

Turn the philosophy of Chapter 1 into an operational definition an engineer can
build against: intelligence as a **pipeline of seven capabilities**, each owned by
a concrete module. This chapter is the map from abstract verb to real file.

## 2.1 Intelligence as continuous state estimation

Traditional apps treat a user as a static record (name, age, city, profession).
That assumption is fatal for a platform whose whole purpose is understanding how
people and pairs *evolve*. Sambandh instead models each user as a **dynamic state**
`User(t)`: the profile after one conversation differs from the profile after a
hundred. The system never asks "who is this person?" — it asks **"what is the best
current estimate of this person's state, given everything observed so far?"**

This is not a metaphor. Desirability is a live ELO value mutated on every
like/pass (`recommender.js` `recordSwipe`, [L239](../../src/services/recommender.js));
psychology is recomputed from the current message history every time
(`psychology.js` `analyze`, [L151](../../src/services/psychology.js)).

## 2.2 Observable reality vs internal reality

The platform can never directly observe thoughts, intentions, or emotions. It can
observe **profile edits, messages, timings, likes/passes, room posts, payments,
verifications**. Therefore every internal trait is an **inference with
uncertainty**, never a fact. The code refuses to over-claim: attachment style is
`'Unknown'` until there are ≥8 messages, and even then ships a `confidence` in
`[0,1]` (`psychology.js` [L86–L114](../../src/services/psychology.js)).

## 2.3 The seven capabilities, each mapped to a module

| Capability | What it means | Where it lives |
|---|---|---|
| **Observe** | convert reality into evidence | route handlers + sockets record events (`routes-chat.js`, `sockets-chat.js`) |
| **Represent** | store evidence, time-aware | `models/User`, `models/Like`/`Pass`, `models/Compatibility` |
| **Infer** | estimate hidden traits w/ confidence | `psychology.js`, `reputation-engine.js`, `risk-engine.js` |
| **Predict** | forward-looking probabilities | `trainer.js` `predictWith` (P(like)); `recommender.js` `reciprocity` |
| **Decide** | rank, warn, gate | `recommender.js` `score`; `compatibility.js` safety caps |
| **Adapt** | improve from outcomes | `trainer.js` `train` (retrains on consented swipes) |
| **Explain** | justify every output | `reasons[]`, component breakdowns, astro provenance labels |

An architecture is "intelligent" in Sambandh's sense only when **all seven** are
present. A system that observes and predicts but cannot explain or adapt is
incomplete by this definition — and that gap is exactly what separates this design
from a bare LLM wrapper.

## 2.4 Four classes of information (never conflated)

- **Class A — Facts.** User-asserted or verified: languages, profession, interests
  (`User.profile`, `User.claims`). Directly asserted, not necessarily permanent.
- **Class B — Observations.** Events the platform recorded: message sent, like,
  reply delay, room post. *What* happened, not *why*.
- **Class C — Inferences.** Engine estimates *with confidence*: attachment style,
  Big Five, Lakshan grade.
- **Class D — Predictions.** Forward-looking probabilities: P(reciprocation),
  desirability league.

The code keeps these physically separate: raw messages (B) live in the chat store;
`psychology.js` derives C from them without mutating them; `trainer.js` stores only
an anonymised feature vector + binary label — never the message text.

## 2.5 Uncertainty is represented, not hidden

The system never asserts "this user is reliable." It maintains "current evidence
gives *moderate* confidence that this user tends to follow through." As evidence
accumulates, confidence rises **or falls**. This is why `attachmentStyle` returns a
`confidence` fraction (`bestScore / total`) rather than a bare label, and why
compatibility dimensions default to a neutral `0.5` when a signal is missing rather
than guessing (`compatibility.js` [L83–L87](../../src/services/compatibility.js)).

## 2.6 Complexity & scale

Each capability is a **pure function over already-fetched data**, so the expensive
part is I/O, not computation. `computeCompatibility` and `psychology.analyze` are
O(#messages); `recommender.score` is O(1) per candidate after a per-request context
build. This is what makes the "many engines" design cheaper than "one LLM per
request," not more expensive.

## 2.7 Failure modes & testing

- **Too little data →** engines return `'Unknown'`/neutral, never a confident
  wrong answer. Verified by the psychology unit tests (≥8-message gate).
- **A single misleading signal →** dampened by fusion (Ch 6); no dimension exceeds
  its capped weight.
- **Regressions →** 134 unit tests cover the pure functions; each engine is tested
  in isolation.

> **Next:** Chapter 3 defines how Class-B observations become machine-readable,
> time-aware, provenance-tagged features — the Information Representation layer.

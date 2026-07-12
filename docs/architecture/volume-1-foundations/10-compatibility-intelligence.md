# Volume I · Chapter 10 — Compatibility Intelligence

## Objective

Compare two evolving state models into a **multidimensional, context-specific,
uncertainty-aware** compatibility — not a single static percentage. This chapter
grounds directly in [`src/services/compatibility.js`](../../src/services/compatibility.js),
the shipping implementation of the §4.2 formula.

## 10.1 Compatibility is not similarity

Two identical people are not necessarily compatible; two very different people are
not necessarily incompatible. The attachment matrix proves the point in code: a
Secure pairing with *anything* scores 1.0, Anxious+Avoidant scores 0.2, Avoidant+
Avoidant (similar!) only 0.6 (`attachmentCompat`,
[L11](../../src/services/compatibility.js)). Compatibility is the **probability two
evolving systems interact successfully in a given context** — the three pillars are
probability, context, evolution.

## 10.2 It exists between states, and evolves

Compatibility is not `A vs B`; it is `State A(t)` × `State B(t)`. Because both states
evolve (Ch 4), compatibility is **recomputed as new observations arrive** — the
engagement inputs update as the pair actually chats, so the score is a live quantity,
not a one-time verdict.

## 10.3 Multidimensional by construction

Compatibility is a **weighted blend of independent dimensions**, each with its own
raw score and contribution ([`computeCompatibility` L62](../../src/services/compatibility.js)):

```
Vedic .20 · Yoni .10 · Gana .08 · Attachment .15 · Big Five .10 ·
Love language .07 · Engagement .20 · Karma/Lakshan .10   (+ up to .05 intent/language bonus)
```

capped at 99. Each dimension is a separately defensible number, returned in the
`components[]` breakdown — this is the "compatibility matrix," not a scalar.

## 10.4 Context / purpose changes the weighting

The same pair can be strong for one purpose and weak for another. A **relationship
lens** (romance / friendship / business) reweights the astrological factors for the
use-case (`relationshipCompat` in the astro engine, wired through
[`src/services/intelligence.js`](../../src/services/intelligence.js) and
[`src/routes-compat.js`](../../src/routes-compat.js)), and the `sameIntent` bonus
([L97](../../src/services/compatibility.js)) rewards aligned purpose. Every
computation is task-specific.

## 10.5 Evidence, confidence, and graceful degradation

Every dimension is evidence-based, and **missing evidence yields a neutral 0.5**, not
a guess — Vedic without a birth time drops from 20%→10% weight, moving the 10% to
engagement ([L75](../../src/services/compatibility.js)); attachment falls back to
0.5 when either side is `'Unknown'` ([L83](../../src/services/compatibility.js)).
Low-confidence dimensions thus dilute toward neutral rather than fabricate
certainty.

## 10.6 Safety caps and honest warnings

Compatibility is not just an average — it has hard safety behaviour a pure
similarity score could never express:

- A **critical safety flag** forces the score to **0** with an explicit warning.
- A **D/F Lakshan grade** caps the score at **40** until it improves.
- **Dosha** warnings (from Guna Milan) and low-Yoni warnings are always surfaced.

(All in [L104–L114](../../src/services/compatibility.js).) The engine refuses to
recommend a high score over a serious safety signal — a deliberate,
due-diligence-friendly choice.

## 10.7 Compatibility ≠ recommendation (two modules)

Producing a compatibility number does not produce a recommendation. Recommendation
(Ch 11, `recommender.js`) additionally weighs intent, reciprocity, diversity,
fairness, exploration, and privacy. Keeping estimation and decision separate makes
both independently testable — `compatibility.js` never decides *whether* to show
someone; it only scores the pair.

## 10.8 Growth compatibility (forward-looking) — *Near-term*

Beyond "compatible today?", the design asks "how might compatibility evolve if both
keep engaging?" This forward-looking, probabilistic component is **Near-term** —
buildable from the engagement trend already stored per pair — and is labelled as
such, not claimed live.

## 10.9 Fairness, privacy, explainability

Fairness evaluation, calibration, and bias monitoring are required as the model
evolves; computation uses only consented data and the minimum necessary. Every score
is explainable via its `components[]` breakdown and `warnings[]`, and the engine
avoids unsupported claims ("destined to be together") in favour of concrete reasons.

## 10.10 Complexity, failure modes, testing

- **Complexity:** O(1) fusion over a fixed dimension set once inputs exist.
- **Failure modes:** missing dimension → neutral; safety flag → hard cap; no birth
  time → reweight, not crash.
- **Testing:** `attachmentCompat`, `bigFiveCompat`, `loveLanguageCompat`,
  `engagementScore`, and the full `computeCompatibility` (including cap behaviour)
  are unit-tested.

> **Next:** Chapter 11 — choosing an action from uncertain estimates: Decision
> Intelligence.

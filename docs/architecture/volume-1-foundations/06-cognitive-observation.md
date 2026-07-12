# Volume I · Chapter 6 — Cognitive Observation & Multi-Sensor Fusion

## Objective

Ensure no single signal can mislead the state estimate. Human judgement fuses many
channels — words, timing, history, context — and so must Sambandh. This chapter
defines the platform's **virtual sensors** and the **weighted fusion** that combines
them.

## 6.1 Observation is evidence, not truth

Two people both type "I'm perfectly fine." A single-channel system sees one
sentence. A fusing system notices one is responsive and warm across the thread and
the other has gone cold and terse. Language alone never represents reality;
**reality is distributed across channels.** Observation is the conversion of reality
into computational evidence — it answers "what happened," never "what is true."

## 6.2 The observation hierarchy

- **Explicit** — declared by the user (`User.profile`, `User.claims`).
- **Behavioural** — measured from interaction (`psychology.computeMetrics`: delays,
  variance, initiations, vocabulary).
- **Relational** — exists *between* users, not inside one (`models/Compatibility`
  engagement sub-scores).
- **Environmental** — context around an observation (time of day, weekday/holiday,
  timezone).
- **Historical** — everything observed before today (desirability trajectory,
  prior conversations).

## 6.3 The virtual sensors (already implemented)

Sambandh does not have one input; it has many sensors, each producing observations,
none complete on its own. The compatibility engine fuses **eight** of them and the
recommender **seven** more:

**Compatibility sensors** (`compatibility.js` `computeCompatibility`,
[L62](../../src/services/compatibility.js)): Vedic guna, Yoni, Gana, Attachment,
Big Five, Love language, Engagement, Karma/Lakshan.

**Recommender sensors** (`recommender.js` `featurize`,
[L45](../../src/services/recommender.js)): intent overlap, language overlap,
verified profession, age closeness, same city, photo count, recent activity.

Each is `∈ [0,1]`, computed independently, then combined. No sensor decides alone.

## 6.4 Multi-sensor fusion is *weighted*

One sensor can lie; five rarely agree wrongly. Fusion is therefore weighted, and
the weights are explicit, not hidden inside a black box:

- Compatibility weights (`w` in `computeCompatibility`,
  [L75](../../src/services/compatibility.js)): `vedic .20, yoni .10, gana .08,
  attachment .15, bigfive .10, love .07, engagement .20, karma .10`.
- Recommender weights (`W`, [L202](../../src/services/recommender.js)): `compat .24,
  taste .20, reciprocity .24, engagement .12, activity .08, collab .08,
  explore .04`, summing to 1.0.

Because the weights are named constants, any score can be decomposed and defended —
the antithesis of an opaque model.

## 6.5 Handling disagreement between sensors

When a self-report contradicts observed behaviour ("I'm very disciplined" vs erratic
late-night activity), the system does **not** conclude dishonesty. It records that
the declared trait and the observed behaviour are currently inconsistent and keeps
gathering evidence — there may be causes it cannot see. This is precisely how
`karma-book.js` treats claims vs contradictions (Ch 7): inconsistency lowers a
confidence/grade, it does not brand the person a liar.

## 6.6 Observation quality & confidence (distinct things)

Every observation gets a **quality** read (completeness, accuracy, consistency,
recency, frequency, reliability, context) and separately a **confidence**. A
self-declared habit is a real observation at *medium* confidence; thirty logged
repetitions of it are *high* confidence. The code encodes this by weighting
verified/observed signals above declared ones — e.g. `trust` comes from a computed
`verification.trustScore`, and `idVerified`/`hasPhoto` are hard observed booleans in
`trainer.featuresFor` ([L34–L39](../../src/services/trainer.js)).

## 6.7 Two rules that prevent bad inferences

- **Missing ≠ negative.** Never having discussed music does not imply disliking
  music — it means insufficient evidence. The engines encode this by defaulting
  absent signals to a **neutral 0.5**, never to 0
  (`compatibility.js` [L83](../../src/services/compatibility.js);
  `engagementScore` returns `0.55` when unknown, [L50](../../src/services/compatibility.js)).
- **Contradiction is not error.** High past activity + low recent activity is not a
  bug; it may be drift or a life change. Both histories are preserved for Ch 5's
  temporal reasoning to interpret.

## 6.8 The observation graph & cognitive layer

Rather than isolated events, observations connect: user → conversation → match →
room → outcome. After fusion the platform holds a **cognitive observation layer** of
structured evidence (communication features, engagement signals, confidences,
temporal summaries) rather than raw chat — exactly the compact records
`computeMetrics` and `featurize` emit, which is what every downstream engine reads.

## 6.9 Explainability, complexity, testing

- **Explainability:** every inference answers what was observed, why the estimate,
  and how confident — surfaced as `reasons[]` and component breakdowns.
- **Complexity:** fusion is a weighted sum over a fixed, small sensor set → O(1) per
  pair after features exist.
- **Failure modes:** a single corrupt sensor is bounded by its weight; a missing
  sensor degrades to neutral; the whole score never swings on one channel.
- **Testing:** each sensor function (`attachmentCompat`, `bigFiveCompat`,
  `engagementScore`, `featurize`) is unit-tested in isolation.

> **Next:** Chapter 7 — turning fused observations into structured, provenance-
> tagged *knowledge*, including how declared and observed facts are reconciled.

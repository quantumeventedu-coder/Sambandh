# Volume I · Chapter 9 — Behavioral Intelligence

## Objective

The first true intelligence layer: turn many observations into **evolving,
uncertainty-aware behavioural estimates** that coaching, compatibility, and
recommendation consume — without collapsing a person into a fixed label. Goal is
*not* to infer someone's inner mental state; it is to model recurring patterns from
consented observation.

## 9.1 Behaviour is a statistical organisation of many observations

One 3-minute reply tells us almost nothing; the same pattern across hundreds of
messages starts to mean something. Behaviour is therefore **never** extracted from
one event — always estimated from patterns. `psychology.js` encodes this literally:
`attachmentStyle` returns `'Unknown'` below **8 messages**
([L87](../../src/services/psychology.js)) and every trait is derived from
*rates and distributions* (`reassurancePer100`, `empathyPer100`, `iToWeRatio`), not
single messages.

## 9.2 Behaviour is dynamic, not categorical

Traditional personality systems assign fixed labels (extrovert / leader). Sambandh
does not: OCEAN dimensions are **recomputed each time** from the current thread and
expressed as bands with numeric scores that move as evidence changes
(`bigFive`, [L117](../../src/services/psychology.js) → `{ level, score }` per
dimension). "Conscientiousness" is `high` when delay variance is low **and** there
are no double-texts — flip those and the estimate flips. Nothing is frozen.

## 9.3 The behaviour vector (multidimensional, independent axes)

Rather than one personality score, the platform maintains a vector whose axes evolve
independently. Today's shipping axes come from `psychology.analyze`
([L151](../../src/services/psychology.js)):

- **Attachment** — Secure / Anxious / Avoidant / Disorganised (+confidence).
- **Big Five / OCEAN** — five bands with scores.
- **Love language** — ranked five-way.
- **Communication metrics** — delay, variance, initiations, question ratio,
  vocabulary richness, emotional score.

Improvement on one axis does not imply improvement on another — they are computed
from different signals.

## 9.4 Confidence, stability, and different update rates

Every estimate ships a confidence (`attachmentStyle.confidence =
bestScore / total`), and different axes are allowed to change at different speeds:
activity level changes fast, communication rhythm moderately, core interests slowly,
values very slowly. The architecture honours this by re-deriving fast axes per
conversation while identity axes (Ch 4) persist untouched.

## 9.5 Consistency matters as much as the average

Two people can share an average reply time while one is metronome-steady and the
other swings from instant to three days. `computeMetrics` captures exactly this:
alongside `avgDelayHrs` it computes `delayVarianceHrs`
([L63](../../src/services/psychology.js)) — and variance, not the mean, is what
separates a Secure signature (low variance) from a Disorganised one (high variance +
double-texting). Behaviour is central tendency **and** variability.

## 9.6 Context and drift

Delayed replies during exams or travel need not mean reduced interest — context-
aware interpretation avoids simplistic conclusions (Ch 5). The engine detects
*sustained* trends versus temporary fluctuation by reading rates over the thread
rather than reacting to the latest message.

## 9.7 Relationship behaviours live in the pair, not the person

Conversation balance, mutual initiative, supportiveness, and continuity are
properties of the **relationship**, and belong to `models/Compatibility`'s
engagement sub-scores (`messageBalance`, `responseTimeMatch`, `depthAlignment`,
`humorAlignment`, `volume`; [compatibility.js L50](../../src/services/compatibility.js))
— not to either individual's behaviour vector.

## 9.8 Modules, quality control, and role

Behavioural intelligence is a set of specialised modules (communication,
reliability, engagement, relationship) sharing common observation/memory layers, not
one monolith. Before any estimate is used it must clear: sufficient evidence,
acceptable confidence, temporal relevance, consistency, explainability — otherwise
it stays low-confidence or is omitted (the `'Unknown'` path). Crucially, behavioural
estimates are **inputs**, never verdicts: they feed compatibility (Ch 10) and
decisions (Ch 11) but are never treated as absolute truth about a person.

## 9.9 Complexity, failure modes, testing

- **Complexity:** O(#messages) per participant; pure function, no I/O inside.
- **Failure modes:** thin data → `'Unknown'`; a single outlier message → absorbed by
  rate/variance metrics; sarcasm/idiom → acknowledged limitation of lexical rules,
  which is why confidence is reported and the LLM layer can be consulted for nuance.
- **Testing:** synthetic message sequences assert the correct attachment/OCEAN/
  love-language outputs across edge cases (fast vs slow repliers, double-texters).

> **Next:** Chapter 10 — comparing two evolving behaviour models into a
> multidimensional, context-specific, uncertainty-aware compatibility.

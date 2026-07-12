# Volume I · Chapter 5 — Temporal Intelligence

## Objective

Make **time a first-class computational dimension**, not a timestamp column. The
platform's job is not to answer "who is this person?" but "how is this person
changing?" — which requires modelling trajectories, rhythms, drift, and
relationship stages.

## 5.1 Time is not metadata

In most systems a timestamp is audit trivia. Here, every event exists
simultaneously in identity space, relationship space, behavioural space, **and
temporal space** — and the temporal coordinate changes the meaning. A 15-minute
reply once in six months is noise; the same delay repeated for six months is a
stable pattern. The AI therefore never evaluates isolated observations; it
evaluates **temporal distributions** of them. Behaviour is a function of time, not
a point.

This is already load-bearing in the code: `psychology.computeMetrics` computes not
just `avgDelayHrs` but `delayVarianceHrs` and `doubleTextRuns`
([L59–L73](../../src/services/psychology.js)) — i.e. it characterises the *shape of
the timing distribution*, which is what separates "Secure" (low variance) from
"Disorganised (Fearful)" (high variance + double-texting) at
[L92](../../src/services/psychology.js).

## 5.2 Multiple temporal scales

Human behaviour runs on several horizons at once, and different engines read
different scales:

| Scale | Duration | Captures | Consumed by |
|---|---|---|---|
| Immediate | seconds–minutes | conversation flow, current engagement | chat/socket layer |
| Short-term | hours–days | recent activity, daily rhythm | `recommender.activityScore` (24h `activeRecently`) |
| Medium-term | weeks–months | habit formation, communication stability | `psychology` metrics over the thread |
| Long-term | months–years | value/career evolution, relationship maturity | desirability trajectory; relationship history |

## 5.3 Temporal memory hierarchy

Not every observation deserves permanent retention. The design tiers memory as
ephemeral → working → episodic → semantic → historical archive (fully specified in
Volume IV / the pasted Ch 8 material). The trainer already embodies a two-tier
version of this: a **60-second `modelCache`** for hot reads
([trainer.js L109](../../src/services/trainer.js)) over a durable model persisted in
`AppConfig.learnedModel`.

## 5.4 Behavioural drift

Behaviour rarely changes instantly; small deviations accumulate. The AI should
detect *gradual* change by comparing a recent window against a long-term baseline,
not react to isolated fluctuations. The bounded ELO update
([recommender.js L247](../../src/services/recommender.js)) is the drift-friendly
primitive: desirability tracks sustained changes in how others respond while
resisting single-event spikes because each step is small and clamped.

## 5.5 Habit formation

The system distinguishes one-time actions, repeated actions, emerging habits,
stable habits, and declining habits. `initiations` and `doubleTextRuns` counts in
`psychology.computeMetrics` are the raw material; consolidating them into
"stable habit" vs "declining habit" over rolling windows is **Near-term** work on
the event log (Ch 3.4), and is labelled as such — it is not claimed today.

## 5.6 Relationship evolution

Relationships move through stages — discovery, early interaction, trust building,
shared experience, stable collaboration, reduced interaction, renewed engagement —
without fixed labels. The `Compatibility` model recomputing engagement as a pair
chats (Ch 4.8) is the substrate for stage detection; the engagement sub-scores
(`messageBalance`, `responseTimeMatch`) already move as the relationship does.

## 5.7 Temporal confidence (decay)

Confidence itself is temporal. With no new observations for a long time, confidence
in an estimate should **decrease**; consistent recent observations should
strengthen it. This is why estimates are re-derived from the *current* message
history each time rather than cached indefinitely — a stale conversation naturally
yields a stale, lower-weight read, and a revived one refreshes it.

## 5.8 Seasonality, context, and life transitions

Behaviour varies with exams, holidays, deadlines, festivals, timezones. The system
must not read every temporary dip as a permanent personality change; where context
is available it is considered before updating long-term estimates. Genuine life
transitions (graduation, marriage, relocation, founding a company) justify *larger*
adjustments than ordinary days — the update magnitude should scale with evidence of
a true regime change, not with any single event.

## 5.9 Time-aware recommendations

Recommendations should read temporal state: surface a re-connect after a lull,
suggest coaching when consistency declines, defer low-confidence recommendations
until enough recent data exists. The recommender's freshness boost for new profiles
and recency decay for stale ones ([recommender.js L139–L146](../../src/services/recommender.js))
are the shipping form of this; richer time-aware nudges are Near-term.

## 5.10 Scheduled recomputation

Time-based maintenance runs in [`src/crons.js`](../../src/crons.js): periodic jobs
are the natural home for consolidation, confidence decay, and model retraining
(`trainer.train`) so temporal updates happen off the request path.

## 5.11 Principles, failure modes, testing

- **Principles:** time is part of the model; behaviour is modelled across scales;
  history is immutable; drift is detected against baselines; temporary ≠ permanent;
  confidence evolves; recommendations adapt to temporal context.
- **Failure modes:** clock skew (use observation time, not just creation time);
  bursty activity (variance-based metrics resist single bursts); long silence
  (confidence decays rather than freezing a stale label).
- **Testing:** timing-derived metrics are unit-tested with synthetic message
  sequences that vary delay and variance to assert the correct attachment/OCEAN
  bands.

> **Next:** Chapter 6 — fusing many observation channels so no single signal can
> mislead the state estimate.

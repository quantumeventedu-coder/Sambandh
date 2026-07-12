# Volume I · Chapter 3 — Information Representation

## Objective

Define how raw platform activity becomes **structured, time-aware, provenance-tagged
evidence** that the engines can consume — the bridge between the observable world
and everything that reasons about it. Get this layer wrong and every downstream
model is poisoned; get it right and every engine becomes simpler.

## 3.1 Requirements

The representation layer must: preserve chronological order; preserve provenance;
distinguish observations from inferences; carry uncertainty; support incremental
updates; retrieve efficiently; support explainability; and scale to millions of
users. These requirements shape every schema decision below.

## 3.2 Three worlds of information

- **World 1 — Physical reality.** Two people talk; someone accepts a match. The AI
  does not control this world; it only observes it.
- **World 2 — Digital observation.** Physical events become immutable records:
  `MessageSent`, `Liked`, `Passed`, `ProfileUpdated`, `RoomPosted`, `MatchAccepted`.
  These describe *what* happened, not *why*.
- **World 3 — Computational understanding.** Engines process observations into
  evolving estimates. **Not facts — estimates.**

The code already keeps World 2 and World 3 apart: chat messages (World 2) are never
mutated by `psychology.js`, which derives World 3 estimates from a read-only copy
(`analyze(messages)`, [psychology.js L151](../../src/services/psychology.js)).

## 3.3 Event ontology (the smallest unit of intelligence)

An event is not a log line; it is the atom the whole system is built from. Each
event carries **identity** (who), **type** (what), **timestamp** (when — creation
vs observation vs processing time can differ), **source** (web/app/API/import), and
an extensible **context** blob. The ontology must grow without breaking historical
compatibility, so context is a schemaless `payload`.

## 3.4 Immutable event store — *the next real architectural step*

Today most signals are recomputed from current rows (the `Like`/`Pass` collections,
the message store). The designed-and-scoped next step — already written up in
[`../INTELLIGENCE-ARCHITECTURE.md` §8](../INTELLIGENCE-ARCHITECTURE.md) — is an
append-only event log on Postgres:

```
events(id, userId, type, payload jsonb, createdAt)
```

with types `UserJoined, ProfileUpdated, Liked, Passed, MessageSent, ReplyDelayed,
RoomPosted, MatchAccepted, CoachingShown`. Corrections are **new events**, never
edits — this yields a complete, replayable timeline. **Status: Near-term.**
Concretely buildable on the current stack (the JSONB ODM in `src/db/odm.js` already
stores exactly this shape) in days, not years. This chapter is the specification
for that table; nothing here claims it is live yet.

## 3.5 State reconstruction & derived projections

The current profile is a **derived projection**, not the source of truth. Feature
extractors read the log (or, today, the rows) and produce summaries kept for speed.
`psychology.computeMetrics` ([L25](../../src/services/psychology.js)) is exactly
this pattern: it consumes a time-sorted message sequence and emits a compact
feature record (`avgDelayHrs`, `delayVarianceHrs`, `doubleTextRuns`, `iToWeRatio`,
love-language `signals`, …) that the higher layers use instead of re-reading raw
chat. When a better extractor ships, the raw history can be replayed to regenerate
improved features — the whole point of keeping observations immutable.

## 3.6 Feature generation

Raw events → structured features. Real examples in the code:

- **Communication features** — `computeMetrics` derives response intervals,
  variance, initiation counts, vocabulary richness, question ratio.
- **Pair features** — `trainer.featuresFor` ([L26](../../src/services/trainer.js))
  builds the 8-dim vector `[ageCloseness, distance, sharedIntent, sharedLanguage,
  trust, desirGap, hasPhoto, idVerified]` used *identically* at capture and
  prediction time so the two never drift apart. This "one feature function, two
  call sites" discipline is the single most important correctness rule in ML
  plumbing, and it is enforced here by construction.

## 3.7 Temporal windows

Behaviour is computed over windows, not over all history equally: last 24h, 7d,
30d, 6m, lifetime. The recommender already uses recency windows —
`activeRecently(u, 24h)` and a 1–30 day recency decay in `activityScore`
([recommender.js L139](../../src/services/recommender.js)). Chapter 5 makes time a
first-class dimension across all engines.

## 3.8 Observation vs interpretation (kept separate everywhere)

"User sent five messages" is observed. "User is highly engaged" is inferred. The
representation layer stores the first and lets engines derive the second, tagging
the derivation with confidence. Conflating them is the classic mistake this layer
exists to prevent.

## 3.9 Information lineage

Every estimate must be traceable back to the events that produced it:

```
Compatibility score → component breakdown → engine features → observed events
```

`compatibility.computeCompatibility` returns a `components[]` array — each with
`name, weight, raw, contribution` ([L90](../../src/services/compatibility.js)) — so
any score can be decomposed on demand. That array *is* the lineage, one hop from
the raw signals.

## 3.10 Complexity & scale

Feature extraction is O(#events for that user); summaries are O(1) to read. The
event log is append-only (cheap writes, no locks) and partitions cleanly by
`userId`. Anonymised training rows are capped (the trainer reads the most recent
20k, [L78](../../src/services/trainer.js)) so retraining cost is bounded regardless
of platform size.

## 3.11 Failure modes & testing

- **Malformed/duplicate events →** normalisation drops rows whose feature length
  doesn't match the contract (`trainer.train` filters
  `features.length === FEATURE_NAMES.length`, [L83](../../src/services/trainer.js)).
- **Extractor bug →** because observations are immutable, a fixed extractor can be
  replayed; no data is lost.
- **Schema drift →** the feature-name contract is shared between capture and
  prediction, so a mismatch fails loudly rather than silently mis-scoring.

> **Next:** Chapter 4 — how these features become an evolving, layered, confidence-
> aware *computational state* per person and per relationship.

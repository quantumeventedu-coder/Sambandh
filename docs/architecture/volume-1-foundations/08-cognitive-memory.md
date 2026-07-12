# Volume I · Chapter 8 — Cognitive Memory Architecture

## Objective

Design memory as an active system that decides what to remember, promote,
consolidate, and forget — not a single database. This is a software architecture
*inspired by* cognitive science, not a claim to reproduce human memory.

## 8.1 Memory ≠ database

A database stores; memory *decides* — what persists, what decays, what influences
the current decision. Without memory there is no continuity; without continuity no
long-term intelligence. So the platform tiers memory by importance, recency, and
relevance instead of keeping every interaction equally active forever.

## 8.2 The memory hierarchy

| Tier | Purpose | Sambandh analogue |
|---|---|---|
| **Sensory** | buffer newly observed events | inbound message/like/pass before processing |
| **Working** | support the current task | per-request recommender context (`buildContext`, [L188](../../src/services/recommender.js)) |
| **Episodic** | significant experiences (first chat, a match) | notable events on the (future) event log |
| **Semantic** | generalised understanding | psychology/OCEAN summaries; taste weights |
| **Relationship** | belongs to a pair, not a person | `models/Compatibility` (the differentiator) |
| **Organisational** | shared across a community | `models/Room` + membership |
| **Collective** | user-independent platform knowledge | the trained model in `AppConfig.learnedModel` |

## 8.3 Promotion — from temporary to durable

Observations start temporary. The system asks: disappear, linger, or persist?
Promotion depends on repetition, importance, explicit user actions (saving,
matching), task relevance, and long-term usefulness. Not everything becomes
permanent. The trainer embodies this: an individual swipe is a transient event;
only its **anonymised feature vector + label** is promoted into durable training
memory, and only with consent (`captureSwipe`, [L44](../../src/services/trainer.js)).

## 8.4 Decay, consolidation, and the cache tier

Recent, relevant memory should influence current reasoning more than old memory,
which stays retrievable but dormant. Consolidation replaces many raw observations
with one higher-level memory ("entrepreneurship is a recurring interest") while
keeping the originals for audit. Sambandh already runs a **two-tier durability**
pattern: a 60-second `modelCache` hot tier over the durably persisted model
(`getModel`, [trainer.js L109](../../src/services/trainer.js)); periodic
consolidation/retraining is the natural job for [`src/crons.js`](../../src/crons.js).

## 8.5 Relationship memory evolves on its own

A pair accumulates its own memories — shared milestones, communication patterns,
engagement trend — evolving independently of either individual's profile. This is
`models/Compatibility` being **recomputed as the two chat** (Ch 4.8), which is why
the platform can answer "how has this relationship changed?" and not merely "are
they compatible today?"

## 8.6 Forgetting is a first-class capability

The platform supports user-requested deletion, retention policies, regulatory
erasure, and cache expiry. Sambandh ships this: **data export (JSON) and delete
(erased ≤30 days)** are in-app user rights (see §9 of
[`../INTELLIGENCE-ARCHITECTURE.md`](../INTELLIGENCE-ARCHITECTURE.md)), and training
memory is anonymised by construction so "forgetting a user" cannot orphan
identifiable training rows — there are none.

## 8.7 Synchronisation & memory quality

Many engines read memory at once (recommender, compatibility, coaching). Consistency
rules: observations recorded once; derived memories versioned; updates preserve
provenance; conflicts resolved deterministically. Because today's engines are **pure
functions with no shared mutable state**, they cannot race. Every memory item also
carries metadata — confidence, source, last update, supporting evidence, temporal
validity — so downstream reasoning knows how much to trust it.

## 8.8 Explainability, complexity, testing

- **Explainability:** any recommendation must answer which memories contributed,
  how recent, and how confident.
- **Complexity:** hot reads are O(1) via cache; durable stores indexed by `userId`
  or pair; training memory is capped (most-recent 20k rows).
- **Failure modes:** cache miss → durable read; durable miss → neutral defaults;
  deletion request → erase + retrain excludes the (already anonymised) data.
- **Testing:** `getModel` cache behaviour and consent-gated `captureSwipe` are unit-
  tested.

> **Next:** Chapter 9 — turning memory into evolving, uncertainty-aware *behavioural*
> models (the first true intelligence layer).

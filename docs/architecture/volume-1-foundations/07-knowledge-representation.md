# Volume I · Chapter 7 — Human Knowledge Representation

## Objective

Transform millions of observations into **structured, inspectable knowledge** —
entities, relationships, and confidence-tagged facts — so reasoning modules don't
re-scan raw history for every query, and so every conclusion stays explainable.

## 7.1 Information → knowledge → reasoning (kept distinct)

- **Information:** "message sent," "match accepted" — observations.
- **Knowledge:** "usually communicates in the evening," "consistently technical" —
  summarised, repeated evidence.
- **Reasoning:** "this collaboration is likely to work because planning styles align
  and engagement is sustained" — combining knowledge elements.
- **Wisdom:** explicitly **out of scope.** The platform never claims complete
  understanding of a person.

## 7.2 Knowledge must be structured, not vague

"User likes machine learning" is useless. Knowledge is stored as structured items:
`{ topic, level, evidenceSource, lastUpdated, confidence }`. Structure buys
explainability, retrieval, and maintenance. Sambandh's claims are already shaped
this way: `User.claims.profession` carries `{ value, verified, evidence }`, not a
bare string — a verified fact and its provenance travel together.

## 7.3 Entities and relationships → a knowledge graph

Entities (users, communities, skills, interests, goals, locations) each have an
identifier, type, attributes, lifecycle, relationships, and provenance. Knowledge
becomes useful only when entities are **connected** — `User —interestedIn→ AI`,
`User —collaboratedWith→ Team`. In Sambandh the **relationship edge is a first-class
node**: `models/Compatibility` is precisely the `User —relationshipNode→ User` edge,
carrying shared history and engagement statistics independent of either endpoint.

## 7.4 Semantic layer

The platform should understand *concepts*, not exact strings: "AI," "machine
learning," "deep learning," "neural networks" are related. A semantic layer records
these relations so retrieval generalises beyond wording. **Status:** the intent/
language/interest overlaps computed today (`jaccard` in
[recommender.js L32](../../src/services/recommender.js)) are the string-level
version; a curated concept graph + embedding-based similarity is **Near-term** and
labelled as such — it is not claimed live.

## 7.5 Knowledge carries confidence and provenance

Every knowledge item answers "how sure?" and "where from?" (user-provided, observed,
explicit feedback, authorised import, AI-derived). A conclusion backed by years of
consistent observation outranks one inferred from a handful of recent events. This
is the same confidence discipline as psychology's `confidence` field, applied to
knowledge items.

## 7.6 Knowledge evolves; conflicts are preserved, not deleted

Knowledge has **temporal validity** (`startDate`, optional `endDate`, current
status), so a career change makes old knowledge *historical*, not wrong. When a
declared interest conflicts with recent behaviour ("interested in startups" vs no
startup activity for two years), the system keeps **both** the declared interest and
the behavioural evidence and lets the task-specific reasoner weight them. This is
exactly the mechanism in [`src/karma-book.js`](../../src/karma-book.js): claims are
checked against contradictions to produce an honesty grade — the contradiction is
recorded and weighed, never used to silently erase the claim.

## 7.7 Derived vs observed knowledge

Derived knowledge (estimated planning preference, collaboration style) must stay
**linked to its supporting evidence** — the lineage rule from Ch 3.9. The
compatibility `components[]` breakdown is the canonical example: each derived
contribution points back at the raw signal that produced it.

## 7.8 Retrieval & permissions

Knowledge must be retrievable both by structured query ("users interested in
computational biology") and, in future, semantic similarity — always subject to the
user's visibility settings. Retrieval that ignores consent is a privacy defect, not
a feature; §9 (privacy) governs it.

## 7.9 Explainability, complexity, testing

- **Explainability:** `knowledge → evidence → observations → original events` must
  be walkable for any item.
- **Complexity:** structured items are indexed by `userId` + type; graph edges
  (Compatibility docs) are keyed by the unordered pair.
- **Failure modes:** conflicting knowledge is retained (never destructively merged);
  stale knowledge is aged out by temporal validity, not deletion.
- **Testing:** `karma-book` claim/contradiction resolution is unit-tested against
  crafted claim sets.

> **Next:** Chapter 8 — which knowledge is kept active, promoted, consolidated, or
> forgotten: the memory architecture.

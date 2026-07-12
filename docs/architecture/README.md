# Sambandh Intelligence Platform (SIP) — Architecture Manual

**Classification:** Internal AI / Engineering Architecture
**Status:** living document — expanded chapter by chapter
**Rule of this manual:** every chapter that describes a *shipping* capability must
point at a real module in this repo. Every chapter that describes a *future*
capability must say so plainly and label it **Near-term** (buildable on the current
stack) or **Research** (multi-year, funded-team scope). Nothing here claims a
capability Sambandh does not have. This is what lets the document survive a
technical due-diligence read instead of collapsing under it.

> Companion one-page summary: [`../INTELLIGENCE-ARCHITECTURE.md`](../INTELLIGENCE-ARCHITECTURE.md).
> This manual is the long form of that summary.

---

## The core architectural bet

Sambandh is **not one large language model**. It is a set of **independent,
cooperating engines**, most of them **deterministic** — no hallucination,
explainable, cheap to run — with an LLM (Anthropic) used only as an *optional
language layer* over answers the engines have already computed. This is a
deliberate choice, and it is already true in the code today:

| Capability | Real module | Deterministic? |
|---|---|---|
| Astrology (grahas, dashas, yogas, doshas, panchang) | [`src/services/astro-engine.js`](../../src/services/astro-engine.js) | yes |
| Psychology (attachment · Big Five · love language) | [`src/services/psychology.js`](../../src/services/psychology.js) | yes |
| Compatibility (the §4.2 weighted formula) | [`src/services/compatibility.js`](../../src/services/compatibility.js) | yes |
| Recommender (taste · reciprocity · CF · exploration) | [`src/services/recommender.js`](../../src/services/recommender.js) | yes |
| Self-trained match model (logistic regression) | [`src/services/trainer.js`](../../src/services/trainer.js) | yes (own model) |
| Red/positive flags | [`src/services/flag-engine.js`](../../src/services/flag-engine.js) | yes |
| Reputation | [`src/reputation-engine.js`](../../src/reputation-engine.js) | yes |
| Risk / fraud | [`src/services/risk-engine.js`](../../src/services/risk-engine.js) | yes |
| Lakshan (honesty) book | [`src/karma-book.js`](../../src/karma-book.js) | rule-based (LLM optional) |
| Language layer (chart Q&A, interpretation) | [`src/services/llm.js`](../../src/services/llm.js) | LLM + rule fallback |

---

## Volume map

Each volume is a directory; each chapter is one file. A volume's honesty status
is stated up front so no reader mistakes aspiration for shipping code.

### Volume I — Foundations of Intelligence  *(conceptual; maps onto shipping engines)*
The design philosophy and the data model that everything else rests on. Every
principle here is enforced somewhere in the code, and each chapter says where.

- [Ch 1 — Philosophy of Intelligence](volume-1-foundations/01-philosophy-of-intelligence.md)
- [Ch 2 — A Working Definition of Intelligence](volume-1-foundations/02-definition-of-intelligence.md)
- [Ch 3 — Information Representation](volume-1-foundations/03-information-representation.md)
- [Ch 4 — Computational State](volume-1-foundations/04-computational-state.md)
- [Ch 5 — Temporal Intelligence](volume-1-foundations/05-temporal-intelligence.md)
- [Ch 6 — Cognitive Observation & Multi-Sensor Fusion](volume-1-foundations/06-cognitive-observation.md)
- [Ch 7 — Human Knowledge Representation](volume-1-foundations/07-knowledge-representation.md)
- [Ch 8 — Cognitive Memory Architecture](volume-1-foundations/08-cognitive-memory.md)
- [Ch 9 — Behavioral Intelligence](volume-1-foundations/09-behavioral-intelligence.md)
- [Ch 10 — Compatibility Intelligence](volume-1-foundations/10-compatibility-intelligence.md)
- [Ch 11 — Decision Intelligence](volume-1-foundations/11-decision-intelligence.md)
- [Ch 12 — Learning and Adaptation](volume-1-foundations/12-learning-and-adaptation.md)

### Volume II — Model & Learning Engine  *(honest reframe — see the note below)*
**This is deliberately *not* "build a foundation model from scratch."** Sambandh's
learning core is a **self-trained logistic ranking model** ([`trainer.js`](../../src/services/trainer.js))
plus per-viewer taste learning ([`recommender.js`](../../src/services/recommender.js)),
with Anthropic as an external language layer. A from-scratch tensor/autograd
engine, distributed GPU training, and a custom LLM are **Research scope, not built,
and will not be faked** in this manual — training a foundation model is a
multi-million-dollar, multi-team effort and pretending otherwise is exactly what a
merciless technical reviewer would expose. Volume II documents the *real* learning
loop and draws that line explicitly.

- [Ch 1 — The learning loop that actually ships](volume-2-model-and-learning/01-the-real-learning-loop.md)
- Ch 2 — Feature engineering & the feature contract *(planned; see Vol I Ch 12 §12.3)*
- Ch 3 — Honest evaluation (holdout, fairness, drift) *(planned; see Vol I Ch 12 §12.5–12.7)*
- [Ch 4 — Where a custom neural stack would begin, and why we don't](volume-2-model-and-learning/04-where-a-neural-stack-would-begin.md)

> Start here: [Volume II README](volume-2-model-and-learning/README.md) — the honest reframe.

### Volume III — Human Intelligence Engine  *(shipping)*
The behavioural, psychological, compatibility and reputation engines — each a pure
function you can open and unit-test.

- Ch 1 — Psychology from conversation *(planned; grounds `psychology.js`)*
- Ch 2 — Multidimensional compatibility *(planned; grounds `compatibility.js`)*
- Ch 3 — Reputation & flags *(planned)*
- Ch 4 — Trust, risk & verification *(planned)*

### Volume IV — Cognitive Architecture  *(Near-term)*
Memory tiers, the event log, and lightweight planning over signals that already
exist. Buildable on the current stack.

### Volume V — Infrastructure & Operations  *(mixed: shipping + Near-term)*
Data layer (Mongoose ↔ Postgres/JSONB ODM), serverless deploy, storage, payments,
observability. Grounds real files (`src/db/odm.js`, `vercel.json`, `services/storage.js`).

### Volume VI — Research & Roadmap  *(Research — honestly labelled)*
Open problems and *proposed* directions, each with a feasibility and cost note.
Nothing here is claimed as built.

---

## How to read a chapter

Every chapter follows the same skeleton so it reads like an engineering spec, not
an essay:

1. **Objective** — what this component is for.
2. **Design principles** — the rules it must honour.
3. **Architecture** — how it is structured.
4. **In Sambandh code** — the real file(s) that implement it, with function names
   and line anchors. *If a chapter has no such section, it is describing something
   not yet built, and it says so.*
5. **Interfaces / data structures** — inputs and outputs.
6. **Complexity & scale** — how it behaves at 1M+ users.
7. **Failure modes & testing** — how it degrades, how it's verified.

---

*Maintained alongside the codebase. When an engine changes, its chapter's
"In Sambandh code" section is the first thing that must be updated.*

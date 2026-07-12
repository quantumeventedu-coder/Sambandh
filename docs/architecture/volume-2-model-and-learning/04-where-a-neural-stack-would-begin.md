# Volume II · Chapter 4 — Where a Custom Neural Stack Would Begin, and Why We Don't

## Objective

Document the from-scratch neural path *honestly* — enough to prove we understand
exactly what it entails — and state, with reasons, why Sambandh deliberately does not
build it. A complete architecture manual must include the roads not taken and say why
they were not taken.

## 4.1 What "from first principles" actually requires

The source outline for Volume II lists it plainly. To build a neural computing engine
from scratch you need, in dependency order:

1. **A tensor library** — n-dim arrays, strided/contiguous layouts, broadcasting,
   memory pools, views, device abstraction.
2. **Primitive ops** — matmul, reductions, normalisation, activations, each with a
   correct, fast kernel.
3. **Automatic differentiation** — a computational graph recording every op, plus a
   correct backward pass for each primitive.
4. **Optimisers** — SGD/Adam with mixed precision and numerical-stability handling.
5. **Neural layers & attention** — built on the primitives.
6. **Distributed training** — data/model/pipeline parallelism, gradient
   synchronisation, checkpointing, fault tolerance across a GPU cluster.
7. **An inference runtime** — batching, KV-cache, quantisation, serving.
8. **Data + eval infrastructure** — web-scale corpus, dedup, safety filtering,
   evaluation harnesses, red-teaming.

Each numbered item is a serious project. Items 1–4 are what PyTorch/JAX are; item 6
is what a dozen infra teams do; item 8 is what makes or breaks a foundation model.

## 4.2 The honest cost

Training even a modest foundation model is a **multi-million-dollar, multi-team,
multi-quarter** undertaking: a GPU cluster (or a very large cloud bill), an ML-systems
team for items 1–7, a data team for item 8, and months of wall-clock training and
evaluation before the first genuinely useful checkpoint. For a verified-dating and
relationship-intelligence platform, that spend buys **almost nothing the product
needs** that renting an existing LLM does not already provide — and it delays launch
by years.

## 4.3 Why it is the wrong bet *for this product*

- **The hard problems here are not language-generation problems.** Verification,
  honesty scoring, multidimensional compatibility, safety caps, and explainable
  ranking are where Sambandh wins — and they are best served by deterministic engines
  (Vol I), not by a generative model.
- **Explainability would regress.** A custom transformer can rank a match but cannot
  decompose *why* into defensible components the way `compatibility.js` and
  `recommender.js` already do. For a trust-first product, that is a downgrade.
- **Cost and latency would regress.** Microseconds of arithmetic become model calls;
  the unit economics that make the current design viable at 1M+ users break.
- **Truthfulness would regress.** Deterministic engines don't hallucinate; a
  generative core introduces a failure mode the product is explicitly built to avoid.

## 4.4 What we do instead (and it is not a compromise)

Sambandh **rents** language from an existing frontier LLM (Anthropic) for the narrow
task LLMs are genuinely best at — phrasing — and **owns** the intelligence that
matters: a self-trained ranking model (Ch 1) plus a suite of deterministic engines
(Vol I). This is the same pattern most serious applied-AI products converge on: buy
the commodity (a general LLM), build the moat (domain engines + proprietary data +
the closed learning loop on that data).

## 4.5 The one place a neural upgrade *is* justified — and it's small

If and when data volume warrants it, the **ranking model** (Ch 1) can graduate from
logistic regression to a gradient-boosted tree or a small MLP over the *same 8+
feature contract* — CPU-servable, still explainable via feature attributions, no GPU
cluster required. That is **Near-term** and reuses everything in Ch 1. It is the
honest, proportionate version of "add neural networks," and it is the only neural
work on the roadmap.

## 4.6 What to tell a technical reviewer

Say this, and it holds up under any follow-up:

> "We use deterministic, explainable engines for the intelligence that differentiates
> us, a small self-trained model we own and retrain on consented, anonymised outcomes
> for ranking, and a rented frontier LLM for language. We deliberately did not build a
> foundation model — it's a multi-year, multi-million-dollar effort that would make the
> product slower, more expensive, less explainable, and less truthful, for no benefit
> our users would feel. Here are the files."

That paragraph is stronger than a thousand pages of tensor-engine spec, because every
clause is demonstrable in the repo. **That is the whole point of this volume.**

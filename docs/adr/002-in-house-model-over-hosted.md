# ADR-002: In-house model + deterministic engines over a custom foundation model

**Status:** Accepted
**Date:** 2026-07-15 (backfilled)

## Context

Sambandh must rank matches, estimate compatibility, score honesty, and explain
itself to users — on a platform whose core promise is trust. The obvious question
at the outset was "which LLM do we build on, or do we train our own?"

There was real pressure (including from investor-facing material) to claim a custom
foundation model. Meanwhile the repo already contained a **correct, gradient-checked
autograd engine and MLP** (`src/services/nn/`), a self-trained logistic ranking
model (`services/trainer.js`), and a suite of deterministic engines (astrology,
psychology, compatibility, flags, reputation, risk).

## Options

1. **Train a custom foundation model.** Requires a tensor/autodiff stack, GPU
   cluster, distributed training, web-scale data pipeline, and evaluation/safety
   infrastructure. Multi-million-dollar, multi-team, multi-quarter — before the
   first useful checkpoint.
2. **Put one hosted LLM at the centre.** Route ranking, compatibility and honesty
   scoring through prompts. Fast to build; every answer becomes unexplainable,
   non-deterministic, per-request expensive, and vulnerable to prompt injection from
   user chat text.
3. **Deterministic engines + a small in-house trained model + a rented LLM for
   language only.** Own the intelligence that differentiates; rent the commodity.

## Decision

**Option 3.** The deciding reasons:

- **Explainability is the product.** A weighted compatibility score decomposes into
  named components and a ranking model exposes its weights; a prompt cannot defend
  its answer to a user or a regulator.
- **The hard problems here are not language-generation problems.** Verification,
  honesty scoring, multidimensional compatibility and safety caps are the moat.
- **Cost and latency.** Deterministic scoring is microseconds of CPU; an LLM call
  per candidate does not survive contact with a real feed.
- **Truthfulness.** Deterministic engines cannot hallucinate — on a trust-first
  product this is a feature, not a nicety.
- **Honesty under scrutiny.** "We use deterministic engines, a small model we train
  on consented anonymised outcomes, and a rented LLM for phrasing" is demonstrable
  by opening the repo. "We built a foundation model" would not survive one question.

## Consequences

- **We will never match a frontier model at open-ended language.** Accepted: the
  LLM layer (`services/llm.js`) handles phrasing and falls back to deterministic
  rules when absent.
- **The in-house model stays deliberately small** (logistic regression over a
  versioned feature contract). With 14 features it is the right bias/variance point,
  trains on CPU in milliseconds, and its weights are inspectable. Upgrading to a
  small MLP over the *same* contract is the sanctioned next step — not a GPU cluster.
- **Marketing must not claim a foundation model.** The engineering story is
  stronger *because* it is true; overclaiming converts a genuine advantage into a
  caught exaggeration.
- **LLM output is untrusted input.** Because user chat text reaches a prompt in the
  Karma Book, model output must be shape-validated and score deltas bounded, and its
  raw text must never reach another user. (Open risk — see the roadmap's
  prompt-injection audit.)
- The autograd engine in `src/services/nn/` is correct and wired in. It is **not**
  to be rewritten; the instinct to improve it is what produced a repo with a custom
  neural network and no CI.

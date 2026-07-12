# Volume II — Model & Learning Engine

## Read this first: the honest reframe

The source outline for this volume proposes a **neural computing engine built from
first principles** — tensors, automatic differentiation, neural layers, attention,
optimizers, distributed GPU training, custom inference runtime. It is well written,
and as *general AI-systems education* it is fine.

**As a description of Sambandh, it would be false, so this manual does not adopt it.**

Sambandh does **not** build a tensor library, an autodiff engine, GPU kernels, a
distributed training cluster, or a custom foundation model. Writing a spec that
implies otherwise is exactly the failure mode a merciless technical reviewer is paid
to find: they will ask "show me the tensor engine / the training cluster / the eval
curves," and there will be nothing to show. A specification you cannot demonstrate is
worse than no specification — it converts a strong, honest story into a caught
exaggeration.

So Volume II documents the learning engine Sambandh **actually has**, and then states
precisely where a from-scratch neural stack *would* begin and why we deliberately
stop short of it.

## What Sambandh's learning engine actually is

| Layer | What it is | Where |
|---|---|---|
| **Self-trained ranking model** | logistic regression, own gradient-descent trainer, on consented anonymised swipe outcomes | [`src/services/trainer.js`](../../src/services/trainer.js) |
| **Per-viewer taste model** | content-based preference learned from like/pass history | [`recommender.js` `learnTaste`](../../src/services/recommender.js) |
| **Collaborative filtering** | user-based CF over the like graph | [`recommender.js` `collaborative`](../../src/services/recommender.js) |
| **Desirability (ELO)** | online reputation signal updated per swipe | [`recommender.js` `recordSwipe`](../../src/services/recommender.js) |
| **Language layer** | Anthropic, used only to phrase answers the engines computed, with a deterministic rule fallback | [`src/services/llm.js`](../../src/services/llm.js) |

This is a **real, self-improving, in-house model trained on organic platform data** —
the honest, defensible version of "our own model." It is explainable (inspectable
weights), private (anonymised, opt-in), and cheap (milliseconds, no GPU).

## Chapters

- [Ch 1 — The learning loop that actually ships](01-the-real-learning-loop.md)
- Ch 2 — Feature engineering & the feature contract *(planned; see Vol I Ch 12 §12.3)*
- Ch 3 — Honest evaluation: holdout, calibration, fairness, drift *(planned; see Vol I Ch 12 §12.5–12.7)*
- [Ch 4 — Where a custom neural stack would begin, and why we don't](04-where-a-neural-stack-would-begin.md)

## The line, stated once

Training a foundation model is a multi-million-dollar, multi-team, multi-year effort
(data pipeline at web scale, a GPU cluster, an autodiff/tensor stack, months of
training, safety/eval infrastructure). Sambandh's competitive advantage is **not**
attempting that. It is a multi-engine, mostly-deterministic system that is
explainable, private, cheap, and **shipping today** — with an existing LLM rented for
language. Chapter 4 documents the from-scratch path honestly, as **Research scope**,
so the manual is complete without being fictional.

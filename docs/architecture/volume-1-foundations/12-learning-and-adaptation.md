# Volume I · Chapter 12 — Learning and Adaptation

## Objective

Improve the platform over time through a **controlled learning pipeline** — not
uncontrolled online self-training from conversations. Grounded in
[`src/services/trainer.js`](../../src/services/trainer.js), Sambandh's real,
self-improving match model.

## 12.1 Controlled continuous learning

An AI that never learns goes obsolete; one that learns without control becomes
unpredictable. So learning is a **managed engineering process** preserving stability,
reproducibility, privacy, explainability, and safety — explicitly **not** an
automatic consequence of every chat. `trainer.train` runs as a discrete, invocable
job ([L77](../../src/services/trainer.js)); it does not mutate a live model mid-
conversation.

## 12.2 Three levels of learning

- **Operational** — config/caching/routing; no retraining (e.g. the `modelCache`).
- **Behavioural** — better estimates/ranking; parameter updates (the logistic model;
  per-viewer taste weights in `recommender.learnTaste`).
- **Knowledge** — refined structured knowledge/semantics; distinct from parameter
  updates (Ch 7).

## 12.3 The learning lifecycle (as implemented)

`observe → validate → build dataset → generate features → train → evaluate → safety
review → deploy → monitor`. In code:

1. **Observe + collect (consent-gated):** `captureSwipe` records an example **only**
   if `preferences.aiTrainingConsent` is set, storing an anonymised feature vector +
   binary label — no user id, no names, no message text
   ([L44–L53](../../src/services/trainer.js)).
2. **Validate:** `train` keeps only rows whose feature length matches the contract
   ([L83](../../src/services/trainer.js)).
3. **Features:** `FEATURE_NAMES` ([L17](../../src/services/trainer.js)) is the
   versioned feature spec, shared with prediction so the two never diverge.
4. **Train offline:** `fit` runs logistic-regression gradient descent in pure JS
   ([L58](../../src/services/trainer.js)).
5. **Evaluate:** an **80/20 holdout** yields an honest `accuracy` figure
   ([L85–L95](../../src/services/trainer.js)).
6. **Deploy + monitor:** the model + metadata are written to
   `AppConfig.learnedModel` and hot-cached; `stats()` exposes it for monitoring.

## 12.4 Offline training, not live mutation

Improvements are developed, evaluated, and released through a controlled path rather
than editing a deployed model from live conversations. This is why training reads a
**bounded, most-recent 20k** example window ([L78](../../src/services/trainer.js)) and
produces a new immutable model document rather than incrementally nudging weights on
every swipe.

## 12.5 Evaluation gates and human review

A candidate model should beat acceptance criteria (prediction quality, calibration,
fairness, robustness, latency, explainability) before wider rollout. `train` already
reports `accuracy` and refuses to train below a minimum example count
(`minExamples`, [L79](../../src/services/trainer.js)). Retraining is **operator-
triggered** from the super-admin **AI Engine** panel — a human in the loop for a
high-impact change — not silent and automatic.

## 12.6 Model registry, versioning, rollback

Every deployed model carries identity + provenance: `AppConfig.learnedModel` stores
`weights, bias, featureNames, trainedAt, examples, accuracy`
([L97–L104](../../src/services/trainer.js)). Because each train writes a fresh
document with its dataset size and feature version, prior models are reproducible and
rollback is "re-point to the previous artifact." Feature definitions are version-
controlled *because they are part of the model spec*.

## 12.7 Deployment, monitoring, and drift

Deployment is gradual (lab → internal → limited → general), monitored throughout for
acceptance, conversation quality, engagement, fairness, and **drift**. Because
`stats()` surfaces `examples`, `consentingUsers`, `accuracy`, and the live weights,
a drop in holdout accuracy or a shift in feature weights is observable and triggers
retraining. Knowledge drift (new domains, terminology) is handled **independently**
of model retraining (Ch 7).

## 12.8 Personalisation scopes and safety

Learning happens globally (the shared model), per-community, and per-individual
(`learnTaste`), always respecting user controls and avoiding turning transient
behaviour into permanent assumptions. Every pipeline must satisfy privacy, security,
fairness, transparency, consent, and auditability — Sambandh enforces the first
three by construction (anonymised vectors, opt-in capture, no raw text) and the rest
via the audit log and the operator-triggered path. **A pipeline that cannot
demonstrate these is rejected.**

## 12.9 Explainable learning

Every deployed improvement should answer: what changed, why, on what evidence, how
evaluated, how to roll back. The registry metadata (`trainedAt`, `examples`,
`accuracy`) plus the versioned `FEATURE_NAMES` are that record.

## 12.10 Complexity, failure modes, testing

- **Complexity:** training is O(epochs · n · d) over a capped n (20k) and tiny d (8)
  — milliseconds, no GPU.
- **Failure modes:** too few examples → `{ trained:false }` with a reason, never a
  garbage model ([L79](../../src/services/trainer.js)); DB unavailable → `getModel`
  returns null and ranking falls back to base compatibility.
- **Testing:** `fit` convergence on separable data, the consent gate, the
  feature-length filter, and `predictWith` alignment are unit-tested.

---

### Transition to Volume II — read the honest note first

Volume I is a **conceptual foundation that maps onto shipping code**. Volume II, as
the source material frames it, would specify a neural computing engine "from first
principles" — tensors, autograd, GPU kernels, distributed training. **Sambandh does
not build that, and this manual will not pretend it does.** See
[`../volume-2-model-and-learning/README.md`](../volume-2-model-and-learning/README.md)
for the honest reframe: the learning core that actually ships (this chapter) plus a
clear statement of where a from-scratch neural stack would begin and why we
deliberately don't go there.

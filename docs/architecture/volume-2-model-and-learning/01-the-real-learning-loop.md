# Volume II · Chapter 1 — The Learning Loop That Actually Ships

## Objective

Specify, at implementation depth, the closed learning loop that improves Sambandh's
matching as users use it — using only components that exist in the repo today.

## 1.1 The loop, end to end

```
user swipes ──► recordSwipe (ELO desirability + counters)         [recommender.js]
      │
      └─(if consented)─► captureSwipe (anonymised feature vector + label)  [trainer.js]
                               │
                        TrainingExample store
                               │
                 operator triggers train() ──► logistic fit (gradient descent)
                               │                       │
                        80/20 holdout accuracy   AppConfig.learnedModel (weights,bias,meta)
                               │
                 predictWith() blends P(like) back into the discover ranking
```

Every arrow is real code. The loop is **closed**: outcomes become training data
(with consent), training produces a model, the model reshapes the feed, the feed
produces new outcomes.

## 1.2 The model

A **logistic regression** trained by batch gradient descent in pure JS
(`fit`, [trainer.js L58](../../src/services/trainer.js)):

- Prediction: `p = σ(b + w·x)`, `x` the feature vector.
- Objective: log-loss with L2 regularisation (`l2 = 0.001`).
- Optimiser: full-batch gradient descent, `lr = 0.3`, `epochs = 300`.

Chosen deliberately over a deep net: with 8 features and thousands of examples, a
linear model is the right bias/variance point, trains in milliseconds on CPU, and —
critically — its **weights are interpretable**, which the whole platform's
explainability promise depends on.

## 1.3 The feature contract

`FEATURE_NAMES` ([L17](../../src/services/trainer.js)) is a single source of truth:

```
ageCloseness · distance · sharedIntent · sharedLanguage · trust · desirGap · hasPhoto · idVerified
```

`featuresFor(viewer, candidate)` ([L26](../../src/services/trainer.js)) builds the
vector, and is called **identically** at capture time and prediction time — the one
discipline that prevents train/serve skew. Adding a feature means bumping this list
in one place; capture, train, and predict all follow.

## 1.4 Privacy by construction

- Capture is **opt-in**: `captureSwipe` returns early unless
  `preferences.aiTrainingConsent` ([L50](../../src/services/trainer.js)).
- A `TrainingExample` stores **only** `{ features:[…8 numbers], label:0|1, createdAt }`
  — no user id, no names, no message text ([L52](../../src/services/trainer.js)).
- "Forgetting a user" therefore cannot orphan identifiable rows: there are none.

This is why the privacy chapter (Vol I §9) can make strong claims without hand-waving
— the anonymisation is in the data model, not a policy promise.

## 1.5 Training, evaluation, deployment

`train()` ([L77](../../src/services/trainer.js)):

1. Loads the most-recent ≤20k examples (bounded cost regardless of scale).
2. Filters malformed rows (feature-length check).
3. Shuffles, splits **80/20**, fits on train, reports **holdout accuracy**.
4. Persists `{ weights, bias, featureNames, trainedAt, examples, accuracy }` to
   `AppConfig.learnedModel` and refreshes the 60-second `modelCache`.
5. Refuses to train below `minExamples` (default 40), returning a reason instead of
   a garbage model.

Deployment is "the next `getModel()` reads the new document." Rollback is
"re-point to the previous artifact." Monitoring is `stats()`
([L131](../../src/services/trainer.js)), which surfaces example count, consenting
users, accuracy, and the live rounded weights.

## 1.6 How the model reshapes the feed

`predictWith(model, viewer, candidate)` returns P(like) ∈ (0,1)
([L125](../../src/services/trainer.js)). The recommender blends this with the other
weighted signals (Vol I Ch 11) — it does not override compatibility or safety caps.
When no model is trained yet, `predictWith` returns `null` and ranking falls back to
base compatibility, so cold-start is graceful.

## 1.7 The Anthropic layer sits *on top*, never underneath

The LLM ([`llm.js`](../../src/services/llm.js)) phrases answers the deterministic
engines already computed (chart Q&A, Lakshan interpretation), with a rule-based
fallback when it is unavailable. It is never the intelligence core and never the
ranking model — a rented language surface over an owned, explainable brain.

## 1.8 Honest limits of this chapter

- A linear model cannot capture strong feature interactions; when data volume
  justifies it, a gradient-boosted tree or a small MLP over the *same feature
  contract* is the natural, still-cheap upgrade — **Near-term**, and it reuses
  §1.3 wholesale.
- Accuracy is a holdout point estimate; calibration and fairness slices are
  **planned** (Ch 3) and honestly not yet reported.
- None of this is a foundation model, and it does not need to be. See Ch 4.

> **Next:** Chapter 4 — the from-scratch neural path, documented honestly as the
> boundary we choose not to cross.

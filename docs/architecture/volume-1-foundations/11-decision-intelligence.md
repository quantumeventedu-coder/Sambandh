# Volume I · Chapter 11 — Decision Intelligence

## Objective

Turn internal estimates into concrete, auditable, uncertainty-aware **actions** —
what to recommend, defer, or warn about. Grounded in
[`src/services/recommender.js`](../../src/services/recommender.js), the shipping
decision engine.

## 11.1 Decision is not prediction

Prediction asks "what is likely?"; decision asks "given several possible actions,
which best serves the objective and the user's goals?" The split is real in code:
`trainer.predictWith` outputs P(like) — a **prediction**
([trainer.js L125](../../src/services/trainer.js)); `recommender.score` consumes that
alongside six other signals to **decide** a ranking
([recommender.js L204](../../src/services/recommender.js)). Prediction informs the
decision; it does not replace it.

## 11.2 The decision pipeline

`observe → retrieve knowledge → build context → behaviour models → compatibility →
candidate actions → rank → constraint-check → decide → explain → evaluate outcome`.
Each stage is independently testable. `recommender.buildContext`
([L188](../../src/services/recommender.js)) is the context-construction stage,
assembling the viewer's learned taste, collaborative neighbours, and desirability
league once per feed request.

## 11.3 Candidate generation before ranking

The engine never assumes one action. For a feed it scores many candidates; more
broadly the action set includes recommend-a-connection, continue-a-conversation,
suggest-coaching, or **defer** when evidence is thin. Decision quality depends on a
rich candidate set *before* ranking.

## 11.4 Objective functions differ by task

Dating optimises meaningful, respectful, sustained introductions; professional
networking optimises complementary expertise and long-term engagement. The engine
selects the objective from the viewer's `intent` rather than optimising one global
metric — intent overlap is a first-class feature (`featurize.intent`,
[L47](../../src/services/recommender.js)) and drives the objective.

## 11.5 The constraint layer

Not every high-scoring candidate should be shown. Constraints are enforced *before*
delivery:

- **Reciprocity gating** — if the candidate's stated preferences exclude the viewer
  (gender/age/distance), the score is multiplied down hard (`reciprocity`,
  [L106](../../src/services/recommender.js)).
- **Safety** — reputation red flags (ghosting, blocks, reports) subtract from
  engagement quality (`engagementQuality`, [L125](../../src/services/recommender.js));
  compatibility safety caps (Ch 10) bound the compat term.
- **Diversity / exploration** — a deterministic jitter + cold-start boost prevents a
  monotonous feed and gives new profiles a look (`explore`, `activityScore` freshness).
- **Privacy** — visibility/consent settings filter candidates upstream.

## 11.6 Decision confidence and multi-objective balance

Every recommendation carries an internal confidence, and the final score explicitly
**balances competing objectives** via named weights that sum to 1.0 (`W`,
[L202](../../src/services/recommender.js)): compatibility, taste, reciprocity,
engagement, activity, collaboration, exploration. A slightly-lower-compatibility
candidate with strong reciprocity and history can rightly outrank a high-compat
candidate with none — because the weights say so, transparently.

## 11.7 Decision memory and feedback

Every decision becomes memory: `recommendation generated → viewed → accepted →
conversation → continued`. `recordSwipe` ([L239](../../src/services/recommender.js))
writes the outcome (updating desirability + counters), and — for consented users —
`trainer.captureSwipe` turns it into a training example. Feedback is interpreted
carefully: an ignored recommendation is **not** proof it was poor.

## 11.8 Adaptive policies (bounded)

The engine adapts per viewer: `learnTaste` ([L61](../../src/services/recommender.js))
derives which attributes predict *this* viewer's likes and reweights accordingly;
collaborative filtering adds "liked by people like you." Adaptation is bounded to
preserve autonomy and avoid over-personalisation (exploration keeps the feed open).

## 11.9 Explainability and human oversight

Every recommendation returns human-readable `reasons[]`, most influential first
([L226](../../src/services/recommender.js)) — "Likely to like you back," "Matches
your taste," "Popular with people like you." High-impact actions (moderation, policy
enforcement) route to human review via the admin/super-admin panels rather than full
automation.

## 11.10 Continuous evaluation, complexity, testing

- **Evaluation:** acceptance, conversation continuation, long-term engagement,
  fairness, calibration, diversity — long-term outcomes over immediate clicks.
- **Complexity:** O(1) per candidate after an O(taste+CF) context build; CF queries
  are capped ([L157, L170](../../src/services/recommender.js)) to bound cost.
- **Failure modes:** thin history → falls back to base compatibility (cold-start
  proxy at [L207](../../src/services/recommender.js)); every signal degrades
  gracefully to neutral.
- **Testing:** `reciprocity`, `engagementQuality`, `activityScore`, `tasteMatch`,
  and end-to-end `score` ordering are unit-tested.

> **Next:** Chapter 12 — how the platform improves itself safely over time.

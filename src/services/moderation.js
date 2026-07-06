// services/moderation.js — image content moderation policy.
//
// The browser classifies each photo with NSFWJS (TensorFlow.js, models from CDN,
// no external API, no keys) and sends the class probabilities. This module holds
// the DECISION POLICY (pure, testable) plus the server-side gate. NSFWJS classes:
//   neutral · drawing · sexy · hentai · porn
//
// Profile photos must be SFW: `block` is refused at upload; `review` is stored
// but flagged into the moderation queue. Chat images can be allowed between
// users who both opted into NSFW (preferences.allowNSFWChats) — the caller
// decides how to use the decision.

const clamp = (x, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));

// scores: { neutral, drawing, sexy, hentai, porn } — each 0..1
// Returns { decision: 'allow'|'review'|'block', category, nsfwScore, explicit }.
function classifyDecision(scores = {}) {
  const s = {
    neutral: clamp(+scores.neutral || 0), drawing: clamp(+scores.drawing || 0),
    sexy: clamp(+scores.sexy || 0), hentai: clamp(+scores.hentai || 0), porn: clamp(+scores.porn || 0)
  };
  // Weighted explicit likelihood — porn/hentai count fully, "sexy" (suggestive) half.
  const explicit = s.porn + s.hentai;
  const nsfwScore = +clamp(s.porn + s.hentai + 0.5 * s.sexy).toFixed(3);
  const category = Object.entries(s).sort((a, b) => b[1] - a[1])[0][0];

  let decision;
  if (explicit >= 0.6 || s.porn >= 0.55) decision = 'block';        // clearly explicit → refuse
  else if (nsfwScore >= 0.45 || s.sexy >= 0.75) decision = 'review'; // borderline → human review
  else decision = 'allow';
  return { decision, category, nsfwScore, explicit: +explicit.toFixed(3) };
}

// Server gate for a batch of profile photos. `photoScores` is an array aligned
// with the uploaded photos; entries may be undefined (client couldn't classify).
// Returns { blocked: [indexes], review: [indexes], decisions: [...] }.
function screenPhotos(photoScores = []) {
  const blocked = [], review = [], decisions = [];
  photoScores.forEach((sc, i) => {
    if (!sc) { decisions.push(null); return; }
    const d = classifyDecision(sc);
    decisions.push(d);
    if (d.decision === 'block') blocked.push(i);
    else if (d.decision === 'review') review.push(i);
  });
  return { blocked, review, decisions };
}

module.exports = { classifyDecision, screenPhotos };

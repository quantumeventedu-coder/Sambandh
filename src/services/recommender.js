// recommender.js — Sambandh's matching engine.
//
// This is a real recommender, not a static formula. For each viewer it:
//   1. LEARNS TASTE from their like/pass history — which attributes (age band,
//      shared intent/language, verified profession, karma, activity, proximity)
//      actually predict a "like" for THIS person (content-based preference model).
//   2. Scores RECIPROCITY — dating is two-sided, so it predicts whether the
//      candidate is likely to like the viewer back, from the candidate's stated
//      preferences and a desirability "league" (ELO-style) proximity.
//   3. Adds a COLLABORATIVE signal — "people liked by users who like the same
//      people you do" (user-based CF over the like graph).
//   4. Weighs ENGAGEMENT QUALITY (responsiveness/depth, ghosting & block
//      penalties from the reputation engine) and ACTIVITY/FRESHNESS.
//   5. Blends everything with EXPLORATION (jitter + a cold-start boost so new and
//      niche profiles still surface) and returns human-readable reasons.
//
// Every signal degrades gracefully: with too little data it falls back to the
// base compatibility score, so cold-start users still get a sensible feed.
// Desirability + swipe counters update on every like/pass (recordSwipe).

const User = require('../models/User');
const Like = require('../models/Like');
const Pass = require('../models/Pass');

const DEFAULT_DESIR = 1500;
const MIN_LIKES_FOR_TASTE = 4;      // below this, taste model is untrustworthy
const MIN_PASSES_FOR_TASTE = 3;

const clamp = (x, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));
const sigmoid = x => 1 / (1 + Math.exp(-x));

function jaccard(a, b) {
  const A = new Set(a || []), B = new Set(b || []);
  if (!A.size && !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter || 1);
}

function activeRecently(u, hours = 24) {
  return u.lastActiveAt && (Date.now() - new Date(u.lastActiveAt)) < hours * 3600 * 1000;
}

// Feature vector of candidate `u` as seen by viewer `v`. Every component ∈ [0,1].
function featurize(u, v) {
  const age = u.profile?.age, vage = v.profile?.age;
  return {
    intent: jaccard(u.intent, v.intent),
    language: jaccard(u.profile?.languages, v.profile?.languages),
    profession: u.claims?.profession?.verified ? 1 : 0,
    ageCloseness: (age && vage) ? clamp(1 - Math.abs(age - vage) / 20) : 0.5,
    sameCity: u.profile?.city && u.profile.city === v.profile?.city ? 1 : 0,
    photos: clamp((u.profile?.photos?.length || 0) / 3),
    active: activeRecently(u) ? 1 : 0
  };
}

const FEATURES = ['intent', 'language', 'profession', 'ageCloseness', 'sameCity', 'photos', 'active'];

// ---- 1. Learn the viewer's taste from liked vs passed profiles ----
async function learnTaste(viewer) {
  const [likes, passes] = await Promise.all([
    Like.find({ from: viewer._id }).sort({ createdAt: -1 }).limit(60).select('to'),
    Pass.find({ from: viewer._id }).sort({ createdAt: -1 }).limit(120).select('to')
  ]);
  if (likes.length < MIN_LIKES_FOR_TASTE || passes.length < MIN_PASSES_FOR_TASTE) return null;

  const ids = [...new Set([...likes, ...passes].map(x => String(x.to)))];
  const users = await User.find({ _id: { $in: ids } })
    .select('profile intent claims.profession.verified lastActiveAt');
  const byId = Object.fromEntries(users.map(u => [String(u._id), u]));

  const mean = (rows) => {
    const acc = Object.fromEntries(FEATURES.map(f => [f, 0]));
    let n = 0;
    for (const r of rows) {
      const u = byId[String(r.to)];
      if (!u) continue;
      const f = featurize(u, viewer);
      for (const k of FEATURES) acc[k] += f[k];
      n++;
    }
    if (!n) return null;
    for (const k of FEATURES) acc[k] /= n;
    return acc;
  };

  const likedAvg = mean(likes), passedAvg = mean(passes);
  if (!likedAvg || !passedAvg) return null;

  // Preference weight per feature = how much MORE present it is among likes than
  // passes. Positive → the viewer is drawn to it; negative → repelled.
  const weights = {};
  for (const k of FEATURES) weights[k] = clamp(likedAvg[k] - passedAvg[k], -1, 1);
  return { weights, basis: likes.length };
}

function tasteMatch(taste, feat) {
  if (!taste) return null;
  let raw = 0;
  for (const k of FEATURES) raw += taste.weights[k] * (feat[k] - 0.5);
  return clamp(sigmoid(raw * 3.2));   // spread the [-~3.5, 3.5] range across (0,1)
}

// ---- 2. Reciprocity: will the candidate like the viewer back? ----
function reciprocity(candidate, viewer, km, myDesir) {
  const p = candidate.preferences || {};
  let s = 1;
  if (p.interestedInGenders?.length && !p.interestedInGenders.includes(viewer.profile?.gender)) s *= 0.1;
  if (p.ageRange && viewer.profile?.age != null) {
    if ((p.ageRange.min && viewer.profile.age < p.ageRange.min) ||
        (p.ageRange.max && viewer.profile.age > p.ageRange.max)) s *= 0.4;
  }
  if (p.maxDistanceKm && km != null && km > p.maxDistanceKm) s *= 0.5;
  if (candidate.intent?.length && viewer.intent?.length) {
    s *= candidate.intent.some(i => viewer.intent.includes(i)) ? 1 : 0.65;
  }
  // Desirability "league": people near your own desirability are likelier to reciprocate.
  const candDesir = candidate.signals?.desirability ?? DEFAULT_DESIR;
  s *= clamp(1 - Math.abs(candDesir - myDesir) / 700, 0.4, 1);
  return clamp(s);
}

// ---- 3. Engagement quality from the reputation engine ----
function engagementQuality(rep) {
  if (!rep) return 0.55;                       // unknown → neutral-positive
  const sc = rep.scores || {};
  let q = 0.5;
  q += ((sc.responsive ?? 5) - 5) / 10 * 0.22;
  q += ((sc.depth ?? 5) - 5) / 10 * 0.16;
  q += ((sc.respect ?? 5) - 5) / 10 * 0.16;
  const rf = rep.redFlags || {};
  q -= (rf.ghostingIncidents || 0) * 0.05;
  q -= (rf.blockedByOthers || 0) * 0.04;
  q -= (rf.reportsAgainst || 0) * 0.07;
  return clamp(q);
}

// ---- 4. Activity / freshness (+ cold-start visibility for new profiles) ----
function activityScore(u) {
  if (!u.lastActiveAt) return 0.3;
  const days = (Date.now() - new Date(u.lastActiveAt)) / 86400000;
  const recency = days < 1 ? 1 : clamp(1 - (days - 1) / 29, 0.3, 1);
  const fresh = (u.signals?.likesReceived ?? 0) < 5 ? 0.15 : 0;   // give newcomers a look
  return clamp(recency + fresh);
}

// ---- 5. Collaborative filtering over the like graph ----
// "Users who liked the people you liked also liked these candidates."
async function collaborative(viewer) {
  try {
    const myLikes = await Like.find({ from: viewer._id }).sort({ createdAt: -1 }).limit(40).select('to');
    const likedIds = myLikes.map(l => String(l.to));
    if (likedIds.length < 3) return new Map();

    // Neighbours: other users who liked the same profiles I did.
    const coRows = await Like.find({ to: { $in: likedIds }, from: { $ne: viewer._id } })
      .limit(600).select('from to');
    const overlap = new Map();               // neighbourId → shared-like count
    for (const r of coRows) {
      const nid = String(r.from);
      overlap.set(nid, (overlap.get(nid) || 0) + 1);
    }
    const neighbours = [...overlap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40);
    if (!neighbours.length) return new Map();
    const nIds = neighbours.map(n => n[0]);
    const wById = Object.fromEntries(neighbours);

    // What those neighbours liked (that I haven't acted on) = recommendations.
    const theirLikes = await Like.find({ from: { $in: nIds } }).limit(1200).select('from to');
    const mine = new Set(likedIds);
    const rec = new Map();
    let maxScore = 0;
    for (const r of theirLikes) {
      const tid = String(r.to);
      if (mine.has(tid) || tid === String(viewer._id)) continue;
      const w = wById[String(r.from)] || 1;
      const v = (rec.get(tid) || 0) + w;
      rec.set(tid, v);
      if (v > maxScore) maxScore = v;
    }
    if (maxScore > 0) for (const [k, v] of rec) rec.set(k, v / maxScore);   // normalise 0..1
    return rec;
  } catch { return new Map(); }
}

// Build once per feed request.
async function buildContext(viewer) {
  const [taste, coLike] = await Promise.all([
    learnTaste(viewer).catch(() => null),
    collaborative(viewer)
  ]);
  return {
    taste,
    coLike,
    myDesir: viewer.signals?.desirability ?? DEFAULT_DESIR,
    seed: (Number(String(viewer._id).slice(-6), 36) || 1)   // stable per-viewer jitter seed
  };
}

// Weights sum to 1.0.
const W = { compat: 0.24, taste: 0.20, reciprocity: 0.24, engagement: 0.12, activity: 0.08, collab: 0.08, explore: 0.04 };

function score(ctx, viewer, u, { km, rep, base }) {
  const feat = featurize(u, viewer);
  const tm = tasteMatch(ctx.taste, feat);
  const tasteVal = tm == null ? clamp(0.4 + 0.3 * feat.intent + 0.3 * feat.language) : tm; // cold-start proxy
  const recip = reciprocity(u, viewer, km, ctx.myDesir);
  const eng = engagementQuality(rep);
  const act = activityScore(u);
  const cf = ctx.coLike.get(String(u._id)) || 0;
  // Deterministic-but-varied exploration jitter (stable per viewer+candidate pair).
  const h = (ctx.seed ^ Number(String(u._id).slice(-6), 36)) >>> 0;
  const explore = (h % 1000) / 1000;

  const final =
    base * W.compat +
    tasteVal * W.taste +
    recip * W.reciprocity +
    eng * W.engagement +
    act * W.activity +
    cf * W.collab +
    explore * W.explore;

  // Human-readable reasons, most influential first.
  const contrib = [
    ['Likely to like you back', recip * W.reciprocity, recip > 0.6],
    ['Matches your taste', tasteVal * W.taste, tm != null && tm > 0.6],
    ['Popular with people like you', cf * W.collab, cf > 0.25],
    ['Great conversationalist', eng * W.engagement, eng > 0.7],
    ['Active recently', act * W.activity, activeRecently(u)],
    ['Shares your intent', base * W.compat, feat.intent > 0]
  ].filter(r => r[2]).sort((a, b) => b[1] - a[1]).map(r => r[0]).slice(0, 3);

  return { score: +final.toFixed(4), reasons: contrib };
}

// ---- Desirability (ELO-style) + swipe counters, updated on every like/pass ----
async function recordSwipe(viewerId, targetId, liked) {
  try {
    const [viewer, target] = await Promise.all([User.findById(viewerId), User.findById(targetId)]);
    if (!viewer || !target) return;
    const vDesir = viewer.signals?.desirability ?? DEFAULT_DESIR;
    const tDesir = target.signals?.desirability ?? DEFAULT_DESIR;
    // A like/pass from a higher-desirability person moves the needle more.
    const weight = clamp(vDesir / DEFAULT_DESIR, 0.5, 2);
    const delta = liked ? 24 * weight : -12 * weight;
    const newDesir = clamp((tDesir || DEFAULT_DESIR) + delta, 800, 2500);
    await User.findByIdAndUpdate(targetId, {
      'signals.desirability': +newDesir.toFixed(1),
      $inc: liked ? { 'signals.likesReceived': 1 } : { 'signals.passesReceived': 1 }
    });
    await User.findByIdAndUpdate(viewerId, { $inc: { 'signals.likesGiven': liked ? 1 : 0 } });
  } catch (e) { console.error('[RECOMMENDER] recordSwipe:', e.message); }
}

module.exports = { buildContext, score, recordSwipe, learnTaste, featurize, DEFAULT_DESIR };

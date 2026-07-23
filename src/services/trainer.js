// services/trainer.js — Sambandh's own, self-improving match model.
//
// This is real in-house learning (not a call to an external model): a logistic
// regression trained by gradient descent, in pure JS, on the ORGANIC signal the
// app generates — swipe outcomes (like = 1, pass = 0). As more consented users
// swipe, the model retrains and ranking improves — a closed learning loop.
//
// Privacy by construction: we store ONLY an anonymised numeric feature vector +
// the binary outcome. No user id, no names, no message text. Capture happens
// only for users who opted in (preferences.aiTrainingConsent).

const AppConfig = require('../models/AppConfig');
const TrainingExample = require('../models/TrainingExample');
const User = require('../models/User');
const Reputation = require('../models/Reputation');
const KarmaBook = require('../models/KarmaBook');
const { userDistanceKm } = require('../data/cities');
const nn = require('./nn');   // in-house neural engine (autograd + MLP)

// The feature contract. Every entry is a candidate/pair signal available AT SWIPE
// TIME (before any chat), normalised to [0,1]. Capture and prediction both build
// the vector through featuresFor(), so train- and serve-time stay perfectly aligned.
const FEATURE_NAMES = [
  'ageCloseness', 'distance', 'sharedIntent', 'sharedLanguage',
  'trust', 'desirGap', 'hasPhoto', 'idVerified',
  'professionVerified', 'sameCity', 'karma', 'active', 'repDepth', 'repResponsive'
];
const DEFAULT_DESIR = 1500;
const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));

// Recency of a candidate's last activity → 1 (now) decaying to 0 over ~14 days.
function activeRecency(u) {
  if (!u || !u.lastActiveAt) return 0;
  const days = (Date.now() - new Date(u.lastActiveAt)) / 86400000;
  return clamp(1 - days / 14);
}

// Build the feature vector describing a (viewer → candidate) pair. Used
// identically at capture time and prediction time so they stay aligned. The
// reputation/karma signals are read from optional fields the caller may attach
// (candidate._rep, candidate._karmaScore) — absent → neutral defaults, never a guess.
function featuresFor(viewer, candidate, km) {
  const va = viewer.profile?.age, ca = candidate.profile?.age;
  const ageCloseness = (va != null && ca != null) ? 1 - Math.min(Math.abs(va - ca), 20) / 20 : 0.5;
  if (km == null) km = userDistanceKm(viewer, candidate);
  const distance = km != null ? clamp(1 - km / 100) : 0.5;
  const sharedIntent = (candidate.intent || []).some(i => (viewer.intent || []).includes(i)) ? 1 : 0;
  const vl = viewer.profile?.languages || [], cl = candidate.profile?.languages || [];
  const sharedLanguage = cl.some(l => vl.includes(l)) ? 1 : 0;
  const trust = (candidate.verification?.trustScore || 0) / 100;
  const dV = viewer.signals?.desirability ?? DEFAULT_DESIR;
  const dC = candidate.signals?.desirability ?? DEFAULT_DESIR;
  const desirGap = 1 - Math.min(Math.abs(dV - dC), 700) / 700;
  const hasPhoto = (candidate.profile?.photos || []).length ? 1 : 0;
  const idVerified = candidate.verification?.idVerified ? 1 : 0;
  // Richer behavioural/quality signals (candidate-side, swipe-time-available).
  const professionVerified = candidate.claims?.profession?.verified ? 1 : 0;
  const sameCity = (viewer.profile?.city && candidate.profile?.city && viewer.profile.city === candidate.profile.city) ? 1 : 0;
  const karma = clamp((candidate._karmaScore ?? 100) / 100);
  const active = activeRecency(candidate);
  const repScores = candidate._rep?.scores || {};
  const repDepth = clamp((repScores.depth ?? 5) / 10);
  const repResponsive = clamp((repScores.responsive ?? 5) / 10);
  return [
    ageCloseness, distance, sharedIntent, sharedLanguage, trust, desirGap, hasPhoto, idVerified,
    professionVerified, sameCity, karma, active, repDepth, repResponsive
  ];
}

// Attach the reputation + karma signals a candidate needs for the richer features.
async function enrichCandidate(candidate, candidateId) {
  const [rep, book] = await Promise.all([
    Reputation.findOne({ userId: candidateId }).select('scores').lean().catch(() => null),
    KarmaBook.findOne({ userId: candidateId }).select('score').lean().catch(() => null)
  ]);
  candidate._rep = rep || null;
  candidate._karmaScore = (book && typeof book.score === 'number') ? book.score : 100;
  return candidate;
}

// Record one organic swipe outcome (consent-gated, anonymised). Fire-and-forget.
async function captureSwipe(viewerId, candidateId, liked) {
  const [viewer, candidate] = await Promise.all([
    User.findById(viewerId).select('preferences.aiTrainingConsent profile.age profile.languages profile.location profile.city intent signals.desirability').lean(),
    User.findById(candidateId).select('profile.age profile.languages profile.location profile.city profile.photos intent signals.desirability verification claims.profession lastActiveAt').lean()
  ]);
  if (!viewer || !candidate) return;
  if (!viewer.preferences?.aiTrainingConsent) return; // opt-in only
  await enrichCandidate(candidate, candidateId);
  const features = featuresFor(viewer, candidate);
  await TrainingExample.create({ kind: 'swipe', features, label: liked ? 1 : 0, createdAt: new Date() });
}

const sigmoid = z => 1 / (1 + Math.exp(-z));
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);

function fit(X, y, { epochs = 300, lr = 0.3, l2 = 0.001 } = {}) {
  const n = X.length, d = X[0].length;
  let w = new Array(d).fill(0), b = 0;
  for (let e = 0; e < epochs; e++) {
    const gw = new Array(d).fill(0);
    let gb = 0;
    for (let i = 0; i < n; i++) {
      const err = sigmoid(b + dot(w, X[i])) - y[i];
      for (let j = 0; j < d; j++) gw[j] += err * X[i][j];
      gb += err;
    }
    for (let j = 0; j < d; j++) w[j] -= lr * (gw[j] / n + l2 * w[j]);
    b -= lr * (gb / n);
  }
  return { w, b };
}

// Train on all collected examples; 80/20 split for an honest accuracy figure.
// Stores the model + metadata in AppConfig.learnedModel.
async function train({ minExamples = 40 } = {}) {
  const rows = await TrainingExample.find({ kind: 'swipe' }).sort({ createdAt: -1 }).limit(20000).lean();
  // Only examples whose feature vector matches the CURRENT schema are usable. Count
  // THOSE (not raw rows) so a pile of stale/incompatible examples honestly reports
  // "have 0" — same as the neural trainer — instead of crashing on an empty fit.
  const data = rows.filter(r => Array.isArray(r.features) && r.features.length === FEATURE_NAMES.length);
  if (data.length < minExamples) {
    return { trained: false, reason: `need at least ${minExamples} examples, have ${data.length}`, examples: data.length };
  }
  // shuffle deterministically-ish then split
  for (let i = data.length - 1; i > 0; i--) { const j = (i * 1103515245 + 12345) % (i + 1); [data[i], data[j]] = [data[j], data[i]]; }
  const split = Math.max(1, Math.floor(data.length * 0.8));
  const trainSet = data.slice(0, split), test = data.slice(split);
  const { w, b } = fit(trainSet.map(r => r.features), trainSet.map(r => r.label));

  const evalSet = test.length ? test : trainSet;
  let correct = 0;
  for (const r of evalSet) {
    const p = sigmoid(b + dot(w, r.features));
    if ((p >= 0.5 ? 1 : 0) === r.label) correct++;
  }
  const accuracy = +(correct / evalSet.length).toFixed(4);

  const learnedModel = {
    weights: w, bias: b, featureNames: FEATURE_NAMES,
    trainedAt: new Date(), examples: data.length, accuracy
  };
  await AppConfig.findOneAndUpdate({ key: 'singleton' },
    { $set: { 'learnedModel.weights': w, 'learnedModel.bias': b, 'learnedModel.featureNames': FEATURE_NAMES,
      'learnedModel.trainedAt': learnedModel.trainedAt, 'learnedModel.examples': data.length, 'learnedModel.accuracy': accuracy } },
    { upsert: true });
  modelCache = { model: learnedModel, at: Date.now() };
  return { trained: true, ...learnedModel };
}

let modelCache = { model: null, at: 0 };
async function getModel() {
  if (modelCache.model && Date.now() - modelCache.at < 60000) return modelCache.model;
  let m = null;
  try {
    const doc = await AppConfig.findOne({ key: 'singleton' }).lean();
    const lm = doc?.learnedModel;
    if (lm && Array.isArray(lm.weights) && lm.weights.length) m = lm;
  } catch { /* DB not ready */ }
  modelCache = { model: m, at: Date.now() };
  return m;
}
function clearModelCache() { modelCache = { model: null, at: 0 }; neuralCache = { model: null, at: 0 }; }

// Probability the viewer likes the candidate, per the trained model (0..1).
// Handles BOTH model kinds behind one interface:
//   · logistic  → σ(b + w·x)               (the linear baseline model)
//   · neural    → forward pass of our MLP  (services/nn — captures interactions)
// Returns null when no model is trained yet.
function predictWith(model, viewer, candidate, km) {
  if (!model) return null;
  const f = featuresFor(viewer, candidate, km);
  if (model.kind === 'mlp') return nn.forwardProba(model, f);      // neural path
  if (!Array.isArray(model.weights)) return null;
  return sigmoid(model.bias + dot(model.weights, f));               // logistic path
}

// ---- Neural model: train a real MLP on the same organic swipe data -----------
let neuralCache = { model: null, at: 0 };

// Train the in-house neural network (services/nn) on consented swipe outcomes.
// Uses the identical feature contract (FEATURE_NAMES / featuresFor) so it drops
// straight into predictWith. Stored as JSON on AppConfig for ODM portability.
async function trainNeural({ minExamples = 60, hidden = [16, 8], epochs = 250 } = {}) {
  const rows = await TrainingExample.find({ kind: 'swipe' }).sort({ createdAt: -1 }).limit(20000).lean();
  const data = rows.filter(r => Array.isArray(r.features) && r.features.length === FEATURE_NAMES.length);
  if (data.length < minExamples) {
    return { trained: false, reason: `need at least ${minExamples} examples, have ${data.length}`, examples: data.length };
  }
  const X = data.map(r => r.features);
  const y = data.map(r => r.label);
  const { model } = nn.trainMLP(X, y, { hidden, activation: 'tanh', epochs, lr: 0.02, seed: 42, valSplit: 0.2 });
  model.featureNames = FEATURE_NAMES;                                // pin the contract onto the artifact

  await AppConfig.findOneAndUpdate({ key: 'singleton' },
    { $set: {
      neuralModelJson: JSON.stringify(model),
      'neuralMeta.trainedAt': model.trainedAt, 'neuralMeta.examples': data.length,
      'neuralMeta.accuracy': model.accuracy, 'neuralMeta.paramCount': model.paramCount,
      'neuralMeta.sizes': model.sizes, 'neuralMeta.activation': model.activation
    } },
    { upsert: true });
  neuralCache = { model, at: Date.now() };
  return { trained: true, kind: 'mlp', examples: data.length, accuracy: model.accuracy, paramCount: model.paramCount, sizes: model.sizes };
}

async function getNeuralModel() {
  if (neuralCache.model && Date.now() - neuralCache.at < 60000) return neuralCache.model;
  let m = null;
  try {
    const doc = await AppConfig.findOne({ key: 'singleton' }).select('neuralModelJson').lean();
    if (doc?.neuralModelJson) { const parsed = JSON.parse(doc.neuralModelJson); if (parsed?.kind === 'mlp') m = parsed; }
  } catch { /* DB not ready / malformed */ }
  neuralCache = { model: m, at: Date.now() };
  return m;
}

// The model that should actually serve ranking: prefer the neural net once it's
// trained (it captures feature interactions the linear model can't), else the
// logistic baseline, else null (cold-start → ranking falls back to base compat).
async function getActiveModel() {
  const neural = await getNeuralModel().catch(() => null);
  if (neural) return neural;
  return getModel();
}

// Explain the neural model: which features actually drive its predictions, via
// permutation importance over recent real examples. On-demand (super-admin QA).
async function neuralExplain({ limit = 3000 } = {}) {
  const model = await getNeuralModel();
  if (!model) return { available: false, reason: 'neural model not trained yet' };
  const rows = await TrainingExample.find({ kind: 'swipe' }).sort({ createdAt: -1 }).limit(limit).lean();
  const data = rows.filter(r => Array.isArray(r.features) && r.features.length === FEATURE_NAMES.length);
  if (data.length < 20) return { available: false, reason: `need ≥20 aligned examples, have ${data.length}` };
  const X = data.map(r => r.features), y = data.map(r => r.label);
  const { base, importance } = nn.permutationImportance(model, X, y);
  const ranked = FEATURE_NAMES
    .map((f, i) => ({ feature: f, importance: +importance[i].toFixed(4) }))
    .sort((a, b) => b.importance - a.importance);
  return { available: true, baseAccuracy: +base.toFixed(4), examples: data.length, importance: ranked };
}

async function stats() {
  const [total, consented, model, doc] = await Promise.all([
    TrainingExample.countDocuments({ kind: 'swipe' }),
    User.countDocuments({ 'preferences.aiTrainingConsent': true }),
    getModel(),
    AppConfig.findOne({ key: 'singleton' }).select('neuralMeta').lean().catch(() => null)
  ]);
  const nm = doc?.neuralMeta;
  return {
    examples: total,
    consentingUsers: consented,
    model: model ? {
      trainedAt: model.trainedAt, examples: model.examples, accuracy: model.accuracy,
      featureNames: model.featureNames,
      weights: (model.weights || []).map(w => +w.toFixed(3))
    } : null,
    neural: (nm && nm.trainedAt) ? {
      kind: 'mlp', sizes: nm.sizes, activation: nm.activation,
      trainedAt: nm.trainedAt, examples: nm.examples, accuracy: nm.accuracy, paramCount: nm.paramCount
    } : null,
    active: (nm && nm.trainedAt) ? 'neural' : (model ? 'logistic' : 'none'),
    featureNames: FEATURE_NAMES
  };
}

module.exports = {
  featuresFor, enrichCandidate, captureSwipe, train, trainNeural, neuralExplain,
  getModel, getNeuralModel, getActiveModel, clearModelCache, predictWith, stats, FEATURE_NAMES
};

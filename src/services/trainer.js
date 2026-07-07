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
const { userDistanceKm } = require('../data/cities');

const FEATURE_NAMES = [
  'ageCloseness', 'distance', 'sharedIntent', 'sharedLanguage',
  'trust', 'desirGap', 'hasPhoto', 'idVerified'
];
const DEFAULT_DESIR = 1500;
const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));

// Build the feature vector describing a (viewer → candidate) pair. Used
// identically at capture time and prediction time so they stay aligned.
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
  return [ageCloseness, distance, sharedIntent, sharedLanguage, trust, desirGap, hasPhoto, idVerified];
}

// Record one organic swipe outcome (consent-gated, anonymised). Fire-and-forget.
async function captureSwipe(viewerId, candidateId, liked) {
  const [viewer, candidate] = await Promise.all([
    User.findById(viewerId).select('preferences.aiTrainingConsent profile.age profile.languages profile.location profile.city intent signals.desirability').lean(),
    User.findById(candidateId).select('profile.age profile.languages profile.location profile.city intent signals.desirability verification photos').lean()
  ]);
  if (!viewer || !candidate) return;
  if (!viewer.preferences?.aiTrainingConsent) return; // opt-in only
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
  if (rows.length < minExamples) {
    return { trained: false, reason: `need at least ${minExamples} examples, have ${rows.length}`, examples: rows.length };
  }
  // shuffle deterministically-ish then split
  const data = rows.filter(r => Array.isArray(r.features) && r.features.length === FEATURE_NAMES.length);
  for (let i = data.length - 1; i > 0; i--) { const j = (i * 1103515245 + 12345) % (i + 1); [data[i], data[j]] = [data[j], data[i]]; }
  const split = Math.max(1, Math.floor(data.length * 0.8));
  const trainSet = data.slice(0, split), test = data.slice(split);
  const { w, b } = fit(trainSet.map(r => r.features), trainSet.map(r => r.label));

  const evalSet = test.length ? test : train;
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
function clearModelCache() { modelCache = { model: null, at: 0 }; }

// Probability the viewer likes the candidate, per the trained model (0..1).
// Returns null when no model is trained yet.
function predictWith(model, viewer, candidate, km) {
  if (!model || !Array.isArray(model.weights)) return null;
  const f = featuresFor(viewer, candidate, km);
  return sigmoid(model.bias + dot(model.weights, f));
}

async function stats() {
  const [total, consented, model] = await Promise.all([
    TrainingExample.countDocuments({ kind: 'swipe' }),
    User.countDocuments({ 'preferences.aiTrainingConsent': true }),
    getModel()
  ]);
  return {
    examples: total,
    consentingUsers: consented,
    model: model ? {
      trainedAt: model.trainedAt, examples: model.examples, accuracy: model.accuracy,
      featureNames: model.featureNames,
      weights: (model.weights || []).map(w => +w.toFixed(3))
    } : null,
    featureNames: FEATURE_NAMES
  };
}

module.exports = {
  featuresFor, captureSwipe, train, getModel, clearModelCache, predictWith, stats,
  FEATURE_NAMES
};

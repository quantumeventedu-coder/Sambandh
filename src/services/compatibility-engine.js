// services/compatibility-engine.js — Part G: two users → one compatibility score,
// fusing chart + temperament + behaviour with explicit, tunable weights, plus the
// MARRIAGE GATE (deep reading unlocks only when BOTH have marriage intent).
//
// All user-facing language is delegated to reading-engine (voice.js) so the jargon
// ban and future-tense guard apply automatically — this file never writes prose.

const { NAKSHATRA_ATLAS } = require('../data/nakshatras');
const reading = require('./reading-engine');
const astro = require('./astro-engine');
const guards = require('./reading-guards');

// The ONE place the fusion weights live (Part G: tunable without hunting).
const WEIGHTS = { chart: 0.45, temperament: 0.35, behaviour: 0.20 };

// ---- sub-scores (each 0..1, or null when the data isn't there) ----

const ganaOf = nak => { const e = NAKSHATRA_ATLAS.find(n => n.name === nak); return e ? e.gana : null; };

// Gana Koota, normalised to 0..1.
function ganaScore(nakA, nakB) {
  const a = ganaOf(nakA), b = ganaOf(nakB);
  if (!a || !b) return null;
  if (a === b) return 1;
  const pair = [a, b].sort().join('-');
  if (pair === 'Deva-Manushya') return 5 / 6;
  if (pair === 'Deva-Rakshasa') return 1 / 6;
  if (pair === 'Manushya-Rakshasa') return 0;
  return 0.5;
}

const ELEM = {
  Aries: 'fire', Leo: 'fire', Sagittarius: 'fire', Taurus: 'earth', Virgo: 'earth', Capricorn: 'earth',
  Gemini: 'air', Libra: 'air', Aquarius: 'air', Cancer: 'water', Scorpio: 'water', Pisces: 'water'
};
function moonSignScore(a, b) {
  const ea = ELEM[a], eb = ELEM[b];
  if (!ea || !eb) return null;
  if (ea === eb) return 1;
  const complement = (ea === 'fire' && eb === 'air') || (ea === 'air' && eb === 'fire') ||
    (ea === 'earth' && eb === 'water') || (ea === 'water' && eb === 'earth');
  if (complement) return 0.85;
  const clash = (ea === 'fire' && eb === 'water') || (ea === 'water' && eb === 'fire') ||
    (ea === 'earth' && eb === 'air') || (ea === 'air' && eb === 'earth');
  return clash ? 0.35 : 0.55;
}

// Chart compatibility from gana + Moon-sign. null when either chart is absent.
function chartSubScore(inA, inB) {
  if (!inA.chart || !inB.chart) return null;
  const parts = [ganaScore(inA.chart.nakshatra, inB.chart.nakshatra), moonSignScore(inA.chart.moonSign, inB.chart.moonSign)].filter(x => x != null);
  return parts.length ? parts.reduce((s, x) => s + x, 0) / parts.length : null;
}

// Temperament fit from each person's dominant nature (chart + features merged by
// the reading engine). Difference tends to complement; sameness is fine but flatter.
function tempSubScore(inA, inB) {
  const a = reading.dominant(reading.gather(inA)).tag;
  const b = reading.dominant(reading.gather(inB)).tag;
  if (!a || !b) return null;
  return a === b ? 0.6 : 0.75;
}

// Behaviour compatibility. Pair-level engagement isn't available at this call site,
// so it degrades to neutral (never throws) — Part G's "treat as neutral" rule.
function behaviourSubScore() { return 0.5; }

// ---- engine inputs (chart on the fly; features are self-declared) ----
function inputsFor(user) {
  const chart = user && user.astrology && user.astrology.birthDate ? astro.computeChart(user.astrology) : null;
  return { chart, features: (user && user.features) || null };
}

function intentOf(user, override) { return override || (user && user.intent) || []; }

// A light, vague hint before both users are marriage-intent — plain, jargon-free.
function hintLine(inA, inB) {
  const c = chartSubScore(inA, inB);
  let line;
  if (c != null && c >= 0.7) line = 'You two share a calm, steady rhythm — worth a real conversation.';
  else if (c != null && c < 0.4) line = 'You read as quite different — that can spark, or it can rub.';
  else line = "There's enough here to be worth a proper conversation.";
  return guards.isClean(line) ? line : 'Worth a proper conversation.';
}

/**
 * @param {any} userA
 * @param {any} userB
 * @param {{ context?: { intentA?: string[], intentB?: string[] } }} [opts]
 * Returns { level:'hint', hint } until BOTH are marriage-intent, then
 * { level:'full', score, confidence, subScores, reading }.
 */
function computeCompatibility(userA, userB, { context = {} } = {}) {
  const bothMarriage = intentOf(userA, context.intentA).includes('marriage') &&
    intentOf(userB, context.intentB).includes('marriage');

  const inA = inputsFor(userA), inB = inputsFor(userB);

  // MARRIAGE GATE (enforced in the engine, not the UI): no deep reading, no
  // sub-scores, until both have chosen marriage.
  if (!bothMarriage) return { level: 'hint', hint: hintLine(inA, inB) };

  const chart = chartSubScore(inA, inB);
  const temperament = tempSubScore(inA, inB);
  const behaviour = behaviourSubScore();
  const subScores = {
    chart: chart == null ? 0.5 : chart,
    temperament: temperament == null ? 0.5 : temperament,
    behaviour
  };
  const score = Math.round(100 * (WEIGHTS.chart * subScores.chart + WEIGHTS.temperament * subScores.temperament + WEIGHTS.behaviour * subScores.behaviour));

  // Language via the guarded voice — never hand-written, never terms.
  const rd = reading.compatibility(inA, inB);
  const howYouFit = guards.enforceGentleFuture(guards.isClean(rd.answer) ? rd.answer : 'Keep talking — the honest test is how it feels.');
  const whosYourPerson = reading.discoverLine(inB) || howYouFit;

  // Confidence from how many sub-scores had REAL data (behaviour is neutral here).
  const real = (chart != null ? 1 : 0) + (temperament != null ? 1 : 0);
  const confidence = Math.max(1, Math.min(5, 1 + real * 2));

  return { level: 'full', score, confidence, subScores, reading: { how_you_fit: howYouFit, whos_your_person: whosYourPerson } };
}

// A cheap 0..1 ranking signal for the discover feed, from STORED astrology only
// (no chart recompute) so it's O(1) per candidate. Blends alongside the recommender
// — it never replaces the learned model.
function rankingSignal(me, other) {
  const a = me && me.astrology, b = other && other.astrology;
  if (!a || !b || !a.nakshatra || !b.nakshatra) return 0.5;
  const parts = [ganaScore(a.nakshatra, b.nakshatra), moonSignScore(a.rashi || a.moonSign, b.rashi || b.moonSign)].filter(x => x != null);
  return parts.length ? parts.reduce((s, x) => s + x, 0) / parts.length : 0.5;
}

module.exports = { computeCompatibility, rankingSignal, WEIGHTS, ganaScore, moonSignScore, chartSubScore };

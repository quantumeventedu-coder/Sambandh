// services/interpretation-engine.js — Batch 2: decides WHAT a chart means.
//
// Input: a computed chart (astro-engine.computeChart). Output: an array of
// structured FINDINGS — codes and parameters, never English. Batch 4 owns all
// user-facing language (and the jargon ban); if this engine emitted sentences,
// astrology jargon would leak, so meaning and wording are kept strictly separate.
//
// A finding: { topic, claim, strength, factors } where
//   topic   — one of TOPICS (self/love/marriage/career/wealth/temperament/timing)
//   claim   — a stable internal snake_case code (e.g. 'idealizes_partner')
//   strength— 1..5, from how many INDEPENDENT chart factors converge on the claim
//   factors — the chart factors (codes) that produced it, for confidence + provenance
//
// The interpretive rules apply the Batch 0 corpus to the chart — dignities and
// their life-effects, the yogas astro-engine already detects, doshas, the Moon's
// element/temperament, and the current dasha period for active themes.

const { NAKSHATRA_ATLAS } = require('../data/nakshatras');

const TOPICS = ['self', 'love', 'marriage', 'career', 'wealth', 'temperament', 'timing'];

const SIGN_ELEMENT = {
  Aries: 'fire', Leo: 'fire', Sagittarius: 'fire',
  Taurus: 'earth', Virgo: 'earth', Capricorn: 'earth',
  Gemini: 'air', Libra: 'air', Aquarius: 'air',
  Cancer: 'water', Scorpio: 'water', Pisces: 'water'
};
const BENEFIC = new Set(['Jupiter', 'Venus', 'Moon', 'Mercury']);

function ganaOf(nakshatra) {
  const e = NAKSHATRA_ATLAS.find(n => n.name === nakshatra);
  return e ? e.gana : null;
}
function hasYoga(chart, re) { return (chart.yogas || []).some(y => re.test(y.name)); }
function strong(planet) { return planet && ['own sign', 'exalted'].includes(planet.dignity); }

// One contribution = one factor supporting one (topic, claim). Many can converge.
// Each test is defensive: a missing chart field just means it doesn't fire.
const CONTRIBUTIONS = [
  // --- temperament (Moon element + gana + node period) ---
  { topic: 'temperament', claim: 'restless', factor: 'moon_fire', test: c => SIGN_ELEMENT[c.moonSign] === 'fire' },
  { topic: 'temperament', claim: 'deep', factor: 'moon_water', test: c => SIGN_ELEMENT[c.moonSign] === 'water' },
  { topic: 'temperament', claim: 'grounded', factor: 'moon_earth', test: c => SIGN_ELEMENT[c.moonSign] === 'earth' },
  { topic: 'temperament', claim: 'curious', factor: 'moon_air', test: c => SIGN_ELEMENT[c.moonSign] === 'air' },
  { topic: 'temperament', claim: 'intense', factor: 'gana_rakshasa', test: c => ganaOf(c.nakshatra) === 'Rakshasa' },
  { topic: 'temperament', claim: 'gentle', factor: 'gana_deva', test: c => ganaOf(c.nakshatra) === 'Deva' },
  { topic: 'temperament', claim: 'restless', factor: 'dasha_rahu', test: c => c.dasha?.current?.lord === 'Rahu' },
  { topic: 'temperament', claim: 'intense', factor: 'mars_moon', test: c => c.planets?.Mars?.sign != null && c.planets.Mars.sign === c.planets?.Moon?.sign },

  // --- self ---
  { topic: 'self', claim: 'needs_respect', factor: 'sun_strong', test: c => strong(c.planets?.Sun) },
  { topic: 'self', claim: 'respected_fortunate', factor: 'yoga_gajakesari', test: c => hasYoga(c, /Gaja Kesari/i) },
  { topic: 'self', claim: 'status_success', factor: 'yoga_raja', test: c => hasYoga(c, /Raja Yoga/i) },
  { topic: 'self', claim: 'sharp_minded', factor: 'yoga_budhaditya', test: c => hasYoga(c, /Budha-Aditya/i) },

  // --- marriage ---
  { topic: 'marriage', claim: 'idealizes_partner', factor: 'venus_debilitated', test: c => c.planets?.Venus?.dignity === 'debilitated' },
  { topic: 'marriage', claim: 'brings_heat', factor: 'dosha_mangal', test: c => (c.doshas || []).some(d => /Mangal/i.test(d.name)) },
  { topic: 'marriage', claim: 'slow_to_commit', factor: 'saturn_strong', test: c => strong(c.planets?.Saturn) || [1, 4, 7, 10].includes(c.planets?.Saturn?.house) },

  // --- love ---
  { topic: 'love', claim: 'gives_deeply', factor: 'moon_water', test: c => SIGN_ELEMENT[c.moonSign] === 'water' },
  { topic: 'love', claim: 'warm_affectionate', factor: 'venus_strong', test: c => strong(c.planets?.Venus) },

  // --- career ---
  { topic: 'career', claim: 'disciplined_climber', factor: 'saturn_strong', test: c => strong(c.planets?.Saturn) },
  { topic: 'career', claim: 'leads', factor: 'sun_strong', test: c => strong(c.planets?.Sun) },

  // --- wealth ---
  { topic: 'wealth', claim: 'wealth_building', factor: 'yoga_dhana', test: c => hasYoga(c, /Dhana Yoga/i) },
  { topic: 'wealth', claim: 'resourceful', factor: 'yoga_chandramangal', test: c => hasYoga(c, /Chandra-Mangal/i) },

  // --- timing (current dasha) ---
  { topic: 'timing', claim: 'open_window', factor: 'dasha_benefic', test: c => BENEFIC.has(c.dasha?.current?.lord) },
  { topic: 'timing', claim: 'inward_season', factor: 'dasha_malefic', test: c => c.dasha?.current?.lord && !BENEFIC.has(c.dasha.current.lord) }
];

// n converging factors → strength 1..5 (1 factor is weak, 3+ is strong).
function strengthFor(n) { return Math.max(1, Math.min(5, 1 + n)); }

/**
 * @param {any} chart a computeChart() result
 * @returns {Array<{ topic: string, claim: string, strength: number, factors: string[] }>}
 */
function interpret(chart) {
  if (!chart) return [];
  /** @type {Record<string, { topic: string, claim: string, factors: string[] }>} */
  const byClaim = {};
  for (const c of CONTRIBUTIONS) {
    let fired = false;
    try { fired = !!c.test(chart); } catch { fired = false; }
    if (!fired) continue;
    const key = c.topic + ':' + c.claim;
    if (!byClaim[key]) byClaim[key] = { topic: c.topic, claim: c.claim, factors: [] };
    if (!byClaim[key].factors.includes(c.factor)) byClaim[key].factors.push(c.factor);
  }
  return Object.values(byClaim)
    .map(f => ({ topic: f.topic, claim: f.claim, strength: strengthFor(f.factors.length), factors: f.factors }))
    .sort((a, b) => b.strength - a.strength || a.topic.localeCompare(b.topic) || a.claim.localeCompare(b.claim));
}

module.exports = { interpret, TOPICS, CONTRIBUTIONS };

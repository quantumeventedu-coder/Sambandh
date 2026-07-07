// services/compatibility.js — the full Sambandh compatibility formula
// (Intelligence spec §4.2). Combines Vedic astrology, psychology (attachment +
// Big Five + love language), live engagement, and karma safety into one 0–99
// score with plain-language verdict, a component breakdown, and dosha/safety
// warnings. Pure function — feed it already-computed pieces.

const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));

// ---- Attachment compatibility matrix (spec §4.2) ----
// Specific pairs first; then any pairing with Secure = 1.0; else 0.3.
function attachmentCompat(a, b) {
  const S = 'Secure', AN = 'Anxious (Preoccupied)', AV = 'Avoidant (Dismissive)', D = 'Disorganised (Fearful)';
  const key = [a, b].sort().join('|');
  const table = {
    [[AN, S].sort().join('|')]: 0.8,
    [[AN, AV].sort().join('|')]: 0.2,
    [[AV, AV].sort().join('|')]: 0.6,
    [[D, S].sort().join('|')]: 0.5
  };
  if (table[key] != null) return table[key];
  if (a === S || b === S) return 1.0;       // Secure + anything else
  return 0.3;
}

// ---- Big Five alignment: 1 − |A−B| per dimension, averaged; O & C weighted up ----
function bigFiveCompat(a, b) {
  if (!a || !b) return 0.55;
  const dims = ['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'neuroticism'];
  const w = { openness: 1.3, conscientiousness: 1.3, extraversion: 1, agreeableness: 1, neuroticism: 1 };
  let sum = 0, wsum = 0;
  for (const d of dims) {
    const av = a[d]?.score ?? 0.55, bv = b[d]?.score ?? 0.55;
    sum += (1 - Math.abs(av - bv)) * w[d];
    wsum += w[d];
  }
  return clamp(sum / wsum);
}

// ---- Love language: same 1.0, adjacent 0.7, otherwise 0.4 ----
const LOVE_ADJACENT = new Set([
  'Words of Affirmation|Quality Time', 'Physical Touch|Quality Time', 'Acts of Service|Receiving Gifts'
].map(s => s.split('|').sort().join('|')));
function loveLanguageCompat(a, b) {
  if (!a || !b) return 0.55;
  if (a === b) return 1.0;
  return LOVE_ADJACENT.has([a, b].sort().join('|')) ? 0.7 : 0.4;
}

// ---- Engagement (spec §4.2): weighted sub-scores, each 0–1 ----
function engagementScore(e) {
  if (!e) return 0.55;
  if (typeof e === 'number') return clamp(e);
  const w = { messageBalance: 0.25, responseTimeMatch: 0.20, depthAlignment: 0.25, humorAlignment: 0.15, volume: 0.15 };
  let s = 0;
  for (const k of Object.keys(w)) s += (e[k] ?? 0.55) * w[k];
  return clamp(s);
}

const GRADE_VALUE = { A: 1, B: 0.85, C: 0.6, D: 0.3, F: 0.1 };

// The full composite.
function computeCompatibility(input = {}) {
  const {
    gunaMilan = null, hasBirthTime = true,
    yoniScore = null, ganaScore = null,
    attachmentA = null, attachmentB = null,
    oceanA = null, oceanB = null,
    loveA = null, loveB = null,
    engagement = null,
    karmaGradeA = 'A', karmaGradeB = 'A', criticalFlag = false,
    sameIntent = false, sharedLanguage = false
  } = input;

  // Weights (spec §4.2). No birth time → Vedic 20%→10%, the 10% moves to engagement.
  const w = { vedic: hasBirthTime ? 0.20 : 0.10, yoni: 0.10, gana: 0.08, attachment: 0.15,
    bigfive: 0.10, love: 0.07, engagement: hasBirthTime ? 0.20 : 0.30, karma: 0.10 };

  const karmaRaw = ((GRADE_VALUE[karmaGradeA] ?? 0.6) + (GRADE_VALUE[karmaGradeB] ?? 0.6)) / 2;
  const raw = {
    vedic: gunaMilan ? clamp(gunaMilan.total / (gunaMilan.max || 36)) : 0.5,
    yoni: yoniScore != null ? clamp(yoniScore / 4) : 0.5,
    gana: ganaScore != null ? clamp(ganaScore / 6) : 0.5,
    attachment: (attachmentA && attachmentB && attachmentA !== 'Unknown' && attachmentB !== 'Unknown') ? attachmentCompat(attachmentA, attachmentB) : 0.5,
    bigfive: bigFiveCompat(oceanA, oceanB),
    love: loveLanguageCompat(loveA, loveB),
    engagement: engagementScore(engagement),
    karma: karmaRaw
  };

  const components = Object.keys(w).map(k => ({
    name: k, weight: w[k], raw: +raw[k].toFixed(3), contribution: +(w[k] * raw[k] * 100).toFixed(1)
  }));
  let base = components.reduce((s, c) => s + c.contribution, 0);   // 0–100

  // Intent + language bonus (additive, max 5%).
  let bonus = 0;
  if (sameIntent) bonus += 3;
  if (sharedLanguage) bonus += 2;
  bonus = Math.min(bonus, 5);

  let score = base + bonus;
  const warnings = [];

  // Karma safety caps (spec §4.2).
  if (criticalFlag) { score = 0; warnings.push('A critical safety flag on one profile has set this match to 0. Do not proceed without caution.'); }
  const worst = [karmaGradeA, karmaGradeB];
  if (worst.includes('D') || worst.includes('F')) {
    score = Math.min(score, 40);
    warnings.push('One profile has a low karma grade — compatibility is capped at 40% until it improves.');
  }

  // Dosha warnings from Guna Milan (always surface, regardless of total).
  if (gunaMilan?.doshas?.length) warnings.push(...gunaMilan.doshas);
  if (yoniScore != null && yoniScore <= 1) warnings.push('Very different intimate energies — approach with honesty and patience.');

  score = Math.round(clamp(score, 0, 99));   // never show 100 (spec cap at 99)

  const verdict = score >= 80 ? 'Excellent match'
    : score >= 65 ? 'Strong match'
      : score >= 50 ? 'Good potential'
        : score >= 35 ? 'Mixed — worth a careful look'
          : 'Challenging match';

  return { score, verdict, base: Math.round(base), bonus, components, warnings, weights: w };
}

module.exports = {
  computeCompatibility, attachmentCompat, bigFiveCompat, loveLanguageCompat, engagementScore, GRADE_VALUE
};

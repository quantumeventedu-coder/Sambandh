// services/reading-engine.js — turns a birth chart + self-declared features + chat
// behaviour into blunt, plain-language answers about who someone is and who fits
// them. The astrology and Samudrika logic run UNDERNEATH as the engine; the user
// never sees the machinery — no planet, sign, house, Nakshatra or Sanskrit word,
// anywhere except the dedicated Astro tab.
//
// Pipeline (deterministic; an optional guarded LLM polish is a later addition):
//   gather signals from the 3 layers → find the dominant temperament tag and how
//   many layers agree on it (= confidence) → assemble ONE plain answer to the
//   question asked → run the future + jargon guards → fall back to a clean
//   template if anything is off. Same inputs always produce the same backbone.
//
// Layers & provenance (never shown to users):
//   chart     — Brihat Hora Shastra interpretive framework  (data/reading-rules CHART_SIGNALS)
//   features  — Samudrika Lakshana, self-declared only        (FEATURE_TEMPERAMENT)
//   behaviour — the psychology engine (chat rhythm/attachment/love language)
//   voice     — Lal Kitab register: blunt, second person, one clear answer

const guards = require('./reading-guards');
const R = require('../data/reading-rules');

const LAYER_PRIORITY = { chart: 0, behaviour: 1, features: 2 };

const STYLE_TAG = {
  Secure: 'steady',
  'Anxious (Preoccupied)': 'intense',
  'Avoidant (Dismissive)': 'guarded',
  'Disorganised (Fearful)': 'intense'
};
const STYLE_WHO = {
  Secure: "You're steady in love — you can say what you feel without making it a fight.",
  'Anxious (Preoccupied)': 'You feel it fast and hard, and you need to know where you stand.',
  'Avoidant (Dismissive)': "You keep a little distance until you're sure it's safe.",
  'Disorganised (Fearful)': 'You want closeness and you brace against it, both at once.'
};
// Love language → the concrete thing "your person" does.
const LOVE_FIT = {
  'Quality Time': 'Someone who actually shows up and gives you their time.',
  'Words of Affirmation': 'Someone who says how they feel out loud, not just in their head.',
  'Acts of Service': 'Someone who shows love by doing, not only by saying.',
  'Physical Touch': 'Someone warm and physically present, not far away.',
  'Receiving Gifts': 'Someone thoughtful who remembers the little things.'
};

/**
 * @typedef {{ chart?: any, features?: Record<string,string>, behaviour?: any }} ReadingInputs
 * @typedef {{ layer: 'chart'|'features'|'behaviour', tag: string, who?: string, pattern?: string, person?: string }} Signal
 */

// Collect (layer, tag, phrase) contributions from whichever inputs are present.
/** @param {ReadingInputs} inputs @returns {Signal[]} */
function gather(inputs = {}) {
  /** @type {Signal[]} */
  const sigs = [];
  const { chart, features, behaviour } = inputs;

  if (chart) {
    for (const rule of R.CHART_SIGNALS) {
      try { if (rule.test(chart)) sigs.push({ layer: 'chart', tag: rule.tag, who: rule.who, pattern: rule.pattern, person: rule.person }); }
      catch { /* a missing chart field just means this rule doesn't fire */ }
    }
  }

  if (features && typeof features === 'object') {
    for (const [field, value] of Object.entries(features)) {
      const t = R.FEATURE_TEMPERAMENT[field] && R.FEATURE_TEMPERAMENT[field][value];
      if (t) sigs.push({ layer: 'features', tag: t.tag, who: t.phrase });
    }
  }

  if (behaviour) {
    const style = behaviour.attachment && behaviour.attachment.style;
    if (style && STYLE_TAG[style]) sigs.push({ layer: 'behaviour', tag: STYLE_TAG[style], who: STYLE_WHO[style] });
    const bf = behaviour.bigFive || {};
    const BF = { openness: 'curious', conscientiousness: 'grounded', extraversion: 'warm', agreeableness: 'gentle', neuroticism: 'intense' };
    for (const [dim, tag] of Object.entries(BF)) {
      if (bf[dim] && bf[dim].level === 'high') sigs.push({ layer: 'behaviour', tag });
    }
    const love = behaviour.loveLanguage && behaviour.loveLanguage.primary;
    if (love && LOVE_FIT[love]) sigs.push({ layer: 'behaviour', tag: 'warm', person: LOVE_FIT[love] });
  }

  return sigs;
}

// The temperament tag the most LAYERS agree on, and a 1–5 confidence from that
// agreement (3 layers → 5, 2 → 4, 1 → 2, none → 1). Deterministic tie-break by
// the TAGS order so the same inputs always yield the same result.
/** @param {Signal[]} sigs */
function dominant(sigs) {
  /** @type {Record<string, Set<string>>} */
  const byTag = {};
  for (const s of sigs) (byTag[s.tag] || (byTag[s.tag] = new Set())).add(s.layer);
  let tag = null, layers = 0;
  for (const t of R.TAGS) {
    const n = byTag[t] ? byTag[t].size : 0;
    if (n > layers) { tag = t; layers = n; }
  }
  const confidence = layers >= 3 ? 5 : layers === 2 ? 4 : layers === 1 ? 2 : 1;
  return { tag, layers, confidence };
}

// Best phrase for a field among signals carrying the dominant tag, by layer
// priority (chart > behaviour > features).
function pick(sigs, tag, field) {
  const cands = sigs.filter(s => s.tag === tag && s[field]).sort((a, b) => LAYER_PRIORITY[a.layer] - LAYER_PRIORITY[b.layer]);
  return cands.length ? cands[0][field] : null;
}

function lowerFirst(s) { return s ? s[0].toLowerCase() + s.slice(1) : s; }

// Soften a low-confidence, non-timing claim into a tentative one — stays clean and
// non-promissory.
function soften(answer) {
  if (/^someone\b/i.test(answer)) return 'Probably ' + lowerFirst(answer);
  return 'You might find that ' + lowerFirst(answer);
}

function timingAnswer(inputs) {
  const lord = inputs.chart && inputs.chart.dasha && inputs.chart.dasha.current && inputs.chart.dasha.current.lord;
  const base = !lord ? R.SAFE_FALLBACK.your_timing : (R.BENEFIC_LORDS.has(lord) ? R.TIMING.open : R.TIMING.inward);
  return guards.enforceGentleFuture(base);   // belt-and-braces: never a hard promise
}

function personAnswer(tag, sigs) {
  // Prefer the concrete, observed love-language fit (from chat) over the generic
  // tag line; then the chart's specific person line; then the canonical PERSON_FIT.
  const loveFit = (sigs.find(s => s.layer === 'behaviour' && s.person) || {}).person;
  if (loveFit) return loveFit;
  return pick(sigs, tag, 'person') || R.PERSON_FIT[tag] || R.SAFE_FALLBACK.your_person;
}

const QUESTIONS = ['who_you_are', 'your_pattern', 'your_person', 'your_timing'];

/**
 * Answer one reading question from the available layers.
 * @param {string} question one of QUESTIONS
 * @param {ReadingInputs} inputs
 * @returns {{ answer: string, confidence: number, sourceLayers: string[], question: string }}
 */
function read(question, inputs = {}) {
  const sigs = gather(inputs);
  const { tag, confidence } = dominant(sigs);
  const sourceLayers = [...new Set(sigs.map(s => s.layer))];

  let answer;
  if (question === 'your_timing') {
    answer = timingAnswer(inputs);
  } else if (!tag) {
    answer = R.SAFE_FALLBACK[question] || R.SAFE_FALLBACK.who_you_are;
  } else if (question === 'who_you_are') {
    answer = pick(sigs, tag, 'who') || (sigs.find(s => s.who) || {}).who || R.SAFE_FALLBACK.who_you_are;
  } else if (question === 'your_pattern') {
    answer = pick(sigs, tag, 'pattern') || R.SAFE_FALLBACK.your_pattern;
  } else if (question === 'your_person') {
    answer = personAnswer(tag, sigs);
  } else {
    answer = R.SAFE_FALLBACK[question] || R.SAFE_FALLBACK.who_you_are;
  }

  // Low-confidence, non-timing claims are softened (spec: one layer → "you might find…").
  if (confidence <= 2 && question !== 'your_timing' && tag) answer = soften(answer);

  // Final safety net: no jargon ever reaches the user. Templates are authored
  // clean, so this only fires if something upstream (later: the LLM polish) slips.
  if (!guards.isClean(answer)) {
    console.warn('[reading] jargon in output, falling back to template', { question });
    answer = R.SAFE_FALLBACK[question] || R.SAFE_FALLBACK.who_you_are;
  }

  return { answer, confidence, sourceLayers, question };
}

// All four self readings at once (profile / Me tab).
/** @param {ReadingInputs} inputs */
function readAll(inputs = {}) {
  const out = {};
  for (const q of QUESTIONS) out[q] = read(q, inputs);
  return out;
}

// One short nature line for a discover card. Never jargon.
/** @param {ReadingInputs} inputs */
function discoverLine(inputs = {}) {
  const { tag } = dominant(gather(inputs));
  const line = (tag && R.DISCOVER_LINE[tag]) || 'Warm and direct';
  return guards.isClean(line) ? line : 'Warm and direct';
}

// Pre-intent chat: a vague hint only — the short label, nothing deep.
/** @param {ReadingInputs} inputs */
function chatHint(inputs = {}) { return discoverLine(inputs); }

function compatLine(aTag, bTag, score) {
  const a = R.TAG_ADJ[aTag] || 'steady', b = R.TAG_ADJ[bTag] || 'steady';
  let verdict;
  if (score == null) verdict = 'Keep talking — the honest test is how it feels, not a number.';
  else if (score >= 65) verdict = 'That balances well — you pull each other toward the middle.';
  else if (score >= 50) verdict = "There's real potential here if you both stay honest.";
  else verdict = "You're different in ways that can rub or complement — go in with eyes open.";
  return `You're ${a}. They're ${b}. ${verdict}`;
}

/**
 * Deeper reading for a specific pair (unlocked once both set intent to marriage).
 * @param {ReadingInputs} aInputs @param {ReadingInputs} bInputs
 */
function compatibility(aInputs = {}, bInputs = {}) {
  const aTag = dominant(gather(aInputs)).tag || 'steady';
  const bTag = dominant(gather(bInputs)).tag || 'steady';
  let score = null;
  if (aInputs.chart && bInputs.chart) {
    try { score = require('./astro-engine').relationshipCompat(aInputs.chart, bInputs.chart, 'romance').score; }
    catch { /* no birth time etc. → fall back to tag-only line */ }
  }
  let answer = compatLine(aTag, bTag, score);
  if (!guards.isClean(answer)) answer = R.SAFE_FALLBACK.compatibility;
  const confidence = score != null ? (score >= 65 ? 4 : 3) : 2;
  return { answer, confidence, sourceLayers: ['chart'], question: 'compatibility' };
}

module.exports = {
  read, readAll, discoverLine, chatHint, compatibility,
  QUESTIONS, gather, dominant   // exported for tests
};

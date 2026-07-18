// services/reading-guards.js — the two safety validators the reading engine runs
// on EVERY user-facing string. Pure functions, no I/O, so they're trivially and
// exhaustively testable. They encode the feature's two non-negotiable rules:
//
//   1. NO astrology jargon reaches a user outside the dedicated Astro tab. A user
//      with zero interest in astrology must understand every string and feel it is
//      about them — not read a horoscope printout. A banned term = the string is
//      unsafe; the engine must fall back to its deterministic template version.
//
//   2. The future is never stated as certain. Identity/temperament/pattern claims
//      may be firm (the engine genuinely supports them from data). Timing/future
//      claims must be windows and tendencies — the difference between a feature
//      that delights for years and a consumer-protection complaint the first time
//      a predicted month passes with nothing happening.
//
// This is a safety net, not the source of truth: authored template phrases are
// clean by construction (a test asserts it), and the LLM polish pass is discarded
// whenever it trips these. Nothing here is shown to users.

// ---------------------------------------------------------------------------
// 1. Jargon
// ---------------------------------------------------------------------------
// Banned outside the Astro tab: planet names used as explanation, sign names
// (English + Vedic), house references, all 27 Nakshatra names, and the Sanskrit
// vocabulary of the craft. Word-boundaried so ordinary English isn't caught.
const BANNED = [
  // grahas (planets)
  /\b(sun|moon|mars|mercury|jupiter|venus|saturn|rahu|ketu)\b/i,
  // signs — English
  /\b(aries|taurus|gemini|cancer|leo|virgo|libra|scorpio|sagittarius|capricorn|aquarius|pisces)\b/i,
  // signs — Vedic (rashi names)
  /\b(mesha|vrishabha|mithuna|karka|simha|kanya|tula|vrischika|dhanu|makara|kumbha|meena)\b/i,
  // houses
  /\b\d+\s*(st|nd|rd|th)\s+house\b/i,
  /\bhouse\s+(1[0-2]|[1-9])\b/i,
  // the 27 Nakshatras
  /\b(ashwini|bharani|krittika|rohini|mrigashira|ardra|punarvasu|pushya|ashlesha|magha|purva\s+phalguni|uttara\s+phalguni|hasta|chitra|swati|vishakha|anuradha|jyeshtha|mula|purva\s+ashadha|uttara\s+ashadha|shravana|dhanishta|shatabhisha|purva\s+bhadrapada|uttara\s+bhadrapada|revati)\b/i,
  // Sanskrit / craft vocabulary
  /\b(guna|dosha|dasha|antardasha|mahadasha|lagna|ascendant|mangal|manglik|rashi|kundali|kundli|horoscope|natal\s+chart|nakshatra|pada|graha|navamsa|dasamsa|ayanamsa|gochar|transit|sade\s*sati|kaal\s+sarp|yoni|gana|nadi|bhakoot|varna|vashya|tithi|panchang|muhurta|vedic|zodiac)\b/i,
  // reasoning tells — the machinery must never show
  /\bbecause your chart\b/i,
  /\baccording to your (chart|stars|birth)\b/i,
  /\byour (chart|stars|placement|planets)\b/i
];

// Returns the first banned fragment found, or null if the string is clean.
function findJargon(text) {
  const s = String(text == null ? '' : text);
  for (const re of BANNED) { const m = s.match(re); if (m) return m[0]; }
  return null;
}

function isClean(text) { return findJargon(text) === null; }

// ---------------------------------------------------------------------------
// 2. Future tense
// ---------------------------------------------------------------------------
// A "hard future" claim sitting near a time reference is a promise. Identity
// claims (You are…) carry no time reference, so they're never flagged — only the
// combination is. Gentle forms ("the next few months are open") carry no
// hard-future word, so they pass unchanged.
const HARD_FUTURE = /\b(will|won'?t|going\s+to|gonna|shall|destined|fated|guaranteed|guarantee|sure\s+to|bound\s+to)\b/i;
const TIME_REF = /\b(today|tomorrow|tonight|soon|next\s+(few\s+)?(day|days|week|weeks|month|months|year|years)|this\s+(week|month|year)|coming\s+(week|weeks|month|months|year|years)|(in|within)\s+(a|the|\d+)\s+(day|days|week|weeks|month|months|year|years)|by\s+(january|february|march|april|may|june|july|august|september|october|november|december|next\b)|the\s+future|ahead|the\s+months?\s+ahead)\b/i;

// True when the text promises the future (a hard-future word AND a time reference).
function hardFutureViolation(text) {
  const s = String(text == null ? '' : text);
  return HARD_FUTURE.test(s) && TIME_REF.test(s);
}

// Rewrite hard-future words into window/tendency language. Order matters
// (multi-word phrases before single words).
function softenFuture(text) {
  return String(text == null ? '' : text)
    .replace(/\b(destined|fated)\s+to\b/gi, 'well-placed to')
    .replace(/\bgoing\s+to\b/gi, 'likely to')
    .replace(/\bgonna\b/gi, 'likely to')
    .replace(/\bsure\s+to\b/gi, 'likely to')
    .replace(/\bbound\s+to\b/gi, 'likely to')
    .replace(/\bguaranteed\b/gi, 'likely')
    .replace(/\bguarantee\b/gi, 'good chance')
    .replace(/\bwon'?t\b/gi, 'may not')
    .replace(/\bwill\b/gi, 'may')
    .replace(/\bshall\b/gi, 'may');
}

// The one to call on any timing/future string: if it promises, soften it until it
// no longer does. Returns the safe string (unchanged when already gentle).
function enforceGentleFuture(text) {
  let s = String(text == null ? '' : text);
  if (hardFutureViolation(s)) s = softenFuture(s);
  return s;
}

module.exports = {
  BANNED, findJargon, isClean,
  HARD_FUTURE, TIME_REF, hardFutureViolation, softenFuture, enforceGentleFuture
};

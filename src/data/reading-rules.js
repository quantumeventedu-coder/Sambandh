// data/reading-rules.js — the rule tables the reading engine assembles into
// plain-language answers. NONE of these strings contains astrology vocabulary;
// the reading-guards jargon check runs over every one of them in tests.
//
// Provenance (cited for the engineers, NEVER shown to a user):
//   Layer 2 — WHAT to say: the classical interpretive framework of Brihat Hora
//     Shastra (planetary natures, house meanings, dosha effects). CHART_SIGNALS
//     encode that logic as predicates over the computed chart.
//   Layer 3 — temperament from self-declared features: Samudrika Lakshana. Each
//     feature the user picks maps to a temperament contribution. NEVER inferred
//     from a photo or measurement — self-declared only.
//   Layer 4 — the VOICE: Lal Kitab / Arun Samhita. Blunt, practical, second
//     person, one clear answer. Every phrase below copies that register.
//
// Each contribution carries a canonical TAG. The engine measures how many of the
// three layers land on the same tag → that agreement is the confidence.

// Small, shared vocabulary of temperament tags so chart, features and behaviour
// can agree with each other.
const TAGS = ['restless', 'grounded', 'intense', 'deep', 'warm', 'steady',
  'guarded', 'curious', 'idealises', 'slow-warm', 'proud', 'gentle', 'reliable', 'creative'];

// Moon-sign element → emotional rhythm (English sign names are internal only).
const SIGN_ELEMENT = {
  Aries: 'fire', Leo: 'fire', Sagittarius: 'fire',
  Taurus: 'earth', Virgo: 'earth', Capricorn: 'earth',
  Gemini: 'air', Libra: 'air', Aquarius: 'air',
  Cancer: 'water', Scorpio: 'water', Pisces: 'water'
};

// ---------------------------------------------------------------------------
// Layer 2 — chart signals (Brihat Hora framework). Each: a predicate on the
// computed chart + a canonical tag + one plain phrase per reading question.
// ---------------------------------------------------------------------------
const CHART_SIGNALS = [
  {
    id: 'heat', tag: 'intense',
    // Mars-in-sensitive-house effect (Mangal): brings force to relationships.
    test: c => (c.doshas || []).some(d => /Mangal/i.test(d.name)),
    who: 'You bring heat to a relationship — intensity, not lukewarm.',
    pattern: "With the wrong person that heat turns to friction. With the right one it's passion.",
    person: "Someone calm and steady who doesn't flinch when you get intense."
  },
  {
    id: 'idealises', tag: 'idealises',
    // Weak-Venus effect: an exacting inner picture of the ideal partner.
    test: c => c.planets?.Venus?.dignity === 'debilitated',
    who: 'You hold a picture of the right person so clearly that real people get measured against it.',
    pattern: 'Real people get measured against that picture and fall short.',
    person: 'Someone secure enough that you can finally put the checklist down.'
  },
  {
    id: 'moonFire', tag: 'restless',
    test: c => SIGN_ELEMENT[c.moonSign] === 'fire',
    who: 'You get restless when things settle into routine.',
    pattern: 'You chase the spark and go cool when it turns ordinary.',
    person: 'Someone who keeps life moving without keeping you off balance.'
  },
  {
    id: 'moonWater', tag: 'deep',
    test: c => SIGN_ELEMENT[c.moonSign] === 'water',
    who: 'You feel things deeply and you remember everything.',
    pattern: "You give a lot, and you quietly keep score when it isn't returned.",
    person: "Someone warm and consistent who never makes you guess where you stand."
  },
  {
    id: 'moonEarth', tag: 'grounded',
    test: c => SIGN_ELEMENT[c.moonSign] === 'earth',
    who: "You're steady, and you build things to last.",
    pattern: 'You open slowly, and people read that as cold before they read it as safe.',
    person: 'Someone patient who earns their way in and stays.'
  },
  {
    id: 'moonAir', tag: 'curious',
    test: c => SIGN_ELEMENT[c.moonSign] === 'air',
    who: 'You live in your head and you love a good back-and-forth.',
    pattern: 'You can talk around a feeling instead of landing on it.',
    person: "Someone easy to talk to who gently pins you down."
  },
  {
    id: 'saturnSteady', tag: 'slow-warm',
    // Strong-Saturn effect: slow to commit, then durable.
    test: c => ['own sign', 'exalted'].includes(c.planets?.Saturn?.dignity) ||
      [1, 4, 7, 10].includes(c.planets?.Saturn?.house),
    who: 'You warm up slowly and commit hard once you do.',
    pattern: 'People mistake your caution for disinterest early on.',
    person: 'Someone patient enough to wait out your slow start.'
  },
  {
    id: 'sunProud', tag: 'proud',
    test: c => ['own sign', 'exalted'].includes(c.planets?.Sun?.dignity),
    who: 'You need to be respected, not managed.',
    pattern: 'You pull back the moment you feel handled.',
    person: 'Someone who leads with respect and never talks down to you.'
  },
  {
    id: 'rahuRestless', tag: 'restless',
    // Current major period run by the restless, forward-driving influence.
    test: c => c.dasha?.current?.lord === 'Rahu',
    who: "You're chasing something bigger right now and you can't sit still for long.",
    pattern: 'You outgrow things fast, people included, when they stop moving with you.',
    person: 'Someone secure enough not to be threatened by your ambition.'
  }
];

// ---------------------------------------------------------------------------
// Layer 3 — Samudrika Lakshana. Self-declared feature → temperament tag + phrase.
// The engine never derives these from a photo (enforced by a grep test).
// ---------------------------------------------------------------------------
const FEATURE_TEMPERAMENT = {
  forehead: {
    broad: { tag: 'curious', phrase: 'You think in wide open questions, not narrow ones.' },
    high: { tag: 'deep', phrase: 'You live a lot in your own head.' },
    narrow: { tag: 'grounded', phrase: 'You lock onto one thing and finish it.' },
    even: { tag: 'steady', phrase: 'You keep an even keel when things wobble.' }
  },
  eyes: {
    large: { tag: 'warm', phrase: 'You feel things openly — people can read you.' },
    sharp: { tag: 'intense', phrase: "You read people fast and you don't miss much." },
    soft: { tag: 'warm', phrase: 'You put people at ease without trying.' },
    deepset: { tag: 'guarded', phrase: 'You watch first and let people in slowly.' }
  },
  voice: {
    deep: { tag: 'grounded', phrase: 'People settle down when you speak.' },
    quick: { tag: 'restless', phrase: 'Your mind runs ahead of the room.' },
    soft: { tag: 'gentle', phrase: 'You lower the temperature in a tense moment.' },
    clear: { tag: 'proud', phrase: 'You say the thing straight, no wrapping.' }
  },
  gait: {
    fast: { tag: 'restless', phrase: 'You move quick and you hate waiting.' },
    measured: { tag: 'grounded', phrase: "You don't rush, and you rarely trip." },
    light: { tag: 'warm', phrase: 'You carry an easy, unbothered energy.' },
    firm: { tag: 'steady', phrase: 'You plant your feet and hold your ground.' }
  },
  hands: {
    long: { tag: 'creative', phrase: 'You make and build things with your hands and mind.' },
    broad: { tag: 'grounded', phrase: 'You are practical and you fix what breaks.' },
    fine: { tag: 'deep', phrase: 'You notice the small details other people walk past.' },
    square: { tag: 'reliable', phrase: 'You do what you say you will do.' }
  },
  build: {
    solid: { tag: 'grounded', phrase: 'You are hard to knock off balance.' },
    lean: { tag: 'restless', phrase: 'You run on nervous energy and momentum.' },
    balanced: { tag: 'steady', phrase: 'You pace yourself and last the distance.' },
    sturdy: { tag: 'reliable', phrase: 'People lean on you and you hold.' }
  }
};

// Person-fit line by the reader's dominant tag (who fits this kind of person).
const PERSON_FIT = {
  restless: 'Someone steady who grounds you without slowing you down.',
  grounded: 'Someone warm who draws you out and makes you laugh.',
  intense: "Someone calm and steady who doesn't flinch when you get intense.",
  deep: 'Someone warm and consistent who never makes you guess where you stand.',
  warm: 'Someone reliable who matches how much you give.',
  steady: 'Someone with a bit of spark who keeps things from going flat.',
  guarded: "Someone patient who earns their way in and doesn't push.",
  curious: 'Someone easy to talk to who gently pins you down.',
  idealises: 'Someone secure enough that you can put the checklist down.',
  'slow-warm': 'Someone patient enough to wait out your slow start.',
  proud: 'Someone who leads with respect and never manages you.',
  gentle: 'Someone kind who protects your softness instead of testing it.',
  reliable: 'Someone who values that you show up — and shows up back.',
  creative: 'Someone who gives you room to make things and roots to come home to.'
};

// One short nature label for a discover card, by dominant tag.
const DISCOVER_LINE = {
  restless: 'Restless, chases the spark', grounded: 'Grounded, warms up slowly',
  intense: "Intense — all-in when it's right", deep: 'Deep, feels everything',
  warm: 'Warm, gives a lot', steady: 'Steady and easy to be around',
  guarded: 'Guarded, opens slowly', curious: 'Curious, lives in ideas',
  idealises: 'Holds a high bar', 'slow-warm': 'Slow to open, loyal after',
  proud: 'Proud, needs respect', gentle: 'Gentle and kind',
  reliable: 'Reliable — does what they say', creative: 'Creative and a maker'
};

// Adjective form of a tag, for compatibility lines.
const TAG_ADJ = {
  restless: 'restless and driven', grounded: 'grounded and steady',
  intense: 'intense and all-in', deep: 'deep and feeling', warm: 'warm and giving',
  steady: 'steady and easy', guarded: 'guarded and careful', curious: 'curious and heady',
  idealises: 'exacting about the right person', 'slow-warm': 'slow to open but loyal',
  proud: 'proud and self-respecting', gentle: 'gentle and kind',
  reliable: 'reliable and solid', creative: 'creative and restless-minded'
};

// Gentle timing windows — NEVER a hard promise. The engine also runs these through
// enforceGentleFuture as a belt-and-braces guard.
const TIMING = {
  open: 'The next while is unusually open for you — say yes more than you normally would.',
  inward: 'This is more of an inward season — a good time to get clear on what you actually want before you chase it.',
  steady: 'Nothing is forcing your hand right now — you can take your time and choose well.'
};
// Benefic-run period → open; harder-run period → inward. (Internal planet grouping.)
const BENEFIC_LORDS = new Set(['Jupiter', 'Venus', 'Moon', 'Mercury']);

// Clean, generic fallbacks when a layer is missing — never jargon, never a promise.
const SAFE_FALLBACK = {
  who_you_are: "You're direct, you feel things honestly, and you've no patience for fake.",
  your_pattern: "You give a lot when you're in — and you notice when it isn't matched.",
  your_person: 'Someone steady, warm and honest who meets you where you are.',
  your_timing: 'A good time to get clear on what you actually want.',
  compatibility: 'You two could work — the honest way to find out is to keep talking.'
};

module.exports = {
  TAGS, SIGN_ELEMENT, CHART_SIGNALS, FEATURE_TEMPERAMENT, PERSON_FIT,
  DISCOVER_LINE, TAG_ADJ, TIMING, BENEFIC_LORDS, SAFE_FALLBACK
};

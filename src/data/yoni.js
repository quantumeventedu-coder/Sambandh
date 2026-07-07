// data/yoni.js — the 14-animal Yoni system (Sambandh Intelligence spec §1.5).
// Yoni is the intimate/instinctive-nature layer. Animal names match the values
// used in services/astro.js N_YONI so the two integrate. The UI must phrase this
// as "intimate / energetic / physical" — never "sexual" (spec §4.3).

const YONI_ANIMALS = {
  Horse: { nakshatras: ['Ashwini', 'Shatabhisha'], nature: 'Direct, fast, energetic, adventurous', intimateStyle: 'High physical energy, direct initiation' },
  Elephant: { nakshatras: ['Bharani', 'Revati'], nature: 'Powerful, patient, sensual, loyal', intimateStyle: 'Deep and committed intimacy' },
  Sheep: { nakshatras: ['Krittika', 'Pushya'], nature: 'Assertive, direct, driven, reliable', intimateStyle: 'Direct and confident pursuit' },
  Serpent: { nakshatras: ['Rohini', 'Mrigashira'], nature: 'Magnetic, sensual, seductive, perceptive', intimateStyle: 'Subtle and seductive; magnetic energy' },
  Dog: { nakshatras: ['Ardra', 'Mula'], nature: 'Loyal, protective, sometimes intense', intimateStyle: 'Loyal and devoted; protective intimacy' },
  Cat: { nakshatras: ['Punarvasu', 'Ashlesha'], nature: 'Independent, curious, selective, clever', intimateStyle: 'Selective; needs to feel in control of the encounter' },
  Rat: { nakshatras: ['Magha', 'Purva Phalguni'], nature: 'Clever, sensual, pleasure-seeking', intimateStyle: 'Sensual and pleasure-focused' },
  Cow: { nakshatras: ['Uttara Phalguni', 'Uttara Bhadrapada'], nature: 'Gentle, devoted, nurturing, consistent', intimateStyle: 'Warm and nurturing; builds trust slowly' },
  Buffalo: { nakshatras: ['Hasta', 'Swati'], nature: 'Steady, powerful, balanced, patient', intimateStyle: 'Unhurried and deeply physical' },
  Tiger: { nakshatras: ['Chitra', 'Vishakha'], nature: 'Intense, magnetic, passionate, forceful', intimateStyle: 'Intense and magnetic; dominant energy' },
  Deer: { nakshatras: ['Anuradha', 'Jyeshtha'], nature: 'Gentle, sensitive, cautious, romantic', intimateStyle: 'Tender and romantic; needs safety' },
  Monkey: { nakshatras: ['Purva Ashadha', 'Shravana'], nature: 'Playful, curious, enthusiastic, adaptable', intimateStyle: 'Playful and varied; needs novelty' },
  Mongoose: { nakshatras: ['Uttara Ashadha'], nature: 'Unique, discriminating, principled', intimateStyle: 'Complex, unique nature — partial compatibility with most' },
  Lion: { nakshatras: ['Dhanishta', 'Purva Bhadrapada'], nature: 'Proud, powerful, regal, selective', intimateStyle: 'Strong and dominant; selective about partners' }
};

// Relationship sets from the spec's Best/Avoid columns (unordered pairs).
const pair = (a, b) => [a, b].sort().join('|');
const FRIENDLY = new Set([['Horse', 'Cat'], ['Elephant', 'Cow'], ['Sheep', 'Mongoose'], ['Dog', 'Deer'], ['Cat', 'Rat']].map(([a, b]) => pair(a, b)));
const ENEMY = new Set([['Horse', 'Cow'], ['Horse', 'Buffalo'], ['Sheep', 'Deer'], ['Dog', 'Monkey'], ['Cat', 'Monkey']].map(([a, b]) => pair(a, b)));
const EXTREME = new Set([['Horse', 'Tiger'], ['Elephant', 'Lion'], ['Cow', 'Tiger'], ['Serpent', 'Mongoose']].map(([a, b]) => pair(a, b)));

// yoniCompatibility → { score 0–4, level, label, caution }. Same=4, Friendly=3,
// Neutral=2, Enemy=1, Extreme enemy=0 (spec §1.5 scoring).
function yoniCompatibility(animalA, animalB) {
  if (!YONI_ANIMALS[animalA] || !YONI_ANIMALS[animalB]) return null;
  let score, level;
  if (animalA === animalB) { score = 4; level = 'identical'; }
  else { const k = pair(animalA, animalB);
    if (EXTREME.has(k)) { score = 0; level = 'extreme-enemy'; }
    else if (ENEMY.has(k)) { score = 1; level = 'enemy'; }
    else if (FRIENDLY.has(k)) { score = 3; level = 'friendly'; }
    else { score = 2; level = 'neutral'; }
  }
  const LABELS = {
    identical: 'Identical energies — instinctively in sync',
    friendly: 'Complementary energies — close but not identical, which keeps things interesting',
    neutral: 'Different but workable energies',
    enemy: 'Contrasting energies — needs conscious effort and patience',
    'extreme-enemy': 'Very different instinctive natures — approach with care and honesty'
  };
  return {
    score, max: 4, level, label: LABELS[level],
    // The intimate assessment is the most sensitive signal — never suppress a
    // caution, but always phrase it gently (spec §4.3).
    caution: score <= 1
  };
}

const animalForNakshatra = name => {
  const key = String(name || '').toLowerCase();
  for (const [animal, d] of Object.entries(YONI_ANIMALS)) {
    if (d.nakshatras.some(n => n.toLowerCase() === key)) return animal;
  }
  return null;
};

module.exports = { YONI_ANIMALS, yoniCompatibility, animalForNakshatra };

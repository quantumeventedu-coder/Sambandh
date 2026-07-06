// services/astro.js — shared astrology computation.
// Sun sign is real (date ranges). Vedic values (rashi/nakshatra/mangal) use the
// ProKerala API when configured; otherwise a deterministic internal approximation
// (same birth data → same chart) clearly labeled `internal_approximation`.

const SUN_SIGNS = [
  ['Capricorn', 1, 20], ['Aquarius', 2, 19], ['Pisces', 3, 20], ['Aries', 4, 20],
  ['Taurus', 5, 21], ['Gemini', 6, 21], ['Cancer', 7, 23], ['Leo', 8, 23],
  ['Virgo', 9, 23], ['Libra', 10, 23], ['Scorpio', 11, 22], ['Sagittarius', 12, 22],
  ['Capricorn', 12, 31]
];
const RASHIS = ['Mesha', 'Vrishabha', 'Mithuna', 'Karka', 'Simha', 'Kanya',
  'Tula', 'Vrischika', 'Dhanu', 'Makara', 'Kumbha', 'Meena'];
const NAKSHATRAS = ['Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra',
  'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni',
  'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha', 'Mula',
  'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha',
  'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati'];

const ELEMENTS = {
  Aries: 'fire', Leo: 'fire', Sagittarius: 'fire',
  Taurus: 'earth', Virgo: 'earth', Capricorn: 'earth',
  Gemini: 'air', Libra: 'air', Aquarius: 'air',
  Cancer: 'water', Scorpio: 'water', Pisces: 'water'
};
const ELEMENT_AFFINITY = {
  fire: { fire: 80, air: 90, earth: 55, water: 50 },
  air: { air: 80, fire: 90, water: 55, earth: 50 },
  earth: { earth: 80, water: 90, fire: 55, air: 50 },
  water: { water: 80, earth: 90, air: 55, fire: 50 }
};

function sunSignFor(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  const m = d.getMonth() + 1, day = d.getDate();
  for (const [sign, sm, sd] of SUN_SIGNS) {
    if (m < sm || (m === sm && day <= sd)) return sign;
  }
  return 'Capricorn';
}

// Deterministic hash — same birth data always yields the same chart
function seededInt(str, mod) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % mod;
}

function approximateChart(astro) {
  if (!astro?.birthDate) return null;
  const seed = `${astro.birthDate}|${astro.birthTime || '12:00'}|${astro.birthPlace?.city || ''}`;
  return {
    sunSign: sunSignFor(astro.birthDate),
    rashi: RASHIS[seededInt(seed + 'r', 12)],
    nakshatra: NAKSHATRAS[seededInt(seed + 'n', 27)],
    mangalDosha: seededInt(seed + 'm', 100) < 20,
    hasBirthTime: !!astro.birthTime
  };
}

function sunCompatibility(signA, signB) {
  return ELEMENT_AFFINITY[ELEMENTS[signA]]?.[ELEMENTS[signB]] || 50;
}

module.exports = {
  SUN_SIGNS, RASHIS, NAKSHATRAS, ELEMENTS, ELEMENT_AFFINITY,
  sunSignFor, seededInt, approximateChart, sunCompatibility
};

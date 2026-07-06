// services/astro.js — Vedic astrology.
//
// Two real algorithms, no external API required for either:
//  1. moonPosition(): the Moon's SIDEREAL ecliptic longitude from birth date/time
//     via the standard mean-longitude formula + principal equation of centre,
//     minus the Lahiri ayanamsa → Moon rashi (sign) and nakshatra. This is a
//     genuine astronomical approximation (labelled), not a hash. When
//     PROKERALA_CLIENT_ID is configured, routes-compat uses the exact API chart.
//  2. gunaMilan(): the classical ASHTAKOOT 36-point compatibility system — all
//     eight kootas (Varna 1, Vashya 2, Tara 3, Yoni 4, Graha Maitri 5, Gana 6,
//     Bhakoot 7, Nadi 8) with the traditional lookup tables and dosha rules.

const SUN_SIGNS = [
  ['Capricorn', 1, 20], ['Aquarius', 2, 19], ['Pisces', 3, 20], ['Aries', 4, 20],
  ['Taurus', 5, 21], ['Gemini', 6, 21], ['Cancer', 7, 23], ['Leo', 8, 23],
  ['Virgo', 9, 23], ['Libra', 10, 23], ['Scorpio', 11, 22], ['Sagittarius', 12, 22],
  ['Capricorn', 12, 31]
];
const RASHIS = ['Mesha', 'Vrishabha', 'Mithuna', 'Karka', 'Simha', 'Kanya',
  'Tula', 'Vrischika', 'Dhanu', 'Makara', 'Kumbha', 'Meena'];
const RASHIS_EN = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
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
  for (const [sign, sm, sd] of SUN_SIGNS) if (m < sm || (m === sm && day <= sd)) return sign;
  return 'Capricorn';
}
function sunCompatibility(a, b) { return ELEMENT_AFFINITY[ELEMENTS[a]]?.[ELEMENTS[b]] || 50; }

// ---------------------------------------------------------------------------
//  1. Moon position (sidereal) — real astronomy, approximate but not a hash
// ---------------------------------------------------------------------------
const DEG = Math.PI / 180;
const norm360 = x => ((x % 360) + 360) % 360;

function julianDay(y, m, d, hourUT) {
  if (m <= 2) { y -= 1; m += 12; }
  const A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5 + hourUT / 24;
}

// Moon's tropical longitude via mean longitude + the largest periodic terms
// (Meeus, low precision — good to ~0.3°, far better than integer-nakshatra needs).
function moonTropicalLongitude(jd) {
  const T = (jd - 2451545.0) / 36525;
  const Lp = 218.3164477 + 481267.88123421 * T - 0.0015786 * T * T;   // mean longitude
  const D = 297.8501921 + 445267.1114034 * T;                         // mean elongation
  const M = 357.5291092 + 35999.0502909 * T;                          // sun mean anomaly
  const Mp = 134.9633964 + 477198.8675055 * T;                        // moon mean anomaly
  const F = 93.2720950 + 483202.0175233 * T;                          // argument of latitude
  const lon = Lp
    + 6.288774 * Math.sin(Mp * DEG)
    + 1.274027 * Math.sin((2 * D - Mp) * DEG)
    + 0.658314 * Math.sin(2 * D * DEG)
    + 0.213618 * Math.sin(2 * Mp * DEG)
    - 0.185116 * Math.sin(M * DEG)
    - 0.114332 * Math.sin(2 * F * DEG);
  return norm360(lon);
}

// Lahiri ayanamsa (deg): ≈ 23.85° at 1950, precessing ~50.29″/yr.
function lahiriAyanamsa(jd) {
  const yr = 2000 + (jd - 2451545.0) / 365.25;
  return 23.85 + (yr - 1950) * (50.29 / 3600);
}

// { longitude(sidereal), rashiIndex 0-11, nakshatraIndex 0-26, pada 1-4 }
function moonPosition(birthDate, birthTime) {
  if (!birthDate) return null;
  const d = new Date(birthDate);
  if (isNaN(d)) return null;
  const [hh, mm] = String(birthTime || '12:00').split(':').map(Number);
  // Treat given local time as IST (birthPlace is India); convert to UT.
  const hourUT = ((hh || 12) + (mm || 0) / 60) - 5.5;
  const jd = julianDay(d.getFullYear(), d.getMonth() + 1, d.getDate(), hourUT);
  const sidereal = norm360(moonTropicalLongitude(jd) - lahiriAyanamsa(jd));
  return {
    longitude: +sidereal.toFixed(3),
    rashiIndex: Math.floor(sidereal / 30),
    nakshatraIndex: Math.floor(sidereal / (360 / 27)),
    pada: Math.floor((sidereal % (360 / 27)) / (360 / 108)) + 1
  };
}

function chartFor(astro) {
  if (!astro?.birthDate) return null;
  const mp = moonPosition(astro.birthDate, astro.birthTime);
  if (!mp) return null;
  return {
    sunSign: sunSignFor(astro.birthDate),
    rashiIndex: mp.rashiIndex,
    rashi: RASHIS[mp.rashiIndex],
    rashiEn: RASHIS_EN[mp.rashiIndex],
    nakshatraIndex: mp.nakshatraIndex,
    nakshatra: NAKSHATRAS[mp.nakshatraIndex],
    pada: mp.pada,
    moonLongitude: mp.longitude,
    hasBirthTime: !!astro.birthTime
  };
}

// ---------------------------------------------------------------------------
//  2. Ashtakoot Guna Milan — classical 36-point tables
// ---------------------------------------------------------------------------

// Per-nakshatra attributes (index 0-26 aligned to NAKSHATRAS)
const N_YONI = ['Horse', 'Elephant', 'Sheep', 'Serpent', 'Serpent', 'Dog', 'Cat', 'Sheep', 'Cat',
  'Rat', 'Rat', 'Cow', 'Buffalo', 'Tiger', 'Buffalo', 'Tiger', 'Deer', 'Deer', 'Dog',
  'Monkey', 'Mongoose', 'Monkey', 'Lion', 'Horse', 'Lion', 'Cow', 'Elephant'];
const N_GANA = [0, 1, 2, 1, 0, 1, 0, 0, 2, 2, 1, 1, 0, 2, 0, 2, 0, 2, 2, 1, 1, 0, 2, 2, 1, 1, 0]; // 0 Deva 1 Manushya 2 Rakshasa
const N_NADI = [0, 1, 2, 2, 1, 0, 0, 1, 2, 2, 1, 0, 0, 1, 2, 2, 0, 0, 0, 1, 2, 2, 1, 0, 0, 1, 2]; // 0 Aadi 1 Madhya 2 Antya

// Yoni: same=4, sworn-enemy pairs=0, otherwise neutral=2 (the enemy dosha is the load-bearing rule)
const YONI_ENEMIES = [['Horse', 'Buffalo'], ['Elephant', 'Lion'], ['Sheep', 'Monkey'],
  ['Serpent', 'Mongoose'], ['Dog', 'Deer'], ['Cat', 'Rat'], ['Cow', 'Tiger']];
function yoniPoints(nA, nB) {
  const yA = N_YONI[nA], yB = N_YONI[nB];
  if (yA === yB) return 4;
  if (YONI_ENEMIES.some(([x, y]) => (x === yA && y === yB) || (x === yB && y === yA))) return 0;
  return 2;
}

// Gana: rows/cols 0 Deva 1 Manushya 2 Rakshasa (boy = first index)
const GANA_MATRIX = [[6, 5, 1], [6, 6, 0], [1, 0, 6]];
function ganaPoints(nBoy, nGirl) { return GANA_MATRIX[N_GANA[nBoy]][N_GANA[nGirl]]; }

// Nadi: same nadi → 0 (dosha), different → 8
function nadiPoints(nA, nB) { return N_NADI[nA] === N_NADI[nB] ? 0 : 8; }

// Bhakoot (rashi count both ways): dosha pairs {6,8},{5,9},{2,12} → 0 else 7
function bhakootPoints(rA, rB) {
  const d1 = ((rB - rA + 12) % 12) + 1, d2 = ((rA - rB + 12) % 12) + 1;
  const bad = (a, b) => (d1 === a && d2 === b) || (d1 === b && d2 === a);
  return (bad(6, 8) || bad(5, 9) || bad(2, 12)) ? 0 : 7;
}

// Varna by rashi element: Brahmin 4 (water) > Kshatriya 3 (fire) > Vaishya 2 (earth) > Shudra 1 (air)
const VARNA_BY_ELEMENT = { water: 4, fire: 3, earth: 2, air: 1 };
function varnaRank(rIdx) { return VARNA_BY_ELEMENT[ELEMENTS[RASHIS_EN[rIdx]]]; }
function varnaPoints(rBoy, rGirl) { return varnaRank(rBoy) >= varnaRank(rGirl) ? 1 : 0; }

// Vashya groups: 0 Chatushpada 1 Nara 2 Jalachar 3 Vanachara 4 Keeta
const RASHI_VASHYA = [0, 0, 1, 2, 3, 1, 1, 4, 1, 2, 1, 2]; // Aries..Pisces
// Boy-group × girl-group vashya points (max 2); same group = 2, controllable = 1, prey = 0.5, else 1
const VASHYA_MATRIX = [
  //        Chatush Nara Jala Vana Keeta   (girl)
  /*Chatush*/[2, 1, 1, 0.5, 1],
  /*Nara   */[1, 2, 1, 0, 1],
  /*Jala   */[1, 1, 2, 1, 0.5],
  /*Vana   */[1, 0.5, 1, 2, 1],
  /*Keeta  */[0.5, 1, 1, 1, 2]
];
function vashyaPoints(rBoy, rGirl) { return VASHYA_MATRIX[RASHI_VASHYA[rBoy]][RASHI_VASHYA[rGirl]]; }

// Tara/Dina: count nakshatra both ways, remainder mod 9; even remainder = auspicious → 1.5 each
function taraPoints(nBoy, nGirl) {
  const dir = (from, to) => (((((to - from + 27) % 27) + 1) % 9) % 2 === 0 ? 1.5 : 0);
  return dir(nGirl, nBoy) + dir(nBoy, nGirl);
}

// Graha Maitri: moon-sign lords' mutual friendship (max 5)
const RASHI_LORD = ['Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury',
  'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter'];
const FRIENDS = {
  Sun: ['Moon', 'Mars', 'Jupiter'], Moon: ['Sun', 'Mercury'], Mars: ['Sun', 'Moon', 'Jupiter'],
  Mercury: ['Sun', 'Venus'], Jupiter: ['Sun', 'Moon', 'Mars'], Venus: ['Mercury', 'Saturn'],
  Saturn: ['Mercury', 'Venus']
};
const ENEMIES = {
  Sun: ['Venus', 'Saturn'], Moon: [], Mars: ['Mercury'], Mercury: ['Moon'],
  Jupiter: ['Mercury', 'Venus'], Venus: ['Sun', 'Moon'], Saturn: ['Sun', 'Moon', 'Mars']
};
function rel(a, b) { return FRIENDS[a]?.includes(b) ? 'friend' : ENEMIES[a]?.includes(b) ? 'enemy' : 'neutral'; }
function grahaMaitriPoints(rA, rB) {
  const la = RASHI_LORD[rA], lb = RASHI_LORD[rB];
  if (la === lb) return 5;
  const key = [rel(la, lb), rel(lb, la)].sort().join('-');
  return ({ 'friend-friend': 5, 'friend-neutral': 4, 'neutral-neutral': 3,
    'enemy-friend': 1, 'enemy-neutral': 0.5, 'enemy-enemy': 0 })[key] ?? 3;
}

// Full 36-point compatibility. `boy`/`girl` are chartFor() results; if genders are
// unknown the assignment only affects the (minor) Varna/Vashya/Gana ordering.
function gunaMilan(boy, girl) {
  const b = { r: boy.rashiIndex, n: boy.nakshatraIndex };
  const g = { r: girl.rashiIndex, n: girl.nakshatraIndex };
  const breakdown = {
    varna: { got: varnaPoints(b.r, g.r), max: 1 },
    vashya: { got: vashyaPoints(b.r, g.r), max: 2 },
    tara: { got: taraPoints(b.n, g.n), max: 3 },
    yoni: { got: yoniPoints(b.n, g.n), max: 4 },
    grahaMaitri: { got: grahaMaitriPoints(b.r, g.r), max: 5 },
    gana: { got: ganaPoints(b.n, g.n), max: 6 },
    bhakoot: { got: bhakootPoints(b.r, g.r), max: 7 },
    nadi: { got: nadiPoints(b.n, g.n), max: 8 }
  };
  const total = +Object.values(breakdown).reduce((s, k) => s + k.got, 0).toFixed(1);
  const doshas = [];
  if (breakdown.nadi.got === 0) doshas.push('Nadi dosha (same nadi — health/progeny concern)');
  if (breakdown.bhakoot.got === 0) doshas.push('Bhakoot dosha (unfavourable rashi placement)');
  if (breakdown.gana.got <= 1) doshas.push('Gana dosha (temperament mismatch)');
  const verdict = total >= 32 ? 'Excellent match'
    : total >= 25 ? 'Very good match'
      : total >= 18 ? 'Acceptable match'
        : 'Challenging match';
  return { total, max: 36, percent: Math.round((total / 36) * 100), breakdown, doshas, verdict };
}

module.exports = {
  SUN_SIGNS, RASHIS, RASHIS_EN, NAKSHATRAS, ELEMENTS, ELEMENT_AFFINITY,
  sunSignFor, sunCompatibility, moonPosition, chartFor, gunaMilan
};

// services/astro-engine.js — a REAL, deterministic Vedic astrology engine.
//
// Computes geocentric sidereal positions of all nine grahas (Schlyter's
// low-precision method, good to ~1° — ample for sign/nakshatra placement),
// the Lagna (ascendant) when birth time + place are known, whole-sign houses,
// planetary dignity (exalt/debil/own/combust/retrograde), key Yogas, Doshas,
// the full Vimshottari Dasha timeline, and numerology. No external API.
//
// This is the computational "knowledge" layer. Interpretive/AI commentary is
// layered on top (routes-astro) and clearly labelled as interpretation.

const { NAKSHATRA_ATLAS } = require('../data/nakshatras');

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;
const norm360 = x => ((x % 360) + 360) % 360;
const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
const SIGNS_VEDIC = ['Mesha', 'Vrishabha', 'Mithuna', 'Karka', 'Simha', 'Kanya', 'Tula', 'Vrischika', 'Dhanu', 'Makara', 'Kumbha', 'Meena'];
const NAK = NAKSHATRA_ATLAS.map(n => n.name);

// ---- time ----
function julianDay(date, hourUT) {
  let y = date.getUTCFullYear(), m = date.getUTCMonth() + 1;
  const d = date.getUTCDate();
  if (m <= 2) { y -= 1; m += 12; }
  const A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5 + (hourUT || 0) / 24;
}
// Lahiri ayanamsa (deg)
function ayanamsa(jd) { const yr = 2000 + (jd - 2451545.0) / 365.25; return 23.85 + (yr - 1950) * (50.29 / 3600); }

// ---- Schlyter orbital elements (d = days since 2000 Jan 0.0 = JD 2451543.5) ----
const ELEMENTS = {
  Sun: d => ({ N: 0, i: 0, w: 282.9404 + 4.70935e-5 * d, a: 1, e: 0.016709 - 1.151e-9 * d, M: 356.0470 + 0.9856002585 * d }),
  Mercury: d => ({ N: 48.3313 + 3.24587e-5 * d, i: 7.0047 + 5.00e-8 * d, w: 29.1241 + 1.01444e-5 * d, a: 0.387098, e: 0.205635 + 5.59e-10 * d, M: 168.6562 + 4.0923344368 * d }),
  Venus: d => ({ N: 76.6799 + 2.46590e-5 * d, i: 3.3946 + 2.75e-8 * d, w: 54.8910 + 1.38374e-5 * d, a: 0.723330, e: 0.006773 - 1.302e-9 * d, M: 48.0052 + 1.6021302244 * d }),
  Mars: d => ({ N: 49.5574 + 2.11081e-5 * d, i: 1.8497 - 1.78e-8 * d, w: 286.5016 + 2.92961e-5 * d, a: 1.523688, e: 0.093405 + 2.516e-9 * d, M: 18.6021 + 0.5240207766 * d }),
  Jupiter: d => ({ N: 100.4542 + 2.76854e-5 * d, i: 1.3030 - 1.557e-7 * d, w: 273.8777 + 1.64505e-5 * d, a: 5.20256, e: 0.048498 + 4.469e-9 * d, M: 19.8950 + 0.0830853001 * d }),
  Saturn: d => ({ N: 113.6634 + 2.38980e-5 * d, i: 2.4886 - 1.081e-7 * d, w: 339.3939 + 2.97661e-5 * d, a: 9.55475, e: 0.055546 - 9.499e-9 * d, M: 316.9670 + 0.0334442282 * d })
};

// Sun's geocentric rectangular ecliptic coords + longitude
function sunRect(d) {
  const e = ELEMENTS.Sun(d);
  const M = norm360(e.M) * DEG, w = norm360(e.w) * DEG;
  const E = M + e.e * Math.sin(M) * (1 + e.e * Math.cos(M));
  const xv = Math.cos(E) - e.e, yv = Math.sqrt(1 - e.e * e.e) * Math.sin(E);
  const v = Math.atan2(yv, xv), r = Math.sqrt(xv * xv + yv * yv);
  const lon = v + w;
  return { x: r * Math.cos(lon), y: r * Math.sin(lon), lon: norm360(lon * RAD), r };
}

// Geocentric tropical ecliptic longitude of a planet
function planetTropical(name, d) {
  if (name === 'Sun') return sunRect(d).lon;
  const el = ELEMENTS[name](d);
  const N = norm360(el.N) * DEG, i = el.i * DEG, w = norm360(el.w) * DEG, M = norm360(el.M) * DEG, e = el.e, a = el.a;
  let E = M + e * Math.sin(M) * (1 + e * Math.cos(M));
  for (let k = 0; k < 2; k++) E = E - (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  const xv = a * (Math.cos(E) - e), yv = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const v = Math.atan2(yv, xv), r = Math.sqrt(xv * xv + yv * yv);
  // heliocentric ecliptic
  const xh = r * (Math.cos(N) * Math.cos(v + w) - Math.sin(N) * Math.sin(v + w) * Math.cos(i));
  const yh = r * (Math.sin(N) * Math.cos(v + w) + Math.cos(N) * Math.sin(v + w) * Math.cos(i));
  const s = sunRect(d);   // add Sun's geocentric = -Earth's heliocentric
  return norm360(Math.atan2(yh + s.y, xh + s.x) * RAD);
}

// Moon (Meeus low precision), tropical geocentric longitude
function moonTropical(jd) {
  const T = (jd - 2451545.0) / 36525;
  const Lp = 218.3164477 + 481267.88123421 * T;
  const D = 297.8501921 + 445267.1114034 * T;
  const M = 357.5291092 + 35999.0502909 * T;
  const Mp = 134.9633964 + 477198.8675055 * T;
  const F = 93.2720950 + 483202.0175233 * T;
  const lon = Lp + 6.288774 * Math.sin(Mp * DEG) + 1.274027 * Math.sin((2 * D - Mp) * DEG)
    + 0.658314 * Math.sin(2 * D * DEG) + 0.213618 * Math.sin(2 * Mp * DEG)
    - 0.185116 * Math.sin(M * DEG) - 0.114332 * Math.sin(2 * F * DEG);
  return norm360(lon);
}
// Mean lunar node (Rahu), tropical
function rahuTropical(jd) { const T = (jd - 2451545.0) / 36525; return norm360(125.0445479 - 1934.1362891 * T); }

// ---- dignity tables (sign indices 0=Aries) ----
const EXALT = { Sun: 0, Moon: 1, Mars: 9, Mercury: 5, Jupiter: 3, Venus: 11, Saturn: 6 };
const DEBIL = { Sun: 6, Moon: 7, Mars: 3, Mercury: 11, Jupiter: 9, Venus: 5, Saturn: 0 };
const OWN = { Sun: [4], Moon: [3], Mars: [0, 7], Mercury: [2, 5], Jupiter: [8, 11], Venus: [1, 6], Saturn: [9, 10], Rahu: [], Ketu: [] };
const COMBUST_DEG = { Moon: 12, Mars: 17, Mercury: 14, Jupiter: 11, Venus: 10, Saturn: 15 };

function placement(siderealLon) {
  const sign = Math.floor(siderealLon / 30);
  const nakIdx = Math.floor(siderealLon / (360 / 27));
  const pada = Math.floor((siderealLon % (360 / 27)) / (360 / 108)) + 1;
  return { longitude: +siderealLon.toFixed(2), sign, signName: SIGNS[sign], rashi: SIGNS_VEDIC[sign], degInSign: +(siderealLon % 30).toFixed(2), nakshatra: NAK[nakIdx], nakshatraIndex: nakIdx, pada };
}

function dignity(name, sign) {
  if (EXALT[name] === sign) return 'exalted';
  if (DEBIL[name] === sign) return 'debilitated';
  if ((OWN[name] || []).includes(sign)) return 'own sign';
  return 'neutral';
}

// ---- Ascendant (Lagna) ----
function ascendant(jd, lat, lng) {
  if (lat == null || lng == null) return null;
  const T = (jd - 2451545.0) / 36525;
  let gmst = 280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * T * T;
  gmst = norm360(gmst);
  const lst = norm360(gmst + lng);            // local sidereal time (deg)
  const eps = (23.4392911 - 0.0130042 * T) * DEG;
  const ramc = lst * DEG, l = lat * DEG;
  let asc = Math.atan2(Math.cos(ramc), -(Math.sin(ramc) * Math.cos(eps) + Math.tan(l) * Math.sin(eps))) * RAD;
  asc = norm360(asc);
  return norm360(asc - ayanamsa(jd));         // sidereal ascendant
}

// ---- the full chart ----
function computeChart(astro) {
  if (!astro || !astro.birthDate) return null;
  const [hh, mm] = String(astro.birthTime || '12:00').split(':').map(Number);
  const date = new Date(astro.birthDate + 'T00:00:00Z');
  if (isNaN(date)) return null;
  const hasBirthTime = !!astro.birthTime;
  const hourUT = ((hh || 12) + (mm || 0) / 60) - 5.5;   // treat local time as IST
  const jd = julianDay(date, hourUT);
  const d = jd - 2451543.5;
  const ay = ayanamsa(jd);

  const lat = astro.birthPlace?.lat, lng = astro.birthPlace?.lng;
  const ascLon = hasBirthTime ? ascendant(jd, lat, lng) : null;
  const lagnaSign = ascLon != null ? Math.floor(ascLon / 30) : null;

  const bodies = {};
  const rawTropical = {
    Sun: planetTropical('Sun', d), Moon: moonTropical(jd), Mars: planetTropical('Mars', d),
    Mercury: planetTropical('Mercury', d), Jupiter: planetTropical('Jupiter', d),
    Venus: planetTropical('Venus', d), Saturn: planetTropical('Saturn', d)
  };
  const rahuT = rahuTropical(jd);
  rawTropical.Rahu = rahuT; rawTropical.Ketu = norm360(rahuT + 180);

  const sunSid = norm360(rawTropical.Sun - ay);
  for (const name of ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu']) {
    const sid = norm360(rawTropical[name] - ay);
    const p = placement(sid);
    // retrograde: finite-difference of geocentric longitude (nodes always retro; luminaries never)
    let retro = false;
    if (['Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'].includes(name)) {
      const l2 = norm360(planetTropical(name, d + 1) - ay);
      let dl = l2 - sid; if (dl > 180) dl -= 360; if (dl < -180) dl += 360;
      retro = dl < 0;
    } else if (name === 'Rahu' || name === 'Ketu') retro = true;
    // combustion: within threshold of the Sun (not for Sun/nodes)
    let combust = false;
    if (COMBUST_DEG[name]) { let sep = Math.abs(sid - sunSid); if (sep > 180) sep = 360 - sep; combust = sep < COMBUST_DEG[name]; }
    const house = lagnaSign != null ? ((p.sign - lagnaSign + 12) % 12) + 1 : null;   // whole-sign
    bodies[name] = {
      ...p, dignity: dignity(name, p.sign), retrograde: retro, combust, house,
      navamsa: SIGNS[navamsaSign(sid)], dasamsa: SIGNS[dasamsaSign(sid)]   // D9 / D10 signs
    };
  }

  const moon = bodies.Moon;
  const chart = {
    ayanamsa: +ay.toFixed(3), hasBirthTime,
    lagna: ascLon != null ? { ...placement(ascLon) } : null,
    chandraLagna: { sign: moon.sign, rashi: moon.rashi, signName: moon.signName },
    sunSign: bodies.Sun.signName, moonSign: moon.signName, moonRashi: moon.rashi,
    nakshatra: moon.nakshatra, nakshatraPada: moon.pada,
    planets: bodies
  };
  chart.yogas = detectYogas(chart);
  chart.doshas = detectDoshas(chart);
  chart.dasha = vimshottari(moon.longitude, date);
  return chart;
}

// ---- Yogas (rule-based on the computed chart) ----
function detectYogas(chart) {
  const P = chart.planets, out = [];
  const anchor = chart.lagna ? chart.lagna.sign : P.Moon.sign;   // from lagna if known, else Moon
  const houseFrom = (planet) => ((P[planet].sign - anchor + 12) % 12) + 1;

  // Gaja Kesari — Jupiter in a kendra (1/4/7/10) from the Moon
  const jFromMoon = ((P.Jupiter.sign - P.Moon.sign + 12) % 12) + 1;
  if ([1, 4, 7, 10].includes(jFromMoon)) out.push({ name: 'Gaja Kesari Yoga', kind: 'raj', detail: 'Jupiter sits in a kendra from the Moon — associated with wisdom, respect and lasting good fortune.' });

  // Budha-Aditya — Sun and Mercury in the same sign
  if (P.Sun.sign === P.Mercury.sign && !P.Mercury.combust) out.push({ name: 'Budha-Aditya Yoga', kind: 'intellect', detail: 'Sun with an uncombust Mercury — sharp intellect and communication.' });
  else if (P.Sun.sign === P.Mercury.sign) out.push({ name: 'Budha-Aditya (Mercury combust)', kind: 'intellect', detail: 'Sun with Mercury, but Mercury is combust — intellect is strong yet can be overshadowed by ego.' });

  // Chandra-Mangal — Moon and Mars together
  if (P.Moon.sign === P.Mars.sign) out.push({ name: 'Chandra-Mangal Yoga', kind: 'wealth', detail: 'Moon with Mars — drive and resourcefulness, often linked to earning capacity.' });

  // Pancha Mahapurusha — Mars/Mercury/Jupiter/Venus/Saturn in own/exalted sign AND in a kendra (from lagna)
  const MAHA = { Mars: 'Ruchaka', Mercury: 'Bhadra', Jupiter: 'Hamsa', Venus: 'Malavya', Saturn: 'Sasa' };
  if (chart.lagna) {
    for (const pl of Object.keys(MAHA)) {
      const h = houseFrom(pl), dig = P[pl].dignity;
      if ([1, 4, 7, 10].includes(h) && (dig === 'own sign' || dig === 'exalted')) {
        out.push({ name: `${MAHA[pl]} Yoga (Pancha Mahapurusha)`, kind: 'mahapurusha', detail: `${pl} is ${dig} in a kendra — a Mahapurusha yoga conferring standout ${pl === 'Jupiter' ? 'wisdom' : pl === 'Venus' ? 'charm and comfort' : pl === 'Mars' ? 'courage' : pl === 'Mercury' ? 'intelligence' : 'discipline'}.` });
      }
    }
  }
  return out;
}

// ---- Doshas ----
function detectDoshas(chart) {
  const P = chart.planets, out = [];
  // Mangal (Manglik) — Mars in 1,2,4,7,8,12 from lagna / Moon / Venus
  const refs = { lagna: chart.lagna ? chart.lagna.sign : null, Moon: P.Moon.sign, Venus: P.Venus.sign };
  const bad = [1, 2, 4, 7, 8, 12];
  const from = [];
  for (const [k, sign] of Object.entries(refs)) {
    if (sign == null) continue;
    const h = ((P.Mars.sign - sign + 12) % 12) + 1;
    if (bad.includes(h)) from.push(k);
  }
  if (from.length) out.push({ name: 'Mangal Dosha (Manglik)', severity: from.length >= 2 ? 'strong' : 'mild', detail: `Mars falls in a sensitive house from ${from.join(', ')}. Traditionally advised to match with a similarly-placed partner; often cancelled by other factors.` });

  // Kaal Sarp — every planet between Rahu and Ketu (one hemisphere)
  const rahu = P.Rahu.longitude, ketu = P.Ketu.longitude;
  const between = (lon) => { const a = norm360(lon - rahu), span = norm360(ketu - rahu); return a > 0 && a < span; };
  const others = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'].map(n => P[n].longitude);
  const allOne = others.every(between) || others.every(l => !between(l));
  if (allOne) out.push({ name: 'Kaal Sarp Dosha', severity: 'moderate', detail: 'All planets fall on one side of the Rahu–Ketu axis — intensity and delays early on, often easing with age; many notable charts have it.' });

  // Kemadruma — no planet (except Sun/nodes) in 2nd/12th from the Moon and none with the Moon
  const nearMoon = ['Sun', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'].some(n => {
    const h = ((P[n].sign - P.Moon.sign + 12) % 12); return h === 0 || h === 1 || h === 11;
  });
  if (!nearMoon) out.push({ name: 'Kemadruma Dosha', severity: 'mild', detail: 'The Moon is unsupported by neighbouring planets — can indicate emotional ups and downs; readily mitigated by a strong Moon or aspects.' });

  return out;
}

// ---- Vimshottari Dasha ----
const DASHA_ORDER = ['Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury'];
const DASHA_YEARS = { Ketu: 7, Venus: 20, Sun: 6, Moon: 10, Mars: 7, Rahu: 18, Jupiter: 16, Saturn: 19, Mercury: 17 };
const YEAR_MS = 365.25 * 86400000;
function vimshottari(moonLon, birthDate) {
  const nakSpan = 360 / 27;
  const nakIdx = Math.floor(moonLon / nakSpan);
  const posInNak = (moonLon % nakSpan) / nakSpan;          // 0..1 through the nakshatra
  const startLordIdx = nakIdx % 9;
  const firstLord = DASHA_ORDER[startLordIdx];
  const balance = (1 - posInNak) * DASHA_YEARS[firstLord]; // years left of the first mahadasha

  const periods = [];
  let t = new Date(birthDate).getTime() - (DASHA_YEARS[firstLord] - balance) * YEAR_MS; // dasha "start" before birth
  for (let k = 0; k < 9; k++) {
    const lord = DASHA_ORDER[(startLordIdx + k) % 9];
    const yrs = DASHA_YEARS[lord];
    const start = new Date(t), end = new Date(t + yrs * YEAR_MS);
    periods.push({ lord, years: yrs, start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) });
    t += yrs * YEAR_MS;
  }
  const now = Date.now();
  const current = periods.find(p => new Date(p.start) <= now && now < new Date(p.end)) || null;
  // Antardasha (sub-period) within the current mahadasha
  let antar = null;
  if (current) {
    const mdStart = new Date(current.start).getTime(), mdYrs = current.years;
    let at = mdStart, li = DASHA_ORDER.indexOf(current.lord);
    for (let k = 0; k < 9; k++) {
      const sub = DASHA_ORDER[(li + k) % 9];
      const subYrs = mdYrs * DASHA_YEARS[sub] / 120;
      const s = at, e = at + subYrs * YEAR_MS;
      if (s <= now && now < e) { antar = { lord: sub, start: new Date(s).toISOString().slice(0, 10), end: new Date(e).toISOString().slice(0, 10) }; break; }
      at = e;
    }
  }
  return { startNakshatra: NAK[nakIdx], balanceYears: +balance.toFixed(2), periods, current: current ? { ...current, antardasha: antar } : null };
}

// ---- Numerology (Pythagorean) ----
const PYTHAG = { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, h: 8, i: 9, j: 1, k: 2, l: 3, m: 4, n: 5, o: 6, p: 7, q: 8, r: 9, s: 1, t: 2, u: 3, v: 4, w: 5, x: 6, y: 7, z: 8 };
const reduce = n => { while (n > 9 && n !== 11 && n !== 22 && n !== 33) n = String(n).split('').reduce((s, x) => s + +x, 0); return n; };
function numerology(name, dob) {
  const out = {};
  if (dob) out.lifePath = reduce(String(dob).replace(/\D/g, '').split('').reduce((s, x) => s + +x, 0));
  if (name) {
    const letters = name.toLowerCase().replace(/[^a-z]/g, '').split('');
    const vowels = 'aeiou';
    out.destiny = reduce(letters.reduce((s, c) => s + (PYTHAG[c] || 0), 0));
    out.soul = reduce(letters.filter(c => vowels.includes(c)).reduce((s, c) => s + (PYTHAG[c] || 0), 0));
    out.personality = reduce(letters.filter(c => !vowels.includes(c)).reduce((s, c) => s + (PYTHAG[c] || 0), 0));
  }
  return out;
}

// ---- Divisional charts (Vargas) ----
// Navamsa (D9): 9 parts of 3°20'. The continuous formula reproduces the classic
// movable/fixed/dual starting-sign rule.
function navamsaSign(L) { return Math.floor(L / (30 / 9)) % 12; }
// Dasamsa (D10): 10 parts of 3°. Odd signs start from the same sign, even signs
// from the 9th.
function dasamsaSign(L) { const s = Math.floor(L / 30), div = Math.floor((L % 30) / 3); return s % 2 === 0 ? (s + div) % 12 : (s + 8 + div) % 12; }

// ---- Transits (Gochar) ----
function currentSidereal(date = new Date()) {
  const jd = julianDay(new Date(date.toISOString().slice(0, 10) + 'T00:00:00Z'), date.getUTCHours() + date.getUTCMinutes() / 60);
  const d = jd - 2451543.5, ay = ayanamsa(jd);
  const pos = { Moon: norm360(moonTropical(jd) - ay) };
  for (const n of ['Sun', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn']) pos[n] = norm360(planetTropical(n, d) - ay);
  const rahu = norm360(rahuTropical(jd) - ay); pos.Rahu = rahu; pos.Ketu = norm360(rahu + 180);
  return pos;
}
function transits(natalChart, date = new Date()) {
  const cur = currentSidereal(date);
  const moonSign = natalChart.planets.Moon.sign;
  const lagnaSign = natalChart.lagna ? natalChart.lagna.sign : null;
  const positions = {};
  for (const [n, lon] of Object.entries(cur)) {
    const sign = Math.floor(lon / 30);
    positions[n] = { signName: SIGNS[sign], degInSign: +(lon % 30).toFixed(1), houseFromMoon: ((sign - moonSign + 12) % 12) + 1, houseFromLagna: lagnaSign != null ? ((sign - lagnaSign + 12) % 12) + 1 : null };
  }
  const satH = positions.Saturn.houseFromMoon;
  return {
    date: date.toISOString().slice(0, 10), positions,
    sadeSati: [12, 1, 2].includes(satH),
    sadeSatiNote: [12, 1, 2].includes(satH) ? `Saturn transits the ${satH === 12 ? '12th (rising)' : satH === 1 ? '1st (peak)' : '2nd (setting)'} from your Moon — the Sade Sati period, a demanding-but-maturing phase.` : 'Not in Sade Sati.',
    jupiterHouseFromMoon: positions.Jupiter.houseFromMoon
  };
}

// ---- Relationship compatibility by lens (romance / friendship / business) ----
const ELEM = ['fire', 'earth', 'air', 'water', 'fire', 'earth', 'air', 'water', 'fire', 'earth', 'air', 'water'];
const ELEM_AFF = { fire: { fire: .8, air: .9, earth: .55, water: .5 }, air: { air: .8, fire: .9, water: .55, earth: .5 }, earth: { earth: .8, water: .9, fire: .55, air: .5 }, water: { water: .8, earth: .9, air: .55, fire: .5 } };
const RLORD = ['Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter'];
const PFRIEND = { Sun: ['Moon', 'Mars', 'Jupiter'], Moon: ['Sun', 'Mercury'], Mars: ['Sun', 'Moon', 'Jupiter'], Mercury: ['Sun', 'Venus'], Jupiter: ['Sun', 'Moon', 'Mars'], Venus: ['Mercury', 'Saturn'], Saturn: ['Mercury', 'Venus'] };
function lordFriend(a, b) { if (a === b) return 1; const af = PFRIEND[a]?.includes(b), bf = PFRIEND[b]?.includes(a); if (af && bf) return 1; if (af || bf) return 0.7; return 0.3; }
function ganaOf(nak) { const e = NAKSHATRA_ATLAS.find(n => n.name === nak); return e ? e.gana : 'Manushya'; }

function relationshipCompat(a, b, type = 'romance') {
  const ms = a.planets.Moon.sign, os = b.planets.Moon.sign;
  let yoni = 0.5;
  try { const { animalForNakshatra, yoniCompatibility } = require('../data/yoni'); const y = yoniCompatibility(animalForNakshatra(a.nakshatra), animalForNakshatra(b.nakshatra)); if (y) yoni = y.score / 4; } catch { /* optional */ }
  const gA = ganaOf(a.nakshatra), gB = ganaOf(b.nakshatra);
  const F = {
    moon: { s: ELEM_AFF[ELEM[ms]][ELEM[os]], note: 'Emotional rhythm (Moon signs)' },
    sun: { s: ELEM_AFF[ELEM[a.planets.Sun.sign]][ELEM[b.planets.Sun.sign]], note: 'Identity & drive (Sun signs)' },
    mercury: { s: ELEM_AFF[ELEM[a.planets.Mercury.sign]][ELEM[b.planets.Mercury.sign]], note: 'Communication (Mercury)' },
    grahaMaitri: { s: lordFriend(RLORD[ms], RLORD[os]), note: 'Mental rapport (Moon lords)' },
    gana: { s: gA === gB ? 1 : ((gA === 'Deva' && gB === 'Rakshasa') || (gA === 'Rakshasa' && gB === 'Deva')) ? 0.2 : 0.6, note: 'Temperament (Gana)' },
    yoni: { s: yoni, note: 'Intimate energy (Yoni)' }
  };
  const WEIGHTS = {
    romance: { moon: .28, yoni: .2, gana: .15, grahaMaitri: .15, sun: .12, mercury: .1 },
    friendship: { gana: .3, moon: .25, grahaMaitri: .2, mercury: .15, sun: .1 },
    business: { grahaMaitri: .3, mercury: .25, gana: .2, sun: .15, moon: .1 }
  };
  const w = WEIGHTS[type] || WEIGHTS.romance;
  let score = 0, tot = 0; const factors = [];
  for (const [k, wt] of Object.entries(w)) { score += F[k].s * wt; tot += wt; factors.push({ name: k, score: Math.round(F[k].s * 100), weight: Math.round(wt * 100), note: F[k].note }); }
  score = Math.round(clamp(score / tot) * 100);
  factors.sort((x, y) => y.weight - x.weight);
  return { type, score, verdict: score >= 80 ? 'Excellent' : score >= 65 ? 'Strong' : score >= 50 ? 'Good' : score >= 35 ? 'Mixed' : 'Challenging', factors };
}

// ---- Panchang (today's Vedic calendar) ----
const TITHIS = ['Pratipada', 'Dwitiya', 'Tritiya', 'Chaturthi', 'Panchami', 'Shashthi', 'Saptami', 'Ashtami', 'Navami', 'Dashami', 'Ekadashi', 'Dwadashi', 'Trayodashi', 'Chaturdashi', 'Purnima'];
const YOGAS27 = ['Vishkambha', 'Priti', 'Ayushman', 'Saubhagya', 'Shobhana', 'Atiganda', 'Sukarma', 'Dhriti', 'Shula', 'Ganda', 'Vriddhi', 'Dhruva', 'Vyaghata', 'Harshana', 'Vajra', 'Siddhi', 'Vyatipata', 'Variyana', 'Parigha', 'Shiva', 'Siddha', 'Sadhya', 'Shubha', 'Shukla', 'Brahma', 'Indra', 'Vaidhriti'];
const KARANAS = ['Bava', 'Balava', 'Kaulava', 'Taitila', 'Gara', 'Vanija', 'Vishti'];
const VARAS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function panchang(date = new Date()) {
  const jd = julianDay(new Date(date.toISOString().slice(0, 10) + 'T00:00:00Z'), date.getUTCHours() + date.getUTCMinutes() / 60);
  const d = jd - 2451543.5, ay = ayanamsa(jd);
  const sun = norm360(planetTropical('Sun', d) - ay);
  const moon = norm360(moonTropical(jd) - ay);
  const diff = norm360(moon - sun);
  const tithiNum = Math.floor(diff / 12);                 // 0..29
  const paksha = tithiNum < 15 ? 'Shukla' : 'Krishna';
  const tName = tithiNum === 14 ? 'Purnima' : tithiNum === 29 ? 'Amavasya' : TITHIS[tithiNum % 15];
  return {
    date: date.toISOString().slice(0, 10),
    vara: VARAS[date.getUTCDay()], paksha, tithi: tName,
    nakshatra: NAK[Math.floor(moon / (360 / 27))],
    yoga: YOGAS27[Math.floor(norm360(sun + moon) / (360 / 27)) % 27],
    karana: KARANAS[Math.floor(diff / 6) % 7],
    sunLongitude: +sun.toFixed(2), moonLongitude: +moon.toFixed(2)
  };
}

module.exports = { computeChart, numerology, panchang, transits, relationshipCompat, SIGNS, NAK, placement, ascendant, vimshottari };

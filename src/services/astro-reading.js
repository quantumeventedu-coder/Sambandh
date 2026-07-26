// @ts-check
// services/astro-reading.js — a DETAILED, deterministic classical reading of a
// computed chart. No AI, no third party: it applies standard Jyotish significations
// (planet karakas, house bhavas, dignity, dasha) to the positions the astro-engine
// already computed. Everything is presented as traditional interpretation (a belief
// system), never as fact or professional advice.

/** @type {Record<string,string>} */
const SIGN_TRAITS = {
  Aries: 'bold and pioneering', Taurus: 'steady and grounded', Gemini: 'curious and communicative',
  Cancer: 'nurturing and intuitive', Leo: 'confident and warm', Virgo: 'analytical and precise',
  Libra: 'harmonious and relational', Scorpio: 'intense and transformative', Sagittarius: 'philosophical and free',
  Capricorn: 'disciplined and ambitious', Aquarius: 'independent and unconventional', Pisces: 'compassionate and imaginative'
};
/** @type {Record<string,string>} */
const PLANET_SIG = {
  Sun: 'vitality, confidence and the father', Moon: 'the mind, emotions and the mother',
  Mars: 'energy, courage and drive', Mercury: 'intellect, speech and commerce',
  Jupiter: 'wisdom, growth and fortune', Venus: 'love, beauty and relationships',
  Saturn: 'discipline, patience and karma', Rahu: 'ambition and worldly desire', Ketu: 'detachment and spirituality'
};
/** @type {Record<number,string>} */
const HOUSE_THEME = {
  1: 'self and vitality', 2: 'wealth, family and speech', 3: 'courage, effort and siblings',
  4: 'home, mother and inner peace', 5: 'creativity, romance and children', 6: 'health, work and obstacles',
  7: 'marriage and partnership', 8: 'transformation and the hidden', 9: 'fortune, dharma and higher learning',
  10: 'career, status and public life', 11: 'gains, networks and aspirations', 12: 'release, retreat and the spiritual'
};
/** @type {Record<string,string>} */
const DIGNITY_NOTE = {
  exalted: ', and is exalted here — a strong, favourable placement',
  debilitated: ', though debilitated here — its results reward conscious effort',
  'own sign': ', in its own sign — comfortable and effective'
};

/** @param {number} n */
function ordinal(n) { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }

/**
 * A structured, detailed reading. @param {any} chart
 * @returns {{ sections:{title:string,text:string}[], disclaimer:string }}
 */
function detailedReading(chart) {
  const P = (chart && chart.planets) || {};
  /** @type {{title:string,text:string}[]} */ const sections = [];

  if (chart && chart.lagna && chart.lagna.signName) {
    sections.push({ title: 'Ascendant (Lagna)', text: `Your rising sign is ${chart.lagna.signName} — you meet the world as someone ${SIGN_TRAITS[chart.lagna.signName] || 'distinctive'}. The Lagna shapes your temperament, body and the first impression you make.` });
  }
  if (chart && chart.moonSign) {
    sections.push({ title: 'Moon — your inner world', text: `Your Moon sits in ${chart.moonSign}${chart.nakshatra ? ` in the nakshatra ${chart.nakshatra}` : ''}. Emotionally you are ${SIGN_TRAITS[chart.moonSign] || 'nuanced'}; the Moon governs your instincts, comfort and how you nurture and are nurtured.` });
  }
  if (chart && chart.sunSign) {
    sections.push({ title: 'Sun — your core self', text: `Your Sun is in ${chart.sunSign} — at your core you express yourself in a ${SIGN_TRAITS[chart.sunSign] || 'distinct'} way. The Sun signifies your vitality, purpose and relationship with authority.` });
  }

  for (const [name, v] of Object.entries(P)) {
    const pv = /** @type {any} */ (v);
    if (!pv || !pv.house) continue;
    const sig = PLANET_SIG[name] || 'its significations';
    const theme = HOUSE_THEME[pv.house] || 'this area of life';
    const dign = DIGNITY_NOTE[pv.dignity] || '';
    const rx = pv.retrograde ? ' (retrograde — its lessons turn inward)' : '';
    sections.push({ title: `${name} in the ${ordinal(pv.house)} house`, text: `${name} — ${sig} — sits in your ${ordinal(pv.house)} house of ${theme}${dign}${rx}. Its themes tend to play out through ${theme}.` });
  }

  if (chart && chart.dasha && chart.dasha.current) {
    const lord = chart.dasha.current.lord;
    const end = chart.dasha.current.end ? ` until ${String(chart.dasha.current.end).slice(0, 10)}` : '';
    sections.push({ title: 'Current period (Mahadasha)', text: `You are running the ${lord} mahadasha${end}. This chapter is coloured by ${lord}'s significations — ${PLANET_SIG[lord] || 'its themes'}.` });
  }

  const strong = Object.entries(P).filter(([, v]) => /** @type {any} */ (v).dignity === 'exalted' || /** @type {any} */ (v).dignity === 'own sign').map(([n]) => n);
  const weak = Object.entries(P).filter(([, v]) => /** @type {any} */ (v).dignity === 'debilitated').map(([n]) => n);
  if (strong.length || weak.length) {
    sections.push({
      title: 'Strengths & tender spots',
      text: `${strong.length ? `Well-placed: ${strong.join(', ')} — natural strengths to lean on. ` : ''}${weak.length ? `Needs care: ${weak.join(', ')} — areas that reward patience and effort.` : ''}`.trim()
    });
  }

  return { sections, disclaimer: 'A classical Jyotish reading of your computed chart — a belief system, offered as insight, not as medical, legal or financial advice.' };
}

module.exports = { detailedReading, SIGN_TRAITS, PLANET_SIG, HOUSE_THEME };

// data/nakshatras.js — the complete 27-Nakshatra personality atlas
// (Sambandh Intelligence System spec §1.3). Index 0–26 is aligned to
// services/astro.js NAKSHATRAS so a Moon position maps straight in.
//
// Fields per the spec: symbol · gana · yoni (animal) · deity · core personality ·
// emotional nature · intimate energy (spec's "sexual energy" — UI must phrase as
// "intimate/energetic/physical", never "sexual") · best matches · avoid.
// `title` is a short archetype for profile display.

const NAKSHATRA_ATLAS = [
  { name: 'Ashwini', title: 'The Swift Healer', symbol: 'Horse head', gana: 'Deva', yoni: 'Horse', deity: 'Ashwini Kumaras',
    core: 'Initiator, healer, energetic, impatient', emotional: "Quick emotional responses; doesn't dwell on feelings; needs stimulation",
    intimate: 'High physical energy; direct pursuit; adventurous', best: ['Bharani', 'Shatabhisha'], avoid: ['Jyeshtha', 'Mula'] },
  { name: 'Bharani', title: 'The Passionate Bearer', symbol: 'Yoni (womb)', gana: 'Manushya', yoni: 'Elephant', deity: 'Yama',
    core: 'Intense, creative, responsible, carries burden', emotional: 'Passionate emotions; feels deeply; struggles with extremes',
    intimate: 'Intense and physical; possessive energy', best: ['Revati'], avoid: ['Anuradha', 'Jyeshtha'] },
  { name: 'Krittika', title: 'The Purifier', symbol: 'Razor / flame', gana: 'Rakshasa', yoni: 'Sheep', deity: 'Agni',
    core: 'Sharp, critical, determined, purifying', emotional: 'Direct emotional expression; cuts through illusion; hot-tempered',
    intimate: 'Fiery and assertive; passionate pursuer', best: ['Pushya'], avoid: ['Vishakha', 'Chitra'] },
  { name: 'Rohini', title: 'The Sensual Creator', symbol: 'Chariot / ox-cart', gana: 'Manushya', yoni: 'Serpent', deity: 'Brahma',
    core: 'Sensual, artistic, materialistic, magnetic', emotional: 'Deeply feeling; attached to beauty and comfort; romantic',
    intimate: 'Sensual and pleasure-loving; magnetic', best: ['Mrigashira'], avoid: ['Vishakha', 'Ardra'] },
  { name: 'Mrigashira', title: 'The Gentle Seeker', symbol: 'Deer head', gana: 'Deva', yoni: 'Serpent', deity: 'Soma',
    core: 'Curious, gentle, searching, restless', emotional: 'Gentle and sensitive; easily hurt; needs reassurance',
    intimate: 'Gentle and explorative; not aggressive', best: ['Rohini', 'Chitra'], avoid: ['Ardra', 'Jyeshtha'] },
  { name: 'Ardra', title: 'The Storm', symbol: 'Teardrop / diamond', gana: 'Manushya', yoni: 'Dog', deity: 'Rudra',
    core: 'Intense, transformative, emotional, stormy', emotional: 'Turbulent emotions; deep; goes through radical change',
    intimate: 'Complex; needs deep emotional connection first', best: ['Mula'], avoid: ['Rohini', 'Pushya'] },
  { name: 'Punarvasu', title: 'The Nurturer', symbol: 'Quiver of arrows', gana: 'Deva', yoni: 'Cat', deity: 'Aditi',
    core: 'Nurturing, philosophical, optimistic, forgiving', emotional: 'Generous emotions; returns to happiness after setbacks',
    intimate: 'Moderate; values emotional safety over physical intensity', best: ['Ashlesha'], avoid: ['Vishakha', 'Chitra'] },
  { name: 'Pushya', title: 'The Nourisher', symbol: 'Flower / circle / arrow', gana: 'Deva', yoni: 'Sheep', deity: 'Brihaspati',
    core: 'Caring, responsible, traditional, nourishing', emotional: 'Stable emotions; gives more than it takes; protective',
    intimate: 'Gentle and caring; not primarily physical', best: ['Krittika'], avoid: ['Ashlesha', 'Ardra'] },
  { name: 'Ashlesha', title: 'The Intuitive', symbol: 'Coiled serpent', gana: 'Rakshasa', yoni: 'Cat', deity: 'Nagas',
    core: 'Perceptive, seductive, manipulative, deeply intuitive', emotional: 'Complex emotions; holds feelings back; can be calculating',
    intimate: 'Intense and seductive; can use intimacy strategically', best: ['Punarvasu'], avoid: ['Pushya', 'Bharani'] },
  { name: 'Magha', title: 'The Sovereign', symbol: 'Royal throne / palanquin', gana: 'Rakshasa', yoni: 'Rat', deity: 'Pitris (ancestors)',
    core: 'Proud, dignified, regal, ancestral, powerful', emotional: 'Emotions linked to status and pride; dignified grief',
    intimate: 'Strong energy but selective; partner must be worthy', best: ['Purva Phalguni'], avoid: ['Hasta', 'Uttara Phalguni'] },
  { name: 'Purva Phalguni', title: 'The Romantic', symbol: 'Hammock / front of bed', gana: 'Manushya', yoni: 'Rat', deity: 'Bhaga',
    core: 'Pleasure-loving, romantic, creative, generous', emotional: 'Joyful and affectionate emotions; seeks pleasure',
    intimate: 'Strong and pleasure-seeking; values physical connection', best: ['Magha', 'Uttara Phalguni'], avoid: ['Uttara Bhadrapada', 'Anuradha'] },
  { name: 'Uttara Phalguni', title: 'The Devoted Partner', symbol: 'Back legs of bed', gana: 'Manushya', yoni: 'Cow', deity: 'Aryaman',
    core: 'Helpful, stable, service-oriented, loyal partner', emotional: 'Steady and devoted emotions; reliable in love',
    intimate: 'Warm and consistent; builds slowly but deeply', best: ['Uttara Bhadrapada'], avoid: ['Purva Phalguni', 'Vishakha'] },
  { name: 'Hasta', title: 'The Skilled Hand', symbol: 'Hand', gana: 'Deva', yoni: 'Buffalo', deity: 'Savitar',
    core: 'Dexterous, practical, skilled, healing, crafty', emotional: 'Careful emotions; thinks before feeling; practical',
    intimate: 'Skilled and attentive; deeply attuned rather than intense', best: ['Swati'], avoid: ['Shatabhisha', 'Purva Bhadrapada'] },
  { name: 'Chitra', title: 'The Artist', symbol: 'Pearl / bright jewel', gana: 'Rakshasa', yoni: 'Tiger', deity: 'Vishwakarma',
    core: 'Artistic, beautiful, creative, magnetic, image-conscious', emotional: 'Emotions expressed through beauty; can be vain',
    intimate: 'Magnetic and attractive; intense physical presence', best: ['Vishakha'], avoid: ['Ashwini', 'Bharani'] },
  { name: 'Swati', title: 'The Independent', symbol: 'Sword / young plant', gana: 'Deva', yoni: 'Buffalo', deity: 'Vayu',
    core: 'Independent, balanced, diplomatic, adaptable, business-minded', emotional: 'Balanced emotions; needs personal freedom in relationships',
    intimate: 'Flexible and open; not possessive', best: ['Hasta'], avoid: ['Ashlesha', 'Magha'] },
  { name: 'Vishakha', title: 'The Determined', symbol: "Triumphal arch / potter's wheel", gana: 'Rakshasa', yoni: 'Tiger', deity: 'Indra-Agni',
    core: 'Determined, purposeful, dual-natured, competitive', emotional: 'Intense emotions that build slowly; jealous when attached',
    intimate: 'Intensely focused; can become obsessive in love', best: ['Chitra'], avoid: ['Anuradha', 'Rohini'] },
  { name: 'Anuradha', title: 'The Devoted Friend', symbol: 'Lotus / staff', gana: 'Deva', yoni: 'Deer', deity: 'Mitra',
    core: 'Devoted, friendly, organisational, sociable, loyal', emotional: 'Deep capacity for love; friendship-based romance',
    intimate: 'Tender and devoted; needs emotional safety', best: ['Jyeshtha'], avoid: ['Bharani', 'Purva Phalguni'] },
  { name: 'Jyeshtha', title: 'The Protector', symbol: 'Circular amulet / earring', gana: 'Rakshasa', yoni: 'Deer', deity: 'Indra',
    core: 'Protective, intense, complex, eldest-sibling energy', emotional: 'Protective emotions; needs to be needed; can be controlling',
    intimate: 'Intense and protective; very loyal once committed', best: ['Anuradha'], avoid: ['Ashwini', 'Shatabhisha'] },
  { name: 'Mula', title: 'The Truth-Seeker', symbol: "Tied roots / lion's tail", gana: 'Rakshasa', yoni: 'Dog', deity: 'Niritti',
    core: 'Investigative, philosophical, dissolution-oriented, truthful', emotional: 'Intense emotions linked to transformation; can be detached',
    intimate: 'Direct and honest; values authenticity over intensity', best: ['Ardra'], avoid: ['Ashlesha', 'Magha'] },
  { name: 'Purva Ashadha', title: 'The Invincible', symbol: 'Fan / tusk', gana: 'Manushya', yoni: 'Monkey', deity: 'Apas',
    core: 'Passionate, invincible, optimistic, undefeated energy', emotional: "Optimistic and expanding emotions; doesn't easily give up",
    intimate: 'Passionate and enthusiastic; enjoys romance', best: ['Shravana'], avoid: ['Bharani', 'Krittika'] },
  { name: 'Uttara Ashadha', title: 'The Principled', symbol: 'Elephant tusk', gana: 'Manushya', yoni: 'Mongoose', deity: 'Vishvadevas',
    core: 'Principled, responsible, determined, truth-seeking', emotional: 'Serious and dedicated emotions; slow to open but deeply loyal',
    intimate: 'Devoted and serious; takes intimacy as commitment', best: [], avoid: ['Ashlesha', 'Ardra'] },
  { name: 'Shravana', title: 'The Listener', symbol: 'Ear / three footprints', gana: 'Deva', yoni: 'Monkey', deity: 'Vishnu',
    core: 'Listening, learning, connected, wise, perceptive', emotional: 'Emotions expressed through listening and understanding',
    intimate: 'Attentive and considerate; deeply present', best: ['Purva Ashadha'], avoid: ['Mula', 'Ardra'] },
  { name: 'Dhanishta', title: 'The Achiever', symbol: 'Drum / flute', gana: 'Rakshasa', yoni: 'Lion', deity: 'Ashta Vasus',
    core: 'Ambitious, musical, wealthy, community-oriented', emotional: 'Emotions linked to ambition and achievement; can be emotionally unavailable',
    intimate: 'Driven and powerful; selective about partners', best: ['Purva Bhadrapada'], avoid: ['Rohini', 'Hasta'] },
  { name: 'Shatabhisha', title: 'The Mystic Healer', symbol: 'Empty circle / 1000 physicians', gana: 'Rakshasa', yoni: 'Horse', deity: 'Varuna',
    core: 'Healing, independent, mysterious, visionary, reclusive', emotional: 'Private emotions; needs a lot of space; healer archetype',
    intimate: 'Independent; intimacy on their own terms', best: ['Ashwini'], avoid: ['Vishakha', 'Chitra'] },
  { name: 'Purva Bhadrapada', title: 'The Spiritual Warrior', symbol: 'Sword / front of pyre', gana: 'Manushya', yoni: 'Lion', deity: 'Aja Ekapada',
    core: 'Intense, passionate, transformative, spiritual warrior', emotional: 'Turbulent then spiritually elevated emotions; extreme range',
    intimate: 'Intensely passionate; can be erratic', best: ['Dhanishta'], avoid: ['Rohini', 'Ardra'] },
  { name: 'Uttara Bhadrapada', title: 'The Compassionate Sage', symbol: 'Back of pyre / snake', gana: 'Manushya', yoni: 'Cow', deity: 'Ahir Budhnya',
    core: 'Deep, compassionate, restrained, wise, philosophical', emotional: 'Deeply compassionate; patient; spiritually oriented',
    intimate: 'Tender and deep; values spiritual connection', best: ['Uttara Phalguni'], avoid: ['Purva Phalguni', 'Magha'] },
  { name: 'Revati', title: 'The Gentle Guardian', symbol: 'Fish / drum', gana: 'Deva', yoni: 'Elephant', deity: 'Pushan',
    core: 'Gentle, compassionate, creative, protective of others', emotional: 'Nurturing and gentle emotions; easily hurt; deeply empathetic',
    intimate: 'Gentle and romantic; needs emotional security first', best: ['Bharani'], avoid: ['Ashlesha', 'Krittika'] }
];

const BY_NAME = new Map(NAKSHATRA_ATLAS.map((n, i) => [n.name.toLowerCase(), { ...n, index: i }]));

function nakshatraByIndex(i) {
  if (i == null || i < 0 || i >= NAKSHATRA_ATLAS.length) return null;
  return { ...NAKSHATRA_ATLAS[i], index: i };
}
function nakshatraByName(name) {
  return name ? (BY_NAME.get(String(name).trim().toLowerCase()) || null) : null;
}

// A plain-language "relationship personality" line for a user's own profile.
function relationshipProfile(nak) {
  const n = typeof nak === 'number' ? nakshatraByIndex(nak) : nakshatraByName(nak);
  if (!n) return null;
  return {
    name: n.name,
    title: n.title,
    headline: `${n.name} (${n.title})`,
    personality: n.core,
    emotional: n.emotional,
    needs: `You connect best with partners who appreciate your nature — ${n.best.length ? 'naturally harmonious with ' + n.best.join(', ') + '.' : 'and you pair well with a wide range of temperaments.'}`
  };
}

module.exports = { NAKSHATRA_ATLAS, nakshatraByIndex, nakshatraByName, relationshipProfile };

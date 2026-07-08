// routes-astro.js — the Astrology section. Serves the REAL computed chart
// (services/astro-engine.js: deterministic astronomy + classical rules), plus a
// panchang and an AI assistant that answers ONLY from the user's own chart.
//
// Provenance is explicit everywhere: `computed` = astronomy (facts),
// `traditional` = classical astrological rules (belief-based interpretation),
// `ai` = a natural-language summary of those. Never medical/legal/financial advice.

const express = require('express');
const User = require('./models/User');
const { requireAuth } = require('./routes-auth');
const engine = require('./services/astro-engine');
const { nakshatraByName } = require('./data/nakshatras');

const router = express.Router();

// House meanings (whole-sign) for plain-language interpretation.
const HOUSE_MEANING = {
  1: 'self, body, temperament', 2: 'wealth, family, speech', 3: 'courage, siblings, effort',
  4: 'home, mother, inner peace', 5: 'creativity, romance, children', 6: 'work, health, rivals',
  7: 'partnership, marriage, business', 8: 'transformation, longevity, the hidden',
  9: 'fortune, dharma, higher learning', 10: 'career, status, action', 11: 'gains, networks, aspirations',
  12: 'letting go, foreign lands, spirituality'
};
const DASHA_TONE = {
  Sun: 'authority, recognition and self-definition', Moon: 'emotions, home and nurturing',
  Mars: 'drive, action and courage (also friction if unchecked)', Mercury: 'learning, communication and commerce',
  Jupiter: 'growth, wisdom, teaching and good fortune', Venus: 'love, comfort, art and relationships',
  Saturn: 'discipline, patience and hard-earned, lasting results', Rahu: 'ambition, the unconventional and worldly desire',
  Ketu: 'detachment, research and spiritual turning inward'
};

// Compact rule-based interpretation (traditional layer).
function interpret(chart) {
  const out = { strengths: [], cautions: [], currentPeriod: null, notes: [] };
  for (const y of chart.yogas) out.strengths.push(`${y.name}: ${y.detail}`);
  for (const d of chart.doshas) out.cautions.push(`${d.name} (${d.severity}): ${d.detail}`);
  const cur = chart.dasha?.current;
  if (cur) {
    const antar = cur.antardasha ? `, sub-period of ${cur.antardasha.lord}` : '';
    out.currentPeriod = `You are in the ${cur.lord} Mahadasha${antar} (until ${cur.end}). This period emphasises ${DASHA_TONE[cur.lord] || 'its natural themes'}.`;
  }
  // A couple of placements worth naming
  const P = chart.planets;
  if (P.Sun.house) out.notes.push(`Sun in house ${P.Sun.house} (${HOUSE_MEANING[P.Sun.house]}) — where you seek to shine.`);
  if (P.Moon.house) out.notes.push(`Moon in house ${P.Moon.house} (${HOUSE_MEANING[P.Moon.house]}) — where your heart lives.`);
  const strong = Object.entries(P).filter(([, v]) => v.dignity === 'exalted' || v.dignity === 'own sign').map(([k, v]) => `${k} (${v.dignity})`);
  if (strong.length) out.notes.push('Dignified planets: ' + strong.join(', ') + '.');
  return out;
}

// A compact text summary of the chart for grounding the AI.
function summarize(chart, name) {
  const P = chart.planets;
  const planetLine = Object.entries(P).map(([k, v]) => `${k} in ${v.signName}${v.house ? ' (house ' + v.house + ')' : ''}, ${v.nakshatra} pada ${v.pada}${v.retrograde ? ', retrograde' : ''}${v.combust ? ', combust' : ''}${v.dignity !== 'neutral' ? ', ' + v.dignity : ''}`).join('\n');
  return [
    name ? `Name: ${name}` : '',
    chart.lagna ? `Lagna (Ascendant): ${chart.lagna.signName} ${chart.lagna.degInSign}°` : 'Lagna: unknown (no exact birth time)',
    `Moon sign: ${chart.moonSign}; Nakshatra: ${chart.nakshatra} pada ${chart.nakshatraPada}`,
    `Ayanamsa (Lahiri): ${chart.ayanamsa}°`,
    'Planets:\n' + planetLine,
    'Yogas: ' + (chart.yogas.map(y => y.name).join(', ') || 'none detected'),
    'Doshas: ' + (chart.doshas.map(d => d.name).join(', ') || 'none detected'),
    chart.dasha?.current ? `Current dasha: ${chart.dasha.current.lord}${chart.dasha.current.antardasha ? '/' + chart.dasha.current.antardasha.lord : ''} until ${chart.dasha.current.end}` : ''
  ].filter(Boolean).join('\n');
}

// Rule-based fallback answer (no LLM) — grounded in the chart.
function ruleBasedAnswer(chart, q) {
  const ql = q.toLowerCase();
  const P = chart.planets;
  const topic = (kw) => kw.some(k => ql.includes(k));
  const bits = [];
  if (topic(['career', 'job', 'work', 'business', 'profession'])) {
    const tenth = Object.entries(P).find(([, v]) => v.house === 10);
    bits.push(`Career (10th house of ${HOUSE_MEANING[10]}) is coloured by ${tenth ? tenth[0] + ' in ' + tenth[1].signName : 'your Saturn and Sun placements'}. Your current ${chart.dasha?.current?.lord} period leans toward ${DASHA_TONE[chart.dasha?.current?.lord] || 'its themes'}.`);
  }
  if (topic(['marriage', 'partner', 'spouse', 'relationship', 'love'])) {
    const seventh = Object.entries(P).find(([, v]) => v.house === 7);
    bits.push(`Partnership (7th house) is shaped by ${seventh ? seventh[0] + ' in ' + seventh[1].signName : 'Venus and Jupiter'}. ${chart.doshas.find(d => /Mangal/.test(d.name)) ? 'A Mangal dosha is present — traditionally match with a similarly-placed partner.' : 'No Mangal dosha detected.'}`);
  }
  if (topic(['money', 'wealth', 'finance', 'rich'])) bits.push('Wealth is read from the 2nd and 11th houses and their lords, and any Dhana/Lakshmi yogas.');
  if (topic(['health'])) bits.push('Health indications come from the 6th house, the Moon and the lagna lord — this is traditional guidance, not medical advice.');
  if (!bits.length) bits.push(`Your chart centres on a ${chart.moonSign} Moon in ${chart.nakshatra}, with a ${chart.dasha?.current?.lord || ''} period now active. Ask about career, marriage, wealth or health for a focused reading.`);
  return bits.join(' ');
}

// GET /astro/panchang?date=YYYY-MM-DD — today's (or given date's) Vedic calendar
router.get('/panchang', requireAuth, (req, res) => {
  const date = req.query.date ? new Date(req.query.date) : new Date();
  res.json({ panchang: engine.panchang(isNaN(date) ? new Date() : date), source: 'computed (astronomy)' });
});

// GET /astro/chart — the requesting user's own full chart
router.get('/chart', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).lean();
    if (!user?.astrology?.birthDate) return res.json({ chart: null, needsBirthData: true });
    const chart = engine.computeChart(user.astrology);
    if (!chart) return res.json({ chart: null, needsBirthData: true });
    res.json({
      chart,
      nakshatra: nakshatraByName(chart.nakshatra),
      numerology: engine.numerology(user.profile?.firstName, user.astrology.birthDate),
      interpretation: interpret(chart),
      provenance: { computed: 'Astronomy (sidereal, Lahiri ayanamsa)', traditional: 'Classical Jyotish rules (yogas/doshas/dasha)', note: 'Traditional interpretations are a belief system — not medical, legal or financial advice.' }
    });
  } catch (e) { next(e); }
});

// GET /astro/chart/:userId — another member's chart (if they share astrology)
router.get('/chart/:userId', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.userId).lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.preferences?.showAstrologyToOthers === false) return res.status(403).json({ error: 'This person keeps their astrology private.' });
    if (!user.astrology?.birthDate) return res.json({ chart: null, needsBirthData: true });
    const chart = engine.computeChart(user.astrology);
    if (!chart) return res.json({ chart: null, needsBirthData: true });
    res.json({ chart, nakshatra: nakshatraByName(chart.nakshatra), interpretation: interpret(chart) });
  } catch (e) { next(e); }
});

// POST /astro/ask — AI assistant grounded ONLY in the user's chart (LLM when a
// key is set; deterministic rule-based answer otherwise).
router.post('/ask', requireAuth, async (req, res, next) => {
  try {
    const q = String(req.body.question || '').trim().slice(0, 400);
    if (!q) return res.status(400).json({ error: 'Ask a question about your chart.' });
    const user = await User.findById(req.userId).lean();
    if (!user?.astrology?.birthDate) return res.json({ answer: 'Add your birth date, time and place first so I can read your chart.', needsBirthData: true });
    const chart = engine.computeChart(user.astrology);
    const context = summarize(chart, user.profile?.firstName);

    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const Anthropic = require('@anthropic-ai/sdk');
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        const msg = await client.messages.create({
          model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest',
          max_tokens: 600,
          system: 'You are a warm, precise Vedic astrology guide. Answer ONLY from the provided computed chart. Present everything as a traditional (belief-based) interpretation, never as fact or as medical/legal/financial advice. Be concise and kind.',
          messages: [{ role: 'user', content: `My chart:\n${context}\n\nQuestion: ${q}` }]
        });
        const answer = msg.content?.map(c => c.text).join('') || ruleBasedAnswer(chart, q);
        return res.json({ answer, source: 'AI grounded in your chart', disclaimer: 'Traditional interpretation, not professional advice.' });
      } catch { /* fall through to rule-based */ }
    }
    res.json({ answer: ruleBasedAnswer(chart, q), source: 'rule-based (your chart)', disclaimer: 'Traditional interpretation, not professional advice.' });
  } catch (e) { next(e); }
});

// GET /astro/transits — current planetary transits (gochar) over the natal chart
router.get('/transits', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).lean();
    if (!user?.astrology?.birthDate) return res.json({ transits: null, needsBirthData: true });
    const chart = engine.computeChart(user.astrology);
    res.json({ transits: engine.transits(chart), source: 'computed (astronomy)' });
  } catch (e) { next(e); }
});

// GET /astro/compat/:userId?type=romance|friendship|business — relationship-lens
// astrological compatibility between you and another member.
router.get('/compat/:userId', requireAuth, async (req, res, next) => {
  try {
    const [me, other] = await Promise.all([User.findById(req.userId).lean(), User.findById(req.params.userId).lean()]);
    if (!other) return res.status(404).json({ error: 'User not found' });
    if (other.preferences?.showAstrologyToOthers === false) return res.status(403).json({ error: 'This person keeps their astrology private.' });
    if (!me?.astrology?.birthDate || !other?.astrology?.birthDate) return res.json({ compat: null, needsBirthData: true });
    const type = ['romance', 'friendship', 'business'].includes(req.query.type) ? req.query.type : 'romance';
    const a = engine.computeChart(me.astrology), b = engine.computeChart(other.astrology);
    res.json({ compat: engine.relationshipCompat(a, b, type), type });
  } catch (e) { next(e); }
});

// GET /astro/muhurta?activity=marriage|business|travel|education|vehicle|property&date=YYYY-MM-DD
router.get('/muhurta', requireAuth, (req, res) => {
  const activity = String(req.query.activity || 'general');
  const date = req.query.date ? new Date(req.query.date) : new Date();
  res.json({ muhurta: engine.muhurta(activity, isNaN(date) ? new Date() : date), source: 'computed (panchang) + traditional rules' });
});

module.exports = router;

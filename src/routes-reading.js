// routes-reading.js — plain-language reading endpoints. The engine runs the
// astrology + Samudrika + behaviour logic underneath; these routes only ever
// return jargon-free strings (the Astro tab, served elsewhere, is the one place
// technical vocabulary is allowed).
//
//   GET /api/reading/me            — your full reading (four answer cards)
//   GET /api/reading/:userId       — what someone else's profile shows: a nature
//                                    line + "who they are"
//   GET /api/reading/compat/:userId — deeper pair reading, UNLOCKED only once both
//                                    people have set intent to marriage; otherwise
//                                    just a vague hint

const express = require('express');
const User = require('./models/User');
const engine = require('./services/reading-engine');
const astro = require('./services/astro-engine');
const compat = require('./services/compatibility-engine');
const { requireAuth } = require('./routes-auth');
const { requireLaunched } = require('./services/site-mode');

const router = express.Router();

// Build the engine inputs for a user. Chart is computed on the fly from stored
// birth details; features are self-declared. (Behaviour is layered in only where a
// specific conversation exists — the chat/compat surfaces.)
function inputsFor(user) {
  const chart = user && user.astrology && user.astrology.birthDate ? astro.computeChart(user.astrology) : null;
  return { chart, features: (user && user.features) || null };
}

// Your own full reading.
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const inputs = inputsFor(user);
    res.json({ reading: engine.readAll(inputs), line: engine.discoverLine(inputs) });
  } catch (err) { next(err); }
});

// Deeper pair reading — gated on MUTUAL marriage intent. Defined before /:userId
// so "compat" isn't swallowed as a user id.
router.get('/compat/:userId', requireAuth, requireLaunched, async (req, res, next) => {
  try {
    const [me, other] = await Promise.all([
      User.findById(req.userId),
      User.findById(req.params.userId)
    ]);
    if (!me || !other) return res.status(404).json({ error: 'User not found' });

    // The marriage gate now lives in the compatibility engine (a precondition,
    // not a UI check): hint until BOTH are marriage-intent, then the deep reading.
    const r = compat.computeCompatibility(me, other, { context: { intentA: me.intent, intentB: other.intent } });
    if (r.level !== 'full') return res.json({ unlocked: false, hint: r.hint });
    res.json({
      unlocked: true,
      answer: r.reading.how_you_fit,
      whosYourPerson: r.reading.whos_your_person,
      confidence: r.confidence,
      score: r.score,
      subScores: r.subScores
    });
  } catch (err) { next(err); }
});

// A member's active tier is pro/max — the single authority lives in services/membership.js.
const { proOrMaxActive } = require('./services/membership');

// What another person's profile shows to you. The full Nature Dial reading (their
// persona/energy/how-they-connect) is a Sambandh Pro feature — free/base members get
// a locked teaser instead. Admins/moderators bypass for oversight.
router.get('/:userId', requireAuth, requireLaunched, async (req, res, next) => {
  try {
    const [me, user] = await Promise.all([
      User.findById(req.userId),
      User.findById(req.params.userId)
    ]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const privileged = proOrMaxActive(me) || ['admin', 'moderator'].includes(req.role);
    if (!privileged) {
      return res.json({ locked: true, requiredTier: 'pro' });
    }
    const inputs = inputsFor(user);
    res.json({ line: engine.discoverLine(inputs), who: engine.read('who_you_are', inputs).answer });
  } catch (err) { next(err); }
});

module.exports = router;

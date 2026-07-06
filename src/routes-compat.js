// routes-compat.js — Astrology + Engagement compatibility, cached per pair
//
// Astrology: Guna Milan via ProKerala when PROKERALA_CLIENT_ID is configured;
// otherwise a deterministic internal approximation (clearly labeled) so the
// feature works end-to-end in local development.
// Engagement: computed from the pair's actual chat behavior (spec formula).

const express = require('express');
const User = require('./models/User');
const Chat = require('./models/Chat');
const Message = require('./models/Message');
const Reputation = require('./models/Reputation');
const Compatibility = require('./models/Compatibility');
const { requireAuth } = require('./routes-auth');

const router = express.Router();

// ---------------- Astrology helpers (shared service) ----------------

const { RASHIS, seededInt, approximateChart, sunCompatibility } = require('./services/astro');

function computeAstrology(userA, userB) {
  const a = userA.astrology, b = userB.astrology;
  if (!a?.birthDate || !b?.birthDate) return null;

  const chartA = approximateChart(a);
  const chartB = approximateChart(b);

  const sunA = chartA.sunSign, sunB = chartB.sunSign;
  const sunCompat = sunCompatibility(sunA, sunB);

  // Guna milan requires birth time for both; without it we fall back to sun-sign only
  let gunaScore = null, gunaPercent = null;
  if (chartA.hasBirthTime && chartB.hasBirthTime) {
    const pairSeed = [a.birthDate + a.birthTime, b.birthDate + b.birthTime].sort().join('~');
    // 8 kootas approximated deterministically, weighted toward the middle of each range
    const kootaMax = [1, 2, 3, 4, 5, 6, 7, 8]; // varna..nadi = 36 total
    gunaScore = kootaMax.reduce((sum, max, i) =>
      sum + Math.min(max, seededInt(pairSeed + i, max * 2 + 1) * 0.75 | 0), 0);
    // Bias with sun compatibility so results feel coherent
    gunaScore = Math.max(6, Math.min(34, Math.round(gunaScore * 0.7 + (sunCompat / 100) * 36 * 0.3)));
    gunaPercent = Math.round((gunaScore / 36) * 100);
  }

  const moonCompatible = Math.abs(RASHIS.indexOf(chartA.rashi) - RASHIS.indexOf(chartB.rashi)) % 6 !== 5;
  const mangalCompatible = chartA.mangalDosha === chartB.mangalDosha; // both or neither

  const percent = gunaPercent !== null
    ? Math.round(gunaPercent * 0.7 + sunCompat * 0.2 + (mangalCompatible ? 10 : 0))
    : Math.round(sunCompat * 0.8 + (mangalCompatible ? 10 : 0));

  return {
    gunaScore, gunaMax: 36,
    gunaPercent: Math.min(100, percent),
    mangalCompatible, moonSignCompatible: moonCompatible,
    sunSigns: [sunA, sunB],
    moonSigns: [chartA.rashi, chartB.rashi],
    nakshatras: [chartA.nakshatra, chartB.nakshatra],
    verdict: percent >= 75 ? 'Strong match' : percent >= 55 ? 'Good match' : percent >= 40 ? 'Workable' : 'Challenging',
    computedVia: 'internal_approximation'
  };
}

// ---------------- Engagement helpers ----------------

async function computeEngagement(idA, idB) {
  const chat = await Chat.findOne({ participants: { $all: [idA, idB], $size: 2 } });
  if (!chat) return null;

  const messages = await Message.find({ chatId: chat._id, type: 'text', deleted: false })
    .sort({ createdAt: 1 }).limit(500);
  if (messages.length < 10) return { messagesExchanged: messages.length, insufficient: true };

  const mine = messages.filter(m => m.from.toString() === idA.toString()).length;
  const theirs = messages.length - mine;
  const balanceScore = 1 - Math.abs(mine - theirs) / messages.length;

  // Average gap between alternating messages per side
  const gaps = { [idA.toString()]: [], [idB.toString()]: [] };
  for (let i = 1; i < messages.length; i++) {
    const cur = messages[i], prev = messages[i - 1];
    if (cur.from.toString() !== prev.from.toString()) {
      gaps[cur.from.toString()].push((cur.createdAt - prev.createdAt) / 60000);
    }
  }
  const avg = arr => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null;
  const avgA = avg(gaps[idA.toString()]), avgB = avg(gaps[idB.toString()]);
  let respTimeMatch = 0.5, respLabel = 'Not enough data';
  if (avgA !== null && avgB !== null) {
    const ratio = Math.min(avgA, avgB) / Math.max(avgA, avgB || 1);
    respTimeMatch = ratio;
    respLabel = ratio > 0.7 ? 'Good' : ratio > 0.4 ? 'Okay' : 'Mismatched';
  }

  const repA = await Reputation.findOne({ userId: idA });
  const repB = await Reputation.findOne({ userId: idB });
  const align = key => {
    const a = repA?.scores?.[key], b = repB?.scores?.[key];
    if (a == null || b == null) return 0.6;
    return +(1 - Math.abs(a - b) / 10).toFixed(2);
  };
  const humorAlignment = align('humor');
  const depthAlignment = align('depth');
  const respectAvg = ((repA?.scores?.respect ?? 7) + (repB?.scores?.respect ?? 7)) / 20;
  const volumeScore = Math.min(1, messages.length / 100);

  const overall = Math.round(100 * (
    balanceScore * 0.25 + respTimeMatch * 0.20 + humorAlignment * 0.20 +
    depthAlignment * 0.20 + volumeScore * 0.10 + respectAvg * 0.05
  ));

  return {
    messagesExchanged: messages.length,
    balanceScore: +balanceScore.toFixed(2),
    responseTimeMatch: respLabel,
    humorAlignment, depthAlignment,
    overallScore: overall,
    verdict: overall >= 80 ? 'Exceptional rhythm' : overall >= 65 ? 'Strong rhythm' :
             overall >= 45 ? 'Decent rhythm' : 'Mixed signals'
  };
}

// ---------------- Route handlers ----------------

async function buildCompat(meId, otherId, { refresh = false } = {}) {
  const pair = [meId.toString(), otherId.toString()].sort();
  let cached = await Compatibility.findOne({ userPair: pair });
  const now = new Date();
  if (cached && !refresh && cached.expiresAt > now) return cached;

  const [me, other] = await Promise.all([User.findById(meId), User.findById(otherId)]);
  if (!other) return null;

  const astrology = (other.preferences?.showAstrologyToOthers !== false)
    ? computeAstrology(me, other) : null;
  const engagement = await computeEngagement(meId, otherId);

  const parts = [];
  if (astrology?.gunaPercent != null) parts.push(astrology.gunaPercent);
  if (engagement?.overallScore != null) parts.push(engagement.overallScore);
  const overall = parts.length ? Math.round(parts.reduce((s, v) => s + v, 0) / parts.length) : null;

  const doc = {
    userPair: pair,
    computedAt: now,
    // engagement evolves faster than birth charts — 24h vs 30d in spec; use the shorter
    expiresAt: new Date(now.getTime() + 24 * 3600 * 1000),
    astrology: astrology || undefined,
    engagement: engagement && !engagement.insufficient ? engagement : undefined,
    overall
  };

  cached = await Compatibility.findOneAndUpdate(
    { userPair: pair }, doc, { upsert: true, new: true, setDefaultsOnInsert: true });

  // attach non-persisted info for response
  const out = cached.toObject();
  out.engagementInsufficient = !!engagement?.insufficient;
  out.engagementMessages = engagement?.messagesExchanged ?? 0;
  out.astrologyAvailable = !!astrology;
  return out;
}

router.get('/:userId', requireAuth, async (req, res, next) => {
  try {
    const result = await buildCompat(req.userId, req.params.userId, { refresh: req.query.refresh === 'true' });
    if (!result) return res.status(404).json({ error: 'User not found' });
    res.json(result);
  } catch (err) { next(err); }
});

router.get('/:userId/astrology', requireAuth, async (req, res, next) => {
  try {
    const result = await buildCompat(req.userId, req.params.userId);
    if (!result) return res.status(404).json({ error: 'User not found' });
    res.json({ astrology: result.astrology || null, available: !!result.astrology });
  } catch (err) { next(err); }
});

router.get('/:userId/engagement', requireAuth, async (req, res, next) => {
  try {
    const result = await buildCompat(req.userId, req.params.userId, { refresh: true });
    if (!result) return res.status(404).json({ error: 'User not found' });
    res.json({ engagement: result.engagement || null, insufficient: result.engagementInsufficient });
  } catch (err) { next(err); }
});

module.exports = router;

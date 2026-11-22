// routes-journey.js — the Setu Journey for a matched pair (mounted at /api/journey).
//
// Stages advance only by MUTUAL completion; either person may pause (and only
// the person who paused can resume); Reflect answers carry per-answer sharing
// choices and a partner only ever sees answers marked share_with_match.

const express = require('express');
const Chat = require('./models/Chat');
const User = require('./models/User');
const Journey = require('./models/Journey');
const ReflectionAnswer = require('./models/ReflectionAnswer');
const Notification = require('./models/Notification');
const { requireAuth } = require('./routes-auth');
const { requireLaunched } = require('./services/site-mode');
const { STAGES, STAGE_KEYS, REFLECT_QUESTIONS, SHARING, validateAnswer } = require('./data/setu-journey');
const knowledge = require('./intelligence/knowledge');

const router = express.Router();
const isId = (v) => /^[0-9a-fA-F]{24}$/.test(String(v || ''));

async function loadForMember(req, res) {
  const { chatId } = req.params;
  if (!isId(chatId)) { res.status(400).json({ error: 'invalid chat id' }); return null; }
  const chat = await Chat.findOne({ _id: chatId, participants: req.userId }).lean();
  if (!chat || chat.status === 'blocked') { res.status(404).json({ error: 'Match not found' }); return null; }
  let j = await Journey.findOne({ chatId }).lean();
  if (!j) {
    const created = await Journey.create({ chatId, participants: chat.participants, stage: 'connect', status: 'active', completions: {}, stageHistory: [{ stage: 'connect', enteredAt: new Date() }] });
    j = created.toObject ? created.toObject() : created;
  }
  const otherId = (chat.participants || []).map(String).find(p => p !== String(req.userId));
  return { chat, j, otherId };
}

function view(j, me, other, otherName) {
  const idx = j.stage === 'complete' ? STAGES.length : STAGE_KEYS.indexOf(j.stage);
  const comp = j.completions || {};
  return {
    id: String(j._id), chatId: String(j.chatId), status: j.status, stage: j.stage, pausedByMe: j.pausedBy ? String(j.pausedBy) === String(me) : false,
    match: { userId: other, firstName: otherName },
    stageNumber: Math.min(idx + 1, STAGES.length), totalStages: STAGES.length,
    stages: STAGES.map((s, i) => ({
      key: s.key, label: s.label, description: s.description,
      status: i < idx ? 'completed' : i === idx ? 'active' : 'locked',
      youCompleted: !!(comp[s.key] && comp[s.key][String(me)]),
      partnerCompleted: !!(comp[s.key] && other && comp[s.key][String(other)])
    }))
  };
}

async function otherFirstName(chat, otherId) {
  if (!otherId) return 'your match';
  const anonymous = chat.anonymity && chat.anonymity.isAnonymous && !chat.anonymity.revealedAt;
  if (anonymous) return 'your match';
  const u = await User.findById(otherId).select('profile.firstName').lean();
  return (u && u.profile && u.profile.firstName) || 'your match';
}

router.get('/:chatId', requireAuth, requireLaunched, async (req, res, next) => {
  try {
    const x = await loadForMember(req, res); if (!x) return;
    res.json(view(x.j, req.userId, x.otherId, await otherFirstName(x.chat, x.otherId)));
  } catch (e) { next(e); }
});

router.get('/:chatId/stages/:stage', requireAuth, requireLaunched, async (req, res, next) => {
  try {
    if (!STAGE_KEYS.includes(req.params.stage)) return res.status(404).json({ error: 'Stage not found' });
    const x = await loadForMember(req, res); if (!x) return;
    const s = STAGES.find(st => st.key === req.params.stage);
    const kb = knowledge.byStage(s.key);
    const pick = (t) => kb.filter(k => k.topic === t).map(k => k.text);
    res.json({ ...s, guidance: pick('stage_description').concat(pick('checklist')), conversationStarters: pick('conversation_starters'), tips: pick('tips'), nextSteps: pick('next_steps') });
  } catch (e) { next(e); }
});

router.post('/:chatId/stages/:stage/complete', requireAuth, requireLaunched, async (req, res, next) => {
  try {
    const x = await loadForMember(req, res); if (!x) return;
    const { j } = x;
    const stage = req.params.stage;
    if (j.status !== 'active') return res.status(409).json({ error: j.status === 'paused' ? 'The journey is paused' : 'The journey is not active' });
    if (stage !== j.stage) return res.status(409).json({ error: 'Only the current stage can be completed' });
    if (stage === 'reflect') {
      const n = await ReflectionAnswer.countDocuments({ journeyId: j._id, userId: req.userId });
      if (n < REFLECT_QUESTIONS.length) return res.status(409).json({ error: `Answer all ${REFLECT_QUESTIONS.length} reflection questions first`, answered: n });
    }
    const comp = { ...(j.completions || {}) };
    comp[stage] = { ...(comp[stage] || {}), [String(req.userId)]: new Date().toISOString() };
    const both = x.otherId && comp[stage][String(x.otherId)];
    const set = { completions: comp, updatedAt: new Date() };
    let advanced = false;
    if (both) {
      const next = STAGE_KEYS[STAGE_KEYS.indexOf(stage) + 1] || 'complete';
      set.stage = next;
      if (next === 'complete') set.status = 'complete';
      set.stageHistory = [...(j.stageHistory || []), { stage: next, enteredAt: new Date() }];
      advanced = true;
    }
    const updated = await Journey.findOneAndUpdate({ _id: j._id }, { $set: set }, { new: true });
    if (x.otherId) {
      const me = await User.findById(req.userId).select('profile.firstName').lean();
      await Notification.create({ userId: x.otherId, type: 'journey', title: advanced ? 'Your Setu Journey moved forward' : 'Your match completed a stage',
        body: advanced ? `You both completed "${STAGES.find(s => s.key === stage).label}".` : `${(me && me.profile && me.profile.firstName) || 'Your match'} finished "${STAGES.find(s => s.key === stage).label}". Complete it when you are ready — there is no rush.` }).catch(() => {});
    }
    const u = updated.toObject ? updated.toObject() : updated;
    res.json({ advanced, journey: view(u, req.userId, x.otherId, await otherFirstName(x.chat, x.otherId)) });
  } catch (e) { next(e); }
});

router.post('/:chatId/pause', requireAuth, requireLaunched, async (req, res, next) => {
  try {
    const x = await loadForMember(req, res); if (!x) return;
    if (x.j.status !== 'active') return res.status(409).json({ error: 'The journey is not active' });
    await Journey.findOneAndUpdate({ _id: x.j._id }, { $set: { status: 'paused', pausedBy: String(req.userId), updatedAt: new Date() } });
    res.json({ ok: true, status: 'paused' });
  } catch (e) { next(e); }
});

router.post('/:chatId/resume', requireAuth, requireLaunched, async (req, res, next) => {
  try {
    const x = await loadForMember(req, res); if (!x) return;
    if (x.j.status !== 'paused') return res.status(409).json({ error: 'The journey is not paused' });
    if (String(x.j.pausedBy) !== String(req.userId)) return res.status(403).json({ error: 'Only the person who paused can resume — this respects their pace.' });
    await Journey.findOneAndUpdate({ _id: x.j._id }, { $set: { status: 'active', pausedBy: null, updatedAt: new Date() } });
    res.json({ ok: true, status: 'active' });
  } catch (e) { next(e); }
});

router.get('/:chatId/reflect/questions', requireAuth, requireLaunched, async (req, res, next) => {
  try {
    const x = await loadForMember(req, res); if (!x) return;
    res.json({ questions: REFLECT_QUESTIONS, sharingOptions: SHARING });
  } catch (e) { next(e); }
});

router.put('/:chatId/reflect/answers/:key', requireAuth, requireLaunched, async (req, res, next) => {
  try {
    const x = await loadForMember(req, res); if (!x) return;
    if (!['reflect', 'reflect_again'].includes(x.j.stage)) return res.status(409).json({ error: 'Reflect is not open yet for this journey' });
    const q = REFLECT_QUESTIONS.find(qq => qq.key === req.params.key);
    if (!q) return res.status(404).json({ error: 'Question not found' });
    let norm;
    try { norm = validateAnswer(q, req.body || {}); } catch (e) { return res.status(400).json({ error: e.message }); }
    const sharing = SHARING.includes(req.body.sharing) ? req.body.sharing : 'keep_private';
    const saved = await ReflectionAnswer.findOneAndUpdate(
      { journeyId: x.j._id, userId: req.userId, questionKey: q.key },
      { $set: { value: norm.value, otherText: norm.otherText || null, sharing, updatedAt: new Date() }, $setOnInsert: { journeyId: x.j._id, userId: req.userId, questionKey: q.key, createdAt: new Date() } },
      { upsert: true, new: true }
    );
    const a = saved.toObject ? saved.toObject() : saved;
    res.json({ answer: { questionKey: a.questionKey, value: a.value, otherText: a.otherText || null, sharing: a.sharing } });
  } catch (e) { next(e); }
});

router.patch('/:chatId/reflect/sharing', requireAuth, requireLaunched, async (req, res, next) => {
  try {
    const x = await loadForMember(req, res); if (!x) return;
    const changes = Array.isArray(req.body && req.body.answers) ? req.body.answers : [];
    let n = 0;
    for (const c of changes) {
      if (!SHARING.includes(c.sharing) || !REFLECT_QUESTIONS.some(q => q.key === c.questionKey)) continue;
      const r = await ReflectionAnswer.findOneAndUpdate({ journeyId: x.j._id, userId: req.userId, questionKey: c.questionKey }, { $set: { sharing: c.sharing, updatedAt: new Date() } }, { new: true });
      if (r) n++;
    }
    res.json({ ok: true, updated: n });
  } catch (e) { next(e); }
});

router.get('/:chatId/reflect/progress', requireAuth, requireLaunched, async (req, res, next) => {
  try {
    const x = await loadForMember(req, res); if (!x) return;
    const [mine, theirs] = await Promise.all([
      ReflectionAnswer.find({ journeyId: x.j._id, userId: req.userId }).lean(),
      x.otherId ? ReflectionAnswer.find({ journeyId: x.j._id, userId: x.otherId, sharing: 'share_with_match' }).lean() : []
    ]);
    const shape = (a) => ({ questionKey: a.questionKey, value: a.value, otherText: a.otherText || null, sharing: a.sharing, updatedAt: a.updatedAt });
    const partnerAnswered = x.otherId ? await ReflectionAnswer.countDocuments({ journeyId: x.j._id, userId: x.otherId }) : 0;
    res.json({
      total: REFLECT_QUESTIONS.length, answered: mine.length, complete: mine.length >= REFLECT_QUESTIONS.length,
      partnerAnswered, mine: mine.map(shape), sharedWithMe: theirs.map(shape)
    });
  } catch (e) { next(e); }
});

module.exports = router;

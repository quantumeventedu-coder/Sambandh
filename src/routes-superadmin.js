// routes-superadmin.js — owner-only oversight surface (SUPER_ADMIN_KEY holders).
//
// Privacy protocol (deliberate, keep intact):
//   · Only the super admin — never admins/moderators — can read chat content.
//   · Every content access REQUIRES a written reason and is written to the
//     immutable AuditLog (retained 3 years). The audit trail itself is visible
//     in the super admin panel, so oversight of the overseer is built in.
//   · Lawful basis: investigating illegal activity / imminent harm (IT Rules
//     2021 obligations); this is not a general browsing tool.

const express = require('express');
const mongoose = require('./db/odm');
const User = require('./models/User');
const Chat = require('./models/Chat');
const Message = require('./models/Message');
const Report = require('./models/Report');
const Payment = require('./models/Payment');
const KarmaBook = require('./models/KarmaBook');
const Reputation = require('./models/Reputation');
const Verification = require('./models/Verification');
const Escalation = require('./models/Escalation');
const Notification = require('./models/Notification');
const AuditLog = require('./models/AuditLog');
const llm = require('./services/llm');
const { requireSuperAdmin } = require('./routes-auth');

const router = express.Router();
router.use(requireSuperAdmin);

const audit = (action, targetType, targetId, detail) =>
  AuditLog.create({ actor: 'super-admin', action, targetType, targetId: String(targetId), detail });

const oid = v => mongoose.Types.ObjectId.isValid(v);

// ---- Platform overview ----------------------------------------------------
router.get('/stats', async (req, res, next) => {
  try {
    const dayStart = new Date(Date.now() - 24 * 3600 * 1000);
    const [users, verified, paid, base, pro, max, suspended, banned,
      chats, messages, messages24h, reportsPending, reportsEscalated,
      payments, escalations] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ 'verification.idVerified': true }),
      User.countDocuments({ 'membership.joinFeePaid': true }),
      User.countDocuments({ 'membership.tier': 'base' }),
      User.countDocuments({ 'membership.tier': 'pro' }),
      User.countDocuments({ 'membership.tier': 'max' }),
      User.countDocuments({ 'status.suspended': true }),
      User.countDocuments({ 'status.banned': true }),
      Chat.countDocuments({}),
      Message.countDocuments({}),
      Message.countDocuments({ createdAt: { $gt: dayStart } }),
      Report.countDocuments({ status: 'pending' }),
      Report.countDocuments({ autoEscalated: true, status: { $ne: 'resolved' } }),
      Payment.aggregate([
        { $match: { status: 'captured' } },
        { $group: { _id: null, count: { $sum: 1 }, totalCHF: { $sum: '$amountCHF' } } }
      ]),
      Escalation.countDocuments({})
    ]);
    res.json({
      users: { total: users, verified, paid, base, pro, max, suspended, banned },
      chats: { total: chats, messages, messages24h },
      moderation: { reportsPending, reportsEscalated, karmaEscalations: escalations },
      revenue: { capturedPayments: payments[0]?.count || 0, totalCHF: +(payments[0]?.totalCHF || 0).toFixed(2) }
    });
  } catch (err) { next(err); }
});

// ---- User search & inspection ---------------------------------------------
router.get('/users', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const filter = {};
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ phone: rx }, { 'profile.firstName': rx }, { 'profile.displayName': rx }];
      if (oid(q)) filter.$or.push({ _id: q });
    }
    const users = await User.find(filter).sort({ createdAt: -1 }).limit(25)
      .select('phone profile.firstName profile.displayName profile.gender profile.age profile.city membership.tier membership.joinFeePaid verification.idVerified status createdAt lastActiveAt');
    const books = await KarmaBook.find({ userId: { $in: users.map(u => u._id) } }).select('userId score');
    const scoreBy = Object.fromEntries(books.map(b => [b.userId.toString(), b.score]));
    res.json({
      users: users.map(u => ({
        id: u._id, phone: u.phone,
        name: u.profile?.displayName || u.profile?.firstName || '—',
        gender: u.profile?.gender, age: u.profile?.age, city: u.profile?.city,
        tier: u.membership?.tier || 'free', joinFeePaid: !!u.membership?.joinFeePaid,
        idVerified: !!u.verification?.idVerified,
        karma: scoreBy[u._id.toString()] ?? 100,
        suspended: !!u.status?.suspended, banned: !!u.status?.banned,
        deletedAt: u.status?.deletedAt || null,
        createdAt: u.createdAt, lastActiveAt: u.lastActiveAt
      }))
    });
  } catch (err) { next(err); }
});

router.get('/users/:id', async (req, res, next) => {
  try {
    if (!oid(req.params.id)) return res.status(400).json({ error: 'Invalid user id' });
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const [karma, reputation, payments, reportsAgainst, reportsBy, verifications, chatCount] = await Promise.all([
      KarmaBook.findOne({ userId: user._id }),
      Reputation.findOne({ userId: user._id }),
      Payment.find({ userId: user._id }).sort({ createdAt: -1 }).limit(30),
      Report.find({ reportedUserId: user._id }).sort({ createdAt: -1 }).limit(30),
      Report.find({ reporterId: user._id }).sort({ createdAt: -1 }).limit(30),
      Verification.find({ userId: user._id }).sort({ submittedAt: -1 }).limit(20),
      Chat.countDocuments({ participants: user._id })
    ]);

    // Live Trust & Safety risk assessment for the dossier
    const { assessUser } = require('./services/risk-engine');
    const risk = await assessUser(user._id).catch(() => null);

    await audit('sa_user_viewed', 'user', user._id, { phone: user.phone, riskTier: risk?.tier });
    res.json({ user, karma, reputation, payments, reportsAgainst, reportsBy, verifications, chatCount, risk });
  } catch (err) { next(err); }
});

router.get('/users/:id/chats', async (req, res, next) => {
  try {
    if (!oid(req.params.id)) return res.status(400).json({ error: 'Invalid user id' });
    const chats = await Chat.find({ participants: req.params.id })
      .sort({ lastMessageAt: -1 }).limit(100);
    const otherIds = chats.map(c => c.participants.find(p => p.toString() !== req.params.id)).filter(Boolean);
    const others = await User.find({ _id: { $in: otherIds } }).select('profile.firstName profile.displayName phone');
    const nameBy = Object.fromEntries(others.map(u => [u._id.toString(),
      (u.profile?.displayName || u.profile?.firstName || '—') + ' (' + u.phone + ')']));
    res.json({
      chats: chats.map(c => {
        const other = c.participants.find(p => p.toString() !== req.params.id);
        return {
          chatId: c._id, with: other ? (nameBy[other.toString()] || other) : '—',
          withUserId: other || null,
          messageCount: c.messageCount, lastMessageAt: c.lastMessageAt,
          anonymous: !!c.anonymity?.isAnonymous, status: c.status, intent: c.intent
        };
      })
    });
  } catch (err) { next(err); }
});

// ---- Chat content inspection — reason REQUIRED, always audited -------------
router.get('/chats/:chatId/messages', async (req, res, next) => {
  try {
    if (!oid(req.params.chatId)) return res.status(400).json({ error: 'Invalid chat id' });
    const reason = String(req.query.reason || '').trim();
    if (reason.length < 10) {
      return res.status(400).json({
        error: 'A written reason (min 10 characters) is required to view chat content. It is recorded permanently in the audit log.'
      });
    }
    const chat = await Chat.findById(req.params.chatId);
    if (!chat) return res.status(404).json({ error: 'Chat not found' });

    const participants = await User.find({ _id: { $in: chat.participants } })
      .select('profile.firstName profile.displayName phone');
    const nameBy = Object.fromEntries(participants.map(u => [u._id.toString(),
      u.profile?.displayName || u.profile?.firstName || u.phone]));

    const messages = await Message.find({ chatId: chat._id }).sort({ createdAt: 1 }).limit(500);

    await audit('sa_chat_inspected', 'chat', chat._id, {
      reason,
      participants: chat.participants.map(p => p.toString()),
      messagesReturned: messages.length
    });

    res.json({
      chat: {
        chatId: chat._id, status: chat.status, intent: chat.intent,
        anonymous: !!chat.anonymity?.isAnonymous, messageCount: chat.messageCount,
        participants: chat.participants.map(p => ({ userId: p, name: nameBy[p.toString()] || '—' }))
      },
      messages: messages.map(m => ({
        from: nameBy[m.from.toString()] || m.from, fromId: m.from,
        text: m.deleted ? '[deleted]' : m.text,
        createdAt: m.createdAt, readAt: m.readAt || null
      })),
      auditNote: 'This access was recorded in the audit log with your stated reason.'
    });
  } catch (err) { next(err); }
});

// ---- Emergency account controls (audited, reason required) -----------------
router.post('/users/:id/action', async (req, res, next) => {
  try {
    if (!oid(req.params.id)) return res.status(400).json({ error: 'Invalid user id' });
    const { action } = req.body;
    const reason = String(req.body.reason || '').trim();
    if (reason.length < 5) return res.status(400).json({ error: 'A reason is required for account actions.' });
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const notify = (type, title, body, severity = 'critical') => Notification.create({
      userId: user._id, type, title, body, severity, createdAt: new Date(), read: false
    });

    if (action === 'warn') {
      await notify('moderation_warning', 'Official warning',
        'Your account received an official warning from the Sambandh safety team: ' + reason, 'warning');
    } else if (action === 'suspend_24h' || action === 'suspend_7d') {
      const hours = action === 'suspend_24h' ? 24 : 168;
      await User.findByIdAndUpdate(user._id, {
        'status.suspended': true,
        suspension: { endsAt: new Date(Date.now() + hours * 3600 * 1000), reason }
      });
      await notify('account_suspended', 'Account suspended',
        `Your account is suspended for ${hours} hours. Reason: ${reason}`);
    } else if (action === 'ban') {
      await User.findByIdAndUpdate(user._id, { 'status.banned': true, 'status.active': false });
      await notify('account_suspended', 'Account permanently banned',
        'Your account has been permanently banned. Reason: ' + reason);
    } else if (action === 'unsuspend') {
      await User.findByIdAndUpdate(user._id, { 'status.suspended': false, suspension: null });
    } else if (action === 'unban') {
      await User.findByIdAndUpdate(user._id, { 'status.banned': false, 'status.active': true });
    } else {
      return res.status(400).json({ error: 'Unknown action' });
    }

    await audit('sa_account_action', 'user', user._id, { action, reason });
    res.json({ ok: true, action });
  } catch (err) { next(err); }
});

// ---- The oversight trail ----------------------------------------------------
router.get('/audit', async (req, res, next) => {
  try {
    const limit = Math.min(500, parseInt(req.query.limit) || 100);
    const entries = await AuditLog.find().sort({ createdAt: -1 }).limit(limit).lean();
    res.json({ entries });
  } catch (err) { next(err); }
});

// ---- LLM control plane ------------------------------------------------------
// Owner-only. Turn the model on/off, swap models, rotate the key, meter usage.
// The key is never returned in full (masked only). Config overrides env live.

router.get('/llm', async (req, res, next) => {
  try { res.json(await llm.status()); } catch (err) { next(err); }
});

router.put('/llm', async (req, res, next) => {
  try {
    const body = req.body || {};
    const patch = {};
    if (typeof body.enabled === 'boolean') patch.enabled = body.enabled;
    if (typeof body.model === 'string') patch.model = body.model;
    if (typeof body.maxTokens === 'number') patch.maxTokens = body.maxTokens;
    if (body.temperature === null || typeof body.temperature === 'number') patch.temperature = body.temperature;
    if (body.features && typeof body.features === 'object') patch.features = body.features;
    if (typeof body.apiKey === 'string') patch.apiKey = body.apiKey; // '' ignored, 'CLEAR' removes
    const status = await llm.updateConfig(patch);
    // Never log the key itself — only which fields changed.
    await audit('llm_config_updated', 'AppConfig', 'singleton',
      'fields: ' + Object.keys(patch).filter(k => k !== 'apiKey').join(',') +
      (typeof body.apiKey === 'string' && body.apiKey ? ' (+apiKey)' : ''));
    res.json(status);
  } catch (err) { next(err); }
});

router.post('/llm/test', async (req, res, next) => {
  try {
    const r = await llm.test();
    res.json(r);
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// ---- Reusable AI API keys ---------------------------------------------------
const ApiKey = require('./models/ApiKey');

router.get('/ai-keys', async (req, res, next) => {
  try {
    const keys = await ApiKey.find().sort({ createdAt: -1 }).lean();
    res.json({
      keys: keys.map(k => ({
        id: k._id, name: k.name, prefix: k.prefix, disabled: !!k.disabled,
        calls: k.calls || 0, inputTokens: k.inputTokens || 0, outputTokens: k.outputTokens || 0,
        rateLimitPerMin: k.rateLimitPerMin || 60,
        lastUsedAt: k.lastUsedAt, createdAt: k.createdAt
      }))
    });
  } catch (err) { next(err); }
});

router.post('/ai-keys', async (req, res, next) => {
  try {
    const name = String(req.body?.name || '').trim().slice(0, 60);
    if (!name) return res.status(400).json({ error: 'A name is required' });
    const { generateKey } = require('./routes-ai');
    const { plaintext, prefix, keyHash } = generateKey();
    const doc = await ApiKey.create({
      name, prefix, keyHash,
      rateLimitPerMin: Math.min(Math.max(parseInt(req.body?.rateLimitPerMin) || 60, 1), 6000)
    });
    await audit('ai_key_created', 'ApiKey', doc._id, `name: ${name}`);
    // Plaintext is returned ONCE and never stored.
    res.json({ id: doc._id, name, prefix, key: plaintext });
  } catch (err) { next(err); }
});

router.post('/ai-keys/:id/toggle', async (req, res, next) => {
  try {
    if (!oid(req.params.id)) return res.status(400).json({ error: 'Bad id' });
    const doc = await ApiKey.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    doc.disabled = !doc.disabled;
    await doc.save();
    await audit('ai_key_toggled', 'ApiKey', doc._id, doc.disabled ? 'disabled' : 'enabled');
    res.json({ ok: true, disabled: doc.disabled });
  } catch (err) { next(err); }
});

router.delete('/ai-keys/:id', async (req, res, next) => {
  try {
    if (!oid(req.params.id)) return res.status(400).json({ error: 'Bad id' });
    await ApiKey.deleteOne({ _id: req.params.id });
    await audit('ai_key_revoked', 'ApiKey', req.params.id, '');
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ---- Self-learning match model ---------------------------------------------
const trainer = require('./services/trainer');
const AppConfig = require('./models/AppConfig');

router.get('/ai/model', async (req, res, next) => {
  try {
    const s = await trainer.stats();
    const doc = await AppConfig.findOne({ key: 'singleton' }).select('learnedModel.auto neuralMeta.auto').lean();
    res.json({ ...s, auto: !!doc?.learnedModel?.auto, neuralAuto: !!doc?.neuralMeta?.auto });
  } catch (err) { next(err); }
});

router.post('/ai/train', async (req, res, next) => {
  try {
    // mode: 'logistic' | 'neural' | 'both' (default). Trains the requested models
    // on the SAME organic swipe data and reports both, plus which now serves.
    const mode = req.body?.mode || 'both';
    const out = {};
    if (mode === 'logistic' || mode === 'both') out.logistic = await trainer.train({ minExamples: 40 });
    if (mode === 'neural' || mode === 'both') {
      out.neural = await trainer.trainNeural({ minExamples: 60 }).catch(e => ({ trained: false, reason: e.message }));
    }
    const parts = [];
    if (out.logistic) parts.push(`logistic: ${out.logistic.trained ? `acc ${out.logistic.accuracy}` : out.logistic.reason}`);
    if (out.neural) parts.push(`neural: ${out.neural.trained ? `acc ${out.neural.accuracy}, ${out.neural.paramCount} params` : out.neural.reason}`);
    await audit('ai_model_trained', 'AppConfig', 'singleton', parts.join(' | '));
    const s = await trainer.stats();
    // Keep the logistic result at top level for backward-compatibility with the panel.
    res.json({ ...(out.logistic || {}), logistic: out.logistic, neural: out.neural, active: s.active });
  } catch (err) { next(err); }
});

router.get('/ai/explain', async (req, res, next) => {
  try { res.json(await trainer.neuralExplain()); } catch (err) { next(err); }
});

// Behavioural intelligence for one user (oversight): activity/consistency/drift/habits.
const eventsSvc = require('./services/events');
const behaviorEngine = require('./services/behavior-engine');
router.get('/behavior/:userId', async (req, res, next) => {
  try {
    const report = await eventsSvc.behaviorFor(req.params.userId);
    res.json({ report, insights: behaviorEngine.summarize(report), events: await eventsSvc.countFor(req.params.userId) });
  } catch (err) { next(err); }
});

router.put('/ai/model', async (req, res, next) => {
  try {
    if (typeof req.body?.auto === 'boolean') {
      await AppConfig.findOneAndUpdate({ key: 'singleton' },
        { $set: { 'learnedModel.auto': req.body.auto } }, { upsert: true });
      await audit('ai_model_config', 'AppConfig', 'singleton', 'logistic auto: ' + req.body.auto);
    }
    if (typeof req.body?.neuralAuto === 'boolean') {
      await AppConfig.findOneAndUpdate({ key: 'singleton' },
        { $set: { 'neuralMeta.auto': req.body.neuralAuto } }, { upsert: true });
      await audit('ai_model_config', 'AppConfig', 'singleton', 'neural auto: ' + req.body.neuralAuto);
    }
    const s = await trainer.stats();
    const doc = await AppConfig.findOne({ key: 'singleton' }).select('learnedModel.auto neuralMeta.auto').lean();
    res.json({ ...s, auto: !!doc?.learnedModel?.auto, neuralAuto: !!doc?.neuralMeta?.auto });
  } catch (err) { next(err); }
});

// ---- System self-test — exercise every subsystem, unrestricted (owner QA) ----
router.get('/selftest', async (req, res, next) => {
  try {
    const checks = [];
    const run = async (name, group, fn) => {
      try { const detail = await fn(); checks.push({ name, group, ok: true, detail: detail || 'ok' }); }
      catch (e) { checks.push({ name, group, ok: false, detail: e.message }); }
    };
    const need = (v, msg) => { if (!v) throw new Error(msg || 'failed'); return true; };

    // Data layer
    await run('Database connection', 'Core', async () => { need(mongoose.connection.readyState === 1, 'not connected'); return 'connected'; });
    await run('Collections', 'Core', async () => { const Room = require('./models/Room'); const [u, r, p] = await Promise.all([User.countDocuments(), Room.countDocuments(), Payment.countDocuments()]); return `${u} users · ${r} rooms · ${p} payments`; });

    // Astrology
    const sampleBirth = { birthDate: '1995-08-12', birthTime: '07:15', birthPlace: { city: 'Delhi', lat: 28.7, lng: 77.1 } };
    await run('Astrology — birth chart', 'Astrology', async () => { const e = require('./services/astro-engine'); const c = e.computeChart(sampleBirth); need(c && c.planets && c.planets.Sun, 'no planets'); return `Lagna ${c.lagna ? c.lagna.signName : '—'}, Moon ${c.moonSign}, ${Object.keys(c.planets).length} bodies, D9/D10 ${c.planets.Sun.navamsa}/${c.planets.Sun.dasamsa}, dasha ${c.dasha.current && c.dasha.current.lord}`; });
    await run('Astrology — panchang / muhurta / transits', 'Astrology', async () => { const e = require('./services/astro-engine'); const c = e.computeChart(sampleBirth); return `panchang ${e.panchang().tithi} · muhurta(business) ${e.muhurta('business').verdict} · SadeSati ${e.transits(c).sadeSati}`; });
    await run('Astrology — relationship compat (3 lenses)', 'Astrology', async () => { const e = require('./services/astro-engine'); const a = e.computeChart(sampleBirth); return ['romance', 'friendship', 'business'].map(t => `${t}:${e.relationshipCompat(a, a, t).score}%`).join(' · '); });

    // Intelligence + safety
    await run('Flag engine — blocks money request', 'Intelligence', async () => { const f = require('./services/flag-engine'); const s = f.scan({ messages: [{ text: 'send me money on upi', createdAt: new Date() }] }); need(s.flags.some(x => x.ruleId === 'MONEY_REQUEST_RULE'), 'did not flag'); return `${f.RED_FLAG_RULES.length} rules · flagged ${s.flags.length}`; });
    await run('Psychology — attachment/OCEAN/love-language', 'Intelligence', async () => { const p = require('./services/psychology'); const r = p.analyze([{ text: 'hello there', createdAt: new Date(), fromMe: true }]); return `runs (attachment: ${r.attachment.style})`; });
    await run('Compatibility formula', 'Intelligence', async () => { const c = require('./services/compatibility'); const r = c.computeCompatibility({ karmaGradeA: 'A', karmaGradeB: 'A' }); need(r.score >= 0 && r.score <= 99, 'bad score'); return `score ${r.score} · ${r.components.length} components`; });
    await run('Nakshatra intelligence', 'Intelligence', async () => { const i = require('./services/intelligence'); const n = i.nakshatraProfile({ astrology: sampleBirth }); return n ? n.headline : 'no chart'; });
    await run('Lakshan rule engine', 'Intelligence', async () => { require('./karma-book'); return 'loaded'; });
    await run('Recommender', 'Intelligence', async () => { const r = require('./services/recommender'); need(typeof r.score === 'function', 'no score fn'); return 'loaded'; });
    await run('Risk engine', 'Intelligence', async () => { const r = require('./services/risk-engine'); const x = r.computeRiskScore({ idVerified: false, accountAgeDays: 0.5, karmaScore: 100, redFlags: {} }); return `sample risk ${x.score}/${x.tier}`; });
    await run('NSFW moderation', 'Intelligence', async () => { const m = require('./services/moderation'); const d = m.classifyDecision({ porn: 0.9, hentai: 0.1, sexy: 0.2, neutral: 0.1, drawing: 0.1 }); return `explicit → ${d.decision}`; });

    // Auth security engines
    await run('2FA (TOTP RFC-6238)', 'Auth', async () => { const t = require('./services/twofa'); const code = t.currentTotp ? t.currentTotp('JBSWY3DPEHPK3PXP') : null; return code ? `code ${code}` : 'loaded'; });
    await run('WebAuthn passkeys', 'Auth', async () => { require('./services/webauthn'); return 'loaded'; });
    await run('Own face engine', 'Auth', async () => { const f = require('./services/face-engine'); need(typeof f.faceDistance === 'function', 'no faceDistance'); return 'loaded'; });

    // External integrations (report configured vs fallback)
    await run('AI engine (LLM)', 'Integrations', async () => process.env.ANTHROPIC_API_KEY ? 'server key set (panel key may override)' : 'no key — deterministic rule engines active');
    await run('Payments (Razorpay)', 'Integrations', async () => process.env.RAZORPAY_KEY_ID ? (process.env.RAZORPAY_KEY_ID.startsWith('rzp_live') ? 'LIVE keys ✓' : 'test/dev keys') : 'not set — simulated');
    await run('Email (SMTP)', 'Integrations', async () => (process.env.SMTP_HOST || process.env.SMTP_URL) ? 'configured' : 'dev transport — no real send');
    await run('Photo storage', 'Integrations', async () => (process.env.R2_ACCOUNT_ID || process.env.SUPABASE_URL) ? 'configured' : 'local/tmp — ephemeral on serverless');
    await run('Google sign-in', 'Integrations', async () => process.env.GOOGLE_CLIENT_ID ? 'configured' : 'not set — button hidden');

    const passed = checks.filter(c => c.ok).length;
    await audit('selftest_run', 'system', 'selftest', { passed, total: checks.length });
    res.json({ checks, summary: { passed, total: checks.length, allGreen: passed === checks.length } });
  } catch (err) { next(err); }
});

module.exports = router;

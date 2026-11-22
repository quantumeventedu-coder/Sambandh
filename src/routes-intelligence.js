// routes-intelligence.js — the Sambandh Setu Intelligence API.
//
// Mounted at /api/intelligence (and /api/v1/intelligence). One API for every
// client — website, Android, iOS — so memory, conversations, the knowledge graph
// and Lakshan are shared across devices. Owner-scoping happens in the engine
// modules; every route here also requires an authenticated member.
//
// Super-admin operations live on `adminRouter`, mounted at
// /api/superadmin/intelligence behind SUPER_ADMIN_KEY. Admin views are
// aggregate-only — they never expose conversation or memory content.

const express = require('express');
const rateLimit = require('express-rate-limit');
const { requireAuth, requireAdmin } = require('./routes-auth');
const assistant = require('./intelligence/assistant');
const memory = require('./intelligence/memory');
const graph = require('./intelligence/graph');
const web = require('./intelligence/web');
const agent = require('./intelligence/agent');
const jobs = require('./intelligence/jobs');
const lakshan = require('./intelligence/lakshan');
const learning = require('./intelligence/learning');
const registry = require('./intelligence/models/registry');
const gateway = require('./intelligence/models/gateway');
const metrics = require('./intelligence/metrics');
const config = require('./intelligence/config');
const searchMod = require('./intelligence/web/search');
const { validateUrl } = require('./intelligence/web/safe-fetch');

const router = express.Router();
const isId = (v) => /^[0-9a-fA-F]{24}$/.test(String(v || ''));
const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });

function perUser(max, windowMs = 60000) {
  return rateLimit({
    windowMs, max, standardHeaders: true, legacyHeaders: false,
    keyGenerator: (req) => 'u:' + (req.userId || req.ip),
    message: { error: 'Too many requests — please slow down a little.' }
  });
}
const chatLimit = perUser(30);
const webLimit = perUser(10);

function handle(fn) {
  return async (req, res, next) => {
    try { await fn(req, res, next); }
    catch (err) {
      if (err && err.status && err.status < 500) return res.status(err.status).json({ error: err.message });
      next(err);
    }
  };
}

// ---------------- status & settings ----------------
router.get('/status', requireAuth, handle(async (req, res) => {
  const cfg = await config.get();
  const models = await registry.all();
  const chatModels = models.filter(m => m.enabled !== false && (m.tasks || []).includes('chat'));
  const selfHosted = chatModels.filter(m => ['openai', 'ollama'].includes(m.provider));
  const sp = await searchMod.provider();
  res.json({
    assistant: cfg.assistantEnabled, memory: cfg.memoryEnabled,
    mode: selfHosted.length ? 'model' : 'basic',
    webResearch: cfg.webResearchEnabled && sp.name !== 'none', searchProvider: sp.name
  });
}));

router.get('/settings', requireAuth, handle(async (req, res) => res.json(await assistant.getSettings(req.userId))));
router.patch('/settings', requireAuth, handle(async (req, res) => res.json(await assistant.updateSettings(req.userId, req.body || {}))));

// ---------------- assistant ----------------
router.get('/assistant/conversations', requireAuth, handle(async (req, res) => {
  res.json({ conversations: await assistant.listConversations(req.userId, { limit: Number(req.query.limit) || 50 }) });
}));

router.post('/assistant/conversations', requireAuth, handle(async (req, res) => {
  const ctx = req.body && req.body.context;
  if (ctx && ctx.refId && !isId(ctx.refId)) return bad(res, 'invalid context reference');
  const c = await assistant.createConversation(req.userId, { context: ctx, title: req.body && req.body.title });
  res.status(201).json({ id: String(c._id), title: c.title, context: c.context });
}));

router.get('/assistant/conversations/:id', requireAuth, handle(async (req, res) => {
  if (!isId(req.params.id)) return bad(res, 'invalid id');
  const c = await assistant.getConversation(req.userId, req.params.id);
  if (!c) return bad(res, 'Conversation not found', 404);
  res.json(c);
}));

router.delete('/assistant/conversations/:id', requireAuth, handle(async (req, res) => {
  if (!isId(req.params.id)) return bad(res, 'invalid id');
  const n = await assistant.deleteConversation(req.userId, req.params.id);
  if (!n) return bad(res, 'Conversation not found', 404);
  res.json({ ok: true });
}));

router.delete('/assistant/conversations', requireAuth, handle(async (req, res) => {
  if (!(req.body && req.body.confirm === true)) return bad(res, 'Send { "confirm": true } to clear all conversation history');
  res.json({ ok: true, deleted: await assistant.clearHistory(req.userId) });
}));

function parseAsk(req) {
  const b = req.body || {};
  if (b.conversationId && !isId(b.conversationId)) throw Object.assign(new Error('invalid conversationId'), { status: 400 });
  if (b.context && b.context.refId && !isId(b.context.refId)) throw Object.assign(new Error('invalid context reference'), { status: 400 });
  if (typeof b.message !== 'string' || !b.message.trim()) throw Object.assign(new Error('message is required'), { status: 400 });
  if (b.message.length > 4000) throw Object.assign(new Error('message is too long (max 4000 characters)'), { status: 400 });
  return { conversationId: b.conversationId || null, message: b.message, context: b.context || null, webMode: ['on', 'off', 'auto'].includes(b.web) ? b.web : 'auto' };
}

router.post('/assistant/message', requireAuth, chatLimit, handle(async (req, res) => {
  const ask = parseAsk(req);
  res.json(await assistant.respond({ userId: req.userId, ...ask }));
}));

// Server-Sent Events: meta → status → token… → sources → memory → done.
router.post('/assistant/stream', requireAuth, chatLimit, handle(async (req, res) => {
  const ask = parseAsk(req);
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('X-Accel-Buffering', 'no');
  if (res.flushHeaders) res.flushHeaders();
  const send = (event, data) => { try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch { /* client gone */ } };
  try {
    const out = await assistant.respond({ userId: req.userId, ...ask, onEvent: send });
    send('done', out);
  } catch (err) {
    send('error', { error: err.status && err.status < 500 ? err.message : 'Setu Guide could not answer right now.' });
  }
  res.end();
}));

router.post('/assistant/messages/:id/feedback', requireAuth, handle(async (req, res) => {
  if (!isId(req.params.id)) return bad(res, 'invalid id');
  const b = req.body || {};
  if (b.memoryId && !isId(b.memoryId)) return bad(res, 'invalid memoryId');
  const r = await learning.recordFeedback(req.userId, req.params.id, { rating: b.rating, reason: b.reason, correction: b.correction, memoryId: b.memoryId });
  if (!r) return bad(res, 'Message not found', 404);
  res.json(r);
}));

// ---------------- memory ----------------
router.get('/memory', requireAuth, handle(async (req, res) => {
  const cat = ['episodic', 'semantic', 'project', 'procedural', 'explicit'].includes(req.query.category) ? req.query.category : null;
  res.json({ memories: await memory.list(req.userId, { category: cat, limit: Number(req.query.limit) || 200 }) });
}));

router.get('/memory/export', requireAuth, handle(async (req, res) => {
  const [mem, ents] = await Promise.all([memory.exportAll(req.userId), require('./models/KGEntity').find({ userId: req.userId }).lean()]);
  res.setHeader('Content-Disposition', 'attachment; filename="sambandh-setu-memory.json"');
  res.json({ exportedAt: new Date(), memories: mem, entities: ents.map(e => ({ id: String(e._id), type: e.type, name: e.name, aliases: e.aliases, firstSeenAt: e.firstSeenAt, lastSeenAt: e.lastSeenAt })) });
}));

router.post('/memory', requireAuth, handle(async (req, res) => {
  const b = req.body || {};
  if (typeof b.text !== 'string' || b.text.trim().length < 2) return bad(res, 'text is required');
  const r = await memory.remember(req.userId, { category: 'explicit', kind: b.kind || 'note', text: b.text, origin: 'explicit', source: { kind: 'explicit' }, expiresAt: b.expiresAt || null });
  res.status(201).json(r);
}));

router.post('/memory/search', requireAuth, handle(async (req, res) => {
  const q = String((req.body && req.body.query) || '').slice(0, 500);
  if (!q.trim()) return bad(res, 'query is required');
  res.json({ results: await memory.retrieve(req.userId, q, { limit: 10, touch: false }) });
}));

router.patch('/memory/:id', requireAuth, handle(async (req, res) => {
  if (!isId(req.params.id)) return bad(res, 'invalid id');
  const m = await memory.correct(req.userId, req.params.id, { text: req.body && req.body.text, reason: 'user_edit' });
  if (!m) return bad(res, 'Memory not found', 404);
  res.json({ memory: m });
}));

router.get('/memory/:id/history', requireAuth, handle(async (req, res) => {
  if (!isId(req.params.id)) return bad(res, 'invalid id');
  const h = await memory.historyOf(req.userId, req.params.id);
  if (!h) return bad(res, 'Memory not found', 404);
  res.json(h);
}));

router.post('/memory/:id/resolve', requireAuth, handle(async (req, res) => {
  if (!isId(req.params.id)) return bad(res, 'invalid id');
  const m = await memory.resolve(req.userId, req.params.id);
  if (!m) return bad(res, 'Memory not found', 404);
  res.json({ memory: m });
}));

router.delete('/memory/:id', requireAuth, handle(async (req, res) => {
  if (!isId(req.params.id)) return bad(res, 'invalid id');
  const n = await memory.forget(req.userId, req.params.id);
  if (!n) return bad(res, 'Memory not found', 404);
  res.json({ ok: true });
}));

router.delete('/memory', requireAuth, handle(async (req, res) => {
  if (!(req.body && req.body.confirm === true)) return bad(res, 'Send { "confirm": true } to delete every memory');
  const n = await memory.forgetAll(req.userId);
  await require('./models/KGRelation').deleteMany({ userId: req.userId });
  await require('./models/KGEntity').deleteMany({ userId: req.userId });
  res.json({ ok: true, deleted: n });
}));

router.get('/context/open-items', requireAuth, handle(async (req, res) => res.json({ items: await memory.openItems(req.userId) })));

// ---------------- knowledge graph ----------------
router.get('/graph/entities', requireAuth, handle(async (req, res) => {
  const KGEntity = require('./models/KGEntity');
  const q = { userId: req.userId };
  if (req.query.type) q.type = String(req.query.type);
  const rows = await KGEntity.find(q).sort({ lastSeenAt: -1 }).limit(300).lean();
  res.json({ entities: rows.filter(e => e.normName !== 'me').map(e => ({ id: String(e._id), type: e.type, name: e.name, aliases: e.aliases || [], mentions: e.mentions, firstSeenAt: e.firstSeenAt, lastSeenAt: e.lastSeenAt })) });
}));

router.get('/graph/entities/:id', requireAuth, handle(async (req, res) => {
  if (!isId(req.params.id)) return bad(res, 'invalid id');
  const e = await require('./models/KGEntity').findOne({ _id: req.params.id, userId: req.userId }).lean();
  if (!e) return bad(res, 'Entity not found', 404);
  res.json({ entity: { id: String(e._id), type: e.type, name: e.name, aliases: e.aliases || [], mentions: e.mentions, firstSeenAt: e.firstSeenAt, lastSeenAt: e.lastSeenAt }, relations: await graph.timeline(req.userId, req.params.id) });
}));

router.delete('/graph/entities/:id', requireAuth, handle(async (req, res) => {
  if (!isId(req.params.id)) return bad(res, 'invalid id');
  const n = await graph.removeEntity(req.userId, req.params.id);
  if (!n) return bad(res, 'Entity not found', 404);
  res.json({ ok: true });
}));

// ---------------- web intelligence ----------------
router.post('/web/search', requireAuth, webLimit, handle(async (req, res) => {
  const q = String((req.body && req.body.query) || '').trim().slice(0, 300);
  if (!q) return bad(res, 'query is required');
  const settings = await assistant.getSettings(req.userId);
  if (!settings.webResearch) return bad(res, 'Web research is turned off in your Setu Guide settings', 403);
  const r = await searchMod.search(q);
  res.json(r);
}));

router.post('/web/read', requireAuth, webLimit, handle(async (req, res) => {
  const url = String((req.body && req.body.url) || '').trim();
  try { validateUrl(url); } catch (e) { return bad(res, e.message); }
  const settings = await assistant.getSettings(req.userId);
  if (!settings.webResearch) return bad(res, 'Web research is turned off in your Setu Guide settings', 403);
  const d = await web.fetchDocument(url);
  if (!d.ok) return bad(res, 'Could not read that page: ' + d.error, 422);
  res.json({ url: d.url, finalUrl: d.finalUrl, title: d.title, meta: d.meta, excerpt: d.text.slice(0, 4000), length: d.text.length, cached: d.cached });
}));

router.post('/research', requireAuth, webLimit, handle(async (req, res) => {
  const q = String((req.body && req.body.question) || '').trim();
  if (q.length < 5) return bad(res, 'question is required');
  const settings = await assistant.getSettings(req.userId);
  if (!settings.webResearch) return bad(res, 'Web research is turned off in your Setu Guide settings', 403);
  const job = await agent.startResearch(req.userId, q);
  // Kick the worker so research starts promptly even on serverless hosts.
  jobs.drain({ maxJobs: 1, budgetMs: 1000 }).catch(() => {});
  res.status(202).json({ jobId: String(job._id), status: 'queued' });
}));

router.get('/research/:id', requireAuth, handle(async (req, res) => {
  if (!isId(req.params.id)) return bad(res, 'invalid id');
  const j = await jobs.get(req.params.id, req.userId);
  if (!j || j.type !== 'research') return bad(res, 'Research job not found', 404);
  res.json({ id: String(j._id), status: j.status, progress: j.progress || [], result: j.result || null, error: j.status === 'failed' ? j.error : null, createdAt: j.createdAt, finishedAt: j.finishedAt || null });
}));

router.post('/research/:id/cancel', requireAuth, handle(async (req, res) => {
  if (!isId(req.params.id)) return bad(res, 'invalid id');
  const j = await jobs.cancel(req.params.id, req.userId);
  if (!j) return bad(res, 'Research job not found', 404);
  res.json({ id: String(j._id), status: j.status, cancelRequested: !!j.cancelRequested });
}));

// ---------------- Lakshan (own assessments; human review) ----------------
router.get('/lakshan/assessments', requireAuth, handle(async (req, res) => res.json({ assessments: await lakshan.listForSubject(req.userId) })));

router.get('/lakshan/assessments/:id', requireAuth, handle(async (req, res) => {
  if (!isId(req.params.id)) return bad(res, 'invalid id');
  const a = await lakshan.getForSubject(req.userId, req.params.id);
  if (!a) return bad(res, 'Assessment not found', 404);
  res.json(a);
}));

router.post('/lakshan/assessments/:id/respond', requireAuth, handle(async (req, res) => {
  if (!isId(req.params.id)) return bad(res, 'invalid id');
  const a = await lakshan.respond(req.userId, req.params.id, { action: req.body && req.body.action, text: req.body && req.body.text });
  if (!a) return bad(res, 'Assessment not found', 404);
  res.json(a);
}));

router.get('/lakshan/review-queue', requireAdmin, handle(async (req, res) => res.json({ queue: await lakshan.reviewQueue({ limit: Number(req.query.limit) || 50 }) })));

router.post('/lakshan/assessments/:id/review', requireAdmin, handle(async (req, res) => {
  if (!isId(req.params.id)) return bad(res, 'invalid id');
  const a = await lakshan.review(req.params.id, { decision: req.body && req.body.decision, notes: req.body && req.body.notes, by: req.userId || 'moderator' });
  if (!a) return bad(res, 'Assessment not found', 404);
  res.json(a);
}));

// ---------------- background jobs (cron) ----------------
// Vercel Cron calls GET with "Authorization: Bearer $CRON_SECRET".
async function drainHandler(req, res) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.authorization || '';
  const given = req.headers['x-cron-secret'] || (auth.startsWith('Bearer ') ? auth.slice(7) : '');
  if (!secret || given !== secret) return res.status(401).json({ error: 'cron secret required' });
  const r = await jobs.drain({ maxJobs: 10, budgetMs: 50000 });
  if (req.query.maintenance === '1') r.maintenance = await learning.maintenance();
  await metrics.flush();
  res.json(r);
}
router.get('/jobs/drain', handle(drainHandler));
router.post('/jobs/drain', handle(drainHandler));

// ======================= super-admin =======================
const adminRouter = express.Router();

adminRouter.get('/overview', handle(async (req, res) => {
  const Memory = require('./models/Memory');
  const KGEntity = require('./models/KGEntity');
  const KGRelation = require('./models/KGRelation');
  const AssistantConversation = require('./models/AssistantConversation');
  const LakshanAssessment = require('./models/LakshanAssessment');
  const [health, history, jobStats, quality, cfg, sp, memCount, entCount, relCount, convCount, lak] = await Promise.all([
    gateway.health({ force: req.query.refresh === '1' }), metrics.history(14), jobs.stats(), learning.qualityStats(), config.get(), searchMod.provider(),
    Memory.countDocuments({ status: 'active' }), KGEntity.countDocuments({}), KGRelation.countDocuments({}), AssistantConversation.countDocuments({}),
    LakshanAssessment.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }])
  ]);
  res.json({
    generatedAt: new Date(), models: health.models, breakers: health.breakers, live: metrics.snapshot(), history,
    jobs: jobStats, quality, totals: { memories: memCount, entities: entCount, relations: relCount, conversations: convCount },
    lakshan: Object.fromEntries(lak.map(x => [x._id, x.count])),
    config: { assistantEnabled: cfg.assistantEnabled, memoryEnabled: cfg.memoryEnabled, webResearchEnabled: cfg.webResearchEnabled, searchProvider: sp.name, research: cfg.research },
    note: 'Aggregates only. No conversation, memory or query content is exposed here.'
  });
}));

adminRouter.get('/models', handle(async (req, res) => res.json({ models: (await registry.all({ force: true })).map(m => ({ ...m, apiKeyEnv: m.apiKeyEnv || null })) })));

function cleanModelBody(b, { partial = false } = {}) {
  const out = {};
  if (!partial || b.provider != null) { if (!['openai', 'ollama', 'anthropic'].includes(b.provider)) throw Object.assign(new Error('provider must be openai, ollama or anthropic'), { status: 400 }); out.provider = b.provider; }
  if (b.baseUrl != null) { if (b.baseUrl && !/^https?:\/\/[^\s]+$/i.test(b.baseUrl)) throw Object.assign(new Error('baseUrl must be an http(s) URL'), { status: 400 }); out.baseUrl = String(b.baseUrl); }
  if (b.model != null) out.model = String(b.model).slice(0, 120);
  if (b.label != null) out.label = String(b.label).slice(0, 80);
  if (Array.isArray(b.tasks)) out.tasks = b.tasks.filter(t => ['chat', 'reasoning', 'extraction', 'classification', 'summarization', 'embedding'].includes(t));
  if (['small', 'large'].includes(b.tier)) out.tier = b.tier;
  if (Number.isFinite(b.priority)) out.priority = Math.max(1, Math.min(999, b.priority));
  if (typeof b.enabled === 'boolean') out.enabled = b.enabled;
  for (const k of ['version', 'quantization']) if (b[k] != null) out[k] = String(b[k]).slice(0, 60);
  for (const k of ['contextWindow', 'maxTokens', 'timeoutMs']) if (Number.isFinite(b[k])) out[k] = b[k];
  if (b.capabilities && typeof b.capabilities === 'object') out.capabilities = { tools: !!b.capabilities.tools, json: b.capabilities.json !== false, stream: b.capabilities.stream !== false };
  if (b.apiKeyEnv != null) { if (b.apiKeyEnv && !/^[A-Z][A-Z0-9_]{2,60}$/.test(b.apiKeyEnv)) throw Object.assign(new Error('apiKeyEnv must be an ENV_VAR_NAME (keys are never stored in the database)'), { status: 400 }); out.apiKeyEnv = b.apiKeyEnv || undefined; }
  if (out.provider === 'anthropic' && out.priority == null) out.priority = 500;
  return out;
}

adminRouter.post('/models', handle(async (req, res) => {
  const IntelligenceModel = require('./models/IntelligenceModel');
  const b = req.body || {};
  if (!/^[a-z0-9][a-z0-9_-]{1,40}$/.test(String(b.modelKey || ''))) return bad(res, 'modelKey must be lowercase letters, digits, - or _');
  if (b.modelKey === 'setu-core') return bad(res, 'setu-core is built in');
  const doc = { modelKey: b.modelKey, ...cleanModelBody(b), updatedAt: new Date() };
  const saved = await IntelligenceModel.findOneAndUpdate({ modelKey: b.modelKey }, { $set: doc, $setOnInsert: { createdAt: new Date() } }, { upsert: true, new: true });
  registry.invalidate();
  await require('./models/AuditLog').create({ actor: 'super-admin', action: 'intelligence_model_saved', targetType: 'model', targetId: b.modelKey }).catch(() => {});
  res.status(201).json({ model: saved.toObject ? saved.toObject() : saved });
}));

adminRouter.patch('/models/:key', handle(async (req, res) => {
  const IntelligenceModel = require('./models/IntelligenceModel');
  const upd = cleanModelBody(req.body || {}, { partial: true });
  const existing = (await registry.all({ force: true })).find(m => m.modelKey === req.params.key);
  if (!existing || existing.provider === 'builtin') return bad(res, 'Model not found (the built-in model cannot be edited)', 404);
  const saved = await IntelligenceModel.findOneAndUpdate({ modelKey: req.params.key }, { $set: { ...upd, updatedAt: new Date() }, $setOnInsert: { modelKey: req.params.key, provider: existing.provider } }, { upsert: true, new: true });
  registry.invalidate();
  await require('./models/AuditLog').create({ actor: 'super-admin', action: 'intelligence_model_updated', targetType: 'model', targetId: req.params.key, detail: Object.keys(upd) }).catch(() => {});
  res.json({ model: saved.toObject ? saved.toObject() : saved });
}));

adminRouter.delete('/models/:key', handle(async (req, res) => {
  const IntelligenceModel = require('./models/IntelligenceModel');
  const r = await IntelligenceModel.deleteOne({ modelKey: req.params.key });
  registry.invalidate();
  res.json({ ok: true, deleted: (r && (r.deletedCount != null ? r.deletedCount : r.n)) || 0 });
}));

adminRouter.post('/models/:key/test', handle(async (req, res) => {
  const cfgs = await registry.all({ force: true });
  const cfg = cfgs.find(m => m.modelKey === req.params.key);
  if (!cfg) return bad(res, 'Model not found', 404);
  const { providerFor } = require('./intelligence/models/providers');
  const p = providerFor(cfg.provider);
  const out = { modelKey: cfg.modelKey };
  try { out.health = await p.health(cfg); } catch (e) { out.health = { ok: false, error: e.message }; }
  if ((cfg.tasks || []).some(t => t !== 'embedding')) {
    const t0 = Date.now();
    try { const r = await p.chat(cfg, { messages: [{ role: 'user', content: 'Reply with the single word: OK' }], maxTokens: 5, temperature: 0 }); out.chat = { ok: true, latencyMs: Date.now() - t0, sample: String(r.text).slice(0, 40) }; }
    catch (e) { out.chat = { ok: false, error: e.message }; }
  }
  if ((cfg.tasks || []).includes('embedding')) {
    try { const r = await p.embed(cfg, { input: ['test'] }); out.embedding = { ok: true, dims: r.vectors && r.vectors[0] ? r.vectors[0].length : 0 }; }
    catch (e) { out.embedding = { ok: false, error: e.message }; }
  }
  res.json(out);
}));

adminRouter.get('/config', handle(async (req, res) => res.json(await config.get({ force: true }))));
adminRouter.patch('/config', handle(async (req, res) => {
  const next = await config.update(req.body || {});
  await require('./models/AuditLog').create({ actor: 'super-admin', action: 'intelligence_config_updated', targetType: 'config', detail: Object.keys(req.body || {}) }).catch(() => {});
  res.json(next);
}));
adminRouter.post('/jobs/drain', handle(async (req, res) => res.json(await jobs.drain({ maxJobs: 10, budgetMs: 30000 }))));
adminRouter.post('/maintenance', handle(async (req, res) => res.json(await learning.maintenance())));

module.exports = router;
module.exports.adminRouter = adminRouter;

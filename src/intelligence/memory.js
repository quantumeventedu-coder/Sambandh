// intelligence/memory.js — permission-aware persistent memory.
//
// Categories: episodic (events, decisions) · semantic (preferences, facts, goals)
// · project (tasks, deadlines, requirements, commitments) · procedural (how the
// user does things) · explicit (things the user asked us to remember).
// Short-term context is the live conversation window and is NOT stored here.
//
// Every query is owner-scoped at this layer: there is no function that can read
// another user's memory. Content is encrypted at rest; keywords are stored only
// as keyed hashes. Retrieval is hybrid — semantic vectors + BM25 over hashed
// keywords + knowledge-graph entity overlap + temporal filtering + recency +
// confidence — and returns its reasons so answers stay explainable.

const Memory = require('../models/Memory');
const gateway = require('./models/gateway');
const metrics = require('./metrics');
const { keywords, cosine, bm25, normalize, truncate, localEmbed } = require('./text');
const { encryptText, decryptText, keyedHash, redactPII } = require('./security');

const DAY = 86400000;
const MAX_CANDIDATES = 1500;

function hashTerms(text) { return keywords(text, 24).map(keyedHash); }

async function embedOne(text) {
  try {
    const r = await gateway.embed([text]);
    return { vector: r.vectors && r.vectors[0], modelKey: r.modelKey };
  } catch { return { vector: localEmbed(text), modelKey: 'setu-core' }; }
}

// Attribute keys let us detect "same question, new answer" (updated facts) and
// opposite preferences, so new information supersedes old WITHOUT erasing it.
function attributeOf(text) {
  const t = normalize(text);
  let m;
  if ((m = t.match(/\b(?:i\s+)?(?:live|stay|am based|moved) (?:in|to) ([\p{L}\s]{2,40})/u))) return { key: 'lives_in', value: m[1].trim() };
  if ((m = t.match(/\b(?:i\s+)?(?:work|am working) (?:as|at|for) ([\p{L}\p{N}\s&.-]{2,60})/u))) return { key: 'works_' + (/(?:as)\s/.test(t) ? 'as' : 'at'), value: m[1].trim() };
  if ((m = t.match(/^(likes|dislikes) (.{2,80})$/))) return { key: 'pref:' + m[2].trim().replace(/\s+/g, ' '), value: m[1] };
  return null;
}

function view(doc, extra = {}) {
  return {
    id: String(doc._id), category: doc.category, kind: doc.kind || null,
    text: decryptText(doc.content), origin: doc.origin, confidence: doc.confidence,
    status: doc.status, version: doc.version || 1, dueAt: doc.dueAt || null, resolvedAt: doc.resolvedAt || null,
    source: doc.source || {}, entityIds: doc.entityIds || [], createdAt: doc.createdAt, updatedAt: doc.updatedAt,
    expiresAt: doc.expiresAt || null, ...extra
  };
}

async function remember(userId, {
  category, kind = null, text, origin = 'inferred', confidence, source = {}, entityIds = [], dueAt = null, expiresAt = null, now = new Date()
}) {
  const clean = String(text || '').trim();
  if (!clean) throw Object.assign(new Error('memory text is required'), { status: 400 });
  const content = origin === 'explicit' ? clean.slice(0, 2000) : redactPII(clean).slice(0, 1000);
  const conf = confidence != null ? confidence : origin === 'explicit' ? 0.95 : 0.6;
  const { vector, modelKey } = await embedOne(content);
  const active = await Memory.find({ userId, status: 'active' }).sort({ updatedAt: -1 }).limit(400).lean();

  // 1) near-duplicate → reinforce instead of storing twice
  for (const m of active) {
    if (m.embeddingModel !== modelKey || !m.embedding || !m.embedding.length) continue;
    const sim = cosine(vector, m.embedding);
    if (sim >= 0.93 || normalize(decryptText(m.content)) === normalize(content)) {
      const evidence = [...(m.evidence || []), { conversationId: source.conversationId || null, messageId: source.messageId || null, at: now }].slice(-10);
      const newConf = Math.min(0.98, Math.max(m.confidence || 0.6, conf) + 0.05);
      await Memory.findOneAndUpdate({ _id: m._id, userId }, { $set: { confidence: newConf, evidence, updatedAt: now } });
      metrics.bump('memory.reinforced');
      return { memory: view({ ...m, confidence: newConf }), action: 'reinforced' };
    }
  }

  // 2) same attribute, different value → supersede (history preserved)
  const attr = attributeOf(content);
  let superseded = null;
  if (attr) {
    for (const m of active) {
      const a2 = attributeOf(decryptText(m.content));
      if (a2 && a2.key === attr.key && normalize(a2.value) !== normalize(attr.value)) {
        // An explicit/corrected memory is not overridden by a weaker inference.
        if (origin === 'inferred' && m.origin !== 'inferred' && (m.confidence || 0) > conf) {
          metrics.bump('memory.conflict.kept_existing');
          return { memory: view(m), action: 'conflict_kept_existing', conflict: { existing: view(m), incoming: content } };
        }
        superseded = m;
        break;
      }
    }
  }

  const doc = await Memory.create({
    userId, category, kind, content: encryptText(content), keyHashes: hashTerms(content),
    embedding: vector, embeddingModel: modelKey, entityIds: entityIds.map(String),
    source: { conversationId: source.conversationId || undefined, messageId: source.messageId || undefined, kind: source.kind || (origin === 'explicit' ? 'explicit' : 'assistant') },
    origin, confidence: conf,
    evidence: [{ conversationId: source.conversationId || null, messageId: source.messageId || null, at: now }],
    dueAt: dueAt ? new Date(dueAt) : undefined, expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    createdAt: now, updatedAt: now
  });
  metrics.bump('memory.created.' + category);
  if (superseded) {
    await Memory.findOneAndUpdate({ _id: superseded._id, userId }, { $set: { status: 'superseded', supersededBy: String(doc._id), updatedAt: now } });
    metrics.bump('memory.superseded');
    return { memory: view(doc), action: 'superseded_previous', previous: view(superseded) };
  }
  return { memory: view(doc), action: 'created' };
}

// User correction: new text, version bump, old text kept in history.
async function correct(userId, id, { text, reason = 'user_correction' } = {}) {
  const m = await Memory.findOne({ _id: id, userId }).lean();
  if (!m || m.status === 'deleted') return null;
  const clean = String(text || '').trim().slice(0, 2000);
  if (!clean) throw Object.assign(new Error('text is required'), { status: 400 });
  const { vector, modelKey } = await embedOne(clean);
  const history = [...(m.history || []), { version: m.version || 1, content: m.content, confidence: m.confidence, changedAt: new Date(), reason }].slice(-25);
  const updated = await Memory.findOneAndUpdate({ _id: id, userId }, {
    $set: {
      content: encryptText(clean), keyHashes: hashTerms(clean), embedding: vector, embeddingModel: modelKey,
      origin: 'corrected', confidence: 0.95, version: (m.version || 1) + 1, history, updatedAt: new Date()
    }
  }, { new: true });
  metrics.bump('memory.corrected');
  return view(updated.toObject ? updated.toObject() : updated);
}

async function historyOf(userId, id) {
  const m = await Memory.findOne({ _id: id, userId }).lean();
  if (!m) return null;
  return {
    current: view(m),
    history: (m.history || []).map(h => ({ version: h.version, text: decryptText(h.content), confidence: h.confidence, changedAt: h.changedAt, reason: h.reason }))
  };
}

async function forget(userId, id) {
  const r = await Memory.deleteOne({ _id: id, userId });
  const n = (r && (r.deletedCount != null ? r.deletedCount : r.n)) || 0;
  if (n) metrics.bump('memory.deleted');
  return n;
}

async function forgetAll(userId) {
  const r = await Memory.deleteMany({ userId });
  metrics.bump('memory.deleted_all');
  return (r && (r.deletedCount != null ? r.deletedCount : r.n)) || 0;
}

async function resolve(userId, id) {
  const m = await Memory.findOneAndUpdate({ _id: id, userId }, { $set: { resolvedAt: new Date(), updatedAt: new Date() } }, { new: true });
  return m ? view(m.toObject ? m.toObject() : m) : null;
}

async function list(userId, { category, status = 'active', limit = 200 } = {}) {
  const q = { userId, status };
  if (category) q.category = category;
  const rows = await Memory.find(q).sort({ updatedAt: -1 }).limit(Math.min(500, limit)).lean();
  return rows.map(r => view(r));
}

// Hybrid retrieval. Returns ranked memories with per-signal reasons.
async function retrieve(userId, query, {
  limit = 6, categories = null, timeRange = null, entityIds = [], minScore = 0.12, now = new Date(), touch = true
} = {}) {
  let rows = await Memory.find({ userId, status: 'active' }).sort({ updatedAt: -1 }).limit(MAX_CANDIDATES).lean();
  rows = rows.filter(r => !r.expiresAt || new Date(r.expiresAt) > now);
  if (categories && categories.length) rows = rows.filter(r => categories.includes(r.category));
  if (!rows.length) return [];

  // Temporal: prefer the stated window; if nothing falls in it, keep all (soft filter).
  let inWindow = null;
  if (timeRange) {
    inWindow = new Set(rows.filter(r => { const t = new Date(r.createdAt).getTime(); return t >= timeRange.from.getTime() && t < timeRange.to.getTime(); }).map(r => String(r._id)));
    if (!inWindow.size) inWindow = null;
  }

  // Semantic — compare only vectors from the same embedding model.
  const qVecs = new Map();
  const models = [...new Set(rows.map(r => r.embeddingModel).filter(Boolean))];
  for (const mk of models) {
    if (mk === 'setu-core') { qVecs.set(mk, localEmbed(query)); continue; }
    try { const r = await gateway.embed([query], { modelKey: mk }); if (r.vectors) qVecs.set(mk, r.vectors[0]); } catch { /* model gone: keyword path still works */ }
  }
  const sem = rows.map(r => (qVecs.has(r.embeddingModel) && r.embedding && r.embedding.length ? Math.max(0, cosine(qVecs.get(r.embeddingModel), r.embedding)) : 0));

  // Keyword — BM25 over keyed-hash terms.
  const qTerms = hashTerms(query);
  const kw = bm25(qTerms, rows.map(r => ({ terms: r.keyHashes || [] })));
  const kwMax = Math.max(0.0001, ...kw);

  const ents = new Set((entityIds || []).map(String));
  const scored = rows.map((r, i) => {
    const s = sem[i];
    const k = kw[i] / kwMax;
    const e = ents.size && (r.entityIds || []).some(id => ents.has(String(id))) ? 1 : 0;
    const ageDays = (now.getTime() - new Date(r.updatedAt || r.createdAt).getTime()) / DAY;
    const rec = Math.exp(-Math.max(0, ageDays) / 90);
    const t = inWindow ? (inWindow.has(String(r._id)) ? 1 : 0) : 0;
    let score = 0.5 * s + 0.25 * k + 0.15 * e + 0.05 * rec + 0.15 * t;
    score *= 0.6 + 0.4 * (r.confidence || 0.6);
    return { r, score, why: { semantic: +s.toFixed(3), keyword: +k.toFixed(3), entity: e, recency: +rec.toFixed(3), inTimeWindow: !!t } };
  }).filter(x => x.score >= minScore && (x.why.semantic > 0.2 || x.why.keyword > 0 || x.why.entity || x.why.inTimeWindow))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  if (touch && scored.length) {
    for (const x of scored) {
      Memory.findOneAndUpdate({ _id: x.r._id, userId }, { $set: { lastAccessedAt: now }, $inc: { accessCount: 1 } }).catch(() => {});
    }
  }
  metrics.bump('memory.retrievals');
  if (scored.length) metrics.bump('memory.retrieval_hits');
  return scored.map(x => view(x.r, { score: +x.score.toFixed(3), why: x.why }));
}

// Tasks, deadlines, commitments and open questions that are not resolved.
async function openItems(userId, { now = new Date(), limit = 12 } = {}) {
  const rows = await Memory.find({ userId, status: 'active', kind: { $in: ['task', 'deadline', 'commitment', 'question', 'requirement'] } })
    .sort({ updatedAt: -1 }).limit(300).lean();
  return rows.filter(r => !r.resolvedAt)
    .map(r => view(r, { overdue: r.dueAt ? new Date(r.dueAt) < now : false }))
    .sort((a, b) => (a.dueAt ? new Date(a.dueAt).getTime() : Infinity) - (b.dueAt ? new Date(b.dueAt).getTime() : Infinity))
    .slice(0, limit);
}

// Persist an extraction (extract.js) as memories. Sensitive inferences are
// skipped (the user can still save them explicitly).
async function ingestExtraction(userId, extraction, { conversationId, messageId, entityIdByName = new Map(), now = new Date() } = {}) {
  const saved = [], skipped = [];
  for (const it of extraction.items || []) {
    if (it.sensitive) { skipped.push({ reason: 'sensitive', kind: it.kind }); continue; }
    if (!it.text || it.text.length < 6) continue;
    const entityIds = (it.entities || []).map(e => entityIdByName.get((e.type || '') + ':' + String(e.name).toLowerCase())).filter(Boolean);
    const r = await remember(userId, {
      category: it.category, kind: it.kind, text: it.text, origin: 'inferred', confidence: it.confidence,
      source: { conversationId, messageId, kind: 'assistant' }, entityIds, dueAt: it.dueAt, now
    });
    saved.push({ id: r.memory.id, action: r.action, kind: it.kind, category: it.category, text: truncate(r.memory.text, 160), previous: r.previous ? truncate(r.previous.text, 160) : undefined });
  }
  return { saved, skipped };
}

async function exportAll(userId) {
  const rows = await Memory.find({ userId }).sort({ createdAt: 1 }).lean();
  return rows.map(r => ({
    ...view(r),
    history: (r.history || []).map(h => ({ version: h.version, text: decryptText(h.content), changedAt: h.changedAt, reason: h.reason }))
  }));
}

module.exports = { remember, correct, historyOf, forget, forgetAll, resolve, list, retrieve, openItems, ingestExtraction, exportAll, attributeOf };

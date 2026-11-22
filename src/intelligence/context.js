// intelligence/context.js — the cross-conversation context engine.
//
// Connects what the user says now with what they said before, in this or any
// of THEIR conversations: resolves references ("that project", "the other
// conversation", "what we discussed last week"), finds related conversations,
// surfaces earlier answers to repeated questions, and reports open items.
// Every lookup is scoped to the requesting user.

const AssistantConversation = require('../models/AssistantConversation');
const AssistantMessage = require('../models/AssistantMessage');
const KGEntity = require('../models/KGEntity');
const memory = require('./memory');
const graph = require('./graph');
const { detectReferences, parseTimeRange, localEmbed, cosine, truncate, sentences } = require('./text');
const { decryptText, encryptText } = require('./security');

async function resolveReferences(userId, text, { conversationId = null, now = new Date() } = {}) {
  const refs = detectReferences(text);
  const timeRange = parseTimeRange(text, now);
  const resolved = [];
  for (const r of refs) {
    if (r.kind === 'project' || r.kind === 'person') {
      const type = r.kind === 'project' ? 'project' : 'person';
      const ent = (await KGEntity.find({ userId, type }).sort({ lastSeenAt: -1 }).limit(5).lean()).find(e => e.normName !== 'me');
      if (ent) resolved.push({ phrase: r.phrase, kind: r.kind, entity: { id: String(ent._id), name: ent.name, type: ent.type } });
    } else if (r.kind === 'conversation') {
      const related = await relatedConversations(userId, text, { excludeId: conversationId, limit: 1 });
      const prev = related[0] || (await previousConversation(userId, conversationId));
      if (prev) resolved.push({ phrase: r.phrase, kind: r.kind, conversation: prev });
    } else if (r.kind === 'discussed' || r.kind === 'decision') {
      const decisions = await memory.retrieve(userId, text, { categories: ['episodic', 'project'], timeRange, limit: 3, touch: false });
      if (decisions.length) resolved.push({ phrase: r.phrase, kind: r.kind, memories: decisions.map(d => ({ id: d.id, text: d.text, at: d.createdAt })) });
    } else if (r.kind === 'task') {
      const open = await memory.openItems(userId, { now, limit: 3 });
      if (open.length) resolved.push({ phrase: r.phrase, kind: r.kind, memories: open.map(d => ({ id: d.id, text: d.text, dueAt: d.dueAt })) });
    }
  }
  return { refs: resolved, timeRange };
}

async function previousConversation(userId, excludeId) {
  const rows = await AssistantConversation.find({ userId, deletedAt: { $exists: false } }).sort({ lastMessageAt: -1 }).limit(5).lean();
  const c = rows.find(x => !excludeId || String(x._id) !== String(excludeId));
  return c ? { id: String(c._id), title: c.title, summary: truncate(decryptText(c.summary) || '', 400), lastMessageAt: c.lastMessageAt } : null;
}

async function relatedConversations(userId, text, { excludeId = null, entityIds = [], limit = 3 } = {}) {
  const rows = await AssistantConversation.find({ userId, deletedAt: { $exists: false } }).sort({ lastMessageAt: -1 }).limit(200).lean();
  const q = localEmbed(text);
  const ents = new Set(entityIds.map(String));
  return rows
    .filter(c => !excludeId || String(c._id) !== String(excludeId))
    .map(c => {
      const sem = c.summaryEmbedding && c.summaryEmbedding.length ? cosine(q, c.summaryEmbedding) : 0;
      const shared = (c.entityIds || []).filter(id => ents.has(String(id))).length;
      return { c, score: sem + 0.25 * Math.min(2, shared) };
    })
    .filter(x => x.score > 0.18)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ c, score }) => ({ id: String(c._id), title: c.title, summary: truncate(decryptText(c.summary) || '', 400), lastMessageAt: c.lastMessageAt, score: +score.toFixed(3) }));
}

// "You asked something like this before" — earlier user turns in OTHER
// conversations that are near-identical to the current question.
async function previouslyAsked(userId, text, { excludeConversationId = null, threshold = 0.82 } = {}) {
  const rows = await AssistantMessage.find({ userId, role: 'user' }).sort({ createdAt: -1 }).limit(200).lean();
  const q = localEmbed(text);
  let best = null;
  for (const m of rows) {
    if (excludeConversationId && String(m.conversationId) === String(excludeConversationId)) continue;
    const sim = cosine(q, localEmbed(decryptText(m.content)));
    if (sim >= threshold && (!best || sim > best.sim)) best = { m, sim };
  }
  if (!best) return null;
  const answer = await AssistantMessage.findOne({ userId, conversationId: best.m.conversationId, role: 'assistant', createdAt: { $gt: best.m.createdAt } }).sort({ createdAt: 1 }).lean();
  return {
    conversationId: String(best.m.conversationId), askedAt: best.m.createdAt, similarity: +best.sim.toFixed(3),
    question: truncate(decryptText(best.m.content), 200), answer: answer ? truncate(decryptText(answer.content), 500) : null
  };
}

// Extractive rolling summary of a conversation (no model needed) + local
// embedding for related-conversation search. Model summarisation can replace
// the text later without changing callers.
async function refreshSummary(userId, conversationId, entityIds = []) {
  const msgs = await AssistantMessage.find({ userId, conversationId, role: 'user' }).sort({ createdAt: -1 }).limit(20).lean();
  const texts = msgs.reverse().map(m => decryptText(m.content)).filter(Boolean);
  if (!texts.length) return null;
  const key = texts.flatMap(t => sentences(t)).filter(s => s.length > 20).slice(-8);
  const summary = truncate(key.join(' '), 900) || truncate(texts.join(' '), 900);
  const conv = await AssistantConversation.findOne({ _id: conversationId, userId }).lean();
  if (!conv) return null;
  const ids = [...new Set([...(conv.entityIds || []), ...entityIds.map(String)])].slice(-50);
  const title = conv.title && conv.title !== 'New conversation' ? conv.title : truncate(texts[0], 60);
  await AssistantConversation.findOneAndUpdate({ _id: conversationId, userId }, {
    $set: { summary: encryptText(summary), summaryEmbedding: localEmbed(summary), entityIds: ids, title }
  });
  return { summary, entityIds: ids, title };
}

// Everything the engine knows that is relevant to `text`, assembled once per turn.
async function gather(userId, text, { conversationId = null, now = new Date(), memoryEnabled = true } = {}) {
  const [refInfo, mentioned] = await Promise.all([
    resolveReferences(userId, text, { conversationId, now }),
    graph.entitiesInText(userId, text)
  ]);
  const refEntityIds = refInfo.refs.filter(r => r.entity).map(r => r.entity.id);
  const entityIds = [...new Set([...mentioned.map(e => String(e._id)), ...refEntityIds])];
  const [memories, relations, related, asked, open] = await Promise.all([
    memoryEnabled ? memory.retrieve(userId, text, { timeRange: refInfo.timeRange, entityIds, now }) : [],
    graph.neighbors(userId, entityIds),
    relatedConversations(userId, text, { excludeId: conversationId, entityIds, limit: 2 }),
    previouslyAsked(userId, text, { excludeConversationId: conversationId }),
    /\b(todo|to-do|task|deadline|pending|remind|open items?|what('?s| is) left|due)\b/i.test(text) ? memory.openItems(userId, { now }) : []
  ]);
  return { references: refInfo.refs, timeRange: refInfo.timeRange, entities: mentioned.map(e => ({ id: String(e._id), name: e.name, type: e.type })), relations, memories, related, previouslyAsked: asked, openItems: open };
}

module.exports = { resolveReferences, relatedConversations, previouslyAsked, refreshSummary, gather, previousConversation };

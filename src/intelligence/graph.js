// intelligence/graph.js — the per-user knowledge graph.
//
// Entities (people, projects, organisations, places, decisions…) and relations
// with provenance (which conversation/message), confidence and temporal validity.
// Evolution without loss: a functional fact that changes (a deadline moved, a
// status changed) closes the old edge and opens a new one; repeated facts
// reinforce confidence; nothing is silently overwritten.

const KGEntity = require('../models/KGEntity');
const KGRelation = require('../models/KGRelation');
const metrics = require('./metrics');
const { normalize } = require('./text');

// Predicates that hold ONE current value per subject.
const FUNCTIONAL = new Set(['has_deadline', 'has_status', 'works_at', 'lives_in', 'has_owner', 'current_stage']);
const ENTITY_TYPES = new Set(['person', 'project', 'organisation', 'institution', 'event', 'product', 'location', 'decision', 'task', 'document', 'concept', 'goal', 'statement', 'source']);

function normName(name) { return normalize(name).replace(/^(the|my|our)\s+/, ''); }

async function upsertEntity(userId, { type, name }, source = {}) {
  const t = ENTITY_TYPES.has(type) ? type : 'concept';
  const nn = normName(name);
  if (!nn) return null;
  let ent = await KGEntity.findOne({ userId, normName: nn }).lean();
  if (!ent) {
    // alias match (e.g. "Sangam" vs "Sangam app")
    const cands = await KGEntity.find({ userId, type: t }).limit(500).lean();
    ent = cands.find(c => (c.aliases || []).includes(nn) || nn.startsWith(c.normName + ' ') || c.normName.startsWith(nn + ' ')) || null;
  }
  const src = { conversationId: source.conversationId || null, messageId: source.messageId || null, at: new Date() };
  if (ent) {
    const aliases = new Set(ent.aliases || []);
    if (nn !== ent.normName) aliases.add(nn);
    const sources = [...(ent.sources || []), src].slice(-20);
    await KGEntity.findOneAndUpdate({ _id: ent._id, userId }, { $set: { aliases: [...aliases].slice(0, 20), lastSeenAt: new Date(), sources }, $inc: { mentions: 1 } });
    return { ...ent, _id: String(ent._id) };
  }
  const created = await KGEntity.create({ userId, type: t, name: String(name).trim().slice(0, 80), normName: nn, aliases: [], sources: [src] });
  metrics.bump('graph.entities.created');
  return { ...created.toObject ? created.toObject() : created, _id: String(created._id) };
}

function sameObject(rel, objectId, objectValue) {
  if (objectId) return String(rel.objectId || '') === String(objectId);
  return normalize(rel.objectValue || '') === normalize(objectValue || '');
}

async function addRelation(userId, { subjectId, predicate, objectId = null, objectValue = null, confidence = 0.6, source = {} }) {
  const pred = String(predicate || 'related_to').toLowerCase().replace(/[^a-z_]/g, '_').slice(0, 40);
  const current = await KGRelation.find({ userId, subjectId: String(subjectId), predicate: pred, status: 'current' }).lean();
  const same = current.find(r => sameObject(r, objectId, objectValue));
  if (same) {
    const c = Math.min(0.97, (same.confidence || 0.6) + 0.1);
    await KGRelation.findOneAndUpdate({ _id: same._id, userId }, { $set: { confidence: c } });
    metrics.bump('graph.relations.reinforced');
    return { relation: { ...same, confidence: c }, action: 'reinforced' };
  }
  const created = await KGRelation.create({
    userId, subjectId: String(subjectId), predicate: pred,
    objectId: objectId ? String(objectId) : undefined, objectValue: objectValue != null ? String(objectValue).slice(0, 300) : undefined,
    confidence, source: { conversationId: source.conversationId || undefined, messageId: source.messageId || undefined, memoryId: source.memoryId || undefined }
  });
  let superseded = [];
  if (FUNCTIONAL.has(pred) && current.length) {
    for (const old of current) {
      await KGRelation.findOneAndUpdate({ _id: old._id, userId }, { $set: { status: 'superseded', validTo: new Date(), supersededBy: String(created._id) } });
      superseded.push(String(old._id));
    }
    metrics.bump('graph.relations.superseded', superseded.length);
  }
  metrics.bump('graph.relations.created');
  return { relation: created.toObject ? created.toObject() : created, action: superseded.length ? 'superseded' : 'created', superseded };
}

// Ingest an extraction result (see extract.js) into the user's graph.
async function ingest(userId, extraction, source = {}) {
  const idByKey = new Map();
  const keyOf = e => (e.type || 'concept') + ':' + normName(e.name);
  const ensure = async (e) => {
    if (!e || !e.name) return null;
    if (e.name === 'me') {
      const self = await upsertEntity(userId, { type: 'person', name: 'me' }, source);
      return self && String(self._id);
    }
    const k = keyOf(e);
    if (idByKey.has(k)) return idByKey.get(k);
    const ent = await upsertEntity(userId, e, source);
    const id = ent && String(ent._id);
    idByKey.set(k, id);
    return id;
  };
  for (const e of extraction.entities || []) await ensure(e);
  const results = [];
  for (const r of extraction.relations || []) {
    const s = await ensure(r.subject);
    if (!s) continue;
    const o = r.object ? await ensure(r.object) : null;
    results.push(await addRelation(userId, { subjectId: s, predicate: r.predicate, objectId: o, objectValue: o ? null : r.value, confidence: 0.6, source }));
  }
  return { entityIds: [...new Set([...idByKey.values()].filter(Boolean))], relations: results, idByKey };
}

// Entities of this user whose name/alias appears in the text.
async function entitiesInText(userId, text, { limit = 8 } = {}) {
  const t = ' ' + normalize(text) + ' ';
  const all = await KGEntity.find({ userId }).sort({ lastSeenAt: -1 }).limit(800).lean();
  const hits = [];
  for (const e of all) {
    if (e.normName === 'me') continue;
    const names = [e.normName, ...(e.aliases || [])].filter(n => n && n.length >= 3);
    if (names.some(n => t.includes(' ' + n + ' '))) hits.push(e);
    if (hits.length >= limit) break;
  }
  return hits;
}

async function neighbors(userId, entityIds, { includeHistory = false } = {}) {
  const ids = (entityIds || []).map(String);
  if (!ids.length) return [];
  const q = { userId, $or: [{ subjectId: { $in: ids } }, { objectId: { $in: ids } }] };
  if (!includeHistory) q.status = 'current';
  const rels = await KGRelation.find(q).sort({ validFrom: -1 }).limit(200).lean();
  const otherIds = [...new Set(rels.flatMap(r => [r.subjectId, r.objectId]).filter(Boolean))];
  const ents = otherIds.length ? await KGEntity.find({ userId, _id: { $in: otherIds } }).lean() : [];
  const name = new Map(ents.map(e => [String(e._id), e]));
  return rels.map(r => ({
    id: String(r._id), predicate: r.predicate, status: r.status, confidence: r.confidence,
    subject: name.get(String(r.subjectId)) ? { id: String(r.subjectId), name: name.get(String(r.subjectId)).name, type: name.get(String(r.subjectId)).type } : { id: String(r.subjectId) },
    object: r.objectId ? (name.get(String(r.objectId)) ? { id: String(r.objectId), name: name.get(String(r.objectId)).name, type: name.get(String(r.objectId)).type } : { id: String(r.objectId) }) : null,
    value: r.objectValue || null, validFrom: r.validFrom, validTo: r.validTo || null, source: r.source || {}
  }));
}

async function timeline(userId, entityId) {
  return neighbors(userId, [entityId], { includeHistory: true });
}

async function removeEntity(userId, entityId) {
  await KGRelation.deleteMany({ userId, $or: [{ subjectId: String(entityId) }, { objectId: String(entityId) }] });
  const r = await KGEntity.deleteOne({ _id: entityId, userId });
  return (r && (r.deletedCount || r.n)) || 0;
}

module.exports = { upsertEntity, addRelation, ingest, entitiesInText, neighbors, timeline, removeEntity, FUNCTIONAL, normName };

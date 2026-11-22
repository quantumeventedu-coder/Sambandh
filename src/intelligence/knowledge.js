// intelligence/knowledge.js — Sambandh Setu's internal, verified knowledge base.
//
// Seeded from the Setu team's journey knowledge base (96 chunks covering the
// eight journey stages plus privacy, consent and safety guidance). Retrieval is
// hybrid (local embedding + BM25), stage-aware, and needs no model server.

const path = require('path');
const fs = require('fs');
const { localEmbed, cosine, stems, bm25 } = require('./text');

let KB = null;
function load() {
  if (KB) return KB;
  let rows = [];
  try { rows = JSON.parse(fs.readFileSync(path.join(__dirname, 'knowledge', 'setu-kb.json'), 'utf8')); } catch { rows = []; }
  KB = rows.filter(r => r && r.text).map(r => ({
    id: r.chunk_id, stage: r.stage, topic: r.topic, intent: r.intent, text: String(r.text), source: r.source,
    vec: localEmbed(r.text + ' ' + (r.topic || '').replace(/_/g, ' ')), terms: stems(r.text + ' ' + (r.topic || ''))
  }));
  return KB;
}

const STAGES = ['connect', 'understand', 'reflect', 'discuss', 'agree', 'family', 'reflect_again', 'decision'];

function search(query, { stage = null, limit = 3, minScore = 0.12 } = {}) {
  const kb = load();
  if (!kb.length) return [];
  const q = localEmbed(query);
  const kw = bm25(stems(query), kb);
  const kwMax = Math.max(0.0001, ...kw);
  return kb.map((c, i) => {
    let s = 0.65 * Math.max(0, cosine(q, c.vec)) + 0.35 * (kw[i] / kwMax);
    if (stage && c.stage === stage) s += 0.08;
    else if (stage && c.stage !== 'global') s -= 0.05;
    return { c, s };
  }).filter(x => x.s >= minScore).sort((a, b) => b.s - a.s).slice(0, limit)
    .map(({ c, s }) => ({ id: c.id, stage: c.stage, topic: c.topic, text: c.text, score: +s.toFixed(3) }));
}

function byStage(stage, topic = null) {
  return load().filter(c => c.stage === stage && (!topic || c.topic === topic)).map(c => ({ id: c.id, topic: c.topic, text: c.text }));
}

module.exports = { search, byStage, STAGES, _load: load };

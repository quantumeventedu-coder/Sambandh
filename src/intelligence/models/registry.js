// intelligence/models/registry.js — which models exist, what they do, in what order.
//
// Sources (merged, by modelKey):
//   1. env  — SETU_MODELS (JSON array) or the shorthand SETU_LLM_* / SETU_EMBED_*
//   2. DB   — IntelligenceModel documents managed from the super-admin panel
//   3. builtin "setu-core" — always present, always last: the CPU fallback
//
// External APIs are OPT-IN: an Anthropic entry is only added from env when
// SETU_ALLOW_EXTERNAL=true, and it is ordered after every self-hosted model.

const IntelligenceModel = require('../../models/IntelligenceModel');
const dbReady = require('../db-ready');

const ALL_TASKS = ['chat', 'reasoning', 'extraction', 'classification', 'summarization'];
const BUILTIN = Object.freeze({
  modelKey: 'setu-core', label: 'Setu Core (built-in, CPU)', provider: 'builtin', model: 'setu-core-1',
  tasks: [...ALL_TASKS, 'embedding'], tier: 'small', priority: 1000, enabled: true, version: '1.0',
  capabilities: { tools: false, json: true, stream: true }, source: 'builtin'
});

function bool(v, d) { return v == null || v === '' ? d : /^(1|true|yes|on)$/i.test(String(v)); }

function fromEnv(env = process.env) {
  const list = [];
  if (env.SETU_MODELS) {
    try {
      const arr = JSON.parse(env.SETU_MODELS);
      if (Array.isArray(arr)) for (const m of arr) if (m && m.modelKey && m.provider) list.push({ ...m, source: 'env' });
    } catch { /* invalid JSON → ignored, surfaced by admin overview */ }
  }
  if (env.SETU_LLM_BASE_URL && env.SETU_LLM_MODEL) {
    list.push({
      modelKey: 'env-main', label: 'Primary self-hosted model', provider: env.SETU_LLM_PROVIDER || 'openai',
      baseUrl: env.SETU_LLM_BASE_URL, model: env.SETU_LLM_MODEL, tasks: ALL_TASKS, tier: 'large', priority: 10,
      enabled: true, apiKeyEnv: env.SETU_LLM_API_KEY ? 'SETU_LLM_API_KEY' : undefined,
      contextWindow: Number(env.SETU_LLM_CONTEXT) || 8192, maxTokens: Number(env.SETU_LLM_MAX_TOKENS) || 900,
      capabilities: { tools: bool(env.SETU_LLM_TOOLS, true), json: true, stream: true }, source: 'env'
    });
  }
  if (env.SETU_LLM_SMALL_MODEL) {
    list.push({
      modelKey: 'env-small', label: 'Fast self-hosted model', provider: env.SETU_LLM_SMALL_PROVIDER || env.SETU_LLM_PROVIDER || 'openai',
      baseUrl: env.SETU_LLM_SMALL_BASE_URL || env.SETU_LLM_BASE_URL, model: env.SETU_LLM_SMALL_MODEL,
      tasks: ['extraction', 'classification', 'summarization', 'chat'], tier: 'small', priority: 20, enabled: true,
      apiKeyEnv: env.SETU_LLM_API_KEY ? 'SETU_LLM_API_KEY' : undefined, maxTokens: 600,
      capabilities: { tools: false, json: true, stream: true }, source: 'env'
    });
  }
  if (env.SETU_EMBED_MODEL && (env.SETU_EMBED_BASE_URL || env.SETU_LLM_BASE_URL)) {
    list.push({
      modelKey: 'env-embed', label: 'Self-hosted embeddings', provider: env.SETU_EMBED_PROVIDER || env.SETU_LLM_PROVIDER || 'openai',
      baseUrl: env.SETU_EMBED_BASE_URL || env.SETU_LLM_BASE_URL, model: env.SETU_EMBED_MODEL, tasks: ['embedding'],
      tier: 'small', priority: 10, enabled: true, apiKeyEnv: env.SETU_LLM_API_KEY ? 'SETU_LLM_API_KEY' : undefined, source: 'env'
    });
  }
  if (bool(env.SETU_ALLOW_EXTERNAL, false) && env.ANTHROPIC_API_KEY) {
    list.push({
      modelKey: 'external-anthropic', label: 'External (optional)', provider: 'anthropic',
      model: env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001', tasks: ALL_TASKS, tier: 'large', priority: 500,
      enabled: true, apiKeyEnv: 'ANTHROPIC_API_KEY', capabilities: { tools: false, json: false, stream: false }, source: 'env'
    });
  }
  return list;
}

let cache = null, cacheAt = 0;
const TTL = 15000;

async function all({ force = false } = {}) {
  if (!force && cache && Date.now() - cacheAt < TTL) return cache;
  const byKey = new Map();
  for (const m of fromEnv()) byKey.set(m.modelKey, m);
  try {
    const rows = dbReady() ? await IntelligenceModel.find({}).lean() : [];
    for (const r of rows) {
      const prior = byKey.get(r.modelKey);
      // env defines the endpoint; the DB may toggle/re-prioritise it, or add new models.
      byKey.set(r.modelKey, { ...(prior || {}), ...stripDb(r), source: prior ? 'env+admin' : 'admin' });
    }
  } catch { /* DB not ready — env + builtin still work */ }
  byKey.set(BUILTIN.modelKey, { ...BUILTIN });
  cache = [...byKey.values()];
  cacheAt = Date.now();
  return cache;
}

function stripDb(r) {
  const out = {};
  for (const k of ['modelKey', 'label', 'provider', 'baseUrl', 'model', 'tasks', 'tier', 'priority', 'enabled', 'version', 'quantization', 'contextWindow', 'maxTokens', 'timeoutMs', 'capabilities', 'apiKeyEnv']) {
    if (r[k] !== undefined && r[k] !== null) out[k] = r[k];
  }
  return out;
}

// Ordered candidates for a task. Preferred tier first, then priority; the
// builtin is always the final safety net.
async function forTask(task, { tier } = {}) {
  const list = (await all()).filter(m => m.enabled !== false && (m.tasks || []).includes(task));
  const rank = m => (m.provider === 'builtin' ? 2 : (tier && m.tier && m.tier !== tier ? 1 : 0));
  return list.sort((a, b) => rank(a) - rank(b) || (a.priority || 50) - (b.priority || 50));
}

function invalidate() { cache = null; cacheAt = 0; }

module.exports = { all, forTask, invalidate, fromEnv, BUILTIN, ALL_TASKS };

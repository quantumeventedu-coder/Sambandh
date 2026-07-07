// services/llm.js — the single, admin-controllable gateway to the LLM.
//
// Every AI feature (Karma Book, reputation engine, and the reusable AI API)
// calls through here, so the owner can turn the model on/off, swap models,
// rotate the key, and watch usage from the panel — with no code change. Live
// config comes from AppConfig (DB) and OVERRIDES env; env is the fallback.

const Anthropic = require('@anthropic-ai/sdk');
const AppConfig = require('../models/AppConfig');

const DEFAULTS = {
  enabled: true,
  provider: 'anthropic',
  model: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001',
  maxTokens: 1024,
  temperature: null,
  features: { karma: true, reputation: true, api: true }
};

// Rough CHF cost estimate for Haiku-class pricing (input/output per 1M tokens).
// Only used for the panel's "estimated spend" line — not billing.
const PRICE_PER_MTOK = { input: 0.9, output: 4.5 };

let cache = null, cacheAt = 0, cachedClient = null, cachedKey = null;
const TTL_MS = 30000;

async function loadConfig() {
  let doc = null;
  try { doc = await AppConfig.findOne({ key: 'singleton' }).lean(); } catch { /* DB not ready */ }
  const llm = (doc && doc.llm) || {};
  return {
    enabled: llm.enabled != null ? llm.enabled : DEFAULTS.enabled,
    provider: llm.provider || DEFAULTS.provider,
    apiKey: llm.apiKey || process.env.ANTHROPIC_API_KEY || null,
    apiKeyFromDb: !!llm.apiKey,
    model: llm.model || DEFAULTS.model,
    maxTokens: llm.maxTokens || DEFAULTS.maxTokens,
    temperature: llm.temperature != null ? llm.temperature : DEFAULTS.temperature,
    features: { ...DEFAULTS.features, ...(llm.features || {}) }
  };
}

async function getConfig(force) {
  const now = Date.now();
  if (!force && cache && now - cacheAt < TTL_MS) return cache;
  cache = await loadConfig();
  cacheAt = now;
  return cache;
}
function clearCache() { cache = null; cacheAt = 0; }

// Is the LLM usable right now for this feature? Callers fall back to their
// deterministic rule engines when this is false.
async function isEnabled(feature) {
  const c = await getConfig();
  if (!c.enabled || !c.apiKey) return false;
  if (feature && c.features && c.features[feature] === false) return false;
  return true;
}

function getClient(apiKey) {
  if (!apiKey) return null;
  if (cachedClient && cachedKey === apiKey) return cachedClient;
  cachedClient = new Anthropic({ apiKey });
  cachedKey = apiKey;
  return cachedClient;
}

// The one place any LLM completion happens. Returns the response text (string).
// Records usage (best-effort). Throws on disabled/error so callers keep their
// existing try/catch → rule-engine fallback.
// Full completion → { text, usage:{inputTokens,outputTokens}, model }. Callers
// pass `feature` for readability; global usage is metered here. Throws on
// disabled/error so callers keep their rule-engine fallback.
async function completeDetailed({ system, messages, prompt, maxTokens, temperature, model } = {}) {
  const c = await getConfig();
  if (!c.enabled || !c.apiKey) {
    const e = new Error('LLM is disabled or has no API key configured');
    e.code = 'LLM_DISABLED';
    throw e;
  }
  const client = getClient(c.apiKey);
  const req = {
    model: model || c.model,
    max_tokens: maxTokens || c.maxTokens,
    messages: messages || [{ role: 'user', content: String(prompt || '') }]
  };
  if (system) req.system = system;
  const t = temperature != null ? temperature : c.temperature;
  if (t != null) req.temperature = t;

  try {
    const resp = await client.messages.create(req);
    const text = (resp.content || []).map(b => b.text || '').join('');
    const usage = {
      inputTokens: resp.usage?.input_tokens || 0,
      outputTokens: resp.usage?.output_tokens || 0
    };
    await recordUsage({ calls: 1, ...usage });
    return { text, usage, model: req.model };
  } catch (err) {
    await recordUsage({ errors: 1 });
    throw err;
  }
}

async function complete(opts) {
  return (await completeDetailed(opts)).text;
}

async function recordUsage({ calls = 0, inputTokens = 0, outputTokens = 0, errors = 0 }) {
  try {
    await AppConfig.findOneAndUpdate(
      { key: 'singleton' },
      {
        $inc: {
          'llmUsage.calls': calls,
          'llmUsage.inputTokens': inputTokens,
          'llmUsage.outputTokens': outputTokens,
          'llmUsage.errors': errors
        },
        $set: { 'llmUsage.lastUsedAt': new Date() }
      },
      { upsert: true }
    );
  } catch { /* metering is best-effort — never break a real request over it */ }
}

function estimateCostCHF(usage) {
  const i = (usage?.inputTokens || 0) / 1e6 * PRICE_PER_MTOK.input;
  const o = (usage?.outputTokens || 0) / 1e6 * PRICE_PER_MTOK.output;
  return +(i + o).toFixed(4);
}

// Owner-facing snapshot for the panel — key is masked, never returned in full.
async function status() {
  const c = await getConfig(true);
  let usage = {};
  try {
    const doc = await AppConfig.findOne({ key: 'singleton' }).lean();
    usage = doc?.llmUsage || {};
  } catch { /* */ }
  const key = c.apiKey || '';
  return {
    enabled: c.enabled,
    provider: c.provider,
    model: c.model,
    maxTokens: c.maxTokens,
    temperature: c.temperature,
    features: c.features,
    keyConfigured: !!c.apiKey,
    keySource: c.apiKeyFromDb ? 'panel' : (c.apiKey ? 'env' : 'none'),
    keyMasked: key ? key.slice(0, 6) + '…' + key.slice(-4) : null,
    usage: { ...usage, estimatedCostCHF: estimateCostCHF(usage) }
  };
}

// Apply an owner edit. Only whitelisted fields; empty apiKey means "leave as is",
// the literal string 'CLEAR' removes the DB key (falls back to env).
async function updateConfig(patch = {}) {
  const set = {};
  if (typeof patch.enabled === 'boolean') set['llm.enabled'] = patch.enabled;
  if (typeof patch.model === 'string' && patch.model.trim()) set['llm.model'] = patch.model.trim();
  if (typeof patch.maxTokens === 'number' && patch.maxTokens > 0) set['llm.maxTokens'] = Math.min(patch.maxTokens, 8192);
  if (patch.temperature === null || typeof patch.temperature === 'number') set['llm.temperature'] = patch.temperature;
  if (patch.features && typeof patch.features === 'object') {
    for (const f of ['karma', 'reputation', 'api']) {
      if (typeof patch.features[f] === 'boolean') set[`llm.features.${f}`] = patch.features[f];
    }
  }
  if (typeof patch.apiKey === 'string') {
    if (patch.apiKey === 'CLEAR') set['llm.apiKey'] = null;
    else if (patch.apiKey.trim()) set['llm.apiKey'] = patch.apiKey.trim();
  }
  set.updatedAt = new Date();
  await AppConfig.findOneAndUpdate({ key: 'singleton' }, { $set: set }, { upsert: true });
  clearCache();
  return status();
}

// A tiny live call to confirm the current key + model actually work.
async function test() {
  const text = await complete({
    prompt: 'Reply with exactly the word: OK',
    maxTokens: 8,
    feature: 'api'
  });
  return { ok: /ok/i.test(text || ''), reply: (text || '').trim().slice(0, 40) };
}

module.exports = {
  isEnabled, complete, completeDetailed, status, updateConfig, test,
  getConfig, clearCache, estimateCostCHF
};

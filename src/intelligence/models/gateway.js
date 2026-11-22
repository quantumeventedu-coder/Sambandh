// intelligence/models/gateway.js — the ONE door every intelligence feature uses
// to reach a model. Routing by task + complexity, automatic failover across the
// configured self-hosted models, circuit breaking, structured (JSON) outputs with
// validation + repair, a tool-calling loop, embeddings, and metrics.

const registry = require('./registry');
const { providerFor } = require('./providers');
const metrics = require('../metrics');
const { estimateTokens } = require('../text');

// ---------------- circuit breaker ----------------
const FAILS_TO_OPEN = 3;
const OPEN_MS = 30000;
const breakers = new Map();   // modelKey → { fails, openUntil }
function isOpen(key) { const b = breakers.get(key); return !!(b && b.openUntil && b.openUntil > Date.now()); }
function onSuccess(key) { breakers.set(key, { fails: 0, openUntil: 0 }); }
function onFailure(key) {
  const b = breakers.get(key) || { fails: 0, openUntil: 0 };
  b.fails += 1;
  if (b.fails >= FAILS_TO_OPEN) { b.openUntil = Date.now() + OPEN_MS; b.fails = 0; }
  breakers.set(key, b);
}
function breakerState() {
  const out = {};
  for (const [k, b] of breakers.entries()) out[k] = { open: !!(b.openUntil && b.openUntil > Date.now()), openUntil: b.openUntil || null, recentFailures: b.fails };
  return out;
}

// Complexity routing: short classification/extraction → small tier; long
// context or reasoning → large tier. Callers may force a tier.
function pickTier(task, req) {
  if (req.tier) return req.tier;
  if (task === 'classification' || task === 'extraction') return 'small';
  const size = (req.messages || []).reduce((s, m) => s + estimateTokens(m.content), 0);
  if (task === 'reasoning' || size > 2500) return 'large';
  return task === 'chat' ? 'large' : 'small';
}

async function chat(task, req = {}) {
  const tier = pickTier(task, req);
  const candidates = await registry.forTask(task, { tier });
  const errors = [];
  for (const cfg of candidates) {
    if (cfg.provider !== 'builtin' && isOpen(cfg.modelKey)) { errors.push({ model: cfg.modelKey, error: 'circuit open' }); continue; }
    if (req.requireJson && cfg.capabilities && cfg.capabilities.json === false && cfg.provider !== 'builtin') continue;
    const p = providerFor(cfg.provider);
    if (!p) continue;
    const t0 = Date.now();
    let streamed = false;
    try {
      const onToken = req.onToken ? (tok) => { streamed = true; req.onToken(tok); } : undefined;
      const out = await p.chat(cfg, { ...req, onToken });
      const latencyMs = Date.now() - t0;
      metrics.recordModelCall(cfg.modelKey, task, { ok: true, latencyMs, inputTokens: out.usage && out.usage.input, outputTokens: out.usage && out.usage.output });
      if (cfg.provider !== 'builtin') onSuccess(cfg.modelKey);
      return {
        ...out, latencyMs, tier,
        model: { id: cfg.modelKey, provider: cfg.provider, name: cfg.model, version: cfg.version || null, mode: cfg.provider === 'builtin' ? 'basic' : 'model' },
        fallback: cfg.provider === 'builtin', failovers: errors
      };
    } catch (err) {
      const latencyMs = Date.now() - t0;
      metrics.recordModelCall(cfg.modelKey, task, { ok: false, latencyMs, error: err && err.message });
      if (cfg.provider !== 'builtin') onFailure(cfg.modelKey);
      errors.push({ model: cfg.modelKey, error: String((err && err.message) || err).slice(0, 160) });
      // A model that already streamed tokens cannot be silently swapped mid-answer.
      if (streamed) { const e = new Error('model failed mid-stream'); e.failovers = errors; throw e; }
      if (req.signal && req.signal.aborted) throw err;
    }
  }
  const e = new Error('no model could serve the request');
  e.failovers = errors;
  throw e;
}

function extractJson(text) {
  if (!text) return null;
  const s = String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
  try { return JSON.parse(s); } catch { /* fall through */ }
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(s.slice(a, b + 1)); } catch { /* ignore */ } }
  return null;
}

// Structured output: JSON mode + validation (+ one repair round). `validate`
// returns { ok, value, error }; `fallback` produces a value without a model.
async function json(task, req, { validate, fallback } = {}) {
  const v = validate || (x => ({ ok: x != null && typeof x === 'object', value: x, error: 'not an object' }));
  let out;
  try {
    out = await chat(task, { ...req, json: true, requireJson: true, fallbackJson: fallback });
  } catch (err) {
    if (fallback) return { value: await fallback(), model: { id: 'setu-core', provider: 'builtin', mode: 'basic' }, fallback: true, error: err.message };
    throw err;
  }
  let parsed = extractJson(out.text);
  let check = v(parsed);
  if (!check.ok && !out.fallback) {
    try {
      const repair = await chat(task, {
        ...req, json: true, requireJson: true, fallbackJson: fallback,
        messages: [...(req.messages || []), { role: 'assistant', content: String(out.text || '').slice(0, 4000) },
          { role: 'user', content: `That was not valid for the required schema (${check.error}). Reply with ONLY the corrected JSON object.` }]
      });
      parsed = extractJson(repair.text);
      check = v(parsed);
      out = repair;
    } catch { /* fall through to fallback */ }
  }
  if (!check.ok) {
    if (fallback) return { value: await fallback(), model: out.model, fallback: true, error: check.error };
    const e = new Error('model returned invalid structured output: ' + check.error);
    throw e;
  }
  return { value: check.value, model: out.model, fallback: !!out.fallback, usage: out.usage };
}

// Tool-calling loop. Tools are closures bound to the requesting user by the
// caller — the model can never choose whose data a tool reads.
async function withTools(task, req, tools, { maxSteps = 4 } = {}) {
  const messages = [...(req.messages || [])];
  const used = [];
  for (let step = 0; step < maxSteps; step++) {
    const out = await chat(task, { ...req, messages, tools: tools.map(({ name, description, parameters }) => ({ name, description, parameters })) });
    if (!out.toolCalls || !out.toolCalls.length) return { ...out, toolsUsed: used };
    messages.push({ role: 'assistant', content: out.text || '', tool_calls: out.toolCalls.map(tc => ({ id: tc.id, type: 'function', function: { name: tc.name, arguments: tc.arguments } })) });
    for (const tc of out.toolCalls) {
      const tool = tools.find(t => t.name === tc.name);
      let result;
      if (!tool) result = { error: 'unknown tool' };
      else {
        let args = {};
        try { args = typeof tc.arguments === 'string' ? JSON.parse(tc.arguments || '{}') : (tc.arguments || {}); } catch { args = {}; }
        try { result = await tool.handler(args); } catch (e) { result = { error: String(e.message || e).slice(0, 200) }; }
      }
      used.push({ name: tc.name, ok: !(result && result.error) });
      messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result).slice(0, 6000) });
    }
  }
  const final = await chat(task, { ...req, messages });
  return { ...final, toolsUsed: used };
}

// Embeddings. Returns { vectors, modelKey } — callers store modelKey with each
// vector so only vectors from the SAME model are ever compared.
async function embed(texts, { modelKey } = {}) {
  const input = (Array.isArray(texts) ? texts : [texts]).map(t => String(t || '').slice(0, 8000));
  const candidates = (await registry.forTask('embedding')).filter(m => !modelKey || m.modelKey === modelKey);
  for (const cfg of candidates) {
    if (cfg.provider !== 'builtin' && isOpen(cfg.modelKey)) continue;
    const p = providerFor(cfg.provider);
    const t0 = Date.now();
    try {
      const out = await p.embed(cfg, { input });
      if (!out.vectors || out.vectors.length !== input.length) throw new Error('embedding count mismatch');
      metrics.recordModelCall(cfg.modelKey, 'embedding', { ok: true, latencyMs: Date.now() - t0, inputTokens: out.usage && out.usage.input });
      if (cfg.provider !== 'builtin') onSuccess(cfg.modelKey);
      return { vectors: out.vectors, modelKey: cfg.modelKey };
    } catch (err) {
      metrics.recordModelCall(cfg.modelKey, 'embedding', { ok: false, latencyMs: Date.now() - t0, error: err.message });
      if (cfg.provider !== 'builtin') onFailure(cfg.modelKey);
    }
  }
  // Requested a specific model that is unavailable: report it (caller decides).
  if (modelKey) return { vectors: null, modelKey };
  const p = providerFor('builtin');
  const out = await p.embed({}, { input });
  return { vectors: out.vectors, modelKey: 'setu-core' };
}

// Health of every configured model (cached briefly; probes run in parallel).
let healthCache = null, healthAt = 0;
async function health({ force = false } = {}) {
  if (!force && healthCache && Date.now() - healthAt < 20000) return healthCache;
  const models = await registry.all({ force });
  const results = await Promise.all(models.map(async cfg => {
    const p = providerFor(cfg.provider);
    const base = {
      modelKey: cfg.modelKey, label: cfg.label || cfg.modelKey, provider: cfg.provider, model: cfg.model, version: cfg.version || null,
      tasks: cfg.tasks, tier: cfg.tier, priority: cfg.priority, enabled: cfg.enabled !== false, source: cfg.source,
      quantization: cfg.quantization || null, external: cfg.provider === 'anthropic', baseUrl: cfg.baseUrl ? String(cfg.baseUrl).replace(/\/\/[^@/]*@/, '//') : null
    };
    if (!p) return { ...base, ok: false, error: 'unknown provider' };
    if (cfg.enabled === false) return { ...base, ok: null, error: 'disabled' };
    try { return { ...base, ...(await p.health(cfg)) }; }
    catch (e) { return { ...base, ok: false, error: String(e.message || e).slice(0, 160) }; }
  }));
  healthCache = { at: new Date(), models: results, breakers: breakerState() };
  healthAt = Date.now();
  return healthCache;
}

function _reset() { breakers.clear(); healthCache = null; healthAt = 0; }

module.exports = { chat, json, withTools, embed, health, pickTier, extractJson, breakerState, _reset };

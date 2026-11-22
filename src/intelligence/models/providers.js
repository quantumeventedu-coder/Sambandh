// intelligence/models/providers.js — model provider adapters behind one interface.
//
//   chat({ model, messages, tools, json, temperature, maxTokens, stream, onToken, signal })
//     → { text, toolCalls, usage:{ input, output }, finishReason }
//   embed({ model, input:[...] }) → { vectors, usage }
//   health() → { ok, latencyMs, models?, gpu? }
//
// Providers:
//   openai   — any OpenAI-compatible server: vLLM, llama.cpp server, LM Studio,
//              TGI, LocalAI, and Ollama's /v1 endpoint. (Self-hosted.)
//   ollama   — Ollama's native API (adds GPU/VRAM visibility via /api/ps). (Self-hosted.)
//   anthropic— OPTIONAL external provider; never required, never first by default.
//   builtin  — "Setu Core": CPU-only, deterministic, always available. Grounded
//              extractive answering + local hashing embeddings. Keeps every
//              feature working when no model server is reachable.

const { localEmbed, sentences, stems, truncate } = require('../text');

function joinUrl(base, path) {
  const b = String(base || '').replace(/\/+$/, '');
  if (path.startsWith('/v1/') && /\/v1$/.test(b)) return b + path.slice(3);
  return b + path;
}

function withTimeout(ms, outer) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(new Error('timeout')), ms);
  if (t.unref) t.unref();
  if (outer) {
    if (outer.aborted) ctl.abort(outer.reason);
    else outer.addEventListener('abort', () => ctl.abort(outer.reason), { once: true });
  }
  return { signal: ctl.signal, done: () => clearTimeout(t) };
}

async function readLines(body, onLine) {
  const dec = new TextDecoder();
  let buf = '';
  for await (const chunk of body) {
    buf += typeof chunk === 'string' ? chunk : dec.decode(chunk, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).replace(/\r$/, '');
      buf = buf.slice(i + 1);
      if (line.trim()) onLine(line);
    }
  }
  if (buf.trim()) onLine(buf.trim());
}

async function httpJson(url, { method = 'POST', body, headers = {}, timeoutMs = 60000, signal } = {}) {
  const t = withTimeout(timeoutMs, signal);
  try {
    const res = await fetch(url, {
      method,
      headers: { 'content-type': 'application/json', ...headers },
      body: body ? JSON.stringify(body) : undefined,
      signal: t.signal
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    if (!res.ok) {
      const e = new Error(`HTTP ${res.status}${data && data.error ? ': ' + String(data.error.message || data.error).slice(0, 120) : ''}`);
      e.status = res.status;
      throw e;
    }
    return data;
  } finally { t.done(); }
}

function authHeaders(cfg) {
  const key = cfg.apiKeyEnv ? process.env[cfg.apiKeyEnv] : null;
  return key ? { authorization: 'Bearer ' + key } : {};
}

// ---------------------------------------------------------------- OpenAI-compatible
const openai = {
  async chat(cfg, req) {
    const body = {
      model: cfg.model,
      messages: req.messages,
      temperature: req.temperature != null ? req.temperature : 0.4,
      max_tokens: req.maxTokens || cfg.maxTokens || 800
    };
    if (req.tools && req.tools.length && cfg.capabilities && cfg.capabilities.tools) {
      body.tools = req.tools.map(t => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }));
      body.tool_choice = 'auto';
    }
    if (req.json) body.response_format = { type: 'json_object' };
    const url = joinUrl(cfg.baseUrl, '/v1/chat/completions');
    const timeoutMs = req.timeoutMs || cfg.timeoutMs || 60000;

    if (!req.stream) {
      const d = await httpJson(url, { body, headers: authHeaders(cfg), timeoutMs, signal: req.signal });
      const ch = (d && d.choices && d.choices[0]) || {};
      const msg = ch.message || {};
      return {
        text: msg.content || '',
        toolCalls: (msg.tool_calls || []).map(tc => ({ id: tc.id, name: tc.function && tc.function.name, arguments: tc.function && tc.function.arguments })),
        usage: { input: (d.usage && d.usage.prompt_tokens) || 0, output: (d.usage && d.usage.completion_tokens) || 0 },
        finishReason: ch.finish_reason || null
      };
    }

    body.stream = true;
    body.stream_options = { include_usage: true };
    const t = withTimeout(timeoutMs, req.signal);
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...authHeaders(cfg) }, body: JSON.stringify(body), signal: t.signal });
      if (!res.ok || !res.body) { const e = new Error('HTTP ' + res.status); e.status = res.status; throw e; }
      let text = '', usage = { input: 0, output: 0 }, finishReason = null;
      const calls = {};
      await readLines(res.body, line => {
        if (!line.startsWith('data:')) return;
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') return;
        let j; try { j = JSON.parse(payload); } catch { return; }
        if (j.usage) usage = { input: j.usage.prompt_tokens || 0, output: j.usage.completion_tokens || 0 };
        const ch = j.choices && j.choices[0];
        if (!ch) return;
        if (ch.finish_reason) finishReason = ch.finish_reason;
        const delta = ch.delta || {};
        if (delta.content) { text += delta.content; if (req.onToken) req.onToken(delta.content); }
        for (const tc of delta.tool_calls || []) {
          const k = tc.index != null ? tc.index : 0;
          calls[k] = calls[k] || { id: tc.id, name: '', arguments: '' };
          if (tc.id) calls[k].id = tc.id;
          if (tc.function && tc.function.name) calls[k].name += tc.function.name;
          if (tc.function && tc.function.arguments) calls[k].arguments += tc.function.arguments;
        }
      });
      return { text, toolCalls: Object.values(calls), usage, finishReason };
    } finally { t.done(); }
  },

  async embed(cfg, req) {
    const d = await httpJson(joinUrl(cfg.baseUrl, '/v1/embeddings'), {
      body: { model: cfg.model, input: req.input }, headers: authHeaders(cfg), timeoutMs: cfg.timeoutMs || 30000, signal: req.signal
    });
    const vectors = ((d && d.data) || []).sort((a, b) => (a.index || 0) - (b.index || 0)).map(x => x.embedding);
    return { vectors, usage: { input: (d && d.usage && d.usage.prompt_tokens) || 0, output: 0 } };
  },

  async health(cfg) {
    const t0 = Date.now();
    const d = await httpJson(joinUrl(cfg.baseUrl, '/v1/models'), { method: 'GET', headers: authHeaders(cfg), timeoutMs: 5000 });
    const out = { ok: true, latencyMs: Date.now() - t0, models: ((d && d.data) || []).map(m => m.id).slice(0, 20) };
    // vLLM exposes Prometheus metrics at /metrics (GPU KV-cache usage, queue depth).
    try {
      const base = String(cfg.baseUrl).replace(/\/v1\/?$/, '').replace(/\/+$/, '');
      const t = withTimeout(3000);
      const r = await fetch(base + '/metrics', { headers: authHeaders(cfg), signal: t.signal });
      t.done();
      if (r.ok) {
        const txt = await r.text();
        const pick = (name) => { const m = txt.match(new RegExp('^' + name.replace(/[:.]/g, '\\$&') + '(\\{[^}]*\\})?\\s+([0-9.eE+-]+)', 'm')); return m ? Number(m[2]) : null; };
        const gpuCache = pick('vllm:gpu_cache_usage_perc');
        if (gpuCache != null) out.gpu = { kvCacheUsage: gpuCache, running: pick('vllm:num_requests_running'), waiting: pick('vllm:num_requests_waiting') };
      }
    } catch { /* metrics are optional */ }
    return out;
  }
};

// ---------------------------------------------------------------- Ollama (native)
const ollama = {
  async chat(cfg, req) {
    const body = {
      model: cfg.model,
      messages: req.messages,
      stream: !!req.stream,
      options: { temperature: req.temperature != null ? req.temperature : 0.4, num_predict: req.maxTokens || cfg.maxTokens || 800 }
    };
    if (req.json) body.format = 'json';
    if (req.tools && req.tools.length && cfg.capabilities && cfg.capabilities.tools) {
      body.tools = req.tools.map(t => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }));
    }
    const url = joinUrl(cfg.baseUrl, '/api/chat');
    const timeoutMs = req.timeoutMs || cfg.timeoutMs || 90000;
    if (!req.stream) {
      const d = await httpJson(url, { body, headers: authHeaders(cfg), timeoutMs, signal: req.signal });
      const msg = (d && d.message) || {};
      return {
        text: msg.content || '',
        toolCalls: (msg.tool_calls || []).map((tc, i) => ({ id: 'call_' + i, name: tc.function && tc.function.name, arguments: JSON.stringify((tc.function && tc.function.arguments) || {}) })),
        usage: { input: (d && d.prompt_eval_count) || 0, output: (d && d.eval_count) || 0 },
        finishReason: (d && d.done_reason) || 'stop'
      };
    }
    const t = withTimeout(timeoutMs, req.signal);
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...authHeaders(cfg) }, body: JSON.stringify(body), signal: t.signal });
      if (!res.ok || !res.body) { const e = new Error('HTTP ' + res.status); e.status = res.status; throw e; }
      let text = '', usage = { input: 0, output: 0 }, toolCalls = [];
      await readLines(res.body, line => {
        let j; try { j = JSON.parse(line); } catch { return; }
        const c = j.message && j.message.content;
        if (c) { text += c; if (req.onToken) req.onToken(c); }
        if (j.message && j.message.tool_calls) toolCalls = j.message.tool_calls.map((tc, i) => ({ id: 'call_' + i, name: tc.function.name, arguments: JSON.stringify(tc.function.arguments || {}) }));
        if (j.done) usage = { input: j.prompt_eval_count || 0, output: j.eval_count || 0 };
      });
      return { text, toolCalls, usage, finishReason: 'stop' };
    } finally { t.done(); }
  },

  async embed(cfg, req) {
    const d = await httpJson(joinUrl(cfg.baseUrl, '/api/embed'), { body: { model: cfg.model, input: req.input }, headers: authHeaders(cfg), timeoutMs: cfg.timeoutMs || 30000, signal: req.signal });
    return { vectors: (d && d.embeddings) || [], usage: { input: (d && d.prompt_eval_count) || 0, output: 0 } };
  },

  async health(cfg) {
    const t0 = Date.now();
    const tags = await httpJson(joinUrl(cfg.baseUrl, '/api/tags'), { method: 'GET', headers: authHeaders(cfg), timeoutMs: 5000 });
    const out = { ok: true, latencyMs: Date.now() - t0, models: ((tags && tags.models) || []).map(m => m.name).slice(0, 20) };
    try {
      const ps = await httpJson(joinUrl(cfg.baseUrl, '/api/ps'), { method: 'GET', headers: authHeaders(cfg), timeoutMs: 3000 });
      const loaded = (ps && ps.models) || [];
      out.gpu = {
        loaded: loaded.map(m => ({ name: m.name, sizeBytes: m.size, vramBytes: m.size_vram, onGpu: m.size ? +(m.size_vram / m.size).toFixed(2) : null })),
        vramBytes: loaded.reduce((s, m) => s + (m.size_vram || 0), 0)
      };
    } catch { /* optional */ }
    return out;
  }
};

// ---------------------------------------------------------------- Anthropic (optional external)
const anthropic = {
  async chat(cfg, req) {
    const key = process.env[cfg.apiKeyEnv || 'ANTHROPIC_API_KEY'];
    if (!key) throw new Error('external provider has no API key');
    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: key });
    const system = req.messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n');
    const messages = req.messages.filter(m => m.role !== 'system').map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '') }));
    const resp = await client.messages.create({ model: cfg.model, max_tokens: req.maxTokens || cfg.maxTokens || 800, system: system || undefined, messages });
    const text = (resp.content || []).map(b => b.text || '').join('');
    if (req.onToken && text) req.onToken(text);
    return { text, toolCalls: [], usage: { input: (resp.usage && resp.usage.input_tokens) || 0, output: (resp.usage && resp.usage.output_tokens) || 0 }, finishReason: resp.stop_reason || null };
  },
  async embed() { throw new Error('external provider does not offer embeddings here'); },
  async health(cfg) { return { ok: !!process.env[cfg.apiKeyEnv || 'ANTHROPIC_API_KEY'], latencyMs: 0, external: true }; }
};

// ---------------------------------------------------------------- Builtin (Setu Core, CPU)
// Grounded, extractive answering from the context the orchestrator retrieved:
// it NEVER invents facts — it selects and attributes sentences from memory,
// sources and the knowledge base. Quality is basic by design; it exists so the
// platform keeps working (and stays honest) with no model server.
function overlapScore(qStems, text) {
  const s = new Set(stems(text));
  let hit = 0;
  for (const q of qStems) if (s.has(q)) hit++;
  return qStems.length ? hit / qStems.length : 0;
}

function builtinAnswer(req) {
  const g = req.grounding || {};
  const question = String(g.question || '').trim();
  const q = stems(question);
  const parts = [];

  if (g.directReply) return g.directReply;

  if (g.sources && g.sources.length) {
    const picked = [];
    for (const src of g.sources) {
      const best = sentences(src.text || '')
        .map(s => ({ s, sc: overlapScore(q, s) }))
        .filter(x => x.sc > 0 && x.s.length > 30 && x.s.length < 400)
        .sort((a, b) => b.sc - a.sc)[0];
      if (best) picked.push(`${truncate(best.s, 320)} [${src.n}]`);
      if (picked.length >= 4) break;
    }
    if (picked.length) parts.push('Here is what the sources I read say:\n' + picked.map(p => '• ' + p).join('\n'));
    if (g.conflicts && g.conflicts.length) parts.push('Note: the sources disagree on ' + g.conflicts.map(c => c.topic).join(', ') + ' — treat those details with care.');
  }

  if (g.memories && g.memories.length) {
    const rel = g.memories.slice(0, 4).map(m => '• ' + truncate(m.text, 220) + (m.when ? ` (${m.when})` : ''));
    parts.push((parts.length ? 'From what you told me before:\n' : 'From what you have told me before:\n') + rel.join('\n'));
  }

  if (g.openItems && g.openItems.length) {
    parts.push('Still open:\n' + g.openItems.slice(0, 5).map(o => '• ' + truncate(o.text, 180) + (o.dueAt ? ` — due ${new Date(o.dueAt).toISOString().slice(0, 10)}` : '')).join('\n'));
  }

  if (g.knowledge && g.knowledge.length) {
    const kb = g.knowledge.slice(0, 3).map(k => '• ' + truncate(k.text, 260));
    parts.push((parts.length ? 'Some guidance that may help:\n' : '') + kb.join('\n'));
  }

  if (g.platform && g.platform.summary) parts.push(g.platform.summary);

  if (!parts.length) {
    if (g.webUnavailable) return "I couldn't find enough in what I know, and web research isn't available right now, so I can't answer that reliably. You could ask me about your journey, conversation ideas, or anything you've told me before.";
    return "I don't have enough information to answer that well yet. Tell me a bit more — or ask about your journey, conversation ideas, privacy and safety, or anything we've discussed before.";
  }
  return parts.join('\n\n');
}

const builtin = {
  async chat(cfg, req) {
    if (req.json && typeof req.fallbackJson === 'function') {
      const obj = await req.fallbackJson();
      return { text: JSON.stringify(obj), toolCalls: [], usage: { input: 0, output: 0 }, finishReason: 'stop' };
    }
    const text = builtinAnswer(req);
    if (req.onToken) {
      // Stream word-by-word so clients exercise the same streaming path.
      for (const piece of text.match(/\S+\s*/g) || []) req.onToken(piece);
    }
    return { text, toolCalls: [], usage: { input: 0, output: 0 }, finishReason: 'stop' };
  },
  async embed(cfg, req) { return { vectors: req.input.map(t => localEmbed(t)), usage: { input: 0, output: 0 } }; },
  async health() { return { ok: true, latencyMs: 0, builtin: true }; }
};

const PROVIDERS = { openai, ollama, anthropic, builtin };
function providerFor(name) { return PROVIDERS[name] || null; }

module.exports = { providerFor, builtinAnswer, joinUrl, _internal: { readLines, withTimeout } };

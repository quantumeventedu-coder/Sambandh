// routes-ai.js — the reusable AI API. Lets the owner's OTHER apps call
// Sambandh's admin-controlled LLM gateway with a per-app API key.
//
//   curl -X POST https://sambandh.online/api/ai/complete \
//        -H "X-AI-Key: sbk_live_…" -H "Content-Type: application/json" \
//        -d '{"prompt":"Say hi"}'
//
// Every call goes through services/llm.js, so the same owner controls (on/off,
// model, key, usage) apply. Usage is metered per key.

const express = require('express');
const crypto = require('crypto');
const { z } = require('zod');
const ApiKey = require('./models/ApiKey');
const llm = require('./services/llm');

const router = express.Router();

const sha256 = s => crypto.createHash('sha256').update(String(s)).digest('hex');

// Generate a new key: returns { plaintext, prefix, keyHash }. Shown once.
function generateKey() {
  const raw = 'sbk_live_' + crypto.randomBytes(24).toString('base64url');
  return { plaintext: raw, prefix: raw.slice(0, 16), keyHash: sha256(raw) };
}

// Simple in-memory per-key sliding-window limiter (per process). Adequate for a
// single persistent host; on multi-instance deploys each instance limits
// independently — acceptable for an internal API.
const hits = new Map();
function rateLimited(keyId, perMin) {
  const now = Date.now(), windowStart = now - 60000;
  const arr = (hits.get(keyId) || []).filter(t => t > windowStart);
  arr.push(now);
  hits.set(keyId, arr);
  return arr.length > perMin;
}

async function requireApiKey(req, res, next) {
  try {
    const presented = req.headers['x-ai-key'] || (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!presented) return res.status(401).json({ error: 'Missing X-AI-Key' });
    const doc = await ApiKey.findOne({ keyHash: sha256(presented) });
    if (!doc || doc.disabled) return res.status(401).json({ error: 'Invalid or disabled API key' });
    if (rateLimited(String(doc._id), doc.rateLimitPerMin || 60)) {
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }
    req.apiKeyDoc = doc;
    next();
  } catch (err) { next(err); }
}

// GET /api/ai/health — is the AI API usable right now?
router.get('/health', requireApiKey, async (req, res, next) => {
  try {
    res.json({ ok: true, enabled: await llm.isEnabled('api') });
  } catch (err) { next(err); }
});

const completeSchema = z.object({
  prompt: z.string().max(24000).optional(),
  system: z.string().max(8000).optional(),
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().max(24000)
  })).max(40).optional(),
  maxTokens: z.number().int().min(1).max(4096).optional(),
  temperature: z.number().min(0).max(1).optional(),
  model: z.string().max(60).optional()
}).refine(d => d.prompt || (d.messages && d.messages.length), {
  message: 'Provide prompt or messages'
});

// POST /api/ai/complete — one completion through the gateway.
router.post('/complete', requireApiKey, async (req, res, next) => {
  try {
    if (!(await llm.isEnabled('api'))) {
      return res.status(503).json({ error: 'AI API is disabled by the administrator' });
    }
    const parsed = completeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid request' });

    let result;
    try {
      result = await llm.completeDetailed(parsed.data);
    } catch (e) {
      if (e.code === 'LLM_DISABLED') return res.status(503).json({ error: 'AI engine unavailable' });
      return res.status(502).json({ error: 'Upstream model error: ' + e.message });
    }

    // Meter this key.
    await ApiKey.findByIdAndUpdate(req.apiKeyDoc._id, {
      $inc: {
        calls: 1,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens
      },
      $set: { lastUsedAt: new Date() }
    });

    res.json({ text: result.text, model: result.model, usage: result.usage });
  } catch (err) { next(err); }
});

module.exports = router;
module.exports.generateKey = generateKey;
module.exports.sha256 = sha256;

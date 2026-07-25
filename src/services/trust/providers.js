// @ts-check
// services/trust/providers.js — external detection adapters (AAV Layers 2/4/7/11/16).
//
// Some layers (generative-image detection, deepfake, multi-OCR, malware, government
// registries) genuinely require a trained model or a paid vendor — they cannot be
// honestly implemented in-process. Rather than MOCK a pass (which would be worse
// than useless), each capability runs through this registry:
//   · No adapter registered  → { unknown: true }  → the risk engine floors it at
//     elevated risk, so the document cannot auto-approve until a real detector is
//     wired in. This is a complete, fail-secure behaviour, not a stub.
//   · Adapter throws          → { unknown: true, risk: 60 } (fail-secure).
// Real per-vendor adapters register via register(capability, fn); nothing here
// fabricates a result.

/** @type {Record<string, (input:any)=>Promise<{risk:number}>>} */
const REGISTRY = {};

/**
 * Register a real detector for a capability (e.g. 'ai-image', 'malware', 'ocr').
 * @param {string} capability
 * @param {(input:any)=>Promise<{risk:number}>} fn returns { risk: 0–100 }
 */
function register(capability, fn) { REGISTRY[capability] = fn; }

/**
 * Run a capability, failing secure when it is unconfigured or errors.
 * @param {string} capability
 * @param {any} input
 * @returns {Promise<{name:string, risk:number, unknown?:boolean, error?:string}>}
 */
async function run(capability, input) {
  const fn = REGISTRY[capability];
  if (!fn) return { name: capability, risk: 0, unknown: true };
  try {
    const out = await fn(input);
    const risk = Math.max(0, Math.min(100, (out && out.risk) || 0));
    return { name: capability, risk };
  } catch (e) {
    return { name: capability, risk: 60, unknown: true, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Test/ops helper — forget all registered adapters. */
function _reset() { for (const k of Object.keys(REGISTRY)) delete REGISTRY[k]; }

module.exports = { register, run, _reset };

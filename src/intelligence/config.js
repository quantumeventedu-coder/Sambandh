// intelligence/config.js — runtime configuration for the intelligence engine.
// Super-admin edits (AppConfig.intelligence) override env, env overrides defaults.

const AppConfig = require('../models/AppConfig');
const dbReady = require('./db-ready');

const DEFAULTS = {
  assistantEnabled: true,
  memoryEnabled: true,          // platform-wide switch (users also have their own)
  webResearchEnabled: true,     // only works when a search provider is configured
  search: { provider: 'auto', searxngUrl: '', braveKeyEnv: 'BRAVE_SEARCH_API_KEY', maxResults: 8 },
  research: { maxSteps: 6, maxFetches: 10, timeoutMs: 60000 },
  fetch: { timeoutMs: 10000, maxBytes: 2500000, perHostIntervalMs: 1500 },
  learning: { evalDatasetEnabled: true }
};

let cache = null, at = 0;

function merge(a, b) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b || {})) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object' ? merge(a[k], v) : v;
  }
  return out;
}

function fromEnv(env = process.env) {
  const o = {};
  if (env.SEARXNG_URL) o.search = { provider: 'searxng', searxngUrl: env.SEARXNG_URL };
  else if (env.BRAVE_SEARCH_API_KEY) o.search = { provider: 'brave' };
  if (env.SETU_WEB_RESEARCH === 'false') o.webResearchEnabled = false;
  if (env.SETU_MEMORY === 'false') o.memoryEnabled = false;
  return o;
}

async function get({ force = false } = {}) {
  if (!force && cache && Date.now() - at < 15000) return cache;
  let db = {};
  try { const doc = dbReady() ? await AppConfig.findOne({ key: 'singleton' }).lean() : null; db = (doc && doc.intelligence) || {}; } catch { db = {}; }
  cache = merge(merge(DEFAULTS, fromEnv()), db);
  at = Date.now();
  return cache;
}

async function update(patch) {
  const current = await get({ force: true });
  const allowed = {};
  for (const k of ['assistantEnabled', 'memoryEnabled', 'webResearchEnabled']) if (typeof patch[k] === 'boolean') allowed[k] = patch[k];
  if (patch.search && typeof patch.search === 'object') {
    allowed.search = {};
    if (['auto', 'searxng', 'brave', 'none'].includes(patch.search.provider)) allowed.search.provider = patch.search.provider;
    if (typeof patch.search.searxngUrl === 'string' && /^(https?:\/\/[^\s]+)?$/.test(patch.search.searxngUrl)) allowed.search.searxngUrl = patch.search.searxngUrl.trim();
    if (Number.isFinite(patch.search.maxResults)) allowed.search.maxResults = Math.max(3, Math.min(20, patch.search.maxResults));
  }
  if (patch.research && typeof patch.research === 'object') {
    allowed.research = {};
    if (Number.isFinite(patch.research.maxSteps)) allowed.research.maxSteps = Math.max(1, Math.min(12, patch.research.maxSteps));
    if (Number.isFinite(patch.research.maxFetches)) allowed.research.maxFetches = Math.max(1, Math.min(30, patch.research.maxFetches));
    if (Number.isFinite(patch.research.timeoutMs)) allowed.research.timeoutMs = Math.max(5000, Math.min(180000, patch.research.timeoutMs));
  }
  const next = merge(current, allowed);
  const stored = merge((await AppConfig.findOne({ key: 'singleton' }).lean() || {}).intelligence || {}, allowed);
  await AppConfig.findOneAndUpdate({ key: 'singleton' }, { $set: { intelligence: stored } }, { upsert: true, new: true });
  cache = null;
  return next;
}

function invalidate() { cache = null; }

module.exports = { get, update, invalidate, DEFAULTS };

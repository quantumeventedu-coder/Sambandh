// intelligence/web/search.js — web search behind one interface.
//
// Providers: SearXNG (self-hosted, preferred — no third-party key), Brave Search
// API (optional), or none. Returns normalised, de-duplicated results. Never
// pretends: with no provider configured it says so ({ configured:false }).

const { URLSearchParams } = require('url');
const config = require('../config');
const metrics = require('../metrics');

function stripTracking(url) {
  try {
    const u = new URL(url);
    for (const k of [...u.searchParams.keys()]) if (/^(utm_|fbclid|gclid|mc_|ref$|ref_src)/i.test(k)) u.searchParams.delete(k);
    u.hash = '';
    return u.toString();
  } catch { return null; }
}

async function getJson(url, headers = {}, timeoutMs = 8000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { headers: { accept: 'application/json', ...headers }, signal: ctl.signal });
    if (!r.ok) throw Object.assign(new Error('search HTTP ' + r.status), { status: r.status });
    return await r.json();
  } finally { clearTimeout(t); }
}

async function provider() {
  const c = await config.get();
  const s = c.search || {};
  const want = s.provider || 'auto';
  const searx = s.searxngUrl || process.env.SEARXNG_URL;
  const braveKey = process.env[s.braveKeyEnv || 'BRAVE_SEARCH_API_KEY'];
  if ((want === 'searxng' || want === 'auto') && searx) return { name: 'searxng', base: searx.replace(/\/+$/, ''), max: s.maxResults || 8 };
  if ((want === 'brave' || want === 'auto') && braveKey) return { name: 'brave', key: braveKey, max: s.maxResults || 8 };
  return { name: 'none' };
}

async function search(query, { limit, category = 'general', timeRange = null, language = 'en', impl } = {}) {
  const p = impl ? { name: 'custom' } : await provider();
  if (p.name === 'none') return { configured: false, provider: 'none', results: [] };
  const max = Math.min(20, limit || p.max || 8);
  metrics.bump('web.search.requests');
  let raw = [];
  try {
    if (impl) raw = await impl(query, { limit: max, category, timeRange });
    else if (p.name === 'searxng') {
      const params = new URLSearchParams({ q: query, format: 'json', categories: category === 'news' ? 'news' : 'general', language, safesearch: '1' });
      if (timeRange && ['day', 'week', 'month', 'year'].includes(timeRange)) params.set('time_range', timeRange);
      const d = await getJson(`${p.base}/search?${params}`);
      raw = (d.results || []).map(r => ({ title: r.title, url: r.url, snippet: r.content, engine: r.engine || (r.engines || [])[0], published: r.publishedDate || null }));
    } else if (p.name === 'brave') {
      const params = new URLSearchParams({ q: query, count: String(max), safesearch: 'moderate' });
      if (timeRange) params.set('freshness', { day: 'pd', week: 'pw', month: 'pm', year: 'py' }[timeRange] || '');
      const d = await getJson(`https://api.search.brave.com/res/v1/web/search?${params}`, { 'X-Subscription-Token': p.key });
      raw = ((d.web && d.web.results) || []).map(r => ({ title: r.title, url: r.url, snippet: r.description, engine: 'brave', published: r.page_age || r.age || null }));
    }
  } catch (e) {
    metrics.bump('web.search.errors');
    return { configured: true, provider: p.name, results: [], error: String(e.message || e).slice(0, 120) };
  }
  const seen = new Set();
  const results = [];
  for (const r of raw) {
    const url = stripTracking(r.url);
    if (!url || !/^https?:/i.test(url)) continue;
    const key = url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({ title: String(r.title || '').slice(0, 200), url, snippet: String(r.snippet || '').slice(0, 400), engine: r.engine || p.name, published: r.published || null });
    if (results.length >= max) break;
  }
  metrics.bump('web.search.results', results.length);
  return { configured: true, provider: p.name, results };
}

module.exports = { search, provider, stripTracking };

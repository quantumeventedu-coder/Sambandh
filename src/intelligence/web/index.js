// intelligence/web/index.js — the web intelligence pipeline.
//
//   decide → query → search → retrieve (robots-compliant, SSRF-safe, cached)
//   → extract readable text (HTML / PDF) → extract facts → score sources
//   → detect conflicts → evidence pack with numbered citations.
//
// All page content is UNTRUSTED: it is sanitised, length-capped and fenced
// before any model sees it, and instructions inside it are never followed.

const crypto = require('crypto');
const WebCache = require('../../models/WebCache');
const config = require('../config');
const metrics = require('../metrics');
const { safeFetch } = require('./safe-fetch');
const robots = require('./robots');
const html = require('./html');
const { extractPdfText } = require('./pdf');
const searchMod = require('./search');
const { stems, sentences, localEmbed, cosine, keywords, truncate } = require('../text');
const { sanitizeUntrusted } = require('../security');

const TIME_SENSITIVE = /\b(latest|current(ly)?|today|tonight|this week|news|recent(ly)?|now|update[ds]?|price|prices|rate|rates|cost of|weather|score|live|trending|released?|announce[ds]?|202[4-9]|election|budget|law|laws|rule|rules|regulation|policy|deadline for|schedule|timings?|open(ing)? hours)\b/i;
const EXPLICIT_WEB = /\b(search|look ?up|google|find (it )?online|on the (web|internet)|check online|browse|sources?|citations?|links?|according to)\b/i;
const FACTUAL_Q = /^(what|who|when|where|which|how (much|many|long|far|old)|is it true|does|do|did|can i legally|is there)\b/i;
const PERSONAL = /\b(my|me|i|our|we|match|partner|journey|relationship|feel|feeling|should i)\b/i;

// Does answering need the live web? Explainable decision.
function needsWeb(question, { internalHits = 0 } = {}) {
  const q = String(question || '').trim();
  if (!q) return { needed: false, reason: 'empty' };
  if (EXPLICIT_WEB.test(q)) return { needed: true, reason: 'user asked for web sources' };
  if (TIME_SENSITIVE.test(q) && !/\b(my|our) (journey|match|chat)\b/i.test(q)) return { needed: true, reason: 'time-sensitive information' };
  if (FACTUAL_Q.test(q) && internalHits === 0 && !PERSONAL.test(q.replace(/^(what|who|when|where|which|how)\b/i, ''))) return { needed: true, reason: 'factual question not covered by internal knowledge' };
  return { needed: false, reason: internalHits ? 'internal knowledge is sufficient' : 'personal / guidance question' };
}

function buildQuery(question) {
  let q = String(question || '').replace(/\b(can you|could you|please|kindly|search( the web)?( for)?|look ?up|google|find( out)?|tell me|i want to know|on the (web|internet)|with sources?|and cite( sources)?)\b/gi, ' ');
  q = q.replace(/[?!.]+$/g, '').replace(/\s+/g, ' ').trim();
  return q.length >= 3 ? q.slice(0, 200) : String(question).slice(0, 200);
}

function domainOf(url) { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } }

// Source quality: transparent heuristics, returned with reasons.
const REFERENCE = /(^|\.)(wikipedia\.org|britannica\.com|who\.int|un\.org|worldbank\.org|rbi\.org\.in|sebi\.gov\.in|incometax\.gov\.in|uidai\.gov\.in|indiacode\.nic\.in|pib\.gov\.in|mohfw\.gov\.in|nhs\.uk|cdc\.gov|nih\.gov|mayoclinic\.org|reuters\.com|apnews\.com|bbc\.co\.uk|bbc\.com|thehindu\.com|indianexpress\.com|livemint\.com|hindustantimes\.com|timesofindia\.indiatimes\.com|ndtv\.com|developer\.mozilla\.org|docs\.python\.org|nodejs\.org|github\.com|arxiv\.org|nature\.com|sciencedirect\.com)$/i;
const LOWQ = /(^|\.)(pinterest\.|quora\.com|answers\.|blogspot\.|medium\.com$|tumblr\.com|wordpress\.com$|facebook\.com|instagram\.com|tiktok\.com|x\.com|twitter\.com)/i;
function sourceQuality({ url, title, text, published }, { corroboration = 0, now = new Date() } = {}) {
  const d = domainOf(url);
  let s = 0.5; const reasons = [];
  if (/\.(gov|gov\.in|nic\.in|edu|ac\.in|ac\.uk|int)$/i.test(d)) { s += 0.25; reasons.push('official / academic domain'); }
  else if (REFERENCE.test(d)) { s += 0.18; reasons.push('established reference or news source'); }
  if (LOWQ.test(d)) { s -= 0.2; reasons.push('user-generated / social platform'); }
  if (/^https:/i.test(url)) s += 0.03; else { s -= 0.05; reasons.push('not served over HTTPS'); }
  const len = String(text || '').length;
  if (len < 400) { s -= 0.12; reasons.push('very little readable content'); } else if (len > 2500) s += 0.04;
  if (published) {
    const age = (now.getTime() - new Date(published).getTime()) / 86400000;
    if (Number.isFinite(age)) { if (age < 400) { s += 0.04; reasons.push('recently published'); } else if (age > 365 * 4) { s -= 0.06; reasons.push('older than four years'); } }
  } else reasons.push('no publication date found');
  if (corroboration > 0) { s += Math.min(0.12, 0.05 * corroboration); reasons.push(`corroborated by ${corroboration} other source${corroboration > 1 ? 's' : ''}`); }
  if (/(sponsored|advertorial|affiliate)/i.test(String(title || ''))) { s -= 0.1; reasons.push('marked sponsored'); }
  return { score: Math.max(0, Math.min(1, +s.toFixed(2))), reasons };
}

const NUM = /(₹|rs\.?|inr|\$|usd|chf|€)?\s?\d[\d,]*(\.\d+)?\s?(%|percent|crore|lakh|million|billion|thousand|km|kg|years?|days?|hours?)?/gi;
function extractFacts(question, text, { limit = 4 } = {}) {
  const q = new Set(stems(question));
  return sentences(text)
    .filter(s => s.length >= 40 && s.length <= 450)
    .map(s => {
      const st = stems(s);
      const overlap = st.filter(t => q.has(t)).length / Math.max(1, q.size);
      const nums = (s.match(NUM) || []).map(x => x.trim()).filter(x => /\d/.test(x));
      return { text: s, score: overlap + (nums.length ? 0.1 : 0), numbers: nums.slice(0, 4) };
    })
    .filter(f => f.score > 0.15)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// Same claim across sources but different numbers → a conflict worth flagging.
function detectConflicts(sources) {
  const facts = [];
  for (const s of sources) for (const f of s.facts || []) if (f.numbers.length) facts.push({ n: s.n, f, v: localEmbed(f.text) });
  const conflicts = [];
  for (let i = 0; i < facts.length; i++) {
    for (let j = i + 1; j < facts.length; j++) {
      if (facts[i].n === facts[j].n) continue;
      if (cosine(facts[i].v, facts[j].v) < 0.55) continue;
      const a = facts[i].f.numbers[0].replace(/[\s,]/g, '').toLowerCase();
      const b = facts[j].f.numbers[0].replace(/[\s,]/g, '').toLowerCase();
      if (a && b && a !== b) {
        const topic = keywords(facts[i].f.text + ' ' + facts[j].f.text, 3).join(' ');
        conflicts.push({ topic, values: [{ source: facts[i].n, value: facts[i].f.numbers[0] }, { source: facts[j].n, value: facts[j].f.numbers[0] }] });
      }
    }
  }
  return conflicts.slice(0, 5);
}

function urlHash(url) { return crypto.createHash('sha256').update(String(url)).digest('hex'); }

// Retrieve + extract one document (cached, robots-compliant).
async function fetchDocument(url, { fetcher = safeFetch, fetchOpts = {}, useCache = true, respectRobots = true } = {}) {
  const key = urlHash(url);
  if (useCache) {
    try {
      const c = await WebCache.findOne({ urlHash: key }).lean();
      if (c && c.expiresAt && new Date(c.expiresAt) > new Date()) { metrics.bump('web.fetch.cache_hits'); return { ok: true, cached: true, url, finalUrl: c.finalUrl || url, title: c.title, text: c.text, meta: c.meta || {}, contentType: c.contentType }; }
    } catch { /* cache is best-effort */ }
  }
  const cfg = await config.get();
  if (respectRobots) {
    const rb = await robots.check(url, { fetcher, fetchOpts });
    if (!rb.allowed) { metrics.bump('web.fetch.robots_blocked'); return { ok: false, url, error: 'disallowed by robots.txt' }; }
    if (rb.crawlDelay) fetchOpts = { ...fetchOpts, perHostIntervalMs: Math.min(10000, rb.crawlDelay * 1000) };
  }
  let r;
  try {
    r = await fetcher(url, { timeoutMs: cfg.fetch.timeoutMs, maxBytes: cfg.fetch.maxBytes, perHostIntervalMs: cfg.fetch.perHostIntervalMs, ...fetchOpts });
  } catch (e) {
    metrics.bump('web.fetch.errors');
    return { ok: false, url, error: String(e.message || e).slice(0, 120) };
  }
  if (r.status < 200 || r.status >= 300) { metrics.bump('web.fetch.errors'); return { ok: false, url, error: 'HTTP ' + r.status }; }
  let title = '', text = '', meta = {};
  if (/application\/pdf/i.test(r.contentType) || r.body.subarray(0, 5).toString('latin1') === '%PDF-') {
    const p = extractPdfText(r.body);
    if (!p.ok) { metrics.bump('web.fetch.errors'); return { ok: false, url, error: 'PDF: ' + p.reason }; }
    text = p.text; title = domainOf(r.finalUrl) + ' (PDF)'; meta = { type: 'pdf' };
  } else if (/html|xml/i.test(r.contentType)) {
    const e = html.extract(r.body.toString('utf8'), r.finalUrl);
    title = e.title; text = e.text; meta = { type: 'html', description: e.description, siteName: e.siteName, published: e.published, modified: e.modified, lang: e.lang, canonical: e.canonical };
  } else {
    text = r.body.toString('utf8'); title = domainOf(r.finalUrl); meta = { type: 'text' };
  }
  text = sanitizeUntrusted(text, 40000);
  metrics.bump('web.fetch.ok');
  try {
    await WebCache.findOneAndUpdate({ urlHash: key }, { $set: { urlHash: key, url, finalUrl: r.finalUrl, status: r.status, contentType: r.contentType, title, text, meta, fetchedAt: new Date(), expiresAt: new Date(Date.now() + 6 * 3600 * 1000) } }, { upsert: true, new: true });
  } catch { /* best-effort */ }
  return { ok: true, cached: false, url, finalUrl: r.finalUrl, title, text, meta, contentType: r.contentType, truncated: r.truncated };
}

async function mapLimit(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); }
  }));
  return out;
}

// One research pass for a question → evidence pack with numbered sources.
async function research(question, { maxFetches, searchImpl, fetcher, fetchOpts, signal, startN = 1, query } = {}) {
  const cfg = await config.get();
  const q = query || buildQuery(question);
  const res = await searchMod.search(q, { impl: searchImpl, limit: cfg.search.maxResults });
  if (!res.configured) return { configured: false, query: q, sources: [], conflicts: [], errors: ['no search provider is configured'] };
  const top = res.results.slice(0, Math.max(1, maxFetches || Math.min(4, cfg.research.maxFetches)));
  const errors = [];
  const docs = await mapLimit(top, 3, async (r) => {
    if (signal && signal.aborted) return null;
    const d = await fetchDocument(r.url, { fetcher, fetchOpts });
    if (!d.ok) { errors.push(`${domainOf(r.url)}: ${d.error}`); return null; }
    return { r, d };
  });
  const sources = [];
  let n = startN;
  for (const x of docs) {
    if (!x) continue;
    const facts = extractFacts(question, x.d.text);
    sources.push({
      n: n++, title: x.d.title || x.r.title, url: x.d.finalUrl || x.r.url, domain: domainOf(x.d.finalUrl || x.r.url),
      published: (x.d.meta && x.d.meta.published) || x.r.published || null, snippet: x.r.snippet,
      excerpt: truncate(facts.map(f => f.text).join(' ') || x.d.text.slice(0, 600), 900),
      text: x.d.text.slice(0, 12000), facts, fetchedAt: new Date().toISOString()
    });
  }
  // corroboration: how many other sources share a similar fact
  for (const s of sources) {
    let c = 0;
    for (const o of sources) {
      if (o === s) continue;
      if ((s.facts || []).some(f => (o.facts || []).some(g => cosine(localEmbed(f.text), localEmbed(g.text)) > 0.6))) c++;
    }
    s.quality = sourceQuality({ url: s.url, title: s.title, text: s.text, published: s.published }, { corroboration: c });
  }
  sources.sort((a, b) => b.quality.score - a.quality.score);
  return { configured: true, provider: res.provider, query: q, sources, conflicts: detectConflicts(sources), errors, searchError: res.error || null };
}

module.exports = { needsWeb, buildQuery, research, fetchDocument, sourceQuality, extractFacts, detectConflicts, domainOf };

// intelligence/web/robots.js — robots.txt compliance (RFC 9309).
//
//  · 2xx → parse; the group naming our token wins, else the "*" group
//  · 4xx → no restrictions; 5xx / unreachable → treat as full disallow (for now)
//  · longest matching rule wins; ties go to Allow; supports * and $
//  · cached per origin for 12 hours; crawl-delay is honoured as host spacing

const { safeFetch } = require('./safe-fetch');

const TOKEN = 'sambandhsetubot';
const TTL = 12 * 3600 * 1000;
const cache = new Map();   // origin → { groups, at, status }

function parseRobots(txt) {
  const groups = [];
  let cur = null, lastWasAgent = false;
  for (const raw of String(txt || '').split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const i = line.indexOf(':');
    if (i < 0) continue;
    const field = line.slice(0, i).trim().toLowerCase();
    const value = line.slice(i + 1).trim();
    if (field === 'user-agent') {
      if (!lastWasAgent || !cur) { cur = { agents: [], rules: [], crawlDelay: null }; groups.push(cur); }
      cur.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!cur) continue;
    if (field === 'allow' || field === 'disallow') { if (value || field === 'allow') cur.rules.push({ allow: field === 'allow', path: value }); }
    else if (field === 'crawl-delay') { const n = Number(value); if (Number.isFinite(n)) cur.crawlDelay = n; }
  }
  return groups;
}

function patternToRegex(p) {
  const anchored = p.endsWith('$');
  const body = (anchored ? p.slice(0, -1) : p).split('*').map(s => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*');
  return new RegExp('^' + body + (anchored ? '$' : ''));
}

function decide(groups, pathAndQuery) {
  const mine = groups.find(g => g.agents.some(a => a.replace(/\/.*$/, '') === TOKEN))
    || groups.find(g => g.agents.includes('*'));
  if (!mine) return { allowed: true, crawlDelay: null };
  let best = null;
  for (const r of mine.rules) {
    if (r.path === '') continue;
    if (patternToRegex(r.path).test(pathAndQuery)) {
      const len = r.path.length;
      if (!best || len > best.len || (len === best.len && r.allow)) best = { allow: r.allow, len };
    }
  }
  return { allowed: best ? best.allow : true, crawlDelay: mine.crawlDelay };
}

async function check(url, { fetcher = safeFetch, fetchOpts = {} } = {}) {
  const u = new URL(url);
  const origin = u.origin;
  let entry = cache.get(origin);
  if (!entry || Date.now() - entry.at > TTL) {
    try {
      const r = await fetcher(origin + '/robots.txt', { ...fetchOpts, timeoutMs: 6000, maxBytes: 500000 });
      if (r.status >= 200 && r.status < 300) entry = { groups: parseRobots(r.body.toString('utf8')), at: Date.now(), status: r.status };
      else if (r.status >= 400 && r.status < 500) entry = { groups: [], at: Date.now(), status: r.status };
      else entry = { groups: [{ agents: ['*'], rules: [{ allow: false, path: '/' }], crawlDelay: null }], at: Date.now() - TTL + 600000, status: r.status };
    } catch {
      entry = { groups: [{ agents: ['*'], rules: [{ allow: false, path: '/' }], crawlDelay: null }], at: Date.now() - TTL + 600000, status: 0 };
    }
    cache.set(origin, entry);
  }
  return decide(entry.groups, u.pathname + u.search);
}

module.exports = { check, parseRobots, decide, _clear: () => cache.clear() };

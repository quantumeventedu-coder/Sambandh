// intelligence/text.js — dependency-free language utilities shared by the whole
// intelligence engine: tokenisation, keyword extraction, a LOCAL embedding
// (feature hashing — always available, no model server needed), BM25, cosine,
// temporal-phrase parsing and conversational-reference detection.
//
// The hashing embedding is a real vector space model (signed feature hashing over
// stemmed unigrams, bigrams and character trigrams). It is weaker than a neural
// embedding model, which is why the gateway prefers a self-hosted embedding model
// when one is configured — but it guarantees retrieval keeps working on CPU alone.

const DIM = 384;

const STOP = new Set((
  'a an the and or but if then else of to in on at by for with from up down out over under about into ' +
  'is am are was were be been being have has had do does did doing will would shall should can could may might must ' +
  'i me my mine myself we us our ours you your yours he him his she her hers it its they them their theirs ' +
  'this that these those there here what which who whom whose when where why how all any both each few more most ' +
  'other some such no nor not only own same so than too very just also again once now ok okay yes please thanks thank ' +
  'hi hello hey let lets get got go going like want need know think said say tell told really much many well ' +
  // Hinglish/Hindi function words (romanised) — common in Indian chats
  'hai hain ho tha thi the ka ki ke ko se mein me aur ye yeh wo woh kya nahi nhi bhi to toh par pe na hum tum aap'
).split(/\s+/));

function normalize(s) {
  return String(s == null ? '' : s)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Light English suffix stripping — enough to merge plural/tense variants.
function stem(t) {
  if (t.length <= 4 || /\d/.test(t)) return t;
  if (t.endsWith('ies') && t.length > 5) return t.slice(0, -3) + 'y';
  for (const suf of ['ingly', 'edly', 'ings', 'ing', 'ment', 'ness', 'ed', 'es', 'ly', 's']) {
    if (t.endsWith(suf) && t.length - suf.length >= 3) {
      if (suf === 's' && (t.endsWith('ss') || t.endsWith('us') || t.endsWith('is'))) return t;
      return t.slice(0, -suf.length);
    }
  }
  return t;
}

function tokens(s, { keepStop = false } = {}) {
  const out = [];
  for (const raw of normalize(s).split(' ')) {
    const w = raw.replace(/^['-]+|['-]+$/g, '');
    if (!w || w.length < 2) continue;
    if (!keepStop && STOP.has(w)) continue;
    out.push(w);
  }
  return out;
}

function stems(s) { return tokens(s).map(stem); }

function keywords(s, k = 12) {
  const tf = new Map();
  for (const t of stems(s)) tf.set(t, (tf.get(t) || 0) + 1);
  return [...tf.entries()].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length).slice(0, k).map(([t]) => t);
}

function sentences(s) {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?\u0964])\s+(?=[\p{Lu}\p{N}"'(])|\n+/u)
    .map(x => x.trim())
    .filter(x => x.length > 0);
}

// FNV-1a 32-bit.
function hash32(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function addFeature(v, feat, w) {
  const h = hash32(feat);
  const idx = h % DIM;
  const sign = (h >>> 31) ? -1 : 1;
  v[idx] += sign * w;
}

function localEmbed(text) {
  const v = new Float64Array(DIM);
  const st = stems(text);
  for (let i = 0; i < st.length; i++) {
    addFeature(v, 'u:' + st[i], 1);
    if (i + 1 < st.length) addFeature(v, 'b:' + st[i] + '_' + st[i + 1], 0.7);
    const w = '#' + st[i] + '#';
    for (let j = 0; j + 3 <= w.length; j++) addFeature(v, 'c:' + w.slice(j, j + 3), 0.25);
  }
  let n = 0;
  for (let i = 0; i < DIM; i++) n += v[i] * v[i];
  n = Math.sqrt(n) || 1;
  const out = new Array(DIM);
  for (let i = 0; i < DIM; i++) out[i] = Math.round((v[i] / n) * 10000) / 10000;
  return out;
}

function cosine(a, b) {
  if (!a || !b || !a.length || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// BM25 over an in-memory candidate set. docs: [{ terms: string[] }]
function bm25(queryTerms, docs, { k1 = 1.2, b = 0.75 } = {}) {
  const N = docs.length || 1;
  const avgdl = docs.reduce((s, d) => s + d.terms.length, 0) / N || 1;
  const df = new Map();
  for (const d of docs) for (const t of new Set(d.terms)) df.set(t, (df.get(t) || 0) + 1);
  const q = [...new Set(queryTerms)];
  return docs.map(d => {
    const tf = new Map();
    for (const t of d.terms) tf.set(t, (tf.get(t) || 0) + 1);
    let s = 0;
    for (const t of q) {
      const f = tf.get(t) || 0;
      if (!f) continue;
      const idf = Math.log(1 + (N - (df.get(t) || 0) + 0.5) / ((df.get(t) || 0) + 0.5));
      s += idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * d.terms.length / avgdl));
    }
    return s;
  });
}

// ---------------- temporal reasoning ----------------
const DAY = 86400000;
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const MON3 = MONTHS.map(m => m.slice(0, 3));

function startOfDay(d) { const x = new Date(d); x.setUTCHours(0, 0, 0, 0); return x; }
function monthIndex(word) {
  const w = String(word || '').toLowerCase();
  let i = MONTHS.indexOf(w);
  if (i < 0) i = MON3.indexOf(w.slice(0, 3));
  return i;
}

// A time window referenced by the text ("last week", "yesterday", "in March",
// "3 days ago") → { from, to, label } or null. Used to filter retrieval.
function parseTimeRange(text, now = new Date()) {
  const t = normalize(text);
  const today = startOfDay(now);
  let m;
  if (/\btoday\b|\baaj\b/.test(t)) return { from: today, to: new Date(today.getTime() + DAY), label: 'today' };
  if (/\byesterday\b|\bkal raat\b/.test(t)) return { from: new Date(today.getTime() - DAY), to: today, label: 'yesterday' };
  if (/\b(last|previous|pichhle|pichle) week\b/.test(t)) return { from: new Date(today.getTime() - 14 * DAY), to: new Date(today.getTime() - 0 * DAY), label: 'last week' };
  if (/\bthis week\b/.test(t)) return { from: new Date(today.getTime() - 7 * DAY), to: new Date(now.getTime() + DAY), label: 'this week' };
  if (/\b(last|previous) month\b/.test(t)) return { from: new Date(today.getTime() - 62 * DAY), to: new Date(today.getTime() - 0 * DAY), label: 'last month' };
  if (/\bthis month\b/.test(t)) return { from: new Date(today.getTime() - 31 * DAY), to: new Date(now.getTime() + DAY), label: 'this month' };
  if ((m = t.match(/\b(\d{1,2}|a|one|two|three|four|five|six) (day|days|week|weeks|month|months) ago\b/))) {
    const words = { a: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
    const n = words[m[1]] || parseInt(m[1], 10);
    const unit = m[2].startsWith('day') ? 1 : m[2].startsWith('week') ? 7 : 30;
    const center = today.getTime() - n * unit * DAY;
    const pad = Math.max(1, Math.round(unit * 0.6)) * DAY;
    return { from: new Date(center - pad), to: new Date(center + pad + DAY), label: m[0] };
  }
  if ((m = t.match(/\blast (sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/))) {
    const target = WEEKDAYS.indexOf(m[1]);
    let diff = (today.getUTCDay() - target + 7) % 7 || 7;
    const d = new Date(today.getTime() - diff * DAY);
    return { from: d, to: new Date(d.getTime() + DAY), label: m[0] };
  }
  if ((m = t.match(/\bin (january|february|march|april|may|june|july|august|september|october|november|december)\b/))) {
    const mi = monthIndex(m[1]);
    let y = now.getUTCFullYear();
    if (mi > now.getUTCMonth()) y -= 1;  // "in March" said in November → this past March
    return { from: new Date(Date.UTC(y, mi, 1)), to: new Date(Date.UTC(y, mi + 1, 1)), label: m[0] };
  }
  return null;
}

// A due date stated in the text ("by Friday", "on 15 March", "next week",
// "tomorrow", "2026-12-01", "15/12/2026", "end of the month") → Date | null.
function parseDueDate(text, now = new Date()) {
  const t = normalize(text);
  const today = startOfDay(now);
  let m;
  if ((m = String(text).match(/\b(\d{4})-(\d{2})-(\d{2})\b/))) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if ((m = String(text).match(/\b(\d{1,2})[/.](\d{1,2})[/.](\d{4})\b/))) return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1])); // Indian dd/mm/yyyy
  if (/\btomorrow\b/.test(t)) return new Date(today.getTime() + DAY);
  if (/\btonight\b|\btoday\b/.test(t)) return today;
  if (/\bnext week\b/.test(t)) return new Date(today.getTime() + 7 * DAY);
  if (/\bnext month\b/.test(t)) return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1));
  if (/\bend of (the )?month\b/.test(t)) return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0));
  if ((m = t.match(/\b(in|within) (\d{1,2}) (day|days|week|weeks)\b/))) {
    return new Date(today.getTime() + parseInt(m[2], 10) * (m[3].startsWith('week') ? 7 : 1) * DAY);
  }
  if ((m = t.match(/\b(by|on|before|this|next|coming) (sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/))) {
    const target = WEEKDAYS.indexOf(m[2]);
    let diff = (target - today.getUTCDay() + 7) % 7;
    if (diff === 0 || m[1] === 'next') diff += diff === 0 ? 7 : 0;
    return new Date(today.getTime() + diff * DAY);
  }
  if ((m = t.match(/\b(\d{1,2})(st|nd|rd|th)? (of )?(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b/))) {
    const mi = monthIndex(m[4]);
    let y = today.getUTCFullYear();
    const d = new Date(Date.UTC(y, mi, parseInt(m[1], 10)));
    if (d.getTime() < today.getTime() - 30 * DAY) d.setUTCFullYear(y + 1);
    return d;
  }
  if ((m = t.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december) (\d{1,2})\b/))) {
    const mi = monthIndex(m[1]);
    const d = new Date(Date.UTC(today.getUTCFullYear(), mi, parseInt(m[2], 10)));
    if (d.getTime() < today.getTime() - 30 * DAY) d.setUTCFullYear(d.getUTCFullYear() + 1);
    return d;
  }
  return null;
}

// Conversational references that point at earlier context.
const REF_PATTERNS = [
  { kind: 'project', re: /\b(that|the|this|our|my) (project|app|website|startup|business|plan|proposal|product|idea|venture)\b/i },
  { kind: 'design', re: /\b(the|that) (previous|earlier|last|old|other) (design|version|draft|layout|mockup|wireframe)\b/i },
  { kind: 'conversation', re: /\b(the )?(other|previous|last|earlier|old) (chat|conversation|discussion|thread)\b/i },
  { kind: 'discussed', re: /\bwhat (we|i) (discussed|talked about|said|decided|agreed)\b/i },
  { kind: 'decision', re: /\b(the|that|our) (decision|choice|plan we made)\b/i },
  { kind: 'person', re: /\b(that|the) (person|guy|girl|man|woman|match|friend|colleague)\b/i },
  { kind: 'task', re: /\b(that|the|my) (task|todo|to-do|deadline|reminder)\b/i }
];
function detectReferences(text) {
  const out = [];
  for (const p of REF_PATTERNS) {
    const m = String(text || '').match(p.re);
    if (m) out.push({ kind: p.kind, phrase: m[0] });
  }
  return out;
}

function truncate(s, n) {
  const str = String(s || '');
  return str.length <= n ? str : str.slice(0, Math.max(0, n - 1)).replace(/\s+\S*$/, '') + '…';
}

// Rough token estimate (≈4 chars/token for Latin text) — used for context budgeting.
function estimateTokens(s) { return Math.ceil(String(s || '').length / 4); }

module.exports = {
  DIM, STOP, normalize, stem, tokens, stems, keywords, sentences, hash32,
  localEmbed, cosine, bm25, parseTimeRange, parseDueDate, detectReferences,
  truncate, estimateTokens, monthIndex
};

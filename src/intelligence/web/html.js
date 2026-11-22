// intelligence/web/html.js — readable-content extraction from HTML, dependency-free.
//
// Builds a light DOM (tolerant tokenizer), drops boilerplate (scripts, styles,
// nav/header/footer/aside/forms, cookie banners, share widgets…), then picks the
// main content (article/main/[role=main], else the densest block of paragraphs).
// Returns title/description/site/date metadata + clean text with paragraph breaks.

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const RAW = new Set(['script', 'style', 'noscript', 'textarea', 'template', 'svg', 'math', 'iframe', 'object']);
const DROP = new Set(['script', 'style', 'noscript', 'template', 'svg', 'math', 'iframe', 'object', 'nav', 'footer', 'header', 'aside', 'form', 'button', 'select', 'input', 'label', 'dialog', 'menu']);
const BLOCK = new Set(['p', 'div', 'section', 'article', 'main', 'li', 'ul', 'ol', 'table', 'tr', 'td', 'th', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'figure', 'figcaption', 'dd', 'dt', 'dl', 'br', 'hr', 'address', 'details', 'summary']);
const BOILER = /(^|[\s_-])(nav|navbar|menu|footer|header|sidebar|side-bar|cookie|consent|banner|advert|ads?|promo|subscribe|newsletter|share|social|comment|comments|related|breadcrumb|popup|modal|signup|login|toolbar|masthead)([\s_-]|$)/i;

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', copy: '©', reg: '®', trade: '™', rupee: '₹', middot: '·', bull: '•' };
function decodeEntities(s) {
  return String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') { const cp = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); try { return String.fromCodePoint(cp); } catch { return ''; } }
    return ENT[e.toLowerCase()] != null ? ENT[e.toLowerCase()] : m;
  });
}

function parseAttrs(s) {
  const attrs = {};
  const re = /([^\s=/>]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let m;
  while ((m = re.exec(s))) attrs[m[1].toLowerCase()] = decodeEntities(m[3] != null ? m[3] : m[4] != null ? m[4] : m[5] != null ? m[5] : '');
  return attrs;
}

function parse(html) {
  const root = { tag: '#root', attrs: {}, children: [], parent: null };
  let cur = root;
  const re = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<!doctype[^>]*>|<(\/?)([a-zA-Z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>|([^<]+|<)/gi;
  let m;
  while ((m = re.exec(html))) {
    if (m[4] != null) { cur.children.push(m[4]); continue; }
    if (!m[2]) continue;
    const tag = m[2].toLowerCase();
    if (m[1]) {   // closing tag: pop to the nearest matching open element
      let n = cur;
      while (n && n.tag !== tag && n !== root) n = n.parent;
      if (n && n !== root) cur = n.parent;
      continue;
    }
    const node = { tag, attrs: parseAttrs(m[3] || ''), children: [], parent: cur };
    cur.children.push(node);
    if (RAW.has(tag)) {
      const end = html.toLowerCase().indexOf('</' + tag, re.lastIndex);
      const stop = end < 0 ? html.length : end;
      node.raw = html.slice(re.lastIndex, stop);
      re.lastIndex = end < 0 ? html.length : html.indexOf('>', end) + 1 || html.length;
      continue;
    }
    if (!VOID.has(tag) && !/\/\s*$/.test(m[3] || '')) cur = node;
  }
  return root;
}

function isBoiler(node) {
  if (DROP.has(node.tag)) return true;
  const a = node.attrs || {};
  if (a.hidden != null || /display\s*:\s*none/i.test(a.style || '') || a['aria-hidden'] === 'true') return true;
  if (['navigation', 'banner', 'contentinfo', 'complementary', 'search'].includes(a.role)) return true;
  const cls = (a.class || '') + ' ' + (a.id || '');
  return BOILER.test(cls) && !/(article|content|post|story|main|entry)/i.test(cls);
}

function textOf(node, out = []) {
  for (const c of node.children) {
    if (typeof c === 'string') { out.push(decodeEntities(c)); continue; }
    if (isBoiler(c)) continue;
    const block = BLOCK.has(c.tag);
    if (block) out.push('\n');
    if (/^h[1-6]$/.test(c.tag)) out.push('\n');
    if (c.tag === 'li') out.push('• ');
    textOf(c, out);
    if (block) out.push('\n');
  }
  return out;
}

function clean(parts) {
  return parts.join('').replace(/[ \t ]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function findAll(node, pred, acc = []) {
  for (const c of node.children) {
    if (typeof c === 'string') continue;
    if (pred(c)) acc.push(c);
    findAll(c, pred, acc);
  }
  return acc;
}

function paragraphScore(node) {
  let len = 0, ps = 0;
  for (const p of findAll(node, n => n.tag === 'p')) { const t = clean(textOf(p)); if (t.length > 40) { len += t.length; ps++; } }
  return len + ps * 40;
}

function metaContent(root, names) {
  const metas = findAll(root, n => n.tag === 'meta');
  for (const name of names) {
    const m = metas.find(x => (x.attrs.name || x.attrs.property || x.attrs.itemprop || '').toLowerCase() === name);
    if (m && m.attrs.content) return m.attrs.content.trim();
  }
  return null;
}

function extract(html, baseUrl = '') {
  const root = parse(String(html || ''));
  const titleNode = findAll(root, n => n.tag === 'title')[0];
  const title = metaContent(root, ['og:title', 'twitter:title']) || (titleNode ? clean(textOf(titleNode)) : '') || '';
  const description = metaContent(root, ['description', 'og:description', 'twitter:description']);
  const siteName = metaContent(root, ['og:site_name', 'application-name']);
  const timeNode = findAll(root, n => n.tag === 'time' && n.attrs.datetime)[0];
  const published = metaContent(root, ['article:published_time', 'datepublished', 'date', 'dc.date', 'publish-date']) || (timeNode && timeNode.attrs.datetime) || null;
  const modified = metaContent(root, ['article:modified_time', 'datemodified', 'last-modified']);
  const htmlNode = findAll(root, n => n.tag === 'html')[0];
  const lang = htmlNode && htmlNode.attrs.lang ? htmlNode.attrs.lang : null;
  const body = findAll(root, n => n.tag === 'body')[0] || root;

  let main = findAll(body, n => n.tag === 'article' || n.tag === 'main' || n.attrs.role === 'main')
    .filter(n => !isBoiler(n))
    .sort((a, b) => paragraphScore(b) - paragraphScore(a))[0];
  if (!main || paragraphScore(main) < 200) {
    const cands = findAll(body, n => ['div', 'section', 'td'].includes(n.tag) && !isBoiler(n));
    const best = cands.map(n => ({ n, s: paragraphScore(n) })).sort((a, b) => b.s - a.s)[0];
    if (best && best.s >= (main ? paragraphScore(main) : 0)) main = best.n;
  }
  const text = clean(textOf(main || body));
  const headings = findAll(main || body, n => /^h[1-3]$/.test(n.tag)).map(h => clean(textOf(h))).filter(Boolean).slice(0, 20);
  let canonical = null;
  const link = findAll(root, n => n.tag === 'link' && /canonical/i.test(n.attrs.rel || ''))[0];
  if (link && link.attrs.href) { try { canonical = new URL(link.attrs.href, baseUrl || undefined).toString(); } catch { canonical = null; } }
  return { title: title.slice(0, 300), description: description ? description.slice(0, 500) : null, siteName, published, modified, lang, canonical, headings, text };
}

module.exports = { extract, parse, decodeEntities };

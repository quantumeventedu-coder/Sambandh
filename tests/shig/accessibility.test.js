// tests/shig/accessibility.test.js — Phase 2. Parser-based accessibility
// enforcement (SHIG-0011 / C-8 / SHIG-0019) across EVERY shipped surface: the six
// static documents and every HTML fragment the SPA renders (extracted via AST).
//
// Element-level rules run over all surfaces; document-level rules (heading order,
// duplicate id, html lang) run only over whole documents.

const { staticSurfaces, spaSurface, read } = require('./lib/surfaces');
const { parseHtml, extractHtmlFragmentsFromJs, hasAccessibleName, EXPR } = require('./lib/dom');
const { ARIA_ATTRIBUTES, ARIA_ROLES, INTERACTIVE_TAGS } = require('./lib/aria');
const { RULES } = require('./lib/rules');
const { assertNoViolations } = require('./lib/report');

const documents = staticSurfaces().map((s) => ({ surface: s.rel, root: parseHtml(read(s.abs)), whole: true }));
const spa = spaSurface();
const fragments = extractHtmlFragmentsFromJs(read(spa.abs)).map((f) => ({
  surface: `${spa.rel}:${f.line}`, root: parseHtml(f.html), line: f.line, whole: false,
}));
const allScopes = [...documents, ...fragments];

const snip = (el) => el.toString().replace(/\s+/g, ' ').trim().slice(0, 90);

// ---------------------------------------------------------------- element rules
test('A11Y-IMG-ALT — every <img> has an alt attribute', () => {
  const v = [];
  for (const { surface, root } of allScopes) {
    for (const img of root.querySelectorAll('img')) {
      if (img.getAttribute('alt') == null) v.push({ surface, detail: snip(img) });
    }
  }
  assertNoViolations('A11Y-IMG-ALT', RULES['A11Y-IMG-ALT'], v);
});

test('A11Y-CONTROL-NAME — buttons and links have an accessible name', () => {
  const v = [];
  for (const { surface, root } of allScopes) {
    for (const el of [...root.querySelectorAll('button'), ...root.querySelectorAll('a[href]')]) {
      if (el.getAttribute('aria-hidden') === 'true') continue;
      if (!hasAccessibleName(el)) v.push({ surface, detail: snip(el) });
    }
  }
  assertNoViolations('A11Y-CONTROL-NAME', RULES['A11Y-CONTROL-NAME'], v);
});

test('A11Y-INPUT-LABEL — form fields are programmatically labelled', () => {
  const EXEMPT = new Set(['hidden', 'submit', 'reset', 'button', 'image']);
  const v = [];
  for (const { surface, root } of allScopes) {
    const labelFors = new Set(root.querySelectorAll('label').map((l) => l.getAttribute('for')).filter(Boolean));
    const hasDynamicLabelFor = [...labelFors].some((f) => f.includes(EXPR));
    for (const el of [...root.querySelectorAll('input'), ...root.querySelectorAll('select'), ...root.querySelectorAll('textarea')]) {
      const type = (el.getAttribute('type') || '').toLowerCase();
      if (EXEMPT.has(type)) continue;
      if (el.getAttribute('aria-hidden') === 'true') continue;
      const id = el.getAttribute('id');
      let named = false;
      if ((el.getAttribute('aria-label') || '').trim()) named = true;
      else if (el.getAttribute('aria-labelledby')) named = true;
      else if ((el.getAttribute('title') || '').trim()) named = true;
      else if (id && labelFors.has(id)) named = true;
      else if (id && id.includes(EXPR) && hasDynamicLabelFor) named = true; // dynamic id + dynamic label → can't disprove
      else {
        let p = el.parentNode;
        while (p && p.tagName) { if (p.tagName === 'LABEL') { named = true; break; } p = p.parentNode; }
      }
      if (!named) v.push({ surface, detail: snip(el) });
    }
  }
  assertNoViolations('A11Y-INPUT-LABEL', RULES['A11Y-INPUT-LABEL'], v);
});

test('A11Y-ARIA-VALID — only valid ARIA attributes and roles', () => {
  const v = [];
  for (const { surface, root } of allScopes) {
    for (const el of root.querySelectorAll('*')) {
      const attrs = el.attributes || {};
      for (const name of Object.keys(attrs)) {
        if (name.startsWith('aria-') && !ARIA_ATTRIBUTES.has(name)) {
          v.push({ surface, detail: `unknown ${name} on <${el.rawTagName}>` });
        }
      }
      const role = attrs.role;
      if (role) {
        for (const token of role.split(/\s+/).filter(Boolean)) {
          if (token.includes(EXPR)) continue;
          if (!ARIA_ROLES.has(token)) v.push({ surface, detail: `invalid role="${token}" on <${el.rawTagName}>` });
        }
      }
    }
  }
  assertNoViolations('A11Y-ARIA-VALID', RULES['A11Y-ARIA-VALID'], v);
});

test('A11Y-ARIA-HIDDEN-FOCUS — aria-hidden is not on a focusable element', () => {
  const v = [];
  for (const { surface, root } of allScopes) {
    for (const el of root.querySelectorAll('[aria-hidden]')) {
      if (el.getAttribute('aria-hidden') !== 'true') continue;
      const tag = (el.rawTagName || '').toUpperCase();
      const ti = el.getAttribute('tabindex');
      const focusable = INTERACTIVE_TAGS.has(tag) || (ti != null && !ti.includes(EXPR) && Number(ti) >= 0);
      if (focusable) v.push({ surface, detail: `aria-hidden on focusable <${el.rawTagName}>` });
    }
  }
  assertNoViolations('A11Y-ARIA-HIDDEN-FOCUS', RULES['A11Y-ARIA-HIDDEN-FOCUS'], v);
});

// ---------------------------------------------------------------- document rules
function headingLevelsInOrder(root) {
  const out = [];
  (function rec(n) {
    if (!n) return;
    if (n.tagName && /^H[1-6]$/.test(n.tagName)) out.push(Number(n.tagName[1]));
    for (const k of n.childNodes || []) rec(k);
  })(root);
  return out;
}

test('A11Y-HEADING-ORDER — heading levels do not skip (documents)', () => {
  const v = [];
  for (const { surface, root } of documents) {
    const levels = headingLevelsInOrder(root);
    for (let i = 1; i < levels.length; i++) {
      if (levels[i] - levels[i - 1] > 1) {
        v.push({ surface, detail: `h${levels[i - 1]} → h${levels[i]} (skipped a level)` });
      }
    }
  }
  assertNoViolations('A11Y-HEADING-ORDER', RULES['A11Y-HEADING-ORDER'], v);
});

test('A11Y-DUP-ID — ids are unique within a document', () => {
  const v = [];
  for (const { surface, root } of documents) {
    const seen = new Map();
    for (const el of root.querySelectorAll('[id]')) {
      const id = el.getAttribute('id');
      if (!id || id.includes(EXPR)) continue;
      seen.set(id, (seen.get(id) || 0) + 1);
    }
    for (const [id, n] of seen) if (n > 1) v.push({ surface, detail: `id="${id}" appears ${n}×` });
  }
  assertNoViolations('A11Y-DUP-ID', RULES['A11Y-DUP-ID'], v);
});

test('A11Y-HTML-LANG — every document declares a language', () => {
  const v = [];
  for (const { surface, root } of documents) {
    const html = root.querySelector('html');
    const lang = html && html.getAttribute('lang');
    if (!lang || !lang.trim()) v.push({ surface, detail: '<html> has no lang attribute' });
  }
  assertNoViolations('A11Y-HTML-LANG', RULES['A11Y-HTML-LANG'], v);
});

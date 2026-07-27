// tests/shig/lib/dom.js — semantic parsing, not regex (SHIG conformance suite
// architecture rule: prefer AST/semantic analysis over string matching).
//
//   • Static HTML  → parsed with node-html-parser (a real, dependency-free DOM).
//   • The SPA JS   → parsed with acorn (a real JS AST); HTML-bearing template and
//                    string literals are extracted, with ${…} expressions replaced
//                    by an inert placeholder so attribute presence is still checked
//                    but dynamic values are never mistaken for real paths/text.

const { parse } = require('node-html-parser');
const acorn = require('acorn');

// Inert, whitespace-free sentinel standing in for a `${expression}`. Never matches
// a real path, id, or empty string, so "has an alt / accessible name" stays true
// for `alt="${x}"`, while "src points at a real file" correctly skips `src="${x}"`.
const EXPR = '⁣EXPR⁣';

/** Parse an HTML string (whole document OR a fragment) into a queryable DOM. */
function parseHtml(html) {
  return parse(html, {
    comment: false,
    voidTag: { closingSlash: true },
    blockTextElements: { script: true, style: true, pre: true, code: true },
  });
}

/** Generic AST walker: visits every node bearing a string `type`. */
function walk(node, visit) {
  if (!node || typeof node.type !== 'string') return;
  visit(node);
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'start' || key === 'end') continue;
    const val = node[key];
    if (Array.isArray(val)) {
      for (const c of val) if (c && typeof c.type === 'string') walk(c, visit);
    } else if (val && typeof val.type === 'string') {
      walk(val, visit);
    }
  }
}

const looksLikeHtml = (s) => /<[a-zA-Z][^>]*>/.test(s);

/**
 * Extract HTML-bearing string/template literals from a JS source via AST.
 * Returns [{ html, line }]. Expressions become the EXPR sentinel.
 */
function extractHtmlFragmentsFromJs(jsSource) {
  const ast = acorn.parse(jsSource, { ecmaVersion: 'latest', sourceType: 'script', locations: true });
  const frags = [];
  walk(ast, (node) => {
    if (node.type === 'TemplateLiteral') {
      const raw = node.quasis
        .map((q) => (q.value.cooked != null ? q.value.cooked : q.value.raw))
        .join(EXPR);
      if (looksLikeHtml(raw)) frags.push({ html: raw, line: node.loc.start.line });
    } else if (node.type === 'Literal' && typeof node.value === 'string') {
      if (looksLikeHtml(node.value)) frags.push({ html: node.value, line: node.loc.start.line });
    }
  });
  return frags;
}

/** True when an attribute value is dynamic (came from a `${…}`), so it can't be resolved statically. */
const isDynamic = (v) => v == null || v.includes(EXPR);

/** Accessible-name heuristic (sound subset): visible text, or an ARIA name, or title. */
function hasAccessibleName(el) {
  const text = (el.text || '').replace(new RegExp(EXPR, 'g'), 'x').trim();
  if (text) return true;
  const label = el.getAttribute('aria-label');
  if (label && label.trim()) return true;
  if (el.getAttribute('aria-labelledby')) return true;
  const title = el.getAttribute('title');
  if (title && title.trim()) return true;
  // An <img> child with a non-empty alt names the control.
  const imgs = el.querySelectorAll ? el.querySelectorAll('img') : [];
  if (imgs.some((i) => (i.getAttribute('alt') || '').trim())) return true;
  return false;
}

module.exports = { EXPR, parseHtml, walk, extractHtmlFragmentsFromJs, isDynamic, hasAccessibleName };

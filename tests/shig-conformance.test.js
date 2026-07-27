// tests/shig-conformance.test.js — EXECUTABLE SHIG conformance.
//
// The SHIG corpus (docs/shig/) is governance prose. This suite is what gives a
// machine-checkable SUBSET of it TEETH: it scans the real product files and fails
// the build when a shipped surface violates a SHIG rule. It cannot check the
// human-judgment rules (plain-language, tone, "calm") — only the mechanical ones —
// but every assertion below would go red on a real regression.
//
// Each block cites the SHIG instrument / constitutional principle it enforces.

const fs = require('fs');
const path = require('path');

const pub = (f) => fs.readFileSync(path.join(__dirname, '..', 'public', f), 'utf8');
const src = (f) => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8');

const appJs = pub('app.js');
const homeHtml = pub('home.html');
const indexHtml = pub('index.html');
const stylesCss = pub('styles.css');
const payment = src('routes-payment.js');

// The honesty badge module is requireable — test its real behavior, not just its text.
const SBBadge = require('../public/badge.js');

// -------------------------------------------------------------------------
// SHIG-0000 C-2 / SHIG-0001 R-3 / SHIG-0008 — Honesty of signal.
// A reading (inference) must never be presentable as a verified fact.
// -------------------------------------------------------------------------
describe('C-2 honesty of signal — fact and reading are structurally distinct', () => {
  test('unknown/blank badge kind fails safe to a reading, never to a fact', () => {
    expect(SBBadge.badgeMeta('anything-unknown').kind).toBe('reading');
    expect(SBBadge.badgeMeta(undefined).kind).toBe('reading');
    expect(SBBadge.badgeMeta('').kind).toBe('reading');
  });

  test('fact and reading render with different class, glyph, and word', () => {
    const fact = SBBadge.VARIANTS.fact;
    const reading = SBBadge.VARIANTS.reading;
    expect(fact.cls).not.toBe(reading.cls);       // not distinguishable by color alone — different class
    expect(fact.mark).not.toBe(reading.mark);     // different glyph (shape channel)
    expect(fact.word).not.toBe(reading.word);     // different word (text channel)
  });

  test('a reading badge never contains the word "Verified"', () => {
    expect(SBBadge.badgeHtml('reading')).not.toMatch(/verified/i);
    expect(SBBadge.badgeHtml('reading', 'A reading — an insight, not a verified fact')).toMatch(/badge-reading/);
    expect(SBBadge.badgeHtml('fact')).toMatch(/Verified/);
  });

  test('the app frames astrology/compatibility as readings (reading badges present)', () => {
    expect((appJs.match(/badgeHtml\('reading'/g) || []).length).toBeGreaterThanOrEqual(1);
    // and states the honest framing explicitly somewhere in the app
    expect(appJs).toMatch(/not a verified fact/i);
  });
});

// -------------------------------------------------------------------------
// SHIG-0000 C-8 / SHIG-0011 / SHIG-0019 — Accessibility floor (WCAG 2.2 AA),
// never meaning by a single channel, keyboard operability, focus, target size.
// -------------------------------------------------------------------------
describe('C-8 accessibility floor — member-facing surfaces', () => {
  // Strip comments first — a comment that mentions "<img>" in prose is not a
  // rendered tag, so excluding comments makes this check correct, not weaker.
  const stripComments = (s, lang) =>
    lang === 'js'
      ? s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/([^:])\/\/[^\n]*/g, '$1')
      : s.replace(/<!--[\s\S]*?-->/g, '');
  function unlabeledImgs(source, lang) {
    return (stripComments(source, lang).match(/<img\b[\s\S]*?>/gi) || []).filter((t) => !/\balt\s*=/.test(t));
  }
  test('every rendered <img> on the homepage, app, and shell carries an alt attribute', () => {
    expect(unlabeledImgs(homeHtml, 'html')).toEqual([]);
    expect(unlabeledImgs(appJs, 'js')).toEqual([]);
    expect(unlabeledImgs(indexHtml, 'html')).toEqual([]);
  });

  test('non-native onclick controls are made keyboard-operable (role + tabindex + Enter/Space)', () => {
    expect(indexHtml).toMatch(/setAttribute\('role', 'button'\)/);
    expect(indexHtml).toMatch(/setAttribute\('tabindex', '0'\)/);
    expect(indexHtml).toMatch(/'Enter'/);
    expect(indexHtml).toMatch(/'Spacebar'|=== ' '/);
  });

  test('styles.css provides a visible focus model and >=44px interactive targets', () => {
    expect(stylesCss).toMatch(/:focus-visible/);
    expect(stylesCss).toMatch(/--focus:/);
    expect(stylesCss).toMatch(/min-width:\s*44px/);
    expect(stylesCss).toMatch(/min-height:\s*44px/);
  });

  test('reduced-motion is honored (C-8 / SHIG-0016)', () => {
    expect(stylesCss).toMatch(/@media[^{]*prefers-reduced-motion/);
  });

  test('the low-vision contrast fix on --ink-soft is preserved', () => {
    expect(stylesCss).toMatch(/--ink-soft:\s*#6E6D66/i);   // WCAG-corrected; must not regress to #888780
    expect(stylesCss).not.toMatch(/--ink-soft:\s*#888780/i);
  });
});

// -------------------------------------------------------------------------
// SHIG-0020 / C-13 — Forms & honest states: accessible inline validation.
// -------------------------------------------------------------------------
describe('SHIG-0020 forms — the auth form validates accessibly, not via toast only', () => {
  test('field errors use aria-invalid + aria-describedby and a live form-error region', () => {
    expect(appJs).toMatch(/aria-invalid/);
    expect(appJs).toMatch(/aria-describedby/);
    expect(appJs).toMatch(/role="alert"/);
    expect(appJs).toMatch(/function setFieldError/);
    expect(appJs).toMatch(/function clearFieldError/);
  });
});

// -------------------------------------------------------------------------
// SHIG-0000 C-2 / SHIG-0001 R-14 — Money honesty. The prices a member SEES
// (homepage + app) must match the CANONICAL prices the backend CHARGES.
// This is the strongest anti-drift guard: change one layer, this goes red.
// -------------------------------------------------------------------------
describe('R-14 money honesty — displayed prices match the canonical backend prices', () => {
  test('backend canonical prices are the flat/tiered/annual model', () => {
    expect(payment).toMatch(/BASE_CHF\s*=\s*\{[^}]*male:\s*5/);   // flat CHF 5 base
    expect(payment).toMatch(/pro_subscription:\s*12/);
    expect(payment).toMatch(/max_subscription:\s*25/);
    expect(payment).toMatch(/base_annual:\s*48/);
    expect(payment).toMatch(/pro_annual:\s*120/);
    expect(payment).toMatch(/max_annual:\s*240/);
  });

  test('the homepage displays exactly those prices (monthly + annual)', () => {
    ['CHF 5', 'CHF 12', 'CHF 25'].forEach((p) => expect(homeHtml).toContain(`data-m="${p}"`));
    ['CHF 48', 'CHF 120', 'CHF 240'].forEach((p) => expect(homeHtml).toContain(`data-a="${p}"`));
  });

  test('the app pricing mirror matches the canonical CHF prices', () => {
    expect(appJs).toMatch(/sym:\s*'CHF ',\s*base:\s*\{\s*male:\s*5/);
    expect(appJs).toMatch(/pro:\s*12,\s*max:\s*25,\s*annual:\s*\{\s*base:\s*48,\s*pro:\s*120,\s*max:\s*240/);
  });

  test('no stale gender-differentiated base pricing survives in member-facing copy', () => {
    expect(homeHtml).not.toMatch(/CHF 1 men|Men CHF 1/);
    expect(appJs).not.toMatch(/CHF 1 men|Men CHF 1/);
  });
});

// -------------------------------------------------------------------------
// SHIG-0008 vocabulary / C-15 — one canonical term per concept.
// Member-facing plan names are Essential/Plus/Signature, never Pro/Max.
// -------------------------------------------------------------------------
describe('SHIG-0008 vocabulary — plan names are canonical in member-facing UI', () => {
  test('the homepage uses Essential/Plus/Signature and not the deprecated Pro/Max', () => {
    expect(homeHtml).toMatch(/Sambandh Essential/);
    expect(homeHtml).toMatch(/Sambandh Plus/);
    expect(homeHtml).toMatch(/Sambandh Signature/);
    expect(homeHtml).not.toMatch(/Sambandh Pro\b|Sambandh Max\b|Go Pro\b|Go Max\b/);
  });

  test('the app settings plan cards use the canonical names', () => {
    expect(appJs).toMatch(/Sambandh Essential/);
    expect(appJs).toMatch(/Sambandh Plus/);
    expect(appJs).toMatch(/Sambandh Signature/);
  });
});

// -------------------------------------------------------------------------
// SHIG governance — the corpus itself is well-formed and contiguous, so the
// documents that back the rules above cannot silently rot.
// -------------------------------------------------------------------------
describe('SHIG corpus integrity', () => {
  const shigDir = path.join(__dirname, '..', 'docs', 'shig');
  const files = fs.readdirSync(shigDir).filter((f) => /^SHIG-\d{4}-.*\.md$/.test(f));
  const nums = files.map((f) => parseInt(f.slice(5, 9), 10));

  test('foundational range is contiguous 0000..0020 (no gaps, incl. the once-missing 0008)', () => {
    for (let n = 0; n <= 20; n++) expect(nums).toContain(n);
    expect(nums).toContain(8);   // Design Vocabulary — the regenerated gap
  });

  test('every spec uses RFC-2119, carries permanent IDs, and has a Revision History', () => {
    files.forEach((f) => {
      const md = fs.readFileSync(path.join(shigDir, f), 'utf8');
      expect(md).toMatch(/\bMUST\b/);
      expect(md).toMatch(/\b[A-Z]{1,4}-\d+\b/);       // permanent requirement IDs
      expect(md).toMatch(/Revision History/i);
    });
  });
});

// tests/badge-honesty.test.js — the presentation-layer honesty guard (Batch 8).
//
// "Verified" may label only confirmed facts. Anything derived from the chart or
// self-declared features is a reading and must wear a DIFFERENT badge that never
// says "verified". This proves the two variants can't be confused, and that the
// reading surfaces in the SPA use the reading variant, never the fact variant.

const fs = require('fs');
const path = require('path');
const SBBadge = require('../public/badge.js');

describe('Badge — fact and reading are distinct and unconfusable', () => {
  test('fact and reading use different classes, marks, and words', () => {
    const f = SBBadge.VARIANTS.fact, r = SBBadge.VARIANTS.reading;
    expect(f.cls).not.toBe(r.cls);
    expect(f.mark).not.toBe(r.mark);
    expect(f.word).toMatch(/verified/i);       // fact carries "Verified"
    expect(r.word).not.toMatch(/verified/i);   // reading NEVER does
  });

  test('the reading variant never renders the word "verified" or the fact class', () => {
    const html = SBBadge.badgeHtml('reading', 'Grounded, warms up slowly');
    expect(html).toContain('badge-reading');
    expect(html).not.toContain('badge-fact');
    expect(html.toLowerCase()).not.toContain('verified');
    expect(html).toContain('data-badge="reading"');
  });

  test('an unknown kind fails SAFE to reading (never accidentally a fact)', () => {
    expect(SBBadge.badgeMeta('something-new').kind).toBe('reading');
    expect(SBBadge.badgeHtml('nature', 'x')).toContain('badge-reading');
  });

  test('the fact variant is the green-check treatment carrying "Verified"', () => {
    const html = SBBadge.badgeHtml('fact');
    expect(html).toContain('badge-fact');
    expect(html).toContain('✓');
    expect(html).toContain('Verified');
  });

  test('html is escaped (no injection through the label)', () => {
    expect(SBBadge.badgeHtml('reading', '<b>x</b>')).not.toContain('<b>');
  });
});

describe('the SPA renders readings as readings, never as facts', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');

  test('the nature-profile / reading block uses SBBadge with the reading variant', () => {
    // The reading UI must exist and must render through the reading badge.
    expect(app).toMatch(/SBBadge\.badgeHtml\(\s*['"]reading['"]/);
  });

  test('no reading/nature surface renders SBBadge with the fact variant', () => {
    // Grab the loadNature block and assert it never uses the fact badge.
    const m = app.match(/function loadNature[\s\S]*?\n\}/);
    if (m) {
      expect(m[0]).not.toMatch(/badgeHtml\(\s*['"]fact['"]/);
      expect(m[0].toLowerCase()).not.toMatch(/>\s*verified/);
    }
  });
});

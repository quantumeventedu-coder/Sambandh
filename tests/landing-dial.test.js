// tests/landing-dial.test.js — the public Nature Dial section holds the same guards
// as the app: plain language (no astrology terms) and the Verified/Reading split
// (facets are readings, never "verified"). Also enforces the perf/asset discipline.
// The section's copy is rendered by an inline <script> (FACETS), so we scan the
// section AND that script.

const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'home.html'), 'utf8');
// the section + its inline render script (up to the render('full') call)
const start = html.indexOf('<!-- THE NATURE DIAL');
const end = html.indexOf("render('woman');", start);
const dial = html.slice(start, end > -1 ? end + 40 : start + 6000);

describe('the Nature Dial exists and is ordered correctly', () => {
  test('section present, below the trust hero and above pricing', () => {
    expect(start).toBeGreaterThan(-1);
    const hero = html.indexOf('id="top"');
    const nd = html.indexOf('id="nature-dial"');
    const pricing = html.indexOf('id="pricing"');
    expect(hero).toBeGreaterThan(-1);
    expect(nd).toBeGreaterThan(hero);       // dial is below the hero
    expect(pricing).toBeGreaterThan(nd);    // and above pricing
  });
});

describe('no astrology jargon in the dial copy', () => {
  const JARGON = /\b(sun|moon|mars|mercury|jupiter|venus|saturn|rahu|ketu|aries|taurus|gemini|cancer|leo|virgo|libra|scorpio|sagittarius|capricorn|aquarius|pisces|nakshatra|dosha|dasha|guna|lagna|mangal|rashi|ascendant|kundli|kundali|graha|navamsa|samudrika|vedic|horoscope|zodiac)\b/i;
  test('neither the markup nor the rendered facet copy contains a term', () => {
    expect(JARGON.test(dial)).toBe(false);
  });
});

describe('Verified/Reading split holds on the public page', () => {
  test('the facet definitions are readings — no facet is presented as "verified"', () => {
    // pull the FACETS array (title/label/desc strings) and assert none says "verified"
    const facets = (dial.match(/var FACETS=\[[\s\S]*?\];/) || [''])[0];
    expect(facets).toMatch(/PERSONA|ENERGY|WORLD/);          // the array is present
    expect(facets.toLowerCase()).not.toContain('verified');  // a facet is never "verified"
  });

  test('the honesty framing + both distinct badges are present', () => {
    expect(dial).toMatch(/a reading, not a verified fact/i);  // facets are readings
    expect(dial).toMatch(/nd-badge-read/);                    // reading badge
    expect(dial).toMatch(/nd-badge-fact/);                    // distinct fact badge
    // the only "verified" claim is the identity FACT (photo + ID)
    expect(dial).toMatch(/photo \+ ID verified/i);
  });
});

describe('asset + performance discipline (Indian mobile)', () => {
  test('the portrait is an EXTERNAL file (dial-*.jpg), never inline base64', () => {
    expect(dial).toMatch(/\/dial-(full|woman|man)\.jpg/);     // external image files
    expect(dial).not.toMatch(/data:image\/[a-z]+;base64,[A-Za-z0-9+/]{500,}/); // no heavy inline blob
  });

  test('animation is disabled under prefers-reduced-motion', () => {
    expect(html).toMatch(/prefers-reduced-motion:reduce\)\{[^}]*animation:none/);
  });
});

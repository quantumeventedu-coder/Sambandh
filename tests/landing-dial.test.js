// tests/landing-dial.test.js — the public Nature Dial section holds the same guards
// as the app: plain language (no astrology terms) and the Verified/Reading split
// (facets are readings, never "verified"). Also enforces the perf discipline.

const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'home.html'), 'utf8');
const dial = (html.match(/<section id="nature-dial">[\s\S]*?<\/section>/) || [''])[0];
const visibleText = dial.replace(/<[^>]+>/g, ' ');   // strip tags → what a visitor reads

describe('the Nature Dial exists and is ordered correctly', () => {
  test('section present, below the trust hero and above pricing', () => {
    expect(dial).toBeTruthy();
    const hero = html.indexOf('id="top"');
    const nd = html.indexOf('id="nature-dial"');
    const pricing = html.indexOf('id="pricing"');
    expect(hero).toBeGreaterThan(-1);
    expect(nd).toBeGreaterThan(hero);       // dial is below the hero
    expect(pricing).toBeGreaterThan(nd);    // and above pricing
  });
});

describe('no astrology jargon in public dial copy', () => {
  const JARGON = /\b(sun|moon|mars|mercury|jupiter|venus|saturn|rahu|ketu|aries|taurus|gemini|cancer|leo|virgo|libra|scorpio|sagittarius|capricorn|aquarius|pisces|nakshatra|dosha|dasha|guna|lagna|mangal|rashi|ascendant|kundli|kundali|graha|navamsa|samudrika|vedic|horoscope|zodiac)\b/i;
  test('the visible dial text contains no term', () => {
    expect(JARGON.test(visibleText)).toBe(false);
  });
});

describe('Verified/Reading split holds on the public page', () => {
  test('the facet cards are readings — none says "verified"', () => {
    const cards = dial.match(/<div class="nd-card[\s\S]*?<\/div>\s*<\/div>/g) || dial.match(/class="nd-card[\s\S]*?<\/p><\/div>/g) || [];
    // fall back to scanning each nd-card block
    const blocks = dial.split('class="nd-card').slice(1);
    expect(blocks.length).toBeGreaterThanOrEqual(6);
    for (const b of blocks) {
      const card = b.slice(0, b.indexOf('</div></div>') + 1);
      expect(card.toLowerCase()).not.toContain('verified');
    }
  });

  test('the reading disclaimer is present and the fact/reading badges are distinct', () => {
    expect(dial).toContain('a reading');                 // insight, not a fact
    expect(dial).toMatch(/nd-badge-read/);
    expect(dial).toMatch(/nd-badge-fact/);
    // the only "verified" on the dial is the identity FACT badge, worded as a fact
    expect(dial).toMatch(/verify[\s\S]*photo \+ ID|photo \+ ID/i);
  });
});

describe('performance discipline (Indian mobile)', () => {
  test('the centre portrait is an EXTERNAL image, lazy-loaded, with dimensions', () => {
    const fig = (dial.match(/<img id="nd-figure"[\s\S]*?\/>/) || [''])[0];
    expect(fig).toContain('loading="lazy"');
    expect(fig).toMatch(/width="\d+"/);
    expect(fig).toMatch(/height="\d+"/);
    expect(fig).toMatch(/src="\/dial-hero\.(jpg|png|webp)"/);   // external file, not inline
    expect(fig).not.toMatch(/src="data:image/);                // never base64-embedded
  });

  test('no large base64 image is embedded anywhere in the dial section', () => {
    expect(dial).not.toMatch(/data:image\/[a-z]+;base64,[A-Za-z0-9+/]{500,}/);
  });

  test('animation is disabled under prefers-reduced-motion', () => {
    expect(html).toMatch(/prefers-reduced-motion[\s\S]*?#nd-rings i\{animation:none\}/);
  });
});

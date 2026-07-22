// tests/landing-dial.test.js — the public Nature Dial showcase. It now displays the
// finished design scenes directly (public/dial-scene-*.jpg) with a Woman/Man toggle.
// Guards: correct order, no astrology jargon in the copy, the Verified/Reading honesty
// split still framed (distinct badges), external lazy images, never base64.

const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'home.html'), 'utf8');
const start = html.indexOf('<!-- THE NATURE DIAL');
const end = html.indexOf('<!-- PRICING', start);
const dial = html.slice(start, end > -1 ? end : start + 4000);

describe('the Nature Dial exists and is ordered correctly', () => {
  test('present, below the trust hero and above pricing', () => {
    expect(start).toBeGreaterThan(-1);
    const hero = html.indexOf('id="top"');
    const nd = html.indexOf('id="nature-dial"');
    const pricing = html.indexOf('id="pricing"');
    expect(nd).toBeGreaterThan(hero);
    expect(pricing).toBeGreaterThan(nd);
  });
});

describe('no astrology jargon in the dial copy', () => {
  const JARGON = /\b(sun|moon|mars|mercury|jupiter|venus|saturn|rahu|ketu|aries|taurus|gemini|cancer|leo|virgo|libra|scorpio|sagittarius|capricorn|aquarius|pisces|nakshatra|dosha|dasha|guna|lagna|mangal|rashi|ascendant|kundli|kundali|graha|navamsa|samudrika|vedic|horoscope|zodiac)\b/i;
  test('the dial markup contains no astrology term', () => {
    expect(JARGON.test(dial)).toBe(false);
  });
});

describe('Verified/Reading honesty split is framed', () => {
  test('distinct fact + reading badges, and the identity is the only "verified"', () => {
    expect(dial).toMatch(/nd-badge-fact/);
    expect(dial).toMatch(/nd-badge-read/);
    expect(dial).toMatch(/Identity is what we verify \(photo \+ ID\)/i);
    expect(dial).toMatch(/Nature is a reading/i);
    expect(dial).toMatch(/not a real person/i);   // it's a preview, framed honestly
  });
});

describe('asset + performance discipline', () => {
  test('the scene is an EXTERNAL image, lazy-loaded, never base64', () => {
    const img = (dial.match(/<img id="nd-scene"[\s\S]*?\/>/) || [''])[0];
    expect(img).toContain('loading="lazy"');
    expect(img).toMatch(/src="\/dial-scene-(woman|man)\.jpg(\?v=\d+)?"/);   // allow a cache-bust query
    expect(img).not.toMatch(/src="data:image/);
    // both toggle scenes are external files
    expect(dial).toMatch(/\/dial-scene-woman\.jpg/);
    expect(dial).toMatch(/\/dial-scene-man\.jpg/);
    expect(dial).not.toMatch(/data:image\/[a-z]+;base64,[A-Za-z0-9+/]{500,}/);
  });

  test('the Woman/Man toggle is present', () => {
    expect(dial).toMatch(/data-p="woman"/);
    expect(dial).toMatch(/data-p="man"/);
  });
});

// tests/landing-dial.test.js — the public Nature Dial. It is now the HERO visual
// (.stage.nd-stage) and displays the finished design scenes directly
// (public/dial-scene-*.jpg) with a Woman/Man toggle. Guards: it leads the page and
// sits above pricing, no astrology jargon in the copy, the Verified/Reading honesty
// split is framed (distinct badges + preview disclaimer), external images, never base64.

const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'home.html'), 'utf8');
// Scope the copy checks to the hero visual itself, so unrelated astrology terms
// elsewhere on the page (e.g. the features section's Guna Milan / nakshatra) can't leak in.
const dStart = html.indexOf('class="stage nd-stage"');
const dEnd = html.indexOf('</section>', dStart);
const dial = html.slice(dStart, dEnd > -1 ? dEnd : dStart + 4000);

describe('the Nature Dial is the hero visual, ordered correctly', () => {
  test('present in the hero, above pricing', () => {
    const hero = html.indexOf('id="top"');
    const nd = html.indexOf('id="nd-scene"');
    const pricing = html.indexOf('id="pricing"');
    expect(hero).toBeGreaterThan(-1);
    expect(nd).toBeGreaterThan(hero);      // the scene is inside the hero
    expect(pricing).toBeGreaterThan(nd);   // pricing comes later
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
    expect(dial).toMatch(/not a real (person|member)/i);   // it's a preview, framed honestly
  });
});

describe('asset + performance discipline', () => {
  test('the scene is an EXTERNAL image, never base64', () => {
    const img = (dial.match(/<img id="nd-scene"[\s\S]*?\/>/) || [''])[0];
    // The hero scene is the LCP image, so it is fetched eagerly (not lazy).
    expect(img).toMatch(/loading="(eager|lazy)"/);
    expect(img).toMatch(/src="\/dial-scene-(woman|man)\.jpg(\?v=\d+)?"/);   // allow a cache-bust query
    expect(img).not.toMatch(/src="data:image/);
    // both toggle scenes are external files (woman in the img, man in the toggle script)
    expect(html).toMatch(/\/dial-scene-woman\.jpg/);
    expect(html).toMatch(/\/dial-scene-man\.jpg/);
    expect(html).not.toMatch(/data:image\/[a-z]+;base64,[A-Za-z0-9+/]{500,}/);
  });

  test('the Woman/Man toggle is present', () => {
    expect(dial).toMatch(/data-p="woman"/);
    expect(dial).toMatch(/data-p="man"/);
  });
});

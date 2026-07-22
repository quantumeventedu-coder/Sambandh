// tests/reading-surfaces.test.js — Reading ④: the reading is jargon-free and
// rendered as a READING (never verified) on the NEW surfaces (discover card +
// other users' profiles). New render path → enforce, don't assume.

const fs = require('fs');
const path = require('path');
const { computeChart } = require('../src/services/astro-engine');
const reading = require('../src/services/reading-engine');
const { isClean } = require('../src/services/reading-guards');

// Build many varied users: random birth dates + feature combos, some with no chart.
function manyUsers(n) {
  const builds = ['solid', 'lean', 'balanced', 'sturdy'];
  const gaits = ['fast', 'measured', 'light', 'firm'];
  const out = [];
  for (let i = 0; i < n; i++) {
    const yr = 1970 + (i * 7) % 45, mo = 1 + (i * 3) % 12, day = 1 + (i * 5) % 27;
    const hasChart = i % 4 !== 0;
    const chart = hasChart ? computeChart({ birthDate: `${yr}-${String(mo).padStart(2, '0')}-${String(day).padStart(2, '0')}`, birthTime: '09:20', birthPlace: { lat: 19, lng: 73 } }) : null;
    const features = i % 3 === 0 ? { build: builds[i % 4], gait: gaits[i % 4] } : null;
    out.push({ chart, features });
  }
  return out;
}

describe('the reading engine output is jargon-free on every surface (100 users)', () => {
  const users = manyUsers(100);

  test('discover nature line never contains an astrology term', () => {
    for (const u of users) {
      const line = reading.discoverLine(u);
      if (line) expect(isClean(line)).toBe(true);
    }
  });

  test('profile reading ("who they are") never contains an astrology term', () => {
    for (const u of users) {
      const who = reading.read('who_you_are', u).answer;
      if (who) expect(isClean(who)).toBe(true);
    }
  });

  test('the full reading (all four cards) is jargon-free', () => {
    for (const u of users) {
      const all = reading.readAll(u);
      for (const q of Object.keys(all)) {
        if (all[q] && all[q].answer) expect(isClean(all[q].answer)).toBe(true);
      }
    }
  });
});

describe('Verified/Reading split holds on the new SPA surfaces', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');

  test('the discover dial renders the nature line as a READING, never a verified fact', () => {
    const fn = app.match(/function ddShow\(\)[\s\S]*?\n\}/);
    expect(fn).toBeTruthy();
    expect(fn[0]).toMatch(/plainOnly\(p\.natureLine\)/);   // precomputed line, jargon-guarded
    expect(fn[0]).toMatch(/['"]Reading['"]/);              // shown under a Reading label
    expect(fn[0]).toMatch(/not a verified fact/i);         // explicitly not a fact
    expect(fn[0]).not.toMatch(/badgeHtml\(\s*['"]fact['"]/);
  });

  test('the shared reading-cards renderer is a reading, and both surfaces reuse it', () => {
    expect(app).toMatch(/function readingCardsHtml/);
    const fn = app.match(/function readingCardsHtml[\s\S]*?\n\}/)[0];
    expect(fn).toMatch(/SBBadge\.badgeHtml\(\s*['"]reading['"]/);
    expect(fn).not.toMatch(/badgeHtml\(\s*['"]fact['"]/);
    // profile + Me both call the shared renderer (no duplicated card markup)
    expect((app.match(/readingCardsHtml\(/g) || []).length).toBeGreaterThanOrEqual(3); // def + Me + profile
  });

  test('the client jargon guard exists and drops unsafe lines on these paths', () => {
    expect(app).toMatch(/function plainOnly/);
    expect(app).toMatch(/READING_JARGON_RE/);
  });
});

describe('perf gate — discover line is precomputed server-side, no per-card fetch', () => {
  const disc = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes-discover.js'), 'utf8');
  test('the feed attaches natureLine for the returned page only (not all candidates)', () => {
    expect(disc).toMatch(/natureLineFor/);
    // computed against the sliced page map, not inside the 400-candidate loop
    expect(disc).toMatch(/ranked\.slice\([\s\S]*?natureLineFor/);
  });
  test('the SPA does not fetch a reading per discover card (uses precomputed p.natureLine)', () => {
    const app = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
    // The discover flow: renderDiscover + ddShow, up to ddPass.
    const m = app.match(/async function renderDiscover\(\)[\s\S]*?\nasync function ddPass/);
    expect(m).toBeTruthy();
    expect(m[0]).toMatch(/p\.natureLine/);             // uses the precomputed line
    expect(m[0]).not.toMatch(/\/reading/);             // no per-card reading fetch
    expect(m[0]).toMatch(/p\.natureLine/);
  });
});

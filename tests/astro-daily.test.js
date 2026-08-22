// tests/astro-daily.test.js — the personalised "Today for you" guidance: Tarabala (day-star vs
// birth-star), Chandrabala (Moon transit vs natal Moon) and the running dasha → a rated day with
// concrete do's/don'ts, computed from the user's chart.

const engine = require('../src/services/astro-engine');

const chartFor = () => engine.computeChart({ birthDate: '1994-05-12', birthTime: '08:30', birthPlace: { city: 'Guwahati' } });

describe('dailyGuidance', () => {
  test('returns a rated day with do/avoid lists + the day factors', () => {
    const g = engine.dailyGuidance(chartFor(), new Date('2026-08-22T06:00:00Z'));
    expect(g).toBeTruthy();
    expect(['favourable', 'mixed', 'cautious']).toContain(g.rating);
    expect(g.dos.length).toBeGreaterThan(0);
    expect(g.donts.length).toBeGreaterThan(0);
    expect(g.factors.some(f => f.name === 'Tarabala')).toBe(true);
    expect(g.factors.some(f => f.name === 'Chandrabala')).toBe(true);
    expect(g.rahuKaal).toMatch(/^\d{2}:\d{2}–\d{2}:\d{2}$/);
    expect(g.nakshatra).toBeTruthy();
  });

  test('the guidance changes across days (it is genuinely date-dependent)', () => {
    const chart = chartFor();
    const a = engine.dailyGuidance(chart, new Date('2026-08-22T06:00:00Z'));
    const b = engine.dailyGuidance(chart, new Date('2026-08-29T06:00:00Z'));   // a week later → different star
    expect(a.nakshatra !== b.nakshatra || a.rating !== b.rating).toBe(true);
  });

  test('null when there is no chart (no birth data)', () => {
    expect(engine.dailyGuidance(null)).toBeNull();
  });
});

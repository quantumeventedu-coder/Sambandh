// tests/behavior-engine.test.js — the behavioural intelligence engine derives
// activity, consistency, drift and habits from a raw event stream. `now` is
// injected so every assertion is deterministic.

const be = require('../src/services/behavior-engine');

const DAY = 86400000;
const NOW = Date.parse('2026-07-12T12:00:00.000Z');
const ev = (type, daysAgo) => ({ type, createdAt: new Date(NOW - daysAgo * DAY) });

describe('behavior-engine.analyze', () => {
  test('empty stream → not available (no guessing)', () => {
    expect(be.analyze([], NOW).available).toBe(false);
  });

  test('detects RISING drift when the recent week is busier than the prior week', () => {
    const events = [];
    for (let d = 1; d <= 6; d++) { events.push(ev('Liked', d)); events.push(ev('Liked', d)); } // 12 recent
    for (let d = 8; d <= 13; d++) events.push(ev('Liked', d));                                    // 6 previous
    const r = be.analyze(events, NOW);
    expect(r.available).toBe(true);
    expect(r.drift.direction).toBe('rising');
    expect(r.drift.recent7).toBeGreaterThan(r.drift.previous7);
  });

  test('detects DECLINING drift when the recent week is quieter', () => {
    const events = [];
    for (let d = 1; d <= 6; d++) events.push(ev('Liked', d));                                     // 6 recent
    for (let d = 8; d <= 13; d++) { events.push(ev('Liked', d)); events.push(ev('Liked', d)); events.push(ev('Liked', d)); } // 18 previous
    expect(be.analyze(events, NOW).drift.direction).toBe('declining');
  });

  test('flags a daily habit when active on ≥10 of the last 14 days', () => {
    const events = [];
    for (let d = 1; d <= 12; d++) events.push(ev('MessageSent', d));   // 12 distinct recent days
    const r = be.analyze(events, NOW);
    expect(r.habits.dailyHabit).toBe(true);
    expect(r.habits.activeDaysLast14).toBeGreaterThanOrEqual(10);
  });

  test('steady activity scores higher consistency than bursty activity', () => {
    const steady = [];
    for (let d = 1; d <= 10; d++) for (let k = 0; k < 3; k++) steady.push(ev('Liked', d)); // 3/day, 10 days
    const bursty = [];
    for (let k = 0; k < 25; k++) bursty.push(ev('Liked', 1));                                // 25 in one day
    bursty.push(ev('Liked', 5)); bursty.push(ev('Liked', 9));
    expect(be.analyze(steady, NOW).consistency.steadiness)
      .toBeGreaterThan(be.analyze(bursty, NOW).consistency.steadiness);
  });

  test('mix counts event types and summarize() returns hedged insight lines', () => {
    const events = [];
    for (let d = 1; d <= 12; d++) events.push(ev('Liked', d));
    events.push(ev('MessageSent', 2));
    const r = be.analyze(events, NOW);
    expect(r.mix.Liked).toBe(12);
    expect(r.mix.MessageSent).toBe(1);
    const lines = be.summarize(r);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.join(' ')).toMatch(/active|steady|habit|rhythm|engagement/i);
  });

  test('confidence stays low with sparse data', () => {
    const r = be.analyze([ev('Liked', 1), ev('Liked', 1)], NOW);
    expect(r.confidence).toBeLessThan(0.5);
  });
});

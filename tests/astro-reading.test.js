// tests/astro-reading.test.js — the detailed, deterministic classical reading.

const { detailedReading } = require('../src/services/astro-reading');

const CHART = {
  lagna: { signName: 'Leo' }, moonSign: 'Taurus', sunSign: 'Aries', nakshatra: 'Rohini',
  planets: {
    Sun: { signName: 'Aries', house: 9, dignity: 'exalted' },
    Moon: { signName: 'Taurus', house: 10, dignity: 'own sign' },
    Saturn: { signName: 'Aries', house: 9, dignity: 'debilitated', retrograde: true }
  },
  dasha: { current: { lord: 'Venus', end: '2030-01-01T00:00:00Z' } }
};

describe('detailedReading', () => {
  test('produces detailed, structured sections from a chart', () => {
    const r = detailedReading(CHART);
    const titles = r.sections.map(s => s.title);
    expect(titles).toContain('Ascendant (Lagna)');
    expect(titles).toContain('Moon — your inner world');
    expect(titles).toContain('Sun — your core self');
    expect(titles.some(t => /Sun in the 9th house/.test(t))).toBe(true);
    expect(titles).toContain('Current period (Mahadasha)');
    expect(titles).toContain('Strengths & tender spots');
    expect(r.sections.length).toBeGreaterThanOrEqual(6);      // genuinely detailed
    expect(r.disclaimer).toMatch(/not.*advice/i);
  });

  test('dignity highlights name the well-placed and the weak planets; retrograde is noted', () => {
    const r = detailedReading(CHART);
    const highlights = r.sections.find(s => s.title === 'Strengths & tender spots').text;
    expect(highlights).toMatch(/Sun|Moon/);        // exalted / own → strong
    expect(highlights).toMatch(/Saturn/);          // debilitated → tender
    const saturn = r.sections.find(s => /Saturn in the 9th house/.test(s.title));
    expect(saturn.text).toMatch(/retrograde/);
    expect(saturn.text).toMatch(/reward conscious effort/);   // debilitated note
  });

  test('is deterministic and survives a minimal chart', () => {
    expect(JSON.stringify(detailedReading(CHART))).toBe(JSON.stringify(detailedReading(CHART)));
    const min = detailedReading({ moonSign: 'Cancer', sunSign: 'Leo', planets: {} });
    expect(min.sections.length).toBeGreaterThanOrEqual(2);
  });
});

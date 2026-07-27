// tests/tax.test.js — the pure tax + gateway-fee engine. Deterministic, no I/O.
const { computeQuote, r2 } = require('../src/services/tax');

describe('computeQuote — subscriptions (single component)', () => {
  test('18% GST + 2.7% gateway fee on a ₹500 base', () => {
    const q = computeQuote({ components: [{ label: 'Membership', amount: 500, rate: 18 }], taxName: 'GST', gatewayFeePct: 2.7 });
    expect(q.base).toBe(500);
    expect(q.lines).toEqual([{ label: 'GST 18%', rate: 18, amount: 90 }]); // single component → no suffix
    expect(q.taxTotal).toBe(90);
    expect(q.gatewayFee).toBe(15.93); // 2.7% of (500+90)=590
    expect(q.total).toBe(605.93);
  });

  test('zero tax still applies the gateway fee', () => {
    const q = computeQuote({ components: [{ label: 'Membership', amount: 500, rate: 0 }], gatewayFeePct: 2.7 });
    expect(q.lines).toEqual([]);
    expect(q.taxTotal).toBe(0);
    expect(q.gatewayFee).toBe(13.5); // 2.7% of 500
    expect(q.total).toBe(513.5);
  });

  test('no fee configured → total is base + tax only', () => {
    const q = computeQuote({ components: [{ amount: 1000, rate: 18 }], taxName: 'GST' });
    expect(q.gatewayFee).toBe(0);
    expect(q.total).toBe(1180);
  });
});

describe('computeQuote — multi-component (gold: 3% on metal + 5% on making)', () => {
  test('two tax lines, correct split, principal = sum of components', () => {
    const q = computeQuote({
      components: [
        { label: 'metal value', amount: 10000, rate: 3 },
        { label: 'making charges', amount: 2000, rate: 5 },
      ],
      taxName: 'GST', gatewayFeePct: 0,
    });
    expect(q.base).toBe(12000); // metal + making
    expect(q.lines).toEqual([
      { label: 'GST 3% (metal value)', rate: 3, amount: 300 },
      { label: 'GST 5% (making charges)', rate: 5, amount: 100 },
    ]);
    expect(q.taxTotal).toBe(400);
    expect(q.total).toBe(12400);
  });
});

describe('r2 rounding', () => {
  test('rounds to 2 decimals', () => {
    expect(r2(38.232)).toBe(38.23);
    expect(r2(0.1 + 0.2)).toBe(0.3);
  });
});

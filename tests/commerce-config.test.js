// tests/commerce-config.test.js — the super-admin-editable tax/fee/cancellation config.
const db = require('./helpers/pg-db');            // real Postgres via pglite
const commerce = require('../src/services/commerce-config');

beforeAll(db.start);
afterAll(db.stop);
afterEach(async () => { await db.clear(); commerce._resetCache(); });

describe('commerce config — seeded defaults', () => {
  test('India GST: 18% subscription, gold 3% metal + 5% making, books 0%', async () => {
    expect(await commerce.categoryRate('IN', 'subscription')).toBe(18);
    expect(await commerce.categoryRate('IN', 'consultation')).toBe(18);
    expect(await commerce.categoryRate('IN', 'precious_metal')).toBe(3);
    expect(await commerce.categoryRate('IN', 'making_charges')).toBe(5);
    expect(await commerce.categoryRate('IN', 'books')).toBe(0);
    expect(await commerce.categoryRate('IN', 'electronics_luxury')).toBe(28);
  });

  test('a category with no explicit rate falls back to the country default', async () => {
    expect(await commerce.categoryRate('GB', 'subscription')).toBe(20); // GB default 20
    expect(await commerce.categoryRate('AE', 'anything')).toBe(5);      // AE default 5
  });

  test('an unlisted country uses DEFAULT (CHF, 0 tax)', async () => {
    const cc = await commerce.countryConfig('ZZ');
    expect(cc.currency).toBe('CHF');
    expect(await commerce.categoryRate('ZZ', 'subscription')).toBe(0);
  });
});

describe('commerce config — super-admin edits persist and deep-merge', () => {
  test('editing one category preserves the others and other countries', async () => {
    await commerce.updateCommerce({ countries: { IN: { categories: { subscription: 20 } } } });
    commerce._resetCache();
    expect(await commerce.categoryRate('IN', 'subscription')).toBe(20); // edited
    expect(await commerce.categoryRate('IN', 'precious_metal')).toBe(3); // preserved
    expect(await commerce.categoryRate('GB', 'default')).toBe(20);       // untouched country intact
  });

  test('gateway fee and cancellation policy are editable', async () => {
    await commerce.updateCommerce({ gatewayFeePct: 3.5, cancellation: { windowDays: 5, prorate: false } });
    commerce._resetCache();
    const c = await commerce.getCommerce();
    expect(c.gatewayFeePct).toBe(3.5);
    expect(c.cancellation.windowDays).toBe(5);
    expect(c.cancellation.prorate).toBe(false);
  });

  test('a new country can be added and is used for pricing', async () => {
    await commerce.updateCommerce({ countries: { BR: { currency: 'BRL', taxName: 'ICMS', categories: { subscription: 12, default: 12 } } } });
    commerce._resetCache();
    const cc = await commerce.countryConfig('BR');
    expect(cc.currency).toBe('BRL');
    expect(await commerce.categoryRate('BR', 'subscription')).toBe(12);
  });
});

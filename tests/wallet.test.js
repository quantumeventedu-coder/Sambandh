// tests/wallet.test.js — the stored-value wallet: atomic, overspend-safe, float-safe.
const db = require('./helpers/pg-db');            // real Postgres via pglite
const mongoose = require('../src/db/odm');
const wallet = require('../src/services/wallet');

const uid = () => new mongoose.Types.ObjectId();

beforeAll(db.start);
afterAll(db.stop);
afterEach(db.clear);

describe('wallet credit/debit ledger', () => {
  test('credit increases the balance and writes a ledger entry', async () => {
    const u = uid();
    const w = await wallet.credit(u, 500, 'INR', { type: 'topup', ref: 'pay1' });
    expect(w.currency).toBe('INR');
    expect(w.balance).toBe(500);
    const h = await wallet.history(u);
    expect(h.length).toBe(1);
    expect(h[0]).toMatchObject({ type: 'topup', amount: 500, balanceAfter: 500, currency: 'INR' });
  });

  test('EXACT-balance debit succeeds (float-safe integer minor units)', async () => {
    const u = uid();
    await wallet.credit(u, 605.93, 'INR');            // 60593 minor
    const ok = await wallet.debit(u, 605.93, 'INR', { purpose: 'base_subscription' });
    expect(ok).not.toBeNull();
    expect(ok.balance).toBe(0);
  });

  test('debit over balance returns null and leaves the balance untouched', async () => {
    const u = uid();
    await wallet.credit(u, 100, 'INR');
    const over = await wallet.debit(u, 150, 'INR');
    expect(over).toBeNull();
    expect((await wallet.getWallet(u)).balance).toBe(100);
  });

  test('concurrent debits cannot overdraw (only one of two 400-of-500 wins)', async () => {
    const u = uid();
    await wallet.credit(u, 500, 'INR');
    const [a, b] = await Promise.all([wallet.debit(u, 400, 'INR'), wallet.debit(u, 400, 'INR')]);
    expect([a, b].filter(Boolean).length).toBe(1);   // exactly one succeeds
    expect((await wallet.getWallet(u)).balance).toBe(100);
  });

  test('a concurrent credit does not clobber a concurrent debit (no lost update)', async () => {
    const u = uid();
    await wallet.credit(u, 500, 'INR');
    // Race a +100 credit against a -400 debit on the same 500 balance.
    await Promise.all([wallet.credit(u, 100, 'INR'), wallet.debit(u, 400, 'INR')]);
    // Both must apply: 500 + 100 - 400 = 200 (before the fix, credit's read-then-write
    // clobbered the debit and the balance was wrong/inflated).
    expect((await wallet.getWallet(u)).balance).toBe(200);
    const h = await wallet.history(u);
    expect(h.filter((t) => t.type === 'spend').length).toBe(1);
    expect(h.filter((t) => t.type === 'topup').length).toBe(2);
  });

  test('a different-currency top-up is rejected (single-currency wallet)', async () => {
    const u = uid();
    await wallet.credit(u, 100, 'INR');
    await expect(wallet.credit(u, 5, 'USD')).rejects.toThrow(/holds INR/);
  });

  test('zero-decimal currency (JPY) holds whole units, not ×100', async () => {
    const u = uid();
    const w = await wallet.credit(u, 1000, 'JPY');
    expect(w.balance).toBe(1000);
    expect(w.balanceMinor).toBe(1000);
  });

  test('a ref-bound credit is IDEMPOTENT — a retry never double-credits', async () => {
    const u = uid();
    await wallet.credit(u, 500, 'INR', { type: 'topup', ref: 'pay-1' });
    await wallet.credit(u, 500, 'INR', { type: 'topup', ref: 'pay-1' });   // retry with same ref
    expect((await wallet.getWallet(u)).balance).toBe(500);                  // applied exactly once
    expect((await wallet.history(u)).filter((t) => t.type === 'topup').length).toBe(1);
  });

  test('a ref-bound refund/debit is IDEMPOTENT — a retry after the money moved does not repeat it', async () => {
    const u = uid();
    await wallet.credit(u, 500, 'INR');
    await wallet.credit(u, 200, 'INR', { type: 'refund', ref: 'sale-9' });
    await wallet.credit(u, 200, 'INR', { type: 'refund', ref: 'sale-9' });   // retry
    expect((await wallet.getWallet(u)).balance).toBe(700);                    // 500 + 200 once
    await wallet.debit(u, 300, 'INR', { type: 'adjustment', ref: 'claw-9' });
    await wallet.debit(u, 300, 'INR', { type: 'adjustment', ref: 'claw-9' }); // retry
    expect((await wallet.getWallet(u)).balance).toBe(400);                    // 700 - 300 once
  });

  test('a same-currency credit after the wallet already exists NEVER throws a currency error', async () => {
    const u = uid();
    await wallet.credit(u, 100, 'INR');
    await expect(wallet.credit(u, 50, 'INR')).resolves.toBeTruthy();          // not WALLET_CURRENCY
    expect((await wallet.getWallet(u)).balance).toBe(150);
  });
});

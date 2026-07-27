// @ts-check
// services/wallet.js — stored-value wallet with an atomic, overspend-safe ledger.
// Balance is held in INTEGER minor units (float-safe). The debit is a single conditional
// decrement, so concurrent spends can never overdraw (same primitive as the marketplace
// inventory guard).

const Wallet = require('../models/Wallet');
const WalletTransaction = require('../models/WalletTransaction');
const { toMinor, fromMinor } = require('./money');

// Genuinely-atomic conditional update: pg-odm's atomicUpdate (ONE conditional SQL
// UPDATE … WHERE … RETURNING; concurrent callers serialise on the Postgres row lock)
// in prod/tests; Mongoose findOneAndUpdate (atomic in MongoDB) as the fallback. Plain
// pg-odm findOneAndUpdate is read-then-write and would let two spends overdraw.
/** @param {any} Model @param {any} filter @param {any} update */
function atomicUpdate(Model, filter, update) {
  return typeof Model.atomicUpdate === 'function'
    ? Model.atomicUpdate(filter, update)
    : Model.findOneAndUpdate(filter, update, { new: true });
}

/** @param {any} userId */
async function getWallet(userId) {
  const w = await Wallet.findOne({ userId });
  const currency = (w && w.currency) || null;
  const balanceMinor = (w && w.balanceMinor) || 0;
  return { userId: String(userId), currency, balanceMinor, balance: currency ? fromMinor(balanceMinor, currency) : 0 };
}

/** A currency-mismatch error the caller can detect (`err.code === 'WALLET_CURRENCY'`)
 * and reconcile, rather than crashing a captured top-up. @param {string} msg */
function currencyError(msg) { const e = new Error(msg); /** @type {any} */ (e).code = 'WALLET_CURRENCY'; return e; }

/**
 * Atomic CREDIT (top-up / refund). Uses the SAME genuinely-atomic conditional update as
 * debit (not read-then-write), so a concurrent debit can never be clobbered. The wallet
 * is single-currency and its currency is fixed at creation; a different-currency credit
 * is rejected. Balance and ledger are kept consistent (ledger failure rolls the balance
 * back).
 * @param {any} userId @param {number} amountMajor @param {string} currency
 * @param {{type?:string, ref?:string, purpose?:string, note?:string}} [meta]
 */
async function credit(userId, amountMajor, currency, meta = {}) {
  const addMinor = toMinor(amountMajor, currency);
  if (!(addMinor > 0)) throw new Error('Credit amount must be positive');

  // Common path: atomic same-currency increment (server-side against the committed row).
  let w = await atomicUpdate(Wallet, { userId, currency },
    { $inc: { balanceMinor: addMinor }, $set: { updatedAt: new Date() } });

  if (!w) {
    // No same-currency wallet: either none exists (first top-up) or it holds another
    // currency (reject — a wallet is single-currency).
    const existing = await Wallet.findOne({ userId });
    if (existing) throw currencyError(`Wallet holds ${existing.currency}; cannot add ${currency}.`);
    try {
      // First top-up: an atomic insert. The unique userId serialises concurrent creates.
      w = await Wallet.create({ userId, currency, balanceMinor: addMinor, updatedAt: new Date() });
    } catch {
      // A concurrent create won the row — retry the same-currency atomic increment.
      w = await atomicUpdate(Wallet, { userId, currency },
        { $inc: { balanceMinor: addMinor }, $set: { updatedAt: new Date() } });
      if (!w) throw currencyError(`Wallet was created in a different currency; cannot add ${currency}.`);
    }
  }

  // Ledger — compensate on failure so balance and ledger can never diverge.
  try {
    await WalletTransaction.create({
      userId, type: meta.type || 'topup', amountMinor: addMinor, currency,
      balanceAfterMinor: w.balanceMinor, ref: meta.ref, purpose: meta.purpose, note: meta.note,
    });
  } catch (ledgerErr) {
    await atomicUpdate(Wallet, { userId, currency }, { $inc: { balanceMinor: -addMinor }, $set: { updatedAt: new Date() } });
    throw ledgerErr;
  }
  return getWallet(userId);
}

/**
 * ATOMIC DEBIT (spend). Conditional decrement guards against overspend AND races —
 * returns null on insufficient balance or a currency mismatch (caller falls back to the
 * gateway). Never partially applies.
 * @param {any} userId @param {number} amountMajor @param {string} currency
 * @param {{ref?:string, purpose?:string, note?:string}} [meta]
 * @returns {Promise<null | Awaited<ReturnType<typeof getWallet>>>}
 */
async function debit(userId, amountMajor, currency, meta = {}) {
  const subMinor = toMinor(amountMajor, currency);
  if (!(subMinor > 0)) throw new Error('Debit amount must be positive');
  // balanceMinor is an INTEGER, so `>= subMinor` ⟺ `> subMinor - 1` (atomicUpdate
  // supports $gt). The conditional decrement is the overspend/race guard.
  const w = await atomicUpdate(
    Wallet,
    { userId, currency, balanceMinor: { $gt: subMinor - 1 } },
    { $inc: { balanceMinor: -subMinor }, $set: { updatedAt: new Date() } },
  );
  if (!w) return null;
  // Ledger — compensate on failure so a debit either fully succeeds (balance + ledger)
  // or leaves the balance untouched.
  try {
    await WalletTransaction.create({
      userId, type: 'spend', amountMinor: -subMinor, currency,
      balanceAfterMinor: w.balanceMinor, ref: meta.ref, purpose: meta.purpose, note: meta.note,
    });
  } catch (ledgerErr) {
    await atomicUpdate(Wallet, { userId, currency }, { $inc: { balanceMinor: subMinor }, $set: { updatedAt: new Date() } });
    throw ledgerErr;
  }
  return getWallet(userId);
}

/** @param {any} userId @param {number} [limit] */
async function history(userId, limit = 50) {
  const rows = await WalletTransaction.find({ userId }).sort({ createdAt: -1 }).limit(limit);
  return rows.map((/** @type {any} */ t) => ({
    type: t.type, amount: fromMinor(t.amountMinor, t.currency), currency: t.currency,
    balanceAfter: fromMinor(t.balanceAfterMinor, t.currency),
    purpose: t.purpose, note: t.note, ref: t.ref, createdAt: t.createdAt,
  }));
}

module.exports = { getWallet, credit, debit, history };

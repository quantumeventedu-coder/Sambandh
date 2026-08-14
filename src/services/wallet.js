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
const { atomicUpdate } = require('../db/atomic');

/** @param {any} userId */
async function getWallet(userId) {
  const w = await Wallet.findOne({ userId });
  const currency = (w && w.currency) || null;
  const balanceMinor = (w && w.balanceMinor) || 0;
  return { userId: String(userId), currency, balanceMinor, balance: currency ? fromMinor(balanceMinor, currency) : 0 };
}

/** getWallet + a `duplicate: true` marker, returned on the idempotent (already-applied)
 * paths so a caller can tell a real spend from a de-duplicated retry. @param {any} userId */
async function dupWallet(userId) { return { ...(await getWallet(userId)), duplicate: true }; }

/** A currency-mismatch error the caller can detect (`err.code === 'WALLET_CURRENCY'`)
 * and reconcile, rather than crashing a captured top-up. @param {string} msg */
function currencyError(msg) { const e = new Error(msg); /** @type {any} */ (e).code = 'WALLET_CURRENCY'; return e; }

/** Best-effort reconciliation flag when balance and ledger could not be kept in lock-step
 * (a compensating reversal that could not cleanly apply). Never throws. There are no
 * multi-statement transactions on the prod DB (transaction pooler), so this is the audit
 * trail that keeps a rare divergence visible rather than silent.
 * @param {any} userId @param {string} currency @param {number} amountMinor @param {string} reason */
async function flagReconcile(userId, currency, amountMinor, reason) {
  try {
    await require('../models/AuditLog').create({
      actor: 'system', action: 'wallet_reconcile', targetType: 'wallet', targetId: String(userId),
      detail: { currency, amountMinor, reason },
    });
  } catch { /* flagging is best-effort */ }
}

/** Has this exact (userId, ref, type) ledger entry already been written? Makes a credit or
 * debit tied to a source ref (a top-up payment, a refunded sale) apply AT MOST ONCE, so a
 * retry — or a claim that was rolled back after the money already moved — cannot double it.
 * @param {any} userId @param {string|undefined} ref @param {string} type */
async function alreadyApplied(userId, ref, type) {
  if (!ref) return false;
  return !!(await WalletTransaction.findOne({ userId, ref, type }));
}

/** A Postgres/Mongo unique-violation (the DB-level idempotency backstop firing). @param {any} e */
function isDupKey(e) { return !!(e && (e.code === '23505' || e.code === 11000 || /duplicate key|E11000/i.test(String((e && e.message) || '')))); }

/** Race-safe idempotency key for a ref-bound ledger entry (unset — exempt — otherwise).
 * @param {any} userId @param {string} type @param {string|undefined} ref */
function idemKeyFor(userId, type, ref) { return ref ? `${String(userId)}:${type}:${String(ref)}` : undefined; }

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
  const type = meta.type || 'topup';

  // IDEMPOTENCY: a ref-bound credit (a top-up capture, a refunded sale) applies at most
  // once. If its ledger entry already exists, it has already been credited — return the
  // current wallet without double-crediting (safe under retries and claim rollbacks).
  if (await alreadyApplied(userId, meta.ref, type)) return dupWallet(userId);

  // Common path: atomic same-currency increment (server-side against the committed row).
  let w = await atomicUpdate(Wallet, { userId, currency },
    { $inc: { balanceMinor: addMinor }, $set: { updatedAt: new Date() } });

  if (!w) {
    // No SAME-currency wallet row. Distinguish: a wallet in a DIFFERENT currency (reject —
    // single-currency), vs. a same-currency wallet a concurrent first top-up just created
    // (NOT a mismatch — retry the atomic increment), vs. no wallet at all (create it).
    const existing = await Wallet.findOne({ userId });
    if (existing && existing.currency !== currency) {
      throw currencyError(`Wallet holds ${existing.currency}; cannot add ${currency}.`);
    }
    if (existing) {
      // Same-currency wallet created by a racing first top-up — increment atomically.
      w = await atomicUpdate(Wallet, { userId, currency },
        { $inc: { balanceMinor: addMinor }, $set: { updatedAt: new Date() } });
      if (!w) throw currencyError(`Wallet was created in a different currency; cannot add ${currency}.`);
    } else {
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
  }

  // Ledger — compensate on failure. The reversal is GUARDED ($gt: addMinor-1) so it can
  // never drive the balance negative if a concurrent debit already spent the just-credited
  // funds; if it cannot cleanly reverse, the divergence is flagged, never silent, never
  // negative. (A single transaction would be ideal, but the prod transaction pooler
  // forbids multi-statement transactions — see pg-odm.)
  try {
    await WalletTransaction.create({
      userId, type, amountMinor: addMinor, currency,
      balanceAfterMinor: w.balanceMinor, ref: meta.ref, idemKey: idemKeyFor(userId, type, meta.ref), purpose: meta.purpose, note: meta.note,
    });
  } catch (ledgerErr) {
    const reversed = await atomicUpdate(Wallet,
      { userId, currency, balanceMinor: { $gt: addMinor - 1 } },
      { $inc: { balanceMinor: -addMinor }, $set: { updatedAt: new Date() } });
    if (!reversed) await flagReconcile(userId, currency, addMinor, 'credit_ledger_uncompensated');
    // A duplicate idemKey is the race-safe backstop firing: a concurrent/prior credit with
    // this ref already applied. That is SUCCESS — this attempt's increment is reversed
    // (above) and we return the wallet the winner produced, not an error.
    if (isDupKey(ledgerErr)) return dupWallet(userId);
    throw ledgerErr;
  }
  return getWallet(userId);
}

/**
 * ATOMIC DEBIT (spend). Conditional decrement guards against overspend AND races —
 * returns null on insufficient balance or a currency mismatch (caller falls back to the
 * gateway). Never partially applies.
 * @param {any} userId @param {number} amountMajor @param {string} currency
 * @param {{type?:string, ref?:string, purpose?:string, note?:string}} [meta]
 * @returns {Promise<null | (Awaited<ReturnType<typeof getWallet>> & { duplicate?: boolean })>}
 */
async function debit(userId, amountMajor, currency, meta = {}) {
  const subMinor = toMinor(amountMajor, currency);
  if (!(subMinor > 0)) throw new Error('Debit amount must be positive');
  const type = meta.type || 'spend';
  // IDEMPOTENCY: a ref-bound debit (e.g. a top-up refund clawback) applies at most once —
  // a retry after the money already moved returns the current wallet, not a second debit.
  if (await alreadyApplied(userId, meta.ref, type)) return dupWallet(userId);
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
      userId, type, amountMinor: -subMinor, currency,
      balanceAfterMinor: w.balanceMinor, ref: meta.ref, idemKey: idemKeyFor(userId, type, meta.ref), purpose: meta.purpose, note: meta.note,
    });
  } catch (ledgerErr) {
    // Re-add what we just decremented (this debit did not durably record).
    await atomicUpdate(Wallet, { userId, currency }, { $inc: { balanceMinor: subMinor }, $set: { updatedAt: new Date() } });
    // A duplicate idemKey means a concurrent/prior debit with this ref already applied —
    // idempotent SUCCESS: the decrement is undone (above) and the wallet is returned as-is.
    if (isDupKey(ledgerErr)) return dupWallet(userId);
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

/** Was a ref-bound entry already recorded? Lets a caller (e.g. an admin top-up clawback)
 * confirm the original credit actually applied before reversing it. @param {any} userId
 * @param {string} ref @param {string} type */
async function wasApplied(userId, ref, type) { return alreadyApplied(userId, ref, type); }

module.exports = { getWallet, credit, debit, history, wasApplied };

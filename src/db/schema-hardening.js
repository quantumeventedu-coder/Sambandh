// @ts-check
// db/schema-hardening.js — turn the app-level model schemas into DB-ENFORCED integrity.
//
// pg-odm stores every model as a JSONB document in a generic (id text, doc jsonb) table, so by
// default the DATABASE guarantees almost nothing — a bad enum, a negative amount, or an order that
// references a ghost payment/partner can be written if any code path forgets to check. This module
// promotes the invariants Postgres CAN enforce into real constraints, so bad or orphaned rows
// become physically impossible, independent of app correctness. That is the difference between
// "we must re-audit every change" and "the database won't let it happen."
//
// SAFE BY CONSTRUCTION:
//  • Every constraint is added NOT VALID — it enforces every NEW insert/update but never rejects
//    pre-existing rows, so hardening an already-populated table can't fail or lock out writes.
//  • Adding a constraint that already exists is a no-op (idempotent — safe to run on every boot).
//  • Foreign keys ride STORED GENERATED columns derived from the JSONB, so app code keeps writing
//    plain documents while the DB checks referential integrity. (toStorable() stores an ObjectId as
//    its hex string, which equals the referenced table's `id`, so the FK matches.)
//  • We DELIBERATELY do NOT add user-referencing FKs on retained financial records (Payment/Order):
//    DPDP account-erasure HARD-deletes the user while KEEPING those rows (tax retention), and a
//    generated FK column cannot ON DELETE SET NULL. A user FK would therefore block erasure. Those
//    references stay app-enforced; everything else the DB now guarantees.

const odm = require('./pg-odm');
const { getPool, registeredModels, tableName, ensureTable, assertSafePath } = odm._schema;

/** A field spec may be shorthand (`amountCHF: Number`) or full (`{ type, enum, min, max, ref }`).
 * @param {any} spec @returns {any} */
function normSpec(spec) {
  if (typeof spec === 'function') return { type: spec };                 // `Number` / `String` / `Date`
  if (spec && typeof spec === 'object' && !Array.isArray(spec)) return spec;
  return null;                                                            // nested object / array / unknown → skip
}

/** SQL literal list from an enum, single-quote-escaped. @param {any[]} values */
function sqlEnum(values) {
  return values.map((/** @type {any} */ v) => `'${String(v).replace(/'/g, "''")}'`).join(', ');
}

// ---- EXPLICIT spine: foreign keys + money/business invariants the auto-pass can't infer ---------
// FK parents here are NEVER hard-deleted while children survive (unlike users), so ON DELETE
// NO ACTION is both safe and correct (you must not delete a partner/listing/coupon an order needs).
const RELATIONS = [
  {
    model: 'Order',
    fk: [{ field: 'listingId', ref: 'Listing' }, { field: 'partnerId', ref: 'Partner' }, { field: 'paymentId', ref: 'Payment' }],
    checks: [
      { name: 'amt_nonneg', sql: `(doc->>'amountCHF') is null or (doc->>'amountCHF')::numeric >= 0` },
      { name: 'commission_nonneg', sql: `(doc->>'commissionCHF') is null or (doc->>'commissionCHF')::numeric >= 0` },
      { name: 'payout_nonneg', sql: `(doc->>'partnerPayoutCHF') is null or (doc->>'partnerPayoutCHF')::numeric >= 0` },
    ],
  },
  { model: 'Payment', checks: [{ name: 'amt_nonneg', sql: `(doc->>'amountCHF') is null or (doc->>'amountCHF')::numeric >= 0` }] },
  { model: 'CouponRedemption', fk: [{ field: 'couponId', ref: 'Coupon' }] },
  {
    model: 'Coupon',
    checks: [
      { name: 'pct_range', sql: `(doc->>'percentOff') is null or ((doc->>'percentOff')::numeric >= 0 and (doc->>'percentOff')::numeric <= 100)` },
      { name: 'flat_nonneg', sql: `(doc->>'flatOffCHF') is null or (doc->>'flatOffCHF')::numeric >= 0` },
      { name: 'redeemed_nonneg', sql: `(doc->>'redeemedCount') is null or (doc->>'redeemedCount')::numeric >= 0` },
    ],
  },
  { model: 'Session', fk: [{ field: 'orderId', ref: 'Order' }, { field: 'partnerId', ref: 'Partner' }] },
  { model: 'Listing', fk: [{ field: 'partnerId', ref: 'Partner' }], checks: [{ name: 'price_nonneg', sql: `(doc->>'priceCHF') is null or (doc->>'priceCHF')::numeric >= 0` }] },
  { model: 'ConsultantSlot', fk: [{ field: 'partnerId', ref: 'Partner' }, { field: 'listingId', ref: 'Listing' }] },
  { model: 'Review', fk: [{ field: 'partnerId', ref: 'Partner' }], checks: [{ name: 'rating_range', sql: `(doc->>'rating') is null or ((doc->>'rating')::numeric >= 1 and (doc->>'rating')::numeric <= 5)` }] },
  // WalletTransaction: the valuable guarantee (type ∈ topup/spend/refund/adjustment) is added by the
  // AUTO enum pass; the money field is amountMinor and is not separately constrained here.
];

// Bump when RELATIONS or the auto-derived constraint set changes, so a redeploy re-applies. The
// marker turns the steady state into a SINGLE query (no ~80 DDL round-trips on every cold start).
const HARDEN_VERSION = 1;

/**
 * Apply all DB-level constraints, idempotently. Loads every model (so the registry is complete),
 * ensures each table exists (FKs need their target tables present), then:
 *   1) AUTO from each schema: an enum whitelist CHECK + numeric min/max CHECKs for every field.
 *   2) EXPLICIT from RELATIONS: FK generated-columns + money/business CHECKs on the spine.
 * @param {{ silent?: boolean, force?: boolean }} [opts]
 * @returns {Promise<{ constraints: number, columns: number, skipped: number, upToDate?: boolean }>}
 */
async function hardenSchema(opts = {}) {
  const pool = getPool();
  if (!pool) throw new Error('hardenSchema: no DB pool (call after connect())');
  const log = (/** @type {string} */ m) => { if (!opts.silent) console.warn(m); };

  // Fast path: already hardened at this version → nothing to do.
  try {
    await pool.query(`create table if not exists _schema_meta (key text primary key, value text)`);
    const r = await pool.query(`select value from _schema_meta where key = 'harden_version'`);
    if (!opts.force && r.rows[0] && Number(r.rows[0].value) >= HARDEN_VERSION) return { constraints: 0, columns: 0, skipped: 0, upToDate: true };
  } catch (/** @type {any} */ e) { log(`[harden] version check skipped: ${e.message.split('\n')[0]}`); }

  // Load every model file so the registry is complete regardless of what boot has required so far.
  const fs = require('fs'), path = require('path');
  const modelsDir = path.join(__dirname, '..', 'models');
  for (const f of fs.readdirSync(modelsDir)) {
    if (f.endsWith('.js')) { try { require(path.join(modelsDir, f)); } catch { /* a model that can't load is not ours to fix here */ } }
  }
  const models = Object.entries(registeredModels);

  // Tables first — a FK can only reference a table that already exists.
  for (const [, M] of models) { try { await ensureTable(M); } catch (/** @type {any} */ e) { log(`[harden] ensureTable ${M.table}: ${e.message.split('\n')[0]}`); } }

  let constraints = 0, columns = 0, skipped = 0;
  const addConstraint = async (/** @type {string} */ table, /** @type {string} */ name, /** @type {string} */ body) => {
    try { await pool.query(`alter table ${table} add constraint ${name} ${body}`); constraints++; }
    catch (/** @type {any} */ e) {
      if (/already exists|duplicate/i.test(e.message)) { skipped++; return; }
      log(`[harden] ${name} on ${table} skipped: ${e.message.split('\n')[0]}`);
    }
  };
  const addColumn = async (/** @type {string} */ table, /** @type {string} */ col, /** @type {string} */ body) => {
    try { await pool.query(`alter table ${table} add column if not exists ${col} ${body}`); columns++; }
    catch (/** @type {any} */ e) { log(`[harden] column ${col} on ${table} skipped: ${e.message.split('\n')[0]}`); }
  };

  // 1) AUTO — enum + numeric range for every model field.
  for (const [, M] of models) {
    const t = M.table, def = (M.schema && M.schema.def) || {};
    for (const [field, raw] of Object.entries(def)) {
      const spec = normSpec(raw);
      if (!spec) continue;
      let col;
      try { assertSafePath(field); col = field.toLowerCase(); } catch { continue; }   // never interpolate an unvalidated name
      if (Array.isArray(spec.enum) && spec.enum.length) {
        await addConstraint(t, `${t}_${col}_enum`, `check ((doc->>'${field}') is null or (doc->>'${field}') in (${sqlEnum(spec.enum)})) not valid`);
      }
      if (spec.type === Number) {
        if (typeof spec.min === 'number') await addConstraint(t, `${t}_${col}_min`, `check ((doc->>'${field}') is null or (doc->>'${field}')::numeric >= ${spec.min}) not valid`);
        if (typeof spec.max === 'number') await addConstraint(t, `${t}_${col}_max`, `check ((doc->>'${field}') is null or (doc->>'${field}')::numeric <= ${spec.max}) not valid`);
      }
    }
  }

  // 2) EXPLICIT — FK generated-columns + business CHECKs on the money/trust spine.
  for (const rel of RELATIONS) {
    const t = tableName(rel.model);
    for (const { field, ref } of (rel.fk || [])) {
      let col;
      try { assertSafePath(field); col = `${field.toLowerCase()}_fk`; } catch { continue; }
      await addColumn(t, col, `text generated always as (doc->>'${field}') stored`);
      await addConstraint(t, `${t}_${field.toLowerCase()}_fk`, `foreign key (${col}) references ${tableName(ref)}(id) on delete no action not valid`);
    }
    for (const chk of (rel.checks || [])) {
      await addConstraint(t, `${t}_${chk.name}`, `check (${chk.sql}) not valid`);
    }
  }

  try {
    await pool.query(`insert into _schema_meta (key, value) values ('harden_version', $1) on conflict (key) do update set value = $1`, [String(HARDEN_VERSION)]);
  } catch (/** @type {any} */ e) { log(`[harden] version stamp skipped: ${e.message.split('\n')[0]}`); }

  if (!opts.silent) console.log(`[OK] schema hardening: ${constraints} constraints + ${columns} generated columns (${skipped} already present)`);
  return { constraints, columns, skipped };
}

module.exports = { hardenSchema, RELATIONS };

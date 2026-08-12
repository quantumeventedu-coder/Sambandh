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
//  • CHECK/FK constraints are added NOT VALID — they enforce every NEW insert/update but never
//    re-scan pre-existing rows, so adding them is a fast, metadata-only operation that can't fail on
//    or lock out an already-populated table.
//  • The FK generated columns are the ONE exception: `ADD COLUMN … GENERATED … STORED` rewrites the
//    table once under a brief lock. Harmless pre-launch (tables are small/empty) and it runs ONCE
//    (version-gated); for a large production table, add those columns in a dedicated migration
//    window instead of at boot. Everything else is lock-free.
//  • Adding a constraint that already exists is a no-op (idempotent — safe to run on every boot).
//  • Foreign keys ride STORED GENERATED columns derived from the JSONB, so app code keeps writing
//    plain documents while the DB checks referential integrity. (toStorable() stores an ObjectId as
//    its hex string, which equals the referenced table's `id`, so the FK matches.)
//  • We DELIBERATELY add FKs ONLY where the parent is NEVER hard-deleted while children survive.
//    Excluded: any user-referencing FK (DPDP erasure hard-deletes the user but KEEPS Payment/Order
//    for tax) and Order→Payment (superadmin purge-test-data deletes Payments but not their Orders).
//    A generated FK column can't ON DELETE SET NULL, so those stay app-enforced; the rest — parents
//    (Partner/Listing/Coupon/Order/Session) that are only ever deactivated — the DB now guarantees.

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
    // NB: no Order→Payment FK — superadmin purge-test-data deletes Payments but not their Orders,
    // and a generated FK column can't cascade/null, so it would block the purge. App-enforced instead.
    fk: [{ field: 'listingId', ref: 'Listing' }, { field: 'partnerId', ref: 'Partner' }],
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
  { model: 'Review', fk: [{ field: 'partnerId', ref: 'Partner' }] },   // rating 1..5 comes from the AUTO min/max pass (Review.rating has min/max)
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
 * @returns {Promise<{ constraints: number, columns: number, skipped: number, failed?: number, upToDate?: boolean }>}
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

  let constraints = 0, columns = 0, skipped = 0, failed = 0;   // `failed` = a HARD error → do NOT stamp the version, so it retries next boot
  const addConstraint = async (/** @type {string} */ table, /** @type {string} */ name, /** @type {string} */ body) => {
    try { await pool.query(`alter table ${table} add constraint ${name} ${body}`); constraints++; }
    catch (/** @type {any} */ e) {
      if (/already exists|duplicate/i.test(e.message)) { skipped++; return; }
      failed++; log(`[harden] ${name} on ${table} FAILED: ${e.message.split('\n')[0]}`);
    }
  };
  const addColumn = async (/** @type {string} */ table, /** @type {string} */ col, /** @type {string} */ body) => {
    try { await pool.query(`alter table ${table} add column if not exists ${col} ${body}`); columns++; }
    catch (/** @type {any} */ e) { failed++; log(`[harden] column ${col} on ${table} FAILED: ${e.message.split('\n')[0]}`); }
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

  // Only stamp the version when EVERYTHING applied — a hard failure (missing table, permission,
  // transient) must leave the marker un-bumped so the next boot re-attempts the missing constraint.
  if (failed === 0) {
    try {
      await pool.query(`insert into _schema_meta (key, value) values ('harden_version', $1) on conflict (key) do update set value = $1`, [String(HARDEN_VERSION)]);
    } catch (/** @type {any} */ e) { log(`[harden] version stamp skipped: ${e.message.split('\n')[0]}`); }
  }

  if (!opts.silent) console.log(`[OK] schema hardening: ${constraints} constraints + ${columns} generated columns (${skipped} present, ${failed} failed)`);
  return { constraints, columns, skipped, failed };
}

module.exports = { hardenSchema, RELATIONS };

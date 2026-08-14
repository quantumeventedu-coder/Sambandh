// @ts-check
// db/atomic.js — the ONE backend-agnostic atomic-update primitive.
//
// pg-odm exposes a genuinely-atomic `Model.atomicUpdate(filter, update)` (a single conditional
// `UPDATE … WHERE … RETURNING`); Mongoose has no such static, so we fall back to `findOneAndUpdate`,
// which applies the filter at write time and is likewise atomic. Returns the updated doc, or null if
// the guard did not hold.
//
// This used to be copy-pasted into six modules (marketplace, coupons, wallet, invoicing, entitlements,
// karma) — a textbook multi-turn duplication. Import this instead; never re-declare it.

/** @param {any} Model @param {any} filter @param {any} update */
function atomicUpdate(Model, filter, update) {
  return typeof Model.atomicUpdate === 'function'
    ? Model.atomicUpdate(filter, update)
    : Model.findOneAndUpdate(filter, update, { new: true });
}

module.exports = { atomicUpdate };

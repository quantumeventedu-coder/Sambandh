// @ts-check
// services/tax.js — pure, deterministic tax + gateway-fee quote engine. No I/O: the
// caller supplies the taxable components (each already fx-converted to the buyer's
// currency) and the rates (from services/commerce-config). Returns an itemized, honest
// breakdown so checkout shows principal + every tax line + the gateway fee → total
// (SHIG R-14). Modelled as COMPONENTS so a single item can carry more than one taxable
// part at different rates — e.g. gold jewellery: 3% on metal value + 5% on making charges.

/** Round to 2 decimals — exact for minor-unit (×100) charging in every supported currency.
 * @param {number|string} n @returns {number} */
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * @param {object} a
 * @param {Array<{label?:string, amount:number, rate:number}>} a.components
 *        each taxable part: `amount` (principal in local currency) taxed at `rate` (%).
 * @param {string} [a.taxName]        label for the tax, e.g. 'GST' / 'VAT'
 * @param {number} [a.gatewayFeePct]  payment-gateway processing fee (%)
 * @returns {{ base:number, lines:Array<{label:string,rate:number,amount:number}>, taxTotal:number, gatewayFeePct:number, gatewayFee:number, total:number }}
 */
function computeQuote({ components = [], taxName = 'Tax', gatewayFeePct = 0 }) {
  const comps = (components || []).filter(Boolean);
  const base = r2(comps.reduce((s, c) => s + (Number(c.amount) || 0), 0)); // principal the buyer pays
  const multi = comps.length > 1;

  /** @type {Array<{label:string,rate:number,amount:number}>} */
  const lines = [];
  let taxTotal = 0;
  for (const c of comps) {
    const rate = Number(c.rate) || 0;
    if (rate <= 0) continue;
    const amount = r2((Number(c.amount) || 0) * rate / 100);
    if (amount <= 0) continue;
    lines.push({ label: `${taxName} ${rate}%${multi && c.label ? ` (${c.label})` : ''}`, rate, amount });
    taxTotal += amount;
  }
  taxTotal = r2(taxTotal);

  const subtotal = r2(base + taxTotal);
  const gatewayFee = gatewayFeePct > 0 ? r2(subtotal * gatewayFeePct / 100) : 0;
  const total = r2(subtotal + gatewayFee);

  return { base, lines, taxTotal, gatewayFeePct, gatewayFee, total };
}

module.exports = { computeQuote, r2 };

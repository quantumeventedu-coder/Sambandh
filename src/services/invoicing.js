// @ts-check
// services/invoicing.js — tax invoices / receipts for captured payments.
//
// The receipt is built from the breakdown ALREADY stored on the Payment at checkout (base,
// discount, tax, gateway fee, total) plus the super-admin business details (legal name,
// GSTIN, address). Numbers are never recomputed here — the receipt reflects exactly what
// was charged. Invoice numbers are a per-financial-year atomic sequence (no duplicates).

const AppConfig = require('../models/AppConfig');
const Counter = require('../models/Counter');
const Payment = require('../models/Payment');

/** @param {any} Model @param {any} filter @param {any} update */
function atomicUpdate(Model, filter, update) {
  return typeof Model.atomicUpdate === 'function'
    ? Model.atomicUpdate(filter, update)
    : Model.findOneAndUpdate(filter, update, { new: true });
}
/** @param {any} v */
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const r2 = (/** @type {number} */ n) => Math.round(n * 100) / 100;

const DEFAULT_BUSINESS = {
  legalName: '', tradeName: 'Sambandh', gstin: '', pan: '',
  addressLines: /** @type {string[]} */ ([]), city: '', state: '', stateCode: '',
  country: 'IN', postalCode: '', email: '', phone: '', invoicePrefix: 'SB',
  // Default SAC (Services Accounting Code) shown on invoice lines. 998439 = "Other on-line
  // content n.e.c." — a common OIDAR/digital-services code; the operator sets their own.
  sacCode: '998439',
};

/** The super-admin business details used on invoices (merged over defaults). */
async function getBusiness() {
  const doc = await AppConfig.findOne({ key: 'singleton' }).lean();
  return { ...DEFAULT_BUSINESS, ...((doc && doc.business) || {}) };
}

/** @param {any} patch */
async function updateBusiness(patch) {
  const cur = await getBusiness();
  const p = patch || {};
  const str = ['legalName', 'tradeName', 'gstin', 'pan', 'city', 'state', 'stateCode', 'country', 'postalCode', 'email', 'phone', 'invoicePrefix', 'sacCode'];
  /** @type {Record<string, any>} */
  const next = { ...cur };
  for (const k of str) if (p[k] !== undefined) next[k] = String(p[k] ?? '').slice(0, 200);
  if (Array.isArray(p.addressLines)) next.addressLines = p.addressLines.slice(0, 4).map((/** @type {any} */ l) => String(l || '').slice(0, 120));
  if (!next.invoicePrefix) next.invoicePrefix = 'SB';
  await AppConfig.findOneAndUpdate({ key: 'singleton' }, { $set: { business: next, updatedAt: new Date() } }, { upsert: true, new: true });
  return next;
}

/** Indian financial year label for a date (FY runs 1 Apr → 31 Mar). @param {Date|string|number} d */
function fyLabel(d) {
  const dt = new Date(d);
  const y = dt.getUTCFullYear(), m = dt.getUTCMonth();      // 0 = Jan
  const start = m >= 3 ? y : y - 1;                          // April onwards → this year
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

/** Next invoice number in the per-FY atomic sequence, formatted `PREFIX/FY/00001`.
 * @param {string} prefix @param {Date|string|number} at */
async function nextInvoiceNo(prefix, at) {
  const fy = fyLabel(at);
  const key = `invoice:${fy}`;
  let c = await atomicUpdate(Counter, { key }, { $inc: { seq: 1 } });
  if (!c) {
    try { c = await Counter.create({ key, seq: 1 }); }        // first of the year
    catch { c = await atomicUpdate(Counter, { key }, { $inc: { seq: 1 } }); }   // a concurrent create won
  }
  return `${prefix || 'SB'}/${fy}/${String(c.seq).padStart(5, '0')}`;
}

/**
 * Assign an invoice number to a captured payment, ONCE. Idempotent: the number is bound with
 * a conditional atomicUpdate on invoiceNo:'' so two concurrent first-views can't give one
 * payment two numbers. @param {any} payment @returns {Promise<string>}
 */
async function assignInvoice(payment) {
  if (payment.invoiceNo) return payment.invoiceNo;
  const biz = await getBusiness();
  const no = await nextInvoiceNo(biz.invoicePrefix, payment.capturedAt || payment.createdAt || new Date());
  const won = await atomicUpdate(Payment, { _id: payment._id, invoiceNo: '' }, { $set: { invoiceNo: no, invoiceAt: new Date() } });
  if (won && won.invoiceNo) { payment.invoiceNo = won.invoiceNo; return won.invoiceNo; }
  const fresh = await Payment.findById(payment._id);           // lost the race — use the winner's number
  payment.invoiceNo = (fresh && fresh.invoiceNo) || no;
  return payment.invoiceNo;
}

/** Friendly line-item description for a purpose. @param {string} purpose */
function describe(purpose) {
  /** @type {Record<string, string>} */
  const map = {
    base_subscription: 'Sambandh membership — Essential (30 days)',
    pro_subscription: 'Sambandh membership — Plus (30 days)',
    max_subscription: 'Sambandh membership — Signature (30 days)',
    base_annual: 'Sambandh membership — Essential (annual)',
    pro_annual: 'Sambandh membership — Plus (annual)',
    max_annual: 'Sambandh membership — Signature (annual)',
    verification_service: 'Verification service',
    gift_pass: 'Sambandh Gift Pass',
    wallet_topup: 'Wallet top-up',
    consultation: 'Consultation session',
    boost: 'Profile boost',
  };
  return map[purpose] || String(purpose || 'Sambandh service').replace(/_/g, ' ');
}

/**
 * Build the receipt/tax-invoice data for a captured payment — from the STORED breakdown, so
 * it matches exactly what was charged. Splits Indian GST into CGST+SGST for an intra-state
 * supply (buyer state == seller state) or IGST otherwise.
 * @param {any} payment @param {any} user @param {any} business
 */
function buildReceipt(payment, user, business) {
  const md = payment.metadata || {};
  const currency = payment.currency || 'CHF';
  const isTopup = payment.purpose === 'wallet_topup';

  const grossBase = num(md.grossBase ?? md.base ?? md.topupAmount ?? payment.amountCHF);
  const discount = num(md.discountLocal ?? 0);
  const taxableBase = num(md.base ?? r2(grossBase - discount));
  const taxTotal = num(md.taxTotal ?? 0);
  const taxRate = num(md.taxRate ?? 0);
  const taxName = md.taxName || (business.country === 'IN' ? 'GST' : 'Tax');
  const gatewayFee = num(md.gatewayFee ?? 0);
  const total = num(md.total ?? md.amountLocal ?? payment.amountCHF);

  // Tax split. Intra-state Indian supply → CGST + SGST (half each); else a single line
  // (IGST for India, else the jurisdiction's tax name). Customer state is often unknown for
  // B2C digital supply, so IGST is the safe default (place of supply = customer location).
  const custState = (user && user.profile && (user.profile.state || user.profile.stateCode)) || '';
  const isIndia = (business.country || 'IN') === 'IN' && currency === 'INR';
  const intraState = isIndia && business.stateCode && custState && String(custState).toLowerCase() === String(business.state || business.stateCode).toLowerCase();
  /** @type {{label:string, rate:number, amount:number}[]} */
  let taxLines = [];
  if (taxTotal > 0) {
    if (intraState) {
      const half = r2(taxTotal / 2);
      taxLines = [
        { label: `CGST @ ${r2(taxRate / 2)}%`, rate: r2(taxRate / 2), amount: half },
        { label: `SGST @ ${r2(taxRate / 2)}%`, rate: r2(taxRate / 2), amount: r2(taxTotal - half) },
      ];
    } else {
      taxLines = [{ label: `${isIndia ? 'IGST' : taxName} @ ${taxRate}%`, rate: taxRate, amount: taxTotal }];
    }
  }

  return {
    kind: taxTotal > 0 ? 'Tax Invoice' : 'Payment Receipt',
    invoiceNo: payment.invoiceNo || '',
    date: payment.invoiceAt || payment.capturedAt || payment.createdAt,
    currency, symbol: md.symbol || '',
    seller: {
      legalName: business.legalName || business.tradeName || 'Sambandh',
      tradeName: business.tradeName || '',
      gstin: business.gstin || '', pan: business.pan || '',
      address: [...(business.addressLines || []), [business.city, business.state, business.postalCode].filter(Boolean).join(', '), business.country].filter(Boolean),
      email: business.email || '', phone: business.phone || '',
    },
    buyer: {
      name: (user && user.profile && user.profile.firstName) || 'Member',
      place: [(user && user.profile && user.profile.city) || '', (user && user.profile && user.profile.country) || ''].filter(Boolean).join(', '),
      phone: (user && user.phone) || '',
    },
    items: [{
      description: describe(payment.purpose) + (md.couponCode ? ` (coupon ${md.couponCode})` : ''),
      sac: business.sacCode || '', gross: grossBase, discount, taxableValue: taxableBase,
    }],
    placeOfSupply: custState || (user && user.profile && user.profile.country) || business.state || '',
    reverseCharge: 'No',
    taxLines, taxTotal, taxable: isTopup ? false : taxTotal > 0,
    gatewayFee, gatewayFeeNote: gatewayFee > 0 ? 'Payment-gateway processing fee (not a taxable supply)' : '',
    total,
    status: payment.status,
    purpose: payment.purpose,
    note: isTopup ? 'Wallet top-up — stored value; GST applies when the balance is later spent on a taxable supply.' : '',
  };
}

module.exports = { getBusiness, updateBusiness, fyLabel, nextInvoiceNo, assignInvoice, buildReceipt, describe };

// @ts-check
// services/commerce-config.js — the SINGLE source of truth for tax, gateway fee, and
// cancellation policy. Super-admin-editable (stored on AppConfig.commerce, overriding
// the seeded defaults below), cached briefly so a lookup per checkout is cheap.
//
// IMPORTANT (honesty): the seeded rates are a starting point. India GST is seeded from
// official guidance (18% on digital/OIDAR subscriptions & consultations; gold 3% on
// metal + 5% on making charges; books 0%; etc.). Other jurisdictions are seeded with
// their well-known standard rate. Tax law varies by country and changes; the OPERATOR
// is responsible for verifying and adjusting every rate from the super-admin panel (or
// wiring a dedicated tax provider). Any country not seeded uses DEFAULT.

const AppConfig = require('../models/AppConfig');

/** @typedef {{ currency:string, taxName:string, taxIdLabel?:string, categories:Record<string,number> }} CountryTax */
/** @typedef {{ gatewayFeePct:number, cancellation:{windowDays:number,prorate:boolean}, countries:Record<string,CountryTax>, DEFAULT:CountryTax }} Commerce */

/** @type {Commerce} */
const DEFAULT_COMMERCE = {
  // Payment-gateway processing fee, added as a line at checkout. Passing this to the
  // customer must comply with the gateway's terms and local surcharge rules — verify.
  gatewayFeePct: 2.7,
  // Cancel within `windowDays` of the last payment → pro-rated refund of unused time.
  // After the window → no cancellation/refund (membership runs to its paid expiry).
  cancellation: { windowDays: 2, prorate: true },
  countries: {
    // India — seeded from official GST guidance (OIDAR digital services @ 18%).
    IN: {
      currency: 'INR', taxName: 'GST', taxIdLabel: 'GSTIN',
      categories: {
        subscription: 18, consultation: 18, verification: 18, gift: 18,
        precious_metal: 3, making_charges: 5, electronics: 18, electronics_luxury: 28,
        fashion: 12, fashion_premium: 18, confectionery: 18, books: 0, default: 18,
      },
    },
    GB: { currency: 'GBP', taxName: 'VAT', categories: { default: 20, books: 0 } },
    AE: { currency: 'AED', taxName: 'VAT', categories: { default: 5 } },
    AU: { currency: 'AUD', taxName: 'GST', categories: { default: 10 } },
    SG: { currency: 'SGD', taxName: 'GST', categories: { default: 9 } },
    DE: { currency: 'EUR', taxName: 'VAT', categories: { default: 19, books: 7 } },
    FR: { currency: 'EUR', taxName: 'VAT', categories: { default: 20, books: 5.5 } },
    CA: { currency: 'CAD', taxName: 'GST', categories: { default: 5 } },
    // US state sales tax on digital goods varies by state — seeded at 0; operator configures.
    US: { currency: 'USD', taxName: 'Sales tax', categories: { default: 0 } },
  },
  // Every unlisted country falls back here. Zero tax by default: the operator MUST set
  // the correct rate before selling into a jurisdiction (fail-open would misprice tax).
  DEFAULT: { currency: 'CHF', taxName: 'Tax', categories: { default: 0 } },
};

const TTL = 60 * 1000;
/** @type {{ at:number, value:Commerce|null }} */
let cache = { at: 0, value: null };

/** Deep-ish merge of a stored partial over the defaults (country + category granularity).
 * @param {any} stored @returns {Commerce} */
function mergeCommerce(stored) {
  if (!stored || typeof stored !== 'object') return DEFAULT_COMMERCE;
  const out = {
    gatewayFeePct: typeof stored.gatewayFeePct === 'number' ? stored.gatewayFeePct : DEFAULT_COMMERCE.gatewayFeePct,
    cancellation: { ...DEFAULT_COMMERCE.cancellation, ...(stored.cancellation || {}) },
    countries: { ...DEFAULT_COMMERCE.countries },
    DEFAULT: { ...DEFAULT_COMMERCE.DEFAULT, ...(stored.DEFAULT || {}) },
  };
  if (stored.countries && typeof stored.countries === 'object') {
    for (const [code, cfg] of Object.entries(stored.countries)) {
      const base = out.countries[code] || DEFAULT_COMMERCE.DEFAULT;
      out.countries[code] = {
        currency: cfg.currency || base.currency,
        taxName: cfg.taxName || base.taxName,
        taxIdLabel: cfg.taxIdLabel || base.taxIdLabel,
        categories: { ...base.categories, ...(cfg.categories || {}) },
      };
    }
  }
  return out;
}

/** @returns {Promise<Commerce>} the effective commerce config (stored over defaults), cached. */
async function getCommerce() {
  if (cache.value && Date.now() - cache.at < TTL) return cache.value;
  let stored = null;
  try {
    const doc = await AppConfig.findOne({ key: 'singleton' }).lean();
    stored = doc && doc.commerce;
  } catch { /* DB unavailable → defaults */ }
  const value = mergeCommerce(stored);
  cache = { at: Date.now(), value };
  return value;
}

/** Merge a partial country config over a base, preserving unspecified fields/categories.
 * @param {CountryTax} base @param {any} cfg @returns {CountryTax} */
function mergeCountry(base, cfg) {
  if (!cfg || typeof cfg !== 'object') return base;
  return {
    currency: cfg.currency || base.currency,
    taxName: cfg.taxName || base.taxName,
    taxIdLabel: cfg.taxIdLabel || base.taxIdLabel,
    categories: { ...(base.categories || {}), ...(cfg.categories || {}) },
  };
}

/** Persist a super-admin edit (partial), deep-merged over the CURRENT effective config
 * so an edit to one country/category never drops the others. Invalidates the cache.
 * @param {any} patch @returns {Promise<Commerce>} */
async function updateCommerce(patch) {
  const current = await getCommerce();
  const p = patch || {};
  const next = {
    gatewayFeePct: typeof p.gatewayFeePct === 'number' ? p.gatewayFeePct : current.gatewayFeePct,
    cancellation: { ...current.cancellation, ...(p.cancellation || {}) },
    DEFAULT: mergeCountry(current.DEFAULT, p.DEFAULT),
    countries: { ...current.countries },
  };
  if (p.countries && typeof p.countries === 'object') {
    for (const [code, cfg] of Object.entries(p.countries)) {
      next.countries[code] = mergeCountry(current.countries[code] || current.DEFAULT, cfg);
    }
  }
  await AppConfig.findOneAndUpdate(
    { key: 'singleton' },
    { $set: { commerce: next, updatedAt: new Date() } },
    { upsert: true, new: true },
  );
  cache = { at: Date.now(), value: next };
  return next;
}

/** The tax/currency config for a country code, falling back to DEFAULT.
 * @param {string} country @returns {Promise<CountryTax>} */
async function countryConfig(country) {
  const c = await getCommerce();
  const code = String(country || '').toUpperCase();
  return c.countries[code] || c.DEFAULT;
}

/** Tax rate (%) for a (country, category), falling back to the country's `default`.
 * @param {string} country @param {string} category @returns {Promise<number>} */
async function categoryRate(country, category) {
  const cfg = await countryConfig(country);
  const cats = cfg.categories || {};
  return typeof cats[category] === 'number' ? cats[category] : (cats.default || 0);
}

function _resetCache() { cache = { at: 0, value: null }; } // test hook

module.exports = { DEFAULT_COMMERCE, getCommerce, updateCommerce, countryConfig, categoryRate, mergeCommerce, _resetCache };

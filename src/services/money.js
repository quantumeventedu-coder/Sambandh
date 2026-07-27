// @ts-check
// services/money.js — currency-exponent-aware minor-unit conversion, shared by the
// payment path and the wallet. Storing/charging money in INTEGER minor units avoids
// binary-float drift (e.g. a balance of 605.93 comparing false against a 605.93 debit).

// Zero-decimal (exponent-0) currencies: the major unit IS the smallest unit.
const ZERO_DECIMAL = new Set(['JPY', 'KRW', 'VND', 'CLP', 'ISK', 'XAF', 'XOF', 'BIF', 'DJF', 'GNF', 'KMF', 'MGA', 'PYG', 'RWF', 'UGX', 'VUV', 'XPF']);

/** Minor-unit exponent for a currency (2 for most, 0 for zero-decimal). @param {string} code */
const exp = (code) => (ZERO_DECIMAL.has(String(code)) ? 0 : 2);

/** Major amount → integer minor units for a currency. @param {number} amount @param {string} code @returns {number} */
const toMinor = (amount, code) => Math.round((Number(amount) || 0) * (exp(code) === 0 ? 1 : 100));

/** Integer minor units → major amount for a currency. @param {number} minor @param {string} code @returns {number} */
const fromMinor = (minor, code) => (exp(code) === 0 ? Math.round(Number(minor) || 0) : Math.round(Number(minor) || 0) / 100);

module.exports = { ZERO_DECIMAL, exp, toMinor, fromMinor };

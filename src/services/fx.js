// services/fx.js — live currency conversion from CHF (the canonical price) to a
// user's local currency, so the displayed/charged amount tracks the CHF price at
// the current exchange rate. Rates come from frankfurter.app (free, ECB data, no
// key), cached ~12h, with a static fallback so payments never break if it's down.

const FALLBACK = { INR: 95, USD: 1.1, EUR: 1.05, GBP: 0.88, AED: 4.0, SGD: 1.5 };
const TTL = 12 * 3600 * 1000;
let cache = { at: 0, rates: {} };

async function ratesFromCHF() {
  if (Date.now() - cache.at < TTL && Object.keys(cache.rates).length) return cache.rates;
  try {
    const to = Object.keys(FALLBACK).join(',');
    const r = await fetch(`https://api.frankfurter.app/latest?from=CHF&to=${to}`, { signal: AbortSignal.timeout(6000) });
    const j = await r.json();
    if (j && j.rates && j.rates.INR) { cache = { at: Date.now(), rates: j.rates }; return j.rates; }
  } catch { /* fall through to fallback/cache */ }
  return Object.keys(cache.rates).length ? cache.rates : FALLBACK;
}

// Convert a CHF amount to `to`, rounded to a whole unit (₹95, not ₹95.37).
async function convertFromCHF(chf, to) {
  if (!to || to === 'CHF') return chf;
  const rates = await ratesFromCHF();
  const rate = rates[to] || FALLBACK[to] || 1;
  const val = chf * rate;
  // Sub-unit CHF prices (e.g. CHF 0.5 escalation) keep 2 decimals; whole ones round.
  return chf < 1 ? Math.round(val * 100) / 100 : Math.round(val);
}

module.exports = { ratesFromCHF, convertFromCHF, FALLBACK };

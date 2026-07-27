// services/fx.js — live currency conversion from CHF (the canonical price) to a
// user's local currency, so the displayed/charged amount tracks the CHF price at
// the current exchange rate. Rates come from frankfurter.app (free, ECB data, no
// key), cached ~12h, with a static fallback so payments never break if it's down.

// Static fallback used only when the live rate API is unreachable. Kept current-ish so
// an outage never mis-quotes badly (the old INR: 95 under-quoted CHF 5 at ₹475 instead
// of ~₹590). Live rates from frankfurter.app override these whenever available.
const FALLBACK = { INR: 118, USD: 1.1, EUR: 1.05, GBP: 0.88, AED: 4.0, SGD: 1.5, AUD: 1.7, CAD: 1.5, JPY: 165 };
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
  // Fail CLOSED: an unknown currency must NOT silently default to a 1:1 rate (that
  // undercharges ~99%). Only currencies we can actually convert are chargeable.
  const rate = rates[to] || FALLBACK[to];
  if (!rate) throw new Error(`No exchange rate available for currency "${to}" — configure a supported currency before charging this jurisdiction.`);
  const val = chf * rate;
  // Sub-unit CHF prices (e.g. CHF 0.5 escalation) keep 2 decimals; whole ones round.
  return chf < 1 ? Math.round(val * 100) / 100 : Math.round(val);
}

module.exports = { ratesFromCHF, convertFromCHF, FALLBACK };

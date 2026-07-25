// @ts-check
// services/trust/risk-engine.js — AAV Layer 15: aggregate signals → Trust Score.
//
// Combines every module's signal into a 0–1000 trust score and a decision band.
// Design rules (from the security spec):
//   · Fail SECURE — an UNKNOWN signal (e.g. a detector with no vendor configured)
//     is floored at elevated risk, so an unverified document can never auto-approve.
//   · No single clean signal can auto-approve — auto requires ALL contributing
//     signals present (none unknown) AND the aggregate above the AUTO band.
//   · A hard-fail (malware/polyglot/executable) rejects regardless of score.
//   · Thresholds live here, server-side, and are NEVER returned to a client.

/** Decision bands over the 0–1000 score. */
const BANDS = { AUTO: 900, SECONDARY: 700, MANUAL: 500 };
/** Unknown signals are treated as at least this risky (0–100). */
const UNKNOWN_FLOOR = 45;

/**
 * @typedef {{ name: string, risk?: number, weight?: number, unknown?: boolean, hardFail?: boolean }} Signal
 * @param {Signal[]} signals  each risk is 0–100
 * @returns {{ score: number, decision: 'auto'|'secondary'|'manual'|'reject', anyUnknown: boolean, hardFail: boolean, factors: Record<string, {risk:number, unknown:boolean}> }}
 */
function score(signals) {
  if (!Array.isArray(signals) || signals.length === 0) {
    // No evidence at all → maximum risk (fail-secure), never a pass.
    return { score: 0, decision: 'reject', anyUnknown: true, hardFail: false, factors: {} };
  }
  let weighted = 0, totalWeight = 0, anyUnknown = false, hardFail = false;
  /** @type {Record<string, {risk:number, unknown:boolean}>} */ const factors = {};
  for (const s of signals) {
    if (s.hardFail) hardFail = true;
    const w = s.weight == null ? 1 : Math.max(0, s.weight);
    const raw = Math.max(0, Math.min(100, s.risk || 0));
    const r = s.unknown ? Math.max(raw, UNKNOWN_FLOOR) : raw;
    if (s.unknown) anyUnknown = true;
    weighted += r * w; totalWeight += w;
    factors[s.name] = { risk: r, unknown: !!s.unknown };
  }
  const avgRisk = totalWeight ? weighted / totalWeight : 100;
  const trust = Math.max(0, Math.min(1000, Math.round((100 - avgRisk) * 10)));

  /** @type {'auto'|'secondary'|'manual'|'reject'} */
  let decision;
  if (hardFail) decision = 'reject';
  else if (trust < BANDS.MANUAL) decision = 'reject';
  else if (trust < BANDS.SECONDARY) decision = 'manual';
  else if (trust < BANDS.AUTO || anyUnknown) decision = 'secondary'; // any unknown blocks auto
  else decision = 'auto';

  return { score: trust, decision, anyUnknown, hardFail, factors };
}

module.exports = { score, BANDS, UNKNOWN_FLOOR };

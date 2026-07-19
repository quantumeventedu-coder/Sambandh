// geometry-map.js — PURE geometry → temperament-feature mapping.
//
// Input: the 68-point face landmark array face-api already produces in the browser
// (the same faceLandmark68TinyNet used for face verification). Output: discretised
// geometric feature values from the FIXED vocabulary the rest of the app uses,
// each with a confidence, plus the fields it could NOT measure.
//
// HARD LINES baked in here too (defence in depth with services/feature-guard.js):
//   • Geometry only — ratios of landmark positions. There is NO colour/pixel/skin
//     input to this function at all, so complexion CANNOT influence any output.
//   • It emits only forehead + eyes. build/gait/hands need a BODY-POSE model that
//     is not wired yet — this module honestly returns them as `unmeasured`, never
//     a guess. Overclaiming would be the dishonest failure mode; we refuse it.
//
// Landmark index map (face-api 68-pt / iBUG): 0–16 jaw, 17–21 L brow, 22–26 R brow,
// 27–30 nose bridge, 31–35 nose base, 36–41 L eye, 42–47 R eye, 48–67 mouth.
//
// Isomorphic: loaded as window.SBGeometry in the browser, require()d in tests.

(function (root) {
  'use strict';

  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function mid(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }

  // width of one eye (outer→inner corner) and its openness (vertical/horizontal).
  function eyeMetrics(p, o, i, top1, top2, bot1, bot2) {
    const width = dist(p[o], p[i]);
    const open = (dist(p[top1], p[bot1]) + dist(p[top2], p[bot2])) / 2;
    return { width, open, aspect: width ? open / width : 0 };
  }

  // Discretise a scalar into buckets by ascending thresholds → labels[k].
  function bucket(value, thresholds, labels) {
    for (let k = 0; k < thresholds.length; k++) if (value < thresholds[k]) return labels[k];
    return labels[labels.length - 1];
  }

  /**
   * @param {Array<{x:number,y:number}>} lm  68 landmark points (normalised or px)
   * @returns {{ features: Record<string,string>, confidence: Record<string,number>, unmeasured: string[] }}
   */
  function geometryToFeatures(lm) {
    const out = { features: {}, confidence: {}, unmeasured: ['build', 'gait', 'hands'] };
    if (!Array.isArray(lm) || lm.length < 68) return out;
    for (const p of lm) if (!p || typeof p.x !== 'number' || typeof p.y !== 'number') return out;

    // Reference scales — face width (jaw 0↔16) and a proxy face height.
    const faceW = dist(lm[0], lm[16]);
    if (!(faceW > 0)) return out;
    const browMid = mid(lm[19], lm[24]);           // between the brow peaks
    const chin = lm[8];
    const faceH = dist(browMid, chin) || faceW;    // brow→chin (no hairline in 68-pt)

    // ---- EYES: width relative to face, and openness (aspect) ----
    const left = eyeMetrics(lm, 36, 39, 37, 38, 41, 40);
    const rightE = eyeMetrics(lm, 42, 45, 43, 44, 47, 46);
    const eyeW = (left.width + rightE.width) / 2;
    const eyeAspect = (left.aspect + rightE.aspect) / 2;
    const eyeRatio = eyeW / faceW;                 // typical ~0.22–0.30

    // large (wide + open) / soft (open, not wide) / sharp (narrow opening) /
    // deepset (small relative width). Aspect splits open vs narrow; ratio splits size.
    let eyes;
    if (eyeAspect >= 0.34) eyes = eyeRatio >= 0.255 ? 'large' : 'soft';
    else eyes = eyeRatio >= 0.245 ? 'sharp' : 'deepset';
    out.features.eyes = eyes;
    out.confidence.eyes = clampConf(eyeRatio, 0.18, 0.32);

    // ---- FOREHEAD (approximate): temple breadth (brow span) vs face width, and
    // upper-face proportion. No hairline in 68-pt, so this is a bounded estimate;
    // confidence is capped accordingly. ----
    const browSpan = dist(lm[17], lm[26]);         // outer brow to outer brow
    const browRatio = browSpan / faceW;            // breadth of the upper face
    const upperProp = dist(browMid, mid(lm[36], lm[45])) / faceH; // brow→eye band height

    let forehead;
    if (browRatio >= 0.92) forehead = 'broad';
    else if (browRatio <= 0.80) forehead = 'narrow';
    else forehead = upperProp >= 0.16 ? 'high' : 'even';
    out.features.forehead = forehead;
    out.confidence.forehead = Math.min(0.6, clampConf(browRatio, 0.7, 1.0)); // capped: no hairline

    return out;
  }

  // Map a raw ratio to a 0..1 confidence by how central it sits in a plausible band
  // (values at the extremes of the expected range are less reliable buckets).
  function clampConf(v, lo, hi) {
    if (hi <= lo) return 0.5;
    const t = (v - lo) / (hi - lo);
    const c = 1 - Math.abs(0.5 - Math.max(0, Math.min(1, t))) * 2 * 0.5; // 0.5..1 centred
    return Math.round(Math.max(0, Math.min(1, c)) * 100) / 100;
  }

  /**
   * Keep only confident readings — below `minConf` a field is dropped (the guard/
   * server never sees a low-confidence guess). Returns the map to POST.
   * @param {ReturnType<typeof geometryToFeatures>} result
   * @param {number} [minConf]
   */
  function confidentFeatures(result, minConf) {
    minConf = minConf == null ? 0.45 : minConf;
    const features = {};
    for (const k of Object.keys(result.features)) {
      if ((result.confidence[k] || 0) >= minConf) features[k] = result.features[k];
    }
    return features;
  }

  const api = { geometryToFeatures: geometryToFeatures, confidentFeatures: confidentFeatures };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SBGeometry = api;
})(typeof self !== 'undefined' ? self : this);

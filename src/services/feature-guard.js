// @ts-check
// src/services/feature-guard.js — the SINGLE sanctioned gate for computer-vision
// writes to a user's temperament `features`.
//
// Background: `features` used to be self-declared ONLY. That line was reversed by
// an explicit, informed product decision — geometric CV may now populate features
// — but ONLY behind three non-negotiable guardrails, encoded here as executable
// policy so no CV code path can bypass them:
//
//   1. NO COMPLEXION → CHARACTER. Geometry (proportions/ratios) only. Skin tone,
//      colour, "fairness", shade — as a KEY or a VALUE — is rejected, hard. Nothing
//      about complexion may ever become a temperament/character/worth signal.
//   2. GEOMETRY ONLY, KNOWN VOCABULARY. CV may write only the measurable geometric
//      fields, using the same fixed vocabulary the self-declare form uses. Anything
//      else is dropped.
//   3. CV OUTPUT IS A READING, NEVER "VERIFIED". Provenance is tracked per field
//      (self | cv); CV-derived features surface with the reading badge. `features`
//      never sets, and can never be read as, a verified fact.
//
// This module is pure (no DB). The DB layer calls `applyCvFeatures` to get the
// patch to persist; the ML layer (MediaPipe, later) feeds candidate values in.

const { ValidationError, ForbiddenError } = require('../lib/errors');

/**
 * Fields CV is permitted to write, each with its fixed value vocabulary. This is
 * a SUBSET of the self-declare set: only what a still image / short clip can
 * actually measure as geometry. `voice` is intentionally absent (not visual).
 * Values mirror the self-declare enums so the two sources are interchangeable.
 * @type {Record<string, string[]>}
 */
const CV_MEASURABLE = {
  forehead: ['broad', 'high', 'narrow', 'even'],
  eyes: ['large', 'sharp', 'soft', 'deepset'],
  gait: ['fast', 'measured', 'light', 'firm'],     // needs a short clip; face-only skips it
  hands: ['long', 'broad', 'fine', 'square'],
  build: ['solid', 'lean', 'balanced', 'sturdy']
};

/**
 * Complexion / colour / skin terms. Matched against BOTH keys and values,
 * case-insensitively. Their presence is a hard rejection — this is line #1.
 */
const COMPLEXION_RE = /\b(skin|complexion|tone|toned|colour|color|fair|fairness|dusky|dark|wheatish|shade|pigment|pale|glow|texture)\b/i;

/**
 * Assert a candidate feature map is geometry-only and complexion-free. Throws a
 * ValidationError on any violation; returns nothing on success.
 * @param {Record<string, unknown>} features
 */
function assertGeometricOnly(features) {
  if (features == null || typeof features !== 'object') {
    throw new ValidationError('features must be an object');
  }
  for (const [key, value] of Object.entries(features)) {
    if (COMPLEXION_RE.test(key)) {
      throw new ValidationError(`complexion/skin-tone is never a character signal (field "${key}")`);
    }
    if (typeof value === 'string' && COMPLEXION_RE.test(value)) {
      throw new ValidationError(`complexion/skin-tone is never a character signal (value "${value}")`);
    }
    if (!Object.prototype.hasOwnProperty.call(CV_MEASURABLE, key)) {
      // Not measurable geometry — silently ignored by applyCvFeatures, but calling
      // assert directly on an unknown key is a programming error, so flag it.
      throw new ValidationError(`"${key}" is not a CV-measurable geometric feature`);
    }
    if (typeof value === 'string' && !CV_MEASURABLE[key].includes(value)) {
      throw new ValidationError(`"${value}" is not an allowed value for "${key}"`);
    }
  }
}

/**
 * The ONLY sanctioned way CV writes features. Given the current user and the CV's
 * candidate geometric readings, returns the patch to persist — or throws if
 * consent is missing or the input violates the guardrails.
 *
 * Policy:
 *  - Requires explicit geometry consent (separate from photo/verification consent).
 *  - Keeps only CV-measurable geometric fields with valid values (others dropped).
 *  - Rejects any complexion/skin-tone key or value outright.
 *  - Self-declared values WIN: CV fills only fields the user has not declared
 *    themselves, so a machine guess never overwrites a person's own word.
 *  - Marks each CV-filled field's provenance as 'cv' (→ reading badge, not verified).
 *
 * @param {{ features?: Record<string, string>, featureSources?: Record<string, string>, cvConsent?: { geometry?: boolean } }} user
 * @param {Record<string, unknown>} candidate  raw CV output (field → value)
 * @param {{ consent?: boolean }} [opts]
 * @returns {{ features: Record<string, string>, featureSources: Record<string, string>, written: string[] }}
 */
function applyCvFeatures(user, candidate, opts = {}) {
  const consented = opts.consent === true || !!(user && user.cvConsent && user.cvConsent.geometry);
  if (!consented) {
    throw new ForbiddenError('geometric reading requires explicit consent');
  }
  if (candidate == null || typeof candidate !== 'object') {
    throw new ValidationError('features must be an object');
  }

  const features = { ...(user.features || {}) };
  const featureSources = { ...(user.featureSources || {}) };
  const written = [];

  for (const [key, value] of Object.entries(candidate)) {
    // Hard line first: complexion terms are rejected even before "is it measurable".
    if (COMPLEXION_RE.test(key) || (typeof value === 'string' && COMPLEXION_RE.test(value))) {
      throw new ValidationError('complexion/skin-tone is never a character signal');
    }
    if (!Object.prototype.hasOwnProperty.call(CV_MEASURABLE, key)) continue;        // not geometry → drop
    if (typeof value !== 'string' || !CV_MEASURABLE[key].includes(value)) continue; // invalid value → drop

    // Self-declared wins: never overwrite a value the user set themselves.
    if (featureSources[key] === 'self') continue;
    if (features[key] != null && featureSources[key] == null) continue; // pre-existing self-declared (untagged)

    features[key] = value;
    featureSources[key] = 'cv';
    written.push(key);
  }

  return { features, featureSources, written };
}

/**
 * The badge kind for a feature, by provenance. CV-derived features are ALWAYS a
 * reading — there is no path to 'fact'/'verified' for a temperament feature.
 * @param {string | undefined} source  'self' | 'cv' | undefined
 * @returns {'reading'}
 */
function featureBadgeKind(source) {
  // Deliberately returns 'reading' for every provenance. Temperament features —
  // whether self-declared or CV-derived — are interpretations, not verified facts.
  void source;
  return 'reading';
}

module.exports = {
  CV_MEASURABLE,
  COMPLEXION_RE,
  assertGeometricOnly,
  applyCvFeatures,
  featureBadgeKind
};

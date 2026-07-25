// @ts-check
// services/trust/metadata-forensics.js — AAV Layer 3: provenance & tamper signals.
//
// Scans an image's raw bytes (EXIF/XMP text region) for signals that a document
// photo was machine-generated or edited: AI-tool software tags, heavy edit history,
// missing camera metadata, C2PA/Content-Credentials provenance. Pure + testable.
//
// These are HEURISTIC SIGNALS, not a definitive AI classifier — a real generative-
// image detector needs a trained model / vendor (wired via providers.js). But an AI
// tool leaving its name in the metadata, or a document photo carrying no camera
// origin, are genuine, non-fabricated fraud signals that erode trust.

const AI_TOOL_RE = /(stable[\s-]?diffusion|midjourney|dall[\s-]?e|adobe firefly|firefly|black forest labs|flux\.1|imagen|gpt[\s-]?image|leonardo\.ai|comfyui|automatic1111|invokeai|generative fill|craiyon|playground\s?ai|nightcafe|dreamstudio)/i;
const EDITOR_RE = /(adobe photoshop|gimp|affinity photo|pixelmator|snapseed|facetune|remini|topaz|luminar|picsart|canva)/i;

/** Read the leading region where EXIF/XMP/C2PA live (first 256 KB is plenty). @param {Buffer} buf */
function head(buf) { return buf.slice(0, Math.min(buf.length, 262144)).toString('latin1'); }

/**
 * @param {Buffer} buf
 * @param {string|null} type  sniffed content type ('jpeg'|'png'|'webp'|…)
 * @returns {{ reasons: string[], risk: number, c2pa: boolean }}
 */
function analyzeImage(buf, type) {
  /** @type {string[]} */ const reasons = [];
  let risk = 0;
  const text = head(buf);

  // C2PA / Content Credentials manifest — cryptographic provenance (informational).
  const c2pa = /(c2pa|contentauth|jumbf|urn:uuid:[^ ]*c2pa)/i.test(text);

  // AI generator signature in Software / CreatorTool / "parameters" (SD PNG chunk).
  if (AI_TOOL_RE.test(text)) { reasons.push('ai-tool-signature'); risk += 70; }
  // Stable Diffusion PNG parameter block.
  if (/\bparameters\b[\s\S]{0,40}(steps|sampler|cfg scale|seed)\b/i.test(text)) { reasons.push('diffusion-parameters'); risk += 60; }
  // Consumer photo editor — a raw ID scan shouldn't have been retouched.
  if (EDITOR_RE.test(text)) { reasons.push('editing-software'); risk += 25; }
  // Extensive XMP edit history.
  const edits = (text.match(/stEvt:action/gi) || []).length;
  if (edits >= 3) { reasons.push('multiple-edit-history'); risk += 15; }

  // Missing camera origin on a JPEG. A bare "Exif\0\0" marker is NOT provenance
  // (it is trivially forgeable and carries no camera tags) — require real EXIF tag
  // names, so an empty/forged marker cannot cancel the penalty.
  const hasExif = /(\bMake\b|\bModel\b|DateTimeOriginal|GPSLatitude|GPSInfo|FNumber|ExposureTime|ISOSpeedRatings|LensModel)/i.test(text);
  if (type === 'jpeg' && !hasExif) { reasons.push('no-camera-metadata'); risk += 20; }
  // Metadata entirely stripped (common in generated / re-exported images).
  const hasAnyMeta = hasExif || /(xmlns|<x:xmpmeta|photoshop:|xpacket|tEXt|iTXt)/i.test(text);
  if (!hasAnyMeta) { reasons.push('metadata-stripped'); risk += 10; }

  return { reasons, risk: Math.min(100, risk), c2pa };
}

module.exports = { analyzeImage, AI_TOOL_RE, EDITOR_RE };

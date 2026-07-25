// @ts-check
// services/trust/detectors/image-forensics.js — in-house generative-image detector
// (AAV capability 'ai-image'). No third party, no ML model, no pixel decode.
//
// It parses the container's STRUCTURE — JPEG marker stream, PNG chunk stream, WEBP
// RIFF chunks — for the difference between a genuine CAMERA CAPTURE (EXIF Make/Model,
// a capture timestamp, an embedded thumbnail) and a SYNTHESISED / re-exported image
// (embedded generator parameters, an AI-tool signature, or wholesale-stripped
// metadata). Honest + fail-secure by construction:
//   · strong camera provenance            → low risk (can contribute to auto)
//   · a known generator signature/params  → high risk
//   · no provenance either way            → moderate risk (never faked clean, but
//                                            also never 'unknown' for a real image)
//   · a non-image (e.g. PDF) with no signature → unknown (cannot assess pixels)
// Absence of a signature is never treated as proof of authenticity — only positive
// camera provenance lowers risk.

const { sniff } = require('../file-guard');
const { AI_TOOL_RE } = require('../metadata-forensics');

// Generator fingerprints beyond the tool NAME: the parameter blocks that
// AUTOMATIC1111 (`parameters`), ComfyUI (`prompt`/`workflow` JSON) and NovelAI embed.
const GEN_TEXT_RE = /(stable[\s-]?diffusion|comfyui|automatic1111|invokeai|novelai|"sampler(_name)?"|"cfg[_\s]?scale"|"denoise"|\bsteps\s*:\s*\d+[\s,]+sampler|negative prompt\s*:)/i;
// Common camera makers — their ASCII appears verbatim in the EXIF IFD.
const CAMERA_RE = /\b(Canon|NIKON|SONY|SAMSUNG|Apple|iPhone|OnePlus|Xiaomi|Redmi|OPPO|vivo|realme|Google|Pixel|Motorola|Nokia|HUAWEI|HONOR|Panasonic|FUJIFILM|OLYMPUS|Leica|GoPro|DJI|Lenovo|ASUS)\b/;
// An EXIF capture timestamp: "YYYY:MM:DD HH:MM:SS".
const DATETIME_RE = /\b\d{4}:\d{2}:\d{2} \d{2}:\d{2}:\d{2}\b/;

const clamp = (/** @type {number} */ n) => Math.max(0, Math.min(100, Math.round(n)));

/** Does this EXIF/text region carry positive camera provenance? @param {string} t */
function hasCameraProvenance(t) { return CAMERA_RE.test(t) || DATETIME_RE.test(t); }

// ---- JPEG: walk the marker stream -----------------------------------------
/** @param {Buffer} buf */
function jpegStructure(buf) {
  const markers = new Set();
  let exifText = '', hasThumb = false, jfif = false, validTiff = false;
  let i = 2, guard = 0;
  const n = Math.min(buf.length, 6 * 1024 * 1024);
  while (i + 4 <= n && guard++ < 400) {
    if (buf[i] !== 0xFF) { i++; continue; }
    const m = buf[i + 1];
    if (m === 0xD8 || m === 0xD9 || m === 0x01 || (m >= 0xD0 && m <= 0xD7)) { i += 2; continue; } // standalone markers
    const len = (buf[i + 2] << 8) | buf[i + 3];
    if (len < 2) break;
    markers.add(m);
    const segStart = i + 4, segEnd = i + 2 + len;
    if (m === 0xE0) jfif = true;                                   // APP0 / JFIF
    if (m === 0xE1) {                                              // APP1 / EXIF or XMP
      const seg = buf.slice(segStart, Math.min(segEnd, buf.length));
      if (seg.slice(0, 6).toString('latin1') === 'Exif\x00\x00') {
        exifText += seg.toString('latin1');
        // A real EXIF block begins with the TIFF byte-order header ("II"+0x2A or
        // "MM"+0x2A). Requiring it makes a pasted-ASCII "Exif\0\0 Canon" forgery fail.
        const tiff = seg.slice(6, 10);
        if ((tiff[0] === 0x49 && tiff[1] === 0x49 && tiff[2] === 0x2A) || (tiff[0] === 0x4D && tiff[1] === 0x4D && tiff[3] === 0x2A)) validTiff = true;
        if (seg.indexOf(Buffer.from([0xFF, 0xD8, 0xFF]), 6) > 0) hasThumb = true;  // embedded thumbnail JPEG
      } else { exifText += seg.toString('latin1'); }              // XMP lives here too
    }
    if (m === 0xDA) break;                                         // SOS — pixel data begins
    i = segEnd;
  }
  return { markers, exifText, hasThumb, jfif, validTiff };
}

/** @param {Buffer} buf @param {boolean} genSig */
function jpegVerdict(buf, genSig) {
  const { exifText, hasThumb, jfif, validTiff } = jpegStructure(buf);
  if (genSig) return { risk: 95, hardFail: true, reasons: ['generator-signature'] };
  const hasExif = exifText.length > 0;
  // Only a WELL-FORMED EXIF (valid TIFF header) carrying camera provenance earns the
  // auto-eligible low band — a bare or pasted marker does not.
  const prov = validTiff && hasCameraProvenance(exifText);
  if (prov && hasThumb) return { risk: 5, reasons: ['camera-provenance', 'thumbnail'] };
  if (prov) return { risk: 12, reasons: ['camera-provenance'] };
  if (hasExif) return { risk: 30, reasons: ['exif-without-valid-provenance'] };
  if (jfif) return { risk: 40, reasons: ['jfif-only-no-exif'] };
  return { risk: 48, reasons: ['no-provenance'] };
}

// ---- PNG: walk the chunk stream -------------------------------------------
/** @param {Buffer} buf */
function pngStructure(buf) {
  let textBlob = '', hasExif = false, hasText = false;
  let i = 8, guard = 0;
  while (i + 8 <= buf.length && guard++ < 2000) {
    const len = buf.readUInt32BE(i);
    if (len < 0 || i + 12 + len > buf.length + 4) break;
    const type = buf.slice(i + 4, i + 8).toString('latin1');
    if (type === 'tEXt' || type === 'iTXt' || type === 'zTXt') { hasText = true; textBlob += buf.slice(i + 8, Math.min(i + 8 + Math.min(len, 65536), buf.length)).toString('latin1'); }
    if (type === 'eXIf') { hasExif = true; textBlob += buf.slice(i + 8, Math.min(i + 8 + Math.min(len, 65536), buf.length)).toString('latin1'); }
    if (type === 'IEND') break;
    i += 12 + len;                                                 // length + type + data + CRC
  }
  return { textBlob, hasExif, hasText };
}

/** @param {Buffer} buf @param {boolean} genSig */
function pngVerdict(buf, genSig) {
  const { textBlob, hasExif, hasText } = pngStructure(buf);
  if (genSig || GEN_TEXT_RE.test(textBlob) || AI_TOOL_RE.test(textBlob)) return { risk: 95, hardFail: true, reasons: ['generator-metadata'] };
  if (hasExif && hasCameraProvenance(textBlob)) return { risk: 15, reasons: ['png-exif-provenance'] };
  if (!hasText && !hasExif) return { risk: 45, reasons: ['metadata-stripped'] };
  return { risk: 32, reasons: ['no-camera-provenance'] };
}

// ---- WEBP: scan RIFF chunks -----------------------------------------------
/** @param {Buffer} buf @param {string} head @param {boolean} genSig */
function webpVerdict(buf, head, genSig) {
  if (genSig) return { risk: 95, hardFail: true, reasons: ['generator-signature'] };
  const hasExif = buf.indexOf(Buffer.from('EXIF')) > 0 || buf.indexOf(Buffer.from('Exif')) > 0;
  if (hasExif && hasCameraProvenance(head)) return { risk: 15, reasons: ['webp-exif-provenance'] };
  const hasXmp = buf.indexOf(Buffer.from('XMP ')) > 0;
  if (!hasExif && !hasXmp) return { risk: 45, reasons: ['metadata-stripped'] };
  return { risk: 35, reasons: ['no-camera-provenance'] };
}

/**
 * @param {Buffer} buf
 * @returns {{ risk:number, unknown?:boolean, hardFail?:boolean, reasons:string[] }}
 */
function detectGenerativeImage(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return { risk: 60, unknown: true, reasons: ['too-small-to-assess'] };
  const type = sniff(buf);
  const head = buf.slice(0, Math.min(buf.length, 262144)).toString('latin1');
  const genSig = AI_TOOL_RE.test(head) || GEN_TEXT_RE.test(head);
  let out;
  if (type === 'jpeg') out = jpegVerdict(buf, genSig);
  else if (type === 'png') out = pngVerdict(buf, genSig);
  else if (type === 'webp') out = webpVerdict(buf, head, genSig);
  // A document whose own bytes declare an AI generator is not a genuine capture —
  // reject it, whatever the container.
  else if (genSig) out = { risk: 95, hardFail: true, reasons: ['generator-signature-in-non-image'] };
  else return { risk: 0, unknown: true, reasons: ['not-an-image'] };                      // cannot assess rendered pixels
  return { risk: clamp(out.risk), hardFail: !!out.hardFail, reasons: out.reasons };
}

module.exports = { detectGenerativeImage, hasCameraProvenance, GEN_TEXT_RE, CAMERA_RE };

// tests/trust-detectors.test.js — the in-house AAV detectors (Phase 4).
// Security-critical: real, no-third-party detectors for ai-image / malware / ip-intel,
// the end-to-end proof that with them armed the engine DECIDES on its own while
// staying fail-secure, and regressions for the adversarial-review findings (forged
// EXIF cannot auto-approve; a confirmed generator rejects; a 4-byte magic colliding
// in pixel data does not false-reject a legitimate image).

const { detectGenerativeImage } = require('../src/services/trust/detectors/image-forensics');
const { scanMalware } = require('../src/services/trust/detectors/malware-scan');
const { assessIp, classifyV4 } = require('../src/services/trust/detectors/ip-intel');
const providers = require('../src/services/trust/providers');
const { registerBuiltins, _resetRegistered } = require('../src/services/trust/detectors');
const { evaluateDocument } = require('../src/services/trust');

// Minimal container builders.
const JPEG = (extra = '') => Buffer.concat([Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]), Buffer.from(extra, 'latin1')]);
const PNG = (extra = '') => Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), Buffer.from(extra, 'latin1')]);
const PDF = (extra = '') => Buffer.concat([Buffer.from('%PDF-1.4\n', 'latin1'), Buffer.from(extra, 'latin1')]);

// A JPEG carrying a WELL-FORMED EXIF (TIFF "II*" header) with camera provenance —
// what a genuine capture looks like structurally.
function camJpeg(camera = 'Make Canon Model EOS 90D DateTimeOriginal 2021:07:01 09:00:00') {
  const exif = Buffer.concat([Buffer.from('Exif\x00\x00', 'latin1'), Buffer.from([0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00]), Buffer.from(camera, 'latin1')]);
  const len = exif.length + 2;
  const app1 = Buffer.concat([Buffer.from([0xFF, 0xE1, (len >> 8) & 0xFF, len & 0xFF]), exif]);
  return Buffer.concat([Buffer.from([0xFF, 0xD8]), app1, Buffer.from([0xFF, 0xD9])]);   // SOI + APP1 + EOI
}
// A PNG carrying a real tEXt chunk.
function pngWithText(keyword, text) {
  const data = Buffer.from(keyword + '\x00' + text, 'latin1');
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const chunk = Buffer.concat([len, Buffer.from('tEXt'), data, Buffer.alloc(4)]);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), chunk]);
}
// A structurally-valid PNG with an IHDR but no text/metadata (a stripped image).
function plainPng() {
  const ihdr = Buffer.concat([Buffer.from([0, 0, 0, 13]), Buffer.from('IHDR'), Buffer.alloc(13), Buffer.alloc(4)]);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), ihdr]);
}
// A plausible (corroborated) ELF header.
const ELF_HEADER = Buffer.from([0x7F, 0x45, 0x4C, 0x46, 0x02, 0x01, 0x01, 0x00]);

afterEach(() => { providers._reset(); _resetRegistered(); });

describe('ai-image detector (structural forensics)', () => {
  test('a JPEG with WELL-FORMED EXIF camera provenance is low-risk (auto-eligible)', () => {
    const r = detectGenerativeImage(camJpeg());
    expect(r.risk).toBeLessThan(25);
    expect(r.unknown).toBeFalsy();
  });
  test('a bare/forged EXIF marker with no valid TIFF header is NOT low-risk', () => {
    const forged = JPEG('Exif\x00\x00 Canon EOS DateTimeOriginal 2021:01:01 00:00:00');  // pasted ASCII, no TIFF
    expect(detectGenerativeImage(forged).risk).toBeGreaterThanOrEqual(25);               // cannot ride to auto
  });
  test('a generator parameters chunk hard-fails', () => {
    const r = detectGenerativeImage(pngWithText('parameters', 'a portrait, Steps: 30, Sampler: Euler a, CFG scale: 7, Seed: 12345'));
    expect(r.hardFail).toBe(true);
  });
  test('an AI-tool signature hard-fails even in a JPEG', () => {
    expect(detectGenerativeImage(JPEG('CreatorTool Midjourney v6')).hardFail).toBe(true);
  });
  test('a metadata-stripped image is moderate (never faked clean, never auto)', () => {
    const r = detectGenerativeImage(plainPng());
    expect(r.risk).toBeGreaterThanOrEqual(40);
    expect(r.risk).toBeLessThan(70);
    expect(r.hardFail).toBeFalsy();
  });
  test('a non-image (clean PDF) is unknown — cannot assess rendered pixels', () => {
    expect(detectGenerativeImage(PDF('just text')).unknown).toBe(true);
  });
});

describe('malware detector (deep whole-buffer scan)', () => {
  test('a corroborated ELF binary appended to an image hard-fails', () => {
    const r = scanMalware(Buffer.concat([camJpeg(), ELF_HEADER, Buffer.alloc(16)]));
    expect(r.hardFail).toBe(true);
    expect(r.reasons).toContain('elf-binary');
  });
  test('an UNCORROBORATED 4-byte magic inside pixel data does NOT false-reject', () => {
    // ELF magic + zeros (not a real header), sitting before the JPEG EOI.
    const buf = Buffer.concat([Buffer.from([0xFF, 0xD8]), Buffer.from([0x7F, 0x45, 0x4C, 0x46]), Buffer.alloc(8), Buffer.from([0xFF, 0xD9])]);
    expect(scanMalware(buf).hardFail).toBe(false);
  });
  test('a PE payload, VBA macro, and EICAR string hard-fail', () => {
    expect(scanMalware(Buffer.concat([PNG(), Buffer.from('..This program cannot be run in DOS mode..')])).hardFail).toBe(true);
    expect(scanMalware(Buffer.concat([PDF(), Buffer.from('vbaProject.bin')])).hardFail).toBe(true);
    expect(scanMalware(Buffer.from('X5O!P%@AP EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*')).hardFail).toBe(true);
  });
  test('a clean image scans to risk 0 (no known-bad pattern)', () => {
    const r = scanMalware(camJpeg());
    expect(r.risk).toBe(0);
    expect(r.hardFail).toBe(false);
  });
});

describe('ip-intel detector (structural classification)', () => {
  test('a normal public IP has no adverse signal', () => {
    expect(assessIp('49.207.12.34').risk).toBe(0);
    expect(classifyV4([49, 207, 12, 34])).toBe('public');
  });
  test('private / loopback / link-local are anomalous for a real upload', () => {
    expect(assessIp('10.0.0.5').risk).toBeGreaterThan(0);
    expect(assessIp('127.0.0.1').risk).toBeGreaterThan(0);
    expect(assessIp('169.254.1.1').risk).toBeGreaterThan(0);
    expect(assessIp('::1').risk).toBeGreaterThan(0);
  });
  test('IPv4-mapped IPv6 is unwrapped; a missing IP is unknown', () => {
    expect(assessIp('::ffff:8.8.8.8').risk).toBe(0);
    expect(assessIp(undefined).unknown).toBe(true);
  });
});

describe('end-to-end: the engine decides in-house (fail-secure)', () => {
  test('with detectors armed, a genuine camera photo from a public IP can auto-approve', async () => {
    registerBuiltins();
    const r = await evaluateDocument(camJpeg(), { filename: 'id.jpg', ip: '49.207.12.34' });
    expect(r.decision).toBe('auto');
  });
  test('an AI-generated image cannot auto-approve (it is rejected)', async () => {
    registerBuiltins();
    const buf = pngWithText('parameters', 'Steps: 20, Sampler: Euler, CFG scale: 7, Seed: 1 Stable Diffusion');
    const r = await evaluateDocument(buf, { filename: 'id.png', ip: '49.207.12.34' });
    expect(r.decision).not.toBe('auto');
  });
  test('CRITICAL regression: a forged bare-EXIF image cannot ride structural signals to auto', async () => {
    registerBuiltins();
    const forged = JPEG('Exif\x00\x00 Canon EOS DateTimeOriginal 2021:01:01 00:00:00 synthetic bytes');
    const r = await evaluateDocument(forged, { filename: 'id.jpg', ip: '49.207.12.34' });
    expect(r.decision).not.toBe('auto');
  });
  test('with detectors armed, a polyglot with an embedded binary is rejected', async () => {
    registerBuiltins();
    const buf = Buffer.concat([camJpeg(), ELF_HEADER, Buffer.alloc(16)]);
    const r = await evaluateDocument(buf, { filename: 'id.jpg', ip: '49.207.12.34' });
    expect(r.decision).toBe('reject');
    expect(r.hardFail).toBe(true);
  });
  test('an anomalous source IP measurably lowers the trust score (graduated, not a hard veto)', async () => {
    registerBuiltins();
    const pub = await evaluateDocument(camJpeg(), { filename: 'id.jpg', ip: '49.207.12.34' });
    const priv = await evaluateDocument(camJpeg(), { filename: 'id.jpg', ip: '10.0.0.9' });
    expect(priv.score).toBeLessThan(pub.score);
  });
});

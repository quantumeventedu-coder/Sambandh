// tests/trust-engine.test.js — adversarial + unit tests for the AAV Trust Engine.
// Security-critical: exercises the fraud paths (executables, polyglots, PDF-JS,
// MIME lies, AI-generated metadata) and the fail-secure invariants (unknown
// detectors can't auto-approve; no evidence → reject; hard-fail always rejects).

const { inspectFile, sniff } = require('../src/services/trust/file-guard');
const { analyzeImage } = require('../src/services/trust/metadata-forensics');
const risk = require('../src/services/trust/risk-engine');
const providers = require('../src/services/trust/providers');
const { evaluateDocument } = require('../src/services/trust');

const JPEG = (extra = '') => Buffer.concat([Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]), Buffer.from(extra, 'latin1')]);
const PNG = (extra = '') => Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), Buffer.from(extra, 'latin1')]);
const PDF = (extra = '') => Buffer.concat([Buffer.from('%PDF-1.4\n', 'latin1'), Buffer.from(extra, 'latin1')]);

afterEach(() => providers._reset());

describe('file-guard (Layer 11/12)', () => {
  test('accepts a clean JPEG / PNG / PDF', () => {
    expect(inspectFile(JPEG('camera bytes')).type).toBe('jpeg');
    expect(inspectFile(PNG('data')).ok).toBe(true);
    expect(inspectFile(PDF('clean text')).ok).toBe(true);
    expect(sniff(JPEG())).toBe('jpeg');
  });
  test('empty / unrecognised bytes hard-fail', () => {
    expect(inspectFile(Buffer.alloc(0)).hardFail).toBe(true);
    expect(inspectFile(Buffer.from('random garbage bytes')).reasons).toContain('unrecognised-header');
  });
  test('windows executable (MZ) hard-fails', () => {
    const r = inspectFile(Buffer.from('MZ\x90\x00\x03', 'latin1'));
    expect(r.hardFail).toBe(true);
    expect(r.reasons).toContain('windows-executable');
  });
  test('polyglot script smuggled behind an image header hard-fails', () => {
    const r = inspectFile(JPEG('<script>steal()</script>'));
    expect(r.reasons).toContain('polyglot-payload');
    expect(r.hardFail).toBe(true);
  });
  test('double extension and dangerous extension hard-fail', () => {
    expect(inspectFile(JPEG(), { filename: 'id.jpg.exe' }).reasons).toEqual(expect.arrayContaining(['double-extension', 'dangerous-extension']));
    expect(inspectFile(JPEG(), { filename: 'id.svg' }).hardFail).toBe(true);
  });
  test('declared MIME that lies about the bytes is flagged', () => {
    expect(inspectFile(JPEG(), { declaredMime: 'image/png' }).reasons).toContain('mime-mismatch');
  });
  test('PDF with JavaScript / auto-action / embedded file hard-fails', () => {
    expect(inspectFile(PDF('1 0 obj /JavaScript (app.alert)')).reasons).toContain('pdf-javascript');
    expect(inspectFile(PDF('/OpenAction 2 0 R')).reasons).toContain('pdf-auto-action');
    expect(inspectFile(PDF('/Launch /EmbeddedFile')).hardFail).toBe(true);
  });
  test('oversized file hard-fails', () => {
    const big = Buffer.concat([JPEG(), Buffer.alloc(13 * 1024 * 1024)]);
    expect(inspectFile(big).reasons).toContain('oversized');
  });
});

describe('metadata-forensics (Layer 3)', () => {
  test('AI-generator signature + diffusion parameters read as high risk', () => {
    const r = analyzeImage(PNG('tEXt parameters Steps: 20, Sampler: Euler, CFG scale: 7, Seed: 42 — Midjourney'), 'png');
    expect(r.reasons).toContain('ai-tool-signature');
    expect(r.reasons).toContain('diffusion-parameters');
    expect(r.risk).toBeGreaterThanOrEqual(70);
  });
  test('a JPEG with no camera metadata is penalised', () => {
    expect(analyzeImage(JPEG('no exif here'), 'jpeg').reasons).toContain('no-camera-metadata');
  });
  test('a genuine camera JPEG (Exif Make/Model) is clean', () => {
    const r = analyzeImage(JPEG('Exif\x00\x00 Make Canon Model EOS DateTimeOriginal 2020:01:01'), 'jpeg');
    expect(r.reasons).not.toContain('no-camera-metadata');
    expect(r.risk).toBe(0);
  });
  test('C2PA / Content Credentials provenance is detected', () => {
    expect(analyzeImage(PNG('c2pa manifest jumbf'), 'png').c2pa).toBe(true);
  });
});

describe('risk-engine (Layer 15) — fail secure', () => {
  test('no signals at all → reject, score 0', () => {
    expect(risk.score([]).decision).toBe('reject');
    expect(risk.score([]).score).toBe(0);
  });
  test('a hard-fail signal rejects regardless of an otherwise clean set', () => {
    const r = risk.score([{ name: 'file', risk: 0, hardFail: true }, { name: 'meta', risk: 0 }]);
    expect(r.decision).toBe('reject');
  });
  test('an UNKNOWN signal blocks auto-approve even when everything else is clean', () => {
    const r = risk.score([{ name: 'file', risk: 0 }, { name: 'ai', risk: 0, unknown: true }]);
    expect(r.decision).not.toBe('auto');
    expect(r.anyUnknown).toBe(true);
  });
  test('all-clean, all-present signals can reach auto', () => {
    const r = risk.score([{ name: 'file', risk: 0, weight: 2 }, { name: 'meta', risk: 0, weight: 2 }, { name: 'ai', risk: 0 }, { name: 'malware', risk: 0 }]);
    expect(r.decision).toBe('auto');
    expect(r.score).toBe(1000);
  });
  test('unknown risk is floored at UNKNOWN_FLOOR', () => {
    expect(risk.score([{ name: 'x', risk: 0, unknown: true }]).factors.x.risk).toBe(risk.UNKNOWN_FLOOR);
  });
});

describe('providers (fail-secure registry, no fakes)', () => {
  test('an unconfigured capability returns unknown (never a pass)', async () => {
    expect(await providers.run('ai-image', {})).toEqual(expect.objectContaining({ unknown: true }));
  });
  test('a registered detector returns its clamped risk', async () => {
    providers.register('ai-image', async () => ({ risk: 80 }));
    expect((await providers.run('ai-image', {})).risk).toBe(80);
  });
  test('a throwing detector fails secure (unknown + elevated risk)', async () => {
    providers.register('malware', async () => { throw new Error('vendor down'); });
    const r = await providers.run('malware', {});
    expect(r.unknown).toBe(true);
    expect(r.risk).toBe(60);
  });
});

describe('edge branches (coverage of every path)', () => {
  test('editing software, heavy edit history, and stripped metadata each register', () => {
    expect(analyzeImage(PNG('Adobe Photoshop 2024'), 'png').reasons).toContain('editing-software');
    expect(analyzeImage(JPEG('Exif Make X stEvt:action a stEvt:action b stEvt:action c'), 'jpeg').reasons).toContain('multiple-edit-history');
    expect(analyzeImage(PNG(''), 'png').reasons).toContain('metadata-stripped');
  });
  test('PDF /Encrypt is a soft flag; WEBP confirmed by tag; GIF recognised but not allowed', () => {
    expect(inspectFile(PDF('/Encrypt 5 0 R')).reasons).toContain('pdf-encrypted');
    const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBP')]);
    expect(sniff(webp)).toBe('webp');
    const riffNotWebp = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('AVI ')]);
    expect(sniff(riffNotWebp)).toBe(null);
    expect(inspectFile(Buffer.from('GIF89a data')).reasons).toContain('type-not-allowed:gif');
  });
  test('risk-engine: null weight defaults to 1; zero-weight signal does not drag the score', () => {
    const r = risk.score([{ name: 'a', risk: 100, weight: 0 }, { name: 'b', risk: 0 }]);
    expect(r.score).toBeGreaterThan(risk.BANDS.SECONDARY);
  });
});

describe('orchestrator (evaluateDocument) — end to end', () => {
  test('a clean image with NO detectors configured cannot auto-approve', async () => {
    const r = await evaluateDocument(JPEG('Exif\x00\x00 Make Canon Model EOS'), { filename: 'id.jpg' });
    expect(r.decision).not.toBe('auto');
    expect(r.fileType).toBe('jpeg');
    expect(r.evidenceHash).toMatch(/^[a-f0-9]{64}$/);
  });
  test('an uploaded executable is rejected outright', async () => {
    const r = await evaluateDocument(Buffer.from('MZ\x90\x00 payload', 'latin1'), { filename: 'photo.jpg' });
    expect(r.decision).toBe('reject');
    expect(r.hardFail).toBe(true);
  });
  test('an AI-generated document (tool metadata) does not auto-approve', async () => {
    const r = await evaluateDocument(PNG('parameters Steps: 30 Seed: 9 Stable Diffusion'), { filename: 'id.png' });
    expect(r.decision).not.toBe('auto');
    expect(r.signals.metadata.risk).toBeGreaterThan(0);
  });
  test('with real detectors registered and clean, a genuine document can auto-approve', async () => {
    providers.register('ai-image', async () => ({ risk: 2 }));
    providers.register('malware', async () => ({ risk: 0 }));
    providers.register('ip-intel', async () => ({ risk: 0 }));
    const r = await evaluateDocument(JPEG('Exif\x00\x00 Make Canon Model EOS DateTimeOriginal 2021'), { filename: 'id.jpg' });
    expect(r.decision).toBe('auto');
  });
});

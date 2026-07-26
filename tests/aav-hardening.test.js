// tests/aav-hardening.test.js — AAV scanner hardening from the KYB security review:
// whole-PDF active-content scan, and appended/crafted Windows-PE detection.

const { inspectFile } = require('../src/services/trust/file-guard');
const { scanMalware } = require('../src/services/trust/detectors/malware-scan');

describe('file-guard: PDF active content beyond the first 256 KB', () => {
  test('a malicious PDF with /OpenAction /JavaScript placed past 256 KB is hard-failed', () => {
    const pdf = Buffer.concat([
      Buffer.from('%PDF-1.4\n'),
      Buffer.alloc(300 * 1024, 0x20),   // 300 KB of padding pushes the payload past the old cap
      Buffer.from('\n<< /OpenAction << /S /JavaScript /JS (app.alert(1)) >> >>\n%%EOF')
    ]);
    const r = inspectFile(pdf, { filename: 'gst.pdf' });
    expect(r.hardFail).toBe(true);
    expect(r.reasons.some((x) => /pdf-(javascript|auto-action)/.test(x))).toBe(true);
  });
});

describe('malware-scan: Windows PE detection', () => {
  const IEND = Buffer.from('0000000049454e44ae426082', 'hex');   // PNG IEND chunk
  const PNGHEAD = Buffer.from('89504e470d0a1a0a', 'hex');

  test('a PE appended after the image end is hard-failed (windows-executable)', () => {
    const pe = Buffer.alloc(0x48, 0);
    pe[0] = 0x4D; pe[1] = 0x5A;                 // MZ
    pe.writeUInt32LE(0x40, 0x3C);               // e_lfanew → 0x40
    pe[0x40] = 0x50; pe[0x41] = 0x45;           // 'PE'
    const buf = Buffer.concat([PNGHEAD, IEND, pe]);
    const r = scanMalware(buf);
    expect(r.hardFail).toBe(true);
    expect(r.reasons).toContain('windows-executable');
  });

  test('a lone MZ inside image content (no valid PE header) is only a soft risk', () => {
    const body = Buffer.alloc(200, 0); body[50] = 0x4D; body[51] = 0x5A;   // MZ in pixel data, no PE header
    const buf = Buffer.concat([PNGHEAD, body, IEND]);
    const r = scanMalware(buf);
    expect(r.hardFail).toBe(false);
  });
});

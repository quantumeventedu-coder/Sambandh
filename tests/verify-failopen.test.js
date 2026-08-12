// tests/verify-failopen.test.js — selfie/ID verification must FAIL CLOSED in production. DEV_MODE
// simulates approvals locally; it must be impossible in production (an in-house platform normally
// has no OCR/face provider key, and inferring DEV_MODE there would auto-approve any selfie — a
// verification fail-OPEN / identity-spoofing hole). Mirrors auth-failopen.test.js for the OTP path.

describe('verify-engine fails CLOSED in production', () => {
  const OLD_ENV = process.env.NODE_ENV;
  afterEach(() => { process.env.NODE_ENV = OLD_ENV; jest.resetModules(); });

  test('decideSelfie THROWS in production even with DEV_MODE=true — never simulates an approval', async () => {
    process.env.NODE_ENV = 'production';                 // forces isProduction → DEV_MODE false
    jest.resetModules();
    const engine = require('../src/services/verify-engine');
    await expect(engine.decideSelfie(Buffer.from([0xFF, 0xD8, 0, 0]), null)).rejects.toThrow();
  });

  test('decideIdDocument THROWS in production (no simulated OCR extraction)', async () => {
    process.env.NODE_ENV = 'production';
    jest.resetModules();
    const engine = require('../src/services/verify-engine');
    await expect(engine.decideIdDocument({ profile: { firstName: 'A' } }, Buffer.from([0xFF, 0xD8]), 'aadhaar', 'x.jpg')).rejects.toThrow();
  });

  test('in dev (not production) the simulation still approves a valid selfie — the flow works locally', async () => {
    process.env.NODE_ENV = 'test';                       // DEV_MODE=true from env-setup + not prod
    jest.resetModules();
    const engine = require('../src/services/verify-engine');
    expect((await engine.decideSelfie(Buffer.from([0xFF, 0xD8, 0, 0]), null)).approved).toBe(true);
  });
});

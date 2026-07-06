// Tests for self-built 2FA (TOTP RFC 6238 + backup codes) — no libraries.

const t = require('../src/services/twofa');

describe('TOTP', () => {
  test('a freshly-generated code verifies, a wrong one does not', () => {
    const secret = t.generateTotpSecret();
    expect(t.verifyTotp(secret, t.currentTotp(secret))).toBe(true);
    expect(t.verifyTotp(secret, '000000')).toBe(false);
    expect(t.verifyTotp(secret, 'abc')).toBe(false);
    expect(t.verifyTotp(secret, '')).toBe(false);
  });

  test('a code from a different secret does not verify', () => {
    const a = t.generateTotpSecret(), b = t.generateTotpSecret();
    expect(t.verifyTotp(a, t.currentTotp(b))).toBe(false);
  });

  test('secret is base32 and the otpauth URI is well-formed', () => {
    const secret = t.generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]+$/);
    const uri = t.otpauthUri(secret, 'user@example.com', 'Sambandh');
    expect(uri).toMatch(/^otpauth:\/\/totp\/Sambandh:/);
    expect(uri).toContain('secret=' + secret);
    expect(uri).toContain('algorithm=SHA1');
    expect(t.formatSecret(secret)).toContain(' '); // grouped for readability
  });

  test('matches the RFC 6238 SHA-1 reference vector', () => {
    // Secret "12345678901234567890" (ASCII) base32-encoded; at t=59s the code is 287082.
    const secretB32 = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'; // base32 of the ASCII seed
    const realNow = Date.now;
    Date.now = () => 59 * 1000;
    try { expect(t.verifyTotp(secretB32, '287082', 0)).toBe(true); }
    finally { Date.now = realNow; }
  });
});

describe('backup codes', () => {
  test('generates one-time codes, verifies the right one, rejects others', () => {
    const { plain, stored } = t.generateBackupCodes(10);
    expect(plain).toHaveLength(10);
    expect(plain[0]).toMatch(/^[0-9A-F]{5}-[0-9A-F]{5}$/);
    expect(t.matchBackupCode(plain[3], stored)).toBe(3);
    expect(t.matchBackupCode('ZZZZZ-ZZZZZ', stored)).toBe(-1);
  });

  test('a used code is not matched again', () => {
    const { plain, stored } = t.generateBackupCodes(3);
    const idx = t.matchBackupCode(plain[0], stored);
    stored[idx].usedAt = new Date();               // mark used
    expect(t.matchBackupCode(plain[0], stored)).toBe(-1);
  });
});

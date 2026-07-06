// Tests for the self-built WebAuthn primitives (base64url, CBOR, COSE->JWK,
// authenticatorData parsing). The full register/authenticate flow needs a real
// browser authenticator, so we test the deterministic building blocks here.

const wa = require('../src/services/webauthn');

describe('base64url', () => {
  test('round-trips arbitrary bytes', () => {
    const buf = Buffer.from([0, 1, 2, 250, 251, 252, 253, 254, 255]);
    expect(wa.b64urlToBuf(wa.b64url(buf)).equals(buf)).toBe(true);
  });
  test('produces URL-safe output (no +, /, =)', () => {
    const s = wa.b64url(Buffer.from([0xfb, 0xff, 0xfe, 0xfd]));
    expect(s).not.toMatch(/[+/=]/);
  });
});

describe('CBOR decoder', () => {
  test('decodes small ints, negative ints, byte strings, text, arrays, maps', () => {
    expect(wa.cborDecodeFirst(Buffer.from([0x0a])).value).toBe(10);          // uint 10
    expect(wa.cborDecodeFirst(Buffer.from([0x20])).value).toBe(-1);          // negative -1
    expect(wa.cborDecodeFirst(Buffer.from([0x42, 0xaa, 0xbb])).value.equals(Buffer.from([0xaa, 0xbb]))).toBe(true); // bytes
    expect(wa.cborDecodeFirst(Buffer.from([0x63, 0x61, 0x62, 0x63])).value).toBe('abc'); // text "abc"
    expect(wa.cborDecodeFirst(Buffer.from([0x82, 0x01, 0x02])).value).toEqual([1, 2]);   // array [1,2]
    const m = wa.cborDecodeFirst(Buffer.from([0xa1, 0x01, 0x02])).value;     // map {1:2}
    expect(m.get(1)).toBe(2);
  });
  test('decodes 2-byte and 4-byte length prefixes', () => {
    // uint 25 (0x19) followed by 0x01 0x00 = 256
    expect(wa.cborDecodeFirst(Buffer.from([0x19, 0x01, 0x00])).value).toBe(256);
  });
});

describe('COSE -> JWK', () => {
  test('converts an EC2 P-256 COSE key to an EC JWK', () => {
    const x = Buffer.alloc(32, 1), y = Buffer.alloc(32, 2);
    const cose = new Map([[1, 2], [3, -7], [-1, 1], [-2, x], [-3, y]]); // kty EC2, alg ES256, crv P-256
    const { jwk, alg } = wa.coseToJwk(cose);
    expect(alg).toBe(-7);
    expect(jwk.kty).toBe('EC');
    expect(jwk.crv).toBe('P-256');
    expect(jwk.x).toBe(wa.b64url(x));
  });
});

describe('authenticatorData parsing', () => {
  test('parses rpIdHash, flags and counter', () => {
    const ad = Buffer.alloc(37);
    Buffer.from('rp-id-hash-32-bytes-aaaaaaaaaaaa').copy(ad, 0); // 32-byte rpIdHash region
    ad[32] = 0x05;                 // flags: UP (0x01) + UV (0x04)
    ad.writeUInt32BE(42, 33);      // counter
    const p = wa.parseAuthData(ad);
    expect(p.up).toBe(true);
    expect(p.uv).toBe(true);
    expect(p.at).toBe(false);      // no attested credential
    expect(p.counter).toBe(42);
  });
});

describe('challenge + options', () => {
  test('newChallenge is base64url and unique', () => {
    const a = wa.newChallenge(), b = wa.newChallenge();
    expect(a).not.toMatch(/[+/=]/);
    expect(a).not.toBe(b);
    expect(wa.b64urlToBuf(a).length).toBe(32);
  });
  test('rpFromRequest derives rpId from the Origin header', () => {
    const { origin, rpId } = wa.rpFromRequest({ headers: { origin: 'https://sambandh.app' } });
    expect(origin).toBe('https://sambandh.app');
    expect(rpId).toBe('sambandh.app');
  });
});

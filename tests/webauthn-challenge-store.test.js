// tests/webauthn-challenge-store.test.js — the passkey challenge store must PERSIST across requests
// (single-use, TTL) so the two-request WebAuthn handshake works on serverless, where an in-process Map was
// lost between options→verify. Guards the fix for the "Challenge expired" passkey failure on Vercel.

const db = require('./helpers/pg-db');
const { putChallenge, takeChallenge } = require('../src/services/webauthn-challenge-store');
const WebauthnChallenge = require('../src/models/WebauthnChallenge');

beforeAll(db.start);
afterAll(db.stop);
afterEach(db.clear);

describe('webauthn-challenge-store', () => {
  test('put then take returns the challenge exactly once (single-use)', async () => {
    await putChallenge('reg:u1', { challenge: 'abc', origin: 'https://x.test', rpId: 'x.test' });
    expect(await takeChallenge('reg:u1')).toEqual({ challenge: 'abc', origin: 'https://x.test', rpId: 'x.test' });
    expect(await takeChallenge('reg:u1')).toBeNull();          // consumed — cannot be replayed
  });

  test('a missing key returns null', async () => {
    expect(await takeChallenge('login:does-not-exist')).toBeNull();
  });

  test('an expired challenge returns null (and does not verify)', async () => {
    await WebauthnChallenge.create({ key: 'login:old', challenge: 'z', expiresAt: new Date(Date.now() - 1000) });
    expect(await takeChallenge('login:old')).toBeNull();
  });

  test('re-putting the same key replaces it (upsert, no duplicate rows)', async () => {
    await putChallenge('reg:u2', { challenge: 'one', origin: 'o', rpId: 'r' });
    await putChallenge('reg:u2', { challenge: 'two', origin: 'o', rpId: 'r' });
    expect((await takeChallenge('reg:u2')).challenge).toBe('two');
    expect(await WebauthnChallenge.countDocuments({ key: 'reg:u2' })).toBe(0);   // consumed, single row
  });
});

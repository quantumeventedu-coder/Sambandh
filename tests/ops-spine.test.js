// tests/ops-spine.test.js — Batch 7 spine: PII-safe structured logging, the
// error taxonomy, and DB-aware readiness. The redaction tests are the DPDP guard:
// personal data must never reach a log line.

const { redact, scrubString, PII_KEYS } = require('../src/lib/logger');
const errs = require('../src/lib/errors');
const { dbHealthy } = require('../src/lib/health');

describe('PII redaction (DPDP: no personal data in logs)', () => {
  test('censors sensitive keys at any depth, keeps innocent ones', () => {
    const out = redact({
      name: 'Asha',                        // innocent → kept
      email: 'asha@example.com',
      password: 'hunter2',
      user: { phone: '+91 98765 43210', token: 'abc.def.ghi', city: 'Pune' },
      astrology: { birthDate: '1992-04-10', birthTime: '08:30', birthPlace: { lat: 19, lng: 72 } }
    });
    expect(out.name).toBe('Asha');
    expect(out.user.city).toBe('Pune');
    expect(out.email).toBe('[redacted]');
    expect(out.password).toBe('[redacted]');
    expect(out.user.phone).toBe('[redacted]');
    expect(out.user.token).toBe('[redacted]');
    expect(out.astrology.birthDate).toBe('[redacted]');
    expect(out.astrology.birthPlace).toBe('[redacted]');   // whole birthPlace object censored (key match)
  });

  test('every declared PII key is actually censored', () => {
    for (const k of PII_KEYS) {
      const out = redact({ [k]: 'SECRET-VALUE' });
      expect(out[k]).toBe('[redacted]');
    }
  });

  test('scrubs value-shaped PII embedded in free-text strings', () => {
    expect(scrubString('mail me at asha@example.com now')).toBe('mail me at [email] now');
    expect(scrubString('OTP sent to +91 98765 43210')).toContain('[phone]');
    expect(scrubString('bearer eyJhbGciOi.J9payloadxx.sigsigsigsig here'))
      .toContain('[token]');
    expect(scrubString('img data:image/png;base64,QUJDREVGR0hJSktMTU5PUFFSU1RVVg=='))
      .toContain('[image]');
  });

  test('a full base64 photo never survives into a log payload', () => {
    const big = 'data:image/jpeg;base64,' + 'A'.repeat(50000);
    const out = redact({ selfie: big, note: 'here is my photo ' + big });
    expect(out.selfie).toBe('[redacted]');                       // key match wins
    expect(out.note).not.toContain('base64,AAAA');               // value scrubbed too
    expect(JSON.stringify(out).length).toBeLessThan(3000);       // no blob smuggled through
  });

  test('handles cycles, depth and non-serialisable values without throwing', () => {
    const a = { name: 'x' }; a.self = a;                         // cycle
    expect(() => redact(a)).not.toThrow();
    expect(redact(a).self).toBe('[circular]');
    const deep = { a: { b: { c: { d: { e: { f: { g: 1 } } } } } } };
    expect(JSON.stringify(redact(deep))).toContain('[truncated]');
    expect(redact({ fn: () => {}, ok: 1 })).toEqual({ ok: 1 });  // functions dropped
  });
});

describe('error taxonomy → status + stable code', () => {
  test('typed errors carry the right status, code and expose flag', () => {
    expect(errs.normalize(new errs.ValidationError('bad'))).toMatchObject({ status: 400, code: 'validation', expose: true });
    expect(errs.normalize(new errs.AuthError())).toMatchObject({ status: 401, code: 'unauthenticated' });
    expect(errs.normalize(new errs.ForbiddenError())).toMatchObject({ status: 403, code: 'forbidden' });
    expect(errs.normalize(new errs.NotFoundError('profile'))).toMatchObject({ status: 404, code: 'not_found', message: 'profile not found' });
    expect(errs.normalize(new errs.ConflictError())).toMatchObject({ status: 409, code: 'conflict' });
    expect(errs.normalize(new errs.RateLimitError())).toMatchObject({ status: 429, code: 'rate_limited' });
  });

  test('a raw 500 is masked — internal message never exposed', () => {
    const n = errs.normalize(new Error('DB password is p@ss in connection string'));
    expect(n.status).toBe(500);
    expect(n.expose).toBe(false);
  });

  test('recognises Zod, JWT and duplicate-key shapes', () => {
    expect(errs.normalize({ name: 'ZodError', issues: [{ path: ['email'], message: 'required' }] }))
      .toMatchObject({ status: 400, code: 'validation' });
    expect(errs.normalize({ name: 'TokenExpiredError' })).toMatchObject({ status: 401, code: 'unauthenticated' });
    expect(errs.normalize({ code: '23505' })).toMatchObject({ status: 409, code: 'conflict' });
    expect(errs.normalize({ code: 11000 })).toMatchObject({ status: 409, code: 'conflict' });
  });

  test('the handler masks 5xx bodies and echoes the reqId', () => {
    const handler = errs.errorHandler();
    let sent;
    const res = { headersSent: false, statusCode: 200,
      status(c) { this.statusCode = c; return this; }, json(b) { sent = b; return this; } };
    const log = { warn() {}, error() {} };
    handler(new Error('secret internal detail'), { log, reqId: 'req-1' }, res, () => {});
    expect(res.statusCode).toBe(500);
    expect(sent.error).toBe('Internal server error');            // internal detail hidden
    expect(sent.code).toBe('internal');
    expect(sent.reqId).toBe('req-1');

    handler(new errs.ValidationError('email is required'), { log, reqId: 'req-2' }, res, () => {});
    expect(res.statusCode).toBe(400);
    expect(sent.error).toBe('email is required');                // 4xx message is safe to show
  });
});

describe('DB-aware readiness', () => {
  test('prefers a real ping round-trip', async () => {
    expect(await dbHealthy({ ping: async () => true })).toBe(true);
    expect(await dbHealthy({ ping: async () => false })).toBe(false);
    expect(await dbHealthy({ ping: async () => { throw new Error('gone'); } })).toBe(false);
  });

  test('falls back to connection state when no ping exists', async () => {
    expect(await dbHealthy({ connection: { readyState: 1 } })).toBe(true);
    expect(await dbHealthy({ connection: { readyState: 0 } })).toBe(false);
  });
});

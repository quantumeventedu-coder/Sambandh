// tests/best-effort.test.js — bestEffort() never breaks the caller, but a failure is logged (observable),
// not swallowed silently. Proves the resolve/undefined contract, thunk-throw capture, and PII-safe logging.

const { logger } = require('../src/lib/logger');
const { bestEffort } = require('../src/services/best-effort');

describe('bestEffort', () => {
  test('resolves to the value on success and logs nothing', async () => {
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => logger);
    await expect(bestEffort(Promise.resolve(42), 'op:ok')).resolves.toBe(42);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  test('a rejected promise resolves to undefined and is LOGGED (not swallowed)', async () => {
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => logger);
    await expect(bestEffort(Promise.reject(new Error('boom')), { op: 'op:fail', userId: 'u1' })).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
    const [fields, msg] = warn.mock.calls[0];
    expect(msg).toMatch(/best-effort/);
    expect(fields).toMatchObject({ op: 'op:fail', userId: 'u1', err: 'boom' });
    warn.mockRestore();
  });

  test('a thunk that throws synchronously while STARTING the work is caught', async () => {
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => logger);
    await expect(bestEffort(() => { throw new Error('sync-throw'); }, 'op:thunk')).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatchObject({ op: 'op:thunk', err: 'sync-throw' });
    warn.mockRestore();
  });

  test('a thunk is supported for the happy path too', async () => {
    await expect(bestEffort(() => Promise.resolve('v'), 'op:thunk-ok')).resolves.toBe('v');
  });

  test('bestEffort itself never throws, even if the logger throws', async () => {
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => { throw new Error('logger down'); });
    await expect(bestEffort(Promise.reject(new Error('x')), 'op:logger-throws')).resolves.toBeUndefined();
    warn.mockRestore();
  });
});

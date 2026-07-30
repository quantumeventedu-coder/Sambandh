// tests/storage-health.test.js — the private-bucket "connect & verify" helpers used by the
// super-admin Storage widget. Runs in LOCAL-disk mode (Supabase not configured in tests).

delete process.env.SUPABASE_URL;          // force deterministic local-disk mode
delete process.env.SUPABASE_SERVICE_KEY;

const storage = require('../src/services/storage');

describe('storage private-bucket health', () => {
  test('storageStatus reports local mode + both bucket names when Supabase is unconfigured', () => {
    const s = storage.storageStatus();
    expect(s.configured).toBe(false);
    expect(s.provider).toBe('local-disk');
    expect(s.publicBucket).toBeTruthy();
    expect(s.privateBucket).toBeTruthy();
    expect(s.privateBucket).not.toBe(s.publicBucket);
  });

  test('ensureBuckets + selfTest round-trip (upload→sign→read→delete) pass', async () => {
    const e = await storage.ensureBuckets();
    expect(e.public.ok).toBe(true);
    expect(e.private.ok).toBe(true);
    const t = await storage.selfTest();
    expect(t.ok).toBe(true);
    expect(t.mode).toBe('local');
    expect(t.steps.upload && t.steps.read && t.steps.delete).toBe(true);
  });
});

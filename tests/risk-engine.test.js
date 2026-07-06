// Tests for the Trust & Safety risk engine — proves the scoring and tiers are
// real logic, and that stolen-photo fingerprinting is deterministic.

const { computeRiskScore, photoBytesHash } = require('../src/services/risk-engine');

describe('photoBytesHash', () => {
  test('is deterministic and collides for identical bytes (catfish signal)', () => {
    const a = Buffer.from('the-same-stolen-photo-bytes');
    const b = Buffer.from('the-same-stolen-photo-bytes');
    const c = Buffer.from('a-different-photo');
    expect(photoBytesHash(a)).toBe(photoBytesHash(b));
    expect(photoBytesHash(a)).not.toBe(photoBytesHash(c));
    expect(photoBytesHash(a)).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe('computeRiskScore', () => {
  test('a fully verified, clean, established user is low risk', () => {
    const r = computeRiskScore({ idVerified: true, selfieVerified: true, accountAgeDays: 120, karmaScore: 100, redFlags: {} });
    expect(r.score).toBe(0);
    expect(r.tier).toBe('low');
  });

  test('an unverified brand-new account is elevated', () => {
    const r = computeRiskScore({ idVerified: false, selfieVerified: false, accountAgeDays: 0.5, karmaScore: 100, redFlags: {} });
    expect(r.score).toBeGreaterThanOrEqual(25);
    expect(['elevated', 'high', 'critical']).toContain(r.tier);
    expect(r.reasons).toContain('ID not verified');
  });

  test('a money-request pattern pushes the user to critical', () => {
    const r = computeRiskScore({ idVerified: true, selfieVerified: true, accountAgeDays: 30, karmaScore: 60, moneyRequestFlags: 1, redFlags: { reportsAgainst: 3 } });
    expect(r.tier).toBe('critical');
    expect(r.reasons.join(' ')).toMatch(/Money-request/);
  });

  test('a duplicate photo across accounts is flagged as possible catfish (elevated+)', () => {
    const r = computeRiskScore({ idVerified: true, selfieVerified: true, accountAgeDays: 10, karmaScore: 90, duplicatePhotoAccounts: 2, redFlags: {} });
    expect(r.reasons.join(' ')).toMatch(/catfish/);
    expect(['elevated', 'high', 'critical']).toContain(r.tier); // suspicious, not conclusive alone
    // combined with an unverified new account it escalates to high/critical
    const worse = computeRiskScore({ idVerified: false, selfieVerified: false, accountAgeDays: 0.5, karmaScore: 70, duplicatePhotoAccounts: 2, redFlags: { reportsAgainst: 2 } });
    expect(['high', 'critical']).toContain(worse.tier);
  });

  test('a device cluster raises risk', () => {
    const clean = computeRiskScore({ idVerified: true, selfieVerified: true, accountAgeDays: 30, karmaScore: 100, redFlags: {} });
    const clustered = computeRiskScore({ idVerified: true, selfieVerified: true, accountAgeDays: 30, karmaScore: 100, deviceClusterSize: 5, redFlags: {} });
    expect(clustered.score).toBeGreaterThan(clean.score);
  });

  test('score is always clamped to 0..100 and tiers are ordered', () => {
    const worst = computeRiskScore({
      idVerified: false, selfieVerified: false, accountAgeDays: 0, karmaScore: 0,
      redFlags: { blockedByOthers: 10, reportsAgainst: 10, ghostingIncidents: 10 },
      deviceClusterSize: 9, duplicatePhotoAccounts: 3, moneyRequestFlags: 2, openReports: 9,
      likesLastHour: 200, messagesLastHour: 500
    });
    expect(worst.score).toBe(100);
    expect(worst.tier).toBe('critical');
    expect(worst.reasons.length).toBeGreaterThan(3);
  });

  test('reasons are ordered by contribution (most severe first)', () => {
    const r = computeRiskScore({ idVerified: false, moneyRequestFlags: 1, accountAgeDays: 200, karmaScore: 100, redFlags: {} });
    // money (40) should rank above ID-not-verified (25)
    expect(r.reasons[0]).toMatch(/Money-request/);
  });
});

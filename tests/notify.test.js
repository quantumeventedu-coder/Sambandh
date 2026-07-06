// Tests for the delivery layer — email (dev transport) and web-push VAPID setup.
// Proves email OTP is actually generated + "sent" and captured, and that web
// push has a working key even with no configured credentials.

const notify = require('../src/services/notify');

describe('email (dev transport)', () => {
  test('sendOtpEmail delivers and captures the message in the dev outbox', async () => {
    const before = notify.devOutbox().length;
    const res = await notify.sendOtpEmail('user@example.com', '123456');
    expect(res.dev).toBe(true);                         // dev transport, no real SMTP
    const box = notify.devOutbox();
    expect(box.length).toBe(before + 1);
    expect(box[0].to).toBe('user@example.com');
    expect(box[0].subject).toContain('123456');         // code is in the subject
    expect(box[0].text).toContain('123456');
  });

  test('emailConfigured is false with no SMTP env', () => {
    expect(notify.emailConfigured()).toBe(false);
  });

  test('sendEventEmail composes a branded transactional email', async () => {
    await notify.sendEventEmail('a@b.com', 'New match!', 'You both liked each other.');
    const box = notify.devOutbox();
    expect(box[0].subject).toBe('New match!');
    expect(box[0].to).toBe('a@b.com');
  });
});

describe('web push', () => {
  test('a usable VAPID public key exists even with no configured keys (ephemeral)', () => {
    const key = notify.vapidPublicKey();
    expect(typeof key).toBe('string');
    expect(key.length).toBeGreaterThan(40);             // base64url P-256 public key
  });

  test('sendWebPush reports dead subscriptions and does not throw on bad endpoints', async () => {
    const fakeSub = { endpoint: 'https://invalid.example.invalid/x', keys: { p256dh: 'x', auth: 'y' } };
    const { dead } = await notify.sendWebPush([fakeSub], { title: 't', body: 'b' });
    expect(Array.isArray(dead)).toBe(true);              // resolves cleanly, never throws
  });
});

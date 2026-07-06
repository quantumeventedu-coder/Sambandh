// services/notify.js — delivery layer: email + web push.
//
// Sambandh uses EMAIL for OTP (no SMS) and WEB PUSH for notifications (no
// native push). Both have a real production adapter gated behind env vars and a
// dev transport that actually works offline, so the whole flow runs today and
// you "connect the real thing later" by setting the env vars:
//   Email:  SMTP_URL  (or SMTP_HOST/PORT/USER/PASS) + EMAIL_FROM
//   Push :  VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY (+ VAPID_SUBJECT)
// Without them: email is logged to the console + captured in a dev outbox, and
// web push uses ephemeral VAPID keys generated at boot (works locally).

const nodemailer = require('nodemailer');
const webpush = require('web-push');

// ---------------------------------------------------------------- Email ----
let transporter = null;
const devOutbox = [];   // last 50 dev emails, inspectable via the admin/dev tools

function emailConfigured() { return !!(process.env.SMTP_URL || process.env.SMTP_HOST); }

function getTransporter() {
  if (transporter) return transporter;
  if (process.env.SMTP_URL) {
    transporter = nodemailer.createTransport(process.env.SMTP_URL);
  } else if (process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: +(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
    });
  } else {
    // Dev transport: capture + log, never actually connects anywhere.
    transporter = {
      sendMail: async (msg) => {
        devOutbox.unshift({ to: msg.to, subject: msg.subject, text: msg.text, at: new Date() });
        if (devOutbox.length > 50) devOutbox.length = 50;
        console.log(`[DEV EMAIL] to=${msg.to} · ${msg.subject}`);
        return { dev: true, messageId: 'dev-' + Date.now() };
      }
    };
  }
  return transporter;
}

async function sendEmail(to, subject, { text, html }) {
  const from = process.env.EMAIL_FROM || 'Sambandh <no-reply@sambandh.app>';
  return getTransporter().sendMail({ from, to, subject, text, html });
}

function brandedEmail(title, bodyHtml) {
  return `<!doctype html><html><body style="margin:0;background:#F1EFE8;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif">
    <div style="max-width:480px;margin:0 auto;padding:28px 20px">
      <div style="font-family:Georgia,serif;font-size:26px;font-weight:700;color:#4B1528;letter-spacing:.5px">sambandh</div>
      <div style="background:#fff;border-radius:16px;padding:26px;margin-top:16px;box-shadow:0 4px 18px rgba(75,21,40,.08)">
        <h1 style="font-family:Georgia,serif;font-size:20px;color:#4B1528;margin:0 0 12px">${title}</h1>
        ${bodyHtml}
      </div>
      <p style="font-size:11px;color:#888;margin-top:16px;text-align:center">Sambandh · connections, made meaningful · 18+ only</p>
    </div></body></html>`;
}

async function sendOtpEmail(email, code) {
  const subject = `Your Sambandh code is ${code}`;
  const text = `Your Sambandh verification code is ${code}. It expires in 5 minutes. If you didn't request this, ignore this email.`;
  const html = brandedEmail('Verify your email', `
    <p style="font-size:14px;color:#4d3f45;margin:0 0 16px">Enter this code to sign in. It expires in 5 minutes.</p>
    <div style="font-family:Georgia,serif;font-size:40px;font-weight:700;letter-spacing:10px;color:#993556;text-align:center;padding:8px 0">${code}</div>
    <p style="font-size:12px;color:#888;margin:16px 0 0">If you didn't request this, you can safely ignore this email.</p>`);
  return sendEmail(email, subject, { text, html });
}

// A generic transactional email for lifecycle events (match, karma, moderation).
async function sendEventEmail(email, title, message) {
  return sendEmail(email, title, {
    text: message,
    html: brandedEmail(title, `<p style="font-size:14px;color:#4d3f45;margin:0">${message}</p>
      <p style="margin-top:18px"><a href="${process.env.FRONTEND_URL || 'http://localhost:3010'}/app" style="display:inline-block;background:#993556;color:#fff;text-decoration:none;padding:11px 22px;border-radius:999px;font-weight:700;font-size:14px">Open Sambandh</a></p>`)
  });
}

// ------------------------------------------------------------- Web push ----
let vapid = null;

function initWebPush() {
  if (vapid) return vapid;
  const pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (pub && priv) {
    vapid = { publicKey: pub, privateKey: priv, configured: true };
  } else {
    vapid = { ...webpush.generateVAPIDKeys(), configured: false };   // ephemeral dev keys
    console.log('[DEV PUSH] using ephemeral VAPID keys (set VAPID_PUBLIC_KEY/PRIVATE_KEY for prod)');
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@sambandh.app', vapid.publicKey, vapid.privateKey);
  return vapid;
}

function vapidPublicKey() { return initWebPush().publicKey; }

// Sends to every subscription; returns the indexes of subscriptions that are
// dead (410/404) so the caller can prune them from the user.
async function sendWebPush(subscriptions, payload) {
  initWebPush();
  const dead = [];
  await Promise.all((subscriptions || []).map(async (sub, i) => {
    try {
      await webpush.sendNotification(sub.raw || sub, JSON.stringify(payload));
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) dead.push(i);
      else console.warn('[PUSH] send failed:', err.statusCode || err.message);
    }
  }));
  return { dead };
}

module.exports = {
  sendEmail, sendOtpEmail, sendEventEmail, emailConfigured,
  devOutbox: () => devOutbox,
  initWebPush, vapidPublicKey, sendWebPush
};

// services/push-mobile.js — push notifications to the native apps.
//
// Firebase Cloud Messaging HTTP v1 delivers to Android directly and to iOS via
// APNs (configure the APNs key in the Firebase console). Credentials come from
// FCM_SERVICE_ACCOUNT_JSON (the service-account JSON, as one env value).
// Without it this is a no-op that reports { configured:false } — never an error.

const DeviceToken = require('../models/DeviceToken');

let authClient = null, projectId = null;

function configured() { return !!process.env.FCM_SERVICE_ACCOUNT_JSON; }

async function accessToken() {
  if (!authClient) {
    const sa = JSON.parse(process.env.FCM_SERVICE_ACCOUNT_JSON);
    projectId = sa.project_id;
    const { GoogleAuth } = require('google-auth-library');
    const auth = new GoogleAuth({ credentials: sa, scopes: ['https://www.googleapis.com/auth/firebase.messaging'] });
    authClient = await auth.getClient();
  }
  const t = await authClient.getAccessToken();
  return typeof t === 'string' ? t : t && t.token;
}

async function sendToUser(userId, { title, body, data = {} } = {}) {
  if (!configured()) return { configured: false, sent: 0 };
  const devices = await DeviceToken.find({ userId, platform: { $in: ['android', 'ios'] } }).lean();
  if (!devices.length) return { configured: true, sent: 0 };
  let token;
  try { token = await accessToken(); } catch (e) { console.warn('[PUSH] FCM auth failed:', e.message); return { configured: true, sent: 0, error: 'auth' }; }
  let sent = 0;
  const strData = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)]));
  for (const d of devices) {
    try {
      const r = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
        method: 'POST',
        headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
        body: JSON.stringify({ message: {
          token: d.token,
          notification: { title: String(title || 'Sambandh Setu').slice(0, 120), body: String(body || '').slice(0, 400) },
          data: strData,
          android: { priority: 'high', notification: { channel_id: 'default' } },
          apns: { payload: { aps: { sound: 'default' } } }
        } })
      });
      if (r.ok) { sent++; continue; }
      const j = await r.json().catch(() => ({}));
      const code = JSON.stringify(j).match(/UNREGISTERED|INVALID_ARGUMENT|NOT_FOUND/);
      if (code || r.status === 404) await DeviceToken.deleteOne({ _id: d._id });   // dead install
    } catch (e) { console.warn('[PUSH] send failed:', e.message); }
  }
  return { configured: true, sent };
}

module.exports = { sendToUser, configured };

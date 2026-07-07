// services/storage.js — object storage for photos & verification documents.
//
// Consolidated onto Supabase so the whole stack is one provider. Priority:
//   1. Supabase Storage   — when SUPABASE_URL + SUPABASE_SERVICE_KEY are set.
//   2. Local disk (./uploads or /tmp/uploads on serverless) — dev fallback.
//
// Uploads go over Supabase's REST API with the built-in fetch — no S3/R2 SDK,
// no extra dependency. Persistent across serverless invocations (unlike /tmp).

const fs = require('fs');
const path = require('path');

// Serverless filesystems are read-only outside /tmp (and /tmp is ephemeral +
// per-instance) — configure Supabase Storage in production so photos persist.
const UPLOADS_ROOT = process.env.VERCEL
  ? '/tmp/uploads'
  : path.join(__dirname, '..', '..', 'uploads');

const BUCKET = process.env.SUPABASE_BUCKET || 'sambandh';
let bucketEnsured = false;

async function ensureBucket(base, serviceKey) {
  if (bucketEnsured) return;
  bucketEnsured = true; // only attempt once per process
  try {
    await fetch(`${base}/storage/v1/bucket`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true })
    });
  } catch { /* bucket likely already exists — ignore */ }
}

async function uploadToSupabase(objectKey, buffer, mimeType) {
  const base = process.env.SUPABASE_URL.replace(/\/+$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  await ensureBucket(base, serviceKey);
  const res = await fetch(`${base}/storage/v1/object/${BUCKET}/${objectKey}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`, apikey: serviceKey,
      'Content-Type': mimeType || 'application/octet-stream', 'x-upsert': 'true'
    },
    body: buffer
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Supabase Storage upload failed (${res.status}): ${detail.slice(0, 200)}`);
  }
  return `${base}/storage/v1/object/public/${BUCKET}/${objectKey}`;
}

function uploadToLocal(objectKey, buffer) {
  const localPath = path.join(UPLOADS_ROOT, objectKey);
  fs.mkdirSync(path.dirname(localPath), { recursive: true });
  fs.writeFileSync(localPath, buffer);
  return '/uploads/' + objectKey.split(path.sep).join('/');
}

// Upload a file, returning its served URL. objectKey is a forward-slash path
// like "users/<id>/photos/123.jpg" or "verification/<id>.jpg".
async function uploadFile(objectKey, buffer, mimeType) {
  const key = String(objectKey).replace(/\\/g, '/');
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
    return uploadToSupabase(key, buffer, mimeType);
  }
  return uploadToLocal(key, buffer);
}

// `uploadToR2` kept as an alias for existing callers.
module.exports = { uploadFile, uploadToR2: uploadFile, UPLOADS_ROOT };

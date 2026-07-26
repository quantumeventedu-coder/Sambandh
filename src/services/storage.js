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

// Read a stored object back as a Buffer (for the encrypted document vault — the
// bytes are ciphertext, decrypted server-side only for an authorized caller).
// Uses the AUTHENTICATED object path so it works even for a non-public bucket.
async function readFile(objectKey) {
  const key = String(objectKey).replace(/\\/g, '/');
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
    const base = process.env.SUPABASE_URL.replace(/\/+$/, '');
    const serviceKey = process.env.SUPABASE_SERVICE_KEY;
    const res = await fetch(`${base}/storage/v1/object/${BUCKET}/${key}`, {
      headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey }
    });
    if (!res.ok) throw new Error(`Storage read failed (${res.status})`);
    return Buffer.from(await res.arrayBuffer());
  }
  return fs.readFileSync(path.join(UPLOADS_ROOT, key));
}

// Best-effort hard delete of a stored object (vault document deletion).
async function deleteFile(objectKey) {
  const key = String(objectKey).replace(/\\/g, '/');
  try {
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
      const base = process.env.SUPABASE_URL.replace(/\/+$/, '');
      const serviceKey = process.env.SUPABASE_SERVICE_KEY;
      await fetch(`${base}/storage/v1/object/${BUCKET}/${key}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey }
      });
    } else {
      fs.rmSync(path.join(UPLOADS_ROOT, key), { force: true });
    }
    return true;
  } catch { return false; }
}

// `uploadToR2` kept as an alias for existing callers.
module.exports = { uploadFile, uploadToR2: uploadFile, readFile, deleteFile, UPLOADS_ROOT };

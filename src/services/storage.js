// services/storage.js — object storage for photos & verification documents.
//
// Consolidated onto Supabase so the whole stack is one provider. Priority:
//   1. Supabase Storage   — when SUPABASE_URL + SUPABASE_SERVICE_KEY are set.
//   2. Local disk (./uploads or /tmp/uploads on serverless) — dev fallback.
//
// Two buckets:
//   • BUCKET (public)         — profile photos (shown to other users; public URL).
//   • PRIVATE_BUCKET (private) — sensitive verification docs (ID/selfie/profession). NO public
//                               URL; read only via a short-lived signed URL, so a stored ID
//                               can never be fetched by guessing/enumerating a public URL.

const fs = require('fs');
const path = require('path');

// Serverless filesystems are read-only outside /tmp (and /tmp is ephemeral +
// per-instance) — configure Supabase Storage in production so photos persist.
const UPLOADS_ROOT = process.env.VERCEL
  ? '/tmp/uploads'
  : path.join(__dirname, '..', '..', 'uploads');

const BUCKET = process.env.SUPABASE_BUCKET || 'sambandh';
const PRIVATE_BUCKET = process.env.SUPABASE_PRIVATE_BUCKET || (BUCKET + '-private');
const ensured = new Set();
const useSupabase = () => !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);
const supaBase = () => process.env.SUPABASE_URL.replace(/\/+$/, '');

async function ensureBucket(base, serviceKey, bucket, isPublic) {
  if (ensured.has(bucket)) return;
  ensured.add(bucket);   // only attempt once per process per bucket
  try {
    await fetch(`${base}/storage/v1/bucket`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: bucket, name: bucket, public: !!isPublic })
    });
  } catch { /* bucket likely already exists — ignore */ }
}

async function uploadToSupabase(objectKey, buffer, mimeType, bucket, isPublic) {
  const base = supaBase();
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  await ensureBucket(base, serviceKey, bucket, isPublic);
  const res = await fetch(`${base}/storage/v1/object/${bucket}/${objectKey}`, {
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
  // Public bucket → a served URL; private bucket → just the key (fetch later via a signed URL).
  return isPublic ? `${base}/storage/v1/object/public/${bucket}/${objectKey}` : objectKey;
}

function uploadToLocal(objectKey, buffer) {
  const localPath = path.join(UPLOADS_ROOT, objectKey);
  fs.mkdirSync(path.dirname(localPath), { recursive: true });
  fs.writeFileSync(localPath, buffer);
  return '/uploads/' + objectKey.split(path.sep).join('/');
}

// PUBLIC upload (profile photos). Returns the served URL. objectKey is a forward-slash path.
async function uploadFile(objectKey, buffer, mimeType) {
  const key = String(objectKey).replace(/\\/g, '/');
  if (useSupabase()) return uploadToSupabase(key, buffer, mimeType, BUCKET, true);
  return uploadToLocal(key, buffer);
}

// PRIVATE upload (verification documents). Stores in the private bucket and returns the KEY
// only (no public URL). Read it back with signedUrl(key) or readFile(key, { private: true }).
async function uploadPrivate(objectKey, buffer, mimeType) {
  const key = String(objectKey).replace(/\\/g, '/');
  if (useSupabase()) return uploadToSupabase(key, buffer, mimeType, PRIVATE_BUCKET, false);
  uploadToLocal(key, buffer);
  return key;
}

// A short-lived signed URL to VIEW a private object (admin review of a verification doc).
async function signedUrl(objectKey, expiresIn = 120) {
  const key = String(objectKey).replace(/\\/g, '/');
  if (useSupabase()) {
    const base = supaBase(), serviceKey = process.env.SUPABASE_SERVICE_KEY;
    const res = await fetch(`${base}/storage/v1/object/sign/${PRIVATE_BUCKET}/${key}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresIn })
    });
    if (!res.ok) throw new Error(`Signed URL failed (${res.status})`);
    const j = await res.json();
    return base + '/storage/v1' + j.signedURL;   // signedURL is a path with a ?token=…
  }
  return '/uploads/' + key;   // dev fallback (local disk is not internet-exposed)
}

// Read a stored object back as a Buffer. `opts.private` reads from the private bucket. Uses the
// AUTHENTICATED object path, so it works for a non-public bucket.
async function readFile(objectKey, opts = {}) {
  const key = String(objectKey).replace(/\\/g, '/');
  const bucket = opts.private ? PRIVATE_BUCKET : BUCKET;
  if (useSupabase()) {
    const base = supaBase(), serviceKey = process.env.SUPABASE_SERVICE_KEY;
    const res = await fetch(`${base}/storage/v1/object/${bucket}/${key}`, {
      headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey }
    });
    if (!res.ok) throw new Error(`Storage read failed (${res.status})`);
    return Buffer.from(await res.arrayBuffer());
  }
  return fs.readFileSync(path.join(UPLOADS_ROOT, key));
}

// Best-effort hard delete of a stored object. `opts.private` targets the private bucket.
async function deleteFile(objectKey, opts = {}) {
  const key = String(objectKey).replace(/\\/g, '/');
  const bucket = opts.private ? PRIVATE_BUCKET : BUCKET;
  try {
    if (useSupabase()) {
      const base = supaBase(), serviceKey = process.env.SUPABASE_SERVICE_KEY;
      await fetch(`${base}/storage/v1/object/${bucket}/${key}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey }
      });
    } else {
      fs.rmSync(path.join(UPLOADS_ROOT, key), { force: true });
    }
    return true;
  } catch { return false; }
}

// `uploadToR2` kept as an alias for existing PUBLIC callers.
module.exports = { uploadFile, uploadToR2: uploadFile, uploadPrivate, signedUrl, readFile, deleteFile, UPLOADS_ROOT, PRIVATE_BUCKET };

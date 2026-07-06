// services/storage.js — Cloudflare R2 when configured, local disk otherwise.
// Local files are saved under ./uploads and served at /uploads by server.js.

const fs = require('fs');
const path = require('path');

// Serverless filesystems are read-only outside /tmp (ephemeral — fine for dev
// simulations; production uses R2 anyway once R2_* is configured).
const UPLOADS_ROOT = process.env.VERCEL
  ? '/tmp/uploads'
  : path.join(__dirname, '..', '..', 'uploads');

async function uploadToR2(key, buffer, mimeType) {
  if (!process.env.R2_ACCOUNT_ID) {
    const localPath = path.join(UPLOADS_ROOT, key);
    fs.mkdirSync(path.dirname(localPath), { recursive: true });
    fs.writeFileSync(localPath, buffer);
    return '/uploads/' + key.split(path.sep).join('/');
  }

  const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
    }
  });
  await client.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET || 'sambandh',
    Key: key,
    Body: buffer,
    ContentType: mimeType
  }));
  return `${process.env.R2_PUBLIC_URL || ''}/${key}`;
}

module.exports = { uploadToR2, UPLOADS_ROOT };

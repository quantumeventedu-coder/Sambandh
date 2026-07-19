// server.js — Sambandh backend entry point
// Run with: node src/server.js (or: npm run dev)
//
// Serves the API under /api, real-time chat via Socket.io, the web app from
// /public, and uploaded photos from /uploads (local dev storage).

// Load env FIRST — src/db/odm.js chooses the Postgres vs Mongo engine by reading
// process.env.DATABASE_URL at import time, so dotenv must run before that require
// (otherwise a DATABASE_URL that lives only in .env is invisible and the app picks
// the wrong data engine). On Vercel env vars are already in the environment.
require('dotenv').config();

const express = require('express');
const mongoose = require('./db/odm');
const http = require('http');
const path = require('path');
const dns = require('dns');
const { Server: SocketServer } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { logger } = require('./lib/logger');
const { requestLogger } = require('./lib/request-log');
const { errorHandler } = require('./lib/errors');
const { mountHealth } = require('./lib/health');

// Routes
const authRoutes = require('./routes-auth');
const verificationRoutes = require('./routes-verification');
const chatRoutes = require('./routes-chat');
const paymentRoutes = require('./routes-payment');
const karmaRoutes = require('./routes-karma');
const discoverRoutes = require('./routes-discover');
const compatRoutes = require('./routes-compat');
const reportRoutes = require('./routes-report');
const notificationRoutes = require('./routes-notifications');
const meRoutes = require('./routes-me');

// Socket handlers
const setupChatSockets = require('./sockets-chat');
const { UPLOADS_ROOT } = require('./services/storage');

const app = express();
const server = http.createServer(app);

// ---- Middleware ----

// Trace every request first (assigns req.reqId + req.log, echoes x-request-id).
app.use(requestLogger());

app.use(helmet({ contentSecurityPolicy: false })); // CSP off so the local web app can load Socket.io + inline styles

// CORS: allow an explicit list of origins (CORS_ORIGINS, comma-separated, or
// FRONTEND_URL). The SPA is served same-origin so it never needs CORS; only
// external callers do. With nothing configured we reflect in development but
// disallow cross-origin in production instead of echoing every origin back.
const corsAllowlist = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || '')
  .split(',').map(s => s.trim()).filter(Boolean);
const corsOrigin = corsAllowlist.length
  ? corsAllowlist
  : (process.env.NODE_ENV === 'production' ? false : true);
app.use(cors({ origin: corsOrigin, credentials: true }));

// Razorpay webhook needs the RAW body for signature verification — mount before json
app.use('/api/payment/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '25mb' })); // photos are sent base64-encoded

// Global rate limit (per IP)
app.use('/api', rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false
}));

// ---- Routes ----

// Liveness (/health) + DB-aware readiness (/health/ready).
mountHealth(app, mongoose);

// City autocomplete (public, static dataset)
const { CITIES } = require('./data/cities');
app.get('/api/cities', (req, res) => {
  const q = String(req.query.q || '').toLowerCase();
  const matches = CITIES
    .filter(([name]) => name.toLowerCase().startsWith(q))
    .slice(0, 10)
    .map(([name, state]) => ({ name, state }));
  res.json({ cities: matches });
});

app.use('/api/waitlist', require('./routes-waitlist')); // public pre-launch waiting list
app.use('/api/auth', authRoutes);
app.use('/api/verification', verificationRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/karma', karmaRoutes);
app.use('/api/discover', discoverRoutes);
app.use('/api/compat', compatRoutes);
app.use('/api/report', reportRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/me', meRoutes);
app.use('/api/community', require('./routes-community')); // anonymous topic rooms
app.use('/api/astro', require('./routes-astro'));         // full astrology / kundali
app.use('/api/reading', require('./routes-reading'));     // plain-language readings (no jargon)
app.use('/api/ai', require('./routes-ai')); // reusable AI API (per-app X-AI-Key)
app.use('/api/superadmin', require('./routes-superadmin')); // owner-only, SUPER_ADMIN_KEY

// Analytics summary for the admin panel (event counts, last 7 days)
app.get('/api/analytics/admin/summary', authRoutes.requireAdmin, async (req, res, next) => {
  try {
    const AnalyticsEvent = require('./models/AnalyticsEvent');
    const AuditLog = require('./models/AuditLog');
    const since = new Date(Date.now() - 7 * 86400000);
    const events = await AnalyticsEvent.aggregate([
      { $match: { createdAt: { $gt: since } } },
      { $group: { _id: '$name', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    const audit = await AuditLog.find().sort({ createdAt: -1 }).limit(50).lean();
    res.json({ since, events: events.map(e => ({ name: e._id, count: e.count })), audit });
  } catch (err) { next(err); }
});

// Spec alias: GET /api/profile/:userId → discover router's /profile/:userId
app.use('/api/profile', (req, res, next) => {
  req.url = '/profile' + req.url;
  discoverRoutes(req, res, next);
});

// ---- Static: marketing homepage, web app + local uploads ----

// Homepage at / explains the product; the app itself lives at /app.
// Old hash deep-links (/#/chats) are forwarded to /app by home.html itself,
// since URL hashes never reach the server.
app.get('/', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(__dirname, '..', 'public', 'home.html'));
});
app.get('/app', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.use('/uploads', express.static(UPLOADS_ROOT));
// no-cache: browsers revalidate every load (ETag), so UI updates appear immediately
app.use(express.static(path.join(__dirname, '..', 'public'), {
  setHeaders: res => res.setHeader('Cache-Control', 'no-cache')
}));

// API 404
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// SPA fallback — everything else gets the web app
app.get('*', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Typed error handler — maps our error taxonomy to status + stable code, logs
// server-side (stack for 5xx only), never leaks internals to the client.
app.use(errorHandler());

// ---- Socket.io for chat ----

const io = new SocketServer(server, {
  cors: { origin: process.env.FRONTEND_URL || true }
});
setupChatSockets(io);
app.set('io', io);

// ---- Database connection ----
// 1. Try MONGODB_URI as-is.
// 2. If the SRV lookup fails (common on hotspots/some ISPs), retry with
//    Google DNS for the lookup.
// 3. Fall back to an in-memory local MongoDB so development never blocks.

async function connectDatabase() {
  // Supabase / PostgreSQL (DATABASE_URL set → src/db/odm loaded the pg engine).
  // Use the SESSION POOLER hostname (aws-…pooler.supabase.com) — Supabase's
  // direct db.<ref> host is IPv6-only and unreachable from Vercel/IPv4 networks.
  if (process.env.DATABASE_URL) {
    await mongoose.connect(process.env.DATABASE_URL);
    console.log('[OK] PostgreSQL connected (Supabase)');
    return;
  }

  const uri = process.env.MONGODB_URI;

  if (uri && process.env.USE_MEMORY_DB !== 'true') {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
      console.log('[OK] MongoDB connected (Atlas)');
      return;
    } catch (err) {
      console.warn('[WARN] MongoDB connect failed:', err.message.split('\n')[0]);
      if (/querySrv|ENOTFOUND|ETIMEOUT/i.test(err.message)) {
        try {
          console.log('[..] Retrying SRV lookup via Google DNS (8.8.8.8)...');
          dns.setServers(['8.8.8.8', '1.1.1.1']);
          await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
          console.log('[OK] MongoDB connected (Atlas via Google DNS)');
          return;
        } catch (err2) {
          console.warn('[WARN] Retry failed:', err2.message.split('\n')[0]);
        }
      }
    }
  }

  // Serverless (Vercel): there is no local mongod and no binary download —
  // a real database is mandatory. The intended production DB is Supabase via
  // DATABASE_URL; MONGODB_URI (Atlas) is the alternative.
  if (process.env.VERCEL) {
    if (!process.env.DATABASE_URL && !process.env.MONGODB_URI) {
      throw new Error('No database configured on Vercel. Set DATABASE_URL (Supabase Postgres — recommended) in Project Settings → Environment Variables, then redeploy. (Alternative: a reachable MONGODB_URI with Atlas network access set to 0.0.0.0/0.)');
    }
    throw new Error('Database unreachable on Vercel. If using DATABASE_URL (Supabase), use the session-pooler host (…pooler.supabase.com), not db.<ref> which is IPv6-only. If using MONGODB_URI (Atlas), allow network access from 0.0.0.0/0.');
  }

  // Local in-memory MongoDB (data resets on restart — dev only)
  try {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    console.log('[..] Starting local in-memory MongoDB (first run downloads a binary)...');
    const mem = await MongoMemoryServer.create();
    await mongoose.connect(mem.getUri('sambandh'));
    console.log('[OK] In-memory MongoDB running — data resets when the server stops.');
    console.log('     For persistent data, fix MONGODB_URI (Atlas) or install MongoDB locally.');
  } catch (err) {
    console.error('[FATAL] No database available:', err.message);
    throw err;
  }
}

// ---- Init (DB + seed) — shared by the long-running server and serverless ----

let readyPromise = null;
function ready() {
  if (!readyPromise) {
    readyPromise = (async () => {
      // Fail closed: in production every required secret must be present and not
      // a known-compromised value. Absence of config must mean STOP, never a
      // permissive default (see config/require-secrets.js). Non-fatal issues come
      // back as warnings — they are logged, they do not block boot.
      const secretsCheck = require('./config/require-secrets').assertProductionSecrets(process.env);
      for (const w of secretsCheck.warnings || []) console.warn('[CONFIG]', w);

      if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET is not set — configure it in the environment before the app can issue logins.');
      }
      await connectDatabase();

      // Demo profiles are NEVER seeded in production, whatever SEED_DEMO says — the
      // flag is honoured only outside production. This is the real guard; the boot
      // check merely warns (a stray SEED_DEMO must not blank the site).
      if (process.env.SEED_DEMO === 'true' && !secretsCheck.production) {
        const { seedDemo } = require('./seed-demo');
        await seedDemo().catch(e => console.warn('[SEED] failed:', e.message));
      }
      // Community rooms exist regardless of demo mode (idempotent, count-gated).
      await require('./routes-community').seedRooms().catch(e => console.warn('[SEED rooms] failed:', e.message));
    })();
    // Allow a retry on the next request instead of caching a failed boot forever
    readyPromise.catch(() => { readyPromise = null; });
  }
  return readyPromise;
}

// ---- Start server (long-running mode: node src/server.js) ----

async function start() {
  await ready();

  const { startCrons } = require('./crons');
  startCrons();

  const PORT = process.env.PORT || 3001;
  server.listen(PORT, () => {
    console.log(`[OK] Sambandh API listening on :${PORT}`);
    console.log(`[OK] Homepage:    http://localhost:${PORT}`);
    console.log(`[OK] Web app:     http://localhost:${PORT}/app`);
    console.log(`[OK] Admin panel: http://localhost:${PORT}/admin.html`);
  });
}

// On Vercel the function wrapper (api/index.js) drives requests; no listener,
// no in-process crons (run `nightlyBatch` via an external scheduler instead),
// and Socket.io realtime is unavailable — the web app degrades to REST sends.
if (process.env.VERCEL) {
  module.exports = { app, ready };
} else {
  start().catch(err => {
    logger.fatal({ err: { message: err && err.message, stack: err && err.stack } }, 'failed to start');
    process.exit(1);
  });
  module.exports = { app, ready };
}

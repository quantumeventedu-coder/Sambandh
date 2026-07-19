// @ts-check
// routes-auth.js — phone OTP auth, JWT (HttpOnly cookie + Bearer), profile
//
// Spec §2.1: Indian numbers only (+91[6-9]XXXXXXXXX) · OTP 6 digits, 60s validity,
// max 3 requests/phone/hour · 5 wrong attempts = 30-minute lock · JWT 30 days in
// an HttpOnly cookie (Bearer header also accepted for the SPA/socket clients) ·
// token auto-refresh within 7 days of expiry · logout via token blacklist.
//
// OTP modes: Firebase in production; dev mode prints/returns the code.

const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { rateLimit } = require('express-rate-limit');
const { z } = require('zod');
const User = require('./models/User');
const Chat = require('./models/Chat');
const Message = require('./models/Message');
const TokenBlacklist = require('./models/TokenBlacklist');
const { findCity } = require('./data/cities');
const { uploadToR2 } = require('./services/storage');
const { track } = require('./services/analytics');
const events = require('./services/events');

const router = express.Router();

const DEV_MODE = process.env.DEV_MODE === 'true' || !process.env.FIREBASE_PROJECT_ID;
const OTP_MAX_PER_HOUR = DEV_MODE ? 100 : 3;
const OTP_WRONG_LIMIT = 5;                   // then 30-minute lock
const OTP_LOCK_MS = 30 * 60 * 1000;
const COOKIE_NAME = 'sb_token';

// phone -> { code, expiresAt, wrongAttempts, lockedUntil, requests: [timestamps] }
const otpStore = new Map();

const ipLimit = rateLimit({ windowMs: 60 * 60 * 1000, max: DEV_MODE ? 500 : 20 });

// ---- Schemas ----
// Auth identifier: EMAIL (OTP by email — primary) or phone. At least one.
const INDIAN_PHONE = /^\+91[6-9][0-9]{9}$/;
const requestOtpSchema = z.object({
  email: z.string().email().max(200).optional(),
  phone: z.string().regex(INDIAN_PHONE).optional()
}).refine(d => d.email || d.phone, { message: 'Provide an email or phone' });
const verifyOtpSchema = z.object({
  email: z.string().email().max(200).optional(),
  phone: z.string().regex(INDIAN_PHONE).optional(),
  otp: z.string().regex(/^\d{6}$/).optional(),
  totp: z.string().regex(/^\d{6}$/).optional(),          // 2FA authenticator code
  backupCode: z.string().max(20).optional()              // 2FA recovery code
}).refine(d => d.email || d.phone, { message: 'Provide an email or phone' });

// Latin letters + Devanagari script (names in English or Hindi)
const NAME_RE = /^[A-Za-z\p{Script=Devanagari}][A-Za-z\p{Script=Devanagari} ]{0,49}$/u;
const signupSchema = z.object({
  firstName: z.string().regex(NAME_RE, 'Letters and spaces only'),
  displayName: z.string().max(50).optional(),
  gender: z.enum(['male', 'female', 'non_binary', 'other']),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  city: z.string().min(1),
  state: z.string().optional(),
  languages: z.array(z.string()).min(1)
});

const profileSchema = z.object({
  bio: z.string().max(500).optional(),
  displayName: z.string().max(50).optional(),
  languages: z.array(z.string()).min(1).optional(),
  city: z.string().optional(),
  intent: z.array(z.enum(['marriage', 'dating', 'casual', 'friendship', 'networking'])).min(1).max(2).optional(),
  interestedInGenders: z.array(z.enum(['male', 'female', 'non_binary', 'other'])).optional(),
  astrology: z.object({
    birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    birthTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
    birthPlace: z.object({ city: z.string(), state: z.string().optional() }).optional()
  }).optional(),
  // Self-declared temperament features (Samudrika). Every field optional and
  // chosen by the user from a fixed dropdown — exactly like birth details.
  // NEVER derived from a photo or measurement (enforced by no-cv-writes-features).
  // `null` means the user removed their nature profile — clear the whole object.
  features: z.object({
    forehead: z.enum(['broad', 'high', 'narrow', 'even']).optional(),
    eyes: z.enum(['large', 'sharp', 'soft', 'deepset']).optional(),
    voice: z.enum(['deep', 'quick', 'soft', 'clear']).optional(),
    gait: z.enum(['fast', 'measured', 'light', 'firm']).optional(),
    hands: z.enum(['long', 'broad', 'fine', 'square']).optional(),
    build: z.enum(['solid', 'lean', 'balanced', 'sturdy']).optional()
  }).nullable().optional(),
  photos: z.array(z.object({
    base64: z.string(),
    filename: z.string(),
    isPrimary: z.boolean().optional(),
    // NSFWJS class scores computed in the browser (content moderation)
    nsfw: z.object({
      neutral: z.number(), drawing: z.number(), sexy: z.number(), hentai: z.number(), porn: z.number()
    }).partial().optional()
  })).max(6).optional()
});

// ---- Token helpers ----

/**
 * @param {import('express').Response} res
 * @param {any} user
 */
function issueToken(res, user) {
  const token = jwt.sign(
    { userId: user._id.toString(), phone: user.phone, role: user.role || 'user' },
    jwtSecret(),
    { expiresIn: '30d' }
  );
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 30 * 24 * 3600 * 1000
  });
  return token;
}

// Shared login finisher for password / Google logins: runs the account gates
// (banned / deleted / suspended), enforces 2FA, and issues the token. Returns
// true if it wrote a response (caller should stop), false if not applicable.
/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {any} user
 * @returns {Promise<boolean>}
 */
async function completeLogin(req, res, user) {
  if (user.status?.banned) { res.status(403).json({ error: 'This account is not eligible for Sambandh.' }); return true; }
  if (user.status?.deletedAt) {
    if (Date.now() - user.status.deletedAt < 30 * 86400000) {
      await User.findByIdAndUpdate(user._id, { 'status.active': true, 'status.deletedAt': null });
    } else { res.status(403).json({ error: 'This account was deleted.' }); return true; }
  }
  if (user.status?.suspended) {
    if (user.suspension?.endsAt && user.suspension.endsAt < new Date()) {
      await User.findByIdAndUpdate(user._id, { 'status.suspended': false, 'suspension.endsAt': null });
    } else { res.status(403).json({ error: 'Your account is suspended. Check your notifications for details.' }); return true; }
  }
  // Second factor
  if (user.security?.totp?.confirmedAt) {
    const { verifyTotp, matchBackupCode } = require('./services/twofa');
    const { totp, backupCode } = req.body;
    if (!totp && !backupCode) { res.json({ twoFactorRequired: true }); return true; }
    let ok = false;
    if (totp && verifyTotp(user.security.totp.secret, totp)) ok = true;
    else if (backupCode) {
      const idx = matchBackupCode(backupCode, user.security.backupCodes || []);
      if (idx >= 0) {
        const codes = user.security.backupCodes.slice();
        codes[idx] = { ...(codes[idx].toObject?.() || codes[idx]), usedAt: new Date() };
        await User.findByIdAndUpdate(user._id, { 'security.backupCodes': codes });
        ok = true;
      }
    }
    if (!ok) { res.status(401).json({ error: 'Invalid 2FA code', twoFactorRequired: true }); return true; }
  }
  await User.findByIdAndUpdate(user._id, { lastActiveAt: new Date() });
  const token = issueToken(res, user);
  res.json({
    token,
    user: {
      id: user._id, username: user.username, email: user.email, phone: user.phone, role: user.role || 'user',
      hasProfile: !!user.profile?.firstName, verificationLevel: user.verification?.level,
      idVerified: !!user.verification?.idVerified, joinFeePaid: user.membership?.joinFeePaid,
      intent: user.intent || [], hasPhotos: (user.profile?.photos || []).length > 0
    }
  });
  return true;
}

/** @param {import('express').Request} req */
function readToken(req) {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  const cookies = req.headers.cookie;
  if (!cookies) return null;
  for (const part of cookies.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === COOKIE_NAME) return decodeURIComponent(v.join('='));
  }
  return null;
}

/** @param {string} s */
const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');

/**
 * Message from an unknown thrown value. Under strict, a catch binding is
 * `unknown`; this narrows it without reaching for `any`.
 * @param {unknown} e
 * @returns {string}
 */
const errMsg = e => (e instanceof Error ? e.message : String(e));

/**
 * The JWT secret, or a loud failure — never sign/verify against undefined.
 * (require-secrets.js already refuses to boot production without it.)
 * @returns {string}
 */
function jwtSecret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET is not set');
  return s;
}

// ---- Routes ----

// 1. Request OTP — email (server-generated code, emailed) or phone.
//    Rate: OTP_MAX_PER_HOUR per identifier; 30-min lock after 5 wrong attempts.
router.post('/request-otp', ipLimit, async (req, res, next) => {
  try {
    const parsed = requestOtpSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Enter a valid email or 10-digit Indian mobile number' });
    }
    const email = parsed.data.email ? parsed.data.email.toLowerCase() : null;
    const phone = parsed.data.phone || null;
    const id = email || phone;                 // otpStore key = the identifier
    const now = Date.now();
    const entry = otpStore.get(id) || { requests: [], wrongAttempts: 0 };

    if (entry.lockedUntil && entry.lockedUntil > now) {
      const mins = Math.ceil((entry.lockedUntil - now) / 60000);
      return res.status(429).json({ error: `Too many attempts. Try again in ${mins} minutes.` });
    }
    entry.requests = entry.requests.filter((/** @type {number} */ t) => now - t < 3600 * 1000);
    if (entry.requests.length >= OTP_MAX_PER_HOUR) {
      return res.status(429).json({ error: 'Too many attempts. Try again in 60 minutes.' });
    }
    entry.requests.push(now);

    // EMAIL path: always server-generate the code and email it (dev transport
    // logs it + we return devOtp for convenience; prod emails only).
    if (email) {
      entry.code = String(Math.floor(100000 + Math.random() * 900000));
      entry.channel = 'email';
      entry.expiresAt = now + 5 * 60 * 1000;   // 5-minute email OTP
      entry.wrongAttempts = 0;
      otpStore.set(id, entry);
      const { sendOtpEmail, emailConfigured } = require('./services/notify');
      await sendOtpEmail(email, entry.code).catch(e => console.error('[EMAIL OTP] send failed:', e.message));
      const devReveal = DEV_MODE || !emailConfigured();  // reveal in dev / when no SMTP yet
      return res.json({ ok: true, channel: 'email', devMode: devReveal, validSeconds: 300,
        ...(devReveal ? { devOtp: entry.code } : {}) });
    }

    // PHONE path (dev code / Firebase in prod) — unchanged.
    if (DEV_MODE) {
      entry.code = String(Math.floor(100000 + Math.random() * 900000));
      entry.channel = 'phone';
      entry.expiresAt = now + 5 * 60 * 1000;
      entry.wrongAttempts = 0;
      otpStore.set(id, entry);
      console.log(`[DEV OTP] ${phone} → ${entry.code}`);
      return res.json({ ok: true, channel: 'phone', devMode: true, devOtp: entry.code, validSeconds: 300 });
    }
    otpStore.set(id, entry);
    res.json({ ok: true, channel: 'phone', devMode: false, validSeconds: 60, message: 'Use Firebase SDK to send OTP from client' });
  } catch (err) { next(err); }
});

// 2. Verify OTP — issues Sambandh JWT (cookie + body)
router.post('/verify-otp', async (req, res, next) => {
  try {
    const parsed = verifyOtpSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid request' });
    const { otp } = parsed.data;
    const email = parsed.data.email ? parsed.data.email.toLowerCase() : null;
    const phone = parsed.data.phone || null;
    const id = email || phone;
    const now = Date.now();

    // EMAIL, or phone in dev mode → verify the server-generated code from otpStore.
    if (email || DEV_MODE) {
      const entry = otpStore.get(id);
      if (entry?.lockedUntil && entry.lockedUntil > now) {
        return res.status(429).json({ error: 'Locked after too many wrong attempts. Try again in 30 minutes.' });
      }
      if (!entry || !entry.code || entry.expiresAt < now || entry.code !== otp) {
        if (entry) {
          entry.wrongAttempts = (entry.wrongAttempts || 0) + 1;
          if (entry.wrongAttempts >= OTP_WRONG_LIMIT) { entry.lockedUntil = now + OTP_LOCK_MS; entry.wrongAttempts = 0; }
          otpStore.set(id, entry);
        }
        return res.status(401).json({ error: 'Wrong or expired code' });
      }
      // Do NOT consume the OTP yet — if 2FA is required the client re-submits the
      // same OTP with the authenticator code. Deleted after the full check passes.
    } else {
      // Phone login by SMS is intentionally not offered — email, password,
      // Google and passkeys cover sign-in, and we don't run an SMS provider.
      // This path is closed cleanly rather than depending on an unused SDK.
      return res.status(400).json({ error: 'Phone login isn’t available — please use email, a password, Google, or a passkey.' });
    }

    let user = await User.findOne(email ? { email } : { phone });
    if (!user) {
      user = await User.create({
        ...(email ? { email, emailVerified: true } : { phone, phoneVerified: true }),
        createdAt: new Date(),
        verification: { level: 'phone_only', trustScore: 10 },
        membership: { joinFeePaid: false, tier: 'free' },
        status: { active: true, suspended: false, banned: false }
      });
    }

    // Login gates (spec §2.1.3)
    if (user.status?.banned) return res.status(403).json({ error: 'This number is not eligible for Sambandh.' });

    // Logging in within 30 days of a deletion request cancels it (spec §2.8.4)
    if (user.status?.deletedAt) {
      if (Date.now() - user.status.deletedAt < 30 * 86400000) {
        await User.findByIdAndUpdate(user._id, {
          'status.active': true, 'status.deletedAt': null
        });
        const Notification = require('./models/Notification');
        await Notification.create({
          userId: user._id, type: 'deletion_cancelled', severity: 'info',
          title: 'Welcome back — deletion cancelled',
          body: 'You logged in within 30 days, so your account deletion was cancelled and your profile is live again.'
        });
        user.status.deletedAt = null;
      } else {
        return res.status(403).json({ error: 'This account was deleted.' });
      }
    }

    if (user.status?.suspended) {
      if (user.suspension?.endsAt && user.suspension.endsAt < new Date()) {
        await User.findByIdAndUpdate(user._id, { 'status.suspended': false, 'suspension.endsAt': null });
      } else {
        return res.status(403).json({ error: 'Your account is suspended. Check your notifications for details.' });
      }
    }

    // Second factor: if the user enabled an authenticator, the OTP alone is not
    // enough — require a valid TOTP or a one-time backup code before issuing the token.
    if (user.security?.totp?.confirmedAt) {
      const { verifyTotp, matchBackupCode } = require('./services/twofa');
      const totp = parsed.data.totp;
      const backupCode = parsed.data.backupCode;
      if (!totp && !backupCode) {
        return res.json({ twoFactorRequired: true }); // client re-submits with `totp`
      }
      let ok = false;
      if (totp && verifyTotp(user.security.totp.secret, totp)) ok = true;
      else if (backupCode) {
        const idx = matchBackupCode(backupCode, user.security.backupCodes || []);
        if (idx >= 0) {
          const codes = user.security.backupCodes.slice();
          codes[idx] = { ...(codes[idx].toObject?.() || codes[idx]), usedAt: new Date() };
          await User.findByIdAndUpdate(user._id, { 'security.backupCodes': codes });
          ok = true;
        }
      }
      if (!ok) return res.status(401).json({ error: 'Invalid 2FA code', twoFactorRequired: true });
      await User.findByIdAndUpdate(user._id, { 'security.totp.lastUsedAt': new Date() });
    }

    if (email || DEV_MODE) otpStore.delete(id); // all checks passed — consume the OTP now
    await User.findByIdAndUpdate(user._id, { lastActiveAt: new Date() });
    const token = issueToken(res, user);
    track('otp_verified', user._id, { newUser: !user.profile?.firstName });

    res.json({
      token,
      user: {
        id: user._id, phone: user.phone, email: user.email, role: user.role || 'user',
        hasProfile: !!user.profile?.firstName,
        verificationLevel: user.verification.level,
        idVerified: !!user.verification.idVerified,
        joinFeePaid: user.membership.joinFeePaid,
        intent: user.intent || [],
        hasPhotos: (user.profile?.photos || []).length > 0
      }
    });
  } catch (err) { next(err); }
});

// 3. Logout — blacklist the current token until its natural expiry
router.post('/logout', requireAuth, async (req, res, next) => {
  try {
    const token = readToken(req);
    if (!token) return res.status(401).json({ error: 'Missing token' });
    const decoded = jwt.decode(token);
    const exp = (decoded && typeof decoded === 'object' && typeof decoded.exp === 'number')
      ? decoded.exp : Math.floor(Date.now() / 1000) + 60;
    await TokenBlacklist.create({
      tokenHash: sha256(token),
      expiresAt: new Date(exp * 1000)
    }).catch(() => {}); // duplicate = already logged out
    res.clearCookie(COOKIE_NAME);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// 4. Complete signup — basic profile (city validated against cities list)
router.post('/complete-signup', requireAuth, async (req, res, next) => {
  try {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Fill all fields correctly (name: letters only)' });

    const city = findCity(parsed.data.city);
    if (!city) return res.status(400).json({ error: 'Please pick a city from the list' });

    const dob = new Date(parsed.data.dob);
    const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    if (age < 18) return res.status(400).json({ error: 'You must be 18 or older to use Sambandh' });

    const user = await User.findByIdAndUpdate(req.userId, {
      'profile.firstName': parsed.data.firstName.trim(),
      'profile.displayName': (parsed.data.displayName || parsed.data.firstName).trim(),
      'profile.gender': parsed.data.gender,
      'profile.dob': parsed.data.dob,
      'profile.age': age,
      'profile.city': city.name,
      'profile.state': city.state,
      'profile.country': 'IN',
      'profile.languages': parsed.data.languages
    }, { new: true });

    track('signup_completed', req.userId, { city: city.name, gender: parsed.data.gender });
    res.json({ ok: true, user });
  } catch (err) { next(err); }
});

// 5. Current user
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user, refreshedToken: req.refreshedToken || null });
  } catch (err) { next(err); }
});

// 6. Update profile
router.patch('/profile', requireAuth, async (req, res, next) => {
  try {
    const parsed = profileSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid profile data (intent: max 2)' });
    const d = parsed.data;

    const before = await User.findById(req.userId);
    // A dotted-path $set map. Without the annotation TS infers a narrow literal
    // type from the first assignments and rejects every later key.
    /** @type {Record<string, unknown>} */
    const updates = {};
    if (d.bio !== undefined) updates['profile.bio'] = d.bio;
    if (d.displayName) updates['profile.displayName'] = d.displayName;
    if (d.languages) updates['profile.languages'] = d.languages;
    if (d.city) {
      const city = findCity(d.city);
      if (!city) return res.status(400).json({ error: 'Please pick a city from the list' });
      updates['profile.city'] = city.name;
      updates['profile.state'] = city.state;
    }
    if (d.intent) updates.intent = d.intent;
    if (d.interestedInGenders) updates['preferences.interestedInGenders'] = d.interestedInGenders;
    // Self-declared features. null → remove the whole nature profile (and its
    // provenance); otherwise dotted paths so a partial update keeps untouched
    // fields. Each field the user sets is stamped source:'self', which makes it
    // WIN over any later CV geometric guess (see services/feature-guard.js).
    if (d.features === null) { updates.features = {}; updates.featureSources = {}; }
    else if (d.features) for (const [k, v] of Object.entries(d.features)) {
      updates['features.' + k] = v;
      updates['featureSources.' + k] = 'self';
    }
    if (d.astrology) {
      updates['astrology.birthDate'] = d.astrology.birthDate;
      if (d.astrology.birthTime !== undefined) updates['astrology.birthTime'] = d.astrology.birthTime;
      if (d.astrology.birthPlace) {
        updates['astrology.birthPlace.city'] = d.astrology.birthPlace.city;
        updates['astrology.birthPlace.state'] = d.astrology.birthPlace.state || '';
        const c = findCity(d.astrology.birthPlace.city);
        if (c) { updates['astrology.birthPlace.lat'] = c.lat; updates['astrology.birthPlace.lng'] = c.lng; }
      }
      // Compute and cache the sidereal Moon chart on the user record (spec §2.2.6, §2.6.1)
      const { chartFor } = require('./services/astro');
      const chart = chartFor(d.astrology);
      if (chart) {
        updates['astrology.sunSign'] = chart.sunSign;
        updates['astrology.moonSign'] = chart.rashiEn;
        updates['astrology.rashi'] = chart.rashi;
        updates['astrology.nakshatra'] = chart.nakshatra;
        updates['astrology.pada'] = chart.pada;
      }
      updates['astrology.computedAt'] = new Date();
    }

    if (d.photos) {
      const { photoBytesHash } = require('./services/risk-engine');
      const { classifyDecision } = require('./services/moderation');
      // The verified selfie always stays pinned as the first (primary) photo
      const selfiePhoto = (before.profile?.photos || []).find((/** @type {any} */ p) => p.fromSelfie);
      /** @type {Array<Record<string, unknown>>} */
      const stored = selfiePhoto
        ? [{ url: selfiePhoto.url, isPrimary: true, fromSelfie: true, uploadedAt: selfiePhoto.uploadedAt }]
        : [];
      const hashes = new Set(Array.isArray(before.photoHashes) ? before.photoHashes : []);
      const flaggedForReview = [];
      for (let i = 0; i < d.photos.length && stored.length < 6; i++) {
        const p = d.photos[i];
        const buffer = Buffer.from(p.base64, 'base64');
        if (buffer.length > 10 * 1024 * 1024) return res.status(400).json({ error: 'Photo too large (max 10MB)' });
        // NSFW gate — profile photos must be SFW (scores classified in the browser)
        const mod = p.nsfw ? classifyDecision(p.nsfw) : null;
        if (mod && mod.decision === 'block') {
          return res.status(400).json({ error: 'That photo looks explicit — profile photos must be safe-for-work. Please choose another.' });
        }
        const ext = (p.filename.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
        const key = `users/${req.userId}/photos/${Date.now()}_${i}.${ext}`;
        const url = await uploadToR2(key, buffer, ext === 'png' ? 'image/png' : 'image/jpeg');
        /** @type {Record<string, unknown>} */
        const photo = { url, isPrimary: stored.length === 0, uploadedAt: new Date() };
        if (mod && mod.decision === 'review') { photo.moderation = { nsfwScore: mod.nsfwScore, decision: 'review' }; flaggedForReview.push(mod.nsfwScore); }
        stored.push(photo);
        hashes.add(photoBytesHash(buffer)); // fingerprint for catfish / stolen-photo detection
      }
      updates['profile.photos'] = stored;
      updates.photoHashes = [...hashes];
      // Borderline photos are kept but queued for a human moderator.
      if (flaggedForReview.length) {
        const Report = require('./models/Report');
        await Report.create({
          source: 'system', reportedUserId: req.userId, category: 'other', status: 'pending',
          description: `Profile photo(s) flagged as possibly suggestive (NSFW score ${Math.max(...flaggedForReview)}) — needs a moderator look`,
          createdAt: new Date()
        }).catch(() => {});
      }
    }

    const user = await User.findByIdAndUpdate(req.userId, updates, { new: true });
    events.record('ProfileUpdated', { userId: req.userId, payload: { fields: Object.keys(updates || {}) } }); // behavioural event log

    // Spec §2.2.2: intent change posts a system message into all active chats
    if (d.intent && JSON.stringify(before.intent || []) !== JSON.stringify(d.intent)) {
      const chats = await Chat.find({ participants: req.userId, status: 'active' });
      const name = before.profile?.displayName || before.profile?.firstName || 'This user';
      for (const chat of chats) {
        const to = chat.participants.find((/** @type {any} */ p) => p.toString() !== req.userId);
        await Message.create({
          chatId: chat._id, from: req.userId, to,
          text: `${name} has updated their intent to: ${d.intent.join(', ')}`,
          type: 'system', createdAt: new Date()
        });
      }
    }

    res.json({ ok: true, user });
  } catch (err) { next(err); }
});

// 7. Delete account — erasure within 30 days (DPDP Act 2023)
router.post('/delete-account', requireAuth, async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.userId, {
      'status.active': false,
      'status.deletedAt': new Date()
    });
    res.json({ ok: true, message: 'Account queued for deletion. All data will be erased within 30 days. Log in within 30 days to cancel.' });
  } catch (err) { next(err); }
});

// ---- Username + password auth ----
const bcrypt = require('bcryptjs');

// A real bcrypt hash of a value nothing will ever match. Login compares against
// this when the account does not exist, so the unknown-user path costs the same
// as the wrong-password path (see /login). Computed once at load.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('sambandh-no-such-account-placeholder', 10);

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
const registerSchema = z.object({
  username: z.string().regex(USERNAME_RE).optional(),
  email: z.string().email().max(200).optional(),
  password: z.string().min(8).max(200)
}).refine(d => d.email || d.username, { message: 'Provide an email or username' });
const loginSchema = z.object({
  identifier: z.string().min(3).max(200),   // username or email
  password: z.string().min(1).max(200),
  totp: z.string().regex(/^\d{6}$/).optional(),
  backupCode: z.string().max(20).optional()
});

// POST /auth/register — create an account with email (or username) + password
router.post('/register', ipLimit, async (req, res, next) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Enter a valid email and a password of at least 8 characters.' });
    const username = parsed.data.username ? parsed.data.username.toLowerCase() : undefined;
    const email = parsed.data.email ? parsed.data.email.toLowerCase() : undefined;
    if (username && await User.findOne({ username })) return res.status(409).json({ error: 'That username is taken.' });
    if (email && await User.findOne({ email })) return res.status(409).json({ error: 'That email already has an account — sign in instead.' });
    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    const user = await User.create({
      ...(username ? { username } : {}), ...(email ? { email } : {}), passwordHash, createdAt: new Date(),
      verification: { level: 'phone_only', trustScore: 10 },
      membership: { joinFeePaid: false, tier: 'free' },
      status: { active: true, suspended: false, banned: false }
    });
    track('register_password', user._id, {});
    events.record('UserJoined', { userId: user._id, payload: { via: 'password' } }); // behavioural event log
    const token = issueToken(res, user);
    res.json({ token, user: { id: user._id, username: user.username, email: user.email, hasProfile: false } });
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 11000) return res.status(409).json({ error: 'That email or username is already taken.' });
    next(err);
  }
});

// POST /auth/login — password login (username or email), 2FA-aware
router.post('/login', ipLimit, async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Enter your username/email and password.' });
    const id = parsed.data.identifier.toLowerCase();
    const user = await User.findOne(id.includes('@') ? { email: id } : { username: id });
    // Constant-ish response: ALWAYS run exactly one bcrypt compare, even when the
    // account does not exist. Comparing against a dummy hash costs the same as a
    // real one, so response time cannot reveal whether an email is registered.
    // (Previously this short-circuited to `false` for unknown users, making them
    // answer measurably faster — a user-enumeration oracle.)
    const hash = (user && user.passwordHash) || DUMMY_PASSWORD_HASH;
    const match = await bcrypt.compare(parsed.data.password, hash);
    const ok = !!(user && user.passwordHash) && match;
    if (!ok) return res.status(401).json({ error: 'Wrong username/email or password.' });
    await completeLogin(req, res, user);
  } catch (err) { next(err); }
});

// ---- Google account login ----
// GET /auth/config — public config for the login screen (Google client id if set)
// + the pre-launch flag so the app knows whether to show the early-access waiting
// room instead of the dating features.
router.get('/config', async (req, res, next) => {
  try {
    const { isPrelaunch } = require('./services/site-mode');
    res.json({
      googleClientId: process.env.GOOGLE_CLIENT_ID || null,
      prelaunch: await isPrelaunch()
    });
  } catch (err) { next(err); }
});

// POST /auth/google — verify a Google ID token (One Tap / Sign-In), then log in
router.post('/google', ipLimit, async (req, res, next) => {
  try {
    const credential = req.body.credential;
    if (!credential) return res.status(400).json({ error: 'Missing Google credential' });
    if (!process.env.GOOGLE_CLIENT_ID) return res.status(503).json({ error: 'Google sign-in is not configured yet.' });
    const { OAuth2Client } = require('google-auth-library');
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    const ticket = await client.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    if (!payload?.email_verified || !payload.email) return res.status(401).json({ error: 'Google email not verified' });
    const email = payload.email.toLowerCase();
    let user = await User.findOne({ googleId: payload.sub }) || await User.findOne({ email });
    if (!user) {
      user = await User.create({
        email, emailVerified: true, googleId: payload.sub, createdAt: new Date(),
        profile: { firstName: (payload.given_name || '').slice(0, 50) },
        verification: { level: 'phone_only', trustScore: 10 },
        membership: { joinFeePaid: false, tier: 'free' },
        status: { active: true, suspended: false, banned: false }
      });
    } else if (!user.googleId) {
      await User.findByIdAndUpdate(user._id, { googleId: payload.sub, emailVerified: true });
    }
    track('login_google', user._id, {});
    await completeLogin(req, res, user);
  } catch (err) {
    if (/audience|Invalid token|Wrong number/i.test(errMsg(err))) return res.status(401).json({ error: 'Invalid Google credential' });
    next(err);
  }
});

// ---- Two-factor authentication (authenticator app / TOTP) ----

// GET /auth/2fa/status
router.get('/2fa/status', (req, res, next) => requireAuth(req, res, async () => {
  try {
    const user = await User.findById(req.userId);
    res.json({ enabled: !!user.security?.totp?.confirmedAt, faceEnrolled: !!user.faceEnrolledAt });
  } catch (err) { next(err); }
}));

// POST /auth/2fa/setup — generate a secret (unconfirmed); return the QR URI + secret
router.post('/2fa/setup', (req, res, next) => requireAuth(req, res, async () => {
  try {
    const { generateTotpSecret, otpauthUri, formatSecret } = require('./services/twofa');
    const user = await User.findById(req.userId);
    if (user.security?.totp?.confirmedAt) return res.status(400).json({ error: '2FA already enabled' });
    const secret = generateTotpSecret();
    await User.findByIdAndUpdate(req.userId, { 'security.totp': { secret, confirmedAt: null } });
    const account = user.email || user.phone || String(user._id);
    res.json({ otpauthUri: otpauthUri(secret, account), secret: formatSecret(secret) });
  } catch (err) { next(err); }
}));

// POST /auth/2fa/enable — confirm with a code; returns one-time backup codes
router.post('/2fa/enable', (req, res, next) => requireAuth(req, res, async () => {
  try {
    const { verifyTotp, generateBackupCodes } = require('./services/twofa');
    const user = await User.findById(req.userId);
    const secret = user.security?.totp?.secret;
    if (!secret) return res.status(400).json({ error: 'Start setup first' });
    if (user.security.totp.confirmedAt) return res.status(400).json({ error: 'Already enabled' });
    if (!verifyTotp(secret, req.body.totp)) return res.status(401).json({ error: 'Code incorrect — check your authenticator app' });
    const { plain, stored } = generateBackupCodes();
    await User.findByIdAndUpdate(req.userId, {
      'security.totp.confirmedAt': new Date(), 'security.backupCodes': stored
    });
    res.json({ ok: true, enabled: true, backupCodes: plain });
  } catch (err) { next(err); }
}));

// POST /auth/2fa/disable — requires a current code (or backup code)
router.post('/2fa/disable', (req, res, next) => requireAuth(req, res, async () => {
  try {
    const { verifyTotp, matchBackupCode } = require('./services/twofa');
    const user = await User.findById(req.userId);
    if (!user.security?.totp?.confirmedAt) return res.status(400).json({ error: '2FA is not enabled' });
    const ok = verifyTotp(user.security.totp.secret, req.body.totp) ||
      matchBackupCode(req.body.backupCode || '', user.security.backupCodes || []) >= 0;
    if (!ok) return res.status(401).json({ error: 'Code incorrect' });
    await User.findByIdAndUpdate(req.userId, { 'security.totp': null, 'security.backupCodes': [] });
    res.json({ ok: true, enabled: false });
  } catch (err) { next(err); }
}));

// ---- WebAuthn passkeys (fingerprint / Face ID / Windows Hello / security key) ----

// Short-lived challenge store (5 min). reg:<userId> for enrolment, login:<challenge> for sign-in.
const challengeStore = new Map();
/** @param {string} key @param {object} data */
function putChallenge(key, data) { challengeStore.set(key, { ...data, expiresAt: Date.now() + 5 * 60 * 1000 }); }
/** @param {string} key */
function takeChallenge(key) {
  const c = challengeStore.get(key);
  if (!c || c.expiresAt < Date.now()) { challengeStore.delete(key); return null; }
  challengeStore.delete(key);
  return c;
}

// Enrol a passkey (signed-in user)
router.post('/passkey/register-options', (req, res, next) => requireAuth(req, res, async () => {
  try {
    const wa = require('./services/webauthn');
    const user = await User.findById(req.userId);
    const { origin, rpId } = wa.rpFromRequest(req);
    const challenge = wa.newChallenge();
    putChallenge('reg:' + req.userId, { challenge, origin, rpId });
    const options = await wa.registrationOptions({ userId: req.userId, email: user.email, name: user.profile?.firstName, rpId, challenge });
    res.json({ ok: true, options });
  } catch (err) { next(err); }
}));

router.post('/passkey/register-verify', (req, res, next) => requireAuth(req, res, async () => {
  try {
    const wa = require('./services/webauthn');
    const exp = takeChallenge('reg:' + req.userId);
    if (!exp) return res.status(400).json({ error: 'Challenge expired — try again' });
    const result = await wa.verifyRegistration(req.userId, req.body, exp);
    res.json({ ok: true, credentialId: result.credentialId });
  } catch (err) { res.status(400).json({ error: errMsg(err) }); }
}));

// Passwordless / step-up sign-in with a passkey
router.post('/passkey/login-options', async (req, res, next) => {
  try {
    const wa = require('./services/webauthn');
    const { origin, rpId } = wa.rpFromRequest(req);
    const challenge = wa.newChallenge();
    putChallenge('login:' + challenge, { challenge, origin, rpId });
    const options = await wa.authenticationOptions(null, rpId, challenge); // discoverable: browser picks the passkey
    res.json({ ok: true, options });
  } catch (err) { next(err); }
});

router.post('/passkey/login-verify', async (req, res, next) => {
  try {
    const wa = require('./services/webauthn');
    const clientData = JSON.parse(wa.b64urlToBuf(req.body.response.clientDataJSON).toString('utf8'));
    const exp = takeChallenge('login:' + clientData.challenge);
    if (!exp) return res.status(400).json({ error: 'Challenge expired — try again' });
    const { userId } = await wa.verifyAuthentication(req.body, exp);
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'Account not found' });
    if (user.status?.banned) return res.status(403).json({ error: 'This account is not eligible for Sambandh.' });
    if (user.status?.deletedAt && Date.now() - user.status.deletedAt >= 30 * 86400000) return res.status(403).json({ error: 'This account was deleted.' });
    if (user.status?.suspended && (!user.suspension?.endsAt || user.suspension.endsAt > new Date())) return res.status(403).json({ error: 'Your account is suspended.' });
    await User.findByIdAndUpdate(user._id, { lastActiveAt: new Date() });
    const token = issueToken(res, user);
    track('passkey_login', user._id, {});
    res.json({ ok: true, token, user: { id: user._id, email: user.email, phone: user.phone, hasProfile: !!user.profile?.firstName } });
  } catch (err) { res.status(400).json({ error: errMsg(err) }); }
});

router.get('/passkey/list', (req, res, next) => requireAuth(req, res, async () => {
  try { res.json({ passkeys: await require('./services/webauthn').listPasskeys(req.userId) }); }
  catch (err) { next(err); }
}));
router.delete('/passkey/:id', (req, res, next) => requireAuth(req, res, async () => {
  try { await require('./services/webauthn').deletePasskey(req.userId, req.params.id); res.json({ ok: true }); }
  catch (err) { next(err); }
}));

// ---- Middleware ----

/** @type {import('express').RequestHandler} */
async function requireAuth(req, res, next) {
  const token = readToken(req);
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    const decoded = /** @type {import('jsonwebtoken').JwtPayload} */ (jwt.verify(token, jwtSecret()));

    // Logout blacklist check
    const black = await TokenBlacklist.findOne({ tokenHash: sha256(token) }).lean();
    if (black) return res.status(401).json({ error: 'Session ended — log in again' });

    req.userId = decoded.userId;
    req.phone = decoded.phone;
    req.role = decoded.role || 'user';

    // Auto-refresh when within 7 days of expiry (spec §2.1.2)
    if ((decoded.exp || 0) * 1000 - Date.now() < 7 * 24 * 3600 * 1000) {
      req.refreshedToken = issueToken(res, { _id: decoded.userId, phone: decoded.phone, role: decoded.role });
    }
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Super admin: SUPER_ADMIN_KEY header only (the platform owner). Full access,
// including audited chat inspection. Admins/moderators can NEVER pass this.
/** @type {import('express').RequestHandler} */
function requireSuperAdmin(req, res, next) {
  const key = req.headers['x-super-key'];
  if (key && process.env.SUPER_ADMIN_KEY && key === process.env.SUPER_ADMIN_KEY) {
    req.userId = 'super-admin';
    req.role = 'super_admin';
    return next();
  }
  return res.status(401).json({ error: 'Super admin access required' });
}

// Admin: moderator/admin user token, or ADMIN_API_KEY header (admin panel).
// The super admin key also passes (full access includes everything admins can do);
// the reverse is never true — the admin key does not open super admin routes.
/** @type {import('express').RequestHandler} */
function requireAdmin(req, res, next) {
  const superKey = req.headers['x-super-key'];
  if (superKey && process.env.SUPER_ADMIN_KEY && superKey === process.env.SUPER_ADMIN_KEY) {
    req.userId = 'super-admin';
    req.role = 'super_admin';
    return next();
  }
  const key = req.headers['x-admin-key'];
  if (key && process.env.ADMIN_API_KEY && key === process.env.ADMIN_API_KEY) {
    req.userId = 'admin-panel';
    req.role = 'admin';
    return next();
  }
  return requireAuth(req, res, () => {
    if (req.role === 'admin' || req.role === 'moderator') return next();
    return res.status(403).json({ error: 'Moderator access required' });
  });
}

module.exports = Object.assign(router, { requireAuth, requireAdmin, requireSuperAdmin, completeLogin });

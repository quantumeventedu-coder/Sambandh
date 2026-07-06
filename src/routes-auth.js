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
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const User = require('./models/User');
const Chat = require('./models/Chat');
const Message = require('./models/Message');
const TokenBlacklist = require('./models/TokenBlacklist');
const { findCity } = require('./data/cities');
const { uploadToR2 } = require('./services/storage');
const { track } = require('./services/analytics');

const router = express.Router();

const DEV_MODE = process.env.DEV_MODE === 'true' || !process.env.FIREBASE_PROJECT_ID;
const OTP_VALIDITY_MS = 60 * 1000;          // spec: 60 seconds
const OTP_MAX_PER_HOUR = DEV_MODE ? 100 : 3;
const OTP_WRONG_LIMIT = 5;                   // then 30-minute lock
const OTP_LOCK_MS = 30 * 60 * 1000;
const COOKIE_NAME = 'sb_token';

// phone -> { code, expiresAt, wrongAttempts, lockedUntil, requests: [timestamps] }
const otpStore = new Map();

const ipLimit = rateLimit({ windowMs: 60 * 60 * 1000, max: DEV_MODE ? 500 : 20 });

// ---- Schemas ----
const INDIAN_PHONE = /^\+91[6-9][0-9]{9}$/;
const requestOtpSchema = z.object({ phone: z.string().regex(INDIAN_PHONE) });
const verifyOtpSchema = z.object({
  phone: z.string().regex(INDIAN_PHONE),
  firebaseIdToken: z.string().optional(),
  otp: z.string().regex(/^\d{6}$/).optional()
});

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
  intent: z.array(z.enum(['marriage', 'dating', 'casual', 'friendship'])).min(1).max(2).optional(),
  interestedInGenders: z.array(z.enum(['male', 'female', 'non_binary', 'other'])).optional(),
  astrology: z.object({
    birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    birthTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
    birthPlace: z.object({ city: z.string(), state: z.string().optional() }).optional()
  }).optional(),
  photos: z.array(z.object({
    base64: z.string(),
    filename: z.string(),
    isPrimary: z.boolean().optional()
  })).max(6).optional()
});

// ---- Token helpers ----

function issueToken(res, user) {
  const token = jwt.sign(
    { userId: user._id.toString(), phone: user.phone, role: user.role || 'user' },
    process.env.JWT_SECRET,
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

const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');

// ---- Routes ----

// 1. Request OTP (3/phone/hour; 30-min lock after 5 wrong attempts)
router.post('/request-otp', ipLimit, (req, res) => {
  const parsed = requestOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Please enter a valid 10-digit Indian mobile number' });
  }
  const phone = parsed.data.phone;
  const now = Date.now();
  const entry = otpStore.get(phone) || { requests: [], wrongAttempts: 0 };

  if (entry.lockedUntil && entry.lockedUntil > now) {
    const mins = Math.ceil((entry.lockedUntil - now) / 60000);
    return res.status(429).json({ error: `Too many attempts. Try again in ${mins} minutes.` });
  }
  entry.requests = entry.requests.filter(t => now - t < 3600 * 1000);
  if (entry.requests.length >= OTP_MAX_PER_HOUR) {
    return res.status(429).json({ error: 'Too many attempts. Try again in 60 minutes.' });
  }
  entry.requests.push(now);

  if (DEV_MODE) {
    entry.code = String(Math.floor(100000 + Math.random() * 900000));
    entry.expiresAt = now + (DEV_MODE ? 5 * 60 * 1000 : OTP_VALIDITY_MS); // dev: 5 min for convenience
    entry.wrongAttempts = 0;
    otpStore.set(phone, entry);
    console.log(`[DEV OTP] ${phone} → ${entry.code}`);
    return res.json({ ok: true, devMode: true, devOtp: entry.code, validSeconds: 300 });
  }

  otpStore.set(phone, entry);
  // Production: the client triggers Firebase SDK to send the SMS
  res.json({ ok: true, devMode: false, validSeconds: 60, message: 'Use Firebase SDK to send OTP from client' });
});

// 2. Verify OTP — issues Sambandh JWT (cookie + body)
router.post('/verify-otp', async (req, res, next) => {
  try {
    const parsed = verifyOtpSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid request' });
    const { phone, firebaseIdToken, otp } = parsed.data;
    const now = Date.now();

    if (DEV_MODE) {
      const entry = otpStore.get(phone);
      if (entry?.lockedUntil && entry.lockedUntil > now) {
        return res.status(429).json({ error: 'Locked after too many wrong attempts. Try again in 30 minutes.' });
      }
      if (!entry || !entry.code || entry.expiresAt < now || entry.code !== otp) {
        if (entry) {
          entry.wrongAttempts = (entry.wrongAttempts || 0) + 1;
          if (entry.wrongAttempts >= OTP_WRONG_LIMIT) {
            entry.lockedUntil = now + OTP_LOCK_MS;
            entry.wrongAttempts = 0;
          }
          otpStore.set(phone, entry);
        }
        return res.status(401).json({ error: 'Wrong or expired OTP' });
      }
      otpStore.delete(phone);
    } else {
      if (!firebaseIdToken) return res.status(400).json({ error: 'firebaseIdToken required' });
      const firebaseAdmin = require('firebase-admin');
      const decoded = await firebaseAdmin.auth().verifyIdToken(firebaseIdToken);
      if (decoded.phone_number !== phone) return res.status(401).json({ error: 'Phone mismatch' });
    }

    let user = await User.findOne({ phone });
    if (!user) {
      user = await User.create({
        phone, phoneVerified: true, createdAt: new Date(),
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

    await User.findByIdAndUpdate(user._id, { lastActiveAt: new Date() });
    const token = issueToken(res, user);
    track('otp_verified', user._id, { newUser: !user.profile?.firstName });

    res.json({
      token,
      user: {
        id: user._id, phone: user.phone, role: user.role || 'user',
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
    const decoded = jwt.decode(token);
    await TokenBlacklist.create({
      tokenHash: sha256(token),
      expiresAt: new Date((decoded?.exp || Math.floor(Date.now() / 1000) + 60) * 1000)
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
    const age = Math.floor((Date.now() - dob) / (365.25 * 24 * 60 * 60 * 1000));
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
      // The verified selfie always stays pinned as the first (primary) photo
      const selfiePhoto = (before.profile?.photos || []).find(p => p.fromSelfie);
      const stored = selfiePhoto
        ? [{ url: selfiePhoto.url, isPrimary: true, fromSelfie: true, uploadedAt: selfiePhoto.uploadedAt }]
        : [];
      for (let i = 0; i < d.photos.length && stored.length < 6; i++) {
        const p = d.photos[i];
        const buffer = Buffer.from(p.base64, 'base64');
        if (buffer.length > 10 * 1024 * 1024) return res.status(400).json({ error: 'Photo too large (max 10MB)' });
        const ext = (p.filename.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
        const key = `users/${req.userId}/photos/${Date.now()}_${i}.${ext}`;
        const url = await uploadToR2(key, buffer, ext === 'png' ? 'image/png' : 'image/jpeg');
        stored.push({ url, isPrimary: stored.length === 0, uploadedAt: new Date() });
      }
      updates['profile.photos'] = stored;
    }

    const user = await User.findByIdAndUpdate(req.userId, updates, { new: true });

    // Spec §2.2.2: intent change posts a system message into all active chats
    if (d.intent && JSON.stringify(before.intent || []) !== JSON.stringify(d.intent)) {
      const chats = await Chat.find({ participants: req.userId, status: 'active' });
      const name = before.profile?.displayName || before.profile?.firstName || 'This user';
      for (const chat of chats) {
        const to = chat.participants.find(p => p.toString() !== req.userId);
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

// ---- Middleware ----

async function requireAuth(req, res, next) {
  const token = readToken(req);
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Logout blacklist check
    const black = await TokenBlacklist.findOne({ tokenHash: sha256(token) }).lean();
    if (black) return res.status(401).json({ error: 'Session ended — log in again' });

    req.userId = decoded.userId;
    req.phone = decoded.phone;
    req.role = decoded.role || 'user';

    // Auto-refresh when within 7 days of expiry (spec §2.1.2)
    if (decoded.exp * 1000 - Date.now() < 7 * 24 * 3600 * 1000) {
      req.refreshedToken = issueToken(res, { _id: decoded.userId, phone: decoded.phone, role: decoded.role });
    }
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Super admin: SUPER_ADMIN_KEY header only (the platform owner). Full access,
// including audited chat inspection. Admins/moderators can NEVER pass this.
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

router.requireAuth = requireAuth;
router.requireAdmin = requireAdmin;
router.requireSuperAdmin = requireSuperAdmin;
module.exports = router;

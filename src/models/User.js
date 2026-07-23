const mongoose = require('../db/odm');
const UserSchema = new mongoose.Schema({
  // Either email (OTP by email — the primary channel) or phone identifies an
  // account. Both are unique-when-present; at least one is set at signup.
  phone: { type: String, unique: true, sparse: true, index: true },
  phoneVerified: { type: Boolean, default: false },
  email: { type: String, unique: true, sparse: true, index: true },
  emailVerified: { type: Boolean, default: false },
  username: { type: String, unique: true, sparse: true, index: true }, // optional login handle
  passwordHash: String,                                                 // bcrypt; set for password logins
  googleId: { type: String, unique: true, sparse: true, index: true }, // Google account subject id
  pushSubscriptions: [mongoose.Schema.Types.Mixed], // web-push endpoints (browser notifications)
  createdAt: { type: Date, default: Date.now },
  lastActiveAt: { type: Date, default: Date.now },
  profile: {
    firstName: String, displayName: String,
    gender: { type: String, enum: ['male', 'female', 'non_binary', 'other'] },
    dob: String, age: Number, city: String, state: String,
    country: { type: String, default: 'IN' },
    // Precise device location (browser Geolocation). Powers real distance in
    // discover/recommender instead of city centroids. City stays as a coarse
    // fallback + display. lat/lng are never exposed to other users.
    location: { lat: Number, lng: Number, accuracy: Number, updatedAt: Date },
    languages: [String], bio: String,
    photos: [{ url: String, isPrimary: Boolean, fromSelfie: Boolean, uploadedAt: Date }]
  },
  intent: [{ type: String, enum: ['marriage', 'dating', 'casual', 'friendship', 'networking'] }],
  claims: {
    profession: { title: String, company: String, verified: { type: Boolean, default: false }, verificationId: mongoose.Schema.Types.ObjectId },
    education: { degree: String, institution: String, year: Number, verified: { type: Boolean, default: false }, verificationId: mongoose.Schema.Types.ObjectId },
    income: { annualINR: Number, verified: { type: Boolean, default: false } },
    religion: { value: String, verified: { type: Boolean, default: false } },
    height: { cm: Number }
  },
  astrology: {
    birthDate: String, birthTime: String,
    birthPlace: { city: String, state: String, lat: Number, lng: Number },
    sunSign: String, moonSign: String, rashi: String, nakshatra: String,
    mangalDosha: Boolean, computedAt: Date
  },
  // Temperament features (Samudrika). Two sanctioned writers now: the user via the
  // profile form (self-declared), and geometric CV via services/feature-guard.js —
  // never anything else. CV writes GEOMETRY only (never complexion), fills only
  // fields the user hasn't declared, and its output surfaces as a READING, never
  // "verified". Provenance per field lives in `featureSources`.
  features: {
    forehead: String, eyes: String, voice: String, gait: String, hands: String, build: String
  },
  // Per-field provenance: 'self' (user typed it) | 'cv' (geometric read). Absent →
  // treated as self-declared. Drives the reading-vs-fact badge and the "self wins
  // over CV" merge rule in feature-guard.applyCvFeatures.
  featureSources: {
    forehead: String, eyes: String, voice: String, gait: String, hands: String, build: String
  },
  // Separate, explicit consent for the geometric read — NOT implied by uploading a
  // photo or by ID verification. No consent → feature-guard refuses to write.
  cvConsent: {
    geometry: { type: Boolean, default: false },
    at: Date
  },
  verification: {
    level: { type: String, enum: ['phone_only', 'photo_verified', 'id_verified', 'profession_verified', 'fully_verified'], default: 'phone_only' },
    idVerified: { type: Boolean, default: false }, idType: String, idVerifiedAt: Date,
    selfieVerified: { type: Boolean, default: false },
    professionVerified: { type: Boolean, default: false },
    educationVerified: { type: Boolean, default: false },
    incomeVerified: { type: Boolean, default: false },
    trustScore: { type: Number, default: 10 }
  },
  membership: {
    joinFeePaid: { type: Boolean, default: false },
    joinFeeAmountCHF: Number,
    joinFeeAmountUSD: Number, joinFeeAmountINR: Number, // legacy, unused
    joinFeePaymentId: mongoose.Schema.Types.ObjectId, paidAt: Date,
    // 'free' = no active membership (cannot use the app). Everything is paid:
    // base CHF 1/5/3 per month by gender · pro CHF 6/mo · max CHF 15/mo.
    tier: { type: String, enum: ['free', 'base', 'pro', 'max'], default: 'free' },
    tierExpiresAt: Date,
    // Early access: registered + paid DURING pre-launch. Their paid days must not be
    // consumed while the app is gated — at launch their 30 days are (re)started, so
    // they get a full 30-day free run once the doors open (site-mode.setPrelaunch).
    earlyAccess: { type: Boolean, default: false },
    trialGrantedAt: Date
  },
  preferences: {
    interestedInGenders: [String],
    ageRange: { min: Number, max: Number },
    maxDistanceKm: Number, intentFilter: [String],
    anonymousModeEnabled: { type: Boolean, default: false },
    showProfessionToOthers: { type: Boolean, default: true },
    showAstrologyToOthers: { type: Boolean, default: true },
    allowNSFWChats: { type: Boolean, default: false },
    // Opt-in: let Sambandh's own match model learn from your anonymised swipe
    // outcomes (no names/messages — see services/trainer.js). Default off.
    aiTrainingConsent: { type: Boolean, default: false },
    // Per-type delivery channels (spec §2.8.3). Karma updates are always on.
    notificationPrefs: {
      new_match: { type: String, enum: ['push', 'email', 'both', 'none'], default: 'both' },
      new_message: { type: String, enum: ['push', 'email', 'both', 'none'], default: 'push' },
      message_while_away: { type: String, enum: ['push', 'email', 'both', 'none'], default: 'push' },
      verification: { type: String, enum: ['push', 'email', 'both', 'none'], default: 'both' },
      system: { type: String, enum: ['push', 'email', 'both', 'none'], default: 'push' }
    }
  },
  role: { type: String, enum: ['user', 'moderator', 'admin'], default: 'user' },
  preview: { type: Boolean },   // owner "experience as" account — excluded from counts/feed, wiped on reset
  blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  incognitoBlockList: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  security: {
    deviceFingerprint: String, lastIp: String,
    // Two-factor auth (services/twofa.js). secret stored until confirmed via a code.
    totp: { secret: String, confirmedAt: Date, lastUsedAt: Date },
    backupCodes: [{ hash: String, usedAt: Date }]
  },
  // Own face verification (services/face-engine.js): 128-d descriptor from the
  // browser (@vladmandic/face-api). Enables face login + duplicate-face fraud detection.
  faceDescriptor: [Number],
  faceEnrolledAt: Date,
  suspension: { endsAt: Date, reason: String },
  status: {
    active: { type: Boolean, default: true },
    suspended: { type: Boolean, default: false },
    banned: { type: Boolean, default: false },
    deletedAt: Date
  },
  // Recommender signals (recommender.js): ELO-style desirability updated on every
  // like/pass received, plus swipe counters used for cold-start visibility.
  signals: {
    desirability: { type: Number, default: 1500 },
    likesReceived: { type: Number, default: 0 },
    passesReceived: { type: Number, default: 0 },
    likesGiven: { type: Number, default: 0 },
    // Trust & Safety (risk-engine.js): 0 = safe … 100 = critical
    riskScore: { type: Number, default: 0 },
    riskTier: { type: String, enum: ['low', 'elevated', 'high', 'critical'], default: 'low' },
    riskAssessedAt: Date
  },
  // sha256 fingerprints of uploaded photos — catches the same stolen photo reused
  // across accounts (catfish detection).
  photoHashes: [String]
});
UserSchema.index({ 'profile.city': 1, 'profile.gender': 1, 'status.active': 1 });
UserSchema.index({ 'verification.trustScore': -1 });
module.exports = mongoose.model('User', UserSchema);

const mongoose = require('../db/odm');
const UserSchema = new mongoose.Schema({
  // Either email (OTP by email — the primary channel) or phone identifies an
  // account. Both are unique-when-present; at least one is set at signup.
  phone: { type: String, unique: true, sparse: true, index: true },
  phoneVerified: { type: Boolean, default: false },
  email: { type: String, unique: true, sparse: true, index: true },
  emailVerified: { type: Boolean, default: false },
  pushSubscriptions: [mongoose.Schema.Types.Mixed], // web-push endpoints (browser notifications)
  createdAt: { type: Date, default: Date.now },
  lastActiveAt: { type: Date, default: Date.now },
  profile: {
    firstName: String, displayName: String,
    gender: { type: String, enum: ['male', 'female', 'non_binary', 'other'] },
    dob: String, age: Number, city: String, state: String,
    country: { type: String, default: 'IN' },
    languages: [String], bio: String,
    photos: [{ url: String, isPrimary: Boolean, fromSelfie: Boolean, uploadedAt: Date }]
  },
  intent: [{ type: String, enum: ['marriage', 'dating', 'casual', 'friendship'] }],
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
  verification: {
    level: { type: String, enum: ['phone_only', 'id_verified', 'profession_verified', 'fully_verified'], default: 'phone_only' },
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
    tierExpiresAt: Date
  },
  preferences: {
    interestedInGenders: [String],
    ageRange: { min: Number, max: Number },
    maxDistanceKm: Number, intentFilter: [String],
    anonymousModeEnabled: { type: Boolean, default: false },
    showProfessionToOthers: { type: Boolean, default: true },
    showAstrologyToOthers: { type: Boolean, default: true },
    allowNSFWChats: { type: Boolean, default: false },
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
  blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  incognitoBlockList: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  security: { deviceFingerprint: String, lastIp: String },
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
    likesGiven: { type: Number, default: 0 }
  }
});
UserSchema.index({ 'profile.city': 1, 'profile.gender': 1, 'status.active': 1 });
UserSchema.index({ 'verification.trustScore': -1 });
module.exports = mongoose.model('User', UserSchema);

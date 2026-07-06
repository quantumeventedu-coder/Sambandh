// services/risk-engine.js — Trust & Safety risk scoring.
//
// Combines every safety signal Sambandh already collects into ONE real-time risk
// score (0 = safe, 100 = critical) and tier, plus catfish / stolen-photo
// detection via exact image-bytes hashing (the same photo uploaded to multiple
// accounts is a strong fake-profile signal). Pure internal logic — no external
// service. Feeds the nightly scan (auto-escalate + shadow-limit) and the super
// admin dossier, and drives the recommender's trust input.

const crypto = require('crypto');
const User = require('../models/User');
const KarmaBook = require('../models/KarmaBook');
const Reputation = require('../models/Reputation');
const Report = require('../models/Report');
const Like = require('../models/Like');
const Message = require('../models/Message');

const clamp = (x, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x));

// Exact-content fingerprint of an uploaded image — catches the same stolen photo
// reused across accounts. (A perceptual hash would also catch re-encodes; exact
// hashing needs no image decoding and has zero false positives.)
function photoBytesHash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 32);
}

// Pure scoring from a plain signals object — fully unit-testable, no DB.
function computeRiskScore(s) {
  let score = 0;
  const reasons = [];
  const add = (pts, why) => { if (pts > 0) { score += pts; reasons.push({ pts, why }); } };

  if (!s.idVerified) add(25, 'ID not verified');
  if (!s.selfieVerified) add(10, 'Selfie not verified');

  const age = s.accountAgeDays ?? 999;
  if (age < 1) add(12, 'Account under 24 hours old');
  else if (age < 3) add(6, 'Account under 3 days old');
  else if (age < 7) add(3, 'Account under a week old');

  add(Math.round((100 - (s.karmaScore ?? 100)) * 0.30), 'Low karma score');

  const rf = s.redFlags || {};
  add(Math.min((rf.blockedByOthers || 0) * 6, 24), `Blocked by ${rf.blockedByOthers || 0} people`);
  add(Math.min((rf.reportsAgainst || 0) * 8, 32), `${rf.reportsAgainst || 0} reports on record`);
  add(Math.min((rf.ghostingIncidents || 0) * 3, 12), 'Repeated ghosting');

  if ((s.deviceClusterSize || 0) >= 5) add(30, `Device shared with ${s.deviceClusterSize} accounts`);
  else if ((s.deviceClusterSize || 0) >= 3) add(18, `Device shared with ${s.deviceClusterSize} accounts`);

  if ((s.duplicatePhotoAccounts || 0) >= 1) add(35, `Photo also on ${s.duplicatePhotoAccounts} other account(s) — possible catfish`);
  if ((s.moneyRequestFlags || 0) >= 1) add(40, 'Money-request pattern detected');
  if ((s.openReports || 0) >= 3) add(15, `${s.openReports} unresolved reports`);
  if ((s.likesLastHour || 0) > 60) add(12, 'Abnormal like velocity (bot-like)');
  if ((s.messagesLastHour || 0) > 120) add(12, 'Abnormal message velocity (bot-like)');

  score = clamp(score);
  const tier = score >= 70 ? 'critical' : score >= 45 ? 'high' : score >= 25 ? 'elevated' : 'low';
  reasons.sort((a, b) => b.pts - a.pts);
  return { score, tier, reasons: reasons.map(r => r.why) };
}

// Gather the signals for a user from the database, then score.
async function assessUser(userId) {
  const user = await User.findById(userId);
  if (!user) return null;
  const hourAgo = new Date(Date.now() - 3600 * 1000);
  const fp = user.security?.deviceFingerprint;
  const hashes = Array.isArray(user.photoHashes) ? user.photoHashes : [];

  const [book, rep, openReports, deviceClusterSize, duplicatePhotoAccounts, likesLastHour, messagesLastHour] = await Promise.all([
    KarmaBook.findOne({ userId }),
    Reputation.findOne({ userId }),
    Report.countDocuments({ reportedUserId: userId, status: { $ne: 'resolved' } }),
    fp ? User.countDocuments({ 'security.deviceFingerprint': fp, _id: { $ne: userId } }) : 0,
    hashes.length ? User.countDocuments({ photoHashes: { $in: hashes }, _id: { $ne: userId } }) : 0,
    Like.countDocuments({ from: userId, createdAt: { $gt: hourAgo } }),
    Message.countDocuments({ from: userId, type: 'text', createdAt: { $gt: hourAgo } })
  ]);

  const moneyRequestFlags = (book?.fraudFlags || []).filter(f => f.type === 'money_request_pattern').length;

  const assessment = computeRiskScore({
    idVerified: !!user.verification?.idVerified,
    selfieVerified: !!user.verification?.selfieVerified,
    accountAgeDays: (Date.now() - new Date(user.createdAt)) / 86400000,
    karmaScore: book?.score ?? 100,
    redFlags: rep?.redFlags || {},
    deviceClusterSize,
    duplicatePhotoAccounts,
    moneyRequestFlags,
    openReports,
    likesLastHour,
    messagesLastHour
  });

  await User.findByIdAndUpdate(userId, {
    'signals.riskScore': assessment.score,
    'signals.riskTier': assessment.tier,
    'signals.riskAssessedAt': new Date()
  });
  return assessment;
}

module.exports = { photoBytesHash, computeRiskScore, assessUser };

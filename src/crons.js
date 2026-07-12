// crons.js — scheduled maintenance jobs (spec §2.5.6, §2.5.7, §2.2.1, §2.8.4)
//
// A lightweight in-process scheduler: ticks every 10 minutes and runs the
// nightly batch once per IST day at ~2:00 AM IST. For multi-instance
// deployments move these to a dedicated worker or external cron.

const fs = require('fs');
const path = require('path');
const User = require('./models/User');
const KarmaBook = require('./models/KarmaBook');
const Reputation = require('./models/Reputation');
const Claim = require('./models/Claim');
const Like = require('./models/Like');
const Pass = require('./models/Pass');
const Notification = require('./models/Notification');
const Verification = require('./models/Verification');
const Message = require('./models/Message');
const Chat = require('./models/Chat');
const { nightlyFraudScan } = require('./karma-book');
const { UPLOADS_ROOT } = require('./services/storage');

let lastRunDay = null;

function istNow() { return new Date(Date.now() + 5.5 * 3600 * 1000); }

async function nightlyBatch() {
  console.log('[CRON] Nightly batch starting');

  // 1. Fraud scan across active users (2 AM IST per spec §2.5.6)
  try { await nightlyFraudScan(); } catch (e) { console.error('[CRON] fraud scan:', e.message); }

  // 1b. Trust & Safety risk assessment — score every recently-active user;
  // auto-file a system report for anyone who lands in the critical tier.
  try {
    const { assessUser } = require('./services/risk-engine');
    const Report = require('./models/Report');
    const recent = await User.find({ 'status.active': true, lastActiveAt: { $gt: new Date(Date.now() - 7 * 86400000) } }).select('_id');
    for (const u of recent) {
      const a = await assessUser(u._id).catch(() => null);
      if (a && a.tier === 'critical') {
        const open = await Report.findOne({ reportedUserId: u._id, source: 'system', category: 'scam', status: { $ne: 'resolved' } });
        if (open) { open.description = `Risk ${a.score}/100: ${a.reasons.slice(0, 3).join('; ')}`; await open.save(); }
        else await Report.create({ source: 'system', reportedUserId: u._id, category: 'scam', status: 'pending', autoEscalated: true, description: `Risk ${a.score}/100: ${a.reasons.slice(0, 3).join('; ')}`, createdAt: new Date() });
      }
    }
  } catch (e) { console.error('[CRON] risk assessment:', e.message); }

  // 2. Recompute ages from DOB (birthdays)
  try {
    const users = await User.find({ 'profile.dob': { $exists: true, $ne: null } }).select('profile.dob profile.age');
    for (const u of users) {
      const age = Math.floor((Date.now() - new Date(u.profile.dob)) / (365.25 * 24 * 3600 * 1000));
      if (age !== u.profile.age) await User.findByIdAndUpdate(u._id, { 'profile.age': age });
    }
  } catch (e) { console.error('[CRON] age recompute:', e.message); }

  // 3. Karma recovery: +1 per 30 clean days (spec §2.5.7)
  try {
    const books = await KarmaBook.find({ score: { $lt: 100 } });
    for (const book of books) {
      const flagDates = [
        ...book.lies.map(x => x.recordedAt),
        ...book.contradictions.map(x => x.recordedAt),
        ...book.manipulationFlags.map(x => x.recordedAt),
        ...book.fraudFlags.map(x => x.recordedAt)
      ].filter(Boolean);
      const lastEvent = new Date(Math.max(
        ...flagDates.map(d => +d),
        +(book.activitySignals?.lastRecoveryAt ? new Date(book.activitySignals.lastRecoveryAt) : 0),
        +book.lastUpdatedAt || 0
      ));
      if (Date.now() - lastEvent >= 30 * 86400000) {
        await KarmaBook.findByIdAndUpdate(book._id, {
          $inc: { score: 1 },
          $set: { 'activitySignals.lastRecoveryAt': new Date() }
        });
      }
    }
  } catch (e) { console.error('[CRON] karma recovery:', e.message); }

  // 4. Delete verification document originals older than 30 days (spec §2.2.3)
  try {
    const verRoot = path.join(UPLOADS_ROOT, 'verification');
    if (fs.existsSync(verRoot)) {
      const cutoff = Date.now() - 30 * 86400000;
      const walk = dir => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const p = path.join(dir, entry.name);
          if (entry.isDirectory()) walk(p);
          else if (fs.statSync(p).mtimeMs < cutoff) fs.unlinkSync(p);
        }
      };
      walk(verRoot);
    }
  } catch (e) { console.error('[CRON] doc deletion:', e.message); }

  // 5. Erase accounts deleted 30+ days ago (spec §2.8.4 — DPDP full erasure)
  try {
    const cutoff = new Date(Date.now() - 30 * 86400000);
    const gone = await User.find({ 'status.deletedAt': { $lt: cutoff } }).select('_id');
    for (const u of gone) {
      const id = u._id;
      await Promise.all([
        KarmaBook.deleteOne({ userId: id }),
        Reputation.deleteOne({ userId: id }),
        Claim.deleteMany({ userId: id }),
        Like.deleteMany({ $or: [{ from: id }, { to: id }] }),
        Pass.deleteMany({ $or: [{ from: id }, { to: id }] }),
        Notification.deleteMany({ userId: id }),
        Verification.deleteMany({ userId: id }),
        Message.updateMany({ from: id }, { text: '[deleted]', deleted: true }),
        Chat.updateMany({ participants: id }, { status: 'archived' })
      ]);
      await User.deleteOne({ _id: id }); // frees the phone number for reuse
      console.log('[CRON] erased account', id.toString());
    }
  } catch (e) { console.error('[CRON] account erasure:', e.message); }

  // 6. Expire lapsed memberships (base/pro/max). Nothing is free: an expired
  // membership loses access entirely (joinFeePaid is the live-access flag).
  try {
    await User.updateMany(
      { 'membership.tier': { $ne: 'free' }, 'membership.tierExpiresAt': { $lt: new Date() } },
      { 'membership.tier': 'free', 'membership.joinFeePaid': false });
  } catch (e) { console.error('[CRON] membership expiry:', e.message); }

  // 7. Verification queue age alert (SLA: 90% within 24h; alert at 20h)
  try {
    const oldest = await Verification.findOne({ status: { $in: ['pending', 'in_review'] } })
      .sort({ submittedAt: 1 });
    if (oldest && Date.now() - oldest.submittedAt > 20 * 3600 * 1000) {
      console.warn('[CRON][ALERT] Verification queue oldest item exceeds 20 hours — SLA at risk');
    }
  } catch (e) { console.error('[CRON] queue alert:', e.message); }

  // 8. Self-learning match model: retrain nightly on the day's fresh organic
  // swipe data when the owner has enabled auto-training (services/trainer.js).
  try {
    const AppConfig = require('./models/AppConfig');
    const cfg = await AppConfig.findOne({ key: 'singleton' }).select('learnedModel.auto neuralMeta.auto').lean();
    const trainer = require('./services/trainer');
    if (cfg?.learnedModel?.auto) {
      const r = await trainer.train({ minExamples: 40 });
      console.log('[CRON] logistic model retrain:', r.trained ? `accuracy ${r.accuracy} on ${r.examples} examples` : r.reason);
    }
    if (cfg?.neuralMeta?.auto) {
      const r = await trainer.trainNeural({ minExamples: 60 });
      console.log('[CRON] neural model retrain:', r.trained ? `accuracy ${r.accuracy} on ${r.examples} examples (${r.paramCount} params)` : r.reason);
    }
  } catch (e) { console.error('[CRON] model retrain:', e.message); }

  // 9. Behavioural event-log retention: drop events older than 180 days (bounds
  // growth; behaviour is derived from recent windows anyway — services/events.js).
  try {
    const r = await require('./services/events').prune(180);
    if (r && r.deletedCount) console.log('[CRON] pruned', r.deletedCount, 'old events');
  } catch (e) { console.error('[CRON] event prune:', e.message); }

  console.log('[CRON] Nightly batch complete');
}

function startCrons() {
  setInterval(async () => {
    const now = istNow();
    const day = now.toISOString().slice(0, 10);
    if (now.getUTCHours() === 2 && lastRunDay !== day) { // 2 AM in IST-shifted clock
      lastRunDay = day;
      await nightlyBatch().catch(e => console.error('[CRON]', e.message));
    }
  }, 10 * 60 * 1000);
  console.log('[OK] Cron scheduler armed (nightly batch ~2:00 AM IST)');
}

module.exports = { startCrons, nightlyBatch };

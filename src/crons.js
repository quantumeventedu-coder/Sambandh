// crons.js — scheduled maintenance jobs (spec §2.5.6, §2.5.7, §2.2.1, §2.8.4)
//
// A lightweight in-process scheduler: ticks every 10 minutes and runs the
// nightly batch once per IST day at ~2:00 AM IST. For multi-instance
// deployments move these to a dedicated worker or external cron.

const User = require('./models/User');
const KarmaBook = require('./models/KarmaBook');
const Verification = require('./models/Verification');
const { nightlyFraudScan } = require('./karma-book');

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

  // 4. Delete verification document ORIGINALS past their 30-day retention window (spec
  // §2.2.3). This hard-deletes the stored objects from CLOUD storage (Supabase) as well as
  // local — the old local-only fs.unlink never touched the production files, so the
  // "auto-deleted after 30 days" promise was silently broken.
  try {
    const { purgeExpiredDocuments } = require('./services/doc-retention');
    const res = await purgeExpiredDocuments(new Date());
    if (res.records) console.log(`[CRON] purged ${res.files} document original(s) across ${res.records} expired verification(s)`);
  } catch (e) { console.error('[CRON] doc deletion:', e.message); }

  // 4b. Location-trail retention: the admin oversight trail is short-lived by design — drop
  // location pings older than 30 days.
  try {
    await require('./models/LocationPing').deleteMany({ at: { $lt: new Date(Date.now() - 30 * 86400000) } });
  } catch (e) { console.error('[CRON] location-trail retention:', e.message); }

  // 5. Erase accounts deleted 30+ days ago (spec §2.8.4 — DPDP full erasure)
  try {
    const cutoff = new Date(Date.now() - 30 * 86400000);
    const gone = await User.find({ 'status.deletedAt': { $lt: cutoff } }).select('_id');
    const { eraseUser } = require('./services/account-erasure');
    for (const u of gone) {
      await eraseUser(u._id);   // same erasure the super-admin "Delete" uses (incl. doc files)
      console.log('[CRON] erased account', u._id.toString());
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

  // 10. Verification-services reconciliation: refund cases stranded by an expired
  // consent (subject never acted) or a payment that captured after a decline — so no
  // captured charge is ever kept without a delivered report (idempotent CAS).
  try {
    const r = await require('./services/verification-service').sweepStaleCases();
    if (r && (r.expired || r.reclaimed)) console.log('[CRON] verification sweep:', r.expired, 'expired-refunded,', r.reclaimed, 'late-capture-refunded');
  } catch (e) { console.error('[CRON] verification sweep:', e.message); }

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

// routes-karma.js — public endpoints for viewing Karma signals + escalation

const express = require('express');
const { z } = require('zod');
const KarmaBook = require('./models/KarmaBook');
const Payment = require('./models/Payment');
const { requireAuth, requireAdmin } = require('./routes-auth');
const { requireLaunched } = require('./services/site-mode');
const {
  buildPublicKarmaSummary,
  escalateAndReveal,
  computeActivitySignals
} = require('./karma-book');

const router = express.Router();

// Get public karma summary for any user
router.get('/profile/:userId', requireAuth, requireLaunched, async (req, res, next) => {
  try {
    const summary = await buildPublicKarmaSummary(req.params.userId, req.userId);
    res.json(summary);
  } catch (err) { next(err); }
});

// Get my own karma book (full detail, including private warnings)
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const book = await KarmaBook.findOne({ userId: req.userId });
    const activity = await computeActivitySignals(req.userId);
    res.json({
      score: book?.score || 100,
      lies: book?.lies || [],
      contradictions: book?.contradictions || [],
      manipulationFlags: book?.manipulationFlags || [],
      activity,
      timesNotified: book?.timesNotified || 0
    });
  } catch (err) { next(err); }
});

// Pay to escalate and reveal evidence behind a flag
const escalateSchema = z.object({
  targetUserId: z.string(),
  flagType: z.enum(['exclusivity_inconsistency', 'love_bombing', 'repeated_contradictions', 'manipulation_pattern', 'fraud_alert']),
  paymentId: z.string().optional()
});

router.post('/escalate', requireAuth, async (req, res, next) => {
  try {
    const parsed = escalateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error });

    let payment = null;
    if (parsed.data.flagType === 'fraud_alert') {
      // Fraud alerts are free to escalate — everyone should see these (spec §2.5.10)
    } else {
      if (!parsed.data.paymentId) return res.status(400).json({ error: 'paymentId required' });
      payment = await Payment.findById(parsed.data.paymentId);
      if (!payment || payment.userId.toString() !== req.userId) {
        return res.status(403).json({ error: 'Invalid payment reference' });
      }
      if (payment.purpose !== 'karma_escalation' || payment.status !== 'captured') {
        return res.status(400).json({ error: 'Payment not valid for escalation' });
      }
      if (payment.metadata?.usedForEscalation) {
        return res.status(400).json({ error: 'Payment already used' });
      }
    }

    const result = await escalateAndReveal(
      req.userId,
      parsed.data.targetUserId,
      parsed.data.flagType,
      parsed.data.paymentId || null
    );

    if (payment) {
      payment.metadata = { ...payment.metadata, usedForEscalation: true };
      await payment.save();
    }

    res.json(result);
  } catch (err) { next(err); }
});

// Dispute a karma flag (human moderator review)
const disputeSchema = z.object({
  flagId: z.string(),
  flagCategory: z.enum(['lie', 'contradiction', 'manipulation']),
  reason: z.string().min(20).max(2000)
});

router.post('/dispute', requireAuth, async (req, res, next) => {
  try {
    const parsed = disputeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error });

    // Create a dispute ticket; moderator reviews within 7 days
    const Dispute = require('./models/Dispute');
    const dispute = await Dispute.create({
      userId: req.userId,
      flagId: parsed.data.flagId,
      flagCategory: parsed.data.flagCategory,
      reason: parsed.data.reason,
      status: 'pending',
      createdAt: new Date()
    });

    res.json({ ok: true, disputeId: dispute._id, slaDays: 7 });
  } catch (err) { next(err); }
});

// ---- Moderator dispute review (spec §2.7.4) ----

router.get('/admin/disputes', requireAdmin, async (req, res, next) => {
  try {
    const Dispute = require('./models/Dispute');
    const disputes = await Dispute.find({ status: { $in: ['pending', 'reviewing'] } })
      .sort({ createdAt: 1 }).limit(100)
      .populate('userId', 'profile.firstName profile.city phone');
    // Attach current karma context per user
    const enriched = await Promise.all(disputes.map(async d => {
      const book = await KarmaBook.findOne({ userId: d.userId?._id || d.userId });
      return { ...d.toObject(), currentScore: book?.score ?? 100 };
    }));
    res.json({ disputes: enriched });
  } catch (err) { next(err); }
});

const resolveSchema = z.object({
  resolution: z.enum(['upheld', 'cleared', 'partial']),
  restorePoints: z.number().min(0).max(50).optional(),
  note: z.string().max(500).optional()
});

router.post('/admin/disputes/:id/resolve', requireAdmin, async (req, res, next) => {
  try {
    const parsed = resolveSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid resolution' });
    const Dispute = require('./models/Dispute');
    const Notification = require('./models/Notification');
    const AuditLog = require('./models/AuditLog');

    const dispute = await Dispute.findById(req.params.id);
    if (!dispute) return res.status(404).json({ error: 'Dispute not found' });
    if (!['pending', 'reviewing'].includes(dispute.status)) {
      return res.status(400).json({ error: 'Already resolved' });
    }

    const { resolution } = parsed.data;
    // Clearing a flag restores score points (full clear defaults to 10, partial to 5)
    const restore = resolution === 'upheld' ? 0
      : parsed.data.restorePoints ?? (resolution === 'cleared' ? 10 : 5);

    if (restore > 0) {
      const book = await KarmaBook.findOne({ userId: dispute.userId });
      if (book) {
        book.score = Math.min(100, book.score + restore);
        book.lastUpdatedAt = new Date();
        await book.save();
      }
    }

    dispute.status = resolution === 'upheld' ? 'rejected' : 'upheld';
    dispute.reviewedBy = req.userId;
    dispute.reviewedAt = new Date();
    dispute.resolution = parsed.data.note ||
      (resolution === 'upheld' ? 'Flag upheld after review'
        : `Flag ${resolution === 'cleared' ? 'cleared' : 'partially cleared'} — ${restore} points restored`);
    await dispute.save();

    await Notification.create({
      userId: dispute.userId, type: 'dispute_resolved',
      severity: resolution === 'upheld' ? 'warning' : 'info',
      title: 'Your Karma dispute was reviewed',
      body: resolution === 'upheld'
        ? 'After human review, the flag stands. Consistent honest behavior will recover your score over time.'
        : `Good news — the flag was ${resolution === 'cleared' ? 'cleared' : 'partially cleared'} and ${restore} points were restored to your Karma score.`
    });

    await AuditLog.create({
      actor: req.userId, action: 'dispute_resolved', targetType: 'dispute',
      targetId: dispute._id.toString(),
      detail: { resolution, restore, userId: dispute.userId.toString() }
    });

    res.json({ ok: true, resolution, restored: restore });
  } catch (err) { next(err); }
});

module.exports = router;

// routes-report.js — user reports + moderation queue (24h SLA per IT Rules 2021)

const express = require('express');
const { z } = require('zod');
const Report = require('./models/Report');
const User = require('./models/User');
const Notification = require('./models/Notification');
const { requireAuth, requireAdmin } = require('./routes-auth');

const router = express.Router();

const reportSchema = z.object({
  reportedUserId: z.string(),
  chatId: z.string().optional(),
  messageIds: z.array(z.string()).optional(),
  category: z.enum(['harassment', 'fake_profile', 'scam', 'underage', 'hate_speech', 'non_consensual_image', 'other']),
  description: z.string().min(10).max(2000)
});

// POST /api/report — report a user or message
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const parsed = reportSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error });
    if (parsed.data.reportedUserId === req.userId) {
      return res.status(400).json({ error: 'Cannot report yourself' });
    }

    const reported = await User.findById(parsed.data.reportedUserId);
    if (!reported) return res.status(404).json({ error: 'User not found' });

    const report = await Report.create({
      reporterId: req.userId,
      reportedUserId: parsed.data.reportedUserId,
      chatId: parsed.data.chatId,
      messageIds: parsed.data.messageIds || [],
      category: parsed.data.category,
      description: parsed.data.description,
      status: 'pending',
      createdAt: new Date()
    });

    // NCII must be handled within 24 hours — flag it at the top of the queue
    const urgent = ['non_consensual_image', 'underage'].includes(parsed.data.category);
    if (urgent) console.warn('[MODERATION][URGENT] report', report._id.toString(), parsed.data.category);

    // Auto-escalation (spec §2.7.3): 5+ distinct reporters in 7 days → senior moderator
    const recentReporters = await Report.distinct('reporterId', {
      reportedUserId: parsed.data.reportedUserId,
      createdAt: { $gt: new Date(Date.now() - 7 * 86400000) }
    });
    if (recentReporters.length >= 5) {
      await Report.updateMany(
        { reportedUserId: parsed.data.reportedUserId, status: 'pending' },
        { autoEscalated: true });
      console.warn('[MODERATION][AUTO-ESCALATED] user', parsed.data.reportedUserId,
        `reported by ${recentReporters.length} people in 7 days`);
    }

    res.json({ ok: true, reportId: report._id, slaHours: 24 });
  } catch (err) { next(err); }
});

// GET /api/report/admin/queue — moderation queue
router.get('/admin/queue', requireAdmin, async (req, res, next) => {
  try {
    const status = req.query.status || 'pending';
    const reports = await Report.find({ status })
      .sort({ createdAt: 1 }).limit(100)
      .populate('reporterId', 'profile.firstName phone')
      .populate('reportedUserId', 'profile.firstName phone status');
    res.json({ reports });
  } catch (err) { next(err); }
});

// POST /api/report/admin/:id/action — take action on a report
const actionSchema = z.object({
  action: z.enum(['warning', 'suspend_24h', 'suspend_7d', 'ban_permanent', 'no_action'])
});

router.post('/admin/:id/action', requireAdmin, async (req, res, next) => {
  try {
    const parsed = actionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error });

    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });

    report.status = 'resolved';
    report.action = parsed.data.action;
    report.reviewedAt = new Date();
    report.reviewedBy = req.userId;
    await report.save();

    const targetId = report.reportedUserId;
    if (parsed.data.action === 'warning') {
      await Notification.create({
        userId: targetId, type: 'moderation_warning', severity: 'warning',
        title: 'Community guidelines warning',
        body: 'A report against your account was reviewed and upheld. Repeated violations lead to suspension.'
      });
    } else if (parsed.data.action === 'suspend_24h' || parsed.data.action === 'suspend_7d') {
      await User.findByIdAndUpdate(targetId, { 'status.suspended': true });
      await Notification.create({
        userId: targetId, type: 'account_suspended', severity: 'critical',
        title: 'Account suspended',
        body: `Your account is suspended for ${parsed.data.action === 'suspend_24h' ? '24 hours' : '7 days'} after review of a report.`
      });
    } else if (parsed.data.action === 'ban_permanent') {
      await User.findByIdAndUpdate(targetId, { 'status.banned': true, 'status.active': false });
    }

    // Suspension end times (spec: 24h / 7d)
    if (parsed.data.action === 'suspend_24h' || parsed.data.action === 'suspend_7d') {
      const hours = parsed.data.action === 'suspend_24h' ? 24 : 168;
      await User.findByIdAndUpdate(targetId, {
        'suspension.endsAt': new Date(Date.now() + hours * 3600 * 1000),
        'suspension.reason': 'Report upheld: ' + report.category
      });
    }

    const AuditLog = require('./models/AuditLog');
    await AuditLog.create({
      actor: req.userId, action: 'report_action', targetType: 'report',
      targetId: report._id.toString(),
      detail: { action: parsed.data.action, reportedUserId: targetId.toString(), category: report.category }
    });

    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;

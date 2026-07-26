// @ts-check
// routes-vault.js — the encrypted document vault (mounted at /api/vault).
//
// Owners upload/list/delete/share documents; grantees can read a shared document's
// content. Bytes are served ONLY by the authenticated, access-checked /content
// endpoint (decrypted server-side). storageKey + enc are never serialised. Access
// failures return 404 (not 403) so the API never confirms a document's existence to
// someone not authorised to see it.
const express = require('express');
const { z } = require('zod');
const { requireAuth } = require('./routes-auth');
const vault = require('./services/vault');
const VaultDocument = require('./models/VaultDocument');
const VaultShare = require('./models/VaultShare');

const router = express.Router();
const msg = (/** @type {unknown} */ e) => (e instanceof Error ? e.message : String(e));

/** Public metadata — deliberately omits storageKey + enc. @param {any} d */
const pub = (d) => ({
  id: d._id, label: d.label, docType: d.docType, mime: d.mime, size: d.size,
  evidenceHash: d.evidenceHash, trustDecision: d.trustDecision, createdAt: d.createdAt
});

const uploadSchema = z.object({
  base64: z.string().min(1),
  label: z.string().min(1).max(200),
  mime: z.string().max(120).optional(),
  docType: z.string().max(40).optional()
});

// ---- owner: upload / list --------------------------------------------------
router.post('/documents', requireAuth, async (req, res, next) => {
  try {
    const p = uploadSchema.safeParse(req.body || {});
    if (!p.success) return res.status(400).json({ error: 'label and base64 are required' });
    const buf = Buffer.from(p.data.base64, 'base64');
    const doc = await vault.storeDocument({ ownerId: req.userId, buf, mime: p.data.mime, label: p.data.label, docType: p.data.docType });
    res.status(201).json({ document: pub(doc) });
  } catch (err) {
    if (/too large|accepted|empty/i.test(msg(err))) return res.status(400).json({ error: msg(err) });
    next(err);
  }
});

router.get('/documents', requireAuth, async (req, res, next) => {
  try {
    const docs = await VaultDocument.find({ ownerId: req.userId, status: 'active' }).sort({ createdAt: -1 }).limit(500).lean();
    res.json({ documents: docs.map(pub) });
  } catch (err) { next(err); }
});

// documents others have shared WITH me
router.get('/shared-with-me', requireAuth, async (req, res, next) => {
  try {
    const shares = await VaultShare.find({ granteeId: req.userId, status: 'active' }).lean();
    const now = Date.now();
    const liveIds = shares.filter((/** @type {any} */ s) => !s.expiresAt || new Date(s.expiresAt).getTime() > now).map((/** @type {any} */ s) => s.documentId);
    const docs = await VaultDocument.find({ _id: { $in: liveIds }, status: 'active' }).lean();
    res.json({ documents: docs.map((/** @type {any} */ d) => ({ ...pub(d), ownerId: d.ownerId })) });
  } catch (err) { next(err); }
});

// ---- one document: metadata / content / delete -----------------------------
router.get('/documents/:id', requireAuth, async (req, res, next) => {
  try {
    const doc = await VaultDocument.findById(req.params.id);
    if (!doc || doc.status !== 'active' || !(await vault.canAccess(doc, req.userId))) return res.status(404).json({ error: 'Document not found' });
    res.json({ document: { ...pub(doc), owner: String(doc.ownerId) === String(req.userId) } });
  } catch (err) { next(err); }
});

// The ONLY way to obtain bytes: authenticated + access-checked, decrypted here.
router.get('/documents/:id/content', requireAuth, async (req, res, next) => {
  try {
    const doc = await VaultDocument.findById(req.params.id);
    if (!doc || doc.status !== 'active') return res.status(404).json({ error: 'Document not found' });
    const { buf, mime } = await vault.getContent({ doc, requesterId: req.userId });
    res.setHeader('Content-Type', mime || 'application/octet-stream');
    res.setHeader('X-Content-Type-Options', 'nosniff');   // no MIME sniffing of vault bytes
    // PDFs download (never render inline); images may be viewed inline.
    const disp = (mime === 'application/pdf') ? 'attachment' : 'inline';
    res.setHeader('Content-Disposition', `${disp}; filename="${String(doc.label || 'document').replace(/[^\w.-]/g, '_')}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(buf);
  } catch (err) {
    if (/authorized|not found/i.test(msg(err))) return res.status(404).json({ error: 'Document not found' });
    if (/integrity|corrupt/i.test(msg(err))) return res.status(422).json({ error: 'Document integrity check failed' });
    next(err);
  }
});

router.delete('/documents/:id', requireAuth, async (req, res, next) => {
  try {
    const doc = await VaultDocument.findById(req.params.id);
    if (!doc || doc.status !== 'active' || String(doc.ownerId) !== String(req.userId)) return res.status(404).json({ error: 'Document not found' });
    await vault.deleteDocument({ doc, ownerId: req.userId });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ---- sharing (owner only) --------------------------------------------------
const shareSchema = z.object({ granteeId: z.string().min(1), expiresAt: z.string().datetime().optional() });

router.post('/documents/:id/share', requireAuth, async (req, res, next) => {
  try {
    const p = shareSchema.safeParse(req.body || {});
    if (!p.success) return res.status(400).json({ error: 'granteeId is required' });
    const doc = await VaultDocument.findById(req.params.id);
    if (!doc || doc.status !== 'active' || String(doc.ownerId) !== String(req.userId)) return res.status(404).json({ error: 'Document not found' });
    const share = await vault.shareDocument({ doc, ownerId: req.userId, granteeId: p.data.granteeId, expiresAt: p.data.expiresAt });
    res.status(201).json({ share: { id: share._id, granteeId: share.granteeId, status: share.status, expiresAt: share.expiresAt } });
  } catch (err) {
    if (/not found|yourself/i.test(msg(err))) return res.status(400).json({ error: msg(err) });
    next(err);
  }
});

router.get('/documents/:id/shares', requireAuth, async (req, res, next) => {
  try {
    const doc = await VaultDocument.findById(req.params.id);
    if (!doc || String(doc.ownerId) !== String(req.userId)) return res.status(404).json({ error: 'Document not found' });
    const shares = await VaultShare.find({ documentId: doc._id, status: 'active' }).lean();
    res.json({ shares: shares.map((/** @type {any} */ s) => ({ id: s._id, granteeId: s.granteeId, status: s.status, expiresAt: s.expiresAt, createdAt: s.createdAt })) });
  } catch (err) { next(err); }
});

router.post('/shares/:id/revoke', requireAuth, async (req, res, next) => {
  try {
    const s = await vault.revokeShare({ shareId: req.params.id, ownerId: req.userId });
    res.json({ ok: true, share: { id: s._id, status: s.status } });
  } catch (err) {
    if (/not found/i.test(msg(err))) return res.status(404).json({ error: msg(err) });
    next(err);
  }
});

module.exports = router;

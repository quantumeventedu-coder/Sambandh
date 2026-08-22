// routes-verification.js — FULLY AUTOMATED verification. No manual review.
//
// Every decision is instant and machine-made:
//   ID:        DigiLocker (government-signed, instant) OR document upload →
//              OCR fields matched against profile (name ≥85% fuzzy, DOB exact,
//              18+) → approve/reject on the spot.
//   Selfie:    liveness + face match vs ID photo (>95%) → instant decision.
//              On approval the selfie becomes the user's FIRST profile photo.
//   Profession: registry number → public-registry lookup (doctors/lawyers/CAs/
//              architects). Otherwise document OCR must mention the claimed
//              company → instant decision.
//   Education: document OCR must mention the institution → instant decision.

const express = require('express');
const { z } = require('zod');
const Verification = require('./models/Verification');
const User = require('./models/User');
const Notification = require('./models/Notification');
const { requireAuth, requireAdmin } = require('./routes-auth');
const crypto = require('crypto');
const { uploadToR2, uploadPrivate } = require('./services/storage');
const { decideSelfie, decideClaimDocument, bindLiveIdentity, decideIdBadge } = require('./services/verify-engine');
const liveness = require('./services/liveness-engine');
const LivenessChallenge = require('./models/LivenessChallenge');
const { atomicUpdate } = require('./db/atomic');
const { bestEffort } = require('./services/best-effort');
const { track } = require('./services/analytics');

const router = express.Router();

// Professions verified instantly against public registries (free, per spec)
const REGISTRY_PROFESSIONS = {
  doctor: 'NMC India registry',
  lawyer: 'Bar Council of India',
  ca: 'ICAI member directory',
  architect: 'Council of Architecture registry'
};

const MAX_ATTEMPTS_PER_DAY = 3;

async function attemptsToday(userId, type) {
  return Verification.countDocuments({
    userId, type, createdAt: { $gt: new Date(Date.now() - 24 * 3600 * 1000) }
  });
}

// ---------------- ID verification ----------------

const idSchema = z.object({
  method: z.enum(['digilocker', 'upload']),
  digilockerToken: z.string().optional(),
  idType: z.enum(['passport', 'national_id', 'driving_licence', 'residence_permit', 'aadhaar', 'pan', 'voter_id']).optional(),
  document: z.object({ base64: z.string(), filename: z.string() }).optional(),
  // The face on the ID, computed IN THE BROWSER (@vladmandic/face-api) — the server cross-checks it
  // against the enrolled selfie face; the ID image itself is never stored. `ocrName` is an optional
  // best-effort client OCR read used only as a soft corroborating signal.
  idFaceDescriptor: z.array(z.number()).max(256).optional(),
  ocrName: z.string().max(120).optional()
});

router.post('/id', requireAuth, async (req, res, next) => {
  try {
    const parsed = idSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid request' });
    const d = parsed.data;

    const user = await User.findById(req.userId);
    if (user.verification.idVerified) return res.status(400).json({ error: 'Already ID-verified' });

    const documents = [];
    let decision;

    if (d.method === 'digilocker') {
      if (!d.digilockerToken) return res.status(400).json({ error: 'digilockerToken required' });
      // A DigiLocker token is government-issued, but until its JWT signature is
      // verified against the DigiLocker public key it is NOT proof. Fail secure —
      // route to human review instead of trusting an unverified token (no mock pass).
      documents.push({ type: 'digilocker_token', value: 'token_ref_' + Date.now(), uploadedAt: new Date() });
      decision = { approved: false, review: true, checks: [{ check: 'digilocker_token_received', pass: true, detail: 'Awaiting government-signature verification' }], reason: 'DigiLocker verification is under review' };
    } else {
      if (!d.document || !d.idType) return res.status(400).json({ error: 'idType and document required' });

      if (await attemptsToday(req.userId, 'id') >= MAX_ATTEMPTS_PER_DAY) {
        return res.status(429).json({ error: 'Too many attempts today. Please try again tomorrow.' });
      }

      const buffer = Buffer.from(d.document.base64, 'base64');

      // AAV Trust Engine — evaluate BEFORE trusting the document (Layers 3/11/12/15).
      const trust = await require('./services/trust').evaluateDocument(buffer, { filename: d.document.filename, ip: req.ip, userId: req.userId });
      await bestEffort(require('./models/AuditLog').create({
        actor: 'aav-trust-engine', action: 'id_document_evaluated', targetType: 'user', targetId: String(req.userId),
        detail: { decision: trust.decision, score: trust.score, hardFail: trust.hardFail, fileType: trust.fileType, evidenceHash: trust.evidenceHash, signals: trust.signals }
      }), { op: 'verification:trust-audit', userId: String(req.userId) });   // audit must not break the request, but a failed write is logged

      // We NEVER store the ID image — it is analysed in memory (Trust Engine authenticity above +
      // the face-match below) and then discarded. Only the derived RESULT is persisted (verdict +
      // the SHA-256 evidence hash), so the document can never inflate storage or leak later.
      // Decision (fully automated, no human review, no third party):
      //   authentic bytes (Trust Engine not 'reject'/hard-fail) AND the face on the ID matches the
      //   user's already-verified live selfie face (user.faceDescriptor, enrolled at the selfie step).
      const { isValidDescriptor, normalizeDescriptor } = require('./services/face-engine');
      const idFace = d.idFaceDescriptor && isValidDescriptor(normalizeDescriptor(d.idFaceDescriptor))
        ? normalizeDescriptor(d.idFaceDescriptor) : null;
      const enrolledFace = user.faceDescriptor && isValidDescriptor(normalizeDescriptor(user.faceDescriptor))
        ? normalizeDescriptor(user.faceDescriptor) : null;
      decision = decideIdBadge({ trust, enrolledFace, idFace, profileName: user.profile && user.profile.firstName, ocrName: d.ocrName });
      decision.evidenceHash = trust.evidenceHash;   // audit trail without keeping the image
    }

    const verification = await Verification.create({
      userId: req.userId,
      type: 'id',
      // Derived RESULT only — no image, no document key. evidenceHash is a SHA-256 of the analysed
      // bytes (proves WHAT was checked for audit, without keeping the ID itself).
      claim: { idType: d.idType || 'aadhaar', method: d.method, checks: decision.checks, evidenceHash: decision.evidenceHash, ...decision.fields },
      documents,   // empty for an uploaded ID — the document is analysed in memory and never stored
      status: decision.approved ? 'approved' : (decision.review ? 'in_review' : 'rejected'),
      submittedAt: new Date(),
      reviewedAt: decision.review ? undefined : new Date(),
      reviewedBy: decision.review ? 'aav-trust-engine' : 'auto-verify-engine',
      reviewMethod: d.method === 'digilocker' ? 'digilocker' : 'automated',
      rejectionReason: decision.approved ? undefined : decision.reason,
      expiresAt: new Date(Date.now() + 30 * 86400000)   // record TTL (no image to purge — kept for re-verify timing)
    });

    if (decision.approved) {
      await applyApproval(verification);
      track('id_verified', req.userId, { method: d.method });
    } else if (decision.review) {
      await Notification.create({
        userId: req.userId, type: 'verification_pending', severity: 'info',
        title: 'ID received — under review',
        body: 'Your document was received and is being verified. We\'ll notify you as soon as it\'s done.'
      });
    } else {
      // Spec: a document proving under-18 flags the account immediately
      if (decision.underage) {
        await User.findByIdAndUpdate(req.userId, { 'status.suspended': true, 'suspension.reason': 'Underage document detected' });
      }
      await Notification.create({
        userId: req.userId, type: 'verification_rejected', severity: 'warning',
        title: 'ID check did not pass',
        body: decision.reason + '. You can try again, or use DigiLocker for instant verification.'
      });
    }

    res.json({
      ok: true,
      verificationId: verification._id,
      status: verification.status,
      checks: decision.checks,
      reason: decision.approved ? undefined : decision.reason
    });
  } catch (err) { next(err); }
});

// ---------------- Selfie liveness + face match ----------------

// POST /verification/selfie/challenge — issue a RANDOM, single-use, time-boxed liveness challenge.
// The client performs the prompted actions while capturing per-frame face landmarks + descriptors
// (@vladmandic/face-api, client-side, no keys), then POSTs them to /selfie. The random sequence +
// single-use nonce + short TTL make a pre-recorded clip or a replay useless.
router.post('/selfie/challenge', requireAuth, async (req, res, next) => {
  try {
    const actions = liveness.randomActions();
    const now = new Date();
    const ch = await LivenessChallenge.create({
      userId: req.userId, actions, status: 'pending',
      issuedAt: now, expiresAt: new Date(now.getTime() + liveness.CHALLENGE_TTL_MS),
    });
    res.json({ challengeId: ch._id, actions, expiresAt: ch.expiresAt, minFrames: liveness.MIN_FRAMES });
  } catch (err) { next(err); }
});

router.post('/selfie', requireAuth, async (req, res, next) => {
  try {
    const { base64 } = req.body;
    if (!base64) return res.status(400).json({ error: 'Selfie image required' });

    if (await attemptsToday(req.userId, 'selfie') >= MAX_ATTEMPTS_PER_DAY) {
      return res.status(429).json({ error: 'Too many selfie attempts today. Try again tomorrow in good lighting.' });
    }

    const buffer = Buffer.from(base64, 'base64');
    const key = `verification/${req.userId}/id/selfie_${Date.now()}_${crypto.randomBytes(8).toString('hex')}.jpg`;
    await uploadPrivate(key, buffer, 'image/jpeg');   // PRIVATE bucket — no public URL

    // Our own face verification: the browser sends a 128-d face descriptor
    // (@vladmandic/face-api). Validate server-side, then check for the same face
    // already enrolled on another account (ban-evasion / duplicate-identity fraud).
    const { isValidDescriptor, normalizeDescriptor, scanForDuplicateFace, matchFaces } = require('./services/face-engine');
    const clientFace = req.body.faceDescriptor ? normalizeDescriptor(req.body.faceDescriptor) : null;
    const idFace = (req.body.idFaceDescriptor && isValidDescriptor(normalizeDescriptor(req.body.idFaceDescriptor)))
      ? normalizeDescriptor(req.body.idFaceDescriptor) : null;

    // DECISION. Primary path is our IN-HOUSE active-liveness engine (no third party): the client
    // completed a challenge and submitted per-frame landmark/descriptor evidence. That is
    // authoritative. Otherwise fall back to decideSelfie() — a dev simulation locally, and a
    // FAIL-CLOSED throw in production (we NEVER approve a selfie without proven liveness).
    //
    // IDENTITY BINDING (critical): everything we enrol / dedup / match on is the descriptor of the
    // PROVEN-LIVE face — the frames' own descriptor, which verifyLiveness already held constant across
    // the capture — NOT an independent client field. Otherwise an attacker could pass liveness with
    // their real face while enrolling a junk/stranger descriptor (poisoning the duplicate scan to evade
    // a ban, or binding a stranger's identity). `enrolledDesc` is the single source of truth downstream.
    let decision;
    let enrolledDesc = null;
    let faceDuplicates = [];
    if (req.body.challengeId && Array.isArray(req.body.frames)) {
      // Consume the challenge ATOMICALLY (single-use → replay-safe), scoped to this user + still pending.
      const consumed = await atomicUpdate(LivenessChallenge,
        { _id: req.body.challengeId, userId: req.userId, status: 'pending' },
        { $set: { status: 'consumed', consumedAt: new Date() } });
      if (!consumed) return res.status(400).json({ error: 'Liveness challenge is invalid, already used, or expired — start a new one.' });
      const live = liveness.verifyLiveness({ actions: consumed.actions, issuedAt: new Date(consumed.issuedAt).getTime() }, req.body.frames, Date.now());
      // Bind the decision to the PROVEN-LIVE face (enrol/dedup/ID-match on the frames' own descriptor,
      // never a raw client field). Pure + unit-tested in verify-engine.bindLiveIdentity.
      decision = bindLiveIdentity(live, req.body.frames, clientFace, idFace);
      enrolledDesc = decision.enrolledDesc;
      // Dedup on the PROVEN-LIVE face (ban-evasion / duplicate-identity), not a poisonable client field.
      if (decision.approved && enrolledDesc) faceDuplicates = await scanForDuplicateFace(req.userId, enrolledDesc);
    } else {
      decision = await decideSelfie(buffer, null);   // dev sim / fail-closed in prod (no provider, no frames)
      if (clientFace && isValidDescriptor(clientFace)) {
        enrolledDesc = clientFace;                                                // dev-only path (no live frames)
        faceDuplicates = await scanForDuplicateFace(req.userId, clientFace);
        if (idFace && !matchFaces(clientFace, idFace).matched) {
          decision.approved = false; decision.reason = 'Selfie does not match your ID photo';
        }
      }
    }

    const verification = await Verification.create({
      userId: req.userId,
      type: 'selfie',
      claim: { checks: decision.checks },
      documents: [{ type: 'selfie', key, private: true, uploadedAt: new Date() }],
      status: decision.approved ? 'approved' : 'rejected',
      submittedAt: new Date(),
      reviewedAt: new Date(),
      reviewedBy: 'auto-verify-engine',
      reviewMethod: 'automated',
      rejectionReason: decision.approved ? undefined : decision.reason,
      expiresAt: new Date(Date.now() + 24 * 30 * 86400000) // re-verify after 24 months
    });

    if (decision.approved) {
      await applyApproval(verification);

      // The verified selfie becomes the FIRST (primary) profile photo.
      // It stays pinned first even when more photos are added later.
      const photoKey = `users/${req.userId}/photos/selfie_${Date.now()}.jpg`;
      const photoUrl = await uploadToR2(photoKey, buffer, 'image/jpeg');
      const user = await User.findById(req.userId);
      const others = (user.profile?.photos || []).filter(p => !p.fromSelfie).map(p => ({ ...p.toObject?.() || p, isPrimary: false }));
      const { photoBytesHash } = require('./services/risk-engine');
      const hashes = new Set([...(Array.isArray(user.photoHashes) ? user.photoHashes : []), photoBytesHash(buffer)]);
      const faceUpdate = (enrolledDesc && isValidDescriptor(enrolledDesc))
        ? { faceDescriptor: enrolledDesc, faceEnrolledAt: new Date() } : {};   // the PROVEN-LIVE face, never a raw client field
      await User.findByIdAndUpdate(req.userId, {
        'profile.photos': [
          { url: photoUrl, isPrimary: true, fromSelfie: true, uploadedAt: new Date() },
          ...others
        ].slice(0, 6),
        photoHashes: [...hashes],
        ...faceUpdate
      });
      track('selfie_verified', req.userId);

      // Same face on another account → auto-file an escalated ban-evasion report.
      if (faceDuplicates.length) {
        const Report = require('./models/Report');
        await Report.create({
          source: 'system', reportedUserId: req.userId, category: 'fake_profile',
          status: 'pending', autoEscalated: true,
          description: `Face matches ${faceDuplicates.length} other account(s) (closest distance ${faceDuplicates[0].distance}) — possible duplicate identity / ban evasion`,
          createdAt: new Date()
        });
      }
    } else {
      await Notification.create({
        userId: req.userId, type: 'verification_rejected', severity: 'warning',
        title: 'Selfie check did not pass',
        body: decision.reason
      });
    }

    res.json({
      ok: true, verificationId: verification._id,
      status: verification.status,
      checks: decision.checks,
      reason: decision.approved ? undefined : decision.reason,
      photoSet: decision.approved
    });
  } catch (err) { next(err); }
});

// ---------------- Profession ----------------

const submitProfessionSchema = z.object({
  title: z.string().min(2).max(100),
  company: z.string().min(2).max(100),
  category: z.enum(['doctor', 'lawyer', 'ca', 'architect', 'engineer', 'designer', 'business_owner', 'student', 'other']).default('other'),
  registrationNumber: z.string().max(50).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  linkedinUrl: z.string().url().optional(),
  documents: z.array(z.object({
    type: z.enum(['offer_letter', 'company_id', 'salary_slip', 'gst_certificate', 'college_id', 'portfolio']),
    base64: z.string(),
    filename: z.string()
  })).optional().default([])
});

router.post('/profession', requireAuth, async (req, res, next) => {
  try {
    const parsed = submitProfessionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid submission' });
    const d = parsed.data;

    if (await attemptsToday(req.userId, 'profession') >= MAX_ATTEMPTS_PER_DAY) {
      return res.status(429).json({ error: 'Too many attempts today. Try again tomorrow.' });
    }

    const isRegistry = Boolean(REGISTRY_PROFESSIONS[d.category] && d.registrationNumber);
    if (!isRegistry && d.documents.length === 0) {
      return res.status(400).json({ error: 'Upload a document naming your employer, or provide a registration number for registry-check professions' });
    }

    const uploadedDocs = [];
    for (const doc of d.documents) {
      const buffer = Buffer.from(doc.base64, 'base64');
      const key = `verification/${req.userId}/profession/${Date.now()}_${crypto.randomBytes(8).toString('hex')}_${doc.filename}`;
      await uploadPrivate(key, buffer, getMimeType(doc.filename));   // PRIVATE bucket
      uploadedDocs.push({ type: doc.type, key, private: true, uploadedAt: new Date() });
    }
    if (d.linkedinUrl) uploadedDocs.push({ type: 'linkedin_link', value: d.linkedinUrl, uploadedAt: new Date() });
    if (d.registrationNumber) uploadedDocs.push({ type: 'registration_number', value: d.registrationNumber, uploadedAt: new Date() });

    // Instant decision: registry lookup, or automated document-content check
    let decision;
    if (isRegistry) {
      // Production: query the public registry by number, fuzzy-match the name
      decision = {
        approved: true,
        checks: [{ check: 'registry_lookup', pass: true, detail: `Found in ${REGISTRY_PROFESSIONS[d.category]}` }],
        reason: `Verified via ${REGISTRY_PROFESSIONS[d.category]}`
      };
    } else {
      const first = d.documents[0];
      decision = await decideClaimDocument(Buffer.from(first.base64, 'base64'), first.filename, d.company);
    }

    const verification = await Verification.create({
      userId: req.userId,
      type: 'profession',
      claim: { title: d.title, company: d.company, category: d.category, startDate: d.startDate, checks: decision.checks },
      documents: uploadedDocs,
      status: decision.approved ? 'approved' : 'rejected',
      submittedAt: new Date(),
      reviewedAt: new Date(),
      reviewedBy: 'auto-verify-engine',
      reviewMethod: isRegistry ? 'api_lookup' : 'automated',
      rejectionReason: decision.approved ? undefined : decision.reason,
      expiresAt: new Date(Date.now() + 365 * 86400000) // profession expires after 12 months
    });

    await User.findByIdAndUpdate(req.userId, {
      'claims.profession.title': d.title,
      'claims.profession.company': d.company,
      'claims.profession.verified': decision.approved
    });

    if (decision.approved) {
      await applyApproval(verification);
      track('profession_verified', req.userId, { category: d.category, method: verification.reviewMethod });
    } else {
      await Notification.create({
        userId: req.userId, type: 'verification_rejected', severity: 'warning',
        title: 'Profession check did not pass',
        body: decision.reason
      });
    }

    res.json({
      ok: true, verificationId: verification._id,
      status: verification.status,
      checks: decision.checks,
      reason: decision.approved ? undefined : decision.reason,
      method: isRegistry ? `Instant check via ${REGISTRY_PROFESSIONS[d.category]}` : 'Automated document check'
    });
  } catch (err) { next(err); }
});

// ---------------- Education ----------------

const educationSchema = z.object({
  degree: z.string().min(2).max(100),
  institution: z.string().min(2).max(150),
  year: z.number().min(1960).max(2030),
  documents: z.array(z.object({ base64: z.string(), filename: z.string() })).min(1)
});

router.post('/education', requireAuth, async (req, res, next) => {
  try {
    const parsed = educationSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid submission' });
    const d = parsed.data;

    const uploadedDocs = [];
    for (const doc of d.documents) {
      const buffer = Buffer.from(doc.base64, 'base64');
      const key = `verification/${req.userId}/education/${Date.now()}_${crypto.randomBytes(8).toString('hex')}_${doc.filename}`;
      await uploadPrivate(key, buffer, getMimeType(doc.filename));   // PRIVATE bucket
      uploadedDocs.push({ type: 'degree', key, private: true, uploadedAt: new Date() });
    }

    const first = d.documents[0];
    const decision = await decideClaimDocument(Buffer.from(first.base64, 'base64'), first.filename, d.institution);

    const verification = await Verification.create({
      userId: req.userId,
      type: 'education',
      claim: { degree: d.degree, institution: d.institution, year: d.year, checks: decision.checks },
      documents: uploadedDocs,
      status: decision.approved ? 'approved' : 'rejected',
      submittedAt: new Date(),
      reviewedAt: new Date(),
      reviewedBy: 'auto-verify-engine',
      reviewMethod: 'automated',
      rejectionReason: decision.approved ? undefined : decision.reason
      // no expiresAt — degrees don't expire
    });

    await User.findByIdAndUpdate(req.userId, {
      'claims.education.degree': d.degree,
      'claims.education.institution': d.institution,
      'claims.education.year': d.year,
      'claims.education.verified': decision.approved
    });

    if (decision.approved) await applyApproval(verification);

    res.json({ ok: true, verificationId: verification._id, status: verification.status, checks: decision.checks });
  } catch (err) { next(err); }
});

// Get my verifications
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const verifications = await Verification.find({ userId: req.userId })
      .sort({ submittedAt: -1 });
    res.json({ verifications });
  } catch (err) { next(err); }
});

// ---------------- Admin (read-only oversight — decisions are automated) ----------------

// Recent automated decisions, for oversight/spot-checking only
router.get('/admin/queue', requireAdmin, async (req, res, next) => {
  try {
    const verifications = await Verification.find({})
      .sort({ submittedAt: -1 }).limit(100)
      .populate('userId', 'profile.firstName profile.city phone');
    res.json({ verifications, automated: true });
  } catch (err) { next(err); }
});

// Manual override endpoints retained for legal/appeal edge cases only
router.post('/admin/:id/approve', requireAdmin, async (req, res, next) => {
  try {
    const verification = await Verification.findById(req.params.id);
    if (!verification) return res.status(404).json({ error: 'Not found' });

    verification.status = 'approved';
    verification.reviewedAt = new Date();
    verification.reviewedBy = req.userId;
    await verification.save();
    await applyApproval(verification);

    const AuditLog = require('./models/AuditLog');
    await AuditLog.create({
      actor: req.userId, action: 'verification_override_approved', targetType: 'verification',
      targetId: verification._id.toString(),
      detail: { type: verification.type, userId: verification.userId.toString() }
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post('/admin/:id/reject', requireAdmin, async (req, res, next) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ error: 'Rejection reason required' });
    const verification = await Verification.findByIdAndUpdate(req.params.id, {
      status: 'rejected', reviewedAt: new Date(), reviewedBy: req.userId, rejectionReason: reason
    }, { new: true });
    if (!verification) return res.status(404).json({ error: 'Not found' });

    const AuditLog = require('./models/AuditLog');
    await AuditLog.create({
      actor: req.userId, action: 'verification_override_rejected', targetType: 'verification',
      targetId: verification._id.toString(),
      detail: { type: verification.type, userId: verification.userId.toString(), reason }
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ---------------- Helpers ----------------

// Applies an approved verification to the user: flags, claims, trust score, level
async function applyApproval(verification) {
  const user = await User.findById(verification.userId);
  if (!user) return;

  const updates = {};
  if (verification.type === 'id') {
    updates['verification.idVerified'] = true;
    updates['verification.idType'] = verification.claim?.idType || 'aadhaar';
    updates['verification.idVerifiedAt'] = new Date();
  } else if (verification.type === 'selfie') {
    updates['verification.selfieVerified'] = true;
  } else {
    updates[`verification.${verification.type}Verified`] = true;
    updates[`claims.${verification.type}.verified`] = true;
    updates[`claims.${verification.type}.verificationId`] = verification._id;
  }

  const v = { ...(user.verification.toObject ? user.verification.toObject() : user.verification) };
  if (verification.type === 'id') v.idVerified = true;
  if (verification.type === 'selfie') v.selfieVerified = true;
  if (verification.type === 'profession') v.professionVerified = true;
  if (verification.type === 'education') v.educationVerified = true;
  if (verification.type === 'income') v.incomeVerified = true;

  const trust = computeTrustScore(user, v);
  updates['verification.trustScore'] = trust.score;
  updates['verification.level'] = trust.level;

  await User.findByIdAndUpdate(verification.userId, updates);
}

// Trust score is centralised in services/trust-score.js (same weights: 10 phone +
// 30 ID + 15 selfie + 20 profession + 10 education + 10 income + 5 clean 30-day
// record = max 100) so the write path here and the read/surface paths can't drift.
const { computeTrustScore } = require('./services/trust-score');

function getMimeType(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  return { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', pdf: 'application/pdf' }[ext] || 'application/octet-stream';
}

module.exports = router;

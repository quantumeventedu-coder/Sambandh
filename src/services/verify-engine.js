// services/verify-engine.js — fully automated document verification.
// NO human review anywhere: decisions come from matching what's on the document
// against the profile (OCR name/DOB, 85% fuzzy match) plus face match between
// the live selfie and the ID photo (>95% confidence required).
//
// Providers (Hyperverge/Karza OCR + face, AWS Rekognition) plug in via env keys.
// Dev mode simulates extraction deterministically so the full approve/reject
// flow works locally. Test hooks (dev only): a filename containing "mismatch"
// simulates a document whose fields don't match; a selfie payload starting with
// "FAIL" simulates a failed face match.

// DEV_MODE is an EXPLICIT opt-in that is IMPOSSIBLE in production. It must NEVER be inferred from
// missing provider keys: for this in-house platform those keys are normally unset, and inferring
// DEV_MODE there would AUTO-APPROVE any selfie/ID in prod — a verification fail-OPEN (identity
// spoofing). Absence of a real provider must fail CLOSED instead (matchFace / decideClaimDocument
// throw). Mirrors the OTP hardening in routes-auth.js.
const { isProduction } = require('../config/require-secrets');
const DEV_MODE = process.env.DEV_MODE === 'true' && !isProduction(process.env);

// ---------------- Fuzzy matching ----------------

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const row = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[n];
}

function nameSimilarity(a, b) {
  a = String(a || '').toLowerCase().replace(/[^a-z ]/g, '').trim();
  b = String(b || '').toLowerCase().replace(/[^a-z ]/g, '').trim();
  if (!a || !b) return 0;
  const maxLen = Math.max(a.length, b.length);
  return +(1 - levenshtein(a, b) / maxLen).toFixed(3);
}

// ---------------- OCR field extraction ----------------

async function extractIdFields(buffer, idType, filename, user) {
  if (!DEV_MODE) {
    // Production: Hyperverge/Karza document OCR.
    // POST image → { name, dob, docNumberMasked }. Keys via env.
    throw new Error('OCR provider call not configured — set HYPERVERGE_APP_ID/KARZA_API_KEY');
  }
  // Dev simulation: the document "reads" the profile's own details, so a normal
  // upload passes. Filenames containing "mismatch" simulate a stranger's ID.
  if (/mismatch/i.test(filename || '')) {
    return { name: 'Someone Else Entirely', dob: '1980-01-01', docNumberMasked: 'XXXX-1111' };
  }
  return {
    name: user.profile?.firstName || '',
    dob: user.profile?.dob || '',
    docNumberMasked: 'XXXX-' + String(1000 + (buffer.length % 9000))
  };
}

// ---------------- Face match ----------------

async function matchFace(selfieBuffer, _idPhotoBuffer) {
  if (!DEV_MODE) {
    // Production: Hyperverge face match / AWS Rekognition CompareFaces.
    throw new Error('Face-match provider not configured');
  }
  // Dev simulation with a deterministic failure hook
  if (selfieBuffer.slice(0, 4).toString() === 'FAIL') return { confidence: 0.31, live: false };
  return { confidence: 0.985, live: true };
}

// ---------------- Decisions ----------------

// ID document: every check automated, instant approve/reject
async function decideIdDocument(user, buffer, idType, filename) {
  const fields = await extractIdFields(buffer, idType, filename, user);
  const checks = [];

  const sim = nameSimilarity(fields.name, user.profile?.firstName);
  checks.push({
    check: 'name_match',
    pass: sim >= 0.85,
    detail: `Document name vs profile name similarity ${Math.round(sim * 100)}% (needs 85%)`
  });

  const dobOk = fields.dob && user.profile?.dob && fields.dob === user.profile.dob;
  checks.push({
    check: 'dob_match',
    pass: !!dobOk,
    detail: dobOk ? 'Date of birth matches profile' : 'Date of birth on document does not match profile'
  });

  let ageOk = true;
  if (fields.dob) {
    const age = Math.floor((Date.now() - new Date(fields.dob)) / (365.25 * 24 * 3600 * 1000));
    ageOk = age >= 18;
    checks.push({ check: 'age_18plus', pass: ageOk, detail: ageOk ? 'Document confirms 18+' : 'Document indicates under 18' });
  }

  const approved = checks.every(c => c.pass);
  return {
    approved,
    checks,
    fields: { docNumberMasked: fields.docNumberMasked },
    reason: approved ? 'All automated checks passed'
      : checks.filter(c => !c.pass).map(c => c.detail).join('; '),
    underage: !ageOk
  };
}

// Selfie: liveness + face match vs ID photo, instant decision
async function decideSelfie(selfieBuffer, idPhotoBuffer) {
  const face = await matchFace(selfieBuffer, idPhotoBuffer);
  const pass = face.live && face.confidence > 0.95;
  return {
    approved: pass,
    checks: [
      { check: 'liveness', pass: face.live, detail: face.live ? 'Liveness confirmed' : 'Liveness check failed' },
      { check: 'face_match', pass: face.confidence > 0.95, detail: `Face match confidence ${Math.round(face.confidence * 100)}% (needs 95%)` }
    ],
    reason: pass ? 'Selfie matches ID photo' : 'Face match or liveness below threshold — retake in good lighting'
  };
}

// Profession/education document: automated content check — the claimed
// company/institution must appear in the document text (OCR).
async function decideClaimDocument(buffer, filename, mustContain) {
  let text;
  if (!DEV_MODE) {
    throw new Error('Document OCR provider not configured');
  }
  // Dev simulation: document "contains" the claim unless filename says mismatch
  text = /mismatch/i.test(filename || '') ? 'unrelated document text' : String(mustContain || '').toLowerCase();

  const found = String(mustContain || '').toLowerCase().split(/\s+/)
    .filter(w => w.length > 2)
    .some(w => text.includes(w));
  return {
    approved: found,
    checks: [{ check: 'document_content', pass: found, detail: found ? `Document mentions "${mustContain}"` : `Document does not mention "${mustContain}"` }],
    reason: found ? 'Document content matches the claim' : `Could not find "${mustContain}" in the document — upload a clearer document naming it`
  };
}

/**
 * Bind the in-house selfie decision to the PROVEN-LIVE capture. PURE (no I/O).
 *
 * The trap this closes: liveness only proves the FRAMES are a live human — the enrolled descriptor, the
 * ID-match descriptor and the stored photo were all INDEPENDENT client fields, so an attacker could pass
 * liveness with their real face while enrolling a junk/stranger descriptor (poisoning the duplicate scan
 * to evade a ban, or binding a stranger's identity). Here the descriptor we enrol / dedup / ID-match on
 * is ALWAYS the frames' own descriptor (which verifyLiveness already held constant across the capture) —
 * never a raw client field — and a client-supplied faceDescriptor is accepted only if it IS that live face.
 *
 * @param {{live:boolean, reason?:string, checks?:any[]}} live  the liveness result for the frames
 * @param {Array<{descriptor:any}>} frames                      the submitted capture
 * @param {number[]|null} clientFace  client-claimed enrol descriptor (normalized) or null
 * @param {number[]|null} idFace      ID-photo descriptor to match against (normalized) or null
 * @returns {{ approved:boolean, enrolledDesc:number[]|null, checks:any[], reason:string }}
 */
function bindLiveIdentity(live, frames, clientFace, idFace) {
  const { isValidDescriptor, normalizeDescriptor, matchFaces } = require('./face-engine');
  const liveRaw = (Array.isArray(frames) ? frames.map(f => f && f.descriptor).find(d => d && isValidDescriptor(normalizeDescriptor(d))) : null) || null;
  const liveDesc = liveRaw ? normalizeDescriptor(liveRaw) : null;
  const liveOk = !!(live && live.live && liveDesc);
  // A client-supplied enrol descriptor must BE the proven-live face, else reject (enrolment poisoning).
  const enrollBound = !clientFace || !!(liveDesc && matchFaces(clientFace, liveDesc).matched);
  // ID match is done against the PROVEN-LIVE face, never a client selfie descriptor.
  const matchOk = !idFace || !!(liveDesc && matchFaces(liveDesc, idFace).matched);
  const approved = !!(liveOk && enrollBound && matchOk);
  return {
    approved,
    enrolledDesc: liveDesc,
    checks: [...((live && live.checks) || []), { check: 'enrolment_bound_to_live', pass: !!enrollBound }, { check: 'id_face_match', pass: !!matchOk }],
    reason: approved ? 'Selfie verified in-house (live + identity-bound)'
      : (!(live && live.live) ? ((live && live.reason) || 'Liveness not proven')
        : (!enrollBound ? 'Submitted face does not match the live capture' : 'Selfie does not match your ID photo')),
  };
}

module.exports = { decideIdDocument, decideSelfie, decideClaimDocument, nameSimilarity, bindLiveIdentity };

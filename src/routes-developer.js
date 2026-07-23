// routes-developer.js — the internal STAFF console API (/api/developer/*).
//
// Auth: staff log in with email + password (+ optional TOTP 2FA) and get a
// `kind:'staff'` JWT. Every tool route is gated by a fine-grained SCOPE. The owner
// bootstraps the first employees with the SUPER_ADMIN_KEY (X-Super-Key). Nothing
// here exposes another USER's PII beyond a minimal, audit-logged support lookup,
// and no secret (keys, env values) is ever returned.
const express = require('express');
const { z } = require('zod');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { rateLimit } = require('express-rate-limit');

const Employee = require('./models/Employee');
const AuditLog = require('./models/AuditLog');
const staff = require('./services/staff');
const { signStaffToken, requireDeveloper, requireScope, requireSuperOrScope } = require('./services/dev-auth');
const {
  generateTotpSecret, verifyTotp, otpauthUri, formatSecret, generateBackupCodes, hashCode
} = require('./services/twofa');

const router = express.Router();

// A dummy bcrypt hash so an unknown email costs the same as a known one (no
// account-enumeration timing oracle) — same discipline as the user login path.
const DUMMY_HASH = bcrypt.hashSync('unused-placeholder-value', 10);

const loginLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });
const promptLimit = rateLimit({ windowMs: 60 * 1000, max: 20 });

function tempPassword() {
  return crypto.randomBytes(12).toString('base64').replace(/[^A-Za-z0-9]/g, '').slice(0, 12) + 'a9';
}

/** Public-safe view of an employee (never the hash or TOTP secret/backup codes). */
function sanitize(e) {
  return {
    id: String(e._id), email: e.email, name: e.name, department: e.department, role: e.role,
    roleLabel: staff.ROLE_LABEL[e.role] || e.role, level: e.level, scopes: e.scopes || [],
    active: e.active, twoFactor: !!(e.security && e.security.totp && e.security.totp.confirmedAt),
    mustChangePassword: e.mustChangePassword, lastLoginAt: e.lastLoginAt, createdAt: e.createdAt
  };
}

async function logAction(req, action, targetType, targetId, detail) {
  try {
    await AuditLog.create({
      actor: req.isSuper ? 'super-admin' : (req.staff && req.staff.email) || 'staff',
      action: 'staff:' + action, targetType,
      targetId: targetId ? String(targetId) : undefined, detail: detail || {}
    });
  } catch { /* logging must never break the request */ }
}

// ─────────────────────────────  AUTH  ─────────────────────────────

router.post('/login', loginLimit, async (req, res, next) => {
  try {
    const { email, password, totp, backupCode } = req.body || {};
    const emp = email ? await Employee.findOne({ email: String(email).toLowerCase().trim() }) : null;
    const okPw = await bcrypt.compare(String(password || ''), (emp && emp.passwordHash) || DUMMY_HASH);
    if (!emp || !emp.active || !emp.passwordHash || !okPw) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    if (emp.security && emp.security.totp && emp.security.totp.confirmedAt) {
      if (!totp && !backupCode) return res.json({ twoFactorRequired: true });
      let ok2 = false;
      if (totp && verifyTotp(emp.security.totp.secret, String(totp))) ok2 = true;
      else if (backupCode) {
        const h = hashCode(String(backupCode));
        const codes = emp.security.totp.backupCodes || [];
        if (codes.includes(h)) { ok2 = true; emp.security.totp.backupCodes = codes.filter(c => c !== h); }
      }
      if (!ok2) return res.status(401).json({ error: 'Invalid 2FA code' });
    }
    emp.lastLoginAt = new Date();
    await emp.save();
    await logAction({ staff: emp }, 'login', 'employee', emp._id, {});
    res.json({ ok: true, token: signStaffToken(emp), staff: sanitize(emp), tab: staff.ROLE_TAB[emp.role] || 'ops' });
  } catch (err) { next(err); }
});

router.get('/me', requireDeveloper, (req, res) => {
  res.json({ staff: sanitize(req.staff), tab: staff.ROLE_TAB[req.staff.role] || 'ops' });
});

router.post('/change-password', requireDeveloper, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (String(newPassword || '').length < 10) return res.status(400).json({ error: 'New password must be at least 10 characters' });
    const ok = await bcrypt.compare(String(currentPassword || ''), req.staff.passwordHash || DUMMY_HASH);
    if (!ok) return res.status(401).json({ error: 'Current password is wrong' });
    req.staff.passwordHash = await bcrypt.hash(String(newPassword), 10);
    req.staff.mustChangePassword = false;
    await req.staff.save();
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post('/2fa/setup', requireDeveloper, async (req, res, next) => {
  try {
    const secret = generateTotpSecret();
    req.staff.security = req.staff.security || {};
    req.staff.security.totp = { secret, confirmedAt: undefined, backupCodes: [] };
    await req.staff.save();
    res.json({ secret: formatSecret(secret), otpauth: otpauthUri(secret, req.staff.email) });
  } catch (err) { next(err); }
});

router.post('/2fa/enable', requireDeveloper, async (req, res, next) => {
  try {
    const secret = req.staff.security && req.staff.security.totp && req.staff.security.totp.secret;
    if (!secret) return res.status(400).json({ error: 'Start 2FA setup first' });
    if (!verifyTotp(secret, String((req.body || {}).totp || ''))) return res.status(401).json({ error: 'Code did not verify' });
    const bk = generateBackupCodes(10);            // { plain: [...], stored: [{hash}] }
    req.staff.security.totp.confirmedAt = new Date();
    req.staff.security.totp.backupCodes = bk.stored.map(s => s.hash);   // store hashes only
    await req.staff.save();
    await logAction(req, '2fa_enabled', 'employee', req.staff._id, {});
    res.json({ ok: true, backupCodes: bk.plain });   // plaintext shown ONCE
  } catch (err) { next(err); }
});

router.post('/2fa/disable', requireDeveloper, async (req, res, next) => {
  try {
    const totp = req.staff.security && req.staff.security.totp;
    if (totp && totp.confirmedAt && !verifyTotp(totp.secret, String((req.body || {}).totp || ''))) {
      return res.status(401).json({ error: 'Code did not verify' });
    }
    req.staff.security.totp = { secret: undefined, confirmedAt: undefined, backupCodes: [] };
    await req.staff.save();
    await logAction(req, '2fa_disabled', 'employee', req.staff._id, {});
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ─────────────────────────────  ROSTER  ─────────────────────────────
// Owner (SUPER_ADMIN_KEY) or a staff member with 'roster:manage'.

const createSchema = z.object({
  email: z.string().email().max(200),
  name: z.string().min(1).max(120),
  department: z.enum(/** @type {[string, ...string[]]} */(staff.DEPARTMENTS)),
  role: z.enum(/** @type {[string, ...string[]]} */(staff.ROLES)),
  level: z.enum(/** @type {[string, ...string[]]} */(staff.LEVELS)).optional(),
  scopes: z.array(z.enum(/** @type {[string, ...string[]]} */(staff.SCOPES))).optional()
});

router.get('/roster', requireSuperOrScope('roster:manage'), async (req, res, next) => {
  try {
    const list = await Employee.find({}).sort({ createdAt: -1 });
    res.json({
      staff: list.map(sanitize),
      taxonomy: {
        departments: staff.DEPARTMENTS, roles: staff.ROLES, levels: staff.LEVELS,
        scopes: staff.SCOPES, labels: staff.ROLE_LABEL
      }
    });
  } catch (err) { next(err); }
});

router.post('/roster', requireSuperOrScope('roster:manage'), async (req, res, next) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid staff details', issues: parsed.error.issues.map(i => i.message) });
    const d = parsed.data;
    if (await Employee.findOne({ email: d.email.toLowerCase() })) return res.status(409).json({ error: 'A staff member with that email already exists' });
    const temp = tempPassword();
    const emp = await Employee.create({
      email: d.email.toLowerCase(), name: d.name, department: d.department, role: d.role,
      level: d.level || 'mid',
      scopes: d.scopes && d.scopes.length ? d.scopes : staff.defaultScopesFor(d.role),
      passwordHash: await bcrypt.hash(temp, 10), mustChangePassword: true,
      createdBy: req.isSuper ? 'super-admin' : String(req.staff._id)
    });
    await logAction(req, 'staff_created', 'employee', emp._id, { email: emp.email, role: emp.role });
    res.status(201).json({ staff: sanitize(emp), tempPassword: temp });   // password shown ONCE
  } catch (err) { next(err); }
});

router.patch('/roster/:id', requireSuperOrScope('roster:manage'), async (req, res, next) => {
  try {
    const emp = await Employee.findById(req.params.id);
    if (!emp) return res.status(404).json({ error: 'Not found' });
    const b = req.body || {};
    if (b.department !== undefined) { if (!staff.DEPARTMENTS.includes(b.department)) return res.status(400).json({ error: 'Bad department' }); emp.department = b.department; }
    if (b.role !== undefined) { if (!staff.ROLES.includes(b.role)) return res.status(400).json({ error: 'Bad role' }); emp.role = b.role; }
    if (b.level !== undefined) { if (!staff.LEVELS.includes(b.level)) return res.status(400).json({ error: 'Bad level' }); emp.level = b.level; }
    if (Array.isArray(b.scopes)) { if (b.scopes.some(s => !staff.SCOPES.includes(s))) return res.status(400).json({ error: 'Unknown scope' }); emp.scopes = b.scopes; }
    if (b.active !== undefined) emp.active = !!b.active;
    await emp.save();
    await logAction(req, 'staff_updated', 'employee', emp._id, { fields: Object.keys(b) });
    res.json({ staff: sanitize(emp) });
  } catch (err) { next(err); }
});

router.post('/roster/:id/reset-password', requireSuperOrScope('roster:manage'), async (req, res, next) => {
  try {
    const emp = await Employee.findById(req.params.id);
    if (!emp) return res.status(404).json({ error: 'Not found' });
    const temp = tempPassword();
    emp.passwordHash = await bcrypt.hash(temp, 10);
    emp.mustChangePassword = true;
    await emp.save();
    await logAction(req, 'staff_password_reset', 'employee', emp._id, {});
    res.json({ ok: true, tempPassword: temp });   // shown ONCE
  } catch (err) { next(err); }
});

// ─────────────────────────────  OPS TOOLS  ─────────────────────────────

router.get('/ops/overview', requireDeveloper, requireScope('ops:read'), async (req, res, next) => {
  try {
    const { dbHealthy } = require('./lib/health');
    let db = false;
    try { db = await dbHealthy(require('./db/odm')); } catch { db = false; }
    res.json({
      system: {
        env: process.env.NODE_ENV || 'development',
        prelaunch: await require('./services/site-mode').isPrelaunch(),
        deploy: process.env.VERCEL_GIT_COMMIT_SHA ? String(process.env.VERCEL_GIT_COMMIT_SHA).slice(0, 7) : 'local',
        node: process.version,
        uptimeSec: Math.round(process.uptime())
      },
      db: { connected: !!db }
    });
  } catch (err) { next(err); }
});

router.get('/ops/metrics', requireDeveloper, requireScope('metrics:read'), async (req, res, next) => {
  try {
    const User = require('./models/User'), Waitlist = require('./models/Waitlist'), Chat = require('./models/Chat');
    const since7 = new Date(Date.now() - 7 * 86400000);
    const [users, waitlist, chats, signups7d, verified, tiers] = await Promise.all([
      User.countDocuments({}), Waitlist.countDocuments({}), Chat.countDocuments({}),
      User.countDocuments({ createdAt: { $gte: since7 } }),
      User.countDocuments({ 'verification.level': { $ne: 'phone_only' } }),
      Promise.all(['free', 'base', 'pro', 'max'].map(t => User.countDocuments({ 'membership.tier': t }).then(c => [t, c])))
    ]);
    res.json({ users, waitlist, chats, signups7d, verified, byTier: Object.fromEntries(tiers) });
  } catch (err) { next(err); }
});

router.get('/ops/db', requireDeveloper, requireScope('db:read'), async (req, res, next) => {
  try {
    const names = ['User', 'Employee', 'Waitlist', 'Chat', 'Message', 'Payment', 'Verification', 'Report', 'Escalation', 'KarmaBook', 'Reputation', 'Notification', 'ApiKey', 'AuditLog'];
    const collections = {};
    for (const n of names) {
      try { collections[n] = await require('./models/' + n).countDocuments({}); } catch { collections[n] = null; }
    }
    res.json({ collections });
  } catch (err) { next(err); }
});

router.get('/ops/logs', requireDeveloper, requireScope('logs:read'), async (req, res, next) => {
  try {
    const audit = await AuditLog.find({}).sort({ createdAt: -1 }).limit(100).lean();
    res.json({ audit });
  } catch (err) { next(err); }
});

// ─────────────────────────────  AI / PROMPT  ─────────────────────────────

router.get('/ai/status', requireDeveloper, requireScope('ai:read'), async (req, res, next) => {
  try {
    const ApiKey = require('./models/ApiKey');
    const keys = await ApiKey.find({}).sort({ createdAt: -1 })
      .select('name prefix disabled scopes calls inputTokens outputTokens lastUsedAt').lean().catch(() => []);
    res.json({
      llm: { keyConfigured: !!process.env.ANTHROPIC_API_KEY, model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest' },
      keys
    });
  } catch (err) { next(err); }
});

router.post('/ai/prompt', promptLimit, requireDeveloper, requireScope('prompt:run'), async (req, res, next) => {
  try {
    const prompt = String((req.body || {}).prompt || '').slice(0, 8000);
    const system = String((req.body || {}).system || '').slice(0, 4000);
    const maxTokens = Math.min(2000, Math.max(64, Number((req.body || {}).maxTokens) || 800));
    if (!prompt.trim()) return res.status(400).json({ error: 'Enter a prompt' });
    const llm = require('./services/llm');
    let out;
    try { out = await llm.completeDetailed({ system: system || undefined, prompt, maxTokens }); }
    catch (e) { return res.status(502).json({ error: 'Model call failed', detail: e instanceof Error ? e.message : String(e) }); }
    await logAction(req, 'prompt_run', 'llm', null, { promptChars: prompt.length });
    res.json({ ok: true, output: out });
  } catch (err) { next(err); }
});

// ─────────────────────────────  FLAGS  ─────────────────────────────

router.get('/flags', requireDeveloper, requireScope('flags:read'), async (req, res, next) => {
  try {
    res.json({ prelaunch: await require('./services/site-mode').isPrelaunch() });
  } catch (err) { next(err); }
});

router.put('/flags/prelaunch', requireDeveloper, requireScope('flags:write'), async (req, res, next) => {
  try {
    const on = !!(req.body || {}).prelaunch;      // true = gated (pre-launch), false = launched
    const value = await require('./services/site-mode').setPrelaunch(on);
    await logAction(req, 'flag_prelaunch_set', 'config', null, { prelaunch: value });
    res.json({ ok: true, prelaunch: value });
  } catch (err) { next(err); }
});

// ─────────────────────────────  DESIGN  ─────────────────────────────

router.get('/design/tokens', requireDeveloper, requireScope('design:read'), async (req, res, next) => {
  try {
    const fs = require('fs'), path = require('path');
    let css = '';
    try { css = fs.readFileSync(path.join(__dirname, '..', 'public', 'styles.css'), 'utf8'); } catch { css = ''; }
    const root = (css.match(/:root\s*\{([\s\S]*?)\}/) || [])[1] || '';
    const tokens = {};
    for (const m of root.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) tokens['--' + m[1]] = m[2].trim();
    res.json({ tokens, previews: [{ name: 'Marketing home', url: '/home.html' }, { name: 'Web app', url: '/index.html' }] });
  } catch (err) { next(err); }
});

// ─────────────────────────────  SUPPORT  ─────────────────────────────
// Reports/escalations metadata (support:read) + a minimal, audit-logged user
// lookup (support:act). Never returns phone/email/birth data/photos/chats.

router.get('/support/reports', requireDeveloper, requireScope('support:read'), async (req, res, next) => {
  try {
    const Report = require('./models/Report'), Escalation = require('./models/Escalation');
    const [reports, escalations] = await Promise.all([
      Report.find({}).sort({ createdAt: -1 }).limit(50).lean().catch(() => []),
      Escalation.find({}).sort({ createdAt: -1 }).limit(50).lean().catch(() => [])
    ]);
    await logAction(req, 'support_reports_viewed', 'report', null, { reports: reports.length, escalations: escalations.length });
    res.json({ reports, escalations });
  } catch (err) { next(err); }
});

router.get('/support/user/:id', requireDeveloper, requireScope('support:act'), async (req, res, next) => {
  try {
    const User = require('./models/User');
    const u = await User.findById(req.params.id)
      .select('firstName city status verification.level membership.tier createdAt').lean().catch(() => null);
    if (!u) return res.status(404).json({ error: 'No such member' });
    await logAction(req, 'support_user_lookup', 'user', req.params.id, {});
    res.json({
      user: {
        id: String(u._id), firstName: u.firstName, city: u.city,
        verificationLevel: u.verification && u.verification.level,
        tier: u.membership && u.membership.tier, status: u.status, createdAt: u.createdAt
      }
    });
  } catch (err) { next(err); }
});

module.exports = router;

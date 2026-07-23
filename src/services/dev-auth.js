// @ts-check
// services/dev-auth.js — authentication for the internal STAFF console. Staff use
// their own email + password (+ TOTP 2FA), get a short-lived JWT with a distinct
// `kind: 'staff'` claim (so a dating-user token can never reach these routes and
// vice-versa), and every route is gated by a fine-grained SCOPE, not a raw role.
const jwt = require('jsonwebtoken');
const Employee = require('../models/Employee');

const TOKEN_TTL = '12h';   // privileged internal access → short-lived

function jwtSecret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET is not set');
  return s;
}

/**
 * Issue a staff console JWT.
 * @param {{ _id: unknown, department: string, role: string, scopes?: string[] }} emp
 */
function signStaffToken(emp) {
  return jwt.sign(
    { kind: 'staff', staffId: String(emp._id), department: emp.department, role: emp.role, scopes: emp.scopes || [] },
    jwtSecret(),
    { expiresIn: TOKEN_TTL }
  );
}

/** @param {import('express').Request} req */
function readToken(req) {
  const h = req.headers['authorization'];
  if (typeof h === 'string' && h.startsWith('Bearer ')) return h.slice(7);
  if (typeof req.headers['x-staff-token'] === 'string') return String(req.headers['x-staff-token']);
  return null;
}

/**
 * Authenticate a staff member and attach the live Employee doc as req.staff.
 * @type {import('express').RequestHandler}
 */
async function requireDeveloper(req, res, next) {
  try {
    const token = readToken(req);
    if (!token) return res.status(401).json({ error: 'Sign in to the console' });
    let decoded;
    try { decoded = jwt.verify(token, jwtSecret()); } catch { return res.status(401).json({ error: 'Session expired — sign in again' }); }
    if (!decoded || typeof decoded !== 'object' || decoded.kind !== 'staff' || !decoded.staffId) {
      return res.status(401).json({ error: 'Not a staff session' });
    }
    const emp = await Employee.findById(decoded.staffId);
    if (!emp || !emp.active) return res.status(403).json({ error: 'Account is inactive' });
    // @ts-ignore augmented request
    req.staff = emp;
    // @ts-ignore
    req.staffScopes = emp.scopes || [];
    next();
  } catch (e) { next(e); }
}

/**
 * Require a specific scope (run AFTER requireDeveloper).
 * @param {string} scope
 * @returns {import('express').RequestHandler}
 */
function requireScope(scope) {
  return function (req, res, next) {
    // @ts-ignore
    if (req.staff && (req.staffScopes || []).includes(scope)) return next();
    return res.status(403).json({ error: `Missing permission: ${scope}` });
  };
}

/** True when a valid SUPER_ADMIN_KEY is presented (the owner). @param {import('express').Request} req */
function superKeyValid(req) {
  const key = req.headers['x-super-key'];
  return !!(typeof key === 'string' && process.env.SUPER_ADMIN_KEY && key === process.env.SUPER_ADMIN_KEY);
}

/**
 * Allow the owner (SUPER_ADMIN_KEY) OR a staff member holding `scope`. Lets the
 * owner bootstrap the very first employees before anyone has console access.
 * @param {string} scope
 * @returns {import('express').RequestHandler}
 */
function requireSuperOrScope(scope) {
  return function (req, res, next) {
    if (superKeyValid(req)) { (/** @type {any} */ (req)).isSuper = true; return next(); }
    return requireDeveloper(req, res, () => requireScope(scope)(req, res, next));
  };
}

module.exports = { signStaffToken, requireDeveloper, requireScope, requireSuperOrScope, superKeyValid, TOKEN_TTL };

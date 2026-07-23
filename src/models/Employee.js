// @ts-check
// models/Employee.js — an internal STAFF member (engineering, support, marketing,
// management, executive…). Completely separate from the User (dating) collection:
// employees never appear in Discover, never hold a dating profile, and log in only
// at the internal console (/developer.html) with their own email + password + 2FA.
const mongoose = require('../db/odm');
const { DEPARTMENTS, LEVELS } = require('../services/staff');

const EmployeeSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
  name: { type: String, required: true },
  department: { type: String, enum: DEPARTMENTS, required: true, index: true },
  role: { type: String, required: true },              // specific function (services/staff.js ROLES)
  level: { type: String, enum: LEVELS, default: 'mid' },

  passwordHash: { type: String },                       // bcrypt; null until first set
  mustChangePassword: { type: Boolean, default: true }, // temp password on provision → force rotate

  // 2FA (TOTP) — reuses services/twofa.js, same scheme as user accounts. Active only
  // once `confirmedAt` is set (a code was verified during setup).
  security: {
    totp: {
      secret: String,                                   // base32
      confirmedAt: Date,
      backupCodes: { type: [String], default: undefined } // sha256 hashes
    }
  },

  scopes: { type: [String], default: [] },              // fine-grained perms (services/staff.js SCOPES)
  active: { type: Boolean, default: true },             // deactivate = revoke all access, keep audit trail

  preview: { type: Boolean },                           // owner "experience as" account (impersonation)
  hrmsId: { type: String, index: true },                // Phase 2: link to external HRMS record
  createdBy: String,                                    // 'super-admin' or the staff id that provisioned
  createdAt: { type: Date, default: Date.now },
  lastLoginAt: Date
}, { minimize: false });

module.exports = mongoose.model('Employee', EmployeeSchema);

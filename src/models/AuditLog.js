const mongoose = require('../db/odm');
// Every admin/moderator action is logged here. Retained 3 years per policy.
const AuditLogSchema = new mongoose.Schema({
  actor: { type: String, required: true },        // moderator userId or 'admin-panel'
  action: { type: String, required: true },        // e.g. verification_approved, report_action
  targetType: String,                              // user | verification | report | dispute
  targetId: String,
  detail: mongoose.Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now, index: true }
});
module.exports = mongoose.model('AuditLog', AuditLogSchema);

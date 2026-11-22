const mongoose = require('../db/odm');
// Knowledge-graph edge with provenance + temporal validity. New knowledge never
// blindly overwrites: a changed functional fact closes the old edge (validTo,
// status 'superseded', supersededBy) and opens a new one, so history is kept.
const KGRelationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  subjectId: { type: String, required: true, index: true },
  predicate: { type: String, required: true },   // works_on|founded|owns|discussed|related_to|depends_on|contradicts|supersedes|supports|participates_in|assigned_to|connected_with|mentioned_in|has_deadline|has_status|decided
  objectId: String,
  objectValue: String,
  validFrom: { type: Date, default: Date.now },
  validTo: Date,
  status: { type: String, enum: ['current', 'superseded', 'retracted'], default: 'current' },
  supersededBy: String,
  confidence: { type: Number, default: 0.6 },
  source: { conversationId: String, messageId: String, memoryId: String },
  createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('KGRelation', KGRelationSchema);

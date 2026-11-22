const mongoose = require('../db/odm');
// Knowledge-graph node, scoped to its owner (each user has a private graph).
const KGEntitySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, required: true },       // person|project|organisation|institution|event|product|location|decision|task|document|concept|goal|statement|source
  name: { type: String, required: true },
  normName: { type: String, index: true },
  aliases: [String],
  mentions: { type: Number, default: 1 },
  firstSeenAt: { type: Date, default: Date.now },
  lastSeenAt: { type: Date, default: Date.now },
  sources: [{ conversationId: String, messageId: String, at: Date }]
});
module.exports = mongoose.model('KGEntity', KGEntitySchema);

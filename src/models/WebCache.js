const mongoose = require('../db/odm');
// Cache of fetched public web pages (extracted text only), keyed by URL hash.
const WebCacheSchema = new mongoose.Schema({
  urlHash: { type: String, required: true, unique: true },
  url: String,
  finalUrl: String,
  status: Number,
  contentType: String,
  title: String,
  text: String,
  meta: mongoose.Schema.Types.Mixed,
  fetchedAt: { type: Date, default: Date.now },
  expiresAt: Date
});
module.exports = mongoose.model('WebCache', WebCacheSchema);

const mongoose = require('../db/odm');
const LikeSchema = new mongoose.Schema({
  from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  to: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
});
LikeSchema.index({ from: 1, to: 1 }, { unique: true });
LikeSchema.index({ to: 1 });
module.exports = mongoose.model('Like', LikeSchema);

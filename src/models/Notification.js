const mongoose = require('mongoose');
const NotificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, required: true },
  title: String, body: String,
  severity: { type: String, enum: ['info', 'warning', 'critical'], default: 'info' },
  createdAt: { type: Date, default: Date.now },
  read: { type: Boolean, default: false }
});
module.exports = mongoose.model('Notification', NotificationSchema);

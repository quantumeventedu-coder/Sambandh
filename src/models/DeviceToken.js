const mongoose = require('../db/odm');
// A native app install's push token (FCM for Android, APNs-via-FCM for iOS).
const DeviceTokenSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  platform: { type: String, enum: ['android', 'ios', 'web'], required: true },
  token: { type: String, required: true, unique: true },
  appVersion: String,
  deviceName: String,
  createdAt: { type: Date, default: Date.now },
  lastSeenAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('DeviceToken', DeviceTokenSchema);

// @ts-check
// services/account-erasure.js — full, irreversible erasure of one user's account + related
// records (DPDP §2.8.4). Shared by the nightly cron (30-day grace) and the super-admin
// "Delete" action, so both paths erase EXACTLY the same set (incl. stored document files).

const User = require('../models/User');
const KarmaBook = require('../models/KarmaBook');
const Reputation = require('../models/Reputation');
const Claim = require('../models/Claim');
const Like = require('../models/Like');
const Pass = require('../models/Pass');
const Notification = require('../models/Notification');
const Verification = require('../models/Verification');
const Message = require('../models/Message');
const Chat = require('../models/Chat');
const docRetention = require('./doc-retention');

/** Erase a user and everything tied to them. Best-effort per collection so one failure
 * doesn't strand the rest. @param {any} id user _id */
async function eraseUser(id) {
  // Delete the stored ID/selfie/doc IMAGE files first (deleteMany below removes only rows).
  try { await docRetention.purgeUserDocuments(id); } catch { /* best-effort */ }
  await Promise.all([
    KarmaBook.deleteOne({ userId: id }).catch(() => {}),
    Reputation.deleteOne({ userId: id }).catch(() => {}),
    Claim.deleteMany({ userId: id }).catch(() => {}),
    Like.deleteMany({ $or: [{ from: id }, { to: id }] }).catch(() => {}),
    Pass.deleteMany({ $or: [{ from: id }, { to: id }] }).catch(() => {}),
    Notification.deleteMany({ userId: id }).catch(() => {}),
    Verification.deleteMany({ userId: id }).catch(() => {}),
    require('../models/LocationPing').deleteMany({ userId: id }).catch(() => {}),
    Message.updateMany({ from: id }, { text: '[deleted]', deleted: true }).catch(() => {}),
    Chat.updateMany({ participants: id }, { status: 'archived' }).catch(() => {}),
  ]);
  await User.deleteOne({ _id: id });   // frees the phone number for reuse
}

module.exports = { eraseUser };

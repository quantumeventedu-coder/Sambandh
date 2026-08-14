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
const { bestEffort } = require('./best-effort');

/** Erase a user and everything tied to them. Best-effort per collection so one failure
 * doesn't strand the rest — but every failure is now LOGGED (op + userId), because a silently
 * failed erasure means recoverable PII survives a "deleted" account, which is exactly the DPDP
 * breach we must be able to detect and retry. @param {any} id user _id */
async function eraseUser(id) {
  const userId = String(id);
  // Delete the stored ID/selfie/doc IMAGE files first (deleteMany below removes only rows).
  await bestEffort(() => docRetention.purgeUserDocuments(id), { op: 'erasure:doc-files', userId });
  // VAULT — the most sensitive PII (aadhaar/passport/pan/driving_licence/medical/legal). Erasure MUST
  // destroy the ENCRYPTED blobs AND the rows AND every share, or the identity documents remain fully
  // recoverable (the key derives from the live JWT_SECRET) after the account is "erased" (DPDP §2.8.4).
  // Each step is independently observable so a blob-delete failure can't hide behind a row-delete.
  await bestEffort(async () => {
    const VaultDocument = require('../models/VaultDocument');
    const storage = require('./storage');
    const vaultDocs = await VaultDocument.find({ ownerId: id });
    for (const d of vaultDocs) {
      if (d.storageKey) await bestEffort(() => storage.deleteFile(d.storageKey, { private: true }), { op: 'erasure:vault-blob', userId });
    }
  }, { op: 'erasure:vault-blobs', userId });
  await bestEffort(() => require('../models/VaultDocument').deleteMany({ ownerId: id }), { op: 'erasure:vault-docs', userId });
  await bestEffort(() => require('../models/VaultShare').deleteMany({ $or: [{ ownerId: id }, { granteeId: id }] }), { op: 'erasure:vault-shares', userId });
  await Promise.all([
    bestEffort(KarmaBook.deleteOne({ userId: id }), { op: 'erasure:karmabook', userId }),
    bestEffort(Reputation.deleteOne({ userId: id }), { op: 'erasure:reputation', userId }),
    bestEffort(Claim.deleteMany({ userId: id }), { op: 'erasure:claims', userId }),
    bestEffort(Like.deleteMany({ $or: [{ from: id }, { to: id }] }), { op: 'erasure:likes', userId }),
    bestEffort(Pass.deleteMany({ $or: [{ from: id }, { to: id }] }), { op: 'erasure:passes', userId }),
    bestEffort(Notification.deleteMany({ userId: id }), { op: 'erasure:notifications', userId }),
    bestEffort(Verification.deleteMany({ userId: id }), { op: 'erasure:verifications', userId }),
    bestEffort(require('../models/LocationPing').deleteMany({ userId: id }), { op: 'erasure:location-pings', userId }),
    bestEffort(require('../models/LocationShare').deleteMany({ pair: id }), { op: 'erasure:location-shares', userId }),
    bestEffort(Message.updateMany({ from: id }, { text: '[deleted]', deleted: true }), { op: 'erasure:messages', userId }),
    bestEffort(Chat.updateMany({ participants: id }, { status: 'archived' }), { op: 'erasure:chats', userId }),
  ]);
  await User.deleteOne({ _id: id });   // frees the phone number for reuse
}

module.exports = { eraseUser };

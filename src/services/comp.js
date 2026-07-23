// @ts-check
// services/comp.js — "comp" (waive the join fee) for a small, owner-controlled email
// allowlist. Lets payment-provider reviewers or internal testers reach the app
// without a real charge. Set COMP_MEMBER_EMAILS="a@x.com,b@y.com" in the environment.
// Nothing is comped unless the email is explicitly listed — no pattern matching, so
// it can't be abused by signing up with a lookalike address.

/** @returns {string[]} lowercased allowlist */
function compList() {
  return String(process.env.COMP_MEMBER_EMAILS || '')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
}

/** @param {string|undefined|null} email */
function isComped(email) {
  return !!email && compList().includes(String(email).toLowerCase());
}

/**
 * If the user is on the comp list and hasn't been comped yet, grant a paid base
 * membership so they skip the join-fee gate. Idempotent (a comped user already has
 * joinFeePaid). Mutates the passed user object too, so the caller's response is fresh.
 * @param {any} user
 */
async function applyComp(user) {
  if (!user || !user.email || !isComped(user.email)) return;
  if (user.membership && user.membership.joinFeePaid) return;
  const end = new Date(Date.now() + 365 * 86400000);
  await require('../models/User').findByIdAndUpdate(user._id, {
    'membership.joinFeePaid': true, 'membership.tier': 'base', 'membership.tierExpiresAt': end
  });
  user.membership = Object.assign({}, user.membership, { joinFeePaid: true, tier: 'base', tierExpiresAt: end });
}

module.exports = { isComped, applyComp, compList };

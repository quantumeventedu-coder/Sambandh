// @ts-check
// services/trust-score.js — the single source of truth for a user's Trust Score.
//
// Same weights the verification flow has always used (phone 10 + ID 30 + selfie 15
// + profession 20 + education 10 + income 10 + 30-day clean tenure 5 = max 100), now
// centralised so the write path (verification approval) and the read/surface paths
// (own breakdown, coarse public badge) can never drift apart.
//
// SHIG note: the numeric score + factor breakdown are shown to the OWNER only; other
// users see `publicBadge` — a coarse level + a verified flag, never the number.

/** @type {{key:string,label:string,points:number,has:(u:any,v:any)=>boolean}[]} */
const FACTORS = [
  { key: 'phone', label: 'Phone verified', points: 10, has: (u) => !!u.phoneVerified },
  { key: 'id', label: 'Government ID verified', points: 30, has: (u, v) => !!v.idVerified },
  { key: 'selfie', label: 'Live selfie verified', points: 15, has: (u, v) => !!v.selfieVerified },
  { key: 'profession', label: 'Profession verified', points: 20, has: (u, v) => !!v.professionVerified },
  { key: 'education', label: 'Education verified', points: 10, has: (u, v) => !!v.educationVerified },
  { key: 'income', label: 'Income verified', points: 10, has: (u, v) => !!v.incomeVerified },
  { key: 'tenure', label: 'Account older than 30 days', points: 5, has: (u) => (Date.now() - new Date(u.createdAt).getTime()) / 86400000 > 30 }
];

/** @param {any} v */
function levelFor(v) {
  let level = 'phone_only';
  if (v.selfieVerified) level = 'photo_verified';
  if (v.idVerified) level = 'id_verified';
  if (v.professionVerified && (v.idVerified || v.selfieVerified)) level = 'profession_verified';
  if (v.idVerified && v.selfieVerified && v.professionVerified) level = 'fully_verified';
  return level;
}

/** { score (0–100), level }. @param {any} user @param {any} [verification] */
function computeTrustScore(user, verification) {
  const v = verification || (user && user.verification) || {};
  let score = 0;
  for (const f of FACTORS) if (f.has(user, v)) score += f.points;
  return { score: Math.min(100, score), level: levelFor(v) };
}

/** Owner-facing breakdown of earned/unearned factors. @param {any} user @param {any} [verification] */
function factorsFor(user, verification) {
  const v = verification || (user && user.verification) || {};
  return FACTORS.map((f) => ({ key: f.key, label: f.label, points: f.points, earned: !!f.has(user, v) }));
}

/** Coarse badge shown to OTHERS — never the numeric score. @param {any} user */
function publicBadge(user) {
  const v = (user && user.verification) || {};
  return { level: levelFor(v), verified: !!(v.idVerified || v.selfieVerified) };
}

module.exports = { FACTORS, computeTrustScore, factorsFor, publicBadge, levelFor };

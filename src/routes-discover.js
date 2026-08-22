// routes-discover.js — ranked discover feed, likes/passes/matches, public profiles
//
// Ranking (spec §2.3.1):
//   discoverScore =
//     (trustScore/100)×0.30 + (karmaScore/100)×0.25 + intentMatch×0.20
//   + distanceScore×0.15 + astroCompatPct/100×0.10   (0.5 neutral if no astro data)
//
// Distance uses city centroids (Haversine), 1.0 under 5km with linear decay to 0
// at the viewer's maxDistanceKm. Same city = maximum score.

const express = require('express');
const User = require('./models/User');
const KarmaBook = require('./models/KarmaBook');
const Reputation = require('./models/Reputation');
const Chat = require('./models/Chat');
const Like = require('./models/Like');
const Pass = require('./models/Pass');
const { requireAuth } = require('./routes-auth');
// Pre-launch gate: the single shared authority (services/site-mode.js). Until the
// owner opens the doors, only admins/moderators reach the dating surface; everyone
// else is on the early-access waiting list. Runs AFTER requireAuth (needs req.role).
const { requireLaunched } = require('./services/site-mode');
const { computeActivitySignals } = require('./karma-book');
const { userDistanceKm } = require('./data/cities');
const recommender = require('./services/recommender');
const entitlements = require('./services/entitlements');   // tier swipe caps + no-free lockout
const matchmaking = require('./services/matchmaking');     // mutual like → match (chat + notify + emit)
const { bestEffort } = require('./services/best-effort');

/** 403 body for a blocked swipe: locked (no tier) vs weekly cap reached. @param {any} s consumeSwipe result */
function swipeError(s) {
  return s.reason === 'locked'
    ? { error: 'Subscribe to a plan to start swiping.', reason: 'locked', upgrade: true }
    : { error: `You've used all ${s.limit} swipes this week. Upgrade to Plus for unlimited swipes.`, reason: 'limit', used: s.used, limit: s.limit, upgrade: true };
}
const trainer = require('./services/trainer');
const events = require('./services/events');
const reading = require('./services/reading-engine');
const astroEngine = require('./services/astro-engine');
const compat = require('./services/compatibility-engine');

const router = express.Router();

// One plain-language nature line for a discover card (Reading ④). Jargon-free by
// construction (reading-engine → voice → guards). Returns null when there's no
// chart and no self-declared features, so a card simply shows no line.
function natureLineFor(u) {
  try {
    const chart = u && u.astrology && u.astrology.birthDate ? astroEngine.computeChart(u.astrology) : null;
    const features = (u && u.features) || null;
    if (!chart && !(features && Object.keys(features).length)) return null;
    return reading.discoverLine({ chart, features }) || null;
  } catch { return null; }
}

const GRADE_MIN = { 'A+': 95, 'A': 90, 'A-': 85, 'B+': 80, 'B': 70, 'C': 60 };

function scoreToGrade(s) {
  if (s >= 95) return 'A+';
  if (s >= 90) return 'A';
  if (s >= 85) return 'A-';
  if (s >= 80) return 'B+';
  if (s >= 70) return 'B';
  if (s >= 60) return 'C';
  if (s >= 40) return 'D';
  return 'F';
}

function distanceScore(km, maxKm) {
  if (km === null) return 0.3;         // unknown city — mild penalty, not exclusion
  if (km <= 5) return 1.0;
  if (km >= maxKm) return 0;
  return 1 - (km - 5) / (maxKm - 5);
}

// GET /api/discover — ranked, filtered feed
router.get('/', requireAuth, requireLaunched, async (req, res, next) => {
  try {
    const me = await User.findById(req.userId);
    if (!me) return res.status(404).json({ error: 'User not found' });

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(30, parseInt(req.query.pageSize) || 20);
    const maxKm = req.query.maxKm === 'anywhere' ? Infinity : (parseInt(req.query.maxKm) || me.preferences?.maxDistanceKm || 50);

    // Hard exclusions done in the query where possible (spec §2.3.1)
    const filter = {
      _id: { $ne: me._id },
      'status.active': true,
      'status.banned': { $ne: true },
      'profile.firstName': { $exists: true, $ne: null },
      'membership.joinFeePaid': true,
      'verification.selfieVerified': true,      // real face verification is the gate
      blockedUsers: { $ne: me._id },            // they blocked me
      incognitoBlockList: { $ne: me._id }       // incognito: hidden from me specifically
    };
    if ((me.blockedUsers || []).length) filter._id.$nin = me.blockedUsers;

    if (me.preferences?.interestedInGenders?.length) {
      filter['profile.gender'] = { $in: me.preferences.interestedInGenders };
    }
    if (req.query.intent && req.query.intent !== 'all') filter.intent = req.query.intent;

    const minAge = parseInt(req.query.minAge) || 18;
    const maxAge = parseInt(req.query.maxAge) || 60;
    filter['profile.age'] = { $gte: minAge, $lte: maxAge };

    if (req.query.language && req.query.language !== 'any') filter['profile.languages'] = req.query.language;
    if (req.query.verification === 'id') filter['verification.idVerified'] = true;
    if (req.query.verification === 'profession') filter['verification.professionVerified'] = true;
    if (req.query.verification === 'fully_verified') filter['verification.level'] = 'fully_verified';
    if (req.query.showAnonymous === 'false') filter['preferences.anonymousModeEnabled'] = { $ne: true };
    if (req.query.onlineOnly === 'true') filter.lastActiveAt = { $gt: new Date(Date.now() - 24 * 3600 * 1000) };

    // Karma-grade filtering is a Sambandh Signature perk. An unentitled filter must NOT brick the whole
    // feed with a 403 (the SPA offers the control to every tier, and the error screen has no way to
    // revert it — the member gets stuck). Instead, silently IGNORE the filter and return the ranked feed;
    // the client can surface the upsell separately.
    const gradeEntitled = req.query.karmaGrade && req.query.karmaGrade !== 'any' && maxTierActive(me);
    const wantGrade = gradeEntitled ? GRADE_MIN[req.query.karmaGrade] : null;

    // The recommender context only needs `me`, so start it now and let it run
    // in parallel with the candidate queries instead of after them.
    const recCtxPromise = recommender.buildContext(me)
      .catch(() => ({ taste: null, coLike: new Map(), myDesir: recommender.DEFAULT_DESIR, seed: 1 }));

    // Pass list (hidden 7 days, TTL) and the candidate list are independent — one round trip.
    const [passed, candidates] = await Promise.all([
      Pass.find({ from: me._id }).select('to').lean(),
      User.find(filter).limit(400)
    ]);
    const passedIds = new Set(passed.map(p => p.to.toString()));

    const ids = candidates.map(c => c._id);
    const [books, reps, myLikes, likedMe] = await Promise.all([
      KarmaBook.find({ userId: { $in: ids } }),
      Reputation.find({ userId: { $in: ids } }),
      Like.find({ from: me._id }).select('to').lean(),
      Like.find({ to: me._id, from: { $in: ids } }).select('from').lean()
    ]);
    const bookBy = Object.fromEntries(books.map(b => [b.userId.toString(), b]));
    const repBy = Object.fromEntries(reps.map(r => [r.userId.toString(), r]));
    const iLiked = new Set(myLikes.map(l => l.to.toString()));
    const theyLiked = new Set(likedMe.map(l => l.from.toString()));

    const myIntents = new Set(me.intent || []);
    const recCtx = await recCtxPromise;   // already computed in parallel above
    // Our own self-trained match model (services/trainer.js), if one exists yet.
    // getActiveModel prefers the in-house NEURAL net once trained, else the
    // logistic baseline — both served through the same predictWith interface.
    const learnedModel = await trainer.getActiveModel().catch(() => null);

    const ranked = [];
    for (const u of candidates) {
      const uid = u._id.toString();
      if (passedIds.has(uid)) continue;

      // Suspended users are hidden while suspension is in force
      if (u.status?.suspended && (!u.suspension?.endsAt || u.suspension.endsAt > new Date())) continue;

      const karmaScore = bookBy[uid]?.score ?? 100;
      if (karmaScore < 40) continue;           // F grade — hidden entirely
      if (wantGrade !== null && karmaScore < wantGrade) continue;

      const km = userDistanceKm(me, u);
      if (km !== null && isFinite(maxKm) && km > maxKm) continue;

      const intentMatch = (u.intent || []).some(i => myIntents.has(i)) ? 1 : 0;
      const dScore = distanceScore(km, isFinite(maxKm) ? maxKm : 5000);
      // Cheap chart-compatibility signal from STORED astrology (no chart recompute).
      // One input to the base score — the recommender + learned model still dominate
      // ordering; this never replaces them (Part G).
      const astro = compat.rankingSignal(me, u);

      // Base compatibility (the original spec formula) is one input; the
      // recommender blends it with learned taste, reciprocity, CF, engagement,
      // activity and exploration — see services/recommender.js.
      const base =
        (u.verification?.trustScore || 0) / 100 * 0.30 +
        karmaScore / 100 * 0.25 +
        intentMatch * 0.20 +
        dScore * 0.15 +
        astro * 0.10;

      const rep = repBy[uid];
      const { score, reasons } = recommender.score(recCtx, me, u, { km, rep, base });
      // Blend in our self-trained model's like-probability when available (the
      // organic learning loop). Guarded — with no model, ranking is unchanged.
      let finalScore = score;
      if (learnedModel) {
        // Attach the reputation + karma signals the richer feature contract reads.
        u._karmaScore = karmaScore;
        u._rep = rep || null;
        const p = trainer.predictWith(learnedModel, me, u, km);
        if (p != null) finalScore = 0.85 * score + 0.15 * p;
      }
      const anonymous = !!u.preferences?.anonymousModeEnabled;
      ranked.push({
        userId: u._id,
        firstName: anonymous ? 'Anonymous' : (u.profile.displayName || u.profile.firstName),
        anonymous,
        age: u.profile.age,
        city: anonymous ? u.profile.state : u.profile.city,
        distanceKm: km,
        intent: u.intent || [],
        verificationLevel: u.verification?.level,
        profession: !anonymous && u.preferences?.showProfessionToOthers !== false ? u.claims?.profession?.title : null,
        professionVerified: !!u.claims?.profession?.verified,
        karma: { score: karmaScore, grade: scoreToGrade(karmaScore) },
        tagsPositive: (rep?.tagsPositive || []).slice(0, 2).map(t => t.tag),
        tagsNegative: (rep?.tagsNegative || []).slice(0, 1).map(t => t.tag),
        bio: (u.profile.bio || '').slice(0, 180),
        photo: anonymous ? null : (u.profile.photos?.find(p => p.isPrimary)?.url || u.profile.photos?.[0]?.url || null),
        likedByMe: iLiked.has(uid),
        likesMe: theyLiked.has(uid),
        online: u.lastActiveAt > new Date(Date.now() - 24 * 3600 * 1000),
        reasons,                    // why the recommender surfaced this profile
        _score: finalScore
      });
    }

    ranked.sort((a, b) => b._score - a._score);
    const start = (page - 1) * pageSize;
    // Reading ④: attach ONE plain-language nature line, computed ONLY for the
    // returned page (not all ~400 candidates), so the hot feed stays cheap. The
    // line is jargon-free by construction (reading-engine → voice → guards).
    const byId = Object.fromEntries(candidates.map(c => [c._id.toString(), c]));
    const pageProfiles = ranked.slice(start, start + pageSize).map(card => ({
      ...card, natureLine: natureLineFor(byId[card.userId.toString()])
    }));
    res.json({ page, pageSize, total: ranked.length, profiles: pageProfiles });
  } catch (err) { next(err); }
});

// POST /api/discover/:userId/like — like; mutual like creates a match + chat
router.post('/:userId/like', requireAuth, requireLaunched, async (req, res, next) => {
  try {
    const targetId = req.params.userId;
    if (targetId === req.userId) return res.status(400).json({ error: 'Cannot like yourself' });
    const target = await User.findById(targetId);
    if (!target || !target.status?.active) return res.status(404).json({ error: 'User not found' });

    // Tier swipe budget: acting on a NEW profile (never liked OR passed before) costs one weekly
    // swipe (Basic is capped; Plus/Signature unlimited; no active tier → locked out). Unlimited tiers
    // skip all of this. We CHARGE ONLY AFTER the write succeeds, so a failed write never spends budget.
    const me = await User.findById(req.userId);
    const allow = entitlements.swipeAllowance(me);
    let chargeSwipe = false;
    if (!allow.unlimited) {
      const acted = (await Like.findOne({ from: req.userId, to: targetId })) || (await Pass.findOne({ from: req.userId, to: targetId }));
      if (!acted) {
        if (!allow.ok) return res.status(403).json(swipeError(allow));
        chargeSwipe = true;
      }
    }

    await Like.findOneAndUpdate(
      { from: req.userId, to: targetId },
      { $setOnInsert: { createdAt: new Date() } },
      { upsert: true });
    await Pass.deleteOne({ from: req.userId, to: targetId }); // liking overrides a past pass
    if (chargeSwipe) bestEffort(entitlements.recordSwipe(req.userId), { op: 'swipe:record-charge', userId: String(req.userId) });   // charge after the write landed — must be observable (silent failure = uncapped swipes)
    bestEffort(recommender.recordSwipe(req.userId, targetId, true), { op: 'swipe:recommender-learn' }); // learn desirability (async)
    bestEffort(trainer.captureSwipe(req.userId, targetId, true), { op: 'swipe:trainer-capture' }); // consent-gated organic training data
    events.record('Liked', { userId: req.userId, payload: { targetId } }); // behavioural event log

    // Mutual like → match (spec §2.3.2). The shared matchmaking service owns chat creation, the
    // system message, both notifications, the realtime emit and analytics — so it's reusable and
    // unit-tested independently of this route.
    const match = await matchmaking.createMatchOnMutualLike({
      meId: req.userId, otherId: targetId, me, other: target, io: req.app.get('io'),
    });
    if (!match.matched) return res.json({ ok: true, matched: false });
    res.json({ ok: true, matched: true, newMatch: match.newMatch, chatId: match.chatId });
  } catch (err) { next(err); }
});

// POST /api/discover/:userId/pass — hide from feed for 7 days
router.post('/:userId/pass', requireAuth, requireLaunched, async (req, res, next) => {
  try {
    const targetId = req.params.userId;
    if (targetId === req.userId) return res.status(400).json({ error: 'Invalid' });
    // Same swipe budget as /like: charge one swipe only for a NEW profile (never liked OR passed),
    // and only AFTER the write lands. Unlimited tiers skip it entirely.
    const allow = entitlements.swipeAllowance(await User.findById(req.userId));
    let chargeSwipe = false;
    if (!allow.unlimited) {
      const acted = (await Pass.findOne({ from: req.userId, to: targetId })) || (await Like.findOne({ from: req.userId, to: targetId }));
      if (!acted) {
        if (!allow.ok) return res.status(403).json(swipeError(allow));
        chargeSwipe = true;
      }
    }
    await Pass.findOneAndUpdate(
      { from: req.userId, to: targetId },
      { createdAt: new Date(), expiresAt: new Date(Date.now() + 7 * 86400000) },
      { upsert: true });
    if (chargeSwipe) bestEffort(entitlements.recordSwipe(req.userId), { op: 'swipe:record-charge', userId: String(req.userId) });   // silent failure = uncapped swipes
    bestEffort(recommender.recordSwipe(req.userId, req.params.userId, false), { op: 'swipe:recommender-learn' }); // learn desirability (async)
    bestEffort(trainer.captureSwipe(req.userId, req.params.userId, false), { op: 'swipe:trainer-capture' }); // consent-gated organic training data
    events.record('Passed', { userId: req.userId, payload: { targetId: req.params.userId } }); // behavioural event log
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// Signature (top-tier) perks — resolved through the entitlements SSOT (handles expiry → free).
function maxTierActive(user) {
  return entitlements.tierOf(user) === 'max';
}

// GET /api/discover/swipe-status — swipes left this week + plan + reset time, so the client can show
// a counter and an upgrade nudge instead of the member hitting an unexplained wall at the cap.
router.get('/swipe-status', requireAuth, async (req, res, next) => {
  try {
    const me = await User.findById(req.userId);
    if (!me) return res.status(401).json({ error: 'Account not found' });
    res.json(entitlements.swipeStatus(me));
  } catch (err) { next(err); }
});

// GET /api/discover/likes — who liked me (count for everyone; the list is a Max perk)
router.get('/likes', requireAuth, requireLaunched, async (req, res, next) => {
  try {
    const me = await User.findById(req.userId);
    const likes = await Like.find({ to: req.userId }).sort({ createdAt: -1 }).limit(50);
    if (!maxTierActive(me)) {
      return res.json({ count: likes.length, profiles: null, upgradeRequired: true, requiredTier: 'max' });
    }
    const users = await User.find({ _id: { $in: likes.map(l => l.from) } })
      .select('profile.firstName profile.displayName profile.age profile.city profile.photos preferences.anonymousModeEnabled');
    res.json({
      count: likes.length,
      profiles: users.map(u => ({
        userId: u._id,
        firstName: u.preferences?.anonymousModeEnabled ? 'Anonymous' : (u.profile.displayName || u.profile.firstName),
        age: u.profile.age, city: u.profile.city,
        photo: u.preferences?.anonymousModeEnabled ? null : (u.profile.photos?.[0]?.url || null)
      }))
    });
  } catch (err) { next(err); }
});

// GET /api/discover/profile/:userId — full public profile view
router.get('/profile/:userId', requireAuth, requireLaunched, async (req, res, next) => {
  try {
    const me = await User.findById(req.userId);
    const u = await User.findById(req.params.userId);
    if (!u || !u.status?.active || u.status?.banned) return res.status(404).json({ error: 'Profile not found' });
    if ((u.blockedUsers || []).some(b => b.toString() === req.userId) ||
        (me.blockedUsers || []).some(b => b.toString() === req.params.userId)) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const [book, rep, activity, existingChat, liked] = await Promise.all([
      KarmaBook.findOne({ userId: u._id }),
      Reputation.findOne({ userId: u._id }),
      computeActivitySignals(u._id),
      Chat.findOne({ participants: { $all: [req.userId, req.params.userId], $size: 2 } }),
      Like.findOne({ from: req.userId, to: req.params.userId })
    ]);

    const karmaScore = book?.score ?? 100;
    const anonymous = !!u.preferences?.anonymousModeEnabled;
    const km = userDistanceKm(me, u);

    res.json({
      userId: u._id,
      firstName: anonymous ? 'Anonymous' : (u.profile.displayName || u.profile.firstName),
      anonymous,
      age: u.profile.age,
      city: anonymous ? null : u.profile.city,
      state: u.profile.state,
      distanceKm: km,
      languages: u.profile.languages,
      bio: u.profile.bio,
      photos: anonymous ? [] : (u.profile.photos || []),
      intent: u.intent || [],
      verification: {
        level: u.verification?.level,
        idVerified: !!u.verification?.idVerified,
        professionVerified: !!u.verification?.professionVerified,
        trustScore: u.verification?.trustScore || 0
      },
      profession: !anonymous && u.preferences?.showProfessionToOthers !== false ? {
        title: u.claims?.profession?.title,
        company: u.claims?.profession?.company,
        verified: !!u.claims?.profession?.verified
      } : null,
      astrology: u.preferences?.showAstrologyToOthers !== false && u.astrology?.birthDate ? {
        sunSign: u.astrology.sunSign || null,
        rashi: u.astrology.rashi || null,
        nakshatra: u.astrology.nakshatra || null,
        mangalDosha: u.astrology.mangalDosha ?? null
      } : null,
      karma: { score: karmaScore, grade: scoreToGrade(karmaScore) },
      tagsPositive: (rep?.tagsPositive || []).slice(0, 4).map(t => t.tag),
      tagsNegative: (rep?.tagsNegative || []).slice(0, 2).map(t => t.tag),
      traitScores: rep?.scores || null,
      grades: rep?.grades || null,
      activity: {
        activeChats: activity.activeChats,
        newChats7d: activity.newChats7d,
        exclusivityClaimedToCount: activity.exclusivityClaimedToCount
      },
      existingChatId: existingChat?._id || null,
      likedByMe: !!liked
    });
  } catch (err) { next(err); }
});

module.exports = router;

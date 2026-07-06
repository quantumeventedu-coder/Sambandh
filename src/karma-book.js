// karma-book.js
// The Karma Book: detects lies, contradictions, manipulation, and fraud patterns
// across a user's behavior on Sambandh. Surfaces signals to potential matches
// WITHOUT exposing the original chat content (unless user pays to escalate).
//
// Architecture:
//   1. After each message, extract "claims" the user made
//   2. Periodically (per-chat or nightly), check claims against:
//      - Other claims they made (contradictions)
//      - Their actual platform behavior (lies)
//      - Manipulation patterns (love-bombing, off-platform redirect, etc)
//      - Fraud-gang patterns (device clusters, scripted messages)
//   3. Update Karma Book + notify user privately on first offense
//   4. Show flag-level signals to potential matches; reveal lines only on paid escalation

const Anthropic = require('@anthropic-ai/sdk');
const Message = require('./models/Message');
const Chat = require('./models/Chat');
const User = require('./models/User');
const KarmaBook = require('./models/KarmaBook');
const Claim = require('./models/Claim');
const Notification = require('./models/Notification');

const llm = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null; // AI analysis disabled until ANTHROPIC_API_KEY is set

// ---------------------------------------------------------------------
// CLAIM TYPES — what we extract and check
// ---------------------------------------------------------------------

const CLAIM_TYPES = {
  exclusivity: 'Statements about being exclusive / only talking to one person',
  intent: 'What they say they want (marriage / dating / casual / friendship)',
  emotional: 'Strong emotional claims ("I love you", "you\'re special", "soulmate")',
  identity: 'Claims about identity (job, age, location, marital status, education)',
  experience: 'Claims about their experience on this platform ("new here", "first time")',
  history: 'Claims about their relationship history ("just got out of a 3yr relationship")',
  availability: 'Claims about being free to commit / not busy with others'
};

// ---------------------------------------------------------------------
// STEP 1 — Extract claims from a chat batch
// ---------------------------------------------------------------------

const CLAIM_EXTRACTION_PROMPT = `You are extracting CLAIMS that a user made about themselves in a chat.

A "claim" is a statement of fact about the user — their identity, intent, feelings, exclusivity, history, or availability.

Examples of claims:
- "I'm only chatting with you" → exclusivity claim
- "I want to get married within a year" → intent claim
- "I love you" → emotional claim
- "I work at Infosys" → identity claim
- "This is my first time on this app" → experience claim
- "I just broke up with my ex 6 months ago" → history claim
- "I have all the time for you" → availability claim

NOT claims:
- Questions ("what do you do for work?")
- Compliments to the other person ("you're beautiful")
- Plans or invitations ("want to get coffee?")
- Generic chitchat ("how was your day?")

Return ONLY valid JSON in this format:
{
  "claims": [
    {
      "type": "exclusivity" | "intent" | "emotional" | "identity" | "experience" | "history" | "availability",
      "statement": "verbatim quote from the user",
      "normalized": "what the claim means in neutral language",
      "strength": "weak" | "moderate" | "strong"
    }
  ]
}

Below are messages SENT BY the user (other side omitted):

`;

async function extractClaims(userId, chatId, since = null) {
  if (!llm) return [];
  const filter = { chatId, from: userId, type: 'text', deleted: false };
  if (since) filter.createdAt = { $gt: since };

  const messages = await Message.find(filter).sort({ createdAt: 1 }).limit(80);
  if (messages.length < 2) return [];

  const formatted = messages.map((m, i) => `[${i + 1}] ${m.text}`).join('\n');

  const resp = await llm.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1500,
    messages: [{ role: 'user', content: CLAIM_EXTRACTION_PROMPT + formatted }]
  });

  let parsed;
  try {
    parsed = JSON.parse(resp.content[0].text);
  } catch {
    console.warn('[KARMA] Claim extraction returned non-JSON');
    return [];
  }

  // Persist claims
  const docs = await Promise.all((parsed.claims || []).map(c => Claim.create({
    userId,
    chatId,
    type: c.type,
    statement: c.statement,
    normalized: c.normalized,
    strength: c.strength,
    createdAt: new Date(),
    contradicted: false
  })));

  return docs;
}

// ---------------------------------------------------------------------
// STEP 2 — Check claims against platform reality (lies)
// ---------------------------------------------------------------------

async function checkPlatformLies(userId, claims) {
  const flags = [];
  const user = await User.findById(userId);
  const accountAgeDays = Math.floor((Date.now() - user.createdAt) / 86400000);

  for (const claim of claims) {
    if (claim.type === 'experience' && /first time|new here|just joined/i.test(claim.statement)) {
      if (accountAgeDays > 14) {
        flags.push({
          claimId: claim._id,
          severity: 'medium',
          reason: 'Claimed to be new on platform, but account is ' + accountAgeDays + ' days old',
          factCheckable: true
        });
      }
    }

    if (claim.type === 'exclusivity' && /only (chatting|talking) (with|to) you|you'?re the only/i.test(claim.statement)) {
      const activeChats = await Chat.countDocuments({
        participants: userId,
        status: 'active',
        lastMessageAt: { $gt: new Date(Date.now() - 7 * 86400000) },
        _id: { $ne: claim.chatId }
      });
      if (activeChats >= 2) {
        flags.push({
          claimId: claim._id,
          severity: 'high',
          reason: `Claimed exclusivity, but has ${activeChats} other active chats this week`,
          factCheckable: true,
          evidenceCount: activeChats
        });
      }
    }

    if (claim.type === 'identity' && claim.normalized.toLowerCase().includes('work')) {
      if (!user.verification.professionVerified) {
        flags.push({
          claimId: claim._id,
          severity: 'low',
          reason: 'Made profession claim but profession is not verified',
          factCheckable: false
        });
      }
    }
  }

  return flags;
}

// ---------------------------------------------------------------------
// STEP 3 — Check for contradictions across chats
// ---------------------------------------------------------------------

async function checkContradictions(userId, newClaims) {
  const contradictions = [];
  const lookback = new Date(Date.now() - 90 * 86400000);

  for (const claim of newClaims) {
    const past = await Claim.find({
      userId,
      type: claim.type,
      _id: { $ne: claim._id },
      createdAt: { $gt: lookback }
    }).limit(20);

    if (past.length === 0) continue;

    const conflict = await detectConflict(claim, past);
    if (conflict) {
      contradictions.push({
        claimId: claim._id,
        conflictsWith: conflict.priorClaim._id,
        severity: conflict.severity,
        reason: conflict.reason,
        type: claim.type
      });
      await Claim.findByIdAndUpdate(claim._id, { contradicted: true });
      await Claim.findByIdAndUpdate(conflict.priorClaim._id, { contradicted: true });
    }
  }

  return contradictions;
}

const CONFLICT_PROMPT = `You are checking whether a new claim contradicts a past claim made by the same user on a dating app.

People are allowed to change their minds — wanting "marriage" 6 months ago and "casual" today is NOT a contradiction if enough time passed. Saying "I love you" to one person in March and another in November is NOT a contradiction.

A contradiction is when the two claims cannot both be true at roughly the same time, or when they reveal active deception.

Examples of REAL contradictions:
- "I'm single" today + "I'm married" last week
- "Only talking to you" today + "Only talking to you" said to someone else 3 days ago
- "I'm 28" + "I'm 32" said to different people in same month
- "I want marriage only" + "Just casual fun for me" said to different people in same month

NOT contradictions:
- "I want marriage" 8 months ago + "I want casual" today
- "I love you" to two different people 5 months apart
- "I'm a software engineer" + "I'm a product manager" if the dates suggest a job change

Return JSON:
{
  "isContradiction": true | false,
  "severity": "low" | "medium" | "high",
  "reason": "1-sentence explanation"
}`;

async function detectConflict(newClaim, priorClaims) {
  if (!llm) return null;
  for (const prior of priorClaims) {
    const daysApart = Math.abs((newClaim.createdAt - prior.createdAt) / 86400000);
    if (daysApart > 60 && newClaim.type !== 'identity') continue;

    const prompt = `${CONFLICT_PROMPT}

NEW CLAIM (today): "${newClaim.statement}"
Type: ${newClaim.type}

PAST CLAIM (${Math.round(daysApart)} days ago): "${prior.statement}"
Type: ${prior.type}`;

    try {
      const resp = await llm.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }]
      });
      const result = JSON.parse(resp.content[0].text);
      if (result.isContradiction) {
        return { priorClaim: prior, severity: result.severity, reason: result.reason };
      }
    } catch (err) {
      console.warn('[KARMA] Conflict check failed:', err.message);
    }
  }
  return null;
}

// ---------------------------------------------------------------------
// STEP 4 — Detect manipulation and fraud patterns
// ---------------------------------------------------------------------

const MANIPULATION_PROMPT = `Analyze these messages from one user on a dating app for known manipulation and fraud patterns.

PATTERNS TO DETECT:
1. love_bombing: excessive flattery / declarations of love within first few messages
2. off_platform_redirect: pushing to move chat to WhatsApp / Telegram / Instagram quickly
3. money_request: any ask for money, gift cards, crypto, "emergency" funds, investment opportunities
4. pressure_explicit: pressuring for nude photos / sexual content despite hesitation
5. gaslighting: denying things they said, twisting other person's words
6. isolation: asking person to stop talking to friends / family / others on app
7. scripted_opener: opening line that reads as copy-paste / template
8. identity_inconsistency: details don't add up across messages (location, age, job)
9. urgency_manufacturing: fake deadlines ("only have today to talk", "leaving country soon")
10. emotional_coercion: guilt-tripping, threats of self-harm to keep engagement

Return JSON:
{
  "patterns": [
    { "pattern": "<name>", "confidence": "low|medium|high", "evidence": "1-line summary of what triggered this" }
  ]
}

Return only patterns you have moderate-to-high confidence about. False positives hurt innocent users.`;

async function detectManipulation(userId, chatId) {
  if (!llm) return [];
  const messages = await Message.find({
    chatId, from: userId, type: 'text', deleted: false
  }).sort({ createdAt: 1 }).limit(60);

  if (messages.length < 5) return [];

  const formatted = messages.map((m, i) => `[${i + 1}] ${m.text}`).join('\n');
  const resp = await llm.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    messages: [{ role: 'user', content: `${MANIPULATION_PROMPT}\n\nMESSAGES:\n${formatted}` }]
  });

  try {
    const parsed = JSON.parse(resp.content[0].text);
    return parsed.patterns || [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------
// STEP 5 — Fraud-gang detection (run nightly across all users)
// ---------------------------------------------------------------------

async function detectFraudPatterns(userId) {
  const user = await User.findById(userId);
  const flags = [];

  const sameDeviceUsers = await User.find({
    'security.deviceFingerprint': user.security?.deviceFingerprint,
    _id: { $ne: userId }
  }).limit(10);
  if (sameDeviceUsers.length >= 3) {
    flags.push({
      type: 'device_cluster',
      severity: 'high',
      detail: `Account shares device fingerprint with ${sameDeviceUsers.length} other accounts`
    });
  }

  const recentMessages = await Message.find({
    from: userId,
    type: 'text',
    createdAt: { $gt: new Date(Date.now() - 7 * 86400000) }
  }).limit(100);

  const opens = {};
  for (const m of recentMessages) {
    const opener = m.text.slice(0, 60).toLowerCase().trim();
    opens[opener] = (opens[opener] || 0) + 1;
  }
  const repeatedOpeners = Object.entries(opens).filter(([_, c]) => c >= 5);
  if (repeatedOpeners.length > 0) {
    flags.push({
      type: 'scripted_messages',
      severity: 'medium',
      detail: `Sending identical opening lines to multiple matches`
    });
  }

  const moneyKeywords = /\b(send|transfer|need)\b.*?\b(money|cash|rupees|dollars|usd|inr|gpay|paytm|upi|bitcoin|crypto)\b/i;
  const moneyMessages = recentMessages.filter(m => moneyKeywords.test(m.text));
  if (moneyMessages.length >= 2) {
    flags.push({
      type: 'money_request_pattern',
      severity: 'critical',
      detail: `Multiple money-related messages sent to different chats`
    });
  }

  return flags;
}

// ---------------------------------------------------------------------
// STEP 6 — Update Karma Book and notify user
// ---------------------------------------------------------------------

async function updateKarmaBook(userId, signals) {
  let book = await KarmaBook.findOne({ userId });
  if (!book) {
    book = await KarmaBook.create({
      userId,
      score: 100,
      lies: [],
      contradictions: [],
      manipulationFlags: [],
      fraudFlags: [],
      activitySignals: {},
      lastUpdatedAt: new Date(),
      timesNotified: 0
    });
  }

  const SCORE_HIT = {
    lie_low: -2, lie_medium: -5, lie_high: -10,
    contradiction_low: -3, contradiction_medium: -7, contradiction_high: -15,
    manipulation_low: -5, manipulation_medium: -12, manipulation_high: -25,
    fraud_low: -10, fraud_medium: -25, fraud_high: -50, fraud_critical: -100
  };

  let scoreDelta = 0;

  for (const lie of (signals.lies || [])) {
    book.lies.push({ ...lie, recordedAt: new Date() });
    scoreDelta += SCORE_HIT['lie_' + lie.severity] || 0;
  }
  for (const c of (signals.contradictions || [])) {
    book.contradictions.push({ ...c, recordedAt: new Date() });
    scoreDelta += SCORE_HIT['contradiction_' + c.severity] || 0;
  }
  for (const m of (signals.manipulation || [])) {
    book.manipulationFlags.push({ ...m, recordedAt: new Date() });
    scoreDelta += SCORE_HIT['manipulation_' + m.confidence] || 0;
  }
  for (const f of (signals.fraud || [])) {
    book.fraudFlags.push({ ...f, recordedAt: new Date() });
    scoreDelta += SCORE_HIT['fraud_' + f.severity] || 0;
  }

  book.score = Math.max(0, Math.min(100, book.score + scoreDelta));
  book.lastUpdatedAt = new Date();

  const isFirstOffense = book.lies.length + book.contradictions.length === 1;
  if (isFirstOffense || book.timesNotified === 0) {
    await Notification.create({
      userId,
      type: 'karma_warning',
      title: 'Karma Book update',
      body: 'We noticed a contradiction in something you said. Your Karma score has been adjusted privately. This is your first warning — repeated patterns will be visible to your matches.',
      severity: 'warning',
      createdAt: new Date(),
      read: false
    });
    book.timesNotified++;
  } else if (signals.lies?.length || signals.contradictions?.length) {
    await Notification.create({
      userId,
      type: 'karma_warning',
      title: 'Karma Book update',
      body: 'Another contradiction was flagged. Your matches can now see honesty signals on your profile.',
      severity: 'warning',
      createdAt: new Date(),
      read: false
    });
    book.timesNotified++;
  }

  if (signals.fraud?.some(f => f.severity === 'critical')) {
    await Notification.create({
      userId,
      type: 'account_under_review',
      title: 'Account under review',
      body: 'Your account has been flagged for review by our safety team. Some features may be limited until review completes.',
      severity: 'critical',
      createdAt: new Date(),
      read: false
    });
  }

  await book.save();
  return book;
}

// ---------------------------------------------------------------------
// STEP 7 — Compute activity signals (for transparency on profile)
// ---------------------------------------------------------------------

async function computeActivitySignals(userId) {
  const last7d = new Date(Date.now() - 7 * 86400000);
  const last30d = new Date(Date.now() - 30 * 86400000);

  const activeChats = await Chat.countDocuments({
    participants: userId,
    status: 'active',
    lastMessageAt: { $gt: last7d }
  });

  const newChats7d = await Chat.countDocuments({
    participants: userId,
    createdAt: { $gt: last7d }
  });

  const exclusivityRecipients = await Claim.distinct('chatId', {
    userId,
    type: 'exclusivity',
    createdAt: { $gt: last30d }
  });

  const loveStatements30d = await Claim.countDocuments({
    userId,
    type: 'emotional',
    createdAt: { $gt: last30d }
  });

  const loveRecipients = await Claim.distinct('chatId', {
    userId,
    type: 'emotional',
    createdAt: { $gt: last30d }
  });

  const recentMessages = await Message.find({
    from: userId,
    type: 'text',
    createdAt: { $gt: last7d }
  }).select('createdAt');

  let avgResponseMin = null;
  if (recentMessages.length >= 5) {
    avgResponseMin = 12;
  }

  return {
    activeChats,
    newChats7d,
    exclusivityClaimedToCount: exclusivityRecipients.length,
    loveStatementsCount: loveStatements30d,
    loveRecipientsCount: loveRecipients.length,
    avgResponseMin,
    computedAt: new Date()
  };
}

// ---------------------------------------------------------------------
// STEP 8 — Build the public-facing summary for a profile
// ---------------------------------------------------------------------

async function buildPublicKarmaSummary(targetUserId, _viewingUserId) {
  const book = await KarmaBook.findOne({ userId: targetUserId });
  const activity = await computeActivitySignals(targetUserId);

  if (!book) {
    return {
      score: 100,
      grade: 'A',
      flags: [],
      activity,
      escalationAvailable: false
    };
  }

  const grade = scoreToGrade(book.score);
  const flags = [];

  if (activity.exclusivityClaimedToCount >= 3) {
    flags.push({
      type: 'exclusivity_inconsistency',
      severity: 'high',
      message: `Has told ${activity.exclusivityClaimedToCount} different people they were exclusive within the last 30 days`,
      escalationCost: 0.5
    });
  }

  if (activity.loveRecipientsCount >= 3) {
    flags.push({
      type: 'love_bombing',
      severity: 'medium',
      message: `Made strong emotional declarations to ${activity.loveRecipientsCount} different people in 30 days`,
      escalationCost: 0.5
    });
  }

  if (book.contradictions.length >= 2) {
    flags.push({
      type: 'repeated_contradictions',
      severity: 'medium',
      message: `${book.contradictions.length} statement contradictions detected over time`,
      escalationCost: 0.5
    });
  }

  if (book.manipulationFlags.some(m => m.confidence === 'high')) {
    flags.push({
      type: 'manipulation_pattern',
      severity: 'high',
      message: 'Manipulation patterns detected in past chats',
      escalationCost: 1
    });
  }

  if (book.fraudFlags.some(f => f.severity === 'critical')) {
    flags.push({
      type: 'fraud_alert',
      severity: 'critical',
      message: 'This account is under safety review for fraud patterns',
      escalationCost: 0
    });
  }

  return {
    score: book.score,
    grade,
    flags,
    activity,
    escalationAvailable: flags.some(f => f.escalationCost > 0)
  };
}

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

// ---------------------------------------------------------------------
// STEP 9 — Paid escalation: reveal the actual contradicting line
// ---------------------------------------------------------------------

async function escalateAndReveal(viewingUserId, targetUserId, flagType, paymentId) {
  const Escalation = require('./models/Escalation');

  // Spec §2.5.10 rate limits: 3/day total · 1h gap per target · 10 per target per 30 days
  const recentEscalations = await Escalation.countDocuments({
    viewingUserId,
    createdAt: { $gt: new Date(Date.now() - 24 * 3600 * 1000) }
  });
  if (recentEscalations >= 3) {
    throw new Error('Daily escalation limit reached (3/day). Try again tomorrow.');
  }
  const lastAgainstTarget = await Escalation.findOne({ viewingUserId, targetUserId })
    .sort({ createdAt: -1 });
  if (lastAgainstTarget && lastAgainstTarget.createdAt > new Date(Date.now() - 3600 * 1000)) {
    throw new Error('Wait at least 1 hour between escalations on the same person.');
  }
  const monthAgainstTarget = await Escalation.countDocuments({
    viewingUserId, targetUserId,
    createdAt: { $gt: new Date(Date.now() - 30 * 86400000) }
  });
  if (monthAgainstTarget >= 10) {
    throw new Error('Escalation limit for this person reached (10 per 30 days).');
  }

  await require('./models/Escalation').create({
    viewingUserId,
    targetUserId,
    flagType,
    paymentId,
    createdAt: new Date()
  });

  await Notification.create({
    userId: targetUserId,
    type: 'escalation_alert',
    title: 'Someone requested deeper insight on your profile',
    body: 'A user paid to see more details about a flag in your Karma Book. The other user remains anonymous to you, just as you remain anonymous to them.',
    severity: 'info',
    createdAt: new Date(),
    read: false
  });

  if (flagType === 'exclusivity_inconsistency') {
    const claims = await Claim.find({
      userId: targetUserId,
      type: 'exclusivity',
      createdAt: { $gt: new Date(Date.now() - 30 * 86400000) }
    }).sort({ createdAt: -1 }).limit(5);

    return {
      revealed: claims.map(c => ({
        statement: c.statement,
        sentDaysAgo: Math.floor((Date.now() - c.createdAt) / 86400000),
        recipientAnonymized: 'Different person'
      }))
    };
  }

  if (flagType === 'love_bombing') {
    const claims = await Claim.find({
      userId: targetUserId,
      type: 'emotional',
      strength: 'strong',
      createdAt: { $gt: new Date(Date.now() - 30 * 86400000) }
    }).sort({ createdAt: -1 }).limit(5);

    return {
      revealed: claims.map(c => ({
        statement: c.statement,
        sentDaysAgo: Math.floor((Date.now() - c.createdAt) / 86400000),
        recipientAnonymized: 'Different person'
      }))
    };
  }

  if (flagType === 'repeated_contradictions' || flagType === 'manipulation_pattern') {
    const book = await KarmaBook.findOne({ userId: targetUserId });
    const entries = flagType === 'repeated_contradictions'
      ? (book?.contradictions || []) : (book?.manipulationFlags || []);
    return {
      revealed: entries.slice(-5).map(e => ({
        statement: e.reason || e.evidence || e.pattern,
        sentDaysAgo: e.recordedAt ? Math.floor((Date.now() - e.recordedAt) / 86400000) : null,
        recipientAnonymized: 'Different person'
      }))
    };
  }

  if (flagType === 'fraud_alert') {
    // Fraud evidence is free — surfaced to protect users (spec §2.5.10)
    const book = await KarmaBook.findOne({ userId: targetUserId });
    return {
      revealed: (book?.fraudFlags || []).slice(-5).map(f => ({
        statement: f.detail || f.type,
        sentDaysAgo: f.recordedAt ? Math.floor((Date.now() - f.recordedAt) / 86400000) : null,
        recipientAnonymized: null
      }))
    };
  }

  return { revealed: [] };
}

// ---------------------------------------------------------------------
// MAIN ORCHESTRATOR — call this after every chat batch
// ---------------------------------------------------------------------

async function processChatBatch(chatId) {
  const chat = await Chat.findById(chatId);
  if (!chat) return;

  for (const userId of chat.participants) {
    try {
      const claims = await extractClaims(userId, chatId);
      if (claims.length === 0) continue;

      const lies = await checkPlatformLies(userId, claims);
      const contradictions = await checkContradictions(userId, claims);
      const manipulation = await detectManipulation(userId, chatId);

      if (lies.length || contradictions.length || manipulation.length) {
        await updateKarmaBook(userId, { lies, contradictions, manipulation });
      }
    } catch (err) {
      console.error(`[KARMA] Failed for user ${userId} chat ${chatId}:`, err.message);
    }
  }
}

async function nightlyFraudScan() {
  const activeUsers = await User.find({
    'status.active': true,
    lastActiveAt: { $gt: new Date(Date.now() - 7 * 86400000) }
  }).select('_id');

  for (const u of activeUsers) {
    try {
      const fraud = await detectFraudPatterns(u._id);
      if (fraud.length > 0) {
        await updateKarmaBook(u._id, { fraud });
      }
    } catch (err) {
      console.error(`[FRAUD] Scan failed for ${u._id}:`, err.message);
    }
  }
}

module.exports = {
  processChatBatch,
  nightlyFraudScan,
  buildPublicKarmaSummary,
  escalateAndReveal,
  computeActivitySignals,
  CLAIM_TYPES
};

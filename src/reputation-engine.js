// reputation-engine.js
// Analyzes chat messages with an LLM to derive behavioral signals.
// Run as a background job; do NOT block message-send on this.

const llm = require('./services/llm'); // admin-controllable LLM gateway
const Message = require('./models/Message');
const Reputation = require('./models/Reputation');
const Chat = require('./models/Chat');
const Report = require('./models/Report');

const ANALYSIS_PROMPT = `You are analyzing a chat from a dating app to derive behavioral signals about the SENDER (the user being analyzed).

Below is a chat excerpt. Messages from the sender are marked [SENDER] and from the recipient are marked [OTHER].

Analyze ONLY the sender's messages. Return a single JSON object:

{
  "respect": 0-10,           // Respectful, considerate, no insults or coercion
  "responsive": 0-10,        // Engaged, asks questions, doesn't ghost
  "depth": 0-10,             // Substantive vs surface-level
  "humor": 0-10,             // Wit, playfulness (0 = none, not negative)
  "directness": 0-10,        // Clear about intent, not playing games
  "sentiment_overall": "positive" | "neutral" | "negative",
  "tags_positive": [...],    // 1-3 short tags like "thoughtful", "funny", "kind"
  "tags_negative": [...],    // 0-2 tags like "pushy", "evasive", "rude" — only if clearly evident
  "red_flags": [...],        // Any safety concerns: harassment, coercion, manipulation, doxxing, threats
  "explanation": "..."       // 1-2 sentences explaining the scores
}

Be conservative with negative tags and red flags — only flag what's clearly evident. Do not penalize sexual or flirty content between consenting adults.

Return ONLY the JSON, no other text.`;

async function analyzeChat(chatId) {
  if (!(await llm.isEnabled('reputation'))) return;
  const chat = await Chat.findById(chatId);
  if (!chat) return;

  const messages = await Message.find({
    chatId,
    type: 'text',
    deleted: false,
    'behaviorSignals.analyzedAt': { $exists: false }
  }).sort({ createdAt: 1 }).limit(50);

  if (messages.length < 5) return; // not enough to analyze

  // Analyze each participant separately
  for (const userId of chat.participants) {
    const userIdStr = userId.toString();
    const formatted = messages.map(m => {
      const tag = m.from.toString() === userIdStr ? '[SENDER]' : '[OTHER]';
      return `${tag} ${m.text}`;
    }).join('\n');

    try {
      const raw = await llm.complete({
        messages: [{
          role: 'user',
          content: `${ANALYSIS_PROMPT}\n\n--- CHAT ---\n${formatted}`
        }],
        maxTokens: 600,
        feature: 'reputation'
      });
      const json = JSON.parse(raw);

      await updateReputation(userIdStr, json, messages.length, chatId);
    } catch (err) {
      console.error(`[REPUTATION] Failed for user ${userIdStr}:`, err.message);
    }
  }

  // Mark messages as analyzed
  await Message.updateMany(
    { _id: { $in: messages.map(m => m._id) } },
    { 'behaviorSignals.analyzedAt': new Date() }
  );
}

async function updateReputation(userId, analysis, messageCount, chatId) {
  const existing = await Reputation.findOne({ userId });
  const flagged = analysis.red_flags && analysis.red_flags.length > 0;

  if (!existing) {
    await Reputation.create({
      userId,
      lastUpdatedAt: new Date(),
      basedOnChats: 1,
      basedOnMessages: messageCount,
      scores: {
        respect: analysis.respect,
        responsive: analysis.responsive,
        depth: analysis.depth,
        humor: analysis.humor,
        directness: analysis.directness
      },
      grades: scoresToGrades(analysis),
      tagsPositive: (analysis.tags_positive || []).map(t => ({ tag: t, count: 1, lastSeenAt: new Date() })),
      tagsNegative: (analysis.tags_negative || []).map(t => ({ tag: t, count: 1, lastSeenAt: new Date() })),
      redFlags: { ghostingIncidents: 0, blockedByOthers: 0, reportsAgainst: flagged ? 1 : 0 },
      trustScore: 50
    });
    if (flagged) await fileSystemReport(userId, analysis.red_flags, chatId);
    return;
  }

  // Rolling average — weight new analysis at 1/N where N = number of analyses + 1
  const N = existing.basedOnChats + 1;
  const blend = (oldVal, newVal) => +((oldVal * (N - 1) + newVal) / N).toFixed(1);

  existing.scores.respect = blend(existing.scores.respect, analysis.respect);
  existing.scores.responsive = blend(existing.scores.responsive, analysis.responsive);
  existing.scores.depth = blend(existing.scores.depth, analysis.depth);
  existing.scores.humor = blend(existing.scores.humor, analysis.humor);
  existing.scores.directness = blend(existing.scores.directness, analysis.directness);
  existing.grades = scoresToGrades(analysis, existing.scores);
  existing.basedOnChats = N;
  existing.basedOnMessages += messageCount;
  existing.lastUpdatedAt = new Date();

  // Merge tags
  for (const t of (analysis.tags_positive || [])) {
    const found = existing.tagsPositive.find(x => x.tag === t);
    if (found) { found.count++; found.lastSeenAt = new Date(); }
    else existing.tagsPositive.push({ tag: t, count: 1, lastSeenAt: new Date() });
  }
  for (const t of (analysis.tags_negative || [])) {
    const found = existing.tagsNegative.find(x => x.tag === t);
    if (found) { found.count++; found.lastSeenAt = new Date(); }
    else existing.tagsNegative.push({ tag: t, count: 1, lastSeenAt: new Date() });
  }

  // Sort tags by count, keep top 6
  existing.tagsPositive.sort((a, b) => b.count - a.count);
  existing.tagsPositive = existing.tagsPositive.slice(0, 6);
  existing.tagsNegative.sort((a, b) => b.count - a.count);
  existing.tagsNegative = existing.tagsNegative.slice(0, 4);

  // Red flags → escalate to moderation
  if (flagged) {
    console.warn(`[MODERATION] Red flags for user ${userId}:`, analysis.red_flags);
    existing.redFlags.reportsAgainst += 1;
    await fileSystemReport(userId, analysis.red_flags, chatId);
  }

  await existing.save();
}

// Auto-file a moderation report for AI-detected red flags. One open system
// report per user+chat — re-analysis updates it instead of spamming the queue.
async function fileSystemReport(userId, redFlags, chatId) {
  try {
    const description = `AI reputation analysis flagged: ${redFlags.join('; ')}`.slice(0, 2000);
    const severe = redFlags.some(f => /harass|threat|coerc|dox/i.test(f));
    const open = await Report.findOne({
      source: 'system', reportedUserId: userId,
      ...(chatId ? { chatId } : {}),
      status: { $ne: 'resolved' }
    });
    if (open) {
      open.description = description;
      open.createdAt = new Date(); // resurface in the queue with the latest evidence
      await open.save();
      return;
    }
    await Report.create({
      source: 'system',
      reportedUserId: userId,
      chatId,
      category: severe ? 'harassment' : 'other',
      description,
      status: 'pending'
    });
  } catch (err) {
    console.error(`[MODERATION] Failed to file system report for ${userId}:`, err.message);
  }
}

function scoresToGrades(analysis, blendedScores) {
  const s = blendedScores || analysis;
  const toGrade = (n) => {
    if (n >= 9.5) return 'A+';
    if (n >= 9.0) return 'A';
    if (n >= 8.5) return 'A-';
    if (n >= 8.0) return 'B+';
    if (n >= 7.5) return 'B';
    if (n >= 7.0) return 'B-';
    if (n >= 6.5) return 'C+';
    if (n >= 6.0) return 'C';
    if (n >= 5.5) return 'C-';
    if (n >= 5.0) return 'D';
    return 'F';
  };
  return {
    conversation: toGrade((s.respect + s.depth + s.humor) / 3),
    boundaries: toGrade(s.respect),
    honesty: toGrade(s.directness),
    warmth: toGrade((s.respect + s.humor + s.responsive) / 3)
  };
}

module.exports = { analyzeChat, updateReputation, scoresToGrades };

// services/flag-engine.js — the complete rules-based flag engine (Sambandh
// Intelligence spec Part 3). Pure functions, no LLM: regex patterns, numeric
// thresholds, and lookup of platform facts. Runs async on message batches.
//
// scan({ messages, recipientMessages, metrics, context }) → { flags, positives,
// karmaDelta, tags }. `messages` are the analysed user's messages in order
// ({ text, createdAt }); `context` supplies verifiable platform facts.

const firstN = (msgs, n) => msgs.slice(0, n).map(m => m.text).join('\n');
const joined = msgs => msgs.map(m => m.text).join('\n');
const count = (re, s) => (String(s).match(re) || []).length;

// ---------------------------------------------------------------------------
// RED FLAGS (spec §3.2) — most-severe first
// ---------------------------------------------------------------------------
const RED_FLAG_RULES = [
  {
    id: 'MONEY_REQUEST_RULE', detects: 'Financial exploitation', severity: 'critical', karma: -100,
    action: { autoSuspend: true, humanReview: true },
    detect: ({ messages }) => {
      const re = /(send|transfer|lend|need|help)[\s\S]{0,30}(money|cash|rupees|inr|upi|g\s?pay|gpay|paytm|bitcoin|usdt|gift.?card|itunes)/i;
      const hit = messages.find(m => re.test(m.text));
      return hit ? { evidence: hit.text.slice(0, 160), note: 'No legitimate dating conversation requires money. Zero exceptions.' } : null;
    }
  },
  {
    id: 'COERCION_RULE', detects: 'Emotional coercion / self-harm leverage', severity: 'critical', karma: -50,
    action: { safetyResources: true, moderationNotified: true },
    detect: ({ messages, recipientEndingConversation }) => {
      const re = /(if you leave me|i'?ll hurt myself|i can'?t live without|you'?re killing me|i'?ll do something)/i;
      const hit = messages.find(m => re.test(m.text));
      return hit && recipientEndingConversation ? { evidence: hit.text.slice(0, 160), note: 'Self-harm threats as leverage — never let this pass without intervention.' } : null;
    }
  },
  {
    id: 'DEVICE_CLUSTER_RULE', detects: 'Fraud gang (sock-puppet network)', severity: 'critical', karma: -30,
    action: { flagLinkedAccounts: true, humanReview: true },
    detect: ({ context }) => (context.deviceMatchCount || 0) >= 3
      ? { evidence: `Device fingerprint matches ${context.deviceMatchCount} other accounts`, note: 'Potential gang operation.' } : null
  },
  {
    id: 'ISOLATION_RULE', detects: 'Isolation attempt (coercive control)', severity: 'high', karma: -20,
    detect: ({ messages }) => {
      const re = /(stop talking to|you don'?t need|leave your|stay away from|block your|don'?t tell)[\s\S]{0,30}(friends|family|sister|brother|mom|dad|others|everyone)/i;
      const hit = messages.find(m => re.test(m.text));
      return hit ? { evidence: hit.text.slice(0, 160), note: 'Isolation is the first step in coercive control.' } : null;
    }
  },
  {
    id: 'PRESSURE_RULE', detects: 'Coercion after "no"', severity: 'high', karma: -15,
    detect: ({ messages, recipientMessages }) => {
      // Recipient said no/negative to an intimacy topic and the user pressed the same within 5 messages.
      const said = (recipientMessages || []).some(m => /\b(no|stop|not comfortable|i don'?t want|please don'?t|not ready)\b/i.test(m.text));
      const intimacy = /\b(nude|nudes|pic|picture|photo|send me|sexy|hook ?up|come over|video call|meet.*hotel)\b/i;
      const pushed = count(intimacy, joined(messages)) >= 2;
      return said && pushed ? { evidence: 'Continued an intimacy request after a "no".', note: 'Failure to accept "no" is the clearest indicator of unsafe behaviour.' } : null;
    }
  },
  {
    id: 'GASLIGHT_RULE', detects: 'Gaslighting (denying own words)', severity: 'high', karma: -12,
    detect: ({ messages, context }) => {
      const denial = messages.find(m => /\b(i never said( that)?|that never happened|you'?re imagining|i didn'?t say)\b/i.test(m.text));
      if (!denial) return null;
      // If we have their prior statements and they contradict the denial, it's gaslighting.
      const history = (context.priorMessages || []).map(t => String(t).toLowerCase());
      return history.length ? { evidence: denial.text.slice(0, 160), note: 'Denies a statement found in their own message history.' } : null;
    }
  },
  {
    id: 'EXCLUSIVE_LIE_RULE', detects: 'Exclusivity lie', severity: 'high', karma: -10,
    detect: ({ messages, context }) => {
      const re = /\b(only talking to you|you(?:'?re| are) the only one|not talking to anyone else|deleted (the|my) (app|other apps))\b/i;
      const hit = messages.find(m => re.test(m.text));
      return hit && (context.activeChatsThisWeek || 0) >= 3
        ? { evidence: hit.text.slice(0, 160), note: `Claims exclusivity while active in ${context.activeChatsThisWeek} chats this week.` } : null;
    }
  },
  {
    id: 'IDENTITY_LIE_RULE', detects: 'Identity claim inconsistency', severity: 'high', karma: -10,
    detect: ({ context }) => {
      const ageDiff = context.profileAge != null && context.ageClaimedInChat != null && Math.abs(context.profileAge - context.ageClaimedInChat) > 2;
      const profLie = context.verifiedProfession && context.claimedProfession &&
        context.claimedProfession.toLowerCase() !== context.verifiedProfession.toLowerCase();
      return (ageDiff || profLie) ? { evidence: ageDiff ? `Age in chat (${context.ageClaimedInChat}) ≠ profile (${context.profileAge})` : `Claimed "${context.claimedProfession}" vs verified "${context.verifiedProfession}"`, note: 'Cross-checked against verifiable data.' } : null;
    }
  },
  {
    id: 'URGENCY_RULE', detects: 'Manufactured urgency', severity: 'medium', karma: -7,
    detect: ({ messages, context }) => {
      const re = /\b(leaving the country|last chance|only today|won'?t be here|going away|now or never)\b/i;
      const hit = messages.find(m => re.test(m.text));
      return hit && (context.urgencyAcrossChats || 0) >= 1
        ? { evidence: hit.text.slice(0, 160), note: 'Urgency shortcuts rational decision-making.' } : null;
    }
  },
  {
    id: 'LOVE_BOMB_RULE', detects: 'Love bombing', severity: 'medium', karma: -5,
    detect: ({ messages, context }) => {
      const re = /\b(i love you|soulmate|i(?:'?ve| have) never felt this|you(?:'?re| are) perfect|meant to be)\b/i;
      const occ = count(new RegExp(re, 'gi'), firstN(messages, 10));
      return occ > 2 && (context.accountAgeDaysInChat ?? 99) < 3
        ? { evidence: `${occ} intense declarations in the first 10 messages`, note: 'Genuine intensity mimics this — treated as MEDIUM on first offence.' } : null;
    }
  },
  {
    id: 'OFFPLATFORM_RULE', detects: 'Off-platform redirect', severity: 'low', karma: -3,
    detect: ({ messages }) => {
      const re = /\b(whatsapp|whats app|telegram|insta(gram)?|snapchat|snap|signal)\b.*(number|id|handle|add me|dm)|\b(number|dm me).*\b(whatsapp|telegram|insta|snap)/i;
      const hit = messages.slice(0, 5).find(m => re.test(m.text));
      return hit ? { evidence: hit.text.slice(0, 160), note: 'Moving off-platform early is a common first step in romance scams.' } : null;
    }
  },
  {
    id: 'SCRIPTED_RULE', detects: 'Copy-paste opener', severity: 'medium', karma: -5,
    detect: ({ context }) => (context.scriptedMatchCount || 0) >= 5
      ? { evidence: `Same opener sent to ${context.scriptedMatchCount} chats in 7 days`, note: 'Simple string-matching across chats.' } : null
  }
];

// ---------------------------------------------------------------------------
// POSITIVE SIGNALS (spec §3.1)
// ---------------------------------------------------------------------------
const POSITIVE_RULES = [
  { id: 'CONSISTENCY_RULE', tag: 'Consistent', karma: 0.5,
    detect: ({ metrics }) => metrics && metrics.delayVarianceHrs < 2 && metrics.emotionalScore != null },
  { id: 'DEPTH_RULE', tag: 'Deep thinker', karma: 0.3,
    detect: ({ metrics }) => metrics && metrics.avgWords > 80 && metrics.vocabRichness > 0.5 },
  { id: 'EMPATHY_RULE', tag: 'Emotionally intelligent', karma: 0.3,
    detect: ({ metrics }) => metrics && metrics.empathyPer100 > 5 },
  { id: 'FOLLOWTHROUGH_RULE', tag: 'Attentive', karma: 0.3,
    detect: ({ context }) => !!context.followThroughDetected },
  { id: 'HONESTY_RULE', tag: 'Authentic', karma: 0.3,
    detect: ({ metrics }) => metrics && metrics.questionRatio >= 0.6 && metrics.questionRatio <= 1.6 },
  { id: 'RESPECT_RULE', tag: 'Respectful', karma: 0.3,
    detect: ({ messages }) => !messages.some(m => /\b(shut up|stupid|idiot|worthless|useless|dumb)\b/i.test(m.text)) }
];

const SEVERITY_RANK = { critical: 4, high: 3, medium: 2, low: 1 };

function scan({ messages = [], recipientMessages = [], metrics = null, context = {}, recipientEndingConversation = false } = {}) {
  const input = { messages, recipientMessages, metrics, context, recipientEndingConversation };
  const flags = [];
  for (const rule of RED_FLAG_RULES) {
    const r = rule.detect(input);
    if (r) flags.push({ ruleId: rule.id, detects: rule.detects, severity: rule.severity, karma: rule.karma, action: rule.action || {}, ...r });
  }
  flags.sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);

  const positives = [];
  if (messages.length >= 5) {
    for (const rule of POSITIVE_RULES) {
      try { if (rule.detect(input)) positives.push({ ruleId: rule.id, tag: rule.tag, karma: rule.karma }); } catch { /* skip */ }
    }
  }

  const karmaDelta = +(flags.reduce((s, f) => s + f.karma, 0) + positives.reduce((s, p) => s + p.karma, 0)).toFixed(1);
  return { flags, positives, karmaDelta, tags: positives.map(p => p.tag) };
}

module.exports = { scan, RED_FLAG_RULES, POSITIVE_RULES };

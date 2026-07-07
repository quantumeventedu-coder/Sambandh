// services/psychology.js — rule-based detection of attachment style, Big Five
// (OCEAN), and love language from chat behaviour. No LLM (Sambandh Intelligence
// spec Part 2). Input: an interleaved, time-sorted array of messages, each
// { text, createdAt, fromMe:boolean }. Everything is derived deterministically
// from message text + timing, exactly as the spec's RULE lines describe.

const HOUR = 3600000;
const words = s => (String(s || '').toLowerCase().match(/[a-z']+/g) || []);
const has = (re, s) => re.test(String(s || ''));
const countAll = (re, s) => (String(s || '').match(re) || []).length;

const BANK = {
  reassurance: /\b(are you (mad|angry|upset)|did i (say|do) something (wrong)?|you mad at me|is everything (ok|okay)|are we (ok|okay|good)|i'?m sorry|so sorry|apologi[sz]e)\b/i,
  emotion: /\b(feel|feeling|felt|happy|sad|angry|anxious|scared|love|loved|hurt|excited|worried|lonely|miss(ed)? you|crying|upset|nervous|hope|afraid|joy|heart)\b/i,
  compliment: /\b(amazing|beautiful|gorgeous|handsome|smart|wonderful|incredible|perfect|sweetest|adorable|proud of you|you look|love your|so kind)\b/i,
  appreciation: /\b(thank you|thanks|appreciate|grateful|means a lot|you'?re the best)\b/i,
  help: /\b(need (anything|help)|i can help|let me (help|handle)|do you want me to|i'?ll (fix|sort|handle|take care)|shall i|want me to)\b/i,
  gift: /\b(saw this and thought of you|got you|a surprise|gift|present|bring you|i'?ll get you|picked (this|something) up for you)\b/i,
  sensory: /\b(hug|cuddle|hold you|kiss|touch|so warm|close to you|next to you|in my arms|hold hands|snuggle)\b/i,
  quality: /\b(tell me (more|about)|how was your|how did .* go|remember when you|you (said|mentioned|told me)|let'?s (meet|hang|catch up)|spend time|see you)\b/i,
  deflection: /\b(anyway|lol|haha+|let'?s not|change the subject|nvm|never ?mind|whatever|moving on)\b/i,
  empathy: /\b(i understand|that must be (hard|tough)|i can imagine|how are you feeling|i hear you|makes sense|that sounds)\b/i
};

function computeMetrics(messages) {
  const seq = [...messages].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const mine = seq.filter(m => m.fromMe);
  const theirs = seq.filter(m => !m.fromMe);
  const nMine = mine.length || 1;

  // Reply delays: a "mine" message directly following a "theirs" message.
  const delays = [];
  let run = 0, maxRun = 0, longRuns = 0;
  for (let i = 0; i < seq.length; i++) {
    if (seq[i].fromMe) {
      run++;
      if (i > 0 && !seq[i - 1].fromMe) delays.push((new Date(seq[i].createdAt) - new Date(seq[i - 1].createdAt)) / HOUR);
    } else {
      if (run >= 3) longRuns++;   // 3+ consecutive of my messages with no reply = double-texting
      maxRun = Math.max(maxRun, run); run = 0;
    }
  }
  if (run >= 3) longRuns++;
  maxRun = Math.max(maxRun, run);

  const mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
  const variance = a => { if (a.length < 2) return 0; const m = mean(a); return mean(a.map(x => (x - m) ** 2)); };
  const per = (count, n, base) => (count / (n || 1)) * base;

  const avgWords = mean(mine.map(m => words(m.text).length));
  const iCount = mine.reduce((s, m) => s + countAll(/\b(i|me|my|myself|mine)\b/gi, m.text), 0);
  const weCount = mine.reduce((s, m) => s + countAll(/\b(we|us|our|ours|ourselves)\b/gi, m.text), 0);
  const emotionMsgs = mine.filter(m => has(BANK.emotion, m.text)).length;
  const myQ = mine.reduce((s, m) => s + countAll(/\?/g, m.text), 0);
  const theirQ = theirs.reduce((s, m) => s + countAll(/\?/g, m.text), 0) || 1;

  const bankRate = (re, base) => per(mine.filter(m => has(re, m.text)).length, nMine, base);

  return {
    msgCount: mine.length,
    avgWords: +avgWords.toFixed(1),
    avgDelayHrs: +mean(delays).toFixed(2),
    delayVarianceHrs: +Math.sqrt(variance(delays)).toFixed(2),
    doubleTextRuns: longRuns,
    maxRun,
    reassurancePer100: +bankRate(BANK.reassurance, 100).toFixed(1),
    emotionalScore: +Math.min(10, (emotionMsgs / nMine) * 20).toFixed(1),   // 0–10
    deflectionPer50: +bankRate(BANK.deflection, 50).toFixed(1),
    empathyPer100: +bankRate(BANK.empathy, 100).toFixed(1),
    iToWeRatio: +(iCount / (weCount || 1)).toFixed(1),
    questionRatio: +(myQ / theirQ).toFixed(2),
    vocabRichness: (() => { const all = mine.flatMap(m => words(m.text)); return all.length ? +(new Set(all).size / all.length).toFixed(2) : 0; })(),
    initiations: seq.filter((m, i) => m.fromMe && (i === 0 || (new Date(m.createdAt) - new Date(seq[i - 1].createdAt)) / HOUR > 6)).length,
    signals: {
      compliment: bankRate(BANK.compliment, 50),
      appreciation: bankRate(BANK.appreciation, 50),
      quality: bankRate(BANK.quality, 50),
      help: bankRate(BANK.help, 50),
      gift: bankRate(BANK.gift, 50),
      sensory: bankRate(BANK.sensory, 50)
    }
  };
}

// ---- Attachment style (spec §2.1) ----
function attachmentStyle(m) {
  if (m.msgCount < 8) return { style: 'Unknown', confidence: 0, note: 'Not enough messages yet.' };
  const scores = {
    Secure: 0, 'Anxious (Preoccupied)': 0, 'Avoidant (Dismissive)': 0, 'Disorganised (Fearful)': 0
  };
  // Secure: low delay variance, moderate length, balanced questions
  if (m.delayVarianceHrs < 2) scores.Secure += 1;
  if (m.avgWords >= 40 && m.avgWords <= 150) scores.Secure += 1;
  if (m.questionRatio >= 0.8 && m.questionRatio <= 1.2) scores.Secure += 1;
  // Anxious: reassurance-seeking is the hallmark; plus double-texting + fast replies
  if (m.reassurancePer100 > 5) scores['Anxious (Preoccupied)'] += 2;
  if (m.doubleTextRuns >= 1) scores['Anxious (Preoccupied)'] += 1;
  if (m.avgDelayHrs < 1.5 && (m.reassurancePer100 > 2 || m.doubleTextRuns >= 1)) scores['Anxious (Preoccupied)'] += 0.5;
  // Avoidant: the spec ANDs slow replies (>4h) with the other markers — gate on it,
  // so a fast replier is never mislabelled avoidant.
  if (m.avgDelayHrs > 4) {
    scores['Avoidant (Dismissive)'] += 2;
    if (m.emotionalScore < 3) scores['Avoidant (Dismissive)'] += 0.5;
    if (m.deflectionPer50 > 3) scores['Avoidant (Dismissive)'] += 0.5;
    if (m.iToWeRatio > 5) scores['Avoidant (Dismissive)'] += 0.5;
  }
  // Disorganised: hot-cold — high delay variance AND double-texting together
  if (m.delayVarianceHrs > 6 && m.doubleTextRuns >= 2) scores['Disorganised (Fearful)'] += 2.5;

  let best = 'Secure', bestScore = scores.Secure;
  for (const [k, v] of Object.entries(scores)) if (v > bestScore) { best = k; bestScore = v; }
  const total = Object.values(scores).reduce((s, x) => s + x, 0) || 1;
  return { style: best, confidence: +(bestScore / Math.max(total, 3)).toFixed(2), scores };
}

// ---- Big Five / OCEAN (spec §2.2) ----
function bigFive(m) {
  const band = (hi, mid) => hi ? 'high' : mid ? 'medium' : 'low';
  const openness = band(m.vocabRichness > 0.55 && m.avgWords > 60, m.vocabRichness > 0.45);
  const conscientiousness = band(m.delayVarianceHrs < 2 && m.doubleTextRuns === 0, m.delayVarianceHrs < 4);
  const extraversion = band(m.initiations >= 3 && m.msgCount > 20, m.initiations >= 1);
  const agreeableness = band(m.empathyPer100 > 8 && m.iToWeRatio < 3, m.empathyPer100 > 3);
  const neuroticism = band(m.emotionalScore > 7 && m.reassurancePer100 > 4, m.emotionalScore > 5);
  const num = l => (l === 'high' ? 0.85 : l === 'medium' ? 0.55 : 0.25);
  return {
    openness: { level: openness, score: num(openness) },
    conscientiousness: { level: conscientiousness, score: num(conscientiousness) },
    extraversion: { level: extraversion, score: num(extraversion) },
    agreeableness: { level: agreeableness, score: num(agreeableness) },
    neuroticism: { level: neuroticism, score: num(neuroticism) }
  };
}

// ---- Love language (spec §2.3) ----
const LOVE_LANGUAGES = {
  'Words of Affirmation': m => m.signals.compliment + m.signals.appreciation,
  'Quality Time': m => m.signals.quality * 1.1,
  'Acts of Service': m => m.signals.help * 1.2,
  'Receiving Gifts': m => m.signals.gift * 1.3,
  'Physical Touch': m => m.signals.sensory * 1.2
};
function loveLanguage(m) {
  const scores = {};
  for (const [name, fn] of Object.entries(LOVE_LANGUAGES)) scores[name] = +fn(m).toFixed(2);
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const primary = ranked[0][1] > 0 ? ranked[0][0] : null;
  return { primary, scores };
}

// Full read on one participant.
function analyze(messages) {
  const metrics = computeMetrics(messages || []);
  return {
    metrics,
    attachment: attachmentStyle(metrics),
    bigFive: bigFive(metrics),
    loveLanguage: loveLanguage(metrics)
  };
}

module.exports = { analyze, computeMetrics, attachmentStyle, bigFive, loveLanguage, LOVE_LANGUAGES };

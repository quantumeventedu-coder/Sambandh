const { scan, RED_FLAG_RULES, POSITIVE_RULES } = require('../src/services/flag-engine');

const m = (...texts) => texts.map((text, i) => ({ text, createdAt: new Date(2026, 0, 1, 9, i) }));

describe('flag engine (spec Part 3) — red flags', () => {
  test('has all 12 red-flag rules and 6 positive rules', () => {
    expect(RED_FLAG_RULES).toHaveLength(12);
    expect(POSITIVE_RULES).toHaveLength(6);
  });

  test('MONEY_REQUEST is critical with -100 karma and auto-suspend', () => {
    const r = scan({ messages: m('hey', 'can you please send me some money on upi urgently') });
    const f = r.flags.find(x => x.ruleId === 'MONEY_REQUEST_RULE');
    expect(f).toBeTruthy();
    expect(f.severity).toBe('critical');
    expect(f.karma).toBe(-100);
    expect(f.action.autoSuspend).toBe(true);
  });

  test('critical flags sort to the top', () => {
    const r = scan({ messages: m('you are my soulmate', "i've never felt this", 'meant to be', 'send money via paytm now') });
    expect(r.flags[0].severity).toBe('critical');
  });

  test('LOVE_BOMB fires only when account is new in chat', () => {
    const msgs = m('you are perfect', "i've never felt this", 'we are meant to be');
    expect(scan({ messages: msgs, context: { accountAgeDaysInChat: 1 } }).flags.some(f => f.ruleId === 'LOVE_BOMB_RULE')).toBe(true);
    expect(scan({ messages: msgs, context: { accountAgeDaysInChat: 30 } }).flags.some(f => f.ruleId === 'LOVE_BOMB_RULE')).toBe(false);
  });

  test('EXCLUSIVE_LIE needs the platform fact of 3+ active chats', () => {
    const msgs = m("you're the only one i'm talking to");
    expect(scan({ messages: msgs, context: { activeChatsThisWeek: 4 } }).flags.some(f => f.ruleId === 'EXCLUSIVE_LIE_RULE')).toBe(true);
    expect(scan({ messages: msgs, context: { activeChatsThisWeek: 1 } }).flags.some(f => f.ruleId === 'EXCLUSIVE_LIE_RULE')).toBe(false);
  });

  test('OFFPLATFORM detects early contact-app redirect', () => {
    expect(scan({ messages: m('hey add me on whatsapp, my number is 999') }).flags.some(f => f.ruleId === 'OFFPLATFORM_RULE')).toBe(true);
  });

  test('ISOLATION detects controlling language', () => {
    expect(scan({ messages: m('you should stop talking to your friends and family') }).flags.some(f => f.ruleId === 'ISOLATION_RULE')).toBe(true);
  });

  test('IDENTITY_LIE from verifiable mismatch', () => {
    const r = scan({ messages: m('hi'), context: { profileAge: 34, ageClaimedInChat: 28 } });
    expect(r.flags.some(f => f.ruleId === 'IDENTITY_LIE_RULE')).toBe(true);
  });

  test('COERCION needs a self-harm threat AND recipient ending the chat', () => {
    const msgs = m("if you leave me i'll hurt myself");
    expect(scan({ messages: msgs, recipientEndingConversation: true }).flags.some(f => f.ruleId === 'COERCION_RULE')).toBe(true);
    expect(scan({ messages: msgs, recipientEndingConversation: false }).flags.some(f => f.ruleId === 'COERCION_RULE')).toBe(false);
  });

  test('DEVICE_CLUSTER from fingerprint matches', () => {
    expect(scan({ messages: m('hi'), context: { deviceMatchCount: 4 } }).flags.some(f => f.ruleId === 'DEVICE_CLUSTER_RULE')).toBe(true);
  });

  test('clean conversation yields no flags', () => {
    const r = scan({ messages: m('hi, how was your day?', 'that sounds lovely, tell me more') });
    expect(r.flags).toHaveLength(0);
  });
});

describe('flag engine — positive signals', () => {
  test('RESPECT_RULE fires for clean language, not for insults', () => {
    const clean = scan({ messages: m('a', 'b', 'c', 'd', 'e') });
    expect(clean.positives.some(p => p.ruleId === 'RESPECT_RULE')).toBe(true);
    const rude = scan({ messages: m('a', 'b', 'c', 'd', 'you are stupid') });
    expect(rude.positives.some(p => p.ruleId === 'RESPECT_RULE')).toBe(false);
  });

  test('EMPATHY_RULE fires on empathetic metrics', () => {
    const r = scan({ messages: m('a', 'b', 'c', 'd', 'e'), metrics: { empathyPer100: 9, delayVarianceHrs: 5, avgWords: 10, vocabRichness: 0.3, questionRatio: 1 } });
    expect(r.positives.some(p => p.ruleId === 'EMPATHY_RULE')).toBe(true);
  });
});

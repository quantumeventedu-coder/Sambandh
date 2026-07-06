// Tests for the Karma Book's rule-based engine — the always-on floor that keeps
// the honesty engine working WITHOUT a paid LLM key. Proves claim extraction,
// contradiction detection, and manipulation detection are real logic.

const karma = require('../src/karma-book');
const { extractClaimsRuleBased, detectConflictRuleBased, detectManipulationRuleBased } = karma;

const msgs = (...texts) => texts.map(t => ({ text: t }));
const claim = (type, normalized, over = {}) => ({ type, normalized, statement: normalized, createdAt: new Date(), chatId: 'chatA', ...over });

describe('extractClaimsRuleBased', () => {
  test('catches an exclusivity claim', () => {
    const c = extractClaimsRuleBased(msgs('hey', "honestly you're the only one I'm talking to here"));
    expect(c.find(x => x.type === 'exclusivity')).toBeTruthy();
    expect(c.find(x => x.type === 'exclusivity').strength).toBe('strong');
  });

  test('catches "new here" experience claims', () => {
    const c = extractClaimsRuleBased(msgs('this is my first time on a dating app tbh'));
    expect(c.some(x => x.type === 'experience')).toBe(true);
  });

  test('extracts age and job identity claims with normalized values', () => {
    const c = extractClaimsRuleBased(msgs("i'm 28 and i work at infosys"));
    const age = c.find(x => x.normalized.startsWith('age:'));
    const work = c.find(x => x.normalized.startsWith('work:'));
    expect(age?.normalized).toBe('age:28');
    expect(work?.normalized).toContain('infosys');
  });

  test('catches emotional and intent claims', () => {
    const c = extractClaimsRuleBased(msgs('i love you', 'i really want to get married soon'));
    expect(c.some(x => x.type === 'emotional')).toBe(true);
    expect(c.find(x => x.type === 'intent')?.normalized).toBe('intent:marriage');
  });

  test('does not invent claims from neutral chit-chat', () => {
    const c = extractClaimsRuleBased(msgs('how was your day?', 'the weather is nice', 'what music do you like?'));
    expect(c).toHaveLength(0);
  });

  test('dedupes repeated claims', () => {
    const c = extractClaimsRuleBased(msgs("i'm 28", "i'm 28 btw", 'yeah 28'));
    expect(c.filter(x => x.normalized === 'age:28')).toHaveLength(1);
  });
});

describe('detectConflictRuleBased', () => {
  test('flags exclusivity claimed to two different people within a week', () => {
    const now = new Date();
    const prior = claim('exclusivity', 'exclusivity:only you', { chatId: 'chatB', createdAt: new Date(now - 2 * 86400000) });
    const fresh = claim('exclusivity', 'exclusivity:only you', { chatId: 'chatA', createdAt: now });
    const r = detectConflictRuleBased(fresh, [prior]);
    expect(r?.severity).toBe('high');
    expect(r.reason).toMatch(/exclusivity to two different people/i);
  });

  test('flags conflicting ages', () => {
    const prior = claim('identity', 'age:32', { createdAt: new Date(Date.now() - 5 * 86400000) });
    const fresh = claim('identity', 'age:28');
    const r = detectConflictRuleBased(fresh, [prior]);
    expect(r?.severity).toBe('high');
    expect(r.reason).toContain('32');
    expect(r.reason).toContain('28');
  });

  test('does NOT flag an intent change to the SAME person over months (honest change of mind)', () => {
    const prior = claim('intent', 'intent:marriage', { chatId: 'chatA', createdAt: new Date(Date.now() - 200 * 86400000) });
    const fresh = claim('intent', 'intent:casual', { chatId: 'chatA' });
    expect(detectConflictRuleBased(fresh, [prior])).toBeNull();
  });

  test('flags different intentions told to DIFFERENT people close in time', () => {
    const prior = claim('intent', 'intent:marriage', { chatId: 'chatB', createdAt: new Date(Date.now() - 3 * 86400000) });
    const fresh = claim('intent', 'intent:casual', { chatId: 'chatA' });
    expect(detectConflictRuleBased(fresh, [prior])?.severity).toBe('medium');
  });

  test('does not flag the same age (no contradiction)', () => {
    const prior = claim('identity', 'age:28', { createdAt: new Date(Date.now() - 5 * 86400000) });
    expect(detectConflictRuleBased(claim('identity', 'age:28'), [prior])).toBeNull();
  });
});

describe('detectManipulationRuleBased', () => {
  test('flags a money request as high confidence', () => {
    const m = detectManipulationRuleBased(msgs('hi', 'how are you', 'listen', 'can you send me some money via upi', 'just 5000 rupees'));
    expect(m.find(p => p.pattern === 'money_request')?.confidence).toBe('high');
  });

  test('flags early off-platform redirect', () => {
    const m = detectManipulationRuleBased(msgs('hey', 'hi', 'lets talk on whatsapp', 'my number is 9876543210', 'add me'));
    expect(m.some(p => p.pattern === 'off_platform_redirect')).toBe(true);
  });

  test('flags love-bombing in the first few messages', () => {
    const m = detectManipulationRuleBased(msgs('hi', 'i love you already', 'you are my soulmate', 'x', 'y'));
    expect(m.some(p => p.pattern === 'love_bombing')).toBe(true);
  });

  test('stays quiet on a normal friendly conversation', () => {
    const m = detectManipulationRuleBased(msgs('hey how are you', 'good you?', 'what do you do for fun', 'i like hiking', 'nice me too'));
    expect(m).toHaveLength(0);
  });
});

// tests/intelligence-engine.test.js — the intelligence engine end to end on REAL
// Postgres (pg-odm + pglite): memory isolation and hybrid retrieval, supersede +
// version history, the knowledge graph, cross-chat recall through the assistant,
// Lakshan's explain → respond → human review lifecycle, controlled learning, the
// durable job queue, and the multi-step research agent against local web pages.

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-value-long-enough';
delete process.env.SETU_MODELS;
const db = require('./helpers/pg-db');   // must precede model requires
const http = require('http');

const User = require('../src/models/User');
const Chat = require('../src/models/Chat');
const Claim = require('../src/models/Claim');
const KarmaBook = require('../src/models/KarmaBook');
const Memory = require('../src/models/Memory');
const EvalExample = require('../src/models/EvalExample');
const AssistantMessage = require('../src/models/AssistantMessage');
const memory = require('../src/intelligence/memory');
const graph = require('../src/intelligence/graph');
const assistant = require('../src/intelligence/assistant');
const lakshan = require('../src/intelligence/lakshan');
const learning = require('../src/intelligence/learning');
const jobs = require('../src/intelligence/jobs');
const agent = require('../src/intelligence/agent');
const registry = require('../src/intelligence/models/registry');
const config = require('../src/intelligence/config');
const { buildPublicKarmaSummary } = require('../src/karma-book');
const { decryptText } = require('../src/intelligence/security');

const A = '64b7f9c2e1a4d5f6a7b8c9a1';
const B = '64b7f9c2e1a4d5f6a7b8c9b2';

beforeAll(db.start);
afterAll(db.stop);
beforeEach(async () => {
  registry.invalidate(); config.invalidate();
  await User.create({ _id: A, phone: '+919000000101', profile: { firstName: 'Aanya' }, preferences: { aiTrainingConsent: false } });
  await User.create({ _id: B, phone: '+919000000102', profile: { firstName: 'Rohan' } });
});
afterEach(db.clear);

describe('memory', () => {
  test('memories are private to their owner', async () => {
    await memory.remember(A, { category: 'project', kind: 'deadline', text: 'The Sangam app launch deadline is 15 December', origin: 'explicit' });
    expect(await memory.retrieve(B, 'sangam launch deadline')).toEqual([]);
    const mine = await memory.retrieve(A, 'when is the sangam launch deadline');
    expect(mine).toHaveLength(1);
    expect(mine[0].text).toMatch(/15 December/);
    expect(mine[0].why.keyword).toBeGreaterThan(0);
    // stored encrypted, keywords only as keyed hashes
    const raw = await Memory.findOne({ userId: A }).lean();
    expect(raw.content).not.toMatch(/Sangam/);
    expect(raw.keyHashes.join(' ')).not.toMatch(/sangam/);
  });

  test('hybrid retrieval ranks the relevant memory first', async () => {
    await memory.remember(A, { category: 'semantic', kind: 'preference', text: 'Likes filter coffee in the morning' });
    await memory.remember(A, { category: 'project', kind: 'task', text: 'Need to book the venue for the engagement in Jaipur' });
    await memory.remember(A, { category: 'semantic', kind: 'fact', text: 'Works as a product designer at a startup' });
    const r = await memory.retrieve(A, 'did I book the engagement venue yet?');
    expect(r[0].text).toMatch(/venue/);
  });

  test('a changed fact supersedes the old one, which stays in history', async () => {
    await memory.remember(A, { category: 'semantic', kind: 'fact', text: 'I live in Pune' });
    const r = await memory.remember(A, { category: 'semantic', kind: 'fact', text: 'I live in Mumbai now' });
    expect(r.action).toBe('superseded_previous');
    expect(r.previous.text).toBe('I live in Pune');
    const active = await memory.list(A);
    expect(active.map(m => m.text)).toEqual(['I live in Mumbai now']);
    const old = await Memory.findOne({ userId: A, status: 'superseded' }).lean();
    expect(decryptText(old.content)).toBe('I live in Pune');
    expect(old.supersededBy).toBe(r.memory.id);
  });

  test('a weak inference never overrides an explicit memory', async () => {
    await memory.remember(A, { category: 'explicit', kind: 'fact', text: 'I live in Delhi', origin: 'explicit' });
    const r = await memory.remember(A, { category: 'semantic', kind: 'fact', text: 'I live in Agra', origin: 'inferred', confidence: 0.5 });
    expect(r.action).toBe('conflict_kept_existing');
    expect((await memory.list(A)).map(m => m.text)).toEqual(['I live in Delhi']);
  });

  test('near-duplicates reinforce instead of duplicating', async () => {
    await memory.remember(A, { category: 'semantic', kind: 'preference', text: 'Likes long walks by the sea' });
    const r = await memory.remember(A, { category: 'semantic', kind: 'preference', text: 'Likes long walks by the sea' });
    expect(r.action).toBe('reinforced');
    expect(await Memory.countDocuments({ userId: A })).toBe(1);
  });

  test('corrections create a new version and keep the old text', async () => {
    const { memory: m } = await memory.remember(A, { category: 'project', kind: 'deadline', text: 'Deadline is 1 December', origin: 'explicit' });
    const c = await memory.correct(A, m.id, { text: 'Deadline is 5 December' });
    expect(c.version).toBe(2);
    expect(c.origin).toBe('corrected');
    const h = await memory.historyOf(A, m.id);
    expect(h.history[0].text).toBe('Deadline is 1 December');
    expect(await memory.correct(B, m.id, { text: 'hijack' })).toBeNull();   // other users cannot edit
  });

  test('open items list unresolved tasks by due date; resolve removes them', async () => {
    await memory.remember(A, { category: 'project', kind: 'task', text: 'Call the photographer', dueAt: '2026-12-20T00:00:00Z' });
    const { memory: t2 } = await memory.remember(A, { category: 'project', kind: 'deadline', text: 'Submit the hall booking form', dueAt: '2026-12-02T00:00:00Z' });
    let open = await memory.openItems(A, { now: new Date('2026-11-22') });
    expect(open.map(o => o.text)).toEqual(['Submit the hall booking form', 'Call the photographer']);
    await memory.resolve(A, t2.id);
    open = await memory.openItems(A);
    expect(open).toHaveLength(1);
  });

  test('forgetAll deletes only that user\'s memories', async () => {
    await memory.remember(A, { category: 'explicit', text: 'note a', origin: 'explicit' });
    await memory.remember(B, { category: 'explicit', text: 'note b', origin: 'explicit' });
    await memory.forgetAll(A);
    expect(await Memory.countDocuments({ userId: A })).toBe(0);
    expect(await Memory.countDocuments({ userId: B })).toBe(1);
  });
});

describe('knowledge graph', () => {
  test('functional facts supersede with temporal history and provenance', async () => {
    const p = await graph.upsertEntity(A, { type: 'project', name: 'Sangam' }, { conversationId: 'c1' });
    await graph.addRelation(A, { subjectId: p._id, predicate: 'has_deadline', objectValue: '2026-12-01', source: { conversationId: 'c1' } });
    const r2 = await graph.addRelation(A, { subjectId: p._id, predicate: 'has_deadline', objectValue: '2026-12-15', source: { conversationId: 'c2' } });
    expect(r2.action).toBe('superseded');
    const t = await graph.timeline(A, p._id);
    expect(t).toHaveLength(2);
    const old = t.find(x => x.value === '2026-12-01');
    expect(old.status).toBe('superseded');
    expect(old.validTo).toBeTruthy();
    expect(t.find(x => x.value === '2026-12-15').source.conversationId).toBe('c2');
    const same = await graph.addRelation(A, { subjectId: p._id, predicate: 'has_deadline', objectValue: '2026-12-15' });
    expect(same.action).toBe('reinforced');
  });

  test('aliases resolve to the same entity, and graphs are per user', async () => {
    const e1 = await graph.upsertEntity(A, { type: 'project', name: 'Sangam' });
    const e2 = await graph.upsertEntity(A, { type: 'project', name: 'Sangam app' });
    expect(String(e2._id)).toBe(String(e1._id));
    expect(await graph.entitiesInText(B, 'how is sangam going')).toEqual([]);
    expect((await graph.entitiesInText(A, 'how is sangam going')).map(e => e.name)).toEqual(['Sangam']);
  });
});

describe('assistant: cross-chat intelligence', () => {
  test('a fact learned in one conversation is recalled in another, and "that project" resolves', async () => {
    const first = await assistant.respond({ userId: A, message: 'We decided to launch the Sangam app in Pune. The launch deadline is on 15 December.' });
    expect(first.learned.saved.length).toBeGreaterThan(0);
    const second = await assistant.respond({ userId: A, message: 'What is the deadline for that project?' });
    expect(second.conversationId).not.toBe(first.conversationId);
    expect(second.message.content).toMatch(/15 December/);
    expect(second.references.some(r => r.entity && r.entity.name === 'Sangam')).toBe(true);
    expect(second.message.model.mode).toBe('basic');   // no model server configured in tests: honest label
    // Another member gets nothing about A's project.
    const other = await assistant.respond({ userId: B, message: 'What is the deadline for that project?' });
    expect(other.message.content).not.toMatch(/Sangam|15 December/);
  });

  test('explicit remember / forget commands are transparent', async () => {
    const r = await assistant.respond({ userId: A, message: 'Remember that my mother prefers we meet on Sundays' });
    expect(r.message.content).toMatch(/Noted/);
    expect((await memory.list(A, { category: 'explicit' })).length).toBe(1);
    const f = await assistant.respond({ userId: A, message: 'Forget that my mother prefers Sundays' });
    expect(f.forgetCandidates.length).toBe(1);
    expect((await memory.list(A)).length).toBe(1);     // nothing deleted without confirmation
  });

  test('a repeated question surfaces the earlier answer', async () => {
    await assistant.respond({ userId: A, message: 'How do I start a conversation about family expectations?' });
    const again = await assistant.respond({ userId: A, message: 'How do I start a conversation about family expectations?' });
    expect(again.previouslyAsked).toBeTruthy();
    expect(again.previouslyAsked.question).toMatch(/family expectations/);
  });

  test('crisis messages get helplines immediately, never a model', async () => {
    const r = await assistant.respond({ userId: A, message: 'I dont want to live anymore' });
    expect(r.message.content).toMatch(/14416/);
    expect(r.message.model.id).toBe('safety');
    expect(r.message.safety.flags).toContain('distress');
  });

  test('chat context is only available to participants', async () => {
    const chat = await Chat.create({ participants: [B, '64b7f9c2e1a4d5f6a7b8c9c3'] });
    await expect(assistant.createConversation(A, { context: { kind: 'chat', refId: String(chat._id) } })).rejects.toThrow(/not found/i);
    const own = await Chat.create({ participants: [A, B], messageCount: 4 });
    const conv = await assistant.createConversation(A, { context: { kind: 'chat', refId: String(own._id) } });
    const r = await assistant.respond({ userId: A, conversationId: String(conv._id), message: 'Give me a conversation idea for Rohan' });
    expect(r.message.content.length).toBeGreaterThan(10);
  });

  test('conversation content is encrypted at rest and deletable', async () => {
    const r = await assistant.respond({ userId: A, message: 'I really love old Hindi film songs' });
    const raw = await AssistantMessage.findOne({ userId: A, role: 'user' }).lean();
    expect(raw.content).not.toMatch(/Hindi/);
    expect((await assistant.getConversation(B, r.conversationId))).toBeNull();
    await assistant.deleteConversation(A, r.conversationId);
    expect(await AssistantMessage.countDocuments({ userId: A })).toBe(0);
  });
});

describe('Lakshan lifecycle: explain → respond → human review', () => {
  async function twoClaims() {
    const c1 = await Chat.create({ participants: [A, B] });
    const c2 = await Chat.create({ participants: [A, '64b7f9c2e1a4d5f6a7b8c9d4'] });
    const prior = await Claim.create({ userId: A, chatId: c1._id, type: 'identity', statement: "I'm 31", normalized: 'age: 31', createdAt: new Date(Date.now() - 5 * 86400000) });
    const current = await Claim.create({ userId: A, chatId: c2._id, type: 'identity', statement: "I'm 27", normalized: 'age: 27', createdAt: new Date() });
    return { prior, current };
  }

  test('automated assessments are visible to the member but have no public effect', async () => {
    const { prior, current } = await twoClaims();
    const a = await lakshan.assessContradiction({ userId: A, newClaim: current, priorClaim: prior, severity: 'high' });
    expect(a.status).toBe('open');
    const mine = await lakshan.listForSubject(A);
    expect(mine[0].statements.map(s => s.text)).toEqual(["I'm 31", "I'm 27"]);
    expect(mine[0].explanation).toMatch(/not a conclusion that anyone was dishonest/);
    await KarmaBook.create({ userId: A, score: 60, contradictions: [{ reason: 'x' }, { reason: 'y' }] });
    const pub = await buildPublicKarmaSummary(A, B);
    expect(pub.score).toBe(100);           // automated deductions are private
    expect(pub.flags.find(f => f.type === 'repeated_contradictions')).toBeUndefined();
    expect(await lakshan.listForSubject(B)).toEqual([]);
  });

  test('appeal returns it to review; only a human confirmation changes the public record', async () => {
    const { prior, current } = await twoClaims();
    const a = await lakshan.assessContradiction({ userId: A, newClaim: current, priorClaim: prior });
    const appealed = await lakshan.respond(A, String(a._id), { action: 'appeal', text: 'I mistyped my age in the second chat.' });
    expect(appealed.status).toBe('appealed');
    expect((await lakshan.reviewQueue()).map(q => q.id)).toContain(String(a._id));
    await expect(lakshan.respond(B, String(a._id), { action: 'acknowledge' })).resolves.toBeNull();   // not B's to answer
    const reviewed = await lakshan.review(String(a._id), { decision: 'confirm', notes: 'Checked both chats', by: 'mod-1' });
    expect(reviewed.publicEffect).toBe(true);
    expect(reviewed.reviewedScore).toBeLessThan(100);
    const pub = await buildPublicKarmaSummary(A, B);
    expect(pub.score).toBe(reviewed.reviewedScore);
    expect(pub.flags.find(f => f.type === 'repeated_contradictions').message).toMatch(/confirmed by human review/);
    const dismissed = await lakshan.review(String(a._id), { decision: 'dismiss', by: 'mod-2' });
    expect(dismissed.reviewedScore).toBe(100);   // reversible
  });
});

describe('controlled learning', () => {
  test('feedback adjusts confidence of the memories used; corrections supersede', async () => {
    await memory.remember(A, { category: 'semantic', kind: 'fact', text: 'I live in Pune' });
    const r = await assistant.respond({ userId: A, message: 'Where do I live?' });
    const used = await AssistantMessage.findOne({ _id: r.message.id }).lean();
    expect(used.memoryRefs.length).toBe(1);
    const before = (await Memory.findOne({ _id: used.memoryRefs[0] }).lean()).confidence;
    const fb = await learning.recordFeedback(A, r.message.id, { rating: -1, reason: 'outdated', correction: 'I live in Bengaluru now' });
    expect((await Memory.findOne({ _id: used.memoryRefs[0] }).lean()).confidence).toBeLessThan(before);
    expect(fb.learned.action).toBe('superseded_previous');
    expect((await memory.list(A)).map(m => m.text)).toEqual(['I live in Bengaluru now']);
    expect(await EvalExample.countDocuments({})).toBe(0);   // no consent → no eval data
  });

  test('evaluation examples are created only with consent, with PII redacted', async () => {
    await User.findByIdAndUpdate(A, { $set: { 'preferences.aiTrainingConsent': true } });
    const r = await assistant.respond({ userId: A, message: 'My number is 9876543210, suggest a first-date idea' });
    await learning.recordFeedback(A, r.message.id, { rating: 1 });
    const ex = await EvalExample.findOne({}).lean();
    expect(ex).toBeTruthy();
    expect(ex.prompt).not.toMatch(/9876543210/);
    expect(Object.keys(ex)).not.toContain('userId');
  });
});

describe('durable jobs', () => {
  test('claim → run → done; failures retry then fail; cancel works', async () => {
    let runs = 0;
    jobs.register('test_ok', async (job, h) => { await h.progress('step', 'hello'); return { doubled: job.payload.n * 2 }; });
    jobs.register('test_fail', async () => { runs++; throw new Error('nope'); });
    const ok = await jobs.enqueue('test_ok', { n: 21 }, { userId: A });
    await jobs.drain({ maxJobs: 5 });
    const done = await jobs.get(String(ok._id), A);
    expect(done.status).toBe('done');
    expect(done.result).toEqual({ doubled: 42 });
    expect(done.progress[0].detail).toBe('hello');
    expect(await jobs.get(String(ok._id), B)).toBeNull();        // owner-scoped

    const f = await jobs.enqueue('test_fail', {}, { maxAttempts: 2 });
    await jobs.drain({ maxJobs: 1 });
    let st = await jobs.get(String(f._id));
    expect(st.status).toBe('queued');                             // retry scheduled
    const IntelligenceJob = require('../src/models/IntelligenceJob');
    await IntelligenceJob.findOneAndUpdate({ _id: f._id }, { $set: { runAt: new Date(Date.now() - 1000) } });
    await jobs.drain({ maxJobs: 1 });
    st = await jobs.get(String(f._id));
    expect(st.status).toBe('failed');
    expect(runs).toBe(2);

    const c = await jobs.enqueue('test_ok', { n: 1 }, { userId: A });
    const cancelled = await jobs.cancel(String(c._id), A);
    expect(cancelled.status).toBe('cancelled');
  });
});

describe('research agent', () => {
  let srv, base;
  beforeAll(async () => {
    const pages = {
      '/robots.txt': 'User-agent: *\nDisallow: /blocked',
      '/a': '<html><head><title>Special Marriage Act guide</title></head><body><article><p>The Special Marriage Act requires a notice period of 30 days before the marriage can be solemnised by the Marriage Officer.</p><p>Three witnesses must sign the marriage certificate at the office of the Marriage Officer in the district.</p></article></body></html>',
      '/b': '<html><head><title>Court marriage FAQ</title></head><body><article><p>Under the Special Marriage Act the notice period is 15 days before the marriage can be solemnised by the officer, according to this blog.</p><p>Witnesses are needed when the marriage is registered by the Marriage Officer.</p></article></body></html>',
      '/blocked': '<html><body><p>Should never be read because robots.txt disallows it for every crawler including ours.</p></body></html>'
    };
    srv = http.createServer((req, res) => {
      const body = pages[req.url];
      if (!body) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'content-type': req.url === '/robots.txt' ? 'text/plain' : 'text/html; charset=utf-8' });
      res.end(body);
    });
    await new Promise(r => srv.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${srv.address().port}`;
  });
  afterAll(() => srv.close());

  test('plans, searches, reads (respecting robots.txt), detects conflicts and cites sources', async () => {
    const searchImpl = async () => [
      { title: 'Guide', url: base + '/a' }, { title: 'FAQ', url: base + '/b' }, { title: 'Blocked', url: base + '/blocked' }
    ];
    const steps = [];
    const out = await agent.runResearch('What is the notice period under the Special Marriage Act?', { progress: async (s, d) => steps.push(s + ':' + d) },
      { searchImpl, fetchOpts: { allowPrivate: true, perHostIntervalMs: 0 }, limits: { maxSteps: 2, maxFetches: 4 } });
    expect(out.sources.map(s => s.url)).toEqual(expect.arrayContaining([base + '/a', base + '/b']));
    expect(out.sources.map(s => s.url)).not.toContain(base + '/blocked');
    expect(out.conflicts.length).toBeGreaterThan(0);
    expect(out.answer).toMatch(/\[\d\]/);                         // cited
    expect(steps.some(s => s.startsWith('plan'))).toBe(true);
    expect(steps.some(s => s.startsWith('synthesize'))).toBe(true);
  });

  test('with no search provider it says so instead of pretending', async () => {
    const out = await agent.runResearch('latest marriage registration fees in Delhi', {}, {});
    expect(out.configured).toBe(false);
    expect(out.answer).toMatch(/no search provider is configured/);
  });

  test('cancellation stops the loop between steps', async () => {
    const out = await agent.runResearch('notice period special marriage act', { isCancelled: async () => true }, { searchImpl: async () => [] });
    expect(out.cancelled).toBe(true);
  });
});

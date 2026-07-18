// Tests for the reputation engine's scoring and the AI red-flag → moderation
// report pipeline (system Reports need no reporterId and dedupe per user+chat).

// Runs against pg-odm + pglite (real Postgres — the production engine), not
// Mongoose. `db` MUST be required before the models so odm.js selects pg-odm.
const db = require('./helpers/pg-db');
const { updateReputation, scoresToGrades } = require('../src/reputation-engine');
const Reputation = require('../src/models/Reputation');
const Report = require('../src/models/Report');

beforeAll(db.start);
afterAll(db.stop);
afterEach(db.clear);

const analysis = (overrides = {}) => ({
  respect: 8, responsive: 7, depth: 6, humor: 5, directness: 9,
  sentiment_overall: 'positive',
  tags_positive: ['thoughtful'], tags_negative: [], red_flags: [],
  explanation: 'test', ...overrides
});

describe('scoresToGrades', () => {
  test('maps scores to letter grades', () => {
    const g = scoresToGrades({ respect: 9.6, responsive: 9.6, depth: 9.6, humor: 9.6, directness: 7.2 });
    expect(g.conversation).toBe('A+'); // (9.6+9.6+9.6)/3
    expect(g.boundaries).toBe('A+');
    expect(g.honesty).toBe('B-');      // 7.2 → ≥7.0
    expect(g.warmth).toBe('A+');
  });

  test('grades the floor as F', () => {
    const g = scoresToGrades({ respect: 1, responsive: 1, depth: 1, humor: 1, directness: 1 });
    expect(g.honesty).toBe('F');
  });
});

describe('updateReputation', () => {
  test('creates a reputation document on first analysis', async () => {
    const uid = new db.Types.ObjectId().toString();
    await updateReputation(uid, analysis(), 12);

    const rep = await Reputation.findOne({ userId: uid });
    expect(rep).not.toBeNull();
    expect(rep.scores.respect).toBe(8);
    expect(rep.basedOnChats).toBe(1);
    expect(rep.redFlags.reportsAgainst).toBe(0);
    expect(await Report.countDocuments({ reportedUserId: uid })).toBe(0);
  });

  test('blends scores as a rolling average on later analyses', async () => {
    const uid = new db.Types.ObjectId().toString();
    await updateReputation(uid, analysis({ respect: 8 }), 10);
    await updateReputation(uid, analysis({ respect: 4 }), 10);

    const rep = await Reputation.findOne({ userId: uid });
    expect(rep.basedOnChats).toBe(2);
    expect(rep.scores.respect).toBe(6); // (8 + 4) / 2
  });

  test('red flags increment the counter and auto-file a system report', async () => {
    const uid = new db.Types.ObjectId().toString();
    const chatId = new db.Types.ObjectId();
    await updateReputation(uid, analysis({ red_flags: ['harassment: repeated threats'] }), 10, chatId);

    const rep = await Reputation.findOne({ userId: uid });
    expect(rep.redFlags.reportsAgainst).toBe(1);

    const report = await Report.findOne({ reportedUserId: uid });
    expect(report).not.toBeNull();
    expect(report.source).toBe('system');
    expect(report.reporterId).toBeUndefined();
    expect(report.category).toBe('harassment'); // severe keyword → harassment
    expect(report.status).toBe('pending');
    expect(report.description).toContain('repeated threats');
  });

  test('re-analysis updates the open system report instead of filing a duplicate', async () => {
    const uid = new db.Types.ObjectId().toString();
    const chatId = new db.Types.ObjectId();
    await updateReputation(uid, analysis({ red_flags: ['coercion'] }), 10, chatId);
    await updateReputation(uid, analysis({ red_flags: ['coercion', 'doxxing attempt'] }), 10, chatId);

    const reports = await Report.find({ reportedUserId: uid });
    expect(reports).toHaveLength(1);
    expect(reports[0].description).toContain('doxxing attempt');

    const rep = await Reputation.findOne({ userId: uid });
    expect(rep.redFlags.reportsAgainst).toBe(2); // counter still counts every detection
  });

  test('a resolved system report does not block a new one', async () => {
    const uid = new db.Types.ObjectId().toString();
    const chatId = new db.Types.ObjectId();
    await updateReputation(uid, analysis({ red_flags: ['manipulation'] }), 10, chatId);
    await Report.updateMany({ reportedUserId: uid }, { status: 'resolved' });

    await updateReputation(uid, analysis({ red_flags: ['manipulation again'] }), 10, chatId);
    expect(await Report.countDocuments({ reportedUserId: uid })).toBe(2);
  });

  test('non-severe flags file under the "other" category', async () => {
    const uid = new db.Types.ObjectId().toString();
    await updateReputation(uid, analysis({ red_flags: ['manipulation'] }), 10, new db.Types.ObjectId());
    const report = await Report.findOne({ reportedUserId: uid });
    expect(report.category).toBe('other');
  });
});

describe('Report model', () => {
  test('requires reporterId for user reports but not system reports', async () => {
    const target = new db.Types.ObjectId();
    await expect(Report.create({
      source: 'user', reportedUserId: target, category: 'other', description: 'no reporter given'
    })).rejects.toThrow(/reporterId/);

    const sys = await Report.create({
      source: 'system', reportedUserId: target, category: 'other', description: 'ai filed'
    });
    expect(sys.source).toBe('system');
  });
});

// tests/matchmaking.test.js — the extracted match-creation service: a mutual like creates exactly one
// shared chat with a system message, notifies BOTH people, emits the realtime event, is idempotent on a
// retry, and stays a no-op until the like is mutual. The notification + analytics side-channels are
// mocked so this targets the match ORCHESTRATION (chat/message/notify-fanout/emit) in isolation.

jest.mock('../src/routes-notifications', () => ({ deliverNotification: jest.fn().mockResolvedValue({}) }));
jest.mock('../src/services/analytics', () => ({ track: jest.fn() }));

const db = require('./helpers/pg-db');
const User = require('../src/models/User');
const Like = require('../src/models/Like');
const Chat = require('../src/models/Chat');
const Message = require('../src/models/Message');
const { deliverNotification } = require('../src/routes-notifications');   // the mock
const { track } = require('../src/services/analytics');                   // the mock
const { createMatchOnMutualLike } = require('../src/services/matchmaking');

let seq = 9600000000;
const mkUser = (over = {}) => User.create({ phone: '+91' + (seq++), profile: { firstName: 'A' }, intent: ['dating'], ...over });
/** a socket.io stub that records every emit */
const mkIo = () => { const emits = []; return { emits, to: (room) => ({ emit: (ev, payload) => emits.push({ room, ev, payload }) }) }; };

beforeAll(db.start);
afterAll(db.stop);
afterEach(async () => { await db.clear(); jest.clearAllMocks(); });

describe('createMatchOnMutualLike', () => {
  test('no reciprocal like → not a match, and nothing is created', async () => {
    const me = await mkUser(), other = await mkUser();
    await Like.create({ from: me._id, to: other._id, createdAt: new Date() });   // one-way only
    const r = await createMatchOnMutualLike({ meId: me._id, otherId: other._id, me, other });
    expect(r).toEqual({ matched: false, newMatch: false });
    expect(await Chat.countDocuments({})).toBe(0);
    expect(deliverNotification).not.toHaveBeenCalled();
  });

  test('a mutual like creates ONE chat + a system message, notifies both, emits to both, logs analytics', async () => {
    const me = await mkUser({ profile: { firstName: 'Asha' } });
    const other = await mkUser({ profile: { firstName: 'Ravi' } });
    await Like.create({ from: me._id, to: other._id, createdAt: new Date() });
    await Like.create({ from: other._id, to: me._id, createdAt: new Date() });     // the reciprocal
    const io = mkIo();

    const r = await createMatchOnMutualLike({ meId: me._id, otherId: other._id, me, other, io });
    expect(r).toMatchObject({ matched: true, newMatch: true });
    expect(r.chatId).toBeTruthy();

    const chats = await Chat.find({ participants: { $all: [me._id, other._id], $size: 2 } });
    expect(chats).toHaveLength(1);
    const sys = await Message.findOne({ chatId: r.chatId, type: 'system' });
    expect(sys.text).toMatch(/Asha and Ravi both liked each other/);

    // BOTH participants notified, exactly once each, with a new_match
    expect(deliverNotification).toHaveBeenCalledTimes(2);
    const notified = deliverNotification.mock.calls.map(c => String(c[0])).sort();
    expect(notified).toEqual([String(me._id), String(other._id)].sort());
    expect(deliverNotification.mock.calls.every(c => c[1].type === 'new_match')).toBe(true);

    // realtime event fired to each participant's room
    expect(io.emits.map(e => e.room).sort()).toEqual(['user:' + me._id, 'user:' + other._id].sort());
    expect(io.emits.every(e => e.ev === 'new_match')).toBe(true);
    expect(track).toHaveBeenCalledWith('match_created', me._id, { withUserId: other._id });
  });

  test('idempotent — a second call finds the existing chat and creates/notifies nothing new', async () => {
    const me = await mkUser(), other = await mkUser();
    await Like.create({ from: me._id, to: other._id, createdAt: new Date() });
    await Like.create({ from: other._id, to: me._id, createdAt: new Date() });

    const first = await createMatchOnMutualLike({ meId: me._id, otherId: other._id, me, other });
    deliverNotification.mockClear();
    const second = await createMatchOnMutualLike({ meId: me._id, otherId: other._id, me, other });
    expect(second.matched).toBe(true);
    expect(second.newMatch).toBe(false);                          // no second match event
    expect(String(second.chatId)).toBe(String(first.chatId));     // same chat
    expect(await Chat.countDocuments({})).toBe(1);                 // never a duplicate chat
    expect(await Message.countDocuments({ type: 'system' })).toBe(1);
    expect(deliverNotification).not.toHaveBeenCalled();           // the retry doesn't re-notify
  });

  test('missing profile names fall back to "You" / "they"', async () => {
    const me = await mkUser({ profile: {} }), other = await mkUser({ profile: {} });
    await Like.create({ from: me._id, to: other._id, createdAt: new Date() });
    await Like.create({ from: other._id, to: me._id, createdAt: new Date() });
    const r = await createMatchOnMutualLike({ meId: me._id, otherId: other._id, me, other });
    const sys = await Message.findOne({ chatId: r.chatId, type: 'system' });
    expect(sys.text).toMatch(/You and they both liked each other/);
  });
});

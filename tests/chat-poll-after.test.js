// tests/chat-poll-after.test.js — GET /chat/:id/messages?after=<t> returns only NEWER messages, ascending.
// This is the polling endpoint the web app uses to receive incoming 1:1 messages, because Socket.io
// realtime is unavailable on serverless (Vercel). Without it, chat was effectively one-way live.

const express = require('express');
const request = require('supertest');
const db = require('./helpers/pg-db');

const ME = '64b7f9c2e1a4d5f6a7b90001';
const OTHER = '64b7f9c2e1a4d5f6a7b90002';
jest.mock('../src/routes-auth', () => ({
  requireAuth: (req, _res, next) => { req.userId = '64b7f9c2e1a4d5f6a7b90001'; next(); },
  requireAdmin: (_req, _res, next) => next(),
}));
// requireLaunched comes from services/site-mode (not routes-auth) — bypass the launch gate for the test.
jest.mock('../src/services/site-mode', () => ({ requireLaunched: (_req, _res, next) => next(), isPrelaunch: async () => false }));

const Chat = require('../src/models/Chat');
const Message = require('../src/models/Message');
const router = require('../src/routes-chat');

const app = express();
app.use(express.json());
app.use('/chat', router);

beforeAll(db.start);
afterAll(db.stop);
afterEach(db.clear);

const t = (s) => new Date(`2026-01-01T00:00:${String(s).padStart(2, '0')}Z`);

describe('GET /chat/:id/messages?after=', () => {
  test('returns only messages newer than `after`, in ascending order', async () => {
    const chat = await Chat.create({ participants: [ME, OTHER] });
    await Message.create({ chatId: chat._id, from: OTHER, to: ME, text: 'old', createdAt: t(0) });
    await Message.create({ chatId: chat._id, from: OTHER, to: ME, text: 'new1', createdAt: t(10) });
    await Message.create({ chatId: chat._id, from: OTHER, to: ME, text: 'new2', createdAt: t(20) });

    const r = await request(app).get(`/chat/${chat._id}/messages?after=${t(0).toISOString()}`);
    expect(r.status).toBe(200);
    expect(r.body.messages.map((m) => m.text)).toEqual(['new1', 'new2']);
  });

  test('without `after`, the recent tail is returned ascending (unchanged behaviour)', async () => {
    const chat = await Chat.create({ participants: [ME, OTHER] });
    await Message.create({ chatId: chat._id, from: OTHER, to: ME, text: 'a', createdAt: t(0) });
    await Message.create({ chatId: chat._id, from: ME, to: OTHER, text: 'b', createdAt: t(5) });

    const r = await request(app).get(`/chat/${chat._id}/messages`);
    expect(r.status).toBe(200);
    expect(r.body.messages.map((m) => m.text)).toEqual(['a', 'b']);
  });

  test('a non-participant cannot poll the chat (404)', async () => {
    const chat = await Chat.create({ participants: [OTHER, '64b7f9c2e1a4d5f6a7b90003'] });
    const r = await request(app).get(`/chat/${chat._id}/messages?after=${t(0).toISOString()}`);
    expect(r.status).toBe(404);
  });
});

// tests/setu-routes.test.js — Sambandh Setu HTTP surface on real Postgres (pglite):
// public profiles + SEO + deep-link files, the /api/v1 alias and app endpoints,
// the Setu Journey (mutual stages, Reflect privacy), and the intelligence API
// (auth, ownership, SSE streaming, admin aggregates, cron secret).

process.env.JWT_SECRET = 'test-jwt-secret-value-long-enough';
process.env.SUPER_ADMIN_KEY = 'super-key-9f2c1a77b4e6d3aa';
process.env.CRON_SECRET = 'cron-secret-for-tests';
delete process.env.SETU_MODELS;
const db = require('./helpers/pg-db');
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const User = require('../src/models/User');
const Chat = require('../src/models/Chat');
const authRoutes = require('../src/routes-auth');
const publicRoutes = require('../src/routes-public');
const v1 = require('../src/routes-v1');
const intelligenceRoutes = require('../src/routes-intelligence');
const journeyRoutes = require('../src/routes-journey');
const { launch } = require('./helpers/launch');

const A = '64b7f9c2e1a4d5f6a7b8c901';
const B = '64b7f9c2e1a4d5f6a7b8c902';
const C = '64b7f9c2e1a4d5f6a7b8c903';
const tok = (id) => 'Bearer ' + jwt.sign({ userId: id, phone: '+91900000' + id.slice(-4), role: 'user' }, process.env.JWT_SECRET, { expiresIn: '1h' });

const app = express();
app.use(express.json());
app.use((req, res, next) => { if (req.url.startsWith('/api/v1/') && !v1.NATIVE.test(req.url)) req.url = '/api/' + req.url.slice('/api/v1/'.length); next(); });
app.use('/api/superadmin/intelligence', authRoutes.requireSuperAdmin, intelligenceRoutes.adminRouter);
app.use('/api/intelligence', intelligenceRoutes);
app.use('/api/journey', journeyRoutes);
app.use('/api/me', publicRoutes.me);
app.use('/api/v1', v1);
app.use(publicRoutes.site);

beforeAll(db.start);
afterAll(db.stop);
beforeEach(async () => {
  await User.create({ _id: A, phone: '+919000000901', profile: { firstName: 'Aanya', city: 'Pune' }, intent: ['marriage'], verification: { level: 'id_verified' }, status: { active: true } });
  await User.create({ _id: B, phone: '+919000000902', profile: { firstName: 'Rohan', city: 'Hyderabad' }, status: { active: true } });
  await User.create({ _id: C, phone: '+919000000903', profile: { firstName: 'Kabir' }, status: { active: true } });
  await launch();
});
afterEach(db.clear);

describe('public profiles (LinkedIn-style, strictly opt-in)', () => {
  test('username validation and availability', async () => {
    let r = await request(app).get('/api/me/username/check?u=Admin').set('Authorization', tok(A));
    expect(r.body).toMatchObject({ valid: false });
    r = await request(app).get('/api/me/username/check?u=a!').set('Authorization', tok(A));
    expect(r.body.valid).toBe(false);
    r = await request(app).put('/api/me/username').set('Authorization', tok(A)).send({ username: 'aanya_s' });
    expect(r.status).toBe(200);
    r = await request(app).put('/api/me/username').set('Authorization', tok(B)).send({ username: 'aanya_s' });
    expect(r.status).toBe(409);
    r = await request(app).get('/api/me/username/check?u=aanya_s').set('Authorization', tok(B));
    expect(r.body.available).toBe(false);
  });

  test('profiles are private by default; public needs opt-in; indexing needs a second opt-in', async () => {
    await request(app).put('/api/me/username').set('Authorization', tok(A)).send({ username: 'aanya_s' });
    let page = await request(app).get('/u/aanya_s');
    expect(page.status).toBe(404);
    expect(page.headers['x-robots-tag']).toMatch(/noindex/);

    let r = await request(app).patch('/api/me/public-profile').set('Authorization', tok(A)).send({ enabled: true, headline: 'Designer who loves old Hindi songs' });
    expect(r.status).toBe(200);
    page = await request(app).get('/u/aanya_s');
    expect(page.status).toBe(200);
    expect(page.text).toContain('Aanya');
    expect(page.text).toContain('Designer who loves old Hindi songs');
    expect(page.text).toMatch(/<meta name="robots" content="noindex, nofollow"/);
    expect(page.text).not.toMatch(/\+91|9000000901/);   // never contact details

    r = await request(app).patch('/api/me/public-profile').set('Authorization', tok(A)).send({ indexable: true });
    page = await request(app).get('/u/aanya_s');
    expect(page.text).toMatch(/<meta name="robots" content="index, follow/);
    expect(page.text).toContain('application/ld+json');
    expect(page.text).toContain('"@type":"ProfilePage"');
    expect(page.text).toContain('<link rel="canonical" href="https://www.sambandh.online/u/aanya_s"/>');

    const map = await request(app).get('/sitemap.xml');
    expect(map.text).toContain('/u/aanya_s');
    const json = await request(app).get('/api/v1/public/profiles/aanya_s');
    expect(json.body.profile).toMatchObject({ username: 'aanya_s', firstName: 'Aanya', city: 'Pune', verification: 'ID verified' });
    expect(json.body.profile.photo).toBeNull();          // photos stay off unless chosen
  });

  test('anonymous-mode members cannot be public; headlines cannot carry contact details', async () => {
    await request(app).put('/api/me/username').set('Authorization', tok(B)).send({ username: 'rohan_v' });
    await User.findByIdAndUpdate(B, { $set: { 'preferences.anonymousModeEnabled': true } });
    let r = await request(app).patch('/api/me/public-profile').set('Authorization', tok(B)).send({ enabled: true });
    expect(r.status).toBe(409);
    await User.findByIdAndUpdate(B, { $set: { 'preferences.anonymousModeEnabled': false } });
    r = await request(app).patch('/api/me/public-profile').set('Authorization', tok(B)).send({ enabled: true, headline: 'WhatsApp me on 9876543210' });
    expect(r.status).toBe(400);
  });

  test('robots.txt and app-link files', async () => {
    const r = await request(app).get('/robots.txt');
    expect(r.text).toMatch(/Disallow: \/app/);
    expect(r.text).toMatch(/Sitemap: https:\/\/www\.sambandh\.online\/sitemap\.xml/);
    expect((await request(app).get('/.well-known/assetlinks.json')).status).toBe(404);   // not configured yet
    process.env.ANDROID_CERT_SHA256 = 'AA:BB'; process.env.APPLE_TEAM_ID = 'TEAM123';
    const al = await request(app).get('/.well-known/assetlinks.json');
    expect(al.body[0].target).toMatchObject({ package_name: 'com.sambandh.app', sha256_cert_fingerprints: ['AA:BB'] });
    const aasa = await request(app).get('/.well-known/apple-app-site-association');
    expect(aasa.body.applinks.details[0].appIDs).toEqual(['TEAM123.com.sambandh.app']);
    delete process.env.ANDROID_CERT_SHA256; delete process.env.APPLE_TEAM_ID;
  });
});

describe('API v1 for the apps', () => {
  test('meta, device registration, and the /api/v1 alias of every web API', async () => {
    const meta = await request(app).get('/api/v1/meta');
    expect(meta.body).toMatchObject({ brand: 'Sambandh Setu', apiVersion: '1' });
    let r = await request(app).post('/api/v1/devices').set('Authorization', tok(A)).send({ platform: 'android', token: 'fcm-token-0123456789abcdef', appVersion: '1.0.0' });
    expect(r.status).toBe(201);
    r = await request(app).get('/api/v1/devices').set('Authorization', tok(A));
    expect(r.body.devices).toHaveLength(1);
    r = await request(app).post('/api/v1/devices').set('Authorization', tok(B)).send({ platform: 'android', token: 'fcm-token-0123456789abcdef' });
    expect((await request(app).get('/api/v1/devices').set('Authorization', tok(A))).body.devices).toHaveLength(0);   // token moved to B
    const alias = await request(app).get('/api/v1/intelligence/status').set('Authorization', tok(A));
    expect(alias.status).toBe(200);
    expect(alias.body.mode).toBe('basic');
  });
});

describe('Setu Journey', () => {
  test('stages advance only by mutual completion; Reflect answers respect sharing', async () => {
    const chat = await Chat.create({ participants: [A, B] });
    const id = String(chat._id);
    expect((await request(app).get(`/api/journey/${id}`).set('Authorization', tok(C))).status).toBe(404);
    let r = await request(app).post(`/api/journey/${id}/stages/connect/complete`).set('Authorization', tok(A));
    expect(r.body.advanced).toBe(false);
    expect(r.body.journey.stage).toBe('connect');
    r = await request(app).post(`/api/journey/${id}/stages/connect/complete`).set('Authorization', tok(B));
    expect(r.body.advanced).toBe(true);
    await request(app).post(`/api/journey/${id}/stages/understand/complete`).set('Authorization', tok(A));
    r = await request(app).post(`/api/journey/${id}/stages/understand/complete`).set('Authorization', tok(B));
    expect(r.body.journey.stage).toBe('reflect');

    const qs = (await request(app).get(`/api/journey/${id}/reflect/questions`).set('Authorization', tok(A))).body.questions;
    expect(qs).toHaveLength(10);
    r = await request(app).post(`/api/journey/${id}/stages/reflect/complete`).set('Authorization', tok(A));
    expect(r.status).toBe(409);                                   // must answer all 10 first
    const answer = (q) => q.type === 'scale' ? 4 : q.type === 'text' ? 'Honesty and patience' : q.type === 'single' ? q.options[0].value : [q.options[0].value];
    for (const q of qs) {
      const sharing = q.key === 'q01' ? 'share_with_match' : 'keep_private';
      r = await request(app).put(`/api/journey/${id}/reflect/answers/${q.key}`).set('Authorization', tok(A)).send({ value: answer(q), sharing });
      expect(r.status).toBe(200);
    }
    expect((await request(app).put(`/api/journey/${id}/reflect/answers/q03`).set('Authorization', tok(A)).send({ value: 9 })).status).toBe(400);
    const theirView = (await request(app).get(`/api/journey/${id}/reflect/progress`).set('Authorization', tok(B))).body;
    expect(theirView.partnerAnswered).toBe(10);
    expect(theirView.sharedWithMe.map(a => a.questionKey)).toEqual(['q01']);   // private answers never cross
    r = await request(app).post(`/api/journey/${id}/stages/reflect/complete`).set('Authorization', tok(A));
    expect(r.body.advanced).toBe(false);
  });

  test('only the person who paused can resume', async () => {
    const chat = await Chat.create({ participants: [A, B] });
    const id = String(chat._id);
    await request(app).post(`/api/journey/${id}/pause`).set('Authorization', tok(A));
    expect((await request(app).post(`/api/journey/${id}/resume`).set('Authorization', tok(B))).status).toBe(403);
    expect((await request(app).post(`/api/journey/${id}/stages/connect/complete`).set('Authorization', tok(B))).status).toBe(409);
    expect((await request(app).post(`/api/journey/${id}/resume`).set('Authorization', tok(A))).status).toBe(200);
  });
});

describe('intelligence API', () => {
  test('requires auth; conversations are owner-only', async () => {
    expect((await request(app).get('/api/intelligence/assistant/conversations')).status).toBe(401);
    const r = await request(app).post('/api/intelligence/assistant/message').set('Authorization', tok(A)).send({ message: 'Remember that I prefer evening calls' });
    expect(r.status).toBe(200);
    const cid = r.body.conversationId;
    expect((await request(app).get(`/api/intelligence/assistant/conversations/${cid}`).set('Authorization', tok(B))).status).toBe(404);
    const mine = await request(app).get(`/api/intelligence/assistant/conversations/${cid}`).set('Authorization', tok(A));
    expect(mine.body.messages.map(m => m.role)).toEqual(['user', 'assistant']);
    const mem = await request(app).get('/api/intelligence/memory').set('Authorization', tok(A));
    expect(mem.body.memories[0].text).toBe('I prefer evening calls');
    expect((await request(app).get('/api/intelligence/memory').set('Authorization', tok(B))).body.memories).toEqual([]);
    expect((await request(app).delete('/api/intelligence/memory').set('Authorization', tok(A)).send({})).status).toBe(400);   // needs explicit confirm
  });

  test('SSE stream emits meta → token → done', async () => {
    const r = await request(app).post('/api/intelligence/assistant/stream').set('Authorization', tok(A)).send({ message: 'Give me one conversation idea for a first chat' }).buffer(true).parse((res, cb) => { let d = ''; res.on('data', c => (d += c)); res.on('end', () => cb(null, d)); });
    expect(r.headers['content-type']).toMatch(/text\/event-stream/);
    const events = [...r.body.matchAll(/^event: (\w+)/gm)].map(m => m[1]);
    expect(events[0]).toBe('meta');
    expect(events).toContain('token');
    expect(events[events.length - 1]).toBe('done');
  });

  test('chat-scoped conversations need the member to be in that chat', async () => {
    const chat = await Chat.create({ participants: [B, C] });
    const r = await request(app).post('/api/intelligence/assistant/conversations').set('Authorization', tok(A)).send({ context: { kind: 'chat', refId: String(chat._id) } });
    expect(r.status).toBe(404);
  });

  test('admin overview needs the super key and exposes aggregates only', async () => {
    await request(app).post('/api/intelligence/assistant/message').set('Authorization', tok(A)).send({ message: 'My secret plan is to propose in Goa in March' });
    expect((await request(app).get('/api/superadmin/intelligence/overview')).status).toBe(401);
    const r = await request(app).get('/api/superadmin/intelligence/overview').set('X-Super-Key', process.env.SUPER_ADMIN_KEY);
    expect(r.status).toBe(200);
    expect(r.body.totals.conversations).toBe(1);
    expect(JSON.stringify(r.body)).not.toMatch(/Goa|propose/);
    expect(r.body.models.find(m => m.modelKey === 'setu-core').ok).toBe(true);
  });

  test('model registry rejects secrets and bad endpoints; cron drain needs its secret', async () => {
    const H = ['X-Super-Key', process.env.SUPER_ADMIN_KEY];
    let r = await request(app).post('/api/superadmin/intelligence/models').set(...H).send({ modelKey: 'gpu-main', provider: 'openai', baseUrl: 'ftp://x', model: 'qwen' });
    expect(r.status).toBe(400);
    r = await request(app).post('/api/superadmin/intelligence/models').set(...H).send({ modelKey: 'gpu-main', provider: 'openai', baseUrl: 'http://10.0.0.5:8000/v1', model: 'qwen2.5-14b-instruct-awq', tasks: ['chat'], apiKeyEnv: 'sk-live-123' });
    expect(r.status).toBe(400);   // a key value, not an ENV_VAR_NAME → refused
    r = await request(app).post('/api/superadmin/intelligence/models').set(...H).send({ modelKey: 'gpu-main', provider: 'openai', baseUrl: 'http://10.0.0.5:8000/v1', model: 'qwen2.5-14b-instruct-awq', tasks: ['chat'], tier: 'large', priority: 5, apiKeyEnv: 'SETU_GPU_KEY' });
    expect(r.status).toBe(201);
    const list = await request(app).get('/api/superadmin/intelligence/models').set(...H);
    expect(list.body.models.map(m => m.modelKey)).toEqual(expect.arrayContaining(['gpu-main', 'setu-core']));
    expect((await request(app).post('/api/intelligence/jobs/drain')).status).toBe(401);
    expect((await request(app).get('/api/intelligence/jobs/drain').set('Authorization', 'Bearer ' + process.env.CRON_SECRET)).status).toBe(200);
  });
});

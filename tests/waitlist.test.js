// tests/waitlist.test.js — the public pre-launch waiting list, on real Postgres.
// Anyone can join; email is validated; re-joining is idempotent (no dup, no error).

process.env.JWT_SECRET = 'test-jwt-secret-value-long-enough';

const express = require('express');
const request = require('supertest');
const db = require('./helpers/pg-db');            // must precede model/route requires

const waitlistRouter = require('../src/routes-waitlist');
const { errorHandler } = require('../src/lib/errors');
const Waitlist = require('../src/models/Waitlist');

const app = express();
app.use(express.json());
app.use('/api/waitlist', waitlistRouter);
app.use(errorHandler());

beforeAll(db.start);
afterAll(db.stop);
afterEach(db.clear);

describe('POST /api/waitlist', () => {
  test('a valid email joins the list and gets a position', async () => {
    const r = await request(app).post('/api/waitlist').send({ email: 'Asha@Example.com', source: 'home' });
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
    expect(r.body.position).toBe(1);
    const rows = await Waitlist.find({});
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe('asha@example.com');          // normalised lowercase
  });

  test('re-joining with the same email is idempotent — no duplicate, no error', async () => {
    await request(app).post('/api/waitlist').send({ email: 'asha@example.com' });
    const r = await request(app).post('/api/waitlist').send({ email: 'ASHA@example.com', name: 'Asha' });
    expect(r.status).toBe(200);
    expect(await Waitlist.countDocuments({})).toBe(1);       // still one row
    expect((await Waitlist.findOne({ email: 'asha@example.com' })).name).toBe('Asha'); // updated in place
  });

  test('an invalid email is rejected with 400 validation', async () => {
    for (const bad of ['', 'not-an-email', 'x@', '@y.com']) {
      const r = await request(app).post('/api/waitlist').send({ email: bad });
      expect(r.status).toBe(400);
      expect(r.body.code).toBe('validation');
    }
    expect(await Waitlist.countDocuments({})).toBe(0);
  });

  test('position increments as more people join', async () => {
    await request(app).post('/api/waitlist').send({ email: 'a@example.com' });
    await request(app).post('/api/waitlist').send({ email: 'b@example.com' });
    const r = await request(app).post('/api/waitlist').send({ email: 'c@example.com' });
    expect(r.body.position).toBe(3);
  });
});

describe('GET /api/waitlist/count', () => {
  test('returns the public count', async () => {
    await request(app).post('/api/waitlist').send({ email: 'a@example.com' });
    await request(app).post('/api/waitlist').send({ email: 'b@example.com' });
    const r = await request(app).get('/api/waitlist/count');
    expect(r.status).toBe(200);
    expect(r.body.count).toBe(2);
  });
});

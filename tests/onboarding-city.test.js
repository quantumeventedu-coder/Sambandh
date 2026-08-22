// tests/onboarding-city.test.js — onboarding must not hard-block on the city being in a fixed list
// (that left users stuck at the profile step), and a returning user who finished onboarding must not be
// re-gated by the optional badge steps (persisted onboarding.completedAt).

process.env.JWT_SECRET = 'test-jwt-secret-value-long-enough';

const express = require('express');
const request = require('supertest');
const db = require('./helpers/pg-db');
jest.mock('../src/services/analytics', () => ({ track: jest.fn() }));
jest.mock('../src/services/events', () => ({ record: jest.fn(), stream: jest.fn(), behaviorFor: jest.fn() }));

const authRouter = require('../src/routes-auth');
const User = require('../src/models/User');

const app = express();
app.use(express.json());
app.use('/auth', authRouter);

beforeAll(db.start);
afterAll(db.stop);
afterEach(async () => { await db.clear(); jest.clearAllMocks(); });

let seq = 0;
async function authed() {
  const email = `c${seq++}@example.com`;
  const r = await request(app).post('/auth/register').send({ email, password: 'correct-horse-battery' });
  return { token: r.body.token, email };
}
const signup = (token, over = {}) => request(app).post('/auth/complete-signup').set('Authorization', 'Bearer ' + token)
  .send({ firstName: 'Sid', gender: 'male', dob: '2003-11-16', city: 'Saunda Basti', languages: ['hindi'], ...over });

describe('city + onboarding completion', () => {
  test('complete-signup accepts ANY typed city (an unlisted town no longer blocks onboarding)', async () => {
    const { token } = await authed();
    const r = await signup(token, { city: 'Saunda Basti' });
    expect(r.status).toBe(200);                              // NOT "Please pick a city from the list"
    expect(r.body.user.profile.city).toBe('Saunda Basti');  // stored exactly as typed
  });

  test('names with an apostrophe/hyphen and non-Devanagari Indic scripts are accepted', async () => {
    let r = await signup((await authed()).token, { firstName: "D'Souza" });
    expect(r.status).toBe(200);
    expect(r.body.user.profile.firstName).toBe("D'Souza");
    r = await signup((await authed()).token, { firstName: 'Anne-Marie' });
    expect(r.status).toBe(200);
    r = await signup((await authed()).token, { firstName: 'அருண்' });   // Tamil
    expect(r.status).toBe(200);
  });

  test('a name with digits/symbols is still rejected', async () => {
    const r = await signup((await authed()).token, { firstName: 'John123' });
    expect(r.status).toBe(400);
  });

  test('a known city still resolves normally', async () => {
    const { token } = await authed();
    const r = await signup(token, { city: 'Guwahati' });
    expect(r.status).toBe(200);
    expect(r.body.user.profile.city).toBe('Guwahati');
  });

  test('PATCH /auth/profile { onboarded:true } persists onboarding.completedAt', async () => {
    const { token, email } = await authed();
    const r = await request(app).patch('/auth/profile').set('Authorization', 'Bearer ' + token).send({ onboarded: true });
    expect(r.status).toBe(200);
    const u = await User.findOne({ email });
    expect(u.onboarding && u.onboarding.completedAt).toBeTruthy();
  });
});

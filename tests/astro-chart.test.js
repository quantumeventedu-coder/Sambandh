// tests/astro-chart.test.js — GET /astro/chart must return the FULL chart + reading for a user with
// birth data. Regression guard for the require typo ('../services/astro-reading') that 500'd the whole
// Astrology page for every user, exercising the detailedReading() path the unit tests didn't hit.

const db = require('./helpers/pg-db');
const UID = '64b7f9c2e1a4d5f6a7b8c9d0';
jest.mock('../src/routes-auth', () => ({
  requireAuth: (req, _res, next) => { req.userId = UID; req.role = 'user'; next(); },
  requireLaunched: (_req, _res, next) => next(),
}));

const express = require('express');
const request = require('supertest');
const User = require('../src/models/User');
const router = require('../src/routes-astro');

const app = express();
app.use(express.json());
app.use('/astro', router);

beforeAll(db.start);
afterAll(db.stop);
afterEach(db.clear);

describe('GET /astro/chart', () => {
  test('returns the full chart + reading for a user with birth data (the frontend’s saved shape)', async () => {
    // Exactly what obSaveAstro persists: birthPlace has only `city` (no lat/lng), with a birth time.
    await User.create({ _id: UID, phone: '+919000000010', profile: { firstName: 'Sid', dob: '1994-05-12' }, astrology: { birthDate: '1994-05-12', birthTime: '08:30', birthPlace: { city: 'Guwahati' } } });
    const r = await request(app).get('/astro/chart');
    expect(r.status).toBe(200);                                   // never a 500 (the require typo)
    expect(r.body.chart).toBeTruthy();
    expect(r.body.chart.planets.Sun).toBeTruthy();
    expect(r.body.reading).toBeTruthy();                          // the detailedReading() path resolves
    expect(r.body.interpretation).toBeTruthy();
    expect(r.body.nakshatra).toBeTruthy();
  });

  test('an INVALID stored birth date does not 500 /transits (returns needsBirthData)', async () => {
    // '2023-13-10' passes the shape regex but is not a real calendar date → computeChart returns null.
    await User.create({ _id: UID, phone: '+919000000012', profile: { firstName: 'X' }, astrology: { birthDate: '2023-13-10' } });
    const r = await request(app).get('/astro/transits');
    expect(r.status).toBe(200);
    expect(r.body.needsBirthData).toBe(true);
  });

  test('a user with no birth data gets needsBirthData, not an error', async () => {
    await User.create({ _id: UID, phone: '+919000000011', profile: { firstName: 'A' }, astrology: {} });
    const r = await request(app).get('/astro/chart');
    expect(r.status).toBe(200);
    expect(r.body.needsBirthData).toBe(true);
    expect(r.body.chart).toBeNull();
  });
});

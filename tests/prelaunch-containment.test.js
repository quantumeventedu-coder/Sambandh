// tests/prelaunch-containment.test.js — the pre-launch containment invariant:
// while the site is pre-launch, a NORMAL (non-admin) user may register + pay into
// the waiting list but must NOT reach any dating/social surface. The launch gate
// used to live only on the Discover feed; a review found chat, community, compat,
// reading, astro, karma, discover-profile and me/network all reachable. This pins
// that every one of them now returns 403 { code:'prelaunch' } for a gated user,
// that admins bypass, and that launching the site opens them.

process.env.JWT_SECRET = 'test-jwt-secret-value-long-enough';

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const db = require('./helpers/pg-db');            // must precede model/route requires
const { launch } = require('./helpers/launch');

const app = express();
app.use(express.json());
app.use('/api/discover', require('../src/routes-discover'));
app.use('/api/chat', require('../src/routes-chat'));
app.use('/api/compat', require('../src/routes-compat'));
app.use('/api/community', require('../src/routes-community'));
app.use('/api/karma', require('../src/routes-karma'));
app.use('/api/reading', require('../src/routes-reading'));
app.use('/api/astro', require('../src/routes-astro'));
app.use('/api/me', require('../src/routes-me'));

const token = (role) => 'Bearer ' + jwt.sign({ userId: '650000000000000000000001', role: role || 'user' }, process.env.JWT_SECRET, { expiresIn: '1d' });
const TARGET = '650000000000000000000009';

// Every route that must be contained while pre-launch. [method, path, body?]
const GATED = [
  ['get', '/api/discover/'],
  ['get', '/api/discover/likes'],
  ['get', `/api/discover/profile/${TARGET}`],
  ['post', '/api/chat/start', { withUserId: TARGET }],
  ['get', '/api/chat/'],
  ['get', `/api/compat/${TARGET}`],
  ['get', `/api/compat/${TARGET}/intelligence`],
  ['get', '/api/community/rooms'],
  ['get', `/api/karma/profile/${TARGET}`],
  ['get', `/api/reading/${TARGET}`],
  ['get', `/api/reading/compat/${TARGET}`],
  ['get', `/api/astro/chart/${TARGET}`],
  ['get', `/api/astro/compat/${TARGET}`],
  ['get', '/api/me/network'],
];

const call = (method, path, role, body) => {
  const r = request(app)[method](path).set('Authorization', token(role));
  return body ? r.send(body) : r;
};

beforeAll(db.start);
afterAll(db.stop);
afterEach(db.clear);

describe('pre-launch: every interactive/other-member route is contained for a normal user', () => {
  for (const [method, path, body] of GATED) {
    test(`${method.toUpperCase()} ${path} → 403 prelaunch`, async () => {
      const r = await call(method, path, 'user', body);
      expect(r.status).toBe(403);
      expect(r.body.code).toBe('prelaunch');
    });
  }
});

describe('admins/moderators bypass the pre-launch gate (oversight)', () => {
  for (const [method, path, body] of GATED) {
    test(`${method.toUpperCase()} ${path} is NOT prelaunch-blocked for an admin`, async () => {
      const r = await call(method, path, 'admin', body);
      expect(r.body.code).not.toBe('prelaunch');
    });
  }
});

describe('after launch, a normal user is no longer prelaunch-gated', () => {
  beforeEach(launch);
  for (const [method, path, body] of GATED) {
    test(`${method.toUpperCase()} ${path} passes the launch gate`, async () => {
      const r = await call(method, path, 'user', body);
      // The route may 404/400/200 or return a tier-locked teaser, but it must NOT be
      // the pre-launch block — the gate has opened.
      expect(r.body.code).not.toBe('prelaunch');
    });
  }
});

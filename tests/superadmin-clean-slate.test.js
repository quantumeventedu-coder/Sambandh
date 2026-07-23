// tests/superadmin-clean-slate.test.js — the FULL reset. Wipes everything to a true
// zero (even earlyAccess / real-email test accounts, and the ownerless training
// examples the softer purge can't reach), keeps only admin/staff, and is guarded by
// the exact phrase + pre-launch-only.

process.env.JWT_SECRET = 'test-jwt-secret-value-long-enough';
process.env.SUPER_ADMIN_KEY = 'test-super-key';

const express = require('express');
const request = require('supertest');
const db = require('./helpers/pg-db');            // must precede model/route requires

const superRouter = require('../src/routes-superadmin');
const { errorHandler } = require('../src/lib/errors');
const site = require('../src/services/site-mode');
const User = require('../src/models/User');
const AppConfig = require('../src/models/AppConfig');
const TrainingExample = require('../src/models/TrainingExample');
const Waitlist = require('../src/models/Waitlist');

const app = express();
app.use(express.json());
app.use('/api/superadmin', superRouter);
app.use(errorHandler());
const SK = { 'X-Super-Key': 'test-super-key' };

let seq = 6900000000;
const mkUser = (over = {}) => User.create({ phone: '+91' + (seq++), ...over });
const reset = (body, headers = SK) => request(app).post('/api/superadmin/reset-clean-slate').set(headers).send(body);
async function setPrelaunch(on) {
  await AppConfig.findOneAndUpdate({ key: 'singleton' }, { $set: { prelaunch: on } }, { upsert: true });
  site._clearCacheForTests();
}

beforeAll(db.start);
afterAll(db.stop);
afterEach(async () => { await db.clear(); site._clearCacheForTests(); });

describe('clean-slate reset', () => {
  test('wrong confirm phrase → 400, nothing deleted', async () => {
    await setPrelaunch(true);
    await mkUser();
    const r = await reset({ confirm: 'yes please' });
    expect(r.status).toBe(400);
    expect(await User.countDocuments({})).toBe(1);
  });

  test('post-launch → 409 (never wipes a live membership base)', async () => {
    await setPrelaunch(false);
    await mkUser();
    const r = await reset({ confirm: 'WIPE ALL' });
    expect(r.status).toBe(409);
    expect(await User.countDocuments({})).toBe(1);
  });

  test('WIPE ALL removes even earlyAccess & real-email test accounts + all test data, keeps admins', async () => {
    await setPrelaunch(true);
    await mkUser({ membership: { earlyAccess: true, joinFeePaid: true } }); // softer purge would KEEP this
    await mkUser({ email: 'someone@gmail.com' });                           // softer purge would KEEP this
    const admin = await mkUser({ role: 'admin' });
    await TrainingExample.create({ kind: 'swipe', features: [0.1, 0.2], label: 1 }); // ownerless — purge can't reach
    await Waitlist.create({ email: 'wl@example.com' });

    const r = await reset({ confirm: 'WIPE ALL' });
    expect(r.status).toBe(200);
    expect(r.body.deletedUsers).toBe(2);
    const left = await User.find({}).lean();
    expect(left).toHaveLength(1);
    expect(left[0].role).toBe('admin');
    expect(String(left[0]._id)).toBe(String(admin._id));
    expect(await TrainingExample.countDocuments({})).toBe(0);
    expect(await Waitlist.countDocuments({})).toBe(0);
  });

  test('owner-only — no super key is rejected', async () => {
    await setPrelaunch(true);
    await mkUser();
    const r = await reset({ confirm: 'WIPE ALL' }, {});
    expect([401, 403]).toContain(r.status);
    expect(await User.countDocuments({})).toBe(1);
  });
});

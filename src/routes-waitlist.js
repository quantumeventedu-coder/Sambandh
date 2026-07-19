// routes-waitlist.js — public pre-launch waiting list. No auth (anyone can join),
// email-validated, idempotent per email. Covered by the global /api rate limiter.
const express = require('express');
const { z } = require('zod');
const Waitlist = require('./models/Waitlist');
const { ValidationError } = require('./lib/errors');

const router = express.Router();

const joinSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  name: z.string().trim().max(120).optional(),
  source: z.string().trim().max(40).optional(),
  intent: z.string().trim().max(40).optional(),
  city: z.string().trim().max(80).optional()
});

// POST /api/waitlist — join (or re-affirm) the waiting list.
router.post('/', async (req, res, next) => {
  try {
    const parsed = joinSchema.safeParse(req.body || {});
    if (!parsed.success) throw new ValidationError('Enter a valid email address');
    const d = parsed.data;

    // Idempotent: upsert by email so a repeat sign-up never errors or duplicates.
    const doc = await Waitlist.findOneAndUpdate(
      { email: d.email },
      {
        $set: { name: d.name, source: d.source || 'home', intent: d.intent, city: d.city },
        $setOnInsert: { email: d.email, createdAt: new Date(), referrer: String(req.headers['referer'] || '').slice(0, 200) }
      },
      { upsert: true, new: true }
    );

    // position = how many joined up to and including this person (nice social proof)
    const position = await Waitlist.countDocuments({ createdAt: { $lte: doc.createdAt } });
    res.json({ ok: true, position, message: 'You\'re on the list — we\'ll email you the moment we open the doors.' });
  } catch (err) { next(err); }
});

// GET /api/waitlist/count — public count for the "N already waiting" social proof.
router.get('/count', async (req, res, next) => {
  try {
    res.json({ count: await Waitlist.countDocuments({}) });
  } catch (err) { next(err); }
});

module.exports = router;

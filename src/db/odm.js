// odm.js — data-layer switch.
//
// DATABASE_URL set (Supabase/PostgreSQL)  → pg-odm (documents in JSONB)
// otherwise                               → real Mongoose (Atlas / in-memory)
//
// Every model and route requires this module instead of 'mongoose', so the
// whole application runs unchanged on either backend.

module.exports = process.env.DATABASE_URL
  ? require('./pg-odm')
  : require('mongoose');

// intelligence/db-ready.js — is the data layer connected right now?
// Lets optional lookups (admin overrides, cached config) skip the database when
// it is not connected, instead of waiting on Mongoose's 10-second command buffer.
// The ODM is resolved lazily because tests may switch engines (pg-odm ↔ Mongoose).
module.exports = function dbReady() {
  try {
    const odm = require('../db/odm');
    return !!(odm.connection && odm.connection.readyState === 1);
  } catch { return false; }
};

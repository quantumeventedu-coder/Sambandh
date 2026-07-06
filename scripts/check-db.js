// scripts/check-db.js — quick MongoDB connectivity test
require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.log('RESULT: NO_URI'); process.exit(2); }
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
    console.log('RESULT: CONNECTED');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.log('RESULT: FAILED —', err.message.split('\n')[0]);
    process.exit(1);
  }
}
main();

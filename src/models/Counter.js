const mongoose = require('../db/odm');

// A named monotonic counter (e.g. per-financial-year invoice sequences). Incremented by a
// single conditional atomicUpdate ($inc) so numbers never duplicate under concurrency.
const CounterSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, index: true },
  seq: { type: Number, default: 0 },
});

module.exports = mongoose.model('Counter', CounterSchema);

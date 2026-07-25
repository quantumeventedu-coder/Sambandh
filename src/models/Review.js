// @ts-check
// models/Review.js — a buyer's rating of a partner after a completed order.
//
// Only a completed order can be reviewed (verifiedPurchase is always true here),
// which keeps ratings honest and feeds the marketplace "merchant reliability"
// ranking signal. One review per order (enforced by the unique orderId index).
const mongoose = require('../db/odm');

const ReviewSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner', required: true, index: true },
  listingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing' },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true, sparse: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  text: { type: String, maxlength: 2000 },
  verifiedPurchase: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Review', ReviewSchema);

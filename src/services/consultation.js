// @ts-check
// services/consultation.js — bookable consultations (coaches / counsellors /
// astrologers / lawyers / advisors …) built ON the hardened marketplace core.
//
// A consultant is a Partner in a consultation category; an offering is a Listing
// (billing 'flat' or 'per_minute'); a booking is a marketplace Order (so it inherits
// commission + escrow + the fail-closed state machine). This module adds only what's
// new: availability slots (atomically booked so two buyers can't grab one) and the
// live session (start/end) that drives the order to fulfilled.

const market = require('./marketplace');
const Order = require('../models/Order');
const Session = require('../models/Session');
const Slot = require('../models/ConsultantSlot');

// In-app notify (best-effort; never blocks a booking transition). Lazy require avoids a cycle.
const notify = (/** @type {any} */ uid, /** @type {any} */ n) => {
  try { return /** @type {any} */ (require('../routes-notifications')).deliverNotification(uid, n).catch(() => {}); }
  catch { return Promise.resolve(); }
};

/** Partner categories that are bookable consultations. */
const CONSULT_CATEGORIES = ['coach', 'counselor', 'astrologer', 'lawyer', 'financial_advisor', 'fitness', 'nutritionist'];

/** The amount charged for a booking. per_minute = rate × the booked slot length
 * (a known amount at booking); otherwise the flat listing price.
 * @param {any} listing */
function priceForListing(listing) {
  if (listing.billing === 'per_minute' && listing.ratePerMinuteCHF && listing.durationMin) {
    return market.round2(listing.ratePerMinuteCHF * listing.durationMin);
  }
  return listing.priceCHF;
}

/** Publish an availability slot for a consultation listing.
 * @param {{ partner:any, listing:any, startsAt:any, durationMin?:number }} args */
async function publishSlot({ partner, listing, startsAt, durationMin }) {
  return Slot.create({
    partnerId: partner._id, listingId: listing._id,
    startsAt: new Date(startsAt), durationMin: durationMin || listing.durationMin || 30,
    status: 'open', createdAt: new Date()
  });
}

/**
 * Book a slot: ATOMICALLY reserve it (open → booked), then create the order + session.
 * If the order can't be created, the slot reservation is rolled back so it stays open.
 * @param {{ userId:any, listing:any, partner:any, slot:any, giftForUserId?:any }} args
 */
async function bookSlot({ userId, listing, partner, slot, giftForUserId }) {
  if (!slot || slot.status !== 'open') throw new Error('Slot is not available');
  const reserved = await market.atomicUpdate(Slot, { _id: slot._id, status: 'open' }, { $set: { status: 'booked' } });
  if (!reserved) throw new Error('That slot was just taken');
  try {
    const amount = priceForListing(listing);
    const synthetic = { _id: listing._id, kind: 'booking', priceCHF: amount, stock: null, active: listing.active };
    const order = await market.createOrder({ userId, listing: synthetic, partner, scheduledFor: new Date(slot.startsAt), giftForUserId });
    await market.atomicUpdate(Slot, { _id: slot._id }, { $set: { orderId: String(order._id) } });
    const session = await Session.create({
      orderId: order._id, slotId: slot._id, partnerId: partner._id,
      userId,                                            // attendee (buyer until a gift is accepted)
      bookedByUserId: userId, giftForUserId: giftForUserId || null,
      status: 'scheduled', createdAt: new Date()
    });
    // A gift is announced to the recipient only once it's paid (marketplace confirm-payment); the
    // buyer just gets a "gift booked" note here.
    notify(userId, giftForUserId
      ? { type: 'appointment', severity: 'info', title: 'Gift booked 🎁', body: `Your ${listing.title || 'consultation'} gift is booked — your match will be asked to accept it.` }
      : { type: 'appointment', severity: 'info', title: 'Appointment booked 🗓️', body: `Your ${listing.title || 'consultation'} with ${partner.name || 'your consultant'} is booked. See it under My appointments.` });
    return { order, session };
  } catch (err) {
    await market.atomicUpdate(Slot, { _id: slot._id }, { $set: { status: 'open' } });   // roll back
    throw err;
  }
}

/** Consultant starts the session → order paid → confirmed, session active.
 * @param {any} session */
async function startSession(session) {
  if (session.status !== 'scheduled') throw new Error('Session is not scheduled');
  const order = await Order.findById(session.orderId);
  if (!order || order.status !== 'paid') throw new Error('Booking is not paid yet');
  await market.transition(order, 'confirmed');
  await Session.findByIdAndUpdate(session._id, { status: 'active', startedAt: new Date() });
  notify(session.userId, { type: 'appointment', severity: 'info', title: 'Your session is starting 📞', body: 'Your consultant has started the session. Join from My appointments.' });
  return { ...session, status: 'active' };
}

/** Consultant ends the session → order confirmed → fulfilled; the buyer then
 * completes to release the payout. Records the real elapsed minutes.
 * @param {any} session */
async function endSession(session) {
  if (session.status !== 'active') throw new Error('Session is not active');
  const order = await Order.findById(session.orderId);
  await market.transition(order, 'fulfilled');
  const endedAt = new Date();
  const actualMinutes = session.startedAt
    ? Math.max(1, Math.round((endedAt.getTime() - new Date(session.startedAt).getTime()) / 60000))
    : null;
  await Session.findByIdAndUpdate(session._id, { status: 'ended', endedAt, actualMinutes });
  notify(session.userId, { type: 'appointment', severity: 'info', title: 'Session ended', body: 'Your session has ended. Confirm in My appointments to release the payment to your consultant.' });
  return { ...session, status: 'ended', endedAt, actualMinutes };
}

/** Cancel a booking before it's fulfilled: refund the order (if paid) and free the slot.
 * Only a not-yet-started (scheduled) booking is cancellable — once the session is
 * active/ended the slot has been consumed and money is mid-flight.
 * @param {any} session */
async function cancelBooking(session) {
  if (session.status !== 'scheduled') throw new Error('Only a scheduled booking can be cancelled');
  const order = await Order.findById(session.orderId);
  if (order && ['created', 'paid', 'confirmed'].includes(order.status)) {
    await market.transition(order, 'cancelled');   // reverses a captured payment on the rail
  }
  await market.atomicUpdate(Slot, { _id: session.slotId }, { $set: { status: 'open', orderId: null } });
  await Session.findByIdAndUpdate(session._id, { status: 'cancelled' });
  notify(session.userId, { type: 'appointment', severity: 'info', title: 'Appointment cancelled', body: 'Your appointment was cancelled and the payment refunded.' });
  return { ...session, status: 'cancelled' };
}

module.exports = {
  CONSULT_CATEGORIES, priceForListing, publishSlot, bookSlot, startSession, endSession, cancelBooking
};

# 04 — Pricing and Payments

> **⚠️ Superseded (July 2026):** All live pricing is now in **CHF** — join fee
> CHF 1 (men) / CHF 5 (women) / CHF 3 (non-binary); Sambandh+ CHF 6/mo;
> Premium CHF 15/mo; karma escalations CHF 0.50–1. See `src/routes-payment.js`
> for the authoritative prices. The USD/INR figures below are the original
> design rationale, kept for historical context.

## Your model

| Gender | Join fee (USD) | Join fee (INR, ~₹83/USD) |
|--------|----------------|--------------------------|
| Male | $1 | ₹83 |
| Female | $5 | ₹415 |

One-time fee. Paid after ID verification, before chat unlock.

---

## Why this is unconventional (and a calculated risk)

Standard dating apps charge men more (or charge only men) to:
- Filter out spam (women get harassed less)
- Subsidize free access for women (improves gender ratio)

Your model flips this. The logic that could justify it:

1. **Filter for serious women.** Women who pay $5 are signaling intent — not just browsing for entertainment or attention. This may improve match quality for paying men, who get fewer but better matches.

2. **Lower barrier for men.** $1 is psychologically nothing. You'll get massive male signup volume.

3. **The risk:** if the gender ratio skews 10:1 male, the app dies. Women won't stay if they get spammed by 50 messages a day from low-effort men.

**Mitigations to build in:**
- Daily message-send limits for men (e.g., 5 outbound messages/day for free tier)
- Women see incoming requests in a queue, not as bombarding chats
- Reputation system penalizes ghosting / pushy behavior
- Track gender ratio per city — if any city skews >5:1 male, pause male signups in that city
- Have a "premium" tier later: men pay ₹500/month for unlimited messages, women pay ₹100/month for advanced filters

**Recommend:** track these metrics weekly. If female DAU drops or female 30-day retention falls below 40%, reconsider the pricing.

---

## Razorpay integration

### Setup

1. Sign up at razorpay.com (needs Indian Pvt Ltd or LLP)
2. Complete KYC (PAN, GST if applicable, bank account)
3. Get Test Mode keys: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`
4. Set webhook URL in Razorpay dashboard pointing to `https://api.sambandh.in/webhooks/razorpay`
5. Set webhook secret: `RAZORPAY_WEBHOOK_SECRET`

### Payment flow

```
1. User clicks "Pay join fee"
   ↓
2. Frontend calls POST /api/payment/create-order
   ↓
3. Backend determines amount based on user.gender:
     male   → 8300 paise (₹83)
     female → 41500 paise (₹415)
   ↓
4. Backend calls Razorpay API to create order, returns order_id to frontend
   ↓
5. Frontend opens Razorpay Checkout (UPI / card / netbanking)
   ↓
6. User pays
   ↓
7. Razorpay returns: razorpay_order_id, razorpay_payment_id, razorpay_signature
   ↓
8. Frontend sends these to POST /api/payment/verify
   ↓
9. Backend verifies signature using HMAC SHA256
   ↓
10. If valid: mark user.membership.joinFeePaid = true, save payment record
   ↓
11. Razorpay webhook also fires (belt + suspenders)
```

### Critical security rules

1. **Never trust the client about amount.** Always compute amount server-side from user.gender.
2. **Always verify signature** before granting access:
   ```js
   const crypto = require('crypto');
   const expected = crypto
     .createHmac('sha256', RAZORPAY_KEY_SECRET)
     .update(razorpay_order_id + '|' + razorpay_payment_id)
     .digest('hex');
   if (expected !== razorpay_signature) throw new Error('Invalid payment');
   ```
3. **Idempotency** — if webhook fires twice, don't double-credit. Check `razorpayPaymentId` is unique.
4. **Log everything** in `payments` and `audit_log` collections.

### Refunds

For your model, refunds should be:
- **Within 24 hours of payment, no questions asked** (legally safer)
- After 24h, only if user wasn't able to verify profession through no fault of their own
- After profession verification + first chat, no refund

Build a refund flow in the admin panel; Razorpay supports partial/full refunds via API.

---

## Future revenue: Premium tiers

Don't launch with these, but plan for them by month 3:

**Sambandh+ (₹599/month)**
- Unlimited daily messages (free tier capped at 5/day for men, 20/day for women)
- See who liked your profile
- Advanced filters (income range, lifestyle, language preference)
- Boost your profile in discover for 24h

**Sambandh Premium (₹1,499/month)**
- Everything in +
- Astrology compatibility for unlimited profiles
- Priority profession verification (8h SLA)
- "Read by" status on messages
- Travel mode (match in another city)

**One-time boosts:**
- Profile boost (24h): ₹99
- Super-like (skip the queue): ₹49

---

## GST and invoicing

For Indian-registered users:
- GST applies on the join fee (18% on dating services)
- Razorpay can auto-generate GST invoices
- $1 fee = ₹83 → ₹70.34 + ₹12.66 GST
- $5 fee = ₹415 → ₹351.69 + ₹63.31 GST

For overseas users (NRI mode later):
- Different tax treatment, you'll need a CA to advise

---

## What to track

Per user:
- `joinFeePaid` (bool)
- `joinFeePaidAt` (timestamp)
- `joinFeeAmount` (in INR, for reporting)
- `paymentMethod` (UPI / card / netbanking)

Per day, dashboard:
- Signups (split by gender)
- Payments completed (split by gender)
- Conversion rate (signup → paid)
- Revenue (split by gender, by city)
- Refunds processed
- Failed payments + reason

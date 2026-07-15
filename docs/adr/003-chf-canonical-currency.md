# ADR-003: CHF as canonical currency with live FX conversion

**Status:** Accepted
**Date:** 2026-07-15 (backfilled)

## Context

Pricing is gender-based (male CHF 1 · female CHF 5 · non-binary CHF 3) plus tiers
(Pro 6 · Max 15) and small charges (escalation 0.5/1, boost 1). Users are
overwhelmingly Indian, but the business reasons about price in CHF.

Two real constraints forced the design:

- **Razorpay only offers UPI, netbanking and wallets for INR.** A CHF-denominated
  order collapses the payment sheet to international cards — which most Indian users
  do not have. Charging INR is not cosmetic; it is the difference between a payment
  method existing and not.
- **Displayed price must equal charged price.** A hardcoded conversion drifts from
  reality the day the rate moves, and the user sees one number and is charged
  another.

## Options

1. **Charge CHF everywhere.** One currency, no FX. Kills UPI/wallets for the primary
   market. Rejected.
2. **Hardcode INR prices** (e.g. ₹99/₹499). Round, memorable, no FX dependency. But
   the CHF↔INR relationship silently rots, and every price change is a code change.
3. **CHF canonical + live FX at request time.** Business reasons in one currency;
   each user is charged in their local currency at the current rate, which unlocks
   local payment methods.

## Decision

**Option 3.** CHF is the single source of truth (`PRICING_CHF` in
`routes-payment.js`); `services/fx.js` converts to the user's currency at request
time (India → INR, otherwise CHF), and the order is created in that currency.

Supporting decisions:

- **Rates come from frankfurter.app** (free, ECB-sourced, no key), cached ~12h, with
  a static fallback table so **payments never fail because FX is down**.
- **Currency and gender are read from the database, never the request.** Price is
  server-side or it is not a price.
- The canonical CHF amount is stored on every `Payment` (`amountCHF`) alongside the
  charged currency, so revenue is reportable in one unit regardless of what was
  charged.

## Consequences

- **Prices are not round.** CHF 1 becomes ₹118, not ₹99. This is a real UX and
  marketing cost, and the most likely reason to revisit this ADR. The honest
  alternative is a per-currency price table (option 2) with an explicit, human
  decision each time the rate moves.
- **The displayed price can change between sessions** as the rate moves. Acceptable
  because display and charge are computed from the same call, so they always agree.
- **An external dependency sits in the payment path.** Mitigated by the 12h cache and
  the fallback table; if frankfurter disappears permanently, the fallback silently
  becomes stale — worth an alert (see the SLO work in Phase 2).
- **FX must be mocked in tests**, or the suite makes network calls and becomes
  flaky. `tests/payment.test.js` mocks it at a fixed rate so amounts are asserted
  exactly.
- Adding a country means adding its currency to `SYMBOLS` + the fallback table, not
  a new price list.

# Privacy & Consent copy — Live Location Sharing + Gifting

> **STATUS: DRAFT for legal review. Not legal advice.**
> This document is written to match exactly what the product does today (see the "How it
> actually works" notes). Before promoting these features, have your counsel review it and
> fold the two Privacy-Policy sections into your main Privacy Policy, and confirm it aligns with
> your DPDP (Digital Personal Data Protection Act, 2023) notice, your registered Grievance
> Officer, and your consent-withdrawal flow. Keep the in-app copy and this document in sync — if
> the implementation changes, update both.

Two features are covered:
- **A. Couple live-location sharing** — real-time location shared between two matched members.
- **B. Gifting a product to a match** — buying a marketplace product and sending it to a match.

---

## A. Couple live-location sharing

### How it actually works (ground truth for the copy)
- Sharing is **mutual and consent-based**: one member requests, the other must accept. It is
  active only while **both** sides are sharing.
- The live position is shown **to the consented match** and to **Sambandh's safety/super-admin
  oversight** (for abuse/safety investigation) — **never to other members**.
- It is **ephemeral**: only the **latest** position is stored, and it is **nulled the moment
  sharing stops**. It is **not** added to the admin location-history trail.
- It **auto-expires** at a chosen time limit (hard cap **8 hours**); it can be extended while active.
- **Either side can stop instantly**; **blocking or unmatching also stops it immediately**.
- It is **never covert** — the request is announced to the other person.
- All share records are **deleted when the account is deleted**.

### A1. In-app consent copy

**Request screen / button**

> **Share live location**
> Share your real-time location with this match. You both have to turn it on, either of you can
> stop it any time, and it ends automatically at the time limit.

**Request-received prompt (to the invited person)**

> **Live location request 📍**
> Your match wants to share live location with each other. While it's on, your location is
> visible **to each other** and to **Sambandh's safety team** (for abuse prevention) — **never to
> other members**. Only your latest position is kept, and it's deleted the moment either of you
> stops. You can stop any time; it also ends automatically at the time limit.
> [ Accept & share ]   [ Not now ]

**Active screen (footer)**

> Both of you are sharing. Either can stop any time, and it ends automatically at the time limit.
> Your live location is shown to your match and to Sambandh's safety team for abuse prevention —
> never to other members. Only your latest position is kept and it's deleted the moment you stop.

**Stop / revoke confirmation (toast)**

> Sharing stopped. Your location is no longer visible to your match.

### A2. Privacy Policy section — "Live location sharing"

> **What we collect.** When you turn on live location sharing with a match, we process your
> device's real-time GPS coordinates (latitude, longitude, and accuracy) for as long as sharing
> is active.
>
> **Why (purpose).** Solely to show your live location to the specific match you have chosen to
> share with, so the two of you can find each other. We do not use it for advertising or profiling.
>
> **Legal basis.** Your explicit, opt-in **consent**, given separately by each person. Sharing is
> active only while both people have consented and is announced — never silent.
>
> **Who can see it.** Only (a) the specific match you are sharing with, and (b) Sambandh's safety
> team, strictly for abuse-prevention and safety investigations. It is **never** shown to other
> members, advertisers, or third parties.
>
> **Retention.** We keep only your **most recent** position while sharing is active. It is
> **deleted immediately** when you stop, when the other person stops, when you block or unmatch,
> or when the session expires (maximum 8 hours). Live-location data is **not** added to any
> long-term location history, and all sharing records are deleted when you delete your account.
>
> **Your controls.** You can stop sharing at any moment; blocking or unmatching stops it
> instantly. You can withdraw consent as easily as you gave it. Withdrawing consent stops future
> sharing and deletes the last stored position.
>
> **Security.** Coordinates are transmitted over encrypted connections and are only ever released
> to a consented recipient after a live consent check.

---

## B. Gifting a product to a match

### How it actually works (ground truth for the copy)
- A member buys a marketplace product and sends it as a gift to one of **their matches**.
- The **recipient** decides whether to accept, and if they accept a physical product they enter
  **their own delivery address**. **The buyer never sees the recipient's address.**
- The delivery address is used **only to fulfil and ship the order** (shared with the fulfilling
  partner/seller for that purpose).
- If the recipient **declines**, the buyer is **refunded**.
- The purchase is a normal marketplace transaction (itemised price + applicable GST on the receipt).

### B1. In-app consent copy

**Buyer — gift flow**

> **Gift to a match**
> They decide whether to accept, and they enter their **own** delivery address — **you never see
> it**. If they decline, you're refunded.

**Recipient — accept + address prompt**

> **You've received a gift 🎁**
> Enter where you'd like it delivered. Only the seller fulfilling your gift sees this address —
> **never the person who sent it**.

**Recipient — decline**

> Declined. The sender has been refunded. No address is shared.

### B2. Privacy Policy section — "Gifts & delivery"

> **What we collect.** If you accept a physical gift from a match, we collect the delivery
> details you enter (name, phone number, and postal address).
>
> **Why (purpose).** Solely to fulfil and deliver that gift.
>
> **Who can see it.** The seller/partner fulfilling your order (and their delivery/courier
> service), strictly to ship it to you. **The member who sent the gift never sees your delivery
> address.** We do not use your delivery details for advertising.
>
> **Legal basis.** Performance of the transaction you asked for, and your consent to share a
> delivery address when you accept a gift.
>
> **Your controls.** You can decline any gift; if you decline, no address is shared and the
> sender is refunded. You can request correction or deletion of stored delivery details in line
> with our data-rights process.
>
> **Note on location.** Your app location (used for matching and, if you opt in, live sharing) is
> **never** used as a delivery address. Delivery always uses the postal address you type in.

---

## C. DPDP (2023) alignment checklist — for counsel

For **each** feature above, confirm the notice + flow satisfy:
- [ ] **Itemised notice** at/before collection: what personal data, the specific purpose, and how
      to withdraw consent and complain (DPDP §5).
- [ ] **Free, specific, informed, unambiguous, opt-in consent** with a clear affirmative action
      (both features are opt-in; live sharing needs consent from **both** people).
- [ ] **Withdrawal of consent is as easy as giving it** (Stop sharing / Decline / block-unmatch).
- [ ] **Purpose limitation** — data used only for the stated purpose (matching/delivery/safety),
      not repurposed for ads or profiling.
- [ ] **Data minimisation & retention** — live location kept only as the latest point and deleted
      on stop/expiry; delivery address kept only as long as needed to fulfil + statutory records.
- [ ] **Disclosure of processors/recipients** — the safety team (live location) and the
      fulfilling partner/courier (delivery address) are named as recipients.
- [ ] **Grievance Officer** contact published and reachable; response timelines met.
- [ ] **Children** — if anyone under 18 could use the app, DPDP requires verifiable parental
      consent and bars behavioural tracking/targeted ads; confirm your age-gating covers this
      before enabling location sharing.
- [ ] **Erasure on account deletion** — confirmed for both (share records + delivery details).
- [ ] **Security safeguards** documented (encryption in transit, access controls, breach process).

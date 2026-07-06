# 02 — Data Model

Every collection in MongoDB, what it stores, why, and how it links.

---

## Collection: `users`

The core user document. One per registered account.

```json
{
  "_id": "ObjectId",
  "phone": "+919876543210",
  "phoneVerified": true,
  "email": "user@example.com",
  "emailVerified": true,
  "createdAt": "2026-05-11T10:00:00Z",
  "lastActiveAt": "2026-05-11T18:30:00Z",
  
  "profile": {
    "firstName": "Arjun",
    "displayName": "Arjun K.",
    "gender": "male",
    "dob": "1997-08-15",
    "age": 28,
    "city": "Dibrugarh",
    "state": "Assam",
    "country": "IN",
    "languages": ["assamese", "hindi", "english"],
    "bio": "Mechanical engineer who hikes too much.",
    "photos": [
      { "url": "r2://users/abc123/photos/1.jpg", "isPrimary": true, "uploadedAt": "..." },
      { "url": "r2://users/abc123/photos/2.jpg", "isPrimary": false }
    ]
  },
  
  "intent": ["dating", "friendship"],
  
  "claims": {
    "profession": { "title": "Mechanical Engineer", "company": "Tata Motors", "verified": true, "verificationId": "ObjectId" },
    "education": { "degree": "B.Tech Mechanical", "institution": "IIT Guwahati", "year": 2020, "verified": true, "verificationId": "ObjectId" },
    "income": { "annualINR": 1800000, "verified": false },
    "religion": { "value": "hindu", "verified": false },
    "height": { "cm": 178 }
  },
  
  "astrology": {
    "birthDate": "1997-08-15",
    "birthTime": "06:42",
    "birthPlace": { "city": "Dibrugarh", "state": "Assam", "lat": 27.4728, "lng": 94.9120 },
    "sunSign": "leo",
    "moonSign": "vrishabha",
    "rashi": "vrishabha",
    "nakshatra": "rohini",
    "mangalDosha": false,
    "computedAt": "2026-01-15T..."
  },
  
  "verification": {
    "level": "fully_verified",
    "idVerified": true,
    "idType": "aadhaar",
    "idVerifiedAt": "2026-01-15T...",
    "selfieVerified": true,
    "professionVerified": true,
    "educationVerified": true,
    "incomeVerified": false,
    "trustScore": 92
  },
  
  "membership": {
    "joinFeePaid": true,
    "joinFeeAmountUSD": 1,
    "joinFeeAmountINR": 83,
    "joinFeePaymentId": "pay_M4xxx",
    "paidAt": "2026-01-15T...",
    "tier": "free"
  },
  
  "preferences": {
    "interestedInGenders": ["female"],
    "ageRange": { "min": 24, "max": 32 },
    "maxDistanceKm": 50,
    "intentFilter": ["dating", "marriage"],
    "anonymousModeEnabled": false,
    "showProfessionToOthers": true,
    "showAstrologyToOthers": true,
    "allowNSFWChats": true
  },
  
  "settings": {
    "notifications": { "newMatches": true, "messages": true, "verifications": true },
    "language": "en",
    "incognito": false
  },
  
  "status": {
    "active": true,
    "suspended": false,
    "banned": false,
    "deletedAt": null
  }
}
```

**Indexes:**
- `phone` (unique)
- `email` (unique sparse)
- `profile.city + profile.gender + status.active` (compound, for discover queries)
- `verification.trustScore` (for sorting matches by trust)

---

## Collection: `verifications`

Every verification request, ever. Audit trail.

```json
{
  "_id": "ObjectId",
  "userId": "ObjectId",
  "type": "profession",
  "claim": {
    "title": "Mechanical Engineer",
    "company": "Tata Motors",
    "startDate": "2020-07-01"
  },
  "documents": [
    { "type": "offer_letter", "url": "r2://verification/abc123/profession/offer.pdf", "uploadedAt": "..." },
    { "type": "company_id", "url": "r2://verification/abc123/profession/id.jpg", "uploadedAt": "..." },
    { "type": "linkedin_link", "value": "https://linkedin.com/in/arjunk", "uploadedAt": "..." }
  ],
  "status": "approved",
  "submittedAt": "2026-01-12T...",
  "reviewedAt": "2026-01-14T...",
  "reviewedBy": "moderator_id_or_system",
  "reviewMethod": "manual",
  "rejectionReason": null,
  "expiresAt": "2027-01-12T..."
}
```

**Verification types:**
- `id` — Aadhaar/PAN/DL via DigiLocker (automated)
- `selfie` — face match against ID photo (automated, ~99% accurate)
- `profession` — degree + employer letter + LinkedIn (manual, ~24h SLA)
- `education` — degree certificate (DigiLocker if available, else manual)
- `income` — IT return or salary slip (manual, optional, premium)
- `medical_license` — for doctors, cross-checked against NMC public registry
- `bar_license` — for lawyers, against Bar Council registry

**Indexes:** `userId`, `status`, `type + status` (for moderator queue).

---

## Collection: `chats`

One document per conversation between two users.

```json
{
  "_id": "ObjectId",
  "participants": ["userId_A", "userId_B"],
  "createdAt": "2026-05-01T...",
  "lastMessageAt": "2026-05-11T...",
  "messageCount": 47,
  
  "anonymity": {
    "isAnonymous": true,
    "userA_revealed": false,
    "userB_revealed": false,
    "revealedAt": null
  },
  
  "intent": "casual",
  
  "status": "active",
  
  "moderation": {
    "flaggedMessages": 0,
    "lastFlagReviewedAt": null,
    "isNSFW": true
  },
  
  "engagement": {
    "balanceScore": 0.87,
    "avgResponseTimeMinutes": 12,
    "deepConversationFlag": false,
    "lastComputedAt": "2026-05-11T..."
  },
  
  "deletedBy": []
}
```

**Indexes:** `participants` (multikey), `lastMessageAt` (for sorting).

---

## Collection: `messages`

One document per message. Sharded by `chatId` for scale.

```json
{
  "_id": "ObjectId",
  "chatId": "ObjectId",
  "from": "userId",
  "to": "userId",
  "text": "Hey! Saw you also did the Hampta Pass — how was it?",
  "type": "text",
  "createdAt": "2026-05-11T18:30:00Z",
  "readAt": "2026-05-11T18:32:00Z",
  
  "attachments": [],
  
  "moderation": {
    "flagged": false,
    "flagReason": null,
    "containsNSFW": false,
    "containsPII": false,
    "moderatedAt": null
  },
  
  "behaviorSignals": {
    "sentiment": "positive",
    "respectScore": 9.2,
    "analyzedAt": "2026-05-11T18:30:05Z"
  },
  
  "deleted": false
}
```

**Indexes:**
- `chatId + createdAt` (for fetching chat history)
- `from` (for behavior analysis batches)
- `moderation.flagged` (for moderator queue)

**Storage tip:** for >1M messages, enable MongoDB time-series collections or shard by `chatId`.

---

## Collection: `reputation`

Derived behavioral profile per user. Updated continuously.

```json
{
  "_id": "ObjectId",
  "userId": "ObjectId",
  "lastUpdatedAt": "2026-05-11T...",
  "basedOnChats": 24,
  "basedOnMessages": 312,
  
  "scores": {
    "respect": 8.9,
    "responsive": 8.4,
    "depth": 8.7,
    "humor": 7.9,
    "directness": 7.2
  },
  
  "grades": {
    "conversation": "A",
    "boundaries": "A",
    "honesty": "A",
    "warmth": "A-"
  },
  
  "tagsPositive": [
    { "tag": "thoughtful", "count": 18, "lastSeenAt": "..." },
    { "tag": "curious", "count": 14, "lastSeenAt": "..." },
    { "tag": "patient", "count": 9, "lastSeenAt": "..." }
  ],
  "tagsNegative": [],
  
  "userRatings": {
    "totalRatingsGiven": 8,
    "averageStars": 4.6
  },
  
  "redFlags": {
    "ghostingIncidents": 0,
    "blockedByOthers": 0,
    "reportsAgainst": 0
  },
  
  "trustScore": 92
}
```

**Why three formats (scores, grades, tags)?** They serve different audiences:
- Scores: numeric, scannable, comparable
- Grades: letter-based, instantly readable, less precise (good for casual users)
- Tags: descriptive, human, can convey nuance numbers can't

**Indexes:** `userId` (unique), `trustScore` (for sorting in discover).

---

## Collection: `compatibility`

Cached match score per user pair. Computed on demand, refreshed every 30 days.

```json
{
  "_id": "ObjectId",
  "userPair": ["userId_A_lt_userId_B"],
  "computedAt": "2026-05-11T...",
  "expiresAt": "2026-06-10T...",
  
  "astrology": {
    "system": "vedic",
    "gunaScore": 28,
    "gunaMax": 36,
    "gunaPercent": 78,
    "mangalCompatible": true,
    "moonSignCompatible": true,
    "verdict": "Strong match",
    "computedVia": "prokerala_api",
    "apiResponseId": "pk_abc123"
  },
  
  "engagement": {
    "messagesExchanged": 47,
    "balanceScore": 87,
    "responseTimeMatch": 0.82,
    "humorAlignment": 0.91,
    "depthAlignment": 0.76,
    "overallScore": 84
  },
  
  "overall": 82
}
```

**Indexes:** `userPair` (unique compound), `expiresAt` (for cache invalidation).

---

## Collection: `payments`

Every Razorpay transaction.

```json
{
  "_id": "ObjectId",
  "userId": "ObjectId",
  "purpose": "join_fee",
  "amountINR": 83,
  "amountUSD": 1,
  "razorpayOrderId": "order_M4xxx",
  "razorpayPaymentId": "pay_M4xxx",
  "razorpaySignature": "abc...",
  "status": "captured",
  "method": "upi",
  "createdAt": "2026-01-15T...",
  "capturedAt": "2026-01-15T...",
  "refundedAt": null,
  "metadata": { "gender": "male" }
}
```

**Critical:** verify `razorpaySignature` server-side using HMAC SHA256 with your webhook secret. Never trust the client.

**Indexes:** `userId`, `razorpayPaymentId` (unique), `status`.

---

## Collection: `reports`

User-submitted abuse reports.

```json
{
  "_id": "ObjectId",
  "reporterId": "ObjectId",
  "reportedUserId": "ObjectId",
  "chatId": "ObjectId",
  "messageIds": ["ObjectId"],
  "category": "harassment",
  "description": "Sent unsolicited explicit photos.",
  "createdAt": "2026-05-11T...",
  "status": "pending",
  "reviewedAt": null,
  "reviewedBy": null,
  "action": null
}
```

**Categories:** harassment, fake_profile, scam, underage, hate_speech, non_consensual_image, other.

**Actions:** warning, suspend_24h, suspend_7d, ban_permanent, no_action.

**SLA: must be reviewed within 24 hours per IT Rules 2021.**

---

## Collection: `audit_log`

Every sensitive action — for compliance and debugging.

```json
{
  "_id": "ObjectId",
  "userId": "ObjectId",
  "action": "verification.profession.approved",
  "performedBy": "moderator_id",
  "timestamp": "2026-05-11T...",
  "ip": "103.21.244.x",
  "userAgent": "...",
  "metadata": { "verificationId": "..." }
}
```

**Always log:**
- Verifications (submit, approve, reject)
- Identity reveals in anonymous chats
- Payments
- Profile deletions
- Moderation actions
- Login from new device

---

## How everything links

```
users ──┐
        ├── verifications (1:N — every verification request)
        ├── reputation (1:1 — derived behavioral profile)
        ├── payments (1:N)
        └── chats (N:N — via participants array)
                ├── messages (1:N)
                └── compatibility (1:1 cached match)
```

**Key principle:** never duplicate user data into other collections. Always reference by `userId`. Use MongoDB's `$lookup` (aggregation join) when assembling profile views.

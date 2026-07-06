# 03 — Verification Flow

Every claim a user makes must be verifiable. This is your core differentiator.

---

## Verification levels

A user's `verification.level` field is one of:

| Level | What's verified | Discover badge |
|-------|-----------------|----------------|
| `phone_only` | Just phone number | (none) |
| `id_verified` | Government ID + selfie match | "ID verified" |
| `profession_verified` | + profession | "Verified" |
| `fully_verified` | + education + income (optional) | "Fully verified" gold badge |

**Rule:** users cannot start chatting until at least `id_verified`. They cannot pay the join fee until `id_verified` either — this prevents bots from clogging the payment system.

---

## Step-by-step verification process

### Step 1: Phone OTP (during signup)
- Firebase Auth handles this
- 6-digit OTP via SMS
- Mark `users.phoneVerified = true`

### Step 2: Government ID verification (mandatory)

Two options:

**Option A: DigiLocker (recommended)**
- User authorizes DigiLocker via OAuth
- You receive verified Aadhaar/PAN/DL data signed by govt
- No need to store the ID number itself — just a verification token
- Cost: free
- UX: ~30 seconds, works for ~80% of users (DigiLocker adoption is growing)

**Option B: ID upload + selfie (fallback)**
- User uploads photo of Aadhaar/PAN/DL
- User takes a selfie
- Use Hyperverge or Karza API to:
  - Extract data from ID (OCR)
  - Match face on ID with selfie (>95% match required)
  - Check ID for tampering
- Cost: ₹3-10 per verification
- UX: ~2 minutes

**Storage:**
- DO NOT store the Aadhaar number itself (huge legal liability)
- Store only: verification token, document type, verified name + DOB, verification timestamp
- Original ID images: encrypt and store in R2 with `verification/` prefix; auto-delete after 30 days

### Step 3: Selfie liveness (mandatory)
- Even with DigiLocker, do a separate liveness check
- User holds phone, follows prompts ("turn left", "blink")
- Hyperverge or AWS Rekognition can do this
- Prevents someone using stolen ID + photo

### Step 4: Profession verification (mandatory before chat unlock)

This is the hardest part. Build a hybrid system:

**Tier A — Auto-verifiable professions:**
- **Doctor** → check NMC India registration number against public registry (free)
- **Lawyer** → check Bar Council of India registration (free)
- **CA** → check ICAI member directory (free)
- **CS** → check ICSI directory
- **Architect** → Council of Architecture registry

For these, user enters their registration number, you call the public API, done in seconds.

**Tier B — Document review (manual queue):**

For software engineers, designers, students, business owners, etc., user must upload:

Required:
- Latest offer letter / appointment letter (PDF or image)
- Company ID card photo
- LinkedIn profile URL

Optional bonus:
- Salary slip (last 3 months)
- Email verification from corporate domain (e.g., user@razorpay.com)

You build a simple admin panel where moderators review these in <24 hours. Approve / reject / request more info.

**Cost of manual review:** at scale, hire 2 part-time reviewers @ ₹15,000/month = ₹30,000/month. Each can review ~150 verifications/day.

**Tier C — Self-employed / business owners:**
- GST certificate
- Udyam (MSME) registration
- Business registration certificate
- Latest IT return

### Step 5: Education verification (optional, premium)
- DigiLocker can pull degrees from many Indian universities
- For others: upload degree certificate, manual review
- Many users skip this — make it optional

### Step 6: Income verification (optional, premium)
- Latest IT return PDF (acknowledgement is enough)
- Or 3 months salary slips
- Manual review
- Useful for marriage-intent users; usually skipped by dating-intent users

---

## What happens after verification

1. `users.verification.level` is updated
2. `users.verification.{type}Verified` flags set to true
3. `users.claims.{type}.verified = true`
4. Verification document stored in `verifications` collection (audit trail)
5. User receives notification: "Your profession is verified"
6. Trust score recomputed and stored on user

---

## Trust score calculation

Stored on `users.verification.trustScore` (0-100).

```
score = 0
if phoneVerified: score += 10
if idVerified: score += 30
if selfieVerified: score += 15
if professionVerified: score += 20
if educationVerified: score += 10
if incomeVerified: score += 10
if hasNoReports && accountAge > 30days: score += 5
```

Maximum 100. Show as a badge in discover ("92% trust score") and use as a tiebreaker in match ranking.

---

## Verification re-checks

Some verifications expire:
- **Profession** — re-verify every 12 months (people change jobs)
- **Income** — re-verify every 12 months
- **ID** — never expires unless ID was renewed
- **Education** — never expires

Build a cron job that finds expiring verifications and prompts users 30 days before expiry.

---

## Handling rejections

If a verification is rejected:
- User sees the reason (e.g., "Offer letter unclear, please re-upload")
- Account is not penalized
- They can retry up to 3 times per type
- After 3 rejections, escalate to senior moderator

---

## Edge cases to handle

- **Same ID, multiple accounts** → flag as duplicate, manual review
- **ID belongs to someone else** → ban + notify the actual ID holder
- **Profession verified but user changes job** → user must re-submit; old verification stays "valid until expiry"
- **Profession verification but user lied about role/seniority** → only the title is verified, not seniority. Make this clear in your ToS.

---

## What NOT to verify

- Hobbies / interests — let users self-declare
- Personality traits — that's what reputation is for
- Religion / caste — collect optionally; don't verify (too sensitive)
- Sexual orientation — never verify, never share without consent

---

## UI flow for the user

```
Signup
  ↓
Phone OTP
  ↓
Add basic profile (name, gender, DOB, city, languages)
  ↓
[Discover is locked — must verify to continue]
  ↓
ID verification (DigiLocker preferred, ~30 seconds)
  ↓
Selfie liveness (~30 seconds)
  ↓
Profession claim + document upload (~2 minutes)
  ↓
[While profession is in review queue]
  ↓
Pay join fee ($1 boys / $5 girls) via Razorpay
  ↓
Pick intent (marriage / dating / casual / friendship)
  ↓
Add bio, photos, astrology details
  ↓
[Within 24 hours, profession verified]
  ↓
Discover unlocked
```

**Why pay before profession is verified?** Because the friction of paying filters out non-serious signups. Profession verification still happens before they can chat.

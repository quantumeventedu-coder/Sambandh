# 05 — Storage Strategy

What goes where, and why.

---

## The four storage layers

### 1. MongoDB (primary database)
For all structured data that is queried frequently.

| Collection | Approx size per record | Total size at 10K users | Total size at 100K users |
|------------|------------------------|--------------------------|---------------------------|
| `users` | ~5 KB | 50 MB | 500 MB |
| `verifications` | ~2 KB | 80 MB (8 per user) | 800 MB |
| `chats` | ~1 KB | 20 MB | 200 MB |
| `messages` | ~500 B | 5 GB (1000 per user) | 50 GB |
| `reputation` | ~3 KB | 30 MB | 300 MB |
| `compatibility` | ~2 KB | 200 MB (cached pairs) | 2 GB |
| `payments` | ~1 KB | 10 MB | 100 MB |
| `reports` | ~1 KB | 1 MB | 10 MB |
| `audit_log` | ~500 B | 500 MB | 5 GB |

**Total at 100K users: ~58 GB.** MongoDB Atlas M30 cluster (~$60/month) handles this comfortably.

**Backup:** Atlas auto-snapshots every 6 hours, retained 7 days, with point-in-time recovery. Enable from day 1.

**Region:** Mumbai (ap-south-1) for low latency.

---

### 2. Cloudflare R2 (object storage)
For binary files: photos, ID documents, voice notes (V2).

**Folder structure:**

```
users/
  {userId}/
    photos/
      1.jpg              ← primary profile photo
      2.jpg
      3.jpg
    voice/
      intro.mp3          ← V2 feature
verification/
  {userId}/
    id/
      aadhaar_2026-01-15.pdf       ← encrypted, auto-delete after 30 days
      selfie_2026-01-15.jpg
    profession/
      offer_letter_2026-01-15.pdf
      company_id_2026-01-15.jpg
    education/
      degree_2026-01-15.pdf
moderation/
  reports/
    {reportId}/
      screenshot_1.png   ← evidence uploaded by reporter
```

**Image processing:**
- All uploaded photos resized to 3 sizes: thumbnail (150x150), medium (640px wide), full (1280px wide)
- Use Cloudflare Images for on-the-fly transforms, or process server-side with `sharp` (Node library)
- Strip EXIF metadata (removes GPS coordinates from photos — privacy critical)
- Convert to WebP for ~30% smaller files

**Cost estimate (100K users, 5 photos each):**
- 500K photos × 200KB avg = 100 GB
- R2 storage: $0.015/GB/month = **$1.50/month**
- R2 egress: free (this is R2's killer feature vs S3)

**ID documents:**
- Encrypt with AES-256 before upload (use a per-document key, store the key in MongoDB)
- Auto-delete after 30 days (you only need the verification result, not the original document)
- Cloudflare R2 lifecycle rules can do this automatically

---

### 3. Redis (caching + sessions, V2)

Don't add Redis until you hit ~5K DAU. When you do, use it for:
- Session tokens (faster than DB lookup on every request)
- Discover feed cache (recompute every 6h, not every request)
- Rate limiting (X messages per minute per user)
- Real-time presence ("user online")

Hosted Redis: Upstash (~$10/month for small workloads).

---

### 4. Logs and analytics

**Application logs** → Vercel + Railway built-in (free up to a quota), or pipe to BetterStack ($25/month) for searchability.

**Analytics events** (signups, matches, messages sent) → PostHog (free up to 1M events/month, EU-hosted).

**Error tracking** → Sentry (free tier covers 5K errors/month).

---

## Critical: what NEVER gets stored

- Aadhaar numbers (verify via DigiLocker, store only the verification token)
- Bank account details (Razorpay handles this; you never see card numbers)
- Plaintext passwords (use bcrypt — Firebase Auth handles for you)
- Chat content unencrypted (consider encryption at rest in MongoDB; Atlas does this by default at the storage level)
- Location coordinates more precise than city (don't store lat/lng of users; store city + state only)

---

## Data retention policy

Build this in from day 1; it's a legal requirement under DPDP Act 2023:

| Data type | Retention period | Auto-delete? |
|-----------|------------------|---------------|
| User account (active) | While active | No |
| User account (deleted by user) | 30 days (then purged) | Yes |
| Chat messages (active accounts) | Indefinite (or until user deletes) | No |
| Chat messages (deleted account) | 30 days | Yes |
| Verification documents (originals) | 30 days from approval | Yes |
| Verification records (metadata) | 7 years (audit/compliance) | No |
| Payment records | 7 years (tax compliance) | No |
| Audit logs | 3 years | Yes (after 3y) |
| IP addresses in audit logs | 90 days, then anonymized | Yes |

Build a daily cron job that runs cleanup based on these rules.

---

## Backup strategy

| Layer | Backup frequency | Retention | Tool |
|-------|------------------|-----------|------|
| MongoDB | Every 6 hours | 7 days | Atlas built-in |
| R2 photos | Replicated automatically | Forever | R2 built-in |
| R2 verification docs | Replicated, then auto-deleted at 30d | N/A | R2 lifecycle |
| Application code | On every push | Forever | GitHub |
| Razorpay records | Razorpay keeps these | 10 years | Razorpay built-in |

**Do a test restore every quarter.** Backups you've never restored are wishes, not backups.

---

## Compliance note

Under India's DPDP Act 2023:
- Users must be able to download all their data ("right to access")
- Users must be able to delete their account ("right to erasure")
- You must appoint a Data Protection Officer if processing data of >500 users
- Cross-border data transfer requires user consent (so keep data in India)

Build the data export endpoint (`GET /api/me/data-export`) early. Returns a ZIP with JSON of all the user's data. This is legally required and saves you from frantic late-night code at scale.

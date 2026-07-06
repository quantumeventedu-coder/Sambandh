# 06 — Security Checklist

A dating app is a high-value target. Get these right before public launch.

---

## Legal & compliance (do FIRST)

- [ ] Register Pvt Ltd company in India
- [ ] Get GST registration if revenue >₹20 lakh/year (you will hit this)
- [ ] Appoint a Grievance Officer (legally required, name + email on website)
- [ ] Appoint a Data Protection Officer (if processing >500 users' data)
- [ ] Draft Terms of Service — get a lawyer; don't copy from another app
- [ ] Draft Privacy Policy — must comply with DPDP Act 2023
- [ ] Cookie policy + consent banner
- [ ] Refund policy (visible at checkout)
- [ ] Age verification: 18+ enforced via ID
- [ ] Take-down policy for non-consensual intimate imagery (24h SLA per IT Rules 2021)

---

## Authentication & accounts

- [ ] Phone OTP via Firebase (no rolling your own SMS)
- [ ] Bcrypt or Argon2 for any passwords (Firebase handles this)
- [ ] Rate limit OTP requests (3 per phone per hour)
- [ ] Lockout after 5 failed login attempts
- [ ] Email verification before showing email-based features
- [ ] 2FA optional for users (V2)
- [ ] Session tokens expire after 30 days of inactivity
- [ ] Logout from all devices feature

---

## Data protection

- [ ] All API endpoints behind HTTPS only (Cloudflare auto-handles)
- [ ] Database connection over TLS only
- [ ] Encryption at rest in MongoDB Atlas (default)
- [ ] R2 storage encryption at rest (default)
- [ ] AES-256 encrypt verification docs before R2 upload
- [ ] Strip EXIF (GPS coords) from all uploaded photos
- [ ] Never log PII (passwords, OTPs, full Aadhaar) in application logs
- [ ] Rotate API keys / secrets every 90 days
- [ ] Use Vault, AWS Secrets Manager, or 1Password for secrets — NOT .env in git

---

## API security

- [ ] Rate limit every endpoint (express-rate-limit)
  - Auth endpoints: 5/min per IP
  - Discover: 30/min per user
  - Send message: 60/min per user
  - Verification submit: 3/day per user
- [ ] CORS locked down to your domain only
- [ ] Validate all input with Zod or Joi (no raw `req.body` access)
- [ ] Sanitize MongoDB queries (`mongoose` does this; raw `MongoClient` doesn't)
- [ ] Authorization checks on EVERY endpoint (not just authentication)
  - "User A can only edit User A's profile" — easy to forget
- [ ] CSRF tokens on state-changing requests
- [ ] Helmet.js for security headers

---

## Payment security

- [ ] Always verify Razorpay signature server-side
- [ ] Never trust client-sent amount; compute server-side
- [ ] Idempotency: same `razorpayPaymentId` can never be processed twice
- [ ] Webhooks must verify signature
- [ ] Test mode keys in dev; production keys ONLY in production env
- [ ] PCI compliance: don't touch card data; let Razorpay's iframe handle it

---

## Chat & content security

- [ ] Filter messages for:
  - Phone numbers / email (block by default; warn user it's risky)
  - URLs (sanitize, block known scam domains)
  - CSAM detection (use PhotoDNA — free for legitimate platforms)
  - NSFW detection in images (AWS Rekognition or Sightengine; cost ~₹0.10 per image)
- [ ] Allow user to report any message with one tap
- [ ] Reported content immediately hidden from reporter; queued for moderation
- [ ] 24-hour SLA on moderation queue (legally required)
- [ ] Block + mute features (user-initiated, instant)
- [ ] Cooldown after blocked: blocker is invisible to blocked user permanently

---

## Anti-abuse

- [ ] One account per phone number
- [ ] One account per ID (DigiLocker token)
- [ ] Detect and ban shared accounts (multiple devices, multiple cities, fast)
- [ ] Shadow-ban repeat offenders (ban without telling them — they keep messaging into the void)
- [ ] Auto-flag patterns: identical messages to many users (spam), explicit content sent before consent
- [ ] Honeypot accounts (you create fake female accounts; flag any user who messages them aggressively)

---

## Privacy controls (user-facing)

- [ ] Incognito mode (hide profile from specific contacts/networks)
- [ ] Block list management
- [ ] Delete account (full erasure within 30 days)
- [ ] Download my data (JSON export, legally required)
- [ ] Pause account (hide profile temporarily without deleting)
- [ ] Photo visibility controls (some photos visible only after match)

---

## Operational security

- [ ] All admin actions logged in `audit_log`
- [ ] Admin panel requires 2FA
- [ ] Admin panel IP-restricted (only office / VPN)
- [ ] Code reviews required for any auth/payment changes
- [ ] Penetration test before public launch (~₹50K from a reputable firm)
- [ ] Bug bounty program (HackerOne or Bugcrowd) once you're past 10K users
- [ ] Status page for transparency (statuspage.io)

---

## Monitoring & alerts

- [ ] Sentry for application errors (alert on >10 errors/min)
- [ ] Uptime monitoring (BetterUptime, every 1 min)
- [ ] Alert on: failed payments spike, signup spike (botnet?), report queue >50 pending
- [ ] Daily moderation dashboard email at 9 AM IST
- [ ] Weekly metrics: gender ratio, retention, revenue, complaints

---

## Disaster recovery

- [ ] MongoDB point-in-time recovery enabled
- [ ] R2 cross-region replication enabled
- [ ] Runbook documented for: database down, payment provider down, R2 down
- [ ] Quarterly restore test (actually restore a backup to staging)
- [ ] Have a fallback "service unavailable" static page on Cloudflare

---

## What to do on day of launch

1. Switch Razorpay to live mode keys
2. Switch DigiLocker to production
3. Verify webhook endpoints from public internet
4. Test full signup → verify → pay → chat flow with a real phone
5. Have a kill switch: an env var that puts the app in maintenance mode
6. Watch error logs and gender ratio for first 48 hours obsessively
7. Have moderators standing by for the first 7 days

---

## What to do if you're hacked

1. Don't panic. Don't lie.
2. Take the affected service offline if needed
3. Notify CERT-In within 6 hours (legally required)
4. Notify affected users within 72 hours (DPDP Act)
5. Hire an incident response firm if you don't have expertise
6. Postmortem publicly within 30 days

The damage from being hacked is recoverable. The damage from being caught lying about it is not.

# 07 — The Karma Book

## What it is

The Karma Book is Sambandh's truth ledger. It's the single feature that makes the platform meaningfully different from every other dating app — it catches lies and manipulation without exposing private chats.

Every user has one. It tracks:

1. **Lies** — claims that contradict verifiable platform reality (e.g., "I'm new here" when account is 8 months old)
2. **Contradictions** — statements that contradict the user's own previous statements on the platform
3. **Manipulation flags** — patterns like love-bombing, off-platform redirects, gaslighting
4. **Fraud flags** — gang patterns: device clusters, scripted messages, money requests
5. **Activity signals** — public transparency metrics (active chats, exclusivity claims count)

---

## The trust contract with users

Every user agrees to this on signup, in plain language:

> Your private messages stay private. We do not let humans read your chats. But our system reads them to check if you tell the truth on this platform. If you say "you're the only one I'm talking to" while juggling six chats — we'll know, and the next person you say it to will see a warning that this person has made similar claims to others. We won't show what you said. We won't show who you said it to. We'll only show that you're saying it a lot.

Saying this clearly upfront is what makes the system ethical instead of creepy. Hiding it makes it surveillance. Stating it makes it accountability.

---

## How signals are surfaced — the four-tier system

| Tier | When shown | Who sees it | What's shown |
|------|------------|-------------|--------------|
| 1. Private warning | First offense | Only the user themselves | "We noticed you said X. Heads up — repeat patterns become visible to your matches." |
| 2. Profile flag (typed) | After repeated patterns | Anyone viewing profile | "This user has made exclusivity claims to multiple recent matches" |
| 3. Profile flag (with line) | Paid escalation only | Single requester, anonymized | The actual statement, with recipient anonymized |
| 4. Account review | Critical fraud signals | Internal moderation team | Full context, full chat access, full audit |

**Tier 1 is critical.** First-time honest mistakes don't get punished. Only patterns do. People are allowed to grow and change.

---

## Score mechanics

Every user starts at **100**. Score only goes down from documented violations. Score recovers slowly with consistent honest behavior — about +1 per month of clean activity.

| Event | Score impact |
|-------|--------------|
| Low-severity lie | -2 |
| Medium-severity lie | -5 |
| High-severity lie (e.g., faked exclusivity) | -10 |
| Low contradiction | -3 |
| Medium contradiction | -7 |
| High contradiction | -15 |
| Manipulation pattern (high confidence) | -25 |
| Critical fraud signal | -100 (account suspended for review) |

**Score → grade:**
- 95–100: A+ (gold halo on profile)
- 90–94: A
- 85–89: A-
- 80–84: B+
- 70–79: B
- 60–69: C (caution shown to matches)
- 40–59: D (clear warning shown)
- 0–39: F (account hidden from discover)

---

## Activity signals (always public)

These are NOT punitive — they're transparent signals that help users make decisions. Every profile shows:

- Currently active in **N** conversations
- Started **N** new chats in the last 7 days
- Has used the word "exclusive" with **N** different people in 30 days
- Has made strong emotional declarations to **N** different people in 30 days
- Average response time

These signals do not lower the score. They simply tell potential matches: "this person is shopping around, plan accordingly." A user being honest about juggling is fine. A user lying about it gets caught by the contradiction detector.

---

## Paid escalation — the ₹49 / ₹99 reveal

> **⚠️ Superseded (July 2026):** escalation prices are now **CHF 0.50 / CHF 1**
> (see `src/routes-payment.js`). The ₹ figures below are the original design
> rationale, kept for historical context.

If a user sees a flag on someone's profile and wants the actual evidence, they can pay to escalate:

- **₹49** — see the actual statements behind exclusivity / love-bombing flags (recipients fully anonymized)
- **₹99** — see manipulation pattern evidence (specific message lines)
- **Free** — fraud alerts (we want everyone to see these)

Safeguards:
- Max 3 escalations per user per 24 hours (prevents stalking)
- Mandatory 1-hour cooling-off between escalations against the same target
- The user being escalated against gets a notification that *someone* paid to look deeper at their flags (not who, not what)
- Escalations themselves are logged in the audit trail
- Anyone abusing escalation (escalating against the same person daily) gets escalation privileges revoked

Why charge for it: friction prevents abuse. Free reveals would be used to dox exes. ₹49 is enough to discourage casual cruelty but not enough to protect liars from genuinely concerned matches.

---

## What the Karma Book never does

- Never reveals sexual history or virginity status (impossible and harmful, see docs/06)
- Never reveals what happened in private life off-platform
- Never lets one user read another user's chats
- Never shows the *recipient* of a flagged statement, even on paid escalation
- Never bans someone purely from automated flags — bans require human moderator review
- Never shows physical/biological details
- Never shares data with third parties

---

## Worked example

**Day 1:** Rohit signs up. Karma score: 100. Tells Priya "I'm only chatting with you." This is true — it's his first conversation. No flag.

**Day 5:** Rohit starts chats with 4 more women. Tells Anjali "you're the only one I feel this way about." System checks: he has 5 active chats this week. Flag triggered. Score drops to 93. Rohit gets a private notification: *"You said 'you're the only one' to Anjali, but you have 4 other active chats this week. This is your first warning — your matches won't see this yet."*

**Day 12:** Rohit again says "only you" to a sixth person. Score drops to 86 (B+). Now appears on his profile: *"Has told 3 different people they were exclusive within the last 30 days."* No quotes shown publicly.

**Day 13:** A new match, Nisha, sees the flag. She's curious. Pays ₹49 to escalate. Sees: *"'you're the only one I feel this way about' — said to a different person, 8 days ago"* and two similar lines. Recipients all anonymized. Rohit gets a notification: *"Someone paid to see deeper into your Karma flags. They remain anonymous to you."*

**Day 14:** Rohit calms down, sticks to two chats. Over the next 60 days no new flags accumulate. Score recovers to 90.

This is the system working. He wasn't banned. He wasn't shamed. He was given a chance to correct, then his pattern was made visible, then he course-corrected, then his reputation healed.

---

## Edge cases and how to handle them

| Scenario | Handling |
|----------|----------|
| User legitimately changes their mind ("I want marriage" → "I want casual" 6 months later) | Not flagged — the conflict detector ignores statements >60 days apart for non-identity claims |
| User says "I love you" to two different people 5 months apart | Not flagged — same time-window rule |
| User claims a job they don't have verified | Low-severity flag, profile shows "claim unverified" |
| LLM false-positive flag | User can dispute via support; if cleared, score restored, audit logged |
| Someone reports being scammed | Manual review opens; if substantiated, target's Karma drops sharply and account reviewed |
| Coordinated brigading (5 people falsely report someone) | Detected via cross-checking reporter relationships; brigade gets karma hit themselves |

---

## What still needs human moderators

Automated systems can't do everything. Sambandh needs ~2 part-time moderators (₹15-25K/month each) to handle:

1. Reviewing every account flagged with critical fraud signals (within 24h)
2. Adjudicating user disputes about their Karma flags
3. Handling reports of harassment, NCII, threats
4. Investigating suspected fraud rings flagged by the device-clustering algorithm
5. Approving the manual profession verifications from docs/03

The Karma Book reduces moderator workload by ~80% compared to a manual-only system. The remaining 20% is the part where human judgment is irreplaceable.

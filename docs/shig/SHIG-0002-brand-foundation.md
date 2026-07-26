# Specification ID

SHIG-0002

# Specification Name

Brand Foundation Specification

# Version

1.0.0

# Status

Active

---

## 1. Purpose

**B-1** — This specification MUST serve as the permanent, implementation-independent source of brand identity for Sambandh, defining *what the brand is from a design perspective* so that every downstream SHIG specification, product surface, and design decision can be checked against a single governing definition of identity.
- *Why it exists:* Without a fixed brand foundation, expression drifts toward whatever the newest screen, campaign, or contributor prefers; identity becomes an average of accidents rather than a governed constant (Constitution C-16 consistency-over-novelty, C-17 longevity).
- *Design implication:* This document defines brand *identity* (immutable), never brand *expression* (colors, logos, type, copy campaigns — governed elsewhere and permitted to evolve, see §29).
- *Reviewer verifies:* Any brand-level dispute can be resolved by citing a B-rule here; no B-rule restates or contradicts SHIG-0000 or SHIG-0001.

**B-2** — This specification MUST NOT function as a marketing document, a logo/color guide, a slogan repository, or a growth playbook. Content whose primary purpose is persuasion, promotion, or acquisition MUST be excluded.
- *Reviewer verifies:* No sentence in this spec sells, hypes, or optimizes for conversion; every sentence constrains design.

## 2. Scope

**B-3** — This specification MUST govern all human-perceptible expressions of Sambandh brand identity across every surface (product UI, communications, notifications, onboarding, error/empty/loading states, support, documentation, and any third-party or partner surface bearing the Sambandh name), every locale, every device class, and every bandwidth tier.

**B-4** — Where any lower-tier design artifact (component library, screen, campaign, partner integration) conflicts with a B-rule, the B-rule MUST prevail, and the conflicting artifact MUST be corrected — never the reverse.

**B-5** — This specification MUST NOT redefine, weaken, reorder, or create exceptions to the Constitution Article 4 lexicographic hierarchy or immutable principles C-1..C-17. Where this spec appears to add a rule, it MUST be a *specialization* of an existing constitutional principle, and MUST cite it.

## 3. Vision

**B-6** — Sambandh's brand vision, which this spec MUST protect, is: *to be the world's most trusted relationship ecosystem — the place where human connection begins from earned trust rather than manufactured attention.*
- *Design implication:* "Most trusted" is the north star; where a design choice increases attention but does not increase (or reduces) warranted trust, the design MUST NOT ship on vision grounds. Trust here means *warranted* trust — accuracy of the user's beliefs about the system and other people — not felt confidence induced by styling.
- *Reviewer verifies:* For any flagship surface, a reviewer can name the specific trust the design earns and how; "it looks trustworthy" is not an acceptable answer (see B-38, trust-theater prohibition).

## 4. Mission

**B-7** — The brand mission this spec MUST express in design terms is: *to help people form, verify, and sustain meaningful relationships safely, honestly, and with dignity, giving each person agency over their identity, their data, and their pace.*
- *Design implication:* Every core flow MUST advance at least one of {form, verify, sustain} a relationship, and MUST NOT compromise any of {safety, honesty, dignity, agency} to do so.
- *Reviewer verifies:* A flow that cannot be mapped to the mission verbs, or that trades a mission guarantee for engagement, fails brand-mission review.

## 5. Brand DNA

**B-8** — The following four DNA strands MUST be treated as the irreducible genetic identity of Sambandh; every brand expression MUST be traceable to at least one, and MUST contradict none:
1. **Trust-before-engagement** (C-1) — connection is earned, never extracted.
2. **Honesty of signal** (C-2) — nothing shown is more certain than it truly is.
3. **Human dignity** (C-3) — every person is treated as an end, never scored by appearance or origin.
4. **Restraint as quality** (C-14) — value is shown through precision and calm, never through excess or volume.

- *Reviewer verifies:* Present any surface; a reviewer can point to the DNA strand(s) it embodies and confirm no strand is violated. A surface that embodies none is off-brand regardless of aesthetic quality.

## 6. Core Values

**B-9** — The brand's core values, in the fixed priority order below, MUST be used as the value vocabulary for all brand reasoning. This order is a specialization of Constitution Article 4 and MUST NOT be reordered: **Safety → Consent → Honesty → Dignity → Clarity → Calm → Consistency → Craft → Growth.**
- *Design implication:* Value words in any brief, critique, or rationale MUST resolve to this list; a value not on this list (e.g. "delight", "virality", "stickiness") MUST NOT override one that is.
- *Reviewer verifies:* Every recorded design tradeoff names which value won and which yielded, and the winner is never lower in this order than the loser (see §24).

## 7. Brand Philosophy

**B-10** — Sambandh's brand philosophy MUST be *relationship-first, not metric-first* (C-11): the brand exists to serve the relationship between people, and treats product metrics as instruments that may never become the goal.
- *Why it exists:* Metric-primacy is the root cause of dark patterns, manufactured urgency, and vanity engagement.
- *Design implication:* No surface may be justified solely by its effect on a business metric; it MUST also be justifiable by its effect on the user's relationship outcome and wellbeing.
- *Reviewer verifies:* Strip the metric rationale from any proposal; if no user-benefit rationale remains, it fails.

## 8. Relationship Philosophy

**B-11** — The brand MUST treat relationships as things that *develop over time at the user's pace*, and MUST design for continuity, reciprocity, and reversibility rather than for instantaneous transaction.
- *Design implication:* Pacing MUST be user-controlled; the brand MUST NOT compress relationship stages to accelerate engagement, and MUST provide graceful, non-punitive exit, pause, and slow-down at every stage (C-7 reversibility/agency).
- *Reviewer verifies:* Every stage offers a reversible action and a way to slow or stop; no stage penalizes deceleration.

## 9. Human-Centered Philosophy

**B-12** — The brand MUST treat the human as the author of their experience, not its subject: identity, data, attention, and pace belong to the person and are exercised through explicit agency.
- *Design implication:* Defaults MUST favor the human's interests over the system's; any system-favoring default MUST be justified against a higher-tier value and recorded.
- *Reviewer verifies:* For each default, ask "who does this default benefit first?"; the answer must be the user, or carry a recorded higher-tier justification.

## 10. Emotional Design Philosophy

**B-13** — The brand MUST design emotion for *steady-state wellbeing and calm* (C-6), not for arousal spikes. Emotional intensity MUST NOT be manufactured to drive action.
- *Design implication:* The brand MUST NOT use countdowns, artificial scarcity, streak-loss anxiety, intermittent-reward variability, or shame as motivators.
- *Reviewer verifies:* No surface's effectiveness depends on the user feeling anxious, deprived, competitive, or rushed.

## 11. Trust Philosophy

**B-14** — Trust MUST be *earned and evidenced*, never simulated. The brand MUST make the *basis* of trust legible (what is verified, by whom, how current, how certain) rather than asserting trustworthiness through styling, badges, or tone (C-1, C-2).
- *Design implication:* Every trust signal MUST map to a verifiable fact; unknown trust state MUST render as *unverified* (fail-secure, Constitution). Decorative trust cues without an underlying fact are prohibited (see B-38).
- *Reviewer verifies:* Each trust indicator has a named, checkable source and freshness; removing the indicator's factual basis removes the indicator.

## 12. Privacy Philosophy

**B-15** — The brand MUST be *private by default* (C-6/C-10): collect the minimum, expose the minimum, retain the minimum, and never surveil covertly. Data practices MUST be visible, scoped, and reversible.
- *Design implication:* Every data use MUST have prior, explicit, scoped, revocable consent (C-4); absence or ambiguity of consent MUST be treated as *not consented*.
- *Reviewer verifies:* For every datum shown, collected, or shared, a reviewer can point to the consent that authorized it and the control that revokes it.

## 13. Safety Philosophy

**B-16** — Safety MUST be the brand's non-negotiable first commitment (Article 4, Tier 1): safety, reporting, and exit affordances MUST be reachable, unobstructed, and never suppressed by aesthetics, engagement goals, or flow-completion pressure (C-5).
- *Design implication:* No brand or visual consideration may hide, delay, deprioritize, or add friction to a safety action; safety UI MUST remain available in degraded, offline, and low-bandwidth states.
- *Reviewer verifies:* From any surface, a user can reach block/report/exit within the platform's stated maximum path length, in every locale and device class, including error states.

## 14. Authenticity Philosophy

**B-17** — The brand MUST represent people and system state authentically: real identity claims are labeled by their verification level, and system inference is never dressed as human truth (C-2, C-12).
- *Design implication:* AI-generated, inferred, predicted, or aggregated content MUST be labeled as such and MUST NOT be presented as fact, as another person's statement, or as certainty. Assistance MUST be framed as assistance, not authority (C-12).
- *Reviewer verifies:* Every machine-produced or inferred element carries an honest provenance label; no element implies a human said/did something the system merely predicted.

## 15. Inclusivity Philosophy

**B-18** — The brand MUST be *India-first and globally inclusive simultaneously* (C-9): it MUST assume plurality of language, script, numeral system, name structure, device capability, and bandwidth as the default condition, not the edge case.
- *Design implication:* No single language, script, region, or device may be treated as the canonical user; content MUST be localizable and MUST NOT hard-code culturally specific assumptions into identity, naming, or relationship models.
- *Reviewer verifies:* Swap locale, script, numeral system, name structure, and drop to low bandwidth; identity and meaning survive intact.

**B-19** — The brand MUST NOT infer a person's character, worth, trustworthiness, compatibility, or status from appearance, complexion, caste, religion, region, language, or origin, and MUST NOT let expression encode such inference (C-3 NON-INFERENCE).
- *Reviewer verifies:* No ranking, ordering, styling, or copy treats any group as default/premium/other; no signal correlates dignity with origin or appearance.

## 16. Accessibility Philosophy

**B-20** — Accessibility MUST be treated as a brand-identity floor, not a compliance afterthought: the brand's meaning MUST be fully perceivable at or above WCAG 2.2 AA, and MUST NEVER be conveyed by color, position, or motion alone (C-8).
- *Design implication:* Every brand-carrying signal MUST have a redundant, non-color, non-motion encoding (text/shape/label); brand expression that only works for sighted, fast-motion-tolerant, high-bandwidth users is off-brand.
- *Reviewer verifies:* Disable color, disable motion, run a screen reader; brand meaning and all status/trust signals remain unambiguous.

## 17. Luxury Philosophy

**B-21** — "Premium" and "luxury" MUST be defined solely as **restraint, precision, and craft** — quality achieved through disciplined typography, spacing, hierarchy, timing, and consistency (C-14). The brand MUST NOT equate premium with visual excess, ornamentation, density, saturation, animation quantity, or exclusivity theater.
- *Design implication:* Elevating a surface means *removing* noise and tightening precision, not *adding* decoration; a "more premium" proposal that adds visual weight is presumptively wrong.
- *Reviewer verifies:* The premium quality of any surface can be attributed to precision/consistency/restraint; if it depends on added ornament or effect, it fails this rule.

## 18. Simplicity Philosophy

**B-22** — The brand MUST pursue *earned simplicity*: the fewest elements that fully and honestly serve the task, with complexity absorbed by the system rather than exported to the user.
- *Design implication:* Simplicity MUST NOT be achieved by hiding safety, consent, honesty, or reversibility; those MUST remain present even when simplifying (simplicity ranks below Tiers 1–4).
- *Reviewer verifies:* Nothing essential to safety/consent/honesty/dignity was removed in the name of simplicity; every remaining element earns its place.

## 19. Transparency Philosophy

**B-23** — The brand MUST make its own behavior legible: what the system knows, why it shows what it shows, what an action will do, and what is certain vs. inferred MUST be discoverable before the user commits (C-2, C-12, honest states).
- *Design implication:* Consequential actions MUST preview their effect and reversibility; errors, empty, and loading states MUST tell the honest truth about cause and next step, never a reassuring fiction.
- *Reviewer verifies:* Before any consequential action, the user can learn what will happen and how to undo it; no state misrepresents system status.

## 20. Brand Personality

**B-24** — Sambandh's brand personality MUST be expressed through, and only through, the following adjectives, each with the design behavior it *mandates* and *forbids*. These are permanent; expression may vary within them but MUST NOT contradict them.

| # | Trait | Mandates (design MUST) | Forbids (design MUST NOT) |
|---|-------|------------------------|----------------------------|
| B-25 | **Trustworthy** | Back every claim with evidence; fail-secure to *unverified* | Assert trust via styling/badges without fact |
| B-26 | **Calm** | Steady pacing, quiet defaults, user-set tempo | Urgency, countdowns, alarm, motion for arousal |
| B-27 | **Precise** | Exact language, consistent spacing/hierarchy, accurate state | Vague copy, approximate status, decorative imprecision |
| B-28 | **Dignified** | Treat every user as an equal end; neutral, respectful framing | Ranking people by appearance/origin; condescension |
| B-29 | **Discreet** | Private by default; minimal exposure; quiet confirmations | Broadcasting activity; public shaming; oversharing |
| B-30 | **Warm-but-restrained** | Humane, plain, kind tone; helpful defaults | Effusive hype, forced cheer, emotional manipulation |

- *Reviewer verifies:* Any surface can be scored against all six rows with no "forbids" violation; a surface that is on-brand for one trait by violating another fails.

## 21. Emotional Characteristics

**B-31** — The brand MUST reliably evoke, and be measurable against, this fixed emotional set: **reassurance, respect, quiet confidence, and safety.**
- *Reviewer verifies:* Post-interaction, users can identify these felt states; their presence is a brand-conformance signal (see §26).

**B-32** — The brand MUST NEVER be designed to evoke **anxiety, FOMO, shame, envy, hype, or manufactured excitement** (C-6, C-11).
- *Reviewer verifies:* No surface's mechanism of action depends on any prohibited emotion; if removing the prohibited emotion breaks the design, the design is off-brand and MUST be rebuilt.

## 22. Product Positioning

**B-33** — Sambandh MUST be positioned as *the world's most trusted relationship ecosystem*, founded on trust-before-engagement — an *ecosystem for sustained human connection*, not a transactional attention product.
- *Design implication:* Design language MUST reflect ecosystem breadth and durability (form, verify, sustain across time) rather than single-transaction matching.

**B-34** — The brand MUST hold, as a permanent **anti-position**, that Sambandh is *not "another dating app"*: it MUST NOT adopt the attention-maximizing, gamified, appearance-ranking, disposability patterns characteristic of that category.
- *Reviewer verifies:* No core mechanic optimizes swipe-volume, appearance-ranking, streaks, or disposability; presence of any such mechanic is a positioning violation.

## 23. Tone of Experience

**B-35** — The experiential tone MUST be **clear, respectful, unhurried, and never salesy**, applied uniformly across UI, notifications, errors, empty states, and support. Verifiable rules:
1. **Clear** — Copy MUST state the fact and the next step in plain, localizable language; jargon and euphemism for bad news are prohibited.
2. **Respectful** — Copy MUST address the user as a capable equal; no blame, condescension, guilt, or coercive phrasing.
3. **Unhurried** — Copy and motion MUST NOT imply time pressure absent a real, user-relevant deadline; artificial urgency is prohibited.
4. **Never salesy** — Product surfaces MUST NOT upsell, hype, or persuade inside safety, consent, error, or relationship-critical moments; promotional tone MUST NOT masquerade as system guidance.
- *Reviewer verifies:* Read every string aloud; each satisfies all four sub-rules, and no safety/consent/error string contains promotional intent.

## 24. Principles for Decision Making

**B-36** — All brand tradeoffs MUST be resolved by the Constitution Article 4 lexicographic hierarchy (Safety & legality ▸ Consent & privacy ▸ Honesty of signal ▸ Human dignity & inclusion ▸ Understanding & task success ▸ Emotional wellbeing & calm ▸ Consistency ▸ Craft & aesthetics ▸ Business & growth). A gain at a lower tier MUST NEVER justify a loss at a higher tier. This order MUST NOT be re-derived, reweighted, or supplemented above Tier 4.

**B-37** — Brand-specific tie-breakers MAY be added **only below Tier 4** (i.e., only to disambiguate among choices already equal on Safety, Consent, Honesty, and Dignity). The permanent brand tie-breakers, in order, are:
1. Prefer the option that makes trust more *legible/evidenced* (serves Tier 3 spirit).
2. Prefer the option that is *calmer* (less arousal, less urgency).
3. Prefer the option that is *more consistent* with existing patterns over novelty.
4. Prefer the option achieving quality through *restraint* over addition.
5. Only after all above are equal, prefer the option better for growth.

- *Reviewer verifies:* Every non-trivial decision record cites the tier that decided it; brand tie-breakers appear only after Tiers 1–4 are shown equal.

## 25. Design Priorities

**B-38** — Design effort and attention MUST be allocated in this fixed priority order, consistent with §24: (1) make it safe and lawful → (2) make consent and privacy honest → (3) make signals honest → (4) make it dignified and inclusive → (5) make it understandable and successful → (6) make it calm → (7) make it consistent → (8) make it crafted → (9) make it grow.
- *Design implication:* A later-priority polish MUST NOT be undertaken while an earlier-priority defect exists on the same surface.
- *Reviewer verifies:* No surface ships with a Tier 1–4 defect outstanding, regardless of craft quality.

## 26. Quality Standards

**B-39** — A surface MUST meet ALL of the following measurable brand-conformance criteria to be considered on-brand. Failure of any single criterion is a brand defect.

| ID | Brand-conformance criterion | Verification method | Pass condition |
|----|------------------------------|---------------------|----------------|
| B-40 | Trust legibility | Inspect each trust signal | 100% map to a named, checkable, dated source |
| B-41 | Fail-secure state | Force unknown trust/consent | Renders as *unverified* / *not consented* |
| B-42 | Consent traceability | Audit each datum used | 100% have prior explicit scoped revocable consent |
| B-43 | Safety reachability | Path-trace from every surface | Block/report/exit reachable within stated max path, all locales/devices, incl. error states |
| B-44 | Non-inference | Audit ordering/styling/copy | 0 signals infer worth from appearance/origin (C-3) |
| B-45 | Accessibility floor | Color-off + motion-off + screen reader | All meaning/status/trust survive; ≥ WCAG 2.2 AA |
| B-46 | Honest states | Review error/empty/loading | 0 misrepresent cause or system status |
| B-47 | Provenance labeling | Audit AI/inferred/aggregated content | 100% labeled; 0 presented as fact/human statement |
| B-48 | Calm compliance | Scan for urgency mechanics | 0 countdowns/scarcity/streak-loss/variable-reward/shame |
| B-49 | Restraint | Attribute premium quality | Attributable to precision/consistency, not added ornament |
| B-50 | Localization integrity | Swap locale/script/numeral/name/bandwidth | Identity and meaning intact |
| B-51 | Personality conformance | Score against §20 table | 0 "forbids" violations across all six traits |

## 27. Long-Term Evolution Principles

**B-52** — Brand **identity** (the immutable principles C-1..C-17 and every B-rule in this spec) MUST be treated as permanent; brand **expression** (visual language, motion, voice specifics, naming of features) MAY evolve, provided it never contradicts identity.
- *Reviewer verifies:* An expression change is accepted only after passing all §26 criteria; any change that weakens a Tier 1–4 guarantee is rejected outright.

**B-53** — Evolution MUST be *additive-first* (SHIG-0001): new expression is preferred over redefinition; identity guarantees may only be *strengthened*, never lowered (Tier 1–4 ratchet).

**B-54** — Every evolution MUST be evidence-based (C-17): a change to expression MUST cite the user-benefit or higher-tier value it serves, not taste or trend alone.

## 28. Brand Governance

**B-55** — This specification MUST follow the SHIG-0001 status lifecycle (Draft→Review→Active→Deprecated→Retired) and semantic versioning MAJOR.MINOR.PATCH. B-identifiers MUST be permanent: never reused, never renumbered; retired rules are marked Deprecated/Retired in place.

**B-56** — Any proposed change touching a Tier 1–4 guarantee MUST require a MAJOR review and MUST NOT be adopted if it lowers a guarantee. Editorial or expression-only changes are MINOR/PATCH.

**B-57** — Where any downstream SHIG spec, component, or surface conflicts with this spec, the conflict MUST be logged and resolved in favor of the higher instrument (SHIG-0000 ▸ SHIG-0001 ▸ SHIG-0002 ▸ lower).

**B-58** — Ownership of this specification MUST rest with the Chief Design Officer function; approval of any change MUST be recorded in the Revision History with rationale citing the tier or value served.

# Compliance / Review Checklist

Reviewer confirms each item; any "no" blocks release.

- [ ] **B-40** Every trust signal maps to a named, checkable, dated source.
- [ ] **B-41** Unknown trust/consent renders fail-secure (*unverified* / *not consented*).
- [ ] **B-42** Every datum used has prior, explicit, scoped, revocable consent with a visible revoke control.
- [ ] **B-43** Block/report/exit reachable within the stated max path from every surface, all locales/devices, including error states.
- [ ] **B-44** No ordering, styling, or copy infers worth/character/trust from appearance, complexion, caste, religion, region, or language.
- [ ] **B-45** Meaning, status, and trust survive color-off, motion-off, and screen-reader; ≥ WCAG 2.2 AA.
- [ ] **B-46** Error/empty/loading states state the honest cause and next step.
- [ ] **B-47** All AI/inferred/aggregated content is provenance-labeled; none presented as fact or as a human's statement.
- [ ] **B-48** No countdowns, artificial scarcity, streak-loss anxiety, variable-reward, or shame mechanics.
- [ ] **B-49** Any "premium" quality is attributable to restraint/precision/consistency, not added ornament.
- [ ] **B-50** Identity and meaning survive locale/script/numeral/name-structure/bandwidth swaps.
- [ ] **B-51** Zero "forbids" violations across all six personality traits (§20).
- [ ] **B-31/B-32** Surface evokes reassurance/respect/quiet-confidence/safety and none of anxiety/FOMO/shame/envy/hype.
- [ ] **B-34** No core mechanic optimizes swipe-volume, appearance-ranking, streaks, or disposability.
- [ ] **B-36/B-37** Every recorded tradeoff cites the deciding tier; brand tie-breakers used only below Tier 4.
- [ ] **B-38** No Tier 1–4 defect outstanding while later-priority polish was applied.

# Anti-patterns

Each is a brand defect and MUST be rejected in review; each cites the rule it violates.

1. **Hype** — Superlatives, excitement-manufacturing, or promotional intensity to drive action. *Violates B-30, B-32, B-35.4.*
2. **Trust-theater** — Trust badges, seals, "verified"-styling, or reassuring tone with no verifiable fact behind them. *Violates B-14, B-25, B-40.*
3. **Luxury-as-excess** — Ornamentation, density, saturation, or animation quantity used to signal "premium." *Violates B-21, B-49.*
4. **Salesy intrusion** — Upsell, cross-sell, or persuasion inside safety, consent, error, or relationship-critical moments. *Violates B-35.4, B-16.*
5. **Dark patterns** — Manufactured urgency, forced continuity, obstructed exit, confirm-shaming, pre-checked consent, misdirection. *Violates B-13, B-15, B-16, B-23.*
6. **Appearance/origin inference** — Ranking, styling, or copy that ties dignity, worth, or trust to how someone looks or where they are from. *Violates B-19, B-44.*
7. **Inference-as-fact** — Predictions, scores, or aggregates presented as certainty or as another person's statement. *Violates B-17, B-47.*
8. **Engagement-primacy** — Justifying a surface solely by a business metric with no user-benefit rationale. *Violates B-10, B-38.*
9. **Meaning-by-color/motion-alone** — Status or trust conveyed only through color, position, or motion. *Violates B-20, B-45.*
10. **Monoculture defaults** — Treating one language, script, numeral system, name structure, or device as canonical. *Violates B-18, B-50.*

# Open Questions

1. **OQ-1** — What is the platform-wide numeric maximum path length for safety-action reachability (B-43), and does it vary by device class or degraded state? (Pending a Safety & Interaction spec; until set, reviewers apply the strictest stated value.)
2. **OQ-2** — What instrument and cadence measure the required emotional characteristics (B-31/B-32) without introducing intrusive measurement that conflicts with the Privacy Philosophy (B-15)?
3. **OQ-3** — What is the canonical taxonomy and visual grammar of verification levels (B-17) — to be defined in a Trust & Verification spec, then referenced here, not re-derived.
4. **OQ-4** — Where exactly is the boundary between governed brand *identity* (this spec) and evolvable brand *expression* (downstream visual/voice specs) recorded, to prevent expression specs from silently amending identity (B-52)?
5. **OQ-5** — What review threshold distinguishes an "expression" change (MINOR/PATCH) from one that materially touches a Tier 1–4 guarantee (MAJOR) in ambiguous cases (B-56)?

# Revision History

| Version | Date | Status | Author | Summary |
|---------|------|--------|--------|---------|
| 1.0.0 | 2026-07-26 | Active | Chief Design Officer, Sambandh | Initial Brand Foundation Specification. Establishes permanent brand identity (B-1..B-58): vision, mission, DNA, values, the philosophy set, personality, emotional characteristics, positioning and anti-position, tone, decision principles bound to Constitution Article 4, measurable quality standards, evolution and governance rules. Compliant with and subordinate to SHIG-0000 and SHIG-0001. |
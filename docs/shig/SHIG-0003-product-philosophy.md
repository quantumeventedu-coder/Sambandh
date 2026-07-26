# Specification ID

SHIG-0003

# Specification Name

Product Philosophy Specification

# Version

1.0.0

# Status

Active

---

## 1. Purpose

This specification defines how Sambandh reasons as a product: the fixed convictions that govern what is built, why, and what is refused. It is the medium-independent parent of all downstream feature, interaction, and content specifications. It exists so every product decision is traceable to the Constitution (SHIG-0000) rather than to opinion, trend, or short-term revenue.

- **PP-1** — Every product decision (feature, change, removal, default, copy, model behavior) MUST be justifiable by citation to a rule in this specification or a higher SHIG instrument (SHIG-0000, SHIG-0001). A decision with no such citation MUST NOT ship.
- **PP-2** — Where this specification and any SHIG-0000 principle (C-1..C-17) or Article 4 tier appear to conflict, the higher instrument MUST prevail, and the conflicting product rule MUST be treated as an error and corrected.
- **PP-3** — This specification is Tier 1 governing intent; downstream specs MAY strengthen it but MUST NOT weaken, override, or carve exceptions to any PP rule.

## 2. Scope

- **PP-4** — This specification governs product philosophy and decision criteria for all Sambandh surfaces, verticals, features, and AI behaviors, present and future, across all channels (app, web, voice, messaging, offline, partner-mediated).
- **PP-5** — This specification MUST NOT prescribe implementation particulars (visual style, color, typography, spacing, components, platform, framework, model vendor); such particulars are delegated to downstream specifications and MUST themselves comply with these rules.
- **PP-6** — Any Sambandh entity that produces user-facing behavior (human team, third party, partner, automated agent) is in scope and MUST conform; contracts and integrations that cannot conform MUST NOT be shipped.

## 3. Definition of Sambandh

- **PP-7** — Sambandh MUST be defined and represented, internally and externally, as a premium relationship ecosystem grounded in trust, authenticity, privacy, safety, dignity, and lifelong relationships.
- **PP-8** — Sambandh MUST NOT be defined, marketed, measured, or designed as a "dating app," a hookup service, a swipe/attention product, or an engagement-maximization product.
- **PP-9** — Sambandh serves the formation and sustenance of durable human relationships (including marriage, family, community, and long-term companionship) and MUST treat the relationship — not the session, the match, or the transaction — as the unit of value.

## 4. Why Sambandh Exists

- **PP-10** — The product's reason for existence MUST be stated as: to help people form and sustain trustworthy, authentic, lasting relationships with dignity and safety. All roadmaps MUST be evaluable against this statement.
- **PP-11** — Any initiative that advances measurable engagement, revenue, or growth while failing to advance PP-10 MUST be classified as off-mission and MUST NOT be prioritized over on-mission work (Article 4 Tier 9 never beats Tiers 1-8).

## 5. The Problem It Solves

- **PP-12** — The product MUST orient around the named problems: deception and false signal in relationship discovery; unsafe contact and coercion; privacy loss and exposure; dehumanizing judgment by appearance/complexion/caste/religion/region/language; and the manufactured compulsion of attention-economy products.
- **PP-13** — The product MUST NOT reintroduce, monetize, or gamify any problem in PP-12 as a feature (e.g., artificial scarcity of matches, pay-to-be-seen ranking that hides honest signal, streaks that manufacture return pressure).
- **PP-14** — Non-inference (C-1, C-17): the product MUST NOT infer, rank, gate, or price a person based on appearance, complexion, caste, religion, region, or language. Any signal derived from these attributes for such purposes MUST be treated as a defect.

## 6. Product Vision

- **PP-15** — The vision the product optimizes toward MUST be: a world where people meet the right relationships through verified trust and honest signal, without surveillance, coercion, or compulsion, India-first and globally inclusive.
- **PP-16** — Vision statements MUST NOT promise outcomes the product cannot honestly deliver (e.g., guaranteed marriage, guaranteed compatibility); aspirational language MUST remain within honesty-of-signal (C-2, Tier 3).

## 7. Product Mission

- **PP-17** — The mission the product executes MUST be: establish trust before engagement, present only honest signals, protect privacy and safety by default, and support relationships over their full lifecycle.
- **PP-18** — Mission delivery MUST be sequenced so that trust and safety mechanisms precede or accompany any feature that enables contact between people; contact-enabling features MUST NOT ship ahead of their trust/safety prerequisites (C-1, C-5).

## 8. Human Relationship Philosophy

- **PP-19** — The product MUST treat every user as a full human being, never as an inventory item, a score, or a conversion target; representations that reduce a person to a metric MUST NOT be used as the primary depiction of that person.
- **PP-20** — The product MUST support relationships as processes that unfold over time (discovery → trust → acquaintance → deepening → commitment → sustenance), and MUST NOT collapse this process into a single instantaneous accept/reject act as the only path.
- **PP-21** — The product MUST make reversal and withdrawal available at each relationship stage (C-7 reversibility); a user MUST be able to slow down, pause, or exit without penalty, loss of dignity, or coercive friction.

## 9. Trust-First

- **PP-22** — Trust MUST be established before engagement (C-1): a user MUST be able to see the trust/verification state of a person or claim before acting on it.
- **PP-23** — Unknown trust MUST fail secure to "unverified"; the product MUST NOT display, imply, or default an unverified subject as verified or trusted (SHIG-0000 fail-secure).
- **PP-24** — Trust and verification states MUST be represented honestly and distinctly (verified / unverified / pending / revoked) and MUST NOT be conflated, softened, or hidden to increase engagement or conversion (Tier 3 over Tier 9).
- **PP-25** — Purchased status, membership tier, or payment MUST NOT raise, simulate, or substitute for a trust/verification signal; premium status MUST be visibly distinct from trust status.

## 10. Privacy-First

- **PP-26** — Privacy MUST be the default state (C-6): the most protective setting MUST be the initial setting, and disclosure MUST require an explicit, informed, revocable user act.
- **PP-27** — Data collection MUST be consent-bounded and purpose-limited (C-4): the product MUST collect only what a stated, user-visible purpose requires, and MUST NOT repurpose data beyond the consent under which it was given.
- **PP-28** — Ambiguous consent MUST fail secure to "not-consented"; the product MUST NOT proceed with collection, sharing, or processing under uncertain consent (SHIG-0000 fail-secure).
- **PP-29** — The product MUST make a user's own data and sharing state legible and reversible to them (view, correct, withdraw, delete) without coercive friction (C-7).
- **PP-30** — The product MUST NOT expose a user's presence, activity, location, or contact reachability to others by default, and MUST NOT sell, rent, or trade personal data for advertising or profiling.

## 11. Safety-First

- **PP-31** — Safety and legality are the highest tier (Article 4 Tier 1): any feature, default, or AI behavior that increases risk of harm to a user MUST be blocked, changed, or removed regardless of business cost.
- **PP-32** — A safety-reachable channel (report, block, help) MUST be available and discoverable from every surface where contact between people is possible (C-5), and MUST NOT be gated behind payment, tier, or completion of other steps.
- **PP-33** — The product MUST default to the safer option under uncertainty (unsafe-until-shown-safe for contact, exposure, and identity claims); it MUST NOT default to exposure or contact when safety is unresolved.
- **PP-34** — Safety mechanisms MUST NOT be weakened, delayed, or A/B-tested for engagement or revenue gains; safety MUST NOT be traded against any lower tier.

## 12. Authenticity

- **PP-35** — Every signal presented as fact (identity, verification, status, activity, provenance) MUST be true, current, and honestly qualified (C-2, Tier 3); the product MUST NOT present fabricated, stale, or decorative signals as real.
- **PP-36** — The product MUST distinguish, in a channel-independent and non-single-channel way (C-8), between: verified fact, self-declared claim, and inference; these three MUST never be rendered indistinguishable.
- **PP-37** — The product MUST NOT manufacture social proof, fake activity, phantom interest, or synthetic urgency to induce action.

## 13. Compatibility

- **PP-38** — A compatibility score, match percentage, or similar output MUST be labeled as an inference, never a verdict on a person (C-13, Tier 3).
- **PP-39** — A compatibility output MUST NOT gate, block, or rank a person as "incompatible" in a way that removes their agency or dignity; it MUST inform, not decide (Tier 4 human-dignity over Tier 5 task-success).
- **PP-40** — Compatibility inference MUST NOT be derived from prohibited attributes (PP-14) and MUST expose, in plain terms, what class of inputs it is based on so a user can judge its relevance.
- **PP-41** — The product MUST NOT present compatibility as precise, guaranteed, or destiny; uncertainty MUST be communicated honestly and MUST NOT be hidden to increase perceived value.

## 14. Emotional Intelligence

- **PP-42** — The product MUST prefer calm over stimulation (C-11, Tier 6): defaults MUST NOT exploit anxiety, loneliness, jealousy, FOMO, or urgency to drive action.
- **PP-43** — The product MUST communicate in states that are honest about waiting, rejection, silence, and absence (C-15); it MUST NOT disguise a negative or empty state as a positive one to protect engagement.
- **PP-44** — Emotionally weighty moments (rejection, report, breakup, withdrawal) MUST be handled with dignity and MUST NOT be interrupted by upsell, gamification, or metric prompts.

## 15. Family

- **PP-45** — The product MUST support family participation where a user consents to it, and MUST NOT force, assume, or expose family involvement without that user's explicit, revocable consent (C-4).
- **PP-46** — Where family or guardians act within the product, the individual user's safety, consent, and dignity MUST remain protected; the product MUST NOT let family access override a user's own safety or privacy controls (Tiers 1-2 over convenience).

## 16. Community

- **PP-47** — The product MUST treat community as plural (C-9): it MUST accommodate diverse Indian and global communities without privileging one as the default norm.
- **PP-48** — Community features MUST NOT enable segregation, exclusion, or targeting on prohibited attributes (PP-14), nor allow community identity to become a mechanism for coercion or harassment.

## 17. AI

- **PP-49** — AI in the product MUST be assistance, not authority (C-13): it MUST support human judgment and MUST NOT make final decisions about a person's worth, character, or eligibility.
- **PP-50** — AI output MUST be clearly labeled as AI-generated or AI-assisted (C-13) and MUST NOT be presented as a human, as verified fact, or as neutral truth.
- **PP-51** — AI MUST be consent-bounded (C-4, C-13): it MUST operate only on data the user has consented to for that purpose and MUST NOT infer or act beyond that boundary.
- **PP-52** — AI MUST NOT infer character, morality, intent, or trustworthiness from a person, and MUST NOT infer or use prohibited attributes (PP-14); such inferences MUST be treated as defects.
- **PP-53** — AI MUST express uncertainty honestly and MUST provide a human-reachable path for consequential outcomes; a user MUST be able to appeal or bypass an AI result to a human where it materially affects them.
- **PP-54** — AI MUST NOT be used to manufacture engagement, simulate affection, or impersonate interest from another user.

## 18. Premium Experience (Restraint)

- **PP-55** — Premium MUST be expressed through restraint (C-14): fewer, calmer, more trustworthy interactions — not more notifications, more badges, or more pressure.
- **PP-56** — Monetization MUST NOT purchase advantages that undermine honesty-of-signal, safety, or another user's dignity (e.g., paying to hide unverified status, to bypass safety limits, or to obscure honest state) — Tier 9 never beats Tiers 1-4.
- **PP-57** — Paid tiers MUST deliver genuine, honestly described value and MUST NOT rely on dark patterns, artificial scarcity, or degradation of the free experience below a safe, dignified baseline.

## 19. Long-Term Relationship

- **PP-58** — The product MUST optimize for durable relationship outcomes over session-level metrics; roadmaps MUST include and privilege measures of relationship health and longevity (C-16) over measures of usage volume.
- **PP-59** — The product MUST NOT design mechanics whose success depends on the user remaining single, unmatched, or continuously re-engaging; graduation off the product for a successful relationship MUST be treated as a success, not churn to be prevented.

## 20. Digital Wellbeing

- **PP-60** — Product success MUST be defined as a healthy relationship formed or sustained, NOT time-on-app, sessions, or streaks; success metrics that reward time-on-app as an end MUST NOT be adopted (C-11, Tier 6).
- **PP-61** — The product MUST NOT employ compulsion loops (infinite feeds as the core mechanic, variable-reward slot mechanics, streak pressure, guilt notifications) that manufacture return pressure.
- **PP-62** — The product MUST make it easy to disengage, pause, mute, and leave, and MUST NOT penalize or shame disengagement.

## 21. Ethical Product

- **PP-63** — The product MUST be decidable by the lexicographic hierarchy (Article 4): when principles conflict, the higher tier MUST win and the tradeoff MUST be recorded with a citation to the winning tier.
- **PP-64** — The product MUST NOT ship a feature whose value depends on deceiving, coercing, or exploiting a user, even if legal and profitable (Tiers 1-4 over Tier 9).

## 22. Transparency

- **PP-65** — The product MUST make its states, sources, and reasons legible: a user MUST be able to learn why they see something, where a signal came from, and what data drives an outcome that affects them (C-17 evidence-over-opinion).
- **PP-66** — The product MUST NOT hide, bury, or obfuscate mechanics that materially affect a user (ranking, pricing, data use, AI involvement); disclosure MUST NOT be single-channel (C-8).

## 23. Simplicity

- **PP-67** — The product MUST prefer the simplest design that preserves trust, safety, consent, and dignity; complexity that does not serve a higher-tier guarantee MUST be removed.
- **PP-68** — Simplicity MUST NOT be achieved by hiding honest state, consent choices, or safety controls; a control required by Tiers 1-3 MUST NOT be omitted for the sake of a cleaner surface.

## 24. Personalization

- **PP-69** — Personalization MUST be consent-bounded (C-4) and MUST operate only on data provided for that stated purpose; it MUST NOT profile a user beyond consent.
- **PP-70** — Personalization MUST NOT use prohibited attributes (PP-14), MUST NOT create filter effects that segregate or exclude on those attributes, and MUST be inspectable and resettable by the user (C-7).
- **PP-71** — Personalization MUST NOT be used to intensify compulsion or exploit inferred emotional vulnerability.

## 25. Human + AI Collaboration

- **PP-72** — The product MUST position AI as a collaborator under human control: a human MUST remain able to review, override, and take over any consequential AI-assisted flow (C-13).
- **PP-73** — Accountability for AI-assisted outcomes MUST rest with Sambandh, not the user or the model; the product MUST NOT use "the algorithm decided" as a justification to a user.

## 26. Learning & Growth

- **PP-74** — Product learning (from user behavior, feedback, outcomes) MUST be grounded in consented data and evaluated by honest evidence (C-17); it MUST NOT infer sensitive traits or prohibited attributes to "improve" the product.
- **PP-75** — Improvements MUST be validated against relationship-health and trust outcomes, not engagement lift alone; an experiment that raises engagement while harming a higher tier MUST be rejected (Tier ordering).

## 27. Cultural Diversity

- **PP-76** — The product MUST be India-first and globally inclusive (C-9): it MUST support plural languages, naming, relationship norms, and community practices without treating any single one as the universal default.
- **PP-77** — The product MUST NOT encode cultural assumptions that erase, misrepresent, or subordinate a community, and MUST NOT convert cultural attributes into ranking or exclusion signals (PP-14).

## 28. Global Accessibility

- **PP-78** — The product MUST meet accessibility as a baseline obligation (C-8, WCAG 2.2 AA target medium-independently): meaning MUST NOT be conveyed through a single channel (color alone, sound alone, motion alone, icon alone).
- **PP-79** — The product MUST remain usable under constrained conditions (low bandwidth, low-end devices, assistive technology, low literacy) so that trust, safety, and consent controls are reachable by all users.

## 29. Sustainable Product

- **PP-80** — The product MUST be built for longevity (C-16): decisions MUST favor durable trust and maintainability over disposable novelty, and MUST avoid mechanics that require perpetual escalation to retain users.
- **PP-81** — The business model MUST be sustainable without violating any higher tier; revenue MUST NOT depend on surveillance, dark patterns, or manufactured compulsion (Tier 9 subordinate).

## 30. Future Product Evolution

- **PP-82** — Evolution MUST only strengthen Tier 1-4 guarantees; no future change MAY weaken safety, consent/privacy, honesty-of-signal, or human-dignity/inclusion (SHIG-0001 Tier-strengthening rule).
- **PP-83** — Every new feature, vertical, or AI capability MUST pass the Feature Governance table (Section 32) before build, and its acceptance MUST be recorded with citations.
- **PP-84** — Consistency MUST be preferred over novelty (C-16): a change that breaks an established honest pattern MUST carry a recorded justification naming the higher tier it serves (SHIG-0001 deviation rule).

## 31. Decision Framework

Apply in order. Stop at the first tier that decides; record the citation.

| Step | Question (cite Article 4 tier) | If it fails |
|------|-------------------------------|-------------|
| 1 | Does it keep every user safe and legal? (Tier 1) | Reject or block; no lower-tier gain overrides. |
| 2 | Is consent explicit and privacy protected by default? (Tier 2) | Reject; ambiguous consent → not-consented. |
| 3 | Is every fact-signal honest and every inference labeled? (Tier 3) | Reject; fix signal honesty first. |
| 4 | Does it preserve human dignity, non-inference, and inclusion? (Tier 4) | Reject; remove prohibited-attribute use. |
| 5 | Does it help the user understand and succeed at forming a real relationship? (Tier 5) | Redesign for task-success. |
| 6 | Does it keep the experience calm, not compulsive? (Tier 6) | Remove compulsion mechanics. |
| 7 | Is it consistent with established honest patterns? (Tier 7) | Justify deviation citing a higher tier, or align. |
| 8 | Is it crafted with premium restraint? (Tier 8) | Refine; do not add stimulation. |
| 9 | Does it serve the business sustainably? (Tier 9) | Pursue only if Steps 1-8 pass. |

- **PP-85** — A decision MUST be resolved by the lowest-numbered step that determines it; a lower tier MUST NOT be invoked to override a higher tier (Article 4 lexicographic rule).
- **PP-86** — Every SHOULD-level deviation MUST record a written justification that names the higher tier it serves (SHIG-0001); undocumented deviation MUST be treated as non-compliant.
- **PP-87** — When any input to the framework is unknown or ambiguous, the product MUST choose the fail-secure outcome (unverified / not-consented / unsafe-until-shown-safe).

## 32. Feature Governance

- **PP-88** — Every current and future feature MUST be accepted only if it satisfies ALL acceptance criteria, and MUST be rejected if it meets ANY rejection criterion.
- **PP-89** — A feature MUST be REJECTED if it: violates any Tier 1-4 guarantee; manufactures compulsion; presents an inference as fact; or optimizes any metric above a higher tier.
- **PP-90** — Acceptance criteria (ALL required): trust/verification honest and fail-secure (PP-23/24); consent explicit, privacy default-protective (PP-26/28); every fact true and every inference labeled (PP-35/36/38); no prohibited-attribute inference (PP-14); safety-reachable and safer-by-default (PP-32/33); calm, non-compulsive (PP-42/61); success measured by relationship health, not time-on-app (PP-60); reversible (PP-21); accessible and non-single-channel (PP-78).

| Feature | Accept when | Reject when |
|---------|-------------|-------------|
| Memberships | Honestly described value; premium via restraint; free tier stays safe and dignified (PP-55/57) | Buys trust signal, hides unverified state, or bypasses safety limits (PP-25/56) |
| Gift Passes | Consent-bounded transfer; recipient controls acceptance and privacy (PP-45/26) | Coerces recipient, exposes them, or manufactures return pressure (PP-46/61) |
| Chat | Safety-reachable from surface; block/report unpaid; honest presence states (PP-32/43) | Fakes activity, hides safety controls, or gates reporting behind tier (PP-37/32) |
| Voice / Video | Explicit mutual consent; safer-by-default; reversible exit (PP-33/21) | Exposes identity/reachability without consent or removes exit (PP-30/62) |
| AI Recommendations | Labeled AI, consent-bounded inputs, human-appealable (PP-50/51/53) | Infers character/prohibited attributes or presents as verdict (PP-52/38) |
| Compatibility Reports | Labeled inference, honest uncertainty, informs not decides (PP-38/39/41) | Gates a person as "incompatible" or uses prohibited attributes (PP-39/40) |
| Lakshan Book | Self-declared claims marked as claims; user-owned and revocable (PP-36/29) | Renders claims as verified fact or exposes without consent (PP-36/26) |
| Coaching | Assistance-not-authority; dignity-preserving; human-reachable (PP-49/44) | Manufactures inadequacy or upsells during emotional moments (PP-44/71) |
| Events | Consent-based visibility; safety-reachable; inclusive by default (PP-47/32) | Segregates/excludes on prohibited attributes or exposes attendance (PP-48/30) |
| Marketplace | Honest provenance/verification of listings; transparent pricing (PP-35/66) | Fakes social proof, hides fees, or trades user data (PP-37/30) |

- **PP-91** — Governance outcomes (accept/reject, with citations) MUST be recorded and auditable before build begins (PP-83); a feature MUST NOT enter build without a recorded governance decision.
- **PP-92** — A rejected feature MUST NOT be re-scoped to hide a Tier 1-4 violation behind cosmetic change; re-submission MUST address the violation on its merits.

# Compliance / Review Checklist

- **PP-93** — Reviewers MUST confirm each shipped decision cites this spec or a higher instrument (PP-1) and records any deviation with a higher-tier justification (PP-86).
- **PP-94** — Reviewers MUST verify: trust states fail-secure to unverified (PP-23); consent ambiguity fails to not-consented (PP-28); safety channel present and ungated on every contact surface (PP-32); no prohibited-attribute inference anywhere (PP-14/52).
- **PP-95** — Reviewers MUST verify every inference (compatibility, recommendation, score) is labeled as inference and never rendered as a verdict or fact (PP-38/50).
- **PP-96** — Reviewers MUST verify success metrics measure relationship health/longevity, not time-on-app, and that no compulsion loop is present (PP-60/61).
- **PP-97** — Reviewers MUST verify meaning is never single-channel and constrained-condition usability of trust/safety/consent controls (PP-78/79).
- **PP-98** — Reviewers MUST run every new/changed feature through the Decision Framework (Section 31) and Feature Governance table (Section 32) and MUST reject on any single rejection criterion (PP-88/89).

# Anti-patterns

- **PP-99** — Prohibited: presenting Sambandh as a dating/swipe/engagement product (PP-8); paid trust or hidden unverified state (PP-25); manufactured social proof, phantom interest, or synthetic urgency (PP-37); compatibility/AI output as a verdict on a person (PP-39/49); any inference from appearance/complexion/caste/religion/region/language (PP-14); default exposure of presence/activity/contactability (PP-30); safety controls gated behind payment or steps (PP-32); compulsion loops, streak guilt, infinite-feed core mechanics (PP-61); upsell or gamification during rejection/report/withdrawal (PP-44); optimizing engagement or revenue above any higher tier (PP-11/64); AI unlabeled, impersonating humans, or acting beyond consent (PP-50/51/54); treating a successful relationship exit as churn to prevent (PP-59).

# Open Questions

- **PP-100** — Define the audited, quantitative proxies for "relationship health/longevity" that MUST replace time-on-app in success measurement (informs PP-58/60), pending a Metrics specification.
- **PP-101** — Define the human-appeal SLA and escalation path for consequential AI outcomes (informs PP-53), pending a Human-in-the-Loop specification.
- **PP-102** — Define the family/guardian access model that preserves individual safety and consent supremacy across jurisdictions (informs PP-45/46), pending a Family Participation specification.
- **PP-103** — Define the disclosure standard for ranking/pricing/AI-involvement across constrained channels (informs PP-66/78), pending a Transparency & Disclosure specification.

# Revision History

| Version | Date | Status | Author | Summary |
|---------|------|--------|--------|---------|
| 1.0.0 | 2026-07-26 | Active | Chief Design Officer, Sambandh | Initial SHIG-0003 Product Philosophy Specification; establishes medium-independent product convictions, Decision Framework, and Feature Governance, fully governed by SHIG-0000 Article 4 and C-1..C-17. Normative rules PP-1..PP-103. |
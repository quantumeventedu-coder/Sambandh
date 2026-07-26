# Specification ID

SHIG-0003

# Specification Name

Product Philosophy Specification

# Version

1.0.0

# Status

Active

---

**Governing instruments (binding, not re-derived here):** SHIG-0000 (Design Constitution — supreme authority; Article 4 lexicographic hierarchy; immutable principles C-1..C-17; fail-secure rules) and SHIG-0001 (Foundation & Governance — RFC-2119 grammar, permanent IDs, status lifecycle, semantic versioning, additive-first evolution, Tier 1-4 guarantees may only be strengthened). Where this specification and either instrument above it appear to conflict, the higher instrument governs. This specification defines *how Sambandh thinks as a product*; it is implementation-independent and medium/technology-independent.

**Reading key.** Each philosophy section states: **Rule** (normative, RFC-2119), **Why** (the higher-tier interest it protects), **Implication** (what it forces in design/user/business terms), **Verify** (how a reviewer confirms compliance). Cross-cutting Decision Criteria, Constraints, Review Checklist, Anti-patterns, and Future Evolution are stated ONCE at spec level (Sections 32–37) and are not repeated per section.

**Tier references.** "Tier n" throughout means the Constitution Article 4 lexicographic hierarchy: (1) Safety & legality ▸ (2) Consent & privacy ▸ (3) Honesty of signal ▸ (4) Human dignity & inclusion ▸ (5) Understanding & task success ▸ (6) Emotional wellbeing & calm ▸ (7) Consistency ▸ (8) Craft & aesthetics ▸ (9) Business & growth.

---

## 1. Purpose

**PP-1 (MUST).** SHIG-0003 MUST serve as the single authoritative statement of Sambandh's product intent, values, and reasoning model, against which every product decision, feature proposal, roadmap item, metric, and experiment is evaluated. Any product artifact that cannot be justified against a PP requirement in this document MUST be treated as unjustified and MUST NOT ship.

**Why.** A product without a written, governing philosophy defaults silently to Tier 9 (business/growth) optimization, violating the lexicographic hierarchy. **Verify.** For a sample of shipped decisions, a reviewer can name the PP requirement each satisfies; decisions with no referent fail review.

## 2. Scope

**PP-2 (MUST / MUST NOT).** This specification MUST apply to all Sambandh surfaces, channels, and modalities present and future — visual, textual, voice, conversational, notification, offline, human-mediated, and agent-mediated — and to all actors who shape user experience (product, design, engineering, AI, growth, operations, partners, and third parties acting on Sambandh's behalf). It MUST NOT be read as covering implementation specifics (visual styling, component code, platform, or vendor choices), which live in lower SHIG specs and MUST comply with, never override, this document. Partners and integrations MUST be contractually bound to Tier 1-4 guarantees; a partner cannot hold a right Sambandh itself does not hold.

**Verify.** Reviewer confirms each new surface/partner has a mapped compliance attestation against PP-2.

## 3. Definition of Sambandh

**PP-3 (MUST).** Sambandh MUST be defined, positioned, and operated as a *relationship-formation product* whose unit of success is a real human relationship formed with informed consent, dignity, and safety — not attention, session time, swipe volume, or transaction count. The word "Sambandh" (a durable, meaningful human bond) MUST NOT be diluted into a synonym for "engagement." Every reference to "success," "growth," or "performance" in any internal or external artifact MUST resolve to relationship outcomes, not consumption metrics.

**Why.** Tier 3 (honesty of signal) and the Constitution's relationship-first-not-metric-first principle. **Implication.** Success dashboards, incentive structures, and OKRs are defined in relationship terms first. **Verify.** Reviewer inspects the primary success metric of any team/feature; if it is a consumption proxy presented as the goal, it fails.

## 4. Why Sambandh Exists

**PP-4 (MUST).** Sambandh MUST exist to help people form trustworthy, compatible, consenting relationships with less deception, less exploitation, and less harm than the ambient alternatives — and MUST measure its own legitimacy by whether it reduces those harms, not by whether it captures more of a person's time. The product MUST NOT convert a person's search for connection into a source of dependency, compulsion, or manufactured scarcity.

**Why.** Tiers 1, 2, 6. **Verify.** Reviewer can point to a harm-reduction rationale (deception reduced, safety increased, consent strengthened) behind each core capability; capabilities whose only rationale is capture fail.

## 5. The Problem Sambandh Solves

**PP-5 (MUST).** Sambandh MUST target the concrete failures of existing relationship channels: identity deception, unsafe contact, non-consensual data exposure, prejudice masquerading as matching (inferring worth or trust from appearance, complexion, caste, religion, region, or language), manufactured urgency, and metric-driven manipulation. The product MUST NOT introduce, replicate, or monetize any of these failures, and MUST NOT define its problem so narrowly that solving it recreates them.

**Why.** Tiers 1-4; Constitution non-inference principle. **Verify.** Reviewer maps each of the seven listed failures to a specific Sambandh countermeasure; a failure with no countermeasure, or a feature that reintroduces one, fails.

## 6. Product Vision Philosophy

**PP-6 (MUST / SHOULD).** The product vision MUST be expressed as a durable end-state (a world where forming a trustworthy relationship is safe, honest, and dignified for everyone, India-first and globally inclusive) and MUST NOT be expressed as a market-size, valuation, or user-count target. Roadmaps SHOULD be traceable to this end-state; a roadmap item with no line of sight to the vision requires recorded justification naming the higher tier it serves.

**Why.** Tiers 4, 9 ordering. **Implication.** Vision statements omit growth numbers as their headline. **Verify.** Reviewer checks the stated vision contains no metric as its terminal goal and that roadmap items cite it.

## 7. Product Mission Philosophy

**PP-7 (MUST).** The mission MUST be operational and testable: to reduce relationship-formation harm and increase relationship-formation success for each user, in that priority order. When mission sub-goals conflict, harm reduction (Tiers 1-2) MUST win over success increase (Tier 5). Mission language MUST NOT promise outcomes the product cannot honestly deliver (e.g., guaranteed matches, guaranteed compatibility).

**Verify.** Reviewer confirms mission KPIs place a harm-reduction indicator above any success/throughput indicator, and that no user-facing promise asserts a guaranteed relational outcome.

## 8. Human Relationship Philosophy

**PP-8 (MUST).** The product MUST treat the human relationship — not the app, the profile, or the algorithm — as the protagonist, and MUST design toward the user leaving the product to be with a person. Features MUST NOT insert the product as a permanent intermediary that a formed relationship must keep paying or returning to in order to persist.

**Why.** Tier 6; digital-wellbeing and relationship-first principles. **Implication.** "Graduation" (users successfully departing) is a positive outcome, not churn to be prevented. **Verify.** Reviewer confirms successful departure is instrumented as success, not as a retention failure to be counteracted.

## 9. Trust-First Philosophy

**PP-9 (MUST).** Trust MUST be earned before engagement is requested: Sambandh MUST establish verifiable safety, honesty, and consent signals before asking a user to invest, disclose, or commit. Unknown trust state MUST render as *unverified* (fail-secure), never as trusted or ambiguous. Trust indicators MUST reflect verified facts only and MUST NOT be inferred, purchased, or gamed.

**Why.** Tiers 1-3; trust-before-engagement and fail-secure. **Verify.** Reviewer forces an unknown/failed-verification state and confirms it displays as unverified with no trust affordance granted.

## 10. Privacy-First Philosophy

**PP-10 (MUST / MUST NOT).** The product MUST default to data minimization: collect only what a named user benefit requires, retain only as long as that benefit requires, and expose nothing by default. Consent MUST be explicit, scoped, informed, and revocable; ambiguous or failed consent MUST be treated as not consented. The product MUST NOT perform covert surveillance, silent profiling, or secondary-use repurposing of data beyond its consented scope.

**Why.** Tier 2. **Implication.** Every data field has a named purpose and a deletion path. **Verify.** Reviewer audits each collected field for (a) a named benefit, (b) a retention limit, (c) a working revocation, (d) default non-exposure; any field failing one fails PP-10.

## 11. Safety-First Philosophy

**PP-11 (MUST).** Safety mechanisms (block, report, exit, help, escalation to human/authority where warranted) MUST be reachable, unobstructed, and functional from every surface where contact or disclosure occurs, and MUST NOT be gated behind payment, tier, delay, or friction. When any other objective conflicts with user safety or legality, safety MUST win (Tier 1). Safety MUST NOT be traded for engagement, growth, or aesthetic cleanliness.

**Verify.** Reviewer confirms from each contact surface that safety actions are present within reach, function without payment, and are never suppressed by design for visual or growth reasons.

## 12. Authenticity Philosophy

**PP-12 (MUST / MUST NOT).** The product MUST favor authentic representation of real people and MUST NOT reward, amplify, or normalize deception, impersonation, or manufactured personas. Signals of authenticity MUST be honest (a verification badge means a verification occurred); the product MUST NOT present decorative or paid signals as authenticity. Inference or enhancement (e.g., AI-refined imagery/text) MUST be labeled and MUST NOT be passed off as unaltered reality.

**Why.** Tier 3. **Verify.** Reviewer confirms every authenticity signal maps to a real verification event and every enhanced artifact is labeled.

## 13. Compatibility Philosophy

**PP-13 (MUST / MUST NOT).** Compatibility MUST be framed as *supported inference and mutual discovery*, never as fact or destiny, and MUST NOT be derived from — or correlated with — appearance, complexion, caste, religion, region, or language as proxies for worth or trust (Constitution NON-INFERENCE, C-3). Compatibility outputs MUST state their basis and their uncertainty, and MUST leave the human as the decider. The product MUST NOT rank human worth.

**Verify.** Reviewer inspects compatibility logic and copy: it must (a) be labeled as inference with stated basis, (b) exclude prohibited attributes as worth/trust proxies, (c) express uncertainty, (d) preserve user override.

## 14. Emotional Intelligence Philosophy

**PP-14 (MUST / SHOULD).** The product MUST respond to the emotional stakes of relationship-seeking with calm, respect, and honesty — especially at moments of rejection, absence of matches, waiting, and loss. It MUST NOT weaponize emotional states (loneliness, hope, insecurity, jealousy) to drive engagement or spending. Empty, error, waiting, and no-match states MUST be honest and non-manipulative; they MUST NOT fabricate activity, interest, or scarcity.

**Why.** Tiers 3, 6. **Verify.** Reviewer inspects sensitive-moment copy and mechanics for fabricated signals or emotional pressure; any found fails.

## 15. Family Philosophy

**PP-15 (MUST / MUST NOT).** Where family participation is culturally relevant (India-first inclusivity), the product MAY support consented family involvement, but MUST keep the individual user as the primary consenting agent and MUST NOT allow family (or any third party) to override the user's consent, privacy, or safety. Family features MUST NOT expose a user's data to relatives beyond the user's explicit, scoped, revocable grant.

**Verify.** Reviewer confirms family-linked flows require the individual's explicit grant, are revocable by the individual, and cannot override individual safety/consent.

## 16. Community Philosophy

**PP-16 (MUST).** Community features MUST strengthen trust, safety, and belonging across plural identities and MUST NOT become instruments of exclusion, harassment, majority pressure, or prejudice. Community norms MUST be enforced consistently and MUST protect minority, vulnerable, and dissenting users. The product MUST NOT let community scale or activity metrics override individual dignity and safety.

**Verify.** Reviewer confirms community mechanics include protective enforcement and that no community metric is prioritized above Tier 1-4 protections.

## 17. AI Philosophy

**PP-17 (MUST / MUST NOT).** AI MUST operate as *assistance, not authority*: it MUST be clearly labeled as AI, MUST act only within the user's consented scope, MUST frame its outputs as inference/suggestion with stated basis and uncertainty (never as fact, verdict, or destiny), and MUST leave final decisions to the human. AI MUST NOT infer character, worth, morality, or trustworthiness from identity attributes (appearance, complexion, caste, religion, region, language) — Constitution C-3. AI MUST NOT act covertly, impersonate a human, or exceed its consent boundary. On low confidence or unknown state, AI MUST defer, disclose uncertainty, or hand off to a human — never fabricate.

**Why.** Tiers 1-4; ethical-AI principle. **Verify.** Reviewer confirms every AI surface is labeled, scoped, inference-framed, prohibited-attribute-free, human-overridable, and fail-secure on low confidence.

## 18. Premium Experience Philosophy

**PP-18 (MUST / MUST NOT).** Premium MUST be achieved through restraint — precision, consistency, typography, spacing, hierarchy, and disciplined motion — and MUST NOT be achieved through visual excess, ornament, or stimulation. Paid tiers MUST NOT sell safety, consent, honesty, or dignity (Tier 1-4 guarantees are universal and unpurchasable). Premium value MUST derive from added craft and genuine utility, never from withholding protection or manufacturing disadvantage in the free tier.

**Verify.** Reviewer confirms no Tier 1-4 guarantee sits behind a paywall and that premium differentiators are craft/utility, not protection removal.

## 19. Long-Term Relationship Philosophy

**PP-19 (MUST / SHOULD).** The product MUST optimize for durable relationship outcomes over short-term engagement, and SHOULD prefer fewer, higher-quality, better-consented connections to high-volume, low-trust throughput. Mechanics that maximize interaction count at the expense of relationship quality MUST NOT be adopted. Any near-term engagement gain that degrades long-term relationship quality is a Tier-6/Tier-9 conflict resolved against the gain.

**Verify.** Reviewer confirms quality-of-outcome measures outrank volume measures in the feature's success definition.

## 20. Digital Wellbeing Philosophy

**PP-20 (MUST / MUST NOT).** The product MUST be anti-addictive by design: success is defined as *a person leaving to be with someone*, not time-on-app. The product MUST NOT employ compulsion loops, variable-reward manipulation, artificial streaks, manufactured urgency, guilt/FOMO mechanics, or notification pressure engineered to maximize return frequency. It SHOULD actively help users disengage when appropriate (e.g., after a successful connection). Engagement MUST NOT be a headline success metric.

**Why.** Tier 6; calm-over-stimulation and relationship-first. **Verify.** Reviewer audits loops, rewards, streaks, and notifications for compulsion patterns; presence of any is a defect. Reviewer confirms time-on-app is not celebrated as success.

## 21. Ethical Product Philosophy

**PP-21 (MUST).** Every product decision MUST be defensible under the Constitution's lexicographic hierarchy; a gain at a lower tier MUST NOT justify a loss at a higher tier. The product MUST NOT use dark patterns, deceptive defaults, forced continuity, roach-motel cancellation, or consent traps. Ethical review MUST be a precondition to launch, not a post-hoc audit.

**Verify.** Reviewer confirms a pre-launch ethics gate exists and that the decision record cites the tier ordering for any tradeoff made.

## 22. Transparency Philosophy

**PP-22 (MUST).** The product MUST be honest about what it is doing, why, and on what basis — including what data it uses, what is inference vs. fact, what is AI vs. human, what is sponsored vs. organic, and what a given action will cost or expose before the user commits. It MUST NOT hide material information, obscure pricing, or disguise inference and advertising as neutral fact.

**Why.** Tiers 2-3. **Verify.** Reviewer confirms disclosures for data use, inference labeling, AI/human labeling, sponsorship labeling, and pre-commitment cost/exposure are present and legible.

## 23. Simplicity Philosophy

**PP-23 (MUST / SHOULD).** The product MUST reduce cognitive and emotional burden: prefer the fewest steps, the clearest language, and the least data that achieve the user's goal. Simplicity MUST NOT be achieved by removing consent, disclosure, or safety (those are never "friction to remove"). The product SHOULD default to plain, localizable language and avoid jargon. Complexity that exists only to serve business goals MUST NOT be imposed on the user.

**Verify.** Reviewer confirms simplification did not delete a Tier 1-4 step and that flows meet a stated step-count/clarity bar.

## 24. Personalization Philosophy

**PP-24 (MUST / MUST NOT).** Personalization MUST be consent-bounded, transparent, and inspectable, and MUST serve the user's stated relationship goals — not covert commercial optimization. There MUST NOT be "dark personalization": price discrimination, manipulation of vulnerable states, prejudicial filtering on prohibited attributes, or hidden ranking that the user cannot see, understand, or turn off. Users MUST be able to view, correct, and disable personalization.

**Why.** Tiers 2-4. **Verify.** Reviewer confirms personalization is disclosed, prohibited-attribute-free, user-inspectable, and user-disableable, with no differential pricing or vulnerability targeting.

## 25. Human + AI Collaboration Philosophy

**PP-25 (MUST).** AI and humans MUST collaborate with the human retaining authority: AI proposes, explains, and assists; the human reviews and decides. High-stakes actions (contact, disclosure, safety, spending, irreversible steps) MUST require human confirmation and MUST NOT be executed by AI autonomously. Handoffs between AI and human support MUST preserve context and consent scope.

**Verify.** Reviewer confirms every high-stakes action has a human-confirmation gate and that AI cannot complete it unattended.

## 26. Learning and Growth Philosophy

**PP-26 (MUST / SHOULD).** The product MUST learn from evidence over opinion and MUST improve through additive, reversible change (Constitution longevity/reversibility). Experiments MUST NOT be run on users without appropriate consent and MUST NOT test manipulative or harmful mechanics "to see if they work." The product SHOULD help users themselves learn and grow (relationship skills, safety literacy) without lecturing, shaming, or exploiting insecurity.

**Verify.** Reviewer confirms experiments have a consent/ethics gate, exclude harmful hypotheses, and that learning features are non-shaming.

## 27. Cultural Diversity Philosophy

**PP-27 (MUST / MUST NOT).** The product MUST be India-first AND globally inclusive: it MUST support plural languages, scripts, numeral systems, naming conventions, relationship customs, and value systems without assuming one default. It MUST NOT encode one culture's norms as universal, and MUST NOT let cultural attributes become proxies for worth, trust, or eligibility. Cultural accommodation MUST NOT override Tier 1-4 protections (no custom justifies unsafe, non-consensual, or prejudicial treatment).

**Verify.** Reviewer confirms no single-language/script/numeral/naming assumption is hard-coded and that cultural attributes are excluded as worth/trust proxies.

## 28. Global Accessibility Philosophy

**PP-28 (MUST).** The product MUST meet the accessibility floor (WCAG 2.2 AA) as a minimum, never a ceiling, and MUST NOT convey meaning by color, position, or motion alone. It MUST NOT assume a single device class, high bandwidth, continuous connectivity, or literacy level; core relationship, safety, and consent functions MUST remain usable on low-bandwidth, low-cost, and intermittent conditions. Accessibility MUST NOT be a premium feature.

**Verify.** Reviewer confirms AA conformance, non-color/position/motion-sole meaning, low-bandwidth viability of core+safety flows, and that no access feature is paywalled.

## 29. Sustainable Product Philosophy

**PP-29 (MUST / SHOULD).** The product MUST be built for longevity and maintainability through systemic rules rather than one-off screens, so that trust, safety, and consistency survive scale and staff turnover. Business sustainability MUST be pursued only within Tiers 1-8 (revenue is Tier 9 and cannot justify a higher-tier loss). The product SHOULD prefer durable, honest revenue models (value-based) over extractive ones (attention-harvesting, manipulation, data resale).

**Verify.** Reviewer confirms revenue mechanics pass the tier test and that the design relies on systemic patterns, not bespoke exceptions.

## 30. Future Product Evolution Philosophy

**PP-30 (MUST).** All future evolution MUST be additive-first and backward-compatible with Tier 1-4 guarantees, which may only be strengthened, never lowered (SHIG-0001). New capabilities, modalities, or AI autonomy MUST re-enter this framework and pass Feature Governance (Section 33) before adoption. Novelty MUST NOT override consistency or safety; "because we can" is not a justification.

**Verify.** Reviewer confirms each new capability has a governance record and that no change weakens a prior Tier 1-4 guarantee.

## 31. Product Values Summary (normative anchor)

**PP-31 (MUST).** In any unlisted, novel, or ambiguous situation, teams MUST resolve the decision by (a) applying the Constitution Article 4 hierarchy, (b) defaulting fail-secure (unknown trust = unverified; ambiguous consent = not consented), and (c) preferring the reversible, more transparent, more consent-respecting option. Absence of a specific rule MUST NOT be read as permission to optimize a lower tier.

**Verify.** Reviewer confirms edge-case decisions cite (a)-(c); silence-as-permission reasoning fails.

---

## 32. Decision Framework (permanent priority hierarchy)

**PP-32 (MUST).** Every tradeoff MUST be resolved by the Constitution Article 4 LEXICOGRAPHIC hierarchy. Lexicographic means a lower tier is considered *only* when all higher tiers are equal; a lower-tier gain NEVER offsets a higher-tier loss. This ordering is permanent and MUST NOT be reweighted, blended, or overridden by any team, metric, or deadline.

| Rank | Tier | Governs | Overrides everything below |
|------|------|---------|----------------------------|
| 1 | Safety & legality | Physical/psychological safety, legal compliance | Yes |
| 2 | Consent & privacy | Explicit, scoped, revocable consent; data minimization | Yes |
| 3 | Honesty of signal | No inference/prediction/ad presented as fact | Yes |
| 4 | Human dignity & inclusion | Non-inference of worth; plurality; accessibility | Yes |
| 5 | Understanding & task success | Clarity, usability, relationship success | Yes |
| 6 | Emotional wellbeing & calm | Anti-compulsion, non-manipulation, calm | Yes |
| 7 | Consistency | Systemic coherence across surfaces | Yes |
| 8 | Craft & aesthetics | Precision, restraint, polish | Yes |
| 9 | Business & growth | Revenue, engagement, scale | No (lowest) |

**Tie-break procedure (MUST).** (1) Identify the highest tier touched by each option. (2) Choose the option that best serves the highest tier in conflict. (3) If tied at that tier, descend one tier and repeat. (4) If still tied, choose the more reversible, more transparent, more consent-respecting option (PP-31). (5) Record the decision and the tier cited. A recorded SHOULD-deviation MUST name the higher tier it serves; there is no valid deviation that serves only Tier 9.

## 33. Feature Governance

**PP-33 (MUST).** Every current and future feature MUST pass the acceptance gate and clear all rejection triggers below *before* launch and at each material change. A feature is REJECTED if it violates any Tier 1-4 guarantee, manufactures compulsion, presents inference as fact, or optimizes a metric above a higher tier — regardless of its business upside.

### 33.1 Universal gate

| Gate check (all MUST pass) | Reject trigger (any one REJECTS) |
|---|---|
| Serves a named user relationship benefit | Violates any Tier 1-4 guarantee |
| Safety actions reachable & unpaywalled | Manufactures compulsion/urgency/FOMO/streak pressure |
| Consent explicit, scoped, revocable; fail-secure | Presents inference/prediction/ad as fact |
| Data minimized; purpose + retention + deletion defined | Optimizes a lower-tier metric above a higher tier |
| Inference & AI labeled; human retains authority | Infers worth/trust from prohibited attributes (C-3) |
| No prohibited-attribute worth/trust proxy | Hides material cost, exposure, or sponsorship |
| Honest empty/error/loading/no-result states | Uses dark patterns / forced continuity / consent trap |
| Additive & reversible; strengthens (never lowers) Tier 1-4 | Requires paywalling safety, consent, honesty, or dignity |
| Accessible (WCAG 2.2 AA; not meaning-by-color/position/motion alone; low-bandwidth core+safety) | Not usable for a plural, low-bandwidth, or assistive-tech user in core+safety paths |

### 33.2 Worked application (brief)

| Feature | Accept when | Reject when |
|---|---|---|
| Memberships | Adds craft/utility; all Tier 1-4 protections stay universal & free | Sells safety/consent/honesty; cripples free tier to coerce upgrade |
| Gift Passes | Consented, revocable, transparent value; recipient consent honored | Creates obligation/guilt loops; exposes recipient data without consent |
| Chat | Safety/block/report/exit always reachable; consent-scoped; honest presence states | Fabricates activity; buries safety; pressures continuous reply |
| Voice/Video calls | Explicit mutual consent per session; safety controls in-call; recording disclosed | Auto-connect without consent; no in-call exit/report; covert capture |
| AI Recommendations | Labeled inference with basis & uncertainty; human decides; prohibited-attribute-free | Framed as verdict/destiny; ranks worth; optimizes engagement covertly |
| Compatibility Reports | Stated basis + uncertainty; user override; no worth ranking | Presented as fact/fate; derived from complexion/caste/religion/region/language |
| Lakshan Book | User-owned, consented, editable, labeled interpretation-not-fact | Immutable "verdict" on a person; inferred traits presented as truth; non-consensual sharing |
| Relationship Coaching | Assistance-not-authority; non-shaming; human agency preserved | Exploits insecurity; manufactures dependency; presents opinion as guaranteed outcome |
| Events | Safe, consented participation; inclusive; opt-in exposure | Coerced attendance; exposes attendees; prejudicial gating |
| Marketplace | Transparent pricing; honest listings; sponsored clearly labeled | Deceptive pricing; ads disguised as neutral results; extractive data resale |

**Verify.** For each feature, a reviewer confirms a completed 33.1 gate record exists and no reject trigger is present; missing record = not launch-eligible.

---

# Compliance / Review Checklist

A feature/decision is compliant only if a reviewer can answer YES to all:

1. Does it map to at least one PP requirement and resolve conflicts via the Article 4 hierarchy (PP-1, PP-32)?
2. Is success defined in relationship-outcome terms, not consumption metrics (PP-3, PP-8, PP-19, PP-20)?
3. Is trust earned before engagement, and does unknown trust render as unverified (PP-9, fail-secure)?
4. Is consent explicit, scoped, revocable, and treated as not-consented when ambiguous (PP-10, PP-31)?
5. Are safety actions reachable, unobstructed, and unpaywalled from every contact surface (PP-11)?
6. Is every authenticity/inference/AI/sponsorship signal honestly labeled and never presented as fact (PP-12, PP-13, PP-17, PP-22)?
7. Are prohibited attributes (appearance, complexion, caste, religion, region, language) excluded as proxies for worth/trust anywhere in logic or copy (PP-13, PP-17, PP-24, PP-27)?
8. Are empty/error/loading/no-result states honest and non-manipulative (PP-14)?
9. Is the design free of compulsion loops, manufactured urgency, streaks, and engagement-as-headline-metric (PP-20)?
10. Does the human retain authority over high-stakes actions (PP-25)?
11. Are data fields minimized, purposed, retention-limited, and deletable (PP-10)?
12. Does it meet WCAG 2.2 AA, avoid meaning-by-color/position/motion alone, and remain usable low-bandwidth and plurally (PP-27, PP-28)?
13. Is it additive, reversible, and does it strengthen (never lower) Tier 1-4 guarantees (PP-29, PP-30)?
14. Did it clear the Feature Governance gate with no reject trigger (PP-33)?
15. Is the decision record present, citing the tier(s) served (PP-32)?

# Anti-patterns

- **Engagement-as-mission:** treating time-on-app, session count, or swipe volume as success (violates PP-3, PP-8, PP-20).
- **Trust theater:** badges, "verified" labels, or trust scores not backed by real verification, or purchasable (violates PP-9, PP-12).
- **Inference-as-fact:** compatibility/AI outputs framed as verdict, destiny, or truth rather than labeled inference with basis and uncertainty (violates PP-13, PP-17, PP-22).
- **Prejudice laundering:** using appearance, complexion, caste, religion, region, or language as proxies for worth, trust, or eligibility (violates C-3, PP-13, PP-17, PP-27).
- **Paywalled protection:** placing safety, consent, honesty, or dignity behind a tier (violates PP-11, PP-18).
- **Compulsion mechanics:** streaks, variable rewards, FOMO, manufactured scarcity, guilt/notification pressure (violates PP-20).
- **Dark personalization / dark patterns:** hidden ranking, price discrimination, vulnerability targeting, forced continuity, roach-motel cancellation, consent traps (violates PP-21, PP-24).
- **Covert data use:** collection, profiling, secondary use, or resale beyond consented scope (violates PP-10, PP-22).
- **Fabricated states:** fake activity, fake interest, fake urgency in empty/no-match states (violates PP-14).
- **AI overreach:** unlabeled AI, human impersonation, autonomous high-stakes action, out-of-scope inference (violates PP-17, PP-25).
- **Product-as-permanent-intermediary:** designing to prevent successful relationships from graduating off-product (violates PP-8, PP-19).
- **Tier inversion:** justifying a higher-tier loss with a lower-tier (esp. Tier 9) gain (violates PP-32).
- **Cultural mono-default:** hard-coded single language/script/numeral/naming/custom assumption (violates PP-27, PP-28).
- **Silence-as-permission:** treating the absence of a specific rule as license to optimize a lower tier (violates PP-31).

# Open Questions

1. **Graduation measurement:** What privacy-preserving, consent-based method verifies "a person left to be with someone" as the north-star outcome without surveilling formed relationships (relates PP-8, PP-10, PP-20)?
2. **Family vs. individual consent boundaries:** Precise scope grammar for consented family involvement that can never override individual Tier 1-2 rights across differing cultural expectations (PP-15, PP-27) — to be specified in a downstream SHIG.
3. **Inference-uncertainty presentation:** The standardized, non-technical way to express confidence/uncertainty of AI and compatibility outputs so users neither over-trust nor dismiss them (PP-13, PP-17) — defer to interaction-level spec.
4. **Sustainable revenue catalog:** An approved list of value-based monetization models that pass the Tier-9 test, and an explicit denylist of extractive ones (PP-18, PP-29).
5. **Low-bandwidth safety floor:** The minimum guaranteed safety/consent function set under intermittent connectivity and low-cost devices (PP-11, PP-28) — to be quantified downstream.
6. **Third-party/partner attestation:** The binding mechanism ensuring partners cannot exercise rights Sambandh itself lacks (PP-2).

# Revision History

| Version | Date | Status | Author | Summary |
|---------|------|--------|--------|---------|
| 1.0.0 | 2026-07-26 | Active | Chief Design Officer (SHIG) | Initial issuance of SHIG-0003 Product Philosophy Specification. Establishes PP-1..PP-33: purpose/scope/definition; philosophies for relationship, trust, privacy, safety, authenticity, compatibility, emotional intelligence, family, community, AI, premium, long-term, digital wellbeing, ethics, transparency, simplicity, personalization, human+AI collaboration, learning, cultural diversity, accessibility, sustainability, and future evolution; the permanent Decision Framework (Constitution Article 4 lexicographic hierarchy) and the Feature Governance gate with worked criteria; compliance checklist, anti-patterns, and open questions. Compliant with SHIG-0000 and SHIG-0001; Tier 1-4 guarantees additive-only. |
# Specification ID

SHIG-0007

# Specification Name

Visual Language Specification

# Version

1.0.0

# Status

Active

# 1. Purpose & Role of Visual Language

**VL-1 (MUST).** Visual language exists to make Sambandh's meaning perceivable, understandable, and trustworthy — not to decorate. Every visual decision MUST serve communication of a real, present state or affordance. *Why:* Article 4 ranks Understanding (T5) and Honesty of signal (T3) above Craft (T8); visuals are a means to those ends, never an end. *Design implication:* a visual element with no communicative or navigational function is removed, not retained. *Verify:* for any visual element a reviewer can name the specific meaning, state, or action it conveys; elements that fail this test are flagged.

**VL-2 (MUST NOT).** Visual language MUST NOT manufacture urgency, scarcity, streaks, or compulsion (C-calm-over-stimulation). *Why:* T6 emotional wellbeing outranks T9 business/growth. *Verify:* no visual treatment escalates solely to drive a faster or more frequent action absent a genuine time-bound state.

**VL-3 (MUST).** This specification governs visual PRINCIPLES and SEMANTICS only. Concrete values (color, hex, type family, size, spacing, iconography, component structure) are DELEGATED to the design-token and component specifications and MUST NOT be defined here. *Verify:* this document contains no literal value binding.

# 2. Visual Communication Philosophy

**VL-4 (MUST).** Visual communication MUST be honest: a visual may only assert what the system actually knows. Inference, prediction, or estimate MUST be visually distinguished from confirmed fact and never rendered in the visual treatment reserved for verified fact (C-honesty-of-signal, T3). *Design implication:* confidence and provenance are visual variables, not afterthoughts. *Verify:* inferred/predicted content carries a distinct, non-color-only treatment separating it from confirmed content.

**VL-5 (MUST).** Meaning MUST precede style: the communicative intent of an element is decided before its aesthetic treatment. *Why:* prevents decoration from distorting signal. *Verify:* design rationale records intent-before-treatment.

**VL-6 (SHOULD).** Visual communication SHOULD favor restraint: the minimum visual force that reliably conveys the meaning. Deviation requires recorded justification naming the higher tier served. *Why:* premium-through-restraint; calm-over-stimulation.

# 3. Visual Semantics (Governing Rules)

**VL-7 (MUST).** No meaning MUST be carried by a single perceptual channel alone — not by color alone, shape alone, position alone, motion alone, or size alone. Every meaningful distinction MUST be encoded redundantly across at least two independent channels, at least one of which is non-chromatic and non-motion (C-accessibility, C-8, WCAG 2.2 AA). *Why:* color-blindness, low vision, monochrome/reduced-motion contexts, and cultural color variance make any single channel unreliable. *Verify:* removing color (grayscale render) and disabling motion each still leaves every state distinguishable.

**VL-8 (MUST).** The states **verified**, **unverified**, and **unknown/unassessed** MUST be mutually and unambiguously distinct, MUST NOT be distinguished by color alone, and MUST NOT be visually collapsed or made to resemble one another (C-1, C-8). Absence of a verified treatment MUST NOT be readable as verified. Fail-secure: where trust state is unknown it is presented as **unverified**, never as verified or blank-implying-safe. *Verify:* the three states pass the grayscale + no-motion test and a naive viewer cannot mistake unverified for verified.

**VL-9 (MUST).** Each semantic listed below is governed by the stated RULE (the *value* is delegated). Every semantic MUST be encoded multi-channel per VL-7.

| # | Semantic | Governing rule (value-independent) |
|---|----------|-------------------------------------|
| VL-9.1 | Importance | Encoded by relative hierarchy weight, not by absolute loudness; the single most important element per view is unambiguously dominant. |
| VL-9.2 | Urgency | Reserved for genuinely time- or safety-bound states; MUST NOT be manufactured; MUST be proportionate to real consequence. |
| VL-9.3 | Hierarchy | Expressed through consistent, ordered contrast in weight/scale/position such that primary > secondary > tertiary is perceivable pre-attentively. |
| VL-9.4 | Success | Distinct positive-completion treatment, multi-channel, never color-alone; MUST correspond to an actually completed action. |
| VL-9.5 | Failure | Distinct, calm, non-alarming yet unmissable; states what failed and never blames the user (honest errors). |
| VL-9.6 | Warning | Signals reversible risk before commitment; visually below failure in force, above neutral; multi-channel. |
| VL-9.7 | Confirmation | Visually acknowledges a completed or pending user intent; distinct from success (intent vs. outcome). |
| VL-9.8 | Relationship | Represents a connection between people/entities as mutual and bounded; MUST NOT imply a relationship the parties have not consented to. |
| VL-9.9 | Identity | Represents a person/entity consistently and recognizably; MUST NOT infer or display identity attributes the person has not chosen to expose (C-consent, non-inference). |
| VL-9.10 | Progress | Truthfully reflects real, monotonic advancement of an actual process; MUST NOT fabricate motion or completion. |
| VL-9.11 | Trust | Legible, evidence-based, and traceable to a stated basis; MUST NOT be conferred by aesthetic polish alone (see VL-11). |
| VL-9.12 | Privacy | Communicates who can see/do what, by default and at a glance; visibility scope is always perceivable before disclosure. |
| VL-9.13 | Safety | Safety affordances (report, block, exit, help) are always visually reachable and never hidden behind aesthetic minimalism (C-safety-reachable). |
| VL-9.14 | Premium status | Expressed through restraint, spatial generosity, and precision — never through added ornament, gold-plating, or exclusion cues. |
| VL-9.15 | Community | Represents plural, inclusive belonging; MUST NOT visually privilege one language, script, region, complexion, or group as default-human. |
| VL-9.16 | Membership | Distinguishes member states factually and without shaming non-members; MUST NOT weaponize status. |
| VL-9.17 | Compatibility | Presented as assistive signal with stated basis and uncertainty; MUST NOT be shown as deterministic fact or destiny (T3). |
| VL-9.18 | Verification | Denotes what was verified, by whom/what, and when; scope-bounded (a verified email is not a verified person). See VL-8. |
| VL-9.19 | Discovery | Frames found content as options, not obligations; MUST NOT visually coerce selection. |
| VL-9.20 | Learning | Represents growth of understanding without punishing ignorance; supportive, non-judgmental treatment. |
| VL-9.21 | Growth | Represents progress over time honestly; MUST NOT inflate or gamify beyond the real change. |
| VL-9.22 | AI-assistance | Always visibly labeled as AI, positioned as assistance not authority, and bounded by consent (C-ethical-AI). |
| VL-9.23 | Human-assistance | Distinguishable from AI-assistance; a human source is never visually disguised as system, nor system as human. |
| VL-9.24 | System-intelligence | Presented as tooling that supports the user's judgment, never as a verdict on a person's worth or character (non-inference). |
| VL-9.25 | System-confidence | Confidence/uncertainty is shown honestly and proportionately; high visual assurance MUST NOT accompany low actual certainty. |

**VL-10 (MUST NOT).** No semantic in VL-9 MUST be expressed by inferring character, worth, trustworthiness, or desirability from appearance, complexion, caste, religion, region, language, or script (C-non-inference, T4). *Verify:* no visual treatment ranks, ranks-by-proxy, or beautifies persons by such attributes.

# 4. Visual Identity

**VL-11 (MUST).** Identity MUST be expressed through consistency, restraint, precision, and clarity — the recognizable "feel" of Sambandh — rather than through ornament or trend. Brand recognition MUST arise from disciplined repetition of principle, not from decoration. *Why:* premium-through-restraint; consistency-over-novelty. *Verify:* identity remains recognizable when reduced to layout, hierarchy, and spacing alone.

**VL-12 (MUST NOT).** Identity treatments MUST NOT override or weaken any Tier 1-4 requirement (legibility, contrast, accessibility, trust-legibility, safety reachability). Brand never wins over safety, consent, honesty, or dignity (Article 4). *Verify:* no identity element reduces contrast, hides safety affordances, or obscures verification state.

# 5. Visual Consistency

**VL-13 (MUST).** Identical meanings MUST receive identical visual treatment across every surface, feature, platform, device, and team; different meanings MUST receive distinguishable treatment. *Why:* consistency lowers cognitive load (T5) and builds recognition/trust. *Verify:* a semantic audit finds no meaning rendered two ways and no two meanings rendered identically.

**VL-14 (SHOULD).** New patterns SHOULD be introduced only when no existing pattern conveys the meaning; novelty for its own sake is prohibited. Deviation requires recorded justification. *Verify:* new-pattern proposals cite the gap in the existing system.

# 6. Visual Integrity

**VL-15 (MUST).** Visual treatment MUST correspond to underlying reality: a "verified" mark implies real verification; a filled progress bar implies real progress; a "secure/private" treatment implies real privacy. Visual assertions the system cannot back are prohibited (T3, integrity). *Verify:* each state treatment traces to a system truth source.

**VL-16 (MUST NOT).** Placeholder, mock, sample, or illustrative visuals MUST NOT be presented as real user data, real matches, or real activity. *Verify:* demo/synthetic content is labeled as such.

# 7. Visual Hierarchy

**VL-17 (MUST).** Every view MUST establish a single clear primary focus and an ordered descent to secondary and tertiary elements, matching the user's actual task priority and the Article 4 ordering (safety/consent affordances are never demoted below aesthetic or promotional elements). *Verify:* squint/blur test reveals one dominant element; safety and consent controls are never the least visible.

**VL-18 (MUST NOT).** Promotional, upsell, or growth elements MUST NOT be given hierarchy above safety, consent, privacy, or the user's current task (T9 lowest). *Verify:* no view foregrounds business elements over higher-tier ones.

# 8. Perceptual Clarity

**VL-19 (MUST).** Elements MUST be perceptually clear: distinguishable from background, from each other, and from noise, under real-world conditions (small screens, glare, low vision, low bandwidth). *Verify:* clarity holds at minimum supported viewport, reduced acuity simulation, and degraded rendering.

# 9. Information Visibility

**VL-20 (MUST).** Information the user needs for the current decision MUST be visible when needed; critical state (privacy scope, verification state, cost, consequence) MUST NOT be hidden behind interaction the user has no reason to perform. *Verify:* decision-critical information is present at the point of decision without extra discovery.

**VL-21 (SHOULD).** Secondary information SHOULD be progressively disclosed to protect focus, provided its existence is discoverable. *Verify:* disclosure affordances are perceivable.

# 10. Information Density

**VL-22 (MUST).** Density MUST be tuned to comprehension, not to filling or emptying space: enough to complete the task without fragmentation, not so much as to overload (T5, T6). *Verify:* task can be completed without scrolling past unnecessary elements and without overflow of simultaneous decisions beyond working-memory limits.

# 11. Whitespace Philosophy

**VL-23 (MUST).** Whitespace is a functional material that groups, separates, prioritizes, and calms — not empty leftover. Whitespace MUST be used deliberately to encode relationship and hierarchy. *Why:* supports calm (T6) and grouping/Gestalt (T5). *Verify:* spacing correlates with semantic relationship (related items closer than unrelated).

**VL-24 (MUST NOT).** Whitespace MUST NOT be sacrificed to cram promotional content, nor inflated to the point of hiding needed information below the fold. *Verify:* neither cramming nor concealment is present.

# 12. Spatial Organization

**VL-25 (MUST).** Spatial placement MUST be meaningful and predictable: recurring functions occupy stable, learnable locations across the product. *Why:* spatial memory reduces load and builds confidence. *Verify:* equivalent functions appear in consistent regions across views.

# 13. Alignment

**VL-26 (MUST).** Elements MUST align to a shared underlying structure; arbitrary or accidental misalignment is prohibited. *Why:* alignment signals order, quality, and relationship. *Verify:* elements share alignment references; no unjustified offsets.

# 14. Balance

**VL-27 (SHOULD).** Composition SHOULD be visually balanced (symmetric or intentionally asymmetric) so no region pulls disproportionate attention unless hierarchy demands it. *Verify:* visual weight distribution matches intended hierarchy.

# 15. Rhythm

**VL-28 (SHOULD).** Repeating elements SHOULD follow a consistent visual rhythm (predictable recurrence of spacing and structure) to aid scanning and reduce load. *Verify:* repeated structures are regular; irregularities are meaningful.

# 16. Proportion & 17. Scale

**VL-29 (MUST).** Relative size MUST encode relative importance consistently; scale MUST NOT be used to exaggerate, intimidate, or manufacture urgency. *Verify:* larger = more important holds consistently; no scale used purely for pressure.

**VL-30 (MUST).** Proportional relationships MUST remain coherent across viewport sizes and adaptive layouts; hierarchy MUST survive scaling and reflow. *Verify:* hierarchy order is preserved at all supported sizes.

# 18. Contrast

**VL-31 (MUST).** Contrast between foreground meaning and background, and between distinct states, MUST meet or exceed WCAG 2.2 AA and MUST be sufficient for the element's role (text, essential graphics, state indicators, focus). This is a Tier 1-4 non-negotiable. *Verify:* measured contrast passes AA for all in-scope elements including focus and state indicators.

**VL-32 (MUST).** Contrast MUST NOT be the sole carrier of a meaning (pairs with VL-7); low-contrast decorative differences MUST NOT be load-bearing. *Verify:* meaning survives contrast reduction to the AA floor.

# 19. Unity & 20. Harmony

**VL-33 (MUST).** All elements of a view MUST read as one coherent system; disparate, clashing, or stylistically foreign elements are prohibited. *Verify:* no element appears imported from a different design system without cause.

# 21. Emphasis & 22. Focus

**VL-34 (MUST).** Emphasis MUST be reserved and rationed: emphasizing everything emphasizes nothing. At most one primary emphasis per view; emphasis MUST map to genuine importance. *Verify:* count of emphasized elements is minimal and justified.

**VL-35 (MUST).** Keyboard/assistive focus MUST always be clearly and visibly indicated, meeting AA, and MUST NOT be suppressed for aesthetics (accessibility floor). *Verify:* focus is visible on every interactive element via keyboard.

# 23. Movement & Motion

**VL-36 (MUST).** Motion MUST be purposeful — conveying continuity, causality, spatial relationship, or state change — never decorative spectacle. Motion MUST NOT be the sole carrier of meaning (VL-7) and MUST respect reduced-motion preferences with a functionally equivalent static alternative. *Why:* calm-over-stimulation; accessibility. *Verify:* every animation has a stated function; reduced-motion path preserves all meaning; no infinite attention-grabbing motion without cause.

**VL-37 (MUST NOT).** Motion MUST NOT be used to manufacture urgency, simulate false progress, or compel engagement. *Verify:* no motion escalates solely to drive action.

# 24. Composition & 25. Visual Flow

**VL-38 (MUST).** Composition MUST guide the eye along the intended task sequence, respecting the reading order of the active locale/script, and MUST NOT assume a single language, script, numeral system, or left-to-right direction (C-inclusion). *Verify:* flow follows task order and adapts to RTL and other locales without breaking hierarchy.

# 26. Depth & 27. Layering

**VL-39 (MUST).** Depth and layering MUST express real relationships (elevation = focus/temporary/overlay; grouping = same layer) consistently, and MUST NOT be used as gratuitous skeuomorphic ornament. Layer order MUST NOT obscure safety or consent affordances. *Verify:* depth cues map to consistent meaning; overlays never trap or hide exit/safety controls.

# 28. Grouping & 29. Gestalt & 30. Figure-Ground

**VL-40 (MUST).** Related items MUST be visually grouped (proximity, common region, similarity, continuity) and unrelated items separated, exploiting Gestalt principles to reduce cognitive load. Figure MUST be clearly separable from ground. *Verify:* grouping matches semantic relatedness; primary content is unambiguously figure against ground.

# 31. Visual Continuity & 32. Visual Stability

**VL-41 (MUST).** The interface MUST maintain continuity across states and transitions (objects persist and transform rather than teleport) and stability (elements do not shift unexpectedly, especially under async load). Unexpected layout shift that could cause mis-taps on consequential actions is prohibited. *Verify:* no destabilizing shift after interactive elements become active; transitions preserve object identity.

# 33. Predictability

**VL-42 (MUST).** Visual patterns MUST behave predictably: the same visual signal implies the same meaning and outcome everywhere, every time. *Why:* predictability is trust. *Verify:* no context reuses a signal for a conflicting meaning.

# 34. Readability & 35. Legibility

**VL-43 (MUST).** Text and essential glyphs MUST be legible and readable at supported sizes, across scripts and locales, meeting AA, with user text-scaling honored without loss of content or function. This is Tier 1-4 non-negotiable. *Verify:* content remains readable and complete at increased text scale and across supported scripts.

# 36. Scanability

**VL-44 (SHOULD).** Layouts SHOULD support scanning (clear headings, grouping, predictable structure, front-loaded meaning) so users can locate what they need without reading everything. *Verify:* key information is findable via scan patterns in usability review.

# 37. Discoverability

**VL-45 (MUST).** Essential functions — especially safety, privacy, consent, and exit — MUST be discoverable without prior knowledge and MUST NOT rely on hidden gestures or invisible affordances as their only access path. *Verify:* first-time users can locate essential and safety functions unaided.

# 38. Visual Simplicity & 39. Complexity Management & 40. Cognitive Load Reduction

**VL-46 (MUST).** Complexity MUST be managed toward the minimum the task genuinely requires: reduce, group, sequence, and defer rather than expose all at once. Simplicity MUST NOT be achieved by hiding needed or safety-critical information (that is concealment, not simplicity). *Why:* T5 understanding, T6 calm. *Verify:* no gratuitous complexity remains; no needed/safety information was removed in its name.

# 41. Recognition Support

**VL-47 (MUST).** The interface MUST favor recognition over recall: meanings, states, and options are visible or easily surfaced rather than requiring memorization, and MUST NOT rely on a symbol whose meaning is not learnable or labeled. *Verify:* critical symbols carry text or accessible labels; users need not memorize opaque icons.

# 42. Emotional Expression

**VL-48 (MUST).** Emotional tone MUST be calm, respectful, and steady; the visual language MUST NOT exploit anxiety, loneliness, jealousy, FOMO, or vanity, and MUST NOT emotionally manipulate toward engagement or spend (T6 > T9, dignity). *Verify:* no treatment weaponizes negative emotion; tone review passes.

# 43. Trust Communication

**VL-49 (MUST).** Trust MUST be communicated through legible evidence with stated basis and scope — what was verified, by what authority, when — and MUST NOT be implied by polish, badges without backing, or social pressure. *Verify:* every trust signal is traceable to a real basis and its scope is bounded (VL-9.18).

# 44. Privacy Communication

**VL-50 (MUST).** Privacy state MUST be visible by default, before disclosure: who can see this, what is shared, what is default-private. Privacy-affecting choices MUST be presented neutrally, never nudged toward over-disclosure (privacy-by-default; ambiguous consent → not-consented). *Verify:* visibility scope is shown pre-disclosure; no dark-pattern nudge toward exposure.

# 45. Safety Communication

**VL-51 (MUST).** Safety affordances (report, block, exit, help, emergency guidance) MUST be persistently reachable, discoverable, and never visually suppressed, demoted, or obscured by overlays or minimalism (C-safety-reachable, Tier 1). *Verify:* safety controls are reachable from every relevant surface within the interface, including modal/overlay states.

# 46. Professionalism

**VL-52 (MUST).** The visual language MUST read as professional, precise, and maintained: no broken, misaligned, placeholder, or half-finished visuals in production. *Verify:* production audit finds no unfinished or defective visual states shipped unlabeled.

# 47. Luxury Without Excess

**VL-53 (MUST).** Premium quality MUST be expressed through space, precision, restraint, and consistency — never through ornament, maximalism, exclusionary cues, or visual excess (premium-through-restraint). *Verify:* perceived premium quality survives removal of any purely decorative element.

# 48. Warmth Without Informality

**VL-54 (SHOULD).** Visual tone SHOULD be warm and human while remaining dignified and precise; warmth MUST NOT degrade into casualness, flippancy, or reduced clarity in consequential contexts (safety, consent, money). *Verify:* consequential flows retain seriousness; warmth does not undercut clarity.

# 49. Confidence Without Aggression

**VL-55 (MUST).** The visual language MUST project confidence through clarity and steadiness, and MUST NOT use aggressive, loud, or pressuring treatments. *Verify:* no treatment reads as demanding or intimidating.

# 50. Friendliness Without Casualness / 51. Minimalism Without Emptiness / 52. Elegance Without Ornamentation / 53. Innovation Without Novelty-for-its-own-sake

**VL-56 (MUST).** These tensions MUST be resolved toward the higher-tier pole: clarity over friendliness, information-sufficiency over minimalism, legibility over elegance, and proven understanding over novelty. Novelty MUST NOT be introduced at the cost of consistency, predictability, or accessibility. *Verify:* for each, the resolution favors the higher Article-4 tier and no accessibility/consistency loss is traded for style.

# 54. Visual Perception (Synthesis Principles)

**VL-57 (MUST).** Visual design MUST respect human perceptual and cognitive limits as constraints, not suggestions:

| # | Perceptual basis | Governing principle (philosophy only) |
|---|------------------|----------------------------------------|
| VL-57.1 | Pre-attentive processing | The most important distinction in a view is encoded in a channel the eye resolves pre-attentively, so it is seen before it is read. |
| VL-57.2 | Attention is finite | Competing attention demands are minimized; at most one primary claim on attention per view. |
| VL-57.3 | Eye movement / scan paths | Layout anticipates natural and locale-dependent scan paths; critical information sits where the eye lands, not where it must hunt. |
| VL-57.4 | Pattern recognition | Consistent patterns let users recognize rather than re-interpret; pattern is not broken without meaning. |
| VL-57.5 | Visual memory | Stable placement and consistent signals let spatial and visual memory reduce future effort. |
| VL-57.6 | Working-memory limits | Simultaneous distinct decisions/options are kept within human working-memory bounds; excess is grouped, sequenced, or deferred. |
| VL-57.7 | Shape & spatial perception | Distinctions rely on robust shape/spatial cues, not fragile ones alone; supports VL-7. |
| VL-57.8 | Motion perception | Motion is used only where it genuinely aids perception of change or causality; otherwise it is a distraction and is removed. |
| VL-57.9 | Perceptual fatigue | Sustained-attention burden is minimized; no persistent, throbbing, or restless treatment. |
| VL-57.10 | Change blindness | Consequential state changes are made perceptible (not silent), while respecting calm and reduced-motion. |

*Verify:* each principle is testable against the corresponding perceptual failure mode in review.

# 55. Consistency Framework (Governance)

**VL-58 (MUST).** A single canonical visual-semantic system MUST govern all surfaces (global, cross-platform, cross-device, cross-feature, cross-team). Teams MUST draw from it and MUST NOT fork private visual meanings. *Verify:* no feature defines a conflicting meaning for a shared signal.

**VL-59 (MUST).** Visual meaning MUST degrade gracefully across device and capability (small screens, low bandwidth, monochrome, reduced motion, high-contrast, assistive tech): the meaning survives; only presentation adapts. *Verify:* every semantic passes across the supported capability matrix.

**VL-60 (MUST).** Evolution MUST follow SHIG-0001 lifecycle and semantic versioning. Changes MUST preserve or strengthen Tier 1-4 guarantees (never weaken). Deprecations MUST be announced, dated, migration-pathed, and phased — never silently swapped (reversibility; consistency). *Verify:* each change carries version, tier-impact assessment, and (for deprecations) a migration path.

# 56. Decision Framework

**VL-61 (MUST).** When visual solutions compete, they MUST be evaluated by the Article 4 lexicographic hierarchy: Safety/legality ▸ Consent/privacy ▸ Honesty of signal ▸ Dignity/inclusion ▸ Understanding/task ▸ Wellbeing/calm ▸ Consistency ▸ Craft/aesthetics ▸ Business/growth. A gain at a lower tier NEVER justifies a loss at a higher tier. *Verify:* the chosen option is not dominated at any higher tier by a rejected one.

**VL-62 (MUST).** The following visual properties are NON-NEGOTIABLE (Tier 1-4) and MUST NOT be traded for aesthetics, novelty, brand, or growth: legibility/readability (VL-43); contrast at AA (VL-31); non-color-only / multi-channel meaning (VL-7); visible focus (VL-35); trust-state legibility and verified/unverified/unknown distinction (VL-8, VL-49); safety reachability (VL-51); privacy visibility (VL-50); non-inference (VL-10); honesty/integrity of signal (VL-4, VL-15). *Verify:* no deviation record exists against these; any proposal touching them is rejected.

**VL-63 (SHOULD).** Lower-tier properties (rhythm, balance, ornamental refinement) MAY be traded when a higher tier requires it, with recorded justification naming the tier served (per SHIG-0001 grammar). *Verify:* deviations cite the higher tier.

**VL-64 (Decision table — worked criteria).**

| Conflict | Resolution rule | Basis |
|----------|-----------------|-------|
| Beauty vs. legibility | Legibility wins | T5/T8, VL-43 |
| Minimal look vs. showing safety control | Safety shown | T1, VL-51 |
| Brand color vs. AA contrast | Contrast wins | Accessibility floor, VL-31 |
| Delight animation vs. reduced-motion/calm | Static-equivalent, calm wins | T6, VL-36 |
| Engagement nudge vs. calm/consent | Calm/consent wins | T2/T6 > T9, VL-2/VL-50 |
| Color-only status vs. multi-channel | Multi-channel required | VL-7 |
| Aesthetic uniformity vs. verified≠unverified distinction | Distinction wins | VL-8 |
| Flattering visual inference vs. non-inference | Non-inference wins | T4, VL-10 |
| Novel pattern vs. consistency | Consistency wins unless it serves a higher tier | T7, VL-14 |

# 57. Validation & Audit

**VL-65 (MUST).** Each dimension below MUST be evaluated with the stated method and acceptance/rejection criterion. Any REJECT on a Tier 1-4 dimension blocks release.

| # | Dimension | Method | Accept | Reject |
|---|-----------|--------|--------|--------|
| VL-65.1 | Visual clarity | Squint/blur + reduced-acuity review | Primary focus and states identifiable | Ambiguous focus/state |
| VL-65.2 | Contrast (T1-4) | Measured contrast vs. AA | All in-scope pass AA | Any essential element below AA |
| VL-65.3 | Non-color-only (T1-4) | Grayscale + reduced-motion render | All meanings survive | Any meaning lost |
| VL-65.4 | Trust legibility (T1-4) | Verified/unverified/unknown discrimination test | All three distinct, not color-alone, fail-secure | Any confusable or color-alone |
| VL-65.5 | Consistency | Cross-surface semantic audit | No conflicting/duplicated meanings | Any conflict |
| VL-65.6 | Recognition | First-time-user locate-and-identify test | Users identify meaning/functions unaided | Frequent misidentification |
| VL-65.7 | Comprehension | Task comprehension test | Users state correct meaning/next step | Systematic misread |
| VL-65.8 | Information efficiency | Density/task analysis | Task doable without excess or concealment | Overload or hidden critical info |
| VL-65.9 | Cognitive efficiency | Load/working-memory analysis | Within human limits | Exceeds limits |
| VL-65.10 | User confidence | Post-task confidence/trust measure | Users report understanding and control | Confusion or distrust |
| VL-65.11 | Safety reachability (T1-4) | Reachability audit incl. overlays | Reachable everywhere relevant | Any surface without access |
| VL-65.12 | Privacy visibility (T1-4) | Pre-disclosure scope check | Scope visible pre-disclosure | Scope hidden or nudged |

**VL-66 (MUST).** Audit procedure: (a) inventory each visual signal and its asserted meaning; (b) verify multi-channel encoding (VL-7); (c) verify traceability to a real system truth (VL-15); (d) run VL-65 methods; (e) record tier-impact; (f) file deviations only against non-Tier-1-4 items with higher-tier justification; (g) sign-off requires zero Tier 1-4 rejects. Audits MUST recur on release and on any change touching VL-62 properties. *Verify:* audit record exists and is complete for each release.

# Compliance / Review Checklist

- [ ] Every visual element has a named communicative/navigational purpose (VL-1).
- [ ] No manufactured urgency, scarcity, streak, or compulsion (VL-2, VL-37, VL-48).
- [ ] No literal values (color/hex/type/size/spacing/icon/component) defined here (VL-3).
- [ ] Inference/prediction visually distinct from confirmed fact (VL-4, VL-15).
- [ ] Every meaning encoded in ≥2 independent channels; survives grayscale + no-motion (VL-7).
- [ ] Verified / unverified / unknown mutually distinct, not color-alone, fail-secure (VL-8).
- [ ] All VL-9 semantics governed by their rule and multi-channel.
- [ ] No character/worth/trust inferred from appearance/complexion/caste/religion/region/language (VL-10).
- [ ] Contrast meets AA for text, essential graphics, states, focus (VL-31, VL-43, VL-35).
- [ ] Identical meaning → identical treatment across all surfaces; no forks (VL-13, VL-58).
- [ ] Single clear primary focus; safety/consent never demoted below promotion (VL-17, VL-18).
- [ ] Decision-critical info (privacy scope, verification, cost, consequence) visible at decision point (VL-20, VL-50).
- [ ] Motion purposeful, reduced-motion equivalent, never sole carrier (VL-36).
- [ ] Flow adapts to locale/script/numeral/direction; no single-language assumption (VL-38).
- [ ] Safety affordances persistently reachable, incl. overlays (VL-51).
- [ ] Premium via restraint, not ornament/excess/exclusion (VL-53).
- [ ] Higher-tier pole chosen in all style tensions (VL-56, VL-61).
- [ ] No Tier 1-4 property traded away (VL-62); deviations only on lower tiers with justification (VL-63).
- [ ] Full VL-65 validation run; zero Tier 1-4 rejects; audit recorded (VL-66).
- [ ] Version/lifecycle/tier-impact recorded; deprecations phased with migration (VL-60).

# Anti-patterns

| Anti-pattern | Why it fails (tier) | Prevention |
|--------------|---------------------|------------|
| Clutter | Overloads attention/working memory; buries signal (T5/T6) | Density tuned to task; group/defer (VL-22, VL-46) |
| Decoration without meaning | Consumes attention, no communication; dishonest premium (T5/T8) | Every element earns purpose (VL-1, VL-53) |
| Inconsistent hierarchy | Users mis-prioritize; erodes predictability/trust (T5/T7) | Consistent ordered hierarchy (VL-17, VL-42) |
| Poor alignment | Signals disorder/low quality; breaks grouping (T7/T8) | Shared alignment structure (VL-26) |
| Low-contrast communication | Meaning invisible to low-vision/glare; AA fail (T1-4) | Enforce AA; multi-channel (VL-31, VL-7) |
| Ambiguous symbolism | Misread meaning; recall burden (T5) | Label/learnable symbols; recognition over recall (VL-47) |
| Trend-driven design | Instability, inconsistency, churn (T7) | Novelty only for a higher tier (VL-14, VL-56) |
| Over-animation | Distraction, fatigue, false urgency; motion-sensitivity harm (T2/T6) | Purposeful motion + reduced-motion equivalent (VL-36) |
| Visual noise | Lowers signal-to-noise; raises load (T5/T6) | Reduce/group/whitespace (VL-23, VL-46) |
| Brand inconsistency | Weakens recognition/trust (T7) | Canonical semantic system (VL-11, VL-58) |
| Cognitive overload | Exceeds human limits; errors, anxiety (T5/T6) | Sequence/defer; working-memory bounds (VL-57.6, VL-46) |
| Verified/unverified collapse | False trust; safety risk (T1-4) | Enforce distinct, multi-channel, fail-secure (VL-8) |
| Inference-as-fact visuals | Dishonest signal; dignity harm (T3/T4) | Distinguish inference; non-inference (VL-4, VL-10) |
| Hidden safety/privacy controls | Removes reachability; unsafe (T1/T2) | Persistent, discoverable affordances (VL-45, VL-51) |
| Dark-pattern nudging | Violates consent/calm for growth (T2/T6 > T9) | Neutral presentation; no manipulation (VL-2, VL-50) |

# Open Questions

1. Reference thresholds for VL-65 comprehension/recognition/confidence measures (pass rates) — to be set in a validation-metrics annex without introducing implementation values.
2. Canonical capability matrix for VL-59 graceful degradation (device/capability tiers) — owner: platform accessibility working group.
3. Governance body and cadence empowered to approve VL-14/VL-60 pattern additions and deprecations.
4. Locale/script coverage list for VL-38/VL-59 (India-first plus global) — coordination with localization spec.
5. Interaction boundary with the forthcoming design-token spec (SHIG-nnnn) to guarantee no value/principle overlap or contradiction.
6. Standard evidence schema for VL-49 trust basis/scope display, coordinated with the verification/trust spec.

# Revision History

| Version | Date | Status | Author | Notes |
|---------|------|--------|--------|-------|
| 1.0.0 | 2026-07-26 | Active | Chief Design Officer, Sambandh | Initial issuance of SHIG-0007 Visual Language Specification; principle- and semantics-level governance only; values delegated to design-token spec. Subordinate to SHIG-0000 (Constitution) and SHIG-0001 (rule grammar). |
# Specification ID

SHIG-0015

# Specification Name

Layout & Spatial System Specification

# Version

1.0.0

# Status

Active

# 1. Purpose & Scope

**LS-1** This specification MUST govern the spatial structure of every Sambandh surface: how elements are placed, aligned, grouped, spaced, sized as targets, ordered for traversal, and adapted across viewports. It governs *spatial relationships and properties* — grid logic, spacing rhythm, density, hierarchy-through-space, composition, whitespace-as-restraint, reading/traversal order, responsive adaptation, and minimum interactive target sizing — NOT any implementation of them.

**LS-2** This specification MUST NOT prescribe pixel, point, em, percentage, or millisecond values; a named grid framework, layout engine, component, or library; markup, style, or script; or any literal dimension. It governs the OUTCOME (e.g., "alignment MUST be systematic," "targets MUST meet the accessible minimum size") and never the mechanism or number that achieves it. Where a threshold is external and normative (e.g., WCAG 2.2 AA target sizing), the referenced standard's requirement governs, stated as a property, not restated as a number.

**LS-3** At every surface a member MUST be able to perceive, without effort: (a) which elements form a group, (b) which element is primary, (c) where to begin reading, (d) the order in which to proceed, (e) what is interactive and how far apart interactive elements sit, (f) where the surface's structure begins and ends. A layout that leaves any of (a)–(f) unresolvable is non-conformant.

**LS-4** Spatial position, proximity, alignment, or size MUST NEVER be the SOLE carrier of any meaning (grouping, state, priority, relationship, or category). Every meaning carried spatially MUST be reinforced by at least one non-spatial channel (per SHIG-0000 C-8; see LS-16, LS-40). This is a Tier-4 constraint and admits no deviation.

**LS-5** Trust, safety, and consent content MUST retain spatial priority under every space constraint. When available space forces reduction, such content MUST NEVER be the first to be dropped, collapsed below the point of reasonable discovery, or displaced by lower-tier content (SHIG-0000 Tiers 1–2, C-4 consent, C-5 safety; see LS-31, LS-46).

## 1.1 Cross-Instrument Relationships

**LS-6** This specification MUST comply with SHIG-0000 (Constitution): Article 4 lexicographic decision hierarchy and principles C-1..C-17. It MUST follow SHIG-0001 rule grammar and permanent-ID discipline. Philosophy defined in the Constitution and foundation MUST be referenced by ID, never restated.

**LS-7** This specification is DISTINCT from SHIG-0007 (Visual Language) and MUST NOT duplicate it: SHIG-0007 governs color, form, material, imagery, and visual style; this spec governs only the *spatial* arrangement of elements. Where a rule concerns how a thing looks rather than where it sits or how it relates in space, SHIG-0007 governs.

**LS-8** This specification is DISTINCT from SHIG-0018 (Typography) and MUST NOT duplicate it: SHIG-0018 governs type scale, weight, measure, and text rhythm; this spec governs the spatial *placement, grouping, and alignment* of blocks (including text blocks) and the whitespace around them. Where text-internal rhythm ends and inter-element spatial relationship begins, this spec governs the latter.

**LS-9** This specification MUST express the structure defined by SHIG-0005 (Information Architecture) and honor the mental models of SHIG-0006 (User Mental Models); spatial grouping and order MUST reflect the canonical IA relationships and MUST NOT invent adjacency the IA denies. It MUST cooperate with SHIG-0013 (Navigation & Wayfinding) — layout provides the spatial frame within which orientation cues live — without redefining navigation behavior. It MUST satisfy SHIG-0011 (Accessibility & Inclusive Design) as a floor.

**LS-10** Where this specification and any implementation guide conflict, this specification prevails. Where this specification and SHIG-0000/0001 conflict, the Constitution and foundation prevail. Where it and a sibling of equal standing (SHIG-0005/0006/0007/0011/0013/0018) appear to overlap, the instrument whose domain the rule belongs to governs, and the overlap MUST be resolved by amendment, not by contradiction.

## 1.2 Layout as Four Duties

**LS-11** Every layout MUST serve, in order of local precedence when these conflict: **Legibility of structure** (the member perceives groups, hierarchy, and order) ▸ **Integrity of priority** (higher-tier content holds higher spatial priority) ▸ **Adaptation without loss** (structure survives across viewports) ▸ **Restraint** (space is used with discipline, not filled). Conflicts among these, and with anything outside this list, MUST resolve by SHIG-0000 Article 4, not by this local order alone.

# 2. Spatial Principles

Each principle below is a normative requirement bearing its own permanent ID. Multiple spatial systems (grid, spacing scale, density modes) MAY coexist on one surface; when they do, LS-27 governs their reconciliation.

**LS-12 (Systematic structure)** Every surface MUST be composed on a shared, systematic spatial structure (a grid or equivalent alignment system) rather than by ad-hoc placement. Placement MUST be derivable from the system; arbitrary one-off positioning is non-conformant (C-16 systemic reuse).

**LS-13 (Alignment)** Elements MUST align to shared reference lines so that edges and starts form a coherent visual order. Misalignment that is not a deliberate, meaning-bearing choice is non-conformant. Optical alignment MAY override strict geometric alignment where the perceived result is more correct.

**LS-14 (Spacing rhythm)** Spacing between and within elements MUST follow a consistent, harmonically related scale rather than unrelated arbitrary gaps. The scale MUST be reused system-wide (C-16); spacing MUST NOT be improvised per surface.

**LS-15 (Proximity encodes relationship)** Spatial proximity MUST reflect real relatedness: elements that belong together MUST be closer to each other than to unrelated elements, and unrelated elements MUST be separated enough to read as distinct. Proximity MUST NOT imply a relationship the IA denies (LS-9).

**LS-16 (Hierarchy through space)** Visual hierarchy MUST be established through spatial means — position, isolation, scale of allotted space, and grouping — in concert with non-spatial means. A more important element MUST hold greater spatial priority, but that priority MUST be reinforced by at least one additional channel (LS-4, C-8).

**LS-17 (Whitespace as restraint)** Whitespace MUST be treated as an active, load-bearing element that establishes grouping, hierarchy, focus, and calm — never as empty space to be filled. Adding content solely to reduce whitespace is non-conformant (C-14 premium-through-restraint; C-10 calm).

**LS-18 (Density discipline)** Information density MUST match the surface's purpose and the member's task: dense where comparison or scanning demands it, spacious where focus, decision, or emotional weight demands it. Uniform maximal density is non-conformant (C-10, C-14). Density MUST NOT rise to the point that required trust/safety/consent content loses perceptual priority (LS-5).

**LS-19 (Composition & balance)** Composition MUST be intentional and balanced: visual weight MUST be distributed so that no region is unintentionally overloaded or starved, and the member's attention is guided to the primary element first. Balance MUST NOT be achieved by centering everything or by symmetry for its own sake where it harms hierarchy.

**LS-20 (Focal clarity)** Each surface MUST have a discernible primary focus appropriate to its purpose; competing elements MUST NOT contest primacy such that no clear starting point exists (LS-3b). A surface with no focal point, or many equal foci, is non-conformant.

**LS-21 (Grouping & separation)** Related elements MUST be grouped by shared spatial treatment (common alignment, common enclosure by whitespace, common region) and separated from unrelated groups. Group boundaries MUST be perceivable without relying on a single channel (C-8).

**LS-22 (Reading & traversal order)** The intended reading/traversal order MUST be unambiguous and MUST match the logical and IA order of the content. Spatial arrangement MUST NOT create an order that conflicts with the meaningful order or with the order assistive technology will convey (LS-40). Where reading direction is script-dependent, order MUST adapt (LS-38).

**LS-23 (Structural consistency)** Recurring content types MUST occupy consistent spatial positions and structures across surfaces and releases so members build a stable spatial map (C-15, Tier 7). A given role's placement MUST NOT move arbitrarily between surfaces.

**LS-24 (Interactive target size)** Every interactive target MUST meet at least the accessible minimum target size established by WCAG 2.2 AA, and SHOULD exceed it where the action is frequent, primary, or consequential. Targets below the accessible floor are non-conformant (C-8, Tier 4).

**LS-25 (Interactive target spacing)** Interactive targets MUST be separated by enough space to prevent accidental activation of an adjacent target, especially for consequential, destructive, or irreversible actions. Adjacent affordances with opposing consequences (e.g., confirm vs. cancel) MUST have spacing and/or arrangement that reduces mis-selection (C-7 reversibility, C-5 safety).

**LS-26 (Predictable regions)** The surface MUST divide into predictable regions with stable roles (primary content, supporting content, actions, orientation) so members and assistive technology can rely on where each role lives. Region roles MUST be conveyed by more than position alone (C-8; cooperates with SHIG-0013).

**LS-27 (System reconciliation)** When multiple spatial systems coexist (e.g., a coarse layout grid and a fine spacing scale, or distinct density modes), their relationship MUST be defined and consistent so they do not produce conflicting alignment or rhythm. Unreconciled competing systems are non-conformant.

# 3. Responsive & Adaptive Spatial Rules

**LS-28** The following viewport/device classes are in scope: small handheld, large handheld, tablet, laptop/desktop, large/wide display, and constrained or non-standard surfaces (foldable, split-view, embedded, low-bandwidth-simplified, print/export, and projected/large-format). Additional classes entering scope MUST be assessed against this section before member exposure (C-9 device plurality).

**LS-29 (Structural preservation)** Across all viewport classes, the *meaning* of the spatial structure — grouping, hierarchy, order, and role of each region — MUST be preserved. Presentation MAY reflow, restack, or re-scale; relationships MUST NOT invert or dissolve (Tier 7). A member MUST recognize the same surface across devices.

**LS-30 (Reflow without loss)** Content MUST reflow to fit the available viewport without loss of information, without requiring two-dimensional scrolling for one-dimensional content, and without clipping meaning (WCAG 2.2 reflow; C-8). Horizontal scrolling of the surface body MUST NOT be required to read primary content.

**LS-31 (Priority under constraint)** When space is constrained, elements MUST degrade in reverse order of tier priority: lower-tier decorative and business-promotional content yields first; understanding/task content next; and trust, safety, and consent content LAST and never below reasonable discovery (LS-5, SHIG-0000 Article 4). A responsive rule that drops or buries higher-tier content to preserve lower-tier content is non-conformant and admits no deviation.

**LS-32 (Order integrity on reflow)** When elements restack or reorder for a viewport, the resulting reading/traversal order MUST remain logical and MUST match the order conveyed to assistive technology (LS-22, LS-40). Reflow MUST NOT create a visual order that contradicts the programmatic order.

**LS-33 (Target sizing across inputs)** Minimum target size and spacing (LS-24, LS-25) MUST hold across input modalities — touch, pointer, stylus, remote, and switch/assistive input — with touch and imprecise inputs governing the floor. Targets MUST NOT shrink below the accessible minimum on any device (C-8).

**LS-34 (Density adaptation)** Density MAY increase on larger viewports and MUST relax on smaller ones to preserve legibility and target sizing; adaptation MUST NOT push density beyond the legibility or target-size floors on any class (LS-18, LS-24).

**LS-35 (Orientation & fold adaptation)** Layout MUST adapt gracefully to orientation changes and split/folded viewports without loss of structure, order, or reachability of trust/safety/consent content (LS-31). State and scroll position SHOULD be preserved across such changes.

**LS-36 (Bandwidth & capability plurality)** Layout MUST remain coherent under constrained bandwidth or reduced capability: a simplified spatial rendering MUST preserve grouping, hierarchy, order, and the priority of trust/safety/consent content (C-9, LS-31). Degraded rendering MUST NOT strand a member without the higher-tier content.

**LS-37 (Reachability)** On any viewport, primary and safety-critical actions MUST remain reachable without disproportionate effort (e.g., not stranded beyond reasonable scroll or in an unreachable region). Safety and support affordances MUST be reachable on every viewport class (C-5).

# 4. India-First Plurality & Directionality

**LS-38 (Reading direction)** Spatial order and alignment MUST adapt to the active script's reading direction; the layout MUST NOT assume a single direction. Start/end relationships MUST be defined logically (start-relative), not as fixed left/right, so mirroring is correct where the script requires it (C-9).

**LS-39 (Variable content extent)** Layout MUST accommodate the variable spatial extent of equivalent content across languages, scripts, name-forms, and numeral systems (e.g., longer translations, taller scripts, differing name structures) without truncation of meaning, broken alignment, or collapse of structure (C-9). Fixed-extent regions that clip plural content are non-conformant.

**LS-40 (Assistive-technology order & structure)** The programmatic reading/traversal order and grouping exposed to assistive technology MUST match the meaningful order and grouping (LS-22, LS-32). Spatial grouping MUST be reinforced by programmatic structure so that grouping is not lost when position is unavailable (C-8; this is the non-single-channel guarantee for space).

**LS-41 (No inference from spatial arrangement)** Spatial arrangement MUST NOT rank, order, prioritize, or cluster *people* in any way that encodes or implies an inference about character, worth, or trustworthiness from appearance, complexion, caste, religion, region, or language (C-3). Where people are arranged (lists, grids, comparisons), the spatial order MUST have an honest, declared, non-inferred basis (cooperates with SHIG-0013 NAV-23/64).

**LS-42 (Honest spatial signal)** Spatial prominence MUST correspond to honest importance and MUST NOT be used to make an inference, prediction, or unverified claim appear as established fact, nor to manufacture prominence a thing has not earned (C-2). Sponsored, promoted, or algorithmically ordered spatial placement MUST be distinguishable by a non-spatial channel and MUST NOT masquerade as neutral primacy.

**LS-43 (Calm composition)** Spatial composition MUST support calm: it MUST NOT use crowding, aggressive proximity, forced visual pressure, or spatial interruption to manufacture urgency, anxiety, or compulsion (C-10). Interruptive elements MUST NOT seize spatial primacy over the member's current task except where safety (Tier 1) requires it.

# 5. Surface-Type Spatial Requirements

**LS-44** Each surface type below MUST satisfy its row. Columns: **Spatial priority (what holds highest spatial priority)**, **Density stance**, **Constraint-degradation rule (what yields first / never)**, **Governing IDs**. All rows inherit LS-3 (six perceivables), LS-4 (never single-channel), LS-5/LS-31 (trust/safety/consent never first dropped), and LS-24/LS-25 (target size & spacing).

| # | Surface type | Spatial priority | Density stance | Constraint-degradation rule | Governing IDs |
|---|--------------|------------------|----------------|-----------------------------|---------------|
| LS-45 | Onboarding / setup | Current step, its inputs, and progress | Spacious; one decision in focus | Decoration yields first; step + progress + consent never dropped | LS-16, LS-20, LS-31 |
| LS-46 | Consent / permission | The consent statement, its scope, and the granular choice (C-4 consent) | Spacious; no crowding of choices | Nothing that reduces comprehension may yield; consent holds highest priority always | LS-5, LS-31, LS-43 |
| LS-47 | Verification / trust status | The honest current trust state and next action | Spacious; unambiguous | Trust-state block never dropped or buried; fail-secure to "unverified" if state unknown | LS-5, LS-31, LS-42 |
| LS-48 | Profile (self & others) | Identity and its verified/unverified signal; visibility scope | Balanced | Visibility/consent scope never dropped; decoration first | LS-16, LS-41, LS-42 |
| LS-49 | People lists / grids / comparison | The honest, declared ordering basis; each item's distinctness | Dense-for-scan permitted | Ordering-basis disclosure never dropped; no inference-encoding arrangement | LS-15, LS-41, LS-42 |
| LS-50 | Conversations | Current thread, stage/consent context, and composer | Balanced; calm | Stage/consent context never dropped; draft position preserved | LS-22, LS-31, LS-43 |
| LS-51 | Payments / checkout | Amount, currency, finality, and the confirm/cancel pair | Spacious; unhurried | Amount/finality/cancel never dropped; confirm and cancel spatially separated | LS-24, LS-25, LS-31 |
| LS-52 | Forms / data entry | The active field, its label, and error/help in proximity | Balanced | Required-consent and error text never dropped; label-field proximity preserved | LS-15, LS-21, LS-31 |
| LS-53 | Errors / empty / loading | The honest state message and at least one forward + one return action | Spacious | Recovery actions never dropped; no dead-end layout | LS-3, LS-31, LS-37 |
| LS-54 | Settings / controls | The control and its effect/reversibility statement | Balanced; grouped by model | Effect/reversibility text never dropped; grouping preserved | LS-21, LS-23, LS-31 |
| LS-55 | Dashboards / overview | The member's primary task or status; honest state | Dense permitted | Safety/support reachability preserved; promotional tiles yield first | LS-18, LS-31, LS-37 |
| LS-56 | Notifications / interruptions | The notice's meaning and its dismiss/control | Calm; non-pressuring | Must not seize primacy over task except for Tier-1 safety; control never dropped | LS-43, LS-37 |
| LS-57 | Safety / report / support | The safety/report/support action itself | Spacious; unobstructed | Never dropped, never obstructed, reachable on every viewport (C-5) | LS-5, LS-37 |
| LS-58 | Content / learning / reading | The primary readable content and resume position | Spacious; focus | Reading order and resume position preserved; chrome yields first | LS-17, LS-22, LS-32 |
| LS-59 | Modals / overlays | The modal's purpose and its explicit close/return | Focused | Close/return affordance never dropped; underlying context recoverable | LS-20, LS-37 |

# 6. State & Lifecycle Spatial Rules

**LS-60 (State-stable structure)** The spatial structure MUST remain stable across a surface's states (loading, empty, populated, error, success); state changes MUST NOT cause disorienting relayout or unexplained shifts of established regions (C-13, C-10). Space reserved for incoming content SHOULD be held so arrival does not displace what the member is reading.

**LS-61 (Honest empty & loading space)** Empty and loading states MUST occupy space honestly — neither faking populated content spatially nor collapsing to a bare void with no orientation. Placeholder space MUST NOT imply content or a quantity that does not exist (C-2, C-13).

**LS-62 (No layout shift stealing intent)** Late-arriving or shifting elements MUST NOT relocate an interactive target into the path of a member's imminent action such that the wrong action is taken (C-7, C-5). Reserved space or deferred insertion MUST be used to prevent intent theft.

**LS-63 (Success & confirmation space)** Success and confirmation states MUST give the confirming information clear spatial priority and MUST NOT be crowded out by onward promotional content (C-13; Tier 9 never over Tier 3/5).

# 7. Multi-Platform Spatial Parity

**LS-64** The in-scope platforms are those in LS-28 plus voice/ambient and spatial/XR surfaces to the extent they render spatial or spatialized structure. Parity is of *structure and meaning*, not of pixels.

**LS-65 (Conceptual spatial parity)** Across platforms, grouping, hierarchy, order, region roles, and the priority of trust/safety/consent content MUST be conceptually identical (LS-29). A member's learned spatial map MUST transfer without relearning (Tier 7).

**LS-66 (Non-visual equivalence)** On non-visual, voice, and ambient surfaces where two-dimensional space is unavailable, the *relationships* that space would convey (grouping, order, hierarchy, priority) MUST be conveyed through the available modality with equivalent meaning (LS-40, C-8). Spatial grouping MUST never be the only way a relationship is expressed.

**LS-67 (Spatial/XR reference & comfort)** On spatial/XR surfaces, layout MUST preserve grouping, hierarchy, order, and a reliable return-to-reference (cooperating with SHIG-0013), MUST keep interactive targets within comfortable reach and adequately separated (LS-24/25 generalized), and MUST NOT use immersive spatial pressure to manufacture urgency (C-10).

**LS-68 (Export/print fidelity)** In print and export renderings, spatial grouping, order, and the presence of trust/safety/consent content MUST be preserved; content MUST NOT be silently dropped because a region does not fit (LS-31).

# Decision Framework

**LS-69** When choosing among competing layout or spatial options, teams MUST apply SHIG-0000 Article 4 lexicographically. An option that better serves a lower tier MUST NOT be chosen over one that better serves a higher tier; a lower-tier gain NEVER justifies a higher-tier loss.

**LS-70 (Selection rule)** Among options that violate no higher tier, teams MUST prefer the one that (a) most clearly conveys structure and honest hierarchy (Tiers 3–5), then (b) best preserves the priority of trust/safety/consent content under constraint (Tiers 1–2 — already mandatory, used here as a tiebreak toward robustness), then (c) is most consistent with the established spatial system (Tier 7), then (d) is most restrained and crafted (Tiers 6, 8, 14-restraint). Business/growth preference (Tier 9) breaks ties only after all higher tiers are equal.

**LS-71 (Non-negotiable spatial guarantees)** The following MUST NOT be traded for any lower-tier benefit: space is never the sole carrier of meaning (LS-4, Tier 4); trust/safety/consent content never first dropped and never below reasonable discovery (LS-5/LS-31, Tiers 1–2); accessible minimum target size and spacing (LS-24/LS-25/LS-33, Tier 4); programmatic order/grouping matches meaning (LS-40, Tier 4); no inference-encoding spatial arrangement of people (LS-41, Tier 4); honest spatial signal (LS-42, Tier 3); reflow without loss (LS-30, Tier 4); calm, non-manufactured-urgency composition (LS-43, Tier 6).

**LS-72 (Fail-secure spatial resolution)** When the correct spatial treatment is ambiguous or a required input is unknown (e.g., unknown trust state, unknown content extent, unknown viewport capability), layout MUST resolve conservatively: preserve higher-tier content, preserve the accessible floor, and treat unknown trust state as unverified. Ambiguity MUST NOT resolve toward denser, lower-tier, or less-accessible outcomes.

**LS-73 (Deviation record)** Any SHOULD-level deviation MUST record a written justification naming the higher tier it serves, per SHIG-0001. MUST-level requirements admit no deviation.

**LS-74 (Decision table)**

| Situation | Competing pull (tiers) | Required resolution | Governing IDs |
|-----------|------------------------|---------------------|---------------|
| Small viewport can't fit consent + promo together | Business/growth (T9) vs Consent (T2) | Drop promo; keep consent at full priority | LS-5, LS-31, LS-71 |
| Denser grid fits more people per screen | Task/scan (T5) vs Target size & calm (T4/T6) | Keep target-size floor and spacing; relax density | LS-24, LS-25, LS-34 |
| Visual reorder for aesthetics changes reading order | Craft (T8) vs Understanding/AT order (T4/T5) | Preserve programmatic = meaningful order | LS-22, LS-32, LS-40 |
| Position alone signals "verified" vs "unverified" | Craft/consistency (T7/T8) vs Accessibility (T4) | Add non-spatial channel; position may not be sole | LS-4, LS-40 |
| Ordering people by an engagement model correlates with a protected proxy | Business (T9) vs Dignity (T4) | Prohibited; use honest declared non-inferred basis | LS-41, LS-42, LS-71 |
| Fill empty space with promotional tiles | Business (T9) vs Restraint/calm (T6/T14) | Preserve whitespace; do not fill for filling's sake | LS-17, LS-43 |
| Confirm and cancel placed adjacent and equal | Density (T5) vs Safety/reversibility (T1/T7) | Separate/differentiate to prevent mis-selection | LS-25, LS-51 |
| Late-loading banner pushes content as member taps | Business (T9) vs Safety/agency (T1/T7) | Reserve space; no intent theft | LS-62 |
| Translation overflows a fixed region | Consistency (T7) vs Inclusion (T4/C-9) | Accommodate variable extent; no truncation of meaning | LS-39 |
| Trust badge dropped first on constrained export | Craft (T8) vs Safety/honesty (T1/T3) | Trust/safety/consent preserved last, never first | LS-5, LS-31, LS-68 |

# Quality Framework (Measurable)

**LS-75** Each attribute below MUST have a defined measurement method and a recorded accept/reject threshold per release. Conformance claims MUST be backed by measurement, not opinion (C-17). Unmeasured surfaces are treated as non-conformant (fail-secure).

| # | Quality attribute | What it measures | Accept | Reject |
|---|-------------------|------------------|--------|--------|
| LS-76 | Structural legibility | Members correctly identify groups, primary element, and start point when probed | Meets target correct-identification rate | Members misread structure above threshold |
| LS-77 | Alignment & rhythm systematicity | Placement/spacing derives from the shared system | All measured placement/spacing on-system | Any ad-hoc off-system placement/spacing (AP-1) |
| LS-78 | Hierarchy clarity | A single clear primary focus and honest priority ordering exist | One clear focus; priority matches importance | No/ambiguous focus, or dishonest prominence (AP-2, AP-9) |
| LS-79 | Never-single-channel | Every spatially-carried meaning has a non-spatial reinforcement | Zero meanings carried by space alone | Any space-only meaning (LS-4) present (AP-7) |
| LS-80 | Target size & spacing | Interactive targets meet the accessible minimum size and anti-mis-tap spacing across inputs | Full conformance on all input classes | Any target below floor or unsafe adjacency (AP-6) |
| LS-81 | Reflow integrity | Content reflows across viewport classes without loss, clipping, or forced 2-D scroll | Full reflow conformance all classes | Any loss/clip/forced scroll (AP-4) |
| LS-82 | Order integrity | Visual order matches meaningful and programmatic order across viewports | Full match | Any visual↔programmatic order conflict (AP-5) |
| LS-83 | Priority-under-constraint | Trust/safety/consent content retained last, never first dropped or buried | Higher-tier content always preserved | Any higher-tier drop/burial under constraint (AP-3) |
| LS-84 | Density appropriateness | Density matches task without breaching legibility/target/calm floors | Within task-appropriate band | Uniform max density or floor breach (AP-8) |
| LS-85 | Whitespace discipline | Whitespace used as structure, not filled for filling | Restrained, purposeful spacing | Space filled to eliminate whitespace (AP-9) |
| LS-86 | Non-inference of arrangement | People arrangement has honest declared non-inferred basis | Zero inference-encoding arrangement | Any protected-proxy or character-inferred order (AP-11) |
| LS-87 | Spatial-signal honesty | Prominence corresponds to honest importance; promoted placement disclosed | Honest, disclosed prominence | Manufactured/undisclosed prominence (AP-10) |
| LS-88 | Layout stability | No disorienting shift or intent theft across states/loads | Stable, reserved, no intent theft | Any intent theft or disorienting shift (AP-12) |
| LS-89 | Cross-platform spatial parity | Grouping/hierarchy/order/roles conceptually identical across platforms | Full conceptual parity | Any meaning divergence (AP-13) |
| LS-90 | Plurality accommodation | Variable script/language/name/numeral extent handled without truncation | Full accommodation | Any meaning-truncation or structural collapse (AP-14) |

**LS-91 (Release gate)** A release MUST NOT ship if any Tier 1–4-linked attribute is in Reject: LS-79 (single-channel), LS-80 (target size/spacing), LS-81 (reflow loss), LS-82 (order integrity), LS-83 (priority-under-constraint), LS-86 (non-inference), LS-90 (plurality). Tier 5–9 rejects MUST be recorded with a remediation plan per SHIG-0001. Unknown or unmeasured state on any gated attribute is treated as Reject (fail-secure).

# Governance

**LS-92** This specification is Tier 1–4 in effect and, per SHIG-0000, MAY only be strengthened, never weakened, by future revisions. A future revision MUST NOT lower a floor (target size, accessibility, priority-under-constraint, non-single-channel, non-inference).

**LS-93** Requirement IDs are permanent. A superseded requirement MUST be marked Deprecated, never reused, renumbered, or gap-filled. New requirements MUST append with the next sequential ID.

**LS-94** Every layout or spatial change MUST cite the LS IDs it satisfies and MUST record any SHOULD-level deviation with its higher-tier justification (LS-73). MUST-level requirements admit no deviation.

**LS-95** On any ambiguity or unknown state, layout MUST fail secure per LS-72: preserve higher-tier content, preserve accessible floors, resolve unknown trust to unverified. A surface whose spatial conformance cannot be evidenced is non-conformant.

**LS-96** Conflicts between this specification and any implementation guide resolve in favor of this specification; conflicts with SHIG-0000/0001 resolve in favor of those anchor instruments; overlaps with sibling specs resolve per LS-10 by amendment, never by contradiction.

**LS-97** New viewport classes, input modalities, or platforms entering scope MUST be assessed against §3, §4, §6, and the §Quality gate before member exposure (C-9).

# Compliance / Review Checklist

- **LS-98** All six perceivables (LS-3) verifiable on every reviewed surface, including modals, errors, empty, and loading states.
- **LS-99** No meaning is carried by spatial position, proximity, alignment, or size alone; each has a non-spatial reinforcement (LS-4, LS-40, LS-79).
- **LS-100** Placement and spacing derive from the shared spatial system; alignment is systematic; no ad-hoc positioning (LS-12/13/14).
- **LS-101** Proximity and grouping reflect real IA relationships; no false adjacency (LS-9, LS-15, LS-21).
- **LS-102** A single clear primary focus exists; hierarchy is honest and reinforced beyond space (LS-16, LS-20, LS-42).
- **LS-103** Whitespace is purposeful and not filled; density matches task without breaching floors (LS-17, LS-18, LS-84, LS-85).
- **LS-104** Interactive targets meet the accessible minimum size and safe spacing across all input classes; opposing actions separated (LS-24/25/33, LS-51).
- **LS-105** Reading/traversal order is unambiguous and matches programmatic order across all viewports (LS-22, LS-32, LS-40).
- **LS-106** Content reflows across all in-scope viewport classes without loss, clipping, or forced two-dimensional scrolling (LS-30, LS-81).
- **LS-107** Under constraint, trust/safety/consent content is preserved last and remains within reasonable discovery; lower-tier content yields first (LS-5, LS-31, LS-83).
- **LS-108** Reading direction, variable content extent, name-forms, scripts, and numerals are accommodated without truncation or collapse (LS-38/39/90).
- **LS-109** No spatial arrangement of people encodes or implies inference of character/worth from protected attributes; ordering basis is honest and declared (LS-41, LS-42, LS-86).
- **LS-110** Layout is state-stable; no disorienting shift; no intent theft by late-arriving elements (LS-60/61/62/88).
- **LS-111** Safety, report, and support affordances are reachable and unobstructed on every viewport class (LS-37, LS-57; C-5).
- **LS-112** Conceptual spatial parity holds across all in-scope platforms, including non-visual equivalence (LS-65/66/89).
- **LS-113** Each §Quality attribute is measured with recorded accept/reject; the LS-91 gate is honored; unknown state treated as Reject.
- **LS-114** Every change cites satisfied LS IDs; SHOULD deviations carry higher-tier justification (LS-94).

# Anti-patterns

For each: *why it harms (which C-n/tier) · how to detect · how to prevent.*

- **AP-1 Ad-hoc placement** — Off-system, arbitrary positioning and spacing. Harms consistency/maintainability (C-15/C-16, Tier 7). Detect: placement/spacing not derivable from the shared system (LS-77). Prevent: compose on the systematic grid and spacing scale (LS-12/13/14).
- **AP-2 No focal point** — Many equal-weight elements contest primacy; no start point. Harms understanding (Tier 5). Detect: members cannot name the primary element or where to begin (LS-76/78). Prevent: establish one clear focus (LS-20).
- **AP-3 Trust content dropped first** — Under constraint, safety/consent/trust content is the first collapsed or buried. Harms safety/consent (Tiers 1–2, C-4/C-5). Detect: responsive audit shows higher-tier content yielding before lower-tier (LS-83). Prevent: reverse-tier degradation; higher-tier last (LS-5/31/71).
- **AP-4 Reflow loss / forced scroll** — Content clips or requires two-dimensional scrolling to read. Harms accessibility (Tier 4). Detect: loss/clip/forced-scroll across viewport classes (LS-81). Prevent: reflow without loss (LS-30).
- **AP-5 Order inversion** — Visual order contradicts meaningful/programmatic order. Harms understanding & accessibility (Tiers 4–5). Detect: visual↔programmatic mismatch, especially after reflow (LS-82). Prevent: keep orders aligned (LS-22/32/40).
- **AP-6 Tap-trap density** — Targets too small or too close, causing mis-activation. Harms accessibility & safety (Tier 4/1). Detect: any target below the accessible floor or unsafe adjacency (LS-80). Prevent: enforce size and spacing floors; separate opposing actions (LS-24/25/51).
- **AP-7 Position-only meaning** — Grouping/state/priority signaled by space alone. Harms accessibility (Tier 4, C-8). Detect: meaning lost when position/AT unavailable (LS-79). Prevent: reinforce every spatial meaning with a non-spatial channel (LS-4/40).
- **AP-8 Uniform max density** — Everything packed to maximum regardless of task. Harms calm/restraint (Tiers 6/14). Detect: density breaches legibility/target/calm floors (LS-84). Prevent: match density to task; relax where focus is needed (LS-18/34).
- **AP-9 Whitespace-phobia** — Empty space treated as waste and filled. Harms restraint/calm (C-14/C-10). Detect: content added solely to reduce whitespace (LS-85). Prevent: treat whitespace as load-bearing (LS-17).
- **AP-10 Manufactured prominence** — Spatial primacy given to what has not earned it, or promoted placement disguised as neutral. Harms honesty (Tier 3, C-2). Detect: prominence not matching honest importance; undisclosed promotion (LS-87). Prevent: honest spatial signal; disclose via non-spatial channel (LS-42).
- **AP-11 Inference-encoding arrangement** — People ordered/clustered by a protected-attribute proxy or implied character judgment. Harms dignity (Tier 4, C-3). Detect: arrangement correlates with protected attributes or lacks an honest declared basis (LS-86). Prevent: honest, declared, non-inferred ordering basis (LS-41).
- **AP-12 Layout-shift intent theft** — Late elements move targets under an imminent action. Harms safety/agency (Tiers 1/7, C-7). Detect: post-load target relocation into action paths (LS-88). Prevent: reserve space; defer insertion (LS-62).
- **AP-13 Platform spatial divergence** — Grouping/hierarchy/order/roles differ in meaning across platforms. Harms consistency (Tier 7). Detect: conceptual parity audit fails (LS-89). Prevent: preserve conceptual spatial parity; provide non-visual equivalence (LS-65/66).
- **AP-14 Plurality truncation** — Fixed regions clip longer translations, taller scripts, or alternate name-forms/numerals. Harms inclusion (Tier 4, C-9). Detect: truncation or structural collapse under plural content (LS-90). Prevent: accommodate variable extent; logical start/end (LS-38/39).
- **AP-15 Dead-end / crowded state** — Empty/error/success surfaces with no oriented recovery space, or confirmation crowded by promotion. Harms task success & honest states (Tier 5, C-13). Detect: missing forward/return space; promo crowding confirmation (LS-53/63). Prevent: reserve recovery and confirmation space (LS-53/60/63).

# Open Questions

- **LS-115** Standard measurement instruments and per-attribute numeric thresholds for the §Quality framework require SHIG-wide calibration and are deferred to a measurement annex (shared with SHIG-0013).
- **LS-116** A canonical viewport/device-class taxonomy and the precise boundaries between classes (LS-28) await a cross-instrument device-plurality annex under C-9.
- **LS-117** The exact reachability envelope for spatial/XR targets (LS-67) awaits maturation of those surfaces and a modality-mapping guide.
- **LS-118** Governance of member-configurable density/spacing preferences that stay within accessibility and priority-under-constraint floors needs a dedicated rule set.
- **LS-119** The interface between this spec's inter-element spacing and SHIG-0018's text-internal rhythm at the exact boundary (LS-8) may need a joint clarification as typography matures.

# Revision History

| Version | Date | Status | Author | Summary |
|---------|------|--------|--------|---------|
| 1.0.0 | 2026-07-27 | Active | Chief Design Officer, Sambandh | Initial governing specification for the Layout & Spatial System; requirement IDs LS-1..LS-119. |

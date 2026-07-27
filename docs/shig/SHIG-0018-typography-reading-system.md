# Specification ID

SHIG-0018

# Specification Name

Typography & Reading System Specification

# Version

1.0.0

# Status

Active

# 1. Purpose & Scope

**TY-1** This specification MUST govern typography as the primary carrier of content and hierarchy across every Sambandh surface, feature, service, platform, and device. It governs the *reading experience* — the roles type plays, the hierarchy it expresses, the reading rhythm it establishes, the legibility floors it must meet, the discipline of emphasis, and the correct setting of multiple scripts and locale-plural forms. It governs OUTCOMES, PROPERTIES, and RULES — never implementation: not typefaces, font files, stylesheets, components, tokens' literal values, point sizes, pixel measurements, or code.

**TY-2** This specification MUST express typographic requirements as *relationships* and *properties* (roles, contrast ratios, hierarchy distinctions, proportional rhythm, reading measure) and MUST NOT prescribe named typefaces, absolute sizes, absolute line lengths in physical units, or any implementation artifact. A conformant system MAY realize these relationships in many ways; the relationships themselves are normative.

**TY-3** Typography MUST serve reading and comprehension first. Where a typographic choice would increase visual appeal (Tier 8) at the cost of legibility, comprehension, or inclusion (Tiers 4–5), the higher tier MUST win per SHIG-0000 Article 4. Ornamental typography that impedes reading is non-conformant (C-14 premium-through-restraint).

**TY-4** At every moment a reader MUST be able to answer, from type alone as one of at least two channels: (a) what is the most important thing here, (b) how are these pieces related and ranked, (c) what is a heading versus body versus supporting detail, (d) what is emphasized and why, (e) what is interactive text versus static text, (f) what language/script am I reading. A surface where type leaves (a)–(e) unresolvable, or resolvable only by type when another required channel is absent, is non-conformant.

**TY-5** This specification MUST comply with SHIG-0000 (Constitution, Article 4 lexicographic hierarchy; principles C-1..C-17) and follow SHIG-0001 rule grammar (MUST/MUST NOT/SHOULD/SHOULD NOT/MAY). Philosophy stated in SHIG-0000/0001 MUST be referenced by ID, not restated.

## 1.1 Cross-Instrument Relationships

**TY-6** This specification MUST NOT duplicate SHIG-0014 (content, copy, and voice): SHIG-0014 governs *what the words say*; this spec governs *how text is set and ranked as visual structure*. Where wording carries meaning that type must express (e.g. a heading's rank), the wording remains SHIG-0014's; its typographic treatment is this spec's.

**TY-7** This specification MUST NOT duplicate SHIG-0017 (color): color contrast values referenced here for text legibility are the WCAG 2.2 AA text-contrast floor, applied to type. SHIG-0017 owns palette, semantics, and color roles; this spec owns the requirement that text meet the contrast floor and that meaning never rest on color alone where type is the carrier (C-8).

**TY-8** This specification MUST honor SHIG-0000 C-8 (accessibility floor WCAG 2.2 AA; meaning never single-channel), C-9 (India-first plurality of language, script, numeral, name-form), C-14 (premium-through-restraint), C-2 (honesty-of-signal), and C-3 (non-inference of character). Typographic decisions that trade any of these for lower-tier gain are non-conformant.

**TY-9** Where this specification and any downstream implementation guide, design token set, or component library conflict, this specification MUST prevail. Where this specification and SHIG-0000/0001 conflict, the anchor instruments MUST prevail.

# 2. Typographic Principles

**TY-10 (Type as structure)** Typography MUST express document and interface structure — rank, grouping, sequence, and relationship — through systematic, repeatable distinctions, not ad-hoc styling. Structure conveyed by type MUST be consistent across every surface expressing the same rank (Tier 7 consistency; C-15).

**TY-11 (Scale as relationship)** The type system MUST define a scale as a set of *relationships* (relative steps between roles) rather than a list of absolute sizes. Each step MUST be perceptibly distinct from its neighbors so that rank is legible without measurement. A scale whose adjacent roles are not reliably distinguishable is non-conformant.

**TY-12 (Bounded role set)** The number of distinct type roles in simultaneous use on a surface MUST be bounded to what sustains clear hierarchy without clutter. Introducing roles beyond those the system defines is non-conformant (C-14; C-16 systemic reuse over one-offs).

**TY-13 (Hierarchy legibility)** Hierarchy MUST be readable at a glance: the single most important element MUST be identifiable, and the ranking among elements MUST be inferable, before the reader parses the words. Flat treatments where everything competes equally, and over-differentiated treatments where nothing settles, are both non-conformant.

**TY-14 (Restraint in variation)** Distinctions of rank MUST be achieved with the minimum set of typographic variables needed (relative size, weight, spacing, case, position). Stacking many variables to signal one distinction, or using different variables for the same distinction in different places, is non-conformant (C-14; C-15).

**TY-15 (Honesty of typographic signal)** Typographic prominence MUST correspond to genuine importance. Type MUST NOT be enlarged, weighted, or emphasized to manufacture urgency, inflate a claim, or make an inference or prediction read as established fact (C-2 honesty-of-signal; C-10 calm). Prominence is a truth claim about importance and MUST be earned.

**TY-16 (Non-inference)** Typographic treatment MUST NOT encode, imply, or rank a person's character, worth, or trustworthiness, nor differentiate people by inferred appearance, complexion, caste, religion, region, or language. Names, honorifics, and personal text of every origin MUST receive equal typographic dignity (C-3; T4 human dignity).

**TY-17 (Calm typography)** Typographic motion, blinking, rapid change, aggressive weight, or shouting case MUST NOT be used to pressure, alarm, or compel. Type MUST default to calm; attention-seeking treatments require genuine, proportionate cause (C-10; T6 emotional wellbeing).

**TY-18 (Reading before decoration)** Where a decorative or expressive treatment and a plain legible treatment conflict, the legible treatment MUST prevail for any text carrying content or enabling a task. Expressive typography MAY be used only where it does not reduce comprehension below the legibility floors of §4 (C-14).

**TY-19 (Systemic definition)** Every type role MUST be defined once, systemically, and reused — never redefined per screen. One-off typographic treatments that duplicate an existing role's purpose are non-conformant (C-16 longevity & maintainability).

# 3. Type Roles & Hierarchy

**TY-20 (Role definition)** The system MUST define a set of named, purpose-bound type roles (for example: primary heading, secondary heading, body, supporting/secondary text, caption/metadata, label, interactive/actionable text, quotation, fixed-width technical content such as identifiers or structured strings, numeric/tabular data). Each role MUST have a defined purpose; text MUST be assigned a role by its function, not by desired appearance.

**TY-21 (Role distinction)** Any two roles that must be told apart in the same reading context MUST differ by at least one perceptible typographic property beyond color (C-8: never color alone). Reliance on color as the sole differentiator between two roles is non-conformant.

**TY-22 (Heading hierarchy)** Heading roles MUST form a strict, ordered hierarchy in which each level is perceptibly subordinate to the one above and superior to the one below. Heading rank MUST be expressed by more than one property so that rank survives loss of any single channel (C-8).

**TY-23 (Semantic rank integrity)** The visual rank of a heading MUST match its structural rank in the content. Type MUST NOT make a lower-rank element look superior to a higher-rank one, nor skip ranks in a way that misrepresents structure (C-2; parity with SHIG-0014 content structure).

**TY-24 (Body as baseline)** Body text MUST be the legibility baseline of the system: the role optimized first for sustained reading, against which other roles are sized and spaced relationally. All legibility floors in §4 MUST be met by body text without exception and by every other role at its own reading distance and function.

**TY-25 (Supporting and metadata text)** Secondary, caption, and metadata roles MAY be less prominent than body but MUST still meet the legibility floors of §4. "Less important" MUST NOT mean "below the accessibility floor." Fine print that fails the floor is non-conformant regardless of legal or business intent (C-8; T4 over T9).

**TY-26 (Interactive text distinction)** Text that is interactive (actionable) MUST be distinguishable from static text by at least two channels, never by color alone (C-8). The interactive/static distinction MUST be consistent everywhere it appears (Tier 7).

**TY-27 (Grouping and relationship)** Type MUST express which elements belong together and which are separate through consistent role assignment, spacing rhythm, and alignment. Related items MUST read as a group; unrelated items MUST NOT be forced into false adjacency by shared treatment.

**TY-28 (Scannability)** Long or dense content MUST be made scannable through honest headings, meaningful grouping, and restrained emphasis so a reader can locate what they need without reading everything. Scannability MUST NOT be achieved by fragmenting text into misleading or clickbait headings (C-2).

# 4. Legibility Floors (WCAG 2.2 AA and above)

**TY-29 (Contrast floor)** All text MUST meet or exceed the WCAG 2.2 AA text contrast ratio for its size class against its actual background in every state and theme. Text that fails this ratio in any state (default, hover, disabled-but-readable, error, on imagery) is non-conformant. This is a Tier 4 floor and MUST NOT be traded for aesthetic (Tier 8) or business (Tier 9) gain (C-8).

**TY-30 (Minimum readable size)** Every role MUST be set no smaller than the size at which its content remains comfortably readable at its intended reading distance for the platform. There MUST be a defined minimum below which no text carrying meaning is set. Decorative sub-minimum text MUST NOT carry information required for any task (C-8).

**TY-31 (Reader-controlled scaling)** Text MUST remain fully readable and functional when the reader increases text size or zoom to the extent required by WCAG 2.2 AA, without loss of content, clipping, overlap, or the need for two-dimensional scrolling of a single column of text. Layouts that break under reader-initiated text enlargement are non-conformant (C-7 agency; C-8).

**TY-32 (Line length / measure)** Body and long-form text MUST be set to a reading measure within the range that sustains comfortable eye return — neither so wide that the reader loses the next line nor so narrow that rhythm fractures. Measure is a relationship (characters per line band), not an absolute width, and MUST adapt across viewports while staying in the comfortable band.

**TY-33 (Line spacing)** Line spacing (leading) MUST be proportional to the role's size and measure such that lines are distinguishable and the eye tracks without crowding or drifting. Line spacing MUST meet or exceed the WCAG 2.2 AA text-spacing expectations and MUST NOT collapse when text is user-scaled (TY-31).

**TY-34 (Paragraph and block spacing)** Spacing between paragraphs and blocks MUST establish clear separation proportional to the reading rhythm, so structure is visible without rules or ornament. Insufficient block spacing that merges distinct ideas, and excessive spacing that severs continuity, are both non-conformant (C-14).

**TY-35 (Letter and word spacing)** Letter and word spacing MUST support, not hinder, word recognition and MUST accommodate the WCAG 2.2 AA text-spacing adjustments without breakage. Tightened tracking that harms legibility for density or style is non-conformant (C-8 over C-14 aesthetics).

**TY-36 (Alignment and rag)** Text alignment MUST prioritize legibility: long-form text MUST NOT be set in a way that produces distracting rivers, erratic spacing, or hyphenation that impairs reading. Justified setting MUST NOT be used where it degrades spacing legibility for the script in question.

**TY-37 (Case discipline)** Continuous reading text MUST NOT be set in all-uppercase. Uppercase MAY be used only for short labels where it does not reduce legibility, and MUST NOT be the sole carrier of meaning or emphasis (C-8; TY-40). Case MUST respect the conventions of each script (many scripts have no case; TY-49).

**TY-38 (Degradation resilience)** Text MUST remain legible under realistic degradation: low-end displays, low bandwidth with delayed or fallback rendering, small screens, bright ambient light, and reduced color fidelity. The system MUST define a legible fallback for every role so that when a preferred rendering is unavailable, meaning and hierarchy survive (C-9 device/bandwidth plurality; TY-52).

**TY-39 (Small-size integrity)** At the smallest permitted sizes, hierarchy and legibility MUST be preserved by relationship and spacing rather than by properties that vanish when small. Distinctions that disappear at small sizes MUST NOT be the sole means of conveying rank or state (C-8).

# 5. Emphasis Discipline

**TY-40 (Emphasis is meaningful)** Emphasis MUST correspond to genuine semantic importance and MUST NOT be decorative. Every emphasized span MUST answer "why is this emphasized." Emphasis without cause is non-conformant (C-14 restraint; C-2 honesty).

**TY-41 (Emphasis restraint)** The proportion of emphasized text within any passage MUST be small enough that emphasis retains contrast with the surrounding text. When too much is emphasized, nothing is; over-emphasis is non-conformant (C-14).

**TY-42 (Emphasis not single-channel)** Where emphasis conveys meaning required for comprehension or task success, it MUST NOT rest on a single channel (e.g. color, or weight, or slant alone) that a reader might not perceive. Emphasis carrying required meaning MUST be reinforced by an additional channel or by the wording itself (C-8).

**TY-43 (Emphasis hierarchy)** The system MUST define a bounded, ordered set of emphasis levels (e.g. strong, moderate, subtle) and MUST NOT invent per-screen emphasis treatments. Competing emphasis styles for the same intent across surfaces are non-conformant (Tier 7; C-15).

**TY-44 (No manufactured urgency via emphasis)** Emphasis, enlargement, weight, or color MUST NOT be used to manufacture urgency, scarcity, anxiety, or compulsion, or to pressure a decision (C-10 calm; T6). This applies with special force to commercial, deadline, and consent text.

**TY-45 (Consent, safety, and cost text)** Text conveying consent choices, safety information, irreversible actions, price, and finality MUST be set at full legibility (meeting §4 floors) and MUST NOT be de-emphasized, shrunk, or visually buried relative to persuasive or promotional text. Any typographic hierarchy that subordinates required disclosures to persuasion is non-conformant (T1/T2 over T9; C-4; C-5).

**TY-46 (Quotation and attribution)** Quoted or third-party text MUST be typographically distinguishable from Sambandh's own voice so readers do not mistake attribution (C-2). Machine-generated or AI-assisted text, where surfaced, MUST be typographically compatible with its required "automated" labeling (C-12) and MUST NOT be styled to impersonate human-authored or verified content.

# 6. Multi-Script, Indic & Locale Typography

**TY-47 (India-first, no default locale)** The system MUST NOT assume a single language, script, numeral system, date form, or name form as the universal default. Every typographic rule MUST hold across the scripts and locales Sambandh serves, with Indic scripts treated as first-class, not as adaptations of a Latin baseline (C-9).

**TY-48 (Per-script legibility floors)** The legibility floors of §4 MUST be satisfied per script at the script's own reading requirements. A size, weight, or spacing adequate for one script MUST NOT be assumed adequate for another; complex scripts often require more vertical space and larger minimums to remain legible (C-8; C-9).

**TY-49 (Script-appropriate treatment)** Typographic treatments MUST respect each script's conventions: scripts without letter case MUST NOT have case-based emphasis or hierarchy imposed on them; scripts with conjuncts, matras, stacked marks, or complex clusters MUST be set with spacing that preserves their integrity; directionality MUST follow the script. Imposing one script's mechanics on another is non-conformant (C-9).

**TY-50 (Mixed-script setting)** When multiple scripts appear together (in one string, line, or view), they MUST be set to read as one coherent, balanced text: comparable apparent size and weight, aligned baselines/rhythm, and no script rendered visibly inferior, cramped, or as a degraded afterthought. Mixed-script text MUST preserve the dignity and legibility of every script present (C-3 equal dignity; C-9).

**TY-51 (Script fallback integrity)** When a preferred rendering for a script is unavailable, the fallback MUST preserve legibility, correct shaping, and hierarchy for that script; it MUST NOT drop marks, break conjuncts, substitute tofu/placeholder glyphs for meaningful text, or silently switch to a script the reader did not choose. Unknown or missing glyph coverage MUST fail visibly and safely, never by presenting corrupted text as correct (C-2; C-9; fail-secure).

**TY-52 (Vertical metrics across scripts)** Line spacing and block rhythm MUST accommodate the tallest and deepest marks of every script in use so that ascenders, descenders, matras, and stacked marks are never clipped or collided. A rhythm tuned to one script that clips another is non-conformant (C-9).

**TY-53 (Numerals not locale-locked)** Numeral systems MUST NOT be hard-locked to one script or locale. The system MUST support the numeral forms appropriate to the reader's language/locale and MUST render numerals legibly and unambiguously in each. Numeric-heavy content (prices, dates, counts, IDs) MUST remain unambiguous across numeral systems (C-9).

**TY-54 (Dates, times, and units)** Date, time, currency, and unit formats MUST follow the reader's locale conventions and MUST NOT assume one regional format as universal. Where a value's format could be ambiguous across locales (e.g. day/month order), typography and formatting MUST resolve the ambiguity unambiguously (C-2; C-9).

**TY-55 (Honorific and name forms)** Honorifics, name order, and personal-name forms MUST NOT be locale-locked or forced into a single culture's convention. Names of every length, script, and structure MUST be set with equal dignity and MUST NOT be truncated, transliterated, reordered, or de-emphasized in a way that distorts identity (C-3; C-9). The system MUST NOT assume given-name/family-name ordering universally.

**TY-56 (Tabular and numeric alignment)** Numeric data intended for comparison MUST be set so digits align for honest comparison, in whichever numeral system is active, without implying precision or ranking the data does not support (C-2; C-17 evidence over opinion).

**TY-57 (Translation resilience)** Layouts and type roles MUST accommodate text expansion and contraction across languages without breaking hierarchy, clipping, or forcing sub-floor sizes to make text "fit." Shrinking text below the legibility floor to fit a fixed space is non-conformant (C-8 over C-14/C-9-driven layout convenience).

# 7. Typography and the Never-Single-Channel Rule

**TY-58 (Type never sole channel where another required)** Where SHIG-0000 C-8 requires meaning to be carried by more than one channel — status, error, selection, required-ness, interactivity, emphasis carrying meaning — typography MUST NOT be the sole carrier, and no other single channel (color, position, motion) may substitute for the missing one. Type MUST be one of at least two independent channels for such meaning.

**TY-59 (State expressed beyond type)** Text-conveyed states (error, success, disabled, selected, active) MUST be distinguishable without relying solely on a change in type property that a given reader may not perceive; a reinforcing channel (icon, label wording, shape, or position) MUST accompany it (C-8; C-13 honest states).

**TY-60 (Accessible text semantics)** Text MUST carry its meaning in a form available to assistive technology, and visual typographic hierarchy MUST have a corresponding non-visual structure so that rank, grouping, and emphasis are conveyed to readers not perceiving the visual treatment (C-8; parity with SHIG-0011 accessibility).

**TY-61 (No meaning in decorative glyphs alone)** Decorative characters, symbols, or typographic ornaments MUST NOT be the sole carrier of required meaning; any meaning they suggest MUST also be present in accessible text (C-8).

# 8. Reading Contexts (Domain Table)

**TY-62** Each reading context below MUST satisfy its row. Columns: **Primary reading goal**, **Dominant role(s)**, **Legibility priority**, **Emphasis/plurality rule**, **Success criteria**. All rows inherit the §4 legibility floors, §5 emphasis discipline, §6 multi-script rules, and §7 never-single-channel rule. Where a row involves consent, safety, cost, or people, Tiers 1–4 override Tier 5–9.

| # | Reading context | Primary reading goal | Dominant role(s) | Legibility priority | Emphasis / plurality rule | Success criteria |
|---|-----------------|----------------------|------------------|---------------------|---------------------------|------------------|
| TY-63 | Onboarding & explanation | Understand what is asked and why | Heading + body | Body baseline floors; step hierarchy clear | Calm; no urgency emphasis (TY-44) | Reader grasps each step unaided; no sub-floor fine print |
| TY-64 | Consent & permission | Comprehend scope, revocability, and choice | Body at full legibility | Consent text never de-emphasized (TY-45) | No persuasion outweighs disclosure typographically | Consent text as legible as any persuasive text (T2) |
| TY-65 | Safety & reporting | Locate and read safety info fast | Body + clear headings | Always meets floors; reachable, scannable | No de-emphasis of safety text (TY-45; C-5) | Safety text found and read without strain (T1) |
| TY-66 | Profiles & names | Read a person's identity with dignity | Name/heading + body | Equal dignity across scripts/lengths (TY-55) | No inference by typographic treatment (TY-16) | Every name set with equal dignity; none distorted |
| TY-67 | Compatibility / inference surfaces | Understand a stated basis honestly | Body + labeled qualifiers | Inference framed, never fact-styled (TY-15) | Prominence matches truth, not persuasion | Inferences read as inferences, not established facts (T3) |
| TY-68 | Conversations / messaging | Read exchanges clearly; know authorship | Body + attribution | Mixed-script balance (TY-50); own vs quoted (TY-46) | AI-authored text labeled + not impersonating (TY-46) | Authorship unambiguous; scripts balanced |
| TY-69 | Pricing & payment | Read amount, currency, finality unambiguously | Numeric/tabular + body | Numerals/locale correct (TY-53/54); cost text full legibility | No shrinking/burying of price or finality (TY-45) | Amount, currency, finality unmistakable (T2) |
| TY-70 | Data & numeric comparison | Compare values honestly | Tabular numeric | Aligned digits; numeral-system correct (TY-56) | No false precision or implied ranking (TY-56) | Comparison honest and legible across numerals |
| TY-71 | Long-form / learning | Sustain comfortable reading | Body at optimal measure | Measure, leading, block rhythm (TY-32/33/34) | Restrained emphasis; scannable (TY-28/41) | Reader sustains reading without fatigue |
| TY-72 | Notifications & system messages | Grasp state quickly and calmly | Body + label | Honest state via ≥2 channels (TY-59); calm (TY-17) | No manufactured urgency (TY-44) | State understood at a glance; no alarm typography |
| TY-73 | Errors / empty / loading | Understand what happened and next step | Body + heading | Honest states (C-13); floors met even in fallback | Emphasis marks the recovery action, not blame | Reader knows what happened and how to proceed |
| TY-74 | Multi-script / regional surfaces | Read fluently in one's own script | All roles per script | Per-script floors + fallback integrity (TY-48/51/52) | No script rendered inferior (TY-50) | Every script legible, dignified, correctly shaped |

# 9. Cross-Platform Typographic Parity

**TY-75** In-scope surfaces include desktop, mobile, tablet, PWA, wearables, voice/audio read-out, print/export, and AR/VR/XR/spatial. Each MUST uphold this specification at its own reading distance and constraints.

**TY-76 (Conceptual parity)** The system of roles, hierarchy relationships, and emphasis levels MUST be conceptually identical across platforms. Absolute sizes and metrics MAY adapt to each platform's reading distance and affordances; the *relationships, roles, and meaning* MUST NOT diverge (Tier 7; C-15).

**TY-77 (Per-platform floors)** Every platform MUST independently meet the §4 legibility floors at its reading distance. A treatment adequate on one platform MUST NOT be assumed adequate on another (e.g. wearable vs desktop); each MUST be verified (C-8).

**TY-78 (Non-visual and audio parity)** Where text is rendered non-visually (screen reader, voice), typographic hierarchy and emphasis MUST be conveyed by equivalent non-visual means so rank, grouping, and emphasis reach the reader. Loss of hierarchy in non-visual rendering is non-conformant (C-8; TY-60).

**TY-79 (Print / export fidelity)** Exported or printed text MUST preserve hierarchy, legibility floors, and script integrity; it MUST NOT drop marks, collapse hierarchy, or shrink required disclosures below the floor to fit a page (C-8; C-9).

**TY-80 (Spatial / XR reading)** In spatial/XR surfaces, text MUST remain legible at the reader's viewing conditions and MUST NOT rely on motion or depth as the sole carrier of hierarchy or emphasis (C-8; C-10 calm).

# Decision Framework

**TY-81** When choosing among competing typographic options, teams MUST apply SHIG-0000 Article 4 lexicographically. An option that better serves a lower tier MUST NOT be chosen over one that better serves a higher tier; a lower-tier gain NEVER justifies a higher-tier loss.

**TY-82 (Selection rule)** Among options that violate no higher tier, teams MUST resolve in strict lexicographic tier order: first safety (Tier 1) and consent (Tier 2), then honesty of signal (Tier 3), then the accessibility and human-dignity floors (Tier 4), then comprehension and inclusion (Tier 5), then calm and emotional wellbeing (Tier 6), then systemic consistency (Tier 7). Restraint and craft (Tier 8) and business preference (Tier 9) break ties only after every higher tier is equal.

**TY-83 (Non-negotiable floors)** The following MUST NOT be traded for any lower-tier benefit: the WCAG 2.2 AA contrast and text-spacing floors (TY-29/33/35, T4); minimum readable size and reader-scaling (TY-30/31, T4); full legibility of consent/safety/cost text (TY-45, T1/T2); never-single-channel for required meaning (TY-58, T4); equal typographic dignity and non-inference (TY-16/50/55, T4); honesty of typographic prominence (TY-15, T3); script fallback integrity and fail-secure on missing glyphs (TY-51, T3/T4).

**TY-84 (Deviation record)** Any SHOULD-level deviation MUST record a written justification naming the higher tier it serves, per SHIG-0001. MUST-level requirements admit no deviation. Unknown or ambiguous states (missing glyph coverage, undetermined locale/script) MUST resolve to the safe, legible, non-corrupting option (fail-secure).

**TY-85 (Decision table)**

| Situation | Competing pull (tiers) | Required resolution | Governing IDs |
|-----------|------------------------|---------------------|---------------|
| Smaller/denser type fits more content | Aesthetics/business (T8/T9) vs Legibility (T4) | Keep floors; do not go sub-minimum | TY-29, TY-30, TY-57, TY-83 |
| Fine-print disclosure to reduce friction | Growth (T9) vs Consent/safety (T1/T2) | Full legibility for disclosure | TY-45, TY-64, TY-65 |
| Enlarged/bold text to drive a decision | Business (T9) vs Calm/honesty (T3/T6) | No manufactured urgency; prominence matches truth | TY-15, TY-44 |
| Expressive display face harms reading | Craft/brand (T8) vs Comprehension (T5) | Legible treatment prevails for content text | TY-18, TY-3 |
| Latin-tuned rhythm clips an Indic script | Consistency/convenience (T7) vs Inclusion (T4) | Accommodate all scripts' metrics | TY-48, TY-52, TY-50 |
| Missing glyph renders placeholder/tofu | Ship/aesthetics (T8/T9) vs Honesty (T3) | Fail visibly + safely; never present corrupted text as correct | TY-51, TY-84 |
| One numeral/date format assumed universal | Simplicity (T7) vs Plurality (T4/T3) | Locale-correct, unambiguous forms | TY-53, TY-54 |
| Emphasis by color only | Aesthetics (T8) vs Accessibility (T4) | Add a second channel | TY-42, TY-58 |

# Quality Framework (Measurable)

**TY-86** Each attribute below MUST have a defined measurement method and a recorded accept/reject threshold per release. Conformance claims MUST be backed by measurement, not opinion (C-17).

| # | Quality attribute | What it measures | Accept | Reject |
|---|-------------------|------------------|--------|--------|
| TY-87 | Text contrast | Measured contrast ratio of every text/background pair, all states/themes | All meet/exceed WCAG 2.2 AA for size class | Any text below AA in any state |
| TY-88 | Minimum size & scaling | Smallest meaningful text; behavior under reader zoom/enlargement | No sub-floor meaningful text; scales without breakage | Sub-floor text, or breakage on enlargement |
| TY-89 | Text spacing resilience | Legibility under WCAG 2.2 AA text-spacing adjustments | No clipping/overlap/loss under adjustment | Any breakage under text-spacing adjustment |
| TY-90 | Hierarchy clarity | Reader can identify most-important and rank order | Rank identifiable pre-reading at target rate | Flat or ambiguous hierarchy above threshold |
| TY-91 | Reading comfort | Measure, leading, rhythm within comfortable bands | Long-form within comfortable band | Measure/leading outside band causing fatigue |
| TY-92 | Emphasis discipline | Proportion and cause of emphasized spans | Emphasis meaningful, restrained, ≥2-channel where required | Decorative/over-emphasis, or single-channel required meaning |
| TY-93 | Single-channel audit | Any required meaning resting on type (or any one channel) alone | Zero single-channel required meanings | Any required meaning single-channel |
| TY-94 | Multi-script legibility | Per-script floors, shaping, mixed-script balance | All scripts meet floors, correctly shaped, balanced | Any script sub-floor, clipped, or rendered inferior |
| TY-95 | Fallback integrity | Rendering when preferred face/glyph unavailable | Legible, correct shaping; missing coverage fails visibly/safely | Tofu/dropped marks/corrupted text shown as correct |
| TY-96 | Numeral/date/name plurality | Locale-correct numerals, dates, honorifics, name forms | Correct and unambiguous per locale; names dignified | Locale-locked, ambiguous, or distorted names |
| TY-97 | Disclosure legibility | Legibility of consent/safety/cost text vs persuasive text | Disclosures ≥ persuasion legibility, meet floors | Disclosures de-emphasized/sub-floor |
| TY-98 | Non-visual hierarchy | Rank/emphasis conveyed to assistive tech / audio | Full non-visual parity of structure | Hierarchy lost in non-visual rendering |
| TY-99 | Cross-platform parity | Role/relationship identity across platforms | Conceptual parity; per-platform floors met | Meaning divergence or unmet floor on any platform |

**TY-100 (Gate)** A release MUST NOT ship if any Tier 1–4-linked attribute is in Reject: contrast (TY-87), minimum size/scaling (TY-88/89), single-channel required meaning (TY-93), multi-script/fallback integrity (TY-94/95), disclosure legibility (TY-97), or non-visual hierarchy (TY-98). Tier 5–9 rejects MUST be recorded with a remediation plan per SHIG-0001.

# Governance

**TY-101** This specification is Tier 1–4 in effect and, per SHIG-0000, MAY only be strengthened, never weakened, by future revisions. Requirement IDs are permanent; a superseded rule is marked Deprecated, never reused or renumbered.

**TY-102** Every typographic change MUST cite the TY IDs it satisfies and record any SHOULD-level deviation with its higher-tier justification (TY-84).

**TY-103** Conformance MUST be evidenced by the Quality Framework measurements at defined review points; unmeasured surfaces are treated as non-conformant (fail-secure; C-17).

**TY-104** Unknown or ambiguous typographic state — undetermined locale or script, missing glyph coverage, unverifiable contrast — MUST resolve to the safe, legible, non-corrupting outcome and MUST NOT present uncertain or corrupted text as correct (C-2; fail-secure).

**TY-105** Conflicts between this spec and any implementation guide, token set, or component library resolve in favor of this spec; conflicts with SHIG-0000/0001 resolve in favor of those anchor instruments (TY-9).

**TY-106** New platforms, scripts, or locales entering scope MUST be assessed against §4 floors, §6 multi-script rules, and the Quality Framework before member exposure.

# Compliance / Review Checklist

- **TY-107** Every text/background pair meets WCAG 2.2 AA contrast in all states and themes (TY-29/87).
- **TY-108** No meaningful text below the defined minimum; all text scales under reader zoom without breakage (TY-30/31/88).
- **TY-109** Layout survives WCAG 2.2 AA text-spacing adjustments without clipping or overlap (TY-33/35/89).
- **TY-110** Hierarchy identifiable at a glance; rank expressed by more than one channel; visual rank matches structural rank (TY-13/22/23/90).
- **TY-111** Measure, leading, and block rhythm within comfortable bands for long-form reading (TY-32/33/34/91).
- **TY-112** Emphasis is meaningful and restrained; required-meaning emphasis uses ≥2 channels (TY-40/41/42/92).
- **TY-113** No required meaning rests on type alone, nor on any single channel (TY-58/59/93).
- **TY-114** Consent, safety, cost, and finality text at full legibility, never subordinated to persuasion (TY-45/64/65/69/97).
- **TY-115** Per-script floors met; conjuncts/matras/marks preserved; mixed-script text balanced and dignified (TY-48/49/50/52/94).
- **TY-116** Fallback preserves legibility and shaping; missing glyphs fail visibly/safely, never as corrupted text (TY-51/95).
- **TY-117** Numerals, dates, units, honorifics, and name forms locale-correct, unambiguous, and dignified; no locale-lock (TY-53/54/55/96).
- **TY-118** No typographic treatment infers, ranks, or distorts a person's character or identity; equal dignity across origins (TY-16/55/66).
- **TY-119** No typographic manufactured urgency, alarm, or pressure; type defaults to calm (TY-17/44).
- **TY-120** Non-visual and audio rendering preserve hierarchy and emphasis (TY-60/78/98).
- **TY-121** Conceptual role/relationship parity across all in-scope platforms; per-platform floors verified (TY-76/77/99).
- **TY-122** AI-assisted or machine-generated text is compatible with its required labeling and does not impersonate verified/human content (TY-46).
- **TY-123** Each Quality Framework attribute measured with recorded accept/reject; the TY-100 gate honored.

# Anti-patterns

For each: *why it harms · how to detect · how to prevent.*

- **AP-1 Sub-floor text** — Meaningful text below the legibility/contrast floor. Harms accessibility (C-8; T4). Detect: contrast and size audit across states (TY-87/88). Prevent: enforce §4 floors; TY-83.
- **AP-2 Fine-print disclosures** — Consent/safety/cost text shrunk or de-emphasized relative to persuasion. Harms consent/safety (C-4/C-5; T1/T2). Detect: compare disclosure vs persuasive text legibility (TY-97). Prevent: TY-45.
- **AP-3 Flat hierarchy** — Everything at one weight/size; no discernible rank. Harms comprehension (T5). Detect: pre-reading rank test (TY-90). Prevent: TY-13/22.
- **AP-4 Emphasis inflation** — So much emphasized that emphasis loses meaning, or emphasis without cause. Harms honesty/restraint (C-2/C-14). Detect: emphasized-proportion + cause audit (TY-92). Prevent: TY-40/41.
- **AP-5 Color-only distinction** — Rank, state, emphasis, or interactivity signaled by color alone. Harms accessibility (C-8). Detect: single-channel audit (TY-93). Prevent: TY-21/26/42/58.
- **AP-6 Shouting typography** — All-caps runs, aggressive weight, or motion to alarm/pressure. Harms calm/dignity (C-10; T6). Detect: case/motion/urgency review (TY-119). Prevent: TY-17/37/44.
- **AP-7 Latin-centric setting** — One script's rhythm/case/metrics imposed on others; Indic scripts as afterthought. Harms inclusion (C-9; T4). Detect: per-script legibility + mixed-script balance test (TY-94). Prevent: TY-47/48/49/50/52.
- **AP-8 Tofu / corrupted text** — Missing glyphs render placeholders, dropped marks, or broken conjuncts shown as correct. Harms honesty/inclusion (C-2/C-9). Detect: fallback rendering audit (TY-95). Prevent: TY-51 fail-visible/safe.
- **AP-9 Locale-locked forms** — One numeral/date/name convention assumed universal; names distorted. Harms plurality/dignity (C-9/C-3). Detect: numeral/date/name-form audit across locales (TY-96). Prevent: TY-53/54/55.
- **AP-10 Prominence as persuasion** — Size/weight inflated to make a claim or inference read as fact or to manufacture importance. Harms honesty (C-2; T3). Detect: prominence-vs-actual-importance review (TY-90); inference-framing check. Prevent: TY-15/44/67.
- **AP-11 Decorative illegibility** — Expressive faces/treatments that impede reading of content text. Harms comprehension (T5; C-14). Detect: legibility test on content set expressively (TY-91). Prevent: TY-18/3.
- **AP-12 Breakage under scaling** — Layout clips/overlaps when text is enlarged or spacing adjusted. Harms accessibility/agency (C-8/C-7). Detect: reader-zoom + text-spacing stress test (TY-88/89). Prevent: TY-31/33/35/57.
- **AP-13 One-off type styling** — Per-screen type treatments duplicating existing roles. Harms consistency/maintainability (C-15/C-16). Detect: role inventory vs actual usage (TY-19). Prevent: TY-12/19/43.
- **AP-14 Cramped mixed script** — In multi-script strings, one script rendered smaller, clipped, or visibly inferior. Harms dignity/inclusion (C-3/C-9; T4). Detect: mixed-script balance + vertical-metric audit (TY-50/52). Prevent: TY-50/52/48.
- **AP-15 Lost non-visual hierarchy** — Visual rank/emphasis absent in screen-reader/audio rendering. Harms accessibility (C-8). Detect: non-visual structure audit (TY-98). Prevent: TY-60/78.

# Open Questions

- **TY-124** Per-script numeric legibility floors and minimum-size bands require an evidence-based measurement annex calibrated across Indic and non-Indic scripts (C-17).
- **TY-125** Standard instruments and thresholds for "hierarchy identifiable pre-reading" (TY-90) and "reading comfort" (TY-91) need SHIG-wide calibration.
- **TY-126** A governance rule set for expressive/brand display typography that guarantees it never crosses into content text below legibility floors (TY-18) is deferred to a companion guide.
- **TY-127** Reader-chosen script/locale/numeral preference propagation across services (interacting with SHIG-0000 Tier 2 consent and cross-service continuity) requires a dedicated preference-propagation specification.
- **TY-128** Typographic treatment norms for AI-assisted/machine-generated text labeling (TY-46), harmonized with SHIG-0012/0014 and C-12, await a cross-instrument annex.

# Revision History

| Version | Date | Status | Author | Summary |
|---------|------|--------|--------|---------|
| 1.0.0 | 2026-07-27 | Active | Chief Design Officer, Sambandh | Initial governing specification for Typography & the Reading System; requirement IDs TY-1..TY-128. |

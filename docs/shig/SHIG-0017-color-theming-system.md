# Specification ID

SHIG-0017

# Specification Name

Color & Theming System Specification

# Version

1.0.0

# Status

Active

# 1. Purpose & Scope

**CT-1** This specification MUST govern how color CARRIES MEANING across every Sambandh surface, feature, service, platform, and device — the semantic ROLES color plays, the contrast it MUST achieve, the non-color channels it MUST be paired with, how its meaning survives theming, and how it fails secure. It governs OUTCOMES, PROPERTIES, and RULES — the meaning a color role must carry, the ratio it must meet, the pairing it must maintain — NOT implementation: NOT literal color values, palettes, hex/RGB/HSL codes, gradients, named tokens, themes-as-code, frameworks, components, or stylesheets. Those are delegated to the design-token and implementation instruments and MUST NOT appear here.

**CT-2** Color in Sambandh is treated as a *meaning-bearing signal under governance*, never as decoration or brand flourish. Every use of color to distinguish, rank, warn, reassure, or denote state MUST resolve to a named semantic ROLE governed by this specification. A color applied for aesthetic effect alone MUST NOT acquire or imply semantic meaning it does not hold.

**CT-3** Color MUST NEVER be the sole carrier of any meaning (C-8). Every distinction that color communicates MUST be redundantly encoded in at least one non-color channel — text label, shape, icon, position, or pattern — such that the meaning survives complete removal of color. This is the central, non-negotiable rule of this specification and is Tier 1–4 in force.

**CT-4** This specification MUST NOT restate philosophy defined in SHIG-0000, SHIG-0001, SHIG-0007, or SHIG-0011; it references those by ID. Where this specification and any implementation guide conflict, this specification prevails; where this specification and SHIG-0000/0001 conflict, those anchor instruments prevail.

**CT-5** Conformance is defined by measurable properties: contrast ratios, channel counts, discrimination tests, and theme-parity checks (§9). A surface whose color usage cannot be verified against these properties is treated as non-conformant (fail-secure; C-17 evidence over opinion).

## 1.1 Cross-Instrument Relationships

**CT-6** This specification MUST comply with SHIG-0000 (Constitution): Article 4 lexicographic decision hierarchy governs every color trade-off, and principles C-1 (trust-before-engagement), C-2 (honesty-of-signal), C-3 (non-inference of character), C-8 (accessibility floor / never single-channel), C-9 (inclusion & plurality, India-first), C-10 (calm), and C-14 (premium through restraint) directly constrain color decisions. A lower-tier color gain (aesthetics T8, business T9) MUST NEVER justify a higher-tier loss.

**CT-7** This specification MUST follow SHIG-0001 rule grammar (RFC-2119 keywords; permanent IDs; may-only-be-strengthened; recorded deviations for SHOULD-level rules).

**CT-8** This specification depends on but MUST NOT duplicate: **SHIG-0007 Visual Language** (which governs visual semantics, hierarchy, and the multi-channel principle at the level of *all* visual channels — this spec specializes the color channel and inherits VL-7/VL-8/VL-31/VL-32 without restating them); **SHIG-0011 Accessibility & Inclusive Design** (which owns the WCAG 2.2 AA floor and assistive-technology parity — this spec restates the color-specific contrast and non-color obligations as bindings, not new law); and **SHIG-0008 vocabulary** (which owns naming — this spec names *roles*, never coins new visual vocabulary). This spec governs color meaning, roles, contrast, pairing, and theming ONLY.

**CT-9** Where a color role must denote trust, verification, money, consent, privacy, safety, or AI/human provenance, the governing meaning is owned by the respective domain instrument; this specification governs only *how color may and may not express* that meaning. Color MUST NOT introduce a trust, verification, or money semantic the domain instrument does not define.

# 2. Color Semantic Principles

**CT-10** Color MUST be assigned by ROLE, not by value. A design decision MUST reference the semantic role a color serves (e.g., "positive-completion role," "reversible-risk role," "verified-trust role"), and the value satisfying that role is delegated. Binding a meaning to a specific hue in this specification is prohibited (CT-1).

**CT-11** Every meaningful color distinction MUST survive a grayscale render (all color removed) AND a monochrome/limited-gamut render with every state still distinguishable by its paired non-color channel (CT-3, C-8). A distinction that disappears under grayscale is non-conformant regardless of its contrast in color.

**CT-12** The non-color channel paired with a color role MUST be *load-bearing on its own* — a text label, a distinct shape, a distinct icon, or a stable position — not a second color, not a color-dependent gradient, and not motion alone (motion MUST NOT be the sole non-color channel; C-8, VL-36). At least one paired channel MUST be perceivable without color vision and without motion.

**CT-13** Color MUST express only what the system actually knows (C-2). A color role reserved for confirmed fact (e.g., verified-trust, completed-success, settled-money) MUST NOT be applied to inferred, predicted, estimated, pending, or unverified content. Inference and prediction MUST carry a color role distinct from confirmed fact and MUST additionally be labeled as inference in a non-color channel.

**CT-14** Color MUST NOT infer, rank, imply, or beautify character, worth, trustworthiness, or desirability of a person from appearance, complexion, caste, religion, region, language, or script (C-3). Skin tone, regional, religious, or linguistic association MUST NOT be used as, or as a proxy for, a semantic color signal about a person. This is Tier-4 non-negotiable.

**CT-15** Color MUST NOT manufacture urgency, scarcity, anxiety, or compulsion (C-10). Alarm, heat, or high-saturation "act now" color treatments MUST be reserved for genuinely time- or safety-bound states and MUST be proportionate to real consequence. Color escalation solely to drive faster or more frequent action is prohibited (Tier 6 over Tier 9).

**CT-16** Color MUST be applied with restraint (C-14): the minimum chromatic force that reliably conveys the role. Premium quality MUST be expressed through precision, hierarchy, and spatial discipline — never through added color, saturation, gilding, or chromatic excess. Saturated or numerous accent colors MUST NOT be used as a substitute for genuine hierarchy.

**CT-17** Identical meanings MUST receive the same color role across every surface, feature, platform, and team; different meanings MUST receive distinguishable roles. Teams MUST NOT fork a private color meaning for a shared signal (C-15 consistency; VL-58 canonical system).

**CT-18** A color role MUST NOT be reused to carry a conflicting meaning in a different context. The same role MUST imply the same meaning and outcome everywhere, every time (predictability; VL-42).

**CT-19** Semantically opposite states (e.g., success vs. failure, verified vs. unverified, safe vs. dangerous) MUST be distinguishable from each other by a non-color channel AND MUST NOT be assigned color roles that are confusable to viewers with common color-vision deficiencies. Reliance on a single opposed hue pair (as the only differentiator) for opposite meanings is prohibited (C-8).

**CT-20** Where color is decorative and carries no semantic role, it MUST NOT resemble, adjoin, or be mistaken for a governed semantic role (e.g., decorative use MUST NOT mimic the verified, success, danger, or money roles). Decorative color MUST NOT reduce the contrast or discriminability of any semantic color in the same view.

# 3. Semantic Color Roles (Value-Independent)

**CT-21** The roles below constitute the governed semantic color system. Each MUST be encoded multi-channel per CT-3/CT-12, MUST meet the contrast floor for its function per §5, and MUST preserve meaning across themes per §6. The *value* satisfying each role is delegated (CT-1). No role in this table MAY be expressed by inference-of-character (CT-14).

| # | Role | Governing rule (value-independent) |
|---|------|-------------------------------------|
| CT-21.1 | Surface / neutral | Carries no state meaning; provides the ground against which semantic roles are read. MUST NOT be mistaken for any state role; MUST preserve contrast for all foreground roles it hosts. |
| CT-21.2 | Primary action | Denotes the single most important action in a view; used sparingly. MUST NOT be applied to more than one competing primary per view (VL-34). Not a state; MUST be paired with an actionable label. |
| CT-21.3 | Secondary / tertiary action | Denotes lower-priority actions; MUST be visually subordinate to primary yet still meet interactive contrast (§5). |
| CT-21.4 | Informational / neutral status | Denotes neutral system information with no valence; MUST NOT read as success, warning, or failure. |
| CT-21.5 | Success / positive completion | Denotes an action that actually completed (CT-13); paired with a confirming icon/label; MUST NOT be shown for pending or attempted actions. |
| CT-21.6 | Warning / reversible risk | Signals reversible risk before commitment; below failure in force, above neutral; paired with an explanatory label; MUST NOT be used for routine information. |
| CT-21.7 | Danger / failure / destructive | Signals failure or an irreversible/destructive consequence; calm yet unmissable, non-blaming (C-13); paired with shape/icon + text; MUST correspond to a real failure or real destructive consequence. |
| CT-21.8 | Verified-trust | Denotes a scope-bounded, system-confirmed verification (§4); reserved exclusively for confirmed verification; MUST NOT be conferred by polish or applied to unverified/inferred content. |
| CT-21.9 | Unverified / not-yet-verified | Denotes absence of confirmed verification; MUST be visually distinct from verified and MUST NOT be readable as verified (§4). |
| CT-21.10 | Unknown / unassessed | Fail-secure trust role for indeterminate state; resolves toward unverified, never toward verified or a blank-implying-safe treatment (§4, §8). |
| CT-21.11 | Money / financial value | Denotes amounts, prices, balances, charges; neutral and honest; MUST NOT be restyled to obscure, minimize, or emphasize cost misleadingly (§7). |
| CT-21.12 | Irreversible / committed | Denotes a point of no return (charge, send, publish, delete); paired with explicit label of finality; MUST NOT share the calm-neutral treatment of a reversible action. |
| CT-21.13 | Selected / active | Denotes current selection or active state; paired with a non-color indicator (shape, checkmark, position). |
| CT-21.14 | Disabled / unavailable | Denotes non-interactive state; MUST remain perceivable (its meaning "unavailable" is information) and MUST NOT be the only cue that an action exists but is blocked. |
| CT-21.15 | Focus indicator | Denotes keyboard/assistive focus; MUST always be visible, MUST meet the focus contrast floor (§5), and MUST NOT be suppressed for aesthetics (C-8). |
| CT-21.16 | Link / interactive text | Denotes interactive text; MUST be distinguishable from body text by a non-color channel (e.g., underline/affordance), never by color alone (C-8). |
| CT-21.17 | Privacy / visibility scope | Denotes who can see/do what; scope legible before disclosure; MUST NOT nudge toward over-disclosure by color (C-4, C-6). |
| CT-21.18 | Safety / emergency | Denotes report/block/exit/help affordances; MUST remain reachable and never suppressed, demoted, or camouflaged by color or minimalism (C-5). |
| CT-21.19 | AI-assistance | Denotes automated assistance; consistently distinguishable from human and from confirmed system fact; paired with an explicit "AI" label (C-12); MUST NOT be disguised as human or as verified fact. |
| CT-21.20 | Human-assistance | Denotes a human source; MUST NOT be disguised as system/automated, nor system as human. |
| CT-21.21 | Inference / uncertainty | Denotes predicted/estimated/inferred content; visually distinct from confirmed-fact roles (CT-13); paired with an uncertainty label; MUST NOT borrow the verified or success role. |
| CT-21.22 | Promotional / upsell | Lowest-tier role (T9); MUST NOT be given color prominence above safety, consent, privacy, trust-state, money, or the current task (VL-18). |
| CT-21.23 | Progress | Reflects real, monotonic advancement only; MUST NOT fabricate advancement or completion via color fill (C-13). |
| CT-21.24 | Membership / tier | Distinguishes member states factually and without shaming non-members; MUST NOT weaponize color status or imply worth (dignity). |

**CT-22** The role set is canonical and closed to private extension: a team MUST NOT introduce a new semantic color role, or split/merge existing roles, without amending this specification (deviation recorded per SHIG-0001). A view needing a distinction the role set lacks MUST raise an amendment, not improvise a color meaning.

**CT-23** No two roles that a member must distinguish in the same context MAY be assigned values indistinguishable to common color-vision deficiencies without their mandatory non-color pairing carrying the full distinction (CT-12, CT-19).

# 4. Trust-State Color Semantics

**CT-24** The trust states **verified**, **unverified**, and **unknown/unassessed** MUST be mutually and unambiguously distinct, MUST NOT be distinguished by color alone, and MUST NOT be collapsed or made to resemble one another (C-1, C-8; VL-8). Each MUST carry a non-color channel (icon + text label at minimum) sufficient to identify the state with all color removed.

**CT-25** Absence of the verified color role MUST NOT be readable as verified. A neutral, empty, or default surface MUST NOT imply verification. The verified role MUST be *affirmatively present and paired*, never inferred from the absence of a warning.

**CT-26** The verified-trust role MUST be scope-bounded in its paired label: color denotes "a verification exists," and the paired text MUST state *what* was verified, and where relevant by whom and when. Color MUST NOT imply a broader verification than the system holds (e.g., a verified contact detail MUST NOT be colored to imply a verified person; C-2).

**CT-27** Unknown or ambiguous trust state MUST resolve, in color and in its paired channel, to **unverified** (fail-secure) — never to verified, and never to a blank treatment a member could read as safe (§8). A system unable to determine trust state MUST present unverified, not nothing.

**CT-28** The verified, unverified, and unknown roles MUST remain mutually distinct across every theme (light, dark, high-contrast) and every capability degradation (grayscale, monochrome, low-bandwidth, assistive tech). A theme or degradation in which two trust states become confusable is non-conformant (§6).

**CT-29** Trust-state color roles MUST NOT be restyled, re-hued, dimmed, or decorated in any way that makes an unverified entity appear verified or a verified entity appear more or less verified than the system's actual, scope-bounded record (C-2; §7). Trust color is integrity-critical and Tier 1–3.

**CT-30** Trust-state color MUST NOT be derived from or correlated with any person's appearance, complexion, caste, religion, region, language, or script (CT-14, C-3). Verification color reflects verification events only, never inferred character.

# 5. Contrast Floors

**CT-31** All text, essential glyphs, and meaningful non-text graphics MUST meet or exceed the WCAG 2.2 AA contrast minimum for their role and size, against every background they appear on, in every theme. This is a Tier 1–4 floor and MUST NOT be traded for brand, aesthetics, novelty, or growth (C-8; VL-31).

**CT-32** State indicators, focus indicators, selection indicators, and the boundaries of interactive controls MUST meet at least the WCAG 2.2 AA non-text contrast minimum against adjacent colors, so that state and interactivity are perceivable independent of hue (C-8).

**CT-33** Critical states — verified/unverified/unknown trust (§4), safety/emergency affordances (CT-21.18), irreversible/committed actions (CT-21.12), failure/danger (CT-21.7), and money (CT-21.11) — MUST meet a contrast level *above* the AA minimum wherever the higher level (approaching AAA for the element's role) is achievable without compromising a higher-tier requirement. These states MUST NOT sit at the bare minimum when headroom exists.

**CT-34** Contrast MUST NOT be the sole carrier of a meaning: a distinction encoded only as a low-versus-high contrast difference (with no label, shape, or icon) is non-conformant (CT-3; VL-32). Meaning MUST survive reduction of any decorative contrast difference to the AA floor.

**CT-35** Contrast floors MUST hold under real-world conditions the platform supports: small viewports, glare, low-vision simulation, degraded rendering, and reduced color gamut. A color pairing that passes only under ideal display conditions is non-conformant (C-9 device plurality).

**CT-36** Text or essential graphics placed over images, video, gradients, or variable backgrounds MUST guarantee the contrast floor across the entire range the background can take (e.g., via a guaranteed-contrast treatment), never assume a favorable background. Assumed-favorable-background contrast is non-conformant.

**CT-37** User text-scaling and platform contrast/appearance preferences (increased contrast, larger text) MUST be honored without loss of content, function, or any semantic color distinction. Honoring a preference MUST NOT collapse two roles into one (C-8, C-9).

**CT-38** Disabled-state color (CT-21.14) MAY fall below interactive-text contrast to signal unavailability, but any information conveyed by a disabled element (that an action exists, why it is blocked) MUST remain perceivable through a non-color, sufficiently-contrasted channel. Unavailability MUST NOT hide safety, consent, or cost information.

# 6. Theming (Light, Dark, High-Contrast) — Meaning Preserved

**CT-39** At least a light theme, a dark theme, and a high-contrast theme MUST be supported as first-class, and every semantic color role MUST preserve its meaning, its relative valence, and its distinctness from other roles across all supported themes. Presentation MAY adapt; meaning MUST NOT diverge (VL-59).

**CT-40** Every theme MUST independently satisfy all contrast floors of §5 for every role it renders. A theme that meets contrast in one mode but not another is non-conformant; conformance is per-theme, not aggregate.

**CT-41** Role identity MUST be stable across themes: a role MUST NOT swap to a value that, in another theme, denotes a *different* role (e.g., a hue that means "success" in light MUST NOT be perceivable as "warning" or "danger" in dark). Cross-theme role collision is non-conformant (CT-17/CT-18).

**CT-42** The high-contrast theme MUST NOT drop, merge, or weaken any semantic distinction to achieve contrast; if a role cannot be expressed by color at the required contrast, its non-color pairing MUST carry the full distinction. High-contrast MUST strengthen, never erase, meaning (C-8).

**CT-43** Trust-state distinctness (§4), safety-affordance reachability (CT-21.18), money legibility (CT-21.11), and inference-vs-fact distinction (CT-13/CT-21.21) MUST hold identically in every theme. These MUST be verified per theme (§9).

**CT-44** Theme selection MUST respect the member's explicit or platform-level preference where expressed, MUST be reversible, and MUST NOT be overridden to serve engagement or promotion (C-7 agency; C-10 calm). An unknown theme preference MUST resolve to the theme that best guarantees contrast and legibility, never to the most promotional treatment.

**CT-45** Theme transitions MUST NOT momentarily render any critical state (trust, safety, money, danger) illegible or misleading; during a transition the member MUST never see a verified entity flash as unverified, or a cost become illegible.

**CT-46** Adding a new theme, or altering a theme, MUST re-verify every role against §4–§6 and §9 before member exposure. An unverified theme is treated as non-conformant (fail-secure).

# 7. Color, Money & Verification Integrity

**CT-47** Color applied to money, price, cost, charges, balances, and financial commitment (CT-21.11) MUST be honest and neutral: it MUST NOT visually minimize, camouflage, de-emphasize, or bury a cost, nor over-emphasize a discount or reward to manufacture urgency (C-2, C-10). The full, true amount MUST meet the critical-state contrast floor (CT-33).

**CT-48** Color MUST NOT be used to make a paid state look free, a recurring charge look one-time, an estimate look final, or a higher price look lower (or vice versa). Any color emphasis on price differences MUST be proportionate and truthful; asymmetric coloring that flatters one option deceptively is prohibited (C-2; Tier 3 over Tier 9).

**CT-49** Verification and trust color (§4) and money color (CT-21.11) are integrity-critical roles that MUST NOT be restyled, re-skinned, themed, A/B-tested, personalized, or brand-customized in any way that changes or could mislead about the underlying trust or money state (C-2, C-14). Cosmetic variation of these roles that alters perceived meaning is prohibited.

**CT-50** Promotional and upsell color (CT-21.22) MUST NOT borrow, adjoin, or imitate the verified-trust, success, safety, or money roles to lend false legitimacy or urgency to a commercial offer (C-2). A promotion MUST NOT be colored to look like a verified fact, a completed success, or a safety notice.

**CT-51** Consent and privacy affordances (CT-21.17) MUST be presented in neutral, non-nudging color: the more privacy-protective choice MUST NOT be colored as less attractive, and the more-disclosing choice MUST NOT be colored as the default or recommended path (C-4 no pre-checked/nudged consent; C-6 privacy by default).

**CT-52** Where color could be used to create a dark pattern — coloring a decline/cancel as inert while an accept/upgrade is highlighted, coloring a destructive action as benign, coloring an unverified party as trusted — the higher-tier honesty/consent/safety requirement wins and the pattern is prohibited (Article 4; T2/T3 over T9).

# 8. Fail-Secure Color for Unknown & Ambiguous State

**CT-53** For any state that is unknown, indeterminate, still loading, or that the system cannot confirm, color MUST fail secure: it MUST resolve toward the more cautious meaning (unverified rather than verified, uncommitted rather than committed, private rather than exposed, unsafe-until-confirmed rather than safe), and MUST be paired with a non-color channel stating the indeterminacy (C-13 honest loading/empty states).

**CT-54** A missing, unloaded, or errored color value MUST NOT default to a treatment that reads as a positive or trusted state. Absence of data MUST NOT render as success, verified, safe, or free. The default-on-failure treatment MUST be neutral or cautionary, never reassuring (fail-secure).

**CT-55** Loading and skeleton states MUST NOT pre-render a semantic color role for content not yet known (e.g., MUST NOT show a verified color before verification is confirmed, or a success color before completion). Placeholder color MUST be clearly non-semantic and MUST NOT be mistaken for a resolved state (VL-16).

**CT-56** When a color value cannot meet its required contrast floor in the current theme or on the current device, the system MUST fall back to a treatment that preserves the semantic distinction and the contrast floor via the non-color channel, rather than render an illegible or misleading color. Silent degradation below the floor is non-conformant.

# 9. Validation, Multi-Platform Parity & Audit

**CT-57** In-scope platforms include desktop, mobile, tablet, web surfaces, wearables, print/export, and any surface capable of color rendering; non-visual, voice, and ambient surfaces MUST convey the equivalent color-borne meaning through their available modality (the non-color pairing carries it) (C-8, C-9). Color meaning MUST NOT be lost on a platform that cannot render the intended value.

**CT-58** Every semantic role MUST pass, per theme and per supported capability tier: (a) a grayscale render test (meaning survives without color, CT-11); (b) a color-vision-deficiency simulation test (no confusable opposed roles, CT-19/CT-23); (c) a measured contrast test against the §5 floors (CT-31–CT-37); (d) a trust-state discrimination test (verified/unverified/unknown distinct and fail-secure, §4); and (e) a theme-parity test (meaning preserved across themes, §6). Any Tier 1–4 failure blocks release (§ Quality Framework).

**CT-59** Color conformance MUST be evidenced by recorded measurements at defined review points and on any change touching an integrity-critical role (§4, money, safety). Unmeasured color usage is treated as non-conformant (C-17; fail-secure).

**CT-60** New palettes, themes, brand refreshes, or personalization schemes MUST be assessed against §2–§8 and §9 before member exposure; none MAY weaken a Tier 1–4 color guarantee (may-only-be-strengthened).

# Decision Framework

**CT-61** When color options compete, teams MUST apply SHIG-0000 Article 4 lexicographically: Safety & legality ▸ Consent & privacy ▸ Honesty of signal ▸ Dignity & inclusion ▸ Understanding & task ▸ Wellbeing & calm ▸ Consistency ▸ Craft & aesthetics ▸ Business & growth. A color option that better serves a lower tier MUST NOT be chosen over one that better serves a higher tier.

**CT-62** The following color properties are NON-NEGOTIABLE (Tier 1–4) and MUST NOT be traded for brand, novelty, aesthetics, or growth: never-single-channel / multi-channel pairing (CT-3, CT-12); contrast at AA and above for critical states (CT-31–CT-33); verified/unverified/unknown distinctness and fail-secure trust (§4); money and verification integrity (§7); non-inference of character from color (CT-14); honesty of inference-vs-fact color (CT-13); safety-affordance color reachability (CT-21.18); privacy/consent neutral coloring (CT-51); and fail-secure on unknown state (§8).

**CT-63** Lower-tier color properties (decorative harmony, accent richness, brand expressiveness) MAY be traded when a higher tier requires it, with a recorded justification naming the higher tier served (SHIG-0001). MUST-level requirements admit no deviation.

**CT-64 (Decision table)**

| Situation | Competing pull (tiers) | Required resolution | Governing IDs |
|-----------|------------------------|---------------------|---------------|
| Brand hue fails AA contrast | Craft/brand (T8) vs Accessibility (T1–4) | Contrast floor wins; adjust value or pairing | CT-31, CT-62 |
| Status shown by color only | Craft (T8) vs Accessibility (T1–4) | Add load-bearing non-color channel | CT-3, CT-12 |
| Two opposite states differ only by one hue pair | Aesthetics (T8) vs Inclusion (T4) | Add non-color distinction; avoid confusable pair | CT-19, CT-23 |
| Unknown trust rendered neutral/blank | Simplicity (T8) vs Honesty/Trust (T3/T1) | Resolve to unverified, paired + labeled | CT-27, CT-53 |
| Promotion colored like a verified badge | Business (T9) vs Honesty (T3) | Prohibited; promotion must not imitate trust/success | CT-50, CT-52 |
| Cancel greyed inert, upgrade highlighted | Business (T9) vs Consent (T2) | Neutral, non-nudging coloring required | CT-51, CT-52 |
| Cost de-emphasized by low-contrast color | Business (T9) vs Honesty (T3) | Money meets critical-state contrast; honest neutral | CT-47, CT-48 |
| Color linked to appearance/complexion/community | Aesthetics/Business | Prohibited; no inference-of-character | CT-14, CT-30 |
| High-contrast theme merges two roles | Craft (T8) vs Accessibility (T1–4) | Non-color pairing carries full distinction | CT-42, CT-58 |
| Loading skeleton pre-tinted as success/verified | Craft (T8) vs Honesty (T3) | Non-semantic placeholder; no pre-rendered state | CT-55, CT-54 |
| Saturated urgency color to drive action | Business (T9) vs Calm (T6) | Reserve alarm color for real time/safety states | CT-15, CT-52 |

# Quality Framework (Measurable)

**CT-65** Each attribute below MUST be measured with a defined method and a recorded accept/reject threshold per release. Claims of conformance MUST be backed by measurement (C-17).

| # | Quality attribute | What it measures | Accept | Reject |
|---|-------------------|------------------|--------|--------|
| CT-66 | Grayscale survival | Meaning distinguishable with all color removed | Every semantic distinction survives | Any distinction lost without color |
| CT-67 | Non-color pairing | Each color role has a load-bearing non-color channel | All roles paired (label/shape/icon/position) | Any color-only meaning |
| CT-68 | Contrast (text & graphics) | Measured ratio vs WCAG 2.2 AA per theme | All in-scope elements pass AA, per theme | Any essential element below AA in any theme |
| CT-69 | Critical-state contrast | Trust, safety, money, danger, focus above-AA where achievable | Critical states above minimum with headroom | Critical state at bare minimum with headroom unused |
| CT-70 | Color-vision-deficiency safety | Opposed/confusable roles under CVD simulation | No confusable opposed roles unaided by pairing | Any opposite states confusable without pairing |
| CT-71 | Trust-state distinctness | Verified/unverified/unknown discrimination + fail-secure | Three distinct, not color-alone, fail-secure | Any confusable, color-alone, or unknown-reads-verified |
| CT-72 | Theme parity | Role meaning preserved across light/dark/high-contrast | Full meaning parity, per-theme contrast met | Any cross-theme role collision or contrast fail |
| CT-73 | Money/verification integrity | Honest, non-misleading coloring of cost & trust | Neutral, truthful, unrestyled to mislead | Any restyle that misleads about money or trust |
| CT-74 | Consent/privacy neutrality | Non-nudging coloring of consent & privacy choices | Protective choice not disfavored by color | Any color nudge toward over-disclosure/consent |
| CT-75 | Non-inference | No color derived from appearance/complexion/caste/religion/region/language | Zero inference-based color | Any inference-of-character color use |
| CT-76 | Fail-secure on unknown | Unknown/loading/error color resolves cautiously | Cautious, paired, labeled default | Any positive/trusted default on unknown/failure |
| CT-77 | Calm | No color-manufactured urgency/anxiety | Alarm color reserved for real time/safety states | Color escalation solely to drive action |
| CT-78 | Consistency | Same meaning → same role everywhere; no forks | No conflicting/duplicated role use | Any forked or conflicting color meaning |

**CT-79 (Gate)** A release MUST NOT ship if any Tier 1–4-linked attribute is in Reject: CT-66, CT-67, CT-68, CT-69, CT-70, CT-71, CT-72, CT-73, CT-74, CT-75, CT-76. Tier 5–9 rejects (e.g., CT-77 calm refinements, CT-78 non-critical consistency) MUST be recorded with a remediation plan (SHIG-0001).

# Governance

**CT-80** This specification is Tier 1–4 in effect and, per SHIG-0000, MAY only be strengthened, never weakened, by future revisions. Requirement IDs (CT-n) are permanent; a superseded rule is marked Deprecated, never reused, renumbered, or deleted.

**CT-81** The semantic color role set (§3) is canonical. Adding, removing, splitting, or merging a role, or changing an integrity-critical role's meaning (§4, money, safety), MUST amend this specification and re-run §9 validation before member exposure.

**CT-82** Every color-touching change MUST cite the CT IDs it satisfies and record any SHOULD-level deviation with its higher-tier justification (SHIG-0001). MUST-level requirements admit no deviation.

**CT-83** Conformance MUST be evidenced by the §9 measurements at defined review points and on any change to an integrity-critical role; unmeasured color usage is treated as non-conformant (fail-secure; C-17).

**CT-84** Unknown, ambiguous, missing, or unverifiable color state MUST resolve to the more cautious, non-misleading treatment throughout this specification (fail-secure is the default rule, not an exception).

**CT-85** Conflicts between this specification and any implementation guide, palette, or theme resolve in favor of this specification; conflicts between this specification and SHIG-0000/0001, or the accessibility floor owned by SHIG-0011, resolve in favor of those higher/anchor instruments.

# Compliance / Review Checklist

- **CT-86** Every meaningful color distinction survives a grayscale render and has a load-bearing non-color pairing (CT-3, CT-11, CT-12, CT-67).
- **CT-87** No color-only meaning anywhere, including links, states, focus, selection, and status (CT-3, CT-16, CT-34).
- **CT-88** Verified / unverified / unknown mutually distinct, not color-alone, verified affirmatively present, unknown fails secure to unverified (§4, CT-71).
- **CT-89** Contrast meets WCAG 2.2 AA for text, essential graphics, states, and focus, in every theme; critical states exceed the minimum where achievable (CT-31–CT-33, CT-68, CT-69).
- **CT-90** Meaning survives color-vision-deficiency simulation; no confusable opposed roles unaided by pairing (CT-19, CT-23, CT-70).
- **CT-91** Every role preserves meaning and distinctness across light, dark, and high-contrast themes; each theme independently meets contrast (§6, CT-72).
- **CT-92** Money coloring is honest and neutral; the true amount meets critical-state contrast; no deceptive emphasis (CT-47, CT-48, CT-73).
- **CT-93** Trust and money roles are not restyled, themed, personalized, or A/B-tested in any way that misleads (CT-49, CT-73).
- **CT-94** Promotional color does not imitate verified/success/safety/money roles (CT-50, CT-52).
- **CT-95** Consent and privacy choices are colored neutrally; protective choice not disfavored (CT-51, CT-74).
- **CT-96** No color derived from or correlated with appearance, complexion, caste, religion, region, language, or script (CT-14, CT-30, CT-75).
- **CT-97** Inference/prediction color distinct from confirmed-fact roles and labeled as inference (CT-13, CT-21.21).
- **CT-98** Unknown, loading, error, and missing-value color fails secure to a cautious, paired, labeled treatment (§8, CT-76).
- **CT-99** Safety/emergency color reachable and never suppressed or camouflaged (CT-21.18).
- **CT-100** No color-manufactured urgency, scarcity, or anxiety; alarm color reserved for real time/safety states (CT-15, CT-77).
- **CT-101** Identical meaning → identical role across surfaces, platforms, teams; no forked meanings (CT-17, CT-18, CT-78).
- **CT-102** No literal color values, palettes, hex/RGB/HSL, named tokens, or component/framework references defined in this document (CT-1).
- **CT-103** Each §9 attribute measured with recorded accept/reject; the CT-79 gate honored; changes cite satisfied CT IDs (CT-59, CT-79, CT-82).

# Anti-patterns

For each: *why it harms (C-n/tier) · how to detect · how to prevent.*

- **CT-104 Color-only status** — Meaning carried by hue alone (e.g., bad-versus-good by hue with no label/icon). Harms accessibility and inclusion (C-8, T4). Detect: grayscale render collapses the states; CVD simulation confuses them. Prevent: mandatory load-bearing non-color pairing (CT-3, CT-12).
- **CT-105 Verified/unverified collapse** — Verified and unverified rendered confusably, or absence read as verified. Harms trust and safety (C-1, T1–3). Detect: naive viewer mistakes unverified for verified; verified inferred from a blank surface. Prevent: affirmative, distinct, paired trust roles; fail-secure (§4, CT-25).
- **CT-106 Trusted-by-tint** — Unverified party or promotion tinted to look verified/legitimate. Harms honesty (C-2, T3). Detect: promotional or unverified content borrowing trust/success color. Prevent: reserve trust/success roles; prohibit imitation (CT-49, CT-50).
- **CT-107 Cost camouflage** — Price/charge de-emphasized or discount over-emphasized by color to mislead. Harms honesty and calm (C-2/C-10, T3). Detect: cost below critical-state contrast; asymmetric flattering color on price. Prevent: honest, neutral money color at critical-state contrast (CT-47, CT-48).
- **CT-108 Consent nudging by color** — Protective choice greyed/inert, disclosing/upgrade choice highlighted. Harms consent and privacy (C-4/C-6, T2). Detect: side-by-side choices with asymmetric attractiveness. Prevent: neutral, non-nudging consent/privacy color (CT-51, CT-52).
- **CT-109 Inference-of-character color** — Color derived from complexion, caste, religion, region, or language, or used to rank/beautify persons. Harms dignity (C-3, T4). Detect: any color signal correlated with a protected/appearance attribute. Prevent: absolute prohibition (CT-14, CT-30).
- **CT-110 Manufactured-urgency color** — Alarm/heat/high-saturation used to pressure, not to signal a real time/safety state. Harms wellbeing (C-10, T6). Detect: escalation color absent a genuine time-bound consequence. Prevent: reserve alarm color; proportionate to real consequence (CT-15).
- **CT-111 Theme meaning drift** — A role that means one thing in light reads as another (or fails contrast) in dark/high-contrast. Harms consistency and accessibility (C-8/C-15, T4/T7). Detect: cross-theme role collision or per-theme contrast fail. Prevent: per-theme parity and contrast verification (§6, CT-72).
- **CT-112 Optimistic default on unknown** — Missing/loading/errored value renders as success/verified/safe/free. Harms honesty and safety (C-2/C-13, T1–3). Detect: skeleton or error state tinted with a positive role. Prevent: fail-secure cautious defaults; non-semantic placeholders (§8, CT-55).
- **CT-113 Chromatic excess as premium** — Saturation, gilding, or accent proliferation used to signal quality. Harms restraint and clarity (C-14, T8/T5). Detect: accent count and saturation exceed communicative need; hierarchy carried by color not structure. Prevent: minimum chromatic force; premium via precision (CT-16).
- **CT-114 Focus/link suppression** — Focus indicator or link affordance removed or color-only for aesthetics. Harms accessibility (C-8, T1–4). Detect: keyboard focus invisible; links distinguished by color alone. Prevent: always-visible focus at contrast floor; non-color link affordance (CT-21.15, CT-21.16).
- **CT-115 Integrity-role personalization** — Trust or money roles restyled by A/B test, brand skin, or personalization. Harms honesty (C-2, T3). Detect: variation in trust/money color that changes perceived meaning. Prevent: lock integrity-critical roles against cosmetic variation (CT-49).
- **CT-116 Decorative mimicry** — Decorative color resembling a governed role (danger/success/verified/money) in context. Harms honesty and clarity (C-2, T3/T5). Detect: decorative color adjacent to or mistakable for a semantic role. Prevent: decorative color must not imitate or reduce discriminability of semantic roles (CT-20).

# Open Questions

- **CT-117** Numeric per-release thresholds for the §9 measurements (exact above-AA target ratios for critical states, CVD-simulation pass rates) require SHIG-wide calibration and are deferred to a measurement annex, without introducing implementation values here.
- **CT-118** The canonical device/capability matrix for CT-35/CT-57 (which gamut, bandwidth, and display tiers must be guaranteed, India-first) is deferred to coordination with the accessibility and localization instruments.
- **CT-119** A cultural-color-plurality reference — cataloguing how color connotations differ across India's communities so that no single culture's associations are assumed as default (C-9) — is deferred to a dedicated cultural-inclusion annex; until published, teams MUST rely on the non-color pairing to carry meaning and MUST NOT assume any community's color connotation is universal.
- **CT-120** Governance interface with the design-token instrument (which owns literal values) to guarantee no value/principle overlap or contradiction, and the schema by which tokens declare which CT role they satisfy, is deferred to that instrument's issuance.
- **CT-121** Equivalence mapping for color-borne meaning on non-visual, voice, and ambient surfaces (CT-57) awaits a modality-mapping guide as those surfaces mature.

# Revision History

| Version | Date | Status | Author | Summary |
|---------|------|--------|--------|---------|
| 1.0.0 | 2026-07-27 | Active | Chief Design Officer, Sambandh | Initial governing specification for the Color & Theming System; role-, contrast-, pairing-, and theming-level governance with no literal values; requirement IDs CT-1..CT-121. |

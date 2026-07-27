# Specification ID

SHIG-0019

# Specification Name

Iconography & Imagery System Specification

# Version

1.0.0

# Status

Active

# 1. Purpose & Scope

**IM-1** This specification MUST govern the *rules of meaning, honesty, and dignity* for every icon, photograph, illustration, avatar, pictogram, and graphic mark that Sambandh presents to a member across every surface, feature, service, platform, and device. It governs the **grammar and truthfulness of visual signs** — NOT the drawing of any specific icon, the sourcing of any specific photograph, file formats, rendering pipelines, asset names, components, or literal geometry (those are implementation).

**IM-2** This specification governs OUTCOMES and PROPERTIES: that a visual sign carries a consistent, honest meaning; that no image asserts a falsehood; that no image is used to judge a person; that meaningful imagery is accessible; that representation is plural; that ornament without meaning is excluded; and that the absence of an image degrades safely. It MUST NOT be read as prescribing code, widgets, frameworks, or literal values.

**IM-3** Three visual-sign classes are in scope and each is governed here: **icons** (compact symbolic marks that stand for actions, objects, states, or categories), **imagery** (photography and illustration depicting scenes, objects, or people), and **avatars** (the visual stand-in for a specific member or entity). A single asset that spans classes MUST satisfy every rule of every class it occupies.

**IM-4** An icon or image is **meaningful** when its removal would change what a member understands or can do; it is **decorative** only when its removal changes nothing a member needs. This distinction is load-bearing throughout this specification and MUST be determinable for every asset (see §8).

**IM-5** This specification MUST comply with SHIG-0000 (Constitution, Article 4 lexicographic hierarchy; principles C-1..C-17) and follow SHIG-0001 rule grammar. Philosophy established in SHIG-0000 and sibling specs MUST be referenced by ID, not restated.

## 1.1 Cross-Instrument Relationships

**IM-6** This specification derives its authority from **SHIG-0000** (Constitution). Where iconography or imagery touches meaning-honesty it enforces C-2; human dignity and non-inference, C-3; single-channel prohibition and the WCAG 2.2 AA floor, C-8; consent, C-4; safety-reachability, C-5; privacy-by-default, C-6; calm, C-10; premium-through-restraint, C-14; India-first plurality, C-9; and honest states, C-13. Conflicts resolve by **Article 4** lexicographic tiers, never by local preference.

**IM-7** This specification MUST follow **SHIG-0001** rule grammar (RFC-2119 keywords, permanent IDs, deviation records) and MUST NOT contradict it.

**IM-8** This specification depends on and MUST align with, without duplicating: **SHIG-0002** (brand foundation — the identity these marks express), **SHIG-0007** (visual language — the shared visual system icons and imagery inhabit), and **SHIG-0011** (accessibility & inclusive design — the accessibility floor this spec applies to imagery). Where a term is defined there, this spec uses it unchanged.

**IM-9** This specification MUST NOT govern **color values or contrast palettes** (governed by SHIG-0017) nor **motion, transition, or animation behavior** (governed by SHIG-0016); it references them. Where an icon or image must meet contrast, this spec states the *property* ("MUST meet the WCAG 2.2 AA non-text contrast requirement") and defers the *value* to SHIG-0017; where an icon animates, timing and easing are deferred to SHIG-0016.

**IM-10** Where this specification and any implementation guide, asset library, or brand kit conflict, this specification prevails; where this specification and SHIG-0000/0001 conflict, those anchor instruments prevail.

# 2. Foundational Principles

Each principle below is a normative requirement bearing its own permanent ID.

**IM-11 (Sign honesty)** No icon, image, or avatar MAY assert, imply, or decorate a claim that is not true at the moment of display. A visual sign that communicates certainty, verification, endorsement, identity, or fact MUST correspond to an established truth; if the underlying truth is inferred, predicted, partial, or unverified, the sign MUST reflect that lesser status (C-2). Fail-secure: when truth-status is unknown or ambiguous, the sign MUST resolve to the *less certain* reading, never the more certain one.

**IM-12 (Meaning never single-channel)** A visual sign MUST NOT be the sole carrier of any meaning a member needs to act, understand safety, or understand consequence. Every meaningful icon MUST be paired with an accessible name or visible text label; every meaningful state conveyed by imagery MUST also be conveyed by text or another independent channel (C-8). Color, position, shape, or motion alone MUST NOT carry the meaning (C-8; SHIG-0017 for color, SHIG-0016 for motion).

**IM-13 (Non-inference from appearance)** No image or avatar MAY be used — by design, placement, ordering, styling, or automated processing — to infer, rank, imply, or represent a person's character, worth, trustworthiness, or suitability from appearance, complexion, caste, religion, region, language, or any protected or proxy attribute (C-3). This is a Tier-4 inviolable and is not tradable for any lower-tier benefit.

**IM-14 (Provenance clarity)** The **origin and status** of every image class MUST be truthfully communicated where a reasonable member could otherwise mistake it: real-and-current, illustrative, preview/placeholder, stock/representative, or automatically generated. An image whose origin would mislead if unlabeled MUST be labeled (C-2; see §4).

**IM-15 (Dignity of representation)** Every depiction of a human MUST preserve dignity: no image MAY caricature, exoticize, subordinate, or stereotype any community, body, gender, age, ability, region, faith, or language group (C-3). Representation MUST be plural, and no single community, complexion, language, or name-form MAY be presented as the default or aspirational norm (C-9).

**IM-16 (Restraint)** Visual signs MUST earn their place through meaning, hierarchy, and clarity — never through ornament, density, or spectacle. Decoration that carries no meaning and serves no orientation, hierarchy, or brand-identity purpose MUST NOT be added (C-14). Premium is achieved through precision and restraint, not accumulation.

**IM-17 (Graceful absence)** The absence of an image — unloaded, unavailable, withheld, or never provided — MUST degrade to a state that preserves every trust, safety, and meaning signal the present image would have carried, and MUST NOT itself become a signal of lesser trust, worth, or status (C-2, C-3, C-13; see §9).

**IM-18 (Calm)** Iconography and imagery MUST NOT manufacture urgency, anxiety, alarm, or compulsion. Alarm imagery MUST be reserved for genuine safety conditions; badges, counts, and status marks MUST NOT be styled to pressure (C-10; SHIG-0016 governs any motion involved).

**IM-19 (Consistency over novelty)** A given meaning MUST map to one consistent visual sign across surfaces, services, and releases; one sign MUST NOT carry two meanings, and one meaning MUST NOT be split across two competing signs (C-15). Novelty MUST NOT override an established, learned mapping.

**IM-20 (Systemic, not one-off)** Icons, imagery treatments, avatars, and their fallbacks MUST be defined as reusable, tokenizable system rules and patterns, not per-screen bespoke assets, so meaning and behavior remain maintainable and uniform over time (C-16).

# 3. Iconography Grammar

**IM-21 (One meaning, one icon)** Each icon MUST denote exactly one stable meaning within a scope; the same meaning MUST use the same icon everywhere it appears (IM-19). A meaning that has no single agreed icon MUST be resolved before use, not disambiguated by context alone.

**IM-22 (Accessible name mandatory)** Every meaningful icon MUST have an accessible name that states its meaning, available to assistive technology and, where the icon acts alone as a control, discoverable by sighted members on demand. An icon-only control without an accessible name is non-conformant (C-8; IM-12).

**IM-23 (Label pairing for critical meaning)** Where an icon conveys meaning that is critical to safety, consent, money, irreversibility, or trust state, it MUST be paired with a persistently visible text label, not an accessible name alone. Critical meaning MUST NOT depend on hover, long-press, or recall (C-8; C-5).

**IM-24 (No icon-only safety or consent)** Controls that reach safety, report, block, consent, or irreversible actions MUST NOT be represented by icon alone without a visible label; their meaning MUST be unmistakable without prior learning (C-5, C-4; Tier 1–2).

**IM-25 (Honest state icons)** Icons that represent state — verified, pending, secure, error, success, loading, empty — MUST map truthfully to the actual state and MUST distinguish *verified* from *unverified/pending* by more than color (C-2, C-8, C-13). A verification or trust mark MUST NOT appear on an unverified subject; unknown state MUST render as not-verified (fail-secure).

**IM-26 (No borrowed authority)** An icon MUST NOT imply an endorsement, certification, security guarantee, or third-party authority the subject has not actually earned. Lock, shield, checkmark, seal, and badge forms MUST correspond to a real, current fact (C-2; IM-11).

**IM-27 (Distinguishable action vs status)** Icons that a member can act upon MUST be visually and semantically distinguishable from icons that merely report status, so a member never mistakes a label for a button or a button for a label. This distinction MUST NOT rely on color alone (C-8; SHIG-0017 for color).

**IM-28 (Cultural legibility)** Icon metaphors MUST be legible to a plural, India-first audience and MUST NOT depend on a single culture's idiom, gesture, object, or script to be understood. An icon whose meaning is opaque or offensive outside one community MUST be replaced or paired with text (C-9).

**IM-29 (No meaning drift)** An icon's meaning MUST NOT change between surfaces or releases. If a meaning must change, the icon MUST change with it and the old mapping MUST be migrated with signposting; silent reuse of a known icon for a new meaning is non-conformant (C-15; IM-19).

**IM-30 (Icon families coherent)** Icons presented together MUST share a coherent visual grammar (weight, corner treatment, metaphor family, level of detail) sufficient that they read as one system; a member MUST NOT have to relearn the visual language per screen (C-14, C-15; SHIG-0007). Specific stroke and geometry values are implementation, governed by the visual-language system, not restated here.

**IM-31 (Icon contrast & size legibility)** Meaningful icons MUST meet the applicable WCAG 2.2 AA non-text contrast property and MUST be presented at a size and target dimension at which their meaning is legible and, when interactive, comfortably actionable (C-8). Contrast values are governed by SHIG-0017; target-size figures by SHIG-0011.

**IM-32 (No decorative icon masquerading as control)** A purely decorative icon MUST be marked as decorative to assistive technology and MUST NOT present affordances (focus, press states) that imply it is actionable when it is not (C-8, C-13; IM-16).

**IM-33 (Directionality & localization)** Icons that encode direction, sequence, or reading order MUST respect the active locale's reading direction and numeral/date/name conventions; a directional icon MUST NOT contradict the member's script direction (C-9).

# 4. Imagery Honesty & Provenance

**IM-34 (Provenance label required)** Illustrative, preview, placeholder, representative/stock, composite, or automatically generated imagery MUST be labeled as such wherever a reasonable member could otherwise read it as a real, current depiction of a specific member or as a verified fact. The label MUST be perceivable in the same context as the image and MUST NOT be hidden behind interaction (C-2, C-13; e.g., an honest reading such as "illustrative preview — not a real member").

**IM-35 (No fictional member portrayal)** An image MUST NOT depict, imply, or stage a fictional person as if they were a real, present member, match, testimonial author, or verified individual. Example scenes, mock profiles, and marketing composites MUST be unambiguously distinguishable from real member content (C-2, C-3; IM-11).

**IM-36 (AI-generated imagery labeled)** Imagery produced or materially altered by automated/generative means MUST be labeled as automated per C-12 and MUST NOT be presented as a photograph of a real person or as evidence of a real event. Generated imagery MUST NOT be used to represent a specific member, a verification outcome, or a factual claim (C-2, C-12).

**IM-37 (No fabricated proof)** Imagery MUST NOT be used to manufacture evidence — of verification, of endorsement, of scale, of outcomes, of another member's presence, activity, or interest — that does not truthfully exist (C-2; Tier 3). Screenshots, counts, and depicted results shown as illustration MUST be labeled as illustrative.

**IM-38 (Representative imagery honesty)** Where representative or stock imagery stands in for a category (an event type, a service, a community), it MUST be plainly categorical and MUST NOT be positioned to imply it portrays specific, identifiable members or guaranteed outcomes (C-2, IM-15).

**IM-39 (Preview truthfulness)** A preview image MUST truthfully represent what the member will actually receive or encounter; a preview MUST NOT depict a more favorable, more complete, or more verified state than the real one (C-2, C-13).

**IM-40 (Consent for real-person imagery)** Any image depicting a real, identifiable person MUST be shown only within the consent scope that person granted (C-4, C-6). A member's own photograph MUST NOT be repurposed, reframed, cropped-to-imply, or surfaced beyond the visibility they consented to; consent MUST be explicit, scoped, and revocable, never bundled or pre-checked.

**IM-41 (No covert capture or exposure)** Imagery features MUST NOT enable one person to covertly capture, surveil, or expose another; nor MAY a member's image be presented to parties or in contexts the member did not consent to (C-6). Unknown consent scope resolves to the narrowest exposure (fail-secure).

**IM-42 (Provenance persists)** An image's provenance and consent status MUST travel with it across surfaces, services, caching, sharing, and device handoff; an image MUST NOT lose its "illustrative," "generated," or consent-scope status when relocated (C-2, C-4; SHIG-0016 governs any transition, this spec governs the retained meaning).

**IM-43 (Alteration disclosure)** Where imagery has been materially retouched, composited, or filtered in a way that would change a member's understanding of a fact or a person, that alteration MUST be disclosed; cosmetic platform-uniform rendering that changes no fact need not be (C-2). Fail-secure: if uncertain whether an alteration is material, disclose.

# 5. Non-Inference From Imagery & Avatars

**IM-44 (No character inference)** No system MAY infer, score, rank, filter, order, recommend, or gate people using appearance, complexion, facial features, skin tone, attire, religious markers, regional or linguistic cues, or any avatar/photo-derived attribute as a proxy for character, worth, or trustworthiness (C-3). This is a Tier-4 inviolable prohibited regardless of business value (Tier 9 never over Tier 4).

**IM-45 (Missing photo is not a signal)** The absence of a profile photo or avatar MUST NOT be treated, displayed, or weighted as a signal of lesser trust, seriousness, worth, or authenticity, and MUST NOT lower a member's ranking, visibility, or standing (C-3, C-2; IM-17). A member without a photo MUST be presented with equal dignity.

**IM-46 (Photo not a proxy for verification)** The presence, quality, or attractiveness of a photograph MUST NOT be presented or used as evidence of identity verification, trustworthiness, or truth of any claim; verification status MUST come only from the actual verification signal (C-2). A photo MUST NOT stand in for a verified badge, and a verified badge MUST NOT be inferred from a photo.

**IM-47 (No appearance-based ordering)** Ordering, prominence, or emphasis of people MUST NOT be derived from photo aesthetics, complexion, or appearance. Where imagery affects layout prominence, that prominence MUST have an honest, non-appearance basis, disclosed as such (C-3, C-2; IM-13).

**IM-48 (No emotional or demographic reading)** Imagery and avatars MUST NOT be processed to infer emotion, mood, age, gender, ethnicity, caste, religion, or region for the purpose of judging, targeting, ranking, or differentiating a person's treatment (C-3, C-6). Any automated processing MUST be labeled, consent-bounded, inference-framed, and MUST NOT drive dignity-affecting outcomes (C-12).

**IM-49 (Avatar dignity & neutrality)** System-generated placeholder avatars (for members without a photo) MUST be neutral, plural, and non-stigmatizing; they MUST NOT encode complexion, gender, or community defaults, MUST NOT visually rank below real photos, and MUST NOT be styled to look inferior, suspicious, or incomplete (C-3, C-9; IM-45).

**IM-50 (Non-inference in recommendation surfaces)** Any surface that suggests or matches people MUST derive its basis from honest, member-declared or consented, non-appearance signals; it MUST NOT present appearance as the basis, and MUST honestly frame the basis it does use as a suggestion, not a fact (C-2, C-3, C-12).

# 6. Accessible Names & Alt-Text Discipline

**IM-51 (Alt text for meaningful imagery)** Every meaningful image MUST carry an accessible text alternative that conveys the same information or function the image conveys to sighted members, at equivalent utility (C-8; SHIG-0011). Meaning determined per IM-4.

**IM-52 (Decorative marked as decorative)** Every purely decorative image or icon MUST be programmatically marked so assistive technology can skip it; decorative assets MUST NOT carry misleading descriptive text that implies meaning they do not have (C-8, C-13; IM-16).

**IM-53 (Function over description for controls)** For an image or icon that acts as a control, the accessible name MUST describe its *action or destination*, not its visual appearance (e.g., the member needs "report", not "triangle"); appearance-only names are non-conformant (C-8).

**IM-54 (No meaning locked in pixels)** Text, data, numbers, or critical instructions MUST NOT be presented only as an image of text where a member could need to read, resize, translate, or have it announced; such content MUST be available as real, accessible text (C-8, C-9). Localized scripts and numerals MUST be honored (C-9).

**IM-55 (Equivalent alternative honesty)** A text alternative MUST be truthful and MUST carry the same provenance and status the image carries: an illustrative image's alternative MUST convey it is illustrative; a generated image's alternative MUST convey it is generated (C-2; IM-34/36).

**IM-56 (Complex imagery described)** Imagery that conveys structured or complex information (a chart, a diagram, a multi-part scene bearing meaning) MUST provide an equivalent, structured text description sufficient to obtain the same understanding (C-8). Chart color encoding is governed by SHIG-0017 and the data-visualization system; the requirement here is equivalent non-visual meaning.

**IM-57 (Alt text maintained)** Text alternatives MUST be maintained as the image or its meaning changes; a stale alternative that no longer matches its image is non-conformant (C-8, C-2; IM-20).

**IM-58 (Multi-lingual alternatives)** Accessible names and alternatives MUST be available in the member's active language where the surrounding content is localized, and MUST NOT assume one language or script (C-9).

# 7. Cultural Representation & Plurality

**IM-59 (Plural representation)** The imagery corpus MUST represent India's plurality — across region, language, script, complexion, faith, age, ability, gender, body, and family form — such that no single community is the implied default or aspirational standard (C-9, C-3; IM-15).

**IM-60 (No default community)** No complexion, language, name-form, attire, region, or family structure MAY be positioned as the neutral, premium, or "normal" case against which others read as exceptions. Defaults, first-shown examples, and hero imagery MUST reflect plurality, not a single norm (C-9, C-3).

**IM-61 (No stereotyping or subordination)** Imagery MUST NOT depict any community in stereotyped, subordinate, servile, comedic, or exoticized roles, nor pair communities with imagery that implies a hierarchy of worth (C-3, C-9). Depictions MUST portray people with equal agency and dignity.

**IM-62 (Inclusive iconography)** Icons depicting people, families, relationships, gestures, or attire MUST be inclusive and MUST NOT encode a single gender, complexion, faith, or family form as the default human; where a human icon is generic, it MUST read as neutral and plural (C-9, C-3).

**IM-63 (Locale-appropriate imagery)** Where imagery is localized, it MUST be appropriate and respectful to the locale and MUST NOT transplant one region's symbols, dress, or customs as a stand-in for another; representative imagery MUST NOT misattribute one community's markers to another (C-9, C-2).

**IM-64 (No sacred or sensitive misuse)** Religious, sacred, caste-associated, or culturally sensitive symbols MUST NOT be used decoratively, commercially, or as status/ranking marks in ways that appropriate, trivialize, or offend; when such a symbol is meaningful it MUST be used accurately and respectfully (C-3, C-9, C-14).

# 8. Decoration, Restraint & Meaning Classification

**IM-65 (Meaning classification required)** Every icon and image MUST be classified as *meaningful* or *decorative* per IM-4 before release, and that classification MUST drive its accessibility treatment (IM-51/52) and its justification to exist (IM-16). An unclassified asset is non-conformant (fail-secure: treat as meaningful for accessibility, but disallow if it has no purpose).

**IM-66 (No ornament without purpose)** A visual sign MUST NOT be added solely to fill space, impress, or decorate. Every asset MUST serve at least one of: meaning, orientation, hierarchy, honest brand identity, or accessibility. Assets serving none MUST be removed (C-14).

**IM-67 (Restraint in density)** Surfaces MUST NOT accumulate competing icons, badges, and imagery to the point that hierarchy and meaning blur. Quantity MUST be disciplined so that each meaningful sign remains legible and the most important reads first (C-14, C-10; IM-16).

**IM-68 (No manipulative imagery)** Imagery MUST NOT be used to manufacture urgency, fear, scarcity, envy, or social pressure, nor to manipulate a member toward consent, spend, or engagement against their calm judgment (C-10, C-2, C-4). Emotional imagery MUST be honest and proportionate to the real situation.

**IM-69 (Brand expression within restraint)** Brand-expressive imagery and marks MAY be used to establish identity and warmth per SHIG-0002/0007, provided they remain within restraint (IM-16), never obscure meaningful signs, never mislead (IM-11), and never displace safety or task content (C-5, C-14).

# 9. Image-Absent Degradation & Lifecycle States

**IM-70 (Honest loading state)** While an image is loading, the placeholder MUST honestly indicate a pending state and MUST NOT display a fabricated preview, a false subject, or a state that will differ from what loads (C-13, C-2). Any motion in the loading indicator is governed by SHIG-0016.

**IM-71 (Honest absent/error state)** When an image is unavailable or fails to load, the fallback MUST preserve the meaning, function, and identity the image would have served (e.g., a labeled placeholder avatar, a text alternative, a named state) and MUST NOT collapse meaning or imply the subject is untrustworthy, incomplete, or absent as a person (C-13, C-3; IM-17/45).

**IM-72 (Trust/safety survive absence)** A verification mark, safety control, consent indicator, or other trust/safety signal MUST NOT depend on an accompanying image rendering; if imagery is absent, the trust/safety meaning MUST remain fully present and reachable through text or another channel (C-5, C-8; IM-12).

**IM-73 (Low-bandwidth & degraded devices)** Imagery MUST degrade gracefully on low-bandwidth, low-capability, or data-saving conditions without loss of meaning, safety, or accessibility; meaning MUST NOT be reachable only through heavy imagery (C-9, C-8). India-first device and bandwidth plurality MUST be assumed, never a high-end default.

**IM-74 (Withheld imagery neutral)** Where a member has chosen not to provide or to hide an image (their right per C-7), the presentation MUST be neutral and equal, MUST NOT nag or penalize, and MUST NOT expose the fact of withholding as a negative signal to others (C-3, C-7, C-6; IM-45).

**IM-75 (No layout dependence on image)** Layout, comprehension, and task completion MUST NOT break when an image is absent; the surface MUST remain oriented, legible, and operable image-free (C-8, C-13).

# 10. Avatars

**IM-76 (Avatar identity honesty)** An avatar MUST honestly represent the entity it stands for; it MUST NOT imply a real photograph where none exists, imply verification it lacks, or impersonate another member, brand, or authority (C-2, IM-11/26).

**IM-77 (Placeholder avatar equality)** A generated or initial-based placeholder avatar MUST be presented at equal visual status to a photographic avatar — same size, prominence, and dignity — and MUST NOT be styled as a deficiency (C-3; IM-45/49).

**IM-78 (Avatar consent & privacy)** Avatar visibility MUST follow the member's consented scope; an avatar MUST NOT be exposed to contexts or parties beyond that scope, and MUST be changeable and removable by the member (C-4, C-6, C-7). Unknown scope resolves to the narrowest exposure.

**IM-79 (No avatar-derived inference)** Avatars MUST NOT be processed to infer or rank character, demographic, or worth (IM-44/48), and avatar appearance MUST NOT influence a member's treatment, standing, or ordering (C-3).

**IM-80 (Avatar accessible name)** Every avatar acting as a meaningful sign or control MUST carry an accessible name identifying whom or what it represents and its function, not merely "avatar" or its appearance (C-8; IM-53).

# 11. Multi-Platform Parity

**IM-81 (Platform scope)** In scope: desktop, mobile, tablet, PWA, wearables, voice, AR/VR/XR/spatial, ambient, and print/export surfaces. Every rule in this specification applies to each in-scope surface.

**IM-82 (Meaning parity across platforms)** The *meaning, honesty, provenance, and dignity* rules for a sign MUST NOT diverge across platforms; presentation MAY adapt to each surface's affordances, but a sign MUST NOT mean, imply, or reveal something different on one platform than another (C-15, C-8).

**IM-83 (Non-visual & voice parity)** On voice, ambient, and non-visual surfaces, every meaningful icon or image MUST convey its meaning, and its provenance where relevant, through the available modality with equivalent utility; provenance labels (illustrative/generated) and trust/safety meaning MUST be announced, not dropped (C-8, C-2).

**IM-84 (Export & print honesty)** When imagery is exported, shared, printed, or embedded elsewhere, its provenance and consent status MUST be preserved or, if it cannot be, the image MUST NOT be exported in a way that strips the honest label (C-2, C-4, C-6; IM-42).

**IM-85 (Accessibility parity)** Accessible names, text alternatives, contrast, and target legibility MUST meet WCAG 2.2 AA on every platform; assistive-technology users MUST have full parity of meaning and provenance (C-8, Tier 4). Accessibility MUST NOT be traded for Tier 5/8/9 gains.

# Decision Framework

**IM-86** When choosing between competing iconography or imagery options, teams MUST apply SHIG-0000 Article 4 lexicographically. An option that better serves a lower tier MUST NOT be chosen over one that better serves a higher tier; a lower-tier gain NEVER justifies a higher-tier loss.

**IM-87 (Selection rule)** Among options that violate no higher tier, teams MUST prefer the one that is most honest (Tier 3) and most dignity-preserving and inclusive (Tier 4), then most understandable and accessible (Tier 5 with the Tier-4 accessibility floor intact), then calmest (Tier 6), then most consistent (Tier 7), then most restrained and crafted (Tier 8). Business preference (Tier 9) breaks ties only after all higher tiers are equal.

**IM-88 (Non-negotiables)** The following MUST NOT be traded for any lower-tier benefit: sign honesty and provenance (IM-11/14/34/36, Tier 3); non-inference from appearance and the missing-photo-is-not-a-signal rule (IM-13/44/45, Tier 4); meaning never single-channel and the WCAG 2.2 AA floor (IM-12/85, Tiers 4); safety/consent signs surviving image absence (IM-24/72, Tiers 1–2); consent and privacy of real-person imagery and avatars (IM-40/41/78, Tier 2); plurality and no-default-community (IM-59/60, Tiers 4).

**IM-89 (Deviation record)** Any SHOULD-level deviation MUST record written justification naming the higher tier it serves, per SHIG-0001. MUST-level requirements admit no deviation.

**IM-90 (Decision table)**

| Situation | Competing pull (tiers) | Required resolution | Governing IDs |
|-----------|------------------------|---------------------|---------------|
| Generated hero image looks like a real, present member | Growth/aesthetics (T8–9) vs Honesty (T3) | Label as generated/illustrative or do not present as a member | IM-34, IM-35, IM-36 |
| Ranking members higher when they have a "good" photo | Business/engagement (T9) vs Dignity/non-inference (T4) | Prohibited; photo presence/quality MUST NOT affect standing | IM-44, IM-45, IM-46, IM-47 |
| Members without a photo shown as lower-trust to prompt uploads | Growth (T9) vs Dignity/honesty (T4/T3) | Prohibited; equal dignity; no penalty or exposure of withholding | IM-45, IM-74 |
| Icon-only control saves space on a safety action | Craft/space (T8) vs Safety/accessibility (T1/T4) | Keep a visible label; never icon-only for safety/consent | IM-23, IM-24 |
| Verification checkmark shown while status is unknown | Reassurance (T6/T9) vs Honesty (T3) | Fail-secure to not-verified until truly verified | IM-11, IM-25, IM-26 |
| One community used as default/hero for a "premium" feel | Aesthetics (T8) vs Inclusion (T4) | Represent plurality; no default community | IM-59, IM-60, IM-61 |
| Decorative flourish adds richness but no meaning | Aesthetics (T8) vs Restraint/calm (T6/T8) | Remove unless it serves meaning/orientation/identity | IM-16, IM-66 |
| Emotion/age detection on avatars to personalize | Personalization/business (T9) vs Dignity/privacy (T4/T2) | Prohibited for dignity-affecting outcomes; if any processing, labeled+consented+non-deciding | IM-48, IM-79 |
| Meaning encoded only by an image of text | Design polish (T8) vs Accessibility/plurality (T4/T9-need) | Use real accessible, localizable text | IM-54, IM-58 |
| Image missing on slow network breaks the trust badge | Efficiency (T5) vs Safety/honesty (T1/T3) | Trust/safety meaning survives absence via another channel | IM-72, IM-73, IM-75 |

# Quality Framework (Measurable)

**IM-91** Each attribute below MUST have a defined measurement method and recorded accept/reject threshold per release. Conformance claims MUST be backed by evidence, not opinion (C-17).

| # | Quality attribute | What it measures | Accept | Reject |
|---|-------------------|------------------|--------|--------|
| IM-92 | Sign honesty | Signs match underlying truth/status; fail-secure to less-certain | Zero signs asserting unearned certainty/verification | Any false or unearned trust/verification/endorsement sign |
| IM-93 | Provenance labeling | Illustrative/preview/stock/generated imagery is labeled where it could mislead | 100% of misleading-risk imagery labeled | Any unlabeled misleading-risk or generated-as-real image |
| IM-94 | Non-inference | No appearance/complexion/attribute-derived ranking, ordering, gating, or inference | Zero appearance-based inference or ordering | Any appearance/photo-derived character judgment or ordering |
| IM-95 | Missing-photo neutrality | Photo absence has no effect on trust, ranking, visibility, or dignity | No penalty; equal presentation | Any downgrade or negative exposure for missing/withheld photo |
| IM-96 | Never single-channel | Meaningful icons paired with name/label; no meaning by color/position/motion alone | Full pairing; no single-channel meaning | Any critical meaning carried by one channel |
| IM-97 | Alt-text discipline | Meaningful imagery has truthful, function-accurate, maintained alternatives; decorative marked | Complete, accurate, provenance-carrying alternatives | Missing/stale/appearance-only/misleading alternatives |
| IM-98 | Consistency | One meaning ↔ one sign across surfaces/releases; no drift | Stable, uniform mapping | Any icon meaning drift or split meaning |
| IM-99 | Plurality | Representation spans India's plurality; no default community | Plural corpus; no single norm | Single community as default/aspirational; stereotyping |
| IM-100 | Restraint | Every asset justified; no meaningless ornament; disciplined density | All assets purpose-justified | Decoration-without-meaning; density obscuring hierarchy |
| IM-101 | Graceful absence | Meaning/trust/safety and layout survive image absence and low bandwidth | Full meaning image-free | Meaning/safety/layout broken when image absent |
| IM-102 | Consent & privacy of imagery | Real-person imagery/avatars stay within consented, revocable scope | Scope honored; narrowest-on-unknown | Any exposure beyond consent or covert capture |
| IM-103 | Accessibility parity | WCAG 2.2 AA for icons/imagery across all platforms + AT parity | Full parity | Any AT meaning/provenance/contrast gap |

**IM-104 (Release gate)** A release MUST NOT ship if any Tier 1–4-linked attribute is in Reject: sign honesty (IM-92), provenance labeling (IM-93), non-inference (IM-94), missing-photo neutrality (IM-95), never-single-channel (IM-96), alt-text discipline (IM-97), plurality (IM-99), graceful absence of safety meaning (IM-101), consent/privacy (IM-102), or accessibility parity (IM-103). Tier 5–9 rejects MUST be recorded with a remediation plan per SHIG-0001.

# Governance

**IM-105** This specification is Tier 1–4 in effect and, per SHIG-0000, MAY only be strengthened, never weakened, by future revisions. Requirement IDs are permanent; a superseded rule is marked Deprecated, never reused or renumbered.

**IM-106** Every iconography or imagery change MUST cite the IM IDs it satisfies and record any SHOULD deviation with its higher-tier justification (IM-89).

**IM-107 (Fail-secure)** On any unknown or ambiguous state — unknown provenance, unknown consent scope, unknown verification, unclassified asset — the system MUST resolve to the safer, less-certain, narrower-exposure reading (IM-11/17/25/41/65).

**IM-108** Conformance MUST be evidenced by the §Quality Framework measurements at defined review points; unmeasured surfaces are treated as non-conformant (C-17).

**IM-109** Conflicts between this spec and any implementation guide, asset library, or brand kit resolve in favor of this spec; conflicts with SHIG-0000/0001 resolve in favor of those anchor instruments; color and motion questions defer to SHIG-0017 and SHIG-0016 respectively (IM-9).

**IM-110** New platforms or new automated imagery capabilities entering scope MUST be assessed against §10–11 and the Quality Framework before member exposure.

# Compliance / Review Checklist

- **IM-111** Every meaningful icon has an accessible name; critical-meaning icons carry a visible label; safety/consent controls are never icon-only (IM-22/23/24).
- **IM-112** No meaning is carried by a single channel; color/motion questions deferred to SHIG-0017/0016 but pairing verified here (IM-12/96).
- **IM-113** Every illustrative/preview/stock/composite/generated image is labeled where it could mislead; no fictional person shown as a real member (IM-34/35/36).
- **IM-114** No verification, endorsement, security, or authority sign appears without a real, current basis; unknown status renders as not-verified (IM-25/26/92/107).
- **IM-115** No ranking, ordering, gating, filtering, or recommendation uses appearance, complexion, or any photo/avatar-derived attribute (IM-13/44/47/48/50).
- **IM-116** Missing or withheld photos carry no penalty, no downgrade, and no exposure of the withholding (IM-45/74/95).
- **IM-117** Every meaningful image has a truthful, function-accurate, provenance-carrying, maintained text alternative; decorative assets are marked decorative (IM-51/52/53/55/57).
- **IM-118** No critical text/data is locked inside an image of text; alternatives available in the member's language/script (IM-54/58).
- **IM-119** Imagery corpus is plural; no single community, complexion, or name-form is the default/aspirational norm; no stereotyping or sacred-symbol misuse (IM-59/60/61/64/99).
- **IM-120** Every asset is classified meaningful/decorative and justified to exist; no ornament without purpose; density disciplined (IM-65/66/67/100).
- **IM-121** Loading, absent, error, and low-bandwidth states are honest and preserve meaning, trust, safety, and layout image-free (IM-70/71/72/73/75/101).
- **IM-122** Real-person imagery and avatars stay within explicit, scoped, revocable consent; no covert capture/exposure; unknown scope narrows exposure (IM-40/41/78/102/107).
- **IM-123** Provenance and consent status persist across surfaces, export, print, and device handoff (IM-42/84).
- **IM-124** Placeholder avatars are neutral, plural, equal-status, and non-inferring (IM-49/77/79).
- **IM-125** Meaning/provenance/dignity parity and WCAG 2.2 AA hold across all in-scope platforms including voice/non-visual (IM-82/83/85/103).
- **IM-126** Each Quality-Framework attribute measured with recorded accept/reject; IM-104 gate honored; every change cites satisfied IM IDs (IM-91/104/106).

# Anti-patterns

For each: *why it harms (which C-n/tier) · how to detect · how to prevent.*

- **AP-1 Fictional-member imagery** — Staged or generated people shown as real members/matches/testimonials. Harms honesty and dignity (C-2/C-3, Tier 3–4). Detect: unlabeled imagery a member could read as a real person; generated portraits on profile/match surfaces. Prevent: IM-34/35/36 labeling and prohibition.
- **AP-2 Unearned trust marks** — Checkmarks, shields, locks, seals implying verification/security/endorsement that is not real or not current. Harms honesty/safety (C-2/C-5, Tier 1–3). Detect: trust signs whose backing fact is absent, stale, or unknown. Prevent: IM-11/25/26; fail-secure to not-verified (IM-107).
- **AP-3 Appearance-based ranking** — Ordering, prominence, or gating people by complexion, attractiveness, or photo-derived cues. Harms dignity (C-3, Tier 4). Detect: layout prominence or ranking correlated with appearance; appearance features in ranking logic. Prevent: IM-13/44/47; non-appearance honest basis (IM-50).
- **AP-4 Missing-photo penalty** — Treating no-photo members as lesser, lower-ranked, or exposing the absence as suspicious. Harms dignity/honesty (C-3/C-2, Tier 4). Detect: rank/visibility drop or negative styling for absent/withheld photos. Prevent: IM-45/74; equal-status avatars (IM-49/77).
- **AP-5 Icon-only critical control** — Safety, report, consent, or irreversible action shown as an unlabeled icon. Harms safety/accessibility (C-5/C-8, Tier 1–4). Detect: icon-only controls on critical paths; no visible label, meaning by hover only. Prevent: IM-23/24; visible labels.
- **AP-6 Meaning by one channel** — Status conveyed only by color, position, or motion, or a meaningful icon with no name. Harms accessibility (C-8, Tier 4). Detect: single-channel state; icon-only meaning failing AT. Prevent: IM-12/96; pairing (color→SHIG-0017, motion→SHIG-0016).
- **AP-7 Icon meaning drift** — Same icon meaning different things across surfaces/releases, or two icons for one meaning. Harms consistency/understanding (C-15, Tier 7). Detect: cross-surface icon-meaning audit. Prevent: IM-19/21/29.
- **AP-8 Decoration masquerading as control** — Decorative marks with press/focus affordances, or meaningless ornament added for spectacle. Harms honesty/restraint/calm (C-13/C-14/C-10). Detect: non-actionable assets with interactive styling; assets serving no meaning. Prevent: IM-32/52/65/66.
- **AP-9 Default community** — One complexion, faith, region, language, or family form as the neutral/premium norm; others as exceptions. Harms inclusion/dignity (C-9/C-3, Tier 4). Detect: hero/first-shown/default imagery skewed to one community. Prevent: IM-59/60/61.
- **AP-10 Image of text** — Critical text/data/numbers locked in an image, unreadable/untranslatable by AT. Harms accessibility/plurality (C-8/C-9, Tier 4). Detect: text present only within raster imagery. Prevent: IM-54/58; real accessible text.
- **AP-11 Stale or false alt text** — Alternatives that misdescribe, describe appearance instead of function, omit provenance, or no longer match the image. Harms accessibility/honesty (C-8/C-2). Detect: alt-text audit vs current image and function. Prevent: IM-51/53/55/57.
- **AP-12 Consent-scope leakage** — Member imagery/avatars surfaced beyond consented scope, repurposed, or covertly captured. Harms consent/privacy (C-4/C-6, Tier 2). Detect: images shown to parties/contexts outside granted scope; unknown scope shown broadly. Prevent: IM-40/41/78; narrowest-on-unknown (IM-107).
- **AP-13 Provenance loss on move** — "Illustrative"/"generated"/consent status stripped when an image is cached, shared, exported, or handed to another device. Harms honesty/consent (C-2/C-4). Detect: exported/relocated images lacking their original label. Prevent: IM-42/84.
- **AP-14 Manipulative or alarmist imagery** — Imagery engineering urgency, fear, envy, or pressure toward consent/spend/engagement. Harms calm/honesty/consent (C-10/C-2/C-4, Tier 2/3/6). Detect: emotionally loaded imagery disproportionate to the real situation. Prevent: IM-18/68.
- **AP-15 Fragile image dependence** — Meaning, trust badge, or layout that breaks when an image fails or on low bandwidth. Harms honesty/safety/access (C-13/C-5/C-8). Detect: absent-image and data-saver testing shows lost meaning/broken layout. Prevent: IM-70/71/72/73/75.
- **AP-16 Emotion/demographic reading** — Inferring emotion, age, gender, caste, religion, or region from photos/avatars to target or differentiate treatment. Harms dignity/privacy (C-3/C-6, Tier 4). Detect: image-processing features producing demographic/character labels affecting outcomes. Prevent: IM-48/79; labeled+consented+non-deciding only.

# Open Questions

- **IM-127** Standardized member-comprehension instruments and per-surface numeric thresholds for the Quality Framework require SHIG-wide calibration and are deferred to a measurement annex.
- **IM-128** A canonical provenance-label taxonomy and its cross-service persistence mechanism (IM-42/84) warrant a dedicated provenance specification cross-referenced with SHIG-0000 Tier 2–3.
- **IM-129** Governance for any consented, non-deciding automated image processing (accessibility auto-description, safety moderation) that must stay strictly within IM-48/79 non-inference boundaries needs a dedicated ethical-AI-imagery rule set aligned with C-12.
- **IM-130** Equivalence mapping for icon/imagery provenance and meaning on voice, ambient, and XR surfaces (IM-83) awaits a modality-mapping guide as those surfaces mature.
- **IM-131** A shared, auditable plurality-representation rubric (IM-59/99) — measuring corpus balance without reducing people to attributes — requires cross-functional calibration with dignity safeguards.

# Revision History

| Version | Date | Status | Author | Summary |
|---------|------|--------|--------|---------|
| 1.0.0 | 2026-07-27 | Active | Chief Design Officer, Sambandh | Initial governing specification for the Iconography & Imagery System (icon grammar, imagery honesty & provenance, non-inference, accessible naming, plurality, restraint, graceful absence); requirement IDs IM-1..IM-131. |

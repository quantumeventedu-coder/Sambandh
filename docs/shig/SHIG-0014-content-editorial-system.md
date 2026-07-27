# Specification ID

SHIG-0014

# Specification Name

Content & Editorial System Specification

# Version

1.0.0

# Status

Active

# 1. Purpose & Scope

**CE-1** This specification MUST govern how Sambandh *writes*: the voice, tone, register, and microcopy discipline of every word presented to a member, across every surface, feature, service, platform, and device. It governs *the properties of language and the process that produces and verifies it* — NOT typography, type scale, or visual rendering (SHIG-0018), NOT the term dictionary or canonical vocabulary itself (SHIG-0008), NOT layout, components, code, frameworks, or any literal string.

**CE-2** This specification governs OUTCOMES and RULES, not implementation. It states what copy MUST mean, disclose, and never assert; it MUST NOT prescribe particular sentences, widgets, content-management tooling, or markup. A literal string is conformant or not by whether it satisfies these rules, never by matching an example.

**CE-3** Editorial conformance is a floor, not a finish: copy that is grammatical, brand-pleasant, and on-scale but that misstates certainty (C-2), infers character (C-3), obstructs consent or safety (C-4/C-5), or misreports system state (C-13) is non-conformant regardless of craft.

**CE-4** At every surface a member MUST be able to answer from the words alone: (a) what is this, (b) is this a fact or a reading, (c) what is being asked of me and why, (d) with whom is anything shared, (e) what happens if I proceed, (f) how do I undo or withdraw, (g) where do I get help. Copy that leaves any of (a)–(g) unanswerable is non-conformant.

**CE-5** Where this specification and any content style guide, template library, or implementation aid conflict, this specification governs. Where this specification and SHIG-0000/0001/0008 conflict, those higher/anchor instruments govern.

## 1.1 Cross-Instrument Relationships

**CE-6** This specification MUST comply with SHIG-0000 (Constitution, Article 4 lexicographic hierarchy T1–T9; principles C-1..C-17) and MUST NOT contradict it. Constitutional philosophy MUST be referenced by ID, not restated.

**CE-7** This specification MUST follow SHIG-0001 rule grammar: RFC-2119 keywords carry their defined force; every normative statement bears a permanent CE-n ID; SHOULD-level deviations require a recorded higher-tier justification; MUST-level requirements admit no deviation.

**CE-8** This specification MUST consume the canonical terminology, definitions, and reading-forbidden/reading-required word lists established by SHIG-0008. It MUST NOT redefine, extend, or contradict that vocabulary; where copy needs a term SHIG-0008 lacks, SHIG-0008 MUST be amended first (deviation recorded per SHIG-0001). This specification governs *how words are chosen, sequenced, and verified*; SHIG-0008 owns *which word is canonical*.

**CE-9** This specification MUST NOT govern visual type, type scale, weight, or rendered character forms (SHIG-0018), nor information structure (SHIG-0005), nor interaction mechanics (SHIG-0012); it governs the *language* those instruments present. Where a rule here implies a visual treatment (e.g., that a reading be distinguishable from a fact), the *distinction* is required here and its *rendering* is delegated to the visual specs, subject to the never-single-channel floor (C-8).

**CE-10** Emotional register requirements here MUST align with SHIG-0009 (emotional design) and the calm mandate (C-10); accessibility of language (reading level, plain-language, never-single-channel meaning) MUST align with SHIG-0011 and the accessibility conformance level SHIG-0011 adopts. This specification adds the *linguistic* obligations those instruments assume.

## 1.2 Editorial as Five Duties

**CE-11** Every unit of copy MUST serve, in order of precedence when they conflict: **Honesty** (the words claim no more certainty than exists) ▸ **Safety & consent clarity** (the words make risk, ask, and withdrawal plain) ▸ **Dignity** (the words infer nothing about a person's worth) ▸ **Understanding** (the words are comprehensible to the intended reader) ▸ **Calm & craft** (the words neither pressure nor ornament). Conflicts among these resolve by SHIG-0000 Article 4, not by this local order alone.

# 2. Voice & Editorial Principles

Each principle below is a normative requirement bearing its own ID. "Copy" means any member-facing language — labels, body, buttons, errors, notifications, help, legal, voice prompts, alt text, and machine-generated text surfaced to a member.

**CE-12 (One voice)** Sambandh MUST present a single, recognizable editorial voice across every surface and service, so a member perceives one author, not many. Voice is the constant; tone (CE-30) modulates by context. Divergent, per-feature voices are non-conformant (Tier 7 consistency).

**CE-13 (Voice attributes)** The voice MUST be *honest, plain, respectful, and calm*: it states what is true and only what is true, in the fewest clear words, addressing the member as a capable adult, without pressure or flourish. Any copy that reads as hype, coercion, flattery, or condescension is non-conformant (C-10, C-14, C-3).

**CE-14 (Register)** Copy MUST use a register appropriate to the surface's stakes: neutral-to-warm for ordinary tasks, precise-and-sober for safety, consent, money, and irreversible actions (CE-30). Register MUST NOT rise to marketing enthusiasm on any decision or safety surface.

**CE-15 (Restraint)** Copy MUST express premium quality through precision and economy, never through ornament, superlatives, or volume of words (C-14). Where a shorter true sentence exists, it MUST be preferred (Tier 8 craft), provided brevity does not remove a required disclosure (Tiers 1–3 over Tier 8).

**CE-16 (Address & honorifics)** Copy MUST address members respectfully in a form appropriate to the member's language and cultural norms, India-first, and MUST support honorific and name-form plurality (CE-52). Copy MUST NOT impose a single Western name-form, familiarity level, or gendered assumption (C-9, C-3).

**CE-17 (Plain language floor)** Copy MUST be written in plain language: common words over rare, concrete over abstract, active over passive where it aids clarity, and one idea per sentence on decision and safety surfaces. Jargon, internal terminology, and legalese MUST NOT appear on member surfaces except where a defined term (SHIG-0008) is itself the plainest accurate word, and then it MUST be glossable.

**CE-18 (No dark-pattern language)** Copy MUST NOT use confirm-shaming, false scarcity, manufactured urgency, guilt, or loaded defaults in wording (C-10, C-4). Decline, cancel, and withdraw options MUST be worded as neutrally and plainly as accept options; the negative choice MUST NOT be worded to shame or alarm.

# 3. Honesty-in-Language (Signal Integrity)

**CE-19 (Fact vs reading — core rule)** Copy MUST distinguish, in the words themselves, an established, verified fact from an inference, prediction, reading, estimate, or unverified claim. An inference MUST be worded as an inference — a reading, an insight, a suggestion — and MUST NOT be worded as a verified fact or an established truth (C-2). This is a Tier 3 obligation and MUST NOT be traded for brevity, warmth, or persuasion.

**CE-20 (Certainty honesty)** Copy MUST NOT imply a certainty it does not possess. Absolute or guaranteeing language (definitive, certain, guaranteed, will) MUST NOT be attached to any probabilistic, predicted, or model-derived statement; such statements MUST use honestly hedged wording proportional to actual confidence (C-2, C-17).

**CE-21 (Verified-status language)** The word *verified* and its equivalents MUST be applied only to states that are actually verified by Sambandh's defined process, and MUST name what was verified. Copy MUST NOT let "verified" bleed onto adjacent unverified attributes (e.g., a verified identity MUST NOT read as a verified character or intention). Unknown or ambiguous verification state MUST be worded as *unverified* (fail-secure).

**CE-22 (Source & basis honesty)** When copy presents a reading, recommendation, score, or match cue, it MUST state, in plain words, the honest basis for it, and MUST NOT imply a basis it lacks. It MUST NOT dress a correlation as a cause or a heuristic as a judgment (C-2, C-17).

**CE-23 (Machine-generated labeling)** Any copy generated, summarized, translated, or drafted by an automated system and surfaced to a member MUST be labeled as automated in plain language, MUST be framed as assistance not authority, and MUST be framed as an inference where it is one (C-12). Automated copy is subject to every honesty rule in this section; it MUST NOT assert certainty a human author would be forbidden to assert.

**CE-24 (No fabricated specifics)** Copy MUST NOT invent quantities, timestamps, names, counts, or attributions to appear precise. Every specific claim MUST be traceable to a true source; where a value is unknown, copy MUST say so honestly rather than fabricate (C-2, C-13).

**CE-25 (Honest omission)** Copy MUST NOT create a false impression by omission. Where withholding a fact would leave the member with a materially wrong understanding of certainty, cost, sharing, or risk, the fact MUST be stated (C-2, C-4).

# 4. Non-Inference in Language (Dignity)

**CE-26 (Non-inference — core rule)** Copy MUST NOT describe, rank, imply, or invite inference of a person's character, worth, morality, desirability, or trustworthiness from appearance, complexion, caste, religion, region, language, name, or any protected or proxy attribute (C-3). This is a Tier 4 obligation and is prohibited regardless of any lower-tier benefit (Tier 9 never over Tier 4).

**CE-27 (No proxy language)** Copy MUST NOT use coded, euphemistic, or proxy wording that signals a protected attribute or a character judgment derived from one (e.g., complexion-as-quality, region-as-caste-signal, community-as-worth). Detection of such proxy language is a conformance failure even absent explicit terms.

**CE-28 (Descriptive, not evaluative, of persons)** Where copy must describe a person or profile, it MUST use member-authored, factual, self-declared attributes only, worded descriptively, and MUST NOT append system-authored evaluative adjectives of worth or desirability. Copy MUST NOT rank persons by any inferred trait (C-3, C-11 relationship-first not metric-first).

**CE-29 (Dignity in all states)** Error, empty, rejection, and moderation copy MUST preserve the dignity of every person named or addressed. Copy MUST NOT blame, shame, or diminish a member for a system limitation, a failed verification, or another party's action (C-3, C-13). Language about a member MUST be one a member could read about themselves without indignity.

# 5. Tone Modulation by Surface Class

**CE-30 (Tone follows stakes)** Tone MUST modulate by surface class while voice stays constant (CE-12). The higher the stakes to safety, consent, money, dignity, or irreversibility, the calmer, plainer, and more sober the tone MUST be (C-10). Playfulness, enthusiasm, and persuasion MUST decrease as stakes rise; on the highest-stakes surfaces they MUST be absent.

**CE-31 (Surface-class register table)** Each surface class below MUST meet its row. Columns: **Register**, **Tone constraints**, **Forbidden moves**, **Governing IDs**. All rows inherit CE-4 (the seven answerables) and CE-13/CE-19/CE-26.

| # | Surface class | Register | Tone constraints | Forbidden moves | Governing IDs |
|---|---------------|----------|------------------|-----------------|---------------|
| CE-32 | Safety, reporting, blocking, crisis | Precise, sober, unhurried | Calm, direct, action-first; never alarmist, never minimizing | Urgency, jargon, euphemism, upsell | C-5, C-10; CE-14, CE-19 |
| CE-33 | Consent & privacy | Plain, explicit, neutral | State what/why/with-whom/withdraw; balanced choices | Pre-checked framing, confirm-shaming, bundling language | C-4, C-6; CE-18, CE-41 |
| CE-34 | Money, payments, irreversible actions | Precise, sober | State amount, currency, finality; confirm intent in words | Hidden cost, false discount urgency, guilt | C-2, C-10; CE-14, CE-42 |
| CE-35 | Verification & trust | Precise, honest | Name what is/ isn't verified; fail-secure wording | "Verified" bleed, implied certainty | C-1, C-2; CE-21 |
| CE-36 | People, compatibility, relationship | Warm, respectful, restrained | Reading-framed, non-inferred, member-first | Character inference, ranking language, worth adjectives | C-3, C-11; CE-19, CE-26 |
| CE-37 | Everyday tasks & navigation | Neutral-to-warm | Clear, concise, recognition-friendly | Cuteness that obscures function | C-15; CE-13, CE-17 |
| CE-38 | Errors, empty, loading, success | Honest, calm, helpful | Say what happened, why, what next | Blame, false success, dead-end wording | C-13; CE-43–CE-47 |
| CE-39 | Onboarding & education | Warm, encouraging, honest | Set true expectations of steps/effort | Overpromise, hype, coercive momentum | C-10; CE-13, CE-25 |
| CE-40 | Marketing & growth surfaces | Warm, honest, restrained | Truthful benefit claims only; still bound by C-2 | Superlative inflation, fabricated proof, urgency | C-2, C-10; CE-15, CE-24 |

# 6. Consent & Safety Copy (Load-Bearing)

**CE-41 (Consent copy is load-bearing)** Consent copy MUST state, in plain language a non-expert can act on, **what** is being asked, **why** it is needed, **with whom** anything is shared, and **how to withdraw**. All four MUST be present before consent is given; a missing element makes the consent non-conformant and the consent invalid (C-4). Consent copy MUST NOT be pre-checked in wording, bundled with unrelated asks, or phrased to make declining feel wrong (C-4, CE-18).

**CE-42 (Irreversibility & cost disclosure)** Before any irreversible or charged action, copy MUST state its finality, its full cost in the member's stated currency, and its effect in plain words, and MUST require explicit intent worded unambiguously. Copy MUST NOT rely on the member inferring finality; it MUST say it (C-7, C-2).

**CE-43 (Safety copy reachability & clarity)** Copy that supports safety — reporting, blocking, crisis help, withdrawal — MUST be plain, action-first, and free of jargon, euphemism, and delay, and MUST be present and legible wherever the risk exists (C-5). Safety copy MUST NOT be softened to protect brand tone; clarity outranks warmth here (Tier 1 over Tiers 6/8).

**CE-44 (Withdrawal parity)** Copy describing how to withdraw consent, cancel, leave, or delete MUST be as clear, findable, and plainly worded as the copy that invited the member in. Asymmetry that makes exit harder to understand than entry is non-conformant (C-4, C-7).

# 7. Truthful State Copy (Error / Empty / Loading / Success)

**CE-45 (Error copy)** Error copy MUST state honestly what happened, why where knowable, and at least one forward action and one way to get help or return. It MUST NOT blame the member for a system fault, MUST NOT expose internal or frightening technical detail, and MUST NOT pretend an error is a success (C-13). Where cause is unknown, copy MUST say so honestly rather than guess.

**CE-46 (Empty-state copy)** Empty-state copy MUST truthfully explain why nothing is shown and offer an honest next step. It MUST NOT imply content exists that does not, nor shame the member for an empty state (C-13).

**CE-47 (Loading & progress copy)** Loading and progress copy MUST be honest about waiting and uncertainty; it MUST NOT display fake progress, fabricated time estimates, or reassurances the system cannot back (C-2, C-13). Where duration is unknown, copy MUST say it is working, not invent a countdown.

**CE-48 (Success copy)** Success copy MUST confirm only what actually completed, MUST NOT overstate the outcome, and MUST NOT manufacture celebratory pressure to continue (C-13, C-10). A partial success MUST be worded as partial, naming what remains.

# 8. Reading Level, Plain Language & Terminology

**CE-49 (Reading level)** Copy MUST target a plain reading level appropriate to a broad adult audience, and MUST be more conservative (simpler, shorter sentences, common words) as surface stakes rise (CE-30). Decision, consent, safety, and money copy MUST meet the strictest reading-level target defined for the release. Reading level MUST be measured, not assumed (C-17).

**CE-50 (Terminology consistency)** Copy MUST use the canonical term from SHIG-0008 for every concept that has one, identically across all surfaces and releases. Synonyms, drifting labels, or feature-local coinages for a concept that already has a canonical term are non-conformant (Tier 7; CE-8). Where no canonical term exists, one MUST be proposed to SHIG-0008 rather than invented locally.

**CE-51 (Glossability & first-use)** Any defined or specialized term surfaced to members MUST be glossable — its plain meaning reachable at or near first use — and MUST NOT assume prior knowledge on safety, consent, or money surfaces (C-9, CE-17).

# 9. Localization, Plurality & India-First

**CE-52 (India-first plurality)** Copy MUST NOT assume a single language, script, numeral system, name-form, honorific, date/number/currency format, reading direction, or literacy level (C-9). The editorial system MUST be authored so that every surface can be expressed in a member's language and script without loss of meaning, disclosure, or dignity.

**CE-53 (Translation fidelity)** Translated and localized copy MUST preserve every honesty (§3), non-inference (§4), consent, and safety (§6) property of the source; a translation that weakens a disclosure, hardens a hedge into a certainty, or introduces a character inference is non-conformant. Localization is meaning-preservation, not literal substitution (C-2, C-3, C-4).

**CE-54 (Honorific & name-form correctness)** Copy MUST render honorifics, name order, and forms of address correctly for the member's culture and stated preference, and MUST NOT truncate, transliterate lossily, or reformat a name in a way that disrespects it (C-3, C-9).

**CE-55 (Numeral, date & currency plurality)** Copy MUST present numbers, dates, and currency in forms a member's locale reads correctly, and money copy MUST state currency unambiguously (CE-34). Copy MUST NOT let a locale format change the *meaning* of a cost or a finality (C-9, C-2).

**CE-56 (Non-visual & voice parity)** Copy delivered by voice, screen reader, or other non-visual modality MUST carry the same meaning, disclosures, and reading-vs-fact distinction as the visual copy, never relying on visual formatting alone to convey a required distinction (C-8 never single-channel; CE-9). Alt text and spoken prompts MUST meet every honesty and dignity rule in this specification.

# 10. Editorial Production & Verification Process

**CE-57 (Definition of done for copy)** No copy MAY ship until it is verified against: the seven answerables (CE-4); fact-vs-reading (CE-19); non-inference (CE-26); consent/safety completeness where applicable (§6); truthful-state rules where applicable (§7); canonical terminology (CE-50); reading level (CE-49); and localization/plurality fidelity (§9). Unverified copy is treated as non-conformant (fail-secure; C-17).

**CE-58 (Source of truth)** Every member-facing claim MUST trace to a true system state or a member-authored source. Copy MUST NOT assert a state the system cannot confirm; on unknown or ambiguous state, copy MUST resolve to the honest, more-conservative wording (fail-secure).

**CE-59 (Machine-generated copy review)** Automated or AI-drafted copy MUST pass the same verification (CE-57) before member exposure, MUST be labeled (CE-23), and MUST NOT be exempted from honesty or non-inference rules because a machine produced it. Ambiguous automation provenance MUST resolve to *labeled as automated* (fail-secure; C-12).

**CE-60 (Change traceability)** Every copy change MUST cite the CE IDs it satisfies and record any SHOULD-level deviation with its higher-tier justification (SHIG-0001). Copy changed on safety, consent, money, or verification surfaces MUST be re-verified in full, not spot-edited.

**CE-61 (Evidence over opinion)** Conformance claims — reading level, comprehension, honesty of framing, absence of inference — MUST be backed by measurement or review evidence, not authorial confidence (C-17). Unmeasured high-stakes copy is non-conformant.

# 11. Decision Framework

**CE-62** When editorial options compete, teams MUST apply SHIG-0000 Article 4 lexicographically. Copy that better serves a lower tier MUST NOT be chosen over copy that better serves a higher tier; a lower-tier gain NEVER justifies a higher-tier loss.

**CE-63 (Selection rule)** Among wordings that violate no higher tier, teams MUST prefer the one that is *most honest and clearest to the intended reader* (Tiers 3, 5), then the most dignity-preserving and calmest (Tiers 4, 6), then the most consistent with canonical terminology (Tier 7), then the most restrained and crafted (Tier 8). Business or growth preference (Tier 9) breaks ties only after all higher tiers are equal.

**CE-64 (Non-negotiable editorial rules)** The following MUST NOT be traded for any lower-tier benefit: fact-vs-reading and certainty honesty (CE-19/CE-20, Tier 3); non-inference of character (CE-26/CE-27, Tier 4); consent completeness and safety-copy clarity (CE-41/CE-43, Tiers 1–2); truthful state copy (§7, C-13); withdrawal parity (CE-44, Tier 2); localization fidelity of disclosures (CE-53, Tiers 2–4); never-single-channel meaning (CE-56, Tier 4/C-8).

**CE-65 (Deviation record)** Any SHOULD-level editorial deviation MUST record a written justification naming the higher tier it serves, per SHIG-0001. MUST-level requirements admit no deviation.

**CE-66 (Decision table)**

| Situation | Competing pull (tiers) | Required resolution | Governing IDs |
|-----------|------------------------|---------------------|---------------|
| Warmer wording softens a risk disclosure | Emotional/craft (T6/T8) vs Safety (T1) | Keep the plain, sober disclosure | CE-32, CE-43, CE-64 |
| Persuasive phrasing lifts conversion but implies certainty | Business (T9) vs Honesty (T3) | Reword to honest hedge | CE-19, CE-20, CE-40 |
| Flattering profile adjective boosts engagement | Business (T9) vs Dignity (T4) | Prohibited; describe, don't evaluate | CE-26, CE-28 |
| Shorter copy drops a "with-whom" from consent | Craft/brevity (T8) vs Consent (T2) | Keep all four consent elements | CE-15, CE-41, CE-64 |
| A localized string reads more fluent by dropping a hedge | Craft (T8) vs Honesty (T3) | Preserve the hedge; fluency second | CE-53, CE-64 |
| "Verified" reused for an unverified adjacent trait | Consistency/appeal (T7/T9) vs Honesty (T3) | Restrict "verified" to what is verified | CE-21, CE-35 |
| Loading copy shows a made-up time to feel faster | Emotional (T6) vs Honesty (T3/C-13) | State working; no fake countdown | CE-47 |
| Feature coins a new label for an existing concept | Novelty (T8) vs Consistency (T7) | Use canonical term; amend 0008 if truly new | CE-8, CE-50 |

# 12. Quality Framework (Measurable)

**CE-67** Each attribute below MUST have a defined measurement method and a recorded accept/reject threshold per release. Claims of conformance MUST be backed by measurement (C-17).

| # | Quality attribute | What it measures | Accept | Reject |
|---|-------------------|------------------|--------|--------|
| CE-68 | Fact-vs-reading integrity | Inference/prediction copy is worded as such, not as fact | Zero readings presented as verified facts | Any inference worded as established fact (CE-19) |
| CE-69 | Certainty honesty | Hedging matches actual confidence | No unbacked certainty language | Any guarantee on a probabilistic claim (CE-20) |
| CE-70 | Non-inference | No character/worth inference from protected/proxy attributes | Zero inference or proxy wording | Any inference or proxy language (CE-26/27) |
| CE-71 | Consent completeness | Presence of what/why/with-whom/withdraw | All four present and plain | Any element missing or coercively framed (CE-41) |
| CE-72 | Safety-copy clarity | Plain, action-first, reachable safety language | Meets clarity + reachability targets | Jargon, euphemism, or delay in safety copy (CE-43) |
| CE-73 | Truthful state copy | Honesty of error/empty/loading/success | All states honest and non-blaming | Any false success, fake progress, or blame (§7) |
| CE-74 | Reading level | Measured against per-surface target | Meets strictest applicable target | Above target on decision/safety/money copy (CE-49) |
| CE-75 | Terminology consistency | Canonical term used identically everywhere | Zero uncanonical synonyms for a defined concept | Any drift/local coinage (CE-50) |
| CE-76 | Dignity of address | Copy about a member is indignity-free | Passes read-about-self test | Any blaming/shaming/diminishing wording (CE-29) |
| CE-77 | Localization fidelity | Disclosures/hedges/dignity preserved in translation | Full property preservation | Any weakened disclosure or added inference (CE-53) |
| CE-78 | Honorific/name correctness | Correct address, name-form, honorific | Correct for member's stated preference | Any lossy/disrespectful name handling (CE-54) |
| CE-79 | Non-visual parity | Voice/AT copy carries equal meaning | Full parity, no single-channel meaning | Any required distinction visual-only (CE-56) |
| CE-80 | Machine-copy labeling | Automated copy labeled + inference-framed | All automated copy labeled | Any unlabeled or over-certain automated copy (CE-23/59) |

**CE-81 (Gate)** A release MUST NOT ship if any Tier 1–4-linked attribute is in Reject: CE-68/69 (honesty), CE-70/76 (dignity), CE-71/72 (consent/safety), CE-73 (truthful state where safety/consent-adjacent), CE-77 (localization of disclosures), CE-79 (non-visual parity), CE-80 (automation labeling). Tier 5–9 rejects MUST be recorded with a remediation plan (SHIG-0001).

# 13. Governance

**CE-82** This specification is Tier 1–4 in effect and, per SHIG-0000, MAY only be strengthened, never weakened, by future revisions. Requirement IDs are permanent; a superseded rule is marked Deprecated, never reused or renumbered.

**CE-83** Every content change MUST cite the CE IDs it satisfies and record any SHOULD deviation with its higher-tier justification (CE-60/CE-65).

**CE-84** Conformance MUST be evidenced by the §12 measurements at defined review points; unmeasured surfaces are treated as non-conformant (fail-secure; C-17).

**CE-85** On unknown, ambiguous, or unverifiable state, copy MUST resolve to the honest, more-conservative wording (fail-secure): *unverified* over verified, *inference* over fact, *automated* over human, disclosure present over omitted.

**CE-86** Conflicts between this spec and any style guide or implementation aid resolve in favor of this spec; conflicts between this spec and SHIG-0000/0001/0008 resolve in favor of those higher/anchor instruments.

# Compliance / Review Checklist

- **CE-87** All seven answerables (CE-4) verifiable from the words alone on every reviewed surface, including modals, errors, and empty states.
- **CE-88** Every inference, prediction, reading, or estimate is worded as such; no reading presented as a verified fact; no unbacked certainty (CE-19/CE-20).
- **CE-89** "Verified" and equivalents scoped to what is actually verified; unknown state worded as unverified (CE-21/CE-85).
- **CE-90** No copy infers, ranks, or implies character/worth from appearance, complexion, caste, religion, region, language, or name; no proxy wording (CE-26/CE-27).
- **CE-91** Consent copy states what/why/with-whom/how-to-withdraw, unbundled and un-shamed; withdrawal parity holds (CE-41/CE-44).
- **CE-92** Irreversible/charged actions disclose finality, full cost, currency, and require explicit worded intent (CE-42).
- **CE-93** Safety copy is plain, action-first, jargon-free, and reachable wherever risk exists (CE-43).
- **CE-94** Error/empty/loading/success copy is honest, non-blaming, no fake progress, no false success (§7).
- **CE-95** Canonical SHIG-0008 terminology used identically; no local synonyms or coinages for defined concepts (CE-50).
- **CE-96** Reading level measured and within the strictest applicable target for the surface (CE-49).
- **CE-97** Localization preserves every honesty, non-inference, consent, and safety property; honorifics and name-forms correct (CE-53/CE-54).
- **CE-98** Non-visual/voice copy carries equal meaning; no required distinction is visual-only (CE-56).
- **CE-99** Automated/AI copy labeled, inference-framed, and verified like human copy (CE-23/CE-59).
- **CE-100** Each §12 attribute measured with recorded accept/reject; CE-81 gate honored.
- **CE-101** Every change cites satisfied CE IDs; SHOULD deviations carry higher-tier justification (CE-83).

# Anti-patterns

For each: *why it harms · how to detect · how to prevent.*

- **AP-1 Inference-as-fact** — A reading or prediction worded as an established truth. Harms honesty (C-2, Tier 3). Detect: certainty language on model-/heuristic-derived claims; absence of a reading frame. Prevent: CE-19/CE-20 fact-vs-reading and hedging.
- **AP-2 Verified-bleed** — "Verified" attached to an adjacent unverified attribute. Harms honesty/trust (C-1, C-2). Detect: "verified" without a named object; verified-identity read as verified-character. Prevent: CE-21/CE-35 scoping.
- **AP-3 Character inference in copy** — Wording implies worth from appearance/caste/religion/region/language/name. Harms dignity (C-3, Tier 4). Detect: evaluative person-adjectives; proxy euphemisms. Prevent: CE-26/CE-27/CE-28.
- **AP-4 Dark-pattern wording** — Confirm-shaming, false urgency, guilt, loaded defaults. Harms consent/calm (C-4, C-10). Detect: unbalanced accept-vs-decline phrasing; urgency without true deadline. Prevent: CE-18/CE-33.
- **AP-5 Incomplete consent copy** — Missing what/why/with-whom/withdraw. Harms consent (C-4, Tier 2). Detect: consent string lacking any of the four; bundled asks. Prevent: CE-41; block ship on missing element.
- **AP-6 Softened safety copy** — Euphemism or brand-warmth blurring a risk or safety action. Harms safety (C-5, Tier 1). Detect: euphemism/jargon on report/block/crisis surfaces. Prevent: CE-43; clarity outranks warmth.
- **AP-7 Dishonest state copy** — False success, fake progress, blame, or "content exists" illusions. Harms honesty (C-13). Detect: progress with no backing signal; success on partial completion; error blaming member. Prevent: §7 (CE-45–CE-48).
- **AP-8 Hidden cost / silent finality** — Irreversibility or cost left to inference. Harms honesty/agency (C-2, C-7). Detect: charged/irreversible action without worded finality + full cost. Prevent: CE-42.
- **AP-9 Terminology drift** — Multiple labels for one concept, or local coinages. Harms consistency (Tier 7). Detect: cross-surface term audit vs SHIG-0008. Prevent: CE-50; amend 0008 for genuinely new concepts.
- **AP-10 Jargon & legalese on member surfaces** — Internal/legal wording where plain language belongs. Harms understanding/inclusion (C-9, Tier 5). Detect: reading-level failures; unglossed terms. Prevent: CE-17/CE-49/CE-51.
- **AP-11 Lossy localization** — Translation drops a hedge, hardens a certainty, or adds an inference. Harms honesty/consent/dignity (C-2/C-4/C-3). Detect: property diff between source and localized copy. Prevent: CE-53; meaning-preservation review.
- **AP-12 Name/honorific disrespect** — Truncated, mis-ordered, or lossily transliterated names/honorifics. Harms dignity/inclusion (C-3, C-9). Detect: name-form audit against member preference. Prevent: CE-54.
- **AP-13 Single-channel meaning in copy** — A required fact-vs-reading or state distinction carried only visually. Harms accessibility (C-8, Tier 4). Detect: voice/AT rendering loses the distinction. Prevent: CE-56/CE-79.
- **AP-14 Unlabeled machine copy** — Automated/AI text surfaced as if human-authored or as authority. Harms ethical-AI/honesty (C-12, C-2). Detect: generated copy without automation label or inference frame. Prevent: CE-23/CE-59; fail-secure to labeled.
- **AP-15 Hype register on decision surfaces** — Marketing enthusiasm on safety/consent/money copy. Harms calm/honesty (C-10, C-2). Detect: superlatives or urgency on high-stakes surfaces. Prevent: CE-14/CE-30/CE-40.

# Open Questions

- **CE-102** Standard measurement instruments and per-surface numeric thresholds for §12 attributes (reading level, comprehension, inference detection) require SHIG-wide calibration and are deferred to a measurement annex.
- **CE-103** A shared proxy-language lexicon (region/caste/complexion euphemisms to flag under CE-27) needs joint authorship with SHIG-0008 and periodic revision as usage evolves.
- **CE-104** Automated inference-vs-fact and non-inference linting of copy at authoring time (CE-19/CE-26) awaits a tooling-independent detection ruleset cross-referenced with SHIG-0008.
- **CE-105** Localization fidelity verification (CE-53) across many Indian languages and scripts needs a per-language reviewer-competency and back-translation protocol.
- **CE-106** Register calibration for emerging surface classes (voice-first, ambient, conversational agents) needs extension of the §5 surface-class table as those surfaces mature.

# Revision History

| Version | Date | Status | Author | Summary |
|---------|------|--------|--------|---------|
| 1.0.0 | 2026-07-27 | Active | Chief Design Officer, Sambandh | Initial governing specification for the Content & Editorial System; requirement IDs CE-1..CE-106. |

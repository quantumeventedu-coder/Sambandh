# Specification ID

SHIG-0016

# Specification Name

Motion & Choreography System Specification

# Version

1.0.0

# Status

Active

# 1. Purpose & Scope

**MC-1** This specification MUST govern the *purpose, meaning, and constraints* of motion across every Sambandh surface, feature, service, platform, and device — what animation is ALLOWED to mean, how it must preserve orientation and continuity, how it is choreographed, and the limits it MUST NOT cross. It governs OUTCOMES, PROPERTIES, and RULES of motion — NOT code, animation libraries, frameworks, components, easing curves, literal durations, frame rates, or numeric values (those are implementation and belong to downstream specs, which MUST NOT contradict this one).

**MC-2** In this specification, **motion** means any perceivable, time-based change in the state of a surface — position, size, opacity, order, reveal, dismissal, progression, transformation, or emphasis — regardless of modality (visual, haptic, spatial, or auditory transition). A change that a member can perceive unfolding over time is motion and is in scope.

**MC-3** Motion is a **communication instrument, not decoration**. Every instance of motion MUST serve a stated communicative purpose drawn from the permitted meanings in §3. Motion that serves no permitted purpose is non-conformant and MUST be removed (C-14 premium-through-restraint).

**MC-4** Motion MUST be treated as **subordinate and additive**: the surface, its meaning, and every task MUST be fully understandable and completable with all motion removed. Motion MUST NOT be the sole carrier of any meaning, state, instruction, or affordance, and MUST NOT be required to understand or complete any task (C-8; see §7).

**MC-5** This specification MUST comply with SHIG-0000 (Constitution, Article 4 lexicographic hierarchy; principles C-1..C-17) and follow SHIG-0001 rule grammar. Philosophy stated in SHIG-0000 and anchor instruments MUST be referenced by ID, not restated. On any unknown, ambiguous, or unmeasured motion state, the system MUST resolve to the calmer, less-animated, more-static outcome (fail-secure).

**MC-6** Motion serves, in order of precedence when its uses conflict: **Orientation** (member keeps their bearings through change) ▸ **Continuity** (member relates the new state to the prior one) ▸ **Feedback** (member perceives that an action registered) ▸ **Focus** (member's attention is guided honestly) ▸ **Character** (the product feels calm and crafted). Conflicts among these resolve by SHIG-0000 Article 4, not by this local order alone.

## 1.1 Cross-Instrument Relationships

**MC-7** This specification MUST comply with **SHIG-0000** (Constitution): Article 4 tiers govern every trade-off, and motion rules herein operationalize — without restating — C-2 (honesty of signal), C-3 (non-inference of character), C-8 (accessibility floor; meaning never single-channel), C-4 (consent), C-5 (safety reachable), C-10 (calm over stimulation), C-13 (honest states), C-14 (premium through restraint), C-9 (India-first plurality), and C-15 (consistency over novelty).

**MC-8** This specification MUST follow **SHIG-0001** rule grammar: RFC-2119 keywords, permanent sequential IDs, recorded justification for SHOULD-level deviations, and no deviation from MUST-level rules.

**MC-9** This specification governs motion PURPOSE and constraints only. It MUST NOT duplicate **SHIG-0012 Interaction Design System** (interaction mechanics — how actions are initiated, acknowledged, progressed, reversed) nor **SHIG-0015 Layout & Spatial System** (spatial structure and composition). Where motion expresses an interaction's feedback or a layout's change, this spec governs *what the motion may mean and its limits*; SHIG-0012 governs the interaction behavior and SHIG-0015 governs the spatial arrangement. Conflicts resolve in favor of the higher-tier obligation, recorded per SHIG-0001.

**MC-10** Motion MUST respect the accessibility floor set by **SHIG-0011 Accessibility & Inclusive Design** and the trust/consent gating expressed by **SHIG-0013 Navigation & Wayfinding**. Where a downstream visual or platform spec conflicts with an MC rule, the MC rule governs unless a higher-tier obligation compels deviation, recorded per SHIG-0001.

## 1.2 The Discipline of Motion

**MC-11** Motion in Sambandh MUST be **calm, intentional, and restrained**. The default state of any surface is stillness; motion is introduced only to serve a permitted purpose (§3) and only to the least degree that achieves it. Spectacle, ornament, showmanship, and motion-for-delight-alone are non-conformant (C-10, C-14).

**MC-12** Motion MUST NOT compete with content for attention. When content is present for the member to read, decide upon, or act on, ambient or decorative motion MUST NOT run concurrently in a way that draws attention away from the content (C-10; see AP-3).

# 2. Motion Principles

Each principle below is a normative requirement bearing its own permanent ID.

**MC-13 (Purpose-bound)** Every instance of motion MUST map to exactly one primary permitted meaning from §3 and MUST be justifiable by it. Motion whose purpose cannot be named is non-conformant.

**MC-14 (Subordination)** Motion MUST NOT delay, obstruct, or gate a member's ability to read, decide, or act. A member MUST be able to proceed at their own pace; motion MUST NOT force a waiting period that the underlying operation does not require (C-10; Tier 5 task success over Tier 8 craft).

**MC-15 (Responsiveness)** Motion that acknowledges a member's action MUST begin promptly enough that the action feels immediately registered — fast enough to feel responsive, never so slow that the member doubts whether the input took effect. This spec sets the PRINCIPLE; literal timing belongs to implementation and MUST be tuned to feel instantaneous to human perception, not to a fixed number here.

**MC-16 (Calm pacing)** Motion MUST be paced to feel calm and settled — quick enough to respect the member's time, unhurried enough to avoid a sense of frenzy, snapping, or stimulation. Pacing MUST err toward calm when responsiveness and calm are both satisfiable (C-10).

**MC-17 (Naturalness)** Motion SHOULD follow physically plausible, consistent behavior so that change feels coherent rather than arbitrary: things that appear to move MUST accelerate and settle in a way the member's intuition can predict. Erratic, bouncing, or attention-grabbing exaggeration that serves no orientation purpose is non-conformant (C-14).

**MC-18 (Proportionality)** The prominence, distance, and duration of motion MUST be proportional to the significance of the change it expresses. Minor changes MUST use minimal motion; motion prominence MUST NOT be inflated beyond the importance of what changed (C-14; see AP-6).

**MC-19 (Consistency)** The same kind of change MUST be expressed by the same kind of motion everywhere and over time (Tier 7). A given transition type MUST NOT vary arbitrarily across surfaces or releases; consistency is preferred over novelty (C-15).

**MC-20 (Restraint over spectacle)** Where a static or minimally-animated solution communicates the change as clearly as an elaborate one, the restrained solution MUST be chosen. Elaboration MUST be justified by added clarity or orientation, never by impressiveness (C-14; Tier 8 never over Tiers 1–6).

**MC-21 (Non-blocking)** Motion MUST NOT trap the member: an in-progress animation MUST NOT prevent input, navigation, dismissal, or interruption. The member MUST be able to act through or past motion at any time (C-7 agency; C-5 safety reachable).

**MC-22 (Interruptibility)** Motion MUST be interruptible and reversible in effect: if the member changes course mid-transition, the system MUST respond to the new intent rather than forcing the animation to complete first (C-7).

**MC-23 (Silence by default)** Where motion is optional to a purpose, its absence MUST be a valid, complete, conformant state. No surface may depend on motion running to be correct (MC-4; fail-secure).

# 3. Permitted Meanings of Motion (What Motion May Say)

**MC-24** Motion is ALLOWED to mean only the following, and each instance MUST serve at least one of them:

**MC-25 (Orientation)** Motion MAY show *where things come from and go to* — establishing spatial and hierarchical relationships so the member keeps their bearings through a change (e.g., a detail emerging from its source). This is motion's highest permitted purpose (MC-6).

**MC-26 (Continuity)** Motion MAY preserve continuity across a state or surface change so the member can relate the new state to the prior one, rather than being abruptly relocated (parity with SHIG-0013 continuity; see §4).

**MC-27 (Feedback)** Motion MAY confirm that an action was received and is being handled — an honest acknowledgment of input or system response (C-13). Feedback motion MUST reflect a real event; it MUST NOT simulate a response that did not occur (C-2; see MC-45).

**MC-28 (Hierarchy & focus)** Motion MAY guide attention to what genuinely matters next — honestly directing focus to the most relevant element. Focus-guiding motion MUST reflect true priority, MUST NOT manufacture salience for commercially-motivated or manipulative ends, and MUST NOT be the sole indicator of importance (C-10; C-8; see §8).

**MC-29 (State & progress)** Motion MAY communicate change of state or progress of an ongoing operation (loading, saving, advancing a step). Progress motion MUST be honest about whether progress is real, determinate, or merely "working," and MUST NOT imply completion, speed, or certainty it lacks (C-2, C-13; see MC-46).

**MC-30 (Spatial model)** Motion MAY reinforce a consistent spatial or navigational model (forward/back, deeper/shallower, open/close) so movement through the product feels coherent (Tier 7; SHIG-0013).

**MC-31 (Character & calm)** Motion MAY lend the product a calm, crafted, trustworthy character — but only within the restraint of C-14 and only when it does not compromise any higher purpose in MC-6. Character is the lowest-precedence permitted meaning and MUST yield to orientation, continuity, feedback, and focus.

**MC-32 (Forbidden meanings)** Motion MUST NOT be used to: manufacture urgency, scarcity, or anxiety; trap or reclaim attention; pressure or nudge toward a decision the member has not chosen; celebrate or dramatize in a way that coerces; imply certainty, verification, or fact that is not established (C-2); or imply, rank, or dramatize any judgment of a person's character, worth, or trustworthiness from appearance or protected attributes (C-3). These uses are prohibited regardless of business value (Tier 9 never over Tiers 1–4; see §8, AP-1, AP-2).

# 4. Transition Continuity & Orientation

**MC-33** Transitions between states or surfaces MUST preserve orientation: the member MUST be able to relate the new state to the previous one. An abrupt cut with no perceivable relationship, where a relationship exists, is non-conformant (parity with SHIG-0013 continuity).

**MC-34** Transitions MUST be **directionally honest**: motion direction MUST correspond to the conceptual relationship of the change (forward advances, back returns, deeper descends, dismiss recedes). Motion direction MUST NOT contradict the navigational meaning of the action (C-2; Tier 3; see AP-5).

**MC-35** Elements that persist across a transition SHOULD maintain a perceivable identity through the change (a continuous element is understood as the same thing moving, not a new thing appearing) where doing so aids orientation. Continuity MUST NOT be faked between elements that are not actually related (C-2).

**MC-36** Entrances and exits MUST be legible: appearance MUST make clear *what arrived and from where*, and dismissal MUST make clear *what left and to where*, so the member's mental map survives the change (SHIG-0013 orientation).

**MC-37** Transitions MUST NOT disorient: they MUST NOT spin, invert, displace over long distances, or transform in ways that break the member's sense of position without an orientation purpose that justifies it (C-10; see AP-4).

**MC-38** When multiple elements change at once, their motion MUST resolve to a single coherent reading of "what happened," not a scattered set of independent movements the member cannot parse (see §5).

**MC-39** A transition MUST have a clear, settled end state. Motion MUST NOT leave a surface in perpetual, ambiguous, or unresolved movement where the member cannot tell whether change is complete (C-13 honest states; see AP-7).

# 5. Choreography & Orchestration

**MC-40 (Coordination)** When several elements move together, their motion MUST be choreographed as one intentional composition with a clear focal reading, not a collection of simultaneous independent animations. Uncoordinated motion is non-conformant (see AP-3).

**MC-41 (Sequence & hierarchy)** Ordering, staggering, and grouping of motion MUST express the true relationships and priority among elements — leading the member's eye to what matters first. Sequence MUST reflect real hierarchy, not arbitrary flourish (MC-28; C-14).

**MC-42 (One focal change)** At any moment a transition SHOULD present a single dominant change for the member to follow; competing simultaneous focal movements that fracture attention are non-conformant (C-10).

**MC-43 (Restraint in staggering)** Staggered or sequenced motion MUST NOT extend the total time before the member can read or act beyond what responsiveness allows (MC-14, MC-15). Choreography MUST NOT be lengthened for effect at the cost of task speed (Tier 5 over Tier 8).

**MC-44 (Composability)** Motion rules MUST be defined as reusable, systemic behaviors tied to change *types*, not authored per-screen. One-off bespoke choreography that cannot be expressed as a shared, reusable rule is non-conformant (C-16 longevity/maintainability; Tier 7).

# 6. Timing, Easing & Honesty Principles

**MC-45 (Honest feedback timing)** Feedback motion MUST correspond to a real event and MUST NOT fabricate or prolong the appearance of activity beyond the actual operation. Artificial delay to make an operation "feel substantial," or motion implying work that is not happening, is prohibited (C-2, C-13; see AP-8).

**MC-46 (Honest progress)** Progress and loading motion MUST truthfully represent state: determinate progress MUST reflect actual completion; indeterminate work MUST NOT be shown as a determinate, precisely-advancing measure; and no motion may imply completion, success, verification, or certainty before it is real (C-2, C-13). On unknown progress state, present the honest "working, extent unknown" form (fail-secure).

**MC-47 (Perceptual timing principle)** Timing MUST be chosen by human perception, not by fixed numbers in this spec: acknowledgment MUST feel immediate, transitions MUST feel smooth and unhurried, and motion MUST NOT feel either laggy or frantic. Implementation MUST tune actual values to these perceptual outcomes and record them downstream.

**MC-48 (Easing principle)** Motion MUST accelerate and decelerate in a way that feels natural and settled rather than mechanical or abrupt — beginning and ending gently enough to feel calm. This spec governs the *quality* (natural, calm, consistent); specific curves are implementation and MUST NOT be fixed here.

**MC-49 (Duration proportionality)** Larger or more significant changes MAY take marginally longer than small ones, but no motion may last long enough to feel like waiting. Duration MUST scale with significance only within the ceiling set by responsiveness (MC-15, MC-18).

**MC-50 (Consistency of timing & easing)** The same change type MUST use the same timing and easing character everywhere; arbitrary per-instance variation is non-conformant (Tier 7; C-15).

**MC-51 (Repetition & looping)** Continuously looping or repeating motion MUST be confined to honest ongoing-activity indicators (e.g., "working") and MUST cease when the activity ends. Perpetual decorative looping that draws attention is prohibited (C-10; see AP-3, AP-7).

# 7. Reduced Motion, Accessibility & Never-Single-Channel

**MC-52 (Reduced-motion is first-class)** Honoring a member's reduced-motion preference is a first-class MUST, not an afterthought. When a member (via platform setting or in-product control) signals reduced or no motion, the system MUST honor it across every surface and MUST NOT reintroduce non-essential motion (C-8; WCAG AA; Tier 4).

**MC-53 (Reduced-motion completeness)** Under reduced motion, every meaning, state, feedback, orientation cue, and task MUST remain fully available and completable through non-motion channels. A reduced-motion experience MUST be equivalent in understanding and capability, differing only in the presence of motion (MC-4; C-8).

**MC-54 (Never single-channel)** Meaning MUST NEVER be carried by motion alone. Any state, importance, relationship, feedback, or instruction expressed through motion MUST also be expressed through at least one non-motion channel (text, structure, static form, persistent indicator). Motion is always additive to, never a substitute for, a durable cue (C-8; Tier 4; parity with SHIG-0011).

**MC-55 (No motion-triggered harm)** Motion MUST NOT create accessibility harm: it MUST avoid patterns that can induce discomfort, nausea, or seizures (e.g., rapid flashing, large-field rushing, high-contrast strobing). Such patterns are prohibited regardless of preference settings (C-8; Tier 4).

**MC-56 (Preference precedence)** A member's reduced-motion or comfort preference is a Tier-4 obligation and MUST override any Tier 5–9 desire for animation richness, brand expression, or engagement. Ambiguous or unknown preference MUST resolve to the calmer, reduced-motion-safe default (fail-secure; C-10).

**MC-57 (Member control)** Where the platform does not surface a motion preference, Sambandh SHOULD provide an in-product control to reduce or disable non-essential motion, honoring it consistently. Consent to richer motion, where offered, MUST follow C-4 (explicit, scoped, revocable, never pre-checked or bundled).

**MC-58 (Essential motion exception)** The only motion that MAY persist under reduced motion is motion strictly essential to convey meaning that has no adequate static equivalent; such motion MUST be minimized, MUST still avoid harmful patterns (MC-55), and its necessity MUST be recorded per SHIG-0001. Convenience or aesthetics never qualify as essential.

**MC-59 (India-first plurality)** Motion MUST NOT assume one language, script, reading direction, numeral system, device class, or bandwidth. Directional motion MUST respect the member's reading/orientation direction, and motion MUST degrade gracefully on low-capability devices and constrained networks (C-9; see §9).

# 8. Calm, Attention & Anti-Manipulation

**MC-60 (No manufactured urgency)** Motion MUST NOT manufacture urgency, scarcity, countdown pressure, or anxiety to influence a decision. Pulsing, flashing, shaking, or accelerating motion used to pressure a member is prohibited regardless of conversion value (C-10; Tier 9 never over Tier 6; see AP-1).

**MC-61 (No attention-trapping)** Motion MUST NOT be used to trap, reclaim, or compulsively hold attention — no endlessly moving feeds-for-motion's-sake, no wiggling attention bait, no motion engineered to make disengagement feel difficult. Relationship-first, not metric-first (C-11; C-10; see AP-2).

**MC-62 (No dark-pattern motion)** Motion MUST NOT bias a member toward a choice they did not intend — e.g., animating a preferred option into prominence while suppressing another, or using motion to distract from a consequential disclosure, consent choice, or safety control. Consent and safety controls MUST remain steady, legible, and reachable through any motion (C-4, C-5; Tier 1–2; see AP-9).

**MC-63 (Honest emphasis)** Focus-guiding motion (MC-28) MUST direct attention only to what is genuinely most relevant to the member's task, never to what is most profitable to surface. Emphasis MUST match true priority (C-2, C-11).

**MC-64 (No coercive celebration)** Celebratory or affirming motion MAY acknowledge a genuine member milestone but MUST remain restrained, MUST NOT dramatize in a way that pressures continued spending or engagement, and MUST NOT overstate the significance of the event (C-10, C-14).

**MC-65 (Non-inference)** Motion MUST NOT infer, rank, dramatize, or imply any judgment of a person's character, worth, desirability, or trustworthiness from appearance, complexion, caste, religion, region, language, or any protected attribute — including motion that elevates, spotlights, or animates certain people over others on such a basis. This is prohibited absolutely (C-3; Tier 4; see AP-10).

**MC-66 (Calm ambient state)** At rest, surfaces MUST be still. Idle, ambient, or background motion SHOULD be avoided; where present it MUST be so subtle as to be non-attention-drawing and MUST cease when the member is engaged with content (C-10; MC-12).

**MC-67 (No motion-induced fatigue)** Cumulative motion across a session MUST NOT produce stimulation or fatigue. Frequency and density of motion MUST be governed so that a long session feels calm, not busy (C-10).

# 9. Performance, Degradation & Fail-Secure

**MC-68 (Performance floor)** Motion MUST perform smoothly on the range of devices and networks Sambandh serves, including low-end and bandwidth-constrained conditions (C-9). Motion that stutters, janks, or degrades legibility on target devices is non-conformant; a janky animation is worse than none.

**MC-69 (Graceful degradation)** Where a device or network cannot render motion smoothly, the system MUST degrade to a simpler or static presentation that preserves all meaning and task capability (MC-4, MC-53). Degradation MUST NOT remove or corrupt any content, state, or affordance (fail-secure).

**MC-70 (No task cost)** Motion MUST NOT delay content readiness, input responsiveness, or task completion. If rendering motion would slow the member's ability to read or act, the motion MUST yield (Tier 5 over Tier 8; MC-14).

**MC-71 (Battery & resource restraint)** Continuous or heavy motion MUST NOT impose disproportionate battery, processing, or data cost, especially on constrained devices. Ongoing motion MUST be justified and bounded (C-9, C-16).

**MC-72 (Fail-secure on motion failure)** If motion fails, is interrupted, or cannot complete, the surface MUST resolve to a correct, settled, fully-legible end state — never to a broken, half-transitioned, frozen, or ambiguous state (MC-39; C-13; fail-secure).

**MC-73 (Testable performance)** Motion performance MUST be verified on representative low-capability devices and networks before member exposure; unverified motion is treated as non-conformant (C-17 evidence over opinion; fail-secure).

# 10. Multi-Platform Parity

**MC-74** The following surfaces are in scope: desktop, mobile, tablet, PWA, wearable, voice/auditory, and AR/VR/XR/spatial. Motion *meaning* MUST be consistent across all of them; presentation MAY adapt to each platform's affordances (Tier 7).

**MC-75 (Meaning parity)** A given change type MUST carry the same conceptual meaning through motion on every platform, even where the concrete expression differs. The member's learned reading of motion MUST transfer across devices without relearning (C-15; parity with SHIG-0013).

**MC-76 (Non-visual equivalence)** On voice, auditory, and non-visual surfaces, the meaning otherwise carried by visual motion MUST be conveyed through an equivalent modality (spoken transition cue, sound, or haptic) with the same honesty and never-single-channel guarantees (C-8; MC-54).

**MC-77 (Spatial/XR calm)** In spatial/XR surfaces, motion MUST prioritize member comfort and orientation above immersion: it MUST avoid vection-induced discomfort, MUST always allow a stable reference, and MUST honor reduced-motion and comfort preferences (MC-52, MC-55; C-10).

**MC-78 (Accessibility parity)** Reduced-motion honoring, never-single-channel, and harm-avoidance (§7) MUST hold on every platform. Accessibility is Tier 4 and MUST NOT be traded for platform-specific richness (Tier 8/9).

# Decision Framework

**MC-79** When choosing among competing motion options, teams MUST apply SHIG-0000 Article 4 lexicographically. An option that better serves a lower tier MUST NOT be chosen over one that better serves a higher tier; a lower-tier gain NEVER justifies a higher-tier loss.

**MC-80 (Selection rule)** Among options that violate no higher tier, teams MUST prefer the one that best preserves orientation and honesty (Tiers 3–5), then calm (Tier 6), then consistency (Tier 7), then restrained craft (Tier 8). Business preference (Tier 9) breaks ties only after all higher tiers are equal. When two options are otherwise equal, the more restrained (less motion) option MUST win (C-14).

**MC-81 (Non-negotiables)** The following MUST NOT be traded for any lower-tier benefit: honest feedback and progress (MC-45/46, Tier 3); non-inference (MC-65, Tier 4); reduced-motion honoring, never-single-channel, and harm avoidance (MC-52/54/55, Tier 4); no manufactured urgency or attention-trapping (MC-60/61, Tier 6); safety/consent controls unobstructed by motion (MC-62, Tiers 1–2); task completability without motion (MC-4, Tier 5).

**MC-82 (Deviation record)** Any SHOULD-level deviation MUST record a written justification naming the higher tier it serves, per SHIG-0001. MUST-level requirements admit no deviation.

**MC-83 (Decision table)**

| Situation | Competing pull (tiers) | Required resolution | Governing IDs |
|-----------|------------------------|---------------------|---------------|
| Elaborate animation impresses but delays reading/acting | Craft (T8) vs Task success (T5) | Choose restrained/faster; motion yields | MC-14, MC-20, MC-70 |
| Pulsing countdown motion lifts conversion | Business (T9) vs Calm (T6) | Prohibited; remove urgency motion | MC-60, MC-81 |
| Looping motion keeps members on a feed longer | Business (T9) vs Calm/relationship (T6/C-11) | Prohibited; no attention-trapping | MC-61, MC-81 |
| Rich brand motion vs member's reduced-motion setting | Craft/brand (T8) vs Accessibility (T4) | Honor reduced motion fully | MC-52, MC-56, MC-78 |
| Artificial delay makes an action "feel weighty" | Craft (T8) vs Honesty (T3) | Prohibited; feedback must be honest | MC-45, MC-81 |
| Animating preferred option into prominence near a consent choice | Business (T9) vs Consent/dignity (T2/T4) | Prohibited; steady, unbiased presentation | MC-62, MC-65 |
| Motion janks on low-end devices | Craft (T8) vs Inclusion/task (T4–5) | Degrade to static; preserve meaning | MC-68, MC-69 |
| Meaning shown only by movement | Craft (T8) vs Accessibility (T4) | Add durable non-motion channel | MC-54, MC-4 |

# Quality Framework (Measurable)

**MC-84** Each attribute below MUST have a defined measurement method and a recorded accept/reject threshold per release. Conformance claims MUST be backed by measurement (C-17); unmeasured motion is non-conformant.

| # | Quality attribute | What it measures | Accept | Reject |
|---|-------------------|------------------|--------|--------|
| MC-85 | Purpose conformance | Share of motion mapping to a permitted meaning (§3) | Every instance justified by a permitted purpose | Any purposeless/decorative-only motion present |
| MC-86 | Responsiveness | Acknowledgment latency vs perceptual "immediate" | Feels immediate to members | Perceptible lag/doubt that input registered |
| MC-87 | Calm | Members report calm, not stimulation/urgency | Meets calm target; no urgency perceived | Any manufactured urgency/attention-trap (AP-1/2) |
| MC-88 | Orientation & continuity | Members relate new state to prior; no disorientation | Meets orientation target; abrupt cuts absent | Disorientation or false continuity (AP-4/5) |
| MC-89 | Honesty | Feedback/progress reflect real events and state | Zero fabricated/misleading motion | Any deceptive feedback or progress (AP-8) |
| MC-90 | Reduced-motion honoring | Preference honored, equivalence preserved | Full honoring + full task equivalence | Any non-essential motion under reduced setting |
| MC-91 | Never-single-channel | Motion meanings duplicated in a durable channel | Zero motion-only meanings | Any meaning carried by motion alone |
| MC-92 | Harm avoidance | Absence of flashing/strobe/vection-harm patterns | No harmful patterns on any surface | Any harmful pattern present |
| MC-93 | Non-inference | No motion ranking/dramatizing people by attributes | Zero inference-based motion | Any inference-based emphasis (AP-10) |
| MC-94 | Performance | Smoothness on representative low-end devices/networks | Smooth; no jank/legibility loss | Stutter/jank or degraded legibility |
| MC-95 | Degradation & fail-secure | Correct settled state on failure/constraint | Always resolves to legible end state | Any half-transitioned/frozen/broken state |
| MC-96 | Consistency & parity | Same change type → same motion across surfaces/time/platforms | Full consistency and meaning parity | Any arbitrary variance or meaning divergence |

**MC-97 (Gate)** A release MUST NOT ship if any Tier 1–4-linked attribute is in Reject: MC-89 (honesty), MC-90/MC-91/MC-92 (reduced-motion, never-single-channel, harm), MC-93 (non-inference), or MC-95 (fail-secure) failing is a no-ship. Tier 5–9 rejects MUST be recorded with a remediation plan per SHIG-0001.

# Governance

**MC-98** This specification is Tier 1–4 in effect and, per SHIG-0000, MAY only be strengthened, never weakened, by future revisions. Requirement IDs are permanent; a superseded rule is marked Deprecated, never reused or renumbered.

**MC-99** Every motion design or change MUST cite the MC IDs it satisfies and MUST record any SHOULD-level deviation with its higher-tier justification (MC-82).

**MC-100** On any unknown, ambiguous, unmeasured, or failing motion state, the system MUST fail secure to the calmer, more-static, fully-legible outcome (MC-5, MC-56, MC-72).

**MC-101** Conflicts between this spec and any implementation guide resolve in favor of this spec; conflicts between this spec and SHIG-0000/0001 or the anchor instruments resolve in favor of those higher/anchor instruments. This spec MUST NOT be read to duplicate or override SHIG-0012 or SHIG-0015 (MC-9).

**MC-102** New platforms or motion capabilities entering scope MUST be assessed against §7 (accessibility), §9 (performance/fail-secure), and §10 (parity) before member exposure (fail-secure; C-17).

# Compliance / Review Checklist

- **MC-103** Every motion instance maps to a permitted meaning (§3); no purposeless or decorative-only motion present (MC-3/13/85).
- **MC-104** All meaning, state, and task remain fully available and completable with motion removed (MC-4/53).
- **MC-105** No meaning carried by motion alone; every motion cue duplicated in a durable non-motion channel (MC-54/91).
- **MC-106** Reduced-motion preference honored across all surfaces and platforms, with full equivalence; ambiguous preference resolves calm (MC-52/56/78/90).
- **MC-107** No flashing, strobing, or vection-harm patterns on any surface (MC-55/77/92).
- **MC-108** Feedback and progress motion are honest — no fabricated activity, no false completion/certainty (MC-27/45/46/89).
- **MC-109** No motion manufactures urgency, scarcity, anxiety, or traps/reclaims attention (MC-60/61/87).
- **MC-110** Motion does not bias consent or obstruct safety controls; those controls stay steady and reachable (MC-62; C-4/C-5).
- **MC-111** No motion infers, ranks, or dramatizes people by appearance or protected attributes (MC-65/93).
- **MC-112** Transitions preserve orientation and directional honesty; no disorientation or false continuity (MC-33/34/35/37/88).
- **MC-113** Choreography reads as one coherent change; single focal reading; no uncoordinated or perpetual motion (MC-40/42/51).
- **MC-114** Motion is responsive yet calm; interruptible, non-blocking, and never required to proceed (MC-15/16/21/22/14).
- **MC-115** Motion performs smoothly on representative low-end devices/networks and degrades gracefully; fails secure to a settled state (MC-68/69/72/94/95).
- **MC-116** Same change type uses consistent motion, timing, and easing across surfaces, time, and platforms (MC-19/50/96).
- **MC-117** Each §Quality attribute measured with recorded accept/reject; MC-97 gate honored; every change cites satisfied MC IDs (MC-84/97/99).

# Anti-patterns

For each: *why it harms · how to detect · how to prevent.*

- **AP-1 Urgency theater** — Pulsing, flashing, shaking, or countdown motion engineered to pressure a decision. Harms calm/wellbeing (C-10, Tier 6) and honesty (C-2). Detect: motion tied to conversion moments with no orientation purpose. Prevent: MC-60; permitted-meaning audit (MC-24).
- **AP-2 Attention trap** — Perpetual or wiggling motion designed to hold or reclaim attention and make disengagement hard. Harms calm and relationship-first (C-10, C-11). Detect: looping/idle motion that persists during engagement; motion that resists dismissal. Prevent: MC-61/66/51.
- **AP-3 Motion cacophony** — Many uncoordinated animations competing at once. Harms orientation and calm (C-10). Detect: multiple simultaneous focal movements; no single reading of "what happened." Prevent: MC-40/42; choreograph as one composition.
- **AP-4 Disorienting transition** — Spins, inversions, or long displacements that break the member's sense of position. Harms orientation (Tier 5) and calm (Tier 6). Detect: members lose their place after a transition. Prevent: MC-33/37; minimal, direction-honest motion.
- **AP-5 Directional dishonesty** — Motion direction contradicts the navigational meaning (back animates forward). Harms honesty of signal (C-2, Tier 3). Detect: mismatch between motion direction and action meaning. Prevent: MC-34.
- **AP-6 Over-animation / spectacle** — Elaborate motion beyond the significance of the change. Harms premium-through-restraint (C-14, Tier 8) and often task speed (Tier 5). Detect: motion prominence disproportionate to change; "impressive" cited as justification. Prevent: MC-18/20; restraint default.
- **AP-7 Perpetual/unresolved motion** — Surfaces left in ongoing or ambiguous movement with no settled end. Harms honest states (C-13). Detect: member cannot tell whether change is complete. Prevent: MC-39/51/72; clear end state.
- **AP-8 Fake work** — Artificial delay or fabricated activity to make actions "feel substantial." Harms honesty (C-2, C-13, Tier 3). Detect: animation duration exceeds real operation; spinners with no underlying work. Prevent: MC-45/46.
- **AP-9 Consent/safety obstruction** — Motion that distracts from, delays, or biases a consent or safety control. Harms consent and safety (C-4, C-5, Tiers 1–2). Detect: motion near disclosures/consent/safety affordances; controls that move or hide. Prevent: MC-62; steady, reachable controls.
- **AP-10 Inference by motion** — Elevating, spotlighting, or animating people differently based on appearance or protected attributes. Harms dignity/non-inference (C-3, Tier 4). Detect: motion emphasis correlated with attributes. Prevent: MC-65; prohibited absolutely.
- **AP-11 Motion-only meaning** — A state, importance, or instruction conveyed solely by movement. Harms accessibility (C-8, Tier 4). Detect: meaning disappears under reduced motion. Prevent: MC-54; duplicate in a durable channel.
- **AP-12 Ignored reduced-motion** — Non-essential motion persists despite a reduced-motion preference. Harms accessibility and calm (C-8, C-10, Tier 4). Detect: motion runs with the preference set. Prevent: MC-52/56; first-class honoring, fail-secure.
- **AP-13 Janky/heavy motion** — Motion that stutters or drains resources on target devices. Harms inclusion and task success (C-9, Tiers 4–5). Detect: dropped frames on low-end devices; battery/data cost. Prevent: MC-68/69/71; verify and degrade.
- **AP-14 Broken end state** — A failed or interrupted transition leaves a half-animated, frozen, or ambiguous surface. Harms honest states and safety (C-13, fail-secure). Detect: partial states after interruption/failure. Prevent: MC-72; resolve to settled legible state.
- **AP-15 Inconsistent motion vocabulary** — The same change type animates differently across surfaces or releases. Harms consistency (Tier 7, C-15). Detect: cross-surface motion audit reveals arbitrary variance. Prevent: MC-19/44/50/96; systemic reusable rules.

# Open Questions

- **MC-118** Standard perceptual-timing measurement instruments and per-surface accept/reject thresholds for §Quality attributes require SHIG-wide calibration and are deferred to a measurement annex.
- **MC-119** A shared taxonomy mapping each canonical change *type* to its permitted motion vocabulary (for MC-19/44 systemic reuse) needs a dedicated companion catalog, kept implementation-independent.
- **MC-120** Non-visual and haptic equivalence for motion meaning (MC-76) awaits a modality-mapping guide as voice, ambient, and wearable surfaces mature.
- **MC-121** XR/spatial comfort thresholds (MC-77) — vection tolerances and reference-stability rules — require a spatial-comfort specification cross-referenced with SHIG-0011 as those surfaces enter scope.
- **MC-122** Governance for member-elected "richer motion" (opt-in beyond the calm default, MC-57) needs a consent-bounded preference rule set that cannot weaken the reduced-motion floor.

# Revision History

| Version | Date | Status | Author | Summary |
|---------|------|--------|--------|---------|
| 1.0.0 | 2026-07-27 | Active | Chief Design Officer, Sambandh | Initial governing specification for Motion & Choreography; requirement IDs MC-1..MC-122. |

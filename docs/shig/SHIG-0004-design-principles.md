# Specification ID

SHIG-0004

# Specification Name

Design Principles Specification

# Version

1.0.0

# Status

Active

# 1. Purpose, Scope & Normative Basis

## 1.1 Purpose
This specification establishes the permanent, enumerated decision-making framework governing every visual, interaction, motion, layout, navigation, information, component, content, and AI-interaction decision in the Sambandh product surface. Each principle is a durable rule with a stable identifier; principles are the operative bridge between the Constitution's immutable commitments (SHIG-0000) and concrete component/pattern specifications downstream.

## 1.2 Scope
Applies to all human-facing surfaces (native, web, low-bandwidth, assistive-technology, conversational, and AI-mediated), all locales and scripts, and all future channels. Implementation-independent: this document names abstract properties only; it does not specify colors, type families, tokens, or component code.

## 1.3 Normative basis and precedence
This specification is subordinate to SHIG-0000 (Constitution, supreme) and SHIG-0001 (Foundation & Governance, rule grammar). Where any principle here appears to conflict with SHIG-0000 Article 4 or principles C-1..C-17, the higher instrument governs and this text MUST be read down to conform. This document references those instruments; it does not re-derive, re-order, or restate their authority.

## 1.4 Rule grammar (inherited from SHIG-0001)
MUST / MUST NOT = mandatory. SHOULD / SHOULD NOT = recommended; any deviation MUST be recorded in the design decision log naming the higher Article 4 tier that the deviation serves. MAY = optional. Requirement identifiers use prefix `DP-n` for principles and `DP-n.m` for the rules within a principle; identifiers are permanent and are never reused or renumbered. Status and versioning follow the SHIG-0001 lifecycle.

## 1.5 Tier binding
Each principle declares the Article 4 tier(s) it primarily enforces. Principles that enforce **Tier 1 (Safety & legality), Tier 2 (Consent & privacy), Tier 3 (Honesty of signal), or Tier 4 (Human dignity & inclusion)** are **non-compromisable**: their MUST/MUST NOT rules constitute Tier 1-4 guarantees that may only be strengthened, never weakened (SHIG-0001). No lower-tier gain (understanding, calm, consistency, craft, business) may justify weakening them (Article 4, lexicographic).

# 2. Design Principles (DP-1 … DP-40)

> Format per principle: **Purpose / Benefit** (problem solved + user and business value) · **Tier** · **Rules** (MUST / MUST NOT, each with an ID) · **Recommended** (SHOULD) · **Non-obvious implication** (accessibility / privacy / trust) · **Verify** (how a reviewer confirms compliance) · **Anti-pattern** · **Exception** (documented deviation, always subordinate to Article 4).

---

## DP-1 Human-Centered Design
**Purpose/Benefit:** Design serves real user goals, contexts, and constraints, not internal or vanity objectives; reduces abandonment and support cost.
**Tier:** 5 (with Tier 4 dignity floor).
**Rules:**
- **DP-1.1 (MUST)** Every screen, flow, and component MUST trace to an identified user goal and context of use documented before build.
- **DP-1.2 (MUST NOT)** MUST NOT ship a flow whose primary purpose is a business metric with no articulated user benefit.
- **DP-1.3 (MUST)** Design decisions in dispute MUST be resolved with evidence about actual users (DP references C-17 evidence-over-opinion), not seniority or preference.
**Recommended:** SHOULD validate with representative users across the intended device/bandwidth/literacy range before scale release.
**Non-obvious:** Trust — users detect designs optimized against them; extractive patterns erode the trust DP-2 protects.
**Verify:** Each artifact links to a stated user goal and at least one piece of user evidence; reviewer can name the user and context.
**Anti-pattern:** "Because the stakeholder liked it"; personas invented to rationalize a pre-made decision.
**Exception:** None to the dignity floor. Evidence depth MAY scale with risk if documented.

## DP-2 Trust-First Design
**Purpose/Benefit:** Establish trust before requesting engagement, data, or payment; increases genuine conversion and retention over coerced clicks. (C-1)
**Tier:** 3–4.
**Rules:**
- **DP-2.1 (MUST)** Value and identity of the party MUST be legible before the interface asks for data, money, or commitment.
- **DP-2.2 (MUST NOT)** MUST NOT gate essential understanding behind sign-up, payment, or personal-data capture ("wall-first").
- **DP-2.3 (MUST)** Trust state MUST be shown honestly; unknown/unverified trust MUST render as *unverified*, never as verified or implied-verified (fail-secure, C fail-secure clause).
- **DP-2.4 (MUST NOT)** MUST NOT display trust signals (badges, verification, ratings, endorsements) that are not backed by an auditable basis.
**Recommended:** SHOULD sequence disclosure so the user can evaluate before committing.
**Non-obvious:** Honesty — a fabricated or ambiguous trust mark is a Tier-3 violation, not a decoration.
**Verify:** Trust indicators map to a verifiable data source; no verified state appears without backing; first data/payment ask is preceded by legible value.
**Anti-pattern:** Verified checkmark by default; "trusted by" claims without provenance; forced account before any value.
**Exception:** None — Tier 3–4.

## DP-3 Privacy by Design
**Purpose/Benefit:** Protect users by collecting the minimum and defaulting to non-exposure; reduces breach liability and builds durable trust. (C-4, C-6)
**Tier:** 2.
**Rules:**
- **DP-3.1 (MUST)** Data collection MUST be minimized to what the stated task requires; every field MUST have a task justification.
- **DP-3.2 (MUST)** Consent MUST be explicit, scoped to a named purpose, and revocable through an equally reachable control.
- **DP-3.3 (MUST NOT)** MUST NOT collect, infer, transmit, or retain data covertly; no background surveillance, silent sensors, or dark telemetry.
- **DP-3.4 (MUST)** Ambiguous, failed, or timed-out consent MUST be treated as **not consented** (fail-secure).
- **DP-3.5 (MUST NOT)** MUST NOT pre-check consent, bundle unrelated consents, or use interface weighting (visual, motion, position) to steer consent.
**Recommended:** SHOULD show, at point of capture, why data is needed and how to withdraw.
**Non-obvious:** Accessibility — consent and withdrawal controls MUST meet the same AA and non-color-alone rules as any control (DP-5).
**Verify:** Data inventory per flow; each field justified; consent is opt-in, scoped, revocable; withdrawal path exists and is reachable.
**Anti-pattern:** Pre-ticked boxes; "accept all" prominent while "reject" is buried; consent walls; asking for contacts/location "to improve experience."
**Exception:** None — Tier 2.

## DP-4 Safety by Design
**Purpose/Benefit:** Keep users physically, financially, and psychologically safe and keep safety/exit controls reachable; prevents harm and legal exposure. (C-5)
**Tier:** 1.
**Rules:**
- **DP-4.1 (MUST)** Safety, exit, cancel, block, report, and stop controls MUST be present, reachable, and unobstructed at all times in flows where harm is possible.
- **DP-4.2 (MUST NOT)** MUST NOT obstruct, delay, hide, disguise, or add friction to a safety or exit control (no interstitials, no confirm-shaming, no motion that blocks it).
- **DP-4.3 (MUST)** Irreversible or high-consequence actions MUST require deliberate, clearly-labeled confirmation and MUST state the consequence plainly.
- **DP-4.4 (MUST)** The default state of any ambiguous safety-relevant decision MUST be the safer state.
**Recommended:** SHOULD provide undo in preference to confirmation dialogs where reversibility is feasible (see DP-24).
**Non-obvious:** Legality — obstructing withdrawal/cancel may breach law; Tier 1 subsumes Tier 9 growth incentives entirely.
**Verify:** Exit/cancel/report reachable within the flow without dead-ends; destructive actions confirmed with stated consequence; defaults are safe.
**Anti-pattern:** Hidden "cancel subscription"; report button behind three menus; confirm-shaming ("No, I don't want to be safe").
**Exception:** None — Tier 1.

## DP-5 Accessibility by Design
**Purpose/Benefit:** Everyone can perceive, operate, and understand the interface; expands reach and is a dignity and legal obligation. (C-8)
**Tier:** 4 (floor).
**Rules:**
- **DP-5.1 (MUST)** All surfaces MUST meet WCAG 2.2 Level AA as a non-negotiable floor.
- **DP-5.2 (MUST NOT)** MUST NOT convey meaning, state, or required action by color, position, shape, or motion **alone**; a redundant non-sensory cue (text/label/programmatic state) MUST accompany it.
- **DP-5.3 (MUST)** All functionality MUST be operable by keyboard and by assistive technology, with a visible focus indicator and a logical focus order.
- **DP-5.4 (MUST)** Interactive targets MUST meet the AA minimum target size and spacing; text MUST remain readable and reflow without loss at supported zoom/scaling.
- **DP-5.5 (MUST)** Time limits MUST be adjustable/extendable or absent where the task does not require them.
**Recommended:** SHOULD exceed AA toward AAA where it does not conflict with a higher tier.
**Non-obvious:** Inclusion — AA is a floor, not a ceiling; failing it is a Tier-4 dignity failure, not a "nice to have."
**Verify:** Automated + manual audit against WCAG 2.2 AA; keyboard-only and screen-reader pass; no meaning-by-color/position/motion alone; contrast and target-size checks pass.
**Anti-pattern:** Red/green-only status; icon-only controls without names; focus traps; disabling zoom.
**Exception:** None below AA. A single WCAG criterion MAY be met by an equivalent accommodation only if documented and equivalence is proven.

## DP-6 Inclusive Design
**Purpose/Benefit:** Serve India-first and globally; assume no single language, script, numeral system, device, literacy level, or bandwidth; grows the addressable base and upholds dignity. (C-9)
**Tier:** 4.
**Rules:**
- **DP-6.1 (MUST)** Layout, content, and components MUST support localization: multiple scripts, text expansion/contraction, right-to-left and left-to-right, and locale numerals/dates/currency.
- **DP-6.2 (MUST NOT)** MUST NOT hard-assume a single language, script, high-end device, or high bandwidth as the only supported path.
- **DP-6.3 (MUST)** Core tasks MUST remain completable on low-bandwidth and low-capability devices, degrading gracefully.
- **DP-6.4 (MUST NOT)** MUST NOT infer character, worth, trust, competence, or eligibility from appearance, complexion, caste, religion, region, language, or accent — in imagery, defaults, ordering, or copy (C-3 non-inference).
**Recommended:** SHOULD test with users across the target literacy, device, and bandwidth spectrum.
**Non-obvious:** Trust/honesty — inferred social categorization is both a dignity (Tier 4) and honesty-of-signal (Tier 3) violation.
**Verify:** Pseudo-localization and RTL pass without breakage; core flow works on constrained device/network; no content encodes social inference.
**Anti-pattern:** Fixed-width labels that clip translations; "premium" defaults gated on device class; imagery signaling a single group as default/aspirational.
**Exception:** None to DP-6.4 or the low-bandwidth floor. Locale rollout MAY be staged if each released locale meets the rule.

## DP-7 Emotional Design
**Purpose/Benefit:** Evoke reassurance, competence, and calm appropriate to relationship-building; increases comfort and retention without manipulation. (C-14)
**Tier:** 6.
**Rules:**
- **DP-7.1 (MUST NOT)** MUST NOT engineer negative emotion (fear, shame, FOMO, anxiety, loneliness) to drive an action.
- **DP-7.2 (MUST)** Emotional tone MUST be honest about the underlying state (no false celebration, no fake warmth over an error).
**Recommended:** SHOULD align emotional tone to context (calm in sensitive moments, restrained delight in success).
**Non-obvious:** Honesty — emotion must not contradict signal; a celebratory animation over a failure is a Tier-3 breach.
**Verify:** No dark-emotion triggers in flows; emotional cues match true system state; sensitive contexts read as calm/respectful.
**Anti-pattern:** Guilt-tripped decline options; manufactured scarcity anxiety; confetti on a partial failure.
**Exception:** Tier-6; yields to Tiers 1–5 when they conflict (e.g., a blunt safety warning over a soothing tone).

## DP-8 Calm Interface Design
**Purpose/Benefit:** Prefer calm over stimulation; no manufactured urgency or compulsion; protects attention and wellbeing and sustains long-term relationship value. (C-15, C-16)
**Tier:** 6.
**Rules:**
- **DP-8.1 (MUST NOT)** MUST NOT use countdown timers, false scarcity, streak-loss pressure, infinite-scroll compulsion loops, or intermittent-reward mechanics to compel engagement.
- **DP-8.2 (MUST NOT)** MUST NOT interrupt with non-critical, attention-seeking notifications or motion; interruptions MUST be reserved for user-relevant, time-critical information.
- **DP-8.3 (MUST)** The default experience MUST be quiet: notifications and attention demands are opt-in and controllable by the user.
**Recommended:** SHOULD give users granular control over frequency and channel of any proactive contact.
**Non-obvious:** Trust — engagement extracted by compulsion is fragile and reputationally costly; calm is a competitive and ethical asset.
**Verify:** No urgency/scarcity/streak mechanics present; notification defaults are minimal and user-controlled; no compulsion loops.
**Anti-pattern:** "Only 2 left!" fabricated; "Your streak will be lost"; red badges on trivial events; autoplay that demands attention.
**Exception:** Genuine, factual time-limits (e.g., real appointment window) MAY be shown, stated as fact (DP-13), never fabricated.

## DP-9 Relationship-First Design
**Purpose/Benefit:** Optimize for the health of the human relationship the product serves, not for engagement metrics; drives durable trust and word-of-mouth. (C-13)
**Tier:** 6 (informs Tier 5 prioritization).
**Rules:**
- **DP-9.1 (MUST NOT)** MUST NOT let a growth or engagement metric override the user's relational interest (e.g., discouraging a healthy "we found each other, goodbye" outcome).
- **DP-9.2 (MUST)** Success states MUST include the user's genuine goal completion, even when that reduces platform engagement.
**Recommended:** SHOULD design "graduation" and closure paths as first-class, dignified outcomes.
**Non-obvious:** Honesty/trust — celebrating retention over the user's real success is a signal lie.
**Verify:** Success metrics for the flow include real user outcomes; closure/exit paths exist and are respectful; no anti-completion friction.
**Anti-pattern:** Hiding the "we're done" action; nudging re-engagement against the user's stated goal.
**Exception:** Tier-6; subordinate to Tiers 1–5.

## DP-10 Conversation-Centered Design
**Purpose/Benefit:** Treat interaction as a respectful dialogue (turn-taking, context, listening) rather than form-filling extraction; improves comprehension and rapport.
**Tier:** 5 (with Tier 2 consent binding).
**Rules:**
- **DP-10.1 (MUST)** Conversational surfaces MUST preserve user context across turns without silently re-using it for unconsented purposes (DP-3).
- **DP-10.2 (MUST)** The user MUST be able to review, correct, and delete what the system has recorded about the conversation.
- **DP-10.3 (MUST NOT)** MUST NOT feign human identity where the counterpart is automated (DP-11 labeling).
**Recommended:** SHOULD support interruption, correction, and "go back" naturally within the dialogue.
**Non-obvious:** Privacy — conversational memory is data; it is consent-scoped like any store.
**Verify:** Context persists usefully; correction/delete controls present; automated turns are labeled; no unconsented reuse of conversational data.
**Anti-pattern:** Bot posing as a person; conversation history mined for unrelated targeting; no way to correct a misheard input.
**Exception:** None to labeling (Tier 3) or consent (Tier 2).

## DP-11 Ethical AI Design
**Purpose/Benefit:** AI assists, never authorizes as sole authority; is labeled, consent-bounded, and honest about uncertainty; preserves user agency and prevents automated harm. (C-12, C-2)
**Tier:** 3 (with Tiers 1–2 bindings).
**Rules:**
- **DP-11.1 (MUST)** AI-generated or AI-assisted content, suggestions, and decisions MUST be clearly labeled as such at the point of use.
- **DP-11.2 (MUST NOT)** MUST NOT present AI inference, prediction, score, or ranking as fact, truth, or verified reality (C-2 honesty of signal).
- **DP-11.3 (MUST)** AI MUST be positioned as assistance; consequential decisions MUST retain a human-reversible path and MUST NOT be finalized by AI alone where they affect rights, safety, money, or reputation.
- **DP-11.4 (MUST NOT)** MUST NOT infer or act on protected/sensitive attributes (appearance, complexion, caste, religion, region, language) — C-3.
- **DP-11.5 (MUST)** AI operation MUST be consent-bounded (DP-3) and MUST expose its confidence/uncertainty honestly where output drives a user decision.
**Recommended:** SHOULD explain, in plain language, the basis and limits of an AI output.
**Non-obvious:** Dignity — automated categorization of people is a Tier-3 and Tier-4 hazard simultaneously.
**Verify:** Every AI output labeled; inferences framed as inference with uncertainty; human override exists for consequential actions; no sensitive-attribute inference.
**Anti-pattern:** "Match score: 92%" shown as objective truth; unlabeled AI copy; AI auto-decision with no appeal; personality inferred from a photo.
**Exception:** None to labeling, honesty, non-inference, or human-override for consequential actions.

## DP-12 Transparency
**Purpose/Benefit:** Users can see what is happening, why, and what the system knows; reduces suspicion and support load. (C-11)
**Tier:** 3.
**Rules:**
- **DP-12.1 (MUST)** The system MUST make visible what data it holds about the user, why an action or recommendation occurred, and who the counterparty is.
- **DP-12.2 (MUST NOT)** MUST NOT hide fees, terms, automated decisioning, or data use behind obscurity or late disclosure.
**Recommended:** SHOULD disclose the basis of ranking/sorting/recommendation in plain terms.
**Non-obvious:** Consent — meaningful consent (DP-3) is impossible without prior transparency.
**Verify:** Data-about-me is inspectable; costs/terms disclosed before commitment; ranking/automation basis discoverable.
**Anti-pattern:** Fees revealed at final step; opaque "for you" feeds with no explanation; hidden automated rejection.
**Exception:** Legitimate security/fraud details MAY be withheld where disclosure would enable abuse, documented and narrowly scoped.

## DP-13 Honesty
**Purpose/Benefit:** Every signal is truthful; never present inference/prediction/estimate as fact; foundational to trust and non-manipulation. (C-2)
**Tier:** 3.
**Rules:**
- **DP-13.1 (MUST)** Estimates, predictions, and inferences MUST be labeled as such and MUST NOT be styled as confirmed fact.
- **DP-13.2 (MUST NOT)** MUST NOT display fabricated content — fake activity, fake scarcity, fake social proof, fake urgency, placeholder data shown as real.
- **DP-13.3 (MUST)** Empty, loading, partial, and error states MUST tell the truth about the actual state (see DP-21).
**Recommended:** SHOULD distinguish visually and verbally between verified facts, user-provided claims, and system inferences.
**Non-obvious:** Everything — honesty is the master signal; violating it corrupts every downstream trust decision.
**Verify:** No fabricated data anywhere; inferences labeled; states reflect reality; verified vs claimed vs inferred are distinguishable.
**Anti-pattern:** "12 people viewing now" (fabricated); fake reviews; estimated delivery shown as guaranteed; sample data indistinguishable from real.
**Exception:** None — Tier 3.

## DP-14 Predictability
**Purpose/Benefit:** The system behaves as users expect from prior state and platform convention; reduces error and anxiety.
**Tier:** 5.
**Rules:**
- **DP-14.1 (MUST)** Identical controls MUST produce identical outcomes across contexts; a control MUST NOT change meaning without a visible change of state.
- **DP-14.2 (MUST NOT)** MUST NOT move, relabel, or repurpose controls between adjacent steps in ways that mislead the next action.
**Recommended:** SHOULD honor established platform and product conventions unless a documented higher-tier reason requires deviation.
**Non-obvious:** Safety — unpredictable placement of confirm/cancel causes destructive mis-clicks (Tier 1 hazard).
**Verify:** Same control = same result across surfaces; no last-moment relabeling; conventions honored or deviation logged.
**Anti-pattern:** Swapping primary/secondary button positions between steps; a "Skip" that subscribes.
**Exception:** SHOULD-level convention deviations allowed with logged higher-tier justification; never for destructive-action swaps.

## DP-15 Consistency
**Purpose/Benefit:** One coherent system; same concepts look and behave the same everywhere; lowers learning cost and signals craft. (C-1 premium-through-restraint corollary; consistency-over-novelty)
**Tier:** 7.
**Rules:**
- **DP-15.1 (MUST)** Recurring concepts (actions, states, entities, terminology) MUST be represented consistently in appearance, behavior, and naming across all surfaces.
- **DP-15.2 (MUST NOT)** MUST NOT introduce a novel pattern where an established system pattern already solves the need.
**Recommended:** SHOULD extend the system through shared, named rules rather than one-off screens (see DP-39).
**Non-obvious:** Accessibility — consistent identification/labeling is a WCAG requirement, not only an aesthetic one.
**Verify:** Terminology and interaction audit shows no unjustified divergence; new patterns justified against existing ones.
**Anti-pattern:** Three different date pickers; the same action named three ways; novelty for its own sake.
**Exception:** Tier-7; yields to Tiers 1–6 (e.g., accessibility or clarity may require a locally different treatment, logged).

## DP-16 Clarity
**Purpose/Benefit:** Meaning is immediately understood; language and layout are unambiguous; reduces error and support cost.
**Tier:** 5.
**Rules:**
- **DP-16.1 (MUST)** Labels, instructions, and messages MUST be unambiguous, plain-language, and testable for a single interpretation.
- **DP-16.2 (MUST NOT)** MUST NOT use jargon, euphemism, or vague language for consequential actions (cost, deletion, sharing, consent).
**Recommended:** SHOULD write for the least-literate intended user and localize meaningfully, not literally.
**Non-obvious:** Consent — ambiguous wording invalidates consent (Tier 2); clarity is a legality input.
**Verify:** Comprehension check yields one interpretation; consequential actions state their real effect; readability appropriate to audience.
**Anti-pattern:** "Manage preferences" that actually deletes; euphemisms hiding cost; clever copy that obscures function.
**Exception:** None where clarity is required for consent, cost, or safety.

## DP-17 Simplicity
**Purpose/Benefit:** Only what is necessary is present; the shortest honest path to the goal; reduces cognitive load and error.
**Tier:** 5 (expresses C-16 premium-through-restraint).
**Rules:**
- **DP-17.1 (MUST)** Each screen MUST have a clear primary purpose; secondary elements MUST NOT compete with or obscure it.
- **DP-17.2 (MUST NOT)** MUST NOT add features, options, or decoration that do not serve the user's goal ("just in case" clutter).
**Recommended:** SHOULD remove before adding; default to the minimal viable set and reveal more via DP-18.
**Non-obvious:** Accessibility — fewer, clearer elements reduce load for cognitive and low-vision users.
**Verify:** Primary action identifiable in seconds; no element lacks a purpose; option count justified.
**Anti-pattern:** Kitchen-sink screens; decorative complexity; every option shown at once.
**Exception:** Complexity intrinsic to the task MAY remain but SHOULD be structured (DP-18, DP-28).

## DP-18 Progressive Disclosure
**Purpose/Benefit:** Show what is needed now; reveal depth on demand; keeps interfaces approachable while supporting advanced needs.
**Tier:** 5.
**Rules:**
- **DP-18.1 (MUST)** Advanced, rare, or detailed options MUST be reachable but MUST NOT crowd the primary path.
- **DP-18.2 (MUST NOT)** MUST NOT hide information that the user needs to make a safe, consented, or costed decision (that MUST be surfaced up-front per DP-4, DP-3, DP-12).
**Recommended:** SHOULD layer detail so each layer is complete for its audience.
**Non-obvious:** Honesty/safety — disclosure sequencing MUST NOT become concealment of cost, consent, or risk.
**Verify:** Primary path uncluttered; depth reachable; no safety/cost/consent-critical info deferred below the fold or behind a click.
**Anti-pattern:** Hiding fees or consent in "advanced"; primary screen buried under options.
**Exception:** None for cost/consent/safety disclosure.

## DP-19 Cognitive Load Reduction
**Purpose/Benefit:** Minimize the mental effort to understand and act; improves success rates and reduces errors, especially under stress or low literacy.
**Tier:** 5.
**Rules:**
- **DP-19.1 (MUST)** Tasks MUST be decomposed so no single step exceeds a reasonable working-memory demand; chunk long forms/flows.
- **DP-19.2 (MUST NOT)** MUST NOT require users to remember information across steps that the system can carry forward for them.
**Recommended:** SHOULD provide sensible defaults, summaries, and in-context help.
**Non-obvious:** Accessibility — load reduction is essential for cognitive-disability inclusion (Tier 4 adjacency).
**Verify:** Step complexity bounded; prior inputs carried forward; defaults present; no memory-burden hand-offs.
**Anti-pattern:** Re-entering data already provided; long ungrouped forms; instructions that vanish before use.
**Exception:** Security may require re-entry (e.g., re-auth); documented.

## DP-20 Recognition Over Recall
**Purpose/Benefit:** Make options, actions, and prior choices visible so users recognize rather than remember; lowers error and cognitive load.
**Tier:** 5.
**Rules:**
- **DP-20.1 (MUST)** Available actions and current selections MUST be visible or easily retrievable at the point of decision.
- **DP-20.2 (MUST NOT)** MUST NOT rely on the user to memorize codes, paths, or prior values to proceed.
**Recommended:** SHOULD surface recent/relevant items and show current context and breadcrumbs.
**Non-obvious:** Accessibility — reduces memory demand for cognitive and screen-reader users.
**Verify:** Choices visible at decision points; no memorized-value requirements; context/state shown.
**Anti-pattern:** "Enter the code from the previous screen"; hidden current selection; invisible mode state.
**Exception:** Secrets (passwords/OTP) are intentionally not shown; standard security exception.

## DP-21 Feedback & System Status
**Purpose/Benefit:** Always tell the user what the system is doing and the result of their action; prevents uncertainty, duplicate actions, and distrust.
**Tier:** 5 (with Tier 3 honesty binding).
**Rules:**
- **DP-21.1 (MUST)** Every user action MUST produce timely, perceivable feedback confirming receipt and outcome.
- **DP-21.2 (MUST)** System status (loading, saving, offline, error, success, empty) MUST be communicated honestly and MUST NOT be faked, hidden, or indefinitely ambiguous.
- **DP-21.3 (MUST NOT)** MUST NOT show a success state before the operation has actually succeeded.
**Recommended:** SHOULD indicate progress and expected duration for long operations.
**Non-obvious:** Accessibility — status MUST be programmatically exposed (not visual-only) per DP-5.2.
**Verify:** Actions acknowledged; states truthful and AT-exposed; no premature success; long ops show progress.
**Anti-pattern:** Optimistic "Saved!" that later fails silently; spinner with no resolution; color-only status.
**Exception:** None to honesty of status.

## DP-22 Error Prevention
**Purpose/Benefit:** Prevent errors before they happen; cheaper and less stressful than recovery.
**Tier:** 5 (with Tier 1 for destructive actions).
**Rules:**
- **DP-22.1 (MUST)** Constrain and validate input at the point of entry to prevent invalid or dangerous states.
- **DP-22.2 (MUST)** Destructive or irreversible actions MUST require confirmation or provide undo (link to DP-4.3, DP-24).
- **DP-22.3 (MUST NOT)** MUST NOT let a single accidental action cause irreversible loss without a guard.
**Recommended:** SHOULD prefer selection over free entry, and format-forgiving inputs.
**Non-obvious:** Safety — prevention of destructive mis-action is a Tier-1 concern.
**Verify:** Inline validation present; destructive actions guarded; no single-tap irreversible loss.
**Anti-pattern:** Free-text where a picker fits; delete with no confirm/undo; validation only after full submission.
**Exception:** None for destructive-action guards.

## DP-23 Error Recovery
**Purpose/Benefit:** When errors occur, help users understand and fix them quickly; preserves task success and trust.
**Tier:** 5.
**Rules:**
- **DP-23.1 (MUST)** Error messages MUST state, in plain language, what went wrong and how to recover; MUST NOT blame the user or expose raw technical codes as the primary message.
- **DP-23.2 (MUST)** The system MUST preserve user input across an error so it need not be re-entered.
- **DP-23.3 (MUST NOT)** MUST NOT dead-end: every error MUST offer a next step or exit.
**Recommended:** SHOULD point to the exact field/cause and offer a one-tap fix where possible.
**Non-obvious:** Honesty — error copy MUST NOT understate a real failure (e.g., "minor issue" for data loss).
**Verify:** Errors are actionable, specific, input-preserving, and never dead-ends; no raw stack traces to users.
**Anti-pattern:** "Something went wrong"; cleared forms after error; error 0x000 with no guidance.
**Exception:** Security errors MAY be intentionally generic to avoid leaking; still offer a next step.

## DP-24 Forgiveness
**Purpose/Benefit:** Let users undo, reverse, and change their minds; enables confident exploration and reduces fear. (C-7 reversibility/agency)
**Tier:** 5 (with Tier 1–2 for consequential/consent actions).
**Rules:**
- **DP-24.1 (MUST)** Reversible actions MUST provide a clear undo; the system MUST prefer reversibility over hard confirmation where feasible.
- **DP-24.2 (MUST)** Consent, sharing, and commitments MUST be revocable through an equally reachable control (aligns DP-3.2).
- **DP-24.3 (MUST NOT)** MUST NOT make routine actions irreversible without necessity.
**Recommended:** SHOULD provide an undo window with clear timing for consequential-but-reversible actions.
**Non-obvious:** Privacy — revocability is a Tier-2 requirement, not merely UX comfort.
**Verify:** Undo present for reversible actions; revoke path for consent/sharing is equally reachable; irreversibility justified.
**Anti-pattern:** No undo on send/delete; "one-way" sharing; revoke buried deep.
**Exception:** Genuinely irreversible real-world actions (e.g., completed payment settlement) — state clearly and guard per DP-4.

## DP-25 Flexibility
**Purpose/Benefit:** Support novice and expert paths and diverse contexts without forcing one route; broadens usability.
**Tier:** 5.
**Rules:**
- **DP-25.1 (MUST)** Core tasks MUST NOT be locked to a single rigid path where reasonable alternatives serve different users/contexts.
- **DP-25.2 (MUST NOT)** MUST NOT let flexibility create ambiguity, inconsistency (DP-15), or accessibility gaps (DP-5).
**Recommended:** SHOULD offer accelerators for frequent users while keeping the guided path intact.
**Non-obvious:** Accessibility — flexibility MUST include AT and input-modality alternatives.
**Verify:** Alternative paths exist for key tasks; accelerators do not break the primary path; all paths meet AA.
**Anti-pattern:** Forced wizard for experts; shortcuts that bypass consent/safety; mouse-only power features.
**Exception:** Safety/consent flows MAY be deliberately single-path; documented.

## DP-26 Efficiency
**Purpose/Benefit:** Minimize steps, input, and time to complete real tasks; respects users' time and increases completion.
**Tier:** 5.
**Rules:**
- **DP-26.1 (MUST)** Flows MUST eliminate unnecessary steps, redundant input, and avoidable waiting.
- **DP-26.2 (MUST NOT)** MUST NOT add friction, interstitials, or steps whose purpose is engagement/monetization rather than the user's task (link DP-2, DP-8).
**Recommended:** SHOULD pre-fill known data (consented) and remember safe preferences.
**Non-obvious:** Honesty/consent — pre-fill MUST use only consented data and be visible/editable.
**Verify:** Step count justified; no engagement-only friction; pre-fill consented and editable.
**Anti-pattern:** Upsell interstitials mid-task; re-asking known data; artificial "processing" delays.
**Exception:** Deliberate friction for safety/consent (e.g., re-confirm a large transfer) is allowed and documented.

## DP-27 Performance Perception
**Purpose/Benefit:** The interface feels responsive and respectful of waiting; perceived speed drives satisfaction as much as actual speed.
**Tier:** 5–6.
**Rules:**
- **DP-27.1 (MUST)** The interface MUST acknowledge input immediately (within a perceptible-instant threshold) even when the result is pending.
- **DP-27.2 (MUST)** Waits MUST be communicated honestly (DP-21); progress or skeleton states MUST represent real progress, not a fake animation implying completion.
- **DP-27.3 (MUST NOT)** MUST NOT insert artificial delays to manufacture a perception of "work being done" (dishonest).
**Recommended:** SHOULD prioritize perceived readiness of the primary content and defer non-essential loads.
**Non-obvious:** Honesty — a fake progress bar is a Tier-3 signal lie.
**Verify:** Immediate input acknowledgment; skeletons/progress reflect reality; no fabricated delays.
**Anti-pattern:** Spinner that outlasts the operation; fake "analyzing…" theatre; jank on the primary path.
**Exception:** Deliberate pacing for comprehension/safety (e.g., a brief review pause on a critical confirm) is allowed and stated honestly.

## DP-28 Information Hierarchy
**Purpose/Benefit:** Organize content so the most important information is found first; supports fast, correct decisions.
**Tier:** 5.
**Rules:**
- **DP-28.1 (MUST)** Content MUST be ordered and grouped by user priority and task relevance; the most decision-critical information MUST be most prominent and earliest.
- **DP-28.2 (MUST NOT)** MUST NOT bury cost, consent, safety, or eligibility information beneath lower-priority content.
**Recommended:** SHOULD structure with meaningful headings and groupings that map to user mental models.
**Non-obvious:** Accessibility — hierarchy MUST be conveyed structurally (headings/landmarks), not by visual weight alone (DP-5.2).
**Verify:** Priority order matches user needs; critical info surfaced; programmatic heading structure present.
**Anti-pattern:** Marketing above the actual answer; consent/fees at the bottom; flat undifferentiated content.
**Exception:** None for cost/consent/safety placement.

## DP-29 Visual Hierarchy
**Purpose/Benefit:** Use visual weight and grouping to guide the eye to the right thing in the right order; speeds comprehension. Achieved through restraint (C-16).
**Tier:** 8 (serving Tier 5 understanding).
**Rules:**
- **DP-29.1 (MUST)** Emphasis MUST be reserved for what matters most; there MUST be a single clear primary focus per view.
- **DP-29.2 (MUST NOT)** MUST NOT create hierarchy through excess (competing emphasis, visual noise, decoration); hierarchy comes from precision, spacing, and restraint.
- **DP-29.3 (MUST NOT)** MUST NOT rely on a visual cue alone to convey a state or action (DP-5.2).
**Recommended:** SHOULD achieve prominence through space and relationship before adding weight or ornament.
**Non-obvious:** Trust — visual over-emphasis on the profitable action erodes honesty; hierarchy must follow user priority, not business priority (Article 4).
**Verify:** One primary focus per view; emphasis maps to user priority; no meaning-by-visual-only; restraint evident.
**Anti-pattern:** Everything bold; a giant "Buy" dwarfing "Cancel"; decorative emphasis with no informational role.
**Exception:** Tier-8; yields to any higher tier (accessibility, clarity, honesty).

## DP-30 Navigation
**Purpose/Benefit:** Users always know where they are, how they got there, and how to get where they want; reduces disorientation and abandonment.
**Tier:** 5 (with Tier 1 for exits).
**Rules:**
- **DP-30.1 (MUST)** Current location, available destinations, and a way back MUST be evident at all times.
- **DP-30.2 (MUST NOT)** MUST NOT trap users; exit/back/home and safety exits MUST always be reachable (aligns DP-4.1).
- **DP-30.3 (MUST)** Navigation structure and labels MUST be consistent across the product (DP-15).
**Recommended:** SHOULD keep navigation shallow and predictable; support deep-linking to stable locations.
**Non-obvious:** Safety — no-exit navigation is a Tier-1 hazard, not just a UX flaw.
**Verify:** Location/back always present; no traps; consistent labels; safety exits reachable everywhere.
**Anti-pattern:** Modal with no close; hijacked back button; inconsistent menu across sections.
**Exception:** None for reachable exits.

## DP-31 Interaction
**Purpose/Benefit:** Every interactive element behaves clearly, predictably, and accessibly; the basic contract of touch/click/key/voice.
**Tier:** 5 (with Tier 4 accessibility binding).
**Rules:**
- **DP-31.1 (MUST)** Interactive elements MUST be perceivably distinct from non-interactive ones and MUST expose their state (enabled, disabled, selected, loading) to all users including AT.
- **DP-31.2 (MUST)** Interactions MUST be operable across input modalities (touch, pointer, keyboard, assistive, and where offered, voice) per DP-5.3.
- **DP-31.3 (MUST NOT)** MUST NOT depend on hover, precise timing, or complex gestures as the only way to perform an action.
**Recommended:** SHOULD provide equivalent simple alternatives for any advanced gesture.
**Non-obvious:** Inclusion — gesture-only or hover-only interactions exclude many users and devices.
**Verify:** Affordance and state clear and AT-exposed; multi-modality operable; no hover/gesture-only actions.
**Anti-pattern:** Invisible tap targets; hover-only menus; state shown by color only; mandatory multi-finger gestures.
**Exception:** Advanced gestures MAY exist as accelerators alongside a simple equivalent.

## DP-32 Motion
**Purpose/Benefit:** Motion clarifies change, relationship, and continuity; used with discipline it aids understanding, misused it distracts or harms.
**Tier:** 6–8 (serving Tier 5, bound by Tier 4).
**Rules:**
- **DP-32.1 (MUST)** Motion MUST serve a communicative purpose (orientation, continuity, feedback); decorative-only motion MUST be minimal and dismissible.
- **DP-32.2 (MUST)** The system MUST honor reduced-motion preferences and provide a non-motion equivalent; meaning MUST NOT depend on motion alone (DP-5.2).
- **DP-32.3 (MUST NOT)** MUST NOT use motion that risks discomfort or seizures, blocks interaction, or manufactures urgency/attention (DP-8).
**Recommended:** SHOULD keep motion brief, purposeful, and interruptible.
**Non-obvious:** Accessibility/wellbeing — motion is a vestibular and attention hazard; restraint is mandatory, not stylistic.
**Verify:** Every motion has a purpose; reduced-motion honored with equivalent; no blocking/urgency/hazard motion.
**Anti-pattern:** Attention-grabbing loops; motion that gates the safety control; parallax that induces discomfort; no reduced-motion path.
**Exception:** None to reduced-motion honoring or the no-meaning-by-motion-alone rule.

## DP-33 Microinteractions
**Purpose/Benefit:** Small, precise responses to user actions build a feeling of quality and confirm outcomes; restraint distinguishes premium from noisy.
**Tier:** 6–8.
**Rules:**
- **DP-33.1 (MUST)** Microinteractions MUST confirm a real outcome honestly (DP-13, DP-21) and MUST be consistent for the same action across the product.
- **DP-33.2 (MUST NOT)** MUST NOT over-celebrate, mislead, or add friction; MUST NOT fire on failure as if success.
**Recommended:** SHOULD be subtle, quick, and reserved for meaningful moments.
**Non-obvious:** Honesty — a delightful confirmation over a non-event is a signal lie.
**Verify:** Microinteractions map to real outcomes, consistent, subtle; none celebrate failure.
**Anti-pattern:** Confetti everywhere; haptic/animation on a no-op; inconsistent feedback for the same action.
**Exception:** None to honesty; intensity is a Tier-8 craft judgment.

## DP-34 Responsive Design
**Purpose/Benefit:** One coherent experience adapts to any viewport, input, capability, and orientation; ensures access across the device spectrum (India-first inclusion).
**Tier:** 5 (with Tier 4 inclusion binding).
**Rules:**
- **DP-34.1 (MUST)** All core tasks MUST be fully completable across the supported range of screen sizes, orientations, input types, and capabilities without loss of content or function.
- **DP-34.2 (MUST NOT)** MUST NOT hide essential functionality or content on smaller/constrained devices.
- **DP-34.3 (MUST)** Layouts MUST reflow without horizontal scrolling or clipping at supported zoom/scaling (aligns DP-5.4).
**Recommended:** SHOULD design mobile-first and enhance upward; test on low-end devices.
**Non-obvious:** Inclusion — content parity across devices is a Tier-4 equity issue.
**Verify:** Task completion across breakpoints/inputs; content parity; reflow without clipping at zoom.
**Anti-pattern:** "Use desktop for this"; features stripped on mobile; fixed layouts that clip at zoom.
**Exception:** Truly device-specific hardware features MAY be conditionally available; core tasks remain universal.

## DP-35 Internationalization
**Purpose/Benefit:** Architect for multiple languages, scripts, numerals, directions, and formats from the start; enables global and India-multilingual reach without rework. (C-9)
**Tier:** 4.
**Rules:**
- **DP-35.1 (MUST)** All user-facing text MUST be externalized and localizable; layouts MUST accommodate text expansion, RTL/LTR, and script-specific typography.
- **DP-35.2 (MUST NOT)** MUST NOT hard-code language, date/number/currency formats, sort orders, or name/address structures.
- **DP-35.3 (MUST)** Locale-specific formats (numerals, dates, currency, units) MUST render per the user's locale.
**Recommended:** SHOULD pseudo-localize and RTL-test as part of standard review.
**Non-obvious:** Dignity — mono-locale assumptions signal exclusion and violate the no-single-language rule (Tier 4).
**Verify:** No hard-coded strings/formats; pseudo-loc and RTL pass; locale formatting correct.
**Anti-pattern:** Concatenated sentence fragments; fixed-width labels; MM/DD/YYYY forced globally; Latin-only assumptions.
**Exception:** Staged locale rollout allowed; each released locale MUST fully comply.

## DP-36 Cross-Cultural Design
**Purpose/Benefit:** Respect cultural meaning, norms, and sensitivities across India's plurality and global audiences; prevents offense and exclusion, builds belonging.
**Tier:** 4.
**Rules:**
- **DP-36.1 (MUST NOT)** MUST NOT encode a single culture's norms, imagery, colors-as-meaning, gestures, names, or family structures as universal defaults.
- **DP-36.2 (MUST NOT)** MUST NOT associate worth, trust, or desirability with complexion, caste, religion, region, or language in imagery, ordering, defaults, or copy (C-3).
- **DP-36.3 (MUST)** Culturally sensitive content MUST be reviewed with relevant-community input before release.
**Recommended:** SHOULD offer plural representations and avoid a single aspirational default.
**Non-obvious:** Honesty/dignity — culturally-coded value judgments are simultaneously Tier-3 and Tier-4 violations.
**Verify:** No single-culture universal defaults; no social-attribute value encoding; sensitive content community-reviewed.
**Anti-pattern:** Assuming one name format; complexion-graded imagery; region/religion as a proxy for trust.
**Exception:** None to DP-36.2 (non-inference).

## DP-37 Premium Experience (Restraint)
**Purpose/Benefit:** Convey quality and trust through precision, consistency, typography, spacing, hierarchy, and motion discipline — never through visual excess; premium restraint reinforces credibility. (C-16)
**Tier:** 8 (in service of Tiers 3, 5, 6).
**Rules:**
- **DP-37.1 (MUST)** Perceived quality MUST be pursued through restraint — precision, consistency, spacing, typographic and motion discipline — not through ornamentation, density of effects, or novelty.
- **DP-37.2 (MUST NOT)** MUST NOT add decorative visual load, effects, or flourish that do not serve understanding, and MUST NOT let "premium" styling reduce accessibility, clarity, or honesty.
**Recommended:** SHOULD remove ornament until only the functional and the essential remain.
**Non-obvious:** Accessibility/honesty — "luxury" low-contrast, tiny type, or theatrical effects violate higher tiers and are prohibited regardless of aesthetic intent.
**Verify:** Quality traceable to systemic precision, not effects; no accessibility/clarity/honesty regression in the name of style.
**Anti-pattern:** Low-contrast "elegant" text; heavy animation as "premium"; ornament over information.
**Exception:** Tier-8; always yields to Tiers 1–7 — restraint may never override accessibility, clarity, or honesty.

## DP-38 Scalability
**Purpose/Benefit:** Patterns and systems accommodate growth in content, features, locales, and users without redesign or degradation; protects consistency and cost over time.
**Tier:** 7 (serving long-term Tier 5 and 8).
**Rules:**
- **DP-38.1 (MUST)** Patterns MUST be defined as reusable, parameterized system rules that hold as content volume, feature count, and locales grow.
- **DP-38.2 (MUST NOT)** MUST NOT design solutions that only work at current small scale (e.g., layouts that break with long content, large lists, or many locales).
**Recommended:** SHOULD validate patterns against extreme content (longest, most, empty, and zero cases).
**Non-obvious:** Honesty — empty/overflow/zero states MUST be designed truthfully (DP-13, DP-21), not assumed away.
**Verify:** Patterns handle min/max/empty content and multi-locale; no fixed assumptions that break at scale.
**Anti-pattern:** Layouts assuming short strings; hard limits with no overflow handling; designs untested for empty/large states.
**Exception:** Tier-7; yields to higher tiers where a scale optimization would harm clarity/accessibility.

## DP-39 Maintainability
**Purpose/Benefit:** The design system is built from documented, systemic rules — not one-off screens — so it can be understood, changed, and governed over time at low cost. (C-17 longevity)
**Tier:** 7.
**Rules:**
- **DP-39.1 (MUST)** New solutions MUST be expressed as reusable system rules/components with a permanent identifier and rationale, not bespoke one-off screens.
- **DP-39.2 (MUST NOT)** MUST NOT duplicate or fork existing patterns without documented justification and a deprecation plan for the divergence.
- **DP-39.3 (MUST)** Every non-obvious design decision MUST be recorded with its rationale and the tier/principle it serves (decision log).
**Recommended:** SHOULD consolidate divergent patterns toward a single canonical rule over time.
**Non-obvious:** Governance — undocumented one-offs erode consistency (DP-15) and auditability across the whole system.
**Verify:** New work maps to system rules; divergences justified with a plan; decision log present and current.
**Anti-pattern:** Copy-paste screen variants; undocumented "special cases"; tribal-knowledge-only decisions.
**Exception:** Time-boxed experiments MAY diverge if labeled, logged, and scheduled for reconciliation.

## DP-40 Future-Proof Design
**Purpose/Benefit:** Decisions favor durability and additive evolution over trend-chasing; the system strengthens guarantees over time without breaking users or lowering Tier 1-4 floors. (C-17, SHIG-0001 additive-first)
**Tier:** 7–8.
**Rules:**
- **DP-40.1 (MUST)** Design evolution MUST be additive-first and backward-compatible in guarantees; Tier 1-4 guarantees MUST only be strengthened, never lowered.
- **DP-40.2 (MUST NOT)** MUST NOT adopt transient trends, novelty, or platform fashions at the expense of consistency, accessibility, honesty, or longevity.
- **DP-40.3 (MUST)** Changes MUST be versioned and follow the lifecycle and semantic-versioning rules of SHIG-0001.
**Recommended:** SHOULD prefer timeless, principle-derived solutions over fashionable ones.
**Non-obvious:** Governance — a "modern redesign" that lowers a Tier 1-4 floor is prohibited by constitutional invariant.
**Verify:** Changes are additive/versioned; no Tier 1-4 floor reduced; no trend-driven regressions in accessibility/consistency/honesty.
**Anti-pattern:** Ground-up rewrites chasing fashion; removing an accessibility/consent guarantee for a new look; unversioned breaking change.
**Exception:** None to the no-lowering-Tier-1-4 rule (constitutional).

---

# 3. Decision Framework (Conflict & Tradeoff Resolution)

## 3.1 Governing rule
When two or more principles suggest conflicting solutions, resolution is **strictly lexicographic by SHIG-0000 Article 4**. A gain at a lower tier NEVER justifies a loss at a higher tier. There is no weighting, no averaging, no "net benefit" across tiers. (DP-decision references Article 4 exclusively; it does not create a competing order.)

## 3.2 Tier order (from the Constitution, for reference only — authoritative text is SHIG-0000)
1 Safety & legality ▸ 2 Consent & privacy ▸ 3 Honesty of signal ▸ 4 Human dignity & inclusion ▸ 5 Understanding & task success ▸ 6 Emotional wellbeing & calm ▸ 7 Consistency ▸ 8 Craft & aesthetics ▸ 9 Business & growth.

## 3.3 Resolution procedure (apply in order)
| Step | Action | Outcome |
|---|---|---|
| 1 | Identify the highest Article 4 tier any candidate solution would **harm**. | The solution that avoids the highest-tier harm wins outright. |
| 2 | If solutions are tied at the highest harmed tier, choose the one that best **serves** the higher tier. | Lower-tier gains are irrelevant to this choice. |
| 3 | If still tied, apply the next tier down as tie-breaker, and so on. | Continue lexicographically. |
| 4 | Only when all higher tiers are equal do craft (8) and business (9) considerations decide. | Aesthetics/growth are last, never first. |
| 5 | Record the decision, the tiers in tension, and the chosen resolution in the decision log (DP-39.3). | Auditable rationale. |

## 3.4 Non-compromisable principles (enforce Tier 1–4 = Tier 1-4 guarantees)
The MUST/MUST NOT rules in **DP-2 (trust/fail-secure), DP-3 (privacy/consent), DP-4 (safety), DP-5 (accessibility floor), DP-6 (inclusion/non-inference), DP-11 (ethical AI: labeling/honesty/non-inference/human-override), DP-12 (transparency), DP-13 (honesty), DP-35 (i18n), DP-36 (cross-cultural non-inference), and DP-40.1 (no-lowering)** are non-compromisable. They may only be strengthened, never weakened, and no lower-tier benefit (understanding, calm, consistency, craft, business) may justify their breach. A proposed exception to any of these is **out of order** and MUST be rejected.

## 3.5 Deviation discipline for SHOULD-level rules
A SHOULD/SHOULD NOT deviation is permitted only with a recorded justification that names the specific higher Article 4 tier the deviation serves (SHIG-0001). A deviation that serves only a lower or equal tier is not permitted. MUST/MUST NOT rules admit no deviation except where this document explicitly states a narrow, documented exception (and never for Tier 1–4 rules).

## 3.6 Fail-secure default
Where trust, consent, safety, or authenticity state is unknown, ambiguous, failed, or timed out, the interface MUST render the **safer / lesser** state: unknown trust = *unverified*; ambiguous/failed consent = *not consented*; ambiguous safety decision = *safer default*. Uncertainty never resolves in favor of engagement, growth, or optimistic display.

# 4. Quality Governance

## 4.1 Measurable quality standards (a release MUST meet all)
| Dimension | Standard | Verification |
|---|---|---|
| Accessibility | WCAG 2.2 AA, zero criterion failures; no meaning-by-color/position/motion alone | Automated scan + manual keyboard/AT audit |
| Honesty of signal | Zero fabricated data/states; all inference labeled; states truthful | Content/state audit against DP-13/DP-21 |
| Consent & privacy | Every field justified; consent opt-in/scoped/revocable; no covert data | Data inventory + consent-flow audit against DP-3 |
| Safety | Exit/cancel/report reachable; destructive actions guarded; safe defaults | Flow traversal against DP-4 |
| Non-inference | No social-attribute inference in imagery, order, defaults, copy, or AI | Review against DP-6.4/DP-11.4/DP-36.2 |
| Inclusion/i18n | Pseudo-loc + RTL pass; core tasks on low-bandwidth/low-end device | Localization + constrained-device test |
| Consistency | No unjustified pattern/terminology divergence | System audit against DP-15/DP-39 |
| Restraint/clarity | Single primary focus per view; no purposeless element or ornament | Review against DP-17/DP-29/DP-37 |
| Traceability | Every artifact maps to a user goal + evidence; decisions logged | Decision-log audit against DP-1/DP-39 |

## 4.2 Review methodology
1. **Tier scan (top-down):** Check Tier 1–4 conformance first; any failure blocks release regardless of other merits. 2. **Principle checklist:** Apply the §5 checklist per surface. 3. **Evidence check:** Confirm user-goal traceability and decision log. 4. **Verification, not opinion:** Findings MUST cite a rule ID and a verifiable observation (C-17 evidence-over-opinion). 5. **Sign-off:** Reviewer records rule IDs checked, results, and any logged SHOULD-deviations.

## 4.3 Rejection criteria (any one blocks release)
- Any Tier 1–4 (non-compromisable) MUST/MUST NOT rule fails (§3.4).
- WCAG 2.2 AA failure, or meaning conveyed by color/position/motion alone.
- Fabricated data/state, unlabeled inference, or a success shown before actual success.
- Consent not opt-in/scoped/revocable, covert data collection, or fail-open on ambiguous consent/trust/safety.
- Any social-attribute inference of character/worth/trust.
- Unreachable/obstructed safety or exit control.
- A change that lowers any Tier 1-4 guarantee (DP-40.1).
- Unrecorded SHOULD-deviation, or a deviation justified only by a lower/equal tier.

## 4.4 Design-audit methodology (periodic, product-wide)
Sample surfaces across locales, devices, and flows; run the §4.1 verifications; log every finding against a rule ID with severity = highest tier harmed; track remediation to closure; feed recurring findings back into system rules (DP-39) so the class of defect is prevented, not just fixed.

## 4.5 Continuous improvement
Improvement MUST be additive-first and MUST only strengthen Tier 1-4 guarantees (DP-40, SHIG-0001). Recurring audit findings SHOULD be converted into stronger MUST rules or new system patterns via the amendment process. All changes are versioned (MAJOR.MINOR.PATCH) and pass through the Draft→Review→Active lifecycle; no change may retroactively weaken an Active Tier 1-4 guarantee.

# 5. Compliance / Review Checklist

Per surface/flow, confirm and record the rule IDs:
- [ ] **Tier 1–4 first:** DP-4 safety/exit reachable · DP-3 consent opt-in/scoped/revocable + no covert data · DP-13/DP-11 honesty + AI labeled, no inference-as-fact · DP-5 WCAG 2.2 AA + no color/position/motion-alone · DP-6/DP-36 no social-attribute inference · DP-2 fail-secure trust state.
- [ ] **Understanding (Tier 5):** DP-1 goal + evidence · DP-16 clarity · DP-17 simplicity · DP-18 progressive disclosure (no cost/consent/safety deferred) · DP-19 load bounded · DP-20 recognition · DP-21 honest feedback/status · DP-22 error prevention · DP-23 recoverable errors · DP-24 undo/revocable · DP-28 information hierarchy · DP-30 navigation/no-trap · DP-31 multi-modal interaction · DP-34 responsive parity · DP-35 i18n.
- [ ] **Calm & relationship (Tier 6):** DP-7 no dark emotion · DP-8 no urgency/compulsion, quiet defaults · DP-9 real user success honored · DP-10 conversation consent/context · DP-27 honest performance perception.
- [ ] **Consistency & craft (Tiers 7–8):** DP-14 predictable · DP-15 consistent · DP-29 restrained visual hierarchy · DP-32 purposeful motion + reduced-motion · DP-33 honest microinteractions · DP-37 premium-through-restraint · DP-38 scalable · DP-39 maintainable/logged · DP-40 additive/versioned.
- [ ] **Decision integrity:** conflicts resolved lexicographically (§3); all SHOULD-deviations logged with the higher tier served; decision log current.

# 6. Anti-patterns (Index)

| # | Anti-pattern | Violates |
|---|---|---|
| A1 | Wall-first: sign-up/payment before any value | DP-2 |
| A2 | Default "verified"/unbacked trust badges | DP-2, DP-13 |
| A3 | Pre-checked/bundled consent; prominent accept, buried reject | DP-3 |
| A4 | Covert data collection / dark telemetry | DP-3 |
| A5 | Hidden or friction-laden cancel/exit/report; confirm-shaming | DP-4 |
| A6 | Meaning by color/position/motion alone | DP-5, DP-29, DP-32 |
| A7 | Icon-only controls without names; focus traps; disabled zoom | DP-5, DP-30 |
| A8 | Single-language/device/bandwidth assumption | DP-6, DP-34, DP-35 |
| A9 | Inferring worth/trust from complexion/caste/religion/region/language | DP-6, DP-11, DP-36 |
| A10 | Manufactured fear/shame/FOMO; fake urgency/scarcity/streak pressure | DP-7, DP-8, DP-13 |
| A11 | Attention-seeking motion/notifications by default | DP-8, DP-32 |
| A12 | Retention nudges against the user's real goal | DP-9 |
| A13 | Bot posing as human; unlabeled AI; inference-as-fact scores | DP-10, DP-11, DP-13 |
| A14 | Hidden fees/terms/automation; late disclosure | DP-12, DP-18, DP-28 |
| A15 | Fabricated activity/reviews/data; premature "success" | DP-13, DP-21 |
| A16 | Swapping/relabeling controls between steps | DP-14 |
| A17 | Redundant divergent patterns / novelty for its own sake | DP-15, DP-39 |
| A18 | Euphemism/jargon for cost/delete/share/consent | DP-16 |
| A19 | Kitchen-sink clutter; decorative complexity | DP-17, DP-29, DP-37 |
| A20 | Re-entering known data; memory hand-offs across steps | DP-19, DP-20 |
| A21 | Destructive action with no confirm/undo | DP-22, DP-24 |
| A22 | "Something went wrong"; cleared forms; dead-end errors | DP-23 |
| A23 | Forced single path; power features mouse/gesture-only | DP-25, DP-31 |
| A24 | Engagement/upsell friction inserted mid-task; artificial delays | DP-26, DP-27 |
| A25 | Fake progress/"analyzing" theatre | DP-27 |
| A26 | Everything emphasized; profitable action visually dominating safe action | DP-28, DP-29 |
| A27 | Confetti/haptics on no-ops or failures | DP-33 |
| A28 | "Use desktop for this"; features stripped on mobile | DP-34 |
| A29 | Hard-coded strings/formats; fixed-width labels clipping translations | DP-35 |
| A30 | Single-culture universal defaults; complexion-graded imagery | DP-36 |
| A31 | Low-contrast/tiny "premium" styling; ornament over information | DP-37 |
| A32 | Layouts that break on long/empty/large content | DP-38 |
| A33 | Undocumented one-off screens; tribal-knowledge decisions | DP-39 |
| A34 | Trend-driven rewrite that lowers a Tier 1-4 guarantee | DP-40 |

# 7. Open Questions

| # | Question | Provisional handling until resolved |
|---|---|---|
| OQ-1 | Quantified thresholds (perceptible-instant, undo-window, step-count ceilings) belong in a downstream metrics spec. | Apply qualitative rules; use platform-conventional thresholds; log choices (DP-39). |
| OQ-2 | Canonical taxonomy of "consequential" AI decisions requiring human override (DP-11.3). | Treat rights/safety/money/reputation impact as consequential by default (fail-secure). |
| OQ-3 | Governance for community review panels for culturally sensitive content (DP-36.3). | Require documented relevant-community input before release; formalize later. |
| OQ-4 | Standard evidence bar per risk level for DP-1 traceability. | Scale evidence to risk; record rationale; never below the dignity floor. |
| OQ-5 | Interaction between genuine factual urgency (DP-8 exception) and calm defaults across verticals. | Show only verifiable real time-limits, stated as fact; never fabricated. |

# Revision History

| Version | Date | Status | Author | Summary |
|---|---|---|---|---|
| 1.0.0 | 2026-07-26 | Active | Chief Design Officer | Initial issuance of SHIG-0004 Design Principles Specification. Establishes permanent principles DP-1…DP-40 with mandatory rules, recommended practices, verification and exceptions; spec-level Decision Framework (bound to SHIG-0000 Article 4 lexicographic hierarchy and fail-secure), Quality Governance, Compliance Checklist, Anti-pattern index, and Open Questions. Subordinate to and consistent with SHIG-0000 and SHIG-0001; Tier 1-4 guarantees defined as non-compromisable and strengthen-only. |
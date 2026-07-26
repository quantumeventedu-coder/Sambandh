# Specification ID

SHIG-0012

# Specification Name

Interaction Design System Specification

# Version

1.0.0

# Status

Active

---

## 1. Purpose

**IX-1** (MUST) This specification defines the universal, implementation-independent interaction principles governing every user-system exchange in Sambandh: how actions are initiated, acknowledged, progressed, completed, recovered, reversed, and learned. It governs *behavior over time*, not screens, components, or styling.

**IX-2** (MUST) All interaction design MUST conform to SHIG-0000 Article 4 lexicographic hierarchy. Where interaction goals conflict, the higher tier wins and the deviation MUST be recorded citing the tier (SHIG-0001). No efficiency, engagement, or business gain (Tier 9) may override Safety (1), Consent/privacy (2), Honesty-of-signal (3), or Dignity (4).

**IX-3** (MUST) This spec operationalizes immutable principles C-1..C-17. Every rule herein is a Tier-appropriate expression of at least one C-principle and MUST NOT be interpreted to weaken it.

## 2. Scope

**IX-4** (MUST) Applies to all interactive surfaces, modalities, automation, and AI assistance across the Sambandh ecosystem, present and future — marketplace, consultation, verification, membership, gift pass, community, messaging, and account lifecycle.

**IX-5** (MUST NOT) This spec MUST NOT prescribe colors, hex, fonts, spacing, component names, framework, or platform. Those belong to downstream visual/component specs, which MUST NOT contradict IX rules.

**IX-6** (MUST) Where a downstream spec, platform convention, or vendor default conflicts with an IX rule, the IX rule governs unless a higher-tier obligation compels deviation, recorded per SHIG-0001.

## 3. Interaction Philosophy

**IX-7** (MUST) Interactions MUST be **predictable, intuitive, accessible, trustworthy, efficient, emotionally intelligent, and consistent** — in that priority order when they conflict, except that accessibility and trust (Tiers 1-4) are never traded for efficiency (Tier 5) or calm-vs-speed craft (Tiers 6-8).

**IX-8** (MUST) The system MUST be an *assistant, not an authority* (C-13). It proposes; the user disposes. Every consequential outcome MUST be attributable to a user decision or an explicit, disclosed, reversible system default.

**IX-9** (MUST) Interactions MUST favor **calm over stimulation** (C-11): no urgency manufactured to drive action, no artificial scarcity, no interruption without cause the user would endorse.

**IX-10** (MUST) The system MUST be **relationship-first, not metric-first** (C-12): no interaction pattern may be justified solely by its effect on engagement, session count, or conversion.

**IX-11** (MUST NOT) The system MUST NOT infer or act on identity-linked attributes — appearance, complexion, caste, religion, region, language — to shape interaction, ranking, defaults, or friction (C-3, NON-INFERENCE).

## 4. Human-System Collaboration

**IX-12** (MUST) The human MUST retain control of intent, pace, and outcome. The system MUST NOT auto-advance irreversible or consent-touching steps without an explicit user act (C-7, C-4).

**IX-13** (MUST) The division of labor MUST be legible: the user MUST always be able to tell what the system did automatically versus what the user chose.

**IX-14** (SHOULD) The system SHOULD reduce user effort on reversible, low-stakes, high-confidence tasks (smart defaults, prefill) while preserving one-step correction. Deviation toward more friction on such tasks needs recorded justification.

**IX-15** (MUST) Collaboration MUST degrade gracefully: if automation is uncertain, the system MUST hand control to the user rather than guess on consequential actions (fail-secure).

## 5. Respectful Interaction (C-4, C-8, C-11)

**IX-16** (MUST) The system MUST address the user with dignity: no shaming, coercion, dark patterns, guilt copy, or manipulative defaults in any flow, including offboarding.

**IX-17** (MUST) Attention MUST be treated as consented: interruptions (modals, prompts, notifications) MUST be justified by user-relevant cause, MUST be dismissible, and MUST NOT reappear unchanged without new cause.

**IX-18** (MUST NOT) The system MUST NOT use confirmshaming, pre-checked consent, obstructed exits, roach-motel flows (easy in, hard out), or forced continuity.

**IX-19** (MUST) Cognitive and emotional load MUST be minimized at sensitive moments (verification, reporting, blocking, offboarding, grief/rejection contexts): plain language, no upsell, no metric framing.

## 6. Trust Through Interaction (C-1, C-2, C-16)

**IX-20** (MUST) Trust MUST precede engagement (C-1): the system MUST establish what it is, what it will do, and what it needs *before* requesting data or consequential action.

**IX-21** (MUST) Every state the system displays MUST be **honest** (C-15): loading is not fake progress, "verified" means verified, "sent" means delivered to the transport, "saved" means persisted. Unknown states MUST be shown as unknown, never optimistically.

**IX-22** (MUST) Under uncertainty, the system MUST fail secure: unknown trust renders as **unverified**; ambiguous consent renders as **not-consented** (SHIG-0000).

**IX-23** (MUST) The system MUST NOT overstate certainty, authority, or endorsement in any interaction affordance, label, or AI output (C-2 honesty-of-signal).

## 7. Predictability (C-16)

**IX-24** (MUST) Identical controls MUST produce identical outcomes across contexts, sessions, and surfaces. A control's effect MUST match its signifier.

**IX-25** (MUST) Actions MUST NOT produce hidden side effects. Every consequence a control causes MUST be discoverable from the control before or at the moment of action.

**IX-26** (MUST) Navigation MUST be predictable: the system MUST NOT relocate the user unexpectedly; context changes MUST be user-initiated or clearly announced with a return path.

**IX-27** (SHOULD) The system SHOULD preview consequential outcomes ("this will notify X", "this deletes N items") before commitment.

## 8. User Agency & Autonomy (C-7, C-13)

**IX-28** (MUST) The user MUST be able to start, pause, resume, cancel, or abandon any multi-step task without losing prior valid input (state preservation).

**IX-29** (MUST) The user MUST be able to override any system suggestion, default, ranking, or AI recommendation. Override MUST be always available and never penalized.

**IX-30** (MUST) The user MUST control the pace: no countdown-forced decisions except where an external constraint (payment authorization window, security timeout) requires it, and such constraints MUST be disclosed with their reason.

**IX-31** (MUST) Consent MUST be granular and revocable (C-4): granting one permission MUST NOT bundle unrelated permissions; revocation MUST be as easy as granting.

## 9. Transparency (C-13, C-15)

**IX-32** (MUST) The system MUST disclose *what* it is doing, *why*, and *with what data* at the moment it matters, in plain language.

**IX-33** (MUST) Automated and AI-generated content, decisions, and suggestions MUST be labeled as such (C-13). Human and machine origin MUST be distinguishable.

**IX-34** (MUST) The system MUST make its current state, permissions, and data usage inspectable on demand without dark corners.

**IX-35** (MUST NOT) The system MUST NOT hide fees, obligations, notification effects, or data sharing until after commitment.

## 10. Progressive Learning & Disclosure

**IX-36** (MUST) Complexity MUST be revealed progressively: primary paths MUST be usable without advanced knowledge; advanced capability MUST be discoverable, not forced.

**IX-37** (SHOULD) The system SHOULD teach in context (just-in-time guidance) rather than upfront tutorials, and SHOULD let users skip and later re-find guidance.

**IX-38** (MUST) Onboarding MUST NOT gate core value behind excessive setup; required steps MUST be limited to those with a stated present necessity (safety, consent, legality).

**IX-39** (MUST) Learnability MUST rely on **recognition over recall** (IX-58): the system MUST NOT require users to remember information the system can surface.

## 11. Consistency (C-16)

**IX-40** (MUST) Interaction patterns MUST be consistent across surfaces, modalities, and platforms: same gesture/verb → same result.

**IX-41** (MUST) Terminology for actions and states MUST be uniform ecosystem-wide; one concept has one name.

**IX-42** (SHOULD) The system SHOULD prefer established platform conventions over novel interactions; novelty needs recorded justification citing a user-benefit that consistency cannot deliver (consistency over novelty, Tier 7 vs 8).

## 12. Simplicity (C-14)

**IX-43** (MUST) Every task MUST use the minimum number of required steps; steps whose only purpose is engagement, upsell, or metric capture MUST be removed.

**IX-44** (MUST) Premium is achieved **through restraint** (C-14): the system MUST NOT add motion, decoration, or interaction that does not serve understanding, safety, or task success.

**IX-45** (SHOULD) Defaults SHOULD be the safe, private, reversible choice (C-6, C-7), requiring no user action for the protective outcome.

## 13. Error Tolerance, Prevention & Recovery (C-7)

**IX-46** (MUST) The system MUST prevent errors before relying on recovery: constraints, validation, and disabled-with-reason states MUST make invalid actions hard to commit.

**IX-47** (MUST) Errors MUST be recoverable: the user MUST be able to correct input without restarting a task, and MUST retain valid prior entries.

**IX-48** (MUST) Error messages MUST state what happened, why, and the next action, in plain non-blaming language, without exposing system internals or the user's sensitive data.

**IX-49** (MUST) Destructive or irreversible actions MUST require explicit confirmation AND provide reversibility (undo, grace period, or restore) wherever technically possible (C-7). Where true irreversibility is unavoidable, the system MUST state this explicitly before commitment.

**IX-50** (MUST) Reversible actions SHOULD favor **undo over confirmation dialogs**; confirmation MUST be reserved for the irreversible or the consequential, to avoid confirmation fatigue.

## 14. Human Control (C-13)

**IX-51** (MUST) The human MUST be able to stop, interrupt, or reverse any system or AI process that affects them.

**IX-52** (MUST NOT) The system/AI MUST NOT take control of a decision reserved to the user, MUST NOT act on the user's behalf toward third parties (messaging, sharing, purchasing, connecting) without explicit per-instance authorization.

**IX-53** (MUST) A human-assistance / escalation path MUST be reachable from any point where the system cannot serve the user, especially safety-relevant contexts (C-5 safety-reachable).

## 15. AI Collaboration (C-13)

**IX-54** (MUST) AI is **assistance, not authority** (C-13). AI outputs MUST be presented as suggestions the user evaluates, never as final decisions imposed on the user.

**IX-55** (MUST) AI MUST communicate confidence honestly (IX-21): uncertainty MUST be shown, not hidden; the system MUST NOT present low-confidence output with high-confidence framing.

**IX-56** (MUST) AI MUST offer, on request, a plain-language explanation of *why* a suggestion was made, in terms the user can act on, without fabricating rationale (C-17 evidence-over-opinion).

**IX-57** (MUST) AI operation MUST be consent-bounded and privacy-preserving (C-4, C-6): AI MUST NOT use data beyond the consented purpose, and MUST NOT infer protected attributes (C-3). **USER OVERRIDE MUST always be available** (IX-29). AI MUST NOT take control (IX-52).

## 16. Core Interaction Principles

**IX-58** (MUST) **Recognition over recall** — surface choices and prior context rather than requiring memory.
**IX-59** (MUST) **Direct manipulation** — objects respond to direct action where feasible; effects are visible on the object.
**IX-60** (MUST) **Immediate feedback** — every user action MUST receive perceptible acknowledgement within the responsiveness budget (§19).
**IX-61** (MUST) **Affordances & signifiers** — interactive elements MUST look actionable; non-interactive elements MUST NOT; signifiers MUST accurately indicate the resulting action.
**IX-62** (MUST) **Constraints** — the system MUST constrain input to valid options where possible, preventing rather than reporting errors.
**IX-63** (MUST) **Natural mapping** — control layout and behavior MUST map intuitively to their effects; opposite actions MUST be clearly distinguishable to prevent slips.
**IX-64** (MUST) **Progressive disclosure** — show what is needed now; reveal more on demand (IX-36).
**IX-65** (MUST) **Forgiveness** — safe exploration; reversibility as the default posture (C-7).
**IX-66** (MUST) **Interruptibility** — long or multi-step operations MUST be pausable/cancelable without corruption or data loss.
**IX-67** (MUST) **Persistence & state preservation** — in-progress work, drafts, and navigation context MUST survive interruption, refresh, and reasonable session breaks.
**IX-68** (MUST) **Context awareness** — the system MUST adapt to device, modality, and prior user context without inferring protected attributes (C-3).
**IX-69** (MUST) **Task continuity** — a task begun on one device/modality SHOULD be resumable on another; deviation needs recorded justification.
**IX-70** (MUST) **Perceived performance** — the system MUST manage perception honestly (skeletons/optimistic UI) without faking completion or success (IX-21).
**IX-71** (MUST) **Efficiency** — frequent tasks MUST have short paths; shortcuts and accelerators SHOULD exist for experienced users without harming novice discoverability.
**IX-72** (MUST) **Discoverability** — capabilities MUST be findable through exploration; hidden interactions with no signifier are prohibited (see Anti-patterns).
**IX-73** (MUST) **Predictability & confidence** — outcomes match expectations (§7); the user should feel sure of what will happen before acting.
**IX-74** (MUST) **Cross-platform / cross-device consistency** — equivalent capability and behavior across platforms; feature and safety parity MUST NOT be reduced on any supported platform.

## 17. User Action Framework

**IX-75** (MUST) Every user action MUST satisfy its row below. Two cross-cutting rules bind all rows: **(a)** destructive/irreversible actions MUST require confirmation + reversibility (C-7, IX-49); **(b)** consent-touching actions MUST use the consent pattern — explicit, granular, revocable, fail-closed to not-consented (C-4, IX-31, IX-22).

| Action | Expected user intent | Expected system behavior | Feedback requirement | Error handling | Success criteria | Recovery |
|---|---|---|---|---|---|---|
| **Viewing** | Perceive content/state | Render honest current state; no hidden mutation | Loading/empty/error states honest | Show cause + retry on load fail | Correct state perceived | Reload without data loss |
| **Reading** | Comprehend | Legible, paced, no forced interruption | Position/progress persisted | Recover scroll/position | Content understood | Restore reading position |
| **Searching** | Find known item | Fast, forgiving query; no protected-attribute weighting (C-3) | Result count, latency honest | Zero-result guidance, spelling tolerance | Target found efficiently | Refine without re-entry |
| **Discovering** | Explore options | Relevant, plural, non-manipulative surfacing (C-9, C-12) | Why-surfaced available on request | Graceful empty state | Meaningful options seen | Return to prior view |
| **Selecting** | Choose item(s) | Clear selection state; reversible | Selection visibly reflected | Prevent invalid selection | Intended items selected | Deselect/clear easily |
| **Comparing** | Weigh options | Equivalent, honest attributes side-by-side | Differences legible non-color-alone | Handle missing data honestly | Informed choice | Adjust comparison set |
| **Creating** | Author content/profile | Save drafts continuously; validate inline | Save state honest (IX-21) | Preserve input on error | Artifact created as intended | Restore draft |
| **Editing** | Modify | Show diff/current vs new; reversible | Change acknowledged | Prevent conflicting edits (§18) | Change applied correctly | Undo/revert |
| **Deleting** | Remove | **Confirm + reversible** (grace/restore) (C-7) | State transition shown | Block accidental/batch overreach | Item removed, restorable | Undo/restore within window |
| **Saving** | Persist | Persist and confirm persistence honestly | "Saved" only when persisted | Retry/queue on failure; never silent loss | Data durable | Recover unsaved via draft |
| **Sharing** | Disclose to others | **Consent + scope preview** before disclosure (C-4) | Recipients/scope shown pre-commit | Block over-broad share | Shared to intended scope | Revoke share |
| **Inviting** | Bring in a person | Explicit per-invite authorization; no auto-contact-harvest | Who/what will be sent shown | Prevent unintended mass invite | Invite sent to intended | Cancel pending invite |
| **Messaging** | Communicate | Send only on explicit act; delivery state honest | Sent/delivered/read honest, consent-bounded | Retry/queue offline; no silent drop | Message delivered | Edit/retract per policy |
| **Calling** | Real-time contact | Explicit initiate/accept; safety + consent | Ringing/connected/ended states honest | Graceful failure, escalation path | Call connected/ended cleanly | Reconnect / report |
| **Scheduling** | Reserve time | Confirm slot, timezone-honest, reversible | Booked state + reminders (consented) | Conflict detection (§18) | Slot reserved | Reschedule/cancel |
| **Purchasing** | Pay for value | **Full cost + terms before commit** (C-2); explicit confirm | Order/payment state honest | No double-charge; clear decline reason | Purchase complete, receipt | Refund/dispute path |
| **Membership Mgmt** | Control plan | Transparent terms; easy downgrade/cancel (no roach-motel) | Current plan/renewal honest | Prevent accidental tier change | Plan reflects intent | Reverse within window |
| **Gift Pass Redemption** | Redeem code | One-time redeem; clear grant; consent to link | Redeemed/invalid/used states honest | Block double-redeem; clear expiry msg | Grant applied once | Support path if failed |
| **Verification** | Prove trust attribute | Consent to data; fail-closed to unverified (C-2, IX-22) | Pending/verified/failed honest, never faked | No protected-attribute inference (C-3) | Attribute verified truthfully | Re-submit / appeal |
| **Uploading** | Provide file/data | Consent to use/scope; progress honest | Progress/complete/fail states | Resume/retry; validate before commit | Upload stored as intended | Re-upload / remove |
| **Downloading** | Obtain data | Deliver user's own/authorized data | Progress + completion honest | Retry on failure | File delivered intact | Re-download |
| **Reporting** | Flag harm | Low-friction, private, safety-prioritized (Tier 1) | Receipt + status honest | Never lose a report; escalate | Report received, actioned | Follow-up channel |
| **Blocking** | Stop contact | Immediate effect; private to actor | Block confirmed, effective now | No leakage to blocked party | Contact severed | Unblock reversible |
| **Following** | Track interest | Explicit opt-in; reversible; consent-bounded | Follow state shown | Prevent accidental follow | Following as intended | Unfollow easily |
| **Customizing** | Adjust UI/behavior | Apply + persist; reversible to default | Change reflected | Prevent broken states | Preference applied | Reset to default |
| **Personalizing** | Tailor experience | Consent-bounded; no protected-attribute inference (C-3) | What's personalized disclosed | User can disable | Relevant tailoring | Turn off / reset |
| **Learning** | Gain skill | In-context, skippable, re-findable | Progress optional, honest | No forced gating (IX-38) | User capable | Revisit guidance |
| **Community Participation** | Engage others | Consent + safety norms; dignity enforced (C-8) | Post/state honest | Moderation + report tie-in | Contribution shared safely | Edit/retract/appeal |
| **AI Interaction** | Get assistance | Suggestion framing; labeled; override always (§15) | Confidence + AI-label shown | Fallback to human (IX-53) | User-useful, user-controlled | Reject/override AI |
| **Human Assistance** | Reach a person | Reachable escalation, esp. safety (C-5) | Queue/status honest | No dead ends | User reaches human | Retry / alt channel |
| **Settings** | Configure account | Granular, revocable, safe-default (C-6, C-7) | Change confirmed | Prevent unsafe combos | Config as intended | Revert change |
| **Account Recovery** | Regain access | Secure, dignified, no lockout dead-ends | Step/status honest | Anti-abuse without user shaming | Access restored securely | Alternate recovery path |
| **Offboarding** | Leave / delete | Easy exit; export first; honest deletion scope (C-7) | Deletion scope + timing honest | No dark-pattern retention | Account/data removed as promised | Grace-period restore if offered |

## 18. Conflict, Sync & Concurrency

**IX-76** (MUST) When concurrent edits conflict, the system MUST NOT silently discard either side; it MUST surface the conflict and let the user resolve it, preserving both versions until resolution.

**IX-77** (MUST) Sync state MUST be honest: pending, synced, and failed MUST be distinguishable; the system MUST NOT show synced while data is only local.

**IX-78** (MUST) Scheduling/booking conflicts MUST be detected and blocked before commitment, not after.

## 19. System Response Principles

**IX-79** (MUST) **Acknowledgement** — every user action MUST be acknowledged perceptibly within the responsiveness budget, even if the result is pending.

**IX-80** (MUST) **Waiting / loading / processing** — the system MUST distinguish "working" from "stuck": show honest progress; for indeterminate waits show activity without faking a determinate bar; after a threshold, offer cancel and status.

**IX-81** (MUST) **Completion** — success MUST be confirmed only when truly complete (IX-21), stating the resulting state.

**IX-82** (MUST) **Partial completion** — the system MUST report exactly what succeeded and what did not, and offer to complete or roll back the remainder; MUST NOT report whole success on partial success.

**IX-83** (MUST) **Failure** — failures MUST be stated plainly with cause and next step (IX-48), preserving user input, never blaming the user.

**IX-84** (MUST) **Recovery** — after failure the system MUST offer a path back (retry, alternate, human) without restarting completed work.

**IX-85** (MUST) **Cancellation** — cancel MUST be honored promptly and MUST leave the system in a consistent, stated state (no half-applied mutations without disclosure).

**IX-86** (MUST) **Timeouts** — timeouts MUST be disclosed with reason; the user MUST be warned before a timeout causes data loss and offered extension where safe.

**IX-87** (MUST) **Background tasks** — long tasks MUST be able to run in background with retrievable status; completion/failure MUST be reported to the user.

**IX-88** (MUST) **Sync** — see IX-77; sync MUST reconcile without silent loss.

**IX-89** (MUST) **Offline** — the system MUST communicate offline state honestly, allow safe offline work where possible, queue actions, and reconcile on reconnect without duplicate side effects (e.g., no double-send/charge).

**IX-90** (MUST) **Network degradation** — under degradation the system MUST preserve core safety and comprehension, degrade non-essentials first, and never present stale data as live.

**IX-91** (MUST) **Conflict resolution** — see IX-76.

**IX-92** (MUST) **AI-reasoning disclosure** — on request the system MUST disclose the basis of an AI response in plain, non-fabricated terms (IX-56).

**IX-93** (MUST) **Human escalation** — an escalation to a human MUST be available from any failed or safety-relevant response (IX-53).

## 20. Multi-Modal Interaction

**IX-94** (MUST) **Parity** — every core capability MUST be operable through each supported input modality; a capability MUST NOT be exclusive to one modality where that excludes users.

**IX-95** (MUST) **Touch** — targets MUST meet accessible size/spacing; gestures MUST have a discoverable non-gesture equivalent (no gesture-only critical action).

**IX-96** (MUST) **Mouse / pointer** — hover-revealed meaning MUST have a non-hover equivalent (touch/keyboard) (C-8, never single-channel meaning).

**IX-97** (MUST) **Keyboard** — all interactive functionality MUST be fully keyboard operable, with visible focus and logical order (WCAG 2.2 AA, C-8).

**IX-98** (MUST) **Voice** — voice interactions MUST confirm consequential/irreversible actions before executing and MUST provide a non-voice fallback.

**IX-99** (MUST) **Gesture / pen** — MUST offer discoverable equivalents and MUST NOT be the sole path to any critical action.

**IX-100** (MUST) **Assistive technology** — the system MUST expose accurate roles, names, states, and change notifications to assistive tech; meaning MUST NOT depend on a single sensory channel (C-8).

**IX-101** (MUST) **Mixed reality / wearables / ambient** — MUST respect calm (C-11), consent (C-4), and provide clear, low-cognitive-load confirmations for consequential actions; ambient surfaces MUST NOT act consequentially without explicit authorization.

**IX-102** (SHOULD) **Brain-computer & future modalities** — SHOULD be integrated only with heightened, explicit, revocable consent, strict non-inference (C-3), fail-secure defaults, and a conventional fallback; deviation MUST be recorded citing Tiers 1-2.

**IX-103** (MUST) New modalities MUST inherit all IX obligations by default; a modality MUST NOT ship a consequential action lacking confirmation, reversibility, accessibility parity, and honest feedback.

## 21. Quality Framework (Measurable)

**IX-104** (MUST) Interaction quality MUST be evaluated against defined, measurable targets. Metrics MUST be diagnostic, never optimization targets that override higher tiers (C-12; no metric-first).

| # | Dimension | What is measured | Direction |
|---|---|---|---|
| IX-105 | Efficiency | Steps/time to complete core tasks | minimize |
| IX-106 | Learnability | Time/attempts to first success; novice vs. expert gap | minimize |
| IX-107 | Task completion / success | % of started tasks completed as intended | maximize |
| IX-108 | Errors | Error rate per task; slips vs. mistakes | minimize |
| IX-109 | Recovery time | Time from error to recovered state | minimize |
| IX-110 | Cognitive load | Perceived effort at sensitive/critical steps | minimize |
| IX-111 | Confidence | User certainty of outcome before/after acting | maximize |
| IX-112 | Satisfaction | Post-task ease/dignity rating | maximize |
| IX-113 | Consistency | Pattern-conformance across surfaces | maximize |
| IX-114 | Discoverability | % of users finding a capability unaided | maximize |
| IX-115 | Accessibility | WCAG 2.2 AA conformance; AT task success parity | maximize (AA = floor) |
| IX-116 | Perceived responsiveness | Time-to-acknowledgement vs. budget | within budget |
| IX-117 | Trust | Honest-state accuracy; unexpected-outcome rate | maximize / minimize |

**IX-118** (MUST) Accessibility (IX-115) is a floor, not a target: WCAG 2.2 AA conformance MUST be met for every interaction; a quality tradeoff MUST NOT drop below AA.

**IX-119** (MUST NOT) No metric in this framework MAY be used to justify a pattern that violates Tiers 1-4 (safety, consent/privacy, honesty, dignity).

## 22. Governance

**IX-120** (MUST) Every deviation from a SHOULD MUST record a justification naming the higher tier that compels it (SHIG-0001). MUST-level rules admit no deviation.

**IX-121** (MUST) New or changed interactions MUST pass the §23 checklist before release; failure blocks release (fail-closed).

**IX-122** (MUST) Each IX ID is permanent and immutable in meaning; changes occur by new IDs or version increments (semantic versioning), never by silent redefinition. Tier 1-4 obligations may only be strengthened.

**IX-123** (MUST) Conflicts between IX rules and any downstream spec MUST be resolved in favor of the higher SHIG tier and recorded; unresolved ambiguity resolves fail-secure (unverified / not-consented).

**IX-124** (SHOULD) Interaction changes SHOULD be validated with evidence (usability testing, telemetry, accessibility audit) before broad release (C-17 evidence-over-opinion).

# Compliance / Review Checklist

- **IX-125** (MUST) Does every consequential outcome trace to a user decision or a disclosed, reversible default? (IX-8, IX-12)
- **IX-126** (MUST) Do all destructive/irreversible actions have confirmation AND reversibility, with true irreversibility explicitly stated? (IX-49)
- **IX-127** (MUST) Do all consent-touching actions use explicit, granular, revocable consent, failing closed to not-consented? (IX-31, IX-22)
- **IX-128** (MUST) Are all displayed states honest (loading, saved, sent, verified, synced, delivered)? (IX-21, IX-77)
- **IX-129** (MUST) Is every action acknowledged within the responsiveness budget, with honest waiting/partial/failure states? (IX-79..IX-84)
- **IX-130** (MUST) Is user input preserved across interruption, error, refresh, and offline? (IX-67, IX-83, IX-89)
- **IX-131** (MUST) Is the flow fully keyboard-operable, AT-exposed, and free of single-channel meaning at WCAG 2.2 AA? (IX-97, IX-100, IX-118)
- **IX-132** (MUST) Is every core capability at parity across supported modalities and platforms with no critical gesture/voice/hover-only path? (IX-94..IX-100, IX-74)
- **IX-133** (MUST) Are AI outputs labeled, confidence-honest, explainable on request, override-always, consent-bounded, and never in control? (§15)
- **IX-134** (MUST) Is no protected attribute inferred or used to shape interaction, ranking, defaults, or friction? (IX-11, C-3)
- **IX-135** (MUST) Is a human-assistance/escalation path reachable from every failure and safety-relevant point? (IX-53, IX-93)
- **IX-136** (MUST) Are exits/cancel/offboarding as easy as entry, free of dark patterns and confirmshaming? (IX-18, IX-50, Offboarding row)
- **IX-137** (MUST) Are controls' signifiers accurate, side-effects disclosed, and navigation predictable? (IX-24..IX-27, IX-61)
- **IX-138** (MUST) Are all SHOULD deviations recorded with a higher-tier justification? (IX-120)

# Anti-patterns

| Anti-pattern | Why prohibited | How to detect | How to prevent |
|---|---|---|---|
| **IX-139 Hidden interactions** | Undiscoverable capability; excludes users (C-8, IX-72) | Capability with no signifier; found only by accident | Every action has a visible/AT-exposed affordance + equivalent path |
| **IX-140 Unexpected outcomes** | Breaks predictability/trust (IX-24, IX-73) | Control effect ≠ its signifier; hidden side effects | Signifier matches effect; preview consequential outcomes |
| **IX-141 Irreversible action without confirmation** | Violates C-7 | Destructive path lacking confirm+undo | Enforce IX-49 gate in review |
| **IX-142 Ambiguous controls** | Slips, wrong outcomes (IX-61, IX-63) | Similar controls, opposite effects; unclear state | Distinct signifiers; clear state; natural mapping |
| **IX-143 Excessive steps** | Wastes effort; often metric-driven (IX-43) | Steps with no task necessity | Remove non-essential steps; justify each |
| **IX-144 Inconsistency** | Erodes learnability/trust (C-16) | Same verb, different result across surfaces | Pattern library conformance check |
| **IX-145 Poor feedback** | User unsure if action registered (IX-60) | Action with no acknowledgement | Mandatory acknowledgement budget |
| **IX-146 Unclear status** | Dishonest state; erodes trust (IX-21) | Faked progress; optimistic/stale states | Honest state model; fail-secure rendering |
| **IX-147 Unexpected navigation** | Disorientation, lost context (IX-26) | Auto-redirects, context jumps | User-initiated navigation + return path |
| **IX-148 AI taking control** | Violates C-13 human-authority | AI acts on user/third parties without per-instance authorization | Suggestion-only framing; override-always; per-instance authorization |
| **IX-149 Excessive confirmations** | Confirmation fatigue → blind confirmation (IX-50) | Confirm dialogs on reversible/trivial actions | Undo for reversible; confirm only irreversible/consequential |
| **IX-150 Context loss** | Discards user work/effort (IX-67) | Input lost on error/refresh/interruption | Continuous draft/state preservation |
| **IX-151 Dark patterns / confirmshaming / roach-motel** | Violates dignity & consent (C-4, C-8, IX-18) | Guilt copy, pre-checked consent, obstructed exit | Symmetric ease of enter/exit; neutral copy; opt-in defaults |
| **IX-152 Manufactured urgency / metric-first nudging** | Violates calm & relationship-first (C-11, C-12) | Countdowns, fake scarcity, engagement bait | Justify interruptions by user-endorsed cause only |

# Open Questions

- **IX-153** Ecosystem-wide numeric responsiveness budgets (acknowledgement, indeterminate-wait threshold, timeout warning) — to be fixed in a downstream performance spec without weakening IX-60/IX-79/IX-86.
- **IX-154** Standard reversibility grace-period windows per action class (delete, offboarding, membership change) — pending policy + legal input, never shorter than honesty/consent require.
- **IX-155** Confidence-communication vocabulary for AI (how uncertainty is expressed without false precision) — pending shared lexicon spec (IX-55).
- **IX-156** Cross-device task-continuity handoff scope and privacy boundaries (IX-69) under C-6 privacy-by-default.
- **IX-157** Consent and non-inference safeguards for emerging modalities (BCI, ambient, wearables) (IX-102) — pending ethics review.
- **IX-158** Minimum feature/safety-parity baseline formally enumerated per supported platform (IX-74).

# Revision History

| Version | Date | Status | Author | Summary |
|---|---|---|---|---|
| 1.0.0 | 2026-07-26 | Active | Chief Design Officer, Sambandh | Initial governing specification of the Sambandh Interaction Design System. Establishes universal interaction principles, human-system collaboration, trust/predictability/agency/transparency, AI-collaboration limits, multi-modal parity, the User Action Framework, system-response principles, and a measurable quality framework. Rule IDs used: IX-1..IX-158. Compliant with and referencing SHIG-0000 (Article 4 tiers; C-1..C-17; fail-secure) and SHIG-0001 (rule grammar, permanent IDs, lifecycle, semantic versioning). |
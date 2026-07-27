# Specification ID

SHIG-0020

# Specification Name

Forms, Feedback & System-State System Specification

# Version

1.0.0

# Status

Active

# 1. Purpose & Scope

**FS-1** This specification MUST govern the properties, outcomes, and rules of every act of *data entry, system feedback, and system-state communication* in Sambandh — how a member gives information to the system, how the system acknowledges and responds, and how the system tells the truth about what it is doing and what it has done. It governs the *experience of entering data and reading system state honestly and safely*, NOT form markup, input widgets, layout, validation libraries, notification frameworks, state-management code, or any literal value (color, spacing, timing, font). Those are implementation and are out of scope.

**FS-2** This specification MUST comply with SHIG-0000 (Constitution, Article 4 lexicographic hierarchy; immutable principles C-1..C-17) and MUST NOT contradict it. It MUST follow SHIG-0001 rule grammar. Philosophy established in the Constitution and anchor instruments MUST be referenced by ID, not restated.

**FS-3** Every surface that collects input, discloses consequence, or reports state MUST truthfully and continuously answer, without member effort: (a) what is being asked and why, (b) what is optional versus required, (c) what state the system is currently in, (d) whether my action succeeded, failed, or is pending, (e) what went wrong and how to fix it, (f) what happens if I proceed, (g) what happens if I do nothing. A surface that leaves any of (a)–(g) unanswerable is non-conformant.

**FS-4** This specification closes the "every form" mandate as governance: no form, input, prompt, confirmation, notification, or state indicator is exempt. Absence of an explicit pattern for a given surface MUST NOT be read as absence of obligation; the surface MUST satisfy the nearest governing rule herein, resolving ambiguity toward the higher constitutional tier.

## 1.1 Cross-Instrument Relationships

**FS-5** This specification MUST express the constitutional obligations most directly engaged by data entry, feedback, and state: honesty-of-signal (C-2), honest errors/empty/loading/success states (C-13), consent precedes data and action (C-4), reversibility and agency (C-7), accessibility as a floor and never-single-channel meaning (C-8), safety reachable (C-5), calm over stimulation (C-10), premium-through-restraint (C-14), India-first plurality (C-9), non-inference of character (C-3), and fail-secure on unknown or ambiguous state (SHIG-0000). Where these conflict, resolution MUST follow Article 4, not any local ordering in this document.

**FS-6** This specification MUST consume SHIG-0014 (Copy & Content) for all message wording, tone, voice, and terminology: rules herein govern *what a message must accomplish and when it must appear*, never its literal words. It MUST NOT restate copy rules; where a message is required, its wording MUST conform to SHIG-0014.

**FS-7** This specification MUST reference, and MUST NOT duplicate, SHIG-0012 (Interaction Design System): interaction *mechanics* — how an action is initiated, acknowledged over time, reversed, undone, or paced — are governed there (e.g., IX-8, IX-21, IX-22, IX-28). This specification governs the *forms, feedback, and state rules* layered on those mechanics. Where both apply, neither may weaken the other; conflicts resolve toward the stricter obligation and the higher tier.

**FS-8** This specification MUST honor the structure and mental models of SHIG-0005 (Information Architecture) and SHIG-0006 (User Mental Models), the state and recovery duties of SHIG-0013 (Navigation & Wayfinding, e.g., no dead-ends), and the accessibility floor of SHIG-0011. It MUST NOT invent state, structure, or terminology that contradicts those instruments; where it needs a concept they lack, the anchor instrument MUST be amended first (deviation recorded per SHIG-0001).

**FS-9** Conflicts between this specification and any implementation guide resolve in favor of this specification. Conflicts between this specification and SHIG-0000/0001, or the anchor instruments it consumes, resolve in favor of those higher or anchoring instruments.

# 2. Form & Input Design Principles

**FS-10** Every form MUST have a stated purpose the member can understand before committing effort: why the information is asked, who will see it, and what it enables. A form that requests data without disclosing purpose is non-conformant (C-4, C-1).

**FS-11** A form MUST request only the data its stated purpose requires. Data collected "in case it is useful," or beyond the disclosed purpose, is non-conformant (data minimization; C-4, C-6). Optional data MUST be visibly distinguished from required data through more than one channel (never by a single cue such as color or position alone, C-8).

**FS-12** Every input MUST carry a persistent, human-readable label that remains visible while the member enters and reviews data. A label that vanishes on interaction, leaving the member unable to recall what a field holds, is non-conformant (recognition over recall; C-8).

**FS-13** Where a field's expected format, constraint, or example would reduce error, that guidance MUST be available before submission, not disclosed only after failure. Guidance MUST be honest about what is actually accepted (C-2).

**FS-14** Fields MUST accommodate India-first plurality (C-9): the system MUST NOT assume a single language, script, numeral system, name structure, address form, honorific, calendar, or contact format. A name field MUST accept mononyms and multi-part names; an input MUST NOT reject a legitimate value because it does not match one culture's default shape. Rejection of a valid plural-form input is non-conformant.

**FS-15** The system MUST NOT impose input constraints that exclude legitimate members (e.g., mandatory field structures that a valid member cannot satisfy). Where a constraint is genuinely required, an accessible path to satisfy or appeal it MUST exist (C-8, C-9).

**FS-16** Default field values MUST be honest, non-manipulative, and never pre-select a consequential, consent-touching, or costlier option on the member's behalf (C-4, C-10). A default MUST reflect the member's likely honest intent or be empty; it MUST NOT be set to serve business interest against the member (Tier 9 never over Tiers 2–3).

**FS-17** The system MUST preserve valid input the member has already entered across pauses, errors, navigation, and recoverable interruptions; it MUST NOT silently discard a member's work (state preservation, consistent with SHIG-0012 IX-28). Where loss is unavoidable, it MUST be disclosed and confirmed before it occurs (C-7).

**FS-18** Input MUST NOT carry meaning through a single channel alone. Required/optional status, active field, valid/invalid state, and character or selection limits MUST each be expressed through at least two independent channels (C-8, WCAG 2.2 AA).

**FS-19** A form MUST reflect the member's mental model of the task (SHIG-0006): grouping, order, and progression MUST match how a member conceives the task, not the system's internal data model. A form organized around database convenience rather than member understanding is non-conformant.

**FS-20** Sensitive-context forms (verification, reporting, blocking, payment, offboarding, and any surface touching safety, dignity, or grief) MUST minimize cognitive and emotional load: plainest language (per SHIG-0014), no upsell, no metric framing, no manufactured urgency (C-10; consistent with SHIG-0012 IX-19). Safety and support MUST remain reachable throughout (C-5).

**FS-21** The system MUST NOT infer, rank, gate, or shape a form, its fields, its defaults, or its friction from a member's appearance, complexion, caste, religion, region, language, or name-form, nor imply any character, worth, or trustworthiness judgment from such attributes (C-3 non-inference). Any such inference is a Tier-4 breach, prohibited regardless of business value.

# 3. Validation, Error Communication & Recovery

**FS-22** Validation MUST be honest: it MUST report only true failures, MUST NOT falsely reject valid input, and MUST NOT blame the member for a system, network, or server fault. Attributing a system-side failure to the member is a Tier-3 honesty breach (C-2, C-13) and a Tier-4 dignity breach (C-3 dignity) and is prohibited.

**FS-23** An error MUST identify the specific field or cause responsible, state what is wrong in plain terms, and state how to fix it. A generic, non-actionable, or non-specific error ("invalid input", "something went wrong") without a next action is non-conformant (C-13; wording per SHIG-0014).

**FS-24** Every error message MUST be programmatically associated with the input or region it concerns, so assistive technology conveys the same field↔error relationship a sighted member perceives (C-8, WCAG 2.2 AA). An error announced only visually, or only globally when it belongs to a specific field, is non-conformant.

**FS-25** Error state MUST NOT be signaled by a single channel. A field in error MUST be identifiable by at least two independent channels (e.g., an accessible text message plus a non-color status indicator), never color, position, or motion alone (C-8).

**FS-26** On a failed submission, focus MUST be moved to, or the member MUST be reliably guided to, the first field requiring attention, so recovery does not depend on the member hunting for the problem. Focus management MUST be predictable and MUST NOT trap the member (C-8; consistent with SHIG-0012).

**FS-27** Validation timing MUST serve the member, not punish them. The system MUST NOT assert an error for input the member has not finished entering in a way that reads as premature blame; it MUST give the member a fair opportunity to complete a field before declaring it wrong (C-10 calm, C-13). Conversely, it MUST NOT defer a knowable, preventable error until after a costly or irreversible submission.

**FS-28** Error recovery MUST preserve all other valid input; correcting one field MUST NOT discard the rest of the member's work (FS-17). A validation cycle that clears the form is non-conformant.

**FS-29** Where the system cannot determine whether input is valid (dependency unavailable, verification pending, ambiguous state), it MUST say so honestly as *unknown/pending* and MUST NOT render an optimistic "valid" or a false "invalid." Under ambiguity affecting consent or safety, validation MUST fail secure (C-2, C-13, SHIG-0000).

**FS-30** Success of a submission MUST be reported honestly and MUST mean what it says: "saved" means persisted, "sent" means handed to the transport, "submitted" means received. The system MUST NOT show success before the outcome is real (no fake completion; C-2, C-13; consistent with SHIG-0012 IX-21). Partial success MUST be reported as partial, naming what did and did not complete.

**FS-31** No error may terminate in a dead-end. Every error MUST offer at least one honest forward path (retry, correct, alternative) and one return path to a known state, and MUST keep safety and support reachable (C-5; consistent with SHIG-0013 no-dead-end rule).

# 4. The System-State Model

**FS-32** Every surface MUST, at all times, be in exactly one member-legible state drawn from a truthful state model that MUST include at least: **loading/in-progress**, **empty**, **error**, **success/complete**, **offline/degraded**, and **partial**. A surface whose true state the member cannot determine is non-conformant (C-13). Unknown or indeterminate state MUST be shown as unknown, never masked as any definite state.

**FS-33** Every non-trivial state MUST be told truthfully and MUST offer a next action. A state that describes a condition without giving the member a way forward (or an honest explanation of why none exists yet) is non-conformant (C-13; consistent with SHIG-0013).

**FS-34 (Loading / in-progress)** A loading state MUST honestly indicate that work is underway and MUST NOT imply completion, certainty, or a specific outcome it has not achieved. Indeterminate waits MUST be shown as indeterminate; the system MUST NOT display fabricated or misleading progress (C-2, C-13). A wait that may be long SHOULD offer the member something to do or a way to leave without losing state.

**FS-35 (Empty)** An empty state MUST explain honestly why it is empty (nothing yet, nothing matches, not yet permitted) and MUST offer an appropriate next action. It MUST NOT read as an error when nothing is wrong, and MUST NOT imply hidden content the member could access if they are not in fact permitted (C-2, C-13).

**FS-36 (Error)** An error state MUST state what happened, where the member now is, and at least one forward and one return path (FS-31). It MUST distinguish member-correctable errors from system faults and MUST NOT falsely attribute a system fault to the member (FS-22).

**FS-37 (Success / complete)** A success state MUST confirm the true, completed outcome, name what was done, and — where the action has consequence — make its result and any reversal path evident (C-7). It MUST NOT celebrate an outcome that has not actually occurred (C-13).

**FS-38 (Offline / degraded)** When connectivity or a dependency is lost or degraded, the system MUST tell the truth about reduced capability, MUST indicate what still works and what does not, and MUST protect unsaved input (FS-17). It MUST NOT present stale data as live, and MUST NOT silently drop the member's action; queued or deferred actions MUST be disclosed as such (C-2, C-13, C-9 low-bandwidth reality).

**FS-39 (Partial)** A partial state MUST honestly report that some but not all of an operation succeeded, naming the completed and outstanding parts and offering how to complete or safely abandon the remainder. A partial result presented as full success is a Tier-3 breach (C-2).

**FS-40** State transitions MUST be legible and continuous: the member MUST be able to perceive that a change occurred and relate the new state to the prior one (consistent with SHIG-0012 IX-21, SHIG-0013). The system MUST NOT flip silently between states in a way that leaves the member unsure which state is current.

**FS-41** State communication MUST NOT rely on a single channel; each state MUST be distinguishable through at least two independent channels (C-8). State conveyed by color, motion, or position alone is non-conformant.

# 5. Prompt Input Acknowledgment & Honest Progress

**FS-42** Any member input — a form submission, a prompt to an assistant, a command, a selection — MUST be acknowledged: the member MUST be able to tell that the system received the input and is acting on it. Silence that leaves the member unsure whether their action registered is non-conformant (C-13; consistent with SHIG-0012 IX-21).

**FS-43** Progress shown for an operation or a prompt response MUST be honest. The system MUST NOT display fabricated progress, artificial delay presented as work, or a completion indicator before the work is actually complete (no fake completion; C-2, C-13). Where duration or outcome is unknown, the system MUST represent it as indeterminate rather than inventing a determinate impression.

**FS-44** Streaming, incremental, or long-running responses MUST be distinguishable from finished ones: the member MUST be able to tell whether output is still arriving or is complete. Presenting an in-progress result as final is a Tier-3 breach (C-2).

**FS-45** Automated or AI-generated output produced in response to a prompt MUST be labeled as automated and framed as assistance, not authority, and MUST NOT imply certainty it lacks or present inference as established fact (C-2, C-12; consistent with SHIG-0012 IX-8). The member MUST retain agency over any consequential action arising from such output.

**FS-46** The member MUST be able to interrupt, cancel, or abandon an in-progress operation or prompt where the operation is not yet irreversibly committed, without losing prior valid input (C-7; consistent with SHIG-0012 IX-28). Irreversible operations MUST be marked as such before commitment (see §6).

**FS-47** Acknowledgment and progress indication MUST NOT themselves become interruptive or anxiety-inducing (C-10). They MUST inform calmly; they MUST NOT nag, flash for attention, or manufacture urgency about a wait.

# 6. Confirmation & Consequence Disclosure

**FS-48** Any consequential, costly, or irreversible action MUST disclose its consequence before commitment, in plain terms: what will change, what it affects, whether it can be undone, and — where relevant — whom it notifies or exposes (C-7; consistent with SHIG-0012 IX-27). Undisclosed side effects are non-conformant (C-2).

**FS-49** Confirmation friction MUST be proportional to consequence and reversibility: reversible, low-stakes actions MUST NOT be burdened with needless confirmation, while irreversible or high-consequence actions MUST require an explicit, deliberate act of intent that cannot be triggered accidentally (C-7, C-10). Confirmation MUST NOT be used as a dark pattern to obstruct a legitimate exit, cancellation, or deletion.

**FS-50** Irreversibility MUST be stated truthfully. The system MUST NOT imply an action is reversible when it is not, nor imply permanence to discourage a legitimate action the member is entitled to take (C-2, C-7). Where a reversal window or recovery path exists, it MUST be disclosed accurately.

**FS-51** Where reversibility is feasible, it MUST be preferred over confirmation-only friction: an undoable action with a clear, reachable reversal path serves agency better than an irreversible action guarded only by a warning (C-7). Removing reversibility to increase commitment or lock-in is prohibited (Tier 9 never over Tier 2/7).

**FS-52** Consequence disclosure MUST be honest and non-manipulative: it MUST NOT exaggerate risk to deter a permitted action (confirmshaming), nor understate risk to induce one. The member's informed choice — not the system's preference — MUST govern the outcome (C-10, C-7).

**FS-53** Destructive-action confirmations MUST make the safe choice the easy default and MUST NOT bias the member toward the destructive option through visual weight, wording, or placement (C-10, C-14). Safety and reversibility MUST NOT be sacrificed for interface tidiness.

# 7. Consent Capture within Forms

**FS-54** Any consent captured within a form MUST be explicit, specific, and unbundled: each distinct purpose requiring consent MUST be presented and agreed to on its own, never merged into a single blanket agreement (C-4). Bundled consent is non-conformant.

**FS-55** Consent controls MUST never be pre-checked, pre-granted, or defaulted to the granted state; consent MUST require an affirmative, deliberate member act (C-4). A pre-selected consent is a Tier-2 breach and is prohibited.

**FS-56** Consent MUST NOT be coerced by making a legitimate, otherwise-available function conditional on consent the function does not genuinely require (no forced or tying consent; C-4). Where a function truly requires a given data use, that dependency MUST be disclosed honestly.

**FS-57** Consent MUST be scoped and its scope disclosed: the member MUST be able to understand what they are agreeing to, for what purpose, and with what reach, at the moment of agreeing (C-4). Consent obtained without legible scope is non-conformant.

**FS-58** Consent MUST be as easy to withhold or later revoke as to grant; a reachable path to review and revoke MUST exist (C-4, C-7). Making revocation harder than granting is a dark pattern and is prohibited.

**FS-59** Where consent is required for the form's purpose and the member's consent state is absent, ambiguous, or cannot be confirmed, the system MUST treat consent as **not granted** and MUST NOT proceed with the consent-touching action (fail-secure; C-4, SHIG-0000). It MUST NOT infer consent from silence, from an unrelated action, or from continued use.

**FS-60** Consent capture MUST NOT covertly enable one person's surveillance of another; a form MUST NOT let a member consent away another person's privacy (C-6). Cross-person data or visibility MUST rest on that other person's own consent and permitted scope.

# 8. Feedback & Notifications

**FS-61** Feedback and notifications MUST be calm and non-interruptive by default: they MUST NOT manufacture urgency, anxiety, scarcity, or compulsion, and MUST NOT interrupt the member without a cause the member would endorse (C-10; consistent with SHIG-0012 IX-17). Member attention is treated as the member's to grant, never the system's to seize absent an endorsable cause.

**FS-62** Interruptive feedback (that which blocks, seizes focus, or demands immediate response) MUST be reserved for genuinely blocking, safety-relevant, or consequential conditions; it MUST NOT be used for promotional, growth, or engagement purposes (C-10, C-11; Tier 9 never over Tier 6). Non-blocking conditions MUST use non-interruptive feedback.

**FS-63** Every notification MUST be honest about its origin and its subject, MUST carry truthful scent to its source, and MUST NOT mislead the member into opening it (C-2). A notification MUST NOT fabricate activity, urgency, or social pressure to drive a return (no dark patterns).

**FS-64** Notifications and non-essential feedback MUST be dismissible and MUST NOT reappear unchanged without new, member-relevant cause (C-10; consistent with SHIG-0012 IX-17). Controls to reduce, mute, or configure them MUST be reachable (C-4, C-7).

**FS-65** Feedback MUST match the weight of the event: routine confirmations MUST be quiet; the system MUST NOT amplify a trivial event into an alarming or celebratory spectacle (premium-through-restraint, C-14; calm, C-10). Emotional intensity MUST be proportional and honest, never manufactured.

**FS-66** Feedback MUST NOT rely on a single channel to carry its meaning; its significance MUST be perceivable through at least two independent channels and MUST meet the accessibility floor, including for time-limited messages that MUST remain available long enough to be read or be recoverable (C-8, WCAG 2.2 AA).

**FS-67** Feedback and notifications MUST NOT be metric-first: no feedback pattern may exist solely to raise engagement, session count, or conversion (C-11; consistent with SHIG-0012 IX-10). Relationship-serving honesty governs over growth.

# 9. Progressive Disclosure

**FS-68** Complexity MAY be revealed progressively — showing what the current step needs and deferring the rest — but progressive disclosure MUST NOT hide load-bearing content: information a member needs to give informed consent, understand a consequence, judge honesty, or reach safety MUST remain present and reachable, never buried (C-4, C-5, C-7, C-13). Hiding a material term, cost, or consequence behind optional disclosure is prohibited.

**FS-69** What is disclosed progressively MUST be discoverable and honestly signposted: the member MUST be able to tell that more exists and how to reach it. Concealment presented as simplification is non-conformant (C-2, C-14).

**FS-70** Progressive disclosure MUST reduce genuine cognitive load without creating disorientation: each revealed layer MUST preserve the member's context and their ability to return (consistent with SHIG-0013). It MUST NOT be used to obscure the true length, cost, or commitment of a flow.

**FS-71** Defaults chosen to keep an initial view simple MUST still be honest and safe (FS-16): a simplified default view MUST NOT pre-commit the member to a consequential or consent-touching choice they have not seen (C-4, C-7).

# 10. Fail-Secure on Ambiguous Submit & Consent

**FS-72** When the outcome of a submission is unknown or ambiguous (no confirmation received, timeout, indeterminate response), the system MUST NOT display success and MUST NOT silently assume failure in a way that loses the member's input. It MUST report the true uncertain state honestly and offer a safe path (retry, check status, preserve draft), defaulting away from any irreversible or consent-touching effect until the outcome is confirmed (C-13, C-7, SHIG-0000).

**FS-73** When consent state at submission is ambiguous or unconfirmed, the system MUST resolve to **not-consented** and MUST withhold the consent-touching action, consistent with SHIG-0012 IX-22 and FS-59 (fail-secure; C-4). It MUST NOT complete the action and seek forgiveness later.

**FS-74** The system MUST NOT double-commit a consequential action on ambiguous retry: repeated or uncertain submission of an irreversible or costly action MUST be guarded so a member is not charged, sent, or committed twice due to system uncertainty (C-7, C-2). Idempotent-outcome protection is a property this rule requires, however implemented.

**FS-75** Any fail-secure resolution MUST be communicated honestly to the member — what is uncertain, what the system did or withheld, and what the member can safely do next — never masked as a definite success or a false, member-blaming failure (C-2, C-13).

# 11. Multi-Platform & Accessibility Parity

**FS-76** The rules of this specification MUST hold across every surface and platform in scope — desktop, mobile, tablet, installed and offline-capable web surfaces, low-bandwidth and low-cost devices, voice, ambient, and spatial — reflecting India-first device and connectivity plurality (C-9). Presentation MAY adapt to each platform's affordances; the *meaning* of a form, feedback, state, consent, or consequence MUST NOT diverge across platforms (consistent with SHIG-0013 parity).

**FS-77** On non-visual, voice, and ambient surfaces, form guidance, validation errors, state, progress, consequence disclosure, and consent MUST be conveyed through the available modality with equivalent meaning, never lost because a visual channel is absent (C-8 never-single-channel, generalized).

**FS-78** All forms, feedback, states, confirmations, and consent interactions MUST meet WCAG 2.2 AA as a floor on every platform, with full parity for assistive-technology users, including programmatic association of labels, errors, and state, and predictable focus management (C-8; consistent with SHIG-0011). Accessibility is Tier 4 and MUST NOT be traded for Tier 5/8/9 gains.

**FS-79** Low-bandwidth and interruption-prone conditions MUST be first-class, not edge cases: forms MUST protect input across dropped connections, states MUST degrade honestly (FS-38), and the member MUST NOT be penalized with lost work for conditions outside their control (C-9, C-13).

# Decision Framework

**FS-80** When choosing among competing form, feedback, or state designs, teams MUST apply SHIG-0000 Article 4 lexicographically. A design that better serves a lower tier MUST NOT be chosen over one that better serves a higher tier; a lower-tier gain NEVER justifies a higher-tier loss.

**FS-81 (Selection rule)** Among candidate designs that violate no higher tier, teams MUST prefer the one that is most honest and most reduces the risk of member error and lost work (Tiers 3, 5), then the calmest and most restrained (Tiers 6, 8), then the most consistent (Tier 7). Business preference (Tier 9) breaks ties only after all higher tiers are equal.

**FS-82 (Non-negotiable)** The following MUST NOT be traded for any lower-tier benefit: honest state, success, error, and progress (FS-22/30/34/43, Tier 3); fail-secure on ambiguous submit and consent (FS-59/72/73/74, Tiers 1–2); explicit, unbundled, non-pre-checked, uncoerced consent (FS-54/55/56, Tier 2); non-inference in forms and defaults (FS-21, Tier 4); accessibility and never-single-channel meaning (FS-18/24/25/41/66/78, Tier 4); no dead-end errors and reachable safety (FS-31, Tiers 1/5); disclosed consequence and preserved reversibility (FS-48/50/51, Tier 7/2); calm, non-manipulative feedback (FS-49/52/61/62, Tier 6).

**FS-83 (Deviation record)** Any SHOULD-level deviation MUST record a written justification naming the higher tier it serves, per SHIG-0001. MUST-level requirements admit no deviation.

**FS-84 (Decision table)**

| Situation | Competing pull (tiers) | Required resolution | Governing IDs |
|-----------|------------------------|---------------------|---------------|
| Optimistic UI shows success before the outcome is confirmed | Perceived speed (T5) vs Honesty (T3) | Show pending; confirm only true outcome | FS-30, FS-43, FS-72 |
| Pre-checking consent lifts opt-in rates | Business/growth (T9) vs Consent (T2) | Prohibited; affirmative unbundled consent | FS-54, FS-55, FS-56 |
| One blanket agreement is simpler than several | Simplicity (T5/T8) vs Consent (T2) | Unbundle per purpose | FS-54, FS-57 |
| Ambiguous submit result; retry may double-commit | Task completion (T5) vs Reversibility/honesty (T2/T3) | Fail-secure; guard double-commit; report uncertainty | FS-72, FS-74, FS-75 |
| Hiding a material cost behind progressive disclosure declutters | Craft/simplicity (T8) vs Honesty/consent (T3/T2) | Keep load-bearing content present | FS-68, FS-69 |
| Confirmshaming friction reduces cancellations | Business (T9) vs Calm/agency (T6/T7) | Prohibited; neutral, easy exit | FS-49, FS-52, FS-58 |
| Blaming member for a server error is simpler copy | Effort (T5) vs Honesty/dignity (T3/T4) | Attribute truthfully to system | FS-22, FS-36 |
| Interruptive notification would boost return visits | Business/engagement (T9) vs Calm (T6) | Non-interruptive; reserve interruption for cause | FS-61, FS-62, FS-67 |
| Removing undo increases commitment/lock-in | Business (T9) vs Reversibility (T2/T7) | Preserve reversibility | FS-50, FS-51 |
| Error signaled by color alone is cleanest | Aesthetics (T8) vs Accessibility (T4) | Add second channel + programmatic association | FS-24, FS-25, FS-41 |

# Quality Framework (Measurable)

**FS-85** Each attribute below MUST have a defined measurement method and a recorded accept/reject threshold per release. Conformance claims MUST be backed by measurement, not opinion (C-17). Unmeasured surfaces are treated as non-conformant (fail-secure).

| # | Quality attribute | What it measures | Accept | Reject |
|---|-------------------|------------------|--------|--------|
| FS-86 | State honesty | Displayed state matches true system state across loading/empty/error/success/offline/partial | Zero divergence between shown and true state | Any state shown that is not the true state (incl. fake progress/completion) |
| FS-87 | Error actionability | Errors are specific, correctly attributed, and give a next action | Every error field-specific, truthful, actionable | Any generic, misattributed, or dead-end error |
| FS-88 | Error association & focus | Errors programmatically associated; focus reaches first issue | Full association + predictable focus, AT parity | Any error not associated or focus not managed |
| FS-89 | Single-channel meaning | Required/optional, validity, state, feedback each carried by ≥2 channels | No meaning by color/position/motion alone | Any single-channel-only signal |
| FS-90 | Input preservation | Valid input survives error, pause, offline, and navigation | No silent loss of valid input | Any silent loss of member work |
| FS-91 | Consent integrity | Consent explicit, unbundled, non-pre-checked, uncoerced, revocable | All consent affirmative and per-purpose | Any pre-checked, bundled, forced, or irrevocable consent |
| FS-92 | Consequence disclosure | Consequence, reach, and reversibility disclosed before commit | Full honest disclosure, proportional friction | Any undisclosed side effect or misstated reversibility |
| FS-93 | Fail-secure resolution | Ambiguous submit/consent resolves safely and is reported honestly | Defaults away from harm; uncertainty stated | Any optimistic success or silent commit under ambiguity |
| FS-94 | Non-inference | Forms, defaults, friction free of protected-attribute inference | Zero inference-based shaping | Any inference-based form/default/friction |
| FS-95 | Calm feedback | Feedback non-interruptive, proportional, non-manipulative | Meets calm + proportionality targets | Any manufactured urgency, dark pattern, or misplaced interruption |
| FS-96 | Progressive-disclosure honesty | No load-bearing content hidden; hidden content discoverable | Material content always present/reachable | Any concealed cost/consequence/consent term |
| FS-97 | Accessibility & parity | WCAG 2.2 AA + cross-platform meaning parity for forms/feedback/state | Full parity, all platforms | Any AA failure or meaning divergence |
| FS-98 | Plurality accommodation | Inputs accept plural name/script/numeral/format/bandwidth realities | Valid plural-form inputs accepted | Any rejection of a legitimate plural-form input |

**FS-99 (Release gate)** A release MUST NOT ship if any Tier 1–4-linked metric is in Reject: state honesty (FS-86), error attribution/association (FS-87/88), single-channel meaning (FS-89), consent integrity (FS-91), fail-secure resolution (FS-93), non-inference (FS-94), accessibility/parity (FS-97), or input preservation where loss touches safety/consent (FS-90). Tier 5–9 rejects MUST be recorded with a remediation plan per SHIG-0001.

# Governance

**FS-100** This specification is Tier 1–4 in effect and, per SHIG-0000, MAY only be strengthened, never weakened, by future revisions. Requirement IDs FS-1..FS-104 are permanent; a superseded rule is marked Deprecated, never reused or renumbered, and never gapped.

**FS-101** Every form, feedback, state, confirmation, or consent change MUST cite the FS IDs it satisfies and MUST record any SHOULD-level deviation with its higher-tier justification (FS-83). MUST-level requirements admit no deviation.

**FS-102** Under any unknown, indeterminate, or ambiguous condition affecting submission, consent, state, or trust, the system MUST fail secure: no optimistic success, no assumed consent, no masked error (FS-59/72/73; SHIG-0000). Silence or absence of a rule MUST be resolved toward the higher constitutional tier.

**FS-103** Conformance MUST be evidenced by the Quality Framework measurements at defined review points; unmeasured surfaces are non-conformant (C-17). Conflicts between this specification and any downstream guide resolve in favor of this specification; conflicts with SHIG-0000/0001 or consumed anchor instruments resolve in favor of those.

**FS-104** New surfaces, platforms, or input modalities entering scope MUST be assessed against this specification's rules and Quality Framework before member exposure; an unassessed surface MUST NOT collect data, disclose consequence, or report state to members.

# Compliance / Review Checklist

- **C1** Every reviewed form states its purpose, requests only necessary data, and distinguishes required from optional via ≥2 channels (FS-10/11/18).
- **C2** Labels persist and remain readable during entry and review; guidance precedes failure (FS-12/13).
- **C3** Inputs accept plural name/script/numeral/address/contact forms; no valid plural-form input is rejected (FS-14/15/98).
- **C4** Defaults are honest and never pre-commit a consequential or consent-touching choice (FS-16/71).
- **C5** Validation is honest, field-specific, actionable, and never blames the member for system faults (FS-22/23/27).
- **C6** Errors are programmatically associated, multi-channel, and focus reaches the first issue predictably (FS-24/25/26).
- **C7** No error is a dead-end; forward + return paths and reachable safety exist on every error/empty state (FS-31/35/36; C-5).
- **C8** Every surface is in exactly one truthful state (loading/empty/error/success/offline/partial), each with a next action (FS-32/33).
- **C9** Progress and prompt acknowledgment are honest — no fake progress or premature completion; in-progress output is distinguishable from final (FS-30/42/43/44).
- **C10** Consequential/irreversible actions disclose consequence and reversibility before commit, with proportional, non-manipulative friction (FS-48/49/50/52/53).
- **C11** Consent is explicit, unbundled, non-pre-checked, uncoerced, scoped, and revocable; ambiguous consent resolves to not-granted (FS-54..59/73).
- **C12** No form lets one member consent away another's privacy (FS-60; C-6).
- **C13** Feedback and notifications are calm, honest, dismissible, proportional, and never metric-first or dark-pattern (FS-61..67).
- **C14** Progressive disclosure hides no load-bearing content; hidden content is discoverable and context-preserving (FS-68/69/70).
- **C15** Ambiguous submit/consent fails secure, guards double-commit, and is reported honestly (FS-72/73/74/75).
- **C16** No form, default, friction, or feedback is shaped by inferred appearance, complexion, caste, religion, region, language, or name-form (FS-21/94).
- **C17** WCAG 2.2 AA met on every platform with cross-platform meaning parity and low-bandwidth resilience (FS-76/77/78/79).
- **C18** Each Quality Framework metric is measured with recorded accept/reject; the FS-99 gate is honored (FS-85/99).
- **C19** Every change cites satisfied FS IDs; SHOULD deviations carry higher-tier justification (FS-101).

# Anti-patterns

For each: *why it harms · how to detect · how to prevent.*

- **AP-1 Fake progress / premature completion** — Shows work or success that has not happened, deceiving the member (C-2, C-13, Tier 3). Detect: completion or progress indicator not tied to a confirmed real outcome. Prevent: honest pending/indeterminate states; confirm only true outcomes (FS-30/34/43/72).
- **AP-2 Optimistic success under ambiguity** — Declares success without confirmation, risking silent data loss or double-commit (Tiers 2–3). Detect: success shown on timeout/unknown result. Prevent: fail-secure reporting + double-commit guard (FS-72/74/75).
- **AP-3 Victim-blaming errors** — Attributes a system/network fault to the member (C-2 honesty, C-3 dignity; Tiers 3–4). Detect: server-fault paths worded as member error. Prevent: truthful attribution (FS-22/36).
- **AP-4 Generic / dead-end errors** — Non-specific, non-actionable, or exit-less error state (C-13, Tier 5). Detect: errors lacking field, cause, or next action. Prevent: specific, actionable, recoverable errors (FS-23/31).
- **AP-5 Single-channel signaling** — Meaning of required/error/state carried by color, position, or motion alone (C-8, Tier 4). Detect: state indistinguishable without the single channel. Prevent: ≥2 independent channels + programmatic association (FS-18/24/25/41/66).
- **AP-6 Pre-checked / bundled consent** — Consent defaulted-on or merged across purposes (C-4, Tier 2). Detect: any pre-selected or blanket consent control. Prevent: affirmative, unbundled, per-purpose consent (FS-54/55).
- **AP-7 Forced / tying consent** — Withholding an unrelated function unless unnecessary consent is given (C-4, Tier 2). Detect: function gated on data it does not require. Prevent: honest dependency disclosure only where real (FS-56).
- **AP-8 Roach-motel / confirmshaming exits** — Easy to enter, obstructed to leave; guilt copy to deter cancellation (C-10, dark pattern; Tiers 6–7). Detect: revocation/cancel harder than the grant/signup. Prevent: symmetric, neutral, easy exit (FS-49/52/58).
- **AP-9 Hidden load-bearing content** — Material cost, consequence, or consent term concealed behind progressive disclosure (C-2/C-4, Tiers 2–3). Detect: material terms not visible before commit. Prevent: keep load-bearing content present and discoverable (FS-68/69).
- **AP-10 Silent input loss** — Member's valid work discarded by error, navigation, or disconnect without disclosure (C-7, C-13). Detect: form clears on error or connection drop. Prevent: preserve/restore input; confirm any unavoidable loss (FS-17/28/79).
- **AP-11 Interruptive / manufactured-urgency feedback** — Blocking prompts, countdowns, or false activity to drive action (C-10, C-11; Tier 6, Tier 9-over-6 prohibited). Detect: interruption without endorsable cause; fabricated urgency. Prevent: calm, proportional, dismissible, cause-justified feedback (FS-61/62/63/65).
- **AP-12 Misleading empty/offline state** — Empty read as error, stale data shown as live, or queued action shown as done (C-2, C-13). Detect: state text contradicts true condition. Prevent: honest empty/offline/partial states (FS-35/38/39).
- **AP-13 Inference-shaped forms** — Fields, defaults, or friction shaped by protected-attribute inference (C-3, Tier 4). Detect: variation in form/default/friction correlated with protected attributes. Prevent: prohibit inference; uniform honest forms (FS-21/94).
- **AP-14 Irreversibility by omission** — Removing undo or overstating permanence to increase commitment or deter a permitted action (C-7, Tiers 2/7). Detect: consequential action with no disclosed/available reversal where feasible. Prevent: prefer reversibility; disclose it truthfully (FS-50/51).

# Open Questions

- **FS-Q1** Standard measurement instruments and per-surface numeric thresholds for the Quality Framework require SHIG-wide calibration and are deferred to a measurement annex (cross-referenced with SHIG-0013 §8).
- **FS-Q2** A canonical taxonomy of "consequential" and "irreversible" actions, and their proportional-friction tiers (FS-49), warrants a dedicated classification annex shared with SHIG-0012.
- **FS-Q3** Cross-service consent-scope propagation captured in one form and honored across Sambandh services (FS-57/60) requires a consent-propagation specification cross-referenced with SHIG-0000 Tier 2.
- **FS-Q4** Modality-equivalence mapping for form guidance, validation, state, and consent on voice/ambient/XR surfaces (FS-77) awaits a modality annex as those surfaces mature.
- **FS-Q5** Governance of automated draft-assistance and AI-suggested field values within forms (FS-45) — labeling, consent bounds, and non-inference — needs a rule set jointly owned with SHIG-0012 and the forthcoming AI-assistance instrument.

# Revision History

| Version | Date | Status | Author | Summary |
|---------|------|--------|--------|---------|
| 1.0.0 | 2026-07-27 | Active | Chief Design Officer, Sambandh | Initial governing specification for Forms, Feedback & System-State; requirement IDs FS-1..FS-104. |

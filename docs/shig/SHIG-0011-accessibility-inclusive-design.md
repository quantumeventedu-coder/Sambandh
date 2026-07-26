# Specification ID

SHIG-0011

# Specification Name

Accessibility & Inclusive Design System Specification

# Version

1.0.0

# Status

Active

# 1. Purpose, Scope & Governing Position

**AX-1** — MUST treat accessibility and inclusive design as a **core quality attribute** of Sambandh, equal in standing to correctness and security; a surface that is inaccessible to any served population is **defective**, not merely non-compliant. This specializes Constitution C-8 (accessibility; never single-channel meaning) and C-9 (inclusion/plurality).

**AX-2** — MUST treat **WCAG 2.2 Level AA as the floor and never the ceiling.** Meeting AA is a passing precondition, not evidence of a good outcome; a surface MAY pass AA and still fail this specification on cognitive load, dignity, or inclusion grounds.

**AX-3** — Purpose of **accessibility**: MUST ensure that people with permanent, temporary, or situational impairments can perceive, operate, understand, and complete every trust-bearing task without assistance from another person and without loss of dignity.

**AX-4** — Purpose of **inclusive design**: MUST ensure the product serves the full diversity of Sambandh's population (language, region, religion, caste-neutrality, family form, gender, age, device, network, literacy, socioeconomic status) without any group being made a second-class user or being asked to assimilate to a default.

**AX-5** — Scope: this specification governs every human-facing surface (screens, flows, notifications, emails, SMS, voice/IVR, printed/exported artifacts, AI-generated text, error and empty states, and third-party/partner-embedded surfaces). No surface is out of scope by virtue of being internal, transactional, promotional, or "edge."

**AX-6** — Precedence: where accessibility, cognitive-load, or inclusion requirements conflict with craft (Tier 8) or business (Tier 9) goals, the higher-tier requirement MUST win; any deviation MUST be recorded per SHIG-0001 naming the higher tier that justifies it. Accessibility requirements MUST NOT be traded against Tier 1–7 obligations — they implement them.

**AX-7** — Fail-secure: where it is unknown whether a user can perceive or operate a signal, the design MUST assume they cannot and provide an alternative channel; ambiguity resolves toward more access, never less.

## 1.1 Accessibility vs Inclusivity vs Compliance vs Usability (governing distinctions)

**AX-8** — MUST maintain and apply these distinctions as separate acceptance gates; passing one does not satisfy the others:

| Concept | Question it answers | Gate it governs | Failure looks like |
|---|---|---|---|
| Accessibility | Can this specific-ability user operate it at all? | AX-30..AX-55 | Screen-reader user cannot submit consent |
| Inclusivity | Does this user's identity/context belong here as a default? | AX-70..AX-96 | Only one family form is selectable |
| Compliance | Does it meet the codified standard (WCAG 2.2 AA+)? | AX-190..AX-205 | Missing name/role/value |
| Usability | Can a real user actually succeed calmly? | AX-100..AX-125, AX-170..AX-188 | Passes AA but 40% abandon the step |
| Digital dignity | Is the user respected while doing it? | AX-17..AX-22 | Access provided only via a demeaning "special" mode |

**AX-9** — MUST NOT claim "accessible" on the basis of automated compliance checks alone; a claim of accessibility requires the usability and dignity gates (AX-8) to also pass, evidenced per AX-190.

# 2. Foundational Principles

**AX-10 — Universal Design.** MUST design one primary experience usable by the widest range of people without adaptation. Separate "accessible versions," "lite for disabled," or "simple mode for illiterate users" MUST NOT be the primary means of access; where an alternative mode exists it MUST be feature-equivalent for all trust-bearing tasks (AX-19).

**AX-11 — Equity, not sameness.** MUST provide differentiated support so that users with unequal starting capabilities reach equal outcomes (e.g., extra guidance, alternative input, longer/clearable timeouts). Equal treatment that produces unequal task success MUST be corrected toward equal outcome.

**AX-12 — Respect for human diversity.** MUST treat variation in ability, language, literacy, device, and culture as the expected normal case for which the system is designed — not as exceptions handled after the "real" design.

**AX-13 — Non-inference (C-1/C-3 binding).** MUST NOT infer, display, or use a user's caste, religion, complexion, region, language, ability, or literacy from appearance, name, photo, or behavior to alter their access, ranking, options, or treatment. Accessibility adaptations MUST be triggered by explicit user setting, assistive-tech signal, or user request — never by inferred identity.

**AX-14 — Autonomy.** MUST enable each user to complete trust-bearing tasks independently; a task that structurally requires a sighted, hearing, literate, or able helper to complete is a defect (severity per AX-193).

**AX-15 — Participation & equal opportunity.** MUST ensure that every capability which affects a user's relationship outcomes (verification, consent, safety, discovery, communication, escalation) is reachable and completable by all served populations, not a subset.

**AX-16 — Independence over dependence.** SHOULD prefer designs that build user capability over time (recognition, memory support, guided learning) rather than designs that keep users dependent on hand-holding; deviation MUST be justified by a higher-tier need (e.g., safety).

## 2.1 Digital Dignity

**AX-17** — MUST deliver accessibility through the mainstream path wherever feasible; routing disabled or low-literacy users to a visibly inferior, stigmatizing, or "special needs" channel is a dignity violation (Tier 4).

**AX-18** — MUST NOT expose, announce, or label a user's use of assistive technology, accessibility settings, low-literacy mode, or language choice to any other user.

**AX-19** — Any adaptive or simplified mode MUST be **feature-equivalent** for all trust, safety, consent, and relationship-affecting capabilities; access MUST NOT be purchased at the cost of capability.

**AX-20** — MUST use respectful, person-first, non-pitying framing in all accessibility-related UI copy; MUST NOT use "sufferer," "victim," "handicapped," "normal users," or charity framing.

**AX-21** — MUST NOT gate accessibility features behind payment, higher tiers, or additional consent beyond what an equivalent non-adapted user provides.

**AX-22** — MUST preserve the user's sense of control and privacy while adapting; adaptations MUST be reversible (C-7) and MUST NOT silently persist across contexts the user did not opt into.

# 3. Accessibility Dimensions (per-ability rules)

For every rule in this section, the alternative or accommodation MUST be feature-equivalent (AX-19) and MUST NOT be single-channel (C-8).

## 3.1 Visual

**AX-30** — MUST NOT encode any meaning, state, required action, error, or distinction by color alone; every color-carried meaning MUST be duplicated by text, shape, icon, or pattern (validation: AX-201).

**AX-31** — MUST meet or exceed WCAG 2.2 AA contrast for text, essential icons, focus indicators, and interactive-state boundaries; decorative-only elements are exempt but MUST NOT be the sole carrier of meaning.

**AX-32** — MUST support user-controlled text scaling to at least 200% and reflow to a single column without loss of content or function, and MUST NOT clip, truncate, or overlap content at that scale.

**AX-33** — MUST provide a programmatically correct reading/focus order matching the visual and logical order; MUST expose name, role, value, and state for every interactive element to assistive technology.

**AX-34** — MUST provide meaningful text alternatives for all informative non-text content and MUST mark purely decorative content as such; MUST NOT embed load-bearing information only inside images.

**AX-35** — MUST NOT rely on hover or pointer-only affordances to reveal essential information or controls; equivalent access MUST exist via keyboard and assistive technology.

## 3.2 Auditory

**AX-36** — MUST provide synchronized captions for all pre-recorded audio-visual content and a text transcript for audio-only content; MUST NOT deliver instructions, verification, or safety information only as sound.

**AX-37** — MUST NOT use sound as the sole indicator of any event (e.g., new message, verification result, alert); every auditory cue MUST have a visual and, where the platform allows, haptic equivalent.

## 3.3 Motor

**AX-38** — MUST make all functionality operable by keyboard (or keyboard-equivalent) with no keyboard traps and a visible focus indicator at all times.

**AX-39** — Interactive targets MUST meet the WCAG 2.2 minimum target size and MUST provide adequate spacing; primary and destructive actions SHOULD exceed the minimum.

**AX-40** — MUST NOT require precise timing, path-based gestures, multi-point gestures, or shaking as the only way to perform an action; a single-pointer, non-timed alternative MUST exist.

**AX-41** — MUST make time limits adjustable, extendable, or dismissible except where a limit is essential for safety or fraud prevention; where essential, MUST warn and offer the maximum feasible accommodation.

**AX-42** — MUST allow actions to be cancelled or confirmed before commit (activation on up-event, undo, or confirmation) to accommodate tremor and accidental activation, especially for destructive or irreversible actions (C-7).

## 3.4 Speech

**AX-43** — MUST NOT require voice input as the only means to complete any task; a typed/selected equivalent MUST exist for every voice-driven flow.

**AX-44** — Voice or IVR flows MUST offer a non-speech fallback (keypad, text, or visual path) and MUST NOT reject users based on accent, dialect, fluency, or speech difference.

## 3.5 Cognitive & Learning (see also §4)

**AX-45** — MUST minimize required working memory: essential information needed to make a decision MUST be present at the point of decision, not held in the user's head from a prior screen (recognition over recall).

**AX-46** — MUST provide clear, consistent, predictable navigation and controls across the product; identically-named actions MUST behave identically (consistency, C-16).

**AX-47** — MUST provide error prevention for consequential actions and clear, specific, blame-free recovery for all errors (§4.4).

## 3.6 Language & Literacy

**AX-48** — MUST author all user-facing copy at a plain-language reading level (target: comprehensible to a Grade 6–8 reader in the active language); MUST measure and report readability (AX-170).

**AX-49** — MUST NOT require reading fluency to complete safety, consent, or verification tasks; MUST pair critical text with recognizable icons and, where feasible, audio or spoken-language support for low-literacy users.

**AX-50** — MUST avoid idiom, jargon, legalese, and untranslated foreign terms in primary flows; where a technical term is unavoidable it MUST be defined in place.

## 3.7 Cultural

**AX-51** — MUST NOT assume a single cultural default for names, honorifics, date/time/number/calendar formats, address structure, family structure, or relationship terms; MUST support the diversity present in the served population.

**AX-52** — MUST NOT use imagery, examples, metaphors, or defaults that privilege one religion, region, caste-coded assumption, complexion, or language community as the norm (C-1/C-9).

## 3.8 Inclusivity Contexts (device / network / socioeconomic / age)

**AX-53** — MUST function on low-end devices and small/older screens; core trust-bearing tasks MUST complete within the device-performance budget of SHIG quality standards (AX-186) and MUST NOT require the newest OS or hardware.

**AX-54** — MUST function under low-bandwidth and intermittent-connectivity conditions: MUST degrade gracefully, preserve entered data across drops (AX-124), avoid large mandatory downloads, and never lose a user's progress on a trust-bearing task due to network loss.

**AX-55** — MUST NOT assume unlimited data, always-on connectivity, latest browser, or high digital literacy; MUST design the default experience for the constrained case and enhance progressively.

## 3.9 Temporary & Situational

**AX-56** — MUST design for temporary impairments (injury, post-procedure, one-handed use) and situational limitations (bright sunlight, noisy environment, low battery, borrowed device, distraction, holding a child) as first-class cases, using the same alternatives that serve permanent disabilities.

**AX-57** — MUST NOT require conditions the user may not have in-context (e.g., sound-on, two hands, steady gaze, quiet room) to complete any essential task.

## 3.10 First-time vs Expert Users

**AX-58** — MUST make first-time users successful without training: primary tasks MUST be discoverable and completable on first encounter with in-context guidance (AX-119).

**AX-59** — MUST NOT slow expert users with unskippable guidance; guidance MUST be dismissible and non-recurring once completed, while remaining re-findable (C-7 reversibility).

# 4. Cognitive Accessibility (mental-load reduction)

**AX-60** — MUST reduce extraneous cognitive load on every screen: one primary task per screen, minimal simultaneous decisions, and no competing calls to action of equal weight.

**AX-61** — MUST support attention by avoiding non-essential motion, autoplay, interruptions, and attention-competing elements during a task (calm-over-stimulation, C-11); see §7 motion rules.

**AX-62 — Memory support.** MUST persist and re-display prior user input, selections, and context so users never re-enter or re-derive information the system already holds.

**AX-63 — Predictability.** MUST NOT trigger a context change (navigation, submission, new window, data change) merely on focus or input change; consequential changes MUST be user-initiated and previewable.

**AX-64 — Clear communication.** MUST state, in plain language at each step: what this is, what will happen if the user proceeds, and what the user must do next.

**AX-65 — Recognition over recall.** MUST let users choose from clearly labeled options rather than recall codes, exact strings, or prior steps; MUST make previously entered and available choices visible.

**AX-66 — Decision confidence.** MUST give users the information needed to decide before they commit, including consequences, reversibility, and who sees the result (consent-before-data, C-4); MUST NOT rely on the user guessing.

**AX-67 — Progressive disclosure.** MUST reveal complexity gradually — essentials first, advanced/optional detail on request — without hiding anything required to make a safe, informed decision (AX-158 anti-pattern boundary).

**AX-68 — Guided learning & context preservation.** MUST guide multi-step tasks with clear progress, the ability to move backward without data loss, and preservation of context across interruptions, sessions, and channels.

**AX-69 — Error prevention/recovery (cognitive).** MUST prefer constraints, sensible defaults, confirmation of consequential actions, and reversibility over reliance on user vigilance; recovery paths MUST require minimal memory and reasoning (§4.4 = AX-130..AX-135).

## 4.1–4.4 consolidated cognitive rules

**AX-130** — Error messages MUST identify the specific field/cause, state it in plain non-technical language, assign no blame to the user, and give a concrete next action.
**AX-131** — MUST prevent avoidable errors via input constraints, format examples, and inline validation before submission of consequential data.
**AX-132** — MUST make destructive/irreversible actions require explicit confirmation and MUST offer undo where technically possible (C-7).
**AX-133** — MUST NOT clear correctly-entered data on error; MUST retain valid input and focus the first field needing attention.
**AX-134** — MUST preserve context on recovery so the user resumes where they were, not at the start.
**AX-135** — MUST NOT penalize, rate-limit punitively, or shame users for recoverable errors in non-security contexts.

# 5. AI Accessibility & Inclusive AI

Applies to every AI-generated or AI-assisted surface. Specializes C-12 (ethical AI: labeled, assistance-not-authority, consent-bounded).

**AX-140** — MUST label AI-generated or AI-assisted content and suggestions clearly and in plain language; MUST NOT present AI output as human, authoritative, or final.

**AX-141 — Explainability.** MUST provide, on request and in plain language, why an AI suggestion, match, ranking, or moderation outcome was produced, in terms the user can act on; MUST NOT expose the user only to an opaque score.

**AX-142 — Plain language.** All AI-facing copy MUST meet AX-48 readability and MUST NOT use model/system jargon.

**AX-143 — Confidence disclosure.** MUST communicate AI uncertainty honestly (C-3); MUST NOT present low-confidence output as certain, and MUST NOT fabricate confidence, facts, or reasons.

**AX-144 — Alternative communication.** MUST offer a non-AI path (human, static, or rule-based) to complete any trust-bearing task an AI surface fronts; AI MUST NOT be the sole channel.

**AX-145 — Human escalation.** MUST provide an always-reachable path from any AI interaction to human help for safety, consent, verification, and dispute matters (safety-reachable, C-5); the path MUST NOT be hidden, delayed, or gated.

**AX-146 — Transparency & consent-bounded personalization.** MUST only personalize or adapt using data the user has consented to for that purpose (C-4); MUST expose what is being personalized and MUST let the user turn it off (reversibility, C-7).

**AX-147 — AI error handling.** MUST handle AI failure, refusal, and low confidence with honest states (C-13), a clear reason, and a working alternative; MUST NOT dead-end, loop, or blame the user.

**AX-148 — Adaptive assistance.** MAY adapt guidance depth to observed need, but MUST NOT infer disability, literacy, or protected identity to do so (AX-13); adaptation MUST be explainable and reversible.

**AX-149 — Bias detection & fairness.** MUST test AI surfaces for disparate error rates, disparate access, and disparate quality across language, region, gender, age, ability, and literacy groups; a surface with material disparity MUST NOT ship until mitigated (evidence per AX-183, AX-197).

**AX-150** — AI MUST be operable via assistive technology and keyboard, MUST caption/transcribe any audio it produces, and MUST NOT rely on color/sound alone (§3 applies to AI output verbatim).

# 6. Inclusive Experience & Localization

**AX-70 — Respectful & inclusive terminology.** MUST use respectful, non-othering language throughout; MUST maintain a governed inclusive-terminology lexicon and MUST NOT use terms that demean any group.

**AX-71 — Bias reduction.** MUST review copy, defaults, examples, imagery, and ordering for bias against any language, region, religion, caste-coded assumption, complexion, gender, age, ability, or family form; findings MUST be remediated before release.

**AX-72 — Representation.** MUST represent the diversity of the served population in imagery and examples without tokenism or stereotype, and MUST NOT default to a single appearance, complexion, or community as "normal."

**AX-73 — Cultural neutrality of defaults.** MUST choose defaults (salutations, name order, examples, sample data) that do not privilege one community; where a neutral default is impossible, MUST make the choice explicit and easily changed.

**AX-74 — Gender inclusivity.** MUST NOT force a binary where a broader set is appropriate; MUST allow users to express gender per governed options and MUST NOT infer or reveal it beyond the user's stated consent (C-4).

**AX-75 — Family & relationship diversity.** MUST support diverse family structures, roles, and involvement models relevant to Sambandh without assuming a single canonical family form; MUST NOT hardcode one arrangement as required.

**AX-76 — Religious sensitivity.** MUST NOT assume, require, rank by, or privilege any religion; religious attributes MUST be optional, user-stated, and non-inferred (C-1).

**AX-77 — Caste-neutrality.** MUST NOT infer, request as mandatory, rank by, or expose caste in any way that violates C-1/human-dignity; any related field is optional, user-controlled, and never used to gate access.

**AX-78 — Regional adaptability.** MUST adapt formats, examples, and language availability to the user's region without treating any region as peripheral.

**AX-79 — Educational & technology-familiarity diversity.** MUST design so that users with low formal education or low technology familiarity can complete all essential tasks (see §3.6, §4); MUST NOT assume prior app fluency.

## 6.1 Internationalization & Localization

**AX-90 — i18n readiness.** MUST externalize all user-facing strings, MUST NOT concatenate translatable fragments, MUST support locale-aware plural/gender/number/date/currency formatting, and MUST allow text expansion without layout breakage (validation AX-205).

**AX-91 — Bidirectional & script support.** MUST support the scripts and text directions of served languages, including correct bidirectional handling, complex-script shaping, and appropriate line-breaking.

**AX-92 — Language choice & persistence.** MUST let users choose their language independently of device locale, MUST persist it across sessions and channels, and MUST NOT infer language from name, region, or behavior to override the user's choice (AX-13).

**AX-93 — Translation quality & safety.** Safety, consent, verification, and error copy MUST be professionally translated and reviewed in every offered language; MUST NOT rely on unreviewed machine translation for trust-bearing text.

**AX-94 — Parity across languages.** All offered languages MUST have feature and content parity for trust-bearing tasks; a language MUST NOT be offered as a degraded subset.

**AX-95 — Fallback honesty.** Where content is unavailable in the chosen language, MUST clearly indicate the fallback language used rather than silently mixing; MUST NOT present untranslated critical content as if localized.

**AX-96 — Locale-appropriate input.** MUST accept locale-appropriate names, addresses, phone formats, and characters, and MUST NOT reject valid non-Latin input or impose Latin-only constraints on identity fields.

# 7. Motion, Sensory & Calm

**AX-110** — MUST honor the user's reduced-motion preference and MUST provide non-animated equivalents; essential meaning MUST NOT depend on motion.
**AX-111** — MUST NOT autoplay motion, audio, or video that lasts beyond a brief interval without a persistent, keyboard-reachable pause/stop control.
**AX-112** — MUST NOT present content that flashes above the accessibility flash threshold.
**AX-113** — MUST keep motion purposeful, brief, and non-looping in task flows (calm-over-stimulation, C-11); decorative motion MUST be suppressible.
**AX-114** — MUST NOT use motion, parallax, or transitions that provoke vestibular discomfort as the only way to convey state.

# 8. Quality Standards (measurable targets)

**AX-170 — Readability.** MUST measure reading level of primary copy per language; acceptance: primary flows at target Grade 6–8; reject if any trust-bearing string exceeds the ceiling without recorded justification.
**AX-171 — Comprehension.** MUST validate that ≥90% of representative users (including low-literacy) correctly state what a critical step does and its consequence before proceeding.
**AX-172 — Navigation efficiency.** MUST measure steps/time to reach core tasks; regressions beyond the recorded budget reject the change.
**AX-173 — Task completion.** Core trust-bearing tasks MUST achieve the target unaided completion rate across ability, literacy, device, and language cohorts; a cohort below target is a defect.
**AX-174 — Learnability.** First-time users MUST complete primary tasks without external help at the target rate.
**AX-175 — Discoverability.** Essential features (safety, escalation, consent controls, verification) MUST be found by ≥95% of representative users within the test protocol.
**AX-176 — Error rate & recovery.** MUST track task error and recovery-success rates; recovery success MUST meet target across cohorts.
**AX-177 — Confidence.** MUST measure post-task user confidence that they did what they intended; below-target confidence on consent/safety steps is a defect.
**AX-178 — Accessibility satisfaction.** MUST measure satisfaction among assistive-tech and low-literacy users; MUST NOT report only aggregate satisfaction that masks these cohorts.
**AX-179 — Inclusive representation.** MUST audit imagery/examples/defaults for representation and bias against the lexicon and diversity targets.
**AX-180 — Language clarity.** MUST measure per-language clarity and translation quality; every offered language MUST pass, not just the primary.
**AX-181 — Cross-cultural understanding.** MUST validate that icons, metaphors, and examples are understood across served communities without a single-culture assumption.
**AX-182 — Low-bandwidth performance.** MUST meet target task-completion time and data budget under constrained-network test profiles.
**AX-183 — Fairness metrics.** MUST report AI/algorithmic error and access disparity across cohorts (AX-149); material disparity fails.
**AX-184 — Low-end-device performance.** MUST meet target interaction responsiveness and task completion on the reference low-end device class.
**AX-185 — Color independence coverage.** MUST verify 100% of meaning-bearing signals have a non-color channel (AX-30).
**AX-186 — Performance budgets.** MUST define and enforce per-surface device and network budgets; exceeding a budget on a trust-bearing task rejects release.
**AX-187 — Screen-reader task success.** MUST verify each trust-bearing task completes end-to-end with the reference screen readers at target success.
**AX-188 — Keyboard/alternative-input success.** MUST verify each trust-bearing task completes via keyboard and via at least one alternative-input method.

# 9. Design Governance

**AX-190 — Evidence over opinion (C-17).** Accessibility and inclusion claims MUST be backed by recorded test evidence (automated + manual + user testing); "looks accessible" is not evidence.
**AX-191 — Ownership.** MUST assign a named accessibility & inclusion owner accountable for this specification; cross-functional roles (design, engineering, content, research, localization, AI, safety) MUST have documented responsibilities.
**AX-192 — Review gate.** No trust-bearing surface MAY ship without passing the Compliance/Review Checklist (§12); a failed higher-tier item is a release blocker.
**AX-193 — Severity & triage.** MUST classify defects: blocker = task impossible or dignity/safety violation for any served cohort (ship-blocking); major = task disproportionately hard for a cohort; minor = friction. Blockers MUST NOT be deferred for business reasons (AX-6).
**AX-194 — Documentation.** MUST document accessible patterns, the inclusive-terminology lexicon, alternatives, and per-language content standards, and keep them versioned and discoverable.
**AX-195 — Continuous improvement & audits.** MUST run periodic accessibility and inclusion audits (scheduled and on major change) and track remediation to closure; MUST NOT let known defects age unbounded.
**AX-196 — Research & user testing WITH affected users.** MUST include, in usability research, people who use assistive technology, people with low literacy, and people on low-end devices/low bandwidth; testing ABOUT these users without testing WITH them does not satisfy this rule.
**AX-197 — AI fairness governance.** MUST review AI surfaces against AX-149/AX-183 before launch and on model or data change; results recorded per AX-190.
**AX-198 — Training.** MUST train contributors (design, engineering, content, AI, support) on this specification and the reasoning behind it; accessibility MUST NOT depend on a single specialist.
**AX-199 — Procurement/third-party.** MUST hold embedded third-party and partner surfaces to this specification; a non-conforming dependency MUST be remediated, wrapped, or removed, never used as an excuse.

# 10. Validation Framework

**AX-200** — Every release affecting a human-facing surface MUST run the validation battery below and record pass/fail with evidence:

| # | Dimension | Method | Accept | Reject |
|---|---|---|---|---|
| AX-201 | Color independence | Automated + manual | 100% meaning has non-color channel | Any color-only meaning |
| AX-202 | Contrast | Automated + spot manual | Meets/exceeds AA | Any essential element below AA |
| AX-203 | Keyboard access | Manual | All tasks operable, visible focus, no trap | Any trap or unreachable control |
| AX-204 | Screen-reader compat | Manual, reference readers | Trust tasks complete; name/role/value correct | Any trust task blocked |
| AX-205 | i18n readiness | Automated + review | Externalized, expansion-safe, locale-formatted, bidi-correct | Hardcoded/clipped/mis-formatted strings |
| AX-206 | Alternative input | Manual | ≥1 alt input completes each task | Any task voice/gesture-only |
| AX-207 | Low-vision support | Manual | 200% zoom + reflow, no loss | Content lost/overlapped |
| AX-208 | Motion sensitivity | Manual | Reduced-motion honored; no over-threshold flash | Motion-only meaning or flash |
| AX-209 | Cognitive load | Task test | Meets AX-171/AX-177 targets | Below comprehension/confidence target |
| AX-210 | Language understanding | Per-language test | All offered languages pass AX-180 | Any offered language fails |
| AX-211 | Task success (cohorts) | Moderated test | Meets AX-173 across cohorts | Any cohort below target |
| AX-212 | Compliance | Audit | WCAG 2.2 AA met as floor | Any AA failure |
| AX-213 | Inclusive experience | Audit | Passes bias/representation/terminology review | Any unremediated bias finding |
| AX-214 | Low-bandwidth/low-end | Profiled test | Within budgets (AX-182/AX-184/AX-186) | Budget exceeded on trust task |
| AX-215 | AI accessibility & fairness | Test | §5 rules met; no material disparity | Opaque, single-channel, or disparate AI |

**AX-216** — A single blocker (AX-193) in the battery fails the release regardless of other passes; MUST NOT average or waive without a recorded higher-tier justification, and Tier 1–4 items MUST NOT be waived at all.

# 11. Future Accessibility & Evolution

**AX-220** — MUST design with modality-independent semantics (clear name/role/value/state and structured content) so future assistive technologies and modalities can consume surfaces without rework.
**AX-221** — MUST NOT hardcode assumptions of a single input (touch/pointer) or output (visual screen); voice-first, screen-reader, switch, and future inputs MUST remain viable.
**AX-222** — SHOULD evaluate emerging modalities (wearables, voice-first ambient, AR/VR/XR, brain-computer and other novel interfaces) against this specification before adoption; adoption MUST preserve consent (C-4), calm (C-11), and non-inference (AX-13).
**AX-223** — MUST track evolving standards (WCAG and successors, regional accessibility law) and raise the internal floor when the external floor rises; the ceiling MUST keep advancing beyond the codified minimum (AX-2).
**AX-224** — Global expansion MUST add new languages, scripts, regions, and cultural contexts under §6/§6.1 before launch in a market; MUST NOT launch a market with degraded accessibility or unreviewed trust-bearing translations.
**AX-225** — New assistive-tech or modality support MUST be additive and MUST NOT regress existing access (consistency/longevity, C-16/C-17); regressions are blockers.
**AX-226 — Evolution of this spec.** Tier 1–4 requirements herein MUST only strengthen; changes MUST follow SHIG-0001 lifecycle and semantic versioning, MUST preserve permanent AX IDs, and MUST NOT weaken an accessibility guarantee without a recorded higher-tier justification (which, given AX-6, will rarely exist).

# 12. Compliance / Review Checklist

- [ ] **AX-C1** Every meaning-bearing signal has a non-color channel (AX-30/AX-185/AX-201).
- [ ] **AX-C2** AA contrast met as floor; 200% zoom + reflow lossless (AX-31/AX-32/AX-202/AX-207).
- [ ] **AX-C3** All trust-bearing tasks complete via keyboard and ≥1 alternative input, no traps, visible focus (AX-38/AX-188/AX-203/AX-206).
- [ ] **AX-C4** All trust-bearing tasks complete end-to-end with reference screen readers; name/role/value/state correct (AX-33/AX-187/AX-204).
- [ ] **AX-C5** No essential meaning delivered single-channel (visual-only, sound-only, motion-only, voice-only) (C-8; AX-36/AX-37/AX-43/AX-110).
- [ ] **AX-C6** Primary copy meets readability target in every offered language; critical text paired with icon/audio for low literacy (AX-48/AX-49/AX-170/AX-180).
- [ ] **AX-C7** Recognition-over-recall, memory support, and context preservation across steps/sessions/channels verified (AX-45/AX-62/AX-68/AX-124→AX-134).
- [ ] **AX-C8** Error prevention, blame-free specific recovery, and reversibility for consequential/destructive actions (AX-47/AX-69/AX-130..AX-135).
- [ ] **AX-C9** No non-inference of caste/religion/complexion/region/language/gender/ability/literacy; adaptations user-triggered only (AX-13/AX-74..AX-77/AX-92/AX-148).
- [ ] **AX-C10** Inclusive terminology, representation, and bias review passed; culturally neutral defaults (AX-70..AX-73/AX-179/AX-213).
- [ ] **AX-C11** i18n externalized, expansion/bidi-safe, locale-formatted; offered languages at feature/content parity with reviewed trust-bearing translations (AX-90..AX-96/AX-205).
- [ ] **AX-C12** Reduced-motion honored; no over-threshold flash; no autoplay without stop; calm preserved (AX-61/AX-110..AX-114).
- [ ] **AX-C13** Low-bandwidth and low-end-device budgets met; progress preserved across network loss (AX-53/AX-54/AX-182/AX-184/AX-186/AX-214).
- [ ] **AX-C14** AI surfaces labeled, explainable, confidence-honest, with human escalation and non-AI alternative; fairness tested with no material disparity (AX-140..AX-150/AX-215).
- [ ] **AX-C15** Access delivered via mainstream path with dignity; adaptive modes feature-equivalent; no accessibility gated behind pay/tier (AX-10/AX-17..AX-21).
- [ ] **AX-C16** Cohort task-success, comprehension, and confidence targets met; user testing conducted WITH assistive-tech, low-literacy, and low-end-device users (AX-171..AX-177/AX-196/AX-211).
- [ ] **AX-C17** No blocker deferred for business reasons; deviations recorded naming a higher tier (AX-6/AX-193/AX-216).

# 13. Anti-patterns

| ID | Anti-pattern | Why it's harmful | How to detect | How to prevent |
|---|---|---|---|---|
| **AX-AP1** | Accessibility as afterthought | Bolt-on access is incomplete and undignified; violates C-8 | Access work scheduled post-design; no a11y in acceptance | Make §12 a design-inception and release gate (AX-1/AX-192) |
| **AX-AP2** | Compliance without usability | Passes AA yet users fail/abandon | High abandon despite AA pass | Require usability + cohort targets (AX-8/AX-9/AX-173) |
| **AX-AP3** | Complex/legalese language | Excludes low-literacy and non-native readers | Readability above ceiling; comprehension low | Plain-language authoring + measurement (AX-48/AX-171) |
| **AX-AP4** | Cultural/identity assumptions in defaults | Others entire communities; risks C-1 inference | Single-culture defaults, name/family/religion assumptions | Neutral defaults + bias review (AX-51/AX-73/AX-13) |
| **AX-AP5** | Hidden functionality | Essential controls undiscoverable, esp. safety | <95% find core features | Discoverability testing; keep safety/escalation persistent (AX-175/AX-145) |
| **AX-AP6** | Inaccessible AI | Opaque, unescapable, single-channel AI blocks users | AI-only path; no explanation/escalation | Apply §5 to all AI (AX-140..AX-150) |
| **AX-AP7** | Excessive cognitive load | Overwhelm causes errors and anxiety | Many decisions/screen; low confidence | One primary task; progressive disclosure (AX-60/AX-67) |
| **AX-AP8** | Color-dependent communication | Invisible to color-blind/low-vision | Any color-only meaning (AX-201) | Dual-encode all meaning (AX-30) |
| **AX-AP9** | Motion overload | Vestibular harm; breaks calm (C-11) | Autoplay/loops; reduced-motion ignored | Honor reduced-motion; suppressible motion (AX-110..AX-114) |
| **AX-AP10** | Tiny/crowded targets | Excludes motor-impaired and situational users | Targets below minimum/spacing | Enforce target size + spacing (AX-39) |
| **AX-AP11** | Poor error recovery | Data loss and dead-ends strand users | Cleared input; vague errors; no undo | Retain input; specific blame-free recovery; undo (AX-130..AX-134) |
| **AX-AP12** | Biased personalization | Inferred identity alters access; violates C-1/C-4 | Adaptation from inferred traits; disparity | Consent-bounded, explainable, non-inferred adaptation (AX-146/AX-148/AX-149) |
| **AX-AP13** | Ignoring low-bandwidth/low-end | Excludes majority-constrained users | Heavy assets; failure on reference device/network | Enforce budgets; graceful degradation; progress preservation (AX-53/AX-54/AX-186) |
| **AX-AP14** | Separate "special" access path | Stigmatizes; usually feature-poor; violates dignity | Disabled/low-literacy routed to inferior mode | Universal design; feature-equivalent mainstream path (AX-10/AX-17/AX-19) |
| **AX-AP15** | Single-channel meaning | One sense/modality required | Sound-only/voice-only/visual-only critical info | Provide equivalent alternative channel (C-8; AX-7) |

# 14. Open Questions

- **AX-OQ1** — Which reference low-end device class(es) and network profiles are canonical for AX-184/AX-186 budgets, and how often are they revised as the population's device base shifts?
- **AX-OQ2** — Definitive initial set of offered languages/scripts and the parity bar (AX-94) for launch vs. fast-follow markets.
- **AX-OQ3** — Governance body and cadence approving changes to the inclusive-terminology lexicon (AX-70) across languages and regions.
- **AX-OQ4** — Concrete numeric acceptance thresholds for cohort task-success, comprehension, and confidence (AX-171/AX-173/AX-177) per task criticality tier.
- **AX-OQ5** — Standard fairness-disparity threshold that constitutes "material" (AX-149/AX-183) and its per-cohort statistical method.
- **AX-OQ6** — Recruitment standard and minimum representation for testing WITH disabled, low-literacy, and low-end-device users (AX-196).
- **AX-OQ7** — Policy for evaluating and consent-gating emerging modalities (AR/VR/XR, BCI, ambient) before pilot (AX-222).

# Revision History

| Version | Date | Status | Author | Summary |
|---|---|---|---|---|
| 1.0.0 | 2026-07-26 | Active | Chief Design Officer, Sambandh | Initial issuance of SHIG-0011 Accessibility & Inclusive Design System Specification. Establishes accessibility as a core quality attribute with WCAG 2.2 AA as floor not ceiling; specializes C-8/C-9 and the Article 4 hierarchy. Normative requirement IDs AX-1..AX-226 (contiguously allocated across purpose/principles, accessibility dimensions, cognitive accessibility, AI accessibility, inclusive experience/localization, motion/calm, quality standards, governance, validation, and future evolution), plus checklist IDs AX-C1..AX-C17, anti-pattern IDs AX-AP1..AX-AP15, and open-question IDs AX-OQ1..AX-OQ7. |
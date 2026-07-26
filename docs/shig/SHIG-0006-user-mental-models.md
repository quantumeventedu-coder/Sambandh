# Specification ID

SHIG-0006

# Specification Name

User Mental Models Specification

# Version

1.0.0

# Status

Active

# 1. Purpose

1.1 This specification governs how Sambandh aligns its interface to the way a human being actually thinks, expects, remembers, decides, and forms trust while using the product — so that people are never required to learn system-internal behavior, terminology, or logic in order to act safely and confidently.

1.2 It converts the Constitution (SHIG-0000) and rule grammar (SHIG-0001) into normative mental-model requirements (prefix `MM-`). It does not re-derive constitutional principles; it applies them to cognition. Where any rule here appears to conflict with a higher instrument, the higher instrument controls.

1.3 A mental model is the user's internal, simplified, predictive theory of what Sambandh is, what it will do next, and what a given action will cause. When the product's actual behavior matches that theory, the product feels obvious, calm, and trustworthy. When it diverges, users experience confusion, error, distrust, and — in a relationship context — real safety and dignity harm. Aligning to the model is therefore a Tier 1–4 obligation, not an aesthetic preference.

# 2. Scope

2.1 Applies to every Sambandh surface, vertical, flow, notification, AI feature, empty/loading/error state, and cross-locale variant that a human perceives or acts upon.

2.2 In scope: expected models of behavior; cognition-aligned rules; verification methods; validation metrics; anti-patterns.

2.3 Out of scope (governed elsewhere, referenced not restated): visual system, tokens, color, type, spacing, motion values, component code, tech stack, copy strings, and vertical-specific business rules. This spec is implementation-independent and states NO such values.

2.4 Precedence: SHIG-0000 ▸ SHIG-0001 ▸ this spec ▸ lower specs. This spec never weakens a Tier 1–4 guarantee; per SHIG-0001, such guarantees may only be strengthened.

# 3. Objectives

3.1 O-1 Predictability: a user can correctly anticipate the result of an action before taking it.
3.2 O-2 Recognition-first: correct action is available to be seen, not required to be remembered.
3.3 O-3 Honest signal: the user's model of "what is true / verified / inferred / predicted" matches reality (C-2, honesty-of-signal).
3.4 O-4 Calibrated trust: the user's confidence in the system, in AI output, and in other people is proportionate to actual reliability — neither inflated nor eroded.
3.5 O-5 Low avoidable cognitive load: attention is spent on the relationship decision, not on operating the tool.
3.6 O-6 Reversibility of understanding: a user who forms a wrong model can detect and correct it cheaply (C-8 reversibility).
3.7 O-7 Autonomy: choices are architected to serve the user's own goals, never to exploit cognitive limits (C-10, no dark patterns).
3.8 O-8 Universality: models hold across culture, language, script, numeral system, age, expertise, ability, and device (C-11 inclusion, C-9 accessibility floor).

# 4. Definition of Mental Models

4.1 **MM-1 (MUST).** Every feature MUST be designed against an explicitly stated "expected user model" — a one-sentence articulation of what a representative user believes the feature is and will do. *Why:* undocumented assumptions are unfalsifiable; the model is the design's testable hypothesis. *Design implication:* the expected model is a required design artifact, reviewed like any requirement. *Verify:* the artifact exists, is specific, and matches observed user statements in testing (§ Validation).

4.2 Terms: **System model** = how the product actually works. **Conceptual model** = the deliberately designed story the interface communicates. **User (folk) model** = what the user actually believes. **Gulf of execution** = distance between intent and knowing how to act. **Gulf of evaluation** = distance between system state and understanding it.

4.3 **MM-2 (MUST).** The conceptual model presented MUST be a truthful simplification of the system model — simpler, never falser. *Why:* honesty-of-signal (C-2) forbids a convenient fiction that later betrays the user. *Verify:* no interface metaphor implies a capability, guarantee, or data practice the system does not honor.

# 5. Why Mental Models Matter

5.1 **MM-3 (MUST).** Where a divergence between user model and system behavior could cause a safety, consent, privacy, or dignity harm, the divergence MUST be treated as a Tier 1–4 defect and MUST block release. *Why:* in a relationship ecosystem a misunderstanding is not mere inconvenience — misjudging what is shared, who can see it, or what is verified can endanger a person. *Verify:* triage records classify model-divergence defects by the highest Article 4 tier at risk; Tier 1–4 divergences are release-blocking.

5.2 **MM-4 (SHOULD).** Lower-tier model mismatches (understanding, calm, consistency) SHOULD be fixed by aligning the system to the user, not by adding instruction that shifts the burden onto the user. Deviation requires recorded justification naming the higher tier served.

# 6. Human Cognitive Principles (foundational rules applied throughout)

6.1 **MM-5 (MUST).** Design MUST assume finite, variable human attention, working memory, and processing capacity, and MUST NOT require sustained peak cognition to act safely. *Verify:* critical actions remain completable under distraction, interruption, and low-literacy conditions in testing.

6.2 **MM-6 (MUST).** The interface MUST make the safe, reversible, privacy-preserving path the most cognitively available path (least effort, most visible). *Why:* people follow the path of least resistance; ethics requires that path to be the protective one (Tiers 1–2 over Tier 9). *Verify:* for each consequential flow, map which option is lowest-effort; it is the protective default.

6.3 **MM-7 (MUST NOT).** Design MUST NOT exploit a known cognitive limitation (limited attention, memory decay, loss aversion, social proof, urgency, default bias) to move a user toward a choice that primarily serves Sambandh rather than the user. *Cross-ref:* § Cognitive Frameworks, § Choice Architecture.

# 7. Recognition versus Recall

7.1 Expected model: "The thing I need will be shown to me; I should not have to remember codes, paths, or prior screens."

7.2 **MM-8 (MUST).** Actions, options, and current state MUST be recognizable in place; the product MUST NOT require users to recall information from a prior screen to complete the current step. *Verify:* each step is completable without notes or back-navigation to retrieve remembered values.

7.3 **MM-9 (SHOULD).** Previously entered or chosen values SHOULD be surfaced for confirmation rather than re-entry. *Verify:* review flows for re-entry of already-known data.

# 8. Expectation Formation

8.1 Expected model: users predict future behavior from the first few interactions and from real-world/platform conventions.

8.2 **MM-10 (MUST).** Identical-looking elements MUST behave identically, and elements that behave differently MUST look different. *Why:* consistency (C-15) is how expectation generalizes correctly. *Verify:* affordance audit finds no visual twins with divergent behavior.

8.3 **MM-11 (MUST).** The first-run experience MUST establish a truthful model of what Sambandh is (a trust-first relationship ecosystem, not a dating app, not a metric game). *Verify:* post-onboarding comprehension test (§ Validation) shows correct category understanding above acceptance threshold.

# 9. Decision Making

9.1 Expected model: users decide with incomplete information and satisfice (pick the first good-enough option), not optimize.

9.2 **MM-12 (MUST).** At each decision point the interface MUST present the information a person actually needs to decide, and MUST distinguish fact from inference (§ Honest signal). *Verify:* decision-point inventory lists the minimum sufficient information and its provenance label.

9.3 **MM-13 (MUST NOT).** The interface MUST NOT manufacture urgency, scarcity, or time pressure to force a decision (C-10). *Verify:* no countdowns, "acting now" pressure, or expiring-opportunity framing exist unless the constraint is real, user-relevant, and safety/consent-based.

# 10. Attention Management

10.1 Expected model: attention is single-focus and easily hijacked; users assume the most prominent thing is the most important thing.

10.2 **MM-14 (MUST).** Visual and motion prominence MUST correspond to genuine user-relevant importance and MUST NOT be allocated by business incentive (Tier 9) over user need. *Verify:* prominence-to-importance mapping reviewed; promoted content is labeled and never outranks safety/consent cues.

10.3 **MM-15 (MUST).** Only one primary action SHOULD be emphasized per view, and safety/consent controls MUST remain perceivable without hunting. *Verify:* each primary view has one clear primary action; safety affordance is reachable within expected first-glance scan.

# 11. Memory Limitations

11.1 Expected model: users forget prior steps, will not read long text, and cannot hold many items at once.

11.2 **MM-16 (MUST).** Multi-step flows MUST persist progress and allow safe resumption without loss or re-entry. *Verify:* interrupt and resume each flow; no data or consent state is silently lost.

11.3 **MM-17 (SHOULD).** Simultaneously required choices SHOULD stay within a small, chunked set; larger sets SHOULD be grouped into meaningful categories. *Verify:* no step forces comparison across an unmanageably large flat list without grouping or filtering.

# 12. Learning Curves

12.1 Expected model: users learn by doing, transfer prior app knowledge, and abandon when early effort exceeds early value.

12.2 **MM-18 (MUST).** Core value MUST be reachable without training, documentation, or a tutorial gate. *Verify:* a first-time user completes the core task unaided at or above first-attempt-success threshold (§ Validation).

12.3 **MM-19 (SHOULD).** Advanced capability SHOULD be layered so that mastery is optional and additive, never a precondition to basic safe use. *Verify:* basic path never surfaces expert-only complexity.

# 13. Habit Formation

13.1 Expected model: repeated flows become automatic; users stop reading and act from muscle memory.

13.2 **MM-20 (MUST).** Once a flow's layout and action positions are learned, they MUST remain stable; consequential actions MUST NOT be relocated into positions previously occupied by benign actions. *Why:* habit + relocation = accidental harmful action (Tier 1–2). *Verify:* change-diff review flags any repositioning of consequential controls into prior safe zones.

13.3 **MM-21 (MUST NOT).** Sambandh MUST NOT engineer compulsive-return habit loops (variable-reward, streaks, artificial re-engagement) that serve engagement metrics over wellbeing (C-10, relationship-first-not-metric-first). *Verify:* no mechanic's primary purpose is return-frequency for its own sake.

# 14. Pattern Recognition

14.1 Expected model: users infer rules from patterns and expect the pattern to hold everywhere.

14.2 **MM-22 (MUST).** A pattern taught in one place MUST hold platform-wide; a broken pattern MUST be visibly and intentionally differentiated. *Verify:* cross-surface pattern audit finds no silent exceptions.

14.3 **MM-23 (MUST NOT).** The product MUST NOT let users infer a false pattern about people from surface cues — it MUST NOT present appearance, complexion, caste, religion, region, or language in a way that implies character, worth, or trustworthiness (C-3 NON-INFERENCE). *Verify:* no ranking, badge, ordering, or layout couples such attributes to trust/quality signals.

# 15. Information Processing

15.1 Expected model: users scan, not read; skim in reading order; process meaning in small pieces.

15.2 **MM-24 (MUST).** Meaning MUST NOT be conveyed by color, position, or motion alone; every meaningful distinction MUST have a redundant text/label/structure cue (C-9). *Verify:* grayscale + linear-order + reduced-motion pass preserves all meaning.

15.3 **MM-25 (SHOULD).** Content SHOULD be structured for scanning (front-loaded meaning, clear hierarchy, plain language). *Verify:* comprehension test meets time-to-comprehension threshold.

# 16. Mental Mapping (spatial/structural model)

16.1 Expected model: users build a spatial map of "where things live" and navigate from it.

16.2 **MM-26 (MUST).** Information architecture MUST be stable, with each function having one canonical home; a user MUST be able to answer "where am I / where can I go / how do I get back" at all times. *Verify:* location and back-path are unambiguous on every screen; no function silently relocates between releases.

16.3 **MM-27 (SHOULD).** Structure SHOULD reflect the user's model of relationships and tasks, not Sambandh's internal org or technical architecture. *Verify:* card-sort/tree-test alignment above threshold.

# 17. Cognitive Load Management

17.1 **MM-28 (MUST).** Each screen MUST minimize extraneous load (effort spent operating the UI rather than making the decision). *Verify:* every element on a consequential screen is justified as decision-relevant; unjustified elements are removed (premium-through-restraint, C-14).

17.2 **MM-29 (MUST).** Total decisions/inputs required to reach a safe outcome MUST be the minimum sufficient for informed consent — neither hiding what matters nor padding with friction. *Verify:* step-count justified against informed-consent minimum.

# 18. Progressive Disclosure

18.1 Expected model: users want the essential first and detail on demand.

18.2 **MM-30 (MUST).** Complexity MUST be revealed progressively — essentials first, depth on request — WITHOUT hiding information material to consent, cost, safety, or risk. *Why:* disclosure aids comprehension but MUST NOT become concealment (Tiers 1–2 over 5). *Verify:* audit confirms nothing consent/cost/safety-material is behind optional expansion; only non-material depth is deferred.

# 19. Choice Architecture (ethical)

19.1 Expected model: users are strongly influenced by defaults, ordering, framing, and the set of options presented.

19.2 **MM-31 (MUST).** Defaults MUST favor the user's safety, privacy, and reversibility; per SHIG-0000 fail-secure, unknown trust defaults to unverified and ambiguous consent defaults to not-consented. *Verify:* every default is the most protective reasonable option; consent defaults off.

19.3 **MM-32 (MUST).** Framing and option ordering MUST be neutral and truthful; equivalent choices MUST be presented with equivalent prominence and effort. *Verify:* no confirmshaming, no asymmetric friction (e.g., easy opt-in / buried opt-out), no pre-checked consent.

19.4 **MM-33 (MUST NOT).** No dark pattern in any form MUST exist (bait-and-switch, forced continuity, hidden costs, roach-motel, nagging, obstruction, sneaking, disguised ads). *Verify:* dark-pattern checklist passes with zero findings.

# 20. Decision Confidence

20.1 Expected model: users need to feel sure before consequential acts, and hesitate when unsure.

20.2 **MM-34 (MUST).** Before a consequential or irreversible action the interface MUST make the outcome, scope, and reversibility explicit, and MUST provide confirmation and, where feasible, undo. *Verify:* each consequential action states what will happen, to whom it is visible, and how to reverse it.

20.3 **MM-35 (SHOULD).** The interface SHOULD raise confidence by showing consequences truthfully, not by suppressing doubt. *Verify:* confidence-rating metric rises without any information being withheld.

# 21. Trust Formation

21.1 Expected model: trust is earned incrementally, easily lost, and is extended before it is verified.

21.2 **MM-36 (MUST).** The product MUST earn trust before requesting engagement or data (C-1 trust-before-engagement; C-4 consent-before-data). *Verify:* no data or high-commitment ask precedes demonstrated value and clear purpose.

21.3 **MM-37 (MUST).** Trust signals about people MUST be honest and evidence-based, MUST distinguish verified from unverified, and MUST NOT imply verification that has not occurred. *Verify:* every trust/verification indicator maps to a real, defined evidentiary basis; unknown → shown as unverified.

# 22. Expectation Management

22.1 **MM-38 (MUST).** The product MUST set expectations it will keep — stated timing, availability, outcomes, and limits MUST match reality. *Verify:* promised behavior (e.g., "response within…", "visible to…") is honored in system behavior.

22.2 **MM-39 (SHOULD).** When reality cannot meet a hoped-for expectation, the product SHOULD correct the expectation honestly rather than allow a comfortable but false one to persist. *Verify:* known limitations are disclosed at the point of relevance.

# 23. Error Perception

23.1 Expected model: users blame themselves for errors, misread system faults as personal failure, and fear having caused irreversible harm.

23.2 **MM-40 (MUST).** Error states MUST be honest, human, non-blaming, and MUST tell the user what happened, whether anything was lost or exposed, and the exact next step to recover (C-16 honest errors). *Verify:* each error names cause-in-plain-language + data/consent impact + recovery action; none blames the user or hides fault.

23.3 **MM-41 (MUST).** The interface MUST prevent foreseeable errors before they occur (constraints, confirmations, safe defaults) rather than only reporting them after. *Verify:* high-consequence inputs are constrained/validated ahead of commit.

# 24. Risk Perception

24.1 Expected model: users systematically misjudge risk — underweighting privacy/exposure risk and overweighting vivid rare risks.

24.2 **MM-42 (MUST).** When an action carries real privacy, safety, or exposure risk, the interface MUST surface that risk truthfully at the moment of decision, in proportion to actual severity, without fear-mongering. *Verify:* each risk cue is calibrated to real severity and appears before commit, not after.

24.3 **MM-43 (MUST NOT).** The product MUST NOT understate exposure risk to increase sharing, nor overstate risk to manipulate behavior. *Verify:* risk language reviewed against actual data flows.

# 25. Emotional Decision Making

25.1 Expected model: relationship decisions are emotional; users are more suggestible, hopeful, and vulnerable in this context.

25.2 **MM-44 (MUST).** The interface MUST remain calm and MUST NOT exploit hope, loneliness, jealousy, fear of missing out, or emotional arousal to drive spend or engagement (C-10; Tier 6 emotional wellbeing over Tier 9). *Verify:* no flow's persuasive force depends on an aroused emotional state.

25.3 **MM-45 (SHOULD).** For emotionally weighty actions the interface SHOULD add a calm moment (clear summary, no pressure, easy exit) rather than accelerate. *Verify:* weighty flows include a reversible, low-pressure confirmation.

# 26. Relationship Psychology

26.1 Expected model: users seek authentic, dignified, long-term connection and fear deception, exposure, and disrespect.

26.2 **MM-46 (MUST).** Features MUST support authenticity and dignity and MUST NOT reduce people to scores, ranks, or disposable options (relationship-first-not-metric-first; C-3 dignity). *Verify:* no person is presented primarily as a ranked/scored commodity; human dignity cues are present.

26.3 **MM-47 (MUST).** Mutuality and consent MUST be built into relationship actions (contact, visibility, escalation), reflecting that connection is two-sided. *Verify:* one party cannot unilaterally expose, contact, or escalate beyond consented bounds.

# 27. Communication Psychology

27.1 Expected model: users read tone as intent, fear being misread, and need clarity about who sees a message and whether it was delivered/seen.

27.2 **MM-48 (MUST).** Communication features MUST make visibility, delivery, and audience unambiguous (who can see this, is it private, was it sent). *Verify:* every message surface states its audience and state without inference.

27.3 **MM-49 (SHOULD).** The system SHOULD give users control over presence/read signals rather than exposing them by default, respecting privacy-by-default (C-7). *Verify:* presence/read-receipt exposure is user-controlled and off by default where it reveals behavior.

# 28. Privacy Expectations

28.1 Expected model: users assume what they share is seen only by whom they intend, and that the system is not watching covertly.

28.2 **MM-50 (MUST).** Actual data visibility and collection MUST match the user's reasonable expectation at the point of action; any collection or sharing beyond that MUST be disclosed and consented before it occurs (C-4, C-7). *Verify:* for each data touchpoint, expected audience == actual audience; no covert surveillance exists.

28.3 **MM-51 (MUST).** Privacy-relevant state (visibility, who-can-see, what-is-stored) MUST be inspectable and adjustable by the user in plain terms. *Verify:* a user can find, understand, and change their privacy posture without external help.

# 29. Safety Expectations

29.1 Expected model: users expect help to be reachable when something feels wrong, and expect the platform to protect, not expose, them.

29.2 **MM-52 (MUST).** Safety controls (block, report, leave, get help) MUST be discoverable, reachable within minimal steps from any relationship surface, and MUST never be gated behind cost or engagement (C-5 safety-reachable). *Verify:* from any people/communication surface, a safety control is reachable within a small fixed step budget.

29.3 **MM-53 (MUST).** Using a safety control MUST be low-friction and MUST NOT expose the reporting user to the reported party. *Verify:* safety actions are private and immediate; no retaliatory exposure.

# 30. Control and Autonomy

30.1 Expected model: users expect to be in charge; loss of control breeds distrust and anxiety.

30.2 **MM-54 (MUST).** Consequential system/AI actions MUST keep the human in control — assistance-not-authority; the user can review, override, and reverse (C-12 ethical-AI; C-8 reversibility). *Verify:* no automated action of consequence executes without user authority and a reversal path.

30.3 **MM-55 (MUST).** The product MUST NOT trap users — account exit, data export/deletion, and opt-out MUST be as easy as opt-in. *Verify:* exit paths exist and match entry effort.

# 31. Predictability

31.1 **MM-56 (MUST).** The same action in the same context MUST produce the same result; nondeterministic or context-shifting behavior MUST be avoided or clearly signaled. *Verify:* repeated identical actions yield identical outcomes; any variation is explained in advance.

# 32. Feedback Expectations

32.1 Expected model: users expect immediate, clear acknowledgment that an action registered and what it did.

32.2 **MM-57 (MUST).** Every user action MUST produce timely, perceivable, honest feedback about what happened and the resulting state (C-16 honest states). *Verify:* no action leaves the user unsure whether it worked; loading/empty/success/error states are truthful and present.

32.3 **MM-58 (MUST NOT).** Feedback MUST NOT fake success, hide partial failure, or imply completion of something still pending. *Verify:* optimistic UI never claims a durable result before it is durable, or clearly labels the pending state.

# 33. System Transparency

33.1 **MM-59 (MUST).** When the system acts on the user's behalf, filters, ranks, or personalizes, it MUST be able to answer "why am I seeing this / why did this happen" in plain language on request. *Verify:* consequential automated outcomes expose an honest, comprehensible rationale.

33.2 **MM-60 (MUST NOT).** Ranking/curation MUST NOT covertly encode commercial promotion as if it were relevance or trust; promoted content MUST be labeled (honesty-of-signal). *Verify:* paid/promoted placement is disclosed and distinguishable.

# 34. Human-AI Collaboration

34.1 Expected model: users either over-trust AI ("it must be right") or reject it; both are miscalibrated.

34.2 **MM-61 (MUST).** All AI output MUST be clearly labeled as AI, framed as assistance not authority, and bounded by user consent (C-12). *Verify:* AI-generated/assisted content is unmistakably labeled at the point of use.

34.3 **MM-62 (MUST).** AI MUST NOT present inference, prediction, or probability as established fact (C-2), and MUST NOT make consequential decisions about a person autonomously. *Verify:* AI statements about people are marked as inference with basis; consequential decisions retain human authority.

# 35. AI Trust Models

35.1 **MM-63 (MUST).** The interface MUST calibrate AI trust to actual reliability — neither inflating (false authority, false precision) nor hiding known limits. *Verify:* AI limitations and failure modes are disclosed where the user relies on the output.

35.2 **MM-64 (MUST NOT).** The product MUST NOT anthropomorphize AI to induce misplaced emotional trust or to obscure that a machine, not a person, is responding. *Verify:* users can always tell human from AI.

# 36. Confidence Indicators

36.1 Expected model: users read any number/badge as objective truth.

36.2 **MM-65 (MUST).** Confidence, match, compatibility, or score indicators MUST honestly represent uncertainty, MUST state what they mean and their basis, and MUST NOT imply false precision or certainty. *Verify:* each indicator has a defined, disclosed meaning and basis; uncertainty is visible.

36.3 **MM-66 (MUST NOT).** Such indicators MUST NOT be derived from or imply judgments based on appearance, caste, religion, region, complexion, or language (C-3). *Verify:* indicator inputs audited; none are protected/inferential-character attributes.

# 37. Recommendation Acceptance

37.1 Expected model: users accept recommendations more readily than they should and assume relevance = endorsement.

37.2 **MM-67 (MUST).** Recommendations MUST be explainable, declinable without penalty, and MUST separate relevance from paid promotion and from endorsement/guarantee. *Verify:* each recommendation offers "why this," an easy decline, and clear labeling of any commercial basis.

37.3 **MM-68 (SHOULD).** Recommendations SHOULD preserve user agency and diversity of options rather than narrowing into a manipulative funnel. *Verify:* recommendation sets do not collapse into single-path pressure.

# 38. Personalization Expectations

38.1 Expected model: users expect helpful tailoring but are alarmed by tailoring that reveals covert data use ("how did it know that?").

38.2 **MM-69 (MUST).** Personalization MUST use only consented data, MUST be explainable, and MUST be adjustable/resettable by the user (C-4, C-7). *Verify:* personalization inputs are consented, disclosed, and user-controllable; a user can see and change what drives it.

38.3 **MM-70 (MUST NOT).** Personalization MUST NOT create a covert profile of sensitive/protected characteristics or use them to shape opportunity. *Verify:* no protected-attribute-based tailoring exists.

# 39. Cognitive Frameworks (synthesis — Sambandh-specific rules)

This section synthesizes HCI, cognitive psychology, behavioral science, decision science, behavioral economics, usability engineering, interaction design, information science, and mental-model theory into Sambandh rules. It does not reproduce external doctrine; it binds it to the Constitution.

39.1 **MM-71 (MUST).** Design MUST minimize both the gulf of execution (make the right action obvious) and the gulf of evaluation (make the resulting state obvious). *Verify:* for each task, users know both how to act and what resulted, above thresholds.

39.2 **MM-72 (MUST).** The conceptual model MUST rely on real-world and cross-app conventions the user already holds (leverage transfer), overriding a convention only when a Tier 1–4 reason requires it, and then signaling the difference. *Verify:* deviations from established convention are justified by a higher tier and made visible.

39.3 **MM-73 (MUST).** Perceived affordances MUST match real affordances and signifiers MUST be honest — a thing that looks actionable is actionable and does what it appears to do. *Verify:* no false affordances; no decorative elements mistaken for controls.

39.4 **MM-74 (MUST — governing prohibition).** Insights from behavioral economics and persuasion (defaults, anchoring, framing, social proof, loss aversion, commitment, scarcity, reciprocity) MUST be used ONLY to reduce the user's effort and error in reaching the user's OWN goals, and MUST NEVER be weaponized to extract attention, data, money, or consent against the user's interest. This rule is subordinate to and enforces Article 4 Tiers 1 (safety/legality), 2 (consent/privacy), and 6 (emotional wellbeing/calm); any persuasive technique that trades a lower-tier gain (Tier 9 business/growth) for a higher-tier loss is prohibited. *Verify:* for every applied behavioral technique, reviewers record whose goal it serves; if the primary beneficiary is Sambandh at the user's expense, it is rejected.

39.5 **MM-75 (MUST).** Where frameworks conflict, resolution MUST follow the Article 4 lexicographic order, never a net/aggregate tradeoff. *Verify:* conflict decisions cite the tier that governed.

# 40. Cross-Cultural Mental Models

40.1 Expected model: conventions, reading direction, name structures, family/relationship norms, numerals, symbols, and color meanings vary by culture; Sambandh is India-first AND globally inclusive.

40.2 **MM-76 (MUST).** Models MUST NOT assume a single language, script, numeral system, name format, calendar, reading direction, or relationship norm (C-11). *Verify:* flows tested across multiple locales/scripts/numeral systems and name structures without breakage or misrecognition.

40.3 **MM-77 (MUST NOT).** No symbol, gesture, color, or metaphor whose meaning is safe in one culture MUST be relied upon as the sole carrier of critical meaning where it is ambiguous or offensive in another. *Verify:* critical meaning is redundant and locale-reviewed.

# 41. Age-Based Mental Models

41.1 Expected model: users span wide ages with different platform literacy, convention exposure, vision, dexterity, and risk awareness.

41.2 **MM-78 (MUST).** Core flows MUST be usable by low-tech-literacy and older users without assuming familiarity with recent platform idioms or gestures; essential actions MUST have a discoverable, non-hidden path. *Verify:* representative older/low-literacy users complete core tasks above first-attempt threshold.

41.3 **MM-79 (SHOULD).** Instructional and risk language SHOULD account for differing risk awareness across ages without patronizing any group. *Verify:* comprehension parity across age cohorts within tolerance.

# 42. Accessibility Mental Models

42.1 Expected model: users of assistive technology build models from a linearized, non-visual, or adapted experience and expect it to be complete and equal.

42.2 **MM-80 (MUST).** The accessible experience MUST convey the same model, state, and options as the visual one — meeting the WCAG 2.2 AA floor and the never-by-color/position/motion-alone rule (C-9). *Verify:* assistive-tech walkthrough yields equivalent comprehension, available actions, and safety access; no information is visual-only.

42.3 **MM-81 (MUST).** Safety, consent, and error information MUST be fully available to assistive technology. *Verify:* Tier 1–2 content is programmatically exposed and announced.

# 43. Expert versus Beginner Mental Models

43.1 Expected model: beginners need guidance and recognition; experts need speed and recall-based shortcuts. Both use the same product.

43.2 **MM-82 (MUST).** The interface MUST serve beginners without training AND MUST NOT force experts through unavoidable hand-holding; guidance MUST be dismissible/non-blocking and shortcuts additive. *Verify:* beginner completes unaided; expert can bypass introductory scaffolding.

43.3 **MM-83 (SHOULD).** Accelerators for experts SHOULD reuse, not contradict, the beginner model. *Verify:* shortcuts map onto the same conceptual structure.

# 44. Returning User Mental Models

44.1 Expected model: a returning user assumes the product is where they left it and remembers their prior spatial map, possibly stale.

44.2 **MM-84 (MUST).** Returning users MUST be re-oriented to what changed since last use without being forced to relearn stable structures; changes to consequential behavior MUST be disclosed. *Verify:* meaningful changes are surfaced on return; unchanged structures remain recognizable.

44.3 **MM-85 (SHOULD).** State (drafts, progress, preferences, consent) SHOULD persist across sessions so the returning model holds. *Verify:* prior state restored or its absence honestly explained.

# 45. Power User Mental Models

45.1 Expected model: power users build precise, detailed models and depend on stability and depth.

45.2 **MM-86 (MUST).** Power-user capabilities MUST NOT weaken safety, consent, or dignity guarantees for themselves or others (no privilege to bypass Tier 1–4). *Verify:* advanced features audited against Tiers 1–4; none grant harmful reach.

45.3 **MM-87 (SHOULD).** Stable, learnable depth SHOULD be provided for high-frequency users. *Verify:* efficiency features exist without destabilizing the base model.

# 46. Long-Term User Mental Models

46.1 Expected model: over months/years users accumulate a deep model and a relationship history; instability or betrayal is especially costly here.

46.2 **MM-88 (MUST).** Long-term stability of core concepts, structures, and guarantees MUST be preserved; changes MUST be evolutionary, announced, and reversible where feasible (C-8, longevity C-16). *Verify:* longitudinal change log shows no unannounced breaking of established models.

46.3 **MM-89 (MUST).** Historical user data and relationships MUST be treated with continuity and dignity — not silently reset, repurposed, or exposed by later changes. *Verify:* migrations preserve meaning and consent; no retroactive exposure.

# 47. Future User Evolution

47.1 Expected model: user expectations shift as external norms evolve; today's convention may become tomorrow's confusion.

47.2 **MM-90 (SHOULD).** The mental-model baseline SHOULD be re-validated periodically against evolving user expectations and revised through the SHIG-0001 lifecycle, strengthening (never weakening) Tier 1–4 guarantees. *Verify:* scheduled re-validation exists; changes follow versioning and tier-strengthening rules.

47.3 **MM-91 (MUST).** Any future capability (new AI, new automation, new data use) MUST be introduced only after its expected user model is stated and validated against this spec. *Verify:* no new consequential capability ships without a stated, tested model.

# 48. Decision Framework (for any design decision)

For each design decision, the following MUST be answered and recorded before build.

48.1 **How users are expected to think.** State the expected user model (MM-1) in one sentence: what the user believes this is and will do.

48.2 **How incorrect assumptions are prevented.** Identify the top plausible wrong beliefs; for each, the design MUST either make the wrong belief impossible to form, make it cheap to correct (MM-8, MM-40, reversibility), or block release if it risks Tier 1–4 harm (MM-3).

48.3 **How confusion is detected.** Define the observable signals of a model mismatch for this decision (task failure, hesitation, error, wrong path, support contacts, verbalized surprise) and the test that surfaces them (§ Validation).

48.4 **How confidence is increased and uncertainty reduced.** Specify the truthful cues that raise decision confidence (clear outcome, scope, reversibility — MM-34/35) without withholding material information (MM-30).

48.5 **How expectations stay consistent platform-wide.** Confirm the decision reuses existing patterns (MM-10, MM-22, MM-72); any deviation names the higher tier it serves (SHIG-0001) and is signaled to users (MM-72).

48.6 **Tier check.** Confirm no gain at a lower tier is bought with a loss at a higher tier (Article 4); record the governing tier for any tradeoff.

Decision table:

| Question | Required output | Blocks release if… |
|---|---|---|
| Expected model stated? | One-sentence model artifact | Missing or vague |
| Wrong beliefs enumerated? | List + mitigation each | Any Tier 1–4 wrong belief unmitigated |
| Mismatch detectable? | Named signals + test | No test defined |
| Confidence raised honestly? | Truthful cues listed | Confidence gained by hiding material info |
| Consistent platform-wide? | Pattern reused or deviation justified | Silent inconsistency |
| Tier order respected? | Governing tier recorded | Lower-tier gain over higher-tier loss |

# 49. Validation (measurable mental-model alignment)

49.1 **MM-92 (MUST).** Consequential flows MUST be validated against the metrics below with pre-registered acceptance/rejection thresholds set per flow by risk tier (higher-risk flows require stricter thresholds). Thresholds are recorded per flow; this spec mandates the method and the accept/reject logic, not universal numeric constants.

49.2 Metrics and criteria:

| Metric | Definition | Accept | Reject |
|---|---|---|---|
| Task-success rate | Users completing the intended task unaided | Meets/exceeds flow threshold | Below threshold |
| Error rate | Rate of wrong/harmful actions per attempt | At/below threshold; zero Tier 1–2 errors | Any Tier 1–2 error, or above threshold |
| Time-to-comprehension | Time to correctly state what a screen/feature does | At/below threshold | Above threshold |
| First-attempt success | Correct on first try without correction | Meets/exceeds threshold | Below threshold |
| Confidence rating | Self-reported certainty before/after consequential action | Meets threshold, with honest info | High confidence built on withheld info → reject |
| Trust rating | Calibrated trust vs. actual reliability | Calibrated within tolerance | Over- or under-trust beyond tolerance |
| Discoverability rate | Users who find a needed function (esp. safety/consent) unaided | Safety/consent controls meet high floor | Any safety/consent control below floor |

49.3 **MM-93 (MUST).** A flow that fails any Tier 1–2 criterion (e.g., a discoverable safety control below floor, any Tier 1–2 error) MUST NOT ship regardless of performance on other metrics (lexicographic, Article 4). *Verify:* release records show no override of a failed Tier 1–2 criterion by other gains.

49.4 **MM-94 (MUST).** Validation evidence MUST be recorded and retained (evidence-over-opinion, C-17); design claims of alignment MUST cite data, not assertion. *Verify:* each shipped consequential flow links to its validation record.

# Compliance / Review Checklist

C-01 Expected user model artifact exists for the feature (MM-1) and is truthful, not merely convenient (MM-2).
C-02 Any user↔system divergence is tier-classified; Tier 1–4 divergences block release (MM-3).
C-03 Safe/private/reversible path is the lowest-effort, most visible path; protective defaults; fail-secure (MM-6, MM-31).
C-04 No cognitive limitation is exploited against the user; zero dark patterns; no manufactured urgency/compulsion (MM-7, MM-13, MM-21, MM-33, MM-74).
C-05 Recognition over recall; progress persists; no forced re-entry (MM-8, MM-9, MM-16).
C-06 Identical look ⇒ identical behavior; patterns hold platform-wide; consequential controls not relocated (MM-10, MM-22, MM-20).
C-07 No inference of character/worth/trust from appearance/caste/religion/region/language anywhere, including scores/ranking/personalization (MM-23, MM-46, MM-66, MM-70).
C-08 Meaning never by color/position/motion alone; WCAG 2.2 AA floor; accessible experience is equivalent (MM-24, MM-80, MM-81).
C-09 Material consent/cost/safety/risk info never hidden by progressive disclosure (MM-30).
C-10 Consequential actions show outcome/scope/audience/reversibility with confirm + undo (MM-34, MM-47, MM-48).
C-11 Errors honest, non-blaming, with data/consent impact + recovery; foreseeable errors prevented (MM-40, MM-41).
C-12 Risk surfaced truthfully and proportionately at decision time; never over/understated (MM-42, MM-43).
C-13 Calm; no exploitation of hope/loneliness/FOMO/emotion for spend/engagement (MM-44, MM-45).
C-14 Safety controls discoverable, minimal-step, uncgated, private, non-retaliatory (MM-52, MM-53).
C-15 Data visibility/collection matches user expectation; consent before data; privacy inspectable/adjustable; no covert surveillance (MM-50, MM-51, MM-69).
C-16 Human retains control; easy exit/export/delete equals entry effort; assistance-not-authority (MM-54, MM-55).
C-17 Every action gives honest, timely feedback; no faked success/hidden failure (MM-57, MM-58).
C-18 Personalization/ranking explainable; promoted content labeled; "why this" available (MM-59, MM-60, MM-67, MM-69).
C-19 All AI labeled, assistance-not-authority, consent-bounded; inference not shown as fact; no autonomous consequential decisions; human/AI always distinguishable (MM-61, MM-62, MM-64).
C-20 Confidence/match indicators honest about uncertainty, defined basis, no false precision, no protected-attribute inputs (MM-65, MM-66).
C-21 Cross-cultural, age, expertise, returning, power, and long-term models all served without weakening Tier 1–4 (MM-76–89).
C-22 New capabilities ship only after their expected model is stated and validated (MM-90, MM-91).
C-23 Decision Framework (§48) completed and recorded; governing tier logged for tradeoffs.
C-24 Validation (§49) run with pre-registered thresholds; Tier 1–2 failure blocks release; evidence retained (MM-92, MM-93, MM-94).

# Anti-patterns

A-01 **Convenient-fiction conceptual model** — a metaphor implying capabilities/guarantees the system lacks. *Occurs:* prioritizing simplicity over truth. *Prevent:* MM-2, MM-73 (honest affordances/signifiers).
A-02 **Learn-the-system tax** — forcing users to memorize codes/paths/prior screens. *Occurs:* exposing system model instead of designing a conceptual one. *Prevent:* MM-8, MM-26.
A-03 **Twin controls, different behavior** — identical-looking elements acting differently. *Occurs:* reuse without semantics. *Prevent:* MM-10.
A-04 **Habit trap relocation** — moving a harmful action into a spot muscle memory treats as safe. *Occurs:* layout churn. *Prevent:* MM-20.
A-05 **Manufactured urgency/scarcity** — fake timers, "hurry" pressure. *Occurs:* Tier 9 over Tier 6. *Prevent:* MM-13, MM-44.
A-06 **Dark patterns** — confirmshaming, roach-motel, asymmetric friction, pre-checked consent, hidden costs. *Occurs:* weaponized choice architecture. *Prevent:* MM-31–33, MM-74.
A-07 **Disclosure-as-concealment** — hiding consent/cost/safety info behind optional expansion. *Occurs:* misapplying progressive disclosure. *Prevent:* MM-30.
A-08 **False confidence/precision** — scores/badges implying certainty or objectivity they lack. *Occurs:* metric worship. *Prevent:* MM-65, MM-35.
A-09 **Inference-as-fact** — presenting AI/prediction/appearance-based inference as established truth, or coupling protected attributes to trust/quality. *Occurs:* violating honesty-of-signal and non-inference. *Prevent:* MM-23, MM-62, MM-66.
A-10 **Silent failure / faked success** — claiming completion of pending/partial actions. *Occurs:* optimistic UI without honesty. *Prevent:* MM-57, MM-58.
A-11 **Covert surveillance / expectation gap** — collecting/sharing beyond user's reasonable expectation. *Occurs:* Tier 9 over Tier 2. *Prevent:* MM-50, MM-69.
A-12 **Buried safety** — block/report/help gated by cost, depth, or engagement. *Occurs:* deprioritizing Tier 1. *Prevent:* MM-52, MM-53.
A-13 **Roach-motel account** — easy to join, hard to leave/export/delete. *Occurs:* retention over autonomy. *Prevent:* MM-55.
A-14 **Compulsion loops** — streaks/variable rewards for return-frequency. *Occurs:* metric-first. *Prevent:* MM-21.
A-15 **Anthropomorphized AI** — machine posing as a caring human to induce trust. *Occurs:* engagement over honesty. *Prevent:* MM-64, MM-61.
A-16 **Monocultural assumption** — single language/script/numeral/name/reading-direction baked in; culture-specific symbol as sole carrier of critical meaning. *Occurs:* ignoring plurality. *Prevent:* MM-76, MM-77.
A-17 **Expert-only or beginner-only bias** — forcing hand-holding on experts or leaving beginners stranded. *Occurs:* single-persona design. *Prevent:* MM-82.
A-18 **Unannounced model break** — silently changing structure/behavior a long-term user relies on. *Occurs:* neglecting longevity. *Prevent:* MM-84, MM-88.
A-19 **Weaponized behavioral economics** — persuasion techniques serving Sambandh at user expense. *Occurs:* Tier 9 over Tiers 1/2/6. *Prevent:* MM-74.
A-20 **Assertion over evidence** — claiming alignment without validation data. *Occurs:* opinion over evidence. *Prevent:* MM-92, MM-94.

# Open Questions

Q-01 Should per-flow validation thresholds be centrally standardized by risk tier, or set per flow within a mandated band? (Interacts with MM-92.)
Q-02 What is the mandated cadence for periodic mental-model re-validation as external norms evolve (MM-90)?
Q-03 How should "reasonable user expectation" (MM-50) be operationalized and evidenced across highly divergent cultural privacy norms without lowering the floor?
Q-04 What standardized, honest visual/textual grammar should represent verified-vs-unverified and fact-vs-inference across all verticals (defers to SHIG visual specs; needs a cross-spec convention)?
Q-05 What are the acceptable tolerances for "calibrated" trust (MM-63, trust-rating metric) before over-/under-trust is deemed a defect?
Q-06 How should model-mismatch signals be instrumented without introducing surveillance that itself violates MM-50 (privacy-preserving usability measurement)?
Q-07 What governance approves deviations from established conventions (MM-72) and records the higher tier served?

# Revision History

| Version | Date | Status | Author | Notes |
|---|---|---|---|---|
| 1.0.0 | 2026-07-26 | Active | Chief Design Officer, Sambandh | Initial issuance of SHIG-0006 User Mental Models Specification. Establishes permanent requirement IDs MM-1 through MM-94, Decision Framework, Validation methodology, Anti-patterns, and Compliance Checklist. Subordinate to SHIG-0000 (Constitution) and SHIG-0001 (rule grammar); Tier 1–4 guarantees may only be strengthened in future revisions. |
# Specification ID

SHIG-0009

# Specification Name

Emotional Design System Specification

# Version

1.0.0

# Status

Active

---

# 1. Purpose

**ED-1 (MUST).** Every Sambandh interaction SHALL be designed with explicit awareness that it influences human emotion, and SHALL do so only in service of the user's wellbeing and the health of a real relationship — never in service of engagement, retention, session length, or any product metric.
*Why:* Emotion is not a side-effect of interface; it is a designed material. Undesigned emotion is still designed — by omission. Constitution C-11 (relationship-first-not-metric-first) makes the user's flourishing the definition of success.
*Implication:* Any emotional outcome must be traceable to a legitimate user benefit; if the only beneficiary is the business, the technique is prohibited.
*Reviewer verifies:* For any surface, the named intended emotion and the user benefit it serves are documented; no surface cites a business metric as the emotion's justification.

**ED-2 (MUST).** This specification governs how design engineers **trust, safety, respect, belonging, confidence, hope, and calm**, and how it REFUSES to manufacture **fear, urgency, compulsion, addiction, artificial intimacy, or false reassurance**.
*Why:* A premium relationship ecosystem earns loyalty through dignity, not through exploitation of psychological vulnerability. Article 4 places safety (T1), consent/privacy (T2), and emotional wellbeing (T6) above craft (T8) and business (T9).
*Reviewer verifies:* Each emotional technique maps to a permitted state (§9) or is rejected as a prohibited state (§10).

# 2. Scope

**ED-3 (MUST).** This specification applies to all user-facing and user-affecting surfaces: copy, states, timing, pacing, notifications, recommendations, AI conversation, celebrations, progress, onboarding, offboarding, support, conflict resolution, and every lifecycle stage in §12.
*Applies to:* human-authored content, algorithmic outputs, and AI-generated content equally.
*Does not authorize:* any implementation detail (color, type, motion, component, platform) — those belong to lower-tier craft specifications and MUST comply with, and MUST NOT contradict, this one.

**ED-4 (MUST).** Where this specification and a craft/visual specification conflict, this specification governs to the extent it protects a higher Article 4 tier (safety, consent/privacy, honesty, dignity, wellbeing). Where this specification would itself contradict SHIG-0000, the Constitution governs.

# 3. The Role of Emotion — Foundational Model

**ED-5 (MUST).** Design SHALL treat the following relationships as established operating assumptions and design to their ethical direction, never their exploitative direction:

| # | Relationship | Ethical direction (design FOR) | Exploitative direction (design AGAINST) | Reviewer verifies |
|---|---|---|---|---|
| ED-5.1 | Emotion ↔ **Trust** | Calm, honest, consistent signals build durable trust | Manufactured warmth or false certainty to extract action | No surface simulates trustworthiness it has not earned (see §14 authenticity) |
| ED-5.2 | Emotion ↔ **Decision-making** | Reduce emotional noise so the user decides clearly | Induce fear/urgency/scarcity to bias the decision | No decision point carries an emotion the user did not need to decide well |
| ED-5.3 | Emotion ↔ **Memory** | Leave a calm, dignified residual memory of each interaction | Engineer emotional spikes to make the product "sticky" | Peak/end emotional tone is calm-positive, not agitated |
| ED-5.4 | Emotion ↔ **Motivation** | Support intrinsic motives (connection, growth, meaning) | Substitute extrinsic hooks (streaks, points) for real value | Motivation mechanics tie to relationship value, not to returning per se |
| ED-5.5 | Emotion ↔ **Belonging** | Affirm the user is respected and included as they are | Condition belonging on spending, activity, or comparison | Belonging is never gated behind payment or performance |
| ED-5.6 | Emotion ↔ **Human dignity** | Every emotional cue affirms worth without inference | Emotion derived from inferred character/appearance/identity | No emotional message depends on inferring who the user "is" (C-2/C-3) |

*Why it exists:* These couplings are how interface becomes psychology. Naming them makes the ethical and unethical uses distinguishable and reviewable.

# 4. Long-Term Emotional Wellbeing Philosophy

**ED-6 (MUST).** Emotional design SHALL optimize for the user's state **after closing the app and over months and years**, not during the session.
*Why:* Relationship-first success (C-11) is realized off-app, in real life. A design that makes the session pleasant but life worse has failed.
*Reviewer verifies:* Success indicators (§13) measure durable states (trust, comfort, relationship quality), never raw time-in-app.

**ED-7 (MUST).** Design SHALL prefer under-stimulation to over-stimulation and SHALL leave the user calmer, clearer, and more autonomous than it found them (C-10 calm-over-stimulation).
*Implication:* Silence, absence, and "nothing needs your attention" are valid, first-class designed states.
*Reviewer verifies:* At least one legitimate path exists to a calm empty/complete state on every recurring surface; the product never fabricates activity to avoid emptiness.

**ED-8 (SHOULD).** Design SHOULD actively support graceful exit and reduced dependence, including states where the user needs the product less because the relationship is succeeding.
*Deviation* requires recorded justification naming a higher tier (e.g., safety follow-up).

# 5. Ethics of Emotional Design

**ED-9 (MUST).** Emotional influence is permitted ONLY when all four conditions hold: (a) it serves the user's stated or evident interest; (b) it is honest; (c) it preserves the user's capacity to choose otherwise; (d) it would survive disclosure — the user, told exactly how and why the emotion was designed, would not feel deceived.
*Reviewer verifies:* The "disclosure test" is documented for any surface intended to move emotion materially (celebration, reassurance, encouragement, nudges).

**ED-10 (MUST NOT).** Design MUST NOT exploit psychological vulnerability — loneliness, grief, insecurity, fear of missing out, fear of rejection, or need for validation — to drive any action.
*Article 4:* violates T2/T6; C-10/C-12.
*Reviewer verifies:* No flow's efficacy depends on the user being in a vulnerable emotional state.

**ED-11 (MUST).** Emotional design SHALL fail safe: when the correct emotional response is uncertain, choose the calmer, more neutral, less persuasive option.

# 6. Boundaries of Emotional Influence

**ED-12 (MUST).** Design **MAY** to a user's emotion: reassure with true information; reduce anxiety by increasing clarity and control; celebrate genuine, user-meaningful milestones proportionately; encourage effort the user has chosen; provide comfort during difficulty; affirm dignity and belonging unconditionally; express empathy; restore calm after error.

**ED-13 (MUST NOT).** Design **MUST NOT** to a user's emotion: manufacture fear, urgency, scarcity, guilt, shame, jealousy, or inadequacy; create compulsion or addictive loops; simulate intimacy, affection, or human relationship that does not exist; reassure falsely or hide uncertainty; weaponize belonging or approval; induce comparison; or profile emotion to target persuasion (see §11.13).
*Reviewer verifies:* Each shipped emotional technique appears on the MAY list and none on the MUST NOT list; ambiguous cases are escalated to governance (§15).

# 7. Emotional Transparency

**ED-14 (MUST).** When an interaction is deliberately shaped to influence emotion in a non-obvious way, its purpose SHALL be honest and legible; the product SHALL NOT conceal why a message, prompt, or celebration appears.
*Why:* Honesty-of-signal (C-2) extends to emotional signal, not only factual signal.
*Reviewer verifies:* No emotional prompt misrepresents its origin, trigger, or intent (e.g., a marketing nudge disguised as a safety message, or an automated message implying human care).

**ED-15 (MUST).** AI-generated emotional content SHALL be labeled as AI, SHALL present itself as assistance not authority, and SHALL acknowledge uncertainty rather than project false confidence (C-13).

# 8. Emotional Authenticity

**ED-16 (MUST).** Every expressed emotion SHALL be true — the product SHALL feel what its words claim: congratulations only for real achievement, concern only where concern is warranted, warmth that reflects genuine respect.
*Why:* Inauthentic emotion is a lie in another modality and erodes trust irreversibly.
*Reviewer verifies:* No celebratory, empathetic, or reassuring message fires on an event that does not warrant it; tone matches truth of state (C-14 honest states).

**ED-17 (MUST NOT).** Design MUST NOT fabricate social or emotional signals (fake presence, fake demand, fake affection, fake scarcity, invented "someone likes you" bait).

# 9. Emotional Framework — Positive States to Cultivate

**ED-18 (MUST).** Design SHALL cultivate the following states only within the stated boundaries. For any surface, name the target state and satisfy its row.

| State | Purpose | When to encourage | When to AVOID | Success indicator | Misuse risk | Ethical boundary |
|---|---|---|---|---|---|---|
| Trust | Basis of all relationship action | From first contact; verification; safety | Never to mask uncertainty | Users act with confidence, low re-checking | Manufactured/false trust | Must be earned by true signal (C-2) |
| Safety | Enable vulnerability | Throughout; esp. contact, sharing | Never as a threat ("unsafe unless…") | Users report feeling safe; safety tools used | Fear framing | Safety is stated, never sold |
| Respect | Affirm worth | Always | Never conditionally | Perceived-respect score high | Flattery | Respect ≠ praise; unconditional |
| Belonging | Inclusion | Onboarding, community | When it excludes others | Users feel they fit | Gating belonging behind pay/activity | Never conditioned on spend/metrics |
| Acceptance | Reduce shame | Profile, difficulty, exit | Never to excuse harm | Low self-editing from fear | "Accept anything" harm | Bounded by safety/legality |
| Calmness | Reduce load | Default everywhere | Never fake calm over real risk | Low agitation signals | Sedating real alarms | Calm must not hide danger (T1) |
| Confidence | Enable decisions | Decisions, learning | Never overconfidence | Fewer abandoned decisions | Inflated certainty | Confidence must match reality |
| Hope | Sustain effort | Discovery, setbacks | Never false hope | Continued healthy effort | False promises | Hope grounded in truth |
| Joy | Reward the real | Genuine milestones | Manufactured joy | Proportionate delight | Dopamine engineering | Joy tracks real value only |
| Empathy | Feel understood | Support, conflict, grief | Never simulated by AI as human | Users feel heard | Fake empathy | AI empathy labeled (ED-15) |
| Compassion | Ease suffering | Difficulty, failure states | Never performative | Users feel cared for | Weaponized guilt | Care not leverage |
| Gratitude | Mutual respect | Contributions, endings | Never to obligate | Reciprocal goodwill | Guilt-tripping | No manufactured indebtedness |
| Commitment | Support real bonds | Relationship building | Never to lock-in to product | Deepening real relationships | Product lock-in as "commitment" | Commitment is to people, not app |
| Curiosity | Healthy exploration | Discovery, learning | Never as bait loop | Intentional exploration | Infinite-feed hooks | No compulsive pull |
| Optimism | Forward energy | Onboarding, renewals | Never denial of risk | Balanced outlook | Toxic positivity | Must coexist with honesty |
| Reassurance | Reduce anxiety | Errors, waits, safety | Never false | Anxiety drops, trust holds | False reassurance | Only true reassurance (C-14) |
| Encouragement | Support chosen effort | Learning, profile, recovery | Unwanted pressure | Users continue by choice | Coercive nudging | Intrinsic, opt-in |
| Achievement | Recognize real progress | Verified milestones | Trivial/fake milestones | Meaningful pride | Vanity metrics | Milestone must be real |
| Pride | Dignity in effort | Growth, contribution | Comparison-based pride | Self-respect | Superiority over others | No ranking against people |
| Purpose | Meaning | Long-term usage | Manufactured mission | Sense of "why" | Cult-like framing | Honest purpose |
| Growth | Development | Learning, reflection | Endless-improvement pressure | Real skill/insight gained | Perfection pressure | Bounded, self-paced |
| Reflection | Considered action | Decisions, conflict, renewal | Rumination loops | Better decisions | Analysis paralysis | Support, don't trap |
| Forgiveness | Repair | Conflict resolution, error | Excusing harm | Repaired relationships | Pressure to forgive | Never coerced |
| Patience | Reduce urgency | Verification, matching | Never to stall service | Calm waiting | Cover for slowness | Patience ≠ hidden failure |
| Emotional stability | Steadiness | Throughout | Numbing | Low volatility in experience | Flattening real feeling | Stability not suppression |
| Psychological comfort | Ease of being | Everywhere | Comfort that hides risk | Users at ease | Complacency to danger | Comfort under safety |
| Connection | Real human bonds | Conversations, family | Product-as-substitute | Real connections form | Parasocial product bond | Connect people, not to app |
| Meaning | Significance | Long-term, milestones | Fabricated significance | Durable satisfaction | Inflated meaning | Honest weight |
| Emotional security | Safe to be vulnerable | Sharing, relationship | False security | Users share appropriately | Overexposure encouraged | Security is real + privacy-backed |
| Future confidence | Belief in what's ahead | Renewals, planning | False promises of outcome | Grounded optimism | Guaranteeing outcomes | Never promise relationship results |

# 10. Negative Emotions — Occurrence, Response, Recovery, Limits

**ED-19 (MUST).** Where a negative emotion naturally arises, design SHALL apply the mandated response and provide a recovery path; design SHALL NOT manufacture, amplify, or prolong any negative emotion to drive behavior.

| Emotion | When it naturally occurs | Mandated design response | How recovery occurs | Ethical limit |
|---|---|---|---|---|
| Anxiety | Waits, decisions, safety, sharing | Increase clarity + control + true reassurance | State restored to calm/known | Never induce anxiety to convert |
| Fear | Safety threats, unknowns | Honest info + safety tools + control | Threat addressed or clarified | Never fear-based engagement |
| Confusion | Complex tasks, states | Reduce, clarify, one clear next step | User understands + proceeds | Never exploit confusion to nudge |
| Loneliness | Discovery, quiet periods | Dignified support; real connection paths | Genuine connection or calm solitude | Never exploit loneliness (ED-10) |
| Jealousy | Comparison exposure | Remove comparison surfaces | No comparison presented | Never engineer jealousy |
| Envy | Others' visible success | Avoid status displays | N/A — not surfaced | No envy mechanics |
| Shame | Rejection, mistakes, profile | Normalize, remove blame, protect privacy | Dignity restored | Never shame as motivator |
| Embarrassment | Public error, exposure | Private handling, gentle recovery | Discreet correction | Never expose to pressure |
| Rejection | Non-mutual interest | Neutral, private, non-punitive framing | Move forward with dignity | Never dramatize rejection |
| Isolation | Low activity | Optional, gentle re-connection | User re-engages by choice | Never guilt for absence |
| Frustration | Friction, failure | Remove friction; clear recovery | Task completes | Never blame the user |
| Overwhelm | Too many inputs/choices | Reduce load; sequence; defer | Manageable state | Never overload to push default |
| Distrust | Broken expectation | Transparency + correction | Trust rebuilt via truth | Never paper over with spin |
| Uncertainty | Ambiguous states | Show what's known/unknown honestly | Clarity or honest "unknown" | Never fake certainty |
| Decision fatigue | Many decisions | Fewer, better-framed choices | Confident decision | Never exploit fatigue for defaults |
| Information fatigue | Excess content | Summarize; prioritize; stop | User informed, not flooded | Never flood to obscure |
| Social pressure | Peer/activity cues | Remove pressure cues | Self-directed action | Never manufacture pressure |
| Comparison anxiety | Rankings, metrics | Eliminate ranking of people | No comparison shown | Never comparison mechanics |
| Manipulation (felt) | Dark patterns | Prohibited at source | Not applicable | Prohibited (§11.12) |
| Addiction | Compulsive loops | Prohibited at source; add friction/limits | Reduced use by design | Prohibited (C-10/C-12) |
| Dependency | Over-reliance | Support autonomy + exit | Reduced need over time | Prohibited as goal (ED-8) |

# 11. Emotional Design Principles

**ED-20 Emotional safety (MUST).** No interaction shall make the user feel judged, exposed, unsafe, or diminished. *Verify:* worst-case emotional read of each state is neutral or better.

**ED-21 Predictability (MUST).** Emotional outcomes of actions SHALL be foreseeable; the product must not surprise the user into unwanted feeling. *Verify:* actions declare consequence before commitment.

**ED-22 Consistency (MUST).** The product's emotional character (calm, respectful, honest) SHALL be uniform across surfaces and time. *Verify:* no surface breaks tone for conversion.

**ED-23 Recovery (MUST).** Every negative or error state SHALL offer a dignified path back to calm and control (reversibility, C-7). *Verify:* no dead-end distress states exist.

**ED-24 Reinforcement & ED-25 Positive reinforcement (MUST).** Reinforcement SHALL attach only to genuine, user-meaningful behavior and SHALL be proportionate; it SHALL NOT escalate to sustain engagement. *Verify:* reward frequency/intensity does not increase to prevent disengagement.

**ED-26 Intrinsic-over-extrinsic motivation (MUST).** Design SHALL prioritize intrinsic motives (connection, growth, meaning) over extrinsic tokens (points, streaks, badges); extrinsic devices MAY exist only as honest, low-salience acknowledgments and MUST NOT become the reason to return. *Verify:* removing extrinsic tokens does not collapse the value proposition.

**ED-27 Emotional feedback, timing & pacing (MUST).** Emotional responses SHALL be timely, proportionate, and paced to reduce load; the product SHALL NOT rush the user or exploit timing (e.g., prompts at emotionally raw moments). *Verify:* no persuasive prompt is timed to a moment of distress or elevated arousal.

**ED-28 Emotional personalization — consent-bounded (MUST / MUST NOT).** Personalizing emotional tone or content SHALL require the user's informed consent, SHALL be reversible, and MUST NOT be derived from inferred character, appearance, complexion, caste, religion, region, or language (C-3 non-inference). *Verify:* personalization inputs are consented and identity-neutral; an off switch exists and is respected.

**ED-29 Emotional accessibility (MUST).** Emotional meaning SHALL never be conveyed through a single channel and SHALL meet WCAG 2.2 AA; comfort, reassurance, and safety cues MUST be perceivable regardless of sensory, cognitive, or literacy differences (C-8). *Verify:* every emotional cue has a redundant, accessible encoding.

**ED-30 Cross-cultural & age-appropriate emotional design (MUST).** Emotional expression SHALL be India-first and globally inclusive, avoiding assumptions that a cue means the same across cultures, generations, or contexts; it SHALL be appropriate to the user's life stage. *Verify:* emotional cues tested against plural interpretations; no cue that is respectful in one culture reads as shame/insult in another goes unflagged.

**ED-31 AI emotional intelligence with human oversight (MUST).** AI MAY recognize and respond to emotion only as labeled assistance, within consent, acknowledging uncertainty, and under human oversight for consequential emotional situations (safety, grief, crisis); AI MUST NOT simulate human affection or authority (C-13). *Verify:* consequential emotional AI paths have a human escalation route and are labeled.

# 12. Emotional Journey — Desired Outcome per Lifecycle Stage

**ED-32 (MUST).** Each stage SHALL be designed to the desired emotional outcome and SHALL avoid the noted anti-emotion.

| Stage | Desired emotional outcome | Must avoid |
|---|---|---|
| Discovery | Calm curiosity; "this is trustworthy and for me" | Hype, FOMO, pressure |
| Onboarding | Safety, welcome, control | Overwhelm, coercion to over-share |
| Verification | Reassurance, dignity, fairness | Suspicion framing, shame |
| Profile creation | Acceptance, self-respect, autonomy | Comparison, inadequacy |
| Compatibility discovery | Grounded hope, honest expectation | False promise, inference-as-fact |
| Conversations | Emotional safety, genuine connection | Pressure to respond, artificial intimacy |
| Relationship building | Trust, commitment to people | Product lock-in, urgency |
| Membership | Confidence in value, respect | Guilt, dark-pattern upsell |
| Gift Pass | Generosity, warmth, clarity | Obligation, manipulation of giver/receiver |
| Family engagement | Belonging, respect across generations | Surveillance feel, coercion |
| Events | Anticipation, inclusion, safety | Scarcity pressure |
| Learning | Growth, encouragement, patience | Perfection pressure |
| Community | Belonging, psychological safety | Comparison, status hierarchy |
| Support | Reassurance, being heard, competence | Blame, abandonment |
| Conflict resolution | Fairness, forgiveness (uncoerced), calm | Taking sides, pressure to reconcile |
| Achievements | Proportionate pride, meaning | Vanity, addiction loops |
| Renewals | Confidence, honest value, autonomy | Fear of loss, urgency, guilt |
| Long-term usage | Emotional stability, purpose, comfort | Fatigue, dependency |
| Offboarding | Dignity, gratitude, clean exit | Guilt-trips, obstruction |
| Re-engagement | Gentle welcome-back, no judgment | Guilt for absence, FOMO bait |

# 13. Measurement

**ED-33 (MUST).** Emotional design SHALL be measured by wellbeing and relationship-quality indicators, NOT by raw engagement. Raw engagement (sessions, time-on-app, opens, streaks) MUST NOT be an acceptance criterion for any emotional design and MUST NOT be optimized as a proxy for success.

| Metric | Acceptance (ship/keep) | Rejection (block/revert) |
|---|---|---|
| Perceived trust | Stable or rising with honest signal | Rises only via false certainty |
| Perceived confidence | Users decide with less hesitation | Confidence inflated beyond reality |
| Belonging | Inclusion felt across groups | Belonging correlated with spend |
| Psychological safety | Users report feeling safe/unjudged | Any group reports feeling exposed |
| Emotional comfort | Low agitation; calm residual | Comfort achieved by hiding risk |
| Emotional clarity | Users understand state/next step | Clarity traded for persuasion |
| Emotional stability | Low involuntary volatility | Volatility engineered for stickiness |
| Perceived respect | High and equitable across cohorts | Any cohort reports disrespect |
| Long-term satisfaction | Rising over months | Rises short-term, falls long-term |
| Relationship quality | Real relationships form/deepen | Product bond substitutes for real bond |
| User wellbeing | Neutral-to-positive off-app effect | Any measurable off-app harm |
| Retention QUALITY | Users stay because value is real, and can leave freely | Retention driven by friction, fear, or compulsion |

**ED-34 (MUST).** Any emotional intervention that improves an engagement number while degrading any wellbeing/relationship-quality metric SHALL be rejected regardless of business upside (Article 4: T6 > T9).

**ED-35 (SHOULD).** Emotional metrics SHOULD be collected with consent, aggregated, privacy-preserving, and never used to build persuasion-targeting emotional profiles (ED-36).

# 14. Ethics Hard Rules (Persuasion, Notifications, AI, Gamification, Retention)

**ED-36 Emotional profiling (MUST NOT).** Building or using a model of a user's emotional state/traits to target persuasion is prohibited; any consented affective feature MUST NOT infer character and MUST NOT feed retention/upsell (C-3, T2).

**ED-37 Dark patterns (MUST NOT).** Confirmshaming, forced continuity, roach-motel exits, disguised ads, bait-and-switch, nagging, obstruction, and false hierarchy are prohibited. *Detect:* any flow that is easier to enter than to leave, or that uses shame/guilt in copy.

**ED-38 Dependency & addiction (MUST NOT).** Variable-reward loops, infinite feeds engineered for compulsion, streak-anxiety, and manufactured intermittent reinforcement are prohibited. *Detect:* mechanics whose efficacy depends on unpredictability of reward.

**ED-39 Notifications (MUST).** Notifications SHALL be relationship-relevant, user-controllable, honest about purpose, and calm; they MUST NOT manufacture urgency, guilt, or FOMO, and MUST NOT be timed to exploit emotional states. Default posture is quiet.

**ED-40 Recommendations & AI conversation (MUST).** SHALL be honest, labeled, uncertainty-aware, assistance-not-authority, and free of manufactured emotion; MUST NOT simulate affection or imply a human relationship.

**ED-41 Celebration, gamification, rewards (MUST).** MAY acknowledge genuine milestones proportionately and honestly; MUST NOT escalate, randomize, or attach to trivial/fabricated events, and MUST NOT create reward-seeking loops.

**ED-42 Persuasion, influence, behavior-change (MUST).** Permitted only toward the user's own stated goals, transparently, and reversibly (ED-9); MUST NOT be deployed toward business goals against user interest.

**ED-43 Retention & engagement (MUST).** Retention SHALL be a byproduct of real value and free exit; MUST NOT be produced by fear, friction, guilt, or compulsion.

**ED-44 Consent, autonomy, psychological safety (MUST).** Emotional features SHALL be consented, reversible, and preserve the user's freedom to feel and choose otherwise; the product SHALL never make a user feel unsafe, coerced, or trapped.

# Compliance / Review Checklist

- ED-C1. Intended emotion and the **user benefit** it serves are documented for the surface (ED-1, ED-9).
- ED-C2. No emotional technique cites an engagement/business metric as its justification (ED-1, ED-34).
- ED-C3. Every technique appears on the MAY list and none on the MUST NOT list (ED-12, ED-13).
- ED-C4. Disclosure test passed: user told how/why the emotion was designed would not feel deceived (ED-9).
- ED-C5. No flow's efficacy depends on user vulnerability or elevated arousal (ED-10, ED-27).
- ED-C6. Reassurance is true; uncertainty acknowledged; no false confidence (ED-16, ED-15).
- ED-C7. No fabricated social/emotional signals (presence, demand, affection, scarcity) (ED-17).
- ED-C8. AI emotional content labeled, assistance-not-authority, human escalation for consequential cases (ED-15, ED-31).
- ED-C9. Emotional meaning is multi-channel and WCAG 2.2 AA (ED-29).
- ED-C10. Emotional cues checked for plural cultural/age interpretations, India-first (ED-30).
- ED-C11. Personalization is consented, reversible, identity-neutral, non-inferring (ED-28, ED-36).
- ED-C12. Every negative/error state has a dignified recovery path; no distress dead-ends (ED-23).
- ED-C13. No comparison-of-people, ranking, or status mechanics (ED-18 Pride/Belonging; ED-19 Jealousy/Comparison).
- ED-C14. Extrinsic tokens removable without collapsing value; no compulsive/variable-reward loops (ED-26, ED-38).
- ED-C15. Notifications quiet-by-default, honest, controllable, non-exploitative in timing (ED-39).
- ED-C16. Exit/offboarding is as easy as entry and free of guilt (ED-8, ED-37, ED-43).
- ED-C17. Acceptance measured on wellbeing/relationship-quality; raw engagement not an acceptance criterion (ED-33).
- ED-C18. Any engagement gain that degrades a wellbeing metric is rejected (ED-34).
- ED-C19. Peak/end emotional tone is calm-positive (ED-5.3, ED-7).
- ED-C20. Uncertain emotional decisions resolved toward the calmer, less persuasive option (ED-11).

# Anti-patterns

| Anti-pattern | Why it fails (tier/principle) | How to detect | How to prevent |
|---|---|---|---|
| Fear-based engagement | Manufactures fear; T1/T6, C-10 | Copy/flows relying on threat or loss | Ban fear framing; reframe to true info + control |
| Manipulative urgency | Fabricates scarcity/time pressure; T6 | Countdown/scarcity without real basis | Remove artificial deadlines; state real facts only |
| Addictive loops | Compulsion via variable reward; C-10/C-12 | Efficacy depends on reward unpredictability | Prohibit variable reward; add friction/limits |
| Emotional coercion | Overrides autonomy; T2/T6, ED-44 | Guilt/shame to force action | Neutral, reversible choices; no guilt copy |
| Excessive gamification | Extrinsic overrides intrinsic; ED-26 | Points/streaks central to value | Cap salience; tie only to real milestones |
| Artificial intimacy | Simulates relationship that isn't; ED-17/ED-40 | AI/product implies affection/human bond | Label AI; forbid affection simulation |
| False reassurance | Lies about state; C-14, ED-16 | "All good" over real risk/uncertainty | Only true reassurance; surface uncertainty |
| Emotional inconsistency | Tone shifts for conversion; ED-22 | Calm elsewhere, pushy at upsell | Uniform emotional character audit |
| Reward addiction | Reward-seeking replaces value; ED-25/ED-41 | Escalating reward frequency/intensity | Proportionate, non-escalating acknowledgment |
| Social-comparison mechanics | Induces envy/comparison anxiety; ED-19 | Rankings, leaderboards, status of people | Eliminate person-to-person comparison |
| Trust erosion | Breaks honest signal; C-2 | Post-hoc surprises, hidden intent | Predictability + transparency (ED-14/ED-21) |
| Privacy violations | Breaks consent/privacy; T2 | Emotional data used beyond consent | Consent-bound, no emotional profiling (ED-36) |
| Emotional overload | Over-stimulation; C-10, ED-7 | Dense prompts, constant signals | Reduce/sequence/defer; quiet defaults |
| Psychological pressure | Coerces via social/time cues; ED-44 | Pressure cues at decision points | Remove pressure cues; self-paced decisions |

# Open Questions

- ED-OQ1. Standard instrument and cadence for measuring perceived respect, psychological safety, and off-app wellbeing across cultures and age cohorts.
- ED-OQ2. Threshold definitions distinguishing "proportionate celebration" from "reward loop" for quantitative review.
- ED-OQ3. Governance protocol and human-oversight staffing for consequential emotional-AI escalations (crisis, grief, safety).
- ED-OQ4. Method to detect emergent dependency at the population level without individual emotional profiling (ED-36 constraint).
- ED-OQ5. Consent model and retention limits for any affective signals used to improve (never target) experience.

# Revision History

| Version | Date | Status | Author | Notes |
|---|---|---|---|---|
| 1.0.0 | 2026-07-26 | Active | Chief Design Officer, Sambandh | Initial governing specification of the Emotional Design System (SHIG-0009). |
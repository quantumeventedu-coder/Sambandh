# Specification ID

**SHIG-0000**

The supreme document of the Sambandh Human Interface Guidelines (SHIG). SHIG-0000 is the **constitution**: no other SHIG document, design decision, component, feature, platform, or product may contradict it. Where any specification, present or future, conflicts with SHIG-0000, SHIG-0000 prevails, and the conflicting clause is void until amended under Article 10 (Amendment).

Precedence, highest to lowest: **SHIG-0000 (Constitution) → SHIG-0001 (Foundation & Governance / rule grammar) → foundational specs (SHIG-0002–0099) → domain specs (SHIG-0100+) → component specs → local decisions.** A lower instrument may add constraints but never relax one imposed above it.

---

# Specification Name

**The Sambandh Design Constitution**

---

# Version

**1.0.0** (`MAJOR.MINOR.PATCH`, per SHIG-0001 §Version).

- `MAJOR` — an amendment to an Article that can invalidate previously-conformant work. Requires the Article 10 process.
- `MINOR` — a backward-compatible clarification or addition.
- `PATCH` — editorial only; no normative change.

---

# Status

**Ratified — Supreme Normative Authority.** Binding on every Sambandh design decision, artifact, and contributor (human or automated) from its adoption date (see Revision History).

---

# Article 0 — Interpretation

- **0.1** Rules use RFC 2119 keywords per SHIG-0001: **MUST / MUST NOT** (immutable), **SHOULD / SHOULD NOT** (strongly recommended; deviation requires recorded justification), **MAY** (permitted).
- **0.2** Constitutional principles carry permanent identifiers `C-n`. Identifiers are never reused or renumbered.
- **0.3** "Design" means every decision that shapes what a person perceives, understands, feels, or does when interacting with Sambandh — across any interface, medium, device, or modality, now or in future.
- **0.4** "Contributor" means any party that affects design: designer, engineer, product manager, researcher, QA, writer, or automated/AI system.
- **0.5** This Constitution is **medium-independent**: it governs web, mobile, desktop, voice, AR/VR, spatial, agentic/AI, and interfaces not yet invented. Where a clause references a sensory property, it binds the equivalent property in any medium.

---

# Article 1 — Purpose of Design at Sambandh

- **1.1 Why design exists.** Design at Sambandh exists to make **trust legible, decisions safe, and human dignity inviolable** while a person navigates high-stakes relationship choices. Design is the discipline through which the platform's integrity becomes perceivable and actionable.
- **1.2 What design MUST achieve.** Every design MUST (a) make the truthfulness and provenance of information legible; (b) reduce the cognitive and emotional cost of a correct, safe decision; (c) protect the person's privacy, safety, and agency; (d) express quality through precision and restraint.
- **1.3 What design MUST NEVER become.** Design MUST NOT become an instrument of persuasion against the user's interest, a maximizer of engagement at the expense of wellbeing, a concealer of risk, a fabricator of certainty, or decoration that adds cost without meaning.
- **1.4 Primacy of purpose.** No aesthetic, brand, novelty, or business goal may override 1.2 or 1.3. These are the design mandate; all else is means.

---

# Article 2 — Immutable Principles

Each principle is non-negotiable. It MUST NOT be violated without an explicit Article 10 amendment. For each: the rule, and how a reviewer verifies it.

- **C-1 Trust before engagement.** The interface MUST make verified / unverified / unknown states distinct and proactively visible before it invites action. *Verify:* trust state is present at the point of decision and distinguishable without color alone (SHIG-0001 R-1, R-2).
- **C-2 Honesty of signal.** The interface MUST NOT present an inference, prediction, or unverified claim as an established fact, nor imply certainty it lacks. *Verify:* every inferential element is labeled as such (SHIG-0001 R-3).
- **C-3 Human dignity is inviolable.** The interface MUST NOT infer, rank, or imply a person's character, worth, or trustworthiness from appearance, complexion, caste, religion, region, or language. *Verify:* no ranking/annotation derives from those attributes; attributes appear only as self-declared or verified facts (SHIG-0001 R-7).
- **C-4 Consent precedes data and action.** No collection, sharing, or processing of personal data occurs without explicit, scoped, revocable consent the person could understand at the moment of granting. *Verify:* consent surface states what/why/with-whom/how-to-withdraw; nothing is pre-checked or bundled (SHIG-0001 R-4–R-6).
- **C-5 Safety is reachable and unobstructed.** Where a person interacts with another person or their content, block / report / help MUST be reachable within a bounded number of actions and free of upsell or dark-pattern friction. *Verify:* reachability within the bound defined in SHIG-0102; no obstruction (SHIG-0001 R-8).
- **C-6 Privacy by default.** The interface MUST request only what a stated purpose requires, MUST NOT enable covert surveillance of one person by another, and MUST make withdrawal discoverable. *Verify:* data minimization and purpose limitation hold on each surface (SHIG-0001 PC-1–PC-5).
- **C-7 Reversibility and agency.** Consequential, outward-facing, or destructive actions MUST be confirmable and, where feasible, reversible, with consequences stated before commitment. *Verify:* each such action states its effect and offers reversal or clear irreversibility notice (SHIG-0001 R-9).
- **C-8 Accessibility is a floor, not a feature.** Every interface MUST meet the adopted accessibility standard (WCAG 2.2 AA minimum) and MUST NOT convey meaning by a single channel (color, position, motion) alone. *Verify:* the SHIG-0001 V-9 checklist passes.
- **C-9 Inclusion and plurality.** The interface MUST be localizable and MUST NOT assume one language, script, numeral system, name/date form, device class, or bandwidth as universal. *Verify:* strings externalized; layout survives script variation and text expansion (SHIG-0001 R-11).
- **C-10 Calm over stimulation.** The interface MUST NOT manufacture urgency, anxiety, or compulsion to drive action. Motion, notification, and emphasis serve understanding, never arousal for its own sake. *Verify:* no countdhigh-pressure timers, infinite/auto-advancing flows, or attention traps on decision or safety surfaces.
- **C-11 Relationship-first, not metric-first.** No design may optimize a growth or engagement metric in a way that degrades a person's safety, understanding, or wellbeing. *Verify:* the decision record shows the metric gain did not cost a higher-tier value (Article 4).
- **C-12 Ethical AI.** Any automated/AI contribution to the interface MUST be identifiable as automated, MUST present outputs as assistance not authority, MUST be constrained by C-1–C-11, and MUST NOT act on personal data outside a granted consent scope. *Verify:* AI output is labeled, inference-framed, and consent-bounded.
- **C-13 Honest errors and state.** Error, empty, loading, and success states MUST tell the truth about what happened and the next action; they MUST NOT fake success, hide failure, or falsely blame the person. *Verify:* SHIG-0001 R-13.
- **C-14 Premium through restraint.** Quality MUST be expressed through precision, consistency, typography, spacing, hierarchy, and motion discipline — never through visual excess. *Verify:* additions justify themselves by meaning; decoration without function is rejected (Article 5).
- **C-15 Consistency over novelty.** A predictable, established pattern MUST be preferred over a novel one unless the novel pattern measurably serves a higher-tier value. *Verify:* deviations cite the value served and the evidence.
- **C-16 Longevity and maintainability.** A design MUST be expressible as reusable system decisions (tokens, patterns, rules), not one-off screens, so it can survive contributor turnover and decades of evolution. *Verify:* the decision maps to a systemic rule, not a bespoke artifact.
- **C-17 Evidence over opinion.** A contested design decision MUST be resolved by the decision hierarchy (Article 4) and, where the tier permits, by evidence (research, data, accessibility/technical fact) — not by seniority or preference. *Verify:* the decision record cites the deciding tier and, at discretionary tiers, its evidence.

---

# Article 3 — Responsibilities

Responsibility is assigned so that no immutable principle depends on goodwill alone.

| Role | MUST | MUST NOT |
|---|---|---|
| **Design (the function)** | Encode C-1–C-17 as systemic, testable rules; own the SHIG corpus; make compliance verifiable. | Ship taste in place of governance; allow the system to fragment into one-off screens. |
| **Designer** | Justify each decision against Article 4; meet the accessibility, privacy, and honesty floors before aesthetics. | Introduce a pattern that violates an immutable principle; optimize a metric above a higher tier. |
| **Engineer** | Implement so trust/consent/safety state is derived from authoritative system state, degrades safely, and matches the spec; refuse to ship a build that breaks an immutable principle. | Substitute a cached/assumed state for the true one; drop trust/safety under load; silently alter a governed behavior. |
| **Product Manager** | Frame problems so higher-tier values are protected; record the decision tier for contested tradeoffs. | Set a goal that requires violating C-1–C-14; approve work that trades a higher tier for a lower one. |
| **Researcher / QA** | Supply the evidence that discretionary decisions require; run the SHIG validation checklists as blocking gates. | Approve a surface that fails a blocking checklist item; present opinion as evidence. |
| **AI / automated contributor** | Operate within C-12; label itself; produce outputs an authorized human can verify against the SHIG corpus. | Present itself as human; act beyond a consent scope; treat a recalled memory or inferred fact as authority without verification. |
| **Future contributor** | Read the governing specs before contributing; preserve permanent identifiers; amend rather than silently override. | Reinterpret an immutable principle to fit a new trend; reuse or renumber a retired identifier. |

---

# Article 4 — Decision Hierarchy (permanent)

When two design solutions compete, evaluate them in this fixed, lexicographic order. Stop at the first tier that distinguishes the options; a gain at a lower tier **never** justifies a loss at a higher tier.

| Tier | Criterion | The question |
|---|---|---|
| 1 | **Safety & legality** | Does either option increase real-world risk to a person or violate applicable law? Reject it. |
| 2 | **Consent & privacy** | Does either collect/share/act on data without legible, scoped, revocable consent? Reject it. |
| 3 | **Honesty of signal** | Does either misrepresent verification, provenance, money, or present inference as fact? Reject it. |
| 4 | **Human dignity & inclusion** | Does either infer character from identity, exclude a language/script/device class, or fail the accessibility floor? Reject it. |
| 5 | **Understanding & task success** | Which lets the person complete their real task with less error, effort, and cognitive load? Prefer it. |
| 6 | **Emotional wellbeing & calm** | Which better respects attention and reduces anxiety/compulsion? Prefer it. |
| 7 | **Consistency** | Which better matches established Sambandh patterns? Prefer it. |
| 8 | **Craft & aesthetics** | Which better expresses quality through restraint and precision? Prefer it. |
| 9 | **Business & growth** | Among options equal on 1–8, which better serves business goals? Prefer it. |

- **4.1** Ties within a tier pass to the next tier. Genuine ties at Tier 9 are discretionary and MAY be resolved by experiment.
- **4.2** A `SHOULD` deviation is permitted only with a recorded justification naming the higher tier it serves; a deviation serving only a lower tier is rejected.
- **4.3** Summary order: `Safety ▸ Consent ▸ Honesty ▸ Dignity ▸ Understanding ▸ Wellbeing ▸ Consistency ▸ Craft ▸ Business`.

---

# Article 5 — Quality Standard

- **5.1 Definition.** World-class quality at Sambandh is the state in which an interface is **truthful, effortless to understand, safe to act on, accessible to all its intended users, consistent with the system, and precise in craft** — verifiable, not asserted.
- **5.2 Measurable expectations (minima).** (a) Accessibility: WCAG 2.2 AA, zero blocking violations. (b) Trust legibility: 0 instances of ambiguous/false verification. (c) Honesty: 0 unlabeled inferences presented as fact. (d) Consent: 100% of data-touching flows pass the consent checklist. (e) Performance: the primary task is usable within the performance budget of SHIG-0001 PF-1 on the low-end target. (f) Consistency: 100% of tokens/patterns drawn from the system, 0 undocumented one-offs. (g) Feedback latency: every user action is acknowledged within the interaction-latency threshold (defined in the performance profile).
- **5.3 Review criteria (a surface is accepted only if all hold).** Passes the SHIG-0001 Validation Checklist (V-1–V-15); every decision maps to Article 4; every element maps to a system token/pattern; every string is localizable; the surface degrades safely.
- **5.4 Rejection criteria (any one rejects).** Violates an immutable principle; fails a blocking checklist item; presents inference as fact; obstructs safety/consent; introduces an undocumented one-off; trades a higher tier for a lower one.
- **5.5 Acceptable compromises.** Reducing visual richness, motion, or feature scope to protect a higher tier (safety, accessibility, performance) is always acceptable and often required.
- **5.6 Unacceptable compromises.** Weakening trust legibility, consent, safety, dignity, honesty, or the accessibility floor to gain speed, beauty, engagement, or revenue is never acceptable.

---

# Article 6 — Design Culture

- **6.1 Critique.** Critique addresses the work against Article 4 and the SHIG corpus, never the person. Every critique cites the tier or rule at issue and proposes the higher-quality alternative. Unsubstantiated preference is not critique.
- **6.2 Disagreement resolution.** Disagreements are resolved by the decision hierarchy (Article 4). If the deciding tier is discretionary (5–9), evidence decides; absent evidence, consistency (Tier 7) decides; the decision and its basis are recorded.
- **6.3 Experiments.** Experiments are permitted but MUST NOT weaken an immutable principle for any user, MUST be consent- and privacy-compliant, MUST define success/failure criteria in advance, and MUST be time-boxed and reversible.
- **6.4 Failed experiments.** A failed or abandoned experiment MUST be recorded with its hypothesis, result, and the reason it failed, so the same path is not blindly retried. Failure is documented, not hidden.
- **6.5 Innovation without fragmentation.** Innovation enters the system by proposing a **new or revised system rule** (token, pattern, spec), reviewed for consistency, not by shipping a bespoke exception. A novel solution that cannot be expressed as a systemic rule is not yet ready.

---

# Article 7 — Governance of the SHIG Corpus

- **7.1** Every governing decision lives in a numbered SHIG document with permanent identifiers, a status lifecycle (`Draft → Review → Active → Deprecated → Retired`), and semantic versioning (SHIG-0001).
- **7.2** No design ships that a governing spec has not addressed; if a gap is found, the gap is closed by a spec or an Open Question, not by an undocumented decision.
- **7.3** Compliance is enforced by blocking validation checklists usable by humans, QA, and automated agents alike; a surface failing a blocking item MUST NOT ship.
- **7.4** Conformance is auditable: any shipped surface can be traced to the SHIG clauses it satisfies.

---

# Article 8 — Constraints

- **8.1 Business.** Trust-critical evaluation is in-house; the interface MUST NOT present a third party's unverified output as a Sambandh judgment. No revenue mechanic may require violating an immutable principle.
- **8.2 Technical.** Governance is implementation-independent and MUST be assessable without reference to a framework, platform, or vendor. Interfaces MUST NOT assume a single device or network class.
- **8.3 Cultural.** India-first plurality is default and global inclusion is mandatory; identity attributes are never inferential signals of character (C-3).
- **8.4 Ethical.** No design may exploit cognitive bias, emotional vulnerability, or relational hope against the person's interest.

---

# Article 9 — Edge Cases & Conflict Resolution

- **9.1 Unknown trust state** → render as unverified (fail-secure); never as verified or blank-implying-safe.
- **9.2 Ambiguous or failed consent** → treat as not-consented; the action MUST NOT proceed.
- **9.3 Spec-vs-spec conflict** → higher instrument prevails (Precedence, Specification ID); a lower spec may only add constraints.
- **9.4 Principle-vs-principle conflict** → Article 4 order decides; an immutable principle always outranks a recommendation.
- **9.5 Unresolvable at decision time** → ship the fail-secure option (unverified / unconsented / most-reversible) and escalate as an Open Question; never guess in the risky direction.
- **9.6 New medium not foreseen** → map each clause to the medium's equivalent sensory/interaction property (0.5); if no equivalent exists, the immutable principles still bind by intent, and a spec is authored before scale.

---

# Article 10 — Amendment & Long-Term Evolution

- **10.1 Immutability with a door.** Immutable principles (C-1–C-17) and the Article 4 hierarchy MUST NOT change through ordinary work. They change only by an explicit, recorded **constitutional amendment**: a `MAJOR` version, a stated rationale (research, incident, or audit finding), an enumeration of prior conformances it may invalidate, and a remediation path.
- **10.2 Direction of change.** An amendment MUST NOT lower a Tier 1–4 guarantee (safety, consent/privacy, honesty, dignity/inclusion). These may only be strengthened. Lower tiers may evolve freely within the hierarchy.
- **10.3 Identity preservation.** The design language may evolve its sensory expression across decades, but its **identity is the set of immutable principles**, not any particular color, type, motion, or layout. Changing expression is evolution; changing an immutable principle is amendment.
- **10.4 Additive-first.** New governance enters as new identifiers or new specs, preserving the meaning of already-shipped work. Retired identifiers are marked retired with a successor pointer and never reused.
- **10.5 Deprecation window.** A rule scheduled to change passes through `Deprecated` with a named successor before becoming binding, so contributors migrate deterministically.
- **10.6 Periodic review.** The corpus is reviewed on a fixed cadence; every normative change SHOULD originate from a resolved Open Question, so the system grows by closing known gaps, not by ad-hoc addition.

---

# Compliance Checklist (constitutional)

A decision, artifact, or spec is **constitutionally compliant** only if every applicable item is *yes*:

- [ ] **G-1** No immutable principle (C-1–C-17) is violated.
- [ ] **G-2** The decision maps to the Article 4 hierarchy; no higher tier is traded for a lower one.
- [ ] **G-3** It passes the SHIG-0001 Validation Checklist (V-1–V-15).
- [ ] **G-4** It is expressed as a systemic rule (token/pattern/spec), not an undocumented one-off.
- [ ] **G-5** Any `SHOULD` deviation carries a recorded justification naming the higher tier served.
- [ ] **G-6** Fail-secure holds for unknown trust and ambiguous consent.
- [ ] **G-7** It is medium-independent or, for a new medium, maps each clause to the equivalent property.
- [ ] **G-8** It preserves permanent identifiers and does not silently override a higher instrument.

---

# Anti-patterns (constitutionally prohibited)

- **AP-C1 Governance by taste** — deciding by seniority/preference instead of Article 4. *Harm:* fragments the system; unfalsifiable.
- **AP-C2 Metric capture** — optimizing engagement/growth past a higher-tier value. *Harm:* violates C-11; erodes trust.
- **AP-C3 Trust theater** — verification styling on unverified content, or hidden risk. *Harm:* violates C-1/C-2; transfers real risk to the person.
- **AP-C4 Silent override** — changing a governed behavior without amending the spec. *Harm:* breaks auditability and longevity.
- **AP-C5 One-off screens** — bespoke artifacts not backed by a systemic rule. *Harm:* violates C-16; unmaintainable.
- **AP-C6 Premium-as-excess** — signaling quality through visual weight, motion, or ornament. *Harm:* violates C-14; raises cost, lowers clarity.
- **AP-C7 Dark patterns** — confirmshaming, roach-motel, forced continuity, disguised ads. *Harm:* violates C-4/C-7/C-10; adversarial to the user.
- **AP-C8 AI-as-authority** — presenting automated output as fact or acting beyond consent. *Harm:* violates C-12.

---

# Open Questions

- **Q-0.1** The exact bounded action-count for safety reachability (C-5) — fixed in SHIG-0102.
- **Q-0.2** The interaction-latency and low-end performance budgets (5.2e, 5.2g) — fixed in the performance profile spec.
- **Q-0.3** The canonical, medium-independent encoding of the three trust states (C-1) — fixed in SHIG-0100 + the design-token spec.
- **Q-0.4** The recorded-justification and decision-record format (4.2, 6.2) and where it is stored for audit.
- **Q-0.5** The review cadence and quorum for Article 10 amendments.

---

# Revision History

| Version | Date | Status | Author (role) | Summary |
|---|---|---|---|---|
| 1.0.0 | 2026-07-26 | Ratified — Supreme Normative Authority | Chief Design Officer, Sambandh | Initial ratification. Establishes the supreme design authority: purpose of design (Art. 1), 17 immutable principles C-1–C-17 (Art. 2), role responsibilities (Art. 3), the permanent lexicographic decision hierarchy `Safety▸Consent▸Honesty▸Dignity▸Understanding▸Wellbeing▸Consistency▸Craft▸Business` (Art. 4), the quality standard with measurable minima and accept/reject criteria (Art. 5), design culture (Art. 6), corpus governance (Art. 7), constraints (Art. 8), edge/conflict rules (Art. 9), and the amendment/evolution framework (Art. 10). Compliance checklist G-1–G-8, anti-patterns AP-C1–AP-C8, Open Questions Q-0.1–Q-0.5. Sits above SHIG-0001. |

# Specification ID

**SHIG-0001**

The Sambandh Human Interface Guidelines (SHIG) are a numbered series. `SHIG-0001` is the *root* specification. Every other SHIG document inherits from it and MUST NOT contradict it. On conflict, SHIG-0001 prevails unless the conflicting document explicitly cites a clause of SHIG-0001 that it supersedes and records that supersession in its own Revision History.

Numbering: `SHIG-0001`–`SHIG-0099` are foundational/governance specifications. `SHIG-0100`+ are domain specifications (e.g. trust legibility, consent surfaces, discovery, commerce, messaging, accessibility profiles). Numbers are permanent and are never reused after retirement.

---

# Specification Name

**Foundation & Governance — Principles, Rule Grammar, and Conformance Model for the Sambandh Human Interface**

---

# Version

**1.0.0** (semantic: `MAJOR.MINOR.PATCH`).

- `MAJOR` — a change that can invalidate previously-conformant designs (a rule added, tightened, or removed).
- `MINOR` — a backward-compatible addition (new non-breaking guidance, clarified criteria, new Open Question resolved).
- `PATCH` — editorial only (wording, examples, typos) with no change to any normative clause.

---

# Status

**Active — Normative Baseline.**

Status lifecycle for any SHIG document: `Draft → Review → Active → Deprecated → Retired`.
- **Draft** — under authorship; non-binding.
- **Review** — feature-frozen; open for objection.
- **Active** — binding on all work merged after its adoption date.
- **Deprecated** — still binding but scheduled for replacement; new work SHOULD target its successor.
- **Retired** — non-binding; retained for history only.

This document is binding on all Sambandh user-facing surfaces created or materially modified on or after its adoption date (see Revision History).

---

# Purpose

This specification exists to:

1. Establish a **single, testable source of truth** for interface decisions across Sambandh so that designers, product managers, researchers, engineers, QA, and automated agents reach the same decision from the same inputs.
2. Define the **rule grammar** (normative keywords, requirement IDs, conformance levels) used by every SHIG document, so rules are unambiguous and machine-checkable.
3. Fix the **non-negotiable design invariants** of a verified relationship platform — trust legibility, consent, safety, dignity, honesty of signal — as constraints that lower-level design freedom cannot override.
4. Define **conflict-resolution priority** so that when two good principles collide, the outcome is deterministic and not left to individual judgment.
5. Provide the **conformance model** (validation checklist + anti-patterns) reviewers and CI use to accept or reject an interface as SHIG-conformant.

A statement belongs in SHIG only if it helps someone make or verify a design decision. Statements that merely inspire, explain history, or describe implementation do not belong here.

---

# Scope

## Covered

- The **rule grammar** for all SHIG documents: normative keywords, requirement identifiers, and conformance levels.
- **Cross-cutting design invariants** that apply to every Sambandh surface regardless of domain: trust legibility, consent, safety-over-engagement, dignity/non-inference, honesty of signal, reversibility, accessibility floor, localization floor, and performance floor.
- The **decision-priority order** used to resolve conflicts between principles.
- The **conformance model**: how a design is verified as compliant, and what disqualifies it.
- The **governance model**: versioning, status lifecycle, deprecation, and how the SHIG series evolves without breaking consistency.

## Not covered

- Domain-specific interface rules (discovery, matching, messaging, verification flows, commerce, consultation, onboarding). These are defined in `SHIG-0100`+ and MUST conform to this document.
- Visual identity specifics (exact palette values, type scale, spacing scale, iconography, motion curves). These are defined in a design-tokens specification (`SHIG-01xx`) and are **implementation-independent**: this document constrains their *properties* (e.g. contrast, distinctiveness of trust states) but not their *values*.
- Content/copy voice and tone (a separate content specification), except where copy is load-bearing for consent or trust (governed here).
- Implementation technology, frameworks, platforms, component libraries, or code.
- Legal text. This document aligns design constraints with privacy and safety obligations but is not itself legal advice or policy.

## Dependencies

- A recognized accessibility standard as the external conformance floor. This document adopts **WCAG 2.2 Level AA** as the minimum external bar; where a Sambandh rule is stricter, the stricter rule governs.
- Applicable Indian data-protection obligations (Digital Personal Data Protection framework) as the external floor for consent and data-minimization constraints. Where a Sambandh rule is stricter, the stricter rule governs.

## Related specifications

- `SHIG-01xx` — Design Tokens & Sensory Properties (token *properties*, not values).
- `SHIG-0100` — Trust & Verification Legibility (surfacing verified vs. unverified vs. unknown).
- `SHIG-0101` — Consent Surfaces (grant, scope, review, revoke).
- `SHIG-0102` — Safety & Reporting Surfaces.
- `SHIG-0103` — Localization & Plurality.
- `SHIG-0104` — Accessibility Profiles.
  (Identifiers reserved; documents authored separately. All inherit SHIG-0001.)

---

# Problem Statement

**Design problem.** Sambandh is a verified, India-first relationship platform spanning discovery, verification, commerce, and consultation. Its core promise is *trust*. Interfaces that present verified and unverified information identically, that obtain data without legible consent, that optimize for engagement over safety, or that let appearance stand in for character, silently destroy that promise. Because the platform is multi-vertical and built incrementally by many contributors (human and automated), inconsistent local decisions accumulate into a product that is untrustworthy in aggregate even when each screen looked reasonable in isolation.

**Why it matters.**
- **Trust is the product, not a feature.** A single misleading verification badge or fabricated-looking "insight presented as fact" transfers real-world risk to a user making high-stakes relationship decisions.
- **Consent is a precondition, not a checkbox.** The platform handles intimate, identity-linked data. Ambiguous consent is both an ethical failure and a regulatory one.
- **Scale multiplies small errors.** Dozens of contributors and agents shipping in sequence need a deterministic rulebook, not taste, to stay coherent.
- **India-first is a hard constraint, not a preference.** Multilingual, low-bandwidth, low-end-device, and plural-identity realities are the median case, not an edge case.

Without a governing specification, these risks are re-litigated per screen, resolved inconsistently, and detected (if at all) only in production.

---

# Objectives

## Primary objectives

1. Make every Sambandh design decision **deterministic given its inputs** — two competent reviewers reach the same verdict.
2. Guarantee **trust legibility**: a user can always tell, without effort, whether a piece of information is verified, unverified, or unknown, and to what degree.
3. Guarantee **consent legibility**: a user can always tell what data/action they are authorizing, for what purpose, and how to revoke it.
4. Make **safety and dignity non-overridable** by lower-priority goals such as engagement or aesthetics.

## Secondary objectives

5. Provide **machine-checkable** rules (stable IDs, pass/fail criteria) so CI and automated agents can enforce conformance.
6. Minimize **decision latency** for contributors by pre-resolving common conflicts via a fixed priority order.
7. Ensure **accessibility and localization floors** are met by default rather than retrofitted.

## Long-term objectives

8. Allow the SHIG series to **evolve without breaking consistency** through explicit versioning, deprecation, and supersession rules.
9. Enable **auditability**: any shipped surface can be traced to the SHIG clauses it satisfies.
10. Keep the guidelines **implementation-independent** so they survive changes of platform, framework, and visual language.

---

# Design Philosophy

The following principles govern all decisions. They are ordered; where two conflict, the earlier prevails (see Decision Matrix).

1. **Safety and legality are absolute.** No interface may increase a user's real-world risk or violate applicable law to achieve any other goal.
2. **Consent precedes data and action.** Nothing that collects, shares, or acts on personal data occurs without explicit, scoped, revocable consent that the user could understand at the moment of granting it.
3. **Signal must be honest.** Verified and unverified information are visually and semantically distinct. An inference, prediction, or "insight" is labeled as such and never presented as a verified fact. The interface never claims certainty it does not have.
4. **Dignity is non-negotiable and non-inferential.** The interface never infers, implies, or displays a person's character, worth, caste, or trustworthiness from appearance, complexion, religion, region, language, or similar attributes. Verification pertains to identity and claims, never to a person's value.
5. **Trust is legible by default.** The user does not have to hunt for verification state, consent scope, or provenance; the interface surfaces them proactively at the point of decision.
6. **Reversibility and control.** Consequential, outward-facing, or destructive actions are confirmable and, wherever feasible, reversible; users retain control over their own footprint and can withdraw.
7. **Inclusion is the baseline.** Accessibility and India-first plurality (language, script, device, bandwidth) are default requirements, not enhancements.
8. **Restraint over persuasion.** The interface helps the user decide; it does not manipulate them into deciding. Engagement is an outcome of usefulness, never an objective that overrides a higher principle.
9. **Consistency over novelty.** A predictable, standard interaction outranks a clever, unique one unless the novel one measurably serves a higher principle.
10. **Implementation independence.** Specifications define outcomes, properties, and constraints — never widgets, code, or stacks.

---

# Design Rules

Rules use RFC 2119 keywords: **MUST / MUST NOT** (mandatory), **SHOULD / SHOULD NOT** (recommended; deviation requires recorded justification), **MAY** (optional). Each rule has a permanent ID (`R-n`) for reference and testing.

## Mandatory rules (MUST / MUST NOT)

- **R-1 — Trust-state distinctness.** Any datum that can be *verified*, *unverified*, or *unknown/unverifiable* MUST render in a form the user can distinguish **without relying on color alone** (i.e. distinguishable by text/label/shape/icon as well). The three states MUST be mutually distinguishable.
- **R-2 — No false verification.** An interface MUST NOT display a verification indicator for a claim that has not passed the platform's verification for that claim. Absence of verification MUST render as *unverified* or *unknown*, never as verified, and never as blank-implying-safe.
- **R-3 — Inference labeling.** Any predicted, scored, inferred, or algorithmically-generated statement (compatibility, "insight", risk hint, recommendation rationale) MUST be labeled as an inference and MUST NOT be phrased as an established fact.
- **R-4 — Consent legibility.** Before any collection, sharing, or processing of personal data, the interface MUST present, in plain user-selected language: (a) what data, (b) for what purpose, (c) with whom (if shared), and (d) how to withdraw. Consent MUST be an explicit affirmative action, never pre-checked or bundled with an unrelated action.
- **R-5 — Consent scope integrity.** A single consent action MUST authorize only the purpose it describes. Broadening scope, or reusing data for a new purpose, MUST require a new consent.
- **R-6 — Revocability.** For every consent granted and every outward-facing action that exposes the user (visibility, contactability, sharing), the interface MUST provide a discoverable path to withdraw or reverse it, and MUST state the effect of withdrawal.
- **R-7 — Non-inference of character.** The interface MUST NOT present, rank, or annotate people using inferred character/worth/trust derived from appearance, complexion, caste, religion, region, or language. Attributes MAY be shown only as self-declared or verified facts, labeled as such.
- **R-8 — Safety reachability.** On any surface where a user interacts with another person or that person's content, a path to **block, report, and access safety help** MUST be reachable within a bounded number of interactions (defined in `SHIG-0102`; default MUST be ≤ 2 primary actions) and MUST NOT be obstructed by upsells or dark patterns.
- **R-9 — Reversible-by-default for consequential actions.** Consequential or destructive actions (delete account/data, block, publish, pay, share externally) MUST require explicit confirmation and MUST clearly state consequences before commitment. Where reversal is impossible, that irreversibility MUST be stated before commitment.
- **R-10 — Accessibility floor.** Every surface MUST meet WCAG 2.2 AA as a minimum, including: text contrast, non-color-only signaling, keyboard/assistive-tech operability, visible focus, and minimum interactive target size.
- **R-11 — Localization floor.** Every user-facing string MUST be externalizable and translatable; layouts MUST accommodate script variation, text expansion, and right-to-left where applicable, without truncating or hiding load-bearing content. Numerals, dates, names, and honorifics MUST NOT assume a single locale.
- **R-12 — Graceful degradation.** Every surface MUST remain usable for its primary task under degraded conditions (slow/intermittent network, low-end device, images unavailable). Trust and safety information MUST NOT be the first thing dropped under degradation.
- **R-13 — Error honesty.** Error and empty states MUST state what happened and the next action truthfully; they MUST NOT blame the user falsely, hide a failure, or imply success that did not occur.
- **R-14 — Provenance for money and identity.** Any surface presenting a monetary amount, fee, commission, or payout, or an identity/verification result, MUST make the amount/result and its basis unambiguous (currency, what is included, what was verified). It MUST NOT round or restyle in a way that misrepresents the value.
- **R-15 — No dark patterns.** The interface MUST NOT use confirmshaming, forced continuity, hidden costs, disguised ads, misdirection, or roach-motel flows (easy in / hard out). See Anti-patterns.

## Recommended rules (SHOULD / SHOULD NOT)

- **R-16** The interface SHOULD show *why* a recommendation or ranking appears (a truthful, inference-labeled rationale) rather than presenting it as neutral truth.
- **R-17** Destructive actions SHOULD offer an undo window in preference to a modal confirmation where an undo is technically feasible and safe.
- **R-18** Consent and safety controls SHOULD be reachable from a consistent, predictable location across surfaces.
- **R-19** The interface SHOULD prefer progressive disclosure for complex trust/consent detail: a legible summary by default, full detail on demand — provided the summary is not misleading.
- **R-20** Copy SHOULD use plain language at a reading level appropriate to the least-fluent expected user of the surface's primary language.

## Optional considerations (MAY)

- **R-21** Surfaces MAY offer additional locale-specific affordances (e.g. regional honorific formatting) beyond the localization floor.
- **R-22** Surfaces MAY provide expert/advanced views of trust provenance for power users, provided the default view remains legible.

## Prohibited practices (MUST NOT — summary index)

Fabricated or ambiguous verification (R-2); unlabeled inference presented as fact (R-3); pre-checked/bundled/coerced consent (R-4, R-5); irrevocable exposure with no withdrawal (R-6); character inference from appearance/identity attributes (R-7); obstructed safety paths (R-8); silent destructive actions (R-9); color-only signaling (R-1, R-10); untranslatable or locale-locked UI (R-11); dropping trust/safety info first under degradation (R-12); dishonest errors/empty states (R-13); misrepresented money/identity (R-14); dark patterns (R-15).

---

# Constraints

## Business constraints

- **BC-1** Trust-critical evaluation (verification, risk, moderation decisions surfaced to users) is performed by in-house engines; the interface MUST NOT present a third-party's unverified output as a Sambandh verification. (Aligns with the platform's no-third-party mandate for trust-critical paths.)
- **BC-2** Monetary values are displayed in the platform's canonical currency with explicit currency indication; fees, commissions, and payouts MUST be itemized truthfully (R-14).
- **BC-3** No surface may create a revenue mechanic that requires violating a mandatory rule (e.g. hiding a safety control behind a paywall violates R-8 and is prohibited regardless of business value).

## Technical constraints

- **TC-1** Specifications are implementation-independent; conformance MUST be assessable without reference to a specific framework, component library, or platform.
- **TC-2** Interfaces MUST NOT assume native-app-only capabilities; the guidelines target a spectrum from low-end web on constrained networks upward.
- **TC-3** Trust/consent/safety state presented in the UI MUST be derived from authoritative system state, not cached UI assumptions that can drift from truth.

## Accessibility constraints

- **AC-1** WCAG 2.2 AA is the floor (R-10); stricter SHIG rules govern where present.
- **AC-2** No information may be conveyed by color, position, or motion alone.
- **AC-3** Interactive elements MUST be operable by keyboard and assistive technologies, with a visible focus indicator and adequate target size.
- **AC-4** Motion/animation MUST respect reduced-motion preferences and MUST NOT be required to understand or complete a task.

## Privacy constraints

- **PC-1** Data minimization: a surface MUST request only the data its stated purpose requires (R-4, R-5).
- **PC-2** Purpose limitation: data gathered for one purpose MUST NOT be repurposed in the UI without new consent (R-5).
- **PC-3** No covert collection or surveillance affordances; the interface MUST NOT enable one user to monitor another without that other's knowledge and consent.
- **PC-4** Verification and investigation surfaces MUST be consent-gated for all parties whose data is examined; results are framed by their verification status (R-2, R-3).
- **PC-5** Withdrawal and data-control paths MUST be discoverable (R-6).

## Performance constraints

- **PF-1** Primary task content MUST be usable under a defined low-bandwidth/low-end budget (thresholds specified in the performance profile spec); the interface MUST NOT block the primary task on non-essential assets.
- **PF-2** Interaction feedback MUST acknowledge user input promptly enough that the user is never uncertain whether an action registered; long operations MUST show honest progress, not fake completion (R-13).
- **PF-3** Trust and safety information MUST NOT be deprioritized below decorative content in the loading order (R-12).

## Cultural constraints

- **CC-1** India-first plurality is default: multilingual support including Indic scripts and numerals, and pluralism of names, dates, addresses, and honorifics (R-11).
- **CC-2** Religion, region, caste, and language are never used as inferential signals of trust or character (R-7); they appear only as self-declared or verified facts, labeled as such.
- **CC-3** Content and imagery MUST NOT normalize a single community as default or render others as exceptions.

---

# Decision Matrix

## Decisions governed by this specification

- Whether a proposed surface adequately distinguishes verified / unverified / unknown information.
- Whether a data-touching flow has legible, scoped, revocable consent.
- Whether an inference/recommendation is honestly labeled.
- Whether safety and withdrawal paths are reachable and unobstructed.
- How to resolve a conflict between two design goals (below).
- Whether a design is SHIG-conformant enough to ship (Validation Checklist).

## Decision criteria

For any contested decision, evaluate in this fixed order and stop at the first tier that discriminates between the options:

| Priority | Tier | Question |
|---|---|---|
| 1 | **Safety & legality** | Does either option increase real-world user risk or violate applicable law? Reject that option. |
| 2 | **Consent & privacy** | Does either option collect/share/act on data without legible, scoped, revocable consent? Reject that option. |
| 3 | **Honesty of signal** | Does either option misrepresent verification, provenance, money, or present inference as fact? Reject that option. |
| 4 | **Dignity & inclusion** | Does either option infer character from identity, exclude a language/script/device class, or fail the accessibility floor? Reject that option. |
| 5 | **Usability & task success** | Which option lets the user complete their real task with fewer errors and less effort? Prefer it. |
| 6 | **Consistency** | Which option better matches established platform patterns? Prefer it. |
| 7 | **Aesthetics & brand** | Which option better expresses the visual identity? Prefer it. |
| 8 | **Engagement & business metrics** | Only among options that are equal on 1–7, which better serves business goals? Prefer it. |

## Trade-offs

- **Higher tiers are lexicographic over lower ones:** a gain on a lower tier never justifies a loss on a higher tier. Engagement (8) may never be bought with a safety (1), consent (2), honesty (3), or dignity (4) cost.
- **Ties within a tier** pass down to the next tier. Genuine ties at tier 8 are a designer's discretionary choice and MAY be resolved by preference or experiment.
- **Recommended-rule deviations** (a `SHOULD` not followed) are permitted only with a recorded justification referencing which higher-tier objective the deviation serves; a deviation that serves only a lower tier is rejected.

## Priority order (summary)

`Safety/Legality ▸ Consent/Privacy ▸ Honesty of Signal ▸ Dignity/Inclusion ▸ Usability ▸ Consistency ▸ Aesthetics ▸ Engagement.`

---

# Edge Cases

## Known exceptions

- **E-1 — Verification state unknown at render time.** If verification status cannot be determined when a surface renders, it MUST render as *unknown/unverified* (fail-secure), never as verified and never as blank-implying-safe (R-2). It MAY update to verified once authoritative state arrives.
- **E-2 — Legal disclosure vs. minimal consent copy.** Where law mandates disclosure text that exceeds the "legible summary" ideal, the mandated text MUST be presented; progressive disclosure (R-19) MAY summarize above it, provided the summary is not misleading and the full text is one action away.
- **E-3 — Safety action that is itself consequential.** Blocking/reporting is a safety action (tier 1) and MUST remain fast to invoke (R-8); it is exempt from heavyweight confirmation friction even though it is consequential, but its effect MUST still be stated.
- **E-4 — Degraded network hides imagery.** When images are unavailable, identity/trust surfaces MUST still convey verification state and safety controls via text (R-12); a missing photo MUST NOT be interpreted or displayed as an identity or trust signal.

## Fallback behavior

- **F-1** Unknown trust state → treat as unverified (fail-secure).
- **F-2** Missing localization for a string → fall back to the platform default language, clearly, without breaking layout; MUST NOT display raw keys or empty strings.
- **F-3** Feature/asset unavailable → degrade to the nearest form that preserves the primary task and all tier-1–4 guarantees; MUST NOT silently drop a safety/consent affordance.
- **F-4** Ambiguous or failed consent capture → treat as *not consented*; the data-touching action MUST NOT proceed.

## Conflict resolution

- **X-1 — Rule vs. rule:** apply the Decision Matrix priority order. A mandatory rule always outranks a recommended one.
- **X-2 — SHIG doc vs. SHIG doc:** SHIG-0001 prevails unless the other document explicitly and traceably supersedes a named clause (see Specification ID).
- **X-3 — SHIG vs. external standard:** the stricter requirement governs; SHIG never relaxes an external accessibility or privacy floor.
- **X-4 — Unresolvable at design time:** escalate as an Open Question with the specific inputs; ship the fail-secure option (unverified/unconsented/most-reversible) in the interim.

---

# Validation Checklist

A surface is **SHIG-0001-conformant** only if a reviewer can answer *yes* to every applicable item. Each item is pass/fail and cites the rule it verifies.

- [ ] **V-1** Verified, unverified, and unknown information are mutually distinguishable, and not by color alone. *(R-1, R-10, AC-2)*
- [ ] **V-2** No element displays verification for an unverified claim; unknown state fails secure to unverified. *(R-2, E-1, F-1)*
- [ ] **V-3** Every inferred/predicted/scored statement is labeled as an inference, not a fact. *(R-3)*
- [ ] **V-4** Every data-touching flow shows what/why/with-whom/how-to-withdraw, with explicit, unbundled, non-pre-checked consent. *(R-4, R-5, PC-1, PC-2)*
- [ ] **V-5** Every consent and outward-facing exposure has a discoverable withdrawal/reversal path stating its effect. *(R-6, PC-5)*
- [ ] **V-6** No ranking/annotation infers character from appearance, complexion, caste, religion, region, or language. *(R-7, CC-2)*
- [ ] **V-7** Block/report/safety help is reachable within the bounded action limit and is unobstructed. *(R-8, E-3)*
- [ ] **V-8** Consequential/destructive actions confirm and state consequences; irreversibility is stated when applicable. *(R-9, R-17)*
- [ ] **V-9** Surface meets WCAG 2.2 AA: contrast, non-color-only signaling, keyboard/AT operability, visible focus, target size, reduced-motion respected. *(R-10, AC-1–AC-4)*
- [ ] **V-10** All strings are externalized/translatable; layout survives script variation and text expansion; numerals/dates/names/honorifics are not locale-locked. *(R-11, CC-1)*
- [ ] **V-11** Primary task remains usable under low-bandwidth/low-end/no-image conditions; trust/safety info is not dropped first. *(R-12, PF-1, PF-3, E-4)*
- [ ] **V-12** Errors and empty states are truthful and actionable; no fake success, no false blame. *(R-13, PF-2)*
- [ ] **V-13** Money/identity/verification values and their basis are unambiguous and not misrepresented by styling. *(R-14, BC-2)*
- [ ] **V-14** No dark patterns present (see Anti-patterns). *(R-15)*
- [ ] **V-15** Any `SHOULD` not followed has a recorded justification citing a higher-priority objective. *(Decision Matrix)*

CI/automated agents MUST treat V-1..V-14 as blocking and V-15 as required-metadata; a surface failing any blocking item is non-conformant and MUST NOT ship.

---

# Anti-patterns

Each entry names a common mistake and why it is harmful (which rule/tier it violates).

- **AP-1 — Verified-looking-by-default.** Styling unverified content like verified content (or leaving verification blank so it reads as "fine"). *Harm:* transfers unowned risk to the user; violates R-2, tier 3.
- **AP-2 — Inference dressed as fact.** "This person is trustworthy / compatible" stated flatly instead of "insight, not a verified fact." *Harm:* manufactures false certainty on high-stakes decisions; violates R-3.
- **AP-3 — Consent by bundling or pre-check.** One tap authorizing several unrelated purposes, or a pre-ticked box. *Harm:* consent is not informed or scoped; violates R-4, R-5, tier 2.
- **AP-4 — Roach motel.** Easy to enable exposure/subscription, hard to withdraw. *Harm:* removes user control; violates R-6, R-15.
- **AP-5 — Character inference from appearance.** Ranking, tagging, or "matching" people using complexion, caste, religion, or region as a proxy for worth/trust. *Harm:* discriminatory and dignity-violating; violates R-7, CC-2, tier 4.
- **AP-6 — Buried safety control.** Block/report hidden behind menus, delays, or upsells. *Harm:* raises the cost of self-protection exactly when it's needed; violates R-8, tier 1.
- **AP-7 — Silent destruction.** Deleting, publishing, sharing, or paying without confirmation or consequence disclosure. *Harm:* irreversible harm without agency; violates R-9.
- **AP-8 — Color-only state.** Communicating verification/error/success by color alone. *Harm:* invisible to color-blind and low-vision users, and in degraded rendering; violates R-1, R-10.
- **AP-9 — Confirmshaming / misdirection.** Guilt-tripping decline options, disguised ads, misleading defaults. *Harm:* manipulates rather than informs; violates R-15, principle 8.
- **AP-10 — Locale lock.** Hard-coded English strings, Latin-only numerals, layouts that truncate expanded translations. *Harm:* excludes the median Indian user; violates R-11, CC-1.
- **AP-11 — Trust dropped under load.** Skeletons/decor render first while verification and safety controls lag or vanish on slow networks. *Harm:* the most important information is the least reliable; violates R-12, PF-3.
- **AP-12 — Dishonest system feedback.** Fake progress bars, success toasts on failed actions, blaming the user for a server error. *Harm:* erodes trust and causes wrong follow-on decisions; violates R-13.
- **AP-13 — Money misrepresentation.** Hiding fees, ambiguous currency, styling a payout to look larger/smaller than it is. *Harm:* financial harm and mistrust; violates R-14, BC-2.
- **AP-14 — Engagement override.** Adding friction to safety, or infinite/auto-advancing flows on safety-critical surfaces, to raise time-on-app. *Harm:* subordinates a tier-1 concern to tier-8; violates principle 8 and the Decision Matrix.

---

# Future Evolution

- **EV-1 — Additive first.** New guidance SHOULD be introduced as new requirement IDs or new domain specs (`SHIG-0100+`) rather than by mutating existing IDs, preserving traceability of already-shipped work.
- **EV-2 — Stable identifiers.** Requirement IDs (`R-n`), constraint IDs, and validation IDs are permanent. A retired rule's ID is never reused; it is marked retired with a pointer to its successor.
- **EV-3 — Semantic versioning of rules.** Tightening or removing a mandatory rule is a `MAJOR` change and MUST list which prior conformances it may invalidate and a remediation path. Clarifications are `MINOR`; editorial changes are `PATCH`.
- **EV-4 — Deprecation window.** A rule scheduled for change MUST pass through `Deprecated` with a successor named before becoming binding, so contributors can migrate deterministically.
- **EV-5 — Evidence-driven refinement.** Changes SHOULD cite the research, incident, or audit finding that motivated them, recorded in Revision History, so evolution is traceable rather than stylistic.
- **EV-6 — Backward-compatibility invariant.** No evolution may lower a tier-1–4 guarantee (safety, consent/privacy, honesty, dignity/inclusion). These may only be strengthened.
- **EV-7 — Open Questions as the change pipeline.** Every normative change SHOULD originate from a resolved Open Question, so the guidelines grow by closing known gaps rather than by ad-hoc addition.

---

# Open Questions

- **Q-1** Exact bounded action-count and reachability definition for safety controls (R-8) across surface classes — to be fixed in `SHIG-0102`.
- **Q-2** Concrete low-bandwidth/low-end performance budgets and the loading-priority contract for trust/safety information (PF-1, PF-3) — to be fixed in the performance profile spec.
- **Q-3** The canonical visual/semantic encoding of the three trust states beyond "must be distinct and not color-only" (R-1) — to be fixed in `SHIG-0100` + the tokens spec, without weakening R-1.
- **Q-4** The standard inference-labeling vocabulary and placement (R-3) so labeling is consistent, not per-surface.
- **Q-5** The minimum language set and script-coverage matrix for the localization floor (R-11, CC-1) — to be fixed in `SHIG-0103`.
- **Q-6** Whether, and how, expert/advanced trust-provenance views (R-22) are standardized versus left to domain specs.
- **Q-7** The recorded-justification format for `SHOULD` deviations (V-15) and where it is stored for audit.
- **Q-8** Conformance evidence format: how a shipped surface machine-declares which SHIG clauses it satisfies for audit (Objective 9).

---

# Revision History

| Version | Date | Status | Author (role) | Summary |
|---|---|---|---|---|
| 1.0.0 | 2026-07-25 | Active — Normative Baseline | Chief Design Officer, Sambandh | Initial issue. Establishes the SHIG rule grammar (RFC-2119 keywords, permanent requirement IDs, conformance levels), the ten governing principles, mandatory/recommended/optional/prohibited rules (R-1..R-22), the six constraint classes, the lexicographic Decision Matrix (Safety ▸ Consent ▸ Honesty ▸ Dignity ▸ Usability ▸ Consistency ▸ Aesthetics ▸ Engagement), edge/fallback/conflict rules, the blocking Validation Checklist (V-1..V-15), anti-patterns (AP-1..AP-14), the evolution/versioning model, and Open Questions Q-1..Q-8. |

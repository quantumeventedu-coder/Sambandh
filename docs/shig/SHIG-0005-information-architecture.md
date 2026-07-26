# Specification ID

SHIG-0005

# Specification Name

Information Architecture Specification

# Version

1.0.0

# Status

Active

---

## 1. Purpose

This specification defines the permanent, implementation-independent rules by which **information is organized** across the entire Sambandh ecosystem: how content, knowledge, relationships, features, services, and signals are classified, named, related, prioritized, disclosed, and governed. It governs the organizing logic *behind* screens, menus, sitemaps, and wireframes — never those artifacts themselves. Where any organizing choice trades off against another value, the choice is resolved by the Constitution Article 4 lexicographic hierarchy (SHIG-0000); this spec neither restates that order nor invents a competing one.

## 2. Scope

**2.1 In scope.** The organizing rules for: content and knowledge structures; taxonomy/ontology construction; metadata; naming; content relationships and single-source-of-truth; discoverability, prioritization, and progressive disclosure; grouping/chunking/density; mental-model alignment; navigation depth/breadth; search-vs-browse arbitration; filtering, sorting, recommendation, and AI-assisted discovery organizing constraints; and content governance (creation, evolution, deprecation, ownership, conflict resolution).

**2.2 Out of scope.** Visual design, component behavior, copy tone, screen layout, routing technology, database schema, and menu labels as delivered. Those are governed elsewhere and MUST consume — not redefine — the structures set here.

**2.3 Applicability.** Every Sambandh surface, vertical, and future product (marketplace, consultation, membership, Gift Pass, family, compatibility, Lakshan, events, learning, community, administration) MUST map its information onto the structures defined here.

## 3. Objectives

- **O1 — One coherent structure.** A person encounters one consistent organizing logic across all verticals, not a per-vertical improvisation.
- **O2 — Minimum cognitive load, maximum discoverability.** Structures reduce what a person must hold in memory and maximize the probability that relevant information is found (Constitution C-5, C-15).
- **O3 — Honest structure.** Organization never encodes inference-as-fact, never ranks people by inferred character, and never manufactures salience to drive engagement (C-2, C-3, C-16).
- **O4 — Fail-secure organization.** Unknown trust, consent, or verification state resolves to the more protective placement, not the more permissive one.
- **O5 — Longevity.** Structures are systemic and versionable, extendable additively without reorganizing the whole (C-17, SHIG-0001 additive-first).

## 4. Information Organization Philosophy

**IA-1 — Trust-graded organization.** Every information structure MUST be organized so that trust, consent, verification, and safety state are *first-class organizing dimensions*, not attributes buried inside items. *Why:* trust precedes engagement (C-1) and unknown state must fail secure (Constitution fail-secure). *Implication:* placement, grouping, and default visibility of any item are a function of its verification/consent state. *Verify:* pick any item type; confirm its structure defines a rendering and placement for each of {verified, unverified, consent-granted, consent-absent, ambiguous} and that ambiguous maps to the protective case.

**IA-2 — Person-mental-model primacy over system convenience.** Information MUST be organized around how a person naturally thinks about a task and its domain, not around internal system, team, or data-source boundaries. *Why:* recognition over recall and match-expectations (C-9-adjacent, C-15). *Implication:* categories mirror user goals; org-chart or storage boundaries never leak into structure. *Verify:* trace three top user goals; each is achievable without the person knowing any internal module boundary.

**IA-3 — Single conceptual home.** Every distinct concept MUST have exactly one canonical home (single source of truth); all other appearances are references to it, never copies. *Why:* duplication breeds drift, contradiction, and dishonest signal (C-2, C-17). *Implication:* cross-links, not clones. *Verify:* for any concept, exactly one location is authoritative and editable; all others resolve to it.

**IA-4 — Restraint in structure.** Structures MUST expose the least organization necessary to accomplish the task, deferring depth and detail (premium-through-restraint, C-14; calm-over-stimulation, C-13). *Why:* excess structure is cognitive noise. *Implication:* progressive disclosure is the default, not an exception. *Verify:* count decisions a person must make before first useful action; structure minimizes it without hiding safety, consent, or honesty affordances.

**IA-5 — Evidence-driven structure.** Any non-trivial organizing choice SHOULD be justified by observed task evidence, not aesthetic preference; deviations from a SHOULD MUST record the higher Article-4 tier served. *Why:* evidence-over-opinion (C-17). *Verify:* the structure decision log names the evidence or the tier.

## 5. Content Architecture

**IA-6 — Layered architecture.** All information MUST resolve into four permanent layers, and every item MUST declare exactly one primary layer: (a) **Entity layer** — the things that exist (people/profiles, offerings, passes, events, articles, services); (b) **Relationship layer** — connections between entities (family, compatibility links, membership, ownership, authorship); (c) **Signal layer** — states, statuses, and derived indicators about entities/relationships (verification, consent, availability, Lakshan attributes, recommendations); (d) **Action layer** — what a person may do (browse, request, redeem, consult, join). *Why:* separating things, links, states, and actions prevents conflating an inference (signal) with a fact (entity) — the honesty core of C-2/C-3. *Verify:* every content type maps to one primary layer; no signal-layer item is presented as an entity-layer fact.

**IA-7 — Signal-layer honesty tagging.** Every signal-layer item MUST carry, as intrinsic metadata, its epistemic status ∈ {declared, verified, inferred, predicted, unknown}. Inferred/predicted items MUST NOT be structurally rendered in positions reserved for verified facts. *Why:* C-2 honesty-of-signal; C-16 ethical-AI. *Verify:* sample AI/derived items; each carries an epistemic tag and no inferred item occupies a fact slot.

**IA-8 — Vertical parity.** Each vertical MUST reuse the four-layer architecture and the shared hierarchies; a vertical MAY extend a hierarchy additively but MUST NOT fork the architecture. *Why:* O1, longevity. *Verify:* new-vertical review shows mapping onto existing layers/hierarchies and lists only additive extensions.

## 6. The Hierarchies

**IA-9 — Hierarchy definition contract.** Every hierarchy below is defined by two permanent properties only: its **organizing rule** (the principle that assigns an item a place) and its **ordering criterion** (the rule that ranks siblings). No hierarchy may order by inferred human character, appearance, complexion, caste, religion, region, or language (C-3 NON-INFERENCE). Ties in any ordering MUST break deterministically and disclosably (e.g., recency then stable identifier), never by undisclosed weighting. Where an ordering could imply merit/quality about a person, it MUST instead order by declared/verified attributes relevant to the stated task, and label the basis.

| ID | Hierarchy | Organizing rule | Ordering criterion |
|----|-----------|-----------------|--------------------|
| IA-10 | Content | Group by the person's goal the content serves, then by layer (§5) | Task relevance to current context, then recency |
| IA-11 | Knowledge | Organize by concept dependency (prerequisite → dependent) | Foundational-before-advanced; canonical concept first |
| IA-12 | Relationship | Organize by relationship type and mutual-consent state | Closeness as *declared by both parties*, then consent recency — never inferred intimacy |
| IA-13 | Feature | Group by the job a feature does for the person | Frequency/centrality to core task, then reversibility (safer/reversible surfaced first) |
| IA-14 | Service | Organize by service outcome the person seeks | Availability and verification state, then declared fit to request |
| IA-15 | Navigation | Organize by destination purpose, breadth-first at top | Primary tasks first; safety/consent/exit paths always reachable (C-4) |
| IA-16 | Search | Organize results by match confidence with honest scoring | Query relevance with disclosed basis; verified before unverified at equal relevance |
| IA-17 | Discovery | Organize by consented interest signals only | Declared preference match, then diversity; inference-framed and labeled (C-16) |
| IA-18 | User-Journey | Organize by task stage (intent → decision → action → follow-up) | Sequential task-completion order; context preserved across stages |
| IA-19 | Decision | Organize choices by consequence and reversibility | Reversible/low-consequence options first; destructive/irreversible clearly last and confirmed |
| IA-20 | Notification | Organize by actionability and time-sensitivity, honestly typed | Safety/consent/security first, then person-relevant, then informational; no manufactured urgency (C-13) |
| IA-21 | Priority | Organize by Article-4 tier of the underlying concern | Strict tier order: safety ▸ consent/privacy ▸ honesty ▸ dignity ▸ task ▸ calm ▸ consistency ▸ craft ▸ growth |
| IA-22 | Dashboard | Group by the person's current decisions to be made | Outstanding actions the person owns, then status, then history |
| IA-23 | Profile | Organize by disclosure scope (self / connections / public), consent-gated | Consent scope, then person-declared prominence; no third-party inference fields elevated |
| IA-24 | Membership | Organize by entitlement and its lifecycle state | Active-before-expired; obligations and renewal terms shown before benefits framing |
| IA-25 | Gift Pass | Organize by pass lifecycle (issued → shared → redeemable → redeemed → granted) | Current redeemable state first; one-time-use and expiry states honestly surfaced |
| IA-26 | Family | Organize by declared kinship with per-member consent | Kinship role as mutually declared; no inferred relations; each member's visibility self-controlled |
| IA-27 | Compatibility | Organize as an assistive, labeled signal between consenting parties | Declared/verified attribute alignment; result framed as computed indication, never verdict on worth (C-2, C-3) |
| IA-28 | Lakshan | Organize attributes as declared/observed descriptors, never as character judgments | Descriptor category, then salience to the person's stated purpose; each attribute epistemically tagged (IA-7) |
| IA-29 | Marketplace | Organize offerings by need category and verification state | Declared fit to query, then availability, then verification; ranking basis disclosed; no pay-for-hidden-rank (honesty C-2) |
| IA-30 | Events | Organize by temporal proximity and participation state | Upcoming-before-past, then relevance to consented interests; timezone/locale explicit |
| IA-31 | Learning | Organize by competency path (see Knowledge IA-11) | Prerequisite order, then person's progress state |
| IA-32 | Community | Organize by topic and consent-to-participate | Topic relevance and activity, then recency; safety/report affordances always present |
| IA-33 | Settings | Organize by what the setting controls, safety/consent/privacy grouped and reachable | Frequency of change, with consent/privacy/security controls never buried (C-4, C-6) |
| IA-34 | Privacy | Organize by data category and its consent scope | Data-minimization first; most-protective default; revocation adjacent to grant (C-4, C-6) |
| IA-35 | Security | Organize by asset sensitivity and account-control criticality | Highest-sensitivity/account-recovery controls most reachable; fail-secure defaults |
| IA-36 | Administration | Organize by governed domain with least-privilege scoping | Authority scope, then audit-criticality; staff actions attributable and reversible where possible |
| IA-37 | Future-product | Organize by mapping onto existing layers/hierarchies before inventing new ones | Additive extension order; new structure justified only by unmet task, never novelty (C-15) |

## 7. Classification, Categorization, Taxonomy, Ontology

**IA-38 — Class creation rule.** A new class MUST be created only when items in it (a) share a person-recognizable defining purpose, (b) are not adequately served by an existing class, and (c) can be unambiguously assigned (an item belongs to exactly one primary class). *Why:* prevents category sprawl and overlap (C-17). *Verify:* new-class proposal answers all three; failing (b) forces reuse.

**IA-39 — Categorization is mutually exclusive at the primary level, poly-hierarchical at the secondary level.** Each item has exactly one **primary** category (its canonical home, IA-3) and MAY carry multiple **secondary** facets for cross-discovery. *Why:* single home for governance, multiple paths for findability. *Verify:* every item has one primary; secondary facets never redefine the home.

**IA-40 — Taxonomy is user-language, faceted, and finite-per-level.** Taxonomy terms MUST be drawn from the person's vocabulary (IA-2), be faceted (independent dimensions such as need, availability, locale, verification), and present no more than the chunking limit (IA-55) of sibling terms per level. *Verify:* term audit shows no internal jargon; each facet is independent; sibling counts conform.

**IA-41 — Ontology relations are typed and directional.** Relationships between classes MUST use a controlled, versioned set of typed relations (e.g., *is-a*, *part-of*, *offered-by*, *authored-by*, *consented-to*, *derived-from*). New relation types follow the governance process (§17). Relations that assert something about a person MUST be *declared-by* or *verified-by* typed, never *inferred* unless carrying the inferred epistemic tag (IA-7). *Verify:* relation inventory is controlled and versioned; no untyped or covert relations exist.

**IA-42 — No prohibited classification axes.** No class, facet, taxonomy term, or ontology relation may be defined on appearance, complexion, caste, religion, region, or language *as a proxy for character, worth, or trust* (C-3). Such attributes MAY exist only as person-declared, consent-scoped, purpose-limited descriptors and MUST NOT drive priority/ranking of people. *Verify:* classification audit finds no prohibited axis in any ranking or trust structure.

## 8. Metadata Strategy

**IA-43 — Mandatory metadata envelope.** Every item MUST carry: canonical identifier; primary layer (§5) and class; epistemic status (IA-7) where it is a signal; consent scope; verification state; ownership (§17); locale/localization keys; created/updated provenance. *Why:* metadata is the substrate for honest, consent-aware, localizable organization. *Verify:* schema review confirms all envelope fields present and non-null (or explicitly "unknown", treated fail-secure).

**IA-44 — Metadata drives placement; content does not self-assert placement.** An item's position in any hierarchy MUST be computed from its metadata, not hard-coded per item. *Why:* consistency and maintainability at scale (C-17). *Verify:* re-computing placement from metadata reproduces the delivered structure.

**IA-45 — Provenance and freshness are honest.** Derived, aggregated, or AI-produced metadata MUST record its source and generation basis; stale metadata MUST be detectable and MUST NOT be presented as current. *Verify:* each derived field exposes provenance; freshness thresholds defined per field.

## 9. Naming Strategy

**IA-46 — Names are clear, consistent, localizable, jargon-free.** Every category, facet, relation, and structural label MUST: describe purpose in the person's language; use one term per concept and one concept per term across the whole ecosystem; be localizable (no single-language/script/numeral assumption, C-10); favor recognition over recall (no codes the person must memorize). *Why:* C-9, C-10, C-15. *Verify:* a naming lexicon exists; audit finds no synonym collisions, no internal codenames surfaced, and every term has localization entries.

**IA-47 — Names are stable and additive.** A concept's name MUST NOT be silently repurposed; renames follow versioned governance with redirects preserving prior recognition. *Verify:* rename log shows old→new mapping and preserved references.

## 10. Content Relationships

**IA-48 — Parent-child rule.** A parent-child relation MUST express containment or dependency, not mere visual grouping, and every child MUST have exactly one primary parent (its canonical home). *Verify:* each child resolves to one primary parent; incidental groupings use facets, not parentage.

**IA-49 — Cross-linking principle.** Related items MUST be connected by reference to the canonical source (IA-3), bidirectionally discoverable where both sides consent, and never by duplicating content. *Verify:* cross-links dereference to canonical items; no duplicated payloads.

**IA-50 — Single-source-of-truth enforcement.** For any fact shown in multiple places, exactly one source is authoritative; all displays derive from it. *Verify:* changing the canonical source updates all references; no independent editable copies exist.

**IA-51 — Conflict resolution order.** When two sources disagree, resolve by, in order: (1) the source higher on Article-4 tiers (e.g., a safety/consent record overrides a convenience cache); (2) the more recently verified source; (3) the source with stronger epistemic status (verified > declared > inferred); (4) escalate to the owner (§17) and, until resolved, present the more protective/less-asserting value with an honest "unconfirmed" state. *Why:* Article 4 supremacy and fail-secure. *Verify:* conflict test cases resolve in this exact order and default protective while unresolved.

## 11. Content Discoverability and Prioritization

**IA-52 — Prioritization follows Article-4 tiers, never engagement value.** What is surfaced, elevated, or defaulted MUST be prioritized by the Priority hierarchy (IA-21); business/growth (tier 9) MUST NOT elevate an item over any higher-tier concern, and MUST NOT manufacture salience or urgency (C-13). *Verify:* audit any "featured/elevated" slot; its basis is a higher tier or disclosed relevance, never covert monetization or urgency.

**IA-53 — Discoverability floor.** Every published item MUST be reachable by at least one browse path *and* be retrievable by search using the person's own terms; safety, consent, privacy, and exit affordances MUST be reachable from every context (C-4). *Verify:* no orphan items; findability test with lay vocabulary succeeds; safety paths present everywhere.

## 12. Progressive Disclosure

**IA-54 — Disclose by need and consequence.** Information MUST be revealed in order of task-necessity and reversibility: first what is needed to decide/act, then supporting detail on demand; higher-consequence or irreversible detail is disclosed with commensurate prominence and confirmation (IA-19). Safety, consent terms, honest limitations, costs, and obligations MUST NOT be hidden behind progressive disclosure. *Why:* C-13 calm, C-14 restraint, C-2 honesty. *Verify:* first-view contains everything needed for an informed, safe first decision; nothing safety/consent/cost-relevant is one level deeper than its benefit framing.

## 13. Information Density, Grouping, Chunking

**IA-55 — Chunking limit and semantic grouping.** Sibling items at any one level MUST be grouped into semantically coherent sets, and any single ungrouped set SHOULD NOT exceed a recall-safe chunk size (target ≤ 7±2 salient siblings); larger sets MUST be sub-grouped or faceted. *Why:* working-memory limits, C-5. *Verify:* level audit finds coherent groups and conformant sibling counts, or a recorded justification.

**IA-56 — Density serves scanning, not decoration.** Grouping MUST reflect meaning (shared purpose/relationship), never arbitrary visual balance; density MUST preserve the accessibility floor and never convey grouping by color/position/motion alone (C-8). *Verify:* remove all color/position/motion cues; grouping remains understandable via text/structure.

## 14. Mental Models

**IA-57 — Match the person's model; preserve context.** Structures MUST correspond to a stated, testable mental model of how a person thinks about Sambandh (a place of trusted relationships and services, organized by *my goals, my relationships, my consented data*), MUST favor recognition over recall, and MUST preserve context across navigation (where the person was, what they selected, how to return/undo — C-7 reversibility). *Verify:* card-sort/tree-test alignment ≥ the acceptance threshold (§19); back/return/undo preserves prior state in journey tests.

## 15. Navigation Depth vs Breadth

**IA-58 — Shallow-and-broad by default, deep-when-dependency-demands.** Top-level structure MUST be broad enough that primary tasks are reachable within a small, bounded number of steps (target: any primary task ≤ 3 levels deep), preferring breadth over deep nesting unless the domain has genuine dependency depth (then depth mirrors dependency, IA-11). Safety/consent/exit are always ≤ 1 step (C-4). *Why:* minimize traversal cost, C-5. *Verify:* depth audit: primary tasks within target depth; no level exists solely to defer choice.

## 16. Search-first vs Browse-first

**IA-59 — Arbitration rule.** Choose **browse-first** when the person's need is exploratory, the domain is bounded, or the person cannot yet name what they want (recognition); choose **search-first** when the corpus is large, the need is known and nameable, and recall is efficient. When both apply, provide both with a browse-visible entry and search always reachable; never force recall where recognition suffices. *Why:* C-5, C-15. *Verify:* per surface, the decision cites corpus size and need type; both paths lead to the same canonical items (IA-3).

## 17. Filtering, Sorting, Recommendations, AI-assisted Discovery

**IA-60 — Filters and sorts are honest, disclosed, and person-controlled.** Available filters/sorts MUST operate on declared/verified metadata, disclose their basis, default to the most protective/least-presumptuous option, and never secretly reorder by monetization. Sorting MUST never rank people by inferred character (IA-9, C-3). *Verify:* every sort/filter names its metadata basis; default is protective; no hidden reorder.

**IA-61 — Recommendations and AI-assisted discovery are consent-bounded, labeled, inference-framed.** Any recommendation or AI-assisted organization MUST: operate only on consented signals (C-4); be clearly labeled as assistance/suggestion, not authority (C-16); be framed as inference/possibility, never fact or verdict; never rank or gate people by inferred character, worth, or trust (C-3); expose its basis and offer a non-personalized alternative and an off switch. Compatibility/Lakshan outputs (IA-27, IA-28) are subject to this rule. *Why:* C-2, C-3, C-4, C-16. *Verify:* each recommendation surface shows consent scope, label, inference framing, basis, opt-out, and passes the no-person-ranking-by-inference test.

## 18. Content Governance

**IA-62 — Category lifecycle.** New categories/classes/relations MUST enter via a proposal that satisfies IA-38, is reviewed by the assigned domain owner, and follows the SHIG-0001 status lifecycle (Draft→Review→Active→Deprecated→Retired) with semantic versioning; evolution is additive-first. *Verify:* every structural change has a proposal, an owner sign-off, a status, and a version bump.

**IA-63 — Ownership assignment.** Every hierarchy, class, facet, relation type, and canonical source MUST have exactly one accountable owner responsible for its integrity, conflict resolution (IA-51), and deprecation. Unowned structure MUST NOT ship. *Verify:* ownership register maps every structural element to one owner; no gaps.

**IA-64 — Duplication prevention.** Before creating any category or content home, the proposer MUST search existing structure for an adequate home; creation is rejected if an existing class satisfies IA-38(b). *Verify:* proposals record the duplication check; audits find no two classes with the same defining purpose.

**IA-65 — Deprecation without breakage.** Deprecated structures MUST retain redirects/references so existing items and links remain resolvable through at least one MAJOR version; Tier 1–4 guarantees (safety, consent/privacy, honesty, dignity) MUST only be strengthened across versions, never lowered (SHIG-0001). *Verify:* deprecation plan includes redirect/retention and a guarantee-non-regression check.

**IA-66 — Consistency maintenance.** A periodic IA audit (§19) MUST verify naming lexicon integrity, single-source-of-truth, taxonomy sibling limits, and prohibited-axis absence; findings are tracked to closure by owners. *Verify:* audit cadence defined; last audit closed or tracked.

## 19. Decision Framework

**IA-67 — Permanent structural-choice rule.** When two or more organizational structures are viable, select by this exact order:
1. **Article-4 compliance (SHIG-0000).** Eliminate any structure that causes a loss at a higher tier (safety ▸ consent/privacy ▸ honesty ▸ dignity ▸ task ▸ calm ▸ consistency ▸ craft ▸ growth). A lower-tier gain never justifies a higher-tier loss.
2. **Cognitive load and discoverability.** Among survivors, choose the structure that minimizes what the person must recall/decide and maximizes probability of finding relevant information (O2).
3. **Single-source-of-truth / no duplication (IA-3).**
4. **Consistency with existing structure (C-15) over novelty.**
5. **Additivity / longevity (C-17):** prefer the structure extendable without global reorganization.
6. **Evidence (C-17):** where still tied, choose the option with stronger task evidence; record the basis.

*Verify:* every non-trivial IA decision cites this ladder and stops at the first rule that discriminates.

## 20. Quality Requirements

**IA-68 — Measurable acceptance criteria.** An IA change is **accepted** only if it satisfies all: (a) tree-test task-success and card-sort agreement meet the pre-registered threshold for the affected tasks; (b) no primary task exceeds the depth target (IA-58); (c) findability test with lay vocabulary succeeds for every published item (IA-53); (d) zero prohibited-axis violations (IA-42); (e) every item carries a complete metadata envelope (IA-43); (f) single-source-of-truth holds (IA-50); (g) all safety/consent/privacy/exit affordances reachable within their step budget (C-4). Failing any (a)–(g) is **rejection**.

**IA-69 — Audit methodology.** IA audits MUST combine: structural static checks (naming lexicon, sibling limits, ownership completeness, epistemic tagging, duplication scan) and behavioral tests (tree testing, card sorting, first-click/findability, journey context-preservation, recommendation honesty tests). Each audit records method, sample, thresholds, and outcomes. *Verify:* audit report contains all listed methods and pass/fail per criterion.

**IA-70 — Scalability validation.** Any structure MUST be validated to hold as corpus, verticals, and locales grow: sibling limits remain conformant via faceting/sub-grouping; adding a vertical requires only additive mapping (IA-8); adding a locale requires only localization entries (IA-46), not restructuring. *Verify:* scale test injects a new vertical and locale; structure absorbs both additively without violating IA-55 or IA-46.

---

# Compliance / Review Checklist

| # | Check | Rule(s) | Pass condition |
|---|-------|---------|----------------|
| 1 | Trust/consent/verification are first-class organizing dimensions; ambiguous fails secure | IA-1, IA-7, IA-43 | Every item type defines protective default for unknown state |
| 2 | Structure follows person's mental model, not system boundaries | IA-2, IA-57 | Tree/card-sort meets threshold; no internal boundary leaks |
| 3 | Every concept has one canonical home; references not copies | IA-3, IA-49, IA-50 | Editing source updates all references; no duplicate payloads |
| 4 | Four-layer architecture applied; no signal shown as fact | IA-6, IA-7 | Each item maps to one layer; inferred items tagged, not in fact slots |
| 5 | Hierarchies ordered per defined criteria; no ordering by inferred character/appearance/caste/religion/region/language | IA-9, IA-42, IA-60 | Prohibited-axis scan clean; ties break disclosably |
| 6 | Priority strictly follows Article-4 tiers; no urgency/engagement elevation | IA-21, IA-52 | No elevated slot justified by tier ≤ concern it overrides |
| 7 | Classes mutually exclusive at primary level; facets poly-hierarchical | IA-38, IA-39 | One primary home per item; independent facets |
| 8 | Metadata envelope complete and drives placement | IA-43, IA-44, IA-45 | All envelope fields present; placement re-computable |
| 9 | Naming clear, consistent, localizable, jargon-free, stable | IA-46, IA-47 | Lexicon audit clean; localization entries present |
| 10 | Conflicts resolve in defined order; protective while unresolved | IA-51 | Test cases resolve per ladder; default protective |
| 11 | Discoverability floor + progressive disclosure honesty | IA-53, IA-54 | No orphans; no safety/consent/cost hidden deeper than benefit |
| 12 | Chunking/grouping semantic and accessible | IA-55, IA-56 | Sibling limits met; grouping survives removal of color/position/motion |
| 13 | Depth/breadth and search/browse arbitration recorded | IA-58, IA-59 | Primary tasks ≤ depth target; arbitration cites corpus + need |
| 14 | Recommendations/AI consent-bounded, labeled, inference-framed, opt-out | IA-61 | Each surface shows scope, label, framing, basis, off switch |
| 15 | Governance: proposal, owner, version, duplication check, non-regression | IA-62–IA-66 | Every structural change traceable; Tier 1–4 never lowered |
| 16 | Decision ladder applied to structural choices | IA-67 | Decisions cite ladder, stop at first discriminating rule |
| 17 | Acceptance/audit/scalability criteria met | IA-68–IA-70 | All (a)–(g) pass; audit complete; scale test additive |

# Anti-patterns

- **Duplicate homes.** The same concept independently editable in two places; references replaced by copies (violates IA-3, IA-50).
- **System-shaped structure.** Categories mirroring internal teams, modules, or storage instead of person goals (IA-2).
- **Inference-as-fact placement.** Predicted/inferred signals occupying slots reserved for verified facts, or unlabeled AI output (IA-7, IA-61).
- **Character-ranking.** Any sort/filter/recommendation ordering people by inferred worth/trust, or classification on appearance/complexion/caste/religion/region/language as a proxy (IA-9, IA-42).
- **Engagement-driven salience.** Manufactured urgency, covert monetized reordering, or business-tier elevation over higher tiers (IA-52, IA-60).
- **Consent-blind discovery.** Recommendations built on non-consented signals or without an opt-out/non-personalized path (IA-61).
- **Deep-nesting to defer choice.** Levels that exist only to postpone decisions; primary tasks buried beyond depth target (IA-58).
- **Hidden essentials.** Costs, obligations, limitations, safety, or consent terms buried behind progressive disclosure while benefits are surfaced (IA-54).
- **Category sprawl.** New classes created without duplication check or unambiguous assignment (IA-38, IA-64).
- **Meaning-by-styling-alone.** Grouping/priority conveyed only through color, position, or motion (IA-56, C-8).
- **Unowned or unversioned structure.** Hierarchies/classes shipped without an accountable owner or lifecycle status (IA-62, IA-63).
- **Silent rename/repurpose.** Reusing a name for a new concept without redirects, breaking recognition (IA-46, IA-47).
- **Buried safety/exit.** Safety, consent, privacy, or exit paths not reachable within their step budget (IA-15, IA-53).

# Open Questions

1. **OQ-1.** Canonical thresholds for tree-test success and card-sort agreement (IA-68) — to be fixed by an empirical baseline study, then frozen per version.
2. **OQ-2.** The exact controlled inventory of ontology relation types (IA-41) and its versioning cadence.
3. **OQ-3.** Standard freshness thresholds per derived-metadata field (IA-45).
4. **OQ-4.** Locale-specific chunking adjustments (IA-55) where script density or numeral systems affect recall-safe siblings.
5. **OQ-5.** Cross-vertical facet reconciliation when two verticals define overlapping secondary facets (IA-39) — merge vs namespace policy.
6. **OQ-6.** Minimum disclosure format for recommendation "basis" (IA-61) that is honest yet does not overwhelm (interaction with IA-54); to be co-specified with the disclosure/consent spec.

# Revision History

| Version | Date | Status | Author | Summary |
|---------|------|--------|--------|---------|
| 1.0.0 | 2026-07-26 | Active | Chief Design Officer | Initial Active specification of Sambandh Information Architecture: philosophy, four-layer content architecture, 28 organizing hierarchies (IA-10–IA-37), classification/taxonomy/ontology rules, metadata, naming, relationships, discoverability, progressive disclosure, density, mental models, navigation and search arbitration, filtering/sorting/AI-discovery constraints, content governance, Article-4-anchored decision framework, and measurable quality requirements. Requirement IDs IA-1..IA-70 assigned permanently. |
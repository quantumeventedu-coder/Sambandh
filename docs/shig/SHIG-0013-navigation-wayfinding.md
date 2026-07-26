# Specification ID

SHIG-0013

# Specification Name

Navigation & Wayfinding System Specification

# Version

1.0.0

# Status

Active

# 1. Purpose & Scope

**NAV-1** This specification MUST govern how Sambandh preserves a member's orientation, decision-confidence, and safe exploration across every surface, feature, service, platform, and device. It governs *the experience of knowing where one is and moving with confidence* — NOT nav bars, menus, layouts, routing tables, URL schemes, or components (those are implementation).

**NAV-2** At every moment a member MUST be able to answer, without effort: (a) where am I, (b) what am I viewing, (c) why am I here, (d) what can I do, (e) what happens next, (f) how do I return, (g) how do I explore without risk. A surface that leaves any of (a)–(g) unanswerable is non-conformant.

**NAV-3** This specification MUST comply with SHIG-0000 (Constitution, Article 4 lexicographic hierarchy; principles C-1..C-17) and follow SHIG-0001 rule grammar. Philosophy stated in SHIG-0000/0001/0005/0006 MUST be referenced, not restated.

**NAV-4** Purpose of **Navigation**: to move members between locations and states. Purpose of **Wayfinding**: to keep members oriented while (and whether or not) they move. Navigation MUST NOT be treated as complete without wayfinding; a member may arrive correctly yet be disoriented.

**NAV-5 (Navigation vs Wayfinding)** Navigation = the available paths and the acts of traversal. Wayfinding = the cues that let a member build and maintain a mental map. Both MUST be designed as one system; either alone is non-conformant.

## 1.1 Cross-Instrument Relationships

**NAV-6** Navigation MUST express the structure defined by SHIG-0005 Information Architecture; it MUST NOT invent structure that contradicts the canonical IA. Where navigation needs a grouping the IA lacks, the IA MUST be amended first (deviation requires recorded justification per SHIG-0001).

**NAV-7** Navigation MUST conform to member mental models per SHIG-0006; labels, order, and destinations MUST match members' expectations of what a path leads to. A path whose destination violates the model it evokes is non-conformant (see Anti-patterns AP-4).

**NAV-8 (Navigation ↔ Trust)** Navigation MUST honor SHIG-0000 C-1 (trust-before-engagement). It MUST NOT surface a destination requiring trust the member has not established, nor imply access that gating will deny. Unknown trust state MUST resolve to *unverified* (fail-secure).

**NAV-9 (Navigation ↔ Cognitive load)** Navigation MUST minimize working-memory demand (Tier 5–6). The number of *simultaneously live* primary choices SHOULD be constrained to what a member can hold in mind; overflow MUST be structured (grouped, staged, or searchable), never merely listed (see AP-11).

**NAV-10 (Navigation ↔ Scalability)** Navigation structure MUST scale as features, services, and content grow without restructuring the member's learned map. New capability MUST attach to existing landmarks or introduce a clearly-signposted new landmark; it MUST NOT silently displace an established path (Tier 7 consistency).

## 1.2 Navigation as Four Duties

**NAV-11** Every navigation surface MUST serve, in order of precedence when they conflict: **Orientation** (member knows position) ▸ **Decision-support** (member can choose well) ▸ **Context-preservation** (member's prior state survives movement) ▸ **Empowerment** (member can explore and reach goals). Conflicts among these resolve by SHIG-0000 Article 4, not by this local order alone.

# 2. Navigation Principles

Each principle below is a normative requirement bearing its own ID. Multiple navigation *modes* MAY coexist on one surface; when they do, NAV-27 governs their reconciliation.

**NAV-12 (Global)** A persistent, always-reachable path to the top-level regions of the IA MUST exist from every non-modal surface. Global navigation MUST reflect the same regions in the same relative order everywhere it appears (Tier 7).

**NAV-13 (Local)** Within a region, navigation to sibling and child destinations MUST be available and MUST make the current region evident. Local navigation MUST NOT be the only indication of the current global region (never single-channel meaning, C-7/WCAG 2.2 AA).

**NAV-14 (Contextual)** Navigation offered because of the member's current object or state MUST be clearly bound to that object/state and MUST disappear or update when the context changes. Contextual actions MUST NOT persist as stale affordances.

**NAV-15 (Hierarchical)** The member's depth within the IA MUST be expressed by a stable, honest ancestry cue (e.g., a path trail) that both shows location and offers return to each ancestor. Ancestry MUST match SHIG-0005; fabricated or shortcut ancestry that misrepresents structure is non-conformant.

**NAV-16 (Sequential)** For any ordered flow (onboarding, verification, payment, multi-step tasks), the member MUST see total extent, current position, and what remains, and MUST be able to move backward without data loss where the step is reversible (C-7 reversibility). Irreversible steps MUST be labeled as such before commitment (Tier 1–2).

**NAV-17 (Task-based)** Navigation organized around a task MUST present only the choices that advance that task, MUST show task progress, and MUST provide an explicit, non-destructive exit that preserves or safely discards partial work with the member's informed choice.

**NAV-18 (Goal-oriented)** Where a member's goal is known or declared, navigation SHOULD offer the shortest honest path to it, provided the path does not bypass required trust/consent gates (Tiers 1–2 over Tier 5 efficiency).

**NAV-19 (Exploratory)** Navigation MUST support open-ended browsing in which no wrong move is punishing: every exploratory step MUST be reversible or clearly previewed, so exploration carries no fear of irreversible consequence (C-11 calm; C-7 reversibility).

**NAV-20 (Relationship navigation)** Movement between people-related surfaces (profiles, compatibility, conversations, family) MUST preserve the relational context (who, at what stage, under what consent) and MUST NOT expose a relationship action the current trust/consent stage does not permit.

**NAV-21 (Search-driven)** Search MUST be reachable as a first-class navigation mode from global scope. Search MUST state its scope, MUST return honest "no result" states, and MUST let members refine rather than dead-end (see §5, AP-2).

**NAV-22 (AI-assisted)** AI-assisted navigation (suggested destinations, "take me to…", assistant-led wayfinding) MUST be **labeled as AI**, MUST be **consent-bounded** (off unless the member has consented; ambiguous consent = not-consented), and MUST position AI as **assistance, not authority** (C-13). The member MUST retain and see the equivalent non-AI path. AI MUST NOT be the sole route to any destination.

**NAV-23 (AI non-inference constraint)** AI-assisted navigation MUST NOT prioritize, hide, or route based on inferred appearance, complexion, caste, religion, region, or language, nor any inferred character judgment (C-3 non-inference; see NAV-52).

**NAV-24 (Cross-feature)** A member MUST be able to move between related features without exiting to a hub and re-entering; related features MUST cross-link where the relationship is real. Cross-links MUST NOT create silos' opposite error — false adjacency between unrelated features (AP-6).

**NAV-25 (Cross-service)** Movement between Sambandh services (marketplace, consultation, learning, events, community, etc.) MUST preserve identity, trust state, consent state, and (where lawful and consented) task context, so the member perceives one ecosystem, not disjoint apps (C-7 continuity; Tier 2 consent boundaries respected).

**NAV-26 (Cross-platform / cross-device)** The member's *conceptual* navigation map MUST be identical across desktop, mobile, tablet, PWA, wearable, voice, and spatial surfaces. Presentation MAY adapt to each platform's affordances; **meaning, structure, labels, and destination identity MUST NOT diverge** (Tier 7; see §6). A path present on one device SHOULD be discoverable on another or its absence explained.

**NAV-27 (Mode reconciliation)** When global, local, contextual, and task navigation coexist, their scopes MUST be visually and semantically distinguishable so the member can tell *which map they are reading*. Overlapping or ambiguous scope is non-conformant (AP-11, AP-13).

# 3. Wayfinding Principles

**NAV-28 (Orientation)** Every surface MUST continuously answer "where am I" through at least two independent cues (e.g., region indicator + ancestry trail), never a single channel (C-7, WCAG 2.2 AA).

**NAV-29 (Location / Path / Destination / Progress awareness)** Wayfinding MUST make current *location* explicit, MUST reveal the *path* taken (how the member arrived) where it aids return, MUST name *destinations* before the member commits to them, and MUST show *progress* in any bounded journey (NAV-16).

**NAV-30 (Context preservation)** Moving to a new surface MUST NOT silently discard the member's prior context (filters, scroll position, draft input, selection, conversation state). Context MUST be preserved, restorable on return, or its loss explicitly confirmed by the member (AP-8).

**NAV-31 (Continuity)** Transitions between surfaces MUST feel continuous: the member MUST be able to relate the new surface to the previous one. Abrupt relocation with no perceivable relationship to the prior state is non-conformant.

**NAV-32 (Information scent)** Every navigational choice MUST carry honest scent — a truthful cue of what lies beyond it — sufficient for the member to predict the destination. Scent MUST match destination; misleading or absent scent is non-conformant (C-2 honesty-of-signal; AP-7).

**NAV-33 (Landmarks)** The IA's major regions MUST function as stable landmarks: recognizable, consistently named and placed, and reachable from anywhere. Landmarks MUST NOT move or rename across releases without migration signposting (Tier 7; NAV-10).

**NAV-34 (Reference points)** Members MUST have durable reference points to return to — a home/base, saved items, history, and their own profile — each reachable in a bounded number of steps from any location.

**NAV-35 (Recognition over recall)** Wayfinding MUST favor recognition: destinations, prior locations, and available actions MUST be presented for the member to recognize rather than requiring recall of names or paths (Tier 5–6; SHIG-0006).

**NAV-36 (Memory support)** The system MUST offload the member's memory: recently visited, history, and resumable state MUST be available so members are not required to remember where they were (NAV-30; §5).

**NAV-37 (Exploration confidence)** Members MUST be able to see where a choice leads and retreat unharmed before committing. Every exploratory action MUST be previewable, reversible, or non-consequential; consequential actions MUST require explicit intent (C-7, C-11).

**NAV-38 (Recovery from disorientation)** From any state of "I don't know where I am," a member MUST have a single, always-present action that returns them to a known reference point without data loss. This recovery affordance MUST exist on every surface including errors, modals, and dead-ends.

**NAV-39 (Recovery from errors)** Navigation and system errors MUST resolve to an oriented state: the member MUST be told what happened, where they now are, and offered at least one honest forward path and one return path. No error may terminate in a dead-end (AP-2, AP-14; C-14 honest states).

**NAV-40 (Predictability)** Identical navigational cues MUST produce identical outcomes everywhere and over time. The same label MUST lead to the same destination across surfaces and releases (Tier 7; AP-5).

**NAV-41 (Simplicity)** Wayfinding MUST expose the least structure needed for confident movement; incidental complexity MUST be hidden or staged. Depth beyond what the task requires is non-conformant (AP-9; premium-through-restraint C-15).

**NAV-42 (Efficiency)** Common journeys MUST be achievable in few, obvious steps. Efficiency MUST NOT be bought by removing orientation, consent, or reversibility (Tiers 1–2, 6 over Tier 5).

# 4. User-Journey Orientation Tables

**NAV-43** Each journey area below MUST satisfy its row. Columns: **Primary navigation goals**, **Expected intent**, **System responsibilities**, **Recovery strategy**, **Success criteria**. All rows inherit NAV-2 (the seven answerables) and NAV-38/39 (recovery). Where a stage involves data or people, Tiers 1–2 (safety, consent, privacy) override task efficiency.

| # | Area | Primary navigation goals | Expected intent | System responsibilities | Recovery strategy | Success criteria |
|---|------|--------------------------|-----------------|--------------------------|-------------------|------------------|
| NAV-44 | Discovery | Enter without commitment; grasp what Sambandh is; find a starting point | "What is this, is it for me, where do I begin" | Present honest scent for each region; no forced sign-up to look; label trust-gated areas | Always-visible return to entry; no dead-end teasers | Member locates a first action unaided; no false-access impressions |
| NAV-45 | Onboarding | Understand steps, position, and cost of proceeding | "How do I set up, how long, what's asked" | Show total steps + progress (NAV-16); allow back; save partial safely | Resume from last step; exit preserves or discards by explicit choice | Members complete or resume without re-entry loss |
| NAV-46 | Verification | Know what is being verified, why, and current status | "What proof, why, am I trusted yet" | State verification purpose + honest status; never imply verified when unverified (fail-secure) | Clear path to complete later; no lockout dead-end | Trust state always truthfully shown; C-1 honored |
| NAV-47 | Profile | Reach, review, edit own profile; know visibility | "How do I see what others see, edit, control exposure" | Distinguish self-view vs others-view; show consent/visibility scope | Undo edits; return to base | Member predicts who sees what; edits reversible |
| NAV-48 | Compatibility | Understand basis of any match cue; navigate to people surfaces | "Why suggested, on what honest basis" | Explain basis in honest, non-inferred terms (NAV-23, C-3); no character ranking | Return to prior list preserving context | No inference-based routing; member trusts the basis |
| NAV-49 | AI Assistance | Invoke/dismiss AI help; know it is AI | "Can something guide me, is it human or AI" | Label AI; consent-bound; keep manual path (NAV-22) | Dismiss AI, revert to manual anytime | AI never sole path; consent respected |
| NAV-50 | Conversations | Reach threads; know stage/consent; return | "Where's the chat, may I contact, where was I" | Preserve thread + draft context (NAV-30); enforce stage gates | Restore unsent drafts; return to thread list | No lost drafts; no stage-violating actions offered |
| NAV-51 | Membership | Compare tiers; know current tier and entitlements | "What do I have, what changes if I upgrade" | Honest state of current entitlements; no dark-pattern routing | Reversible change flows; clear cancel path | Member navigates tiers without coercion (Tier 9 never over Tier 3) |
| NAV-52 | Gift Pass | Buy, share code, redeem | "How to give, share, redeem safely" | Show one-time nature + status; guard against misdirected redemption | Recover unredeemed/abandoned flow; clear error states | Correct party redeems once; states honest |
| NAV-53 | Payments | Know amount, currency, finality before paying | "What am I paying, is it final, can I go back" | Show total in stated currency; mark irreversible steps (NAV-16); confirm intent | Back before commit; receipt + return after | No accidental irreversible charge; Tier 1–2 upheld |
| NAV-54 | Events | Discover, understand, register; know time/place | "What, when, where, am I in" | Honest event scent; registration status; safety info reachable (safety-reachable C-5) | Cancel/undo registration; return to listing | Member reaches and reverses registration confidently |
| NAV-55 | Community | Move among spaces; know norms and one's standing | "Where can I participate, what are the rules" | Signpost norms + safety/report at all times (C-5); honest space identity | Leave space cleanly; return to base | Safety always reachable; no silo entrapment |
| NAV-56 | Learning | Find, resume, track progress in content | "Where did I stop, what's next" | Persist progress + position (NAV-36); show path through material | Resume exactly; return to catalog | Members resume without recall |
| NAV-57 | Notifications | Understand each notice; navigate to its source; control them | "What is this, where does it take me, make it stop" | Honest scent to source; preserve origin context; reachable controls | Return to prior task after follow; dismiss safely | No misleading notices; member controls flow (C-11 calm) |
| NAV-58 | Settings | Locate and change controls; understand effect | "Where is the control, what will it change" | Group by mental model (SHIG-0006); state effect + reversibility | Undo; return to prior surface | Members find controls by recognition; changes reversible |
| NAV-59 | Support | Reach help from anywhere; know status of request | "How do I get help now, is it being handled" | Support reachable from every surface incl. errors (C-5); honest status | Escalation path; never a support dead-end | Help always one action away; no unresolved loops |
| NAV-60 | Family | Navigate multi-person/relational context with correct permissions | "Who can see/do what within family scope" | Enforce per-person consent/permission scope; make scope visible | Return to individual context; correct mis-scoped moves | No permission leakage across family members (Tier 2) |

# 5. Search, Discovery & Wayfinding Aids

**NAV-61 (Search)** Search MUST declare its scope, support refinement, return honest empty states with next actions, and never punish exploratory queries. Search MUST NOT surface trust-gated results as if openly accessible.

**NAV-62 (Browsing)** Browsing MUST provide continuous scent and stable landmarks (NAV-32/33) so members never browse "blind." Position within a browse set MUST be preserved on drill-in and restored on return (NAV-30).

**NAV-63 (Filtering)** Filters MUST show which are active, their combined effect, and a one-action reset. Filters MUST NOT silently exclude in ways the member cannot see (honest state C-14).

**NAV-64 (Sorting)** Sort order MUST be labeled and truthful. Sorting MUST NOT reorder people by any inferred character or protected-attribute proxy (C-3; NAV-23).

**NAV-65 (Recommendations)** Recommendations MUST state that they are recommendations and give an honest, non-inferred basis. They MUST be a supplement to, never a replacement for, member-driven navigation (relationship-first, not metric-first C-12).

**NAV-66 (AI discovery)** AI-driven discovery MUST obey NAV-22/23 and MUST NOT rank, prioritize, or filter *people* by inferred character. Violations are Tier-4 (human-dignity) breaches and are prohibited regardless of business value (Tier 9 never over Tier 4).

**NAV-67 (Saved content)** Members MUST be able to save destinations/content and return to them reliably; saved items are a durable reference point (NAV-34).

**NAV-68 (History & recently-visited)** The system MUST offer honest history and recently-visited memory aids (NAV-36), MUST let members clear them, and MUST treat history as private-by-default (C-6).

**NAV-69 (Deep linking)** A deep link MUST land the member in an oriented state (NAV-2 satisfied) with valid ancestry (NAV-15) and MUST enforce trust/consent gates on arrival — a deep link MUST NOT bypass gating (fail-secure).

**NAV-70 (Cross-linking)** Cross-links MUST reflect real relationships (NAV-24), carry honest scent, and preserve originating context so the member can return.

**NAV-71 (Shortcuts)** Shortcuts MAY accelerate frequent journeys but MUST duplicate, never replace, a discoverable path, and MUST NOT be the sole route to any destination (NAV-22 principle generalized).

**NAV-72 (Contextual suggestions)** Contextual suggestions MUST be bound to current context (NAV-14), labeled when AI-generated (NAV-22), dismissible, and calm — they MUST NOT interrupt or pressure (C-11; AP-13).

# 6. Multi-Platform Consistency & Parity

**NAV-73** The following platforms are in scope: desktop, mobile, tablet, PWA, wearables, voice, AR/VR/XR/spatial, and ambient surfaces.

**NAV-74 (Conceptual parity)** Every platform MUST expose the same landmarks, regions, labels, and destination identities (NAV-26). A member MUST be able to transfer their learned map across platforms without relearning.

**NAV-75 (Adaptation without divergence)** Presentation and interaction MAY adapt to each platform's affordances and constraints; the *meaning* of a path MUST NOT change. Any platform that cannot offer a path MUST make its absence discoverable and explain where to complete it (no silent capability gaps; AP-14).

**NAV-76 (Non-visual & voice/ambient)** On voice, ambient, and non-visual surfaces, orientation cues MUST be conveyed through the available modality with equivalent meaning (never single-channel; WCAG 2.2 AA generalized). The member MUST always be told current location and available actions.

**NAV-77 (Spatial / XR)** In spatial/XR surfaces, members MUST always have a reliable "return to known reference point" and a truthful sense of location; immersion MUST NOT trap or disorient (NAV-38; C-11 calm).

**NAV-78 (Cross-device continuity)** State handed between devices MUST preserve identity, trust, consent, and (where consented) task context (NAV-25). Transfer MUST fail-secure: if trust/consent cannot be re-established on the new device, access resolves to unverified.

**NAV-79 (Accessibility parity)** Navigation and wayfinding MUST meet WCAG 2.2 AA on every platform; assistive-technology users MUST have full orientation, path, and recovery parity (C-7). Accessibility is Tier 4 and MUST NOT be traded for Tier 5/8/9 gains.

# 7. Decision Framework

**NAV-80** When evaluating competing navigation or wayfinding models, teams MUST apply SHIG-0000 Article 4 lexicographically. A model that better serves a lower tier MUST NOT be chosen over one that better serves a higher tier.

**NAV-81 (Selection rule)** Among models that do not violate any higher tier, teams MUST prefer the one that **most reduces cognitive load (Tier 5–6) and most maximizes honest discoverability**, then the more consistent (Tier 7), then the more restrained/crafted (Tier 8). Business preference (Tier 9) breaks ties only after all higher tiers are equal.

**NAV-82 (Non-negotiable principles)** The following MUST NOT be traded away for any lower-tier benefit: honest information scent (NAV-32, Tier 3); trust/consent gating and fail-secure resolution (NAV-8/69/78, Tiers 1–2); non-inference in routing/ranking (NAV-23/64/66, Tier 4); recovery from disorientation and no dead-ends (NAV-38/39, Tiers 1/5); reversibility of exploration (NAV-19/37, Tiers 2/6); accessibility parity (NAV-79, Tier 4); cross-platform meaning parity (NAV-74, Tier 7).

**NAV-83 (Deviation record)** Any SHOULD-level deviation MUST record a written justification naming the higher tier it serves, per SHIG-0001. MUST-level requirements admit no deviation.

**NAV-84 (Decision table)**

| Situation | Competing pull | Required resolution | Governing IDs |
|-----------|----------------|---------------------|---------------|
| Faster path bypasses a consent gate | Efficiency (T5) vs Consent (T2) | Keep the gate | NAV-8, NAV-69, NAV-82 |
| AI shortcut is the quickest route | Task success (T5) vs Ethical-AI/consent (T2/T4) | Manual path MUST remain; AI labeled + opt-in | NAV-22, NAV-71 |
| Personalized ordering boosts engagement via inferred traits | Business (T9) vs Dignity (T4) | Prohibited | NAV-23, NAV-66 |
| Denser menu shows more, raises load | Discoverability vs Cognitive load (T5–6) | Structure/stage overflow; do not dump | NAV-9, NAV-41 |
| New feature wants a prime landmark slot, displacing a known one | Novelty/Business (T8–9) vs Consistency (T7) | Preserve learned map; signpost additions | NAV-10, NAV-33, NAV-40 |
| Platform can't support a path | Craft/parity | Explain absence + where to complete | NAV-75 |
| Error has no obvious forward path | — | Provide forward + return; never dead-end | NAV-39, NAV-82 |

# 8. Quality Framework (Measurable)

**NAV-85** Each metric below MUST have a defined measurement method and an accept/reject threshold set per release and recorded. Evidence over opinion (C-17): claims of conformance MUST be backed by measurement.

| # | Quality attribute | What it measures | Accept | Reject |
|---|-------------------|------------------|--------|--------|
| NAV-86 | Navigation efficiency | Steps/effort to complete common journeys vs. defined ideal | Within target for defined top journeys | Systematic excess steps for common goals |
| NAV-87 | Learnability | Success on first attempt without instruction | Members succeed unaided at target rate | First-use failure above threshold |
| NAV-88 | Predictability | Same cue → same outcome across surfaces/time | Zero label→destination mismatches | Any mismatch (AP-5) present |
| NAV-89 | Wayfinding success | Members correctly report location/next/return when probed | ≥ target correct-orientation rate | Disorientation above threshold |
| NAV-90 | Task completion | Completion rate for defined journeys incl. recovery | Meets per-journey target | Below target or completion requires support |
| NAV-91 | User confidence | Members explore/commit without hesitation or fear (measured) | Meets confidence target | Hesitation/abandonment from uncertainty |
| NAV-92 | Search effectiveness | Query→useful-result and honest-empty handling | Meets success + honest-empty targets | Dead-end empties (AP-2) |
| NAV-93 | Discovery quality | Relevance + honesty of basis; zero inference | Honest, non-inferred, member-serving | Any inference-based routing (NAV-23) |
| NAV-94 | Information scent accuracy | Predicted vs actual destination agreement | Scent matches destination at target rate | Misleading scent present (AP-7) |
| NAV-95 | Orientation recovery | Time/steps to return to known point from lost state | Bounded, always available | Any unrecoverable state (AP-14) |
| NAV-96 | Navigation accessibility | WCAG 2.2 AA conformance + AT parity | Full parity, all platforms | Any AT orientation/recovery gap |
| NAV-97 | Cross-platform consistency | Concept/label/destination identity across platforms | Full conceptual parity | Any meaning divergence (NAV-74) |

**NAV-98 (Gate)** A release MUST NOT ship if any Tier 1–4-linked metric (NAV-88 mismatches, NAV-93 inference, NAV-95 unrecoverable states, NAV-96 accessibility) is in Reject. Tier 5–9 rejects MUST be recorded with a remediation plan (SHIG-0001).

# 9. Governance

**NAV-99** This specification is Tier 1–4 in effect and, per SHIG-0000, MAY only be strengthened, never weakened, by future revisions. Requirement IDs are permanent; a superseded rule is marked Deprecated, never reused or renumbered.

**NAV-100** Every navigation/wayfinding change MUST cite the NAV IDs it satisfies and record any SHOULD deviation with its higher-tier justification (NAV-83).

**NAV-101** Conformance MUST be evidenced by the §8 measurements at defined review points; unmeasured surfaces are treated as non-conformant (fail-secure; C-17).

**NAV-102** Conflicts between this spec and any implementation guide resolve in favor of this spec; conflicts between this spec and SHIG-0000/0001/0005/0006 resolve in favor of those higher/anchor instruments.

**NAV-103** New platforms entering scope MUST be assessed against §6 parity and §8 metrics before member exposure.

# Compliance / Review Checklist

- **NAV-104** All seven answerables (NAV-2) verifiable on every reviewed surface, including modals, errors, and empty states.
- **NAV-105** Orientation conveyed by ≥ 2 independent channels (NAV-28); no single-channel meaning (NAV-13, NAV-76).
- **NAV-106** Structure matches SHIG-0005 IA and SHIG-0006 mental models; no invented or contradictory structure (NAV-6/7).
- **NAV-107** Trust/consent gates enforced on all arrivals incl. deep links and device handoff; unknown/ambiguous resolves fail-secure (NAV-8/69/78).
- **NAV-108** Information scent present, honest, and destination-matched at every choice (NAV-32/94).
- **NAV-109** Every surface offers a recovery-to-known-point action; no dead-ends; errors resolve to oriented states (NAV-38/39).
- **NAV-110** Exploration reversible/previewable; irreversible steps labeled before commitment (NAV-16/19/37).
- **NAV-111** Context preserved or its loss explicitly confirmed across all movements (NAV-30).
- **NAV-112** AI navigation labeled, opt-in, non-authoritative, with an equivalent manual path; never sole route (NAV-22/71).
- **NAV-113** No routing/sorting/ranking/discovery uses inferred appearance, complexion, caste, religion, region, language, or character (NAV-23/64/66).
- **NAV-114** Landmarks stable; labels→destinations consistent across surfaces and releases; additions signposted, none displaced (NAV-33/40/10).
- **NAV-115** Conceptual parity + WCAG 2.2 AA + AT recovery parity across all in-scope platforms (NAV-74/76/79).
- **NAV-116** Safety and support reachable from every surface (NAV-55/59; C-5).
- **NAV-117** Each §8 metric measured with recorded accept/reject; NAV-98 gate honored.
- **NAV-118** Every change cites satisfied NAV IDs; SHOULD deviations carry higher-tier justification (NAV-83/100).

# Anti-patterns

For each: *why it harms · how to detect · how to prevent.*

- **AP-1 Hidden destinations** — Reachable value with no discoverable path. Harms discoverability/empowerment. Detect: destinations with zero honest inbound scent (NAV-32); reliance on memorized routes. Prevent: every destination MUST have a discoverable, scented path (NAV-1/71).
- **AP-2 Dead ends** — A surface with no forward and no honest return. Harms recovery/confidence. Detect: empty/error/leaf surfaces lacking forward+return. Prevent: NAV-38/39 recovery on every surface.
- **AP-3 Circular navigation** — Loops that never reach the goal. Harms task success/calm. Detect: journey graphs with cycles and no exit; support tickets citing "went in circles." Prevent: guaranteed progress + exit (NAV-17/39).
- **AP-4 Broken mental models** — Path leads somewhere the label/model did not promise. Harms trust/honesty. Detect: label↔destination mismatch vs SHIG-0006. Prevent: NAV-7/32/40.
- **AP-5 Inconsistency** — Same cue, different outcome across surfaces/time. Harms predictability/trust. Detect: cross-surface audit of label→destination. Prevent: NAV-40 predictability; Tier 7.
- **AP-6 Feature silos** — Related features unreachable from one another; or false adjacency between unrelated ones. Harms cross-feature/service flow. Detect: real relationships lacking cross-links, or cross-links without real relationship. Prevent: NAV-24/25/70.
- **AP-7 Poor information scent** — Weak/misleading cues. Harms decision-support. Detect: prediction-vs-actual scent test (NAV-94) failing. Prevent: NAV-32.
- **AP-8 Lost context** — Movement silently discards filters/drafts/position. Harms context-preservation. Detect: state loss on drill-in/return; lost-draft reports. Prevent: NAV-30/36.
- **AP-9 Excessive hierarchy** — More depth than the task needs. Harms simplicity/efficiency. Detect: deep paths for common goals; high step counts (NAV-86). Prevent: NAV-41; flatten/stage.
- **AP-10 Too many choices** — Undifferentiated overload of simultaneous options. Harms cognitive load. Detect: primary choice count exceeding hold-in-mind limit (NAV-9). Prevent: group/stage/search overflow.
- **AP-11 Navigation overload** — Multiple nav scopes competing with ambiguous ownership. Harms orientation. Detect: member cannot tell which "map" a control belongs to. Prevent: NAV-27 scope distinction.
- **AP-12 Ambiguous destinations** — Choice whose target cannot be predicted. Harms confidence. Detect: unnamed/unpreviewed destinations (NAV-29). Prevent: name/preview before commit.
- **AP-13 Interruptive/pressuring suggestions** — Suggestions that interrupt or coerce. Harms calm/dignity. Detect: modal or pressuring contextual prompts. Prevent: NAV-72; C-11.
- **AP-14 Unrecoverable errors / platform gaps** — States or missing platform paths with no way out or explanation. Harms safety/recovery/parity. Detect: NAV-95 unrecoverable states; NAV-75 silent capability gaps. Prevent: guaranteed recovery + explained absence.

# Open Questions

- **NAV-119** Standard measurement instruments and per-journey numeric thresholds for §8 metrics require SHIG-wide calibration and are deferred to a measurement annex.
- **NAV-120** Governance model for member-personalized navigation (reordering by explicit, consented preference) that stays within NAV-23 non-inference boundaries needs a dedicated rule set.
- **NAV-121** Ambient/XR orientation-cue equivalence (NAV-76/77) awaits a modality-mapping guide as those surfaces mature.
- **NAV-122** Cross-service task-context handoff (NAV-25) boundaries under differing consent scopes require a consent-propagation specification cross-referenced with SHIG-0000 Tier 2.

# Revision History

| Version | Date | Status | Author | Summary |
|---------|------|--------|--------|---------|
| 1.0.0 | 2026-07-26 | Active | Chief Design Officer, Sambandh | Initial governing specification for Navigation & Wayfinding; requirement IDs NAV-1..NAV-122. |
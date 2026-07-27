# Specification ID

SHIG-0008

# Specification Name

Design Vocabulary Specification

# Version

1.0.0

# Status

Active

# 1. Purpose & Scope

**DV-1 (MUST).** This specification MUST define and govern the *controlled semantic vocabulary* of Sambandh: the single canonical set of named design concepts — one term per concept, each with a precise definition — that every other SHIG specification, surface, token, contributor, and tool MUST use so that meaning never drifts. It governs the WORDS, terms, concept-names, and their definitions (a controlled dictionary plus the naming discipline that keeps it stable). *Why:* honesty-of-signal (C-2), consistency (C-15), and longevity/maintainability (C-16) are impossible if two people can name the same concept differently or the same word can mean two things. *Verify:* every governed concept resolves to exactly one canonical term with one definition, discoverable from this specification.

**DV-2 (MUST NOT).** This specification MUST NOT govern implementation. It defines no code, widget, framework, component, markup, style, literal value (no color, size, duration, font, spacing), nor any visual, motion, or copy expression. It supplies the *terms* that other specifications and design tokens consume; it does not decide how those terms are rendered, worded in member-facing copy, translated, or valued. *Why:* implementation-independence keeps the vocabulary durable across mediums, platforms, and eras. *Verify:* this document binds no literal value and specifies no expression, only concept-names and their meanings.

**DV-3 (MUST).** The vocabulary defined here is medium-independent and value-free: a canonical term names a *concept*, not a visual treatment, a member-facing string, or a judgement of worth. The same canonical term MUST hold whether the concept is expressed visually, in voice, in an API field, in documentation, in a code identifier, or in a design review. *Verify:* each term's definition can be applied unchanged across at least two mediums without altering its meaning.

## 1.1 Cross-Instrument Relationships

**DV-4 (MUST).** This specification MUST comply with SHIG-0000 (Constitution): the Article 4 lexicographic decision hierarchy (T1 Safety & legality ▸ T2 Consent & privacy ▸ T3 Honesty of signal ▸ T4 Human dignity & inclusion ▸ T5 Understanding & task success ▸ T6 Emotional wellbeing & calm ▸ T7 Consistency ▸ T8 Craft & aesthetics ▸ T9 Business & growth) and principles C-1..C-17. Philosophy stated there is referenced by ID, never restated. Where a vocabulary decision touches a higher tier and a lower tier, the higher tier governs; a lower-tier gain NEVER justifies a higher-tier loss.

**DV-5 (MUST).** This specification MUST follow SHIG-0001 rule grammar: RFC-2119 keywords (MUST / MUST NOT mandatory; SHOULD / SHOULD NOT recommended-with-recorded-justification; MAY optional), permanent sequential IDs, may-only-be-strengthened, fail-secure, and recorded deviations.

**DV-6 (MUST NOT).** This specification MUST NOT duplicate SHIG-0007 Visual Language. SHIG-0007 governs visual *principles and semantics* (how meaning is perceived and expressed); SHIG-0008 governs the *words and concept-names* those principles operate on. Where SHIG-0007 references a semantic (e.g., verified, inference, warning), the canonical term and its definition are owned here; the visual expression is owned there. *Verify:* no visual-expression rule appears in this document and no term-definition conflict exists between the two specs.

**DV-7 (MUST).** Every downstream SHIG specification, design token, pattern, surface, contributor, and tool that names a concept covered by this vocabulary MUST use the canonical term defined here, unchanged in meaning. A downstream instrument MUST NOT introduce a private synonym, redefine a canonical term, or narrow/widen its scope. Where a downstream instrument needs a concept this vocabulary lacks, the vocabulary MUST be amended first (per DV-56–DV-59); local invention is non-conformant. *Verify:* a cross-spec audit finds every governed concept named by its canonical term and no competing definitions.

# 2. Naming Discipline

Each requirement below is a normative rule bearing its own permanent ID. Sections 3–10 then define the canonical vocabularies these rules govern.

**DV-8 (One canonical term per concept — MUST).** Each governed concept MUST have exactly one canonical term. A concept with two accepted names, or no agreed name, is non-conformant until reduced to one. *Why:* T7 consistency; C-16 maintainability. *Verify:* the concept→term map is a function (no concept maps to two terms).

**DV-9 (No synonyms — MUST NOT).** The vocabulary MUST NOT admit synonyms for a canonical term in governed contexts. Alternate words that name the same concept MUST be recorded as *deprecated aliases pointing to the canonical term*, never as co-equal terms. *Why:* T7 consistency; C-16 maintainability; restraint (C-14) — the vocabulary admits no more terms than its concepts require and never multiplies words for effect. *Verify:* for any two governed terms, their definitions are non-overlapping; no two terms name the same concept.

**DV-10 (No polysemy — MUST NOT).** A canonical term MUST NOT name more than one concept. A word that carries two meanings in governed use MUST be split into two distinct canonical terms or one meaning MUST be renamed. *Verify:* the term→concept map is injective (no term maps to two concepts).

**DV-11 (Precise definition required — MUST).** Every canonical term MUST carry a precise, testable definition stating what it means, its scope and boundary, and what it explicitly excludes. A term without a boundary-bearing definition is non-conformant. *Verify:* each definition lets a reviewer decide, for a given case, whether the term applies.

**DV-12 (Value-free and non-inferring — MUST NOT).** No canonical term or definition MUST encode or imply a judgement of a person's character, worth, trustworthiness, desirability, or rank derived from appearance, complexion, caste, religion, region, language, script, or name-form (C-3). Vocabulary MUST name states, provenance, and structure — never infer human character. *Verify:* no term ranks or beautifies persons; no definition references a protected attribute as a basis for judgement.

**DV-13 (Honest terms — MUST).** Canonical terms and definitions MUST be honest (C-2): a term MUST NOT assert or imply certainty, completion, safety, or verification the underlying state does not hold, and MUST NOT euphemize a consequential or negative state into a neutral or positive one. *Verify:* each term's implied claim matches the real state it names.

**DV-14 (Calm, non-coercive terms — MUST NOT).** Canonical terms MUST NOT be manufactured to create urgency, scarcity, anxiety, or compulsion (C-10). Vocabulary names states as they are; it does not editorialize to drive engagement or spend. *Verify:* no governed term encodes pressure absent a genuine time- or safety-bound state.

**DV-15 (Medium- and value-independence — MUST).** A canonical term's meaning MUST be independent of the medium, surface, platform, locale, and any business context in which it appears. Adapting expression to a medium MUST NOT change the concept the term names. Because a canonical term names a channel-independent concept, no governed concept's identity MUST depend on a single perceptual channel to be conveyed; the concept MUST remain distinguishable when expressed through more than one independent channel, so that downstream expression is never forced to rely on a single channel alone (C-8, never single-channel). *Verify:* the definition holds unchanged across mediums and locales, and each concept remains distinguishable through at least two independent perceptual channels (see DV-60–DV-62).

**DV-16 (Fail-secure default term — MUST).** For every vocabulary that includes an unknown, ambiguous, unassessed, or indeterminate condition, this specification MUST designate a single canonical *fail-secure default term* to which that condition resolves — always the safer, less-privileged, less-trusting interpretation. Silence, blankness, or absence of a term MUST NOT be readable as the more-trusting or higher-privilege state. *Verify:* each vocabulary names its fail-secure default and that default is the safe interpretation under Article 4 Tiers 1–2.

**DV-17 (Term stability — MUST).** Once active, a canonical term MUST be stable: it MUST NOT be silently renamed, re-scoped, or repurposed. Change follows the lifecycle in §11. *Why:* C-15 consistency, C-16 longevity. *Verify:* no active term's meaning has changed without a recorded lifecycle transition.

**DV-18 (Deprecation of ambiguous terms — MUST).** Any term found to be ambiguous, overloaded, euphemistic, inferring, or synonym-forming MUST be deprecated with a recorded reason and a pointer to the canonical term that replaces it (§11). Ambiguous vocabulary MUST NOT be tolerated in governed use once identified. *Verify:* every known ambiguous term has a deprecation record and a canonical replacement.

**DV-19 (India-first plurality of expression — MUST).** The canonical term is a stable concept-anchor; it MUST NOT assume a single language, script, numeral system, or name-form as the only valid expression (C-9). Localized or medium-specific expressions of a concept MUST preserve the canonical meaning exactly; translation MUST NOT drift, narrow, or widen the concept. *Verify:* each localized expression maps back to one canonical term with identical scope (see §12).

**DV-20 (No marketing or euphemism vocabulary — MUST NOT).** Governed vocabulary MUST NOT admit promotional, aspirational, or euphemistic terms in place of precise ones (e.g., naming an unverified state as if assured, or a destructive action as if benign). Marketing language belongs to member-facing copy governed elsewhere, never to the controlled vocabulary. This restraint (C-14) holds the vocabulary to the minimum set of precise terms its concepts require; embellishment and persuasion are not admitted. *Verify:* no governed term substitutes persuasion for precision.

**DV-21 (Definitions are the source of truth — MUST).** Where a term's everyday connotation and its governed definition differ, the governed definition in this specification MUST prevail for all SHIG purposes. Contributors MUST NOT rely on colloquial meaning. *Verify:* disputes resolve to the definition recorded here, not to common usage.

# 3. Canonical Vocabulary — Trust / Verification States

**DV-22 (MUST).** The canonical trust/verification vocabulary is EXACTLY the set below. No other term MUST be used in governed contexts to name a trust or verification state, and these terms MUST NOT be conflated with one another (C-1, C-2).

| Canonical term | Definition (scope-bounded) | Excludes |
|---|---|---|
| **verified** | A specific, named claim was checked against evidence by a stated authority/method at a stated time and held true; scope is bounded to that claim. | Does not mean the whole person, all their claims, or their future conduct is verified. |
| **unverified** | No successful verification of the claim in question exists (never attempted, pending, failed, expired, or unknown). | Does not mean false, fraudulent, or unsafe — only that trust is not established. |
| **unknown** | The system has no assessment of the claim's verification state at all. | Does not mean unverified-as-a-conclusion; it is an absence of assessment (see DV-24). |

**DV-23 (Scope-bound verification — MUST).** The term **verified** MUST always be qualified by WHAT was verified; an unqualified "verified" applied to a whole person or entity is non-conformant (C-2). A verified attribute MUST NOT be read as, or named as, a verified person. *Verify:* every use of *verified* names its bounded claim.

**DV-24 (Fail-secure trust default — MUST).** The fail-secure default for trust state is **unverified**. Any **unknown** or ambiguous trust condition MUST resolve, for all decisions and expressions, to **unverified** — never to verified and never to a blank state that could imply verified or safe (C-1, Tier 1). *Verify:* unknown/ambiguous trust always resolves to unverified.

**DV-25 (Deprecated ambiguous trust terms — MUST NOT).** The following (and equivalents) MUST NOT be used as governed trust terms because they overstate, infer, or conflate: *trusted*, *safe*, *legit*, *genuine*, *real*, *approved*, *certified* (when standing alone for a person), *good standing* (as a trust claim). Each MUST be replaced by *verified* (scope-bound) or *unverified* as the facts warrant. *Verify:* no deprecated trust term appears in governed use.

# 4. Canonical Vocabulary — Signal Provenance

**DV-26 (MUST).** Every asserted signal MUST carry exactly one canonical provenance label from the set below, distinguishing what the system *knows* from what it *infers* (C-2). These labels MUST NOT be conflated.

| Canonical term | Definition | Excludes |
|---|---|---|
| **fact** | An established, verifiable state the system actually holds and can trace to a source of truth. | Not a prediction, estimate, or interpretation. |
| **inference** | A conclusion derived by reasoning from data; probabilistic, may be wrong, not directly observed. | Not a fact; MUST NOT be presented as one. |
| **reading** | An interpretive summary or characterization the system offers as assistance (a "reading" of available signals), explicitly non-authoritative. | Not a fact and not a verdict on a person. |
| **insight** | A surfaced pattern or observation offered to aid understanding, framed as assistance, with stated basis and uncertainty. | Not a determination of worth or a guaranteed outcome. |

**DV-27 (Fact vs non-fact boundary — MUST).** A signal labeled **fact** MUST be traceable to a real source of truth; any **inference**, **reading**, or **insight** MUST be named as such and MUST NOT be labeled, framed, or defined as a fact, nor implied to carry certainty it lacks (C-2, Tier 3). *Verify:* each asserted signal's label matches its true provenance; no inference is named fact.

**DV-28 (Provenance is mandatory — MUST).** Any signal presented to a member or consumed by another surface as decision-relevant MUST bear a provenance label from DV-26; unlabeled decision-relevant signals are non-conformant. When provenance is itself unknown, the fail-secure default is the *lower-authority* label (inference/reading), never fact. *Verify:* every decision-relevant signal is labeled; ambiguity defaults away from fact.

**DV-29 (Non-inference of character in provenance — MUST NOT).** No **inference**, **reading**, or **insight** MUST characterize, rank, or score a person's worth, trustworthiness, or character from appearance, complexion, caste, religion, region, language, or name-form (C-3, Tier 4). Provenance labels name the *epistemic status* of a signal, never a judgement of a human. *Verify:* no reading/insight/inference encodes a prohibited character judgement.

**DV-30 (Deprecated ambiguous provenance terms — MUST NOT).** Terms that blur fact and inference MUST NOT be used as governed provenance labels, e.g.: *smart* (as in "smart match"), *AI-verified*, *predicted-as-fact*, *score* presented without provenance, *truth*, *match* used to imply certainty. Each MUST be replaced by the correct provenance label plus (where automated) the AI role label (§10). *Verify:* no deprecated provenance term appears in governed use.

# 5. Canonical Vocabulary — Action Severity Classes

**DV-31 (MUST).** Every action a member or operator can take MUST be classified by exactly one canonical severity class from the set below. The classification governs the reversibility and consent obligations owed to that action (C-4, C-7).

| Canonical term | Definition | Boundary |
|---|---|---|
| **safe** (safe/reversible) | An action with no lasting consequence, or one fully and easily reversible by the actor without loss. | No irrecoverable state change; no third-party effect. |
| **consequential** | An action with a real, lasting effect that is not trivially reversible, or that affects another party, money, privacy, or trust, but is not permanent-destructive. | Reversible only with effort/cost, or affects others; requires informed intent. |
| **irreversible** (irreversible/destructive) | An action that cannot be undone: permanent deletion, disclosure that cannot be recalled, an irrevocable commitment, or a destructive change. | No recovery path exists after commitment. |

**DV-32 (Severity classification is mandatory — MUST).** Every governed action MUST declare its severity class; an unclassified action is non-conformant. The class MUST reflect the action's true worst-case effect, not its typical case (C-2 honesty). *Verify:* each action carries a class matching its real consequence.

**DV-33 (Fail-secure severity default — MUST).** When an action's severity is unknown, ambiguous, or contested, it MUST default to the *higher* severity (unknown resolves toward **irreversible/destructive**), never the lower, so that consent and reversibility protections are never under-applied (Tiers 1–2). *Verify:* ambiguous severity is treated as the more severe class.

**DV-34 (Deprecated ambiguous severity terms — MUST NOT).** Euphemistic or minimizing terms MUST NOT stand in for a severity class, e.g.: *cleanup*, *tidy*, *just*, *simply*, *permanent* used without the **irreversible** class, *remove* used where **delete/destroy** is meant. Each MUST map to its true severity class. *Verify:* no minimizing term masks a consequential or irreversible action.

# 6. Canonical Vocabulary — Consent States

**DV-35 (MUST).** Consent MUST be named by exactly one canonical state from the set below. These states are the vocabulary for C-4 (consent precedes data and action; explicit, scoped, revocable, never pre-checked or bundled).

| Canonical term | Definition | Boundary |
|---|---|---|
| **granted** | The person gave explicit, informed, affirmative permission for a specified purpose. | Not implied, pre-checked, bundled, or assumed from inaction. |
| **scoped** | Consent that is granted but bounded to a stated purpose, recipient, duration, or extent; outside that scope it does not apply. | Scope is a limit, not a lesser grant; exceeding scope = not granted. |
| **revoked** | Previously granted consent the person has withdrawn; it no longer authorizes anything from the point of revocation. | Not a lapse or expiry alone — an affirmative withdrawal (though expiry also ends authorization). |
| **ambiguous** | Consent state that is unclear, unrecorded, implied, expired, or contested. | Not a grant of any kind. |

**DV-36 (Consent must be explicit and scoped — MUST).** Governed vocabulary MUST treat consent as **granted** only when explicit, informed, and affirmative, and MUST treat every grant as **scoped** to a stated purpose. Pre-checked, bundled, assumed, or inaction-derived permission MUST NOT be named **granted** (C-4). *Verify:* no non-explicit permission is labeled granted.

**DV-37 (Fail-secure consent default — MUST).** The fail-secure default for consent is **not-granted**: any **ambiguous** consent state MUST resolve, for every decision and action, to not-granted (C-4, Tier 2). Absence of a recorded grant MUST NOT be read as consent. *Verify:* ambiguous or absent consent blocks the data use or action.

**DV-38 (Deprecated ambiguous consent terms — MUST NOT).** Terms that soften or presume consent MUST NOT be used, e.g.: *agreed*, *accepted* (when derived from inaction or bundling), *opted-in* (without explicit affirmative act), *acknowledged* used as consent, *implied consent*. Each MUST map to the true canonical state — usually **ambiguous** (hence not-granted) unless a real explicit grant exists. *Verify:* no presumption term is treated as consent.

# 7. Canonical Vocabulary — Entity Types

**DV-39 (MUST).** The governed entity vocabulary is EXACTLY the set below. Each names a distinct concept and MUST NOT be conflated with another (notably **member** vs **profile**).

| Canonical term | Definition | Distinct from |
|---|---|---|
| **member** | A real human being who participates in Sambandh; the person, not their representation. | Not the profile; a member may control zero or more profiles. |
| **profile** | A structured representation a member presents; a curated set of attributes and disclosures, member-controlled. | Not the member; a representation, potentially partial. |
| **relationship stage** | A named, bounded point in the progression of a connection between members, defining what is mutually permitted at that point. | Not a permanent bond; a consent- and trust-bounded stage. |
| **partner** | An authenticated business or organizational entity offering listings or services within Sambandh. | Not a member and not staff. |
| **listing** | A discrete, described offering (item, service, or opportunity) published by a partner or member. | Not the partner; the thing offered. |
| **case** | A tracked unit of work, request, dispute, verification, or support interaction with a lifecycle and status. | Not a conversation or a profile; an accountable record of a matter. |

**DV-40 (Person vs representation — MUST).** Vocabulary MUST preserve the **member** (human) versus **profile** (representation) distinction at all times; a rule, right, or protection owed to a *person* MUST NOT be silently applied to a *representation* or vice versa (C-3 dignity; C-6 privacy). *Verify:* every governed statement about people is unambiguous as to member or profile.

**DV-41 (Entity classification is mandatory — MUST).** Every governed entity reference MUST resolve to exactly one canonical entity type. Where an entity's type is unknown, it MUST default to the least-privileged interpretation (e.g., an unauthenticated business is not a **partner**). *Verify:* no entity reference is untyped; unknown resolves to least privilege.

**DV-42 (Deprecated ambiguous entity terms — MUST NOT).** Overloaded terms MUST NOT be used as governed entity names, e.g.: *user* (collapses member/profile/guest), *account* (a credential construct, not a person), *contact*, *lead*, *record* (when a specific type is meant), *vendor* used interchangeably with **partner**. Each MUST map to the precise canonical type. *Verify:* no overloaded entity term appears in governed use.

# 8. Canonical Vocabulary — Surface Classes

**DV-43 (MUST).** Every surface MUST be classified by exactly one canonical surface class from the set below; the class declares the surface's dominant purpose and the protections it owes.

| Canonical term | Definition | Owes (by class) |
|---|---|---|
| **discovery** | A surface for open-ended, low-commitment exploration and orientation. | Honest scent; no coercion; reversibility of exploration (C-11). |
| **decision** | A surface where a member weighs options and chooses. | Decision-critical information present and honest (C-2). |
| **consent** | A surface that requests or manages permission for data or action. | Explicit, scoped, unbundled, revocable framing (C-4). |
| **safety** | A surface providing report, block, exit, help, or emergency guidance. | Persistent reachability; never obstructed (C-5, Tier 1). |
| **transaction** | A surface effecting a commitment, exchange, or payment. | Amount/finality/consequence disclosed before commitment (C-7). |
| **error-empty-loading** | A surface expressing an error, empty, or in-progress/loading state. | Honest state; cause; a forward and a return path (C-13). |

**DV-44 (Surface classification is mandatory — MUST).** Every governed surface MUST declare its class. A surface serving multiple purposes MUST declare the dominant class and honor the protections of every class it embodies; where classes conflict, the class owing the higher Article-4 tier governs (safety/consent over transaction over decision over discovery). *Verify:* each surface has a declared class and honors all protections it triggers.

**DV-45 (Fail-secure surface default — MUST).** When a surface's state is indeterminate (e.g., data not yet resolved), it MUST be treated as an **error-empty-loading** surface and owe honest-state protections — never presented as a completed **decision** or **transaction** surface (C-13). *Verify:* indeterminate surfaces default to honest loading/empty/error, not to false completion.

**DV-46 (Deprecated ambiguous surface terms — MUST NOT).** Vague terms MUST NOT stand in for a surface class, e.g.: *page*, *screen*, *view*, *modal* used to imply purpose; *dashboard* used without a class; *flow* used to obscure a consent or transaction step. These name form, not purpose; each governed surface MUST also carry its purpose class. *Verify:* no surface is governed by a form-word alone.

# 9. Canonical Vocabulary — Feedback Categories

**DV-47 (MUST).** System feedback MUST be named by exactly one canonical category from the set below. Each category MUST correspond to a real state (C-13 honest states).

| Canonical term | Definition | MUST correspond to |
|---|---|---|
| **success** | Confirmation that an intended action actually completed. | A genuinely completed outcome. |
| **error** | Notice that something failed or cannot proceed, stated honestly and without blaming the member. | A real failure or blocked state. |
| **warning** | Advance notice of reversible risk before commitment. | A real, pending, avoidable consequence. |
| **info** | Neutral, non-urgent information that requires no action. | A true, non-alarming state. |
| **progress** | Truthful indication that a real process is advancing. | Actual, monotonic advancement. |

**DV-48 (Feedback must be truthful — MUST).** A feedback category MUST NOT be applied to a state that does not hold: **success** MUST NOT be shown for an incomplete action, **progress** MUST NOT be fabricated, **error** MUST NOT blame the member, and **warning** MUST be reserved for genuine avoidable risk (C-13, C-2). The identity of a feedback category MUST NOT depend on a single perceptual channel to be distinguishable (C-8, per DV-15); the concept a category names is what governs, never its channel of expression. *Verify:* each feedback instance traces to the real state it claims and is distinguishable through more than one channel.

**DV-49 (Fail-secure feedback default — MUST).** When an outcome is unknown or unconfirmed, feedback MUST NOT default to **success**; it MUST resolve to **progress** (if genuinely pending) or **error/info** as honesty requires. Absence of confirmation MUST NOT be expressed as success (Tier 3). *Verify:* unconfirmed outcomes are never labeled success.

**DV-50 (Deprecated ambiguous feedback terms — MUST NOT).** Terms that overstate or alarm MUST NOT be used as governed feedback categories, e.g.: *done!* for a pending action, *oops/uh-oh* that trivializes real failure, *alert* used for non-urgent info, *complete* for partial states. Each MUST map to the true category. *Verify:* no feedback term misstates the underlying state.

# 10. Canonical Vocabulary — Role / Label Taxonomy

**DV-51 (MUST).** The canonical taxonomy of roles (who or what is acting or speaking) is EXACTLY the set below. Every actor and source in governed use MUST be labeled by one of these; the distinctions MUST NOT be blurred (C-12).

| Canonical term | Definition | MUST NOT be confused with |
|---|---|---|
| **member** | A human participant acting on their own behalf (see DV-39). | Staff, partner, or automated agent. |
| **partner** | An authenticated business/organizational actor (see DV-39). | Member or staff. |
| **operator** (staff) | An authenticated Sambandh staff actor performing governance or support. | Member or automated system. |
| **guest** (visitor) | An unauthenticated or pre-membership actor; least privilege. | Member; a guest is not yet a member. |
| **AI-assistant** | An automated, non-human source offering assistance; always labeled as automated, assistance-not-authority, consent-bounded, inference-framed. | A human, and the impersonal system. |
| **human-assistant** | A human providing help or support, distinguishable from automated assistance. | An AI-assistant; never disguised as automated or vice versa. |
| **system** | Impersonal platform mechanics (states, notifications, enforcement) attributable to no person. | A human or an AI persona. |

**DV-52 (Role labelling is mandatory — MUST).** Every actor or source in a governed context MUST carry a role label from DV-51. Where the actor is unknown or unauthenticated, the fail-secure default is **guest** (least privilege); trust and permissions attach to verified roles only (C-1). *Verify:* no actor is unlabeled; unknown resolves to guest.

**DV-53 (AI and human never disguised — MUST NOT).** An **AI-assistant** source MUST NOT be labeled, framed, or defined as human, and a **human-assistant** MUST NOT be disguised as automated or as impersonal **system** (C-12). Automated assistance MUST be nameable as automated wherever it acts. *Verify:* every assistive source's label matches its true nature.

**DV-54 (Dignity-preserving labels — MUST NOT).** Role and status labels MUST NOT shame, rank by worth, or derive standing from appearance, complexion, caste, religion, region, language, or name-form (C-3, Tier 4). Non-member or lower-tier status MUST be named factually, never weaponized. *Verify:* no role/status label is demeaning or inference-derived.

**DV-55 (Labels are medium-independent — MUST).** Role and status labels name a *relationship to the system*, not a visual badge or copy string; their meaning MUST hold across mediums and MUST NOT be redefined by any surface (DV-15). *Verify:* each label's definition is stable across mediums and surfaces.

# 11. Term Lifecycle & Deprecation

**DV-56 (MUST).** Every canonical term MUST occupy exactly one lifecycle state at any time: **proposed** (under governance review, not yet binding), **active** (binding and mandatory in governed use), **deprecated** (superseded; MUST NOT be used in new work; carries a pointer to its canonical replacement and a reason), or **retired** (fully removed from governed use after migration). *Verify:* each term has a recorded lifecycle state.

**DV-57 (Governed change only — MUST).** Adding, renaming, re-scoping, or deprecating a term MUST occur only through the recorded governance process (per SHIG-0001): the change MUST state the concept affected, the reason, the tier impact, and (for deprecation) the replacement and migration path. Silent change is prohibited (C-15, C-16). *Verify:* every term change has a complete governance record.

**DV-58 (No reuse of retired terms — MUST NOT).** A deprecated or retired term MUST NOT be reused for a different concept, and its former meaning MUST NOT be reassigned. Retired terms remain reserved to prevent meaning collision. *Verify:* no retired term names a new concept.

**DV-59 (Strengthen-only lifecycle — MUST).** Vocabulary changes MUST only preserve or strengthen honesty (C-2), non-inference (C-3), consent (C-4), and safety (C-5) guarantees — never weaken them. A change that would let a term overstate, infer, or under-protect relative to its predecessor is prohibited regardless of lower-tier benefit (Article 4). *Verify:* each change's tier-impact assessment shows no Tier 1–4 weakening.

# 12. Localization, Plurality & Cross-Medium Fidelity (India-first)

**DV-60 (Concept-anchor stability — MUST).** The canonical term is the stable anchor for a concept across all languages, scripts, numeral systems, name-forms, mediums, and platforms. Localized and medium-specific expressions MUST map back to exactly one canonical term with identical scope (C-9). *Verify:* every localized expression resolves to one canonical term without meaning change.

**DV-61 (No translation drift — MUST NOT).** A translation or medium adaptation MUST NOT narrow, widen, soften, or overstate a concept relative to its canonical definition; in particular it MUST NOT convert an **unverified** state into an assured one, an **inference** into a **fact**, an **ambiguous** consent into a grant, or an **irreversible** action into a benign one (C-2, C-4). *Verify:* back-translation and medium checks preserve the canonical definition.

**DV-62 (Plurality of expression — MUST).** The vocabulary MUST NOT assume one language, script, numeral system, or name-form as the default-human expression of any concept (C-9, C-3). All governed concepts MUST be expressible with equal fidelity across the supported Indian and global locales and mediums; a concept that cannot be so expressed MUST be flagged for governance, not approximated. *Verify:* each concept has an equivalent-fidelity expression in every supported locale/medium or a recorded gap.

# Decision Framework

**DV-63 (MUST).** When candidate terms, definitions, or vocabulary structures compete, teams MUST decide by the SHIG-0000 Article 4 lexicographic hierarchy. A term that better serves a lower tier MUST NOT be chosen over one that better serves a higher tier; a lower-tier gain NEVER justifies a higher-tier loss. *Verify:* the chosen term is not dominated at any higher tier by a rejected candidate.

**DV-64 (Non-negotiable vocabulary rules — MUST).** The following MUST NOT be traded away for consistency habit, aesthetics of language, brevity, or business appeal (Tiers 1–4): the verified/unverified/unknown distinction and fail-secure default (DV-22–DV-25); fact-vs-inference provenance (DV-26–DV-30); severity honesty and fail-secure default (DV-31–DV-34); explicit-scoped consent and its fail-secure default (DV-35–DV-38); non-inference of character (DV-12, DV-29, DV-54); honesty of terms (DV-13, DV-48, DV-61); channel-independence of concept identity (DV-15); and least-privilege/fail-secure defaults on unknown state (DV-16). *Verify:* no deviation record exists against these.

**DV-65 (Deviation record — MUST).** Any SHOULD-level deviation MUST record a written justification naming the higher tier it serves, per SHIG-0001. MUST-level requirements admit no deviation. *Verify:* each SHOULD deviation carries a higher-tier justification.

**DV-66 (Decision table).**

| Situation | Competing pull (tiers) | Required resolution | Governing IDs |
|---|---|---|---|
| A shorter, friendlier word overstates a trust state | Craft/brevity (T8) vs Honesty (T3) | Keep the precise, honest term | DV-13, DV-25, DV-64 |
| One word is convenient for both a fact and an inference | Consistency/convenience (T7) vs Honesty (T3) | Split into two terms; never conflate | DV-10, DV-27, DV-28 |
| Reusing an existing team word that infers character from a proxy | Consistency (T7) vs Dignity (T4) | Prohibited; choose a value-free term | DV-12, DV-29, DV-54 |
| Unknown trust/consent/severity has no obvious term | Task speed (T5) vs Safety/Consent (T1–2) | Resolve to fail-secure default (unverified / not-granted / more-severe) | DV-16, DV-24, DV-33, DV-37 |
| A euphemism reads calmer for a destructive action | Wellbeing/tone (T6) vs Honesty/Safety (T1–3) | Name the true severity plainly | DV-13, DV-34, DV-64 |
| A marketing label is preferred over the precise term | Business (T9) vs Honesty/Consistency (T3/T7) | Precise term governs; marketing stays in copy | DV-20, DV-64 |
| A locale lacks an exact equivalent for a concept | Task/coverage (T5) vs Honesty/Inclusion (T3/T4) | Flag to governance; do not approximate | DV-61, DV-62 |
| A concept's identity is expressible in only one channel | Craft/economy (T8) vs Inclusion (T4) | Require a channel-independent concept; never single-channel | DV-15, DV-64 |
| Two active terms are found to name the same concept | Consistency (T7) | Deprecate one to alias; keep one canonical | DV-9, DV-18, DV-57 |

# Quality Framework (Measurable)

**DV-67 (MUST).** Vocabulary conformance MUST be evidenced by measurement, not opinion (C-17). Each attribute below MUST have a defined method and an accept/reject criterion recorded per review.

| Quality attribute | What it measures | Accept | Reject |
|---|---|---|---|
| Term uniqueness | Concept→term is a function | Every concept maps to exactly one canonical term | Any concept with two accepted terms (DV-8) |
| No synonyms | Absence of co-equal synonyms | Alternates recorded only as deprecated aliases | Any live synonym pair (DV-9) |
| No polysemy | Term→concept is injective | Each term names one concept | Any term with two meanings (DV-10) |
| Definitional precision | Boundary-bearing definitions | Every term decidable for a given case | Any term without a testable boundary (DV-11) |
| Provenance honesty | Fact vs inference separation | No inference named or framed as fact | Any inference-as-fact (DV-27, DV-28) |
| Trust distinction | verified/unverified/unknown distinct + fail-secure | Three states distinct; unknown→unverified | Any conflation or wrong default (DV-22–DV-24) |
| Consent distinction | granted/scoped/revoked/ambiguous + fail-secure | States distinct; ambiguous→not-granted | Any presumption-as-consent (DV-35–DV-37) |
| Severity honesty | Class matches worst-case; fail-secure | Correct class; unknown→more severe | Any minimized/unclassified action (DV-31–DV-33) |
| Non-inference | No character judgement in vocabulary | Zero inference from protected attributes | Any inferring term/definition (DV-12, DV-29, DV-54) |
| Channel independence | Concept identity not bound to one channel | Each concept distinguishable via ≥2 independent channels | Any concept whose identity depends on a single channel (DV-15) |
| Downstream adoption | Cross-spec use of canonical terms | All governed concepts use canonical terms | Any private synonym or redefinition (DV-7) |
| Localization fidelity | Meaning preserved across locales/mediums | Back-mapping preserves scope | Any translation/medium drift (DV-60, DV-61) |
| Deprecation hygiene | Ambiguous terms retired, not reused | All known ambiguous terms deprecated w/ replacement | Any live ambiguous term or reused retired term (DV-18, DV-58) |

**DV-68 (Release gate — MUST).** A release, specification, or surface MUST NOT ship if any Tier 1–4-linked vocabulary attribute is in Reject: provenance honesty, trust distinction, consent distinction, severity honesty, non-inference, channel independence, or fail-secure defaults. Tier 5–9-linked rejects (e.g., a lingering deprecated alias) MUST be recorded with a remediation plan per SHIG-0001. Unmeasured vocabulary is treated as non-conformant (fail-secure; C-17). *Verify:* the gate record shows zero Tier 1–4 rejects before ship.

# Governance

**DV-69 (MUST).** This specification is Tier 1–4 in effect and, per SHIG-0000, MAY only be strengthened, never weakened, by future revisions. Requirement IDs (DV-n) are permanent; a superseded rule or term is marked Deprecated, never reused or renumbered (DV-56–DV-59).

**DV-70 (MUST).** Every specification, token set, surface, or tool that introduces, consumes, renames, or deprecates a governed concept MUST cite the DV IDs it satisfies and record any SHOULD deviation with its higher-tier justification (DV-65).

**DV-71 (MUST).** Conformance MUST be evidenced by the Quality Framework measurements at defined review points. Unmeasured vocabulary and undeclared terms are treated as non-conformant (fail-secure; C-17).

**DV-72 (MUST).** Conflicts between this specification and any downstream instrument resolve in favor of this specification for term meaning; conflicts between this specification and SHIG-0000/0001 resolve in favor of those anchor instruments. Conflicts of *visual expression* defer to SHIG-0007; conflicts of *term meaning* are owned here (DV-6).

**DV-73 (MUST).** A new vocabulary domain (a new family of governed concepts) MUST be assessed against the naming discipline (§2), assigned canonical terms, fail-secure defaults, and deprecations, and admitted through governance (DV-57) before any surface or spec uses its terms. *Verify:* no governed concept is used before it is admitted.

# Compliance / Review Checklist

- [ ] Every governed concept resolves to exactly one canonical term with a precise, boundary-bearing definition (DV-8, DV-11).
- [ ] No live synonyms and no polysemous terms; alternates recorded only as deprecated aliases (DV-9, DV-10, DV-18).
- [ ] The vocabulary is minimal — no more terms than concepts require; no embellishment or persuasion admitted (DV-9, DV-20; restraint, C-14).
- [ ] No term or definition infers character/worth from appearance, complexion, caste, religion, region, language, or name-form (DV-12, DV-29, DV-54).
- [ ] Terms are honest, calm, value-free, and non-euphemistic; no marketing substitutes for precision (DV-13, DV-14, DV-20).
- [ ] Each governed concept is channel-independent — its identity never depends on a single perceptual channel, and downstream expression can carry it through at least two independent channels (DV-15, DV-48; never single-channel, C-8).
- [ ] Trust states use verified/unverified/unknown, scope-bound, with unknown→unverified fail-secure (DV-22–DV-25).
- [ ] Every decision-relevant signal carries fact/inference/reading/insight provenance; no inference-as-fact (DV-26–DV-30).
- [ ] Every action carries a severity class; unknown defaults to the more severe (DV-31–DV-34).
- [ ] Consent uses granted/scoped/revoked/ambiguous, explicit and scoped, with ambiguous→not-granted (DV-35–DV-38).
- [ ] Entities use member/profile/relationship-stage/partner/listing/case; member vs profile preserved (DV-39–DV-42).
- [ ] Surfaces declare a class from discovery/decision/consent/safety/transaction/error-empty-loading and honor its protections (DV-43–DV-46).
- [ ] Feedback uses success/error/warning/info/progress and corresponds to real state; unconfirmed never "success" (DV-47–DV-50).
- [ ] Actors carry a role label; AI and human never disguised; unknown→guest (DV-51–DV-55).
- [ ] Every fail-secure vocabulary has a named default resolving to the safer interpretation (DV-16).
- [ ] Downstream instruments use canonical terms unchanged; no private redefinition (DV-7).
- [ ] Localized/medium expressions preserve canonical scope; no translation drift (DV-60–DV-62).
- [ ] Term changes follow the governed lifecycle; retired terms not reused; strengthen-only (DV-56–DV-59).
- [ ] Quality Framework measured; zero Tier 1–4 rejects at the release gate (DV-67, DV-68).
- [ ] Every change cites satisfied DV IDs; SHOULD deviations carry higher-tier justification (DV-65, DV-70).

# Anti-patterns

For each: *why it harms (C-n / tier) · how to detect · how to prevent.*

- **AP-1 Synonym sprawl** — Multiple words for one concept fragments meaning and erodes consistency, restraint, and maintainability (C-14/C-15/C-16, T7). Detect: two governed terms whose definitions overlap; teams using different words in review. Prevent: one canonical term; alternates recorded as deprecated aliases (DV-8, DV-9, DV-18).
- **AP-2 Overloaded word** — One word carries two meanings, so readers disambiguate by guesswork (C-2, T3/T5). Detect: a term with two contexts of use meaning different things (e.g., "match" as fact vs inference). Prevent: split into two terms or rename one (DV-10, DV-30).
- **AP-3 Inference dressed as fact** — Naming a prediction, reading, or estimate as fact implies certainty the system lacks (C-2, T3). Detect: decision-relevant signal labeled fact without a source of truth; "AI-verified" style terms. Prevent: mandatory provenance labels; fail-secure to lower authority (DV-26–DV-30).
- **AP-4 Trust overstatement** — Calling an unverified or unknown state "trusted/safe/genuine" confers unearned trust (C-1, T1). Detect: deprecated trust terms in use; unqualified "verified" on a whole person. Prevent: scope-bound verified/unverified/unknown; unknown→unverified (DV-22–DV-25).
- **AP-5 Consent presumption** — Naming bundled, pre-checked, or inaction-derived permission as "agreed/accepted/opted-in" manufactures consent (C-4, T2). Detect: consent labeled granted without an explicit affirmative act. Prevent: explicit-scoped granted only; ambiguous→not-granted (DV-35–DV-38).
- **AP-6 Severity euphemism** — Minimizing a consequential or destructive action ("cleanup", "just remove") strips its consent and reversibility protections (C-7, T1–2). Detect: minimizing verbs on actions with lasting effect. Prevent: mandatory severity class; unknown→more severe (DV-31–DV-34).
- **AP-7 Character-inferring vocabulary** — Terms that rank or characterize persons from appearance or protected attributes violate dignity and non-inference (C-3, T4). Detect: any term/definition scoring worth, desirability, or trustworthiness from a proxy. Prevent: value-free vocabulary; non-inference gate (DV-12, DV-29, DV-54).
- **AP-8 Person/representation collapse** — Using "user/account" to mean both the human and the profile misapplies rights and protections (C-3/C-6, T2/T4). Detect: statements ambiguous as to member vs profile. Prevent: preserve member vs profile distinction (DV-39, DV-40, DV-42).
- **AP-9 Blank-implies-safe** — Treating silence or absence of a term as the trusting/granted/benign state defeats fail-secure (C-1/C-4, T1–2). Detect: unknown state rendered as verified/granted/safe by omission. Prevent: named fail-secure defaults for every vocabulary (DV-16, DV-24, DV-37, DV-45).
- **AP-10 Marketing creep** — Promotional or aspirational labels displace precise ones, biasing understanding and abandoning restraint (C-2/C-14, T3 vs T9). Detect: persuasion words in governed vocabulary. Prevent: precision-only, minimal vocabulary; marketing stays in member copy (DV-13, DV-20).
- **AP-11 Silent redefinition** — A surface or spec quietly re-scopes or repurposes an active term, drifting meaning across the system (C-15/C-16, T7). Detect: same term used with a different boundary than defined here. Prevent: term stability + governed lifecycle only (DV-7, DV-17, DV-57).
- **AP-12 Translation drift** — A localized expression softens or overstates a concept (e.g., unverified rendered as assured) (C-2/C-9, T3/T4). Detect: back-translation changes scope. Prevent: concept-anchor fidelity; no drift (DV-60, DV-61, DV-62).
- **AP-13 Form-word governance** — Governing by "page/screen/modal/flow" (form) instead of purpose (class) hides the protections a surface owes (C-5/C-13, T1/T5). Detect: surfaces classified only by form. Prevent: mandatory purpose class (DV-43–DV-46).
- **AP-14 AI/human disguise** — Labeling an AI source as human or an impersonal system, or hiding a human as automated, misleads about authority and accountability (C-12, T2/T3). Detect: assistive source whose label mismatches its nature. Prevent: distinct, honest role labels (DV-51, DV-53).
- **AP-15 Single-channel concept** — Defining a concept whose identity can only be conveyed through one perceptual channel forces downstream expression to rely on that channel alone, excluding members who cannot perceive it (C-8, T4). Detect: a governed concept (often a feedback or state term) whose distinction collapses when a single channel is removed. Prevent: require channel-independent concept identity, distinguishable across ≥2 channels (DV-15, DV-48).
- **AP-16 Zombie terms** — Reusing a deprecated/retired term for a new concept collides old and new meanings (C-15/C-16, T7). Detect: a retired term naming something new. Prevent: reserve retired terms; no reuse (DV-56, DV-58).

# Open Questions

- **DV-74** The canonical, machine-readable registry format and tooling that publishes this vocabulary to downstream specs, tokens, and code identifiers (single source of truth) is deferred to a vocabulary-registry annex, without introducing implementation values here.
- **DV-75** Standard measurement instruments and acceptance thresholds for the Quality Framework (DV-67) — including how "term uniqueness", "no polysemy", and "channel independence" are audited at scale across specs — require SHIG-wide calibration.
- **DV-76** The authoritative supported-locale and script/numeral/name-form coverage list for DV-62 (India-first plus global) awaits coordination with the localization specification.
- **DV-77** Governance body, cadence, and quorum empowered to admit, rename, and deprecate terms (DV-57, DV-73), and the arbitration path when two specs contest a term's meaning (DV-72), require a dedicated governance charter.

# Revision History

| Version | Date | Status | Author | Summary |
|---|---|---|---|---|
| 1.0.0 | 2026-07-27 | Active | Chief Design Officer, Sambandh | Initial governing specification for the Sambandh controlled design vocabulary; naming discipline plus canonical vocabularies for trust/verification, signal provenance, action severity, consent, entity, surface, feedback, and role/label; requirement IDs DV-1..DV-77. |

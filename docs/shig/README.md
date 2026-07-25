# Sambandh Human Interface Guidelines (SHIG)

The single, testable source of truth for interface decisions across Sambandh. SHIG documents are engineering-grade specifications — normative, implementation-independent, and conformance-checkable — not a handbook.

**How to read a SHIG document.** Rules use RFC 2119 keywords (**MUST/MUST NOT**, **SHOULD/SHOULD NOT**, **MAY**) and carry permanent IDs (`R-n`, `V-n`, `AP-n`). A surface ships only if it passes every applicable blocking item in the referenced Validation Checklist.

**Root document.** [`SHIG-0001` — Foundation & Governance](SHIG-0001-foundation.md) governs the whole series: rule grammar, the ten principles, cross-cutting invariants, the lexicographic decision-priority order, and the conformance model. Every other SHIG document inherits from it and MUST NOT contradict it.

## Numbering

| Range | Class |
|---|---|
| `SHIG-0001`–`SHIG-0099` | Foundational / governance |
| `SHIG-0100`+ | Domain specifications |

Numbers are permanent and never reused after retirement.

## Register

| ID | Name | Status |
|---|---|---|
| [SHIG-0001](SHIG-0001-foundation.md) | Foundation & Governance | Active — Normative Baseline (v1.0.0) |
| SHIG-0100 | Trust & Verification Legibility | Reserved |
| SHIG-0101 | Consent Surfaces | Reserved |
| SHIG-0102 | Safety & Reporting Surfaces | Reserved |
| SHIG-0103 | Localization & Plurality | Reserved |
| SHIG-0104 | Accessibility Profiles | Reserved |
| SHIG-01xx | Design Tokens & Sensory Properties | Reserved |

## Decision-priority order (from SHIG-0001)

`Safety/Legality ▸ Consent/Privacy ▸ Honesty of Signal ▸ Dignity/Inclusion ▸ Usability ▸ Consistency ▸ Aesthetics ▸ Engagement`

Higher tiers are lexicographic over lower ones: a gain on a lower tier never justifies a loss on a higher tier.

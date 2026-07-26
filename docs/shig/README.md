# Sambandh Human Interface Guidelines (SHIG)

The single, testable source of truth for every design decision across Sambandh — engineering-grade, implementation-independent, conformance-checkable. Not a handbook.

**How to read a SHIG document.** Rules use RFC 2119 keywords (**MUST/MUST NOT**, **SHOULD/SHOULD NOT**, **MAY**) and carry permanent IDs. A surface ships only if it passes every applicable blocking item in the referenced Validation Checklist.

**Supreme authority.** [`SHIG-0000` — The Design Constitution](SHIG-0000-design-constitution.md) governs everything: the immutable principles C‑1…C‑17, role responsibilities, the amendment process, and the permanent decision hierarchy. No spec or decision may contradict it.

## Precedence (highest → lowest)

`SHIG-0000 (Constitution) ▸ SHIG-0001 (rule grammar) ▸ foundational specs (0002–0099) ▸ domain specs (0100+) ▸ component specs ▸ local decisions.`
A lower instrument may add constraints, never relax one imposed above it.

## Permanent decision hierarchy (Constitution Article 4)

`Safety ▸ Consent ▸ Honesty ▸ Dignity ▸ Understanding ▸ Wellbeing ▸ Consistency ▸ Craft ▸ Business`
Higher tiers are lexicographic over lower ones — a gain at a lower tier never justifies a loss at a higher tier.

## Register

| ID | Document | Purpose |
|---|---|---|
| [0000](SHIG-0000-design-constitution.md) | **Design Constitution** | Supreme authority — immutable principles, responsibilities, decision hierarchy, amendment. |
| [0001](SHIG-0001-foundation.md) | Foundation & Governance | The rule grammar: RFC-2119, permanent IDs, versioning, conformance. |
| [0002](SHIG-0002-brand-foundation.md) | Brand Foundation | Brand identity from a design perspective (`B-n`). |
| [0003](SHIG-0003-product-philosophy.md) | Product Philosophy | How Sambandh reasons as a product (`PP-n`). |
| [0004](SHIG-0004-design-principles.md) | Design Principles | The decision framework for every design choice (`DP-n`). |
| [0005](SHIG-0005-information-architecture.md) | Information Architecture | How information is organized ecosystem-wide (`IA-n`). |
| [0006](SHIG-0006-user-mental-models.md) | User Mental Models | Aligning the interface to human cognition (`MM-n`). |
| [0007](SHIG-0007-visual-language.md) | Visual Language | Visual principles & semantics, no values (`VL-n`). |
| 0008 | Design Vocabulary | Controlled semantic vocabulary (`DV-n`) — *regeneration pending*. |
| [0009](SHIG-0009-emotional-design-system.md) | Emotional Design System | Ethical emotional design, no manipulation (`ED-n`). |
| [0010](SHIG-0010-premium-experience-principles.md) | Premium Experience Principles | What "premium" means — restraint, not excess (`PX-n`). |
| [0011](SHIG-0011-accessibility-inclusive-design.md) | Accessibility & Inclusive Design | Accessibility as a core quality attribute (`AX-n`). |
| [0012](SHIG-0012-interaction-design-system.md) | Interaction Design System | Universal interaction principles (`IX-n`). |
| [0013](SHIG-0013-navigation-wayfinding.md) | Navigation & Wayfinding | Orientation, discoverability, wayfinding (`NAV-n`). |

## Implementation

The corpus governs the product. The app's live design system (`public/styles.css`, "SHIG DESIGN SYSTEM — v2 REDESIGN") implements the Constitution's visual mandate — **premium through restraint** (C‑14): a token layer, editorial typography, hairline elevation, an accessible focus model, and system-wide reduced-motion.

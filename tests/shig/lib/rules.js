// tests/shig/lib/rules.js — central registry of every EXECUTABLE SHIG rule.
// One entry per machine-checked rule. Drives (a) teaching errors (report.js) and
// (b) the governance matrix (governance.js maps each rule to concrete SHIG
// requirement IDs by scanning the cited docs for the `match` keywords, so the
// mapping is reproducible, not hand-asserted).
//
// `status`: AUTO_ENFORCED  = the rule fully mechanizes the requirement.
//           PARTIALLY_ENFORCED = a sound but partial slice (e.g. presence, not
//           semantic quality) — the rest stays human review.

const RULES = {
  // ---------------- Accessibility (SHIG-0011 / C-8 / SHIG-0019 / 0016 / 0017) ----------------
  'A11Y-IMG-ALT': {
    name: 'Every <img> carries an alt attribute',
    severity: 'error', doc: 'SHIG-0011-accessibility-inclusive-design.md',
    shig: 'SHIG-0011 · SHIG-0019 · C-8 (WCAG 1.1.1)',
    explain: 'An <img> with no alt is unnamed content for assistive tech. Decorative images use alt="" to be skipped; meaningful ones need descriptive text.',
    fix: 'Add alt="…" (meaningful) or alt="" (purely decorative) to the <img>.',
    docs: ['SHIG-0011-accessibility-inclusive-design.md', 'SHIG-0019-iconography-imagery-system.md'],
    match: ['alt', 'text alternative', 'accessible name'], status: 'PARTIALLY_ENFORCED',
  },
  'A11Y-CONTROL-NAME': {
    name: 'Interactive controls have an accessible name',
    severity: 'error', doc: 'SHIG-0011-accessibility-inclusive-design.md',
    shig: 'SHIG-0011 · C-8 (WCAG 4.1.2)',
    explain: 'A button or link with no text, aria-label, aria-labelledby, title, or named image is invisible to screen readers and voice control.',
    fix: 'Give the control visible text, or an aria-label, or an icon child with meaningful alt.',
    docs: ['SHIG-0011-accessibility-inclusive-design.md', 'SHIG-0012-interaction-design-system.md'],
    match: ['accessible name', 'label', 'name'], status: 'PARTIALLY_ENFORCED',
  },
  'A11Y-INPUT-LABEL': {
    name: 'Form fields are programmatically labelled',
    severity: 'error', doc: 'SHIG-0020-forms-feedback-state-system.md',
    shig: 'SHIG-0020 · SHIG-0011 · C-8 (WCAG 1.3.1 / 4.1.2)',
    explain: 'An input whose only cue is a placeholder loses its label on focus and is unnamed for assistive tech.',
    fix: 'Associate a <label for> (matching the input id), or add aria-label / aria-labelledby.',
    docs: ['SHIG-0020-forms-feedback-state-system.md', 'SHIG-0011-accessibility-inclusive-design.md'],
    match: ['label', 'labelled', 'placeholder'], status: 'PARTIALLY_ENFORCED',
  },
  'A11Y-HEADING-ORDER': {
    name: 'Heading levels do not skip',
    severity: 'error', doc: 'SHIG-0011-accessibility-inclusive-design.md',
    shig: 'SHIG-0011 · SHIG-0018 · C-8 (WCAG 1.3.1)',
    explain: 'Jumping from h1 to h3 breaks the document outline assistive tech relies on for navigation.',
    fix: 'Use sequential heading levels (h1→h2→h3); do not choose a level for its size.',
    docs: ['SHIG-0011-accessibility-inclusive-design.md', 'SHIG-0018-typography-reading-system.md'],
    match: ['heading', 'hierarchy', 'outline'], status: 'AUTO_ENFORCED',
  },
  'A11Y-ARIA-VALID': {
    name: 'Only valid ARIA attributes and roles are used',
    severity: 'error', doc: 'SHIG-0011-accessibility-inclusive-design.md',
    shig: 'SHIG-0011 · C-8 (WCAG 4.1.2)',
    explain: 'A misspelled aria-* attribute or an invalid role is silently ignored by assistive tech, so the intended semantics never reach the user.',
    fix: 'Use a WAI-ARIA 1.2 attribute/role, or remove the invalid one.',
    docs: ['SHIG-0011-accessibility-inclusive-design.md'],
    match: ['aria', 'role', 'assistive'], status: 'AUTO_ENFORCED',
  },
  'A11Y-ARIA-HIDDEN-FOCUS': {
    name: 'aria-hidden is not placed on a focusable element',
    severity: 'error', doc: 'SHIG-0011-accessibility-inclusive-design.md',
    shig: 'SHIG-0011 · C-8 (WCAG 4.1.2)',
    explain: 'aria-hidden="true" on a still-tabbable control creates a "phantom" focus stop with no accessible name.',
    fix: 'Remove aria-hidden, or make the element non-focusable (e.g. tabindex="-1" + disabled).',
    docs: ['SHIG-0011-accessibility-inclusive-design.md'],
    match: ['aria-hidden', 'focus'], status: 'AUTO_ENFORCED',
  },
  'A11Y-DUP-ID': {
    name: 'Element ids are unique within a document',
    severity: 'error', doc: 'SHIG-0011-accessibility-inclusive-design.md',
    shig: 'SHIG-0011 · C-8 (WCAG 4.1.1)',
    explain: 'Duplicate ids break label-for, aria-describedby/labelledby, and in-page anchors — associations resolve to the wrong element.',
    fix: 'Make every id unique within the page.',
    docs: ['SHIG-0011-accessibility-inclusive-design.md'],
    match: ['unique', 'identifier', 'duplicate'], status: 'AUTO_ENFORCED',
  },
  'A11Y-FOCUS-MODEL': {
    name: 'A visible focus model exists',
    severity: 'error', doc: 'SHIG-0011-accessibility-inclusive-design.md',
    shig: 'SHIG-0011 · SHIG-0012 · C-8 (WCAG 2.4.7)',
    explain: 'Keyboard users must always see where focus is.',
    fix: 'Keep the :focus-visible model and the shared --focus ring token in styles.css.',
    docs: ['SHIG-0011-accessibility-inclusive-design.md', 'SHIG-0012-interaction-design-system.md'],
    match: ['focus'], status: 'AUTO_ENFORCED',
  },
  'A11Y-TARGET-SIZE': {
    name: 'Interactive targets meet the minimum size',
    severity: 'error', doc: 'SHIG-0011-accessibility-inclusive-design.md',
    shig: 'SHIG-0011 · C-8 (WCAG 2.5.8)',
    explain: 'Small touch targets are unusable for motor-impaired users.',
    fix: 'Keep the ≥44px min-width/min-height rules for compact controls in styles.css.',
    docs: ['SHIG-0011-accessibility-inclusive-design.md'],
    match: ['target size', 'target', 'touch'], status: 'AUTO_ENFORCED',
  },
  'A11Y-REDUCED-MOTION': {
    name: 'prefers-reduced-motion is honored',
    severity: 'error', doc: 'SHIG-0016-motion-choreography-system.md',
    shig: 'SHIG-0016 · C-8 / C-10 (WCAG 2.3.3)',
    explain: 'Animation must be reducible for users who are motion-sensitive.',
    fix: 'Keep the @media (prefers-reduced-motion: reduce) block in styles.css and home.html.',
    docs: ['SHIG-0016-motion-choreography-system.md', 'SHIG-0011-accessibility-inclusive-design.md'],
    match: ['reduced-motion', 'reduced motion', 'vestibular', 'motion'], status: 'AUTO_ENFORCED',
  },
  'A11Y-CONTRAST-TOKEN': {
    name: 'The corrected low-contrast token does not regress',
    severity: 'error', doc: 'SHIG-0017-color-theming-system.md',
    shig: 'SHIG-0017 · C-8 (WCAG 1.4.3)',
    explain: '--ink-soft was darkened to clear 4.5:1 on the sand/white surfaces; regressing it reintroduces a contrast failure.',
    fix: 'Keep --ink-soft at the corrected value (#6E6D66), not #888780.',
    docs: ['SHIG-0017-color-theming-system.md', 'SHIG-0011-accessibility-inclusive-design.md'],
    match: ['contrast'], status: 'PARTIALLY_ENFORCED',
  },
  'A11Y-HTML-LANG': {
    name: 'Every document declares a language',
    severity: 'error', doc: 'SHIG-0011-accessibility-inclusive-design.md',
    shig: 'SHIG-0011 · C-9 (WCAG 3.1.1)',
    explain: 'Without <html lang>, screen readers cannot choose the right pronunciation/voice.',
    fix: 'Add a lang attribute to the <html> element.',
    docs: ['SHIG-0011-accessibility-inclusive-design.md', 'SHIG-0014-content-editorial-system.md'],
    match: ['lang', 'language'], status: 'AUTO_ENFORCED',
  },

  // ---------------- Content governance (SHIG-0008 / SHIG-0014 / C-2 / C-15) ----------------
  'CONTENT-DEPRECATED-TIER': {
    name: 'No deprecated plan names in member-facing surfaces',
    severity: 'error', doc: 'SHIG-0008-design-vocabulary.md',
    shig: 'SHIG-0008 · C-15',
    explain: 'One canonical term per concept: the plans are Basic/Plus/Signature. "Sambandh Pro/Max", "Go Pro/Max" are deprecated synonyms.',
    fix: 'Use Sambandh Basic / Plus / Signature in member-facing copy.',
    docs: ['SHIG-0008-design-vocabulary.md'],
    match: ['synonym', 'canonical term', 'deprecat'], status: 'AUTO_ENFORCED',
  },
  'CONTENT-BADGE-VOCAB': {
    name: 'Fact and reading badges stay structurally distinct',
    severity: 'error', doc: 'SHIG-0008-design-vocabulary.md',
    shig: 'SHIG-0008 · C-2',
    explain: 'A reading (inference) must never be presentable as a verified fact; the two labels differ by class, glyph, and word, and the fail-safe default is "reading".',
    fix: 'Render readings via SBBadge.badgeHtml("reading", …); never label an inference "Verified".',
    docs: ['SHIG-0008-design-vocabulary.md', 'SHIG-0019-iconography-imagery-system.md'],
    match: ['fact', 'reading', 'honest', 'verified'], status: 'AUTO_ENFORCED',
  },

  // ---------------- Engineering governance (C-13 / C-16 / SHIG-0013) ----------------
  'ENG-ASSET-REF': {
    name: 'Local asset references resolve to a real file',
    severity: 'error', doc: 'SHIG-0013-navigation-wayfinding.md',
    shig: 'SHIG-0013 · C-13 / C-16',
    explain: 'A <link>/<script>/<img> pointing at a missing local file ships a broken surface — dishonest state and a maintainability rot signal.',
    fix: 'Point the reference at a file that exists under public/, or remove it.',
    docs: ['SHIG-0013-navigation-wayfinding.md'],
    match: ['broken', 'dead', 'asset', 'reference'], status: 'AUTO_ENFORCED',
  },
  'ENG-DEAD-ANCHOR': {
    name: 'In-page anchors point at a real target',
    severity: 'error', doc: 'SHIG-0013-navigation-wayfinding.md',
    shig: 'SHIG-0013 (no dead ends) · C-13',
    explain: 'An href="#x" with no element id="x" is a dead end — the member clicks and nothing happens.',
    fix: 'Point the anchor at an existing id, or fix the target element id.',
    docs: ['SHIG-0013-navigation-wayfinding.md'],
    match: ['dead end', 'anchor', 'deep link', 'destination'], status: 'AUTO_ENFORCED',
  },

  // ---------------- Design system (SHIG-0015 / SHIG-0017 / C-14 / C-16) ----------------
  'DS-TOKENS-DEFINED': {
    name: 'The canonical design-token scales are defined',
    severity: 'error', doc: 'SHIG-0015-layout-spatial-system.md',
    shig: 'SHIG-0015 · SHIG-0017 · C-16',
    explain: 'Quality through systemic reuse (C-16): the spacing, radius, elevation, focus and semantic-color token scales must exist as the single source designers reference.',
    fix: 'Keep the --sp-*, --r-*, --e-*, --focus and semantic-color tokens defined in styles.css.',
    docs: ['SHIG-0015-layout-spatial-system.md', 'SHIG-0017-color-theming-system.md'],
    match: ['token', 'scale', 'systemic'], status: 'PARTIALLY_ENFORCED',
  },

  // ---------------- Localization (C-9 / SHIG-0011) ----------------
  'LOC-CURRENCY': {
    name: 'Prices carry the canonical currency indicator',
    severity: 'error', doc: 'SHIG-0014-content-editorial-system.md',
    shig: 'SHIG-0014 · C-2 (R-14)',
    explain: 'Money must be unambiguous: the canonical price is CHF and is always shown with its currency, never a bare number.',
    fix: 'Show amounts with their currency (CHF …), consistent with the backend canonical price.',
    docs: ['SHIG-0014-content-editorial-system.md'],
    match: ['currency', 'money', 'amount'], status: 'PARTIALLY_ENFORCED',
  },
};

module.exports = { RULES };

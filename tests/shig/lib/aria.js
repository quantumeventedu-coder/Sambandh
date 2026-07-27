// tests/shig/lib/aria.js — WAI-ARIA 1.2 reference data. Comprehensive on purpose:
// an "unknown aria-* attribute / invalid role" check is only sound if the allow-list
// is complete, otherwise a legitimate attribute becomes a false positive.

// All `aria-*` states and properties defined by WAI-ARIA 1.2.
const ARIA_ATTRIBUTES = new Set([
  'aria-activedescendant', 'aria-atomic', 'aria-autocomplete', 'aria-braillelabel',
  'aria-brailleroledescription', 'aria-busy', 'aria-checked', 'aria-colcount',
  'aria-colindex', 'aria-colindextext', 'aria-colspan', 'aria-controls', 'aria-current',
  'aria-describedby', 'aria-description', 'aria-details', 'aria-disabled', 'aria-dropeffect',
  'aria-errormessage', 'aria-expanded', 'aria-flowto', 'aria-grabbed', 'aria-haspopup',
  'aria-hidden', 'aria-invalid', 'aria-keyshortcuts', 'aria-label', 'aria-labelledby',
  'aria-level', 'aria-live', 'aria-modal', 'aria-multiline', 'aria-multiselectable',
  'aria-orientation', 'aria-owns', 'aria-placeholder', 'aria-posinset', 'aria-pressed',
  'aria-readonly', 'aria-relevant', 'aria-required', 'aria-roledescription', 'aria-rowcount',
  'aria-rowindex', 'aria-rowindextext', 'aria-rowspan', 'aria-selected', 'aria-setsize',
  'aria-sort', 'aria-valuemax', 'aria-valuemin', 'aria-valuenow', 'aria-valuetext',
]);

// All non-abstract roles in the WAI-ARIA 1.2 role taxonomy.
const ARIA_ROLES = new Set([
  'alert', 'alertdialog', 'application', 'article', 'banner', 'blockquote', 'button',
  'caption', 'cell', 'checkbox', 'code', 'columnheader', 'combobox', 'complementary',
  'contentinfo', 'definition', 'deletion', 'dialog', 'directory', 'document', 'emphasis',
  'feed', 'figure', 'form', 'generic', 'grid', 'gridcell', 'group', 'heading', 'img',
  'insertion', 'link', 'list', 'listbox', 'listitem', 'log', 'main', 'marquee', 'math',
  'menu', 'menubar', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'meter', 'navigation',
  'none', 'note', 'option', 'paragraph', 'presentation', 'progressbar', 'radio', 'radiogroup',
  'region', 'row', 'rowgroup', 'rowheader', 'scrollbar', 'search', 'searchbox', 'separator',
  'slider', 'spinbutton', 'status', 'strong', 'subscript', 'superscript', 'switch', 'tab',
  'table', 'tablist', 'tabpanel', 'term', 'textbox', 'time', 'timer', 'toolbar', 'tooltip',
  'tree', 'treegrid', 'treeitem',
]);

// Elements that are focusable / interactive by default (so aria-hidden="true" on them
// would hide a focusable node from assistive tech while leaving it tabbable — a WCAG 4.1.2 trap).
const INTERACTIVE_TAGS = new Set(['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'SUMMARY']);

module.exports = { ARIA_ATTRIBUTES, ARIA_ROLES, INTERACTIVE_TAGS };

// badge.js — the ONE source of truth for the two label types the product uses,
// so they can never be styled the same by accident (Batch 8 Part 3, honesty guard).
//
//   FACT    — something the system has actually CONFIRMED (real person, face-match,
//             ID). Green-check treatment. Carries the word "Verified".
//   READING — an INSIGHT derived from the chart, self-declared features or chat
//             behaviour (nature profile, temperament, compatibility). A visually
//             DIFFERENT treatment. NEVER the green check, NEVER the word "verified".
//
// A reading must always use the 'reading' variant. The default for an unknown kind
// is 'reading' (fail safe — you can never accidentally promote an insight to a fact).
// Loaded as a browser global (window.SBBadge) and requireable in tests.

(function (root) {
  var VARIANTS = {
    fact: { cls: 'badge-fact', mark: '✓', kind: 'fact', word: 'Verified' },        // ✓ confirmed
    reading: { cls: 'badge-reading', mark: '✦', kind: 'reading', word: 'Your reading' } // ✦ insight
  };

  function badgeMeta(kind) { return VARIANTS[kind] || VARIANTS.reading; }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  // Render a badge. `text` defaults to the variant's own word.
  function badgeHtml(kind, text) {
    var v = badgeMeta(kind);
    var label = text == null ? v.word : text;
    return '<span class="' + v.cls + '" data-badge="' + v.kind + '">' + v.mark + ' ' + escapeHtml(label) + '</span>';
  }

  var api = { VARIANTS: VARIANTS, badgeMeta: badgeMeta, badgeHtml: badgeHtml };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SBBadge = api;
})(typeof self !== 'undefined' ? self : this);

// tests/shig/lib/report.js — developer-experience layer (SHIG conformance Phase 9).
// A failed rule never emits a cryptic assertion; it teaches: rule id, human reason,
// where, how to fix, the governing SHIG document, and severity.

class ShigViolationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ShigViolationError';
  }
}

/**
 * Throw a teaching error if `violations` is non-empty; otherwise no-op (rule passes).
 * @param {string} ruleId
 * @param {{name:string,shig:string,explain:string,fix:string,doc:string,severity:string}} meta
 * @param {Array<{surface?:string,line?:number,detail?:string}>} violations
 */
function assertNoViolations(ruleId, meta, violations) {
  if (!violations || violations.length === 0) return;
  const CAP = 60;
  const lines = violations.slice(0, CAP).map((v) => {
    const loc = v.surface ? v.surface + (v.line ? `:${v.line}` : '') : '';
    return `    • ${loc}${loc && v.detail ? ' — ' : ''}${v.detail || ''}`;
  });
  const more = violations.length > CAP ? `\n    …and ${violations.length - CAP} more` : '';
  throw new ShigViolationError(
    [
      '',
      `╭─ SHIG VIOLATION — ${ruleId}  [${meta.severity}]`,
      `│  Rule:  ${meta.name}`,
      `│  SHIG:  ${meta.shig}`,
      `│  Why:   ${meta.explain}`,
      `│  Fix:   ${meta.fix}`,
      `│  Docs:  docs/shig/${meta.doc}`,
      `╰─ ${violations.length} violation(s):`,
      lines.join('\n') + more,
      '',
    ].join('\n'),
  );
}

module.exports = { ShigViolationError, assertNoViolations };

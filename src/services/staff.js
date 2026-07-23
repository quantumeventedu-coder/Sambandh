// @ts-check
// services/staff.js — the internal STAFF taxonomy: departments, roles, seniority
// levels, and the permission scopes each role gets by default. Single source of
// truth so the Employee model, the /api/developer routes, and the console panel
// can't drift. Staff are a SEPARATE identity from dating users — they never appear
// in Discover and never hold a dating profile.

/** High-level org units. */
const DEPARTMENTS = [
  'engineering', 'support', 'marketing', 'management', 'executive',
  'operations', 'design', 'data', 'product', 'finance', 'hr'
];

/** Seniority — intern through C-level. Used for display + (later) HRMS/payroll bands. */
const LEVELS = ['intern', 'junior', 'mid', 'senior', 'lead', 'manager', 'director', 'vp', 'c_level'];

/** Specific function/title within a department. Drives which console tab a person lands on. */
const ROLES = [
  // engineering
  'software', 'ai_ml', 'data_eng', 'data_science', 'devops', 'qa', 'prompt_tester', 'designer',
  // support / go-to-market / ops
  'customer_support', 'marketing', 'account_manager', 'operations', 'product_manager',
  // leadership
  'manager', 'director', 'executive'
];

/**
 * Fine-grained permissions. A route checks a scope, never a raw role, so access can
 * be tuned per person. 'roster:manage' and 'flags:write' are privileged.
 */
const SCOPES = [
  'ops:read',          // system health, deploy, metrics
  'db:read',           // aggregate DB stats (counts only, never rows/PII)
  'logs:read',         // recent audit + error log viewer
  'prompt:run',        // the LLM prompt playground
  'ai:read',           // model/LLM key usage status
  'flags:read', 'flags:write',
  'design:read',       // design tokens + previews
  'support:read', 'support:act',   // reports/escalations + scoped, audited user lookup
  'metrics:read',      // product/business metrics + cohort export (aggregate)
  'roster:manage',     // create/edit/deactivate staff (privileged)
  'hrms:read'          // Phase 2 — read HRMS records
];

/** Which console tab a role opens by default (maps role → panel section). */
const ROLE_TAB = {
  software: 'ops', ai_ml: 'ai', data_eng: 'data', data_science: 'metrics', devops: 'ops',
  qa: 'flags', prompt_tester: 'prompt', designer: 'design',
  customer_support: 'support', marketing: 'metrics', account_manager: 'support',
  operations: 'ops', product_manager: 'metrics', manager: 'roster', director: 'roster', executive: 'roster'
};

/**
 * Default scopes granted when a role is provisioned. The owner can add/remove per
 * person afterwards. Deliberately LEAST-privilege: no one gets roster:manage,
 * flags:write, or support:act by default — those are granted explicitly.
 * @param {string} role
 * @returns {string[]}
 */
function defaultScopesFor(role) {
  const base = ['ops:read'];
  /** @type {Record<string, string[]>} */
  const byRole = {
    software: ['ops:read', 'logs:read', 'flags:read', 'db:read'],
    ai_ml: ['ops:read', 'ai:read', 'prompt:run', 'logs:read'],
    prompt_tester: ['prompt:run', 'ai:read'],
    data_eng: ['ops:read', 'db:read', 'metrics:read'],
    data_science: ['metrics:read', 'db:read'],
    devops: ['ops:read', 'logs:read', 'flags:read'],
    qa: ['ops:read', 'flags:read', 'logs:read'],
    designer: ['design:read'],
    customer_support: ['support:read'],
    account_manager: ['support:read', 'metrics:read'],
    marketing: ['metrics:read'],
    product_manager: ['metrics:read', 'flags:read'],
    operations: ['ops:read', 'metrics:read'],
    manager: ['ops:read', 'metrics:read', 'flags:read', 'support:read'],
    director: ['ops:read', 'metrics:read', 'flags:read', 'support:read', 'roster:manage'],
    executive: ['ops:read', 'metrics:read', 'flags:read', 'roster:manage', 'hrms:read']
  };
  return Array.from(new Set([...(byRole[role] || base)]));
}

/** Human labels for the UI. */
const ROLE_LABEL = {
  software: 'Software Engineer', ai_ml: 'AI / ML Engineer', data_eng: 'Data Engineer',
  data_science: 'Data Scientist', devops: 'DevOps Engineer', qa: 'QA Engineer',
  prompt_tester: 'Prompt Tester', designer: 'Designer', customer_support: 'Customer Support',
  marketing: 'Marketing', account_manager: 'Account Manager', operations: 'Operations',
  product_manager: 'Product Manager', manager: 'Manager', director: 'Director', executive: 'Executive'
};

module.exports = { DEPARTMENTS, LEVELS, ROLES, SCOPES, ROLE_TAB, ROLE_LABEL, defaultScopesFor };

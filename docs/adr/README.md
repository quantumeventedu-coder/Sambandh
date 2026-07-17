# Architecture Decision Records

One file per **irreversible** decision. Context → Options → Decision → Consequences.

The point: when someone asks "why is this like this?" in a year, the answer is a
document, not an archaeology dig through git history. If a decision is cheap to
reverse, it does not need an ADR.

## Format

```
# ADR-NNN: <short title>
Status: Accepted | Superseded by ADR-NNN | Proposed
Date: YYYY-MM-DD

## Context      — what forced a decision; constraints that were real at the time
## Options      — what was actually considered, with the honest trade-offs
## Decision     — what we chose, and the deciding reason
## Consequences — what this costs us, including what it makes harder
```

Write the **Consequences** honestly. An ADR that lists only benefits is marketing,
and the next engineer will not trust it.

## Index

| ADR | Title | Status |
|---|---|---|
| [001](001-postgres-over-mongodb.md) | Postgres over MongoDB | Accepted |
| [002](002-in-house-model-over-hosted.md) | In-house model + deterministic engines over a hosted/custom foundation model | Accepted |
| [003](003-chf-canonical-currency.md) | CHF as canonical currency with live FX conversion | Accepted |

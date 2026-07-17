# ADR-004: Adopt TypeScript checking via `@ts-check` + JSDoc before renaming to `.ts`

**Status:** Accepted
**Date:** 2026-07-16

## Context

The hardening mandate (Phase 1.1) requires incremental TypeScript adoption,
money-first: `tsconfig.json` with `allowJs: true, strict: true, checkJs: false`,
then convert `routes-payment.js`, `routes-auth.js`, models, `pg-odm.js`, in that
order, with `tsc --noEmit` clean in CI and zero `any`.

`tsconfig.json` and the CI typecheck step landed in `8a794f3`. The next step —
renaming `src/routes-payment.js` to `.ts` — turns out to be blocked by how the app
is actually run:

| Fact | Consequence |
|---|---|
| `npm start` → `node src/server.js` | Node cannot `require` a `.ts` file |
| `"noEmit": true` | tsc type-checks but produces nothing runnable |
| `src/server.js` uses `path.join(__dirname, '..', 'public')` | emitting to `dist/` moves `__dirname` and breaks static serving of the SPA, admin panels and uploads |
| `api/index.js` does `require('../src/server')` | Vercel's entry point would need repointing |
| `Dockerfile` → `CMD ["node","src/server.js"]`, `render.yaml` → `startCommand: node src/server.js` | two more entry points to repoint |
| jest has no TS transform | tests could not load a converted route |

So a `.ts` rename is not a rename. It is a build-and-deploy change touching four
entry points — on a service that suffered a production outage the same day
(`EMAXCONNSESSION`, fixed in `8f1f844`).

## Options

1. **Rename to `.ts` + add a `tsc` build to `dist/`.** The conventional end state.
   Costs: fix `__dirname`-relative asset paths, repoint 4 entry points, add a build
   to CI/Docker/Render/Vercel, add a jest TS transform — all at once, all touching
   deploy. This is precisely the "big-bang" the mandate forbids.
2. **Rename to `.ts` + run via a loader (`tsx`/`ts-node`).** No build, but adds a
   runtime dependency to production, must be registered in both `server.js` and
   `api/index.js`, and costs startup time on every cold lambda.
3. **`// @ts-check` + JSDoc types, file by file.** Full `strict` checking of the
   same file, enforced by the same `tsc --noEmit` in CI, with **zero** runtime,
   build or deploy change. The file stays `.js` and Node keeps running it as-is.

## Decision

**Option 3 now; Option 1 later, as its own PR.**

Deciding reason: the *value* of Phase 1.1 is catching bugs in money and identity
code — not the file extension. `@ts-check` delivers exactly that today, under the
same strict compiler and the same CI gate, without touching the deploy path of a
fragile production service.

Evidence it is not cosmetic: enabling `@ts-check` on `routes-payment.js` surfaced
**31 real errors**, including `TS18047: 'razorpay' is possibly 'null'` at the
`razorpay.orders.create` call — the same fail-open class as the `DEV_PAYMENTS` bug.

The `.ts` rename + build step remains the intended end state and gets its own PR,
sequenced **after** the deploy is stable, so a build/asset-path regression cannot
be confused with a logic regression.

## Consequences

- Type annotations live in JSDoc comments, which is more verbose than TS syntax.
- `@ts-check` is opt-in **per file**: a file without the pragma is unchecked, so
  the migration must be tracked deliberately (the same is true of a `.ts`
  migration — an unconverted file is equally unchecked).
- `checkJs` stays `false` globally; turning it on repo-wide would produce thousands
  of unactionable errors, and a check that always fails gets switched off.
- CI enforcement is identical: `tsc --noEmit` fails the build on any error in a
  `@ts-check`ed file, so a checked file can never silently regress.
- Interfaces to untyped modules (models, `pg-odm`) still surface as `any` at the
  boundary until those are typed. `@typescript-eslint/no-explicit-any` bans
  *explicit* `any` in our own code; implicit boundary `any` shrinks as models are
  typed (Phase 1.1, later steps).
- When Option 1 lands, `@ts-check` pragmas and JSDoc types are removed file-by-file
  as each becomes real `.ts` — the JSDoc work is not thrown away, it is the same
  type information in a different syntax.

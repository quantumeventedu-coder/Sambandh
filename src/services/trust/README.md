# AAV Trust Engine — Phase 1

Anti-AI-abuse & document-authenticity pipeline that every ID upload passes through
**before** it can be trusted. Fail-secure by design: a document is only auto-verified
when the engine is *confident*; everything else is refused or sent to human review.

## Modules (this phase — real, tested, no mocks)

| File | AAV layer | What it does |
|------|-----------|--------------|
| `file-guard.js` | 11 / 12 | Magic-byte sniff vs. claimed type; rejects executables, polyglots, double/dangerous extensions, MIME lies, oversized files, and PDFs carrying JavaScript / auto-actions / embedded payloads. |
| `metadata-forensics.js` | 3 | Reads EXIF/XMP for AI-generator signatures (SD/MJ/DALL·E/Firefly/…), diffusion parameter blocks, heavy edit history, missing camera origin, metadata stripping; detects C2PA provenance. |
| `risk-engine.js` | 15 | Combines signals into a 0–1000 trust score → band (`auto` ≥900 / `secondary` ≥700 / `manual` ≥500 / else `reject`). |
| `providers.js` | 2 / 4 / 7 / 16 | Fail-secure adapter registry for detectors that need a model/vendor. |
| `index.js` | — | Orchestrator: runs the pipeline, returns `{ score, decision, hardFail, evidenceHash, signals }`. |

## Fail-secure invariants (enforced + unit-tested)

- **No evidence → reject.** An empty signal set scores 0.
- **Unknown blocks auto.** A detector with no vendor configured returns `unknown`, floored at elevated risk, so a document **cannot auto-approve** until a real detector is wired in. Adapters never fabricate a pass.
- **Hard-fail always rejects** (malware/polyglot/executable/PDF-JS), regardless of score.
- **No single clean signal auto-approves** — `auto` requires *all* contributing signals present and clean.
- **Client is never trusted** — declared MIME/filename are treated as untrusted; the byte sniff is the source of truth.
- **Thresholds & raw factors are server-side only** — never returned to the uploader (no reverse-engineering the detector).

## Wiring

`routes-verification.js` (`POST /verification/id`) calls `evaluateDocument(buffer, ctx)`:
`reject` → refuse (no reason leaked); not-`auto` → `in_review` (human review); `auto` → the OCR decision stands. Every evaluation writes an immutable `AuditLog` row (`aav-trust-engine` / `id_document_evaluated`) with the decision, score, and SHA-256 **evidence hash** — no raw PII. The DigiLocker path is fail-secure too: an unverified token goes to review, never a mock approval.

## Adding a real detector

```js
require('./services/trust').providers.register('ai-image', async ({ buf }) => {
  const r = await callVendor(buf);      // e.g. Hive / Sensity / Reality Defender
  return { risk: r.aiProbability * 100 }; // 0–100
});
```
Registering `ai-image` + `malware` (+ clean) is what lets a genuine document reach the `auto` band.

## Deferred to later phases (need trained models / paid vendors / legal access — not mocked here)

Generative-image classifier, deepfake & liveness (video), multi-engine OCR consensus,
government/professional **registry** validation, IP/VPN/TOR intelligence, ClamAV malware
scanning, behavioral-bot detection, Redis-backed distributed rate limiting. Each plugs in
behind `providers.register(...)` or its own layer module without changing the core.

# Source texts for the reading engine

This folder is where the primary sources belong. **They were not present in the
repo when the corpus (`src/data/corpus/`) was first built**, so the corpus is
encoded from the *well-documented classical framework* and cross-checked against
`src/services/astro-engine.js` (the tables that compute the app's live charts) —
not transcribed from these files. Provenance notes in each corpus file say so.

## Expected files (add them here)

| File | Use | Status |
|---|---|---|
| `The_Brihat_Jataka_of_Varaha_Mihira.pdf` | Interpretive framework (Batch 0 corpus, Batch 2 rules) — has an English text layer | ⬜ not in repo yet |
| `brihat_jataka_extracted.txt` | Pre-extracted text of the above | ⬜ not in repo yet |
| `Surya_Siddhanta_-_Prof__Ram_Chandra_Pandey.pdf` | Astronomy reference only (Batch 1 uses established ephemeris methods, **not** this scan) | ⬜ not in repo yet |

## When you add them

Drop the files here and the corpus can be **cross-referenced** against the actual
text: each corpus entry's `_provenance` can then point to a specific chapter/verse
rather than to the framework generally. The Surya Siddhanta scan is images-only —
do **not** attempt English OCR on it (it produces garbage); it stays a human
reference for the astronomy, which is computed with standard ephemeris math in
`astro-engine.js`.

## What is NOT sourced from these

The astronomy (planetary positions, ayanamsa, dashas) is standard ephemeris
computation, already implemented and tested. The corpus here is only the
*interpretive* layer (what a placement means), and nothing user-facing is emitted
from the corpus directly — Batch 4 owns all user language and strips every
technical term.

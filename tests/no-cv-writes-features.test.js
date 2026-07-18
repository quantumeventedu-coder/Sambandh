// tests/no-cv-writes-features.test.js — a structural guard, not a behaviour test.
//
// Samudrika `features` are SELF-DECLARED ONLY. They must never be derived from a
// photo, computer vision, body measurement, or skin tone. Computer vision in this
// app does exactly one thing: confirm the person is real and matches their photos,
// for the verification badge. It must NEVER write to a features object.
//
// This is a DPDP-Act sensitive-data line and a colourism-exposure line. Crossing
// it destroys the trust the platform is built on. This test greps the CV/face
// modules and FAILS if any of them so much as mentions `features` — a deliberately
// strict tripwire that forces a human conversation before that boundary moves.

const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src');

// Every source file that does computer vision / face / image work. Identified by
// name and by importing a vision library; if a new CV module is added it should be
// added here (and it still must not touch features).
function isCvFile(file, contents) {
  const base = path.basename(file).toLowerCase();
  if (/face|vision|nsfw|moderation|verify-engine/.test(base)) return true;
  return /face-?api|blazeface|@vladmandic|nsfwjs|faceDescriptor|face_descriptor/i.test(contents);
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  }).filter(f => f.endsWith('.js'));
}

describe('computer vision never writes Samudrika features', () => {
  const files = walk(SRC).map(f => ({ f, src: fs.readFileSync(f, 'utf8') }));
  const cvFiles = files.filter(({ f, src }) => isCvFile(f, src));

  test('there is at least one CV module to check (guard is actually looking at something)', () => {
    expect(cvFiles.length).toBeGreaterThan(0);
  });

  test.each(cvFiles.map(({ f }) => path.relative(SRC, f)))('CV module %s does not mention "features"', (rel) => {
    const src = fs.readFileSync(path.join(SRC, rel), 'utf8');
    // No read, no write, no key — a CV module has no business with the features object.
    const hit = src.match(/\bfeatures\b/);
    expect(hit).toBeNull();
  });

  // The Samudrika vocabulary is distinctive (forehead, gait, deepset, the source
  // name). If a CV module ever started deriving temperament from a face/body it
  // would reference these. No vision module may — the words belong only to the
  // self-declare form and the reading data.
  test.each(cvFiles.map(({ f }) => path.relative(SRC, f)))('CV module %s never references Samudrika feature vocabulary', (rel) => {
    const src = fs.readFileSync(path.join(SRC, rel), 'utf8');
    expect(src).not.toMatch(/\b(forehead|gait|deepset|samudrika|temperament)\b/i);
  });
});

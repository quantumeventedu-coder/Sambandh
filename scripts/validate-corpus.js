// scripts/validate-corpus.js — shape-validates the rule corpus (Batch 0).
//
// Loads every corpus file and asserts the shape is complete and every planet,
// house and sign is present. Runs in CI (and via a jest test) so a malformed or
// incomplete corpus fails the build rather than silently producing wrong readings.
//
// Exit 0 + summary on success; exit 1 + the list of problems on failure.

const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'src', 'data', 'corpus');
const PLANETS = ['sun', 'moon', 'mars', 'mercury', 'jupiter', 'saturn', 'venus', 'rahu', 'ketu'];
const SIGNS = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];

function load(name) {
  const p = path.join(DIR, name);
  if (!fs.existsSync(p)) throw new Error(`missing corpus file: ${name}`);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

// Returns an array of problem strings (empty === valid).
function validate() {
  const problems = [];
  const req = (cond, msg) => { if (!cond) problems.push(msg); };

  // planets.json
  try {
    const { planets, _provenance } = load('planets.json');
    req(_provenance, 'planets.json: missing _provenance note');
    for (const id of PLANETS) {
      const p = planets && planets[id];
      if (!p) { problems.push(`planets.json: missing planet "${id}"`); continue; }
      req(p.name, `planets.${id}: missing name`);
      req(p.nature, `planets.${id}: missing nature`);
      req(Array.isArray(p.governs) && p.governs.length, `planets.${id}: governs[] empty`);
      req(Array.isArray(p.friends), `planets.${id}: friends[] missing`);
      req(p.strong && 'exalted' in p.strong && Array.isArray(p.strong.own), `planets.${id}: strong{exalted,own[]} incomplete`);
      req(p.weak && 'debilitated' in p.weak, `planets.${id}: weak{debilitated} missing`);
    }
  } catch (e) { problems.push(`planets.json: ${e.message}`); }

  // houses.json
  try {
    const { houses, _provenance } = load('houses.json');
    req(_provenance, 'houses.json: missing _provenance note');
    for (let h = 1; h <= 12; h++) {
      const o = houses && houses[String(h)];
      if (!o) { problems.push(`houses.json: missing house ${h}`); continue; }
      req(o.name, `houses.${h}: missing name`);
      req(o.represents, `houses.${h}: missing represents`);
      req(Array.isArray(o.keywords) && o.keywords.length, `houses.${h}: keywords[] empty`);
    }
  } catch (e) { problems.push(`houses.json: ${e.message}`); }

  // signs.json
  try {
    const { signs, _provenance } = load('signs.json');
    req(_provenance, 'signs.json: missing _provenance note');
    for (const id of SIGNS) {
      const s = signs && signs[id];
      if (!s) { problems.push(`signs.json: missing sign "${id}"`); continue; }
      req(s.element, `signs.${id}: missing element`);
      req(s.quality, `signs.${id}: missing quality`);
      req(s.ruler, `signs.${id}: missing ruler`);
      req(s.temperament, `signs.${id}: missing temperament`);
    }
  } catch (e) { problems.push(`signs.json: ${e.message}`); }

  // yogas.json
  try {
    const { yogas, _provenance } = load('yogas.json');
    req(_provenance, 'yogas.json: missing _provenance note');
    req(Array.isArray(yogas) && yogas.length >= 8, 'yogas.json: expected an array of at least 8 yogas');
    (yogas || []).forEach((y, i) => {
      req(y.code, `yogas[${i}]: missing code`);
      req(y.name, `yogas[${i}]: missing name`);
      req(y.category, `yogas[${i}]: missing category`);
      req(y.condition, `yogas[${i}]: missing condition`);
      req(y.effect, `yogas[${i}]: missing effect`);
      req(Array.isArray(y.factors) && y.factors.length, `yogas[${i}]: factors[] empty`);
    });
  } catch (e) { problems.push(`yogas.json: ${e.message}`); }

  return problems;
}

// CLI entry.
if (require.main === module) {
  const problems = validate();
  if (problems.length) {
    console.error('[corpus] INVALID:\n' + problems.map(p => '  · ' + p).join('\n'));
    process.exit(1);
  }
  console.log(`[corpus] OK — 9 planets, 12 houses, 12 signs, yogas validated.`);
}

module.exports = { validate, PLANETS, SIGNS };

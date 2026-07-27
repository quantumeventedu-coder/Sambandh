// tests/shig/lib/surfaces.js — the single source of truth for "what ships and
// therefore must be scanned." SHIG-0001 §Scope: every user-visible surface
// participates in validation. If a page renders, it is enumerated here.
//
// Two surface kinds exist in this repo:
//   'html' — a static shipped document under public/ (home, index, admin, etc.)
//   'spa'  — the single-page app (public/app.js), whose HTML lives in template
//            literals rather than a static file; extracted via AST (see dom.js).

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..', '..');
const PUBLIC = path.join(REPO, 'public');

const repoPath = (...p) => path.join(REPO, ...p);
const read = (abs) => fs.readFileSync(abs, 'utf8');

/** Every static HTML document that ships from public/. */
function staticSurfaces() {
  return fs
    .readdirSync(PUBLIC)
    .filter((f) => f.endsWith('.html'))
    .sort()
    .map((f) => ({ id: f, rel: `public/${f}`, abs: path.join(PUBLIC, f), kind: 'html' }));
}

/** The SPA source (its HTML is in template literals; scanned via AST extraction). */
function spaSurface() {
  const abs = path.join(PUBLIC, 'app.js');
  return fs.existsSync(abs) ? { id: 'app.js', rel: 'public/app.js', abs, kind: 'spa' } : null;
}

module.exports = { REPO, PUBLIC, repoPath, read, staticSurfaces, spaSurface };

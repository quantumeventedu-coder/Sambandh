// tests/cv-wiring.test.js — structural guards on the browser CV wiring, so a future
// edit can't quietly break the ethical contract the pure/route tests enforce:
//   • geometry-map.js is actually loaded in the app shell.
//   • the geometric read is SEPARATE from verification (not auto-run on capture).
//   • the client sends only discretised `features` — never an image/pixels/colour.
//   • the client posts through the guarded endpoints, and treats the result as a reading.

const fs = require('fs');
const path = require('path');

const read = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');
const html = read('public', 'index.html');
const appjs = read('public', 'app.js');

// isolate the two CV browser functions
const geomFn = (appjs.match(/async function runGeometricReadFromVideo\(\)[\s\S]*?\n}/) || [''])[0];
const captureFn = (appjs.match(/async function captureFace\(\)[\s\S]*?\n}/) || [''])[0];

test('the pure geometry module is loaded in the app shell', () => {
  expect(html).toMatch(/<script src="\/geometry-map\.js/);
});

test('geometric read is NOT auto-run during face verification', () => {
  expect(captureFn).toBeTruthy();
  expect(captureFn).not.toMatch(/runGeometricRead|geometricRead|cv-consent|geometric-read/i);
});

test('the client sends only discretised features — never an image/pixels/colour', () => {
  expect(geomFn).toBeTruthy();
  expect(geomFn).toMatch(/geometric-read/);                 // posts to the guarded endpoint
  expect(geomFn).toMatch(/body:\s*\{\s*features\s*\}/);     // payload is exactly { features }
  // none of the image/colour channels leak into this path
  expect(geomFn).not.toMatch(/base64|toDataURL|getImageData|canvas|pixel|rgb|colou?r/i);
  expect(geomFn).toMatch(/confidentFeatures/);              // low-confidence readings dropped client-side
});

test('consent is explicit and separate (its own endpoint)', () => {
  expect(appjs).toMatch(/\/me\/cv-consent/);
  expect(appjs).toMatch(/enableGeometricRead/);
});

test('the geometry mapper only receives landmark points, not the frame', () => {
  // it maps det.landmarks.positions → {x,y} and feeds THOSE to SBGeometry
  expect(geomFn).toMatch(/landmarks\.positions/);
  expect(geomFn).toMatch(/SBGeometry\.geometryToFeatures/);
});

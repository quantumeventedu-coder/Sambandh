// tests/profession-decision.test.js — the profession-document decision (fully automated, no third party,
// document NEVER stored). Grants only when the bytes are authentic (Trust Engine not reject/hard-fail)
// AND the declared employer's name appears in the browser-OCR'd document text.

const { decideProfessionDoc } = require('../src/services/verify-engine');
const AUTHENTIC = { decision: 'secondary', hardFail: false };
const pass = (r, n) => r.checks.find(c => c.check === n)?.pass;

describe('decideProfessionDoc', () => {
  test('authentic document that names the employer → approved', () => {
    const r = decideProfessionDoc({ trust: AUTHENTIC, company: 'Infosys', ocrText: 'OFFER LETTER\nInfosys Limited is pleased to offer you the role of Engineer.' });
    expect(r.approved).toBe(true);
    expect(pass(r, 'authenticity')).toBe(true);
    expect(pass(r, 'names_employer')).toBe(true);
  });

  test('a distinctive word of a multi-word employer is enough (noisy OCR tolerated)', () => {
    const r = decideProfessionDoc({ trust: AUTHENTIC, company: 'Tata Consultancy Services', ocrText: 'This is to certify employment at ... Consultancy ... Mumbai' });
    expect(r.approved).toBe(true);
  });

  test('document that does NOT name the employer → rejected', () => {
    const r = decideProfessionDoc({ trust: AUTHENTIC, company: 'Infosys', ocrText: 'A generic letter mentioning nothing relevant.' });
    expect(r.approved).toBe(false);
    expect(pass(r, 'names_employer')).toBe(false);
    expect(r.reason).toMatch(/employer.?s name/i);
  });

  test('empty OCR text (unreadable / PDF) → rejected, not a silent pass', () => {
    expect(decideProfessionDoc({ trust: AUTHENTIC, company: 'Infosys', ocrText: '' }).approved).toBe(false);
  });

  test('an INAUTHENTIC document is rejected even if the name is present', () => {
    expect(decideProfessionDoc({ trust: { decision: 'reject' }, company: 'Infosys', ocrText: 'Infosys offer letter' }).approved).toBe(false);
    expect(decideProfessionDoc({ trust: { decision: 'secondary', hardFail: true }, company: 'Infosys', ocrText: 'Infosys offer letter' }).approved).toBe(false);
  });

  test('a common short word cannot false-match (needs a ≥4-char distinctive token or the full name)', () => {
    // company "IBM" (no ≥4-char token) against unrelated text → must not pass on noise
    const r = decideProfessionDoc({ trust: AUTHENTIC, company: 'IBM', ocrText: 'the quick brown fox jumped over the lazy dog' });
    expect(r.approved).toBe(false);
  });
});

// intelligence/web/pdf.js — basic, dependency-free PDF text extraction.
//
// Handles the common case: content streams (uncompressed or FlateDecode) with
// text drawn by Tj / TJ / ' / " operators in standard encodings. Scanned
// (image-only) PDFs, encrypted PDFs and exotic CID fonts are reported as
// unsupported rather than returning garbage.

const zlib = require('zlib');

function decodePdfString(s) {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c !== '\\') { out += c; continue; }
    const n = s[++i];
    if (n === 'n') out += '\n'; else if (n === 'r') out += '\r'; else if (n === 't') out += '\t';
    else if (n === 'b') out += '\b'; else if (n === 'f') out += '\f';
    else if (n === '(' || n === ')' || n === '\\') out += n;
    else if (/[0-7]/.test(n)) { let oct = n; while (oct.length < 3 && /[0-7]/.test(s[i + 1])) oct += s[++i]; out += String.fromCharCode(parseInt(oct, 8)); }
    else if (n === '\r' || n === '\n') { if (n === '\r' && s[i + 1] === '\n') i++; }
    else if (n != null) out += n;
  }
  return out;
}

function decodeHex(h) {
  const hex = h.replace(/\s+/g, '');
  const bytes = Buffer.from(hex.length % 2 ? hex + '0' : hex, 'hex');
  if (bytes[0] === 0xfe && bytes[1] === 0xff) { let s = ''; for (let i = 2; i + 1 < bytes.length; i += 2) s += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]); return s; }
  return bytes.toString('latin1');
}

// Pull text out of one decoded content stream.
function textFromContent(content) {
  const out = [];
  const blocks = content.match(/BT[\s\S]*?ET/g) || [];
  for (const b of blocks) {
    const re = /\((?:\\.|[^\\)])*\)\s*(?:Tj|'|")|\[((?:\((?:\\.|[^\\)])*\)|<[0-9a-fA-F\s]*>|[^\]])*)\]\s*TJ|<([0-9a-fA-F\s]+)>\s*Tj|(T\*|-?\d*\.?\d+\s+-?\d*\.?\d+\s+T[dD])/g;
    let m;
    while ((m = re.exec(b))) {
      const tok = m[0];
      if (m[4]) { out.push(/T\*|\s-?\d*\.?\d+\s+T[dD]$/.test(tok) && !/\s0\s+T[dD]$/.test(tok) ? '\n' : ' '); continue; }
      if (m[3] != null) { out.push(decodeHex(m[3])); continue; }
      if (m[1] != null) {
        const parts = m[1].match(/\((?:\\.|[^\\)])*\)|<[0-9a-fA-F\s]*>|-?\d+\.?\d*/g) || [];
        for (const p of parts) {
          if (p.startsWith('(')) out.push(decodePdfString(p.slice(1, -1)));
          else if (p.startsWith('<')) out.push(decodeHex(p.slice(1, -1)));
          else if (Number(p) < -200) out.push(' ');   // large kerning gap ≈ word space
        }
        continue;
      }
      const sm = tok.match(/^\(((?:\\.|[^\\)])*)\)/);
      if (sm) { if (/'|"$/.test(tok.trim())) out.push('\n'); out.push(decodePdfString(sm[1])); }
    }
    out.push('\n');
  }
  return out.join('');
}

function extractPdfText(buf) {
  const raw = Buffer.isBuffer(buf) ? buf : Buffer.from(buf || '');
  const head = raw.subarray(0, 1024).toString('latin1');
  if (!head.startsWith('%PDF')) return { ok: false, reason: 'not a PDF', text: '' };
  const latin = raw.toString('latin1');
  if (/\/Encrypt\s/.test(latin)) return { ok: false, reason: 'encrypted PDF', text: '' };
  const texts = [];
  const re = /<<([\s\S]*?)>>\s*stream\r?\n/g;
  let m;
  while ((m = re.exec(latin))) {
    const dict = m[1];
    const start = re.lastIndex;
    const end = latin.indexOf('endstream', start);
    if (end < 0) break;
    let data = raw.subarray(start, end);
    if (/\/Subtype\s*\/Image|\/Type\s*\/XObject/.test(dict) && !/\/Subtype\s*\/Form/.test(dict)) continue;
    if (/\/FlateDecode/.test(dict)) {
      try { data = zlib.inflateSync(data); } catch { try { data = zlib.inflateRawSync(data); } catch { continue; } }
    } else if (/\/Filter/.test(dict)) continue;   // unsupported filters (DCT, LZW…)
    const s = data.toString('latin1');
    if (/BT[\s\S]*?ET/.test(s)) texts.push(textFromContent(s));
    re.lastIndex = end + 9;
  }
  const text = texts.join('\n').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!text) return { ok: false, reason: 'no extractable text (possibly scanned)', text: '' };
  const printable = (text.match(/[\x20-\x7E -ɏऀ-ॿ\n]/g) || []).length / text.length;
  if (printable < 0.7) return { ok: false, reason: 'unsupported font encoding', text: '' };
  return { ok: true, text };
}

module.exports = { extractPdfText, decodePdfString };

// @ts-check
// services/trust/detectors/ip-intel.js — in-house IP risk signal (AAV capability
// 'ip-intel'). No third party: no geo lookup, no reputation API, no bundled block
// lists (which would be stale external data). It classifies the SOURCE address
// STRUCTURALLY — a verification upload should originate from a normal public client
// IP; a private / reserved / loopback / malformed source is anomalous for a real
// end-user and raises risk.
//
// Honest scope: this is a structural signal, not a reputation verdict. A normal
// public IP returns risk 0 ("no adverse structural signal"), NOT a claim that the IP
// is trustworthy. Only the absence of any IP is 'unknown' (fail-secure).

const clamp = (/** @type {number} */ n) => Math.max(0, Math.min(100, Math.round(n)));

/** Parse a dotted-quad into 4 octets, or null. @param {string} s */
function ipv4(s) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s);
  if (!m) return null;
  const o = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
  return o.every((x) => x >= 0 && x <= 255) ? o : null;
}

/** Classify an IPv4 octet tuple. @param {number[]} o */
function classifyV4(o) {
  const [a, b] = o;
  if (a === 0 || (a === 255 && o.every((x) => x === 255))) return 'invalid';
  if (a === 127) return 'loopback';
  if (a === 10) return 'private';
  if (a === 172 && b >= 16 && b <= 31) return 'private';
  if (a === 192 && b === 168) return 'private';
  if (a === 169 && b === 254) return 'link-local';
  if (a === 100 && b >= 64 && b <= 127) return 'cgnat';                 // carrier-grade NAT
  if (a === 192 && b === 0 && o[2] === 2) return 'documentation';
  if (a === 198 && (b === 18 || b === 19)) return 'benchmark';
  if ((a === 198 && b === 51 && o[2] === 100) || (a === 203 && b === 0 && o[2] === 113)) return 'documentation';
  if (a >= 224) return 'multicast-or-reserved';
  return 'public';
}

/** Classify an IPv6 string (coarse — enough for the structural signal). @param {string} s */
function classifyV6(s) {
  const x = s.toLowerCase();
  if (x === '::1') return 'loopback';
  if (x === '::' || x === '::0') return 'invalid';
  if (/^fe[89ab][0-9a-f]:/.test(x)) return 'link-local';
  if (/^f[cd][0-9a-f][0-9a-f]:/.test(x)) return 'private';              // fc00::/7 unique-local
  if (/^ff[0-9a-f][0-9a-f]:/.test(x)) return 'multicast-or-reserved';
  if (/^2001:db8:/.test(x)) return 'documentation';
  if (!/^[0-9a-f:]+$/.test(x) || x.indexOf(':') === -1) return 'invalid';
  return 'public';
}

/** Structural risk per class. */
const RISK = {
  public: 0, loopback: 55, private: 45, 'link-local': 55, cgnat: 20,
  documentation: 40, benchmark: 40, 'multicast-or-reserved': 60, invalid: 50
};

/**
 * @param {string|undefined|null} ip
 * @returns {{ risk:number, unknown?:boolean, reasons:string[] }}
 */
function assessIp(ip) {
  if (!ip || typeof ip !== 'string') return { risk: 0, unknown: true, reasons: ['no-ip'] };
  // Take the first hop if a forwarded chain was passed, and unwrap IPv4-mapped IPv6.
  let s = ip.split(',')[0].trim().replace(/^\[|\]$/g, '').replace(/^::ffff:/i, '');
  s = s.replace(/%.*$/, '');                                            // strip zone id
  const v4 = ipv4(s);
  const cls = v4 ? classifyV4(v4) : classifyV6(s);
  const risk = /** @type {Record<string,number>} */ (RISK)[cls] ?? 50;
  return { risk: clamp(risk), reasons: [cls === 'public' ? 'public-ip' : 'non-public-ip:' + cls] };
}

module.exports = { assessIp, classifyV4, classifyV6, ipv4 };

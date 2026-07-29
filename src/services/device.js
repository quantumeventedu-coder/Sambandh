// @ts-check
// services/device.js — coarse device / OS / browser from a User-Agent. No dependency; a
// best-effort classification for admin oversight ("iPhone users", capabilities), not exact.

/** @param {string|undefined} ua */
function parseUA(ua) {
  const s = String(ua || '');
  let type = 'Other', os = 'Other', browser = 'Other';
  if (/iPhone/i.test(s)) { type = 'iPhone'; os = 'iOS'; }
  else if (/iPad/i.test(s)) { type = 'iPad'; os = 'iPadOS'; }
  else if (/Android/i.test(s)) { type = 'Android'; os = 'Android'; }
  else if (/Windows/i.test(s)) { type = 'Windows PC'; os = 'Windows'; }
  else if (/Macintosh|Mac OS X/i.test(s)) { type = 'Mac'; os = 'macOS'; }
  else if (/CrOS/i.test(s)) { type = 'Chromebook'; os = 'ChromeOS'; }
  else if (/Linux/i.test(s)) { type = 'Linux'; os = 'Linux'; }
  if (/Edg\//i.test(s)) browser = 'Edge';
  else if (/OPR\/|Opera/i.test(s)) browser = 'Opera';
  else if (/Chrome\//i.test(s) && !/Chromium/i.test(s)) browser = 'Chrome';
  else if (/Firefox\//i.test(s)) browser = 'Firefox';
  else if (/Safari\//i.test(s) && !/Chrome/i.test(s)) browser = 'Safari';
  const mobile = /iPhone|iPad|Android|Mobile/i.test(s);
  const native = /Sambandh|Capacitor/i.test(s);   // the native app wrapper (if it identifies itself)
  return { type, os, browser, mobile, native };
}

/** A short label like "iPhone · Safari" for display. @param {any} d */
function deviceLabel(d) {
  if (!d || !d.type) return '';
  return d.native ? `${d.type} app` : `${d.type}${d.browser && d.browser !== 'Other' ? ' · ' + d.browser : ''}`;
}

module.exports = { parseUA, deviceLabel };

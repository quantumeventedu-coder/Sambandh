// routes-public.js — LinkedIn-style public profiles, SEO, and app deep links.
//
//   GET /u/:username            server-rendered public profile (opt-in only)
//   GET /sitemap.xml            homepage + profiles whose owners allowed indexing
//   GET /robots.txt             crawl policy (profiles allowed, app/api disallowed)
//   GET /.well-known/assetlinks.json         Android App Links
//   GET /.well-known/apple-app-site-association  iOS Universal Links
//   /api/me/username/*, /api/me/public-profile  member controls
//   GET /api/v1/public/profiles/:username      same data as JSON for the apps
//
// Privacy rules (a dating platform is not LinkedIn): public profiles are OFF by
// default; search-engine indexing is a second, separate opt-in; anonymous-mode
// members can never be public; only a minimal, member-chosen subset is shown —
// first name, headline, city (optional), intent and verification level. Never
// age, exact location, contact details, Lakshan details or photos unless the
// member turned photos on.

const express = require('express');
const User = require('./models/User');
const { requireAuth } = require('./routes-auth');

const BASE = () => (process.env.PUBLIC_BASE_URL || 'https://www.sambandh.online').replace(/\/+$/, '');
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;   // identical to login handles (routes-auth)
const RESERVED = new Set(['admin', 'administrator', 'api', 'app', 'apps', 'support', 'help', 'sambandh', 'sambandhsetu', 'setu', 'setuguide', 'www', 'mail', 'root', 'about', 'terms', 'privacy', 'security', 'login', 'signup', 'register', 'settings', 'official', 'moderator', 'superadmin', 'staff', 'team', 'null', 'undefined', 'grievance', 'legal']);

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function validateUsername(u) {
  const v = String(u || '').trim().toLowerCase();
  if (!USERNAME_RE.test(v)) return { ok: false, value: v, reason: 'Use 3–20 characters: lowercase letters, numbers or underscore.' };
  if (!/[a-z]/.test(v)) return { ok: false, value: v, reason: 'Include at least one letter.' };
  if (RESERVED.has(v)) return { ok: false, value: v, reason: 'That username is reserved.' };
  return { ok: true, value: v };
}

const INTENT_LABEL = { marriage: 'Marriage', dating: 'Dating', casual: 'Casual', friendship: 'Friendship', networking: 'Networking' };
const VER_LABEL = { photo_verified: 'Photo verified', id_verified: 'ID verified', profession_verified: 'Profession verified', fully_verified: 'Fully verified' };

async function findPublic(username) {
  const v = validateUsername(username);
  if (!v.ok) return null;
  const u = await User.findOne({ username: v.value }).select('username profile.firstName profile.city profile.photos intent verification.level publicProfile preferences.anonymousModeEnabled status createdAt onboarding.completedAt preview').lean();
  if (!u || !u.publicProfile || !u.publicProfile.enabled) return null;
  if (u.preview || (u.preferences && u.preferences.anonymousModeEnabled)) return null;
  if (u.status && (u.status.banned || u.status.suspended || u.status.deletedAt || u.status.active === false)) return null;
  return u;
}

function publicView(u) {
  const p = u.publicProfile || {};
  const photo = p.showPhoto ? ((u.profile.photos || []).find(x => x.isPrimary) || (u.profile.photos || [])[0] || {}).url || null : null;
  return {
    username: u.username, firstName: (u.profile && u.profile.firstName) || u.username,
    headline: p.headline || null, city: p.showCity !== false ? (u.profile && u.profile.city) || null : null,
    intent: (u.intent || []).map(i => INTENT_LABEL[i] || i),
    verification: VER_LABEL[(u.verification && u.verification.level)] || null,
    photo: photo && /^https?:\/\//.test(photo) ? photo : (photo && photo.startsWith('/') ? BASE() + photo : null),
    memberSince: u.createdAt ? new Date(u.createdAt).toISOString().slice(0, 7) : null,
    indexable: !!p.indexable, url: `${BASE()}/u/${u.username}`, appUrl: `${BASE()}/app#/u/${u.username}`
  };
}

const BRIDGE_SVG = '<svg viewBox="0 0 64 40" width="34" height="22" aria-hidden="true"><path d="M2 30 Q32 2 62 30" fill="none" stroke="currentColor" stroke-width="3"/><path d="M2 30h60M12 30v-8M22 30V15M32 30V12M42 30V15M52 30v-8" stroke="currentColor" stroke-width="2"/></svg>';

function page({ title, description, canonical, robots, body, jsonLd, image }) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}"/>
<meta name="robots" content="${robots}"/>
${canonical ? `<link rel="canonical" href="${esc(canonical)}"/>` : ''}
<meta property="og:site_name" content="Sambandh Setu"/><meta property="og:type" content="profile"/>
<meta property="og:title" content="${esc(title)}"/><meta property="og:description" content="${esc(description)}"/>
${canonical ? `<meta property="og:url" content="${esc(canonical)}"/>` : ''}
${image ? `<meta property="og:image" content="${esc(image)}"/>` : ''}
<meta name="twitter:card" content="summary"/>
<meta name="theme-color" content="#7A1F2B"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Manrope:wght@400;600;700;800&display=swap" rel="stylesheet"/>
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>` : ''}
<style>
:root{--sindoor:#7A1F2B;--deep:#5A1420;--haldi:#D9B26A;--sand:#F4EFE3;--line:rgba(90,20,32,.14);--ink:#241A16;--soft:#6E5A62}
*{box-sizing:border-box;margin:0;padding:0}body{font-family:Manrope,system-ui,sans-serif;background:var(--sand);color:var(--ink);line-height:1.55}
a{color:inherit}.top{display:flex;align-items:center;justify-content:space-between;max-width:880px;margin:0 auto;padding:22px 22px}
.brand{display:flex;align-items:center;gap:10px;font-family:'Cormorant Garamond',serif;font-weight:700;font-size:22px;color:var(--deep);text-decoration:none}
.join{font-weight:700;font-size:14px;color:var(--deep);text-decoration:none;border-bottom:1px solid var(--haldi);padding-bottom:2px}
main{max-width:880px;margin:0 auto;padding:10px 22px 60px}
.card{background:#fff;border:1px solid var(--line);border-radius:4px;padding:34px;display:grid;grid-template-columns:160px 1fr;gap:34px;align-items:start}
@media(max-width:640px){.card{grid-template-columns:1fr;padding:24px}}
.ph{width:160px;height:200px;border-radius:2px;background:linear-gradient(160deg,#9B4A57,#5A1420);display:flex;align-items:center;justify-content:center;color:#F5EAD6;font-family:'Cormorant Garamond',serif;font-size:64px;overflow:hidden}
.ph img{width:100%;height:100%;object-fit:cover}
.eyebrow{font-size:11px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:var(--sindoor)}
h1{font-family:'Cormorant Garamond',serif;font-size:44px;line-height:1.05;margin:6px 0 8px;color:var(--deep)}
.head{font-size:17px;color:var(--soft);margin-bottom:22px}
dl{display:grid;grid-template-columns:140px 1fr;border-top:1px solid var(--line)}
dt,dd{padding:11px 0;border-bottom:1px solid var(--line);font-size:14px}dt{font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:var(--soft);padding-top:13px}
.cta{display:inline-block;margin-top:26px;background:var(--sindoor);color:#fff;text-decoration:none;font-weight:700;padding:13px 22px;border-radius:2px}
.note{margin-top:28px;font-size:12.5px;color:var(--soft);max-width:620px}
footer{max-width:880px;margin:0 auto;padding:0 22px 40px;font-size:12px;color:var(--soft)}
</style></head><body>
<header class="top"><a class="brand" href="${BASE()}/">${BRIDGE_SVG}<span>Sambandh Setu</span></a><a class="join" href="${BASE()}/app">Join Sambandh Setu</a></header>
<main>${body}</main>
<footer>Profiles appear here only when members choose to make them public. Report a profile: grievance@sambandh.in</footer>
<script>if(window.Capacitor){var m=location.pathname.match(/^\\/u\\/([a-z0-9_]+)/);if(m)location.replace('/app#/u/'+m[1]);}</script>
</body></html>`;
}

const site = express.Router();

site.get('/u/:username', async (req, res, next) => {
  try {
    const u = await findPublic(req.params.username);
    res.setHeader('Cache-Control', 'public, max-age=300');
    if (!u) {
      res.status(404).setHeader('X-Robots-Tag', 'noindex, nofollow');
      return res.send(page({ title: 'Profile not available — Sambandh Setu', description: 'This profile is private or does not exist.', robots: 'noindex, nofollow',
        body: '<p class="eyebrow">Sambandh Setu</p><h1>This profile is not public</h1><p class="head">Members choose whether to have a public profile. This one is private, or does not exist.</p>' }));
    }
    const v = publicView(u);
    const robots = v.indexable ? 'index, follow, max-image-preview:large' : 'noindex, nofollow';
    res.setHeader('X-Robots-Tag', robots);
    const desc = [v.headline, v.city, v.intent.length ? 'Looking for ' + v.intent.join(', ').toLowerCase() : null].filter(Boolean).join(' · ') || `${v.firstName} is a member of Sambandh Setu.`;
    const rows = [
      v.city ? `<dt>City</dt><dd>${esc(v.city)}</dd>` : '',
      v.intent.length ? `<dt>Looking for</dt><dd>${esc(v.intent.join(', '))}</dd>` : '',
      `<dt>Verification</dt><dd>${esc(v.verification || 'Not yet verified')}</dd>`,
      v.memberSince ? `<dt>Member since</dt><dd>${esc(v.memberSince)}</dd>` : '',
      `<dt>Profile</dt><dd>@${esc(v.username)}</dd>`
    ].join('');
    const jsonLd = {
      '@context': 'https://schema.org', '@type': 'ProfilePage', url: v.url, name: `${v.firstName} on Sambandh Setu`,
      mainEntity: { '@type': 'Person', name: v.firstName, alternateName: '@' + v.username, description: v.headline || undefined, ...(v.city ? { homeLocation: { '@type': 'Place', name: v.city } } : {}), ...(v.photo ? { image: v.photo } : {}) }
    };
    res.send(page({
      title: `${v.firstName} (@${v.username}) — Sambandh Setu`, description: desc, canonical: v.url, robots, jsonLd, image: v.photo,
      body: `<article class="card"><div class="ph">${v.photo ? `<img src="${esc(v.photo)}" alt="${esc(v.firstName)}"/>` : esc(v.firstName.slice(0, 1).toUpperCase())}</div>
<div><p class="eyebrow">Member profile</p><h1>${esc(v.firstName)}</h1>${v.headline ? `<p class="head">${esc(v.headline)}</p>` : '<p class="head">Member of Sambandh Setu</p>'}
<dl>${rows}</dl>
<a class="cta" href="${esc(v.appUrl)}">Connect on Sambandh Setu</a>
<p class="note">Every Sambandh Setu member completes a live face check before they can meet anyone. To protect members, ages, contact details and private information are never shown on public profiles.</p></div></article>`
    }));
  } catch (e) { next(e); }
});

site.get('/sitemap.xml', async (req, res, next) => {
  try {
    const rows = await User.find({ 'publicProfile.enabled': true, 'publicProfile.indexable': true, username: { $exists: true } })
      .select('username publicProfile preferences.anonymousModeEnabled status preview').limit(45000).lean();
    const urls = [`<url><loc>${BASE()}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>`];
    for (const u of rows) {
      if (!u.username || u.preview || (u.preferences && u.preferences.anonymousModeEnabled)) continue;
      if (u.status && (u.status.banned || u.status.suspended || u.status.deletedAt || u.status.active === false)) continue;
      const lm = u.publicProfile.updatedAt ? `<lastmod>${new Date(u.publicProfile.updatedAt).toISOString().slice(0, 10)}</lastmod>` : '';
      urls.push(`<url><loc>${BASE()}/u/${esc(u.username)}</loc>${lm}<changefreq>monthly</changefreq><priority>0.5</priority></url>`);
    }
    res.type('application/xml').setHeader('Cache-Control', 'public, max-age=3600');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>`);
  } catch (e) { next(e); }
});

site.get('/robots.txt', (req, res) => {
  res.type('text/plain').setHeader('Cache-Control', 'public, max-age=3600');
  res.send([
    'User-agent: *', 'Allow: /', 'Allow: /u/',
    'Disallow: /app', 'Disallow: /api/', 'Disallow: /admin.html', 'Disallow: /superadmin.html', 'Disallow: /developer.html', 'Disallow: /partners.html',
    '', `Sitemap: ${BASE()}/sitemap.xml`, ''
  ].join('\n'));
});

site.get('/.well-known/assetlinks.json', (req, res) => {
  const pkg = process.env.ANDROID_PACKAGE || 'com.sambandh.app';
  const fps = String(process.env.ANDROID_CERT_SHA256 || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!fps.length) return res.status(404).json({ error: 'Android app links are not configured (set ANDROID_CERT_SHA256)' });
  res.json([{ relation: ['delegate_permission/common.handle_all_urls'], target: { namespace: 'android_app', package_name: pkg, sha256_cert_fingerprints: fps } }]);
});

site.get('/.well-known/apple-app-site-association', (req, res) => {
  const team = process.env.APPLE_TEAM_ID, bundle = process.env.IOS_BUNDLE_ID || 'com.sambandh.app';
  if (!team) return res.status(404).json({ error: 'iOS universal links are not configured (set APPLE_TEAM_ID)' });
  const appId = `${team}.${bundle}`;
  res.type('application/json').json({
    applinks: { apps: [], details: [{ appIDs: [appId], components: [{ '/': '/u/*', comment: 'public profiles' }, { '/': '/app*', comment: 'the app' }] }] },
    webcredentials: { apps: [appId] }
  });
});

// ---------------- member controls (/api/me/...) ----------------
const me = express.Router();

me.get('/username/check', requireAuth, async (req, res, next) => {
  try {
    const v = validateUsername(req.query.u);
    if (!v.ok) return res.json({ valid: false, available: false, reason: v.reason });
    const taken = await User.findOne({ username: v.value }).select('_id').lean();
    const mine = taken && String(taken._id) === String(req.userId);
    res.json({ valid: true, available: !taken || mine, username: v.value, reason: taken && !mine ? 'That username is taken.' : null });
  } catch (e) { next(e); }
});

me.put('/username', requireAuth, async (req, res, next) => {
  try {
    const v = validateUsername(req.body && req.body.username);
    if (!v.ok) return res.status(400).json({ error: v.reason });
    const taken = await User.findOne({ username: v.value }).select('_id').lean();
    if (taken && String(taken._id) !== String(req.userId)) return res.status(409).json({ error: 'That username is taken.' });
    try { await User.findByIdAndUpdate(req.userId, { $set: { username: v.value, 'publicProfile.updatedAt': new Date() } }); }
    catch (err) { if (err && (err.code === 11000 || /duplicate|unique/i.test(err.message))) return res.status(409).json({ error: 'That username is taken.' }); throw err; }
    res.json({ ok: true, username: v.value, url: `${BASE()}/u/${v.value}` });
  } catch (e) { next(e); }
});

me.get('/public-profile', requireAuth, async (req, res, next) => {
  try {
    const u = await User.findById(req.userId).select('username profile.firstName profile.city profile.photos intent verification.level publicProfile preferences.anonymousModeEnabled createdAt').lean();
    if (!u) return res.status(404).json({ error: 'Not found' });
    const p = u.publicProfile || {};
    res.json({
      username: u.username || null, enabled: !!p.enabled, indexable: !!p.indexable, showPhoto: !!p.showPhoto, showCity: p.showCity !== false, headline: p.headline || '',
      anonymousMode: !!(u.preferences && u.preferences.anonymousModeEnabled),
      url: u.username ? `${BASE()}/u/${u.username}` : null,
      preview: u.username ? publicView({ ...u, publicProfile: { ...p, enabled: true } }) : null
    });
  } catch (e) { next(e); }
});

me.patch('/public-profile', requireAuth, async (req, res, next) => {
  try {
    const b = req.body || {};
    const u = await User.findById(req.userId).select('username preferences.anonymousModeEnabled publicProfile').lean();
    if (!u) return res.status(404).json({ error: 'Not found' });
    const set = { 'publicProfile.updatedAt': new Date() };
    const willEnable = typeof b.enabled === 'boolean' ? b.enabled : !!(u.publicProfile && u.publicProfile.enabled);
    if (willEnable && !u.username) return res.status(409).json({ error: 'Choose a username first.' });
    if (willEnable && u.preferences && u.preferences.anonymousModeEnabled) return res.status(409).json({ error: 'Turn off anonymous mode to make a public profile.' });
    if (typeof b.enabled === 'boolean') set['publicProfile.enabled'] = b.enabled;
    if (typeof b.indexable === 'boolean') set['publicProfile.indexable'] = b.indexable && willEnable;
    if (!willEnable) set['publicProfile.indexable'] = false;
    if (typeof b.showPhoto === 'boolean') set['publicProfile.showPhoto'] = b.showPhoto;
    if (typeof b.showCity === 'boolean') set['publicProfile.showCity'] = b.showCity;
    if (typeof b.headline === 'string') {
      const h = b.headline.replace(/\s+/g, ' ').trim().slice(0, 120);
      if (/[\w.+-]+@[\w-]+\.[\w.]+|(\+?91)?\s?[6-9]\d{9}|https?:\/\//i.test(h)) return res.status(400).json({ error: 'Please keep contact details and links out of your headline.' });
      set['publicProfile.headline'] = h;
    }
    await User.findByIdAndUpdate(req.userId, { $set: set });
    const fresh = await User.findById(req.userId).select('username publicProfile').lean();
    res.json({ ok: true, ...((fresh && fresh.publicProfile) || {}), url: fresh.username ? `${BASE()}/u/${fresh.username}` : null });
  } catch (e) { next(e); }
});

// ---------------- app JSON (/api/v1/public/...) ----------------
const api = express.Router();
api.get('/profiles/:username', async (req, res, next) => {
  try {
    const u = await findPublic(req.params.username);
    if (!u) return res.status(404).json({ error: 'Profile not available' });
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json({ profile: publicView(u), userId: String(u._id) });
  } catch (e) { next(e); }
});

module.exports = { site, me, api, validateUsername, publicView, findPublic };

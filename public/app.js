/* Sambandh web app — all screens per the build reference.
   Talks to the Express API at /api and Socket.io for real-time chat. */

'use strict';

// ---------------- State ----------------
const S = {
  token: localStorage.getItem('sb_token') || null,
  user: null,           // full user doc from /api/auth/me
  socket: null,
  filters: { intent: 'all', minAge: 18, maxAge: 60, verification: 'any', karmaGrade: 'any', showAnonymous: true, maxKm: 'anywhere', onlineOnly: false },
  chatCache: {},        // chatId -> { other, messages }
  unreadNotifs: 0,
  onboardPhotos: []     // pending photo uploads during onboarding
};

const $ = sel => document.querySelector(sel);
const screen = $('#screen');

// ---------------- SVG icon set (stroke-based, inherits currentColor) ----------------
const ICONS = {
  heart: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
  message: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
  book: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  shieldCheck: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 11.5 11 13.5 15 9.5"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  send: '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  sparkle: '<path d="M12 3l1.9 5.4L19.5 10l-5.6 1.6L12 17l-1.9-5.4L4.5 10l5.6-1.6z"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  ghost: '<path d="M12 2a7 7 0 0 0-7 7v13l3-2.4 2 2.4 2-2.4 2 2.4 2-2.4 3 2.4V9a7 7 0 0 0-7-7z"/><circle cx="9.5" cy="10" r="0.6"/><circle cx="14.5" cy="10" r="0.6"/>',
  flame: '<path d="M12 2s5.5 5 5.5 10.5a5.5 5.5 0 0 1-11 0c0-2.2 1-4 2.3-5.8.2 1.8 1 2.8 2.2 3.3C10.3 7.5 11 4.5 12 2z"/>',
  rings: '<circle cx="9" cy="12" r="5.5"/><circle cx="15" cy="12" r="5.5"/>',
  sliders: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>',
  slash: '<circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>',
  eyeOff: '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  pause: '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
  card: '<rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>',
  camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
  zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  unlock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
  alert: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
  edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/>',
  briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  pin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  coffee: '<path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>'
};

function ic(name, cls = '') {
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}
const LANGS = ['hindi','english','bengali','marathi','telugu','tamil','gujarati','urdu','kannada','odia','malayalam','punjabi','assamese','maithili'];
const INTENTS = [
  { v: 'marriage',  icon: 'rings',  t: 'Marriage',      d: 'Looking for a life partner' },
  { v: 'dating',    icon: 'heart',  t: 'Dating',        d: 'See where it goes' },
  { v: 'casual',    icon: 'flame',  t: 'Casual / NSA',  d: 'No strings — just honest fun' },
  { v: 'friendship',icon: 'users',  t: 'Friendship',    d: 'New in town, building a circle' },
  { v: 'networking',icon: 'briefcase', t: 'Networking', d: 'Professional connections & collaboration' }
];

// ---------------- Helpers ----------------
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (S.token) headers.Authorization = 'Bearer ' + S.token;
  const res = await fetch('/api' + path, { ...opts, headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
  let data = {};
  try { data = await res.json(); } catch { /* empty */ }
  if (res.status === 401 && S.token) { logout(); throw new Error('Session expired — log in again'); }
  if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Something went wrong on our end. Give it a moment and try again.');
  return data;
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}

function openModal(html) { $('#modal').innerHTML = html; $('#modal-wrap').classList.add('open'); }
function closeModal() { $('#modal-wrap').classList.remove('open'); }

// In-app, promise-based replacement for the browser's native prompt(). The native
// one renders a Chrome dialog headed "www.sambandh.online says" — off-brand and
// unstyled. This uses our own modal and resolves to the trimmed value, or null if
// cancelled. Await it exactly like prompt().
function askInput({ title, hint = '', label = '', placeholder = '', multiline = false, okText = 'OK', minLength = 0 }) {
  return new Promise(resolve => {
    let settled = false;
    const finish = v => { if (settled) return; settled = true; closeModal(); resolve(v); };
    openModal(`
      <h2 style="margin-top:0">${esc(title)}</h2>
      ${hint ? `<p class="sub">${esc(hint)}</p>` : ''}
      <div class="field">
        ${label ? `<label>${esc(label)}</label>` : ''}
        ${multiline
    ? `<textarea id="ask-in" rows="4" placeholder="${esc(placeholder)}"></textarea>`
    : `<input id="ask-in" type="text" placeholder="${esc(placeholder)}" autocomplete="off"/>`}
      </div>
      <p id="ask-err" class="hint" style="display:none;color:var(--sindoor)"></p>
      <div class="row" style="gap:8px">
        <button class="btn secondary" id="ask-cancel" style="width:auto">Cancel</button>
        <button class="btn" id="ask-ok">${esc(okText)}</button>
      </div>`);
    const input = $('#ask-in');
    $('#ask-cancel').onclick = () => finish(null);
    $('#ask-ok').onclick = () => {
      const v = (input.value || '').trim();
      if (minLength && v.length < minLength) {
        const err = $('#ask-err');
        err.textContent = `Please add a little more — at least ${minLength} characters.`;
        err.style.display = 'block';
        return;
      }
      finish(v || null);
    };
    if (!multiline) input.onkeydown = e => { if (e.key === 'Enter') $('#ask-ok').click(); };
    setTimeout(() => input && input.focus(), 50);
  });
}

function timeAgo(d) {
  const s = (Date.now() - new Date(d)) / 1000;
  if (s < 60) return 'now';
  if (s < 3600) return Math.floor(s / 60) + 'm';
  if (s < 86400) return Math.floor(s / 3600) + 'h';
  return Math.floor(s / 86400) + 'd';
}

function gradeClass(score) { return score >= 80 ? 'good' : score >= 60 ? 'warn' : 'bad'; }

function nav(hash) { location.hash = hash; }

function logout() {
  localStorage.removeItem('sb_token');
  S.token = null; S.user = null;
  if (S.socket) { S.socket.disconnect(); S.socket = null; }
  nav('#/welcome');
}

// Resize + re-encode photos on a canvas — this also strips EXIF/GPS metadata
function fileToResizedBase64(file, maxW = 1280) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.85).split(',')[1]);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

// When a profile photo fails to load (missing file, storage not configured,
// etc.), replace the broken <img> with the person's initial instead of the
// browser's broken-image icon. data-i carries the letter.
function imgFail(img) {
  const letter = (img.getAttribute('data-i') || '?').toUpperCase();
  const span = document.createElement('span');
  span.className = 'ini-fallback';
  span.textContent = letter;
  img.replaceWith(span);
}
window.imgFail = imgFail;

// Read any file as base64 (no canvas) — used for PDFs and non-image documents.
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = () => reject(new Error('Could not read that file — try another.'));
    r.readAsDataURL(file);
  });
}

// Resize images (smaller upload); read PDFs / other documents as-is.
function fileToUploadBase64(file) {
  return (file.type && file.type.startsWith('image/')) ? fileToResizedBase64(file) : fileToBase64(file);
}

function connectSocket() {
  if (S.socket || !S.token || typeof io === 'undefined') return;
  S.socket = io({ auth: { token: S.token } });
  S.socket.on('new_message', payload => {
    const cur = location.hash;
    if (cur === '#/chat/' + payload.chatId) {
      appendMessage(payload.message);
    } else if (payload.from !== S.user?._id) {
      toast('New message');
      if (cur === '#/chats') renderChats();
    }
  });
  S.socket.on('typing', ({ chatId }) => {
    if (location.hash === '#/chat/' + chatId) {
      const t = $('#typing-line');
      if (t) { t.textContent = 'typing…'; clearTimeout(t._t); t._t = setTimeout(() => t.textContent = '', 2200); }
    }
  });
  S.socket.on('karma_update', ({ notification }) => toast(notification || 'Your Lakshan Book was updated'));
  S.socket.on('new_match', ({ chatId }) => toast('New match! Check your chats.'));
  S.socket.on('reveal_request', () => toast('Someone wants to reveal identities'));
  S.socket.on('reveal_accepted', ({ chatId }) => {
    toast('Identities revealed');
    if (location.hash === '#/chat/' + chatId) renderChat(chatId);
  });
}

// ---------------- Router ----------------
const TAB_ROUTES = ['discover', 'community', 'astro', 'chats', 'karma', 'settings', 'notifications'];

window.addEventListener('hashchange', route);

async function route() {
  const hash = location.hash || '#/';
  const parts = hash.slice(2).split('/');
  const page = parts[0] || '';

  if (!S.token && !['welcome', 'login', 'features'].includes(page)) return nav('#/welcome');

  if (S.token && !S.user && !['welcome', 'login', 'features'].includes(page)) {
    // Stale/dead session (e.g. dev DB reset) must never blank the screen —
    // fall back to a clean logged-out welcome page.
    try { S.user = (await api('/auth/me')).user; } catch { return logout(); }
    connectSocket();
  }

  // Route unfinished accounts into onboarding
  if (S.user && page !== 'onboarding' && !['welcome', 'login', 'features'].includes(page)) {
    if (onboardingStep() !== 'done') return nav('#/onboarding');
  }

  const showTabs = TAB_ROUTES.includes(page) || page.startsWith('profile');
  $('#tabbar').style.display = showTabs ? 'flex' : 'none';
  screen.classList.toggle('no-tabs', !showTabs);
  document.body.classList.toggle('with-tabs', showTabs); // desktop sidebar layout
  document.querySelectorAll('#tabbar button').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === page));

  switch (page) {
    case 'welcome': return renderWelcome();
    case 'features': return renderFeatures();
    case 'login': return renderLogin();
    case 'onboarding': return renderOnboarding();
    case 'discover': return renderDiscover();
    case 'profile': return renderProfile(parts[1]);
    case 'chats': return renderChats();
    case 'chat': return renderChat(parts[1]);
    case 'karma': return renderKarma();
    case 'community': return renderCommunity();
    case 'room': return renderRoom(parts[1]);
    case 'astro': return renderAstro();
    case 'compat': return renderCompat(parts[1]);
    case 'settings': return renderSettings();
    case 'notifications': return renderNotifications();
    default: return nav(S.token ? '#/discover' : '#/welcome');
  }
}

// ---------------- Welcome + Login ----------------
function renderWelcome() {
  screen.innerHTML = `
  <div class="welcome">
    <div class="wordmark">sambandh</div>
    <div class="tagline">connections, made meaningful.</div>
    <div class="points">
      ${[['shieldCheck', 'Every member face-verified — a real, unique person'],
         ['book', 'The Lakshan Book — honesty, tracked by AI'],
         ['target', 'Say what you want: marriage, dating, casual, friendship'],
         ['ghost', 'Anonymous-first chat with mutual reveal'],
         ['star', 'Real Vedic astrology + engagement compatibility']]
        .map(([i, t]) => `<div class="ic-row"><span style="color:var(--haldi);display:inline-flex">${ic(i)}</span><span style="color:rgba(255,255,255,0.85)">${t}</span></div>`).join('')}
    </div>
    <button class="btn" style="background:var(--haldi);color:var(--sindoor-deep)" onclick="nav('#/login')">Get started</button>
    <button class="btn" style="background:transparent;color:rgba(255,255,255,0.9);border:1px solid rgba(255,255,255,0.35);margin-top:10px" onclick="nav('#/features')">See how it works</button>
    <p style="font-size:11px;opacity:0.5;margin-top:18px">18+ only · By continuing you agree to our Terms.<br>A quick face check verifies you before chatting.</p>
  </div>`;
}

// ---------------- Features / How it works (public homepage) ----------------
function renderFeatures() {
  const section = (icon, title, body) => `
    <div class="card mt">
      <div class="t ic-row" style="font-weight:700;font-size:16px">
        <span style="color:var(--sindoor);display:inline-flex">${ic(icon)}</span>${title}
      </div>
      <div style="margin-top:8px;font-size:14px;line-height:1.55;color:var(--ink,#333)">${body}</div>
    </div>`;

  screen.innerHTML = `
  <div class="section-pad features-wrap">
    <div class="wordmark center" style="font-size:34px;color:var(--sindoor-deep)">sambandh</div>
    <p class="sub center" style="font-style:italic">how it actually works</p>

    ${section('shieldCheck', 'Everyone is verified',
      `A live face check — our own tech, right in your browser — verifies every member is a real, unique
       person, and becomes their first photo. Add a government ID or a registry-checked profession
       (doctors, lawyers, CAs, architects) for extra trust badges. We never store Aadhaar numbers.`)}

    ${section('card', 'Nothing is free',
      `Membership is monthly — <b>CHF 1 men · CHF 5 women · CHF 3 non-binary</b> — and that's what
       keeps bots out. First payment refundable for 24 hours. Upgrades: <b>Pro, CHF 6/month</b> for
       unlimited messaging; <b>Max, CHF 15/month</b> for the rest — who liked you, advanced filters, priority.`)}

    ${section('book', 'The Lakshan Book',
      `Our AI compares what people say with what they do here. "You're the only one" while running four
       other chats — flagged. "I'm new here" on a 90-day-old account — flagged. Scores run 0–100.
       The first slip is a private warning; repeat patterns show on the profile. Clean behaviour earns
       points back, +1 per 30 days.`)}

    ${section('eye', 'See the evidence',
      `Pay <b>CHF 0.50–1</b> to read the anonymized statements behind a flag. The person knows someone
       looked — never who. Three reveals a day, no more. Fraud alerts cost nothing, ever.`)}

    ${section('target', 'Say what you want',
      `Pick up to two intents — marriage, dating, casual, friendship. Your feed only shows people who
       want the same thing.`)}

    ${section('ghost', 'Anonymous-first chat',
      `Start with your name and photos hidden. Nothing is revealed until <b>both</b> of you agree.
       Block anyone and you disappear from each other completely. Pro removes the daily limits.`)}

    ${section('sliders', 'A ranking we publish',
      `Trust 30% · karma 25% · intent 20% · distance 15% · astrology 10%. That's the whole formula.
       Profiles also show activity honestly — how many chats someone is running right now.`)}

    ${section('star', 'Compatibility, two ways',
      `Vedic guna milan out of 36 if you add birth details, plus a score based on how your
       communication styles actually fit.`)}

    ${section('flag', 'Moderation with teeth',
      `Reports get handled within 24 hours. The AI files reports on harassment it detects even if nobody
       complains. Five reports in a week escalate automatically. Penalties: warning, suspension, ban.`)}

    ${section('lock', 'Your data, your rules',
      `Export everything as JSON whenever you like. Pause without deleting. Delete, and everything is
       gone within 30 days — your phone number included. ID documents erase themselves after 30 days.`)}

    <div class="card mt" style="text-align:center">
      <div style="font-weight:700;font-size:16px">Membership at a glance</div>
      <div class="kv" style="margin-top:10px"><span>Base · men</span><b>CHF 1 / month</b></div>
      <div class="kv"><span>Base · women</span><b>CHF 5 / month</b></div>
      <div class="kv"><span>Base · non-binary</span><b>CHF 3 / month</b></div>
      <div class="kv"><span>Sambandh Pro</span><b>CHF 6 / month</b></div>
      <div class="kv"><span>Sambandh Max</span><b>CHF 15 / month</b></div>
      <div class="kv"><span>Lakshan evidence reveal</span><b>CHF 0.50–1</b></div>
      <div class="kv"><span>Fraud alerts</span><b>Free, always</b></div>
      <p class="hint" style="margin-top:8px">Your base price is set by your verified profile — first payment refundable within 24 hours.</p>
    </div>

    <button class="btn mt" onclick="nav('${S.token ? '#/discover' : '#/login'}')">${S.token ? 'Back to the app' : 'Get started'}</button>
    <button class="btn small mt" style="background:white;color:var(--sindoor-deep);border:1px solid var(--sand-mid)" onclick="history.length > 1 ? history.back() : nav('#/welcome')">Back</button>
    <p class="hint center" style="margin-top:14px">18+ only · Everything on this page is enforced in the product.</p>
    <p class="hint center" style="opacity:.6;margin-top:6px">A product of AIHuA — Abhityuthanam Institute of Human Advancement.</p>
  </div>`;
  window.scrollTo(0, 0);
}

function renderLogin() {
  const tab = S._authTab || 'signin';   // signin | signup
  const seg = (t, label) => `<button onclick="S._authTab='${t}';renderLogin()" style="flex:1;padding:11px;border:0;border-radius:10px;font-weight:700;font-size:14px;cursor:pointer;${tab === t ? 'background:var(--sindoor);color:#fff;box-shadow:0 1px 4px rgba(0,0,0,.15)' : 'background:transparent;color:inherit'}">${label}</button>`;

  let card;
  if (tab === 'signup') {
    card = `
      <div class="field"><label>Email</label><input id="rg-email" type="email" inputmode="email" autocomplete="email" placeholder="you@example.com"/></div>
      <div class="field"><label>Password</label><input id="rg-pw" type="password" autocomplete="new-password" placeholder="at least 8 characters"/></div>
      <button class="btn mt" onclick="passwordRegister()">Create account</button>`;
  } else {
    card = `
      <div class="field"><label>Email</label><input id="li-id" type="email" inputmode="email" autocomplete="username" placeholder="you@example.com"/></div>
      <div class="field"><label>Password</label><input id="li-pw" type="password" autocomplete="current-password" placeholder="••••••••"/></div>
      <button class="btn mt" onclick="passwordLogin()">Sign in</button>
      <div id="otp-area"></div>`;
  }

  const heading = tab === 'signup' ? 'Create your account' : 'Welcome back';
  const subline = tab === 'signup' ? 'Join a verified, honesty-first community.' : 'Sign in to continue.';
  screen.innerHTML = `
  <div class="section-pad" style="padding-top:52px;max-width:420px;margin:0 auto">
    <div class="wordmark center" style="font-size:34px">sambandh</div>
    <p class="sub center" style="font-style:italic">connections, made meaningful.</p>
    <div class="row" style="gap:5px;background:rgba(0,0,0,.05);padding:5px;border-radius:12px;margin-top:20px">
      ${seg('signin', 'Sign in')}${seg('signup', 'Sign up')}
    </div>
    <div class="card mt">
      <div class="center" style="font-weight:700;font-size:16px">${heading}</div>
      <p class="hint center" style="margin-bottom:12px">${subline}</p>
      ${card}
    </div>
    <div class="row" style="align-items:center;gap:10px;margin:14px 0"><div style="flex:1;height:1px;background:var(--sand-mid)"></div><span class="hint">or</span><div style="flex:1;height:1px;background:var(--sand-mid)"></div></div>
    <div id="google-btn" style="display:flex;justify-content:center;min-height:0"></div>
    ${tab === 'signin' ? `<button class="btn secondary ic-row" style="justify-content:center;margin-top:10px" onclick="passkeyLogin()">${ic('lock')} Sign in with a passkey</button>` : ''}
    <p class="hint center mt">We never show your email to other users.</p>
  </div>`;
  initGoogleButton(tab);
}

async function passwordRegister() {
  const email = ($('#rg-email').value || '').trim().toLowerCase();
  const password = $('#rg-pw').value || '';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return toast('Enter a valid email address.');
  if (password.length < 8) return toast('Password must be at least 8 characters.');
  try {
    const r = await api('/auth/register', { method: 'POST', body: { email, password } });
    S.token = r.token; localStorage.setItem('sb_token', r.token);
    S.user = (await api('/auth/me')).user;
    connectSocket(); captureLocation();
    nav(onboardingStep() === 'done' ? '#/discover' : '#/onboarding');
  } catch (e) { toast(e.message); }
}

async function passwordLogin(totp) {
  const identifier = ($('#li-id') ? $('#li-id').value : S._pwId || '').trim();
  const password = $('#li-pw') ? $('#li-pw').value : S._pwPass;
  S._pwId = identifier; S._pwPass = password;
  if (!identifier || !password) return toast('Enter your username/email and password.');
  try {
    const r = await api('/auth/login', { method: 'POST', body: { identifier, password, ...(totp ? { totp } : {}) } });
    if (r.twoFactorRequired) {
      $('#otp-area').innerHTML = `<div class="field mt"><label>Authenticator code (2FA)</label><input id="li-totp" class="otp-boxes" maxlength="6" inputmode="numeric" placeholder="••••••"/></div>
        <button class="btn forest" onclick='passwordLogin(document.getElementById("li-totp").value.trim())'>Verify</button>`;
      $('#li-totp')?.focus(); return;
    }
    S.token = r.token; localStorage.setItem('sb_token', r.token); S._pwPass = null;
    S.user = (await api('/auth/me')).user;
    connectSocket();
    nav(onboardingStep() === 'done' ? '#/discover' : '#/onboarding');
  } catch (e) { toast(e.message); }
}

// ---- Google Sign-In (loads Google Identity Services if a client id is configured) ----
async function initGoogleButton(tab) {
  try {
    const cfg = await api('/auth/config');
    if (!cfg.googleClientId) { const el = $('#google-btn'); if (el) el.innerHTML = ''; return; }
    await loadScript('https://accounts.google.com/gsi/client');
    google.accounts.id.initialize({ client_id: cfg.googleClientId, callback: onGoogleCredential });
    const el = $('#google-btn');
    if (el) google.accounts.id.renderButton(el, { theme: 'outline', size: 'large', shape: 'pill', text: tab === 'signup' ? 'signup_with' : 'signin_with' });
  } catch { /* Google is optional */ }
}
async function onGoogleCredential(resp) {
  try {
    const r = await api('/auth/google', { method: 'POST', body: { credential: resp.credential } });
    if (r.twoFactorRequired) return toast('This account has 2FA — sign in with your password or email code.');
    S.token = r.token; localStorage.setItem('sb_token', r.token);
    S.user = (await api('/auth/me')).user;
    connectSocket();
    nav(onboardingStep() === 'done' ? '#/discover' : '#/onboarding');
  } catch (e) { toast(e.message); }
}

// Web push: register the service worker and subscribe (best-effort, non-blocking)
async function registerWebPush() {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    const reg = await navigator.serviceWorker.register('/sw.js');
    if (Notification.permission === 'denied') return;
    if (Notification.permission !== 'granted') {
      const p = await Notification.requestPermission();
      if (p !== 'granted') return;
    }
    const { key } = await api('/notifications/vapid-key');
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key)
    });
    await api('/notifications/subscribe', { method: 'POST', body: { subscription: sub } });
  } catch { /* push is a nice-to-have; never block sign-in */ }
}
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

// Precise device location — powers accurate distance in discover. Uses the
// browser Geolocation API only (no third-party maps). The server reverse-
// geocodes to the nearest city from our own offline dataset. Coordinates are
// never shown to other users.
function captureLocation({ prompt = false } = {}) {
  return new Promise(resolve => {
    if (!('geolocation' in navigator)) return resolve(false);
    navigator.geolocation.getCurrentPosition(
      async pos => {
        try {
          const { latitude, longitude, accuracy } = pos.coords;
          const r = await api('/me/location', { method: 'POST', body: { lat: latitude, lng: longitude, accuracy } });
          S._locationGranted = true;
          if (S.user?.profile && r.city) { S.user.profile.city = r.city; S.user.profile.state = r.state; }
          resolve(true);
        } catch { resolve(false); }
      },
      () => {
        S._locationGranted = false;
        if (prompt) toast('Location is required for accurate matches — enable it in your browser settings.');
        resolve(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  });
}

// ---------------- Onboarding ----------------
// Order per build reference: profile → ID → selfie → profession → pay → intent → astrology → photos
// Registration-by-payment first (low friction), then verification, then the rest.
// Profession + astrology are optional and come last so we don't lose users.
// Live-selfie face verification is the real, required gate. Government-ID,
// profession and astrology are optional boosters at the end (all skippable).
const OB_STEPS = ['profile', 'pay', 'selfie', 'intent', 'photos', 'id', 'profession', 'astrology'];

function onboardingStep() {
  const u = S.user;
  if (!u) return 'profile';
  if (!u.profile?.firstName) return 'profile';
  if (!u.membership?.joinFeePaid) return 'pay';                 // register by payment first
  if (!u.verification?.selfieVerified) return 'selfie';         // real face verification = required
  if (!(u.intent || []).length) return 'intent';
  if (!(u.profile?.photos || []).length) return 'photos';
  if (!u.verification?.idVerified && !u._skippedId) return 'id';                          // optional
  if (!u.claims?.profession?.verified && !u._skippedProfession) return 'profession';      // optional
  if (!u.astrology?.birthDate && !u._skippedAstro) return 'astrology';                    // optional
  return 'done';
}

function obProgress(step) {
  const idx = OB_STEPS.indexOf(step);
  return `<div class="progress">${OB_STEPS.map((_, i) => `<i class="${i <= idx ? 'done' : ''}"></i>`).join('')}</div>`;
}

async function refreshUserAndRoute() {
  S.user = (await api('/auth/me')).user;
  loadPricing();   // refresh live localized prices (gender/country now known)
  if (onboardingStep() === 'done') { toast('Profile complete — welcome to Sambandh'); nav('#/discover'); }
  else renderOnboarding();
}

function renderOnboarding() {
  const step = onboardingStep();
  if (step === 'done') return nav('#/discover');
  const html = {
    profile: obProfile, id: obId, selfie: obSelfie, profession: obProfession,
    pay: obPay, intent: obIntent, astrology: obAstrology, photos: obPhotos
  }[step]();
  screen.innerHTML = obProgress(step) + html;
}

function obProfile() {
  return `<div class="section-pad">
    <h1>Tell us about yourself</h1>
    <p class="sub">No pressure, you can always update this.</p>
    <div class="field"><label>First name</label><input id="ob-name" maxlength="50" placeholder="Your first name"/></div>
    <div class="field"><label>Gender</label><select id="ob-gender">
      <option value="">Select…</option><option value="male">Male</option><option value="female">Female</option>
      <option value="non_binary">Non-binary</option><option value="other">Other</option></select></div>
    <div class="field"><label>Date of birth</label><input id="ob-dob" type="date"/><div class="hint">You must be 18 or older.</div></div>
    <div class="field"><label>City</label>
      <input id="ob-city" list="city-list" placeholder="Start typing… e.g. Guwahati" oninput="cityLookup(this.value)" autocomplete="off"/>
      <datalist id="city-list"></datalist>
      <div class="hint">Pick from the list — distance matching uses your city.</div>
    </div>
    <div class="field"><label>Languages you speak</label>
      <div id="ob-langs">${LANGS.map(l => `<span class="tag plain" data-l="${l}" onclick="this.classList.toggle('forest');this.classList.toggle('plain')" style="cursor:pointer;text-transform:capitalize">${l}</span>`).join('')}</div>
    </div>
    <button class="btn" onclick="obSaveProfile()">Continue →</button>
  </div>`;
}

let cityLookupTimer;
async function cityLookup(q) {
  clearTimeout(cityLookupTimer);
  if (q.length < 2) return;
  cityLookupTimer = setTimeout(async () => {
    try {
      const r = await api('/cities?q=' + encodeURIComponent(q));
      const dl = $('#city-list');
      if (dl) dl.innerHTML = r.cities.map(c => `<option value="${esc(c.name)}">${esc(c.state)}</option>`).join('');
    } catch { /* ignore */ }
  }, 200);
}

async function obSaveProfile() {
  const languages = [...document.querySelectorAll('#ob-langs .tag.forest')].map(t => t.dataset.l);
  try {
    await api('/auth/complete-signup', { method: 'POST', body: {
      firstName: $('#ob-name').value.trim(),
      gender: $('#ob-gender').value,
      dob: $('#ob-dob').value,
      city: $('#ob-city').value.trim(),
      languages: languages.length ? languages : ['english']
    }});
    await refreshUserAndRoute();
  } catch (e) { toast(e.message); }
}

function obId() {
  return `<div class="section-pad">
    <h1>Add a government-ID badge <span class="hint">(optional)</span></h1>
    <p class="sub">You're already photo-verified. Add a government ID for an extra trust badge on your profile. Fully automated — no waiting, no human review.</p>
    <div class="card mt">
      <div class="field"><label>ID type</label><select id="ob-idtype">
        <option value="aadhaar">Aadhaar</option><option value="pan">PAN</option><option value="driving_licence">Driving Licence</option></select></div>
      <div class="field"><label>Photo of your ID</label><input id="ob-idfile" type="file" accept="image/*"/></div>
      <button class="btn" onclick="obUploadId()">Add ID badge</button>
      <button class="btn ghost" onclick="S.user._skippedId=true;renderOnboarding()">Skip for now</button>
      <div id="ob-id-area"></div>
    </div>
    <div class="notice forest ic-row" style="display:flex">${ic('lock')} <span>We store only your name and date of birth. Your ID document is auto-deleted after 30 days. Aadhaar numbers are never stored.</span></div>
  </div>`;
}

async function obUploadId() {
  const f = $('#ob-idfile').files[0];
  if (!f) return toast('Choose a photo of your ID');
  try {
    const base64 = await fileToResizedBase64(f);
    const r = await api('/verification/id', { method: 'POST', body: { method: 'upload', idType: $('#ob-idtype').value, document: { base64, filename: f.name } } });
    if (r.status === 'approved') { toast('ID verified — all checks passed ✓'); await refreshUserAndRoute(); }
    else toast('Not verified: ' + (r.reason || 'checks failed') + '. Please try again with a clearer photo.');
  } catch (e) { toast(e.message); }
}

function obSelfie() {
  return `<div class="section-pad">
    <h1>Verify it's really you</h1>
    <p class="sub">This is your Sambandh verification — a quick live camera check. Our own face verification runs entirely in your browser: no third party, no upload of your face to anyone. It also becomes your first profile photo, and blocks anyone from reusing your face on a fake account.</p>
    <div id="face-stage">
      <button class="btn" onclick="startFaceVerification()">${ic('camera')} Verify with camera</button>
      <div id="face-live" style="display:none;margin-top:12px">
        <video id="face-vid" autoplay muted playsinline style="width:100%;max-width:320px;border-radius:16px;background:#11151c;aspect-ratio:3/4;object-fit:cover;transform:scaleX(-1);display:block;margin:0 auto"></video>
        <p id="face-status" class="hint center" style="margin-top:10px">Loading face model…</p>
        <button class="btn forest" id="face-capture" disabled onclick="captureFace()">Capture &amp; verify</button>
      </div>
    </div>
    <details style="margin-top:14px"><summary class="hint" style="cursor:pointer">No camera? Upload a selfie instead</summary>
      <div class="field mt"><input id="ob-selfie" type="file" accept="image/*" capture="user"/></div>
      <button class="btn secondary" onclick="obSendSelfie()">Verify uploaded selfie</button>
    </details>
    <div class="notice forest ic-row" style="display:flex;margin-top:12px">${ic('shieldCheck')} <span>The same face can't be enrolled on two accounts — our engine detects duplicate identities to stop catfishing and ban-evasion.</span></div>
  </div>`;
}

// Fallback: plain selfie upload (no in-browser face descriptor).
async function obSendSelfie() {
  const f = $('#ob-selfie').files[0];
  if (!f) return toast('Choose a selfie first');
  try {
    const base64 = await fileToResizedBase64(f, 800);
    const r = await api('/verification/selfie', { method: 'POST', body: { base64 } });
    if (r.status === 'approved') { toast('Selfie verified — set as your first profile photo ✓'); await refreshUserAndRoute(); }
    else toast('Not verified: ' + (r.reason || 'face match failed'));
  } catch (e) { toast(e.message); }
}

// ---- Own face verification via @vladmandic/face-api (client-side ML, CDN) ----
const FACE_CDN = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/dist/face-api.min.js';
const FACE_MODELS = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/model';
let _faceStream = null;

const _loadedScripts = new Set();
function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (_loadedScripts.has(src)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => { _loadedScripts.add(src); resolve(); };
    s.onerror = () => reject(new Error('Could not load ' + src));
    document.head.appendChild(s);
  });
}

// ---- NSFW classification (NSFWJS / TensorFlow.js, client-side, models from CDN) ----
let _nsfwModel = null;
async function classifyImageNSFW(base64) {
  try {
    if (!_nsfwModel) {
      await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.20.0/dist/tf.min.js');
      await loadScript('https://cdn.jsdelivr.net/npm/nsfwjs@2.4.2/dist/nsfwjs.min.js');
      _nsfwModel = await nsfwjs.load(); // MobileNetV2 NSFW model
    }
    const img = new Image();
    img.src = 'data:image/jpeg;base64,' + base64;
    await img.decode();
    const preds = await _nsfwModel.classify(img);
    const s = {};
    for (const p of preds) s[p.className.toLowerCase()] = p.probability;
    return { neutral: s.neutral || 0, drawing: s.drawing || 0, sexy: s.sexy || 0, hentai: s.hentai || 0, porn: s.porn || 0 };
  } catch { return null; } // best-effort — moderation is a bonus layer, never blocks the flow on a CDN hiccup
}

async function startFaceVerification() {
  const setStatus = m => { const el = $('#face-status'); if (el) el.textContent = m; };
  $('#face-live').style.display = 'block';
  try {
    await loadScript(FACE_CDN);
    setStatus('Loading face model…');
    try { if (faceapi.tf) { try { await faceapi.tf.setBackend('webgl'); } catch { /* fall back */ } if (faceapi.tf.ready) await faceapi.tf.ready(); } } catch { /* ignore */ }
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(FACE_MODELS),
      faceapi.nets.faceLandmark68TinyNet.loadFromUri(FACE_MODELS),
      faceapi.nets.faceRecognitionNet.loadFromUri(FACE_MODELS)
    ]);
    _faceStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640 }, audio: false });
    $('#face-vid').srcObject = _faceStream;
    setStatus('Ready — look straight at the camera in good light.');
    $('#face-capture').disabled = false;
  } catch (e) {
    setStatus('');
    toast(e.name === 'NotAllowedError' ? 'Camera blocked — allow it in your browser, or use the upload option.' : (e.message || 'Camera unavailable — use the upload option.'));
  }
}

function stopFaceStream() { if (_faceStream) { _faceStream.getTracks().forEach(t => t.stop()); _faceStream = null; } }

async function captureFace() {
  const vid = $('#face-vid'), setStatus = m => { const el = $('#face-status'); if (el) el.textContent = m; };
  $('#face-capture').disabled = true;
  setStatus('Detecting your face…');
  try {
    const opts = new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 });
    const det = await faceapi.detectSingleFace(vid, opts).withFaceLandmarks(true).withFaceDescriptor();
    if (!det) { setStatus('No face detected — move into the light and try again.'); $('#face-capture').disabled = false; return; }
    const faceDescriptor = Array.from(det.descriptor);
    // Grab the current frame as the selfie image
    const c = document.createElement('canvas');
    c.width = vid.videoWidth; c.height = vid.videoHeight;
    c.getContext('2d').drawImage(vid, 0, 0);
    const base64 = c.toDataURL('image/jpeg', 0.85).split(',')[1];
    setStatus('Verifying…');
    const r = await api('/verification/selfie', { method: 'POST', body: { base64, faceDescriptor } });
    stopFaceStream();
    if (r.status === 'approved') { toast('Face verified — set as your first profile photo ✓'); await refreshUserAndRoute(); }
    else { setStatus(''); toast('Not verified: ' + (r.reason || 'please try again')); $('#face-capture').disabled = false; }
  } catch (e) { setStatus(''); toast(e.message); $('#face-capture').disabled = false; }
}

// ---- Geometric read (opt-in): face geometry → a temperament READING ----
// SEPARATE and EXPLICIT — never part of verification, never automatic. The user
// turns it on (POST /me/cv-consent), then this reuses the SAME face-api 68-pt
// landmarks the verifier already loads, maps them PURELY (SBGeometry — no colour/
// pixel input, so complexion can't influence anything), keeps only confident
// readings, and POSTs them through the server guard. The result is a reading, never
// "verified". build/gait/hands are not produced here (no body-pose model).
//
// NOTE: the landmark ML itself runs only in a real browser with a camera, so this
// wiring is exercised in the field; the geometry MATH it depends on is covered by
// tests/geometry-map.test.js and the server guard by tests/cv-route.test.js.
async function enableGeometricRead() {
  try {
    await api('/me/cv-consent', { method: 'POST', body: { geometry: true } });
    toast('Geometric read on — it will refine your nature reading (never “verified”).');
  } catch { toast('Could not save that preference — try again.'); }
}

async function runGeometricReadFromVideo() {
  if (typeof faceapi === 'undefined' || typeof SBGeometry === 'undefined') return null;
  const vid = $('#face-vid');
  if (!vid) return null;
  const opts = new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 });
  const det = await faceapi.detectSingleFace(vid, opts).withFaceLandmarks(true);
  if (!det || !det.landmarks) return null;
  const points = det.landmarks.positions.map(p => ({ x: p.x, y: p.y }));  // 68 {x,y}
  const read = SBGeometry.geometryToFeatures(points);
  const features = SBGeometry.confidentFeatures(read);                    // drop low-confidence
  if (!Object.keys(features).length) return null;
  // Server applies through feature-guard: consent required, complexion refused,
  // self-declared never overwritten, output tagged as a reading.
  const r = await api('/me/geometric-read', { method: 'POST', body: { features } });
  return r;                                                               // { written, badge:'reading', ... }
}

// Body build from a full-body pose (MoveNet via TF.js — same tfjs the NSFW check
// loads). Structural proportion ONLY (shoulder/hip/torso), mapped PURELY via
// SBGeometry.poseToFeatures; gait/hands are never guessed. Field-exercised edge;
// its geometry math is covered by tests/geometry-map.test.js.
let _poseModel = null;
async function runBodyReadFromVideo(videoEl) {
  const vid = videoEl || $('#face-vid');
  if (!vid || typeof SBGeometry === 'undefined') return null;
  try {
    if (!_poseModel) {
      await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.20.0/dist/tf.min.js');
      await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/pose-detection@2.1.3/dist/pose-detection.min.js');
      _poseModel = await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet);
    }
    const poses = await _poseModel.estimatePoses(vid);
    if (!poses || !poses[0]) return null;
    const kp = {};
    for (const p of poses[0].keypoints) if (p.name) kp[p.name] = { x: p.x, y: p.y, score: p.score };
    const read = SBGeometry.poseToFeatures(kp);
    const features = SBGeometry.confidentFeatures(read);
    if (!Object.keys(features).length) return null;
    return await api('/me/geometric-read', { method: 'POST', body: { features } });  // guarded, reading-only
  } catch { return null; }   // pose is a bonus refinement — a CDN/model hiccup never blocks anything
}

function obProfession() {
  return `<div class="section-pad">
    <h1>What do you do?</h1>
    <p class="sub">Every profession on Sambandh is verified. Doctors, lawyers, CAs and architects verify instantly against public registries.</p>
    <div class="field"><label>Category</label><select id="ob-cat" onchange="obCatChange()">
      <option value="engineer">Engineer / Tech</option>
      <option value="doctor">Doctor (instant ✓)</option>
      <option value="lawyer">Lawyer (instant ✓)</option>
      <option value="ca">Chartered Accountant (instant ✓)</option>
      <option value="architect">Architect (instant ✓)</option>
      <option value="designer">Designer / Creator</option>
      <option value="business_owner">Business owner</option>
      <option value="student">Student</option>
      <option value="other">Other</option></select></div>
    <div class="field"><label>Job title</label><input id="ob-title" placeholder="e.g. Product Designer"/></div>
    <div class="field"><label>Company / Institution</label><input id="ob-company" placeholder="e.g. Infosys"/></div>
    <div id="ob-reg" style="display:none" class="field"><label>Registration number</label><input id="ob-regno" placeholder="e.g. NMC/BCI/ICAI number"/><div class="hint">Checked against the public registry — verifies instantly.</div></div>
    <div id="ob-docs" class="field"><label>Proof document (offer letter / company ID / college ID)</label><input id="ob-doc" type="file" accept="image/*,.pdf"/><div class="hint">Automated document check — instant. The document must name your employer. No human reviews it.</div></div>
    <button class="btn" onclick="obSendProfession()">Verify instantly</button>
    <button class="btn ghost" onclick="S.user._skippedProfession=true;renderOnboarding()">Skip for now</button>
    <p class="hint center" style="margin-top:6px">You can add a verified profession later from your profile — it's optional.</p>
  </div>`;
}

function obCatChange() {
  const registry = ['doctor', 'lawyer', 'ca', 'architect'].includes($('#ob-cat').value);
  $('#ob-reg').style.display = registry ? 'block' : 'none';
  $('#ob-docs').style.display = registry ? 'none' : 'block';
}

async function obSendProfession() {
  const cat = $('#ob-cat').value;
  const registry = ['doctor', 'lawyer', 'ca', 'architect'].includes(cat);
  const body = {
    title: $('#ob-title').value.trim(),
    company: $('#ob-company').value.trim(),
    category: cat,
    documents: []
  };
  try {
    if (registry) {
      const regno = $('#ob-regno').value.trim();
      if (!regno) return toast('Enter your registration number');
      body.registrationNumber = regno;
    } else {
      const f = $('#ob-doc').files[0];
      if (!f) return toast('Upload a proof document');
      body.documents = [{ type: 'offer_letter', base64: await fileToUploadBase64(f), filename: f.name }];
    }
    const r = await api('/verification/profession', { method: 'POST', body });
    if (r.status === 'approved') { toast('Profession verified instantly ✓'); await refreshUserAndRoute(); }
    else toast('Not verified: ' + (r.reason || 'document check failed') + '. Upload a document that names your employer.');
  } catch (e) { toast(e.message); }
}

// Instant fallback while the live price loads. The server order is authoritative
// (Indian users → INR so UPI/wallets/netbanking show; amount is live-converted CHF).
function localPricing() {
  const country = (S.user && S.user.profile && S.user.profile.country) || 'IN';
  return country === 'IN'
    ? { sym: '₹', base: { male: 95, female: 475, non_binary: 285 }, pro: 570, max: 1425 }
    : { sym: 'CHF ', base: { male: 1, female: 5, non_binary: 3 }, pro: 6, max: 15 };
}
// Prefer the live, server-computed price (CHF converted at today's rate).
function pricingView() {
  const s = S._pricing;
  return s ? { sym: s.symbol, base: s.base, pro: s.pro, max: s.max } : localPricing();
}
async function loadPricing() {
  try { S._pricing = await api('/payment/pricing'); if (['#/onboarding', '#/settings'].includes(location.hash)) route(); } catch { /* mirror used */ }
}
function obPay() {
  const g = S.user.profile.gender;
  const p = pricingView();
  const fee = p.base[g] ?? p.base.non_binary;
  return `<div class="section-pad">
    <h1>Start your membership</h1>
    <p class="sub">Nothing here is free — every member pays monthly. That's what keeps the bots and time-wasters out.</p>
    <div class="card center" style="background:var(--rose-soft);border-color:var(--rose)">
      <div style="font-size:38px;font-weight:700;color:var(--sindoor-deep);font-family:Georgia,serif">${p.sym}${fee}<span style="font-size:15px;color:var(--sindoor)"> / month</span></div>
      <div style="font-size:12px;color:var(--sindoor)">30 days per payment · renew when it suits you · taxes included</div>
      <div class="hint">Men ${p.sym}${p.base.male} · Women ${p.sym}${p.base.female} · Non-binary ${p.sym}${p.base.non_binary} per month — your price is set by your verified profile, not by this page.</div>
    </div>
    <button class="btn" onclick="obPayNow()">Pay with UPI / Card</button>
    <p class="hint center mt">Powered by Razorpay · Secure payment · Full refund within 24 hours, no questions asked</p>
  </div>`;
}

// Load Razorpay's checkout script on demand (needed before `new Razorpay(...)`).
async function ensureRazorpay() {
  if (window.Razorpay) return;
  await loadScript('https://checkout.razorpay.com/v1/checkout.js');
  if (!window.Razorpay) throw new Error('Could not load the payment gateway — check your connection and try again.');
}

async function obPayNow() {
  try {
    const order = await api('/payment/create-order', { method: 'POST', body: { purpose: 'base_subscription' } });
    if (order.devMode) {
      await api('/payment/verify', { method: 'POST', body: { razorpay_order_id: order.orderId } });
      toast('Payment simulated (dev mode) ✓');
      return refreshUserAndRoute();
    }
    // Production Razorpay Checkout
    await ensureRazorpay();
    const rzp = new Razorpay({
      key: order.key, amount: order.amount, currency: order.currency, name: 'Sambandh',
      description: 'Base membership (monthly)', order_id: order.orderId, prefill: order.prefill,
      handler: async resp => {
        await api('/payment/verify', { method: 'POST', body: { ...resp, purpose: 'base_subscription' } });
        toast('Payment successful ✓');
        refreshUserAndRoute();
      }
    });
    rzp.open();
  } catch (e) { toast(e.message); }
}

function obIntent() {
  return `<div class="section-pad">
    <h1>Pick your intent</h1>
    <p class="sub">Be honest — people only see matches with the same intent. Pick up to 2.</p>
    ${INTENTS.map(i => `<div class="tile" data-v="${i.v}" onclick="toggleIntentTile(this)">
      <div class="t ic-row"><span style="color:var(--sindoor);display:inline-flex">${ic(i.icon)}</span>${i.t}</div><div class="d">${i.d}</div></div>`).join('')}
    <h2>Interested in</h2>
    <div id="ob-genders">
      ${['male','female','non_binary','other'].map(g => `<span class="tag plain" data-g="${g}" onclick="this.classList.toggle('rose');this.classList.toggle('plain')" style="cursor:pointer;text-transform:capitalize;font-size:13px;padding:6px 14px">${g.replace('_',' ')}</span>`).join('')}
    </div>
    <button class="btn mt" onclick="obSaveIntent()">Continue →</button>
  </div>`;
}

function toggleIntentTile(el) {
  if (!el.classList.contains('selected') &&
      document.querySelectorAll('.tile.selected').length >= 2) {
    return toast('Pick at most 2 intents');
  }
  el.classList.toggle('selected');
}

async function obSaveIntent() {
  const intent = [...document.querySelectorAll('.tile.selected')].map(t => t.dataset.v);
  const genders = [...document.querySelectorAll('#ob-genders .tag.rose')].map(t => t.dataset.g);
  if (!intent.length) return toast('Pick at least one intent');
  try {
    await api('/auth/profile', { method: 'PATCH', body: { intent, ...(genders.length ? { interestedInGenders: genders } : {}) } });
    await refreshUserAndRoute();
  } catch (e) { toast(e.message); }
}

function obAstrology() {
  return `<div class="section-pad">
    <h1>Astrology details</h1>
    <p class="sub">Optional but recommended — powers Vedic guna milan compatibility. For insight, never deterministic.</p>
    <div class="field"><label>Birth date</label><input id="ob-bdate" type="date" value="${esc(S.user.profile.dob || '')}"/></div>
    <div class="field"><label>Birth time (needed for guna milan)</label><input id="ob-btime" type="time"/><div class="hint">Don't know it? Skip — we'll use sun-sign compatibility only.</div></div>
    <div class="field"><label>Birth place (city)</label><input id="ob-bplace" placeholder="e.g. Guwahati"/></div>
    <button class="btn" onclick="obSaveAstro()">Save astrology</button>
    <button class="btn ghost" onclick="S.user._skippedAstro=true;renderOnboarding()">Skip for now</button>
  </div>`;
}

async function obSaveAstro() {
  const birthDate = $('#ob-bdate').value;
  if (!birthDate) return toast('Enter your birth date, or skip');
  const astrology = { birthDate };
  if ($('#ob-btime').value) astrology.birthTime = $('#ob-btime').value;
  if ($('#ob-bplace').value.trim()) astrology.birthPlace = { city: $('#ob-bplace').value.trim() };
  try {
    await api('/auth/profile', { method: 'PATCH', body: { astrology } });
    await refreshUserAndRoute();
  } catch (e) { toast(e.message); }
}

function obPhotos() {
  return `<div class="section-pad">
    <h1>Add photos</h1>
    <p class="sub">1–6 photos. The first becomes your primary. Location data is stripped automatically.</p>
    <div class="photo-grid" id="ob-grid"></div>
    <input id="ob-photo-input" type="file" accept="image/*" multiple style="display:none" onchange="obAddPhotos(this.files)"/>
    <button class="btn" onclick="obSavePhotos()" id="ob-photos-save" disabled>Finish & start discovering</button>
    <button class="btn ghost" onclick="document.getElementById('ob-photo-input').click()">+ Add photo</button>
  </div>`;
}

function obDrawGrid() {
  const grid = $('#ob-grid');
  if (!grid) return;
  grid.innerHTML = S.onboardPhotos.map((p, i) => `
    <div class="ph"><img src="data:image/jpeg;base64,${p.base64}"/>
      ${i === 0 ? '<span class="primary-tag">PRIMARY</span>' : ''}
      <button class="rm" onclick="S.onboardPhotos.splice(${i},1);obDrawGrid()">✕</button></div>`).join('')
    + (S.onboardPhotos.length < 6 ? `<div class="ph" onclick="document.getElementById('ob-photo-input').click()">+</div>` : '');
  $('#ob-photos-save').disabled = S.onboardPhotos.length === 0;
}

async function obAddPhotos(files) {
  for (const f of [...files].slice(0, 6 - S.onboardPhotos.length)) {
    try {
      const base64 = await fileToResizedBase64(f);
      const nsfw = await classifyImageNSFW(base64);         // client-side ML content check
      if (nsfw && (nsfw.porn + nsfw.hentai >= 0.6 || nsfw.porn >= 0.55)) { toast(f.name + ' looks explicit — profile photos must be safe-for-work.'); continue; }
      S.onboardPhotos.push({ base64, filename: f.name, nsfw });
    } catch { toast('Could not read ' + f.name); }
  }
  obDrawGrid();
}

async function obSavePhotos() {
  try {
    await api('/auth/profile', { method: 'PATCH', body: {
      photos: S.onboardPhotos.map((p, i) => ({ ...p, isPrimary: i === 0 }))
    }});
    S.onboardPhotos = [];
    await refreshUserAndRoute();
  } catch (e) { toast(e.message); }
}

// ---------------- Discover ----------------
// Reading ④ shared bits. The server already guarantees jargon-free reading text;
// this client guard is defense-in-depth on the NEW render paths (discover card +
// other users' profiles) — a line containing any astrology term is dropped.
const READING_JARGON_RE = /\b(sun|moon|mars|mercury|jupiter|venus|saturn|rahu|ketu|aries|taurus|gemini|cancer|leo|virgo|libra|scorpio|sagittarius|capricorn|aquarius|pisces|nakshatra|dosha|dasha|guna|lagna|mangal|rashi|ascendant|kundli|kundali|graha|navamsa|dasamsa|exalted|debilitated|ayanamsa|vimshottari)\b/i;
function plainOnly(s) { return (typeof s === 'string' && s && !READING_JARGON_RE.test(s)) ? s : ''; }

// The ONE reading-cards renderer, reused by the Me tab and other users' profiles.
// Every card is labelled a READING (never verified) and jargon-guarded.
function readingCardsHtml(pairs, { note = 'Your reading — an insight, not a verified fact' } = {}) {
  const safe = pairs.filter(([, a]) => plainOnly(a));
  if (!safe.length) return '';
  return `<div style="margin:6px 0">${SBBadge.badgeHtml('reading', note)}</div>` +
    safe.map(([title, a]) => `<div class="card" style="margin-bottom:8px;background:rgba(138,92,192,.05)">
      <div class="hint" style="font-weight:700">${esc(title)}</div>
      <div style="margin-top:3px">${esc(plainOnly(a))}</div></div>`).join('');
}

async function renderDiscover() {
  screen.innerHTML = `
    ${headerBar()}
    <div class="chips" id="intent-chips">
      ${['all', ...INTENTS.map(i => i.v)].map(v => `<button class="chip ${S.filters.intent === v ? 'active' : ''}" onclick="S.filters.intent='${v}';renderDiscover()">${v === 'all' ? 'All' : INTENTS.find(i => i.v === v).t}</button>`).join('')}
      <button class="chip ic-row" onclick="openFilters()">${ic('sliders')} Filters</button>
    </div>
    <div id="feed"><div class="empty">Loading profiles…</div></div>`;
  loadNotifCount();
  if (!S._locationGranted) captureLocation({ prompt: true }); // ensure precise distance
  // Ask for notification permission LAST — only once the user is fully onboarded
  // (registered + paid + browsing), so we don't add friction and lose signups.
  if (!S._pushAsked) { S._pushAsked = true; registerWebPush(); }
  try {
    const q = new URLSearchParams({
      intent: S.filters.intent, minAge: S.filters.minAge, maxAge: S.filters.maxAge,
      verification: S.filters.verification, karmaGrade: S.filters.karmaGrade,
      showAnonymous: S.filters.showAnonymous, maxKm: S.filters.maxKm,
      onlineOnly: S.filters.onlineOnly
    });
    const r = await api('/discover?' + q);
    const feed = $('#feed');
    if (!r.profiles.length) {
      feed.innerHTML = `<div class="empty"><div class="big" style="color:var(--sand-mid)">${ic('search', 'ic-xl')}</div>No profiles match your filters yet.<br>Try widening them (distance is set to ${esc(String(S.filters.maxKm))}) — or invite friends to the beta.</div>`;
      return;
    }
    feed.innerHTML = r.profiles.map(p => `
      <div class="pcard-wrap" id="pw-${p.userId}">
      <div class="pcard" id="pc-${p.userId}" onclick="nav('#/profile/${p.userId}')">
        ${p.anonymous
          ? `<div class="anon-face" style="color:rgba(255,255,255,0.85)">${ic('ghost', 'ic-xl')}</div>`
          : `<div class="pcard-ini" aria-hidden="true">${esc((p.firstName || '?')[0].toUpperCase())}</div>${p.photo ? `<img class="photo" src="${esc(p.photo)}" onerror="this.style.display='none'"/>` : ''}`}
        <span class="badge-tl">${esc((p.intent[0] || 'dating'))}</span>
        ${p.verificationLevel !== 'phone_only' ? `<span class="badge-tr ic-row">${ic('shieldCheck')} ${p.verificationLevel === 'fully_verified' ? 'FULLY VERIFIED' : 'VERIFIED'}</span>` : ''}
        <div class="info">
          <div class="name">${esc(p.firstName)}${p.age ? ', ' + p.age : ''} ${p.likesMe ? '<span style="font-size:11px;background:var(--haldi);color:var(--sindoor-deep);padding:2px 8px;border-radius:8px;vertical-align:middle">likes you</span>' : ''}</div>
          <div class="meta ic-row">${ic('pin')} ${esc(p.city || '')}${p.distanceKm != null ? ' · ' + p.distanceKm + ' km' : ''}${p.profession ? ' · ' + esc(p.profession) : ''}${p.online ? ' · <i style="width:8px;height:8px;border-radius:50%;background:#4ADE80;display:inline-block"></i>' : ''}</div>
          <div class="trow">
            ${p.tagsPositive.map(t => `<span class="wtag">${esc(t)}</span>`).join('')}
            ${p.tagsNegative.map(t => `<span class="wtag" style="color:var(--haldi)">${esc(t)}</span>`).join('')}
            <span class="karma">Lakshan: ${p.karma.score} ${p.karma.grade}</span>
          </div>
          ${(p.reasons && p.reasons.length) ? `<div class="why">${ic('sparkle')} ${p.reasons.map(r => esc(r)).join(' · ')}</div>` : ''}
          ${plainOnly(p.natureLine) ? `<div class="nature-line" style="margin-top:5px;display:flex;align-items:center;gap:6px;flex-wrap:wrap">${SBBadge.badgeHtml('reading', 'Reading')}<span style="font-size:12.5px;color:var(--plum,#8a5cc0)">${esc(plainOnly(p.natureLine))}</span></div>` : ''}
        </div>
      </div>
      <div class="pcard-actions" id="pa-${p.userId}">
        <button title="Pass" onclick="passUser('${p.userId}')">${ic('x', 'ic-lg')}</button>
        <button class="act-msg" title="Message" onclick="startChat('${p.userId}', false)">${ic('message', 'ic-lg')}</button>
        <button class="act-like" title="Like" onclick="likeUser('${p.userId}')">${p.likedByMe ? ic('heart', 'ic-lg fill') : ic('heart', 'ic-lg')}</button>
      </div>
      </div>`).join('');
  } catch (e) {
    $('#feed').innerHTML = `<div class="empty">${esc(e.message)}</div>`;
  }
}

async function likeUser(userId) {
  event?.stopPropagation();
  try {
    const r = await api(`/discover/${userId}/like`, { method: 'POST' });
    if (r.matched && r.newMatch) {
      toast("It's a match! Opening your chat…");
      setTimeout(() => nav('#/chat/' + r.chatId), 900);
    } else if (r.matched) {
      toast('You already matched — chat is open');
      nav('#/chat/' + r.chatId);
    } else {
      toast('Liked — if they like you back, it’s a match');
      const btn = document.querySelector(`#pa-${CSS.escape(userId)} .act-like`);
      if (btn) btn.innerHTML = ic('heart', 'ic-lg fill');
    }
  } catch (e) { toast(e.message); }
}

async function passUser(userId) {
  event?.stopPropagation();
  try {
    await api(`/discover/${userId}/pass`, { method: 'POST' });
    document.getElementById('pw-' + userId)?.remove();
  } catch (e) { toast(e.message); }
}

function headerBar() {
  return `<div class="app-header">
    <div class="wordmark">sambandh</div>
    <div class="header-actions">
      <button onclick="showWhoLikedMe()" title="Who liked you" style="color:var(--sindoor)">${ic('heart', 'ic-lg')}</button>
      <button onclick="nav('#/notifications')" style="color:var(--ink-mid)">${ic('bell', 'ic-lg')}<span class="notif-dot" id="notif-dot" style="display:none"></span></button>
    </div>
  </div>`;
}

async function showWhoLikedMe() {
  try {
    const r = await api('/discover/likes');
    openModal(`
      <h2 style="margin-top:0" class="ic-row">${ic('heart')} Who liked you</h2>
      <div class="karma-hero good" style="padding:14px"><b>${r.count}</b><span>${r.count === 1 ? 'person likes' : 'people like'} your profile</span></div>
      ${r.upgradeRequired
        ? `<div class="notice rose">Seeing <b>who</b> liked you is a Sambandh Max perk (CHF 15/month). Like people back in Discover — mutual likes always match.</div>`
        : (r.profiles || []).map(p => `
          <div class="chat-item" style="border-radius:12px;margin-bottom:8px" onclick="closeModal();nav('#/profile/${p.userId}')">
            <div class="avatar">${p.photo ? `<img src="${esc(p.photo)}" data-i="${esc((p.firstName || '?')[0])}" onerror="imgFail(this)"/>` : esc((p.firstName || '?')[0])}</div>
            <div class="cbody"><div class="cname"><span>${esc(p.firstName)}${p.age ? ', ' + p.age : ''}</span></div>
            <div class="clast">${esc(p.city || '')}</div></div>
          </div>`).join('') || '<p class="sub">No likes yet — polish that bio!</p>'}
      <button class="btn mt" onclick="closeModal()">Close</button>`);
  } catch (e) { toast(e.message); }
}

async function loadNotifCount() {
  try {
    const r = await api('/notifications');
    S.unreadNotifs = r.unread;
    const dot = $('#notif-dot');
    if (dot && r.unread > 0) { dot.style.display = 'block'; dot.textContent = r.unread; }
  } catch { /* ignore */ }
  try {
    const c = await api('/chat');
    const unread = c.chats.reduce((s, x) => s + (x.unreadCount || 0), 0);
    const badge = $('#chat-badge');
    if (badge) {
      badge.style.display = unread > 0 ? 'block' : 'none';
      badge.textContent = unread > 9 ? '9+' : unread;
    }
  } catch { /* ignore */ }
}

function openFilters() {
  const f = S.filters;
  openModal(`
    <h2 style="margin-top:0">Filters</h2>
    <div class="row">
      <div class="field"><label>Min age</label><input id="f-min" type="number" min="18" max="60" value="${f.minAge}"/></div>
      <div class="field"><label>Max age</label><input id="f-max" type="number" min="18" max="60" value="${f.maxAge}"/></div>
    </div>
    <div class="field"><label>Verification level</label><select id="f-ver">
      <option value="any" ${f.verification === 'any' ? 'selected' : ''}>Photo-verified (all)</option>
      <option value="id" ${f.verification === 'id' ? 'selected' : ''}>Government-ID verified</option>
      <option value="profession" ${f.verification === 'profession' ? 'selected' : ''}>Profession verified</option>
      <option value="fully_verified" ${f.verification === 'fully_verified' ? 'selected' : ''}>Fully verified</option></select></div>
    <div class="field"><label>Minimum Lakshan grade</label><select id="f-karma">
      ${['any','A+','A','B+','B','C'].map(g => `<option value="${g}" ${f.karmaGrade === g ? 'selected' : ''}>${g === 'any' ? 'Any' : g + ' and above'}</option>`).join('')}</select></div>
    <div class="field"><label>Max distance</label><select id="f-km">
      ${['5','25','50','100','anywhere'].map(k => `<option value="${k}" ${String(f.maxKm) === k ? 'selected' : ''}>${k === 'anywhere' ? 'Anywhere in India' : k + ' km'}</option>`).join('')}</select></div>
    <div class="setting-row"><span>Show anonymous profiles</span>
      <label class="switch"><input id="f-anon" type="checkbox" ${f.showAnonymous ? 'checked' : ''}/><span class="sl"></span></label></div>
    <div class="setting-row"><span>Only active in last 24h</span>
      <label class="switch"><input id="f-online" type="checkbox" ${f.onlineOnly ? 'checked' : ''}/><span class="sl"></span></label></div>
    <button class="btn mt" onclick="applyFilters()">Apply filters</button>`);
}

function applyFilters() {
  S.filters.minAge = +$('#f-min').value || 18;
  S.filters.maxAge = +$('#f-max').value || 60;
  S.filters.verification = $('#f-ver').value;
  S.filters.karmaGrade = $('#f-karma').value;
  S.filters.maxKm = $('#f-km').value;
  S.filters.showAnonymous = $('#f-anon').checked;
  S.filters.onlineOnly = $('#f-online').checked;
  closeModal();
  renderDiscover();
}

async function startChat(userId, anonymous) {
  event?.stopPropagation();
  try {
    const r = await api('/chat/start', { method: 'POST', body: { withUserId: userId, anonymous } });
    nav('#/chat/' + r.chatId);
  } catch (e) { toast(e.message); }
}

// ---------------- Profile detail ----------------
async function renderProfile(userId) {
  screen.innerHTML = `<div class="section-pad"><div class="empty">Loading profile…</div></div>`;
  try {
    const [p, karma, rdg] = await Promise.all([
      api('/discover/profile/' + userId),
      api('/karma/profile/' + userId),
      api('/reading/' + userId).catch(() => null)   // reading is a nicety — never break the profile
    ]);
    // Full plain-language reading for the viewed user (READING badge, jargon-guarded).
    const readingBlock = rdg ? readingCardsHtml([
      ['Their nature', rdg.line],
      ['Who they are', rdg.who]
    ], { note: 'Their reading — an insight, not a verified fact' }) : '';
    const photo = p.photos?.find(x => x.isPrimary)?.url || p.photos?.[0]?.url;
    screen.innerHTML = `
      <div class="app-header">
        <button class="back" style="background:none;border:none;font-size:22px;cursor:pointer" onclick="history.back()">←</button>
        <div style="flex:1;padding-left:8px"><b>${esc(p.firstName)}${p.age ? ', ' + p.age : ''}</b>
          <div style="font-size:11px;color:var(--forest)">${verLabel(p.verification)}</div></div>
        <button style="background:none;border:none;cursor:pointer;color:var(--danger)" title="Report" onclick="openReport('${p.userId}')">${ic('flag', 'ic-lg')}</button>
      </div>
      <div class="section-pad">
        ${photo ? `<img src="${esc(photo)}" onerror="this.style.display='none'" style="width:100%;border-radius:16px;max-height:380px;object-fit:cover;margin-bottom:14px"/>`
          : p.anonymous ? `<div class="notice anon ic-row" style="display:flex">${ic('ghost')} <span>This person browses anonymously. Chat first — identities reveal by mutual consent.</span></div>` : ''}
        <div class="stat-row">
          <div class="stat"><b>${karma.score}</b><span>Lakshan score</span></div>
          <div class="stat"><b>${karma.grade}</b><span>grade</span></div>
          <div class="stat"><b>${karma.activity?.activeChats ?? 0}</b><span>active chats</span></div>
        </div>
        ${p.bio ? `<p style="margin-bottom:12px">${esc(p.bio)}</p>` : ''}
        <div style="margin-bottom:10px">
          ${(p.intent || []).map(i => `<span class="tag rose" style="text-transform:capitalize">${esc(i)}</span>`).join('')}
          ${(p.tagsPositive || []).map(t => `<span class="tag forest">${esc(t)}</span>`).join('')}
          ${(p.tagsNegative || []).map(t => `<span class="tag haldi">${esc(t)}</span>`).join('')}
        </div>
        ${p.profession?.title ? `<div class="card ic-row" style="padding:12px 14px;font-size:13.5px;display:flex">${ic('briefcase')} <span>${esc(p.profession.title)}${p.profession.company ? ' · ' + esc(p.profession.company) : ''}</span> ${p.profession.verified ? '<span class="tag forest">verified</span>' : '<span class="tag plain">unverified</span>'}</div>` : ''}
        ${readingBlock}
        ${renderKarmaFlags(karma, p.userId)}
        ${karma.activity ? `<div class="card" style="font-size:13px">
          <b style="font-size:11px;color:var(--ink-soft);text-transform:uppercase;letter-spacing:.05em">Activity — transparency</b>
          <div class="kv"><span>Active in</span><b>${karma.activity.activeChats} chats</b></div>
          <div class="kv"><span>New chats this week</span><b>${karma.activity.newChats7d}</b></div>
          ${karma.activity.exclusivityClaimedToCount ? `<div class="kv"><span>"Exclusive" claimed to</span><b style="color:var(--haldi-deep)">${karma.activity.exclusivityClaimedToCount} people / 30d</b></div>` : ''}
        </div>` : ''}
        <button class="btn ic-row" style="display:flex;justify-content:center" onclick="startChat('${p.userId}', false)">${ic('message')} Send message</button>
        <button class="btn secondary ic-row" style="display:flex;justify-content:center" onclick="likeUser('${p.userId}')">${p.likedByMe ? ic('heart', 'fill') : ic('heart')} ${p.likedByMe ? 'Liked' : 'Like'}</button>
        <button class="btn secondary ic-row" style="display:flex;justify-content:center" onclick="startChat('${p.userId}', true)">${ic('ghost')} Chat anonymously</button>
        <button class="btn secondary ic-row" style="display:flex;justify-content:center" onclick="nav('#/compat/${p.userId}')">${ic('sparkle')} Compatibility check</button>
        <button class="btn secondary ic-row" style="display:flex;justify-content:center" onclick="addIncognito('${p.userId}')">${ic('eyeOff')} Hide my profile from them</button>
        <button class="btn danger ic-row" style="display:flex;justify-content:center" onclick="blockUser('${p.userId}')">${ic('slash')} Block</button>
      </div>`;
  } catch (e) {
    screen.innerHTML = `<div class="section-pad"><div class="empty">${esc(e.message)}</div><button class="btn ghost" onclick="history.back()">← Back</button></div>`;
  }
}

function verLabel(v) {
  if (!v) return '';
  if (v.level === 'fully_verified') return '✓ Fully verified';
  if (v.level === 'profession_verified') return '✓ Profession verified';
  if (v.level === 'id_verified') return '✓ Photo + ID verified';
  if (v.level === 'photo_verified') return '✓ Photo verified';
  return 'Phone verified only';
}

function renderKarmaFlags(karma, userId) {
  if (!karma.flags?.length) return '';
  return karma.flags.map((f, i) => `
    <div class="flag-card ${f.severity === 'critical' ? 'critical' : ''}">
      <div class="ft ic-row">${ic('alert')} ${f.severity === 'critical' ? 'Safety alert' : 'Honesty signal'}</div>
      <div class="fd">${esc(f.message)}</div>
      ${f.escalationCost > 0 ? `<button class="btn small mt" style="background:white;color:var(--haldi-deep);border:1px solid var(--haldi-deep)" onclick="escalateFlag('${userId}','${esc(f.type)}',${f.escalationCost})">See evidence → CHF ${f.escalationCost}</button>` : ''}
    </div>`).join('');
}

async function escalateFlag(userId, flagType, cost) {
  if (!confirm(`Pay CHF ${cost} to see the actual statements behind this flag? The person is notified someone looked deeper — but never who. Limited to 3/day.`)) return;
  try {
    const order = await api('/payment/create-order', { method: 'POST', body: { purpose: cost >= 1 ? 'karma_escalation_high' : 'karma_escalation' } });
    let paymentId;
    if (order.devMode) {
      const v = await api('/payment/verify', { method: 'POST', body: { razorpay_order_id: order.orderId } });
      paymentId = v.paymentId;
    } else {
      return toast('Live payments: complete checkout, then retry. (Dev mode handles this automatically.)');
    }
    const r = await api('/karma/escalate', { method: 'POST', body: { targetUserId: userId, flagType, paymentId } });
    openModal(`
      <h2 style="margin-top:0" class="ic-row">${ic('unlock')} Escalation revealed</h2>
      <p class="sub">You paid CHF ${cost} — evidence below</p>
      ${(r.revealed || []).map(e => `<div class="evidence"><div class="q">"${esc(e.statement)}"</div>
        <div class="m">said to a different person · ${e.sentDaysAgo} days ago</div></div>`).join('') || '<p class="sub">No revealable statements found for this flag.</p>'}
      <div class="notice">Recipients stay permanently anonymous. This user has been notified that someone paid to escalate — not who.</div>
      <button class="btn" onclick="closeModal()">Close</button>`);
  } catch (e) { toast(e.message); }
}

async function addIncognito(userId) {
  try {
    await api('/me/incognito/' + userId, { method: 'POST' });
    toast('Done — they can no longer see your profile in Discover.');
  } catch (e) { toast(e.message); }
}

async function blockUser(userId) {
  if (!confirm('Block this user? They will disappear from your app and you from theirs. They are not notified. You can unblock from Settings.')) return;
  try {
    await api('/me/block/' + userId, { method: 'POST' });
    toast('Blocked.');
    nav('#/discover');
  } catch (e) { toast(e.message); }
}

function openReport(userId) {
  openModal(`
    <h2 style="margin-top:0">Report this user</h2>
    <p class="sub">Reviewed by a human within 24 hours.</p>
    <div class="field"><label>Category</label><select id="rep-cat">
      <option value="harassment">Harassment</option><option value="fake_profile">Fake profile</option>
      <option value="scam">Scam / money request</option><option value="underage">Underage</option>
      <option value="hate_speech">Hate speech</option><option value="non_consensual_image">Non-consensual image</option>
      <option value="other">Other</option></select></div>
    <div class="field"><label>What happened?</label><textarea id="rep-desc" rows="4" placeholder="Describe what happened (min 10 characters)"></textarea></div>
    <button class="btn" onclick="sendReport('${userId}')">Submit report</button>`);
}

async function sendReport(userId) {
  try {
    await api('/report', { method: 'POST', body: {
      reportedUserId: userId, category: $('#rep-cat').value, description: $('#rep-desc').value.trim()
    }});
    closeModal();
    toast('Report submitted. Our safety team reviews within 24 hours.');
  } catch (e) { toast(e.message); }
}

// ---------------- Chats ----------------
async function renderChats() {
  screen.innerHTML = `${headerBar()}<div id="chat-list"><div class="empty">Loading chats…</div></div>`;
  loadNotifCount();
  try {
    const r = await api('/chat');
    const list = $('#chat-list');
    if (!r.chats.length) {
      list.innerHTML = `<div class="empty"><div class="big" style="color:var(--sand-mid)">${ic('message', 'ic-xl')}</div>No conversations yet.<br>Find someone in Discover and say hi.</div>`;
      return;
    }
    list.innerHTML = r.chats.map(c => `
      <div class="chat-item" onclick="nav('#/chat/${c.chatId}')">
        <div class="avatar ${c.other.anonymous ? 'anon' : ''}">${c.other.anonymous ? ic('ghost', 'ic-lg') : c.other.photo ? `<img src="${esc(c.other.photo)}" data-i="${esc((c.other.displayName || '?')[0])}" onerror="imgFail(this)"/>` : esc((c.other.displayName || '?')[0].toUpperCase())}</div>
        <div class="cbody">
          <div class="cname"><span class="ic-row">${esc(c.other.displayName || 'Anonymous')}${c.anonymous ? ic('ghost') : ''}</span><time>${c.lastMessage ? timeAgo(c.lastMessage.createdAt) : ''}</time></div>
          <div class="clast" ${c.unreadCount ? 'style="font-weight:700;color:var(--ink)"' : ''}>${esc(c.lastMessage?.text || 'Say hi')}</div>
        </div>
        ${c.unreadCount ? `<span style="background:var(--sindoor);color:#fff;font-size:11px;font-weight:700;min-width:20px;height:20px;line-height:20px;border-radius:10px;text-align:center;padding:0 4px">${c.unreadCount > 9 ? '9+' : c.unreadCount}</span>` : ''}
      </div>`).join('');
  } catch (e) { $('#chat-list').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}

let currentChat = null;

async function renderChat(chatId) {
  currentChat = chatId;
  screen.innerHTML = `<div class="chat-screen">
    <div class="chat-head">
      <button class="back" onclick="nav('#/chats')">←</button>
      <div class="avatar" id="ch-avatar" style="width:36px;height:36px;font-size:14px">…</div>
      <div class="who"><b id="ch-name">Loading…</b><small id="ch-sub"></small></div>
      <button id="ch-reveal" class="ic-row" style="display:none;background:none;border:1px solid var(--anon);color:var(--anon);border-radius:8px;padding:5px 10px;font-size:11.5px;font-weight:600;cursor:pointer" onclick="requestReveal('${chatId}')">${ic('ghost')} Reveal</button>
    </div>
    <div class="chat-msgs" id="msgs"></div>
    <div class="typing" id="typing-line"></div>
    <div class="chat-input">
      <input id="msg-input" placeholder="Type a message…" maxlength="5000"
        onkeydown="if(event.key==='Enter')sendMsg('${chatId}')" oninput="emitTyping('${chatId}')"/>
      <button onclick="sendMsg('${chatId}')" style="display:flex;align-items:center;justify-content:center">${ic('send', 'ic-lg')}</button>
    </div>
  </div>`;

  try {
    // chat meta comes from the chat list endpoint
    const all = await api('/chat');
    const meta = all.chats.find(c => c.chatId === chatId);
    if (meta) {
      $('#ch-name').textContent = meta.other.displayName || 'Anonymous';
      $('#ch-sub').textContent = (meta.anonymous ? 'identity hidden · ' : 'verified · ') + (meta.intent || '');
      $('#ch-avatar').innerHTML = meta.other.anonymous ? ic('ghost') : meta.other.photo ? `<img src="${esc(meta.other.photo)}" data-i="${esc((meta.other.displayName || '?')[0])}" onerror="imgFail(this)"/>` : esc((meta.other.displayName || '?')[0].toUpperCase());
      if (meta.anonymous) $('#ch-reveal').style.display = 'inline-flex';
    }
    const r = await api(`/chat/${chatId}/messages`);
    const msgs = $('#msgs');
    msgs.innerHTML = `<div class="bubble sys">You're chatting. Your conduct shapes your Lakshan score.</div>`;
    r.messages.forEach(appendMessage);
    if (S.socket) S.socket.emit('join_chat', { chatId });
  } catch (e) { toast(e.message); }
}

function appendMessage(m) {
  const msgs = $('#msgs');
  if (!msgs) return;
  const mine = m.from === S.user?._id;
  const div = document.createElement('div');
  div.className = 'bubble ' + (m.type === 'system' ? 'sys' : mine ? 'me' : 'them');
  div.innerHTML = esc(m.text) + (m.type !== 'system' ? `<time>${new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>` : '');
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

async function sendMsg(chatId) {
  const input = $('#msg-input');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  const sendViaRest = async () => {
    const r = await api(`/chat/${chatId}/messages`, { method: 'POST', body: { text } });
    appendMessage(r.message);
  };
  try {
    if (S.socket?.connected) {
      S.socket.emit('send_message', { chatId, text }, ack => {
        if (ack?.error) toast(ack.error);
      });
    } else {
      await sendViaRest();
    }
  } catch (e) { toast(e.message); }
}

let typingThrottle = 0;
function emitTyping(chatId) {
  if (Date.now() - typingThrottle < 1500) return;
  typingThrottle = Date.now();
  S.socket?.emit('typing', { chatId });
}

async function requestReveal(chatId) {
  if (!confirm('Request to reveal identities? Both of you must agree — then names and photos unlock for both at once.')) return;
  try {
    const r = await api(`/chat/${chatId}/reveal`, { method: 'POST' });
    toast(r.bothRevealed ? 'Identities revealed. Say hi!' : 'Reveal requested — waiting for them to agree (48h).');
    if (r.bothRevealed) renderChat(chatId);
  } catch (e) { toast(e.message); }
}

// ---------------- My Karma ----------------
async function renderKarma() {
  screen.innerHTML = `${headerBar()}<div class="section-pad"><div class="empty">Loading your Lakshan Book…</div></div>`;
  loadNotifCount();
  try {
    const [k, me] = await Promise.all([api('/karma/me'), api('/auth/me')]);
    S.user = me.user;
    const rep = await fetch('/api/discover/profile/' + S.user._id, { headers: { Authorization: 'Bearer ' + S.token } }).then(r => r.json()).catch(() => null);
    const issues = (k.lies?.length || 0) + (k.contradictions?.length || 0) + (k.manipulationFlags?.length || 0);
    screen.querySelector('.section-pad').innerHTML = `
      <h1>My Lakshan Book</h1>
      <p class="sub">What the honesty engine sees. Only repeat patterns become visible to matches.</p>
      <div class="karma-hero ${gradeClass(k.score)}">
        <b>${k.score}</b><span>Grade ${scoreGrade(k.score)} · ${issues === 0 ? 'Clean record' : issues + ' recorded signal' + (issues > 1 ? 's' : '')}</span>
      </div>
      ${rep?.traitScores ? `<div class="card">
        <b style="font-size:11px;color:var(--ink-soft);text-transform:uppercase;letter-spacing:.05em">Trait scores</b>
        ${['respect','responsive','depth','humor','directness'].map(t => trait(t, rep.traitScores[t])).join('')}
      </div>` : ''}
      ${rep?.tagsPositive?.length ? `<div class="card"><b style="font-size:11px;color:var(--ink-soft);text-transform:uppercase;letter-spacing:.05em">Your tags</b><div class="mt" style="margin-top:8px">${rep.tagsPositive.map(t => `<span class="tag forest">${esc(t)}</span>`).join('')}</div></div>` : ''}
      ${k.lies?.length ? section('Fact-check flags', k.lies.map((l, i) => flagRow(l.reason, l.severity, l.recordedAt, 'lie', l.recordedAt || 'lie-' + i))) : ''}
      ${k.contradictions?.length ? section('Contradictions', k.contradictions.map((c, i) => flagRow(c.reason, c.severity, c.recordedAt, 'contradiction', c.recordedAt || 'con-' + i))) : ''}
      ${k.manipulationFlags?.length ? section('Pattern flags', k.manipulationFlags.map((m, i) => flagRow(m.pattern + ': ' + (m.evidence || ''), m.confidence, m.recordedAt, 'manipulation', m.recordedAt || 'man-' + i))) : ''}
      ${issues === 0 ? `<div class="notice forest">✓ Nothing on record. Keep being straight with people — 30 clean days adds +1 to your score.</div>` : `<div class="notice">Disagree with a flag? Dispute it — a human reviews within 7 days.</div>`}
      <div class="card" style="font-size:13px">
        <b style="font-size:11px;color:var(--ink-soft);text-transform:uppercase;letter-spacing:.05em">My activity — what matches can see</b>
        <div class="kv"><span>Active chats</span><b>${k.activity?.activeChats ?? 0}</b></div>
        <div class="kv"><span>New chats this week</span><b>${k.activity?.newChats7d ?? 0}</b></div>
        <div class="kv"><span>Exclusivity claims / 30d</span><b>${k.activity?.exclusivityClaimedToCount ?? 0}</b></div>
      </div>`;
  } catch (e) { screen.querySelector('.section-pad').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}

function scoreGrade(s) {
  return s >= 95 ? 'A+' : s >= 90 ? 'A' : s >= 85 ? 'A-' : s >= 80 ? 'B+' : s >= 70 ? 'B' : s >= 60 ? 'C' : s >= 40 ? 'D' : 'F';
}
function trait(name, val) {
  if (val == null) return '';
  return `<div class="trait"><span class="tl" style="text-transform:capitalize">${name}</span>
    <span class="bar"><i style="width:${val * 10}%"></i></span><span class="tv">${(+val).toFixed(1)}</span></div>`;
}
function section(title, rows) {
  return `<h2>${title}</h2>${rows.join('')}`;
}
function flagRow(text, severity, when, category, flagId) {
  return `<div class="flag-card"><div class="ft">${esc(severity || '')} severity · ${when ? timeAgo(when) + ' ago' : ''}</div>
    <div class="fd">${esc(text)}</div>
    ${category ? `<button class="btn small mt secondary" onclick="disputeFlag('${category}','${esc(String(flagId))}')">Dispute this flag</button>` : ''}</div>`;
}

// Files a real dispute (POST /karma/dispute) — a moderator reviews within 7 days.
async function disputeFlag(category, flagId) {
  const reason = await askInput({
    title: 'Dispute this flag',
    hint: 'A moderator reviews every dispute within 7 days.',
    label: 'Why is this flag wrong?',
    placeholder: 'Tell us what actually happened — at least 20 characters.',
    multiline: true,
    minLength: 20,
    okText: 'File dispute'
  });
  if (!reason) return;                               // cancelled
  try {
    await api('/karma/dispute', { method: 'POST', body: { flagCategory: category, flagId: String(flagId), reason: reason.trim() } });
    toast('Dispute filed — a moderator reviews within 7 days.');
  } catch (e) { toast(e.message); }
}

// ---------------- Compatibility ----------------
async function renderCompat(userId) {
  screen.innerHTML = `<div class="section-pad">
    <button class="btn ghost" style="text-align:left;padding-left:0" onclick="history.back()">← Back</button>
    <h1>Compatibility</h1><div id="compat-body"><div class="empty">Computing…</div></div></div>`;
  try {
    const [c, intel, conn] = await Promise.all([
      api('/compat/' + userId),
      api('/compat/' + userId + '/intelligence').catch(() => null),
      api('/compat/' + userId + '/connection').catch(() => null)
    ]);
    const connHtml = (conn && conn.label) ? `<div class="card" style="background:var(--rose-soft);border-color:var(--rose)">
        <b class="ic-row">${ic('users') || ic('sparkle')} How you're connected</b>
        <p style="margin:6px 0 0;font-size:13.5px">${esc(conn.label)}.</p></div>` : '';
    const a = c.astrology, e = c.engagement;
    const COMP_LABEL = {
      vedic: 'Vedic astrology', yoni: 'Intimate nature (Yoni)', gana: 'Temperament (Gana)',
      attachment: 'Emotional styles', bigfive: 'Personality (OCEAN)', love: 'Love languages',
      engagement: 'Conversation rhythm', karma: 'Trust & Lakshan'
    };
    const bar = pct => `<div style="height:7px;background:rgba(0,0,0,.07);border-radius:99px;margin:3px 0 9px;overflow:hidden"><i style="display:block;height:100%;width:${pct}%;background:linear-gradient(90deg,var(--sindoor),var(--haldi))"></i></div>`;
    const intelHtml = intel ? `
      <div class="karma-hero ${intel.score >= 65 ? 'good' : intel.score >= 40 ? '' : 'bad'}">
        <b>${intel.score}%</b><span>${esc(intel.verdict)}</span></div>
      <div class="card">
        <h2 style="margin-top:0" class="ic-row">${ic('sparkle')} Deep compatibility</h2>
        <p class="hint" style="margin-top:-4px;margin-bottom:10px">A blend of astrology, personality, conversation and trust — weighted by what predicts real relationships.</p>
        ${intel.components.map(cm => {
          const pct = Math.round(cm.raw * 100);
          return `<div class="kv"><span>${COMP_LABEL[cm.name] || cm.name} <i class="hint">(${Math.round(cm.weight * 100)}%)</i></span><b>${pct}%</b></div>${bar(pct)}`;
        }).join('')}
      </div>
      ${intel.signals && intel.signals.yoni ? `<div class="card">
        <h2 style="margin-top:0" class="ic-row">${ic('heart')} Intimate energy</h2>
        <div class="compat-score"><b style="color:var(--sindoor-deep)">${intel.signals.yoni.score}/4</b><span style="color:var(--sindoor)">${esc(intel.signals.yoni.label)}</span></div>
        <div class="hint">${esc((intel.signals.yoni.animals || []).join(' × '))} energies</div>
      </div>` : ''}
      ${(intel.warnings && intel.warnings.length) ? `<div class="notice danger" style="margin-bottom:14px">${intel.warnings.map(esc).join('<br>')}</div>` : ''}
      <p class="hint" style="margin:-4px 0 14px">${intel.signals && intel.signals.psychologyAvailable ? 'Personality &amp; emotional-style signals are read privately from your chat and never shown as labels.' : 'Chat a little to unlock the personality &amp; emotional-style signals.'}</p>
    ` : '';
    $('#compat-body').innerHTML = `
      ${connHtml}
      ${intelHtml || (c.overall != null ? `<div class="karma-hero good"><b>${c.overall}%</b><span>Overall compatibility</span></div>` : '')}
      <div class="card"><b class="ic-row">${ic('star')} Astrological match — by relationship</b>
        <div class="row" style="gap:6px;margin-top:8px;flex-wrap:wrap">
          <button class="btn secondary" style="width:auto" onclick="astroLens('${userId}','romance')">Romance</button>
          <button class="btn secondary" style="width:auto" onclick="astroLens('${userId}','friendship')">Friendship</button>
          <button class="btn secondary" style="width:auto" onclick="astroLens('${userId}','business')">Business</button>
        </div>
        <div id="lens-result" class="hint mt">Pick a lens to see your kundali compatibility for that kind of relationship.</div>
      </div>
      <div class="card">
        <h2 style="margin-top:0" class="ic-row">${ic('star')} Astrology</h2>
        ${a ? `
          <div class="compat-score"><b style="color:var(--sindoor-deep)">${a.gunaScore} / 36</b><span style="color:var(--sindoor)">${esc(a.gunaVerdict || a.verdict || '')}</span></div>
          <div class="kv"><span>Sun signs</span><b>${esc((a.sunSigns || []).join(' × '))}</b></div>
          <div class="kv"><span>Moon signs</span><b>${esc((a.moonSigns || []).join(' × '))}</b></div>
          <div class="kv"><span>Nakshatra</span><b>${esc((a.nakshatras || []).join(' × '))}</b></div>
          ${a.breakdown ? `<div class="guna-grid">${[
            ['Varna', a.breakdown.varna], ['Vashya', a.breakdown.vashya], ['Tara', a.breakdown.tara], ['Yoni', a.breakdown.yoni],
            ['Maitri', a.breakdown.grahaMaitri], ['Gana', a.breakdown.gana], ['Bhakoot', a.breakdown.bhakoot], ['Nadi', a.breakdown.nadi]
          ].map(([label, k]) => `<div class="guna-koota ${k.got === 0 ? 'zero' : k.got >= k.max ? 'full' : ''}">
              <span class="gl">${label}</span>
              <span class="gv">${k.got}<i>/${k.max}</i></span>
              <span class="gbar"><i style="width:${Math.round((k.got / k.max) * 100)}%"></i></span>
            </div>`).join('')}</div>` : ''}
          ${(a.doshas && a.doshas.length) ? `<div class="notice danger" style="margin-top:10px">${a.doshas.map(d => esc(d)).join('<br>')}</div>` : `<div class="notice forest" style="margin-top:10px">No major doshas — Nadi and Bhakoot both clear.</div>`}
          ${!a.birthTimeKnown ? `<div class="hint mt">More accurate with exact birth times for both partners (Moon changes sign every ~2.25 days).</div>` : ''}
          <div class="hint mt">Real Ashtakoot Guna Milan from computed Moon positions${a.computedVia === 'internal_sidereal_ashtakoot' ? ' (sidereal approximation; exact when ProKerala is connected)' : ''}. 18+ gunas is the traditional threshold for marriage.</div>
        ` : `<p class="sub">Add birth details in Settings (both of you) to unlock astrology compatibility.</p>`}
      </div>
      <div class="card">
        <h2 style="margin-top:0" class="ic-row">${ic('message')} Engagement</h2>
        ${e && e.overallScore != null ? `
          <div class="compat-score"><b style="color:var(--forest)">${e.overallScore}%</b><span style="color:var(--forest)">${esc(e.verdict || '')}</span></div>
          <div class="kv"><span>Conversation balance</span><b class="ok">${Math.round((e.balanceScore || 0) * 100)}%</b></div>
          <div class="kv"><span>Response time match</span><b>${esc(e.responseTimeMatch || '—')}</b></div>
          <div class="kv"><span>Humor alignment</span><b>${e.humorAlignment ?? '—'}</b></div>
          <div class="kv"><span>Depth alignment</span><b>${e.depthAlignment ?? '—'}</b></div>
          <div class="kv"><span>Messages exchanged</span><b>${e.messagesExchanged}</b></div>
        ` : `<p class="sub">Engagement compatibility unlocks after you exchange at least 10 messages${c.engagementMessages ? ` (currently ${c.engagementMessages})` : ''}. It measures how well you actually talk — balance, rhythm, humor, depth.</p>`}
      </div>`;
  } catch (e) { $('#compat-body').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}

// ---------------- Astrology ----------------
async function renderAstro() {
  screen.innerHTML = `<div class="section-pad"><h1>Astrology</h1><p class="sub">Your full kundali — computed from real astronomy, read through classical Jyotish.</p><div id="astro-body"><div class="empty">Reading the sky…</div></div></div>`;
  try {
    const [c, pan, tr] = await Promise.all([api('/astro/chart'), api('/astro/panchang').catch(() => null), api('/astro/transits').catch(() => null)]);
    const body = $('#astro-body');
    if (!c.chart) {
      body.innerHTML = `<div class="card"><b>Add your birth details</b><p class="hint" style="margin:6px 0 10px">Birth date, exact time and city unlock your planets, houses, yogas, doshas and dasha timeline.</p><button class="btn" onclick="openEditProfile()">Add birth details</button></div>`;
      return;
    }
    const ch = c.chart, P = ch.planets;
    const dign = d => d === 'exalted' ? '<span class="tag forest">exalted</span>' : d === 'debilitated' ? '<span class="tag haldi">debilitated</span>' : d === 'own sign' ? '<span class="tag rose">own</span>' : '';
    body.innerHTML = `
      ${pan && pan.panchang ? `<div class="card" style="background:linear-gradient(160deg,var(--rose-soft),#fff)"><b class="ic-row">${ic('star')} Today · Panchang</b><div class="hint" style="margin-top:4px">${esc(pan.panchang.vara)} · ${esc(pan.panchang.paksha)} ${esc(pan.panchang.tithi)} · Nakshatra ${esc(pan.panchang.nakshatra)} · Yoga ${esc(pan.panchang.yoga)} · Karana ${esc(pan.panchang.karana)}</div></div>` : ''}
      <div class="card"><div class="stat-row">
        <div class="stat"><b>${esc(ch.lagna ? ch.lagna.signName : '—')}</b><span>Lagna</span></div>
        <div class="stat"><b>${esc(ch.moonSign)}</b><span>Moon · ${esc(ch.nakshatra)}</span></div>
        <div class="stat"><b>${esc(ch.sunSign)}</b><span>Sun</span></div>
      </div>${!ch.hasBirthTime ? '<p class="hint mt">Add your exact birth time + city for the Lagna and houses.</p>' : ''}</div>
      <div class="card"><b>Planets</b><div style="overflow-x:auto"><table style="width:100%;font-size:12px;border-collapse:collapse;margin-top:8px">
        <tr style="text-align:left;color:var(--ink-soft)"><th>Planet</th><th>Sign</th><th>Ho.</th><th>D9</th><th>D10</th><th>Nakshatra</th><th></th></tr>
        ${Object.entries(P).map(([k, v]) => `<tr style="border-top:1px solid var(--sand-mid)"><td style="padding:5px 0"><b>${k}</b>${v.retrograde ? ' <span style="color:var(--haldi-deep)">℞</span>' : ''}${v.combust ? ' 🔥' : ''}</td><td>${esc(v.signName)} ${v.degInSign}°</td><td>${v.house || '—'}</td><td>${esc(v.navamsa || '—')}</td><td>${esc(v.dasamsa || '—')}</td><td>${esc(v.nakshatra)} ${v.pada}</td><td>${dign(v.dignity)}</td></tr>`).join('')}
      </table></div><p class="hint" style="margin-top:6px">D9 = Navamsa (marriage/dharma) · D10 = Dasamsa (career).</p></div>
      ${tr && tr.transits ? `<div class="card"><b class="ic-row">${ic('star')} Transits today (Gochar)</b>
        <p class="hint" style="margin:4px 0 8px">${esc(tr.transits.sadeSatiNote)}</p>
        <div style="display:flex;gap:6px;flex-wrap:wrap">${Object.entries(tr.transits.positions).map(([n, p]) => `<span class="tag plain">${n} in ${esc(p.signName)} · ${p.houseFromMoon}H from Moon</span>`).join('')}</div></div>` : ''}
      ${ch.yogas.length ? `<div class="card"><b class="ic-row">${ic('sparkle')} Yogas</b>${ch.yogas.map(y => `<div style="margin-top:8px"><b style="color:var(--forest)">${esc(y.name)}</b><div class="hint">${esc(y.detail)}</div></div>`).join('')}</div>` : ''}
      ${ch.doshas.length ? `<div class="card"><b class="ic-row">${ic('alert')} Doshas</b>${ch.doshas.map(d => `<div style="margin-top:8px"><b style="color:var(--haldi-deep)">${esc(d.name)} <span class="hint">(${esc(d.severity)})</span></b><div class="hint">${esc(d.detail)}</div></div>`).join('')}</div>` : ''}
      ${ch.dasha && ch.dasha.current ? `<div class="card"><b>Dasha timeline</b><p class="hint" style="margin:4px 0 8px">Now: <b>${esc(ch.dasha.current.lord)}</b>${ch.dasha.current.antardasha ? ' / ' + esc(ch.dasha.current.antardasha.lord) : ''} — until ${esc(ch.dasha.current.end)}</p><div style="display:flex;gap:6px;flex-wrap:wrap">${ch.dasha.periods.map(p => `<span class="tag ${p.lord === ch.dasha.current.lord ? 'forest' : 'plain'}">${esc(p.lord)} ${p.start.slice(0, 4)}–${p.end.slice(0, 4)}</span>`).join('')}</div></div>` : ''}
      ${c.numerology ? `<div class="card"><b>Numerology</b><div class="hint" style="margin-top:4px">Life Path ${c.numerology.lifePath ?? '—'} · Destiny ${c.numerology.destiny ?? '—'} · Soul ${c.numerology.soul ?? '—'} · Personality ${c.numerology.personality ?? '—'}</div></div>` : ''}
      <div class="card"><b class="ic-row">${ic('sparkle')} Ask your chart</b>
        <div id="astro-chat" style="margin:8px 0;display:flex;flex-direction:column;gap:8px"></div>
        <div class="row" style="gap:8px"><input id="astro-q" placeholder="Is this a good year for a new venture?" style="flex:1" onkeydown="if(event.key==='Enter')askAstro()"/><button class="btn" style="width:auto" onclick="askAstro()">Ask</button></div>
        <p class="hint mt">Traditional interpretation from your computed chart — not professional advice.</p></div>`;
  } catch (e) { const b = $('#astro-body'); if (b) b.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}
async function askAstro() {
  const inp = $('#astro-q'); const q = (inp.value || '').trim(); if (!q) return;
  const box = $('#astro-chat'); inp.value = '';
  box.insertAdjacentHTML('beforeend', `<div style="align-self:flex-end;background:var(--sindoor);color:#fff;padding:8px 12px;border-radius:14px;max-width:85%">${esc(q)}</div>`);
  box.insertAdjacentHTML('beforeend', '<div id="astro-thinking" class="hint">reading your chart…</div>');
  try {
    const r = await api('/astro/ask', { method: 'POST', body: { question: q } });
    document.getElementById('astro-thinking')?.remove();
    box.insertAdjacentHTML('beforeend', `<div style="align-self:flex-start;background:var(--sand);padding:8px 12px;border-radius:14px;max-width:90%">${esc(r.answer)}<div class="hint" style="margin-top:4px">${esc(r.source || '')}</div></div>`);
  } catch (e) { document.getElementById('astro-thinking')?.remove(); toast(e.message); }
}
async function astroLens(userId, type) {
  const el = document.getElementById('lens-result'); if (el) el.innerHTML = 'Reading both charts…';
  try {
    const r = await api(`/astro/compat/${userId}?type=${type}`);
    if (!r.compat) { if (el) el.innerHTML = 'Both of you need birth details (date, time, city) for this.'; return; }
    const c = r.compat;
    el.innerHTML = `<div style="font-family:Georgia,serif;font-size:22px;color:var(--sindoor-deep);margin-bottom:6px">${c.score}% · ${esc(c.verdict)} <span class="hint" style="font-size:12px">for ${esc(type)}</span></div>
      ${c.factors.map(f => `<div class="kv"><span>${esc(f.note)} <i class="hint">(${f.weight}%)</i></span><b>${f.score}%</b></div>`).join('')}`;
  } catch (e) { if (el) el.innerHTML = esc(e.message); }
}

// ---------------- Community (anonymous rooms) ----------------
async function renderCommunity() {
  screen.innerHTML = `<div class="section-pad"><h1>Community</h1>
    <p class="sub">Open, anonymous rooms — friends, professionals, everyone. You post under a room nickname; your identity stays private.</p>
    <div class="row" style="gap:8px;margin-bottom:12px"><button class="btn" style="width:auto" onclick="toggleRoomForm()">+ Create room</button><button class="btn secondary" style="width:auto" onclick="promptJoinCode()">Join by code</button></div>
    <div id="room-form"></div>
    <div id="room-list"><div class="empty">Loading rooms…</div></div></div>`;
  try {
    const r = await api('/community/rooms');
    const el = $('#room-list');
    if (!r.rooms.length) { el.innerHTML = '<div class="empty">No rooms yet — create the first one.</div>'; return; }
    el.innerHTML = r.rooms.map(rm => `<div class="card" style="cursor:pointer" onclick="nav('#/room/${rm.slug}')">
      <div class="row" style="justify-content:space-between;align-items:flex-start">
        <div><b style="font-size:16px">${rm.visibility === 'private' ? '🔒 ' : ''}${rm.icon || '💬'} ${esc(rm.name)}</b><div class="hint">${esc(rm.description || rm.topic || '')}</div>
          <div class="hint" style="margin-top:4px">${rm.memberCount} member${rm.memberCount === 1 ? '' : 's'} · ${rm.messageCount} message${rm.messageCount === 1 ? '' : 's'}${rm.code ? ' · code: <b>' + esc(rm.code) + '</b>' : ''}</div></div>
        <span class="tag ${rm.joined ? 'forest' : 'plain'}">${rm.joined ? 'joined' : esc(rm.visibility === 'private' ? 'private' : rm.category)}</span>
      </div></div>`).join('');
  } catch (e) { const el = $('#room-list'); if (el) el.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}
function toggleRoomForm() {
  const el = $('#room-form'); if (!el) return;
  if (el.innerHTML) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="card">
    <div class="field"><label>Room name</label><input id="nr-name" placeholder="e.g. Delhi Foodies" maxlength="60"/></div>
    <div class="field"><label>Description</label><input id="nr-desc" placeholder="What's it about?" maxlength="200"/></div>
    <div class="field"><label>Visibility</label><select id="nr-vis"><option value="public">Public — anyone can find &amp; join</option><option value="private">Private — invite code only</option></select></div>
    <button class="btn" onclick="createRoom()">Create room</button></div>`;
}
async function createRoom() {
  const name = ($('#nr-name').value || '').trim();
  if (name.length < 3) return toast('Room name must be at least 3 characters.');
  try {
    const r = await api('/community/rooms', { method: 'POST', body: { name, description: ($('#nr-desc').value || '').trim(), visibility: $('#nr-vis').value } });
    toast(r.visibility === 'private' ? 'Private room created — invite code: ' + r.code : 'Room created ✓');
    nav('#/room/' + r.slug);
  } catch (e) { toast(e.message); }
}
async function promptJoinCode() {
  const code = await askInput({
    title: 'Join a private room',
    hint: 'Enter the invite code you were given.',
    label: 'Invite code',
    placeholder: 'e.g. 7QK2ZP',
    okText: 'Join'
  });
  if (!code) return;
  try { const r = await api('/community/join-by-code', { method: 'POST', body: { code: code.trim() } }); toast('Joined ' + r.name + ' ✓'); nav('#/room/' + r.slug); }
  catch (e) { toast(e.message); }
}
async function renderRoom(slug) {
  if (S._room && S._room.timer) clearInterval(S._room.timer);
  screen.innerHTML = `<div class="app-header"><button class="back" style="background:none;border:none;font-size:22px;cursor:pointer" onclick="nav('#/community')">←</button><div style="flex:1;padding-left:8px"><b id="room-title">Room</b><div class="hint" id="room-sub"></div></div></div>
    <div id="room-msgs" style="padding:12px 14px 92px;display:flex;flex-direction:column;gap:8px"><div class="empty">Loading…</div></div>
    <div style="position:fixed;bottom:0;left:0;right:0;background:#fff;border-top:1px solid var(--sand-mid);padding:10px 12px;display:flex;gap:8px;max-width:640px;margin:0 auto">
      <input id="room-input" placeholder="Say something…" style="flex:1" onkeydown="if(event.key==='Enter')postRoom('${slug}')"/><button class="btn" style="width:auto" onclick="postRoom('${slug}')">Send</button></div>`;
  S._room = { slug, last: null, timer: null };
  await loadRoom(slug, true);
  S._room.timer = setInterval(() => { if (location.hash === '#/room/' + slug) loadRoom(slug, false); else if (S._room) clearInterval(S._room.timer); }, 4000);
}
async function loadRoom(slug, initial) {
  try {
    const after = (!initial && S._room && S._room.last) ? `?after=${encodeURIComponent(S._room.last)}` : '';
    const r = await api(`/community/rooms/${slug}/messages${after}`);
    const box = $('#room-msgs'); if (!box) return;
    if (initial) { $('#room-title').textContent = r.room.name; $('#room-sub').textContent = `${r.room.memberCount} members · you are ${r.myHandle}`; box.innerHTML = r.messages.length ? '' : '<div class="empty">Be the first to say hi 👋</div>'; }
    for (const m of r.messages) {
      const q = box.querySelector('.empty'); if (q) q.remove();
      box.insertAdjacentHTML('beforeend', `<div style="align-self:${m.mine ? 'flex-end' : 'flex-start'};max-width:85%"><div class="hint" style="margin:0 4px 2px">${esc(m.handle)}</div><div style="background:${m.mine ? 'var(--sindoor)' : 'var(--sand)'};color:${m.mine ? '#fff' : 'inherit'};padding:8px 12px;border-radius:14px">${esc(m.text)}</div></div>`);
      if (S._room) S._room.last = m.createdAt;
    }
    if (r.messages.length) window.scrollTo(0, document.body.scrollHeight);
  } catch (e) { if (initial) { const b = $('#room-msgs'); if (b) b.innerHTML = `<div class="empty">${esc(e.message)}</div>`; } }
}
async function postRoom(slug) {
  const inp = $('#room-input'); const t = (inp.value || '').trim(); if (!t) return; inp.value = '';
  try { await api(`/community/rooms/${slug}/messages`, { method: 'POST', body: { text: t } }); await loadRoom(slug, false); }
  catch (e) { toast(e.message); }
}

// ---------------- Notifications ----------------
async function renderNotifications() {
  screen.innerHTML = `${headerBar()}<div class="section-pad"><h1>Notifications</h1><div id="notif-list"></div></div>`;
  try {
    const r = await api('/notifications');
    const list = $('#notif-list');
    if (!r.notifications.length) {
      list.innerHTML = `<div class="empty"><div class="big" style="color:var(--sand-mid)">${ic('bell', 'ic-xl')}</div>Nothing yet.</div>`;
      return;
    }
    list.innerHTML = r.notifications.map(n => `
      <div class="card" style="${n.read ? 'opacity:0.65' : ''};cursor:pointer" onclick="markRead('${n._id}', this)">
        <b style="font-size:14px" class="ic-row"><span style="color:${n.severity === 'critical' ? 'var(--danger)' : n.severity === 'warning' ? 'var(--haldi-deep)' : 'var(--forest)'};display:inline-flex">${ic(n.severity === 'info' ? 'info' : 'alert')}</span> ${esc(n.title)}</b>
        <p style="font-size:13px;color:var(--ink-mid);margin:4px 0 0">${esc(n.body)}</p>
        <div class="hint">${timeAgo(n.createdAt)} ago</div>
      </div>`).join('');
  } catch (e) { $('#notif-list').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}

async function markRead(id, el) {
  el.style.opacity = 0.65;
  try { await api(`/notifications/${id}/read`, { method: 'PATCH' }); } catch { /* ignore */ }
}

// ---------------- Settings ----------------
async function renderSettings() {
  screen.innerHTML = `${headerBar()}<div class="section-pad"><div class="empty">Loading…</div></div>`;
  loadNotifCount();
  try {
    S.user = (await api('/auth/me')).user;
    const u = S.user;
    const p = u.preferences || {};
    const photo = u.profile?.photos?.find(x => x.isPrimary)?.url || u.profile?.photos?.[0]?.url;
    screen.querySelector('.section-pad').innerHTML = `
      <div style="display:flex;gap:14px;align-items:center;margin-bottom:16px">
        <div class="avatar" style="width:64px;height:64px;font-size:26px">${photo ? `<img src="${esc(photo)}" data-i="${esc((u.profile?.firstName || '?')[0])}" onerror="imgFail(this)"/>` : esc((u.profile?.firstName || '?')[0])}</div>
        <div><b style="font-size:18px">${esc(u.profile?.firstName || '')}, ${u.profile?.age || ''}</b>
          <div style="font-size:12px;color:var(--forest)">${verLabel(u.verification)} · Trust ${u.verification?.trustScore || 0}/100</div>
          <div style="font-size:12px;color:var(--ink-soft)">${esc(u.profile?.city || '')} · ${(u.intent || []).join(', ')}</div>
        </div>
      </div>
      <button class="btn secondary ic-row" style="display:flex;justify-content:center" onclick="openEditProfile()">${ic('edit')} Edit profile & photos</button>

      <div id="me-nakshatra"></div>
      <div id="me-rhythm"></div>
      <div id="me-network"></div>
      <div id="me-nature"></div>

      <h2>Membership</h2>
      ${tierCards(u)}

      <h2>Security</h2>
      <div class="card" id="twofa-card"><div class="setting-row"><span class="ic-row">${ic('lock')} Two-factor authentication</span><span class="hint">Loading…</span></div></div>

      <h2>Privacy</h2>
      <div class="card">
        ${settingSwitch('anonymousModeEnabled', 'Anonymous mode', p.anonymousModeEnabled)}
        ${settingSwitch('showProfessionToOthers', 'Show profession', p.showProfessionToOthers !== false)}
        ${settingSwitch('showAstrologyToOthers', 'Show astrology', p.showAstrologyToOthers !== false)}
        ${settingSwitch('allowNSFWChats', 'Allow NSFW chats', p.allowNSFWChats)}
        ${settingSwitch('aiTrainingConsent', 'Help improve matching (use my anonymised swipes to train Sambandh\'s own model — no names or messages)', p.aiTrainingConsent)}
        <div class="setting-row" style="cursor:pointer" onclick="showIncognito()"><span class="ic-row">${ic('eyeOff')} Incognito — hide me from specific people</span><span>→</span></div>
      </div>

      <h2>Notifications</h2>
      <div class="card">
        ${notifPrefRow('new_match', 'New match', p.notificationPrefs?.new_match)}
        ${notifPrefRow('new_message', 'New message', p.notificationPrefs?.new_message)}
        ${notifPrefRow('message_while_away', 'Message while away', p.notificationPrefs?.message_while_away)}
        ${notifPrefRow('verification', 'Verification updates', p.notificationPrefs?.verification)}
        ${notifPrefRow('system', 'System alerts', p.notificationPrefs?.system)}
        <div class="setting-row"><span>Lakshan Book updates</span><span class="tag forest">always on</span></div>
      </div>

      <h2>Account</h2>
      <div class="card">
        <div class="setting-row" style="cursor:pointer" onclick="showBlocked()"><span class="ic-row">${ic('slash')} Blocked users</span><span>→</span></div>
        <div class="setting-row" style="cursor:pointer" onclick="downloadData()"><span class="ic-row">${ic('download')} Download my data (JSON)</span><span>→</span></div>
        <div class="setting-row" style="cursor:pointer" onclick="showPayments()"><span class="ic-row">${ic('card')} Payment history</span><span>→</span></div>
        <div class="setting-row" style="cursor:pointer" onclick="pauseAccount()"><span class="ic-row">${ic('pause')} ${u.status?.active ? 'Pause my account' : 'Unpause my account'}</span><span>→</span></div>
        <div class="setting-row" style="cursor:pointer" onclick="doLogout()"><span class="ic-row">${ic('logout')} Log out</span><span>→</span></div>
      </div>
      <button class="btn danger" onclick="deleteAccount()">Delete account — erased within 30 days</button>
      <p class="hint center mt">Sambandh · verified, honest dating · Grievances: grievance@sambandh.in</p>
      <p class="hint center" style="opacity:.6;margin-top:4px">A product of AIHuA</p>`;
    load2FA();
    loadMyNakshatra();
    loadRhythm();
    loadNetwork();
    loadNature(u);
  } catch (e) { screen.querySelector('.section-pad').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}

// "Your nature profile" — the self-declare features (Samudrika) + the plain-language
// reading they unlock. Self-described only; every field optional and removable.
// The reading is always labelled as a READING (never "verified").
const NATURE_FIELDS = [
  ['build', 'Your build', [['solid', 'Solid and grounded'], ['lean', 'Lean and restless'], ['balanced', 'Balanced'], ['sturdy', 'Sturdy and strong']]],
  ['gait', 'How you walk / carry yourself', [['fast', 'Quick and busy'], ['measured', 'Steady and unhurried'], ['light', 'Light and easy'], ['firm', 'Firm and planted']]],
  ['voice', 'Your voice', [['deep', 'Deep, people settle when you speak'], ['quick', 'Quick, mind ahead of the room'], ['soft', 'Soft and calming'], ['clear', 'Clear and direct']]],
  ['eyes', 'Your eyes', [['large', 'Open, easy to read'], ['sharp', 'Sharp, you notice everything'], ['soft', 'Soft, you put people at ease'], ['deepset', 'Watchful, you let people in slowly']]],
  ['forehead', 'Your forehead', [['broad', 'Broad'], ['high', 'High'], ['narrow', 'Narrow'], ['even', 'Even']]],
  ['hands', 'Your hands', [['long', 'Long'], ['broad', 'Broad and practical'], ['fine', 'Fine, detail-noticing'], ['square', 'Square and reliable']]]
];

async function loadNature(u) {
  const el = $('#me-nature'); if (!el) return;
  const f = (u && u.features) || {};
  const opts = (field, plain) => plain.map(([v, label]) => `<option value="${v}" ${f[field] === v ? 'selected' : ''}>${esc(label)}</option>`).join('');
  const selectors = NATURE_FIELDS.map(([field, q, plain]) => `
    <label style="display:block;margin-bottom:10px">
      <span class="hint" style="display:block;margin-bottom:3px">${esc(q)}</span>
      <select id="nat-${field}" style="width:100%">
        <option value="">—</option>${opts(field, plain)}
      </select>
    </label>`).join('');
  el.innerHTML = `
    <div class="card" style="margin-top:14px">
      <div class="ic-row" style="color:var(--forest);font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">${ic('sparkle') || ''} Your nature profile</div>
      <p class="hint" style="margin-top:6px">Tell us about yourself in your own words — we use it to read your nature. Self-described, stored to your profile, editable or removable any time. Every field is optional.</p>
      <div style="margin-top:10px">${selectors}</div>
      <div class="row" style="gap:8px">
        <button class="btn" onclick="saveNature()">Save &amp; read me</button>
        ${Object.keys(f).length ? '<button class="btn secondary" onclick="removeNature()">Remove</button>' : ''}
      </div>
      <div id="nature-reading" style="margin-top:12px"></div>
    </div>`;
  renderNatureReading();
}

// Fetch and render the user's own plain-language reading, each card badged as a
// READING (never verified).
async function renderNatureReading() {
  const box = $('#nature-reading'); if (!box) return;
  try {
    const r = await api('/reading/me');
    const rd = r.reading || {};
    // Same shared reading-cards renderer used on other users' profiles.
    box.innerHTML = readingCardsHtml([
      ['Who you are', rd.who_you_are && rd.who_you_are.answer],
      ['Your pattern', rd.your_pattern && rd.your_pattern.answer],
      ['Your person', rd.your_person && rd.your_person.answer],
      ['Your timing', rd.your_timing && rd.your_timing.answer]
    ]);
  } catch { box.innerHTML = ''; }
}

async function saveNature() {
  const features = {};
  for (const [field] of NATURE_FIELDS) { const v = $('#nat-' + field) && $('#nat-' + field).value; if (v) features[field] = v; }
  try {
    await api('/auth/profile', { method: 'PATCH', body: { languages: (S.user?.profile?.languages || ['english']), features } });
    if (S.user) S.user.features = features;
    toast('Saved — here\'s what we read about you ✦');
    renderNatureReading();
    const rm = document.querySelector('#me-nature .btn.secondary'); if (!rm && Object.keys(features).length) loadNature(S.user);
  } catch (e) { toast(e.message); }
}

async function removeNature() {
  try {
    await api('/auth/profile', { method: 'PATCH', body: { languages: (S.user?.profile?.languages || ['english']), features: null } });
    if (S.user) S.user.features = {};
    toast('Nature profile removed.');
    loadNature(S.user);
  } catch (e) { toast(e.message); }
}

// Your relationship graph — connections, communities, and friend-of-friend
// suggestions (services/world-graph.js). Quiet until you have a connection.
async function loadNetwork() {
  const el = $('#me-network'); if (!el) return;
  try {
    const n = await api('/me/network');
    if (!n || (!n.connections && !(n.communities || []).length)) return;  // nothing to show yet
    const pymk = (n.peopleYouMayKnow || []).length;
    el.innerHTML = `
      <div class="card" style="margin-top:14px">
        <div class="ic-row" style="color:var(--forest);font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">${ic('users') || ic('sparkle')} Your network</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
          <span class="wtag" style="background:var(--rose-soft)">${n.connections} connection${n.connections === 1 ? '' : 's'}</span>
          ${(n.communities || []).length ? `<span class="wtag" style="background:var(--rose-soft)">${n.communities.length} communit${n.communities.length === 1 ? 'y' : 'ies'}</span>` : ''}
          ${pymk ? `<span class="wtag" style="background:var(--rose-soft)">${pymk} ${pymk === 1 ? 'person' : 'people'} you may know</span>` : ''}
        </div>
        ${(n.communities || []).length ? `<p class="hint" style="margin-top:8px">In: ${n.communities.map(c => esc(c.title || c.slug)).join(' · ')}</p>` : ''}
      </div>`;
  } catch { /* network card is a nicety — never break settings */ }
}

// Your behavioural rhythm — activity, drift and habits derived live from your own
// event stream (services/behavior-engine.js). Only shows once there's enough signal.
async function loadRhythm() {
  const el = $('#me-rhythm'); if (!el) return;
  try {
    const r = await api('/me/behavior');
    const rep = r.report;
    if (!rep || !rep.available || !r.insights?.length) return;   // stay quiet with no data
    const arrow = rep.drift.direction === 'rising' ? '↗' : rep.drift.direction === 'declining' ? '↘' : '→';
    el.innerHTML = `
      <div class="card" style="margin-top:14px">
        <div class="ic-row" style="color:var(--forest);font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">${ic('sparkle')} Your rhythm</div>
        <ul style="margin:8px 0 10px;padding-left:18px;font-size:13.5px;line-height:1.5">
          ${r.insights.map(s => `<li>${esc(s)}</li>`).join('')}
        </ul>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <span class="wtag" style="background:var(--rose-soft)">${rep.events} events</span>
          <span class="wtag" style="background:var(--rose-soft)">engagement ${arrow} ${esc(rep.drift.direction)}</span>
          <span class="wtag" style="background:var(--rose-soft)">${esc(rep.consistency.label)}</span>
          ${rep.habits.dailyHabit ? '<span class="wtag" style="background:var(--rose-soft)">daily habit</span>' : ''}
        </div>
        <p class="hint" style="margin-top:8px;opacity:.7">Derived live from your activity — never a fixed label.</p>
      </div>`;
  } catch { /* rhythm is a nicety — never break settings */ }
}

// Your own nakshatra personality profile (Sambandh Intelligence System §4.3).
async function loadMyNakshatra() {
  const el = $('#me-nakshatra'); if (!el) return;
  try {
    const r = await api('/me/nakshatra');
    if (!r.profile) {
      el.innerHTML = `<div class="card" style="margin-top:14px">
        <b class="ic-row">${ic('sparkle')} Your personality profile</b>
        <p class="hint" style="margin:6px 0 10px">Add your birth date, time and city to unlock your nakshatra personality and deeper astrological matching.</p>
        <button class="btn secondary" onclick="openEditProfile()">Add birth details</button></div>`;
      return;
    }
    const n = r.profile;
    const chip = (label, val) => val ? `<span class="wtag" style="background:var(--rose-soft);color:var(--sindoor-deep)">${esc(label)}: ${esc(val)}</span>` : '';
    el.innerHTML = `
      <div class="card nak-card" style="margin-top:14px;background:linear-gradient(160deg,var(--rose-soft),#fff);border-color:var(--rose)">
        <div class="ic-row" style="color:var(--sindoor);font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">${ic('sparkle')} Your nakshatra</div>
        <div style="font-family:Georgia,serif;font-size:22px;color:var(--sindoor-deep);margin:2px 0 8px">${esc(n.headline)}</div>
        ${n.personality ? `<p style="font-size:13.5px;margin-bottom:8px">${esc(n.personality)}.</p>` : ''}
        <div class="trow" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
          ${chip('Moon', n.moonSign)} ${chip('Sun', n.sunSign)} ${chip('Temperament', n.gana)} ${n.yoniAnimal ? chip('Nature', n.yoniAnimal) : ''}
        </div>
        <div style="font-size:12.5px;color:var(--ink-soft);line-height:1.6">
          ${n.emotionalNature ? `<div><b>Emotionally:</b> ${esc(n.emotionalNature)}</div>` : ''}
          ${n.intimateNature ? `<div><b>In intimacy:</b> ${esc(n.intimateNature)}</div>` : ''}
          ${(n.bestMatches && n.bestMatches.length) ? `<div style="margin-top:6px"><b>Naturally harmonious with:</b> ${n.bestMatches.map(esc).join(', ')}</div>` : ''}
        </div>
        ${!n.hasBirthTime ? `<p class="hint" style="margin-top:8px">Add your exact birth time for a more precise reading and full guna-milan matching.</p>` : ''}
      </div>`;
  } catch { el.innerHTML = ''; }
}

// ---- Two-factor authentication settings ----
async function load2FA() {
  try {
    const [s, pk] = await Promise.all([api('/auth/2fa/status'), api('/auth/passkey/list').catch(() => ({ passkeys: [] }))]);
    const card = $('#twofa-card'); if (!card) return;
    const twofa = s.enabled
      ? `<div class="setting-row"><span class="ic-row">${ic('shieldCheck')} Authenticator app (2FA)</span><span class="tag forest">On</span></div>
         <button class="btn small secondary mt" onclick="disable2FA()">Turn off 2FA</button>`
      : `<div class="setting-row"><span class="ic-row">${ic('lock')} Authenticator app (2FA)</span><span class="hint">Off</span></div>
         <p class="hint">Protect your account with an authenticator app (Google Authenticator, Authy…).</p>
         <button class="btn small mt" onclick="setup2FA()">Enable 2FA</button>`;
    const passkeys = (pk.passkeys || []);
    const pkSection = `<div style="border-top:1px solid var(--sand-mid);margin-top:14px;padding-top:14px">
      <div class="setting-row"><span class="ic-row">${ic('unlock')} Passkeys (fingerprint / Face ID)</span><span class="hint">${passkeys.length} set up</span></div>
      ${passkeys.map(p => `<div class="setting-row" style="font-size:13px"><span>${esc(p.name || 'Passkey')} · added ${new Date(p.createdAt).toLocaleDateString()}</span><button class="btn small ghost danger" onclick="removePasskey('${p.id}')">Remove</button></div>`).join('')}
      <p class="hint">Sign in instantly with your device biometrics — nothing to type.</p>
      <button class="btn small mt" onclick="addPasskey()">Add a passkey</button>
    </div>`;
    card.innerHTML = twofa + pkSection;
  } catch { /* card stays as-is */ }
}

async function removePasskey(id) {
  if (!confirm('Remove this passkey?')) return;
  try { await api('/auth/passkey/' + id, { method: 'DELETE' }); toast('Passkey removed'); load2FA(); }
  catch (e) { toast(e.message); }
}

async function setup2FA() {
  try {
    const r = await api('/auth/2fa/setup', { method: 'POST' });
    const qr = 'https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=' + encodeURIComponent(r.otpauthUri);
    $('#twofa-card').innerHTML = `
      <b>Scan with your authenticator app</b>
      <div style="text-align:center;margin:12px 0"><img src="${qr}" alt="2FA QR" style="border-radius:10px" onerror="this.style.display='none'"/></div>
      <p class="hint">Or enter this key manually: <b style="letter-spacing:1px">${esc(r.secret)}</b></p>
      <div class="field mt"><label>Enter the 6-digit code to confirm</label><input id="tf-code" class="otp-boxes" maxlength="6" inputmode="numeric" placeholder="••••••"/></div>
      <button class="btn forest" onclick="confirm2FA()">Confirm &amp; enable</button>
      <button class="btn small secondary mt" onclick="load2FA()">Cancel</button>`;
    $('#tf-code')?.focus();
  } catch (e) { toast(e.message); }
}

async function confirm2FA() {
  try {
    const r = await api('/auth/2fa/enable', { method: 'POST', body: { totp: $('#tf-code').value.trim() } });
    $('#twofa-card').innerHTML = `
      <div class="notice forest">✓ Two-factor authentication is on.</div>
      <b>Save your backup codes</b>
      <p class="hint">Each works once if you lose your authenticator. Store them somewhere safe.</p>
      <pre style="background:var(--sand);padding:12px;border-radius:10px;font-size:13px;line-height:1.8;letter-spacing:1px">${r.backupCodes.map(esc).join('\n')}</pre>
      <button class="btn small mt" onclick="load2FA()">Done</button>`;
  } catch (e) { toast(e.message); }
}

async function disable2FA() {
  const totp = await askInput({
    title: 'Turn off two-factor authentication',
    hint: 'Confirm it\'s you — enter a current authenticator code, or one of your backup codes.',
    label: 'Code',
    placeholder: '123456 or a backup code',
    okText: 'Turn off 2FA'
  });
  if (!totp) return;
  try {
    const body = /^\d{6}$/.test(totp.trim()) ? { totp: totp.trim() } : { backupCode: totp.trim() };
    await api('/auth/2fa/disable', { method: 'POST', body });
    toast('Two-factor authentication turned off.');
    load2FA();
  } catch (e) { toast(e.message); }
}

// ---- WebAuthn passkeys (fingerprint / Face ID / Windows Hello / security key) ----
const passkeySupported = () => !!(window.PublicKeyCredential && navigator.credentials && navigator.credentials.create);
function _b64urlToBuf(s) { s = (s || '').replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; const bin = atob(s), b = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i); return b.buffer; }
function _bufToB64url(buf) { const b = new Uint8Array(buf); let s = ''; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }

async function addPasskey() {
  if (!passkeySupported()) return toast('This device does not support passkeys.');
  try {
    const d = await api('/auth/passkey/register-options', { method: 'POST' });
    const o = d.options;
    const cred = await navigator.credentials.create({ publicKey: {
      challenge: _b64urlToBuf(o.challenge), rp: o.rp,
      user: { id: _b64urlToBuf(o.user.id), name: o.user.name, displayName: o.user.displayName },
      pubKeyCredParams: o.pubKeyCredParams, authenticatorSelection: o.authenticatorSelection,
      attestation: o.attestation, timeout: o.timeout,
      excludeCredentials: (o.excludeCredentials || []).map(c => ({ id: _b64urlToBuf(c.id), type: c.type, transports: c.transports }))
    }});
    await api('/auth/passkey/register-verify', { method: 'POST', body: {
      id: cred.id, rawId: _bufToB64url(cred.rawId), type: cred.type,
      name: 'Passkey', transports: (cred.response.getTransports && cred.response.getTransports()) || [],
      response: { attestationObject: _bufToB64url(cred.response.attestationObject), clientDataJSON: _bufToB64url(cred.response.clientDataJSON) }
    }});
    toast('Passkey added — you can now sign in with your fingerprint or Face ID.');
    load2FA();
  } catch (e) { toast(e.name === 'NotAllowedError' ? 'Passkey cancelled' : (e.message || 'Could not add passkey')); }
}

async function passkeyLogin() {
  if (!passkeySupported()) return toast('This device does not support passkeys.');
  try {
    const d = await api('/auth/passkey/login-options', { method: 'POST' });
    const o = d.options;
    const assertion = await navigator.credentials.get({ publicKey: {
      challenge: _b64urlToBuf(o.challenge), rpId: o.rpId,
      allowCredentials: (o.allowCredentials || []).map(c => ({ id: _b64urlToBuf(c.id), type: c.type, transports: c.transports })),
      userVerification: o.userVerification, timeout: o.timeout
    }});
    const r = await api('/auth/passkey/login-verify', { method: 'POST', body: {
      id: assertion.id, rawId: _bufToB64url(assertion.rawId), type: assertion.type,
      response: {
        authenticatorData: _bufToB64url(assertion.response.authenticatorData),
        clientDataJSON: _bufToB64url(assertion.response.clientDataJSON),
        signature: _bufToB64url(assertion.response.signature),
        userHandle: assertion.response.userHandle ? _bufToB64url(assertion.response.userHandle) : null
      }
    }});
    S.token = r.token; localStorage.setItem('sb_token', r.token);
    S.user = (await api('/auth/me')).user;
    connectSocket();
    nav(onboardingStep() === 'done' ? '#/discover' : '#/onboarding');
  } catch (e) { toast(e.name === 'NotAllowedError' ? 'Passkey cancelled' : (e.message || 'Passkey sign-in failed')); }
}

// Membership tiers (CHF, all monthly — nothing is free):
// Base 1/5/3 by gender · Sambandh Pro 6 · Sambandh Max 15
function tierCards(u) {
  const tier = u.membership?.tier || 'free';
  const active = tier !== 'free' && (!u.membership?.tierExpiresAt || new Date(u.membership.tierExpiresAt) > new Date());
  const cur = active ? tier : 'free';
  const until = active && u.membership?.tierExpiresAt ? new Date(u.membership.tierExpiresAt).toLocaleDateString() : null;

  const card = (id, name, price, features, buy) => `
    <div class="card" style="${cur === id ? 'border-color:var(--forest);border-width:2px' : ''}">
      <div style="display:flex;justify-content:space-between;align-items:baseline">
        <b style="font-size:16px;font-family:Georgia,serif;color:var(--sindoor-deep)">${name}</b>
        <b style="color:var(--sindoor)">${price}</b>
      </div>
      <ul class="feature-list" style="padding-left:18px;font-size:12.5px;color:var(--ink-mid);margin:8px 0">
        ${features.map(f => `<li>${f}</li>`).join('')}
      </ul>
      ${cur === id
        ? `<span class="tag forest">Current plan${until && id !== 'free' ? ' · until ' + until : ''}</span>`
        : buy ? `<button class="btn small" onclick="buyTier('${buy}')">Upgrade</button>` : ''}
    </div>`;

  const g = u.profile?.gender;
  const p = pricingView();
  const baseFee = `${p.sym}${p.base[g] ?? p.base.non_binary}`;
  return card('base', 'Base membership', `${baseFee}/month`, [
    `Nothing is free — every member subscribes (men ${p.sym}${p.base.male} · women ${p.sym}${p.base.female} · non-binary ${p.sym}${p.base.non_binary} per month)`,
    'Fully verified, photo-verified community',
    'Daily allowance: 10 msgs men · 20 msgs women, non-binary & others',
    'Full Lakshan Book, compatibility & discover'
  ], 'base_subscription')
  + card('pro', 'Sambandh Pro', `${p.sym}${p.pro}/month`, [
    'Unlimited messages & new chats',
    'No daily limits, ever',
    'Includes everything in Base'
  ], 'pro_subscription')
  + card('max', 'Sambandh Max', `${p.sym}${p.max}/month`, [
    'Everything in Pro (unlimited messaging)',
    'See exactly who liked you',
    'Advanced filters (Lakshan grade)',
    'Priority verification & support'
  ], 'max_subscription');
}

async function buyTier(purpose) {
  const p = pricingView();
  const name = purpose === 'max_subscription' ? `Sambandh Max (${p.sym}${p.max}/month)`
    : purpose === 'pro_subscription' ? `Sambandh Pro (${p.sym}${p.pro}/month)`
    : 'Base membership (monthly, priced by your profile)';
  if (!confirm(`Subscribe to ${name}? 30 days from today.`)) return;
  try {
    const order = await api('/payment/create-order', { method: 'POST', body: { purpose } });
    if (order.devMode) {
      await api('/payment/verify', { method: 'POST', body: { razorpay_order_id: order.orderId } });
      toast('Subscription active — welcome aboard');
      return renderSettings();
    }
    await ensureRazorpay();
    const rzp = new Razorpay({
      key: order.key, amount: order.amount, currency: order.currency, name: 'Sambandh',
      description: name, order_id: order.orderId,
      handler: async resp => {
        await api('/payment/verify', { method: 'POST', body: { ...resp, purpose } });
        toast('Subscription active — welcome aboard');
        renderSettings();
      }
    });
    rzp.open();
  } catch (e) { toast(e.message); }
}

function settingSwitch(key, label, on) {
  return `<div class="setting-row"><span>${label}</span>
    <label class="switch"><input type="checkbox" ${on ? 'checked' : ''} onchange="saveSetting('${key}', this.checked)"/><span class="sl"></span></label></div>`;
}

function notifPrefRow(key, label, current) {
  const val = current || (key === 'new_match' || key === 'verification' ? 'both' : 'push');
  return `<div class="setting-row"><span>${label}</span>
    <select style="padding:6px 8px;border:1px solid var(--sand-mid);border-radius:8px;font-size:13px;background:var(--white)"
      onchange="saveNotifPref('${key}', this.value)">
      ${['push','email','both','none'].map(o => `<option value="${o}" ${o === val ? 'selected' : ''}>${o === 'none' ? 'Off' : o[0].toUpperCase() + o.slice(1)}</option>`).join('')}
    </select></div>`;
}

async function saveNotifPref(key, value) {
  try { await api('/me/settings', { method: 'PATCH', body: { notificationPrefs: { [key]: value } } }); toast('Saved'); }
  catch (e) { toast(e.message); }
}

async function showIncognito() {
  try {
    const r = await api('/me/incognito');
    openModal(`<h2 style="margin-top:0" class="ic-row">${ic('eyeOff')} Incognito blocklist</h2>
      <p class="sub">These people can never see your profile in Discover. Add someone from their profile page, or by blocking them outright.</p>
      ${r.list.length ? r.list.map(x => `
        <div class="setting-row"><span>${esc(x.name)}</span>
          <button class="btn small secondary" onclick="removeIncognito('${x.userId}')">Remove</button></div>`).join('')
        : '<p class="sub">Nobody on your incognito list yet.</p>'}
      <button class="btn mt" onclick="closeModal()">Close</button>`);
  } catch (e) { toast(e.message); }
}

async function removeIncognito(userId) {
  try {
    await api('/me/incognito/' + userId, { method: 'DELETE' });
    showIncognito();
  } catch (e) { toast(e.message); }
}

async function saveSetting(key, value) {
  try { await api('/me/settings', { method: 'PATCH', body: { [key]: value } }); toast('Saved'); }
  catch (e) { toast(e.message); }
}

async function downloadData() {
  try {
    const res = await fetch('/api/me/data-export', { headers: { Authorization: 'Bearer ' + S.token } });
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'sambandh-data-export.json';
    a.click();
  } catch { toast('Export failed'); }
}

async function doLogout() {
  try { await api('/auth/logout', { method: 'POST' }); } catch { /* token may already be dead */ }
  logout();
}

async function showBlocked() {
  try {
    const r = await api('/me/blocked');
    openModal(`<h2 style="margin-top:0">Blocked users</h2>
      ${r.blocked.length ? r.blocked.map(b => `
        <div class="setting-row"><span>${esc(b.name)}${b.city ? ' · ' + esc(b.city) : ''}</span>
          <button class="btn small secondary" onclick="unblockUser('${b.userId}')">Unblock</button></div>`).join('')
        : '<p class="sub">You haven\'t blocked anyone.</p>'}
      <button class="btn mt" onclick="closeModal()">Close</button>`);
  } catch (e) { toast(e.message); }
}

async function unblockUser(userId) {
  try {
    await api('/me/block/' + userId, { method: 'DELETE' });
    toast('Unblocked. Existing chats stay blocked.');
    showBlocked();
  } catch (e) { toast(e.message); }
}

async function showPayments() {
  try {
    const r = await api('/payment/history');
    openModal(`<h2 style="margin-top:0">Payment history</h2>
      ${r.payments.length ? r.payments.map(p => `<div class="kv"><span>${esc(p.purpose.replace(/_/g, ' '))} · ${timeAgo(p.createdAt)} ago</span><b>CHF ${p.amountCHF ?? p.amountINR} · ${esc(p.status)}</b></div>`).join('') : '<p class="sub">No payments yet.</p>'}
      <button class="btn mt" onclick="closeModal()">Close</button>`);
  } catch (e) { toast(e.message); }
}

async function pauseAccount() {
  const pausing = S.user.status?.active;
  try {
    await api('/me/pause', { method: 'POST', body: { paused: pausing } });
    toast(pausing ? 'Profile hidden from discover. Unpause anytime.' : 'Welcome back — profile visible again.');
    renderSettings();
  } catch (e) { toast(e.message); }
}

async function deleteAccount() {
  if (!confirm('Delete your account? Everything is erased within 30 days. This cannot be undone.')) return;
  try {
    await api('/auth/delete-account', { method: 'POST' });
    toast('Account queued for deletion.');
    logout();
  } catch (e) { toast(e.message); }
}

function openEditProfile() {
  const u = S.user;
  openModal(`
    <h2 style="margin-top:0">Edit profile</h2>
    <div class="field"><label>Bio (max 500)</label><textarea id="ep-bio" rows="4" maxlength="500">${esc(u.profile?.bio || '')}</textarea></div>
    <div class="field"><label>Intent (max 2)</label>
      ${INTENTS.map(i => `<span class="tag ic-row ${(u.intent || []).includes(i.v) ? 'rose' : 'plain'}" data-v="${i.v}" style="cursor:pointer;padding:6px 14px;font-size:13px" onclick="this.classList.toggle('rose');this.classList.toggle('plain')">${ic(i.icon)} ${i.t}</span>`).join('')}</div>
    <div class="field"><label>Add photos (your verified selfie always stays first)</label><input id="ep-photos" type="file" accept="image/*" multiple/></div>
    <div class="field"><label>Birth time (for guna milan)</label><input id="ep-btime" type="time" value="${esc(u.astrology?.birthTime || '')}"/></div>
    <button class="btn" onclick="saveEditProfile()">Save</button>`);
}

async function saveEditProfile() {
  const body = {
    bio: $('#ep-bio').value,
    intent: [...document.querySelectorAll('#modal .tag.rose')].map(t => t.dataset.v)
  };
  if (!body.intent.length) delete body.intent;
  const files = $('#ep-photos').files;
  if (files.length) {
    body.photos = [];
    for (const f of [...files].slice(0, 6)) {
      const base64 = await fileToResizedBase64(f);
      const nsfw = await classifyImageNSFW(base64);
      if (nsfw && (nsfw.porn + nsfw.hentai >= 0.6 || nsfw.porn >= 0.55)) { toast(f.name + ' looks explicit — skipped.'); continue; }
      body.photos.push({ base64, filename: f.name, nsfw, isPrimary: body.photos.length === 0 });
    }
  }
  if ($('#ep-btime').value && S.user.astrology?.birthDate) {
    body.astrology = { birthDate: S.user.astrology.birthDate, birthTime: $('#ep-btime').value };
  }
  try {
    await api('/auth/profile', { method: 'PATCH', body });
    closeModal();
    toast('Profile updated');
    renderSettings();
  } catch (e) { toast(e.message); }
}

// ---------------- Boot ----------------
route();

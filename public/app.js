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
  { v: 'friendship',icon: 'users',  t: 'Friendship',    d: 'New in town, building a circle' }
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
  S.socket.on('karma_update', ({ notification }) => toast(notification || 'Your Karma Book was updated'));
  S.socket.on('new_match', ({ chatId }) => toast('New match! Check your chats.'));
  S.socket.on('reveal_request', () => toast('Someone wants to reveal identities'));
  S.socket.on('reveal_accepted', ({ chatId }) => {
    toast('Identities revealed');
    if (location.hash === '#/chat/' + chatId) renderChat(chatId);
  });
}

// ---------------- Router ----------------
const TAB_ROUTES = ['discover', 'chats', 'karma', 'settings', 'notifications'];

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
      ${[['shieldCheck', 'Every profile verified with government ID'],
         ['book', 'The Karma Book — honesty, tracked by AI'],
         ['target', 'Say what you want: marriage, dating, casual, friendship'],
         ['ghost', 'Anonymous-first chat with mutual reveal'],
         ['star', 'Real Vedic astrology + engagement compatibility']]
        .map(([i, t]) => `<div class="ic-row"><span style="color:var(--haldi);display:inline-flex">${ic(i)}</span><span style="color:rgba(255,255,255,0.85)">${t}</span></div>`).join('')}
    </div>
    <button class="btn" style="background:var(--haldi);color:var(--sindoor-deep)" onclick="nav('#/login')">Get started</button>
    <button class="btn" style="background:transparent;color:rgba(255,255,255,0.9);border:1px solid rgba(255,255,255,0.35);margin-top:10px" onclick="nav('#/features')">See how it works</button>
    <p style="font-size:11px;opacity:0.5;margin-top:18px">18+ only · By continuing you agree to our Terms.<br>Your ID will be verified before chatting.</p>
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
      `Government ID first — DigiLocker takes about 30 seconds — then a selfie check that becomes your
       first photo. The face you see is the face on the ID. Doctors, lawyers, CAs and architects can add
       a registry-checked badge. We never store Aadhaar numbers.`)}

    ${section('card', 'Nothing is free',
      `Membership is monthly — <b>CHF 1 men · CHF 5 women · CHF 3 non-binary</b> — and that's what
       keeps bots out. First payment refundable for 24 hours. Upgrades: <b>Pro, CHF 6/month</b> for
       unlimited messaging; <b>Max, CHF 15/month</b> for the rest — who liked you, advanced filters, priority.`)}

    ${section('book', 'The Karma Book',
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
      <div class="kv"><span>Karma evidence reveal</span><b>CHF 0.50–1</b></div>
      <div class="kv"><span>Fraud alerts</span><b>Free, always</b></div>
      <p class="hint" style="margin-top:8px">Your base price is set by your verified profile — first payment refundable within 24 hours.</p>
    </div>

    <button class="btn mt" onclick="nav('${S.token ? '#/discover' : '#/login'}')">${S.token ? 'Back to the app' : 'Get started'}</button>
    <button class="btn small mt" style="background:white;color:var(--sindoor-deep);border:1px solid var(--sand-mid)" onclick="history.length > 1 ? history.back() : nav('#/welcome')">Back</button>
    <p class="hint center" style="margin-top:14px">18+ only · Everything on this page is enforced in the product.</p>
  </div>`;
  window.scrollTo(0, 0);
}

function renderLogin() {
  screen.innerHTML = `
  <div class="section-pad" style="padding-top:60px">
    <div class="wordmark center" style="font-size:34px">sambandh</div>
    <p class="sub center" style="font-style:italic">connections, made meaningful.</p>
    <div class="card mt">
      <div id="id-email" class="${S._loginPhone ? 'hidden' : ''}">
        <div class="field">
          <label>Email address</label>
          <input id="email" type="email" inputmode="email" placeholder="you@example.com" autocomplete="email"/>
        </div>
        <p class="hint">We'll email you a 6-digit code. <a href="#" onclick="S._loginPhone=true;renderLogin();return false" style="color:var(--sindoor)">Use phone instead</a></p>
      </div>
      <div id="id-phone" class="${S._loginPhone ? '' : 'hidden'}">
        <div class="field">
          <label>Mobile number</label>
          <div class="row">
            <input id="cc" value="+91" style="flex:0 0 64px;text-align:center" maxlength="4"/>
            <input id="phone" type="tel" placeholder="98765 43210" maxlength="10" style="flex:1"/>
          </div>
        </div>
        <p class="hint"><a href="#" onclick="S._loginPhone=false;renderLogin();return false" style="color:var(--sindoor)">Use email instead</a></p>
      </div>
      <button class="btn mt" id="otp-btn" onclick="sendOtp()">Send code</button>
      <div id="otp-area"></div>
    </div>
    <p class="hint center">We never show your email or number to other users.</p>
  </div>`;
}

async function sendOtp() {
  let body, ident;
  if (S._loginPhone) {
    const phone = ($('#cc').value + $('#phone').value.replace(/\D/g, ''));
    if (!/^\+[1-9][0-9]{9,14}$/.test(phone)) return toast('Enter a valid 10-digit mobile number');
    body = { phone }; ident = { phone };
  } else {
    const email = ($('#email').value || '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return toast('Enter a valid email address');
    body = { email }; ident = { email };
  }
  $('#otp-btn').disabled = true;
  try {
    const r = await api('/auth/request-otp', { method: 'POST', body });
    $('#otp-area').innerHTML = `
      <div class="field mt">
        <label>Enter the 6-digit code</label>
        <input id="otp" class="otp-boxes" maxlength="6" inputmode="numeric" placeholder="••••••"/>
        ${r.channel === 'email' && !r.devMode ? `<div class="hint">We emailed a code to <b>${esc(body.email)}</b>. Check your inbox.</div>` : ''}
        ${r.devMode ? `<div class="hint">Dev mode — your code is <b>${esc(r.devOtp)}</b> (also in the server console${r.channel === 'email' ? ' / dev email log' : ''})</div>` : ''}
      </div>
      <button class="btn forest" onclick='verifyOtp(${JSON.stringify(ident)})'>Verify & continue</button>`;
    $('#otp').focus();
  } catch (e) { toast(e.message); }
  $('#otp-btn').disabled = false;
}

async function verifyOtp(ident) {
  try {
    const r = await api('/auth/verify-otp', { method: 'POST', body: { ...ident, otp: $('#otp').value.trim() } });
    S.token = r.token;
    localStorage.setItem('sb_token', r.token);
    S.user = (await api('/auth/me')).user;
    connectSocket();
    registerWebPush();  // ask for browser notifications after sign-in
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

// ---------------- Onboarding ----------------
// Order per build reference: profile → ID → selfie → profession → pay → intent → astrology → photos
const OB_STEPS = ['profile', 'id', 'selfie', 'profession', 'pay', 'intent', 'astrology', 'photos'];

function onboardingStep() {
  const u = S.user;
  if (!u) return 'profile';
  if (!u.profile?.firstName) return 'profile';
  if (!u.verification?.idVerified) return 'id';
  if (!u.verification?.selfieVerified) return 'selfie';
  if (!u.claims?.profession?.verified) return 'profession';
  if (!u.membership?.joinFeePaid) return 'pay';
  if (!(u.intent || []).length) return 'intent';
  if (!u.astrology?.birthDate && !u._skippedAstro) return 'astrology';
  if (!(u.profile?.photos || []).length) return 'photos';
  return 'done';
}

function obProgress(step) {
  const idx = OB_STEPS.indexOf(step);
  return `<div class="progress">${OB_STEPS.map((_, i) => `<i class="${i <= idx ? 'done' : ''}"></i>`).join('')}</div>`;
}

async function refreshUserAndRoute() {
  S.user = (await api('/auth/me')).user;
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
    <div class="field"><label>Date of birth</label><input id="ob-dob" type="date"/><div class="hint">You must be 18 or older. Verified against your government ID.</div></div>
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
    <h1>Verify your ID</h1>
    <p class="sub">Required before you can chat. Takes about 60 seconds.</p>
    <div class="tile" style="background:var(--forest);border-color:var(--forest);color:white" onclick="obDigilocker()">
      <div class="t ic-row">${ic('zap')} DigiLocker (fastest)</div>
      <div class="d" style="color:rgba(255,255,255,0.75)">Government-backed · ~30 seconds</div>
    </div>
    <div class="tile" onclick="obUploadIdForm()">
      <div class="t ic-row">${ic('camera')} Upload ID + Selfie</div>
      <div class="d">Aadhaar / PAN / Driving Licence · ~2 minutes</div>
    </div>
    <div id="ob-id-area"></div>
    <div class="notice forest ic-row" style="display:flex">${ic('lock')} <span>We store only your name and date of birth. Your ID document is auto-deleted after 30 days. Aadhaar numbers are never stored.</span></div>
  </div>`;
}

async function obDigilocker() {
  // Production: real DigiLocker OAuth redirect. Dev: simulated instant approval.
  try {
    const r = await api('/verification/id', { method: 'POST', body: { method: 'digilocker', digilockerToken: 'dev_dl_' + Date.now() } });
    if (r.status === 'approved') { toast('ID verified via DigiLocker ✓'); await refreshUserAndRoute(); }
    else toast(r.reason || 'Verification failed — try again');
  } catch (e) { toast(e.message); }
}

function obUploadIdForm() {
  $('#ob-id-area').innerHTML = `<div class="card mt">
    <div class="field"><label>ID type</label><select id="ob-idtype">
      <option value="aadhaar">Aadhaar</option><option value="pan">PAN</option><option value="driving_licence">Driving Licence</option></select></div>
    <div class="field"><label>Photo of your ID</label><input id="ob-idfile" type="file" accept="image/*"/></div>
    <button class="btn" onclick="obUploadId()">Submit ID</button>
  </div>`;
}

async function obUploadId() {
  const f = $('#ob-idfile').files[0];
  if (!f) return toast('Choose a photo of your ID');
  try {
    const base64 = await fileToResizedBase64(f);
    const r = await api('/verification/id', { method: 'POST', body: { method: 'upload', idType: $('#ob-idtype').value, document: { base64, filename: f.name } } });
    if (r.status === 'approved') { toast('ID verified — all checks passed ✓'); await refreshUserAndRoute(); }
    else toast('Not verified: ' + (r.reason || 'checks failed') + '. Try again or use DigiLocker.');
  } catch (e) { toast(e.message); }
}

function obSelfie() {
  return `<div class="section-pad">
    <h1>Selfie check</h1>
    <p class="sub">Instant automated check — liveness + face match against your ID. No human ever reviews it.</p>
    <div class="field"><label>Take or choose a selfie</label><input id="ob-selfie" type="file" accept="image/*" capture="user"/></div>
    <button class="btn" onclick="obSendSelfie()">Verify selfie</button>
    <div class="notice forest ic-row" style="display:flex">${ic('camera')} <span>Your verified selfie automatically becomes your first profile photo — people always see the verified face first. You can add up to 5 more photos later.</span></div>
  </div>`;
}

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
      body.documents = [{ type: 'offer_letter', base64: await fileToResizedBase64(f), filename: f.name }];
    }
    const r = await api('/verification/profession', { method: 'POST', body });
    if (r.status === 'approved') { toast('Profession verified instantly ✓'); await refreshUserAndRoute(); }
    else toast('Not verified: ' + (r.reason || 'document check failed') + '. Upload a document that names your employer.');
  } catch (e) { toast(e.message); }
}

function obPay() {
  const g = S.user.profile.gender;
  const fee = g === 'male' ? 1 : g === 'female' ? 5 : 3;
  return `<div class="section-pad">
    <h1>Start your membership</h1>
    <p class="sub">Nothing here is free — every member pays monthly. That's what keeps the bots and time-wasters out.</p>
    <div class="card center" style="background:var(--rose-soft);border-color:var(--rose)">
      <div style="font-size:38px;font-weight:700;color:var(--sindoor-deep);font-family:Georgia,serif">CHF ${fee}<span style="font-size:15px;color:var(--sindoor)"> / month</span></div>
      <div style="font-size:12px;color:var(--sindoor)">30 days per payment · renew when it suits you · taxes included</div>
      <div class="hint">Men CHF 1 · Women CHF 5 · Non-binary CHF 3 per month — your price is set by your verified profile, not by this page.</div>
    </div>
    <button class="btn" onclick="obPayNow()">Pay with UPI / Card</button>
    <p class="hint center mt">Powered by Razorpay · Secure payment · Full refund within 24 hours, no questions asked</p>
  </div>`;
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
    try { S.onboardPhotos.push({ base64: await fileToResizedBase64(f), filename: f.name }); }
    catch { toast('Could not read ' + f.name); }
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
async function renderDiscover() {
  screen.innerHTML = `
    ${headerBar()}
    <div class="chips" id="intent-chips">
      ${['all', ...INTENTS.map(i => i.v)].map(v => `<button class="chip ${S.filters.intent === v ? 'active' : ''}" onclick="S.filters.intent='${v}';renderDiscover()">${v === 'all' ? 'All' : INTENTS.find(i => i.v === v).t}</button>`).join('')}
      <button class="chip ic-row" onclick="openFilters()">${ic('sliders')} Filters</button>
    </div>
    <div id="feed"><div class="empty">Loading profiles…</div></div>`;
  loadNotifCount();
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
        ${p.photo ? `<img class="photo" src="${esc(p.photo)}"/>` : p.anonymous ? `<div class="anon-face" style="color:rgba(255,255,255,0.85)">${ic('ghost', 'ic-xl')}</div>` : ''}
        <span class="badge-tl">${esc((p.intent[0] || 'dating'))}</span>
        ${p.verificationLevel !== 'phone_only' ? `<span class="badge-tr ic-row">${ic('shieldCheck')} ${p.verificationLevel === 'fully_verified' ? 'FULLY VERIFIED' : 'VERIFIED'}</span>` : ''}
        <div class="info">
          <div class="name">${esc(p.firstName)}${p.age ? ', ' + p.age : ''} ${p.likesMe ? '<span style="font-size:11px;background:var(--haldi);color:var(--sindoor-deep);padding:2px 8px;border-radius:8px;vertical-align:middle">likes you</span>' : ''}</div>
          <div class="meta ic-row">${ic('pin')} ${esc(p.city || '')}${p.distanceKm != null ? ' · ' + p.distanceKm + ' km' : ''}${p.profession ? ' · ' + esc(p.profession) : ''}${p.online ? ' · <i style="width:8px;height:8px;border-radius:50%;background:#4ADE80;display:inline-block"></i>' : ''}</div>
          <div class="trow">
            ${p.tagsPositive.map(t => `<span class="wtag">${esc(t)}</span>`).join('')}
            ${p.tagsNegative.map(t => `<span class="wtag" style="color:var(--haldi)">${esc(t)}</span>`).join('')}
            <span class="karma">Karma: ${p.karma.score} ${p.karma.grade}</span>
          </div>
          ${(p.reasons && p.reasons.length) ? `<div class="why">${ic('sparkle')} ${p.reasons.map(r => esc(r)).join(' · ')}</div>` : ''}
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
            <div class="avatar">${p.photo ? `<img src="${esc(p.photo)}"/>` : esc((p.firstName || '?')[0])}</div>
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
      <option value="any" ${f.verification === 'any' ? 'selected' : ''}>Any</option>
      <option value="id" ${f.verification === 'id' ? 'selected' : ''}>ID verified</option>
      <option value="profession" ${f.verification === 'profession' ? 'selected' : ''}>Profession verified</option>
      <option value="fully_verified" ${f.verification === 'fully_verified' ? 'selected' : ''}>Fully verified</option></select></div>
    <div class="field"><label>Minimum Karma grade</label><select id="f-karma">
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
    const [p, karma] = await Promise.all([
      api('/discover/profile/' + userId),
      api('/karma/profile/' + userId)
    ]);
    const photo = p.photos?.find(x => x.isPrimary)?.url || p.photos?.[0]?.url;
    screen.innerHTML = `
      <div class="app-header">
        <button class="back" style="background:none;border:none;font-size:22px;cursor:pointer" onclick="history.back()">←</button>
        <div style="flex:1;padding-left:8px"><b>${esc(p.firstName)}${p.age ? ', ' + p.age : ''}</b>
          <div style="font-size:11px;color:var(--forest)">${verLabel(p.verification)}</div></div>
        <button style="background:none;border:none;cursor:pointer;color:var(--danger)" title="Report" onclick="openReport('${p.userId}')">${ic('flag', 'ic-lg')}</button>
      </div>
      <div class="section-pad">
        ${photo ? `<img src="${esc(photo)}" style="width:100%;border-radius:16px;max-height:380px;object-fit:cover;margin-bottom:14px"/>`
          : p.anonymous ? `<div class="notice anon ic-row" style="display:flex">${ic('ghost')} <span>This person browses anonymously. Chat first — identities reveal by mutual consent.</span></div>` : ''}
        <div class="stat-row">
          <div class="stat"><b>${karma.score}</b><span>karma score</span></div>
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
  if (v.level === 'profession_verified') return '✓ ID + Profession verified';
  if (v.level === 'id_verified') return '✓ ID verified';
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
        <div class="avatar ${c.other.anonymous ? 'anon' : ''}">${c.other.anonymous ? ic('ghost', 'ic-lg') : c.other.photo ? `<img src="${esc(c.other.photo)}"/>` : esc((c.other.displayName || '?')[0].toUpperCase())}</div>
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
      $('#ch-avatar').innerHTML = meta.other.anonymous ? ic('ghost') : meta.other.photo ? `<img src="${esc(meta.other.photo)}"/>` : esc((meta.other.displayName || '?')[0].toUpperCase());
      if (meta.anonymous) $('#ch-reveal').style.display = 'inline-flex';
    }
    const r = await api(`/chat/${chatId}/messages`);
    const msgs = $('#msgs');
    msgs.innerHTML = `<div class="bubble sys">You're chatting. Your conduct shapes your Karma score.</div>`;
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
  screen.innerHTML = `${headerBar()}<div class="section-pad"><div class="empty">Loading your Karma Book…</div></div>`;
  loadNotifCount();
  try {
    const [k, me] = await Promise.all([api('/karma/me'), api('/auth/me')]);
    S.user = me.user;
    const rep = await fetch('/api/discover/profile/' + S.user._id, { headers: { Authorization: 'Bearer ' + S.token } }).then(r => r.json()).catch(() => null);
    const issues = (k.lies?.length || 0) + (k.contradictions?.length || 0) + (k.manipulationFlags?.length || 0);
    screen.querySelector('.section-pad').innerHTML = `
      <h1>My Karma Book</h1>
      <p class="sub">What the honesty engine sees. Only repeat patterns become visible to matches.</p>
      <div class="karma-hero ${gradeClass(k.score)}">
        <b>${k.score}</b><span>Grade ${scoreGrade(k.score)} · ${issues === 0 ? 'Clean record' : issues + ' recorded signal' + (issues > 1 ? 's' : '')}</span>
      </div>
      ${rep?.traitScores ? `<div class="card">
        <b style="font-size:11px;color:var(--ink-soft);text-transform:uppercase;letter-spacing:.05em">Trait scores</b>
        ${['respect','responsive','depth','humor','directness'].map(t => trait(t, rep.traitScores[t])).join('')}
      </div>` : ''}
      ${rep?.tagsPositive?.length ? `<div class="card"><b style="font-size:11px;color:var(--ink-soft);text-transform:uppercase;letter-spacing:.05em">Your tags</b><div class="mt" style="margin-top:8px">${rep.tagsPositive.map(t => `<span class="tag forest">${esc(t)}</span>`).join('')}</div></div>` : ''}
      ${k.lies?.length ? section('Fact-check flags', k.lies.map(l => flagRow(l.reason, l.severity, l.recordedAt))) : ''}
      ${k.contradictions?.length ? section('Contradictions', k.contradictions.map(c => flagRow(c.reason, c.severity, c.recordedAt, true))) : ''}
      ${k.manipulationFlags?.length ? section('Pattern flags', k.manipulationFlags.map(m => flagRow(m.pattern + ': ' + (m.evidence || ''), m.confidence, m.recordedAt))) : ''}
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
function flagRow(text, severity, when, disputable) {
  return `<div class="flag-card"><div class="ft">${esc(severity || '')} severity · ${when ? timeAgo(when) + ' ago' : ''}</div>
    <div class="fd">${esc(text)}</div>
    ${disputable ? `<button class="btn small mt secondary" onclick="toast('Dispute filed — human review within 7 days')">Dispute</button>` : ''}</div>`;
}

// ---------------- Compatibility ----------------
async function renderCompat(userId) {
  screen.innerHTML = `<div class="section-pad">
    <button class="btn ghost" style="text-align:left;padding-left:0" onclick="history.back()">← Back</button>
    <h1>Compatibility</h1><div id="compat-body"><div class="empty">Computing…</div></div></div>`;
  try {
    const c = await api('/compat/' + userId);
    const a = c.astrology, e = c.engagement;
    $('#compat-body').innerHTML = `
      ${c.overall != null ? `<div class="karma-hero good"><b>${c.overall}%</b><span>Overall compatibility</span></div>` : ''}
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
        <div class="avatar" style="width:64px;height:64px;font-size:26px">${photo ? `<img src="${esc(photo)}"/>` : esc((u.profile?.firstName || '?')[0])}</div>
        <div><b style="font-size:18px">${esc(u.profile?.firstName || '')}, ${u.profile?.age || ''}</b>
          <div style="font-size:12px;color:var(--forest)">${verLabel(u.verification)} · Trust ${u.verification?.trustScore || 0}/100</div>
          <div style="font-size:12px;color:var(--ink-soft)">${esc(u.profile?.city || '')} · ${(u.intent || []).join(', ')}</div>
        </div>
      </div>
      <button class="btn secondary ic-row" style="display:flex;justify-content:center" onclick="openEditProfile()">${ic('edit')} Edit profile & photos</button>

      <h2>Membership</h2>
      ${tierCards(u)}

      <h2>Privacy</h2>
      <div class="card">
        ${settingSwitch('anonymousModeEnabled', 'Anonymous mode', p.anonymousModeEnabled)}
        ${settingSwitch('showProfessionToOthers', 'Show profession', p.showProfessionToOthers !== false)}
        ${settingSwitch('showAstrologyToOthers', 'Show astrology', p.showAstrologyToOthers !== false)}
        ${settingSwitch('allowNSFWChats', 'Allow NSFW chats', p.allowNSFWChats)}
        <div class="setting-row" style="cursor:pointer" onclick="showIncognito()"><span class="ic-row">${ic('eyeOff')} Incognito — hide me from specific people</span><span>→</span></div>
      </div>

      <h2>Notifications</h2>
      <div class="card">
        ${notifPrefRow('new_match', 'New match', p.notificationPrefs?.new_match)}
        ${notifPrefRow('new_message', 'New message', p.notificationPrefs?.new_message)}
        ${notifPrefRow('message_while_away', 'Message while away', p.notificationPrefs?.message_while_away)}
        ${notifPrefRow('verification', 'Verification updates', p.notificationPrefs?.verification)}
        ${notifPrefRow('system', 'System alerts', p.notificationPrefs?.system)}
        <div class="setting-row"><span>Karma Book updates</span><span class="tag forest">always on</span></div>
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
      <p class="hint center mt">Sambandh · verified, honest dating · Grievances: grievance@sambandh.in</p>`;
  } catch (e) { screen.querySelector('.section-pad').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
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
  const baseFee = g === 'male' ? 'CHF 1' : g === 'female' ? 'CHF 5' : 'CHF 3';
  return card('base', 'Base membership', `${baseFee}/month`, [
    'Nothing is free — every member subscribes (men CHF 1 · women CHF 5 · non-binary CHF 3 per month)',
    'Fully verified community: ID + selfie + profession',
    'Daily allowance: 10 msgs men · 20 msgs women, non-binary & others',
    'Full Karma Book, compatibility & discover'
  ], 'base_subscription')
  + card('pro', 'Sambandh Pro', 'CHF 6/month', [
    'Unlimited messages & new chats',
    'No daily limits, ever',
    'Includes everything in Base'
  ], 'pro_subscription')
  + card('max', 'Sambandh Max', 'CHF 15/month', [
    'Everything in Pro (unlimited messaging)',
    'See exactly who liked you',
    'Advanced filters (karma grade)',
    'Priority verification & support'
  ], 'max_subscription');
}

async function buyTier(purpose) {
  const name = purpose === 'max_subscription' ? 'Sambandh Max (CHF 15/month)'
    : purpose === 'pro_subscription' ? 'Sambandh Pro (CHF 6/month)'
    : 'Base membership (monthly, priced by your profile)';
  if (!confirm(`Subscribe to ${name}? 30 days from today.`)) return;
  try {
    const order = await api('/payment/create-order', { method: 'POST', body: { purpose } });
    if (order.devMode) {
      await api('/payment/verify', { method: 'POST', body: { razorpay_order_id: order.orderId } });
      toast('Subscription active — welcome aboard');
      return renderSettings();
    }
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
      body.photos.push({ base64: await fileToResizedBase64(f), filename: f.name, isPrimary: body.photos.length === 0 });
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

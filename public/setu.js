/* setu.js — Sambandh Setu app layer (loaded after app.js; uses its helpers:
   S, screen, $, api, esc, ic, nav, toast, openModal, closeModal, askInput, timeAgo,
   pageHead, ddLike, ddPass, startChat, openFilters, buyTier, plainOnly).
   Screens: Home dashboard · swipe Discover · Setu Guide (streaming, sources,
   memory, feedback) · Memory · Setu Guide settings · Public profile · Journey ·
   Reflect · Lakshan assessments. No emojis — inline SVG icons only. */
(function () {
  'use strict';

  // ---------------------------------------------------------------- icons
  const SI = {
    bridge: '<svg class="ic" viewBox="0 0 48 32" aria-hidden="true"><path d="M5 26 Q24 2 43 26" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M5 26H43" stroke="currentColor" stroke-width="2"/><circle cx="20" cy="11.2" r="2.4" fill="currentColor" stroke="none"/><circle cx="28" cy="11.2" r="2.4" fill="currentColor" stroke="none"/></svg>',
    home: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h5v-6h4v6h5V10"/></svg>',
    guide: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 8.5c-2.5 0-4 1.6-4 3.5s1.5 3.5 4 3.5c3.5 0 7.5-7 11-7 2.5 0 4 1.6 4 3.5s-1.5 3.5-4 3.5c-3.5 0-7.5-7-11-7z"/></svg>',
    route: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="6" r="2.2"/><path d="M8 18h6a3 3 0 0 0 0-6H10a3 3 0 0 1 0-6h6"/></svg>',
    globe: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/></svg>',
    memory: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4a3 3 0 0 0-3 3v.2A3 3 0 0 0 4 10a3 3 0 0 0 1.2 2.4A3 3 0 0 0 6 17a3 3 0 0 0 3 3h1V4z"/><path d="M15 4a3 3 0 0 1 3 3v.2A3 3 0 0 1 20 10a3 3 0 0 1-1.2 2.4A3 3 0 0 1 18 17a3 3 0 0 1-3 3h-1V4z"/></svg>',
    thumbUp: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 11v9H4v-9z"/><path d="M7 11l4-7a2 2 0 0 1 2 2v4h5a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 16.8 20H7"/></svg>',
    thumbDown: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 13V4H4v9z"/><path d="M7 13l4 7a2 2 0 0 0 2-2v-4h5a2 2 0 0 0 2-2.3l-1.2-6A2 2 0 0 0 16.8 4H7"/></svg>',
    history: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></svg>',
    trash: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
    gear: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    plus: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    info: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg>',
    check: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    pin: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>'
  };
  const si = (n, cls) => (SI[n] || '').replace('class="ic"', `class="ic${cls ? ' ' + cls : ''}"`);
  window.setuIcon = si;

  const STAGE_LABEL = { connect: 'Connect', understand: 'Understand', reflect: 'Reflect', discuss: 'Discuss', agree: 'Agree', family: 'Family', reflect_again: 'Reflect Again', decision: 'Decision', complete: 'Complete' };
  const head = (eyebrow, title, sub) => pageHead(eyebrow, title, sub);
  const back = (to, label = 'Back') => `<button class="setu-back" onclick="nav('${to}')">${si('route', 'flip')}<span>${esc(label)}</span></button>`;
  const dateShort = (d) => { try { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return ''; } };
  const sw = (id, on, onchange, label, hint, disabled) => `<label class="setu-switch${disabled ? ' off' : ''}"><span><b>${esc(label)}</b>${hint ? `<small>${esc(hint)}</small>` : ''}</span>
    <input type="checkbox" id="${id}" ${on ? 'checked' : ''} ${disabled ? 'disabled' : ''} onchange="${onchange}"/><i aria-hidden="true"></i></label>`;
  function confirmBox({ title, body, ok = 'Confirm', danger = false }) {
    return new Promise(resolve => {
      openModal(`<h2 style="margin-top:0;font-family:var(--serif)">${esc(title)}</h2><p style="color:var(--ink-mid);margin:8px 0 18px">${esc(body)}</p>
        <div style="display:flex;gap:10px;justify-content:flex-end"><button class="btn-ghost" id="cb-no">Cancel</button><button class="${danger ? 'btn-danger' : 'btn-primary'}" id="cb-ok">${esc(ok)}</button></div>`);
      $('#cb-no').onclick = () => { closeModal(); resolve(false); };
      $('#cb-ok').onclick = () => { closeModal(); resolve(true); };
    });
  }

  // ---------------------------------------------------------------- header brand
  window.headerBar = function () {
    return `<div class="app-header setu-header">
      <a class="brand-lockup" onclick="nav('#/home')" aria-label="Sambandh Setu home"><img src="/brand/logo-mark.svg" alt=""/><span><b>Sambandh Setu</b><small>Find with purpose. Connect with trust.</small></span></a>
      <div class="header-actions">
        <button onclick="showWhoLikedMe()" title="Who liked you" aria-label="Who liked you" style="color:var(--sindoor)">${ic('heart', 'ic-lg')}</button>
        <button aria-label="Notifications" onclick="nav('#/notifications')" style="color:var(--ink-mid)">${ic('bell', 'ic-lg')}<span class="notif-dot" id="notif-dot" style="display:none"></span></button>
      </div>
    </div>`;
  };

  // ================================================================ WELCOME (design: App Welcome Screen)
  window.renderWelcome = function () {
    document.body.classList.remove('auth-split');
    screen.innerHTML = `<div class="sw-welcome">
      <div class="top"><span class="brand-lockup lg"><img src="/brand/logo-mark.svg" alt=""/><span><b>Sambandh Setu</b><small>People · Conversations · Possibilities</small></span></span><span class="lang">English</span></div>
      <div class="photo"><img src="/brand/welcome-couple.jpg" alt="A couple walking hand in hand"/></div>
      <div>
        <h1>Meaningful connections, <span>at your own pace.</span></h1>
        <p class="lead">Discover people, understand each other, and take the next step when you're ready.</p>
        <div class="sw-feats">
          <div><i>${ic('users')}</i>People with shared values</div>
          <div><i>${ic('message')}</i>Thoughtful conversations</div>
          <div><i>${si('route')}</i>A guided journey forward</div>
        </div>
        <button class="sw-cta" onclick="S._authTab='signup';nav('#/login/signup')">Get Started <span aria-hidden="true">→</span></button>
        <p class="sw-alt">Already have an account? <a onclick="S._authTab='signin';nav('#/login')">Log in</a></p>
        <p class="sw-safe">${ic('lock')} Your information stays under your control.</p>
      </div>
    </div>`;
  };

  // ================================================================ AUTH (design: Web Login / Sign Up)
  const _renderLogin = window.renderLogin;
  if (typeof _renderLogin === 'function') {
    window.renderLogin = function () {
      if (/^#\/login\/signup/.test(location.hash) && !S._authTabSet) { S._authTab = 'signup'; S._authTabSet = true; }
      const out = _renderLogin.apply(this, arguments);
      const brand = screen.querySelector('.wordmark.center');
      if (brand) {
        const sub = brand.nextElementSibling;
        if (sub && sub.classList.contains('sub')) sub.remove();
        brand.outerHTML = `<div class="auth-brand"><span class="brand-lockup lg"><img src="/brand/logo-mark.svg" alt=""/><span><b>Sambandh Setu</b><small>Find with purpose · Connect with trust</small></span></span></div>`;
      }
      const signup = S._authTab === 'signup';
      if (!screen.querySelector('.auth-art')) {
        screen.insertAdjacentHTML('afterbegin', `<aside class="auth-art" aria-hidden="true">
          <span class="brand-lockup"><img src="/brand/logo-mark.svg" alt=""/><span><b>Sambandh Setu</b><small>Find with purpose. Connect with trust.</small></span></span>
          <h2>${signup ? 'Meaningful connections begin with <span>understanding.</span>' : 'Continue your <span>meaningful journey.</span>'}</h2>
          <p>${signup ? 'Sambandh Setu is a relationship platform that helps you understand yourself, explore compatibility, and build meaningful connections with clarity and trust.' : 'Log in to your Sambandh Setu account and pick up where you left off — your reflections, preferences, and conversations are right here.'}</p>
          <ul>
            <li><i>${ic('heart')}</i><span><b>Your progress</b><small>Continue your journey anytime.</small></span></li>
            <li><i>${ic('shieldCheck')}</i><span><b>Your privacy</b><small>Your information stays safe and secure.</small></span></li>
            <li><i>${ic('users')}</i><span><b>A more thoughtful experience</b><small>Personalised guidance for meaningful connections.</small></span></li>
          </ul>
          <div class="scene"><img src="/brand/scene-bridge.jpg" alt=""/></div>
        </aside>`);
      }
      document.body.classList.add('auth-split');
      return out;
    };
    window.addEventListener('hashchange', () => { if (!/^#\/login/.test(location.hash)) document.body.classList.remove('auth-split'); });
  }

  // ================================================================ HOME
  window.renderHome = async function () {
    const first = (S.user && S.user.profile && S.user.profile.firstName) || '';
    const h = new Date().getHours();
    const greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    screen.innerHTML = `${headerBar()}<div class="section-pad setu-home">
      <div class="setu-banner"><h1>${greet}${first ? `, <span>${esc(first)}</span>` : ''}</h1><p>Wishing you meaningful conversations and new possibilities today.</p><img src="/brand/dash-art.png" alt=""/></div>
      <div id="h-conn"><div class="skel" style="height:120px"></div></div>
      <h3 class="setu-h3">Needs your attention</h3><div id="h-attn" class="setu-list"><div class="skel" style="height:56px"></div></div>
      <div id="h-journey"></div>
      <div class="setu-card setu-guide-card" onclick="nav('#/guide')">
        <div><div class="eyebrow-s">${si('guide')} Setu Guide</div>
        <h3>Need help with your next step?</h3>
        <p>Get personalised guidance on conversations, family involvement and next steps.</p>
        <span class="setu-link">Ask Setu Guide</span></div>
        <img src="/brand/guide-mascot.png" alt=""/>
      </div>
      <div class="setu-card setu-teaser" onclick="nav('#/discover')">
        <div><div class="eyebrow-s">${ic('search')} Discover</div>
        <h3>Meet people who share your values, goals and future hopes.</h3>
        <span class="setu-link">Find meaningful connections</span></div>
        <img src="/brand/discover-teaser.png" alt=""/>
      </div>
      <h3 class="setu-h3">Explore</h3>
      <div class="setu-index">
        <a onclick="nav('#/community')">${ic('users')}<span><b>Community</b><small>Anonymous topic rooms</small></span></a>
        <a onclick="nav('#/astro')">${ic('star')}<span><b>Astrology</b><small>Readings and compatibility</small></span></a>
        <a onclick="nav('#/services')">${ic('briefcase')}<span><b>Services</b><small>Consultations and gift passes</small></span></a>
        <a onclick="nav('#/karma')">${ic('book')}<span><b>Lakshan Book</b><small>Your honesty record</small></span></a>
        <a onclick="nav('#/public-profile')">${si('globe')}<span><b>Public profile</b><small>Your page at sambandh.online/u/…</small></span></a>
      </div>
    </div>`;
    loadNotifCount();
    const [chats, notifs, lak, open, likes] = await Promise.all([
      api('/chat').catch(() => ({ chats: [] })),
      api('/notifications').catch(() => ({})),
      api('/intelligence/lakshan/assessments').catch(() => ({ assessments: [] })),
      api('/intelligence/context/open-items').catch(() => ({ items: [] })),
      api('/discover/likes').catch(() => null)
    ]);
    const list = chats.chats || [];
    const conn = $('#h-conn');
    if (!list.length) {
      conn.innerHTML = `<div class="setu-card"><div class="eyebrow-s">${ic('users')} Current connection</div><h3>No connection yet</h3><p>When you and someone both like each other, your chat and Setu Journey begin here.</p><span class="setu-link" onclick="nav('#/discover')">Start discovering</span></div>`;
    } else {
      const c = list[0];
      let j = null;
      try { j = await api('/journey/' + c.chatId); } catch { j = null; }
      const name = (c.other && c.other.displayName) || 'Your match';
      const photo = c.other && c.other.photo;
      conn.innerHTML = `<div class="setu-card setu-conn">
        <div class="eyebrow-s">${ic('users')} Current connection</div>
        <div class="setu-conn-row">
          <div class="setu-ph">${photo ? `<img alt="${esc(name)}" src="${esc(photo)}" onerror="this.remove()"/>` : esc(name[0] || '?')}</div>
          <div class="setu-conn-txt">${j ? `<span class="setu-stage">${esc(STAGE_LABEL[j.stage] || j.stage)}</span>` : ''}<b>${esc(name)}</b>
            ${c.other && c.other.verified && c.other.verified !== 'phone_only' ? `<small>${si('check')} Verified</small>` : ''}
            ${c.unreadCount ? `<small>${c.unreadCount} unread message${c.unreadCount > 1 ? 's' : ''}</small>` : ''}</div>
        </div>
        <div class="setu-actions"><button class="btn-primary" onclick="nav('#/chat/${c.chatId}')">Continue</button><button class="btn-ghost" onclick="nav('#/journey/${c.chatId}')">${si('route')} Journey</button></div>
      </div>`;
      if (j) {
        const idx = j.stages.findIndex(s => s.status === 'active');
        const win = j.stages.slice(Math.max(0, Math.min(idx - 1, j.stages.length - 4)), Math.max(0, Math.min(idx - 1, j.stages.length - 4)) + 4);
        $('#h-journey').innerHTML = `<h3 class="setu-h3">Your journey <span class="setu-link" onclick="nav('#/journey/${c.chatId}')">View details</span></h3>
          <div class="setu-stepper">${win.map(s => `<div class="st ${s.status}"><i>${s.status === 'completed' ? si('check') : ''}</i><b>${esc(s.label)}</b><small>${esc(s.description)}</small></div>`).join('')}</div>
          ${j.status === 'paused' ? '<p class="setu-note">Your journey is paused. There is no rush.</p>' : ''}`;
      }
    }
    const items = [];
    const unread = list.reduce((s, c) => s + (c.unreadCount || 0), 0);
    if (unread) items.push(`<a onclick="nav('#/chats')">${ic('message')}<span><b>${unread} unread message${unread > 1 ? 's' : ''}</b><small>Reply when you are ready</small></span></a>`);
    const likeCount = likes && (likes.count != null ? likes.count : (likes.likes || likes.users || []).length);
    if (likeCount) items.push(`<a onclick="showWhoLikedMe()">${ic('heart')}<span><b>${likeCount} ${likeCount > 1 ? 'people' : 'person'} liked you</b><small>Someone has shown interest in you</small></span></a>`);
    const unreadNotifs = notifs && (notifs.unread != null ? notifs.unread : notifs.unreadCount != null ? notifs.unreadCount : (notifs.notifications || []).filter(n => !n.read).length);
    if (unreadNotifs) items.push(`<a onclick="nav('#/notifications')">${ic('bell')}<span><b>${unreadNotifs} new notification${unreadNotifs > 1 ? 's' : ''}</b><small>Journey updates, matches and account news</small></span></a>`);
    const openLak = (lak.assessments || []).filter(a => a.status === 'open').length;
    if (openLak) items.push(`<a onclick="nav('#/lakshan')">${ic('book')}<span><b>A Lakshan observation needs your view</b><small>Private to you — add context, correct or appeal</small></span></a>`);
    const openItems = open.items || [];
    if (openItems.length) items.push(`<a onclick="nav('#/memory')">${si('memory')}<span><b>${openItems.length} open item${openItems.length > 1 ? 's' : ''} from Setu Guide</b><small>${esc(openItems[0].text.slice(0, 70))}</small></span></a>`);
    $('#h-attn').innerHTML = items.length ? items.join('') : '<p class="setu-note">You are all caught up.</p>';
  };

  // ================================================================ DISCOVER — swipe deck
  function cardHtml(p, depth) {
    const verified = p.verificationLevel && p.verificationLevel !== 'phone_only';
    const nature = typeof plainOnly === 'function' ? plainOnly(p.natureLine) : '';
    const photo = !p.anonymous && p.photo ? `<img alt="${esc(p.firstName || 'Member')}" src="${esc(p.photo)}" draggable="false" onerror="this.remove()"/>` : '';
    const mono = p.anonymous ? ic('ghost', 'ic-xl') : esc((p.firstName || '?')[0].toUpperCase());
    const role = [p.profession || (p.claims && p.claims.profession && p.claims.profession.title), p.city].filter(Boolean).map(esc).join(' · ');
    const bio = p.bio || p.headline || '';
    return `<div class="sw-card" data-depth="${depth}">
      <div class="sw-photo">${photo || `<div class="sw-mono">${mono}</div>`}
        <div class="sw-stamp like">Like</div><div class="sw-stamp pass">Pass</div>
        ${p.likesMe ? '<div class="sw-likes">Likes you</div>' : ''}</div>
      <div class="sw-info">
        <div class="sw-name">${esc(p.firstName || 'Member')}${p.age ? ', ' + p.age : ''}${verified ? `<span class="vbadge" title="Verified">${si('check')}</span>` : ''}</div>
        <div class="sw-meta">${role || (p.city ? si('pin') + esc(p.city) : '')}${p.distanceKm != null ? ' · ' + p.distanceKm + ' km' : ''}</div>
        <div class="sw-tags">${p.intent && p.intent[0] ? `<span>Looking for ${esc(p.intent[0])}</span>` : ''}${p.karma ? `<span>Lakshan ${esc(p.karma.grade)}</span>` : ''}</div>
        ${bio ? `<div class="sw-quote"><b>“</b><span>${esc(String(bio).slice(0, 140))}</span></div>` : nature ? `<div class="sw-nature">${esc(nature)} <small>— a reading, not a verified fact</small></div>` : ''}
        <div class="sw-card-actions">
          <button class="pass" aria-label="Pass" onclick="swFling(-1)">${ic('x')}</button>
          <button class="view" onclick="nav('#/profile/${p.userId}')">View Profile</button>
          <button class="like" onclick="swFling(1)">${ic('heart')} Express Interest</button>
        </div>
      </div></div>`;
  }

  window.ddShow = function () {
    const dd = S._dd, feed = $('#feed');
    if (!feed) return;
    if (!dd || dd.i >= dd.profiles.length) {
      feed.innerHTML = `<div class="dd-empty sw-empty">${si('bridge', 'ic-xl')}
        <b>That's everyone for now</b>
        <p>Widen your filters or check back soon as more verified members join.</p>
        <button class="btn-primary" onclick="openFilters()">Adjust filters</button></div>`;
      return;
    }
    const rest = dd.profiles.slice(dd.i, dd.i + 3);
    const p = rest[0];
    feed.innerHTML = `<div class="sw-wrap">
      <div class="sw-top"><span class="sw-count">${dd.profiles.length - dd.i} to discover</span><button class="dd-close" onclick="openFilters()" title="Filters" aria-label="Filters">${ic('sliders')}</button></div>
      <div class="sw-deck" id="sw-deck" tabindex="0" aria-label="Discover cards. Use left and right arrow keys to pass or like.">${rest.map((x, k) => cardHtml(x, k)).reverse().join('')}</div>
      <div class="sw-actions">
        <button class="pass" title="Pass" aria-label="Pass" onclick="swFling(-1)">${ic('x', 'ic-lg')}</button>
        <button class="info" title="Open profile" aria-label="Open profile" onclick="nav('#/profile/${p.userId}')">${si('info', 'ic-lg')}</button>
        <button class="chat" title="Message" aria-label="Message" onclick="startChat('${p.userId}', false)">${ic('message', 'ic-lg')}</button>
        <button class="like" title="Like" aria-label="Like" onclick="swFling(1)">${ic('heart', 'ic-lg')}</button>
      </div>
      <p class="sw-hint">Swipe right to express interest, left to pass. Tap the photo for the full profile.</p></div>`;
    const deck = $('#sw-deck');
    deck.addEventListener('keydown', e => { if (e.key === 'ArrowRight') { swFling(1); e.preventDefault(); } if (e.key === 'ArrowLeft') { swFling(-1); e.preventDefault(); } });
    const top = deck.querySelector('.sw-card[data-depth="0"]');
    if (!top) return;
    let sx = 0, sy = 0, dx = 0, moved = false, active = false;
    top.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; active = true; moved = false; sx = e.clientX; sy = e.clientY; dx = 0; top.setPointerCapture(e.pointerId); top.classList.add('drag'); });
    top.addEventListener('pointermove', e => {
      if (!active) return;
      dx = e.clientX - sx; const dy = (e.clientY - sy) * 0.25;
      if (Math.abs(dx) > 6) moved = true;
      top.style.transform = `translate(${dx}px,${dy}px) rotate(${dx / 18}deg)`;
      top.querySelector('.sw-stamp.like').style.opacity = Math.max(0, Math.min(1, dx / 90));
      top.querySelector('.sw-stamp.pass').style.opacity = Math.max(0, Math.min(1, -dx / 90));
    });
    const end = () => {
      if (!active) return; active = false;
      top.classList.remove('drag');
      if (Math.abs(dx) > 110) return swFling(dx > 0 ? 1 : -1);
      top.style.transform = '';
      top.querySelectorAll('.sw-stamp').forEach(s => (s.style.opacity = 0));
      if (!moved) nav('#/profile/' + p.userId);
    };
    top.addEventListener('pointerup', end);
    top.addEventListener('pointercancel', end);
  };

  const _renderDiscover = window.renderDiscover;
  if (typeof _renderDiscover === 'function') {
    window.renderDiscover = function () {
      const p = _renderDiscover.apply(this, arguments);
      const dd = screen.querySelector('.dd');
      if (dd && !dd.querySelector('.conn-head')) {
        dd.insertAdjacentHTML('afterbegin', `<div class="conn-head"><h1>Connections</h1><p>Find meaningful connections that share your values, goals and future hopes.</p></div>
          <div class="conn-tabs" role="tablist"><button class="on" role="tab" aria-selected="true">Discover</button><button role="tab" onclick="connRequests(this)">Requests</button><button role="tab" onclick="nav('#/chats')">Active</button></div>`);
      }
      return p;
    };
  }
  window.connRequests = async function (btn) {
    document.querySelectorAll('.conn-tabs button').forEach(b => { b.classList.remove('on'); b.setAttribute('aria-selected', 'false'); });
    btn.classList.add('on'); btn.setAttribute('aria-selected', 'true');
    const intents = document.getElementById('dd-intents'); if (intents) intents.style.display = 'none';
    const feed = document.getElementById('feed');
    feed.innerHTML = '<div class="dd-empty">Loading…</div>';
    try {
      const r = await api('/discover/likes');
      const list = r.likes || r.users || r.profiles || [];
      if (r.upgradeRequired) { feed.innerHTML = `<div class="dd-empty sw-empty">${ic('heart', 'ic-xl')}<b>${r.count || 0} ${r.count === 1 ? 'person has' : 'people have'} shown interest in you</b><p>See who they are with Sambandh Signature, or keep swiping — a mutual like opens a chat.</p><button class="btn-primary" onclick="buyTier('max_subscription')">See who likes you</button></div>`; return; }
      feed.innerHTML = list.length ? `<div class="req-list">${list.map(u => `<div class="req-item"><div class="av">${u.photo ? `<img alt="" src="${esc(u.photo)}"/>` : esc((u.firstName || u.displayName || '?')[0])}</div><div><b>${esc(u.firstName || u.displayName || 'Member')}${u.age ? ', ' + u.age : ''}</b><small>Has shown interest in you</small></div><button class="btn-primary go" onclick="likeUser('${u.userId || u._id}')">Accept</button></div>`).join('')}</div>`
        : `<div class="dd-empty sw-empty">${ic('heart', 'ic-xl')}<b>No new requests yet</b><p>When someone expresses interest in you, it appears here.</p></div>`;
    } catch (e) { feed.innerHTML = `<div class="dd-empty">${esc(e.message)}</div>`; }
  };

  let flinging = false;
  window.swFling = function (dir) {
    if (flinging) return;
    const top = document.querySelector('#sw-deck .sw-card[data-depth="0"]');
    if (!top) return;
    flinging = true;
    top.style.transition = 'transform .32s ease, opacity .32s ease';
    top.style.transform = `translate(${dir * 140}%, -4%) rotate(${dir * 22}deg)`;
    top.style.opacity = '0';
    const st = top.querySelector(dir > 0 ? '.sw-stamp.like' : '.sw-stamp.pass');
    if (st) st.style.opacity = '1';
    setTimeout(() => { flinging = false; (dir > 0 ? ddLike : ddPass)(); }, 300);
  };

  // ================================================================ SETU GUIDE
  const G = { conv: null, ctx: null, busy: false, web: 'auto', status: null };

  function mdLite(t) {
    const lines = esc(t).split('\n');
    let html = '', inList = false;
    for (const l of lines) {
      const m = l.match(/^\s*(?:[-•*]|\d+\.)\s+(.*)$/);
      if (m) { if (!inList) { html += '<ul>'; inList = true; } html += `<li>${m[1]}</li>`; }
      else { if (inList) { html += '</ul>'; inList = false; } if (l.trim()) html += `<p>${l}</p>`; }
    }
    if (inList) html += '</ul>';
    return html.replace(/\[(\d{1,2})\]/g, '<sup class="cite">[$1]</sup>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  }

  function sourcesHtml(c) {
    if (!c || !c.length) return '';
    return `<div class="g-sources"><div class="eyebrow-s">Sources</div><ol>${c.map(s => `<li value="${s.n}"><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title || s.domain)}</a> <small>${esc(s.domain)}${s.published ? ' · ' + esc(String(s.published).slice(0, 10)) : ''}</small></li>`).join('')}</ol></div>`;
  }

  function msgHtml(m) {
    if (m.role === 'user') return `<div class="g-msg me"><div class="g-bub">${esc(m.content).replace(/\n/g, '<br/>')}</div></div>`;
    const basic = m.model && m.model.mode === 'basic';
    return `<div class="g-msg them" data-id="${esc(m.id || '')}"><div class="g-bub">${mdLite(m.content || '')}${sourcesHtml(m.citations)}
      <div class="g-foot">${basic ? '<span class="g-mode">Basic mode</span>' : ''}${m.id ? `<button title="Helpful" aria-label="Helpful" onclick="guideFeedback('${m.id}',1,this)">${si('thumbUp')}</button><button title="Not helpful" aria-label="Not helpful" onclick="guideFeedback('${m.id}',-1,this)">${si('thumbDown')}</button>` : ''}</div></div></div>`;
  }

  window.renderGuide = async function (convId, ctxKind, ctxRef) {
    G.conv = convId && convId !== 'new' ? convId : null;
    G.ctx = ctxKind && ctxRef ? { kind: ctxKind, refId: ctxRef } : null;
    screen.innerHTML = `<div class="g-screen">
      <div class="g-head">
        <div class="setu-mark">${si('guide')}<span>Setu Guide</span></div>
        <span class="g-status" id="g-status"></span>
        <div class="g-tools">
          <button title="New conversation" aria-label="New conversation" onclick="nav('#/guide/new')">${si('plus')}</button>
          <button title="History" aria-label="Conversation history" onclick="guideHistory()">${si('history')}</button>
          <button title="Memory" aria-label="Memory" onclick="nav('#/memory')">${si('memory')}</button>
          <button title="Settings" aria-label="Setu Guide settings" onclick="nav('#/guide-settings')">${si('gear')}</button>
        </div>
      </div>
      <div class="g-ctx" id="g-ctx" style="display:none"></div>
      <div class="g-msgs" id="g-msgs"></div>
      <div class="g-quick" id="g-quick">
        <button onclick="guideAsk('Give me a few conversation ideas')">Conversation ideas</button>
        <button onclick="guideAsk('Help me understand where things stand')">Help me understand</button>
        <button onclick="guideAsk('What would be a good next step?')">Next steps</button>
        <button onclick="guideAsk('What should I keep in mind about privacy and safety?')">Privacy &amp; safety</button>
      </div>
      <div class="g-input">
        <textarea id="g-text" rows="1" maxlength="4000" placeholder="Ask Setu Guide…" aria-label="Message to Setu Guide"
          onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();guideAsk();}" oninput="this.style.height='auto';this.style.height=Math.min(this.scrollHeight,140)+'px'"></textarea>
        <select id="g-web" aria-label="Web research" title="Web research" onchange="G_setWeb(this.value)">
          <option value="auto">Web: auto</option><option value="on">Web: search</option><option value="off">Web: off</option>
        </select>
        <button class="g-send" aria-label="Send" onclick="guideAsk()">${ic('send', 'ic-lg')}</button>
      </div>
    </div>`;
    $('#g-web').value = G.web;
    api('/intelligence/status').then(s => {
      G.status = s;
      const el = $('#g-status');
      if (el) el.textContent = (s.mode === 'model' ? 'Own model' : 'Basic mode') + (s.webResearch ? ' · web on' : '');
      const hello = document.querySelector('.g-hello p'); if (hello && s.mode !== 'model') hello.insertAdjacentHTML('afterend', '<p class="setu-note">Running in basic mode: answers come straight from what you have shared and our guidance library.</p>');
    }).catch(() => {});
    const msgs = $('#g-msgs');
    if (G.conv) {
      try {
        const c = await api('/intelligence/assistant/conversations/' + G.conv);
        G.ctx = c.context && c.context.kind !== 'general' ? c.context : null;
        msgs.innerHTML = c.messages.map(msgHtml).join('');
        if (c.messages.length) $('#g-quick').style.display = 'none';
      } catch (e) { msgs.innerHTML = `<p class="setu-note">${esc(e.message)}</p>`; }
    } else {
      msgs.innerHTML = `<div class="g-hello">${si('guide', 'ic-xl')}<h2>How can I help today?</h2><p>I can suggest conversation ideas, help you understand a profile or where things stand, and share next steps. I remember only what you allow, and I show my sources when I look something up.</p></div>`;
    }
    if (G.ctx) {
      const ctxEl = $('#g-ctx');
      ctxEl.style.display = 'block';
      ctxEl.innerHTML = G.ctx.kind === 'chat' ? 'About your chat — Setu Guide can only read it if you allowed that in settings.' : G.ctx.kind === 'journey' ? 'About your Setu Journey together.' : G.ctx.kind === 'profile' ? 'About the profile you were viewing.' : '';
    }
    msgs.scrollTop = msgs.scrollHeight;
  };
  window.G_setWeb = (v) => { G.web = v; };

  async function streamAsk(body, on) {
    const res = await fetch('/api/intelligence/assistant/stream', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + S.token }, body: JSON.stringify(body) });
    if (res.status === 401) { logout(); throw new Error('Session expired — log in again'); }
    if (!res.ok || !res.body) { const j = await res.json().catch(() => ({})); throw new Error(j.error || 'Setu Guide could not answer right now.'); }
    const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
        const ev = (chunk.match(/^event: (.+)$/m) || [])[1];
        const data = (chunk.match(/^data: (.+)$/m) || [])[1];
        if (ev && data) { try { on(ev, JSON.parse(data)); } catch { /* ignore a bad frame */ } }
      }
    }
  }

  window.guideAsk = async function (preset) {
    if (G.busy) return;
    const ta = $('#g-text');
    const text = (preset || (ta && ta.value) || '').trim();
    if (!text) return;
    if (ta && !preset) { ta.value = ''; ta.style.height = 'auto'; }
    const msgs = $('#g-msgs');
    const hello = msgs.querySelector('.g-hello'); if (hello) hello.remove();
    $('#g-quick').style.display = 'none';
    msgs.insertAdjacentHTML('beforeend', msgHtml({ role: 'user', content: text }));
    msgs.insertAdjacentHTML('beforeend', `<div class="g-msg them pending"><div class="g-bub"><div class="g-typing" id="g-live-status">Thinking<span>.</span><span>.</span><span>.</span></div><div id="g-live"></div></div></div>`);
    msgs.scrollTop = msgs.scrollHeight;
    G.busy = true;
    let acc = '';
    const pending = msgs.querySelector('.g-msg.pending');
    try {
      await streamAsk({ conversationId: G.conv, message: text, context: G.conv ? undefined : G.ctx, web: G.web }, (ev, d) => {
        if (ev === 'meta') {
          if (!G.conv && d.conversationId) { G.conv = d.conversationId; history.replaceState(null, '', '#/guide/' + d.conversationId); }
          const st = $('#g-live-status');
          const bits = [];
          if (d.memories) bits.push(`${d.memories} memor${d.memories > 1 ? 'ies' : 'y'}`);
          if (d.related && d.related.length) bits.push('an earlier conversation');
          if (st && bits.length) st.firstChild.textContent = 'Using ' + bits.join(' and ');
        } else if (ev === 'status') {
          const st = $('#g-live-status'); if (st) st.firstChild.textContent = d.detail || 'Working';
        } else if (ev === 'token') {
          acc += d.t;
          const st = $('#g-live-status'); if (st) st.remove();
          const live = $('#g-live'); if (live) live.innerHTML = mdLite(acc);
          msgs.scrollTop = msgs.scrollHeight;
        } else if (ev === 'memory' && d.saved && d.saved.length) {
          msgs.insertAdjacentHTML('beforeend', `<div class="g-learned">${si('memory')} Remembered: ${d.saved.map(s => esc(s.text)).join(' · ')} <a onclick="nav('#/memory')">Manage</a></div>`);
        } else if (ev === 'done') {
          pending.outerHTML = msgHtml(d.message);
          if (d.forgetCandidates && d.forgetCandidates.length) {
            msgs.insertAdjacentHTML('beforeend', `<div class="g-learned">${d.forgetCandidates.map(f => `<div>${esc(f.text)} <a onclick="guideForget('${f.id}', this)">Delete</a></div>`).join('')}</div>`);
          }
          if (d.webDecision && d.webDecision.needed && !(d.message.citations || []).length) {
            msgs.insertAdjacentHTML('beforeend', `<div class="g-learned">${si('globe')} Web research was needed but isn't available right now, so this answer has no web sources.</div>`);
          }
        } else if (ev === 'error') {
          pending.outerHTML = `<div class="g-msg them"><div class="g-bub"><p>${esc(d.error)}</p></div></div>`;
        }
      });
    } catch (e) {
      if (pending && pending.isConnected) pending.outerHTML = `<div class="g-msg them"><div class="g-bub"><p>${esc(e.message)}</p></div></div>`;
    } finally {
      G.busy = false;
      msgs.scrollTop = msgs.scrollHeight;
    }
  };

  window.guideForget = async function (id, el) {
    try { await api('/intelligence/memory/' + id, { method: 'DELETE' }); el.parentElement.innerHTML = '<s>Deleted</s>'; toast('Deleted from memory'); }
    catch (e) { toast(e.message); }
  };

  window.guideFeedback = async function (id, rating, btn) {
    let correction = '';
    if (rating < 0) {
      correction = await askInput({ title: 'What was wrong?', hint: 'Optional. If something I said about you is out of date, write the correct version and I will update my memory.', label: 'Correction', placeholder: 'e.g. I live in Bengaluru now', multiline: true, okText: 'Send feedback' });
      if (correction === null) return;
    }
    try {
      const r = await api(`/intelligence/assistant/messages/${id}/feedback`, { method: 'POST', body: { rating, correction: correction || undefined } });
      btn.parentElement.querySelectorAll('button').forEach(b => b.classList.remove('on'));
      btn.classList.add('on');
      toast(r.learned ? 'Thanks — I have updated my memory.' : 'Thanks for the feedback.');
    } catch (e) { toast(e.message); }
  };

  window.guideHistory = async function () {
    try {
      const r = await api('/intelligence/assistant/conversations');
      openModal(`<h2 style="margin-top:0;font-family:var(--serif)">Conversation history</h2>
        ${r.conversations.length ? `<div class="setu-list">${r.conversations.map(c => `<a onclick="closeModal();nav('#/guide/${c.id}')">${si('guide')}<span><b>${esc(c.title)}</b><small>${esc(timeAgo(c.lastMessageAt))} · ${c.messageCount} message${c.messageCount === 1 ? '' : 's'}</small></span></a>`).join('')}</div>` : '<p class="setu-note">No conversations yet.</p>'}
        <div style="display:flex;justify-content:space-between;margin-top:16px"><button class="btn-ghost" onclick="closeModal();nav('#/guide-settings')">Manage history</button><button class="btn-primary" onclick="closeModal()">Close</button></div>`);
    } catch (e) { toast(e.message); }
  };

  // ================================================================ MEMORY
  const CAT = { explicit: 'Saved by you', semantic: 'About you', project: 'Plans and tasks', episodic: 'Events and decisions', procedural: 'How you do things' };
  window.renderMemory = async function () {
    screen.innerHTML = `<div class="section-pad setu-page">${back('#/guide', 'Setu Guide')}${head('Setu Guide', 'Memory', 'Everything Setu Guide remembers about you. Correct it, delete it, or turn memory off in settings.')}
      <div class="setu-actions" style="margin:6px 0 18px"><button class="btn-ghost" onclick="memAdd()">${si('plus')} Add</button><button class="btn-ghost" onclick="memExport()">${ic('download')} Export</button><button class="btn-ghost danger" onclick="memForgetAll()">${si('trash')} Forget everything</button></div>
      <div id="mem-open"></div><div id="mem-list"><div class="skel" style="height:80px"></div></div></div>`;
    try {
      const [open, all] = await Promise.all([api('/intelligence/context/open-items'), api('/intelligence/memory')]);
      $('#mem-open').innerHTML = open.items.length ? `<h3 class="setu-h3">Open items</h3><div class="setu-rows">${open.items.map(m => `<div class="setu-row"><div><b>${esc(m.text)}</b><small>${m.dueAt ? (m.overdue ? 'Overdue · ' : 'Due ') + esc(dateShort(m.dueAt)) : 'No date'}</small></div><button class="btn-ghost sm" onclick="memResolve('${m.id}')">Done</button></div>`).join('')}</div>` : '';
      const by = {};
      for (const m of all.memories) (by[m.category] = by[m.category] || []).push(m);
      $('#mem-list').innerHTML = all.memories.length ? Object.keys(CAT).filter(k => by[k]).map(k => `<h3 class="setu-h3">${CAT[k]}</h3><div class="setu-rows">${by[k].map(m => `<div class="setu-row">
        <div><b>${esc(m.text)}</b><small>${m.origin === 'explicit' ? 'Saved by you' : m.origin === 'corrected' ? 'Corrected by you' : 'Learned from a conversation'} · ${Math.round((m.confidence || 0) * 100)}% confidence · ${esc(dateShort(m.updatedAt))}${m.version > 1 ? ' · v' + m.version : ''}</small></div>
        <div class="setu-row-act"><button class="btn-ghost sm" onclick="memEdit('${m.id}')">Edit</button>${m.version > 1 ? `<button class="btn-ghost sm" onclick="memHistory('${m.id}')">History</button>` : ''}<button class="btn-ghost sm danger" onclick="memDelete('${m.id}')">Delete</button></div></div>`).join('')}</div>`).join('')
        : '<p class="setu-note">Nothing yet. As you talk with Setu Guide, useful things you share — plans, preferences, decisions — appear here.</p>';
    } catch (e) { $('#mem-list').innerHTML = `<p class="setu-note">${esc(e.message)}</p>`; }
  };
  window.memAdd = async () => { const t = await askInput({ title: 'Remember something', label: 'What should Setu Guide remember?', multiline: true, okText: 'Save', minLength: 2 }); if (!t) return; try { await api('/intelligence/memory', { method: 'POST', body: { text: t } }); renderMemory(); } catch (e) { toast(e.message); } };
  window.memEdit = async (id) => { const t = await askInput({ title: 'Correct this memory', hint: 'The earlier version is kept in history.', label: 'Corrected text', multiline: true, okText: 'Save', minLength: 2 }); if (!t) return; try { await api('/intelligence/memory/' + id, { method: 'PATCH', body: { text: t } }); renderMemory(); } catch (e) { toast(e.message); } };
  window.memDelete = async (id) => { if (!(await confirmBox({ title: 'Delete this memory?', body: 'It will be permanently removed.', ok: 'Delete', danger: true }))) return; try { await api('/intelligence/memory/' + id, { method: 'DELETE' }); renderMemory(); } catch (e) { toast(e.message); } };
  window.memResolve = async (id) => { try { await api(`/intelligence/memory/${id}/resolve`, { method: 'POST' }); renderMemory(); } catch (e) { toast(e.message); } };
  window.memHistory = async (id) => {
    try {
      const h = await api(`/intelligence/memory/${id}/history`);
      openModal(`<h2 style="margin-top:0;font-family:var(--serif)">Memory history</h2><div class="setu-rows">
        <div class="setu-row"><div><b>${esc(h.current.text)}</b><small>Current · v${h.current.version}</small></div></div>
        ${h.history.slice().reverse().map(x => `<div class="setu-row"><div><b>${esc(x.text)}</b><small>v${x.version} · ${esc(dateShort(x.changedAt))} · ${esc(String(x.reason || '').replace(/_/g, ' '))}</small></div></div>`).join('')}</div>
        <div style="text-align:right;margin-top:14px"><button class="btn-primary" onclick="closeModal()">Close</button></div>`);
    } catch (e) { toast(e.message); }
  };
  window.memExport = async () => {
    try {
      const r = await fetch('/api/intelligence/memory/export', { headers: { Authorization: 'Bearer ' + S.token } });
      const blob = await r.blob();
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'sambandh-setu-memory.json'; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch (e) { toast(e.message); }
  };
  window.memForgetAll = async () => {
    if (!(await confirmBox({ title: 'Forget everything?', body: 'Every memory and your personal knowledge graph will be permanently deleted. Conversations stay unless you clear them in settings.', ok: 'Forget everything', danger: true }))) return;
    try { await api('/intelligence/memory', { method: 'DELETE', body: { confirm: true } }); toast('All memories deleted'); renderMemory(); } catch (e) { toast(e.message); }
  };

  // ================================================================ SETU GUIDE SETTINGS
  window.renderGuideSettings = async function () {
    screen.innerHTML = `<div class="section-pad setu-page">${back('#/guide', 'Setu Guide')}${head('Settings', 'Setu Guide & privacy', 'You decide what Setu Guide can access. Changes apply on the web and in the apps.')}<div id="gs"><div class="skel" style="height:200px"></div></div></div>`;
    try {
      const [s, convs] = await Promise.all([api('/intelligence/settings'), api('/intelligence/assistant/conversations')]);
      const pa = s.profileAccess || {};
      $('#gs').innerHTML = `
        <h3 class="setu-h3">What Setu Guide can do</h3><div class="setu-switches">
          ${sw('gs-mem', s.memoryEnabled, "guideSet({memoryEnabled:this.checked})", 'Remember across conversations', 'Useful things you share are saved to Memory, which you can review any time.')}
          ${sw('gs-web', s.webResearch, "guideSet({webResearch:this.checked})", 'Search the web when needed', 'For current or factual questions. Sources are always shown.')}
          ${sw('gs-chat', s.chatContext, "guideSet({chatContext:this.checked})", 'Read a chat when I ask from it', 'Only the chat you open Setu Guide from, only when you ask. Off by default.')}
          ${sw('gs-sens', s.sensitiveTopics, "guideSet({sensitiveTopics:this.checked})", 'Detailed guidance on sensitive topics', 'Health, religion and caste, sexuality and money. Otherwise guidance stays general.')}
          ${sw('gs-learn', s.learnFromFeedback, "guideSet({learnFromFeedback:this.checked})", 'Help improve Setu Guide', 'Lets your rated answers (with personal details removed) be used to evaluate quality. Never used to train on your private conversations.')}
        </div>
        <h3 class="setu-h3">Profile information it may use</h3><div class="setu-switches">
          ${sw('pa-b', pa.basics, "guideSet({profileAccess:{basics:this.checked}})", 'Basics', 'Name, city and what you are looking for')}
          ${sw('pa-l', pa.lifestyle, "guideSet({profileAccess:{lifestyle:this.checked}})", 'Lifestyle', 'Interests and routine')}
          ${sw('pa-f', pa.family, "guideSet({profileAccess:{family:this.checked}})", 'Family', 'Family details you added')}
          ${sw('pa-p', pa.preferences, "guideSet({profileAccess:{preferences:this.checked}})", 'Partner preferences', 'What you are looking for in a partner')}
        </div>
        <h3 class="setu-h3">Conversation history</h3>
        ${convs.conversations.length ? `<div class="setu-rows">${convs.conversations.map(c => `<div class="setu-row"><div><b>${esc(c.title)}</b><small>${esc(timeAgo(c.lastMessageAt))}</small></div><div class="setu-row-act"><button class="btn-ghost sm" onclick="nav('#/guide/${c.id}')">Open</button><button class="btn-ghost sm danger" onclick="guideDelConv('${c.id}')">Delete</button></div></div>`).join('')}</div>
          <button class="btn-ghost danger" style="margin-top:12px" onclick="guideClearAll()">${si('trash')} Clear all history</button>` : '<p class="setu-note">No conversations yet.</p>'}
        <p class="setu-note" style="margin-top:18px">Conversations and memories are encrypted at rest. Setu Guide never decides for you, never predicts how a relationship will go, and never shares what you tell it with anyone.</p>`;
    } catch (e) { $('#gs').innerHTML = `<p class="setu-note">${esc(e.message)}</p>`; }
  };
  window.guideSet = async (patch) => { try { await api('/intelligence/settings', { method: 'PATCH', body: patch }); toast('Saved'); } catch (e) { toast(e.message); } };
  window.guideDelConv = async (id) => { if (!(await confirmBox({ title: 'Delete this conversation?', body: 'Its messages will be permanently deleted.', ok: 'Delete', danger: true }))) return; try { await api('/intelligence/assistant/conversations/' + id, { method: 'DELETE' }); renderGuideSettings(); } catch (e) { toast(e.message); } };
  window.guideClearAll = async () => { if (!(await confirmBox({ title: 'Clear all history?', body: 'Every Setu Guide conversation will be permanently deleted. Your memories stay unless you delete them too.', ok: 'Clear all', danger: true }))) return; try { await api('/intelligence/assistant/conversations', { method: 'DELETE', body: { confirm: true } }); toast('History cleared'); renderGuideSettings(); } catch (e) { toast(e.message); } };

  // ================================================================ PUBLIC PROFILE
  window.renderPublicProfile = async function () {
    screen.innerHTML = `<div class="section-pad setu-page">${back('#/settings', 'Me')}${head('Public profile', 'Your page on the web', 'Like a professional profile: a simple page others can open at sambandh.online/u/yourname. Off by default.')}<div id="pp"><div class="skel" style="height:220px"></div></div></div>`;
    try {
      const p = await api('/me/public-profile');
      $('#pp').innerHTML = `
        <label class="setu-field"><span>Username</span><div class="setu-inrow"><input id="pp-u" value="${esc(p.username || '')}" maxlength="20" autocomplete="off" placeholder="e.g. aanya_s" oninput="ppCheck()"/><button class="btn-ghost" onclick="ppSaveUser()">Save</button></div><small id="pp-uhint">3–20 characters: lowercase letters, numbers or underscore. It is also your login handle.</small></label>
        ${p.anonymousMode ? '<p class="setu-note">Anonymous mode is on, so a public profile is not available. Turn anonymous mode off first.</p>' : ''}
        <div class="setu-switches">
          ${sw('pp-en', p.enabled, "ppSet({enabled:this.checked})", 'Public profile', 'Anyone with the link can see your first name, headline and the details you choose below.', !p.username || p.anonymousMode)}
          ${sw('pp-ix', p.indexable, "ppSet({indexable:this.checked})", 'Allow search engines', 'Let Google and others list your page. A separate choice, off by default.', !p.enabled)}
          ${sw('pp-ci', p.showCity, "ppSet({showCity:this.checked})", 'Show my city', '')}
          ${sw('pp-ph', p.showPhoto, "ppSet({showPhoto:this.checked})", 'Show my main photo', 'Off by default.')}
        </div>
        <label class="setu-field"><span>Headline</span><div class="setu-inrow"><input id="pp-h" maxlength="120" value="${esc(p.headline || '')}" placeholder="e.g. Architect, reader, Sunday cook"/><button class="btn-ghost" onclick="ppSet({headline:$('#pp-h').value})">Save</button></div><small>No phone numbers, emails or links.</small></label>
        ${p.url ? `<div class="setu-card"><div class="eyebrow-s">${si('globe')} Your link</div><p style="word-break:break-all"><b>${esc(p.url)}</b></p><div class="setu-actions">${p.enabled ? `<a class="btn-primary" href="${esc(p.url)}" target="_blank" rel="noopener">View public page</a>` : '<span class="setu-note">Turn on your public profile to share it.</span>'}</div></div>` : ''}
        <p class="setu-note">Never shown publicly: your age, exact location, contact details, chats, Lakshan details or photos (unless you turn photos on).</p>`;
    } catch (e) { $('#pp').innerHTML = `<p class="setu-note">${esc(e.message)}</p>`; }
  };
  let ppT = null;
  window.ppCheck = () => {
    clearTimeout(ppT);
    ppT = setTimeout(async () => {
      const u = $('#pp-u').value.trim().toLowerCase();
      const hint = $('#pp-uhint');
      if (!u) return;
      try { const r = await api('/me/username/check?u=' + encodeURIComponent(u)); hint.textContent = r.valid ? (r.available ? 'Available' : r.reason) : r.reason; hint.style.color = r.valid && r.available ? 'var(--forest)' : 'var(--danger)'; } catch { /* ignore */ }
    }, 350);
  };
  window.ppSaveUser = async () => { try { await api('/me/username', { method: 'PUT', body: { username: $('#pp-u').value.trim() } }); toast('Username saved'); renderPublicProfile(); } catch (e) { toast(e.message); } };
  window.ppSet = async (patch) => { try { await api('/me/public-profile', { method: 'PATCH', body: patch }); toast('Saved'); renderPublicProfile(); } catch (e) { toast(e.message); renderPublicProfile(); } };
  window.openPublicProfile = async (username) => {
    try { const r = await api('/v1/public/profiles/' + encodeURIComponent(username || '')); nav('#/profile/' + r.userId); }
    catch (e) { toast('That profile is not public'); nav('#/home'); }
  };

  // ================================================================ JOURNEY
  window.renderJourney = async function (chatId) {
    screen.innerHTML = `<div class="section-pad setu-page">${back('#/chat/' + chatId, 'Chat')}<div id="jr"><div class="skel" style="height:260px"></div></div></div>`;
    try {
      const j = await api('/journey/' + chatId);
      const active = j.stages.find(s => s.status === 'active');
      const detail = active ? await api(`/journey/${chatId}/stages/${active.key}`).catch(() => null) : null;
      $('#jr').innerHTML = `${head('Setu Journey', `With ${j.match.firstName}`, j.status === 'complete' ? 'You have completed the journey together.' : `Stage ${j.stageNumber} of ${j.totalStages}. A stage completes only when you both complete it.`)}
        <div class="setu-vsteps">${j.stages.map((s, i) => `<div class="vs ${s.status}"><i>${s.status === 'completed' ? si('check') : i + 1}</i><div><b>${esc(s.label)}</b><small>${esc(s.description)}</small>
          ${s.status === 'active' ? `<small class="vs-who">${s.youCompleted ? 'You have completed this' : 'Waiting for you'} · ${s.partnerCompleted ? esc(j.match.firstName) + ' has completed this' : 'Waiting for ' + esc(j.match.firstName)}</small>` : ''}</div></div>`).join('')}</div>
        ${j.status === 'paused' ? `<div class="setu-card"><h3>Your journey is paused</h3><p>${j.pausedByMe ? 'You paused it. Resume whenever you are ready.' : esc(j.match.firstName) + ' is taking some time. Only they can resume — this respects their pace.'}</p>${j.pausedByMe ? `<button class="btn-primary" onclick="journeyAct('${chatId}','resume')">Resume</button>` : ''}</div>` : ''}
        ${active && detail && j.status === 'active' ? `<div class="setu-card"><div class="eyebrow-s">${si('route')} Now: ${esc(active.label)}</div><p>${esc(active.description)}</p>
          ${(detail.guidance || []).slice(0, 2).map(g => `<p class="setu-note">${esc(g)}</p>`).join('')}
          ${(detail.conversationStarters || []).length ? `<div class="eyebrow-s" style="margin-top:10px">Try asking</div>${detail.conversationStarters.slice(0, 2).map(c => `<p class="setu-quote">${esc(c)}</p>`).join('')}` : ''}
          <div class="setu-actions">
            ${active.key === 'reflect' || active.key === 'reflect_again' ? `<button class="btn-primary" onclick="nav('#/reflect/${chatId}')">Open Reflect</button>` : ''}
            ${active.youCompleted ? '<span class="setu-note">Completed by you</span>' : `<button class="btn-primary" onclick="journeyComplete('${chatId}','${active.key}')">Mark ${esc(active.label)} complete</button>`}
            <button class="btn-ghost" onclick="nav('#/guide/new/journey/${chatId}')">${si('guide')} Ask Setu Guide</button>
            <button class="btn-ghost" onclick="journeyAct('${chatId}','pause')">Pause</button>
          </div></div>` : ''}`;
    } catch (e) { $('#jr').innerHTML = `<p class="setu-note">${esc(e.message)}</p>`; }
  };
  window.journeyComplete = async (chatId, stage) => {
    try { const r = await api(`/journey/${chatId}/stages/${stage}/complete`, { method: 'POST' }); toast(r.advanced ? 'You both completed this stage — moving forward together.' : 'Marked complete. Your match will complete it when they are ready.'); renderJourney(chatId); }
    catch (e) { toast(e.message); }
  };
  window.journeyAct = async (chatId, action) => {
    if (action === 'pause' && !(await confirmBox({ title: 'Pause your journey?', body: 'Nothing is lost. Only you can resume it.', ok: 'Pause' }))) return;
    try { await api(`/journey/${chatId}/${action}`, { method: 'POST' }); renderJourney(chatId); } catch (e) { toast(e.message); }
  };

  // ================================================================ REFLECT
  const R = { chatId: null, qs: [], answers: {}, i: -1, sharing: 'keep_private', match: 'your match' };
  const SHARE = { keep_private: ['Keep private', 'Only you can see this answer.'], share_with_match: ['Share with {m}', '{m} can see this answer.'], share_later: ['Share later', 'Decide after you finish all questions.'] };
  const shareLabel = (k, i) => SHARE[k][i].replace('{m}', R.match);
  window.renderReflect = async function (chatId) {
    R.chatId = chatId; R.i = -1;
    screen.innerHTML = `<div class="section-pad setu-page" id="rf"><div class="skel" style="height:240px"></div></div>`;
    try {
      const [qs, prog, j] = await Promise.all([api(`/journey/${chatId}/reflect/questions`), api(`/journey/${chatId}/reflect/progress`), api('/journey/' + chatId)]);
      R.qs = qs.questions; R.match = j.match.firstName;
      R.answers = Object.fromEntries(prog.mine.map(a => [a.questionKey, a]));
      if (prog.answered >= R.qs.length) return reflectDone(prog);
      reflectIntro();
    } catch (e) { $('#rf').innerHTML = `${back('#/journey/' + chatId, 'Journey')}<p class="setu-note">${esc(e.message)}</p>`; }
  };
  function reflectIntro() {
    $('#rf').innerHTML = `${back('#/journey/' + R.chatId, 'Journey')}${head('Reflect', 'Your privacy, your choice', `Ten questions. You decide how each answer is shared with ${R.match}.`)}
      <div class="setu-choices">${Object.keys(SHARE).map(k => `<label class="setu-choice"><input type="radio" name="rf-def" value="${k}" ${R.sharing === k ? 'checked' : ''} onchange="R_setDef(this.value)"/><span><b>${esc(shareLabel(k, 0))}</b><small>${esc(shareLabel(k, 1))}</small></span></label>`).join('')}</div>
      <p class="setu-note">You can change the sharing choice for each answer. Your privacy is always respected.</p>
      <button class="btn-primary wide" onclick="R_go(0)">Continue to questions</button>`;
  }
  window.R_setDef = (v) => { R.sharing = v; };
  window.R_go = (i) => { R.i = i; reflectQ(); };
  function reflectQ() {
    const q = R.qs[R.i];
    const a = R.answers[q.key] || {};
    const sharing = a.sharing || R.sharing;
    let body = '';
    if (q.type === 'single' || q.type === 'multi') {
      const vals = Array.isArray(a.value) ? a.value : a.value ? [a.value] : [];
      body = `<div class="setu-choices">${q.options.map(o => `<label class="setu-choice"><input type="${q.type === 'single' ? 'radio' : 'checkbox'}" name="rq" value="${esc(o.value)}" ${vals.includes(o.value) ? 'checked' : ''}/><span><b>${esc(o.label)}</b></span></label>`).join('')}</div>
        <input class="setu-other" id="rq-other" maxlength="200" placeholder="Please specify" value="${esc(a.otherText || '')}"/>`;
    } else if (q.type === 'scale') {
      body = `<div class="setu-scale">${[1, 2, 3, 4, 5].map(n => `<label><input type="radio" name="rq" value="${n}" ${a.value === n ? 'checked' : ''}/><span>${n}</span></label>`).join('')}</div><div class="setu-scale-l"><small>${esc(q.minLabel)}</small><small>${esc(q.maxLabel)}</small></div>`;
    } else {
      body = `<textarea id="rq-text" class="setu-ta" maxlength="${q.max || 500}" rows="6" placeholder="Type your answer here…">${esc(a.value || '')}</textarea>`;
    }
    $('#rf').innerHTML = `<div class="rf-top"><button class="setu-back" onclick="${R.i ? `R_go(${R.i - 1})` : 'renderReflect(R_chat())'}">${si('route', 'flip')}<span>Back</span></button><span>${R.i + 1} / ${R.qs.length}</span></div>
      <div class="setu-progress"><i style="width:${((R.i + 1) / R.qs.length) * 100}%"></i></div>
      <div class="eyebrow-s" style="margin-top:18px">${esc(q.category)}</div>
      <h2 class="rf-q">${R.i + 1}. ${esc(q.prompt)}</h2>${q.hint ? `<p class="setu-note">${esc(q.hint)}</p>` : ''}
      ${body}
      <label class="setu-field"><span>Sharing preference for this answer</span><select id="rq-share">${Object.keys(SHARE).map(k => `<option value="${k}" ${sharing === k ? 'selected' : ''}>${esc(shareLabel(k, 0))}</option>`).join('')}</select></label>
      <button class="btn-primary wide" onclick="R_save(true)">${R.i + 1 === R.qs.length ? 'Finish' : 'Next'}</button>
      <button class="btn-link wide" onclick="R_save(false)">Save &amp; exit</button>`;
  }
  window.R_chat = () => R.chatId;
  window.R_save = async (next) => {
    const q = R.qs[R.i];
    let value;
    if (q.type === 'single') { const c = document.querySelector('input[name=rq]:checked'); value = c ? c.value : null; }
    else if (q.type === 'multi') { value = [...document.querySelectorAll('input[name=rq]:checked')].map(x => x.value); }
    else if (q.type === 'scale') { const c = document.querySelector('input[name=rq]:checked'); value = c ? Number(c.value) : null; }
    else value = ($('#rq-text').value || '').trim();
    const otherEl = $('#rq-other');
    const body = { value, sharing: $('#rq-share').value, otherText: otherEl ? otherEl.value.trim() || undefined : undefined };
    try {
      const r = await api(`/journey/${R.chatId}/reflect/answers/${q.key}`, { method: 'PUT', body });
      R.answers[q.key] = r.answer;
      if (!next) { toast('Saved'); return nav('#/journey/' + R.chatId); }
      if (R.i + 1 < R.qs.length) R_go(R.i + 1);
      else reflectDone(await api(`/journey/${R.chatId}/reflect/progress`));
    } catch (e) { toast(e.message); }
  };
  function answerText(q, a) {
    if (!a) return '';
    if (q.type === 'scale') return a.value + ' / 5';
    if (q.type === 'text') return a.value;
    const vals = Array.isArray(a.value) ? a.value : [a.value];
    return vals.map(v => (v === 'other' ? (a.otherText || 'Other') : ((q.options.find(o => o.value === v) || {}).label || v))).join(', ');
  }
  function reflectDone(prog) {
    const later = prog.mine.filter(a => a.sharing === 'share_later');
    $('#rf').innerHTML = `${back('#/journey/' + R.chatId, 'Journey')}${head('Reflect', 'Reflection complete', `You answered all ${prog.total} questions. ${prog.partnerAnswered >= prog.total ? R.match + ' has finished too.' : R.match + ' has answered ' + prog.partnerAnswered + ' of ' + prog.total + '.'}`)}
      ${later.length ? `<div class="setu-card"><h3>${later.length} answer${later.length > 1 ? 's' : ''} marked "share later"</h3><p>Decide now, or any time later.</p><div class="setu-actions"><button class="btn-primary" onclick="R_shareLater('share_with_match')">Share them with ${esc(R.match)}</button><button class="btn-ghost" onclick="R_shareLater('keep_private')">Keep them private</button></div></div>` : ''}
      <div class="setu-actions" style="margin:12px 0 20px"><button class="btn-primary" onclick="journeyComplete('${R.chatId}','reflect')">Mark Reflect complete</button><button class="btn-ghost" onclick="R_go(0)">Review my answers</button></div>
      ${prog.sharedWithMe.length ? `<h3 class="setu-h3">Shared with you by ${esc(R.match)}</h3><div class="setu-rows">${prog.sharedWithMe.map(a => { const q = R.qs.find(x => x.key === a.questionKey); return q ? `<div class="setu-row"><div><small>${esc(q.prompt)}</small><b>${esc(answerText(q, a))}</b></div></div>` : ''; }).join('')}</div>` : `<p class="setu-note">${esc(R.match)} has not shared any answers with you yet.</p>`}`;
  }
  window.R_shareLater = async (to) => {
    try {
      const prog = await api(`/journey/${R.chatId}/reflect/progress`);
      await api(`/journey/${R.chatId}/reflect/sharing`, { method: 'PATCH', body: { answers: prog.mine.filter(a => a.sharing === 'share_later').map(a => ({ questionKey: a.questionKey, sharing: to })) } });
      reflectDone(await api(`/journey/${R.chatId}/reflect/progress`));
      toast('Updated');
    } catch (e) { toast(e.message); }
  };

  // ================================================================ LAKSHAN ASSESSMENTS
  const CLS = { conflicting_evidence: 'Appears inconsistent', possible_context: 'Differs, with a likely explanation', outdated_information: 'Possibly out of date', insufficient_evidence: 'Not enough evidence', not_contradictory: 'Not a conflict' };
  const STATUS = { open: 'Awaiting your view', acknowledged: 'Acknowledged', corrected: 'Context added — with reviewers', appealed: 'Appealed — with reviewers', confirmed: 'Confirmed by a reviewer', dismissed: 'Dismissed by a reviewer' };
  window.renderLakshanAssessments = async function () {
    screen.innerHTML = `<div class="section-pad setu-page">${back('#/karma', 'Lakshan Book')}${head('Lakshan', 'Observations about you', 'Private to you. Nothing here changes how others see you unless a human reviewer confirms it — and you can always respond.')}<div id="lk"><div class="skel" style="height:120px"></div></div></div>`;
    try {
      const r = await api('/intelligence/lakshan/assessments');
      $('#lk').innerHTML = r.assessments.length ? r.assessments.map(a => `<div class="setu-card">
        <div class="eyebrow-s">${esc(CLS[a.classification] || a.classification)} · ${esc(STATUS[a.status] || a.status)}</div>
        ${a.statements.map(s => `<p class="setu-quote"><small>${s.role === 'prior' ? 'Earlier' : 'Later'} · ${esc(dateShort(s.at))}</small>${esc(s.text)}</p>`).join('')}
        <p>${esc(a.explanation)}</p>
        ${a.userResponse ? `<p class="setu-note">Your response: ${esc(a.userResponse.text || a.userResponse.action)}</p>` : ''}
        ${a.review ? `<p class="setu-note">Reviewer: ${esc(a.review.decision)}${a.review.notes ? ' — ' + esc(a.review.notes) : ''}</p>` : ''}
        <div class="setu-actions">
          ${['open'].includes(a.status) ? `<button class="btn-ghost" onclick="lakRespond('${a.id}','acknowledge')">Acknowledge</button><button class="btn-ghost" onclick="lakRespond('${a.id}','correct')">Add context</button>` : ''}
          ${a.status !== 'appealed' && a.status !== 'dismissed' ? `<button class="btn-ghost" onclick="lakRespond('${a.id}','appeal')">Appeal</button>` : ''}
        </div></div>`).join('') : '<p class="setu-note">There are no observations about you.</p>';
    } catch (e) { $('#lk').innerHTML = `<p class="setu-note">${esc(e.message)}</p>`; }
  };
  window.lakRespond = async (id, action) => {
    let text = '';
    if (action !== 'acknowledge') {
      text = await askInput({ title: action === 'appeal' ? 'Appeal this observation' : 'Add context', hint: 'A human reviewer will read this.', label: 'Your explanation', multiline: true, okText: 'Send', minLength: 3 });
      if (!text) return;
    }
    try { await api(`/intelligence/lakshan/assessments/${id}/respond`, { method: 'POST', body: { action, text } }); toast('Thank you — recorded.'); renderLakshanAssessments(); } catch (e) { toast(e.message); }
  };

  // ================================================================ native app (Capacitor) — no-op in a browser
  // Push: registers this install's FCM/APNs token with /api/v1/devices so the
  // shared backend can notify the same account on Android and iOS.
  // Deep links: https://www.sambandh.online/u/<name> and /app#/… open in-app.
  let pushDone = false;
  window.setuNativeInit = async function () {
    const cap = window.Capacitor;
    if (!cap || !(cap.isNativePlatform ? cap.isNativePlatform() : true) || !S.token) return;
    const P = cap.Plugins || {};
    if (P.App && !window._setuDeepLinks) {
      window._setuDeepLinks = true;
      P.App.addListener('appUrlOpen', (ev) => {
        try {
          const u = new URL(ev.url);
          const m = u.pathname.match(/^\/u\/([a-z0-9_]+)/);
          if (m) return nav('#/u/' + m[1]);
          if (u.hash && u.hash.indexOf('#/') === 0) return nav(u.hash);
        } catch { /* ignore malformed links */ }
      });
    }
    if (pushDone || !P.PushNotifications) return;
    pushDone = true;
    try {
      const perm = await P.PushNotifications.requestPermissions();
      if (perm.receive !== 'granted') return;
      P.PushNotifications.addListener('registration', async (t) => {
        try { await api('/v1/devices', { method: 'POST', body: { platform: cap.getPlatform ? cap.getPlatform() : 'android', token: t.value, appVersion: (window.SETU_APP_VERSION || '') } }); } catch { /* retried next launch */ }
      });
      P.PushNotifications.addListener('pushNotificationActionPerformed', (a) => {
        const url = a && a.notification && a.notification.data && a.notification.data.url;
        if (url && url.indexOf('/app#/') === 0) nav(url.slice(4));
      });
      await P.PushNotifications.register();
    } catch { /* push is optional */ }
  };
  window.addEventListener('hashchange', () => { if (S.token) window.setuNativeInit(); });
  setTimeout(() => { if (S.token) window.setuNativeInit(); }, 1500);

  // ================================================================ hooks into existing screens
  const _renderChat = window.renderChat;
  if (typeof _renderChat === 'function') {
    window.renderChat = function (chatId) {
      const p = _renderChat(chatId);
      const headEl = document.querySelector('.chat-head');
      if (headEl && !headEl.querySelector('.setu-chat-tools')) {
        headEl.insertAdjacentHTML('beforeend', `<span class="setu-chat-tools"><button title="Setu Journey" aria-label="Setu Journey" onclick="nav('#/journey/${chatId}')">${si('route')}</button><button title="Ask Setu Guide about this chat" aria-label="Ask Setu Guide about this chat" onclick="nav('#/guide/new/chat/${chatId}')">${si('guide')}</button></span>`);
      }
      return p;
    };
  }
  const _renderSettings = window.renderSettings;
  if (typeof _renderSettings === 'function') {
    window.renderSettings = async function () {
      await _renderSettings();
      const pad = screen.querySelector('.section-pad');
      if (!pad || pad.querySelector('#setu-settings')) return;
      const block = document.createElement('div');
      block.id = 'setu-settings';
      block.innerHTML = `<h3 class="setu-h3">Sambandh Setu</h3><div class="setu-index">
        <a onclick="nav('#/guide-settings')">${si('guide')}<span><b>Setu Guide &amp; privacy</b><small>Memory, web research, what it can access</small></span></a>
        <a onclick="nav('#/memory')">${si('memory')}<span><b>Memory</b><small>Review, correct or delete what Setu Guide remembers</small></span></a>
        <a onclick="nav('#/public-profile')">${si('globe')}<span><b>Public profile</b><small>Username and your page on the web</small></span></a>
        <a onclick="nav('#/lakshan')">${ic('book')}<span><b>Lakshan observations</b><small>See, add context or appeal</small></span></a>
      </div>`;
      pad.insertBefore(block, pad.children[3] || null);
    };
  }
})();

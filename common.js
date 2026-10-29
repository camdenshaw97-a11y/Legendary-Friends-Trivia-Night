/* Shared by the TV page and the phone page. */
(function () {
  'use strict';
  var F = window.Game = {};
  var H = window.Heroes, W = window.Worlds;

  // Change these to rename the game everywhere.
  F.TITLE = 'LEGENDARY FRIENDS';
  F.SUB = 'TRIVIA NIGHT';
  // Shown small on the start screens. Goes up with every change; CHANGELOG.md says what each one was.
  F.VERSION = '1.0';

  F.$ = function (sel, root) { return (root || document).querySelector(sel); };
  F.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  F.plural = function (n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); };
  F.clock = function (ms) {
    var s = Math.max(0, Math.ceil(ms / 1000)), m = Math.floor(s / 60), h = Math.floor(m / 60);
    s = s % 60; m = m % 60;
    return (h ? h + ':' + (m < 10 ? '0' : '') : '') + m + ':' + (s < 10 ? '0' : '') + s;
  };
  F.num = function (n) { return String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };

  F.store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) { /* private mode */ } }
  };

  /* ---- live connection with automatic reconnect ---- */
  F.connect = function (opts) {
    var ws = null, timer = null, tries = 0, stopped = false;
    var myBuild = document.documentElement.getAttribute('data-build');
    function freshCheck() {
      if (!myBuild || !window.fetch) return;
      fetch('/version', { cache: 'no-store' }).then(function (r) { return r.ok ? r.text() : ''; }).then(function (v) {
        if (!/^[0-9a-f]{12}$/.test(v) || v === myBuild) return;
        var last = Number(F.store.get('lf.reloadAt', 0));
        if (Date.now() - last < 30000) return;
        F.store.set('lf.reloadAt', Date.now());
        try { sessionStorage.setItem('lf.auto', '1'); } catch (e) { /* private mode */ }
        location.reload();
      }).catch(function () { /* offline: try again next time */ });
    }
    function open() {
      timer = null;
      if (stopped) return;
      try { ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws'); } catch (e) { return retry(); }
      var mine = ws;
      mine.onopen = function () {
        tries = 0; freshCheck();
        if (opts.onStatus) opts.onStatus(true);
        var h = opts.hello && opts.hello();
        if (h) mine.send(JSON.stringify(h));
      };
      mine.onmessage = function (e) { var m; try { m = JSON.parse(e.data); } catch (err) { return; } opts.onMessage(m); };
      mine.onclose = function () { if (ws !== mine) return; if (opts.onStatus) opts.onStatus(false); retry(); };
      mine.onerror = function () { try { mine.close(); } catch (e) { /* ignore */ } };
    }
    function retry() { if (stopped || timer) return; timer = setTimeout(open, Math.min(4000, 300 + 500 * tries++)); }
    var api = {
      send: function (m) { if (ws && ws.readyState === 1) { ws.send(JSON.stringify(m)); return true; } return false; },
      stop: function () { stopped = true; if (timer) clearTimeout(timer); try { ws.close(); } catch (e) { /* ignore */ } }
    };
    open();
    setInterval(function () { api.send({ t: 'ping' }); }, 20000);
    setInterval(function () { try { fetch('/health').catch(function () {}); freshCheck(); } catch (e) { /* ignore */ } }, 4 * 60 * 1000);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && !stopped && (!ws || ws.readyState > 1)) { if (timer) { clearTimeout(timer); timer = null; } tries = 0; open(); }
    });
    return api;
  };

  F.stayAwake = function () {
    var lock = null;
    function ask() {
      if (!navigator.wakeLock || document.hidden) return;
      try { navigator.wakeLock.request('screen').then(function (l) { lock = l; }).catch(function () {}); } catch (e) { /* not allowed here */ }
    }
    ask();
    document.addEventListener('visibilitychange', function () { if (!document.hidden) ask(); });
    document.addEventListener('click', function () { if (!lock) ask(); }, { passive: true });
  };

  F.fit = function (el, min) {
    el.style.fontSize = '';
    var size = parseFloat(getComputedStyle(el).fontSize), floor = min || size * 0.45, guard = 0;
    while ((el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) && size > floor && guard++ < 60) {
      size -= Math.max(1, size * 0.05);
      el.style.fontSize = size + 'px';
    }
  };

  var calm = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  F.motionOK = function () { return !(calm && calm.matches); };
  F.anim = function (el, frames, opts) {
    if (!el || !el.animate || !F.motionOK()) return null;
    try { return el.animate(frames, opts); } catch (e) { return null; }
  };
  F.bump = function (el, scale) {
    return F.anim(el, [{ transform: 'scale(1)' }, { transform: 'scale(' + (scale || 1.2) + ')', offset: 0.4 }, { transform: 'scale(1)' }], { duration: 380, easing: 'cubic-bezier(.3, 1.3, .5, 1)' });
  };
  F.shake = function (el) {
    return F.anim(el, [0, -6, 12, -18, 18, -14, 12, -8, 4, 0].map(function (x) { return { transform: 'translateX(' + x + 'px)' }; }), { duration: 480, easing: 'ease-out' });
  };

  /* ---- redraw a block of HTML without throwing away what is already on screen ---- */
  function keyOf(n) { return n.nodeType === 1 ? (n.getAttribute('data-key') || n.id || null) : null; }
  function morphKids(from, to) {
    var want = {}, cur = from.firstChild, next = to.firstChild, n, k, hit, c, clear;
    function id(x) { var kk = keyOf(x); return kk ? x.nodeName + '|' + kk : null; }
    function drop(x) { if (x === cur) cur = cur.nextSibling; from.removeChild(x); }
    for (n = to.firstChild; n; n = n.nextSibling) if (id(n)) want[id(n)] = 1;
    while (next) {
      n = next; next = next.nextSibling;
      while (cur && id(cur) && !want[id(cur)]) drop(cur);
      k = id(n); hit = null;
      for (c = cur; c; c = c.nextSibling) if (k ? id(c) === k : (!id(c) && c.nodeName === n.nodeName)) { hit = c; break; }
      if (hit && hit !== cur) {
        clear = true;
        for (c = cur; c !== hit; c = c.nextSibling) if (id(c) && want[id(c)]) { clear = false; break; }
        if (clear) while (cur !== hit) drop(cur);
      }
      if (hit) { if (hit === cur) cur = cur.nextSibling; else from.insertBefore(hit, cur); morphNode(hit, n); }
      else from.insertBefore(n, cur);
    }
    while (cur) drop(cur);
  }
  function morphNode(a, b) {
    if (a.nodeType !== 1) { if (a.nodeValue !== b.nodeValue) a.nodeValue = b.nodeValue; return; }
    var i, at, name;
    for (i = a.attributes.length - 1; i >= 0; i--) { name = a.attributes[i].name; if (!b.hasAttribute(name) && name.indexOf('data-fx-') !== 0) a.removeAttribute(name); }
    for (i = 0; i < b.attributes.length; i++) { at = b.attributes[i]; if (a.getAttribute(at.name) !== at.value) a.setAttribute(at.name, at.value); }
    if (a.nodeName === 'INPUT' || a.nodeName === 'TEXTAREA' || a.nodeName === 'SELECT') {
      if (document.activeElement !== a) { var v = b.getAttribute('value') || ''; if (a.value !== v) a.value = v; }
      return;
    }
    if (a.hasAttribute('data-live') || a.hasAttribute('data-static')) return;
    morphKids(a, b);
  }
  F.morph = function (root, html) { var t = document.createElement('template'); t.innerHTML = html; morphKids(root, t.content); };

  F.pressFx = function () {
    var held = null, t0 = 0;
    function release() { var b = held; held = null; if (b) setTimeout(function () { b.removeAttribute('data-fx-press'); }, Math.max(0, 110 - (performance.now() - t0))); }
    document.addEventListener('pointerdown', function (e) {
      var b = e.target.closest ? e.target.closest('button, a.tvbtn, a.link, .tap') : null;
      if (!b || b.disabled) return;
      if (held && held !== b) held.removeAttribute('data-fx-press');
      held = b; t0 = performance.now();
      b.setAttribute('data-fx-press', '');
    }, { passive: true });
    ['pointerup', 'pointercancel', 'blur'].forEach(function (ev) { addEventListener(ev, release, { passive: true }); });
    document.addEventListener('touchstart', function () {}, { passive: true });
  };

  /* ---- dialogs styled like the game ---- */
  F.dialog = function (o) {
    return new Promise(function (resolve) {
      var back = document.createElement('div');
      back.className = 'dlg-back';
      var h = '<div class="dlg" role="dialog">' + (o.title ? '<h2>' + F.esc(o.title) + '</h2>' : '') + (o.text ? '<p>' + F.esc(o.text) + '</p>' : '') + (o.html || '');
      if (o.input) h += '<input class="dlg-in" maxlength="' + (o.input.maxlength || 40) + '" placeholder="' + F.esc(o.input.placeholder || '') + '" value="' + F.esc(o.input.value || '') + '">';
      h += '<div class="dlg-row">' + (o.buttons || [{ label: 'OK', kind: 'pri', value: true }]).map(function (b, i) { return '<button class="dlg-btn ' + (b.kind || '') + '" data-i="' + i + '">' + F.esc(b.label) + '</button>'; }).join('') + '</div></div>';
      back.innerHTML = h;
      document.body.appendChild(back);
      var inp = back.querySelector('.dlg-in');
      function done(v) { back.classList.add('out'); setTimeout(function () { back.remove(); }, 180); resolve(v); }
      back.addEventListener('click', function (e) {
        var b = e.target.closest('.dlg-btn');
        if (b) { var bt = (o.buttons || [{ value: true }])[Number(b.getAttribute('data-i'))]; done(inp ? { value: bt.value, text: inp.value } : bt.value); }
        else if (e.target === back && !o.input) done(o.cancel === undefined ? false : o.cancel);
      });
      if (inp) { setTimeout(function () { inp.focus(); inp.select(); }, 60); inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { var pri = (o.buttons || []).findIndex(function (b) { return b.kind === 'pri'; }); done({ value: pri >= 0 ? o.buttons[pri].value : true, text: inp.value }); } }); }
      addEventListener('keydown', function esc(e) { if (e.key === 'Escape' && back.parentNode) { done(o.cancel === undefined ? false : o.cancel); removeEventListener('keydown', esc); } });
    });
  };
  F.confirm = function (title, text, okLabel, danger) {
    return F.dialog({ title: title, text: text, buttons: [{ label: okLabel || 'OK', kind: danger ? 'red' : 'pri', value: true }, { label: 'Cancel', kind: 'ghost', value: false }] });
  };

  /* ---- sound effects, synthesized so there are no audio files to load ---- */
  F.sfx = (function () {
    var ctx = null, muted = false, master = null;
    function ac() {
      if (!ctx) {
        var C = window.AudioContext || window.webkitAudioContext;
        if (C) { ctx = new C(); master = ctx.createGain(); master.gain.value = muted ? 0 : 1; master.connect(ctx.destination); }
      }
      if (ctx && ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    function tone(o) {
      var c = ac(); if (!c || muted) return;
      var t = c.currentTime + (o.t || 0), d = o.d || 0.3;
      var osc = c.createOscillator(), g = c.createGain();
      osc.type = o.type || 'sine';
      osc.frequency.setValueAtTime(o.f, t);
      if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t + d);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(o.g || 0.3, t + (o.a || 0.012));
      if (o.hold) g.gain.setValueAtTime(o.g || 0.3, t + d - 0.06);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      osc.connect(g); g.connect(master);
      osc.start(t); osc.stop(t + d + 0.05);
    }
    function noise(t, d, g, freq, q) {
      var c = ac(); if (!c || muted) return;
      var n = Math.floor(c.sampleRate * d), buf = c.createBuffer(1, n, c.sampleRate), data = buf.getChannelData(0);
      for (var i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
      var src = c.createBufferSource(), f = c.createBiquadFilter(), gn = c.createGain();
      src.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq || 2500; f.Q.value = q || 1.2;
      gn.gain.value = g;
      src.connect(f); f.connect(gn); gn.connect(master);
      src.start(c.currentTime + (t || 0));
    }
    function bell(f, t, g) { tone({ f: f, t: t, d: 1.0, g: g }); tone({ f: f * 2, t: t, d: 0.6, g: g * 0.35 }); tone({ f: f * 3.01, t: t, d: 0.3, g: g * 0.15 }); }
    return {
      unlock: ac, ctx: ac,
      mute: function (v) { muted = v; if (master) master.gain.setTargetAtTime(v ? 0 : 1, ctx.currentTime, 0.03); },
      isMuted: function () { return muted; },
      tick: function () { tone({ f: 1000, type: 'square', d: 0.04, g: 0.08 }); },
      join: function () { tone({ f: 660, d: 0.09, g: 0.14 }); tone({ f: 990, t: 0.08, d: 0.2, g: 0.14 }); },
      ping: function () { tone({ f: 1760, type: 'sine', d: 0.1, g: 0.14 }); tone({ f: 2349, type: 'sine', t: 0.1, d: 0.25, g: 0.12 }); },
      tap: function () { tone({ f: 880, type: 'triangle', d: 0.06, g: 0.1 }); },
      // A question lands: a two-note call.
      ask: function () { tone({ f: 523, type: 'triangle', d: 0.12, g: 0.14 }); tone({ f: 784, type: 'triangle', t: 0.12, d: 0.35, g: 0.14 }); },
      // Heroes hit the monster: a crunch and a bright ring.
      hit: function (big) { noise(0, 0.12, 0.7, 500, 0.7); tone({ f: 110, f2: 55, type: 'sawtooth', d: 0.2, g: 0.2 }); if (big) { tone({ f: 1046, type: 'sine', t: 0.1, d: 0.5, g: 0.1 }); noise(0.1, 0.3, 0.5, 2500, 0.8); } },
      // The monster hits back: low and nasty.
      strike: function () { noise(0, 0.35, 0.9, 180, 0.6); tone({ f: 70, f2: 35, type: 'sawtooth', d: 0.6, g: 0.3, hold: true }); tone({ f: 1400, f2: 300, type: 'square', d: 0.2, g: 0.06 }); },
      hurt: function () { tone({ f: 330, f2: 180, type: 'square', d: 0.18, g: 0.09 }); noise(0, 0.08, 0.4, 900); },
      coin: function () { tone({ f: 1568, type: 'square', d: 0.07, g: 0.08 }); tone({ f: 2093, type: 'square', t: 0.07, d: 0.22, g: 0.08 }); },
      coins: function () { for (var i = 0; i < 5; i++) { tone({ f: 1568 + i * 110, type: 'square', t: i * 0.06, d: 0.08, g: 0.06 }); } },
      drink: function () { tone({ f: 300, f2: 900, type: 'sine', d: 0.3, g: 0.12 }); noise(0.25, 0.08, 0.3, 3000); },
      dice: function () { for (var i = 0; i < 7; i++) noise(i * 0.08, 0.04, 0.5, 900 + i * 300); tone({ f: 520, type: 'square', t: 0.6, d: 0.08, g: 0.08 }); },
      word: function () { tone({ f: 740, type: 'square', d: 0.05, g: 0.07 }); },
      found: function () { tone({ f: 988, type: 'triangle', d: 0.08, g: 0.1 }); tone({ f: 1319, type: 'triangle', t: 0.08, d: 0.2, g: 0.1 }); },
      right: function () { [659, 784, 1047].forEach(function (f, i) { tone({ f: f, type: 'triangle', t: i * 0.08, d: i === 2 ? 0.5 : 0.12, g: 0.16 }); }); },
      wrong: function () { tone({ f: 196, type: 'sawtooth', d: 0.35, g: 0.14, hold: true }); tone({ f: 185, type: 'sawtooth', d: 0.35, g: 0.12, hold: true }); },
      down: function () { [330, 294, 262, 196].forEach(function (f, i) { tone({ f: f, type: 'triangle', t: i * 0.14, d: i === 3 ? 0.8 : 0.16, g: 0.14 }); }); },
      revive: function () { [392, 523, 659, 784].forEach(function (f, i) { tone({ f: f, type: 'triangle', t: i * 0.09, d: i === 3 ? 0.7 : 0.14, g: 0.16 }); }); bell(1568, 0.36, 0.08); },
      // A monster steps up: a growl and a drum.
      enter: function (boss) { noise(0, 0.5, 0.6, 150, 0.5); tone({ f: 60, f2: 45, type: 'sawtooth', d: 0.9, g: 0.25, hold: true }); if (boss) { for (var i = 0; i < 4; i++) noise(0.3 + i * 0.22, 0.08, 0.8, 120, 0.6); tone({ f: 98, type: 'sawtooth', t: 1.2, d: 1.2, g: 0.2 }); } },
      // A monster falls: a crash, then a fanfare.
      victory: function (boss) {
        noise(0, 0.5, 0.9, 300, 0.5); tone({ f: 90, f2: 30, type: 'sawtooth', d: 0.7, g: 0.25 });
        [523, 659, 784, 1047].forEach(function (f, i) { tone({ f: f, type: 'triangle', t: 0.5 + i * 0.1, d: i === 3 ? 1.2 : 0.16, g: 0.22 }); });
        if (boss) { [392, 523, 659, 784, 1047, 1319].forEach(function (f, i) { tone({ f: f, type: 'sawtooth', t: 1.4 + i * 0.09, d: i === 5 ? 1.6 : 0.14, g: 0.08 }); }); bell(2093, 1.9, 0.12); }
      },
      legend: function () {
        [523, 659, 784, 1047, 784, 1047, 1319, 1568].forEach(function (f, i) { tone({ f: f, type: 'triangle', t: i * 0.14, d: i === 7 ? 2.0 : 0.2, g: 0.2 }); });
        [262, 330, 392, 523].forEach(function (f) { tone({ f: f, type: 'sawtooth', t: 1.1, d: 2.2, g: 0.05 }); });
        bell(2093, 1.2, 0.12); bell(2637, 1.5, 0.08);
      },
      defeat: function () { [392, 370, 349, 311, 294, 262].forEach(function (f, i) { tone({ f: f, type: 'sawtooth', t: i * 0.3, d: i === 5 ? 1.6 : 0.32, g: 0.12 }); }); tone({ f: 65, type: 'sine', t: 1.2, d: 2.0, g: 0.3 }); },
      shop: function () { [659, 880, 1109].forEach(function (f, i) { tone({ f: f, type: 'sine', t: i * 0.1, d: 0.3, g: 0.1 }); }); },
      path: function () { noise(0, 0.1, 0.4, 700); noise(0.18, 0.1, 0.4, 600); noise(0.36, 0.1, 0.4, 800); },
      intro: function () {
        [[262, 0], [330, 0.3], [392, 0.6], [523, 0.9], [392, 1.3], [523, 1.6]].forEach(function (n) { tone({ f: n[0], type: 'triangle', t: n[1], d: n[1] === 1.6 ? 1.8 : 0.3, g: 0.15 }); });
        [131, 165, 196].forEach(function (f) { tone({ f: f, type: 'sawtooth', t: 1.6, d: 2.0, g: 0.05 }); });
      },
      buzz: function () { tone({ f: 110, type: 'square', d: 0.25, g: 0.12, hold: true }); }
    };
  })();

  /* ---- pictures ---- */
  F.emo = function (e) { return '<span class="emo">' + F.esc(e || '❓') + '</span>'; };
  // A hero as a colored medallion.
  F.heroArt = function (heroId, cls) {
    var h = H.heroById(heroId) || H.HEROES[0];
    return '<span class="med' + (cls ? ' ' + cls : '') + '" style="--c1:' + h.c1 + ';--c2:' + h.c2 + '">' + F.emo(h.pic) + '</span>';
  };
  F.stars = function (n) { var s = ''; for (var i = 0; i < 3; i++) s += '<i class="' + (i < n ? 'on' : '') + '"></i>'; return '<span class="stars">' + s + '</span>'; };
  F.bar = function (v, max, cls) {
    var pct = max ? Math.max(0, Math.min(100, 100 * v / max)) : 0;
    return '<div class="bar ' + (cls || '') + (pct <= 25 ? ' low' : '') + '"><i style="width:' + pct.toFixed(1) + '%"></i><b>' + F.num(v) + '</b></div>';
  };
  F.coins = function (n) { return '<span class="coins"><span class="emo">🪙</span>' + F.num(n) + '</span>'; };
  F.itemChip = function (id, extra) { var it = H.item(id); return it ? '<span class="chip-item">' + F.emo(it.emoji) + F.esc(it.name) + (extra || '') + '</span>' : ''; };
  F.typeBadge = function (t, finisher) { var ty = H.TYPES[t]; return '<span class="tbadge' + (finisher ? ' fin' : '') + '">' + F.emo(finisher ? '🔥' : ty.emoji) + (finisher ? 'FINISHER · ' : '') + F.esc(ty.name.toUpperCase()) + '</span>'; };

  // The game's mark: a shield with a bolt and a question mark.
  F.LOGO = '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M50 4 L88 18 V48 C88 72 70 90 50 97 C30 90 12 72 12 48 V18 Z" fill="#1b1030" stroke="#ffd36b" stroke-width="5" stroke-linejoin="round"/><path d="M50 12 L80 23 V48 C80 67 66 82 50 88 C34 82 20 67 20 48 V23 Z" fill="#3a1f6b"/><path d="M56 22 L38 52 H50 L44 78 L64 44 H52 Z" fill="#ffd36b"/><text x="31" y="60" font-family="Anton, Impact, sans-serif" font-size="30" fill="#fff" opacity=".9">?</text></svg>';

  // The world's colors onto a page.
  F.applyLook = function (el, look) {
    if (!look) return;
    var st = el.style;
    st.setProperty('--bg1', look.bg[0]); st.setProperty('--bg2', look.bg[1]); st.setProperty('--bg3', look.bg[2]);
    st.setProperty('--accent', look.accent); st.setProperty('--accent2', look.accent2); st.setProperty('--panel', look.panel);
  };
  F.scene = function (look) { return look && W ? W.scene(look.scene, look.accent) : ''; };
})();

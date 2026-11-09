'use strict';
/* Inner Weather: check in, get a small plan, use a tool. Everything stays on this phone. */
const VERSION = 'iw1';
const $ = (s, r = document) => r.querySelector(s);
function h(tag, props, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (k === 'class') e.className = v; else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v === true) e.setAttribute(k, ''); else if (v !== false && v != null) e.setAttribute(k, v);
  }
  kids.flat(9).forEach(c => { if (c == null || c === false) return; e.append(c.nodeType ? c : document.createTextNode(c)); });
  return e;
}
const val = (v, c) => typeof v === 'function' ? v(c) : v;
const buzz = n => { try { navigator.vibrate && navigator.vibrate(n || 10); } catch (e) {} };
const reduced = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2200); }

/* ---------- state ---------- */
const KEY = 'iw_v1';
let S = { name: '', log: [], used: [], worries: [], good: [], sun: [], thoughts: [], hb: { start: 0, why: [], me: [] }, onb: 0, tab: 'today' };
try { const d = JSON.parse(localStorage.getItem(KEY)); if (d) S = Object.assign(S, d); } catch (e) {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
const dayKey = t => { const d = new Date(t); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
const dayNo = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 6e4) / 864e5);
const todayLog = () => S.log.filter(e => dayKey(e.t) === dayKey(Date.now()));
const hhmm = t => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const ago = t => { const m = Math.round((Date.now() - t) / 6e4); if (m < 2) return 'just now'; if (m < 60) return m + ' min ago'; const hr = Math.round(m / 60); if (hr < 24) return hr + ' h ago'; const d = Math.round(hr / 24); return d === 1 ? 'yesterday' : d + ' days ago'; };
const CRISIS = /\b(suicid\w*|kill (my ?self|me)|end (my life|it all)|want(ed)? to die|wanna die|don'?t want to (live|be here|exist)|self[- ]?harm\w*|hurt(ing)? my ?self|cut(ting)? my ?self|no reason to live|better off without me)\b/i;

/* ---------- theme + sky ---------- */
function curWeather() { const t = todayLog(); return t.length ? t[t.length - 1].w : null; }
function theme() {
  const w = curWeather(), hr = new Date().getHours(), T = w ? WEATHER[w] : (hr >= 19 || hr < 6 ? NIGHT : { dark: false, bg: ['#ECEFF7', '#F7EEE4'], ac: '#5257C2' });
  const r = document.documentElement.style;
  r.setProperty('--bg1', T.bg[0]); r.setProperty('--bg2', T.bg[1]); r.setProperty('--ac', T.ac);
  r.setProperty('--tx', T.dark ? '#F5F1EA' : '#1C2233'); r.setProperty('--mut', T.dark ? 'rgba(245,241,234,.64)' : 'rgba(28,34,51,.62)');
  r.setProperty('--card', T.dark ? 'rgba(255,255,255,.075)' : 'rgba(255,255,255,.62)'); r.setProperty('--line', T.dark ? 'rgba(255,255,255,.16)' : 'rgba(28,34,51,.14)');
  r.setProperty('--on', T.dark ? '#16131F' : '#FFFFFF');
  document.body.classList.toggle('dark', !!T.dark);
  const m = $('meta[name=theme-color]'); if (m) m.content = T.bg[0];
  SKY.mode = w || (T === NIGHT ? 'night' : 'day'); SKY.dark = !!T.dark; skyInit();
}
const SKY = { mode: 'night', p: [], flash: 0, raf: 0 };
function skyInit() {
  const c = $('#sky'), dpr = Math.min(2, devicePixelRatio || 1), W = innerWidth, H = innerHeight;
  c.width = W * dpr; c.height = H * dpr; c.style.width = W + 'px'; c.style.height = H + 'px';
  const x = c.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); SKY.x = x; SKY.W = W; SKY.H = H;
  const R = Math.random, m = SKY.mode, P = [];
  const n = { rain: 70, storm: 120, fog: 9, cloud: 7, clear: 36, sun: 30, night: 90, day: 26 }[m] || 30;
  for (let i = 0; i < n; i++) P.push({ x: R() * W, y: R() * H, v: R(), r: R(), a: R() * 6.28 });
  SKY.p = P; cancelAnimationFrame(SKY.raf); if (reduced()) skyDraw(0); else SKY.raf = requestAnimationFrame(skyLoop);
}
function skyLoop(t) { if (!document.hidden) skyDraw(t); SKY.raf = requestAnimationFrame(skyLoop); }
function skyDraw(t) {
  const { x, W, H, p, mode } = SKY; if (!x) return; x.clearRect(0, 0, W, H);
  const blob = (cx, cy, r, col) => { const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(cx - r, cy - r, r * 2, r * 2); };
  if (mode === 'rain' || mode === 'storm') {
    const sp = mode === 'storm' ? 1.7 : 1; x.strokeStyle = mode === 'storm' ? 'rgba(210,200,255,.28)' : 'rgba(190,220,255,.3)'; x.lineWidth = 1.1; x.beginPath();
    p.forEach(d => { d.y += (6 + d.v * 6) * sp; d.x -= 1.2 * sp; if (d.y > H) { d.y = -20; d.x = Math.random() * (W + 80); } const l = 10 + d.r * 14; x.moveTo(d.x, d.y); x.lineTo(d.x - 2 * sp, d.y + l); });
    x.stroke();
    if (mode === 'storm') { if (Math.random() < .003 && SKY.flash <= 0) SKY.flash = 1; if (SKY.flash > 0) { x.fillStyle = 'rgba(220,210,255,' + SKY.flash * .16 + ')'; x.fillRect(0, 0, W, H); SKY.flash -= .04; } }
  } else if (mode === 'fog' || mode === 'cloud') {
    p.forEach((b, i) => { b.x += .15 + b.v * .25; if (b.x - 300 > W) b.x = -300; const r = 160 + b.r * 180, y = (mode === 'fog' ? H * .25 : H * .08) + (i / p.length) * H * (mode === 'fog' ? .8 : .5); blob(b.x, y, r, mode === 'fog' ? 'rgba(220,226,240,.10)' : 'rgba(255,255,255,.08)'); });
  } else if (mode === 'sun') {
    const s = 1 + Math.sin(t / 2400) * .06; blob(W * .82, H * .06, 320 * s, 'rgba(255,190,110,.55)');
    p.forEach(d => { d.y -= .15 + d.v * .3; if (d.y < -5) d.y = H + 5; x.fillStyle = 'rgba(210,110,30,' + (.12 + d.r * .2) + ')'; x.beginPath(); x.arc(d.x, d.y, 1 + d.r * 1.6, 0, 6.28); x.fill(); });
  } else if (mode === 'night') {
    p.forEach(s => { const a = .25 + .5 * Math.abs(Math.sin(t / 1600 + s.a)); x.fillStyle = 'rgba(255,248,230,' + a * (s.r > .85 ? 1 : .55) + ')'; x.beginPath(); x.arc(s.x, s.y * .75, s.r > .85 ? 1.4 : .8, 0, 6.28); x.fill(); });
    blob(W * .15, H * .9, 360, 'rgba(243,198,144,.10)');
  } else {
    blob(W * .85, H * .08, 300, mode === 'clear' ? 'rgba(130,170,210,.22)' : 'rgba(150,150,230,.18)');
    p.forEach(d => { d.y -= .1 + d.v * .2; if (d.y < -5) d.y = H + 5; x.fillStyle = 'rgba(60,80,140,' + (.06 + d.r * .12) + ')'; x.beginPath(); x.arc(d.x, d.y, 1 + d.r * 1.4, 0, 6.28); x.fill(); });
  }
}
addEventListener('resize', () => skyInit());

/* ---------- shell ---------- */
const TABI = {
  today: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v1.6M5.6 5.6l1.1 1.1M3 12h1.6M18.4 6.7l1.1-1.1"/><path d="M8.3 12a3.8 3.8 0 0 1 7.3-1.4"/><path d="M9 20h8.5a3 3 0 0 0 .3-6 4.5 4.5 0 0 0-8.6-.6A3.3 3.3 0 0 0 9 20z"/></svg>',
  tools: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.8 4.6L18.5 9l-4.7 1.4L12 15l-1.8-4.6L5.5 9l4.7-1.4z"/><path d="M18 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/></svg>',
  journal: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z"/><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3M9 7.5h6M9 11h4"/></svg>',
  me: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8.5" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/></svg>'
};
const HEARTI = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-7.5-10.1A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.8c0 5.5-7.5 10.1-7.5 10.1z"/></svg>';
const XI = '<svg width="20" height="20" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 3l12 12M15 3L3 15"/></svg>';
const CHEV = '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4l5 5-5 5"/></svg>';

function render() {
  theme();
  const app = $('#app'); app.innerHTML = '';
  const v = h('main', { class: 'view', id: 'view' });
  app.append(v, h('nav', { class: 'tabs', 'aria-label': 'Sections' }, [['today', 'Today'], ['tools', 'Tools'], ['journal', 'Journal'], ['me', 'You']].map(([k, l]) =>
    h('button', { class: 'tab' + (S.tab === k ? ' on' : ''), 'aria-current': S.tab === k ? 'page' : null, onclick: () => { S.tab = k; save(); render(); scrollTo(0, 0); } }, h('span', { html: TABI[k] }), h('small', null, l)))));
  ({ today: viewToday, tools: viewTools, journal: viewJournal, me: viewMe })[S.tab](v);
}
const helpPill = () => h('button', { class: 'helppill', onclick: openHelp, 'aria-label': 'Help now' }, h('span', { html: HEARTI }), 'Help now');
const head = (eyebrow, title) => h('header', { class: 'head' }, h('div', null, h('div', { class: 'eyebrow' }, eyebrow), h('h1', null, title)), helpPill());
const toolCard = (k, sub) => { const T = TOOLS[k]; return h('button', { class: 'tcard', onclick: () => runTool(k) }, h('span', { class: 'tdot' }), h('span', { class: 'grow' }, h('b', null, T.n), h('small', null, sub || T.d)), h('span', { class: 'tmin' }, T.min + ' min'), h('span', { class: 'chev', html: CHEV })); };

/* ---------- Today ---------- */
function greet() { const hr = new Date().getHours(); return (hr < 5 ? 'Still up' : hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening') + (S.name ? ', ' + S.name : ''); }
function planFor(w, tags) {
  const out = []; (tags || []).forEach(t => { const f = TAG_TOOL[t]; const k = f && f(w); if (k && !out.includes(k)) out.push(k); });
  PLAN[w].forEach(k => { if (!out.includes(k)) out.push(k); }); return out.slice(0, 3);
}
function viewToday(v) {
  const date = new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }), t = todayLog(), last = t[t.length - 1];
  v.append(head(date, greet()));
  if (!last) {
    v.append(h('section', { class: 'hero' }, h('h2', { class: 'display' }, 'What’s your ', h('em', null, 'inner weather'), '?'), h('p', { class: 'mut' }, 'Pick what fits right now. No wrong answers.')),
      h('div', { class: 'wgrid' }, ORDER.map((k, i) => h('button', { class: 'wtile w-' + k, style: 'animation-delay:' + i * 50 + 'ms', onclick: () => checkin(k) }, h('span', { class: 'wi', html: svgI(k, 34) }), h('b', null, WEATHER[k].n), h('small', null, WEATHER[k].d)))));
  } else {
    const W = WEATHER[last.w];
    v.append(h('section', { class: 'now card' }, h('div', { class: 'nowtop' }, h('span', { class: 'wi big', html: svgI(last.w, 46) }), h('div', null, h('div', { class: 'eyebrow' }, 'Today, ' + hhmm(last.t)), h('h2', { class: 'display sm' }, W.n), last.tags && last.tags.length ? h('small', { class: 'mut' }, last.tags.join(' · ')) : null)),
      h('p', { class: 'serif' }, FORECAST[last.w][dayNo() % 4]),
      h('button', { class: 'ghost', onclick: () => checkin() }, 'Weather changed? Check in again')));
    const note = sunFor(last.w); if (note) v.append(note);
    v.append(h('div', { class: 'sechead' }, 'Your plan for now'), h('div', { class: 'stack' }, planFor(last.w, last.tags).map(k => toolCard(k))));
  }
  v.append(h('section', { class: 'card quote' }, h('div', { class: 'eyebrow' }, 'Today’s reminder'), h('p', { class: 'serif big' }, DAILY[dayNo() % DAILY.length])),
    h('div', { class: 'sechead' }, 'Quick'), h('div', { class: 'quick' }, [['sigh', 'Breathe'], ['ground', 'Ground'], ['park', 'Park a worry'], ['heart', 'Heartbreak']].map(([k, l]) => h('button', { class: 'qbtn', onclick: () => runTool(k) }, l))));
}
function sunFor(w) {
  if (WEATHER[w].s > 2 || !S.sun.length) return null; const n = S.sun[dayNo() % S.sun.length];
  return h('section', { class: 'card sunnote' }, h('div', { class: 'eyebrow' }, 'A note from your sunny self · ' + ago(n.at)), h('p', { class: 'serif' }, n.t));
}

/* ---------- check-in ---------- */
function checkin(pre) {
  const c = { w: pre || null, tags: [] };
  const steps = [];
  if (!pre) steps.push({ t: 'custom', render: (x, next) => ({ body: [h('h2', { class: 'ftitle' }, 'What’s your inner weather now?'), h('div', { class: 'wgrid' }, ORDER.map(k => h('button', { class: 'wtile w-' + k, onclick: () => { c.w = k; next(); } }, h('span', { class: 'wi', html: svgI(k, 34) }), h('b', null, WEATHER[k].n), h('small', null, WEATHER[k].d))))] }) });
  steps.push({ t: 'custom', render: (x, next) => {
    const ta = h('textarea', { class: 'field', rows: 3, maxlength: 600, placeholder: 'Anything you want to get out (optional)', 'aria-label': 'Note' });
    const chips = h('div', { class: 'chips' }, TAGS.map(t => h('button', { class: 'chip', 'aria-pressed': 'false', onclick: e => { const on = !c.tags.includes(t); c.tags = on ? c.tags.concat(t) : c.tags.filter(z => z !== t); e.currentTarget.classList.toggle('on', on); e.currentTarget.setAttribute('aria-pressed', on); } }, t)));
    return { body: [h('span', { class: 'wi big center', html: svgI(c.w, 56) }), h('h2', { class: 'ftitle center' }, WEATHER[c.w].n), h('p', { class: 'mut center' }, 'What’s behind it? Pick any.'), chips, ta],
      foot: [h('button', { class: 'btn', onclick: () => { c.note = ta.value.trim(); finishCheckin(c); } }, 'Save and see my plan')] };
  } });
  flow(steps, { label: 'Check in' });
}
function finishCheckin(c) {
  S.log.push({ t: Date.now(), w: c.w, tags: c.tags, note: c.note || '' }); if (S.log.length > 1500) S.log.shift(); save();
  buzz(12); theme();
  if (c.note && CRISIS.test(c.note)) { closeFlow(); render(); openHelp(true); return; }
  const plan = planFor(c.w, c.tags), note = sunFor(c.w);
  FL.show({ body: [h('span', { class: 'wi big center', html: svgI(c.w, 56) }), h('div', { class: 'eyebrow center' }, 'Your forecast'), h('h2', { class: 'ftitle center serif' }, FORECAST[c.w][dayNo() % 4]), note,
    h('div', { class: 'sechead' }, 'Try one of these'), h('div', { class: 'stack' }, plan.map(k => toolCard(k)))],
  foot: [h('button', { class: 'link', onclick: () => { closeFlow(); render(); } }, 'Not now, take me home')] }, 1);
}

/* ---------- flow engine ---------- */
const FL = { el: null, timers: [], tick: 0, steps: [], i: 0, c: {}, opt: {} };
const later = (fn, ms) => { const t = setTimeout(fn, ms); FL.timers.push(t); return t; };
function clearT() { FL.timers.forEach(clearTimeout); FL.timers = []; clearInterval(FL.tick); FL.tick = 0; }
function closeFlow() { clearT(); if (FL.el) FL.el.remove(); FL.el = null; document.body.classList.remove('flowing'); }
function flow(steps, opt) {
  closeFlow(); FL.steps = steps; FL.i = 0; FL.c = (opt && opt.c) || {}; FL.opt = opt || {};
  FL.el = h('div', { class: 'flow', role: 'dialog', 'aria-modal': 'true', 'aria-label': FL.opt.label || 'Tool' }); document.body.append(FL.el); document.body.classList.add('flowing');
  FL.show = (r, prog, keep) => {
    if (!keep) clearT(); FL.el.innerHTML = '';
    FL.el.append(h('div', { class: 'ftop' }, h('div', { class: 'prog' }, h('i', { style: 'width:' + Math.round((prog == null ? FL.i / Math.max(1, FL.steps.length) : prog) * 100) + '%' })), h('button', { class: 'xbtn', 'aria-label': 'Close', html: XI, onclick: () => { closeFlow(); render(); } })),
      h('div', { class: 'fbody' }, r.body), h('div', { class: 'ffoot' }, r.foot || null));
    FL.el.scrollTop = 0; const f = FL.el.querySelector('textarea,input'); if (f && !FL.opt.nofocus) later(() => { try { f.focus({ preventScroll: true }); } catch (e) {} }, 380);
  };
  draw();
}
function next() { const st = FL.steps[FL.i]; if (st && st.after) st.after(FL.c); FL.i++; draw(); }
function draw() {
  while (FL.i < FL.steps.length && FL.steps[FL.i].when && !FL.steps[FL.i].when(FL.c)) FL.i++;
  if (FL.i >= FL.steps.length) { if (FL.opt.done) FL.opt.done(FL.c); return; }
  clearT(); FL.show(STEP[FL.steps[FL.i].t](FL.steps[FL.i], FL.c), null, true);
}
const btn = (l, fn, cls) => h('button', { class: cls || 'btn', onclick: fn }, l);
const STEP = {
  say: (s, c) => ({ body: [s.big ? h('div', { class: 'bignum' }, s.big) : null, h('h2', { class: 'ftitle' + (s.serif ? ' serif' : '') }, val(s.title, c)), s.body ? h('p', { class: 'fsub' }, val(s.body, c)) : null], foot: [btn(s.cta || 'Continue', next)] }),
  input: (s, c) => {
    const f = s.rows ? h('textarea', { class: 'field', rows: s.rows, maxlength: 4000, placeholder: s.ph || '', 'aria-label': val(s.title, c) }) : h('textarea', { class: 'field', rows: 3, maxlength: 600, placeholder: s.ph || '', 'aria-label': val(s.title, c) });
    f.value = c[s.key] || '';
    const go = () => { c[s.key] = f.value.trim(); next(); };
    return { body: [h('h2', { class: 'ftitle' }, val(s.title, c)), s.body ? h('p', { class: 'fsub' }, val(s.body, c)) : null, f], foot: [btn(s.cta || 'Continue', go), btn(s.skip ? 'Skip' : 'Skip this step', () => { c[s.key] = ''; next(); }, 'link')] };
  },
  choose: (s, c) => {
    const opts = val(s.opts, c) || [], picked = new Set();
    const list = h('div', { class: 'opts' }, opts.map(o => { const a = Array.isArray(o) ? o : [o], v = a[2] || a[0];
      return h('button', { class: 'opt', onclick: e => { if (s.multi) { picked.has(v) ? picked.delete(v) : picked.add(v); e.currentTarget.classList.toggle('on'); } else { c[s.key] = v; buzz(8); next(); } } }, h('b', null, a[0]), a[1] ? h('small', null, a[1]) : null); }));
    return { body: [h('h2', { class: 'ftitle' }, val(s.title, c)), s.body ? h('p', { class: 'fsub' }, val(s.body, c)) : null, list], foot: s.multi ? [btn('Continue', () => { c[s.key] = [...picked]; next(); }), btn('None of these', () => { c[s.key] = []; next(); }, 'link')] : null };
  },
  breath: (s) => {
    const P = { sigh: [['Breathe in', 1.3, 2000], ['A little more', 1.55, 800], ['Long breath out', .72, 5200]], slow: [['In, 2, 3, 4', 1.5, 4000], ['Out, 2, 3, 4, 5, 6', .72, 6000]] }[s.p];
    const orb = h('div', { class: 'orb' }), cue = h('div', { class: 'cue' }, 'Get comfortable'), cnt = h('div', { class: 'mut small center' }, '');
    later(() => { let n = 0; const round = () => { n++; cnt.textContent = n + ' of ' + s.r; let t = 0; P.forEach(([l, sc, ms]) => { later(() => { cue.textContent = l; orb.style.transitionDuration = (reduced() ? .01 : ms / 1000) + 's'; orb.style.transform = 'scale(' + sc + ')'; }, t); t += ms; }); later(() => { if (n < s.r) round(); else { cue.textContent = 'Well done'; buzz(20); later(next, 1200); } }, t + 150); }; round(); }, 900);
    return { body: [h('div', { class: 'orbwrap' }, orb), cue, cnt], foot: [btn('Skip', next, 'link')] };
  },
  timer: (s, c) => {
    const sec = val(s.sec, c), R = 54, C = 2 * Math.PI * R, time = h('div', { class: 'ttime', role: 'timer' }), msg = h('p', { class: 'fsub center tmsg' }, s.msgs ? s.msgs[0] : '');
    const ring = h('div', { class: 'ring', html: '<svg viewBox="0 0 120 120" width="200" height="200" aria-hidden="true"><circle cx="60" cy="60" r="' + R + '" fill="none" stroke="var(--line)" stroke-width="5"/><circle class="arc" cx="60" cy="60" r="' + R + '" fill="none" stroke="var(--ac)" stroke-width="5" stroke-linecap="round" stroke-dasharray="' + C + '" stroke-dashoffset="0" transform="rotate(-90 60 60)"/></svg>' }); ring.append(time);
    const go = btn('I’m done', next), t0 = Date.now(); let mi = 0;
    const upd = () => { const el = Math.round((Date.now() - t0) / 1000), left = Math.max(0, sec - el); time.textContent = Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0'); const a = ring.querySelector('.arc'); if (a) a.style.strokeDashoffset = C * (1 - left / sec);
      if (s.msgs) { const k = Math.min(s.msgs.length - 1, Math.floor(el / Math.max(30, sec / s.msgs.length))); if (k !== mi) { mi = k; msg.classList.remove('in'); void msg.offsetWidth; msg.textContent = s.msgs[k]; msg.classList.add('in'); } }
      if (left <= 0) { clearInterval(FL.tick); FL.tick = 0; buzz([60, 80, 60]); go.textContent = 'Continue'; time.textContent = 'Done'; } };
    later(() => { upd(); FL.tick = setInterval(upd, 500); }, 10); upd();
    return { body: [h('h2', { class: 'ftitle center' }, val(s.title, c)), s.body ? h('p', { class: 'fsub center' }, val(s.body, c)) : null, ring, msg], foot: [go] };
  },
  burn: (s, c) => {
    const txt = (c[s.key] || '').trim(); if (!txt) { later(next, 0); return { body: [] }; }
    const paper = h('div', { class: 'paper' }, txt.split(/(\s+)/).map((w, i) => /\s/.test(w) ? w : h('span', { style: '--d:' + (Math.random() * .9).toFixed(2) + 's' }, w)));
    const b = btn('Let it burn', () => { b.disabled = true; paper.classList.add('burn'); buzz(15); later(() => { c[s.key] = ''; next(); }, reduced() ? 80 : 2300); });
    return { body: [h('h2', { class: 'ftitle center' }, 'Ready to let it go?'), paper], foot: [b] };
  },
  custom: (s, c) => s.render(c, next)
};

/* ---------- running tools, with an honest "did it help?" ---------- */
function runTool(k) {
  const T = TOOLS[k]; if (!T) return; if (T.custom) { closeFlow(); T.custom(); return; }
  const steps = T.steps.slice();
  flow(steps, { label: T.n, done: c => { if (T.save) T.save(c); save(); if (T.noRate) { closeFlow(); render(); toast('Saved'); } else rate(k); } });
}
function rate(k) {
  FL.show({ body: [h('div', { class: 'eyebrow center' }, TOOLS[k].n), h('h2', { class: 'ftitle center' }, 'How do you feel now?'), h('p', { class: 'fsub center' }, 'Your answer teaches your journal what helps you.'),
    h('div', { class: 'opts' }, [['Better', 2], ['About the same', 1], ['Worse', 0]].map(([l, r]) => h('button', { class: 'opt', onclick: () => { S.used.push({ t: Date.now(), k, r }); if (S.used.length > 1500) S.used.shift(); save(); ending(k, r); } }, h('b', null, l))))] }, 1);
}
function ending(k, r) {
  const home = () => { closeFlow(); render(); };
  if (r === 2) FL.show({ body: [h('div', { class: 'orbwrap sm' }, h('div', { class: 'orb calm' })), h('h2', { class: 'ftitle center serif' }, 'Notice what helped.'), h('p', { class: 'fsub center' }, 'It is saved, so next time you can reach for it faster.')], foot: [btn('Back home', home)] }, 1);
  else if (r === 1) { const alt = ['sigh', 'ground', 'lift', 'kind', 'thought'].filter(x => x !== k).slice(0, 2);
    FL.show({ body: [h('h2', { class: 'ftitle center serif' }, 'That is okay.'), h('p', { class: 'fsub center' }, 'Some weather needs more than one tool. Want to try another?'), h('div', { class: 'stack' }, alt.map(x => toolCard(x)))], foot: [btn('Back home', home, 'link')] }, 1); }
  else FL.show({ body: [h('h2', { class: 'ftitle center serif' }, 'Thank you for being honest.'), h('p', { class: 'fsub center' }, 'Some moments are too big for an app. Let’s slow your body down, or reach someone.')],
    foot: [btn('Breathe with me', () => runTool('sigh')), btn('Help now', () => openHelp()), btn('Back home', home, 'link')] }, 1);
}

/* ---------- help now (always one tap away) ---------- */
function openHelp(fromNote) {
  closeFlow(); flow([{ t: 'custom', render: () => ({ body: [
    h('div', { class: 'eyebrow center' }, 'Help now'),
    h('h2', { class: 'ftitle center serif' }, fromNote ? 'Thank you for telling me. You matter, and you do not have to hold this alone.' : 'You do not have to hold this alone.'),
    h('div', { class: 'stack' },
      h('a', { class: 'hcard urgent', href: 'tel:988' }, h('b', null, 'Call 9-8-8'), h('small', null, 'Free, 24/7 suicide and crisis line in Canada and the US')),
      h('a', { class: 'hcard', href: 'sms:988' }, h('b', null, 'Text 9-8-8'), h('small', null, 'If talking feels like too much')),
      h('a', { class: 'hcard', href: 'https://findahelpline.com', target: '_blank', rel: 'noopener' }, h('b', null, 'Outside Canada and the US'), h('small', null, 'Find a free helpline in your country')),
      h('button', { class: 'hcard', onclick: () => runTool('reach') }, h('b', null, 'Message someone you trust'), h('small', null, 'Ready-made words, so you only need to press send')),
      h('button', { class: 'hcard', onclick: () => runTool('sigh') }, h('b', null, 'Slow my body down first'), h('small', null, 'One minute of calming breaths'))),
    h('p', { class: 'mut small center', style: 'margin-top:16px' }, 'If you are in immediate danger, call your local emergency number (911 in North America).')] }) }], { label: 'Help now', nofocus: true });
}

/* ---------- custom tools ---------- */
function sheetFlow(title, sub, build) { flow([{ t: 'custom', render: () => { const b = h('div'); const redraw = () => { b.innerHTML = ''; build(b, redraw); }; redraw(); return { body: [h('h2', { class: 'ftitle' }, title), sub ? h('p', { class: 'fsub' }, sub) : null, b] }; } }], { label: title, nofocus: true }); }
function addRow(ph, onAdd, label) {
  const inp = h('input', { class: 'field one', maxlength: 200, placeholder: ph, 'aria-label': ph, enterkeyhint: 'done' });
  const go = () => { const t = inp.value.trim(); if (t) { onAdd(t); } };
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  return h('div', { class: 'addrow' }, inp, h('button', { class: 'btn sm', onclick: go }, label || 'Add'));
}
function openPark() {
  sheetFlow('Worry park', 'Write it down and park it. You do not have to carry it right now. Look again later; most worries shrink.', (b, redraw) => {
    const open = S.worries.filter(w => !w.r), done = S.worries.filter(w => w.r), gone = done.filter(w => w.r === 'gone').length;
    b.append(addRow('What is the worry?', t => { S.worries.unshift({ t, at: Date.now(), r: null }); save(); toast('Parked. Set it down for now.'); redraw(); }, 'Park'));
    if (done.length >= 3) b.append(h('div', { class: 'insight' }, h('b', null, gone + ' of ' + done.length), ' worries you parked never happened.'));
    if (!open.length) b.append(h('p', { class: 'mut small' }, 'Nothing parked right now.'));
    open.slice(0, 15).forEach(w => b.append(h('div', { class: 'wrow' }, h('div', { class: 'serif' }, w.t), h('small', { class: 'mut' }, 'Parked ' + ago(w.at) + '. Is it still a problem?'),
      h('div', { class: 'chips' }, [['Didn’t happen', 'gone'], ['Let it go', 'letgo'], ['Still real', 'real']].map(([l, k]) => h('button', { class: 'chip', onclick: () => { if (k === 'real') { w.at = Date.now(); toast('Kept. Try one small step on it.'); } else w.r = k; save(); redraw(); } }, l))))));
  });
}
function openReach() {
  sheetFlow('Reach out', 'Connection is one of the strongest protectors of mood. Pick a message, then choose who gets it.', b => {
    REACH.forEach(m => b.append(h('div', { class: 'wrow' }, h('div', { class: 'serif' }, m), h('div', { class: 'chips' },
      h('button', { class: 'chip on', onclick: async () => { try { if (navigator.share) await navigator.share({ text: m }); else { await navigator.clipboard.writeText(m); toast('Copied'); } } catch (e) {} } }, 'Send'),
      h('button', { class: 'chip', onclick: async () => { try { await navigator.clipboard.writeText(m); toast('Copied'); } catch (e) { toast('Could not copy'); } } }, 'Copy')))));
  });
}
function openHeart() {
  const hb = S.hb;
  sheetFlow('Heartbreak kit', null, (b, redraw) => {
    const days = hb.start ? Math.max(1, Math.floor((Date.now() - hb.start) / 864e5) + 1) : 0;
    b.append(h('div', { class: 'card hbhero' }, days ? [h('div', { class: 'eyebrow' }, 'Healing'), h('div', { class: 'display' }, 'Day ' + days), h('p', { class: 'mut small' }, 'This count never resets. Healing is not a straight line, and a hard day does not undo the others.')]
      : [h('div', { class: 'eyebrow' }, 'Healing days'), h('p', { class: 'mut small' }, 'Count the days since it ended. It never resets, even if you slip.'), h('button', { class: 'btn sm', onclick: () => { hb.start = Date.now(); save(); redraw(); } }, 'Start counting today')]),
      h('p', { class: 'serif big', style: 'margin:14px 0 4px' }, HEART_NOTES[dayNo() % HEART_NOTES.length]));
    b.append(h('div', { class: 'stack', style: 'margin-top:14px' }, toolCard('wave', 'Urge to text or check on them? Start here'), toolCard('letter'), toolCard('kind')));
    const list = (title, sub, arr, ph) => { b.append(h('div', { class: 'sechead' }, title), h('p', { class: 'mut small' }, sub), addRow(ph, t => { arr.unshift(t); save(); redraw(); }));
      arr.forEach((t, i) => b.append(h('div', { class: 'li' }, h('span', null, t), h('button', { class: 'xs', 'aria-label': 'Remove', onclick: () => { arr.splice(i, 1); save(); redraw(); } }, '×')))); };
    list('Remember why', 'When you miss them, the mind edits out the hard parts. Keep the real reasons here, privately.', hb.why, 'A reason it ended');
    list('Rediscover you', 'Things you want to do, try or become now. Just for you.', hb.me, 'e.g. Take that pottery class');
    if (hb.start) b.append(h('button', { class: 'link', onclick: () => { hb.start = 0; save(); redraw(); } }, 'Stop counting days'));
  });
}
const SL = { a: null, t: 0, iv: 0 };
function stopSleep(fade) {
  clearTimeout(SL.t); clearInterval(SL.iv); const a = SL.a; SL.a = null; if (!a) return;
  if (!fade) { a.pause(); return; } let v = 1; SL.iv = setInterval(() => { v -= .05; try { a.volume = Math.max(0, v); } catch (e) {} if (v <= 0) { clearInterval(SL.iv); a.pause(); } }, 300); setTimeout(() => a.pause(), 7000);
}
function sleepStep() {
  let snd = S.sleepSnd || 'rain', mins = S.sleepMin == null ? 30 : S.sleepMin;
  const w = h('div'); const draw = () => { w.innerHTML = '';
    w.append(h('div', { class: 'sechead' }, 'Sound'), h('div', { class: 'chips' }, SLEEP_SOUNDS.concat([['None', '']]).map(([l, f]) => h('button', { class: 'chip' + (snd === f ? ' on' : ''), onclick: () => { snd = f; draw(); } }, l))),
      h('div', { class: 'sechead' }, 'Fade out after'), h('div', { class: 'chips' }, [[15, '15 min'], [30, '30 min'], [60, '1 hour'], [0, 'Never']].map(([m, l]) => h('button', { class: 'chip' + (mins === m ? ' on' : ''), onclick: () => { mins = m; draw(); } }, l)))); };
  draw();
  const start = () => { S.sleepSnd = snd; S.sleepMin = mins; save(); stopSleep(false);
    if (snd) { const a = SL.a = new Audio('../lightly/audio/ambient/' + snd + '-2.wav'); a.loop = true; a.setAttribute('playsinline', ''); a.play().catch(() => toast('Tap again to start the sound')); if (mins) SL.t = setTimeout(() => stopSleep(true), mins * 6e4); }
    FL.show({ body: [h('div', { class: 'orbwrap' }, h('div', { class: 'orb calm' })), h('h2', { class: 'ftitle center serif' }, 'Sleep well.'), h('p', { class: 'fsub center' }, snd ? (mins ? 'The sound fades out in ' + mins + ' minutes. You can lock your phone.' : 'The sound plays until you stop it.') : 'You did enough today.')],
      foot: [btn('Close', () => { closeFlow(); render(); }), snd ? btn('Stop sound', () => { stopSleep(false); closeFlow(); render(); }, 'link') : null] }, 1); };
  return { body: [h('h2', { class: 'ftitle' }, 'Now rest'), h('p', { class: 'fsub' }, 'Pick a sound for falling asleep.'), w], foot: [btn('Start', start)] };
}

/* ---------- Tools tab ---------- */
function viewTools(v) {
  v.append(head('Toolkit', 'What do you need?'));
  CATS.forEach(([t, ks]) => v.append(h('div', { class: 'sechead' }, t), h('div', { class: 'stack' }, ks.map(k => toolCard(k)))));
}

/* ---------- Journal ---------- */
function viewJournal(v) {
  v.append(head('Journal', 'Your weather'));
  if (!S.log.length) { v.append(h('div', { class: 'card' }, h('p', { class: 'serif big' }, 'Your weather history will appear here.'), h('p', { class: 'mut' }, 'Check in once or twice a day. After a week you will start to see patterns: what brings the storms, and what helps.'))); return; }
  const wk = h('div', { class: 'week' });
  for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const k = dayKey(d), es = S.log.filter(e => dayKey(e.t) === k), e = es[es.length - 1];
    wk.append(h('div', { class: 'wday' + (e ? ' has w-' + e.w : '') }, h('small', null, 'SMTWTFS'[d.getDay()]), h('span', { class: 'wi', html: e ? svgI(e.w, 22) : '' }))); }
  v.append(h('div', { class: 'card' }, h('div', { class: 'eyebrow' }, 'Last 7 days'), wk));
  const month = S.log.filter(e => Date.now() - e.t < 30 * 864e5), cnt = {}; month.forEach(e => cnt[e.w] = (cnt[e.w] || 0) + 1);
  v.append(h('div', { class: 'card' }, h('div', { class: 'eyebrow' }, 'Last 30 days · ' + month.length + ' check-ins'), h('div', { class: 'bar' }, ORDER.filter(k => cnt[k]).map(k => h('i', { class: 'w-' + k, style: 'flex:' + cnt[k], title: WEATHER[k].n }))),
    h('div', { class: 'legend' }, ORDER.filter(k => cnt[k]).map(k => h('span', null, h('i', { class: 'w-' + k }), WEATHER[k].n + ' ' + cnt[k])))));
  const ins = insights(); if (ins.length) v.append(h('div', { class: 'sechead' }, 'Patterns'), h('div', { class: 'stack' }, ins.map(t => h('div', { class: 'insight' }, t))));
  const lists = [['Good things', S.good.map(g => g.t)], ['Thoughts you reframed', S.thoughts.map(t => t.to)], ['Notes for rainy days', S.sun.map(s => s.t)]];
  lists.forEach(([t, arr]) => { if (arr.length) v.append(h('div', { class: 'sechead' }, t), h('div', { class: 'card list' }, arr.slice(0, 5).map(x => h('p', { class: 'serif' }, x)))); });
  v.append(h('div', { class: 'sechead' }, 'Check-ins'), h('div', { class: 'stack' }, S.log.slice(-30).reverse().map(e => h('div', { class: 'entry' }, h('span', { class: 'wi w-' + e.w, html: svgI(e.w, 24) }),
    h('div', { class: 'grow' }, h('b', null, WEATHER[e.w].n), h('small', { class: 'mut' }, new Date(e.t).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) + ', ' + hhmm(e.t) + (e.tags && e.tags.length ? ' · ' + e.tags.join(', ') : '')), e.note ? h('p', null, e.note) : null),
    h('button', { class: 'xs', 'aria-label': 'Delete check-in', onclick: () => { S.log = S.log.filter(x => x !== e); save(); render(); } }, '×')))));
}
function insights() {
  const out = [], L = S.log.filter(e => Date.now() - e.t < 60 * 864e5), hard = L.filter(e => WEATHER[e.w].s <= 2), soft = L.filter(e => WEATHER[e.w].s >= 4);
  const top = arr => { const c = {}; arr.forEach(e => (e.tags || []).forEach(t => { if (t !== 'No idea') c[t] = (c[t] || 0) + 1; })); const k = Object.keys(c).sort((a, b) => c[b] - c[a])[0]; return k ? [k, c[k]] : null; };
  const th = top(hard); if (th && th[1] >= 2) out.push(h('span', null, 'Rainy and stormy days most often come with ', h('b', null, th[0]), '. Worth planning a little extra care around it.'));
  const ts = top(soft); if (ts && ts[1] >= 2) out.push(h('span', null, 'Your clear and sunny days often involve ', h('b', null, ts[0]), '. Do more of what feeds that.'));
  const hrs = hard.map(e => new Date(e.t).getHours()); if (hrs.length >= 3) { const ev = hrs.filter(x => x >= 20 || x < 5).length, mo = hrs.filter(x => x >= 5 && x < 12).length;
    if (ev / hrs.length >= .5) out.push(h('span', null, 'Hard weather tends to arrive ', h('b', null, 'late at night'), '. Tiredness makes everything look darker; Wind down might help.'));
    else if (mo / hrs.length >= .5) out.push(h('span', null, 'Hard weather often shows up in the ', h('b', null, 'morning'), '. A tiny lift before your phone could help.')); }
  const by = {}; S.used.forEach(u => { by[u.k] = by[u.k] || [0, 0]; by[u.k][1]++; if (u.r === 2) by[u.k][0]++; });
  const best = Object.keys(by).filter(k => by[k][1] >= 2 && TOOLS[k]).sort((a, b) => by[b][0] / by[b][1] - by[a][0] / by[a][1])[0];
  if (best && by[best][0]) out.push(h('span', null, h('b', null, TOOLS[best].n), ' helped you ' + by[best][0] + ' of ' + by[best][1] + ' times. It is your go-to.'));
  const res = S.worries.filter(w => w.r), gone = res.filter(w => w.r === 'gone').length; if (res.length >= 3) out.push(h('span', null, h('b', null, gone + ' of ' + res.length), ' parked worries never happened.'));
  return out;
}

/* ---------- You ---------- */
function viewMe(v) {
  v.append(head('You', 'Settings'));
  const nm = h('input', { class: 'field one', maxlength: 30, value: S.name || '', placeholder: 'Your first name (optional)', 'aria-label': 'Your name' });
  nm.addEventListener('change', () => { S.name = nm.value.trim(); save(); toast('Saved'); });
  v.append(h('div', { class: 'card' }, h('div', { class: 'eyebrow' }, 'What should I call you?'), nm),
    h('div', { class: 'card' }, h('div', { class: 'eyebrow' }, 'Private by design'), h('p', null, 'No account, no ads, no tracking. Everything you write stays on this phone and nowhere else.'),
      h('div', { class: 'chips' }, h('button', { class: 'chip', onclick: exportData }, 'Download my data'), h('button', { class: 'chip', onclick: () => { if (confirm('Erase everything Inner Weather has saved on this phone?')) { localStorage.removeItem(KEY); location.reload(); } } }, 'Erase everything'))),
    h('div', { class: 'card' }, h('div', { class: 'eyebrow' }, 'How it works'), h('p', null, 'Feelings move like weather. Check in, get a small plan, use a tool for a minute or two, and say honestly whether it helped. Over time your journal learns what works for you.'),
      h('p', { class: 'mut small' }, 'The tools come from well-studied approaches: CBT thought work, DBT skills for intense emotion, behavioural activation for low mood, self-compassion, and urge surfing.')),
    h('div', { class: 'card' }, h('div', { class: 'eyebrow' }, 'Important'), h('p', null, 'Inner Weather is a self-help companion, not therapy or medical care. If low mood or anxiety lasts more than two weeks or gets in the way of your life, please talk to a doctor or therapist.'), h('button', { class: 'btn sm', onclick: () => openHelp() }, 'Crisis lines')),
    h('p', { class: 'mut small center' }, 'Inner Weather ' + VERSION));
}
function exportData() { const b = new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' }); const a = h('a', { href: URL.createObjectURL(b), download: 'inner-weather.json' }); document.body.append(a); a.click(); a.remove(); }

/* ---------- welcome ---------- */
function welcome() {
  let nm;
  flow([
    { t: 'custom', render: (c, nx) => ({ body: [h('div', { class: 'wrow3' }, ['storm', 'rain', 'sun'].map(k => h('span', { class: 'wi big w-' + k, html: svgI(k, 44) }))), h('h1', { class: 'display center' }, 'Feelings move ', h('em', null, 'like weather.')), h('p', { class: 'fsub center' }, 'Storms, fog, heavy rain, clear skies. None of them last forever.')], foot: [btn('Continue', nx)] }) },
    { t: 'custom', render: (c, nx) => ({ body: [h('h1', { class: 'display center' }, 'You are the ', h('em', null, 'sky.')), h('p', { class: 'fsub center' }, 'Not the storm. The weather passes through you. Inner Weather helps you get through it, one small step at a time.')], foot: [btn('Continue', nx)] }) },
    { t: 'custom', render: (c, nx) => { nm = h('input', { class: 'field one', maxlength: 30, placeholder: 'First name (optional)', 'aria-label': 'Your name' }); return { body: [h('h2', { class: 'ftitle center' }, 'What should I call you?'), nm], foot: [btn('Continue', () => { S.name = nm.value.trim(); nx(); })] }; } },
    { t: 'custom', render: () => ({ body: [h('h2', { class: 'ftitle center serif' }, 'Private, and honest.'), h('p', { class: 'fsub center' }, 'Everything stays on this phone. Inner Weather is a self-help companion, not therapy. If you are ever in crisis, the Help now button is always at the top.')], foot: [btn('Begin', () => { S.onb = 1; save(); closeFlow(); render(); })] }) }
  ], { label: 'Welcome' });
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
render(); if (!S.onb) welcome();
{ const g = new URLSearchParams(location.search).get('go'); if (g && S.onb) { history.replaceState(null, '', location.pathname); if (g === 'help') openHelp(); else if (g === 'checkin') checkin(); else if (TOOLS[g]) runTool(g); } }

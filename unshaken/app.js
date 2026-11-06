'use strict';
/* =========================================================
   Unshaken — a self-coaching app for steadier reactions.
   Everything runs on-device. Data lives in localStorage.
   Not therapy and not a diagnosis.
   ========================================================= */

/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const pad = n => String(n).padStart(2, '0');
const dk = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const todayKey = () => dk(new Date());
function h(tag, props, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v === true) e.setAttribute(k, '');
    else if (v !== false && v != null) e.setAttribute(k, v);
  }
  kids.flat(9).forEach(c => { if (c == null || c === false) return; e.append(c.nodeType ? c : document.createTextNode(c)); });
  return e;
}
const CHECK = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#06201C" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7.5l2.6 2.6L11 4.5"/></svg>';
const CHEV = '<svg class="chev" width="10" height="16" viewBox="0 0 10 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 2l6 6-6 6"/></svg>';
const XICON = '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 3l12 12M15 3L3 15"/></svg>';
const tick = on => h('span', { class: 'tick' + (on ? ' on' : ''), html: CHECK });
function buzz(ms = 10) { if (S.settings.haptics && navigator.vibrate) try { navigator.vibrate(ms); } catch (e) {} }
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 1900);
}
function speak(text) {
  if (!S.settings.voice || !('speechSynthesis' in window)) return;
  try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.rate = .85; u.volume = .8; speechSynthesis.speak(u); } catch (e) {}
}
const pick = (arr, seed) => arr[Math.abs(seed) % arr.length];
function dayHash(k = todayKey()) { let x = 0; for (const c of k) x = (x * 31 + c.charCodeAt(0)) >>> 0; return x; }
const fmtLong = () => new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

/* ---------- content ---------- */
const TRAITS = [
  ['Calm', 'I move slowly enough to choose.'],
  ['Patient', 'Nothing here needs an instant answer.'],
  ['Confident', 'I speak plainly and leave room for others.'],
  ['Present', 'I am here, not in tomorrow.'],
  ['Kind', 'I can be firm and still be kind.'],
  ['Focused', 'One thing, done properly.']
];
const IDENTITY = [
  'I respond. I don’t react.',
  'I feel it, name it, then choose.',
  'Other people’s noise is not my assignment.',
  'I keep the promises I make to myself.',
  'I solve what I can and release the rest.',
  'I can feel strongly and still act well.'
];
const REPS = [
  'Speak first in one conversation today.',
  'Ask the question you would normally swallow.',
  'Send the message you have been avoiding.',
  'In one conversation, talk at half your usual speed.',
  'Say “Let me think about that” once instead of answering fast.',
  'Give someone a sincere compliment.',
  'Work 25 minutes with your phone in another room.',
  'Disagree with someone calmly, with one reason.',
  'Walk for 10 minutes without your phone.',
  'Introduce yourself to someone new.',
  'Finish the smallest task you have been postponing.',
  'Ask someone for honest feedback on your work.'
];
const PROMISE_IDEAS = ['20-minute workout', 'One hour of focused work', 'Pause 5 seconds before I reply when irritated', 'In bed by 11pm', 'Walk outside for 15 minutes', 'No phone for the first 30 minutes'];
const EMOTIONS = ['Irritated', 'Angry', 'Disrespected', 'Jealous', 'Anxious', 'Afraid', 'Overwhelmed', 'Restless', 'Sad', 'Hurt', 'Embarrassed', 'Tired'];
const GROUP = { Irritated: 'heat', Angry: 'heat', Disrespected: 'heat', Jealous: 'heat', Anxious: 'fear', Afraid: 'fear', Overwhelmed: 'fear', Restless: 'fear', Sad: 'low', Hurt: 'low', Embarrassed: 'low', Tired: 'low' };
const LENSES = {
  heat: {
    note: 'Anger usually guards something you care about.',
    lenses: [
      ['Zoom out', 'Will this matter in five days? In five months? Give it the weight it will deserve then.'],
      ['Other side', 'Tone is often stress wearing a costume. What might they be dealing with that you cannot see?'],
      ['In your hands', 'You cannot control what was said. You fully control the next ten seconds.']
    ]
  },
  fear: {
    note: 'Fear predicts. It does not observe.',
    lenses: [
      ['Zoom out', 'Is this a fact, or a forecast? Write down what is true right now.'],
      ['Other side', 'What is the most likely outcome, not the worst one?'],
      ['In your hands', 'Name one thing you can do in the next hour. Do only that.']
    ]
  },
  low: {
    note: 'This is real, and it is passing through.',
    lenses: [
      ['Zoom out', 'Feelings rise and fall. This one has a shape and an end.'],
      ['Other side', 'What would you say to a friend who felt exactly this?'],
      ['In your hands', 'Pick the smallest kind thing you can do for yourself in the next ten minutes.']
    ]
  }
};
const LINES = [
  ['Buy time', 'Let me think about that and come back to you.'],
  ['Buy time', 'I want to give that a proper answer. Can we return to it shortly?'],
  ['Rude tone', 'I hear you. Let’s talk when we can both be clear.'],
  ['Rude tone', 'I’m glad to discuss this. I’d like to keep it respectful.'],
  ['Unfair claim', 'I see it differently. Here is what I understood: …'],
  ['Unfair claim', 'Help me understand what you need from me here.'],
  ['Pressure', 'I can’t commit right now. I’ll confirm by end of day.'],
  ['Pushback', 'That won’t work for me. Here is what I can do instead: …'],
  ['Exit', 'I’m going to step away for a few minutes and then come back to this.']
];
const TRIGGERS = ['Someone’s tone', 'Being ignored', 'Criticism', 'Waiting or delays', 'Money worry', 'Future worry', 'Work pressure', 'Family', 'Feeling behind', 'Tired or hungry', 'Social media', 'Something else'];
const LEVELS = [[0, 'Rippled'], [60, 'Settling'], [160, 'Steady'], [320, 'Grounded'], [560, 'Composed'], [900, 'Unshaken']];
const MOODS = ['Rough', 'Low', 'Okay', 'Good', 'Great'];
const FILMS = [
  ['Inside Out', 'Why every feeling has a job, including the loud ones.'],
  ['Inside Out 2', 'What anxiety is actually trying to do for you.'],
  ['Good Will Hunting', 'Reacting from old pain versus responding from understanding.'],
  ['The Pursuit of Happyness', 'Staying composed when the pressure is real.'],
  ['Kung Fu Panda', 'Inner peace, as a skill you can practice.'],
  ['Dead Poets Society', 'Choosing your own frame of mind.'],
  ['Soul', 'Stop postponing life while you worry about it.'],
  ['Limitless', 'Notice the real lesson: focus and presence. The pill is fiction.']
];
const BOOKS = [
  ['Meditations — Marcus Aurelius', 'A ruler’s private notes on staying level.'],
  ['Man’s Search for Meaning — Viktor Frankl', 'Between stimulus and response there is a space.'],
  ['Atomic Habits — James Clear', 'Small repeated actions beat big resolutions.']
];
const PRINCIPLES = [
  ['Name it', 'Putting a feeling into words lowers its intensity. That is why Reset asks you to name it.'],
  ['Reframe', 'Looking at the same event from another angle changes the emotion it produces.'],
  ['If–then plans', 'Deciding in advance what you will do when a trigger hits makes the response far more likely.'],
  ['Small proofs', 'Confidence is the memory of promises kept. Many tiny ones beat one huge one.'],
  ['Worry time', 'Giving worry a small window stops it from taking the whole day.'],
  ['Slow exhale', 'A longer out-breath than in-breath tells the body it is safe.']
];

/* ---------- state ---------- */
const KEY = 'unshaken_v1';
const blank = () => ({ days: {}, pauses: [], entries: [], triggers: [], worries: [], plans: [], xp: 0, settings: { voice: false, haptics: true }, name: 'Rohit' });
let S = blank();
S = load();
function load() {
  try { const d = JSON.parse(localStorage.getItem(KEY)); if (d) return Object.assign(blank(), d, { settings: Object.assign({ voice: false, haptics: true }, d.settings) }); } catch (e) {}
  const s = blank(); S = s; migrate(s); return s;
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
function migrate(s) {
  try {
    const o = JSON.parse(localStorage.getItem('calm_v1')); if (!o) return;
    Object.entries(o.promises || {}).forEach(([k, v]) => { const d = dayOf(k); d.promises = v.map(p => ({ t: p.t, d: !!p.d, x: true })); });
    Object.entries(o.challenge || {}).forEach(([k, v]) => { dayOf(k).rep = { t: v.t, d: !!v.d, x: true }; });
    (o.triggers || []).forEach(t => s.triggers.push({ ts: t.ts, trigger: t.trigger, emo: t.emotion || null, react: t.react || '', better: t.better || '' }));
    (o.wins || []).forEach(w => { const d = dayOf(w.day); d.evening = d.evening || { mood: 2, win: '' }; d.evening.win = w.text; });
    (o.pauses || []).forEach(ts => s.pauses.push({ ts, emo: null }));
  } catch (e) {}
}
function dayOf(k) { return S.days[k] || (S.days[k] = { trait: null, promises: [], rep: null, morning: false, evening: null }); }
const day = () => dayOf(todayKey());
function award(n, why) { S.xp += n; save(); toast('+' + n + ' ' + why); }
function levelInfo() {
  let i = 0; LEVELS.forEach((l, j) => { if (S.xp >= l[0]) i = j; });
  const cur = LEVELS[i], nxt = LEVELS[i + 1];
  return { name: cur[1], next: nxt ? nxt[1] : null, pct: nxt ? (S.xp - cur[0]) / (nxt[0] - cur[0]) : 1, toNext: nxt ? nxt[0] - S.xp : 0 };
}
function activity(k) {
  const d = S.days[k]; let n = 0;
  if (d) { n += d.promises.filter(p => p.d).length; if (d.morning) n++; if (d.evening) n++; if (d.rep && d.rep.d) n++; }
  n += S.pauses.filter(p => dk(new Date(p.ts)) === k).length;
  return n;
}
function streak() {
  let n = 0;
  for (let i = 0; i < 400; i++) { const d = new Date(); d.setDate(d.getDate() - i); if (activity(dk(d)) > 0) n++; else if (i > 0) break; }
  return n;
}
function heat() {
  const now = Date.now(); let t = 0;
  S.triggers.forEach(x => { const a = (now - x.ts) / 36e5; if (a < 30) t += Math.exp(-a / 6); });
  S.entries.forEach(x => { const a = (now - x.ts) / 36e5; if (a < 30 && x.heat) t += .5 * Math.exp(-a / 6); });
  return Math.min(1, t / 2);
}
function lastTriggerHours() { return S.triggers.length ? (Date.now() - Math.max(...S.triggers.map(t => t.ts))) / 36e5 : Infinity; }

/* ---------- water ---------- */
class Water {
  constructor(cv) {
    this.cv = cv; this.ctx = cv.getContext('2d'); this.t = 0; this.level = .45; this.tl = .45; this.amp = .2; this.ta = .2; this.heat = 0; this.th = 0; this.rip = []; this.run = false; this.fast = false;
    this.reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.onResize = () => this.resize(); addEventListener('resize', this.onResize); this.resize();
  }
  resize() { const d = Math.min(devicePixelRatio || 1, 2), r = this.cv.getBoundingClientRect(); this.W = r.width; this.H = r.height; this.cv.width = Math.max(1, r.width * d); this.cv.height = Math.max(1, r.height * d); this.ctx.setTransform(d, 0, 0, d, 0, 0); }
  to(o) { if (o.level != null) this.tl = o.level; if (o.amp != null) this.ta = o.amp; if (o.heat != null) this.th = o.heat; }
  snap() { this.level = this.tl; this.amp = this.ta; this.heat = this.th; }
  drop(x) { this.rip.push({ x, age: 0, a: 1 }); if (this.rip.length > 4) this.rip.shift(); }
  start() {
    if (this.run) return; this.run = true; this.last = performance.now();
    const f = now => { if (!this.run) return; const dt = Math.min(.05, (now - this.last) / 1000); this.last = now; this.step(dt); this.draw(); requestAnimationFrame(f); };
    requestAnimationFrame(f);
  }
  stop() { this.run = false; removeEventListener('resize', this.onResize); }
  step(dt) {
    this.t += dt * (this.reduce ? .15 : 1);
    const k = 1 - Math.exp(-dt * (this.fast ? 5 : 2.2));
    this.level += (this.tl - this.level) * k; this.amp += (this.ta - this.amp) * k; this.heat += (this.th - this.heat) * k;
    this.rip.forEach(r => r.age += dt); this.rip = this.rip.filter(r => r.age < 4);
  }
  draw() {
    const { ctx, W, H } = this; if (!W) return; ctx.clearRect(0, 0, W, H);
    const m = (a, b, t) => Math.round(a + (b - a) * t), c = [m(134, 240, this.heat), m(212, 179, this.heat), m(198, 90, this.heat)];
    const base = H * (1 - this.level);
    const L = [{ a: .10, f: .011, s: .55, p: 0, k: 1 }, { a: .14, f: .017, s: -.8, p: 2, k: .7 }, { a: .22, f: .026, s: 1.1, p: 4, k: .45 }];
    L.forEach((l, i) => {
      ctx.beginPath(); ctx.moveTo(0, H);
      for (let x = 0; x <= W + 6; x += 6) {
        let y = base + i * 7 + Math.sin(x * l.f + this.t * l.s + l.p) * this.amp * H * .04 * l.k + Math.sin(x * l.f * 2.3 + this.t * l.s * 1.4) * this.amp * H * .016 * l.k;
        for (const r of this.rip) { const dx = Math.abs(x - r.x); y += Math.sin(dx * .07 - r.age * 7) * r.a * 14 * Math.exp(-dx * .008) * Math.exp(-r.age * 1.1); }
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W, H); ctx.closePath();
      const g = ctx.createLinearGradient(0, base - 20, 0, H);
      g.addColorStop(0, `rgba(${c},${l.a + .12})`); g.addColorStop(1, `rgba(${c},${l.a * .3})`);
      ctx.fillStyle = g; ctx.fill();
    });
  }
}
let waters = [];
function newWater(cv) { const w = new Water(cv); waters.push(w); return w; }
function killWater(list) { list.forEach(w => w.stop()); waters = waters.filter(w => !list.includes(w)); }

/* ---------- on-device text reading ---------- */
const EMO_LEX = {
  Angry: ['angry', 'furious', 'pissed', 'mad', 'rage', 'fuming', 'snapped', 'livid'],
  Irritated: ['irritated', 'annoyed', 'frustrated', 'fed up', 'irritating', 'annoying'],
  Anxious: ['anxious', 'nervous', 'on edge', 'panicking', 'panicky', 'dread', 'uneasy', 'worried'],
  Afraid: ['scared', 'afraid', 'terrified', 'frightened'],
  Overwhelmed: ['overwhelmed', 'too much', 'drowning', 'swamped', 'can’t keep up', 'cant keep up'],
  Sad: ['sad', 'down', 'empty', 'numb', 'tearful', 'crying', 'cried', 'hopeless'],
  Embarrassed: ['embarrassed', 'ashamed', 'humiliated'],
  Disrespected: ['disrespected', 'dismissed', 'talked down', 'ignored me', 'not heard', 'unheard'],
  Jealous: ['jealous', 'envious', 'envy'],
  Tired: ['exhausted', 'drained', 'burnt out', 'burned out', 'no energy'],
  Hurt: ['hurt', 'betrayed', 'let down', 'wounded'],
  Restless: ['restless', 'antsy', 'wired', 'jittery']
};
const TRAPS = [
  [/\b(always|never|every single time|every time|everyone|no one ever|nothing ever)\b/i, 'All-or-nothing', 'One moment was stretched into “always” or “everyone.”', 'Is it every time, or this time?'],
  [/\b(disaster|ruined|the end of|can'?t handle|worst (day|thing)|this is awful|this is terrible)\b/i, 'Catastrophizing', 'The mind jumped to the worst possible ending.', 'What is the most likely outcome, not the worst one?'],
  [/\b(they must think|they think i'?m|they hate me|everyone thinks|he thinks i'?m|she thinks i'?m|judging me)\b/i, 'Mind-reading', 'This guesses what is in someone else’s head.', 'What did they actually say or do?'],
  [/\b(going to fail|will never|no point|it'?s never going to|always going to be)\b/i, 'Fortune-telling', 'A predicted bad outcome is being treated as already decided.', 'What would a version that goes okay look like?'],
  [/\b(should have|shouldn'?t have|supposed to|should be able to)\b/i, 'Should-statements', '“Should” tends to produce guilt more than change.', 'What would you say to a friend who did the same thing?'],
  [/\b(my fault|because of me|i ruined|i always mess|i always screw)\b/i, 'Taking all of it', 'Full ownership of something that probably had several causes.', 'Which part was yours, and which part was not?'],
  [/\bi'?m (so |such )?(stupid|an idiot|worthless|pathetic|a failure|useless)\b/i, 'Labeling', 'One event became a verdict on who you are.', 'What did you do, as opposed to what you are?']
];
const CRISIS = /\b(kill myself|killing myself|end my life|ending my life|want to die|wish i (was|were) dead|better off dead|no reason to live|suicide|hurt myself|self[- ]harm)\b/i;
function analyze(text) {
  const raw = text.replace(/[’]/g, '\''), low = raw.toLowerCase();
  if (CRISIS.test(raw)) return { crisis: true };
  const found = [];
  for (const [label, words] of Object.entries(EMO_LEX)) {
    for (const w of words) {
      const i = low.indexOf(w.replace(/’/g, '\'')); if (i < 0) continue;
      const before = low.slice(Math.max(0, i - 14), i);
      if (/\b(not|never|no longer)\s+(\w+\s+)?$/.test(before) || /n't\s+(\w+\s+)?$/.test(before)) continue;
      found.push(label); break;
    }
  }
  const traps = TRAPS.filter(t => t[0].test(raw)).map(t => ({ label: t[1], why: t[2], ask: t[3] }));
  return { crisis: false, emotions: found.slice(0, 4), traps: traps.slice(0, 3) };
}
function crisisCard() {
  return h('div', { class: 'crisis' },
    h('p', { class: 'title', style: 'font-size:22px' }, 'You deserve support right now.'),
    h('p', { class: 'small mut', style: 'margin:8px 0 16px' }, 'If you are thinking about harming yourself, please reach out to a person. In Canada, call or text 988 any time, free. If you are in immediate danger, call 911.'),
    h('div', { class: 'btn-row' }, h('a', { href: 'tel:988', style: 'text-decoration:none' }, h('span', { class: 'btn' }, 'Call 988')), h('a', { href: 'sms:988', style: 'text-decoration:none' }, h('span', { class: 'btn ghost' }, 'Text 988'))));
}

/* ---------- routing ---------- */
const TABS = [
  ['today', 'Today', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M3 15h18M5 19h14M12 4v4M5.6 8.6l2.2 2.2M18.4 8.6l-2.2 2.2"/></svg>'],
  ['ritual', 'Ritual', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6h11M9 12h11M9 18h11"/><path d="M3.5 6l1.2 1.2L6.8 5M3.5 12l1.2 1.2L6.8 11M3.5 18l1.2 1.2L6.8 17"/></svg>'],
  ['reset', 'Reset', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7.5" opacity=".6"/></svg>'],
  ['reflect', 'Reflect', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9a2.1 2.1 0 00-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>'],
  ['insights', 'Insights', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M5 20V12M12 20V5M19 20v-5"/></svg>']
];
let tab = 'today', seg = { reflect: 'Write', insights: 'Overview' }, later = [];
function buildTabs() {
  const box = $('#tabs'); box.innerHTML = '';
  TABS.forEach(([id, label, svg]) => {
    const isReset = id === 'reset';
    const b = h('button', { class: (tab === id ? 'on ' : '') + (isReset ? 'reset' : ''), 'aria-label': label, onclick: () => { buzz(8); if (isReset) openReset(); else { tab = id; go(); } } },
      isReset ? h('span', { class: 'ring', html: svg }) : h('span', { html: svg }), label);
    box.append(b);
  });
}
function go() {
  killWater(waters.filter(w => !w.overlay));
  const view = $('#view'); view.innerHTML = ''; later = [];
  const fn = { today: vToday, ritual: vRitual, reflect: vReflect, insights: vInsights }[tab];
  view.append(fn()); buildTabs(); window.scrollTo(0, 0);
  later.forEach(f => f()); later = [];
}
function refresh() { const y = window.scrollY; go(); window.scrollTo(0, y); }

/* ---------- overlay + sheet ---------- */
function overlay(build) {
  const ov = h('div', { class: 'ov', role: 'dialog', 'aria-modal': 'true' });
  const api = { ov, waters: [], close() { killWater(api.waters); ov.remove(); document.body.style.overflow = ''; if (api.onclose) api.onclose(); } };
  document.body.style.overflow = 'hidden';
  document.body.append(ov); build(ov, api); return api;
}
function overlayWater(ov, api, o) {
  const cv = h('canvas'); ov.prepend(cv);
  const w = newWater(cv); w.overlay = true; api.waters.push(w); w.to(o); w.snap(); w.start(); return w;
}
function sheet(children) {
  const bg = h('div', { class: 'sheet-bg', onclick: e => { if (e.target === bg) bg.remove(); } });
  const s = h('div', { class: 'sheet' }, children); bg.append(s); document.body.append(bg); return { close: () => bg.remove() };
}

/* ---------- TODAY ---------- */
function statusText() {
  const hrs = lastTriggerHours(), st = streak(), hv = heat();
  if (hrs < 3) return ['Ripples from earlier.', 'Let them settle. A Reset helps.'];
  if (hv > .15) return ['Settling.', 'It has been ' + Math.round(hrs) + ' hours since the last spike.'];
  if (st >= 2) return ['Still water.', st + ' days of showing up.'];
  return ['Still water.', 'Tap the surface. Then begin the day.'];
}
function vToday() {
  const d = day(), hr = new Date().getHours();
  const greet = hr < 5 ? 'Still up' : hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
  const cv = h('canvas');
  const [main, sub] = statusText();
  const hero = h('section', { class: 'hero', 'aria-label': 'Calm water. Tap to make a ripple.' }, cv,
    h('div', { class: 'hero-top' }, h('p', { class: 'date' }, fmtLong()), h('h1', { class: 'display' }, greet + ', ' + S.name + '.')),
    h('div', { class: 'hero-bottom' }, h('p', { class: 'status' }, main), h('p', { class: 'sub' }, sub)));
  later.push(() => {
    const w = newWater(cv), hv = heat(); w.level = .3; w.to({ level: .42, amp: .22 + .8 * hv, heat: hv }); w.start();
    hero.addEventListener('pointerdown', e => { w.drop(e.clientX - cv.getBoundingClientRect().left); buzz(8); });
  });

  const wrap = h('div', { class: 'pad' });
  let action = null;
  if (!d.morning && hr < 17) action = ['Start morning ritual', openMorning];
  else if (!d.evening && hr >= 17) action = ['Close the day', openEvening];
  if (action) wrap.append(h('div', { style: 'margin-top:26px' }, h('button', { class: 'btn', onclick: action[1] }, action[0])));

  wrap.append(h('p', { class: 'h2' }, 'Promises'));
  if (!d.promises.length) wrap.append(h('button', { class: 'row', onclick: openMorning }, h('div', { class: 'grow' }, h('div', { class: 't mut' }, 'None set yet.'), h('div', { class: 's' }, 'Make three small ones in the morning ritual.')), h('span', { html: CHEV })));
  d.promises.forEach(p => wrap.append(h('button', { class: 'row' + (p.d ? ' done on' : ''), onclick: () => togglePromise(p) }, tick(p.d), h('div', { class: 'grow t' }, p.t))));

  if (d.rep) {
    wrap.append(h('p', { class: 'h2' }, 'One uncomfortable rep'));
    wrap.append(h('button', { class: 'row' + (d.rep.d ? ' done on' : ''), onclick: () => toggleRep(d.rep) }, tick(d.rep.d), h('div', { class: 'grow t' }, d.rep.t)));
  }

  const idLine = d.trait ? (TRAITS.find(t => t[0] === d.trait) || [])[1] : null;
  wrap.append(h('p', { class: 'lead', style: 'margin-top:40px;font-style:italic' }, '“' + (idLine || pick(IDENTITY, dayHash())) + '”'));

  if (S.plans.length) {
    const p = pick(S.plans, dayHash());
    wrap.append(h('p', { class: 'h2' }, 'Your plan for today'), h('p', { class: 'lead', style: 'font-style:normal' }, 'When ' + p.when.replace(/\.$/, '') + ', I will ' + p.then.replace(/\.$/, '') + '.'));
  }
  return h('div', null, hero, wrap);
}
function togglePromise(p) {
  p.d = !p.d; if (p.d && !p.x) { p.x = true; award(10, 'promise kept'); } else save(); buzz(12); refresh();
}
function toggleRep(r) {
  r.d = !r.d; if (r.d && !r.x) { r.x = true; award(20, 'rep done'); } else save(); buzz(12); refresh();
}

/* ---------- RESET ---------- */
function openReset() {
  const st = { secs: 60, emo: null, before: 5, lens: 0, choice: null, after: 5, line: null, phaseT: null, tm: null };
  const api = overlay((ov, api) => {
    const w = overlayWater(ov, api, { level: .2, amp: .18, heat: 0 });
    const body = h('div', { class: 'ov-body' }); ov.append(body);
    const stop = () => { clearInterval(st.tm); st.tm = null; };
    const close = () => { stop(); if ('speechSynthesis' in window) speechSynthesis.cancel(); api.close(); };
    const progress = i => h('div', { class: 'ov-top' }, h('button', { class: 'x', 'aria-label': 'Close', html: XICON, onclick: close }), h('div', { class: 'prog' }, h('i', { style: 'width:' + (i / 4 * 100) + '%' })));
    const urgent = h('button', { class: 'link small', style: 'align-self:center;margin-top:10px', onclick: () => sheet([crisisCard()]) }, 'Need urgent support?');
    const show = (...kids) => { body.innerHTML = ''; body.append(...kids); };

    const s0 = () => { // choose length
      stop(); w.to({ level: .22, amp: .2, heat: 0 });
      show(progress(0), h('div', { class: 'ov-main center' },
        h('h2', { class: 'title' }, 'Let’s slow this down.'),
        h('p', { class: 'lead mut', style: 'margin:12px 0 28px' }, 'Slow breathing tells your body it is safe. The water will rise as you breathe in and fall as you breathe out.'),
        h('div', { class: 'chips', style: 'justify-content:center' }, [30, 60, 90].map(s => h('button', { class: 'chip' + (st.secs === s ? ' on' : ''), onclick: e => { st.secs = s; [...e.target.parentNode.children].forEach(c => c.classList.toggle('on', c === e.target)); } }, s + ' seconds')))),
        h('div', { class: 'ov-foot' }, h('button', { class: 'btn', onclick: s1 }, 'Begin'), h('div', { style: 'display:flex;justify-content:center' }, urgent)));
    };
    const s1 = () => { // breathe
      const word = h('div', { class: 'breath' }, 'Breathe in'), cnt = h('div', { class: 'count' }, '');
      show(progress(1), h('div', { class: 'ov-main center' }, word, cnt), h('div', { class: 'ov-foot' }, h('button', { class: 'btn ghost', onclick: s2 }, 'Skip to naming')));
      let left = st.secs, t = 0, inhale = true; w.fast = false;
      const phase = () => {
        word.textContent = inhale ? 'Breathe in' : 'Breathe out slowly';
        w.to({ level: inhale ? .72 : .2, amp: inhale ? .1 : .16 });
        speak(inhale ? 'Breathe in' : 'Breathe out'); buzz(inhale ? 20 : 12);
      };
      phase(); stop();
      st.tm = setInterval(() => {
        left--; t++; cnt.textContent = left + 's';
        const cycle = t % 10; if (cycle === 4) { inhale = false; phase(); } else if (cycle === 0) { inhale = true; phase(); }
        if (left <= 0) { stop(); s2(); }
      }, 1000);
      cnt.textContent = left + 's';
    };
    const s2 = () => { // name
      stop(); w.to({ level: .18, amp: .16, heat: 0 });
      let slider;
      const val = h('span', { class: 'big-num' }, String(st.before));
      slider = h('input', { type: 'range', min: 1, max: 10, value: st.before, 'aria-label': 'How strong is it', oninput: e => { st.before = +e.target.value; val.textContent = st.before; } });
      const next = h('button', { class: 'btn', disabled: !st.emo, onclick: s3 }, 'Continue');
      const grid = h('div', { class: 'emo-grid' }, EMOTIONS.map(e => h('button', { class: 'chip' + (st.emo === e ? ' on' : ''), onclick: ev => { st.emo = e; buzz(8); [...grid.children].forEach(c => c.classList.toggle('on', c === ev.target)); next.disabled = false; w.to({ heat: GROUP[e] === 'heat' ? .5 : .2 }); } }, e)));
      show(progress(2), h('div', { class: 'ov-main' },
        h('h2', { class: 'title' }, 'What are you feeling?'),
        h('p', { class: 'mut small', style: 'margin:8px 0 18px' }, 'Feeling it is fine. Naming it lowers its grip.'),
        grid,
        h('div', { style: 'display:flex;align-items:baseline;justify-content:space-between;margin-top:26px' }, h('span', { class: 'mut' }, 'How strong, out of 10?'), val), slider),
        h('div', { class: 'ov-foot' }, next, h('div', { style: 'display:flex;justify-content:center' }, urgent)));
    };
    const s3 = () => { // reframe
      const g = LENSES[GROUP[st.emo]], area = h('div'), tabs = h('div', { class: 'chips', style: 'margin:18px 0' });
      const draw = () => {
        area.innerHTML = ''; area.append(h('p', { class: 'lead', style: 'font-size:23px;line-height:1.4' }, g.lenses[st.lens][1]));
        [...tabs.children].forEach((c, i) => c.classList.toggle('on', i === st.lens));
      };
      g.lenses.forEach((l, i) => tabs.append(h('button', { class: 'chip', onclick: () => { st.lens = i; buzz(8); draw(); } }, l[0])));
      show(progress(3), h('div', { class: 'ov-main' }, h('h2', { class: 'title' }, 'Look at it differently.'), h('p', { class: 'mut small', style: 'margin:8px 0 0' }, g.note), tabs, area),
        h('div', { class: 'ov-foot' }, h('button', { class: 'btn', onclick: s4 }, 'Continue')));
      draw();
    };
    const s4 = () => { // choose
      const opts = [['Say nothing for now', 'Silence is a response too.'], ['Use a calm line', 'Pick words before emotion picks them.'], ['Step away for five minutes', 'Water, air, or just a different room.']];
      if (S.plans.length) { const p = pick(S.plans, dayHash()); opts.unshift(['Follow my plan', 'When ' + p.when.replace(/\.$/, '') + ', I will ' + p.then.replace(/\.$/, '') + '.']); }
      const detail = h('div'); const list = h('div');
      const sel = o => {
        st.choice = o[0]; detail.innerHTML = '';
        if (o[0] === 'Use a calm line') {
          const l = st.line || pick(LINES, Date.now() / 1000 | 0); st.line = l;
          detail.append(h('p', { class: 'lead', style: 'margin:18px 0 10px;font-size:22px' }, '“' + l[1] + '”'), h('button', { class: 'link', onclick: () => { st.line = LINES[Math.random() * LINES.length | 0]; sel(o); } }, 'Another line'));
        }
        [...list.children].forEach(c => c.classList.toggle('on', c.dataset.k === o[0])); done.disabled = false;
      };
      const done = h('button', { class: 'btn', disabled: true, onclick: s5 }, 'Continue');
      opts.forEach(o => list.append(h('button', { class: 'row', 'data-k': o[0], onclick: () => { buzz(8); sel(o); } }, tick(false), h('div', { class: 'grow' }, h('div', { class: 't' }, o[0]), h('div', { class: 's' }, o[1])))));
      show(progress(4), h('div', { class: 'ov-main' }, h('h2', { class: 'title' }, 'What will the strong version of you do?'), h('div', { style: 'margin-top:14px' }, list, detail)), h('div', { class: 'ov-foot' }, done));
    };
    const s5 = () => { // after
      const val = h('span', { class: 'big-num' }, String(st.after = Math.max(1, st.before - 2)));
      const slider = h('input', { type: 'range', min: 1, max: 10, value: st.after, 'aria-label': 'How strong now', oninput: e => { st.after = +e.target.value; val.textContent = st.after; } });
      w.to({ level: .22, heat: 0 });
      show(progress(4), h('div', { class: 'ov-main' }, h('h2', { class: 'title' }, 'How strong is it now?'), h('p', { class: 'mut small', style: 'margin:8px 0 26px' }, 'It started at ' + st.before + '. Be honest. Staying the same is useful information too.'), h('div', { style: 'display:flex;justify-content:center;margin-bottom:8px' }, val), slider),
        h('div', { class: 'ov-foot' }, h('button', { class: 'btn', onclick: finish }, 'Finish')));
    };
    const finish = () => {
      S.pauses.push({ ts: Date.now(), emo: st.emo, before: st.before, after: st.after, choice: st.choice }); save();
      const drop = st.before - st.after; award(15, 'for pausing'); buzz([20, 40, 20]);
      w.to({ level: .5, amp: .08 });
      show(h('div', { class: 'ov-main center' }, h('p', { class: 'display' }, drop > 0 ? 'Down ' + drop + (drop === 1 ? ' point.' : ' points.') : 'You paused.'),
        h('p', { class: 'lead mut', style: 'margin-top:14px' }, drop > 0 ? 'That is what changing a reaction looks like.' : 'The pause itself is the skill. It gets easier with reps.')),
        h('div', { class: 'ov-foot' }, h('button', { class: 'btn', onclick: () => { close(); refresh(); } }, 'Back to my day'), h('div', { style: 'display:flex;justify-content:center;margin-top:6px' }, h('button', { class: 'link', onclick: () => { close(); tab = 'reflect'; seg.reflect = 'Triggers'; go(); } }, 'Log what set it off'))));
    };
    api.onclose = () => { stop(); };
    s0();
  });
}

/* ---------- stepper (rituals) ---------- */
function stepper(steps, onDone, opts = {}) {
  let i = 0;
  overlay((ov, api) => {
    const body = h('div', { class: 'ov-body' }); ov.append(body);
    const render = () => {
      const s = steps[i]; body.innerHTML = '';
      const next = h('button', { class: 'btn', onclick: () => { if (s.valid && !s.valid()) return; if (i < steps.length - 1) { i++; buzz(8); render(); } else { api.close(); onDone(); } } }, i === steps.length - 1 ? (opts.finish || 'Finish') : 'Continue');
      if (s.valid) { next.disabled = !s.valid(); s.onvalid = ok => next.disabled = !ok; }
      body.append(h('div', { class: 'ov-top' }, h('button', { class: 'x', 'aria-label': 'Close', html: XICON, onclick: api.close }), h('div', { class: 'prog' }, h('i', { style: 'width:' + ((i + 1) / steps.length * 100) + '%' }))),
        h('div', { class: 'ov-main' }, s.render(api)), h('div', { class: 'ov-foot' }, next, i > 0 ? h('div', { style: 'display:flex;justify-content:center' }, h('button', { class: 'link', onclick: () => { i--; render(); } }, 'Back')) : null));
    };
    render();
  });
}

/* ---------- RITUAL ---------- */
function openMorning() {
  const d = day(); const c = { trait: d.trait || null, ps: d.promises.length ? d.promises.map(p => p.t) : ['', '', ''], rep: d.rep ? d.rep.t : pick(REPS, dayHash()) };
  stepper([
    { valid: () => !!c.trait, render() {
      const line = h('p', { class: 'lead', style: 'margin-top:22px;font-style:italic;min-height:3em' }, c.trait ? (TRAITS.find(t => t[0] === c.trait) || [])[1] : '');
      const chips = h('div', { class: 'chips' }, TRAITS.map(t => h('button', { class: 'chip' + (c.trait === t[0] ? ' on' : ''), onclick: e => { c.trait = t[0]; [...chips.children].forEach(x => x.classList.toggle('on', x === e.currentTarget)); line.textContent = t[1]; buzz(8); step.onvalid(true); } }, t[0])));
      const step = this; return h('div', null, h('h2', { class: 'title' }, 'Who are you today?'), h('p', { class: 'mut small', style: 'margin:8px 0 22px' }, 'Pick the one trait you will lead with.'), chips, line);
    } },
    { valid: () => c.ps.some(x => x.trim()), render() {
      const step = this; const inputs = c.ps.map((v, i) => h('input', { class: 'field', value: v, placeholder: 'Promise ' + (i + 1), maxlength: 90, oninput: e => { c.ps[i] = e.target.value; step.onvalid(c.ps.some(x => x.trim())); } }));
      const ideas = h('div', { class: 'chips', style: 'margin-top:14px' }, PROMISE_IDEAS.map(t => h('button', { class: 'chip', onclick: () => { const j = c.ps.findIndex(x => !x.trim()); if (j >= 0) { c.ps[j] = t; inputs[j].value = t; step.onvalid(true); } } }, t)));
      return h('div', null, h('h2', { class: 'title' }, 'Three small promises.'), h('p', { class: 'mut small', style: 'margin:8px 0 18px' }, 'Specific and doable. Confidence is the memory of promises kept.'), inputs, ideas);
    } },
    { render() {
      const t = h('p', { class: 'lead', style: 'font-size:24px;line-height:1.35;margin:22px 0' }, c.rep);
      return h('div', null, h('h2', { class: 'title' }, 'One uncomfortable rep.'), h('p', { class: 'mut small', style: 'margin:8px 0 0' }, 'A small act of courage, done on purpose, trains confidence.'), t,
        h('button', { class: 'link', onclick: () => { c.rep = REPS[Math.random() * REPS.length | 0]; t.textContent = c.rep; } }, 'Try a different one'));
    } },
    { render(api) {
      const wrap = h('div', { class: 'center', style: 'flex:1;display:flex;flex-direction:column;justify-content:center' });
      const cnt = h('div', { class: 'count' }, '45s'); const btn = h('button', { class: 'btn ghost', style: 'margin-top:30px;width:auto;padding:0 28px' }, 'Start 45 seconds');
      btn.onclick = () => { btn.remove(); let l = 45; const tm = setInterval(() => { l--; cnt.textContent = l + 's'; if (l <= 0 || !document.body.contains(wrap)) clearInterval(tm); }, 1000); };
      wrap.append(h('h2', { class: 'title' }, 'See it before it happens.'), h('p', { class: 'lead mut', style: 'margin:14px 0' }, 'Picture the hardest moment of your day. Slow breath. See yourself answer slowly, steadily, and well.'), cnt, btn);
      return wrap;
    } }
  ], () => {
    d.trait = c.trait;
    const old = d.promises; d.promises = c.ps.filter(x => x.trim()).map((t, i) => ({ t: t.trim(), d: old[i] ? old[i].d : false, x: old[i] ? old[i].x : false }));
    if (!d.rep || !d.rep.d) d.rep = { t: c.rep, d: false, x: false };
    if (!d.morning) { d.morning = true; award(15, 'morning ritual'); } else save();
    refresh();
  }, { finish: 'Start my day' });
}
function openEvening() {
  const d = day(), c = { mood: d.evening ? d.evening.mood : null, win: d.evening ? d.evening.win || '' : '', redo: d.evening ? d.evening.redo || '' : '', next: d.evening ? d.evening.next || '' : '' };
  const steps = [
    { valid: () => c.mood != null, render() {
      const step = this; const chips = h('div', { class: 'chips' }, MOODS.map((m, i) => h('button', { class: 'chip' + (c.mood === i ? ' on' : ''), onclick: e => { c.mood = i; [...chips.children].forEach(x => x.classList.toggle('on', x === e.currentTarget)); step.onvalid(true); buzz(8); } }, m)));
      return h('div', null, h('h2', { class: 'title' }, 'How was today?'), h('p', { class: 'mut small', style: 'margin:8px 0 22px' }, 'No right answer. Just the honest one.'), chips);
    } }
  ];
  if (d.promises.length || d.rep) steps.push({ render() {
    const rows = h('div'); const draw = () => { rows.innerHTML = ''; [...d.promises, d.rep].filter(Boolean).forEach(p => rows.append(h('button', { class: 'row' + (p.d ? ' done on' : ''), onclick: () => { p.d = !p.d; if (p.d && !p.x) { p.x = true; S.xp += (p === d.rep ? 20 : 10); } save(); draw(); } }, tick(p.d), h('div', { class: 'grow t' }, p.t)))); };
    draw(); return h('div', null, h('h2', { class: 'title' }, 'What did you keep?'), h('p', { class: 'mut small', style: 'margin:8px 0 12px' }, 'Tap what you did.'), rows);
  } });
  steps.push(
    { render() { return h('div', null, h('h2', { class: 'title' }, 'Where did you respond well?'), h('p', { class: 'mut small', style: 'margin:8px 0 12px' }, 'Even a little counts. This is your proof.'), h('textarea', { class: 'field', placeholder: 'e.g. I stayed quiet when the tone changed, then answered calmly.', oninput: e => c.win = e.target.value }, c.win)); } },
    { render() { return h('div', null, h('h2', { class: 'title' }, 'Anything you would redo?'), h('p', { class: 'mut small', style: 'margin:8px 0 12px' }, 'Optional. Not for guilt, only for learning.'), h('textarea', { class: 'field', placeholder: 'What happened, and what would you do next time?', oninput: e => c.redo = e.target.value }, c.redo)); } },
    { render() { return h('div', null, h('h2', { class: 'title' }, 'Tomorrow’s first step.'), h('p', { class: 'mut small', style: 'margin:8px 0 12px' }, 'One small action you will do first.'), h('input', { class: 'field', value: c.next, placeholder: 'e.g. 20-minute walk before checking my phone', oninput: e => c.next = e.target.value })); } });
  stepper(steps, () => {
    const first = !d.evening; d.evening = { mood: c.mood, win: c.win.trim(), redo: c.redo.trim(), next: c.next.trim() };
    if (first) award(20, 'evening review'); else save(); refresh();
  }, { finish: 'Close the day' });
}
function vRitual() {
  const d = day(), w = h('div');
  w.append(h('div', { class: 'screen-head' }, h('h1', { class: 'display' }, 'Ritual'), h('p', { class: 'mut' }, 'Start and end the day on purpose.')));
  const pad = h('div', { class: 'pad', style: 'margin-top:16px' });
  pad.append(
    h('button', { class: 'row' + (d.morning ? ' on' : ''), onclick: openMorning }, tick(d.morning), h('div', { class: 'grow' }, h('div', { class: 't' }, 'Morning ritual'), h('div', { class: 's' }, d.morning ? 'Done. Tap to adjust today.' : 'Trait, promises, a rep, a short rehearsal. About 3 minutes.')), h('span', { html: CHEV })),
    h('button', { class: 'row' + (d.evening ? ' on' : ''), onclick: openEvening }, tick(!!d.evening), h('div', { class: 'grow' }, h('div', { class: 't' }, 'Evening review'), h('div', { class: 's' }, d.evening ? 'Done. Tap to edit.' : 'How it went, what you kept, your win. About 2 minutes.')), h('span', { html: CHEV })));
  pad.append(h('p', { class: 'h2' }, 'If–then plans'), h('p', { class: 'mut small', style: 'margin-bottom:6px' }, 'Decide your response before the trigger arrives. It works far better than willpower in the moment.'));
  S.plans.forEach((p, i) => pad.append(h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 't' }, 'When ' + p.when.replace(/\.$/, '') + ', I will ' + p.then.replace(/\.$/, '') + '.')), h('button', { class: 'link small', onclick: () => rehearse(p) }, 'Rehearse'), h('button', { class: 'x', 'aria-label': 'Delete plan', html: XICON, onclick: () => { S.plans.splice(i, 1); save(); refresh(); } }))));
  pad.append(h('button', { class: 'btn ghost', style: 'margin-top:16px', onclick: addPlan }, 'Add a plan'));
  w.append(pad); return w;
}
function addPlan() {
  const when = h('input', { class: 'field', placeholder: 'someone raises their voice', maxlength: 80 }), then = h('input', { class: 'field', placeholder: 'take one slow breath and lower my voice', maxlength: 100 });
  const sh = sheet([h('h2', { class: 'title', style: 'margin-bottom:14px' }, 'New plan'), h('label', { class: 'mut small' }, 'When…'), when, h('label', { class: 'mut small' }, 'I will…'), then,
    h('div', { class: 'chips', style: 'margin:10px 0 18px' }, ['I feel my voice rising', 'I get a rude message', 'I start spiraling about the future'].map(t => h('button', { class: 'chip', onclick: () => when.value = t }, t))),
    h('button', { class: 'btn', onclick: () => { if (!when.value.trim() || !then.value.trim()) return toast('Fill in both'); S.plans.push({ when: when.value.trim(), then: then.value.trim() }); save(); sh.close(); refresh(); } }, 'Save plan')]);
}
function rehearse(p) {
  overlay((ov, api) => {
    const w = overlayWater(ov, api, { level: .3, amp: .15, heat: 0 }); const body = h('div', { class: 'ov-body' }); ov.append(body);
    const cnt = h('div', { class: 'count' }, '45s'); let l = 45, tm = null;
    const go2 = h('button', { class: 'btn' }, 'Start 45 seconds');
    go2.onclick = () => { go2.disabled = true; w.to({ level: .5 }); tm = setInterval(() => { l--; cnt.textContent = l + 's'; if (l <= 0) { clearInterval(tm); toast('Rehearsed'); award(10, 'rehearsal'); api.close(); } }, 1000); };
    api.onclose = () => clearInterval(tm);
    body.append(h('div', { class: 'ov-top' }, h('button', { class: 'x', html: XICON, 'aria-label': 'Close', onclick: api.close })),
      h('div', { class: 'ov-main center' }, h('p', { class: 'lead mut' }, 'Close your eyes. See it happen.'), h('p', { class: 'title', style: 'margin:18px 0' }, 'When ' + p.when.replace(/\.$/, '') + ', I will ' + p.then.replace(/\.$/, '') + '.'), cnt), h('div', { class: 'ov-foot' }, go2));
  });
}

/* ---------- REFLECT ---------- */
function segBar(key, items, onpick) {
  return h('div', { class: 'seg', role: 'tablist' }, items.map(i => h('button', { role: 'tab', class: seg[key] === i ? 'on' : '', onclick: () => { seg[key] = i; onpick(); } }, i)));
}
function vReflect() {
  const w = h('div'); w.append(h('div', { class: 'screen-head' }, h('h1', { class: 'display' }, 'Reflect'), h('p', { class: 'mut' }, 'Put it outside your head. Then look at it.')));
  w.append(segBar('reflect', ['Write', 'Triggers', 'Worries', 'Lines'], go));
  const p = h('div', { class: 'pad', style: 'margin-top:18px' });
  ({ Write: rWrite, Triggers: rTriggers, Worries: rWorries, Lines: rLines })[seg.reflect](p); w.append(p); return w;
}
function rWrite(p) {
  const ta = h('textarea', { class: 'field', placeholder: 'Write it as it comes. Nobody else reads this.', 'aria-label': 'Journal entry' }), out = h('div');
  const read = h('button', { class: 'btn', style: 'margin-top:8px', onclick: () => {
    const text = ta.value.trim(); if (text.length < 8) return toast('Write a little more first');
    const a = analyze(text); out.innerHTML = '';
    if (a.crisis) { out.append(crisisCard()); return; }
    if (a.emotions.length) out.append(h('p', { class: 'h2' }, 'What I hear'), h('div', { class: 'chips', style: 'margin-top:8px' }, a.emotions.map(e => h('span', { class: 'chip on' + (GROUP[e] === 'heat' ? ' heat' : '') }, e))));
    else out.append(h('p', { class: 'mut small', style: 'margin-top:16px' }, 'No strong feeling words found. If something is stirring, try naming it directly.'));
    if (a.traps.length) { out.append(h('p', { class: 'h2' }, 'Thinking traps')); a.traps.forEach(t => out.append(h('div', { class: 'trap' }, h('b', null, t.label), h('span', { class: 'mut small' }, t.why), h('p', { class: 'lead', style: 'font-size:17px;margin-top:6px' }, t.ask)))); }
    const rf = h('textarea', { class: 'field', placeholder: 'A fairer, calmer way to say this…', style: 'min-height:90px' });
    out.append(h('p', { class: 'h2' }, 'Reframe it'), rf, h('button', { class: 'btn', style: 'margin-top:8px', onclick: () => {
      S.entries.push({ ts: Date.now(), text, emotions: a.emotions, traps: a.traps.map(t => t.label), reframe: rf.value.trim(), heat: a.emotions.some(e => GROUP[e] === 'heat' || GROUP[e] === 'fear') }); award(10, 'entry saved'); ta.value = ''; out.innerHTML = ''; refresh();
    } }, 'Save entry'));
    out.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } }, 'Read it back');
  p.append(ta, read, out);
  if (S.entries.length) { p.append(h('p', { class: 'h2' }, 'Recent entries')); S.entries.slice(-5).reverse().forEach(e => p.append(h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 't', style: 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap' }, e.text), h('div', { class: 's' }, new Date(e.ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + (e.emotions && e.emotions.length ? ' · ' + e.emotions.join(', ') : '')))))); }
  p.append(h('p', { class: 'mut small', style: 'margin-top:26px' }, 'This reads your words on your phone only. It is a self-coaching aid, not therapy or a diagnosis.'));
}
function rTriggers(p) {
  let tr = null, emo = null; const react = h('textarea', { class: 'field', placeholder: 'What did I do or say?', style: 'min-height:80px' }), better = h('textarea', { class: 'field', placeholder: 'What would the strong version of me have done?', style: 'min-height:80px' });
  const tchips = h('div', { class: 'chips' }, TRIGGERS.map(t => h('button', { class: 'chip', onclick: e => { tr = t; [...tchips.children].forEach(c => c.classList.toggle('on', c === e.currentTarget)); } }, t)));
  const echips = h('div', { class: 'chips' }, EMOTIONS.map(t => h('button', { class: 'chip', onclick: e => { emo = t; [...echips.children].forEach(c => c.classList.toggle('on', c === e.currentTarget)); } }, t)));
  p.append(h('p', { class: 'h2', style: 'margin-top:0' }, 'What set it off?'), tchips, h('p', { class: 'h2' }, 'What did it feel like?'), echips, h('p', { class: 'h2' }, 'In your words'), react, better,
    h('button', { class: 'btn', style: 'margin-top:10px', onclick: () => { if (!tr) return toast('Pick what set it off'); S.triggers.push({ ts: Date.now(), trigger: tr, emo, react: react.value.trim(), better: better.value.trim() }); award(10, 'trigger logged'); refresh(); } }, 'Log trigger'));
  if (S.triggers.length) { p.append(h('p', { class: 'h2' }, 'Recent')); S.triggers.slice(-4).reverse().forEach(t => p.append(h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 't' }, t.trigger + (t.emo ? ' · ' + t.emo : '')), h('div', { class: 's' }, new Date(t.ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })))))); }
}
function rWorries(p) {
  const ta = h('textarea', { class: 'field', placeholder: 'What am I worried about?', style: 'min-height:80px' }), extra = h('div');
  p.append(ta, h('p', { class: 'mut', style: 'margin:10px 0 8px' }, 'Can I do something about this today?'), h('div', { class: 'btn-row' },
    h('button', { class: 'btn ghost', onclick: () => {
      if (!ta.value.trim()) return toast('Write the worry first'); extra.innerHTML = '';
      const st = h('input', { class: 'field', placeholder: 'One tiny step (5 minutes or less)' });
      extra.append(st, h('button', { class: 'btn', onclick: () => { if (!st.value.trim()) return; S.worries.push({ ts: Date.now(), text: ta.value.trim(), step: st.value.trim(), done: false }); save(); toast('One step is enough for now'); refresh(); } }, 'Save the step'));
    } }, 'Yes'),
    h('button', { class: 'btn ghost', onclick: () => { if (!ta.value.trim()) return toast('Write the worry first'); S.worries.push({ ts: Date.now(), text: ta.value.trim(), step: null, done: false }); save(); toast('Parked. Not today’s job.'); refresh(); } }, 'No, park it')), extra);
  const open = S.worries.filter(x => !x.done);
  p.append(h('p', { class: 'h2' }, 'Worry window'), h('p', { class: 'mut small' }, 'Fifteen minutes in the evening. Everything else waits.'));
  if (!open.length) p.append(h('p', { class: 'mut', style: 'margin-top:12px' }, 'Nothing parked.'));
  open.forEach(x => p.append(h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 't' }, x.text), h('div', { class: 's' }, x.step ? 'Step: ' + x.step : 'Parked')), h('button', { class: 'link small', onclick: () => { x.done = true; save(); toast('Released'); refresh(); } }, 'Release'))));
}
function rLines(p) {
  p.append(h('p', { class: 'mut small' }, 'Tap a line to copy it. Choose words before emotion chooses them.'));
  const g = {}; LINES.forEach(l => (g[l[0]] = g[l[0]] || []).push(l[1]));
  Object.entries(g).forEach(([k, ls]) => { p.append(h('p', { class: 'h2' }, k)); ls.forEach(l => p.append(h('button', { class: 'row', onclick: () => { if (navigator.clipboard) navigator.clipboard.writeText(l.replace(/ …$/, '')); toast('Copied'); buzz(8); } }, h('div', { class: 'grow lead', style: 'font-size:18px' }, '“' + l + '”')))); });
}

/* ---------- INSIGHTS ---------- */
function vInsights() {
  const w = h('div'); w.append(h('div', { class: 'screen-head' }, h('h1', { class: 'display' }, 'Insights'), h('p', { class: 'mut' }, 'What is actually changing.')));
  w.append(segBar('insights', ['Overview', 'Wins', 'Learn'], go));
  const p = h('div', { class: 'pad', style: 'margin-top:8px' }); w.append(p);
  if (seg.insights === 'Overview') iOverview(p); else if (seg.insights === 'Wins') iWins(p); else iLearn(p);
  return w;
}
function iOverview(p) {
  const lv = levelInfo(), st = streak();
  p.append(h('p', { class: 'h2' }, 'Level'), h('div', { style: 'display:flex;justify-content:space-between;align-items:baseline' }, h('span', { class: 'stat' }, lv.name), h('span', { class: 'mut small' }, S.xp + ' points')),
    h('div', { class: 'xpbar' }, h('i', { style: 'width:' + Math.round(lv.pct * 100) + '%' })),
    h('p', { class: 'mut small', style: 'margin-top:8px' }, lv.next ? lv.toNext + ' points to ' + lv.next + '.' : 'Top level reached.'));
  const rs = S.pauses.filter(x => x.before != null && x.after != null);
  const avg = rs.length ? rs.reduce((a, x) => a + (x.before - x.after), 0) / rs.length : null;
  p.append(h('p', { class: 'h2' }, 'Recovery'), h('div', { style: 'display:flex;gap:30px' },
    h('div', null, h('div', { class: 'stat' }, avg == null ? '—' : (avg > 0 ? '−' : '') + Math.abs(avg).toFixed(1)), h('div', { class: 'mut small' }, 'average drop per Reset')),
    h('div', null, h('div', { class: 'stat' }, String(st)), h('div', { class: 'mut small' }, st === 1 ? 'day active' : 'days active'))));
  if (!rs.length) p.append(h('p', { class: 'mut small', style: 'margin-top:10px' }, 'Do a Reset the next time you feel it rising. This number is your proof it works.'));
  let kept = 0, tot = 0; for (let i = 0; i < 7; i++) { const dd = new Date(); dd.setDate(dd.getDate() - i); const x = S.days[dk(dd)]; if (x) x.promises.forEach(q => { tot++; if (q.d) kept++; }); }
  p.append(h('p', { class: 'h2' }, 'Promises kept, last 7 days'), h('div', { class: 'stat' }, tot ? Math.round(kept / tot * 100) + '%' : '—'), h('p', { class: 'mut small' }, tot ? kept + ' of ' + tot : 'Set promises in the morning ritual.'));
  p.append(h('p', { class: 'h2' }, 'Last 28 days'));
  const g = h('div', { class: 'grid28' }); const now = new Date();
  for (let i = 27; i >= 0; i--) { const dd = new Date(now); dd.setDate(now.getDate() - i); const a = activity(dk(dd)); g.append(h('i', { 'data-l': a === 0 ? 0 : a < 3 ? 1 : a < 5 ? 2 : 3, class: i === 0 ? 'today' : '', title: dk(dd) })); }
  p.append(g);
  const hours = Array(24).fill(0); S.triggers.forEach(t => hours[new Date(t.ts).getHours()]++);
  p.append(h('p', { class: 'h2' }, 'When triggers happen'));
  if (S.triggers.length) { const mx = Math.max(1, ...hours); p.append(h('div', { class: 'bars' }, hours.map(v => h('i', { style: 'height:' + Math.max(4, v / mx * 100) + '%;opacity:' + (v ? .9 : .25) }))), h('div', { class: 'bars-lbl' }, h('span', null, '12am'), h('span', null, '12pm'), h('span', null, '11pm'))); }
  else p.append(h('p', { class: 'mut small', style: 'margin-top:6px' }, 'Log a few triggers and your pattern shows up here.'));
  const cnt = {}; S.triggers.forEach(t => cnt[t.trigger] = (cnt[t.trigger] || 0) + 1);
  const top = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (top.length) { p.append(h('p', { class: 'h2' }, 'Most common triggers')); top.forEach(([k, v]) => p.append(h('div', { class: 'row' }, h('div', { class: 'grow t' }, k), h('span', { class: 'mut' }, v + '×')))); }
  p.append(h('p', { class: 'h2' }, 'Settings'),
    h('button', { class: 'row' + (S.settings.haptics ? ' on' : ''), onclick: () => { S.settings.haptics = !S.settings.haptics; save(); refresh(); } }, tick(S.settings.haptics), h('div', { class: 'grow' }, h('div', { class: 't' }, 'Vibration'), h('div', { class: 's' }, 'Gentle taps on your phone'))),
    h('button', { class: 'row' + (S.settings.voice ? ' on' : ''), onclick: () => { S.settings.voice = !S.settings.voice; save(); refresh(); } }, tick(S.settings.voice), h('div', { class: 'grow' }, h('div', { class: 't' }, 'Spoken breathing guide'), h('div', { class: 's' }, 'Says “breathe in” and “breathe out”'))),
    h('button', { class: 'row', onclick: () => { const b = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' }), a = h('a', { href: URL.createObjectURL(b), download: 'unshaken-data.json' }); a.click(); } }, h('div', { class: 'grow t' }, 'Export my data')),
    h('button', { class: 'row', onclick: () => { if (confirm('Delete everything in Unshaken on this phone?')) { localStorage.removeItem(KEY); S = blank(); go(); } } }, h('div', { class: 'grow t', style: 'color:var(--amb)' }, 'Delete all data')));
}
function iWins(p) {
  const wins = []; Object.entries(S.days).forEach(([k, d]) => { if (d.evening && d.evening.win) wins.push([k, d.evening.win]); });
  wins.sort((a, b) => b[0].localeCompare(a[0]));
  if (!wins.length) { p.append(h('p', { class: 'lead mut', style: 'margin-top:26px' }, 'Your wins will collect here. Add one in the evening review.')); return; }
  p.append(h('p', { class: 'mut small', style: 'margin:14px 0 4px' }, 'Proof you are changing. Read these when you doubt it.'));
  wins.forEach(([k, t]) => p.append(h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 't' }, t), h('div', { class: 's' }, new Date(k + 'T12:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }))))));
}
function iLearn(p) {
  p.append(h('div', { class: 'note' }, h('p', { class: 'lead', style: 'font-size:17px' }, 'The goal is not to feel nothing. Pushing feelings down makes them return louder. The goal is to feel it, name it, and choose your response. Calm people do exactly that, and it can be trained.')));
  p.append(h('p', { class: 'h2' }, 'Why the app works this way'));
  PRINCIPLES.forEach(([k, v]) => p.append(h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 't' }, k), h('div', { class: 's' }, v)))));
  p.append(h('p', { class: 'h2' }, 'Watch'));
  FILMS.forEach(([k, v]) => p.append(h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 't' }, k), h('div', { class: 's' }, v)))));
  p.append(h('p', { class: 'h2' }, 'Read'));
  BOOKS.forEach(([k, v]) => p.append(h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 't' }, k), h('div', { class: 's' }, v)))));
  p.append(h('p', { class: 'mut small', style: 'margin-top:28px' }, 'If anger or low mood feels constant or out of your control, talking with a doctor or therapist is a strong move. This app supports the habit. It does not replace care.'));
}

/* ---------- boot ---------- */
document.addEventListener('visibilitychange', () => waters.forEach(w => { if (document.hidden) w.run = false; else if (!w.run) w.start(); }));
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
go();

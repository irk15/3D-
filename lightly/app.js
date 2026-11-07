'use strict';
/* Lightly — short lines that calm you, wake you up, and lighten how a situation looks.
   Everything stays on your phone. */

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
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 1700); }
const HEART = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M12 20.5s-7.5-4.6-7.5-10.1A4.3 4.3 0 0112 7.6a4.3 4.3 0 017.5 2.8c0 5.5-7.5 10.1-7.5 10.1z"/></svg>';
const PLAY = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg>';
const STOP = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6.5" y="6.5" width="11" height="11" rx="2"/></svg>';
const MIC = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2"/></svg>';
const LIST = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M5 7h14M5 12h14M5 17h9"/></svg>';
const XI = '<svg width="20" height="20" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 3l12 12M15 3L3 15"/></svg>';

/* ---------- lines ---------- */
// Each line is [text, author?]. Unattributed lines are original to this app.

const SPIRIT = 'In the spirit of Osho';
// [punch, author, insight]. Original wording inspired by themes in Osho's teachings: witnessing, freedom, presence, celebration.
const OSHO = [
  ['You are not the storm. You are the sky.', SPIRIT, 'Anger, fear and doubt cross you and leave. The one who watches them never moves.'],
  ['Reaction is a puppet string.', SPIRIT, 'Whoever pulls it owns your mood. Pause for one breath, and the string goes slack.'],
  ['An insult has no owner until you accept it.', SPIRIT, 'Let it fall at their feet. What you refuse to take stays theirs.'],
  ['Be an original. Copies are cheap.', SPIRIT, 'Nobody has ever lived your life. Stop auditioning for someone else’s.'],
  ['Fear is excitement that has not found courage yet.', SPIRIT, 'Take one step toward it and watch it change its name.'],
  ['Life is not a problem. It is a dance.', SPIRIT, 'You have been trying to solve what was only ever meant to be lived. Move.'],
  ['Tomorrow is a rumor.', SPIRIT, 'This breath is the only thing you actually own. Spend it well.'],
  ['Nobody is coming to rescue you. Beautiful.', SPIRIT, 'That also means nobody can hold you back. The keys were always in your pocket.'],
  ['Your mind is a servant. Stop letting it rule.', SPIRIT, 'Thoughts make fine tools and terrible masters. Take back the keys.'],
  ['Fall in love with your own company.', SPIRIT, 'When you are enough alone, everyone else becomes a gift instead of a need.'],
  ['Safety is a comfortable cage.', SPIRIT, 'The door was never locked. Walk out and meet the sky.'],
  ['Mistakes are tuition for becoming real.', SPIRIT, 'Nobody learned to dance without stepping on a foot. Pay it, and graduate.'],
  ['Lighten up. You were never getting out alive anyway.', SPIRIT, 'Seriousness is a heavy coat. Take it off and feel the sun.'],
  ['Love is not hunger. It is overflow.', SPIRIT, 'Do not look for someone to fill you. Become full, then spill.'],
  ['Peace is what is left when you stop fighting.', SPIRIT, 'You are not missing it. You are standing on it.'],
  ['Worry is rehearsing a play that never opens.', SPIRIT, 'Close the theatre. Walk out into the actual day.'],
  ['Be alert, not anxious.', SPIRIT, 'Alertness is open and relaxed. Anxiety is clenched. Soften your hands and see more.'],
  ['Question everything you inherited.', SPIRIT, 'Keep what is true for you. Burn the rest without apology.'],
  ['The past is a corpse. Why are you carrying it?', SPIRIT, 'Bury it with respect and walk lighter into the living day.'],
  ['You do not need permission to exist.', SPIRIT, 'The sun never waits for applause before it rises. Rise.'],
  ['Silence answers what noise cannot.', SPIRIT, 'Sit still long enough and the questions begin to dissolve on their own.'],
  ['Feel it fully and it burns clean.', SPIRIT, 'Suppress it and it smolders for years. Let it burn out in the open.'],
  ['Open the fist.', SPIRIT, 'Only an open hand can receive anything. What you grip, grips you back.'],
  ['Take the mask off tonight.', SPIRIT, 'A mask worn long enough starts to feel like a face. Breathe as yourself.'],
  ['Real strength is soft.', SPIRIT, 'The tree that bends survives the storm. Rigid things break.'],
  ['The crowd is comfortable, and rarely right.', SPIRIT, 'Do not be rude to it. Just do not hand it your life.'],
  ['Joy that needs a reason is a hostage.', SPIRIT, 'Be happy first, for no reason at all. Reasons will follow you.'],
  ['Sit. Do nothing. Watch.', SPIRIT, 'The noise in you burns out by itself when nobody feeds it.'],
  ['A shouting person is drowning.', SPIRIT, 'Do not jump in after them. Throw calm from the shore.'],
  ['Laugh at yourself first.', SPIRIT, 'Then no one can use it against you, and you are free.'],
  ['Do not try to become somebody. Become aware.', SPIRIT, 'Everything you wanted from being somebody arrives as a side effect.'],
  ['Let death make today vivid, not heavy.', SPIRIT, 'Everything ends. That is exactly why this afternoon matters.'],
  ['What you cling to owns you.', SPIRIT, 'Hold things lightly, people lovingly, and yourself freely.'],
  ['Resentment is a heater left on in an empty room.', SPIRIT, 'It warms no one and costs you everything. Switch it off.']
];

const LINES = {
  Osho: OSHO,
  Calm: [
    ['Nothing needs to be solved in this exact breath.'],
    ['You are allowed to put this down for a minute.'],
    ['Slow is not behind. Slow is steady.'],
    ['Let your shoulders drop. Let your jaw loosen. Nothing is chasing you.'],
    ['This feeling is weather. You are the sky.'],
    ['You don’t have to answer everything right now.'],
    ['One long breath out. That is almost the whole trick.'],
    ['Most of what feels urgent is only loud.'],
    ['Quiet is not empty. It is room.'],
    ['You have gotten through every hard day so far.'],
    ['Let it stay unfinished for now.'],
    ['Be gentle with the person you are today.'],
    ['Very little is needed to make a happy life; it is all within yourself, in your way of thinking.', 'Marcus Aurelius']
  ],
  Aware: [
    ['Notice the thought. You are not the thought.'],
    ['Between what happens and what you do, there is a gap. Live in it.'],
    ['Is this a fact, or a story I am telling myself?'],
    ['Your reaction tells you something about you, not a verdict on them.'],
    ['What am I actually feeling underneath the irritation?'],
    ['You cannot control the tone you receive. You always control the tone you send.'],
    ['Pause. Who do you want to be in the next ten seconds?'],
    ['Most irritation is a want that has not been named yet.'],
    ['Watch the feeling rise. Watching it is already different from obeying it.'],
    ['Attention is the one thing no one can take unless you hand it over.'],
    ['Where are you right now? Here. That is enough to begin.'],
    ['Not every thought deserves a reply.'],
    ['People are disturbed not by things, but by the views they take of them.', 'Epictetus'],
    ['If it is not right, do not do it; if it is not true, do not say it.', 'Marcus Aurelius']
  ],
  Bright: [
    ['Something small today is going to go well. Look for it.'],
    ['You are allowed to expect good things.'],
    ['Light finds the cracks. That is how it gets in.'],
    ['Today is still unwritten.'],
    ['You are further along than the version of you who started worrying.'],
    ['Good things are quietly happening that you have not noticed yet.'],
    ['Smile at nothing in particular. See what changes.'],
    ['You have more options than this moment is showing you.'],
    ['The sun does not ask whether it was a hard week. It rises anyway.'],
    ['You are allowed to enjoy this without earning it first.'],
    ['Let something be easy today.'],
    ['Say one kind thing to yourself first. Then look at the day.']
  ],
  Reframe: [
    ['That person’s behavior is about their day more than about you.'],
    ['This is not a setback. It is information you did not have yesterday.'],
    ['What if this is redirecting you, not blocking you?'],
    ['The worst case is rarely the real case. The most likely case is usually fine.'],
    ['Embarrassment fades faster than you think. Almost nobody remembers.'],
    ['Whatever you are worried about belongs to future you, who will have more information and more strength.'],
    ['If a friend told you this, you would say: you will be okay. Say it to yourself.'],
    ['You are not failing. You are in the middle, and the middle always looks messy.'],
    ['This might become a good story later.'],
    ['Delay is not denial.'],
    ['You do not have to like it to learn from it.'],
    ['The version where this works out is just as possible.'],
    ['What stands in the way becomes the way.', 'Marcus Aurelius'],
    ['We suffer more often in imagination than in reality.', 'Seneca']
  ]
};
const MODES = ['Osho', 'Calm', 'Aware', 'Bright', 'Reframe'];

/* situations: three beats, each with two options */
const SITUATIONS = {
  'Someone upset me': [
    ['Settle', ['Breathe out slowly. Your body does not have to match their energy.', 'Let your shoulders drop. Nothing needs to be said yet.']],
    ['See it', ['People usually act from their own stress. This may be less about you than it feels.', 'What they said is one moment. You decide how much of your day it gets.']],
    ['Lighten', ['Choose calm as your answer. It is quietly powerful, and it feels better too.', 'You are the one person here who decides how this ends. Make it a good ending.']]
  ],
  'I’m worried about the future': [
    ['Settle', ['You are here, now, and right now is okay.', 'Your mind is rehearsing. You can pause the rehearsal.']],
    ['See it', ['Worry predicts. It does not know. Most of what you feared turned out smaller.', 'Future you will have more information and more strength than you have now.']],
    ['Lighten', ['Something good is also coming. The mind just does not rehearse that part. Let it, today.', 'Do the next small thing. The rest can wait its turn.']]
  ],
  'I feel behind in life': [
    ['Settle', ['Take one slow breath. There is no race happening right now.']],
    ['See it', ['Comparison only shows you everyone else’s highlights. Your timeline is yours.', 'You are not late. You are on a path no one else has walked.']],
    ['Lighten', ['Look at how far you have come since you first doubted this. That counts.', 'Progress is quiet. Keep going. It is adding up.']]
  ],
  'I feel anxious right now': [
    ['Settle', ['Feet on the floor. A longer breath out than in. Again.', 'Name five things you can see. You are here, and you are okay.']],
    ['See it', ['This is your body trying to protect you, not telling you the truth. It will pass.', 'Anxiety is energy with nowhere to land. It will settle.']],
    ['Lighten', ['You have felt this before and it always softened. It is softening now.', 'Let your body know it is safe. Then let a little light in.']]
  ],
  'I feel low': [
    ['Settle', ['You do not have to fix anything. Just sit with yourself kindly.', 'It is okay to feel heavy. Heavy is not permanent.']],
    ['See it', ['Low days are weather, not climate.', 'Be as kind to yourself as you would be to a friend who felt this.']],
    ['Lighten', ['Do one small, gentle thing: water, a window, a song. That is enough.', 'Light returns. It always has. Let it come at its own pace.']]
  ],
  'I made a mistake': [
    ['Settle', ['Breathe. A mistake is an event, not an identity.']],
    ['See it', ['Everyone who is good at something has done this many times.', 'What did it teach you? That part is the gift.']],
    ['Lighten', ['Learn it, forgive it, move on lighter.', 'You are the same capable person. Now you are a little wiser too.']]
  ]
};

/* ---------- state ---------- */
const KEY = 'lightly_v2';
let S = { fav: [], mode: 'Osho', bag: {}, rate: .82, pitch: .9, voiceName: null };
try { const d = JSON.parse(localStorage.getItem(KEY)); if (d) S = Object.assign(S, d); else { const o = JSON.parse(localStorage.getItem('lightly_v1')); if (o && o.fav) S.fav = o.fav; } } catch (e) {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
const rand = n => Math.floor(Math.random() * n);

/* shuffle bag so lines do not repeat until all have been seen */
function nextLine(mode) {
  const all = LINES[mode]; let bag = (S.bag[mode] || []).filter(i => i < all.length);
  if (!bag.length) { bag = all.map((_, i) => i); for (let i = bag.length - 1; i > 0; i--) { const j = rand(i + 1);[bag[i], bag[j]] = [bag[j], bag[i]]; } if (S.last && bag[bag.length - 1] === S.lastIdx && bag.length > 1) bag.unshift(bag.pop()); }
  const i = bag.pop(); S.bag[mode] = bag; S.lastIdx = i; S.last = mode; save(); return all[i];
}

/* ---------- time-of-day sky ---------- */
const params = new URLSearchParams(location.search);
function sky() {
  const hr = params.has('h') ? +params.get('h') : new Date().getHours();
  let p;
  if (hr >= 5 && hr < 9) p = ['#FDEBDD', '#EAF1FB', '#1F2B3D', '#F0A35E'];       // dawn
  else if (hr >= 9 && hr < 17) p = ['#E6F1FB', '#FBF4E3', '#1B2B3C', '#E9A93B']; // day
  else if (hr >= 17 && hr < 21) p = ['#F3E4F2', '#FDEBD6', '#2A2340', '#E98F5A']; // dusk
  else p = ['#1B2748', '#35305A', '#F2EEF8', '#F2C46B'];                         // night, still luminous
  const r = document.documentElement.style;
  r.setProperty('--bg1', p[0]); r.setProperty('--bg2', p[1]); r.setProperty('--tx', p[2]); r.setProperty('--accent', p[3]);
  const night = hr >= 21 || hr < 5;
  r.setProperty('--mut', night ? 'rgba(242,238,248,.66)' : 'rgba(27,43,60,.6)'); r.setProperty('--line', night ? 'rgba(242,238,248,.2)' : 'rgba(27,43,60,.14)');
  r.setProperty('--chip', night ? 'rgba(255,255,255,.1)' : 'rgba(255,255,255,.55)');
  const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = p[0];
  return { night, accent: p[3] };
}
let skyInfo = sky(); setInterval(() => { applyTheme(); }, 600000);
function applyTheme() {
  const fire = S.mode === 'Osho'; document.body.classList.toggle('fire', fire);
  skyInfo = sky(); if (fire) { skyInfo = { night: true, accent: '#FF9A3C' }; const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = '#120A07'; }
}

/* soft drifting light */
(function glow() {
  const cv = $('#glow'), ctx = cv.getContext('2d'); let W, H, dots = [];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function size() { const d = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; cv.width = W * d; cv.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0); dots = Array.from({ length: 22 }, () => ({ x: Math.random() * W, y: Math.random() * H, r: 18 + Math.random() * 60, v: .08 + Math.random() * .22, a: .05 + Math.random() * .1, p: Math.random() * 6 })); }
  size(); addEventListener('resize', size);
  let last = performance.now();
  function f(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now; ctx.clearRect(0, 0, W, H);
    const col = skyInfo.accent;
    dots.forEach(d => {
      if (!reduce) { d.y -= d.v * dt * 20; d.p += dt * .4; if (d.y < -d.r) { d.y = H + d.r; d.x = Math.random() * W; } }
      const a = d.a * (.7 + .3 * Math.sin(d.p)), g = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r);
      g.addColorStop(0, col + Math.round(a * 255).toString(16).padStart(2, '0')); g.addColorStop(1, col + '00');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 6.3); ctx.fill();
    });
    if (!document.hidden) requestAnimationFrame(f); else document.addEventListener('visibilitychange', () => requestAnimationFrame(f), { once: true });
  }
  requestAnimationFrame(f);
})();


/* ---------- audio: the phone's own text-to-speech, works offline ---------- */
const canSpeak = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
const TTS = { voices: [], voice: null, token: 0, speaking: false, session: false, lock: null };
function bestVoice() {
  const pref = ['Rishi', 'Daniel', 'Aaron', 'Arthur', 'Google UK English Male', 'Alex', 'Ravi', 'Oliver', 'Gordon', 'Fred'];
  for (const n of pref) { const v = TTS.voices.find(x => x.name.includes(n)); if (v) return v; }
  return TTS.voices.find(v => /en-(IN|GB)/i.test(v.lang)) || TTS.voices[0] || null;
}
function loadVoices() { if (!canSpeak) return; TTS.voices = (speechSynthesis.getVoices() || []).filter(v => /^en/i.test(v.lang)); TTS.voice = TTS.voices.find(v => v.name === S.voiceName) || bestVoice(); }
if (canSpeak) { loadVoices(); speechSynthesis.addEventListener && speechSynthesis.addEventListener('voiceschanged', loadVoices); }
function utter(text, done, tk) {
  const u = new SpeechSynthesisUtterance(text); if (TTS.voice) u.voice = TTS.voice; u.rate = S.rate || .82; u.pitch = S.pitch || .9; u.volume = 1;
  let fin = false; const end = () => { if (fin) return; fin = true; if (tk === TTS.token && done) done(); };
  u.onend = end; u.onerror = end; speechSynthesis.speak(u);
}
function speakLine(line, done) {
  if (!canSpeak || !line) return; speechSynthesis.cancel(); const tk = ++TTS.token; TTS.speaking = true; syncAudio();
  const parts = [line[0], line[2]].filter(Boolean);
  const run = i => { if (tk !== TTS.token) return; if (i >= parts.length) { TTS.speaking = false; syncAudio(); if (done) done(); return; } utter(parts[i], () => setTimeout(() => run(i + 1), i === 0 ? 650 : 0), tk); };
  run(0);
}
function stopAudio(keepSession) {
  if (!canSpeak) return; TTS.token++; speechSynthesis.cancel(); TTS.speaking = false;
  if (!keepSession || !TTS.session) { TTS.session = false; releaseLock(); }
  syncAudio();
}
function syncAudio() {
  const b = $('#listen'); if (b) { b.classList.toggle('on', TTS.speaking); b.innerHTML = (TTS.speaking ? STOP : PLAY) + '<span>' + (TTS.speaking ? 'Stop' : 'Listen') + '</span>'; }
  const s = $('#sess'); if (s) s.textContent = TTS.session ? 'Stop session' : 'Play session';
}
function toggleListen() { if (TTS.speaking) { stopAudio(); } else { TTS.session = false; speakLine(cur); } }
async function takeLock() { try { if (navigator.wakeLock) TTS.lock = await navigator.wakeLock.request('screen'); } catch (e) {} }
function releaseLock() { try { if (TTS.lock) TTS.lock.release(); } catch (e) {} TTS.lock = null; }
function toggleSession() {
  if (TTS.session) { stopAudio(); return; }
  TTS.session = true; takeLock(); syncAudio();
  const loop = () => { if (!TTS.session) return; speakLine(cur, () => { if (!TTS.session) return; setTimeout(() => { if (!TTS.session) return; show(nextLine(S.mode)); setTimeout(loop, 900); }, 3500); }); };
  loop();
}
function voiceSheet() {
  const mk = (label, key, val) => h('button', { class: 'chip' + ((S[key] || 0) === val ? ' on' : ''), onclick: e => { S[key] = val; save(); [...e.currentTarget.parentNode.children].forEach(c => c.classList.toggle('on', c === e.currentTarget)); speakLine(['Stop obeying your fear.']); } }, label);
  const list = h('div');
  const draw = () => { list.innerHTML = ''; TTS.voices.slice(0, 40).forEach(v => list.append(h('button', { class: 'opt', style: 'font:600 16px var(--sans);padding:14px 18px' + (TTS.voice === v ? ';outline:2px solid var(--tx)' : ''), onclick: () => { TTS.voice = v; S.voiceName = v.name; save(); draw(); speakLine(['Stop obeying your fear.']); } }, v.name + ' (' + v.lang + ')'))); if (!TTS.voices.length) list.append(h('p', { style: 'color:var(--mut)' }, 'No English voices found on this device. Add one in your phone’s accessibility or speech settings.')); };
  draw();
  const bg = sheet([h('h2', null, 'Voice'), h('p', { style: 'color:var(--mut);margin:0 0 14px' }, 'Uses your phone’s built-in voices, so it works offline. Tap one to hear it.'),
    h('div', { class: 'chips2' }, mk('Slow', 'rate', .72), mk('Calm', 'rate', .82), mk('Natural', 'rate', .95)),
    h('div', { class: 'chips2' }, mk('Deeper', 'pitch', .8), mk('Low', 'pitch', .9), mk('Natural', 'pitch', 1)), list]);
  const obs = new MutationObserver(() => { if (!document.body.contains(bg)) { stopAudio(); obs.disconnect(); } }); obs.observe(document.body, { childList: true });
}
document.addEventListener('visibilitychange', () => { if (document.hidden && TTS.session) { /* phones pause speech when the screen locks */ } else if (!document.hidden && TTS.session) takeLock(); });

/* ---------- main screen ---------- */
let cur = null;
function render() {
  applyTheme(); stopAudio();
  const app = $('#app'); app.innerHTML = '';
  const q = h('div', { class: 'quote', id: 'q', 'aria-live': 'polite' }), by = h('div', { class: 'by', id: 'by' });
  const heart = h('button', { class: 'icon heart', 'aria-label': 'Save this line', html: HEART, onclick: toggleFav });
  const modes = h('div', { class: 'modes', role: 'tablist' }, MODES.map(m => h('button', { class: 'chip' + (S.mode === m ? ' on' : ''), role: 'tab', onclick: () => { S.mode = m; save(); render(); } }, m)));
  const stage = h('div', { class: 'stage' }, q, by);
  let sx = 0, sy = 0;
  stage.addEventListener('touchstart', e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  stage.addEventListener('touchend', e => { const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy; if (Math.abs(dy) > 50 && Math.abs(dy) > Math.abs(dx)) change(); else if (Math.abs(dx) > 60) change(); });
  app.append(
    h('div', { class: 'top' }, h('div', { class: 'brand' }, 'Lightly'), h('div', { style: 'display:flex' }, canSpeak ? h('button', { class: 'icon', 'aria-label': 'Voice settings', html: MIC, onclick: voiceSheet }) : null, h('button', { class: 'icon', 'aria-label': 'Saved lines', html: LIST, onclick: showFavs }))),
    modes, stage,
    h('div', { class: 'dock' },
      h('button', { class: 'help', onclick: openSituations }, 'Something’s bothering me'),
      h('div', { class: 'bar' }, heart, canSpeak ? h('button', { class: 'listen', id: 'listen', 'aria-label': 'Listen to this line', onclick: toggleListen, html: PLAY + '<span>Listen</span>' }) : null, h('button', { class: 'next', onclick: change }, 'Another')),
      h('div', { class: 'hintrow' }, h('span', null, 'Swipe for the next one'), canSpeak ? h('button', { id: 'sess', onclick: toggleSession }, 'Play session') : null)));
  show(nextLine(S.mode), false);
}
function show(line, animate = true) {
  const q = $('#q'), by = $('#by'); cur = line;
  const set = () => {
    q.innerHTML = '';
    const two = !!line[2];
    if (two) q.append(h('div', { class: 'bar-accent' }), h('div', { class: 'punch' }, line[0]), h('div', { class: 'insight' }, line[2])); else q.textContent = line[0];
    by.textContent = line[1] ? (two ? line[1] : '\u2014 ' + line[1]) : '';
    q.className = 'quote in' + (two ? ' two' : ''); requestAnimationFrame(() => requestAnimationFrame(() => q.className = 'quote' + (two ? ' two' : ''))); syncHeart();
  };
  if (!animate) { set(); return; }
  q.className = 'quote out'; setTimeout(set, 380);
}
function change() { stopAudio(true); show(nextLine(S.mode)); }
const isFav = l => S.fav.some(f => f[0] === l[0]);
function syncHeart() { const b = $('.heart'); if (b && cur) b.classList.toggle('on', isFav(cur)); }
function toggleFav() {
  if (!cur) return;
  if (isFav(cur)) { S.fav = S.fav.filter(f => f[0] !== cur[0]); toast('Removed'); } else { S.fav.unshift(cur); toast('Saved'); }
  save(); syncHeart(); if (navigator.vibrate) try { navigator.vibrate(10); } catch (e) {}
}
function sheet(children) {
  const bg = h('div', { class: 'sheet-bg', onclick: e => { if (e.target === bg) bg.remove(); } }); const s = h('div', { class: 'sheet' }, children); bg.append(s); document.body.append(bg); return bg;
}
function showFavs() {
  const body = [h('h2', null, 'Saved')];
  if (!S.fav.length) body.push(h('p', { style: 'color:var(--mut)' }, 'Tap the heart on any line to keep it here.'));
  S.fav.forEach(f => body.push(h('div', { class: 'item' }, h('span', null, f[0] + (f[2] ? ' ' + f[2] : '') + (f[1] && !f[2] ? ' \u2014 ' + f[1] : '')), h('button', { onclick: e => { S.fav = S.fav.filter(x => x[0] !== f[0]); save(); e.target.closest('.item').remove(); syncHeart(); } }, 'Remove'))));
  sheet(body);
}

/* ---------- "something's bothering me" flow ---------- */
function openSituations() {
  const bg = sheet([h('h2', null, 'What’s going on?'), h('p', { style: 'color:var(--mut);margin:0 0 6px' }, 'Pick the closest one.'),
    Object.keys(SITUATIONS).map(k => h('button', { class: 'opt', onclick: () => { bg.remove(); runFlow(k); } }, k))]);
}
function runFlow(name) {
  const beats = SITUATIONS[name].map(([label, opts]) => [label, opts[rand(opts.length)]]);
  let i = 0;
  const bg = h('div', { class: 'flow-bg' }), box = h('div', { class: 'flow' });
  document.body.append(bg, box);
  const close = () => { box.remove(); bg.remove(); };
  const draw = () => {
    box.innerHTML = '';
    const last = i === beats.length - 1;
    box.append(
      h('div', { class: 'top' }, h('div', { class: 'brand' }, ''), h('button', { class: 'icon', 'aria-label': 'Close', html: XI, onclick: close })),
      h('div', { class: 'stage', style: 'text-align:center' }, i === 0 ? h('div', { class: 'orb' }) : null, h('div', { class: 'beat' }, beats[i][0]), h('div', { class: 'quote' }, beats[i][1])),
      h('div', { class: 'dock' }, h('div', { class: 'dots' }, beats.map((_, j) => h('i', { class: j === i ? 'on' : '' }))),
        h('button', { class: 'next', style: 'flex:none;width:100%', onclick: () => { if (last) { close(); toast('Lighter already'); } else { i++; draw(); } } }, last ? 'Done' : 'Next')));
  };
  draw();
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
render();

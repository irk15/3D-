'use strict';
/* Lightly lines + sound: quote feed matched to your inner weather, studio voices that keep
   playing with the screen off, background sounds with volume, Reset and Focus tools.
   Audio files are shared with the original Lightly folder. */

const AUDIO = '../lightly/audio/';
const STUDIO = [['nicole', 'Aria', 'Soft, calm woman'], ['heart', 'Heart', 'Warm, kind woman'], ['emma', 'Emma', 'British, gentle woman'], ['george', 'George', 'Deep, steady British man'], ['michael', 'Michael', 'Warm, grounded man'], ['fable', 'Fable', 'Storyteller, British man']];
const SOUNDS = [
  ['Nature', [['Rain', 'rain'], ['Ocean', 'ocean'], ['Wind', 'wind'], ['Waterfall', 'waterfall'], ['Forest', 'forest'], ['Night', 'night'], ['Storm', 'storm'], ['Campfire', 'campfire'], ['Fireplace', 'fireplace']]],
  ['Spiritual and warm', [['Temple', 'temple'], ['Om chant', 'omchant'], ['Bowls', 'bowls'], ['Celestial', 'celestial'], ['Chimes', 'chimes'], ['Rise', 'rise'], ['Romance', 'romance'], ['Moonlight', 'moonlight'], ['Hum', 'hum']]],
  ['Focus', [['Brown noise', 'brown'], ['Pink noise', 'pink'], ['Focus beats', 'beta'], ['Calm beats', 'alpha'], ['Deep beats', 'theta'], ['40 Hz', 'gamma']]]
];
const sndName = f => { for (const g of SOUNDS) for (const [n, k] of g[1]) if (k === f) return n; return 'Off'; };
const lh = t => { let x = 5381; for (let i = 0; i < t.length; i++) x = ((x * 33) ^ t.charCodeAt(i)) >>> 0; return x.toString(16); };
const WMODES = { storm: ['Calm', 'Aware'], rain: ['Bright', 'Reframe', 'Calm'], fog: ['Aware', 'Start'], cloud: ['Reframe', 'Brilliant', 'Calm'], clear: ['Brilliant', 'Osho', 'Aware'], sun: ['Bright', 'Osho', 'Brilliant'] };
S.fav = S.fav || []; S.voice = S.voice || 'nicole'; S.snd = S.snd || ''; S.vol = S.vol || 3; S.lmode = S.lmode || 'You';

/* ---------- which lines ---------- */
function forYouModes() { const w = curWeather(); if (w) return WMODES[w]; const hr = new Date().getHours(); return hr >= 4 && hr < 12 ? ['Start', 'Bright'] : hr >= 20 || hr < 4 ? ['Calm', 'Osho'] : ['Brilliant', 'Reframe', 'Aware']; }
function poolFor(m) {
  if (m === 'Saved') return S.fav.length ? S.fav : [];
  const ms = m === 'You' ? forYouModes() : [m], seen = new Set(), out = [];
  ms.forEach(x => (LINES[x] || []).forEach(l => { if (!seen.has(l[0])) { seen.add(l[0]); out.push(l); } })); return out;
}
const LQ = { bag: {}, cur: null };
function nextLine(m) {
  const all = poolFor(m); if (!all.length) return null; let b = LQ.bag[m];
  if (!b || !b.length) { b = all.map((_, i) => i); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } LQ.bag[m] = b; }
  return all[b.pop() % all.length];
}
const isFav = l => l && S.fav.some(f => f[0] === l[0]);
function toggleFav(l) { if (!l) return; if (isFav(l)) { S.fav = S.fav.filter(f => f[0] !== l[0]); toast('Removed'); } else { S.fav.unshift(l); toast('Saved'); } save(); buzz(10); }

/* ---------- voice ---------- */
const AU = { el: null, onEnd: null, tk: 0, speaking: false, session: false, keep: null };
const canSpeak = 'speechSynthesis' in window;
function audEl() {
  if (AU.el) return AU.el; const a = AU.el = new Audio(); a.preload = 'auto'; a.setAttribute('playsinline', '');
  a.addEventListener('ended', () => { const f = AU.onEnd; AU.onEnd = null; if (f) f(); });
  if ('mediaSession' in navigator) { const ms = navigator.mediaSession, set = (n, f) => { try { ms.setActionHandler(n, f); } catch (e) {} };
    set('play', () => { if (a.src && !a.ended) a.play(); }); set('pause', () => a.pause()); set('stop', () => stopVoice()); set('nexttrack', () => linesNext()); }
  return a;
}
function speakDevice(line, done, tk) {
  if (!canSpeak) { if (done) done(); return; } speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance([line[0], line[2]].filter(Boolean).join('. ')); u.rate = .82;
  const v = speechSynthesis.getVoices().filter(x => /^en/i.test(x.lang)).sort((a, b) => /premium|enhanced|natural|siri/i.test(b.name) - /premium|enhanced|natural|siri/i.test(a.name))[0]; if (v) u.voice = v;
  u.onend = u.onerror = () => { if (tk === AU.tk && done) done(); }; speechSynthesis.speak(u);
}
function speak(line, done) {
  if (!line) return; const tk = ++AU.tk; AU.speaking = true; syncListen();
  const fin = () => { if (tk !== AU.tk) return; AU.speaking = false; syncListen(); if (done) done(); };
  if (S.voice === 'device') { speakDevice(line, fin, tk); return; }
  const a = audEl(); if (canSpeak) speechSynthesis.cancel();
  AU.onEnd = fin; a.onerror = () => { if (tk === AU.tk) { AU.onEnd = null; speakDevice(line, fin, tk); } };
  a.src = AUDIO + S.voice + '/' + lh(line[0]) + '.mp3';
  const p = a.play(); if (p && p.catch) p.catch(() => setTimeout(() => { if (tk === AU.tk) a.play().catch(() => { AU.onEnd = null; speakDevice(line, fin, tk); }); }, 400));
  if ('mediaSession' in navigator) try { navigator.mediaSession.metadata = new MediaMetadata({ title: line[0], artist: 'Lightly', artwork: [{ src: 'icon-512.png', sizes: '512x512', type: 'image/png' }] }); } catch (e) {}
}
function keepAlive(on) {
  if (on) { if (!AU.keep) { AU.keep = new Audio(AUDIO + 'ambient/keep.wav'); AU.keep.loop = true; AU.keep.setAttribute('playsinline', ''); } AU.keep.play().catch(() => {}); }
  else if (AU.keep) AU.keep.pause();
}
function stopVoice() {
  AU.tk++; AU.session = false; AU.speaking = false; if (canSpeak) speechSynthesis.cancel(); if (AU.el) { AU.onEnd = null; AU.el.pause(); }
  keepAlive(false); if (AMB.byListen) { ambStop(true); AMB.byListen = false; } syncListen();
}
function startSession() {
  AU.session = true; keepAlive(true); if (S.snd && !AMB.a) { ambPlay(S.snd); AMB.byListen = true; } syncListen();
  const step = l => { if (!AU.session) return; speak(l, () => { if (!AU.session) return; setTimeout(() => { if (!AU.session) return; const n = nextLine(S.lmode); showLine(n); step(n); }, S.voice === 'device' ? 2500 : 900); }); };
  step(LQ.cur);
}
function toggleListen() { if (AU.session || AU.speaking) stopVoice(); else if (LQ.cur) startSession(); }
function syncListen() { document.querySelectorAll('.listenbtn').forEach(b => { const on = AU.session || AU.speaking; b.classList.toggle('on', on); b.innerHTML = (on ? '<span class="eq"><i></i><i></i><i></i></span>' : '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg>') + '<span>' + (on ? 'Stop' : 'Listen') + '</span>'; }); }

/* ---------- background sound ---------- */
const AMB = { a: null, f: '', iv: 0, byListen: false };
function ambPlay(f, lvl) {
  ambStop(false); if (!f) return; const a = AMB.a = new Audio(AUDIO + 'ambient/' + f + '-' + (lvl || S.vol || 3) + '.wav'); AMB.f = f; a.loop = true; a.setAttribute('playsinline', ''); a.volume = 0;
  a.play().catch(() => {}); let v = 0; clearInterval(AMB.iv); AMB.iv = setInterval(() => { v = Math.min(1, v + .1); try { a.volume = v; } catch (e) {} if (v >= 1 || AMB.a !== a) clearInterval(AMB.iv); }, 150); syncSnd();
}
function ambStop(fade) {
  const a = AMB.a; AMB.a = null; AMB.f = ''; clearInterval(AMB.iv); syncSnd(); if (!a) return; if (!fade) { a.pause(); return; }
  let v = a.volume; const iv = setInterval(() => { v -= .08; try { a.volume = Math.max(0, v); } catch (e) {} if (v <= 0) { clearInterval(iv); a.pause(); } }, 200); setTimeout(() => { clearInterval(iv); a.pause(); }, 4000);
}
function syncSnd() { document.querySelectorAll('.sndpill b').forEach(b => b.textContent = AMB.a ? sndName(AMB.f) : (S.snd ? sndName(S.snd) : 'Off')); document.querySelectorAll('.sndpill').forEach(b => b.classList.toggle('on', !!AMB.a)); }
function soundSheet() {
  flow([{ t: 'custom', render: () => { const b = h('div'); const draw = () => { b.innerHTML = '';
    b.append(h('div', { class: 'chips' }, h('button', { class: 'chip' + (!S.snd ? ' on' : ''), onclick: () => { S.snd = ''; save(); ambStop(true); draw(); } }, 'Off')));
    SOUNDS.forEach(([g, list]) => b.append(h('div', { class: 'sechead' }, g), h('div', { class: 'chips' }, list.map(([n, f]) => h('button', { class: 'chip' + (S.snd === f ? ' on' : ''), onclick: () => { S.snd = f; save(); ambPlay(f); draw(); } }, n)))));
    const r = h('input', { type: 'range', min: 1, max: 5, step: 1, value: S.vol, class: 'vol', 'aria-label': 'Volume' }), lab = h('b', null, ['Whisper', 'Soft', 'Medium', 'Strong', 'Full'][S.vol - 1]);
    r.addEventListener('input', () => { lab.textContent = ['Whisper', 'Soft', 'Medium', 'Strong', 'Full'][r.value - 1]; r.style.setProperty('--p', (r.value - 1) * 25 + '%'); });
    r.addEventListener('change', () => { S.vol = +r.value; save(); if (AMB.a) ambPlay(AMB.f); }); r.style.setProperty('--p', (S.vol - 1) * 25 + '%');
    b.append(h('div', { class: 'sechead' }, 'Volume'), h('div', { class: 'volrow' }, r, lab),
      h('p', { class: 'mut small' }, 'Nature sounds are real CC0 recordings. Binaural beats need headphones, and research on them is mixed. Sound keeps playing with the screen off.')); };
    draw(); return { body: [h('h2', { class: 'ftitle' }, 'Background sound'), b], foot: [btn('Done', () => { closeFlow(); render(); })] }; } }], { label: 'Sound', nofocus: true });
}
const sndPill = () => h('button', { class: 'sndpill' + (AMB.a ? ' on' : ''), onclick: soundSheet }, h('span', { html: '<svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h3l4-3v10l-4-3H3z"/><path d="M13 6.5a3.5 3.5 0 0 1 0 5"/></svg>' }), h('b', null, AMB.a ? sndName(AMB.f) : (S.snd ? sndName(S.snd) : 'Off')));

/* ---------- Lines tab ---------- */
function lineNode(l, big) {
  const two = !!l[2], q = h('div', { class: 'lq' + (big ? ' big' : '') });
  const words = (t, base) => t.split(' ').map((w, i) => [h('span', { class: 'w', style: 'animation-delay:' + (base + i * 55) + 'ms' }, w), ' ']);
  q.append(h('div', { class: 'lpunch' }, words(l[0], 80)));
  if (two) q.append(h('div', { class: 'linsight', style: 'animation-delay:' + (200 + l[0].split(' ').length * 55) + 'ms' }, l[2]));
  if (l[1]) q.append(h('div', { class: 'lby' }, two ? l[1] : '— ' + l[1]));
  return q;
}
function showLine(l) {
  LQ.cur = l; const st = $('#lstage'); if (!st) return; st.innerHTML = '';
  if (!l) { st.append(h('p', { class: 'serif big mut' }, 'Tap the heart on any line to keep it here.')); return; }
  st.append(lineNode(l, true)); const hb = $('#lheart'); if (hb) hb.classList.toggle('on', isFav(l));
}
function linesNext() { const was = AU.session; if (was) { AU.tk++; if (AU.el) { AU.onEnd = null; AU.el.pause(); } if (canSpeak) speechSynthesis.cancel(); }
  const st = $('#lstage'); if (st) st.classList.add('out'); setTimeout(() => { if (st) st.classList.remove('out'); const n = nextLine(S.lmode); showLine(n); if (was) { AU.session = false; startSession(); } }, st ? 260 : 0); }
function viewLines(v) {
  const label = m => m === 'You' ? 'For you' : m === 'Osho' ? 'Spiritual' : m;
  v.append(h('header', { class: 'head' }, h('div', null, h('div', { class: 'eyebrow' }, S.lmode === 'You' ? 'Matched to your weather' : (MOOD_INFO[S.lmode] || ['Your saved lines'])[0]), h('h1', null, 'Lines')), sndPill()),
    h('div', { class: 'mrow' }, ['You'].concat(MODES, ['Saved']).map(m => h('button', { class: 'chip sm' + (S.lmode === m ? ' on' : ''), onclick: () => { S.lmode = m; save(); render(); } }, label(m)))));
  const stage = h('div', { class: 'lstage', id: 'lstage' }); let sx = 0, sy = 0, last = 0;
  stage.addEventListener('touchstart', e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  stage.addEventListener('touchend', e => { const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
    if (Math.max(Math.abs(dx), Math.abs(dy)) > 60) { linesNext(); return; }
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) { const n = Date.now(); if (n - last < 320) { if (!isFav(LQ.cur)) { toggleFav(LQ.cur); $('#lheart').classList.add('on'); } last = 0; } else last = n; } });
  v.append(stage, h('p', { class: 'mut small center' }, 'Swipe for the next line · double-tap to save'),
    h('div', { class: 'lbar' }, h('button', { class: 'ibtn', id: 'lheart', 'aria-label': 'Save line', html: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M12 20.5s-7.5-4.6-7.5-10.1A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.8c0 5.5-7.5 10.1-7.5 10.1z"/></svg>', onclick: e => { toggleFav(LQ.cur); e.currentTarget.classList.toggle('on', isFav(LQ.cur)); } }),
      h('button', { class: 'ibtn', 'aria-label': 'Share', html: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V4M8 8l4-4 4 4M5 13v5a2 2 0 002 2h10a2 2 0 002-2v-5"/></svg>', onclick: async () => { const l = LQ.cur; if (!l) return; const t = l[0] + (l[2] ? ' ' + l[2] : '') + (l[1] && !l[2] ? ' — ' + l[1] : ''); try { if (navigator.share) await navigator.share({ text: t }); else { await navigator.clipboard.writeText(t); toast('Copied'); } } catch (e) {} } }),
      h('button', { class: 'listenbtn', onclick: toggleListen }), h('button', { class: 'btn nextb', onclick: linesNext }, 'Next')));
  const keep = LQ.cur && poolFor(S.lmode).some(l => l[0] === LQ.cur[0]);
  showLine(keep ? LQ.cur : nextLine(S.lmode)); syncListen();
}
/* a matched line on Today */
function lineCard() {
  if (!LQ.cur || !poolFor('You').some(l => l[0] === LQ.cur[0])) LQ.cur = nextLine('You');
  const l = LQ.cur; if (!l) return '';
  return h('section', { class: 'card linecard' }, h('div', { class: 'eyebrow' }, 'A line for you'), lineNode(l),
    h('div', { class: 'rowbtns' }, h('button', { class: 'listenbtn', onclick: () => { S.lmode = 'You'; toggleListen(); } }), h('button', { class: 'ghost', onclick: () => { S.lmode = 'You'; S.tab = 'lines'; save(); render(); scrollTo(0, 0); } }, 'More lines')));
}

/* ---------- tools from Lightly ---------- */
TOOLS.reset = { n: 'Reset', d: 'Head loud? Back on track in 60 seconds', min: 1, steps: [
  { t: 'breath', p: 'sigh', r: 3, tip: 'Three calming breaths first.' },
  { t: 'custom', render: (c, next) => { const l = c.l || (c.l = nextLine('You') || LINES.Calm[0]); return { body: [h('div', { class: 'eyebrow' }, 'Try seeing it this way'), lineNode(l, true)], foot: [btn('Next', () => { stopVoice(); next(); }), h('button', { class: 'listenbtn wide', onclick: () => { if (AU.speaking) stopVoice(); else speak(l); } })] }; } },
  { t: 'choose', key: 'move', title: 'Your smallest first move', body: 'Not the whole task. Just the first move.', opts: ['Write the next action as one verb', 'Open the file or app, nothing else', 'Stand up and drink a glass of water', 'Clear one thing from your desk'] },
  { t: 'timer', sec: 120, title: c => c.move, body: 'Two minutes. You can stop after that.' }] };
TOOLS.focus = { n: 'Focus sprint', d: 'One thing, a timer and a steady sound', min: 25, noRate: true, custom: () => {
  let mins = S.fMin || 25, snd = S.fSnd == null ? 'brown' : S.fSnd;
  flow([{ t: 'custom', render: () => { const inp = h('input', { class: 'field one', maxlength: 100, placeholder: 'The one thing (optional)', 'aria-label': 'Task' }), w = h('div');
    const draw = () => { w.innerHTML = ''; w.append(h('div', { class: 'sechead' }, 'Length'), h('div', { class: 'chips' }, [10, 25, 45].map(m => h('button', { class: 'chip' + (mins === m ? ' on' : ''), onclick: () => { mins = m; draw(); } }, m + ' min'))),
      h('div', { class: 'sechead' }, 'Sound'), h('div', { class: 'chips' }, [['Off', ''], ['Brown noise', 'brown'], ['Rain', 'rain'], ['Forest', 'forest'], ['Focus beats', 'beta']].map(([n, f]) => h('button', { class: 'chip' + (snd === f ? ' on' : ''), onclick: () => { snd = f; draw(); } }, n)))); };
    draw(); return { body: [h('h2', { class: 'ftitle' }, 'Focus sprint'), inp, w], foot: [btn('Begin', () => { S.fMin = mins; S.fSnd = snd; save(); if (snd) { ambPlay(snd); keepAlive(true); } const task = inp.value.trim();
      FL.steps.push({ t: 'timer', sec: mins * 60, title: task || 'Stay with one thing', body: 'Keep this screen open.' }); FL.opt.onClose = () => { ambStop(true); keepAlive(false); }; FL.opt.done = () => { ambStop(true); keepAlive(false); S.focusMin = (S.focusMin || 0) + mins; save(); closeFlow(); render(); toast('Sprint done. Stretch and drink water.'); }; next(); })] }; } }], { label: 'Focus', nofocus: true });
} };
CATS[0][1].unshift('reset'); CATS.splice(3, 0, ['Focus', ['focus']]);
boot();

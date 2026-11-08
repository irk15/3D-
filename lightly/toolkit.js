'use strict';
/* Lightly toolkit: SOS, Worry box, Wind down (sleep), Focus sprint, Journey, deep links.
   Everything is stored only on this device. No accounts, no streaks you can lose.
   Uses globals from app.js and reset.js. */

const GRID = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/></svg>';
const HELPLINE = 'https://findahelpline.com';
const SLP = { t: null };

const todayKey = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
function mark(kind, n) {
  S.days = S.days || []; const t = todayKey(); if (!S.days.includes(t)) { S.days.push(t); if (S.days.length > 200) S.days.shift(); }
  S.n = S.n || {}; S.n[kind] = (S.n[kind] || 0) + (n || 1); save();
}
const ago = t => { const m = Math.round((Date.now() - t) / 60000); if (m < 2) return 'just now'; if (m < 60) return m + ' min ago'; const hr = Math.round(m / 60); if (hr < 24) return hr + ' h ago'; const d = Math.round(hr / 24); return d + (d === 1 ? ' day ago' : ' days ago'); };
const pad2 = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
const nextBtn = (label, fn, dis) => h('button', { class: 'next', style: 'flex:none;width:100%', disabled: !!dis, onclick: fn }, label);
const linkBtn = (label, fn) => h('button', { class: 'link', onclick: fn }, label);
const bigOrb = (scale) => h('div', { class: 'rsorbwrap' }, h('div', { class: 'rsorb', style: 'transform:scale(' + (scale || 1) + ')' }));

/* ---------- toolkit sheet ---------- */
function openToolkit() {
  const T = [
    ['Reset', 'Quiet a loud head in 60 seconds', '#FF9A3C', startReset],
    ['SOS', 'Panic or a spiral right now', '#F28B82', startSOS],
    ['Worry box', 'Park a worry. Check it later.', '#C7B8FF', openWorry],
    ['Wind down', 'Clear your head, then sleep', '#8FD3FF', startWind],
    ['Focus sprint', 'One thing, timed, with sound', '#9AD7C4', openFocus],
    ['Your journey', 'Days you showed up, good things', '#FFD166', openJourney]
  ];
  const bg = sheet([h('h2', null, 'Toolkit'), h('p', { style: 'color:var(--mut);margin:0 0 12px' }, 'Pick what you need right now.'),
    h('div', { class: 'rsgrid' }, T.map(t => h('button', { class: 'rscard', style: '--c:' + t[2], onclick: () => { bg.remove(); t[3](); } }, h('i'), h('b', null, t[0]), h('small', null, t[1])))),
    h('p', { class: 'sm', style: 'margin-top:16px' }, 'Lightly is a self-help tool, not therapy or medical care. If you are struggling, please talk to someone.'),
    h('a', { class: 'link', href: HELPLINE, target: '_blank', rel: 'noopener', style: 'display:block;text-align:center;padding:10px 0 2px;color:var(--mut)' }, 'Find a helpline in your country')]);
}

/* ---------- SOS: slow breathing, then 5-4-3-2-1 grounding ---------- */
function startSOS() {
  stopAudio(); if (!rOpen()) return;
  rFrame(0, [bigOrb(1), h('div', { class: 'rstitle' }, 'You are safe right now.'), h('p', { class: 'rssub' }, 'This feeling is strong, and it will pass. We will slow your body down first.')],
    [nextBtn('Breathe with me', sosBreathe), linkBtn('Skip to grounding', () => sosGround(5))]);
}
function sosBreathe() {
  const orb = h('div', { class: 'rsorb' }), cue = h('div', { class: 'rscue' }, 'Get ready'), cnt = h('div', { class: 'rscount' }, '');
  rFrame(0, [h('div', { class: 'rsorbwrap' }, orb), cue, cnt, h('p', { class: 'rssub small' }, 'In through your nose for four. Out slowly for six.')], linkBtn('Skip', () => sosGround(5)));
  const set = (txt, sc, ms) => { cue.textContent = txt; orb.style.transition = 'transform ' + (reduceMotion() ? .01 : ms / 1000) + 's ease-in-out'; orb.style.transform = 'scale(' + sc + ')'; };
  let n = 0;
  const go = () => { n++; cnt.textContent = n + ' of 4'; set('In', 1.5, 4000); rLater(() => set('Out, slowly', .8, 6000), 4000); rLater(() => { if (n < 4) go(); else sosGround(5); }, 10000); };
  rLater(go, 800);
}
const GROUND = { 5: 'Name five things you can see. Say them in your head.', 4: 'Notice four things you can feel: your feet, your chair, your clothes.', 3: 'Listen for three sounds, near or far.', 2: 'Find two things you can smell, or two you like the smell of.', 1: 'Notice one thing you can taste, or take one slow sip of water.' };
function sosGround(n) {
  rFrame(0, [h('div', { class: 'rsbig' }, String(n)), h('div', { class: 'rstitle' }, GROUND[n])], [nextBtn(n > 1 ? 'Done, next' : 'Done', () => n > 1 ? sosGround(n - 1) : sosEnd()), linkBtn('Skip', sosEnd)]);
}
function sosEnd(hard) {
  rFrame(0, [bigOrb(1), h('div', { class: 'rstitle' }, hard ? 'That is okay. You do not have to do this alone.' : 'How do you feel now?'),
    hard ? h('p', { class: 'rssub' }, 'Try the breathing once more, or reach a person you trust. If you might hurt yourself, please contact your local emergency number now.') : null],
    hard ? [nextBtn('Breathe again', sosBreathe), h('a', { class: 'link', href: HELPLINE, target: '_blank', rel: 'noopener', style: 'text-align:center' }, 'Find a helpline in your country'), linkBtn('Close', () => closeReset(false))]
      : [nextBtn('A bit calmer', () => { mark('sos'); closeReset(false); toast('Well done for staying with it'); }), linkBtn('Still hard', () => sosEnd(true))]);
}

/* ---------- worry box: park it now, look again when it is smaller ---------- */
function openWorry() {
  const bg = sheet([]), box = bg.querySelector('.sheet');
  const draw = () => {
    box.innerHTML = ''; S.worries = S.worries || [];
    const open = S.worries.filter(w => !w.r), done = S.worries.filter(w => w.r), gone = done.filter(w => w.r === 'gone').length;
    const inp = h('input', { class: 'rsinput', maxlength: 160, placeholder: 'What is the worry?', 'aria-label': 'Worry', autocomplete: 'off', enterkeyhint: 'done' });
    const park = () => { const t = inp.value.trim(); if (!t) return; S.worries.unshift({ t, at: Date.now(), r: null }); mark('park'); toast('Parked. You do not have to carry it now.'); draw(); };
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') park(); });
    box.append(h('h2', null, 'Worry box'), h('p', { style: 'color:var(--mut);margin:0 0 12px' }, 'Write it down, park it, and come back later. Most worries look smaller after a few hours.'),
      h('div', { class: 'rsrow' }, inp, h('button', { class: 'next', style: 'flex:none;height:50px;padding:0 20px', onclick: park }, 'Park it')));
    if (done.length >= 3) box.append(h('div', { class: 'stat' }, h('b', null, gone + ' of ' + done.length), ' parked worries never happened. Your mind rehearses more than reality delivers.'));
    if (!open.length) box.append(h('p', { class: 'sm', style: 'margin-top:16px' }, 'Nothing parked right now.'));
    open.slice(0, 12).forEach(w => box.append(h('div', { class: 'wrow' }, h('div', { class: 'wt' }, w.t), h('small', null, 'Parked ' + ago(w.at) + '. Look at it again: is it still a problem?'),
      h('div', { class: 'wbtns' }, [['Didn’t happen', 'gone'], ['Let it go', 'letgo'], ['Still real', 'real']].map(([l, k]) => h('button', { class: 'chip', onclick: () => { if (k === 'real') { w.at = Date.now(); toast('Kept. Try one tiny first move on it.'); } else w.r = k; save(); draw(); } }, l))))));
  };
  draw();
}

/* ---------- wind down: park tomorrow's problems, one good thing, sleep sound with timer ---------- */
function startWind() {
  if (!rOpen()) return; wStep1();
}
function wStep1() {
  const ta = h('textarea', { class: 'rsta', rows: 4, maxlength: 300, placeholder: 'What is still on your mind?', 'aria-label': 'What is still on your mind' });
  const nx = nextBtn('Park it for tomorrow', () => { const t = ta.value.trim(); if (t) { S.worries = S.worries || []; S.worries.unshift({ t, at: Date.now(), r: null }); mark('park'); } wStep2(); });
  rFrame(1, [h('div', { class: 'rstitle' }, 'Park tomorrow’s problems'), h('p', { class: 'rssub' }, 'Your brain keeps replaying what is unfinished. Write it down and it can stop guarding it.'), ta], [nx, linkBtn('Nothing on my mind', wStep2)], 3);
  rLater(() => { try { ta.focus({ preventScroll: true }); } catch (e) {} }, 350);
}
function wStep2() {
  const inp = h('input', { class: 'rsinput', maxlength: 160, placeholder: 'Something small counts', 'aria-label': 'One good thing' });
  rFrame(2, [h('div', { class: 'rstitle' }, 'One good thing from today'), h('p', { class: 'rssub' }, 'Ending the day on something that went okay helps your mind settle.'), inp],
    [nextBtn('Save and continue', () => { const t = inp.value.trim(); if (t) { S.good = S.good || []; S.good.unshift({ t, at: Date.now() }); S.good = S.good.slice(0, 60); save(); } wStep3(); }), linkBtn('Skip', wStep3)], 3);
}
const SLEEP_SOUNDS = ['Rain', 'Ocean', 'Night', 'Forest', 'Fireplace', 'Hum', 'Om chant', 'None'];
function wStep3() {
  let snd = S.sleepSnd || 'Rain', mins = S.sleepMin == null ? 30 : S.sleepMin;
  const wrap = h('div');
  const draw = () => {
    wrap.innerHTML = '';
    wrap.append(h('div', { class: 'sub' }, 'Sound'), h('div', { class: 'chips2' }, SLEEP_SOUNDS.map(k => h('button', { class: 'chip' + (snd === k ? ' on' : ''), onclick: () => { snd = k; draw(); } }, k))),
      h('div', { class: 'sub' }, 'Stop after'), h('div', { class: 'chips2' }, [[15, '15 min'], [30, '30 min'], [60, '1 hour'], [0, 'I will stop it']].map(([m, l]) => h('button', { class: 'chip' + (mins === m ? ' on' : ''), onclick: () => { mins = m; draw(); } }, l))));
  };
  draw();
  rFrame(3, [h('div', { class: 'rstitle' }, 'Now rest'), h('p', { class: 'rssub' }, 'Pick a sound. It keeps playing with the screen off, then fades out.'), wrap],
    [nextBtn('Start and sleep', () => {
      S.sleepSnd = snd; S.sleepMin = mins; save(); mark('wind');
      if (SLP.t) { clearTimeout(SLP.t); SLP.t = null; }
      if (snd !== 'None') { startAmbient(snd); keepAlive(true); if (mins) SLP.t = setTimeout(() => { SLP.t = null; stopAmbient(); keepAlive(false); }, mins * 60000); }
      rFrame(0, [bigOrb(.9), h('div', { class: 'rstitle' }, 'Sleep well.'), h('p', { class: 'rssub' }, snd === 'None' ? 'You did what you could for today.' : (mins ? 'The sound will fade out in ' + mins + ' minutes.' : 'The sound plays until you stop it.'))],
        [nextBtn('Close', () => closeReset(false, true)), linkBtn('Stop sound', () => { if (SLP.t) { clearTimeout(SLP.t); SLP.t = null; } stopAmbient(); keepAlive(false); closeReset(false, true); })]);
    }), linkBtn('Skip the sound', () => closeReset(false, true))], 3);
}

/* ---------- focus sprint ---------- */
function openFocus() {
  let mins = S.fMin || 25, snd = S.fSnd == null ? 'Brown noise' : S.fSnd;
  const inp = h('input', { class: 'rsinput', maxlength: 100, placeholder: 'The one thing (optional)', 'aria-label': 'The one thing' });
  const w = h('div'); const bg = sheet([h('h2', null, 'Focus sprint'), h('p', { style: 'color:var(--mut);margin:0 0 12px' }, 'One thing, a timer, and a steady sound. Keep this screen open.'), inp, w]);
  const draw = () => {
    w.innerHTML = '';
    w.append(h('div', { class: 'sub' }, 'Length'), h('div', { class: 'chips2' }, [10, 25, 45].map(m => h('button', { class: 'chip' + (mins === m ? ' on' : ''), onclick: () => { mins = m; draw(); } }, m + ' min'))),
      h('div', { class: 'sub' }, 'Sound'), h('div', { class: 'chips2' }, ['Off', 'Brown noise', 'Rain', 'Forest', 'Focus beats'].map(k => h('button', { class: 'chip' + (snd === k ? ' on' : ''), onclick: () => { snd = k; draw(); } }, k))),
      h('button', { class: 'next', style: 'width:100%;flex:none;margin-top:18px', onclick: () => { S.fMin = mins; S.fSnd = snd; save(); bg.remove(); runSprint(inp.value.trim(), mins, snd); } }, 'Begin'));
  };
  draw();
}
function runSprint(task, mins, snd) {
  stopAudio(); if (!rOpen()) return;
  if (snd !== 'Off') { startAmbient(snd); keepAlive(true); }
  const R = 54, C = 2 * Math.PI * R, sec = mins * 60, ring = h('div', { class: 'rsring' }), time = h('div', { class: 'rstime', role: 'timer' }, pad2(sec));
  ring.innerHTML = '<svg viewBox="0 0 120 120" width="190" height="190" aria-hidden="true"><circle cx="60" cy="60" r="' + R + '" fill="none" stroke="var(--line)" stroke-width="6"/><circle id="rsarc" cx="60" cy="60" r="' + R + '" fill="none" stroke="var(--accent)" stroke-width="6" stroke-linecap="round" stroke-dasharray="' + C + '" stroke-dashoffset="0" transform="rotate(-90 60 60)"/></svg>'; ring.append(time);
  const finish = (early) => { rClear(); stopAmbient(); keepAlive(false); const done = Math.max(1, Math.round((Date.now() - t0) / 60000)); mark('focus', done);
    rFrame(0, [bigOrb(1), h('div', { class: 'rstitle' }, early ? 'Good start.' : 'Sprint complete.'), h('p', { class: 'rssub' }, 'Stand up, drink some water, and rest your eyes for a minute.')], [nextBtn('Another sprint', () => { closeReset(false); openFocus(); }), linkBtn('Close', () => closeReset(false))]); };
  rFrame(0, [h('div', { class: 'beat' }, 'Just this, for now'), h('div', { class: 'rsmovebig' }, task || 'Stay with one thing.'), ring], linkBtn('End early', () => finish(true)));
  const t0 = Date.now(), arc = $('#rsarc');
  const upd = () => { const left = Math.max(0, sec - Math.round((Date.now() - t0) / 1000)); time.textContent = pad2(left); arc.style.strokeDashoffset = C * (1 - left / sec); if (left <= 0) { clearInterval(RS.tick); RS.tick = null; if (navigator.vibrate) try { navigator.vibrate([80, 80, 80]); } catch (e) {} finish(false); } };
  upd(); RS.tick = setInterval(upd, 500);
}

/* ---------- journey: kind, no streaks to lose ---------- */
function openJourney() {
  const days = new Set(S.days || []), n = S.n || {}, W = S.worries || [], res = W.filter(w => w.r), gone = res.filter(w => w.r === 'gone').length;
  const wk = []; for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); wk.push([k, 'SMTWTFS'[d.getDay()]]); }
  const shown = wk.filter(x => days.has(x[0])).length;
  const stat = (v, l) => h('div', { class: 'jstat' }, h('b', null, String(v)), h('small', null, l));
  const bg = sheet([h('h2', null, 'Your journey'), h('p', { style: 'color:var(--mut);margin:0 0 12px' }, 'No streaks to lose. Every day you show up counts, and none are taken away.'),
    h('div', { class: 'wk' }, wk.map(([k, l]) => h('div', { class: 'wkd' + (days.has(k) ? ' on' : '') }, h('i'), h('small', null, l)))),
    h('p', { class: 'sm', style: 'text-align:center;margin:6px 0 14px' }, shown ? 'You showed up ' + shown + (shown === 1 ? ' day' : ' days') + ' this week.' : 'Open Lightly when you need it. That is enough.'),
    h('div', { class: 'jgrid' }, stat(n.reset || 0, 'resets done'), stat(n.focus || 0, 'focus minutes'), stat(gone + '/' + res.length, 'worries that never happened')),
    (S.good && S.good.length) ? [h('div', { class: 'sub' }, 'Good things'), S.good.slice(0, 6).map(g => h('div', { class: 'item' }, h('span', null, g.t)))] : null,
    h('button', { class: 'link', style: 'padding:16px 0 2px;color:var(--mut);width:100%', onclick: () => { if (confirm('Erase your worries, good things and counts from this phone?')) { S.worries = []; S.good = []; S.days = []; S.n = {}; save(); bg.remove(); toast('Erased'); } } }, 'Erase everything I wrote')]);
}

/* ---------- deep links: ?go=reset|sos|worry|wind|focus|journey|toolkit ---------- */
function deepLink() {
  const g = new URLSearchParams(location.search).get('go'); if (!g) return;
  const M = { reset: startReset, sos: startSOS, worry: openWorry, wind: startWind, focus: openFocus, journey: openJourney, toolkit: openToolkit };
  try { history.replaceState(null, '', location.pathname); } catch (e) {}
  if (M[g]) setTimeout(M[g], 500);
}

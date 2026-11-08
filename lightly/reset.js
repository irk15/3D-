'use strict';
/* Lightly Reset: a 60-second way out of an overthinking loop.
   Name it -> breathe -> let it go -> flip -> one tiny start.
   Nothing typed here is ever stored. Uses globals from app.js (h, $, S, save, FEELS, LINES, speakLine, stopAudio, render, toast). */

const RESET_STATES = [
  { k: 'Looping', sub: 'Same thoughts, round and round', feel: 'Overthinking', c: '#C7B8FF', ph: 'What keeps replaying?',
    moves: ['Write the next action as one verb: call, send, open, write.', 'Stand up and drink a glass of water.', 'Put one thing on your desk back where it belongs.'] },
  { k: 'Frozen', sub: 'I cannot make myself start', feel: 'Stuck', c: '#FFB36B', ph: 'What are you avoiding?',
    moves: ['Open the file or app. Touch nothing else.', 'Do the ugliest possible first draft for 2 minutes.', 'Do only the first 30 seconds of it.'] },
  { k: 'Anxious', sub: 'Tight, worried, on edge', feel: 'Anxious', c: '#9AD7C4', ph: 'What are you afraid might happen?',
    moves: ['Feet flat on the floor. Name five things you can see.', 'Look out a window at something far away for 20 seconds.', 'Send one kind message to someone.'] },
  { k: 'Heavy', sub: 'Low, flat, no energy', feel: 'Low', c: '#FFD166', ph: 'What feels heavy right now?',
    moves: ['Open a window or step outside for one minute.', 'Drink some water.', 'Do one tiny chore, like making the bed.'] },
  { k: 'Angry', sub: 'Irritated, wound up', feel: 'Angry', c: '#F28B82', ph: 'Say all of it here. No one will read it.',
    moves: ['Unclench your jaw and hands. Drop your shoulders.', 'Walk for two minutes.', 'Do not send the message yet. Write it here instead.'] },
  { k: 'Blank', sub: 'No direction, drifting', feel: 'Stuck', c: '#8FD3FF', ph: 'What would make today a win?',
    moves: ['Pick the easiest thing on your list. Do only that.', 'Clear one surface.', 'Choose one 25-minute block and begin.'] }
];

const RS = { box: null, bg: null, st: null, move: null, line: null, timers: [], tick: null };
const rClear = () => { RS.timers.forEach(clearTimeout); RS.timers = []; clearInterval(RS.tick); RS.tick = null; };
const rLater = (fn, ms) => { const t = setTimeout(fn, ms); RS.timers.push(t); return t; };
const reduceMotion = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

function resetLine(feel) {
  const seen = new Set(), pool = [];
  (FEELS[feel] ? FEELS[feel].m : ['Calm']).forEach(m => LINES[m].forEach(l => { if (!seen.has(l[0])) { seen.add(l[0]); pool.push(l); } }));
  return pool[rand(pool.length)];
}

function startReset() {
  if (RS.box) return;
  stopAudio();
  RS.st = null; RS.move = null; RS.line = null;
  RS.bg = h('div', { class: 'flow-bg' }); RS.box = h('div', { class: 'flow rs', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Reset' });
  document.body.append(RS.bg, RS.box);
  try { if (navigator.wakeLock) navigator.wakeLock.request('screen').then(l => { RS.lock = l; }).catch(() => {}); } catch (e) {}
  rName();
}
function closeReset(apply) {
  rClear(); stopAudio();
  try { if (RS.lock) RS.lock.release(); } catch (e) {} RS.lock = null;
  if (RS.box) RS.box.remove(); if (RS.bg) RS.bg.remove(); RS.box = RS.bg = null;
  if (apply && RS.st) { S.feel = RS.st.feel; S.feelAt = Date.now(); save(); render(); }
}
function rFrame(step, body, foot) {
  rClear();
  RS.box.innerHTML = '';
  RS.box.append(
    h('div', { class: 'top' }, h('div', { class: 'rsstep' }, step ? 'Step ' + step + ' of 5' : ''), h('button', { class: 'icon', 'aria-label': 'Close', html: XI, onclick: () => closeReset(false) })),
    h('div', { class: 'stage rsstage' }, body),
    h('div', { class: 'dock' }, step ? h('div', { class: 'dots' }, [1, 2, 3, 4, 5].map(j => h('i', { class: j === step ? 'on' : '' }))) : null, foot));
}

/* 1. Name it: labelling a feeling lowers its intensity */
function rName() {
  rFrame(1, [
    h('div', { class: 'rstitle' }, 'What is your mind doing?'),
    h('p', { class: 'rssub' }, 'Naming it takes some of its power. Pick the closest.'),
    h('div', { class: 'rsgrid' }, RESET_STATES.map(s => h('button', { class: 'rscard', style: '--c:' + s.c, onclick: () => { RS.st = s; if (navigator.vibrate) try { navigator.vibrate(10); } catch (e) {} rBreathe(); } }, h('i'), h('b', null, s.k), h('small', null, s.sub))))
  ], h('button', { class: 'link', onclick: () => { closeReset(false); openSituations(); } }, 'Something specific happened'));
}

/* 2. Breathe: double inhale + long exhale, three rounds (about 25 seconds) */
function rBreathe() {
  const orb = h('div', { class: 'rsorb' }), cue = h('div', { class: 'rscue' }, 'Get ready'), cnt = h('div', { class: 'rscount' }, '');
  rFrame(2, [h('div', { class: 'rsorbwrap' }, orb), cue, cnt,
    h('p', { class: 'rssub small' }, 'In through the nose, a small second sip of air, then a long slow breath out. If you feel dizzy, breathe normally.')],
    h('button', { class: 'link', onclick: rDump }, 'Skip'));
  const set = (txt, scale, ms) => { cue.textContent = txt; orb.style.transition = 'transform ' + (reduceMotion() ? 0.01 : ms / 1000) + 's ease-in-out'; orb.style.transform = 'scale(' + scale + ')'; };
  let round = 0;
  const go = () => {
    round++; cnt.textContent = round + ' of 3';
    set('In', 1.25, 2000);
    rLater(() => set('In again, a little more', 1.55, 900), 2100);
    rLater(() => set('Out, slowly', 0.8, 5000), 3200);
    rLater(() => { if (round < 3) go(); else { cue.textContent = 'Good.'; cnt.textContent = ''; rLater(rDump, 1100); } }, 8300);
  };
  rLater(go, 900);
}

/* 3. Let it go: writing the loop down gets it out of your head. Never saved. */
function rDump() {
  const st = RS.st, ta = h('textarea', { class: 'rsta', rows: 5, maxlength: 400, placeholder: st.ph, 'aria-label': st.ph, autocomplete: 'off', autocapitalize: 'sentences', spellcheck: 'false' });
  const go = h('button', { class: 'next', style: 'flex:none;width:100%', onclick: () => {
    if (!ta.value.trim()) { rFlip(); return; }
    ta.blur(); ta.classList.add('gone'); go.disabled = true; go.textContent = 'Letting go…';
    rLater(() => { ta.value = ''; rFlip(); }, reduceMotion() ? 50 : 1500);
  } }, 'Let it go');
  rFrame(3, [h('div', { class: 'rstitle' }, 'Get it out of your head'), h('p', { class: 'rssub' }, 'Type it badly. It does not need to make sense. Nothing is saved, ever.'), ta],
    [go, h('button', { class: 'link', onclick: rFlip }, 'Skip this')]);
  rLater(() => { try { ta.focus({ preventScroll: true }); } catch (e) {} }, 350);
}

/* 4. Flip: one line that shifts the angle */
function rFlip() {
  const l = RS.line || (RS.line = resetLine(RS.st.feel)), two = !!l[2];
  const q = h('div', { class: 'quote rsq' + (two ? ' two' : '') });
  if (two) { q.append(h('div', { class: 'punch' }, l[0]), h('div', { class: 'insight', style: 'animation-delay:.8s' }, l[2])); } else q.append(l[0]);
  const lb = h('button', { class: 'listen rslisten', onclick: e => { const b = e.currentTarget; if (TTS.speaking) { stopAudio(); b.innerHTML = PLAY + '<span>Listen</span>'; } else { b.innerHTML = STOP + '<span>Stop</span>'; speakLine(l, () => { b.innerHTML = PLAY + '<span>Listen</span>'; }); } }, html: PLAY + '<span>Listen</span>' });
  const by = l[1] ? h('div', { class: 'by' }, two ? l[1] : '— ' + l[1]) : null;
  rFrame(4, [h('div', { class: 'beat' }, 'Try seeing it this way'), q, by, h('div', { style: 'margin-top:22px' }, lb)],
    [h('button', { class: 'next', style: 'flex:none;width:100%', onclick: () => { stopAudio(); rStart(); } }, 'Next'),
      h('button', { class: 'link', onclick: () => { RS.line = null; stopAudio(); rFlip(); } }, 'Another line')]);
}

/* 5. Start: a tiny first move lowers the effort of beginning */
function rStart() {
  const mv = RS.st.moves, list = h('div', { class: 'rsmoves' });
  const go = h('button', { class: 'next', style: 'flex:none;width:100%', disabled: true, onclick: () => rTimer(120) }, 'Start for 2 minutes');
  mv.forEach(m => list.append(h('button', { class: 'rsmove', onclick: e => { RS.move = m; [...list.children].forEach(c => c.classList.remove('on')); e.currentTarget.classList.add('on'); go.disabled = false; if (navigator.vibrate) try { navigator.vibrate(8); } catch (er) {} } }, h('i'), m)));
  rFrame(5, [h('div', { class: 'rstitle' }, 'Choose your smallest first move'), h('p', { class: 'rssub' }, 'Not the whole task. Just the first move. You can stop after two minutes.'), list],
    [go, h('button', { class: 'link', onclick: rDone }, 'Not now')]);
}
function rTimer(sec) {
  const R = 54, C = 2 * Math.PI * R, ring = h('div', { class: 'rsring' });
  ring.innerHTML = '<svg viewBox="0 0 120 120" width="190" height="190" aria-hidden="true"><circle cx="60" cy="60" r="' + R + '" fill="none" stroke="var(--line)" stroke-width="6"/><circle id="rsarc" cx="60" cy="60" r="' + R + '" fill="none" stroke="var(--accent)" stroke-width="6" stroke-linecap="round" stroke-dasharray="' + C + '" stroke-dashoffset="0" transform="rotate(-90 60 60)"/></svg>';
  const time = h('div', { class: 'rstime', role: 'timer' }, ''); ring.append(time);
  rFrame(0, [h('div', { class: 'beat' }, 'Just this, for now'), h('div', { class: 'rsmovebig' }, RS.move), ring],
    h('button', { class: 'link', onclick: rDone }, 'I am done'));
  const t0 = Date.now(), arc = $('#rsarc');
  const fmt = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  const upd = () => {
    const left = Math.max(0, sec - Math.round((Date.now() - t0) / 1000));
    time.textContent = fmt(left); arc.style.strokeDashoffset = C * (1 - left / sec);
    if (left <= 0) { clearInterval(RS.tick); RS.tick = null; if (navigator.vibrate) try { navigator.vibrate([60, 80, 60]); } catch (e) {} rTimesUp(); }
  };
  upd(); RS.tick = setInterval(upd, 250);
}
function rTimesUp() {
  rFrame(0, [h('div', { class: 'rstitle' }, 'Two minutes. You started.'), h('p', { class: 'rssub' }, 'Keep going if it feels easy now. Stopping is fine too. Either way, you beat the hard part.')],
    [h('button', { class: 'next', style: 'flex:none;width:100%', onclick: () => rTimer(300) }, 'Keep going, 5 more minutes'), h('button', { class: 'link', onclick: rDone }, 'That is enough')]);
}
function rDone() {
  rFrame(0, [h('div', { class: 'rsorbwrap' }, h('div', { class: 'rsorb done' })), h('div', { class: 'rstitle' }, 'Lighter.'), h('p', { class: 'rssub' }, 'You did not solve everything. You moved, and that is how it starts.')],
    [h('button', { class: 'next', style: 'flex:none;width:100%', onclick: () => closeReset(true) }, 'Back to my lines'), h('button', { class: 'link', onclick: () => { closeReset(false); startReset(); } }, 'Reset again')]);
}

/* one-time introduction to what Lightly is for */
function introReset() {
  if (S.intro26 || !S.coach) return;
  setTimeout(() => {
    if (S.intro26 || document.querySelector('.sheet-bg') || RS.box) return;
    const bg = sheet([h('h2', { class: 'big' }, 'Quiet the noise. Start.'),
      h('p', { style: 'color:var(--mut);margin:4px 0 14px' }, 'Lightly is for the moment your head gets loud: looping thoughts, a task you cannot begin, a mind that will not settle.'),
      h('p', { style: 'margin:0 0 18px' }, 'Tap Reset. In about a minute you will name what is happening, breathe, let it out, see it differently, and take one tiny first step.'),
      h('button', { class: 'next', style: 'width:100%;flex:none', onclick: () => { S.intro26 = 1; save(); bg.remove(); startReset(); } }, 'Try a reset'),
      h('button', { class: 'link', style: 'padding:14px 0 2px', onclick: () => { S.intro26 = 1; save(); bg.remove(); } }, 'Maybe later')]);
  }, 900);
}

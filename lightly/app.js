'use strict';
/* Lightly — short lines that calm you, wake you up, and lighten how a situation looks.
   Everything stays on your phone. */

const VERSION = 'v17';
(function () { try { const v = getComputedStyle(document.documentElement).getPropertyValue('--v').trim(); if (v !== '17') { const l = document.querySelector('link[href^="style.css"]'); if (l && !sessionStorage.getItem('cssfix')) { sessionStorage.setItem('cssfix', '1'); l.href = 'style.css?v=' + Date.now(); } } } catch (e) {} })();
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
const SHARE = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V4M8 8l4-4 4 4M5 13v5a2 2 0 002 2h10a2 2 0 002-2v-5"/></svg>';
const SLIDERS = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 8h9M17 8h3M4 16h3M11 16h9"/><circle cx="15" cy="8" r="2"/><circle cx="9" cy="16" r="2"/></svg>';
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

// Real quotes from history (ancient and public-domain sources), each with a plain-language reading. Translations vary; paraphrases are labeled.
const BRILLIANT = [
  ['Men are disturbed not by things, but by the views which they take of them.', '\u2014 Epictetus', 'The event is neutral. Your interpretation is the one part you can edit.'],
  ['There is nothing either good or bad, but thinking makes it so.', '\u2014 Shakespeare, Hamlet', 'Change the thought and you change what this moment is.'],
  ['Confine yourself to the present.', '\u2014 Marcus Aurelius', 'Right now, this exact second, you are handling it. That is all life ever asks.'],
  ['The soul becomes dyed with the color of its thoughts.', '\u2014 Marcus Aurelius', 'Feed your mind clear, strong thoughts and it takes on their color.'],
  ['Waste no more time arguing what a good man should be. Be one.', '\u2014 Marcus Aurelius', 'Stop planning the better version of you. Act as him for the next ten minutes.'],
  ['The best revenge is not to be like your enemy.', '\u2014 Marcus Aurelius', 'Staying composed is not weakness. It is the only move that actually wins.'],
  ['The pain is not due to the thing itself, but to your estimate of it.', '\u2014 Marcus Aurelius', 'And you can revoke that estimate at any moment. Right now, if you choose.'],
  ['First say to yourself what you would be; then do what you have to do.', '\u2014 Epictetus', 'Decide who you are first. The actions follow.'],
  ['No man is free who is not master of himself.', '\u2014 Epictetus', 'Freedom is not doing what you feel. It is choosing what you do while you feel it.'],
  ['While we are postponing, life speeds by.', '\u2014 Seneca', 'The thing you are waiting to feel ready for is available now.'],
  ['It is not that we have a short time to live, but that we waste much of it.', '\u2014 Seneca', 'Time is not scarce. Attention is. Spend it on purpose.'],
  ['Begin at once to live, and count each separate day as a separate life.', '\u2014 Seneca', 'Treat today as a complete life, not a rehearsal for one.'],
  ['We suffer more often in imagination than in reality.', '\u2014 Seneca', 'Most of the pain is the movie in your head. Come back to the room.'],
  ['The unexamined life is not worth living.', '\u2014 Socrates', 'Look at your own thoughts like a scientist. Curiosity beats self-judgment.'],
  ['Character is destiny.', '\u2014 Heraclitus', 'Small repeated choices become who you are. Choose the next one well.'],
  ['Everything flows, and nothing stays.', '\u2014 Heraclitus (paraphrased)', 'Including this mood. Nothing you are feeling is permanent.'],
  ['Nothing can bring you peace but yourself.', '\u2014 Ralph Waldo Emerson', 'No event, person or achievement holds it. You do.'],
  ['To be great is to be misunderstood.', '\u2014 Ralph Waldo Emerson', 'Being misread is not proof you are wrong. It is often the cost of being original.'],
  ['Trust thyself: every heart vibrates to that iron string.', '\u2014 Ralph Waldo Emerson', 'Your own judgment is more reliable than you have been told.'],
  ['He who has a why to live can bear almost any how.', '\u2014 Friedrich Nietzsche', 'Purpose turns hardship into effort with a meaning.'],
  ['One must still have chaos in oneself to be able to give birth to a dancing star.', '\u2014 Friedrich Nietzsche', 'The mess inside you is raw material, not proof you are broken.'],
  ['What does not kill me makes me stronger.', '\u2014 Friedrich Nietzsche', 'Every hard stretch you survived is stored as strength. Count them.'],
  ['Anxiety is the dizziness of freedom.', '\u2014 S\u00F8ren Kierkegaard', 'That wobble means you have real choices. It signals room to move, not danger.'],
  ['Our doubts are traitors, and make us lose the good we oft might win.', '\u2014 Shakespeare, Measure for Measure', 'Doubt is loudest right before the attempt. Attempt anyway.'],
  ['All of humanity\u2019s problems stem from our inability to sit quietly in a room alone.', '\u2014 Blaise Pascal (paraphrased)', 'Practice sitting with yourself for five minutes. It is a quiet superpower.'],
  ['Not to laugh at human actions, nor weep at them, but to understand them.', '\u2014 Baruch Spinoza (paraphrased)', 'Understanding is the calmest form of strength. Ask why before you react.'],
  ['Knowing is not enough; we must apply. Willing is not enough; we must do.', '\u2014 Johann Wolfgang von Goethe', 'Insight without action is decoration. Do one small thing now.'],
  ['Mastering others is strength; mastering yourself is true power.', '\u2014 Lao Tzu (paraphrased)', 'The real contest is the half second before you respond.'],
  ['The supreme art of war is to subdue the enemy without fighting.', '\u2014 Sun Tzu', 'Win by staying unprovoked. The calmest person in the room holds the room.'],
  ['It is not what you look at that matters, it is what you see.', '\u2014 Henry David Thoreau', 'Same scene, different mind, different life. Choose what you notice.']
];

const LINES = {
  Osho: OSHO,
  Brilliant: BRILLIANT,
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
const MODES = ['Osho', 'Brilliant', 'Calm', 'Aware', 'Bright', 'Reframe'];

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
let S = { studio: 'nicole', fav: [], mode: 'Osho', bag: {}, preset: 'Soft', rate: .78, pitch: 1, vol: .9, ambient: 'Off', voiceName: null };
try { const d = JSON.parse(localStorage.getItem(KEY)); if (d) S = Object.assign(S, d); else { const o = JSON.parse(localStorage.getItem('lightly_v1')); if (o && o.fav) S.fav = o.fav; } } catch (e) {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
const rand = n => Math.floor(Math.random() * n);

/* shuffle bag so lines do not repeat until all have been seen */
const FEELS = {
  Angry: { m: ['Calm', 'Reframe', 'Brilliant'], c: '#F28B82', t: 'Let it cool' },
  Anxious: { m: ['Calm', 'Aware'], c: '#9AD7C4', t: 'Come back to now' },
  Low: { m: ['Bright', 'Osho', 'Reframe'], c: '#FFD166', t: 'Lift gently' },
  Overthinking: { m: ['Aware', 'Brilliant'], c: '#C7B8FF', t: 'Quiet the loop' },
  Tired: { m: ['Calm', 'Bright'], c: '#8FD3FF', t: 'Rest your mind' },
  Okay: { m: ['Brilliant', 'Aware', 'Bright'], c: '#B8D8A8', t: 'Stay sharp' },
  Strong: { m: ['Osho', 'Brilliant'], c: '#FF9A3C', t: 'Ride it' }
};
const poolOf = () => { if (!S.feel || !FEELS[S.feel]) return LINES[S.mode]; const seen = new Set(), out = []; FEELS[S.feel].m.forEach(m => LINES[m].forEach(l => { if (!seen.has(l[0])) { seen.add(l[0]); out.push(l); } })); return out; };
function nextLine(mode) {
  const all = poolOf(); mode = S.feel && FEELS[S.feel] ? 'f:' + S.feel : mode; let bag = (S.bag[mode] || []).filter(i => i < all.length);
  if (!bag.length) { bag = all.map((_, i) => i); for (let i = bag.length - 1; i > 0; i--) { const j = rand(i + 1);[bag[i], bag[j]] = [bag[j], bag[i]]; } if (S.last && bag[bag.length - 1] === S.lastIdx && bag.length > 1) bag.unshift(bag.pop()); }
  const i = bag.pop(); S.bag[mode] = bag; S.lastIdx = i; S.last = mode; S.pos = all.length - bag.length; S.posN = all.length; save(); return all[i];
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
  const fire = S.mode === 'Osho', mind = S.mode === 'Brilliant'; document.body.classList.toggle('fire', fire); document.body.classList.toggle('mind', mind);
  skyInfo = sky(); const m = document.querySelector('meta[name=theme-color]');
  if (fire) { skyInfo = { night: true, accent: '#FF9A3C' }; if (m) m.content = '#120A07'; }
  if (mind) { skyInfo = { night: true, accent: '#8FD3FF' }; if (m) m.content = '#070D1C'; }
}

/* living background: embers (Osho), stars (Brilliant), soft light (the rest) */
(function fx() {
  const cv = $('#glow'), ctx = cv.getContext('2d'); let W, H, P = [], mode = '';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rnd = (a, b) => a + Math.random() * (b - a), hx = a => Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, '0');
  const modeNow = () => { const c = document.body.classList; return c.contains('fire') ? 'fire' : c.contains('mind') ? 'mind' : 'soft'; };
  function init() {
    mode = modeNow(); const n = mode === 'fire' ? 64 : mode === 'mind' ? 80 : 22;
    P = Array.from({ length: n }, () => mode === 'fire' ? { x: rnd(0, W), y: rnd(0, H), r: rnd(.6, 2.3), v: rnd(10, 40), p: rnd(0, 6), s: rnd(.4, 1.3) }
      : mode === 'mind' ? { x: rnd(0, W), y: rnd(0, H), r: rnd(.5, 1.8), vx: rnd(-4, 4), vy: rnd(-3, 3), p: rnd(0, 6) }
      : { x: rnd(0, W), y: rnd(0, H), r: rnd(18, 78), v: rnd(.08, .3), a: rnd(.05, .15), p: rnd(0, 6) });
  }
  function size() { const d = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; cv.width = W * d; cv.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0); init(); }
  size(); addEventListener('resize', size);
  let last = performance.now();
  function f(now) {
    const dt = Math.min(.05, (now - last) / 1000) * (reduce ? .2 : 1); last = now; ctx.clearRect(0, 0, W, H);
    if (modeNow() !== mode) init(); const col = skyInfo.accent;
    if (mode === 'fire') {
      const g = ctx.createLinearGradient(0, H * .55, 0, H); g.addColorStop(0, col + '00'); g.addColorStop(1, col + '2a'); ctx.fillStyle = g; ctx.fillRect(0, H * .55, W, H * .45);
      P.forEach(d => {
        d.y -= d.v * dt; d.x += Math.sin(d.p) * 14 * dt; d.p += dt * d.s * 2; if (d.y < -10) { d.y = H + 10; d.x = rnd(0, W); }
        const a = .25 + .75 * Math.abs(Math.sin(d.p * 1.3)), gr = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r * 7);
        gr.addColorStop(0, col + hx(a * .45)); gr.addColorStop(1, col + '00'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(d.x, d.y, d.r * 7, 0, 6.3); ctx.fill();
        ctx.fillStyle = col + hx(a); ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 6.3); ctx.fill();
      });
    } else if (mode === 'mind') {
      P.forEach(d => { d.x += d.vx * dt; d.y += d.vy * dt; d.p += dt; if (d.x < -5) d.x = W + 5; if (d.x > W + 5) d.x = -5; if (d.y < -5) d.y = H + 5; if (d.y > H + 5) d.y = -5; });
      ctx.lineWidth = 1;
      for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
        const dx = P[i].x - P[j].x, dy = P[i].y - P[j].y, dd = dx * dx + dy * dy;
        if (dd < 8100) { ctx.strokeStyle = col + hx((1 - Math.sqrt(dd) / 90) * .16); ctx.beginPath(); ctx.moveTo(P[i].x, P[i].y); ctx.lineTo(P[j].x, P[j].y); ctx.stroke(); }
      }
      P.forEach(d => { ctx.fillStyle = col + hx(.35 + .55 * Math.abs(Math.sin(d.p))); ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 6.3); ctx.fill(); });
    } else {
      P.forEach(d => {
        d.y -= d.v * dt * 20; d.p += dt * .4; if (d.y < -d.r) { d.y = H + d.r; d.x = rnd(0, W); }
        const a = d.a * (.7 + .3 * Math.sin(d.p)), g = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r);
        g.addColorStop(0, col + hx(a)); g.addColorStop(1, col + '00'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 6.3); ctx.fill();
      });
    }
    if (!document.hidden) requestAnimationFrame(f); else document.addEventListener('visibilitychange', () => { last = performance.now(); requestAnimationFrame(f); }, { once: true });
  }
  requestAnimationFrame(f);
})();


/* ---------- audio: the phone's own text-to-speech, works offline ---------- */
const canSpeak = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
const TTS = { voices: [], voice: null, token: 0, speaking: false, session: false, lock: null };
const BAD_VOICE = /^(Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Deranged|Good News|Hysterical|Jester|Junior|Kathy|Organ|Ralph|Superstar|Trinoids|Whisper|Wobble|Zarvox|Fred)/i;
const CALM_NAMES = ['Ava', 'Evan', 'Zoe', 'Daniel', 'Karen', 'Moira', 'Tessa', 'Serena', 'Samantha', 'Rishi', 'Oliver', 'Allison', 'Aaron', 'Nicky', 'Google UK English Female', 'Google UK English Male', 'Google US English'];
const isQuality = v => /premium|enhanced|natural|neural|siri/i.test(v.name);
function voiceScore(v) {
  let sc = 0; const n = v.name;
  if (/premium/i.test(n)) sc += 50; if (/enhanced|natural|neural|siri/i.test(n)) sc += 35;
  if (CALM_NAMES.some(c => n.indexOf(c) === 0)) sc += 20; if (/en-(IN|GB|AU|IE)/i.test(v.lang)) sc += 4; if (v.localService) sc += 2;
  return sc;
}
function bestVoice() { return TTS.voices[0] || null; }
function loadVoices() { if (!canSpeak) return; TTS.voices = (speechSynthesis.getVoices() || []).filter(v => /^en/i.test(v.lang) && !BAD_VOICE.test(v.name)).sort((x, y) => voiceScore(y) - voiceScore(x) || x.name.localeCompare(y.name)); TTS.voice = TTS.voices.find(v => v.name === S.voiceName) || bestVoice(); }
if (canSpeak) { loadVoices(); speechSynthesis.addEventListener && speechSynthesis.addEventListener('voiceschanged', loadVoices); }
function utter(text, done, tk) {
  const u = new SpeechSynthesisUtterance(text); if (TTS.voice) u.voice = TTS.voice; u.rate = S.rate || .78; u.pitch = S.pitch || 1; u.volume = S.vol == null ? 1 : S.vol;
  let fin = false; const end = () => { if (fin) return; fin = true; if (tk === TTS.token && done) done(); };
  u.onend = end; u.onerror = end; speechSynthesis.speak(u);
}
function phrasesOf(t) {
  return (t.match(/[^.,;:!?—]+[.,;:!?—]*\s*/g) || [t]).map(x => x.trim()).filter(Boolean).map(x => ({ t: x, pause: /[.!?]$/.test(x) ? 650 : /[,;:—]$/.test(x) ? 320 : 200 }));
}
function speakDevice(line, done) {
  if (!canSpeak || !line) return; speechSynthesis.cancel(); const tk = ++TTS.token; TTS.speaking = true; syncAudio();
  if (S.ambient && S.ambient !== 'Off' && !AMB.nodes) { startAmbient(S.ambient); AMB.byListen = true; }
  const who = line[1] && line[1].charAt(0) === '—' ? line[1].slice(2).replace(/\s*\(paraphrased\)/, '') : null;
  const items = []; [line[0], who, line[2]].filter(Boolean).forEach((part, pi, arr) => { const ph = phrasesOf(part); if (ph.length) ph[ph.length - 1].pause = pi === 0 ? 1000 : 750; items.push(...ph); });
  const run = i => {
    if (tk !== TTS.token) return;
    if (i >= items.length) { TTS.speaking = false; syncAudio(); if (!TTS.session && AMB.byListen) { stopAmbient(); AMB.byListen = false; } if (done) done(); return; }
    utter(items[i].t, () => setTimeout(() => run(i + 1), i === items.length - 1 ? 0 : items[i].pause), tk);
  };
  run(0);
}

/* ---------- studio voices: real audio files, keep playing when minimised or locked ---------- */
const STUDIO = [['nicole', 'Aria', 'Soft, calm woman'], ['heart', 'Heart', 'Warm, kind woman'], ['emma', 'Emma', 'British, gentle woman'], ['george', 'George', 'Deep, steady British man'], ['michael', 'Michael', 'Warm, grounded man'], ['fable', 'Fable', 'Storyteller, British man']];
const lh = t => { let x = 5381; for (let i = 0; i < t.length; i++) x = ((x * 33) ^ t.charCodeAt(i)) >>> 0; return x.toString(16); };
const AUD = { el: null, onEnd: null };
function audEl() {
  if (AUD.el) return AUD.el;
  const a = AUD.el = new Audio(); a.preload = 'auto'; a.setAttribute('playsinline', ''); a.volume = 1;
  a.addEventListener('ended', () => { const f = AUD.onEnd; AUD.onEnd = null; if (f) f(); });
  a.addEventListener('play', () => { if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing'; });
  a.addEventListener('pause', () => { if ('mediaSession' in navigator) navigator.mediaSession.playbackState = a.ended ? 'none' : 'paused'; });
  if ('mediaSession' in navigator) {
    const ms = navigator.mediaSession, set = (n, f) => { try { ms.setActionHandler(n, f); } catch (e) {} };
    set('play', () => { if (AUD.el.src && !AUD.el.ended) AUD.el.play(); else if (!TTS.session) toggleSession(); });
    set('pause', () => AUD.el.pause());
    set('stop', () => stopAudio());
    set('nexttrack', () => change());
  }
  return a;
}
function studioOn() { return S.studio !== 'device'; }
function speakStudio(line, done) {
  const v = STUDIO.some(x => x[0] === S.studio) ? S.studio : STUDIO[0][0], a = audEl(), tk = ++TTS.token;
  if (canSpeak) speechSynthesis.cancel();
  const fallback = () => { if (tk === TTS.token) { AUD.onEnd = null; speakDevice(line, done); } };
  AUD.onEnd = () => { if (tk !== TTS.token) return; TTS.speaking = false; syncAudio(); if (!TTS.session && AMB.byListen) { stopAmbient(); AMB.byListen = false; } if (done) done(); };
  a.onerror = fallback; a.src = 'audio/' + v + '/' + lh(line[0]) + '.mp3'; TTS.speaking = true; syncAudio();
  const p = a.play(); if (p && p.catch) p.catch(() => setTimeout(() => { if (tk === TTS.token) { const q = a.play(); if (q && q.catch) q.catch(fallback); } }, 500));
  if ('mediaSession' in navigator) { try { navigator.mediaSession.metadata = new MediaMetadata({ title: line[0], artist: 'Lightly', album: S.mode, artwork: [{ src: 'icon-512.png', sizes: '512x512', type: 'image/png' }] }); } catch (e) {} }
}
function speakLine(line, done) {
  if (!line) return;
  if (S.ambient && S.ambient !== 'Off' && !AMB.nodes) { startAmbient(S.ambient); AMB.byListen = true; }
  if (studioOn() && lh(line[0]) && !line._dev) { TTS.studio = true; speakStudio(line, done); } else { TTS.studio = false; speakDevice(line, done); }
}

/* ---------- soft background sound, made on the phone with Web Audio ---------- */
const AMB = { ctx: null, nodes: null };
function ambCtx() { if (!AMB.ctx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; AMB.ctx = new C(); } if (AMB.ctx.state === 'suspended') AMB.ctx.resume(); return AMB.ctx; }
function noiseBuf(ctx, brown) {
  const len = ctx.sampleRate * 4, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0); let last = 0;
  for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; if (brown) { last = (last + .02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w; }
  return b;
}
const NATURE = ['Rain', 'Ocean', 'Wind', 'Stream', 'Fire', 'Night', 'Storm', 'Drone', 'Bowls', 'Hum'];
const FOCUS = [['Brown noise', 'brown', 'Deep, even noise. Many people find it masks distraction and helps them settle into work.'], ['Pink noise', 'pink', 'Softer, balanced noise. Steady and easy to listen to for hours.'], ['Focus beats', 'beta', 'Binaural beat at 16 Hz, aimed at alert concentration. Use headphones.'], ['Calm beats', 'alpha', 'Binaural beat at 10 Hz, aimed at relaxed focus. Use headphones.'], ['Deep beats', 'theta', 'Binaural beat at 6 Hz, aimed at deep calm. Use headphones.'], ['Zone 40Hz', 'gamma', 'A gentle 40 Hz pulse over soft noise. Works on speakers.']];
const ambFile = k => { const f = FOCUS.find(x => x[0] === k); return f ? f[1] : k.toLowerCase(); };
const ambSrc = k => 'audio/ambient/' + ambFile(k) + '-' + (S.ambVol || 3) + '.wav';
function volMeter() {
  const val = h('b', { class: 'volv' }, ''), r = h('input', { type: 'range', min: 1, max: 5, step: 1, value: S.ambVol || 3, class: 'vol', 'aria-label': 'Background sound volume' });
  const paint = () => { const v = +r.value; r.style.setProperty('--p', ((v - 1) / 4 * 100) + '%'); val.textContent = ['Whisper', 'Soft', 'Medium', 'Strong', 'Full'][v - 1]; };
  r.addEventListener('input', paint);
  r.addEventListener('change', () => { S.ambVol = +r.value; save(); if (AMB.nodes && S.ambient && S.ambient !== 'Off') { const a = AMB.nodes.aud, t = a.currentTime; a.src = ambSrc(S.ambient); try { a.currentTime = t; } catch (e) {} a.play().catch(() => {}); } });
  paint();
  return h('div', { class: 'volwrap' }, h('span', { class: 'vi', html: '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h3l4-3v10l-4-3H3z"/></svg>' }), r, h('span', { class: 'vi', html: '<svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9h3l5-4v12l-5-4H3z"/><path d="M14.5 8a4 4 0 010 6M17 5.5a8 8 0 010 11"/></svg>' }), val);
}
function ambientBlock() {
  const w = h('div'); const VOL = [['Quiet', 1], ['Medium', 2], ['Loud', 3]];
  const chip = (k) => h('button', { class: 'chip' + ((S.ambient || 'Off') === k ? ' on' : ''), onclick: () => { S.ambient = k; save(); if (k === 'Off') stopAmbient(); else startAmbient(k); draw(); } }, k);
  const draw = () => {
    w.innerHTML = '';
    w.append(h('div', { class: 'chips2' }, chip('Off')), h('div', { class: 'sub' }, 'Nature'), h('div', { class: 'chips2' }, NATURE.map(chip)),
      h('div', { class: 'sub' }, 'Focus and concentration'), h('div', { class: 'chips2' }, FOCUS.map(f => chip(f[0]))),
      h('p', { class: 'sm' }, (FOCUS.find(f => f[0] === S.ambient) || [0, 0, 'Brown and pink noise are the most reliable. Binaural beats need headphones, and research on them is mixed, so treat them as a helper rather than a promise.'])[2]),
      h('div', { class: 'sub' }, 'Sound volume'), volMeter());
  };
  draw(); return w;
}
function startAmbient(kind) {
  stopAmbient(true); AMB.byListen = false; if (!kind || kind === 'Off') return;
  const a = new Audio(ambSrc(kind)); a.loop = true; a.setAttribute('playsinline', ''); a.volume = 0;
  AMB.nodes = { aud: a }; const p = a.play(); if (p && p.catch) p.catch(() => {});
  let v = 0; const iv = setInterval(() => { v = Math.min(1, v + .1); try { a.volume = v; } catch (e) {} if (v >= 1 || AMB.nodes?.aud !== a) clearInterval(iv); }, 200);
}
const KEEP = { el: null };
function keepAlive(on) {
  if (on) { if (!KEEP.el) { const a = KEEP.el = new Audio('audio/ambient/keep.wav'); a.loop = true; a.setAttribute('playsinline', ''); } const p = KEEP.el.play(); if (p && p.catch) p.catch(() => {}); }
  else if (KEEP.el) KEEP.el.pause();
}
function stopAmbient(now) {
  const n = AMB.nodes; if (!n) return; AMB.nodes = null; const a = n.aud;
  if (now) { a.pause(); return; }
  let v = a.volume; const iv = setInterval(() => { v = Math.max(0, v - .12); try { a.volume = v; } catch (e) {} if (v <= 0) { clearInterval(iv); a.pause(); } }, 150);
  setTimeout(() => { clearInterval(iv); a.pause(); }, 2000);
}

function stopAudio(keepSession) {
  TTS.token++; if (canSpeak) speechSynthesis.cancel(); if (AUD.el) { AUD.onEnd = null; AUD.el.pause(); } TTS.speaking = false;
  if (!keepSession || !TTS.session) { TTS.session = false; releaseLock(); keepAlive(false); stopAmbient(); }
  syncAudio();
}
function syncAudio() {
  const b = $('#listen'); if (b) { const act = TTS.speaking || TTS.session; b.classList.toggle('on', act); b.innerHTML = (act ? '<span class="eq"><i></i><i></i><i></i></span>' : PLAY) + '<span>' + (act ? 'Stop' : 'Listen') + '</span>'; }
  const s = $('#sess'); if (s) s.textContent = TTS.session ? 'Stop session' : 'Play session';
}
function toggleListen() { if (TTS.speaking || TTS.session) stopAudio(); else toggleSession(); }
async function takeLock() { try { if (navigator.wakeLock) TTS.lock = await navigator.wakeLock.request('screen'); } catch (e) {} }
function releaseLock() { try { if (TTS.lock) TTS.lock.release(); } catch (e) {} TTS.lock = null; }
function sessionStep(l) {
  if (!TTS.session) return;
  speakLine(l, () => {
    if (!TTS.session) return;
    const go = () => { if (!TTS.session) return; const nl = nextLine(S.mode); show(nl); sessionStep(nl); };
    if (TTS.studio) go(); else setTimeout(go, 3500);
  });
}
function toggleSession() {
  if (TTS.session) { stopAudio(); return; }
  TTS.session = true; takeLock(); keepAlive(true); syncAudio(); if (studioOn()) audEl(); sessionStep(cur);
}
const PRESETS = { Soft: { rate: .78, pitch: 1, vol: .9 }, Deep: { rate: .8, pitch: .78, vol: 1 }, Hush: { rate: .72, pitch: .9, vol: .55 }, Natural: { rate: .92, pitch: 1, vol: 1 } };
function studioList(preview) {
  const w = h('div', { class: 'vgrid' });
  const draw = () => {
    w.innerHTML = '';
    STUDIO.concat([['device', 'Phone voice', 'Your iPhone’s own voice']]).forEach(v => {
      const on = (S.studio || 'nicole') === v[0];
      w.append(h('button', { class: 'vcard' + (on ? ' on' : ''), onclick: () => { S.studio = v[0]; save(); stopAudio(); TTS.session = false; draw(); preview(); } },
        h('span', { class: 'vav' }, v[1].charAt(0)), h('span', { class: 'grow' }, h('b', null, v[1]), h('small', null, v[2])), h('span', { class: 'vchk' }, on ? '✓' : '')));
    });
  };
  draw(); return w;
}
function voiceSheet() {
  const row = (keys, cur, pick) => { const w = h('div', { class: 'chips2' }); keys.forEach(k => w.append(h('button', { class: 'chip' + (cur() === k ? ' on' : ''), onclick: e => { pick(k); [...w.children].forEach(c => c.classList.toggle('on', c === e.currentTarget)); } }, k))); return w; };
  const preview = () => { TTS.session = false; speakLine(studioOn() ? LINES.Osho[0] : ['Reaction is a puppet string.', null, 'Whoever pulls it owns your mood.']); };
  const list = h('div'); let all = false;
  const draw = () => {
    list.innerHTML = ''; const vs = all ? TTS.voices : TTS.voices.slice(0, 8);
    vs.forEach(v => list.append(h('button', { class: 'opt', style: 'font:600 16px var(--sans);padding:14px 18px;display:flex;justify-content:space-between;gap:10px' + (TTS.voice === v ? ';outline:2px solid var(--tx)' : ''), onclick: () => { TTS.voice = v; S.voiceName = v.name; save(); draw(); preview(); } }, h('span', null, v.name), h('span', { style: 'color:var(--mut);font-weight:500' }, isQuality(v) ? 'Premium' : v.lang))));
    if (!all && TTS.voices.length > 8) list.append(h('button', { class: 'link', style: 'padding:12px 0', onclick: () => { all = true; draw(); } }, 'Show all ' + TTS.voices.length + ' voices'));
    if (!TTS.voices.length) list.append(h('p', { style: 'color:var(--mut)' }, 'No English voices found on this device.'));
  };
  draw();
  const guide = h('div', { class: 'note' }, h('p', { style: 'margin:0 0 6px;font-weight:600' }, 'Want the most natural voice?'), h('p', { style: 'margin:0;color:var(--mut);font-size:15px;line-height:1.45' }, 'On iPhone, open Settings, then Accessibility, then Spoken Content, then Voices, then English. Download one marked Premium or Enhanced. Ava, Evan and Zoe are very calm. It will appear in this list, ranked first.'));
  const bg = sheet([h('h2', null, 'Settings'), installBlock(), updateBlock(), autoRow(),
    h('h3', { style: 'font:600 15px var(--sans);margin:4px 0 4px' }, 'Studio voice'),
    h('p', { style: 'margin:0 0 8px;color:var(--mut);font-size:14px' }, 'Real recordings. They keep playing when the app is minimised or the screen is locked.'),
    studioList(preview),
    h('h3', { style: 'font:600 15px var(--sans);margin:12px 0 8px' }, 'Phone voice style'),
    row(Object.keys(PRESETS), () => S.preset, k => { S.preset = k; Object.assign(S, PRESETS[k]); save(); preview(); }),
    h('h3', { style: 'font:600 15px var(--sans);margin:12px 0 8px' }, 'Background sound'),
    ambientBlock(),
    h('h3', { style: 'font:600 15px var(--sans);margin:12px 0 8px' }, 'Voice'), list, guide]);
  const obs = new MutationObserver(() => { if (!document.body.contains(bg)) { stopAudio(); obs.disconnect(); } }); obs.observe(document.body, { childList: true });
}
document.addEventListener('visibilitychange', () => { if (document.hidden && TTS.session) { /* phones pause speech when the screen locks */ } else if (!document.hidden && TTS.session) takeLock(); });



/* ---------- updates: see the version, force a clean reload ---------- */
async function refreshApp() {
  toast('Updating…');
  try { if ('serviceWorker' in navigator) { const rs = await navigator.serviceWorker.getRegistrations(); await Promise.all(rs.map(r => r.unregister())); } } catch (e) {}
  try { if (window.caches) { const ks = await caches.keys(); await Promise.all(ks.map(k => caches.delete(k))); } } catch (e) {}
  location.replace(location.pathname + '?v=' + Date.now());
}
async function checkUpdate(label) {
  try {
    const r = await fetch('app.js?x=' + Date.now(), { cache: 'no-store' }), t = await r.text(), m = t.match(/const VERSION = '([^']+)'/);
    if (m && m[1] !== VERSION) { label.textContent = 'Version ' + VERSION + ' — ' + m[1] + ' is available'; return true; }
    label.textContent = 'Version ' + VERSION + ' — up to date'; return false;
  } catch (e) { label.textContent = 'Version ' + VERSION + ' — offline'; return false; }
}
function updateBlock() {
  const lab = h('p', { style: 'color:var(--mut);margin:0 0 10px' }, 'Version ' + VERSION);
  const btn = h('button', { class: 'chip', style: 'width:100%;height:48px', onclick: refreshApp }, 'Refresh app now');
  checkUpdate(lab);
  return h('div', { style: 'margin:6px 0 22px' }, h('h3', { style: 'font:600 15px var(--sans);margin:4px 0 6px' }, 'Updates'), lab, btn);
}

/* ---------- install as an app ---------- */
let deferredInstall = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; });
const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
function installBlock() {
  const note = t => h('p', { style: 'color:var(--mut);margin:0' }, t);
  const w = h('div', { style: 'margin-bottom:22px' }, h('h3', { style: 'font:600 15px var(--sans);margin:4px 0 6px' }, 'Make it an app'));
  if (standalone) w.append(note('Installed. It opens full screen and works offline.'));
  else if (deferredInstall) w.append(h('button', { class: 'btn', onclick: async () => { deferredInstall.prompt(); try { await deferredInstall.userChoice; } catch (e) {} deferredInstall = null; } }, 'Install Lightly'));
  else if (/iphone|ipad|ipod/i.test(navigator.userAgent)) w.append(note('In Safari, tap the Share button, then Add to Home Screen.'));
  else w.append(note('In Chrome, open the menu (three dots), then tap Install app or Add to Home screen.'));
  return w;
}

/* ---------- share as an image (also works as a wallpaper) ---------- */
async function shareCard() {
  if (!cur) return;
  const cs = getComputedStyle(document.body), v = n => cs.getPropertyValue(n).trim() || '#000';
  const W = 1080, H = 1920, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, v('--bg1')); g.addColorStop(1, v('--bg2')); x.fillStyle = g; x.fillRect(0, 0, W, H);
  const acc = v('--accent'), tx = v('--tx');
  const rg = x.createRadialGradient(W * .82, H * .16, 0, W * .82, H * .16, 620); rg.addColorStop(0, acc + '55'); rg.addColorStop(1, acc + '00'); x.fillStyle = rg; x.fillRect(0, 0, W, H);
  const wrap = (t, font, maxW) => { x.font = font; const out = []; let ln = ''; t.split(' ').forEach(w => { const tt = ln ? ln + ' ' + w : w; if (x.measureText(tt).width > maxW && ln) { out.push(ln); ln = w; } else ln = tt; }); if (ln) out.push(ln); return out; };
  const two = !!cur[2], pf = (two ? '700 ' : '500 ') + (two ? 88 : 84) + 'px Georgia, serif', pl = wrap(cur[0], pf, W - 200), il = two ? wrap(cur[2], '400 46px Georgia, serif', W - 200) : [];
  const blockH = 40 + pl.length * 104 + (two ? 50 + il.length * 66 : 0) + (cur[1] ? 90 : 0); let y = (H - blockH) / 2;
  x.fillStyle = acc; x.fillRect(100, y, 130, 9); y += 110;
  x.fillStyle = tx; x.font = pf; x.textBaseline = 'alphabetic'; pl.forEach(l => { x.fillText(l, 100, y); y += 104; });
  if (two) { y += 6; x.globalAlpha = .8; x.font = '400 46px Georgia, serif'; il.forEach(l => { x.fillText(l, 100, y); y += 66; }); x.globalAlpha = 1; }
  if (cur[1]) { y += 34; x.fillStyle = acc; x.font = '600 38px -apple-system, Helvetica, Arial, sans-serif'; x.fillText(cur[1], 100, y); }
  x.globalAlpha = .6; x.fillStyle = tx; x.font = '500 40px Georgia, serif'; x.fillText('Lightly', 100, H - 120); x.globalAlpha = 1;
  const blob = await new Promise(r => cv.toBlob(r, 'image/png')); if (!blob) return toast('Could not make the image');
  const file = new File([blob], 'lightly.png', { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file] }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  const a = h('a', { href: URL.createObjectURL(blob), download: 'lightly.png' }); document.body.append(a); a.click(); a.remove(); toast('Saved as an image');
}

/* ---------- main screen ---------- */
let cur = null;
const MOOD_INFO = { Osho: ['Flip your mind', 'Strong lines in the spirit of Osho'], Brilliant: ['Think like history’s best', 'Real quotes from great minds'], Calm: ['Slow it down', 'Gentle lines to settle you'], Aware: ['Come back to now', 'Notice, pause, choose'], Bright: ['Lift the mood', 'Light, hopeful lines'], Reframe: ['See it differently', 'A kinder angle'] };
const MOOD_DOT = { Osho: '#FF9A3C', Brilliant: '#8FD3FF', Calm: '#9AD7C4', Aware: '#C7B8FF', Bright: '#FFD166', Reframe: '#F7A6C1' };
const CARET = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5l4 4 4-4"/></svg>';
const ARROW = '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14V4M4.5 8.5L9 4l4.5 4.5"/></svg>';
function moodSheet() {
  const bg = sheet([h('h2', { style: 'margin-bottom:10px' }, 'Choose a mood'),
    MODES.map(m => h('button', { class: 'moodcard' + (S.mode === m ? ' on' : ''), onclick: () => { S.mode = m; S.feel = null; save(); bg.remove(); render(); } },
      h('i', { class: 'dot big', style: 'background:' + MOOD_DOT[m] }), h('span', { class: 'grow' }, h('b', null, m), h('small', null, MOOD_INFO[m][0] + '. ' + MOOD_INFO[m][1] + '.'))))]);
}
function autoRow() {
  const sw = h('button', { class: 'switch' + (S.auto ? ' on' : ''), role: 'switch', 'aria-checked': S.auto ? 'true' : 'false', 'aria-label': 'Auto-play', onclick: e => { S.auto = !S.auto; save(); e.currentTarget.classList.toggle('on', S.auto); e.currentTarget.setAttribute('aria-checked', S.auto ? 'true' : 'false'); } }, h('i'));
  return h('div', { class: 'setrow' }, h('div', null, h('b', null, 'Auto-play'), h('small', null, 'Listen keeps reading one line after another')), sw);
}
function burst(x, y) {
  const e = h('span', { class: 'burst', html: HEART.replace('width="26" height="26"', 'width="64" height="64"').replace('fill="none"', 'fill="currentColor"'), style: 'left:' + (x - 32) + 'px;top:' + (y - 32) + 'px' });
  document.body.append(e); setTimeout(() => e.remove(), 900);
}
function coach() {
  if (S.coach) return;
  setTimeout(() => {
    if (S.coach || document.querySelector('.sheet-bg')) return;
    const row = (g, t) => h('div', { class: 'coachrow' }, h('span', { class: 'glyph' }, g), h('span', null, t));
    const bg = h('div', { class: 'sheet-bg', style: 'align-items:center;padding:20px' }, h('div', { class: 'sheet', style: 'border-radius:28px;max-width:420px;animation:rise .35s both' },
      h('h2', null, 'Three gestures'), h('p', { style: 'color:var(--mut);margin:0 0 10px' }, 'That is all you need.'),
      row('↑', 'Swipe up for the next line'), row('↔', 'Swipe sideways to change mood'), row('♡', 'Double-tap to save a line'),
      h('button', { class: 'next', style: 'width:100%;flex:none;margin-top:18px', onclick: () => { S.coach = 1; save(); bg.remove(); } }, 'Got it')));
    document.body.append(bg);
  }, 900);
}
function pickFeel(f) {
  if (navigator.vibrate) try { navigator.vibrate(10); } catch (e) {}
  S.feel = S.feel === f ? null : f; S.feelAt = Date.now(); save(); stopAudio(); render();
}
function feelRow() {
  const w = h('div', { class: 'feelrow', role: 'group', 'aria-label': 'How do you feel?' }, h('span', { class: 'feelq' }, 'I feel'));
  Object.keys(FEELS).forEach(f => w.append(h('button', { class: 'fchip' + (S.feel === f ? ' on' : ''), style: '--c:' + FEELS[f].c, onclick: () => pickFeel(f) }, h('i'), f)));
  return w;
}
function checkin() {
  if (!S.coach || document.querySelector('.sheet-bg')) return;
  if (S.feelAt && Date.now() - S.feelAt < 6 * 3600e3) return;
  setTimeout(() => {
    if (document.querySelector('.sheet-bg')) return;
    const bg = sheet([h('h2', { class: 'big' }, 'How are you feeling?'), h('p', { style: 'color:var(--mut);margin:0 0 6px' }, 'Tap one. Your lines will match it.'),
      h('div', { class: 'fgrid' }, Object.keys(FEELS).map(f => h('button', { class: 'fcard', style: '--c:' + FEELS[f].c, onclick: () => { bg.remove(); pickFeel(f); } }, h('i'), h('b', null, f), h('small', null, FEELS[f].t)))),
      h('button', { class: 'link', style: 'padding:14px 0 4px', onclick: () => { S.feelAt = Date.now(); save(); bg.remove(); } }, 'Skip for now')]);
  }, 700);
}
function render() {
  applyTheme(); stopAudio();
  const app = $('#app'); app.innerHTML = '';
  const q = h('div', { class: 'quote', id: 'q', 'aria-live': 'polite' }), by = h('div', { class: 'by', id: 'by' });
  const heart = h('button', { class: 'icon heart', 'aria-label': 'Save this line', html: HEART, onclick: toggleFav });
  const pill = h('button', { class: 'mood', 'aria-label': 'Change mood', onclick: moodSheet }, h('i', { class: 'dot', style: 'background:' + (S.feel && FEELS[S.feel] ? FEELS[S.feel].c : MOOD_DOT[S.mode]) }), h('span', null, S.feel && FEELS[S.feel] ? 'Feeling ' + S.feel.toLowerCase() : S.mode), h('span', { html: CARET }));
  const eyebrow = h('div', { class: 'eyebrow', id: 'eyebrow' }, h('i', { style: 'background:' + (S.feel && FEELS[S.feel] ? FEELS[S.feel].c : MOOD_DOT[S.mode]) }), h('span', null, S.feel && FEELS[S.feel] ? FEELS[S.feel].t : MOOD_INFO[S.mode][0]));
  const stage = h('div', { class: 'stage' }, eyebrow, q, by);
  let sx = 0, sy = 0, mv = false, lastTap = 0;
  stage.addEventListener('touchstart', e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; mv = false; }, { passive: true });
  stage.addEventListener('touchmove', e => {
    const dx = e.touches[0].clientX - sx, dy = e.touches[0].clientY - sy;
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) { mv = true; q.classList.add('drag'); q.style.transform = 'translateY(' + dy * .35 + 'px)'; q.style.opacity = Math.max(.25, 1 - Math.abs(dy) / 380); }
  }, { passive: true });
  stage.addEventListener('touchend', e => {
    const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
    q.classList.remove('drag'); q.style.transform = ''; q.style.opacity = '';
    if (Math.abs(dy) > 70 && Math.abs(dy) > Math.abs(dx)) { change(); return; }
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy)) { const i = MODES.indexOf(S.mode) + (dx < 0 ? 1 : -1); if (i >= 0 && i < MODES.length) { S.mode = MODES[i]; S.feel = null; save(); if (navigator.vibrate) try { navigator.vibrate(8); } catch (er) {} render(); } return; }
    if (!mv && Math.abs(dx) < 10 && Math.abs(dy) < 10) { const n = Date.now(); if (n - lastTap < 320) { lastTap = 0; if (cur && !isFav(cur)) toggleFav(); burst(t.clientX, t.clientY); } else lastTap = n; }
  });
  app.append(
    h('div', { class: 'top' }, h('div', { class: 'brand' }, 'Lightly'), h('div', { style: 'display:flex' }, h('button', { class: 'icon', 'aria-label': 'Settings', html: SLIDERS, onclick: voiceSheet }), h('button', { class: 'icon', 'aria-label': 'Saved lines', html: LIST, onclick: showFavs }))),
    h('div', { class: 'moodrow' }, pill, h('span', { class: 'count', id: 'count' })),
    feelRow(),
    stage,
    h('div', { class: 'dock' },
      h('button', { class: 'help', onclick: openSituations }, 'Something’s bothering me'),
      h('div', { class: 'bar glass' }, heart, h('button', { class: 'icon', 'aria-label': 'Share as an image', html: SHARE, onclick: shareCard }),
        h('button', { class: 'listen', id: 'listen', 'aria-label': 'Listen to this line', onclick: toggleListen, html: PLAY + '<span>Listen</span>' }),
        h('button', { class: 'next', onclick: change, html: '<span>Next</span>' + ARROW }))));
  show(nextLine(S.mode), false);
  coach(); checkin();
}
function show(line, animate = true) {
  const q = $('#q'), by = $('#by'); cur = line; const cn = $('#count'); if (cn && S.pos) cn.textContent = S.pos + ' / ' + (S.posN || LINES[S.mode].length);
  const set = () => {
    q.innerHTML = '';
    const two = !!line[2];
    const words = (t, el, base) => t.split(' ').forEach((w, i) => { el.append(h('span', { class: 'w', style: 'animation-delay:' + (base + i * 70) + 'ms' }, w), ' '); });
    const n = line[0].split(' ').length;
    if (two) { const pu = h('div', { class: 'punch' }), ins = h('div', { class: 'insight', style: 'animation-delay:' + (150 + n * 70 + 500) + 'ms' }, line[2]); words(line[0], pu, 150); q.append(h('div', { class: 'bar-accent' }), pu, ins); }
    else words(line[0], q, 100);
    by.textContent = line[1] ? (two ? line[1] : '\u2014 ' + line[1]) : '';
    q.className = 'quote in' + (two ? ' two' : ''); requestAnimationFrame(() => requestAnimationFrame(() => q.className = 'quote' + (two ? ' two' : ''))); syncHeart();
  };
  if (!animate) { set(); return; }
  q.className = 'quote out'; setTimeout(set, 380);
}
function change() { const was = TTS.session; stopAudio(true); const l = nextLine(S.mode); show(l); if (was) { TTS.session = true; sessionStep(l); } }
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
  S.fav.forEach(f => body.push(h('div', { class: 'item' }, h('span', null, f[0] + (f[2] ? ' ' + f[2] : '') + (f[1] ? (f[1].charAt(0) === '\u2014' ? ' ' + f[1] : (f[2] ? '' : ' \u2014 ' + f[1])) : '')), h('button', { onclick: e => { S.fav = S.fav.filter(x => x[0] !== f[0]); save(); e.target.closest('.item').remove(); syncHeart(); } }, 'Remove'))));
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

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
  let had = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (had) location.reload(); had = true; });
}
render();

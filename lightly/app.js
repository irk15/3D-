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
let S = { fav: [], mode: 'Osho', bag: {}, rate: .82, pitch: .9, voiceName: null };
try { const d = JSON.parse(localStorage.getItem(KEY)); if (d) S = Object.assign(S, d); else { const o = JSON.parse(localStorage.getItem('lightly_v1')); if (o && o.fav) S.fav = o.fav; } } catch (e) {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
const rand = n => Math.floor(Math.random() * n);

/* shuffle bag so lines do not repeat until all have been seen */
function nextLine(mode) {
  const all = LINES[mode]; let bag = (S.bag[mode] || []).filter(i => i < all.length);
  if (!bag.length) { bag = all.map((_, i) => i); for (let i = bag.length - 1; i > 0; i--) { const j = rand(i + 1);[bag[i], bag[j]] = [bag[j], bag[i]]; } if (S.last && bag[bag.length - 1] === S.lastIdx && bag.length > 1) bag.unshift(bag.pop()); }
  const i = bag.pop(); S.bag[mode] = bag; S.lastIdx = i; S.last = mode; S.pos = all.length - bag.length; save(); return all[i];
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
  const who = line[1] && line[1].charAt(0) === '\u2014' ? line[1].slice(2).replace(/\s*\(paraphrased\)/, '') : null;
  const parts = [line[0], who, line[2]].filter(Boolean);
  const run = i => { if (tk !== TTS.token) return; if (i >= parts.length) { TTS.speaking = false; syncAudio(); if (done) done(); return; } utter(parts[i], () => setTimeout(() => run(i + 1), i === 0 ? 650 : 0), tk); };
  run(0);
}
function stopAudio(keepSession) {
  if (!canSpeak) return; TTS.token++; speechSynthesis.cancel(); TTS.speaking = false;
  if (!keepSession || !TTS.session) { TTS.session = false; releaseLock(); }
  syncAudio();
}
function syncAudio() {
  const b = $('#listen'); if (b) { const act = TTS.speaking || TTS.session; b.classList.toggle('on', act); b.innerHTML = (act ? '<span class="eq"><i></i><i></i><i></i></span>' : PLAY) + '<span>' + (act ? 'Stop' : 'Listen') + '</span>'; }
  const s = $('#sess'); if (s) s.textContent = TTS.session ? 'Stop session' : 'Play session';
}
function toggleListen() { if (TTS.speaking || TTS.session) stopAudio(); else if (S.auto) toggleSession(); else { TTS.session = false; speakLine(cur); } }
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
  const bg = sheet([h('h2', null, 'Settings'), installBlock(), autoRow(), h('h3', { style: 'font:600 15px var(--sans);margin:4px 0 6px' }, 'Voice'), h('p', { style: 'color:var(--mut);margin:0 0 14px' }, 'Uses your phone’s built-in voices, so it works offline. Tap one to hear it.'),
    h('div', { class: 'chips2' }, mk('Slow', 'rate', .72), mk('Calm', 'rate', .82), mk('Natural', 'rate', .95)),
    h('div', { class: 'chips2' }, mk('Deeper', 'pitch', .8), mk('Low', 'pitch', .9), mk('Natural', 'pitch', 1)), list]);
  const obs = new MutationObserver(() => { if (!document.body.contains(bg)) { stopAudio(); obs.disconnect(); } }); obs.observe(document.body, { childList: true });
}
document.addEventListener('visibilitychange', () => { if (document.hidden && TTS.session) { /* phones pause speech when the screen locks */ } else if (!document.hidden && TTS.session) takeLock(); });


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
    MODES.map(m => h('button', { class: 'moodcard' + (S.mode === m ? ' on' : ''), onclick: () => { S.mode = m; save(); bg.remove(); render(); } },
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
function render() {
  applyTheme(); stopAudio();
  const app = $('#app'); app.innerHTML = '';
  const q = h('div', { class: 'quote', id: 'q', 'aria-live': 'polite' }), by = h('div', { class: 'by', id: 'by' });
  const heart = h('button', { class: 'icon heart', 'aria-label': 'Save this line', html: HEART, onclick: toggleFav });
  const pill = h('button', { class: 'mood', 'aria-label': 'Change mood', onclick: moodSheet }, h('i', { class: 'dot', style: 'background:' + MOOD_DOT[S.mode] }), h('span', null, S.mode), h('span', { html: CARET }));
  const stage = h('div', { class: 'stage' }, q, by);
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
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy)) { const i = MODES.indexOf(S.mode) + (dx < 0 ? 1 : -1); if (i >= 0 && i < MODES.length) { S.mode = MODES[i]; save(); if (navigator.vibrate) try { navigator.vibrate(8); } catch (er) {} render(); } return; }
    if (!mv && Math.abs(dx) < 10 && Math.abs(dy) < 10) { const n = Date.now(); if (n - lastTap < 320) { lastTap = 0; if (cur && !isFav(cur)) toggleFav(); burst(t.clientX, t.clientY); } else lastTap = n; }
  });
  app.append(
    h('div', { class: 'top' }, h('div', { class: 'brand' }, 'Lightly'), h('div', { style: 'display:flex' }, h('button', { class: 'icon', 'aria-label': 'Settings', html: SLIDERS, onclick: voiceSheet }), h('button', { class: 'icon', 'aria-label': 'Saved lines', html: LIST, onclick: showFavs }))),
    h('div', { class: 'moodrow' }, pill, h('span', { class: 'count', id: 'count' })),
    stage,
    h('div', { class: 'dock' },
      h('button', { class: 'help', onclick: openSituations }, 'Something’s bothering me'),
      h('div', { class: 'bar glass' }, heart, h('button', { class: 'icon', 'aria-label': 'Share as an image', html: SHARE, onclick: shareCard }),
        canSpeak ? h('button', { class: 'listen', id: 'listen', 'aria-label': 'Listen to this line', onclick: toggleListen, html: PLAY + '<span>Listen</span>' }) : null,
        h('button', { class: 'next', onclick: change, html: '<span>Next</span>' + ARROW }))));
  show(nextLine(S.mode), false);
  coach();
}
function show(line, animate = true) {
  const q = $('#q'), by = $('#by'); cur = line; const cn = $('#count'); if (cn && S.pos) cn.textContent = S.pos + ' / ' + LINES[S.mode].length;
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

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
render();

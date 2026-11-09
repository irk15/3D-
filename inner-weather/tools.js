'use strict';
/* Inner Weather: guided tools. Each tool is a list of steps run by the flow engine in app.js.
   Step types: say, breath, input, choose, timer, burn, custom. */

const TOOLS = {
  sigh: { n: 'Calming sigh', d: 'The quickest way to settle your body', min: 1, steps: [
    { t: 'breath', p: 'sigh', r: 5, tip: 'In through the nose, a second small sip of air, then a long slow breath out.' }] },
  slow: { n: 'Slow breathing', d: 'In for 4, out for 6', min: 2, steps: [
    { t: 'breath', p: 'slow', r: 12, tip: 'A longer out-breath tells your body it is safe.' }] },
  ground: { n: 'Ground', d: 'Come back to the room you are in', min: 1, steps: [
    { t: 'say', big: '5', title: 'Name five things you can see', cta: 'Done' },
    { t: 'say', big: '3', title: 'Three sounds you can hear', cta: 'Done' },
    { t: 'say', big: '1', title: 'Feel your feet on the floor. You are here.', cta: 'Done' }] },
  cool: { n: 'Cool down', d: 'For waves too strong to think through', min: 3, steps: [
    { t: 'timer', sec: 30, title: 'Cold', body: 'Cold water on your face, or something cold on your cheeks. It slows your heart. Skip if you have a heart condition.' },
    { t: 'timer', sec: 60, title: 'Move hard', body: 'Stairs, fast walking, jumping jacks. Burn it off.' },
    { t: 'breath', p: 'slow', r: 5, tip: 'Now slow it all down.' }] },
  thought: { n: 'Thought check', d: 'Untangle a thought that keeps hurting', min: 2, save: c => { if (c.bal) { S.thoughts.unshift({ t: Date.now(), from: c.thought || '', to: c.bal }); S.thoughts = S.thoughts.slice(0, 60); } }, steps: [
    { t: 'input', key: 'thought', title: 'What’s the thought?', ph: 'e.g. I always mess everything up' },
    { t: 'input', key: 'bal', title: 'What would you tell a friend who thought that?', body: 'Say it to yourself instead. Fair, not fake-positive.', ph: 'e.g. One mistake doesn’t make you a failure' }] },
  park: { n: 'Worry park', d: 'Park a worry now, look at it later', min: 1, custom: () => openPark() },
  lift: { n: 'Tiny lift', d: 'One small action to shift a low mood', min: 2, steps: [
    { t: 'choose', key: 'act', title: 'Pick one tiny thing', body: 'Action first. Mood often follows.', opts: () => LIFT.low.a.slice(0, 6) },
    { t: 'timer', sec: 120, title: c => c.act, body: 'Just this, for two minutes.' }] },
  kind: { n: 'Kindness break', d: 'Speak to yourself like a friend', min: 1, steps: [
    { t: 'say', serif: true, title: 'This is hard. Other people feel this too. May I be kind to myself right now.', body: 'Hand on your chest. Read it slowly, twice.', cta: 'Done' }] },
  name: { n: 'Name it', d: 'Find the exact word for what you feel', min: 1, steps: [
    { t: 'choose', key: 'word', grid: true, title: 'Which word fits best?', body: 'Naming a feeling precisely turns its volume down.', opts: () => ['anxious', 'overwhelmed', 'lonely', 'hurt', 'sad', 'angry', 'frustrated', 'guilty', 'rejected', 'numb', 'drained', 'confused'] },
    { t: 'say', serif: true, title: c => 'I am feeling ' + (c.word || 'this') + ', and that makes sense.', body: 'Say it once, out loud or in your head.', cta: 'Done' }] },
  wave: { n: 'Ride the urge', d: 'Don’t text them. Let the wave pass.', min: 10, steps: [
    { t: 'timer', sec: 600, title: 'Ride the wave', body: 'Urges rise and fall within minutes. Don’t act. Just watch it.', msgs: ['Notice where you feel it in your body.', 'Breathe out longer than you breathe in.', 'It is peaking. Peaks pass.', 'You haven’t acted. That is strength.', 'Will tomorrow-you be glad you waited?', 'It is getting smaller.'] }] },
  letter: { n: 'Unsent letter', d: 'Say everything. Then let it burn.', min: 3, noRate: true, steps: [
    { t: 'input', key: 'letter', rows: 9, title: 'Say it all', body: 'They will never see it. It is never saved.', ph: 'Dear...' },
    { t: 'burn', key: 'letter' }] },
  heart: { n: 'Heartbreak kit', d: 'Healing days, reminders and urges', min: 1, custom: () => openHeart() },
  good: { n: 'Three good things', d: 'Notice what went right today', min: 1, noRate: true, save: c => { (c.g || []).forEach(t => S.good.unshift({ t, at: Date.now() })); S.good = S.good.slice(0, 120); }, steps: [
    { t: 'custom', render: (c, next) => { const f = [0, 1, 2].map(i => h('input', { class: 'field one', style: 'margin-top:8px', maxlength: 140, placeholder: ['A good moment', 'Something you enjoyed', 'Something you did well'][i] }));
      return { body: [h('h2', { class: 'ftitle' }, 'Three good things today'), h('p', { class: 'fsub' }, 'Small counts.'), f], foot: [btn('Save', () => { c.g = f.map(x => x.value.trim()).filter(Boolean); next(); })] }; } }] },
  sunnote: { n: 'Note for a rainy day', d: 'Sunny you writes to stormy you', min: 1, noRate: true, save: c => { if (c.note) { S.sun.unshift({ t: c.note, at: Date.now() }); S.sun = S.sun.slice(0, 50); } }, steps: [
    { t: 'input', key: 'note', rows: 5, title: 'Write to yourself on a hard day', body: 'It will appear on your rainy days.', ph: 'It always passes. Remember...' }] },
  reach: { n: 'Reach out', d: 'Ready-made messages to send someone', min: 1, custom: () => openReach() },
  sleep: { n: 'Wind down', d: 'Pick a sound, then sleep', min: 1, noRate: true, steps: [
    { t: 'custom', render: (c, next) => sleepStep(next) }] }
};

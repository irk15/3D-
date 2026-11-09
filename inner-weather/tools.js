'use strict';
/* Inner Weather: guided tools. Each tool is a list of steps run by the flow engine in app.js.
   Step types: say, breath, input, choose, timer, burn, custom. */

const TOOLS = {
  sigh: { n: 'Calming sigh', d: 'The quickest way to settle your body', min: 1, steps: [
    { t: 'say', title: 'Calm the body first', body: 'Breathe in through your nose, then take a small second sip of air on top. Then let it all out slowly through your mouth. Slow breathing with a long out-breath is one of the fastest ways to calm down.' },
    { t: 'breath', p: 'sigh', r: 5 }] },
  slow: { n: 'Slow breathing', d: 'In for 4, out for 6', min: 2, steps: [
    { t: 'say', title: 'Slow it down', body: 'Breathe in for four counts, out for six. A longer out-breath tells your nervous system it is safe.' },
    { t: 'breath', p: 'slow', r: 12 }] },
  ground: { n: '5-4-3-2-1', d: 'Come back to the room you are in', min: 2, steps: [
    { t: 'say', big: '5', title: 'Five things you can see', body: 'Look around slowly. Name each one in your head.', cta: 'Done' },
    { t: 'say', big: '4', title: 'Four things you can feel', body: 'Your feet on the floor, the chair, your clothes, the air.', cta: 'Done' },
    { t: 'say', big: '3', title: 'Three things you can hear', body: 'Near and far. Even quiet sounds count.', cta: 'Done' },
    { t: 'say', big: '2', title: 'Two things you can smell', body: 'Or two smells you like, if nothing is around.', cta: 'Done' },
    { t: 'say', big: '1', title: 'One thing you can taste', body: 'Or take one slow sip of water.', cta: 'Done' }] },
  cool: { n: 'Cool down', d: 'For waves too strong to think through', min: 5, steps: [
    { t: 'say', title: 'Change your body first', body: 'When emotion is this strong, thinking will not help yet. These steps work on your body’s chemistry instead. They come from DBT, a therapy built for intense emotions.' },
    { t: 'timer', sec: 30, title: 'Cold', body: 'Splash cold water on your face, or hold something cold to your cheeks and eyes. Cold can slow your heart rate. Skip this step if you have a heart condition.' },
    { t: 'timer', sec: 60, title: 'Move hard', body: 'Fast walking, stairs, jumping jacks, anything that burns energy for one minute.' },
    { t: 'breath', p: 'slow', r: 5 },
    { t: 'say', title: 'Squeeze and release', body: 'Breathe in and tense your fists, shoulders and face for five seconds. Breathe out and let everything go. Do it two more times.', cta: 'Done' }] },
  thought: { n: 'Thought check', d: 'Untangle a thought that keeps hurting', min: 4, save: c => { if (c.bal) { S.thoughts.unshift({ t: Date.now(), from: c.thought || '', to: c.bal }); S.thoughts = S.thoughts.slice(0, 60); } }, steps: [
    { t: 'input', key: 'thought', title: 'What is the thought?', body: 'Write it exactly as it sounds in your head.', ph: 'e.g. I always mess everything up' },
    { t: 'choose', key: 'traps', multi: true, title: 'Does it fall into any thinking traps?', body: 'Pick any that fit. Minds do this to everyone.', opts: () => TRAPS },
    { t: 'input', key: 'for', title: 'What supports it?', body: 'Facts only, not feelings.', ph: 'The facts that back it up' },
    { t: 'input', key: 'against', title: 'What doesn’t fit it?', body: 'Times it was not true, things it ignores.', ph: 'What the thought leaves out' },
    { t: 'input', key: 'friend', title: 'What would you tell a friend?', body: 'Imagine someone you love said this about themselves.', ph: 'What I would say to them' },
    { t: 'input', key: 'bal', title: 'Write a fairer version', body: c => 'Not fake-positive, just more accurate than: “' + (c.thought || 'the old thought') + '”', ph: 'e.g. I made a mistake today, and I fix most of my mistakes' },
    { t: 'say', title: c => c.bal ? '“' + c.bal + '”' : 'Good work.', body: 'Read it again slowly. Next time the old thought shows up, answer it with this one.', serif: true }] },
  park: { n: 'Worry park', d: 'Park a worry now, look at it later', min: 1, custom: () => openPark() },
  lift: { n: 'Tiny lift', d: 'One small action to shift a low mood', min: 2, steps: [
    { t: 'say', title: 'Action first, mood follows', body: 'When you are low, waiting to feel like it rarely works. Doing one small thing often lifts mood more than thinking about it. Therapists call this behavioural activation.' },
    { t: 'choose', key: 'e', title: 'How much energy do you have?', opts: () => Object.keys(LIFT).map(k => [LIFT[k].n, k === 'low' ? '2 minutes' : k === 'mid' ? '10 minutes' : '30 minutes', k]) },
    { t: 'choose', key: 'act', title: 'Pick one', body: 'Choose the one that feels least hard.', opts: c => LIFT[c.e || 'low'].a },
    { t: 'timer', sec: c => LIFT[c.e || 'low'].sec, title: c => c.act, body: 'Just this. Leave the screen open, or come back when you are done.' }] },
  kind: { n: 'Kindness break', d: 'Speak to yourself like a friend', min: 3, steps: [
    { t: 'say', title: 'This hurts.', body: 'Say it quietly to yourself: “This is a hard moment. This hurts.” Naming it is the first step.', serif: true },
    { t: 'say', title: 'You are not alone in this.', body: 'Say: “Other people feel this too. Struggling is part of being human, not a sign something is wrong with me.”', serif: true },
    { t: 'say', title: 'Hand on your heart.', body: 'Put a hand on your chest and feel its warmth. Say: “May I be kind to myself right now.”', serif: true },
    { t: 'input', key: 'need', title: 'What do you need to hear?', body: 'What would you say to a close friend in your place?', ph: 'Write it to yourself' },
    { t: 'say', title: c => c.need ? '“' + c.need + '”' : 'You deserve the kindness you give others.', body: 'Read it slowly. It is for you.', serif: true }] },
  name: { n: 'Name it', d: 'Find the exact word for what you feel', min: 2, steps: [
    { t: 'choose', key: 'fam', title: 'Which family is it closest to?', opts: () => Object.keys(EMOTIONS) },
    { t: 'choose', key: 'word', title: 'Which word fits best?', opts: c => EMOTIONS[c.fam || 'Mixed'] },
    { t: 'input', key: 'why', title: c => 'I am feeling ' + (c.word || 'this') + ',', body: 'and that makes sense because...', ph: 'Finish the sentence' },
    { t: 'say', title: c => 'I am feeling ' + (c.word || 'this') + (c.why ? ', and that makes sense because ' + c.why.replace(/[.\s]+$/, '') : '') + '.', body: 'Putting a precise name on a feeling tends to turn its volume down. It is called affect labelling.', serif: true }] },
  wave: { n: 'Ride the urge', d: 'Don’t text them. Let the wave pass.', min: 10, steps: [
    { t: 'choose', key: 'urge', title: 'What is the urge?', opts: ['Text or call my ex', 'Check their profile', 'Send an angry message', 'Something else'] },
    { t: 'say', title: 'Urges are waves', body: 'They rise, peak and fall, usually within 10 to 20 minutes. You do not have to fight it or act on it. Just watch it pass, like surfing a wave.' },
    { t: 'timer', sec: 600, title: 'Ride it out', body: 'Keep the phone here. Watch the urge.', msgs: ['Notice where you feel it in your body.', 'Breathe out longer than you breathe in.', 'It is peaking. Peaks pass.', 'You are still here, and you have not acted. That is strength.', 'Picture tomorrow morning. Will you be glad you waited?', 'Write what you wanted to say in an unsent letter instead.', 'It is getting smaller, even if only a little.'] },
    { t: 'choose', key: 'after', title: 'Where is the urge now?', opts: ['Lower', 'About the same', 'Stronger'] },
    { t: 'say', title: c => c.after === 'Lower' ? 'You rode it out.' : 'That is okay. Some waves are long.', body: c => c.after === 'Lower' ? 'Every time you let a wave pass, the next one gets a little weaker.' : 'Try writing an unsent letter, or move your body for a few minutes, then check again.' }] },
  letter: { n: 'Unsent letter', d: 'Say everything. Then let it burn.', min: 5, steps: [
    { t: 'input', key: 'letter', rows: 9, title: 'Say it all', body: 'Write everything you want to say to them. They will never see it, and it is never saved.', ph: 'Dear...' },
    { t: 'burn', key: 'letter' },
    { t: 'say', title: 'It is out of you now.', body: 'You said it. It does not need to be sent to be real.', serif: true }] },
  heart: { n: 'Heartbreak kit', d: 'Healing days, reminders and urges', min: 1, custom: () => openHeart() },
  good: { n: 'Three good things', d: 'Train your mind to notice what went right', min: 2, save: c => { const g = [c.g1, c.g2, c.g3].filter(Boolean); g.forEach(t => S.good.unshift({ t, at: Date.now() })); S.good = S.good.slice(0, 120); }, steps: [
    { t: 'input', key: 'g1', title: 'One good thing from today', body: 'Small counts. A good coffee counts.', ph: 'Something that went well' },
    { t: 'input', key: 'g2', title: 'Another one', ph: 'Something you enjoyed', skip: true },
    { t: 'input', key: 'g3', title: 'And one more', ph: 'Something you did well', skip: true },
    { t: 'say', title: 'Saved to your journal.', body: 'Doing this most evenings for a week has been linked with feeling happier for months.' }] },
  sunnote: { n: 'Note for a rainy day', d: 'Sunny you writes to stormy you', min: 2, noRate: true, save: c => { if (c.note) { S.sun.unshift({ t: c.note, at: Date.now() }); S.sun = S.sun.slice(0, 50); } }, steps: [
    { t: 'input', key: 'note', rows: 6, title: 'Write to yourself on a hard day', body: 'Today you know things that rainy-day you will forget. What should they remember?', ph: 'It always passes. Remember the walk by the lake...' },
    { t: 'say', title: 'Saved for a rainy day.', body: 'When you check in as rainy or stormy, Inner Weather will show you this note.' }] },
  reach: { n: 'Reach out', d: 'Ready-made messages to send someone', min: 1, custom: () => openReach() },
  sleep: { n: 'Wind down', d: 'Empty your head, then sleep', min: 5, noRate: true, steps: [
    { t: 'input', key: 'dump', rows: 6, title: 'Empty your head', body: 'Write what is still on your mind. It goes into your Worry park for tomorrow.', ph: 'Everything that is still buzzing', skip: true, after: c => { if (c.dump && c.dump.trim()) S.worries.unshift({ t: c.dump.trim().slice(0, 300), at: Date.now(), r: null }); } },
    { t: 'say', title: 'Soften your body', body: 'Lie down. Relax your forehead, then your jaw, then your shoulders, hands, belly and legs. Let each one get heavy.', cta: 'Done' },
    { t: 'custom', render: (c, next) => sleepStep(next) }] }
};

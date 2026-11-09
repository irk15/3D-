'use strict';
/* Inner Weather: content. Everything here is original wording, based on well-studied
   self-help skills (CBT, DBT, behavioural activation, self-compassion, urge surfing). */

const WEATHER = {
  storm: { n: 'Stormy', d: 'Overwhelmed, panicky, furious', s: 1, dark: true, bg: ['#15121E', '#3A2B52'], ac: '#C6ADFF' },
  rain: { n: 'Rainy', d: 'Sad, heavy, tearful', s: 2, dark: true, bg: ['#101B29', '#2B4560'], ac: '#96C9FF' },
  fog: { n: 'Foggy', d: 'Numb, blank, scattered', s: 2, dark: true, bg: ['#1F2229', '#4A4F5B'], ac: '#D6DCEA' },
  cloud: { n: 'Cloudy', d: 'Off, restless, worried', s: 3, dark: true, bg: ['#22344A', '#5B7490'], ac: '#E6EFF8' },
  clear: { n: 'Clear', d: 'Calm, okay, steady', s: 4, dark: false, bg: ['#E5EEF6', '#F6EDE0'], ac: '#3C6C93' },
  sun: { n: 'Sunny', d: 'Light, good, hopeful', s: 5, dark: false, bg: ['#FFF3DD', '#FFD3A0'], ac: '#C4601A' }
};
const ORDER = ['storm', 'rain', 'fog', 'cloud', 'clear', 'sun'];
const NIGHT = { dark: true, bg: ['#0F1426', '#2A2D55'], ac: '#F3C690' };

const CLOUD_HI = 'M7.5 14h9.5a3.6 3.6 0 0 0 .4-7.18A5.4 5.4 0 0 0 6.9 7.6 3.2 3.2 0 0 0 7.5 14z';
const ICON = {
  sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/>',
  clear: '<path d="M5 15.5a7 7 0 0 1 14 0"/><path d="M3 18.5h18M7 21h10"/><path d="M12 4.5v2M5.2 7.6l1.3 1.3M18.8 7.6l-1.3 1.3"/>',
  cloud: '<path d="M7 19h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.1 12 3.5 3.5 0 0 0 7 19z"/>',
  fog: '<path d="M4 8.5c2-1.3 4-1.3 6 0s4 1.3 6 0 3-.9 4-.6M4 13c2-1.3 4-1.3 6 0s4 1.3 6 0 3-.9 4-.6M4 17.5c2-1.3 4-1.3 6 0s4 1.3 6 0 3-.9 4-.6"/>',
  rain: '<path d="' + CLOUD_HI + '"/><path d="M9 17l-1 3M13 17l-1 3M17 17l-1 3"/>',
  storm: '<path d="' + CLOUD_HI + '"/><path d="M12.5 15.5l-2.2 3.4h3l-2.2 3.6"/>'
};
const svgI = (k, s) => '<svg width="' + (s || 28) + '" height="' + (s || 28) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON[k] + '</svg>';

const TAGS = ['Work', 'Love', 'Breakup', 'Family', 'Friends', 'Money', 'Body', 'Lonely', 'Sleep', 'Future', 'No idea'];

const PLAN = {
  storm: ['cool', 'sigh', 'ground'],
  rain: ['kind', 'lift', 'reach'],
  fog: ['name', 'ground', 'lift'],
  cloud: ['thought', 'park', 'slow'],
  clear: ['good', 'sunnote', 'slow'],
  sun: ['sunnote', 'good', 'reach']
};
const TAG_TOOL = { Breakup: w => (WEATHER[w].s <= 2 ? 'wave' : 'heart'), Sleep: () => 'sleep', Lonely: () => 'reach', Work: w => (WEATHER[w].s <= 3 ? 'park' : null), Money: w => (WEATHER[w].s <= 3 ? 'park' : null), Future: w => (WEATHER[w].s <= 3 ? 'thought' : null), Love: w => (WEATHER[w].s <= 2 ? 'kind' : null) };

const FORECAST = {
  storm: ['Storms are loud, and they are short. You only need to get through the next few minutes.', 'Your body is in alarm mode. Calm the body first; the thoughts will follow.', 'You do not have to fix anything in a storm. Just find shelter.', 'This wave will peak and pass. They always do.'],
  rain: ['Rain is not failure. It is weather, and it moves.', 'Heavy days ask for small steps, not big decisions.', 'Be as gentle with yourself as you would be with someone you love.', 'You do not have to feel better to do one kind thing for yourself.'],
  fog: ['Fog lifts with movement, not with thinking harder.', 'Feeling nothing is often your mind resting after too much. Go slowly.', 'Name what is here, even if it is "I don’t know".', 'Small, physical things cut through fog: water, air, light.'],
  cloud: ['Cloudy is normal. Not every day needs to be bright.', 'A worried mind is a busy mind. Give it one job at a time.', 'Thoughts are guesses, not facts. Check them.', 'Clouds move faster when you stop staring at them.'],
  clear: ['Clear days are for building. Plant something for rainy-day you.', 'Notice this. Calm is easier to find when you know its address.', 'Steady is a quiet kind of strength.', 'Good moment to write down what is working.'],
  sun: ['Soak it in. Savouring good moments makes them last longer.', 'Share some of this light. It grows when it is passed on.', 'Leave a note for the days that are harder. You will be glad you did.', 'You earned this. Let yourself enjoy it.']
};

const DAILY = [
  'Feelings are visitors. Let them come, let them go.',
  'You are the sky. Everything else is weather.',
  'Healing is not linear. A bad day is not a step back.',
  'You do not have to earn rest.',
  'The thought "I can’t" is a feeling, not a fact.',
  'Done gently is still done.',
  'Most of what you fear never arrives.',
  'Talk to yourself like someone you are responsible for helping.',
  'Small steps still move you.',
  'You have survived every hard day so far.',
  'It is okay to not be okay for a while.',
  'Some days the win is just getting through.',
  'Your worth is not your productivity.',
  'Rest, then return.',
  'You can start your day over at any minute.',
  'Not every thought deserves an answer.',
  'You are allowed to outgrow people and places.',
  'Breathe out longer than you breathe in. Your body listens.',
  'Asking for help is a strength.',
  'This moment is not your whole life.',
  'Be where your feet are.',
  'Kindness to yourself is not weakness. It is fuel.',
  'You are more than the worst thing you think about yourself.',
  'Comparison steals the joy of your own path.',
  'There is no deadline on feeling better.',
  'What you water grows. Water what helps you.',
  'You do not have to see the whole road. Just the next step.',
  'Even storms run out of rain.',
  'A calm mind is built, one small practice at a time.',
  'You are not too much. You are a lot, and that is fine.'
];

const HEART_NOTES = [
  'Missing them does not mean you should go back. It means it mattered.',
  'You are not starting over. You are starting from experience.',
  'Grief comes in waves. Today’s wave will pass too.',
  'Do not rewrite the past to make it prettier than it was.',
  'You can love someone and still know they were not right for you.',
  'The urge to check on them is strongest right before it fades.',
  'Every day you do not reach out, your brain rewires a little more.',
  'Closure is something you give yourself.',
  'You are allowed to grieve the future you had planned.',
  'Their silence is an answer. Your peace is yours.',
  'Fill one hour today with something that is only yours.',
  'You lost a relationship, not your worth.',
  'Some days will feel like day one. They are not.',
  'You are learning what you need. That is never wasted.',
  'Let the people who stayed take care of you a little.',
  'It is okay if you still love them. Love fades slower than hope.',
  'You will laugh fully again. It is closer than it feels.',
  'Being alone for a while is not the same as being lonely forever.',
  'Write down why it ended, and read it when you miss them.',
  'You are becoming someone who knows their worth.'
];

const EMOTIONS = {
  Sad: ['disappointed', 'lonely', 'grieving', 'hurt', 'hopeless', 'empty'],
  Scared: ['anxious', 'insecure', 'overwhelmed', 'panicky', 'worried', 'exposed'],
  Angry: ['frustrated', 'resentful', 'jealous', 'betrayed', 'irritated', 'bitter'],
  Ashamed: ['embarrassed', 'guilty', 'inadequate', 'rejected', 'foolish', 'small'],
  Tired: ['drained', 'numb', 'flat', 'burnt out', 'foggy', 'unmotivated'],
  Mixed: ['confused', 'restless', 'conflicted', 'tender', 'nostalgic', 'unsettled']
};

const LIFT = {
  low: { n: 'Very little', sec: 120, a: ['Open a window and breathe outside air', 'Drink a full glass of water', 'Play one song you love', 'Wash your face with cool water', 'Step outside your door for a moment', 'Send someone a single emoji', 'Make your bed', 'Eat something small'] },
  mid: { n: 'Some', sec: 600, a: ['Walk around the block', 'Take a shower', 'Clear one surface', 'Make tea and drink it away from screens', 'Stretch on the floor', 'Call someone', 'Cook something simple', 'Doodle or write anything'] },
  high: { n: 'Decent', sec: 1800, a: ['Take a longer walk outside', 'Tidy one room', 'Move your body properly', 'Cook a real meal', 'Meet someone', 'Do one task you have been avoiding', 'Go somewhere new nearby', 'Make something'] }
};

const TRAPS = [
  ['Worst case', 'Jumping to the worst outcome'], ['Mind reading', 'Assuming what others think'], ['Fortune telling', 'Predicting it will go badly'],
  ['All or nothing', 'Perfect or a total failure'], ['Shoulds', '"I should be..." pressure'], ['Labelling', '"I am a failure"'],
  ['Feelings as facts', '"I feel it, so it’s true"'], ['Discounting good', 'Ignoring what went right'], ['Personalising', 'Blaming yourself for everything']
];

const REACH = [
  'Hey, I’m having a rough day. Could you talk for a bit?',
  'Can I vent for five minutes? No advice needed, just listening.',
  'Thinking of you. Up for a walk or a coffee this week?',
  'I could use some company tonight. Are you free?',
  'Having a good day and thought of you. How are you?'
];

const SLEEP_SOUNDS = [['Rain', 'rain'], ['Ocean', 'ocean'], ['Night', 'night'], ['Forest', 'forest'], ['Fireplace', 'fireplace'], ['Soft hum', 'hum']];

/* tool categories for the Tools tab */
const CATS = [
  ['When it is intense', ['cool', 'sigh', 'ground', 'wave']],
  ['When it is heavy', ['kind', 'lift', 'reach', 'name']],
  ['When thoughts spin', ['thought', 'park', 'slow']],
  ['Heartbreak', ['heart', 'wave', 'letter']],
  ['Good days', ['good', 'sunnote']],
  ['Night', ['sleep', 'slow']]
];

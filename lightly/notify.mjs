// Sends one Lightly quote to your phone through ntfy (https://ntfy.sh).
// Run by .github/workflows/lightly-daily.yml. The topic is a secret named NTFY_TOPIC.
import { readFileSync } from 'node:fs';
const q = JSON.parse(readFileSync(new URL('./quotes.json', import.meta.url), 'utf8'));
const SLOTS = { '10 13 * * *': 0, '10 19 * * *': 1, '30 1 * * *': 2 };
const slot = process.env.SCHEDULE in SLOTS ? SLOTS[process.env.SCHEDULE] : parseInt(process.env.SLOT_INPUT || '0', 10) || 0;
const lists = [q.start || q.osho, q.brilliant, q.everyday], titles = ['Begin gently', 'Think clearly', 'Let it go lightly'];
const list = lists[slot] || q.osho, day = Math.floor(Date.now() / 864e5);
const item = list[(day + slot * 7) % list.length];
const body = item.text + (item.author && item.author !== 'Spiritual' ? '\n— ' + item.author : '') + (item.meaning ? '\n\n' + item.meaning : '');
if (process.env.DRY) { console.log(titles[slot] + '\n' + body); process.exit(0); }
const topic = process.env.NTFY_TOPIC;
if (!topic) { console.error('NTFY_TOPIC secret is missing'); process.exit(1); }
const res = await fetch('https://ntfy.sh/' + encodeURIComponent(topic), { method: 'POST', body, headers: { Title: titles[slot], Click: 'https://irk15.github.io/3D-/lightly/', Tags: 'sparkles', Priority: '3' } });
if (!res.ok) { console.error('ntfy responded', res.status); process.exit(1); }
console.log('sent', slot, item.text);

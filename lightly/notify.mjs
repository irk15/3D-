// Sends one Lightly message to your phone through ntfy (https://ntfy.sh), once per hour during waking hours.
// Run by .github/workflows/lightly-daily.yml every hour. The topic is a secret named NTFY_TOPIC.
// Quiet hours: nothing is sent outside NOTIFY_FROM..NOTIFY_TO (Toronto time, default 8 to 21).
import { readFileSync } from 'node:fs';
const q = JSON.parse(readFileSync(new URL('./quotes.json', import.meta.url), 'utf8'));
const TZ = process.env.NOTIFY_TZ || 'America/Toronto', FROM = +(process.env.NOTIFY_FROM || 8), TO = +(process.env.NOTIFY_TO || 21);
const BASE = 'https://irk15.github.io/3D-/lightly/';
const manual = !process.env.SCHEDULE;                       // workflow_dispatch or local run: always send
const localHour = d => (parseInt(new Intl.DateTimeFormat('en-CA', { timeZone: TZ, hour: 'numeric', hourCycle: 'h23' }).format(d), 10)) % 24;
const dayNo = d => { const [y, m, dd] = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d).split('-').map(Number); return Math.floor(Date.UTC(y, m - 1, dd) / 864e5); };
const gcd = (a, b) => b ? gcd(b, a % b) : a;
const stepFor = n => { let s = Math.max(1, Math.round(n * .618)); while (gcd(s, n) !== 1) s++; return s; };
const bucketOf = h => h < 11 ? 'morning' : h < 14 ? 'midday' : h < 17 ? 'afternoon' : h < 20 ? 'evening' : 'night';
const EXTRA = { morning: 'start', midday: 'brilliant', afternoon: 'osho', evening: 'everyday', night: 'everyday' };
function pick(now, hour) {
  const b = bucketOf(hour), H = q.hourly[b], first = { morning: 8, midday: 11, afternoon: 14, evening: 17, night: 20 }[b], k = Math.max(0, hour - first), day = dayNo(now);
  if (k % 2 === 0) { const own = H.items, n = day * 2 + (k >> 1); const it = own[(n * stepFor(own.length)) % own.length]; return { title: H.title, text: it.text, tail: 'Try: ' + it.do }; }
  const ex = q[EXTRA[b]], n = day * 3 + k, it = ex[(n * stepFor(ex.length)) % ex.length];
  return { title: H.title, text: it.text + (it.author && it.author !== 'Spiritual' ? '\n— ' + it.author : ''), tail: it.meaning || '' };
}
const now = process.env.FAKE_NOW ? new Date(process.env.FAKE_NOW) : new Date(), hour = process.env.FORCE_HOUR ? +process.env.FORCE_HOUR : localHour(now);
if (!manual && (hour < FROM || hour > TO)) { console.log('quiet hours (' + hour + ':00 in ' + TZ + '), nothing sent'); process.exit(0); }
const m = pick(now, hour), body = m.text + (m.tail ? '\n\n' + m.tail : '');
if (process.env.DRY) { console.log('[' + hour + ':00] ' + m.title + '\n' + body + '\n'); process.exit(0); }
const topic = process.env.NTFY_TOPIC;
if (!topic) { console.error('NTFY_TOPIC secret is missing'); process.exit(1); }
const res = await fetch('https://ntfy.sh/' + encodeURIComponent(topic), { method: 'POST', body, headers: { Title: m.title, Click: BASE + '?go=reset', Actions: 'view, Reset in 60s, ' + BASE + '?go=reset; view, SOS, ' + BASE + '?go=sos', Tags: 'sparkles', Priority: '3' } });
if (!res.ok) { console.error('ntfy responded', res.status); process.exit(1); }
console.log('sent', hour, m.text);

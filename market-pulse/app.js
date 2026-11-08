(() => {
'use strict';
/* Bharat Market Pulse. Reads a public Google Sheet, shows it in English or Hindi, reads it aloud. */
const SHEET_ID = '1cc_zmf_p3mglIllH_WwkfY4TxylMsrUbhyolLoiA19M';
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/edit';
const TABS = ['Meta', 'Pulse', 'Brief', 'Impacts', 'Outlook', 'Calendar'];
const LS = { lang: 'mp-lang', cache: 'mp-cache-1', rate: 'mp-rate', theme: 'mp-theme', watch: 'mp-watch' };
const params = new URLSearchParams(location.search);
const S = { enter: true, open: new Set(), watch: [], theme: 'auto', intro: true, lang: 'en', tab: 'today', data: null, source: 'live', refreshing: false, loading: false, error: '', fCat: 'All', fDir: 'All', q: '' };
try { const th = localStorage.getItem(LS.theme); if (['auto', 'light', 'dark'].includes(th)) S.theme = th; const w = JSON.parse(localStorage.getItem(LS.watch) || '[]'); if (Array.isArray(w)) S.watch = w.filter(x => typeof x === 'string'); } catch (e) {}
try { const l = localStorage.getItem(LS.lang); if (l === 'hi' || l === 'en') S.lang = l; else if (/^hi/i.test(navigator.language || '')) S.lang = 'hi'; } catch (e) {}

/* ---------- text ---------- */
const T = {
  en: {
    brand: 'Bharat Market Pulse', tabs: { today: 'Today', brief: 'Brief', impact: 'Impact', outlook: 'Outlook', calendar: 'Calendar' },
    h: { brief: 'What happened', impact: 'Who it may affect', outlook: 'What could happen next', calendar: "What's coming" },
    listen: 'Listen to the briefing', listenThis: 'Listen to this item', stop: 'Stop', next: 'Next', nowReading: 'Reading now', speeds: ['Slow', 'Normal', 'Fast'],
    weekCould: 'How the week could go', tapBand: 'Tap the bar to read each scenario.',
    updated: 'Updated', fresh: 'Fresh', refreshing: 'Refreshing', offline: 'Offline, saved copy', stale: n => 'Data is ' + n + (n === 1 ? ' day old' : ' days old'),
    numbers: 'Key numbers', keyNumbers: 'Key numbers.', oneLine: 'Today in one line', weekAhead: 'The week ahead.', percent: 'percent', topStories: 'Top stories', seeAll: 'See all', today: 'Today', tomorrow: 'Tomorrow', yesterday: 'Yesterday', allDay: 'All day', readMore: 'Read more', showLess: 'Show less', share: 'Share', copied: 'Copied to clipboard', follow: 'Follow', unfollow: 'Unfollow', mine: 'Following', forYou: 'Following', followHint: 'Tap the star on any sector or company to follow it here.', sectorMap: 'Sector map', sectorMapHint: 'Tap a sector to jump to the reason.', minutes: n => '≈ ' + n + ' min', refresh: 'Refresh', theme: 'Theme', themes: { auto: 'Auto', light: 'Light', dark: 'Dark' }, details: 'Details', readSource: 'Source', disclaimerShort: 'Disclaimer',
    loading: "Loading today's brief", loadFail: "Couldn't load the data sheet", loadFailHelp: 'Check your connection, then try again.', retry: 'Try again',
    all: 'All', searchPH: 'Search a company or sector', noResults: 'Nothing matches. Try a sector such as banks or oil.',
    basedOn: 'Based on', report: 'Report', confidence: 'Confidence', watch: 'What to watch', chance: 'chance', howRead: 'How to read these odds',
    noCal: 'No upcoming events listed. Check back after the next update.',
    noVoiceHi: 'This phone has no Hindi voice installed. Add one in your text-to-speech settings.', noSpeech: "This browser can't read aloud. Try Chrome or Safari.",
    dataSheet: 'Open the data sheet', footer: 'Information only, not investment advice.', sources: 'Sources',
    dir: { Positive: 'Positive', Negative: 'Negative', Mixed: 'Mixed', Neutral: 'Neutral' },
    bias: { Positive: 'Leans up', Sideways: 'Sideways', Negative: 'Leans down' },
    conf: { High: 'High', Medium: 'Medium', Low: 'Low' },
    basis: { 'Reported': 'Reported', 'Reported plus analysis': 'Reported, with analysis', 'Analysis': 'Analysis' },
    cat: {}
  },
  hi: {
    brand: 'भारत मार्केट पल्स', tabs: { today: 'आज', brief: 'खबरें', impact: 'असर', outlook: 'अनुमान', calendar: 'कैलेंडर' },
    h: { brief: 'क्या हुआ', impact: 'किस पर असर पड़ सकता है', outlook: 'आगे क्या हो सकता है', calendar: 'आगे क्या आ रहा है' },
    listen: 'ब्रीफिंग सुनें', listenThis: 'यह खबर सुनें', stop: 'रोकें', next: 'अगला', nowReading: 'अभी पढ़ रहे हैं', speeds: ['धीमा', 'सामान्य', 'तेज़'],
    weekCould: 'यह हफ्ता कैसा रह सकता है', tapBand: 'हर परिदृश्य पढ़ने के लिए पट्टी दबाएँ।',
    updated: 'अपडेट', fresh: 'ताज़ा', refreshing: 'अपडेट हो रहा है', offline: 'ऑफ़लाइन, सहेजी हुई कॉपी', stale: n => 'डेटा ' + n + ' दिन पुराना है',
    numbers: 'मुख्य आँकड़े', keyNumbers: 'मुख्य आँकड़े।', oneLine: 'आज एक पंक्ति में', weekAhead: 'आने वाला हफ्ता।', percent: 'प्रतिशत', topStories: 'मुख्य खबरें', seeAll: 'सभी देखें', today: 'आज', tomorrow: 'कल', yesterday: 'बीता कल', allDay: 'पूरे दिन', readMore: 'पूरा पढ़ें', showLess: 'कम दिखाएँ', share: 'शेयर करें', copied: 'क्लिपबोर्ड पर कॉपी हुआ', follow: 'फ़ॉलो करें', unfollow: 'फ़ॉलो हटाएँ', mine: 'फ़ॉलो किए', forYou: 'आपके फ़ॉलो किए', followHint: 'किसी भी सेक्टर या कंपनी पर सितारा दबाएँ, वह यहाँ दिखेगी।', sectorMap: 'सेक्टर मैप', sectorMapHint: 'कारण पढ़ने के लिए सेक्टर पर दबाएँ।', minutes: n => '≈ ' + n + ' मिनट', refresh: 'रिफ्रेश', theme: 'थीम', themes: { auto: 'ऑटो', light: 'लाइट', dark: 'डार्क' }, details: 'विवरण', readSource: 'स्रोत', disclaimerShort: 'अस्वीकरण',
    loading: 'आज की ब्रीफ लोड हो रही है', loadFail: 'डेटा शीट लोड नहीं हो सकी', loadFailHelp: 'इंटरनेट जाँचें और फिर कोशिश करें।', retry: 'फिर कोशिश करें',
    all: 'सभी', searchPH: 'कंपनी या सेक्टर खोजें', noResults: 'कुछ नहीं मिला। बैंक या तेल जैसा कोई सेक्टर आज़माएँ।',
    basedOn: 'आधार', report: 'खबर', confidence: 'भरोसा', watch: 'किस पर नज़र रखें', chance: 'संभावना', howRead: 'इन संभावनाओं को कैसे पढ़ें',
    noCal: 'कोई आगामी घटना दर्ज नहीं है। अगले अपडेट के बाद देखें।',
    noVoiceHi: 'इस फ़ोन में हिंदी आवाज़ इंस्टॉल नहीं है। टेक्स्ट-टू-स्पीच सेटिंग में जाकर जोड़ें।', noSpeech: 'यह ब्राउज़र बोलकर नहीं पढ़ सकता। Chrome या Safari आज़माएँ।',
    dataSheet: 'डेटा शीट खोलें', footer: 'सिर्फ़ जानकारी के लिए, निवेश सलाह नहीं।', sources: 'स्रोत',
    dir: { Positive: 'सकारात्मक', Negative: 'नकारात्मक', Mixed: 'मिला-जुला', Neutral: 'तटस्थ' },
    bias: { Positive: 'ऊपर की ओर', Sideways: 'सीमित दायरे में', Negative: 'नीचे की ओर' },
    conf: { High: 'उच्च', Medium: 'मध्यम', Low: 'कम' },
    basis: { 'Reported': 'रिपोर्ट के आधार पर', 'Reported plus analysis': 'रिपोर्ट और विश्लेषण', 'Analysis': 'विश्लेषण' },
    cat: { World: 'दुनिया', Commodity: 'कमोडिटी', 'India Market': 'भारतीय बाज़ार', Flows: 'निवेश प्रवाह', Currency: 'मुद्रा', Rates: 'ब्याज दरें', Policy: 'नीति', Risk: 'जोखिम' }
  }
};
const t = k => { const v = T[S.lang][k]; return v === undefined ? T.en[k] : v; };
const L = (o, k) => (o ? ((S.lang === 'hi' && o[k + '_hi']) || o[k + '_en'] || o[k] || '') : '');
const loc = () => (S.lang === 'hi' ? 'hi-IN' : 'en-IN');
const $ = (s, r = document) => r.querySelector(s);

/* ---------- tiny DOM helper (no innerHTML, sheet text is never parsed as HTML) ---------- */
function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) { if (kid == null || kid === false) continue; e.append(kid.nodeType ? kid : document.createTextNode(String(kid))); }
  return e;
}
const NS = 'http://www.w3.org/2000/svg';
function icon(d) { const s = document.createElementNS(NS, 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', 'ic'); s.setAttribute('aria-hidden', 'true'); const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); s.append(p); return s; }
const IC = {
  brief: 'M6 3h9l4 4v14H6z M14 3v5h5 M9 12h7 M9 16h7', impact: 'M5 20v-7 M12 20V5 M19 20v-10', outlook: 'M3 17l6-6 4 4 8-9 M15 6h6v6',
  calendar: 'M4 6h16v14H4z M4 10h16 M8 3v4 M16 3v4', today: 'M3 11l9-8 9 8 M5 9.5V20h14V9.5 M10 20v-6h4v6', speaker: 'M4 9v6h4l5 4V5L8 9z M16 9a4 4 0 010 6 M18.5 6.5a8 8 0 010 11', stop: 'M6 6h12v12H6z', next: 'M5 5v14l9-7z M17 5v14',
  play: 'M7 4l13 8-13 8z', star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z', share: 'M12 15V4 M7.5 8.5L12 4l4.5 4.5 M5 13v7h14v-7', refresh: 'M20 12a8 8 0 11-2.6-5.9 M20 4v5h-5', chev: 'M6 9l6 6 6-6', ext: 'M14 4h6v6 M20 4l-9 9 M18 14v6H4V6h6', clock: 'M12 7v5l3 2 M12 3a9 9 0 100 18 9 9 0 000-18z', eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M12 9a3 3 0 100 6 3 3 0 000-6z',
  theme: { auto: 'M12 3a9 9 0 100 18 9 9 0 000-18z M12 3v18 M12 3a9 9 0 010 18z', light: 'M12 8a4 4 0 100 8 4 4 0 000-8z M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l1.5 1.5 M17.5 17.5L19 19 M5 19l1.5-1.5 M17.5 6.5L19 5', dark: 'M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z' }
};
function logo() {
  const s = document.createElementNS(NS, 'svg'); s.setAttribute('viewBox', '0 0 32 32'); s.setAttribute('aria-hidden', 'true');
  const r = document.createElementNS(NS, 'rect'); r.setAttribute('width', '32'); r.setAttribute('height', '32'); r.setAttribute('rx', '8'); r.setAttribute('fill', '#13233A');
  const p = document.createElementNS(NS, 'path'); p.setAttribute('d', 'M4 18h5l3-8 5 14 4-10 2 4h5'); p.setAttribute('fill', 'none'); p.setAttribute('stroke', '#E4702A'); p.setAttribute('stroke-width', '2.6'); p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-linejoin', 'round');
  s.append(r, p); return s;
}

/* ---------- csv ---------- */
function parseCSV(txt) {
  const rows = []; let r = [], f = '', q = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (q) { if (c === '"') { if (txt[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { r.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && txt[i + 1] === '\n') i++; r.push(f); rows.push(r); r = []; f = ''; }
    else f += c;
  }
  if (f !== '' || r.length) { r.push(f); rows.push(r); }
  return rows;
}
function toObjects(rows) {
  if (!rows.length) return [];
  const head = rows[0].map(s => s.trim());
  return rows.slice(1).filter(r => r.some(x => x.trim() !== '')).map(r => Object.fromEntries(head.map((k, i) => [k, (r[i] || '').trim()])));
}

/* ---------- data ---------- */
async function fetchTab(tab, signal) {
  const url = params.get('local') ? 'test-data/' + tab + '.csv' : 'https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/gviz/tq?tqx=out:csv&headers=1&sheet=' + tab;
  const r = await fetch(url, { signal, cache: 'no-store' });
  if (!r.ok) throw new Error(tab + ' returned ' + r.status);
  const txt = await r.text();
  if (/^\s*</.test(txt)) throw new Error(tab + ' is not public');
  return toObjects(parseCSV(txt));
}
async function load() {
  if (!S.data) S.loading = true; else S.refreshing = true;
  S.error = ''; render();
  const ac = new AbortController(); const to = setTimeout(() => ac.abort(), 15000);
  try {
    const res = await Promise.all(TABS.map(tb => fetchTab(tb, ac.signal)));
    const data = {}; TABS.forEach((tb, i) => { data[tb] = res[i]; });
    S.data = data; S.source = 'live';
    try { localStorage.setItem(LS.cache, JSON.stringify({ t: Date.now(), data })); } catch (e) {}
  } catch (e) {
    if (!S.data) S.error = String((e && e.message) || e);
    else S.source = 'cache';
  }
  clearTimeout(to); S.loading = false; S.refreshing = false; render();
}
const rows = tab => (S.data && S.data[tab]) || [];
const metaRow = k => rows('Meta').find(r => r.key === k);
const meta = k => { const r = metaRow(k); return r ? (S.lang === 'hi' && r.value_hi ? r.value_hi : r.value_en) || '' : ''; };
const scenarios = () => rows('Outlook').map(o => Object.assign({ p: Math.max(0, Number(o.probability_pct) || 0) }, o)).filter(o => o.p > 0);

/* ---------- formatting ---------- */
const dOnly = s => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
const fmtDate = (s, opt) => { const d = dOnly(s); return d ? new Intl.DateTimeFormat(loc(), opt).format(d) : (s || ''); };
function fmtAsOf(s) { const m = /^(\d{4})-(\d{2})(-(\d{2}))?/.exec(s || ''); if (!m) return s || ''; return m[4] ? fmtDate(s, { day: 'numeric', month: 'short' }) : new Intl.DateTimeFormat(loc(), { month: 'short', year: 'numeric' }).format(new Date(+m[1], +m[2] - 1, 1)); }
function fmtUpdated(iso) { const d = new Date(iso); return isNaN(d) ? '' : new Intl.DateTimeFormat(loc(), { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }).format(d) + ' IST'; }
const safeUrl = s => { try { const u = new URL(s); return /^https?:$/.test(u.protocol) ? u.href : ''; } catch (e) { return ''; } };
const dirCls = d => ({ Positive: 'pos', Negative: 'neg', Mixed: 'mix' }[d] || 'neu');
const biasCls = b => ({ Positive: 'pos', Negative: 'neg' }[b] || 'mix');
const DIR_MARK = { pos: '▲', neg: '▼', mix: '◆', neu: '●' };
const catName = c => (S.lang === 'hi' && T.hi.cat[c]) || c;
const tags = o => (L(o, 'sectors') || '').split(',').map(s => s.trim()).filter(Boolean);

/* ---------- views ---------- */
const slug = s => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const chgCls = r => { const c = String(r.change || ''); if (/^\s*[+▲]|\b(up|higher|gain|rise|rose|surge|rall)/i.test(c)) return 'pos'; if (/^\s*[-−–▼]|\b(down|lower|fell|fall|drop|slip|cut)/i.test(c)) return 'neg'; return 'neu'; };
function dirPill(d) { const c = dirCls(d); return h('span', { class: 'pill ' + c }, h('span', { 'aria-hidden': 'true' }, DIR_MARK[c]), t('dir')[d] || d); }
function confEl(c) { const n = { High: 3, Medium: 2, Low: 1 }[c] || 0; return h('span', { class: 'conf', title: t('confidence') + ': ' + (t('conf')[c] || c) }, h('span', { class: 'conf-dots', 'aria-hidden': 'true' }, [1, 2, 3].map(i => h('i', { class: i <= n ? 'on' : '' }))), h('span', null, t('confidence') + ' ' + (t('conf')[c] || c))); }
function iconBtn(path, label, fn, cls) { return h('button', { class: 'ib ' + (cls || ''), 'aria-label': label, title: label, onclick: fn }, icon(path)); }
function speakBtn(item) { if (!canListen()) return null; return iconBtn(IC.play, t('listenThis'), e => { e.stopPropagation(); startTTS([item]); }, 'ib-play'); }
function shareBtn(title, text) {
  return iconBtn(IC.share, t('share'), async e => {
    e.stopPropagation(); const data = { title, text: title + (text ? ' — ' + text : ''), url: location.href.split('#')[0] };
    try { if (navigator.share) await navigator.share(data); else if (navigator.clipboard) { await navigator.clipboard.writeText(data.text + ' ' + data.url); toast(t('copied')); } } catch (er) {}
  });
}
let toastT; function toast(m) { let el = $('#toast'); if (!el) { el = h('div', { id: 'toast', class: 'toast', role: 'status' }); document.body.append(el); } el.textContent = m; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 1800); }
const isWatched = k => S.watch.includes(k);
function toggleWatch(k) { S.watch = isWatched(k) ? S.watch.filter(x => x !== k) : [...S.watch, k]; try { localStorage.setItem(LS.watch, JSON.stringify(S.watch)); } catch (e) {} render(); }
function starBtn(k) { const on = isWatched(k); return h('button', { class: 'ib star', 'aria-pressed': on, 'aria-label': (on ? t('unfollow') : t('follow')), title: on ? t('unfollow') : t('follow'), onclick: e => { e.stopPropagation(); toggleWatch(k); } }, icon(IC.star)); }

function topbar() {
  const themeLbl = t('themes')[S.theme];
  return h('header', { class: 'top' }, h('div', { class: 'top-in' },
    h('div', { class: 'brand' }, logo(), h('span', null, t('brand'))),
    h('div', { class: 'top-r' },
      h('button', { class: 'ib', 'aria-label': t('theme') + ': ' + themeLbl, title: t('theme') + ': ' + themeLbl, onclick: cycleTheme }, icon(IC.theme[S.theme])),
      h('div', { class: 'seg', role: 'group', 'aria-label': 'Language' },
        h('button', { 'aria-pressed': S.lang === 'en', lang: 'en', 'aria-label': 'English', onclick: () => setLang('en') }, 'EN'),
        h('button', { 'aria-pressed': S.lang === 'hi', lang: 'hi', 'aria-label': 'हिन्दी', onclick: () => setLang('hi') }, 'हि')))));
}
function applyTheme() { if (S.theme === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', S.theme); const m = $('meta[name=theme-color]'); if (m) m.setAttribute('content', document.documentElement.getAttribute('data-theme') === 'dark' || (S.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches) ? '#0B1220' : '#F3F5F9'); }
function cycleTheme() { S.theme = { auto: 'light', light: 'dark', dark: 'auto' }[S.theme]; try { localStorage.setItem(LS.theme, S.theme); } catch (e) {} applyTheme(); render(); }

function freshness() {
  const iso = meta('updated_at'); const age = (Date.now() - new Date(iso)) / 36e5; let label, cls = 'ok';
  if (S.refreshing) label = t('refreshing'); else if (S.source === 'cache') { label = t('offline'); cls = 'warn'; }
  else if (isNaN(age) || age <= 36) label = t('fresh'); else { label = t('stale')(Math.max(1, Math.round(age / 24))); cls = 'warn'; }
  return h('div', { class: 'fresh', 'aria-live': 'polite' }, h('span', { class: 'chip ' + cls }, h('i', { class: 'live' }), label), h('span', { class: 'fresh-t' }, t('updated') + ' ' + fmtUpdated(iso)),
    h('button', { class: 'ib sm' + (S.refreshing ? ' spin' : ''), 'aria-label': t('refresh'), title: t('refresh'), onclick: () => { if (!S.refreshing) load(); } }, icon(IC.refresh)));
}
function briefMinutes() { const w = briefingItems().reduce((n, i) => n + i.text.split(/\s+/).length, 0); return Math.max(1, Math.round(w / (S.lang === 'hi' ? 125 : 150))); }
function eq() { return h('span', { class: 'eq', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'), h('i')); }
function hero() {
  const noHi = S.lang === 'hi' && TTS.voicesLoaded && !voiceFor('hi') && !AUD.map; const mood = meta('mood'); const status = meta('market_status');
  const playing = TTS.on && TTS.items.length > 1;
  return h('section', { class: 'hero' },
    h('div', { class: 'hero-top' }, h('span', { class: 'hero-date' }, fmtDate(meta('brief_date'), { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })), mood ? h('span', { class: 'mood' }, mood) : null),
    h('h1', { class: 'hero-line' }, meta('today_in_one_line')),
    status ? h('p', { class: 'hero-meta' }, status) : null,
    canListen() ? h('button', { class: 'listen' + (playing ? ' on' : ''), onclick: () => (playing ? stopTTS() : startTTS(briefingItems())) },
      h('span', { class: 'listen-ic' }, playing ? eq() : icon(IC.play)),
      h('span', { class: 'listen-t' }, h('b', null, playing ? t('stop') : t('listen')), h('small', null, t('minutes')(briefMinutes()) + ' · ' + (S.lang === 'hi' ? 'हिन्दी' : 'English')))) : h('p', { class: 'hint' }, t('noSpeech')),
    noHi ? h('p', { class: 'hint' }, t('noVoiceHi')) : null,
    freshness());
}
function pulse() {
  return h('section', { class: 'pulse', 'aria-label': t('numbers') },
    h('div', { class: 'pulse-row', tabindex: '0' }, rows('Pulse').map(r => { const c = chgCls(r); return h('div', { class: 'pt ' + c },
      h('p', { class: 'pt-l' }, L(r, 'label')), h('p', { class: 'pt-v' }, r.value),
      h('p', { class: 'pt-c' }, h('span', { 'aria-hidden': 'true' }, c === 'neu' ? '' : DIR_MARK[c]), L(r, 'change')), h('p', { class: 'pt-a' }, fmtAsOf(r.as_of))); })));
}
function band(sc) {
  return h('section', { class: 'bandcard' },
    h('div', { class: 'bandcard-h' }, h('h2', null, t('weekCould')), h('button', { class: 'more', onclick: () => go('outlook') }, t('details'), icon(IC.chev))),
    h('div', { class: 'band' + (S.intro ? ' intro' : ''), role: 'group', 'aria-label': t('weekCould') }, sc.map(s => h('button', { class: 'bseg ' + biasCls(s.bias), style: 'flex:' + s.p + ' 1 0', 'aria-label': L(s, 'scenario') + ', ' + s.p + '%', onclick: () => go('outlook') }, s.p + '%'))),
    h('ul', { class: 'band-legend' }, sc.map(s => h('li', null, h('i', { class: 'dot ' + biasCls(s.bias) }), h('span', null, L(s, 'scenario'))))));
}
function watchStrip() {
  const imp = rows('Impacts'); const mine = imp.filter(r => isWatched(r.entity_en));
  if (!mine.length) return h('section', { class: 'follow empty' }, h('h2', null, icon(IC.star), t('forYou')), h('p', null, t('followHint')));
  return h('section', { class: 'follow' }, h('h2', null, icon(IC.star), t('forYou')),
    h('div', { class: 'follow-row' }, mine.map(r => { const c = dirCls(r.direction); return h('button', { class: 'fchip ' + c, onclick: () => goImpact(r.entity_en) }, h('span', { 'aria-hidden': 'true' }, DIR_MARK[c]), L(r, 'entity')); })));
}
function chipRow(options, current, onPick, labelFn) {
  return h('div', { class: 'chips', role: 'group' }, options.map(o => h('button', { class: 'fc', 'aria-pressed': o === current, onclick: () => onPick(o) }, labelFn(o))));
}
const catIcon = {};
function viewBrief() {
  const items = rows('Brief'); const cats = ['All', ...new Set(items.map(i => i.category))];
  const list = items.filter(i => S.fCat === 'All' || i.category === S.fCat);
  return h('section', { class: 'view' },
    h('div', { class: 'view-h' }, h('h2', null, t('h').brief), h('span', { class: 'count' }, list.length)),
    chipRow(cats, S.fCat, c => { S.fCat = c; render(); }, c => (c === 'All' ? t('all') : catName(c))),
    h('div', { class: 'list' }, list.map(briefCard)));
}
function briefCard(it) {
  const c = dirCls(it.impact); const open = S.open.has(it.id);
  const art = h('article', { class: 'card ' + c + (open ? ' open' : ''), id: 'brief-' + it.id },
    h('div', { class: 'card-top' }, h('span', { class: 'cat' }, catName(it.category)), dirPill(it.impact)),
    h('h3', { class: 'card-h' }, L(it, 'headline')),
    h('p', { class: 'card-p' }, L(it, 'summary')),
    h('div', { class: 'card-more' },
      tags(it).length ? h('ul', { class: 'tags' }, tags(it).map(x => h('li', null, x))) : null,
      h('div', { class: 'meta-row' }, confEl(it.confidence), h('span', { class: 'basis' }, t('basis')[it.basis] || it.basis)),
      safeUrl(it.source_url) ? h('a', { class: 'src', href: safeUrl(it.source_url), target: '_blank', rel: 'noopener noreferrer' }, t('readSource') + ': ' + (it.source_name || t('report')), icon(IC.ext)) : (it.source_name ? h('span', { class: 'src' }, it.source_name) : null)),
    h('div', { class: 'card-act' },
      h('button', { class: 'expand', 'aria-expanded': open, onclick: e => { const on = !art.classList.contains('open'); art.classList.toggle('open', on); e.currentTarget.setAttribute('aria-expanded', on); on ? S.open.add(it.id) : S.open.delete(it.id); } }, h('span', { class: 'ex-more' }, t('readMore')), h('span', { class: 'ex-less' }, t('showLess')), icon(IC.chev)),
      h('span', { class: 'acts' }, speakBtn({ title: L(it, 'headline'), text: L(it, 'headline') + '. ' + L(it, 'summary') }), shareBtn(L(it, 'headline'), ''))));
  return art;
}
function viewToday() {
  const top = rows('Brief').slice(0, 3);
  return h('section', { class: 'view' }, h('div', { class: 'view-h' }, h('h2', null, t('topStories')), h('button', { class: 'more push', onclick: () => go('brief') }, t('seeAll'), icon(IC.chev))),
    h('div', { class: 'list' }, top.map(briefCard)));
}
function sectorMap(list) {
  return h('div', { class: 'smap', role: 'group', 'aria-label': t('sectorMap') }, list.map(r => { const c = dirCls(r.direction);
    return h('button', { class: 'tile ' + c, onclick: () => scrollToImpact(r.entity_en) }, h('span', { class: 'tile-m', 'aria-hidden': 'true' }, DIR_MARK[c]), h('span', { class: 'tile-n' }, L(r, 'entity'))); }));
}
function impactList() {
  const q = S.q.trim().toLowerCase();
  const list = rows('Impacts').filter(r => (S.fDir === 'All' || (S.fDir === 'Mine' ? isWatched(r.entity_en) : r.direction === S.fDir)) && (!q || [r.entity_en, r.entity_hi, r.companies, r.driver_en, r.driver_hi].join(' ').toLowerCase().includes(q)));
  if (!list.length) return h('div', { class: 'list', id: 'impact-list' }, h('p', { class: 'empty' }, S.fDir === 'Mine' ? t('followHint') : t('noResults')));
  return h('div', { class: 'list', id: 'impact-list' }, list.map(r => { const c = dirCls(r.direction);
    return h('article', { class: 'card ' + c + ' open always', id: 'imp-' + slug(r.entity_en) },
      h('div', { class: 'card-top' }, h('h3', { class: 'card-h tight' }, L(r, 'entity')), h('span', { class: 'top-acts' }, dirPill(r.direction), starBtn(r.entity_en))),
      r.companies ? h('ul', { class: 'tags co' }, r.companies.split(',').map(s => s.trim()).filter(Boolean).map(x => h('li', null, x))) : null,
      h('p', { class: 'card-p full' }, L(r, 'driver')),
      h('div', { class: 'meta-row' }, h('span', { class: 'hz' }, icon(IC.clock), L(r, 'horizon')), confEl(r.confidence)),
      h('div', { class: 'card-act' },
        (r.news_ids || '').split(',').filter(Boolean).length ? h('span', { class: 'based' }, t('basedOn') + ' ', (r.news_ids.split(',').map(s => s.trim()).filter(Boolean)).map(id => h('button', { class: 'link-chip', onclick: () => goBrief(id) }, t('report') + ' ' + id))) : h('span'),
        h('span', { class: 'acts' }, speakBtn({ title: L(r, 'entity'), text: L(r, 'entity') + '. ' + L(r, 'driver') }), shareBtn(L(r, 'entity'), L(r, 'driver'))))); }));
}
function viewImpact() {
  const input = h('input', { class: 'search', type: 'search', placeholder: t('searchPH'), 'aria-label': t('searchPH'), value: S.q });
  input.addEventListener('input', () => { S.q = input.value; const old = $('#impact-list'); if (old) old.replaceWith(impactList()); });
  const all = rows('Impacts');
  return h('section', { class: 'view' }, h('div', { class: 'view-h' }, h('h2', null, t('h').impact), h('span', { class: 'count' }, all.length)),
    h('p', { class: 'vsub' }, t('sectorMapHint')), sectorMap(all), input,
    chipRow(['All', 'Positive', 'Negative', 'Mixed', 'Mine'], S.fDir, d => { S.fDir = d; render(); }, d => (d === 'All' ? t('all') : d === 'Mine' ? '★ ' + t('mine') : t('dir')[d])), impactList());
}
function viewOutlook() {
  const sc = scenarios(); const o = rows('Outlook')[0];
  return h('section', { class: 'view' }, h('div', { class: 'view-h' }, h('h2', null, t('h').outlook)), o ? h('p', { class: 'vsub' }, L(o, 'horizon')) : null,
    meta('outlook_note') ? h('div', { class: 'note' }, h('strong', null, t('howRead')), h('span', null, meta('outlook_note'))) : null,
    sc.map(s => { const b = biasCls(s.bias);
      return h('article', { class: 'card sc ' + b + ' open always' },
        h('div', { class: 'sc-head' }, h('div', { class: 'ring ' + b, style: '--p:' + s.p, role: 'img', 'aria-label': s.p + '% ' + t('chance') }, h('span', null, s.p, h('small', null, '%'))),
          h('div', { class: 'sc-t' }, h('span', { class: 'pill ' + b }, h('span', { 'aria-hidden': 'true' }, DIR_MARK[b]), t('bias')[s.bias] || s.bias), h('h3', { class: 'card-h tight' }, L(s, 'scenario')))),
        h('p', { class: 'card-p full' }, L(s, 'what')),
        h('p', { class: 'watch' }, h('b', null, icon(IC.eye), t('watch')), L(s, 'watch')),
        h('div', { class: 'card-act' }, h('span'), h('span', { class: 'acts' }, speakBtn({ title: L(s, 'scenario'), text: s.p + ' ' + t('percent') + '. ' + L(s, 'scenario') + '. ' + L(s, 'what') }), shareBtn(L(s, 'scenario'), s.p + '%')))); }));
}
function relDay(ds) {
  const d = dOnly(ds); if (!d) return ''; const n = new Date(); const diff = Math.round((d - new Date(n.getFullYear(), n.getMonth(), n.getDate())) / 864e5);
  return diff === 0 ? t('today') : diff === 1 ? t('tomorrow') : diff === -1 ? t('yesterday') : diff > 1 && diff < 7 ? fmtDate(ds, { weekday: 'long' }) : '';
}
function viewCalendar() {
  const y = new Date(); y.setDate(y.getDate() - 1); const cut = y.getFullYear() + '-' + String(y.getMonth() + 1).padStart(2, '0') + '-' + String(y.getDate()).padStart(2, '0');
  const list = rows('Calendar').filter(r => r.date >= cut).sort((a, b) => (a.date + a.time_ist).localeCompare(b.date + b.time_ist));
  const groups = []; list.forEach(e => { let g = groups[groups.length - 1]; if (!g || g.date !== e.date) { g = { date: e.date, ev: [] }; groups.push(g); } g.ev.push(e); });
  return h('section', { class: 'view' }, h('div', { class: 'view-h' }, h('h2', null, t('h').calendar)),
    groups.length ? h('div', { class: 'tl' }, groups.map(g => h('div', { class: 'tl-day' },
      h('div', { class: 'tl-h' }, h('b', null, relDay(g.date) || fmtDate(g.date, { weekday: 'short' })), h('span', null, fmtDate(g.date, { day: 'numeric', month: 'short' }))),
      g.ev.map(e => h('article', { class: 'ev' },
        h('div', { class: 'ev-t' }, e.time_ist ? e.time_ist + ' IST' : t('allDay')),
        h('div', { class: 'ev-b' }, h('h3', null, L(e, 'event')), h('p', null, L(e, 'why')),
          safeUrl(e.source_url) ? h('a', { class: 'src', href: safeUrl(e.source_url), target: '_blank', rel: 'noopener noreferrer' }, e.source_name || t('report'), icon(IC.ext)) : null)))))) : h('p', { class: 'empty' }, t('noCal')));
}
function nav() {
  const items = [['today', IC.today], ['brief', IC.brief], ['impact', IC.impact], ['outlook', IC.outlook], ['calendar', IC.calendar]];
  return h('nav', { class: 'nav', 'aria-label': 'Sections' }, h('div', { class: 'nav-in' }, items.map(([k, d]) => h('button', { class: k === 'today' ? 'only-m' : '', 'aria-current': curTab() === k ? 'page' : null, onclick: () => go(k) }, icon(d), h('span', null, t('tabs')[k])))));
}
function footer() {
  return h('footer', { class: 'foot-note' }, h('p', null, meta('disclaimer')), h('p', null, meta('sources_note')), h('p', null, h('a', { href: SHEET_URL, target: '_blank', rel: 'noopener noreferrer' }, t('dataSheet')), ' · ' + t('footer')));
}
function player() {
  const it = TTS.items[TTS.idx]; const n = TTS.items.length;
  return h('div', { class: 'player', id: 'player', hidden: !TTS.on, role: 'region', 'aria-label': t('nowReading') },
    h('div', { class: 'pbar' }, h('i', { id: 'pfill', style: 'width:' + (n ? (TTS.idx / n) * 100 : 0) + '%' })),
    h('div', { class: 'p-in' }, eq(),
      h('div', { class: 'pn' }, h('small', null, t('nowReading') + (n > 1 ? ' · ' + (TTS.idx + 1) + '/' + n : '')), h('strong', null, it ? it.title : '')),
      n > 1 ? iconBtn(IC.next, t('next'), nextTTS) : null,
      h('button', { class: 'rate', onclick: cycleRate, 'aria-label': 'Speed' }, t('speeds')[TTS.rateIdx]),
      iconBtn(IC.stop, t('stop'), stopTTS, 'ib-stop')));
}
function skeleton() { return h('div', { class: 'skel', role: 'status', 'aria-label': t('loading') }, h('i', { class: 'sk h1' }), h('i', { class: 'sk h2' }), h('i', { class: 'sk h3' }), h('i', { class: 'sk card' }), h('i', { class: 'sk card' })); }
const wideMQ = matchMedia('(min-width: 960px)'); const isWide = () => wideMQ.matches;
const curTab = () => (S.tab === 'today' && isWide() ? 'brief' : S.tab);
function view() { return { today: viewToday, brief: viewBrief, impact: viewImpact, outlook: viewOutlook, calendar: viewCalendar }[curTab()](); }
function render() {
  document.documentElement.lang = S.lang; document.title = t('brand');
  const app = $('#app'); const y = window.scrollY; let body;
  if (!S.data) body = S.loading || !S.error ? [skeleton()]
    : [h('div', { class: 'err' }, h('h2', null, t('loadFail')), h('p', null, t('loadFailHelp')), h('button', { class: 'btn', onclick: load }, t('retry')))];
  else { const sc = scenarios();
    const v = view(); if (S.enter) { v.classList.add('enter'); S.enter = false; }
    body = [h('main', { class: 'layout ' + (S.tab === 'today' ? 't-today' : 't-other') }, h('div', { class: 'side' }, hero(), pulse(), sc.length ? band(sc) : null, watchStrip()), h('div', { class: 'feed' }, nav(), v, footer()))]; }
  app.replaceChildren(topbar(), ...body, ...(S.data ? [player()] : []));
  if (S.data) S.intro = false;
  window.scrollTo(0, y);
}
function go(tab) { S.tab = tab === 'today' && isWide() ? 'brief' : tab; S.enter = true; render(); window.scrollTo(0, 0); }
function goBrief(id) { S.tab = 'brief'; S.fCat = 'All'; S.open.add(id); S.enter = false; render(); requestAnimationFrame(() => { const el = document.getElementById('brief-' + id); if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('flash'); } }); }
function scrollToImpact(e) { const el = document.getElementById('imp-' + slug(e)); if (!el) { S.fDir = 'All'; S.q = ''; render(); return requestAnimationFrame(() => scrollToImpact(e)); } el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
function goImpact(e) { S.tab = 'impact'; S.fDir = 'All'; S.q = ''; S.enter = false; render(); requestAnimationFrame(() => scrollToImpact(e)); }
function setLang(l) { stopTTS(); S.lang = l; try { localStorage.setItem(LS.lang, l); } catch (e) {} render(); }

/* ---------- read aloud ---------- */
const canSpeak = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
const RATES = [0.88, 1, 1.15];
const TTS = { on: false, items: [], idx: 0, tok: 0, voices: [], voicesLoaded: false, rateIdx: 1 };
try { const r = parseInt(localStorage.getItem(LS.rate), 10); if (r >= 0 && r < 3) TTS.rateIdx = r; } catch (e) {}
function loadVoices() { if (!canSpeak) return; TTS.voices = speechSynthesis.getVoices() || []; if (TTS.voices.length) { const first = !TTS.voicesLoaded; TTS.voicesLoaded = true; if (first && S.data) render(); } }
function voiceFor(lang) {
  const want = lang === 'hi' ? 'hi' : 'en'; const m = TTS.voices.filter(v => v.lang.toLowerCase().replace('_', '-').startsWith(want));
  if (lang === 'hi') return m[0];
  return m.find(v => /en[-_]IN/i.test(v.lang)) || m.find(v => /en[-_]GB/i.test(v.lang)) || m[0];
}
function chunk(text) {
  const parts = text.replace(/\s+/g, ' ').replace(/([.!?।])\s+/g, '$1\u0001').split('\u0001').map(s => s.trim()).filter(Boolean); const out = []; let cur = '';
  for (const p of parts) { if (cur && (cur + ' ' + p).length > 170) { out.push(cur); cur = p; } else cur = cur ? cur + ' ' + p : p; }
  if (cur) out.push(cur); return out;
}
/* Natural neural-voice clips (made daily by a GitHub Action, see tools/make_audio.py). Same text hash on both sides; if a clip is missing the device voice is used. */
const AUD = { map: null }; const AU = new Audio(); AU.preload = 'auto';
function fnv(s) { s = s.replace(/\s+/g, ' ').trim(); let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16) + '-' + s.length; }
function audioFor(text) { return AUD.map ? AUD.map[S.lang + '-' + fnv(text)] : null; }
const canListen = () => canSpeak || !!AUD.map;
function haltAudio() { AU.onended = AU.onerror = AU.ontimeupdate = null; try { AU.pause(); } catch (e) {} }
function speakItem(i, tok) {
  if (tok !== TTS.tok) return;
  if (i >= TTS.items.length) { stopTTS(); return; }
  TTS.idx = i; updatePlayer();
  const clip = audioFor(TTS.items[i].text);
  if (clip) {
    AU.onended = () => { if (tok === TTS.tok) speakItem(i + 1, tok); };
    AU.onerror = () => { if (tok === TTS.tok) speakDevice(i, tok); };
    AU.ontimeupdate = () => { const f = $('#pfill'); if (f && AU.duration) f.style.width = ((TTS.idx + AU.currentTime / AU.duration) / TTS.items.length * 100) + '%'; };
    AU.src = 'audio/' + clip; AU.playbackRate = RATES[TTS.rateIdx];
    const pr = AU.play(); if (pr && pr.catch) pr.catch(() => { if (tok === TTS.tok) speakDevice(i, tok); });
    return;
  }
  speakDevice(i, tok);
}
function speakDevice(i, tok) {
  if (!canSpeak) { speakItem(i + 1, tok); return; }
  AU.onended = AU.onerror = null; const parts = chunk(TTS.items[i].text); let k = 0; const lang = S.lang;
  const step = () => {
    if (tok !== TTS.tok) return;
    if (k >= parts.length) { speakItem(i + 1, tok); return; }
    const u = new SpeechSynthesisUtterance(parts[k++]); u.lang = lang === 'hi' ? 'hi-IN' : 'en-IN'; const v = voiceFor(lang); if (v) u.voice = v; u.rate = RATES[TTS.rateIdx];
    u.onend = step; u.onerror = e => { if (e && (e.error === 'canceled' || e.error === 'interrupted')) return; step(); };
    speechSynthesis.speak(u);
  };
  step();
}
function startTTS(items) { if (!canListen() || !items.length) return; haltAudio(); if (canSpeak) speechSynthesis.cancel(); TTS.tok++; TTS.on = true; TTS.items = items; TTS.idx = 0; render(); speakItem(0, TTS.tok); }
function stopTTS() { TTS.tok++; haltAudio(); if (canSpeak) speechSynthesis.cancel(); const was = TTS.on; TTS.on = false; TTS.items = []; TTS.idx = 0; if (was && S.data) render(); }
function nextTTS() { if (!TTS.on) return; const tok = ++TTS.tok; haltAudio(); if (canSpeak) speechSynthesis.cancel(); speakItem(TTS.idx + 1, tok); }
function cycleRate() { TTS.rateIdx = (TTS.rateIdx + 1) % 3; try { localStorage.setItem(LS.rate, String(TTS.rateIdx)); } catch (e) {} AU.playbackRate = RATES[TTS.rateIdx]; updatePlayer(); }
function updatePlayer() { const old = $('#player'); if (old) old.replaceWith(player()); }
function firstSentence(s) { const m = /^.*?[.।](\s|$)/.exec(s || ''); return m ? m[0].trim() : s; }
function briefingItems() {
  const items = []; const D = meta('brief_date');
  items.push({ title: t('brand'), text: t('brand') + '.' });
  items.push({ title: t('oneLine'), text: meta('today_in_one_line') });
  const ps = rows('Pulse').filter(p => ['nifty', 'sensex', 'brent', 'usdinr'].includes(p.key));
  if (ps.length) items.push({ title: t('numbers'), text: t('keyNumbers') + ' ' + ps.map(p => L(p, 'label') + ': ' + p.value + '.').join(' ') });
  rows('Brief').forEach(b => items.push({ title: L(b, 'headline'), text: L(b, 'headline') + '. ' + L(b, 'summary') }));
  const sc = scenarios();
  if (sc.length) items.push({ title: t('tabs').outlook, text: t('weekAhead') + ' ' + sc.map(s => s.p + ' ' + t('percent') + ': ' + L(s, 'scenario') + '. ' + L(s, 'what')).join(' ') + ' ' + meta('outlook_note') });
  items.push({ title: t('disclaimerShort'), text: firstSentence(meta('disclaimer')) });
  return items;
}

/* ---------- boot ---------- */
if (canSpeak) { loadVoices(); if (speechSynthesis.addEventListener) speechSynthesis.addEventListener('voiceschanged', loadVoices); }
window.addEventListener('pagehide', () => { haltAudio(); if (canSpeak) speechSynthesis.cancel(); });
fetch('audio/manifest.json', { cache: 'no-cache' }).then(r => (r.ok ? r.json() : null)).then(m => { if (m && m.items) { AUD.map = m.items; if (S.data) render(); } }).catch(() => {});
try { const c = JSON.parse(localStorage.getItem(LS.cache)); if (c && c.data) { S.data = c.data; S.source = 'cache'; } } catch (e) {}
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !params.get('local')) navigator.serviceWorker.register('sw.js').catch(() => {});
applyTheme(); (wideMQ.addEventListener ? wideMQ.addEventListener('change', () => { if (S.data) render(); }) : 0); load();
})();

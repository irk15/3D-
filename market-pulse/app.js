(() => {
'use strict';
/* Bharat Market Pulse. Reads a public Google Sheet, shows it in English or Hindi, reads it aloud. */
const SHEET_ID = '1cc_zmf_p3mglIllH_WwkfY4TxylMsrUbhyolLoiA19M';
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/edit';
const TABS = ['Meta', 'Pulse', 'Brief', 'Impacts', 'Outlook', 'Calendar'];
const LS = { lang: 'mp-lang', cache: 'mp-cache-1', rate: 'mp-rate' };
const params = new URLSearchParams(location.search);
const S = { intro: true, lang: 'en', tab: 'brief', data: null, source: 'live', refreshing: false, loading: false, error: '', fCat: 'All', fDir: 'All', q: '' };
try { const l = localStorage.getItem(LS.lang); if (l === 'hi' || l === 'en') S.lang = l; else if (/^hi/i.test(navigator.language || '')) S.lang = 'hi'; } catch (e) {}

/* ---------- text ---------- */
const T = {
  en: {
    brand: 'Bharat Market Pulse', tabs: { brief: 'Brief', impact: 'Impact', outlook: 'Outlook', calendar: 'Calendar' },
    h: { brief: 'What happened', impact: 'Who it may affect', outlook: 'What could happen next', calendar: "What's coming" },
    listen: 'Listen to the briefing', listenThis: 'Listen to this item', stop: 'Stop', next: 'Next', nowReading: 'Reading now', speeds: ['Slow', 'Normal', 'Fast'],
    weekCould: 'How the week could go', tapBand: 'Tap the bar to read each scenario.',
    updated: 'Updated', fresh: 'Fresh', refreshing: 'Refreshing', offline: 'Offline, saved copy', stale: n => 'Data is ' + n + (n === 1 ? ' day old' : ' days old'),
    numbers: 'Key numbers', keyNumbers: 'Key numbers.', oneLine: 'Today in one line', weekAhead: 'The week ahead.', percent: 'percent', disclaimerShort: 'Disclaimer',
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
    brand: 'भारत मार्केट पल्स', tabs: { brief: 'खबरें', impact: 'असर', outlook: 'अनुमान', calendar: 'कैलेंडर' },
    h: { brief: 'क्या हुआ', impact: 'किस पर असर पड़ सकता है', outlook: 'आगे क्या हो सकता है', calendar: 'आगे क्या आ रहा है' },
    listen: 'ब्रीफिंग सुनें', listenThis: 'यह खबर सुनें', stop: 'रोकें', next: 'अगला', nowReading: 'अभी पढ़ रहे हैं', speeds: ['धीमा', 'सामान्य', 'तेज़'],
    weekCould: 'यह हफ्ता कैसा रह सकता है', tapBand: 'हर परिदृश्य पढ़ने के लिए पट्टी दबाएँ।',
    updated: 'अपडेट', fresh: 'ताज़ा', refreshing: 'अपडेट हो रहा है', offline: 'ऑफ़लाइन, सहेजी हुई कॉपी', stale: n => 'डेटा ' + n + ' दिन पुराना है',
    numbers: 'मुख्य आँकड़े', keyNumbers: 'मुख्य आँकड़े।', oneLine: 'आज एक पंक्ति में', weekAhead: 'आने वाला हफ्ता।', percent: 'प्रतिशत', disclaimerShort: 'अस्वीकरण',
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
  calendar: 'M4 6h16v14H4z M4 10h16 M8 3v4 M16 3v4', speaker: 'M4 9v6h4l5 4V5L8 9z M16 9a4 4 0 010 6 M18.5 6.5a8 8 0 010 11', stop: 'M6 6h12v12H6z', next: 'M5 5v14l9-7z M17 5v14'
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
function dirPill(d) { const c = dirCls(d); return h('span', { class: 'pill ' + c }, h('span', { 'aria-hidden': 'true' }, DIR_MARK[c]), t('dir')[d] || d); }
function confEl(c) { const n = { High: 3, Medium: 2, Low: 1 }[c] || 0; return h('span', { class: 'conf' }, t('confidence'), h('b', { 'aria-hidden': 'true' }, '●'.repeat(n) + '○'.repeat(3 - n)), h('span', null, t('conf')[c] || c)); }
function speakBtn(item) { if (!canSpeak) return null; return h('button', { class: 'icon-btn', 'aria-label': t('listenThis'), onclick: () => startTTS([item]) }, icon(IC.speaker), t('listenThis')); }

function topbar() {
  return h('header', { class: 'top' },
    h('div', { class: 'brand' }, logo(), h('span', null, t('brand'))),
    h('div', { class: 'seg', role: 'group', 'aria-label': 'Language' },
      h('button', { 'aria-pressed': S.lang === 'en', lang: 'en', onclick: () => setLang('en') }, 'English'),
      h('button', { 'aria-pressed': S.lang === 'hi', lang: 'hi', onclick: () => setLang('hi') }, 'हिन्दी')));
}
function freshness() {
  const iso = meta('updated_at'); const age = (Date.now() - new Date(iso)) / 36e5; let label, cls = 'ok';
  if (S.refreshing) label = t('refreshing'); else if (S.source === 'cache') { label = t('offline'); cls = 'warn'; }
  else if (isNaN(age) || age <= 36) label = t('fresh'); else { label = t('stale')(Math.max(1, Math.round(age / 24))); cls = 'warn'; }
  return h('p', { class: 'fresh', 'aria-live': 'polite' }, h('span', { class: 'chip ' + cls }, label), h('span', null, t('updated') + ' ' + fmtUpdated(iso)));
}
function band(sc) {
  return h('div', { class: 'band-wrap' },
    h('p', { class: 'band-title' }, t('weekCould')),
    h('div', { class: 'band' + (S.intro ? ' intro' : ''), role: 'group', 'aria-label': t('weekCould') }, sc.map(s => h('button', { class: 'bseg ' + biasCls(s.bias), style: 'flex:' + s.p + ' 1 0', 'aria-label': L(s, 'scenario') + ', ' + s.p + '%', onclick: () => go('outlook') }, s.p + '%'))),
    h('ul', { class: 'band-legend' }, sc.map(s => h('li', null, h('i', { class: 'dot ' + biasCls(s.bias) }), h('span', null, L(s, 'scenario'))))),
    h('p', { class: 'band-hint' }, t('tapBand')));
}
function hero() {
  const sc = scenarios(); const noHi = S.lang === 'hi' && TTS.voicesLoaded && !voiceFor('hi');
  return h('section', { class: 'hero' },
    h('p', { class: 'hero-date' }, fmtDate(meta('brief_date'), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })),
    h('h1', { class: 'hero-line' }, meta('today_in_one_line')),
    h('p', { class: 'hero-meta' }, meta('market_status')),
    sc.length ? band(sc) : null,
    freshness(),
    canSpeak ? h('button', { class: 'listen', onclick: () => (TTS.on ? stopTTS() : startTTS(briefingItems())) }, icon(TTS.on ? IC.stop : IC.speaker), TTS.on ? t('stop') : t('listen')) : h('p', { class: 'hint' }, t('noSpeech')),
    noHi ? h('p', { class: 'hint' }, t('noVoiceHi')) : null);
}
function pulse() {
  return h('section', { class: 'pulse', 'aria-label': t('numbers') },
    h('div', { class: 'pulse-row', tabindex: '0' }, rows('Pulse').map(r => h('div', { class: 'pt' },
      h('p', { class: 'pt-l' }, L(r, 'label')), h('p', { class: 'pt-v' }, r.value), h('p', { class: 'pt-c' }, L(r, 'change')), h('p', { class: 'pt-a' }, fmtAsOf(r.as_of))))));
}
function chipRow(options, current, onPick, labelFn) {
  return h('div', { class: 'chips' }, options.map(o => h('button', { class: 'fc', 'aria-pressed': o === current, onclick: () => onPick(o) }, labelFn(o))));
}
function viewBrief() {
  const items = rows('Brief'); const cats = ['All', ...new Set(items.map(i => i.category))];
  const list = items.filter(i => S.fCat === 'All' || i.category === S.fCat);
  return h('section', null,
    h('h2', { class: 'vh' }, t('h').brief),
    chipRow(cats, S.fCat, c => { S.fCat = c; render(); }, c => (c === 'All' ? t('all') : catName(c))),
    h('div', { class: 'list' }, list.map(it => h('article', { class: 'item', id: 'brief-' + it.id },
      h('div', { class: 'item-top' }, h('span', { class: 'cat' }, catName(it.category)), dirPill(it.impact)),
      h('h3', { class: 'item-h' }, L(it, 'headline')),
      h('p', { class: 'item-p' }, L(it, 'summary')),
      tags(it).length ? h('ul', { class: 'tags' }, tags(it).map(x => h('li', null, x))) : null,
      h('div', { class: 'foot' },
        safeUrl(it.source_url) ? h('a', { href: safeUrl(it.source_url), target: '_blank', rel: 'noopener noreferrer' }, it.source_name || t('report')) : h('span', null, it.source_name),
        confEl(it.confidence), h('span', null, t('basis')[it.basis] || it.basis),
        speakBtn({ title: L(it, 'headline'), text: L(it, 'headline') + '. ' + L(it, 'summary') }))))));
}
function impactList() {
  const q = S.q.trim().toLowerCase();
  const list = rows('Impacts').filter(r => (S.fDir === 'All' || r.direction === S.fDir) && (!q || [r.entity_en, r.entity_hi, r.companies, r.driver_en, r.driver_hi].join(' ').toLowerCase().includes(q)));
  if (!list.length) return h('div', { class: 'list', id: 'impact-list' }, h('p', { class: 'empty' }, t('noResults')));
  return h('div', { class: 'list', id: 'impact-list' }, list.map(r => h('article', { class: 'item' },
    h('div', { class: 'item-top' }, h('h3', { class: 'item-h', style: 'margin:0' }, L(r, 'entity')), dirPill(r.direction)),
    r.companies ? h('p', { class: 'companies' }, r.companies) : null,
    h('p', { class: 'item-p' }, L(r, 'driver')),
    h('div', { class: 'foot' }, h('span', null, L(r, 'horizon')), confEl(r.confidence),
      (r.news_ids || '').split(',').filter(Boolean).length ? h('span', null, t('basedOn') + ' ', (r.news_ids.split(',').map(s => s.trim()).filter(Boolean)).map((id, i) => [i ? ', ' : '', h('button', { class: 'link-chip', onclick: () => goBrief(id) }, t('report') + ' ' + id)])) : null,
      speakBtn({ title: L(r, 'entity'), text: L(r, 'entity') + '. ' + L(r, 'driver') })))));
}
function viewImpact() {
  const input = h('input', { class: 'search', type: 'search', placeholder: t('searchPH'), 'aria-label': t('searchPH'), value: S.q });
  input.addEventListener('input', () => { S.q = input.value; const old = $('#impact-list'); if (old) old.replaceWith(impactList()); });
  return h('section', null, h('h2', { class: 'vh' }, t('h').impact), input,
    chipRow(['All', 'Positive', 'Negative', 'Mixed'], S.fDir, d => { S.fDir = d; render(); }, d => (d === 'All' ? t('all') : t('dir')[d])), impactList());
}
function viewOutlook() {
  const sc = scenarios(); const o = rows('Outlook')[0];
  return h('section', null, h('h2', { class: 'vh' }, t('h').outlook), o ? h('p', { class: 'vsub' }, L(o, 'horizon')) : null,
    meta('outlook_note') ? h('div', { class: 'note' }, h('strong', null, t('howRead')), meta('outlook_note')) : null,
    sc.map(s => h('article', { class: 'sc' },
      h('div', { class: 'sc-head' }, h('div', { class: 'sc-p', 'aria-label': s.p + '% ' + t('chance') }, s.p, h('small', null, '%')),
        h('div', null, h('h3', { class: 'sc-n' }, L(s, 'scenario')), h('span', { class: 'pill ' + biasCls(s.bias) }, h('span', { 'aria-hidden': 'true' }, DIR_MARK[biasCls(s.bias)]), t('bias')[s.bias] || s.bias))),
      h('div', { class: 'bar', 'aria-hidden': 'true' }, h('i', { class: biasCls(s.bias), style: 'width:' + s.p + '%' })),
      h('p', null, L(s, 'what')), h('p', { class: 'watch' }, h('b', null, t('watch') + ': '), L(s, 'watch')),
      speakBtn({ title: L(s, 'scenario'), text: s.p + ' ' + t('percent') + '. ' + L(s, 'scenario') + '. ' + L(s, 'what') }))));
}
function viewCalendar() {
  const y = new Date(); y.setDate(y.getDate() - 1); const cut = y.getFullYear() + '-' + String(y.getMonth() + 1).padStart(2, '0') + '-' + String(y.getDate()).padStart(2, '0');
  const list = rows('Calendar').filter(r => r.date >= cut).sort((a, b) => (a.date + a.time_ist).localeCompare(b.date + b.time_ist));
  return h('section', null, h('h2', { class: 'vh' }, t('h').calendar),
    list.length ? h('div', { class: 'list' }, list.map(e => h('article', { class: 'ev' },
      h('div', { class: 'ev-d' }, h('b', null, fmtDate(e.date, { day: 'numeric' })), h('span', null, fmtDate(e.date, { month: 'short' }))),
      h('div', null, h('h3', null, L(e, 'event')), h('p', { class: 't' }, fmtDate(e.date, { weekday: 'long' }) + (e.time_ist ? ', ' + e.time_ist + ' IST' : '')), h('p', null, L(e, 'why')),
        safeUrl(e.source_url) ? h('div', { class: 'foot' }, h('a', { href: safeUrl(e.source_url), target: '_blank', rel: 'noopener noreferrer' }, e.source_name || t('report'))) : null)))) : h('p', { class: 'empty' }, t('noCal')));
}
function nav() {
  const items = [['brief', IC.brief], ['impact', IC.impact], ['outlook', IC.outlook], ['calendar', IC.calendar]];
  return h('nav', { class: 'nav', 'aria-label': 'Sections' }, h('div', { class: 'nav-in' }, items.map(([k, d]) => h('button', { 'aria-current': S.tab === k ? 'page' : null, onclick: () => go(k) }, icon(d), t('tabs')[k]))));
}
function footer() {
  return h('footer', { class: 'foot-note' }, h('p', null, meta('disclaimer')), h('p', null, meta('sources_note')), h('p', null, h('a', { href: SHEET_URL, target: '_blank', rel: 'noopener noreferrer' }, t('dataSheet')), ' · ' + t('footer')));
}
function player() {
  const it = TTS.items[TTS.idx];
  return h('div', { class: 'player', id: 'player', hidden: !TTS.on, role: 'region', 'aria-label': t('nowReading') },
    h('div', { class: 'pn' }, h('small', null, t('nowReading') + (TTS.items.length > 1 ? ' ' + (TTS.idx + 1) + '/' + TTS.items.length : '')), h('strong', null, it ? it.title : '')),
    TTS.items.length > 1 ? h('button', { onclick: nextTTS, 'aria-label': t('next') }, icon(IC.next), t('next')) : null,
    h('button', { class: 'rate', onclick: cycleRate, 'aria-label': 'Speed' }, t('speeds')[TTS.rateIdx]),
    h('button', { onclick: stopTTS, 'aria-label': t('stop') }, icon(IC.stop), t('stop')));
}
function view() { return { brief: viewBrief, impact: viewImpact, outlook: viewOutlook, calendar: viewCalendar }[S.tab](); }
function render() {
  document.documentElement.lang = S.lang; document.title = t('brand');
  const app = $('#app'); const y = window.scrollY; let body;
  if (!S.data) body = S.loading || !S.error ? [h('p', { class: 'boot', role: 'status' }, t('loading'))]
    : [h('div', { class: 'err' }, h('h2', null, t('loadFail')), h('p', null, t('loadFailHelp')), h('button', { class: 'btn', onclick: load }, t('retry')))];
  else body = [hero(), pulse(), view(), footer()];
  app.replaceChildren(topbar(), ...body, ...(S.data ? [nav(), player()] : []));
  if (S.data) S.intro = false; // the scenario bar grows in once, on the first screen with data
  window.scrollTo(0, y);
}
function go(tab) { S.tab = tab; render(); window.scrollTo(0, 0); }
function goBrief(id) { S.tab = 'brief'; S.fCat = 'All'; render(); requestAnimationFrame(() => { const el = document.getElementById('brief-' + id); if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('flash'); } }); }
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
function speakItem(i, tok) {
  if (tok !== TTS.tok) return;
  if (i >= TTS.items.length) { stopTTS(); return; }
  TTS.idx = i; updatePlayer(); const parts = chunk(TTS.items[i].text); let k = 0; const lang = S.lang;
  const step = () => {
    if (tok !== TTS.tok) return;
    if (k >= parts.length) { speakItem(i + 1, tok); return; }
    const u = new SpeechSynthesisUtterance(parts[k++]); u.lang = lang === 'hi' ? 'hi-IN' : 'en-IN'; const v = voiceFor(lang); if (v) u.voice = v; u.rate = RATES[TTS.rateIdx];
    u.onend = step; u.onerror = e => { if (e && (e.error === 'canceled' || e.error === 'interrupted')) return; step(); };
    speechSynthesis.speak(u);
  };
  step();
}
function startTTS(items) { if (!canSpeak || !items.length) return; speechSynthesis.cancel(); TTS.tok++; TTS.on = true; TTS.items = items; TTS.idx = 0; render(); speakItem(0, TTS.tok); }
function stopTTS() { if (!canSpeak) return; TTS.tok++; speechSynthesis.cancel(); const was = TTS.on; TTS.on = false; TTS.items = []; TTS.idx = 0; if (was && S.data) render(); }
function nextTTS() { if (!TTS.on) return; const tok = ++TTS.tok; speechSynthesis.cancel(); speakItem(TTS.idx + 1, tok); }
function cycleRate() { TTS.rateIdx = (TTS.rateIdx + 1) % 3; try { localStorage.setItem(LS.rate, String(TTS.rateIdx)); } catch (e) {} updatePlayer(); }
function updatePlayer() { const old = $('#player'); if (old) old.replaceWith(player()); }
function firstSentence(s) { const m = /^.*?[.।](\s|$)/.exec(s || ''); return m ? m[0].trim() : s; }
function briefingItems() {
  const items = []; const D = meta('brief_date');
  items.push({ title: t('brand'), text: t('brand') + '. ' + fmtDate(D, { weekday: 'long', day: 'numeric', month: 'long' }) + '.' });
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
window.addEventListener('pagehide', () => { if (canSpeak) speechSynthesis.cancel(); });
try { const c = JSON.parse(localStorage.getItem(LS.cache)); if (c && c.data) { S.data = c.data; S.source = 'cache'; } } catch (e) {}
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !params.get('local')) navigator.serviceWorker.register('sw.js').catch(() => {});
load();
})();

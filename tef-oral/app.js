'use strict';
/* TEF Oral Studio — application. Contenu dans data.js, styles dans style.css. */

/* ============================================================
   Utilitaires
   ============================================================ */
const root = document.getElementById('root');
const h = (tag, a = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const k in a) {
    const v = a[k];
    if (v === false || v == null) continue;
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(2)) {
    if (c == null || c === false) continue;
    e.append(c.nodeType ? c : document.createTextNode(c));
  }
  return e;
};
const ICONS = {
  play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none"/>',
  pause: '<rect x="6.5" y="5" width="4" height="14" rx="1.2" fill="currentColor" stroke="none"/><rect x="13.5" y="5" width="4" height="14" rx="1.2" fill="currentColor" stroke="none"/>',
  prev: '<path d="M18 6.5v11l-8-5.5z" fill="currentColor" stroke="none"/><path d="M6.5 6v12"/>',
  next: '<path d="M6 6.5v11l8-5.5z" fill="currentColor" stroke="none"/><path d="M17.5 6v12"/>',
  replay: '<path d="M4 12a8 8 0 1 0 2.6-5.9"/><path d="M4 4.5v4.5h4.5"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
  stop: '<rect x="6.5" y="6.5" width="11" height="11" rx="2" fill="currentColor" stroke="none"/>',
  star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9L3.5 9.7l5.9-.8z"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.8v.1"/>',
  more: '<circle cx="5.5" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.5" fill="currentColor" stroke="none"/>',
  list: '<path d="M9 6.5h11M9 12h11M9 17.5h11M4.5 6.5h.1M4.5 12h.1M4.5 17.5h.1"/>',
  caption: '<rect x="3" y="5" width="18" height="14" rx="3.5"/><path d="M7 11h4M13 11h4M7 15h7"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  phones: '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="14" width="4.5" height="6.5" rx="1.8"/><rect x="16.5" y="14" width="4.5" height="6.5" rx="1.8"/>',
  sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  minus: '<path d="M5 12h14"/>',
  loop: '<path d="M17 3l3 3-3 3"/><path d="M4 11V9a3 3 0 0 1 3-3h13"/><path d="M7 21l-3-3 3-3"/><path d="M20 13v2a3 3 0 0 1-3 3H4"/>'
};
const ico = (n, s = 22) => {
  const e = document.createElement('span');
  e.className = 'ico';
  e.innerHTML = `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]}</svg>`;
  return e;
};
const ls = {
  get: (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  del: k => { try { localStorage.removeItem(k); } catch (e) {} }
};
const fmt = s => { s = Math.max(0, s | 0); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let toastT;
function toast(m) {
  let t = document.getElementById('toast');
  if (!t) { t = h('div', { id: 'toast', class: 'toast', role: 'status', 'aria-live': 'polite' }); document.body.append(t); }
  t.textContent = m; t.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2600);
}
const exName = t => (t.section === 'B' ? 'Ton ami' : 'Examinateur');
function noteEl(note, cls) {
  if (!note) return null;
  const warn = note.startsWith('⚠');
  return h('p', { class: cls + (warn ? ' warn' : '') }, warn ? 'À corriger : ' + note.slice(1).trim() : 'À retenir : ' + note);
}

/* ============================================================
   Stockage : audio (IndexedDB), réglages, progression, phrases
   ============================================================ */
function idb() { return new Promise((res, rej) => { const r = indexedDB.open('tef-oral', 1); r.onupgradeneeded = () => r.result.createObjectStore('audio'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
async function putAudio(id, blob) { const db = await idb(); return new Promise((res, rej) => { const tx = db.transaction('audio', 'readwrite'); tx.objectStore('audio').put(blob, id); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); }
async function getAudio(id) { const db = await idb(); return new Promise((res, rej) => { const r = db.transaction('audio').objectStore('audio').get(id); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
async function delAudio(id) { const db = await idb(); return new Promise((res, rej) => { const tx = db.transaction('audio', 'readwrite'); tx.objectStore('audio').delete(id); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); }
function audioIds() {
  const work = (async () => { try { const db = await idb(); return await new Promise(res => { const r = db.transaction('audio').objectStore('audio').getAllKeys(); r.onsuccess = () => res(r.result || []); r.onerror = () => res([]); }); } catch (e) { return []; } })();
  return Promise.race([work, new Promise(res => setTimeout(() => res([]), 1200))]);
}
let HAVE = new Set();

const DEF = { theme: 'auto', size: 1, view: 'fr', exVoice: '', caVoice: '' };
let SET = Object.assign({}, DEF, ls.get('tef.set', {}));
function applySettings() {
  document.documentElement.dataset.theme = SET.theme;
  document.documentElement.style.setProperty('--cap', SET.size);
  const dark = SET.theme === 'dark' || (SET.theme === 'auto' && !matchMedia('(prefers-color-scheme: light)').matches);
  let m = document.querySelector('meta[name=theme-color]');
  if (m) m.content = dark ? '#0D1B2A' : '#F2F5F8';
}
const saveSet = () => { ls.set('tef.set', SET); applySettings(); };

const today = () => new Date().toLocaleDateString('en-CA');
let STATS = Object.assign({ days: {}, heard: {}, last: null }, ls.get('tef.stats', {}));
const saveStats = () => ls.set('tef.stats', STATS);
function markHeard(t, i) {
  const n = t.lines.length;
  let s = STATS.heard[t.id] || '';
  if (s.length !== n) s = s.padEnd(n, '0').slice(0, n);
  if (s[i] !== '1') { s = s.slice(0, i) + '1' + s.slice(i + 1); STATS.heard[t.id] = s; }
  const d = today(); STATS.days[d] = (STATS.days[d] || 0) + 1;
  STATS.last = { id: t.id, idx: i };
  saveStats();
}
function heardStr(t) { const n = t.lines.length; return (STATS.heard[t.id] || '').padEnd(n, '0').slice(0, n); }
function pct(t) { const s = heardStr(t); return Math.round(100 * [...s].filter(c => c === '1').length / t.lines.length); }
function streak() {
  let n = 0; const d = new Date();
  if (!(STATS.days[d.toLocaleDateString('en-CA')] > 0)) d.setDate(d.getDate() - 1);
  while (STATS.days[d.toLocaleDateString('en-CA')] > 0) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
let STARS = ls.get('tef.stars', []);
const isStar = (id, i) => STARS.some(s => s.t === id && s.i === i);
function toggleStar(id, i) {
  if (isStar(id, i)) STARS = STARS.filter(s => !(s.t === id && s.i === i));
  else STARS.push({ t: id, i });
  ls.set('tef.stars', STARS);
}

/* ============================================================
   Pistes
   ============================================================ */
let TRACKS = [];
const norm = t => Object.assign({}, t, { lines: t.lines.map(l => ({ s: l[0] === 'E' ? 'ex' : 'ca', fr: l[1], en: l[2], note: l[3] || '' })) });
function loadTracks() { TRACKS = DATA.map(norm).concat(ls.get('tef.custom', []).map(t => Object.assign({}, t, { custom: true }))); }
const trackById = id => { if (!TRACKS.length) loadTracks(); return TRACKS.find(t => t.id === id); };

function charLayout(t) {
  const w = t.lines.map(l => l.fr.length + 8), tot = w.reduce((a, b) => a + b, 0);
  let c = 0; const b = w.map(x => { const v = c / tot; c += x; return v; }); b.push(1);
  return t.lines.map((_, i) => ({ l: b[i] * 100, w: Math.max(.5, (b[i + 1] - b[i]) * 100) }));
}
function timeLayout(t, starts, dur, off) {
  const b = starts.map(s => Math.max(0, Math.min(1, (s - off) / dur))); b.push(1);
  return t.lines.map((_, i) => ({ l: b[i] * 100, w: Math.max(.35, (b[i + 1] - b[i]) * 100) }));
}
function buildScore(t, lay) {
  const N = 72, el = h('div', { class: 'wave' });
  const mk = () => {
    const c = h('div', { class: 'bars' });
    for (let k = 0; k < N; k++) {
      const x = (k + .5) / N * 100; let li = lay.length - 1;
      for (let i = 0; i < lay.length; i++) if (x >= lay[i].l && x < lay[i].l + lay[i].w) { li = i; break; }
      let v;
      if (t.peaks) v = t.peaks[Math.min(t.peaks.length - 1, Math.floor(k / N * t.peaks.length))] / 100;
      else { const r = Math.abs(Math.sin(k * 12.9898 + li * 78.233) * 43758.5453) % 1; v = .3 + .7 * r; }
      const bar = h('i', { class: t.lines[li].s });
      bar.style.height = Math.round(18 + 82 * v) + '%';
      c.append(bar);
    }
    return c;
  };
  el.append(mk(), Object.assign(mk(), { className: 'bars lit' }), h('div', { class: 'head', id: 'head' }));
  return el;
}

/* ============================================================
   Navigation (hash) et barre d'onglets
   ============================================================ */
function tabs(active) {
  const a = (id, href, icon, label) => h('a', { href, 'aria-current': active === id ? 'page' : null }, ico(icon, 24), label);
  return h('nav', { class: 'tabs', 'aria-label': 'Navigation principale' },
    a('home', '#/', 'phones', 'Exercices'), a('phrases', '#/phrases', 'star', 'Phrases'), a('set', '#/reglages', 'sliders', 'Réglages'));
}
function route() {
  leavePlayer();
  closeSheets();
  const parts = (location.hash.slice(1) || '/').split('/').filter(Boolean);
  const [a, b] = parts;
  if (a === 't' && b) renderPlayer(decodeURIComponent(b));
  else if (a === 'phrases') renderPhrases();
  else if (a === 'reglages') renderSettings();
  else if (a === 'nouveau') renderAdd();
  else renderHome();
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);

/* ============================================================
   Accueil
   ============================================================ */
const chip = (txt, hot) => h('span', { class: 'chipm' + (hot ? ' hot' : '') }, txt);
function sectionBlock(sec, title, sub) {
  const list = TRACKS.filter(t => t.section === sec);
  const wrap = h('section', { class: 'sec' },
    h('div', { class: 'sec-head' }, h('span', { class: 'badge' }, sec), h('div', {}, h('h2', { class: 'sec-title' }, title), h('p', { class: 'sec-sub' }, sub))));
  if (!list.length) wrap.append(h('p', { class: 'sec-sub' }, 'Aucun exercice pour l’instant.'));
  list.forEach(t => {
    const p = pct(t), real = HAVE.has(t.id) || !!t.audioUrl;
    wrap.append(h('a', { class: 'card', href: '#/t/' + encodeURIComponent(t.id) },
      h('div', { class: 't' }, t.title),
      h('div', { class: 'chips' }, chip(`${t.lines.length} répliques`), chip(`≈ ${t.est} min`), chip(real ? 'Audio réel' : 'Voix de l’appareil', real)),
      h('div', { class: 'pline' }, h('div', { class: 'pbar' }, h('i', { style: 'width:' + p + '%' })), h('span', {}, p ? p + ' %' : 'Nouveau'))));
  });
  return wrap;
}
function renderHome() {
  loadTracks(); document.title = 'TEF Oral Studio';
  const st = streak();
  const last = STATS.last && trackById(STATS.last.id);
  const bars = [.4, .7, .5, .9, .6, .8, .35, .65].map((v, i) => h('i', { class: i % 3 === 1 ? 'y' : '', style: `height:${v * 100}%` }));
  const page = h('main', { class: 'page' },
    h('header', { class: 'hero' },
      h('div', { class: 'logo', 'aria-hidden': 'true' }, ...bars),
      h('h1', {}, 'TEF Oral Studio'),
      h('p', {}, 'Écoute, lis, répète. Des dialogues au niveau NCLC 7.'),
      st > 0 ? h('span', { class: 'streak' }, st === 1 ? 'Pratiqué aujourd’hui' : `${st} jours de suite`) : null),
    last ? h('a', { class: 'resume', href: '#/t/' + encodeURIComponent(last.id) },
      h('div', { class: 'rt' }, h('span', { class: 'k' }, 'Reprendre'), h('div', { class: 't' }, last.title),
        h('div', { class: 'm' }, `Réplique ${Math.min(last.lines.length, STATS.last.idx + 1)} sur ${last.lines.length}`),
        h('div', { class: 'pbar' }, h('i', { style: 'width:' + Math.round(100 * (STATS.last.idx + 1) / last.lines.length) + '%' }))),
      h('span', { class: 'go' }, ico('play', 26))) : null,
    sectionBlock('A', 'Obtenir des informations', 'Tu téléphones pour te renseigner sur une annonce.'),
    sectionBlock('B', 'Convaincre', 'Tu persuades un ami qui hésite.'),
    h('a', { class: 'btn line add-link', href: '#/nouveau' }, ico('plus', 20), 'Ajouter un exercice'));
  root.replaceChildren(page, tabs('home'));
}

/* ============================================================
   Phrases enregistrées
   ============================================================ */
let ttsOnly = null;
function speakOnce(text, who) {
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text), v = voiceFor(who || 'ex');
    if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'fr-CA';
    u.rate = .92; speechSynthesis.speak(u);
  } catch (e) { toast('La voix n’est pas disponible sur cet appareil.'); }
}
function renderPhrases() {
  loadTracks(); document.title = 'Phrases — TEF Oral Studio';
  const items = STARS.map(s => { const t = trackById(s.t); return t && t.lines[s.i] ? { t, i: s.i, l: t.lines[s.i] } : null; }).filter(Boolean);
  const page = h('main', { class: 'page' },
    h('header', { class: 'hero' }, h('h1', {}, 'Mes phrases'), h('p', {}, 'Les répliques que tu veux réutiliser à l’examen.')));
  if (!items.length) page.append(h('div', { class: 'empty' }, 'Touche l’étoile sous une réplique pour la garder ici.'));
  else {
    const list = h('div', { style: 'margin-top:18px' });
    items.forEach(it => {
      const row = h('div', { class: 'pb-item' },
        h('div', { class: 'b', onclick: () => row.classList.toggle('open') },
          h('div', { class: 'f fr' }, it.l.fr), h('div', { class: 'e' }, it.l.en || '—'), h('div', { class: 'pb-from' }, it.t.title)),
        h('button', { class: 'icon-btn', 'aria-label': 'Écouter', onclick: () => speakOnce(it.l.fr, it.l.s) }, ico('play', 20)),
        h('button', { class: 'icon-btn', 'aria-label': 'Retirer des phrases', onclick: () => { toggleStar(it.t.id, it.i); row.remove(); if (!ls.get('tef.stars', []).length) renderPhrases(); } }, ico('x', 20)));
      list.append(row);
    });
    page.append(list, h('p', { class: 'hint' }, 'Touche une phrase pour voir l’anglais.'),
      h('button', { class: 'btn line', style: 'margin-top:14px', onclick: () => { const txt = items.map(i => i.l.fr + '\n' + (i.l.en || '')).join('\n\n'); (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => toast('Phrases copiées'), () => toast('Copie impossible ici.')); } }, 'Copier toutes les phrases'));
  }
  root.replaceChildren(page, tabs('phrases'));
}

/* ============================================================
   Réglages
   ============================================================ */
function renderSettings() {
  document.title = 'Réglages — TEF Oral Studio';
  loadVoices();
  const sample = h('p', { class: 'sample fr' }, 'Je vous appelle au sujet de l’annonce.');
  const group = (title, ...rows) => h('section', { class: 'set-group' }, h('h2', {}, title), ...rows);
  const segOf = (opts, cur, on) => {
    const s = h('div', { class: 'seg', role: 'group' });
    opts.forEach(([v, l]) => s.append(h('button', { 'aria-pressed': String(cur === v), onclick: e => { on(v); [...s.children].forEach(b => b.setAttribute('aria-pressed', 'false')); e.currentTarget.setAttribute('aria-pressed', 'true'); } }, l)));
    return s;
  };
  const voiceSel = (key, who) => {
    const s = h('select', { 'aria-label': who === 'ex' ? 'Voix de l’examinateur' : 'Ta voix', onchange: e => { SET[key] = e.target.value; saveSet(); speakOnce('Bonjour, je vous appelle au sujet de l’annonce.', who); } },
      h('option', { value: '' }, 'Automatique'));
    VOICES.forEach(v => s.append(h('option', Object.assign({ value: v.name }, SET[key] === v.name ? { selected: true } : {}), `${v.name} (${v.lang})`)));
    return s;
  };
  const page = h('main', { class: 'page' },
    h('header', { class: 'hero' }, h('h1', {}, 'Réglages')),
    group('Affichage',
      h('div', { class: 'set-row' }, h('label', {}, 'Thème'), segOf([['auto', 'Auto'], ['light', 'Clair'], ['dark', 'Sombre']], SET.theme, v => { SET.theme = v; saveSet(); })),
      h('div', { class: 'set-row' }, h('label', {}, 'Taille du texte'), segOf([['.88', 'Petit'], ['1', 'Normal'], ['1.15', 'Grand'], ['1.3', 'Très grand']], String(SET.size), v => { SET.size = +v; saveSet(); }), sample),
      h('div', { class: 'set-row' }, h('label', {}, 'Texte au lancement'), segOf([['listen', 'Écoute'], ['fr', 'Français'], ['both', 'FR + EN']], SET.view, v => { SET.view = v; saveSet(); }),
        h('p', { class: 'sh-note' }, 'Écoute floute le français jusqu’à ce que tu le touches. Idéal pour s’entraîner sans lire.'))),
    group('Voix de l’appareil',
      h('div', { class: 'set-row' }, h('label', {}, 'Examinateur ou ami'), voiceSel('exVoice', 'ex')),
      h('div', { class: 'set-row' }, h('label', {}, 'Ta voix modèle'), voiceSel('caVoice', 'ca'),
        VOICES.length ? null : h('p', { class: 'sh-note' }, 'Aucune voix française trouvée. Sur iPhone : Réglages, Accessibilité, Contenu énoncé, Voix.'))),
    group('Données',
      h('div', { class: 'set-row' }, h('button', { class: 'btn line block danger', onclick: () => { if (confirm('Effacer la progression et les phrases enregistrées ?')) { STATS = { days: {}, heard: {}, last: null }; saveStats(); STARS = []; ls.set('tef.stars', []); toast('Progression effacée'); } } }, 'Effacer ma progression'),
        h('p', { class: 'sh-note' }, 'Tes audios, tes phrases et ta progression restent sur cet appareil. Rien n’est envoyé nulle part.'))));
  root.replaceChildren(page, tabs('set'));
}

/* ============================================================
   Ajouter un exercice
   ============================================================ */
function parseScript(txt) {
  const out = [];
  for (const raw of txt.split('\n')) {
    const m = raw.trim().match(/^([EV]):\s*(.*)$/i); if (!m) continue;
    const p = m[2].split('|'); const fr = p[0].trim(), en = (p[1] || '').trim();
    if (fr) out.push({ s: m[1].toUpperCase() === 'E' ? 'ex' : 'ca', fr, en, note: '' });
  }
  return out;
}
function renderAdd() {
  document.title = 'Nouvel exercice — TEF Oral Studio';
  const title = h('input', { type: 'text', id: 'f-title', placeholder: 'Ex. Section B, convaincre : télétravail' });
  const sec = h('select', { id: 'f-sec' }, h('option', { value: 'A' }, 'Section A, obtenir des informations'), h('option', { value: 'B' }, 'Section B, convaincre'));
  const task = h('textarea', { id: 'f-task', style: 'min-height:90px', placeholder: 'La consigne de l’examen (facultatif)' });
  const txt = h('textarea', { id: 'f-txt', placeholder: 'E: Bonjour, que puis-je faire pour vous? | Hello, how can I help you?\nV: Bonjour, je vous appelle au sujet de… | Hello, I’m calling about…' });
  const field = (l, id, el, note) => h('div', { class: 'field' }, h('label', { for: id }, l), el, note ? h('p', { class: 'sh-note' }, note) : null);
  const page = h('main', { class: 'page' },
    h('div', { class: 'back-row' }, h('a', { class: 'icon-btn', href: '#/', 'aria-label': 'Retour' }, ico('back'))),
    h('header', { class: 'hero' }, h('h1', {}, 'Nouvel exercice'), h('p', {}, 'Colle ton script, puis joins ton fichier audio depuis le lecteur.')),
    field('Titre', 'f-title', title), field('Section', 'f-sec', sec), field('Consigne', 'f-task', task),
    field('Script', 'f-txt', txt, 'Une réplique par ligne. Commence par E: pour l’examinateur ou V: pour toi, puis le français, une barre verticale |, puis l’anglais.'),
    h('div', { style: 'margin-top:22px' }, h('button', { class: 'btn fill block', onclick: () => {
      const lines = parseScript(txt.value);
      if (!title.value.trim() || lines.length < 2) { toast('Ajoute un titre et au moins deux répliques.'); return; }
      const list = ls.get('tef.custom', []); const id = 'c-' + Date.now();
      list.push({ id, section: sec.value, title: title.value.trim(), kind: sec.value === 'A' ? 'Section A' : 'Section B', task: task.value.trim(), phrases: [], lines, est: Math.max(2, Math.round(lines.reduce((a, l) => a + l.fr.length, 0) / 900)) });
      ls.set('tef.custom', list); toast('Exercice ajouté'); location.hash = '#/t/' + encodeURIComponent(id);
    } }, 'Enregistrer l’exercice')));
  root.replaceChildren(page);
}

/* ============================================================
   Feuilles (bottom sheets)
   ============================================================ */
function closeSheets() { document.querySelectorAll('.sheet,.backdrop').forEach(e => e.remove()); }
function sheet(title, body) {
  closeSheets();
  const close = () => { bd.classList.remove('on'); sh.classList.remove('on'); setTimeout(() => { bd.remove(); sh.remove(); }, 320); };
  const bd = h('div', { class: 'backdrop', onclick: close });
  const sh = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div', { class: 'grab' }),
    h('div', { class: 'sh-head' }, h('h2', {}, title), h('button', { class: 'icon-btn', 'aria-label': 'Fermer', onclick: close }, ico('x'))), body);
  document.body.append(bd, sh);
  requestAnimationFrame(() => { bd.classList.add('on'); sh.classList.add('on'); });
  return { close };
}

/* ============================================================
   Voix de l'appareil
   ============================================================ */
let VOICES = [];
function loadVoices() { try { VOICES = speechSynthesis.getVoices().filter(v => v.lang.toLowerCase().startsWith('fr')); } catch (e) {} }
if ('speechSynthesis' in window) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
function voiceFor(s) {
  if (!VOICES.length) loadVoices(); if (!VOICES.length) return null;
  const want = SET[s === 'ex' ? 'exVoice' : 'caVoice']; const named = want && VOICES.find(v => v.name === want); if (named) return named;
  const fem = /am[ée]lie|chantal|audrey|aur[ée]lie|marie|julie|virginie|denise|sylvie|c[ée]line|female|femme/i;
  const mal = /thomas|nicolas|jacques|daniel|henri|antoine|male|homme|paul/i;
  const ca = VOICES.filter(v => /ca/i.test(v.lang));
  const pool = ca.length ? ca.concat(VOICES.filter(v => !ca.includes(v))) : VOICES;
  if (s === 'ex') return pool.find(v => fem.test(v.name)) || pool[0];
  return pool.find(v => mal.test(v.name)) || VOICES.find(v => !fem.test(v.name)) || pool[pool.length > 1 ? 1 : 0];
}

/* ============================================================
   Lecteur
   ============================================================ */
let P = null;
const $p = s => root.querySelector(s);

function leavePlayer() {
  if (!P) return;
  try { speechSynthesis.cancel(); } catch (e) {}
  cancelAnimationFrame(P.raf);
  if (P.audio) { P.audio.pause(); P.audio.src = ''; }
  if (P.url && P.url.startsWith('blob:')) URL.revokeObjectURL(P.url);
  if (P.rec && P.rec.mr && P.rec.state === 'rec') { try { P.rec.mr.stop(); } catch (e) {} }
  if (P.rec && P.rec.url) URL.revokeObjectURL(P.rec.url);
  unlock(); P = null;
}
async function lock() { try { if ('wakeLock' in navigator && P && !P.wl) P.wl = await navigator.wakeLock.request('screen'); } catch (e) {} }
function unlock() { try { P && P.wl && P.wl.release(); } catch (e) {} if (P) P.wl = null; }
function mediaSession() {
  if (!('mediaSession' in navigator) || !P) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({ title: P.t.title, artist: 'TEF Oral Studio', artwork: [{ src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }] });
    navigator.mediaSession.setActionHandler('play', () => P && !P.playing && togglePlay());
    navigator.mediaSession.setActionHandler('pause', () => P && P.playing && togglePlay());
    navigator.mediaSession.setActionHandler('previoustrack', () => P && jump(P.idx - 1));
    navigator.mediaSession.setActionHandler('nexttrack', () => P && jump(P.idx + 1));
    navigator.mediaSession.setActionHandler('seekbackward', () => P && replayLine());
  } catch (e) {}
}

function renderPlayer(id) {
  const t = trackById(id);
  if (!t) { location.hash = '#/'; return; }
  document.title = t.title + ' — TEF Oral Studio';
  const startIdx = STATS.last && STATS.last.id === id ? Math.min(t.lines.length - 1, STATS.last.idx) : 0;
  P = {
    t, idx: 0, playing: false, waiting: false, practice: false, loop: false, rate: 1, src: 'tts', audio: null, url: null,
    hasAudio: false, userAudio: false, starts: [], dur: 0, timing: '', off: ls.get('tef.off.' + id, 0), modelPlay: null, tok: 0, sync: null,
    raf: 0, mode: 'focus', finished: false, rec: { state: 'idle', url: null }, afterModel: null, lay: charLayout(t), wl: null
  };
  t.lines.forEach(l => { l.rev = false; });

  const el = h('div', { class: 'player', id: 'pl', 'data-view': SET.view, 'data-mode': 'focus' },
    h('header', { class: 'bar' },
      h('a', { class: 'icon-btn', href: '#/', 'aria-label': 'Retour aux exercices' }, ico('back')),
      h('div', { class: 'ttl' }, h('b', {}, t.title), h('span', {}, `Section ${t.section}`)),
      h('button', { class: 'icon-btn', id: 'b-mode', 'aria-label': 'Afficher la transcription', onclick: toggleMode }, ico('list')),
      h('button', { class: 'icon-btn', 'aria-label': 'Consigne et phrases utiles', onclick: openBrief }, ico('info')),
      h('button', { class: 'icon-btn', 'aria-label': 'Plus d’options', onclick: openMore }, ico('more'))),
    h('div', { class: 'scorewrap', id: 'scorewrap' }, h('div', { id: 'scoreslot' }), h('div', { class: 'time' }, h('span', { id: 't-l' }, '0:00'), h('span', { id: 't-r' }, ''))),
    h('section', { class: 'stage', id: 'stage', 'aria-live': 'off' },
      h('div', { class: 'ctxline', id: 'c-prev', onclick: () => jump(P.idx - 1) }),
      h('article', { class: 'cap', id: 'cap', tabindex: '0', role: 'button', 'aria-label': 'Afficher ou masquer la traduction', onclick: onCapTap },
        h('div', { class: 'who', id: 'cap-who' }), h('p', { class: 'fr', id: 'cap-fr' }),
        h('div', { class: 'enw' }, h('div', {}, h('p', { class: 'en', id: 'cap-en' }))), h('p', { class: 'tip', id: 'cap-tip' })),
      h('div', { class: 'turn', id: 'turn' }),
      h('div', { class: 'ctxline next', id: 'c-next', onclick: () => jump(P.idx + 1) }),
      h('button', { class: 'hint', id: 'cap-hint', onclick: onCapTap })),
    h('section', { class: 'list', id: 'list' }),
    h('div', { class: 'dock' },
      h('div', { class: 'sync', id: 'sync' }),
      h('div', { class: 'transport' },
        h('button', { class: 'chip', id: 't-rate', 'aria-label': 'Vitesse de lecture', onclick: cycleRate }, '1×'),
        h('button', { class: 't-btn', 'aria-label': 'Réplique précédente', onclick: () => jump(P.idx - 1) }, ico('prev', 28)),
        h('button', { class: 'play', id: 'playbtn', 'aria-label': 'Lecture', onclick: togglePlay }, ico('play', 34)),
        h('button', { class: 't-btn', 'aria-label': 'Réplique suivante', onclick: () => jump(P.idx + 1) }, ico('next', 28)),
        h('button', { class: 'chip', id: 't-en', 'aria-label': 'Afficher l’anglais sous chaque réplique', 'aria-pressed': String(SET.view === 'both'), onclick: () => setView(SET.view === 'both' ? 'fr' : 'both') }, 'EN')),
      h('div', { class: 'tools' },
        h('button', { class: 'tool', 'aria-label': 'Rejouer la réplique', onclick: replayLine }, ico('replay', 20), h('span', {}, 'Rejouer')),
        h('button', { class: 'tool', id: 't-loop', 'aria-pressed': 'false', onclick: toggleLoop }, ico('loop', 20), h('span', {}, 'Boucle')),
        h('button', { class: 'tool', id: 'starbtn', 'aria-pressed': 'false', onclick: () => { toggleStar(P.t.id, P.idx); refreshStars(); toast(isStar(P.t.id, P.idx) ? 'Phrase gardée dans Phrases' : 'Phrase retirée'); } }, ico('star', 20), h('span', {}, 'Garder')),
        h('button', { class: 'tool', id: 't-prac', 'aria-pressed': 'false', onclick: togglePractice }, ico('mic', 20), h('span', {}, 'Pratique')))));
  root.replaceChildren(el);

  // transcription
  const list = $p('#list');
  t.lines.forEach((l, i) => {
    const row = h('div', { class: 'msg ' + l.s, 'data-i': i },
      h('div', { class: 'body', onclick: () => { const v = $p('#pl').dataset.view; if (v === 'listen' && !row.classList.contains('peek')) row.classList.add('peek'); else row.classList.toggle('open'); } },
        h('div', { class: 'f fr' }, l.fr), h('div', { class: 'e' }, l.en || '—'), noteEl(l.note, 'n')),
      h('button', { class: 'mini-btn', 'aria-label': 'Garder cette phrase', 'aria-pressed': String(isStar(t.id, i)), onclick: e => { toggleStar(t.id, i); e.currentTarget.setAttribute('aria-pressed', String(isStar(t.id, i))); refreshStars(); } }, ico('star', 20)),
      h('button', { class: 'mini-btn', 'aria-label': 'Lire cette réplique', onclick: () => jump(i) }, ico('play', 18)));
    list.append(row);
  });
  rebuildScore();
  setIdx(startIdx, { scroll: false, silent: true });
  updatePlay(); updateRate();
  Promise.race([getAudio(t.id), new Promise(r => setTimeout(() => r(null), 1500))])
    .then(b => { if (!P || P.t !== t) return; if (b) { P.userAudio = true; attachAudio(b, true); } else if (t.audioUrl) attachAudio(t.audioUrl, true); })
    .catch(() => { if (P && P.t === t && t.audioUrl) attachAudio(t.audioUrl, true); });
}

/* ---------- partition (score) ---------- */
function rebuildScore() {
  const slot = $p('#scoreslot'); if (!slot || !P) return;
  P.lay = (P.src === 'audio' && P.starts.length && P.dur) ? timeLayout(P.t, P.starts, P.dur, P.off) : charLayout(P.t);
  const sc = buildScore(P.t, P.lay);
  sc.setAttribute('role', 'slider'); sc.setAttribute('aria-label', 'Position dans le dialogue');
  const lineAt = x => { let best = 0, bd = 1e9; P.lay.forEach((b, i) => { const d = x >= b.l && x <= b.l + b.w ? 0 : Math.min(Math.abs(x - b.l), Math.abs(x - b.l - b.w)); if (d < bd) { bd = d; best = i; } }); return best; };
  const frac = e => { const r = sc.getBoundingClientRect(); return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)); };
  let drag = false, wasPlaying = false, raf = 0, lastF = 0;
  const apply = () => {
    raf = 0;
    if (P.src === 'audio' && P.audio && P.dur) { P.audio.currentTime = lastF * P.dur; P.waiting = false; tickOnce(); }
    else { setIdx(lineAt(lastF * 100), { silent: true }); }
  };
  sc.addEventListener('pointerdown', e => {
    if (P.sync) return;
    drag = true; try { sc.setPointerCapture(e.pointerId); } catch (x) {}
    wasPlaying = P.playing && !P.waiting; lastF = frac(e);
    if (P.src === 'audio' && P.audio) { P.scrub = true; if (wasPlaying) P.audio.pause(); }
    sc.classList.add('drag'); apply();
  });
  sc.addEventListener('pointermove', e => { if (!drag) return; lastF = frac(e); if (!raf) raf = requestAnimationFrame(apply); });
  const end = e => {
    if (!drag) return; drag = false; sc.classList.remove('drag');
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    lastF = frac(e); P.scrub = false;
    if (P.src === 'audio' && P.audio && P.dur) {
      P.audio.currentTime = lastF * P.dur; tickOnce();
      if (wasPlaying) { P.audio.play().catch(() => {}); P.playing = true; cancelAnimationFrame(P.raf); P.raf = requestAnimationFrame(tick); } else updatePlay();
    } else jump(lineAt(lastF * 100));
  };
  sc.addEventListener('pointerup', end); sc.addEventListener('pointercancel', end);
  slot.replaceChildren(sc);
  updateScoreState(); updateHead();
}
function updateScoreState() {}
function updateHead() {
  const hd = $p('#head'); if (!hd || !P) return;
  let p;
  if (P.src === 'audio' && P.audio && P.dur) p = P.audio.currentTime / P.dur * 100; else p = P.lay[P.idx] ? P.lay[P.idx].l : 0;
  p = Math.max(0, Math.min(100, p)); const w = hd.parentNode; w.style.setProperty('--p', p + '%'); hd.style.left = p + '%';
  const l = $p('#t-l'), r = $p('#t-r');
  if (P.src === 'audio' && P.audio && P.dur) { l.textContent = fmt(P.audio.currentTime); r.textContent = fmt(P.dur) + (P.timing === 'estimate' ? ' (minutage estimé)' : ''); }
  else { l.textContent = `Réplique ${P.idx + 1}`; r.textContent = `${P.t.lines.length} au total`; }
}

/* ---------- affichage ---------- */
function setIdx(i, o = {}) {
  const n = P.t.lines.length; i = Math.max(0, Math.min(n - 1, i));
  const changed = i !== P.idx; P.idx = i;
  const L = P.t.lines[i], cap = $p('#cap');
  cap.dataset.who = L.s;
  $p('#cap-who').textContent = L.s === 'ex' ? exName(P.t) : 'Vous';
  $p('#cap-fr').textContent = L.fr;
  $p('#cap-fr').dataset.len = L.fr.length > 150 ? 'xl' : L.fr.length > 95 ? 'l' : 's';
  $p('#cap-en').textContent = L.en || '—';
  const tip = $p('#cap-tip'); tip.replaceChildren();
  if (L.note) { const w = L.note.startsWith('⚠'); tip.className = 'tip' + (w ? ' warn' : ''); tip.textContent = w ? 'À corriger : ' + L.note.slice(1).trim() : 'À retenir : ' + L.note; } else tip.className = 'tip';
  if (changed) { cap.classList.remove('peek', 'en'); if (!reduceMotion) { cap.classList.remove('swap'); void cap.offsetWidth; cap.classList.add('swap'); } }
  $p('#c-prev').textContent = i > 0 ? P.t.lines[i - 1].fr : '';
  $p('#c-prev').classList.add('fr');
  $p('#c-next').textContent = i < n - 1 ? P.t.lines[i + 1].fr : '';
  $p('#c-next').classList.add('fr');
  updateHint(); updateScoreState(); updateHead(); refreshStars();
  document.querySelectorAll('#list .msg').forEach(m => { const on = +m.dataset.i === i; m.classList.toggle('act', on); if (on && changed && P.mode === 'list' && o.scroll !== false) m.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' }); });
  refreshRev();
  if (!o.silent && (P.playing || P.waiting)) markHeard(P.t, i);
}
function updateHint() {
  const v = $p('#pl').dataset.view, cap = $p('#cap'), hb = $p('#cap-hint');
  hb.textContent = v === 'both' ? '' : v === 'listen' && !cap.classList.contains('peek') ? 'Voir le français' : cap.classList.contains('en') ? 'Masquer l’anglais' : 'Voir l’anglais';
}
function onCapTap(e) {
  if (e && e.stopPropagation) e.stopPropagation();
  const cap = $p('#cap'), v = $p('#pl').dataset.view;
  if (v === 'listen' && !cap.classList.contains('peek')) cap.classList.add('peek'); else cap.classList.toggle('en');
  updateHint();
}
function setView(k) {
  SET.view = k; ls.set('tef.set', SET);
  $p('#pl').dataset.view = k;
  const en = $p('#t-en'); if (en) en.setAttribute('aria-pressed', String(k === 'both'));
  document.querySelectorAll('.viewopt button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.k === k)));
  $p('#cap').classList.remove('peek'); updateHint();
}
function toggleMode() {
  P.mode = P.mode === 'focus' ? 'list' : 'focus';
  $p('#pl').dataset.mode = P.mode;
  const b = $p('#b-mode'); b.replaceChildren(ico(P.mode === 'focus' ? 'list' : 'caption')); b.setAttribute('aria-label', P.mode === 'focus' ? 'Afficher la transcription' : 'Afficher les sous-titres');
  const act = $p('#list .msg.act'); if (P.mode === 'list' && act) act.scrollIntoView({ block: 'center' });
}
function refreshStars() {
  if (!P) return;
  const on = isStar(P.t.id, P.idx), b = $p('#starbtn'); if (b) b.setAttribute('aria-pressed', String(on));
  document.querySelectorAll('#list .msg').forEach(m => { const bt = m.querySelector('.mini-btn'); if (bt) bt.setAttribute('aria-pressed', String(isStar(P.t.id, +m.dataset.i))); });
}
function refreshRev() {
  document.querySelectorAll('#list .msg.ca').forEach(m => m.classList.toggle('rev', !!P.t.lines[+m.dataset.i].rev));
  const pl = $p('#pl'); if (!pl) return;
  pl.classList.toggle('practice-on', P.practice);
  pl.classList.toggle('waiting', P.waiting);
}
function updatePlay() {
  const b = $p('#playbtn'); if (!b) return;
  const on = P.playing && !P.waiting;
  b.replaceChildren(ico(on ? 'pause' : 'play', 32)); b.setAttribute('aria-label', on ? 'Pause' : 'Lecture');
}
function updateRate() { const b = $p('#t-rate'); if (b) b.textContent = P.rate + '×'; }

/* ---------- audio ---------- */
function attachAudio(src, switchTo) {
  if (P.audio) P.audio.pause();
  if (P.url && P.url.startsWith('blob:')) URL.revokeObjectURL(P.url);
  P.url = typeof src === 'string' ? src : URL.createObjectURL(src);
  const a = new Audio(); a.preload = 'metadata'; a.src = P.url; a.playbackRate = P.rate; P.audio = a; P.hasAudio = true;
  a.addEventListener('loadedmetadata', () => { P.dur = a.duration; computeStarts(); rebuildScore(); });
  a.addEventListener('timeupdate', () => { if (P && P.src === 'audio' && !P.sync) tickOnce(); });
  a.addEventListener('ended', () => { if (P && P.src === 'audio' && !P.sync) onFinished(); });
  a.addEventListener('error', () => { if (P && P.src === 'audio') toast('Impossible de lire cet audio. Essaie un fichier mp3 ou m4a.'); });
  if (switchTo) setSource('audio');
}
function computeStarts() {
  const n = P.t.lines.length, saved = ls.get('tef.sync.' + P.t.id, null);
  if (saved && saved.length === n) { P.starts = saved; P.timing = 'sync'; return; }
  if (P.t.starts && P.t.starts.length === n && P.dur) { P.starts = P.t.starts.slice(); P.timing = 'preset'; return; }
  const w = P.t.lines.map(l => l.fr.length + 22), tot = w.reduce((a, b) => a + b, 0); let c = 0;
  P.starts = w.map(x => { const s = (c / tot) * (P.dur || 0); c += x; return s; }); P.timing = 'estimate';
}
const lineStart = i => Math.max(0, P.starts[i] - P.off);
const lineEnd = i => (i + 1 < P.starts.length ? P.starts[i + 1] - P.off : (P.dur || 0));
function indexAt(t) { const tt = t + P.off; for (let i = P.starts.length - 1; i >= 0; i--) if (P.starts[i] <= tt + .02) return i; return 0; }
function setSource(s) {
  if (s === 'audio' && !P.hasAudio) { toast('Choisis d’abord un fichier audio.'); return; }
  pauseAll(); P.src = s; P.waiting = false; P.modelPlay = null;
  if (s === 'audio' && P.audio && P.starts.length) P.audio.currentTime = lineStart(P.idx);
  rebuildScore(); updatePlay(); refreshRev(); mediaSession();
}
function setOff(v) {
  P.off = Math.max(-6, Math.min(6, Math.round(v * 4) / 4)); ls.set('tef.off.' + P.t.id, P.off);
  if (P.audio && P.starts.length) { rebuildScore(); setIdx(indexAt(P.audio.currentTime), { silent: true, scroll: false }); }
}

/* ---------- transport ---------- */
function pauseAll() {
  if (!P) return; P.tok++;
  try { speechSynthesis.cancel(); } catch (e) {}
  if (P.audio) P.audio.pause(); cancelAnimationFrame(P.raf); P.playing = false; updatePlay(); unlock();
}
function togglePlay() {
  if (!P || P.sync) return;
  if (P.waiting) { doContinue(); return; }
  if (P.playing) { pauseAll(); return; }
  play();
}
function play() {
  lock(); mediaSession();
  if (P.src === 'audio') {
    if (!P.audio || !P.starts.length) { toast('L’audio se charge…'); return; }
    if (P.finished || P.audio.ended || P.audio.currentTime >= P.dur - .1) { P.audio.currentTime = lineStart(0); P.finished = false; }
    else if (indexAt(P.audio.currentTime) !== P.idx) P.audio.currentTime = lineStart(P.idx) + .03;
    P.audio.playbackRate = P.rate;
    P.audio.play().then(() => { P.playing = true; updatePlay(); tick(); }).catch(() => toast('Touche lecture pour autoriser le son.'));
  } else {
    if (!('speechSynthesis' in window)) { toast('Les voix ne sont pas prises en charge ici.'); return; }
    if (P.finished) { P.finished = false; setIdx(0); }
    speakLine(P.idx);
  }
}
function jump(i) {
  if (!P || P.sync) return;
  const n = P.t.lines.length; i = Math.max(0, Math.min(n - 1, i));
  P.waiting = false; P.modelPlay = null; P.afterModel = null; P.finished = false; stopMine();
  if (P.src === 'audio' && P.audio && P.starts.length) {
    P.audio.currentTime = lineStart(i) + .03; setIdx(i, { silent: !P.playing });
    if (P.practice && P.t.lines[i].s === 'ca') { P.audio.pause(); enterWaiting(i); return; }
    refreshRev();
    if (!P.playing) play();
  } else {
    P.tok++; try { speechSynthesis.cancel(); } catch (e) {}
    setIdx(i, { silent: !P.playing }); speakLine(i);
  }
}
function replayLine() { if (!P) return; if (P.waiting) listenModel(); else jump(P.idx); }
function tick() { if (!P || P.src !== 'audio' || !P.audio) return; tickOnce(); if (!P.audio.paused && P.playing) P.raf = requestAnimationFrame(tick); }
function tickOnce() {
  const a = P.audio; if (!a || P.sync || !P.starts.length) { updateHead(); return; }
  const t = a.currentTime, i = indexAt(t);
  if (i !== P.idx && !P.waiting) {
    setIdx(i);
    if (P.practice && P.t.lines[i].s === 'ca' && P.modelPlay !== i) { a.pause(); enterWaiting(i); return; }
  }
  const end = lineEnd(P.idx);
  if (P.modelPlay === P.idx && t >= end - .05) { a.pause(); a.currentTime = lineStart(P.idx); P.modelPlay = null; enterWaiting(P.idx, { keep: true }); return; }
  if (P.loop && P.modelPlay == null && !P.waiting && t >= end - .05) a.currentTime = lineStart(P.idx);
  updateHead();
}
function onFinished() {
  P.playing = false; P.waiting = false; P.finished = true; cancelAnimationFrame(P.raf);
  P.t.lines.forEach(l => { if (l.s === 'ca') l.rev = true; });
  updatePlay(); refreshRev(); unlock(); toast('Dialogue terminé. Bien joué.');
}
function toggleLoop() { P.loop = !P.loop; $p('#t-loop').setAttribute('aria-pressed', String(P.loop)); toast(P.loop ? 'La réplique se répète.' : 'Boucle désactivée.'); }
function cycleRate() { const rs = [.75, .9, 1, 1.15]; P.rate = rs[(rs.indexOf(P.rate) + 1) % rs.length]; updateRate(); if (P.audio) P.audio.playbackRate = P.rate; }

/* ---------- voix de l'appareil ---------- */
function speakLine(i, once) {
  const tok = ++P.tok; try { speechSynthesis.cancel(); } catch (e) {}
  if (i >= P.t.lines.length) { onFinished(); return; }
  const L = P.t.lines[i]; setIdx(i);
  if (!once && P.practice && L.s === 'ca') { enterWaiting(i); return; }
  P.playing = true; P.waiting = false; updatePlay(); refreshRev();
  setTimeout(() => {
    if (!P || tok !== P.tok) return;
    const u = new SpeechSynthesisUtterance(L.fr), v = voiceFor(L.s);
    if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'fr-CA';
    u.rate = Math.min(1.6, P.rate * .95);
    if (!v || VOICES.length < 2) u.pitch = L.s === 'ex' ? 1.15 : .85;
    u.onend = () => {
      if (!P || tok !== P.tok) return;
      if (once) { enterWaiting(i, { keep: true }); return; }
      if (P.loop) { speakLine(i); return; }
      speakLine(i + 1);
    };
    try { speechSynthesis.speak(u); } catch (e) { toast('La voix n’est pas disponible sur cet appareil.'); }
  }, 40);
}

/* ---------- mode pratique : à vous de parler ---------- */
function togglePractice() {
  P.practice = !P.practice;
  $p('#t-prac').setAttribute('aria-pressed', String(P.practice));
  if (P.practice) { P.t.lines.forEach(l => { l.rev = false; }); toast('Pratique : réponds à voix haute quand c’est ton tour.'); }
  else { P.waiting = false; stopMine(); }
  refreshRev();
}
function enterWaiting(i, o = {}) {
  P.tok++; try { speechSynthesis.cancel(); } catch (e) {}
  if (P.audio) P.audio.pause(); cancelAnimationFrame(P.raf);
  if (!o.keep) { if (P.rec.url) URL.revokeObjectURL(P.rec.url); P.rec = { state: 'idle', url: null }; }
  P.waiting = true; P.playing = false; setIdx(i); updatePlay(); refreshRev(); renderTurn();
  if (P.afterModel === 'mine') { P.afterModel = null; setTimeout(playMine, 350); }
}
function renderTurn() {
  const el = $p('#turn'); if (!el || !P) return;
  const L = P.t.lines[P.idx], prev = P.t.lines[P.idx - 1], r = P.rec, recOn = r.state === 'rec';
  const acts = [];
  if (r.state === 'done') acts.push(h('button', { class: 'btn', onclick: playMine }, ico('play', 18), 'Réécouter ma voix'), h('button', { class: 'btn line', onclick: toggleRec }, 'Refaire'));
  const row2 = [h('button', { class: 'btn line', onclick: revealModel }, 'Texte'), h('button', { class: 'btn line', onclick: () => listenModel() }, 'Modèle')];
  if (r.state === 'done') row2.push(h('button', { class: 'btn line', onclick: () => listenModel('mine') }, 'Comparer'));
  const kids = [
    prev && !(P.practice && prev.s === 'ca' && !prev.rev) ? h('p', { class: 'lead fr' }, prev.fr) : null,
    h('h2', { class: 'fr' }, 'À vous de parler'),
    L.note && !L.note.startsWith('⚠') ? h('p', { class: 'tipline' }, 'Indice : ' + L.note) : null,
    h('button', { class: 'mic' + (recOn ? ' rec' : ''), 'aria-label': recOn ? 'Arrêter l’enregistrement' : 'Enregistrer ma réponse', onclick: toggleRec }, ico(recOn ? 'stop' : 'mic', 34)),
    h('div', { class: 'rt', id: 'rt' }, recOn ? '0:00' : (r.state === 'done' ? 'Enregistrement prêt' : 'Touche le micro et réponds.')),
    acts.length ? h('div', { class: 'acts' }, acts) : null,
    h('div', { class: 'acts' }, row2),
    L.rev ? h('div', { class: 'reveal' }, h('p', { class: 'fr' }, L.fr), h('p', { class: 'en' }, L.en || '')) : null,
    h('button', { class: 'btn fill', style: 'margin-top:4px;min-width:200px', onclick: doContinue }, 'Continuer')
  ];
  el.replaceChildren(...kids.filter(Boolean));
}
function revealModel() { P.t.lines[P.idx].rev = true; refreshRev(); renderTurn(); }
function listenModel(after) {
  const i = P.idx; P.t.lines[i].rev = true; refreshRev(); P.waiting = false; P.afterModel = after || null; stopMine();
  refreshRev();
  if (P.src === 'audio' && P.audio && P.starts.length) { P.modelPlay = i; P.audio.currentTime = lineStart(i) + .03; P.audio.playbackRate = P.rate; P.audio.play().then(() => { P.playing = true; updatePlay(); tick(); }); }
  else speakLine(i, true);
}
function doContinue() {
  const i = P.idx; P.t.lines[i].rev = true; stopMine(); P.afterModel = null;
  P.waiting = false; refreshRev();
  const next = i + 1;
  if (next >= P.t.lines.length) { onFinished(); return; }
  if (P.src === 'audio' && P.audio && P.starts.length) {
    P.audio.currentTime = lineStart(next) + .03; setIdx(next);
    P.audio.play().then(() => { P.playing = true; updatePlay(); tick(); lock(); });
  } else speakLine(next);
}
async function toggleRec() {
  const r = P.rec;
  if (r.state === 'rec') { try { r.mr.stop(); } catch (e) {} return; }
  pauseAll(); stopMine();
  if (r.url) { URL.revokeObjectURL(r.url); r.url = null; }
  if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices) { toast('L’enregistrement n’est pas disponible sur ce navigateur.'); return; }
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
  catch (e) { toast('Micro bloqué. Autorise-le dans les réglages de Safari pour ce site.'); return; }
  if (!P || P.rec !== r) { stream.getTracks().forEach(t => t.stop()); return; }
  const chunks = []; const mr = new MediaRecorder(stream);
  mr.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
  mr.onstop = () => {
    clearInterval(r.timer); stream.getTracks().forEach(t => t.stop());
    if (!P || P.rec !== r) return;
    r.url = URL.createObjectURL(new Blob(chunks, { type: mr.mimeType || 'audio/mp4' })); r.state = 'done'; renderTurn();
  };
  mr.start(); r.mr = mr; r.state = 'rec'; r.t0 = Date.now();
  r.timer = setInterval(() => { const el = $p('#rt'); if (el) el.textContent = fmt((Date.now() - r.t0) / 1000); if (Date.now() - r.t0 > 90000) try { mr.stop(); } catch (e) {} }, 250);
  renderTurn();
}
function playMine() { if (!P || !P.rec.url) return; stopMine(); P.mine = new Audio(P.rec.url); P.mine.play().catch(() => toast('Touche pour écouter ton enregistrement.')); }
function stopMine() { if (P && P.mine) { try { P.mine.pause(); } catch (e) {} P.mine = null; } }

/* ---------- consigne ---------- */
function openBrief() {
  const t = P.t, body = h('div', { class: 'brief' });
  if (t.ad) body.append(h('div', { class: 'paper' }, h('b', {}, t.ad.title), h('span', {}, t.ad.text)));
  if (t.task) body.append(h('p', {}, t.task));
  if (t.phrases && t.phrases.length) body.append(h('div', { class: 'sh-sec' }, h('h3', {}, 'Phrases utiles'), h('ul', { class: 'kp' }, t.phrases.map(p => h('li', {}, h('div', { class: 'f fr' }, p[0]), h('div', { class: 'e' }, p[1]))))));
  if (!t.ad && !t.task && !(t.phrases && t.phrases.length)) body.append(h('p', {}, 'Cet exercice n’a pas de consigne.'));
  sheet('Consigne', body);
}

/* ---------- options ---------- */
function openMore() {
  const t = P.t, body = h('div', {});
  body.append(h('section', { class: 'sh-sec' }, h('h3', {}, 'Texte à l’écran'),
    h('div', { class: 'seg viewopt', role: 'group', 'aria-label': 'Texte affiché' },
      [['listen', 'Texte caché'], ['fr', 'Français'], ['both', 'FR + EN']].map(([k, l]) => h('button', { 'data-k': k, 'aria-pressed': String(SET.view === k), onclick: () => setView(k) }, l))),
    h('p', { class: 'sh-note' }, 'Texte caché : tu écoutes d’abord, puis tu touches la réplique pour la lire.')));
  const timingTxt = { sync: 'Minutage réglé par toi.', preset: 'Minutage fourni avec l’exercice, calculé par reconnaissance vocale.', estimate: 'Minutage estimé. Resynchronise pour plus de précision.' }[P.timing] || '';
  const fileIn = h('input', { type: 'file', class: 'sr', id: 'file', accept: 'audio/*,.mp3,.m4a,.wav,.aac,.ogg', onchange: async e => {
    const f = e.target.files[0]; if (!f) return;
    try { await putAudio(t.id, f); HAVE.add(t.id); } catch (err) { toast('Stockage impossible. L’audio ne durera que cette session.'); }
    ls.del('tef.sync.' + t.id); P.userAudio = true; attachAudio(f, true);
    toast('Audio ajouté. Resynchronise les sous-titres pour qu’ils suivent la voix.'); closeSheets(); setTimeout(openMore, 350);
  } });
  const srcSeg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Source audio' },
    h('button', { 'aria-pressed': String(P.src === 'tts'), onclick: e => { setSource('tts'); closeSheets(); } }, 'Voix de l’appareil'),
    h('button', { 'aria-pressed': String(P.src === 'audio'), disabled: P.hasAudio ? null : true, onclick: () => { setSource('audio'); closeSheets(); } }, 'Audio de l’exercice'));
  body.append(h('section', { class: 'sh-sec' }, h('h3', {}, 'Source audio'), srcSeg,
    h('div', { class: 'sh-row', style: 'margin-top:12px' },
      h('label', { class: 'btn', for: 'file', tabindex: '0', onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileIn.click(); } } }, P.userAudio ? 'Remplacer mon audio' : 'Joindre mon audio'), fileIn,
      P.userAudio ? h('button', { class: 'btn line danger', onclick: async () => {
        if (!confirm('Retirer ton audio de cet exercice ?')) return;
        pauseAll(); try { await delAudio(t.id); } catch (e) {} HAVE.delete(t.id); ls.del('tef.sync.' + t.id); P.userAudio = false;
        if (P.url && P.url.startsWith('blob:')) URL.revokeObjectURL(P.url); P.audio = null; P.url = null; P.hasAudio = false; P.src = 'tts';
        if (t.audioUrl) attachAudio(t.audioUrl, true); else { rebuildScore(); updatePlay(); }
        toast('Audio retiré'); closeSheets();
      } }, 'Retirer') : null),
    h('p', { class: 'sh-note' }, P.hasAudio ? 'Tu peux joindre un enregistrement de 10 à 20 minutes. Il reste sur ton appareil.' : 'Joins un fichier mp3 ou m4a pour écouter une vraie voix à la place de la voix de l’appareil.')));
  if (P.hasAudio) {
    const out = h('output', {}, (P.off >= 0 ? '+' : '−') + Math.abs(P.off).toFixed(2).replace(/0$/, '') + ' s');
    const upd = () => { out.textContent = (P.off > 0 ? '+' : P.off < 0 ? '−' : '') + Math.abs(P.off).toFixed(2).replace(/\.?0+$/, '') + ' s'; if (!P.off) out.textContent = '0 s'; };
    upd();
    body.append(h('section', { class: 'sh-sec' }, h('h3', {}, 'Sous-titres'),
      h('div', { class: 'stepper' },
        h('button', { class: 'icon-btn btn line', 'aria-label': 'Retarder les sous-titres', onclick: () => { setOff(P.off - .25); upd(); } }, ico('minus')), out,
        h('button', { class: 'icon-btn btn line', 'aria-label': 'Avancer les sous-titres', onclick: () => { setOff(P.off + .25); upd(); } }, ico('plus'))),
      h('p', { class: 'sh-note' }, 'Les sous-titres arrivent trop tard ? Avance-les avec le plus. Trop tôt ? Retarde-les avec le moins.'),
      h('div', { class: 'sh-row', style: 'margin-top:12px' },
        h('button', { class: 'btn', onclick: () => { closeSheets(); startSync(); } }, 'Resynchroniser en tapant'),
        h('button', { class: 'btn line', onclick: () => { ls.del('tef.sync.' + t.id); setOff(0); upd(); computeStarts(); rebuildScore(); toast('Minutage d’origine rétabli'); } }, 'Rétablir l’original')),
      h('p', { class: 'sh-note' }, timingTxt)));
  }
  const ex = h('section', { class: 'sh-sec' }, h('h3', {}, 'Exercice'),
    h('div', { class: 'sh-row' },
      h('button', { class: 'btn line', onclick: () => { delete STATS.heard[t.id]; saveStats(); toast('Progression remise à zéro'); } }, 'Remettre la progression à zéro'),
      t.custom ? h('button', { class: 'btn line danger', onclick: () => { if (!confirm('Supprimer cet exercice ?')) return; ls.set('tef.custom', ls.get('tef.custom', []).filter(x => x.id !== t.id)); delAudio(t.id).catch(() => {}); ls.del('tef.sync.' + t.id); closeSheets(); location.hash = '#/'; } }, 'Supprimer l’exercice') : null));
  body.append(ex);
  sheet('Options', body);
}

/* ---------- resynchronisation par tapotement ---------- */
function startSync() {
  if (!P.audio || !P.dur) { toast('L’audio n’est pas encore chargé.'); return; }
  pauseAll(); P.src = 'audio'; P.waiting = false; P.off = 0; ls.set('tef.off.' + P.t.id, 0);
  P.sync = { i: 0, marks: [] }; P.audio.currentTime = 0; P.audio.playbackRate = 1;
  P.audio.play().then(() => { P.playing = true; updatePlay(); }).catch(() => toast('Touche lecture pour autoriser le son.'));
  syncUI();
}
function syncUI() {
  const box = $p('#sync'); if (!box || !P.sync) { box && box.classList.remove('on'); return; }
  const L = P.t.lines[P.sync.i];
  box.classList.add('on');
  box.replaceChildren(
    h('p', {}, `Écoute, puis touche quand cette réplique commence (${P.sync.i + 1} sur ${P.t.lines.length}).`),
    h('p', { class: 'q fr' }, L.fr.length > 90 ? L.fr.slice(0, 90) + '…' : L.fr),
    h('div', { class: 'acts' },
      h('button', { class: 'btn fill', style: 'flex:1', onclick: syncTap }, 'Elle commence'),
      P.sync.i > 0 ? h('button', { class: 'btn line', onclick: syncBack }, 'Retour') : null,
      h('button', { class: 'btn line', onclick: cancelSync }, 'Annuler')));
  setIdx(P.sync.i, { silent: true });
}
function syncTap() {
  const t = P.audio.currentTime;
  P.sync.marks.push(Math.max(t, (P.sync.marks[P.sync.marks.length - 1] || 0) + .05)); P.sync.i++;
  if (P.sync.i >= P.t.lines.length) {
    P.starts = P.sync.marks.slice(); P.starts[0] = Math.max(0, P.starts[0] - .1);
    ls.set('tef.sync.' + P.t.id, P.starts); P.timing = 'sync'; P.sync = null; $p('#sync').classList.remove('on');
    P.audio.pause(); P.audio.currentTime = 0; P.playing = false; updatePlay(); rebuildScore(); setIdx(0, { silent: true });
    toast('Synchronisation enregistrée'); return;
  }
  syncUI();
}
function syncBack() { P.sync.marks.pop(); P.sync.i--; P.audio.currentTime = Math.max(0, (P.sync.marks[P.sync.marks.length - 1] || 0)); syncUI(); }
function cancelSync() { P.sync = null; $p('#sync').classList.remove('on'); pauseAll(); computeStarts(); rebuildScore(); }

/* ---------- clavier (ordinateur) ---------- */
document.addEventListener('keydown', e => {
  if (!P || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.metaKey || e.ctrlKey) return;
  if (e.key === ' ' && e.target.tagName !== 'BUTTON') { e.preventDefault(); togglePlay(); }
  else if (e.key === 'ArrowRight') jump(P.idx + 1);
  else if (e.key === 'ArrowLeft') jump(P.idx - 1);
  else if (e.key === 'r') replayLine();
  else if (e.key === 'e') onCapTap();
  else if (e.key === 'p') togglePractice();
  else if ((e.key === 'Enter') && e.target.id === 'cap') onCapTap();
});

/* ============================================================
   Démarrage
   ============================================================ */
applySettings();
matchMedia('(prefers-color-scheme: light)').addEventListener && matchMedia('(prefers-color-scheme: light)').addEventListener('change', applySettings);
loadTracks();
route();
audioIds().then(s => { HAVE = new Set(s); if (!P && !location.hash.startsWith('#/t/')) { const y = window.scrollY; route(); window.scrollTo(0, y); } });
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});

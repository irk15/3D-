// ui.js — desktop HUD: landmarks, info cards, time/season/weather, tours, quality, stats, labels, sound.
import * as THREE from 'three';
import { LANDMARKS } from './landmarks.js';
import { TOURS } from './controls.js';
import { fmtHour } from './xr.js';
import { terrainH } from './core.js';

const $ = (s) => document.querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };

export class UI {
  constructor(app) {
    this.app = app;
    this.sel = null;
    // landmark list grouped by area
    const list = $('#lmList'), groups = new Map();
    for (const L of LANDMARKS) { if (!groups.has(L.area)) groups.set(L.area, []); groups.get(L.area).push(L); }
    const order = ['Downtown', 'Old Montreal', 'Old Port', 'Mount Royal', 'Quartier des spectacles', 'Côte-des-Neiges', 'Cité du Havre', 'Parc Jean-Drapeau', 'Saint Lawrence River', 'Hochelaga-Maisonneuve', 'Hochelaga', 'Saint-Henri', 'Sud-Ouest'];
    const areas = [...groups.keys()].sort((a, b) => (order.indexOf(a) + 99) % 99 - (order.indexOf(b) + 99) % 99);
    for (const a of areas) {
      list.appendChild(el('li', 'grp', a));
      for (const L of groups.get(a)) {
        const li = el('li', 'lm', `<b>${L.name}</b><small>${L.fr !== L.name ? L.fr : L.year}</small>`);
        li.dataset.id = L.id; li.onclick = () => this.select(L, true);
        list.appendChild(li);
      }
    }
    $('#lmFilter').addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      for (const li of list.querySelectorAll('li.lm')) { const L = LANDMARKS.find((l) => l.id === li.dataset.id); li.style.display = (L.name + L.fr + L.area).toLowerCase().includes(q) ? '' : 'none'; }
    });
    // segmented controls
    const seg = (id, items, cur, fn) => {
      const box = $(id); box.innerHTML = '';
      for (const [k, label] of items) { const b = el('button', 'seg' + (k === cur ? ' on' : ''), label); b.dataset.k = k; b.onclick = () => { box.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); fn(k); }; box.appendChild(b); }
    };
    this.seg = seg;
    seg('#modeSeg', [['orbit', 'Orbit'], ['fly', 'Fly'], ['walk', 'Walk']], 'orbit', (k) => app.controls.setMode(k));
    seg('#seasonSeg', [['spring', 'Spring'], ['summer', 'Summer'], ['autumn', 'Autumn'], ['winter', 'Winter']], app.atmo.season, (k) => app.setSeason(k));
    seg('#weatherSeg', [['clear', 'Clear'], ['cloudy', 'Cloudy'], ['rain', 'Rain'], ['snow', 'Snow'], ['fog', 'Fog']], app.atmo.weather, (k) => app.setWeather(k));
    seg('#qualSeg', [['low', 'Low'], ['high', 'High'], ['ultra', 'Ultra']], app.qualityName, (k) => app.setQuality(k));
    const tp = $('#timePresets');
    for (const [k, label] of [['dawn', 'Dawn'], ['day', 'Day'], ['golden', 'Golden'], ['blue', 'Blue hour'], ['night', 'Night']]) { const b = el('button', 'chip', label); b.onclick = () => app.setTime(k); tp.appendChild(b); }
    $('#timeSlider').addEventListener('input', (e) => app.setHour(+e.target.value));
    $('#timeLapse').onclick = (e) => { app.timeLapse = !app.timeLapse; e.currentTarget.classList.toggle('on', app.timeLapse); };
    $('#liveBtn').onclick = (e) => { app.live = !app.live; e.currentTarget.classList.toggle('on', app.live); };
    const tours = $('#tours');
    TOURS.forEach((T, i) => { const b = el('button', 'chip tour', `▶ ${T.name}`); b.onclick = () => app.startTour(i); tours.appendChild(b); });
    $('#statsBtn').onclick = (e) => { $('#stats').classList.toggle('show'); e.currentTarget.classList.toggle('on'); };
    $('#labelsBtn').onclick = (e) => { this.labelsOn = !this.labelsOn; e.currentTarget.classList.toggle('on', this.labelsOn); $('#labels').style.display = this.labelsOn ? '' : 'none'; };
    $('#helpBtn').onclick = () => $('#help').classList.toggle('show');
    $('#help').onclick = () => $('#help').classList.remove('show');
    $('#soundBtn').onclick = (e) => { e.currentTarget.classList.toggle('on', app.sound.toggle()); };
    $('#cardClose').onclick = () => { $('#card').classList.remove('show'); this.sel = null; this.markSel(); };
    $('#cardFly').onclick = () => this.sel && app.controls.flyTo(this.sel);
    $('#cardWalk').onclick = () => this.sel && app.walkTo(this.sel);
    $('#hudToggle').onclick = () => document.body.classList.toggle('clean');
    // labels
    this.labelsOn = true; this.labelEls = new Map();
    const lab = $('#labels');
    for (const L of LANDMARKS) { const d = el('div', 'lbl', `<span>${L.name}</span>`); d.onclick = () => this.select(L, true); lab.appendChild(d); this.labelEls.set(L.id, d); }
    this.v = new THREE.Vector3();
    // VR button
    const vr = $('#vrBtn');
    if (navigator.xr) navigator.xr.isSessionSupported('immersive-vr').then((ok) => {
      if (ok) { vr.disabled = false; vr.innerHTML = '<i></i>Enter VR'; vr.onclick = () => app.enterVR().catch((e) => this.toast('VR: ' + e.message)); }
      else vr.title = 'Open this page in the Meta Quest Browser to explore in VR';
    }).catch(() => {});
    else vr.title = 'Open this page in the Meta Quest Browser to explore in VR';
    addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.key === 'h' || e.key === '?') $('#help').classList.toggle('show');
      if (e.key === '1') this.clickSeg('#modeSeg', 'orbit'); if (e.key === '2') this.clickSeg('#modeSeg', 'fly'); if (e.key === '3') this.clickSeg('#modeSeg', 'walk');
      if (e.key === 'n') app.setTime(app.atmo.hour > 7 && app.atmo.hour < 19 ? 'night' : 'day');
      if (e.key === 'l') $('#labelsBtn').click();
      if (e.key === 'u') document.body.classList.toggle('clean');
    });
    app.controls.onChange = (m) => { this.markSeg('#modeSeg', m); $('#modeHint').textContent = m === 'orbit' ? 'Drag to rotate · right-drag to pan · scroll to zoom · WASD to glide' : m === 'fly' ? 'Click to look · WASD fly · E/Q up/down · Shift faster' : 'Click to look · WASD walk · Shift run · Space jump'; };
    app.controls.onChange('orbit');
  }
  clickSeg(id, k) { $(id).querySelector(`[data-k="${k}"]`)?.click(); }
  markSeg(id, k) { $(id).querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.k === k)); }
  toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(this.tt); this.tt = setTimeout(() => t.classList.remove('show'), 4200); }
  select(L, fly) {
    this.sel = L; this.markSel();
    $('#cardArea').textContent = L.area; $('#cardName').textContent = L.name;
    $('#cardFr').textContent = L.fr !== L.name ? L.fr : ''; $('#cardYear').textContent = L.year;
    $('#cardFacts').innerHTML = L.facts.map((f) => `<li>${f}</li>`).join('');
    $('#card').classList.add('show');
    if (fly) this.app.controls.flyTo(L);
  }
  markSel() { document.querySelectorAll('#lmList li.lm').forEach((li) => li.classList.toggle('sel', this.sel && li.dataset.id === this.sel.id)); }
  frame(cam, s) {
    $('#clock').textContent = fmtHour(s.hour);
    $('#clockSub').textContent = `${s.season.toUpperCase()} · ${s.weather.toUpperCase()}`;
    const sl = $('#timeSlider'); if (document.activeElement !== sl) sl.value = s.hour;
    // compass: Montreal "north" is ~55° west of true north
    const dir = new THREE.Vector3(); cam.getWorldDirection(dir);
    const head = Math.atan2(dir.x, -dir.z) * 180 / Math.PI;
    $('#compassRose').style.transform = `rotate(${-head}deg)`;
    if (!this.labelsOn) return;
    const w = innerWidth, h = innerHeight;
    const alt = cam.position.y - terrainH(cam.position.x, -cam.position.z);
    const maxD = alt < 40 ? 900 : alt < 200 ? 2600 : 4500, maxN = alt < 40 ? 5 : alt < 200 ? 9 : 14;
    const cand = [];
    for (const L of LANDMARKS) {
      this.v.set(L.u, terrainH(L.u, L.v) + (L.h || 30) + 8, -L.v);
      const dist = this.v.distanceTo(cam.position);
      this.v.project(cam);
      const on = this.v.z < 1 && Math.abs(this.v.x) < 1.02 && Math.abs(this.v.y) < 1.02 && dist < maxD && dist > 30;
      if (on || this.sel === L) cand.push([dist * (this.sel === L ? 0 : 1), L, this.v.x, this.v.y, dist, on]);
    }
    cand.sort((a, b) => a[0] - b[0]);
    const shown = new Set(), boxes = [];
    for (const [, L, x, y, dist, on] of cand) {
      if (!on || shown.size >= maxN) continue;
      const px = (x * 0.5 + 0.5) * w, py = (-y * 0.5 + 0.5) * h;
      if (boxes.some(([bx, by]) => Math.abs(bx - px) < 130 && Math.abs(by - py) < 26)) continue;   // avoid overlaps
      boxes.push([px, py]); shown.add(L.id);
      const d = this.labelEls.get(L.id);
      d.style.transform = `translate(${px}px, ${py}px) translate(-50%, -100%)`;
      d.style.opacity = String(Math.max(0.25, Math.min(1, 1.3 - dist / maxD)));
      d.classList.toggle('sel', this.sel === L);
    }
    for (const L of LANDMARKS) { const d = this.labelEls.get(L.id); const vis = shown.has(L.id); if ((d.style.display !== 'none') !== vis) d.style.display = vis ? '' : 'none'; }
  }
  pick(x, y, cam) {
    let best = null, bd = 46 * 46;
    for (const L of LANDMARKS) {
      this.v.set(L.u, terrainH(L.u, L.v) + (L.h || 30) * 0.5, -L.v).project(cam);
      if (this.v.z > 1) continue;
      const px = (this.v.x * 0.5 + 0.5) * innerWidth, py = (-this.v.y * 0.5 + 0.5) * innerHeight;
      const d = (px - x) ** 2 + (py - y) ** 2; if (d < bd) { bd = d; best = L; }
    }
    if (best) this.select(best, false);
  }
  stats(o) {
    $('#stats').innerHTML = Object.entries(o).map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
  }
}

// ---------------------------------------------------------------- ambient sound (synthesised, no files)
export class Sound {
  constructor() { this.on = false; }
  init() {
    const A = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    const noise = (type) => {
      const len = A.sampleRate * 4, buf = A.createBuffer(1, len, A.sampleRate), d = buf.getChannelData(0); let last = 0;
      for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; if (type === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w; }
      const s = A.createBufferSource(); s.buffer = buf; s.loop = true; s.start(); return s;
    };
    this.master = A.createGain(); this.master.gain.value = 0; this.master.connect(A.destination);
    const mk = (type, f, q) => { const s = noise(type), fl = A.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = f; fl.Q.value = q || 0.7; const g = A.createGain(); g.gain.value = 0; s.connect(fl).connect(g).connect(this.master); return g; };
    this.city = mk('brown', 420); this.wind = mk('brown', 900); this.rain = mk('white', 5200);
  }
  toggle() {
    if (!this.ctx) this.init();
    this.on = !this.on; this.ctx.resume();
    this.master.gain.setTargetAtTime(this.on ? 0.8 : 0, this.ctx.currentTime, 0.4);
    return this.on;
  }
  update(alt, weather, night) {
    if (!this.ctx || !this.on) return;
    const t = this.ctx.currentTime, near = Math.max(0, 1 - alt / 400);
    this.city.gain.setTargetAtTime(0.35 * near * (1 - 0.5 * night), t, 0.5);
    this.wind.gain.setTargetAtTime(0.05 + 0.25 * Math.min(1, alt / 300) + (weather === 'snow' ? 0.2 : 0), t, 0.5);
    this.rain.gain.setTargetAtTime(weather === 'rain' ? 0.18 : 0, t, 0.8);
  }
  bell() {
    if (!this.ctx || !this.on) return;
    const A = this.ctx, t = A.currentTime;
    for (const [f, a] of [[220, 0.5], [440, 0.25], [532, 0.18], [660, 0.12], [880, 0.08]]) {
      const o = A.createOscillator(), g = A.createGain(); o.frequency.value = f; o.type = 'sine';
      g.gain.setValueAtTime(a * 0.4, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 5);
      o.connect(g).connect(this.master); o.start(t); o.stop(t + 5.2);
    }
  }
}

// systems.js — the living-world layer: a real day/night clock, weather, saving, achievements,
// spoken French dialogue with memory, courier deliveries, and the wardrobe.
import * as THREE from 'three';
import { h, whereIs, nsName, ewName, nsIdx, ewIdx, U } from './layout.js';
import { LAYER_FX } from './toon.js';

// ================================================================= day / night
// palettes keyed by hour; everything in between is blended, so dawn and dusk happen on their own
const K = (o) => o;
const KEYS = [
  [0, K({ sunC: '#a9bcff', sunI: 1.0, sky: '#7088dc', gnd: '#34306a', hemiI: 1.7, zen: '#0b1848', hor: '#334f9c', fog: '#26386f', cloud: '#46568e', shade: '#212c64', ink: '#070514', night: 1 })],
  [5.2, K({ sunC: '#a9bcff', sunI: 0.9, sky: '#7088dc', gnd: '#34306a', hemiI: 1.6, zen: '#132056', hor: '#3d58a2', fog: '#2c3e78', cloud: '#4a5a92', shade: '#24306a', ink: '#070514', night: 1 })],
  [6.4, K({ sunC: '#ffb88c', sunI: 1.9, sky: '#f0b6c8', gnd: '#6a5a8a', hemiI: 1.15, zen: '#6a7fd0', hor: '#ffc4b0', fog: '#efc2c0', cloud: '#ffe0d6', shade: '#b88aae', ink: '#2a1638', night: 0.35 })],
  [8.5, K({ sunC: '#fff2dc', sunI: 2.6, sky: '#bfe0ff', gnd: '#dcc8a6', hemiI: 1.3, zen: '#3c9be8', hor: '#c4e9ff', fog: '#cfeaf8', cloud: '#ffffff', shade: '#b6c4ec', ink: '#1b1640', night: 0 })],
  [16.8, K({ sunC: '#fff0d6', sunI: 2.7, sky: '#bfe0ff', gnd: '#dcc8a6', hemiI: 1.3, zen: '#3c9be8', hor: '#c8e8fc', fog: '#d2e8f4', cloud: '#ffffff', shade: '#b6c4ec', ink: '#1b1640', night: 0 })],
  [18.5, K({ sunC: '#ffa860', sunI: 3.0, sky: '#f7b9a4', gnd: '#6b5a8a', hemiI: 1.05, zen: '#6c84d8', hor: '#ffcf96', fog: '#f4c8a2', cloud: '#ffe6c8', shade: '#c886a8', ink: '#2a1638', night: 0.12 })],
  [19.8, K({ sunC: '#ff7a8a', sunI: 1.2, sky: '#a88ad8', gnd: '#3a3070', hemiI: 1.3, zen: '#2c3a8c', hor: '#ff9aa0', fog: '#8a6fa8', cloud: '#c890b8', shade: '#5a4a8a', ink: '#120a24', night: 0.65 })],
  [21, K({ sunC: '#a9bcff', sunI: 1.0, sky: '#7088dc', gnd: '#34306a', hemiI: 1.7, zen: '#0f1d52', hor: '#3d5aa8', fog: '#2a3c78', cloud: '#4a5a92', shade: '#24306a', ink: '#070514', night: 1 })],
  [24, null],
];
KEYS[KEYS.length - 1][1] = KEYS[0][1];
const cache = new Map();
const C = (hx) => { if (!cache.has(hx)) cache.set(hx, new THREE.Color(hx)); return cache.get(hx); };
export function lookAt(hour) {
  hour = ((hour % 24) + 24) % 24;
  let i = 0; while (i < KEYS.length - 2 && KEYS[i + 1][0] <= hour) i++;
  const [h0, a] = KEYS[i], [h1, b] = KEYS[i + 1];
  let t = (hour - h0) / (h1 - h0); t = t * t * (3 - 2 * t);
  const out = {};
  for (const k of Object.keys(a)) out[k] = typeof a[k] === 'string' ? C(a[k]).clone().lerp(C(b[k]), t) : a[k] + (b[k] - a[k]) * t;
  // the sun travels east → south → west; the moon takes over at night
  const ang = (hour - 6) / 12 * Math.PI;
  out.sunDir = new THREE.Vector3(Math.cos(ang) * 0.85, Math.sin(ang) * 0.9, 0.45).normalize();
  const moon = new THREE.Vector3(0.3, 0.62, -0.5).normalize();
  out.lightDir = out.sunDir.clone().multiplyScalar(1 - out.night).addScaledVector(moon, out.night);
  if (out.lightDir.y < 0.15) out.lightDir.y = 0.15;
  out.lightDir.normalize();
  return out;
}
export const fmtHour = (hr) => { hr = ((hr % 24) + 24) % 24; const H = Math.floor(hr), M = Math.floor((hr - H) * 60); return `${String(H).padStart(2, '0')}:${String(M).padStart(2, '0')}`; };

// ================================================================= weather
export class Weather {
  constructor() { this.state = 'clear'; this.timer = 140 + Math.random() * 120; this.wet = 0; this.cover = 0.42; }
  set(s) { this.state = s; this.timer = 180 + Math.random() * 180; }
  cycle() { this.set({ clear: 'cloudy', cloudy: 'rain', rain: 'clear' }[this.state]); }
  update(dt, season) {
    this.timer -= dt;
    if (this.timer < 0) this.set(Math.random() < 0.55 ? 'clear' : Math.random() < 0.5 ? 'cloudy' : 'rain');
    const raining = this.state === 'rain';
    this.precip = raining ? (season === 'winter' ? 'snow' : 'rain') : (season === 'winter' ? 'flurries' : null);
    const wetT = raining && season !== 'winter' ? 1 : 0;
    this.wet += (wetT - this.wet) * Math.min(1, dt * (wetT ? 0.25 : 0.06));
    const coverT = this.state === 'clear' ? 0.42 : this.state === 'cloudy' ? 0.68 : 0.86;
    this.cover += (coverT - this.cover) * Math.min(1, dt * 0.3);
    U.uWet.value = this.wet;
  }
}

// ================================================================= save
const KEY = 'plateau-montreal-v2';
export function loadSave() {
  const d = { bagels: [], money: 0, deliveries: 0, best: 0, met: {}, ach: {}, outfit: 0, owned: [0], voice: true, bike: 0, hour: 9, name: '', color: 0 };
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s) Object.assign(d, s); } catch (e) { /* private mode */ }
  return d;
}
export function writeSave(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* ignore */ } }

// ================================================================= achievements
export const ACH = {
  firstBagel: ['🥯', 'Premier bagel', 'Trouve ton premier bagel doré'],
  allBagels: ['🏆', 'Roi du bagel', 'Les 12 bagels du Plateau'],
  firstDelivery: ['📦', 'Premier colis', 'Termine ta première livraison'],
  tenDeliveries: ['🚲', 'Coursier pro', '10 livraisons réussies'],
  speedy: ['⚡', 'Éclair', 'Livre avec plus de la moitié du temps restant'],
  bixi: ['🚴', 'BIXI', 'Prends un vélo en libre-service'],
  glide: ['☂️', 'Mary Poppins', 'Plane avec ton parapluie'],
  flip: ['🌀', 'Salto', 'Fais un double saut'],
  night: ['🌙', 'Noctambule', 'Balade-toi après 22 h'],
  snow: ['❄️', 'Hiver québécois', 'Marche dans la neige'],
  friends: ['💛', 'Bon voisin', 'Parle à 8 voisins différents'],
  cat: ['🐈', 'Ami des chats', 'Flatte le chat'],
  rich: ['💰', 'Économe', 'Accumule 200 $'],
  style: ['🧢', 'Le style', 'Achète une nouvelle tenue'],
  fly: ['🕊️', 'Premier envol', 'Déploie tes ailes et vole'],
  cloud: ['☁️', 'Dans les nuages', 'Traverse un nuage en volant'],
  summit: ['⛰️', 'Plus haut que la croix', 'Vole à plus de 100 m'],
  mwin: ['🏅', 'Champion du Plateau', 'Gagne une mission'],
  online: ['🌐', 'Entre amis', 'Joue avec quelqu\'un en ligne'],
};
export class Achievements {
  constructor(save, toast) { this.s = save; this.toast = toast; }
  unlock(id) { if (this.s.ach[id]) return; this.s.ach[id] = Date.now(); writeSave(this.s); const [ic, name] = ACH[id]; this.toast(ic, name); }
  count() { return Object.keys(this.s.ach).length; }
}

// ================================================================= spoken French (Web Speech) with per-character voices
export class Voice {
  constructor() { this.on = true; this.voices = []; const load = () => { this.voices = (speechSynthesis?.getVoices?.() || []).filter((v) => /^fr/i.test(v.lang)); }; try { load(); speechSynthesis.onvoiceschanged = load; } catch (e) { /* no speech */ } }
  speak(text, who = 0) {
    if (!this.on || typeof speechSynthesis === 'undefined') return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text.replace(/[^\p{L}\p{N}\s.,!?'’«»:;-]/gu, ''));
      const ca = this.voices.filter((v) => /CA/i.test(v.lang)), pool = ca.length ? ca : this.voices;
      if (pool.length) u.voice = pool[who % pool.length];
      u.lang = u.voice?.lang || 'fr-CA';
      u.pitch = 0.8 + ((who * 37) % 10) / 12; u.rate = 1.02 + ((who * 13) % 5) / 30;
      speechSynthesis.speak(u);
    } catch (e) { /* ignore */ }
  }
  stop() { try { speechSynthesis.cancel(); } catch (e) { /* ignore */ } }
}

// ================================================================= dialogue that remembers you and reads the world
export function dialogue(n, save, ctx) {
  const m = save.met[n.id] || { talks: 0 };
  m.talks++; save.met[n.id] = m; writeSave(save);
  const hearts = Math.min(5, Math.floor(m.talks / 2) + 1);
  if (m.talks === 1) return { text: n.line, hearts };
  const pool = [];
  if (ctx.rain) pool.push('Quelle pluie! Heureusement que j\'ai mon parapluie.', 'Il mouille, il mouille… les ruelles sentent bon après la pluie.');
  if (ctx.season === 'winter') pool.push('Fais attention, ça glisse! Les trottoirs sont une patinoire.', 'Tu as vu la tempête? On va déneiger toute la nuit.');
  if (ctx.season === 'autumn') pool.push('Les érables sont magnifiques cette semaine, hein?', 'L\'automne sur le Plateau, c\'est le plus beau moment.');
  if (ctx.season === 'summer') pool.push('Il fait chaud! Une crème glacée au parc?', 'Ce soir il y a un spectacle gratuit au Quartier des spectacles.');
  if (ctx.hour >= 21 || ctx.hour < 5) pool.push('Il est tard, coursier! Rentre bien.', 'La nuit, le Plateau devient tout doux.');
  else if (ctx.hour < 10) pool.push('Bon matin! Tu as pris ton café?', 'Le matin, Saint-Denis sent le pain chaud.');
  if (ctx.delivery) pool.push(`Une livraison pour le ${ctx.delivery}? Fais vite, ils attendent!`, 'Encore une livraison? Tu es le meilleur coursier du quartier.');
  if (ctx.bagels >= 6) pool.push(`Déjà ${ctx.bagels} bagels dorés? Impressionnant!`);
  if (hearts >= 4) pool.push(`${ctx.name || 'Toi'}, tu fais maintenant partie du quartier. Merci d'être là.`, 'Reviens me voir quand tu veux, d\'accord?');
  pool.push('Re-bonjour! Belle journée pour flâner.', 'Toujours en balade? Moi aussi, j\'adore marcher ici.', 'Salut! Tu connais la ruelle verte derrière Saint-Denis?');
  return { text: pool[(m.talks * 7 + n.id) % pool.length], hearts };
}

// ================================================================= courier deliveries
const NAMES = ['Mme Gagnon', 'M. Lefebvre', 'Chloé', 'Raphaël', 'les Nguyen', 'Mme Bouchard', 'Samir', 'Léa', 'M. Côté', 'Inès', 'les Roy', 'Antoine'];
const ITEMS = ['des bagels', 'un gâteau', 'des fleurs', 'des livres', 'un vinyle', 'du fromage', 'une poutine', 'des croissants', 'un colis', 'des médicaments', 'une plante', 'des billets de spectacle'];
export class Deliveries {
  constructor(scene, world) {
    this.w = world; this.job = null; this.combo = 0;
    const beamM = new THREE.ShaderMaterial({
      uniforms: { uTime: U.uTime }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: 'varying vec2 vUv; varying float vF; void main(){ vUv = uv; vec3 o = (modelMatrix * vec4(0.0,0.0,0.0,1.0)).xyz; vF = smoothstep(2.0, 9.0, distance(o.xz, cameraPosition.xz)); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform float uTime; varying vec2 vUv; varying float vF; void main(){ float a = (1.0 - vUv.y) * (0.55 + 0.25 * sin(uTime * 4.0 - vUv.y * 14.0)) * vF; gl_FragColor = vec4(vec3(0.3, 0.95, 1.0) * a, 1.0); }',
    });
    this.marker = new THREE.Group();
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 30, 20, 1, true), beamM); beam.position.y = 15; beam.layers.set(LAYER_FX); this.marker.add(beam);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.07, 6, 40), new THREE.MeshBasicMaterial({ color: 0x5ff0ff })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.12; ring.layers.set(LAYER_FX); this.marker.add(ring); this.ring = ring;
    this.marker.visible = false; scene.add(this.marker);
  }
  offer(shop, from) {
    const doors = this.w.spots.doors.concat(this.w.spots.balcony.map((b) => ({ ...b, balcony: true })));
    const cands = doors.filter((d) => { const dd = Math.hypot(d.x - from.x, d.z - from.z); return dd > 70 && dd < 260; });
    const d = cands[Math.floor(Math.random() * cands.length)];
    if (!d) return null;
    const dist = Math.hypot(d.x - from.x, d.z - from.z);
    const k = nsIdx(d.x), mI = ewIdx(d.z);
    const street = Math.abs(d.x - k * 90) < 40 ? nsName(k) : ewName(mI);
    const who = NAMES[Math.floor(Math.random() * NAMES.length)], item = ITEMS[Math.floor(Math.random() * ITEMS.length)];
    const num = 4000 + Math.floor(Math.abs(d.z * 7 + d.x * 3)) % 900 * 2 + (d.x > k * 90 ? 1 : 0);
    const time = Math.round(dist / 3.4 + 25 + (d.balcony ? 12 : 0));
    return { from: shop.name, who, item, addr: `${num}, ${street}`, short: `${num} ${street.replace(/^(Rue|Avenue|Av\.) /, '')}`, target: new THREE.Vector3(d.x, d.y, d.z), balcony: !!d.balcony, time, left: time, reward: Math.round(8 + dist / 14) };
  }
  start(job) { this.job = job; this.marker.visible = true; this.marker.position.copy(job.target); }
  cancel() { this.job = null; this.marker.visible = false; }
  update(dt, player) {
    if (!this.job) return null;
    const j = this.job; j.left -= dt;
    this.ring.scale.setScalar(1 + Math.sin(U.uTime.value * 5) * 0.08);
    const d = Math.hypot(player.pos.x - j.target.x, player.pos.z - j.target.z), dy = Math.abs(player.pos.y - j.target.y);
    if (d < 1.7 && dy < 1.6) {
      const late = j.left < 0, frac = Math.max(0, j.left / j.time);
      const tip = late ? Math.round(j.reward * 0.3) : Math.round(j.reward * (1 + frac) * (1 + Math.min(this.combo, 5) * 0.1));
      this.combo = late ? 0 : this.combo + 1;
      const res = { done: true, tip, late, fast: frac > 0.5, job: j, combo: this.combo };
      this.cancel(); return res;
    }
    return { done: false, dist: d, left: j.left };
  }
}

// ================================================================= wardrobe (bought at the friperie)
export const OUTFITS = [
  { name: 'Coursier classique', price: 0, o: {} },
  { name: 'Tuque jaune soleil', price: 25, o: { hatCol: '#f2b43c', top: '#2f5a8a', scarf: '#e4402b' } },
  { name: 'Hiver à Montréal', price: 40, o: { hatCol: '#f4efe6', top: '#d8473f', scarf: '#2f7fbf', pack: '#3d3a4f' } },
  { name: 'Casquette vintage', price: 45, o: { hat: 'cap', hatCol: '#3f9a6a', top: '#f2d36b', scarf: null, pack: '#7b4fb0' } },
  { name: 'Nuit sur le Plateau', price: 60, o: { hatCol: '#7b4fb0', top: '#1f1f2a', pants: '#3d3a6f', scarf: '#ff6fa8', pack: '#ff6fa8' } },
  { name: 'Tenue Saint-Jean', price: 80, o: { hatCol: '#2f7fbf', top: '#f4efe6', pants: '#2f5a8a', scarf: '#2f7fbf', pack: '#f4efe6' } },
];

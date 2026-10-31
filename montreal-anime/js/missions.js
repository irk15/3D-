// missions.js — first-to-win challenges, shared by everyone in the room.
// The host picks a mission kind and a random seed; every client rebuilds the exact same mission
// from that seed and the (deterministic) world. Clients detect their own touches and *claim*;
// the host settles races ("first claim wins"), awards points and ends the round.
import * as THREE from 'three';
import { h, rng, pick, BOUNDS, nsX, ewZ } from './layout.js';
import { toon, LAYER_FX } from './toon.js';

export const COLORS = ['#e4402b', '#2f7fbf', '#3f9a6a', '#f2a93b', '#7b4fb0', '#ff6fa8', '#18b8d6', '#3d3a4f'];
export const KINDS = {
  stars: { ic: '⭐', name: 'Pluie d\'étoiles', dur: 100 },
  race: { ic: '💫', name: 'Course des anneaux', dur: 160 },
  hunt: { ic: '🔍', name: 'Chasse au trésor', dur: 150 },
  king: { ic: '👑', name: 'Roi du toit', dur: 120 },
  courier: { ic: '📦', name: 'Livraison éclair', dur: 150 },
};
const ORDER = ['stars', 'race', 'hunt', 'king', 'courier'];
const TREASURES = ['la tuque dorée', 'le bagel de cristal', 'la clé de la croix', 'le chat en porcelaine de Mme Tremblay', 'le BIXI miniature en or', 'la cuillère à sirop d\'érable'];
const KING_T = 15, RINGS = 8, STARS = 18;
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------------------------------------------------------------- shared visuals
const beamMat = (col) => new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 }, uCol: { value: new THREE.Color(col) }, uA: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  vertexShader: 'varying vec2 vUv; varying float vF; void main(){ vUv = uv; vec3 o = (modelMatrix * vec4(0.0,0.0,0.0,1.0)).xyz; vF = smoothstep(5.0, 18.0, distance(o, cameraPosition)); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'uniform float uTime, uA; uniform vec3 uCol; varying vec2 vUv; varying float vF; void main(){ float a = pow(1.0 - vUv.y, 1.6) * (0.4 + 0.15 * sin(uTime * 3.0 + vUv.y * 14.0)) * vF * uA; gl_FragColor = vec4(uCol * a, 1.0); }',
});
function beam(col, height = 70, r = 0.7) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.6, r, height, 16, 1, true), beamMat(col));
  m.position.y = height / 2; m.layers.set(LAYER_FX); m.renderOrder = 2; return m;
}
function starGeo() {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + Math.PI / 2, r = i % 2 ? 0.26 : 0.6; i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.18, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.06, bevelSegments: 2 }); g.center(); return g;
}
const G = { star: starGeo(), ring: new THREE.TorusGeometry(3, 0.28, 12, 48), gem: new THREE.OctahedronGeometry(0.45, 0), box: new THREE.BoxGeometry(0.7, 0.55, 0.7), crown: new THREE.CylinderGeometry(0.7, 0.55, 0.6, 8, 1, true) };
const M = {
  star: toon('#ffd84a', { emissive: '#ffb300', emissiveIntensity: 0.55 }),
  ring: toon('#5ff0ff', { emissive: '#18b8d6', emissiveIntensity: 0.5 }), ringNext: toon('#ffe066', { emissive: '#ff9d00', emissiveIntensity: 0.8 }), ringDone: toon('#9aa3b5', { transparent: true, opacity: 0.35 }),
  gem: toon('#ffcf4a', { emissive: '#ff8a00', emissiveIntensity: 0.6 }), box: toon('#c98a4b'), crown: toon('#ffd84a', { emissive: '#ffb300', emissiveIntensity: 0.6, side: THREE.DoubleSide }),
};

// ---------------------------------------------------------------- the mission manager
export class Missions {
  constructor(scene, world, roofs, net, hooks) {
    Object.assign(this, { scene, world, net, hooks });
    this.roofs = roofs.filter((r) => r.x0 > BOUNDS.x0 && r.x1 < BOUNDS.x1 && r.z0 > BOUNDS.z0 && r.z1 < BOUNDS.z1);
    this.pts = {};             // match points per player id
    this.cur = null;           // current round
    this.round = 0;
    this.prog = {};            // live progress per player id this round
    this.best = (() => { try { return JSON.parse(localStorage.getItem('plateau-best') || '{}'); } catch (e) { return {}; } })();
    this.clock = 0; this.auto = true; this.nextAt = 0; this.kindI = Math.floor(Math.random() * ORDER.length);
    this.setNet(net);
  }
  setNet(net) {
    this.net = net;
    net.on('mis', (m) => { if (!this.cur || m.round > this.cur.round || (m.round === this.cur.round && m.seed !== this.cur.seed)) this.begin(m); });
    net.on('claim', (m, p) => { if (this.net.isHost) this.settle(p.id, m.item, m.val, m.round); });
    net.on('award', (m) => this.onAward(m));
    net.on('end', (m) => this.onEnd(m));
    net.on('prog', (m, p) => { if (this.cur && m.round === this.cur.round) this.prog[p.id] = m.v; });
    net.on('join', (p) => {
      if (!this.net.isHost || !this.cur || this.cur.phase === 'done') return;
      const c = this.cur, el = (this.now() - c.startAt) / 1000;
      this.net.send({ t: 'mis', round: c.round, kind: c.kind, seed: c.seed, dur: c.dur, count: Math.max(0, -el), elapsed: Math.max(0, el), pts: this.pts, awarded: [...c.awarded] }, p.id);
    });
  }
  now() { return this.clock * 1000; }
  get me() { return this.net.id; }
  get active() { return this.cur && this.cur.phase !== 'done'; }
  name(id) { return id === this.me ? this.hooks.myName() : this.net.peers.get(id)?.name || 'Ami'; }
  color(id) { return id === this.me ? this.hooks.myColor() : COLORS[this.net.peers.get(id)?.color | 0] || '#888'; }

  // host: launch the next round
  start(kind) {
    if (!this.net.isHost) return;
    kind = kind || ORDER[this.kindI++ % ORDER.length];
    const round = Math.max(this.round, this.cur?.round || 0) + 1;
    const m = { t: 'mis', round, kind, seed: (Math.random() * 1e9) | 0, dur: KINDS[kind].dur, count: 4, elapsed: 0, pts: this.pts };
    this.net.send(m); this.begin(m);
  }
  stop() { if (this.cur) this.clear(); this.cur = null; this.auto = false; $('#results').classList.remove('show'); document.body.classList.remove('mission'); }

  begin(m) {
    this.clear();
    this.round = m.round; this.prog = {}; if (m.pts) this.pts = { ...m.pts };
    const R = rng(m.seed), c = this.cur = { round: m.round, kind: m.kind, seed: m.seed, dur: m.dur, phase: 'count', startAt: this.now() + (m.count || 0) * 1000 - (m.elapsed || 0) * 1000, awarded: new Map(m.awarded || []), objs: [], score: {}, mine: 0, step: 0, claimed: new Set(), group: new THREE.Group(), lastCount: 99 };
    this.scene.add(c.group);
    this.build(c, R);
    for (const [item, who] of c.awarded) this.applyAward(item, who, true);
    $('#results').classList.remove('show'); document.body.classList.add('mission');
    this.hooks.onBegin?.(c);
    this.drawCard();
  }
  clear() { if (this.cur) { this.scene.remove(this.cur.group); this.cur.group.traverse((o) => { if (o.material?.uniforms) o.material.dispose(); }); } }

  // ---------------------------------------------------------- level generation from the seed
  build(c, R) {
    const W = this.world, S = W.spots, roofs = this.roofs, g = c.group;
    const groundSpots = [...S.balcony, ...S.back, ...S.shed, ...S.alley, S.fountain, S.gazebo, S.pavilion, S.truck, S.shelter, S.church].filter(Boolean);
    const roofSpot = (r) => ({ x: r.x0 + 1 + R() * (r.x1 - r.x0 - 2), y: r.y, z: r.z0 + 1 + R() * (r.z1 - r.z0 - 2) });
    const inside = (x, z) => x > BOUNDS.x0 + 4 && x < BOUNDS.x1 - 4 && z > BOUNDS.z0 + 4 && z < BOUNDS.z1 - 4;
    if (c.kind === 'stars') {
      c.items = [];
      for (let i = 0; i < STARS; i++) {
        const t = R(); let p;
        if (t < 0.4) { const s = pick(groundSpots, R); p = new THREE.Vector3(s.x, s.y + 1.1, s.z); }
        else if (t < 0.7) { const s = roofSpot(pick(roofs, R)); p = new THREE.Vector3(s.x, s.y + 1.2, s.z); }
        else { const x = BOUNDS.x0 + 10 + R() * (BOUNDS.x1 - BOUNDS.x0 - 20), z = BOUNDS.z0 + 10 + R() * (BOUNDS.z1 - BOUNDS.z0 - 20); p = new THREE.Vector3(x, h(z) + 18 + R() * 30, z); }
        const o = new THREE.Group(); o.position.copy(p); g.add(o);
        const st = new THREE.Mesh(G.star, M.star); st.castShadow = true; o.add(st);
        const b = beam('#ffd84a', 40, 0.5); o.add(b);
        c.items.push({ p, o, st, b, got: null, ph: R() * 6 });
      }
    }
    if (c.kind === 'race') {
      c.items = [];
      let x = nsX(Math.floor(R() * 5) - 2), z = BOUNDS.z0 + 40 + R() * (BOUNDS.z1 - BOUNDS.z0 - 80);
      const pts = [];
      for (let i = 0; i < RINGS; i++) {
        const air = i % 2 === 1 || R() < 0.3;
        if (i) {
          for (let tries = 0; tries < 30; tries++) {
            let nx, nz;
            if (air) { const a = R() * Math.PI * 2, d = 45 + R() * 45; nx = x + Math.cos(a) * d; nz = z + Math.sin(a) * d; }
            else if (R() < 0.5) { nx = nsX(Math.round(x / 90 + (R() - 0.5) * 2)); nz = z + (R() - 0.5) * 150; }
            else { const m = Math.round((z + 160) / 110 - 1 + (R() - 0.5) * 2); nz = ewZ(Math.max(-3, Math.min(3, m))); nx = x + (R() - 0.5) * 150; }
            if (inside(nx, nz) && Math.hypot(nx - x, nz - z) > 35) { x = nx; z = nz; break; }
          }
        }
        pts.push(new THREE.Vector3(x, h(z) + (air ? 22 + R() * 22 : 3.4), z));
      }
      pts.forEach((p, i) => {
        const o = new THREE.Mesh(G.ring, M.ring); o.position.copy(p);
        const nx = pts[i + 1] || pts[i - 1]; o.lookAt(nx.x, p.y, nx.z); o.castShadow = true; g.add(o);
        const b = beam('#ffe066', 60, 0.6); b.position.y = 30 - 3; b.visible = false; o.add(b); b.rotation.x = 0;
        c.items.push({ p, o, b });
      });
      // beams should stay vertical even though rings are rotated: re-parent into the group
      for (const it of c.items) { it.o.remove(it.b); it.b.position.set(it.p.x, it.p.y + 3 + 30, it.p.z); g.add(it.b); }
    }
    if (c.kind === 'hunt') {
      const pool = [...groundSpots, ...roofs.map(roofSpot)];
      const s = pick(pool, R);
      c.treasure = pick(TREASURES, R);
      const p = new THREE.Vector3(s.x, s.y + 0.8, s.z), o = new THREE.Group(); o.position.copy(p); g.add(o);
      const gem = new THREE.Mesh(G.gem, M.gem); gem.castShadow = true; o.add(gem);
      const b = beam('#ffcf4a', 80, 0.8); b.visible = false; o.add(b);
      const a = R() * Math.PI * 2, d = R() * 26;
      c.items = [{ p, o, gem, b }]; c.hint = { x: p.x + Math.cos(a) * d, z: p.z + Math.sin(a) * d, r: 38 };
    }
    if (c.kind === 'king') {
      const big = roofs.filter((r) => (r.x1 - r.x0) * (r.z1 - r.z0) > 70);
      const r = pick(big.length ? big : roofs, R); c.roof = r;
      const fence = new THREE.Group(); g.add(fence);
      const fm = beamMat('#ffd84a');
      const wall = (x0, z0, x1, z1) => { const l = Math.hypot(x1 - x0, z1 - z0); const m = new THREE.Mesh(new THREE.PlaneGeometry(l, 3), fm); m.position.set((x0 + x1) / 2, r.y + 1.5, (z0 + z1) / 2); m.rotation.y = Math.atan2(-(z1 - z0), x1 - x0); m.layers.set(LAYER_FX); fence.add(m); };
      const e = 0.15; wall(r.x0 - e, r.z0 - e, r.x1 + e, r.z0 - e); wall(r.x1 + e, r.z0 - e, r.x1 + e, r.z1 + e); wall(r.x1 + e, r.z1 + e, r.x0 - e, r.z1 + e); wall(r.x0 - e, r.z1 + e, r.x0 - e, r.z0 - e);
      const crown = new THREE.Mesh(G.crown, M.crown); crown.position.set(r.x, r.y + 5, r.z); g.add(crown);
      const b = beam('#ffd84a', 90, 1.2); b.position.set(r.x, r.y + 45, r.z); g.add(b);
      c.items = [{ p: new THREE.Vector3(r.x, r.y + 1, r.z), o: crown, b }];
    }
    if (c.kind === 'courier') {
      const shop = pick(W.shops, R);
      const far = S.doors.filter((d) => { const l = Math.hypot(d.x - shop.x, d.z - shop.z); return l > 120 && l < 320; });
      const door = pick(far.length ? far : S.doors, R);
      const mk = (x, y, z, col, box) => { const o = new THREE.Group(); o.position.set(x, y, z); g.add(o); o.add(beam(col, 70, 0.9)); if (box) { const bx = new THREE.Mesh(G.box, M.box); bx.position.y = 1; bx.castShadow = true; o.add(bx); } return o; };
      c.items = [
        { p: new THREE.Vector3(shop.x, h(shop.z) + 0.2, shop.z), o: mk(shop.x, h(shop.z) + 0.2, shop.z, '#2fd0ee', true), label: shop.name },
        { p: new THREE.Vector3(door.x, door.y, door.z), o: mk(door.x, door.y, door.z, '#5ff08a', false), label: `${door.num}` },
      ];
      c.items[1].o.visible = false;
      c.shop = shop.name; c.addr = door.num;
    }
  }

  // ---------------------------------------------------------- per frame
  update(dt, player, t) {
    this.clock += dt;
    const now = this.now();
    if (!this.cur) {
      if (this.net.isHost && this.auto && this.nextAt && now > this.nextAt) { this.nextAt = 0; this.start(); }
      return;
    }
    const c = this.cur, el = (now - c.startAt) / 1000;
    for (const o of c.group.children) o.traverse?.((q) => { if (q.material?.uniforms?.uTime) q.material.uniforms.uTime.value = t; });
    // countdown
    if (c.phase === 'count') {
      const n = Math.ceil(-el);
      if (n !== c.lastCount && n <= 3 && n >= 1) { c.lastCount = n; this.flashCount(String(n)); this.hooks.sfx('tick'); }
      if (el >= 0) { c.phase = 'play'; this.flashCount('GO!'); this.hooks.sfx('go'); }
    }
    this.animate(c, dt, t, el);
    if (c.phase === 'play') {
      this.detect(c, player, dt, el);
      if (this.net.isHost && el > c.dur) this.finish('time');
    }
    if (c.phase === 'done' && this.net.isHost && this.auto && this.nextAt && now > this.nextAt) { this.nextAt = 0; this.start(); }
    this.drawCard(el);
  }
  animate(c, dt, t, el) {
    if (c.kind === 'stars') for (const it of c.items) { if (it.got && it.o.visible) { it.o.scale.multiplyScalar(1 + dt * 7); if (it.o.scale.x > 3) it.o.visible = false; } else if (!it.got) { it.st.rotation.y = t * 2 + it.ph; it.st.position.y = Math.sin(t * 2.5 + it.ph) * 0.15; } }
    if (c.kind === 'race') c.items.forEach((it, i) => { const nx = i === c.step; it.o.material = i < c.step ? M.ringDone : nx ? M.ringNext : M.ring; it.b.visible = nx && c.phase !== 'done'; const s = nx ? 1 + Math.sin(t * 5) * 0.06 : 1; it.o.scale.setScalar(s); });
    if (c.kind === 'hunt') { const it = c.items[0]; it.gem.rotation.y = t * 1.6; it.gem.position.y = Math.sin(t * 2) * 0.12; it.b.visible = el > c.dur * 0.6 && !c.awarded.size; }
    if (c.kind === 'king') { const it = c.items[0]; it.o.rotation.y = t; it.o.position.y = c.roof.y + 5 + Math.sin(t * 2) * 0.3; }
    if (c.kind === 'courier') { c.items[0].o.visible = c.step === 0; c.items[1].o.visible = c.step === 1; c.items[0].o.children[1] && (c.items[0].o.children[1].rotation.y = t); }
  }
  detect(c, player, dt, el) {
    const P = player.pos, me = this.me;
    const near = (p, r, ry = r) => Math.hypot(p.x - P.x, p.z - P.z) < r && Math.abs(p.y - (P.y + 0.9)) < ry;
    if (c.kind === 'stars') c.items.forEach((it, i) => { if (!it.got && !c.claimed.has(i) && near(it.p, 1.5, 1.8)) this.claim(i); });
    if (c.kind === 'race' && c.step < RINGS) {
      const it = c.items[c.step];
      if (P.clone().setY(P.y + 0.9).distanceTo(it.p) < 3.4) {
        c.step++; this.hooks.sfx('ring', c.step); this.sendProg(c.step);
        if (c.step === RINGS) this.claim('win', el);
      }
    }
    if (c.kind === 'hunt' && !c.awarded.size && near(c.items[0].p, 1.6, 2)) this.claim('win', el);
    if (c.kind === 'king') {
      const r = c.roof;
      const on = P.x > r.x0 && P.x < r.x1 && P.z > r.z0 && P.z < r.z1 && P.y > r.y - 0.3 && P.y < r.y + 3.5;
      c.onRoof = on;
      if (on) { c.mine = Math.min(KING_T, c.mine + dt); c.sendT = (c.sendT || 0) - dt; if (c.sendT < 0) { c.sendT = 0.5; this.sendProg(+c.mine.toFixed(1)); } }
      if (c.mine >= KING_T) this.claim('win', el);
    }
    if (c.kind === 'courier') {
      const it = c.items[c.step];
      if (it && near(it.p, 2.2, 2.6)) {
        c.step++; this.sendProg(c.step); this.hooks.sfx('ring', c.step * 3);
        if (c.step === 1) { player.parcel = true; this.hooks.toast?.(`📦 Colis récupéré! Livre-le au ${c.addr}`); }
        if (c.step === 2) { player.parcel = false; this.claim('win', el); }
      }
    }
  }
  sendProg(v) { this.prog[this.me] = v; this.net.send({ t: 'prog', round: this.cur.round, v }); }
  claim(item, val) {
    const c = this.cur; if (c.claimed.has(item)) return; c.claimed.add(item);
    if (this.net.isHost) this.settle(this.me, item, val, c.round);
    else this.net.send({ t: 'claim', round: c.round, item, val }, this.net.hostId);
  }
  // host: first valid claim wins the item
  settle(who, item, val, round) {
    const c = this.cur; if (!c || round !== c.round || c.phase === 'done' || c.awarded.has(item)) return;
    const m = { t: 'award', round, item, who, val };
    this.net.send(m); this.onAward(m);
    if (item === 'win') this.finish('win', who, val);
    else if (c.kind === 'stars' && c.awarded.size >= c.items.length) this.finish('all');
  }
  onAward(m) {
    const c = this.cur; if (!c || m.round !== c.round || c.awarded.has(m.item)) return;
    c.awarded.set(m.item, m.who); this.applyAward(m.item, m.who, false);
  }
  applyAward(item, who, silent) {
    const c = this.cur;
    if (c.kind === 'stars' && item !== 'win') {
      const it = c.items[item]; if (!it) return; it.got = who; it.b.visible = false;
      c.score[who] = (c.score[who] || 0) + 1; this.prog[who] = c.score[who];
      if (!silent) { this.pts[who] = (this.pts[who] || 0) + 1; if (who === this.me) { this.hooks.sfx('star', c.score[who]); this.hooks.burst(it.p); this.hooks.float('+1 ⭐'); } }
    }
  }
  // host: close the round
  finish(reason, winner, val) {
    const c = this.cur; if (!c || c.phase === 'done') return;
    if (!winner) {
      let best = 0;
      const table = c.kind === 'stars' ? c.score : this.prog;
      for (const [id, v] of Object.entries(table)) if (v > best) { best = v; winner = id; }
    }
    if (winner) this.pts[winner] = (this.pts[winner] || 0) + 3;
    const m = { t: 'end', round: c.round, reason, winner: winner || null, val, pts: this.pts, score: c.kind === 'stars' ? c.score : this.prog };
    this.net.send(m); this.onEnd(m);
  }
  onEnd(m) {
    const c = this.cur; if (!c || m.round !== c.round || c.phase === 'done') return;
    c.phase = 'done'; c.winner = m.winner; this.pts = { ...m.pts };
    if (m.winner === this.me) this.hooks.sfx('win'); else this.hooks.sfx('lose');
    this.hooks.onEnd?.(c, m);
    // solo time trial: personal best
    let pb = '';
    if (this.net.count === 1 && m.winner === this.me && m.val) {
      const k = c.kind, prev = this.best[k];
      if (!prev || m.val < prev) { this.best[k] = +m.val.toFixed(1); try { localStorage.setItem('plateau-best', JSON.stringify(this.best)); } catch (e) { /* */ } pb = prev ? `Nouveau record! (avant: ${prev.toFixed(1)} s)` : 'Premier record!'; }
      else pb = `Record: ${prev.toFixed(1)} s`;
    }
    this.showResults(c, m, pb);
    setTimeout(() => { if (this.cur === c) { this.clear(); this.cur = null; document.body.classList.remove('mission'); } }, 2500);
    if (this.net.isHost && this.auto && this.net.count > 1) this.nextAt = this.now() + 12000;
  }

  // ---------------------------------------------------------- UI
  goalText(c) {
    if (c.kind === 'stars') return `Attrape le plus d'étoiles · ${c.items.length - c.awarded.size} restantes`;
    if (c.kind === 'race') return c.step < RINGS ? `Traverse les anneaux dans l'ordre · ${c.step}/${RINGS}` : 'Arrivé!';
    if (c.kind === 'hunt') return `Trouve ${c.treasure}`;
    if (c.kind === 'king') return `Reste ${KING_T} s sur le toit doré · ${c.mine.toFixed(1)} s${c.onRoof ? ' 👑' : ''}`;
    if (c.kind === 'courier') return c.step === 0 ? `Prends le colis chez ${c.shop}` : c.step === 1 ? `Livre-le au ${c.addr}` : 'Livré!';
    return '';
  }
  heat(player) {   // treasure hunt: hot / cold
    const c = this.cur; if (!c || c.kind !== 'hunt') return null;
    const d = player.pos.distanceTo(c.items[0].p);
    return d < 12 ? ['Brûlant! 🔥', 1] : d < 30 ? ['Très chaud', 0.8] : d < 60 ? ['Chaud', 0.6] : d < 110 ? ['Tiède', 0.4] : d < 180 ? ['Froid', 0.22] : ['Glacial ❄', 0.08];
  }
  drawCard(el = 0) {
    const c = this.cur; if (!c) return;
    const K = KINDS[c.kind];
    $('#misIc').textContent = K.ic; $('#misName').textContent = K.name;
    $('#misGoal').textContent = this.goalText(c);
    const left = c.phase === 'count' ? c.dur : Math.max(0, c.dur - el);
    $('#misTime').textContent = c.phase === 'done' ? 'Terminé' : `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
    $('#misTime').classList.toggle('late', left < 15 && c.phase === 'play');
    $('#misBar').style.width = (c.phase === 'count' ? 100 : left / c.dur * 100) + '%';
    const heat = this.heat(this.hooks.player);
    $('#misHeat').style.display = heat ? 'flex' : 'none';
    if (heat) { $('#heatTxt').textContent = heat[0]; $('#heatBar').style.width = heat[1] * 100 + '%'; $('#heatBar').style.background = `hsl(${(1 - heat[1]) * 210},85%,55%)`; }
  }
  flashCount(txt) {
    const el = $('#count'); el.textContent = txt; el.classList.remove('go', 'show'); void el.offsetWidth; el.classList.add('show'); if (txt === 'GO!') el.classList.add('go');
  }
  showResults(c, m, pb) {
    const ids = [this.me, ...this.net.peers.keys()];
    const rows = ids.map((id) => ({ id, pts: this.pts[id] || 0, sc: m.score?.[id] ?? 0 })).sort((a, b) => b.pts - a.pts);
    const wn = m.winner ? this.name(m.winner) : null;
    $('#resTitle').textContent = m.winner === this.me ? 'Victoire!' : wn ? `${wn} gagne!` : 'Temps écoulé!';
    $('#resTitle').className = m.winner === this.me ? 'win' : '';
    const unit = { stars: '⭐', race: 'anneaux', king: 's', courier: 'étapes', hunt: '' }[c.kind];
    $('#resSub').textContent = `${KINDS[c.kind].ic} ${KINDS[c.kind].name}` + (m.val && m.winner ? ` · ${(+m.val).toFixed(1)} s` : '') + (pb ? ` · ${pb}` : '');
    $('#resList').innerHTML = rows.map((r, i) => `<li class="${r.id === this.me ? 'me' : ''}"><span class="rk">${['🥇', '🥈', '🥉'][i] || i + 1}</span><i style="background:${this.color(r.id)}"></i><b>${esc(this.name(r.id))}</b><small>${unit && c.kind !== 'hunt' ? `${r.sc} ${unit}` : r.id === m.winner ? 'trouvé!' : ''}</small><em>${r.pts} pts</em></li>`).join('');
    const solo = this.net.count === 1;
    $('#resNext').textContent = solo ? 'Mission suivante ▸' : this.net.isHost ? 'Lancer maintenant ▸' : 'Prochaine mission bientôt…';
    $('#resNext').disabled = !solo && !this.net.isHost;
    $('#results').classList.add('show');
  }
  drawBoard() {
    const ids = [this.me, ...this.net.peers.keys()];
    const c = this.cur;
    const rows = ids.map((id) => ({ id, pts: this.pts[id] || 0, live: c ? (c.kind === 'stars' ? c.score[id] || 0 : id === this.me ? (c.kind === 'king' ? +c.mine.toFixed(0) : c.step) : this.prog[id] || 0) : null })).sort((a, b) => b.pts - a.pts || (b.live || 0) - (a.live || 0));
    $('#board').innerHTML = rows.map((r) => `<li class="${r.id === this.me ? 'me' : ''}"><i style="background:${this.color(r.id)}"></i><b>${esc(this.name(r.id))}${r.id === this.net.hostId && this.net.count > 1 ? ' <small>hôte</small>' : ''}</b>${c && c.phase !== 'done' && c.kind !== 'hunt' ? `<span>${r.live}</span>` : ''}<em>${r.pts}</em></li>`).join('');
  }
  // where should the arrow point for me?
  target() {
    const c = this.cur; if (!c || c.phase === 'done') return null;
    if (c.kind === 'race') return c.items[c.step]?.p || null;
    if (c.kind === 'courier') return c.items[c.step]?.p || null;
    if (c.kind === 'king') return c.items[0].p;
    if (c.kind === 'stars') { let best = null, bd = 1e9; const P = this.hooks.player.pos; for (const it of c.items) if (!it.got) { const d = it.p.distanceTo(P); if (d < bd) { bd = d; best = it.p; } } return best; }
    if (c.kind === 'hunt') return null;   // no cheating: hot/cold + map circle only
    return null;
  }
  marks() {
    const c = this.cur; if (!c || c.phase === 'done') return [];
    if (c.kind === 'stars') return c.items.filter((it) => !it.got).map((it) => ({ x: it.p.x, z: it.p.z, c: '#ffd84a', r: 6 }));
    if (c.kind === 'race') return c.items.slice(c.step, c.step + 3).map((it, i) => ({ x: it.p.x, z: it.p.z, c: i ? '#5ff0ff' : '#ffb300', r: i ? 7 : 11 }));
    if (c.kind === 'hunt') return [{ x: c.hint.x, z: c.hint.z, c: 'rgba(255,190,40,.28)', r: c.hint.r * 2, ring: true }];
    if (c.kind === 'king') return [{ x: c.roof.x, z: c.roof.z, c: '#ffd84a', r: 12 }];
    if (c.kind === 'courier') { const it = c.items[c.step]; return it ? [{ x: it.p.x, z: it.p.z, c: c.step ? '#5ff08a' : '#2fd0ee', r: 11 }] : []; }
    return [];
  }
}

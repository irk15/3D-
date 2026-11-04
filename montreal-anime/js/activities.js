// activities.js — things to do around all three cities:
//  • street races: drive into a yellow start marker; checkpoints ring the streets; beat the par for cash,
//    and your best time is saved
//  • stunt ramps on quiet streets; any big jump in a car pays a STUNT BONUS (with a slow-motion moment)
//  • hidden golden maple leaves on parks and rooftops in Toronto and Ottawa ($100 each, fly to find them)
import * as THREE from 'three';
import { h, CURB, nsX, ewZ, nsHW, ewHW } from './layout.js';
import { LAYER_FX, gradient } from './toon.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// corners of each race, as street intersections [k, m]; checkpoints are added at every crossing on the way
const RACES = [
  { key: 'mtl-plateau', city: 'Montréal', name: 'Plateau Loop', corners: [[0, -2], [0, 2], [-2, 2], [-2, -2], [0, -2]], par: 75 },
  { key: 'to-downtown', city: 'Toronto', name: 'King & Yonge Sprint', corners: [[41, -3], [41, 2], [36, 2], [36, -3], [41, -3]], par: 95 },
  { key: 'to-lakeshore', city: 'Toronto', name: 'Lake Shore Run', corners: [[45, 3], [35, 3], [35, -2], [45, -2], [45, 3]], par: 120 },
  { key: 'ot-hill', city: 'Ottawa', name: 'Parliament Dash', corners: [[-43, 2], [-43, -3], [-36, -3], [-36, 2], [-43, 2]], par: 100 },
];
// stunt ramps: [k or null, m or null, along, dir] — a wedge in the lane, rising in the direction of travel
const RAMPS = [[2, null, -40, 1], [2, null, 120, -1], [null, 2, 40, 1], [42, null, -250, 1], [42, null, 80, -1], [37, null, -120, 1], [null, -2, 3700, 1], [null, -2, 3300, -1], [-45, null, -200, 1], [-38, null, -300, 1], [-35, null, 0, -1], [null, 1, -3800, 1]];

export class Activities {
  constructor(scene, world, save, ui) {
    this.w = world; this.save = save; this.ui = ui; this.t = 0; this.race = null; this.air = 0; this.airMax = 0;
    save.races = save.races || {}; save.leaves = save.leaves || [];
    const C = world.colliders;
    // ---- race start markers (a glowing cylinder you drive into) and the checkpoint ring
    const coronaM = new THREE.MeshBasicMaterial({ color: 0xffd447, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide });
    this.starts = RACES.map((r) => {
      const pts = [];
      for (let i = 0; i < r.corners.length - 1; i++) {
        const [k0, m0] = r.corners[i], [k1, m1] = r.corners[i + 1];
        if (k0 === k1) for (let m = m0; m !== m1; m += Math.sign(m1 - m0)) pts.push([k0, m + Math.sign(m1 - m0)]);
        else for (let k = k0; k !== k1; k += Math.sign(k1 - k0)) pts.push([k + Math.sign(k1 - k0), m0]);
      }
      const cps = pts.map(([k, m]) => new THREE.Vector3(nsX(k), h(ewZ(m)), ewZ(m)));
      const [k, m] = r.corners[0], sx = nsX(k), sz = ewZ(m) + (r.corners[1][1] > m ? 14 : r.corners[1][1] < m ? -14 : 0), sxx = sx + (r.corners[1][0] > k ? 14 : r.corners[1][0] < k ? -14 : 0);
      const pos = new THREE.Vector3(sxx, h(sz), sz);
      const mk = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 2.2, 32, 1, true), coronaM); mk.position.set(pos.x, pos.y + 1.1, pos.z); mk.layers.set(LAYER_FX); scene.add(mk);
      return { ...r, pos, cps, mk };
    });
    const ringM = new THREE.MeshBasicMaterial({ color: 0xffd447, transparent: true, opacity: 0.8, depthWrite: false });
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(5.2, 0.35, 8, 40), ringM); this.ring.layers.set(LAYER_FX); this.ring.visible = false; scene.add(this.ring);
    this.ring2 = new THREE.Mesh(new THREE.TorusGeometry(5.2, 0.25, 8, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false })); this.ring2.layers.set(LAYER_FX); this.ring2.visible = false; scene.add(this.ring2);
    // ---- stunt ramps (one merged mesh) with ramp colliders
    const geos = [];
    for (const [k, m, along, dir] of RAMPS) {
      const ns = k !== null, len = 11, hh = 2.4, wdt = 4.2;
      const cx = ns ? nsX(k) + 2.3 * dir * -1 : along, cz = ns ? along : ewZ(m) + 2.3 * dir;
      const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(len, 0); s.lineTo(len, hh); s.closePath();
      const g = new THREE.ExtrudeGeometry(s, { depth: wdt, bevelEnabled: false }); g.translate(-len / 2, 0, -wdt / 2);
      // local +x is the climb direction
      const yaw = ns ? (dir > 0 ? -Math.PI / 2 : Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
      const y = h(cz) - 0.02; g.rotateY(yaw); g.translate(cx, y, cz); geos.push(g);
      const a0 = (ns ? cz : cx) - dir * len / 2, a1 = (ns ? cz : cx) + dir * len / 2;
      C.add({ x0: ns ? cx - wdt / 2 : Math.min(a0, a1), x1: ns ? cx + wdt / 2 : Math.max(a0, a1), z0: ns ? Math.min(a0, a1) : cz - wdt / 2, z1: ns ? Math.max(a0, a1) : cz + wdt / 2, y0: y - 1, t: 'ramp', axis: ns ? 'z' : 'x', a0, a1, r0: h(ns ? a0 : cz), r1: h(ns ? a1 : cz) + hh, nowalk: false });
    }
    { const g = mergeGeometries(geos.map((q) => q.toNonIndexed())); g.computeVertexNormals(); const m = new THREE.Mesh(g, new THREE.MeshToonMaterial({ color: 0xf2b43c, gradientMap: gradient })); m.castShadow = true; m.receiveShadow = true; scene.add(m); this.rampMarks = RAMPS.map(([k, m2, along, dir]) => ({ x: k !== null ? nsX(k) - 2.3 * dir : along, z: k !== null ? along : ewZ(m2) + 2.3 * dir })); }
    // ---- hidden golden maple leaves (Toronto and Ottawa)
    const leaf = new THREE.Shape(); const P = [[0, 1], [0.18, 0.55], [0.55, 0.75], [0.45, 0.35], [0.85, 0.3], [0.6, 0.05], [0.7, -0.15], [0.2, -0.1], [0.08, -0.45], [0, -0.45]];
    leaf.moveTo(0, 1); for (const [x, y] of P.slice(1)) leaf.lineTo(x, y); for (const [x, y] of P.slice().reverse()) leaf.lineTo(-x, y);
    const lg = new THREE.ExtrudeGeometry(leaf, { depth: 0.12, bevelEnabled: false }); lg.translate(0, 0, -0.06); lg.scale(0.7, 0.7, 0.7);
    this.leaves = [];
    let seed = 99; const R = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (const [k0, k1, m0, m1] of [[34, 46, -4, 4], [-46, -34, -4, 3]]) for (let i = 0; i < 10; i++) {
      for (let t = 0; t < 20; t++) {
        const k = k0 + Math.floor(R() * (k1 - k0)), m = m0 + Math.floor(R() * (m1 - m0));
        const x = nsX(k) + nsHW(k) + 10 + R() * (90 - 2 * nsHW(k) - 20), z = ewZ(m) + ewHW(m) + 10 + R() * 70;
        const y = C.ground(x, z, 9999, 0.3); if (!isFinite(y)) continue;
        this.leaves.push({ id: this.leaves.length, x, y: y + 1.1, z, got: save.leaves.includes(this.leaves.length) }); break;
      }
    }
    this.leafIM = new THREE.InstancedMesh(lg, new THREE.MeshLambertMaterial({ color: 0xffc23a, emissive: 0xc8102e, emissiveIntensity: 0.6 }), this.leaves.length);
    this.leafIM.frustumCulled = false; scene.add(this.leafIM); this._o = new THREE.Object3D();
    this.el = { box: document.getElementById('act'), name: document.getElementById('actName'), info: document.getElementById('actInfo') };
  }
  // where the objective arrow should point
  target() { if (!this.race) return null; return this.race.cp < this.race.r.cps.length ? this.race.r.cps[this.race.cp] : null; }
  marks() {
    const out = [];
    if (this.race) { const c = this.target(); if (c) out.push({ x: c.x, z: c.z, c: '#ffd447', r: 12, s: '#000' }); }
    else for (const s of this.starts) out.push({ x: s.pos.x, z: s.pos.z, c: '#ffd447', r: 9, s: '#7a5a00' });
    return out;
  }
  fmt(t) { const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`; }
  update(dt, player, car, onCash) {
    this.t += dt; const ui = this.ui;
    for (const s of this.starts) { s.mk.visible = !this.race && Math.abs(s.pos.x - player.pos.x) < 600; s.mk.rotation.y += dt; }
    // ---- races
    if (!this.race && car) for (const s of this.starts) {
      if (Math.hypot(car.pos.x - s.pos.x, car.pos.z - s.pos.z) < 4.5) { this.race = { r: s, cp: 0, t: -3, count: 3 }; ui.toast?.(`🏁 ${s.name}`); ui.sfx?.('tick'); break; }
    }
    const R = this.race, e = this.el;
    if (R) {
      R.t += dt;
      if (R.t < 0 && Math.ceil(-R.t) !== R.count) { R.count = Math.ceil(-R.t); ui.float?.(String(R.count)); ui.sfx?.('tick'); }
      if (R.t >= 0 && !R.go) { R.go = true; ui.float?.('GO!'); ui.sfx?.('go'); }
      const c = this.target();
      if (c) {
        this.ring.visible = this.ring2.visible = true; this.ring.position.set(c.x, c.y + 3.2, c.z); this.ring2.position.copy(this.ring.position);
        const nx = R.r.cps[R.cp + 1] || c; this.ring.lookAt(nx.x, c.y + 3.2, nx.z); this.ring2.rotation.copy(this.ring.rotation); this.ring2.scale.setScalar(1 + (this.t * 0.8 % 0.5));
        if (car && R.t >= 0 && Math.hypot(car.pos.x - c.x, car.pos.z - c.z) < 9) { R.cp++; ui.sfx?.('ring'); }
      }
      if (R.cp >= R.r.cps.length) {
        const best = this.save.races[R.r.key], pay = R.t < R.r.par ? 250 + Math.round((R.r.par - R.t) * 6) : 60;
        if (!best || R.t < best) this.save.races[R.r.key] = +R.t.toFixed(2);
        onCash(pay); ui.passed?.('race complete', `${this.fmt(R.t)}${!best || R.t < best ? ' · new record' : ''} · $${pay}`); this.end();
      } else if (!car && R.t > 0) { ui.passed?.('race failed', 'you left your car'); this.end(); }
      else if (R.t > R.r.par * 1.8) { ui.passed?.('race failed', 'out of time'); this.end(); }
      if (e.box) { e.box.classList.add('show'); e.name.textContent = R.r.name; const best = this.save.races[R.r.key]; e.info.innerHTML = `<b>${R.t < 0 ? '–' : this.fmt(R.t)}</b> · checkpoint ${Math.min(R.cp + 1, R.r.cps.length)}/${R.r.cps.length} · par ${this.fmt(R.r.par)}${best ? ` · best ${this.fmt(best)}` : ''}`; }
    } else if (e.box) e.box.classList.remove('show');
    // ---- stunt jumps: time in the air, in a car
    if (car) {
      const gy = this.w.colliders.ground(car.pos.x, car.pos.z, car.pos.y + 0.3, 0);
      const up = car.pos.y - gy;
      if (up > 0.6) { this.air += dt; this.airMax = Math.max(this.airMax, up); }
      else if (this.air > 0) {
        if (this.air > 0.9 && this.airMax > 1.6) { const pay = Math.round(this.air * 60 + this.airMax * 12 + car.speed * 2); onCash(pay); ui.passed?.(this.air > 1.8 ? 'insane stunt bonus' : 'stunt bonus', `${this.air.toFixed(1)} s in the air · $${pay}`); }
        this.air = 0; this.airMax = 0;
      }
    } else { this.air = 0; this.airMax = 0; }
    this.slow = car && this.air > 0.35 && this.airMax > 2.5 ? 0.45 : 1;
    // ---- maple leaves
    const o = this._o;
    this.leaves.forEach((L, i) => {
      if (!L.got && Math.hypot(player.pos.x - L.x, player.pos.z - L.z) < 1.6 && Math.abs(player.pos.y + 1 - L.y) < 2) {
        L.got = true; this.save.leaves.push(L.id); onCash(100); const n = this.leaves.filter((q) => q.got).length; ui.passed?.('maple leaf found', `${n} / ${this.leaves.length} · $100`);
      }
      o.position.set(L.x, L.y + Math.sin(this.t * 2 + i) * 0.15, L.z); o.rotation.set(0, this.t * 2 + i, 0); o.scale.setScalar(L.got ? 0.0001 : 1); o.updateMatrix(); this.leafIM.setMatrixAt(i, o.matrix);
    });
    this.leafIM.instanceMatrix.needsUpdate = true;
  }
  end() { this.race = null; this.ring.visible = this.ring2.visible = false; }
}

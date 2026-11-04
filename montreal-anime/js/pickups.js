// pickups.js — GTA-style street pickups: health, body armour, cash and ammo, spinning on the
// sidewalks and shown on the radar. One InstancedMesh per type (four draw calls for all of them).
import * as THREE from 'three';
import { nsX, nsHW, nsSW, ewZ, ewHW, ewSW, h } from './layout.js';

const TYPES = {
  health: { col: 0x58d36a, geo: () => { const g = new THREE.BoxGeometry(0.5, 0.16, 0.16); const v = new THREE.BoxGeometry(0.16, 0.5, 0.16); return merge([g, v]); }, radar: '#58d36a' },
  armour: { col: 0x4aa3ff, geo: () => new THREE.CylinderGeometry(0.3, 0.22, 0.12, 6).rotateX(Math.PI / 2), radar: '#4aa3ff' },
  cash: { col: 0x7cc96a, geo: () => new THREE.BoxGeometry(0.42, 0.2, 0.26), radar: '#7cc96a' },
  ammo: { col: 0xe8b33a, geo: () => new THREE.BoxGeometry(0.36, 0.26, 0.24), radar: '#e8b33a' },
};
function merge(list) {
  // tiny non-indexed merge so we don't need the addons import
  const parts = list.map((g) => g.toNonIndexed()); let n = 0; for (const p of parts) n += p.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let o = 0;
  for (const p of parts) { pos.set(p.attributes.position.array, o * 3); nor.set(p.attributes.normal.array, o * 3); o += p.attributes.position.count; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); return g;
}

export class Pickups {
  constructor(scene, world, onTake) {
    this.w = world; this.onTake = onTake; this.list = []; this.t = 0; this.m = {};
    const C = world.colliders, R = mulberry(77);
    const spots = [];
    for (let k = -2; k <= 2; k++) for (let i = 0; i < 6; i++) { const s = R() < 0.5 ? -1 : 1; spots.push([nsX(k) + s * (nsHW(k) + nsSW(k) * 0.5), -250 + R() * 520]); }
    for (let m = -1; m <= 2; m++) for (let i = 0; i < 3; i++) { const s = R() < 0.5 ? -1 : 1; spots.push([-140 + R() * 280, ewZ(m) + s * (ewHW(m) + ewSW(m) * 0.5)]); }
    const order = ['health', 'armour', 'cash', 'cash', 'ammo', 'health', 'cash', 'armour', 'ammo', 'cash'];
    spots.forEach(([x, z], i) => {
      const y = C.ground(x, z, h(z) + 3, 0.1); if (!isFinite(y) || C.blocked(x, z, 0.3, y, 0.4, y + 1.2)) return;
      this.list.push({ type: order[i % order.length], x, y, z, on: true, back: 0, ph: R() * 6 });
    });
    for (const [k, T] of Object.entries(TYPES)) {
      const n = this.list.filter((p) => p.type === k).length || 1;
      const im = new THREE.InstancedMesh(T.geo(), new THREE.MeshLambertMaterial({ color: T.col, emissive: T.col, emissiveIntensity: 0.55 }), n);
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.frustumCulled = false; scene.add(im); this.m[k] = im;
    }
    this._o = new THREE.Object3D();
  }
  update(dt, player, combat) {
    this.t += dt; const idx = { health: 0, armour: 0, cash: 0, ammo: 0 }, o = this._o;
    for (const p of this.list) {
      if (!p.on) { p.back -= dt; if (p.back <= 0) p.on = true; }
      const i = idx[p.type]++;
      if (p.on && !combat.down && Math.hypot(player.pos.x - p.x, player.pos.z - p.z) < 1.25 && Math.abs(player.pos.y - p.y) < 1.8) {
        if (this.onTake(p.type)) { p.on = false; p.back = 45; }
      }
      o.position.set(p.x, p.y + 0.75 + Math.sin(this.t * 2.4 + p.ph) * 0.12, p.z); o.rotation.set(0, this.t * 1.8 + p.ph, 0); o.scale.setScalar(p.on ? 1 : 0.0001);
      o.updateMatrix(); this.m[p.type].setMatrixAt(i, o.matrix);
    }
    for (const im of Object.values(this.m)) im.instanceMatrix.needsUpdate = true;
  }
  marks() { const out = []; for (const p of this.list) if (p.on) out.push({ x: p.x, z: p.z, c: TYPES[p.type].radar, r: 6, s: '#000' }); return out; }
}
function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// crowd.js — the people who make it feel lived-in: shopkeepers in their doorways (they wave when you
// pass), customers on café terraces, people waiting at the bus shelter with their phones, sitters on the
// park benches and the fountain rim, a queue at the poutine truck, friends chatting on the plaza, office
// workers downtown. Light versions of the Mixamo characters, animation updated less often far away,
// and everyone reacts to a car coming at them.
import * as THREE from 'three';
import { h, nsX, PARK, PLAZA, rng, pick } from './layout.js';
import { makeCharacter } from './actors.js';

const TOPS = ['#d8473f', '#2f7fbf', '#3f9a6a', '#f2b43c', '#7b4fb0', '#e79cb4', '#2f3a44', '#f07c3c', '#5aa04a', '#8ec5b8'];
const TINTS = ['#ffffff', '#ffe9e2', '#e6f1ff', '#fff3d6', '#efe6ff'];

export class Crowd {
  constructor(scene, world) {
    this.list = []; this.w = world; this.fr = 0;
    const R = rng(4517), C = world.colliders;
    const add = (x, z, yaw, mode, o = {}) => {
      const lo = R() < 0.55 ? 'bot_lo' : 'michelle_lo';
      const ch = makeCharacter({ model: lo, top: pick(TOPS, R), pants: pick(['#2b2550', '#3a3a4a', '#2f3550', '#4f6f9f'], R), tint: pick(TINTS, R), scale: 0.92 + R() * 0.14 });
      const y = o.y ?? C.ground(x, z, h(z) + (o.reach ?? 1.2), 0.1);
      ch.root.position.set(x, y, z); ch.root.rotation.y = yaw; scene.add(ch.root);
      const p = { ch, pos: ch.root.position, yaw, mode, home: new THREE.Vector3(x, y, z), t: R() * 6, gest: 0, wave: 0, adt: 0, id: this.list.length, ...o };
      p.dodge = (sx, sz) => { if (p.dodgeT > 0) return; p.dodgeT = 0.45; p.dv = new THREE.Vector3(sx, 0, sz).multiplyScalar(p.mode === 'sit' ? 0 : 5); ch.gesture?.('shake', 1.5); };
      this.list.push(p); return p;
    };
    const face = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);
    // shopkeepers at their doors, facing the street
    world.shops.forEach((s, i) => {
      if (s.kind === 'church' || s.kind === 'poutine' || i % 2) return;
      const k = Math.round(s.x / 90), dir = Math.sign(nsX(k) - s.x) || 1, x = s.x - dir * 0.9;
      add(x, s.z + 0.8, dir > 0 ? Math.PI / 2 : -Math.PI / 2, 'keeper');
      // café terraces: customers on the chairs (see physics.js for the chairs)
      if (s.kind === 'cafe' || s.kind === 'bakery' || i % 6 === 0) {
        const cx = s.x + dir * 1.2;
        add(cx, s.z - 1.6, dir > 0 ? Math.PI / 2 : -Math.PI / 2, 'sit', { y: C.ground(cx, s.z - 1.6, h(s.z) + 1.2, 0) + 0.06 });
        if (R() < 0.7) add(cx, s.z - 3.0, dir > 0 ? Math.PI / 2 : -Math.PI / 2, 'sit', { y: C.ground(cx, s.z - 3.0, h(s.z) + 1.2, 0) + 0.06, phone: R() < 0.5 });
      }
    });
    // bus shelter
    const sh = world.spots.shelter;
    if (sh) for (let i = 0; i < 3; i++) add(sh.x - 1.2 + i * 1.2, sh.z + 1.6, Math.PI * (R() < 0.5 ? 0.5 : -0.5), i === 1 ? 'stand' : 'phone');
    // park benches (facing the fountain) and the fountain rim
    const pcx = (PARK.x0 + PARK.x1) / 2, pcz = (PARK.z0 + PARK.z1) / 2;
    (world.benches || []).slice(0, 8).forEach(([x, z], i) => { if (i % 2 === 0) add(x, z, face(x, z, pcx, pcz), 'sit', { reach: 0.8, phone: i === 4 }); });
    const fn = world.spots.fountain;
    if (fn) for (const a of [0.4, 2.2, 4.1]) { const x = fn.x + Math.cos(a) * 7.6, z = fn.z + Math.sin(a) * 7.6; add(x, z, face(fn.x, fn.z, x, z), 'sit', { reach: 1.5 }); }
    // queue at the poutine truck, a busker and friends chatting on the plaza
    const tr = world.spots.truck;
    if (tr) for (let i = 0; i < 4; i++) add(tr.x + 3.4 + i * 0.95, tr.z - 0.6 + (R() - 0.5) * 0.3, -Math.PI / 2, i === 3 ? 'phone' : 'stand');
    const plx = (PLAZA.x0 + PLAZA.x1) / 2, plz = (PLAZA.z0 + PLAZA.z1) / 2;
    for (let i = 0; i < 2; i++) { const x = plx - 6 + i * 9, z = plz + 6 - i * 10; const a = add(x, z, Math.PI / 2, 'chat'), b = add(x + 1.3, z, -Math.PI / 2, 'chat'); a.mate = b; b.mate = a; b.t += 1.8; }
    // downtown: office workers on Place Ville Marie's plaza
    if (world.pvmBeacon) {
      const b = world.pvmBeacon;
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, x = b.x + Math.cos(a) * 30, z = b.z + Math.sin(a) * 30; add(x, z, a + Math.PI / 2 * (i % 2 ? 1 : -1), i % 3 ? 'stand' : 'phone', { reach: 9 }); }
    }
  }
  update(dt, player, camPos) {
    this.fr++;
    for (const p of this.list) {
      const d2 = p.pos.distanceToSquared(camPos), vis = d2 < 125 * 125;
      p.ch.root.visible = vis; if (!vis) continue;
      p.adt += dt; p.t += dt;
      // dodging cars
      if (p.dodgeT > 0) { p.dodgeT -= dt; p.pos.addScaledVector(p.dv, dt); }
      else if (p.pos.distanceToSquared(p.home) > 0.01 && p.mode !== 'sit') p.pos.lerp(p.home, 1 - Math.exp(-dt * 0.6));
      // little lives: shopkeepers wave at you, chatting friends nod and shake, queue shuffles
      let wave = 0;
      const dp = Math.hypot(player.pos.x - p.pos.x, player.pos.z - p.pos.z);
      if (p.mode === 'keeper' && dp < 6) { wave = p.waved ? 0 : 1; p.waveT = (p.waveT || 0) + dt; if (p.waveT > 2.2) p.waved = true; } else if (dp > 10) { p.waved = false; p.waveT = 0; }
      if (p.mode === 'chat' && p.t > 3.2) { p.t = 0; p.ch.gesture?.(Math.random() < 0.6 ? 'nod' : 'shake', 2); }
      if (p.mode === 'stand' && p.t > 6) { p.t = 0; if (Math.random() < 0.3) p.ch.gesture?.('nod', 1.6); }
      // face the player when they come close (people notice you)
      let yaw = p.yaw;
      if (dp < 3.5 && p.mode !== 'sit') yaw = Math.atan2(player.pos.x - p.pos.x, player.pos.z - p.pos.z);
      let dy = yaw - p.ch.root.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); p.ch.root.rotation.y += dy * (1 - Math.exp(-dt * 4));
      const every = d2 > 70 * 70 ? 4 : d2 > 25 * 25 ? 2 : 1;
      if ((this.fr + p.id) % every === 0) {
        p.ch.animate(p.adt, 0, true, wave, { sit: p.mode === 'sit', phone: p.mode === 'phone' || p.phone });
        p.adt = 0;
      }
    }
  }
}

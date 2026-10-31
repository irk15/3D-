// physics.js — loose objects that behave like real ones: Montréal's grey bins and blue recycling bins,
// orange construction cones, cardboard boxes, café chairs, crates and footballs. They fall under gravity,
// land on whatever is below (sidewalk, steps, roofs), bounce a little, slide with friction, tip over when
// knocked hard enough (and stand back up if they weren't pushed past their balance point), roll (balls),
// bump into walls and into each other, and sleep when still so they cost nothing.
// Bodies are drawn with one instanced mesh per type.
import * as THREE from 'three';
import { h, nsX, ewZ, nsHW, ewHW, PARK, PLAZA, rng, pick } from './layout.js';
import { gradient } from './toon.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const G = 15;   // same gravity as the player
const colorize = (g, hex) => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); const c = new THREE.Color(hex), a = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < a.length; i += 3) a.set([c.r, c.g, c.b], i); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
const part = (geo, hex, x = 0, y = 0, z = 0) => colorize(geo.translate(x, y, z), hex);

// type: r = footprint radius, hh = half height, m = mass, e = bounce, mu = friction, ball = rolls
const TYPES = {
  bin: { r: 0.3, hh: 0.45, m: 14, e: 0.15, mu: 5, geo: () => mergeGeometries([part(new THREE.CylinderGeometry(0.28, 0.25, 0.86, 16), '#5b6068'), part(new THREE.CylinderGeometry(0.31, 0.31, 0.06, 16), '#3f444b', 0, 0.45, 0), part(new THREE.BoxGeometry(0.2, 0.05, 0.06), '#2b2e33', 0, 0.5, 0)]) },
  recycle: { r: 0.36, hh: 0.47, m: 10, e: 0.15, mu: 5, geo: () => mergeGeometries([part(new THREE.BoxGeometry(0.58, 0.86, 0.66), '#2f7fbf', 0, -0.02, 0), part(new THREE.BoxGeometry(0.62, 0.06, 0.7), '#1f5f99', 0, 0.44, 0), part(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 10).rotateZ(Math.PI / 2), '#22262b', 0.27, -0.42, -0.26), part(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 10).rotateZ(Math.PI / 2), '#22262b', -0.27, -0.42, -0.26), part(new THREE.BoxGeometry(0.3, 0.12, 0.01), '#ffffff', 0, 0.15, 0.335)]) },
  cone: { r: 0.2, hh: 0.37, m: 3, e: 0.3, mu: 4, geo: () => mergeGeometries([part(new THREE.BoxGeometry(0.42, 0.05, 0.42), '#e8641e', 0, -0.345, 0), part(new THREE.ConeGeometry(0.17, 0.66, 14, 1, true), '#f07428', 0, -0.0, 0), part(new THREE.CylinderGeometry(0.075, 0.1, 0.12, 14, 1, true), '#f4f4f0', 0, 0.06, 0)]) },
  box: { r: 0.27, hh: 0.22, m: 3, e: 0.2, mu: 4, geo: () => mergeGeometries([part(new THREE.BoxGeometry(0.52, 0.44, 0.42), '#c98a4b'), part(new THREE.BoxGeometry(0.53, 0.06, 0.1), '#e8d2a6', 0, 0.2, 0)]) },
  crate: { r: 0.38, hh: 0.33, m: 16, e: 0.1, mu: 5, geo: () => mergeGeometries([part(new THREE.BoxGeometry(0.66, 0.66, 0.66), '#b98a55'), part(new THREE.BoxGeometry(0.68, 0.08, 0.68), '#8f6a41', 0, 0.2, 0), part(new THREE.BoxGeometry(0.68, 0.08, 0.68), '#8f6a41', 0, -0.2, 0)]) },
  chair: { r: 0.25, hh: 0.42, m: 4, e: 0.2, mu: 4, geo: () => mergeGeometries([part(new THREE.BoxGeometry(0.42, 0.05, 0.42), '#2f3a44', 0, 0.02, 0), part(new THREE.BoxGeometry(0.42, 0.42, 0.05), '#2f3a44', 0, 0.23, -0.19), ...[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([a, b]) => part(new THREE.CylinderGeometry(0.018, 0.018, 0.4, 6), '#22262b', a * 0.18, -0.2, b * 0.18))]) },
  ball: { r: 0.11, hh: 0.11, m: 0.43, e: 0.62, mu: 0.8, ball: true, geo: () => { const g = new THREE.IcosahedronGeometry(0.11, 1); const c = g.toNonIndexed(); const pos = c.attributes.position, a = new Float32Array(pos.count * 3); for (let i = 0; i < pos.count; i += 3) { const dark = (i / 3) % 5 === 0; for (let j = 0; j < 3; j++) a.set(dark ? [0.1, 0.1, 0.12] : [0.95, 0.95, 0.95], (i + j) * 3); } c.setAttribute('color', new THREE.BufferAttribute(a, 3)); c.deleteAttribute('uv'); return c; } },
};

const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _v = new THREE.Vector3(), _ax = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0), _m = new THREE.Matrix4(), _s = new THREE.Vector3(1, 1, 1);
export class Props {
  constructor(scene, world) {
    this.w = world; this.bodies = []; this.mesh = {};
    const mat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradient });
    const R = rng(909), list = [];
    const C = world.colliders;
    const put = (type, x, z, yaw = R() * 6.28) => list.push({ type, x, z, yaw });
    // bins and recycling bins on the sidewalks in front of shops
    world.shops.forEach((s, i) => {
      if (s.kind === 'church') return;
      const k = Math.round(s.x / 90), toward = Math.sign(nsX(k) - s.x) || 1, x = s.x + toward * 1.4;
      put(i % 3 === 0 ? 'recycle' : 'bin', x, s.z + 2.4, toward > 0 ? Math.PI / 2 : -Math.PI / 2);
      if (s.kind === 'cafe' || i % 4 === 1) { put('chair', x - toward * 0.2, s.z - 1.6); put('chair', x - toward * 0.2, s.z - 3.0); }
      if (i % 5 === 2) put('box', s.x + toward * 0.9, s.z - 0.8);
    });
    // a construction zone (cones!) on Rachel and on Saint-Denis
    for (let i = 0; i < 9; i++) put('cone', -30 + i * 3.2, ewZ(1) + ewHW(1) - 1.4);
    for (let i = 0; i < 7; i++) put('cone', nsX(0) - 3.4, 30 + i * 3.4);
    // crates and boxes by the food truck and in the alleys
    for (let i = 0; i < 5; i++) put(i % 2 ? 'crate' : 'box', PLAZA.x0 + 6 + (i % 3) * 1.1, PLAZA.z0 + 8 + Math.floor(i / 3) * 1.1);
    for (const z of [-120, -40, 60, 150]) { put('crate', 45 - 1.4, z); put('box', 45 + 1.2, z + 1.5); put('bin', -45 + 1.3, z + 6); }
    // footballs in the park and on the plaza
    put('ball', (PARK.x0 + PARK.x1) / 2 + 6, (PARK.z0 + PARK.z1) / 2 - 10); put('ball', (PARK.x0 + PARK.x1) / 2 - 8, (PARK.z0 + PARK.z1) / 2 + 6); put('ball', (PLAZA.x0 + PLAZA.x1) / 2, (PLAZA.z0 + PLAZA.z1) / 2);
    const counts = {}; for (const it of list) counts[it.type] = (counts[it.type] || 0) + 1;
    for (const [t, n] of Object.entries(counts)) { const im = new THREE.InstancedMesh(TYPES[t].geo(), mat, n); im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; scene.add(im); this.mesh[t] = { im, n: 0 }; }
    for (const it of list) {
      const T = TYPES[it.type], gy = C.ground(it.x, it.z, h(it.z) + 2, 0);
      const b = { T, type: it.type, p: new THREE.Vector3(it.x, gy + T.hh, it.z), v: new THREE.Vector3(), yaw: it.yaw, wy: 0, tilt: 0, tiltV: 0, axis: new THREE.Vector3(1, 0, 0), q: new THREE.Quaternion(), sleep: true, still: 0, slot: this.mesh[it.type].n++, dirty: true };
      if (T.ball) b.roll = new THREE.Quaternion();
      this.bodies.push(b);
    }
    this.sync(true);
  }
  // knock a body: impulse J (N·s, world) applied at height `hy` above its centre
  hit(b, J, hy = 0) {
    const T = b.T; b.v.addScaledVector(J, 1 / T.m); b.sleep = false; b.still = 0;
    if (T.ball) return;
    const jh = Math.hypot(J.x, J.z); if (jh < 1e-4) return;
    // the push tips it around the horizontal axis perpendicular to the push
    _ax.set(J.z, 0, -J.x).normalize();
    if (b.tilt < 0.02) b.axis.copy(_ax);
    const sign = Math.sign(_ax.dot(b.axis)) || 1;
    b.tiltV += sign * jh * (T.hh + hy) / (T.m * (T.r * T.r + T.hh * T.hh) * 0.55);
    b.wy += (Math.random() - 0.5) * jh / T.m * 2;
  }
  // push from a moving circle (player, car, character): returns true if anything was touched
  push(x, z, y0, y1, radius, vx, vz, mass) {
    let any = false;
    for (const b of this.bodies) {
      const dx = b.p.x - x, dz = b.p.z - z, rr = radius + b.T.r;
      if (dx * dx + dz * dz > rr * rr || b.p.y + b.T.hh < y0 || b.p.y - b.T.hh > y1) continue;
      const d = Math.hypot(dx, dz) || 1e-3, nx = dx / d, nz = dz / d, pen = rr - d;
      b.p.x += nx * pen; b.p.z += nz * pen;   // separate
      const rel = (vx - b.v.x) * nx + (vz - b.v.z) * nz;
      if (rel > 0) {
        const j = rel * (1 + b.T.e) * mass * b.T.m / (mass + b.T.m);
        this.hit(b, _v.set(nx * j, Math.min(rel * 0.18, 3) * b.T.m, nz * j), b.T.hh * 0.3);
      } else { b.sleep = false; }
      any = true;
    }
    return any;
  }
  update(dt) {
    const C = this.w.colliders, B = this.bodies;
    dt = Math.min(dt, 1 / 30);
    for (const b of B) {
      if (b.sleep) continue;
      const T = b.T, p = b.p;
      // tipping: gravity tips it further past the balance point, otherwise it rocks back up
      if (!T.ball) {
        const crit = Math.atan2(T.r, T.hh);
        const acc = b.tilt > crit ? 9 : -9 * Math.cos(b.tilt) * (b.tilt < 0.001 ? 0 : 1);
        b.tiltV += acc * dt; b.tilt += b.tiltV * dt;
        if (b.tilt < 0) { b.tilt = 0; b.tiltV = -b.tiltV * 0.25; }
        if (b.tilt > Math.PI / 2) { b.tilt = Math.PI / 2; b.tiltV = -b.tiltV * 0.2; }
        b.tiltV *= Math.exp(-dt * 1.5);
      }
      b.yaw += b.wy * dt; b.wy *= Math.exp(-dt * 3);
      // linear motion
      b.v.y -= G * dt;
      const nx = p.x + b.v.x * dt, nz = p.z + b.v.z * dt;
      const sup = T.ball ? T.r : T.hh * Math.cos(b.tilt) + T.r * Math.sin(b.tilt);   // half-height of what touches the ground
      if (C.blocked(nx, p.z, T.r * 0.8, p.y - sup, 0.25, p.y + sup)) b.v.x *= -0.35; else p.x = nx;
      if (C.blocked(p.x, nz, T.r * 0.8, p.y - sup, 0.25, p.y + sup)) b.v.z *= -0.35; else p.z = nz;
      const prevY = p.y; p.y += b.v.y * dt;
      const g = C.ground(p.x, p.z, Math.max(prevY, p.y) - sup + 0.3, 0);
      let onGround = false;
      if (p.y - sup <= g) {
        p.y = g + sup; onGround = true;
        if (b.v.y < -1.2) { b.v.y = -b.v.y * T.e; b.tiltV += (Math.random() - 0.5) * 0.6; } else b.v.y = 0;
        const k = Math.exp(-dt * T.mu * (T.ball ? 1 : 1 + b.tilt));
        b.v.x *= k; b.v.z *= k;
      }
      // rolling ball: spin follows the ground speed
      if (T.ball && onGround) { const sp = Math.hypot(b.v.x, b.v.z); if (sp > 1e-3) { _ax.set(b.v.z, 0, -b.v.x).normalize(); b.roll.premultiply(_q.setFromAxisAngle(_ax, sp * dt / T.r)); } }
      // sleep once settled
      const moving = Math.abs(b.v.x) + Math.abs(b.v.y) + Math.abs(b.v.z) + Math.abs(b.tiltV) * 0.5;
      b.still = onGround && moving < 0.08 && (b.tilt < 0.01 || b.tilt > Math.PI / 2 - 0.01) ? b.still + dt : 0;
      if (b.still > 0.6) { b.sleep = true; b.v.set(0, 0, 0); b.tiltV = 0; }
      b.dirty = true;
    }
    // body vs body (only pairs where one is awake)
    for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) {
      const a = B[i], c = B[j]; if (a.sleep && c.sleep) continue;
      const dx = c.p.x - a.p.x, dz = c.p.z - a.p.z, rr = a.T.r + c.T.r; if (dx * dx + dz * dz > rr * rr || Math.abs(c.p.y - a.p.y) > a.T.hh + c.T.hh) continue;
      const d = Math.hypot(dx, dz) || 1e-3, nx = dx / d, nz = dz / d, pen = (rr - d) / 2;
      a.p.x -= nx * pen; a.p.z -= nz * pen; c.p.x += nx * pen; c.p.z += nz * pen;
      const rel = (a.v.x - c.v.x) * nx + (a.v.z - c.v.z) * nz;
      if (rel > 0) { const jm = rel * 1.2 / (1 / a.T.m + 1 / c.T.m); this.hit(c, _v.set(nx * jm, 0, nz * jm), 0); this.hit(a, _v.set(-nx * jm, 0, -nz * jm), 0); }
    }
    this.sync(false);
  }
  sync(all) {
    const touched = new Set();
    for (const b of this.bodies) {
      if (!all && !b.dirty) continue; b.dirty = false;
      if (b.T.ball) b.q.copy(b.roll); else { b.q.setFromAxisAngle(_up, b.yaw); if (b.tilt > 0) b.q.premultiply(_q2.setFromAxisAngle(b.axis, b.tilt)); }
      // pivot about the bottom edge so a tipping bin rotates around where it touches the ground
      const M = this.mesh[b.type]; _m.compose(b.p, b.q, _s); M.im.setMatrixAt(b.slot, _m); touched.add(M.im);
    }
    for (const im of touched) im.instanceMatrix.needsUpdate = true;
  }
}

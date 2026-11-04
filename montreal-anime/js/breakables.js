// breakables.js — street furniture that gives way like in GTA: hit a lamp post with a car and it bends
// over and topples (slowly, pivoting on its base), a hydrant snaps and throws up a jet of water, bins,
// benches and newspaper boxes go tumbling. The car loses a little speed instead of stopping dead.
// Everything is instanced (one draw call per type), and only moving pieces update their matrices.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { gradient } from './toon.js';

const TYPES = {
  lamp: { geo: () => mergeGeometries([new THREE.CylinderGeometry(0.07, 0.1, 7.2, 8).translate(0, 3.6, 0), new THREE.BoxGeometry(1.75, 0.09, 0.09).translate(0.85, 7.1, 0), new THREE.BoxGeometry(0.64, 0.26, 0.4).translate(1.7, 6.98, 0)]), col: '#5c6369', mass: 0.82, h: 7.2 },
  hydrant: { geo: () => mergeGeometries([new THREE.CylinderGeometry(0.15, 0.18, 0.6, 10).translate(0, 0.3, 0), new THREE.SphereGeometry(0.16, 10, 6).translate(0, 0.62, 0), new THREE.CylinderGeometry(0.06, 0.06, 0.42, 6).rotateZ(Math.PI / 2).translate(0, 0.4, 0)]), col: '#d23a2a', mass: 0.93, small: true },
  bin: { geo: () => new THREE.CylinderGeometry(0.3, 0.27, 0.95, 12).translate(0, 0.48, 0), col: '#2f5a3a', mass: 0.96, small: true },
  bench: { geo: () => mergeGeometries([new THREE.BoxGeometry(1.8, 0.08, 0.5).translate(0, 0.45, 0), new THREE.BoxGeometry(1.8, 0.45, 0.06).translate(0, 0.75, -0.23), new THREE.BoxGeometry(0.08, 0.45, 0.45).translate(-0.8, 0.22, 0), new THREE.BoxGeometry(0.08, 0.45, 0.45).translate(0.8, 0.22, 0)]), col: '#5b4636', mass: 0.9, small: true },
  news: { geo: () => new THREE.BoxGeometry(0.5, 1.0, 0.45).translate(0, 0.5, 0), col: '#2f6db4', mass: 0.95, small: true },
};
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _ax = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);

export class Breakables {
  // list: [{ type, x, y, z, ry, s, c (collider), glow, col }]
  constructor(scene, world, list, fx) {
    this.w = world; this.fx = fx; this.items = []; this.grid = new Map(); this.moving = new Set(); this.ims = {};
    const by = {};
    for (const it of list) (by[it.type] ||= []).push(it);
    for (const [type, arr] of Object.entries(by)) {
      const T = TYPES[type]; if (!T) continue;
      const mat = new THREE.MeshToonMaterial({ color: T.col, gradientMap: gradient }); if (type === 'lamp') { mat.userData.rough = 0.45; mat.userData.metal = 0.6; }
      const im = new THREE.InstancedMesh(T.geo(), mat, arr.length); im.castShadow = true; im.receiveShadow = true;
      const tinted = arr.some((a) => a.col); if (tinted) mat.color.set('#ffffff');
      arr.forEach((it, i) => {
        it.im = im; it.i = i; it.T = T; it.state = 0; it.ry = it.ry || 0; it.s = it.s || 1;
        if (tinted) im.setColorAt(i, new THREE.Color(it.col || T.col));
        this.place(it); this.items.push(it);
        const k = Math.floor(it.x / 8) * 100000 + Math.floor(it.z / 8); (this.grid.get(k) || this.grid.set(k, []).get(k)).push(it);
      });
      im.computeBoundingSphere(); scene.add(im); this.ims[type] = im;
      if (type === 'lamp') { this.heads = new THREE.InstancedMesh(new THREE.BoxGeometry(0.52, 0.06, 0.3).translate(1.7, 6.83, 0), new THREE.MeshBasicMaterial({ color: 0xfff4d6 }), arr.length); arr.forEach((it) => { this.heads.setMatrixAt(it.i, _m.compose(_p.set(it.x, it.y, it.z), _q.setFromAxisAngle(_up, it.ry), _s.set(1, it.s, 1))); }); this.heads.computeBoundingSphere(); scene.add(this.heads); }
    }
  }
  place(it) {
    _p.set(it.x, it.y, it.z); _q.setFromAxisAngle(_up, it.ry);
    if (it.state === 1) { _q2.setFromAxisAngle(it.axis, it.ang); _q.premultiply(_q2); _p.add(it.off || _s.set(0, 0, 0)); }
    if (it.state === 2) { _q2.setFromEuler(it.rot); _q.premultiply(_q2); _p.copy(it.pos); }
    _m.compose(_p, _q, _s.set(1, it.s, 1)); it.im.setMatrixAt(it.i, _m); it.im.instanceMatrix.needsUpdate = true;
    if (this.heads && it.type === 'lamp') { this.heads.setMatrixAt(it.i, it.state ? _m.makeScale(0, 0, 0) : _m); this.heads.instanceMatrix.needsUpdate = true; }
  }
  // a car circle at (x,z) moving at (vx,vz): break whatever it touches; returns the speed factor to apply
  hit(x, z, r, vx, vz, speed) {
    if (speed < 2.2) return 1;
    let f = 1;
    for (let i = Math.floor((x - r - 1) / 8); i <= Math.floor((x + r + 1) / 8); i++) for (let j = Math.floor((z - r - 1) / 8); j <= Math.floor((z + r + 1) / 8); j++) {
      const a = this.grid.get(i * 100000 + j); if (!a) continue;
      for (const it of a) {
        if (it.state || (it.x - x) ** 2 + (it.z - z) ** 2 > (r + 0.25) ** 2) continue;
        this.knock(it, vx, vz, speed); f *= it.T.mass;
      }
    }
    return f;
  }
  knock(it, vx, vz, speed) {
    const sp = Math.hypot(vx, vz) || 1, dx = vx / sp, dz = vz / sp;
    if (it.c) it.c.dead = true;
    if (it.glow !== undefined && it.glow >= 0) this.w.glows.set(it.glow, 0, -9999, 0), this.w.glows.g.attributes.iPos.needsUpdate = true;
    if (it.T.small) {   // tumbles away
      it.state = 2; it.pos = new THREE.Vector3(it.x, it.y, it.z); it.vel = new THREE.Vector3(dx * speed * 0.7 + (Math.random() - 0.5) * 2, 2 + speed * 0.18, dz * speed * 0.7 + (Math.random() - 0.5) * 2); it.rot = new THREE.Euler(); it.spin = new THREE.Vector3((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 12); it.t = 0;
      if (it.type === 'hydrant') { it.jet = 7; it.jx = it.x; it.jz = it.z; }
    } else {           // bends over on its base and falls the way the car was going (slowly at first)
      it.state = 1; it.ang = 0.04; it.angV = 0.5 + speed * 0.06; it.axis = new THREE.Vector3(dz, 0, -dx).normalize(); it.t = 0;
    }
    this.moving.add(it); this.fx?.hit?.(it, speed);
  }
  update(dt, night) {
    if (this.heads) this.heads.material.color.setScalar(0.55 + night * 0.45);
    for (const it of this.moving) {
      it.t += dt;
      if (it.state === 1) {
        // gravity torque grows as it leans: slow start, then a fast fall; a little bounce on the ground
        it.angV += 7.5 * Math.sin(it.ang) * dt / Math.max(0.6, it.s); it.ang += it.angV * dt;
        if (it.ang > 1.5) { it.ang = 1.5; it.angV *= -0.25; if (Math.abs(it.angV) < 0.15) { it.angV = 0; it.done = true; } else this.fx?.thud?.(it); }
        this.place(it); if (it.done) this.moving.delete(it);
      } else if (it.state === 2) {
        it.vel.y -= 20 * dt; it.pos.addScaledVector(it.vel, dt); it.rot.x += it.spin.x * dt; it.rot.y += it.spin.y * dt; it.rot.z += it.spin.z * dt;
        const g = this.w.colliders.ground(it.pos.x, it.pos.z, it.pos.y + 0.5, 0.1);
        if (it.pos.y < g) { it.pos.y = g; it.vel.y = Math.abs(it.vel.y) > 2 ? -it.vel.y * 0.3 : 0; it.vel.x *= 0.6; it.vel.z *= 0.6; it.spin.multiplyScalar(0.5); }
        if (it.jet > 0) { it.jet -= dt; this.fx?.jet?.(it.jx, it.y, it.jz, it.jet); }
        this.place(it);
        if (it.t > 3 && !(it.jet > 0)) { it.rot.x = Math.round(it.rot.x / (Math.PI / 2)) * Math.PI / 2; it.rot.z = Math.round(it.rot.z / (Math.PI / 2)) * Math.PI / 2; this.place(it); this.moving.delete(it); }
      }
    }
  }
}

// sky.js — things you only notice once you can fly: 3D toon cloud banks, rooftop clutter
// (AC units, chimneys, skylights, terraces) with colliders, and ribbon trails off the wings.
import * as THREE from 'three';
import { h, rng, U } from './layout.js';
import { toon, LAYER_FX } from './toon.js';

// ---------------------------------------------------------------- roofs: every tall, flat building top
export function findRoofs(world) {
  const out = [];
  for (const c of world.colliders.list) {
    if (c.thin || c.t) continue;
    const w = c.x1 - c.x0, d = c.z1 - c.z0;
    if (w < 6 || d < 5 || w * d < 45) continue;
    const g = h((c.z0 + c.z1) / 2);
    if (c.y1 - g < 7.5) continue;
    out.push({ x0: c.x0, x1: c.x1, z0: c.z0, z1: c.z1, y: c.y1, x: (c.x0 + c.x1) / 2, z: (c.z0 + c.z1) / 2 });
  }
  return out;
}

// ---------------------------------------------------------------- rooftop props
export function roofProps(scene, world, roofs) {
  const R = rng(4242), C = world.colliders;
  const kinds = {
    ac: { g: new THREE.BoxGeometry(1, 1, 1), m: toon('#c9ccd2'), list: [] },
    fan: { g: new THREE.CylinderGeometry(0.5, 0.5, 1, 14), m: toon('#8b919c'), list: [] },
    chim: { g: new THREE.BoxGeometry(1, 1, 1), m: toon('#a0533b'), list: [] },
    sky: { g: new THREE.BoxGeometry(1, 1, 1), m: toon('#9fd6f2', { emissive: '#3b7fa8', emissiveIntensity: 0.15 }), list: [] },
    deck: { g: new THREE.BoxGeometry(1, 1, 1), m: toon('#b98a55'), list: [] },
    pot: { g: new THREE.SphereGeometry(0.5, 10, 8), m: toon('#5f9e4a'), list: [] },
    umb: { g: new THREE.ConeGeometry(1, 0.5, 10), m: toon('#e4402b'), list: [] },
  };
  const put = (k, x, y, z, sx, sy, sz, col = true) => {
    kinds[k].list.push([x, y + sy / 2 - 0.04, z, sx, sy, sz]);
    if (col) C.add({ x0: x - sx / 2, x1: x + sx / 2, z0: z - sz / 2, z1: z + sz / 2, y0: y - 0.05, y1: y + sy - 0.04 });
  };
  for (const r of roofs) {
    const w = r.x1 - r.x0, d = r.z1 - r.z0;
    const rx = () => r.x0 + 1.2 + R() * (w - 2.4), rz = () => r.z0 + 1.2 + R() * (d - 2.4);
    // a chimney stack on most Plateau roofs, near a party wall
    if (R() < 0.7) { const x = rx(); put('chim', x, r.y, R() < 0.5 ? r.z0 + 0.5 : r.z1 - 0.5, 0.7, 1.2 + R() * 0.6, 0.5); }
    if (R() < 0.6) { const x = rx(), z = rz(); put('ac', x, r.y, z, 1.3, 0.9, 1.0); put('fan', x, r.y + 0.86, z, 0.8, 0.12, 0.8, false); }
    if (R() < 0.5) put('sky', rx(), r.y, rz(), 1.4, 0.45, 1.0);
    if (R() < 0.18 && w > 8) {   // rooftop terrace: deck, planters and a parasol
      const x = r.x0 + w * 0.5, z = r.z0 + d * 0.5;
      put('deck', x, r.y, z, Math.min(5, w - 2), 0.18, Math.min(4, d - 2));
      for (const s of [-1, 1]) put('pot', x + s * 1.8, r.y + 0.14, z + 1.4, 0.7, 0.7, 0.7, false);
      put('umb', x, r.y + 2.1, z, 2.6, 0.5, 2.6, false);
      kinds.ac.list.push([x, r.y + 1.1, z, 0.06, 2.2, 0.06]);   // parasol pole (thin grey box)
    }
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3();
  for (const k of Object.values(kinds)) {
    if (!k.list.length) continue;
    const im = new THREE.InstancedMesh(k.g, k.m, k.list.length);
    k.list.forEach(([x, y, z, sx, sy, sz], i) => im.setMatrixAt(i, m4.compose(v.set(x, y, z), q, s.set(sx, sy, sz))));
    im.castShadow = true; im.receiveShadow = true; scene.add(im);
  }
  return Object.values(kinds).reduce((a, k) => a + k.list.length, 0);
}

// ---------------------------------------------------------------- 3D toon cloud banks
export function makeClouds(scene) {
  const R = rng(777), N = 34, puffs = [];
  for (let i = 0; i < N; i++) {
    const cx = (R() - 0.5) * 1500, cz = (R() - 0.5) * 1500 - 100, cy = 95 + R() * 70, sz = 9 + R() * 14;
    const n = 5 + Math.floor(R() * 5);
    for (let j = 0; j < n; j++) {
      const a = (j / n) * Math.PI * 2, rr = sz * (0.4 + R() * 0.6);
      const s = sz * (0.55 + R() * 0.55) * (j === 0 ? 1.4 : 1);
      puffs.push([cx + Math.cos(a) * rr * 1.4, cy + (R() - 0.3) * sz * 0.35, cz + Math.sin(a) * rr * 0.8, s, s * (0.6 + R() * 0.2), s * 0.9]);
    }
  }
  const m = toon('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.35 });
  const mat = m.clone(); mat.fog = true;
  const im = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 16, 10), mat, puffs.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3();
  puffs.forEach(([x, y, z, a, b, c], i) => im.setMatrixAt(i, m4.compose(v.set(x, y, z), q, s.set(a, b, c))));
  im.castShadow = false; im.receiveShadow = false; im.frustumCulled = false;
  const g = new THREE.Group(); g.add(im); scene.add(g);
  const night = new THREE.Color('#5b6390'), day = new THREE.Color('#ffffff'), dusk = new THREE.Color('#ffc6a8');
  return {
    puffs,
    update(dt, look) {
      g.position.x = (g.position.x + dt * 1.6 + 750) % 1500 - 750;
      mat.color.copy(day).lerp(dusk, look.golden || 0).lerp(night, look.night);
      mat.emissive.copy(mat.color); mat.emissiveIntensity = 0.3 - look.night * 0.15;
    },
    // is a point inside a cloud? (for the "through the clouds" whoosh)
    inside(p) {
      const ox = g.position.x;
      for (const [x, y, z, a, b, c] of puffs) { const dx = (p.x - x - ox) / a, dy = (p.y - y) / b, dz = (p.z - z) / c; if (dx * dx + dy * dy + dz * dz < 1) return true; }
      return false;
    },
  };
}

// ---------------------------------------------------------------- ribbon trail (wingtips)
export class Trail {
  constructor(scene, color = '#ffffff', n = 34) {
    this.n = n; this.pts = []; this.on = 0;
    this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 2 * 3); this.al = new Float32Array(n * 2);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('aA', new THREE.BufferAttribute(this.al, 1));
    const idx = []; for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    this.geo.setIndex(idx);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uCol: { value: new THREE.Color(color) } }, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      vertexShader: 'attribute float aA; varying float vA; void main(){ vA = aA; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 uCol; varying float vA; void main(){ gl_FragColor = vec4(uCol * vA, 1.0); }',
    });
    this.mesh = new THREE.Mesh(this.geo, this.mat); this.mesh.frustumCulled = false; this.mesh.layers.set(LAYER_FX); scene.add(this.mesh);
  }
  push(p, side, active, dt) {
    this.on += ((active ? 1 : 0) - this.on) * Math.min(1, dt * 5);
    this.pts.unshift([p.x, p.y, p.z, side.x, side.y, side.z]); if (this.pts.length > this.n) this.pts.pop();
    for (let i = 0; i < this.n; i++) {
      const q = this.pts[Math.min(i, this.pts.length - 1)], w = 0.09 * (1 - i / this.n);
      this.pos.set([q[0] - q[3] * w, q[1] - q[4] * w, q[2] - q[5] * w, q[0] + q[3] * w, q[1] + q[4] * w, q[2] + q[5] * w], i * 6);
      const a = (1 - i / this.n) * 0.55 * this.on; this.al[i * 2] = this.al[i * 2 + 1] = a;
    }
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.aA.needsUpdate = true;
    this.mesh.visible = this.on > 0.02;
  }
}

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { hash } from './acc.js';

let geo, mat;
const ni = (g) => (g.index ? g.toNonIndexed() : g);
function tree() {
  if (geo) return;
  const trunk = new THREE.CylinderGeometry(0.25, 0.35, 2.4, 5); trunk.translate(0, 1.2, 0);
  const crown = new THREE.IcosahedronGeometry(2.4, 0); crown.scale(1, 1.25, 1); crown.translate(0, 4.4, 0);
  const paint = (g, c) => { const n = g.attributes.position.count, a = new Float32Array(n * 3), col = new THREE.Color(c); for (let i = 0; i < n; i++) { a[i * 3] = col.r; a[i * 3 + 1] = col.g; a[i * 3 + 2] = col.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
  geo = mergeGeometries([paint(ni(trunk), 0x4a3a2a), paint(ni(crown), 0xffffff)]);
  mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true });
}
// tris: flat list [weight, ax,az, bx,bz, cx,cz, ...]
export function buildTrees(tris, seed, cap = 1400) {
  tree();
  const pts = [];
  for (let t = 0; t < tris.length && pts.length / 3 < cap; t += 7) {
    const w = tris[t], ax = tris[t + 1], az = tris[t + 2], bx = tris[t + 3], bz = tris[t + 4], cx = tris[t + 5], cz = tris[t + 6];
    const area = Math.abs((bx - ax) * (cz - az) - (cx - ax) * (bz - az)) / 2;
    let n = (area / 380) * w, k = 0;
    while (n > 0 && pts.length / 3 < cap) {
      if (n >= 1 || hash(seed + t * 17 + k) < n) {
        let u = hash(seed + t * 3 + k * 7), v = hash(seed + t * 5 + k * 11 + 1);
        if (u + v > 1) { u = 1 - u; v = 1 - v; }
        pts.push(ax + (bx - ax) * u + (cx - ax) * v, az + (bz - az) * u + (cz - az) * v, hash(seed + t + k * 13));
      }
      n--; k++;
    }
  }
  if (!pts.length) return null;
  const m = new THREE.InstancedMesh(geo, mat, pts.length / 3);
  const o = new THREE.Object3D(), c = new THREE.Color();
  for (let i = 0; i < pts.length / 3; i++) {
    const s = 0.7 + pts[i * 3 + 2] * 0.9;
    o.position.set(pts[i * 3], 0.2, pts[i * 3 + 1]); o.rotation.y = pts[i * 3 + 2] * 6.28; o.scale.set(s, s * (0.9 + pts[i * 3 + 2] * 0.4), s); o.updateMatrix();
    m.setMatrixAt(i, o.matrix);
    c.setHSL(0.24 + (pts[i * 3 + 2] - 0.5) * 0.08, 0.38, 0.2 + pts[i * 3 + 2] * 0.12); m.setColorAt(i, c);
  }
  m.frustumCulled = true; m.computeBoundingSphere();
  return m;
}

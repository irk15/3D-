import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { hash } from './acc.js';
import { U } from '../../lib/atmosphere.js';

let geo, mat;
const ni = (g) => (g.index ? g.toNonIndexed() : g);
function tree() {
  if (geo) return;
  const trunk = new THREE.CylinderGeometry(0.25, 0.35, 2.4, 5); trunk.translate(0, 1.2, 0);
  const crown = new THREE.IcosahedronGeometry(2.4, 0); crown.scale(1, 1.25, 1); crown.translate(0, 4.4, 0);
  const paint = (g, c) => { const n = g.attributes.position.count, a = new Float32Array(n * 3), col = new THREE.Color(c); for (let i = 0; i < n; i++) { a[i * 3] = col.r; a[i * 3 + 1] = col.g; a[i * 3 + 2] = col.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
  const crownTag = (g, v) => { g.setAttribute('aCrown', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(v), 1)); return g; };
  geo = mergeGeometries([crownTag(paint(ni(trunk), 0x4a3a2a), 0), crownTag(paint(ni(crown), 0xffffff), 1)]);
  mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true });
  // seasons: leaves turn orange/red in autumn, fall off in winter (crown shrinks away), snow dusts the crowns
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uAutumn = U.uAutumn; sh.uniforms.uWinter = U.uWinter; sh.uniforms.uSnow = U.uSnow;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aCrown; uniform float uWinter; varying float vCrown;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCrown = aCrown; if (aCrown > 0.5) { vec3 c0 = vec3(0.0, 4.4, 0.0); transformed = c0 + (transformed - c0) * (1.0 - 0.95 * uWinter); }');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vCrown; uniform float uAutumn, uSnow;')
      .replace('#include <color_fragment>', `#include <color_fragment>
      if (vCrown > 0.5) { float h = fract(vColor.g * 53.0 + vColor.r * 17.0); vec3 au = mix(vec3(0.62, 0.2, 0.05), vec3(0.85, 0.58, 0.1), h); au = mix(au, vec3(0.55, 0.18, 0.06), step(0.8, h));
        diffuseColor.rgb = mix(diffuseColor.rgb, au * 0.7, uAutumn); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.88, 0.92, 1.0), uSnow * 0.35); }`);
  };
  mat.customProgramCacheKey = () => 'tc-tree-season';
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
  return instTrees(pts);
}
// explicit tree positions: flat list [x, z, random01, ...] (used for street trees)
export function instTrees(pts) {
  tree();
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

// Instanced street lamps: pole + arm (lit by the sun), bright heads and a soft light pool on the road for night.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

let poleG, headG, poolG;
const ni = (g) => (g.index ? g.toNonIndexed() : g);
const paint = (g, c) => { g = ni(g); const n = g.attributes.position.count, a = new Float32Array(n * 3), col = new THREE.Color(c); for (let i = 0; i < n; i++) a.set([col.r, col.g, col.b], i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k); return g; };
function init() {
  if (poleG) return;
  const pole = new THREE.CylinderGeometry(0.07, 0.11, 8, 6); pole.translate(0, 4, 0);
  const arm = new THREE.BoxGeometry(0.08, 0.08, 2.1); arm.translate(0, 8, 0.85);
  poleG = mergeGeometries([paint(pole, 0x55595e), paint(arm, 0x55595e)]);
  const head = new THREE.BoxGeometry(0.55, 0.12, 0.34); head.translate(0, 7.93, 1.8);
  headG = head;
  poolG = new THREE.PlaneGeometry(13, 13); poolG.rotateX(-Math.PI / 2);
}
export function makePoolTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 2, 64, 64, 64); g.addColorStop(0, 'rgba(255,214,150,0.8)'); g.addColorStop(0.3, 'rgba(255,190,110,0.28)'); g.addColorStop(0.7, 'rgba(255,170,90,0.05)'); g.addColorStop(1, 'rgba(255,170,90,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// lamps: flat [x, z, rotY, ...]; returns a Group with three instanced meshes
export function buildLamps(lamps, mats) {
  init();
  const n = lamps.length / 3; if (!n) return null;
  const g = new THREE.Group(), o = new THREE.Object3D();
  const poles = new THREE.InstancedMesh(poleG, mats.pole, n), heads = new THREE.InstancedMesh(headG, mats.head, n), pools = new THREE.InstancedMesh(poolG, mats.pool, n);
  for (let i = 0; i < n; i++) {
    const x = lamps[i * 3], z = lamps[i * 3 + 1], a = lamps[i * 3 + 2];
    o.position.set(x, 0.3, z); o.rotation.set(0, a, 0); o.scale.set(1, 1, 1); o.updateMatrix(); poles.setMatrixAt(i, o.matrix); heads.setMatrixAt(i, o.matrix);
    o.position.set(x + Math.sin(a) * 1.9, 0.62, z + Math.cos(a) * 1.9); o.rotation.set(0, 0, 0); o.updateMatrix(); pools.setMatrixAt(i, o.matrix);
  }
  for (const m of [poles, heads, pools]) { m.computeBoundingSphere(); m.frustumCulled = true; g.add(m); }
  poles.castShadow = true; pools.renderOrder = 4;
  return g;
}

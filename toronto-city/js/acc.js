// Small accumulator for merged, vertex-coloured meshes (keeps draw calls low).
import * as THREE from 'three';
export class Acc {
  constructor() { this.p = []; this.c = []; this.i = []; this.n = 0; }
  v(x, y, z, r, g, b) { this.p.push(x, y, z); this.c.push(r, g, b); return this.n++; }
  // triangle that always faces up (+y)
  up(a, b, c) {
    const p = this.p, ax = p[a * 3], az = p[a * 3 + 2];
    const cy = (p[c * 3] - ax) * (p[b * 3 + 2] - az) - (p[c * 3 + 2] - az) * (p[b * 3] - ax);
    if (cy > 0) this.i.push(a, b, c); else this.i.push(a, c, b);
  }
  tri(a, b, c) { this.i.push(a, b, c); }
  get empty() { return this.n === 0; }
  geometry(upNormals = true, extra) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    if (upNormals) { const nn = new Float32Array(this.n * 3); for (let i = 0; i < this.n; i++) nn[i * 3 + 1] = 1; g.setAttribute('normal', new THREE.BufferAttribute(nn, 3)); }
    if (extra) for (const k in extra) g.setAttribute(k, new THREE.Float32BufferAttribute(extra[k].data, extra[k].size));
    g.setIndex(this.n > 65535 ? new THREE.Uint32BufferAttribute(this.i, 1) : new THREE.Uint16BufferAttribute(this.i, 1));
    g.computeBoundingSphere();
    return g;
  }
}
const _c = new THREE.Color();
export const rgb = (hex) => { _c.setHex(hex); return [_c.r, _c.g, _c.b]; };
export const hash = (n) => { n = (n ^ 61) ^ (n >>> 16); n = (n + (n << 3)) | 0; n ^= n >>> 4; n = Math.imul(n, 0x27d4eb2d); n ^= n >>> 15; return (n >>> 0) / 4294967296; };

// Live TTC buses & streetcars. Vehicles are rendered a little behind real time and interpolated between their real GPS
// fixes, so they glide along their path: no teleporting, even when the feed only updates every 15-30 seconds.
import * as THREE from 'three';
import { CFG } from './config.js';
import { lon2x, lat2z } from './proj.js';
import { decodeVehicles, isStreetcar } from './gtfsrt.js';

function vehicleGeometry(len, h, w) {
  const parts = [], col = (g, c) => { g.translate(0, 0, 0); const n = g.attributes.position.count, a = new Float32Array(n * 3), k = new THREE.Color(c); for (let i = 0; i < n; i++) a.set([k.r, k.g, k.b], i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
  const box = (l, hh, ww, y, c) => { const g = new THREE.BoxGeometry(ww, hh, l); g.translate(0, y + hh / 2, 0); return col(g.index ? g.toNonIndexed() : g, c); };
  parts.push(box(len, h * 0.42, w, 0.5, 0xc8102e), box(len * 1.001, h * 0.3, w * 1.01, 0.5 + h * 0.42, 0x1b2430), box(len, h * 0.2, w * 0.96, 0.5 + h * 0.72, 0xf4f4f4));
  let n = 0; for (const p of parts) n += p.attributes.position.count;
  const pos = new Float32Array(n * 3), cl = new Float32Array(n * 3), nr = new Float32Array(n * 3); let o = 0;
  for (const p of parts) { pos.set(p.attributes.position.array, o * 3); cl.set(p.attributes.color.array, o * 3); nr.set(p.attributes.normal.array, o * 3); o += p.attributes.position.count; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(cl, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nr, 3));
  return g;
}

export class Transit {
  constructor(scene) {
    this.scene = scene; this.v = new Map(); this.status = 'transit: starting'; this.off = null; this.obs = []; this.delay = CFG.TRANSIT_DELAY_S; this.err = '';
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.15, emissive: 0x331018, emissiveIntensity: 0 });
    this.mat = mat;
    this.bus = new THREE.InstancedMesh(vehicleGeometry(12, 3.1, 2.55), mat, 2500);
    this.car = new THREE.InstancedMesh(vehicleGeometry(28, 3.4, 2.6), mat, 600);
    for (const m of [this.bus, this.car]) { m.frustumCulled = false; m.count = 0; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(m); }
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.p = new THREE.Vector3(); this.s = new THREE.Vector3(); this.up = new THREE.Vector3(0, 1, 0);
    this.poll(); setInterval(() => this.poll(), CFG.POLL_MS);
  }
  async fetchFeed() {
    if (CFG.PROXY) {
      const r = await fetch(CFG.PROXY.replace(/\/$/, '') + '/vehicles'); if (!r.ok) throw new Error('proxy ' + r.status);
      return (await r.json()).vehicles;
    }
    const r = await fetch(CFG.TTC_DIRECT); if (!r.ok) throw new Error('ttc ' + r.status);
    return decodeVehicles(await r.arrayBuffer());
  }
  async poll() {
    try {
      const list = await this.fetchFeed(); let maxTs = 0, n = 0;
      for (const o of list) {
        if (!(o.ts > 0)) continue; maxTs = Math.max(maxTs, o.ts);
        let v = this.v.get(o.id);
        if (!v) { v = { id: o.id, route: o.route, car: isStreetcar(o.route), s: [], x: 0, z: 0, h: 0, a: 0, alive: 0, seen: 0, init: false, fade: 0 }; this.v.set(o.id, v); }
        v.route = o.route; v.seen = performance.now(); v.bearing = o.bearing;
        const sp = Math.min(25, o.speed || 0), br = ((o.bearing || 0) * Math.PI) / 180; v.fvx = sp * Math.sin(br); v.fvz = -sp * Math.cos(br);
        const last = v.s[v.s.length - 1];
        if (!last || o.ts > last.t) { const nx = lon2x(o.lon), nz = lat2z(o.lat); if (last && Math.hypot(nx - last.x, nz - last.z) > 400) v.s.length = 0; // GPS gap / loop: restart the track instead of racing across the map
          v.s.push({ t: o.ts, x: lon2x(o.lon), z: lat2z(o.lat) }); if (v.s.length > 8) v.s.shift(); }
        n++;
      }
      if (maxTs) { // clock offset between feed time and our clock, slewed slowly so playback speed never visibly changes
        const o = maxTs - performance.now() / 1000; this.obs.push(o); if (this.obs.length > 6) this.obs.shift();
        const tgt = Math.max(...this.obs); this.off = this.off == null ? tgt : this.off + Math.max(-1, Math.min(1, tgt - this.off));
      }
      this.status = `transit: ${n} vehicles live`; this.err = '';
    } catch (e) {
      this.err = e.message; this.status = 'transit offline (' + e.message + ')' + (CFG.PROXY ? '' : ' - set up the proxy, see README');
    }
  }
  setNight(v) { this.mat.emissiveIntensity = v * 0.6; }
  position(v, t) { // interpolate / extrapolate along real GPS fixes
    const s = v.s, n = s.length; if (!n) return null;
    if (t <= s[0].t) { const e = Math.min(s[0].t - t, 40), fx = v.fvx || 0, fz = v.fvz || 0; return [s[0].x - fx * e, s[0].z - fz * e, fx, fz]; } // before our first fix: back-project along the reported heading
    for (let i = n - 1; i > 0; i--) if (t >= s[i - 1].t) {
      if (t <= s[i].t) { const k = (t - s[i - 1].t) / (s[i].t - s[i - 1].t); return [s[i - 1].x + (s[i].x - s[i - 1].x) * k, s[i - 1].z + (s[i].z - s[i - 1].z) * k, (s[i].x - s[i - 1].x) / (s[i].t - s[i - 1].t), (s[i].z - s[i - 1].z) / (s[i].t - s[i - 1].t)]; }
    }
    const a = s[n - 1]; if (n < 2) return [a.x, a.z, 0, 0];
    const b = s[n - 2], dt = a.t - b.t || 1; let vx = (a.x - b.x) / dt, vz = (a.z - b.z) / dt; const sp = Math.hypot(vx, vz); if (sp > 20) { vx *= 20 / sp; vz *= 20 / sp; }
    const e = Math.min(t - a.t, 20); return [a.x + vx * e, a.z + vz * e, vx, vz];
  }
  update(dt, cam, range) {
    if (this.off == null) { this.bus.count = this.car.count = 0; return; }
    const now = performance.now(), t = now / 1000 + this.off - this.delay;
    let nb = 0, nc = 0; const k = 1 - Math.exp(-dt / 0.4), kr = 1 - Math.exp(-dt / 0.25);
    for (const [id, v] of this.v) {
      if (now - v.seen > 120000) { this.v.delete(id); continue; }
      const P = this.position(v, t); if (!P) continue;
      if (!v.init) { v.x = P[0]; v.z = P[1]; v.init = true; v.fade = 0; v.h = Math.atan2(P[2] || Math.sin(((v.bearing || 0) * Math.PI) / 180), P[3] || -Math.cos(((v.bearing || 0) * Math.PI) / 180)); }
      const dx = P[0] - v.x, dz = P[1] - v.z, d = Math.hypot(dx, dz);
      if (d > 250) { v.fade -= dt * 3; if (v.fade <= 0) { v.x = P[0]; v.z = P[1]; v.fade = 0.001; } } // genuine jump (loop/depot): shrink, move, regrow
      else { v.x += dx * k; v.z += dz * k; v.fade = Math.min(1, v.fade + dt * 1.5); }
      const sp = Math.hypot(P[2], P[3]);
      if (sp > 0.8) { let th = Math.atan2(P[2], P[3]), df = th - v.h; df = Math.atan2(Math.sin(df), Math.cos(df)); v.h += df * kr; }
      const cx = v.x - cam.x, cz = v.z - cam.z; if (cx * cx + cz * cz > range * range) continue;
      const mesh = v.car ? this.car : this.bus, i = v.car ? nc++ : nb++;
      if (i >= mesh.instanceMatrix.count) continue;
      this.p.set(v.x, 0, v.z); this.q.setFromAxisAngle(this.up, v.h); const sc = Math.max(0.001, v.fade); this.s.set(sc, sc, sc);
      this.m.compose(this.p, this.q, this.s); mesh.setMatrixAt(i, this.m);
    }
    this.bus.count = nb; this.car.count = nc; this.bus.instanceMatrix.needsUpdate = true; this.car.instanceMatrix.needsUpdate = true;
    this.nBus = nb; this.nCar = nc;
  }
  nearest(cam, wantCar) { let best = null, bd = 1e12; for (const v of this.v.values()) { if (!v.init || v.fade < 0.9 || v.car !== wantCar) continue; const d = (v.x - cam.x) ** 2 + (v.z - cam.z) ** 2; if (d < bd) { bd = d; best = v; } } return best; }
}

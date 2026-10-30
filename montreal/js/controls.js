// controls.js — desktop camera: orbit, fly, street-level walk, landmark fly-to and guided tours.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { terrainH, floorAt, BOXES, ll2g } from './core.js';

const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const G = (lat, lon, h) => { const [u, v] = ll2g(lat, lon); return new THREE.Vector3(u, h, -v); };

export const TOURS = [
  {
    id: 'oldport', name: 'Old Port at sunrise', hour: 6.6, season: null, dur: 70,
    cam: [G(45.4985, -73.5330, 70), G(45.5040, -73.5400, 45), G(45.5085, -73.5455, 28), G(45.5080, -73.5520, 22), G(45.5055, -73.5560, 38), G(45.5020, -73.5600, 90), G(45.4990, -73.5640, 160)],
    tgt: [G(45.5090, -73.5480, 20), G(45.5120, -73.5455, 25), G(45.5077, -73.5498, 30), G(45.5046, -73.5562, 30), G(45.5015, -73.5690, 80), G(45.5015, -73.5690, 120), G(45.5060, -73.5880, 150)],
  },
  {
    id: 'mountroyal', name: 'Mount Royal at sunset', hour: 'sunset', season: null, dur: 75,
    cam: [G(45.5230, -73.5760, 120), G(45.5150, -73.5830, 210), G(45.5075, -73.5870, 250), G(45.5030, -73.5872, 232), G(45.5000, -73.5850, 240), G(45.4975, -73.5800, 260)],
    tgt: [G(45.5085, -73.5875, 230), G(45.5085, -73.5875, 235), G(45.5015, -73.5690, 120), G(45.5000, -73.5650, 90), G(45.5050, -73.5450, 40), G(45.5150, -73.5330, 30)],
  },
  {
    id: 'bridges', name: 'Night over the bridges', hour: 22.3, season: null, dur: 80,
    cam: [G(45.4800, -73.5250, 90), G(45.4930, -73.5330, 60), G(45.5010, -73.5410, 55), G(45.5110, -73.5410, 70), G(45.5160, -73.5440, 75), G(45.5230, -73.5330, 110), G(45.5330, -73.5300, 160)],
    tgt: [G(45.4890, -73.5250, 15), G(45.4997, -73.5435, 25), G(45.5077, -73.5498, 30), G(45.5192, -73.5395, 50), G(45.5182, -73.5300, 40), G(45.5300, -73.5450, 40), G(45.5580, -73.5519, 120)],
  },
];

export class Controls {
  constructor(camera, dom) {
    this.camera = camera; this.dom = dom;
    this.mode = 'orbit';
    this.orbit = new OrbitControls(camera, dom);
    Object.assign(this.orbit, { enableDamping: true, dampingFactor: 0.07, maxPolarAngle: Math.PI * 0.495, minDistance: 15, maxDistance: 14000, zoomSpeed: 1.1, screenSpacePanning: false });
    this.keys = new Set();
    this.yaw = 0; this.pitch = 0; this.vy = 0;
    this.anim = null; this.tour = null;
    this.focus = new THREE.Vector3();
    this.onChange = () => {};
    addEventListener('keydown', (e) => { if (e.target.tagName === 'INPUT') return; this.keys.add(e.code); });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    dom.addEventListener('mousedown', (e) => { this.drag = e.button === 0 || e.button === 2; this.lx = e.clientX; this.ly = e.clientY; if ((this.mode === 'walk' || this.mode === 'fly') && e.button === 0 && !document.pointerLockElement) dom.requestPointerLock?.(); this.cancelAnim(); });
    addEventListener('mouseup', () => { this.drag = false; });
    addEventListener('mousemove', (e) => {
      if (this.mode === 'orbit') return;
      const locked = document.pointerLockElement === dom;
      if (!locked && !this.drag) return;
      const dx = locked ? e.movementX : e.clientX - this.lx, dy = locked ? e.movementY : e.clientY - this.ly;
      this.lx = e.clientX; this.ly = e.clientY;
      this.yaw -= dx * 0.0022; this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch - dy * 0.0022));
    });
    dom.addEventListener('wheel', () => this.cancelAnim(), { passive: true });
    dom.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  setMode(m) {
    if (m === this.mode) return;
    const cam = this.camera;
    this.cancelAnim();
    if (m === 'orbit') {
      const fwd = new THREE.Vector3(); cam.getWorldDirection(fwd);
      const dist = Math.max(60, (cam.position.y - terrainH(cam.position.x, -cam.position.z)) * 1.5);
      this.orbit.target.copy(cam.position).addScaledVector(fwd, dist);
      this.orbit.target.y = Math.max(this.orbit.target.y, terrainH(this.orbit.target.x, -this.orbit.target.z));
      this.orbit.enabled = true;
      if (document.pointerLockElement) document.exitPointerLock();
    } else {
      this.orbit.enabled = false;
      const e = new THREE.Euler().setFromQuaternion(cam.quaternion, 'YXZ');
      this.yaw = e.y; this.pitch = e.x;
      if (m === 'walk') {
        const p = cam.position;
        let u = p.x, v = -p.z;
        if (p.y - terrainH(u, v) > 40) { const t = this.orbit.target; u = t.x; v = -t.z; }
        const y = floorAt(u, -v, 1e9);
        cam.position.set(u, Math.max(y, terrainH(u, v)) + 1.7, -v);
        this.pitch = 0; this.vy = 0;
      }
    }
    this.mode = m; this.onChange(m);
  }
  cancelAnim() { if (this.anim && !this.anim.locked) this.anim = null; if (this.tour && this.tourCancelable) this.endTour(); }
  // smooth flight to a view of a landmark, then orbit around it
  flyTo(L, opts = {}) {
    if (this.mode !== 'orbit') this.setMode('orbit');
    const cam = this.camera;
    const tgt = new THREE.Vector3(L.u, terrainH(L.u, L.v) + (L.h || 30) * 0.45, -L.v);
    const yaw = (opts.yaw ?? L.yaw) * Math.PI / 180, pitch = (opts.pitch ?? L.pitch ?? 18) * Math.PI / 180, dist = opts.dist ?? L.dist;
    const pos = tgt.clone().add(new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(dist));
    pos.y = Math.max(pos.y, floorAt(pos.x, pos.z) + 8);
    const p0 = cam.position.clone(), t0 = this.orbit.target.clone();
    const travel = p0.distanceTo(pos);
    const lift = Math.min(900, travel * 0.25);
    this.anim = { t: 0, dur: Math.min(6, 2 + travel / 2500), p0, t0, p1: pos, t1: tgt, lift };
  }
  startTour(i, atmo, onEnd) {
    const T = TOURS[i];
    this.setMode('orbit');
    this.tour = { T, t: 0, pos: new THREE.CatmullRomCurve3(T.cam, false, 'centripetal'), tgt: new THREE.CatmullRomCurve3(T.tgt, false, 'centripetal'), onEnd };
    this.tourCancelable = false; setTimeout(() => { this.tourCancelable = true; }, 1200);
    this.orbit.enabled = false;
  }
  endTour() { if (!this.tour) return; const cb = this.tour.onEnd; this.tour = null; this.orbit.enabled = this.mode === 'orbit'; cb?.(); }
  update(dt) {
    const cam = this.camera;
    if (this.tour) {
      const tr = this.tour; tr.t += dt / tr.T.dur;
      const k = Math.min(1, tr.t), e = k * k * (3 - 2 * k) * 0.15 + k * 0.85;
      cam.position.copy(tr.pos.getPointAt(Math.min(1, e)));
      const look = tr.tgt.getPointAt(Math.min(1, e));
      cam.lookAt(look); this.orbit.target.copy(look);
      this.focus.copy(cam.position).lerp(look, 0.5);
      if (tr.t >= 1) this.endTour();
      return;
    }
    if (this.anim) {
      const a = this.anim; a.t += dt / a.dur; const k = ease(Math.min(1, a.t));
      cam.position.lerpVectors(a.p0, a.p1, k); cam.position.y += Math.sin(Math.PI * k) * a.lift;
      this.orbit.target.lerpVectors(a.t0, a.t1, k);
      cam.lookAt(this.orbit.target);
      if (a.t >= 1) { this.anim = null; this.orbit.update(); }
      this.focus.copy(this.orbit.target);
      return;
    }
    const k = this.keys, fast = k.has('ShiftLeft') || k.has('ShiftRight');
    if (this.mode === 'orbit') {
      // WASD pans the target across the city, scaled with distance
      const d = cam.position.distanceTo(this.orbit.target);
      const sp = d * 0.9 * dt * (fast ? 3 : 1);
      const f = new THREE.Vector3(); cam.getWorldDirection(f); f.y = 0; f.normalize();
      const r = new THREE.Vector3(-f.z, 0, f.x);
      const mv = new THREE.Vector3();
      if (k.has('KeyW') || k.has('ArrowUp')) mv.add(f); if (k.has('KeyS') || k.has('ArrowDown')) mv.sub(f);
      if (k.has('KeyD') || k.has('ArrowRight')) mv.add(r); if (k.has('KeyA') || k.has('ArrowLeft')) mv.sub(r);
      if (mv.lengthSq()) { mv.normalize().multiplyScalar(sp); cam.position.add(mv); this.orbit.target.add(mv); }
      this.orbit.update();
      const g = floorAt(cam.position.x, cam.position.z) + 4;
      if (cam.position.y < g) { cam.position.y = g; }
      const tg = this.orbit.target; const tgy = terrainH(tg.x, -tg.z);
      if (tg.y < tgy) tg.y = tgy;
      this.focus.copy(tg);
      return;
    }
    cam.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const mv = new THREE.Vector3();
    if (k.has('KeyW') || k.has('ArrowUp')) mv.add(fwd); if (k.has('KeyS') || k.has('ArrowDown')) mv.sub(fwd);
    if (k.has('KeyD') || k.has('ArrowRight')) mv.add(right); if (k.has('KeyA') || k.has('ArrowLeft')) mv.sub(right);
    if (this.mode === 'fly') {
      const alt = Math.max(5, cam.position.y - terrainH(cam.position.x, -cam.position.z));
      const sp = Math.min(400, 12 + alt * 0.9) * (fast ? 3.5 : 1);
      const look = new THREE.Vector3(); cam.getWorldDirection(look);
      if (mv.lengthSq()) { mv.normalize(); const f2 = look.clone().multiplyScalar(mv.dot(fwd)); f2.add(right.clone().multiplyScalar(mv.dot(right))); cam.position.addScaledVector(f2, sp * dt); }
      if (k.has('KeyE') || k.has('Space')) cam.position.y += sp * dt; if (k.has('KeyQ') || k.has('KeyC')) cam.position.y -= sp * dt;
      const g = floorAt(cam.position.x, cam.position.z, cam.position.y) + 2;
      if (cam.position.y < g) cam.position.y = g;
      this.focus.copy(cam.position).addScaledVector(look, Math.min(250, alt * 1.2));
      return;
    }
    // walk
    const sp = (fast ? 6.5 : 2.2);
    const p = cam.position;
    if (mv.lengthSq()) {
      mv.normalize().multiplyScalar(sp * dt);
      const feet = p.y - 1.7;
      const tryMove = (dx, dz) => {
        const nx = p.x + dx, nz = p.z + dz;
        const fl = floorAt(nx, nz, feet + 0.6);
        if (fl > feet + 0.6) return false;
        if (BOXES.inside(nx, nz, feet + 0.7, 0.35)) return false;
        p.x = nx; p.z = nz; return true;
      };
      if (!tryMove(mv.x, mv.z)) { tryMove(mv.x, 0) || tryMove(0, mv.z); }
    }
    const fl = floorAt(p.x, p.z, p.y - 1.1);
    this.vy -= 9.8 * dt;
    p.y += this.vy * dt;
    if (p.y < fl + 1.7) { p.y += (fl + 1.7 - p.y) * Math.min(1, dt * 14); this.vy = 0; }
    if (k.has('Space') && Math.abs(p.y - fl - 1.7) < 0.05) this.vy = 4;
    this.focus.copy(p).addScaledVector(fwd, 60);
  }
}

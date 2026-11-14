import * as THREE from 'three';
// Free-fly camera (WASD / QE, drag to look, wheel = speed) plus a chase mode that follows a vehicle.
export class Controls {
  constructor(cam, dom) {
    this.cam = cam; this.dom = dom; this.yaw = 0; this.pitch = -0.35; this.speed = 120; this.keys = {}; this.follow = null; this.drag = false; this.back = 42; this.hgt = 16;
    this.fp = new THREE.Vector3(); this.fl = new THREE.Vector3();
    addEventListener('keydown', (e) => { if (e.target.tagName === 'INPUT') return; this.keys[e.code] = true; });
    addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    dom.addEventListener('pointerdown', (e) => { this.drag = true; this.lx = e.clientX; this.ly = e.clientY; dom.setPointerCapture(e.pointerId); });
    dom.addEventListener('pointerup', () => { this.drag = false; });
    dom.addEventListener('pointermove', (e) => { if (!this.drag) return; this.yaw -= (e.clientX - this.lx) * 0.0035; this.pitch = Math.max(-1.55, Math.min(1.55, this.pitch - (e.clientY - this.ly) * 0.0035)); this.lx = e.clientX; this.ly = e.clientY; });
    dom.addEventListener('wheel', (e) => { e.preventDefault(); this.speed = Math.max(8, Math.min(3000, this.speed * (e.deltaY < 0 ? 1.15 : 0.87))); }, { passive: false });
  }
  update(dt) {
    const c = this.cam;
    if (this.follow) {
      const v = this.follow, back = this.back, hgt = this.hgt;
      const tx = v.x - Math.sin(v.h) * back, tz = v.z - Math.cos(v.h) * back, k = 1 - Math.exp(-dt * 2.2);
      this.fp.set(tx, hgt, tz); c.position.lerp(this.fp, k); this.fl.set(v.x, 3, v.z);
      c.lookAt(this.fl); return;
    }
    c.rotation.order = 'YXZ'; c.rotation.set(this.pitch, this.yaw, 0);
    const k = this.keys, sp = this.speed * (k.ShiftLeft || k.ShiftRight ? 4 : 1) * dt;
    const f = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0), r = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0), u = (k.KeyE || k.Space ? 1 : 0) - (k.KeyQ || k.KeyC ? 1 : 0);
    c.translateZ(-f * sp); c.translateX(r * sp); c.position.y = Math.max(2, c.position.y + u * sp);
  }
}

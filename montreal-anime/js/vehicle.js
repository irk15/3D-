// vehicle.js — cars you can drive. A bicycle-model chassis with an engine curve, gears, brakes and a
// handbrake; tyre grip that lets the rear step out when you push it; suspension that follows the
// street (pitch on hills, dive under braking, squat on acceleration, roll in corners); collisions with
// buildings, parked cars, traffic and other drivable cars (with a bounce and a thump), loose props that
// get knocked flying, and pedestrians who jump out of the way.
import * as THREE from 'three';
import { h, WALK, inWalk } from './layout.js';
import { carDrivable } from './cars.js';

const GEARS = [0, 4.2, 9, 15, 22, 30, 60];   // m/s where each gear tops out
export class Vehicle {
  constructor(scene, world, kind, color, x, z, yaw) {
    this.w = world; this.kind = kind; this.color = color;
    this.m = carDrivable(color, kind); scene.add(this.m.g);
    const S = this.S = this.m.S;
    this.pos = new THREE.Vector3(x, world.colliders.ground(x, z, h(z) + 2, 0), z); this.yaw = yaw;
    this.vF = 0; this.vR = 0; this.vy = 0; this.steer = 0; this.yawRate = 0;
    this.pitch = 0; this.roll = 0; this.dive = 0; this.spin = 0; this.rpm = 900; this.gear = 'P';
    this.driver = null; this.impact = 0; this.horn = 0; this.braking = false;
    this.place();
  }
  get speed() { return Math.abs(this.vF); }
  forward() { return new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }
  // three circles along the car approximate its footprint
  circles(x, z, yaw) { const s = Math.sin(yaw), c = Math.cos(yaw), r = this.S.W / 2, o = this.S.L / 2 - r; return [[x + s * o, z + c * o, r], [x, z, r], [x - s * o, z - c * o, r]]; }
  blockedAt(x, z, yaw, others) {
    const C = this.w.colliders, y = this.pos.y;
    if (!inWalk(x, z)) return true;
    for (const [cx, cz, r] of this.circles(x, z, yaw)) {
      if (C.blocked(cx, cz, r * 0.92, y, 0.55, y + 1.3)) return true;
      for (const o of others) if (o !== this && o.hitCircle && o.hitCircle(cx, cz, r * 0.92)) return o;
    }
    return false;
  }
  hitCircle(x, z, r) { for (const [cx, cz, rr] of this.circles(this.pos.x, this.pos.z, this.yaw)) if ((cx - x) ** 2 + (cz - z) ** 2 < (r + rr) ** 2) return true; return false; }
  update(dt, inp, ctx) {
    const S = this.S, C = this.w.colliders;
    const driving = !!inp;
    const thr = driving ? Math.max(0, inp.y) : 0, brk = driving ? Math.max(0, -inp.y) : 0, steerIn = driving ? -inp.x : 0, hand = driving && inp.jumpHeld;
    // engine / brakes / reverse
    let a = 0; this.braking = false;
    const vmax = this.kind === 'sport' ? 52 : this.kind === 'van' || this.kind === 'pickup' ? 33 : 40;
    if (thr > 0) { if (this.vF < -0.5) { a = 16 * thr; this.braking = true; } else a = (this.kind === 'sport' ? 11 : 8) * thr * Math.max(0.12, 1 - this.vF / vmax); }
    if (brk > 0) { if (this.vF > 0.5) { a = -16 * brk; this.braking = true; } else a = -5 * brk * Math.max(0, 1 + this.vF / 9); }
    if (hand) { a += -Math.sign(this.vF) * 6; this.braking = true; }
    a -= this.vF * Math.abs(this.vF) * 0.0028 + Math.sign(this.vF) * 0.35;   // air drag + rolling resistance
    if (!driving) a = -Math.sign(this.vF) * Math.min(Math.abs(this.vF) / dt, 5);
    if (Math.abs(this.vF) < 0.05 && !thr && !brk) this.vF = 0;
    // steering: less lock at speed; yaw rate from the bicycle model, limited by tyre grip
    const lock = 0.6 / (1 + this.speed * 0.045);
    this.steer += (steerIn * lock - this.steer) * (1 - Math.exp(-dt * 7));
    const wb = S.wb * 2;
    let yr = this.vF / wb * Math.tan(this.steer);
    const grip = hand ? 5 : 11, lat = Math.abs(yr * this.vF);
    if (lat > grip) { const k = grip / lat; this.vR += -this.vF * yr * (1 - k) * dt * 0.9; yr *= k + (1 - k) * (hand ? 0.85 : 0.35); }
    this.yawRate += (yr - this.yawRate) * (1 - Math.exp(-dt * 10));
    const prevYaw = this.yaw; this.yaw += this.yawRate * dt;
    this.vF += a * dt;
    this.vR *= Math.exp(-dt * (hand ? 1.2 : 6));
    // move, then resolve collisions against the city, traffic and other cars
    const f = this.forward(), r = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const vx = f.x * this.vF + r.x * this.vR, vz = f.z * this.vF + r.z * this.vR;
    const nx = this.pos.x + vx * dt, nz = this.pos.z + vz * dt;
    const hitAt = (x, z) => { const o = this.blockedAt(x, z, this.yaw, ctx.vehicles); if (o) return o; if (ctx.traffic) for (const [cx, cz, cr] of this.circles(x, z, this.yaw)) { const t = ctx.traffic.hitCar(cx, cz, cr); if (t) return t; } return false; };
    // street furniture gives way (lamps bend and fall, bins fly): it costs a little speed instead of a wall
    if (ctx.breakables && this.speed > 2.2) { let f = 1; for (const [cx, cz, cr] of this.circles(nx, nz, this.yaw)) f *= ctx.breakables.hit(cx, cz, cr, vx, vz, this.speed); if (f < 1) { this.vF *= f; this.vR *= f; this.impact = Math.max(this.impact, (1 - f) * 30); this.dmg = Math.min(1, (this.dmg || 0) + (1 - f) * 0.08); } }
    const hit = hitAt(nx, nz);
    if (!hit) { this.pos.x = nx; this.pos.z = nz; }
    else {
      // slide along what we hit (a wall, a parked car) instead of sticking to it; bounce only on a square hit
      const okX = !hitAt(nx, this.pos.z), okZ = !hitAt(this.pos.x, nz), sp = Math.hypot(vx, vz);
      let jolt;
      if (okX && Math.abs(vx) > 0.05) { this.pos.x = nx; jolt = Math.abs(vz); const k = Math.abs(vx) / (sp || 1); this.vF *= 0.55 + 0.43 * k; this.vR *= 0.5; }
      else if (okZ && Math.abs(vz) > 0.05) { this.pos.z = nz; jolt = Math.abs(vx); const k = Math.abs(vz) / (sp || 1); this.vF *= 0.55 + 0.43 * k; this.vR *= 0.5; }
      else { jolt = sp; this.vF *= -0.22; this.vR *= 0.3; this.yawRate *= -0.3; }
      this.impact = Math.max(this.impact, jolt);
      this.dmg = Math.min(1, (this.dmg || 0) + Math.max(0, jolt - 6) * 0.014);
      if (hitAt(this.pos.x, this.pos.z)) this.yaw = prevYaw;
      if (hit.isTrafficCar) hit.bumped(f.x * this.vF, f.z * this.vF);
      if (hit instanceof Vehicle) { hit.vF += this.vF * 0.45; hit.vR += this.vR * 0.5; hit.impact = Math.max(hit.impact, sp * 0.6); }
    }
    // never stay inside something (traffic that drove into us, a spawn on a kerb): ease out to the nearest free spot
    if (hitAt(this.pos.x, this.pos.z)) {
      this.stuckT = (this.stuckT || 0) + dt;
      if (this.stuckT > 0.15) out: for (const rr of [0.25, 0.5, 0.8, 1.2, 1.8, 2.6]) for (let i = 0; i < 12; i++) {
        const a2 = i / 12 * Math.PI * 2, x = this.pos.x + Math.cos(a2) * rr, z = this.pos.z + Math.sin(a2) * rr;
        if (!hitAt(x, z)) { this.pos.x += (x - this.pos.x) * Math.min(1, dt * 10); this.pos.z += (z - this.pos.z) * Math.min(1, dt * 10); break out; }
      }
    } else this.stuckT = 0;
    // loose props and people
    for (const [cx, cz, cr] of this.circles(this.pos.x, this.pos.z, this.yaw)) ctx.props?.push(cx, cz, this.pos.y, this.pos.y + 1.4, cr, vx, vz, 1300);
    if (ctx.peds && this.speed > 0.4) for (const n of ctx.peds) {
      if (n.rag) continue;
      let hitIt = false, near = false, px = 0, pz = 0, pen = 0;
      for (const [cx, cz, cr] of this.circles(this.pos.x, this.pos.z, this.yaw)) { const d2 = (n.pos.x - cx) ** 2 + (n.pos.z - cz) ** 2; if (Math.abs(n.pos.y - this.pos.y) < 1.6 && d2 < (cr + 0.35) ** 2) { hitIt = true; const d = Math.sqrt(d2) || 0.01, o = cr + 0.36 - d; if (o > pen) { pen = o; px = (n.pos.x - cx) / d; pz = (n.pos.z - cz) / d; } } }
      if (hitIt && this.speed <= 3.2) { if (n.offX !== undefined) { n.offX += px * pen; n.offZ += pz * pen; } else { n.pos.x += px * pen; n.pos.z += pz * pen; if (n.home) n.home.set(n.pos.x, n.pos.y, n.pos.z); } continue; }   // slow: just nudge them aside, never drive through
      if (hitIt && this.speed > 3.2 && ctx.hitPed) { ctx.hitPed(n, vx, vz, this.speed, this); this.vF *= 0.985; continue; }
      const dx = n.pos.x - (this.pos.x + f.x * 3), dz = n.pos.z - (this.pos.z + f.z * 3); if (dx * dx + dz * dz < 9) near = true;
      if (near && this.speed > 2.5) n.dodge?.(r.x * Math.sign(dx * r.x + dz * r.z || 1), r.z * Math.sign(dx * r.x + dz * r.z || 1));
    }
    // suspension: ground under each wheel → height, pitch and roll; airborne off ledges
    const W = this.m.wheels, hs = [];
    for (const w of W) { const lx = w.g.position.x, lz = w.g.position.z, wx = this.pos.x + f.x * lz + r.x * lx, wz = this.pos.z + f.z * lz + r.z * lx; hs.push(C.ground(wx, wz, this.pos.y + 0.6, 0)); }
    const front = (hs[0] + hs[1]) / 2, rear = (hs[2] + hs[3]) / 2, left = (hs[0] + hs[2]) / 2, right = (hs[1] + hs[3]) / 2, gy = Math.max((front + rear) / 2, Math.max(...hs) - 0.25);
    if (this.pos.y > gy + 0.05) { this.vy -= 15 * dt; this.pos.y = Math.max(gy, this.pos.y + this.vy * dt); if (this.pos.y <= gy) { this.impact = Math.max(this.impact, -this.vy * 0.6); this.vy = 0; } }
    else { this.pos.y += (gy - this.pos.y) * (1 - Math.exp(-dt * 18)); this.climb = (this.climb || 0) + (Math.min(14, (gy - (this._gy ?? gy)) / Math.max(dt, 1e-3)) - (this.climb || 0)) * Math.min(1, dt * 8); this.vy = Math.max(0, this.climb - 0.6); }   // a sustained climb (a ramp, not a kerb) launches you
    this._gy = gy;
    const tp = Math.atan2(rear - front, wb), tr = Math.atan2(right - left, S.W - 0.3);
    this.dive += ((-a * 0.0065) - this.dive) * (1 - Math.exp(-dt * 6));
    this.pitch += (tp + this.dive - this.pitch) * (1 - Math.exp(-dt * 9));
    this.roll += (tr + this.yawRate * this.vF * 0.0045 - this.roll) * (1 - Math.exp(-dt * 7));
    // gears and revs (for the gauges and the engine sound)
    const v = Math.abs(this.vF); let gi = 1; while (gi < GEARS.length - 1 && v > GEARS[gi]) gi++;
    const lo = GEARS[gi - 1], hi = GEARS[gi];
    const rpmT = this.vF < -0.3 ? 1500 + v * 300 : v < 0.2 ? 850 + thr * 2500 : 1300 + (v - lo) / (hi - lo) * 4800 + thr * 400;
    this.rpm += (rpmT - this.rpm) * (1 - Math.exp(-dt * 8));
    this.gear = !driving ? 'P' : this.vF < -0.3 ? 'R' : v < 0.2 && !thr ? 'N' : String(gi);
    this.spin += this.vF * dt / S.wr;
    this.place(dt, ctx);
  }
  place(dt = 0, ctx = {}) {
    const g = this.m.g;
    g.position.copy(this.pos); g.rotation.set(this.pitch, this.yaw, this.roll, 'YXZ');
    for (const w of this.m.wheels) { w.spin.rotation.x = this.spin; if (w.front) w.g.rotation.y = this.steer; }
    this.m.wheel.rotation.z = -this.steer * 5.5;
    const night = ctx.night || 0;
    this.m.hl.emissiveIntensity = 0.2 + night * 2.8; this.m.tl.emissiveIntensity = 0.2 + night * 1.2 + (this.braking ? 2.4 : 0);
    if (dt && this.driver) this.m.updateGauges(dt, Math.abs(this.vF) * 3.6, this.rpm, this.gear, night > 0.4, ctx.clock || '');
  }
  // world-space seat / eye / door positions
  local(v) { return v.clone().applyEuler(this.m.g.rotation).add(this.pos); }
  seatPos() { return this.local(this.m.seat); }
  eyePos() { return this.local(this.m.eye); }
  doorPos() { const S = this.S; return this.local(new THREE.Vector3(S.W / 2 + 1.0, 0, this.m.seat.z)); }
}

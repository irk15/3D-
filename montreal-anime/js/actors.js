// actors.js — anime characters (procedural, toon + ink), the player controller, neighbours,
// cars with lights and stop signs, pigeons, a cat and the golden bagels.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { h, CURB, nsX, ewZ, nsHW, nsSW, ewHW, ewSW, BOUNDS, PLAZA, PARK, rng, pick, U } from './layout.js';
import { toon, LAYER_FX, gradient, Glows } from './toon.js';

const basic = (hex) => new THREE.MeshBasicMaterial({ color: hex });
const EYE = basic(0x231a3a), WHITE = basic(0xffffff), BLUSH = new THREE.MeshBasicMaterial({ color: 0xf28a96, transparent: true, opacity: 0.55, depthWrite: false });

function mesh(g, m, parent, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) {
  const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o;
}
const G = {
  sph: new THREE.SphereGeometry(1, 20, 14), cap: (r, l) => new THREE.CapsuleGeometry(r, l, 4, 12), cyl: new THREE.CylinderGeometry(1, 1, 1, 16),
};

// ================================================================= character
export function makeCharacter(o = {}) {
  const c = Object.assign({ skin: '#f6d2b8', hair: '#3a2a3a', top: '#2f8f8a', pants: '#2f3550', shoes: '#f4efe6', hat: 'tuque', hatCol: '#d8473f', scarf: '#f2b43c', pack: '#e9a23b', style: 'short', scale: 1 }, o);
  const root = new THREE.Group();
  const body = new THREE.Group(); body.position.y = 0.8; root.add(body);
  const M = (k) => toon(c[k]);
  mesh(G.sph, toon(c.pants), body, 0, 0, 0, 0.16, 0.12, 0.13);
  const torso = new THREE.Group(); body.add(torso);
  mesh(G.cap(0.15, 0.2), M('top'), torso, 0, 0.25, 0, 1.06, 1, 0.8);
  mesh(G.cyl, toon(c.skin), torso, 0, 0.47, 0, 0.05, 0.1, 0.05);
  const head = new THREE.Group(); head.position.y = 0.5; torso.add(head);
  mesh(G.sph, toon(c.skin), head, 0, 0.17, 0, 0.165, 0.172, 0.16);
  const eyes = [];
  for (const s of [-1, 1]) {
    const ey = mesh(G.sph, EYE, head, s * 0.058, 0.158, 0.143, 0.022, 0.036, 0.012); ey.castShadow = false; eyes.push(ey);
    const hl = mesh(G.sph, WHITE, head, s * 0.058 + 0.008, 0.172, 0.152, 0.008, 0.01, 0.006); hl.castShadow = false; eyes.push(hl);
    const b = mesh(G.sph, BLUSH, head, s * 0.098, 0.11, 0.128, 0.026, 0.013, 0.008); b.castShadow = false; b.layers.set(LAYER_FX);
  }
  const mouth = mesh(G.sph, EYE, head, 0, 0.083, 0.156, 0.018, 0.006, 0.005); mouth.castShadow = false;
  // hair
  const hairM = toon(c.hair);
  const capG = new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.58);
  mesh(capG, hairM, head, 0, 0.185, -0.012, 0.176, 0.18, 0.172).rotation.x = -0.25;
  for (let i = -2; i <= 2; i++) { const b = mesh(new THREE.ConeGeometry(1, 1, 4), hairM, head, i * 0.045, 0.255, 0.13, 0.04, 0.11, 0.025); b.rotation.x = Math.PI + 0.35; b.rotation.z = i * 0.15; }
  if (c.style === 'bob' || c.style === 'long') {
    const len = c.style === 'long' ? 0.28 : 0.15;
    mesh(new THREE.CylinderGeometry(1, 1.1, 1, 16, 1, true, Math.PI * 0.75, Math.PI * 1.5), hairM, head, 0, 0.16 - len / 2, -0.01, 0.18, 0.12 + len, 0.175);
  }
  if (c.style === 'pony') { const p = mesh(G.cap(0.06, 0.16), hairM, head, 0, 0.12, -0.2); p.rotation.x = 0.5; }
  if (c.style === 'bun') mesh(G.sph, hairM, head, 0, 0.36, -0.06, 0.08, 0.08, 0.08);
  if (c.hat === 'tuque') {
    const hm = toon(c.hatCol);
    mesh(new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), hm, head, 0, 0.215, -0.005, 0.185, 0.2, 0.18);
    mesh(new THREE.CylinderGeometry(1, 1, 1, 24), toon('#f4efe6'), head, 0, 0.22, -0.005, 0.19, 0.06, 0.183);
    mesh(G.sph, toon('#f4efe6'), head, 0, 0.43, -0.01, 0.06, 0.06, 0.06);
  } else if (c.hat === 'cap') {
    const hm = toon(c.hatCol);
    mesh(new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), hm, head, 0, 0.22, 0, 0.18, 0.14, 0.175);
    mesh(G.cyl, hm, head, 0, 0.225, 0.16, 0.12, 0.02, 0.1);
  }
  if (c.scarf) { const sc = toon(c.scarf); mesh(new THREE.TorusGeometry(1, 0.42, 8, 18), sc, torso, 0, 0.45, 0, 0.11, 0.11, 0.1).rotation.x = Math.PI / 2; mesh(new THREE.BoxGeometry(1, 1, 1), sc, torso, 0.05, 0.33, 0.12, 0.07, 0.2, 0.04); }
  if (c.pack) { mesh(new THREE.BoxGeometry(1, 1, 1), toon(c.pack), torso, 0, 0.28, -0.16, 0.26, 0.3, 0.13); mesh(new THREE.BoxGeometry(1, 1, 1), toon('#7a4a2a'), torso, 0, 0.22, -0.235, 0.18, 0.1, 0.03); }
  // limbs
  const arm = (s) => {
    const sh = new THREE.Group(); sh.position.set(s * 0.19, 0.4, 0); torso.add(sh);
    mesh(G.cap(0.048, 0.17), M('top'), sh, 0, -0.12, 0);
    const el = new THREE.Group(); el.position.y = -0.25; sh.add(el);
    mesh(G.cap(0.042, 0.15), M('top'), el, 0, -0.1, 0);
    mesh(G.sph, toon(c.skin), el, 0, -0.23, 0, 0.048, 0.052, 0.048);
    return { sh, el };
  };
  const leg = (s) => {
    const hp = new THREE.Group(); hp.position.set(s * 0.085, -0.02, 0); body.add(hp);
    mesh(G.cap(0.068, 0.24), toon(c.pants), hp, 0, -0.18, 0);
    const kn = new THREE.Group(); kn.position.y = -0.38; hp.add(kn);
    mesh(G.cap(0.058, 0.24), toon(c.pants), kn, 0, -0.18, 0);
    const ft = mesh(G.cap(0.055, 0.1), toon(c.shoes), kn, 0, -0.38, 0.04); ft.rotation.x = Math.PI / 2;
    return { hp, kn };
  };
  const L = { arm: [arm(1), arm(-1)], leg: [leg(1), leg(-1)] };
  // umbrella in the right hand (rain + glide), parcel on the back (deliveries)
  const umb = new THREE.Group(); umb.position.y = -0.23; L.arm[1].el.add(umb); umb.visible = false;
  mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.95, 6), toon('#2a2e33'), umb, 0, -0.4, 0);
  const canopyCol = c.umbrella || pick(['#e4402b', '#2f7fbf', '#f2b43c', '#7b4fb0', '#3f9a6a', '#e79cb4'], Math.random);
  const can = mesh(new THREE.ConeGeometry(0.62, 0.3, 10, 1, true), toon(canopyCol, { side: THREE.DoubleSide }), umb, 0, -0.92, 0); can.rotation.x = Math.PI;
  const parcel = new THREE.Group(); torso.add(parcel); parcel.visible = false;
  // paper-crane wings for flying: three soft feathers per side, tipped with the tuque colour
  const wings = new THREE.Group(); wings.position.set(0, 0.36, -0.2); torso.add(wings); wings.visible = false;
  const wingL = new THREE.Group(), wingR = new THREE.Group(); wings.add(wingL, wingR);
  const fW = toon('#fbf7ef'), fT = toon(c.hatCol);
  for (const [w, s2] of [[wingL, 1], [wingR, -1]]) {
    [[0.34, 0.11, 0.0, 0.62], [0.28, 0.1, -0.12, 0.5], [0.22, 0.09, -0.22, 0.38]].forEach(([len, wd, dy, out], i) => {
      const f = mesh(G.sph, i === 0 ? fW : fW, w, s2 * out * 0.62, dy, -0.02 * i, len, wd, 0.025); f.rotation.z = s2 * (0.25 + i * 0.22);
      const tip = mesh(G.sph, fT, w, s2 * out * 1.12, dy - 0.04 - i * 0.03, -0.02 * i - 0.005, len * 0.28, wd * 0.8, 0.02); tip.rotation.z = s2 * (0.3 + i * 0.22);
    });
  }
  mesh(new THREE.BoxGeometry(0.36, 0.28, 0.26), toon('#c89a5e'), parcel, 0, 0.5, -0.24);
  mesh(new THREE.BoxGeometry(0.37, 0.05, 0.27), toon('#e4402b'), parcel, 0, 0.5, -0.24);
  root.scale.setScalar(c.scale);
  const st = { ph: 0, air: 0, run: 0, mv: 0, land: 0, t: Math.random() * 10, look: 0 };
  const lerp = (a, b, k) => a + (b - a) * k;
  let blinkT = 2 + Math.random() * 3, blink = 0;
  function animate(dt, speed, grounded, wave = 0, o = {}) {
    st.t += dt;
    const k = 1 - Math.exp(-dt * 14);
    st.mv = lerp(st.mv, Math.min(1, speed / 1.8), k);
    st.run = lerp(st.run, Math.min(1, Math.max(0, (speed - 3.0) / 2.2)), k);
    st.air = lerp(st.air, grounded ? 0 : 1, 1 - Math.exp(-dt * 10));
    const stride = 1.15 + 0.9 * st.run;
    const prev = st.ph;
    st.ph += dt * speed / stride * Math.PI * 2 * (grounded ? 1 : 0.2);
    const sw = (0.5 + 0.35 * st.run) * st.mv, ph = st.ph, m = st.mv, r = st.run, a = st.air;
    const step = Math.floor(prev / Math.PI) !== Math.floor(st.ph / Math.PI) && grounded && speed > 0.3;
    for (let i = 0; i < 2; i++) {
      const s = i ? -1 : 1, sp = Math.sin(ph) * s, cp = Math.cos(ph) * s;
      const lg = L.leg[i], ar = L.arm[i];
      lg.hp.rotation.x = lerp(-sp * sw, i ? 0.35 : -0.6, a);
      lg.kn.rotation.x = lerp(m * (0.08 + (0.7 + 0.7 * r) * Math.max(0, cp)), i ? 0.4 : 1.1, a);
      ar.sh.rotation.x = lerp(sp * sw * 0.9 + Math.sin(st.t * 1.8) * 0.03 * (1 - m), -2.6 + i * 0.4, a);
      ar.sh.rotation.z = lerp(s * (0.1 + 0.05 * (1 - m)), s * 0.5, a);
      ar.el.rotation.x = lerp(-(0.18 + 1.0 * r) * m - 0.1, -0.4, a);
    }
    body.position.y = 0.8 - Math.abs(Math.cos(ph)) * 0.035 * m + 0.02 * a - st.land * 0.08;
    torso.rotation.x = 0.04 * m + 0.2 * r + 0.08 * a;
    body.rotation.y = Math.sin(ph) * 0.07 * m; torso.rotation.y = -Math.sin(ph) * 0.1 * m;
    torso.scale.y = 1 + Math.sin(st.t * 2.2) * 0.012 * (1 - m);
    head.rotation.y = lerp(head.rotation.y, st.look, k * 0.5) + Math.sin(st.t * 0.7) * 0.05 * (1 - m);
    head.rotation.x = -0.04 * r;
    if (wave > 0) { L.arm[1].sh.rotation.x = -2.7; L.arm[1].sh.rotation.z = -0.4 + Math.sin(st.t * 10) * 0.25 * wave; L.arm[1].el.rotation.x = -0.3; }
    // umbrella: right arm up holding it overhead
    umb.visible = !!o.umbrella;
    if (o.umbrella) { L.arm[1].sh.rotation.x = Math.PI - 0.15; L.arm[1].sh.rotation.z = -0.15; L.arm[1].el.rotation.x = 0.05; }
    parcel.visible = !!o.parcel;
    wings.visible = !!o.wings;
    if (o.wings) { const fl = o.flap ?? 1; const a2 = 0.25 + Math.sin(st.t * (6 + fl * 6)) * (0.15 + 0.45 * fl); wingL.rotation.set(0, -0.35, a2); wingR.rotation.set(0, 0.35, -a2); }
    if (o.fly) {
      const fw = o.fly;   // 0 hover … 1 full speed
      st.fly = lerp(st.fly || 0, fw, k * 0.3);
      const f2 = st.fly;
      torso.rotation.x = 0.1; torso.rotation.y = 0; body.rotation.y = 0; head.rotation.x = -0.9 * f2;
      for (let i = 0; i < 2; i++) { const s2 = i ? -1 : 1; L.leg[i].hp.rotation.x = 0.1 + Math.sin(st.t * 3 + i * 2) * 0.12; L.leg[i].kn.rotation.x = 0.25 + 0.4 * (1 - f2) + Math.sin(st.t * 3 + i * 2) * 0.1; L.arm[i].sh.rotation.x = 0.35 + 0.6 * f2; L.arm[i].sh.rotation.z = s2 * (0.25 + 0.15 * f2); L.arm[i].el.rotation.x = -0.15; }
      if (f2 > 0.7) { L.arm[1].sh.rotation.x = -2.9; L.arm[1].sh.rotation.z = -0.1; L.arm[1].el.rotation.x = 0; }   // super-héros!
      body.position.y = 0.8;
    } else st.fly = 0;
    // on a bike: pedal, hands on the bars, lean forward
    if (o.bike) {
      const p2 = st.ph * 0.9;
      for (let i = 0; i < 2; i++) { const s2 = i ? Math.PI : 0; L.leg[i].hp.rotation.x = -1.05 + Math.sin(p2 + s2) * 0.42; L.leg[i].kn.rotation.x = 1.25 + Math.cos(p2 + s2) * 0.4; L.arm[i].sh.rotation.x = -1.05; L.arm[i].sh.rotation.z = (i ? -1 : 1) * 0.22; L.arm[i].el.rotation.x = -0.35; }
      torso.rotation.x = 0.32; body.position.y = 0.98; body.rotation.y = 0;
    }
    // double-jump flip
    body.rotation.x = o.fly ? 0.15 + 1.2 * st.fly : o.flip ? -o.flip * Math.PI * 2 : 0;
    // blink + talking mouth
    blinkT -= dt; if (blinkT < 0) { blink = 0.14; blinkT = 2 + Math.random() * 4; }
    blink = Math.max(0, blink - dt);
    const ey = blink > 0 ? 0.15 : 1;
    eyes[0].scale.y = 0.036 * ey; eyes[2].scale.y = 0.036 * ey; eyes[1].visible = eyes[3].visible = blink <= 0;
    mouth.scale.y = o.talk ? 0.006 + Math.abs(Math.sin(st.t * 16)) * 0.016 : 0.006;
    st.land = Math.max(0, st.land - dt * 4);
    return step;
  }
  return { root, body, head, st, animate, land() { st.land = 1; } };
}

// ================================================================= player controller
// walk / run / jump + double jump with a flip, umbrella glide, dash, and BIXI bike riding
export class Player {
  constructor(world, char) {
    this.w = world; this.c = char; this.pos = new THREE.Vector3(9, 0, 112); this.pos.y = world.colliders.ground(this.pos.x, this.pos.z, 99);
    this.vel = new THREE.Vector3(); this.vy = 0; this.grounded = true; this.coyote = 0; this.jumpBuf = 0; this.yaw = Math.PI; this.visY = this.pos.y;
    this.boost = 0; this.jumpBoost = 0; this.speed = 0; this.r = 0.3; this.jumps = 0; this.flip = 0; this.gliding = false; this.dashT = 0; this.dashCD = 0; this.airDash = true;
    this.bike = null; this.parcel = false; this.fx = { dashed: false, doubled: false, glide: false, takeoff: false };
    this.flying = false; this.energy = 100; this.flyVel = new THREE.Vector3();
    char.root.position.copy(this.pos); char.root.rotation.y = this.yaw;
  }
  takeOff() { this.flying = true; this.grounded = false; this.flip = 0; this.gliding = false; this.flyVel.set(this.vel.x, Math.max(6, this.vy), this.vel.z); this.flyT = 0; this.fx.takeoff = true; }
  updateFly(dt, inp, camYaw) {
    const C = this.w.colliders, p = this.pos; inp.jump = false; inp.dash = false; this.jumpBuf = 0;
    const pitch = inp.camPitch ?? 0.28, cp = Math.cos(pitch);
    const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw), rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
    const boosting = inp.run && this.energy > 0 && (inp.x || inp.y);
    const sp = this.energy > 0 ? (boosting ? 20 : 10) : 6;
    const climb = (inp.jumpHeld ? 7 : 0) - (inp.down ? 7 : 0) - (pitch - 0.28) * inp.y * 9;
    const tx = (fx * inp.y + rx * inp.x) * sp, tz = (fz * inp.y + rz * inp.x) * sp;
    this.flyT = (this.flyT || 0) + dt;
    let ty = this.energy > 0 ? climb + Math.sin(this.c.st.t * 2) * 0.3 + (this.flyT < 0.9 ? 6 : 0) : -3;
    const k = 1 - Math.exp(-dt * (boosting ? 2.2 : 3.2));
    this.flyVel.x += (tx - this.flyVel.x) * k; this.flyVel.z += (tz - this.flyVel.z) * k; this.flyVel.y += (ty - this.flyVel.y) * (1 - Math.exp(-dt * 3));
    this.energy = Math.max(0, this.energy - dt * (boosting ? 12 : 3.2));
    // horizontal with collisions
    const tryMove = (dx, dz) => {
      const nx = p.x + dx, nz = p.z + dz;
      if (nx < BOUNDS.x0 - 60 || nx > BOUNDS.x1 + 60 || nz < BOUNDS.z0 - 60 || nz > BOUNDS.z1 + 60) return false;
      if (C.blocked(nx, nz, 0.35, p.y, 0.3, p.y + 1.5)) return false;
      p.x = nx; p.z = nz; return true;
    };
    const dx = this.flyVel.x * dt, dz = this.flyVel.z * dt;
    if (!tryMove(dx, dz)) { if (!tryMove(dx, 0)) this.flyVel.x *= -0.3; if (!tryMove(0, dz)) this.flyVel.z *= -0.3; }
    // vertical
    let ny = Math.min(160, p.y + this.flyVel.y * dt);
    if (this.flyVel.y > 0 && C.blocked(p.x, p.z, 0.25, ny + 1.4, 0.0, ny + 1.75) && !C.blocked(p.x, p.z, 0.25, p.y, 0.0, p.y + 1.4)) { ny = p.y; this.flyVel.y = 0; }
    const g = C.ground(p.x, p.z, p.y + 0.3, 0.2);
    if (ny <= g) { ny = g; if (this.flyVel.y <= 0.5 && this.flyT > 0.9) { this.flying = false; this.grounded = true; this.vy = 0; this.jumps = 0; this.c.land(); this.landed = true; } }
    p.y = ny;
    const hs = Math.hypot(this.flyVel.x, this.flyVel.z);
    if (hs > 0.8) { const ty2 = Math.atan2(this.flyVel.x, this.flyVel.z); let d = ty2 - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); this.yaw += d * (1 - Math.exp(-dt * 6)); }
    this.vel.set(this.flyVel.x, 0, this.flyVel.z); this.speed = hs; this.visY = p.y;
    this.c.root.position.set(p.x, p.y, p.z); this.c.root.rotation.y = this.yaw;
    this.c.animate(dt, 0, false, 0, { wings: true, fly: Math.min(1, hs / 14), flap: this.energy > 0 ? (boosting ? 2 : 1) : 0.15, parcel: this.parcel });
    return false;
  }
  mountBike(model) { this.bike = model; this.c.root.add(model.g); model.g.position.set(0, 0, 0); this.r = 0.45; }
  dismount() { if (!this.bike) return; this.c.root.remove(this.bike.g); this.bike = null; this.r = 0.3; }
  update(dt, inp, camYaw) {
    if (inp.fly) { inp.fly = false; if (this.flying) this.flying = false; else if (!this.bike && this.energy > 12) this.takeOff(); }
    if (this.flying) return this.updateFly(dt, inp, camYaw);
    if (this.grounded) this.energy = Math.min(100, this.energy + dt * 28);
    const C = this.w.colliders, p = this.pos, bike = !!this.bike;
    const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw), rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
    let mx = fx * inp.y + rx * inp.x, mz = fz * inp.y + rz * inp.x;
    const mag = Math.min(1, Math.hypot(mx, mz));
    if (mag > 0.01) { const l = Math.hypot(mx, mz); mx /= l; mz /= l; }
    this.jumpBuf -= dt; this.coyote -= dt; this.boost -= dt; this.jumpBoost -= dt; this.dashCD -= dt; this.dashT -= dt;
    let top = (inp.run ? 5.4 : 2.5) * (this.boost > 0 ? 1.4 : 1) * mag;
    if (bike) top = (inp.run ? 11.5 : 8) * mag;
    if (this.gliding) top = Math.max(top, 4.2 * mag);
    // dash
    if (inp.dash && this.dashCD <= 0 && !bike && (this.grounded || this.airDash)) {
      const dx = mag > 0.05 ? mx : Math.sin(this.yaw), dz = mag > 0.05 ? mz : Math.cos(this.yaw);
      this.vel.set(dx * 12, 0, dz * 12); this.dashT = 0.2; this.dashCD = 0.7; if (!this.grounded) { this.airDash = false; this.vy = Math.max(this.vy, 1.5); }
      this.yaw = Math.atan2(dx, dz); this.fx.dashed = true;
    }
    inp.dash = false;
    if (this.dashT <= 0) {
      const acc = bike ? (this.grounded ? 4 : 1.5) : this.grounded ? 16 : 5;
      const k = 1 - Math.exp(-acc * dt);
      if (bike) {
        // a bike can't strafe: steer toward the input, roll forward
        const fwd = this.speed;
        let target = mag > 0.05 ? Math.atan2(mx, mz) : this.yaw, d = target - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
        this.yaw += Math.max(-2.6 * dt, Math.min(2.6 * dt, d)) * Math.min(1, 0.4 + fwd / 4);
        const sp = fwd + ((top * Math.max(0, Math.cos(d))) - fwd) * k;
        this.vel.set(Math.sin(this.yaw) * sp, 0, Math.cos(this.yaw) * sp);
      } else {
        this.vel.x += (mx * top - this.vel.x) * k; this.vel.z += (mz * top - this.vel.z) * k;
        if (mag > 0.05) { const ty = Math.atan2(mx, mz); let d = ty - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); this.yaw += d * (1 - Math.exp(-dt * 12)); }
      }
    }
    const step = bike ? 0.35 : 0.45, head = p.y + 1.5;
    const tryMove = (dx, dz) => {
      const nx = p.x + dx, nz = p.z + dz;
      if (nx < BOUNDS.x0 || nx > BOUNDS.x1 || nz < BOUNDS.z0 || nz > BOUNDS.z1) return false;
      if (C.blocked(nx, nz, this.r, p.y, step, head)) return false;
      if (this.carBlock && this.carBlock(nx, nz)) return false;
      p.x = nx; p.z = nz; return true;
    };
    const dx = this.vel.x * dt, dz = this.vel.z * dt;
    if (!tryMove(dx, dz)) { if (!tryMove(dx, 0)) this.vel.x *= bike ? -0.2 : 0.2; if (!tryMove(0, dz)) this.vel.z *= bike ? -0.2 : 0.2; if (bike) this.bumped = true; }
    // vertical
    const g = C.ground(p.x, p.z, p.y + (this.grounded ? step : 0.05), 0.18);
    if (inp.jump) { this.jumpBuf = 0.15; inp.jump = false; }
    if (this.grounded) {
      if (g < p.y - 0.4) { this.grounded = false; this.coyote = 0.12; this.vy = 0; }
      else { p.y = g; this.vy = 0; this.jumps = 0; this.airDash = true; }
    }
    if (this.jumpBuf > 0) {
      if (this.grounded || this.coyote > 0) { this.vy = bike ? 4.8 : this.jumpBoost > 0 ? 7.6 : 6.0; this.grounded = false; this.coyote = 0; this.jumpBuf = 0; this.jumps = 1; this.jumped = true; }
      else if (!bike && this.jumps < 2 && this.vy < 4) { this.vy = this.jumpBoost > 0 ? 7 : 5.6; this.jumps = 2; this.jumpBuf = 0; this.flip = 0.0001; this.fx.doubled = true; }
      else if (!bike && this.jumps >= 2 && this.flip === 0 && this.energy > 12) { this.jumpBuf = 0; this.takeOff(); return this.updateFly(dt, inp, camYaw); }   // third press: wings!
    }
    this.gliding = false;
    if (!this.grounded) {
      this.vy -= 15 * dt;
      if (!bike && inp.jumpHeld && this.vy < -1.0 && this.jumps >= 1 && this.flip === 0) { this.vy = Math.max(this.vy, -1.7); this.gliding = true; this.fx.glide = true; }
      if (this.dashT > 0) this.vy = Math.max(this.vy, 0);
      p.y += this.vy * dt;
      const g2 = C.ground(p.x, p.z, p.y + 0.05, 0.18);
      if (p.y <= g2 && this.vy <= 0) { p.y = g2; this.grounded = true; if (this.vy < -4) { this.c.land(); this.landed = true; } this.vy = 0; this.flip = 0; }
      if (this.vy > 0 && C.blocked(p.x, p.z, 0.2, p.y + 1.5, 0.05, p.y + 1.7) && !C.blocked(p.x, p.z, 0.2, p.y, 0.05, p.y + 1.2)) this.vy = 0;
    }
    if (this.flip > 0) { this.flip += dt / 0.45; if (this.flip >= 1) this.flip = 0; }
    this.visY += (p.y - this.visY) * (1 - Math.exp(-dt * (this.grounded ? 22 : 60)));
    if (Math.abs(p.y - this.visY) > 1) this.visY = p.y;
    this.speed = Math.hypot(this.vel.x, this.vel.z);
    this.c.root.position.set(p.x, this.visY, p.z); this.c.root.rotation.y = this.yaw;
    if (bike) { this.bike.spin(this.speed * dt); this.c.root.rotation.z = 0; }
    return this.c.animate(dt, bike ? this.speed * 0.45 : this.speed, this.grounded || bike, 0, { umbrella: this.gliding || (inp.rain && !bike), bike, flip: this.flip, parcel: this.parcel });
  }
}
export function bikeModel() {
  const g = new THREE.Group(), red = toon('#d0312d'), dk = toon('#22262b'), grey = toon('#9aa3a8');
  const wheels = [];
  for (const z of [-0.55, 0.55]) { const w = new THREE.Group(); w.position.set(0, 0.36, z); g.add(w); const t = mesh(new THREE.TorusGeometry(0.33, 0.04, 6, 18), dk, w); t.rotation.y = Math.PI / 2; for (let i = 0; i < 3; i++) { const sp = mesh(new THREE.BoxGeometry(0.02, 0.62, 0.02), grey, w); sp.rotation.x = i * Math.PI / 3; } wheels.push(w); }
  const bar = (a, b, t, m) => { const d = new THREE.Vector3().subVectors(b, a), L = d.length(); const o = mesh(new THREE.BoxGeometry(t, L, t), m, g); o.position.copy(a).add(b).multiplyScalar(0.5); o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  bar(V(0, 0.36, -0.55), V(0, 0.75, -0.1), 0.05, red); bar(V(0, 0.75, -0.1), V(0, 0.95, 0.4), 0.06, red); bar(V(0, 0.36, -0.55), V(0, 0.42, 0.1), 0.05, red); bar(V(0, 0.42, 0.1), V(0, 0.95, 0.4), 0.06, red);
  bar(V(0, 0.36, 0.55), V(0, 1.05, 0.42), 0.04, grey); bar(V(-0.28, 1.05, 0.42), V(0.28, 1.05, 0.42), 0.035, dk);
  mesh(new THREE.BoxGeometry(0.16, 0.06, 0.26), dk, g, 0, 0.9, -0.15);
  mesh(new THREE.BoxGeometry(0.34, 0.2, 0.26), red, g, 0, 0.95, 0.62);
  return { g, spin(d) { for (const w of wheels) w.rotation.x += d / 0.33; } };
}

// ================================================================= neighbours
const LINES = [
  ['Mme Tremblay', 'Bonjour-Hi! Belle journée sur le Plateau, hein?'],
  ['Karim', 'Il paraît qu\'il y a douze bagels dorés cachés dans le quartier. Bonne chasse!'],
  ['Amélie', 'Je cherche mon chat… il adore les escaliers en colimaçon.'],
  ['Jean-Philippe', 'Attention aux vélos sur Saint-Denis, la piste est juste là!'],
  ['Mei', 'Le métro Mont-Royal? Tout droit vers le nord, sur la place.'],
  ['Gabriel', 'Monte sur un balcon: d\'en haut, on voit la croix sur la montagne.'],
  ['Fatou', 'Il y a une ruelle verte derrière, pleine de fleurs et de cordes à linge.'],
  ['Olivier', 'Le 1er juillet, tout le monde déménage. Les escaliers débordent de boîtes!'],
  ['Sophie', 'Un croissant de la boulangerie et tu sautes deux fois plus haut. Promis.'],
  ['Ti-Guy', 'T\'as-tu vu le camion à poutine? Moi j\'veux une grosse!'],
  ['Lucie', 'L\'hiver, on déneige les trottoirs la nuit. Quel vacarme!'],
  ['Marc-André', 'Bienvenue à Montréal. Prends ton temps, ici on flâne.'],
];
const LOOKS = [
  { skin: '#f6d2b8', hair: '#b9b9c2', top: '#7b4fb0', pants: '#3a3a4a', hat: null, style: 'bun', scarf: null, pack: null },
  { skin: '#8a5a3c', hair: '#1f1a1a', top: '#d8473f', pants: '#2f3550', hat: 'cap', hatCol: '#2f7fbf', style: 'short', scarf: null, pack: '#3f9a6a' },
  { skin: '#f2c9a8', hair: '#c96a3a', top: '#f2d36b', pants: '#4f6f9f', hat: null, style: 'long', scarf: null, pack: null },
  { skin: '#e8b996', hair: '#3a2a1a', top: '#3f9a6a', pants: '#2a2a33', hat: 'tuque', hatCol: '#2f5a8a', style: 'short', scarf: '#d8473f', pack: null },
  { skin: '#f4d6be', hair: '#141018', top: '#e79cb4', pants: '#f4efe6', hat: null, style: 'bob', scarf: null, pack: '#7fb2d6' },
  { skin: '#c8906a', hair: '#2a1a14', top: '#2f4f46', pants: '#6b4a3a', hat: null, style: 'short', scarf: '#f2b43c', pack: null },
  { skin: '#6a4030', hair: '#0f0c0c', top: '#f2b43c', pants: '#3d3a6f', hat: null, style: 'pony', scarf: null, pack: null },
  { skin: '#f6d2b8', hair: '#5a3a24', top: '#2e5a7a', pants: '#c9b79c', hat: 'cap', hatCol: '#e8e4dc', style: 'short', scarf: null, pack: '#d8473f' },
  { skin: '#f2c9a8', hair: '#e8c070', top: '#9fb6dc', pants: '#2f3550', hat: null, style: 'long', scarf: '#f4efe6', pack: null },
  { skin: '#d9a07a', hair: '#2a1a14', top: '#d8473f', pants: '#2f3550', hat: 'tuque', hatCol: '#f2b43c', style: 'short', scarf: null, pack: '#2f7fbf', scale: 0.74 },
  { skin: '#f6d2b8', hair: '#7a4a2a', top: '#8ec5b8', pants: '#4a4a5a', hat: null, style: 'bob', scarf: '#7b4fb0', pack: null },
  { skin: '#e8b996', hair: '#3a3a3a', top: '#5a4a8f', pants: '#2a2a33', hat: 'tuque', hatCol: '#3f9a6a', style: 'short', scarf: null, pack: null },
];
export class Neighbours {
  constructor(scene, world) {
    this.w = world; this.list = [];
    const R = rng(24);
    const paths = [];
    // sidewalk lines (x fixed, z range) on Saint-Denis, Drolet, Saint-Hubert; plus Mont-Royal and Rachel (z fixed)
    for (const k of [0, 0, 0, -1, 1, 0, 1, -1]) { const s = R() < 0.5 ? -1 : 1, x = nsX(k) + s * (nsHW(k) + nsSW(k) * 0.55); const z0 = -250 + R() * 120, z1 = z0 + 140 + R() * 220; paths.push({ axis: 'z', c: x, a0: z0, a1: Math.min(z1, 265) }); }
    for (const m of [-1, 1]) { const s = R() < 0.5 ? -1 : 1, z = ewZ(m) + s * (ewHW(m) + ewSW(m) * 0.55); paths.push({ axis: 'x', c: z, a0: -120, a1: 120 }); }
    paths.push({ axis: 'wander', rect: PARK, c: 0 }, { axis: 'wander', rect: PLAZA, c: 0 });
    paths.forEach((p, i) => {
      const ch = makeCharacter(LOOKS[i % LOOKS.length]); scene.add(ch.root);
      const HOURS = [[7, 21], [8, 23], [9, 20], [6, 22], [10, 26], [7, 19], [11, 25], [8, 22], [9, 21], [8, 19], [16, 27], [6, 24], [9, 22], [7, 23]];
      const n = { id: i, hours: HOURS[i % HOURS.length], out: true, ch, p, name: LINES[i % LINES.length][0], line: LINES[i % LINES.length][1], s: p.a0 + R() * ((p.a1 || 1) - (p.a0 || 0)), dir: R() < 0.5 ? 1 : -1, speed: 1.05 + R() * 0.35, wait: 0, pos: new THREE.Vector3(), yaw: 0, talk: 0 };
      if (p.axis === 'wander') { const r = p.rect; n.pos.set(r.x0 + 6 + R() * (r.x1 - r.x0 - 12), 0, r.z0 + 6 + R() * (r.z1 - r.z0 - 12)); n.yaw = R() * 6.28; }
      this.list.push(n);
    });
  }
  update(dt, player, ctx = { hour: 12, rain: false }) {
    const C = this.w.colliders;
    for (const n of this.list) {
      const hr = ctx.hour < n.hours[0] ? ctx.hour + 24 : ctx.hour;
      n.out = hr >= n.hours[0] && hr < n.hours[1];
      if (!n.out) { n.ch.root.visible = false; continue; }
      const dp = Math.hypot(n.pos.x - player.pos.x, n.pos.z - player.pos.z);
      let moving = n.wait <= 0 && n.talk <= 0 && dp > 1.6;
      n.wait -= dt; n.talk -= dt;
      if (n.p.axis === 'wander') {
        if (moving) {
          const nx = n.pos.x + Math.sin(n.yaw) * n.speed * dt, nz = n.pos.z + Math.cos(n.yaw) * n.speed * dt, r = n.p.rect;
          if (nx < r.x0 + 2 || nx > r.x1 - 2 || nz < r.z0 + 2 || nz > r.z1 - 2 || C.blocked(nx, nz, 0.3, n.pos.y, 0.3, n.pos.y + 1.5)) { n.yaw += 1.5 + Math.random(); n.wait = 0.6; }
          else { n.pos.x = nx; n.pos.z = nz; n.yaw += (Math.random() - 0.5) * dt * 0.8; }
          if (Math.random() < dt * 0.06) n.wait = 2 + Math.random() * 3;
        }
      } else {
        if (moving) {
          n.s += n.dir * n.speed * dt;
          if (n.s > n.p.a1 || n.s < n.p.a0) { n.dir *= -1; n.wait = 1.5 + Math.random() * 2; }
          const x = n.p.axis === 'z' ? n.p.c : n.s, z = n.p.axis === 'z' ? n.s : n.p.c;
          if (C.blocked(x, z, 0.25, n.pos.y, 0.3, n.pos.y + 1.5) && n.wait <= 0) { n.dir *= -1; n.wait = 0.8; }
          if (Math.random() < dt * 0.04) n.wait = 2 + Math.random() * 3;
        }
        n.pos.x = n.p.axis === 'z' ? n.p.c : n.s; n.pos.z = n.p.axis === 'z' ? n.s : n.p.c;
        if (moving) n.yaw = n.p.axis === 'z' ? (n.dir > 0 ? 0 : Math.PI) : (n.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      }
      n.pos.y = C.ground(n.pos.x, n.pos.z, n.pos.y + 0.5 || 99, 0.1);
      if (!isFinite(n.pos.y)) n.pos.y = h(n.pos.z);
      // face the player while talking or when they come close
      let yaw = n.yaw;
      if (n.talk > 0 || dp < 2.2) { yaw = Math.atan2(player.pos.x - n.pos.x, player.pos.z - n.pos.z); }
      let d = yaw - n.ch.root.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
      n.ch.root.rotation.y += d * (1 - Math.exp(-dt * 6));
      n.ch.root.position.copy(n.pos);
      n.ch.animate(dt, moving ? n.speed : 0, true, n.talk > 0 && !ctx.rain ? Math.min(1, n.talk) : 0, { umbrella: ctx.rain, talk: n.talk > 2.5 });
    }
  }
}

// ================================================================= traffic
function carModel(col) {
  const g = new THREE.Group();
  const body = toon(col), dark = toon('#1e1f24'), glassM = toon('#3d5f86'), chrome = toon('#d9dde2');
  mesh(new THREE.BoxGeometry(1.8, 0.62, 4.3), body, g, 0, 0.62, 0);
  mesh(new THREE.BoxGeometry(1.6, 0.56, 2.3), body, g, 0, 1.2, -0.15);
  mesh(new THREE.BoxGeometry(1.66, 0.42, 2.0), glassM, g, 0, 1.2, -0.15);
  mesh(new THREE.BoxGeometry(1.84, 0.16, 0.2), chrome, g, 0, 0.42, 2.12);
  mesh(new THREE.BoxGeometry(1.84, 0.16, 0.2), chrome, g, 0, 0.42, -2.12);
  const hl = new THREE.MeshToonMaterial({ color: 0xfff6dc, emissive: 0xfff2c8, emissiveIntensity: 0.2, gradientMap: gradient });
  const tl = new THREE.MeshToonMaterial({ color: 0xc8262a, emissive: 0xff2a2a, emissiveIntensity: 0.2, gradientMap: gradient });
  for (const s of [-1, 1]) { mesh(new THREE.BoxGeometry(0.36, 0.16, 0.06), hl, g, s * 0.6, 0.72, 2.16); mesh(new THREE.BoxGeometry(0.34, 0.14, 0.06), tl, g, s * 0.62, 0.72, -2.16); }
  const wg = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 14); wg.rotateZ(Math.PI / 2);
  const wheels = [];
  for (const [x, z] of [[0.82, 1.35], [-0.82, 1.35], [0.82, -1.35], [-0.82, -1.35]]) wheels.push(mesh(wg, dark, g, x, 0.34, z));
  return { g, wheels, hl, tl };
}
export class Traffic {
  constructor(scene, world, glows) {
    this.w = world; this.cars = []; this.glows = glows; this.t = 0;
    const cols = ['#e8e4dc', '#d8473f', '#7fb2d6', '#f2b43c', '#3f7a5a', '#e79cb4', '#5a4a8f', '#2f3a44', '#f07c3c'];
    const lanes = [
      { axis: 'z', c: 1.8, dir: -1, n: 3, k: 0 }, { axis: 'z', c: -1.8, dir: 1, n: 3, k: 0 },
      { axis: 'x', c: ewZ(-1) + 2.0, dir: 1, n: 2, m: -1 }, { axis: 'x', c: ewZ(-1) - 2.0, dir: -1, n: 2, m: -1 },
      { axis: 'x', c: ewZ(1) + 1.8, dir: 1, n: 1, m: 1 }, { axis: 'x', c: ewZ(1) - 1.8, dir: -1, n: 1, m: 1 },
      { axis: 'z', c: nsX(1) + 1.5, dir: -1, n: 2, k: 1, stops: true }, { axis: 'z', c: nsX(-1), dir: 1, n: 1, k: -1, stops: true },
    ];
    let i = 0;
    for (const L of lanes) for (let j = 0; j < L.n; j++) {
      const span = L.axis === 'z' ? [-470, 470] : [-380, 380];
      const m = carModel(cols[i++ % cols.length]); scene.add(m.g);
      const car = { m, L, s: span[0] + (span[1] - span[0]) * (j + Math.random() * 0.5) / L.n, span, v: 8, vmax: L.k === 0 || L.m === -1 ? 11 : 8, stopT: 0, lastStop: null };
      car.gl = [glows.add(0, 0, 0, 1, 0.95, 0.8, 0.5), glows.add(0, 0, 0, 1, 0.95, 0.8, 0.5), glows.add(0, 0, 0, 1, 0.1, 0.05, 0.35), glows.add(0, 0, 0, 1, 0.1, 0.05, 0.35)];
      this.cars.push(car);
    }
    // traffic lights at Saint-Denis × Mont-Royal and × Rachel
    this.mats = { ns: this.lightMats(), ew: this.lightMats() };
    for (const m of [-1, 1]) this.signal(scene, ewZ(m), m);
  }
  lightMats() { return ['#ff3b30', '#ffcc00', '#34d058'].map((c) => new THREE.MeshToonMaterial({ color: c, emissive: c, emissiveIntensity: 0, gradientMap: gradient })); }
  signal(scene, z, m) {
    const pole = toon('#3d4650'), boxM = toon('#2a2e33');
    const heads = [
      { x: nsHW(0) + 0.6, z: z + ewHW(m) + 0.6, ax: 'x', facing: 0, set: 'ns' },
      { x: -nsHW(0) - 0.6, z: z - ewHW(m) - 0.6, ax: 'x', facing: Math.PI, set: 'ns' },
      { x: nsHW(0) + 0.6, z: z - ewHW(m) - 0.6, ax: 'z', facing: -Math.PI / 2, set: 'ew' },
      { x: -nsHW(0) - 0.6, z: z + ewHW(m) + 0.6, ax: 'z', facing: Math.PI / 2, set: 'ew' },
    ];
    for (const hd of heads) {
      const g = new THREE.Group(); const y = h(hd.z) + CURB;
      mesh(new THREE.BoxGeometry(0.16, 6.2, 0.16), pole, g, 0, 3.1, 0);
      const arm = mesh(new THREE.BoxGeometry(0.12, 0.12, 4.6), pole, g, 0, 6.0, -2.3);
      const box = new THREE.Group(); box.position.set(0, 5.4, -4.4); g.add(box);
      mesh(new THREE.BoxGeometry(0.42, 1.25, 0.32), boxM, box, 0, 0, 0);
      this.mats[hd.set].forEach((mat, i) => mesh(new THREE.SphereGeometry(0.12, 12, 8), mat, box, 0, 0.38 - i * 0.38, 0.15, 1, 1, 0.5));
      g.position.set(hd.x, y, hd.z); g.rotation.y = hd.facing + (hd.ax === 'x' ? 0 : 0);
      g.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
      scene.add(g);
      this.w.colliders.add({ x0: hd.x - 0.12, x1: hd.x + 0.12, z0: hd.z - 0.12, z1: hd.z + 0.12, y0: y, y1: y + 6.2 });
    }
  }
  phase() { const p = this.t % 26; return { ns: p < 11 ? 2 : p < 13 ? 1 : 0, ew: p >= 13 && p < 24 ? 2 : p >= 24 ? 1 : 0 }; }   // 2 green 1 yellow 0 red
  update(dt, player, npcs) {
    this.t += dt;
    const ph = this.phase();
    for (const set of ['ns', 'ew']) this.mats[set].forEach((m, i) => { m.emissiveIntensity = (2 - i) === ph[set] ? 2.2 : 0; });
    const night = U.uNight.value;
    for (const car of this.cars) {
      const L = car.L;
      let vT = car.vmax;
      // car ahead in the same lane
      for (const o of this.cars) if (o !== car && o.L === L) { const d = (o.s - car.s) * L.dir; if (d > 0 && d < 10) vT = Math.min(vT, (d - 6) * 1.2); }
      // people in front
      const ahead = (px, pz) => { const along = (L.axis === 'z' ? pz - car.s : px - car.s) * L.dir, lat = Math.abs(L.axis === 'z' ? px - L.c : pz - L.c); return along > 0 && along < 9 && lat < 1.6 ? along : null; };
      const pa = ahead(player.pos.x, player.pos.z); if (pa !== null) vT = Math.min(vT, (pa - 3.5) * 1.5);
      for (const n of npcs) { const a = ahead(n.pos.x, n.pos.z); if (a !== null) vT = Math.min(vT, (a - 3.5) * 1.5); }
      // signals and stop signs at the next crossing
      if (L.axis === 'z') {
        for (const m of [-2, -1, 0, 1, 2]) {
          const stopZ = ewZ(m) - L.dir * (ewHW(m) + ewSW(m) + 1.2);
          const d = (stopZ - car.s) * L.dir;
          if (d < 0 || d > 22) continue;
          if (L.k === 0 && (m === -1 || m === 1) && ph.ns !== 2 && d > 2) vT = Math.min(vT, (d - 0.5) * 0.9);
          if (L.stops && car.lastStop !== m) { vT = Math.min(vT, (d - 0.3) * 0.9); if (d < 1.2 && car.v < 0.4) { car.stopT += dt; if (car.stopT > 1.3) { car.lastStop = m; car.stopT = 0; } } }
        }
      } else if (L.m === -1 || L.m === 1) {
        const stopX = -L.dir * (nsHW(0) + nsSW(0) + 1.2), d = (stopX - car.s) * L.dir;
        if (d > 2 && d < 22 && ph.ew !== 2) vT = Math.min(vT, (d - 0.5) * 0.9);
      }
      vT = Math.max(0, vT);
      const acc = vT > car.v ? 3 : 9;
      const prev = car.v;
      car.v += Math.max(-acc * dt, Math.min(acc * dt, vT - car.v));
      car.s += car.v * dt * L.dir;
      if (car.s > car.span[1]) { car.s = car.span[0]; car.lastStop = null; } if (car.s < car.span[0]) { car.s = car.span[1]; car.lastStop = null; }
      const x = L.axis === 'z' ? L.c : car.s, z = L.axis === 'z' ? car.s : L.c;
      const g = car.m.g;
      g.position.set(x, h(z), z);
      g.rotation.set(0, L.axis === 'z' ? (L.dir > 0 ? 0 : Math.PI) : (L.dir > 0 ? Math.PI / 2 : -Math.PI / 2), 0, 'YXZ');
      if (L.axis === 'z') g.rotation.x = L.dir > 0 ? Math.atan(0.055) : -Math.atan(0.055);
      for (const w of car.m.wheels) w.rotation.x += car.v * dt / 0.34;
      const braking = car.v < prev - 0.01 || car.v < 0.2;
      car.m.hl.emissiveIntensity = 0.2 + night * 2.5; car.m.tl.emissiveIntensity = 0.2 + night * 1.2 + (braking ? 2.2 : 0);
      // light glows (front pair, rear pair)
      const fx = L.axis === 'z' ? 0 : L.dir, fz = L.axis === 'z' ? L.dir : 0, sx = -fz, sz = fx, y = h(z) + 0.72;
      this.glows.set(car.gl[0], x + fx * 2.25 + sx * 0.6, y, z + fz * 2.25 + sz * 0.6); this.glows.set(car.gl[1], x + fx * 2.25 - sx * 0.6, y, z + fz * 2.25 - sz * 0.6);
      this.glows.set(car.gl[2], x - fx * 2.25 + sx * 0.62, y, z - fz * 2.25 + sz * 0.62); this.glows.set(car.gl[3], x - fx * 2.25 - sx * 0.62, y, z - fz * 2.25 - sz * 0.62);
      car.x = x; car.z = z;
    }
    this.glows.g.attributes.iPos.needsUpdate = true;
  }
  // block the player from walking into a car
  blocks(px, pz) {
    for (const c of this.cars) {
      const L = c.L, ex = L.axis === 'z' ? 1.2 : 2.5, ez = L.axis === 'z' ? 2.5 : 1.2;
      if (Math.abs(px - c.x) < ex && Math.abs(pz - c.z) < ez) return true;
    }
    return false;
  }
}

// ================================================================= pigeons on the plaza
export class Pigeons {
  constructor(scene, world) {
    const body = new THREE.SphereGeometry(1, 10, 8); body.scale(0.11, 0.1, 0.17); body.translate(0, 0.14, 0);
    const head = new THREE.SphereGeometry(0.065, 8, 6); head.translate(0, 0.27, 0.13);
    const tail = new THREE.BoxGeometry(0.1, 0.03, 0.12); tail.translate(0, 0.14, -0.2);
    const g = mergeGeometries([body.toNonIndexed(), head.toNonIndexed(), tail.toNonIndexed()]);
    this.mesh = new THREE.InstancedMesh(g, toon('#8a90a8'), 16); this.mesh.castShadow = true; scene.add(this.mesh);
    this.birds = [];
    for (let i = 0; i < 16; i++) { const p = this.home(); this.birds.push({ p, home: p.clone(), yaw: Math.random() * 6.28, fly: 0, v: new THREE.Vector3(), t: Math.random() * 5 }); }
    this.m4 = new THREE.Matrix4(); this.q = new THREE.Quaternion();
  }
  home() { const x = PLAZA.x0 + 3 + Math.random() * 8, z = PLAZA.z1 - 12 - Math.random() * 14; return new THREE.Vector3(x, h(z), z); }
  update(dt, player) {
    let scared = false;
    this.birds.forEach((b, i) => {
      b.t += dt;
      const d = Math.hypot(b.p.x - player.pos.x, b.p.z - player.pos.z);
      if (b.fly <= 0 && d < 2.6 && player.speed > 0.8) { b.fly = 6; b.v.set((b.p.x - player.pos.x) / d * 3 + (Math.random() - 0.5) * 2, 5 + Math.random() * 2, (b.p.z - player.pos.z) / d * 3 + (Math.random() - 0.5) * 2); scared = true; }
      if (b.fly > 0) {
        b.fly -= dt; b.p.addScaledVector(b.v, dt); b.v.y -= 0.6 * dt; b.yaw = Math.atan2(b.v.x, b.v.z);
        if (b.fly <= 0) { b.p.copy(this.home()); }
      } else if (Math.random() < dt * 0.6) { b.yaw += (Math.random() - 0.5) * 2; const nx = b.p.x + Math.sin(b.yaw) * 0.25, nz = b.p.z + Math.cos(b.yaw) * 0.25; if (nx > PLAZA.x0 + 1 && nx < PLAZA.x0 + 14) { b.p.x = nx; b.p.z = nz; b.p.y = h(nz); } }
      const peck = b.fly > 0 ? 0 : Math.max(0, Math.sin(b.t * 3 + i)) * 0.35;
      this.q.setFromEuler(new THREE.Euler(peck, b.yaw, 0));
      this.m4.compose(b.p, this.q, new THREE.Vector3(1, 1, 1)); this.mesh.setMatrixAt(i, this.m4);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
    return scared;
  }
}

// ================================================================= the cat
export function makeCat(scene, x, y, z) {
  const g = new THREE.Group(), fur = toon('#f2a65a'), white = toon('#f8f1e6');
  mesh(new THREE.CapsuleGeometry(0.12, 0.22, 4, 10), fur, g, 0, 0.17, 0).rotation.x = Math.PI / 2;
  mesh(G.sph, fur, g, 0, 0.32, 0.2, 0.11, 0.1, 0.1);
  for (const s of [-1, 1]) { const e = mesh(new THREE.ConeGeometry(0.04, 0.08, 4), fur, g, s * 0.06, 0.42, 0.2); e.rotation.z = -s * 0.2; mesh(G.sph, EYE, g, s * 0.04, 0.33, 0.29, 0.014, 0.02, 0.01); }
  mesh(G.sph, white, g, 0, 0.12, 0.13, 0.08, 0.07, 0.06);
  const tail = mesh(new THREE.CapsuleGeometry(0.025, 0.28, 4, 8), fur, g, 0, 0.3, -0.24); tail.rotation.x = -0.6;
  for (const [a, b] of [[0.07, 0.12], [-0.07, 0.12], [0.07, -0.12], [-0.07, -0.12]]) mesh(G.cyl, fur, g, a, 0.05, b, 0.03, 0.1, 0.03);
  g.position.set(x, y, z); scene.add(g);
  return { g, tail, update(t) { tail.rotation.z = Math.sin(t * 2.2) * 0.4; } };
}

// ================================================================= golden bagels
export class Bagels {
  constructor(scene, spots) {
    this.list = [];
    const tor = new THREE.TorusGeometry(0.26, 0.12, 12, 24);
    const bm = new THREE.MeshToonMaterial({ color: 0xe0a24e, emissive: 0xffb84a, emissiveIntensity: 0.25, gradientMap: gradient });
    const seedG = new THREE.SphereGeometry(0.02, 4, 3); seedG.scale(1, 0.6, 1.6);
    const seedM = toon('#fff6dc');
    const beamM = new THREE.ShaderMaterial({
      uniforms: { uTime: U.uTime }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: 'varying vec2 vUv; varying float vF; void main(){ vUv = uv; vec3 o = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz; vF = smoothstep(4.0, 12.0, distance(o.xz, cameraPosition.xz)); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform float uTime; varying vec2 vUv; varying float vF; void main(){ float a = (1.0 - vUv.y) * (0.35 + 0.15 * sin(uTime * 3.0 + vUv.y * 10.0)) * vF; gl_FragColor = vec4(vec3(1.0, 0.78, 0.35) * a, 1.0); }',
    });
    spots.forEach((s, i) => {
      const g = new THREE.Group();
      const b = mesh(tor, bm, g, 0, 0, 0); b.rotation.x = Math.PI / 2 - 0.35;
      for (let j = 0; j < 14; j++) { const a = j / 14 * Math.PI * 2; const sd = mesh(seedG, seedM, b, Math.cos(a) * 0.26, Math.sin(a) * 0.26, 0.11); sd.rotation.z = a; sd.castShadow = false; }
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.5, 7, 16, 1, true), beamM); beam.position.y = 3.6; beam.layers.set(LAYER_FX); g.add(beam);
      g.position.set(s.x, s.y + 0.85, s.z); scene.add(g);
      this.list.push({ g, b, s, got: false, t: i });
    });
  }
  update(dt, player, onGet) {
    for (const B of this.list) {
      if (B.got) { if (B.g.visible) { B.g.scale.multiplyScalar(1 + dt * 6); B.g.position.y += dt * 3; if (B.g.scale.x > 2.5) B.g.visible = false; } continue; }
      B.t += dt; B.b.rotation.z += dt * 1.8; B.g.position.y = B.s.y + 0.85 + Math.sin(B.t * 2.4) * 0.12;
      const dx = player.pos.x - B.g.position.x, dy = player.pos.y + 0.9 - B.g.position.y, dz = player.pos.z - B.g.position.z;
      if (dx * dx + dy * dy + dz * dz < 1.25) { B.got = true; onGet(B); }
    }
  }
  get count() { return this.list.filter((b) => b.got).length; }
}

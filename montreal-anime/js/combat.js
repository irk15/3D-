// combat.js — the "GTA" layer: knocking people down (cars and bullets), weapons you can draw and shoot,
// health and respawn, cash drops, a kill feed, and player-vs-player over the network.
// It never owns the scene: main.js hands it the pieces it needs and calls update() once per frame.
// Violence is cartoon-style: people get knocked out (stars, K.O.) and get back up; players "wake up" at spawn.
import * as THREE from 'three';
import { h } from './layout.js';
import { LAYER_FX } from './toon.js';

// ---------------------------------------------------------------- weapons
export const WEAPONS = [
  null,
  { id: 'pistol', name: 'Pistol', ic: '🔫', dmg: 26, rate: 0.26, mag: 12, reserve: 96, spread: 0.012, range: 110, auto: false, recoil: 0.012, snd: 1 },
  { id: 'smg', name: 'SMG', ic: '🔫', dmg: 11, rate: 0.085, mag: 30, reserve: 210, spread: 0.032, range: 90, auto: true, recoil: 0.007, snd: 2 },
  { id: 'rifle', name: 'Rifle', ic: '🎯', dmg: 36, rate: 0.15, mag: 20, reserve: 120, spread: 0.01, range: 180, auto: true, recoil: 0.016, snd: 3 },
];
const PED_HP = 60, PED_R = 0.42, PED_H = 1.75, HEAD_Y = 1.42;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const ease = (x) => 1 - (1 - Math.min(1, Math.max(0, x))) ** 3;

// ray vs a vertical cylinder; returns the distance along the ray or Infinity
function rayCyl(o, d, cx, cz, r, y0, y1, maxT) {
  const ox = o.x - cx, oz = o.z - cz, a = d.x * d.x + d.z * d.z;
  if (a < 1e-8) return Infinity;
  const b = ox * d.x + oz * d.z, c = ox * ox + oz * oz - r * r, disc = b * b - a * c;
  if (disc < 0) return Infinity;
  const sq = Math.sqrt(disc); let t = (-b - sq) / a; if (t < 0) t = (-b + sq) / a;
  if (t < 0 || t > maxT) return Infinity;
  const y = o.y + d.y * t; return y >= y0 && y <= y1 ? t : Infinity;
}

// ---------------------------------------------------------------- knocked-down people (shared by neighbours, crowd, cops)
// actor: { ch (character), pos (Vector3 at the feet) }. While actor.rag exists the owner skips its own logic.
export function knock(a, hit) {
  if (!a?.ch || a.rag) return false;
  const root = a.ch.root, sp = Math.hypot(hit.vx, hit.vz) || 1, yaw = root.rotation.y;
  root.rotation.order = 'YXZ';
  const fwd = (hit.vx * Math.sin(yaw) + hit.vz * Math.cos(yaw)) / sp;
  if (a.pos === root.position) a.pos = root.position.clone();
  a.rag = { t: 0, alias: true, vx: hit.vx, vz: hit.vz, vy: hit.up ?? 3, face: fwd > 0 ? 1 : -1, ko: hit.ko ?? 4, phase: 'fly', fromX: hit.fromX ?? a.pos.x - hit.vx, fromZ: hit.fromZ ?? a.pos.z - hit.vz, spin: (Math.random() - 0.5) * 3 };
  return true;
}
// returns true while the actor is down (the caller then skips its normal movement)
export function stepRag(a, dt, C) {
  const g = a.rag; if (!g) return false;
  const root = a.ch.root, pos = a.pos; g.t += dt;
  let tilt = 0;
  if (g.phase === 'fly') {
    g.vy -= 22 * dt;
    const nx = pos.x + g.vx * dt, nz = pos.z + g.vz * dt;
    if (!C.blocked(nx, nz, 0.25, pos.y, 0.35, pos.y + 1.2)) { pos.x = nx; pos.z = nz; } else { g.vx *= -0.2; g.vz *= -0.2; }
    pos.y += g.vy * dt;
    const gr = C.ground(pos.x, pos.z, pos.y + 0.6, 0.1);
    if (pos.y <= gr && g.vy <= 0) { pos.y = gr; g.phase = 'lie'; g.t = 0; g.vx *= 0.3; g.vz *= 0.3; g.landed = true; }
    tilt = g.face * (Math.PI / 2) * ease(g.t / 0.45) + g.spin * Math.sin(Math.min(1, g.t / 0.5) * Math.PI) * 0.6;
    a.ch.animate?.(dt, 0, false, 0, { ko: 2 });
  } else if (g.phase === 'lie') {
    const nx = pos.x + g.vx * dt, nz = pos.z + g.vz * dt;
    if (!C.blocked(nx, nz, 0.25, pos.y, 0.3, pos.y + 1)) { pos.x = nx; pos.z = nz; }
    g.vx *= Math.exp(-dt * 5); g.vz *= Math.exp(-dt * 5);
    pos.y = C.ground(pos.x, pos.z, pos.y + 0.4, 0.1);
    tilt = g.face * (Math.PI / 2);
    if (g.t > g.ko) { g.phase = 'rise'; g.t = 0; }
  } else {
    tilt = g.face * (Math.PI / 2) * (1 - ease(g.t / 0.8));
    if (g.t > 0.8) { const al = g.alias; a.rag = null; root.rotation.x = 0; root.position.copy(pos); if (al) a.pos = root.position; a.ragEnded = true; a.hp = PED_HP; a.flee = 4; a.fleeFrom = { x: g.fromX, z: g.fromZ }; return false; }
  }
  const lie = Math.min(1, Math.abs(tilt) / (Math.PI / 2));
  const yaw = root.rotation.y, hx = Math.sin(yaw) * Math.sign(tilt || 1), hz = Math.cos(yaw) * Math.sign(tilt || 1);
  root.rotation.x = tilt;
  root.position.set(pos.x - hx * 0.8 * lie, pos.y + 0.1 * lie, pos.z - hz * 0.8 * lie);
  if (g.phase !== 'fly') a.ch.animate?.(dt, 0, true, 0, { ko: g.phase === 'lie' ? 1 : 0 });
  return true;
}

// ---------------------------------------------------------------- tracers, muzzle flashes, cash
class Fx {
  constructor(scene, camera) {
    this.cam = camera; this.tr = []; this.fl = []; this.cash = []; this.stars = [];
    const tm = new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    for (let i = 0; i < 28; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 1), tm.clone()); m.visible = false; m.layers.set(LAYER_FX); m.frustumCulled = false; scene.add(m); this.tr.push({ m, t: 0 }); }
    const fm = new THREE.MeshBasicMaterial({ color: 0xffc860, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    for (let i = 0; i < 10; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), fm.clone()); m.visible = false; m.layers.set(LAYER_FX); scene.add(m); this.fl.push({ m, t: 0 }); }
    const bill = new THREE.BoxGeometry(0.34, 0.015, 0.18), bm = new THREE.MeshBasicMaterial({ color: 0x5fcf6e });
    for (let i = 0; i < 24; i++) { const m = new THREE.Mesh(bill, bm); m.visible = false; m.layers.set(LAYER_FX); scene.add(m); this.cash.push({ m, v: 0, t: 0, on: false }); }
    // the dizzy stars that circle a knocked-out head
    const sg = new THREE.OctahedronGeometry(0.07, 0), sm = new THREE.MeshBasicMaterial({ color: 0xffd447 });
    for (let i = 0; i < 18; i++) { const m = new THREE.Mesh(sg, sm); m.visible = false; m.layers.set(LAYER_FX); scene.add(m); this.stars.push({ m, a: null }); }
  }
  tracer(a, b, life = 0.07, w = 1) {
    const o = this.tr.find((x) => x.t <= 0) || this.tr[0]; const len = a.distanceTo(b); if (len < 0.1) return;
    o.m.position.copy(a).add(b).multiplyScalar(0.5); o.m.lookAt(b); o.m.scale.set(w, w, len); o.m.visible = true; o.t = life; o.life = life;
  }
  flash(p, size = 1) {
    const o = this.fl.find((x) => x.t <= 0) || this.fl[0]; o.m.position.copy(p); o.m.scale.setScalar(size * (0.8 + Math.random() * 0.5)); o.m.rotation.z = Math.random() * 6; o.m.lookAt(this.cam.position); o.m.visible = true; o.t = 0.05;
  }
  drop(p, n) {
    for (let i = 0; i < n; i++) { const o = this.cash.find((x) => !x.on); if (!o) return; o.on = true; o.t = 0; o.m.visible = true; o.m.position.set(p.x + (Math.random() - 0.5) * 0.8, p.y + 0.6, p.z + (Math.random() - 0.5) * 0.8); o.v = 3 + Math.random() * 2; o.m.rotation.set(0, Math.random() * 6, 0); }
  }
  update(dt, C, player, onCash) {
    for (const o of this.tr) if (o.t > 0) { o.t -= dt; o.m.material.opacity = Math.max(0, o.t / o.life) * 0.9; if (o.t <= 0) o.m.visible = false; }
    for (const o of this.fl) if (o.t > 0) { o.t -= dt; if (o.t <= 0) o.m.visible = false; else o.m.lookAt(this.cam.position); }
    for (const o of this.cash) {
      if (!o.on) continue; o.t += dt;
      o.v -= 12 * dt; o.m.position.y += o.v * dt; const g = C.ground(o.m.position.x, o.m.position.z, o.m.position.y + 0.3, 0.1) + 0.08;
      if (o.m.position.y < g) { o.m.position.y = g; o.v = 0; }
      o.m.rotation.y += dt * 2.5;
      if (Math.hypot(o.m.position.x - player.pos.x, o.m.position.z - player.pos.z) < 1.5 && Math.abs(o.m.position.y - player.pos.y) < 2 && o.t > 0.5) { o.on = false; o.m.visible = false; onCash(); }
      else if (o.t > 40) { o.on = false; o.m.visible = false; }
    }
  }
  // circling stars over a knocked-out actor's head
  dizzy(a, t) {
    const g = a.rag; const show = g && g.phase === 'lie';
    if (!show) { if (a.stars) { for (const s of a.stars) { s.a = null; s.m.visible = false; } a.stars = null; } return; }
    if (!a.stars) { a.stars = this.stars.filter((s) => !s.a).slice(0, 3); a.stars.forEach((s) => { s.a = a; }); if (a.stars.length < 1) { a.stars = null; return; } }
    const r = a.ch.root, hx = a.pos.x - Math.sin(r.rotation.y) * Math.sign(g.face) * 0, hz = a.pos.z;
    a.stars.forEach((s, i) => { const k = t * 4 + i * 2.1; s.m.visible = true; s.m.position.set(hx + Math.cos(k) * 0.35, a.pos.y + 0.55 + Math.sin(k * 1.7) * 0.05, hz + Math.sin(k) * 0.35); s.m.rotation.y = k; });
  }
}

// ---------------------------------------------------------------- the combat system
export class Combat {
  constructor(o) {
    Object.assign(this, o);   // scene, camera, world, player, getHero, cam, npcs, crowd, traffic, vehicles, props, remotes, net, sfx, puffs, burst, ui
    this.fx = new Fx(this.scene, this.camera);
    this.drawn = false; this.cur = 1; this.ammo = WEAPONS.map((w) => w && { mag: w.mag, res: w.reserve });
    this.nextShot = 0; this.reload = 0; this.trigger = false; this.aimZoom = false; this.hp = 100; this.lastHurt = -99; this.pd = null; this.inv = 0;
    this.kills = 0; this.deaths = 0; this.pvp = true; this.t = 0; this.hitmark = 0; this.cops = null; this.police = null; this._muz = new THREE.Vector3();
    this._o = new THREE.Vector3(); this._d = new THREE.Vector3(); this._p = new THREE.Vector3(); this.shotCount = 0; this.heard = 0;
    this.el = {}; for (const id of ['hpFill', 'weapName', 'ammo', 'xhair', 'hurt', 'wasted', 'wastedTxt', 'feed', 'hitm', 'hud2', 'reloadBar', 'pvpTag']) this.el[id] = document.getElementById(id);
  }
  get armed() { return this.drawn && !this.pd && !this.getCar() && !this.player.flying && !this.player.bike; }
  get weapon() { return WEAPONS[this.cur]; }
  get down() { return !!this.pd; }
  // ---------------------------------------------------------------- input
  key(code) {
    if (code === 'KeyG') { this.toggle(); return true; }
    if (code === 'KeyU' || code === 'Tab') { this.next(); return true; }
    if (code === 'KeyR' && this.drawn) { this.startReload(); return true; }
    if (code === 'KeyK') { this.pvp = !this.pvp; this.ui.floatText?.(this.pvp ? 'PvP on' : 'PvP off'); return true; }
    return false;
  }
  toggle(force) {
    this.drawn = force ?? !this.drawn;
    if (this.drawn && (this.getCar() || this.player.bike)) { this.drawn = false; return; }
    if (this.drawn) { this.sfx.reload?.(0.5); if (this.cam.pitch > 0.35) this.cam.pitch = 0.12; }
    this.ui.setArmed?.(this.drawn); this.refreshHud();
  }
  select(i) { if (!i) { this.toggle(false); return; } this.cur = i; this.reload = 0; this.sfx.reload?.(0.4); if (!this.drawn) this.toggle(true); this.refreshHud(); }
  next(dir = 1) {
    this.cur = ((this.cur - 1 + dir + 3) % 3) + 1; this.reload = 0; this.sfx.reload?.(0.4);
    if (!this.drawn) this.toggle(true); this.refreshHud();
  }
  startReload() {
    const w = this.weapon, a = this.ammo[this.cur]; if (!w || this.reload > 0 || a.mag >= w.mag || a.res <= 0) return;
    this.reload = 1.15; this.sfx.reload?.(1);
  }
  // ---------------------------------------------------------------- hit scan
  targets() {
    const out = [];
    for (const n of this.npcs.list) if (n.out && !n.rag && n.ch.root.visible) out.push({ kind: 'ped', a: n, pos: n.pos });
    for (const p of this.crowd.list) if (!p.rag && p.ch.root.visible) out.push({ kind: 'ped', a: p, pos: p.pos });
    if (this.police) for (const c of this.police.foot) if (!c.rag && !c.gone) out.push({ kind: 'cop', a: c, pos: c.pos });
    if (this.pvp && this.net.peers.size) for (const r of this.remotes.values()) if (r.ch.root.visible && r.pvp !== false && !r.down) out.push({ kind: 'remote', a: r, pos: r.pos });
    return out;
  }
  // first thing along a ray: { t, kind, a, hs }
  trace(o, d, maxT, tg) {
    const C = this.world.colliders; let best = { t: maxT, kind: null };
    for (const x of tg) {
      const t = rayCyl(o, d, x.pos.x, x.pos.z, PED_R, x.pos.y, x.pos.y + PED_H, best.t);
      if (t < best.t) { best = { t, kind: x.kind, a: x.a, hs: o.y + d.y * t > x.pos.y + HEAD_Y }; }
    }
    for (const c of this.traffic.cars) {
      if (c.taken || c.x === undefined || !c.m.g.visible) continue;
      const t = rayCyl(o, d, c.x, c.z, c.kind === 'bus' ? 3 : 1.35, h(c.z), h(c.z) + 1.8, best.t);
      if (t < best.t) best = { t, kind: 'car', a: c };
    }
    const cars = this.police ? [...this.vehicles, ...this.police.cars.map((c) => c.v)] : this.vehicles;
    for (const v of cars) {
      if (v === this.getCar()) continue;
      for (const [cx, cz, r] of v.circles(v.pos.x, v.pos.z, v.yaw)) { const t = rayCyl(o, d, cx, cz, r, v.pos.y, v.pos.y + 1.6, best.t); if (t < best.t) best = { t, kind: v.cop ? 'copcar' : 'car', a: v }; }
    }
    // the world: march in small steps (stops at walls, roofs and the ground)
    const lim = Math.min(best.t, maxT);
    for (let t = 0.6; t < lim; t += 0.4) { if (C.solid(o.x + d.x * t, o.y + d.y * t, o.z + d.z * t)) { if (best.kind === null || t < best.t) best = { t: Math.max(0.6, t - 0.2), kind: 'world' }; break; } }
    return best;
  }
  // direction from the camera that the crosshair points along (with a light aim assist on touch screens)
  aimDir(w, tg) {
    const cam = this.camera, d = this._d.set(0, 0, -1).applyQuaternion(cam.quaternion).normalize();
    if (this.ui.isTouch) {
      let bestA = 0.2, pick = null;
      for (const x of tg) { if (x.kind === 'remote' && !this.pvp) continue; const dx = x.pos.x - cam.position.x, dy = x.pos.y + 1.2 - cam.position.y, dz = x.pos.z - cam.position.z, l = Math.hypot(dx, dy, dz); if (l > w.range || l < 3) continue; const dot = (dx * d.x + dy * d.y + dz * d.z) / l; const ang = Math.acos(Math.min(1, dot)); if (ang < bestA) { bestA = ang; pick = [dx / l, dy / l, dz / l]; } }
      if (pick) d.set(pick[0] * 0.75 + d.x * 0.25, pick[1] * 0.75 + d.y * 0.25, pick[2] * 0.75 + d.z * 0.25).normalize();
    }
    return d;
  }
  muzzle() {
    const hero = this.getHero(), g = hero.guns?.[this.weapon.id], p = this._muz;
    if (g?.userData.muzzle && g.visible) { g.updateWorldMatrix(true, false); g.userData.muzzle.getWorldPosition(p); return p; }
    const r = hero.root.position, y = r.y + 1.3, yaw = hero.root.rotation.y;
    return p.set(r.x + Math.sin(yaw) * 0.7, y, r.z + Math.cos(yaw) * 0.7);
  }
  fire() {
    const w = this.weapon, a = this.ammo[this.cur];
    if (!this.armed || this.t < this.nextShot || this.reload > 0) return;
    if (a.mag <= 0) { this.startReload(); if (a.res <= 0) this.sfx.empty?.(); this.nextShot = this.t + 0.3; return; }
    a.mag--; this.nextShot = this.t + w.rate; this.shotCount++;
    const tg = this.targets(), cam = this.camera, dir = this.aimDir(w, tg);
    const spread = w.spread * (this.aimZoom ? 0.45 : 1) * (this.player.speed > 2 ? 1.8 : 1);
    dir.x += (Math.random() - 0.5) * spread * 2; dir.y += (Math.random() - 0.5) * spread * 2; dir.z += (Math.random() - 0.5) * spread * 2; dir.normalize();
    // 1) where does the crosshair point? (start past the player so the camera's own body never blocks)
    const o1 = this._o.copy(cam.position).addScaledVector(dir, Math.max(1.2, this.cam.cur + 0.3));
    const aimHit = this.trace(o1, dir, w.range, tg), aim = this._p.copy(o1).addScaledVector(dir, aimHit.t);
    // 2) the bullet leaves the muzzle toward that point
    const m = this.muzzle().clone(), bd = aim.clone().sub(m); const L = bd.length(); bd.divideScalar(L || 1);
    const hit = this.trace(m, bd, Math.min(w.range, L + 3), tg), end = m.clone().addScaledVector(bd, hit.t);
    this.fx.tracer(m, end, 0.07); this.fx.flash(m, w.id === 'rifle' ? 1.3 : 1);
    this.sfx.shot?.(w.snd, 1);
    this.cam.shake = Math.max(this.cam.shake || 0, w.id === 'rifle' ? 0.2 : 0.12); this.cam.pitch = Math.max(this.ui.pitchMin(), this.cam.pitch - w.recoil); this.ui.buzz?.(8);
    this.scare(m.x, m.z, 38);
    this.net.send({ t: 'shot', w: this.cur, ox: +m.x.toFixed(2), oy: +m.y.toFixed(2), oz: +m.z.toFixed(2), ex: +end.x.toFixed(2), ey: +end.y.toFixed(2), ez: +end.z.toFixed(2) });
    this.applyHit(hit, end, bd, w);
    this.police?.crime(0.02 * w.dmg / 20, 'shot', this.player.pos);
    if (a.mag <= 0 && a.res > 0) setTimeout(() => this.startReload(), 250);
    this.refreshHud();
  }
  applyHit(hit, end, dir, w) {
    if (hit.kind === 'ped' || hit.kind === 'cop' || hit.kind === 'remote') {
      const dmg = w.dmg * (hit.hs ? 2.5 : 1);
      this.hitmark = hit.hs ? 0.35 : 0.2; this.sfx.hit?.(hit.hs);
      this.puffs.at(end, hit.hs ? 0xffe27a : 0xfff0d0, 5);
      if (hit.kind === 'remote') { this.net.send({ t: 'hit', to: hit.a.id, d: Math.round(dmg), hs: hit.hs ? 1 : 0, vx: +(dir.x * 3).toFixed(2), vz: +(dir.z * 3).toFixed(2) }); return; }
      if (hit.kind === 'cop') { this.police.shootCop(hit.a, dmg, dir); return; }
      this.shootPed(hit.a, dmg, dir, hit.hs);
    } else if (hit.kind === 'car' || hit.kind === 'copcar') {
      this.puffs.at(end, 0xffe0a0, 4); this.sfx.ping?.();
      if (hit.a?.forward) hit.a.dmg = Math.min(1, (hit.a.dmg || 0) + w.dmg / 900);
      if (hit.kind === 'copcar') this.police?.crime(0.5, 'copcar', this.player.pos);
      else if (hit.a.isTrafficCar) { hit.a.bumped?.(dir.x * 6, dir.z * 6); this.police?.crime(0.35, 'car', this.player.pos); }
    } else if (hit.kind === 'world') {
      this.puffs.at(end, 0xd9cdb8, 4); this.puffs.at(end, 0xffd890, 2);
      this.props.push(end.x, end.z, end.y - 0.3, end.y + 0.5, 0.5, dir.x * 6, dir.z * 6, 40);
    }
  }
  shootPed(a, dmg, dir, hs) {
    a.hp = (a.hp ?? PED_HP) - dmg;
    this.scare(a.pos.x, a.pos.z, 30, a);
    if (a.hp <= 0) this.floor(a, dir.x * 3.2, dir.z * 3.2, 2.4, 9, true);
    else { a.ch.gesture?.('shake', 1); a.scare?.(this.player.pos.x, this.player.pos.z); }
  }
  // knock a pedestrian over (from a car or a bullet), with cash and consequences
  floor(a, vx, vz, up, ko, shot) {
    if (!knock(a, { vx, vz, up, ko, fromX: this.player.pos.x, fromZ: this.player.pos.z })) return;
    this.sfx.thud?.(Math.min(1, Math.hypot(vx, vz) / 12 + 0.3));
    this.fx.drop(a.pos, 1 + (Math.random() * 2 | 0));
    this.ui.floatText?.('K.O.!', 'combo');
    this.police?.crime(shot ? 0.9 : 0.55, shot ? 'shot' : 'hit', this.player.pos);
    this.scare(a.pos.x, a.pos.z, 28, a);
  }
  hitByCar(a, vx, vz, speed) {
    if (a.rag) return;
    const f = Math.min(1, speed / 24);
    this.floor(a, vx * 0.85, vz * 0.85, 2.5 + f * 5.5, 3 + f * 6, false);
    this.cam.shake = Math.max(this.cam.shake || 0, 0.3 + f * 0.4); this.ui.buzz?.(30);
  }
  // everybody nearby runs away from the noise
  scare(x, z, r, except) {
    for (const n of this.npcs.list) if (n.out && n !== except && !n.rag && Math.hypot(n.pos.x - x, n.pos.z - z) < r) n.scare?.(x, z);
    for (const p of this.crowd.list) if (p !== except && !p.rag && p.ch.root.visible && Math.hypot(p.pos.x - x, p.pos.z - z) < r) p.scare?.(x, z);
  }
  // ---------------------------------------------------------------- me: health, knockdown, death
  damage(n, by, vx = 0, vz = 0) {
    if (this.pd || this.inv > 0 || n <= 0) return;
    const ab = Math.min(this.armour || 0, n * 0.8); this.armour = (this.armour || 0) - ab; n -= ab;
    this.hp = Math.max(0, this.hp - n); this.lastHurt = this.t; this.hurt = Math.min(1, 0.35 + n / 40); this.sfx.hurt?.();
    this.cam.shake = Math.max(this.cam.shake || 0, 0.25); this.ui.buzz?.(35);
    if (this.hp <= 0) this.die(by, vx, vz); this.refreshHud();
  }
  knockMe(vx, vz, up, ko, by) {
    if (this.pd || this.inv > 0) return;
    const car = this.getCar(); if (car) return;
    const p = this.player, hero = this.getHero(), yaw = hero.root.rotation.y, sp = Math.hypot(vx, vz) || 1;
    this.pd = { t: 0, ko, face: (vx * Math.sin(yaw) + vz * Math.cos(yaw)) / sp > 0 ? 1 : -1, dead: false, by };
    p.vel.set(vx, 0, vz); if (up > 0) { p.vy = up; p.grounded = false; }
    hero.root.rotation.order = 'YXZ'; this.sfx.thud?.(0.8); this.cam.shake = 0.6; this.ui.buzz?.(60);
  }
  die(by, vx, vz) {
    const p = this.player; this.deaths++;
    if (this.getCar()) this.ui.exitCar?.();
    this.drawn = false; this.ui.setArmed?.(false);
    this.pd = { t: 0, ko: 2.4, face: Math.random() < 0.5 ? 1 : -1, dead: true, by }; p.vel.set(vx * 0.5, 0, vz * 0.5); p.vy = 2; p.grounded = false;
    this.getHero().root.rotation.order = 'YXZ'; this.sfx.thud?.(1);
    if (this.el.wasted) { this.el.wastedTxt.textContent = 'wasted'; this.el.wasted.className = 'show'; } document.body.classList.add('dead'); this.sfx.wasted?.();
    if (by && by !== 'cop' && by !== 'self') this.net.send({ t: 'kill', vic: this.net.id, by });
    this.ui.updateMoney?.();
  }
  respawn() {
    const lose = Math.min(this.ui.getMoney?.() || 0, Math.round((this.ui.getMoney?.() || 0) * 0.1 + 5)); this.ui.addMoney?.(-lose);
    this.hp = 100; this.armour = 0; this.pd = null; this.inv = 2.5; this.police?.clear(); document.body.classList.remove('dead');
    for (const k of [1, 2, 3]) { this.ammo[k].mag = WEAPONS[k].mag; this.ammo[k].res = WEAPONS[k].reserve; }
    const hero = this.getHero(); hero.root.rotation.x = 0;
    this.ui.respawn?.(); if (this.el.wasted) this.el.wasted.className = '';
    this.ui.floatText?.(lose ? `-$${lose}` : 'Back on your feet');
    this.refreshHud();
  }
  // after Player.update: apply the lying-down pose to the hero
  afterPlayer(dt) {
    const hero = this.getHero(), root = hero.root, p = this.player;
    if (!this.pd) { p.ko = 0; if (root.rotation.x !== 0 && !p.flying && !p.bike) root.rotation.x = 0; return; }
    const d = this.pd; d.t += dt; p.ko = d.t < d.ko ? (d.t < 0.45 ? 2 : 1) : 0;
    let tilt;
    if (d.t < d.ko || d.dead) tilt = d.face * (Math.PI / 2) * ease(d.t / 0.4);
    else tilt = d.face * (Math.PI / 2) * (1 - ease((d.t - d.ko) / 0.7));
    const lie = Math.min(1, Math.abs(tilt) / (Math.PI / 2)), yaw = root.rotation.y, s = Math.sign(tilt || 1);
    root.rotation.x = tilt; root.position.x -= Math.sin(yaw) * s * 0.8 * lie; root.position.z -= Math.cos(yaw) * s * 0.8 * lie; root.position.y += 0.1 * lie;
    if (d.dead && d.t > d.ko + 1.4 && this.el.wasted) this.respawn();
    else if (!d.dead && d.t > d.ko + 0.7) { this.pd = null; root.rotation.x = 0; }
    this.fx.dizzy({ ch: hero, pos: p.pos, rag: d.t < d.ko && !d.dead && d.t > 0.6 ? { phase: 'lie', face: d.face } : null, stars: this._meStars }, this.t);
  }
  lockInput(inp) { if (this.pd) { inp.x = inp.y = 0; inp.jump = false; inp.dash = false; inp.fly = false; inp.jumpHeld = false; inp.run = false; } }
  // ---------------------------------------------------------------- per-frame
  update(dt, t) {
    this.t = t; this.inv = Math.max(0, this.inv - dt); this.heard = Math.max(0, this.heard - dt);
    if (this.getCar() && this.drawn) this.toggle(false);
    if (this.player.flying && this.drawn) { /* keep it drawn, the pose is just hidden while flying */ }
    if (this.reload > 0) { this.reload -= dt; if (this.reload <= 0) { const w = this.weapon, a = this.ammo[this.cur], n = Math.min(w.mag - a.mag, a.res); a.mag += n; a.res -= n; this.refreshHud(); } }
    if (this.trigger && this.armed) { const w = this.weapon; if (w.auto || !this._held) this.fire(); this._held = true; } else this._held = false;
    if (!this.pd && this.hp < 100 && t - this.lastHurt > 6) { this.hp = Math.min(100, this.hp + dt * 8); this.dirtyHp = true; }
    this.hurt = Math.max(0, (this.hurt || 0) - dt * 1.4); this.hitmark = Math.max(0, this.hitmark - dt);
    this.fx.update(dt, this.world.colliders, this.player, () => { const v = 5 + (Math.random() * 20 | 0); this.ui.addMoney?.(v); this.sfx.collect?.(1.3); this.ui.floatText?.(`+$${v}`, 'money'); });
    // dizzy stars over every downed pedestrian near us
    for (const n of this.npcs.list) if (n.rag || n.stars) this.fx.dizzy(n, t);
    for (const p of this.crowd.list) if (p.rag || p.stars) this.fx.dizzy(p, t);
    this.hud(dt);
  }
  refreshHud() {
    const e = this.el, w = this.weapon, a = this.ammo[this.cur];
    if (e.weapName) { e.weapName.textContent = `${w.ic} ${w.name}`; e.ammo.innerHTML = this.reload > 0 ? '<small>reloading…</small>' : `${a.res} <small>${a.mag}</small>`; }
    this.dirtyHp = true;
  }
  hud(dt) {
    const e = this.el; if (!e.hud2) return;
    const show = this.armed;
    document.body.classList.toggle('armed', show); e.xhair.classList.toggle('show', show); e.xhair.classList.toggle('hit', this.hitmark > 0);
    if (e.hitm) e.hitm.style.opacity = this.hitmark > 0 ? Math.min(1, this.hitmark * 5) : 0;
    if (this.dirtyHp || (this.hpShown | 0) !== (this.hp | 0)) { this.hpShown = this.hp; this.dirtyHp = false; e.hpFill.style.width = this.hp + '%'; e.hpFill.classList.toggle('low', this.hp < 30); const af = document.getElementById('arFill'); if (af) af.style.width = (this.armour || 0) + '%'; }
    e.hurt.style.opacity = Math.min(0.9, (this.hurt || 0) + (this.hp < 30 ? 0.25 + Math.sin(this.t * 6) * 0.1 : 0));
    e.weapName.parentElement.classList.toggle('show', this.drawn);
    if (this.reload > 0 && e.reloadBar) { e.reloadBar.style.width = (1 - this.reload / 1.15) * 100 + '%'; e.reloadBar.parentElement.style.opacity = 1; } else if (e.reloadBar) e.reloadBar.parentElement.style.opacity = 0;
    if (this.reload > 0 || this._lastAmmo !== this.ammo[this.cur].mag) { this._lastAmmo = this.ammo[this.cur].mag; this.refreshHud(); }
    if (e.pvpTag) e.pvpTag.textContent = this.pvp ? '⚔ PvP on' : '🕊 PvP off';
  }
  feed(text, color = '#fff') {
    const f = this.el.feed; if (!f) return; const d = document.createElement('div'); d.textContent = text; d.style.borderColor = color; f.appendChild(d);
    setTimeout(() => d.classList.add('out'), 4200); setTimeout(() => d.remove(), 4800); while (f.children.length > 4) f.firstChild.remove();
  }
  // ---------------------------------------------------------------- network
  // what to add to the periodic state message
  stateFields() {
    const o = { gw: this.armed ? this.cur : 0, hp: Math.round(this.hp), pv: this.pvp ? 1 : 0 };
    if (this.armed) o.ap = +this.aimPitch().toFixed(2);
    if (this.pd) { const hero = this.getHero(); o.tl = +hero.root.rotation.x.toFixed(2); }
    return o;
  }
  aimPitch() { return Math.max(-0.7, Math.min(0.7, -(this.cam.pitch) * 0.9 + 0.06)); }
  bind(net) {
    net.on('shot', (m, p) => {
      const r = this.remotes.get(p.id); if (!r || typeof m.ox !== 'number') return;
      const a = new THREE.Vector3(m.ox, m.oy, m.oz), b = new THREE.Vector3(m.ex, m.ey, m.ez);
      this.fx.tracer(a, b, 0.08); this.fx.flash(a, 1);
      const d = a.distanceTo(this.camera.position); this.sfx.shot?.(WEAPONS[m.w | 0]?.snd || 1, Math.max(0.1, 1 - d / 120));
      this.puffs.at(b, 0xffe0a0, 2); this.scare(a.x, a.z, 25);
    });
    net.on('hit', (m, p) => {
      if (m.to !== net.id || !this.pvp) return;
      const r = this.remotes.get(p.id); if (r && r.pvp === false) return;
      this.damage(Math.min(100, m.d | 0), p.id, m.vx || 0, m.vz || 0); this.lastBy = p.id;
      if (m.car && !this.pd && this.hp > 0) this.knockMe(m.vx || 0, m.vz || 0, 3, 3.2, p.id);
    });
    net.on('kill', (m, p) => {
      const v = m.vic === net.id ? 'You' : this.nameOf(m.vic), by = m.by === net.id ? 'You' : this.nameOf(m.by);
      this.feed(`${by} took out ${v}`, m.by === net.id ? '#f2a93b' : '#e4402b');
      if (m.by === net.id) { this.kills++; this.ui.addMoney?.(100); this.ui.floatText?.('+$100 · Take-down!', 'money'); this.sfx.collect?.(1.4); }
    });
  }
  nameOf(id) { for (const [k, r] of this.remotes) if (k === id) return r.tag?.querySelector('b')?.textContent || 'Player'; return 'Player'; }
  // a friend's car hit someone: the driver reports hits on remote players
  carHitRemote(r, vx, vz, speed) {
    if (!this.pvp || r.pvp === false || r.hitT > this.t) return;
    r.hitT = this.t + 1.2;
    this.net.send({ t: 'hit', to: r.id, d: Math.round(Math.min(60, speed * 2.2)), hs: 0, vx: +vx.toFixed(2), vz: +vz.toFixed(2), car: 1 });
    this.hitmark = 0.25; this.sfx.hit?.(false);
  }
}

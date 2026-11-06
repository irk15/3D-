// police.js — the wanted level. Crimes (knocking people down, shooting, hitting police) add heat; heat is
// shown as stars; cop cars and officers on foot chase you until you lose them, get busted (caught) or
// take a knock-out. Everything is cartoon-style: busted costs a little cash, wasted respawns you.
import * as THREE from 'three';
import { Vehicle } from './vehicle.js';
import { makeCharacter } from './actors.js';
import { nsX, ewZ, WALK, inWalk, h } from './layout.js';
import { knock, stepRag, unstuck } from './combat.js';

const STAR_AT = [0.6, 1.8, 4, 7, 11];     // heat needed for 1…5 stars
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export class Police {
  constructor(o) {
    Object.assign(this, o);   // scene, world, player, getHero, getCar, combat, sfx, ui
    this.heat = 0; this.stars = 0; this.cars = []; this.foot = []; this.calm = 0; this.t = 0; this.bust = 0; this.sirenT = 0; this.last = new THREE.Vector3();
    this.el = { stars: document.getElementById('stars'), cops: document.getElementById('cops') };
    if (this.el.stars) this.el.stars.innerHTML = '<i>★</i>'.repeat(5);
    this.carVs = [];
    const M = (c) => new THREE.MeshBasicMaterial({ color: c });
    this.lightGeo = new THREE.BoxGeometry(0.5, 0.14, 0.34); this.red = M(0xff2a2a); this.blue = M(0x2a5bff); this.dark = M(0x1a1a28);
  }
  get wanted() { return this.stars > 0; }
  marks(t) {
    const out = [], on = Math.sin(t * 10) > 0;
    for (const c of this.cars) out.push({ x: c.v.pos.x, z: c.v.pos.z, c: on ? '#ff3030' : '#3060ff', r: 11, s: '#000' });
    for (const c of this.foot) if (!c.gone) out.push({ x: c.pos.x, z: c.pos.z, c: '#ff5050', r: 6, s: '#000' });
    return out;
  }
  crime(amount, kind, pos) {
    if (this.combat.down) return;
    const before = this.stars; this.heat += amount; this.calm = 0; if (pos) this.last.copy(pos);
    this.refresh();
    if (this.stars > before) { this.sfx.star?.(this.stars); this.ui.floatText?.('★'.repeat(this.stars) + ' Wanted!', 'combo'); }
  }
  refresh() {
    let s = 0; for (let i = 0; i < 5; i++) if (this.heat >= STAR_AT[i]) s = i + 1;
    this.heat = Math.min(this.heat, 14); this.stars = s;
    const e = this.el.stars; if (e) { [...e.children].forEach((c, i) => c.classList.toggle('on', i < s)); e.classList.toggle('flash', this.nearCop(40) && s > 0); }
    const c = this.el.cops; if (c) { c.classList.toggle('show', s > 0); c.textContent = this.nearCop(55) ? '🚨 Cops are chasing you!' : 'Lose the cops…'; }
  }
  nearCop(r) {
    const p = this.player.pos; let best = false;
    for (const c of this.cars) if (Math.hypot(c.v.pos.x - p.x, c.v.pos.z - p.z) < r) best = true;
    for (const c of this.foot) if (!c.gone && Math.hypot(c.pos.x - p.x, c.pos.z - p.z) < r) best = true;
    return best;
  }
  clear() {
    this.heat = 0; this.stars = 0; this.bust = 0; this.refresh();
    for (const c of this.cars) { c.leaving = true; }
    for (const c of this.foot) c.leaving = true;
  }
  // ---------------------------------------------------------------- spawning
  spawnCar() {
    const p = this.player.pos, C = this.world.colliders;
    for (let tries = 0; tries < 8; tries++) {
      const ns = Math.random() < 0.5; let x, z, yaw;
      if (ns) { const k = Math.round(p.x / 90) + ((Math.random() * 3 | 0) - 1); x = nsX(Math.abs(p.x) > 1500 ? k : Math.max(-2, Math.min(2, k))); z = p.z + (Math.random() < 0.5 ? -1 : 1) * (95 + Math.random() * 60); yaw = Math.atan2(0, p.z - z); }
      else { const m = Math.round((p.z + 160) / 110 - 1) + ((Math.random() * 3 | 0) - 1); z = ewZ(Math.abs(p.x) > 1500 ? Math.max(-4, Math.min(3, m)) : Math.max(-1, Math.min(2, m))); x = p.x + (Math.random() < 0.5 ? -1 : 1) * (95 + Math.random() * 60); yaw = Math.atan2(p.x - x, 0); }
      if (!inWalk(x - 5, z - 5) || !inWalk(x + 5, z + 5)) continue;
      const y = C.ground(x, z, 99, 0.2); if (!isFinite(y) || C.blocked(x, z, 2.2, y, 0.5, y + 1.6)) continue;
      const v = new Vehicle(this.scene, this.world, 'sedan', '#2a3558', x, z, yaw); v.cop = true; v.driver = { cop: true };
      const S = v.S, g = v.m.g;
      const l1 = new THREE.Mesh(this.lightGeo, this.red), l2 = new THREE.Mesh(this.lightGeo, this.blue);
      l1.position.set(-0.26, S.roof + 0.1, 0.2); l2.position.set(0.26, S.roof + 0.1, 0.2); g.add(l1, l2);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(S.W + 0.02, 0.22, S.L * 0.5), new THREE.MeshBasicMaterial({ color: 0xf4f4f8 })); stripe.position.set(0, S.y0 + 0.3, 0); g.add(stripe);
      const c = { v, l1, l2, stuck: 0, rev: 0, drop: 0, flash: Math.random(), leaving: false };
      this.cars.push(c); this.carVs.push(v); return c;
    }
    return null;
  }
  spawnFoot(x, z) {
    const C = this.world.colliders, y = C.ground(x, z, 99, 0.2); if (!isFinite(y)) return;
    const ch = makeCharacter({ model: 'soldier', top: '#2a3558', pants: '#1d2542', scale: 1 }); this.scene.add(ch.root);
    ch.root.rotation.order = 'YXZ';
    const c = { ch, pos: new THREE.Vector3(x, y, z), hp: 100, shootT: 1 + Math.random(), yaw: 0, gone: false, id: 'cop' + this.foot.length };
    ch.root.position.copy(c.pos); this.foot.push(c); return c;
  }
  // ---------------------------------------------------------------- combat with cops
  shootCop(c, dmg, dir) {
    c.hp -= dmg; this.crime(0.9, 'cop', this.player.pos);
    if (c.hp <= 0 && !c.rag) { knock(c, { vx: dir.x * 3.5, vz: dir.z * 3.5, up: 2.8, ko: 6, fromX: this.player.pos.x, fromZ: this.player.pos.z }); c.dead = true; this.sfx.thud?.(0.7); this.combat.fx.drop(c.pos, 3); this.crime(1.2, 'cop', this.player.pos); }
  }
  // ---------------------------------------------------------------- per frame
  update(dt, t) {
    this.t = t; const p = this.player.pos, car = this.getCar(), C = this.world.colliders;
    const down = this.combat.down;
    // heat cools down when nobody is close
    if (this.stars) {
      this.calm = this.nearCop(75) ? 0 : this.calm + dt;
      if (this.calm > 6) { this.heat -= dt * (0.6 + this.stars * 0.2); this.refresh(); if (this.heat <= 0) this.clear(); }
    }
    // cop cars: keep the right number around
    const wantCars = this.stars ? Math.min(4, 1 + this.stars) : 0, wantFoot = this.stars >= 2 ? this.stars : 0;
    let alive = this.cars.filter((c) => !c.leaving && !c.v.wreck).length;
    if (!down && alive < wantCars && this.t - (this._sp || 0) > 3.5) { this._sp = this.t; if (this.spawnCar()) this.sfx.copSiren?.(0.6); }
    // cop cars drive at you
    const inp = { x: 0, y: 0, jumpHeld: false };
    for (const c of this.cars) {
      const v = c.v, dx = p.x - v.pos.x, dz = p.z - v.pos.z, d = Math.hypot(dx, dz);
      if (v.wreck) { v.update(dt, null, this.vctx()); c.wreckT = (c.wreckT || 0) + dt; if (c.wreckT > 30) c.gone = true; continue; }
      if (c.leaving || down) { // cruise away and vanish when far
        inp.x = 0; inp.y = c.leaving ? 0.4 : 0; v.update(dt, inp, this.vctx()); if (d > 170 || (c.leaving && !c.gone && (c.leaveT = (c.leaveT || 0) + dt) > 12)) c.gone = true;
      } else {
        const want = Math.atan2(dx, dz); let diff = wrapA(want - v.yaw);
        if (c.rev > 0) { c.rev -= dt; inp.x = Math.sign(diff) * 0.9; inp.y = -1; }
        else {
          inp.x = -Math.max(-1, Math.min(1, diff * 1.8)); inp.y = Math.abs(diff) > 1.3 ? 0.35 : d > 14 ? 1 : d > 6 ? 0.6 : 0.2;
          if (v.speed < 1.2 && d > 7) { c.stuck += dt; if (c.stuck > 1.1) { c.rev = 1.1; c.stuck = 0; } } else c.stuck = 0;
        }
        inp.jumpHeld = false; v.update(dt, inp, this.vctx());
        // officer steps out when the car has arrived
        if (d < 16 && v.speed < 5 && this.stars >= 2 && this.foot.filter((f) => !f.gone && !f.leaving).length < wantFoot && t - c.drop > 6) { c.drop = t; const dd = v.doorPos(); this.spawnFoot(dd.x, dd.z); }
      }
      if (!car && !down && v.speed > 4 && Math.abs(p.y - v.pos.y) < 1.8) for (const [cx, cz, cr] of v.circles(v.pos.x, v.pos.z, v.yaw)) if ((p.x - cx) ** 2 + (p.z - cz) ** 2 < (cr + 0.45) ** 2) { const f = v.forward(); this.combat.knockMe(f.x * v.vF * 0.8, f.z * v.vF * 0.8, 4, 2.4, 'cop'); this.combat.damage(18, 'cop', f.x * v.vF * 0.5, f.z * v.vF * 0.5); break; }
      c.flash += dt * 7; const on = Math.sin(c.flash) > 0; c.l1.material = on ? this.red : this.dark; c.l2.material = on ? this.dark : this.blue;
      v.m.lod?.(d);
    }
    for (let i = this.cars.length - 1; i >= 0; i--) if (this.cars[i].gone) { const c = this.cars[i]; this.scene.remove(c.v.m.g); this.carVs.splice(this.carVs.indexOf(c.v), 1); this.cars.splice(i, 1); }
    // siren
    this.sirenT -= dt; if (this.stars && this.sirenT <= 0 && this.cars.length) { const d = Math.min(...this.cars.map((c) => Math.hypot(c.v.pos.x - p.x, c.v.pos.z - p.z))); if (d < 140) { this.sfx.copSiren?.(Math.max(0.15, 1 - d / 140)); this.sirenT = 1.7; } }
    // officers on foot
    let touching = 0;
    for (const c of this.foot) {
      if (c.rag) { if (!stepRag(c, dt, C)) { c.rag = null; } if (c.dead && !c.rag) { c.gone = true; } else if (c.rag) { this.combat.fx.dizzy(c, t); continue; } }
      if (c.gone) continue;
      const dx = p.x - c.pos.x, dz = p.z - c.pos.z, d = Math.hypot(dx, dz);
      if (c.leaving || down || !this.stars) { if (d > 80 || (c.leaveT = (c.leaveT || 0) + dt) > 10) { c.gone = true; continue; } c.ch.animate(dt, 0, true, 0, {}); continue; }
      const yaw = Math.atan2(dx, dz); c.yaw += wrapA(yaw - c.yaw) * (1 - Math.exp(-dt * 8)); c.ch.root.rotation.y = c.yaw;
      let sp = 0; const armed = d < 28 && this.stars >= 3;
      if (d > 1.6) { sp = d > 12 ? 4.6 : 3.4; const nx = c.pos.x + Math.sin(yaw) * sp * dt, nz = c.pos.z + Math.cos(yaw) * sp * dt;
        if (!C.blocked(nx, nz, 0.3, c.pos.y, 0.4, c.pos.y + 1.5)) { c.pos.x = nx; c.pos.z = nz; } else if (!C.blocked(nx, c.pos.z, 0.3, c.pos.y, 0.4, c.pos.y + 1.5)) c.pos.x = nx; else if (!C.blocked(c.pos.x, nz, 0.3, c.pos.y, 0.4, c.pos.y + 1.5)) c.pos.z = nz;
        c.pos.y = C.ground(c.pos.x, c.pos.z, c.pos.y + 0.6, 0.1); }
      else if (!car && Math.abs(p.y - c.pos.y) < 2) touching++;
      unstuck(C, c.pos, dt);
      c.ch.root.position.copy(c.pos);
      // shooting at you (level 3+)
      if (armed && !down) { c.shootT -= dt; if (c.shootT <= 0) { c.shootT = 0.8 + Math.random() * 0.8; const m = new THREE.Vector3(c.pos.x + Math.sin(yaw) * 0.6, c.pos.y + 1.3, c.pos.z + Math.cos(yaw) * 0.6), tgt = new THREE.Vector3(p.x + (Math.random() - 0.5) * 1.2, p.y + 1.0, p.z + (Math.random() - 0.5) * 1.2);
          this.combat.fx.tracer(m, tgt, 0.08); this.combat.fx.flash(m, 0.9); this.sfx.shot?.(1, Math.max(0.15, 1 - d / 60));
          if (Math.random() < 0.45) this.combat.damage(4 + this.stars * 1.5, 'cop', dx / (d || 1) * 2, dz / (d || 1) * 2); } }
      c.ch.animate(dt, sp, true, 0, { gun: this.stars >= 2 ? 'pistol' : null, raise: armed && d < 22, aimPitch: 0 });
    }
    for (let i = this.foot.length - 1; i >= 0; i--) if (this.foot[i].gone) { this.scene.remove(this.foot[i].ch.root); this.foot.splice(i, 1); }
    // busted: an officer holding you while you're not getting away
    const slow = car ? car.speed < 2.5 : this.player.speed < 2.2;
    const carNear = car && this.cars.some((c) => !c.leaving && Math.hypot(c.v.pos.x - p.x, c.v.pos.z - p.z) < 5.5);
    if (this.stars && !down && slow && (touching || carNear)) { this.bust += dt; if (this.bust > 2.2) this.busted(); } else this.bust = Math.max(0, this.bust - dt * 1.5);
    this.last.copy(p);
  }
  vctx() { return this.mkctx ? this.mkctx() : { vehicles: [], traffic: null, props: null, peds: null, night: 0, clock: '' }; }
  busted() {
    this.bust = 0;
    const lose = Math.round((this.ui.getMoney?.() || 0) * 0.1);
    this.ui.addMoney?.(-lose); this.sfx.wasted?.();
    const w = document.getElementById('wastedTxt'), el = document.getElementById('wasted');
    if (w && el) { w.textContent = 'busted'; el.className = 'show busted'; document.body.classList.add('dead'); setTimeout(() => { el.className = ''; document.body.classList.remove('dead'); setTimeout(() => { w.textContent = 'wasted'; }, 700); }, 2200); }
    this.combat.hp = 100;
    if (this.getCar()) this.ui.exitCar?.();
    this.clear(); this.ui.respawn?.(); this.ui.floatText?.(lose ? `-$${lose} fine` : 'Busted!');
  }
}

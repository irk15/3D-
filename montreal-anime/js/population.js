// population.js — GTA-style ambient pedestrians: a recycled pool of walkers that always fills the
// sidewalks around the player, in every city. They walk the sidewalk grid at their own pace, turn at
// corners, step around each other, react to cars, guns and explosions (they can be knocked down like
// anyone else), and quietly respawn out of sight when you leave them behind.
import * as THREE from 'three';
import { h, CURB, nsX, ewZ, nsHW, ewHW, nsSW, ewSW, nsIdx, ewIdx, inWalk } from './layout.js';
import { makeCharacter } from './actors.js';
import { stepRag, unstuck } from './combat.js';

const TOPS = ['#2f8f8a', '#d8473f', '#f2b43c', '#5a4a8f', '#3c6fb4', '#e79cb4', '#2f3a44', '#f4efe6', '#7a9e4a', '#c46a2f', '#1f1f24', '#8a8f99'];
const PANTS = ['#2b2550', '#3a3a4a', '#2f3550', '#4f6f9f', '#5b4636', '#1d1d22', '#6b6b70'];
const TINTS = ['#f6d2b8', '#e8b48e', '#c68863', '#8d5a3c', '#f1c9a5', '#5c3a26'];
const pick = (a) => a[(Math.random() * a.length) | 0];

export class Walkers {
  constructor(scene, world, n) {
    this.w = world; this.list = []; this.fr = 0; this.scene = scene;
    for (let i = 0; i < n; i++) {
      const ch = makeCharacter({ model: i % 3 === 0 ? 'bot_lo' : 'michelle_lo', top: pick(TOPS), pants: pick(PANTS), tint: pick(TINTS), scale: 0.9 + Math.random() * 0.18 });
      ch.root.visible = false; scene.add(ch.root);
      const p = { ch, pos: new THREE.Vector3(0, -999, 0), id: i, live: false, axis: 'z', dir: 1, c: 0, speed: 1.2, yaw: 0, adt: 0, vs: 0, hp: 60, phone: Math.random() < 0.2 };
      p.scare = (x, z) => { if (p.rag) return; if (!(p.flee > 0) && Math.random() < 0.35) p.cower = 1.2 + Math.random() * 1.8; p.flee = 6 + Math.random() * 3; p.fleeFrom = { x, z }; p.handsT = 0; this.onScream?.(p); };
      p.dodge = (sx, sz) => { if (p.dodgeT > 0) return; p.dodgeT = 0.45; p.dv = new THREE.Vector3(sx, 0, sz).multiplyScalar(5); ch.gesture?.('shake', 1.4); };
      this.list.push(p);
    }
  }
  // a random sidewalk spot in a ring around (x,z), not in front of the camera if possible
  spawn(p, px, pz, camYaw, rMin, rMax) {
    const C = this.w.colliders;
    for (let t = 0; t < 14; t++) {
      const a = Math.random() * Math.PI * 2, rr = rMin + Math.random() * (rMax - rMin);
      let x = px + Math.sin(a) * rr, z = pz + Math.cos(a) * rr;
      // snap to the nearest sidewalk line of the grid
      const k = nsIdx(x), m = ewIdx(z), dx = x - nsX(k), dz = z - ewZ(m);
      if (Math.abs(dx) - nsHW(k) < Math.abs(dz) - ewHW(m)) { const s = Math.sign(dx) || 1; x = nsX(k) + s * (nsHW(k) + nsSW(k) * 0.5); p.axis = 'z'; p.c = x; }
      else { const s = Math.sign(dz) || 1; z = ewZ(m) + s * (ewHW(m) + ewSW(m) * 0.5); p.axis = 'x'; p.c = z; }
      if (!inWalk(x, z)) continue;
      const y = C.ground(x, z, h(z) + 1.2, 0.1), lift = y - h(z);
      if (lift < 0.05 || lift > 0.6 || C.blocked(x, z, 0.3, y, 0.3, y + 1.6)) continue;   // must be on a raised sidewalk, in the open
      // prefer spots behind the camera so nobody pops in where you're looking
      const vx = x - px, vz = z - pz, fwd = -(Math.sin(camYaw) * vx + Math.cos(camYaw) * vz) / (Math.hypot(vx, vz) || 1);
      if (fwd > 0.5 && t < 10 && rMin > 30) continue;
      p.pos.set(x, y, z); p.dir = Math.random() < 0.5 ? 1 : -1; p.speed = 1.05 + Math.random() * 0.45; p.live = true; p.hp = 60; p.flee = 0; p.rag = null; p.turnCD = 2;
      p.yaw = p.axis === 'z' ? (p.dir > 0 ? 0 : Math.PI) : (p.dir > 0 ? Math.PI / 2 : -Math.PI / 2); p.ch.root.rotation.set(0, p.yaw, 0); p.ch.root.position.copy(p.pos); p.ch.root.visible = true;
      return true;
    }
    p.live = false; p.ch.root.visible = false; return false;
  }
  update(dt, player, camera, camYaw) {
    this.fr++; const C = this.w.colliders, px = player.pos.x, pz = player.pos.z;
    let spawned = 0;
    for (const p of this.list) {
      const d = Math.hypot(p.pos.x - px, p.pos.z - pz);
      if (!p.live || (d > 150 && !p.rag)) { if (spawned < 2) { spawned++; this.spawn(p, px, pz, camYaw, p.live ? 70 : 20, p.live ? 130 : 110); } else { p.ch.root.visible = false; p.live = false; } continue; }
      if (p.rag) { if (stepRag(p, dt, C)) { p.ch.root.visible = true; continue; } }
      if (p.ragEnded) { p.ragEnded = false; if (p.axis === 'z') p.c = p.pos.x; else p.c = p.pos.z; }
      if (this.fr % 4 === p.id % 4 && unstuck(C, p.pos, dt * 4)) { p.c = p.axis === 'z' ? p.pos.x : p.pos.z; }
      const px0 = p.pos.x, pz0 = p.pos.z;
      p.turnCD -= dt;
      // someone's aiming at them: freeze with hands up; held too long, they bolt
      if (p.aimedT > 0 && performance.now() - (p.aimedAt || 0) < 250) { p.handsT = 0.6; if (p.aimedT > 3.5 && !(p.flee > 0)) { p.scare(px, pz); p.aimedT = 0; } } else p.aimedT = 0;
      p.handsT = Math.max(0, (p.handsT || 0) - dt);
      if (p.cower > 0) { p.cower -= dt; }
      else if (p.handsT > 0 && !(p.flee > 0)) { p.yaw = Math.atan2(px - p.pos.x, pz - p.pos.z); }
      else if (p.dodgeT > 0) { p.dodgeT -= dt; const nx = p.pos.x + p.dv.x * dt, nz = p.pos.z + p.dv.z * dt; if (!C.blocked(nx, nz, 0.3, p.pos.y, 0.45, p.pos.y + 1.5)) { p.pos.x = nx; p.pos.z = nz; } }
      else if (p.flee > 0) {
        p.flee -= dt;
        let fx = p.pos.x - p.fleeFrom.x, fz = p.pos.z - p.fleeFrom.z; const fl = Math.hypot(fx, fz) || 1; fx /= fl; fz /= fl;
        const nx = p.pos.x + fx * 4.6 * dt, nz = p.pos.z + fz * 4.6 * dt;
        if (!C.blocked(nx, nz, 0.3, p.pos.y, 0.45, p.pos.y + 1.5) && inWalk(nx, nz)) { p.pos.x = nx; p.pos.z = nz; } else p.fleeFrom = { x: p.pos.x - fz * 3, z: p.pos.z + fx * 3 };
        if (p.flee <= 0) { if (Math.abs(fx) > Math.abs(fz)) { p.axis = 'x'; p.dir = Math.sign(fx); p.c = p.pos.z; } else { p.axis = 'z'; p.dir = Math.sign(fz); p.c = p.pos.x; } }
      } else {
        // walk the sidewalk line; step around obstacles; cross at corners like real people
        const sx = p.axis === 'x' ? p.dir : 0, sz = p.axis === 'z' ? p.dir : 0, lx = -sz, lz = sx;   // forward and left
        p.side = (p.side || 0) * (p.sideT > 0 ? 1 : Math.exp(-dt * 0.8)); p.sideT = (p.sideT || 0) - dt;
        const cx2 = p.axis === 'z' ? p.c + lx * p.side : null, cz2 = p.axis === 'x' ? p.c + lz * p.side : null;
        let nx = p.pos.x + sx * p.speed * dt, nz = p.pos.z + sz * p.speed * dt;
        if (p.axis === 'z') nx += (cx2 - p.pos.x) * Math.min(1, dt * 2); else nz += (cz2 - p.pos.z) * Math.min(1, dt * 2);
        // personal space: other walkers and you
        let wait = false;
        const avoid = (ox, oz, r) => { const dx = ox - nx, dz = oz - nz, ahead = dx * sx + dz * sz, lat = dx * lx + dz * lz; if (ahead > -0.2 && ahead < r + 0.8 && Math.abs(lat) < 0.7) { if (p.sideT <= 0) { p.side += lat > 0 ? -0.9 : 0.9; p.side = Math.max(-1.3, Math.min(1.3, p.side)); p.sideT = 1.2; } if (ahead < r) wait = true; } };
        for (const o of this.list) if (o !== p && o.live) avoid(o.pos.x, o.pos.z, 0.6);
        avoid(px, pz, 0.8);
        const C2 = (x, z) => C.blocked(x, z, 0.3, p.pos.y, 0.45, p.pos.y + 1.5) || (this.carBlock && this.carBlock(x, z));
        const lift = C.ground(nx, nz, p.pos.y + 0.5, 0.1) - h(nz);
        if (p.crossing) { p.crossT -= dt; if (lift > 0.05 || p.crossT < 0) p.crossing = false; }
        if (!p.crossing && (C2(nx, nz) || !inWalk(nx, nz))) {
          // something in the way (a pole, a tree, a bin): step around it, else turn back
          const free = [0.9, -0.9].find((o) => !C2(nx + lx * o, nz + lz * o));
          if (free !== undefined && p.sideT <= 0) { p.side += free; p.side = Math.max(-1.4, Math.min(1.4, p.side)); p.sideT = 1.5; }
          else if (free === undefined) { p.dir *= -1; p.turnCD = 1.5; }
        } else if (!p.crossing && lift < 0.05) {
          // the kerb at a corner: cross the street if no car is coming, turn the corner, or head back
          const r2 = Math.random();
          if (r2 < 0.45 && !this.carNear?.(nx, nz, 14)) { p.crossing = true; p.crossT = 10; p.pos.x = nx; p.pos.z = nz; }
          else if (r2 < 0.8 && p.turnCD <= 0) { p.turnCD = 3; if (p.axis === 'z') { p.axis = 'x'; p.c = p.pos.z; p.dir = Math.random() < 0.5 ? 1 : -1; } else { p.axis = 'z'; p.c = p.pos.x; p.dir = Math.random() < 0.5 ? 1 : -1; } p.side = 0; }
          else { p.dir *= -1; p.turnCD = 1.5; }
        } else if (!wait) { p.pos.x = nx; p.pos.z = nz; }
      }
      p.pos.y += (C.ground(p.pos.x, p.pos.z, p.pos.y + 0.5, 0.1) - p.pos.y) * Math.min(1, dt * 12);
      // legs and facing come from what they actually did
      const mvx = (p.pos.x - px0) / Math.max(dt, 1e-3), mvz = (p.pos.z - pz0) / Math.max(dt, 1e-3), ms = Math.min(7, Math.hypot(mvx, mvz));
      p.vs += (ms - p.vs) * (1 - Math.exp(-dt * 10));
      if (ms > 0.3 && !(p.handsT > 0)) p.yaw = Math.atan2(mvx, mvz);
      let dy = p.yaw - p.ch.root.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); p.ch.root.rotation.y += dy * (1 - Math.exp(-dt * 7));
      p.ch.root.position.copy(p.pos);
      // animation LOD + only draw what's near
      const vis = d < 125; p.ch.root.visible = vis; p.adt += dt;
      if (!vis) { p.adt = 0; continue; }
      const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw), behind = (p.pos.x - camera.position.x) * fx + (p.pos.z - camera.position.z) * fz < -4;
      if (behind) { p.adt = Math.min(p.adt, 0.5); continue; }   // out of view: skip the skeleton
      const every = d > 55 ? 4 : d > 22 ? 2 : 1;
      if ((this.fr + p.id) % every === 0) { p.ch.animate(p.adt, p.vs < 0.2 ? 0 : p.vs, true, 0, { phone: p.phone && p.vs < 2 && !(p.flee > 0) && !(p.handsT > 0), handsUp: p.handsT > 0, cower: p.cower > 0 }); p.adt = 0; }
    }
  }
  // move everybody near a new place (after travelling)
  reset(px, pz, camYaw) { for (const p of this.list) { p.rag = null; p.ch.root.rotation.x = 0; this.spawn(p, px, pz, camYaw, 8, 110); } }
}

// Rendering-free race simulation: track constraints, laps, contact, drafting. Shared by the game and tests.
import { step } from './physics.js';
import { WALL } from './tracks.js';

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

export function placeOnGrid(r, track, slot, lanes = 2) {
  const { P, L, T, N } = track;
  const row = Math.floor(slot / lanes), col = slot % lanes;
  const i = (N - 6 - row * 7) % N;
  const off = lanes === 2 ? (col ? -3.6 : 3.6) : (col - (lanes - 1) / 2) * 4.2;
  const p = P[i], l = L[i], t = T[i];
  const s = r.st;
  s.x = p.x + l.x * off; s.z = p.z + l.z * off; s.y = p.y;
  s.h = Math.atan2(t.x, t.z);
  s.vx = s.vz = s.r = s.u = s.v = 0; s.ax = s.ay = 0; s.lean = 0; s.gear = 1; s.crashT = 0; s.dr = null; s.driftArm = 0;
  r.idx = i; r.lap = 0; r.half = true; r.progress = i - N; r.finished = false; r.finishTime = 0;
  r.bestLap = Infinity; r.lapStartT = 0; r.lapTimes = []; r.nitro = 1; r.wallHits = 0;
}

export function resetToTrack(r, track, keepSpeed = 0) {
  const { P, T } = track;
  r.idx = track.nearestGlobal(r.st.x, r.st.z);
  const p = P[r.idx], t = T[r.idx], s = r.st;
  s.x = p.x; s.z = p.z; s.y = p.y; s.h = Math.atan2(t.x, t.z);
  s.vx = t.x * keepSpeed; s.vz = t.z * keepSpeed; s.r = 0; s.lean = 0; s.crashT = 0; s.dr = null; s.driftArm = 0;
}

// advance one racer through physics + track constraints. Returns an event code (0 none, 1 wall hit, 2 crash).
export function advance(r, track, inp, dt, hooks) {
  const s = r.st;
  if (s.crashT > 0) { s.crashT -= dt; if (s.crashT <= 0) { resetToTrack(r, track, 12); hooks?.onRespawn?.(r); } }
  step(s, r.p, inp, dt);
  let ev = 0;
  const { P, L, T, N } = track;
  const prev = r.idx;
  r.idx = track.nearest(s.x, s.z, r.idx, 40);
  const p = P[r.idx], l = L[r.idx];
  const d = (s.x - p.x) * l.x + (s.z - p.z) * l.z;
  const lim = WALL - r.sz.x * (r.p.bike ? 0.4 : 0.52);
  if (Math.abs(d) > lim) {
    const sg = Math.sign(d);
    s.x -= l.x * sg * (Math.abs(d) - lim);
    s.z -= l.z * sg * (Math.abs(d) - lim);
    const vn = (s.vx * l.x + s.vz * l.z) * sg;
    if (vn > 0) {
      s.vx -= l.x * sg * vn * 1.3; s.vz -= l.z * sg * vn * 1.3;
      s.vx *= 0.99; s.vz *= 0.99;
      // align the nose with the wall a little, kill spin
      const t = T[r.idx], th = Math.atan2(t.x, t.z);
      const dir = Math.cos(th - s.h) >= 0 ? th : th + Math.PI;
      s.h += Math.atan2(Math.sin(dir - s.h), Math.cos(dir - s.h)) * Math.min(1, vn * 0.03);
      s.r *= 0.6;
      if (s.dr && vn > 4) { s.dr = null; s.driftArm = 0; }
      r.lastImpact = vn;
      if (vn > 2) { ev = 1; r.wallHits++; }
      if (r.p.bike && s.crashT <= 0 && vn > 7 * r.p.H.crash) { s.crashT = 2; ev = 2; }
    }
  }
  if (r.p.bike && !r.p.ai && s.crashT <= 0 && s.overGrip > 0.3 && r.p.H.id === 'sim') { s.crashT = 2; ev = 2; }
  s.y = track.heightAt(r.idx, s.x, s.z);
  // laps (half-way checkpoint stops cutting back over the line)
  if (r.idx > N * 0.4 && r.idx < N * 0.6) r.half = true;
  if (prev > N * 0.8 && r.idx < N * 0.2) {
    if (r.half) { r.lap++; r.half = false; hooks?.onLap?.(r); }
  } else if (prev < N * 0.2 && r.idx > N * 0.8) { r.lap--; r.half = true; }
  r.progress = r.lap * N + r.idx - N;
  return ev;
}

// circle-pair contact between two racers (both simulated locally). Returns impact speed.
export function contact(a, b, kinematicB = false) {
  let hit = 0;
  const A = a.st, B = b.st;
  if (Math.abs(A.y - B.y) > 3) return 0;
  for (const sa of [-1, 1]) for (const sb of [-1, 1]) {
    const ka = a.sz.z * 0.27, kb = b.sz.z * 0.27;
    const ax = A.x + Math.sin(A.h) * sa * ka, az = A.z + Math.cos(A.h) * sa * ka;
    const bx = B.x + Math.sin(B.h) * sb * kb, bz = B.z + Math.cos(B.h) * sb * kb;
    const dx = bx - ax, dz = bz - az, d = Math.hypot(dx, dz);
    const min = (a.sz.x + b.sz.x) * 0.5;
    if (d > 0.001 && d < min) {
      const nx = dx / d, nz = dz / d, push = min - d;
      const wa = kinematicB ? 1 : b.p.m / (a.p.m + b.p.m), wb = 1 - wa;
      A.x -= nx * push * wa; A.z -= nz * push * wa;
      if (!kinematicB) { B.x += nx * push * wb; B.z += nz * push * wb; }
      const rel = (B.vx - A.vx) * nx + (B.vz - A.vz) * nz;
      if (rel < 0) {
        const imp = -rel * 0.85;
        A.vx -= nx * imp * wa; A.vz -= nz * imp * wa;
        if (!kinematicB) { B.vx += nx * imp * wb; B.vz += nz * imp * wb; }
        A.r *= 0.85; if (!kinematicB) B.r *= 0.85;
        hit = Math.max(hit, -rel);
      }
    }
  }
  return hit;
}

// slipstream: 0..1 when tucked in behind another racer
export function draftFactor(r, others) {
  const s = r.st, sh = Math.sin(s.h), ch = Math.cos(s.h);
  if (s.u < 20) return 0;
  let best = 0;
  for (const o of others) {
    if (o === r || o.ghost) continue;
    const dx = o.st.x - s.x, dz = o.st.z - s.z;
    const fwd = dx * sh + dz * ch, side = dx * ch - dz * sh;
    if (fwd > 3 && fwd < 32 && Math.abs(side) < 2.4) best = Math.max(best, 1 - (fwd - 3) / 29);
  }
  return clamp(best, 0, 1);
}

export function standings(racers) {
  return [...racers].filter((r) => !r.ghost).sort((a, b) => {
    if (a.finished && b.finished) return a.finishTime - b.finishTime;
    if (a.finished) return -1;
    if (b.finished) return 1;
    return b.progress - a.progress;
  });
}

// AI driver: pure-pursuit steering + speed profile braking. Drives through the same physics as players.
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const G = 9.81;

export const DIFFICULTY = {
  easy: { label: 'Easy', skill: 0.8, rubber: 0.14, mistakes: 0.6 },
  normal: { label: 'Normal', skill: 0.9, rubber: 0.08, mistakes: 0.3 },
  hard: { label: 'Hard', skill: 0.97, rubber: 0.04, mistakes: 0.1 },
  insane: { label: 'Insane', skill: 1.02, rubber: 0.02, mistakes: 0 }
};

export function makeBrain(seed, diff = 'normal') {
  const d = DIFFICULTY[diff] || DIFFICULTY.normal;
  const rnd = mulberry(seed);
  return { d, lane: (rnd() - 0.5) * 8, phase: rnd() * 6, skill: d.skill * (0.97 + rnd() * 0.05), rnd, nitroCool: 0, wobble: 0 };
}

export function mulberry(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// racer: { st, p, idx, brain, progress }, others: racers, leadProgress: for rubber band
export function aiInput(racer, track, others, time, leadProgress, dt, cruise = false) {
  const { st: s, p, brain: b } = racer;
  const { P, L, T, VP, N, SEG, KA, signK } = track;
  const u = Math.max(s.u, 0);
  const i = racer.idx;
  // rubber band toward the leading human
  const gap = (leadProgress - racer.progress) * SEG;
  const rubber = cruise ? 0.6 : clamp(1 + (gap / 400) * b.d.rubber * 4, 1 - b.d.rubber, 1 + b.d.rubber);
  // racing line: drift to the inside of upcoming corners
  const ahead = (i + Math.round(((p.bike ? 14 : 10) + u * (p.bike ? 0.62 : 0.55)) / SEG)) % N;
  const inside = -signK[(i + 25) % N] * clamp(KA[i] * 220, 0, 4.5);
  let lane = clamp(b.lane * 0.6 + inside + Math.sin(time * 0.13 + b.phase) * 1.2, -6, 6);
  // overtaking / avoidance
  const sh = Math.sin(s.h), ch = Math.cos(s.h);
  for (const o of others) {
    if (o === racer || o.ghost) continue;
    const dx = o.st.x - s.x, dz = o.st.z - s.z;
    const fwd = dx * sh + dz * ch;
    if (fwd < -2 || fwd > 22) continue;
    const side = dx * ch - dz * sh; // + = left
    if (Math.abs(side) < 3) lane += side > 0 ? -3.2 : 3.2;
  }
  lane = clamp(lane, -6.2, 6.2);
  const tp = P[ahead], tl = L[ahead];
  const tx = tp.x + tl.x * lane, tz = tp.z + tl.z * lane;
  const dx = tx - s.x, dz = tz - s.z;
  const ld = Math.hypot(dx, dz);
  const alpha = wrap(Math.atan2(dx, dz) - s.h); // + = target to the left
  const kappa = (2 * Math.sin(alpha)) / Math.max(ld, 4);
  let steer;
  if (p.bike) {
    const lean = Math.atan((kappa * u * u) / G);
    const leanMax = Math.min(p.leanMax, Math.atan(p.mu)) * clamp((u - 2) / 12, 0.12, 1);
    steer = clamp(-lean / Math.max(leanMax, 0.05) * 1.1, -1, 1);
    if (u < 6) steer = clamp(-alpha * 2, -1, 1);
  } else {
    const delta = Math.atan(kappa * p.wb) * 1.15;
    const lim = p.steerMax / (1 + u * p.H.steerSens * (p.H.grip ? 0.8 : 1));
    steer = clamp(-delta / lim, -1, 1);
    // damp oversteer slides
    steer += clamp(s.beta * 1.4, -0.5, 0.5);
  }
  // mistakes on easier levels
  if (b.d.mistakes && b.rnd() < 0.0015 * b.d.mistakes) b.wobble = 0.6 + b.rnd() * 0.6;
  if (b.wobble > 0) { b.wobble -= dt; steer += Math.sin(time * 9) * 0.25; }
  // speed: look at the speed profile a little ahead (reaction + braking)
  const look = (i + Math.round((u * 0.35 + 4) / SEG)) % N;
  const gripG = p.mu * G * b.skill * (p.bike ? 0.74 : 0.86 * (p.H.grip || 1)) * rubber;
  let vt = Math.min(VP[look], VP[i]) * Math.sqrt(gripG);
  if (cruise) vt = Math.min(vt, 30);
  vt = Math.min(vt, p.vmax * 1.2);
  let gas = u < vt - 0.5 ? 1 : u < vt + 1 ? 0.35 : 0;
  // ease off when the rear steps out (power oversteer)
  if (!p.bike) gas *= clamp(1 - (Math.abs(s.beta) - 0.05) * 7, 0.15, 1);
  const brake = u > vt + 1.8 ? clamp((u - vt) / 8, 0.25, 1) : 0;
  // nitro on straights
  b.nitroCool -= dt;
  const nitro = !cruise && KA[i] < 0.003 && u > 25 && u < vt - 5 && b.nitroCool < 0 && racer.nitro > 0.25;
  if (nitro && racer.nitro < 0.3) b.nitroCool = 4;
  return { steer, gas, brake, hand: false, nitro, up: false, down: false };
}

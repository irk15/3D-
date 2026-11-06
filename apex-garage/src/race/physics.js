// Vehicle dynamics for cars (bicycle model with tyre curves, weight transfer, friction circle)
// and bikes (lean-steer model with wheelie/stoppie limits). Units: metres, seconds, newtons, kg.
const G = 9.81;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;

export const HANDLING = {
  arcade: { id: 'arcade', label: 'Arcade', grip: 1.32, yawK: 9, slide: 0.55, mu: 1.2, tcs: true, abs: true, esc: 0.5, steerAssist: 0.75, drift: 0.85, steerSens: 0.05, crash: 2.2 },
  sport: { id: 'sport', label: 'Sport', grip: 1.16, yawK: 7, slide: 0.8, mu: 1.06, tcs: true, abs: true, esc: 0.4, steerAssist: 0.4, drift: 0.4, steerSens: 0.038, crash: 1.4 },
  sim: { id: 'sim', label: 'Simulation', mu: 1.0, tcs: false, abs: false, esc: 0, steerAssist: 0.1, drift: 0, steerSens: 0.026, crash: 1 }
};

export function createParams(cfg, stats, { handling = 'sport', wet = false, auto = true, ai = false } = {}) {
  const H = { ...(HANDLING[handling] || HANDLING.sport) };
  if (ai) { H.esc = Math.max(H.esc, 0.35); H.tcs = true; H.abs = true; H.steerAssist = Math.max(H.steerAssist, 0.4); }
  const bike = cfg.type === 'bike';
  const m = stats.weight + (bike ? 80 : 75);
  const wb = bike ? 1.44 : cfg.length * 0.59;
  const frontShare = bike ? 0.5 : cfg.id === 'challenger' ? 0.56 : cfg.drive === 'awd' ? 0.44 : 0.42;
  const b = wb * frontShare, a = wb - b; // a: CG→front axle, b: CG→rear axle
  const h = bike ? 0.62 : cfg.id === 'challenger' ? 0.52 : 0.45;
  const mu = H.mu * (wet ? 0.78 : 1) * (0.9 + 0.12 * stats.handling) * (bike && H.grip ? 1 + (H.grip - 1) * 0.9 : 1);
  const vmax = stats.top / 3.6;
  const P = stats.hp * 745.7;
  const crr = 0.012 * m * G;
  const cd = Math.max(0.05, (P * 0.97 / vmax - crr) / (vmax * vmax));
  const down = bike ? 0 : (m * G * (cfg.id === 'concept' || cfg.id === 'ferrari' ? 0.55 : 0.35)) / (vmax * vmax);
  const nGears = bike ? 6 : cfg.id === 'porsche' || cfg.id === 'challenger' ? 8 : 7;
  const v1 = vmax * (bike ? 0.34 : 0.29), vt = vmax * 1.03;
  const gearV = [];
  for (let g = 0; g < nGears; g++) gearV.push(v1 * Math.pow(vt / v1, Math.pow(g / (nGears - 1), 0.85)));
  const alphaPeak = bike ? 0.1 : 0.115;
  const p = {
    cfg, bike, H, ai, m, wb, a, b, h, mu, vmax, P, cd, crr, down, gearV, nGears, auto,
    I: m * (a * a + b * b) * 0.95,
    B: 2.35 / alphaPeak, C: 1.35,
    steerMax: 0.62,
    leanMax: 0.98, leanRate: 2.6, leanK: 7,
    redline: cfg.engine.redline, idle: cfg.engine.idle,
    shiftTime: bike ? 0.05 : cfg.id === 'challenger' ? 0.2 : 0.09,
    drive: cfg.drive === 'awd' ? [0.38, 0.62] : [0, 1],
    wheelieA: bike ? G * (b + 0.05) / h : 99,
    stoppieA: bike ? G * (a + 0.1) / h : 99,
    kPow: 1, kLong: 1
  };
  calibrate(p, stats.zero100);
  return p;
}

export function newState() {
  return { x: 0, y: 0, z: 0, h: 0, vx: 0, vz: 0, r: 0, u: 0, v: 0, ax: 0, ay: 0, delta: 0, steer: 0, lean: 0, wheelie: 0, pitch: 0,
    gear: 1, rpm: 900, shiftT: 0, revT: 0, limiter: false, beta: 0, slip: 0, spin: 0, lock: false, draft: 0, boostT: 0,
    nitroOn: false, crashT: 0, events: 0, upLatch: false, downLatch: false, wheelRot: 0, throttle: 0 };
}

// straight-line launch test so the 0-100 time in the game matches the car's stat sheet
function calibrate(p, target) {
  const run = () => {
    const s = newState();
    const inp = { steer: 0, gas: 1, brake: 0, hand: false, nitro: false };
    let t = 0;
    while (s.u < 27.78 && t < 15) { step(s, p, inp, 1 / 120); t += 1 / 120; }
    return t;
  };
  const search = (key, lo, hi) => {
    for (let i = 0; i < 14; i++) { p[key] = (lo + hi) / 2; if (run() > target) lo = p[key]; else hi = p[key]; }
    p[key] = (lo + hi) / 2;
  };
  p.kLong = 1; p.kPow = 1;
  if (run() > target) {
    search('kLong', 0.8, 1.9);
    if (run() > target * 1.02) { p.kLong = 1.9; search('kPow', 1, 2.6); }
  } else search('kLong', 0.5, 1);
}

export function step(s, p, inp, dt) {
  if (p.bike) stepBike(s, p, inp, dt); else if (p.H.grip) stepGrip(s, p, inp, dt); else stepCar(s, p, inp, dt);
  s.x += s.vx * dt;
  s.z += s.vz * dt;
}

function gearbox(s, p, inp, dt, u) {
  if (s.shiftT > 0) s.shiftT -= dt;
  const shift = (d) => { s.gear += d; s.shiftT = p.shiftTime; s.events |= d > 0 ? 1 : 2; };
  // reverse: hold brake when stopped
  if (s.gear === -1) { if (inp.gas > 0.1) s.gear = 1; return; }
  if (inp.brake > 0.5 && !inp.gas && u < 0.4) { s.revT += dt; if (s.revT > 0.35) { s.gear = -1; s.revT = 0; } return; }
  s.revT = 0;
  const rpmIn = (g) => (Math.abs(u) / p.gearV[g - 1]) * p.redline;
  if (p.auto) {
    if (s.shiftT <= 0 && s.gear < p.nGears && rpmIn(s.gear) > p.redline * 0.965 && inp.gas > 0.2) shift(1);
    else if (s.shiftT <= 0 && s.gear > 1) {
      const lower = rpmIn(s.gear - 1);
      if (lower < p.redline * 0.8 && (inp.brake > 0.15 || rpmIn(s.gear) < p.redline * 0.45)) shift(-1);
    }
    if (s.gear > 1 && Math.abs(u) < 2) s.gear = 1;
  } else {
    if (inp.up && !s.upLatch && s.gear < p.nGears) shift(1);
    if (inp.down && !s.downLatch && s.gear > 1 && rpmIn(s.gear - 1) < p.redline * 1.03) shift(-1);
    s.upLatch = !!inp.up; s.downLatch = !!inp.down;
  }
}

// engine force at the wheels (before traction limits)
function engine(s, p, inp, u, dt) {
  const au = Math.abs(u);
  let throttle = inp.gas;
  if (s.gear === -1) {
    s.rpm = lerp(s.rpm, p.idle + au * 220, 0.2);
    return au < 14 ? -p.m * 3.2 * inp.gas : 0;
  }
  const gv = p.gearV[s.gear - 1];
  const rpmWheel = (au / gv) * p.redline;
  const slipRpm = throttle > 0 ? p.redline * 0.55 : p.idle;
  let rpm = au < gv * 0.5 ? Math.max(rpmWheel, lerp(p.idle, slipRpm, throttle)) : Math.max(rpmWheel, p.idle);
  s.limiter = rpm >= p.redline;
  if (s.limiter) { rpm = p.redline * (0.97 + Math.random() * 0.03); throttle *= 0.15; }
  s.rpm = lerp(s.rpm, rpm, 1 - Math.exp(-30 * dt));
  if (s.shiftT > 0) throttle = 0;
  const f = clamp(rpm / p.redline, 0.18, 1);
  let Pe = p.P * p.kPow * f * (2 - f) * throttle;
  if (s.nitroOn) Pe *= 1.55;
  if (s.boostT > 0) Pe *= 1.25;
  const vEff = Math.max(au, (rpm / p.redline) * gv);
  s.throttle = throttle;
  return Pe / Math.max(vEff, 1);
}

function stepCar(s, p, inp, dt) {
  const H = p.H;
  const sh = Math.sin(s.h), ch = Math.cos(s.h);
  let u = s.vx * sh + s.vz * ch;
  let v = s.vx * ch - s.vz * sh;
  let r = s.r;
  gearbox(s, p, inp, dt, u);
  const beta = Math.atan2(v, Math.max(Math.abs(u), 1.5));
  // drift mode: armed by the handbrake, released once the car straightens up
  if (inp.hand && Math.abs(u) > 8) s.driftArm = 1;
  else if (Math.abs(beta) < 0.09) s.driftArm = Math.max(0, (s.driftArm || 0) - dt * 2.5);
  const armed = H.drift > 0 && (s.driftArm || 0) > 0.3 && Math.abs(u) > 7;
  s.drifting = armed;
  if (armed) {
    if (!s.dr) s.dr = { side: Math.sign(r || -s.steer || 1), b: Math.abs(beta), lowK: 0, noGas: 0 };
    if (driftStep(s, p, inp, dt, u, v)) return;
  } else s.dr = null;
  // steering: speed sensitive + counter-steer assist
  const steerLim = p.steerMax / (1 + Math.abs(u) * H.steerSens);
  let delta = -s.steer * steerLim;
  if (Math.abs(u) > 4 && !inp.hand) delta += H.steerAssist * (armed ? 0.35 : 1) * clamp(beta, -0.6, 0.6) * 0.75 * Math.sign(u);
  delta = clamp(delta, -p.steerMax, p.steerMax);
  s.delta = delta;

  let Fdrive = engine(s, p, inp, u, dt);
  // ESC: compare yaw rate with what a neutral car would do
  let escM = 0;
  if (H.esc > 0 && Math.abs(u) > 5) {
    const rRef = (u * delta) / (p.wb * (1 + 0.0012 * u * u));
    const err = r - rRef;
    const intent = armed || inp.hand ? 0 : 1;
    if (Math.abs(beta) > 0.05) { escM = -H.esc * intent * err * p.I * 9; Fdrive *= 1 - clamp(H.esc * Math.abs(err) * 1.5, 0, 0.7); }
  }
  // loads
  const Fdown = p.down * u * u;
  let Fzf = (p.m * G * p.b) / p.wb - (p.m * s.ax * p.h) / p.wb + Fdown * 0.45;
  let Fzr = (p.m * G * p.a) / p.wb + (p.m * s.ax * p.h) / p.wb + Fdown * 0.55;
  Fzf = Math.max(Fzf, p.m * G * 0.12); Fzr = Math.max(Fzr, p.m * G * 0.12);
  const muF = p.mu * Fzf, muR = p.mu * Fzr * 1.1; // wider rear tyres
  // longitudinal per axle
  let dF = Fdrive * p.drive[0], dR = Fdrive * p.drive[1];
  const limF = muF * p.kLong, limR = muR * p.kLong;
  let spin = 0;
  // traction control keeps room in the friction circle for cornering force
  const tcsOn = H.tcs && !armed;
  const useR = tcsOn ? Math.sqrt(Math.max(0.06, 1 - (s.useR || 0) ** 2)) * 0.96 : 1;
  const useF = tcsOn ? Math.sqrt(Math.max(0.06, 1 - (s.useF || 0) ** 2)) * 0.96 : 1;
  if (dR > limR * useR) { spin = (dR - limR) / limR; dR = tcsOn ? limR * useR : limR * 0.9; }
  if (dF > limF * useF) { spin = Math.max(spin, (dF - limF) / limF); dF = tcsOn ? limF * useF : limF * 0.9; }
  if (tcsOn) spin = Math.min(spin, 0.05);
  s.spin = spin;
  const sgn = u > 0.05 ? 1 : u < -0.05 ? -1 : 0;
  let bF = 0, bR = 0, lockF = false;
  if (inp.brake > 0 && s.gear !== -1) {
    const want = inp.brake * p.m * G * p.mu * 1.05;
    bF = Math.min(want * 0.64, muF * (H.abs ? 0.95 : 1));
    bR = Math.min(want * 0.36, muR * (H.abs ? 0.95 : 1));
    if (!H.abs && inp.brake > 0.85 && Math.abs(u) > 4) lockF = true;
  }
  let rearLat = 1;
  if (inp.hand) { bR += muR * 0.45; rearLat = 0.3; }
  const Fxf = dF - bF * sgn, Fxr = dR - bR * sgn;
  // lateral (tyre curve, friction circle)
  const uu = Math.max(Math.abs(u), 2.5);
  const af = Math.atan2(v + p.a * r, uu) - delta * (sgn || 1);
  const ar = Math.atan2(v - p.b * r, uu);
  let Dyf = Math.sqrt(Math.max(0, muF * muF - Fxf * Fxf)) * (lockF ? 0.3 : 1);
  let Dyr = Math.sqrt(Math.max(0, muR * muR - Fxr * Fxr)) * rearLat;
  if (spin > 0.1 && !H.tcs) Dyr *= clamp(1 - spin * 0.5, 0.45, 1);
  const dampM = 0;
  const Fyf = -Dyf * Math.sin(p.C * Math.atan(p.B * af));
  const Fyr = -Dyr * Math.sin(p.C * Math.atan(p.B * ar));
  s.useF = Math.min(1, Math.abs(Fyf) / muF); s.useR = Math.min(1, Math.abs(Fyr) / muR);
  // resistance
  const Faero = p.cd * (1 - 0.35 * s.draft) * u * Math.abs(u);
  const Froll = Math.abs(u) > 0.3 ? p.crr * sgn : 0;
  const cd = Math.cos(delta), sd = Math.sin(delta);
  const Fx = Fxf * cd - Fyf * sd + Fxr - Faero - Froll;
  const Fy = Fyf * cd + Fxf * sd + Fyr;
  const Mz = p.a * (Fyf * cd + Fxf * sd) - p.b * Fyr + escM + dampM;
  s.FyPrev = Fy;
  const prevU = u;
  u += (Fx / p.m + v * r) * dt;
  v += (Fy / p.m - u * r) * dt;
  r += (Mz / p.I) * dt;
  // braking must not reverse the car
  if (sgn !== 0 && Math.sign(u) !== sgn && (inp.brake > 0 || inp.hand || !inp.gas) && s.gear !== -1) u = 0;
  if (Math.abs(u) < 1.5) { const k = Math.exp(-8 * dt); v *= k; r = lerp(r, (u * delta) / p.wb, 1 - k); }
  s.h += r * dt;
  const nh = Math.sin(s.h), nc = Math.cos(s.h);
  s.vx = nh * u + nc * v;
  s.vz = nc * u - nh * v;
  s.u = u; s.v = v; s.r = r;
  s.ax = lerp(s.ax, (u - prevU) / dt, 1 - Math.exp(-10 * dt));
  s.ay = lerp(s.ay, u * r, 1 - Math.exp(-10 * dt));
  s.beta = beta;
  s.lock = lockF || (inp.hand && Math.abs(u) > 5);
  s.slip = Math.max(Math.abs(ar) > 0.13 ? Math.abs(ar) : 0, Math.abs(af) > 0.16 ? Math.abs(af) * 0.7 : 0, spin > 0.15 ? 0.3 : 0, s.lock ? 0.25 : 0);
  s.wheelRot += (u * dt) / 0.34;
  if (s.boostT > 0) s.boostT -= dt;
}

// Grip model (arcade/sport): the car goes where it's pointed. Yaw follows the steering, capped by
// the tyres' lateral grip, so cornering is planted and predictable. It only slides past the limit or in a drift.
function stepGrip(s, p, inp, dt) {
  const H = p.H;
  const sh = Math.sin(s.h), ch = Math.cos(s.h);
  let u = s.vx * sh + s.vz * ch;
  let v = s.vx * ch - s.vz * sh;
  const au = Math.abs(u);
  gearbox(s, p, inp, dt, u);
  const beta = Math.atan2(v, Math.max(au, 1.5));
  if (inp.hand && au > 9) s.driftArm = 1;
  else if (Math.abs(beta) < 0.09) s.driftArm = Math.max(0, (s.driftArm || 0) - dt * 2.5);
  const armed = H.drift > 0 && (s.driftArm || 0) > 0.3 && au > 7;
  s.drifting = armed;
  if (armed) {
    if (!s.dr) s.dr = { side: Math.sign(s.r || -s.steer || 1), b: Math.abs(beta), lowK: 0, noGas: 0 };
    if (driftStep(s, p, inp, dt, u, v)) return;
  } else s.dr = null;

  // longitudinal
  let Fdrive = engine(s, p, inp, u, dt);
  const Fdown = p.down * u * u;
  const Fzr = (p.m * G * p.a) / p.wb + (p.m * s.ax * p.h) / p.wb + Fdown * 0.55;
  const Fzf = (p.m * G * p.b) / p.wb - (p.m * s.ax * p.h) / p.wb + Fdown * 0.45;
  const muLong = p.mu * p.kLong;
  const traction = muLong * (p.drive[0] * Math.max(Fzf, 0) + p.drive[1] * Math.max(Fzr, 0)) / Math.max(p.drive[0] + p.drive[1] - (p.drive[0] && p.drive[1] ? 0 : 0), 1) + (p.drive[0] && p.drive[1] ? muLong * 0 : 0);
  const latUse = clamp(Math.abs(s.ay) / (p.mu * H.grip * G), 0, 1);
  const tracCap = (p.drive[0] ? muLong * Math.max(Fzf, 0) : 0) + muLong * Math.max(Fzr, 0) * (p.drive[1] ? 1 : 0);
  let spin = 0;
  const cap = tracCap * Math.sqrt(Math.max(0.15, 1 - latUse * latUse * 0.6));
  if (Fdrive > cap) { spin = (Fdrive - cap) / cap; Fdrive = cap; }
  void traction;
  const sgn = u > 0.05 ? 1 : u < -0.05 ? -1 : 0;
  let Fb = 0;
  if (inp.brake > 0 && s.gear !== -1) Fb = inp.brake * p.m * G * p.mu * 1.08;
  const Faero = p.cd * (1 - 0.35 * s.draft) * u * Math.abs(u);
  const Froll = au > 0.3 ? p.crr * sgn : 0;
  const prevU = u;
  u += ((Fdrive - Fb * sgn - Faero - Froll) / p.m) * dt;
  if (sgn !== 0 && Math.sign(u) !== sgn && (inp.brake > 0 || !inp.gas) && s.gear !== -1) u = 0;

  // steering → yaw rate (kinematic at low speed, grip-limited at speed)
  const steerLim = p.steerMax / (1 + au * H.steerSens * 0.8);
  const delta = -s.steer * steerLim;
  s.delta = delta;
  let rCmd = (u * Math.tan(delta)) / p.wb;
  const aLat = p.mu * H.grip * G * (1 + Fdown / (p.m * G) * 0.6) * (inp.brake > 0.3 ? 0.92 : 1);
  const rMax = aLat / Math.max(au, 4);
  const over = Math.abs(rCmd) / Math.max(rMax, 1e-3); // >1 means asking for more than the tyres give
  rCmd = clamp(rCmd, -rMax, rMax);
  // trail-braking rotates the car a touch, throttle at the limit pushes wide
  if (inp.brake > 0.2 && au > 10) rCmd *= 1.06;
  const k = 1 - Math.exp(-H.yawK * dt * (au < 6 ? 1.6 : 1));
  s.r = lerp(s.r, rCmd, k);
  s.h += s.r * dt;
  // lateral velocity: grip pulls the velocity back in line with the nose; a little slide at the limit
  const slideK = over > 1 ? 9 - Math.min(5, (over - 1) * 6) * H.slide : 11;
  v *= Math.exp(-slideK * dt);
  if (over > 1.05 && au > 15) v += -Math.sign(rCmd) * Math.min(over - 1, 0.6) * H.slide * 2.2 * dt * au * 0.1;
  const nh = Math.sin(s.h), nc = Math.cos(s.h);
  s.vx = nh * u + nc * v;
  s.vz = nc * u - nh * v;
  s.u = u; s.v = v;
  s.ax = lerp(s.ax, (u - prevU) / dt, 1 - Math.exp(-10 * dt));
  s.ay = lerp(s.ay, u * s.r, 1 - Math.exp(-10 * dt));
  s.beta = Math.atan2(v, Math.max(au, 1.5));
  s.spin = spin;
  s.lock = false;
  s.useF = s.useR = Math.min(1, over);
  s.slip = Math.max(over > 0.95 && au > 12 ? (over - 0.95) * 0.8 + 0.1 : 0, spin > 0.3 ? 0.25 : 0, Math.abs(s.beta) > 0.12 ? Math.abs(s.beta) : 0);
  s.wheelRot += (u * dt) / 0.34;
  if (s.boostT > 0) s.boostT -= dt;
}

// Guided drift (arcade/sport): the handbrake starts it, steering sets the angle and line,
// throttle keeps the momentum. Returns false when the drift ends (normal physics resumes).
function driftStep(s, p, inp, dt, u, v) {
  const H = p.H, d = s.dr;
  let V = Math.hypot(u, v);
  const k = clamp(0.5 - 0.5 * s.steer * d.side, 0, 1); // 1 = steering into the drift, 0 = full countersteer
  d.lowK = k < 0.12 ? d.lowK + dt : 0;
  d.noGas = inp.gas < 0.2 && !inp.hand ? d.noGas + dt : 0;
  d.neutral = Math.abs(s.steer) < 0.2 && !inp.hand ? (d.neutral || 0) + dt : 0;
  if (d.neutral > 0.55) { s.driftArm = 0; s.dr = null; return false; }
  if (d.lowK > 0.22 || d.noGas > 0.45 || V < 9 || inp.brake > 0.6) { s.driftArm = 0; s.dr = null; return false; }
  const bTarget = (0.3 + 0.36 * k + (inp.hand ? 0.14 : 0)) * (0.6 + 0.4 * H.drift);
  const bPrev = d.b;
  d.b += clamp(bTarget - d.b, -1.6 * dt, 1.6 * dt);
  // velocity direction turns with steering; lateral grip of a sliding car ~0.8 mu g
  const latA = p.mu * G * 0.82 * (0.3 + 0.7 * k);
  const psi = Math.atan2(s.vx, s.vz);
  const w = (d.side * latA) / Math.max(V, 6);
  // keep speed on throttle, lose it slowly otherwise
  const engineF = engine(s, p, inp, V * Math.cos(d.b), dt);
  const acc = Math.min(engineF / p.m, p.mu * G * 0.6) * Math.cos(d.b) - (p.cd * V * V) / p.m - (inp.hand ? 4 : 0.9) - (1 - inp.gas) * 1.6;
  V = Math.max(0, V + acc * dt);
  const npsi = psi + w * dt;
  s.vx = Math.sin(npsi) * V; s.vz = Math.cos(npsi) * V;
  const nh = npsi + d.side * d.b;
  s.r = (nh - s.h) / dt;
  s.h = nh;
  const sh = Math.sin(s.h), ch = Math.cos(s.h);
  s.u = s.vx * sh + s.vz * ch; s.v = s.vx * ch - s.vz * sh;
  s.ax = lerp(s.ax, acc, 1 - Math.exp(-10 * dt));
  s.ay = V * w;
  s.beta = Math.atan2(s.v, Math.max(Math.abs(s.u), 1.5));
  s.delta = clamp(d.side * d.b * 0.8, -p.steerMax, p.steerMax); // wheels countersteer visually
  s.spin = inp.gas > 0.5 ? 0.3 : 0; s.lock = !!inp.hand;
  s.slip = 0.25 + d.b * 0.6;
  s.useF = s.useR = 1;
  s.wheelRot += (V * dt) / 0.34;
  s.driftAngle = d.b; s.driftDelta = d.b - bPrev;
  if (s.boostT > 0) s.boostT -= dt;
  return true;
}

function stepBike(s, p, inp, dt) {
  const H = p.H;
  const sh = Math.sin(s.h), ch = Math.cos(s.h);
  let u = s.vx * sh + s.vz * ch;
  let v = s.vx * ch - s.vz * sh;
  if (s.crashT > 0) {
    // sliding on the ground
    const sp = Math.hypot(u, v), dec = Math.min(sp, 7 * dt);
    if (sp > 0.01) { u -= (u / sp) * dec; v -= (v / sp) * dec; }
    s.r *= Math.exp(-2 * dt);
    s.h += s.r * dt;
    s.lean = lerp(s.lean, Math.sign(s.lean || 1) * 1.45, 1 - Math.exp(-6 * dt));
    s.vx = Math.sin(s.h) * u + Math.cos(s.h) * v; s.vz = Math.cos(s.h) * u - Math.sin(s.h) * v;
    s.u = u; s.v = v; s.rpm = lerp(s.rpm, p.idle, 0.05); s.slip = sp > 3 ? 0.4 : 0; s.throttle = 0;
    return;
  }
  gearbox(s, p, inp, dt, u);
  let Fdrive = engine(s, p, inp, u, dt);
  // weight shifts to the rear tyre with drive thrust (reaction about the CG)
  const Fzr = (p.m * G * p.a) / p.wb + (Math.min(Math.max(Fdrive, 0), p.m * p.wheelieA) * p.h) / p.wb;
  const limR = p.mu * Fzr * p.kLong;
  let spin = 0;
  if (Fdrive > limR) { spin = (Fdrive - limR) / limR; Fdrive = limR; }
  // wheelie limit (wheelie control keeps the front just off the ground)
  const wheelieF = p.m * p.wheelieA * p.kLong;
  const pastWheelie = Fdrive > wheelieF * 0.88;
  if (Fdrive > wheelieF) Fdrive = wheelieF;
  const sgn = u > 0.05 ? 1 : u < -0.05 ? -1 : 0;
  let Fb = 0;
  if (inp.brake > 0 && s.gear !== -1) Fb = Math.min(inp.brake * p.m * G * p.mu, p.m * p.stoppieA * (H.abs ? 0.95 : 1.05));
  if (inp.hand) Fb += p.m * G * p.mu * 0.35;
  const Faero = (p.cd * (1 - 0.35 * s.draft)) * u * Math.abs(u);
  const Froll = Math.abs(u) > 0.3 ? p.crr * sgn : 0;
  const Fx = Fdrive - Fb * sgn - Faero - Froll;
  const prevU = u;
  u += (Fx / p.m) * dt;
  if (sgn !== 0 && Math.sign(u) !== sgn && (inp.brake > 0 || !inp.gas) && s.gear !== -1) u = 0;
  // lean and yaw
  const au = Math.abs(u);
  const longUse = clamp(Math.abs(s.ax) / (p.mu * G), 0, 0.95);
  const gripLean = Math.atan(p.mu * Math.sqrt(1 - longUse * longUse));
  const speedK = clamp((au - 2) / 12, 0.12, 1);
  const leanMax = Math.min(p.leanMax, gripLean * (H.id === 'sim' ? 1.08 : 0.98)) * speedK;
  const target = -s.steer * leanMax;
  s.lean += clamp((target - s.lean) * p.leanK, -p.leanRate, p.leanRate) * dt;
  const rLean = (G * Math.tan(s.lean)) / Math.max(au, 3);
  const rLow = (u * (-s.steer * 0.55 / (1 + au * 0.12))) / p.wb;
  const k = clamp((au - 4) / 8, 0, 1);
  let r = lerp(rLow, rLean, k);
  // grip check: leaning past what the tyres hold = low-side
  const latA = Math.abs(u * r), cap = p.mu * G * Math.sqrt(Math.max(0.05, 1 - longUse * longUse));
  s.overGrip = latA > cap * 1.12 ? (s.overGrip || 0) + dt : 0;
  if (latA > cap) r *= cap / latA;
  v *= Math.exp(-9 * dt);
  if (inp.hand && au > 6) v += -r * 0.4 * dt * au; // rear-brake slide
  s.h += r * dt;
  const nh = Math.sin(s.h), nc = Math.cos(s.h);
  s.vx = nh * u + nc * v;
  s.vz = nc * u - nh * v;
  s.u = u; s.v = v; s.r = r;
  s.ax = lerp(s.ax, (u - prevU) / dt, 1 - Math.exp(-10 * dt));
  s.ay = u * r;
  s.beta = Math.atan2(v, Math.max(au, 1.5));
  const wTarget = pastWheelie && u > 3 ? clamp((Fdrive / wheelieF - 0.88) * 3.2, 0, 1) * 0.32 : 0;
  const stoppie = Fb * sgn > p.m * p.stoppieA * 0.85 ? -0.12 : 0;
  s.wheelie = lerp(s.wheelie, wTarget || stoppie, 1 - Math.exp(-5 * dt));
  s.spin = spin;
  s.lock = inp.hand && au > 5;
  s.slip = Math.max(spin > 0.2 ? 0.3 : 0, s.lock ? 0.25 : 0, Math.abs(v) > 1.5 ? 0.3 : 0);
  s.wheelRot += (u * dt) / 0.32;
  if (s.boostT > 0) s.boostT -= dt;
}

// visual body motion (roll/pitch) from accelerations; returns [pitch, roll]
export function bodyMotion(s, p, dt) {
  const k = 1 - Math.exp(-7 * dt);
  if (p.bike) {
    s.pitch = lerp(s.pitch, s.wheelie, k);
    return [s.pitch, s.lean];
  }
  s.pitch = lerp(s.pitch, clamp(-s.ax * 0.0016, -0.04, 0.04), k);
  s.rollV = lerp(s.rollV || 0, clamp(-s.ay * 0.0032, -0.07, 0.07), k);
  return [s.pitch, s.rollV];
}

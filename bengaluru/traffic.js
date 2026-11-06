/* Lane-based traffic for the timeline road.
   - Every vehicle keeps to a lane; in each lane it follows the one ahead (Gipps model), so it brakes
     smoothly and can never drive into it. A hard gap clamp backs that up.
   - Vehicles are only removed and re-inserted OFF-SCREEN (the caller says what is on screen), and only
     where the lane is clear, so nothing pops in, shrinks away or appears inside another vehicle.
   - Plain JS with no three.js dependency, so it can be tested in node.
   Units: world units, seconds. A car is about 1 unit long. */

export const LANE_Z = {
  main: { 1: 4.83, '-1': 5.57 },   /* cars, autos, buses, carts: one lane each way */
  kerb: { 1: 4.36, '-1': 6.04 }    /* two-wheelers keep to the kerb, in their own lane */
};

const MIN_GAP  = 0.10;  /* bumper-to-bumper gap vehicles settle at when queuing */
const HARD_GAP = 0.04;  /* the position clamp never lets the gap fall below this */
const BRAKE    = 2.4;   /* comfortable braking, units/s^2 (Gipps b) */
const BRAKE_MAX= 8.0;   /* emergency braking */
const ACCEL    = 1.5;   /* pull-away, units/s^2 */
const REACT    = 0.5;   /* reaction time, s (Gipps tau) */
const LOOK     = 30;    /* only look this far ahead for a leader */
const ENTRY_CLEAR = 0.9;/* extra clearance wanted around an entry point before inserting */

export const ACTIVE = 0, QUEUED = 1;

/* def: {kind,x0,x1,dir,speed,len,wid,two} */
export function makeVehicle(def) {
  const two = !!def.two, dir = def.dir > 0 ? 1 : -1;
  return {
    kind: def.kind, x0: def.x0, x1: def.x1, dir, two,
    z: (two ? LANE_Z.kerb : LANE_Z.main)[dir],
    lane: (two ? 2 : 0) + (dir > 0 ? 0 : 1),
    v: def.speed, cur: def.speed * 0.7, len: def.len, wid: def.wid || 0.4,
    x: def.x0, state: QUEUED
  };
}

const lanes = [[], [], [], []];
const queued = [];
const byLead  = (a, b) => b.x - a.x;   /* dir > 0: leader has the largest x */
const byLead2 = (a, b) => a.x - b.x;   /* dir < 0: leader has the smallest x */

/* does a vehicle of length `len` fit at x in its lane, among the vehicles already placed? */
function fits(v, x, pad) {
  const L = lanes[v.lane];
  for (let i = 0; i < L.length; i++) {
    const o = L[i];
    if (o === v) continue;
    if (Math.abs(o.x - x) < (o.len + v.len) / 2 + pad) return false;
  }
  return true;
}

/* scatter the starting positions with no overlaps; whoever does not fit waits to be inserted at an edge */
export function initPlace(vehicles, rand) {
  for (const L of lanes) L.length = 0;
  for (const v of vehicles) {
    let ok = false;
    for (let t = 0; t < 60 && !ok; t++) {
      const x = v.x0 + rand() * (v.x1 - v.x0);
      if (fits(v, x, 0.7)) { v.x = x; v.cur = v.v * (0.6 + rand() * 0.3); v.state = ACTIVE; lanes[v.lane].push(v); ok = true; }
    }
    if (!ok) v.state = QUEUED;
  }
}

/* advance every vehicle by dt seconds. offscreen(x, len) must say whether a vehicle of that length centred at x
   is completely out of sight (with a safety margin). */
export function stepTraffic(vehicles, dt, offscreen) {
  for (const L of lanes) L.length = 0;
  queued.length = 0;
  for (const v of vehicles) { if (v.state === ACTIVE) lanes[v.lane].push(v); else queued.push(v); }

  for (let li = 0; li < 4; li++) {
    const L = lanes[li];
    L.sort((li & 1) ? byLead2 : byLead);
    for (let i = 0; i < L.length; i++) {
      const v = L[i], lead = i > 0 ? L[i - 1] : null;
      let target = v.v;
      let gap = 1e9;
      if (lead) {
        gap = v.dir > 0 ? lead.x - v.x : v.x - lead.x;
        gap -= (lead.len + v.len) / 2;
        if (gap < LOOK) {
          /* Gipps safe speed: the fastest speed from which v can still stop behind lead if lead brakes hard */
          const free = Math.max(0, gap - MIN_GAP);
          const s = -BRAKE * REACT + Math.sqrt(BRAKE * BRAKE * REACT * REACT + lead.cur * lead.cur + 2 * BRAKE * free);
          if (s < target) target = s;
        }
      }
      const dv = target - v.cur;
      v.cur += dv > 0 ? Math.min(dv, ACCEL * dt) : Math.max(dv, -BRAKE_MAX * dt);
      if (v.cur < 0) v.cur = 0;
      let step = v.cur * dt;
      if (lead) {                      /* never close the gap below HARD_GAP, whatever happens */
        const room = gap - HARD_GAP;
        if (step > room) { step = room > 0 ? room : 0; if (v.cur > lead.cur) v.cur = lead.cur; }
      }
      v.x += v.dir * step;
    }
  }

  /* leaving: only once the vehicle has passed the end of its stretch AND is out of sight */
  for (const v of vehicles) {
    if (v.state !== ACTIVE) continue;
    const gone = v.dir > 0 ? v.x > v.x1 : v.x < v.x0;
    if (gone && offscreen(v.x, v.len)) v.state = QUEUED;
  }

  /* entering: at the start of the stretch, out of sight, and only where there is room */
  for (const v of vehicles) {
    if (v.state !== QUEUED) continue;
    const ex = v.dir > 0 ? v.x0 : v.x1;
    if (!offscreen(ex, v.len + 2 * ENTRY_CLEAR)) continue;
    if (!fits(v, ex, ENTRY_CLEAR)) continue;
    v.x = ex; v.cur = v.v * 0.6; v.state = ACTIVE;
    if (lanes[v.lane].indexOf(v) < 0) lanes[v.lane].push(v);   /* a vehicle that left and re-entered this frame is already listed */
  }
}

/* test helper: worst overlap between any two active vehicles (bumper-to-bumper, same lane) */
export function worstOverlap(vehicles) {
  let worst = 0;
  for (const L of lanes) for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
    if (L[i].state !== ACTIVE || L[j].state !== ACTIVE) continue;
    const o = (L[i].len + L[j].len) / 2 - Math.abs(L[i].x - L[j].x);
    if (o > worst) worst = o;
  }
  return worst;
}

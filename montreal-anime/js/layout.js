// layout.js — the Plateau street grid, terrain slope and shared helpers (CPU + generated GLSL).
// Frame: x = east, z = south, y = up. Uphill is north (-z), toward Mount Royal.
import * as THREE from 'three';

export const SLOPE = 0.055;
export const h = (z) => -SLOPE * z;            // ground height (m)
export const CURB = 0.15;                      // sidewalk height above the road

// north–south streets x = 90k, east–west streets z = 60 + 110m
const NS_NAMES = { '-2': 'Boulevard Saint-Laurent', '-1': 'Rue Drolet', '0': 'Rue Saint-Denis', '1': 'Rue Saint-Hubert', '2': 'Rue Saint-André' };
const EW_NAMES = { '-3': 'Boulevard Saint-Joseph', '-2': 'Rue Gilford', '-1': 'Avenue du Mont-Royal', '0': 'Rue Marie-Anne', '1': 'Rue Rachel', '2': 'Rue Duluth', '3': 'Rue Sherbrooke' };
export const nsX = (k) => 90 * k;
export const ewZ = (m) => -160 + 110 * (m + 1);              // m=-1 → Mont-Royal (z=-160)
export const nsHW = (k) => (k === 0 ? 7.5 : k === -1 ? 4.2 : k === -2 ? 8 : 5);
export const nsSW = (k) => (k === 0 ? 4 : 3);
export const ewHW = (m) => (m === -1 ? 7 : m === 1 ? 6 : m === 3 ? 8 : 5);
export const ewSW = (m) => (m === -1 ? 4.5 : 3);
export const nsName = (k) => NS_NAMES[k] || 'Rue du Plateau';
export const ewName = (m) => EW_NAMES[m] || 'Rue du Plateau';
export const nsIdx = (x) => Math.round(x / 90);
export const ewIdx = (z) => Math.round((z + 160) / 110) - 1;
export const ALLEY_HW = 2.6;
export const alleyX = (k) => 45 + 90 * k;

// the detailed district (everything outside is simpler "fill" city)
export const DETAIL = { x0: -135, x1: 135, z0: -270, z1: 280 };
export const BOUNDS = { x0: -131, x1: 131, z0: -264, z1: 274 };

// special places
export const PARK = { x0: -90 + nsHW(-1) + nsSW(-1), x1: -nsHW(0) - nsSW(0), z0: ewZ(1) + ewHW(1) + ewSW(1), z1: ewZ(2) - ewHW(2) - ewSW(2), name: 'Carré Saint-Louis' };
export const PLAZA = { x0: nsHW(0) + nsSW(0), x1: 44, z0: -214, z1: ewZ(-1) - ewHW(-1) - ewSW(-1), name: 'Place du métro Mont-Royal' };
export const CHURCH = { x0: nsHW(0) + nsSW(0), x1: 43, z0: -40, z1: 12 };
export const GREEN_ALLEY = { x: 45, z0: ewZ(-1), z1: ewZ(0) };

export function inRect(r, x, z, pad = 0) { return x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad; }

// where is (x,z)? 'ns' street, 'ew' street, 'alley', 'park', 'plaza', 'block'
export function whereIs(x, z) {
  const k = nsIdx(x), m = ewIdx(z);
  const dx = Math.abs(x - nsX(k)), dz = Math.abs(z - ewZ(m));
  if (inRect(PARK, x, z)) return { kind: 'park', name: PARK.name };
  if (inRect(PLAZA, x, z)) return { kind: 'plaza', name: PLAZA.name };
  if (dx < nsHW(k) + nsSW(k) + 1) return { kind: 'ns', name: nsName(k), k };
  if (dz < ewHW(m) + ewSW(m) + 1) return { kind: 'ew', name: ewName(m), m };
  const ka = Math.round((x - 45) / 90);
  if (Math.abs(x - alleyX(ka)) < ALLEY_HW + 0.5) {
    const green = Math.abs(x - GREEN_ALLEY.x) < 4 && z > GREEN_ALLEY.z0 && z < GREEN_ALLEY.z1;
    return { kind: 'alley', name: green ? 'Ruelle verte' : 'Ruelle' };
  }
  return { kind: 'block', name: null };
}

// ---------------------------------------------------------------- deterministic random
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const pick = (a, r) => a[Math.floor(r() * a.length) % a.length];

// palette in sRGB, converted to linear for vertex colours
const _c = new THREE.Color();
export function lin(hex) { _c.set(hex); return [_c.r, _c.g, _c.b]; }

// ---------------------------------------------------------------- shared uniforms
export const U = {
  uTime: { value: 0 }, uNight: { value: 0 }, uSnow: { value: 0 }, uAutumn: { value: 0 }, uWinter: { value: 0 },
};

// ---------------------------------------------------------------- GLSL street functions for the ground shader
function table(name, fn, lo, hi, def) {
  let s = `float ${name}(float i){`;
  for (let i = lo; i <= hi; i++) s += `if(abs(i-(${i}.0))<0.5) return ${fn(i).toFixed(2)};`;
  return s + `return ${def.toFixed(2)};}\n`;
}
export const GLSL_STREETS = table('nsHW', nsHW, -6, 6, 5) + table('nsSW', nsSW, -6, 6, 3) + table('ewHW', ewHW, -6, 6, 5) + table('ewSW', ewSW, -6, 6, 3) + `
const float SLOPE = ${SLOPE.toFixed(4)};
const float ALLEYHW = ${ALLEY_HW.toFixed(2)};
const vec4 PARK = vec4(${PARK.x0.toFixed(2)}, ${PARK.x1.toFixed(2)}, ${PARK.z0.toFixed(2)}, ${PARK.z1.toFixed(2)});
const vec4 PLAZA = vec4(${PLAZA.x0.toFixed(2)}, ${PLAZA.x1.toFixed(2)}, ${PLAZA.z0.toFixed(2)}, ${PLAZA.z1.toFixed(2)});
const vec3 GALLEY = vec3(${GREEN_ALLEY.x.toFixed(1)}, ${GREEN_ALLEY.z0.toFixed(1)}, ${GREEN_ALLEY.z1.toFixed(1)});
bool inR(vec4 r, vec2 p){ return p.x > r.x && p.x < r.y && p.y > r.z && p.y < r.w; }
`;

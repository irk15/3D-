// toon.js — the anime look: banded toon lighting, painted sky, ink outlines, glow sprites.
// Outlines are drawn in screen space from a normal+depth pass (no inverted hulls, no extra
// geometry), so they can never z-fight; their strength fades with distance so they never shimmer.
import * as THREE from 'three';
import { U, GLSL_STREETS } from './layout.js';

export const LAYER_FX = 1;   // sky, clouds, glows, particles: colour pass only, no outlines

// 3-band ramp: shadow / mid / lit
const ramp = new Uint8Array([90, 175, 255]);
export const gradient = new THREE.DataTexture(ramp, ramp.length, 1, THREE.RedFormat);
gradient.minFilter = gradient.magFilter = THREE.NearestFilter; gradient.generateMipmaps = false; gradient.needsUpdate = true;

const GLSL_NOISE = /* glsl */`
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ return vn(p) * 0.5 + vn(p * 2.03) * 0.25 + vn(p * 4.01) * 0.125 + vn(p * 8.1) * 0.0625; }
float band(float x, float a, float b){ float w = fwidth(x) * 0.75 + 1e-5; return smoothstep(a - w, a + w, x) * (1.0 - smoothstep(b - w, b + w, x)); }
float vis(float s, float fw){ return 1.0 - smoothstep(0.3, 0.9, fw / s); }   // 1 if a feature of size s is resolvable
`;

const cache = new Map();
export function toon(hex, opts = {}) {
  const key = hex + JSON.stringify(opts);
  if (cache.has(key)) return cache.get(key);
  const m = new THREE.MeshToonMaterial(Object.assign({ color: hex, gradientMap: gradient }, opts));
  cache.set(key, m); return m;
}

// ---------------------------------------------------------------- world batch material (vertex colours + kinds)
// kinds: 0 plain, 1 brick, 2 stone, 3 boards, 4 fill facade, 5 glass, 6 glass lit at night,
//        7 lamp, 8 shop window, 9 roof, 10 metal
export function batchMaterial() {
  const m = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradient });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uNight: U.uNight, uSnow: U.uSnow, uTime: U.uTime });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
attribute float aKind; flat varying float vKind; varying vec3 vWP; varying vec3 vWN;`)
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
vKind = aKind; vWP = (modelMatrix * vec4(transformed, 1.0)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal);`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform float uNight, uSnow, uTime; flat varying float vKind; varying vec3 vWP; varying vec3 vWN;
${GLSL_NOISE}
vec3 gEmit;`).replace('#include <color_fragment>', /* glsl */`#include <color_fragment>
gEmit = vec3(0.0);
{
  float k = vKind;
  vec3 c = diffuseColor.rgb;
  bool side = abs(vWN.y) < 0.5;
  float u = abs(vWN.x) > 0.5 ? vWP.z : vWP.x;
  float fw = max(fwidth(u), fwidth(vWP.y));
  float gy = vWP.y + ${(0.055).toFixed(3)} * vWP.z;      // height above the street at this point
  if (k > 0.5 && k < 1.5 && side) {          // brick
    float row = floor(vWP.y / 0.28); float uu = u / 0.62 + 0.5 * mod(row, 2.0);
    float mortar = max(band(fract(vWP.y / 0.28), 0.0, 0.1), band(fract(uu), 0.0, 0.05)) * vis(0.05, fw);
    c *= (0.93 + 0.12 * h21(vec2(floor(uu), row))) * mix(1.0, 1.0 - 0.45 * vis(0.3, fw) * 0.0, 0.0);
    c = mix(c, c * 1.32 + 0.03, mortar * 0.55);
  } else if (k > 1.5 && k < 2.5 && side) {   // greystone blocks
    float row = floor(vWP.y / 0.55); float uu = u / 1.1 + 0.5 * mod(row, 2.0);
    float j = max(band(fract(vWP.y / 0.55), 0.0, 0.04), band(fract(uu), 0.0, 0.025)) * vis(0.04, fw);
    c *= 0.94 + 0.1 * h21(vec2(floor(uu), row));
    c = mix(c, c * 0.72, j * 0.6);
  } else if (k > 2.5 && k < 3.5 && side) {   // wooden boards
    float j = band(fract(vWP.y / 0.2), 0.0, 0.08) * vis(0.04, fw);
    c = mix(c, c * 0.72, j * 0.7);
  } else if (k > 3.5 && k < 4.5 && side) {   // simple city in the distance: procedural windows
    float col = floor(u / 2.4), fl = floor(gy / 3.1);
    float wx = band(fract(u / 2.4), 0.25, 0.75), wy = band(fract(gy / 3.1), 0.32, 0.8);
    float win = wx * wy * step(0.6, gy) ;
    float avg = 0.25;
    float vv = vis(0.6, fw);
    float w = mix(avg, win, vv);
    float lit = step(h21(vec2(col, fl) + floor(vWP.x * 0.03) * 7.1 + floor(vWP.z * 0.03) * 3.3), 0.42);
    c = mix(c, vec3(0.16, 0.25, 0.42), w * 0.85);
    gEmit += vec3(1.0, 0.72, 0.38) * mix(0.42 * 0.25, lit * win, vv) * uNight * 1.6;
  } else if (k > 4.5 && k < 6.5) {           // glass: sky reflection by day, warm windows at night
    float sky = 0.5 + 0.5 * vWN.y;
    vec3 day = mix(vec3(0.20, 0.36, 0.55), vec3(0.62, 0.82, 0.95), smoothstep(0.2, 0.9, fract(vWP.y * 0.37 + u * 0.21)) * 0.6);
    c = mix(day, vec3(0.05, 0.07, 0.14), uNight);
    float lit = k > 5.5 ? 1.0 : 0.0;
    gEmit += vec3(1.0, 0.74, 0.40) * lit * uNight * 1.25;
    c = mix(c, vec3(0.9, 0.7, 0.4) * 0.3, lit * uNight);
  } else if (k > 6.5 && k < 7.5) {           // lamp heads
    gEmit += vec3(1.0, 0.86, 0.6) * uNight * 2.4;
  } else if (k > 7.5 && k < 8.5) {           // shop windows
    c = mix(vec3(0.42, 0.62, 0.72), vec3(0.95, 0.80, 0.55), uNight);
    gEmit += vec3(1.0, 0.82, 0.55) * uNight * 1.1;
  } else if (k > 8.5 && k < 9.5) {           // roofs
    c *= 0.9 + 0.12 * vn(vWP.xz * 1.7);
  }
  // contact shading at the foot of walls
  if (side && k < 4.5) c *= 0.8 + 0.2 * smoothstep(0.0, 1.1, gy);
  // snow on anything facing up (not glass or lamps)
  float up = smoothstep(0.55, 0.85, vWN.y);
  if (k < 4.5 || k > 8.5) c = mix(c, vec3(0.93, 0.95, 1.0), uSnow * up);
  diffuseColor.rgb = c;
}`).replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += gEmit;');
  };
  m.customProgramCacheKey = () => 'batch';
  return m;
}

// ---------------------------------------------------------------- ground (one surface for roads, yards, park, plaza)
export function groundMaterial() {
  const m = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: gradient });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uNight: U.uNight, uSnow: U.uSnow, uAutumn: U.uAutumn });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform float uNight, uSnow, uAutumn; varying vec3 vWP;
${GLSL_NOISE}
${GLSL_STREETS}
vec3 gE;`).replace('#include <color_fragment>', GROUND_GLSL)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += gE;');
  };
  m.customProgramCacheKey = () => 'ground';
  return m;
}
const GROUND_GLSL = /* glsl */`#include <color_fragment>
vec2 p = vWP.xz;
float fw = max(fwidth(p.x), fwidth(p.y));
float k = floor(p.x / 90.0 + 0.5), mm = floor((p.y + 160.0) / 110.0 + 0.5) - 1.0;
float sx = 90.0 * k, sz = -160.0 + 110.0 * (mm + 1.0);
float dx = p.x - sx, dz = p.y - sz;
float hwx = nsHW(k), hwz = ewHW(mm);
bool onNS = abs(dx) < hwx, onEW = abs(dz) < hwz;
float ka = floor((p.x - 45.0) / 90.0 + 0.5); float ax = p.x - (45.0 + 90.0 * ka);
bool onAlley = abs(ax) < ALLEYHW && abs(dz) > hwz + ewSW(mm);
float n1 = fbm(p * 0.08), n2 = vn(p * 0.9);
vec3 col;
gE = vec3(0.0);
if (onNS || onEW) {
  col = mix(vec3(0.33, 0.35, 0.40), vec3(0.38, 0.40, 0.45), step(0.55, n1));        // two-tone asphalt
  col *= 0.96 + 0.06 * step(0.7, vn(p * 0.35));
  float mk = 0.0; vec3 mc = vec3(0.95, 0.95, 0.92);
  if (onNS && !onEW) {
    float a = abs(dx);
    if (hwx > 7.0) {   // Saint-Denis: double yellow, bike lanes, parking lane
      float dy = band(a, 0.12, 0.26);
      mk = max(mk, dy); mc = mix(mc, vec3(0.98, 0.78, 0.2), dy);
      float bike = band(a, 3.4, 5.2);
      col = mix(col, vec3(0.36, 0.62, 0.48), bike * 0.85);
      mk = max(mk, band(a, 3.25, 3.4) + band(a, 5.2, 5.35));
      float sym = bike * band(fract(p.y / 24.0), 0.45, 0.5) * band(abs(a - 4.3), 0.0, 0.35);
      mk = max(mk, sym);
    } else if (hwx > 4.8) {
      mk = max(mk, band(a, 0.0, 0.1) * step(fract(p.y / 6.0), 0.5));
    }
  }
  if (onEW && !onNS) {
    float a = abs(dz);
    if (hwz > 6.5) { float dy = band(a, 0.12, 0.26); mk = max(mk, dy); mc = mix(mc, vec3(0.98, 0.78, 0.2), dy); mk = max(mk, band(a, 3.6, 3.75) * step(fract(p.x / 5.0), 0.6)); }
    else mk = max(mk, band(a, 0.0, 0.1) * step(fract(p.x / 6.0), 0.5));
  }
  // zebra crossings + stop lines just outside every intersection
  if (onNS && !onEW) { float e = abs(dz) - hwz; float zz = band(e, 0.6, 3.6) * band(fract((dx + 50.0) / 1.0), 0.0, 0.5); float st = band(e, 4.2, 4.6) * step(0.0, dx * sign(dz)); mk = max(mk, max(zz, st)); }
  if (onEW && !onNS) { float e = abs(dx) - hwx; float zz = band(e, 0.6, 3.6) * band(fract((dz + 50.0) / 1.0), 0.0, 0.5); float st = band(e, 4.2, 4.6) * step(0.0, -dz * sign(dx)); mk = max(mk, max(zz, st)); }
  // manholes
  vec2 mh = vec2(onNS ? sx : floor(p.x / 22.0) * 22.0 + 11.0, onNS ? floor(p.y / 22.0) * 22.0 + 11.0 : sz);
  float man = band(length(p - mh), 0.0, 0.42) * vis(0.2, fw);
  col = mix(col, vec3(0.22, 0.22, 0.25), man);
  col = mix(col, mc, mk * vis(0.15, fw) * 0.92);
} else if (inR(PLAZA, p)) {
  vec2 t = p / 1.2; vec2 f = fract(t);
  float j = max(band(f.x, 0.0, 0.05), band(f.y, 0.0, 0.05)) * vis(0.06, fw);
  col = mix(vec3(0.80, 0.74, 0.66), vec3(0.74, 0.67, 0.60), step(0.5, h21(floor(t))));
  col = mix(col, vec3(0.58, 0.52, 0.47), j);
} else if (inR(PARK, p)) {
  vec2 c = vec2((PARK.x + PARK.y) * 0.5, (PARK.z + PARK.w) * 0.5);
  float r = length(p - c);
  col = mix(vec3(0.42, 0.68, 0.30), vec3(0.50, 0.75, 0.34), step(0.5, n1));
  col = mix(col, col * vec3(1.25, 0.95, 0.55), uAutumn * 0.25);
  float diag = min(abs((p.x - c.x) - (p.y - c.y) * 0.95), abs((p.x - c.x) + (p.y - c.y) * 0.95));
  float path = max(1.0 - step(1.6, diag), band(r, 13.0, 16.0));
  path = max(path, 1.0 - step(1.6, abs(p.x - c.x)));
  path *= step(r, 9.0) < 0.5 ? 1.0 : 1.0;
  float plazaC = 1.0 - step(9.5, r);
  col = mix(col, vec3(0.86, 0.78, 0.62), max(path, plazaC));
} else if (onAlley) {
  bool green = abs(p.x - GALLEY.x) < 4.0 && p.y > GALLEY.y && p.y < GALLEY.z;
  col = mix(vec3(0.62, 0.61, 0.58), vec3(0.55, 0.55, 0.53), step(0.5, n1));
  float crack = band(fract(p.y / 4.0), 0.0, 0.015) * vis(0.05, fw);
  col *= 1.0 - 0.25 * crack;
  if (green) { float strip = band(abs(ax), 0.0, 0.7); col = mix(col, vec3(0.36, 0.62, 0.30), strip); col = mix(col, vec3(0.92, 0.62, 0.70), band(fract(p.y / 3.0 + 0.3 * n2), 0.0, 0.06) * strip * 0.0); }
} else {
  // yards: grass with dirt patches and stepping stones
  col = mix(vec3(0.44, 0.66, 0.32), vec3(0.52, 0.72, 0.36), step(0.5, n1));
  col = mix(col, vec3(0.66, 0.56, 0.42), smoothstep(0.62, 0.66, fbm(p * 0.21)) * 0.8);
  col = mix(col, col * vec3(1.2, 0.95, 0.6), uAutumn * 0.25);
}
// snow: roads keep tyre tracks, everything else white
float snowAmt = uSnow;
if (onNS || onEW) { float lane = onNS ? abs(abs(dx) - 2.0) : abs(abs(dz) - 2.0); snowAmt *= 0.35 + 0.65 * smoothstep(0.4, 1.4, lane); }
col = mix(col, vec3(0.92, 0.94, 0.99) * (0.96 + 0.04 * n2), snowAmt * 0.95);
// warm lamp pools at night (lamps every 30 m on both sidewalks, mirrored in world.js)
if (uNight > 0.01) {
  float pool = 0.0;
  { float off = hwx + 0.6; float l1 = floor(p.y / 30.0 + 0.5) * 30.0, l2 = floor((p.y - 15.0) / 30.0 + 0.5) * 30.0 + 15.0;
    pool += exp(-dot(p - vec2(sx + off, l1), p - vec2(sx + off, l1)) / 40.0) + exp(-dot(p - vec2(sx - off, l2), p - vec2(sx - off, l2)) / 40.0); }
  { float off = hwz + 0.6; float l1 = floor(p.x / 30.0 + 0.5) * 30.0, l2 = floor((p.x - 15.0) / 30.0 + 0.5) * 30.0 + 15.0;
    pool += exp(-dot(p - vec2(l1, sz + off), p - vec2(l1, sz + off)) / 40.0) + exp(-dot(p - vec2(l2, sz - off), p - vec2(l2, sz - off)) / 40.0); }
  pool = floor(min(pool, 1.0) * 3.0 + 0.5) / 3.0;                      // banded, anime-style pools
  gE += col * vec3(1.0, 0.78, 0.45) * pool * uNight * 1.3;
}
diffuseColor.rgb = col;
`;

// ---------------------------------------------------------------- painted sky dome
export function makeSky() {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uZen: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uSunCol: { value: new THREE.Color() },
      uSun: { value: new THREE.Vector3(0, 1, 0) }, uNight: U.uNight, uTime: U.uTime, uCloud: { value: 0.5 }, uCloudCol: { value: new THREE.Color(1, 1, 1) }, uCloudShade: { value: new THREE.Color(0.7, 0.75, 0.9) },
    },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
    fragmentShader: /* glsl */`
uniform vec3 uZen, uHor, uSunCol, uSun, uCloudCol, uCloudShade; uniform float uNight, uTime, uCloud; varying vec3 vD;
${GLSL_NOISE}
void main(){
  vec3 d = normalize(vD);
  float y = max(d.y, 0.0);
  vec3 c = mix(uHor, uZen, smoothstep(0.0, 0.55, pow(y, 0.8)));
  float sd = dot(d, normalize(uSun));
  c += uSunCol * (smoothstep(0.9993, 0.9996, sd) * 1.6 + pow(max(sd, 0.0), 24.0) * 0.25) * (1.0 - uNight * 0.3);
  // stars
  if (uNight > 0.01) {
    vec3 sp = d * 180.0; vec3 id = floor(sp); float hs = fract(sin(dot(id, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
    if (hs > 0.992) { float dd = length(fract(sp) - 0.5); float fw = fwidth(sp.x) + fwidth(sp.y); c += vec3(0.9, 0.95, 1.0) * (1.0 - smoothstep(0.0, max(0.12, fw), dd)) * uNight * smoothstep(0.0, 0.25, y) * (0.5 + hs * 2.0 - 1.98); }
  }
  // flat-shaded anime clouds: two tones with a hard edge, drifting
  if (d.y > 0.0) {
    vec2 cp = d.xz / (d.y + 0.18) * 1.3 + vec2(uTime * 0.006, uTime * 0.002);
    float n = fbm(cp * 0.9) * 0.7 + fbm(cp * 2.3) * 0.3;
    float fwc = fwidth(n) + 1e-4;
    float cov = smoothstep(1.0 - uCloud - fwc, 1.0 - uCloud + fwc, n) * smoothstep(0.02, 0.12, d.y);
    float lit = smoothstep(-fwc, fwc, fbm(cp * 0.9 + normalize(uSun.xz + 1e-4) * 0.08) - n + 0.02);
    vec3 cc = mix(uCloudShade, uCloudCol, lit);
    c = mix(c, cc, cov);
  }
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`,
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), mat);
  sky.scale.setScalar(1500); sky.renderOrder = -10; sky.frustumCulled = false; sky.layers.set(LAYER_FX);
  return sky;
}

// ---------------------------------------------------------------- additive glow sprites (lamps, headlights, cross)
export class Glows {
  constructor(max) {
    const q = new THREE.PlaneGeometry(2, 2), g = new THREE.InstancedBufferGeometry();
    g.index = q.index; g.attributes.position = q.attributes.position; g.attributes.uv = q.attributes.uv;
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 4);
    g.setAttribute('iPos', new THREE.InstancedBufferAttribute(this.pos, 3)); g.setAttribute('iCol', new THREE.InstancedBufferAttribute(this.col, 4));
    g.instanceCount = 0; this.g = g; this.n = 0; this.max = max;
    this.mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({
      uniforms: { uNight: U.uNight },
      vertexShader: `attribute vec3 iPos; attribute vec4 iCol; uniform float uNight; varying vec2 vUv; varying vec4 vC;
void main(){ vUv = uv * 2.0 - 1.0; vec4 mv = modelViewMatrix * vec4(iPos, 1.0); float r = iCol.a; mv.xy += position.xy * max(r, -mv.z * 0.003); vC = vec4(iCol.rgb, uNight * smoothstep(0.5, 4.0, -mv.z)); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec2 vUv; varying vec4 vC; void main(){ float r = dot(vUv, vUv); if (r > 1.0) discard; float f = exp(-r * 4.5) * 0.9 + (1.0 - smoothstep(0.0, 0.08, r)) * 0.6; gl_FragColor = vec4(vC.rgb * f * vC.a, 1.0); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    this.mesh.frustumCulled = false; this.mesh.layers.set(LAYER_FX); this.mesh.renderOrder = 20;
  }
  add(x, y, z, r, g, b, radius) { if (this.n >= this.max) return -1; const i = this.n++; this.pos.set([x, y, z], i * 3); this.col.set([r, g, b, radius], i * 4); return i; }
  set(i, x, y, z) { this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z; }
  commit() { this.g.instanceCount = this.n; this.g.attributes.iPos.needsUpdate = true; this.g.attributes.iCol.needsUpdate = true; }
}

// ---------------------------------------------------------------- render pipeline: colour + normal/depth → ink + grade
export class Pipeline {
  constructor(renderer, scene, camera) {
    this.r = renderer; this.scene = scene; this.camera = camera;
    const opts = { type: THREE.HalfFloatType };
    this.color = new THREE.WebGLRenderTarget(4, 4, Object.assign({ samples: 4 }, opts));
    this.normal = new THREE.WebGLRenderTarget(4, 4, Object.assign({ minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter }, opts));
    this.nmat = new THREE.ShaderMaterial({
      vertexShader: /* glsl */`
#include <common>
varying vec3 vN; varying float vZ;
void main(){
  #include <beginnormal_vertex>
  #include <defaultnormal_vertex>
  #include <begin_vertex>
  #include <project_vertex>
  vN = normalize(transformedNormal); vZ = -mvPosition.z;
}`,
      fragmentShader: 'varying vec3 vN; varying float vZ; void main(){ gl_FragColor = vec4(normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0), vZ); }',
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      uniforms: { tC: { value: this.color.texture }, tN: { value: this.normal.texture }, uPx: { value: new THREE.Vector2() }, uLW: { value: 1 }, uInk: { value: new THREE.Color(0.10, 0.08, 0.20) }, uNight: U.uNight, uGrade: { value: new THREE.Vector3(1.08, 1, 0) } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: /* glsl */`
uniform sampler2D tC, tN; uniform vec2 uPx; uniform float uLW, uNight; uniform vec3 uInk, uGrade; varying vec2 vUv;
void main(){
  vec3 c = texture2D(tC, vUv).rgb;
  vec4 n0 = texture2D(tN, vUv);
  float d0 = n0.a < 0.001 ? 1e4 : n0.a;
  vec2 o = uPx * uLW;
  vec4 s[4]; s[0] = texture2D(tN, vUv + vec2(o.x, 0.0)); s[1] = texture2D(tN, vUv - vec2(o.x, 0.0)); s[2] = texture2D(tN, vUv + vec2(0.0, o.y)); s[3] = texture2D(tN, vUv - vec2(0.0, o.y));
  float dmin = d0, ne = 0.0;
  float dd[4];
  for (int i = 0; i < 4; i++) { dd[i] = s[i].a < 0.001 ? 1e4 : s[i].a; dmin = min(dmin, dd[i]); }
  // depth creases & silhouettes (second difference, relative to distance → no false lines on slopes)
  float lap = abs(dd[0] + dd[1] - 2.0 * d0) + abs(dd[2] + dd[3] - 2.0 * d0);
  float de = smoothstep(0.05, 0.1, lap / max(dmin, 0.3));
  // normal creases (only up close, where they read as drawn lines)
  if (n0.a > 0.001) for (int i = 0; i < 4; i++) if (s[i].a > 0.001) ne = max(ne, 1.0 - dot(n0.xyz, s[i].xyz));
  float nearF = 1.0 - smoothstep(35.0, 140.0, dmin);
  float edge = max(de, smoothstep(0.25, 0.5, ne) * nearF);
  edge *= 1.0 - smoothstep(150.0, 520.0, dmin) * 0.85;
  vec3 ink = mix(c * vec3(0.32, 0.30, 0.45), uInk, 0.35);
  ink = mix(ink, c * 0.55 + vec3(0.02, 0.02, 0.06), uNight * 0.5);
  c = mix(c, ink, edge * 0.92);
  // gentle grade: saturation + vignette
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(vec3(l), c, uGrade.x);
  vec2 v = vUv - 0.5; c *= 1.0 - dot(v, v) * 0.35;
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`,
      depthTest: false, depthWrite: false, toneMapped: false,
    }));
    this.quad.frustumCulled = false;
    this.qscene = new THREE.Scene(); this.qscene.add(this.quad);
    this.qcam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.clearN = new THREE.Color(0, 0, 0);
  }
  setSize(w, h, pr) {
    const W = Math.floor(w * pr), H = Math.floor(h * pr);
    this.color.setSize(W, H); this.normal.setSize(W, H);
    this.quad.material.uniforms.uPx.value.set(1 / W, 1 / H);
    this.quad.material.uniforms.uLW.value = Math.max(1, Math.round(H / 820));
  }
  render() {
    const r = this.r, cam = this.camera, sc = this.scene;
    // 1) normal + depth (layer 0 only, no sky / glows / particles)
    const fog = sc.fog, bg = sc.background;
    sc.fog = null; sc.background = null; sc.overrideMaterial = this.nmat;
    const mask = cam.layers.mask; cam.layers.set(0);
    r.setRenderTarget(this.normal); r.setClearColor(this.clearN, 0); r.clear();
    const sh = r.shadowMap.autoUpdate; r.shadowMap.autoUpdate = false;
    r.render(sc, cam);
    r.shadowMap.autoUpdate = sh;
    sc.overrideMaterial = null; sc.fog = fog; sc.background = bg; cam.layers.mask = mask;
    // 2) colour (all layers, MSAA)
    r.setRenderTarget(this.color); r.render(sc, cam);
    // 3) composite to screen
    r.setRenderTarget(null); r.render(this.qscene, this.qcam);
  }
}

// lib/atmosphere.js — shared sky, sun/moon, shadows, environment light, fog, seasons and weather.
// Ported from the Montréal city and made location-aware, so any city can import it.
// Frame: x = east, y = up, z = south. Works with the logarithmic depth buffer.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';

export const U = { uTime: { value: 0 }, uNight: { value: 0 }, uSnow: { value: 0 }, uWet: { value: 0 }, uAutumn: { value: 0 }, uWinter: { value: 0 } };
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
export const WEATHERS = ['clear', 'cloudy', 'rain', 'snow', 'fog'];
const DECL = { spring: 6, summer: 21, autumn: -9, winter: -21 };
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

const GLSL = /* glsl */`
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm2(vec2 p){ return vn(p) * 0.5 + vn(p * 2.03) * 0.25 + vn(p * 4.07) * 0.125 + vn(p * 8.11) * 0.0625; }`;

function makeSky() {
  const sky = new Sky(), m = sky.material;
  Object.assign(m.uniforms, {
    uOvercast: { value: 0 }, uCloud: { value: 0.35 }, uTime: U.uTime, uNightSky: { value: 0 },
    uOverZenith: { value: new THREE.Color(0.55, 0.58, 0.62) }, uOverHorizon: { value: new THREE.Color(0.75, 0.76, 0.78) },
    uSunCol: { value: new THREE.Color(1, 1, 1) }, uMoonDir: { value: new THREE.Vector3(0, 1, 0) }, uSunUp: { value: 1 }, uEnvScale: { value: 1 }
  });
  m.fragmentShader = m.fragmentShader.replace('varying vec3 vWorldPosition;', `varying vec3 vWorldPosition;
uniform float uOvercast, uCloud, uTime, uNightSky, uSunUp, uEnvScale; uniform vec3 uOverZenith, uOverHorizon, uSunCol, uMoonDir;
${GLSL}`).replace('gl_FragColor = vec4( retColor, 1.0 );', /* glsl */`
vec3 skyc = retColor;
float hz = clamp(direction.y, 0.0, 1.0);
vec3 oc = mix(uOverHorizon, uOverZenith, pow(hz, 0.5));
skyc = mix(skyc, oc, uOvercast);
vec3 nightC = mix(vec3(0.045, 0.032, 0.03), vec3(0.003, 0.006, 0.018), pow(hz, 0.35));
skyc = mix(skyc, nightC + skyc * 0.15, uNightSky * 0.9 * (1.0 - uOvercast * 0.3));
if (uNightSky > 0.01 && direction.y > 0.0) {
  vec3 sd = direction * 260.0; vec3 cid = floor(sd);
  float hs = fract(sin(dot(cid, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
  if (hs > 0.993) {
    vec3 cc = cid + 0.5 + (vec3(fract(hs * 13.1), fract(hs * 71.7), fract(hs * 37.3)) - 0.5) * 0.6;
    float dd = length(sd - cc); float fw = max(fwidth(sd.x) + fwidth(sd.y), 0.02);
    float s = 1.0 - smoothstep(0.0, max(fw * 0.9, 0.04), dd);
    skyc += vec3(0.8, 0.85, 1.0) * s * uNightSky * (1.0 - uOvercast) * (0.4 + 2.0 * fract(hs * 91.0)) * smoothstep(0.0, 0.2, direction.y);
  }
  float md = dot(direction, normalize(uMoonDir));
  skyc += vec3(0.9, 0.92, 1.0) * smoothstep(0.99955, 0.99975, md) * 3.0 * uNightSky * (1.0 - 0.8 * uOvercast);
  skyc += vec3(0.3, 0.35, 0.5) * pow(max(md, 0.0), 300.0) * 0.4 * uNightSky;
}
if (direction.y > 0.0 && uCloud > 0.01) {
  vec2 cp = direction.xz / (direction.y + 0.12) * 1.1 + vec2(uTime * 0.0035, uTime * 0.0012);
  float c = fbm2(cp * 1.4) * 0.65 + fbm2(cp * 4.3) * 0.35;
  float cov = smoothstep(1.0 - uCloud, 1.0 - uCloud + 0.28, c);
  float fw = fwidth(cp.x) + fwidth(cp.y);
  cov *= smoothstep(0.0, 0.08, direction.y) * (1.0 - smoothstep(0.4, 1.2, fw));
  vec3 lit = mix(vec3(0.95, 0.96, 1.0), uSunCol, 0.55) * mix(0.25, 1.0, uSunUp);
  vec3 shade = mix(oc * 0.7, vec3(0.04, 0.05, 0.08), 1.0 - uSunUp);
  vec3 ccol = mix(shade, lit, smoothstep(0.35, 0.95, c));
  skyc = mix(skyc, ccol * (1.0 - 0.25 * uOvercast), cov);
}
gl_FragColor = vec4( skyc * uEnvScale, 1.0 );`);
  m.depthTest = false; m.needsUpdate = true;
  return sky;
}

export class Atmosphere {
  // opts: { lat, lon, tz (hours from UTC), shadowSize }
  constructor(renderer, scene, opts = {}) {
    this.renderer = renderer; this.scene = scene; this.lat = (opts.lat ?? 43.65) * Math.PI / 180; this.lon = opts.lon ?? -79.38; this.tz = opts.tz ?? -5;
    this.hour = 12; this.season = 'auto'; this.weather = 'auto'; this.liveWeather = 'clear'; this.decl = null; this.autoSeason = 'summer';
    this.sky = makeSky(); this.sky.scale.setScalar(18000); this.sky.frustumCulled = false; this.sky.renderOrder = -10; scene.add(this.sky);
    this.envScene = new THREE.Scene(); this.envSky = new THREE.Mesh(this.sky.geometry, this.sky.material); this.envSky.scale.setScalar(1000); this.envScene.add(this.envSky);
    this.pmrem = new THREE.PMREMGenerator(renderer); this.envRT = null;
    this.sun = new THREE.DirectionalLight(0xffffff, 3); this.sun.castShadow = true; this.shadowOn = true;
    this.shadowSize = opts.shadowSize ?? 520; const sh = this.sun.shadow; sh.mapSize.set(4096, 4096); sh.bias = -0.0004; sh.camera.near = 20; sh.camera.far = 6500;
    scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0x8899aa, 0x332a22, 0.2); scene.add(this.hemi);
    scene.fog = new THREE.Fog(0x9fb0c0, 800, 9000);
    this.sunDir = new THREE.Vector3(); this.moonDir = new THREE.Vector3(); this.lastEnvKey = ''; this.fogScale = 1; this.effWeather = 'clear'; this.effSeason = 'summer';
    this.fx = new WeatherFx(scene);
  }
  get solarNoon() { return 12 - (this.lon / 15 - this.tz); }
  dir(hour, declDeg, out) {
    const d = declDeg * Math.PI / 180, H = (hour - this.solarNoon) * 15 * Math.PI / 180, L = this.lat;
    const e = -Math.cos(d) * Math.sin(H), n = Math.sin(d) * Math.cos(L) - Math.cos(d) * Math.cos(H) * Math.sin(L), u = Math.sin(d) * Math.sin(L) + Math.cos(d) * Math.cos(H) * Math.cos(L);
    return out.set(e, u, -n).normalize();
  }
  // real calendar: declination and season from a Date
  setDate(date) {
    const N = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 864e5);
    this.autoDecl = 23.44 * Math.sin((2 * Math.PI * (284 + N)) / 365);
    const m = date.getMonth(); this.autoSeason = m >= 2 && m <= 4 ? 'spring' : m <= 7 && m >= 5 ? 'summer' : m >= 8 && m <= 10 ? 'autumn' : 'winter';
  }
  update(dt, focus, force = false) {
    this.effSeason = this.season === 'auto' ? this.autoSeason : this.season;
    const decl = this.season === 'auto' && this.autoDecl != null ? this.autoDecl : DECL[this.effSeason];
    this.dir(this.hour, decl, this.sunDir); this.dir(this.hour + 12, -decl * 0.6 + 8, this.moonDir);
    const elev = Math.asin(this.sunDir.y) * 180 / Math.PI, w = this.effWeather = this.weather === 'auto' ? this.liveWeather : this.weather;
    const overcast = w === 'clear' ? 0 : w === 'cloudy' ? 0.55 : w === 'fog' ? 0.85 : 0.92;
    const day = sm(-4, 10, elev), night = 1 - sm(-9, 3, elev), golden = sm(-3, 4, elev) * (1 - sm(6, 22, elev));
    const su = this.sky.material.uniforms;
    su.sunPosition.value.copy(this.sunDir).multiplyScalar(1000);
    su.turbidity.value = 2.4 + 6 * overcast; su.rayleigh.value = 1.6 + 1.6 * golden - 0.9 * overcast; su.mieCoefficient.value = 0.004 + 0.01 * overcast; su.mieDirectionalG.value = 0.8;
    su.uOvercast.value = overcast; su.uCloud.value = w === 'clear' ? 0.32 : w === 'cloudy' ? 0.72 : 0.9; su.uNightSky.value = night; su.uMoonDir.value.copy(this.moonDir); su.uSunUp.value = day;
    const sunCol = new THREE.Color().setRGB(1, 0.55 + 0.45 * sm(2, 25, elev), 0.3 + 0.7 * sm(4, 35, elev)); su.uSunCol.value.copy(sunCol);
    su.uOverZenith.value.copy(new THREE.Color(0.035, 0.04, 0.055)).lerp(new THREE.Color(0.62, 0.65, 0.69), day).multiplyScalar(w === 'fog' ? 1.15 : 1);
    su.uOverHorizon.value.copy(new THREE.Color(0.035, 0.04, 0.055)).lerp(new THREE.Color(0.78, 0.79, 0.8), day);
    const useMoon = elev < -2, ldir = useMoon ? this.moonDir : this.sunDir; this.sun.userData.dir = ldir;
    const sunI = 4.2 * sm(-1, 9, elev) * (1 - 0.75 * overcast), moonI = 0.13 * (1 - overcast * 0.7) * sm(0, 15, Math.asin(this.moonDir.y) * 57.3);
    this.sun.intensity = useMoon ? moonI : sunI; this.sun.color.copy(useMoon ? new THREE.Color(0.6, 0.7, 1) : sunCol);
    this.sun.castShadow = this.shadowOn && (useMoon ? moonI : sunI) > 0.05 && (!useMoon);
    this.hemi.intensity = 0.06 + 0.25 * day + 0.12 * overcast * day; this.hemi.color.setRGB(0.45 + 0.2 * day, 0.5 + 0.2 * day, 0.62 + 0.15 * day);
    const fc = new THREE.Color(0.03, 0.038, 0.06).lerp(new THREE.Color(0.2, 0.25, 0.36), sm(-12, -3, elev)).lerp(new THREE.Color(0.86, 0.66, 0.5), sm(-4, 2, elev)).lerp(new THREE.Color(0.66, 0.73, 0.8), sm(4, 18, elev));
    fc.lerp(new THREE.Color(0.52, 0.55, 0.58).multiplyScalar(0.08 + 0.92 * day), overcast * 0.85); this.scene.fog.color.copy(fc);
    this.fogScale = { clear: 1, cloudy: 0.85, rain: 0.5, snow: 0.42, fog: 0.12 }[w];
    // global state for materials
    U.uNight.value = night;
    const k = (t, v, r) => { U[t].value += (v - U[t].value) * Math.min(1, dt * r + (force ? 1 : 0)); };
    k('uAutumn', this.effSeason === 'autumn' ? 1 : 0, 2); k('uWinter', this.effSeason === 'winter' ? 1 : 0, 2);
    k('uSnow', this.effSeason === 'winter' ? (w === 'rain' ? 0.45 : 1) : (w === 'snow' ? 0.7 : 0), 0.8);
    k('uWet', w === 'rain' ? 1 : w === 'snow' ? 0.3 : w === 'fog' ? 0.35 : 0, 0.8);
    this.renderer.toneMappingExposure = (0.52 + 0.85 * night + 0.06 * golden) * (1 + 0.25 * overcast * day);
    this.fx.set(w);
    if (focus) this.updateShadow(focus);
    const key = [Math.round(elev * 1.5), w, Math.round(night * 10)].join('|');
    if (force || key !== this.lastEnvKey) {
      this.lastEnvKey = key; su.uEnvScale.value = 0.32 + 0.5 * overcast;
      const rt = this.pmrem.fromScene(this.envScene, 0, 1, 20000); su.uEnvScale.value = 1;
      if (this.envRT) this.envRT.dispose(); this.envRT = rt; this.scene.environment = rt.texture;
    }
    this.sky.position.copy(this.camPos || this.sky.position);
    return { elev, night, day, overcast };
  }
  // texel-snapped shadow frustum: no shimmer while moving
  updateShadow(focus) {
    const S = this.shadowSize, cam = this.sun.shadow.camera;
    if (cam.right !== S) { cam.left = -S; cam.right = S; cam.top = S; cam.bottom = -S; cam.updateProjectionMatrix(); }
    const dir = this.sun.userData.dir || this.sunDir, texel = (2 * S) / this.sun.shadow.mapSize.x;
    const up = Math.abs(dir.y) > 0.98 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
    const rot = new THREE.Matrix4().lookAt(new THREE.Vector3(), dir.clone().negate(), up), inv = rot.clone().transpose(), p = focus.clone().applyMatrix4(inv);
    p.x = Math.round(p.x / texel) * texel; p.y = Math.round(p.y / texel) * texel; p.applyMatrix4(rot);
    this.sun.target.position.copy(p); this.sun.position.copy(p).addScaledVector(dir, 2500);
    this.sun.target.updateMatrixWorld(); this.sun.updateMatrixWorld(); this.sun.shadow.normalBias = texel * 1.4;
  }
}

// rain & snow: instanced billboards wrapping around the camera, positions computed on the GPU
class WeatherFx {
  constructor(scene) {
    const quad = new THREE.PlaneGeometry(1, 1), g = new THREE.InstancedBufferGeometry();
    g.index = quad.index; g.attributes.position = quad.attributes.position; g.attributes.uv = quad.attributes.uv;
    const N = 9000, seed = new Float32Array(N * 4); for (let i = 0; i < seed.length; i++) seed[i] = Math.random();
    g.setAttribute('iSeed', new THREE.InstancedBufferAttribute(seed, 4)); g.instanceCount = 0;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uTime: U.uTime, uMode: { value: 0 }, uBox: { value: 60 }, uNight: U.uNight },
      vertexShader: /* glsl */`
attribute vec4 iSeed; uniform float uTime, uMode, uBox, uNight; varying vec2 vUv; varying float vA;
void main(){
  vUv = uv; float B = uBox;
  float speed = uMode < 1.5 ? 9.0 + iSeed.w * 3.0 : 1.1 + iSeed.w * 0.6;
  vec3 p = vec3(iSeed.x, 1.0 - fract(iSeed.y + uTime * speed / B), iSeed.z) * B;
  if (uMode > 1.5) { p.x += sin(uTime * 0.7 + iSeed.w * 30.0) * 1.2; p.z += cos(uTime * 0.6 + iSeed.x * 20.0) * 1.2; }
  vec3 cam = cameraPosition; p = cam + mod(p - cam + B * 0.5, B) - B * 0.5; p.y = cam.y + (fract((p.y - cam.y) / B + 0.5) - 0.5) * B;
  vec4 mv = viewMatrix * vec4(p, 1.0); vec2 sz = uMode < 1.5 ? vec2(0.012, 0.75) : vec2(0.05, 0.05);
  if (uMode < 1.5) { vec4 top = viewMatrix * vec4(p + vec3(0.0, sz.y, 0.0), 1.0); vec2 axis = top.xy - mv.xy; vec2 side = normalize(vec2(-axis.y, axis.x) + 1e-5) * sz.x; mv.xy += side * position.x * 2.0 + axis * (position.y + 0.5); }
  else mv.xy += position.xy * sz * 2.0;
  float d = -mv.z; vA = smoothstep(0.3, 2.0, d) * (1.0 - smoothstep(B * 0.3, B * 0.5, d)); gl_Position = projectionMatrix * mv;
}`,
      fragmentShader: /* glsl */`
uniform float uMode, uNight; varying vec2 vUv; varying float vA;
void main(){ vec2 c = vUv * 2.0 - 1.0; float a = uMode < 1.5 ? (1.0 - abs(c.x)) * 0.35 : (1.0 - smoothstep(0.3, 1.0, length(c)));
  vec3 col = mix(vec3(0.8, 0.85, 0.9), vec3(0.35, 0.4, 0.5), uNight); gl_FragColor = vec4(col, a * vA * (uMode < 1.5 ? 0.6 : 0.9)); }`,
      transparent: true, depthWrite: false, depthTest: false
    });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 30; this.geo = g; this.N = N; scene.add(this.mesh);
  }
  set(w) { const mode = w === 'rain' ? 1 : w === 'snow' ? 2 : 0; this.mat.uniforms.uMode.value = mode; this.mat.uniforms.uBox.value = mode === 2 ? 50 : 40; this.geo.instanceCount = mode ? this.N : 0; this.mesh.visible = mode > 0; }
}

// Adds snow cover (on up-facing surfaces), wet-surface darkening/gloss and optional extras to a standard material.
export function patchWeather(mat, { snow = 1, wet = 1, key = 'w' } = {}) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    sh.uniforms.uSnow = U.uSnow; sh.uniforms.uWet = U.uWet;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWN;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWN = normalize(mat3(modelMatrix) * normal);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vWN; uniform float uSnow, uWet;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      { float upk = smoothstep(0.65, 0.95, vWN.y);
        diffuseColor.rgb *= 1.0 - 0.38 * uWet * ${wet.toFixed(2)} * upk;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9, 0.93, 1.0), uSnow * ${snow.toFixed(2)} * upk); }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      roughnessFactor = mix(roughnessFactor, 0.1, uWet * ${wet.toFixed(2)} * smoothstep(0.65, 0.95, vWN.y) * (1.0 - uSnow * ${snow.toFixed(2)}));`);
  };
  mat.customProgramCacheKey = () => key + snow + wet + (prev ? prev.toString().length : 0);
  return mat;
}

// Open-Meteo current conditions (free, no key, CORS-enabled) -> one of WEATHERS
export async function liveWeather(lat, lon) {
  const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=weather_code,cloud_cover,temperature_2m`);
  const c = (await r.json()).current, wc = c.weather_code, cc = c.cloud_cover;
  let w = 'clear';
  if (wc === 45 || wc === 48) w = 'fog'; else if ((wc >= 71 && wc <= 77) || wc === 85 || wc === 86) w = 'snow';
  else if ((wc >= 51 && wc <= 67) || (wc >= 80 && wc <= 82) || wc >= 95) w = 'rain'; else if (wc === 3 || cc > 65) w = 'cloudy';
  return { weather: w, temp: c.temperature_2m, code: wc };
}

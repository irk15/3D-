// atmosphere.js — sky, sun & moon, shadows, environment lighting, fog, seasons and weather.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { U, enu2w, smooth } from './core.js';
import { GLSL_COMMON } from './shaders.js';

const LAT_R = 45.5 * Math.PI / 180;
const DECL = { spring: 6, summer: 21, autumn: -9, winter: -21 };
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
export const WEATHERS = ['clear', 'cloudy', 'rain', 'snow', 'fog'];

// sun direction for Montreal at a solar hour and declination, returned in world space
export function sunDirection(hour, declDeg, out = new THREE.Vector3()) {
  const d = declDeg * Math.PI / 180, H = (hour - 12.4) * 15 * Math.PI / 180;
  const e = -Math.cos(d) * Math.sin(H);
  const n = Math.sin(d) * Math.cos(LAT_R) - Math.cos(d) * Math.cos(H) * Math.sin(LAT_R);
  const up = Math.sin(d) * Math.sin(LAT_R) + Math.cos(d) * Math.cos(H) * Math.cos(LAT_R);
  return out.copy(enu2w(e, n, up)).normalize();
}

function makeSky() {
  const sky = new Sky();
  const m = sky.material;
  Object.assign(m.uniforms, {
    uOvercast: { value: 0 }, uCloud: { value: 0.35 }, uTime: U.uTime, uNightSky: { value: 0 },
    uOverZenith: { value: new THREE.Color(0.55, 0.58, 0.62) }, uOverHorizon: { value: new THREE.Color(0.75, 0.76, 0.78) },
    uSunCol: { value: new THREE.Color(1, 1, 1) }, uMoonDir: { value: new THREE.Vector3(0, 1, 0) }, uSunUp: { value: 1 }, uEnvScale: { value: 1 },
  });
  m.fragmentShader = m.fragmentShader.replace('varying vec3 vWorldPosition;', `varying vec3 vWorldPosition;
uniform float uOvercast, uCloud, uTime, uNightSky, uSunUp, uEnvScale; uniform vec3 uOverZenith, uOverHorizon, uSunCol, uMoonDir;
${GLSL_COMMON}`).replace('gl_FragColor = vec4( retColor, 1.0 );', /* glsl */`
vec3 skyc = retColor;
float hz = clamp(direction.y, 0.0, 1.0);
vec3 oc = mix(uOverHorizon, uOverZenith, pow(hz, 0.5));
skyc = mix(skyc, oc, uOvercast);
// deep navy night with a warm light-pollution glow over the city
vec3 nightC = mix(vec3(0.045, 0.032, 0.03), vec3(0.003, 0.006, 0.018), pow(hz, 0.35));
skyc = mix(skyc, nightC + skyc * 0.15, uNightSky * 0.9 * (1.0 - uOvercast * 0.3));
// stars (static, sized by pixel footprint so they never twinkle-alias)
if (uNightSky > 0.01 && direction.y > 0.0) {
  vec3 sd = direction * 260.0; vec3 cid = floor(sd);
  float hs = fract(sin(dot(cid, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
  if (hs > 0.993) {
    vec3 cc = cid + 0.5 + (vec3(fract(hs * 13.1), fract(hs * 71.7), fract(hs * 37.3)) - 0.5) * 0.6;
    float dd = length(sd - cc); float fw = max(fwidth(sd.x) + fwidth(sd.y), 0.02);
    float s = 1.0 - smoothstep(0.0, max(fw * 0.9, 0.04), dd);
    skyc += vec3(0.8, 0.85, 1.0) * s * uNightSky * (1.0 - uOvercast) * (0.4 + 2.0 * fract(hs * 91.0)) * smoothstep(0.0, 0.2, direction.y);
  }
  // moon
  float md = dot(direction, normalize(uMoonDir));
  skyc += vec3(0.9, 0.92, 1.0) * smoothstep(0.99955, 0.99975, md) * 3.0 * uNightSky * (1.0 - 0.8 * uOvercast);
  skyc += vec3(0.3, 0.35, 0.5) * pow(max(md, 0.0), 300.0) * 0.4 * uNightSky;
}
// procedural cloud deck
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
  m.needsUpdate = true;
  return sky;
}

export class Atmosphere {
  constructor(renderer, scene) {
    this.renderer = renderer; this.scene = scene;
    this.hour = 16.8; this.season = 'autumn'; this.weather = 'clear';
    this.sky = makeSky(); this.sky.scale.setScalar(18000); this.sky.frustumCulled = false;
    scene.add(this.sky);
    this.envScene = new THREE.Scene();
    this.envSky = new THREE.Mesh(this.sky.geometry, this.sky.material); this.envSky.scale.setScalar(1000);
    this.envScene.add(this.envSky);
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envRT = null;
    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(4096, 4096);
    this.sun.shadow.bias = -0.00025;
    this.sun.shadow.camera.near = 10; this.sun.shadow.camera.far = 7000;
    scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0x8899aa, 0x332a22, 0.2);
    scene.add(this.hemi);
    scene.fog = new THREE.FogExp2(0x9fb0c0, 0.00012);
    this.sunDir = new THREE.Vector3(); this.moonDir = new THREE.Vector3();
    this.shadowSize = 300; this.fogMul = 1; this.lastEnvKey = '';
    this.weatherFx = new WeatherFx(scene);
    this.seasonBlend = { autumn: 1, winter: 0, snow: 0 };
    this.vr = false;
  }
  setShadowQuality(size, map) {
    this.shadowSize = size;
    if (this.sun.shadow.mapSize.x !== map) {
      this.sun.shadow.mapSize.set(map, map);
      if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
    }
  }
  // texel-snapped shadow frustum around the point of interest (no shimmering when moving)
  updateShadow(focus) {
    const S = this.shadowSize, cam = this.sun.shadow.camera;
    if (cam.right !== S) { cam.left = -S; cam.right = S; cam.top = S; cam.bottom = -S; cam.updateProjectionMatrix(); }
    const dir = this.sun.userData.dir || this.sunDir;
    const texel = (2 * S) / this.sun.shadow.mapSize.x;
    const up = Math.abs(dir.y) > 0.98 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
    const rot = new THREE.Matrix4().lookAt(new THREE.Vector3(), dir.clone().negate(), up);
    const inv = rot.clone().transpose();
    const p = focus.clone().applyMatrix4(inv);
    p.x = Math.round(p.x / texel) * texel; p.y = Math.round(p.y / texel) * texel;
    p.applyMatrix4(rot);
    this.sun.target.position.copy(p);
    this.sun.position.copy(p).addScaledVector(dir, 3000);
    this.sun.target.updateMatrixWorld(); this.sun.updateMatrixWorld();
    this.sun.shadow.normalBias = texel * 1.4;
  }
  update(dt, focus, force = false) {
    const decl = DECL[this.season];
    sunDirection(this.hour, decl, this.sunDir);
    sunDirection(this.hour + 12, -decl * 0.6 + 8, this.moonDir);
    const elev = Math.asin(this.sunDir.y) * 180 / Math.PI;
    const w = this.weather;
    const overcast = w === 'clear' ? 0 : w === 'cloudy' ? 0.55 : w === 'fog' ? 0.85 : 0.92;
    const day = smooth(-4, 10, elev);
    const night = 1 - smooth(-9, 3, elev);
    const golden = smooth(-3, 4, elev) * (1 - smooth(6, 22, elev));
    // sky
    const su = this.sky.material.uniforms;
    su.sunPosition.value.copy(this.sunDir).multiplyScalar(1000);
    su.turbidity.value = 2.4 + 6 * overcast; su.rayleigh.value = 1.1 + 1.6 * golden - 0.6 * overcast;
    su.mieCoefficient.value = 0.004 + 0.01 * overcast; su.mieDirectionalG.value = 0.8;
    su.uOvercast.value = overcast; su.uCloud.value = w === 'clear' ? 0.32 : w === 'cloudy' ? 0.72 : 0.9;
    su.uNightSky.value = night; su.uMoonDir.value.copy(this.moonDir); su.uSunUp.value = day;
    const sunCol = new THREE.Color().setRGB(1, 0.55 + 0.45 * smooth(2, 25, elev), 0.3 + 0.7 * smooth(4, 35, elev));
    su.uSunCol.value.copy(sunCol);
    const ocDay = new THREE.Color(0.62, 0.65, 0.69), ocNight = new THREE.Color(0.035, 0.04, 0.055);
    su.uOverZenith.value.copy(ocNight).lerp(ocDay, day).multiplyScalar(w === 'fog' ? 1.15 : 1);
    su.uOverHorizon.value.copy(ocNight).lerp(new THREE.Color(0.78, 0.79, 0.8), day);
    // lights: sun by day, moon by night (the shadow-casting light is whichever dominates)
    const useMoon = elev < -2;
    const ldir = useMoon ? this.moonDir : this.sunDir;
    this.sun.userData.dir = ldir;
    const sunI = 4.2 * smooth(-1, 9, elev) * (1 - 0.75 * overcast);
    const moonI = 0.13 * (1 - overcast * 0.7) * smooth(0, 15, Math.asin(this.moonDir.y) * 57.3);
    this.sun.intensity = useMoon ? moonI : sunI;
    this.sun.color.copy(useMoon ? new THREE.Color(0.6, 0.7, 1.0) : sunCol);
    this.sun.castShadow = (useMoon ? moonI : sunI) > 0.05;
    this.hemi.intensity = 0.06 + 0.25 * day + 0.12 * overcast * day;
    this.hemi.color.setRGB(0.45 + 0.2 * day, 0.5 + 0.2 * day, 0.62 + 0.15 * day);
    // fog colour follows the horizon
    const fogDay = new THREE.Color(0.66, 0.73, 0.80), fogGold = new THREE.Color(0.86, 0.66, 0.50), fogBlue = new THREE.Color(0.20, 0.25, 0.36), fogNight = new THREE.Color(0.030, 0.038, 0.06);
    const fc = fogNight.clone().lerp(fogBlue, smooth(-12, -3, elev)).lerp(fogGold, smooth(-4, 2, elev)).lerp(fogDay, smooth(4, 18, elev));
    const grey = new THREE.Color(0.52, 0.55, 0.58).multiplyScalar(0.08 + 0.92 * day);
    fc.lerp(grey, overcast * 0.85);
    this.scene.fog.color.copy(fc);
    // sky colours for cheap reflections in glass and water
    const zen = new THREE.Color(0.006, 0.01, 0.025).lerp(new THREE.Color(0.10, 0.14, 0.32), smooth(-12, -2, elev)).lerp(new THREE.Color(0.22, 0.32, 0.62), smooth(-2, 8, elev)).lerp(new THREE.Color(0.16, 0.34, 0.80), smooth(8, 30, elev));
    zen.lerp(grey.clone().multiplyScalar(0.9), overcast * 0.85);
    U.uSkyZen.value.copy(zen).multiplyScalar(1.6);
    U.uSkyHor.value.copy(fc).multiplyScalar(1.5);
    const dens = { clear: 0.000145, cloudy: 0.00019, rain: 0.00036, snow: 0.00044, fog: 0.0012 }[w];
    this.scene.fog.density = dens * this.fogMul;
    // global shader state
    U.uNight.value = night;
    const h = this.hour, late = h > 23 || h < 5 ? 0.55 : 1;
    U.uLit.value = (0.08 + 0.4 * night) * late;
    const autumnT = this.season === 'autumn' ? 1 : 0, winterT = this.season === 'winter' ? 1 : 0;
    U.uAutumn.value += (autumnT - U.uAutumn.value) * Math.min(1, dt * 2 + (force ? 1 : 0));
    U.uWinter.value += (winterT - U.uWinter.value) * Math.min(1, dt * 2 + (force ? 1 : 0));
    const snowT = this.season === 'winter' ? (w === 'rain' ? 0.45 : 1) : (w === 'snow' ? 0.7 : 0);
    U.uSnow.value += (snowT - U.uSnow.value) * Math.min(1, dt * 0.8 + (force ? 1 : 0));
    const wetT = w === 'rain' ? 1 : w === 'snow' ? 0.3 : w === 'fog' ? 0.35 : 0;
    U.uWet.value += (wetT - U.uWet.value) * Math.min(1, dt * 0.8 + (force ? 1 : 0));
    U.uSunDir.value.copy(this.sunDir);
    // exposure: brighter at night so the city lights carry the image
    this.renderer.toneMappingExposure = (0.52 + 0.85 * night + 0.06 * golden) * (1 + 0.25 * overcast * day);
    this.weatherFx.set(w, this.vr);
    if (focus) this.updateShadow(focus);
    // environment map: regenerate only when the look changed noticeably
    const key = [Math.round(elev * 1.5), w, Math.round(night * 10)].join('|');
    if (force || key !== this.lastEnvKey) {
      this.lastEnvKey = key;
      su.uEnvScale.value = 0.32 + 0.5 * overcast;      // the sky is very bright; keep the sun as the key light
      const rt = this.pmrem.fromScene(this.envScene, 0, 1, 20000);
      su.uEnvScale.value = 1;
      if (this.envRT) this.envRT.dispose();
      this.envRT = rt; this.scene.environment = rt.texture;
    }
    return { elev, night, day, overcast };
  }
}

// ---------------------------------------------------------------- rain & snow
// Instanced billboards that wrap around the camera in a box; positions are computed on the GPU.
class WeatherFx {
  constructor(scene) {
    const quad = new THREE.PlaneGeometry(1, 1);
    const g = new THREE.InstancedBufferGeometry();
    g.index = quad.index; g.attributes.position = quad.attributes.position; g.attributes.uv = quad.attributes.uv;
    const N = 9000, seed = new Float32Array(N * 4);
    for (let i = 0; i < N * 4; i++) seed[i] = Math.random();
    g.setAttribute('iSeed', new THREE.InstancedBufferAttribute(seed, 4));
    g.instanceCount = 0;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uTime: U.uTime, uMode: { value: 0 }, uBox: { value: 60 }, uNight: U.uNight },
      vertexShader: /* glsl */`
attribute vec4 iSeed; uniform float uTime, uMode, uBox, uNight; varying vec2 vUv; varying float vA;
void main(){
  vUv = uv;
  float B = uBox;
  float speed = uMode < 1.5 ? 9.0 + iSeed.w * 3.0 : 1.1 + iSeed.w * 0.6;
  vec3 p = vec3(iSeed.x, 1.0 - fract(iSeed.y + uTime * speed / B), iSeed.z) * B;
  if (uMode > 1.5) { p.x += sin(uTime * 0.7 + iSeed.w * 30.0) * 1.2; p.z += cos(uTime * 0.6 + iSeed.x * 20.0) * 1.2; }
  vec3 cam = cameraPosition;
  p = cam + mod(p - cam + B * 0.5, B) - B * 0.5;
  p.y = cam.y + (fract((p.y - cam.y) / B + 0.5) - 0.5) * B;
  vec4 mv = viewMatrix * vec4(p, 1.0);
  vec2 sz = uMode < 1.5 ? vec2(0.012, 0.75) : vec2(0.05, 0.05);
  if (uMode < 1.5) {                    // rain streaks stay vertical in world space
    vec4 top = viewMatrix * vec4(p + vec3(0.0, sz.y, 0.0), 1.0);
    vec2 axis = top.xy - mv.xy; vec2 side = normalize(vec2(-axis.y, axis.x) + 1e-5) * sz.x;
    mv.xy += side * position.x * 2.0 + axis * (position.y + 0.5);
  } else mv.xy += position.xy * sz * 2.0;
  float d = -mv.z;
  vA = smoothstep(0.3, 2.0, d) * (1.0 - smoothstep(B * 0.3, B * 0.5, d));
  gl_Position = projectionMatrix * mv;
}`,
      fragmentShader: /* glsl */`
uniform float uMode, uNight; varying vec2 vUv; varying float vA;
void main(){
  vec2 c = vUv * 2.0 - 1.0;
  float a = uMode < 1.5 ? (1.0 - abs(c.x)) * 0.35 : (1.0 - smoothstep(0.3, 1.0, length(c)));
  vec3 col = mix(vec3(0.8, 0.85, 0.9), vec3(0.35, 0.4, 0.5), uNight);
  gl_FragColor = vec4(col, a * vA * (uMode < 1.5 ? 0.6 : 0.9));
}`,
      transparent: true, depthWrite: false,
    });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 30;
    this.geo = g; this.N = N;
    scene.add(this.mesh);
  }
  set(w, vr) {
    const mode = w === 'rain' ? 1 : w === 'snow' ? 2 : 0;
    this.mat.uniforms.uMode.value = mode;
    this.mat.uniforms.uBox.value = mode === 2 ? 50 : 40;
    this.geo.instanceCount = mode ? (vr ? 3500 : this.N) : 0;
    this.mesh.visible = mode > 0;
  }
}

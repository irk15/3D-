// shaders.js — global height fog + every custom material.
// Anti-flicker rules baked in here:
//  * roads, sidewalks, markings, alleys, parks and lamp pools are computed in ONE ground shader
//    (no stacked planes, no decals);
//  * windows/doors/shopfronts live inside the facade shader (no planes on walls);
//  * every high-frequency pattern fades to its average colour using screen-space derivatives,
//    so nothing shimmers in the distance or between the two VR eyes;
//  * LOD transitions use alpha-to-coverage on the MSAA buffer instead of popping.
import * as THREE from 'three';
import { U, ART_U, ART_V, LAT, HW_LOCAL, HW_OLD, SIDEWALK, ALLEY_HW } from './core.js';

// ---------------------------------------------------------------- height fog (all materials)
THREE.ShaderChunk.fog_pars_vertex = `#ifdef USE_FOG
varying float vFogDepth;
varying vec3 vFogWorld;
#endif`;
THREE.ShaderChunk.fog_vertex = `#ifdef USE_FOG
vFogDepth = - mvPosition.z;
vec4 fogW = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
fogW = instanceMatrix * fogW;
#endif
vFogWorld = ( modelMatrix * fogW ).xyz;
#endif`;
THREE.ShaderChunk.fog_pars_fragment = `#ifdef USE_FOG
uniform vec3 fogColor;
varying float vFogDepth;
varying vec3 vFogWorld;
#ifdef FOG_EXP2
uniform float fogDensity;
#else
uniform float fogNear;
uniform float fogFar;
#endif
#endif`;
THREE.ShaderChunk.fog_fragment = `#ifdef USE_FOG
vec3 fogRay = vFogWorld - cameraPosition;
float fogDist = length( fogRay );
#ifdef FOG_EXP2
const float FH = 1.0 / 380.0;
float fy0 = max( cameraPosition.y, 0.0 );
float fdy = fogRay.y;
float favg = abs( fdy ) > 0.5 ? ( exp( -fy0 * FH ) - exp( -( fy0 + fdy ) * FH ) ) / ( fdy * FH ) : exp( -fy0 * FH );
float fod = fogDensity * fogDist * clamp( favg, 0.0, 3.0 );
float fogFactor = 1.0 - exp( - fod * fod );
#else
float fogFactor = smoothstep( fogNear, fogFar, fogDist );
#endif
gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`;

// ---------------------------------------------------------------- shared GLSL helpers
export const GLSL_COMMON = /* glsl */`
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float h11(float p){ return fract(sin(p * 127.1) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm2(vec2 p){ return vn(p) * 0.5 + vn(p * 2.03) * 0.25 + vn(p * 4.07) * 0.125 + vn(p * 8.11) * 0.0625; }
// anti-aliased band: 1 inside [a,b] of scalar x
float band(float x, float a, float b){ float w = fwidth(x) * 0.8 + 1e-5; return smoothstep(a - w, a + w, x) * (1.0 - smoothstep(b - w, b + w, x)); }
float stepAA(float e, float x){ float w = fwidth(x) * 0.8 + 1e-5; return smoothstep(e - w, e + w, x); }
// how visible a feature of size s (metres) is at this pixel: 1 = resolvable, 0 = sub-pixel -> use average
float detailVis(float s, float fw){ return 1.0 - smoothstep(0.35, 1.0, fw / s); }
`;

function artTable(tbl, fn, def) {
  let s = `float ${fn}(float k){`;
  for (const [k, v] of Object.entries(tbl)) s += `if(abs(k-(${(+k).toFixed(1)}))<0.5) return ${v.toFixed(2)};`;
  return s + `return ${def.toFixed(2)};}\n`;
}
export const GLSL_LATTICE = artTable(ART_U, 'artU', HW_LOCAL) + artTable(ART_V, 'artV', HW_LOCAL) + `
const float SU=${LAT.SU.toFixed(3)}, UOFF=${LAT.UOFF.toFixed(3)}, SV=${LAT.SV.toFixed(3)}, VOFF=${LAT.VOFF.toFixed(3)};
const float SU2=${LAT.SU2.toFixed(4)}, UOFF2=${LAT.UOFF2.toFixed(3)}, SV2=${LAT.SV2.toFixed(3)}, VOFF2=${LAT.VOFF2.toFixed(3)};
const float HWO=${HW_OLD.toFixed(2)}, SIDEW=${SIDEWALK.toFixed(2)}, ALLEYHW=${ALLEY_HW.toFixed(2)};
`;

function patch(mat, fn) { mat.onBeforeCompile = fn; mat.customProgramCacheKey = () => mat.name; return mat; }

// ---------------------------------------------------------------- GROUND
export function groundMaterial() {
  const m = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, name: 'ground' });
  m.envMapIntensity = 0.8;
  patch(m, (sh) => {
    Object.assign(sh.uniforms, { uMaskA: U.uMaskA, uMaskB: U.uMaskB, uDom: U.uDom, uTime: U.uTime, uNight: U.uNight, uSnow: U.uSnow, uWet: U.uWet, uAutumn: U.uAutumn, uDetail: U.uDetail });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vGW;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvGW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform sampler2D uMaskA, uMaskB; uniform vec4 uDom; uniform float uTime, uNight, uSnow, uWet, uAutumn, uDetail;
varying vec3 vGW;
${GLSL_COMMON}
${GLSL_LATTICE}
vec3 gEmit; float gRough;
`).replace('#include <map_fragment>', GROUND_FRAG)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = gRough;')
      .replace('#include <emissivemap_fragment>', 'totalEmissiveRadiance += gEmit;');
  });
  return m;
}

const GROUND_FRAG = /* glsl */`
vec2 g = vec2(vGW.x, -vGW.z);
vec2 muv = (g - uDom.xy) / uDom.zw;
bool inDom = muv.x >= 0.0 && muv.y >= 0.0 && muv.x <= 1.0 && muv.y <= 1.0;
vec4 MA = texture2D(uMaskA, muv), MB = texture2D(uMaskB, muv);
float ws = (MA.r * 255.0 - 128.0) * 0.25, ps = (MA.g * 255.0 - 128.0) * 0.25, fs = (MA.b * 255.0 - 128.0) * 0.25, rs = (MB.r * 255.0 - 128.0) * 0.25;
float did = 0.0;
if (inDom) did = floor(texelFetch(uMaskB, ivec2(clamp(muv, 0.0, 0.99999) * 4096.0), 0).g * 255.0 / 16.0);
float fwp = max(fwidth(g.x), fwidth(g.y));            // metres per pixel here
float nrmY = normalize(cross(dFdx(vGW), dFdy(vGW))).y; // geometric slope
nrmY = abs(nrmY);

// ---- street grid
bool grid = did > 0.5 && did != 13.0 && did != 14.0 && did != 15.0 && ws > 0.0;
float gridW = grid ? (1.0 - stepAA(0.0, ps)) * (1.0 - stepAA(0.0, fs)) : 0.0;
bool old = did > 1.5 && did < 2.5;
float lu, lv, hu, hv, mV, kU;
if (old) { kU = floor((g.x - UOFF2) / SU2 + 0.5); lu = UOFF2 + SU2 * kU; hu = HWO; mV = floor((g.y - VOFF2) / SV2 + 0.5); lv = VOFF2 + SV2 * mV; hv = abs(mV + 4.0) < 0.5 ? 7.0 : HWO; }
else { kU = floor((g.x - UOFF) / SU + 0.5); lu = UOFF + SU * kU; hu = artU(kU); mV = floor((g.y - VOFF) / SV + 0.5); lv = VOFF + SV * mV; hv = artV(mV); }
float du = g.x - lu, dv = g.y - lv;
float eU = abs(du) - hu, eV = abs(dv) - hv;
float eL = gridW > 0.001 ? min(eU, eV) : 1e4;
float eR = -rs;
float e = min(eL, eR);
float road = 1.0 - stepAA(0.0, e);
float curb = band(e, 0.0, 0.22) * (eL < eR ? 1.0 : 0.0);
float side = stepAA(0.0, eL) * (1.0 - stepAA(SIDEW, eL)) * gridW;
bool alleyD = did == 3.0 || did == 5.0 || did == 6.0 || did == 7.0 || did == 9.0;
float alley = 0.0;
if (alleyD && !old) { float da = SU * 0.5 - abs(du); alley = (1.0 - stepAA(ALLEYHW, da)) * stepAA(SIDEW, eV) * gridW; }

// ---- base materials
float n1 = fbm2(g * 0.11), n2 = vn(g * 1.7), n3 = vn(g * 0.013);
vec3 col; float rough = 0.95;
// interior of blocks / open land
if (!inDom) {
  col = mix(vec3(0.20, 0.24, 0.12), vec3(0.30, 0.28, 0.20), fbm2(g * 0.0021));
} else if (did == 14.0) {        // plazas: granite paving
  vec2 t = fract(g / 2.0); float j = band(min(t.x, t.y), 0.0, 0.035) * detailVis(0.07, fwp);
  col = mix(vec3(0.52, 0.51, 0.49), vec3(0.46, 0.45, 0.44), h21(floor(g / 2.0))) * (1.0 - 0.25 * j);
  col *= 0.86 + 0.16 * step(0.5, fract((floor(g.x / 18.0) + floor(g.y / 18.0)) * 0.5)) * detailVis(4.0, fwp) + 0.08 * fbm2(g * 0.01);
  rough = 0.75;
} else if (did == 8.0) {         // port: concrete slabs
  vec2 t = fract(g / 6.0); float j = band(min(t.x, t.y), 0.0, 0.01) * detailVis(0.06, fwp);
  col = vec3(0.42, 0.41, 0.39) * (0.8 + 0.25 * n1) * (1.0 - 0.3 * j); col = mix(col, vec3(0.36, 0.28, 0.22), smoothstep(0.62, 0.8, n3) * 0.5);
  rough = 0.9;
} else if (did == 1.0 || did == 12.0 || did == 2.0) {   // dense city: paved courts
  col = mix(vec3(0.38, 0.37, 0.35), vec3(0.30, 0.31, 0.27), n1);
} else {                          // yards and lawns
  col = mix(vec3(0.17, 0.24, 0.09), vec3(0.27, 0.27, 0.15), n1);
  col = mix(col, vec3(0.30, 0.26, 0.20), smoothstep(0.55, 0.75, n2) * 0.35);
}
// parks: mown grass with a gently curving path network
float parkW = stepAA(0.0, ps) * (inDom ? 1.0 : 0.0);
if (parkW > 0.0) {
  vec3 grass = mix(vec3(0.16, 0.27, 0.08), vec3(0.24, 0.33, 0.12), n1);
  grass *= 0.92 + 0.08 * band(fract(g.x / 6.0), 0.0, 0.5) * detailVis(3.0, fwp);
  float pth = abs(fbm2(g * 0.006) - 0.5);
  float path = (1.0 - stepAA(0.006 + 0.8 * fwp * 0.0, pth)) * detailVis(1.2, fwp);
  grass = mix(grass, vec3(0.55, 0.50, 0.43), path * 0.9);
  col = mix(col, grass, parkW);
}
float forW = stepAA(0.0, fs) * (inDom ? 1.0 : 0.0);
col = mix(col, mix(vec3(0.11, 0.12, 0.06), vec3(0.20, 0.15, 0.08), n1), forW);
// sidewalks: concrete with expansion joints
if (side > 0.0) {
  float jx = band(fract(g.x / 1.6), 0.0, 0.025), jy = band(fract(g.y / 1.6), 0.0, 0.025);
  float joint = max(jx, jy) * detailVis(0.05, fwp);
  vec3 sw = vec3(0.50, 0.49, 0.47) * (0.9 + 0.12 * n2) * (1.0 - 0.35 * joint);
  if (old) sw = vec3(0.47, 0.44, 0.40) * (0.9 + 0.1 * n2);
  col = mix(col, sw, side);
  rough = mix(rough, 0.85, side);
}
// alleys (ruelles): patched concrete, sometimes green ("ruelles vertes")
if (alley > 0.0) {
  float greenAlley = step(0.72, h21(vec2(kU, mV) + 3.1));
  vec3 al = mix(vec3(0.33, 0.32, 0.30), vec3(0.20, 0.27, 0.11), greenAlley * (0.5 + 0.5 * n1));
  col = mix(col, al, alley);
}
// roadway
if (road > 0.0) {
  vec3 asph = vec3(0.105, 0.106, 0.11) * (0.82 + 0.35 * n1) * (0.93 + 0.12 * n2);
  asph = mix(asph, vec3(0.16, 0.16, 0.16), smoothstep(0.66, 0.8, fbm2(g * 0.05)) * 0.6);  // patches
  if (old) {   // Old Montreal cobblestone (setts), fading to its average tone when sub-pixel
    vec2 c = g / vec2(0.24, 0.14); c.x += step(1.0, mod(floor(c.y), 2.0)) * 0.5;
    vec2 cf = fract(c); float mortar = 1.0 - band(cf.x, 0.08, 0.92) * band(cf.y, 0.1, 0.9);
    float vis = detailVis(0.14, fwp);
    vec3 stone = vec3(0.30, 0.28, 0.26) * (0.75 + 0.5 * h21(floor(c)));
    asph = mix(vec3(0.23, 0.22, 0.20), mix(stone, vec3(0.12, 0.115, 0.11), mortar), vis);
  }
  // markings (grid streets only)
  float mk = 0.0; vec3 mkc = vec3(0.86);
  if (gridW > 0.5 && !old && eL < eR + 0.01) {
    bool onU = eU < eV;
    float a = onU ? du : dv, along = onU ? g.y : g.x, hw = onU ? hu : hv, across = onU ? dv : du, hwX = onU ? hv : hu;
    float outsideX = stepAA(hwX + 0.2, abs(across));
    if (hw > 6.0) {
      float dy = band(abs(a), 0.08, 0.22);                       // double yellow
      float dash = band(abs(abs(a) - hw * 0.5), 0.0, 0.07) * step(fract(along / 9.0), 0.42);
      mk = max(mk, dy * outsideX); mkc = mix(mkc, vec3(0.85, 0.66, 0.12), dy);
      mk = max(mk, dash * outsideX);
    }
    // zebra crossings and stop lines near intersections
    float ax = abs(across) - hwX;
    float zone = band(ax, 0.6, 3.6) * (1.0 - stepAA(hw - 0.4, abs(a)));
    float zeb = zone * band(fract(along / 1.1), 0.0, 0.5);
    float stopl = band(ax, 4.2, 4.6) * (1.0 - stepAA(hw - 0.3, abs(a)));
    mk = max(mk, max(zeb, stopl));
    mk *= detailVis(0.25, fwp);
  }
  asph = mix(asph, mkc * (0.85 + 0.1 * n2), mk * 0.9);
  col = mix(col, asph, road);
  rough = mix(rough, mix(0.9, 0.55, mk), road);
}
col = mix(col, vec3(0.58, 0.57, 0.55), curb * detailVis(0.2, fwp));
// steep banks and quay walls: dressed stone courses
float steep = 1.0 - smoothstep(0.55, 0.8, nrmY);
if (steep > 0.0) {
  float course = band(fract(vGW.y / 0.6), 0.0, 0.06) * detailVis(0.04, fwp);
  vec3 stoneW = vec3(0.36, 0.35, 0.33) * (0.85 + 0.2 * n2) * (1.0 - 0.3 * course);
  col = mix(col, stoneW, steep);
}
// under water: river bed
float bed = 1.0 - smoothstep(-0.5, 0.6, vGW.y);
col = mix(col, vec3(0.13, 0.12, 0.09), bed);

// ---- seasons and weather
float flatM = smoothstep(0.75, 0.95, nrmY);
float snowMask = uSnow * flatM * (1.0 - bed);
float onPave = max(road, side * 0.6);
snowMask *= mix(1.0, side > 0.5 ? 0.75 : 0.10 + 0.55 * (1.0 - smoothstep(0.0, 2.2, -e)) * smoothstep(0.45, 0.7, n1), onPave);
snowMask *= 0.85 + 0.15 * n1;
vec3 snowC = mix(vec3(0.88, 0.9, 0.95), vec3(0.6, 0.58, 0.55), onPave * 0.6);
col = mix(col, snowC, snowMask);
rough = mix(rough, 0.75, snowMask);
col = mix(col, col * vec3(1.15, 0.85, 0.55), uAutumn * parkW * 0.25);
float wet = uWet * (1.0 - snowMask);
float puddle = smoothstep(0.58, 0.66, fbm2(g * 0.09)) * max(road, side);
col *= 1.0 - 0.38 * wet;
rough = mix(rough, mix(0.32, 0.04, puddle), wet * max(road, side * 0.8));

// ---- night: street-lamp pools (procedural, one per lamp position along every grid street)
vec3 emit = vec3(0.0);
if (uNight > 0.01 && gridW > 0.5 && eL < 18.0) {
  float pool = 0.0;
  float off = (old ? HWO : max(hu, hv)) + 0.7;
  // lamps along the N-S street
  {
    float sp = old ? 22.0 : 32.0;
    float l1 = floor(g.y / sp + 0.5) * sp, l2 = floor((g.y - sp * 0.5) / sp + 0.5) * sp + sp * 0.5;
    vec2 p1 = vec2(lu + hu + 0.7, l1), p2 = vec2(lu - hu - 0.7, l2);
    float d1 = dot(g - p1, g - p1), d2 = dot(g - p2, g - p2);
    pool += exp(-d1 / 70.0) + exp(-d2 / 70.0);
  }
  {
    float sp = old ? 22.0 : 32.0;
    float l1 = floor(g.x / sp + 0.5) * sp, l2 = floor((g.x - sp * 0.5) / sp + 0.5) * sp + sp * 0.5;
    vec2 p1 = vec2(l1, lv + hv + 0.7), p2 = vec2(l2, lv - hv - 0.7);
    float d1 = dot(g - p1, g - p1), d2 = dot(g - p2, g - p2);
    pool += exp(-d1 / 70.0) + exp(-d2 / 70.0);
  }
  vec3 lampC = old ? vec3(1.0, 0.70, 0.40) : mix(vec3(1.0, 0.80, 0.55), vec3(0.95, 0.92, 0.85), step(5.9, max(hu, hv)));
  emit += col * lampC * pool * 2.2 * uNight * (1.0 - bed);
  emit += col * lampC * 0.06 * uNight * (road + side);   // ambient sky-glow on pavement
}
diffuseColor.rgb = col;
gRough = rough;
gEmit = emit;
`;

// ---------------------------------------------------------------- FACADES (all buildings)
// attributes: aCol (rgb), aB0 = (seed, style, floorH, shopH), aB1 = (topH, groupBays, litBase, isRoof)
// uv.x = position along the wall in bay units, uv.y = metres above the building's ground floor
export const STYLE = { PLEX: 0, GLASS: 1, CONCRETE: 2, STONE: 3, HOUSE: 4, WAREHOUSE: 5, GREYSTONE: 6, DARK: 7, ALU: 8, BRUTAL: 9, COPPERGLASS: 10 };
export function facadeMaterial() {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, name: 'facade' });
  m.envMapIntensity = 1.0;
  patch(m, (sh) => {
    Object.assign(sh.uniforms, { uNight: U.uNight, uSnow: U.uSnow, uWet: U.uWet, uLit: U.uLit, uTime: U.uTime, uSkyZen: U.uSkyZen, uSkyHor: U.uSkyHor });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
attribute vec3 aCol; attribute vec4 aB0; attribute vec4 aB1;
flat varying vec3 vCol; flat varying vec4 vB0; flat varying vec4 vB1; varying vec2 vF; flat varying float vNY;`)
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvF = uv; vCol = aCol; vB0 = aB0; vB1 = aB1; vNY = normal.y;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform float uNight, uSnow, uWet, uLit, uTime; uniform vec3 uSkyZen, uSkyHor;
flat varying vec3 vCol; flat varying vec4 vB0; flat varying vec4 vB1; varying vec2 vF; flat varying float vNY;
${GLSL_COMMON}
float gRough, gMetal; vec3 gEmit;
`).replace('#include <map_fragment>', FACADE_FRAG)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = gRough;')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = gMetal;')
      .replace('#include <emissivemap_fragment>', 'totalEmissiveRadiance += gEmit;');
  });
  return m;
}

const FACADE_FRAG = /* glsl */`
float seed = vB0.x, style = floor(vB0.y + 0.5), floorH = max(vB0.z, 2.5), shopH = vB0.w;
float topH = vB1.x, grp = max(vB1.y, 1.0), litBase = vB1.z, isRoof = vB1.w;
vec3 col = vCol; float rough = 0.88, metal = 0.0; vec3 emit = vec3(0.0);
if (isRoof > 0.5) {
  // roofs: membrane / gravel / tar, or the sloped roof colour passed in aCol
  if (vNY > 0.97) {
    float kind = h11(seed * 17.0);
    vec3 rc = kind < 0.45 ? vec3(0.72, 0.72, 0.70) : (kind < 0.8 ? vec3(0.36, 0.35, 0.33) : vec3(0.13, 0.13, 0.14));
    float n = vn(vF * 0.35 + seed * 9.0);
    col = rc * (0.85 + 0.25 * n);
    rough = 0.9;
  } else { col = vCol * (0.9 + 0.15 * vn(vF * 2.0)); rough = 0.65; metal = 0.15; }
  float sn = uSnow * smoothstep(0.5, 0.9, vNY);
  col = mix(col, vec3(0.9, 0.92, 0.96), sn);
} else {
  float bx = vF.x, by = vF.y;
  float fwx = fwidth(bx), fwy = fwidth(by / floorH);
  float fade = smoothstep(0.22, 0.5, max(fwx, fwy));      // window grid -> average when too small
  float bay = floor(bx), fx = fract(bx);
  float fl = floor(by / floorH), fy = fract(by / floorH);
  float grpId = floor(bay / grp);
  // per-style window rectangle (fraction of bay / floor)
  float ww = 0.44, wh = 0.56, sill = 0.24, glassy = 0.0; vec3 frame = col * 0.6;
  if (style == 1.0) { ww = 0.94; wh = 0.80; sill = 0.10; glassy = 1.0; }
  else if (style == 2.0) { ww = 0.52; wh = 0.50; sill = 0.28; }
  else if (style == 3.0) { ww = 0.40; wh = 0.60; sill = 0.20; }
  else if (style == 4.0) { ww = 0.34; wh = 0.48; sill = 0.30; }
  else if (style == 5.0) { ww = 0.70; wh = 0.62; sill = 0.18; }
  else if (style == 6.0) { ww = 0.38; wh = 0.62; sill = 0.20; }
  else if (style == 7.0) { ww = 0.84; wh = 0.70; sill = 0.15; glassy = 0.7; }
  else if (style == 8.0) { ww = 0.56; wh = 0.66; sill = 0.17; glassy = 0.5; }
  else if (style == 9.0) { ww = 0.62; wh = 0.36; sill = 0.34; }
  else if (style == 10.0) { ww = 0.92; wh = 0.84; sill = 0.08; glassy = 1.0; }
  // wall material per style
  float n = vn(vec2(bx * 3.0, by * 0.7) + seed * 13.0);
  if (style == 0.0 || style == 5.0 || style == 4.0) {                 // brick, varied per plex
    float g2 = h11(grpId * 7.13 + seed * 3.1);
    vec3 alt = g2 < 0.25 ? vec3(0.62, 0.60, 0.56) : (g2 < 0.45 ? vec3(0.52, 0.33, 0.24) : (g2 < 0.6 ? vec3(0.66, 0.55, 0.42) : col));
    col = alt * (0.88 + 0.18 * n);
    rough = 0.92;
  } else if (style == 3.0 || style == 6.0) { col *= 0.9 + 0.14 * n; rough = 0.85; }
  else if (style == 2.0 || style == 9.0) { col *= 0.88 + 0.14 * n; rough = 0.9; }
  else { col *= 0.95 + 0.06 * n; rough = 0.45; metal = 0.3; }
  // cornice: darker band with a light lip at the top of every low building
  if (topH < 30.0 && (style == 0.0 || style == 3.0 || style == 5.0 || style == 6.0)) {
    float cz = band(by, topH - 0.75, topH);
    col = mix(col, style == 0.0 ? vec3(0.16, 0.15, 0.14) : col * 0.72, cz * (1.0 - fade * 0.5));
  }
  // window mask
  float wx = band(fx, 0.5 - ww * 0.5, 0.5 + ww * 0.5);
  float wy = band(fy, sill, sill + wh);
  if (style == 3.0) {   // arched heads in Old Montreal
    float ac = sill + wh - 0.12;
    vec2 c = vec2((fx - 0.5) / (ww * 0.5), (fy - ac) / 0.12);
    wy *= fy > ac ? step(length(c), 1.0) : 1.0;
  }
  float win = wx * wy;
  // shopfronts on commercial ground floors
  float shop = shopH > 0.1 ? 1.0 - stepAA(shopH, by) : 0.0;
  if (shop > 0.0) {
    float sw = band(fx, 0.06, 0.94) * band(by, 0.35, shopH - 0.9);
    win = mix(win, sw, shop);
    float signB = band(by, shopH - 0.8, shopH - 0.15) * shop;
    vec3 sc = 0.5 + 0.5 * cos(6.2831 * (h11(grpId + seed * 5.0) + vec3(0.0, 0.33, 0.67)));
    col = mix(col, sc * 0.5, signB * 0.8);
    emit += sc * signB * uNight * 1.6 * step(0.35, h11(grpId * 3.7 + seed));
  }
  // ground-floor doors on plexes / houses (one per group)
  if ((style == 0.0 || style == 4.0) && fl < 0.5 && shop < 0.5) {
    float isDoorBay = step(0.5, mod(bay, grp)) * step(1.5, grp) + step(grp, 1.5) * step(0.7, h11(bay + seed));
    float door = isDoorBay * band(fx, 0.32, 0.68) * band(by, 0.0, floorH * 0.82);
    win = max(win * (1.0 - isDoorBay), 0.0);
    col = mix(col, vec3(0.20, 0.13, 0.09) * (0.7 + 0.6 * h11(bay * 3.0 + seed)), door);
  }
  // glass curtain walls: mullions + spandrels
  if (glassy > 0.0) {
    float mull = 1.0 - band(fx, 0.03, 0.97) * band(fy, 0.04, 0.96);
    win = max(win, glassy * (1.0 - mull * 0.85));
  }
  float coverage = mix(ww * wh, 0.85, glassy);
  win = mix(win, coverage, fade);
  win *= step(by, topH - 0.6) * step(0.05, by);
  // lighting state of each window (static per window, never re-randomised)
  float hw = h21(vec2(bay, fl) + seed * 31.7);
  float pCell = uLit * litBase;
  float office = (glassy > 0.45 || style == 8.0) ? 1.0 : 0.0;
  float fh = h21(vec2(fl * 1.37, seed * 3.7 + 11.0));
  float pEff = office > 0.5 ? pCell * 0.6 : pCell;
  float lit = office > 0.5 ? step(fh, pEff) * step(hw, 0.9) : step(hw, pEff);
  float tint = h21(vec2(fl, bay) * 1.7 + seed);
  vec3 litC = mix(vec3(1.0, 0.66, 0.36), vec3(1.0, 0.86, 0.66), tint);
  if (glassy > 0.5 || style == 8.0) litC = mix(vec3(0.80, 0.88, 1.0), vec3(1.0, 0.88, 0.72), tint);
  float dim = 0.32 + 0.68 * h21(vec2(bay * 2.0, fl) + seed);
  float litAvg = pEff * 0.28;
  float litF = mix(lit * dim, litAvg, fade);
  // interior depth cue: top of a lit window a bit darker (ceiling)
  float ceilC = 1.0 - 0.35 * smoothstep(sill + wh * 0.6, sill + wh, fy) * (1.0 - fade);
  vec3 glass = mix(vec3(0.05, 0.07, 0.085), vec3(0.22, 0.30, 0.34), glassy);
  if (style == 7.0) glass = vec3(0.06, 0.05, 0.04);
  if (style == 10.0) glass = vec3(0.16, 0.22, 0.20);
  col = mix(col, glass, win);
  rough = mix(rough, 0.07, win);
  metal = mix(metal, glassy > 0.5 ? 0.75 : 0.35, win);
  emit += litC * litF * win * ceilC * uNight * mix(1.1, 0.85, fade);
  // sky reflection in glass (cheap, stable, works without screen-space effects)
  {
    vec3 nV = normalize(vNormal), vd = normalize(vViewPosition);
    vec3 rW = (vec4(reflect(-vd, nV), 0.0) * viewMatrix).xyz;
    float fres = 0.05 + 0.95 * pow(1.0 - max(dot(nV, vd), 0.0), 5.0);
    vec3 skyR = rW.y > 0.0 ? mix(uSkyHor, uSkyZen, smoothstep(0.0, 0.55, rW.y)) : mix(uSkyHor * 0.45, uSkyHor * 0.12, smoothstep(0.0, -0.25, rW.y));
    float refl = mix(0.35, 0.95, glassy) * (1.0 - 0.85 * uNight);
    emit += skyR * fres * win * refl * (1.0 - litF * uNight);
    col *= 1.0 - 0.5 * fres * win * glassy;
  }
  if (shop > 0.0) emit += vec3(1.0, 0.85, 0.65) * win * shop * uNight * 2.0;
  // grime and contact darkening
  col *= 1.0 - 0.28 * (1.0 - smoothstep(0.0, 2.5, by));
  col *= 0.94 + 0.06 * vn(vec2(bx * 6.0, by * 0.08) + seed);
  rough = mix(rough, rough * 0.6, uWet * (1.0 - win));
  col *= 1.0 - 0.18 * uWet * (1.0 - win);
}
diffuseColor.rgb = col;
gRough = rough; gMetal = metal; gEmit = emit;
`;

// ---------------------------------------------------------------- WATER
export function waterMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: 0x0b1a1f, roughness: 0.05, metalness: 0.0, name: 'water' });
  m.envMapIntensity = 1.25;
  patch(m, (sh) => {
    Object.assign(sh.uniforms, { uTime: U.uTime, uSnow: U.uSnow, uMaskA: U.uMaskA, uDom: U.uDom, uWet: U.uWet, uNight: U.uNight, uSkyZen: U.uSkyZen, uSkyHor: U.uSkyHor, tMirror: U.tMirror, uMirrorMat: U.uMirrorMat, uMirrorOn: U.uMirrorOn });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vGW;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvGW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform float uTime, uSnow, uWet, uNight; uniform sampler2D uMaskA; uniform vec4 uDom; uniform vec3 uSkyZen, uSkyHor;
uniform sampler2D tMirror; uniform mat4 uMirrorMat; uniform float uMirrorOn;
varying vec3 vGW;
${GLSL_COMMON}
float wRough; float wIce; vec3 wN = vec3(0.0, 1.0, 0.0);
`).replace('#include <map_fragment>', /* glsl */`
vec2 g = vec2(vGW.x, -vGW.z);
vec2 muv = (g - uDom.xy) / uDom.zw;
float ws = (texture2D(uMaskA, muv).r * 255.0 - 128.0) * 0.25;
float dist = length(vGW - cameraPosition);
float far = smoothstep(60.0, 1800.0, dist);
// winter ice along the banks
float ice = uSnow * smoothstep(-26.0, -4.0, ws) * smoothstep(0.35, 0.55, fbm2(g * 0.02 + 3.0));
wIce = ice;
vec3 wc = mix(vec3(0.02, 0.055, 0.065), vec3(0.05, 0.085, 0.08), smoothstep(-40.0, -4.0, ws));
diffuseColor.rgb = mix(wc, vec3(0.82, 0.86, 0.9), ice);
wRough = mix(mix(0.06, 0.18, far), 0.45, ice);
`).replace('#include <roughnessmap_fragment>', 'float roughnessFactor = wRough;')
      .replace('#include <normal_fragment_maps>', /* glsl */`
{
  // current flows towards Montreal-east; waves fade out with distance so they never sparkle
  vec2 p = vec2(vGW.x, -vGW.z);
  float amp = (1.0 - smoothstep(20.0, 650.0, length(vGW - cameraPosition))) * (1.0 - wIce) * (1.0 + 0.6 * uWet);
  vec2 q = p * 0.42 + vec2(uTime * 0.45, uTime * 0.12);
  float e = 0.15;
  float h0 = fbm2(q), hx = fbm2(q + vec2(e, 0.0)), hy = fbm2(q + vec2(0.0, e));
  vec2 q2 = p * 0.045 - vec2(uTime * 0.06, -uTime * 0.04);
  float k0 = vn(q2), kx = vn(q2 + vec2(e, 0.0)), ky = vn(q2 + vec2(0.0, e));
  vec2 grad = vec2(hx - h0, hy - h0) / e * 0.13 + vec2(kx - k0, ky - k0) / e * 0.12;
  vec3 nW = normalize(vec3(-grad.x * amp, 1.0, grad.y * amp));
  wN = nW;
  normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);
}
`).replace('#include <emissivemap_fragment>', /* glsl */`
{
  vec3 vd = normalize(vViewPosition);
  vec3 rW = (vec4(reflect(-vd, normal), 0.0) * viewMatrix).xyz;
  float fres = 0.02 + 0.98 * pow(1.0 - max(dot(normal, vd), 0.0), 5.0);
  vec3 skyR = mix(uSkyHor, uSkyZen, smoothstep(0.0, 0.6, max(rW.y, 0.0)));
  if (uMirrorOn > 0.5) {
    vec4 mp = uMirrorMat * vec4(vGW, 1.0);
    vec2 muv = mp.xy / mp.w + wN.xz * 0.045;
    vec3 mir = texture2D(tMirror, clamp(muv, 0.001, 0.999)).rgb;
    skyR = mir;
  }
  totalEmissiveRadiance += skyR * fres * mix(0.55, 0.9, uMirrorOn) * (1.0 - wIce);
}
`);
  });
  return m;
}

// ---------------------------------------------------------------- FOLIAGE (instanced trees)
// aPart: 0 trunk, 1 crown. instanceColor = crown tint. Distance fade via alpha-to-coverage.
export function treeMaterial(conifer, hi = false) {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, name: (conifer ? 'conifer' : 'tree') + (hi ? 'H' : ''), alphaToCoverage: true, transparent: false });
  m.envMapIntensity = 0.7;
  patch(m, (sh) => {
    Object.assign(sh.uniforms, { uTime: U.uTime, uAutumn: U.uAutumn, uWinter: U.uWinter, uSnow: U.uSnow, uFadeNear: U.uFadeNear, uFadeFar: U.uFadeFar, uNearFade: U.uNearFade });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
attribute float aPart;
uniform float uTime, uWinter, uFadeNear, uFadeFar; uniform vec2 uNearFade;
varying float vPart; varying float vFade; flat varying float vSeed; varying float vUp;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vPart = aPart;
vec4 iorg = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
vSeed = fract(iorg.x * 0.137 + iorg.z * 0.071);
${conifer ? '' : 'if (aPart > 0.5) transformed.xz *= mix(1.0, 0.72, uWinter); if (aPart > 0.5) transformed.y = mix(transformed.y, transformed.y * 0.92 + 0.6, uWinter);'}
float sway = aPart * max(transformed.y - 1.5, 0.0) * 0.012 * sin(uTime * 1.4 + vSeed * 40.0 + iorg.x * 0.05);
transformed.x += sway; transformed.z += sway * 0.6;
float dCam = distance(iorg.xyz, cameraPosition);
vFade = 1.0 - smoothstep(uFadeNear, uFadeFar, dCam);
${hi ? 'vFade = 1.0 - smoothstep(uNearFade.x, uNearFade.y, dCam);' : 'vFade *= smoothstep(uNearFade.x, uNearFade.y, dCam);'}
vUp = normal.y;`)
      ;
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform float uAutumn, uWinter, uSnow;
varying float vPart; varying float vFade; flat varying float vSeed; varying float vUp;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
if (vPart < 0.5) diffuseColor.rgb = vec3(0.16, 0.11, 0.08);
else {
  ${conifer ? '' : `vec3 fall = mix(vec3(0.62, 0.12, 0.04), vec3(0.85, 0.48, 0.06), fract(vSeed * 7.3));
  fall = mix(fall, vec3(0.75, 0.62, 0.12), step(0.7, fract(vSeed * 3.1)));
  diffuseColor.rgb = mix(diffuseColor.rgb, fall, uAutumn * step(0.12, fract(vSeed * 11.0)));
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.20, 0.17, 0.15), uWinter);`}
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.88, 0.92), uSnow * smoothstep(0.2, 0.7, vUp) * ${conifer ? '0.8' : '0.55'});
}
diffuseColor.a = vFade;
if (vFade < 0.02) discard;`);
  });
  return m;
}

// canopy shell for distant forest (fades IN where the instanced trees fade out)
export function canopyMaterial() {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0, name: 'canopy', alphaToCoverage: true });
  m.envMapIntensity = 0.7;
  patch(m, (sh) => {
    Object.assign(sh.uniforms, { uAutumn: U.uAutumn, uWinter: U.uWinter, uSnow: U.uSnow, uForestFade: U.uForestFade });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vGW;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvGW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform float uAutumn, uWinter, uSnow; uniform vec2 uForestFade;
varying vec3 vGW;
${GLSL_COMMON}`).replace('#include <map_fragment>', /* glsl */`
vec2 g = vec2(vGW.x, -vGW.z);
float n = fbm2(g * 0.09), c = vn(g * 0.35);
vec3 green = mix(vec3(0.09, 0.16, 0.05), vec3(0.20, 0.27, 0.09), n) * (0.75 + 0.35 * c);
vec3 fall = mix(vec3(0.58, 0.14, 0.05), vec3(0.82, 0.50, 0.10), vn(g * 0.05));
fall = mix(fall, green, step(0.78, vn(g * 0.07 + 5.0)));
vec3 col = mix(green, fall * (0.75 + 0.35 * c), uAutumn);
vec3 bare = mix(vec3(0.24, 0.21, 0.19), vec3(0.15, 0.17, 0.10), step(0.75, vn(g * 0.07 + 5.0)));
col = mix(col, bare * (0.8 + 0.3 * c), uWinter);
col = mix(col, vec3(0.82, 0.84, 0.88), uSnow * 0.6 * smoothstep(0.35, 0.7, c));
diffuseColor.rgb = col;
float d = length(vGW - cameraPosition);
diffuseColor.a = smoothstep(uForestFade.x * 0.85, uForestFade.y * 0.95, d);
if (diffuseColor.a < 0.02) discard;
`).replace('#include <normal_fragment_maps>', /* glsl */`
{
  float fw = fwidth(vGW.x) + fwidth(vGW.z);
  float amp = 1.0 - smoothstep(2.0, 8.0, fw);
  vec2 g2 = vec2(vGW.x, -vGW.z) * 0.12; float e = 0.2;
  float h0 = vn(g2), hx = vn(g2 + vec2(e, 0.0)), hy = vn(g2 + vec2(0.0, e));
  vec3 nW = normalize(vec3(-(hx - h0) / e * 1.6 * amp, 1.0, (hy - h0) / e * 1.6 * amp));
  normal = normalize(normal + (viewMatrix * vec4(nW - vec3(0.0, 1.0, 0.0), 0.0)).xyz);
}`);
  });
  return m;
}

// generic props (lamp posts, benches, stairs) with the same distance fade
export function propMaterial(opts = {}, nightEmissive = null) {
  const m = new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.6, metalness: 0.4, alphaToCoverage: true }, opts));
  m.name = 'prop' + (opts.name || '') + (nightEmissive ? 'E' + nightEmissive.join('_') : '');
  patch(m, (sh) => {
    Object.assign(sh.uniforms, { uFadeNear: U.uFadeNear, uFadeFar: U.uFadeFar, uNight: U.uNight, uSnow: U.uSnow });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
attribute float aGlow; varying float vGlow;
uniform float uFadeNear, uFadeFar; varying float vFade; varying float vUpP;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vGlow = aGlow;
#ifdef USE_INSTANCING
vec4 iorg = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
#else
vec4 iorg = modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);
#endif
vFade = 1.0 - smoothstep(uFadeNear * 0.55, uFadeFar * 0.6, distance(iorg.xyz, cameraPosition));
vUpP = normal.y;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform float uNight, uSnow; varying float vFade; varying float vGlow; varying float vUpP;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
${nightEmissive ? `totalEmissiveRadiance += vec3(${nightEmissive.map((x) => x.toFixed(3)).join(',')}) * vGlow * uNight;` : ''}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.88, 0.9, 0.94), uSnow * smoothstep(0.6, 0.9, vUpP) * 0.8);
diffuseColor.a = vFade;
if (vFade < 0.02) discard;`);
  });
  return m;
}

// ---------------------------------------------------------------- additive glow billboards
// Used for lamp heads, car lights, beacons, bridge LEDs. Additive blending + no depth write =
// order independent, so they can never flicker against each other.
export function glowMaterial() {
  return new THREE.ShaderMaterial({
    name: 'glow',
    uniforms: { uNight: U.uNight, uTime: U.uTime, uScale: { value: 1 } },
    vertexShader: /* glsl */`
attribute vec3 iPos; attribute vec4 iCol; attribute vec2 iSize;  // iSize = (radius m, mode)
uniform float uNight, uTime, uScale;
varying vec2 vUv; varying vec4 vCol;
void main(){
  vUv = uv * 2.0 - 1.0;
  vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
  float r = iSize.x * uScale;
  float d = -mv.z;
  r = max(r, d * 0.0018);                  // never smaller than ~2 px -> no sparkle
  mv.xy += position.xy * r;
  float k = iSize.y;
  float a = uNight;
  if (k > 1.5 && k < 2.5) a = 1.0;                                   // always on
  if (k > 2.5 && k < 3.5) a = (0.55 + 0.45 * sin(uTime * 1.6 + iPos.x)) * max(uNight, 0.35); // slow pulse
  if (k > 3.5) { vec3 hue = 0.5 + 0.5 * cos(6.2831 * (uTime * 0.03 + iPos.x * 0.002 + vec3(0.0, 0.33, 0.67))); vCol = vec4(hue, iCol.a); }
  else vCol = iCol;
  vCol.a *= a * smoothstep(0.5, 6.0, d);
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: /* glsl */`
varying vec2 vUv; varying vec4 vCol;
void main(){
  float r = dot(vUv, vUv);
  if (r > 1.0) discard;
  float f = exp(-r * 4.0) + 0.35 * exp(-r * 18.0);
  gl_FragColor = vec4(vCol.rgb * vCol.a * f, 1.0);
}`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  });
}
export class GlowField {
  constructor(max) {
    const quad = new THREE.PlaneGeometry(2, 2);
    const g = new THREE.InstancedBufferGeometry();
    g.index = quad.index; g.attributes.position = quad.attributes.position; g.attributes.uv = quad.attributes.uv;
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 4); this.size = new Float32Array(max * 2);
    g.setAttribute('iPos', new THREE.InstancedBufferAttribute(this.pos, 3));
    g.setAttribute('iCol', new THREE.InstancedBufferAttribute(this.col, 4));
    g.setAttribute('iSize', new THREE.InstancedBufferAttribute(this.size, 2));
    g.instanceCount = 0;
    this.geo = g; this.max = max; this.n = 0;
    this.mesh = new THREE.Mesh(g, glowMaterial());
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 20;
  }
  add(x, y, z, r, g, b, a, radius, mode = 0) {
    if (this.n >= this.max) return -1;
    const i = this.n++;
    this.pos.set([x, y, z], i * 3); this.col.set([r, g, b, a], i * 4); this.size.set([radius, mode], i * 2);
    this.geo.instanceCount = this.n;
    return i;
  }
  commit() { for (const k of ['iPos', 'iCol', 'iSize']) this.geo.attributes[k].needsUpdate = true; this.geo.instanceCount = this.n; }
}

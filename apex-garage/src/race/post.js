// Race graphics: live cube-map reflections, cinematic grade pass, contact shadows, wet puddles.
import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { canvasTex } from './tracks.js';

/* ───────── cinematic grade (after tone mapping): vignette, contrast, saturation, CA, grain ───────── */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null }, time: { value: 0 }, vignette: { value: 0.32 }, contrast: { value: 1.08 },
    saturation: { value: 1.12 }, lift: { value: new THREE.Vector3(0, 0, 0) }, gain: { value: new THREE.Vector3(1, 1, 1) },
    ca: { value: 0 }, grain: { value: 0.035 }, flash: { value: 0 }
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float time, vignette, contrast, saturation, ca, grain, flash; uniform vec3 lift, gain; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec2 d = vUv - 0.5;
      float r2 = dot(d, d);
      // chromatic aberration grows toward the edges (speed effect)
      vec2 off = d * ca * r2 * 2.0;
      vec3 c = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
      c = c * gain + lift * (1.0 - c);
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, saturation);
      c = (c - 0.5) * contrast + 0.5;
      c *= 1.0 - vignette * smoothstep(0.08, 0.62, r2 * 1.6);
      c += (hash(vUv * 731.0 + time) - 0.5) * grain;
      c = mix(c, vec3(1.0), flash);
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`
};
export const GRADES = {
  city: { lift: [0.0, 0.0, 0.025], gain: [1.0, 0.98, 1.04], saturation: 1.18, contrast: 1.1, vignette: 0.38 },
  coast: { lift: [0.02, 0.008, 0.0], gain: [1.05, 1.0, 0.94], saturation: 1.1, contrast: 1.06, vignette: 0.3 },
  docks: { lift: [0.01, 0.0, 0.03], gain: [1.02, 0.97, 1.03], saturation: 1.1, contrast: 1.1, vignette: 0.36 }
};
export function createGradePass() {
  const p = new ShaderPass(GradeShader);
  p.enabled = false;
  p.setTheme = (id) => {
    const g = GRADES[id] || GRADES.city, u = p.uniforms;
    u.lift.value.set(...g.lift); u.gain.value.set(...g.gain);
    u.saturation.value = g.saturation; u.contrast.value = g.contrast; u.vignette.value = g.vignette;
  };
  return p;
}

/* ───────── live reflections: a cube camera that follows the player ───────── */
export function createReflections(renderer) {
  const rt = new THREE.WebGLCubeRenderTarget(128, { type: THREE.HalfFloatType, generateMipmaps: false });
  const cam = new THREE.CubeCamera(0.5, 600, rt);
  let n = 0;
  return {
    texture: rt.texture,
    enabled: true,
    // one cube face per frame (full refresh every 6 frames), vehicles hidden: ~1 small extra render/frame
    update(scene, pos, hide, staticEnv) {
      if (!this.enabled) return;
      const face = n++ % 6;
      if (face === 0) { cam.position.set(pos.x, pos.y + 1.2, pos.z); cam.updateMatrixWorld(true); }
      hide.forEach((o) => (o.visible = false));
      const fog = scene.fog; scene.fog = null; // reflections read clearer without fog
      const env = scene.environment; scene.environment = staticEnv || null; // no feedback loop
      const prev = renderer.getRenderTarget();
      renderer.setRenderTarget(rt, face);
      renderer.render(scene, cam.children[face]);
      renderer.setRenderTarget(prev);
      scene.environment = env; scene.fog = fog;
      hide.forEach((o) => (o.visible = true));
      if (face === 5) rt.texture.needsPMREMUpdate = true;
    },
    dispose() { rt.dispose(); }
  };
}

/* ───────── soft contact shadow under each vehicle ───────── */
let shadowTex = null;
export function contactShadow(size, bike) {
  shadowTex ||= canvasTex(128, 256, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(0,0,0,.92)'); gr.addColorStop(0.55, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.save(); g.scale(1, h / w); g.fillStyle = gr; g.fillRect(0, 0, w, w); g.restore();
  });
  shadowTex.wrapS = shadowTex.wrapT = THREE.ClampToEdgeWrapping;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
    map: shadowTex, transparent: true, depthWrite: false, opacity: bike ? 0.55 : 0.8,
    polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -8
  }));
  m.rotation.x = -Math.PI / 2;
  m.scale.set(size.x * (bike ? 1.6 : 1.3), size.z * 1.15, 1);
  m.position.y = 0.05;
  m.renderOrder = 1;
  return m;
}

/* ───────── wet-road puddles (roughness map) ───────── */
let puddleTex = null;
export function puddles() {
  puddleTex ||= canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = 'rgb(150,150,150)'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) {
      const x = Math.random() * w, y = Math.random() * h, r = 20 + Math.random() * 90;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgb(8,8,8)'); gr.addColorStop(0.7, 'rgb(25,25,25)'); gr.addColorStop(1, 'rgba(150,150,150,0)');
      g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, r, r * (0.4 + Math.random() * 0.5), Math.random() * 3, 0, 7); g.fill();
    }
  }, { srgb: false, repeat: [1, 0.35] });
  return puddleTex;
}

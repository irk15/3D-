import * as THREE from 'three';

const lerp = (a, b, t) => a + (b - a) * t, sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const C = (h) => new THREE.Color(h);
const NIGHT = { zen: C(0x02050d), hor: C(0x0a1426), fog: C(0x0a1222) }, DUSK = { zen: C(0x1d2c5e), hor: C(0xf28c52), fog: C(0xb08a8a) }, DAY = { zen: C(0x2a69c9), hor: C(0xaecbec), fog: C(0xb4cae0) };

export class Sky {
  constructor(scene, renderer) {
    this.scene = scene;
    this.sunDir = new THREE.Vector3(0, 1, 0);
    this.uni = { zen: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sun: { value: new THREE.Vector3() }, night: { value: 0 } };
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false, uniforms: this.uni,
      vertexShader: 'varying vec3 d; void main(){ d=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: `uniform vec3 zen,hor,sun; uniform float night; varying vec3 d;
        void main(){ float y=max(d.y,0.0); vec3 c=mix(hor,zen,pow(y,0.45));
          float s=max(dot(normalize(d),normalize(sun)),0.0); c+=vec3(1.0,0.85,0.6)*(pow(s,600.0)*2.0+pow(s,12.0)*0.18*(1.0-night));
          if(d.y<0.0) c=mix(hor,hor*0.7,min(1.0,-d.y*4.0));
          gl_FragColor=vec4(c,1.0); }`
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(10000, 32, 16), mat); this.dome.renderOrder = -10; this.dome.frustumCulled = false; scene.add(this.dome);
    const sp = new Float32Array(1800 * 3);
    for (let i = 0; i < 1800; i++) { const u = Math.random() * 2 - 1, a = Math.random() * 6.283, r = Math.sqrt(1 - u * u); sp.set([r * Math.cos(a) * 9500, Math.abs(u) * 9500, r * Math.sin(a) * 9500], i * 3); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, depthTest: false, fog: false }));
    this.stars.renderOrder = -9; this.stars.frustumCulled = false; scene.add(this.stars);
    this.sunL = new THREE.DirectionalLight(0xffffff, 2); scene.add(this.sunL);
    this.hemi = new THREE.HemisphereLight(0xbcd4ff, 0x4a4540, 0.8); scene.add(this.hemi);
    scene.fog = new THREE.Fog(0xb4cae0, 800, 9000);
    this.fogC = new THREE.Color(); this.col = new THREE.Color();
  }
  mix(a, b, t, k) { return this.col.copy(a[k]).lerp(b[k], t).clone(); }
  update(hour, camPos) {
    const a = ((hour - 6) / 12) * Math.PI, el = Math.sin(a);
    this.sunDir.set(Math.cos(a) * 0.8, el, 0.35).normalize();
    const day = sm(-0.05, 0.35, el), dusk = 1 - Math.abs(sm(-0.25, 0.12, el) * 2 - 1) * 1; // dusk peaks near the horizon
    const dk = Math.max(0, 1 - Math.abs(el) / 0.28), night = 1 - sm(-0.22, 0.02, el);
    const set = (k) => { const n = this.col.copy(NIGHT[k]).lerp(DAY[k], day); return n.lerp(DUSK[k], dk * 0.85 * (1 - Math.abs(day - 0.5) * 0.4)); };
    this.uni.zen.value.copy(set('zen')); this.uni.hor.value.copy(set('hor'));
    this.fogC.copy(set('fog')); this.scene.fog.color.copy(this.fogC);
    this.uni.sun.value.copy(this.sunDir); this.uni.night.value = night;
    const up = el > 0;
    this.sunL.position.copy(this.sunDir).multiplyScalar(up ? 1 : -1).multiplyScalar(3000).add(camPos);
    this.sunL.target.position.copy(camPos); this.sunL.target.updateMatrixWorld();
    this.sunL.color.copy(up ? new THREE.Color(0xfff1d8).lerp(new THREE.Color(0xff9a5a), dk) : new THREE.Color(0x7f9cff));
    this.sunL.intensity = up ? lerp(0.25, 2.4, Math.min(1, el * 2.2)) : 0.45 * night;
    this.hemi.intensity = lerp(0.42, 0.95, day);
    this.hemi.color.copy(night > 0.5 ? C(0x28385f) : C(0xbcd4ff)); this.hemi.groundColor.copy(C(0x3a3836));
    this.stars.material.opacity = Math.max(0, night - 0.15);
    this.dome.position.copy(camPos); this.stars.position.copy(camPos);
    return night;
  }
}

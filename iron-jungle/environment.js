// Sky, water, rock faces, vegetation and atmosphere.
import * as THREE from 'three';

export function skyMaterial(time) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, fog: false, depthWrite: false, uniforms: { t: time },
    vertexShader: 'varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform float t;varying vec3 p;
    float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float n2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h2(i),h2(i+vec2(1,0)),f.x),mix(h2(i+vec2(0,1)),h2(i+1.),f.x),f.y);}
    float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<5;i++){s+=a*n2(p);p*=2.03;a*=.5;}return s;}
    void main(){vec3 d=normalize(p);float h=d.y;
    vec3 c=mix(vec3(.85,.34,.13),vec3(.22,.14,.26),smoothstep(-.02,.2,h));c=mix(c,vec3(.025,.05,.13),smoothstep(.18,.65,h));
    vec3 sd=normalize(vec3(.3,.12,-1.));float s=max(dot(d,sd),0.);
    c+=vec3(1.,.6,.25)*(pow(s,1400.)*7.+pow(s,60.)*.7+pow(s,6.)*.22);
    vec2 uv=d.xz/(max(h,0.)+.16);float cl=smoothstep(.48,.82,fbm(uv*vec2(1.1,2.4)+vec2(t*.008,0.)))*smoothstep(.0,.08,h)*(1.-smoothstep(.45,.75,h));
    vec3 cc=mix(vec3(.16,.08,.15),vec3(1.25,.5,.22),pow(s,3.)*.85+.1);c=mix(c,cc,cl*.85);
    gl_FragColor=vec4(c,1.);}`
  });
}

// palm frond drawn once into a texture, used with alpha testing
export function frondTexture(rnd) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 512; const g = cv.getContext('2d');
  g.lineCap = 'round';
  for (let i = 0; i < 46; i++) {
    const y = 500 - i * 10.4, len = 122 * Math.sin(Math.PI * Math.min(.95, i / 50 + .09));
    for (const s of [-1, 1]) {
      const l = len * rnd(.82, 1), v = Math.floor(rnd(150, 255));
      g.fillStyle = `rgb(${v * .86 | 0},${v},${v * .7 | 0})`;
      g.beginPath(); g.moveTo(128, y + 5); g.quadraticCurveTo(128 + s * l * .55, y - 20, 128 + s * l, y - rnd(36, 58)); g.quadraticCurveTo(128 + s * l * .5, y - 2, 128, y - 5); g.fill();
    }
  }
  g.strokeStyle = '#d8d890'; g.lineWidth = 5; g.beginPath(); g.moveTo(128, 512); g.lineTo(128, 24); g.stroke();
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
export function frondGeometry() {
  const g = new THREE.PlaneGeometry(1.35, 2.8, 4, 10); g.translate(0, 1.4, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const t = p.getY(i) / 2.8, x = p.getX(i); p.setZ(i, t * t * 1.25 - Math.abs(x) * .35); p.setY(i, p.getY(i) - t * t * t * .9); }
  g.computeVertexNormals(); return g;
}
function sway(mat, wind, amount) {
  mat.onBeforeCompile = s => {
    s.uniforms.wt = wind;
    s.vertexShader = 'uniform float wt;\n' + s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
    transformed.x+=sin(wt*1.5+instanceMatrix[3].x*.7+instanceMatrix[3].z)*${amount.toFixed(3)}*position.y*position.y;`);
  };
  return mat;
}
export function frondMaterial(tex, wind) {
  return sway(new THREE.MeshStandardMaterial({ map: tex, alphaTest: .45, side: THREE.DoubleSide, roughness: .58, emissive: 0x0b1204 }), wind, .045);
}
export function grassField(scene, wind, rnd, ranges) {
  const geo = new THREE.PlaneGeometry(.07, .42, 1, 3); geo.translate(0, .21, 0);
  const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const t = p.getY(i) / .42; p.setX(i, p.getX(i) * (1 - t * .92)); p.setZ(i, t * t * .12); }
  geo.computeVertexNormals();
  const spots = [];
  for (const [x1, x2] of ranges) for (let x = x1 + .1; x < x2 - .1; x += .11) {
    spots.push([x + rnd(-.1, .1), rnd(-3.8, -.9)]); spots.push([x + rnd(-.1, .1), rnd(-3.8, -1.4)]);
    if (rnd() > .55) spots.push([x, rnd(1.7, 2.95)]);
  }
  // split into chunks so off-screen grass is culled
  const mat = sway(new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: .75 }), wind, .5);
  const chunks = new Map(); for (const s of spots) { const k = Math.floor(s[0] / 20); if (!chunks.has(k)) chunks.set(k, []); chunks.get(k).push(s); }
  const m = new THREE.Object3D(), col = new THREE.Color();
  for (const list of chunks.values()) {
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach(([x, z], i) => { m.position.set(x, 0, z); m.rotation.set(0, rnd(-1.2, 1.2), rnd(-.25, .25)); m.scale.setScalar(z > 1 ? rnd(.35, .7) : rnd(.6, 1.35)); m.updateMatrix(); im.setMatrixAt(i, m.matrix); im.setColorAt(i, col.setHSL(rnd(.17, .3), rnd(.45, .65), rnd(.1, .27))); });
    im.receiveShadow = true; im.computeBoundingSphere(); scene.add(im);
  }
}
// displaced rock face in front of each ground block
export function cliff(scene, mat, rnd, x1, x2) {
  const w = x2 - x1, g = new THREE.PlaneGeometry(w, 5.9, Math.ceil(w * 3), 16);
  const p = g.attributes.position, uv = g.attributes.uv;
  const bump = (x, y) => Math.sin(x * 1.7 + Math.sin(y * 2.3)) * .18 + Math.sin(x * .53 - y * 1.9) * .22 + Math.abs(Math.sin(y * 3.4 + Math.sin(x * .8) * 1.6)) * .24;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + (x1 + x2) / 2, y = p.getY(i) - 3.2;
    const edge = Math.min(1, (2.7 - p.getY(i)) * 1.4, (x - x1) * 2 + .1, (x2 - x) * 2 + .1);
    p.setZ(i, bump(x, y) * Math.max(0, edge)); uv.setXY(i, x / 6, y / 6);
  }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.position.set((x1 + x2) / 2, -3.2, 3.02); m.receiveShadow = true; scene.add(m);
}
export function water(scene, normals, width, cx) {
  normals.wrapS = normals.wrapT = THREE.RepeatWrapping; normals.repeat.set(width / 7, 3);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(width, 16), new THREE.MeshStandardMaterial({ color: 0x0d3a3c, roughness: .06, metalness: .85, normalMap: normals, normalScale: new THREE.Vector2(.55, .55), envMapIntensity: 2.2 }));
  m.rotation.x = -Math.PI / 2; m.position.set(cx, -3.4, 0); scene.add(m); return m;
}
export function softTexture(inner = 'rgba(255,255,255,1)', size = 128, puffs = 0) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size; const g = cv.getContext('2d');
  const blob = (x, y, r, a) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, inner); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.globalAlpha = a; g.fillStyle = gr; g.fillRect(0, 0, size, size); };
  if (!puffs) blob(size / 2, size / 2, size / 2, 1);
  else for (let i = 0; i < puffs; i++) { const an = i * 2.4, r = (i % 5) / 5 * size * .24; blob(size / 2 + Math.cos(an) * r, size / 2 + Math.sin(an) * r, size * .24, .6); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// slanted sun shafts and low mist banks
export function atmosphere(scene, rnd, end) {
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 256; const g = cv.getContext('2d');
  const h = g.createLinearGradient(0, 0, 64, 0); h.addColorStop(0, '#000'); h.addColorStop(.5, '#fff'); h.addColorStop(1, '#000'); g.fillStyle = h; g.fillRect(0, 0, 64, 256);
  const v = g.createLinearGradient(0, 0, 0, 256); v.addColorStop(0, '#fff'); v.addColorStop(1, '#000'); g.globalCompositeOperation = 'multiply'; g.fillStyle = v; g.fillRect(0, 0, 64, 256);
  const shaft = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), color: 0xff9a4a, transparent: true, opacity: .13, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const shafts = [];
  for (let x = -5; x < end + 20; x += rnd(7, 15)) { const m = new THREE.Mesh(new THREE.PlaneGeometry(rnd(1, 3.2), 22), shaft); m.position.set(x, 6, rnd(-15, -5)); m.rotation.z = -.5; scene.add(m); shafts.push(m); }
  const fogTex = softTexture('rgba(255,255,255,1)', 128, 14), mist = [];
  const mm = new THREE.SpriteMaterial({ map: fogTex, color: 0xb98a8c, transparent: true, opacity: .16, depthWrite: false });
  for (let x = -20; x < end + 30; x += rnd(4, 8)) { const s = new THREE.Sprite(mm); s.position.set(x, rnd(-.2, 1.2), rnd(-18, -6)); s.scale.set(rnd(9, 15), rnd(2.5, 4), 1); scene.add(s); mist.push(s); }
  return { shaft, mist };
}

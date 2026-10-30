// reflect.js — planar mirror for the Saint Lawrence (desktop High/Ultra only).
// The scene is re-rendered from below the water plane into a half-resolution target with an
// oblique near plane, and the water shader samples it projectively. Never used in VR (the water
// falls back to sky reflections there), and shadows are not recomputed for the mirror pass.
import * as THREE from 'three';
import { U } from './core.js';

export class WaterMirror {
  constructor(renderer, scene, hide = []) {
    this.renderer = renderer; this.scene = scene; this.hide = hide;
    this.rt = new THREE.WebGLRenderTarget(256, 256, { type: THREE.HalfFloatType });
    this.rt.texture.generateMipmaps = false;
    this.cam = new THREE.PerspectiveCamera();
    this.cam.layers.set(6);            // only big structures reflect (city, terrain, landmarks, sky, lights)
    this.before = () => {}; this.after = () => {};
    this.enabled = false; this.scale = 0.5;
    this.tm = new THREE.Matrix4();
    U.tMirror.value = this.rt.texture; U.uMirrorMat.value = this.tm;
    this._v = new THREE.Vector3(); this._t = new THREE.Vector3(); this._q = new THREE.Vector4(); this._p = new THREE.Plane(); this._c = new THREE.Vector4();
  }
  setSize(w, h) { this.rt.setSize(Math.max(64, Math.floor(w * this.scale)), Math.max(64, Math.floor(h * this.scale))); }
  update(camera) {
    if (!this.enabled || camera.position.y < 0.5) { U.uMirrorOn.value = 0; return; }
    U.uMirrorOn.value = 1;
    const cam = this.cam, cp = camera.position;
    camera.updateMatrixWorld();
    const rot = new THREE.Matrix4().extractRotation(camera.matrixWorld);
    const look = new THREE.Vector3(0, 0, -1).applyMatrix4(rot).add(cp);
    cam.position.set(cp.x, -cp.y, cp.z);
    const up = new THREE.Vector3(0, 1, 0).applyMatrix4(rot); up.y = -up.y;
    cam.up.copy(up);
    cam.lookAt(look.x, -look.y, look.z);
    cam.far = camera.far; cam.near = camera.near;
    cam.updateMatrixWorld();
    cam.projectionMatrix.copy(camera.projectionMatrix);
    this.tm.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    this.tm.multiply(cam.projectionMatrix).multiply(cam.matrixWorldInverse);
    // oblique clipping at the water plane (Lengyel)
    const plane = this._p.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0));
    plane.applyMatrix4(cam.matrixWorldInverse);
    const c = this._c.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
    const P = cam.projectionMatrix.elements, q = this._q;
    q.x = (Math.sign(c.x) + P[8]) / P[0]; q.y = (Math.sign(c.y) + P[9]) / P[5]; q.z = -1; q.w = (1 + P[10]) / P[14];
    c.multiplyScalar(2 / c.dot(q));
    P[2] = c.x; P[6] = c.y; P[10] = c.z + 1 - 0.003; P[14] = c.w;
    const r = this.renderer;
    const prevRT = r.getRenderTarget(), prevShadow = r.shadowMap.autoUpdate, prevXR = r.xr.enabled;
    for (const o of this.hide) o.visible = false;
    r.xr.enabled = false; r.shadowMap.autoUpdate = false;
    r.setRenderTarget(this.rt); r.state.buffers.depth.setMask(true); r.clear();
    this.before();
    r.render(this.scene, cam);
    this.after();
    r.setRenderTarget(prevRT); r.shadowMap.autoUpdate = prevShadow; r.xr.enabled = prevXR;
    for (const o of this.hide) o.visible = true;
  }
}

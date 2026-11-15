// lib/mirror.js — planar mirror for large water (desktop). Re-renders the layer-6 objects from a camera mirrored below y=0
// into a half-resolution HDR target; the water material samples it projectively. Everything is at or above y=0, so no clipping is needed.
import * as THREE from 'three';

export const MIRROR_LAYER = 6;
export class WaterMirror {
  constructor(renderer, scene) {
    this.renderer = renderer; this.scene = scene; this.enabled = true; this.scale = 0.5;
    this.rt = new THREE.WebGLRenderTarget(256, 256, { type: THREE.HalfFloatType }); this.rt.texture.generateMipmaps = false;
    this.cam = new THREE.PerspectiveCamera(); this.cam.layers.set(MIRROR_LAYER);
    this.u = { tMirror: { value: this.rt.texture }, uMirrorMat: { value: new THREE.Matrix4() }, uMirrorOn: { value: 0 } };
  }
  setSize(w, h) { this.rt.setSize(Math.max(64, Math.floor(w * this.scale)), Math.max(64, Math.floor(h * this.scale))); }
  update(camera) {
    if (!this.enabled || camera.position.y < 1) { this.u.uMirrorOn.value = 0; return; }
    this.u.uMirrorOn.value = 1;
    const cam = this.cam, cp = camera.position; camera.updateMatrixWorld();
    const rot = new THREE.Matrix4().extractRotation(camera.matrixWorld), look = new THREE.Vector3(0, 0, -1).applyMatrix4(rot).add(cp);
    cam.position.set(cp.x, -cp.y, cp.z); const up = new THREE.Vector3(0, 1, 0).applyMatrix4(rot); up.y = -up.y; cam.up.copy(up); cam.lookAt(look.x, -look.y, look.z);
    cam.far = camera.far; cam.near = camera.near; cam.updateMatrixWorld(); cam.projectionMatrix.copy(camera.projectionMatrix); cam.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
    cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
    this.u.uMirrorMat.value.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1).multiply(cam.projectionMatrix).multiply(cam.matrixWorldInverse);
    const r = this.renderer, prevRT = r.getRenderTarget(), prevAuto = r.shadowMap.autoUpdate;
    r.shadowMap.autoUpdate = false; r.setRenderTarget(this.rt); r.clear(); r.render(this.scene, cam); r.setRenderTarget(prevRT); r.shadowMap.autoUpdate = prevAuto;
  }
}

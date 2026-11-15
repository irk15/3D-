// Image-based lighting from the live sky: glass towers and water reflect the real time-of-day sky.
import * as THREE from 'three';
export class Env {
  constructor(renderer, scene, sky) {
    this.pm = new THREE.PMREMGenerator(renderer); this.scene = scene; this.rt = null; this.last = -99;
    this.es = new THREE.Scene(); this.es.add(new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), sky.mat));
  }
  update(hour, force) {
    if (!force && this.rt && Math.abs(hour - this.last) < 0.25) return;
    this.last = hour; const rt = this.pm.fromScene(this.es, 0, 1, 1000);
    if (this.rt) this.rt.dispose(); this.rt = rt; this.scene.environment = rt.texture;
  }
}

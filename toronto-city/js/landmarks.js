import * as THREE from 'three';
import { lon2x, lat2z } from './proj.js';
import { CFG } from './config.js';
// CN Tower (553 m): lathe profile for shaft, pod and antenna.
export function cnTower(scene) {
  const pr = [[0, 0], [11, 0], [9, 30], [6.5, 150], [5, 300], [4.2, 335], [13, 337], [17, 346], [17, 352], [13, 358], [9, 360], [8, 362], [4.2, 363], [3.2, 450], [1.8, 500], [0.9, 553], [0, 553]].map(([r, y]) => new THREE.Vector2(r, y));
  const g = new THREE.LatheGeometry(pr, 24);
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xc9ccd0, roughness: 0.75 }));
  m.position.set(lon2x(CFG.CN_TOWER.lon), 0, lat2z(CFG.CN_TOWER.lat));
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(3, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2a2a, fog: false }));
  beacon.position.y = 553; m.add(beacon); scene.add(m);
  // lit observation pod band + red aviation lights, brighter at night
  const band = new THREE.Mesh(new THREE.CylinderGeometry(17.2, 17.2, 5, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0x555a60, toneMapped: false }));
  band.position.y = 346; m.add(band);
  const lights = new THREE.Mesh(new THREE.CylinderGeometry(4.3, 4.3, 2, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0x555a60, toneMapped: false })); lights.position.y = 400; m.add(lights);
  m.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  const setNight = (v) => { band.material.color.setRGB(0.33 + v * 2.2, 0.35 + v * 1.8, 0.38 + v * 1.1); lights.material.color.setRGB(0.33 + v * 2.4, 0.2 + v * 0.3, 0.2 + v * 0.3); };
  return { mesh: m, beacon, setNight };
}

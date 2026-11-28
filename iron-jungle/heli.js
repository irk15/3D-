// UH-60M Black Hawk by Yi Tsung Lee, CC BY 4.0 (see assets/blackhawk/license.txt). Materials converted
// to metallic-roughness for this game.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

let source;
export async function loadHelicopter(manager) {
  source = (await new GLTFLoader(manager).loadAsync('assets/blackhawk/scene.gltf')).scene;
  // put each rotor's origin on its hub so it can spin in place
  const rotors = [];
  source.traverse(o => { if (o.isMesh && /rotor/i.test(o.parent.name)) rotors.push(o); });
  for (const m of rotors) {
    m.geometry.computeBoundingBox(); const c = m.geometry.boundingBox.getCenter(new THREE.Vector3()), size = m.geometry.boundingBox.getSize(new THREE.Vector3());
    m.geometry.translate(-c.x, -c.y, -c.z); m.position.add(c.multiply(m.scale).applyQuaternion(m.quaternion));
    // spin about the thinnest axis of the blades
    m.userData.axis = size.x < size.y && size.x < size.z ? 'x' : size.y < size.z ? 'y' : 'z';
  }
  // a touch of self-light so the dark paint still reads against the night sky
  source.traverse(o => { if (o.isMesh) { const m = o.material; m.emissive.set(0x222c3a); m.emissiveIntensity = .55; } });
}

// returns a Black Hawk `length` units long, centred on its body with the nose towards -x
export function helicopter(length, shadows = true) {
  const model = source.clone(true), box = new THREE.Box3().setFromObject(model), size = box.getSize(new THREE.Vector3()), centre = box.getCenter(new THREE.Vector3());
  const pivot = new THREE.Group(), out = new THREE.Group(), rotors = [];
  model.position.sub(centre); pivot.add(model);
  pivot.rotation.y = size.z > size.x ? -Math.PI / 2 : Math.PI; // exported nose points along +z
  pivot.scale.setScalar(length / Math.max(size.x, size.z)); out.add(pivot);
  model.traverse(o => { if (!o.isMesh) return; o.castShadow = o.receiveShadow = shadows; if (o.userData.axis) rotors.push(o); });
  out.userData.spin = dt => { for (const r of rotors) r.rotateOnAxis(r.userData.axis === 'x' ? X : r.userData.axis === 'y' ? Y : Z, dt * 27); };
  out.userData.height = size.y * pivot.scale.y;
  return out;
}
const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);

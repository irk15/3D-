// Car catalogue. Models are real, hand-built 3D cars (credits in CREDITS.md).
// rotY: rotation that makes the model's nose point toward +Z.
// paint: material names that make up the body paint.

export const CARS = [
  {
    id: 'ferrari',
    make: 'Ferrari',
    name: '458 Italia',
    tag: 'V8 · Mid-engine · RWD',
    file: 'models/ferrari.glb',
    rotY: Math.PI,
    length: 4.53,
    paint: ['Body_Color'],
    color: '#c1121f',
    finish: 'gloss',
    stats: { hp: 562, torque: 540, zero100: 3.4, top: 325, weight: 1485, handling: 0.93 },
    engine: { cyl: 8, idle: 1000, redline: 9000, tone: 1.15 },
    credit: {
      title: 'Ferrari 458 Italia',
      author: 'vicent091036 (via the three.js examples)',
      url: 'https://threejs.org/examples/#webgl_materials_car',
      license: 'As distributed with the three.js examples (credit the author)'
    }
  },
  {
    id: 'porsche',
    make: 'Porsche',
    name: '911 Carrera 4S',
    tag: 'Flat-6 · Twin-turbo · AWD',
    file: 'models/porsche.glb',
    rotY: 0,
    length: 4.52,
    paint: ['paint'],
    color: '#d7dde4',
    finish: 'metallic',
    stats: { hp: 443, torque: 530, zero100: 3.6, top: 306, weight: 1565, handling: 0.95 },
    engine: { cyl: 6, idle: 900, redline: 7500, tone: 1.0 },
    credit: {
      title: '(FREE) Porsche 911 Carrera 4S',
      author: 'Karol Miklas',
      url: 'https://sketchfab.com/3d-models/free-porsche-911-carrera-4s-d01b254483794de3819786d93e0e1ebf',
      license: 'CC BY-SA 4.0'
    }
  },
  {
    id: 'challenger',
    make: 'Dodge',
    name: 'Challenger SRT',
    tag: 'Supercharged V8 · Muscle · RWD',
    file: 'models/challenger.glb',
    rotY: 0,
    length: 5.03,
    paint: ['Material__289'],
    color: '#111216',
    finish: 'matte',
    stats: { hp: 717, torque: 889, zero100: 3.7, top: 320, weight: 2018, handling: 0.74 },
    engine: { cyl: 8, idle: 750, redline: 6400, tone: 0.75 },
    credit: {
      title: 'Dodge CHALLENGER',
      author: 'Gesy',
      url: 'https://sketchfab.com/3d-models/dodge-challenger-2c1f18d2f0214cb7a746fc5dd2baeebe',
      license: 'CC BY 4.0'
    }
  },
  {
    id: 'concept',
    make: 'Apex',
    name: 'Concept GT',
    tag: 'Hybrid V10 · Prototype · AWD',
    file: 'models/concept.glb',
    rotY: 0,
    length: 4.7,
    paint: ['Material.008'],
    color: '#c6ff1a',
    finish: 'pearl',
    stats: { hp: 820, torque: 900, zero100: 2.6, top: 352, weight: 1390, handling: 0.97 },
    engine: { cyl: 10, idle: 1100, redline: 9500, tone: 1.3 },
    credit: {
      title: 'Concept Sport Car',
      author: 'KTKR',
      url: 'https://sketchfab.com/3d-models/concept-sport-car-566075bdb499404b908895a5f4dc6aa0',
      license: 'CC BY 4.0'
    }
  }
];

export const PAINTS = [
  { name: 'Rosso Corsa', hex: '#c1121f' },
  { name: 'Lava Orange', hex: '#ff5a00' },
  { name: 'Solar Yellow', hex: '#ffc300' },
  { name: 'Toxic Lime', hex: '#c6ff1a' },
  { name: 'Racing Green', hex: '#0b4d2c' },
  { name: 'Miami Teal', hex: '#00c2c7' },
  { name: 'Electric Blue', hex: '#1f4fff' },
  { name: 'Midnight Purple', hex: '#3a0ca3' },
  { name: 'Hot Magenta', hex: '#ff1f8f' },
  { name: 'GT Silver', hex: '#d7dde4' },
  { name: 'Pearl White', hex: '#f4f4f0' },
  { name: 'Stealth Black', hex: '#111216' }
];

export const FINISHES = {
  gloss:    { label: 'Gloss',    metalness: 0.15, roughness: 0.32, clearcoat: 1,   clearcoatRoughness: 0.03, iridescence: 0 },
  metallic: { label: 'Metallic', metalness: 0.75, roughness: 0.32, clearcoat: 1,   clearcoatRoughness: 0.05, iridescence: 0 },
  matte:    { label: 'Matte',    metalness: 0.25, roughness: 0.78, clearcoat: 0,   clearcoatRoughness: 0.6,  iridescence: 0 },
  chrome:   { label: 'Chrome',   metalness: 1.0,  roughness: 0.06, clearcoat: 1,   clearcoatRoughness: 0.02, iridescence: 0 },
  pearl:    { label: 'Pearl',    metalness: 0.45, roughness: 0.25, clearcoat: 1,   clearcoatRoughness: 0.04, iridescence: 1 }
};

export const MOODS = {
  neon:     { label: 'Neon Night', a: '#00e5ff', b: '#ff2bd6', key: 1.0, env: 1.0, exposure: 1.0,  ceiling: 1.0 },
  showroom: { label: 'Showroom',   a: '#e8eefc', b: '#e8eefc', key: 1.35, env: 1.45, exposure: 1.12, ceiling: 1.4 },
  sunset:   { label: 'Sunset',     a: '#ff8a1f', b: '#ff2e4d', key: 0.9, env: 0.9, exposure: 1.02, ceiling: 0.75 }
};

export const UNDERGLOW = ['#00e5ff', '#ff2bd6', '#7cff3a', '#ff7a00', '#8a5cff', '#ffffff'];

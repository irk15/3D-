// Action-based input (keyboard / gamepad / touch) with rebinding, radial deadzone,
// response curves, device detection and persisted settings.
const LS = 'apex-input-v1';
export const ACTIONS = [
  ['throttle', 'Throttle'], ['brake', 'Brake / reverse'], ['left', 'Steer left'], ['right', 'Steer right'],
  ['hand', 'Handbrake · drift'], ['nitro', 'Nitro'], ['up', 'Shift up'], ['down', 'Shift down'],
  ['camera', 'Change camera'], ['back', 'Look back'], ['reset', 'Reset to track'], ['pause', 'Pause']
];
const DEF_KEYS = {
  throttle: ['KeyW', 'ArrowUp'], brake: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  hand: ['Space'], nitro: ['ShiftLeft', 'ShiftRight'], up: ['KeyE'], down: ['KeyQ'],
  camera: ['KeyC'], back: ['KeyB'], reset: ['KeyR'], pause: ['Escape', 'KeyP']
};
// standard gamepad mapping indices
const DEF_PAD = { throttle: [7], brake: [6], left: [14], right: [15], hand: [2], nitro: [0], up: [5], down: [4], camera: [1], back: [3], reset: [8], pause: [9] };
export const PAD_NAMES = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'View', 'Menu', 'L3', 'R3', 'D-Up', 'D-Down', 'D-Left', 'D-Right', 'Home'];
export const DEFAULT_SETTINGS = {
  steerSpeed: 1, steerCurve: 1.4, deadzone: 0.12, vibration: 1, shake: 1, fovKick: 1, units: 'kmh',
  master: 0.9, engine: 0.85, sfx: 0.9, blur: 1, quality: 'auto'
};

export const keyName = (code) => code.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Arrow/, '').replace('Left', ' L').replace('Right', ' R').replace('Space', 'Space').replace('Escape', 'Esc').replace(/^Up$/, '↑').replace(/^Down$/, '↓').replace(/^ L$/, '←').replace(/^ R$/, '→');

function load() {
  try { return JSON.parse(localStorage.getItem(LS) || '{}'); } catch { return {}; }
}
const saved = load();
export const settings = { ...DEFAULT_SETTINGS, ...(saved.settings || {}) };
export const binds = { keys: { ...DEF_KEYS, ...(saved.keys || {}) }, pad: { ...DEF_PAD, ...(saved.pad || {}) } };
export function save() { try { localStorage.setItem(LS, JSON.stringify({ settings, keys: binds.keys, pad: binds.pad })); } catch { /* ignore */ } }
export function resetBinds() { binds.keys = JSON.parse(JSON.stringify(DEF_KEYS)); binds.pad = JSON.parse(JSON.stringify(DEF_PAD)); save(); }

const down = new Set();
const edges = new Set();
const listeners = new Set();
let device = 'kb';
let capture = null;
export const touch = {};
export function onDevice(fn) { listeners.add(fn); }
function setDevice(d) { if (d !== device) { device = d; listeners.forEach((f) => f(d)); } }
export const getDevice = () => device;

addEventListener('keydown', (e) => {
  if (capture && capture.kind === 'key') {
    e.preventDefault(); e.stopPropagation();
    const c = capture; capture = null;
    c.done(e.code === 'Escape' ? null : e.code);
    return;
  }
  setDevice('kb');
  if (!down.has(e.code)) edges.add(e.code);
  down.add(e.code);
}, true);
addEventListener('keyup', (e) => down.delete(e.code), true);
addEventListener('blur', () => down.clear());
addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') setDevice('touch'); });

let padPrev = [];
let pad = null;
export function getPad() { return pad; }
function pollPad() {
  pad = null;
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const p of pads) if (p && p.connected) { pad = p; break; }
  if (!pad) return [];
  const now = pad.buttons.map((b) => b.pressed || b.value > 0.5);
  const moved = Math.hypot(pad.axes[0] || 0, pad.axes[1] || 0) > 0.4 || now.some(Boolean);
  if (moved) setDevice('pad');
  if (capture && capture.kind === 'pad') {
    const i = now.findIndex((v, k) => v && !padPrev[k]);
    if (i >= 0) { const c = capture; capture = null; c.done(i === 9 ? null : i); }
  }
  const pressed = now.map((v, k) => v && !padPrev[k]);
  padPrev = now;
  return pressed;
}

// capture the next key / button for rebinding
export function captureBinding(kind, done) { capture = { kind, done }; }
export function cancelCapture() { capture = null; }
export function setBinding(kind, action, value) {
  const table = kind === 'key' ? binds.keys : binds.pad;
  let conflict = null;
  for (const [a, list] of Object.entries(table)) {
    if (a !== action && list.includes(value)) { conflict = a; table[a] = list.filter((v) => v !== value); }
  }
  table[action] = [value, ...(table[action] || []).filter((v) => v !== value)].slice(0, kind === 'key' ? 2 : 1);
  save();
  return conflict;
}

// poll once per frame; returns continuous axes and edge-triggered actions
export function poll() {
  const padPressed = pollPad();
  const kHeld = (a) => binds.keys[a]?.some((c) => down.has(c));
  const kEdge = (a) => binds.keys[a]?.some((c) => edges.has(c));
  const pVal = (a) => pad ? Math.max(0, ...binds.pad[a].map((i) => pad.buttons[i]?.value || (pad.buttons[i]?.pressed ? 1 : 0))) : 0;
  const pEdge = (a) => pad ? binds.pad[a].some((i) => padPressed[i]) : false;
  const out = { steer: 0, gas: 0, brake: 0, hand: false, nitro: false, up: false, down: false, back: false, analog: false, look: [0, 0], pressed: {} };
  if (kHeld('left') || touch.left) out.steer -= 1;
  if (kHeld('right') || touch.right) out.steer += 1;
  out.gas = kHeld('throttle') || touch.gas ? 1 : 0;
  out.brake = kHeld('brake') || touch.brake ? 1 : 0;
  out.hand = kHeld('hand') || !!touch.hand;
  out.nitro = kHeld('nitro') || !!touch.nitro;
  out.up = kHeld('up'); out.down = kHeld('down'); out.back = kHeld('back');
  if (pad) {
    // radial deadzone + response curve on the left stick
    const x = pad.axes[0] || 0, y = pad.axes[1] || 0, m = Math.hypot(x, y), dz = settings.deadzone;
    if (m > dz) {
      const k = Math.min(1, (m - dz) / (1 - dz));
      out.steer = Math.sign(x) * Math.pow(Math.abs(x / m) * k, settings.steerCurve);
      out.analog = true;
    } else if (pVal('left') || pVal('right')) out.steer = pVal('right') - pVal('left');
    out.gas = Math.max(out.gas, pVal('throttle'));
    out.brake = Math.max(out.brake, pVal('brake'));
    out.hand ||= pVal('hand') > 0.5; out.nitro ||= pVal('nitro') > 0.5;
    out.up ||= pVal('up') > 0.5; out.down ||= pVal('down') > 0.5; out.back ||= pVal('back') > 0.5;
    const rx = pad.axes[2] || 0, ry = pad.axes[3] || 0;
    if (Math.hypot(rx, ry) > 0.2) out.look = [rx, ry];
  }
  for (const [a] of ACTIONS) out.pressed[a] = kEdge(a) || pEdge(a);
  edges.clear();
  return out;
}

export function rumble(strong, weak, ms = 120) {
  const a = pad?.vibrationActuator;
  const k = settings.vibration;
  if (k > 0 && a?.playEffect) a.playEffect('dual-rumble', { duration: ms, strongMagnitude: Math.min(1, strong * k), weakMagnitude: Math.min(1, weak * k) }).catch(() => {});
}

export function prompt(action) {
  if (device === 'pad') return PAD_NAMES[binds.pad[action]?.[0]] || '?';
  return keyName(binds.keys[action]?.[0] || '?');
}

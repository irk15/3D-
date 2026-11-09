// Gamepad / keyboard navigation for menus: D-pad or arrows move focus spatially,
// A / Enter activates, B / Esc goes back. The top-most open screen owns input.
const screens = []; // { el: () => Element|null, open: () => bool, back: () => void }
export function registerScreen(s) { screens.push(s); }
const FOCUSABLE = 'button:not([disabled]), select:not([disabled]), input:not([disabled]), [tabindex="0"]';
const visible = (e) => e && e.offsetParent !== null && getComputedStyle(e).visibility !== 'hidden';
function top() { for (let i = screens.length - 1; i >= 0; i--) if (screens[i].open()) return screens[i]; return null; }
function items(root) { return [...root.querySelectorAll(FOCUSABLE)].filter(visible); }

function move(dx, dy) {
  const s = top(); if (!s) return false;
  const root = s.el(); const list = items(root); if (!list.length) return false;
  const cur = list.includes(document.activeElement) ? document.activeElement : null;
  if (!cur) { list[0].focus(); return true; }
  const a = cur.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2;
  let best = null, bs = Infinity;
  for (const e of list) {
    if (e === cur) continue;
    const b = e.getBoundingClientRect(), bx = b.left + b.width / 2, by = b.top + b.height / 2;
    const vx = bx - ax, vy = by - ay;
    const along = vx * dx + vy * dy; if (along <= 4) continue;
    const across = Math.abs(vx * dy - vy * dx);
    const score = along + across * 2.2;
    if (score < bs) { bs = score; best = e; }
  }
  if (best) { best.focus(); best.scrollIntoView?.({ block: 'nearest' }); }
  return true;
}
function adjust(dir) {
  const e = document.activeElement;
  if (e?.type === 'range') { const st = +e.step || 0.05; e.value = Math.min(+e.max, Math.max(+e.min, +e.value + dir * st)); e.dispatchEvent(new Event('input', { bubbles: true })); return true; }
  if (e?.tagName === 'SELECT') { e.selectedIndex = Math.max(0, Math.min(e.options.length - 1, e.selectedIndex + dir)); e.dispatchEvent(new Event('change', { bubbles: true })); return true; }
  return false;
}

addEventListener('keydown', (e) => {
  const s = top(); if (!s) return;
  const typing = e.target.tagName === 'INPUT' && e.target.type !== 'range';
  if (e.key === 'Escape') { e.preventDefault(); s.back('key'); return; }
  if (typing) return;
  const d = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.key];
  if (d) {
    if (d[1] === 0 && adjust(d[0])) { e.preventDefault(); return; }
    if (move(d[0], d[1])) e.preventDefault();
  }
});

let prev = [], repeatT = 0;
function poll(t) {
  requestAnimationFrame(poll);
  const s = top();
  const pad = navigator.getGamepads ? [...navigator.getGamepads()].find((p) => p && p.connected) : null;
  if (!pad || !s) { prev = []; return; }
  const b = pad.buttons.map((x) => x.pressed);
  const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
  const dirs = [[12, 0, -1, ay < -0.6], [13, 0, 1, ay > 0.6], [14, -1, 0, ax < -0.6], [15, 1, 0, ax > 0.6]];
  for (const [i, dx, dy, stick] of dirs) {
    const on = b[i] || stick;
    const was = prev[i];
    if (on && (!was || t > repeatT)) {
      repeatT = t + (was ? 120 : 380);
      if (dy === 0 && adjust(dx)) continue;
      move(dx, dy);
    }
    b[i] = on;
  }
  if (b[0] && !prev[0]) { const e = document.activeElement; if (e && s.el().contains(e)) e.click(); else move(0, 1); }
  if (b[1] && !prev[1]) s.back('pad');
  prev = b;
}
requestAnimationFrame(poll);

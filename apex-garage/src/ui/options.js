// Options: control rebinding (keyboard + gamepad), driving feel, camera/visuals, audio.
import { ACTIONS, binds, settings, save, resetBinds, captureBinding, cancelCapture, setBinding, keyName, PAD_NAMES, DEFAULT_SETTINGS } from '../race/input.js';

const SLIDERS = {
  driving: [
    ['steerSpeed', 'Keyboard steering speed', 0.5, 1.8, 0.05, (v) => `${Math.round(v * 100)}%`],
    ['steerCurve', 'Stick response curve', 1, 2.4, 0.1, (v) => (v < 1.15 ? 'Linear' : v < 1.7 ? `Smooth ${v.toFixed(1)}` : `Precise ${v.toFixed(1)}`)],
    ['deadzone', 'Stick deadzone', 0.02, 0.3, 0.01, (v) => `${Math.round(v * 100)}%`],
    ['vibration', 'Controller rumble', 0, 1, 0.05, (v) => (v ? `${Math.round(v * 100)}%` : 'Off')]
  ],
  visuals: [
    ['shake', 'Camera shake', 0, 1.5, 0.05, (v) => (v ? `${Math.round(v * 100)}%` : 'Off')],
    ['fovKick', 'Speed FOV effect', 0, 1.5, 0.05, (v) => (v ? `${Math.round(v * 100)}%` : 'Off')],
    ['blur', 'Motion blur', 0, 1.5, 0.05, (v) => (v ? `${Math.round(v * 100)}%` : 'Off')]
  ],
  audio: [
    ['master', 'Master volume', 0, 1, 0.05, (v) => `${Math.round(v * 100)}%`],
    ['engine', 'Engine', 0, 1, 0.05, (v) => `${Math.round(v * 100)}%`],
    ['sfx', 'Effects (tyres, wind, impacts)', 0, 1, 0.05, (v) => `${Math.round(v * 100)}%`]
  ]
};

export function createOptions({ onChange, toast }) {
  const el = document.createElement('div');
  el.id = 'options';
  el.innerHTML = `<div class="optCard" role="dialog" aria-label="Options">
    <header><div><em>APEX // SETTINGS</em><h2>OPTIONS</h2></div><button class="icon" data-close aria-label="Close">✕</button></header>
    <nav class="setupTabs"><button data-t="controls" class="active">Controls</button><button data-t="driving">Driving</button><button data-t="visuals">Camera & visuals</button><button data-t="audio">Audio</button></nav>
    <section data-p="controls" class="active"><table class="binds"><thead><tr><th>Action</th><th>Keyboard</th><th>Gamepad</th></tr></thead><tbody></tbody></table>
      <p class="hint">Click a binding, then press the new key or button (Esc or Menu cancels). If that input is already used, it moves to the new action.</p></section>
    <section data-p="driving"></section>
    <section data-p="visuals"><div class="optRow"><span>Graphics quality</span><div class="seg" data-k="quality"><button data-v="auto">Auto</button><button data-v="high">High</button><button data-v="medium">Medium</button><button data-v="low">Low</button></div></div>
      <div class="optRow"><span>Speed units</span><div class="seg" data-k="units"><button data-v="kmh">km/h</button><button data-v="mph">mph</button></div></div></section>
    <section data-p="audio"></section>
    <footer><button class="btn ghost" data-reset>Reset to defaults</button><button class="btn primary" data-close>Done</button></footer>
  </div>`;
  document.body.appendChild(el);
  const $ = (q) => el.querySelector(q);

  for (const [pane, list] of Object.entries(SLIDERS)) {
    const host = $(`[data-p="${pane}"]`);
    for (const [k, label, min, max, step] of list) {
      const row = document.createElement('label');
      row.className = 'optRow';
      row.innerHTML = `<span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}" data-s="${k}" /><b data-v="${k}"></b>`;
      host.appendChild(row);
    }
  }
  const fmtOf = Object.fromEntries(Object.values(SLIDERS).flat().map((r) => [r[0], r[5]]));
  el.querySelectorAll('input[type=range]').forEach((r) => r.addEventListener('input', () => {
    settings[r.dataset.s] = +r.value; save(); sync(); onChange?.(settings);
  }));
  el.querySelectorAll('.seg').forEach((sg) => sg.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    settings[sg.dataset.k] = b.dataset.v; save(); sync(); onChange?.(settings);
  }));
  el.querySelectorAll('.setupTabs button').forEach((b) => b.addEventListener('click', () => tab(b.dataset.t)));
  function tab(t) {
    el.querySelectorAll('.setupTabs button').forEach((b) => b.classList.toggle('active', b.dataset.t === t));
    el.querySelectorAll('[data-p]').forEach((p) => p.classList.toggle('active', p.dataset.p === t));
  }

  function renderBinds() {
    $('.binds tbody').innerHTML = ACTIONS.map(([a, label]) => `<tr><td>${label}</td>
      <td><button class="bind" data-kind="key" data-a="${a}">${(binds.keys[a] || []).map(keyName).join(' / ') || '—'}</button></td>
      <td><button class="bind" data-kind="pad" data-a="${a}">${(binds.pad[a] || []).map((i) => PAD_NAMES[i] || `B${i}`).join(' / ') || '—'}</button></td></tr>`).join('');
    el.querySelectorAll('.bind').forEach((b) => b.addEventListener('click', () => {
      el.querySelectorAll('.bind.wait').forEach((x) => x.classList.remove('wait'));
      b.classList.add('wait');
      b.textContent = b.dataset.kind === 'key' ? 'Press a key…' : 'Press a button…';
      captureBinding(b.dataset.kind, (v) => {
        if (v != null) {
          const moved = setBinding(b.dataset.kind, b.dataset.a, v);
          if (moved) toast?.(`Moved from "${ACTIONS.find((x) => x[0] === moved)[1]}"`);
        }
        renderBinds();
      });
    }));
  }
  function sync() {
    el.querySelectorAll('input[type=range]').forEach((r) => { r.value = settings[r.dataset.s]; el.querySelector(`[data-v="${r.dataset.s}"]`).textContent = fmtOf[r.dataset.s](settings[r.dataset.s]); });
    el.querySelectorAll('.seg').forEach((sg) => sg.querySelectorAll('button').forEach((b) => b.classList.toggle('active', settings[sg.dataset.k] === b.dataset.v)));
  }
  el.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
  el.addEventListener('click', (e) => { if (e.target === el) close(); });
  $('[data-reset]').addEventListener('click', () => {
    Object.assign(settings, DEFAULT_SETTINGS); resetBinds(); save(); renderBinds(); sync(); onChange?.(settings); toast?.('Defaults restored');
  });
  function open(t = 'controls') { renderBinds(); sync(); tab(t); el.classList.add('show'); setTimeout(() => el.querySelector('.setupTabs button.active')?.focus(), 30); }
  function close() { cancelCapture(); el.classList.remove('show'); onChange?.(settings); }
  return { open, close, get isOpen() { return el.classList.contains('show'); } };
}

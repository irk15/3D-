// Race HUD: DOM overlay, analogue tacho, rotating minimap, popups, menus.
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const fmt = (t) => {
  if (!isFinite(t) || t <= 0) return '--:--.--';
  const m = Math.floor(t / 60), s = t - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
};
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function createHud(actions) {
  const el = document.createElement('div');
  el.id = 'race';
  el.innerHTML = `
    <div class="rTop">
      <div class="rPos"><b id="rPos">1</b><span id="rOf">/1</span><em>POS</em></div>
      <div class="rLap"><em id="rLapLbl">LAP</em><b id="rLap">1/3</b></div>
      <div class="rTimes"><div><em>TIME</em><b id="rTime">0:00.00</b></div><div><em>BEST</em><b id="rBest">--:--.--</b></div><div><em>DELTA</em><b id="rDelta">—</b></div></div>
    </div>
    <div class="rMapWrap"><canvas id="rMap" width="240" height="240"></canvas></div>
    <div class="rBoard" id="rBoard"></div>
    <div class="rCenter"><div id="rCount"></div><div id="rMsg"></div></div>
    <div class="rPops" id="rPops"></div>
    <div class="rScore" id="rScore"></div>
    <div class="rSpeedo">
      <canvas id="rTach" width="300" height="300"></canvas>
      <div class="rRead"><b id="rSpd">0</b><span>KM/H</span><i id="rGear">N</i></div>
      <div class="rNos"><span>NITRO</span><i><em id="rNos"></em></i></div>
      <div class="rAssist" id="rAssist"></div>
    </div>
    <div class="rNet" id="rNet"></div>
    <div class="rHelp" id="rHelp"></div>
    <div class="rKeys" id="rKeys"></div>
    <div class="rTouch" id="rTouch">
      <div class="tl"><button data-k="left">◀</button><button data-k="right">▶</button></div>
      <div class="tr"><button data-k="hand">DRIFT</button><button data-k="nitro">NOS</button><button data-k="brake">BRK</button><button data-k="gas">GAS</button></div>
    </div>
    <div class="rOverlay" id="rPause"><div class="rCard"><h2>PAUSED</h2>
      <button class="btn primary" data-a="resume">Resume</button>
      <button class="btn" data-a="restart" id="rPauseRestart">Restart</button>
      <button class="btn" data-a="camera">Camera: <span id="rCamName">Chase</span></button>
      <button class="btn ghost" data-a="exit">Quit to garage</button></div></div>
    <div class="rOverlay" id="rResult"><div class="rCard wide"><h2 id="rResTitle">RACE COMPLETE</h2><div id="rResSub" class="rSub"></div>
      <table id="rResTable"></table>
      <div class="rBtns"><button class="btn primary" data-a="restart" id="rAgain">Race again</button><button class="btn" data-a="replay">▶ Replay</button><button class="btn ghost" data-a="exit" id="rExit">Garage</button></div></div></div>
    <div class="rReplay" id="rReplay"><b>REPLAY</b><span id="rRepTime">0:00</span>
      <button data-a="rp-play">❚❚</button><button data-a="rp-slow">0.5×</button><button data-a="rp-fast">2×</button><button data-a="rp-focus">Focus ▸</button><button data-a="rp-cam">TV cam</button><button data-a="rp-exit">Close</button>
      <input type="range" id="rRepSeek" min="0" max="1000" value="0" /></div>`;
  document.body.appendChild(el);
  const $ = (id) => el.querySelector('#' + id);
  const E = {};
  ['rPos', 'rOf', 'rLap', 'rLapLbl', 'rTime', 'rBest', 'rDelta', 'rCount', 'rMsg', 'rPops', 'rScore', 'rSpd', 'rGear', 'rNos', 'rAssist', 'rBoard', 'rNet', 'rKeys', 'rPause', 'rResult', 'rResTitle', 'rResSub', 'rResTable', 'rReplay', 'rRepTime', 'rRepSeek', 'rCamName', 'rAgain', 'rExit', 'rPauseRestart', 'rHelp'].forEach((k) => (E[k] = $(k)));
  el.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => actions(b.dataset.a, b)));
  E.rRepSeek.addEventListener('input', () => actions('rp-seek', E.rRepSeek));
  const touch = {};
  el.querySelectorAll('#rTouch button').forEach((b) => {
    const k = b.dataset.k;
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); touch[k] = true; b.classList.add('on'); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => b.addEventListener(ev, () => { touch[k] = false; b.classList.remove('on'); }));
  });
  if (matchMedia('(pointer: coarse)').matches) el.classList.add('touch');

  const tach = $('rTach').getContext('2d');
  const mapC = $('rMap'), map = mapC.getContext('2d');
  let mapBase = null, mapTf = null, msgT = 0, boardT = 1, lastTach = '';

  function drawTach(rpm, red, shiftLight, accent) {
    const key = `${Math.round(rpm / 50)}|${red}|${shiftLight}`;
    if (key === lastTach) return;
    lastTach = key;
    const c = tach, cx = 150, cy = 150, R = 128;
    const maxR = Math.ceil(red / 1000) * 1000 + 1000;
    const a0 = Math.PI * 0.72, a1 = Math.PI * 2.28;
    const ang = (v) => a0 + (v / maxR) * (a1 - a0);
    c.clearRect(0, 0, 300, 300);
    c.lineWidth = 14; c.strokeStyle = 'rgba(255,255,255,.07)';
    c.beginPath(); c.arc(cx, cy, R, a0, a1); c.stroke();
    c.strokeStyle = 'rgba(255,35,60,.45)'; c.beginPath(); c.arc(cx, cy, R, ang(red), a1); c.stroke();
    const k = clamp(rpm, 0, maxR);
    const grad = c.createLinearGradient(30, 250, 270, 50);
    grad.addColorStop(0, accent); grad.addColorStop(1, rpm > red * 0.92 ? '#ff2a3d' : '#ffffff');
    c.strokeStyle = grad; c.shadowColor = accent; c.shadowBlur = 16;
    c.beginPath(); c.arc(cx, cy, R, a0, ang(k)); c.stroke();
    c.shadowBlur = 0;
    c.fillStyle = 'rgba(255,255,255,.6)'; c.font = '600 14px Rajdhani, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    const step = maxR > 12000 ? 2000 : 1000;
    for (let v = 0; v <= maxR; v += step) {
      const a = ang(v);
      c.fillText(v / 1000, cx + Math.cos(a) * (R - 26), cy + Math.sin(a) * (R - 26));
      c.strokeStyle = 'rgba(255,255,255,.3)'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(cx + Math.cos(a) * (R - 12), cy + Math.sin(a) * (R - 12)); c.lineTo(cx + Math.cos(a) * (R - 4), cy + Math.sin(a) * (R - 4)); c.stroke();
    }
    // needle
    const an = ang(k);
    c.strokeStyle = '#ff3b3b'; c.lineWidth = 4; c.lineCap = 'round';
    c.beginPath(); c.moveTo(cx + Math.cos(an) * 30, cy + Math.sin(an) * 30); c.lineTo(cx + Math.cos(an) * (R - 8), cy + Math.sin(an) * (R - 8)); c.stroke();
    // shift lights
    for (let i = 0; i < 7; i++) {
      const on = shiftLight > i / 7;
      c.fillStyle = on ? (i < 3 ? '#38ff7a' : i < 5 ? '#ffd23f' : '#ff2a3d') : 'rgba(255,255,255,.08)';
      c.beginPath(); c.arc(cx - 60 + i * 20, 52, 6, 0, 7); c.fill();
    }
    c.fillStyle = 'rgba(255,255,255,.4)'; c.font = '600 11px Orbitron, sans-serif'; c.fillText('x1000 RPM', cx, cy + 88);
  }

  function buildMap(track) {
    const { P, bounds } = track;
    const s = 200 / bounds.span;
    mapTf = (x, z) => [(x - bounds.cx) * s, (z - bounds.cz) * s];
    mapBase = new Path2D();
    P.forEach((p, i) => { const [x, y] = mapTf(p.x, p.z); i ? mapBase.lineTo(x, y) : mapBase.moveTo(x, y); });
    mapBase.closePath();
    const [sx, sy] = mapTf(P[0].x, P[0].z);
    mapBase.start = [sx, sy];
  }
  function drawMap(racers, me, heading) {
    if (!mapBase) return;
    map.setTransform(1, 0, 0, 1, 0, 0);
    map.clearRect(0, 0, 240, 240);
    const [mx, my] = mapTf(me.st.x, me.st.z);
    map.translate(120, 120);
    map.rotate(Math.PI + heading); // player-up
    map.scale(1.7, 1.7);
    map.translate(-mx, -my);
    map.lineJoin = 'round';
    map.strokeStyle = 'rgba(0,0,0,.6)'; map.lineWidth = 9; map.stroke(mapBase);
    map.strokeStyle = 'rgba(255,255,255,.85)'; map.lineWidth = 4.2; map.stroke(mapBase);
    map.fillStyle = '#ff2bd6'; map.fillRect(mapBase.start[0] - 2, mapBase.start[1] - 2, 4, 4);
    for (const r of racers) {
      if (r === me) continue;
      const [x, y] = mapTf(r.st.x, r.st.z);
      map.beginPath(); map.arc(x, y, 3.6, 0, 7); map.fillStyle = r.ghost ? 'rgba(160,200,255,.6)' : r.color; map.fill();
    }
    map.beginPath(); map.arc(mx, my, 5, 0, 7); map.fillStyle = '#00e5ff'; map.fill(); map.lineWidth = 1.5; map.strokeStyle = '#fff'; map.stroke();
  }

  function pop(text, cls = '') {
    const d = document.createElement('div');
    d.className = 'pop ' + cls; d.textContent = text;
    E.rPops.appendChild(d);
    setTimeout(() => d.remove(), 1700);
    while (E.rPops.children.length > 4) E.rPops.firstChild.remove();
  }

  return {
    el, touch,
    show(on) { document.body.classList.toggle('racing', on); },
    setup({ track, mode, laps, keys, assists, total }) {
      buildMap(track);
      E.rLapLbl.textContent = 'LAP';
      E.rOf.textContent = `/${total}`;
      E.rKeys.textContent = keys;
      E.rAssist.textContent = assists;
      E.rBest.textContent = '--:--.--'; E.rDelta.textContent = '—'; E.rDelta.className = '';
      E.rScore.textContent = ''; E.rScore.style.display = mode === 'drift' ? 'block' : 'none';
      el.querySelector('.rPos').style.display = mode === 'race' ? '' : 'none';
      E.rBoard.style.display = mode === 'race' ? '' : 'none';
      E.rResult.classList.remove('show'); E.rPause.classList.remove('show'); E.rReplay.classList.remove('show');
      E.rCount.textContent = ''; E.rMsg.classList.remove('show'); E.rPops.innerHTML = '';
      lastTach = '';
      this.laps = laps;
    },
    help(bike, manual, on = true) {
      if (!on) { E.rHelp.classList.remove('show'); return; }
      const k = (x) => x.split(' ').map((t) => `<kbd>${t}</kbd>`).join('');
      const rows = [
        ['Throttle', k('W ↑'), 'RT'], ['Brake / reverse', k('S ↓'), 'LT'], [bike ? 'Lean' : 'Steer', k('A D ← →'), 'Left stick'],
        [bike ? 'Rear brake' : 'Handbrake · drift', k('Space'), 'X'], ['Nitro', k('Shift'), 'A'],
        ...(manual ? [['Shift down / up', k('Q E'), 'LB / RB']] : []),
        ['Camera · look back', k('C B'), 'B · Y'], ['Reset · pause', k('R Esc'), 'Start']
      ];
      E.rHelp.innerHTML = `<h3>CONTROLS</h3><table>${rows.map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('')}</table>
        <p>${bike ? 'Lean into corners and brake before you turn in. Hard launches lift the front wheel.' : 'Brake before the corner, turn in, then power out. Tap Space mid-corner to start a drift, steer to hold it, and straighten up to end it.'}<br/>Launch control: hold throttle so the shift lights turn green at GO.</p>`;
      E.rHelp.classList.add('show');
    },
    count(n) { E.rCount.textContent = n; E.rCount.className = ''; void E.rCount.offsetWidth; E.rCount.className = 'go'; },
    msg(text, t = 1.4) { E.rMsg.textContent = text; E.rMsg.classList.add('show'); msgT = t; },
    pop,
    frame(dt, f) {
      if (msgT > 0 && (msgT -= dt) <= 0) E.rMsg.classList.remove('show');
      E.rPos.textContent = f.pos;
      E.rLap.textContent = `${clamp(f.lap, 1, f.laps)}/${f.laps}`;
      E.rTime.textContent = fmt(f.time);
      E.rBest.textContent = fmt(f.best);
      if (f.delta != null) { E.rDelta.textContent = `${f.delta > 0 ? '+' : '−'}${Math.abs(f.delta).toFixed(2)}`; E.rDelta.className = f.delta > 0 ? 'bad' : 'good'; }
      E.rSpd.textContent = Math.round(f.kmh);
      E.rGear.textContent = f.gear;
      E.rNos.style.width = `${f.nitro * 100}%`;
      E.rNos.parentElement.classList.toggle('on', f.nitroOn);
      if (f.mode === 'drift') E.rScore.innerHTML = `<em>DRIFT SCORE</em><b>${Math.round(f.score).toLocaleString()}</b>${f.combo > 1 ? `<i>×${f.combo.toFixed(1)}</i>` : ''}${f.chain ? `<span>+${Math.round(f.chain).toLocaleString()}</span>` : ''}`;
      drawTach(f.rpm, f.redline, f.shiftLight, f.accent);
      drawMap(f.racers, f.me, f.me.st.h);
      if ((boardT += dt) > 0.25 && f.mode === 'race') {
        boardT = 0;
        E.rBoard.innerHTML = f.standings.map((r, i) => `<div class="${r === f.me ? 'me' : ''}"><b>${i + 1}</b><i style="background:${r === f.me ? '#00e5ff' : r.color}"></i><span>${esc(r.label)}</span><small>${i === 0 ? (r.finished ? 'FIN' : '') : r.gapText || ''}</small></div>`).join('');
      }
      if (f.net) E.rNet.textContent = f.net;
    },
    pause(on) { E.rPause.classList.toggle('show', on); },
    camName(n) { E.rCamName.textContent = n; },
    results({ title, sub, rows, cols, canRestart }) {
      E.rResTitle.textContent = title;
      E.rResSub.textContent = sub || '';
      E.rResTable.innerHTML = `<tr>${cols.map((c) => `<th>${c}</th>`).join('')}</tr>` + rows.map((r) => `<tr class="${r.me ? 'me' : ''}">${r.cells.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('');
      E.rAgain.style.display = canRestart ? '' : 'none';
      E.rExit.textContent = canRestart ? 'Garage' : 'Back to lobby';
      E.rResult.classList.add('show');
    },
    hideResults() { E.rResult.classList.remove('show'); },
    replay(on) { E.rReplay.classList.toggle('show', on); el.classList.toggle('replaying', on); },
    replayTime(t, k) { E.rRepTime.textContent = fmt(t).slice(0, -3); if (document.activeElement !== E.rRepSeek) E.rRepSeek.value = Math.round(k * 1000); },
    setRestartAllowed(ok) { E.rPauseRestart.style.display = ok ? '' : 'none'; E.rPauseRestart.parentElement.querySelector('[data-a=exit]').textContent = ok ? 'Quit to garage' : 'Leave race'; }
  };
}

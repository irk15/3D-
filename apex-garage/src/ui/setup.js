// Race setup (single player) and the online lobby (create / join with a room code).
import { TRACKS, trackData } from '../race/tracks.js';
import { HANDLING } from '../race/physics.js';
import { DIFFICULTY } from '../race/ai.js';
import { Room } from '../race/net.js';
import { fmt } from '../race/hud.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const load = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };

export function createSetup({ CARS, getVehicle, getColor, startRace, toast }) {
  const S = Object.assign({ mode: 'race', track: 'downtown', laps: 3, bots: 5, difficulty: 'normal', weather: 'clear', handling: 'sport', transmission: 'auto' }, load('apex-setup', {}));
  let name = load('apex-name', `Racer${Math.floor(100 + Math.random() * 900)}`);
  let room = null;

  const thumbs = Object.fromEntries(TRACKS.map((t) => [t.id, thumb(t)]));
  function thumb(def) {
    const { P } = trackData(def, 400);
    let a = 1e9, b = -1e9, c = 1e9, d = -1e9;
    for (const p of P) { a = Math.min(a, p.x); b = Math.max(b, p.x); c = Math.min(c, p.z); d = Math.max(d, p.z); }
    const s = 120 / Math.max(b - a, d - c);
    const pts = P.map((p) => `${(14 + (p.x - a) * s).toFixed(1)},${(14 + (p.z - c) * s).toFixed(1)}`).join(' ');
    return `<svg viewBox="0 0 148 148"><polygon points="${pts}" fill="none" stroke="rgba(0,0,0,.5)" stroke-width="7" stroke-linejoin="round"/><polygon points="${pts}" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linejoin="round"/></svg>`;
  }
  const seg = (key, opts) => `<div class="seg" data-k="${key}">${Object.entries(opts).map(([v, l]) => `<button data-v="${v}">${l}</button>`).join('')}</div>`;

  const ov = document.createElement('div');
  ov.id = 'setup';
  ov.innerHTML = `<div class="setupCard">
    <header><div><em>APEX // RACE</em><h2>RACE SETUP</h2></div><button class="icon" data-x>✕</button></header>
    <nav class="setupTabs"><button data-tab="solo" class="active">Single player</button><button data-tab="online">Online · play with friends</button></nav>
    <section data-pane="solo" class="active">
      <h4>Mode</h4>${seg('mode', { race: 'Race', tt: 'Time trial', drift: 'Drift attack' })}
      <h4>Track</h4><div class="tracks">${TRACKS.map((t) => `<button class="trk" data-t="${t.id}">${thumbs[t.id]}<b>${t.name}</b><span>${t.desc}</span><i data-best="${t.id}"></i></button>`).join('')}</div>
      <div class="grid2">
        <div><h4>Laps</h4>${seg('laps', { 1: '1', 2: '2', 3: '3', 5: '5' })}</div>
        <div class="botsRow"><h4>Opponents</h4>${seg('bots', { 0: '0', 3: '3', 5: '5', 7: '7' })}</div>
        <div class="botsRow"><h4>AI difficulty</h4>${seg('difficulty', Object.fromEntries(Object.entries(DIFFICULTY).map(([k, v]) => [k, v.label])))}</div>
        <div><h4>Weather</h4>${seg('weather', { clear: 'Clear', rain: 'Rain' })}</div>
        <div><h4>Handling</h4>${seg('handling', Object.fromEntries(Object.entries(HANDLING).map(([k, v]) => [k, v.label])))}</div>
        <div><h4>Gearbox</h4>${seg('transmission', { auto: 'Automatic', manual: 'Manual' })}</div>
      </div>
      <p class="hint" id="handHint"></p>
      <footer><div class="veh" id="vehSolo"></div><button class="btn primary" data-go>START ▶</button></footer>
    </section>
    <section data-pane="online">
      <div class="onlineIntro">Create a room and share the code. Friends open this page, choose <b>Online</b>, and enter the code. Up to 8 players, and empty spots can be filled with AI.</div>
      <h4>Your name</h4><input id="mpName" maxlength="16" />
      <div class="mpRow">
        <button class="btn primary" data-create>Create room</button>
        <span class="or">or</span>
        <input id="mpCode" maxlength="5" placeholder="CODE" autocomplete="off" />
        <button class="btn" data-join>Join</button>
      </div>
      <p class="status" id="mpStatus"></p>
    </section>
  </div>`;
  document.body.appendChild(ov);

  const lob = document.createElement('aside');
  lob.id = 'lobby';
  lob.innerHTML = `
    <header><div><em>ONLINE ROOM</em><b id="lbCode">-----</b></div><button class="btn ghost" data-copy>Copy invite link</button></header>
    <ul id="lbPlayers"></ul>
    <div id="lbHost">
      <h4>Track</h4><select id="lbTrack">${TRACKS.map((t) => `<option value="${t.id}">${t.name}</option>`).join('')}</select>
      <div class="grid2">
        <div><h4>Laps</h4><select id="lbLaps">${[1, 2, 3, 5].map((n) => `<option>${n}</option>`).join('')}</select></div>
        <div><h4>AI fill</h4><select id="lbBots">${[0, 1, 2, 3, 4, 5, 6, 7].map((n) => `<option>${n}</option>`).join('')}</select></div>
        <div><h4>Weather</h4><select id="lbWeather"><option value="clear">Clear</option><option value="rain">Rain</option></select></div>
        <div><h4>AI level</h4><select id="lbDiff">${Object.entries(DIFFICULTY).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}</select></div>
      </div>
    </div>
    <div id="lbInfo" class="hint"></div>
    <div class="grid2"><div><h4>Your handling</h4><select id="lbHand">${Object.entries(HANDLING).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}</select></div><div><h4>Gearbox</h4><select id="lbTrans"><option value="auto">Automatic</option><option value="manual">Manual</option></select></div></div>
    <p class="hint">Pick your car or bike in the garage. Everyone sees your choice.</p>
    <div id="lbChat"></div>
    <form id="lbChatForm"><input id="lbMsg" maxlength="140" placeholder="Say something…" autocomplete="off" /><button class="btn">Send</button></form>
    <footer><button class="btn ghost" data-leave>Leave</button><button class="btn primary" id="lbGo">Ready</button></footer>`;
  document.body.appendChild(lob);
  const $ = (r, q) => r.querySelector(q);

  /* ───── solo pane ───── */
  function syncSolo() {
    ov.querySelectorAll('.seg').forEach((sg) => sg.querySelectorAll('button').forEach((b) => b.classList.toggle('active', String(S[sg.dataset.k]) === b.dataset.v)));
    ov.querySelectorAll('.trk').forEach((b) => b.classList.toggle('active', b.dataset.t === S.track));
    ov.querySelectorAll('.botsRow').forEach((r) => (r.style.opacity = S.mode === 'race' ? 1 : 0.35));
    const v = CARS[getVehicle()];
    $(ov, '#vehSolo').innerHTML = `<em>${v.type === 'bike' ? 'BIKE' : 'CAR'}</em><b>${esc(v.make)} ${esc(v.name)}</b><span>Change vehicle in the garage</span>`;
    const H = HANDLING[S.handling];
    $(ov, '#handHint').textContent = { arcade: 'Arcade: extra grip, easy guided drifts with the handbrake, full assists.', sport: 'Sport: realistic grip with traction and stability control. Handbrake drifts are still guided.', sim: 'Simulation: raw tyre physics, no assists. Power oversteer and lock-ups are real, and bikes can low-side.' }[H.id];
    for (const t of TRACKS) {
      const best = load(`apex-best-${t.id}-${v.id}-${S.handling}`, null);
      const el = ov.querySelector(`[data-best="${t.id}"]`);
      el.textContent = best ? `Best ${fmt(best)}` : '';
    }
    save('apex-setup', S);
  }
  ov.querySelectorAll('.seg').forEach((sg) => sg.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const v = b.dataset.v; S[sg.dataset.k] = isNaN(+v) ? v : +v; syncSolo();
  }));
  ov.querySelectorAll('.trk').forEach((b) => b.addEventListener('click', () => { S.track = b.dataset.t; syncSolo(); }));
  ov.querySelectorAll('.setupTabs button').forEach((b) => b.addEventListener('click', () => tab(b.dataset.tab)));
  function tab(t) {
    ov.querySelectorAll('.setupTabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === t));
    ov.querySelectorAll('[data-pane]').forEach((p) => p.classList.toggle('active', p.dataset.pane === t));
  }
  $(ov, '[data-x]').addEventListener('click', close);
  ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
  $(ov, '[data-go]').addEventListener('click', () => { close(); startRace({ ...S, vehicle: getVehicle() }); });

  /* ───── online ───── */
  const nameIn = $(ov, '#mpName'), codeIn = $(ov, '#mpCode'), status = $(ov, '#mpStatus');
  nameIn.value = name;
  nameIn.addEventListener('change', () => { name = nameIn.value.trim().slice(0, 16) || name; save('apex-name', name); });
  codeIn.addEventListener('input', () => { codeIn.value = codeIn.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
  const busy = (b) => ov.querySelectorAll('[data-create],[data-join]').forEach((x) => (x.disabled = b));
  $(ov, '[data-create]').addEventListener('click', async () => {
    name = nameIn.value.trim().slice(0, 16) || name; save('apex-name', name);
    busy(true); status.textContent = 'Creating room…';
    room = new Room();
    try {
      await room.host({ name, veh: getVehicle() }, { track: S.track, laps: S.laps, bots: 2, weather: S.weather, difficulty: S.difficulty });
      wireRoom(); close(); showLobby();
    } catch (e) { status.textContent = e.message; room = null; }
    busy(false);
  });
  $(ov, '[data-join]').addEventListener('click', join);
  codeIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') join(); });
  async function join() {
    const code = codeIn.value.trim();
    if (code.length !== 5) { status.textContent = 'Enter the 5-character room code.'; return; }
    name = nameIn.value.trim().slice(0, 16) || name; save('apex-name', name);
    busy(true); status.textContent = `Joining ${code}…`;
    room = new Room();
    try { await room.join(code, { name, veh: getVehicle() }); wireRoom(); close(); showLobby(); }
    catch (e) { status.textContent = e.message; try { room.leave(); } catch { /* ignore */ } room = null; }
    busy(false);
  }

  /* ───── lobby ───── */
  const P = { hand: load('apex-mp-hand', 'sport'), trans: load('apex-mp-trans', 'auto') };
  $(lob, '#lbHand').value = P.hand; $(lob, '#lbTrans').value = P.trans;
  $(lob, '#lbHand').addEventListener('change', (e) => { P.hand = e.target.value; save('apex-mp-hand', P.hand); });
  $(lob, '#lbTrans').addEventListener('change', (e) => { P.trans = e.target.value; save('apex-mp-trans', P.trans); });
  const hostSel = { '#lbTrack': 'track', '#lbLaps': 'laps', '#lbBots': 'bots', '#lbWeather': 'weather', '#lbDiff': 'difficulty' };
  for (const [q, k] of Object.entries(hostSel)) $(lob, q).addEventListener('change', (e) => room?.setSettings({ [k]: isNaN(+e.target.value) ? e.target.value : +e.target.value }));
  $(lob, '[data-copy]').addEventListener('click', async () => {
    const url = `${location.origin}${location.pathname}?join=${room.code}`;
    try { await navigator.clipboard.writeText(url); toast('Invite link copied'); } catch { prompt('Share this link:', url); }
  });
  $(lob, '[data-leave]').addEventListener('click', () => { room?.leave(); room = null; hideLobby(); toast('Left the room'); });
  $(lob, '#lbChatForm').addEventListener('submit', (e) => { e.preventDefault(); const m = $(lob, '#lbMsg'); if (m.value.trim()) room?.chat(m.value.trim()); m.value = ''; });
  $(lob, '#lbGo').addEventListener('click', () => {
    if (!room) return;
    if (room.isHost) hostStart();
    else room.setMe({ ready: !room.me?.ready });
  });

  function wireRoom() {
    room.on('lobby', renderLobby);
    room.on('chat', addChat);
    room.on('error', (e) => toast(e.message));
    room.on('closed', () => { toast('The host closed the room'); addChat({ system: true, text: 'Host left. Room closed.' }); room = null; setTimeout(hideLobby, 1500); });
    room.on('start', (m) => {
      hideLobby(true);
      startRace({ ...m.settings, handling: P.hand, transmission: P.trans, mode: 'race', vehicle: (m.grid.find((g) => g.id === room.myId) || {}).veh ?? getVehicle(), mp: { room, grid: m.grid, startAt: m.startAt, seed: m.seed } });
    });
    room.on('rtt', () => renderLobby());
  }
  function hostStart() {
    const humans = room.players;
    // host can always start; anyone not ready just joins the grid with their current vehicle
    const bots = Math.min(room.settings.bots, 8 - humans.length);
    const pool = CARS.map((_, i) => i);
    const grid = [];
    for (let i = 0; i < bots; i++) grid.push({ id: 'bot' + i, veh: pool[(Math.random() * pool.length) | 0], bot: true });
    humans.slice().reverse().forEach((p) => grid.push({ id: p.id, veh: p.veh, name: p.name, color: p.color }));
    room.startRace(grid, (Math.random() * 1e9) | 0);
  }
  function renderLobby() {
    if (!room) return;
    $(lob, '#lbCode').textContent = room.code;
    const list = room.players.map((p) => {
      const v = CARS[p.veh] || CARS[0];
      return `<li class="${p.id === room.myId ? 'me' : ''}"><i class="${p.host ? 'host' : p.ready ? 'ready' : ''}">${p.host ? '★' : p.ready ? '✓' : '…'}</i><b>${esc(p.name)}</b><span>${esc(v.make)} ${esc(v.name)}</span></li>`;
    }).join('');
    const bots = room.settings.bots || 0;
    $(lob, '#lbPlayers').innerHTML = list + (bots ? `<li class="bot"><i>AI</i><b>${Math.min(bots, 8 - room.players.length)} AI racers</b><span>${DIFFICULTY[room.settings.difficulty]?.label || ''}</span></li>` : '');
    const hs = $(lob, '#lbHost');
    hs.querySelectorAll('select').forEach((s) => (s.disabled = !room.isHost));
    for (const [q, k] of Object.entries(hostSel)) $(lob, q).value = String(room.settings[k]);
    const t = TRACKS.find((x) => x.id === room.settings.track);
    $(lob, '#lbInfo').textContent = room.isHost ? `You're the host. When everyone is ready, press Start.` : `Host settings: ${t?.name} · ${room.settings.laps} laps${room.rtt ? ` · ping ${Math.round(room.rtt)} ms` : ''}`;
    const go = $(lob, '#lbGo');
    if (room.isHost) {
      const notReady = room.players.filter((p) => !p.ready);
      go.disabled = false;
      go.classList.add('primary');
      go.textContent = notReady.length ? `START ANYWAY ▶ (${room.players.length - notReady.length}/${room.players.length} ready)` : 'START RACE ▶';
      $(lob, '#lbInfo').textContent = room.players.length < 2 ? 'Share the code. Friends appear here when they join.' : notReady.length ? `Waiting for ${notReady.map((p) => p.name).join(', ')} to press Ready. You can also start now.` : 'Everyone is ready. Press Start!';
    }
    else { go.disabled = false; go.textContent = room.me?.ready ? '✓ READY (tap to cancel)' : 'PRESS WHEN READY ▶'; go.classList.toggle('primary', !room.me?.ready); }
  }
  function addChat(m) {
    const c = $(lob, '#lbChat');
    const d = document.createElement('div');
    d.className = m.system ? 'sys' : '';
    d.innerHTML = m.system ? esc(m.text) : `<b>${esc(m.name)}</b> ${esc(m.text)}`;
    c.appendChild(d); c.scrollTop = c.scrollHeight;
    while (c.children.length > 60) c.firstChild.remove();
  }
  function showLobby() { document.body.classList.add('inLobby'); renderLobby(); }
  function hideLobby(keepRoom) { document.body.classList.remove('inLobby'); if (!keepRoom) $(lob, '#lbChat').innerHTML = ''; }

  function open(t = 'solo') { syncSolo(); tab(t); ov.classList.add('show'); }
  function close() { ov.classList.remove('show'); }

  // ?join=CODE
  const j = new URLSearchParams(location.search).get('join');
  if (j) setTimeout(() => { open('online'); codeIn.value = j.toUpperCase().slice(0, 5); status.textContent = 'Enter your name and press Join.'; }, 400);

  return {
    open, close,
    get isOpen() { return ov.classList.contains('show'); },
    get room() { return room; },
    vehicleChanged(i) { if (room && room.state === 'lobby') room.setMe({ veh: i, color: getColor() }); if (ov.classList.contains('show')) syncSolo(); },
    backToLobby(r) { if (r && r === room && room.state !== 'idle') showLobby(); }
  };
}

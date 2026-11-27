// Co-op session: lobby, player sync and a host-run world. The host simulates enemies; every player
// simulates their own soldier and judges hits against themselves.
import { Room, randomCode } from './net.js?v=5';

const MAX = 4, RATE = 1 / 12;
export const COLORS = [{ tint: 0x86a8d4, visor: 0x2fb8ff, band: 0xff2214, css: '#6fc4ff' }, { tint: 0x8fd49a, visor: 0x3dff7a, band: 0xffc21a, css: '#6dff9a' },
  { tint: 0xd8a0e8, visor: 0xd05aff, band: 0xffffff, css: '#dc8cff' }, { tint: 0xf0f0f0, visor: 0xffe14a, band: 0x18a8ff, css: '#ffe14a' }];

export function createCoop(game) {
  const C = { room: null, host: false, active: false, playing: false, slot: 0, hostId: null, peers: new Map(), code: '' };
  let timer = 0, worldTimer = 0, beat = null, lastWorld = 0;
  const now = () => performance.now() / 1000;

  const roster = () => [{ id: C.room.id, slot: 0 }, ...[...C.peers].map(([id, p]) => ({ id, slot: p.slot }))];
  function open(code, host) {
    C.leave(); C.code = code; C.host = host; C.active = true; C.slot = 0; C.hostId = null;
    C.room = new Room(code, receive); lastWorld = now();
    beat = setInterval(heartbeat, 900); heartbeat();
  }
  C.create = () => open(randomCode(), true);
  C.join = code => open(code, false);
  C.leave = () => {
    if (!C.room) return;
    C.room.send({ t: 'bye' }); const r = C.room; setTimeout(() => r.close(), 150); clearInterval(beat);
    for (const id of C.peers.keys()) game.removeRemote(id);
    C.peers.clear(); C.room = null; C.active = C.playing = C.host = false;
  };
  function heartbeat() {
    if (!C.room) return;
    const t = now();
    if (C.host) {
      for (const [id, p] of C.peers) if (t - p.last > 12) drop(id);
      C.room.send({ t: 'lobby', players: roster(), level: game.level(), playing: C.playing });
    } else {
      if (!C.hostId) C.room.send({ t: 'join' }); else C.room.send({ t: 'hb' }, C.hostId);
      if (C.hostId && t - lastWorld > 14) return end('Lost contact with the host.');
    }
    game.lobby(C);
  }
  function drop(id) { C.peers.delete(id); game.removeRemote(id); game.lobby(C); }
  function end(reason) { C.leave(); game.disconnected(reason); }

  function receive(m, from) {
    const t = now();
    if (C.host) {
      if (m.t === 'join') {
        if (!C.peers.has(from)) {
          const used = new Set([0, ...[...C.peers.values()].map(p => p.slot)]);
          const slot = [1, 2, 3].find(s => !used.has(s));
          if (slot === undefined || C.peers.size >= MAX - 1) return C.room.send({ t: 'full' }, from);
          C.peers.set(from, { slot, last: t });
        }
        C.room.send({ t: 'lobby', players: roster(), level: game.level(), playing: C.playing }, from);
        if (C.playing) C.room.send({ t: 'start', level: game.level() }, from);
        return game.lobby(C);
      }
      const p = C.peers.get(from); if (!p) return;
      p.last = t;
      if (m.t === 'bye') return drop(from);
      if (m.t === 'p') { game.remoteState(from, p.slot, m); }
      else game.event(m, from);
      return;
    }
    // guest
    if (m.t === 'full') return end('That room already has four players.');
    if (m.t === 'lobby') {
      const me = m.players.find(p => p.id === C.room.id); if (!me) return;
      C.hostId = from; C.slot = me.slot; lastWorld = t;
      const ids = new Set(m.players.map(p => p.id));
      for (const id of C.peers.keys()) if (!ids.has(id)) drop(id);
      for (const p of m.players) if (p.id !== C.room.id && !C.peers.has(p.id)) C.peers.set(p.id, { slot: p.slot, last: t });
      game.setLevel(m.level); return game.lobby(C);
    }
    if (m.t === 'bye') { if (from === C.hostId) return end('The host left the game.'); return drop(from); }
    if (from === C.hostId) lastWorld = t;
    if (m.t === 'start' && from === C.hostId) { if (!C.playing) { C.playing = true; game.setLevel(m.level); game.begin(); } return; }
    if (m.t === 'p') { const p = C.peers.get(from); if (p) game.remoteState(from, p.slot, m); return; }
    if (m.t === 'w') { if (from === C.hostId && C.playing) game.world(m); return; }
    if (m.t === 'end') { C.playing = false; return game.finish(m.won, m.score); }
    if (C.peers.has(from)) game.event(m, from);
  }

  C.refresh = () => game.lobby(C);
  C.start = () => { if (!C.host) return; C.playing = true; C.room.send({ t: 'start', level: game.level() }); game.begin(); };
  C.send = (m, to) => C.room?.send(m, to);
  C.toHost = m => C.hostId && C.room?.send(m, C.hostId);
  C.tick = dt => {
    if (!C.playing) return;
    timer -= dt; if (timer <= 0) { timer = RATE; C.room.send({ t: 'p', ...game.myState() }); }
    if (C.host) { worldTimer -= dt; if (worldTimer <= 0) { worldTimer = RATE; C.room.send({ t: 'w', ...game.snapshot() }); } }
  };
  addEventListener('pagehide', () => C.leave());
  return C;
}

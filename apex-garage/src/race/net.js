// Multiplayer rooms over WebRTC (PeerJS). The host is authoritative for the lobby and race start;
// every player simulates their own vehicle and streams its state; the host relays and runs the bots.
// ?net=local switches to a BroadcastChannel transport (same browser, several tabs) for testing.
const PREFIX = 'apexgarage-v2-';
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const makeCode = () => Array.from({ length: 5 }, () => ALPHA[(Math.random() * ALPHA.length) | 0]).join('');
const now = () => Date.now();

let peerLib = null;
function loadPeerJS() {
  if (window.peerjs?.Peer) return Promise.resolve(window.peerjs.Peer);
  if (peerLib) return peerLib;
  peerLib = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'vendor/peerjs/peerjs.min.js';
    s.onload = () => (window.peerjs?.Peer ? res(window.peerjs.Peer) : rej(new Error('PeerJS failed to load')));
    s.onerror = () => rej(new Error('PeerJS failed to load'));
    document.head.appendChild(s);
  });
  return peerLib;
}

/* ───────── transports ───────── */
// Each transport exposes: start() -> myId, connect(), send(to, msg, fast), broadcast(msg, fast), close(), and calls
// onMsg(from, msg), onPeerJoin(id), onPeerLeave(id), onError(err).
class PeerTransport {
  constructor(code, isHost, ev) { this.code = code; this.isHost = isHost; this.ev = ev; this.conns = new Map(); }
  async start() {
    const Peer = await loadPeerJS();
    return new Promise((res, rej) => {
      const peer = (this.peer = this.isHost ? new Peer(PREFIX + this.code, { debug: 0 }) : new Peer({ debug: 0 }));
      let opened = false;
      peer.on('open', (id) => { opened = true; this.id = id; res(id); });
      peer.on('error', (e) => {
        const msg = e.type === 'unavailable-id' ? 'That room code is already in use.' : e.type === 'peer-unavailable' ? 'Room not found. Check the code.' : e.type === 'network' || e.type === 'server-error' || e.type === 'socket-error' ? 'Could not reach the matchmaking server.' : e.type === 'browser-incompatible' ? 'This browser does not support WebRTC.' : `Connection error (${e.type || e.message})`;
        if (!opened) rej(new Error(msg)); else this.ev.onError(new Error(msg));
      });
      peer.on('disconnected', () => { try { peer.reconnect(); } catch { /* ignore */ } });
      if (this.isHost) peer.on('connection', (c) => this._wire(c));
      setTimeout(() => { if (!opened) rej(new Error('Timed out reaching the matchmaking server.')); }, 15000);
    });
  }
  _wire(c) {
    const pid = c.peer;
    const entry = this.conns.get(pid) || {};
    entry[c.label === 'st' ? 'st' : 'ctl'] = c;
    this.conns.set(pid, entry);
    c.on('data', (m) => this.ev.onMsg(pid, m));
    c.on('open', () => { if (c.label !== 'st') this.ev.onPeerJoin(pid); });
    c.on('close', () => { if (c.label !== 'st') { this.conns.delete(pid); this.ev.onPeerLeave(pid); } });
    c.on('error', () => {});
  }
  connect() {
    const host = PREFIX + this.code;
    return new Promise((res, rej) => {
      const ctl = this.peer.connect(host, { label: 'ctl', reliable: true, serialization: 'json' });
      const st = this.peer.connect(host, { label: 'st', reliable: false, serialization: 'json' });
      this.conns.set(host, { ctl, st });
      this.hostId = host;
      ctl.on('open', () => res(host));
      ctl.on('data', (m) => this.ev.onMsg(host, m));
      st.on('data', (m) => this.ev.onMsg(host, m));
      ctl.on('close', () => this.ev.onPeerLeave(host));
      ctl.on('error', (e) => rej(e));
      setTimeout(() => rej(new Error('Room not found or the host is unreachable.')), 12000);
    });
  }
  send(to, msg, fast = false) {
    const e = this.conns.get(to); if (!e) return;
    const c = fast && e.st?.open ? e.st : e.ctl;
    if (c?.open) try { c.send(msg); } catch { /* ignore */ }
  }
  broadcast(msg, fast = false, except) { for (const id of this.conns.keys()) if (id !== except) this.send(id, msg, fast); }
  close() { try { this.peer?.destroy(); } catch { /* ignore */ } this.conns.clear(); }
}

class LocalTransport {
  constructor(code, isHost, ev) { this.code = code; this.isHost = isHost; this.ev = ev; this.peers = new Set(); }
  async start() {
    this.id = (this.isHost ? PREFIX + this.code : 'p-' + Math.random().toString(36).slice(2, 8));
    this.bc = new BroadcastChannel(PREFIX + this.code);
    this.bc.onmessage = ({ data: e }) => {
      if (e.to && e.to !== this.id) return;
      if (e.from === this.id) return;
      if (e.k === 'hello' && this.isHost) { this.peers.add(e.from); this.ev.onPeerJoin(e.from); return; }
      if (e.k === 'bye') { this.peers.delete(e.from); this.ev.onPeerLeave(e.from); return; }
      if (e.k === 'msg') this.ev.onMsg(e.from, e.m);
    };
    return this.id;
  }
  async connect() { this.hostId = PREFIX + this.code; this.peers.add(this.hostId); this.bc.postMessage({ k: 'hello', from: this.id, to: this.hostId }); return this.hostId; }
  send(to, msg) { this.bc.postMessage({ k: 'msg', from: this.id, to, m: msg }); }
  broadcast(msg, fast, except) { for (const id of this.peers) if (id !== except) this.send(id, msg); }
  close() { try { this.bc.postMessage({ k: 'bye', from: this.id }); this.bc.close(); } catch { /* ignore */ } }
}

/* ───────── room ───────── */
export class Room {
  constructor() { this.handlers = {}; this.players = []; this.settings = {}; this.offset = 0; this.rtt = 0; this.state = 'idle'; }
  on(t, fn) { (this.handlers[t] ||= []).push(fn); return this; }
  emit(t, ...a) { (this.handlers[t] || []).forEach((f) => f(...a)); }
  get me() { return this.players.find((p) => p.id === this.myId); }
  hostNow() { return now() + this.offset; }

  _transport(code, isHost) {
    const local = new URLSearchParams(location.search).get('net') === 'local';
    const ev = {
      onMsg: (from, m) => this._onMsg(from, m),
      onPeerJoin: (id) => this._onJoin(id),
      onPeerLeave: (id) => this._onLeave(id),
      onError: (e) => this.emit('error', e)
    };
    return local ? new LocalTransport(code, isHost, ev) : new PeerTransport(code, isHost, ev);
  }

  async host(me, settings) {
    this.isHost = true;
    for (let attempt = 0; attempt < 3; attempt++) {
      this.code = makeCode();
      this.t = this._transport(this.code, true);
      try { this.myId = await this.t.start(); break; } catch (e) { this.t.close(); if (attempt === 2 || !/in use/.test(e.message)) throw e; }
    }
    this.players = [{ id: this.myId, name: me.name, veh: me.veh, ready: true, host: true }];
    this.settings = settings;
    this.state = 'lobby';
    this._pushLobby();
    return this.code;
  }

  async join(code, me) {
    this.isHost = false;
    this.code = code.toUpperCase().trim();
    this.t = this._transport(this.code, false);
    this.myId = await this.t.start();
    this.hostId = await this.t.connect();
    this.state = 'joining';
    this.t.send(this.hostId, { t: 'hello', name: me.name, veh: me.veh });
    // clock sync
    this._pingTimer = setInterval(() => this.t.send(this.hostId, { t: 'ping', c: now() }), 2000);
    this.t.send(this.hostId, { t: 'ping', c: now() });
    return new Promise((res, rej) => {
      const to = setTimeout(() => rej(new Error('The host did not answer.')), 10000);
      this.on('welcome', () => { clearTimeout(to); res(); });
    });
  }

  leave() {
    clearInterval(this._pingTimer);
    if (this.t) { if (this.isHost) this.t.broadcast({ t: 'closed' }); else this.t.send(this.hostId, { t: 'leave' }); }
    setTimeout(() => this.t?.close(), 150);
    this.state = 'idle';
    this.emit('left');
  }

  // client → host updates (host applies directly)
  setMe(patch) {
    if (this.isHost) { Object.assign(this.me, patch); this._pushLobby(); }
    else this.t.send(this.hostId, { t: 'set', ...patch });
  }
  setSettings(patch) { if (!this.isHost) return; Object.assign(this.settings, patch); this._pushLobby(); }
  chat(text) {
    const m = { t: 'chat', from: this.myId, name: this.me?.name || '?', text: String(text).slice(0, 140) };
    if (this.isHost) { this.t.broadcast(m); this.emit('chat', m); } else this.t.send(this.hostId, m);
  }
  startRace(grid, seed) {
    if (!this.isHost) return;
    const msg = { t: 'start', settings: this.settings, grid, seed, startAt: this.hostNow() + 3500 };
    this.state = 'racing';
    this.t.broadcast(msg);
    this.emit('start', msg);
    this._pushLobby();
  }
  endRace() { if (!this.isHost) return; this.state = 'lobby'; this.players.forEach((p) => { if (!p.host) p.ready = false; }); this.t.broadcast({ t: 'end' }); this.emit('end'); this._pushLobby(); }

  // fast state stream
  sendState(packet) {
    if (this.isHost) this.t.broadcast({ t: 'st', p: packet }, true);
    else this.t.send(this.hostId, { t: 'st', p: packet }, true);
  }
  sendFinish(f) {
    const m = { t: 'fin', ...f };
    if (this.isHost) { this.t.broadcast(m); this.emit('fin', m); } else this.t.send(this.hostId, m);
  }

  _pushLobby() {
    const lobby = { players: this.players, settings: this.settings, state: this.state, code: this.code };
    if (this.isHost) this.t.broadcast({ t: 'lobby', lobby });
    this.emit('lobby', lobby);
  }
  _onJoin(id) { if (this.isHost) this.emit('peer', id); }
  _onLeave(id) {
    if (this.isHost) {
      const p = this.players.find((q) => q.id === id);
      this.players = this.players.filter((q) => q.id !== id);
      if (p) { this.emit('left-player', p); this._pushLobby(); }
    } else if (id === this.hostId) { this.emit('closed'); }
  }
  _onMsg(from, m) {
    if (!m || typeof m !== 'object') return;
    if (this.isHost) {
      switch (m.t) {
        case 'hello': {
          if (this.players.length >= 8) { this.t.send(from, { t: 'full' }); return; }
          if (!this.players.find((p) => p.id === from)) this.players.push({ id: from, name: String(m.name || 'Racer').slice(0, 16), veh: m.veh, ready: false });
          this.t.send(from, { t: 'welcome', id: from });
          this._pushLobby();
          this.emit('chat', { t: 'chat', system: true, text: `${m.name} joined` });
          this.t.broadcast({ t: 'chat', system: true, text: `${m.name} joined` }, false, from);
          break;
        }
        case 'set': { const p = this.players.find((q) => q.id === from); if (p) { if (m.name) p.name = String(m.name).slice(0, 16); if (m.veh != null) p.veh = m.veh; if (m.color) p.color = String(m.color).slice(0, 9); if ('ready' in m) p.ready = !!m.ready; this._pushLobby(); } break; }
        case 'chat': { const out = { t: 'chat', from, name: this.players.find((q) => q.id === from)?.name || '?', text: String(m.text || '').slice(0, 140) }; this.t.broadcast(out); this.emit('chat', out); break; }
        case 'ping': this.t.send(from, { t: 'pong', c: m.c, h: now() }); break;
        case 'st': this.t.broadcast({ t: 'st', p: m.p }, true, from); this.emit('st', m.p); break;
        case 'fin': this.t.broadcast(m, false, from); this.emit('fin', m); break;
        case 'leave': this._onLeave(from); break;
        default: break;
      }
    } else {
      switch (m.t) {
        case 'welcome': this.state = 'lobby'; this.emit('welcome'); break;
        case 'lobby': this.players = m.lobby.players; this.settings = m.lobby.settings; this.state = m.lobby.state; this.emit('lobby', m.lobby); break;
        case 'pong': { const t = now(), rtt = t - m.c; if (!this.rtt || rtt < this.rtt * 1.5) { this.rtt = rtt; this.offset = m.h + rtt / 2 - t; } this.emit('rtt', rtt); break; }
        case 'chat': this.emit('chat', m); break;
        case 'start': this.state = 'racing'; this.emit('start', m); break;
        case 'end': this.state = 'lobby'; this.emit('end'); break;
        case 'st': this.emit('st', m.p); break;
        case 'fin': this.emit('fin', m); break;
        case 'full': this.emit('error', new Error('The room is full (8 players).')); break;
        case 'closed': this.emit('closed'); break;
        default: break;
      }
    }
  }
}

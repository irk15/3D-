// net.js — serverless multiplayer. Peers find each other through public Nostr relays (Trystero)
// and then talk directly over WebRTC data channels. A BroadcastChannel mirrors everything between
// tabs of the same browser, so two windows on one machine always connect (handy for testing).
// The host is whoever has been in the room longest; if it leaves, the next one takes over.

const APP_ID = 'plateau-montreal-irk15-v3';
const ICE = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:global.stun.twilio.com:3478' },
];

export const randomCode = () => {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = '';
  for (let i = 0; i < 5; i++) s += A[Math.floor(Math.random() * A.length)];
  return s;
};

export class Net {
  constructor(room, me) {
    this.room = room.toUpperCase();
    this.me = { ...me, since: Date.now() };   // { name, color, outfit, since }: the earliest arrival hosts
    this.id = null;
    this.peers = new Map();             // id -> { id, name, color, last, via }
    this.handlers = {};
    this.status = 'connexion…';
    this.relayOK = false;
    this.seq = 0; this.seen = new Map(); this.rtcPeers = new Set();
  }
  on(type, fn) { (this.handlers[type] ||= []).push(fn); }
  emit(type, data, from) { for (const fn of this.handlers[type] || []) fn(data, from); }

  async connect() {
    // 1) Nostr / WebRTC (internet)
    try {
      const T = await import('./vendor-trystero.js');
      this.id = T.selfId;
      const room = this.rtc = T.joinNostr({ appId: APP_ID, rtcConfig: { iceServers: ICE } }, this.room);
      const [send, get] = room.makeAction('m');
      this.rtcSend = send;
      get((msg, from) => this.receive(msg, from, 'rtc'));
      room.onPeerJoin((id) => { this.rtcPeers.add(id); this.relayOK = true; this.rtcSend({ t: 'hi', ...this.me, n: ++this.seq }, id); });
      room.onPeerLeave((id) => { this.rtcPeers.delete(id); if (this.peers.get(id)?.via !== 'bc') this.drop(id); });
      // are any relays actually reachable? (they can be blocked by a firewall)
      this.status = 'connexion…';
      const relays = () => Object.values(T.getRelaySockets?.() || {}).filter((ws) => ws && ws.readyState === 1).length;
      this.relays = relays;
    } catch (e) {
      console.warn('[net] internet mode unavailable', e);
      this.status = 'local';
    }
    if (!this.id) this.id = 'L' + Math.random().toString(36).slice(2, 12);
    // 2) BroadcastChannel (same browser)
    try {
      this.bc = new BroadcastChannel('plateau-' + this.room);
      this.bc.onmessage = (e) => { const { from, to, msg } = e.data || {}; if (from && from !== this.id && (!to || to === this.id)) this.receive(msg, from, 'bc'); };
      this.bcSend({ t: 'hi', ...this.me, n: ++this.seq });
    } catch (e) { /* old browser */ }
    this.hb = setInterval(() => {
      this.send({ t: 'hb' });
      const now = performance.now();
      for (const [id, p] of this.peers) if (now - p.last > 9000) this.drop(id);
    }, 2000);
    addEventListener('pagehide', () => this.leave());
    if (this.relays) {
      await new Promise((res) => { let k = 0; const iv = setInterval(() => { if (this.relays() > 0 || ++k > 16) { clearInterval(iv); res(); } }, 250); });
      this.status = this.relays() > 0 ? 'en ligne' : 'local';
      this.relayCheck = setInterval(() => { const st = this.relays() > 0 ? 'en ligne' : 'local'; if (st !== this.status) { this.status = st; this.emit('status', st); } }, 5000);
    }
  }
  bcSend(msg, to) { try { this.bc?.postMessage({ from: this.id, to, msg }); } catch (e) { /* closed */ } }
  send(msg, to) {
    msg = { ...msg, n: ++this.seq };   // sequence number: the same message may arrive by both routes
    try { if (this.rtcSend && (to ? this.rtcPeers.has(to) : this.rtcPeers.size)) this.rtcSend(msg, to); } catch (e) { /* peer gone */ }
    this.bcSend(msg, to);
  }
  receive(msg, from, via) {
    if (!msg || typeof msg !== 'object') return;
    if (msg.n) {
      let s = this.seen.get(from); if (!s) this.seen.set(from, s = new Set());
      if (s.has(msg.n)) return; s.add(msg.n); if (s.size > 400) { const it = s.values(); for (let i = 0; i < 200; i++) s.delete(it.next().value); }
    }
    let p = this.peers.get(from);
    if (msg.t === 'hi' || msg.t === 'hey') {
      const fresh = !p;
      p = Object.assign(p || { id: from }, { name: String(msg.name || 'Ami').slice(0, 16), color: (msg.color | 0) % 8, outfit: (msg.outfit | 0) % 6, since: +msg.since || Date.now(), last: performance.now(), via });
      this.peers.set(from, p);
      if (msg.t === 'hi') this.send({ t: 'hey', ...this.me }, from);
      if (fresh) this.emit('join', p);
      return;
    }
    if (msg.t === 'bye') { this.drop(from); return; }
    if (!p) { this.send({ t: 'hi', ...this.me }, from); return; }   // we missed their hello
    p.last = performance.now();
    if (msg.t !== 'hb') this.emit(msg.t, msg, p);
  }
  drop(id) { const p = this.peers.get(id); if (!p) return; this.peers.delete(id); this.emit('leave', p); }
  get hostId() {
    let h = this.id, hs = this.me.since;
    for (const [id, p] of this.peers) if (p.since < hs || (p.since === hs && id < h)) { h = id; hs = p.since; }
    return h;
  }
  get isHost() { return this.hostId === this.id; }
  get count() { return this.peers.size + 1; }
  leave() { try { this.send({ t: 'bye' }); this.rtc?.leave(); this.bc?.close(); } catch (e) { /* */ } clearInterval(this.hb); clearInterval(this.relayCheck); }
}

// Solo stand-in with the same surface, so the mission code never branches on "online or not".
export class Offline {
  constructor(me) { this.me = me; this.id = 'solo'; this.peers = new Map(); this.handlers = {}; this.room = null; this.status = 'solo'; }
  on(type, fn) { (this.handlers[type] ||= []).push(fn); }
  emit(type, data, from) { for (const fn of this.handlers[type] || []) fn(data, from); }
  send() {} connect() {} leave() {}
  get hostId() { return this.id; } get isHost() { return true; } get count() { return 1; }
}

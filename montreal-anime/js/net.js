// net.js — multiplayer without a game server, with three ways to reach friends at once:
//   1. MQTT relay: every player connects (WebSocket) to public MQTT brokers and subscribes to the room's
//      topic. Messages go player → broker → players, so it works behind any router or phone network,
//      as long as one broker is reachable. This is the path that "just works".
//   2. Direct WebRTC (Trystero over Nostr relays and WebTorrent trackers): lower latency when the two
//      networks allow a peer-to-peer connection.
//   3. BroadcastChannel: tabs of the same browser (testing on one machine).
// Every message carries a sequence number, so whatever arrives twice is dropped.
// The host is whoever has been in the room longest; if it leaves, the next one takes over.

const APP_ID = 'plateau-montreal-irk15-v4';
const TOPIC = 'plateau-montreal-irk15/v4/';
const qs = new URLSearchParams(location.search);
const BROKERS = qs.get('brokers') ? qs.get('brokers').split(',') : [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt',
  'wss://test.mosquitto.org:8081/mqtt',
];
const NOSTR = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band', 'wss://nostr.mom', 'wss://relay.snort.social', 'wss://offchain.pub'];
const ICE = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:global.stun.twilio.com:3478' },
];

export const randomCode = () => {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = '';
  for (let i = 0; i < 5; i++) s += A[Math.floor(Math.random() * A.length)];
  return s;
};

// ---------------------------------------------------------------- a tiny MQTT 3.1.1 client (QoS 0) over WebSocket
const enc = new TextEncoder(), dec = new TextDecoder();
const mstr = (s) => { const b = enc.encode(s); return [b.length >> 8, b.length & 255, ...b]; };
const vlen = (n) => { const o = []; do { let d = n % 128; n = Math.floor(n / 128); if (n > 0) d |= 128; o.push(d); } while (n > 0); return o; };
const packet = (h, body) => { const out = new Uint8Array(1 + vlen(body.length).length + body.length); const l = vlen(body.length); out[0] = h; out.set(l, 1); out.set(body, 1 + l.length); return out; };
class MqttLink {
  constructor(url, topic, onMsg, onState) {
    Object.assign(this, { url, topic, onMsg, onState });
    this.state = 0; this.closed = false; this.delay = 1500; this.buf = new Uint8Array(0);
    this.cid = 'plt' + Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 8);
    this.open();
  }
  open() {
    if (this.closed) return;
    let ws; try { ws = this.ws = new WebSocket(this.url, ['mqtt']); } catch (e) { return this.retry(); }
    ws.binaryType = 'arraybuffer';
    ws.onopen = () => ws.send(packet(0x10, Uint8Array.from([...mstr('MQTT'), 4, 0x02, 0, 60, ...mstr(this.cid)])));
    ws.onmessage = (e) => this.feed(new Uint8Array(e.data));
    ws.onclose = ws.onerror = () => { if (this.ws !== ws) return; this.ws = null; clearInterval(this.ping); if (this.state) { this.state = 0; this.onState(); } this.retry(); };
  }
  retry() { if (this.closed) return; clearTimeout(this.rt); this.rt = setTimeout(() => this.open(), this.delay); this.delay = Math.min(30000, this.delay * 1.8); }
  feed(chunk) {
    const b = this.buf.length ? Uint8Array.from([...this.buf, ...chunk]) : chunk; let i = 0;
    while (b.length - i >= 2) {
      let mul = 1, len = 0, j = i + 1, d;
      do { if (j >= b.length) { this.buf = b.slice(i); return; } d = b[j++]; len += (d & 127) * mul; mul *= 128; } while (d & 128);
      if (j + len > b.length) break;
      const type = b[i] >> 4, body = b.subarray(j, j + len);
      if (type === 2 && body[1] === 0) {   // CONNACK ok → subscribe
        this.ws.send(packet(0x82, Uint8Array.from([0, 1, ...mstr(this.topic), 0])));
        this.state = 1; this.delay = 1500; this.onState();
        clearInterval(this.ping); this.ping = setInterval(() => { try { this.ws?.send(Uint8Array.from([0xc0, 0])); } catch (e) { /* */ } }, 25000);
      } else if (type === 3) {             // PUBLISH
        const qos = (b[i] >> 1) & 3, tl = (body[0] << 8) | body[1]; let k = 2 + tl; if (qos) k += 2;
        try { this.onMsg(dec.decode(body.subarray(k))); } catch (e) { /* bad payload */ }
      }
      i = j + len;
    }
    this.buf = i < b.length ? b.slice(i) : new Uint8Array(0);
  }
  publish(text) { if (this.state !== 1 || !this.ws) return; try { this.ws.send(packet(0x30, Uint8Array.from([...mstr(this.topic), ...enc.encode(text)]))); } catch (e) { /* */ } }
  close() { this.closed = true; clearTimeout(this.rt); clearInterval(this.ping); try { this.ws?.send(Uint8Array.from([0xe0, 0])); this.ws?.close(); } catch (e) { /* */ } }
}

// ---------------------------------------------------------------- the room
export class Net {
  constructor(room, me) {
    this.room = room.toUpperCase();
    this.me = { ...me, since: Date.now() };   // { name, color, outfit, model, since }
    this.id = null;
    this.peers = new Map();             // id -> { id, name, color, last, via }
    this.handlers = {};
    this.status = 'connecting…';
    this.seq = 0; this.seen = new Map();
    this.rooms = [];                    // WebRTC rooms: { send, peers:Set, sockets() }
    this.links = [];                    // MQTT links
  }
  on(type, fn) { (this.handlers[type] ||= []).push(fn); }
  emit(type, data, from) { for (const fn of this.handlers[type] || []) fn(data, from); }

  async connect() {
    let T = null;
    if (!qs.has('nortc')) { try { T = await import('./vendor-trystero.js'); this.id = T.selfId; } catch (e) { console.warn('[net] WebRTC library unavailable', e); } }
    if (!this.id) this.id = 'L' + Math.random().toString(36).slice(2, 14);
    // 1) MQTT relays
    for (const url of BROKERS) {
      this.links.push(new MqttLink(url, TOPIC + this.room, (text) => {
        let d; try { d = JSON.parse(text); } catch (e) { return; }
        if (d && d.f && d.f !== this.id && (!d.to || d.to === this.id)) this.receive(d.m, d.f, 'relais');
      }, () => { this.updStatus(); if (this.links.some((l) => l.state === 1)) this.relayHello(); }));
    }
    // 2) direct WebRTC
    if (T) {
      const add = (room) => {
        const [send, get] = room.makeAction('m'), peers = new Set(), R = { send, peers };
        get((msg, from) => this.receive(msg, from, 'direct'));
        room.onPeerJoin((id) => { peers.add(id); try { send({ t: 'hi', ...this.me, n: ++this.seq }, id); } catch (e) { /* */ } this.updStatus(); });
        room.onPeerLeave((id) => { peers.delete(id); this.updStatus(); });
        this.rooms.push(R); return room;
      };
      try { this.rtcN = add(T.joinNostr({ appId: APP_ID, relayUrls: NOSTR, rtcConfig: { iceServers: ICE } }, this.room)); } catch (e) { console.warn('[net] nostr', e); }
      try { this.rtcT = add(T.joinTorrent({ appId: APP_ID, rtcConfig: { iceServers: ICE } }, this.room)); } catch (e) { console.warn('[net] torrent', e); }
      this.nostrOpen = () => Object.values(T.getRelaySockets?.() || {}).filter((ws) => ws && ws.readyState === 1).length;
    }
    // 3) same-browser tabs
    try {
      this.bc = new BroadcastChannel('plateau-' + this.room);
      this.bc.onmessage = (e) => { const { from, to, msg } = e.data || {}; if (from && from !== this.id && (!to || to === this.id)) this.receive(msg, from, 'onglet'); };
      this.bcSend({ t: 'hi', ...this.me, n: ++this.seq });
    } catch (e) { /* old browser */ }
    this.hb = setInterval(() => {
      this.send({ t: 'hb' });
      const now = performance.now();
      for (const [id, p] of this.peers) if (now - p.last > 10000) this.drop(id);
      this.updStatus();
    }, 2000);
    addEventListener('pagehide', () => this.leave());
    // wait (briefly) for at least one path to come up
    await new Promise((res) => { let k = 0; const iv = setInterval(() => { if (this.online || ++k > 24) { clearInterval(iv); res(); } }, 250); });
    this.updStatus();
  }
  relayHello() { const now = performance.now(); if (now - (this.lastHello || 0) < 1500) return; this.lastHello = now; this.send({ t: 'hi', ...this.me }); }
  get brokersUp() { return this.links.filter((l) => l.state === 1).length; }
  get online() { return this.brokersUp > 0 || (this.nostrOpen?.() || 0) > 0; }
  updStatus() { const st = this.online ? 'online' : this.peers.size ? 'local' : 'connecting…'; if (st !== this.status) { this.status = st; this.emit('status', st); } }
  diag() {
    return { brokers: this.brokersUp, brokerTotal: this.links.length, nostr: this.nostrOpen?.() || 0, direct: new Set(this.rooms.flatMap((r) => [...r.peers])).size, peers: [...this.peers.values()].map((p) => ({ name: p.name, via: p.via })) };
  }
  bcSend(msg, to) { try { this.bc?.postMessage({ from: this.id, to, msg }); } catch (e) { /* closed */ } }
  send(msg, to) {
    msg = { ...msg, n: ++this.seq };   // sequence number: the same message may arrive by several routes
    let direct = 0;
    for (const R of this.rooms) {
      try { if (to ? R.peers.has(to) : R.peers.size) { R.send(msg, to); direct++; } } catch (e) { /* peer gone */ }
    }
    // skip the relay for high-rate position updates when every friend is reachable directly
    const allDirect = msg.t === 'st' && this.peers.size > 0 && [...this.peers.keys()].every((id) => this.rooms.some((R) => R.peers.has(id)));
    if (!allDirect && this.links.length) { const text = JSON.stringify({ f: this.id, to, m: msg }); for (const l of this.links) l.publish(text); }
    this.bcSend(msg, to);
  }
  receive(msg, from, via) {
    if (!msg || typeof msg !== 'object') return;
    if (msg.n) {
      let s = this.seen.get(from); if (!s) this.seen.set(from, s = new Set());
      if (s.has(msg.n)) return; s.add(msg.n); if (s.size > 600) { const it = s.values(); for (let i = 0; i < 300; i++) s.delete(it.next().value); }
    }
    let p = this.peers.get(from);
    if (msg.t === 'hi' || msg.t === 'hey') {
      const fresh = !p;
      p = Object.assign(p || { id: from }, { name: String(msg.name || 'Ami').slice(0, 16), color: (msg.color | 0) % 8, outfit: (msg.outfit | 0) % 6, model: String(msg.model || 'bot').slice(0, 12), since: +msg.since || Date.now(), last: performance.now(), via });
      this.peers.set(from, p);
      if (msg.t === 'hi') this.send({ t: 'hey', ...this.me }, from);
      if (fresh) this.emit('join', p);
      this.updStatus();
      return;
    }
    if (msg.t === 'bye') { this.drop(from); return; }
    if (!p) { this.send({ t: 'hi', ...this.me }, from); return; }   // we missed their hello
    p.last = performance.now(); if (via === 'direct') p.via = via;
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
  leave() {
    try { this.send({ t: 'bye' }); } catch (e) { /* */ }
    for (const l of this.links) l.close();
    try { this.rtcN?.leave(); this.rtcT?.leave(); this.bc?.close(); } catch (e) { /* */ }
    clearInterval(this.hb);
  }
}

// Solo stand-in with the same surface, so the mission code never branches on "online or not".
export class Offline {
  constructor(me) { this.me = me; this.id = 'solo'; this.peers = new Map(); this.handlers = {}; this.room = null; this.status = 'solo'; }
  on(type, fn) { (this.handlers[type] ||= []).push(fn); }
  emit(type, data, from) { for (const fn of this.handlers[type] || []) fn(data, from); }
  send() {} connect() {} leave() {} diag() { return null; }
  get hostId() { return this.id; } get isHost() { return true; } get count() { return 1; }
}

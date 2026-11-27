// Online co-op transport. Players meet on a public MQTT relay under a room code (no game server).
// The tiny MQTT client is reused from montreal-anime/js/net.js.
const TOPIC = 'iron-jungle-irk15/v1/';
const qs = new URLSearchParams(location.search);
const BROKERS = qs.get('brokers') ? qs.get('brokers').split(',') : ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt'];
export const randomCode = () => Array.from({ length: 5 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');

// ---------------------------------------------------------------- a tiny MQTT 3.1.1 client (QoS 0) over WebSocket
const enc = new TextEncoder(), dec = new TextDecoder();
const mstr = (s) => { const b = enc.encode(s); return [b.length >> 8, b.length & 255, ...b]; };
const vlen = (n) => { const o = []; do { let d = n % 128; n = Math.floor(n / 128); if (n > 0) d |= 128; o.push(d); } while (n > 0); return o; };
const packet = (h, body) => { const out = new Uint8Array(1 + vlen(body.length).length + body.length); const l = vlen(body.length); out[0] = h; out.set(l, 1); out.set(body, 1 + l.length); return out; };
class MqttLink {
  constructor(url, topic, onMsg, onState) {
    Object.assign(this, { url, topic, onMsg, onState });
    this.state = 0; this.closed = false; this.delay = 1500; this.buf = new Uint8Array(0);
    this.cid = 'irj' + Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 8);
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

export class Room {
  constructor(code, onMessage) {
    this.code = code; this.id = Math.random().toString(36).slice(2, 12); this.seq = 0; this.seen = new Map(); this.links = [];
    for (const url of BROKERS) this.links.push(new MqttLink(url, TOPIC + code, text => {
      let d; try { d = JSON.parse(text); } catch { return; }
      if (!d || !d.m || d.f === this.id || (d.to && d.to !== this.id)) return;
      // the same message arrives once per relay: keep the first copy
      let seen = this.seen.get(d.f); if (!seen) this.seen.set(d.f, seen = new Set());
      if (seen.has(d.n)) return; seen.add(d.n); if (seen.size > 600) seen.delete(seen.values().next().value);
      onMessage(d.m, d.f);
    }, () => {}));
  }
  get online() { return this.links.some(l => l.state === 1); }
  send(m, to) { const text = JSON.stringify({ f: this.id, n: ++this.seq, to, m }); for (const l of this.links) l.publish(text); }
  close() { for (const l of this.links) l.close(); }
}

// Minimal GTFS-realtime (protobuf) VehiclePositions decoder. No dependencies; the same code runs in the Cloudflare Worker.
export function decodeVehicles(buf) {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf), dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const out = [];
  function varint(s) { let r = 0, m = 1, i = s.p; for (;;) { const x = b[i++]; r += (x & 0x7f) * m; if (x < 0x80) break; m *= 128; } s.p = i; return r; }
  function fields(start, end, fn) {
    const s = { p: start };
    while (s.p < end) {
      const tag = varint(s), f = tag >>> 3, w = tag & 7;
      if (w === 0) fn(f, varint(s), 0);
      else if (w === 2) { const l = varint(s), st = s.p; fn(f, st, l); s.p = st + l; }
      else if (w === 5) { fn(f, dv.getFloat32(s.p, true), 5); s.p += 4; }
      else if (w === 1) { fn(f, dv.getFloat64(s.p, true), 1); s.p += 8; }
      else throw new Error('bad wire type ' + w);
    }
  }
  const str = (st, l) => new TextDecoder().decode(b.subarray(st, st + l));
  fields(0, b.length, (f, st, l) => {
    if (f !== 2) return; // FeedMessage.entity
    let veh = null;
    fields(st, st + l, (f2, st2, l2) => { if (f2 === 4) veh = [st2, l2]; });
    if (!veh) return;
    const v = { id: '', route: '', lat: NaN, lon: NaN, bearing: 0, speed: 0, ts: 0 };
    fields(veh[0], veh[0] + veh[1], (f3, a, l3) => {
      if (f3 === 1) fields(a, a + l3, (f4, c, l4) => { if (f4 === 5) v.route = str(c, l4); });          // trip.route_id
      else if (f3 === 2) fields(a, a + l3, (f4, c) => { if (f4 === 1) v.lat = c; else if (f4 === 2) v.lon = c; else if (f4 === 3) v.bearing = c; else if (f4 === 5) v.speed = c; });
      else if (f3 === 5) v.ts = a;                                                                       // timestamp
      else if (f3 === 8) fields(a, a + l3, (f4, c, l4) => { if (f4 === 1) v.id = str(c, l4); else if (f4 === 2 && !v.id) v.id = str(c, l4); });
    });
    if (isFinite(v.lat) && isFinite(v.lon) && v.id) out.push(v);
  });
  return out;
}
export const isStreetcar = (route) => /^(50[1-9]|51[0-2]|30[1346]|310)$/.test(route);

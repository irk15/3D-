// Shared helpers for turning vector-tile geometry into local metres.
export const area2 = (r) => { let a = 0; for (let i = 0, n = r.length; i < n; i++) { const p = r[i], q = r[(i + 1) % n]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };

// Convert a feature's rings to local coordinates and group them into polygons [outer, hole, hole...].
export function polygons(feature, T) {
  const rings = feature.loadGeometry(), out = [];
  let cur = null, sign = 0;
  for (const ring of rings) {
    const r = [];
    for (const pt of ring) r.push([T.x0 + (pt.x / T.extent) * T.sx, T.z0 + (pt.y / T.extent) * T.sz]);
    if (r.length > 1 && r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1]) r.pop();
    if (r.length < 3) continue;
    const a = area2(r);
    if (!a) continue;
    if (!cur || Math.sign(a) === sign) { cur = [r]; sign = Math.sign(a); out.push(cur); } else cur.push(r);
  }
  return out;
}
export function lines(feature, T) {
  return feature.loadGeometry().map((l) => l.map((pt) => [T.x0 + (pt.x / T.extent) * T.sx, T.z0 + (pt.y / T.extent) * T.sz]));
}

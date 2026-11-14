// Local metric projection around downtown Toronto (x = east, z = south, y = up) plus web-mercator tile maths.
const R = 6378137, D = Math.PI / 180;
export const ORIGIN = { lat: 43.6532, lon: -79.3832 };
const KX = Math.cos(ORIGIN.lat * D);
export const lon2x = (l) => (l - ORIGIN.lon) * D * R * KX;
export const lat2z = (l) => -(l - ORIGIN.lat) * D * R;
export const x2lon = (x) => ORIGIN.lon + x / (D * R * KX);
export const z2lat = (z) => ORIGIN.lat - z / (D * R);

export function tileOfLonLat(lon, lat, z) {
  const n = 2 ** z, s = Math.sin(lat * D);
  return { x: Math.floor(((lon + 180) / 360) * n), y: Math.floor((0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n) };
}
export function tileFrame(x, y, z) {
  const n = 2 ** z;
  const lat = (yy) => Math.atan(Math.sinh(Math.PI * (1 - (2 * yy) / n))) / D;
  const x0 = lon2x((x / n) * 360 - 180), x1 = lon2x(((x + 1) / n) * 360 - 180);
  const z0 = lat2z(lat(y)), z1 = lat2z(lat(y + 1));
  return { x0, z0, sx: x1 - x0, sz: z1 - z0 };
}

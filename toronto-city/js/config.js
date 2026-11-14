// Central settings. Override the transit proxy with ?proxy=https://your-worker.workers.dev in the page URL.
const qs = new URLSearchParams(location.search);
let saved = ''; try { saved = localStorage.getItem('tc_proxy') || ''; } catch (e) {}
const proxy = qs.get('proxy') || saved;
if (qs.get('proxy')) { try { localStorage.setItem('tc_proxy', proxy); } catch (e) {} }

export const CFG = {
  TILEJSON: 'https://tiles.openfreemap.org/planet', // free OpenStreetMap vector tiles (OpenMapTiles schema)
  ZOOM: 14,                                          // highest zoom the free tiles provide
  RADIUS: +(qs.get('r') || 3),                       // tiles loaded around the camera (3 => 7x7 tiles, ~12 km across)
  PROXY: proxy,                                      // Cloudflare Worker URL that returns TTC vehicles as JSON
  TTC_DIRECT: 'https://bustime.ttc.ca/gtfsrt/vehicles',
  POLL_MS: 15000,
  TRANSIT_DELAY_S: 30,                               // vehicles are shown this far behind real time so motion is always interpolated
  START: { lat: 43.6453, lon: -79.3806 },            // Union Station
  CN_TOWER: { lat: 43.6426, lon: -79.3871 }
};

# Toronto Live 3D

Streaming, real-world 3D Toronto. Open `index.html` through any static host (GitHub Pages).

- **City:** OpenStreetMap vector tiles (free, via OpenFreeMap) are streamed around the camera at zoom 14, so every street and building in the city loads as you fly. Nothing is bundled.
- **Live transit:** TTC buses and streetcars from the TTC's GTFS-realtime feed. Vehicles are drawn ~30 s behind real time and interpolated between their real GPS fixes, so they glide instead of teleporting.
- **Sky:** follows real Toronto time (untick "Live Toronto time" to scrub the day).

## Live transit setup (one time, free)
The TTC feed is binary and may block browsers, so the page reads it through a tiny Cloudflare Worker.
1. Cloudflare dashboard -> Workers & Pages -> Create -> Hello World -> **Edit code** -> paste `worker/ttc-proxy.js` -> Deploy.
2. Open the city once with `?proxy=https://YOUR-WORKER.workers.dev` (it is remembered in your browser afterwards).

## Controls
WASD move, Q/E down/up, drag to look, wheel = speed, Shift = fast, **F** ride nearest streetcar, **B** ride nearest bus. `?r=2` loads fewer tiles (faster), `?r=4` loads more.

## Notes
Subway/LRT positions are not in the TTC's open vehicle feed, so they are not shown yet. Desktop first; the Quest 3 version needs the lighter settings pass.
Data: © OpenStreetMap contributors, OpenFreeMap / OpenMapTiles, TTC open data.

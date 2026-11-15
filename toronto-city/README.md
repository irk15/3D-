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


## Detail upgrade (v2)
- Facades in three styles (glass curtain wall, concrete ribbon windows, brick with punched windows) with matching lit night windows; pitched roofs on houses; rooftop equipment; stepped crowns and spires on towers.
- Road markings: zebra crossings at every junction, dashed lane lines on arterials. Street lamps with night light pools, street trees along residential streets.
- Street names painted on the roads, floating landmark labels (stations, museums, stadiums, parks…) and neighbourhood names from the OpenStreetMap tiles.
- Sky with drifting clouds, sky-reflecting glass and animated lake water (image-based lighting from the live sky), sun shadows, night bloom. Press **G** (or the button) to switch the cinematic pipeline off on slower machines; `?r=2` loads fewer tiles.

## Montréal atmosphere (v3)
The sky, seasons, weather and lake mirror now come from the shared `../lib/` (ported from the Montréal city): physical sky with clouds, stars and moon at Toronto's real sun path and date; **live Toronto weather** (Open-Meteo) drives clear / cloudy / rain / snow / fog; autumn leaves, bare winter trees, snow on roofs, wet reflective streets in rain; a planar mirror on Lake Ontario (**M** to toggle). The HUD has Season and Weather pickers to override the live values.

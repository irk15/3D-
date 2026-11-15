# lib/ — shared 3D pieces
- `atmosphere.js` — physical sky with clouds, stars and moon, real sun path for a latitude/date, seasons (autumn leaves, bare winter trees, snow cover), weather (clear, cloudy, rain, snow, fog), wet-road shading, texel-snapped sun shadows, sky-based reflections. Ported from `montreal/`. `liveWeather()` reads current conditions from Open-Meteo.
- `mirror.js` — planar lake/river mirror (desktop).
Used by `toronto-city/`. Montréal and the other cities can import these instead of keeping their own copies.

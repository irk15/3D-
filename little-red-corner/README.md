# Little Red Corner

An interactive Three.js miniature neighbourhood, inspired by the reference illustration. Unofficial Netflix fan concept.

## Run

Open `https://irk15.github.io/3D-/little-red-corner/` after GitHub Pages deploys. For local development, serve this directory over HTTP (`python -m http.server 8000`) and open `http://localhost:8000`. ES modules require an HTTP server; do not open index.html directly from disk.

## Controls

Drag to orbit, scroll or pinch to zoom. Use the toolbar for day/night, interior view, automatic camera orbit, and pausing the residents. Tap a person to inspect their activity.

## Source

- `scene.js`: geometry, materials, lighting, animation poses and camera controls.
- `life.js`: activity selection, navigation, destination reservations and pedestrian separation.
- `vendor/`: bundled Three.js 0.170.0 and addons; license included.

No build step, backend, account, or external assets required. WebGL2 support is required. Activity logic has been simulation-tested; browser rendering and device performance have not been visually verified.

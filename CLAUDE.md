# 3D Cities (repo: irk15/3D-)

Collection of Three.js 3D cities, games and VR scenes, each in its own subfolder, hosted on GitHub Pages at irk15.github.io/3D-/<folder>/.
Most cities run on desktop and on Meta Quest 3 (WebXR).

## Main city folders
- vice-city/ : 1980s Miami neon strategy-dashboard city. index.html (desktop) plus vr.html (Quest 3). Also has blender/ and models/.
- toronto-live-smooth/ : Toronto live 3D city, single index.html (~1900 lines). Reference build for new cities.
- toronto-live/, toronto/ : earlier Toronto versions. Do not edit unless asked.
- montreal/ : high-end realistic Montréal. Has js/, data/, tools/, README.md.
- montreal-anime/ : cel-shaded anime third-person walking game in the Plateau; planned online multiplayer with flying and first-to-win missions.
- las-vegas-live/ : high-end endless Las Vegas. Split into app.js, city.js, motion.js, style.css. Opens directly on the view, NO Earth/fly-in intro.
- bangalore/ : 3D Bengaluru city (single index.html).
- wealth-city/ : 3D SIP dashboard for NJ Funds clients.

## Other folders (unrelated scenes and tools; leave alone unless asked)
cala-rosa, dua-lipa, french, harbour, house, little-red-corner, manifest, pagoda-of-the-floating-garden, penthouse-*, skyline-penthouse*, sofa-on-the-tracks, tiny-town, uber-ad, routine.

## Stack
- Three.js, plain JavaScript, no build step. Load via CDN/import map.
- Static files only, deployed by pushing to GitHub Pages. Everything must work from a plain static host. Keep the .nojekyll file.

## Working rules (save credits)
- Read and edit ONLY the folder the request is about. Never touch other folders.
- Never rewrite a whole file. Make targeted edits to the relevant function or block.
- Before adding to a large single-file page (e.g. toronto-live-smooth/index.html), split it into modules first (buildings.js, lighting.js, vr.js, style.css), following las-vegas-live/ and montreal/js/.
- Reuse code from toronto-live-smooth/, vice-city/ and las-vegas-live/ instead of regenerating it. Shared pieces (sky, fog, streetlights, VR controllers, locomotion) should live in one shared lib/ folder and be imported.
- Do not read zips, models/, data/ or blender/ unless the task needs them.
- Short answers: after a change, say what changed in 1-2 sentences. No full code dumps in chat.

## Quality and performance
- Quest 3 budget: keep draw calls low. Use InstancedMesh for repeated buildings, lights and props. Merge static geometry. Avoid per-frame allocations.
- No flickering layers or z-fighting (this happened in the Vice City VR build). Use polygonOffset or separate heights for coplanar surfaces, and sensible camera near/far values.
- Keep desktop and VR versions in sync: shared city data, separate input/camera code.
- Test that VR mode enters cleanly and the desktop page still loads after every change.

## Git
- Commit small, with clear messages. After changes, push so the GitHub Pages link updates, and give the live link.

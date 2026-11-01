# Las Vegas Live

Buildless Three.js city exploration app. Open through an HTTP server; ES modules do not support double-click file:// loading reliably.

## Run

From this folder run `python3 -m http.server 8000`, then visit http://localhost:8000. No install or build step. Internet access loads pinned Three.js 0.170.0 and, on video export, webm-muxer 5.1.4 from jsDelivr. All scene textures, geometry, signs, LED content and sound are generated at runtime. No image, model, font or audio assets are downloaded.

## Files

- index.html — interface and import map
- style.css — responsive glass interface
- app.js — rendering, solar math, clocks, camera modes, quality, sound and exports
- city.js — metre-scale geography, custom landmarks, materials and streaming
- motion.js — fixed-step traffic, pedestrians, planes, monorail and LED/fountain animation

## Controls

Drag: orbit. Right-drag/two-finger drag: pan. Wheel/pinch: zoom. Arrow keys: orbit. +/-: zoom. 1–6: preset views. C: cinematic flight. Space: pause simulation. H: overlays. F: fullscreen. Live time resets to the actual clock; presets use the current Pacific calendar date. The time speed applies to both clock and simulation.

## Architecture

Local metre coordinates project latitude/longitude around 36.1147 N, 115.1728 W. Positive X is east; negative Z is north. Landmark heights use the requested metre values. Resort geometry uses curved wings, stepped crowns, branching plans, tower latticework, pyramids, domes and custom attractions. Strip, downtown, airport and arterial coordinates are approximate; this is a procedural interpretation rather than surveyed GIS or photogrammetry. The Mirage parcel is labelled as a site, not an operating hotel.

23 labelled locations. 2,200 instanced cars with lanes, signals and simple following/braking. Up to 1,800 instanced pedestrians, including Fremont crowds. Runtime facade maps plus tens of thousands of instanced lit panes. Material-batched static geometry. Three-cascade directional shadows in Ultra, analytical contact-shadow decals, Preetham sky, ACES tone mapping, adaptive bloom, subtle grain, vignette and horizon shimmer. Meshes use normal frustum culling; moving instance batches are kept uncullable to avoid stale bounding-sphere disappearance.

Night is the initial preset; the live Pacific clock and calculated solar position are available with Live time. Traffic, aircraft, hotel lights and LED/fountain shows are simulated, not external live data. The fountain score is synthesized after explicit sound activation. The exported film is silent.

Suburban detail streams in deterministic 1,800-metre chunks with opacity fades and street grids beyond the core. Distant detail fades out; the camera-centred desert plane hides the horizon edge. This is distance-based detail streaming, not a fully reconstructed endless metropolitan map. Static landmarks remain resident; there is no mesh-decimation LOD for landmarks. Auto adjusts pixel ratio and bloom, targeting 45–60fps; it cannot guarantee 60fps on every device. Ultra enables expensive cascaded shadows.

## Exports

Capture: a 1920×1080 PNG, including the title bar and clock.
Render film: 360 explicitly stepped frames at 30fps, 1920×1080 VP9 WebM, 12 seconds, including the title bar. Requires WebCodecs and VP9 encoding, normally desktop Chrome/Edge. It uses backpressure and may take longer than 12 seconds to generate. The camera follows the cinematic route during export and returns afterward. Browser permissions can affect automatic downloads.

## Verification and known limits

Syntax checks passed for all modules. The scene was constructed using Three.js 0.170.0 with a native Canvas implementation: geometry coordinates were finite, landmark heights and north/south ordering checked, traffic and pedestrians stepped, all four Sphere modes drawn, and streaming exercised away from the core. Those checks do not validate GLSL compilation, final rendering or video encoding.

The available preview browser reported GL_VENDOR Disabled / GL_RENDERER Disabled and could not create a WebGL context. Visual fidelity, GPU performance, shadow appearance and PNG/WebM export are therefore unverified in this environment. The app displays a useful hardware-acceleration message and source download if WebGL is unavailable.

Intentional approximations: road reflections are glossy materials and translucent light streaks, not ray-traced or screen-space reflections. Contact shadows approximate AO. Atmosphere uses fog, sky scattering and the additive Luxor shaft rather than full volumetric ray marching. Sphere Earth content is a procedural artistic pattern, not satellite imagery. Traffic routes and aircraft paths are illustrative. The source of the prior Toronto page was not available, so the interface follows the requested glass/preset/camera design rather than an exact source-level reproduction.

# APEX // GARAGE

An interactive 3D supercar garage in the style of Need for Speed, built with Three.js (WebGL 2) and plain ES modules. There's no build step.

**Live:** https://irk15.github.io/3D-/apex-garage/

## Features
- Four real 3D car models: Ferrari 458 Italia, Porsche 911 Carrera 4S, Dodge Challenger SRT and a Concept GT
- A detailing-studio garage with a honeycomb ceiling light, neon strips, a mirror-polished floor, a roll-up door and a night street outside
- A scan-line effect that builds each car when you switch to it
- A paint shop with 12 colours plus a custom colour picker, and five finishes (gloss, metallic, matte, chrome, pearl)
- Underglow in six colours, headlights, and three garage moods (Neon Night, Showroom, Sunset)
- Tuning (engine, turbo, weight, tires) that changes the stats live and gives each car a performance class (C to S+)
- A synthesised engine sound with Web Audio, a hold-to-rev control and a live tachometer
- **Launch**: the bay door opens, the car revs and accelerates out through the gears while a chase camera follows
- Turntable, hydraulic lift, 7 camera angles (including a cinematic orbit), clickable hotspots on the car and a photo mode that saves a PNG
- Your paint, finish and tuning choices for each car are saved in the browser
- **Race mode (APEX // NIGHT RUN):** press RACE (or Enter) to drive the selected car on a 2.3 km neon night-city circuit against the other three cars as AI rivals. It has 3 laps, a countdown, positions, lap and best-lap times, a minimap and a results screen
  - Arcade handling with handbrake drifts, skid marks and tyre smoke, nitro that refills while you drift, body roll, and wall and car collisions
  - Your paint and tuning carry over to the race. Three cameras: chase, far chase and hood
  - Keyboard, gamepad (RT/LT, A = nitro, B = drift) and on-screen touch controls
  - Graphics quality adjusts automatically so the frame rate stays smooth

## Controls
| Key | Action |
| --- | --- |
| ← → | Switch car |
| 1–7 | Camera angles |
| Space (hold) | Rev the engine |
| N | Launch |
| R / L | Turntable / Lift |
| H / G | Headlights / Underglow |
| P / M | Photo mode / Mute |
| Enter | Race the selected car |

**In a race:** W/↑ gas · S/↓ brake/reverse · A D / ← → steer · Space drift · Shift nitro · C camera · R reset to the track · Esc pause

## Run locally
Any static server works, for example `python3 -m http.server`, then open http://localhost:8000.

## Credits
See [CREDITS.md](CREDITS.md). The car models are by their original authors and are used under their licenses.

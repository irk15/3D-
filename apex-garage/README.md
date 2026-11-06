# APEX // GARAGE

A high-end 3D garage and racing game in the browser, built with Three.js (WebGL 2) and plain ES modules. There's no build step.

**Play:** https://irk15.github.io/3D-/apex-garage/

## Garage
- 7 real 3D vehicles: Ferrari 458 Italia, Porsche 911 Carrera 4S, Dodge Challenger SRT, Apex Concept GT, Ducati Panigale V4 R, Ducati Streetfighter V4 S and the Apex Street 890 R
- Bikes carry a rider posed with inverse kinematics (IK), so hands are on the grips, feet on the pegs and knees against the tank, fitted to each bike
- Paint (12 colours plus custom), 5 finishes, underglow, headlights, 3 lighting moods, tuning stages, rev, lift, turntable, 7 cameras and photo mode

## Racing
- **3 tracks:** Neon Downtown (night city), Sunset Coast (golden hour, hills, ocean) and Harbor Docks (dusk, containers, cranes)
- **3 modes:** Race (up to 7 AI rivals), Time Trial (with a saved ghost of your best lap) and Drift Attack (score and combo)
- **Car physics:** tyre slip curves, weight transfer, grip shared between cornering and acceleration, downforce, drag and slipstream. A launch test tunes each vehicle so its in-game 0–100 time and top speed match its spec sheet
- **Bike physics:** lean-to-turn, grip-limited lean angle, wheelie and stoppie limits, and crashes that respawn you
- **Handling presets:** Arcade (guided drifts and full assists), Sport (traction and stability control) and Simulation (raw tyre physics, no assists)
- **Gearbox:** automatic or manual (Q/E), with rev limiter and launch control (keep the revs in the green zone at GO for a perfect start)
- **Racing extras:** nitro that refills from drifts, slipstream, overtakes, wheelies and clean laps. Rain makes the road wet and slippery
- **AI:** drivers race through the same physics as you, with 4 difficulty levels
- **HUD:** tachometer with shift lights, live lap delta against your best, leaderboard with gaps and a rotating minimap
- **Cameras:** chase, far chase, hood (helmet on bikes, leaning with the bike), bumper and TV, plus look back (B)
- **Replays:** a full replay after each race, with trackside TV cameras, slow motion and a choice of car to follow
- **Controllers:** gamepad support with rumble, plus touch controls
- **Performance:** physics runs at a fixed 240 Hz and graphics quality adjusts automatically, so the frame rate stays smooth

## Online multiplayer
Press **RACE → Online**, then **Create room**, and share the 5-character code (or the invite link). Friends choose **Online**, enter the code, pick a car or bike in the garage and press **Ready**. The host picks the track, laps, weather and how many AI racers fill the grid (up to 8 racers in total). Each player keeps their own handling and gearbox settings.

Players connect directly to each other with WebRTC (PeerJS), so no game server is needed. You can test locally with two tabs and `?net=local`.

## Controls
| | Keyboard | Gamepad |
|---|---|---|
| Throttle / brake | W S / ↑ ↓ | RT / LT |
| Steer / lean | A D / ← → | Left stick |
| Handbrake (drift) / rear brake | Space | X |
| Nitro | Shift | A |
| Shift down / up (manual) | Q / E | LB / RB |
| Camera / look back | C / B | B / Y |
| Reset to track / pause | R / Esc | – / Start |

## Run locally
`python3 -m http.server` and open http://localhost:8000.

## Credits
See [CREDITS.md](CREDITS.md).

# Skyline Penthouse VR (Meta Quest 3 / WebXR)

The same penthouse and skyline as `../skyline-penthouse/`, with an immersive WebXR mode. Open the page in the **Meta Quest Browser**, pick a quality preset and tap **Enter VR**. It still works as a normal walkable page on desktop and phones.

## Controls in VR
| Input | Action |
| --- | --- |
| Left stick | Walk (click the stick to sprint), relative to where you look |
| Right stick left / right | 30 degree snap turn |
| Right stick forward, release | Aim and teleport (blue arc = valid, red = blocked) |
| Left wrist (raise it toward your face) | Menu: time of day, lights, run clock, sound, quality, seated/standing, exit |
| Right trigger | Click the menu with the laser |
| A / B | Next time of day / lights |
| X / Y | Run the clock / sound |
| Hand tracking | Pinch and release to teleport |

A comfort vignette appears while walking and a short blink masks teleports and turns.

## Smooth movement
The headset is locked to 72 Hz and an automatic governor lowers or raises the render resolution to hold that frame rate. Fast and Balanced also use lighter interior shading and only keep the nearest few lights live, so they look almost the same at a fraction of the GPU cost.

## Quality presets (pick before entering; the wrist menu can cycle them)
- **Fast**: starts at 62% resolution, strong foveation, 300 cars, lightest shading, 2 live lights.
- **Balanced** (default): starts at 78% resolution, 700 cars, light shading, 3 live lights.
- **Sharp**: up to 100% resolution, 1,500 cars, shadows, full reflections and all lights. Needs a lot of GPU.

## Sound
All audio is generated in the browser (no files): city rumble and traffic, terrace wind that fades behind the glass, two crackling fires, the circling helicopter, jet fly-pasts and a distant siren, positioned in 3D.

## Notes
- In VR the post-processing chain (bloom, grain) is replaced by a direct render path so it can run in stereo; look and exposure are tuned to match.
- Three.js r128 is bundled in `vendor/` (MIT, license included).

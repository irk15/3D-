# Skyline Penthouse VR (Meta Quest 3 / WebXR)

The same penthouse and skyline as `../skyline-penthouse/`, with an immersive WebXR mode. Open the page in the **Meta Quest Browser**, pick a quality preset and tap **Enter VR**. It still works as a normal walkable page on desktop and phones.

## Controls in VR
| Input | Action |
| --- | --- |
| Left stick | Walk (click the stick to sprint), relative to where you look |
| Right stick left / right | Smooth turning (speed follows the stick). Switch to 30 degree snap turn with the Smooth/Snap button on the wrist menu |
| Right stick up/down | Walk forward/back smoothly (right stick left/right turns) |
| Left wrist (raise it toward your face) | Menu: time of day, lights, run clock, sound, quality, seated/standing, exit |
| Right trigger | Click the menu with the laser |
| A / B | Next time of day / lights |
| X / Y | Run the clock / sound |
| Hand tracking | Pinch and release to teleport |

A comfort vignette appears while walking or turning, and a short blink masks teleports.

## Smooth movement
The headset is locked to 72 Hz and an automatic governor lowers or raises the render resolution to hold that frame rate; the wrist menu shows the live fps and resolution. The city is drawn with a depth pre-pass and the sky last, so the expensive shaders only run on pixels you can actually see. Fast and Balanced also use lighter interior shading and only keep the nearest few lights live.

## Quality presets (pick before entering; the wrist menu can cycle them)
- **Fast** (default): starts at 60% resolution, strong foveation, no MSAA, 300 cars, lightest shading, 2 live lights.
- **Balanced**: starts at 70% resolution, MSAA, 700 cars, 3 live lights, glossy floor reflections.
- **Sharp**: up to 100% resolution, 1,500 cars, shadows, full reflections and all lights. Needs a lot of GPU.

## Sound
All audio is generated in the browser (no files): city rumble and traffic, terrace wind that fades behind the glass, two crackling fires, the circling helicopter, jet fly-pasts and a distant siren, positioned in 3D.

## Notes
- In VR the post-processing chain (bloom, grain) is replaced by a direct render path so it can run in stereo; look and exposure are tuned to match.
- Three.js r128 is bundled in `vendor/` (MIT, license included).

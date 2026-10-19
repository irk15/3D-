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

## Quality presets (pick before entering; the menu can change the rest)
- **Fast**: 70% resolution, strong foveation, 450 cars, no shadows, 3 interior lights.
- **Balanced** (default): 85% resolution, 900 cars, 1K shadows, 5 lights.
- **Sharp**: 100% resolution, 1,500 cars, 2K shadows, all lights, full clouds.

If it stutters on your headset, restart in Fast. The page needs HTTPS (GitHub Pages provides it).

## Sound
All audio is generated in the browser (no files): city rumble and traffic, terrace wind that fades behind the glass, two crackling fires, the circling helicopter, jet fly-pasts and a distant siren, positioned in 3D.

## Notes
- In VR the post-processing chain (bloom, grain) is replaced by a direct render path so it can run in stereo; look and exposure are tuned to match.
- Three.js r128 is bundled in `vendor/` (MIT, license included).

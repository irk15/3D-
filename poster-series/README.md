# 3D Poster Series

Each poster is a single static `index.html` (Three.js r128 from CDN, no build step) recreating one flat-illustration poster as a realistic 3D scene.

| # | Folder | Scene |
|---|--------|-------|
| 01 | `dusk-house/` | Modernist glass house, three palms, mirror pool at dusk (`pixel.html` = pixel-art edition) |
| 02 | `moonlit-pool/` | Pavilion, umbrella pine, infinity pool and a moonlit sea |
| 03 | `lantern-teahouse/` | Kyoto teahouse at blue hour, red arched bridge, floating lanterns |
| 04 | `aurora-cabin/` | Log cabin on a frozen lake under the northern lights |
| 05 | `desert-riad/` | Sunset riad courtyard, palms, petal-strewn pool |
| 06 | `lighthouse-cove/` | Lighthouse with sweeping beam, keeper's cottage, fishing boat |
| 07 | `ramen-alley/` | Rainy neon ramen street, wet-road reflections, umbrellas |
| 08 | `starlit-observatory/` | Milky Way over a mountain observatory, campfire, laser guide star |
| 09 | `aegean-harbour/` | Terraced white village, blue domes, windmill, harbour boats |
| 10 | `redwood-treehouse/` | Treehouse among giant redwoods, rope bridge, light shafts |

Live: https://irk15.github.io/3D-/poster-series/

## Shared look (copy this block into every new poster)
- Linear colour workflow: hex colours go through `C()` (sRGB to linear); canvas textures use `sRGBEncoding`.
- Image-based lighting from a gradient dome (PMREM), hemisphere + one rim light, warm point lights for windows.
- `EffectComposer`: `RenderPass` then `UnrealBloomPass` then a final pass (ACES tone map, grade, vignette, grain, dither).
- Pool water: custom shader sampling a planar reflection render target, ripple-distorted, Fresnel blended.
- Foliage: dark icosphere cores covered with instanced leaf cards.
- Camera orbit is limited so the poster composition always holds; drag to look around, scroll to zoom.

## Adding the next poster
Posters 03-10 are generated from a small shared kit in `_src/` (sky, planar-reflection water, foliage, lights, post-processing), so a new poster is just a scene file.
1. Write `_src/scenes/<name>.js`: start with a `kitSetup({...})` config (fog, sky, lights, water, camera), then add geometry with the kit helpers (`box`, `Merger`, `glowWin`, `paperLantern`, `tree`, `forest`, `ridge`, `palm`, `fireflies`...). Look at any existing scene as the template.
2. `cd _src && python3 build.py <name> "<Title>" <seed>` writes `../<name>/index.html`.
3. Add a screenshot `poster-NN.png` (about 560x775) and a card in `index.html`.
(01 and 02 are standalone pages; the kit was extracted from poster 02.)

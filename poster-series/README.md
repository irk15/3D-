# 3D Poster Series

Each poster is a single static `index.html` (Three.js r128 from CDN, no build step) recreating one flat-illustration poster as a realistic 3D scene.

| # | Folder | Scene |
|---|--------|-------|
| 01 | `dusk-house/` | Modernist glass house, three palms, mirror pool at dusk (`pixel.html` = pixel-art edition) |
| 02 | `moonlit-pool/` | Pavilion, umbrella pine, infinity pool and a moonlit sea |

Live: https://irk15.github.io/3D-/poster-series/

## Shared look (copy this block into every new poster)
- Linear colour workflow: hex colours go through `C()` (sRGB to linear); canvas textures use `sRGBEncoding`.
- Image-based lighting from a gradient dome (PMREM), hemisphere + one rim light, warm point lights for windows.
- `EffectComposer`: `RenderPass` then `UnrealBloomPass` then a final pass (ACES tone map, grade, vignette, grain, dither).
- Pool water: custom shader sampling a planar reflection render target, ripple-distorted, Fresnel blended.
- Foliage: dark icosphere cores covered with instanced leaf cards.
- Camera orbit is limited so the poster composition always holds; drag to look around, scroll to zoom.

## Adding poster 03
1. Make `poster-series/<name>/index.html` (copy `moonlit-pool/` as the starting point).
2. Add a screenshot `poster-03.png` (about 560x775).
3. Add a card to `poster-series/index.html`.

# Plateau · Montréal

A small anime-style walking game in Three.js, set in Montreal's Plateau-Mont-Royal.

**Play:** https://irk15.github.io/3D-/montreal-anime/

Walk Rue Saint-Denis, climb the outdoor staircases onto the balconies, cut through the green alley, sit by the fountain in the square, and find the **12 golden bagels** hidden around the neighbourhood. Mount Royal and its cross sit on the horizon.

## Controls

| | Desktop | Phone |
|---|---|---|
| Walk / run | WASD or arrows, Shift to run | Left thumb joystick, *Courir* |
| Jump | Space | *Sauter* |
| Talk / enter shops / pet the cat | E | *Parler* |
| Camera | Drag, scroll to zoom | Drag with the right thumb |
| Time of day | T (day → golden hour → night) | Sun button |
| Season | Y (summer → autumn → winter) | Leaf button |
| Photo / music / help | P / M / H | Buttons on the right |

A gamepad works too (left stick, right stick camera, A jump, B run, X talk).

Tips: the **Café Lumière** gives you a 30-second speed boost, a croissant from the **boulangerie** makes you jump much higher, and the bagels show on the minimap.

## What's in it

- A hand-laid Plateau block grid: Saint-Denis (bike lanes, shops, awnings), Mont-Royal, Rachel, Drolet, Saint-Hubert and their alleys, on a gentle slope up toward the mountain.
- About 310 detailed buildings (211 with walkable front staircases) with brick, greystone or painted facades, pressed-tin cornices, and walkable outdoor staircases and balconies (some with spiral stairs). Back balconies with wooden stairs over the yards.
- A green alley with planters and laundry lines, utility poles and overhead wires, the Carré Saint-Louis-style square with its fountain and gazebo, the Mont-Royal metro plaza with a poutine truck and pigeons, a church on Saint-Denis, murals, stop signs (ARRÊT) and street plates.
- Neighbours who walk the sidewalks and chat (in French), cars that stop at the traffic lights, at all-way stops and for you, an orange cat, synthesised lo-fi music, footsteps and birds.

## How it looks the way it does

- **Toon shading**: three-band light ramp, blue-violet ambient shadows, painted sky with flat two-tone clouds.
- **Ink outlines**: drawn in screen space from a normal-and-depth pass (no inverted-hull copies), so lines can't flicker against the surfaces. They thin out with distance to stay clean.
- **No z-fighting by construction**: roads, markings, crosswalks, yards and lamp pools are one ground shader. Windows, doors, sills and frames protrude by different amounts. Sidewalks are raised slabs, not overlays.
- Texel-snapped shadows that don't crawl as you move. MSAA on the colour pass.

## Files

`index.html` (page and interface) · `js/layout.js` (street grid and slope) · `js/toon.js` (materials, sky, outline pipeline) · `js/world.js` (buildings, props, colliders) · `js/actors.js` (characters, player, neighbours, traffic, bagels) · `js/main.js` (camera, input, time, seasons, audio, minimap).

The neighbourhood is a stylised impression of the Plateau, not a survey-accurate map; street names are real, but the shops and characters are invented.

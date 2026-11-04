# Plateau · Montréal

An anime-style multiplayer adventure in Three.js, set in Montreal's Plateau-Mont-Royal. Fly over the rooftops and race your friends through missions.

**Play:** https://irk15.github.io/3D-/montreal-anime/

Walk Rue Saint-Denis, climb the outdoor staircases onto the balconies, cut through the green alley, sit by the fountain in the square, and find the **12 golden bagels** hidden around the neighbourhood. Mount Royal and its cross sit on the horizon.

## Controls

| | Desktop | Phone |
|---|---|---|
| Walk / run | WASD or arrows, Shift to run | Left thumb joystick (push to the edge to run) |
| Jump | Space | *Jump* |
| Talk / enter shops / pet the cat | E | Tap the bubble |
| Camera | Drag, scroll to zoom | Drag with the right thumb |
| Time of day | T (day → golden hour → night) | Sun button |
| Season | Y (summer → autumn → winter) | Leaf button |
| Photo / music / help | P / M / H | Buttons on the right |
| Gun | G draw · click fire · right-click zoom · R reload · Tab wheel | Gun · Fire · ⟳ · ⇄ |
| Car | E enter/exit · W/S gas/brake · Space handbrake · X view · O radio | Pedals · ⟲ · 👁 · 📻 |

A gamepad works too (left stick, right stick camera, A jump, B run, X talk).

Tips: the **Café Lumière** gives you a 30-second speed boost, a croissant from the **boulangerie** makes you jump much higher, and the bagels show on the minimap.

## What's in it

- A hand-laid Plateau block grid: Saint-Denis (bike lanes, shops, awnings), Mont-Royal, Rachel, Drolet, Saint-Hubert and their alleys, on a gentle slope up toward the mountain.
- About 310 detailed buildings (211 with walkable front staircases) with brick, greystone or painted facades, pressed-tin cornices, and walkable outdoor staircases and balconies (some with spiral stairs). Back balconies with wooden stairs over the yards.
- A green alley with planters and laundry lines, utility poles and overhead wires, the Carré Saint-Louis-style square with its fountain and gazebo, the Mont-Royal metro plaza with a poutine truck and pigeons, a church on Saint-Denis, murals, stop signs (ARRÊT) and street plates.
- Neighbours who walk the sidewalks and chat (in French), cars that stop at the traffic lights, at all-way stops and for you, an orange cat, synthesised lo-fi music, footsteps and birds.


## Version 2 — "the 2040 update"

- **Living clock**: a full day passes in 24 minutes, with dawn, golden hour, dusk and night blended continuously; the sun crosses the sky and the moon takes over.
- **Weather**: sun, clouds and rain (snow in winter) that change on their own. Puddles mirror the sky, raindrops ripple, walls darken, neighbours open umbrellas.
- **Coursier**: walk into almost any shop to take a delivery to a real address on the Plateau, follow the blue beam, beat the timer for bigger tips, chain combos.
- **Moves**: double jump with a flip, hold jump to glide under your umbrella, dash (F) on the ground or mid-air.
- **BIXI**: take a bike at four stations and ride the Saint-Denis bike lane (B rings the bell).
- **Neighbours who remember you**: they speak French aloud (your browser's voices), keep friendship hearts, react to the weather, season, time and your deliveries, and keep their own hours.
- **Wardrobe**: spend tips at the friperie on new tuques and jackets.
- **Journal (J)**: achievements and stats; progress saves automatically in your browser.
- **Look**: glow on lights, soft ambient occlusion, cloud shadows drifting over the streets, anime speed lines and a speed-reactive camera, dust, snow and splash puffs.
- **Photo mode (P)**: free camera, a pose, and Manga screentone and Film filters.
- **Music** gains a beat while you're on a delivery and speeds up when time runs short.

## Version 3 — wings and friends

- **Flying**: press **V** (or jump a third time in the air) to open paper wings. The camera sets your direction, Space climbs, C dives, Shift is a turbo. The wings get tired, so land on a roof or the street to recharge. Clouds float above the city and you can fly through them.
- **Play with friends, wherever they are**: *Créer une partie* gives you a 5-letter code and a link. Friends open the link (or type the code) and appear in your Plateau with their name and colour. No account and no game server: browsers find each other through public Nostr relays and then connect directly with WebRTC. Two tabs in the same browser also see each other.
- **Missions, first one wins**: the host presses **N** and everyone gets the same challenge, with a countdown:
  - ⭐ *Pluie d'étoiles*: 18 stars on balconies, roofs and in the sky. Each one goes to whoever touches it first.
  - 💫 *Course des anneaux*: 8 rings in order, low over the streets and high in the air.
  - 🔍 *Chasse au trésor*: one hidden object, a hot/cold meter and a search circle on the map.
  - 👑 *Roi du toit*: the first to spend 15 seconds on the golden roof wins.
  - 📦 *Livraison éclair*: grab a parcel at a shop and deliver it across the Plateau.

  Points carry over between rounds, a podium shows after each round, and the next round starts by itself. In solo, the same missions are time trials with personal records.
- **Social**: Enter opens the chat, 1–4 send emotes (👋 ❤️ 😂 🏆), speech bubbles appear over heads, and friends show on the minimap.
- **New interface**: a lobby with name and colour, a mission card with timer, a scoreboard, an arrow toward your objective, a wing-energy and altitude meter, and an invite card with copy and share buttons.
- **More world**: chimneys, AC units, skylights and a few rooftop terraces (all solid, so you can land on them), 3D toon clouds, wing ribbons, wind sound, and fog that opens up with altitude.

**Connection caveat**: rooms need at least one public relay to be reachable. Networks that block them (some schools and offices) show ❌ in the invite card; mobile data or another Wi-Fi usually works.

## Version 4 — Mixamo characters, better cars, reliable rooms

- **Mixamo characters**: pick *X Bot*, *Michelle* or *Vanguard* in the lobby. They are rigged Mixamo models with motion-captured idle, walk and run that blend with your speed, plus nod, head-shake and samba gestures (emotes, wins and losses). A procedural layer bends the skeleton for jumps, the double-jump flip, flying (superhero arm), biking, waving, umbrella and parcel, with squash-and-stretch on jumps and landings and a lean into turns. Neighbours and your friends use them too. X Bot takes your colour.
- **Cars**: six models (sedan, hatchback, SUV, taxi, pickup, delivery van) with rounded bodies, real wheel arches, glass cabins and pillars, grilles, head and brake lights, mirrors, door seams and handles, plates, and tyres with spoked rims. Parked cars are solid up to the roof, so you can jump on them.
- **Connecting with friends**: rooms now go through public MQTT relays (three brokers at once) as well as direct WebRTC, so a friend on another network or on mobile data can join with the code. The invite card shows which connections are up.
- **No more getting stuck**: if the player ends up inside something (a car pulling up, a landing on a ledge, the wider bike), it slides out to the nearest free spot.

**4.1 fixes and speed**: wings ride on the character's back and follow the spine, both arms stay visible while flying and falling, the umbrella and parcel sit in the hands, friends' characters always show under their name (dimmed "absent" when their tab is in the background), and long falls can no longer tunnel through a roof into a building. Faster without lowering quality: moving cars are one mesh each with all wheels in a single instanced draw, trees, clouds and rooftop props are tiled so off-screen parts are skipped in every pass, distant parked cars and far neighbours' animation are culled or updated less often, collision queries no longer allocate, and the render scale adapts only when the GPU falls behind (−40 % draw calls, −16 % triangles, −45 % script time per frame).

Models: X Bot, Michelle and Vanguard are [Mixamo](https://www.mixamo.com) characters as published in the three.js examples, compressed with meshopt (1.7 MB for all three).

## Version 5 — drive Montréal

- **Drive**: press **E** by one of the parked cars (a red and a yellow coupé, an SUV, a sedan) or by any traffic car that's stopped, and drive. A bicycle-model chassis with an engine curve and gears, brakes and reverse, tyre grip that lets the back step out (handbrake on **Space** to drift), and suspension that follows the street: it pitches on hills, dives when you brake and squats when you accelerate, rolls in corners, and goes airborne off ledges. Crashes bounce you back with a thump and camera shake. Traffic stops behind you, people jump out of the way. **X** switches to the driver's seat: dashboard with live speed and rev gauges and gear, an infotainment screen, a steering wheel that turns, seats, door cards, pedals and mirror. Your friends see you driving.
- **Better cars and BIXI**: drivable cars have see-through glass and a full cabin, spoked rims with brake discs and red calipers, exhausts, wipers and an antenna. The BIXI is modelled after the real one: step-through frame, front rack and basket, fenders, chain guard, cranks and pedals that turn, a steering fork, a bell and dynamo lights.
- **Physics**: Montréal's grey bins and blue recycling bins, orange construction cones (of course), cardboard boxes, crates, café chairs and footballs fall, bounce, slide, tip over when knocked hard enough (and rock back up when they aren't), roll, hit walls and each other, and sleep when still. You can kick them, ride into them or plough through them with a car.
- **Standing on nothing, fixed**: poles, tree trunks, railings and lamp posts are solid but no longer walkable, and parked cars use two boxes that follow their shape (hood and cabin), so you can't hover over a hood.
- **Montréal around the Plateau**: a real downtown to the south-west: glass and stone towers with lit offices at night, Place Ville Marie with its rotating searchlight, 1000 de La Gauchetière with its copper pyramid, 1250 René-Lévesque, Tour CIBC and Tour de la Bourse. Also the Olympic Stadium with its leaning tower to the east, Notre-Dame Basilica in Old Montréal, Habitat 67, the St. Lawrence with the Jacques-Cartier Bridge and the Biosphère. Fly there or drive.
- **More people**: shopkeepers in their doorways who wave as you pass, customers on café terraces, people waiting at the bus shelter on their phones, sitters on the park benches and the fountain, a queue at the poutine truck, friends chatting on the plaza, office workers downtown.
- **Fixed**: arms vanishing as you fall after flying.

## Version 5.1 — every car, a bigger Montréal

- **Every car is drivable**: any parked car on the Plateau or downtown (press **E** beside it) and any traffic car, moving or not (you keep its speed). Two STM buses run on Saint-Denis and Mont-Royal, and you can take those too.
- **Fixed**: the car you took no longer stays behind as a ghost copy; flying no longer rolls the character onto its side.
- **Bigger city**: the row-house neighbourhoods now spread east and west of the Plateau and down to downtown (Mile End, Rosemont, Centre-Sud), around 4× the built area.
- **More landmarks**: the Sun Life Building with its colonnades on Dorchester Square, the Chinatown gates on Saint-Laurent, the Village's canopy of pink balls over Sainte-Catherine, the Old Port's Clock Tower and the turning Grande roue (gondolas light up at night), and Saint Joseph's Oratory with its great dome on the mountain's west slope.
- **City ambience**: a traffic hum that swells near busy streets, distant sirens, gulls by the river, the STM metro chime at Mont-Royal station, church bells on the hour, Montréal's red-and-yellow fire hydrants on the corners.

## Version 6 — the GTA update

- **English** everywhere (menus, dialogue, signs, street names).
- **Cars knock people down**: pedestrians fly, land limp with dizzy stars and get back up; everyone nearby panics and runs. Steal any traffic car and the driver is dragged out (*carjacked*).
- **Weapons**: pistol, SMG and rifle with an over-the-shoulder aim camera, recoil, tracers, muzzle flashes and reloads. **Tab** (or ⇄ on a phone) opens a weapon wheel and slows time. Shoot your friends in multiplayer (PvP can be switched off with **K**); take-downs pay $100 and show in the kill feed.
- **Wanted level**: knocking people over, shooting, carjacking and blowing things up add stars. Cop cars with flashing lights and sirens chase you, officers get out, and from three stars they shoot. Stay out of sight to lose them, or get **busted**. Health and armour; at zero you're **wasted** — the screen drains of colour in slow motion, then you wake up at the start.
- **Car damage**: crashes and bullets wear a car down; it smokes, catches fire, then explodes, knocking over everything around it and leaving a burnt-out wreck.
- **Pickups** on the sidewalks: health, body armour, cash and ammo (on the radar).
- **Radio** (**O**, or 📻 in a car): *Plateau Lo-Fi 96.3*, *Neon 88 FM* (synthwave), *Mile End Beats* (boom-bap), or off. All synthesised in the browser.
- **GTA-style HUD**: rectangular radar with health and armour bars, cash, weapon and ammo, wanted stars, district and street names in the corner, help box, speedometer, *mission passed* banners, *wasted* / *busted* screens.
- **Fixes**: cars slide along walls instead of sticking and ease out if traffic drives into them; you can always walk out of something that drove onto you; traffic stops for cop cars and people in the road; pedestrians' legs now match how fast they really move (no more sliding or crab-walking), walkers turn toward where they go, and nobody walks through you.

## How it looks the way it does

- **Toon shading**: three-band light ramp, blue-violet ambient shadows, painted sky with flat two-tone clouds.
- **Ink outlines**: drawn in screen space from a normal-and-depth pass (no inverted-hull copies), so lines can't flicker against the surfaces. They thin out with distance to stay clean.
- **No z-fighting by construction**: roads, markings, crosswalks, yards and lamp pools are one ground shader. Windows, doors, sills and frames protrude by different amounts. Sidewalks are raised slabs, not overlays.
- Texel-snapped shadows that don't crawl as you move. MSAA on the colour pass.

## Files

`index.html` (page and interface) · `js/layout.js` (street grid and slope) · `js/toon.js` (materials, sky, outline pipeline) · `js/world.js` (buildings, props, colliders) · `js/actors.js` (characters, player, neighbours, traffic, bagels) · `js/main.js` (camera, input, time, seasons, audio, minimap, lobby, remote players) · `js/net.js` (peer-to-peer rooms) · `js/missions.js` (missions, scoring) · `js/sky.js` (clouds, rooftop props, wing trails) · `js/rig.js` (Mixamo characters, animation blending, procedural poses) · `js/cars.js` (car models) · `js/vehicle.js` (driving physics) · `js/physics.js` (loose objects) · `js/crowd.js` (people around town) · `js/downtown.js` (downtown, landmarks, river) · `js/combat.js` (weapons, knock-downs, health, PvP) · `js/police.js` (wanted level, cops) · `js/pickups.js` (health, armour, cash, ammo) · `models/` (compressed Mixamo glTF, plus light crowd versions) · `js/vendor-trystero.js` (bundled [Trystero](https://github.com/dmotz/trystero), MIT).

The neighbourhood is a stylised impression of the Plateau, not a survey-accurate map; street names are real, but the shops and characters are invented.

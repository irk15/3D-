#!/usr/bin/env python3
"""
Montreal ground-mask baker.

Bakes the vector geography of central Montreal (shorelines, islands, the Lachine
Canal, parks, the Mount Royal forest, districts and a few non-grid roads) into two
small RGB PNGs that the browser reads at runtime. Everything is baked offline so the
page never stacks road / park / water planes on top of each other: the ground is ONE
mesh and these signed-distance fields tell its shader what to paint.

Frame: "Montreal grid" metres. Origin = Place Ville Marie. +u = Montreal "east"
(along the street grid), +v = Montreal "north" (towards the mountain). The grid is
rotated THETA degrees from true east, which is why the city's street grid ends up
axis-aligned in the scene.

  mask_a.png  R = water SDF   G = park/grass SDF   B = forest SDF
  mask_b.png  R = road SDF (non-grid roads)  G = district id*16+8  B = distance to water /16 m

SDF encoding: 128 + metres*4, clamped (±32 m range, positive = inside the feature;
for water, positive = land).

Usage: python3 bake_mask.py boroughs.geojson ../data
boroughs.geojson = Montreal borough limits (Ville de Montréal open data, CC BY 4.0,
via github.com/codeforamerica/click_that_hood).
"""
import json, math, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

LAT0, LON0 = 45.5015, -73.5690
MY = 111320.0
MX = 111320.0 * math.cos(math.radians(LAT0))
THETA = math.radians(55.0)
C, S = math.cos(THETA), math.sin(THETA)

U0, U1, V0, V1 = -4600.0, 8200.0, -7800.0, 5000.0
W = 4096
PX = (U1 - U0) / W            # metres per pixel
H = int(round((V1 - V0) / PX))

def g(lat, lon):
    ex = (lon - LON0) * MX
    ny = (lat - LAT0) * MY
    return ex * C + ny * S, -ex * S + ny * C

def px(u, v):
    return ((u - U0) / PX, (V1 - v) / PX)

def poly_ll(pts):
    return [px(*g(la, lo)) for la, lo in pts]

def poly_g(pts):
    return [px(u, v) for u, v in pts]

def rect_g(u0, u1, v0, v1):
    return poly_g([(u0, v0), (u1, v0), (u1, v1), (u0, v1)])

def new_mask():
    return Image.new('L', (W, H), 0)

def fill(img, poly, val=255):
    ImageDraw.Draw(img).polygon(poly, fill=val)

def stroke(img, pts, width_m, val=255):
    d = ImageDraw.Draw(img)
    w = max(1, int(round(width_m / PX)))
    d.line(pts, fill=val, width=w, joint='curve')
    r = w / 2
    for x, y in pts:
        d.ellipse([x - r, y - r, x + r, y + r], fill=val)

def sdf(img):
    m = np.asarray(img) > 127
    inside = ndimage.distance_transform_edt(m)
    outside = ndimage.distance_transform_edt(~m)
    d = (inside - outside) * PX
    d = ndimage.gaussian_filter(d, 0.7)
    return d

def enc(d):
    return np.clip(128 + d * 4.0, 0, 255).astype(np.uint8)

# ---------------------------------------------------------------- geography
# Montreal island shore, west (Verdun/LaSalle) -> east (Hochelaga), land on the
# north-west side. Approximate, hand-traced from known positions.
MTL_SHORE = [
    (45.4180, -73.6600), (45.4300, -73.6250), (45.4380, -73.6020), (45.4455, -73.5860),
    (45.4525, -73.5735), (45.4600, -73.5645), (45.4680, -73.5568), (45.4742, -73.5522),
    (45.4800, -73.5462), (45.4848, -73.5412), (45.4895, -73.5418), (45.4935, -73.5458),
    (45.4962, -73.5490),
    # Cite du Havre peninsula (Habitat 67) out to its tip
    (45.4972, -73.5455), (45.4984, -73.5418), (45.4998, -73.5384), (45.5008, -73.5378),
    (45.5016, -73.5392), (45.5008, -73.5430), (45.4998, -73.5468), (45.4994, -73.5508),
    # Old Port: Pointe-a-Calliere, then the quays
    (45.5002, -73.5532), (45.5022, -73.5536), (45.5040, -73.5522), (45.5062, -73.5500),
    (45.5082, -73.5482), (45.5100, -73.5468), (45.5118, -73.5462),
    # Clock Tower quay and on towards the Jacques Cartier bridge / port
    (45.5150, -73.5462), (45.5200, -73.5438), (45.5262, -73.5402), (45.5330, -73.5370),
    (45.5420, -73.5330), (45.5500, -73.5290), (45.5580, -73.5232), (45.5660, -73.5160),
    (45.5750, -73.5080), (45.5860, -73.4990), (45.5960, -73.4890),
]
# South shore (Brossard / Saint-Lambert / Longueuil), east -> west, land on the south-east.
SOUTH_SHORE = [
    (45.5960, -73.4650), (45.5800, -73.4800), (45.5600, -73.4930), (45.5400, -73.5060),
    (45.5300, -73.5130), (45.5225, -73.5175), (45.5100, -73.5115), (45.4990, -73.5085),
    (45.4890, -73.5055), (45.4780, -73.4980), (45.4680, -73.4925), (45.4560, -73.4910),
    (45.4400, -73.4980), (45.4200, -73.5100), (45.4000, -73.5300),
]
ILE_STE_HELENE = [
    (45.5248, -73.5330), (45.5232, -73.5292), (45.5195, -73.5272), (45.5150, -73.5268),
    (45.5108, -73.5280), (45.5088, -73.5302), (45.5094, -73.5338), (45.5125, -73.5360),
    (45.5170, -73.5372), (45.5212, -73.5370), (45.5240, -73.5355),
]
ILE_NOTRE_DAME = [
    (45.5078, -73.5285), (45.5068, -73.5236), (45.5035, -73.5200), (45.4985, -73.5188),
    (45.4945, -73.5210), (45.4942, -73.5258), (45.4968, -73.5300), (45.5005, -73.5335),
    (45.5045, -73.5330), (45.5070, -73.5312),
]
LAC_DES_REGATES = [  # rowing basin inside Ile Notre-Dame
    (45.5048, -73.5300), (45.5052, -73.5290), (45.4975, -73.5222), (45.4968, -73.5232),
]
NUNS_ISLAND = [
    (45.4725, -73.5405), (45.4672, -73.5352), (45.4600, -73.5362), (45.4532, -73.5418),
    (45.4475, -73.5508), (45.4446, -73.5598), (45.4478, -73.5650), (45.4540, -73.5612),
    (45.4602, -73.5562), (45.4662, -73.5508), (45.4712, -73.5462),
]
# Old Port piers (rectangles in grid metres: u0,u1,v0,v1) — added to land
LACHINE_CANAL = [
    (45.4990, -73.5527), (45.4968, -73.5556), (45.4945, -73.5585), (45.4918, -73.5622),
    (45.4895, -73.5655), (45.4872, -73.5695), (45.4850, -73.5735), (45.4822, -73.5768),
    (45.4795, -73.5790), (45.4762, -73.5840), (45.4725, -73.5895), (45.4688, -73.5955),
    (45.4645, -73.6030), (45.4598, -73.6110), (45.4550, -73.6200), (45.4500, -73.6300),
]
PEEL_BASIN = [(45.4930, -73.5585), (45.4918, -73.5570), (45.4890, -73.5625), (45.4900, -73.5640)]

MOUNT_ROYAL_PARK = [
    (45.5150, -73.5880), (45.5128, -73.5838), (45.5092, -73.5808), (45.5052, -73.5792),
    (45.5012, -73.5808), (45.4985, -73.5845), (45.4962, -73.5905), (45.4968, -73.5978),
    (45.5000, -73.6005), (45.5040, -73.5975), (45.5085, -73.5950), (45.5125, -73.5930),
]
MOUNT_ROYAL_FOREST = [
    (45.5135, -73.5878), (45.5115, -73.5845), (45.5085, -73.5822), (45.5052, -73.5810),
    (45.5020, -73.5822), (45.4996, -73.5855), (45.4978, -73.5905), (45.4985, -73.5950),
    (45.5010, -73.5965), (45.5048, -73.5950), (45.5090, -73.5935), (45.5120, -73.5915),
]
CEMETERIES = [
    (45.5125, -73.5935), (45.5150, -73.5985), (45.5120, -73.6080), (45.5072, -73.6185),
    (45.5010, -73.6205), (45.4972, -73.6140), (45.4975, -73.6060), (45.5000, -73.6010),
    (45.5045, -73.5980), (45.5090, -73.5955),
]
WESTMOUNT_SUMMIT = [(45.4905, -73.6020), (45.4892, -73.5995), (45.4862, -73.6025), (45.4865, -73.6080), (45.4892, -73.6085)]
OUTREMONT_WOODS = [(45.5110, -73.6055), (45.5080, -73.6005), (45.5045, -73.6040), (45.5060, -73.6110), (45.5098, -73.6115)]

def main(geo_path, out_dir):
    u = lambda la, lo: g(la, lo)
    print('mask %dx%d @ %.2f m/px' % (W, H, PX))

    # ---------------- water
    water = new_mask()
    river = MTL_SHORE + SOUTH_SHORE
    fill(water, poly_ll(river))
    land_on_water = new_mask()
    for isl in (ILE_STE_HELENE, ILE_NOTRE_DAME, NUNS_ISLAND):
        fill(land_on_water, poly_ll(isl))
    # Old Port piers: King Edward, Jacques-Cartier, Clock Tower quays (grid rects)
    for la, lo, du, dv, ang in [(45.5050, -73.5512, 55, 240, 0), (45.5078, -73.5488, 45, 230, 0),
                                (45.5118, -73.5452, 40, 300, 0), (45.5030, -73.5528, 50, 160, 0)]:
        cu, cv = g(la, lo)
        fill(land_on_water, rect_g(cu - du / 2, cu + du / 2, cv - dv, cv + 10))
    w = np.asarray(water) > 127
    l = np.asarray(land_on_water) > 127
    w = w & ~l
    canal = new_mask()
    stroke(canal, poly_ll(LACHINE_CANAL), 46)
    fill(canal, poly_ll(PEEL_BASIN))
    fill(canal, poly_ll(LAC_DES_REGATES))
    w = w | (np.asarray(canal) > 127)
    water_img = Image.fromarray((w * 255).astype(np.uint8))
    water_sdf = -sdf(water_img)  # positive on land

    # ---------------- parks (grass)
    park = new_mask()
    for p in (MOUNT_ROYAL_PARK, CEMETERIES, WESTMOUNT_SUMMIT, OUTREMONT_WOODS, ILE_STE_HELENE, ILE_NOTRE_DAME):
        fill(park, poly_ll(p))
    # Lattice-aligned parks (grid rects in metres)
    SU, UOFF, SV, VOFF = 113.0, 1.0, 190.0, -300.0
    def ln_u(k): return UOFF + SU * k
    def ln_v(m): return VOFF + SV * m
    def block(k0, k1, m0, m1, inset=7.0):
        return rect_g(ln_u(k0) + inset, ln_u(k1) - inset, ln_v(m0) + inset, ln_v(m1) - inset)
    parks_grid = [
        ('La Fontaine', 18, 23, 9, 11),
        ('Jeanne-Mance', 3, 5, 9, 12),
        ('Laurier', 15, 17, 16, 17),
        ('Maisonneuve+Botanical', 44, 58, 17, 24),
        ('Champ-de-Mars', 12, 14, -2, -1),
        ('Dorchester', -3, -2, 1, 2),
        ('Saint-Louis', 12, 13, 6, 7),
    ]
    for name, k0, k1, m0, m1 in parks_grid:
        fill(park, block(k0, k1, m0, m1))
    # Lachine canal linear park + Old Port promenade
    stroke(park, poly_ll(LACHINE_CANAL), 96)
    # Nuns' island south woods
    fill(park, poly_ll([(45.4560, -73.5440), (45.4500, -73.5480), (45.4462, -73.5580), (45.4500, -73.5620), (45.4560, -73.5560)]))
    park_np = (np.asarray(park) > 127) & ~w

    # ---------------- forest
    forest = new_mask()
    for p in (MOUNT_ROYAL_FOREST, WESTMOUNT_SUMMIT, OUTREMONT_WOODS):
        fill(forest, poly_ll(p))
    fill(forest, poly_ll([(45.5225, -73.5335), (45.5200, -73.5300), (45.5150, -73.5292), (45.5120, -73.5310), (45.5150, -73.5345), (45.5200, -73.5350)]))
    fill(forest, poly_ll([(45.4545, -73.5455), (45.4505, -73.5490), (45.4475, -73.5575), (45.4510, -73.5600), (45.4550, -73.5545)]))
    # clearings: Beaver Lake lawn, chalet/belvedere, cross summit, Biosphere lawn
    for la, lo, r in [(45.4982, -73.5960, 120), (45.5037, -73.5868, 55), (45.5085, -73.5875, 30), (45.5141, -73.5313, 75)]:
        cu, cv = g(la, lo)
        x, y = px(cu, cv); rr = r / PX
        ImageDraw.Draw(forest).ellipse([x - rr, y - rr, x + rr, y + rr], fill=0)
    # ---------------- special roads (non-grid)
    roads = new_mask()
    road_lines = [
        # Camillien-Houde / Remembrance over Mount Royal
        ([(45.5195, -73.5868), (45.5160, -73.5880), (45.5120, -73.5905), (45.5090, -73.5935), (45.5055, -73.5975), (45.5025, -73.6005), (45.5000, -73.6045)], 11),
        # Cote-des-Neiges road over the saddle
        ([(45.4945, -73.5815), (45.4965, -73.5870), (45.4970, -73.5935), (45.4978, -73.5990), (45.5000, -73.6045), (45.5030, -73.6125), (45.5065, -73.6215)], 16),
        # Ile Ste-Helene loop road
        ([(45.5235, -73.5345), (45.5200, -73.5292), (45.5150, -73.5285), (45.5110, -73.5292), (45.5098, -73.5325), (45.5135, -73.5350), (45.5185, -73.5360), (45.5230, -73.5352)], 9),
        # Circuit Gilles-Villeneuve (Ile Notre-Dame)
        ([(45.5065, -73.5300), (45.5060, -73.5245), (45.5030, -73.5212), (45.4985, -73.5198), (45.4955, -73.5222), (45.4958, -73.5262), (45.4985, -73.5288), (45.5020, -73.5318), (45.5052, -73.5318), (45.5065, -73.5300)], 13),
        # Bonaventure corridor down to the Victoria bridge and the Champlain approach
        ([(45.4988, -73.5560), (45.4945, -73.5525), (45.4900, -73.5480), (45.4870, -73.5430)], 20),
        ([(45.4870, -73.5430), (45.4800, -73.5490), (45.4745, -73.5525)], 20),
        # Nuns' Island boulevard to the Champlain bridge
        ([(45.4712, -73.5470), (45.4660, -73.5420), (45.4625, -73.5380), (45.4610, -73.5360)], 20),
        # Brossard landing of the Champlain bridge, Saint-Lambert landing of the Victoria bridge
        ([(45.4655, -73.4925), (45.4640, -73.4840), (45.4620, -73.4700)], 22),
        ([(45.4925, -73.5080), (45.4935, -73.5000), (45.4950, -73.4880)], 14),
        # Longueuil landing of the Jacques Cartier bridge
        ([(45.5228, -73.5172), (45.5240, -73.5100), (45.5260, -73.5000)], 22),
        # Cite du Havre road to Habitat 67 and the Concorde bridge
        ([(45.4965, -73.5505), (45.4985, -73.5450), (45.5000, -73.5400)], 11),
    ]
    for pts, wd in road_lines:
        stroke(roads, poly_ll(pts), wd)
    road_np = (np.asarray(roads) > 127) & ~w

    # ---------------- districts
    dist = Image.new('L', (W, H), 4)   # default: Westmount/TMR/etc. holes = houses
    D = ImageDraw.Draw(dist)
    gj = json.load(open(geo_path))
    bmap = {
        'Plateau-Mont-Royal': 3, 'Rosemont--La-Petite-Patrie': 3, 'Villeray-Saint-Michel-Parc-Extension': 3,
        'Ahuntsic-Cartierville': 3, 'Outremont': 4, 'Ville-Marie': 12, 'Sud-Ouest': 5,
        'Verdun--Ile-des-Soeurs': 9, 'Mercier-Hochelaga-Maisonneuve': 6, 'Cote-des-Neiges--Notre-Dame-de-Grace': 7,
        'LaSalle': 9, 'Saint-Laurent': 7, 'Montreal-Nord': 6, 'St-Leonard': 6, 'Anjou': 6, 'Lachine': 9,
    }
    for ft in gj['features']:
        name = ft['properties']['name']
        val = bmap.get(name, 3)
        geom = ft['geometry']
        polys = geom['coordinates'] if geom['type'] == 'MultiPolygon' else [geom['coordinates']]
        for poly in polys:
            for i, ring in enumerate(poly):
                pts = poly_ll([(c[1], c[0]) for c in ring])
                D.polygon(pts, fill=val if i == 0 else 4)
    # South shore
    ss = SOUTH_SHORE + [(45.4000, -73.4000), (45.6000, -73.4000)]
    D.polygon(poly_ll(ss), fill=11)
    # Hand overrides (grid rects on lattice lines)
    def drect(u0, u1, v0, v1, val):
        D.polygon(rect_g(u0, u1, v0, v1), fill=val)
    drect(ln_u(-17), ln_u(9), ln_v(0), ln_v(5), 1)        # downtown core: Atwater..St-Laurent, RL..Pine
    drect(ln_u(-12), ln_u(4), ln_v(-2), ln_v(0), 1)       # south of RL: Bell Centre / Griffintown edge
    drect(ln_u(9), ln_u(16), ln_v(0), ln_v(4), 12)        # Quartier des spectacles / Latin quarter
    drect(ln_u(-1) + 6, ln_u(1) - 6, ln_v(1) + 6, ln_v(2) - 6, 14)   # Place Ville Marie esplanade
    OMU0, OMU1 = ln_u(3), ln_u(16)
    drect(OMU0, OMU1, -810, ln_v(0), 2)                    # Old Montreal (own finer lattice) down to rue de la Commune
    drect(OMU0, OMU1, -1300, -810, 13)                     # Old Port waterfront: promenade, no street grid
    drect(ln_u(-2) + 6, ln_u(2) - 6, ln_v(5) + 6, ln_v(6) - 6, 15)    # McGill campus
    drect(ln_u(-19) + 6, ln_u(-14) - 6, ln_v(16) + 6, ln_v(19) - 6, 15)
    drect(ln_u(-29) + 6, ln_u(-25) - 6, ln_v(14) + 6, ln_v(16) - 6, 15)   # Saint Joseph's Oratory grounds  # Universite de Montreal
    drect(ln_u(49) + 6, ln_u(55) - 6, ln_v(14) + 6, ln_v(17) - 6, 14)   # Olympic park esplanade
    drect(ln_u(-12), ln_u(3), ln_v(-6), ln_v(-2), 5)       # Griffintown
    # Old Montreal squares carved out of the old-town lattice (inset by the 4.2 m street half-width)
    def om_u(k): return 340.0 + (1469.0 / 20.0) * k
    def om_v(m): return -300.0 + 125.0 * m
    drect(om_u(7) + 4.2, om_u(8) - 4.2, om_v(-2) + 4.2, om_v(-1) - 4.2, 14)     # Place d'Armes
    drect(om_u(12) + 4.2, om_u(13) - 4.2, om_v(-4) + 7.0, om_v(-2) - 4.2, 14)   # Place Jacques-Cartier
    drect(om_u(15) + 4.2, om_u(17) - 4.2, om_v(-4) + 7.0, om_v(-3) - 4.2, 14)   # Bonsecours Market
    drect(om_u(7) + 4.2, om_u(8) - 4.2, om_v(-3) + 4.2, om_v(-2) - 4.2, 14)     # Notre-Dame Basilica block
    # Port strip east of Old Montreal (between the shore and Notre-Dame E)
    port = poly_ll([(45.5150, -73.5470), (45.5205, -73.5445), (45.5268, -73.5410), (45.5335, -73.5380), (45.5425, -73.5340),
                    (45.5505, -73.5300), (45.5585, -73.5242), (45.5665, -73.5172),
                    (45.5690, -73.5215), (45.5610, -73.5285), (45.5530, -73.5340), (45.5445, -73.5385), (45.5350, -73.5420),
                    (45.5280, -73.5450), (45.5215, -73.5485), (45.5160, -73.5500)])
    D.polygon(port, fill=8)
    # Pointe-du-Moulin / Silo 5 + Cite du Havre
    D.polygon(poly_ll([(45.4962, -73.5490), (45.4972, -73.5455), (45.4984, -73.5418), (45.4998, -73.5384), (45.5008, -73.5378),
                       (45.5016, -73.5392), (45.5008, -73.5430), (45.4998, -73.5468), (45.4994, -73.5508), (45.4975, -73.5530)]), fill=13)
    for isl in (ILE_STE_HELENE, ILE_NOTRE_DAME):
        D.polygon(poly_ll(isl), fill=13)
    D.polygon(poly_ll(NUNS_ISLAND), fill=10)
    dist_np = np.asarray(dist).copy()
    dist_np[w] = 0

    # ---------------- distance to water (coarse, for terrain base height)
    dw = ndimage.distance_transform_edt(~w) * PX
    dw_enc = np.clip(dw / 16.0, 0, 255).astype(np.uint8)

    A = np.dstack([enc(water_sdf), enc(sdf(Image.fromarray((park_np * 255).astype(np.uint8)))),
                   enc(sdf(Image.fromarray(((np.asarray(forest) > 127) & ~w).astype(np.uint8) * 255)))])
    B = np.dstack([enc(sdf(Image.fromarray((road_np * 255).astype(np.uint8)))),
                   (dist_np.astype(np.int32) * 16 + 8).clip(0, 255).astype(np.uint8), dw_enc])
    Image.fromarray(A, 'RGB').save(out_dir + '/mask_a.png', optimize=True)
    Image.fromarray(B, 'RGB').save(out_dir + '/mask_b.png', optimize=True)
    print('domain', U0, U1, V0, V1, 'size', W, H)

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])

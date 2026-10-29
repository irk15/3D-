
# Casa Flamingo: a Miami modern villa built procedurally in Blender, lightmapped with Cycles, exported to glTF.
import bpy, bmesh, math, json, os, sys
from mathutils import Vector, Matrix
D = os.path.dirname(os.path.abspath(__file__)); TEX = D + '/tex/'; FURN = D + '/../furn/'; OUT = D + '/out/'; os.makedirs(OUT, exist_ok=True)
BAKE = '--nobake' not in sys.argv; LM_RES = 2048 if '--hi' in sys.argv else 1024; SAMPLES = 96 if '--hi' in sys.argv else 64

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene

# ------------------------------------------------------------------ materials
def img(name, srgb=True):
    im = bpy.data.images.load(TEX + name, check_existing=True)
    if not srgb: im.colorspace_settings.name = 'Non-Color'
    return im
MATS = {}
def mat(name, base=None, tile=2.0, tint=(1, 1, 1), rough=.6, metal=0., nstr=.6, alpha=1., emit=None, tex_rough=True, transmission=0.):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; P = nt.nodes['Principled BSDF']
    P.inputs['Roughness'].default_value = rough; P.inputs['Metallic'].default_value = metal
    if base:
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = img(base + '_a.jpg'); t.location = (-700, 300)
        mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'; mix.inputs['Factor'].default_value = 1.0
        mix.inputs['B'].default_value = (*tint, 1)
        nt.links.new(t.outputs['Color'], mix.inputs['A']); nt.links.new(mix.outputs['Result'], P.inputs['Base Color'])
        n = nt.nodes.new('ShaderNodeTexImage'); n.image = img(base + '_n.jpg', False); n.location = (-700, -300)
        nm = nt.nodes.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = nstr
        nt.links.new(n.outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs['Normal'], P.inputs['Normal'])
        if tex_rough:
            r = nt.nodes.new('ShaderNodeTexImage'); r.image = img(base + '_r.jpg', False); r.location = (-700, 0)
            sp = nt.nodes.new('ShaderNodeSeparateColor'); nt.links.new(r.outputs['Color'], sp.inputs['Color']); nt.links.new(sp.outputs['Green'], P.inputs['Roughness'])
    else:
        P.inputs['Base Color'].default_value = (*tint, 1)
    if alpha < 1: P.inputs['Alpha'].default_value = alpha; m.blend_method = 'BLEND' if hasattr(m, 'blend_method') else None
    if transmission: P.inputs['Transmission Weight'].default_value = transmission
    if emit: P.inputs['Emission Color'].default_value = (*emit[0], 1); P.inputs['Emission Strength'].default_value = emit[1]
    m['tile'] = tile; MATS[name] = m; return m
S = lambda c: tuple(pow(x, 2.2) for x in c)   # sRGB -> linear tint
mat('Stucco', 'plaster', 2.5, S((.98, .97, .95)), .85, nstr=.9)
mat('StuccoPink', 'plaster', 2.5, S((.97, .78, .80)), .85, nstr=.9)
mat('Plaster', 'plaster', 2.0, S((.97, .96, .93)), .85, nstr=.4)
mat('Oak', 'oak', 2.0, (1, 1, 1), .45, nstr=.5)
mat('OakSlat', 'oak', 2.0, (.9, .85, .8), .5, nstr=.6)
mat('Walnut', 'walnut', 1.2, (1, 1, 1), .4, nstr=.4)
mat('Marble', 'marble', 1.6, (1, 1, 1), .12, nstr=.2)
mat('Linen', 'linen', .8, (1, 1, 1), .9, nstr=.5)
mat('Duvet', 'linen', .8, S((.96, .95, .93)), .9, nstr=.6)
mat('Rug', 'linen', 1.0, S((.78, .62, .52)), .95, nstr=.8)
mat('Travertine', 'travertine', 2.0, (1, 1, 1), .7, nstr=.6)
mat('Slate', 'slate', 1.0, (1, 1, 1), .5, nstr=.5)
mat('PoolTile', 'slate', .6, S((.55, .85, 1.0)), .3, nstr=.4)
mat('Ceiling', 'plaster', 2.0, S((.99, .99, .98)), .9, nstr=.2)
mat('Steel', None, tint=S((.08, .08, .09)), rough=.35, metal=.85)
mat('Chrome', None, tint=S((.85, .86, .88)), rough=.08, metal=1.)
mat('Brass', None, tint=S((.85, .66, .35)), rough=.25, metal=1.)
mat('Lacquer', None, tint=S((.93, .93, .91)), rough=.25)
mat('Leather', None, tint=S((.55, .32, .2)), rough=.5)
mat('Black', None, tint=S((.05, .05, .05)), rough=.6)
mat('Lawn', None, tint=S((.24, .42, .2)), rough=.95)
mat('Bark', None, tint=S((.48, .4, .32)), rough=.9)
mat('Glass', None, tint=S((.82, .9, .92)), rough=.02, alpha=.18)
mat('Mirror', None, tint=S((.9, .92, .94)), rough=.02, metal=1.)
mat('Water', None, tint=S((.2, .65, .8)), rough=.03, alpha=.72)
mat('LightStrip', None, tint=(1, 1, 1), emit=(S((1, .82, .6)), 6.))
GLASSY = {'Glass', 'Water', 'Mirror', 'LightStrip', 'Travertine', 'PoolTile', 'Bark'}
# frond
fm = bpy.data.materials.new('Frond'); fm.use_nodes = True; nt = fm.node_tree; P = nt.nodes['Principled BSDF']; t = nt.nodes.new('ShaderNodeTexImage'); t.image = img('frond.png')
nt.links.new(t.outputs['Color'], P.inputs['Base Color']); nt.links.new(t.outputs['Alpha'], P.inputs['Alpha']); P.inputs['Roughness'].default_value = .7
fm.blend_method = 'CLIP' if hasattr(fm, 'blend_method') else None; MATS['Frond'] = fm; GLASSY.add('Frond')

# ------------------------------------------------------------------ geometry helpers
PARTS = {}   # material -> list of bmesh-able (verts, faces)
def add_box(m, x0, y0, z0, x1, y1, z1, skip=()):
    """axis-aligned box in world metres; UVs are world-projected per face so textures keep real-world scale"""
    if x1 < x0: x0, x1 = x1, x0
    if y1 < y0: y0, y1 = y1, y0
    if z1 < z0: z0, z1 = z1, z0
    v = [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0), (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
    F = {'-z': (0, 3, 2, 1), '+z': (4, 5, 6, 7), '-y': (0, 1, 5, 4), '+y': (2, 3, 7, 6), '-x': (3, 0, 4, 7), '+x': (1, 2, 6, 5)}
    PARTS.setdefault(m, []).append((v, [f for k, f in F.items() if k not in skip]))
def add_mesh(m, verts, faces): PARTS.setdefault(m, []).append((verts, faces))
def add_cyl(m, cx, cy, z0, z1, r, seg=20, r1=None):
    r1 = r if r1 is None else r1; v = []; f = []
    for i in range(seg):
        a = 2 * math.pi * i / seg; v += [(cx + math.cos(a) * r, cy + math.sin(a) * r, z0), (cx + math.cos(a) * r1, cy + math.sin(a) * r1, z1)]
    for i in range(seg):
        a, b = i * 2, ((i + 1) % seg) * 2; f.append((a, b, b + 1, a + 1))
    f.append(tuple(i * 2 for i in range(seg))[::-1]); f.append(tuple(i * 2 + 1 for i in range(seg)))
    add_mesh(m, v, f)
def build_object(name, mats, lightmap=True):
    me = bpy.data.meshes.new(name); bm = bmesh.new(); uv = bm.loops.layers.uv.new('UVMap')
    order = [m for m in mats if m in PARTS]; slot = {m: i for i, m in enumerate(order)}
    for m in order:
        tile = MATS[m].get('tile', 2.0)
        for verts, faces in PARTS[m]:
            bv = [bm.verts.new(p) for p in verts]
            for fi in faces:
                try: f = bm.faces.new([bv[i] for i in fi])
                except ValueError: continue
                f.material_index = slot[m]; f.normal_update(); n = f.normal; an = (abs(n.x), abs(n.y), abs(n.z))
                for l in f.loops:
                    p = l.vert.co
                    if an[2] >= an[0] and an[2] >= an[1]: u, w = p.x, p.y
                    elif an[0] >= an[1]: u, w = p.y, p.z
                    else: u, w = p.x, p.z
                    l[uv].uv = (u / tile, w / tile)
    bm.to_mesh(me); bm.free(); ob = bpy.data.objects.new(name, me); sc.collection.objects.link(ob)
    for m in order: me.materials.append(MATS[m])
    return ob

# ------------------------------------------------------------------ the villa
W, Dp = 20.0, 14.0; G0, C0 = .3, 3.5; G1, C1 = 3.8, 6.9; T = .25
COLL = {'walls0': [], 'walls1': [], 'stairs': None, 'floors': [], 'points': {}}
def wall(m_out, m_in, x0, y0, x1, y1, z0, z1, level, openings=(), out_side=None):
    """straight wall along x or y with rectangular openings [(a0,a1,zb,zt)] measured along the wall"""
    along_x = abs(x1 - x0) > abs(y1 - y0); L0, L1 = (x0, x1) if along_x else (y0, y1); cuts = sorted(openings)
    segs = []; a = L0
    for (o0, o1, zb, zt) in cuts:
        if o0 > a: segs.append((a, o0, z0, z1))
        if zb > z0: segs.append((o0, o1, z0, zb))
        if zt < z1: segs.append((o0, o1, zt, z1))
        a = o1
    if a < L1: segs.append((a, L1, z0, z1))
    for (s0, s1, zb, zt) in segs:
        zb = zb - .1 if abs(zb - z0) < 1e-6 else zb; zt = zt + .1 if abs(zt - z1) < 1e-6 else zt   # sink into slabs: no light leaks at the seams
        if along_x: add_box(m_in, s0, y0 - T / 2, zb, s1, y0 + T / 2, zt)
        else: add_box(m_in, x0 - T / 2, s0, zb, x0 + T / 2, s1, zt)
    # collision: the wall line minus door openings (openings that start at floor level)
    a = L0
    for (o0, o1, zb, zt) in cuts:
        if zb <= z0 + .05:
            if o0 > a: COLL['walls' + str(level)].append([x0, y0, x1, y1, a, o0, along_x])
            a = o1
    if a < L1: COLL['walls' + str(level)].append([x0, y0, x1, y1, a, L1, along_x])
def glass_panes(x0, y0, x1, y1, z0, z1, every=2.5, gap=None):
    along_x = abs(x1 - x0) > abs(y1 - y0); L0, L1 = (x0, x1) if along_x else (y0, y1); n = max(1, round((L1 - L0) / every)); step = (L1 - L0) / n
    for k in range(n):
        a, b = L0 + k * step, L0 + (k + 1) * step
        mx = lambda s0, s1, za, zb, m: add_box(m, s0, y0 - .03, za, s1, y0 + .03, zb) if along_x else add_box(m, x0 - .03, s0, za, x0 + .03, s1, zb)
        if not (gap and a >= gap[0] - .01 and b <= gap[1] + .01): mx(a + .03, b - .03, z0, z1, 'Glass')
        mx(a - .03, a + .03, z0, z1, 'Steel'); mx(b - .03, b + .03, z0, z1, 'Steel')
    mx2 = (lambda za, zb: add_box('Steel', L0, y0 - .05, za, L1, y0 + .05, zb)) if along_x else (lambda za, zb: add_box('Steel', x0 - .05, L0, za, x0 + .05, L1, zb))
    mx2(z0 - .04, z0 + .02); mx2(z1 - .02, z1 + .05)

# floors / slabs
add_box('Stucco', -.3, -.3, 0, W + .3, Dp + .3, G0 - .06)                    # plinth
add_box('Oak', 0, 0, G0 - .05, W, Dp, G0, skip=('-z',))
COLL['floors'].append([0, 0, W, Dp, G0, 0])
# upper slab with stair void x[.2,1.9] y[5.3,12.6]; balcony y[-2,0] (cantilever to the pool side)
for (x0, y0, x1, y1) in [(0, -2.2, W, 5.3), (1.9, 5.3, W, 12.6), (0, 12.6, W, Dp), (-.0, 5.3, .2, 12.6)]:
    add_box('Stucco', x0, y0, C0, x1, y1, G1 - .07)
    add_box('Ceiling', x0, y0, C0 - .001, x1, y1, C0, skip=('+z',))
for (x0, y0, x1, y1, m) in [(0, 0, W, 5.3, 'Oak'), (1.9, 5.3, W, 12.6, 'Oak'), (0, 12.6, W, Dp, 'Oak'), (0, -2.2, W, 0, 'Travertine')]:
    add_box(m, x0, y0, G1 - .06, x1, y1, G1, skip=('-z',))
COLL['floors'].append([0, -2.2, W, 5.3, G1, 1]); COLL['floors'].append([1.9, 5.3, W, Dp, G1, 1]); COLL['floors'].append([0, 12.6, W, Dp, G1, 1])
# roof slab with deep overhang + parapet
add_box('Stucco', -.8, -2.8, C1, W + .8, Dp + .6, C1 + .35); add_box('Ceiling', -.8, -2.8, C1 - .001, W + .8, Dp + .6, C1, skip=('+z',))
for (x0, y0, x1, y1) in [(-.8, -2.8, W + .8, -2.6), (-.8, Dp + .4, W + .8, Dp + .6), (-.8, -2.8, -.6, Dp + .6), (W + .6, -2.8, W + .8, Dp + .6)]: add_box('Stucco', x0, y0, C1 + .35, x1, y1, C1 + .75)
add_box('LightStrip', -.6, -2.62, C1 - .03, W + .6, -2.55, C1 - .01)       # cove light under the canopy
# ---- ground floor walls (y=0 front is a glass wall to the pool) ----
wall('Stucco', 'Stucco', 0, Dp, W, Dp, G0, C0, 0, [(12.2, 18.2, 1.25, 2.55)])                          # back: kitchen window
wall('Stucco', 'Stucco', 0, 0, 0, Dp, G0, C0, 0, [(1.5, 6.5, .9, 2.8)])                                 # west: living window
wall('Stucco', 'Stucco', W, 0, W, Dp, G0, C0, 0, [(9.2, 10.6, G0, 2.7), (2, 5.5, .9, 2.8)])            # east: front door + window

add_box('Walnut', W - .05, 10.55, G0, W + 1.3, 10.6, 2.65)
glass_panes(0, 0, W, 0, G0, C0, 2.5, gap=(5.0, 7.5))                                                     # sliding glass wall, one bay open
COLL['walls0'].append([0, 0, W, 0, 0, 5.0, True]); COLL['walls0'].append([0, 0, W, 0, 7.5, W, True])
for (y0, y1) in [(1.5, 6.5)]: glass_panes(0, y0, 0, y1, .9, 2.8, 2.5)
glass_panes(W, 2, W, 5.5, .9, 2.8, 1.75); glass_panes(12.2, Dp, 18.2, Dp, 1.25, 2.55, 2.0)
# powder room x[3,6] y[11.5,14]
wall('Plaster', 'Plaster', 3, 11.5, 6, 11.5, G0, C0, 0, [(4.1, 5.0, G0, 2.3)]); wall('Plaster', 'Plaster', 6, 11.5, 6, Dp, G0, C0, 0)
# ---- upper floor walls ----
wall('Stucco', 'Stucco', 0, Dp, W, Dp, G1, C1, 1, [(5.0, 9.0, 4.9, 6.2), (14.5, 17.5, 5.3, 6.3)])
wall('Stucco', 'Stucco', 0, 0, 0, Dp, G1, C1, 1); wall('Stucco', 'Stucco', W, 0, W, Dp, G1, C1, 1, [(3, 7, 4.6, 6.4)])
glass_panes(0, 0, W, 0, G1, C1, 2.5, gap=(12.5, 15.0)); COLL['walls1'].append([0, 0, W, 0, 0, 12.5, True]); COLL['walls1'].append([0, 0, W, 0, 15.0, W, True])
glass_panes(W, 3, W, 7, 4.6, 6.4, 2.0); glass_panes(5, Dp, 9, Dp, 4.9, 6.2, 2.0); glass_panes(14.5, Dp, 17.5, Dp, 5.3, 6.3, 1.5)
# bathroom x[13,20] y[8.5,14] with glass partition + door gap
wall('Plaster', 'Plaster', 13, 8.5, W, 8.5, G1, C1, 1, [(13.6, 14.6, G1, 6.0)]); wall('Plaster', 'Plaster', 13, 8.5, 13, Dp, G1, C1, 1)
add_box('Slate', 13.1, 8.6, G1 - .01, W, Dp, G1 + .005, skip=('-z',))
# balcony glass balustrade + handrail
glass_panes(0, -2.15, W, -2.15, G1, G1 + 1.05, 2.5); add_box('Steel', 0, -2.2, G1 + 1.05, W, -2.1, G1 + 1.1)
COLL['walls1'].append([0, -2.15, W, -2.15, 0, W, True]); COLL['walls1'].append([0, -2.2, 0, 0, -2.2, 0, False]); COLL['walls1'].append([W, -2.2, W, 0, -2.2, 0, False])
# stair: floating oak treads along the west wall, y 5.3 -> 12.6, rise G0 -> G1
NST = 20
for k in range(NST):
    y0 = 5.3 + k * (12.6 - 5.3) / NST; z = G0 + (k + 1) * (G1 - G0) / NST
    add_box('Oak', .25, y0, z - .06, 1.85, y0 + .34, z)
    add_box('Steel', .25, y0 + .1, z - .2, 1.85, y0 + .14, z - .06)
glass_panes(1.9, 5.3, 1.9, 12.6, G0 + .3, G1 + 1.0, 2.4)      # glass stair balustrade (full height through the void)
COLL['stairs'] = {'x0': .25, 'x1': 1.85, 'y0': 5.3, 'y1': 12.6, 'z0': G0, 'z1': G1}
COLL['walls0'].append([1.9, 5.3, 1.9, 12.6, 5.3, 12.6, False]); COLL['walls1'].append([1.9, 5.3, 1.9, 12.6, 5.3, 12.6, False])
# exterior: wood slat screen on the east upper facade + pink feature fin
for k in range(26): add_box('OakSlat', W + .05, -2.2 + k * .55, G1, W + .15, -2.2 + k * .55 + .12, C1)
add_box('StuccoPink', 9.4, -3.0, 0, 10.0, -2.2, C1 + .35)
add_box('LightStrip', 9.38, -3.02, 0, 9.42, -2.95, C1 + .3)

# ------------------------------------------------------------------ built-in furniture (procedural)
# kitchen: back counter with marble top, tall cabinets, island
add_box('Lacquer', 10.6, 13.15, G0, 19.6, 13.85, G0 + .88); add_box('Marble', 10.55, 13.1, G0 + .88, 19.65, 13.88, G0 + .92)
add_box('Marble', 10.6, 13.83, G0 + .92, 19.6, 13.86, 1.25)                                     # splashback
add_box('Walnut', 10.6, 13.45, 2.6, 19.6, 13.85, C0 - .05)                                       # upper cabinets
add_box('Steel', 15.2, 13.3, G0 + .9, 15.9, 13.7, G0 + .93); add_cyl('Chrome', 15.55, 13.75, G0 + .92, G0 + 1.25, .02)
add_box('Lacquer', 13.0, 9.6, G0, 17.4, 10.6, G0 + .9); add_box('Marble', 12.9, 9.5, G0 + .9, 17.5, 10.7, G0 + .95)
for k in range(4): add_cyl('Brass', 13.6 + k * 1.1, 10.95, G0, G0 + .72, .03); add_cyl('Leather', 13.6 + k * 1.1, 10.95, G0 + .72, G0 + .78, .2)
for k in range(3): add_cyl('Brass', 13.8 + k * 1.5, 10.1, 2.4, C0, .006); add_cyl('Brass', 13.8 + k * 1.5, 10.1, 2.25, 2.4, .16, 16, .05)
# dining table (walnut) for 6
add_box('Walnut', 12.0, 3.0, G0 + .72, 17.0, 4.2, G0 + .77)
for (x, y) in [(12.3, 3.2), (16.7, 3.2), (12.3, 4.0), (16.7, 4.0)]: add_box('Steel', x - .04, y - .04, G0, x + .04, y + .04, G0 + .72)
add_box('LightStrip', 13.0, 3.55, 2.55, 16.0, 3.65, 2.6); add_cyl('Steel', 13.0, 3.6, 2.6, C0, .005); add_cyl('Steel', 16.0, 3.6, 2.6, C0, .005)
# living: rug, coffee table, TV wall with slats, low media console, shelves
add_box('Rug', 2.2, 1.6, G0, 8.6, 6.4, G0 + .015)
add_box('Marble', 4.3, 3.3, G0 + .34, 6.5, 4.5, G0 + .38); add_box('Walnut', 4.4, 3.4, G0, 6.4, 4.4, G0 + .34)
for k in range(18): add_box('OakSlat', .14, 1.6 + k * .28, G0, .26, 1.6 + k * .28 + .14, C0)       # slatted feature wall (behind TV)
add_box('Black', .3, 2.7, 1.25, .36, 5.3, 2.7)                                                     # TV
add_box('Walnut', .3, 2.3, G0 + .1, .85, 5.7, G0 + .55)
# powder room vanity
add_box('Marble', 3.15, 13.4, G0 + .8, 5.9, 13.9, G0 + .85); add_cyl('Chrome', 4.5, 13.8, G0 + .85, G0 + 1.1, .015); add_box('Mirror', 3.6, 13.86, 1.3, 5.4, 13.88, 2.3)
# bedroom: platform bed with upholstered headboard, nightstands, wardrobe wall, bench
bx0, bx1, by0, by1 = 5.3, 7.7, 11.6, 13.85
add_box('Walnut', bx0 - .1, by0 - .1, G1, bx1 + .1, by1, G1 + .3); add_box('Duvet', bx0, by0, G1 + .3, bx1, by1 - .1, G1 + .55)
add_box('Linen', bx0 - .3, by1 - .12, G1, bx1 + .3, by1, G1 + 1.25)
for k in range(2): add_box('Duvet', bx0 + .15 + k * 1.1, by1 - .65, G1 + .55, bx0 + 1.05 + k * 1.1, by1 - .2, G1 + .72)
add_box('Linen', bx0 - .02, by0 - .02, G1 + .48, bx1 + .02, by0 + .6, G1 + .58)
for x in (bx0 - .8, bx1 + .25): add_box('Walnut', x, by1 - .55, G1, x + .55, by1, G1 + .5); add_cyl('Brass', x + .27, by1 - .27, G1 + .5, G1 + .9, .01); add_cyl('Linen', x + .27, by1 - .27, G1 + .9, G1 + 1.15, .14, 18, .1)
add_box('Lacquer', 2.2, 2.4, G1, 4.4, 2.95, C1 - .1)                                               # wardrobe
add_box('Leather', 5.4, 10.4, G1, 7.6, 10.9, G1 + .45)                                             # bed bench
add_box('Rug', 4.4, 9.6, G1, 8.6, 13.8, G1 + .015)
# bathroom: freestanding tub, double vanity, walk-in shower glass
add_box('Lacquer', 15.0, 12.4, G1, 17.6, 13.7, G1 + .6); add_box('Marble', 15.1, 12.5, G1 + .1, 17.5, 13.6, G1 + .61, skip=('+z',))
add_box('Water', 15.15, 12.55, G1 + .48, 17.45, 13.55, G1 + .5)
add_box('Marble', 18.9, 9.0, G1 + .82, 19.9, 12.0, G1 + .88); add_box('Walnut', 18.95, 9.05, G1 + .3, 19.9, 11.95, G1 + .82)
add_box('Mirror', 19.85, 9.2, G1 + 1.1, 19.88, 11.8, G1 + 2.2)
glass_panes(13.1, 9.9, 14.8, 9.9, G1, G1 + 2.2, 1.7)
add_box('Lacquer', 13.2, 10.0, G1, 14.8, 13.8, G1 + .04)

# ------------------------------------------------------------------ exterior: deck, pool, loungers, lawn, palms
ZOFF = .6
px0, px1, py0, py1 = 2.0, 15.0, -12.5, -5.0
for (a0, b0, a1, b1) in [(-8, -16, W + 8, py0 - .4), (-8, py1 + .4, W + 8, -.3), (-8, py0 - .4, px0 - .4, py1 + .4), (px1 + .4, py0 - .4, W + 8, py1 + .4)]: add_box('Travertine', a0, b0, -ZOFF - .02, a1, b1, .02, skip=('-z',))
add_box('Travertine', px0 - .4, py0 - .4, -ZOFF - .02, px1 + .4, py1 + .4, -.5)
add_box('Travertine', -8, -.3, -ZOFF - .02, -.3, Dp + 3, .02, skip=('-z',)); add_box('Travertine', W + .3, -.3, -ZOFF - .02, W + 8, Dp + 3, .02, skip=('-z',))
add_box('Stucco', -.3, -.3, -ZOFF - .02, W + .3, Dp + .3, 0)
add_box('PoolTile', px0, py0, -.5, px1, py1, -.48)
for (a0, b0, a1, b1) in [(px0, py0, px1, py0 + .02), (px0, py1 - .02, px1, py1), (px0, py0, px0 + .02, py1), (px1 - .02, py0, px1, py1)]: add_box('PoolTile', a0, b0, -.5, a1, b1, .02)
add_box('Water', px0, py0, -.08, px1, py1, -.06)
for (a0, b0, a1, b1) in [(px0 - .4, py0 - .4, px1 + .4, py0), (px0 - .4, py1, px1 + .4, py1 + .4), (px0 - .4, py0, px0, py1), (px1, py0, px1 + .4, py1)]: add_box('Marble', a0, b0, 0, a1, b1, .05)
def lounger(x, y):
    L, Wd = 1.95, .72
    for sx in (0, Wd - .05): add_box('OakSlat', x + sx, y, .18, x + sx + .05, y + L, .26)          # side rails
    for k in range(13): add_box('OakSlat', x + .05, y + .05 + k * .1, .24, x + Wd - .05, y + .12 + k * .1, .27)   # slats
    for (lx, ly) in [(0, 0), (Wd - .05, 0), (0, L - .06), (Wd - .05, L - .06)]: add_box('OakSlat', x + lx, y + ly, .02, x + lx + .05, y + ly + .06, .2)
    add_box('Linen', x + .03, y + .02, .27, x + Wd - .03, y + 1.3, .35); add_box('Linen', x + .06, y + .05, .35, x + Wd - .06, y + 1.27, .37)
    a = math.radians(55); b0 = Vector((0, 1.3, .3)); d = Vector((0, math.cos(a), math.sin(a))) * .72; n = Vector((0, -math.sin(a), math.cos(a))) * .1
    for (m, off, w0, w1) in [('OakSlat', 0, 0, Wd), ('Linen', .1, .04, Wd - .04)]:
        p0 = Vector((x, y, 0)) + b0 + n * off / .1; v = []
        for (px, pt) in [(w0, p0), (w1, p0), (w1, p0 + d), (w0, p0 + d)]: v.append(tuple(Vector((px, 0, 0)) + pt))
        v += [tuple(Vector(q) + n) for q in v]; add_mesh(m, v, [(0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)])
for k in range(4): lounger(3.0 + k * 2.6, -3.95)
def palm(x, y, h=8.0):
    for k in range(10):
        z0, z1 = k * h / 10, (k + 1) * h / 10; bend = lambda z: .08 * (z / h) ** 2 * h
        add_cyl('Bark', x + bend(z0), y, z0, z1, .26 - k * .012, 10, .25 - k * .012)
    tx = x + .08 * h
    for k in range(13):
        a = k / 13 * 2 * math.pi; L = 3.4; d = Vector((math.cos(a), math.sin(a), 0)); side = Vector((-d.y, d.x, 0)) * .55
        base = Vector((tx, y, h)); pts = [base + d * (L * t) + Vector((0, 0, .9 * t - 2.2 * t * t)) for t in (0, .5, 1)]
        v = []; f = []
        for i, p in enumerate(pts): v += [tuple(p - side * (1 - i * .3)), tuple(p + side * (1 - i * .3))]
        for i in range(2): f.append((i * 2, i * 2 + 2, i * 2 + 3, i * 2 + 1))
        PARTS.setdefault('Frond', []).append((v, f))
for (x, y) in [(-4, -4), (W + 4, -3), (-4.5, Dp + 4), (W + 4.5, Dp + 3.5), (17.5, -13.5)]: palm(x, y, 7 + (x * 7 + y) % 3)

# ------------------------------------------------------------------ objects
shell_mats = [m for m in PARTS if m not in GLASSY]
shell = build_object('VillaShell', shell_mats)
glassob = build_object('VillaGlass', [m for m in PARTS if m in GLASSY])
# frond UVs: map quads to the frond texture
for poly in glassob.data.polygons:
    if glassob.data.materials[poly.material_index].name == 'Frond':
        for i, li in enumerate(poly.loop_indices): glassob.data.uv_layers['UVMap'].data[li].uv = [(0, 0), (0, 1), (1, 1), (1, 0)][i % 4] if False else [(0, .0), (.5, 0), (.5, 1), (0, 1)][i % 4]

# ------------------------------------------------------------------ realistic furniture (Khronos glTF samples, CC-BY 4.0 / CC0)
FURN_PLACE = [   # name, x, y, floor z, yaw deg, target size (largest horizontal dim, m)
    ('GlamVelvetSofa', 5.4, 1.7, G0, 0, 2.6), ('SheenChair', 2.6, 4.0, G0, -70, .8), ('SheenChair', 8.2, 4.0, G0, 70, .8),
    ('DiffuseTransmissionPlant', 1.0, 1.0, G0, 0, .9), ('DiffuseTransmissionPlant', 19.0, 13.0, G1, 0, .9), ('AnisotropyBarnLamp', 8.6, 6.0, G0, 200, .5),
    ('ABeautifulGame', 5.4, 3.9, G0 + .38, 0, .45), ('GlassVaseFlowers', 14.5, 3.6, G0 + .77, 0, .35), ('DiffuseTransmissionTeacup', 15.2, 10.1, G0 + .95, 30, .14),
    ('CommercialRefrigerator', 19.3, 11.5, G0, -90, 1.0),
    ('ChairDamaskPurplegold', 12.8, 2.5, G0, 0, .55), ('ChairDamaskPurplegold', 14.5, 2.5, G0, 0, .55), ('ChairDamaskPurplegold', 16.2, 2.5, G0, 0, .55),
    ('ChairDamaskPurplegold', 12.8, 4.7, G0, 180, .55), ('ChairDamaskPurplegold', 14.5, 4.7, G0, 180, .55), ('ChairDamaskPurplegold', 16.2, 4.7, G0, 180, .55),
    ('SheenWoodLeatherSofa', 16.2, 2.6, G1, 0, 2.2), ('IridescenceLamp', 18.8, 2.4, G1, 0, .45), ('SheenChair', 3.4, 7.0, G1, 120, .8),
]
furn_objs = []
for (nm, x, y, z, yaw, size) in FURN_PLACE:
    before = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=FURN + nm + '.glb'); new = [o for o in bpy.data.objects if o not in before]
    roots = [o for o in new if o.parent is None]; bpy.context.view_layer.update()
    mn = Vector((1e9, 1e9, 1e9)); mx = Vector((-1e9, -1e9, -1e9))
    for o in new:
        if o.type == 'MESH':
            for c in o.bound_box: w = o.matrix_world @ Vector(c); mn = Vector(map(min, mn, w)); mx = Vector(map(max, mx, w))
    s = size / max(mx.x - mn.x, mx.y - mn.y, 1e-3); ctr = Vector(((mn.x + mx.x) / 2, (mn.y + mx.y) / 2, mn.z))
    piv = bpy.data.objects.new('F_' + nm, None); sc.collection.objects.link(piv)
    for r in roots: r.parent = piv; r.matrix_parent_inverse = Matrix.Translation(-ctr)
    piv.scale = (s, s, s); piv.rotation_euler = (0, 0, math.radians(yaw)); piv.location = (x, y, z)
    furn_objs.append((nm, x, y, z, yaw, s, new, piv))

for o in [shell, glassob] + [f[7] for f in furn_objs]: o.location.z += ZOFF
# ------------------------------------------------------------------ lighting + bake
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = SAMPLES; sc.cycles.use_denoising = False
try: sc.cycles.max_bounces = 4; sc.cycles.diffuse_bounces = 3
except Exception: pass
world = bpy.data.worlds.new('W'); sc.world = world; world.use_nodes = True; bgn = world.node_tree.nodes['Background']
def set_world(col, st): bgn.inputs['Color'].default_value = (*col, 1); bgn.inputs['Strength'].default_value = st
sun_data = bpy.data.lights.new('Sun', 'SUN'); sun_data.energy = 4.5; sun_data.angle = math.radians(1.2); sun_data.color = (1, .96, .9)
sun = bpy.data.objects.new('Sun', sun_data); sc.collection.objects.link(sun); sun.rotation_euler = (math.radians(50), 0, math.radians(-35))
interior = []
for (x, y, z, e) in [(5, 3.5, C0 - .05, 140), (14.5, 3.6, C0 - .05, 110), (15, 10.5, C0 - .05, 110), (3, 9, C0 - .05, 60), (4.5, 12.7, C0 - .05, 30),
                     (6.5, 8, C1 - .05, 140), (16, 5, C1 - .05, 110), (16.5, 11.5, C1 - .05, 90), (10, -1.5, C1 - .05, 80)]:
    ld = bpy.data.lights.new('L', 'AREA'); ld.size = 1.2; ld.energy = e; ld.color = (1, .82, .62); o = bpy.data.objects.new('L', ld); o.location = (x, y, z + ZOFF); o.rotation_euler = (math.pi, 0, 0); sc.collection.objects.link(o); interior.append(o)
# lightmap UVs
bpy.context.view_layer.objects.active = shell; shell.select_set(True)
lm = shell.data.uv_layers.new(name='Lightmap'); shell.data.uv_layers.active = lm
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=.002, area_weight=0.0, scale_to_bounds=False)
bpy.ops.uv.average_islands_scale()
try: bpy.ops.uv.pack_islands(margin=.0025, rotate=True, shape_method='CONCAVE')
except TypeError: bpy.ops.uv.pack_islands(margin=.0025, rotate=True)
bpy.ops.object.mode_set(mode='OBJECT'); shell.data.uv_layers.active = shell.data.uv_layers['UVMap']; shell.data.uv_layers['UVMap'].active_render = True

def bake(tag, sun_on, sun_e, world_col, world_st, lamps_e):
    im = bpy.data.images.new('LM_' + tag, LM_RES, LM_RES, float_buffer=True)
    for m in shell.data.materials:
        nt = m.node_tree; n = nt.nodes.new('ShaderNodeTexImage'); n.name = 'BAKE'; n.image = im
        uvn = nt.nodes.new('ShaderNodeUVMap'); uvn.uv_map = 'Lightmap'; nt.links.new(uvn.outputs['UV'], n.inputs['Vector']); nt.nodes.active = n
    sun.hide_render = not sun_on; sun_data.energy = sun_e; set_world(world_col, world_st)
    for o in interior: o.data.energy = o.data.energy if lamps_e is None else lamps_e * (o.data.energy / max(1e-6, o.data.get('e0', o.data.energy)))
    shell.data.uv_layers.active = shell.data.uv_layers['Lightmap']
    bpy.ops.object.select_all(action='DESELECT'); shell.select_set(True); bpy.context.view_layer.objects.active = shell
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT', 'INDIRECT'}, margin=6, use_clear=True)
    im.filepath_raw = OUT + 'lm_' + tag + '.exr'; im.file_format = 'OPEN_EXR'; im.save()
    for m in shell.data.materials:
        nt = m.node_tree
        for n in [n for n in nt.nodes if n.name.startswith('BAKE') or n.type == 'UVMAP']: nt.nodes.remove(n)
    shell.data.uv_layers.active = shell.data.uv_layers['UVMap']
for o in interior: o.data['e0'] = o.data.energy
import time
if BAKE:
    t0 = time.time()
    for o in interior: o.hide_render = False
    for o in interior: o.data.energy = o.data['e0'] * .25
    bake('day', True, 4.5, (.55, .7, 1.0), 1.4, None); print('day bake', round(time.time() - t0), 's', flush=True)
    t0 = time.time()
    for o in interior: o.data.energy = o.data['e0']
    bake('night', False, 0, (.05, .06, .12), .35, None); print('night bake', round(time.time() - t0), 's', flush=True)

# ------------------------------------------------------------------ export
for o in bpy.data.objects: o.select_set(False)
shell.select_set(True); glassob.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT + 'villa.glb', export_format='GLB', use_selection=True, export_texcoords=True, export_normals=True, export_materials='EXPORT', export_apply=True, export_yup=True, export_image_format='JPEG', export_lights=False, export_cameras=False)
# furniture placement in three.js space (Blender x,y,z -> three x, z, -y; yaw about Z -> about Y)
COLL['furniture'] = [{'name': n, 'x': x, 'y': z + ZOFF, 'z': -y, 'yaw': math.radians(yaw), 'scale': s} for (n, x, y, z, yaw, s, new, piv) in furn_objs]
# keep the importer's pivot convention: we also need the pivot offset (centre of bbox) -> store it
for rec, (n, x, y, z, yaw, s, new, piv) in zip(COLL['furniture'], furn_objs):
    r = [o for o in new if o.parent == piv][0]; inv = r.matrix_parent_inverse.translation; rec['ox'] = inv.x; rec['oy'] = inv.z; rec['oz'] = -inv.y
for f in COLL['floors']: f[4] += ZOFF
COLL['stairs']['z0'] += ZOFF; COLL['stairs']['z1'] += ZOFF
COLL['deck'] = [[-8, -16, W + 8, -.3], [-8, -.3, -.3, Dp + 3], [W + .3, -.3, W + 8, Dp + 3], [-.3, -.3, W + .3, Dp + .3]]; COLL['deckZ'] = ZOFF + .02; COLL['pool'] = [px0, py0, px1, py1]
COLL['size'] = [W, Dp]; COLL['levels'] = [G0 + ZOFF, G1 + ZOFF]; COLL['points'] = {'Front door': [W + 2.5, 9.9, ZOFF + .02], 'Living room': [5.4, 5.5, G0 + ZOFF], 'Kitchen': [15, 8, G0 + ZOFF], 'Dining': [14.5, 6.2, G0 + ZOFF], 'Bedroom': [6.5, 9.0, G1 + ZOFF], 'Bathroom': [15.5, 10.8, G1 + ZOFF], 'Balcony': [13.7, -1.2, G1 + ZOFF], 'Pool deck': [8.5, -4.2, ZOFF + .02]}
json.dump(COLL, open(OUT + 'villa.json', 'w'))
print('exported', os.path.getsize(OUT + 'villa.glb'), flush=True)

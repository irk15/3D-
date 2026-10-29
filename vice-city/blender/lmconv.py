import bpy, numpy as np, sys, json
from PIL import Image
OUT = sys.argv[-1]; meta = {}
for tag in ('day', 'night'):
    im = bpy.data.images.load(OUT + 'lm_' + tag + '.exr'); w, h = im.size
    a = np.array(im.pixels[:], dtype=np.float32).reshape(h, w, 4)[::-1, :, :3]
    # denoise: mask-aware normalised blur inside UV islands (indirect light is smooth)
    from PIL import ImageFilter
    m = (a.max(axis=2) > 1e-6).astype(np.float32); r = 2 if w <= 1024 else 3
    def box(x, k, ax):
        c = np.cumsum(np.pad(x, [(k + 1, k) if i == ax else (0, 0) for i in range(2)], mode='edge'), axis=ax, dtype=np.float64)
        n = x.shape[ax]; return ((np.take(c, range(2 * k + 1, 2 * k + 1 + n), axis=ax) - np.take(c, range(0, n), axis=ax)) / (2 * k + 1)).astype(np.float32)
    def gb(x):
        for _ in range(3): x = box(box(x, r, 0), r, 1)
        return x
    den = gb(m) + 1e-6; a = np.dstack([gb(a[..., c] * m) / den for c in range(3)]) * m[..., None] + a * (1 - m[..., None])
    lum = a.mean(axis=2); k = float(np.percentile(lum[lum > 0], 99.3)) or 1.0
    enc = np.clip(a / k, 0, 1) ** (1 / 2.2)           # sRGB-ish gamma: three decodes it back to linear
    Image.fromarray((enc * 255 + .5).astype(np.uint8)).save(OUT + 'lm_' + tag + '.png'); meta[tag] = k
    print(tag, w, 'scale', round(k, 3), 'mean', float(lum.mean()))
json.dump(meta, open(OUT + 'lm_scale.json', 'w'))

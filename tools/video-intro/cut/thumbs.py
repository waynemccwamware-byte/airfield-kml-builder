from PIL import Image, ImageDraw, ImageFilter, ImageEnhance
F = lambda w, s, mono=False: __import__('PIL.ImageFont', fromlist=['x']).truetype(f"/home/claude/cut/fonts/ibm-plex-{'mono' if mono else 'sans'}-latin-{w}-normal.ttf", s)
W, H = 1280, 720; AMBER = (245, 166, 35)
def cover(img, w, h, cx=0.5, cy=0.5, z=1.0):
    s = max(w / img.width, h / img.height) * z; im = img.resize((round(img.width * s), round(img.height * s)), Image.LANCZOS)
    x = round((im.width - w) * cx); y = round((im.height - h) * cy); return im.crop((x, y, x + w, y + h))
def band(im, y0, y1, a=170):
    ov = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
    for y in range(y0, y1): d.line([(0, y), (W, y)], fill=(10, 14, 20, int(a * min(1, (y - y0) / 60 + 0.15))))
    return Image.alpha_composite(im.convert('RGBA'), ov)
def tag(d, x, y, text, fill):
    f = F(600, 34); b = d.textbbox((0, 0), text, font=f); w, h = b[2] - b[0], b[3] - b[1]
    d.rounded_rectangle([x, y, x + w + 36, y + h + 26], 10, fill=fill); d.text((x + 18, y + 11 - b[1]), text, font=f, fill=(15, 18, 24))
def title(d, y, l1, l2):
    for dx, dy in ((3, 3),): d.text((40 + dx, y + dy), l1, font=F(600, 76), fill=(0, 0, 0))
    d.text((40, y), l1, font=F(600, 76), fill=(255, 255, 255)); d.text((42, y + 92), l2, font=F(600, 46), fill=AMBER)
# A: real | sim split at San Pedro de la Cueva
real, sim = Image.open('/tmp/th_real.png').convert('RGB'), Image.open('/tmp/th_sim.png').convert('RGB')
a = Image.new('RGB', (W, H)); a.paste(cover(real, W // 2, H, 0.75, 0.3), (0, 0)); a.paste(cover(sim, W // 2, H, 0.48, 0.62, 1.45), (W // 2, 0))
a = band(a, 430, H, 200); d = ImageDraw.Draw(a); d.line([(W // 2, 0), (W // 2, 430)], fill=(255, 255, 255), width=4)
tag(d, 24, 24, 'REAL', AMBER); tag(d, W // 2 + 24, 24, 'X-PLANE', (120, 200, 255))
title(d, 478, "Mexico's Remote Airstrips", 'in ForeFlight and X-Plane')
a.convert('RGB').save('final/thumbnail-A-real-vs-sim.jpg', quality=92)
# B: 3-D view with the visual approaches
b = cover(Image.open('/tmp/th_3d.png').convert('RGB'), W, H, 0.55, 1.0, 1.22); b = ImageEnhance.Contrast(b).enhance(1.08)
b = band(b, 420, H, 210); d = ImageDraw.Draw(b)
tag(d, 24, 24, 'NEW: 3D + VISUAL APPROACHES', AMBER)
title(d, 478, "Mexico's Remote Airstrips", 'in ForeFlight and X-Plane')
b.convert('RGB').save('final/thumbnail-B-3d-view.jpg', quality=92)

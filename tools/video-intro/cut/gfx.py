"""Graphics for the Mexican Airstrips intro video: title card, text-overs, placeholders, end card (1920x1080 PNG)."""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import qrcode, pathlib
D = pathlib.Path('/home/claude/cut/gfx'); D.mkdir(exist_ok=True)
F = lambda w, s, mono=False: ImageFont.truetype(f"/home/claude/cut/fonts/ibm-plex-{'mono' if mono else 'sans'}-latin-{w}-normal.ttf", s)
W, H = 1920, 1080
AMBER, TEXT, MUTED, BG = (245, 166, 35), (231, 228, 220), (139, 147, 161), (16, 20, 26)

def textover(name, code, place):
    """small top-left label: amber code, white place name, on a soft dark pill"""
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    f1, f2 = F(600, 46, True), F(500, 40)
    w1 = d.textlength(code, font=f1); w2 = d.textlength(place, font=f2)
    x, y, ph, pw = 64, 56, 84, 64 + w1 + 26 + w2
    d.rounded_rectangle([x, y, x + pw, y + ph], radius=16, fill=(12, 15, 20, 200))
    d.text((x + 30, y + ph / 2), code, font=f1, fill=AMBER, anchor='lm')
    d.text((x + 30 + w1 + 26, y + ph / 2), place, font=f2, fill=TEXT, anchor='lm')
    im.save(D / f'to-{name}.png')

def caption(name, lines):
    """two-line credit at the lower left, same pill style"""
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    f = F(500, 38); lh = 54
    wmax = max(d.textlength(l, font=f) for l in lines)
    x, y = 64, H - 72 - lh * len(lines) - 36
    d.rounded_rectangle([x, y, x + wmax + 60, y + lh * len(lines) + 36], radius=16, fill=(12, 15, 20, 205))
    for i, l in enumerate(lines): d.text((x + 30, y + 18 + i * lh), l, font=f, fill=TEXT)
    im.save(D / f'cap-{name}.png')

def title():
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    g = Image.new('L', (W, H), 0); ImageDraw.Draw(g).rectangle([0, 600, W, H], fill=170); g = g.filter(ImageFilter.GaussianBlur(120))
    im.paste((8, 10, 14, 255), (0, 0), g)
    d.text((W / 2, 790), "Mexico's Remote Airstrips", font=F(600, 104), fill=TEXT, anchor='mm')
    d.text((W / 2, 900), "in ForeFlight and X-Plane", font=F(500, 58), fill=AMBER, anchor='mm')
    d.text((W / 2, 980), "GeezerGeek Pilot", font=F(500, 36, True), fill=MUTED, anchor='mm')
    im.save(D / 'title.png')

def placeholder(name, what, when):
    im = Image.new('RGB', (W, H), BG); d = ImageDraw.Draw(im)
    if name == 'xsqa-final': d.rounded_rectangle([W//4 + 40, 300, W*3//4 - 40, H - 300], radius=28, outline=(58, 68, 84), width=4, fill=(27, 34, 44))
    else: d.rounded_rectangle([260, 300, W - 260, H - 300], radius=28, outline=(58, 68, 84), width=4, fill=(27, 34, 44))
    d.text((W / 2, 440), 'PLACEHOLDER', font=F(600, 44, True), fill=AMBER, anchor='mm')
    d.text((W / 2, 530), what, font=F(500, 50), fill=TEXT, anchor='mm')
    d.text((W / 2, 610), when, font=F(400, 36), fill=MUTED, anchor='mm')
    im.save(D / f'ph-{name}.png')

def endcard(url):
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, W, H], radius=0, fill=(10, 13, 18, 200))
    q = qrcode.QRCode(border=2, box_size=12); q.add_data(url); q.make(fit=True)
    qi = q.make_image(fill_color='black', back_color='white').convert('RGB').resize((380, 380), Image.NEAREST)
    im.paste(qi, (W - 150 - 380, 300))
    d.text((W - 150 - 190, 720), 'GeezerGeek Pilot Apps (free)', font=F(600, 36), fill=AMBER, anchor='mm')
    for i, line in enumerate(('geezer-geek-pilot-control-panel', '.netlify.app')):   # the "link below" (Wayne)
        d.text((W - 150 - 190, 780 + i * 48), line, font=F(600, 40), fill=AMBER, anchor='mm')
    x = 160
    d.text((x, 260), "Mexican Airstrips", font=F(600, 72), fill=TEXT)
    d.text((x, 350), "for your EFB and Sim", font=F(500, 48), fill=AMBER)
    rows = [("Airfield data", "AFAC, Agencia Federal de Aviación Civil"),
            ("With thanks to", "airports.robrc.net · Roberto Carlos Arce Félix"),
            ("Maps", "OpenStreetMap contributors · Esri imagery"),
            ("X-Plane", "X-Plane Scenery Gateway"),
            ("Music", "Sascha Ende · Ambient Acoustic Guitars (CC BY 4.0)")]
    for i, (a, b) in enumerate(rows):
        d.text((x, 480 + i * 62), a, font=F(500, 30, True), fill=MUTED)
        d.text((x + 300, 480 + i * 62), b, font=F(400, 32), fill=TEXT)
    d.text((x, 820), "For planning and simulation only. Check an airstrip's status before you go.", font=F(400, 30), fill=MUTED)
    im.save(D / 'end.png')

def tag(name, a, b):
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    for x0, txt, col in ((40, a, MUTED), (W // 2 + 40, b, AMBER)):
        w = d.textlength(txt, font=F(600, 38, True))
        d.rounded_rectangle([x0, 40, x0 + w + 48, 104], radius=14, fill=(12, 15, 20, 215))
        d.text((x0 + 24, 72), txt, font=F(600, 38, True), fill=col, anchor='lm')
    im.save(D / f'tag-{name}.png')

def newlabel(name, rest, head='NEW'):
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    f1, f2 = F(600, 42, True), F(500, 40)
    w1 = d.textlength(head, font=f1); w2 = d.textlength(rest, font=f2)
    x, y, ph = 64, H - 64 - 84, 84
    d.rounded_rectangle([x, y, x + 64 + w1 + 26 + w2, y + ph], radius=16, fill=(12, 15, 20, 215))
    d.text((x + 30, y + ph / 2), head, font=f1, fill=AMBER, anchor='lm')
    d.text((x + 30 + w1 + 26, y + ph / 2), rest, font=f2, fill=TEXT, anchor='lm')
    im.save(D / f'new-{name}.png')

def spotring(name, box, pad=12):
    """amber spotlight like the app captures: ring with glow, everything else dimmed a little"""
    x0, y0, x1, y1 = box[0] - pad, box[1] - pad, box[2] + pad, box[3] + pad
    im = Image.new('RGBA', (W, H), (8, 10, 14, 82))
    hole = Image.new('L', (W, H), 255); ImageDraw.Draw(hole).rounded_rectangle([x0, y0, x1, y1], radius=17, fill=0)
    im.putalpha(Image.fromarray(__import__('numpy').minimum(__import__('numpy').array(im.getchannel('A')), __import__('numpy').array(hole))))
    glow = Image.new('RGBA', (W, H), (0, 0, 0, 0)); ImageDraw.Draw(glow).rounded_rectangle([x0, y0, x1, y1], radius=17, outline=(245, 166, 35, 150), width=14)
    glow = glow.filter(ImageFilter.GaussianBlur(10)); im = Image.alpha_composite(im, glow)
    ImageDraw.Draw(im).rounded_rectangle([x0, y0, x1, y1], radius=17, outline=AMBER + (255,), width=5)
    im.save(D / f'spot-{name}.png')

if __name__ == '__main__':
    # Open in ForeFlight in Wayne's iPad recording: rec px (475,1322)-(760,1400), scaled 1080/1488 and centered (x + 137.5)
    k, ox = 1080 / 1488, (1920 - 2266 * 1080 / 1488) / 2
    spotring('ff-open', (ox + 475 * k, 1322 * k, ox + 760 * k, 1400 * k))
    newlabel('3d', '3D map view and visual approaches', 'Teaser:')
    tag('beforenow', 'BEFORE · hand-typed waypoint', 'NOW · SQA_AFAC')
    textover('xsqa', 'XSQA', 'San Pedro de la Cueva, Sonora')
    textover('rcx', 'RCX', 'Laguna San Ignacio, Baja Sur')
    textover('xsby', 'XSBY', 'San Juanico (Scorpion Bay), Baja Sur')
    caption('robrc', ['Many thanks to Roberto Carlos for the user-friendly', 'airports.robrc.net to sort thru the AFAC spreadsheet.'])
    title()
    placeholder('xsqa-final', 'X-Plane: XSQA, final rwy 34', 'your recording')
    placeholder('ff-install', 'ForeFlight (iPad): Open in ForeFlight, install, layers on', 'your iPad screen recording')
    placeholder('ff-fpl', 'ForeFlight: tap the airstrip, add it to the flight plan', 'your iPad screen recording')
    placeholder('ff-split', "Split: today's ForeFlight vs the hand-typed waypoint", 'needs your ForeFlight recording')
    placeholder('xsby-land', 'X-Plane: XSBY final, landing, taxi to the tie-down', 'your recording, sim audio')
    endcard('https://geezer-geek-pilot-control-panel.netlify.app/')
    print(sorted(p.name for p in D.iterdir()))

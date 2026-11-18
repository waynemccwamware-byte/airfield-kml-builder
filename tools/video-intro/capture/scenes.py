"""App-capture scenes for the Mexican Airstrips intro video, each timed to Wayne's cleaned take (t = seconds into the take)."""
import sys, pathlib, subprocess
from playwright.sync_api import sync_playwright
import rig
from film import Film
OUT = pathlib.Path('/home/claude/cap/out'); OUT.mkdir(exist_ok=True)
VO = pathlib.Path('/home/claude/airfield-kml-builder/tools/video-intro/vo')
def dur(name): return float(subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',str(VO/f'{name}.m4a')],capture_output=True,text=True).stdout)

def pick(pg, q, name, wait=True):
    pg.click('#q'); pg.fill('#q', ''); pg.keyboard.type(q, delay=10); pg.wait_for_timeout(700)
    pg.locator('#results li', has_text=name).first.click()
    if wait: pg.wait_for_timeout(5000); rig.tiles_ready(pg, 15000)

def row(f, label):   # AFAC record row by its label
    return f.pg.evaluate("l=>{const th=[...document.querySelectorAll('#stepRec th')].find(x=>x.textContent.trim().startsWith(l));const r=th.parentElement.getBoundingClientRect();return [r.x,r.y,r.width,r.height]}", label)
def union(*bs):
    x0=min(b[0] for b in bs); y0=min(b[1] for b in bs); x1=max(b[0]+b[2] for b in bs); y1=max(b[1]+b[3] for b in bs)
    return [x0,y0,x1-x0,y1-y0]

def s2a(pg):
    pg.goto(rig.APP); pg.wait_for_timeout(2500)
    f = Film(pg, str(OUT/'s2-a.mp4')); D = dur('s2-a') + 0.3
    f.cx, f.cy = 820, 470
    f.wait(0.3); f.glide(*f.center('#q'), 0.6); f.click(0.1)
    f.spot('#q', 4)
    f.until(1.2); f.type('San Pedro de la', 9)                      # "by name or code"
    f.spot('#results', 4); f.wait(0.3)
    li = pg.locator('#results li', has_text='CUEVA').first
    f.until(3.6); f.glide(*f.center(f.lbox(li)), 0.6)
    f.click(4.5); f.spot_clear()                                     # "and you get AFAC's record"
    rig.tiles_ready(pg, 15000)
    pg.evaluate(f"window.scrollTo(0,{f.top_of('#stepRec') - 14})"); pg.wait_for_timeout(300)
    f.cx, f.cy = f.center('#stepRec .sec-head'); f.cx += 60; f.cy += 30; pg.mouse.move(f.cx, f.cy)
    f.wait(0.15); f.glide(*f.center('#stepRec .sec-head'), 0.45); f.click(0.5)
    f.until(7.2); f.spot(union(row(f,'Length'), row(f,'Surface')), 2)   # "4,265 feet of asphalt"
    b = row(f,'Length'); f.glide(b[0] + 0.62 * b[2], b[1] + b[3] + 4, 0.8)
    f.until(9.0); f.spot(row(f,'Runway'), 2)                          # "runway 16/34"
    f.until(10.7); f.spot(row(f,'Operation'), 2)                      # "day only"
    f.until(11.5); f.spot('#stepRec button[data-lang="en"]', 3)       # "English by default"
    f.glide(*f.center('#stepRec button[data-lang="es"]'), 1.0)
    f.until(14.1); f.click(0.4)                                       # "Spanish with a tap"
    f.spot('#stepRec table', 4)
    f.close(D)

def handles(pg):
    """screen positions of the two runway-end handles"""
    return pg.evaluate("""() => [...document.querySelectorAll('.leaflet-marker-icon.end-handle')].map(e => {const r=e.getBoundingClientRect(); return [r.x+r.width/2, r.y+r.height/2]})""")

def s2b(pg):
    pg.goto(rig.APP); pg.wait_for_timeout(2500)
    pick(pg, 'Laguna San Ignacio', 'LAGUNA')
    pg.click('#map a.big-btn'); pg.wait_for_timeout(800); rig.tiles_ready(pg, 15000)   # map fills the window
    h = sorted(handles(pg), key=lambda p: -p[1])[0]          # south end (lower on screen)
    ll = pg.evaluate("p => { const m = window.__map; const c = m.containerPointToLatLng(m.mouseEventToContainerPoint({clientX:p[0], clientY:p[1]})); return [c.lat, c.lng] }", h)
    z = pg.evaluate("window.__map.getZoom()")
    pg.evaluate("a => window.__map.setView([a[0] + 0.0010, a[1]], a[2], {animate:false})", [ll[0], ll[1], z + 0.6])
    rig.tiles_ready(pg, 15000)
    h = sorted(handles(pg), key=lambda p: -p[1])[0]
    # stand-in for a bad AFAC end: move it off the threshold before filming
    bad = (h[0] - 110, h[1] - 75)
    pg.mouse.move(*h); pg.mouse.down(); pg.mouse.move((h[0]+bad[0])/2, (h[1]+bad[1])/2, steps=5); pg.mouse.move(*bad, steps=5); pg.mouse.up()
    pg.wait_for_timeout(600); rig.tiles_ready(pg, 15000)
    f = Film(pg, str(OUT/'s2-b.mp4')); D = dur('s2-b') + 0.3
    f.cx, f.cy = bad[0] + 220, bad[1] - 160; pg.mouse.move(f.cx, f.cy)
    hb = sorted(handles(pg), key=lambda p: -p[1])[0]
    f.until(1.0); f.spot([hb[0]-30, hb[1]-30, 60, 60])                 # "coordinates are sometimes off"
    f.until(3.0); f.spot_off()
    f.until(6.2); f.glide(*hb, 0.7)                                   # "just drag the runway end"
    view = pg.evaluate("(() => { const m = window.__map, c = m.getCenter(); return [c.lat, c.lng, m.getZoom()] })()")
    f.until(7.0); f.drag(*h, 1.8)                                     # "...to where the runway surface starts"
    pg.mouse.move(h[0] + 110, h[1] + 80); pg.wait_for_timeout(2000)
    pg.evaluate("v => window.__map.setView([v[0], v[1]], v[2], {animate:false})", view)
    f.cx, f.cy = h[0] + 18, h[1] + 14; pg.wait_for_timeout(300); rig.tiles_ready(pg, 15000)
    f.glide(h[0] + 110, h[1] + 80, 0.6)
    hn = sorted(handles(pg), key=lambda p: -p[1])[0]
    f.until(9.3); f.spot([hn[0]-30, hn[1]-30, 60, 60])
    f.close(D)

def legend(f, label):
    return f.pg.evaluate("""l => { const e = [...document.querySelectorAll('#stepOut *')].find(x => x.children.length <= 2 && x.textContent.trim().startsWith(l) && x.getBoundingClientRect().height < 40);
      const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height] }""", label)
def path_center(pg, color_of_label):
    """center of the largest map shape filled with the legend chip's color"""
    return pg.evaluate("""l => {
      const lab = [...document.querySelectorAll('#stepOut *')].find(x => x.children.length <= 2 && x.textContent.trim().startsWith(l));
      const chip = lab.querySelector('i, span, b') || lab.previousElementSibling;
      const col = getComputedStyle(chip).backgroundColor;
      const ps = [...document.querySelectorAll('#map .leaflet-overlay-pane path')].filter(p => getComputedStyle(p).fill === col);
      const b = ps.map(p => p.getBoundingClientRect()).sort((a, c) => c.width * c.height - a.width * a.height)[0];
      return b ? [b.x + b.width / 2, b.y + b.height / 2, col] : [null, null, col] }""", color_of_label)

def s2c(pg):
    pg.goto(rig.APP); pg.wait_for_timeout(2500)
    pick(pg, 'San Pedro de la', 'CUEVA')
    mt = pg.evaluate("Math.round(document.getElementById('map').getBoundingClientRect().top+scrollY)")
    pt = pg.evaluate("Math.round(document.getElementById('patW').getBoundingClientRect().top+scrollY)")
    pg.evaluate(f"window.scrollTo(0,{pt + 36 - 612})"); pg.wait_for_timeout(400); rig.tiles_ready(pg)
    f = Film(pg, str(OUT/'s2-c.mp4')); D = dur('s2-c') + 0.3
    hs = handles(pg); rw = ((hs[0][0] + hs[1][0]) / 2, (hs[0][1] + hs[1][1]) / 2)
    rp = path_center(pg, 'Ramp')
    pat = pg.evaluate("""() => { const ps = [...document.querySelectorAll('#map .leaflet-overlay-pane path')].filter(p => (p.getAttribute('stroke-dasharray')||'').length);
       const b = ps.map(p => p.getBoundingClientRect()).sort((a,c) => a.x - c.x)[0]; return [b.x + b.width/2, b.y + b.height*0.45] }""")
    f.cx, f.cy = rw[0] + 160, rw[1] - 40; pg.mouse.move(f.cx, f.cy)
    f.until(1.3); f.spot(legend(f, 'Runway ('), 3); f.glide(rw[0] + 3, rw[1] - 30, 0.6)      # "runway by surface"
    f.until(2.5); f.spot(legend(f, 'Ramp'), 3)
    if rp[0]: f.glide(rp[0], rp[1], 0.6)                                                     # "the ramp"
    f.until(3.6); f.spot(legend(f, 'Traffic patterns'), 3); f.glide(pat[0] + 2, pat[1], 0.8)   # "a dashed traffic pattern"
    f.until(5.4); f.spot('#patW', 3); f.glide(*f.center('#patW'), 0.6); f.click(0.1)          # "whose width is adjustable"
    pg.keyboard.press('Control+A')
    f.until(6.3); f.type('0.3', 8); pg.evaluate("document.getElementById('patW').dispatchEvent(new Event('change', {bubbles:true}))")
    pg.wait_for_timeout(600); rig.tiles_ready(pg)
    f.glide(f.cx + 120, f.cy - 260, 0.7)
    f.close(D)

def xp(pg):
    return pg.evaluate("""() => { const o = {}; [...document.querySelectorAll('.leaflet-marker-icon')].filter(e => /xp-/.test(e.className)).forEach(e => {
        const k = e.className.split(' ')[1], r = e.getBoundingClientRect(); (o[k] = o[k] || []).push([r.x + r.width / 2, r.y + r.height / 2]) }); return o }""")
def setview(pg, x, y, dz):
    pg.evaluate("a => { const m = window.__map; m.setView(m.containerPointToLatLng([a[0], a[1]]), m.getZoom() + a[2], {animate:false}) }", [x, y, dz])
    rig.tiles_ready(pg, 15000)
def raw_drag(pg, a, b):
    pg.mouse.move(*a); pg.mouse.down(); pg.mouse.move(*b, steps=8); pg.mouse.up(); pg.wait_for_timeout(500)
def bbox(pts, pad=0):
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    return [min(xs) - pad, min(ys) - pad, max(xs) - min(xs) + 2 * pad, max(ys) - min(ys) + 2 * pad]

def xplane(pg):
    pg.goto(rig.APP); pg.wait_for_timeout(2500)
    pg.evaluate("localStorage.clear()")
    pg.goto(rig.APP); pg.wait_for_timeout(2500)
    pick(pg, 'Scorpion Bay', 'SCORPION')
    tabs = pg.locator('#stepOut button', has_text='X-Plane').first
    tt = pg.evaluate("Math.round(document.querySelector('#stepOut .tabs, #stepOut [role=tablist]') ? document.querySelector('#stepOut .tabs, #stepOut [role=tablist]').getBoundingClientRect().top + scrollY : 0)")
    tb = tabs.bounding_box(); y_tab = tb['y'] + pg.evaluate('scrollY')
    pg.evaluate(f"window.scrollTo(0,{y_tab - 470})"); pg.wait_for_timeout(400); rig.tiles_ready(pg)
    # ---- s3-a: "Now let's detail an airstrip for X-Plane. Here's Scorpion Bay, on Baja's Pacific side."
    f = Film(pg, str(OUT/'s3-a.mp4')); D = dur('s3-a') + 0.3
    f.cx, f.cy = 700, 360; pg.mouse.move(f.cx, f.cy)
    f.until(1.0); f.glide(*f.center(f.lbox(tabs)), 0.7); f.until(2.0); f.click(0.8)       # "for X-Plane"
    f.until(3.1); f.spot('#xpId', 4)                                                       # "Here's Scorpion Bay"
    f.until(4.6); f.spot_off(); f.glide(*f.center('#map a.big-btn'), 0.7); f.click(0.8)   # "on Baja's Pacific side"
    rig.tiles_ready(pg); f.glide(f.cx + 300, f.cy + 120, 0.6)
    f.close(D)
    # ---- set up the close view of the ramp area (cut)
    r0 = xp(pg)['xp-ramp'][0]
    setview(pg, r0[0] + 40, r0[1] + 12, 2.2)
    # windsock: bring it in from the far west end before filming (zoom out, drag, zoom back)
    v = pg.evaluate("(() => { const m = window.__map, c = m.getCenter(); return [c.lat, c.lng, m.getZoom()] })()")
    pg.evaluate("v => window.__map.setView([v[0], v[1]], v[2] - 2.6, {animate:false})", v); rig.tiles_ready(pg)
    k = xp(pg); sk = k['xp-sock'][0]; rp = k['xp-ramp'][0]
    raw_drag(pg, sk, (rp[0] - 40, rp[1] - 9))
    pg.evaluate("v => window.__map.setView([v[0], v[1]], v[2], {animate:false})", v); rig.tiles_ready(pg)
    # ---- s3-b: "No mapped ramp here, so the app adds one. Drag it and size it to the imagery."
    f = Film(pg, str(OUT/'s3-b.mp4')); D = dur('s3-b') + 0.3
    k = xp(pg); cs = k['xp-corner']; rc = k['xp-ramp'][0]
    f.cx, f.cy = rc[0] + 380, rc[1] + 150; pg.mouse.move(f.cx, f.cy)
    f.until(0.9); f.spot(bbox(cs, 10))                                                    # "the app adds one"
    f.until(2.7); f.glide(*rc, 0.7)
    f.until(3.4); f.spot_off(); f.drag(rc[0] + 165, rc[1] - 33, 1.0)                     # "Drag it"
    k = xp(pg); br = max(k['xp-corner'], key=lambda p: p[0] + p[1])
    f.glide(*br, 0.5)
    f.until(4.4); f.drag(br[0] + 4, br[1] + 42, 1.1)                                   # "and size it to the imagery"
    f.glide(f.cx + 90, f.cy + 90, 0.5)
    k = xp(pg); f.until(5.9); f.spot(bbox(k['xp-corner'], 10))
    f.close(D)
    # ---- s3-c: "Tie-downs are where you'll start, so put them on the ramp, not in the cactus. Then a windsock, a hangar, a fuel tank."
    f = Film(pg, str(OUT/'s3-c.mp4')); D = dur('s3-c') + 0.5
    k = xp(pg); ts = sorted(k['xp-tie'], key=lambda p: p[0]); cs = k['xp-corner']; rb = bbox(cs)
    f.cx, f.cy = rb[0] + rb[2] + 140, rb[1] + rb[3] + 120; pg.mouse.move(f.cx, f.cy)
    f.until(0.4); f.spot(bbox(ts, 22))                                                   # "Tie-downs"
    f.until(1.7); f.spot_off(); f.glide(*ts[0], 0.5)
    f.until(2.2); f.drag(rb[0] + rb[2] * 0.30, rb[1] + rb[3] * 0.62, 0.8)                 # "put them on the ramp"
    k = xp(pg); t2 = max(k['xp-tie'], key=lambda p: p[0])
    f.glide(*t2, 0.5); f.drag(rb[0] + rb[2] * 0.55, rb[1] + rb[3] * 0.62, 0.8)             # "not in the cactus"
    sk = xp(pg)['xp-sock'][0]
    f.until(5.4); f.spot([sk[0]-22, sk[1]-22, 44, 44]); f.glide(*sk, 0.5); f.drag(sk[0] + 30, sk[1] - 30, 0.6)   # "Then a windsock"
    f.spot_off()
    f.until(6.8); f.glide(*f.center('#xpAdd'), 0.5); f.click(0.6)                        # "a hangar"
    f.spot('#xpPick', 3); f.glide(*f.center('#xpPick'), 0.35)
    pg.select_option('#xpPick', 'fuel_avgas_tank'); f.click(0.2, real=False)             # "a fuel tank"
    f.glide(*f.center('#xpAdd'), 0.35); f.click(0.6); f.spot_off()
    f.close(D)
    # ---- tidy the objects, then reload: the layout comes back from the device (off camera)
    k = xp(pg); objs = sorted(k.get('xp-obj', []), key=lambda p: p[0]); cs = k['xp-corner']; rb = bbox(cs)
    if len(objs) >= 2:
        raw_drag(pg, objs[0], (rb[0] + rb[2] * 0.22, rb[1] + rb[3] * 0.78))
        k = xp(pg); objs = sorted(k['xp-obj'], key=lambda p: p[0])
        raw_drag(pg, objs[-1], (rb[0] + rb[2] * 0.08, rb[1] + rb[3] * 0.45))
    v = pg.evaluate("(() => { const m = window.__map, c = m.getCenter(); return [c.lat, c.lng, m.getZoom()] })()")
    pg.goto(rig.APP); pg.wait_for_timeout(2500)
    pick(pg, 'Scorpion Bay', 'SCORPION')
    pg.locator('#stepOut button', has_text='X-Plane').first.click(); pg.wait_for_timeout(1200)
    pg.click('#map a.big-btn'); pg.wait_for_timeout(800)
    pg.evaluate("v => window.__map.setView([v[0], v[1]], v[2], {animate:false})", v); rig.tiles_ready(pg)
    # ---- s3-d: "Your layout's saved, so you can come back and keep fiddling."
    f = Film(pg, str(OUT/'s3-d.mp4'), fade_in=0.5); D = dur('s3-d') + 0.3
    k = xp(pg); allp = k['xp-corner'] + k.get('xp-obj', []) + k['xp-tie']
    f.cx, f.cy = bbox(allp)[0] + bbox(allp)[2] + 160, bbox(allp)[1] + bbox(allp)[3] + 120; pg.mouse.move(f.cx, f.cy)
    f.until(0.5); f.spot(bbox(allp, 18))                                                   # "Your layout's saved"
    ob = sorted(k.get('xp-obj', [[f.cx, f.cy]]), key=lambda p: p[0])[-1]
    f.until(1.6); f.spot_off(); f.glide(*ob, 0.6)
    f.until(2.4); f.drag(ob[0] + 14, ob[1] + 10, 0.8)                                       # "keep fiddling"
    f.glide(f.cx + 120, f.cy + 80, 0.5)
    f.close(D)
    # ---- s3-e: "Download the zip, unzip it into Custom Scenery, done."
    pg.keyboard.press('Escape'); pg.wait_for_timeout(800)
    yb = pg.evaluate("Math.round(document.getElementById('xpDl').getBoundingClientRect().top + scrollY)")
    pg.evaluate(f"window.scrollTo(0,{yb - 300})"); pg.wait_for_timeout(400); rig.tiles_ready(pg)
    f = Film(pg, str(OUT/'s3-e.mp4')); D = dur('s3-e') + 0.3
    f.cx, f.cy = 860, 520; pg.mouse.move(f.cx, f.cy)
    f.wait(0.1); f.spot('#xpDl', 3); f.glide(*f.center('#xpDl'), 0.5)
    with pg.expect_download() as dl:
        f.click(1.2)                                                                       # "Download the zip"
    try: dl.value.save_as(str(OUT / 'XSBY-from-capture.zip'))
    except Exception as e: print('download', e)
    msg = pg.evaluate("""() => { const e = [...document.querySelectorAll('#stepOut p, #stepOut div, #stepOut span')].filter(x => /Custom Scenery/.test(x.textContent) && x.offsetParent && x.getBoundingClientRect().height < 120)
        .sort((a, b) => a.textContent.length - b.textContent.length)[0]; if (!e) return null; const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height] }""")
    print('s3-e message box', msg)
    f.until(2.1)
    if msg: f.spot(msg, 4); f.glide(msg[0] + msg[2] * 0.5, msg[1] + msg[3] + 12, 0.6)    # "unzip it into Custom Scenery"
    f.close(D)
    # ---- s3-f: "If X-Plane already has an airport there, Import from Gateway lets you build on it."
    f = Film(pg, str(OUT/'s3-f.mp4')); D = dur('s3-f') + 0.3
    f.cx, f.cy = 860, 520; pg.mouse.move(f.cx, f.cy)
    f.until(2.4); f.glide(*f.center('#xpGw'), 0.7)
    f.until(3.0); f.spot('#xpGw', 4)                                                       # "Import from Gateway"
    f.close(D)
    return f

def s4a(pg):
    pg.goto(rig.APP); pg.wait_for_timeout(2500)
    pick(pg, 'San Pedro de la', 'CUEVA')
    nb = pg.evaluate("""() => { const e = [...document.querySelectorAll('p, div')].filter(x => x.textContent.trim().startsWith('Not for navigation') && x.children.length < 3)
        .sort((a, b) => a.textContent.length - b.textContent.length)[0]; e.id = '__nfn'; return Math.round(e.getBoundingClientRect().top + scrollY) }""")
    pg.evaluate(f"window.scrollTo(0,{nb - 360})"); pg.wait_for_timeout(400); rig.tiles_ready(pg)
    f = Film(pg, str(OUT/'s4-a.mp4')); D = dur('s4-a') + 0.3
    f.cx, f.cy = 860, 250; pg.mouse.move(f.cx, f.cy)
    f.until(0.8); f.spot('#__nfn', 6)                       # "One caution: this app is for planning and preparation"
    b = f.box('#__nfn'); f.glide(b[0] + b[2] * 0.62, b[1] + b[3] + 18, 1.2)
    f.until(14.4); f.glide(b[0] + b[2] * 0.30, b[1] + b[3] + 18, 0.9)   # "Check before you go" (2nd sentence)
    f.close(D)

SCENES = {'s2-a': s2a, 's2-b': s2b, 's2-c': s2c, 'xplane': xplane, 's4-a': s4a}
if __name__ == '__main__':
    with sync_playwright() as p:
        b = p.chromium.launch()
        for n in sys.argv[1:]:
            pg = rig.new_page(b); SCENES[n](pg)
            if pg.errors: print('page errors', pg.errors)
            pg.context.close()

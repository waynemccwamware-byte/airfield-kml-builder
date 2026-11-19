"""3-D view teaser: SQA with visual approaches, filmed from the app's 3-D box, a slow eased turn around the runway midpoint."""
import subprocess, math, sys
from playwright.sync_api import sync_playwright
import rig, scenes
from film import ease
OUT = '/home/claude/cap/out/teaser-3d.mp4'
DUR, SWEEP, FPS = float(sys.argv[1]) if len(sys.argv) > 1 else 3.5, float(sys.argv[2]) if len(sys.argv) > 2 else 25.0, 30
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    pg = rig.new_page(b, 1120, 630, 1920 / 694)          # 3-D box is 694 CSS px wide -> 1920 px
    pg.goto(rig.APP); pg.wait_for_timeout(2500)
    scenes.pick(pg, 'San Pedro de la', 'CUEVA')
    pg.click('#optVis'); pg.wait_for_timeout(600); pg.locator('button', has_text='I understand').first.click(); pg.wait_for_timeout(4000)
    pg.click('#btn3d'); pg.wait_for_timeout(20000)
    pg.evaluate("document.getElementById('map3d').scrollIntoView({block:'center'})"); pg.wait_for_timeout(1500)
    r = pg.evaluate("document.getElementById('map3d').getBoundingClientRect().toJSON()")
    clip = {'x': r['x'], 'y': r['y'], 'width': r['width'], 'height': r['width'] * 9 / 16}
    pg.evaluate("window.__orbit.enableDamping = false")
    base = pg.evaluate("""() => { const c = window.__cam.position, t = window.__orbit.target, dx = c.x - t.x, dz = c.z - t.z;
        return {r: Math.hypot(dx, dz), a: Math.atan2(dx, dz), y: c.y} }""")
    ff = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', str(FPS), '-c:v', 'mjpeg', '-i', '-',
                           '-vf', 'scale=1920:1080', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '17', '-pix_fmt', 'yuv420p', OUT], stdin=subprocess.PIPE)
    n = int(DUR * FPS)
    for i in range(n):
        a = base['a'] + math.radians(SWEEP) * ease(i / (n - 1))
        pg.evaluate("""s => { const t = window.__orbit.target; window.__cam.position.set(t.x + Math.sin(s.a) * s.r, s.y, t.z + Math.cos(s.a) * s.r);
            window.__orbit.update(); return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))) }""", {'a': a, 'r': base['r'], 'y': base['y']})
        ff.stdin.write(pg.screenshot(type='jpeg', quality=93, clip=clip))
    ff.stdin.close(); ff.wait(); print('ok', n, 'frames', pg.errors)

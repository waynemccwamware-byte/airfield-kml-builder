"""airports.robrc.net shot for the thanks line (accepted the site's terms with Wayne's OK, 18-Nov-2026)."""
from playwright.sync_api import sync_playwright
import subprocess
from film import Film
OUT = '/home/claude/cap/out'
def open_site(b, dsf, w=1120, h=630):
    ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=dsf); pg = ctx.new_page()
    ctx.route('**/tile.openstreetmap.org/**', lambda r: r.abort())
    pg.goto('https://airports.robrc.net/', wait_until='domcontentloaded', timeout=60000); pg.wait_for_timeout(4000)
    pg.locator('text=English (US)').last.click(); pg.wait_for_timeout(500)
    pg.locator('text=/Accept and continue|Aceptar y continuar/').last.click(); pg.wait_for_timeout(1500)
    pg.errors = []; return pg
with sync_playwright() as p:
    b = p.chromium.launch()
    # A: the site's header and search (4.6 s)
    pg = open_site(b, 2, 960, 540)
    f = Film(pg, f'{OUT}/robrc-a.mp4'); f.cx, f.cy = 650, 360; pg.mouse.move(f.cx, f.cy)
    inp = pg.locator('input').first
    f.wait(0.3); f.glide(*f.center(f.lbox(inp)), 0.6); f.click(0.1); f.spot(f.lbox(inp), 4)
    f.until(1.2); f.type('San Pedro de la Cueva', 11)
    f.close(4.6)
    # B: close-up of the results table, filmed at 2x and cropped to its left half (4.8 s)
    pg = open_site(b, 2 * 1920 / 1120)
    inp = pg.locator('input').first; inp.click(); inp.type('San Pedro de la Cueva', delay=10); pg.wait_for_timeout(1500)
    pg.evaluate('window.scrollTo(0, 600)'); pg.wait_for_timeout(600)
    f = Film(pg, f'{OUT}/robrc-b-full.mp4'); f.cx, f.cy = 420, 420; pg.mouse.move(f.cx, f.cy)
    row = pg.locator('tr', has_text='CUEVA').first
    rb = f.lbox(row); rb[2] = 548 - rb[0]
    f.until(0.6); f.spot(rb, 2); f.glide(rb[0] + 420, rb[1] + rb[3] / 2 + 12, 0.8)
    f.close(4.8)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', f'{OUT}/robrc-b-full.mp4', '-vf', 'crop=1920:1080:0:0',
                    '-c:v', 'libx264', '-crf', '17', '-preset', 'veryfast', f'{OUT}/robrc-b.mp4'], check=True)
    print('ok')

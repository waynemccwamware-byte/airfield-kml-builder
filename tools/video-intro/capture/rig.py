"""Shared setup for filming the Mexican Airstrips app: live site, Leaflet and IBM Plex served from npm."""
import pathlib
NM = pathlib.Path('/home/claude/cap/node_modules')
APP = 'https://airfield-kml-builder.netlify.app/'
FONT_CSS = ''.join(
    f"@font-face{{font-family:'{fam}';font-weight:{w};font-style:normal;src:url(https://fonts.gstatic.com/__f/{pk}/{pk}-latin-{w}-normal.woff2) format('woff2')}}"
    for fam, pk in (('IBM Plex Sans', 'ibm-plex-sans'), ('IBM Plex Mono', 'ibm-plex-mono')) for w in (400, 500, 600))
PATCH = '''
;(function(){ L.Map.mergeOptions({zoomAnimation:false, fadeAnimation:false, markerZoomAnimation:false, zoomSnap:0}); L.TileLayer.mergeOptions({maxNativeZoom:18});
  const lm = L.map; L.map = function(){ const m = lm.apply(this, arguments); window.__map = m; return m; }; })();
'''
ALLOW = ('airfield-kml-builder.netlify.app', 'server.arcgisonline.com')

def route(r):
    u = r.request.url
    if 'fonts.googleapis.com' in u:
        return r.fulfill(status=200, content_type='text/css', body=FONT_CSS)
    if 'fonts.gstatic.com/__f/' in u:
        pk, name = u.split('/__f/')[1].split('/')
        return r.fulfill(path=str(NM / '@fontsource' / pk / 'files' / name), content_type='font/woff2')
    if 'cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/' in u:
        f = NM / 'leaflet/dist' / u.split('/dist/')[1].split('?')[0]
        if f.name == 'leaflet.js':   # expose the map; no CSS zoom/fade animations (filming sets the view frame by frame)
            body = f.read_text() + PATCH
            return r.fulfill(status=200, content_type='application/javascript', body=body)
        ct = 'text/css' if f.suffix == '.css' else 'application/javascript' if f.suffix == '.js' else 'image/png'
        return r.fulfill(path=str(f), content_type=ct)
    if 'cdn.jsdelivr.net/npm/three@0.128.0/' in u:   # three.js r128 from npm; OrbitControls exposes the camera for filming
        f = NM / 'three' / u.split('three@0.128.0/')[1].split('?')[0]
        body = f.read_text()
        if f.name == 'OrbitControls.js':
            body += ";(function(){const O=THREE.OrbitControls;THREE.OrbitControls=function(c,d){const o=new O(c,d);window.__orbit=o;window.__cam=c;return o};THREE.OrbitControls.prototype=O.prototype;})();"
        return r.fulfill(status=200, content_type='application/javascript', body=body)
    if any(h in u for h in ALLOW) or u.startswith('data:') or u.startswith('blob:'):
        return r.continue_()
    return r.abort()

def new_page(browser, w=1120, h=630, scale=1920/1120):
    ctx = browser.new_context(viewport={'width': w, 'height': h}, device_scale_factor=scale, accept_downloads=True)
    ctx.route('**/*', route)
    pg = ctx.new_page()
    pg.errors = []
    pg.on('pageerror', lambda e: pg.errors.append(str(e)))
    return pg

def tiles_ready(pg, timeout=8000):
    """wait (real time) until no map tile is still loading"""
    pg.wait_for_function("() => !document.querySelector('.leaflet-tile:not(.leaflet-tile-loaded)')", timeout=timeout)
    pg.wait_for_timeout(120)

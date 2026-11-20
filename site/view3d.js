/* Mexican Airstrips for your EFB and Sim — v0.72: 3-D view (v0.77: pattern drawn without AFAC elevation, TPA from the terrain model) (Wayne, 19-Nov-2026, from the approved SQA mockup).
   Loaded only when "3-D view" is tapped. Terrain ±20 NM around the runway midpoint from Terrain Tiles on AWS (z12,
   through netlify/functions/terrain.js, the same tiles the visual approaches' terrain check uses), Esri World Imagery
   draped on it, the runway, the traffic pattern at TPA and the visual approaches (3° paths in the air with a curtain
   to the ground, fixes labeled as on the 2-D map). three.js r128 + OrbitControls from jsDelivr (pinned).
   Every view turns around the runway midpoint (no panning). Advisory only: a picture, not for navigation.
   window.View3D.open(box, data) / close(). data = { a, b, labA, labB, pattern: { legs:[[p,q]...], tpaM } | null,
   visuals: [{ id, thr, crs, back, thrFt, len, marks:[{d, alt}], pen, state }] | null }  (points are [lat, lon]) */
(function(){
  const NM = 1852, FT = 3.28084, R = 6371008.8, HALF_NM = 20, Z = 12, N = 321;
  const rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI;
  const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js';
  const ORBIT_URL = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js';
  const fmt = n => Math.round(n).toLocaleString('en-US'), r10 = n => Math.round(n / 10) * 10;
  let S = null;   // the live scene

  const loadScript = src => new Promise((ok, bad) => { if ([...document.scripts].some(s => s.src === src)) return ok();
    const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => bad(new Error('could not load ' + src)); document.head.appendChild(s); });
  async function libs(){ if (!window.THREE) await loadScript(THREE_URL); if (!THREE.OrbitControls) await loadScript(ORBIT_URL); }

  const merc = (lat, lon, z) => { const n = 2 ** z, s = Math.log(Math.tan(rad(lat)) + 1 / Math.cos(rad(lat))); return [(lon + 180) / 360 * n, (1 - s / Math.PI) / 2 * n]; };

  async function terrainTile(x, y){
    const res = await fetch(`/.netlify/functions/terrain?z=${Z}&x=${x}&y=${y}`);
    if (!res.ok) throw new Error('terrain ' + res.status);
    const bmp = await createImageBitmap(await res.blob());
    const cv = document.createElement('canvas'); cv.width = bmp.width; cv.height = bmp.height;
    const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(bmp, 0, 0);
    const d = cx.getImageData(0, 0, bmp.width, bmp.height).data, a = new Float32Array(bmp.width * bmp.height);
    for (let i = 0; i < a.length; i++) a[i] = d[i*4] * 256 + d[i*4+1] + d[i*4+2] / 256 - 32768;
    return { w: bmp.width, h: bmp.height, a };
  }
  const imageTile = (x, y) => new Promise(ok => { const im = new Image(); im.crossOrigin = 'anonymous';
    im.onload = () => ok(im); im.onerror = () => ok(null);
    im.src = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${Z}/${y}/${x}`; });
  async function pool(items, n, fn, onEach){ const out = new Array(items.length); let i = 0, done = 0;
    await Promise.all(Array.from({ length: n }, async () => { while (i < items.length){ const k = i++; out[k] = await fn(items[k]); onEach && onEach(++done, items.length); } }));
    return out; }

  async function open(box, data){
    close();
    box.innerHTML = `<div class="v3-load">Loading 3-D…</div><div class="v3-cau" hidden><b>Advisory only</b> · for situational awareness · not for navigation</div>
      <div class="v3-ctl"><div class="v3-grp" role="group" aria-label="3-D view"></div><div class="v3-grp" role="group" aria-label="Relief"><button data-ex="1" aria-pressed="true">1×</button><button data-ex="1.5" aria-pressed="false">1.5×</button><button data-ex="2" aria-pressed="false">2×</button></div></div>
      <div class="v3-hud"></div>`;
    const status = t => { const el = box.querySelector('.v3-load'); if (el){ el.hidden = !t; el.textContent = t || ''; } };
    const my = S = { box, alive: true };
    try {
      status('Loading 3-D library…'); await libs();
      const C = [(data.a[0] + data.b[0]) / 2, (data.a[1] + data.b[1]) / 2], half = HALF_NM * NM;
      const dLat = deg(half / R), dLon = dLat / Math.cos(rad(C[0]));
      const lat0 = C[0] + dLat, lat1 = C[0] - dLat, lon0 = C[1] - dLon, lon1 = C[1] + dLon;
      const [x0, y0] = merc(lat0, lon0, Z), [x1, y1] = merc(lat1, lon1, Z);
      const tx0 = Math.floor(x0), tx1 = Math.floor(x1), ty0 = Math.floor(y0), ty1 = Math.floor(y1);
      const list = []; for (let y = ty0; y <= ty1; y++) for (let x = tx0; x <= tx1; x++) list.push([x, y]);
      status(`Loading terrain… 0 of ${list.length}`);
      const tt = await pool(list, 6, ([x, y]) => terrainTile(x, y), (d, n) => my.alive && status(`Loading terrain… ${d} of ${n}`));
      if (!my.alive) return;
      const T = {}; list.forEach(([x, y], i) => T[x + '/' + y] = tt[i]);
      const elevM = (lat, lon) => { const [fx, fy] = merc(lat, lon, Z), tx = Math.floor(fx), ty = Math.floor(fy), t = T[tx + '/' + ty]; if (!t) return 0;
        const px = (fx - tx) * t.w - .5, py = (fy - ty) * t.h - .5, i = Math.max(0, Math.min(t.w - 2, Math.floor(px))), j = Math.max(0, Math.min(t.h - 2, Math.floor(py)));
        const u = Math.max(0, Math.min(1, px - i)), v = Math.max(0, Math.min(1, py - j)), g = (a, b) => t.a[b * t.w + a];
        return g(i,j)*(1-u)*(1-v) + g(i+1,j)*u*(1-v) + g(i,j+1)*(1-u)*v + g(i+1,j+1)*u*v; };
      status(`Loading imagery… 0 of ${list.length}`);
      const ims = await pool(list, 8, ([x, y]) => imageTile(x, y), (d, n) => my.alive && status(`Loading imagery… ${d} of ${n}`));
      if (!my.alive) return;
      const W = (tx1 - tx0 + 1) * 256, H = (ty1 - ty0 + 1) * 256, cv = document.createElement('canvas');
      const K = Math.min(1, 4096 / Math.max(W, H)); cv.width = Math.round(W * K); cv.height = Math.round(H * K);
      const cx = cv.getContext('2d'); cx.fillStyle = '#6b6252'; cx.fillRect(0, 0, cv.width, cv.height);
      list.forEach(([x, y], i) => { if (ims[i]) cx.drawImage(ims[i], (x - tx0) * 256 * K, (y - ty0) * 256 * K, 256 * K + 1, 256 * K + 1); });
      status('Building the terrain…');
      build(my, data, { C, half, dLat, dLon, elevM, cv, tx0, ty0, tx1, ty1 });
      status('');
    } catch(err){
      if (my.alive) status('3-D view unavailable: ' + (err && err.message || err) + '. Back to 2-D and try again.');
    }
  }

  function build(my, data, G){
    const { box } = my, { C, half, elevM, cv, tx0, ty0, tx1, ty1 } = G;
    const toXZ = p => [rad(p[1] - C[1]) * R * Math.cos(rad(C[0])), -rad(p[0] - C[0]) * R];
    const toLL = (x, z) => [C[0] - deg(z / R), C[1] + deg(x / (R * Math.cos(rad(C[0]))))];
    // height grid
    const Hm = new Float32Array(N * N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++){ const x = -half + 2 * half * i / (N - 1), z = -half + 2 * half * j / (N - 1), ll = toLL(x, z); Hm[j * N + i] = elevM(ll[0], ll[1]); }
    const hAt = (x, z) => { const fi = (x + half) / (2 * half) * (N - 1), fj = (z + half) / (2 * half) * (N - 1);
      const i = Math.max(0, Math.min(N - 2, Math.floor(fi))), j = Math.max(0, Math.min(N - 2, Math.floor(fj))), u = fi - i, v = fj - j, g = (a, b) => Hm[b * N + a];
      return g(i,j)*(1-u)*(1-v) + g(i+1,j)*u*(1-v) + g(i,j+1)*(1-u)*v + g(i+1,j+1)*u*v; };

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    box.prepend(renderer.domElement);
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x7da3c9); scene.fog = new THREE.Fog(0x9db8d4, 45000, 110000);
    const camera = new THREE.PerspectiveCamera(50, 1, 30, 300000);
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.enablePan = false; controls.maxPolarAngle = Math.PI * 0.48; controls.minDistance = 500; controls.maxDistance = 70000;

    const geo = new THREE.PlaneGeometry(2 * half, 2 * half, N - 1, N - 1); geo.rotateX(-Math.PI / 2);
    // texture coordinates from each vertex's Web Mercator position in the imagery mosaic
    const uv = geo.attributes.uv, pos = geo.attributes.position, spanX = tx1 - tx0 + 1, spanY = ty1 - ty0 + 1;
    for (let k = 0; k < pos.count; k++){ const ll = toLL(pos.getX(k), pos.getZ(k)), [mx, my2] = merc(ll[0], ll[1], Z); uv.setXY(k, (mx - tx0) / spanX, 1 - (my2 - ty0) / spanY); }
    const tex = new THREE.CanvasTexture(cv); tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    scene.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex })));
    let EX = 1, over = null;
    const setRelief = () => { for (let k = 0; k < pos.count; k++) pos.setY(k, Hm[k] * EX); pos.needsUpdate = true; geo.computeBoundingSphere(); };
    const Y = h => h * EX;
    const tube = (pts, color, r, opacity = 1) => { const c = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], p[1], p[2])), false, 'catmullrom', 0);
      return new THREE.Mesh(new THREE.TubeGeometry(c, Math.max(2, pts.length * 2), r, 6, false), new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity })); };
    const dashed = (p0, p1, on, off, color, r) => { const g = new THREE.Group(), L = Math.hypot(p1[0] - p0[0], p1[2] - p0[2]);
      for (let s = 0; s < L; s += on + off){ const f0 = s / L, f1 = Math.min(1, (s + on) / L), lp = f => [p0[0] + (p1[0] - p0[0]) * f, p0[1] + (p1[1] - p0[1]) * f, p0[2] + (p1[2] - p0[2]) * f]; g.add(tube([lp(f0), lp(f1)], color, r)); }
      return g; };
    const label = (text, color, x, y, z) => { const c = document.createElement('canvas'), ctx = c.getContext('2d'), f = 44;
      ctx.font = `600 ${f}px "IBM Plex Mono", monospace`; const w = Math.ceil(ctx.measureText(text).width) + 28; c.width = w; c.height = f + 24;
      ctx.font = `600 ${f}px "IBM Plex Mono", monospace`; ctx.fillStyle = 'rgba(10,12,16,.82)'; ctx.fillRect(0, 0, w, c.height);
      ctx.fillStyle = color; ctx.textBaseline = 'middle'; ctx.fillText(text, 14, c.height / 2 + 2);
      const t = new THREE.CanvasTexture(c); t.minFilter = THREE.LinearFilter;
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, sizeAttenuation: false, depthTest: false, transparent: true }));
      const k = 0.034; s.scale.set(k * w / c.height, k, 1); s.center.set(-0.08, 0.5); s.position.set(x, y, z); s.renderOrder = 10; return s; };

    const A = toXZ(data.a), B = toXZ(data.b), len = Math.hypot(B[0] - A[0], B[1] - A[1]), ux = (B[0] - A[0]) / len, uz = (B[1] - A[1]) / len;
    const mid = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
    const V = (data.visuals || []).map(v => ({ ...v, p: toXZ(v.thr), dir: [Math.sin(rad(v.crs)), -Math.cos(rad(v.crs))] }));
    const altM = (v, d) => (v.thrFt + 50 + d * NM * Math.tan(rad(3)) * FT) / FT;
    const ptAt = (v, d) => [v.p[0] - v.dir[0] * d * NM, v.p[1] - v.dir[1] * d * NM];

    function overlays(){
      if (over) scene.remove(over); over = new THREE.Group(); scene.add(over);
      const w = (data.widthM || 15) / 2, nx = -uz * w, nz = ux * w, lift = 3;
      const rp = [[A[0]+nx, A[1]+nz], [B[0]+nx, B[1]+nz], [B[0]-nx, B[1]-nz], [A[0]-nx, A[1]-nz]].map(p => new THREE.Vector3(p[0], Y(hAt(p[0], p[1])) + lift, p[1]));
      over.add(new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([rp[0], rp[1], rp[2], rp[0], rp[2], rp[3]]), new THREE.MeshBasicMaterial({ color: 0x111111, side: THREE.DoubleSide })));
      over.add(tube([A, B].map(p => [p[0], Y(hAt(p[0], p[1])) + lift + 2, p[1]]), 0xffffff, 6));
      if (data.labA) over.add(label(data.labA, '#ffffff', A[0] - ux * 80, Y(hAt(A[0], A[1])) + 60, A[1] - uz * 80));
      if (data.labB) over.add(label(data.labB, '#ffffff', B[0] + ux * 80, Y(hAt(B[0], B[1])) + 60, B[1] + uz * 80));
      if (data.pattern){
        // v0.77: no AFAC elevation: 1,000 ft above the terrain model's runway elevation (mean of the two ends)
        const tpaM = data.pattern.tpaM != null ? data.pattern.tpaM : (hAt(A[0], A[1]) + hAt(B[0], B[1])) / 2 + 1000 / FT;
        const lbl = data.pattern.tpaM != null ? data.pattern.label : `TPA ≈ ${fmt(r10(tpaM * FT))}' (terrain)`;
        const y = Y(tpaM);
        data.pattern.legs.forEach(([p, q]) => { const P = toXZ(p), Q = toXZ(q); over.add(dashed([P[0], y, P[1]], [Q[0], y, Q[1]], 150, 100, 0x33d1ff, 9)); });
        if (lbl && data.pattern.dot){ const D = toXZ(data.pattern.dot); over.add(label(lbl, '#ffffff', D[0], y + 40, D[1])); }
      }
      V.forEach(v => {
        if (v.len){
          const steps = Math.ceil(v.len * 20), path = [], cur = [];
          for (let k = 0; k <= steps; k++){ const d = v.len * k / steps, c = ptAt(v, d); path.push([c[0], Y(altM(v, d)), c[1]]); cur.push([c[0], Y(hAt(c[0], c[1])), c[1]]); }
          over.add(dashed(path[0], path[path.length - 1], 400, 220, 0xffb000, 14));
          const pts = []; for (let k = 0; k < steps; k++){ const a = path[k], b = path[k + 1], c = cur[k + 1], d = cur[k]; pts.push(...a, ...b, ...c, ...a, ...c, ...d); }
          const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
          over.add(new THREE.Mesh(cg, new THREE.MeshBasicMaterial({ color: 0xffb000, transparent: true, opacity: .22, side: THREE.DoubleSide, depthWrite: false })));
          v.marks.forEach(m => { const c = ptAt(v, m.d), y = Y(altM(v, m.d));
            const o = new THREE.Mesh(new THREE.OctahedronGeometry(40), new THREE.MeshBasicMaterial({ color: 0xffb000 })); o.position.set(c[0], y, c[1]); over.add(o);
            over.add(label(`${v.id} ${Number.isInteger(m.d) ? m.d : m.d.toFixed(1)}NM ${fmt(m.alt)}'`, '#ffb000', c[0], y, c[1])); });
        }
        // v0.78: a red post on the actual high point, from the ground (mesh) up to that terrain's height, labeled with the
        // clearance; a thin red line from its top to the path shows the gap
        if (v.warn){ const H = toXZ(v.warn.p), top = v.warn.terrFt / FT, g = hAt(H[0], H[1]), c = ptAt(v, v.warn.d), pathY = Y(altM(v, v.warn.d));
          over.add(tube([[H[0], Y(Math.min(g, top)) - 5, H[1]], [H[0], Y(Math.max(g, top)) + 40, H[1]]], 0xe0705f, 18));
          over.add(tube([[H[0], Y(top), H[1]], [c[0], pathY, c[1]]], 0xe0705f, 4));
          over.add(label(v.warn.c >= 0 ? `terrain ${v.warn.d} NM · ${fmt(r10(v.warn.c))}' below path` : `terrain ${v.warn.d} NM · ${fmt(r10(-v.warn.c))}' above path`, '#ff8a75', H[0], Y(Math.max(g, top)) + 60, H[1])); }
        if (v.pen != null){ const c = ptAt(v, v.pen), g = hAt(c[0], c[1]); over.add(tube([[c[0], Y(g) - 5, c[1]], [c[0], Y(g) + 150, c[1]]], 0xe0705f, 18));
          over.add(label(`terrain ${v.pen} NM: line ends`, '#ff8a75', c[0], Y(g) + 170, c[1])); }
      });
    }

    // views: every one turns around the runway midpoint (Wayne)
    const grp = box.querySelector('.v3-grp');
    const views = [['ov', 'Airstrip'], ...V.map((v, i) => ['v' + i, `RWY ${v.id} final`])];
    if (!V.length) [[data.labA, A, [ux, uz]], [data.labB, B, [-ux, -uz]]].forEach(([id, p, dir], i) => views.push(['r' + i, `RWY ${id || (i ? 'end B' : 'end A')} final`]));
    grp.innerHTML = views.map(([k, t], i) => `<button data-v="${k}" aria-pressed="${i === 0}">${t}</button>`).join('');
    let current = 'ov';
    function fly(k){
      current = k; grp.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === k)));
      const midH = Y((hAt(A[0], A[1]) + hAt(B[0], B[1])) / 2);
      controls.target.set(mid[0], midH, mid[1]);
      if (k === 'ov'){
        const az = rad(340), hd = 4200;   // low oblique from the north-northwest (Wayne's pick on the mockup)
        camera.position.set(mid[0] + Math.sin(az) * hd, midH + 1120 * EX, mid[1] - Math.cos(az) * hd);
      } else if (k[0] === 'v'){
        const v = V[+k.slice(1)], c = ptAt(v, 3);
        camera.position.set(c[0] + v.dir[1] * 250, Y(altM(v, 3)) + 120, c[1] - v.dir[0] * 250);
      } else {   // no visual approaches on: same spot on a plain 3° from the threshold
        const i = +k.slice(1), p = i ? B : A, dir = i ? [-ux, -uz] : [ux, uz], c = [p[0] - dir[0] * 3 * NM, p[1] - dir[1] * 3 * NM];
        camera.position.set(c[0] + dir[1] * 250, Y(hAt(p[0], p[1]) + 15 + 3 * NM * Math.tan(rad(3))) + 120, c[1] - dir[0] * 250);
      }
      controls.update();
    }
    grp.addEventListener('click', e => { const b = e.target.closest('button'); if (b) fly(b.dataset.v); });
    box.querySelectorAll('[data-ex]').forEach(b => b.addEventListener('click', () => {
      box.querySelectorAll('[data-ex]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      EX = +b.dataset.ex; setRelief(); overlays(); fly(current); }));
    box.querySelector('.v3-cau').hidden = !V.length;
    const hud = box.querySelector('.v3-hud');
    const size = () => { const w = box.clientWidth, h = box.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
    const ro = new ResizeObserver(size); ro.observe(box);
    setRelief(); overlays(); size(); fly('ov');
    let raf = 0;
    const loop = () => { if (!my.alive) return; controls.update(); hud.textContent = `eye ${fmt(camera.position.y / EX * FT)}' MSL`; renderer.render(scene, camera); raf = requestAnimationFrame(loop); };
    loop();
    my.dispose = () => { cancelAnimationFrame(raf); ro.disconnect(); controls.dispose(); scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material){ if (o.material.map) o.material.map.dispose(); o.material.dispose(); } }); renderer.dispose(); };
  }

  function close(){ if (!S) return; S.alive = false; try { S.dispose && S.dispose(); } catch(e){} S.box.innerHTML = ''; S = null; }
  window.View3D = { open, close };
})();

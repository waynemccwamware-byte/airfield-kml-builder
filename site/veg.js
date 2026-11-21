// Mexican Airstrips for your EFB and Sim — X-Plane vegetation around an airstrip (v0.81, 21-Nov-2026).
//
// Gateway-safe: only X-Plane's own public forests (Resources/default scenery/1200 forests/library.txt, PUBLIC section,
// checked on Wayne's X-Plane 12 on 21-Nov-2026). Third-party libraries (OpenSceneryX etc.) are not used, because the
// Scenery Gateway accepts only Laminar Research assets. X-Plane's cactus mix is only used by X-Plane inside its own
// cactus region (maps/region_cacti.png), so these presets have agave, yucca and scrub but no cactus.
//
// The planting area: a ring of radius km around the runway, minus what must stay clear (runway, ramp, taxiways,
// exclusion zones, objects, roads, buildings, towns, sea). Shapes are cut with polygon-clipping (MIT, vendored in
// site/vendor) in local metres, then split on a 500 m grid so no ring passes the DSF's 255 points per winding.
// No DOM use here, so it also runs under Node for testing.
(function(){
  const PC = typeof polygonClipping !== 'undefined' ? polygonClipping : (typeof require !== 'undefined' ? require('./vendor/polygon-clipping.umd.min.js') : null);

  // presets: X-Plane forest + density (0–255) per layer; contents read from X-Plane 12's .for files
  const PRESETS = {
    baja:    { label: 'Baja desert', note: 'sparse agave, yucca, low bushes and dead brush',
               layers: [['lib/g8/sparse_hot_dry.for', 235], ['lib/g8/shrb_hot_dry.for', 70]] },
    north:   { label: 'Northern desert foothills', note: 'denser desert scrub with scattered dry-country trees',
               layers: [['lib/g8/shrb_hot_dry.for', 190], ['lib/g8/sparse_tr_hot_dry.for', 210]] },
    tropdry: { label: 'Tropical dry scrub', note: 'scrub with palms and broadleaf trees',
               layers: [['lib/g8/shrb_vhot_dry.for', 170], ['lib/g8/broad_sp_hot_dry.for', 150]] },
    humid:   { label: 'Humid tropics', note: 'green broadleaf forest and shrubs',
               layers: [['lib/vegetation/forests/broadleaves/very_hot.for', 190], ['lib/g8/shrb_vhot_rain.for', 140]] },
    high:    { label: 'Highlands', note: 'pines with scattered broadleaf trees',
               layers: [['lib/g8/coni_sp_hot_dry.for', 180], ['lib/g8/sparse_tr_hot_dry.for', 140]] },
  };
  const DENS = { sparse: 0.55, med: 0.8, dense: 1.0 };
  const STATES = {
    baja: ['BAJA CALIFORNIA', 'BAJA CALIFORNIA SUR'],
    north: ['SONORA', 'CHIHUAHUA', 'COAHUILA', 'NUEVO LEON', 'DURANGO', 'ZACATECAS', 'SAN LUIS POTOSI', 'TAMAULIPAS'],
    tropdry: ['SINALOA', 'NAYARIT', 'JALISCO', 'COLIMA', 'MICHOACAN', 'GUERRERO', 'OAXACA', 'MORELOS'],
    humid: ['VERACRUZ', 'TABASCO', 'CAMPECHE', 'YUCATAN', 'QUINTANA ROO', 'CHIAPAS'],
    high: ['AGUASCALIENTES', 'GUANAJUATO', 'QUERETARO', 'HIDALGO', 'ESTADO DE MEXICO', 'MEXICO', 'CIUDAD DE MEXICO', 'TLAXCALA', 'PUEBLA'],
  };
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
  // 1,400 m and up = highlands whatever the state; otherwise by AFAC's state; default northern desert
  function autoPreset(state, elevM){
    if (elevM != null && elevM >= 1400) return 'high';
    const s = norm(state);
    for (const k in STATES) if (STATES[k].includes(s)) return k;
    return 'north';
  }

  // ---------- local metres around a reference point ----------
  function frame(ref){
    const kx = 111320 * Math.cos(ref[0] * Math.PI / 180), ky = 110574;
    return { xy: p => [(p[1] - ref[1]) * kx, (p[0] - ref[0]) * ky], ll: q => [q[1] / ky + ref[0], q[0] / kx + ref[1]] };
  }
  const close = r => (r.length && (r[0][0] !== r[r.length - 1][0] || r[0][1] !== r[r.length - 1][1])) ? [...r, r[0]] : r;
  const rect = (x0, y0, x1, y1) => [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]];
  // rectangle along a segment a→b, half-width hw, extended ext past each end
  function band(a, b, hw, ext){
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
    const A = [a[0] - ux * ext, a[1] - uy * ext], B = [b[0] + ux * ext, b[1] + uy * ext];
    return [[[A[0] + nx * hw, A[1] + ny * hw], [B[0] + nx * hw, B[1] + ny * hw], [B[0] - nx * hw, B[1] - ny * hw], [A[0] - nx * hw, A[1] - ny * hw], [A[0] + nx * hw, A[1] + ny * hw]]];
  }
  // stadium: every point within R of segment a→b
  function stadium(a, b, R, n = 24){
    const h = Math.atan2(b[1] - a[1], b[0] - a[0]), pts = [];
    for (let i = 0; i <= n; i++){ const t = h - Math.PI / 2 + Math.PI * i / n; pts.push([b[0] + R * Math.cos(t), b[1] + R * Math.sin(t)]); }
    for (let i = 0; i <= n; i++){ const t = h + Math.PI / 2 + Math.PI * i / n; pts.push([a[0] + R * Math.cos(t), a[1] + R * Math.sin(t)]); }
    return [close(pts)];
  }
  const bboxGrow = (pts, g) => { const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]); return rect(Math.min(...xs) - g, Math.min(...ys) - g, Math.max(...xs) + g, Math.max(...ys) + g); };
  function unionAll(list){
    let parts = list.filter(g => g && g.length);
    if (!parts.length) return [];
    while (parts.length > 1){
      const next = [];
      for (let i = 0; i < parts.length; i += 64) next.push(PC.union(...parts.slice(i, i + 64)));
      parts = next;
    }
    return parts[0];
  }
  const ringArea = r => { let s = 0; for (let i = 0; i + 1 < r.length; i++) s += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]; return Math.abs(s) / 2; };
  const mpArea = mp => mp.reduce((s, poly) => s + ringArea(poly[0]) - poly.slice(1).reduce((t, h) => t + ringArea(h), 0), 0);

  // o: { ends: [[lat,lon],[lat,lon]], widthM, km,
  //      keep: { polys: [[[lat,lon]…]] (kept clear as drawn, grown by grow m), boxes: [[[lat,lon]…]] (bounding box, grown),
  //              rects: [[s,w,n,e]] (exclusion zones), roads: [[[lat,lon]…]], buildings: [...], towns: [...] },
  //      water: (lat, lon) => true for water | null }
  // → { pieces: [[ring, hole…] in lat/lon], areaKm2, counts }
  function compute(o){
    if (!PC) throw new Error('polygon-clipping not loaded');
    const ref = [(o.ends[0][0] + o.ends[1][0]) / 2, (o.ends[0][1] + o.ends[1][1]) / 2], F = frame(ref);
    const a = F.xy(o.ends[0]), b = F.xy(o.ends[1]), R = Math.max(300, o.km * 1000), k = o.keep || {};
    const outer = stadium(a, b, R);
    const keep = [band(a, b, (o.widthM || 15) / 2 + 35, 60)];                 // runway + 35 m each side, 60 m past the ends
    (k.polys || []).forEach(p => { if (p.length >= 3){ const q = p.map(F.xy); keep.push(bboxGrow(q, 25)); } });
    (k.boxes || []).forEach(p => { if (p.length){ keep.push(bboxGrow(p.map(F.xy), 12)); } });
    (k.rects || []).forEach(z => { const p = F.xy([z[0], z[1]]), q = F.xy([z[2], z[3]]); keep.push(rect(p[0], p[1], q[0], q[1])); });
    const inR = q => Math.hypot(q[0] - (a[0] + b[0]) / 2, q[1] - (a[1] + b[1]) / 2) < R + Math.hypot(b[0] - a[0], b[1] - a[1]) / 2 + 200;
    let nRoads = 0, nB = 0, nT = 0;
    (k.roads || []).forEach(line => { const q = line.map(F.xy); for (let i = 0; i + 1 < q.length; i++) if (inR(q[i]) || inR(q[i + 1])){ keep.push(band(q[i], q[i + 1], 10, 4)); nRoads++; } });
    (k.buildings || []).forEach(p => { const q = p.map(F.xy); if (q.length >= 3 && inR(q[0])){ keep.push(bboxGrow(q, 12)); nB++; } });
    (k.towns || []).forEach(p => { const q = p.map(F.xy); if (q.length >= 3 && inR(q[0])){ keep.push([close(q)]); nT++; } });
    let waterKm2 = 0;
    if (o.water){                                                              // 40 m cells, merged into runs per row
      const st = 40, xs = outer[0].map(p => p[0]), ys = outer[0].map(p => p[1]);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      for (let y = y0; y < y1; y += st){
        let run = null;
        for (let x = x0; x <= x1 + st; x += st){
          const ll = F.ll([x + st / 2, y + st / 2]), w = x <= x1 && o.water(ll[0], ll[1]);
          if (w && run === null) run = x;
          if (!w && run !== null){ keep.push(rect(run - 15, y - 15, x + 15, y + st + 15)); waterKm2 += (x - run) * st / 1e6; run = null; }
        }
      }
    }
    let plant = PC.difference(outer, unionAll(keep));
    // split on a 500 m grid (finer where a ring still has too many points)
    const pieces = [];
    const cut = (mp, x0, y0, s, depth) => {
      const part = PC.intersection(mp, rect(x0, y0, x0 + s, y0 + s));
      for (const poly of part){
        if (ringArea(poly[0]) < 150) continue;
        if (poly.some(r => r.length > 250)){
          if (depth < 4){ const h = s / 2; [[0, 0], [h, 0], [0, h], [h, h]].forEach(([dx, dy]) => cut([poly], x0 + dx, y0 + dy, h, depth + 1)); continue; }
          poly.forEach((r, i) => { while (r.length > 250) poly[i] = r = r.filter((_, j) => j % 2 === 0 || j === r.length - 1); });
        }
        pieces.push(poly);
      }
    };
    const xs = outer[0].map(p => p[0]), ys = outer[0].map(p => p[1]), S = 500;
    for (let x = Math.floor(Math.min(...xs) / S) * S; x < Math.max(...xs); x += S)
      for (let y = Math.floor(Math.min(...ys) / S) * S; y < Math.max(...ys); y += S) cut(plant, x, y, S, 0);
    return { pieces: pieces.map(poly => poly.map(r => r.map(F.ll))), areaKm2: mpArea(pieces) / 1e6, counts: { roads: nRoads, buildings: nB, towns: nT, waterKm2 } };
  }

  // pieces → DSF polygons for one preset and density, each clipped to its 1°×1° tile
  function polys(pieces, presetKey, dens){
    const P = PRESETS[presetKey] || PRESETS.north, f = DENS[dens] || DENS.med, out = [];
    for (const poly of pieces){
      const lats = poly[0].map(p => p[0]), lons = poly[0].map(p => p[1]);
      const s0 = Math.floor(Math.min(...lats)), s1 = Math.floor(Math.max(...lats)), w0 = Math.floor(Math.min(...lons)), w1 = Math.floor(Math.max(...lons));
      let parts = [poly];
      if (s0 !== s1 || w0 !== w1){                 // crosses a tile edge: clip per tile (in [lon, lat] for the library)
        parts = [];
        const g = poly.map(r => r.map(p => [p[1], p[0]]));
        for (let s = s0; s <= s1; s++) for (let w = w0; w <= w1; w++)
          PC.intersection([g], rect(w, s, w + 1, s + 1)).forEach(q => parts.push(q.map(r => r.map(p => [p[1], p[0]]))));
      }
      for (const rings of parts) for (const [path, d] of P.layers) out.push({ path, param: Math.max(1, Math.min(255, Math.round(d * f))), rings });
    }
    return out;
  }

  const api = { PRESETS, DENS, autoPreset, compute, polys };
  if (typeof window !== 'undefined') window.XPVEG = api;
  if (typeof module !== 'undefined') module.exports = api;
})();

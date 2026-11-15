// Mexican Airstrips for your EFB and Sim — X-Plane scenery export (step 6; from v0.35, 15-Nov-2026), and since v0.51
// reading packs back in (zip / apt.dat / DSF / layout file) so a layout can be edited again on another device.
//
// Builds a custom-scenery pack in the browser:
//   <ID> <Name>/Earth nav data/apt.dat          — APT.DAT 1200 (X-Plane 12 / WED 2.5+), modeled on Wayne's
//                                                  Gateway airport XMM000J (San Pedro de la Cueva, WED 2.5.2r1)
//   <ID> <Name>/Earth nav data/+20-110/+29-110.dsf — overlay DSF with library objects the user placed (hangar…),
//                                                  written byte-for-byte the way WED 2.5.2r1 writes one object
//   <ID> <Name>/README.txt
// Works dropped into Custom Scenery as-is, and imports into WED (File → Import apt.dat, File → Import DSF).
// Wayne loaded the SQA sample in X-Plane 12 on 15-Nov-2026: "all looks good".
// Specs: developer.x-plane.com — "Airport Data (apt.dat) 12.00 File Format Specification",
// "DSF File Format Specification", "DSF Usage in X-Plane", "RFC: Airport-ID Based Exclusion".
// No libraries: MD5 (DSF footer), CRC-32 and ZIP (stored) are below.

(function(){
  'use strict';

  // ---------- library objects offered (every path seen in Gateway airports' DSFs) ----------
  // fp = rough footprint in meters [width, depth] for the preview only (X-Plane uses the model's own size)
  // front = where the object's door/nose points, in degrees from its X-Plane heading (v0.49). Estimated from Wayne's XASN
  // screenshot (15-Nov-2026: small blue hangar, Cessna 172 and car all at heading 100): aircraft and car noses point along the
  // heading; the small hangars' door is 90° left of it. Objects without front: not checked yet, so the app shows plain Hdg.
  const CATALOG = [
    { group: 'Hangars', items: [
      { id: 'hgr_sm_gray',  label: 'Small hangar, gray',  path: 'lib/airport/Common_Elements/Hangars/Sm_Gray_Hangar.agp',  fp: [16, 14], front: -90, frontName: 'Door' },
      { id: 'hgr_sm_blue',  label: 'Small hangar, blue',  path: 'lib/airport/Common_Elements/Hangars/Sm_Blue_Hangar.agp',  fp: [16, 14], front: -90, frontName: 'Door' },
      { id: 'hgr_sm_brown', label: 'Small hangar, brown', path: 'lib/airport/Common_Elements/Hangars/Sm_Brown_Hangar.agp', fp: [16, 14], front: -90, frontName: 'Door' },
      { id: 'hgr_med_gray', label: 'Medium hangar, gray', path: 'lib/airport/Common_Elements/Hangars/Med_Gray_Hangar.agp', fp: [24, 20] },
      { id: 'hgr_eu_25',    label: 'Hangar 25 × 20 m',    path: 'lib/airport/European_Airports/hangars/25x20x5.obj',      fp: [25, 20] },
      { id: 'hgr_arch_30',  label: 'Arched hangar 30 × 30 m (X-Plane 12.2+)', path: 'lib/airport/hangars/arched/30x30/gray_1.obj', fp: [30, 30] },
      { id: 'shed_tin',     label: 'Tin shed 10 × 30 m',  path: 'lib/g10/US/industrial/light/TinShed10x30Lt.obj',         fp: [10, 30] },
      { id: 'shed_wood',    label: 'Wood shed 8 × 10 m',  path: 'lib/g10/US/industrial/light/WoodShed8x10.obj',           fp: [8, 10] },
    ]},
    { group: 'Fuel', items: [
      { id: 'fuel_drums',   label: 'Fuel drums',          path: 'lib/g10/US/industrial/light/OilDrums.obj',               fp: [3, 3] },
      { id: 'fuel_station', label: 'Small fuel station',  path: 'lib/airport/Common_Elements/Fueling_Stations/Small_Fuel_Station.obj', fp: [6, 4] },
      { id: 'fuel_tank',    label: 'Small fuel tank',     path: 'lib/airport/Common_Elements/Fuel_Storage/Sing_Tank_Small.obj', fp: [4, 4] },
      { id: 'fuel_truck',   label: 'Small fuel truck',    path: 'lib/airport/Common_Elements/vehicles/Small_Fuel_Truck.obj', fp: [3, 8] },
    ]},
    { group: 'Aircraft and vehicles', items: [
      { id: 'ac_prop',      label: 'Parked single (generic)', path: 'lib/airport/aircraft/general_aviation/prop_a.obj',     fp: [11, 8] },
      { id: 'ac_c172',      label: 'Parked Cessna 172',   path: 'lib/airport/aircraft/GA/Cessna_172.obj',                 fp: [11, 8], front: 0, frontName: 'Nose' },
      { id: 'car',          label: 'Parked car',          path: 'lib/cars/car_static.obj',                                fp: [2, 5], front: 0, frontName: 'Front' },
    ]},
    { group: 'Other', items: [
      { id: 'office',       label: 'Small office',        path: 'lib/airport/Common_Elements/Misc_Buildings/Small_Office_1.agp', fp: [12, 10] },
      { id: 'site_office',  label: 'Site office 4 × 14 m', path: 'lib/g10/US/industrial/light/SiteOffice4x14.obj',        fp: [4, 14] },
      { id: 'potty',        label: 'Porta-potty',         path: 'lib/airport/Common_Elements/Miscellaneous/Porta_Potty_2.obj', fp: [2, 2] },
      { id: 'picnic',       label: 'Picnic table',        path: 'lib/airport/Common_Elements/Miscellaneous/Picnic_Table.obj', fp: [2, 2] },
      { id: 'flag',         label: 'Flagpole',            path: 'lib/airport/Common_Elements/Miscellaneous/Flagpole.obj',  fp: [1, 1] },
    ]},
  ];
  const BY_ID = {}; CATALOG.forEach(g => g.items.forEach(i => { BY_ID[i.id] = i; }));

  // ---------- small geodesy (meters, true degrees) ----------
  const R = 6371008.8, rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI;
  function dest(p, b, d){
    const φ1 = rad(p[0]), λ1 = rad(p[1]), θ = rad(b), δ = d / R;
    const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
    const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2));
    return [deg(φ2), deg(λ2)];
  }
  function brg(a, b){
    const φ1 = rad(a[0]), φ2 = rad(b[0]), Δλ = rad(b[1] - a[1]);
    return (deg(Math.atan2(Math.sin(Δλ) * Math.cos(φ2), Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ))) + 360) % 360;
  }
  function dist(a, b){
    const φ1 = rad(a[0]), φ2 = rad(b[0]), dφ = φ2 - φ1, dλ = rad(b[1] - a[1]);
    return 2 * R * Math.asin(Math.sqrt(Math.sin(dφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2));
  }
  // signed area in a local flat frame: > 0 = counter-clockwise (lon east = x, lat north = y)
  function signedArea(pts){
    const c = Math.cos(rad(pts[0][0])); let s = 0;
    for (let i = 0; i < pts.length; i++){ const p = pts[i], q = pts[(i + 1) % pts.length]; s += p[1] * c * q[0] - q[1] * c * p[0]; }
    return s / 2;
  }
  const openRing = pts => (pts.length > 2 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) ? pts.slice(0, -1) : pts.slice();
  const ccw = pts => { const p = openRing(pts); return signedArea(p) < 0 ? p.reverse() : p; };
  // an open taxiway line → a closed ribbon `w` meters wide
  function ribbon(pts, w){
    if (pts.length < 2) return null;
    const left = [], right = [];
    for (let i = 0; i < pts.length; i++){
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], h = brg(a, b);
      left.push(dest(pts[i], h - 90, w / 2)); right.push(dest(pts[i], h + 90, w / 2));
    }
    return right.concat(left.reverse());
  }
  const f8 = x => x.toFixed(8);

  // ---------- apt.dat 1200 ----------
  // m: { id, name, elevFt, city, state, local, lat, lon (datum), rwy: { a, b, labA, labB, widthM, surface },
  //      aprons: [[lat,lon]…], taxi: [{pts, closed}], box: [[lat,lon]…], windsock: [lat,lon]|null,
  //      tiedowns: [{lat, lon, hdg, name}], has3d }
  // surface: 1 asphalt, 2 concrete, 3 grass, 4 dirt, 5 gravel (spec "Surface type codes")
  function aptDat(m){
    const L = [];
    L.push('A', '1200 Generated by GeezerGeek Pilot Mexican Airstrips for your EFB and Sim', '');
    L.push(`1 ${Math.round(m.elevFt)} 0 0 ${m.id} ${m.name.slice(0, 40)}`);
    if (m.city) L.push(`1302 city ${m.city}`);
    L.push('1302 country MEX');
    if (m.lat != null){ L.push(`1302 datum_lat ${m.lat.toFixed(8)}`, `1302 datum_lon ${m.lon.toFixed(8)}`); }
    L.push(`1302 gui_label ${m.has3d ? '3D' : '2D'}`);
    if (m.local) L.push(`1302 local_code ${m.local}`);
    L.push('1302 region_code MM');
    if (m.state) L.push(`1302 state ${m.state}`);
    const r = m.rwy, paved = r.surface === 1 || r.surface === 2;
    // width, surface, shoulder, smoothness, centre lights, edge lights, distance signs; per end: number,
    // lat, lon, displaced threshold m, overrun m, markings (1 visual, 0 none), approach lights, TDZ, REIL
    const end = (lab, p) => `${lab}  ${f8(p[0])} ${f8(p[1])} 0 0 ${paved ? 1 : 0} 0 0 0`;
    L.push(`100 ${r.widthM.toFixed(2)} ${r.surface} 0 0.25 0 0 0  ${end(r.labA, r.a)}  ${end(r.labB, r.b)}`);
    const pavSurf = paved ? 1 : r.surface;
    const ring = (pts, closeCode = 113) => { pts.forEach((p, i) => L.push(`${i === pts.length - 1 ? closeCode : 111}  ${f8(p[0])} ${f8(p[1])}`)); };
    m.aprons.forEach((a, i) => { L.push(`110 ${pavSurf} 0.25 0.00 Ramp ${i + 1}`); ring(ccw(a)); });
    m.taxi.forEach((t, i) => {
      const poly = t.closed ? t.pts : ribbon(t.pts, 8);
      if (!poly) return;
      L.push(`110 ${pavSurf} 0.25 0.00 Taxiway${t.ref ? ' ' + t.ref : ''} ${i + 1}`); ring(ccw(poly));
    });
    if (m.box){ L.push('130 Airport Boundary'); ring(ccw(m.box)); }
    // windsock: lat lon lighting(0/1) name
    if (m.windsock) L.push(`19  ${f8(m.windsock[0])} ${f8(m.windsock[1])} 0 WS`);
    m.tiedowns.forEach(t => { L.push(`1300  ${f8(t.lat)} ${f8(t.lon)} ${t.hdg.toFixed(1)} tie_down props ${t.name}`, '1301 A general_aviation '); });
    L.push('99', '');
    return L.join('\n');
  }

  // ---------- DSF (binary overlay with objects) ----------
  function tileOf(lat, lon){ return [Math.floor(lat), Math.floor(lon)]; }
  function tilePath(s, w){
    const sg = (v, n) => (v < 0 ? '-' : '+') + String(Math.abs(v)).padStart(n, '0');
    const fs = Math.floor(s / 10) * 10, fw = Math.floor(w / 10) * 10;
    return `${sg(fs, 2)}${sg(fw, 3)}/${sg(s, 2)}${sg(w, 3)}.dsf`;
  }
  class Buf {
    constructor(){ this.a = []; }
    u8(v){ this.a.push(v & 255); return this; }
    u16(v){ this.a.push(v & 255, (v >>> 8) & 255); return this; }
    u32(v){ this.a.push(v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255); return this; }
    i32(v){ return this.u32(v >>> 0); }
    f32(v){ const b = new Uint8Array(new Float32Array([v]).buffer); this.a.push(...b); return this; }
    bytes(arr){ for (const x of arr) this.a.push(x); return this; }
    str(s){ this.bytes(new TextEncoder().encode(s)); return this.u8(0); }
  }
  // an atom: 4-char id stored as a little-endian int (so "HEAD" is written "DAEH"), then total length
  function atom(id, payload){
    const b = new Buf(); b.bytes([...id].reverse().map(c => c.charCodeAt(0))).u32(8 + payload.length).bytes(payload); return b.a;
  }
  const strTable = list => { const b = new Buf(); list.forEach(s => b.str(s)); return b.a; };
  // 16-bit point pool, every plane "differenced + run-length" (encoding 3), literal runs only — as WED writes it
  function pool16(points, planes){
    const b = new Buf(); b.u32(points.length).u8(planes);
    for (let k = 0; k < planes; k++){
      b.u8(3);
      let prev = 0; const diffs = points.map(p => { const v = p[k]; const d = (v - prev) & 0xffff; prev = v; return d; });
      for (let i = 0; i < diffs.length; i += 127){ const run = diffs.slice(i, i + 127); b.u8(run.length); run.forEach(d => b.u16(d)); }
    }
    return b.a;
  }
  // objs: [{path, lat, lon, hdg}] all inside one 1°×1° tile; aptId filters them to this airport (RFC airport-ID exclusion)
  function dsf(objs, aptId){
    const [s, w] = tileOf(objs[0].lat, objs[0].lon);
    const props = ['sim/west', String(w), 'sim/east', String(w + 1), 'sim/north', String(s + 1), 'sim/south', String(s),
      'sim/planet', 'earth', 'sim/creation_agent', 'GeezerGeek Pilot Mexican Airstrips', 'laminar/internal_revision', '0',
      'sim/overlay', '1', 'sim/filter/aptid', aptId, 'sim/require_agpoint', '1/0', 'sim/require_object', '1/0'];
    const head = atom('HEAD', atom('PROP', strTable(props)));
    const defs = [...new Set(objs.map(o => o.path))];
    const defn = atom('DEFN', [...atom('TERT', []), ...atom('OBJT', strTable(defs)), ...atom('POLY', []), ...atom('NETW', []), ...atom('DEMN', [])]);
    // quantize: offset = 1/32° cell below the minimum, scale 1/32° (widened if the objects span more)
    const minLat = Math.min(...objs.map(o => o.lat)), minLon = Math.min(...objs.map(o => o.lon));
    const maxLat = Math.max(...objs.map(o => o.lat)), maxLon = Math.max(...objs.map(o => o.lon));
    const offLon = Math.floor(minLon * 32) / 32, offLat = Math.floor(minLat * 32) / 32;
    let sc = 0.03125; while (maxLon - offLon >= sc || maxLat - offLat >= sc) sc *= 2;
    const q = (v, off, scale) => Math.max(0, Math.min(65535, Math.round((v - off) / scale * 65535)));
    // objects grouped by definition, so each definition is one contiguous range of points
    const order = []; defs.forEach((d, di) => objs.forEach(o => { if (o.path === d) order.push([o, di]); }));
    const pts = order.map(([o]) => [q(o.lon, offLon, sc), q(o.lat, offLat, sc), q(((o.hdg % 360) + 360) % 360, 0, 360), 0]);
    const scal = new Buf(); [[sc, offLon], [sc, offLat], [360, 0], [1, 0]].forEach(([a, c]) => scal.f32(a).f32(c));
    const po32a = new Buf(); po32a.u32(0).u8(4).bytes([3, 3, 3, 3]);
    const sc32a = new Buf(); [[1, w], [1, s], [65535, -32768], [0, 0]].forEach(([a, c]) => sc32a.f32(a).f32(c));
    const po32b = new Buf(); po32b.u32(0).u8(0);
    const geod = atom('GEOD', [...atom('POOL', pool16(pts, 4)), ...atom('SCAL', scal.a), ...atom('PO32', po32a.a), ...atom('SC32', sc32a.a), ...atom('PO32', po32b.a), ...atom('SC32', [])]);
    const c = new Buf();
    c.u8(2).u32(0);                                         // junction offset 0
    c.u8(32).u8(6).u16(2).i32(1);                           // comment type 2 (as WED 2.5.2r1 writes)
    c.u8(32).u8(6).u16(1).i32(0);                           // comment type 1: filter index 0 = sim/filter/aptid
    let i = 0;
    defs.forEach((d, di) => {
      const n = order.filter(x => x[1] === di).length;
      di < 256 ? c.u8(3).u8(di) : c.u8(4).u16(di);          // set definition
      if (di === 0) c.u8(1).u16(0);                         // select point pool 0
      c.u8(8).u16(i).u16(i + n);                            // object range [i, i+n)
      i += n;
    });
    const cmds = atom('CMDS', c.a);
    const body = new Buf(); body.bytes([...'XPLNEDSF'].map(ch => ch.charCodeAt(0))).u32(1).bytes(head).bytes(defn).bytes(geod).bytes(cmds);
    const bytes = new Uint8Array(body.a);
    const out = new Uint8Array(bytes.length + 16); out.set(bytes); out.set(md5(bytes), bytes.length);
    return { path: tilePath(s, w), bytes: out };
  }

  // ---------- MD5 (RFC 1321) ----------
  function md5(data){
    const K = new Uint32Array(64), S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
    for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0;
    const len = data.length, nb = ((len + 8) >>> 6) + 1, M = new Uint32Array(nb * 16);
    for (let i = 0; i < len; i++) M[i >> 2] |= data[i] << ((i % 4) * 8);
    M[len >> 2] |= 0x80 << ((len % 4) * 8);
    M[nb * 16 - 2] = (len * 8) >>> 0; M[nb * 16 - 1] = Math.floor(len / 536870912) >>> 0;
    let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
    for (let o = 0; o < M.length; o += 16){
      let A = a0, B = b0, C = c0, D = d0;
      for (let i = 0; i < 64; i++){
        let F, g;
        if (i < 16){ F = (B & C) | (~B & D); g = i; }
        else if (i < 32){ F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
        else if (i < 48){ F = B ^ C ^ D; g = (3 * i + 5) % 16; }
        else { F = C ^ (B | ~D); g = (7 * i) % 16; }
        const s = S[(i >> 4) * 4 + (i % 4)];
        F = (F + A + K[i] + M[o + g]) >>> 0;
        A = D; D = C; C = B; B = (B + ((F << s) | (F >>> (32 - s)))) >>> 0;
      }
      a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0; c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0;
    }
    const out = new Uint8Array(16);
    [a0, b0, c0, d0].forEach((v, i) => { for (let k = 0; k < 4; k++) out[i * 4 + k] = (v >>> (8 * k)) & 255; });
    return out;
  }

  // ---------- ZIP (stored, no compression) ----------
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++){ let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = u => { let c = 0xFFFFFFFF; for (let i = 0; i < u.length; i++) c = CRC[(c ^ u[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  function zip(files){ // files: [[path, Uint8Array|string]]
    const parts = [], cen = []; let off = 0;
    const d = new Date(), t = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), dt = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    for (const [p, data] of files){
      const name = new TextEncoder().encode(p), u = typeof data === 'string' ? new TextEncoder().encode(data) : data, crc = crc32(u);
      const lh = new Buf(); lh.u32(0x04034b50).u16(20).u16(0x0800).u16(0).u16(t).u16(dt).u32(crc).u32(u.length).u32(u.length).u16(name.length).u16(0);
      const ch = new Buf(); ch.u32(0x02014b50).u16(20).u16(20).u16(0x0800).u16(0).u16(t).u16(dt).u32(crc).u32(u.length).u32(u.length).u16(name.length).u16(0).u16(0).u16(0).u16(0).u32(0).u32(off);
      parts.push(new Uint8Array(lh.a), name, u); cen.push(new Uint8Array(ch.a), name);
      off += lh.a.length + name.length + u.length;
    }
    const cenLen = cen.reduce((n, x) => n + x.length, 0);
    const end = new Buf(); end.u32(0x06054b50).u16(0).u16(0).u16(files.length).u16(files.length).u32(cenLen).u32(off).u16(0);
    return new Blob([...parts, ...cen, new Uint8Array(end.a)], { type: 'application/zip' });
  }

  // ---------- the whole pack ----------
  // objs: [{id (catalog), lat, lon, hdg}]; layout (v0.51): the app's editable layout, saved in the pack as LAYOUT_FILE
  // so opening the zip in the app later (any device) brings back exactly what was on the map. X-Plane ignores the file.
  const LAYOUT_FILE = 'mx-airstrips-layout.json';
  function pack(m, objs, readme, layout){
    const folder = `${m.id} ${m.name}`.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9 _-]+/g, '').trim().slice(0, 60);
    const files = [[`${folder}/Earth nav data/apt.dat`, aptDat(m)], [`${folder}/README.txt`, readme]];
    if (layout) files.push([`${folder}/${LAYOUT_FILE}`, JSON.stringify(layout, null, 1)]);
    const placed = objs.map(o => ({ path: BY_ID[o.id].path, lat: o.lat, lon: o.lon, hdg: o.hdg }));
    const byTile = {};
    placed.forEach(o => { const k = tileOf(o.lat, o.lon).join(','); (byTile[k] = byTile[k] || []).push(o); });
    Object.values(byTile).forEach(list => { const d = dsf(list, m.id); files.push([`${folder}/Earth nav data/${d.path}`, d.bytes]); });
    return { name: folder + '.zip', blob: zip(files), files };
  }


  // =====================================================================================================
  // v0.51 — reading scenery back in (Wayne, 15-Nov-2026: a layout made on one computer and emailed to another
  // couldn't be edited further). Reads a zip (stored or deflated), or loose apt.dat / .dsf / layout files.
  // =====================================================================================================

  // ---------- ZIP reader: central directory; method 0 (stored) or 8 (deflate, via the browser's DecompressionStream) ----------
  async function unzip(buf){
    const u = new Uint8Array(buf), dv = new DataView(u.buffer, u.byteOffset, u.byteLength);
    let e = -1;
    for (let i = u.length - 22; i >= Math.max(0, u.length - 65557); i--){ if (dv.getUint32(i, true) === 0x06054b50){ e = i; break; } }
    if (e < 0) throw new Error('not a zip file');
    const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true);
    const out = [];
    for (let k = 0; k < n; k++){
      if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('damaged zip directory');
      const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
      const nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
      const name = new TextDecoder().decode(u.subarray(p + 46, p + 46 + nl));
      p += 46 + nl + xl + cl;
      if (name.endsWith('/') || /(^|\/)__MACOSX\/|(^|\/)\._/.test(name)) continue;
      const start = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true);
      out.push({ name, method, raw: u.subarray(start, start + csize) });
    }
    return out;
  }
  async function entryBytes(en){
    if (en.method === 0) return en.raw;
    if (en.method !== 8) throw new Error(`${en.name}: unsupported zip compression`);
    if (typeof DecompressionStream === 'undefined') throw new Error('this browser can\'t unzip compressed files; unzip it first and choose the apt.dat and .dsf');
    const ds = new Blob([en.raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(ds).arrayBuffer());
  }

  // ---------- apt.dat → the first airport's runway, ramps, windsock, start positions ----------
  function parseAptDat(text){
    const out = { id: null, name: '', local: null, datum: null, runway: null, pavements: [], windsock: null, starts: [] };
    let cur = null, seenApt = false;
    for (const line of text.split(/\r?\n/)){
      const t = line.trim().split(/\s+/), c = t[0];
      if (c === '1' || c === '16' || c === '17'){ if (seenApt) break; seenApt = true; out.id = t[4]; out.name = t.slice(5).join(' '); continue; }
      if (!seenApt) continue;
      if (c === '1302'){
        if (t[1] === 'local_code' && t[2]) out.local = t[2];
        if (t[1] === 'datum_lat') out.datum = [parseFloat(t[2]), out.datum ? out.datum[1] : null];
        if (t[1] === 'datum_lon') out.datum = [out.datum ? out.datum[0] : null, parseFloat(t[2])];
      } else if (c === '100' && !out.runway){
        out.runway = { widthM: parseFloat(t[1]), surface: +t[2], labA: t[8], a: [parseFloat(t[9]), parseFloat(t[10])], labB: t[17], b: [parseFloat(t[18]), parseFloat(t[19])] };
      } else if (c === '110'){
        cur = { name: t.slice(4).join(' '), pts: [] }; out.pavements.push(cur);
      } else if ((c === '111' || c === '112' || c === '113' || c === '114') && cur){
        cur.pts.push([parseFloat(t[1]), parseFloat(t[2])]);
        if (c === '113' || c === '114') cur = null;            // first ring only (holes ignored)
      } else if (c === '130'){ cur = null;
      } else if (c === '19' && !out.windsock){ out.windsock = [parseFloat(t[1]), parseFloat(t[2])];
      } else if (c === '1300' || c === '15'){
        out.starts.push({ lat: parseFloat(t[1]), lon: parseFloat(t[2]), hdg: parseFloat(t[3]), name: t.slice(c === '15' ? 4 : 6).join(' ') });
      }
    }
    if (!seenApt) throw new Error('no airport found in the apt.dat');
    return out;
  }

  // ---------- DSF → placed objects [{path, lat, lon, hdg}] ----------
  // Reads the atoms (DSF File Format Specification): OBJT names, 16-bit POOL/SCAL point pools, and the CMDS object commands.
  // Polygons, networks and terrain are skipped. Global-scenery DSFs are 7-Zip compressed; overlays from WED are not.
  function parseDsf(bytes){
    const u = bytes, dv = new DataView(u.buffer, u.byteOffset, u.byteLength);
    const tag = String.fromCharCode(...u.subarray(0, 8));
    if (tag.startsWith('7z')) throw new Error('this DSF is 7-Zip compressed (unpack it with DSFTool first)');
    if (tag !== 'XPLNEDSF') throw new Error('not a DSF file');
    const id = o => String.fromCharCode(u[o + 3], u[o + 2], u[o + 1], u[o]);
    function atoms(start, end){ const a = []; let o = start; while (o + 8 <= end){ const len = dv.getUint32(o + 4, true); if (len < 8 || o + len > end) break; a.push({ id: id(o), s: o + 8, e: o + len }); o += len; } return a; }
    const strs = (s, e) => new TextDecoder().decode(u.subarray(s, e)).split('\0').filter(Boolean);
    const top = atoms(12, u.length - 16), get = (list, k) => list.filter(x => x.id === k);
    const defn = get(top, 'DEFN')[0], geod = get(top, 'GEOD')[0], cmds = get(top, 'CMDS')[0];
    if (!defn || !geod || !cmds) return [];
    const objt = get(atoms(defn.s, defn.e), 'OBJT').flatMap(a => strs(a.s, a.e));
    const g = atoms(geod.s, geod.e), pools = get(g, 'POOL').map(a => decodePool(a.s, a.e)), scal = get(g, 'SCAL').map(a => { const f = []; for (let o = a.s; o + 8 <= a.e; o += 8) f.push([dv.getFloat32(o, true), dv.getFloat32(o + 4, true)]); return f; });
    function decodePool(s, e){
      const n = dv.getUint32(s, true), planes = u[s + 4]; let o = s + 5; const P = [];
      for (let k = 0; k < planes; k++){
        const enc = u[o++], v = new Array(n); let i = 0;
        if (enc & 2){ while (i < n && o < e){ const code = u[o++], cnt = code & 127; if (code & 128){ const x = dv.getUint16(o, true); o += 2; for (let j = 0; j < cnt; j++) v[i++] = x; } else { for (let j = 0; j < cnt; j++){ v[i++] = dv.getUint16(o, true); o += 2; } } } }
        else { for (; i < n; i++){ v[i] = dv.getUint16(o, true); o += 2; } }
        if (enc & 1){ let acc = 0; for (let j = 0; j < n; j++){ acc = (acc + v[j]) & 0xffff; v[j] = acc; } }
        P.push(v);
      }
      return P;
    }
    const out = []; let pool = 0, def = 0, o = cmds.s;
    const place = i => { const P = pools[pool], S = scal[pool]; if (!P || !S || objt[def] == null) return;
      const val = k => P[k][i] / 65535 * S[k][0] + S[k][1];
      out.push({ path: objt[def], lon: val(0), lat: val(1), hdg: ((val(2) % 360) + 360) % 360 }); };
    const U8 = () => u[o++], U16 = () => { const x = dv.getUint16(o, true); o += 2; return x; }, U32 = () => { const x = dv.getUint32(o, true); o += 4; return x; };
    while (o < cmds.e){
      const c = U8();
      if (c === 1) pool = U16(); else if (c === 2) U32(); else if (c === 3) def = U8(); else if (c === 4) def = U16(); else if (c === 5) def = U32();
      else if (c === 6) U8();
      else if (c === 7) place(U16());
      else if (c === 8){ const a = U16(), b = U16(); for (let i = a; i < b; i++) place(i); }
      else if (c === 9){ const n = U8(); o += 2 * n; } else if (c === 10) o += 4; else if (c === 11){ const n = U8(); o += 4 * n; }
      else if (c === 12){ U16(); const n = U8(); o += 2 * n; } else if (c === 13) o += 6;
      else if (c === 14){ U16(); const n = U8(); for (let j = 0; j < n; j++){ const m = U8(); o += 2 * m; } }
      else if (c === 15){ U16(); const n = U8(); o += 2 * (n + 1); }
      else if (c === 16){} else if (c === 17) o += 1; else if (c === 18) o += 9; else if (c === 19) o += 1;
      else if (c === 23 || c === 26 || c === 29){ const n = U8(); o += 2 * n; }
      else if (c === 24 || c === 27 || c === 30){ const n = U8(); o += 4 * n; }
      else if (c === 25 || c === 28 || c === 31) o += 4;
      else if (c === 32){ const n = U8(); o += n; } else if (c === 33){ const n = U16(); o += n; } else if (c === 34){ const n = U32(); o += n; }
      else break;                                              // unknown command: stop, keep what we have
    }
    return out;
  }

  // ---------- read a scenery pack: zip or loose files → { layout } (our own file) or { apt, objs } ----------
  async function readScenery(files){
    const items = [];
    for (const f of files){
      const buf = new Uint8Array(await f.arrayBuffer());
      if (/\.zip$/i.test(f.name) || (buf[0] === 0x50 && buf[1] === 0x4b)) for (const en of await unzip(buf)) items.push({ name: en.name, get: () => entryBytes(en) });
      else items.push({ name: f.name, get: async () => buf });
    }
    const txt = async it => new TextDecoder().decode(await it.get());
    const lay = items.find(it => it.name.split('/').pop() === LAYOUT_FILE || /\.json$/i.test(it.name));
    if (lay){ try { const L = JSON.parse(await txt(lay)); if (L && L.app === 'mx-airstrips') return { layout: L }; } catch (e){} }
    const aptIt = items.find(it => /(^|\/)apt\.dat$/i.test(it.name));
    if (!aptIt) throw new Error('no apt.dat or layout file found in what you chose');
    const apt = parseAptDat(await txt(aptIt));
    const objs = [], unknown = new Set(), errors = [];
    for (const it of items.filter(it => /\.dsf$/i.test(it.name))){
      try { parseDsf(await it.get()).forEach(o => { const c = BY_PATH[o.path]; if (c) objs.push({ id: c.id, lat: o.lat, lon: o.lon, hdg: o.hdg }); else unknown.add(o.path); }); }
      catch (e){ errors.push(it.name.split('/').pop() + ': ' + e.message); }
    }
    return { apt, objs, unknown: [...unknown], errors };
  }
  const BY_PATH = {}; CATALOG.forEach(g => g.items.forEach(i => { BY_PATH[i.path] = i; }));

  const api = { CATALOG, BY_ID, BY_PATH, LAYOUT_FILE, aptDat, dsf, md5, zip, pack, ccw, ribbon, dest, brg, dist, unzip, parseAptDat, parseDsf, readScenery };
  if (typeof window !== 'undefined') window.XP = api;
  if (typeof module !== 'undefined') module.exports = api;
})();

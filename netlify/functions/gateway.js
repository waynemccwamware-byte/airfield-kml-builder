// Mexican Airstrips for your EFB and Sim — X-Plane Scenery Gateway lookups (v0.53, 15-Nov-2026).
//
// The Gateway API (gateway.x-plane.com/apiv1, Laminar Research; endpoints as used by Laminar's own
// github.com/X-Plane/xplane_airports gateway.py, checked live 15-Nov-2026) sends no CORS headers, so the page asks here.
//
//   GET ?near=<lat>,<lon>[&km=5]  → Gateway airports within km, nearest first:
//        { at, airports: [{ code, name, lat, lon, km, rec, status, type }] }
//      from a compact index of /apiv1/airports (≈20 MB, 41k airports on 15-Nov-2026), rebuilt weekly and kept in
//      Netlify Blobs (store "gateway") plus this instance's memory.
//   GET ?apt=<CODE>  → the airport's recommended scenery pack:
//        { code, name, sceneryId, type, userName, dateApproved, status, zip: <base64 masterZipBlob> }
//      The zip holds <CODE>.dat (apt.dat), <CODE>.txt (the DSF as DSFTool text, 3D packs only) and
//      <CODE>_Scenery_Pack.zip; the page reads it with the same code that opens scenery zips.
// No npm packages (App Conventions §1).

const API = 'https://gateway.x-plane.com/apiv1';
const UA = 'GeezerGeekPilot-MexicanAirstrips/0.53 (+https://airfield-kml-builder.netlify.app)';
const WEEK = 7 * 864e5;
let mem = null;   // { at, list }

const json = (code, obj, cacheS) => ({
  statusCode: code,
  headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, cacheS ? {
    'Cache-Control': 'public, max-age=3600',
    'Netlify-CDN-Cache-Control': `public, durable, s-maxage=${cacheS}`,
    'Netlify-Vary': 'query',
  } : { 'Cache-Control': 'no-store' }),
  body: JSON.stringify(obj),
});

// Netlify Blobs over REST, as in pack.js (event.blobs + x-nf-site-id); store "gateway"
function blobsEnv(event){
  try {
    if (!event.blobs) return null;
    const { url, token } = JSON.parse(Buffer.from(event.blobs, 'base64').toString('utf8'));
    const site = (event.headers || {})['x-nf-site-id'];
    return url && token && site ? { url, token, site } : null;
  } catch (e){ return null; }
}
const blobUrl = (env, key) => new URL(`/${env.site}/site:gateway/${key}`, env.url).toString();
async function blobGet(env, key){
  const r = await fetch(blobUrl(env, key), { headers: { authorization: `Bearer ${env.token}` } });
  return r.ok ? r.text() : null;
}
async function blobPut(env, key, text){
  await fetch(blobUrl(env, key), { method: 'PUT', headers: { authorization: `Bearer ${env.token}` }, body: text }).catch(() => {});
}

async function get(path, ms){
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(API + path, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: ctl.signal });
    if (!r.ok) throw new Error(`Gateway ${path.split('/')[1]}: HTTP ${r.status}`);
    return await r.json();
  } catch (e){ throw new Error(e.name === 'AbortError' ? 'the Gateway did not answer in time' : e.message); }
  finally { clearTimeout(t); }
}

async function index(event){
  if (mem && Date.now() - mem.at < WEEK) return mem;
  const env = blobsEnv(event);
  if (env){
    try { const s = await blobGet(env, 'index.json'); if (s){ const d = JSON.parse(s); if (Date.now() - d.at < WEEK){ mem = d; return d; } } } catch (e){}
  }
  const d = await get('/airports', 20000);
  const list = (d.airports || []).filter(a => !a.Deprecated && a.Latitude != null)
    .map(a => [a.AirportCode, a.AirportName, +(+a.Latitude).toFixed(5), +(+a.Longitude).toFixed(5), a.RecommendedSceneryId || 0, a.Status || '', a.SceneryType]);
  mem = { at: Date.now(), list };
  if (env) await blobPut(env, 'index.json', JSON.stringify(mem));
  return mem;
}

const R = 6371.0088, rad = d => d * Math.PI / 180;
const km = (a, b, c, d) => 2 * R * Math.asin(Math.sqrt(Math.sin(rad(c - a) / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(rad(d - b) / 2) ** 2));

exports.handler = async (event) => {
  const q = event.queryStringParameters || {};
  try {
    if (q.near){
      const [lat, lon] = q.near.split(',').map(Number);
      if (!isFinite(lat) || !isFinite(lon)) return json(400, { error: 'near=lat,lon' });
      const lim = Math.min(25, Math.max(0.5, parseFloat(q.km) || 5));
      const ix = await index(event);
      const airports = ix.list.map(a => ({ code: a[0], name: a[1], lat: a[2], lon: a[3], km: +km(lat, lon, a[2], a[3]).toFixed(2), rec: a[4], status: a[5], type: a[6] }))
        .filter(a => a.km <= lim).sort((a, b) => a.km - b.km).slice(0, 10);
      return json(200, { at: new Date(ix.at).toISOString(), airports }, 86400);
    }
    if (q.apt){
      const code = String(q.apt).toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 12);
      const a = (await get('/airport/' + encodeURIComponent(code), 15000)).airport;
      if (!a || !a.recommendedSceneryId) return json(404, { error: `${code} has no recommended scenery pack on the Gateway` });
      const s = (await get('/scenery/' + a.recommendedSceneryId, 20000)).scenery;
      const meta = (a.scenery || []).find(x => x.sceneryId === s.sceneryId) || {};
      return json(200, { code: a.icao || code, name: a.airportName, lat: a.latitude, lon: a.longitude, sceneryId: s.sceneryId, type: s.type,
        userName: s.userName, dateApproved: s.dateApproved || s.dateAccepted || s.dateUploaded, status: meta.Status || '', zip: s.masterZipBlob }, 86400);
    }
    return json(400, { error: 'use ?near=lat,lon or ?apt=CODE' });
  } catch (e){
    return json(502, { error: e.message });
  }
};

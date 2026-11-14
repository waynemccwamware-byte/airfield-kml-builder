// Airfield KML Builder — OpenStreetMap aeroway features near a point, via the Overpass API.
//
// Why a server function: public Overpass servers rate-limit by IP and sometimes answer 200 with an error
// "remark" and no data. Asking from here lets Netlify's CDN cache each airfield's answer for a week, so
// repeat lookups don't touch Overpass at all. The page falls back to asking Overpass directly if this fails.
// No npm packages (App Conventions §1). Data © OpenStreetMap contributors, ODbL.
//
// GET /.netlify/functions/osm?lat=26.25852&lon=-112.49787   (rounded to 5 decimals = the cache key)

const SERVERS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];

const json = (code, obj, cache) => ({
  statusCode: code,
  headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, cache ? {
    'Cache-Control': 'public, max-age=3600',
    'Netlify-CDN-Cache-Control': 'public, durable, s-maxage=604800',
    'Netlify-Vary': 'query=lat|lon',
  } : { 'Cache-Control': 'no-store' }),
  body: JSON.stringify(obj),
});

exports.handler = async (event) => {
  const q = (event && event.queryStringParameters) || {};
  const lat = Number(q.lat), lon = Number(q.lon);
  if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return json(400, { error: 'lat and lon required' });
  const query = `[out:json][timeout:20];nwr(around:2500,${lat.toFixed(5)},${lon.toFixed(5)})[aeroway~"^(runway|taxiway|taxilane|apron|hangar|aerodrome|stopway)$"];out geom;`;
  let last = '';
  const started = Date.now();
  for (const url of SERVERS) {
    const left = 9000 - (Date.now() - started);          // stay inside Netlify's function time limit
    if (left < 1500) break;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), left);
    try {
      const res = await fetch(url, {
        method: 'POST', signal: ctl.signal,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'GeezerGeekPilot-AirfieldKML/0.3 (airfield-kml-builder.netlify.app)' },
        body: 'data=' + encodeURIComponent(query),
      });
      if (!res.ok) { last = `${new URL(url).host}: HTTP ${res.status}`; continue; }
      const d = await res.json();
      if (d.remark && /error|timeout|runtime/i.test(d.remark)) { last = `${new URL(url).host}: ${d.remark.slice(0, 80)}`; continue; }
      return json(200, { server: new URL(url).host, fetched: new Date().toISOString(), elements: d.elements || [] }, true);
    } catch (e) {
      last = `${new URL(url).host}: ${e.name === 'AbortError' ? 'timed out' : e.message}`;
    } finally { clearTimeout(timer); }
  }
  return json(502, { error: last || 'no answer' });
};

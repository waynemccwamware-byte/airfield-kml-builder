// Mexican Airstrips for your EFB and Sim (formerly Airfield KML Builder) — look up an OurAirports identifier (e.g. MX-0007) for a Mexican airfield.
//
// OurAirports gives Mexican strips without an official code identifiers like "MX-0007", and robrc.net and other
// sites show them. This function finds one and returns its local code (often AFAC's 3-letter designator,
// e.g. MX-0007 = Rancho San Cristobal Airstrip, local code RCX), name and position, so the page can match it to
// AFAC's list. OurAirports data is public domain (ourairports.com/data). No npm packages (App Conventions §1).
//
// GET /.netlify/functions/oa?ident=MX-0007
// GET /.netlify/functions/oa?q=laguna san ignacio   (v0.23: name / keywords / municipality text search, up to 15 rows;
//     OurAirports keywords hold other names a strip goes by, e.g. MX-0007's "Laguna San Ignacio")

const SRC = 'https://davidmegginson.github.io/ourairports-data/airports.csv';
let cache = null;              // { at, rows: Map(ident -> row) } while the function instance stays warm
const TTL_MS = 24 * 3600 * 1000;

function parseLine(l) {
  const out = []; let cur = '', q = false;
  for (const ch of l) {
    if (ch === '"') q = !q;
    else if (ch === ',' && !q) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

async function load() {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.rows;
  const res = await fetch(SRC, { headers: { 'User-Agent': 'GeezerGeekPilot-AirfieldKML (+https://airfield-kml-builder.netlify.app)' } });
  if (!res.ok) throw new Error('OurAirports: HTTP ' + res.status);
  const lines = (await res.text()).split('\n');
  const H = parseLine(lines[0]), ix = k => H.indexOf(k);
  const rows = new Map();
  for (const l of lines.slice(1)) {
    if (!l.includes('"MX"')) continue;                       // quick pre-filter
    const r = parseLine(l);
    if (r[ix('iso_country')] !== 'MX') continue;
    const row = { ident: r[ix('ident')], type: r[ix('type')], name: r[ix('name')], lat: +r[ix('latitude_deg')], lon: +r[ix('longitude_deg')],
                  muni: r[ix('municipality')], local: r[ix('local_code')], gps: r[ix('gps_code')], icao: r[ix('icao_code')],
                  keywords: r[ix('keywords')] };
    if (/heliport|balloonport/.test(row.type)) continue;      // no runway, nothing for this app
    row.text = norm([row.name, row.keywords, row.muni].join(' '));
    rows.set(row.ident.toUpperCase(), row);
  }
  cache = { at: Date.now(), rows };
  return rows;
}

const ok = (body) => ({
  statusCode: 200,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=3600',
             'Netlify-CDN-Cache-Control': 'public, durable, s-maxage=604800', 'Netlify-Vary': 'query=ident|q' },
  body: JSON.stringify(body),
});
const strip = ({ text, ...r }) => r;

exports.handler = async (event) => {
  const params = (event && event.queryStringParameters) || {};
  if (params.q != null) {
    const words = norm(params.q).split(/\s+/).filter(w => w.length >= 2).slice(0, 6);
    if (!words.length || norm(params.q).length < 3) return ok({ rows: [] });
    try {
      const rows = [];
      for (const r of (await load()).values()) if (words.every(w => r.text.includes(w))) { rows.push(strip(r)); if (rows.length >= 15) break; }
      return ok({ rows });
    } catch (e) {
      return { statusCode: 502, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: String(e.message || e) }) };
    }
  }
  const q = params.ident || '';
  let ident = q.trim().toUpperCase();
  if (/^MX\d+$/.test(ident)) ident = 'MX-' + ident.slice(2);          // MX0007 -> MX-0007
  if (/^MX-\d{1,4}$/.test(ident)) ident = 'MX-' + ident.slice(3).padStart(4, '0');
  if (!/^[A-Z0-9-]{3,10}$/.test(ident)) return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'bad ident' }) };
  try {
    const row = (await load()).get(ident) || null;
    return ok({ ident, found: !!row, row: row && strip(row) });
  } catch (e) {
    return { statusCode: 502, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: String(e.message || e) }) };
  }
};

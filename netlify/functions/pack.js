// Mexican Airstrips for your EFB and Sim (formerly Airfield KML Builder) — serve a ForeFlight content pack (.zip) the page built, from a real URL (v0.24).
//
// Why: a KML with shapes always imports as a User Map Layer, so its points can't be used in a route.
// A content pack carries the shapes in layers/ and a points-only waypoint KML in navdata/, so one import
// gives the map layer AND a user waypoint at AFAC's reference point that can go in a Maps-tab route.
// ForeFlight imports packs from a hyperlink: https://foreflight.com/content?downloadURL=<this URL>.
// Nothing is stored: the files travel in the URL (deflate-raw + base64url JSON {path: text}), and come
// back zipped. No npm packages (App Conventions §1).
//
// GET /.netlify/functions/pack/<base64url(deflate-raw(JSON)), split into 200-char path segments>/<pack name>.zip
// (older form, still accepted: /.netlify/functions/pack?n=<pack name>&d=<…>)

const zlib = require('zlib');

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++){ let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
const crc32 = (buf) => { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };

function zip(files){
  // directory entries first ("XSQA/", "XSQA/layers/" …), as Finder's "Compress" writes them and as ForeFlight's own
  // sample content pack has them (v0.27)
  const dirs = new Set();
  for (const [path] of files){ const parts = path.split('/'); for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join('/') + '/'); }
  files = [...[...dirs].sort().map(d => [d, null]), ...files];
  const locals = [], centrals = []; let offset = 0;
  const d = new Date(), dosTime = (d.getUTCHours() << 11) | (d.getUTCMinutes() << 5) | (d.getUTCSeconds() >> 1),
        dosDate = ((d.getUTCFullYear() - 1980) << 9) | ((d.getUTCMonth() + 1) << 5) | d.getUTCDate();
  for (const [path, text] of files){
    const isDir = text === null;
    const name = Buffer.from(path, 'utf8'), raw = Buffer.from(isDir ? '' : text, 'utf8'), comp = isDir ? raw : zlib.deflateRawSync(raw), crc = crc32(raw), method = isDir ? 0 : 8;
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0, 6); lh.writeUInt16LE(method, 8);
    lh.writeUInt16LE(dosTime, 10); lh.writeUInt16LE(dosDate, 12); lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(raw.length, 22); lh.writeUInt16LE(name.length, 26); lh.writeUInt16LE(0, 28);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0, 8); ch.writeUInt16LE(method, 10);
    ch.writeUInt16LE(dosTime, 12); ch.writeUInt16LE(dosDate, 14); ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(raw.length, 24); ch.writeUInt16LE(name.length, 28);
    ch.writeUInt32LE(isDir ? 0x10 : 0, 38);   // MS-DOS directory attribute
    ch.writeUInt32LE(offset, 42);
    locals.push(lh, name, comp); centrals.push(ch, name);
    offset += 30 + name.length + comp.length;
  }
  const cd = Buffer.concat(centrals), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

exports.handler = async (event) => {
  const q = Object.assign({}, (event && event.queryStringParameters) || {});
  // v0.26: path form /.netlify/functions/pack/<d in 200-char segments>/<NAME>.zip — ForeFlight takes the text after
  // the last "/" as the file name and only imports it as a content pack when that ends in .zip (Wayne, iOS, 14-Nov-2026)
  const m = /\/pack\/(.+)\/([A-Za-z0-9_-]+)\.zip$/.exec((event && (event.rawUrl ? new URL(event.rawUrl).pathname : event.path)) || '');
  if (m){ q.d = m[1].replace(/\//g, ''); q.n = m[2]; }
  try {
    if (!q.d || q.d.length > 60000) throw new Error('missing or too large');
    const json = zlib.inflateRawSync(Buffer.from(q.d.replace(/-/g, '+').replace(/_/g, '/'), 'base64'), { maxOutputLength: 3_000_000 }).toString('utf8');
    const obj = JSON.parse(json);
    const name = String(q.n || 'airfield').replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 40) || 'airfield';
    const files = [];
    for (const [path, text] of Object.entries(obj)){
      // only what a content pack holds: manifest.json, layers/*.kml, navdata/*.kml|*.txt — all under <name>/
      // with or without the pack folder on top (ForeFlight's own packs come both ways)
      if (!new RegExp(`^(${name}/)?(manifest\\.json|layers/[^/]+\\.kml|navdata/[^/]+\\.(kml|txt))$`).test(path)) throw new Error('unexpected file ' + path);
      if (typeof text !== 'string') throw new Error('bad file ' + path);
      if (/\.kml$/.test(path) && !/^<\?xml[\s\S]*<kml[\s>]/.test(text)) throw new Error('not a KML document: ' + path);
      files.push([path, text]);
    }
    if (!files.length || files.length > 8) throw new Error('no files');
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${name}.zip"`,
        'Cache-Control': 'public, max-age=86400',
        'X-Content-Type-Options': 'nosniff',
      },
      body: zip(files).toString('base64'),
      isBase64Encoded: true,
    };
  } catch (e) {
    return { statusCode: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8' }, body: 'Could not rebuild the content pack: ' + e.message };
  }
};

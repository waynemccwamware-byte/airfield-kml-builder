// Mexican Airstrips for your EFB and Sim — ForeFlight content pack served from the edge (v0.31, TEST).
// Same job as functions/pack.js, but an edge function answers with a fixed-length body (Content-Length), the way a
// plain .zip file is served. A plain .zip from this site installs in ForeFlight; pack.js's chunked answer doesn't.
// GET /pk/<base64url(deflate-raw(JSON {path: text})) in path segments>/<NAME>.zip   — no npm packages.

const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++){ let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = u => { let c = 0xFFFFFFFF; for (let i = 0; i < u.length; i++) c = CRC[(c ^ u[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };

async function deflateRaw(u){ return new Uint8Array(await new Response(new Blob([u]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer()); }
async function inflateRaw(u){ return new Uint8Array(await new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer()); }

async function zip(files){
  const dirs = new Set();
  for (const [p] of files){ const parts = p.split('/'); for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join('/') + '/'); }
  const all = [...[...dirs].sort().map(d => [d, null]), ...files];
  const enc = new TextEncoder(), chunks = [], cen = []; let off = 0;
  const d = new Date(), t = (d.getUTCHours() << 11) | (d.getUTCMinutes() << 5) | (d.getUTCSeconds() >> 1), dt = ((d.getUTCFullYear() - 1980) << 9) | ((d.getUTCMonth() + 1) << 5) | d.getUTCDate();
  for (const [p, text] of all){
    const isDir = text === null, name = enc.encode(p), raw = isDir ? new Uint8Array(0) : enc.encode(text);
    const comp = isDir ? raw : await deflateRaw(raw), crc = crc32(raw), method = isDir ? 0 : 8;
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0, true); lh.setUint16(8, method, true);
    lh.setUint16(10, t, true); lh.setUint16(12, dt, true); lh.setUint32(14, crc, true); lh.setUint32(18, comp.length, true);
    lh.setUint32(22, raw.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0, true); ch.setUint16(10, method, true);
    ch.setUint16(12, t, true); ch.setUint16(14, dt, true); ch.setUint32(16, crc, true); ch.setUint32(20, comp.length, true); ch.setUint32(24, raw.length, true);
    ch.setUint16(28, name.length, true); ch.setUint32(38, isDir ? 0x10 : 0, true); ch.setUint32(42, off, true);
    chunks.push(new Uint8Array(lh.buffer), name, comp); cen.push(new Uint8Array(ch.buffer), name);
    off += 30 + name.length + comp.length;
  }
  const cenLen = cen.reduce((n, x) => n + x.length, 0), end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, all.length, true); end.setUint16(10, all.length, true); end.setUint32(12, cenLen, true); end.setUint32(16, off, true);
  const parts = [...chunks, ...cen, new Uint8Array(end.buffer)], out = new Uint8Array(parts.reduce((n, x) => n + x.length, 0));
  let i = 0; for (const x of parts){ out.set(x, i); i += x.length; }
  return out;
}

export default async (request) => {
  try {
    const m = /^\/pk\/(.+)\/([A-Za-z0-9_-]{1,40})\.zip$/.exec(new URL(request.url).pathname);
    if (!m) throw new Error('bad path');
    const d = m[1].replace(/\//g, ''), name = m[2];
    if (d.length > 60000) throw new Error('too large');
    const b64 = d.replace(/-/g, '+').replace(/_/g, '/'), bin = atob(b64 + '='.repeat((4 - b64.length % 4) % 4));
    const obj = JSON.parse(new TextDecoder().decode(await inflateRaw(Uint8Array.from(bin, c => c.charCodeAt(0)))));
    const files = [];
    for (const [p, text] of Object.entries(obj)){
      if (!new RegExp(`^(${name}/)?(manifest\\.json|layers/[^/]+\\.kml|navdata/[^/]+\\.(kml|txt))$`).test(p)) throw new Error('unexpected file ' + p);
      if (typeof text !== 'string') throw new Error('bad file ' + p);
      if (/\.kml$/.test(p) && !/^<\?xml[\s\S]*<kml[\s>]/.test(text)) throw new Error('not a KML document: ' + p);
      files.push([p, text]);
    }
    if (!files.length || files.length > 8) throw new Error('no files');
    const body = await zip(files);
    return new Response(body, { status: 200, headers: {
      'Content-Type': 'application/zip', 'Content-Length': String(body.length),
      'Content-Disposition': `attachment; filename="${name}.zip"`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    } });
  } catch (e) {
    return new Response('Could not rebuild the content pack: ' + e.message, { status: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
};

export const config = { path: '/pk/*' };

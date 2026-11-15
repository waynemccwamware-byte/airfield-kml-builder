// Mexican Airstrips for your EFB and Sim (formerly Airfield KML Builder) — serve a KML the page built, from a real URL, so iOS offers "Open in ForeFlight".
//
// Why: the Web Share API hands iOS the file with a MIME type it may not map to ForeFlight's KML type, so
// ForeFlight can be missing from the share sheet (Wayne, 14-Nov-2026). ForeFlight documents importing KML
// via email and hyperlinks; this gives the page a hyperlink. Nothing is stored: the KML travels in the URL,
// deflate-compressed and base64url-encoded by the page, and comes straight back as a .kml download.
// No npm packages (App Conventions §1).
//
// GET /.netlify/functions/kml?n=<file name>&d=<base64url(deflate-raw(kml))>

const zlib = require('zlib');

exports.handler = async (event) => {
  const q = (event && event.queryStringParameters) || {};
  try {
    if (!q.d || q.d.length > 60000) throw new Error('missing or too large');
    const b64 = q.d.replace(/-/g, '+').replace(/_/g, '/');
    const kml = zlib.inflateRawSync(Buffer.from(b64, 'base64'), { maxOutputLength: 2_000_000 }).toString('utf8');
    if (!/^<\?xml[\s\S]*<kml[\s>]/.test(kml)) throw new Error('not a KML document');
    const name = String(q.n || 'airfield').replace(/[^A-Za-z0-9_.-]+/g, '_').replace(/\.kml$/i, '').slice(0, 80) + '.kml';
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/vnd.google-earth.kml+xml; charset=utf-8',
        'Content-Disposition': `attachment; filename="${name}"`,
        'Cache-Control': 'public, max-age=86400',
        'X-Content-Type-Options': 'nosniff',
      },
      body: kml,
    };
  } catch (e) {
    return { statusCode: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8' }, body: 'Could not rebuild the KML: ' + e.message };
  }
};

# Mexican Airstrips for your EFB and Sim (GeezerGeek Pilot)

Formerly "Airfield KML Builder" (renamed 14-Nov-2026; the web address and repo name are unchanged).

Finds a Mexican airfield in AFAC's official list of aerodromes, and builds a KML of its runway, ramp and
taxiways for ForeFlight (User Map Layers). Not for navigation.

- `site/index.html` — the app (one page; Leaflet 1.9.4 from jsDelivr for the preview map).
- `netlify/functions/afac.js` — reads AFAC's "Aeródromos y helipuertos" XLSX from gob.mx and returns JSON.
  No npm packages. When AFAC posts a new edition, update `AFAC_URL` (or set `AFAC_XLSX_URL` in Netlify).
- Shapes: OpenStreetMap via the Overpass API (© OpenStreetMap contributors, ODbL).
- Footer blocks are written by the shared master in the Control Panel repo (`tools/ggp-footer`).

With thanks to [airports.robrc.net](https://airports.robrc.net/), whose public directory of Mexican airport
infrastructure showed the way to AFAC's data.

## Offline use

This app runs on the web and needs a connection: its maps, AFAC data, runway lookups, terrain checks and pack building all come from the web. Nothing is kept for offline use. Plan on the ground, send the results to ForeFlight or Garmin Pilot, finish the install (ForeFlight: More → Custom Content → Install), and check them in airplane mode before you go. The waypoint's PDF record is a snapshot from the day it was built.

## X-Plane scenery (step 6, from v0.35)

`site/xplane.js` builds an X-Plane 12 custom-scenery zip in the browser: `<ID> <Name>/Earth nav data/apt.dat` (APT.DAT 1200) plus, when objects from X-Plane's library are placed on the ramp, an overlay DSF. No server function or outside service is involved.

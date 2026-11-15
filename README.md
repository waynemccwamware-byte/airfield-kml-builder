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

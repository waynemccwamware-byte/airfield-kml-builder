# Airfield KML Builder — to-do

Wayne's enhancement list (14-Nov-2026):

1. **Send to Garmin Pilot.** Research 14-Nov-2026 — Garmin Pilot for iOS User's Guide (190-01501-00 Rev. AP,
   static.garmin.com/pumac/190-01501-00_ap.pdf), "Overlays > User Shape Files" (pp. 52–53):
   - imports "custom KML map files with lines, points and complex shapes"; KML file size 4 MB or less
     (our files are ~5–15 KB). KMZ, styling (colors/widths/fill) and the Files app are not mentioned.
   - ways in: email attachment → "Copy to Garmin Pilot"; AirDrop; text. (Forum: sharing from iOS works too.)
   - shown via Map → Overlays → KML (toggle on).
   Next: Wayne tests one of our KMLs (e.g. SQA) by email/AirDrop into Garmin Pilot and reports what draws
   (fills, colors, labels). Then decide: same file for both apps, or a Garmin-flavored variant, and relabel the
   button "Open in ForeFlight / Garmin Pilot".
2. **"Visual approach".** Build a visual approach for the strip to add to ForeFlight, and export it in a standard
   format for Garmin panel navigators (G1000, GTN), e.g. a flight plan file (.fpl). Format support per unit to be
   checked before building.

Open items from v0.1:

- AFAC publishes new editions under a new attachment number; `AFAC_URL` in `netlify/functions/afac.js` must be
  updated by hand (ask robrc.net how they track new editions).
- Consider robrc.net's "applied corrections" to AFAC's figures (ask robrc.net).
- Mexican Airport System XLSX (AIP airports) not used yet.
- Add a row to the Control Panel's Open Counts page if/when the app goes on the Control Panel.

## X-Plane layouts travel — v0.51 (15-Nov-2026)
Wayne: a layout made on another computer and emailed here couldn't be edited further. Agreed order: (1) layout JSON in
the zip, (2) share links, (3) reopen our own zips, (4) apt.dat import from other zips. All four in v0.51:
- zip carries `mx-airstrips-layout.json` (same object saved in localStorage: ID, ramp, tie-downs, windsock, objects, runway ends).
- "Open a scenery zip" (step 1 hint + X-Plane tab): our zip → exact layout; zip without it (v0.35–v0.50, WED, Gateway) →
  apt.dat runway (used only if >6 m from the app's), 4-corner "Ramp" → added ramp, windsock, 1300 starts, DSF objects that
  match the catalog by path (others listed, left out). Deflated zips via DecompressionStream; loose apt.dat/.dsf accepted.
- "Share layout link": ?xp=z<base64url(deflate-raw JSON)> (~330–400 chars); opening it loads the airfield + layout.
- Runway ends the pilot placed now persist per airfield (airfieldKml.ends.<des>|<name>).
- Replacing a different saved layout asks first (confirm).
- v0.53: Import from Gateway (netlify/functions/gateway.js; API endpoints per Laminar's xplane_airports gateway.py,
  checked live 15-Nov-2026: /apiv1/airports ≈20 MB, /apiv1/airport/<ID>, /apiv1/scenery/<id> with masterZipBlob =
  <ID>.dat + <ID>.txt (DSF text) + <ID>_Scenery_Pack.zip). No CORS on the API, hence the function.
  Lossy by design: only the largest pavement (as a rectangle), runway, windsock, starts, and catalog objects come in.
- Later (Wayne passed for now, 15-Nov-2026): exclusion-zone rectangle on the map → DSF PROPERTY sim/exclude_obj|fac|for|net… west/south/east/north (same 1° tile), e.g. for XMM000K's wind turbines (removed IRL).
- Later: WED project import; more catalog objects (Gateway packs use many library paths the app doesn't offer).

## X-Plane airport export — LIVE in v0.35 (15-Nov-2026)
- X-Plane pane under the step 5 map (v0.36; was a separate step 6 in v0.35): site/xplane.js writes apt.dat 1200 (runway from AFAC numbers/width/surface, ramp + taxiway
  pavement from OSM, boundary = airfield box, windsock, tie-downs, AFAC elevation, city/state/country/local_code/region_code)
  and, if objects are placed, an overlay DSF (library objects, sim/filter/aptid = the ID; byte-identical to WED 2.5.2r1 for
  Wayne's XMM000J object). Default ID X+AFAC code (XSQA). Wayne loaded the SQA sample in X-Plane 12 on 15-Nov-2026: all good.
- Not yet tried: WED File → Import apt.dat / Import DSF round trip.
- Open: ATC taxi network (1200/1201/1202), exclusion zones, beacon, real model footprints/door directions,
  "already on the Gateway?" check (gateway.x-plane.com API — verify before use), OSM hangars → hangar objects.

### Background (14-Nov-2026)
- Idea: generate an apt.dat 1200 scenery pack (zip: "<ID> <Name>/Earth nav data/apt.dat") from the same runway/ramp/taxi geometry:
  row 1 header (elev ft, ID, name), row 100 runway (surface 1 asphalt / 2 concrete / 3 grass / 4 dirt / 5 gravel), 110–116 pavement, 1302 metadata, 19 windsock, 1300 tie-down.
- Use: drop into Custom Scenery to fly, or WED File → Import apt.dat → refine → validate → Export to Gateway.
- Gateway needs a "New Airport Code Request" for strips without codes; don't import apt.dat for airports already on the Gateway (lossy) — add an "already in X-Plane?" check (Gateway API, gateway.x-plane.com/api).
- Reference received 14-Nov-2026: Wayne's Gateway pack XMM000J (San Pedro de la Cueva / SQA, WED 2.5.2r1). Pack = README.txt, COPYING,
  Earth nav data/apt.dat + Earth nav data/+20-110/+29-110.dsf (DSF holds the 3D objects). apt.dat lines used:
  `A` / `1200 Generated by WorldEditor 2.5.2r1` / `1 1259 0 0 XMM000J San Pedro de la Cueva` /
  `1302 city …`, `1302 country MEX`, `1302 gui_label 3D`, `1302 state Sonora` /
  `100 12.19 1 0 0.00 0 0 0  17 lat lon 0 0 1 0 0 0  35 lat lon 0 0 1 0 0 0` /
  `110 26 0.00 85.0 Taxi and Ramp` + 111…113 / `130 Airport Boundary` + 111…113 / `1300 lat lon 170.0 tie_down props Ramp Start Location` / `1301 A general_aviation` / `99`.
  Gateway-assigned ID pattern for code-less strips: XMM000J. Other Gateway metadata keys (empty there): icao_code, iata_code, faa_code,
  region_code, datum_lat, datum_lon, transition_alt, transition_level, local_code, local_authority — we could fill local_code (SQA) and region_code (MM).
- Generated file should be apt.dat-only (no DSF); objects stay a WED job.

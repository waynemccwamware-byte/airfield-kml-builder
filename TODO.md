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

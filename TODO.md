# Airfield KML Builder — to-do

Wayne's enhancement list (14-Nov-2026):

1. **Send to Garmin Pilot.** Garmin Pilot KML import is reported to work by sharing the file into the app on iOS,
   but there's no official Garmin documentation we've found, and one forum user got "unable to add .kml". Test on
   Wayne's iPad first.
2. **"Visual approach".** Build a visual approach for the strip to add to ForeFlight, and export it in a standard
   format for Garmin panel navigators (G1000, GTN), e.g. a flight plan file (.fpl). Format support per unit to be
   checked before building.

Open items from v0.1:

- AFAC publishes new editions under a new attachment number; `AFAC_URL` in `netlify/functions/afac.js` must be
  updated by hand (ask robrc.net how they track new editions).
- Consider robrc.net's "applied corrections" to AFAC's figures (ask robrc.net).
- Mexican Airport System XLSX (AIP airports) not used yet.
- Add a row to the Control Panel's Open Counts page if/when the app goes on the Control Panel.

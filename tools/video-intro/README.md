# Mexican Airstrips intro video — production kit

- `vo-script.md` → `update-recorder.py` → `/record/` page; Wayne's takes in `vo-raw/`, cleaned (`build_vo.py`, -21 LUFS) in `vo/`.
- `capture/`: films the live app frame by frame (Playwright, 1120×630 CSS at 1920/1120 = 1920×1080), timed to the cleaned takes.
  `rig.py` serves Leaflet and IBM Plex from npm and exposes the Leaflet map (no CSS zoom animation, maxNativeZoom 18);
  `film.py` draws the eased pointer, amber spotlight and click ripple; `scenes.py s2-a s2-b s2-c xplane s4-a` writes the clips.
  Needs airfield-kml-builder.netlify.app and server.arcgisonline.com allowed for the session.
- `cut/`: `gfx.py` (title, text-overs, placeholders, end card with the Control Panel QR) and `build.py` (segments → concat →
  Sascha Ende music bed ducked under the VO → -16 LUFS). Paths point at the session's working folders; adjust before re-running.

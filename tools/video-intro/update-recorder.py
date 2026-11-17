#!/usr/bin/env python3
"""Copy the lines from tools/video-intro/vo-script.md into the recorder page, site/record/index.html (intro video).
Run after editing the voice script. Also marks which lines already have a recording in tools/video-intro/vo-raw/.
Same as GA Accident Stats' tools/video-safety/update-recorder.py."""
import json, pathlib, re
ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
md = (ROOT / 'tools/video-intro/vo-script.md').read_text()
raw = ROOT / 'tools/video-intro/vo-raw'
done = {p.stem for p in raw.glob('*') if p.suffix in ('.m4a', '.mp3')} if raw.exists() else set()
lines = []
for m in re.finditer(r'^### `([^`]+)` — (.+?)\n\n(.+?)(?=\n\n(?:###|---|##)|\Z)', md, re.S | re.M):
    name = m.group(1).rsplit('.', 1)[0]
    lines.append({'name': name, 'panel': m.group(2).strip(), 'text': ' '.join(m.group(3).split()),
                  'kind': 'narration', 'live': name in done})
page = ROOT / 'site/record/index.html'
html = page.read_text()
html, n = re.subn(r'/\*LINES\*/.*?/\*END\*/', lambda _: '/*LINES*/' + json.dumps(lines, ensure_ascii=False) + '/*END*/', html, flags=re.S)
assert n == 1, 'LINES marker not found'
page.write_text(html)
print(f'{len(lines)} lines ({sum(l["live"] for l in lines)} already live) -> {page.relative_to(ROOT)}')

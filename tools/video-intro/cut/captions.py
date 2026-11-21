"""SRT captions from the VO script, timed to each take's position in the cut and split at its pauses."""
import re, subprocess, json, pathlib, build
VO = build.VO; P = build.plan()
txt = open('/home/claude/airfield-kml-builder/tools/video-intro/vo-script.md').read()
lines = dict(re.findall(r"### `(s\d-[a-z])\.m4a`.*?\n\n(.+?)\n", txt))
# absolute start of each take (file time 0)
starts, t = {}, 0.0
for s in P:
    v = s.get('vo')
    if v and v not in starts and s.get('vo_ss', 0) == 0: starts[v] = t + s.get('vo_at', 0)
    t += s['D']
def pauses(f):
    o = subprocess.run(['ffmpeg', '-i', str(f), '-af', 'silencedetect=n=-38dB:d=0.15', '-f', 'null', '-'], capture_output=True, text=True).stderr
    a = [float(x) for x in re.findall(r'silence_start: ([0-9.]+)', o)]; b = [float(x) for x in re.findall(r'silence_end: ([0-9.]+)', o)]
    return list(zip(a, b))
def chunks(text, maxc=78):
    parts = re.split(r'(?<=[.,:;?])\s+|\s+--\s+|(?<=\.\.\.)\s*', text.replace('...', '…'))
    out, cur = [], ''
    for p in [x for x in parts if x]:
        if len(p) > maxc:   # one long clause: split it at the space nearest the middle
            if cur: out.append(cur); cur = ''
            sp = [i for i, ch in enumerate(p) if ch == ' ']; i = min(sp, key=lambda k: abs(k - len(p) / 2)); out += [p[:i], p[i + 1:]]; continue
        if cur and len(cur) + 1 + len(p) > maxc: out.append(cur); cur = p
        else: cur = (cur + ' ' + p).strip()
    if cur: out.append(cur)
    return out
def fmt(x): h, r = divmod(x, 3600); m, s = divmod(r, 60); return f"{int(h):02d}:{int(m):02d}:{int(s):02d},{int(round((s % 1) * 1000)) % 1000:03d}"
def wrap(c, w=42):
    if len(c) <= w: return c
    sp = [i for i, ch in enumerate(c) if ch == ' ']; i = min(sp, key=lambda k: abs(k - len(c) / 2))
    return c[:i] + '\n' + c[i + 1:]
cues = []
for v, at in sorted(starts.items(), key=lambda kv: kv[1]):
    f = VO / f'{v}.m4a'; D = build.vod(v); ps = pauses(f)
    s0 = ps[0][1] if ps and ps[0][0] < 0.05 else 0.0
    s1 = ps[-1][0] if ps and ps[-1][1] > D - 0.05 else D
    cs = chunks(lines[v]); tot = sum(len(c) for c in cs); acc = 0; bounds = [s0]
    for c in cs[:-1]:
        acc += len(c); guess = s0 + (s1 - s0) * acc / tot
        mids = [(a + b) / 2 for a, b in ps if s0 < a and b < s1]
        near = min(mids, key=lambda m: abs(m - guess)) if mids else guess
        bounds.append(near if abs(near - guess) < 0.8 else guess)
    bounds.append(s1)
    for k, c in enumerate(cs):
        a, b = at + bounds[k], at + bounds[k + 1] + (0.25 if k == len(cs) - 1 else 0)
        cues.append((a, b, wrap(c)))
srt = ''.join(f"{i}\n{fmt(a)} --> {fmt(b)}\n{c}\n\n" for i, (a, b, c) in enumerate(cues, 1))
for n in ('mexican-airstrips.srt', 'mexican-airstrips.en_US.srt'): (pathlib.Path('/home/claude/cut/final') / n).write_text(srt)
print(srt)

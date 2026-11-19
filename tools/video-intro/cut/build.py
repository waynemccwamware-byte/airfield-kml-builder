"""Rough cut of the Mexican Airstrips intro video. Segments -> seg/NN.mp4 (1920x1080, 30 fps, 48 kHz stereo) -> concat -> music bed ducked under the VO -> -16 LUFS."""
import subprocess, json, pathlib, sys
U = pathlib.Path('/mnt/user-data/uploads'); CAP = pathlib.Path('/home/claude/cap/out'); G = pathlib.Path('/home/claude/cut/gfx')
VO = pathlib.Path('/home/claude/airfield-kml-builder/tools/video-intro/vo')
MUSIC = '/home/claude/vref/piston-ga-stats/tools/video-safety/music/ende-ambient-acoustic-guitars-vol-1.mp3'
SEG = pathlib.Path('/home/claude/cut/seg'); SEG.mkdir(exist_ok=True)
LAND = str(U / 'SPdlC-landing.mp4'); FFREC = str(U / 'ScreenRecording_11-18-2026_08-49-19_1.mp4'); TAXI = str(U / '868e5326-taxi-out.mp4'); TKOF = str(U / '94915a95-takeoff.mp4')
PH = {'clinic': '/home/claude/out/free-clinic-blurred.jpg', 'gil': '/home/claude/out/clinic-gil-blurred.jpg', 'eric': str(U / '60257839-image.jpg'), 'aimee': '/home/claude/out/clinic-aimee-blurred.jpg', 'mission': str(U / '42918236-image.jpg'), 'sunset': str(U / 'bc10abd3-image.jpg'), 'mountain': '/home/claude/cut/mountain.jpg'}
W, H, FPS = 1920, 1080, 30
def dur(f): return float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(f)], capture_output=True, text=True).stdout)
def vod(n): return dur(VO / f'{n}.m4a')
def ff(args): subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', *args], check=True)

KB = lambda D, z0=1.0, z1=1.08, cx=0.5, cy=0.5: (f"scale=3840:2160:force_original_aspect_ratio=increase,crop=3840:2160:(iw-3840)*{cx}:(ih-2160)*{cy},"
     f"zoompan=z='{z0}+({z1}-{z0})*on/{int(D*FPS)}':x='iw*{cx}-iw/zoom/2':y='ih*{cy}-ih/zoom/2':d=1:s={W}x{H}:fps={FPS}")

def render(i, D, video, vo=None, vo_at=0.0, vo_ss=0.0, natural=None, overlays=()):
    """video: (kind, ...) ; overlays: [(png, t_in, t_out)] ; natural: (src, ss, gain_db) for location sound"""
    inp, fc = [], []
    k = video[0]
    if k == 'clip':      # ('clip', src, ss, extra_vf)
        _, src, ss, vf = video
        inp += ['-ss', str(ss), '-t', f'{D:.3f}', '-i', src]
        fc.append(f"[0:v]{vf + ',' if vf else ''}scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},fps={FPS},setsar=1,format=yuv420p[v0]")
    elif k == 'cap':     # app capture, already 1920x1080 and timed to the VO
        _, src, vf = video
        inp += ['-t', f'{D:.3f}', '-i', str(src)]
        fc.append(f"[0:v]{vf + ',' if vf else ''}tpad=stop_mode=clone:stop_duration=5,trim=duration={D:.3f},fps={FPS},setsar=1,format=yuv420p[v0]")
    elif k == 'still':   # ('still', img, z0, z1, cx, cy)
        _, img, z0, z1, cx, cy = video
        inp += ['-loop', '1', '-framerate', str(FPS), '-t', f'{D:.3f}', '-i', img]
        fc.append(f"[0:v]{KB(D, z0, z1, cx, cy)},setsar=1,format=yuv420p[v0]")
    elif k == 'seq':     # ('seq', src, [(t0, t1, out_seconds), ...]) pieces of one recording, retimed, fitted onto the dark frame
        _, src, pieces = video
        inp += ['-i', src]
        parts = []
        for j, (a, b, o) in enumerate(pieces):
            fc.append(f"[0:v]trim={a}:{b},setpts=(PTS-STARTPTS)*{o/(b-a):.5f},fps={FPS},scale=-2:{H},pad={W}:{H}:(ow-iw)/2:0:color=0x10141a,setsar=1[p{j}]"); parts.append(f'[p{j}]')
        fc.append(f"{''.join(parts)}concat=n={len(parts)}:v=1:a=0,trim=duration={D:.3f},format=yuv420p[v0]")
    elif k == 'clipcat':     # ('clipcat', src, [(t0, t1), ...], vf_after) pieces of one clip joined, then one move over them
        _, src, pieces, vf = video
        inp += ['-i', src]; parts = []
        for j, (a, b) in enumerate(pieces):
            fc.append(f"[0:v]trim={a}:{b},setpts=PTS-STARTPTS,fps={FPS},setsar=1[c{j}]"); parts.append(f'[c{j}]')
        fc.append(f"{''.join(parts)}concat=n={len(parts)}:v=1:a=0,{vf},scale={W}:{H},trim=duration={D:.3f},setsar=1,format=yuv420p[v0]")
    elif k == 'beforenow':   # old ForeFlight inset (landing clip) | today's ForeFlight frame
        _, land, lt, rec, rt = video
        inp += ['-ss', str(lt), '-t', f'{D:.3f}', '-i', land, '-ss', str(rt), '-t', f'{D:.3f}', '-i', rec]
        fc.append(f"[0:v]crop=290:400:495:320,scale=-2:{H},pad={W//2}:{H}:(ow-iw)/2:0:color=0x10141a,fps={FPS},setsar=1[l];"
                  f"[1:v]crop=1000:1125:760:280,scale={W//2}:{H},fps={FPS},setsar=1[r];[l][r]hstack=2,format=yuv420p[v0]")
    elif k == 'montage':   # ('montage', [(img, cx, cy), ...]) stills crossfading one to the next, each with a gentle push-in
        _, imgs = video; xf = 0.4; n = len(imgs); d1 = (D + (n - 1) * xf) / n
        for j, (img, cx, cy) in enumerate(imgs):
            inp += ['-loop', '1', '-framerate', str(FPS), '-t', f'{d1:.3f}', '-i', img]
            fc.append(f"[{j}:v]{KB(d1, 1.0, 1.06, cx, cy)},setsar=1,format=yuv420p[m{j}]")
        last_m = 'm0'
        for j in range(1, n):
            fc.append(f"[{last_m}][m{j}]xfade=transition=fade:duration={xf}:offset={j * (d1 - xf):.3f}[x{j}]"); last_m = f'x{j}'
        fc.append(f"[{last_m}]trim=duration={D:.3f},format=yuv420p[v0]")
    elif k == 'split':   # real clip left, placeholder right
        _, src, ss, ph = video
        inp += ['-ss', str(ss), '-t', f'{D:.3f}', '-i', src, '-loop', '1', '-t', f'{D:.3f}', '-i', ph]
        fc.append(f"[0:v]scale=-2:{H},crop={W//2}:{H},fps={FPS},setsar=1[l];[1:v]scale={W}:{H},crop={W//2}:{H}:{W//4}:0,fps={FPS},setsar=1[r];[l][r]hstack=2,format=yuv420p[v0]")
    n = len(inp) // 2 if k != 'clip' else 1
    n = sum(1 for a in inp if a == '-i')
    last = 'v0'
    for j, (png, a, b) in enumerate(overlays):
        inp += ['-loop', '1', '-framerate', str(FPS), '-t', f'{D:.3f}', '-i', str(png)]
        fo = f"fade=t=in:st={a}:d=0.4:alpha=1,fade=t=out:st={b - 0.4}:d=0.4:alpha=1"
        fc.append(f"[{n + j}:v]format=rgba,{fo}[o{j}];[{last}][o{j}]overlay=0:0:format=auto[w{j}]"); last = f'w{j}'
    na = n + len(overlays)
    aparts = []
    if natural:
        src, ss, g = natural
        inp += ['-ss', str(ss), '-t', f'{D:.3f}', '-i', src]
        fc.append(f"[{na}:a]aresample=48000,aformat=channel_layouts=stereo,volume={g}dB,afade=t=in:d=0.3,afade=t=out:st={max(0, D - 0.5)}:d=0.5[nat]"); aparts.append('[nat]'); na += 1
    if vo:
        inp += ['-ss', f'{vo_ss:.3f}', '-i', str(VO / f'{vo}.m4a')]
        ms = int(vo_at * 1000)
        fc.append(f"[{na}:a]aresample=48000,aformat=channel_layouts=stereo,adelay={ms}|{ms}[vo]"); aparts.append('[vo]'); na += 1
    inp += ['-f', 'lavfi', '-t', f'{D:.3f}', '-i', 'anullsrc=r=48000:cl=stereo']
    aparts.append(f'[{na}:a]')
    fc.append(f"{''.join(aparts)}amix=inputs={len(aparts)}:duration=longest:normalize=0,atrim=duration={D:.3f}[a]")
    out = SEG / f'{i:02d}.mp4'
    ff([*inp, '-filter_complex', ';'.join(fc), '-map', f'[{last}]', '-map', '[a]', '-t', f'{D:.3f}', '-r', str(FPS),
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', str(out)])
    return out

def plan():
    L = 0.4   # lead before the VO on non-capture segments
    P = []
    P.append(dict(D=8.6, video=('clip', LAND, 131.0, ''), natural=(LAND, 131.0, -3), tag='cold open: real final, rwy 34', music=False))
    d = vod('s1-a'); P.append(dict(D=d + L + 0.3, video=('split', LAND, 131.0, str(G / 'ph-xsqa-final.png')), vo='s1-a', vo_at=L, overlays=[(G / 'to-xsqa.png', 0.4, d + L)], tag='s1-a split'))
    d = vod('s1-b'); P.append(dict(D=d + L + 0.6, video=('still', PH['sunset'], 1.0, 1.10, 0.5, 0.6), vo='s1-b', vo_at=L, overlays=[(G / 'title.png', 0.3, d + L + 0.6)], tag='s1-b title'))
    d = vod('s1-c'); D = d + L + 0.3   # cockpit only: the landing video cuts to a full-screen map at ~0:10 and back at ~0:18
    P.append(dict(D=D, video=('clipcat', LAND, [(0.4, 9.7), (19.6, 19.6 + D - 9.3)], f"zoompan=z='1+0.75*in/{int(D*FPS)}':x='iw*0.5-iw/zoom/2':y='ih*0.73-ih/zoom/2':d=1:s=1280x720:fps={FPS}"), vo='s1-c', vo_at=L, tag='s1-c ForeFlight PiP'))
    d = vod('s1-d'); D = d + L + 0.4
    RA, RB = CAP / 'robrc-a.mp4', CAP / 'robrc-b.mp4'
    cuts = [0, 2.6, 10.0, 12.6, 17.2, D]   # mission | clinic montage | posada and mountain | robrc search | robrc row
    shots = [('still', PH['mission'], 1.0, 1.08, 0.5, 0.45),
             ('montage', [(PH['gil'], 0.5, 0.55), (PH['eric'], 0.45, 0.45), (PH['aimee'], 0.5, 0.22), (PH['clinic'], 0.5, 0.5)]),
             ('still', PH['mountain'], 1.0, 1.06, 0.5, 0.45), ('cap', RA, ''), ('cap', RB, '')]
    names = ['mission', 'clinic montage', 'posada and mountain', 'robrc.net search', 'robrc.net SQA row']
    for j in range(5):
        a, b = cuts[j], cuts[j + 1]
        ov = [(G / 'cap-robrc.png', 0.2 if j == 3 else 0.0, b - a + (0.0 if j == 4 else 0.4))] if j >= 3 else []
        P.append(dict(D=b - a, video=shots[j], vo='s1-d', vo_at=max(0, L - a), vo_ss=max(0, a - L), overlays=ov, tag=f's1-d {names[j]}'))
    for n, extra in (('s2-a', []), ('s2-b', [(G / 'to-rcx.png', 0.3, 5.5)]), ('s2-c', [])):
        P.append(dict(D=dur(CAP / f'{n}.mp4'), video=('cap', CAP / f'{n}.mp4', ''), vo=n, overlays=extra, tag=n))
    d = vod('s2-d'); D = d + L + 0.4
    P.append(dict(D=D, video=('seq', FFREC, [(1.1, 5.0, 3.9), (5.0, 5.7, 0.7), (10.4, 16.2, 3.8), (20.6, 26.2, 5.6), (26.5, 26.5 + D - 14.0, D - 14.0)]), vo='s2-d', vo_at=L, tag='s2-d ForeFlight install + layers'))
    d = vod('s2-e'); D = d + L + 0.4
    P.append(dict(D=D, video=('seq', FFREC, [(27.8, 29.5, 3.4), (29.5, 29.5 + D - 3.4, D - 3.4)]), vo='s2-e', vo_at=L, tag='s2-e ForeFlight flight plan'))
    d = vod('s2-f'); P.append(dict(D=d + L + 0.8, video=('beforenow', LAND, 20.0, FFREC, 38.0), vo='s2-f', vo_at=L, overlays=[(G / 'tag-beforenow.png', 0.0, d + L + 1.2)], tag='s2-f before / now'))
    P.append(dict(D=5.8, video=('clip', TAXI, 0.0, ''), natural=(TAXI, 0.0, -6), tag='taxi-out'))
    for n, extra in (('s3-a', [(G / 'to-xsby.png', 2.8, 7.4)]), ('s3-b', []), ('s3-c', []), ('s3-d', []), ('s3-e', []), ('s3-f', [])):
        P.append(dict(D=dur(CAP / f'{n}.mp4'), video=('cap', CAP / f'{n}.mp4', ''), vo=n, overlays=extra, tag=n))
    d = vod('s3-g'); P.append(dict(D=6.0 + d + 0.6, video=('still', str(G / 'ph-xsby-land.png'), 1, 1, .5, .5), vo='s3-g', vo_at=6.0, tag='s3-g PLACEHOLDER (sim)'))
    P.append(dict(D=5.5, video=('split', LAND, 131.5, str(G / 'ph-xsqa-final.png')), natural=(LAND, 131.5, -6), tag='split real/XSQA'))
    D = dur(CAP / 's4-a.mp4'); P.append(dict(D=D, video=('cap', CAP / 's4-a.mp4', f"zoompan=z='1+0.32*in/{int(D*FPS)}':x='iw*0.5-iw/zoom/2':y='ih*0.60-ih/zoom/2':d=1:s={W}x{H}:fps={FPS}"), vo='s4-a', tag='s4-a caution'))
    d = vod('s4-b')
    P.append(dict(D=7.0, video=('clip', TKOF, 0.0, ''), natural=(TKOF, 0.0, -8), vo='s4-b', vo_at=L, tag='s4-b takeoff'))
    P.append(dict(D=d + L - 7.0 + 4.0, video=('still', PH['sunset'], 1.06, 1.0, 0.5, 0.6), overlays=[(G / 'end.png', 0.2, d + L - 7.0 + 4.0)], tag='end card', vo='s4-b', vo_ss=7.0 - L, vo_at=0))
    return P

if __name__ == '__main__':
    P = plan()
    only = set(sys.argv[1:])
    t, segs, marks = 0.0, [], []
    for i, s in enumerate(P):
        args = {k: s[k] for k in ('vo', 'vo_at', 'vo_ss', 'natural', 'overlays') if k in s}
        if not only or str(i) in only:
            render(i, s['D'], s['video'], **args)
        segs.append(SEG / f'{i:02d}.mp4'); marks.append((round(t, 2), s['tag'])); t += s['D']
    (SEG / 'list.txt').write_text(''.join(f"file '{p}'\n" for p in segs))
    json.dump(marks, open('/home/claude/cut/marks.json', 'w'), indent=0)
    ff(['-f', 'concat', '-safe', '0', '-i', str(SEG / 'list.txt'), '-c', 'copy', '/home/claude/cut/body.mp4'])
    T = dur('/home/claude/cut/body.mp4'); m0 = P[0]['D']   # music from the end of the cold open
    # music: loop to length, -27 LUFS bed, ducked by the VO+location sound, fade in/out
    ff(['-stream_loop', '1', '-i', MUSIC, '-t', f'{T - m0:.2f}', '-af', f"loudnorm=I=-27:TP=-3:LRA=11,afade=t=in:d=2,afade=t=out:st={T - m0 - 4:.2f}:d=4,adelay={int(m0*1000)}|{int(m0*1000)},apad", '-t', f'{T:.2f}', '-ar', '48000', '-ac', '2', '/home/claude/cut/music.wav'])
    ff(['-i', '/home/claude/cut/body.mp4', '-i', '/home/claude/cut/music.wav', '-filter_complex',
        "[0:a]asplit=2[v1][v2];[1:a][v1]sidechaincompress=threshold=0.02:ratio=6:attack=40:release=600:makeup=1[m];[v2][m]amix=inputs=2:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11[a]",
        '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '/home/claude/cut/mexican-airstrips-rough-v4.mp4'])
    print('total', round(T, 1), 's'); print('\n'.join(f'{a//60:.0f}:{a%60:04.1f}  {b}' for a, b in marks))

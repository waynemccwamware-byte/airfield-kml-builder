"""Estimate when each word is spoken in a cleaned take: words spread over the speech-active time by length."""
import subprocess, numpy as np, re, json, pathlib
VO = pathlib.Path('/home/claude/airfield-kml-builder/tools/video-intro')
md = (VO / 'vo-script.md').read_text()
TXT = {m.group(1).rsplit('.',1)[0]: ' '.join(m.group(2).split()) for m in re.finditer(r'^### `([^`]+)` — .+?\n\n(.+?)(?=\n\n###|\Z)', md, re.S | re.M)}
def words(name):
    raw = subprocess.run(['ffmpeg','-nostdin','-loglevel','error','-i',str(VO/'vo'/f'{name}.m4a'),'-f','f32le','-ac','1','-ar','16000','-'],capture_output=True).stdout
    x = np.frombuffer(raw, np.float32); hop = 160
    r = 20*np.log10(np.sqrt((x[:len(x)//hop*hop].reshape(-1,hop)**2).mean(1))+1e-9)
    act = r > np.percentile(r, 97) - 30
    # bridge short gaps (<120 ms) inside words
    k=0
    while k < len(act):
        if not act[k]:
            j=k
            while j<len(act) and not act[j]: j+=1
            if j-k < 12 and k>0 and j<len(act): act[k:j]=True
            k=j
        else: k+=1
    t_act = np.flatnonzero(act) * 0.01
    ws = TXT[name].split(); L = np.cumsum([0]+[len(w)+1 for w in ws]); L = L/L[-1]
    n = len(t_act)
    out = [(w, float(t_act[min(n-1,int(L[i]*n))])) for i,w in enumerate(ws)]
    return out, len(x)/16000
if __name__ == '__main__':
    import sys
    for n in sys.argv[1:]:
        ws, d = words(n); print(n, round(d,2), ' '.join(f'{w}@{t:.1f}' for w,t in ws))

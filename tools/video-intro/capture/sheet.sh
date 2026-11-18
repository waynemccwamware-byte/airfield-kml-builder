#!/bin/bash
# sheet.sh clip.mp4 "t1 t2 ..." out.jpg  -> labeled contact sheet, 3 per row
clip=$1; ts=$2; out=$3; rm -f /tmp/zz_*.jpg; i=0
for t in $ts; do ffmpeg -y -v error -ss $t -i $clip -frames:v 1 -vf "scale=640:-1,drawtext=text='$t':x=8:y=8:fontsize=24:fontcolor=white:box=1:boxcolor=black" /tmp/zz_$(printf %02d $i).jpg; i=$((i+1)); done
python3 -c "
from PIL import Image; import glob
fs=sorted(glob.glob('/tmp/zz_*.jpg')); ims=[Image.open(f) for f in fs]; W,H=ims[0].size; c=3; r=(len(ims)+c-1)//c
m=Image.new('RGB',(W*c,H*r),'white'); [m.paste(im,((i%c)*W,(i//c)*H)) for i,im in enumerate(ims)]; m.save('$out')"

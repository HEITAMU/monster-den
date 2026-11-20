import math,wave as waveio,subprocess
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont
ROOT=Path(__file__).resolve().parent
A=ROOT/'assets/resources/audio';RATE=22050

def tone(f,d=.22,vol=.25,decay=12):
 t=np.arange(int(RATE*d))/RATE
 return (vol*(np.sin(2*np.pi*f*t)+.18*np.sin(2*np.pi*f*2.01*t))*np.exp(-decay*t)).astype(np.float32)
def sound(name,data,br='96k'):
 wav=A/(name+'.wav');mp3=A/(name+'.mp3');data=np.tanh(data)
 with waveio.open(str(wav),'wb') as f:
  f.setnchannels(1);f.setsampwidth(2);f.setframerate(RATE);f.writeframes((np.clip(data,-1,1)*32767).astype('<i2').tobytes())
 subprocess.run(['ffmpeg','-loglevel','error','-y','-i',str(wav),'-c:a','libmp3lame','-b:a',br,str(mp3)],check=True);wav.unlink()
sound('rotor',tone(380,.22,.3,13))
for name,notes in [('perfect',[392,493.88,587.33,783.99]),('complete',[196,293.66,392,493.88])]:
 data=np.zeros(int(RATE*1.3),dtype=np.float32)
 for j,f in enumerate(notes):
  q=tone(f,.52,.22,4);start=int(j*.13*RATE);data[start:start+len(q)]+=q
 sound(name,data)
duration=16
music=np.zeros(RATE*duration,dtype=np.float32)
for section,base in enumerate([164.81,146.83,130.81,146.83]):
 t=np.arange(RATE*4)/RATE
 wavesection=(np.sin(2*np.pi*base*t)+.7*np.sin(2*np.pi*base*1.5*t)+.4*np.sin(2*np.pi*base*2*t))*.023
 fade=np.sin(np.pi*np.arange(len(t))/len(t))**.6
 music[section*4*RATE:(section+1)*4*RATE]+=wavesection*fade
for i in range(24):
 pos=int((.2+i*.64)*RATE);q=tone([392,440,493.88,587.33,493.88,392][i%6],.22,.044,9)
 music[pos:pos+len(q)]+=q[:min(len(q),len(music)-pos)]
sound('ambient',music,'64k')
# Creator will generate audio import metadata on opening project.
F=ROOT/'build-templates/wechatgame/share.jpg'; F.parent.mkdir(exist_ok=True,parents=True)
icon=Image.open(ROOT/'icon.png').convert('RGB');base=Image.new('RGB',(800,640),'#0b1c2b');base.paste(icon.resize((530,530)),(135,0))
d=ImageDraw.Draw(base);font='/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc'
try:f=ImageFont.truetype(font,38);s=ImageFont.truetype(font,21)
except:f=ImageFont.load_default();s=ImageFont.load_default()
d.rounded_rectangle((88,532,712,638),20,fill='#163040')
d.text((400,562),'九 印 王 座',font=f,fill='#f9dba3',anchor='mm')
d.text((400,613),'最少步数挑战 · 微信好友同题竞技',font=s,fill='#b7d1d0',anchor='mm')
base.save(F,quality=90)
print('audio',[(f.name,f.stat().st_size) for f in A.glob('*.mp3')]);print('share',F.stat().st_size)

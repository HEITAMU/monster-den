from pathlib import Path
import numpy as np, math, subprocess, os, wave
from PIL import Image,ImageDraw,ImageFont,ImageFilter
P=Path(__file__).resolve().parent
A=P/'assets/resources/audio'; A.mkdir(parents=True,exist_ok=True)
FS=22050
rng=np.random.default_rng(2120)
def note(freq,dur=0.2,volume=.25,decay=8):
 t=np.arange(int(FS*dur))/FS
 # lightly detuned mallet with harmonic decay
 x=np.sin(2*np.pi*freq*t)*np.exp(-decay*t)
 x+=.23*np.sin(2*np.pi*freq*2.012*t)*np.exp(-decay*2*t)
 x+=.10*np.sin(2*np.pi*freq*3.005*t)*np.exp(-decay*2.8*t)
 return (volume*x).astype(np.float32)
def to_mp3(name,x,rate='96k'):
 x=np.asarray(x,dtype=np.float32);x=np.tanh(1.18*x);x=np.clip(x,-1,1)
 tmp=A/(name+'.wav');dst=A/(name+'.mp3')
 with wave.open(str(tmp),'wb') as f:
  f.setnchannels(1);f.setsampwidth(2);f.setframerate(FS);f.writeframes((x*32767).astype('<i2').tobytes())
 subprocess.run(['ffmpeg','-loglevel','error','-y','-i',str(tmp),'-codec:a','libmp3lame','-b:a',rate,str(dst)],check=True)
 tmp.unlink();return dst
x=note(360,.23,.29,12)+np.pad(note(610,.14,.12,18),(0,int(FS*.23)-int(FS*.14)))
to_mp3('rotor',x)
x=np.zeros(int(FS*.92),dtype=np.float32)
for i,f in enumerate([392,493.88,587.33,783.99]):
 y=note(f,.42,.20,5);s=int(i*.11*FS);x[s:s+len(y)]+=y
to_mp3('perfect',x)
x=np.zeros(int(FS*1.4),dtype=np.float32)
for i,f in enumerate([196,293.66,392,493.88,587.33]):
 y=note(f,.7,.18,3);s=int(i*.12*FS);x[s:s+len(y)]+=y
to_mp3('complete',x)
D=20.0; t=np.arange(int(FS*D))/FS
pad=np.zeros_like(t)
chords=[[164.81,196,246.94],[146.83,196,246.94],[130.81,164.81,196],[146.83,185,246.94]]
for ci,chord in enumerate(chords):
 s=int(ci*5*FS); e=int((ci+1)*5*FS);z=t[:e-s]
 fade=np.sin(np.pi*np.linspace(0,1,e-s))**.58
 for j,f in enumerate(chord):
  pad[s:e]+=(np.sin(2*np.pi*f*z+.04*np.sin(2*np.pi*.17*z))+.16*np.sin(2*np.pi*f*2.01*z))*.035*fade
for k in range(28):
 at=int((k*.7+.17)*FS)
 if at>=len(pad):break
 f=[440,392,493.88,329.63,587.33,493.88,392][k%7]
 s=note(f,.23,.044,12)
 pad[at:min(at+len(s),len(pad))]+=s[:min(len(s),len(pad)-at)]
# 1s smooth tail to avoid clicks, music plays at 11% bus volume
fade=np.minimum(1,np.minimum(t/.9,(D-t)/.9));pad*=np.clip(fade,0,1)
to_mp3('ambient',pad,'64k')

FONT='/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc'
if not Path(FONT).exists(): FONT='/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf'
def make_art(size=(800,800),share=False):
 W,H=size
 Y,X=np.mgrid[0:H,0:W]
 radius=np.sqrt(((X-W/2)/(W*.72))**2+((Y-H*.38)/(H*.85))**2)
 grad=np.maximum(0,1-radius)
 noise=np.random.default_rng(77).normal(0,2,(H,W))
 arr=np.zeros((H,W,3),dtype=np.uint8)
 for ch,(lo,hi) in enumerate([(7,38),(20,72),(35,85)]):arr[:,:,ch]=np.clip(lo+(hi-lo)*grad+noise,0,255)
 im=Image.fromarray(arr,'RGB').convert('RGBA');draw=ImageDraw.Draw(im,'RGBA')
 x0=W//2;cy=int(H*.46 if share else H*.48);R=int(min(W,H)*(.29 if share else .335))
 for k in range(4):
  rr=R+k*14;draw.ellipse((x0-rr,cy-rr,x0+rr,cy+rr),outline=(213,171,101,int(100/(k+1))),width=2)
 draw.ellipse((x0-R,cy-R,x0+R,cy+R),fill=(37,78,83,215),outline=(244,206,131,255),width=7)
 draw.ellipse((x0-R+18,cy-R+18,x0+R-18,cy+R-18),outline=(210,182,120,145),width=3)
 # custom crown with five spires, gem in middle
 rr=R*.64; pts=[(x0-rr*.92,cy+rr*.42),(x0-rr*.95,cy-rr*.42),
 (x0-rr*.4,cy-rr*.14),(x0-rr*.10,cy-rr*.85),(x0+rr*.21,cy-rr*.24),
 (x0+rr*.68,cy-rr*.62),(x0+rr*.95,cy+rr*.37)]
 draw.polygon(pts,fill=(236,190,106,255))
 draw.polygon([(x0-rr*.94,cy+rr*.38),(x0+rr*.95,cy+rr*.38),(x0+rr*.85,cy+rr*.63),(x0-rr*.85,cy+rr*.63)],fill=(244,218,147,255))
 for px,py in [pts[1],pts[3],pts[5]]:
  r=rr*.07;draw.ellipse((px-r,py-r,px+r,py+r),fill=(255,237,175,255))
 rr=rr*.13;draw.polygon([(x0,cy-rr),(x0+rr,cy),(x0,cy+rr),(x0-rr,cy)],fill=(83,186,167,255))
 if share:
  title='九 印 王 座';sub='最少步数解密令 · 与好友同场竞技'
  ft=ImageFont.truetype(FONT,55);fs=ImageFont.truetype(FONT,29)
  draw.text((W/2,H*.86),title,fill=(250,217,157),font=ft,anchor='mm')
  draw.text((W/2,H*.94),sub,fill=(210,227,222),font=fs,anchor='mm')
 return im.convert('RGB')
(P/'icon.png').parent.mkdir(exist_ok=True);make_art().save(P/'icon.png',quality=96)
BT=P/'build-templates/wechatgame';BT.mkdir(parents=True,exist_ok=True)
make_art((800,640),True).save(BT/'share.jpg',quality=91)
print('assets',[(p.name,p.stat().st_size) for p in [*A.glob('*.mp3'),P/'icon.png',BT/'share.jpg']])

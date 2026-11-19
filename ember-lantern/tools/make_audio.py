"""Deterministic original layered sound synthesis for game's first vertical slice.
Outputs mastered MP3 game ambience and five separately playable SFX.
No sampled/third-party copyrighted audio is used.
"""
import numpy as np, wave, subprocess, os, tempfile
from pathlib import Path
SR=24000;OUT=Path(__file__).parents[1]/'assets/resources/sound';OUT.mkdir(parents=True,exist_ok=True)
rng=np.random.default_rng(1485)
def write(name,y,rate='64k'):
 y=np.asarray(y,dtype=np.float64); y-=np.mean(y);mx=np.max(np.abs(y));y=np.tanh(y/(max(mx,0.01))*0.88)*.75
 with tempfile.NamedTemporaryFile(suffix='.wav',delete=False) as tmp:
  wav=tmp.name
 with wave.open(wav,'wb') as f:f.setnchannels(1);f.setsampwidth(2);f.setframerate(SR);f.writeframes((y*32767).astype('<i2').tobytes())
 subprocess.run(['ffmpeg','-y','-loglevel','error','-i',wav,'-codec:a','libmp3lame','-b:a',rate,str(OUT/(name+'.mp3'))],check=True)
 os.remove(wav)
def lowpass(x,sz=350):
 return np.convolve(x,np.ones(sz)/sz,'same')
def bell(freq,t,decay=1):
 return (np.sin(2*np.pi*freq*t)+.3*np.sin(2*np.pi*freq*2.001*t)+.2*np.sin(2*np.pi*freq*3.01*t)) * np.exp(-t/decay)
# thirty-second cyclic ambient, warm plucks plus far away storm / wind with no staccato MIDI sound.
T=24;t=np.arange(int(T*SR))/SR;n=len(t)
y=np.zeros(n)
# bass harmonic slow drift
for f in [65.41,98,130.81]:
 y+=.036*np.sin(2*np.pi*f*t+0.6*np.sin(2*np.pi*.08*t))
# layered air bed, smooth overlapping grains
noise=rng.standard_normal(n)
wind=lowpass(noise,530)
wind=wind/(np.std(wind)+1e-8)
y+=.035*wind*(.58+.42*np.sin(2*np.pi*t/11)**2)
# distant shimmer; tones intentionally sparse
notes=[261.63,392,349.23,523.25,293.66,440,392,261.63,329.63,392,349.23,293.66]
for j,f in enumerate(notes):
 st=j*2.0+.2;dur=1.7
 ti=np.arange(int(dur*SR))/SR
 env=(1-np.exp(-ti*45))*np.exp(-ti/0.7)
 p=(np.sin(2*np.pi*f*ti)+.19*np.sin(2*np.pi*(2*f+.7)*ti)+.12*np.sin(2*np.pi*(f/2)*ti))*env
 off=int(st*SR);end=min(n,off+len(p));y[off:end]+=.105*p[:end-off]
# rustle / droplets
for j in range(130):
 off=int(rng.uniform(.1,T-.3)*SR);l=int(rng.uniform(.03,.14)*SR)
 ti=np.arange(l)/SR
 f=rng.uniform(1500,3300)
 z=(np.sin(2*np.pi*(f+80*ti)*ti)*np.exp(-ti*40)*rng.uniform(.005,.018))
 y[off:off+l]+=z
# smooth fade to ensure mostly seamless loop
fade=int(.6*SR)
y[:fade]*=np.linspace(0,1,fade)
y[-fade:]*=np.linspace(1,0,fade)
write('forest-ambient',y,'72k')
# SFX composed from non-harmonic layers with tails, vibrato and noise accents.
L=int(SR*1.0);ti=np.arange(L)/SR
whoosh=lowpass(rng.standard_normal(L),21);whoosh/=np.max(abs(whoosh));
# Pulse: ignition, swish, deep impact, floating chime tail
pulse=(.3*np.sin(2*np.pi*(220*ti+145*ti*ti))+.29*np.sin(2*np.pi*(76*ti-14*ti*ti))) * (1-np.exp(-ti*32))*np.exp(-ti*4)
pulse+=.4*whoosh*np.sin(np.pi*np.clip(ti/.38,0,1))**2*np.exp(-ti*3)
pulse+=.12*bell(783.99,ti,0.75)
write('pulse',pulse,'56k')
# Collect: two delicate overtones with warm transient
write('pickup',.55*bell(620,ti,0.24)+.35*bell(931,ti,0.33)*np.clip(ti*12,0,1),'48k')
# Dash: airy sweep
write('dash',.34*whoosh*(1-np.exp(-ti*45))*np.exp(-ti*5)+.12*np.sin(2*np.pi*(340*ti+420*ti*ti))*np.exp(-ti*8),'48k')
# Enemy hit: woody crack and dark ring
write('hit',.33*np.sin(2*np.pi*(130*ti-45*ti*ti))*np.exp(-ti*11)+.26*whoosh*np.exp(-ti*16),'48k')
# Portal: ascending 3-voice bell
portal=.12*bell(261.63,ti,1)+.14*bell(392,ti-.13,1)*(ti>.13)+.12*bell(659.25,ti-.24,1)*(ti>.24)
write('portal',portal,'48k')
# Damage hurt: ghost rustle/low thud
write('hurt',.35*whoosh*np.exp(-ti*8)+.18*np.sin(2*np.pi*(90*ti-26*ti*ti))*np.exp(-ti*8),'48k')
for p in OUT.iterdir():print(p.name,round(p.stat().st_size/1024,1),'KB')

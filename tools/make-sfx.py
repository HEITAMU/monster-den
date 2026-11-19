#!/usr/bin/env python3
"""Original material sound design. Deterministic 48 kHz stereo masters -> MP3.

No downloaded/recorded samples. Modal bodies, filtered transients, friction,
micro-impacts and short room reflections are composed separately per material.
Rebuild: python tools/make-sfx.py (NumPy, SciPy, FFmpeg required).
"""
from pathlib import Path
import hashlib, json, math, subprocess
import numpy as np
from scipy import signal
from scipy.io import wavfile

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/sound'
MASTER=ROOT/'.build/audio-masters/sfx'
SR=48000

def noise(rng,n,lo=100,hi=12000):
    x=rng.standard_normal(n)
    if lo and hi: sos=signal.butter(2,[lo,hi],btype='bandpass',fs=SR,output='sos')
    else: sos=signal.butter(2,hi,btype='lowpass',fs=SR,output='sos')
    return signal.sosfilt(sos,x)

def env(t,attack=.001,decay=.15):
    return np.minimum(1,t/max(.0001,attack))*np.exp(-t/decay)

def modal(t,freqs,gains,decays,rng):
    x=np.zeros_like(t)
    for f,g,d in zip(freqs,gains,decays):
        x+=g*np.sin(2*np.pi*f*t)*env(t,.0008,d)
    return x

def add(dst,src,at):
    k=int(at*SR);n=min(len(src),len(dst)-k)
    if n>0: dst[k:k+n]+=src[:n]

def body(rng,length,freqs,gains,decays):
    t=np.arange(int(length*SR))/SR
    return modal(t,freqs,gains,decays,rng)

DURATIONS={'launch':.55,'stone_hit':.62,'wood_hit':.43,'wood_break':1.05,
 'cabinet_push':1.12,'enemy_hit':.45,'enemy_down':.9,'arrow':.38,
 'arrow_blocked':.61,'loot':1.2,'danger':.7,'click':.13,'tool':.58}
VARIANTS={k:(3 if k in ['stone_hit','wood_hit','wood_break','cabinet_push','enemy_hit','arrow_blocked'] else 2) for k in DURATIONS}

def design(cue,variant):
    seed=int(hashlib.sha256(f'monster-den-sfx-2:{cue}:{variant}'.encode()).hexdigest()[:8],16)
    rng=np.random.default_rng(seed)
    t=np.arange(int(DURATIONS[cue]*SR))/SR;x=np.zeros_like(t)
    pitch=1+rng.uniform(-.06,.06)
    if cue=='stone_hit':
        x=modal(t,np.array([82,137,238,411,729])*pitch,[.66,.39,.24,.12,.055],[.10,.075,.055,.045,.025],rng)
        x+=noise(rng,len(t),250,7000)*env(t,.0003,.008)*.82
        for k in [.045,.086,.144]: add(x,body(rng,.18,[440*pitch,963*pitch],[.08,.025],[.021,.012]),k+rng.uniform(-.008,.008))
    elif cue in ['wood_hit','wood_break']:
        x=modal(t,np.array([143,334,602,1042])*pitch,[.62,.38,.15,.07],[.075,.04,.025,.018],rng)
        x+=noise(rng,len(t),700,8400)*env(t,.0002,.007)*.5
        if cue=='wood_break':
            for j,at in enumerate([.017,.039,.068,.11,.165,.245,.34,.47,.64]):
                q=np.arange(int(.21*SR))/SR
                crack=noise(rng,len(q),430,10500)*env(q,.0003,.009+.004*j)*(.65/(1+j*.32))
                crack+=modal(q,np.array([180,405,817])*rng.uniform(.65,1.4),[.15,.09,.035],[.04,.024,.02],rng)
                add(x,crack,at+rng.uniform(-.006,.006))
            x+=noise(rng,len(t),1300,7500)*env(t,.08,.18)*.07
    elif cue=='cabinet_push':
        friction=noise(rng,len(t),55,1000)
        envelope=np.sin(np.pi*np.minimum(1,t/.96))**.65
        x=friction*envelope*(.26+.07*np.sin(2*np.pi*27*t))
        phase=2*np.pi*(320*t+80*t*t)
        x+=(np.sin(phase)+.22*np.sin(phase*2.03))*envelope*.046
        for at in [0,.13,.27,.43,.61,.78]:
            add(x,body(rng,.16,np.array([104,227,517])*pitch,[.26,.10,.035],[.043,.027,.018]),at)
        q=np.arange(int(.18*SR))/SR
        add(x,noise(rng,len(q),1800,9000)*env(q,.001,.013)*.12,.88)
    elif cue in ['enemy_hit','danger','enemy_down']:
        x=modal(t,np.array([63,112,181])*pitch,[.65,.38,.13],[.083,.05,.035],rng)
        x+=noise(rng,len(t),350,5800)*env(t,.001,.014)*.46
        x+=noise(rng,len(t),150,1500)*env(t,.012,.072)*.18
        if cue=='danger':
            x+=modal(t,[139,147,219],[.11,.08,.045],[.24,.22,.16],rng)
            x+=np.sin(2*np.pi*(110*t-35*t*t))*env(t,.008,.16)*.16
        if cue=='enemy_down':
            for at,f,amp in [(.13,95,.22),(.32,170,.1),(.47,320,.05)]:
                add(x,body(rng,.28,[f,f*2.32],[amp,amp*.3],[.08,.03]),at)
    elif cue=='launch':
        phase=2*np.pi*(590*t-450*t*t)
        x=(np.sin(phase)+.25*np.sin(phase*2))*env(t,.002,.048)*.17
        x+=noise(rng,len(t),800,9500)*np.exp(-((t-.095)/.065)**2)*.24
        x+=modal(t,[115,238],[.32,.085],[.052,.025],rng)
        x+=noise(rng,len(t),80,900)*env(t,.02,.075)*.12
    elif cue=='arrow':
        x=np.sin(2*np.pi*(900*t-970*t*t))*env(t,.001,.018)*.055
        x+=noise(rng,len(t),1400,12500)*np.exp(-((t-.08)/.037)**2)*.18
        x+=modal(t,[210*pitch,517*pitch],[.13,.04],[.024,.013],rng)
    elif cue=='arrow_blocked':
        x=modal(t,np.array([237,547,1217,2879])*pitch,[.28,.14,.085,.025],[.07,.05,.09,.035],rng)
        x+=noise(rng,len(t),700,11000)*env(t,.0005,.009)*.3
        add(x,body(rng,.25,[380*pitch,793*pitch],[.075,.025],[.055,.03]),.11)
    elif cue=='loot':
        # Coin impacts plus a three-note Dorian reward motif, not a shrill alarm.
        for at,midi,amp in [(0,74,.21),(.085,78,.17),(.18,81,.18),(.32,86,.09)]:
            f=440*2**((midi-69)/12);q=np.arange(int(.75*SR))/SR
            bell=modal(q,[f,f*2.756,f*5.404],[amp,amp*.19,amp*.035],[.19,.095,.04],rng)
            bell+=noise(rng,len(q),2800,8500)*env(q,.0002,.003)*.025
            add(x,bell,at)
    elif cue=='click':
        x=modal(t,[420*pitch,1049*pitch],[.19,.035],[.013,.008],rng)
        x+=noise(rng,len(t),900,6500)*env(t,.0003,.0025)*.14
    elif cue=='tool':
        x=modal(t,np.array([186,402,983])*pitch,[.24,.12,.06],[.07,.08,.12],rng)
        for at in [.055,.125]: add(x,body(rng,.3,[612*pitch,1441*pitch],[.07,.03],[.065,.035]),at)
        x+=noise(rng,len(t),700,5400)*np.exp(-((t-.13)/.08)**2)*.055
    # Short, asymmetric room reflections preserve source definition and mono compatibility.
    wet=signal.sosfilt(signal.butter(1,4800,fs=SR,output='sos'),x)
    left=x.copy();right=x.copy()
    for delay,gain in [(.023,.095),(.057,.045),(.093,.025)]: add(left,wet*gain,delay)
    for delay,gain in [(.031,.087),(.066,.04),(.104,.022)]: add(right,wet*gain,delay)
    stereo=np.stack([left,right],axis=-1)
    stereo=signal.sosfilt(signal.butter(2,35,btype='highpass',fs=SR,output='sos'),stereo,axis=0)
    # Loudest transient remains below -4 dBFS; all variants share equal perceived event weight.
    peak=np.max(np.abs(stereo));target={'click':.25,'arrow':.34,'loot':.48}.get(cue,.60)
    stereo*=target/max(peak,1e-7)
    n=min(360,len(stereo)//4);stereo[:48]*=np.linspace(0,1,48)[:,None];stereo[-n:]*=np.linspace(1,0,n)[:,None]
    return stereo

def main():
    OUT.mkdir(parents=True,exist_ok=True);MASTER.mkdir(parents=True,exist_ok=True)
    manifest={'version':2,'sampleRate':SR,'channels':2,'source':'original procedural material sound design','cues':{}}
    for cue,count in VARIANTS.items():
        items=[]
        for variant in range(count):
            samples=design(cue,variant);name=f'{cue}-{variant+1}';wav=MASTER/(name+'.wav');mp3=OUT/(name+'.mp3')
            wavfile.write(wav,SR,np.round(np.clip(samples,-1,1)*32767).astype(np.int16))
            subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(wav),'-codec:a','libmp3lame','-q:a','3','-ar','44100',str(mp3)],check=True)
            items.append({'file':mp3.name,'duration':round(len(samples)/SR,4),'peakDbfs':round(20*np.log10(max(np.max(np.abs(samples)),1e-9)),2),'rmsDbfs':round(20*np.log10(max(np.sqrt(np.mean(samples*samples)),1e-9)),2),'bytes':mp3.stat().st_size,'sha256':hashlib.sha256(mp3.read_bytes()).hexdigest()})
        manifest['cues'][cue]=items
    (ROOT/'audio-source').mkdir(exist_ok=True)
    (ROOT/'audio-source/sfx-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print(json.dumps({'cues':len(VARIANTS),'variations':sum(VARIANTS.values()),'mp3Bytes':sum(x['bytes'] for items in manifest['cues'].values() for x in items)}))

if __name__=='__main__': main()

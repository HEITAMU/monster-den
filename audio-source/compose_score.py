#!/usr/bin/env python3
"""Monster Den: an original, editable chamber-adventure score.

This writes hand-authored musical phrases to MIDI, renders GeneralUser GS 2.0.3
with the installed FluidSynth library, wraps reverb tails for exact musical
loops, and makes game-ready stereo MP3s. It does not download or bundle a bank.

Requirements: Python 3 + numpy/scipy, libfluidsynth >=2.3, ffmpeg/ffprobe.
Usage: python audio-source/compose_score.py --soundfont /path/GeneralUser-GS.sf2
"""
from __future__ import annotations
import argparse
import ctypes as C
import ctypes.util
import hashlib
import json
import math
import os
import random
import re
import struct
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
from scipy.io import wavfile

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'audio-source'
# Each long score is its own Cocos Asset Bundle; short musical cues share the
# sound Bundle with material/action effects. Never recreate resources/audio.
OUTPUTS = {
    'music-camp': ROOT / 'assets/music-camp/music-camp.mp3',
    'music-explore': ROOT / 'assets/music-explore/music-explore.mp3',
    'music-boss': ROOT / 'assets/music-boss/music-boss.mp3',
    'win': ROOT / 'assets/sound/win.mp3',
    'lose': ROOT / 'assets/sound/lose.mp3',
}
WORK = ROOT.parent / 'music-work'
RATE = 44100
PPQ = 960
FONT_SHA256 = '9575028c7a1f589f5770fccc8cff2734566af40cd26ed836944e9a5152688cfe'

PITCHES = {'C':0,'D':2,'E':4,'F':5,'G':7,'A':9,'B':11}
def pitch(name):
    if isinstance(name,int): return name
    match=re.fullmatch(r'([A-G])([#b]?)(-?\d+)',name)
    if not match: raise ValueError(name)
    letter,alter,octave=match.groups()
    return (int(octave)+1)*12+PITCHES[letter]+(1 if alter=='#' else -1 if alter=='b' else 0)

@dataclass
class Event:
    beat:float
    kind:str
    channel:int
    a:int
    b:int=0

@dataclass
class Score:
    slug:str
    title:str
    bpm:int
    meter:int
    bars:int
    target_lufs:float
    loop:bool=True
    seed:int=619
    events:list[Event]=field(default_factory=list)
    instruments:dict=field(default_factory=dict)
    sections:list=field(default_factory=list)

    def __post_init__(self):self.rng=random.Random(self.seed)
    @property
    def beats(self):return self.meter*self.bars
    @property
    def seconds(self):return self.beats*60/self.bpm
    def control(self,ch,beat,cc,value):self.events.append(Event(max(0,beat),'cc',ch,cc,int(value)))
    def note(self,ch,beat,key,length,velocity=70,gate=.9,human=True):
        if key in ('R','-'):return
        key=pitch(key)
        # Timing variation is performance nuance; pitches and form are hand-composed.
        offset=self.rng.uniform(-.008,.008)*self.bpm/60 if human else 0
        start=max(0,beat+offset)
        end=min(self.beats-.012,start+max(.04,length*gate))
        if end<=start:return
        vel=max(1,min(120,round(velocity+(self.rng.uniform(-4,4) if human else 0))))
        self.events.extend([Event(start,'on',ch,key,vel),Event(end,'off',ch,key)])
    def chord(self,ch,beat,notes,length,velocity=60,spread=.012,gate=.88):
        for i,note in enumerate(notes):self.note(ch,beat+i*spread,note,length-i*spread,velocity+(1 if i==0 else -2),gate)
    def phrase(self,ch,start_bar,phrases,velocity=72,transpose=0,gate=.91):
        for bar,text in enumerate(phrases):
            local=0
            for token in text.split():
                n,d=token.split(':');d=float(d)
                if n!='R':self.note(ch,(start_bar+bar)*self.meter+local,pitch(n)+transpose,d,velocity+(3 if local==0 else 0),gate)
                local+=d
            if abs(local-self.meter)>.0001:raise ValueError(f'{self.slug} bar {start_bar+bar}: {local} beats != {self.meter}: {text}')
    def setup(self,ch,program,name,volume=76,pan=64,reverb=42,bank=0):
        self.instruments[ch]={'program':program,'bank':bank,'name':name,'volume':volume,'pan':pan,'reverb':reverb}
        # FluidSynth's internal percussion bank 128 is not a legal MIDI data
        # byte. General MIDI drums use channel 10 with bank MSB/LSB 0/0.
        midi_bank=0 if ch==9 and bank==128 else bank
        for cc,value in [(0,(midi_bank>>7)&127),(32,midi_bank&127),(7,volume),(10,pan),(11,100),(91,reverb),(93,0),(64,0)]:self.control(ch,0,cc,value)
        self.events.append(Event(0,'program',ch,program))

# The recurring figure is D–F–E–A, answered by G–E–F–D. All three scores
# develop this figure in different registers, meters, harmonies and orchestration.
CAMP_A=[
 'D5:0.75 R:0.25 F5:0.5 E5:0.5 A5:0.75 R:0.25',
 'G5:1 E5:0.5 F5:0.5 D5:0.75 R:0.25',
 'F5:0.5 G5:0.5 A5:1.25 R:0.25 C6:0.5',
 'B5:0.75 A5:0.25 G5:0.5 E5:1 R:0.5',
 'F5:1 E5:0.5 D5:0.5 C5:0.75 R:0.25',
 'E5:0.5 F5:0.5 G5:0.75 A5:0.25 E5:0.75 R:0.25',
 'F5:0.5 E5:0.5 D5:0.75 R:0.25 C#5:0.5 E5:0.5',
 'A4:1 C#5:0.5 E5:0.5 G5:0.5 R:0.5',
]
CAMP_A2=[
 'R:0.25 D5:0.5 F5:0.25 E5:0.75 A5:0.5 G5:0.5 R:0.25',
 'E5:0.5 F5:0.5 D5:1 R:0.5 A4:0.5',
 'C5:0.5 F5:0.5 A5:0.75 G5:0.25 F5:0.5 R:0.5',
 'G5:0.5 B5:0.5 D6:0.5 B5:0.5 A5:0.5 R:0.5',
 'Bb5:0.75 A5:0.25 F5:0.5 D5:0.75 C5:0.25 R:0.5',
 'D5:0.5 G5:1 F5:0.5 E5:0.5 R:0.5',
 'F5:0.75 E5:0.25 D5:0.5 A4:0.5 E5:0.5 R:0.5',
 'C#5:0.5 E5:0.5 G5:0.75 E5:0.25 A4:0.5 R:0.5',
]
CAMP_B=[
 'A5:1 G5:0.5 F5:0.75 R:0.25 C5:0.5',
 'D5:0.5 F5:0.5 Bb5:1 A5:0.5 R:0.5',
 'G5:0.75 E5:0.25 C6:0.75 B5:0.25 G5:0.5 R:0.5',
 'A5:1 C6:0.5 D6:0.5 A5:0.5 R:0.5',
 'G5:0.5 F5:0.5 D5:1 R:0.5 Bb4:0.5',
 'C5:0.5 E5:0.5 G5:1 E5:0.5 R:0.5',
 'F5:1 A5:0.5 G5:0.5 E5:0.75 R:0.25',
 'C#5:0.75 E5:0.25 A5:0.75 G5:0.25 E5:0.5 R:0.5',
]
THEME4=[
 'D5:0.5 F5:0.5 E5:1 A5:0.75 R:0.25 G5:0.5 E5:0.5',
 'F5:0.75 E5:0.25 D5:1 R:0.5 A4:0.5 C5:0.5 D5:0.5',
 'F5:0.5 A5:0.5 C6:1 B5:0.5 A5:0.5 G5:0.5 R:0.5',
 'E5:1 G5:0.5 F5:0.5 E5:0.75 D5:0.25 C#5:0.5 R:0.5',
 'D5:0.75 A4:0.25 F5:0.5 E5:0.5 G5:1 R:1',
 'A5:0.5 G5:0.5 F5:0.75 E5:0.25 D5:0.5 C5:0.5 A4:0.5 R:0.5',
 'Bb4:0.5 D5:0.5 G5:1 F5:0.5 E5:0.5 D5:0.5 R:0.5',
 'C#5:0.5 E5:0.5 A5:1 G5:0.5 E5:0.5 C#5:0.5 R:0.5',
]
ANSWER4=[
 'A5:0.75 G5:0.25 F5:0.5 E5:0.5 D5:1 R:0.5 F5:0.5',
 'E5:0.5 G5:0.5 C6:0.75 B5:0.25 G5:0.5 E5:0.5 R:1',
 'A5:0.5 C6:0.5 D6:0.75 C6:0.25 A5:1 R:0.5 G5:0.5',
 'B5:1 A5:0.5 G5:0.5 F5:0.5 D5:0.5 R:1',
 'F5:0.5 Bb5:0.5 A5:1 F5:0.5 D5:0.5 C5:0.5 R:0.5',
 'D5:0.5 F5:0.5 G5:1 A5:0.75 G5:0.25 F5:0.5 R:0.5',
 'E5:0.5 D5:0.5 C#5:0.5 E5:0.5 A5:1 G5:0.5 R:0.5',
 'E5:0.75 C#5:0.25 A4:1 R:0.5 C#5:0.5 E5:0.5 R:0.5',
]
DISCOVERY4=[
 'A5:1 C6:0.5 A5:0.5 G5:0.75 F5:0.25 R:1',
 'D5:0.5 F5:0.5 Bb5:1 A5:0.5 F5:0.5 R:1',
 'G5:0.75 E5:0.25 C6:1 B5:0.5 G5:0.5 E5:0.5 R:0.5',
 'A5:0.5 G5:0.5 F5:1 E5:0.5 D5:0.5 R:1',
 'Bb5:0.5 A5:0.5 G5:0.75 F5:0.25 D5:1 R:1',
 'E5:0.5 G5:0.5 C6:0.75 D6:0.25 C6:1 R:1',
 'A5:0.75 F5:0.25 E5:0.5 D5:0.5 F5:0.5 E5:0.5 R:1',
 'C#5:0.5 E5:0.5 G5:1 A5:1 R:1',
]

# Deliberate inversions keep the bass and inner voices moving by small steps.
HARMONY=[
 ('Dm9','D3',['F3','A3','C4','E4']),
 ('Cmaj/E','E3',['G3','C4','E4']),
 ('Fmaj7/A','A2',['E3','A3','C4','F4']),
 ('G7/B','B2',['F3','G3','B3','D4']),
 ('Bbmaj7/D','D3',['F3','A3','Bb3','D4']),
 ('Gm9','G2',['F3','A3','Bb3','D4']),
 ('A7sus','A2',['D3','G3','A3','E4']),
 ('A7','A2',['G3','C#4','E4','A4']),
]
BRIDGE=[
 ('Fmaj7','F2',['A3','C4','E4','F4']),
 ('Bbmaj7','Bb2',['A3','D4','F4']),
 ('Cadd9/E','E3',['G3','C4','D4','E4']),
 ('Dm9/A','A2',['F3','A3','C4','E4']),
 ('Gm9/Bb','Bb2',['F3','G3','A3','D4']),
 ('C7','C3',['G3','Bb3','C4','E4']),
 ('Dm/A','A2',['F3','A3','D4']),
 ('A7b9','A2',['G3','Bb3','C#4','E4']),
]

def instrumentation(score,boss=False):
    configs=[
      (0,60 if boss else 71,'French horn theme' if boss else 'Clarinet theme',86 if boss else 83,55,50),
      (1,57 if boss else 73,'Trombone answer' if boss else 'Flute answer',68 if boss else 74,82,52),
      (2,44 if boss else 24,'Tremolo strings' if boss else 'Nylon guitar',59 if boss else 63,33,42),
      (3,45,'Pizzicato strings',74 if boss else 70,38,40),
      (4,42,'Cello',79 if boss else 72,64,44),
      (5,46,'Concert harp',51,98,55),
      (6,70,'Bassoon',79 if boss else 74,74,45),
      (7,9,'Glockenspiel',42,91,60),
      (8,48,'Chamber string ensemble',61 if boss else 48,76,55),
      (9,0,'Hand percussion and orchestral drums',74 if boss else 56,65,25),
      (10,47 if boss else 60,'Timpani' if boss else 'Warm horn',75 if boss else 48,47,45),
      (11,73,'Flute color',67,80,58),
    ]
    for ch,program,name,volume,pan,rev in configs:score.setup(ch,program,name,volume,pan,rev,128 if ch==9 else 0)

def shape_phrase(score,ch,start,length,peak=105):
    # Wind/string phrases breathe. No endless flat sustain velocities.
    for fraction,value in [(0,88),(.13,96),(.46,peak),(.76,98),(.94,78)]:
        score.control(ch,start+length*fraction,11,value)

def camp():
    s=Score('music-camp','灯下收拾行囊',96,3,32,-19,seed=619)
    instrumentation(s)
    s.sections=[{'bar':0,'name':'A · 木管主题与拨弦问答'},{'bar':8,'name':'A2 · 小兽的脚步，旋律换气与装饰'},
      {'bar':16,'name':'B · 相对大调的营火片段'},{'bar':24,'name':'A3 · 主题回家，属和弦接回循环'}]
    s.phrase(0,0,CAMP_A,69)
    s.phrase(1,8,CAMP_A2,70)
    s.phrase(0,16,CAMP_B,68)
    s.phrase(1,24,CAMP_A,74)
    for bar in range(32):
        start=bar*3
        name,bass,notes=(BRIDGE if 16<=bar<24 else HARMONY)[bar%8]
        shape_phrase(s,0,start,2.8,103);shape_phrase(s,1,start,2.8,106)
        s.note(4,start,bass,1.55,57 if bar<16 else 60,.86)
        # Guitar's gently irregular offbeats replace a mechanical repeating arpeggio.
        s.chord(2,start+1.02,notes[1:],.65,47+(bar%3)*2,spread=.018,gate=.73)
        if bar%4 not in (3,):s.chord(2,start+2.03,notes[:3],.62,43,spread=.021,gate=.72)
        if bar%4==3:s.note(4,start+2.30,pitch(bass)+7,.48,45,.68)
        if bar in (2,6,10,14,18,22,26,30):
            s.note(3,start+.5,pitch(notes[1])+12,.33,54,.65)
            s.note(3,start+2.5,pitch(notes[-1])+12,.33,46,.66)
        elif bar%4==0:
            s.chord(3,start+2,notes[1:],.42,43,spread=.012,gate=.66)
        if 16<=bar<24 or bar>=28:
            s.chord(8,start,[pitch(n) for n in notes[:3]],2.65,43,spread=.025,gate=.95)
        if bar in (3,7,11,15,19,23,27):
            s.note(6,start+1.6,pitch(notes[0])+12,.5,53,.86)
            s.note(6,start+2.3,pitch(notes[1])+12,.5,47,.81)
        if bar in (0,8,16,24):
            s.chord(5,start+.02,[pitch(n)+12 for n in notes],1.4,45,spread=.10,gate=.9)
            s.note(7,start+.03,pitch(notes[-1])+24,.8,37,.93)
        # Sparse hand percussion: woody pulse, never a full pop drum loop.
        if bar>=8 and bar%4!=3:
            s.note(9,start+1,69,.1,28,.7)
            s.note(9,start+2.3,61,.12,27,.8)
        if bar in (15,23):
            for i,note in enumerate([pitch(n)+12 for n in notes[:3]]):s.note(5,start+1.8+i*.28,note,.5,42,.8)
    # The final half-bar breathes before the clarinet's opening pickup returns.
    return s

def explore():
    s=Score('music-explore','柜缝里的月光',112,4,56,-18,seed=621)
    instrumentation(s)
    s.sections=[{'bar':0,'name':'前奏 · 巴松轻声试探'},{'bar':8,'name':'A · 单簧管盗宝主题'},
      {'bar':16,'name':'A2 · 长笛应答与弦乐拨奏'},{'bar':24,'name':'B · 躲在柜后的呼吸'},
      {'bar':32,'name':'C · 宝物露出光芒'},{'bar':40,'name':'A3 · 完整主题与对位'},
      {'bar':48,'name':'回转 · 渐退回前奏的脚步'}]
    intro=[
      'D4:0.5 R:0.5 F4:0.5 E4:0.5 A4:0.5 R:1.5',
      'G4:0.5 E4:0.5 F4:0.5 D4:0.5 R:2',
      'R:1 A4:0.5 C5:0.5 B4:0.5 A4:0.5 R:1',
      'E4:0.75 G4:0.25 F4:0.5 E4:0.5 R:2',
      'D4:0.5 A3:0.5 F4:0.5 E4:0.5 G4:0.75 R:1.25',
      'A4:0.5 G4:0.5 F4:0.5 E4:0.5 D4:0.5 R:1.5',
      'Bb3:0.5 D4:0.5 G4:0.5 R:0.5 E4:0.5 D4:0.5 R:1',
      'C#4:0.5 E4:0.5 A4:1 R:0.5 E4:0.5 C#4:0.5 R:0.5',
    ]
    s.phrase(6,0,intro,69,gate=.76)
    s.phrase(0,8,THEME4,73)
    s.phrase(1,16,ANSWER4,75)
    # A contrasting low-register version leaves room for environmental sounds.
    s.phrase(6,24,ANSWER4,63,transpose=-12,gate=.78)
    s.phrase(1,32,DISCOVERY4,78,gate=.95)
    s.phrase(0,40,THEME4,79)
    s.phrase(6,48,intro,62,gate=.75)
    for bar in range(56):
        start=bar*4;section=bar//8
        name,bass,notes=(BRIDGE if 32<=bar<40 else HARMONY)[bar%8]
        for ch in(0,1,6):shape_phrase(s,ch,start,3.7,108 if section in(4,5) else 101)
        bass_register=pitch(bass)-(12 if section==3 and bar%2 else 0)
        s.note(4,start,bass_register,.76,61 if section!=3 else 52,.75)
        if bar%4!=3:s.note(4,start+2.15,pitch(bass)+7,.58,51,.7)
        elif bar%8!=7:s.note(4,start+3.1,pitch(bass)+2,.46,48,.68)
        patterns=[[(.5,1),(1.25,2),(2.75,0)],[(.5,2),(1.75,1),(3.0,0)],[(.25,0),(1.5,2),(2.5,1),(3.25,2)],[(.5,1),(2.0,0)]]
        for at,index in patterns[bar%4]:
            if section==3 and at>2:continue
            s.note(3,start+at,pitch(notes[index])+12,.34,54+(6 if section==5 else 0),.66)
            if section in(1,2,5) and index==2:s.note(3,start+at,pitch(notes[0]),.30,44,.63)
        if section not in(0,3,6):
            s.chord(2,start+1.05,notes[1:],.70,44,spread=.014,gate=.69)
            if bar%2==0:s.chord(2,start+3.05,notes[:3],.55,39,spread=.020,gate=.72)
        if section in(2,4,5) and bar%2==0:
            s.chord(8,start,[pitch(n) for n in notes[:3]],3.6,43 if section!=5 else 48,spread=.02,gate=.96)
        if bar%8 in(3,7):
            reply=1 if section in(0,1,5,6) else 0
            s.note(reply,start+2.75,pitch(notes[1])+12,.42,52,.84)
            s.note(reply,start+3.25,pitch(notes[-1])+12,.42,45,.79)
        if section==5 and bar%4 in(0,2):
            s.note(1,start+1.5,pitch(notes[-1])+12,.75,55,.93)
            s.note(1,start+2.5,pitch(notes[1])+12,.75,49,.9)
        if bar%8==0:
            s.chord(5,start+.025,[pitch(n)+12 for n in notes],1.8,42+(4 if section==4 else 0),spread=.12,gate=.88)
        if section==4 and bar%2==0:
            s.note(7,start+.08,pitch(notes[-1])+24,.9,38,.9)
        elif bar in(15,31,47):
            for i,note in enumerate([pitch(notes[1])+12,pitch(notes[-1])+12,pitch(notes[0])+24]):
                s.note(5,start+2.5+i*.36,note,.5,42,.82)
        # Bongo/conga and woodblock response, with whole beats and bars of air.
        if section!=3 and bar%8!=7:
            for at,key,velocity in[(0,64,43),(1.5,62,32),(2,61,39),(3.25,60,30)]:
                if section==0 and at>2:continue
                s.note(9,start+at,key,.14,velocity+(4 if section==5 else 0),.8)
            if bar%2:s.note(9,start+2.75,76,.12,26,.8)
        elif section==3 and bar%2==0:s.note(9,start,64,.16,31,.8)
        if bar%8==6:
            for i,key in enumerate([61,60,62]):s.note(9,start+3+i*.28,key,.10,32+i*2,.75)
    return s

def boss():
    s=Score('music-boss','窝主守着最后一盏灯',120,4,48,-17.8,seed=623)
    instrumentation(s,True)
    s.sections=[{'bar':0,'name':'前奏 · 低弦和定音鼓唤醒窝主'},{'bar':4,'name':'A · 圆号宣告盗宝主题'},
      {'bar':16,'name':'应答 · 木管与低铜管错位'},{'bar':24,'name':'桥段 · 收紧的脚步与停顿'},
      {'bar':32,'name':'A2 · 铜管和弦乐完整发展'},{'bar':44,'name':'回转 · 降低密度接回循环'}]
    opening=[
      'D4:0.75 R:0.25 F4:0.5 E4:0.5 A3:1 R:1',
      'G3:0.5 A3:0.5 C4:1 E4:0.75 R:1.25',
      'F4:0.75 A4:0.25 C5:1 A4:1 R:1',
      'C#4:0.5 E4:0.5 A4:1 G4:0.5 E4:0.5 R:1',
    ]
    s.phrase(6,0,opening,72,gate=.83)
    s.phrase(0,4,THEME4,91,transpose=-12,gate=.9)
    s.phrase(0,12,ANSWER4[:4],88,transpose=-12,gate=.86)
    s.phrase(6,16,ANSWER4,83,transpose=-12,gate=.81)
    s.phrase(11,24,DISCOVERY4,76,transpose=-12,gate=.92)
    s.phrase(0,32,THEME4,97,transpose=-12,gate=.9)
    s.phrase(0,40,ANSWER4[:4],92,transpose=-12,gate=.9)
    s.phrase(6,44,opening,67,gate=.78)
    for bar in range(48):
        start=bar*4
        # Two introductory bars on tonic, then an explicit dominant preparation.
        if bar<4 or bar>=44:
            hindex=[0,1,2,7][bar%4]
        elif 24<=bar<32:hindex=(bar-24)%8
        else:hindex=(bar-4)%8
        name,bass,notes=(BRIDGE if 24<=bar<32 else HARMONY)[hindex]
        climax=32<=bar<44;quiet=24<=bar<32 or bar>=44
        level=78 if climax else 66 if not quiet else 52
        for ch in(0,1,6,11):shape_phrase(s,ch,start,3.8,116 if climax else 108)
        # Low bowed figures use accented pairs, breathing gaps and occasional rests.
        pulses=[0,.75,1.5,2,3.0] if bar%2==0 else [0,.5,1.75,2.5,3.25]
        if quiet:pulses=[0,1.5,2.5]
        if bar%8==7:pulses=[0,1.5]
        for i,at in enumerate(pulses):
            key=pitch(bass)+(7 if i==2 and bar%3==0 else 0)
            s.note(4,start+at,key,.43,level+(5 if i==0 else -5),.72)
            if climax and i in(0,3):s.note(3,start+at,key+12,.34,63,.65)
        if not quiet:
            for at,index in[(.5,0),(1.25,1),(2.75,2),(3.5,1)]:
                if bar%8==7 and at>2:continue
                s.note(3,start+at,pitch(notes[index])+12,.32,60 if climax else 51,.66)
        # Sustained ensemble has swells rather than a static synthetic pad.
        if bar%2==0:
            s.chord(8,start,[pitch(n)+12 for n in notes[:3]],3.65,55 if climax else 43,spread=.025,gate=.96)
            shape_phrase(s,8,start,3.8,114 if climax else 100)
        if bar in(3,11,23,31,43,47):
            s.chord(2,start,notes[1:],2.5,55 if bar!=47 else 42,spread=.02,gate=.94)
            shape_phrase(s,2,start,2.8,112)
        if 4<=bar<24 or climax:
            # Low brass answers at the end of the horn's phrases, not incessant unison.
            if bar%4 in(1,3):
                s.chord(1,start+2.15,[pitch(notes[0])-12,pitch(notes[1])-12],.72,66 if climax else 56,spread=.012,gate=.83)
                if bar%4==3:s.note(1,start+3.2,pitch(bass)+12,.55,63 if climax else 53,.8)
        if climax and bar%4==2:
            s.note(11,start+1.5,pitch(notes[-1])+12,.75,68,.92)
            s.note(11,start+2.5,pitch(notes[1])+12,.75,59,.91)
        if bar in(0,4,16,24,32,40,44):
            s.chord(5,start+.02,[pitch(n)+12 for n in notes],1.3,46,spread=.095,gate=.88)
        if bar in(4,32,40):s.note(7,start+.06,pitch(notes[-1])+24,.9,42,.9)
        # Timpani follows harmonic roots. Hand drums preserve the wooden world.
        if bar%4!=3:
            s.note(10,start,pitch(bass)-12,.9,74 if climax else 59,.84)
            if not quiet:s.note(10,start+2.5,pitch(bass)-5,.6,53,.75)
        if not quiet:
            drum_pattern=[(0,36,61),(1,64,46),(1.75,45,37),(2,41,54),(3,61,45),(3.5,43,39)]
            for at,key,velocity in drum_pattern:
                if bar%8==7 and at>2:continue
                s.note(9,start+at,key,.15,velocity+(7 if climax else 0),.8)
            if bar in(4,16,32,40):s.note(9,start,49,1.2,48 if not climax else 55,.9)
        elif bar%2==0:
            s.note(9,start,64,.2,38,.8);s.note(9,start+2.5,61,.14,31,.8)
        if bar in(3,15,23,31,43):
            for i,key in enumerate([45,47,48,43]):s.note(9,start+2.5+i*.3,key,.12,42+i*4,.78)
    return s

def stinger(win):
    # 4.5 s victory and 2.5 s defeat, including the musical release area.
    s=Score('win' if win else 'lose','偷得满怀星光' if win else '先退一步',120,3 if win else 5,3 if win else 1,-17.5 if win else -20,loop=False,seed=627 if win else 629)
    instrumentation(s,True)
    if win:
        for beat,note,dur in[(0,'D5',.45),(.5,'F5',.35),(1,'E5',.45),(1.5,'A5',.7),(2.5,'G5',.4),(3,'F#5',.45),(3.5,'A5',.45),(4,'D6',2.2)]:
            s.note(11,beat,note,dur,88,.93);s.note(0,beat,pitch(note)-12,dur,88,.9)
        s.chord(8,0,['D3','A3','C4','F4'],2.2,67,.022,.93)
        s.chord(8,4,['D3','A3','D4','F#4','A4'],3.5,79,.027,.95)
        s.chord(1,4,['D3','A3','F#4'],2.8,72,.02,.93)
        s.note(10,4,'D2',1.8,80,.85);s.note(9,4,49,1.4,56,.9)
        for i,n in enumerate(['D4','F#4','A4','D5','F#5','A5','D6']):s.note(5,3.55+i*.12,n,1.1,63,.94)
        for beat,n in[(0,'D6'),(1.5,'A6'),(4,'D7')]:s.note(7,beat,n,1,52,.9)
    else:
        for beat,note,dur in[(0,'A4',.55),(.6,'G4',.45),(1.1,'E4',.55),(1.8,'D4',1.5)]:
            s.note(6,beat,note,dur,70,.92)
        s.chord(8,0,['A2','E3','G3','C#4'],1.45,47,.02,.91)
        s.chord(8,1.8,['D2','A2','D3','F3'],2.1,52,.025,.94)
        s.note(4,1.8,'D2',2,65,.92)
        s.note(9,.02,77,.13,34,.8)
    s.sections=[{'bar':0,'name':'主题终止式；非循环短提示'}]
    return s

def vlq(value):
    value=int(value);result=[value&127];value>>=7
    while value:result.insert(0,(value&127)|128);value>>=7
    return bytes(result)

def meta(kind,text):
    value=text.encode('utf-8') if isinstance(text,str) else text
    return bytes([0xff,kind])+vlq(len(value))+value

def write_midi(score,path):
    tempo=round(60000000/score.bpm)
    conductor=[(0,meta(3,score.title)),(0,meta(0x51,tempo.to_bytes(3,'big'))),
      (0,meta(0x58,bytes([score.meter,2,24,8]))),(0,meta(6,'LOOP_START' if score.loop else 'START'))]
    for section in score.sections:conductor.append((section['bar']*score.meter*PPQ,meta(6,section['name'])))
    conductor.append((score.beats*PPQ,meta(6,'LOOP_END' if score.loop else 'END')))
    tracks=[]
    def pack(items):
        items.sort(key=lambda p:p[0]);last=0;blob=b''
        for tick,data in items:
            tick=round(tick);blob+=vlq(tick-last)+data;last=tick
        blob+=vlq(max(0,round(score.beats*PPQ)-last))+b'\xff\x2f\x00'
        return b'MTrk'+struct.pack('>I',len(blob))+blob
    tracks.append(pack(conductor))
    for channel,instrument in sorted(score.instruments.items()):
        items=[(0,meta(3,instrument['name']))]
        for ev in sorted(score.events,key=lambda e:(e.beat,{'off':0,'cc':1,'program':2,'on':3}[e.kind])):
            if ev.channel!=channel:continue
            if not 0<=ev.a<128 or not 0<=ev.b<128:
                raise ValueError(f'Illegal MIDI data byte: {ev}')
            data=bytes([0x90+channel,ev.a,ev.b]) if ev.kind=='on' else bytes([0x80+channel,ev.a,0]) if ev.kind=='off' else bytes([0xb0+channel,ev.a,ev.b]) if ev.kind=='cc' else bytes([0xc0+channel,ev.a])
            items.append((ev.beat*PPQ,data))
        tracks.append(pack(items))
    path.write_bytes(b'MThd'+struct.pack('>IHHH',6,1,len(tracks),PPQ)+b''.join(tracks))

class FluidRenderer:
    def __init__(self,font):
        self.lib=C.CDLL(ctypes.util.find_library('fluidsynth') or 'libfluidsynth.so.3')
        declarations={
          'new_fluid_settings':([],C.c_void_p),'delete_fluid_settings':([C.c_void_p],None),
          'fluid_settings_setnum':([C.c_void_p,C.c_char_p,C.c_double],C.c_int),
          'fluid_settings_setint':([C.c_void_p,C.c_char_p,C.c_int],C.c_int),
          'new_fluid_synth':([C.c_void_p],C.c_void_p),'delete_fluid_synth':([C.c_void_p],None),
          'fluid_synth_sfload':([C.c_void_p,C.c_char_p,C.c_int],C.c_int),
          'fluid_synth_program_select':([C.c_void_p,C.c_int,C.c_int,C.c_int,C.c_int],C.c_int),
          'fluid_synth_noteon':([C.c_void_p,C.c_int,C.c_int,C.c_int],C.c_int),
          'fluid_synth_noteoff':([C.c_void_p,C.c_int,C.c_int],C.c_int),
          'fluid_synth_cc':([C.c_void_p,C.c_int,C.c_int,C.c_int],C.c_int),
          'fluid_synth_write_float':([C.c_void_p,C.c_int,C.c_void_p,C.c_int,C.c_int,C.c_void_p,C.c_int,C.c_int],C.c_int),
          'fluid_synth_set_interp_method':([C.c_void_p,C.c_int,C.c_int],C.c_int),
          'fluid_version_str':([],C.c_char_p),
        }
        for name,(args,result) in declarations.items():
            fn=getattr(self.lib,name);fn.argtypes=args;fn.restype=result
        self.version=self.lib.fluid_version_str().decode()
        self.settings=self.lib.new_fluid_settings()
        for key,value in [('synth.sample-rate',RATE),('synth.gain',.58),('synth.reverb.room-size',.52),
          ('synth.reverb.damp',.36),('synth.reverb.width',.82),('synth.reverb.level',.18)]:
            self.lib.fluid_settings_setnum(self.settings,key.encode(),value)
        for key,value in [('synth.reverb.active',1),('synth.chorus.active',0),('synth.polyphony',256),('synth.cpu-cores',1)]:
            self.lib.fluid_settings_setint(self.settings,key.encode(),value)
        self.synth=self.lib.new_fluid_synth(self.settings)
        self.sfid=self.lib.fluid_synth_sfload(self.synth,os.fsencode(font),1)
        if self.sfid<0:raise RuntimeError('FluidSynth could not load the verified SoundFont.')
        self.lib.fluid_synth_set_interp_method(self.synth,-1,7)
    def close(self):
        self.lib.delete_fluid_synth(self.synth);self.lib.delete_fluid_settings(self.settings)
    def render(self,score):
        for ch,instrument in score.instruments.items():
            result=self.lib.fluid_synth_program_select(self.synth,ch,self.sfid,instrument['bank'],instrument['program'])
            if result<0:raise RuntimeError(f'Missing authorized preset: {instrument}')
        frames=round(score.seconds*RATE)
        tail=round((5.0 if score.loop else .6)*RATE)
        output=np.zeros((frames+tail,2),np.float32)
        schedule=sorted([(round(ev.beat*60/score.bpm*RATE),ev) for ev in score.events],key=lambda x:(x[0],{'off':0,'cc':1,'program':2,'on':3}[x[1].kind]))
        cursor=0
        def render_until(target):
            nonlocal cursor
            target=min(target,len(output))
            while cursor<target:
                count=min(8192,target-cursor)
                ptr=C.c_void_p(output.ctypes.data+cursor*8)
                result=self.lib.fluid_synth_write_float(self.synth,count,ptr,0,2,ptr,1,2)
                if result<0:raise RuntimeError('FluidSynth render failed.')
                cursor+=count
        for sample,ev in schedule:
            render_until(sample)
            if ev.kind=='on':self.lib.fluid_synth_noteon(self.synth,ev.channel,ev.a,ev.b)
            elif ev.kind=='off':self.lib.fluid_synth_noteoff(self.synth,ev.channel,ev.a)
            elif ev.kind=='cc':
                # Preset bank selection is explicit above; CC0 would reinterpret GM drums.
                if ev.a!=0:self.lib.fluid_synth_cc(self.synth,ev.channel,ev.a,ev.b)
        render_until(len(output))
        if score.loop:
            # Linear tail folding makes the final sample continue into the opening
            # reverb, without shortening a bar or fading to silence at the boundary.
            result=output[:frames].copy()
            folded=output[frames:]
            fade=min(len(folded),round(.3*RATE))
            folded[-fade:]*=np.linspace(1,0,fade,dtype=np.float32)[:,None]
            result[:len(folded)]+=folded
        else:
            result=output[:frames].copy()
            fade=round(.55*RATE)
            result[-fade:]*=np.linspace(1,0,fade,dtype=np.float32)[:,None]**1.4
        return result

def run(command):
    result=subprocess.run(command,text=True,capture_output=True)
    if result.returncode:raise RuntimeError(' '.join(map(str,command))+'\n'+result.stderr[-6000:])
    return result

def loudness(path,target):
    result=run(['ffmpeg','-hide_banner','-nostdin','-i',str(path),'-af',f'loudnorm=I={target}:TP=-1.5:LRA=12:print_format=json','-f','null','-'])
    matches=re.findall(r'\{\s*"input_i"[\s\S]*?\}',result.stderr)
    if not matches:raise RuntimeError(result.stderr[-2000:])
    return json.loads(matches[-1])

def encode_and_measure(score,rawpath,masterpath,mp3path):
    # A gentle high-pass removes subsonic room noise; orchestral dynamics remain.
    filtered=WORK/f'{score.slug}-filtered.wav'
    run(['ffmpeg','-y','-hide_banner','-nostdin','-i',str(rawpath),'-af','highpass=f=38,lowpass=f=17500',
         '-c:a','pcm_f32le',str(filtered)])
    measured=loudness(filtered,score.target_lufs)
    norm=(f'loudnorm=I={score.target_lufs}:TP=-1.5:LRA=12:measured_I={measured["input_i"]}:'
      f'measured_TP={measured["input_tp"]}:measured_LRA={measured["input_lra"]}:'
      f'measured_thresh={measured["input_thresh"]}:offset={measured["target_offset"]}:linear=true:print_format=json')
    run(['ffmpeg','-y','-hide_banner','-nostdin','-i',str(filtered),'-af',norm,'-ar',str(RATE),'-c:a','pcm_s24le',str(masterpath)])
    run(['ffmpeg','-y','-hide_banner','-nostdin','-i',str(masterpath),'-c:a','libmp3lame','-b:a','128k','-joint_stereo','1',
         '-write_xing','1','-id3v2_version','3','-metadata',f'title={score.title}','-metadata','artist=Monster Den original score',str(mp3path)])
    decoded=WORK/f'{score.slug}-decoded.wav'
    run(['ffmpeg','-y','-hide_banner','-nostdin','-i',str(mp3path),'-c:a','pcm_f32le','-ar',str(RATE),str(decoded)])
    rate,audio=wavfile.read(decoded)
    level=loudness(mp3path,score.target_lufs)
    peak=float(np.max(np.abs(audio)))
    edge=float(np.max(np.abs(audio[0]-audio[-1]))) if score.loop else None
    rms_edges=[float(np.sqrt(np.mean(audio[:round(.05*rate)]**2))),float(np.sqrt(np.mean(audio[-round(.05*rate):]**2)))]
    stereo=float(np.corrcoef(audio[:,0],audio[:,1])[0,1])
    return {
      'file':mp3path.name,'assetPath':mp3path.relative_to(ROOT).as_posix(),'bundle':mp3path.parent.name,
      'title':score.title,'bpm':score.bpm,'meter':f'{score.meter}/4','bars':score.bars,
      'durationSeconds':len(audio)/rate,'loop':score.loop,'loopStartSeconds':0 if score.loop else None,
      'loopEndSeconds':score.seconds if score.loop else None,'sampleRate':rate,'channels':2,'bitrateKbps':128,
      'bytes':mp3path.stat().st_size,'sha256':hashlib.sha256(mp3path.read_bytes()).hexdigest(),
      'integratedLufs':float(level['input_i']),'truePeakDbtp':float(level['input_tp']),'loudnessRangeLu':float(level['input_lra']),
      'decodedSamplePeakDbfs':20*math.log10(max(peak,1e-12)),'clippedSamples':int(np.sum(np.abs(audio)>=1)),
      'loopBoundaryStepPeak':edge,'loopBoundaryStepDbfs':20*math.log10(max(edge or 0,1e-12)) if score.loop else None,
      'firstAndLast50msRms':rms_edges,'stereoCorrelation':stereo,'sections':score.sections,
      'noteCount':sum(e.kind=='on' for e in score.events),
    }

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--soundfont',type=Path)
    parser.add_argument('--only',choices=['camp','explore','boss','win','lose']);parser.add_argument('--midi-only',action='store_true')
    args=parser.parse_args()
    if not args.midi_only:
        if args.soundfont is None:parser.error('--soundfont is required for audio rendering; --midi-only needs no sample bank.')
        digest=hashlib.sha256(args.soundfont.read_bytes()).hexdigest()
        if digest!=FONT_SHA256:raise RuntimeError('SoundFont differs from the verified GeneralUser GS 2.0.3. Review its source/license before changing this hash.')
    (SOURCE/'midi').mkdir(parents=True,exist_ok=True)
    if not args.midi_only:(WORK/'masters').mkdir(parents=True,exist_ok=True)
    all_scores=[camp(),explore(),boss(),stinger(True),stinger(False)]
    scores=[s for s in all_scores if not args.only or s.slug.replace('music-','')==args.only]
    results=[]
    for score in scores:
        midipath=SOURCE/'midi'/f'{score.slug}.mid';write_midi(score,midipath)
        print(f'Composed {score.slug}: {score.seconds:.3f}s, {sum(e.kind=="on" for e in score.events)} performed notes',flush=True)
        if args.midi_only:continue
        renderer=FluidRenderer(args.soundfont)
        try:audio=renderer.render(score);version=renderer.version
        finally:renderer.close()
        rawpath=WORK/f'{score.slug}-raw.wav';wavfile.write(rawpath,RATE,audio)
        mp3path=OUTPUTS[score.slug]
        mp3path.parent.mkdir(parents=True,exist_ok=True)
        result=encode_and_measure(score,rawpath,WORK/'masters'/f'{score.slug}.wav',mp3path)
        results.append(result)
        print(json.dumps(result,ensure_ascii=False),flush=True)
    if args.midi_only:
        print('MIDI scores written. Audio files and their measurement manifest were not changed.',flush=True)
        return
    manifest_path=SOURCE/'music-manifest.json'
    previous=json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
    previous_tracks={track['file']:track for track in previous.get('tracks',[])}
    previous_tracks.update({track['file']:track for track in results})
    manifest={
      'version':1,'composer':'Original composition authored for Monster Den','soundfont':'GeneralUser GS 2.0.3 by S. Christian Collins',
      'soundfontSha256':FONT_SHA256,'soundfontBundled':False,'renderer':('FluidSynth '+version) if results else previous.get('renderer','FluidSynth >=2.3'),
      'sourceUrl':'https://github.com/mrbumpy409/GeneralUser-GS','licenseFile':'licenses/GeneralUser-GS-LICENSE.txt',
      'tracks':[previous_tracks[k] for k in sorted(previous_tracks)],
      'limitations':['Objective loudness and waveform measurements do not establish artistic quality.',
        'MP3 gapless looping depends on the target decoder; WeChat device transitions require listening.',
        'The SoundFont license allows commercial music creation but preserves a historical sample-provenance qualification.'],
    }
    manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    print('Wrote',manifest_path,flush=True)

if __name__=='__main__':main()

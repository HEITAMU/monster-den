/** Original compact generative audio. Best-effort WebAudio: silent fallback. */
export class Sound{
 private ctx:any;private beat=0;private step=0;
 constructor(){try{const g:any=globalThis;
  this.ctx=g.wx?.createWebAudioContext?.()||new (g.AudioContext||g.webkitAudioContext)();}catch(_e){}
 }
 unlock(){try{this.ctx?.resume?.();}catch(_e){}}
 tone(hz:number,seconds:number,vol=.03,shape='sine',delay=0){
  const c=this.ctx;if(!c)return;try{const o=c.createOscillator(),g=c.createGain(),t=c.currentTime+delay;
   o.type=shape;o.frequency.setValueAtTime(hz,t);g.gain.setValueAtTime(.0001,t);
   g.gain.exponentialRampToValueAtTime(vol,t+.014);g.gain.exponentialRampToValueAtTime(.0001,t+seconds);
   o.connect(g);g.connect(c.destination);o.start(t);o.stop(t+seconds+.04);}catch(_e){}
 }
 play(event:'catch'|'shot'|'hit'|'hurt'|'upgrade'|'win'|'button'|'boss'){
  if(event==='catch'){this.tone(420,.12);this.tone(630,.22,.026,'triangle',.035);}
  if(event==='shot'){this.tone(147,.24,.065,'sawtooth');this.tone(720,.19,.026,'triangle',.05);}
  if(event==='hit'){this.tone(205,.15,.04,'triangle');this.tone(103,.2,.025);}
  if(event==='hurt'){this.tone(91,.33,.06,'sawtooth');}
  if(event==='upgrade'||event==='win'){[392,494,587,784,988].forEach((f,i)=>this.tone(f,.42,.04,'sine',i*.11));}
  if(event==='boss'){this.tone(77,.73,.07,'sawtooth');}
  if(event==='button')this.tone(630,.075,.018);
 }
 update(dt:number,isPlaying:boolean){if(!isPlaying)return;this.beat+=dt;
  if(this.beat<.67)return;this.beat-=.67;
  const bass=[110,110,130.81,110,98,123.47,146.83,130.81];const n=this.step++%16;
  this.tone(bass[Math.floor(n/2)%bass.length],.53,.015);
  if(n%4===0)this.tone([329.6,392,293.6,440][n/4],1.2,.008,'triangle',.1);
 }
}

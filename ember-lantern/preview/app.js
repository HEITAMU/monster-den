import {LanternRules,INITIAL_PROGRESS,upgradeCost,WORLD,clamp} from './modules/LanternRules.js';
const canvas=document.getElementById('game');
const ctx=canvas.getContext('2d',{alpha:false,desynchronized:true});
const W=720;let H=1280;const pi=Math.PI;const edge=()=>Math.max(0,(H-1280)/2);const up=y=>y+edge();const down=y=>y-edge();
let dpr=1;
const art={};const keys=['forest','vignette','glow','blue-glow','shadow','hero-front','hero-back','hero-run-left','hero-run-right','hunter','mantis','moth','pulse','lampseed','portal','refill','camp'];
let loaded=0;let soundReady=false;
const sound={};let lastCue=0;
for(const n of ['forest-ambient','pulse','pickup','dash','hit','hurt','portal']){const a=new Audio('../assets/resources/sound/'+n+'.mp3');a.preload='auto';a.volume=n==='forest-ambient'?.35:.6;if(n==='forest-ambient')a.loop=true;sound[n]=a;}
function audioUnlock(){if(soundReady)return;soundReady=true;sound['forest-ambient'].play().catch(()=>{});}
function play(n){if(!soundReady)return;const a=sound[n];if(!a)return;try{a.pause();a.currentTime=0;a.play().catch(()=>{});}catch{}}
for(const name of keys){const im=new Image();im.onload=()=>loaded++;im.src='../assets/resources/art/'+name+(name==='forest'?'.jpg':'.png');art[name]=im;}
function saved(){try{return JSON.parse(localStorage.getItem('ember-lantern-progress-v1')||'null')||INITIAL_PROGRESS;}catch{return INITIAL_PROGRESS;}}
function store(){try{localStorage.setItem('ember-lantern-progress-v1',JSON.stringify(game.progress));}catch{}}
const game=new LanternRules(saved(),1337);
const keysHeld=new Set();
const pointer={id:null,downX:0,downY:0,x:0,y:0,joyX:0,joyY:0};
let elapsed=0;let last=0;let lastPhase='camp';let particles=[];let floaters=[];let sparkles=[];let toast='';let toastUntil=0;let pose='hero-front';let adNote='';
for(let i=0;i<42;i++)sparkles.push({x:((i*97)%700)-350,y:((i*113)%1240)-620,z:(i*29)%5});
function resize(){const ww=window.innerWidth,hh=window.innerHeight;const widthScale=Math.min(ww/W,hh/1280);H=Math.round(Math.max(1280,hh/widthScale));const dw=Math.max(1,Math.round(W*widthScale));const dh=Math.max(1,Math.round(H*widthScale));canvas.style.width=dw+'px';canvas.style.height=dh+'px';dpr=Math.min(2,window.devicePixelRatio||1);canvas.width=Math.floor(W*dpr);canvas.height=Math.floor(H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);}
window.addEventListener('resize',resize);resize();
const X=x=>W/2+x,Y=y=>H/2-y;
function rect(x,y,w,h,fill,stroke='',r=20){ctx.beginPath();ctx.roundRect(X(x-w/2),Y(y+h/2),w,h,r);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();}}
function text(t,x,y,sz=26,col='#f7e3c6',weight=500,align='center'){ctx.fillStyle=col;ctx.textAlign=align;ctx.textBaseline='middle';ctx.font=`${weight} ${sz}px "PingFang SC","Microsoft YaHei","Noto Sans SC",sans-serif`;ctx.shadowColor='#071219d9';ctx.shadowBlur=9;ctx.fillText(String(t),X(x),Y(y));ctx.shadowBlur=0;}
function img(n,x,y,w,h,alpha=1,scaleX=1,rotation=0){let a=art[n];if(!a?.complete || !a?.naturalWidth)return;ctx.save();ctx.globalAlpha=alpha;ctx.translate(X(x),Y(y));ctx.rotate(rotation);ctx.scale(scaleX,1);ctx.drawImage(a,-w/2,-h/2,w,h);ctx.restore();}
function bar(x,y,w,h,pct){rect(x,y,w,h,'#071921','#e2b982',h/2);ctx.save();ctx.beginPath();ctx.roundRect(X(x-w/2+4),Y(y+h/2-4),Math.max(0,(w-8)*pct),h-8,Math.min(8,h/2));ctx.fillStyle=pct<.25?'#e96b5a':'#f6c266';ctx.fill();ctx.restore();}
function button(t,x,y,w=510,h=80,enabled=true){rect(x,y,w,h,enabled?'#674127e8':'#2b3b3bc9',enabled?'#e4b779':'#5d7779',17);text(t,x,y,Math.min(29,34-w<260?24:29),enabled?'#ffe6a3':'#9eb1b1',700);}
function visibleFrame(){return loaded===keys.length;}
function events(es){for(const e of es){
 if(e.kind==='pulse'){particles.push({t:0,d:.57,x:e.x,y:e.y,type:'pulse'});floaters.push({text:'光焰脉冲',x:e.x,y:e.y+105,t:0,col:'#ffe6a4'});play('pulse');}
 if(e.kind==='dash'){particles.push({t:0,d:.39,x:e.x,y:e.y,type:'blue'});play('dash');}
 if(e.kind==='hit'){particles.push({t:0,d:.32,x:e.x,y:e.y,type:'gold'});floaters.push({text:'-'+e.amount,x:e.x,y:e.y+70,t:0,col:'#ffdfa2'});play('hit');}
 if(e.kind==='kill')floaters.push({text:'驱散',x:e.x,y:e.y+90,t:0,col:'#d7f3c4'});
 if(e.kind==='reveal')particles.push({t:0,d:.44,x:e.x,y:e.y,type:'gold'});
 if(e.kind==='pickup'){floaters.push({text:e.tag==='seed'?'灯灰 +'+e.amount:'火焰 +30',x:e.x,y:e.y+78,t:0,col:e.tag==='seed'?'#ffe6ab':'#9be9e5'});play('pickup');}
 if(e.kind==='portal'){toast='出口点亮 · 向上方古树遗迹前进';toastUntil=elapsed+3;play('portal');}
 if(e.kind==='hurt'){floaters.push({text:'受伤!',x:e.x,y:e.y+65,t:0,col:'#ff947a'});play('hurt');}
 if(e.kind==='near-death'){toast='生命仅剩一次 · 避开敌人';toastUntil=elapsed+3;}
 if(e.kind==='ambush'){toast='暗影巡猎者正在靠近！';toastUntil=elapsed+3;particles.push({t:0,d:.4,x:e.x,y:e.y,type:'blue'});}
 }}
function tick(dt){elapsed+=dt;
 if(!visibleFrame())return;
 const s=game.state;
 if(s.phase==='exploring'){
  const vx=Number(keysHeld.has('ArrowRight')||keysHeld.has('KeyD'))-Number(keysHeld.has('ArrowLeft')||keysHeld.has('KeyA'));
  const vy=Number(keysHeld.has('ArrowUp')||keysHeld.has('KeyW'))-Number(keysHeld.has('ArrowDown')||keysHeld.has('KeyS'));
  if(pointer.id===null)game.move(vx,vy);
  else game.move(pointer.joyX,pointer.joyY);
  game.tick(dt);events(game.drainEvents());
  if(game.state.phase!==lastPhase){pointer.id=null;game.move(0,0);play('portal');}
 }
 lastPhase=game.state.phase;
 for(const p of particles)p.t+=dt;
 particles=particles.filter(p=>p.t<p.d).slice(-15);
 for(const f of floaters)f.t+=dt;
 floaters=floaters.filter(f=>f.t<1.0).slice(-18);
}
function renderGame(showHud=true){
 const s=game.state,h=s.hero;
 img('forest',0,0,W,H);
 ctx.save();ctx.globalAlpha=.74+(1-h.flame/h.maxFlame)*.24;img('vignette',0,0,W,H);ctx.restore();
 for(let i=0;i<sparkles.length;i++){
  const f=sparkles[i],x=f.x+Math.sin(elapsed*.6+i)*6,y=((f.y+elapsed*(2+i%4)+620)%1240)-620;
  img(i%4===0?'blue-glow':'glow',x,y,22+(i%3)*7,22+(i%3)*7,.17+.15*Math.sin(elapsed*2+i));
 }
 const draws=[];
 if(s.phase==='exploring'){
  img('blue-glow',WORLD.portalX,WORLD.portalY,230,245,s.portalReady?.43:.13);
  img('portal',WORLD.portalX,WORLD.portalY,169,182,s.portalReady?.97:.36);
  for(const p of s.pickups){if(!p.taken&&p.revealed)draws.push({y:p.y,type:'pickup',p});}
  for(const e of s.enemies){if(e.hp>0)draws.push({y:e.y,type:'enemy',e});}
  draws.push({y:h.y,type:'hero'});draws.sort((a,b)=>b.y-a.y);
  for(const d of draws){
   if(d.type==='pickup'){
    const p=d.p;img('glow',p.x,p.y+10,90,90,.4);
    img(p.kind==='seed'?'lampseed':'refill',p.x,p.y+Math.sin(elapsed*2.4+p.glimmer)*5,p.kind==='seed'?58:73,p.kind==='seed'?66:80,.97);
   }else if(d.type==='enemy'){
    const e=d.e;img('shadow',e.x,e.y-38,90,32,.52);
    if(e.windup>0){img('glow',e.strikeX,e.strikeY,135,135,.34+Math.sin(elapsed*12)*.1);ctx.beginPath();ctx.arc(X(e.strikeX),Y(e.strikeY),53,0,2*pi);ctx.lineWidth=4;ctx.strokeStyle='#fa9576';ctx.stroke();}
    const wide=e.kind==='hunter'?110:e.kind==='mantis'?102:96;
    img(e.kind,e.x,e.y+Math.sin(elapsed*3+e.phase)*3,wide,wide,e.stun>0?.76:1,e.x>h.x?-1:1);
   }else{
    const dx=pointer.joyX || Number(keysHeld.has('KeyD'))-Number(keysHeld.has('KeyA'));
    const dy=pointer.joyY || Number(keysHeld.has('KeyW'))-Number(keysHeld.has('KeyS'));
    pose=Math.abs(dx)>.3?(dx<0?'hero-run-left':'hero-run-right'):(dy>.3?'hero-back':'hero-front');
    img('shadow',h.x,h.y-51,106,35,.55);
    img('glow',h.x+23,h.y+16,245,245,.32+(h.flame/h.maxFlame)*.37);
    img(pose,h.x,h.y+5+Math.sin(elapsed*7)*3,135,150,h.hitflash>0&&Math.floor(elapsed*20)%2===0?.42:1);
   }
  }
 }
 for(const p of particles){const v=p.t/p.d;
  if(p.type==='pulse')img('pulse',p.x,p.y,160+v*340,160+v*340,(1-v)*.95,1,v*2);
  else img(p.type==='blue'?'blue-glow':'glow',p.x,p.y,55+v*140,55+v*140,(1-v)*.74);
 }
 for(const f of floaters){ctx.globalAlpha=1-f.t; text(f.text,f.x,f.y+f.t*63,f.text.includes('!')?35:28,f.col,800);ctx.globalAlpha=1;}
 if(!showHud)return;
 rect(0,up(545),690,144,'#0a1f29df','#b29360',20);
 text(`第 ${s.depth} 层 · ${['营地','青影林','灰烬谷','夜冠深处'][s.depth]||'营地'}`,0,up(601),26,'#ffe1a5',700);
 text(`生命 ${h.hp}/${h.maxHp}`,-219,up(564),24,'#ffcaac',650);
 text(`灯种 ${Math.min(s.collected,s.target)}/${s.target}`,209,up(564),24,'#e8edd2',650);
 bar(0,up(525),314,21,h.flame/h.maxFlame);
 text(`携带 ${s.carried} 灯灰`,0,up(487),21,'#ffdfb0',600);
 if(toast && elapsed<toastUntil){rect(0,-326,627,58,'#09212ed9','#b8ae70',15);text(toast,0,-326,22,'#ffde9a');}
 rect(0,down(-536),690,178,'#101e28df','#9b8054',22);
 img('glow',-225,down(-539),166,166,.43);
 ctx.beginPath();ctx.arc(X(-225),Y(down(-534)),67,0,2*pi);ctx.lineWidth=4;ctx.strokeStyle='#d6ba80';ctx.stroke();
 img('lampseed',-225+pointer.joyX*60,down(-534)+pointer.joyY*60,67,72,.78);
 text('拖动行走',-225,down(-611),19,'#cfd5be');
 img('pulse',87,down(-539),104,104,.86);text('闪避',87,down(-605),19,'#ffe0ae',700);
 img('glow',250,down(-528),145,145,.57);img('lampseed',250,down(-525),127,135,.96);text('脉冲',251,down(-611),20,'#ffe0a7',750);
}
function renderCamp(){
 img('forest',0,0,W,H);img('vignette',0,0,W,H,.8);
 rect(0,up(495),690,157,'#10282df0','#dbaf6e',23);
 text('烬灯秘境',0,up(535),63,'#ffe4a5',900);text('一盏灯，带走森林的秘密',0,up(471),23,'#c8ddd1',600);
 img('glow',18,143,380,380,.4);img('camp',35,157,325,352,.98);img('hero-front',-220,75,195,221);
 img('lampseed',212,100,114,116,.94);
 rect(0,-149,625,150,'#11272be6','#d5ad6e',19);
 text(`拥有灯灰：${game.progress.currency}`,0,-113,33,'#ffe49b',750);
 text(`最高第 ${game.progress.bestDepth} 层 · 远征 ${game.progress.runs} 次`,0,-174,22,'#b6ccca');
 button('提灯出征',0,down(-325),510,94);
 text('永久强化 · 每次远征都会变强',0,down(-413),24,'#ffe2aa');
 const items=[['flame','灯芯容量',-211],['pulse','光焰威力',0],['stride','移动步伐',211]];
 for(const [key,title,x] of items){const lv=game.progress.upgrades[key],cost=upgradeCost(game.progress.upgrades,key);
  button(`${title} ${lv}/9`,x,down(-489),194,77,game.progress.currency>=cost&&lv<9);
  text(lv>=9?'满级':`消耗 ${cost}`,x,down(-549),18,'#d8bf9a');}
 text('独立存档 · 真正可玩规则 · 广告默认关闭',0,down(-610),16,'#b9c2b9');
}
function renderChoice(){
 renderGame(false);rect(0,0,683,980,'#081d23f1','#d2a86a',24);
 img('portal',0,264,291,305);text(`第 ${game.state.depth} 层 · 古门苏醒`,0,448,42,'#ffe4a2',800);
 text(`灯种已齐 · 当前携带 ${game.state.carried} 灯灰`,0,90,27,'#f0dcaf');
 button(`平安撤离 · 结算 ${game.state.carried+(game.state.depth-1)*7}`,0,-35,500,90);
 button(game.state.depth>=3?'已经抵达最深处 · 结算':'继续深入 · 奖励更高',0,-151,500,90,game.state.depth<3);
 text('下一层：恢复少量生命和灯火',0,-273,22,'#cdd9d0');
 text('倒下只保留本局灯灰的 35%',0,-326,22,'#f5b098');
}
function renderEnd(){
 const s=game.state,win=s.phase==='settled',gain=win?s.carried+(s.depth-1)*7:Math.floor(s.carried*.35);
 img('forest',0,0,W,H);img('vignette',0,0,W,H);
 rect(0,0,683,1000,'#081f27f1','#cfaa6e',30);
 text(win?'远征凯旋':'提灯熄灭',0,456,53,win?'#ffe6ab':'#ffb3a3',900);
 img(win?'lampseed':'hunter',0,273,228,246,.93);
 text(`深入：第 ${s.maxDepthReached} 层`,0,111,28,'#e3eee0');
 text(`击退暗影：${s.kills}`,0,57,28,'#e3eee0');
 text(`可带回灯灰：${gain}`,0,3,36,'#ffe0a1',750);
 text('此试玩未接入真实广告，不会产生广告收益',0,-128,20,'#c3cfca');
 button('返回营地 · 永久保留成果',0,-234,512,90);
 text('下一次的灯，将比这一盏更亮',0,-414,23,'#b3d2ca');
}
function draw(){
 ctx.clearRect(0,0,W,H);
 if(!visibleFrame()){
  ctx.fillStyle='#081a24';ctx.fillRect(0,0,W,H);text('烬灯秘境',0,90,57,'#ffda92',850);
  const p=loaded/keys.length;bar(0,-28,380,22,p);text(`正在唤醒森林 ${loaded}/${keys.length}`,0,-81,22,'#e3cfaa');return;
 }
 const phase=game.state.phase;if(phase==='camp')renderCamp();else if(phase==='exploring')renderGame();else if(phase==='choice')renderChoice();else renderEnd();
}
function drawLoop(t){const dt=last?Math.min(.04,(t-last)/1000):0;last=t;tick(dt);draw();requestAnimationFrame(drawLoop);}
requestAnimationFrame(drawLoop);
function at(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*W/r.width-W/2,y:H/2-(e.clientY-r.top)*H/r.height};}
function within(p,x,y,w,h){return Math.abs(p.x-x)<=w/2 && Math.abs(p.y-y)<=h/2;}
function begin(){game.begin((Date.now()&0x7fffffff)||1485);particles=[];floaters=[];pointer.id=null;lastPhase='exploring';toast='拖左下角移动 · 点右下角灯火脉冲照出暗藏的灯种';toastUntil=elapsed+5;play('portal');}
function finish(){game.finish();store();pointer.id=null;particles=[];floaters=[];play('pickup');}
function buy(key){if(game.buy(key)){store();play('pickup');}else{toast='灯灰不足';toastUntil=elapsed+2;}}
function startPoint(e){e.preventDefault();audioUnlock();const p=at(e),s=game.state;
 if(s.phase==='camp'){
  if(within(p,0,down(-325),510,94))return begin();
  if(within(p,-211,down(-489),194,77))return buy('flame');
  if(within(p,0,down(-489),194,77))return buy('pulse');
  if(within(p,211,down(-489),194,77))return buy('stride');return;
 }
 if(s.phase==='exploring'){
  if(within(p,250,down(-525),150,166))return game.pulse();
  if(within(p,87,down(-539),114,133))return game.dash();
  if(p.y<down(-395) && p.x<-50){pointer.id=e.pointerId;pointer.downX=p.x;pointer.downY=p.y;movePoint(e);canvas.setPointerCapture(e.pointerId);}
  return;
 }
 if(s.phase==='choice'){
  if(within(p,0,-35,510,90))return game.choose('extract');
  if(within(p,0,-151,500,90)){if(s.depth>=3)return;game.choose('deeper');play('portal');}
  return;
 }
 if(s.phase==='settled'||s.phase==='defeated'){
  if(within(p,0,-234,512,90))finish();
 }
}
function movePoint(e){if(pointer.id!==e.pointerId)return;const p=at(e);const dx=p.x-pointer.downX,dy=p.y-pointer.downY;const len=Math.hypot(dx,dy),r=len>76?76/len:1;pointer.joyX=len>9?dx*r/76:0;pointer.joyY=len>9?dy*r/76:0;game.move(pointer.joyX,pointer.joyY);}
function endPoint(e){if(pointer.id!==e.pointerId)return;pointer.id=null;pointer.joyX=0;pointer.joyY=0;game.move(0,0);}
canvas.addEventListener('pointerdown',startPoint,{passive:false});canvas.addEventListener('pointermove',movePoint);canvas.addEventListener('pointerup',endPoint);canvas.addEventListener('pointercancel',endPoint);
window.addEventListener('keydown',e=>{if(['Space','ShiftLeft','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();audioUnlock();keysHeld.add(e.code);if(e.repeat)return;if(e.code==='Space')game.pulse();if(e.code==='ShiftLeft')game.dash();if(e.code==='Enter'&&game.state.phase==='camp')begin();});
window.addEventListener('keyup',e=>keysHeld.delete(e.code));window.addEventListener('blur',()=>{keysHeld.clear();pointer.id=null;game.move(0,0);});
window.__EMBER_TEST__={game,begin,finish,assets:art,draw,ready:visibleFrame};

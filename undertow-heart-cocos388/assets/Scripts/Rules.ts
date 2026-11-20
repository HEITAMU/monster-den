/** Undertow Heart: deterministic engine-free gameplay. No graphics or WeChat dependency. */
export type Mode='menu'|'battle'|'upgrade'|'victory'|'defeat';
export type Kind='skimmer'|'thorn'|'volatile'|'titan';
export type Upgrade='capacity'|'range'|'power'|'pierce'|'shock'|'heal'|'armor';
export const UPGRADES:Record<Upgrade,[string,string]>={
 capacity:['潮囊拓展','每次额外收容一个敌人'],range:['引潮力场','收容半径提高 13%'],
 power:['破浪重压','反击速度、伤害提高'],pierce:['余波穿透','弹射体可额外贯穿敌人'],
 shock:['共鸣震荡','释放时制造环形伤害'],heal:['深井愈合','立即恢复 30 生命'],
 armor:['沉潮护甲','永久增加本局生命上限 25']
};
export interface Enemy{id:number;kind:Kind;x:number;z:number;hp:number;radius:number;speed:number;held:boolean;alive:boolean;stun:number;phase:number;cooldown:number}
export interface Missile{id:number;x:number;z:number;vx:number;vz:number;power:number;pierce:number;radius:number;ttl:number;hits:number[]}
export interface Flash{x:number;z:number;age:number;duration:number;size:number;type:'capture'|'release'|'hit'|'explode'|'hurt'}
export interface Save{best:number;pearls:number;rank:number;games:number}
export interface State{
 mode:Mode; training:boolean;wave:number;clock:number;seed:number;next:number;
 hp:number;hpMax:number;score:number;pearls:number;combo:number;comboTimer:number;
 enemies:Enemy[];missiles:Missile[];flashes:Flash[];choices:Upgrade[];boost:Record<Upgrade,number>;
 holding:boolean;holdTime:number;angle:number;cooldown:number;spawnTimer:number;revived:boolean;
 bossCreated:boolean;message:string;messageTimer:number;
}
export const PHASE_SECONDS=[24,28,32,52];
const RAD=Math.PI*2;
const keys:Upgrade[]=['capacity','range','power','pierce','shock','heal','armor'];
const distance=(x:number,z:number)=>Math.hypot(x,z);
const clamp=(n:number,a:number,b:number)=>Math.min(b,Math.max(a,n));
function rnd(s:State){let v=s.seed|0;v^=v<<13;v^=v>>>17;v^=v<<5;s.seed=v||1;return (v>>>0)/4294967296;}
function effect(s:State,x:number,z:number,size:number,type:Flash['type'],duration=.44){s.flashes.push({x,z,size,age:0,duration,type});}
export function init(seed=10,rank=0):State{return {
 mode:'menu',training:false,wave:0,clock:0,seed:seed||1,next:1,
 hp:100+rank*8,hpMax:100+rank*8,score:0,pearls:0,combo:0,comboTimer:0,
 enemies:[],missiles:[],flashes:[],choices:[],boost:{capacity:0,range:0,power:0,pierce:0,shock:0,heal:0,armor:0},
 holding:false,holdTime:0,angle:-Math.PI/2,cooldown:0,spawnTimer:.8,revived:false,bossCreated:false,
 message:'',messageTimer:0};}
export function start(s:State,training=false){s.mode='battle';s.training=training;s.wave=0;s.clock=0;s.spawnTimer=.8;
 s.message='按住捕获 · 拖动瞄准 · 松手反击';s.messageTimer=5;}
export function maxHeld(s:State){return 3+s.boost.capacity;}
export function heldCount(s:State){return s.enemies.filter(e=>e.held&&e.alive).length;}
export function captureRadius(s:State){return 4.6*(1+s.boost.range*.13);}
export function spawn(s:State,kind:Kind,a?:number,r?:number){
 const ang=a??rnd(s)*RAD,rad=r??9.3+rnd(s)*.9;
 const stats:Record<Kind,[number,number,number]>={skimmer:[1,1.34,.42],thorn:[3,.94,.52],volatile:[1.2,1.45,.47],titan:[22,.72,1.25]};
 const [hp,spd,sz]=stats[kind];const e:Enemy={id:s.next++,kind,x:Math.cos(ang)*rad,z:Math.sin(ang)*rad,
  hp, radius:sz,speed:spd,held:false,alive:true,stun:0,phase:rnd(s)*RAD,cooldown:0};
 s.enemies.push(e);return e;
}
export function aim(s:State,radians:number){if(Number.isFinite(radians))s.angle=radians;}
export function hold(s:State){if(s.mode==='battle'&&s.cooldown===0&&!s.holding){s.holding=true;s.holdTime=0;}}
export function coreHit(s:State,n:number){if(s.mode!=='battle')return;s.hp=clamp(s.hp-n,0,s.hpMax);s.combo=0;
 effect(s,0,0,2,'hurt');if(!s.hp){s.mode='defeat';s.holding=false;}}
function kill(s:State,e:Enemy){if(!e.alive)return;e.alive=false;s.combo=Math.min(25,s.combo+1);s.comboTimer=3;
 s.score+=10*Math.max(1,Math.floor(s.combo/4)+1)*(e.kind==='titan'?10:1);
 s.pearls+=e.kind==='titan'?20:1;effect(s,e.x,e.z,e.kind==='titan'?3:1,'hit');
 if(e.kind==='volatile'){
  effect(s,e.x,e.z,2.4,'explode');
  for(const f of s.enemies)if(f.alive&&f.id!==e.id&&distance(f.x-e.x,f.z-e.z)<2.5)hit(s,f,2);
 }
}
function hit(s:State,e:Enemy,damage:number){e.hp-=damage;if(e.hp<=0)kill(s,e);}
export function release(s:State){if(!s.holding||s.mode!=='battle')return 0;
 s.holding=false;s.cooldown=.32;let held=s.enemies.filter(e=>e.alive&&e.held),count=held.length;
 held.forEach((e,i)=>{
  e.alive=false;const a=s.angle+(i-(count-1)/2)*.12;
  const spd=9.5*(1+s.boost.power*.16);
  s.missiles.push({id:s.next++,x:e.x,z:e.z,vx:Math.cos(a)*spd,vz:Math.sin(a)*spd,
   power:(e.kind==='thorn'?3.3:2.1)*(1+s.boost.power*.28),pierce:s.boost.pierce,
   radius:e.kind==='thorn'?.47:.34,ttl:2.1,hits:[]});
 });
 if(count){effect(s,0,0,1.9,'release');s.message='反潮连击 ×'+count;s.messageTimer=1;}
 if(count&&s.boost.shock){for(const e of s.enemies)if(e.alive&&!e.held&&distance(e.x,e.z)<3)hit(s,e,s.boost.shock*.9);
  effect(s,0,0,3.4,'explode');}
 s.holdTime=0;return count;
}
function choose(s:State){const pool=keys.filter(k=>k!=='heal'||s.hp<s.hpMax-15),out:Upgrade[]=[];
 while(out.length<3&&pool.length)out.push(pool.splice(Math.floor(rnd(s)*pool.length),1)[0]);
 return out;}
export function upgrade(s:State,key:Upgrade){if(s.mode!=='upgrade'||!s.choices.includes(key))return false;
 s.boost[key]++;if(key==='heal')s.hp=Math.min(s.hpMax,s.hp+30);
 if(key==='armor'){s.hpMax+=25;s.hp+=25;}
 s.wave++;s.clock=0;s.mode='battle';s.enemies=[];s.missiles=[];s.flashes=[];
 s.spawnTimer=.8;s.bossCreated=false;s.choices=[];s.message='第 '+(s.wave+1)+' 潮';s.messageTimer=3;return true;
}
export function revive(s:State){if(s.mode!=='defeat'||s.revived)return false;
 s.revived=true;s.mode='battle';s.hp=Math.ceil(s.hpMax*.45);s.enemies=[];s.missiles=[];s.flashes=[];
 s.holding=false;s.spawnTimer=2;s.message='潮心重燃';s.messageTimer=2;return true;}
export function step(s:State,dt:number){if(s.mode!=='battle')return;
 dt=clamp(dt,0,.05);s.clock+=dt;s.cooldown=Math.max(0,s.cooldown-dt);
 s.messageTimer=Math.max(0,s.messageTimer-dt);s.comboTimer=Math.max(0,s.comboTimer-dt);
 if(s.comboTimer===0)s.combo=0;
 for(const f of s.flashes)f.age+=dt;s.flashes=s.flashes.filter(f=>f.age<f.duration);
 if(s.holding){s.holdTime+=dt;if(s.holdTime>=2.7){s.holding=false;s.holdTime=0;s.cooldown=1;
   for(const e of s.enemies)if(e.held){e.held=false;e.stun=.65;}
   coreHit(s,s.training?2:10);s.message='潮压过载！';s.messageTimer=1.4;}}
 s.spawnTimer-=dt;
 if(s.wave===3&&!s.bossCreated){spawn(s,'titan',Math.PI*.75,8.8);s.bossCreated=true;s.message='巨骸来袭';s.messageTimer=3;}
 if(s.spawnTimer<=0&&s.clock<PHASE_SECONDS[s.wave]-2){
   if(s.enemies.filter(e=>e.alive&&!e.held).length<14){const r=rnd(s);spawn(s,s.wave===0?'skimmer':r<.23?'thorn':r<.45?'volatile':'skimmer');}
   s.spawnTimer=(1.3-s.wave*.13)*(.75+rnd(s)*.6);
 }
 for(const e of s.enemies){if(!e.alive)continue;
  if(e.held){const grabbed=s.enemies.filter(f=>f.held&&f.alive),i=grabbed.indexOf(e);
    const a=s.clock*2.6+i*RAD/grabbed.length;e.x=Math.cos(a)*1.75;e.z=Math.sin(a)*1.75;continue;}
  if(e.stun>0){e.stun-=dt;continue;}
  const d=distance(e.x,e.z);
  if(s.holding&&e.kind!=='titan'&&heldCount(s)<maxHeld(s)&&d<captureRadius(s)&&!(e.kind==='thorn'&&e.hp>1.5)){
   e.held=true;effect(s,e.x,e.z,.75,'capture',.3);continue;
  }
  const side=Math.sin(e.phase+s.clock)*.15,move=(e.kind==='titan'?.65:1)*e.speed;
  e.x+=(-e.x/Math.max(.01,d)-e.z/Math.max(.01,d)*side)*move*dt;
  e.z+=(-e.z/Math.max(.01,d)+e.x/Math.max(.01,d)*side)*move*dt;
  e.cooldown-=dt;
  if(distance(e.x,e.z)<e.radius+1.05&&e.cooldown<=0){
   const damage=e.kind==='titan'?20:e.kind==='thorn'?14:9;
   coreHit(s,s.training?Math.min(3,damage):damage);
   if(e.kind==='titan'){e.cooldown=2;e.stun=.7;e.x*=1.3;e.z*=1.3;}else e.alive=false;
  }
 }
 for(const m of s.missiles){m.x+=m.vx*dt;m.z+=m.vz*dt;m.ttl-=dt;
  for(const e of s.enemies){if(!e.alive||e.held||m.hits.includes(e.id))continue;
   if(distance(e.x-m.x,e.z-m.z)<e.radius+m.radius){hit(s,e,m.power);m.hits.push(e.id);
    if(m.pierce--<=0){m.ttl=0;break;}}}
 }
 s.enemies=s.enemies.filter(e=>e.alive);s.missiles=s.missiles.filter(m=>m.ttl>0&&distance(m.x,m.z)<11);
 if(s.hp<=0)return;
 if(s.wave===3){
  if(!s.enemies.some(e=>e.kind==='titan')&&s.bossCreated){s.mode='victory';s.holding=false;}
  else if(s.clock>=PHASE_SECONDS[3]){s.mode='defeat';s.holding=false;}
 }else if(s.clock>=PHASE_SECONDS[s.wave]){s.mode='upgrade';s.choices=choose(s);s.enemies=[];s.missiles=[];s.holding=false;}
}
export function readSave(raw:any):Save{
 const f=(v:any,max:number)=>typeof v==='number'&&Number.isFinite(v)?Math.floor(clamp(v,0,max)):0;
 return {best:f(raw?.best,1e9),pearls:f(raw?.pearls,1e9),rank:f(raw?.rank,20),games:f(raw?.games,1e7)};
}
export function cashout(s:State,old:Save):Save{return {...old,best:Math.max(old.best,s.score),
 pearls:old.pearls+Math.floor(s.pearls/2)+(s.mode==='victory'?35:0),games:old.games+1};}
export function buy(save:Save):Save{const price=40+save.rank*40;
 return save.pearls<price||save.rank>=20?save:{...save,pearls:save.pearls-price,rank:save.rank+1};}

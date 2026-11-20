import { _decorator, Camera, Canvas, Color, Component, DirectionalLight, EventTouch,
 gfx, Graphics, input, Input, Label, Layers, Node, ResolutionPolicy, UITransform, Vec3, view } from 'cc';
import {Art,Sculpture} from './Art';
import {Ads} from './Ads';import {Sound} from './Sound';
import {State,Save,Upgrade,UPGRADES,PHASE_SECONDS,init,start,step,aim,hold,release,upgrade,revive,
 cashout,buy,readSave,maxHeld,heldCount} from './Rules';
const {ccclass}=_decorator;
const STORAGE='undertow-heart-cocos-v1';
const color=(r:number,g:number,b:number,alpha=255)=>new Color(r,g,b,alpha);
const white=color(229,232,215),sea=color(96,223,206),warm=color(241,185,108),muted=color(154,185,192);
const WORLD=Layers.Enum.DEFAULT,UI=Layers.Enum.UI_2D;
function node(parent:Node,name:string,x=0,y=0,z=0,layer=UI){const result=new Node(name);result.parent=parent;result.layer=layer;result.setPosition(x,y,z);return result;}
function shape(parent:Node,w:number,h:number,fill:Color,stroke:Color|null=null,r=16){
 let t=parent.getComponent(UITransform);if(!t)t=parent.addComponent(UITransform);t.setContentSize(w,h);
 const g=parent.getComponent(Graphics)||parent.addComponent(Graphics);g.clear();g.fillColor=fill;
 g.roundRect(-w/2,-h/2,w,h,r);g.fill();if(stroke){g.strokeColor=stroke;g.lineWidth=2;
 g.roundRect(-w/2+1,-h/2+1,w-2,h-2,r);g.stroke();}return g;
}
function label(parent:Node,text:string,x:number,y:number,size=24,w=460,h=60,fill=white,bold=false){
 const n=node(parent,'Text '+text.slice(0,6),x,y);n.addComponent(UITransform).setContentSize(w,h);
 const l=n.addComponent(Label);l.string=text;l.fontSize=size;l.lineHeight=Math.round(size*1.22);l.color=fill;l.isBold=bold;
 l.overflow=Label.Overflow.SHRINK;l.enableWrapText=true;
 l.horizontalAlign=Label.HorizontalAlign.CENTER;l.verticalAlign=Label.VerticalAlign.CENTER;return l;
}
@ccclass('UndertowGame')
export class UndertowGame extends Component{
 private state!:State;private save!:Save;private world!:Node;private core!:Sculpture;
 private control!:Node;private ads!:Ads;private sound!:Sound;
 private enemies=new Map<number,Sculpture>();private missiles=new Map<number,Sculpture>();
 private flashes=new Map<object,Node>();private width=720;private height=1280;
 private canvas!:Node;private overlay!:Node;private header!:Node;private footer!:Node;
 private hpLabel!:Label;private scoreLabel!:Label;private waveLabel!:Label;private hintLabel!:Label;
 private capacityLabel!:Label;private pressure!:Node;
 private overlayPhase='';private overlayFingerprint='';private holdingTouch=false;
 private seconds=0;private wasHp=0;private wasScore=0;private priorPhase='menu';
 private cashed=false;private doubled=false;private advertising=false;
 start(){view.setDesignResolutionSize(720,1280,ResolutionPolicy.FIXED_WIDTH);
  const s=view.getVisibleSize();this.width=s.width;this.height=s.height;
  this.save=this.load();this.state=init(Date.now()|0,this.save.rank);
  this.ads=new Ads();this.sound=new Sound();this.buildWorld();this.buildUi();
  input.on(Input.EventType.TOUCH_START,this.touchStart,this);
  input.on(Input.EventType.TOUCH_MOVE,this.touchMove,this);
  input.on(Input.EventType.TOUCH_END,this.touchEnd,this);
  input.on(Input.EventType.TOUCH_CANCEL,this.touchEnd,this);
  this.refresh();
 }
 onDestroy(){input.off(Input.EventType.TOUCH_START,this.touchStart,this);
  input.off(Input.EventType.TOUCH_MOVE,this.touchMove,this);
  input.off(Input.EventType.TOUCH_END,this.touchEnd,this);
  input.off(Input.EventType.TOUCH_CANCEL,this.touchEnd,this);
 }
 private buildWorld(){this.world=node(this.node,'Deep water sculpted world',0,0,0,WORLD);
  const camNode=node(this.node,'Underwater camera',0,24,15,WORLD);
  camNode.lookAt(new Vec3(0,0,0),new Vec3(0,1,0));
  const camera=camNode.addComponent(Camera);camera.projection=Camera.ProjectionType.ORTHO;
  camera.orthoHeight=35;camera.priority=0;camera.near=.1;camera.far=150;
  camera.visibility=WORLD;camera.clearColor=color(5,18,31);
  const lamp=node(this.node,'Sunbeams',0,0,0,WORLD);lamp.setRotationFromEuler(-60,33,0);
  const light=lamp.addComponent(DirectionalLight);light.illuminance=50000;light.color=color(192,230,219);
  Art.environment(this.world);this.core=Art.core(this.world);
  this.control=node(this.world,'Target direction',0,0,0,WORLD);
  const pointer=Art.missile(this.control);pointer.node.setPosition(0,.4,-2.6);pointer.node.setScale(.72,.72,.72);
 }
 private buildUi(){this.canvas=node(this.node,'Game UI',0,0,0,UI);
  this.canvas.addComponent(UITransform).setContentSize(this.width,this.height);
  const canvas=this.canvas.addComponent(Canvas);
  const camNode=node(this.canvas,'UI camera',0,0,0,UI);
  const camera=camNode.addComponent(Camera);camera.projection=Camera.ProjectionType.ORTHO;
  camera.orthoHeight=this.height;camera.priority=10;camera.visibility=UI;
  camera.clearFlags=gfx.ClearFlagBit.DEPTH_STENCIL;
  canvas.cameraComponent=camera;canvas.alignCanvasWithScreen=true;
  this.header=node(this.canvas,'Top status',0,this.height/2-101);
  shape(node(this.header,'Top plate',0,25),Math.min(this.width-28,690),165,color(7,28,39,221),color(91,154,149,156));
  label(this.header,'逆 潮 之 心',0,65,34,510,60,white,true);
  this.hpLabel=label(this.header,'潮心 100 / 100',-this.width*.23,7,21,300,45,sea,true);
  this.scoreLabel=label(this.header,'战绩 0',this.width*.23,7,21,280,45,warm,true);
  this.waveLabel=label(this.header,'第 1 潮',0,-43,20,450,40,muted);
  this.footer=node(this.canvas,'Bottom status',0,-this.height/2+139);
  shape(node(this.footer,'Lower plate',0,-8),Math.min(this.width-28,680),198,color(7,28,39,223),color(91,154,149,120));
  this.hintLabel=label(this.footer,'按住吸附 · 拖动瞄准 · 松手反击',0,51,23,this.width-50,60,white,true);
  this.capacityLabel=label(this.footer,'潮囊 0 / 3',0,0,20,this.width-50,50,sea);
  shape(node(this.footer,'Tide pressure gutter',0,-47),Math.min(this.width*.7,480),12,color(50,72,82),null,5);
  this.pressure=node(this.footer,'Tide pressure',0,-47);
  shape(this.pressure,1,8,sea,null,4);
  label(this.footer,'蓄力过久会过载',0,-88,18,this.width-55,39,muted);
  this.overlay=node(this.canvas,'Modal overlay');
 }
 private button(parent:Node,title:string,y:number,callback:()=>void,accent:Color=sea,secondary=false){
  const b=node(parent,'Action '+title,0,y);shape(b,Math.min(this.width-75,540),85,
   secondary?color(27,53,63,252):color(26,68,73,252),accent,16);
  label(b,title,0,0,26,this.width-100,64,secondary?white:accent,true);
  b.on(Node.EventType.TOUCH_END,()=>{this.sound.play('button');callback();});
  return b;
 }
 private panel(title:string,subtitle:string){
  shape(node(this.overlay,'Shadow'),this.width,this.height,color(3,12,20,214),null,0);
  shape(node(this.overlay,'Modal surface'),Math.min(this.width-30,655),790,color(6,29,40,252),color(98,178,166,178),26);
  label(this.overlay,title,0,304,40,this.width-75,70,white,true);
  label(this.overlay,subtitle,0,218,21,this.width-90,105,muted);
 }
 private rebuildOverlay(){for(const n of [...this.overlay.children])n.destroy();const s=this.state;
  this.overlayPhase=s.mode;this.overlayFingerprint=this.save.rank+':'+this.save.pearls+':'+this.doubled;
  if(s.mode==='battle')return;
  if(s.mode==='menu'){
   this.panel('逆 潮 之 心','一座深海灯塔，正在吞噬前来摧毁它的生物。\n以敌人为弹药，逆转潮汐。');
   label(this.overlay,'按住 · 捕获靠近的生物\n拖动 · 选择弹射方向\n松手 · 将敌人射向敌人\n超时 · 潮压过载伤及灯塔',0,65,23,this.width-90,190,white);
   this.button(this.overlay,'开始深潮防卫',-109,()=>this.newRun());
   this.button(this.overlay,'低伤害练习',-213,()=>this.newRun(true),warm,true);
   this.button(this.overlay,'永久强化 '+this.save.rank+' 级 · '+(40+this.save.rank*40)+' 海晶',-314,()=>this.buyLevel(),warm,true);
  }else if(s.mode==='upgrade'){
   this.panel('潮 汐 演 化','第 '+(s.wave+1)+' 潮结束 · 三种进化选一项');
   s.choices.forEach((key,i)=>{const p=node(this.overlay,'Upgrade '+key,0,102-i*145);
    shape(p,Math.min(this.width-75,570),126,color(31,66,73,251),color(97,187,164,213),15);
    label(p,UPGRADES[key][0],0,29,29,this.width-115,53,warm,true);
    label(p,UPGRADES[key][1],0,-29,19,this.width-125,48,white);
    p.on(Node.EventType.TOUCH_END,()=>{if(upgrade(s,key))this.sound.play('upgrade');});
   });
  }else if(s.mode==='defeat'){
   this.panel('灯 塔 熄 灭','战绩 '+s.score+' · 捕获海晶 '+s.pearls);
   label(this.overlay,'找到正确的反潮方向，\n才能用较少的收容打出更多连锁。',0,83,25,this.width-95,142,white);
   if(!s.revived)this.button(this.overlay,this.ads.ready()?'完整观看广告 · 复苏 45% 潮心':'广告复活 · 尚未配置',-97,()=>{void this.reviveAd();});
   this.button(this.overlay,'重新挑战',-206,()=>this.newRun(),warm,true);
   this.button(this.overlay,'返回潮台',-312,()=>this.backHome(),white,true);
  }else if(s.mode==='victory'){
   this.panel('深 海 重 燃','巨骸已沉没 · 守护成功');
   label(this.overlay,'最终战绩 '+s.score+'\n本局海晶 '+(Math.floor(s.pearls/2)+35)+'\n历史最高 '+Math.max(s.score,this.save.best),0,72,28,this.width-95,170,white,true);
   if(!this.doubled)this.button(this.overlay,this.ads.ready()?'完整观看广告 · 双倍海晶':'双倍海晶 · 尚未配置',-98,()=>{void this.doubleAd();});
   this.button(this.overlay,'再来一局',-205,()=>this.newRun(),warm,true);
   this.button(this.overlay,'返回潮台',-312,()=>this.backHome(),white,true);
  }
 }
 private load():Save{try{const g:any=globalThis;const raw=g.wx?.getStorageSync?.(STORAGE)??g.localStorage?.getItem(STORAGE);
  return readSave(typeof raw==='string'?JSON.parse(raw):raw);}catch(_e){return readSave(null);}}
 private persist(){try{const g:any=globalThis;const wx=g.wx;
  if(wx?.setStorageSync)wx.setStorageSync(STORAGE,this.save);
  else g.localStorage?.setItem(STORAGE,JSON.stringify(this.save));}catch(_e){}}
 private clearModels(){for(const e of this.enemies.values())e.node.destroy();this.enemies.clear();
  for(const e of this.missiles.values())e.node.destroy();this.missiles.clear();
  for(const e of this.flashes.values())e.destroy();this.flashes.clear();}
 private newRun(training=false){this.clearModels();this.state=init((Date.now()|0)^38941,this.save.rank);
  start(this.state,training);this.cashed=false;this.doubled=false;
  this.wasScore=0;this.wasHp=this.state.hp;this.priorPhase='battle';this.sound.unlock();}
 private backHome(){this.cash();this.clearModels();this.state=init(Date.now()|0,this.save.rank);
  this.cashed=false;this.doubled=false;this.priorPhase='menu';}
 private cash(){if(this.cashed||this.state.mode==='menu')return;this.save=cashout(this.state,this.save);
  this.cashed=true;this.persist();}
 private buyLevel(){const next=buy(this.save);if(next===this.save){this.toast('海晶不足或等级已经达到上限');return;}
  this.save=next;this.persist();this.state=init(Date.now()|0,this.save.rank);this.sound.play('upgrade');}
 private async reviveAd(){if(this.advertising||this.state.mode!=='defeat'||this.state.revived)return;
  this.advertising=true;const value=await this.ads.watch();this.advertising=false;
  if(value==='completed'){if(revive(this.state))this.sound.play('upgrade');}
  else this.toast(value==='unavailable'?'正式微信广告位尚未配置':'必须完整观看广告才能获得奖励');
 }
 private async doubleAd(){if(this.advertising||this.state.mode!=='victory'||this.doubled)return;
  this.advertising=true;const value=await this.ads.watch();this.advertising=false;
  if(value==='completed'&&!this.doubled){this.cash();this.doubled=true;
    this.save.pearls+=Math.floor(this.state.pearls/2)+35;this.persist();this.sound.play('upgrade');
    this.toast('双倍海晶奖励已到账');
  }else if(value!=='completed')this.toast(value==='unavailable'?'正式微信广告位尚未配置':'广告未完整观看，无法领取双倍奖励');
 }
 private toast(msg:string){const t=node(this.canvas,'System note',0,this.height*.29);
  shape(t,Math.min(this.width*.85,550),70,color(16,51,60,251),color(90,211,185),14);
  label(t,msg,0,0,21,this.width*.78,60,white);
  this.scheduleOnce(()=>{if(t.isValid)t.destroy();},2);
 }
 private pointer(e:EventTouch){const v=e.getUILocation(),x=v.x-this.width/2,z=-(v.y-this.height/2);
  if(Math.hypot(x,z)>20)aim(this.state,Math.atan2(z,x));}
 private touchStart(e:EventTouch){if(this.state.mode!=='battle'||this.holdingTouch)return;
  const p=e.getUILocation();if(p.y<this.height*.17||p.y>this.height*.87)return;
  this.holdingTouch=true;this.pointer(e);hold(this.state);this.sound.unlock();}
 private touchMove(e:EventTouch){if(this.holdingTouch&&this.state.mode==='battle')this.pointer(e);}
 private touchEnd(){if(!this.holdingTouch)return;this.holdingTouch=false;
  const count=release(this.state);if(count)this.sound.play('shot');}
 private renderModels(){const s=this.state;
  const living=new Set<number>();for(const e of s.enemies){living.add(e.id);let o=this.enemies.get(e.id);
   if(!o){o=Art.enemy(this.world,e.kind);this.enemies.set(e.id,o);if(e.kind==='titan')this.sound.play('boss');}
   o.node.setPosition(e.x,0,e.z);
   o.node.setRotationFromEuler(0,e.held?this.seconds*110:Math.atan2(-e.x,-e.z)*180/Math.PI,0);
   const scale=e.kind==='titan'?1.33:1;o.node.setScale(scale,1+Math.sin(this.seconds*5+e.id)*.07,scale);
   o.fins.forEach((f,i)=>f.setRotationFromEuler(Math.sin(this.seconds*3+i*.7)*15,i*35,Math.sin(this.seconds*4+i)*12));
  }
  for(const [id,o]of this.enemies){if(!living.has(id)){o.node.destroy();this.enemies.delete(id);}}
  const flying=new Set<number>();for(const m of s.missiles){flying.add(m.id);let o=this.missiles.get(m.id);
   if(!o){o=Art.missile(this.world);this.missiles.set(m.id,o);}
   o.node.setPosition(m.x,.3,m.z);o.node.setRotationFromEuler(0,Math.atan2(m.vx,m.vz)*180/Math.PI,this.seconds*110);
  }
  for(const [id,o]of this.missiles){if(!flying.has(id)){o.node.destroy();this.missiles.delete(id);}}
  const existing=new Set<object>();for(const f of s.flashes){existing.add(f);let o=this.flashes.get(f);
   if(!o){o=Art.ripple(this.world,f.type);this.flashes.set(f,o);}
   o.setPosition(f.x,.27,f.z);const scale=f.size*(f.age/f.duration+.17);o.setScale(scale,.65,scale);
  }
  for(const [f,o]of this.flashes){if(!existing.has(f)){o.destroy();this.flashes.delete(f);}}
  this.core.node.setRotationFromEuler(0,this.seconds*6,0);
  if(this.core.heart)this.core.heart.setScale(1+Math.sin(this.seconds*5)*.06,1+Math.sin(this.seconds*5)*.06,1);
  this.core.fins.forEach((f,i)=>f.setRotationFromEuler(-15+Math.sin(this.seconds*2+i*.8)*9,i*-45,0));
  this.control.active=s.mode==='battle';this.control.setRotationFromEuler(0,-s.angle*180/Math.PI-90,0);
 }
 private refresh(){const s=this.state;
  if(s.mode!==this.overlayPhase||(s.mode==='menu'&&this.overlayFingerprint!==this.save.rank+':'+this.save.pearls+':'+this.doubled)
    ||(s.mode==='victory'&&this.overlayFingerprint!==this.save.rank+':'+this.save.pearls+':'+this.doubled))this.rebuildOverlay();
  this.header.active=s.mode==='battle';this.footer.active=s.mode==='battle';
  this.hpLabel.string='潮心 '+Math.ceil(s.hp)+' / '+s.hpMax;
  this.scoreLabel.string='战绩 '+s.score;
  this.waveLabel.string='第 '+(s.wave+1)+' 潮 · 剩余 '+Math.ceil(Math.max(0,PHASE_SECONDS[s.wave]-s.clock))+' 秒 · 连击 '+s.combo;
  this.capacityLabel.string='潮囊 '+heldCount(s)+' / '+maxHeld(s)+' · 潮压 '+Math.ceil(s.holdTime/2.7*100)+'%';
  this.hintLabel.string=s.messageTimer>0?s.message:'按住吸附 · 拖动瞄准 · 松手反击';
  const full=Math.min(this.width*.7,480),amount=Math.max(1,Math.min(full,full*s.holdTime/2.7));
  this.pressure.setPosition(-full/2+amount/2,-47,0);
  shape(this.pressure,amount,8,s.holdTime>2?warm:sea,null,4);
 }
 update(dt:number){this.seconds+=Math.min(.05,dt);
  if(this.state.mode==='battle')step(this.state,dt);
  if(this.wasHp>this.state.hp+1)this.sound.play('hurt');
  else if(this.wasScore<this.state.score)this.sound.play('hit');
  this.wasHp=this.state.hp;this.wasScore=this.state.score;
  if(this.priorPhase!==this.state.mode){if(this.state.mode==='victory'){this.cash();this.sound.play('win');}
   if(this.state.mode==='upgrade')this.sound.play('upgrade');this.priorPhase=this.state.mode;
   if(this.state.mode==='defeat')this.holdingTouch=false;
  }
  this.sound.update(dt,this.state.mode==='battle');this.renderModels();this.refresh();
 }
}

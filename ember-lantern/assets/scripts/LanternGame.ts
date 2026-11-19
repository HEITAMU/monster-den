import {
  _decorator,Component,Node,Camera,Canvas,UITransform,Sprite,SpriteFrame,Label,Graphics,Color,
  Vec3,Layers,view,ResolutionPolicy,resources,UIOpacity,AudioClip,AudioSource,EventTouch,game,Game
} from 'cc';
import {LanternRules,RunEvent,Enemy,Pickup,RunPhase,upgradeCost,clamp,WORLD,EnemyKind} from './core/LanternRules';
import {ProgressStore} from './platform/ProgressStore';
import {WeChatRewarded} from './platform/WeChatRewarded';
const {ccclass}=_decorator;
const W=720,H=1280;
const G=(hex:string,alpha=255):Color=>{
 const s=hex.replace('#','');return new Color(parseInt(s.slice(0,2),16),parseInt(s.slice(2,4),16),parseInt(s.slice(4,6),16),alpha);
};
const copy=(v:number)=>String(Math.ceil(v));
type SpriteVisual={node:Node;sprite:Sprite;opacity:UIOpacity;shadow?:Node};
type FloatLabel={node:Node;life:number;speed:number};
type Burst={node:Node;opacity:UIOpacity;life:number;max:number;scale:number;rotation:number};

@ccclass('LanternGame')
export class LanternGame extends Component{
 private rules=new LanternRules(ProgressStore.read(),1234);
 private ad=new WeChatRewarded();
 private frames:Record<string,SpriteFrame>={};
 private sounds:Record<string,AudioSource>={};
 private canvas!:Node;private screen!:Node;private world!:Node;private sprites!:Node;private vfx!:Node;private hud!:Node;private menu!:Node;
 private bg!:SpriteVisual;private vignette!:SpriteVisual;private player!:SpriteVisual;
 private playerGlow!:SpriteVisual;private portal!:SpriteVisual;private portalGlow!:SpriteVisual;
 private enemyVisuals=new Map<string,SpriteVisual>();
 private pickupVisuals=new Map<string,SpriteVisual>();
 private stars:SpriteVisual[]=[];
 private floaters:FloatLabel[]=[];
 private bursts:Burst[]=[];
 private frameClock=0;private elapsed=0;private ready=false;private paused=false;
 private phaseOnScreen:RunPhase|'loading'='loading';private pageNeedsRebuild=true;
 private currentPose='hero-front';private seedId=0;private lastFlame=100;private statusText='';private statusTime=0;
 private flameBar!:Graphics;private hpText!:Label;private progressText!:Label;private depthText!:Label;private currencyText!:Label;private toastText!:Label;
 private leftStick!:Node;private stickKnob!:SpriteVisual;private stickBase!:SpriteVisual;
 private dragging=false;private dragId=-999;private dragX=0;private dragY=0;private dragStartX=0;private dragStartY=0;
 private extraAdReward=0;private adBusy=false;private adAlreadyPlayed=false;
 private selectedUpgrade='';
 private uiHeight=H;
 private get edgeY():number{return Math.max(0,(this.uiHeight-H)/2);}
 async start():Promise<void>{
  view.setDesignResolutionSize(W,H,ResolutionPolicy.FIXED_WIDTH);
  this.uiHeight=Math.max(H,view.getVisibleSize().height);
  this.createCanvas();this.createBackdrop();
  this.menuLabel('烬灯秘境',0,160,62,'#ffe6aa');this.menuLabel('正在唤醒森林…',0,75,24,'#f6e4c6');
  try{
   await this.loadArt();
   this.makeWorld();this.makeHUD();this.makeJoystick();this.makeAudio();
   this.ready=true;this.pageNeedsRebuild=true;this.rules.state.phase='camp';
   this.rebuildOverlay();this.bindTouch();
  }catch(err){console.error('[Ember] loading failed',err);this.menu.removeAllChildren();this.menuLabel('资源载入失败',0,80,45,'#ffbd9c');this.menuLabel('请检查工程资源后重新进入',0,10,23,'#ffebd4');}
  game.on(Game.EVENT_HIDE,this.hide,this);game.on(Game.EVENT_SHOW,this.show,this);
 }
 onDestroy():void{
  game.off(Game.EVENT_HIDE,this.hide,this);game.off(Game.EVENT_SHOW,this.show,this);
  this.canvas?.off(Node.EventType.TOUCH_START,this.onTouchStart,this);
  this.canvas?.off(Node.EventType.TOUCH_MOVE,this.onTouchMove,this);
  this.canvas?.off(Node.EventType.TOUCH_END,this.onTouchEnd,this);
  this.canvas?.off(Node.EventType.TOUCH_CANCEL,this.onTouchEnd,this);
 }
 private hide(){this.paused=true;for(const s of Object.values(this.sounds))s.pause();}
 private show(){this.paused=false;if(this.sounds.ambient)this.sounds.ambient.play();}
 private createCanvas():void{
  this.canvas=new Node('EmberCanvas');this.canvas.parent=this.node;this.canvas.layer=Layers.Enum.UI_2D;
  this.canvas.addComponent(UITransform).setContentSize(W,this.uiHeight);
  const cameraNode=new Node('UICamera');cameraNode.parent=this.canvas;cameraNode.layer=Layers.Enum.UI_2D;cameraNode.setPosition(0,0,1000);
  const cam=cameraNode.addComponent(Camera);cam.projection=Camera.ProjectionType.ORTHO;cam.orthoHeight=this.uiHeight/2;
  cam.near=.1;cam.far=2000;cam.visibility=Layers.BitMask.UI_2D;cam.clearFlags=Camera.ClearFlag.SOLID_COLOR;
  cam.clearColor=G('#07141a');cam.priority=10;
  const cnv=this.canvas.addComponent(Canvas);cnv.cameraComponent=cam;cnv.alignCanvasWithScreen=true;
  this.screen=this.layer('Screen',this.canvas);this.world=this.layer('World',this.screen);
  this.sprites=this.layer('Creatures',this.screen);this.vfx=this.layer('Effects',this.screen);
  this.hud=this.layer('HUD',this.screen);this.menu=this.layer('Menus',this.screen);
 }
 private layer(name:string,parent:Node):Node{const n=new Node(name);n.layer=Layers.Enum.UI_2D;n.parent=parent;n.addComponent(UITransform).setContentSize(W,this.uiHeight);return n;}
 private makeTexture(name:string,parent:Node,x:number,y:number,w:number,h:number,opacity=255):SpriteVisual{
  const n=new Node(name);n.layer=Layers.Enum.UI_2D;n.parent=parent;n.setPosition(x,y,0);
  n.addComponent(UITransform).setContentSize(w,h);
  const s=n.addComponent(Sprite);s.sizeMode=Sprite.SizeMode.CUSTOM;
  const o=n.addComponent(UIOpacity);o.opacity=opacity;
  return {node:n,sprite:s,opacity:o};
 }
 private setImage(v:SpriteVisual,id:string){v.sprite.spriteFrame=this.frames[id]||null;}
 private createBackdrop():void{
  this.bg=this.makeTexture('IllustratedForest',this.world,0,0,W,this.uiHeight);
  this.vignette=this.makeTexture('NightVignette',this.world,0,0,W,this.uiHeight,245);
 }
 private loadArt():Promise<void>{
  const names=['forest','vignette','glow','blue-glow','shadow','hero-front','hero-back','hero-run-left','hero-run-right','hunter','mantis','moth','pulse','lampseed','portal','refill','camp'];
  return new Promise<void>((resolve,reject)=>{
   let count=0;let failed=false;
   for(const n of names){resources.load('art/'+n+'/spriteFrame',SpriteFrame,(err,frame)=>{
    if(failed)return;
    if(err||!frame){failed=true;reject(new Error(`art/${n}: ${String(err)}`));return;}
    this.frames[n]=frame;if(++count===names.length){this.setImage(this.bg,'forest');this.setImage(this.vignette,'vignette');resolve();}
   });}
  });
 }
 private menuLabel(value:string,x:number,y:number,size:number,color:string='#fff4d8',width=W):Label{
  return this.label(value,this.menu,x,y,size,color,width,70);
 }
 private label(value:string,parent:Node,x:number,y:number,size:number,color='#ffffff',width=180,height=50):Label{
  const node=new Node('Text '+value.slice(0,12));node.layer=Layers.Enum.UI_2D;node.parent=parent;node.setPosition(x,y,0);
  node.addComponent(UITransform).setContentSize(width,height);
  const t=node.addComponent(Label);t.string=value;t.fontSize=size;t.lineHeight=Math.floor(size*1.3);
  t.color=G(color);t.horizontalAlign=Label.HorizontalAlign.CENTER;t.verticalAlign=Label.VerticalAlign.CENTER;
  t.overflow=Label.Overflow.SHRINK;t.cacheMode=Label.CacheMode.BITMAP;
  return t;
 }
 private panel(parent:Node,x:number,y:number,w:number,h:number,fill:string='#13262d',alpha=220,radius=24):Node{
  const n=new Node('WroughtPanel');n.layer=Layers.Enum.UI_2D;n.parent=parent;n.setPosition(x,y,0);n.addComponent(UITransform).setContentSize(w,h);
  const g=n.addComponent(Graphics);g.fillColor=G(fill,alpha);g.roundRect(-w/2,-h/2,w,h,radius);g.fill();
  g.lineWidth=2.5;g.strokeColor=G('#d5a568',165);g.roundRect(-w/2+2,-h/2+2,w-4,h-4,radius);g.stroke();
  g.lineWidth=1;g.strokeColor=G('#f2d4a4',65);g.roundRect(-w/2+10,-h/2+10,w-20,h-20,radius-4);g.stroke();
  return n;
 }
 private button(parent:Node,label:string,x:number,y:number,w:number=280,h:number=74,active=true):void{
  const n=this.panel(parent,x,y,w,h,active?'#573521':'#313d3d',active?245:210,15);
  const l=this.label(label,n,0,0,26,active?'#ffe6a5':'#9fb4b6',w-12,52);
  l.isBold=true;
 }
 private makeWorld():void{
  this.portalGlow=this.makeTexture('GateAura',this.world,WORLD.portalX,WORLD.portalY,205,205,155);this.setImage(this.portalGlow,'blue-glow');
  this.portal=this.makeTexture('ExitPortal',this.world,WORLD.portalX,WORLD.portalY,151,166,125);this.setImage(this.portal,'portal');
  this.playerGlow=this.makeTexture('LanternBloom',this.sprites,0,0,230,230,180);this.setImage(this.playerGlow,'glow');
  this.player=this.makeTexture('AsterMessenger',this.sprites,0,-275,132,155);this.setImage(this.player,'hero-front');
  for(let i=0;i<22;i++){
   const x=((i*97)%645)-322,y=((i*119)%970)-485;
   const v=this.makeTexture('ForestFirefly',this.vfx,x,y,18+i%5*3,18+i%5*3,72+i%4*23);
   this.setImage(v,i%4===0?'blue-glow':'glow');this.stars.push(v);
  }
 }
 private makeHUD():void{
  const top=this.panel(this.hud,0,541+this.edgeY,694,145,'#10232c',211,20);
  this.depthText=this.label('第 1 层 · 青影林',top,0,42,24,'#ffe6ac',610,46);this.depthText.isBold=true;
  this.hpText=this.label('生命 4 / 4',top,-220,0,24,'#ffceaa',185,44);
  this.progressText=this.label('灯种 0 / 3',top,209,0,24,'#f7e2bd',206,44);
  const barNode=new Node('FlameMeter');barNode.parent=top;barNode.layer=Layers.Enum.UI_2D;barNode.setPosition(0,-2,0);barNode.addComponent(UITransform).setContentSize(300,40);this.flameBar=barNode.addComponent(Graphics);
  this.currencyText=this.label('带出 0',top,0,-39,20,'#efd1a2',450,43);
  const bottom=this.panel(this.hud,0,-532-this.edgeY,690,177,'#101d27',205,25);
  this.toastText=this.label('',this.hud,0,-336,24,'#ffe7b1',660,45);
  const pulseButton=this.makeTexture('PulseButtonArtwork',this.hud,251,-525-this.edgeY,132,132,250);
  this.setImage(pulseButton,'lampseed');
  this.label('脉冲',this.hud,254,-600-this.edgeY,22,'#ffe5a8',130,34);
  const dashButton=this.makeTexture('DashButtonArtwork',this.hud,84,-552-this.edgeY,79,86,230);
  this.setImage(dashButton,'pulse');
  this.label('闪避',this.hud,85,-606-this.edgeY,20,'#ffdb97',100,30);
  bottom.setSiblingIndex(0);
 }
 private makeJoystick():void{
  this.leftStick=this.layer('Joystick',this.hud);
  this.stickBase=this.makeTexture('StickBase',this.leftStick,-222,-540-this.edgeY,145,145,132);this.setImage(this.stickBase,'glow');
  const g=this.stickBase.node.addComponent(Graphics);g.lineWidth=4;g.strokeColor=G('#f5dda1',150);g.circle(0,0,60);g.stroke();
  this.stickKnob=this.makeTexture('StickThumb',this.leftStick,-222,-540-this.edgeY,70,70,215);this.setImage(this.stickKnob,'lampseed');
  this.label('拖动行走',this.leftStick,-224,-616-this.edgeY,20,'#d5e7e5',185,30);
 }
 private makeAudio():void{
  const keys=['forest-ambient','pulse','dash','hit','hurt','pickup','portal'];
  for(const key of keys){
   const n=new Node('Sound '+key);n.parent=this.node;const a=n.addComponent(AudioSource);a.loop=key==='forest-ambient';a.volume=key==='forest-ambient'?.34:.68;
   this.sounds[key==='forest-ambient'?'ambient':key]=a;
   resources.load('sound/'+key,AudioClip,(err,clip)=>{if(err){console.warn('[Ember audio missing]',key,err);return;}a.clip=clip;if(key==='forest-ambient'&&!this.paused)try{a.play();}catch{}});
  }
 }
 private play(key:string):void{const a=this.sounds[key];if(a&&a.clip&&!this.paused)try{a.stop();a.play();}catch{}}
 private bindTouch():void{
  this.canvas.on(Node.EventType.TOUCH_START,this.onTouchStart,this);
  this.canvas.on(Node.EventType.TOUCH_MOVE,this.onTouchMove,this);
  this.canvas.on(Node.EventType.TOUCH_END,this.onTouchEnd,this);
  this.canvas.on(Node.EventType.TOUCH_CANCEL,this.onTouchEnd,this);
 }
 private point(e:EventTouch):{x:number;y:number}{
  const loc=e.getUILocation();const local=this.canvas.getComponent(UITransform)!.convertToNodeSpaceAR(new Vec3(loc.x,loc.y,0));return{x:local.x,y:local.y};
 }
 private inside(x:number,y:number,bx:number,by:number,w:number,h:number){return Math.abs(x-bx)<=w/2 && Math.abs(y-by)<=h/2;}
 private onTouchStart(e:EventTouch):void{
  if(!this.ready)return;const p=this.point(e);const phase=this.rules.state.phase;
  if(phase==='exploring'){
   if(p.y<-390-this.edgeY&&p.x<-50){this.dragging=true;this.dragId=e.getID();this.dragStartX=p.x;this.dragStartY=p.y;this.moveStick(p.x,p.y);return;}
   if(this.inside(p.x,p.y,252,-527-this.edgeY,135,155)){if(this.rules.pulse())this.play('pulse');return;}
   if(this.inside(p.x,p.y,86,-545-this.edgeY,110,120)){if(this.rules.dash())this.play('dash');return;}
   return;
  }
  if(this.adBusy)return;
  if(phase==='camp'){
   if(this.inside(p.x,p.y,0,-325-this.edgeY,540,94)){this.launch();return;}
   if(this.inside(p.x,p.y,-212,-485-this.edgeY,195,84)){this.purchase('flame');return;}
   if(this.inside(p.x,p.y,0,-485-this.edgeY,195,84)){this.purchase('pulse');return;}
   if(this.inside(p.x,p.y,212,-485-this.edgeY,195,84)){this.purchase('stride');return;}
  }
  if(phase==='choice'){
   if(this.inside(p.x,p.y,0,-35,470,92)){this.rules.choose('extract');this.pageNeedsRebuild=true;this.play('portal');return;}
   if(this.rules.state.depth<3 && this.inside(p.x,p.y,0,-151,470,92)){this.rules.choose('deeper');this.clearEntities();this.pageNeedsRebuild=true;this.play('portal');return;}
  }
  if(phase==='settled'||phase==='defeated'){
   if(this.inside(p.x,p.y,0,-237,470,90)){this.finish();return;}
   if(phase==='settled'&&this.ad.enabled&&!this.adAlreadyPlayed&&this.inside(p.x,p.y,0,-110,470,84)){void this.rewardedBonus();return;}
  }
 }
 private onTouchMove(e:EventTouch):void{if(!this.dragging||e.getID()!==this.dragId)return;const p=this.point(e);this.moveStick(p.x,p.y);}
 private onTouchEnd(e:EventTouch):void{if(!this.dragging||e.getID()!==this.dragId)return;this.dragging=false;this.dragId=-999;this.rules.move(0,0);this.stickKnob.node.setPosition(-222,-540-this.edgeY,0);}
 private moveStick(x:number,y:number):void{
  const xx=clamp(x-this.dragStartX,-78,78),yy=clamp(y-this.dragStartY,-78,78);
  const mag=Math.hypot(xx,yy),r=mag>78?78/mag:1;
  const dx=xx*r,dy=yy*r;this.stickKnob.node.setPosition(-222+dx,-540-this.edgeY+dy,0);
  this.rules.move(mag<9?0:dx/78,mag<9?0:dy/78);
 }
 private launch():void{
  this.seedId++;this.rules.begin(((Date.now()%2147483000)+this.seedId*7919)>>>0);
  this.extraAdReward=0;this.adAlreadyPlayed=false;this.clearEntities();this.pageNeedsRebuild=true;this.play('portal');
 }
 private purchase(key:'flame'|'pulse'|'stride'):void{
  if(this.rules.buy(key)){ProgressStore.write(this.rules.progress);this.pageNeedsRebuild=true;this.play('pickup');}
  else this.toast('灯灰不足，先去秘境收集');
 }
 private finish():void{
  if(this.adBusy)return;this.rules.finish();if(this.extraAdReward>0)this.rules.progress.currency+=this.extraAdReward;
  this.extraAdReward=0;ProgressStore.write(this.rules.progress);this.clearEntities();this.pageNeedsRebuild=true;this.play('pickup');
 }
 private async rewardedBonus():Promise<void>{
  if(this.adBusy||this.adAlreadyPlayed||!this.ad.enabled||this.rules.state.phase!=='settled')return;
  this.adBusy=true;const ok=await this.ad.show();this.adBusy=false;
  if(this.rules.state.phase!=='settled')return;
  if(ok){this.adAlreadyPlayed=true;const s=this.rules.state;this.extraAdReward=Math.floor((s.carried+Math.max(0,s.depth-1)*7)*.5);this.toast(`完整观看成功 · 额外获得 ${this.extraAdReward}`);this.play('pickup');}
  else this.toast('未完整观看，不发放奖励');
  this.pageNeedsRebuild=true;
 }
 private clearEntities():void{
  for(const v of this.enemyVisuals.values())v.node.destroy();this.enemyVisuals.clear();
  for(const v of this.pickupVisuals.values())v.node.destroy();this.pickupVisuals.clear();
  for(const b of this.bursts)b.node.destroy();this.bursts=[];
  for(const f of this.floaters)f.node.destroy();this.floaters=[];
 }
 private toast(message:string):void{this.statusText=message;this.statusTime=2.8;if(this.toastText)this.toastText.string=message;}
 private rebuildOverlay():void{
  if(!this.ready)return;
  const s=this.rules.state,phase=s.phase;
  this.phaseOnScreen=phase;this.pageNeedsRebuild=false;
  for(const child of [...this.menu.children])child.destroy();
  this.menu.removeAllChildren();
  this.menu.active=phase!=='exploring';this.hud.active=phase==='exploring';
  this.portal.node.active=phase==='exploring';this.portalGlow.node.active=phase==='exploring';
  if(phase==='exploring'){this.player.node.active=true;this.playerGlow.node.active=true;this.toast(s.depth===1?'移动探索 · 脉冲可照出隐藏灯种':'新区域 · 敌人更强，带好灯火');return;}
  if(phase==='camp'){
   this.player.node.active=false;this.playerGlow.node.active=false;
   this.panel(this.menu,0,485+this.edgeY,695,165,'#0f2226',231,24);
   const logo=this.menuLabel('烬灯秘境',0,517+this.edgeY,65,'#ffe0a0');logo.isBold=true;
   this.menuLabel('一盏灯，带走森林的秘密',0,445+this.edgeY,24,'#c6e4d9');
   const lantern=this.makeTexture('CampLandmark',this.menu,30,145,345,355);this.setImage(lantern,'camp');
   const front=this.makeTexture('CampHero',this.menu,-210,64,196,220);this.setImage(front,'hero-front');
   const seed=this.makeTexture('CampSeed',this.menu,194,85,96,105);this.setImage(seed,'lampseed');
   this.panel(this.menu,0,-155,635,144,'#112730',231,18);
   this.menuLabel(`拥有灯灰：${s===undefined?'0':this.rules.progress.currency}`,0,-128,31,'#ffe6a0');
   this.menuLabel(`最好抵达第 ${this.rules.progress.bestDepth} 层 · 已远征 ${this.rules.progress.runs} 次`,0,-182,20,'#c5d6d4');
   this.button(this.menu,'提灯出征',0,-326-this.edgeY,516,92,true);
   const u=this.rules.progress.upgrades;
   this.menuLabel('永久强化 · 每次远征都能积累',0,-415-this.edgeY,24,'#f1d49e');
   const data:[keyof typeof u,string,number][]=[['flame','灯芯容量',-212],['pulse','光焰威力',0],['stride','移动步伐',212]];
   for(const [key,title,x] of data){
    const can=this.rules.progress.currency>=upgradeCost(u,key)&&u[key]<9;
    this.button(this.menu,`${title}  ${u[key]}/9`,x,-484-this.edgeY,192,81,can);
    this.menuLabel(u[key]>=9?'已满级':`消耗 ${upgradeCost(u,key)}`,x,-547-this.edgeY,18,can?'#ffdf9b':'#a4aba5',190);
   }
   this.menuLabel('单人离线存档 · 所有成长由游玩获得',0,-604-this.edgeY,18,'#acbbb8');
   return;
  }
  if(phase==='choice'){
   this.panel(this.menu,0,0,680,1040,'#0c1b21',237,30);
   const art=this.makeTexture('GateChoice',this.menu,0,270,290,321);this.setImage(art,'portal');
   this.menuLabel(`第 ${s.depth} 层 · 通道苏醒`,0,445,43,'#ffe3aa');
   this.menuLabel(`灯种已齐 · 本局携带 ${s.carried} 灯灰`,0,90,28,'#e7d7b3');
   this.button(this.menu,`平安撤离 · 结算 ${s.carried+Math.max(0,s.depth-1)*7}`,0,-35,500,90,true);
   this.button(this.menu,s.depth>=3?'已经抵达最深处 · 结算':'继续深入 · 奖励更高',0,-151,500,92,s.depth<3);
   this.menuLabel('继续深入将保留损伤，补充部分灯火',0,-259,22,'#c1cfd1');
   this.menuLabel('倒下只能带回本局灯灰的 35%',0,-304,22,'#e5aa8d');
   this.menuLabel('灯火会消耗，勇气不必每次都赌上',0,-445,20,'#acbab3');
   return;
  }
  const win=phase==='settled';
  this.panel(this.menu,0,0,686,1005,'#102127',239,25);
  const icon=this.makeTexture('ResultEmblem',this.menu,0,265,225,240);this.setImage(icon,win?'lampseed':'hunter');
  this.menuLabel(win?'远征凯旋':'提灯熄灭',0,442,55,win?'#ffe19f':'#ffb2a0');
  const earned=win?s.carried+Math.max(0,s.depth-1)*7:Math.floor(s.carried*.35);
  this.menuLabel(`深入：第 ${s.maxDepthReached} 层`,0,103,26,'#d9e8df');
  this.menuLabel(`击退暗影：${s.kills}`,0,59,25,'#d9e8df');
  this.menuLabel(`可带回灯灰：${earned+this.extraAdReward}`,0,4,35,'#ffdc91');
  if(win && this.ad.enabled && !this.adAlreadyPlayed){
   this.button(this.menu,'观看视频 · 额外获得 50%',0,-109,500,78,true);
  }else{
   this.menuLabel(!win?'尚可保留 35% 的收获':this.adAlreadyPlayed?'额外奖励已领取':'不看广告也能完整游玩',0,-117,22,'#a6c6bf');
  }
  this.button(this.menu,'返回营地 · 永久保留成果',0,-238,510,85,true);
  this.menuLabel('下一次的灯，将比这一盏更亮',0,-398,24,'#b0c5b9');
 }
 private makeFloat(message:string,x:number,y:number,color:string='#fbe6a5',size=29):void{
  if(this.floaters.length>17){this.floaters.shift()!.node.destroy();}
  const text=this.label(message,this.vfx,x,y,size,color,180,65);
  this.floaters.push({node:text.node,life:1.0,speed:62});
 }
 private burst(x:number,y:number,kind:'pulse'|'blue'|'orange'='pulse'):void{
  if(this.bursts.length>=12)this.bursts.shift()!.node.destroy();
  const size=kind==='pulse'?190:114;
  const v=this.makeTexture('MagicBurst',this.vfx,x,y,size,size,245);this.setImage(v,kind==='blue'?'blue-glow':kind==='orange'?'glow':'pulse');
  this.bursts.push({node:v.node,opacity:v.opacity,life:kind==='pulse'?.62:.45,max:kind==='pulse'?.62:.45,scale:1,rotation:this.elapsed*29});
 }
 private displayEvents(events:RunEvent[]):void{
  for(const ev of events){
   if(ev.kind==='pulse'){this.burst(ev.x,ev.y);this.makeFloat('光焰脉冲',ev.x,ev.y+86,'#ffe3a3',24);}
   if(ev.kind==='dash'){this.burst(ev.x,ev.y,'blue');}
   if(ev.kind==='hit'){this.makeFloat('-'+ev.amount,ev.x,ev.y+58,'#ffd99a',31);this.burst(ev.x,ev.y,'orange');this.play('hit');}
   if(ev.kind==='kill'){this.makeFloat('驱散',ev.x,ev.y+75,'#dbf5ce',25);}
   if(ev.kind==='pickup'){this.makeFloat(ev.tag==='seed'?`灯灰 +${ev.amount}`:'补充火焰',ev.x,ev.y+72,ev.tag==='seed'?'#ffe196':'#a4e9ef',29);this.play('pickup');}
   if(ev.kind==='reveal'){this.burst(ev.x,ev.y,'orange');}
   if(ev.kind==='portal'){this.toast('出口已点亮 · 前往上方遗迹');this.play('portal');this.burst(ev.x,ev.y,'blue');}
   if(ev.kind==='hurt'){this.play('hurt');this.makeFloat('受伤!',ev.x,ev.y+80,'#ff9b88',38);}
   if(ev.kind==='near-death')this.toast('生命危急 · 把握撤离机会');
   if(ev.kind==='ambush'){this.toast('暗影巡猎者正在靠近！');this.burst(ev.x,ev.y,'blue');}
   if(ev.kind==='defeat'){this.pageNeedsRebuild=true;this.play('hurt');}
  }
 }
 private visualForEnemy(e:Enemy):SpriteVisual{
  let v=this.enemyVisuals.get(e.id);if(v)return v;
  const kind=e.kind;const size=kind==='hunter'?112:kind==='mantis'?110:102;
  v=this.makeTexture('Enemy-'+e.id,this.sprites,e.x,e.y,size,size,255);this.setImage(v,kind);
  const sh=this.makeTexture('Shadow-'+e.id,this.sprites,e.x,e.y-32,size*.72,size*.25,116);this.setImage(sh,'shadow');v.shadow=sh.node;
  this.enemyVisuals.set(e.id,v);return v;
 }
 private visualForPickup(p:Pickup):SpriteVisual{
  let v=this.pickupVisuals.get(p.id);if(v)return v;
  v=this.makeTexture('Pickup-'+p.id,this.sprites,p.x,p.y,p.kind==='seed'?63:81,p.kind==='seed'?73:88,235);
  this.setImage(v,p.kind==='seed'?'lampseed':'refill');this.pickupVisuals.set(p.id,v);return v;
 }
 private drawEntities(dt:number):void{
  const s=this.rules.state,h=s.hero;
  this.player.node.active=true;this.playerGlow.node.active=true;
  let pose='hero-front';
  if(this.dragging){const dx=this.stickKnob.node.position.x+222,dy=this.stickKnob.node.position.y+540;
   if(Math.abs(dx)>21)pose=dx<0?'hero-run-left':'hero-run-right';else if(dy>17)pose='hero-back';}
  if(pose!==this.currentPose){this.currentPose=pose;this.setImage(this.player,pose);}
  this.player.node.setPosition(h.x,h.y+6+Math.sin(this.elapsed*10)*(this.dragging?5:2),0);
  const scale=1+Math.sin(this.elapsed*(this.dragging?14:3))*(this.dragging?.045:.015);
  this.player.node.setScale(scale,scale,1);
  this.player.opacity.opacity=h.hitflash>0 && Math.floor(this.elapsed*18)%2===0?92:255;
  this.playerGlow.node.setPosition(h.x+26,h.y+30,0);
  this.playerGlow.opacity.opacity=clamp(h.flame/h.maxFlame*230,65,225);
  this.playerGlow.node.setScale(.85+.07*Math.sin(this.elapsed*4),.85+.07*Math.sin(this.elapsed*4),1);
  this.vignette.opacity.opacity=Math.floor(195+ (1-h.flame/h.maxFlame)*60);
  this.portal.opacity.opacity=s.portalReady?245:78;this.portalGlow.opacity.opacity=s.portalReady?168:35;
  this.portalGlow.node.setScale(1+.1*Math.sin(this.elapsed*2),1+.1*Math.sin(this.elapsed*2),1);
  const activeEnemies=new Set<string>();
  for(const e of s.enemies){
   if(e.hp<=0)continue;
   const v=this.visualForEnemy(e);activeEnemies.add(e.id);
   v.node.setPosition(e.x,e.y+Math.sin(e.phase)*3,0);
   if(v.shadow)v.shadow.setPosition(e.x,e.y-38,0);
   v.node.setScale(e.x>h.x?-1:1,1+Math.sin(e.phase)*.028,1);
   v.opacity.opacity=e.stun>0?185:255;
   // Winding up creates a readable, amber tell before contact damage.
   if(e.windup>0){v.node.setScale(e.x>h.x?-1.11:1.11,1.11,1);if(Math.floor(this.elapsed*16)%2===0)v.opacity.opacity=210;}
  }
  for(const [id,v] of this.enemyVisuals){if(!activeEnemies.has(id)){v.node.destroy();v.shadow?.destroy();this.enemyVisuals.delete(id);}}
  const activePickups=new Set<string>();
  for(const p of s.pickups){if(p.taken||!p.revealed)continue;
   const v=this.visualForPickup(p);activePickups.add(p.id);
   v.node.setPosition(p.x,p.y+Math.sin(this.elapsed*2.4+p.glimmer)*6,0);
   v.node.setScale(1+.055*Math.sin(this.elapsed*3+p.glimmer),1+.055*Math.sin(this.elapsed*3+p.glimmer),1);
  }
  for(const [id,v] of this.pickupVisuals){if(!activePickups.has(id)){v.node.destroy();this.pickupVisuals.delete(id);}}
  // A simple scene graph depth pass keeps feet and scenery grounded.
  const items:Node[]=[...this.enemyVisuals.values()].map(v=>v.node);
  items.push(...[...this.pickupVisuals.values()].map(v=>v.node));items.push(this.player.node);
  items.sort((a,b)=>b.position.y-a.position.y);
  for(const node of items)node.setSiblingIndex(this.sprites.children.length-1);
 }
 private drawHUD():void{
  const s=this.rules.state,h=s.hero;this.depthText.string=`第 ${s.depth} 层 · ${['','青影林','灰烬谷','夜冠深处'][s.depth]}`;
  this.hpText.string=`生命 ${h.hp} / ${h.maxHp}`;this.progressText.string=`灯种 ${Math.min(s.collected,s.target)} / ${s.target}`;
  this.currencyText.string=`携带 ${s.carried} 灯灰     敌影 ${s.enemies.filter(e=>e.hp>0).length}`;
  const bar=this.flameBar;bar.clear();bar.fillColor=G('#0a1619',220);bar.roundRect(-142,-20,284,19,9);bar.fill();
  const power=h.flame/h.maxFlame;
  bar.fillColor=power<.25?G('#fa7454'):G('#ffce6c');bar.roundRect(-138,-17,276*power,13,6);bar.fill();
  bar.lineWidth=1.5;bar.strokeColor=G('#ffe1a4',155);bar.roundRect(-142,-20,284,19,9);bar.stroke();
  if(this.statusTime>0){this.statusTime-=.05;}else this.toastText.string='';
 }
 private drawEffects(dt:number):void{
  for(let i=this.floaters.length-1;i>=0;i--){const f=this.floaters[i];f.life-=dt;
   if(f.life<=0){f.node.destroy();this.floaters.splice(i,1);continue;}
   f.node.setPosition(f.node.position.x,f.node.position.y+dt*f.speed,0);
   const lab=f.node.getComponent(Label);if(lab)lab.color=new Color(lab.color.r,lab.color.g,lab.color.b,Math.floor(Math.min(1,f.life*1.5)*255));
  }
  for(let i=this.bursts.length-1;i>=0;i--){const b=this.bursts[i];b.life-=dt;
   if(b.life<=0){b.node.destroy();this.bursts.splice(i,1);continue;}
   const progress=1-b.life/b.max;
   b.node.setScale(.5+progress*2.3,.5+progress*2.3,1);b.opacity.opacity=Math.floor(220*(1-progress)**1.4);
   b.node.setRotationFromEuler(0,0,progress*70+b.rotation);
  }
  for(let i=0;i<this.stars.length;i++){
   const v=this.stars[i];v.node.setPosition(v.node.position.x,v.node.position.y+dt*(2+i%3),0);
   if(v.node.position.y>540)v.node.setPosition(v.node.position.x,-480,0);
   v.opacity.opacity=clamp(55+Math.sin(this.elapsed*(.75+i%3*.3)+i)*44,15,115);
  }
 }
 update(dt:number):void{
  if(!this.ready||this.paused)return;
  dt=clamp(dt,0,.05);this.elapsed+=dt;this.frameClock+=dt;
  const before=this.rules.state.phase;
  if(before==='exploring'){
   this.rules.tick(dt);
   const events=this.rules.drainEvents();this.displayEvents(events);
   if(this.rules.state.phase!=='exploring'){this.dragging=false;this.rules.move(0,0);this.pageNeedsRebuild=true;this.play('portal');}
   else this.drawEntities(dt);
  }
  this.drawEffects(dt);
  if(this.frameClock>=.085){this.frameClock=0;if(this.rules.state.phase==='exploring')this.drawHUD();}
  if(this.pageNeedsRebuild||this.rules.state.phase!==this.phaseOnScreen)this.rebuildOverlay();
 }
}

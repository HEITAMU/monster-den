import {
  _decorator,Component,Node,Scene,Camera,Canvas,UITransform,Label,Graphics,Color,
  Vec2,Vec3,Quat,Layers,DirectionalLight,MeshRenderer,Material,utils,view,input,Input,UIOpacity,
  EventTouch,EventMouse,Game,game,tween,math,
} from 'cc';
import {GameModel,TOOLS} from './core/index';
import type {GameSnapshot,GameEvent,ToolId,ObstacleState,EnemyState} from './core/types';
import {SaveStore} from './platform/SaveStore';
import {RewardedAds} from './platform/RewardedAds';
import {GameAudio} from './platform/GameAudio';
import type {SoundCue} from './platform/GameAudio';
import {loadAudioCatalog} from './AudioCatalog';
import {ModelLibrary,ModelInstance,loadGameJson,loadGameEffects,makeMaterial,meshNode,discMesh,ringMesh} from './ModelLibrary';
import {PALETTE,rgba,uiNode,label,panel,button,separator} from './GameUI';

const {ccclass}=_decorator;
const VERSION='0.1.1';
const GROUND=.08,GROUND_EFFECT=.105;
type Page='loading'|'home'|'game'|'tools';
interface LocalRun {model:GameSnapshot;bonus:number;settled:boolean;bankedRooms:number;}
interface Visual {instance:ModelInstance;shadow:Node;scale:number;hit:number;phase:number;}
interface Spark {node:Node;vx:number;vy:number;vz:number;life:number;max:number;}
const TOOL_COST:Record<string,number>={heavy:300,grip:450,return:450};
const HINTS=['先撞开木栏，拿宝物，再去出口','推柜子挡住箭路，绕到后面拿宝物','撞开中间的厚木栏，去拿宝物','拿到宝物后，向左边出口撤离','看清冲锋方向，带走窝主的宝物'];

@ccclass('GameMain')
export class GameMain extends Component {
  model=new GameModel();
  private save!:SaveStore;private audio!:GameAudio;private ads!:RewardedAds;
  private env!:ModelLibrary;private characters!:ModelLibrary;
  private world!:Node;private roomWorld!:Node;private actorWorld!:Node;private effectsWorld!:Node;
  private canvas!:Node;private hud!:Node;private overlay!:Node;private floating!:Node;
  private worldCamera!:Camera;private cameraNode!:Node;private cameraBase=new Vec3(0,24,10);
  private hero!:Visual;private enemies=new Map<string,Visual>();private obstacles=new Map<string,ModelInstance>();
  private treasure:ModelInstance|null=null;private exitRing:Node|null=null;private heroRing:Node|null=null;
  private aimNodes:Node[]=[];private aimEnd:Node|null=null;private aimCaption:Label|null=null;
  private threatNodes=new Map<string,Node>();private arrowNodes=new Map<string,Node>();
  private matShadow!:Material;private matAim!:Material;private matDanger!:Material;private matGold!:Material;
  private sparkMaterials:Material[]=[];private sparks:Spark[]=[];
  private ready=false;private page:Page='loading';private height=1280;private time=0;private phase='';
  private runId='';private runMeta={bonus:0,settled:false,bankedRooms:0};
  private dragging=false;private dragStart=new Vec2();private dragNow=new Vec2();private dragPower=0;private lastAim=new Vec2(0,1);
  private activeTouchId:number|null=null;private heldMouse=false;private shake=0;private background=false;private adBusy=false;private rewardPending=false;
  private overlayPhase='';private tipTimer=0;private tip='';private toastNode:Node|null=null;
  private roomLabel!:Label;private hpLabel!:Label;private lootLabel!:Label;private hintLabel!:Label;private phaseLabel!:Label;
  private toolButton:Node|null=null;private toolGlow:Node|null=null;private stepDots:Label[]=[];private tutorialText:Label|null=null;
  private lastHeight=0;private homeHeroRotation=0;private saveClock=0;

  async start():Promise<void> {
    this.save=new SaveStore({onWarning:m=>this.toast(m)});
    this.createScene();this.drawLoading('准备探索装备…');
    try {
      await loadGameEffects();
      const [environment,characters,audioAssets]=await Promise.all([loadGameJson('models/environment'),loadGameJson('models/characters'),loadAudioCatalog(message=>{console.warn('[MonsterDen audio]',message);this.toast('部分音效未能加载，场景仍可继续');})]);
      this.audio=new GameAudio({...audioAssets,settings:this.save.read().settings,allowProceduralFallback:false,onWarning:message=>{
        console.warn('[MonsterDen audio]',message);this.toast('声音资源暂未准备好，可重新进入重试');
      }});
      this.ads=new RewardedAds({ledger:this.save,adUnitId:'',allowWebTestAds:false,onPhaseChange:phase=>{
        this.adBusy=phase!=='idle';if(this.adBusy)this.audio.pause('ad');else void this.audio.resume('ad');
      }});
      this.drawLoading('准备乐队与音效…');await this.audio.prepare();
      this.env=new ModelLibrary(environment);this.characters=new ModelLibrary(characters);
      this.createEffects();this.ready=true;this.restoreRun();this.renderRoom();this.showHome();
      this.bindInput();
      (globalThis as any).__MONSTER_DEN__={controller:this,model:this.model,version:VERSION,start:()=>this.startRun(),
        getState:()=>JSON.parse(JSON.stringify(this.model.state)),resume:()=>this.continueRun(),
        shoot:(x:number,y:number,p=1)=>this.model.shoot({x,y},p),activateTool:()=>this.model.activateTool(),
        nextRoom:(tool:ToolId)=>this.advance(tool),save:()=>this.persist()};
    } catch(error) {
      console.error('[MonsterDen asset load]',error);this.drawLoading('场景资源加载失败\n请检查网络后重新进入');
      const boot=(globalThis as any).__monsterDenRuntime;if(boot)boot.errors.push(String(error));
    }
  }

  private createScene():void {
    this.world=new Node('MonsterDenWorld');this.world.parent=this.node;
    this.roomWorld=new Node('Room');this.roomWorld.parent=this.world;
    this.actorWorld=new Node('Actors');this.actorWorld.parent=this.world;
    this.effectsWorld=new Node('Effects');this.effectsWorld.parent=this.world;
    this.cameraNode=new Node('AdventureCamera');this.cameraNode.parent=this.node;
    this.cameraNode.setPosition(this.cameraBase);this.cameraNode.lookAt(new Vec3(0,0,0));
    this.worldCamera=this.cameraNode.addComponent(Camera);this.worldCamera.projection=Camera.ProjectionType.ORTHO;
    this.worldCamera.near=.1;this.worldCamera.far=100;this.worldCamera.clearFlags=Camera.ClearFlag.SOLID_COLOR;
    this.worldCamera.clearColor=rgba('#12292b');this.worldCamera.visibility=Layers.BitMask.DEFAULT;this.worldCamera.priority=0;
    const lightNode=new Node('WarmKey');lightNode.parent=this.node;lightNode.setRotationFromEuler(-55,-35,0);
    const light=lightNode.addComponent(DirectionalLight);light.color=rgba('#ffedcf');light.illuminance=1;
    this.canvas=new Node('Interface');this.canvas.parent=this.node;this.canvas.layer=Layers.Enum.UI_2D;
    const transform=this.canvas.addComponent(UITransform);transform.setContentSize(720,1280);
    const uiCameraNode=new Node('InterfaceCamera');uiCameraNode.parent=this.canvas;uiCameraNode.setPosition(0,0,1000);
    const cam=uiCameraNode.addComponent(Camera);cam.projection=Camera.ProjectionType.ORTHO;cam.orthoHeight=640;
    cam.near=.1;cam.far=2000;cam.clearFlags=Camera.ClearFlag.DEPTH_ONLY;cam.visibility=Layers.BitMask.UI_2D;cam.priority=10;
    const canvas=this.canvas.addComponent(Canvas);canvas.cameraComponent=cam;canvas.alignCanvasWithScreen=true;
    this.hud=uiNode('HUD',this.canvas,720,1280);this.overlay=uiNode('Overlay',this.canvas,720,1280);this.floating=uiNode('Floaters',this.canvas,720,1280);
    this.resize();
  }

  private resize():void {
    const size=view.getVisibleSize();this.height=size.height||1280;this.lastHeight=this.height;
    this.worldCamera.orthoHeight=5.85/(size.width/size.height);
    for(const root of [this.hud,this.overlay,this.floating])root.getComponent(UITransform)!.setContentSize(720,this.height);
  }
  private clear(node:Node):void{for(const child of [...node.children])child.destroy();node.removeAllChildren();}
  private drawLoading(text:string):void{
    this.clear(this.overlay);label(this.overlay,'撞进怪物窝',48,0,90,650,80,PALETTE.gold,true);
    label(this.overlay,text,25,0,-30,620,130,PALETTE.muted);label(this.overlay,'正在准备完整场景',19,0,-130,620,40,PALETTE.muted);
  }
  private createEffects():void {
    this.matShadow=makeMaterial(new Color(7,20,18,255),false,true,true);
    this.matAim=makeMaterial(rgba('#8be3bc'),false,true,true,.6);
    this.matDanger=makeMaterial(new Color(236,105,78,150),false,true,true);
    this.matGold=makeMaterial(rgba('#ffdb7c'),false,true,true,.8);
    this.sparkMaterials=['#ffe1a0','#aaead0','#d39b61','#ef9b7d'].map(c=>makeMaterial(rgba(c),false,false,false,.8));
    for(let i=0;i<24;i++){const node=meshNode('AimMark',discMesh(.07,.95,.8,12),this.matAim,this.effectsWorld);node.active=false;this.aimNodes.push(node);}
    this.aimEnd=meshNode('AimEndpoint',ringMesh(.38,.055),this.matAim,this.effectsWorld);this.aimEnd.active=false;
    this.aimCaption=label(this.floating,'',20,0,0,180,35,PALETTE.mint,true);this.aimCaption.node.active=false;
  }
  private instantiate(key:string,parent:Node,x=0,y=0,scale=1):ModelInstance{
    const instance=this.env.instantiate(key,parent,scale);instance.root.setPosition(x,key==='floor'||key==='trim'?0:GROUND,-y);return instance;
  }
  private makeActor(key:string,x:number,y:number,scale:number):Visual {
    const instance=this.characters.instantiate(key,this.actorWorld,scale);instance.root.setPosition(x,GROUND,-y);
    const shadow=meshNode('ContactShadow',discMesh(1,.28,0,36),this.matShadow,this.actorWorld);shadow.setPosition(x,GROUND_EFFECT,-y);shadow.setScale(.72*scale,1,.5*scale);
    return {instance,shadow,scale,hit:0,phase:Math.random()*6};
  }
  private renderRoom():void {
    this.clear(this.roomWorld);this.clear(this.actorWorld);this.enemies.clear();this.obstacles.clear();
    for(const node of this.threatNodes.values())node.destroy();this.threatNodes.clear();
    for(const node of this.arrowNodes.values())node.destroy();this.arrowNodes.clear();
    this.heroRing?.destroy();this.exitRing?.destroy();this.clearAim();
    const state=this.model.state;
    this.instantiate('floor',this.roomWorld);
    if(this.env.has('trim'))this.instantiate('trim',this.roomWorld);
    for(const o of state.obstacles){if(o.destroyed)continue;const key=this.env.has(o.kind)?o.kind:'pillar';const object=this.instantiate(key,this.roomWorld,o.x,o.y);this.env.fitFootprint(object,key,o.w,o.h);this.obstacles.set(o.id,object);}
    this.treasure=this.instantiate('treasure',this.roomWorld,state.treasure.x,state.treasure.y,.75);this.treasure.root.active=!state.treasure.taken;
    this.instantiate('exit',this.roomWorld,state.exit.x,state.exit.y,.8);
    this.exitRing=meshNode('ExitGlow',ringMesh(.8,.12),this.matGold,this.roomWorld);this.exitRing.setPosition(state.exit.x,GROUND_EFFECT,-state.exit.y);
    const decor=[[-5.15,-5.2,'fern',1.1],[-5.1,3.8,'fern',1.3],[5.1,2.8,'fern',1.3],[5.1,-4.8,'mushroom',1.2],[-5.2,0,'mushroom',1],[-4.6,6.5,'lantern',1],[4.7,6.4,'lantern',1]] as const;
    for(const [x,y,key,s] of decor)if(this.env.has(key))this.instantiate(key,this.roomWorld,x,y,s);
    this.hero=this.makeActor('hero',state.player.x,state.player.y,.72);
    this.heroRing=meshNode('PlayerRing',ringMesh(.48,.065),this.matAim,this.actorWorld);
    for(const enemy of state.enemies){if(!enemy.alive)continue;const key=enemy.kind==='charger'?'boss':enemy.kind;this.enemies.set(enemy.id,this.makeActor(key,enemy.x,enemy.y,enemy.kind==='boss'?.97:enemy.kind==='charger'?.58:.66));
      const danger=meshNode('EnemyIntent',this.beamMesh(),this.matDanger,this.effectsWorld);this.threatNodes.set(enemy.id,danger);}
    this.phase='';this.overlayPhase='';this.shake=0;
  }
  private beamMesh():any{return {positions:[-.5,0,-.5,.5,0,-.5,-.5,0,.5,.5,0,.5],normals:[0,1,0,0,1,0,0,1,0,0,1,0],colors:[1,1,1,.04,1,1,1,.04,1,1,1,.45,1,1,1,.45],uvs:[0,0,1,0,0,1,1,1],indices:[0,2,1,1,2,3]};}

  private showHome():void {
    if(this.adBusy||this.rewardPending)return;
    this.cancelDrag();this.page='home';this.clear(this.hud);this.clear(this.overlay);this.overlayPhase='';
    this.updateMusicScene();
    for(const t of this.threatNodes.values())t.active=false;
    const top=this.height/2,bottom=-top;
    label(this.hud,'MONSTER DEN',17,0,top-77,640,32,PALETTE.muted,true);
    label(this.hud,'撞进怪物窝',53,0,top-134,650,80,PALETTE.cream,true);
    label(this.hud,'撞开一条路，把宝物带出来',23,0,top-192,630,45,PALETTE.gold);
    this.soundButton();
    const saved=this.save.getSnapshot<LocalRun>();const savedPhase=saved?.state?.model?.state?.phase;
    const terminal=savedPhase==='victory'||savedPhase==='game_over';
    const canContinue=!!savedPhase&&(!terminal||!saved!.state.settled||(savedPhase==='victory'&&!saved!.state.bonus));
    const p=panel(this.hud,660,250,0,bottom+176,PALETTE.deep,'#738e77',26,246);
    button(p,canContinue?(terminal?'查看冒险结算':'继续这次冒险'):'潜入怪物窝',0,55,590,76,()=>canContinue?this.continueRun():this.startRun());
    button(p,'工具柜',-152,-42,280,66,()=>this.showTools(),false);
    button(p,canContinue?'重新出发':'怎么玩',152,-42,280,66,()=>canContinue?this.confirmNewRun():this.showHelp(),false);
    const coins=this.save.read().progress.coins||0;label(p,`已带回 ${coins} 枚金币`,21,0,-97,600,35,PALETTE.muted);
    label(this.hud,`首段冒险 · ${VERSION}`,17,0,bottom+25,630,30,'#72958e');
  }
  private soundButton():void {
    const muted=this.audio.settings.muted;
    button(this.hud,muted?'静音':'声音',286,this.height/2-54,100,47,()=>{this.clickSound();this.audio.setMuted(!this.audio.settings.muted);this.save.updateSettings({muted:this.audio.settings.muted});if(this.page==='home')this.showHome();else this.drawHud();},false);
  }
  private clickSound():void{void this.audio.unlock().then(()=>{this.audio.startMusic();this.audio.play('click');});}
  private updateMusicScene():void {
    const scene=this.page==='game'?(this.model.state.roomIndex===4?'boss':'explore'):'camp';
    this.audio.setMusicScene(scene);
    // Decoded music is bounded to the current and next scene; the mixer retires
    // the previous buffer after its crossfade, including quick menu changes.
    if(scene==='camp')void this.audio.preloadMusic('explore');
    else if(this.model.state.roomIndex===3)void this.audio.preloadMusic('boss');
  }
  private showHelp():void {
    this.clickSound();this.clear(this.overlay);const p=panel(this.overlay,650,490,0,0,PALETTE.deep);
    label(p,'带着宝物离开',36,0,173,590,65,PALETTE.gold,true);
    label(p,'在场景上按住，向后拖拽\n松手后，小兽会沿瞄准方向冲出\n\n撞柜子挡箭，撞木栏开路\n拿到宝物后，进入发光出口',26,0,15,580,240);
    button(p,'明白了',0,-170,530,72,()=>{this.clickSound();this.clear(this.overlay);});
  }
  private confirmNewRun():void {
    this.clickSound();this.clear(this.overlay);const p=panel(this.overlay,640,320,0,0,PALETTE.deep);
    label(p,'开始新的冒险？',34,0,94,590,65,PALETTE.gold,true);label(p,'当前这局将结束，已解锁工具保留。',24,0,23,590,55);
    button(p,'继续当前冒险',0,-60,540,65,()=>this.continueRun());button(p,'重新出发',0,-137,540,50,()=>this.startRun(),false);
  }
  private showTools():void {
    if(this.adBusy||this.rewardPending)return;
    this.cancelDrag();this.clickSound();this.page='tools';this.clear(this.hud);this.clear(this.overlay);const d=this.save.read();
    this.updateMusicScene();
    label(this.hud,'探险工具柜',43,0,this.height/2-106,650,75,PALETTE.gold,true);
    label(this.hud,`金币 ${d.progress.coins||0} · 开局可携带一件`,22,0,this.height/2-163,650,44,PALETTE.muted);
    TOOLS.forEach((tool,i)=>{
      const p=panel(this.overlay,650,192,0,190-i*216,PALETTE.deep,'#77957d');
      label(p,tool.name,31,-80,54,430,55,PALETTE.cream,true);label(p,tool.description,22,-24,-2,580,65,PALETTE.muted);
      const unlocked=d.progress.unlockedTools.includes(tool.id),selected=d.progress.startingTool===tool.id;
      button(p,selected?'已携带':unlocked?'开局携带':`${TOOL_COST[tool.id]} 金币解锁`,0,-61,570,47,()=>{
        this.clickSound();const current=this.save.read();if(!unlocked&&(current.progress.coins||0)<TOOL_COST[tool.id]){this.toast('带出宝物，结算后就能解锁');return;}
        this.save.update(doc=>{if(!doc.progress.unlockedTools.includes(tool.id)){doc.progress.coins=(doc.progress.coins||0)-TOOL_COST[tool.id];doc.progress.unlockedTools.push(tool.id);}doc.progress.startingTool=tool.id;});this.showTools();
      },!selected);
    });
    button(this.hud,'回到营地',0,-this.height/2+85,590,70,()=>this.showHome(),false);
  }
  private startRun():void {
    if(!this.ready||this.adBusy||this.rewardPending)return;
    if(['victory','game_over'].includes(this.model.state.phase)&&!this.runMeta.settled&&!this.settle())return;
    this.cancelDrag();this.clickSound();this.model.restart();const tool=this.save.read().progress.startingTool as ToolId;
    if(tool&&this.save.read().progress.unlockedTools.includes(tool))this.model.equipStartingTool(tool);
    this.runId=`den-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;this.runMeta={bonus:0,settled:false,bankedRooms:0};
    this.save.update(d=>{d.progress.runsPlayed++;});this.page='game';this.updateMusicScene();this.renderRoom();this.drawHud();this.clear(this.overlay);this.persist();
  }
  private continueRun():void{if(this.adBusy||this.rewardPending)return;this.clickSound();this.restoreRun();this.page='game';this.updateMusicScene();this.renderRoom();this.drawHud();this.clear(this.overlay);}
  private restoreRun():void {
    const saved=this.save.getSnapshot<LocalRun>();if(saved){try{this.model.restore(saved.state.model);this.runId=saved.runId;this.runMeta={bonus:saved.state.bonus||0,settled:!!saved.state.settled,bankedRooms:saved.state.bankedRooms||0};}catch(e){console.warn('Run restore failed',e);this.save.clearSnapshot();this.model.restart();this.runId='';this.runMeta={bonus:0,settled:false,bankedRooms:0};}}
    if(!this.runId)this.runId=`den-${Date.now()}`;
    for(const receipt of this.save.pendingRewards(this.runId))this.applyReceipt(receipt.id,receipt.placement);
  }
  private persist():boolean{return !!(this.ready&&this.runId&&this.save.saveSnapshot(this.runId,{model:this.model.snapshot(),...this.runMeta}).ok);}
  private drawHud():void {
    this.clear(this.hud);this.clear(this.overlay);this.overlayPhase='';const top=this.height/2,bottom=-top;
    panel(this.hud,672,172,0,top-127,PALETTE.deep,'#607d6d',22,243);
    this.roomLabel=label(this.hud,'',32,-66,top-90,480,53,PALETTE.cream,true);
    this.hpLabel=label(this.hud,'',29,-184,top-143,280,45,PALETTE.danger,true);
    this.lootLabel=label(this.hud,'',24,189,top-143,270,45,PALETTE.gold,true);
    this.stepDots=[];for(let i=0;i<5;i++)this.stepDots.push(label(this.hud,'●',17,-66+i*33,top-193,30,30));
    this.soundButton();button(this.hud,'营地',-287,top-42,95,43,()=>{this.persist();this.showHome();},false);
    const dock=panel(this.hud,672,180,0,bottom+138,PALETTE.deep,'#6e8c79',25,250);
    this.hintLabel=label(dock,'',24,0,48,620,64,PALETTE.cream);
    this.phaseLabel=label(dock,'',20,-145,-23,330,50,PALETTE.muted);
    this.toolButton=button(dock,'使用工具',171,-27,275,62,()=>{
      this.clickSound();const p=this.model.state.player;
      if(!this.model.activateTool())this.showTip(p.tool==='none'?'带出这间的宝物，就能选一件工具':p.tool==='heavy'?'重撞持续生效：撞击更强，推柜更远':!p.toolReady?'这回合已经用过，下一回合恢复':'冲出去以后，再点击工具',2);
      else{this.cancelDrag();this.persist();}
    },false);
    this.toolButton.addComponent(UIOpacity);
    this.toolGlow=uiNode('ToolReadyGlow',this.toolButton,275,62);
    const glow=this.toolGlow.addComponent(Graphics);glow.lineWidth=3;glow.strokeColor=rgba(PALETTE.gold);glow.roundRect(-137,-31,274,62,20);glow.stroke();this.toolGlow.active=false;
    this.tutorialText=label(this.hud,'拖拽瞄准 · 松手出击',20,0,bottom+24,650,35,PALETTE.muted);
    this.updateHud();
  }
  private updateHud():void {
    if(this.page!=='game'||!this.roomLabel)return;const s=this.model.state,p=s.player;
    this.roomLabel.string=`${s.roomIndex+1} / 5  ${s.roomName}`;
    this.hpLabel.string='♥'.repeat(p.hp)+'♡'.repeat(Math.max(0,p.maxHp-p.hp));
    this.lootLabel.string=s.treasure.taken?'宝物已到手':'寻找宝物';
    this.stepDots.forEach((l,i)=>{l.color=rgba(i<=s.roomIndex?PALETTE.gold:'#486961');});
    this.hintLabel.string=this.tipTimer>0?this.tip:s.treasure.taken?'宝物到手，前往发光出口':HINTS[s.roomIndex];
    this.phaseLabel.string=this.dragging?`力度 ${Math.round(this.dragPower*100)}%`:s.phase==='moving'?'正在冲撞':s.phase==='enemies'?'守卫即将行动':p.tool==='grip'&&!p.toolReady?'抓停成功 · 再次瞄准':`第 ${s.turn+1} 次行动`;
    const tool=TOOLS.find(t=>t.id===p.tool);const toolLabel=this.toolButton?.getComponentsInChildren(Label)[0];
    const activeTool=p.tool==='grip'||p.tool==='return',available=activeTool&&p.toolReady&&s.phase==='moving';
    if(toolLabel){
      toolLabel.string=!tool?'下间房选工具':p.tool==='heavy'?'重撞 · 持续生效':!p.toolReady?'本回合已使用':s.phase==='moving'?tool.actionLabel:'冲撞时可用';
      toolLabel.color=rgba(available?PALETTE.gold:PALETTE.cream);
    }
    if(this.toolGlow)this.toolGlow.active=available;
    const opacity=this.toolButton?.getComponent(UIOpacity);if(opacity)opacity.opacity=available||p.tool==='heavy'?255:170;
    if(this.tutorialText){
      this.tutorialText.string=s.shots===0?(this.dragging?(this.dragPower>.1?'松手！撞开前面的木栏':'向后拖远一点，看看前方路线'):'按住场景，向后拉，再松手'):
        s.phase==='enemies'?'红色区域是守卫的攻击方向':activeTool&&available?'工具亮起了，冲撞中可以点击使用':s.treasure.taken?'带宝物进出口，就能离开这一间':'拖拽瞄准 · 松手出击';
      this.tutorialText.color=rgba(s.shots===0?PALETTE.gold:PALETTE.muted);
    }
  }
  private showRoomClear():void {
    this.clear(this.overlay);const p=panel(this.overlay,665,720,0,0,PALETTE.deep,'#bfa46c',28,252);
    label(p,'宝物带出来了',38,0,294,610,72,PALETTE.gold,true);label(p,'挑一件工具，进入下一间',24,0,231,600,50,PALETTE.muted);
    TOOLS.forEach((tool,i)=>{const y=115-i*160;const card=panel(p,602,139,0,y,'#294647','#829d7f',18);
      label(card,tool.name,28,0,37,560,45,PALETTE.cream,true);label(card,tool.description,21,0,-10,548,61,PALETTE.muted);
      card.on(Node.EventType.TOUCH_END,(e:any)=>{e.propagationStopped=true;this.advance(tool.id);});
    });
  }
  advance(tool:ToolId):boolean {
    if(this.adBusy||this.rewardPending)return false;
    if(!this.model.nextRoom(tool))return false;this.clickSound();this.runMeta.bankedRooms=Math.max(this.runMeta.bankedRooms,this.model.state.roomIndex);
    this.updateMusicScene();this.renderRoom();this.drawHud();this.clear(this.overlay);this.persist();return true;
  }
  private settle():boolean {
    if(this.runMeta.settled)return true;const s=this.model.state;this.runMeta.settled=true;
    const result=this.save.update(d=>{d.progress.coins=(d.progress.coins||0)+s.score;d.progress.bestLoot=Math.max(d.progress.bestLoot,s.score);
      if(s.phase==='victory')d.progress.runsCompleted++;d.progress.roomsCleared+=s.roomIndex+(s.phase==='victory'?1:0);
      d.snapshot={runId:this.runId,savedAt:Date.now(),state:{model:this.model.snapshot(),...this.runMeta} as any};});
    if(!result.ok){this.runMeta.settled=false;this.toast('收获暂未保存，请稍后再试');}return result.ok;
  }
  private showResult(won:boolean):void {
    this.clear(this.overlay);if(won)this.settle();const s=this.model.state;
    const p=panel(this.overlay,650,won?570:520,0,0,PALETTE.deep,won?PALETTE.gold:'#bd8d72',28,252);
    label(p,won?'满载而归':'被守卫拦住了',40,0,won?215:188,600,75,won?PALETTE.gold:PALETTE.danger,true);
    label(p,`带回 ${s.score+this.runMeta.bonus} 金币`,31,0,won?145:115,600,58,PALETTE.cream,true);
    label(p,won?`${s.shots} 次出手 · 5 处宝物`:'换个落点，或者先挪开挡路的柜子',23,0,won?88:56,580,58,PALETTE.muted);
    if(won){
      button(p,'再潜入一次',0,5,560,70,()=>this.startRun());
      button(p,this.runMeta.bonus?'额外奖励已领取':'看视频 · 加领金币',0,-85,560,66,()=>void this.requestAd('settlement_bonus'),false);
      button(p,'回到营地',0,-170,560,60,()=>this.showHome(),false);
    }else{
      button(p,'重新出发',0,-32,560,70,()=>{if(!this.adBusy&&!this.rewardPending&&this.settle())this.startRun();});
      button(p,s.rescuesUsed?'本局救援已使用':'看视频 · 救援一次',0,-119,560,64,()=>void this.requestAd('rescue'),false);
      button(p,'带回收获，返回营地',0,-200,560,54,()=>{if(!this.adBusy&&!this.rewardPending&&this.settle())this.showHome();},false);
    }
  }
  private async requestAd(placement:'rescue'|'settlement_bonus'):Promise<void> {
    if(this.rewardPending||this.adBusy)return;
    this.clickSound();if(!this.persist()){this.toast('当前冒险未能保存，请稍后再试');return;}
    const s=this.model.state,targetRunId=this.runId;this.rewardPending=true;
    try{
      const result=await this.ads.request({placement,runId:targetRunId,userInitiated:true,
        eligible:placement==='rescue'?s.phase==='game_over'&&s.rescuesUsed===0&&!this.runMeta.settled:s.phase==='victory'&&this.runMeta.settled&&this.runMeta.bonus===0});
      if(result.receipt&&(result.status==='completed'||result.status==='pending_reward'))this.applyReceipt(result.receipt.id,placement,targetRunId);
      else this.toast(result.message);
    }finally{this.rewardPending=false;}
  }
  private applyReceipt(id:string,placement:string,targetRunId=this.runId):void {
    if(targetRunId!==this.runId)return;
    const result=this.save.applyReward(id,(d,receipt)=>{
      if(!d.snapshot||d.snapshot.runId!==targetRunId||receipt.runId!==targetRunId||receipt.placement!==placement)throw new Error('奖励不属于当前冒险');
      const stored=d.snapshot.state as unknown as LocalRun;
      if(receipt.placement==='rescue'){if(stored.settled)throw new Error('本局已结算');const model=new GameModel({snapshot:stored.model});if(!model.rescue())throw new Error('本局已无法救援');stored.model=model.snapshot();}
      else if(receipt.placement==='settlement_bonus'){if(stored.model.state.phase!=='victory'||!stored.settled||stored.bonus)throw new Error('本局不能再次领取');const amount=stored.model.state.score;stored.bonus=amount;d.progress.coins=(d.progress.coins||0)+amount;}
      else throw new Error('未知奖励类型');
      d.snapshot.state=stored as any;
    });
    if(!result.ok){this.toast(result.error||'奖励暂未保存，请稍后重试');return;}
    if(result.alreadyApplied)return;
    const snapshot=this.save.getSnapshot<LocalRun>()!;this.model.restore(snapshot.state.model);this.runMeta={bonus:snapshot.state.bonus,settled:snapshot.state.settled,bankedRooms:snapshot.state.bankedRooms};
    if(placement==='rescue'){this.page='game';this.clear(this.overlay);this.renderRoom();this.drawHud();}
    else if(this.page==='game')this.showResult(true);
  }

  private bindInput():void {
    input.on(Input.EventType.TOUCH_START,this.touchStart,this);input.on(Input.EventType.TOUCH_MOVE,this.touchMove,this);input.on(Input.EventType.TOUCH_END,this.touchEnd,this);input.on(Input.EventType.TOUCH_CANCEL,this.touchCancel,this);
    input.on(Input.EventType.MOUSE_DOWN,this.mouseDown,this);input.on(Input.EventType.MOUSE_MOVE,this.mouseMove,this);input.on(Input.EventType.MOUSE_UP,this.mouseUp,this);
    game.on(Game.EVENT_HIDE,this.onHide,this);game.on(Game.EVENT_SHOW,this.onShow,this);
  }
  private validInput(location:Vec2):boolean{const sy=location.y/view.getScaleY();return this.ready&&this.page==='game'&&!this.background&&!this.adBusy&&!this.rewardPending&&!this.overlay.children.length&&sy>250&&sy<this.height-220;}
  private begin(location:Vec2):void {
    if(this.dragging||!this.validInput(location)||this.model.state.phase!=='aiming')return;this.clickSound();this.dragging=true;this.dragStart.set(location);this.dragNow.set(location);this.dragPower=0;
  }
  private move(location:Vec2):void {
    if(!this.dragging)return;this.dragNow.set(location);const dx=(this.dragStart.x-location.x)/view.getScaleX(),dy=(this.dragStart.y-location.y)/view.getScaleY();
    this.dragPower=Math.min(1,Math.sqrt(dx*dx+dy*dy)/165);this.lastAim.set(dx,dy/Math.sin(Math.atan2(24,10)));
    this.showAim();
  }
  private release():void {
    if(!this.dragging)return;this.dragging=false;this.clearAim();if(this.dragPower>.10&&this.model.shoot({x:this.lastAim.x,y:this.lastAim.y},this.dragPower))this.persist();
  }
  private touchStart(e:EventTouch):void{if(this.activeTouchId!==null||this.heldMouse)return;const id=e.getID();if(id===null)return;this.begin(e.getLocation());if(this.dragging)this.activeTouchId=id;}
  private touchMove(e:EventTouch):void{if(this.activeTouchId===null||e.getID()!==this.activeTouchId)return;this.move(e.getLocation());}
  private touchEnd(e:EventTouch):void{if(this.activeTouchId===null||e.getID()!==this.activeTouchId)return;this.move(e.getLocation());this.activeTouchId=null;this.release();}
  private touchCancel(e:EventTouch):void{if(this.activeTouchId===null||e.getID()!==this.activeTouchId)return;this.cancelDrag();}
  private cancelDrag():void{this.activeTouchId=null;this.heldMouse=false;this.dragging=false;this.dragPower=0;this.clearAim();}
  // Cocos synthesizes a touch before mouse events. Only use this fallback when
  // no touch claimed the gesture, so the same mouse gesture cannot fire twice.
  private mouseDown(e:EventMouse):void{if(e.getButton()!==0||this.activeTouchId!==null)return;this.begin(e.getLocation());this.heldMouse=this.dragging;}
  private mouseMove(e:EventMouse):void{if(this.heldMouse)this.move(e.getLocation());}
  private mouseUp():void{if(!this.heldMouse)return;this.heldMouse=false;this.release();}
  private onHide():void{this.background=true;this.cancelDrag();this.persist();}
  private onShow():void{this.background=false;}
  private showAim():void {
    this.clearAim();if(this.dragPower<.06)return;const preview=this.model.aim(this.lastAim.x,this.lastAim.y,this.dragPower);
    for(let i=0;i<Math.min(this.aimNodes.length,preview.points.length);i++){const at=Math.floor(i*(preview.points.length-1)/(Math.min(this.aimNodes.length,preview.points.length)-1||1)),p=preview.points[at];const n=this.aimNodes[i];n.active=true;n.setPosition(p.x,GROUND_EFFECT+.01,-p.y);n.setScale(i===0?1.3:1,1,i===0?1.3:1);}
    const end=preview.points[preview.points.length-1];
    if(end&&this.aimEnd&&this.aimCaption){
      this.aimEnd.active=true;this.aimEnd.setPosition(end.x,GROUND_EFFECT+.016,-end.y);
      this.aimEnd.getComponent(MeshRenderer)!.setMaterial(preview.blocked?this.matGold:this.matAim,0);
      this.aimCaption.string=preview.blocked?'碰撞点':preview.endpoint==='exit'?'离开房间':'落点';this.aimCaption.color=rgba(preview.blocked?PALETTE.gold:PALETTE.mint);
      const screen=this.worldCamera.worldToScreen(new Vec3(end.x,.3,-end.y));
      this.aimCaption.node.setPosition(screen.x/view.getScaleX()-360,screen.y/view.getScaleY()-this.height/2+25,0);this.aimCaption.node.active=true;
    }
  }
  private clearAim():void{for(const node of this.aimNodes)node.active=false;if(this.aimEnd)this.aimEnd.active=false;if(this.aimCaption)this.aimCaption.node.active=false;}

  update(dt:number):void {
    if(!this.ready)return;dt=Math.min(dt,.05);this.time+=dt;
    if(Math.abs(view.getVisibleSize().height-this.lastHeight)>1){this.resize();if(this.page==='game')this.drawHud();else if(this.page==='home')this.showHome();else this.showTools();}
    if(this.background||this.adBusy)return;
    if(this.page==='game'){
      this.model.step(dt);for(const event of this.model.drainEvents())this.handleEvent(event);
      if(this.model.state.phase!==this.phase){this.phase=this.model.state.phase;this.persist();}
      if(['room_clear','game_over','victory'].includes(this.phase)&&this.overlayPhase!==this.phase){
        this.overlayPhase=this.phase;if(this.phase==='room_clear')this.showRoomClear();else this.showResult(this.phase==='victory');
      }
      this.updateHud();this.saveClock+=dt;if(this.saveClock>2){this.saveClock=0;this.persist();}
    }
    this.updateWorld(dt);this.updateSparks(dt);this.tipTimer=Math.max(0,this.tipTimer-dt);
    this.shake=Math.max(0,this.shake-dt*1.5);this.cameraNode.setPosition(this.cameraBase.x+(Math.random()-.5)*this.shake*.18,this.cameraBase.y,this.cameraBase.z+(Math.random()-.5)*this.shake*.18);
  }
  private animateActor(v:Visual,x:number,y:number,vx:number,vy:number,dt:number,isHero=false):void {
    const speed=Math.hypot(vx,vy),moving=speed>.3,phase=this.time*(moving?14:3)+v.phase;
    const root=v.instance.root;root.setPosition(x,GROUND+(moving?.07+Math.abs(Math.sin(phase))*.04:.025+Math.sin(phase)*.025),-y);
    if(moving)root.setRotationFromEuler(0,Math.atan2(vx,-vy)*180/Math.PI,0);
    else if(this.page==='home'&&isHero)root.setRotationFromEuler(0,Math.sin(this.time*.4)*12,0);
    else if(isHero&&this.dragging)root.setRotationFromEuler(0,Math.atan2(this.lastAim.x,-this.lastAim.y)*180/Math.PI,0);
    const squat=isHero&&this.dragging?1-this.dragPower*.12:1;
    root.setScale(v.scale*(1+(1-squat)*.3),v.scale*squat,v.scale*(1+(1-squat)*.3));
    for(const [name,node] of v.instance.parts){const base=v.instance.baseEuler.get(name)!;let ex=base.x,ey=base.y,ez=base.z;
      if(name.endsWith('.head')){ex+=moving?-12:Math.sin(phase)*3;ey+=Math.sin(phase*.6)*3;}
      else if(name.includes('.arm.')){ex+=Math.sin(phase+(name.endsWith('L')?0:Math.PI))*(moving?32:4);ez+=(name.endsWith('L')?1:-1)*(moving?10:0);}
      else if(name.includes('.leg.'))ex+=Math.sin(phase+(name.endsWith('L')?Math.PI:0))*(moving?34:2);
      else if(name.endsWith('.tail'))ey+=Math.sin(phase)*15;
      else if(name.endsWith('.body'))ex+=moving?12:0;
      node.setRotationFromEuler(ex,ey,ez);
    }
    v.hit=Math.max(0,v.hit-dt);if(v.hit>0)root.setPosition(x,root.position.y+Math.sin(v.hit*35)*.08,-y);
    v.shadow.setPosition(x,GROUND_EFFECT,-y);
  }
  private updateWorld(dt:number):void {
    const s=this.model.state,p=s.player;if(!this.hero)return;
    this.animateActor(this.hero,p.x,p.y,this.page==='game'?p.vx:0,this.page==='game'?p.vy:0,dt,true);
    if(this.heroRing){this.heroRing.setPosition(p.x,GROUND_EFFECT+.01,-p.y);this.heroRing.active=this.page==='game';const size=1+Math.sin(this.time*3)*.04;this.heroRing.setScale(size,1,size);}
    if(this.treasure){this.treasure.root.active=!s.treasure.taken;this.treasure.root.setPosition(s.treasure.x,.12+Math.sin(this.time*2.5)*.08,-s.treasure.y);}
    if(this.exitRing){const size=1+Math.sin(this.time*3)*.07;this.exitRing.setScale(size,1,size);}
    for(const o of s.obstacles){const visual=this.obstacles.get(o.id);if(visual){visual.root.active=!o.destroyed;visual.root.setPosition(o.x,GROUND,-o.y);}}
    for(const e of s.enemies){const v=this.enemies.get(e.id);if(!v)continue;v.instance.root.active=e.alive;v.shadow.active=e.alive;
      if(e.alive){this.animateActor(v,e.x,e.y,e.vx,e.vy,dt);if(Math.hypot(e.vx,e.vy)<.3)v.instance.root.setRotationFromEuler(0,Math.atan2(e.telegraph.dx,-e.telegraph.dy)*180/Math.PI,0);
        if(this.page==='game'&&s.phase==='enemies'&&e.action==='windup'){const charge=Math.min(1,s.enemyTime/.34);v.instance.root.setScale(v.scale*(1+charge*.08),v.scale*(1-charge*.16),v.scale*(1+charge*.08));}}
      const threat=this.threatNodes.get(e.id);if(threat){
        const winding=s.phase==='enemies'&&!e.actionStarted;
        threat.active=e.alive&&this.page==='game'&&(['aiming','moving'].includes(s.phase)||winding);
        const t=e.telegraph,range=this.threatLength(e);threat.setPosition(e.x+t.dx*range*.5,GROUND_EFFECT,-e.y-t.dy*range*.5);threat.setRotationFromEuler(0,Math.atan2(t.dx,-t.dy)*180/Math.PI,0);threat.setScale((t.width||.7)*(winding?1+Math.sin(this.time*24)*.08:1),1,range);}}
    const active=new Set<string>();for(const a of s.projectiles){active.add(a.id);let n=this.arrowNodes.get(a.id);if(!n){n=meshNode('Arrow',this.beamMesh(),this.matGold,this.effectsWorld);this.arrowNodes.set(a.id,n);}n.setPosition(a.x,.48,-a.y);n.setScale(.075,1,.65);n.setRotationFromEuler(0,Math.atan2(a.vx,-a.vy)*180/Math.PI,0);}
    for(const [id,n] of this.arrowNodes)if(!active.has(id)){n.destroy();this.arrowNodes.delete(id);}
  }
  private threatLength(e:EnemyState):number {
    const t=e.telegraph;let best=t.range;
    for(const o of this.model.state.obstacles){if(o.destroyed)continue;let a=0,b=t.range;const origin=[e.x,e.y],dir=[t.dx,t.dy],lo=[o.x-o.w/2,o.y-o.h/2],hi=[o.x+o.w/2,o.y+o.h/2];
      for(let i=0;i<2;i++){if(Math.abs(dir[i])<1e-7){if(origin[i]<lo[i]||origin[i]>hi[i]){a=Infinity;break;}}
        else{let q=(lo[i]-origin[i])/dir[i],r=(hi[i]-origin[i])/dir[i];if(q>r)[q,r]=[r,q];a=Math.max(a,q);b=Math.min(b,r);}}
      if(a<=b&&a>=0)best=Math.min(best,a);
    }return Math.max(.2,best);
  }
  private handleEvent(e:GameEvent):void {
    const sounds:Record<string,SoundCue>={shot:'launch',bounce:'stone_hit',board_hit:'wood_hit',board_break:'wood_break',cabinet_push:'cabinet_push',enemy_hit:'enemy_hit',enemy_down:'enemy_down',arrow:'arrow',arrow_blocked:'arrow_blocked',damage:'danger',treasure:'loot',victory:'win',game_over:'lose',room_clear:'loot',tool_used:'tool'};
    if(sounds[e.type])this.audio.play(sounds[e.type],e.type==='bounce'?.4:1);
    if(['board_break','enemy_hit','enemy_down','cabinet_push','arrow_blocked','treasure','damage'].includes(e.type))this.burst(e.x,e.y,e.type==='damage'?3:e.type==='treasure'?0:2,e.type==='board_break'?14:8);
    if(['enemy_hit','board_break','cabinet_push','damage'].includes(e.type)){this.shake=Math.max(this.shake,e.type==='damage'?.65:.28);if(e.id&&this.enemies.has(e.id))this.enemies.get(e.id)!.hit=.3;}
    if(e.type==='treasure'){this.showTip('宝物到手！去发光出口',3);this.floatText('宝物 +100',e.x,e.y,PALETTE.gold);}
    if(e.type==='damage'){this.hero.hit=.4;this.floatText(`-${e.amount||1}`,e.x,e.y,PALETTE.danger);}
    if(e.type==='enemy_hit')this.floatText(`-${e.amount||1}`,e.x,e.y,PALETTE.cream);
    if(e.type==='arrow_blocked')this.showTip(this.model.state.obstacles.find(o=>o.id===e.obstacleId)?.kind==='cabinet'?'柜子挡住了箭':'掩体挡住了箭',1.5);
    if(e.type==='exit_locked')this.showTip('先拿到房间里的宝物',2);
    if(e.type==='room_clear'||e.type==='victory'||e.type==='game_over')this.persist();
  }
  private showTip(text:string,seconds=2):void{this.tip=text;this.tipTimer=seconds;}
  private floatText(text:string,x:number,y:number,color:string):void {
    const screen=this.worldCamera.worldToScreen(new Vec3(x,1.6,-y));const ui=new Vec3(screen.x/view.getScaleX()-360,screen.y/view.getScaleY()-this.height/2,0);
    const l=label(this.floating,text,30,ui.x,ui.y,330,65,color,true);tween(l.node).by(.75,{position:new Vec3(0,85,0)},{easing:'quadOut'}).call(()=>l.node.destroy()).start();
  }
  private burst(x:number,y:number,color:number,count:number):void {
    const data={positions:[0,.12,0,-.05,0,0,.05,0,0,0,0,.045,0,0,-.045],normals:[0,1,0,-1,0,0,1,0,0,0,0,1,0,0,-1],uvs:[0,0,0,0,0,0,0,0,0,0],colors:new Array(20).fill(1),indices:[0,1,3,0,3,2,0,2,4,0,4,1,1,4,3,2,3,4]};
    for(let i=0;i<count&&this.sparks.length<72;i++){const n=meshNode('ImpactShard',data,this.sparkMaterials[color],this.effectsWorld);n.setPosition(x,.35,-y);const a=Math.random()*Math.PI*2,s=1+Math.random()*2;const life=.35+Math.random()*.35;this.sparks.push({node:n,vx:Math.cos(a)*s,vy:2+Math.random()*3,vz:Math.sin(a)*s,life,max:life});}
  }
  private updateSparks(dt:number):void {
    for(let i=this.sparks.length-1;i>=0;i--){const s=this.sparks[i];s.life-=dt;if(s.life<=0){s.node.destroy();this.sparks.splice(i,1);continue;}s.vy-=dt*12;s.node.setPosition(s.node.position.x+s.vx*dt,Math.max(.03,s.node.position.y+s.vy*dt),s.node.position.z+s.vz*dt);s.node.setRotationFromEuler(this.time*210,this.time*100,i*40);s.node.setScale(s.life/s.max,s.life/s.max,s.life/s.max);}
  }
  private toast(message:string):void {
    if(!this.floating){console.warn(message);return;}this.toastNode?.destroy();const p=panel(this.floating,640,120,0,-this.height/2+340,PALETTE.deep,PALETTE.gold,20,252);label(p,message,24,0,0,590,100);this.toastNode=p;this.scheduleOnce(()=>{if(p.isValid)p.destroy();if(this.toastNode===p)this.toastNode=null;},3.5);
  }
  onDestroy():void {
    this.persist();this.audio?.dispose();this.ads?.dispose();
    if((globalThis as any).__MONSTER_DEN__?.controller===this)delete (globalThis as any).__MONSTER_DEN__;
    this.env?.dispose();this.characters?.dispose();
    for(const mat of [this.matShadow,this.matAim,this.matDanger,this.matGold,...this.sparkMaterials])mat?.destroy();
    input.off(Input.EventType.TOUCH_START,this.touchStart,this);input.off(Input.EventType.TOUCH_MOVE,this.touchMove,this);input.off(Input.EventType.TOUCH_END,this.touchEnd,this);input.off(Input.EventType.TOUCH_CANCEL,this.touchCancel,this);
    input.off(Input.EventType.MOUSE_DOWN,this.mouseDown,this);input.off(Input.EventType.MOUSE_MOVE,this.mouseMove,this);input.off(Input.EventType.MOUSE_UP,this.mouseUp,this);
    game.off(Game.EVENT_HIDE,this.onHide,this);game.off(Game.EVENT_SHOW,this.onShow,this);
  }
}

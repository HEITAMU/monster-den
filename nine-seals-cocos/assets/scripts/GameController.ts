import {
  _decorator, Component, Node, UITransform, Graphics, Color, Label,
  Vec3, tween, SubContextView, AudioSource, AudioClip, resources, Layers,
} from 'cc';
import { Board, GOAL, Level, dailyLevel, campaignLevel, dateKey, rotate, solved, shortestSolution } from './core/Puzzle';
import { AD_CONFIG, DailyRecord, PlayerSave, WechatBridge, better, isWechat, loadSave, saveProgress } from './platform/WechatBridge';
const { ccclass } = _decorator;

const W=720, H=1280;
const C = {
  bg: new Color(9,17,31), deep:new Color(14,28,43), pane:new Color(23,43,58),
  pane2:new Color(30,57,70), gold:new Color(239,203,133), muted:new Color(129,167,182),
  white:new Color(239,243,241), mint:new Color(108,220,185), red:new Color(239,140,128),
  edge:new Color(81,115,123), cyan:new Color(133,206,225),
};
function rgb(r:number,g:number,b:number,a=255) { return new Color(r,g,b,a); }
function uinode(name: string, parent: Node, w=1, h=1): Node {
  const n=new Node(name); n.layer=Layers.Enum.UI_2D; parent.addChild(n); const tr=n.addComponent(UITransform);tr.setContentSize(w,h); return n;
}
function graphic(node: Node): Graphics { return node.addComponent(Graphics); }
function rounded(g: Graphics, x:number,y:number,w:number,h:number,r:number,color:Color,stroke?:Color,line=2):void {
  g.fillColor=color;g.roundRect(x,y,w,h,r);g.fill();
  if(stroke){g.lineWidth=line;g.strokeColor=stroke;g.roundRect(x,y,w,h,r);g.stroke();}
}
function line(g: Graphics, x1:number,y1:number,x2:number,y2:number,color:Color,width=2):void{
  g.strokeColor=color;g.lineWidth=width;g.moveTo(x1,y1);g.lineTo(x2,y2);g.stroke();
}
function circle(g:Graphics,x:number,y:number,r:number,c:Color,fill=true,w=2):void{
  if(fill)g.fillColor=c;else{g.strokeColor=c;g.lineWidth=w;}
  g.circle(x,y,r); if(fill)g.fill();else g.stroke();
}
function text(parent:Node,s:string,x:number,y:number,size=26,color:Color=C.white,bold=false,w=620,h=55):Label{
  const n=uinode('Text',parent,w,h); n.setPosition(x,y,0); const l=n.addComponent(Label);
  l.string=s;l.fontSize=size;l.lineHeight=size*1.18;l.color=color;
  l.isBold=bold;l.horizontalAlign=Label.HorizontalAlign.CENTER;
  l.verticalAlign=Label.VerticalAlign.CENTER;l.overflow=Label.Overflow.SHRINK;
  return l;
}
function action(parent:Node,s:string,x:number,y:number,w:number,h:number,run:()=>void,primary=false):Node {
  const n=uinode('Button '+s,parent,w,h);n.setPosition(x,y,0);
  const g=graphic(n);
  rounded(g,-w/2,-h/2,w,h,Math.min(h/2,27),primary?rgb(204,164,94):C.pane2,
    primary?C.gold:C.edge,2);
  rounded(g,-w/2+5,h/2-12,w-10,3,2,primary?rgb(255,234,178,155):rgb(177,218,215,65));
  text(n,s,0,0,Math.min(27,h*.4),primary?C.deep:C.white,true,w-12,h-8);
  n.on(Node.EventType.TOUCH_END,()=>{tween(n).to(.07,{scale:new Vec3(.95,.95,1)}).to(.12,{scale:new Vec3(1,1,1)}).start();run();});
  return n;
}
function fmt(ms:number):string{return (Math.max(0,ms)/1000).toFixed(1)+'s';}

@ccclass('CrownGame')
export class CrownGame extends Component {
  private root!:Node; private platform=new WechatBridge(); private save:PlayerSave=loadSave();
  private page:'home'|'play'|'result'|'rank'='home'; private activeLayer:Node|null=null;
  private mode:'daily'|'campaign'='daily'; private day=dateKey();private stage=0;private chapter=1;
  private board:Board=GOAL.slice();private initial:Board=GOAL.slice();private level!:Level;
  private turns=0;private elapsed=0;private totalElapsed=0;private totalExcess=0;private perfectCount=0;
  private assisted=false;private challengeAssisted=false;private clockwise=true;
  private busy=false;private tileNodes:Node[]=[];private stepLabel:Label|null=null;
  private clockLabel:Label|null=null;private tip:Label|null=null;private messageNode:Node|null=null;
  private pendingHint=-1;private renderId=0;private clearedChapters=0;
  private musicSource:AudioSource|null=null; private soundSource:AudioSource|null=null;
  private soundOn=true; private musicStarted=false; private musicReady=false;
  private clips:Record<string,AudioClip>={};

  start():void{
    // Keep the scene camera alive: all dynamic pages belong to a dedicated GameRoot.
    this.root=uinode('GameRoot',this.node,W,H);
    this.setupSound();
    const incoming=this.platform.incomingDay;
    if(incoming) this.day=incoming;
    this.platform.setShareDay(this.day);
    this.home();
  }
  private setupSound():void{
    const music=uinode('BGM',this.root);this.musicSource=music.addComponent(AudioSource);
    this.musicSource.playOnAwake=false;this.musicSource.loop=true;this.musicSource.volume=.22;
    const sfx=uinode('SFX',this.root);this.soundSource=sfx.addComponent(AudioSource);
    this.soundSource.playOnAwake=false;this.soundSource.volume=.54;
    for(const name of ['rotor','perfect','complete','ambient']){
      resources.load('audio/'+name,AudioClip,(err,clip)=>{
        if(err || !clip){console.warn('音频未加载 '+name,err);return;}
        this.clips[name]=clip;
        if(name==='ambient' && this.musicSource){this.musicSource.clip=clip;this.musicReady=true;if(this.musicStarted&&this.soundOn)this.musicSource.play();}
      });
    }
  }
  private activateSound():void{
    this.musicStarted=true;
    if(this.soundOn&&this.musicReady&&this.musicSource&&!this.musicSource.playing)this.musicSource.play();
  }
  private playSfx(name:string):void{
    if(this.soundOn&&this.soundSource&&this.clips[name])this.soundSource.playOneShot(this.clips[name],name==='rotor'?.43:.9);
  }
  private toggleSound():void{
    this.soundOn=!this.soundOn;
    if(!this.soundOn)this.musicSource?.pause();else this.activateSound();
    if(this.page==='home')this.home();
  }
  onDestroy():void{this.platform.destroy();}
  update(dt:number):void{
    if(this.page==='play' && !this.busy){
      this.elapsed += Math.min(.1,Math.max(0,dt));
      if(this.clockLabel)this.clockLabel.string=fmt(this.elapsed*1000);
    }
  }
  private clear(page:'home'|'play'|'result'|'rank'):Node{
    this.renderId++;this.page=page;
    if(this.activeLayer){this.activeLayer.destroy();this.activeLayer=null;}
    const layer=uinode('UI '+page,this.root,W,H);this.activeLayer=layer;this.background(layer);
    this.platform.showBanner(page==='home'||page==='result');
    this.stepLabel=null;this.clockLabel=null;this.tip=null;this.messageNode=null;
    return layer;
  }
  private background(root:Node):void{
    const n=uinode('Vault Background',root,W,H);const g=graphic(n);
    // Hand-built art-deco vault backdrop, one draw call per visual layer.
    for(let i=0;i<48;i++){
      const t=i/47;
      const c=rgb(Math.round(8+13*t),Math.round(18+18*t),Math.round(31+22*t));
      g.fillColor=c;g.rect(-360,-640+i*1280/48,720,1280/48+1);g.fill();
    }
    for(let i=0;i<70;i++){
      const x=(((i*131+29)%687)-344),y=(((i*227+17)%1220)-610);
      circle(g,x,y,i%7===0?2.2:1,rgb(210,192,140,35+i%4*9));
    }
    for(let k=0;k<3;k++){
      circle(g,0,0,290+k*64,rgb(186,156,95,25),false,1);
    }
    for(const sy of [-1,1]){
      for(const sx of [-1,1]){
        const x=sx*306,y=sy*565;
        line(g,x,y,x-sx*48,y,rgb(180,140,78,70),2);
        line(g,x,y,x,y-sy*48,rgb(180,140,78,70),2);
        circle(g,x-sx*10,y-sy*10,3,rgb(180,140,78,85));
      }
    }
  }
  private ornament(root:Node,y:number):void{
    const n=uinode('Ornament',root,560,38);n.setPosition(0,y);
    const g=graphic(n);line(g,-275,0,-45,0,rgb(177,139,91,100));line(g,45,0,275,0,rgb(177,139,91,100));
    for(let k=0;k<4;k++){const x=(k-1.5)*14;circle(g,x,0,3.2,rgb(235,194,111,175));}
  }
  private header(root:Node,sub:string):void{
    text(root,'九 印 王 座',0,563,54,C.gold,true,640,82);
    text(root,sub,0,506,23,C.muted,false,620,45);this.ornament(root,472);
  }
  private medal(root:Node,y:number,radius:number):void{
    const n=uinode('Royal Seal',root,radius*3,radius*3);n.setPosition(0,y);const g=graphic(n);
    circle(g,0,0,radius+18,rgb(198,155,79,23));circle(g,0,0,radius,rgb(215,171,91,37));
    circle(g,0,0,radius,rgb(233,191,116,220),false,4);
    circle(g,0,0,radius-13,rgb(230,198,133,140),false,1);
    for(let a=0;a<8;a++){const ang=a*Math.PI/4;circle(g,Math.cos(ang)*(radius-8),Math.sin(ang)*(radius-8),3,C.gold);}
    text(n,'♛',0,4,radius*1.18,C.gold,true,radius*2,radius*2);
  }
  private home():void{
    this.busy=false;
    const layer=this.clear('home');this.header(layer,'能解开，只算入场 · 用最少步数赢下王座');
    this.medal(layer,264,99);
    text(layer,'空间推理 × 最优步数 × 好友挑战',0,115,25,C.white,false,635,45);
    text(layer,'四处旋钮 · 九枚秘印 · 每日三道同题竞技',0,73,23,C.muted,false,640,43);
    const panel=uinode('Daily Challenge',layer,625,173);panel.setPosition(0,-83);const g=graphic(panel);
    rounded(g,-312,-84,624,168,27,rgb(29,52,62),rgb(193,151,82,180),3);
    text(panel,'今 日 密 令',0,55,33,C.gold,true,575,44);
    text(panel,this.day.slice(0,4)+' / '+this.day.slice(4,6)+' / '+this.day.slice(6),0,14,21,C.muted);
    const dailyBest=this.save.daily[this.day];
    text(panel,dailyBest?`最佳成绩：多 ${dailyBest.excess} 步 · ${fmt(dailyBest.milliseconds)}`:'三道同题，每个人的起点完全一样',0,-30,22,C.white);
    action(layer,'挑战今日王座',0,-219,495,76,()=>this.beginDaily(),true);
    action(layer,`闯关之路  ·  第 ${this.save.chapter} 关`,0,-332,495,71,()=>this.beginCampaign());
    action(layer,'好友排行榜',-156,-431,297,68,()=>this.rank());
    action(layer,'分享挑战',156,-431,297,68,()=>this.share(),false);
    action(layer,this.soundOn?'♫ 音乐与音效：开':'♪ 音乐与音效：关',0,-511,355,50,()=>this.toggleSound());
    text(layer,AD_CONFIG.banner?'':'广告位预留 · 接入真实广告 ID 后显示',0,-547,17,rgb(131,160,171,170));
    text(layer,'不靠随机运气，只凭判断与练习',0,-588,18,C.muted);
  }
  private beginDaily():void{
    this.activateSound();this.mode='daily';this.stage=0;this.totalElapsed=0;this.totalExcess=0;this.perfectCount=0;
    this.challengeAssisted=false;this.loadLevel(dailyLevel(this.day,0));
  }
  private beginCampaign():void{
    this.activateSound();this.mode='campaign';this.chapter=this.save.chapter;
    this.loadLevel(campaignLevel(this.chapter));
  }
  private loadLevel(level:Level):void{
    this.level=level;this.initial=level.board.slice();this.board=level.board.slice();
    this.turns=0;this.elapsed=0;this.assisted=false;this.pendingHint=-1;this.busy=false;
    this.drawPlay();
  }
  private drawPlay():void{
    const layer=this.clear('play');
    const over=this.mode==='daily' ? `今日密令  ·  第 ${this.stage+1} / 3 座` : `推演之路  ·  第 ${this.chapter} 关`;
    text(layer,over,0,565,27,C.gold,true);
    action(layer,'返回',-280,498,115,49,()=>this.home());
    text(layer,'把九枚秘印，恢复为右上角的目标布局',-80,500,21,C.muted,false,405,48);
    const stats=uinode('Stats',layer,627,92);stats.setPosition(0,415);const gs=graphic(stats);
    rounded(gs,-312,-46,624,92,19,rgb(22,42,55,245),C.edge,2);
    text(stats,'最优 '+this.level.optimum+' 步',-205,11,24,C.gold,true,194,40);
    this.stepLabel=text(stats,'已走 '+this.turns+' 步',0,11,24,C.white,true,185,40);
    this.clockLabel=text(stats,fmt(this.elapsed*1000),207,11,25,C.mint,true,177,40);
    text(stats,'最优标准',-205,-23,15,C.muted,false,160,27);
    text(stats,'实际操作',0,-23,15,C.muted,false,160,27);
    text(stats,'用时',206,-23,15,C.muted,false,160,27);
    const target=uinode('Target Layout',layer,628,129);target.setPosition(0,300);const gt=graphic(target);
    rounded(gt,-309,-65,618,130,21,rgb(17,33,47,222),rgb(80,108,113,140),2);
    text(target,'目 标',-230,24,22,C.gold,true,120,36);
    text(target,'1 → 9',-230,-18,20,C.muted,false,130,33);
    // Compact target board with a readable separate area for matching numbers.
    for(let i=0;i<9;i++){
      const col=i%3,row=Math.floor(i/3),px=-58+col*57,py=39-row*40;
      const g=graphic(uinode('Goal tile',target,48,33));
      g.node.setPosition(px,py);rounded(g,-23,-16,46,32,7,rgb(46,74,78),rgb(131,160,149,120),1);
      text(g.node,String(i+1),0,0,19,C.gold,true,43,30);
    }
    text(layer,'轻触四处旋钮，四枚相邻秘印一起旋转',0,198,22,C.white);
    const base=uinode('Puzzle Frame',layer,610,610);base.setPosition(0,-100);
    const gb=graphic(base);rounded(gb,-296,-296,592,592,35,rgb(17,35,49),rgb(169,134,82),3);
    rounded(gb,-281,-281,562,562,25,rgb(7,24,38),rgb(54,88,94),2);
    const TILE=174,SP=8,PITCH=182;
    this.tileNodes=[];
    for(let i=0;i<9;i++){
      const x=(i%3-1)*PITCH,y=(1-Math.floor(i/3))*PITCH;
      const tile=this.makeTile(base,this.board[i],TILE);tile.setPosition(x,y);
      this.tileNodes[i]=tile;
    }
    for(let r=0;r<4;r++){
      const ox=r%2===0?-PITCH/2:PITCH/2,oy=r<2?PITCH/2:-PITCH/2;
      const hit=uinode('Rotor '+r,base,90,90);hit.setPosition(ox,oy);
      const g=graphic(hit);
      circle(g,0,0,38,rgb(15,37,48,235));circle(g,0,0,37,C.gold,false,3);
      circle(g,0,0,32,rgb(59,86,79));
      if(this.pendingHint>=0 && Math.floor(this.pendingHint/2)===r){circle(g,0,0,43,C.mint,false,5);}
      text(hit,'⟳',0,-1,47,C.gold,true,82,75);
      hit.on(Node.EventType.TOUCH_END,()=>this.doRotate(r));
    }
    text(layer,'旋转方向',0,-426,22,C.muted);
    action(layer,this.clockwise?'↻  顺时针':'↺  逆时针',0,-486,256,67,()=>{this.clockwise=!this.clockwise;this.drawPlay();});
    action(layer,'重新开始',-165,-568,268,63,()=>this.reset(),false);
    action(layer,'提示 · 激励广告',165,-568,268,63,()=>{void this.hint();},false);
    if(this.assisted) text(layer,'已使用提示：本轮仅供练习，不计入好友排名',0,-619,17,C.red);
    else if(this.pendingHint>=0) text(layer,'提示：高亮旋钮按箭头方向转动',0,-619,17,C.mint);
    else text(layer,'排行榜仅记录未使用提示的三关总成绩',0,-619,17,C.muted);
  }
  private makeTile(root:Node,id:number,size:number):Node{
    const node=uinode('Seal '+id,root,size,size),g=graphic(node),s=size;
    const tones=[rgb(44,99,103),rgb(59,82,126),rgb(101,74,116),rgb(61,112,93),rgb(116,83,74),rgb(61,99,128),rgb(88,114,79),rgb(115,84,117),rgb(69,120,125)];
    const a=tones[id-1];
    rounded(g,-s/2,-s/2,s,s,20,rgb(9,22,34),rgb(152,123,78),2);
    rounded(g,-s/2+6,-s/2+7,s-12,s-13,16,a,rgb(194,181,124),2);
    rounded(g,-s/2+13,-s/2+13,s-26,s-26,13,rgb(a.r-12,a.g-7,a.b-3,230));
    for(let k=0;k<4;k++){
      const px=(k%2?1:-1)*(s/2-21),py=(k>=2?1:-1)*(s/2-21);
      circle(g,px,py,4,C.gold);
    }
    circle(g,0,6,s*.26,rgb(13,33,45,120));
    circle(g,0,6,s*.265,rgb(227,205,142,150),false,2);
    text(node,String(id),0,10,s*.43,rgb(255,235,187),true,s*.7,s*.55);
    text(node,['◇','✦','✧','✶','⬟','✥','☼','✹','◆'][id-1],0,-s*.30,s*.15,rgb(244,226,169),true,s*.7,s*.25);
    return node;
  }
  private doRotate(rotor:number):void{
    if(this.busy || this.page!=='play')return;
    this.busy=true;this.activateSound();this.playSfx('rotor');this.platform.vibrate();
    const dir=this.clockwise?1:-1;
    const sq=[[0,1,4,3],[1,2,5,4],[3,4,7,6],[4,5,8,7]][rotor];
    const nodes=this.tileNodes.slice(); const p=182;
    for(let k=0;k<4;k++){
      const dest=sq[(k+dir+4)%4];
      const x=(dest%3-1)*p,y=(1-Math.floor(dest/3))*p;
      const n=nodes[sq[k]];
      tween(n).to(.23,{position:new Vec3(x,y,0)},{easing:'sineInOut'}).start();
    }
    this.board=rotate(this.board,rotor,dir);this.turns++;this.pendingHint=-1;
    const serial=this.renderId;
    this.scheduleOnce(()=>{
      if(this.renderId!==serial||this.page!=='play')return;
      this.busy=false;
      if(solved(this.board)){this.finishStage();return;}
      this.drawPlay();
    },.245);
  }
  private reset():void{
    if(this.page!=='play'||this.busy)return;
    // A restart discards the current attempt; assisted runs remain assisted.
    this.board=this.initial.slice();this.turns=0;this.elapsed=0;this.pendingHint=-1;this.drawPlay();
  }
  private async hint():Promise<void>{
    if(this.busy||this.page!=='play')return;
    this.busy=true;
    const result=await this.platform.playHintAd();
    if(this.page!=='play')return;
    this.busy=false;
    if(result==='cancelled'){this.toast('广告没有完整播放，未获得提示');return;}
    // When no ad unit exists, keep the puzzle playable with a free, explicitly unranked hint.
    this.assisted=true;this.challengeAssisted=true;
    try{
      const solution=shortestSolution(this.board);
      if(!solution.length){this.toast('棋盘已经完成');return;}
      this.pendingHint=solution[0];this.clockwise=this.pendingHint%2===0;
      this.drawPlay();
      if(result==='unavailable')this.toast('广告位尚未接入 · 已提供免费提示（不计榜）');
    }catch(e){console.warn('Hint solver',e);this.toast('提示暂时无法计算，请重开再试');}
  }
  private finishStage():void{
    this.playSfx(this.turns===this.level.optimum?'perfect':'complete');
    this.totalElapsed+=this.elapsed;this.totalExcess+=Math.max(0,this.turns-this.level.optimum);
    if(this.turns===this.level.optimum) this.perfectCount++;
    if(this.mode==='campaign'){
      const key=String(this.chapter); const prev=this.save.chapterBest[key];
      if(prev===undefined||this.turns<prev)this.save.chapterBest[key]=this.turns;
      this.save.chapter=Math.max(this.save.chapter,this.chapter+1);
      saveProgress(this.save);this.clearedChapters++;
    }
    this.result();
  }
  private result():void{
    const layer=this.clear('result');this.header(layer,'判定完成 · 荣耀来自真正的思考');
    const extra=this.turns-this.level.optimum;const last=this.mode==='daily'&&this.stage===2;
    this.medal(layer,270,107);
    text(layer,extra===0?'完 美 复 原':extra<=2?'精 密 推 演':'密 令 已 解',0,111,40,extra===0?C.gold:C.white,true);
    text(layer,`本关：${this.turns} 步  /  最少 ${this.level.optimum} 步`,0,55,26,C.white);
    text(layer,`用时 ${fmt(this.elapsed*1000)}  ·  多用 ${extra} 步`,0,15,23,C.muted);
    if(this.mode==='daily'){
      text(layer,`今日累计：多用 ${this.totalExcess} 步 · ${fmt(this.totalElapsed*1000)}`,0,-56,25,C.gold,true);
      text(layer,`最优还原 ${this.perfectCount} / ${this.stage+1} 关`,0,-102,23,C.white);
      if(last){
        this.finalDaily();
        const name=this.challengeAssisted?'练习王冠（含提示，不计榜）':this.totalExcess===0?'今日王冠 · 无懈可击':'今日王冠 · 完成挑战';
        text(layer,name,0,-165,28,this.challengeAssisted?C.muted:C.mint,true);
        action(layer,'分享战绩，邀好友破纪录',0,-271,542,75,()=>this.share(),true);
        action(layer,'查看今日好友榜',0,-360,542,65,()=>this.rank());
        action(layer,'再次挑战',-151,-445,259,64,()=>this.beginDaily());
        action(layer,'返回大厅',151,-445,259,64,()=>this.home());
      }else{
        if(this.assisted)text(layer,'本次使用过提示，今日挑战不计入好友榜',0,-170,20,C.red);
        action(layer,'进入下一道密令',0,-286,516,79,()=>{
          this.stage++;this.loadLevel(dailyLevel(this.day,this.stage));
        },true);
        action(layer,'返回大厅',0,-398,380,67,()=>this.home());
      }
    }else{
      text(layer,`已解锁第 ${this.chapter+1} 关`,0,-132,26,C.mint,true);
      action(layer,'继续推演',0,-276,518,76,()=>{
        this.platform.maybeInterstitial(this.clearedChapters);
        this.chapter++;this.loadLevel(campaignLevel(this.chapter));
      },true);
      action(layer,'返回大厅',0,-384,395,65,()=>this.home());
    }
    text(layer,AD_CONFIG.banner?'':'广告展示预留位 · 正式广告由微信平台呈现',0,-563,18,C.muted);
  }
  private finalDaily():void{
    if(this.challengeAssisted)return;
    const rec:DailyRecord={day:this.day,excess:this.totalExcess,
      milliseconds:Math.round(this.totalElapsed*1000),perfect:this.perfectCount};
    if(better(rec,this.save.daily[this.day])){
      this.save.daily[this.day]=rec;saveProgress(this.save);
      // One rolling cloud key for today's ranking; archived shared challenges stay local.
      if(this.day===dateKey())this.platform.saveDailyScore(rec);
    }
  }
  private share():void{
    const isCompleted=this.mode==='daily'&&this.page==='result'&&this.stage===2;
    const ok=this.platform.share(this.day,isCompleted&&!this.challengeAssisted?this.totalExcess:null);
    if(!ok) this.toast('微信内可直接转发今日密令链接');
  }
  private rank():void{
    const layer=this.clear('rank');this.header(layer,'与好友同题竞技，排名看真功夫');
    const panel=uinode('Friends Rank',layer,634,841);panel.setPosition(0,-42);
    const g=graphic(panel);rounded(g,-317,-420,634,840,24,C.deep,C.edge,2);
    if(isWechat()){
      const view=uinode('Open Data Context',panel,600,760);view.setPosition(0,-1,0);
      const sub=view.addComponent(SubContextView);sub.fps=2;
      this.platform.showFriends(this.day);
    }else{
      text(panel,'微信好友排行榜',0,321,36,C.gold,true);
      text(panel,'请在微信开发者工具或真机中查看真实好友榜',0,122,24,C.white);
      const rec=this.save.daily[this.day];
      text(panel,rec?`本机今日最佳：多 ${rec.excess} 步 / ${fmt(rec.milliseconds)}`:'今天还没有有效的通关成绩',0,48,23,C.muted);
      text(panel,'不使用演示用户，不伪造好友数据',0,-30,21,C.muted);
    }
    action(layer,'返回大厅',0,-539,412,74,()=>this.home(),true);
    action(layer,'邀请好友挑战',0,-616,355,50,()=>this.share());
  }
  private toast(s:string):void{
    if(!this.root)return;
    if(this.messageNode)this.messageNode.destroy();
    const n=uinode('Toast',this.root,650,76);n.setPosition(0,-250);this.messageNode=n;
    const g=graphic(n);rounded(g,-325,-37,650,74,20,rgb(24,51,62,245),C.gold,2);
    text(n,s,0,0,20,C.white,true,630,64);
    const identity=n;
    this.scheduleOnce(()=>{if(this.messageNode===identity){identity.destroy();this.messageNode=null;}},2.1);
  }
}

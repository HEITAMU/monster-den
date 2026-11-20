import {
  _decorator, Component, Node, UITransform, Graphics, Color, Label, Vec3, tween,
  AudioSource, AudioClip, resources, SubContextView
} from 'cc';
import {Board,Level,Mode,levelFor,rotate,solved,shortestSolution,todayKey} from './core/Puzzle';
import {Wechat,isWechat,loadSave,store,isBetter,DailyScore,Save,AD_UNITS} from './platform/Wechat';
const {ccclass}=_decorator;
const COLORS={bg:new Color(12,23,35),panel:new Color(24,49,64),edge:new Color(75,116,130),
 gold:new Color(239,206,147),muted:new Color(154,186,196),white:new Color(242,242,239),
 mint:new Color(124,224,189),red:new Color(235,156,155),dark:new Color(12,30,42)};
const rgb=(r:number,g:number,b:number,a=255)=>new Color(r,g,b,a);
function node(parent:Node,name:string,w=1,h=1):Node{const n=new Node(name);parent.addChild(n);n.addComponent(UITransform).setContentSize(w,h);return n;}
function fill(g:Graphics,x:number,y:number,w:number,h:number,r:number,inside:Color,outside?:Color):void{
 g.fillColor=inside;g.roundRect(x,y,w,h,r);g.fill();if(outside){g.lineWidth=2;g.strokeColor=outside;g.roundRect(x,y,w,h,r);g.stroke();}
}
function ring(g:Graphics,x:number,y:number,r:number,c:Color,width=2):void{g.lineWidth=width;g.strokeColor=c;g.circle(x,y,r);g.stroke();}
function label(parent:Node,s:string,x:number,y:number,size=25,color:Color=COLORS.white,bold=false,w=630,h=56):Label{
 const n=node(parent,'Label',w,h);n.setPosition(x,y);const l=n.addComponent(Label);
 l.string=s;l.fontSize=size;l.lineHeight=size*1.17;l.isBold=bold;l.color=color;
 l.horizontalAlign=Label.HorizontalAlign.CENTER;l.verticalAlign=Label.VerticalAlign.CENTER;
 l.overflow=Label.Overflow.SHRINK;return l;
}
function button(parent:Node,s:string,x:number,y:number,w:number,h:number,cb:()=>void,main=false):Node{
 const b=node(parent,'Button-'+s,w,h);b.setPosition(x,y);const g=b.addComponent(Graphics);
 fill(g,-w/2,-h/2,w,h,Math.min(h/2,24),main?rgb(209,175,109):rgb(38,76,92),main?rgb(249,225,163):COLORS.edge);
 fill(g,-w/2+8,h/2-12,w-16,3,2,main?rgb(255,240,202,150):rgb(189,224,225,70));
 label(b,s,0,0,Math.min(27,h*.45),main?COLORS.dark:COLORS.white,true,w-14,h-7);
 b.on(Node.EventType.TOUCH_END,()=>{tween(b).to(.07,{scale:new Vec3(.95,.95,1)}).to(.11,{scale:new Vec3(1,1,1)}).start();cb();});
 return b;
}
function fmt(ms:number):string{return (Math.max(0,ms)/1000).toFixed(1)+'s';}
@ccclass('CrownGame')
export class CrownGame extends Component{
 private wxapi=new Wechat();private save:Save=loadSave();private screen:'home'|'play'|'result'|'rank'='home';
 private mode:Mode='daily';private day=todayKey();private stage=0;private chapter=1;private current!:Level;
 private board:Board=[];private startBoard:Board=[];private moves=0;private elapsed=0;private totalMs=0;private extra=0;private perfect=0;
 private assisted=false;private assistedDaily=false;private clockwise=true;private locked=false;private hintMove=-1;
 private redrawId=0;private cleared=0;private tileNodes:Node[]=[];private timeLabel:Label|null=null;private snd:AudioSource|null=null;private music:AudioSource|null=null;
 start():void{
  const incoming=this.wxapi.incomingDay();if(incoming)this.day=incoming;
  this.music=this.node.addComponent(AudioSource);
  this.snd=this.music;
  for(const name of ['rotor','complete','perfect'] as const){resources.load('audio/'+name,AudioClip,(e,clip)=>{if(!e&&clip)this.soundMap[name]=clip;});}
  resources.load('audio/ambient',AudioClip,(e,clip)=>{if(!e&&clip&&this.music){this.music.clip=clip;this.music.loop=true;this.music.volume=.14;this.music.play();}});
  this.home();
 }
 private soundMap:Record<string,AudioClip>={};
 private sound(which:string):void{const clip=this.soundMap[which];if(clip&&this.snd)this.snd.playOneShot(clip,which==='rotor'?.25:.50);}
 onDestroy():void{this.wxapi.dispose();}
 update(dt:number):void{if(this.screen==='play'){this.elapsed+=Math.max(0,Math.min(.1,dt));if(this.timeLabel)this.timeLabel.string=fmt(this.elapsed*1000);}}
 private createScreen(s:'home'|'play'|'result'|'rank'):Node{
  this.redrawId++;this.screen=s;for(const child of this.node.children.slice()){if(child.name==='UICamera')continue;child.removeFromParent();child.destroy();}
  const r=node(this.node,'Screen',720,1280);this.backdrop(r);this.wxapi.showBanner(s==='home'||s==='result');this.timeLabel=null;return r;
 }
 private backdrop(r:Node):void{
  const b=node(r,'The vault',720,1280);const g=b.addComponent(Graphics);
  for(let i=0;i<40;i++){const k=i/39;g.fillColor=rgb(Math.round(10+11*k),Math.round(23+18*k),Math.round(39+22*k));g.rect(-360,-640+i*32,720,33);g.fill();}
  for(let i=0;i<61;i++){const x=(i*133+11)%690-345,y=(i*227+17)%1190-595;g.fillColor=rgb(230,199,137,35+i%4*12);g.circle(x,y,i%10===0?2:1);g.fill();}
  for(let k=0;k<5;k++){ring(g,0,25,200+k*65,rgb(198,171,108,25),1);}
  for(let v of [-1,1])for(let h of [-1,1]){g.strokeColor=rgb(207,168,95,90);g.lineWidth=3;g.moveTo(310*h,575*v);g.lineTo(260*h,575*v);g.moveTo(310*h,575*v);g.lineTo(310*h,525*v);g.stroke();}
 }
 private heading(r:Node,sub:string):void{
  label(r,'九 印 王 座',0,559,52,COLORS.gold,true,640,82);label(r,sub,0,510,22,COLORS.muted,false,655,46);
  const g=node(r,'divider',590,12).addComponent(Graphics);g.strokeColor=rgb(196,152,88,170);g.lineWidth=2;g.moveTo(-300,0);g.lineTo(-42,0);g.moveTo(42,0);g.lineTo(300,0);g.stroke();ring(g,0,0,6,COLORS.gold,2);g.node.setPosition(0,471);
 }
 private emblem(r:Node,y:number,radius=94):void{
  const n=node(r,'The Crown',radius*3,radius*3);n.setPosition(0,y);
  const g=n.addComponent(Graphics);g.fillColor=rgb(78,113,94,172);g.circle(0,0,radius);g.fill();ring(g,0,0,radius,COLORS.gold,4);ring(g,0,0,radius-15,rgb(247,214,146,150),1);
  for(let i=0;i<8;i++){const t=i*Math.PI/4;g.fillColor=COLORS.gold;g.circle(Math.cos(t)*(radius-9),Math.sin(t)*(radius-9),3.5);g.fill();}
  label(n,'♛',0,4,radius*1.25,COLORS.gold,true,2*radius,2*radius);
 }
 private home():void{
  this.locked=false;const r=this.createScreen('home');this.heading(r,'每一道题都有最优解，谁更接近王座？');
  this.emblem(r,262,96);label(r,'四处旋钮 · 九枚秘印 · 三道每日同题',0,98,25,COLORS.white);
  const panel=node(r,'Daily Card',622,174);panel.setPosition(0,-73);const g=panel.addComponent(Graphics);
  fill(g,-311,-86,622,172,24,COLORS.panel,rgb(194,161,107));
  label(panel,'今 日 密 令',0,52,31,COLORS.gold,true);label(panel,`${this.day.slice(0,4)} / ${this.day.slice(4,6)} / ${this.day.slice(6)}`,0,9,20,COLORS.muted);
  const best=this.save.daily[this.day];label(panel,best?`个人最佳：多 ${best.extra} 步 · ${fmt(best.ms)}`:'今天三题相同，人人从同一起点出发',0,-39,22,COLORS.white);
  button(r,'挑战今日王座',0,-222,494,77,()=>this.begin('daily'),true);
  button(r,`闯关之路  ·  第 ${this.save.chapter} 关`,0,-322,494,69,()=>this.begin('campaign'));
  button(r,'好友排行榜',-150,-429,288,67,()=>this.rank());button(r,'分享挑战',150,-429,288,67,()=>this.share());
  if(!AD_UNITS.banner)label(r,'广告入口已预留，正式广告位需填入微信流量主 ID',0,-547,17,COLORS.muted);
  label(r,'胜负看最少步数，平局再比时间',0,-591,18,COLORS.muted);
 }
 private begin(m:Mode):void{
  this.mode=m;this.stage=0;this.chapter=this.save.chapter;this.totalMs=0;this.extra=0;this.perfect=0;this.assistedDaily=false;
  this.loadLevel();
 }
 private loadLevel():void{
  this.current=levelFor(this.mode,this.day,this.mode==='daily'?this.stage:this.chapter);
  this.board=this.current.board.slice();this.startBoard=this.board.slice();this.moves=0;this.elapsed=0;this.assisted=false;this.clockwise=true;this.hintMove=-1;this.locked=false;this.drawPlay();
 }
 private drawPlay():void{
  const r=this.createScreen('play');
  label(r,this.mode==='daily'?`今日密令  ·  第 ${this.stage+1} / 3 座`:`闯关之路  ·  第 ${this.chapter} 关`,0,573,28,COLORS.gold,true);
  button(r,'返回',-282,503,113,49,()=>this.home());label(r,'旋转四枚秘印，使棋盘复原',68,503,22,COLORS.muted,false,490,48);
  const stats=node(r,'Stats',630,92);stats.setPosition(0,411);const sg=stats.addComponent(Graphics);fill(sg,-315,-46,630,92,18,COLORS.panel,COLORS.edge);
  label(stats,'最优 '+this.current.optimum+' 步',-207,12,23,COLORS.gold,true,200,40);
  label(stats,'已走 '+this.moves+' 步',0,12,23,COLORS.white,true,186,40);
  this.timeLabel=label(stats,fmt(this.elapsed*1000),207,12,25,COLORS.mint,true,175,40);
  label(stats,'目标',-207,-25,16,COLORS.muted,false,176,27);label(stats,'实际',0,-25,16,COLORS.muted,false,176,27);label(stats,'耗时',207,-25,16,COLORS.muted,false,176,27);
  const target=node(r,'Goal',621,126);target.setPosition(0,300);const tg=target.addComponent(Graphics);fill(tg,-310,-63,620,126,22,rgb(18,38,51),COLORS.edge);
  label(target,'目标',-238,23,23,COLORS.gold,true,110,34);label(target,'1 ～ 9',-237,-17,19,COLORS.muted,false,113,30);
  for(let i=0;i<9;i++){const n=node(target,'Goal tile',48,32);n.setPosition(-77+(i%3)*60,39-Math.floor(i/3)*42);const g=n.addComponent(Graphics);fill(g,-24,-16,48,32,6,rgb(53,80,82),rgb(118,153,140));label(n,String(i+1),0,0,19,COLORS.gold,true,46,29);}
  label(r,'点击旋钮，相邻四枚秘印一起旋转',0,203,22,COLORS.white);
  const frame=node(r,'Puzzle',620,620);frame.setPosition(0,-114);const fg=frame.addComponent(Graphics);
  fill(fg,-301,-301,602,602,29,rgb(19,42,56),rgb(207,167,97));
  fill(fg,-283,-283,566,566,24,rgb(10,31,44),rgb(75,113,126));
  this.tileNodes=[];
  for(let i=0;i<9;i++){const n=this.tile(frame,this.board[i]);n.setPosition((i%3-1)*183,(1-Math.floor(i/3))*183);this.tileNodes.push(n);}
  for(let i=0;i<4;i++){
    const n=node(frame,'Rotor '+i,90,90);n.setPosition(i%2===0?-91.5:91.5,i<2?91.5:-91.5);
    const g=n.addComponent(Graphics);g.fillColor=rgb(14,37,50);g.circle(0,0,42);g.fill();ring(g,0,0,38,this.hintMove>=0&&Math.floor(this.hintMove/2)===i?COLORS.mint:COLORS.gold,4);
    g.fillColor=rgb(46,85,88);g.circle(0,0,34);g.fill();label(n,'⟳',0,0,47,COLORS.gold,true,81,77);
    n.on(Node.EventType.TOUCH_END,()=>this.turn(i));
  }
  label(r,'旋转方向',0,-427,21,COLORS.muted);
  button(r,this.clockwise?'↻  顺时针':'↺  逆时针',0,-485,259,65,()=>{this.clockwise=!this.clockwise;this.drawPlay();});
  button(r,'重新开始',-157,-570,295,64,()=>{if(this.locked)return;this.board=this.startBoard.slice();this.moves=0;this.elapsed=0;this.drawPlay();});
  button(r,'提示 / 激励视频',157,-570,295,64,()=>{void this.hint();});
  label(r,this.assisted?'提示已使用：本次仅供练习，不计好友榜':this.hintMove>=0?'高亮旋钮就是最短解的一步':'排名先比多走步数，再比完成速度',0,-619,17,this.assisted?COLORS.red:COLORS.muted);
 }
 private tile(parent:Node,v:number):Node{
  const n=node(parent,'Seal '+v,172,172),g=n.addComponent(Graphics);
  const tones=[rgb(53,112,125),rgb(73,87,128),rgb(101,81,117),rgb(57,112,95),rgb(129,92,83),rgb(60,96,128),rgb(107,116,84),rgb(119,84,112),rgb(60,119,124)];
  fill(g,-86,-86,172,172,18,rgb(6,23,36),rgb(191,154,86));fill(g,-80,-80,160,160,15,tones[v-1],rgb(215,198,140));
  fill(g,-72,-72,144,144,13,rgb(tones[v-1].r-15,tones[v-1].g-10,tones[v-1].b-7,218));
  ring(g,0,9,45,rgb(227,209,155,165),2);
  for(let k=0;k<4;k++){g.fillColor=COLORS.gold;g.circle((k%2?1:-1)*64,(k>=2?1:-1)*64,3.5);g.fill();}
  label(n,String(v),0,11,69,COLORS.gold,true,138,85);
  label(n,['◇','✦','✧','✶','◆','✥','☼','✹','⬟'][v-1],0,-53,24,COLORS.gold,true,120,40);
  return n;
 }
 private turn(rotor:number):void{
  if(this.screen!=='play'||this.locked)return;this.locked=true;this.wxapi.tap();this.sound('rotor');
  const dir=this.clockwise?1:-1;
  const squares=[[0,1,4,3],[1,2,5,4],[3,4,7,6],[4,5,8,7]][rotor];
  for(let i=0;i<4;i++){
    const destination=squares[(i+dir+4)%4];const n=this.tileNodes[squares[i]];
    tween(n).to(.22,{position:new Vec3((destination%3-1)*183,(1-Math.floor(destination/3))*183,0)},{easing:'sineInOut'}).start();
  }
  this.board=rotate(this.board,rotor,dir);this.moves++;this.hintMove=-1;
  const id=this.redrawId;this.scheduleOnce(()=>{
    if(id!==this.redrawId||this.screen!=='play')return;this.locked=false;
    if(solved(this.board))this.finish();else this.drawPlay();
  },.235);
 }
 private async hint():Promise<void>{
  if(this.screen!=='play'||this.locked)return;this.locked=true;
  const ad=await this.wxapi.hintAd();if(this.screen!=='play')return;this.locked=false;
  if(ad==='cancelled'){this.notify('未完整观看广告，本次未获得提示');return;}
  // Disabled ad units yield a free hint, but it is explicitly unranked.
  this.assisted=true;this.assistedDaily=true;
  try{const path=shortestSolution(this.board);if(path.length){this.hintMove=path[0];this.clockwise=path[0]%2===0;this.drawPlay();
   if(ad==='unavailable')this.notify('广告未接入：本次免费提示，不计入好友榜');}
  }catch(e){console.warn('solver',e);this.notify('提示不可用');}
 }
 private finish():void{
  this.sound(this.moves===this.current.optimum?'perfect':'complete');
  this.totalMs+=this.elapsed*1000;this.extra+=Math.max(0,this.moves-this.current.optimum);
  if(this.moves===this.current.optimum)this.perfect++;
  if(this.mode==='campaign'){
    const key=String(this.chapter),prev=this.save.chapters[key];if(prev===undefined||this.moves<prev)this.save.chapters[key]=this.moves;
    this.save.chapter=Math.max(this.save.chapter,this.chapter+1);store(this.save);this.cleared++;
  }
  this.result();
 }
 private finalizeDaily():void{
  if(this.assistedDaily)return;
  const rec:DailyScore={day:this.day,extra:this.extra,ms:Math.max(1,Math.round(this.totalMs)),perfect:this.perfect};
  if(isBetter(rec,this.save.daily[this.day])){this.save.daily[this.day]=rec;store(this.save);
   if(this.day===todayKey())this.wxapi.cloudScore(rec);
  }
 }
 private result():void{
  const last=this.mode==='daily'&&this.stage===2;if(last)this.finalizeDaily();
  const r=this.createScreen('result');this.heading(r,'棋局解封 · 荣耀属于真正的最优解');
  this.emblem(r,262,104);
  const waste=this.moves-this.current.optimum;
  label(r,waste===0?'完 美 复 原':waste<3?'精 密 推 演':'密 令 已 解',0,102,39,COLORS.gold,true);
  label(r,`本关 ${this.moves} 步 / 理论最少 ${this.current.optimum} 步`,0,46,25,COLORS.white);
  label(r,`用时 ${fmt(this.elapsed*1000)} · 多走 ${waste} 步`,0,1,22,COLORS.muted);
  if(this.mode==='daily'){
    label(r,`今日累计多走 ${this.extra} 步 · ${fmt(this.totalMs)}`,0,-66,26,COLORS.gold,true);
    label(r,`完美复原 ${this.perfect} / ${this.stage+1} 关`,0,-113,23,COLORS.white);
    if(last){
      label(r,this.assistedDaily?'练习完成 · 本轮不计榜':this.extra===0?'今日王座 · 三关全最优':'今日王座 · 密令破解',0,-175,26,this.assistedDaily?COLORS.muted:COLORS.mint,true);
      button(r,'分享成绩，邀请好友挑战',0,-282,534,74,()=>this.share(),true);
      button(r,'今日好友排行榜',0,-364,534,62,()=>this.rank());
      button(r,'再试一次',-152,-449,285,65,()=>this.begin('daily'));
      button(r,'返回大厅',152,-449,285,65,()=>this.home());
    }else{
      button(r,'进入下一道密令',0,-290,535,79,()=>{this.stage++;this.loadLevel();},true);
      button(r,'返回大厅',0,-396,387,67,()=>this.home());
    }
  }else{
    label(r,`已解锁第 ${this.chapter+1} 关`,0,-137,26,COLORS.mint,true);
    button(r,'继续闯关',0,-289,525,77,()=>{this.wxapi.showInterAtMilestone(this.cleared);this.chapter++;this.loadLevel();},true);
    button(r,'返回大厅',0,-404,384,64,()=>this.home());
  }
  if(!AD_UNITS.banner)label(r,'正式 Banner 广告展示区域已预留',0,-565,17,COLORS.muted);
 }
 private share():void{
  const completed=this.mode==='daily'&&this.screen==='result'&&this.stage===2&&!this.assistedDaily;
  if(!this.wxapi.share(this.day,completed?this.extra:undefined))this.notify('微信分享仅在微信小游戏运行环境有效');
 }
 private rank():void{
  const r=this.createScreen('rank');this.heading(r,'同题较量 · 先看额外步数，再看速度');
  const pane=node(r,'Ranking',628,820);pane.setPosition(0,-40);const g=pane.addComponent(Graphics);
  fill(g,-314,-410,628,820,21,COLORS.panel,COLORS.edge);
  if(isWechat()){
    const layer=node(pane,'WeChat open data context',600,760);layer.setPosition(0,0);
    const sub=layer.addComponent(SubContextView);sub.fps=4;this.scheduleOnce(()=>{if(this.screen==='rank')this.wxapi.rank(this.day);},.2);
  }else{
    label(pane,'微信好友王座',0,275,36,COLORS.gold,true);
    label(pane,'请在微信开发者工具或微信真机查看真实好友榜',0,95,22,COLORS.white);
    const best=this.save.daily[this.day];
    label(pane,best?`本机今日最好：多 ${best.extra} 步，耗时 ${fmt(best.ms)}`:'本机还没有今日有效成绩',0,35,21,COLORS.muted);
    label(pane,'浏览器版本不会伪造好友数据',0,-35,20,COLORS.muted);
  }
  button(r,'返回大厅',0,-540,403,68,()=>this.home(),true);
  button(r,'邀请好友挑战',0,-616,403,48,()=>this.share());
 }
 private notify(msg:string):void{
  const old=this.node.getChildByName('Toast');if(old)old.destroy();
  const n=node(this.node,'Toast',660,70);n.setPosition(0,-260);const g=n.addComponent(Graphics);fill(g,-330,-35,660,70,18,COLORS.panel,COLORS.gold);
  label(n,msg,0,0,20,COLORS.white,true,640,64);
  this.scheduleOnce(()=>{if(n.isValid)n.destroy();},2.2);
 }
}

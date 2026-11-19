import {Node,UITransform,Graphics,Color,Label,LabelOutline,Vec3,tween,Layers} from 'cc';
import type {ToolId} from './core/types';

export const PALETTE={ink:'#152b35',deep:'#10212b',panel:'#233d47',gold:'#efbd72',cream:'#fff0cf',muted:'#a7c0bc',mint:'#81e5d2',danger:'#f08369'};
export function rgba(hex:string,alpha=255):Color {
  const h=hex.replace('#','');return new Color(parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16),alpha);
}
export function uiNode(name:string,parent:Node,width:number,height:number,x=0,y=0):Node {
  const n=new Node(name);n.layer=Layers.Enum.UI_2D;n.parent=parent;n.addComponent(UITransform).setContentSize(width,height);n.setPosition(x,y,0);return n;
}
export function label(parent:Node,text:string,size:number,x:number,y:number,width=650,height=size*1.7,color=PALETTE.cream,bold=false):Label {
  const n=uiNode('Text',parent,width,height,x,y);const l=n.addComponent(Label);l.string=text;l.fontSize=size;l.lineHeight=size*1.35;l.isBold=bold;
  l.horizontalAlign=Label.HorizontalAlign.CENTER;l.verticalAlign=Label.VerticalAlign.CENTER;l.overflow=Label.Overflow.SHRINK;l.color=rgba(color);l.fontFamily='Arial';
  const outline=n.addComponent(LabelOutline);outline.color=rgba('#0a1b1c',190);outline.width=1.5;return l;
}
export function panel(parent:Node,width:number,height:number,x:number,y:number,fill=PALETTE.panel,edge=PALETTE.gold,radius=24,opacity=246):Node {
  const n=uiNode('Panel',parent,width,height,x,y),g=n.addComponent(Graphics);
  g.fillColor=rgba('#050e18',165);g.roundRect(-width/2+1,-height/2-7,width,height,radius);g.fill();
  g.fillColor=rgba(fill,opacity);g.roundRect(-width/2,-height/2,width,height,radius);g.fill();
  g.fillColor=rgba('#ffffff',8);g.roundRect(-width/2+4,2,width-8,height/2-6,Math.max(5,radius-3));g.fill();
  g.lineWidth=2;g.strokeColor=rgba(edge,175);g.roundRect(-width/2+1,-height/2+1,width-2,height-2,radius);g.stroke();
  g.lineWidth=1;g.strokeColor=rgba(edge,45);g.roundRect(-width/2+6,-height/2+6,width-12,height-12,Math.max(3,radius-5));g.stroke();
  if(width>380&&height>110){
    for(const side of [-1,1])for(const end of [-1,1]){
      const xx=side*(width/2-14),yy=end*(height/2-14);
      g.fillColor=rgba('#07131c',150);g.circle(xx,yy-1,3.7);g.fill();
      g.fillColor=rgba(edge,180);g.circle(xx,yy,2.3);g.fill();
    }
  }
  return n;
}
export function button(parent:Node,text:string,x:number,y:number,width:number,height:number,action:()=>void,accent=true):Node {
  const node=panel(parent,width,height,x,y,accent?'#dba555':'#294853',accent?'#ffdfa3':'#6f9a9d',Math.min(18,height*.28),255);
  label(node,text,28,0,1,width-20,height,accent?'#2a251d':PALETTE.cream,true);
  node.on(Node.EventType.TOUCH_START,(event:any)=>{event.propagationStopped=true;tween(node).stop();node.setScale(.97,.97,1);});
  node.on(Node.EventType.TOUCH_END,(event:any)=>{event.propagationStopped=true;tween(node).to(.12,{scale:new Vec3(1,1,1)},{easing:'backOut'}).start();action();});
  node.on(Node.EventType.TOUCH_CANCEL,()=>{node.setScale(1,1,1);});
  return node;
}
export function separator(parent:Node,width:number,x:number,y:number):Node {
  const n=uiNode('Rule',parent,width,2,x,y),g=n.addComponent(Graphics);g.strokeColor=rgba(PALETTE.gold,80);g.lineWidth=1;g.moveTo(-width/2,0);g.lineTo(width/2,0);g.stroke();return n;
}

/** Small engraved equipment badges, drawn in the same brass/leather UI palette. */
export function toolIcon(parent:Node,tool:ToolId,x:number,y:number,size=64):Node {
  const n=uiNode('ToolBadge',parent,64,64,x,y);n.setScale(size/64,size/64,1);
  const g=n.addComponent(Graphics);
  g.fillColor=rgba('#0a1b24');g.circle(0,-2,30);g.fill();
  g.lineWidth=2;g.strokeColor=rgba('#d4a466',210);g.circle(0,0,28);g.stroke();
  g.lineWidth=1;g.strokeColor=rgba('#91c9bc',55);g.circle(0,0,23);g.stroke();
  if(tool==='heavy'){
    g.fillColor=rgba('#a66b38');g.roundRect(-16,-9,32,27,8);g.fill();
    g.fillColor=rgba('#f1c078');g.roundRect(-14,-5,27,25,7);g.fill();
    for(const xx of [-9,0,9]){g.fillColor=rgba('#ffe0a0');g.roundRect(xx-3,8,6,10,2);g.fill();}
    g.fillColor=rgba('#654632');g.roundRect(-13,-18,26,11,3);g.fill();
    g.fillColor=rgba('#cf9b5a');g.roundRect(-8,-17,16,6,2);g.fill();
    g.lineWidth=2;g.strokeColor=rgba('#825b39');g.moveTo(-10,1);g.lineTo(10,1);g.stroke();
  }else if(tool==='grip'){
    g.fillColor=rgba('#4b9a89');g.roundRect(-12,-12,24,22,7);g.fill();
    for(const [xx,yy] of [[-13,12],[-3,17],[7,16]]){
      g.lineWidth=7;g.strokeColor=rgba('#8bd8b7');g.moveTo(xx,-1);g.lineTo(xx,yy);g.stroke();
      g.fillColor=rgba('#e1b978');g.circle(xx,yy,3);g.fill();
    }
    g.lineWidth=7;g.strokeColor=rgba('#65bca0');g.moveTo(7,-7);g.lineTo(17,3);g.stroke();
    g.fillColor=rgba('#c79555');g.roundRect(-11,-19,22,8,3);g.fill();
  }else if(tool==='return'){
    g.lineWidth=7;g.strokeColor=rgba('#e1b573');g.arc(0,0,16,-.3,Math.PI*1.48,false);g.stroke();
    g.fillColor=rgba('#ffe0a0');g.moveTo(0,-21);g.lineTo(2,-7);g.lineTo(-10,-15);g.close();g.fill();
    g.fillColor=rgba('#83cdb7');g.circle(0,0,7);g.fill();
    g.fillColor=rgba('#18373e');g.circle(0,0,3);g.fill();
  }else{
    g.lineWidth=3;g.strokeColor=rgba(PALETTE.muted,150);g.moveTo(-10,0);g.lineTo(10,0);g.stroke();
  }
  return n;
}

/** Fixed brass-and-leather thumb control. Input is owned by GameMain, not the art. */
export interface JoystickArt {root:Node;thumb:Node;meter:Graphics;caption:Label;glow:Node;}
export function joystick(parent:Node,x:number,y:number):JoystickArt {
  const root=uiNode('Joystick',parent,244,244,x,y),g=root.addComponent(Graphics);
  const circle=(r:number,color:string,alpha=255,yy=0):void=>{g.fillColor=rgba(color,alpha);g.circle(0,yy,r);g.fill();};
  circle(114,'#030d16',160,-7);circle(111,'#966d40');circle(107,'#e2b779');circle(101,'#243d47');circle(96,'#0a1a25');circle(84,'#203944');
  g.lineWidth=1.5;g.strokeColor=rgba('#9ed5cc',35);g.circle(0,0,76);g.stroke();
  for(let i=0;i<24;i++){
    const a=i*Math.PI/12,major=i%6===0;
    g.lineWidth=major?3:1.5;g.strokeColor=rgba(major?'#d9b881':'#7b9999',major?180:95);
    g.moveTo(Math.cos(a)*88,Math.sin(a)*88);g.lineTo(Math.cos(a)*(major?97:93),Math.sin(a)*(major?97:93));g.stroke();
  }
  for(const [xx,yy] of [[-72,-72],[72,-72],[-72,72],[72,72]]){
    g.fillColor=rgba('#111e26');g.circle(xx,yy-1,4.5);g.fill();g.fillColor=rgba('#c69455');g.circle(xx,yy,3);g.fill();
  }
  const glow=uiNode('StickGlow',root,220,220),gg=glow.addComponent(Graphics);
  gg.lineWidth=3;gg.strokeColor=rgba(PALETTE.mint,180);gg.circle(0,0,102);gg.stroke();glow.active=false;
  const meter=uiNode('StickPower',root,220,220).addComponent(Graphics);
  const thumb=uiNode('StickThumb',root,84,84),t=thumb.addComponent(Graphics);
  t.fillColor=rgba('#020b13',160);t.circle(0,-6,42);t.fill();t.fillColor=rgba('#bf884b');t.circle(0,0,41);t.fill();
  t.fillColor=rgba('#ffe0a3');t.circle(0,2,37);t.fill();t.fillColor=rgba('#38626b');t.circle(0,1,32);t.fill();
  t.fillColor=rgba('#447985');t.circle(0,6,28);t.fill();
  t.lineWidth=2;t.strokeColor=rgba('#91c9c5',120);t.arc(0,2,26,.3,Math.PI-.3,false);t.stroke();
  t.fillColor=rgba('#e8d2a0');t.moveTo(0,20);t.lineTo(6,9);t.lineTo(-6,9);t.close();t.fill();
  for(const yy of [-9,-3,3]){t.lineWidth=2;t.strokeColor=rgba('#123c49',165);t.moveTo(-10,yy);t.lineTo(10,yy);t.stroke();}
  const caption=label(root,'推动瞄准',24,0,-135,265,38,PALETTE.muted,true);
  return {root,thumb,meter,caption,glow};
}

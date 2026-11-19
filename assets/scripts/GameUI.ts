import {Node,UITransform,Graphics,Color,Label,LabelOutline,Vec3,tween,Layers} from 'cc';

export const PALETTE={ink:'#172a2c',deep:'#0f2023',panel:'#263d3e',gold:'#e5b76c',cream:'#fff0c9',muted:'#aec0ad',mint:'#87d5ae',danger:'#e87962'};
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
  g.fillColor=rgba('#071616',120);g.roundRect(-width/2+2,-height/2-8,width,height,radius);g.fill();
  g.fillColor=rgba(fill,opacity);g.roundRect(-width/2,-height/2,width,height,radius);g.fill();
  g.lineWidth=2;g.strokeColor=rgba(edge,160);g.roundRect(-width/2+1,-height/2+1,width-2,height-2,radius);g.stroke();
  g.lineWidth=1;g.strokeColor=rgba(edge,35);g.roundRect(-width/2+7,-height/2+7,width-14,height-14,Math.max(3,radius-5));g.stroke();
  return n;
}
export function button(parent:Node,text:string,x:number,y:number,width:number,height:number,action:()=>void,accent=true):Node {
  const node=panel(parent,width,height,x,y,accent?'#dba456':'#294345',accent?'#ffe2a1':'#839b84',20,255);
  label(node,text,28,0,1,width-20,height,accent?'#2a251d':PALETTE.cream,true);
  node.on(Node.EventType.TOUCH_START,(event:any)=>{event.propagationStopped=true;tween(node).stop();node.setScale(.97,.97,1);});
  node.on(Node.EventType.TOUCH_END,(event:any)=>{event.propagationStopped=true;tween(node).to(.12,{scale:new Vec3(1,1,1)},{easing:'backOut'}).start();action();});
  node.on(Node.EventType.TOUCH_CANCEL,()=>{node.setScale(1,1,1);});
  return node;
}
export function separator(parent:Node,width:number,x:number,y:number):Node {
  const n=uiNode('Rule',parent,width,2,x,y),g=n.addComponent(Graphics);g.strokeColor=rgba(PALETTE.gold,80);g.lineWidth=1;g.moveTo(-width/2,0);g.lineTo(width/2,0);g.stroke();return n;
}

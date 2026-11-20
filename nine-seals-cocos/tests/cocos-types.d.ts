declare module 'cc' {
  export const _decorator: { ccclass(name: string): ClassDecorator };
  export class Component { node:Node; scheduleOnce(fn:()=>void,delay:number):void; start?():void; }
  export class Node { constructor(name?:string); layer:number; name:string; children:Node[]; addChild(n:Node):void; addComponent<T>(cls:new(...args:any[])=>T):T; setPosition(x:number|Vec3,y?:number,z?:number):void; setScale(x:number|Vec3,y?:number,z?:number):void; on(e:string,cb:()=>void):void; destroy():void; static EventType:{TOUCH_END:string}; }
  export const Layers:{Enum:{UI_2D:number}};
  export class UITransform { setContentSize(w:number,h:number):void; }
  export class Color { constructor(r:number,g:number,b:number,a?:number); r:number;g:number;b:number; }
  export class Graphics { node:Node;fillColor:Color;strokeColor:Color;lineWidth:number;fill():void;stroke():void;roundRect(...args:number[]):void;rect(...args:number[]):void;circle(...args:number[]):void;moveTo(...args:number[]):void;lineTo(...args:number[]):void; }
  export class Label { static HorizontalAlign:{CENTER:number};static VerticalAlign:{CENTER:number};static Overflow:{SHRINK:number};string:string;fontSize:number;lineHeight:number;color:Color;isBold:boolean;horizontalAlign:number;verticalAlign:number;overflow:number; }
  export class Vec3 { constructor(x:number,y:number,z:number); }
  export function tween<T>(target:T):{to(d:number,v:object,opts?:object):ReturnType<typeof tween>;start():void};
  export class SubContextView { fps:number; }
  export class AudioClip {}
  export class AudioSource { volume:number;loop:boolean;clip:AudioClip;playing:boolean;playOnAwake:boolean;pause():void;play():void;playOneShot(clip:AudioClip,vol?:number):void; }
  export const resources: {load(path:string,t:typeof AudioClip, cb:(err:any,clip:AudioClip)=>void):void};
  export const sys:{localStorage:{getItem(k:string):string|null;setItem(k:string,v:string):void}};
}

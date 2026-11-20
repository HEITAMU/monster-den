/** Sculptural meshes: original 3D surfaces with real normals, never billboard sprites. */
import {Color, Material, MeshRenderer, Mesh, Node, utils} from 'cc';
import {Kind} from './Rules';
type Vector={x:number;y:number;z:number};
export type Sculpture={node:Node;fins:Node[];heart?:Node};
const C=Math.PI*2, V=(x:number,y:number,z:number):Vector=>({x,y,z});
const mesh=new Map<string,Mesh>(),mat=new Map<string,Material>();
function meshOf(key:string,nu:number,nv:number,fn:(u:number,v:number)=>Vector,outward=false){
 if(mesh.has(key))return mesh.get(key)!;
 const positions:number[]=[],indices:number[]=[];
 for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++){
  const p=fn(i/nu,j/nv);positions.push(p.x,p.y,p.z);
 }
 for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){
  const a=j*(nu+1)+i,b=a+1,c=a+nu+1,d=c+1;
  if(outward)indices.push(a,b,c,b,d,c);else indices.push(a,c,b,b,c,d);
 }
 const normals=new Array<number>(positions.length).fill(0);
 for(let i=0;i<indices.length;i+=3){
  const a=indices[i]*3,b=indices[i+1]*3,c=indices[i+2]*3;
  const ax=positions[b]-positions[a],ay=positions[b+1]-positions[a+1],az=positions[b+2]-positions[a+2];
  const bx=positions[c]-positions[a],by=positions[c+1]-positions[a+1],bz=positions[c+2]-positions[a+2];
  const x=ay*bz-az*by,y=az*bx-ax*bz,z=ax*by-ay*bx;
  for(const k of [a,b,c]){normals[k]+=x;normals[k+1]+=y;normals[k+2]+=z;}
 }
 for(let i=0;i<normals.length;i+=3){const m=Math.hypot(normals[i],normals[i+1],normals[i+2])||1;
  normals[i]/=m;normals[i+1]/=m;normals[i+2]/=m;}
 const result=utils.MeshUtils.createMesh({positions,normals,indices} as any);mesh.set(key,result);return result;
}
function skin(name:string,r:number,g:number,b:number,metallic=.05,glow=false):Material{
 const key=name+':'+r+':'+g+':'+b+':'+glow;
 if(mat.has(key))return mat.get(key)!;
 const m=new Material();m.initialize({effectName:glow?'builtin-unlit':'builtin-standard'});
 m.setProperty('mainColor',new Color(r,g,b,255));
 if(!glow){m.setProperty('roughness',.4);m.setProperty('metallic',metallic);}
 mat.set(key,m);return m;
}
const shell=(key:string,rx:number,ry:number,rz:number,ridges=7)=>meshOf('shell/'+key,26,16,(u,v)=>{
 const a=u*C,t=v*Math.PI,ring=Math.sin(t)*(1+.09*Math.sin(a*ridges+v*8)+.035*Math.sin(a*13-v*9));
 return V(rx*ring*Math.cos(a+v*.15),ry*Math.cos(t)+.035*Math.sin(t*8+a*5),rz*ring*Math.sin(a+v*.15));
},true);
const ring=(key:string,R:number,r:number)=>meshOf('ring/'+key,46,8,(u,v)=>{
 const a=u*C,b=v*C;return V((R+r*Math.cos(b))*(1+.014*Math.sin(a*11))*Math.cos(a),r*Math.sin(b),(R+r*Math.cos(b))*(1+.014*Math.sin(a*11))*Math.sin(a));
});
const tendril=(key:string,L:number,r:number,curve:number)=>meshOf('tendril/'+key,9,13,(u,v)=>{
 const a=u*C,k=r*(1-v)**.8+.005;
 return V(curve*v*v+Math.sin(v*7)*.08*v+Math.cos(a)*k,v*L,Math.sin(v*5)*curve*.25+Math.sin(a)*k);
});
const fin=(key:string,L:number,B:number)=>meshOf('fin/'+key,14,10,(u,v)=>{
 const taper=Math.sin(Math.PI*u)**.7;
 return V(L*u, .3*Math.sin(u*Math.PI)+.08*Math.sin(u*12)+v*.075,(v-.5)*B*taper+.02*Math.sin(v*8));
});
function put(parent:Node,name:string,m:Mesh,skinMat:Material,x=0,y=0,z=0){
 const n=new Node(name);n.parent=parent;n.setPosition(x,y,z);
 const renderer=n.addComponent(MeshRenderer);renderer.mesh=m;renderer.setMaterial(skinMat,0);return n;
}
const a=(n:string,r:number,g:number,b:number,metal=.12,glow=false)=>skin(n,r,g,b,metal,glow);
const ink=()=>a('navy',31,63,73,.05),bone=()=>a('bone',216,206,160,.05),gold=()=>a('gold',203,158,94,.6),
 jade=()=>a('jade',58,171,154,.26),cyan=()=>a('cyan',81,245,225,0,true),violet=()=>a('violet',127,102,172,.25),rose=()=>a('rose',242,154,209,.1,true);
export class Art {
 static environment(parent:Node){const root=new Node('Sunken Sanctum');root.parent=parent;
  put(root,'Ridge foundation',shell('ground',9.65,.42,9.65,28),ink(),0,-.75,0);
  put(root,'Tidewood basin',shell('basin',7.5,.12,7.5,19),a('tealstone',21,87,99,.22),0,-.45,0);
  put(root,'Gilded tide strata',ring('strata',6.7,.12),gold(),0,-.25,0);
  put(root,'Broken reef ledge',ring('ledge',8.45,.42),a('ledge',51,94,99),0,-.35,0);
  for(let i=0;i<18;i++){const t=i*C/18,r=8.4;
   const column=new Node('Coral buttress '+i);column.parent=root;column.setPosition(Math.cos(t)*r,-.2,Math.sin(t)*r);
   column.setRotationFromEuler(0,-t*180/Math.PI,0);
   put(column,'Spiral coral bone',tendril('column'+(i%4),1.1+i%4*.25,.15,.27),i%4===0?gold():ink());
   for(let j=0;j<3;j++){const blade=put(column,'Laminated fin',fin('ledge-fin'+j,.45,.3),j===1?jade():bone(),0,.24+j*.22,0);blade.setRotationFromEuler(j*15,j*105,0);}
  }
  for(let i=0;i<11;i++){const t=i*C/11,rootPlant=new Node('Dancing kelp');rootPlant.parent=root;
   rootPlant.setPosition(Math.cos(t)*6.8,-.27,Math.sin(t)*6.8);
   for(let j=0;j<3;j++){const piece=put(rootPlant,'Curved kelp',tendril('kelp'+j,.65+j*.2,.07,.4),j===1?jade():ink());piece.setRotationFromEuler(10,j*105,0);}
  }
  return root;
 }
 static core(parent:Node):Sculpture{const root=new Node('Living tide engine');root.parent=parent;const fins:Node[]=[];
  put(root,'Nacre crown',shell('crown',1.1,.44,1.1,14),ink(),0,.22,0);
  put(root,'Sculpted outer shell',shell('casing',.78,.83,.76,12),jade(),0,1.1,0);
  put(root,'Antique halo',ring('beacon',.89,.14),gold(),0,.82,0);
  put(root,'Nacreous chamber',shell('casing-inner',.48,.56,.47,9),bone(),0,1.27,0);
  const heart=put(root,'Beating fire',shell('ember',.29,.41,.3,11),cyan(),0,1.46,0);
  for(let i=0;i<8;i++){const t=i*C/8,node=new Node('Breathing reef horn');node.parent=root;
   node.setPosition(Math.cos(t)*.8,.4,Math.sin(t)*.8);node.setRotationFromEuler(-15,-t*180/Math.PI,0);
   put(node,'Carved tendon',tendril('core-tendon',1.0,.14,.35),i%2?bone():gold());fins.push(node);
  }
  return {node:root,fins,heart};
 }
 static enemy(parent:Node,kind:Kind):Sculpture{const root=new Node('Creature '+kind);root.parent=parent;const fins:Node[]=[];
  const boss=kind==='titan',urchin=kind==='thorn',bomb=kind==='volatile';
  put(root,'Layered body',shell('body-'+kind,boss?1.2:urchin?.62:.53,boss?.7:.34,boss?1.3:.67,boss?11:urchin?13:7),
   boss?violet():urchin?violet():bomb?rose():jade(),0,.48,0);
  put(root,'Facial carapace',shell('face-'+kind,boss?.83:.36,boss?.4:.18,boss?.78:.4,9),bone(),0,.55,boss?-.72:-.26);
  for(let side of [-1,1]){
   const blade=put(root,'Ripple membrane',fin('creature-fin-'+kind,boss?1.3:.85,boss?.7:.48),kind==='volatile'?violet():jade(),side*(boss?.75:.38),.42,.1);
   blade.setScale(side,1,1);fins.push(blade);
   put(root,'Living eye',shell('eye',.09,.085,.07,6),bomb?rose():cyan(),side*(boss?.45:.21),.64,boss?-1.34:-.58);
  }
  const horns=boss?10:urchin?9:bomb?6:2;
  for(let i=0;i<horns;i++){const t=i*C/horns,n=new Node('Articulated tentacle');n.parent=root;
   n.setPosition(Math.cos(t)*(boss?.87:.40),.5,Math.sin(t)*(boss?.84:.42));
   n.setRotationFromEuler(boss?-35:urchin?-20:140,-t*180/Math.PI,0);
   put(n,'Organic tapered sculpt',tendril(kind+'-horn'+(i%3),boss?1.1:urchin?.85:.57,boss?.15:.095,.28),i%3===0?gold():bone());fins.push(n);
  }
  return {node:root,fins};
 }
 static missile(parent:Node):Sculpture{const root=new Node('Resonant projectile');root.parent=parent;
  put(root,'Nacre projectile',shell('missile',.27,.24,.4,9),jade(),0,.34,0);
  const fins:Node[]=[];for(let i=0;i<4;i++){
   const blade=put(root,'Turning wing',fin('shot-fin',.38,.28),i%2?gold():bone(),0,.32,0);
   blade.setRotationFromEuler(0,i*90,0);fins.push(blade);
  }return {node:root,fins};
 }
 static ripple(parent:Node,type:string){const root=new Node('Reactive pulse');root.parent=parent;
  put(root,'Expanding corona',ring('pulse-ring',1.0,.11),type==='hurt'?rose():type==='explode'?gold():cyan(),0,.25,0);
  return root;
 }
}

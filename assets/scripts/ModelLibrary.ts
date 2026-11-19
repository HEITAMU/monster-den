import { _decorator, Component, Node, Mesh, MeshRenderer, Material, Color, Vec3, Vec4, Quat, utils, resources, JsonAsset, EffectAsset, gfx } from 'cc';
import {decodeMesh,PackedMeshData} from './MeshCodec';
import {loadGameBundle} from './ResourceBundles';

export interface MeshData { positions:number[]; normals:number[]; colors:number[]; uvs:number[]; indices:number[]; }
export interface ModelPart { name:string; parent:number; position:number[]; rotation:number[]; scale:number[]; mesh?:MeshData|PackedMeshData; }
export interface ModelPrefab { nodes:ModelPart[]; bounds:{min:number[];max:number[]}; }
export interface ModelInstance { root:Node; parts:Map<string,Node>; baseEuler:Map<string,Vec3>; basePosition:Map<string,Vec3>; }
const editorEffects:Record<string,EffectAsset>={};

/** Small effect meshes belong to their node; model-library meshes are shared. */
@_decorator.ccclass('MonsterDenOwnedMesh')
class OwnedMesh extends Component {
  mesh:Mesh|null=null;
  release():void {this.mesh?.destroy();this.mesh=null;}
  onDestroy():void {this.release();}
}

export async function loadGameJson(path:string):Promise<any> {
  if ((globalThis as any).__monsterDenRuntime) {
    const version=(globalThis as any).__monsterDenRuntime.version;
    const response=await fetch(`./resources/${path}.json${version?`?v=${encodeURIComponent(version)}`:''}`);
    if(!response.ok) throw new Error(`Resource unavailable: ${path}`);
    return response.json();
  }
  const [bundleName,...relative]=path.split('/');
  const bundle=await loadGameBundle(bundleName);
  return new Promise((resolve,reject)=>bundle.load(relative.join('/'),JsonAsset,(err,asset)=>err?reject(err):resolve(asset.json)));
}

export async function loadGameEffects():Promise<void> {
  if ((globalThis as any).__monsterDenRuntime) return;
  await Promise.all(['monster-den-lit','monster-den-unlit'].map(name=>new Promise<void>((resolve,reject)=>{
    resources.load(`effects/${name}`,EffectAsset,(err,asset)=>{if(err)reject(err);else{editorEffects[name]=asset;resolve();}});
  })));
}

export function makeMaterial(color:Color,lit=true,alpha=false,vertexColors=false,emission=0):Material {
  const material=new Material();
  const effectAsset=editorEffects[lit?'monster-den-lit':'monster-den-unlit'];
  // Base Material.overridePipelineStates is intentionally a no-op in 3.8.8.
  // Supply overrides while initializing the shared asset so real GPU passes
  // retain transparent blending and do not write invisible depth.
  material.initialize({...(effectAsset?{effectAsset}:{effectName:lit?'monster-den/lit':'monster-den/unlit'}),defines:{USE_VERTEX_COLOR:vertexColors,USE_TEXTURE:false},
    ...(alpha?{states:{
      rasterizerState:{cullMode:gfx.CullMode.NONE},
      depthStencilState:{depthTest:true,depthWrite:false},
      blendState:{targets:[{blend:true,blendSrc:gfx.BlendFactor.SRC_ALPHA,blendDst:gfx.BlendFactor.ONE_MINUS_SRC_ALPHA,blendSrcAlpha:gfx.BlendFactor.ONE,blendDstAlpha:gfx.BlendFactor.ONE_MINUS_SRC_ALPHA}]},
    }}:{}),
  });
  material.setProperty('mainColor',color);
  material.setProperty('surfaceParams',new Vec4(.78,.45,emission,0));
  return material;
}

export function meshNode(name:string,data:MeshData,material:Material,parent?:Node):Node {
  const node=new Node(name);
  const renderer=node.addComponent(MeshRenderer);
  const mesh=utils.createMesh(data as any);
  renderer.mesh=mesh;
  const owner=node.addComponent(OwnedMesh);owner.mesh=mesh;
  // Hidden nodes can be destroyed before their components ever load; Cocos
  // skips their onDestroy hook. Node destruction still releases their buffers.
  node.once(Node.EventType.NODE_DESTROYED,owner.release,owner);
  renderer.setMaterial(material,0);
  if(parent)node.parent=parent;
  return node;
}

/** Actual Blender meshes, with shared mesh buffers and independent joint nodes. */
export class ModelLibrary {
  prefabs:Record<string,ModelPrefab>={};
  private meshes=new Map<string,Mesh>();
  private material:Material;
  constructor(data:any) {
    if(data?.version!==1||data.coordinateSystem!=='Y_UP')throw new Error('Unsupported model library');
    this.prefabs=data.prefabs;
    this.material=makeMaterial(new Color(255,255,255,255),true,false,true);
    for(const [key,prefab] of Object.entries(this.prefabs))
      prefab.nodes.forEach((part,i)=>{if(part.mesh)this.meshes.set(`${key}:${i}`,utils.createMesh(decodeMesh(part.mesh) as any));});
  }
  has(name:string):boolean{return !!this.prefabs[name];}
  dispose():void {
    for(const mesh of this.meshes.values())mesh.destroy();
    this.meshes.clear();this.material.destroy();this.prefabs={};
  }
  instantiate(key:string,parent:Node,scale=1):ModelInstance {
    const prefab=this.prefabs[key];if(!prefab)throw new Error(`Missing 3D prefab: ${key}`);
    const root=new Node(key);root.parent=parent;root.setScale(scale,scale,scale);
    const parts=new Map<string,Node>(),baseEuler=new Map<string,Vec3>(),basePosition=new Map<string,Vec3>();
    const nodes=prefab.nodes.map((part,i)=>{
      const node=new Node(part.name);node.setPosition(...part.position as [number,number,number]);
      node.setRotation(new Quat(...part.rotation as [number,number,number,number]));node.setScale(...part.scale as [number,number,number]);
      const mesh=this.meshes.get(`${key}:${i}`);if(mesh){const renderer=node.addComponent(MeshRenderer);renderer.mesh=mesh;renderer.setMaterial(this.material,0);}
      parts.set(part.name,node);baseEuler.set(part.name,node.eulerAngles.clone());basePosition.set(part.name,node.position.clone());return node;
    });
    prefab.nodes.forEach((part,i)=>{nodes[i].parent=part.parent<0?root:nodes[part.parent];});
    return {root,parts,baseEuler,basePosition};
  }
  fitFootprint(instance:ModelInstance,key:string,width:number,depth:number,heightScale=1):void {
    const b=this.prefabs[key].bounds;
    instance.root.setScale(width/(b.max[0]-b.min[0]),heightScale,depth/(b.max[2]-b.min[2]));
  }
}

export function discMesh(radius=1,innerAlpha=.22,outerAlpha=0,segments=40):MeshData {
  const positions=[0,0,0],normals=[0,1,0],colors=[1,1,1,innerAlpha],uvs=[.5,.5],indices:number[]=[];
  for(let i=0;i<=segments;i++){const a=i/segments*Math.PI*2;positions.push(Math.cos(a)*radius,0,Math.sin(a)*radius);normals.push(0,1,0);colors.push(1,1,1,outerAlpha);uvs.push(Math.cos(a)*.5+.5,Math.sin(a)*.5+.5);if(i)indices.push(0,i+1,i);}
  return {positions,normals,colors,uvs,indices};
}

export function ringMesh(radius=1,width=.07,segments=48):MeshData {
  const positions:number[]=[],normals:number[]=[],colors:number[]=[],uvs:number[]=[],indices:number[]=[];
  for(let i=0;i<=segments;i++)for(let j=0;j<2;j++){const a=i/segments*Math.PI*2,r=radius-j*width;positions.push(Math.cos(a)*r,0,Math.sin(a)*r);normals.push(0,1,0);colors.push(1,1,1,j?.8:.15);uvs.push(i/segments,j);}
  for(let i=0;i<segments;i++){const a=i*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}
  return {positions,normals,colors,uvs,indices};
}

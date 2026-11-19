#!/usr/bin/env node
/** Deterministic asset IDs, preserving every existing Creator .meta. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),assets=path.join(root,'assets');
function uuid(name){const hex=crypto.createHash('sha256').update('monster-den-v1:'+name).digest('hex').slice(0,32).split('');hex[12]='4';hex[16]='8';const s=hex.join('');return `${s.slice(0,8)}-${s.slice(8,12)}-${s.slice(12,16)}-${s.slice(16,20)}-${s.slice(20)}`;}
function compressed(id){const hex=id.replace(/-/g,''),a='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';let r=hex.slice(0,2);for(let i=2;i<32;i+=3){const n=parseInt(hex.slice(i,i+3),16);r+=a[n>>6]+a[n&63];}return r;}
function meta(file,type,version,files=[]){const dest=file+'.meta';if(fs.existsSync(dest))return JSON.parse(fs.readFileSync(dest)).uuid;const id=uuid(path.relative(root,file).split(path.sep).join('/'));fs.writeFileSync(dest,JSON.stringify({ver:version,importer:type,imported:true,uuid:id,files,subMetas:{},userData:{}},null,2)+'\n');return id;}
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.name.endsWith('.meta'))continue;if(e.isDirectory()){meta(f,'directory','1.2.0');walk(f);}else if(e.name.endsWith('.ts'))meta(f,'typescript','4.0.24');else if(e.name.endsWith('.json'))meta(f,'json','2.0.1',['.json']);else if(e.name.endsWith('.effect'))meta(f,'effect','1.7.1',['.json']);else if(e.name.endsWith('.mp3'))meta(f,'audio-clip','1.0.0',['.mp3','.json']);}}
walk(assets);
// Creator 3.8 stores per-platform bundle settings by bundleConfigID in builder.json.
// Schema checked against cocos/cocos-test-projects v3.8, not an older 2.x meta.
const builderPath=path.join(root,'settings/v2/packages/builder.json');
const builder=fs.existsSync(builderPath)?JSON.parse(fs.readFileSync(builderPath)): {__version__:'1.3.5'};
builder.bundleConfig ??= {};builder.bundleConfig.custom ??= {};
for(const name of ['models','sound','music-camp','music-explore','music-boss']){
  const file=path.join(assets,name+'.meta');if(!fs.existsSync(file))continue;
  const data=JSON.parse(fs.readFileSync(file)),id=`monster_den_${name.replaceAll('-','_')}`;
  data.userData={...data.userData,isBundle:true,bundleName:name,bundleConfigID:id};
  fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n');
  if(!builder.bundleConfig.custom[id])builder.bundleConfig.custom[id]={displayName:name,configs:{
    native:{preferredOptions:{compressionType:'merge_dep',isRemote:false}},
    web:{preferredOptions:{compressionType:'merge_dep',isRemote:false}},
    miniGame:{configMode:'overwrite',overwriteSettings:{wechatgame:{compressionType:'subpackage',isRemote:false}}},
  }};
}
fs.mkdirSync(path.dirname(builderPath),{recursive:true});fs.writeFileSync(builderPath,JSON.stringify(builder,null,2)+'\n');
const controller=path.join(assets,'scripts/GameMain.ts');fs.mkdirSync(path.dirname(controller),{recursive:true});
const controllerUuid=meta(controller,'typescript','4.0.24');
const sceneFile=path.join(assets,'Boot.scene'),sceneUuid=meta(sceneFile,'scene','1.1.38',['.json']);
if(!fs.existsSync(sceneFile)){
 const vec=(x,y,z)=>({__type__:'cc.Vec3',x,y,z});
 const data=[
  {__type__:'cc.SceneAsset',_name:'Boot',_objFlags:0,_native:'',scene:{__id__:1}},
  {__type__:'cc.Scene',_name:'Boot',_objFlags:0,_parent:null,_children:[{__id__:2}],_active:true,_components:[],_prefab:null,_globals:{__id__:4},autoReleaseAssets:false,_id:sceneUuid},
  {__type__:'cc.Node',_name:'GameRoot',_objFlags:0,_parent:{__id__:1},_children:[],_active:true,_components:[{__id__:3}],_prefab:null,_lpos:vec(0,0,0),_lrot:{__type__:'cc.Quat',x:0,y:0,z:0,w:1},_lscale:vec(1,1,1),_layer:1073741824,_euler:vec(0,0,0),_id:uuid('GameRoot')},
  {__type__:compressed(controllerUuid),_name:'',_objFlags:0,node:{__id__:2},_enabled:true,__prefab:null,_id:uuid('GameMainComponent')},
  {__type__:'cc.SceneGlobals'}
 ];fs.writeFileSync(sceneFile,JSON.stringify(data,null,2)+'\n');
}
console.log(JSON.stringify({controllerUuid,sceneUuid,controllerClassId:compressed(controllerUuid)}));

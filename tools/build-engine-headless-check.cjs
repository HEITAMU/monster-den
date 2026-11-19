#!/usr/bin/env node
/** Cocos lifecycle/asset validation with EmptyDevice. This does NOT verify pixels. */
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),engine=process.env.COCOS_ENGINE_SOURCE;
if(!engine)throw new Error('COCOS_ENGINE_SOURCE is required for this diagnostic.');
const {buildEngine}=require(path.join(engine,'node_modules/@cocos/ccbuild'));
const {JSDOM}=require(path.join(engine,'node_modules/jsdom'));
const napi=require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES||path.join(root,'node_modules'),'@napi-rs/canvas'));
const out=path.join(root,'.build/engine-headless');
(async()=>{
 const result={engineVersion:'3.8.8',backend:'Cocos EmptyDevice',pixelValidation:false,errors:[]};
 if(!fs.existsSync(path.join(out,'cc.js'))){const info=await buildEngine({engine,out,mode:'BUILD',platform:'HTML5',moduleFormat:'cjs',targets:{chrome:'80',ios:'14'},features:['base','3d','animation','skeletal-animation','2d','ui','graphics','mask','tween','audio','primitive','legacy-pipeline','gfx-empty'],compress:false,sourceMap:false,flags:{DEBUG:true,CULL_MESHOPT:true}});if(info.hasCriticalWarns)throw new Error('Headless engine compilation failed.');}
 const dom=new JSDOM('<!doctype html><html><body><div id="GameDiv"><div id="Cocos3dGameContainer"><canvas id="GameCanvas" width="720" height="1280"></canvas></div></div></body></html>',{url:'http://fixture.test/',pretendToBeVisual:true,runScripts:'outside-only'}),win=dom.window,canvases=new WeakMap();
 const context=el=>{let c=canvases.get(el);if(!c){c=napi.createCanvas(el.width||720,el.height||1280);canvases.set(el,c);}if(c.width!==el.width)c.width=el.width;if(c.height!==el.height)c.height=el.height;return c;};
 win.HTMLCanvasElement.prototype.getContext=function(type){return type==='2d'?context(this).getContext('2d'):null;};
 win.HTMLCanvasElement.prototype.toDataURL=function(...args){return context(this).toDataURL(...args);};
 win.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
 Object.defineProperty(win,'innerWidth',{value:720});Object.defineProperty(win,'innerHeight',{value:1280});
 win.fetch=async url=>({ok:true,json:async()=>win.JSON.parse(fs.readFileSync(path.join(root,'web',new URL(url,'http://fixture.test/').pathname),'utf8'))});
 const log=win.console.error.bind(win.console);win.console.error=(...args)=>{result.errors.push(args.map(String).join(' '));log(...args);};
 try{
  win.exports={};win.eval(fs.readFileSync(path.join(out,'cc.js'),'utf8'));const cc=win.exports;
  win.eval(fs.readFileSync(path.join(root,'web/engine-effects.js'),'utf8').replace('export async function','async function').replaceAll('import.meta.url','"http://fixture.test/engine-effects.js"')+'\nwindow.installPreviewEffects=installPreviewEffects;');
  cc.game.onPostSubsystemInitDelegate.add(()=>win.installPreviewEffects(cc));
  await cc.game.init({overrideSettings:{screen:{designResolution:{width:720,height:1280,policy:cc.ResolutionPolicy.FIXED_WIDTH}},rendering:{renderMode:3,customPipeline:false},splashScreen:{totalTime:0},profiling:{showFPS:false},assets:{preloadBundles:[],preloadAssets:[]}}});
  const sceneJson=win.JSON.parse(fs.readFileSync(path.join(root,'assets/Boot.scene'),'utf8'));const classId=sceneJson[3].__type__;
  class BootProbe extends cc.Component{onLoad(){result.onLoad=true;}}
  cc.js._setClassId(classId,BootProbe);
  const asset=cc.deserialize(sceneJson);cc.director.runSceneImmediate(asset.scene);
  const object=new cc.Node('MeshProbe');asset.scene.addChild(object);const renderer=object.addComponent(cc.MeshRenderer);renderer.mesh=cc.utils.createMesh(cc.primitives.sphere(1,{segments:12}));
  const material=new cc.Material();material.initialize({effectName:'monster-den/lit',defines:{USE_TEXTURE:true,USE_VERTEX_COLOR:true}});material.setProperty('mainColor',new cc.Color(180,140,90,255));renderer.setMaterial(material,0);
  result.version=cc.VERSION;result.scene=asset.scene.name;result.scriptId=classId;result.meshSubmeshes=renderer.mesh.renderingSubMeshes.length;result.materialPasses=material.passes.length;result.colorHandle=material.passes[0].getHandle('mainColor');result.textureHandle=material.passes[0].getHandle('mainTexture');result.available={MeshRenderer:typeof cc.MeshRenderer,Animation:typeof cc.Animation,SkeletalAnimation:typeof cc.SkeletalAnimation,Canvas:typeof cc.Canvas,Label:typeof cc.Label};
  if(!result.onLoad||result.meshSubmeshes!==1||result.materialPasses!==1||result.errors.length)throw new Error('Cocos runtime lifecycle validation failed.');
  result.passed=true;cc.game.pause();
 }catch(error){result.failure=error.stack||String(error);process.exitCode=1;}finally{dom.window.close();fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));}
})().catch(error=>{console.error(error);process.exitCode=1});

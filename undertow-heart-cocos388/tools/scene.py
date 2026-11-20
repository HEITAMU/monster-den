import json
from pathlib import Path
P=Path(__file__).resolve().parents[1]
S=P/'assets/Scenes';C=P/'assets/Scripts'
S.mkdir(parents=True,exist_ok=True)
script='8e5e0a69-5dd0-4382-b1bc-6170e785f1b5';sceneid='83209a32-74ec-4a76-8ccb-369c6d07aedc'
abc='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
def compress(v):
 h=v.replace('-','');out=h[:5]
 for i in range(5,32,3):
  a,b,c=map(lambda s:int(s,16),h[i:i+3]);out+=abc[4*a+(b>>2)]+abc[16*(b%4)+c]
 return out
meta=lambda uid,imp:{'ver':'4.0.24' if imp=='typescript' else '1.1.39','importer':imp,'imported':True,'uuid':uid,'files':[] if imp=='typescript' else ['.json'],'subMetas':{},'userData':{}}
(C/'Game.ts.meta').write_text(json.dumps(meta(script,'typescript'),indent=2))
scene=[
 {'__type__':'cc.SceneAsset','_name':'','_objFlags':0,'_native':'','scene':{'__id__':1}},
 {'__type__':'cc.Scene','_name':'Main','_objFlags':0,'_parent':None,'_children':[{'__id__':2}],
  '_active':True,'_components':[],'_prefab':None,'autoReleaseAssets':False,'_globals':{'__id__':4},'_id':sceneid},
 {'__type__':'cc.Node','_name':'Undertow Heart Startup','_objFlags':0,'_parent':{'__id__':1},'_children':[],
  '_active':True,'_components':[{'__id__':3}], '_prefab':None,
  '_lpos':{'__type__':'cc.Vec3','x':0,'y':0,'z':0},'_lrot':{'__type__':'cc.Quat','x':0,'y':0,'z':0,'w':1},
  '_lscale':{'__type__':'cc.Vec3','x':1,'y':1,'z':1},'_layer':1073741824,
  '_euler':{'__type__':'cc.Vec3','x':0,'y':0,'z':0},'_id':'a8PH6GUlBbZgVHaO7dDa82'},
 {'__type__':compress(script),'_name':'','_objFlags':0,'node':{'__id__':2},'_enabled':True,'__prefab':None,'_id':'c4wV4bIJpiCw7uL29eQ3a8'},
 {'__type__':'cc.SceneGlobals','ambient':{'__id__':5},'shadows':{'__id__':6},'_skybox':{'__id__':7},'fog':{'__id__':8},'octree':{'__id__':9}},
 {'__type__':'cc.AmbientInfo','_skyColorHDR':{'__type__':'cc.Vec4','x':.15,'y':.31,'z':.47,'w':.52},
  '_skyColor':{'__type__':'cc.Vec4','x':.15,'y':.31,'z':.47,'w':.52},'_skyIllumHDR':20000,'_skyIllum':20000,
  '_groundAlbedoHDR':{'__type__':'cc.Vec4','x':.15,'y':.25,'z':.31,'w':0},
  '_groundAlbedo':{'__type__':'cc.Vec4','x':.15,'y':.25,'z':.31,'w':0},
  '_skyColorLDR':{'__type__':'cc.Vec4','x':.29,'y':.42,'z':.53,'w':.52},'_skyIllumLDR':.52,
  '_groundAlbedoLDR':{'__type__':'cc.Vec4','x':.24,'y':.33,'z':.38,'w':0}},
 {'__type__':'cc.ShadowsInfo','_enabled':False,'_type':0,'_normal':{'__type__':'cc.Vec3','x':0,'y':1,'z':0},
  '_distance':0,'_shadowColor':{'__type__':'cc.Color','r':42,'g':59,'b':74,'a':255},
  '_maxReceived':4,'_size':{'__type__':'cc.Vec2','x':1024,'y':1024}},
 {'__type__':'cc.SkyboxInfo','_envLightingType':0,'_envmapHDR':None,'_envmap':None,'_envmapLDR':None,
  '_diffuseMapHDR':None,'_diffuseMapLDR':None,'_enabled':False,'_useHDR':False,
  '_editableMaterial':None,'_reflectionHDR':None,'_reflectionLDR':None,'_rotationAngle':0},
 {'__type__':'cc.FogInfo','_type':0,'_fogColor':{'__type__':'cc.Color','r':8,'g':33,'b':46,'a':255},
  '_enabled':False,'_fogDensity':.2,'_fogStart':.5,'_fogEnd':250,'_fogAtten':5,'_fogTop':1.5,'_fogRange':1.2,'_accurate':False},
 {'__type__':'cc.OctreeInfo','_enabled':False,
  '_minPos':{'__type__':'cc.Vec3','x':-1024,'y':-1024,'z':-1024},
  '_maxPos':{'__type__':'cc.Vec3','x':1024,'y':1024,'z':1024},'_depth':8}
]
(S/'Main.scene').write_text(json.dumps(scene,indent=2,ensure_ascii=False)+'\n')
(S/'Main.scene.meta').write_text(json.dumps(meta(sceneid,'scene'),indent=2)+'\n')
print('Scene ready, component class id',compress(script))

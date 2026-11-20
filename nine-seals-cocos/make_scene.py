"""Generate stable Cocos Creator 3.8 scene + metadata, not a runtime mock."""
from pathlib import Path
import json,uuid
P=Path(__file__).resolve().parent
script_uuid='49a66c33-beb0-4bcc-8707-91c2f311abcd'
scene_uuid='bf732340-7d9b-41e8-81aa-5e184e196eaa'
BASE64='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
def compressed(hex_uuid):
 s=hex_uuid.replace('-','');out=s[:5]
 for i in range(5,len(s),3):
  a,b,c=[int(x,16) for x in s[i:i+3]]
  out+=BASE64[(a<<2)|(b>>2)]+BASE64[((b&3)<<4)|c]
 return out
assert len(compressed(script_uuid))==23
V2=lambda x,y:{'__type__':'cc.Vec2','x':x,'y':y}
V3=lambda x,y,z:{'__type__':'cc.Vec3','x':x,'y':y,'z':z}
Q={'__type__':'cc.Quat','x':0,'y':0,'z':0,'w':1}
C=lambda r,g,b,a=255:{'__type__':'cc.Color','r':r,'g':g,'b':b,'a':a}
id=lambda i:{'__id__':i}

def node(name,parent,children,components,layer):
 return {'__type__':'cc.Node','_name':name,'_objFlags':0,'__editorExtras__':{},'_parent':id(parent) if parent is not None else None,
 '_children':list(map(id,children)),'_active':True,'_components':list(map(id,components)), '_prefab':None,
 '_lpos':V3(0,0,1000 if name=='UICamera' else 0),'_lrot':Q,'_lscale':V3(1,1,1),
 '_mobility':0,'_layer':layer,'_euler':V3(0,0,0),'_id':uuid.uuid5(uuid.NAMESPACE_DNS,'crown-vault-'+name).hex[:22]}
scene=[
 {'__type__':'cc.SceneAsset','_name':'Main','_objFlags':0,'__editorExtras__':{},'_native':'','scene':id(1)},
 {'__type__':'cc.Scene','_name':'Main','_objFlags':0,'__editorExtras__':{},'_parent':None,
 '_children':[id(2)],'_active':True,'_components':[],'_prefab':id(7),'_lpos':V3(0,0,0),
 '_lrot':Q,'_lscale':V3(1,1,1),'_mobility':0,'_layer':1073741824,'_euler':V3(0,0,0),
 'autoReleaseAssets':False,'_globals':id(8),'_id':scene_uuid},
 node('Canvas',1,[3],[5,6,4],33554432),
 node('UICamera',2,[],[9],33554432),
 {'__type__':compressed(script_uuid),'_name':'CrownGame','_objFlags':0,'__editorExtras__':{},'node':id(2),'_enabled':True,'__prefab':None,'_id':'CrownGame0000000001'},
 {'__type__':'cc.UITransform','_name':'Canvas<UITransform>','_objFlags':0,'__editorExtras__':{},'node':id(2),
  '_enabled':True,'__prefab':None,'_contentSize':{'__type__':'cc.Size','width':720,'height':1280},
  '_anchorPoint':V2(.5,.5),'_id':'CanvasTransform000001'},
 {'__type__':'cc.Canvas','_name':'Canvas<Canvas>','_objFlags':0,'__editorExtras__':{},'node':id(2),
  '_enabled':True,'__prefab':None,'_cameraComponent':id(9),'_alignCanvasWithScreen':True,'_id':'CanvasComponent00001'},
 {'__type__':'cc.PrefabInfo','root':None,'asset':None,'fileId':scene_uuid,'instance':None,'targetOverrides':None},
 {'__type__':'cc.SceneGlobals','ambient':id(10),'shadows':id(11),'_skybox':id(12),
  'fog':id(13),'octree':id(14),'skin':id(15),'lightProbeInfo':id(16),'postSettings':id(17),
  'bakedWithStationaryMainLight':False,'bakedWithHighpLightmap':False},
 {'__type__':'cc.Camera','_name':'','_objFlags':0,'__editorExtras__':{},'node':id(3),'_enabled':True,
  '__prefab':None,'_projection':0,'_priority':1073741824,'_fov':45,'_fovAxis':0,'_orthoHeight':640,
  '_near':1,'_far':2000,'_color':C(0,0,0,0),'_depth':1,'_stencil':0,'_clearFlags':7,
  '_rect':{'__type__':'cc.Rect','x':0,'y':0,'width':1,'height':1},'_aperture':19,'_shutter':7,'_iso':0,
  '_screenScale':1,'_visibility':33554432,'_targetTexture':None,'_postProcess':None,
  '_usePostProcess':False,'_cameraType':-1,'_trackingType':0,'_id':'CrownCam000000000001'},
 {'__type__':'cc.AmbientInfo','_skyColorHDR':{'__type__':'cc.Vec4','x':.2,'y':.5,'z':.8,'w':.5},
  '_skyColor':{'__type__':'cc.Vec4','x':.2,'y':.5,'z':.8,'w':.5},'_skyIllumHDR':20000,'_skyIllum':20000,
  '_groundAlbedoHDR':{'__type__':'cc.Vec4','x':.28,'y':.28,'z':.28,'w':1},
  '_groundAlbedo':{'__type__':'cc.Vec4','x':.28,'y':.28,'z':.28,'w':1},
  '_skyColorLDR':{'__type__':'cc.Vec4','x':.2,'y':.5,'z':.8,'w':.78},'_skyIllumLDR':.78,
  '_groundAlbedoLDR':{'__type__':'cc.Vec4','x':.28,'y':.28,'z':.28,'w':1}},
 {'__type__':'cc.ShadowsInfo','_enabled':False,'_type':0,'_normal':V3(0,1,0),'_distance':0,
  '_planeBias':1,'_shadowColor':C(0,0,0,128),'_maxReceived':4,'_size':V2(512,512)},
 {'__type__':'cc.SkyboxInfo','_envLightingType':0,'_envmapHDR':None,'_envmap':None,'_envmapLDR':None,
  '_diffuseMapHDR':None,'_diffuseMapLDR':None,'_enabled':False,'_useHDR':False,
  '_editableMaterial':None,'_reflectionHDR':None,'_reflectionLDR':None,'_rotationAngle':0},
 {'__type__':'cc.FogInfo','_type':0,'_fogColor':C(200,200,200),'_enabled':False,'_fogDensity':.3,
  '_fogStart':.5,'_fogEnd':300,'_fogAtten':5,'_fogTop':1.5,'_fogRange':1.2,'_accurate':False},
 {'__type__':'cc.OctreeInfo','_enabled':False,'_minPos':V3(-1024,-1024,-1024),'_maxPos':V3(1024,1024,1024),'_depth':8},
 {'__type__':'cc.SkinInfo','_enabled':True,'_blurRadius':.01,'_sssIntensity':3},
 {'__type__':'cc.LightProbeInfo','_giScale':1,'_giSamples':1024,'_bounces':2,'_reduceRinging':0,'_showProbe':True,
  '_showWireframe':True,'_showConvex':True,'_data':None,'_lightProbeSphereVolume':1},
 {'__type__':'cc.PostSettingsInfo','_toneMappingType':0}
]
(P/'assets/scenes/Main.scene').write_text(json.dumps(scene,ensure_ascii=False,indent=2))
(P/'assets/scenes/Main.scene.meta').write_text(json.dumps({
  'ver':'1.1.50','importer':'scene','imported':True,'uuid':scene_uuid,'files':['.json'],
  'subMetas':{},'userData':{'synced':{}}},indent=2))
(P/'assets/scripts/GameController.ts.meta').write_text(json.dumps({
  'ver':'4.0.24','importer':'typescript','imported':True,'uuid':script_uuid,
  'files':[],'subMetas':{},'userData':{}},indent=2))
for f in (P/'assets/scripts').rglob('*.ts'):
 if f.name=='GameController.ts':continue
 meta=f.with_name(f.name+'.meta')
 meta.write_text(json.dumps({'ver':'4.0.24','importer':'typescript','imported':True,
 'uuid':str(uuid.uuid5(uuid.NAMESPACE_DNS,'crown-vault/'+str(f.relative_to(P)))),
 'files':[],'subMetas':{},'userData':{}},indent=2))
for folder in ['assets','assets/scripts','assets/scripts/core','assets/scripts/platform','assets/scenes']:
 f=P/folder; fm=P/(folder+'.meta');fm.write_text(json.dumps({'ver':'1.2.0','importer':'directory','imported':True,
 'uuid':str(uuid.uuid5(uuid.NAMESPACE_DNS,'crown-vault/'+folder)), 'files':[], 'subMetas':{},'userData':{}},indent=2))
print('CrownGame compressed script uuid',compressed(script_uuid),'scene objs',len(scene))

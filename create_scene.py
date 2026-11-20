from pathlib import Path
import json,uuid
P=Path(__file__).resolve().parent
scene_uuid='6b3fa0ae-2bea-4af6-a4c8-0184a93a103e';script_uuid='aa12c456-82b6-4bd9-9c10-041432a41413'
BASE64='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
def compress(s):
    hexstr=s.replace('-',''); result=hexstr[:5]
    for i in range(5,len(hexstr),3):
        a,b,c=map(lambda x:int(x,16),hexstr[i:i+3]);result+=BASE64[(a<<2)|(b>>2)]+BASE64[((b&3)<<4)|c]
    return result
ref=lambda i:{'__id__':i}
v3=lambda x,y,z:{'__type__':'cc.Vec3','x':x,'y':y,'z':z}
quat={'__type__':'cc.Quat','x':0,'y':0,'z':0,'w':1}
color=lambda r,g,b,a=255:{'__type__':'cc.Color','r':r,'g':g,'b':b,'a':a}
def n(name,parent,children,components,layer=33554432):
    return {'__type__':'cc.Node','_name':name,'_objFlags':0,'__editorExtras__':{},'_parent':ref(parent) if parent else None,
            '_children':[ref(x) for x in children],'_active':True,'_components':[ref(x) for x in components],
            '_prefab':None,'_lpos':v3(0,0,1000 if name=='UICamera' else 0),'_lrot':quat,
            '_lscale':v3(1,1,1),'_mobility':0,'_layer':layer,'_euler':v3(0,0,0),
            '_id':uuid.uuid5(uuid.NAMESPACE_DNS,'nine-seals-node-'+name).hex[:22]}
vec4=lambda a,b,c,d:{'__type__':'cc.Vec4','x':a,'y':b,'z':c,'w':d}
scene=[
 {'__type__':'cc.SceneAsset','_name':'Main','_objFlags':0,'__editorExtras__':{},'_native':'','scene':ref(1)},
 {'__type__':'cc.Scene','_name':'Main','_objFlags':0,'__editorExtras__':{},'_parent':None,'_children':[ref(2)],
 '_active':True,'_components':[],'_prefab':ref(7),'_lpos':v3(0,0,0),'_lrot':quat,'_lscale':v3(1,1,1),
 '_mobility':0,'_layer':1073741824,'_euler':v3(0,0,0),'autoReleaseAssets':False,'_globals':ref(8),'_id':scene_uuid},
 n('Canvas',1,[3],[5,6,4]),n('UICamera',2,[],[9]),
 {'__type__':compress(script_uuid),'_name':'CrownGame','_objFlags':0,'__editorExtras__':{},'node':ref(2),'_enabled':True,'__prefab':None,'_id':'CrownGamef1d9e87e91'},
 {'__type__':'cc.UITransform','_name':'Canvas<UITransform>','_objFlags':0,'__editorExtras__':{},'node':ref(2),'_enabled':True,'__prefab':None,
 '_contentSize':{'__type__':'cc.Size','width':720,'height':1280},'_anchorPoint':{'__type__':'cc.Vec2','x':.5,'y':.5},'_id':'CanvasTransformX8491'},
 {'__type__':'cc.Canvas','_name':'Canvas<Canvas>','_objFlags':0,'__editorExtras__':{},'node':ref(2),'_enabled':True,
 '__prefab':None,'_cameraComponent':ref(9),'_alignCanvasWithScreen':True,'_id':'CanvasMain289d9a1b2'},
 {'__type__':'cc.PrefabInfo','root':None,'asset':None,'fileId':scene_uuid,'instance':None,'targetOverrides':None},
 {'__type__':'cc.SceneGlobals','ambient':ref(10),'shadows':ref(11),'_skybox':ref(12),'fog':ref(13),'octree':ref(14),'skin':ref(15),
 'lightProbeInfo':ref(16),'postSettings':ref(17),'bakedWithStationaryMainLightmap':False,'bakedWithHighpLightmap':False},
 {'__type__':'cc.Camera','_name':'','_objFlags':0,'__editorExtras__':{},'node':ref(3),'_enabled':True,'__prefab':None,
 '_projection':0,'_priority':1073741824,'_fov':45,'_fovAxis':0,'_orthoHeight':640,'_near':1,'_far':2000,'_color':color(0,0,0,0),
 '_depth':1,'_stencil':0,'_clearFlags':7,'_rect':{'__type__':'cc.Rect','x':0,'y':0,'width':1,'height':1},
 '_aperture':19,'_shutter':7,'_iso':0,'_screenScale':1,'_visibility':33554432,'_targetTexture':None,'_postProcess':None,
 '_usePostProcess':False,'_cameraType':-1,'_trackingType':0,'_id':'MainCamera3cbbd7aa'},
 {'__type__':'cc.AmbientInfo','_skyColorHDR':vec4(.2,.5,.8,.5),'_skyColor':vec4(.2,.5,.8,.5),'_skyIllumHDR':20000,'_skyIllum':20000,
 '_groundAlbedoHDR':vec4(.28,.28,.28,1),'_groundAlbedo':vec4(.28,.28,.28,1),'_skyColorLDR':vec4(.2,.5,.8,.78),
 '_skyIllumLDR':.78,'_groundAlbedoLDR':vec4(.28,.28,.28,1)},
 {'__type__':'cc.ShadowsInfo','_enabled':False,'_type':0,'_normal':v3(0,1,0),'_distance':0,'_planeBias':1,
 '_shadowColor':color(0,0,0,128),'_maxReceived':4,'_size':{'__type__':'cc.Vec2','x':512,'y':512}},
 {'__type__':'cc.SkyboxInfo','_envLightingType':0,'_envmapHDR':None,'_envmap':None,'_envmapLDR':None,'_diffuseMapHDR':None,
 '_diffuseMapLDR':None,'_enabled':False,'_useHDR':False,'_editableMaterial':None,'_reflectionHDR':None,'_reflectionLDR':None,'_rotationAngle':0},
 {'__type__':'cc.FogInfo','_type':0,'_fogColor':color(200,200,200),'_enabled':False,'_fogDensity':.3,'_fogStart':.5,'_fogEnd':300,
 '_fogAtten':5,'_fogTop':1.5,'_fogRange':1.2,'_accurate':False},
 {'__type__':'cc.OctreeInfo','_enabled':False,'_minPos':v3(-1024,-1024,-1024),'_maxPos':v3(1024,1024,1024),'_depth':8},
 {'__type__':'cc.SkinInfo','_enabled':True,'_blurRadius':.01,'_sssIntensity':3},
 {'__type__':'cc.LightProbeInfo','_giScale':1,'_giSamples':1024,'_bounces':2,'_reduceRinging':0,'_showProbe':True,
 '_showWireframe':True,'_showConvex':True,'_data':None,'_lightProbeSphereVolume':1},
 {'__type__':'cc.PostSettingsInfo','_toneMappingType':0},
]
(P/'assets/scenes/Main.scene').write_text(json.dumps(scene,ensure_ascii=False,indent=2))
(P/'assets/scenes/Main.scene.meta').write_text(json.dumps({'ver':'1.1.50','importer':'scene','imported':True,'uuid':scene_uuid,'files':['.json'],'subMetas':{},'userData':{'synced':{}}},indent=2))
for source in (P/'assets/scripts').rglob('*.ts'):
    uid=script_uuid if source.name=='CrownGame.ts' else str(uuid.uuid5(uuid.NAMESPACE_DNS,'nine-seals-'+source.as_posix().split('crown-vault/')[-1]))
    Path(str(source)+'.meta').write_text(json.dumps({'ver':'4.0.24','importer':'typescript','imported':True,'uuid':uid,'files':[],'subMetas':{},'userData':{}},indent=2))
for rel in ['assets','assets/scripts','assets/scripts/core','assets/scripts/platform','assets/scenes','assets/resources','assets/resources/audio']:
    Path(str(P/rel)+'.meta').write_text(json.dumps({'ver':'1.2.0','importer':'directory','imported':True,'uuid':str(uuid.uuid5(uuid.NAMESPACE_DNS,'nine-seals-'+rel)),'files':[],'subMetas':{},'userData':{}},indent=2))
print('scene',len(scene),'script identifier',compress(script_uuid))

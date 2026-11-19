"""Blender -> compact, engine-neutral articulated mesh library.

Call export_library({'hero': hero_root, ...}, '/absolute/path.json').
Blender is Z-up, -Y forward. Export is Cocos Y-up, +Z forward.
Empties marked obj['md_joint']=True preserve animation pivots; all mesh
details below each pivot merge into one vertex-coloured draw mesh.
"""
import bpy
import json
import math
from pathlib import Path
from mathutils import Matrix, Vector

C = Matrix(((1,0,0,0),(0,0,1,0),(0,-1,0,0),(0,0,0,1)))

def _rgb(obj, mat_index):
    if mat_index < len(obj.data.materials) and obj.data.materials[mat_index]:
        return list(obj.data.materials[mat_index].diffuse_color)
    return [0.7,0.6,0.45,1.0]

def _descendants(root):
    return [root] + list(root.children_recursive)

def export_library(prefabs, out):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    result = {'version':1,'coordinateSystem':'Y_UP','prefabs':{}}
    for key, root in prefabs.items():
        objects = _descendants(root)
        joints = [root] + [o for o in objects if o != root and o.type == 'EMPTY' and o.get('md_joint',False)]
        index = {o.name:i for i,o in enumerate(joints)}
        nodes=[]
        for j in joints:
            p=j.parent
            while p and p.name not in index: p=p.parent
            if j == root: p=None
            local = p.matrix_world.inverted() @ j.matrix_world if p else root.matrix_world.inverted() @ j.matrix_world
            loc,rot,scale=(C @ local @ C.inverted()).decompose()
            nodes.append({'name':j.name,'parent':index[p.name] if p else -1,
                'position':[round(v,5) for v in loc],
                'rotation':[round(rot.x,6),round(rot.y,6),round(rot.z,6),round(rot.w,6)],
                'scale':[round(v,5) for v in scale],
                'mesh':{'positions':[],'normals':[],'colors':[],'uvs':[],'indices':[]}})
        dedups=[{} for _ in nodes]
        bounds_min=[1e9]*3;bounds_max=[-1e9]*3
        for obj in objects:
            if obj.type != 'MESH' or obj.hide_render: continue
            parent=obj.parent
            while parent and parent.name not in index: parent=parent.parent
            owner=parent if parent else root
            ni=index[owner.name];data=nodes[ni]['mesh'];dedup=dedups[ni]
            ev=obj.evaluated_get(depsgraph);mesh=ev.to_mesh();mesh.calc_loop_triangles()
            mat=C @ owner.matrix_world.inverted() @ obj.matrix_world
            normalmat=mat.to_3x3().inverted().transposed()
            boundmat=C @ root.matrix_world.inverted() @ obj.matrix_world
            for tri in mesh.loop_triangles:
                base=_rgb(obj,tri.material_index)
                for vid,li in zip(tri.vertices,tri.loops):
                    v=mesh.vertices[vid];pos=mat @ v.co
                    try: nor=mesh.corner_normals[li].vector
                    except (AttributeError,IndexError): nor=v.normal
                    nor=(normalmat @ nor).normalized()
                    # Fine, stable tonal variation; never changes silhouettes.
                    grain=0.965+0.035*math.sin(v.co.x*19.1+v.co.y*27.7+v.co.z*13.3)
                    color=[min(1,max(0,c*grain)) for c in base[:3]]+[base[3]]
                    pp=tuple(round(x,5) for x in pos);nn=tuple(round(x,4) for x in nor);cc=tuple(round(x,4) for x in color)
                    token=pp+nn+cc
                    if token not in dedup:
                        dedup[token]=len(data['positions'])//3
                        data['positions'].extend(pp);data['normals'].extend(nn);data['colors'].extend(cc);data['uvs'].extend([0,0])
                    data['indices'].append(dedup[token])
                    bp=boundmat @ v.co
                    for a in range(3): bounds_min[a]=min(bounds_min[a],bp[a]);bounds_max[a]=max(bounds_max[a],bp[a])
            ev.to_mesh_clear()
        for node in nodes:
            if not node['mesh']['indices']: del node['mesh']
        result['prefabs'][key]={'nodes':nodes,'bounds':{'min':[round(v,5) for v in bounds_min],'max':[round(v,5) for v in bounds_max]}}
    Path(out).parent.mkdir(parents=True,exist_ok=True)
    Path(out).write_text(json.dumps(result,separators=(',',':')),encoding='utf-8')
    print('Exported',out,Path(out).stat().st_size,'bytes', {k:sum(len(n.get('mesh',{}).get('indices',[]))//3 for n in p['nodes']) for k,p in result['prefabs'].items()})
    return result

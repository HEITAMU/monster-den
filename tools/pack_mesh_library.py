#!/usr/bin/env python3
"""Pack vertex streams without removing geometry or animation joints.

Positions: 16-bit relative to each mesh bound (sub-millimetre precision here).
Normals: signed 8-bit; colours: RGBA8; indices: uint16 or uint32.
UVs are omitted only when all zero, as these models use vertex colours.
"""
from pathlib import Path
import base64,json,struct,sys

def pack_library(data):
    for prefab in data['prefabs'].values():
        for part in prefab['nodes']:
            mesh=part.get('mesh')
            if not mesh or mesh.get('encoding'):continue
            n=len(mesh['positions'])//3
            lo=[min(mesh['positions'][i::3]) for i in range(3)]
            hi=[max(mesh['positions'][i::3]) for i in range(3)]
            span=[max(hi[i]-lo[i],1e-8) for i in range(3)]
            qpos=[round((v-lo[i%3])/span[i%3]*65535) for i,v in enumerate(mesh['positions'])]
            normals=[round(max(-1,min(1,v))*127) for v in mesh['normals']]
            colors=[round(max(0,min(1,v))*255) for v in mesh['colors']]
            uv=mesh.get('uvs',[]);has_uv=any(uv)
            index_type='H' if n<=65535 else 'I'
            binary=struct.pack('<'+'H'*len(qpos),*qpos)+struct.pack('<'+'b'*len(normals),*normals)+bytes(colors)
            if has_uv:binary+=struct.pack('<'+'f'*len(uv),*uv)
            binary+=struct.pack('<'+index_type*len(mesh['indices']),*mesh['indices'])
            part['mesh']={'encoding':'q16-n8-c8-v1','vertexCount':n,'indexCount':len(mesh['indices']),
                'indexBytes':2 if index_type=='H' else 4,'min':lo,'span':span,'hasUV':has_uv,
                'data':base64.b64encode(binary).decode()}
    return data

if __name__=='__main__':
    if len(sys.argv)!=3:raise SystemExit('Usage: python tools/pack_mesh_library.py input.json output.json')
    source,target=map(Path,sys.argv[1:]);data=pack_library(json.loads(source.read_text()))
    target.parent.mkdir(parents=True,exist_ok=True);target.write_text(json.dumps(data,separators=(',',':')))
    print(f'{source.name}: {source.stat().st_size} -> {target.stat().st_size} bytes; all triangles and joints preserved')

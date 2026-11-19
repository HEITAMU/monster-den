import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {decodeMesh} from '../assets/scripts/MeshCodec.ts';

function fixture() {
  const bytes=Buffer.alloc(3*13+3*2);let at=0;
  for(const value of [0,0,0,65535,0,0,0,65535,0]){bytes.writeUInt16LE(value,at);at+=2;}
  for(let i=0;i<3;i++)for(const n of [0,0,127])bytes.writeInt8(n,at++);
  for(let i=0;i<3;i++)for(const n of [255,128,64,255])bytes.writeUInt8(n,at++);
  for(const value of [0,1,2]){bytes.writeUInt16LE(value,at);at+=2;}
  return {encoding:'q16-n8-c8-v1',vertexCount:3,indexCount:3,indexBytes:2,min:[-1,-2,0],span:[2,4,1],hasUV:false,data:bytes.toString('base64')};
}

test('packed vertices retain coordinates, colour, topology and normals',()=>{
  const m=decodeMesh(fixture());
  assert.deepEqual(m.positions,[-1,-2,0,1,-2,0,-1,2,0]);
  assert.deepEqual(m.normals,[0,0,1,0,0,1,0,0,1]);assert.deepEqual(m.indices,[0,1,2]);
  assert.deepEqual(m.uvs,[0,0,0,0,0,0]);assert.equal(m.colors[1],128/255);assert.equal(m.colors[3],1);
});
test('malformed lengths and indices are rejected before GPU allocation',()=>{
  const data=fixture();assert.throws(()=>decodeMesh({...data,data:data.data.slice(4)}));
  const bytes=Buffer.from(data.data,'base64');bytes.writeUInt16LE(9,bytes.length-2);
  assert.throws(()=>decodeMesh({...data,data:bytes.toString('base64')}),/index out of range/);
});
test('all shipped articulated models have finite buffers and valid topology',()=>{
  let triangles=0,prefabs=0;
  for(const name of ['characters','environment']){
    const library=JSON.parse(fs.readFileSync(new URL(`../assets/models/${name}.json`,import.meta.url)));
    for(const prefab of Object.values(library.prefabs)){
      prefabs++;
      for(const node of prefab.nodes){
        if(!node.mesh)continue;const m=decodeMesh(node.mesh),n=m.positions.length/3;
        assert.equal(m.normals.length,n*3);assert.equal(m.colors.length,n*4);assert.equal(m.uvs.length,n*2);
        assert.ok([...m.positions,...m.normals,...m.colors,...m.uvs].every(Number.isFinite));
        assert.ok(m.indices.every(i=>Number.isInteger(i)&&i>=0&&i<n));triangles+=m.indices.length/3;
      }
    }
  }
  assert.equal(prefabs,15);assert.equal(triangles,58256);
});

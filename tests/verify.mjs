import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {readFileSync,statSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..'),tmp=mkdtempSync(join(tmpdir(),'crown-test-'));
try{
 const build=spawnSync('tsc',['--target','ES2020','--module','commonjs','--outDir',tmp,
  'assets/scripts/core/Puzzle.ts','assets/scripts/core/Catalog.ts'],{cwd:root,encoding:'utf8'});
 assert.equal(build.status,0,build.stdout+'\n'+build.stderr);
 const require=createRequire(import.meta.url),engine=require(join(tmp,'Puzzle.js'));
 const catalog=JSON.parse(readFileSync(join(root,'tests/catalog.json'),'utf8'));
 assert.equal(Object.values(catalog).reduce((a,arr)=>a+arr.length,0),384);
 const seen=new Map([['123456789',0]]),buckets=new Map(),queue=['123456789'];let head=0;
 for(;head<queue.length;head++){
  const s=queue[head],d=seen.get(s);
  if(!buckets.has(d))buckets.set(d,0);buckets.set(d,buckets.get(d)+1);
  for(let m=0;m<8;m++){
   const t=engine.encode(engine.applyMove(engine.decode(s),m));
   if(!seen.has(t)){seen.set(t,d+1);queue.push(t);}
  }
 }
 assert.equal(seen.size,362880);assert.equal(Math.max(...buckets.keys()),11);
 for(const [depth,items] of Object.entries(catalog))for(const item of items){assert.equal(seen.get(item),Number(depth));}
 for(const [num,s] of catalog['5'].slice(0,5).entries()){
  const sol=engine.shortestSolution(engine.decode(s));assert.equal(sol.length,5,'non-optimal hint '+num);
  let state=engine.decode(s);for(const m of sol)state=engine.applyMove(state,m);
  assert.equal(engine.solved(state),true);
 }
 for(let stage=0;stage<3;stage++){
  const a=engine.levelFor('daily','20261121',stage),b=engine.levelFor('daily','20261121',stage);
  assert.deepEqual(a,b);assert.equal(seen.get(engine.encode(a.board)),[5,7,9][stage]);
 }
 assert.equal(engine.todayKey(Date.UTC(2026,10,20,16,0,0)),'20261121');
 for(let m=0;m<8;m++){
  const sample=engine.applyMove(engine.GOAL,m);assert.deepEqual(engine.applyMove(sample,m^1),engine.GOAL);
 }
 const scene=JSON.parse(readFileSync(join(root,'assets/scenes/Main.scene'),'utf8'));
 for(const rec of scene)for(const val of [rec._parent,rec._prefab,rec.scene,rec._globals,...(rec._children||[]),...(rec._components||[])]){
  if(val && typeof val==='object' && '__id__' in val)assert.ok(scene[val.__id__], 'broken scene ref '+val.__id__);
 }
 const scriptMeta=JSON.parse(readFileSync(join(root,'assets/scripts/CrownGame.ts.meta'),'utf8'));
 assert.ok(scriptMeta.uuid);assert.ok(scene.some(o=>o._name==='CrownGame'));
 for(const name of ['rotor','perfect','complete','ambient'])assert.ok(statSync(join(root,'assets/resources/audio',name+'.mp3')).size>2500);
 for(const file of ['preview/game.js','preview/catalog.js','build-templates/wechatgame/openDataContext/index.js']){
  const x=spawnSync('node',['--check',join(root,file)],{encoding:'utf8'});assert.equal(x.status,0,file+': '+x.stderr);
 }
 console.log('PASS: 362,880 states exhaustively reached');
 console.log('PASS: 384 puzzles verified by true shortest path distance');
 console.log('PASS: daily deterministic, hints shortest, inverse moves, date boundary');
 console.log('PASS: scene references, audio resources, preview and WeChat subdomain JS');
}finally{rmSync(tmp,{force:true,recursive:true});}

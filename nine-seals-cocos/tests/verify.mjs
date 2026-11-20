import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const cwd=process.cwd();
execFileSync('tsc',['-p','tests/tsconfig.core.json'],{cwd,stdio:'inherit'});
execFileSync('tsc',['-p','tests/tsconfig.cocos.json'],{cwd,stdio:'inherit'});
const {BANK}=require('../tests/.compiled/Catalog.js');
const p=require('../tests/.compiled/Puzzle.js');
const assert=require('node:assert/strict');
assert.equal(Object.keys(BANK).length,8);
for(let dep=3;dep<=10;dep++){
  assert.equal(BANK[dep].length,36);
  for(const encoded of BANK[dep]){
    const board=p.decode(encoded);
    assert(!p.solved(board),'cannot include solved boards');
    assert.equal(new Set(board).size,9);
  }
}
// Check exact shortest solutions against the known catalog depth for all 288 levels.
let tested=0;
for(const [depth,arr] of Object.entries(BANK))for(const encoded of arr){
  let current=p.decode(encoded),solution=p.shortestSolution(current);
  assert.equal(solution.length,+depth,`invalid optimal solution ${encoded}, expected ${depth}`);
  for(const m of solution)current=p.applyMove(current,m);
  assert(p.solved(current),'solution not effective');
  tested++;
}
for(let m=0;m<8;m++){
  const rot=p.applyMove(p.GOAL,m);
  assert.deepEqual(p.applyMove(rot,p.invertMove(m)),p.GOAL);
}
for(let n=1;n<150;n++){
  const x=p.campaignLevel(n),y=p.campaignLevel(n);
  assert.deepEqual(x,y);
  assert.equal(p.shortestSolution(x.board).length,x.optimum);
}
for(const d of ['20261120','20261121','20270101'])for(let i=0;i<3;i++){
  const x=p.dailyLevel(d,i),y=p.dailyLevel(d,i);
  assert.deepEqual(x,y);
  assert.equal(p.shortestSolution(x.board).length,x.optimum);
}
assert.equal(p.dateKey(Date.UTC(2026,10,19,16,1)), '20261120');
const scene=JSON.parse(readFileSync('assets/scenes/Main.scene','utf8'));
assert.equal(scene[0].__type__,'cc.SceneAsset');
assert.equal(scene[4].__type__,'49a66wzvrBLzIcHkcLzEavN');
assert.equal(scene[6].__type__,'cc.Canvas');
console.log(`PASS: Cocos TS check, ${tested} exact BFS puzzle solutions, 149 campaign chapters, daily seeds, scene references`);

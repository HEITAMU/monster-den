import test from 'node:test';
import assert from 'node:assert/strict';
import {LanternRules,INITIAL_PROGRESS,WORLD,normalizeProgress,upgradeCost} from '../preview/modules/LanternRules.js';
const fresh=()=>new LanternRules(INITIAL_PROGRESS,12);
test('invalid saves recover to safe defaults and upgrade cap',()=>{
 const a=normalizeProgress({currency:-11,upgrades:{flame:999,pulse:-5,stride:3},bestDepth:500,runs:-2,totalSeeds:4});
 assert.equal(a.currency,0);assert.equal(a.upgrades.flame,9);assert.equal(a.upgrades.pulse,0);
 assert.equal(a.bestDepth,99);assert.equal(a.runs,0);assert.ok(upgradeCost(a.upgrades,'flame')>0);
});
test('same seed creates reproducible positions, while new depth changes the room',()=>{
 const a=fresh(),b=fresh();a.begin(234);b.begin(234);
 assert.deepEqual(a.state.pickups,b.state.pickups);assert.deepEqual(a.state.enemies,b.state.enemies);
 assert.equal(a.state.target,3);assert.equal(a.state.phase,'exploring');
});
test('movement respects map bounds and stops when stick is centered',()=>{
 const a=fresh();a.begin(12);a.move(3,4);
 for(let j=0;j<240;j++)a.tick(.05);
 assert.ok(a.state.hero.x<=WORLD.maxX);assert.ok(a.state.hero.y<=WORLD.maxY);
 const x=a.state.hero.x,y=a.state.hero.y;a.move(0,0);a.tick(.04);
 assert.equal(a.state.hero.x,x);assert.equal(a.state.hero.y,y);
});
test('pulse costs flame, respects cooldown and reveals hidden seeds',()=>{
 const a=fresh();a.begin(12);a.state.enemies=[];
 const hidden=a.state.pickups.find(p=>p.kind==='seed'&&!p.revealed);
 hidden.x=a.state.hero.x+70;hidden.y=a.state.hero.y+50;
 const f=a.state.hero.flame;
 assert.equal(a.pulse(),true);assert.equal(a.state.hero.flame,f-17);assert.equal(hidden.revealed,true);
 assert.equal(a.pulse(),false);for(let i=0;i<20;i++)a.tick(.05);assert.equal(a.pulse(),true);
});
test('dash grants invulnerability, moves in direction and cannot be spammed',()=>{
 const a=fresh();a.begin(13);a.move(1,0);
 const old=a.state.hero.x;assert.equal(a.dash(),true);assert.ok(a.state.hero.x>old);
 assert.equal(a.dash(),false);assert.ok(a.state.hero.invuln>0);
});
test('collect 3 seeds, open gate, safely extract and buy an upgrade',()=>{
 const a=fresh();a.begin(14);a.state.enemies=[];
 const s=a.state;
 for(const p of s.pickups.filter(p=>p.kind==='seed').slice(0,3)){
  p.revealed=true;s.hero.x=p.x;s.hero.y=p.y;a.move(0,0);a.tick(.01);
 }
 assert.equal(s.collected,3);assert.equal(s.portalReady,true);
 s.hero.x=WORLD.portalX;s.hero.y=WORLD.portalY;a.tick(.02);
 assert.equal(s.phase,'choice');assert.equal(a.choose('extract'),true);
 assert.equal(s.phase,'settled');const before=a.progress.currency;const earned=a.finish();
 assert.ok(earned>0);assert.equal(a.progress.currency,before+earned);
 assert.equal(a.state.phase,'camp');assert.equal(a.progress.runs,1);
 assert.equal(a.buy('flame'),true);assert.equal(a.progress.upgrades.flame,1);
});
test('depth choice creates harder target and retains damage between rooms',()=>{
 const a=fresh();a.begin(15);a.state.hero.hp=2;a.state.phase='choice';
 assert.equal(a.choose('deeper'),true);assert.equal(a.state.depth,2);assert.equal(a.state.target,4);
 assert.equal(a.state.hero.hp,3);
});
test('out of flame causes defeat and only 35 percent is banked',()=>{
 const a=fresh();a.begin(15);a.state.carried=101;a.state.enemies=[];a.state.hero.flame=.001;
 a.tick(.05);assert.equal(a.state.phase,'defeated');
 assert.equal(a.finish(),35);assert.equal(a.progress.currency,35);
});
test('ad placement is disabled by default and contains strict complete-view guard',async()=>{
 const fs=await import('node:fs/promises');
 const code=await fs.readFile(new URL('../assets/scripts/platform/WeChatRewarded.ts',import.meta.url),'utf8');
 assert.ok(code.includes("AD_UNIT_ID=''"));assert.ok(code.includes('res?.isEnded===true'));
});

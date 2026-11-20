const t=require('node:test'),a=require('node:assert/strict'),R=require('../.check/Rules.js');
const advance=(s,time)=>{for(let i=0;i<time/.025;i++)R.step(s,.025)};
t('start, spawn and pursue',()=>{const s=R.init(3);R.start(s);advance(s,4);a.equal(s.mode,'battle');a.ok(s.enemies.length>0)});
t('capture and projectile',()=>{const s=R.init(2);R.start(s);s.spawnTimer=99;R.spawn(s,'skimmer',0,3);R.hold(s);advance(s,.1);a.equal(R.heldCount(s),1);a.equal(R.release(s),1);a.equal(s.missiles.length,1)});
t('thorn armor and overload',()=>{const s=R.init(3);R.start(s);s.spawnTimer=99;const f=R.spawn(s,'thorn',0,3);R.hold(s);advance(s,.1);a.equal(f.held,false);f.hp=1;advance(s,.1);a.equal(f.held,true);advance(s,2.8);a.equal(s.holding,false);a.ok(s.hp<100)});
t('upgrade choice and completion',()=>{const s=R.init(2);R.start(s);s.spawnTimer=99;advance(s,24.05);a.equal(s.mode,'upgrade');a.equal(s.choices.length,3);a.equal(R.upgrade(s,s.choices[0]),true);a.equal(s.wave,1)});
t('boss victory via projectile',()=>{const s=R.init(4);R.start(s);s.wave=3;s.spawnTimer=99;R.step(s,.025);let boss=s.enemies.find(e=>e.kind==='titan');boss.hp=1;s.missiles.push({id:100,x:boss.x,z:boss.z,vx:0,vz:0,power:5,pierce:0,radius:.5,ttl:1,hits:[]});R.step(s,.025);a.equal(s.mode,'victory')});
t('one revive only',()=>{const s=R.init(7);R.start(s);R.coreHit(s,10000);a.equal(s.mode,'defeat');a.equal(R.revive(s),true);R.coreHit(s,10000);a.equal(R.revive(s),false)});
t('save is sanitized and upgrades require currency',()=>{const v=R.readSave({best:-3,pearls:80,rank:99});a.equal(v.rank,20);const b=R.buy({best:0,pearls:80,rank:0,games:0});a.equal(b.pearls,40);a.equal(b.rank,1)});

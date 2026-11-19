// Like the core tests, Node 24+ runs this renderer-independent TypeScript directly.
import test from 'node:test';
import assert from 'node:assert/strict';
import {objectiveGuide,toolPresentation,nextRoomAdvice} from '../assets/scripts/AdventureGuide.ts';

function world(overrides={}) {
  return {
    roomIndex:0,
    obstacles:[{id:'welcome-board',kind:'board',x:0,y:-1.2,destroyed:false}],
    treasure:{x:0,y:1.6,taken:false},
    exit:{x:0,y:5.6,radius:.8},
    ...overrides,
  };
}

function freeze(value) {
  if(value&&typeof value==='object'){
    Object.freeze(value);
    for(const child of Object.values(value))freeze(child);
  }
  return value;
}

test('objective advances with actual board, treasure and exit state without tutorial flags',()=>{
  const state=world();
  let guide=objectiveGuide(state);
  assert.equal(guide.stage,'board');
  assert.deepEqual(guide.target,{x:0,y:-1.2});
  state.obstacles[0].destroyed=true;
  guide=objectiveGuide(state);
  assert.equal(guide.stage,'treasure');
  assert.deepEqual(guide.target,{x:0,y:1.6});
  state.treasure.taken=true;
  guide=objectiveGuide(state);
  assert.equal(guide.stage,'exit');
  assert.deepEqual(guide.target,{x:0,y:5.6});
});

test('taken treasure skips an intact optional board after a saved-world round trip',()=>{
  const state=world({treasure:{x:2,y:3,taken:true},exit:{x:-3,y:5,radius:.8}});
  const restored=JSON.parse(JSON.stringify(state));
  assert.equal(restored.obstacles[0].destroyed,false);
  const guide=objectiveGuide(restored);
  assert.equal(guide.stage,'exit');
  assert.deepEqual(guide.target,{x:-3,y:5});
  assert.deepEqual(guide,objectiveGuide(state));
});

test('missing first board and later rooms target treasure, never an unrelated tutorial obstacle',()=>{
  assert.equal(objectiveGuide(world({obstacles:[]})).stage,'treasure');
  assert.equal(objectiveGuide(world({obstacles:[{id:'other-board',kind:'board',x:1,y:0,destroyed:false}]})).stage,'treasure');
  for(const roomIndex of [1,2,3,4]){
    const state=world({roomIndex,treasure:{x:roomIndex,y:4,taken:false}});
    const guide=objectiveGuide(state);
    assert.equal(guide.stage,'treasure');
    assert.deepEqual(guide.target,{x:roomIndex,y:4});
    state.treasure.taken=true;
    assert.equal(objectiveGuide(state).stage,'exit');
  }
});

test('guidance is read-only, returns detached target coordinates and fits a single HUD line',()=>{
  for(const roomIndex of [0,1,2,3,4]){
    for(const taken of [false,true]){
      const state=freeze(world({roomIndex,treasure:{x:2,y:3,taken}}));
      const before=JSON.stringify(state),guide=objectiveGuide(state);
      assert.ok(guide.hint.length>0&&[...guide.hint].length<=24);
      assert.doesNotMatch(guide.hint,/\r|\n/);
      assert.ok([...guide.title].length<=6);
      guide.target.x=999;
      assert.equal(JSON.stringify(state),before);
    }
  }
});

test('tool names remain visible through aiming, movement, use, enemy response and terminal phases',()=>{
  const phases=['aiming','moving','enemies','room_clear','victory','game_over'];
  for(const [tool,name] of [['grip','抓停重瞄'],['return','回旋折返']]){
    for(const phase of phases)for(const ready of [false,true]){
      const presentation=toolPresentation(tool,phase,ready);
      assert.equal(presentation.name,name);
      assert.equal(presentation.active,phase==='moving'&&ready);
      assert.ok(presentation.status.length>0&&[...presentation.status].length<=12);
    }
    const idle=toolPresentation(tool,'aiming',true);
    const moving=toolPresentation(tool,'moving',true);
    const spent=toolPresentation(tool,'moving',false);
    const waiting=toolPresentation(tool,'enemies',false);
    assert.equal(new Set([idle.status,moving.status,spent.status,waiting.status]).size,4);
    assert.equal(toolPresentation(tool,'aiming',false).status,spent.status);
  }
});

test('empty and passive tool slots never invite an active-tool click',()=>{
  for(const phase of ['aiming','moving','enemies','room_clear','victory','game_over']){
    for(const ready of [false,true]){
      assert.deepEqual(toolPresentation('none',phase,ready),{name:'工具未携带',status:'过房可选',active:false});
      assert.deepEqual(toolPresentation('heavy',phase,ready),{name:'重撞拳套',status:'自动生效',active:false});
    }
  }
});

test('next-room advice stays brief, distinguishes tools and retains a mechanism fallback',()=>{
  for(const roomIndex of [1,2,3,4]){
    const suggestions=['heavy','grip','return'].map(tool=>nextRoomAdvice(roomIndex,tool));
    assert.equal(new Set(suggestions).size,3);
    for(const text of suggestions){
      assert.ok(text.length>0&&[...text].length<=24);
      assert.doesNotMatch(text,/\r|\n|必胜|保证|绝对安全|不会受伤/);
    }
  }
  assert.match(nextRoomAdvice(1,'heavy'),/柜子.*箭路/);
  assert.match(nextRoomAdvice(2,'heavy'),/厚木栏/);
  assert.match(nextRoomAdvice(3,'grip'),/右侧.*抓停/);
  assert.match(nextRoomAdvice(4,'return'),/窝主.*折返.*冲锋/);
  for(const tool of ['none','heavy','grip','return']){
    const fallback=nextRoomAdvice(0,tool);
    assert.ok(fallback.length>0);
    for(const index of [-1,5,100,NaN])assert.equal(nextRoomAdvice(index,tool),fallback);
  }
});

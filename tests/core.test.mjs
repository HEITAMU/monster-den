// Node 24+ runs the renderer-independent TypeScript directly without downloaded dependencies.
import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, nextResolve) {
    try { return nextResolve(specifier, context); }
    catch (error) {
      if (specifier.startsWith('.') && !/\.[cm]?[jt]s$/.test(specifier)) return nextResolve(`${specifier}.ts`, context);
      throw error;
    }
  },
});

const { GameModel, ROOMS } = await import('../assets/scripts/core/index.ts');

function room(overrides = {}) {
  return {
    id: 'test-room', name: 'Mechanic test', hint: '', width: 10, height: 14,
    start: { x: 0, y: -4 }, treasure: { x: 4, y: 5 }, exit: { x: -4, y: 5 },
    obstacles: [], enemies: [], ...overrides,
  };
}

function settle(model) {
  for (let i = 0; i < 1200; i++) {
    model.step(1 / 60);
    if (['aiming', 'room_clear', 'victory', 'game_over'].includes(model.state.phase)) return;
  }
  assert.fail('Simulation did not return control within 20 seconds.');
}

function fireAt(model, x, y, strength) {
  const p = model.state.player;
  const dx = x - p.x, dy = y - p.y, distance = Math.hypot(dx, dy);
  const drag = 1.36 * (p.tool === 'heavy' ? 1.07 : 1);
  const multiplier = p.tool === 'heavy' ? 0.96 : 1;
  const power = strength ?? Math.max(0, Math.min(1, ((distance + 0.17) * drag / 1.006 / multiplier - 1.9) / 10.9));
  assert.equal(model.shoot({ x: dx, y: dy }, power), true);
  settle(model);
}

test('first launch breaks a visible board, collects the treasure, and leaves an enemy alive', () => {
  const model = new GameModel(); model.drainEvents();
  assert.equal(model.shoot({ x: 0, y: 1 }, 1), true); settle(model);
  const events = model.drainEvents();
  assert.equal(model.state.treasure.taken, true);
  assert.equal(model.state.obstacles.find(o => o.id === 'welcome-board').destroyed, true);
  assert.equal(events.filter(e => e.type === 'board_break').length, 1);
  assert.equal(events.filter(e => e.type === 'treasure').length, 1);
  assert.equal(model.state.enemies[0].alive, true);
});

test('pushed rail cabinet stays moved and actually intercepts the archer projectile', () => {
  const model = new GameModel({ rooms: [ROOMS[1]] });
  model.state.player.tool = 'heavy'; model.drainEvents();
  model.shoot({ x: 0, y: 1 }, 1); settle(model);
  const cabinet = model.state.obstacles.find(o => o.id === 'arrow-cabinet');
  const events = model.drainEvents();
  assert.ok(cabinet.y > -0.1 && cabinet.y <= 0.2, `Cabinet is at ${cabinet.y}`);
  assert.equal(cabinet.x, 0);
  assert.ok(events.some(e => e.type === 'cabinet_push'));
  assert.ok(events.some(e => e.type === 'arrow_blocked' && e.obstacleId === cabinet.id));
  const movedY = cabinet.y;
  for (let i = 0; i < 120; i++) model.step(1 / 60);
  assert.ok(Math.abs(cabinet.y - movedY) < 0.015);
  assert.equal(model.state.player.hp, 5);
});

test('cabinet cover prevents damage that the same unobstructed arrow causes', () => {
  const config = room({ start: { x: -3, y: 0 }, enemies: [
    { id: 'archer', kind: 'archer', x: 4, y: 0, fixedAim: { x: -4, y: 0 } },
  ] });
  const exposed = new GameModel({ rooms: [config] });
  const covered = new GameModel({ rooms: [{ ...config, obstacles: [
    { id: 'cover', kind: 'cabinet', x: 0, y: 0, w: 1, h: 2, rail: { axis: 'y', min: -2, max: 2 } },
  ] }] });
  for (const model of [exposed, covered]) { model.shoot({ x: -1, y: 0 }, 0); settle(model); }
  assert.equal(exposed.state.player.hp, 4);
  assert.equal(covered.state.player.hp, 5);
});

test('treasure plus exit wins without clearing live enemies', () => {
  const model = new GameModel({ rooms: [room({ treasure: { x: 0, y: -1 }, exit: { x: 0, y: 3 },
    enemies: [{ id: 'unnecessary-guard', kind: 'guard', x: 4, y: 5, hp: 3 }] })] });
  model.shoot({ x: 0, y: 1 }, 1); settle(model);
  assert.equal(model.state.phase, 'victory');
  assert.equal(model.state.enemies[0].hp, 3);
  assert.equal(model.state.enemies[0].alive, true);
});

test('an exit alone does not win and cannot award the treasure', () => {
  const model = new GameModel({ rooms: [room({ exit: { x: 0, y: 0 } })] });
  model.shoot({ x: 0, y: 1 }, 0.5); settle(model);
  assert.equal(model.state.phase, 'aiming');
  assert.equal(model.state.treasure.taken, false);
  assert.ok(model.drainEvents().some(e => e.type === 'exit_locked'));
});

test('maximum launch speed and coarse frame times never tunnel through a thin wall', () => {
  const model = new GameModel({ rooms: [room({ start: { x: 0, y: -5 }, obstacles: [
    { id: 'thin-wall', kind: 'wall', x: 0, y: 0, w: 10, h: 0.14 },
  ] })] });
  model.shoot({ x: 0, y: 1 }, 1);
  for (let i = 0; i < 24; i++) {
    model.step(0.25);
    assert.ok(model.state.player.y <= -0.45 + 0.001);
    assert.ok(Math.abs(model.state.player.y) <= 7 - model.state.player.radius + 0.001);
  }
  assert.equal(model.state.phase, 'aiming');
});

test('heavy breaks a thick board in one hit while an ordinary hit leaves it intact', () => {
  const config = room({ start: { x: 0, y: -3 }, obstacles: [
    { id: 'thick', kind: 'board', x: 0, y: 0, w: 3, h: 0.3, hp: 2 },
  ] });
  const ordinary = new GameModel({ rooms: [config] });
  const heavy = new GameModel({ rooms: [config] }); heavy.state.player.tool = 'heavy';
  for (const model of [ordinary, heavy]) { model.shoot({ x: 0, y: 1 }, 1); settle(model); }
  assert.equal(ordinary.state.obstacles[0].hp, 1);
  assert.equal(ordinary.state.obstacles[0].destroyed, false);
  assert.equal(heavy.state.obstacles[0].destroyed, true);
});

test('grip allows one additional aim in the same turn, without an intervening enemy attack', () => {
  const model = new GameModel({ rooms: [room()] }); model.state.player.tool = 'grip';
  model.shoot({ x: 0, y: 1 }, 0.7); model.step(0.25);
  const turn = model.state.turn, stoppedY = model.state.player.y;
  assert.equal(model.activateTool(), true);
  assert.equal(model.state.phase, 'aiming');
  assert.equal(model.state.player.vy, 0);
  assert.equal(model.drainEvents().some(e => e.type === 'enemy_attack'), false);
  assert.equal(model.shoot({ x: 1, y: 0 }, 0.3), true);
  assert.equal(model.state.turn, turn);
  assert.equal(model.activateTool(), false);
  settle(model);
  assert.ok(Math.abs(model.state.player.y - stoppedY) < 0.001);
});

test('return turns a moving shot towards its launch point exactly once per turn', () => {
  const model = new GameModel({ rooms: [room()] }); model.state.player.tool = 'return';
  model.shoot({ x: 1, y: 0 }, 0.7); model.step(0.25);
  const turningX = model.state.player.x;
  assert.ok(model.state.player.vx > 0);
  assert.equal(model.activateTool(), true);
  assert.ok(model.state.player.vx < 0);
  assert.equal(model.activateTool(), false);
  model.step(0.1);
  assert.ok(model.state.player.x < turningX);
});

test('failure permits one rescue, preserves collected treasure, and rejects a second rescue', () => {
  const model = new GameModel({ rooms: [room({ start: { x: -3, y: 0 }, treasure: { x: -3, y: 0 }, enemies: [
    { id: 'archer', kind: 'archer', x: 4, y: 0, fixedAim: { x: -4, y: 0 } },
  ] })] });
  model.state.player.hp = 1;
  model.shoot({ x: -1, y: 0 }, 0); settle(model);
  assert.equal(model.state.phase, 'game_over');
  assert.equal(model.state.treasure.taken, true);
  assert.equal(model.rescue(), true);
  assert.equal(model.state.phase, 'aiming');
  assert.equal(model.state.player.hp, 3);
  assert.equal(model.state.treasure.taken, true);
  model.state.player.hp = 1;
  model.shoot({ x: -1, y: 0 }, 0); settle(model);
  assert.equal(model.state.phase, 'game_over');
  assert.equal(model.rescue(), false);
});

test('JSON snapshot restores moving cabinets, flight, future events, and the exact deterministic result', () => {
  const original = new GameModel({ rooms: [ROOMS[1]] }); original.state.player.tool = 'heavy';
  original.shoot({ x: 0, y: 1 }, 1); original.step(0.2); original.step(0.123);
  original.drainEvents();
  const saved = JSON.parse(JSON.stringify(original.snapshot()));
  const restored = new GameModel({ rooms: [ROOMS[1]], snapshot: saved });
  for (let i = 0; i < 420; i++) { original.step(1 / 60); restored.step(1 / 60); }
  assert.deepEqual(restored.snapshot(), original.snapshot());
  assert.deepEqual(restored.drainEvents(), original.drainEvents());
  assert.throws(() => restored.restore({ version: 42 }), /snapshot/);
});

test('30 FPS and 60 FPS feed the same fixed-step simulation', () => {
  const a = new GameModel(), b = new GameModel();
  a.shoot({ x: 0, y: 1 }, 1); b.shoot({ x: 0, y: 1 }, 1);
  for (let i = 0; i < 240; i++) a.step(1 / 60);
  for (let i = 0; i < 120; i++) b.step(1 / 30);
  assert.deepEqual(a.snapshot(), b.snapshot());
});

test('all five authored rooms are playable in one expedition, retaining live enemies', () => {
  const model = new GameModel();
  const routes = [
    [[0, 1.6, 1], [0, 5.6]],
    [[0, 3, 1], [-1.4, -2.5], [-1.4, 4.5], [0, 4.2], [2.9, 5.7]],
    [[0, -3], [0, 3, 1], [3, 3.6], [3, 5.8]],
    [[2, -4], [4.1, 1], [4.1, 4.5], [3.6, 4.5], [-3.5, 5.7]],
    [[3.8, -4], [4.2, 2], [2, 3.8], [0, 3.8], [0, 5.9]],
  ];
  for (let index = 0; index < routes.length; index++) {
    assert.equal(model.state.roomIndex, index);
    for (const [x, y, power] of routes[index]) fireAt(model, x, y, power);
    assert.equal(model.state.phase, index === 4 ? 'victory' : 'room_clear', `Room ${index + 1}`);
    assert.ok(model.state.enemies.some(e => e.alive), `Room ${index + 1} did not require clearing enemies`);
    if (index < 4) assert.equal(model.nextRoom('heavy'), true);
  }
  assert.equal(model.state.phase, 'victory');
  assert.ok(model.state.player.hp > 0);
  assert.equal(model.state.rescuesUsed, 0);
  assert.equal(model.state.shots, 21);
});

test('input and progression calls reject invalid states without corrupting the simulation', () => {
  const model = new GameModel();
  assert.equal(model.nextRoom('heavy'), false);
  assert.equal(model.rescue(), false);
  assert.equal(model.shoot({ x: 0, y: 0 }), false);
  assert.equal(model.shoot({ x: NaN, y: 1 }), false);
  model.step(Infinity); model.step(-1);
  assert.equal(model.shoot({ x: 0, y: 1 }), true);
  assert.equal(model.shoot({ x: 1, y: 0 }), false);
  assert.equal(model.activateTool(), false);
  assert.ok(Number.isFinite(model.state.player.x));
});

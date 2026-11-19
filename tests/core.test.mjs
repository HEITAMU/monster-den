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

const { GameModel, ROOMS, TUNING, JOYSTICK_TUNING, ACTION_PACING } = await import('../assets/scripts/core/index.ts');

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
  const drag = TUNING.drag * (p.tool === 'heavy' ? 1.07 : 1);
  const multiplier = p.tool === 'heavy' ? 0.96 : 1;
  const power = strength ?? Math.max(0, Math.min(1, ((distance + 0.17) * drag / 1.006 / multiplier - TUNING.launchMin) / (TUNING.launchMax - TUNING.launchMin)));
  assert.equal(model.shoot({ x: dx, y: dy }, power), true);
  settle(model);
}

function assertPreviewMatchesFlight(model, direction, power, expectedEndpoint = 'stop') {
  const preview = model.aim(direction.x, direction.y, power);
  assert.equal(preview.endpoint, expectedEndpoint);
  assert.equal(preview.blocked, false);
  const predicted = preview.points.at(-1);
  assert.equal(model.shoot(direction, power), true);
  settle(model);
  const error = Math.hypot(predicted.x - model.state.player.x, predicted.y - model.state.player.y);
  assert.ok(error < 1e-10, `Preview differs from real flight by ${error} metres`);
  return preview;
}

test('aim predicts the full stopping point at low/full power with ordinary and heavy movement', () => {
  const config = room({ width: 100, height: 100, start: { x: 0, y: 0 },
    treasure: { x: 40, y: 40 }, exit: { x: -40, y: 40 } });
  for (const tool of ['none', 'heavy', 'grip', 'return']) {
    for (const power of [0, 0.11, 0.3, 1]) {
      const model = new GameModel({ rooms: [config] });
      model.equipStartingTool(tool);
      const preview = assertPreviewMatchesFlight(model, { x: 0.3, y: 1 }, power);
      assert.ok(preview.points.length > 2);
      if (power === 1 && tool !== 'heavy') {
        assert.ok(Math.hypot(preview.points.at(-1).x, preview.points.at(-1).y) > 9,
          'Full-power preview must include the slow tail beyond the former two-second limit');
      }
    }
  }
});

test('aim follows static walls, corners and multiple boundary bounces to the real stopping point', () => {
  const cases = [
    { config: room({ width: 4, height: 20, treasure: { x: 1, y: 8 }, exit: { x: -1, y: 8 } }), direction: { x: 1, y: 0.1 }, minBounces: 2 },
    { config: room({ obstacles: [{ id: 'cross-wall', kind: 'wall', x: 0, y: 0, w: 7, h: 0.45 }] }), direction: { x: 0.15, y: 1 }, minBounces: 1 },
    { config: room({ start: { x: -3, y: -3 }, obstacles: [
      { id: 'corner-pillar', kind: 'pillar', x: 0, y: 0, w: 2, h: 2 },
      { id: 'side-wall', kind: 'wall', x: -4.1, y: -1, w: 0.4, h: 3 },
    ] }), direction: { x: 1, y: 1 }, minBounces: 1 },
  ];
  for (const { config, direction, minBounces } of cases) {
    const model = new GameModel({ rooms: [config] });
    const preview = assertPreviewMatchesFlight(model, direction, 1);
    assert.ok(model.drainEvents().filter(e => e.type === 'bounce').length >= minBounces);
    assert.ok(preview.points.every(p => Math.abs(p.x) <= config.width / 2 - 0.38 + 1e-8
      && Math.abs(p.y) <= config.height / 2 - 0.38 + 1e-8));
  }
});

test('aim identifies a board, cabinet or enemy contact instead of promising a landing beyond it', () => {
  const cases = [
    { id: 'board', config: room({ obstacles: [{ id: 'board', kind: 'board', x: 0, y: 0, w: 2, h: 0.3 }] }), y: -0.5305 },
    { id: 'cabinet', config: room({ obstacles: [{ id: 'cabinet', kind: 'cabinet', x: 0, y: 0, w: 2, h: 1,
      rail: { axis: 'y', min: 0, max: 3 } }] }), y: -0.8805 },
    { id: 'guard', config: room({ enemies: [{ id: 'guard', kind: 'guard', x: 0, y: 0 }] }), y: -0.81 },
  ];
  for (const { id, config, y } of cases) {
    const model = new GameModel({ rooms: [config] });
    model.equipStartingTool('heavy');
    const before = model.snapshot();
    const preview = model.aim(0, 1, 1);
    assert.equal(preview.endpoint, 'interaction');
    assert.equal(preview.blocked, true);
    assert.equal(preview.targetId, id);
    assert.ok(Math.abs(preview.points.at(-1).y - y) < 1e-10);
    assert.deepEqual(model.snapshot(), before, 'Prediction must not damage or move interactive objects');
  }
});

test('aim stops at an unlocked exit including collecting treasure earlier in the same shot', () => {
  for (const alreadyTaken of [false, true]) {
    const model = new GameModel({ rooms: [room({ width: 30, height: 30,
      treasure: { x: 0, y: -1 }, exit: { x: 0, y: 3 } })] });
    model.state.treasure.taken = alreadyTaken;
    assertPreviewMatchesFlight(model, { x: 0, y: 1 }, 1, 'exit');
    assert.equal(model.state.phase, 'victory');
  }
  const locked = new GameModel({ rooms: [room({ width: 30, height: 30,
    treasure: { x: 10, y: 10 }, exit: { x: 0, y: 1 } })] });
  assertPreviewMatchesFlight(locked, { x: 0, y: 1 }, 1);
  assert.equal(locked.state.treasure.taken, false);
});

test('repeated and invalid aim requests preserve simulation state and pending events', () => {
  const model = new GameModel(), untouched = new GameModel();
  const before = model.snapshot(), expectedEvents = untouched.drainEvents();
  for (const [x, y, power] of [[0, 1, 1], [1, 1, 0.11], [-1, 0.2, 0.7], [0, 0, 1], [NaN, 1, 1], [1, Infinity, 1], [1, 1, NaN]]) {
    const preview = model.aim(x, y, power);
    assert.ok(preview.points.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)));
    assert.ok(Number.isFinite(preview.direction.x) && Number.isFinite(preview.direction.y) && Number.isFinite(preview.power));
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(power) || (x === 0 && y === 0)) {
      assert.equal(preview.endpoint, 'none'); assert.equal(preview.points.length, 1);
    }
    assert.deepEqual(model.snapshot(), before);
  }
  assert.deepEqual(model.drainEvents(), expectedEvents);
});

test('short joystick travel gives a small nudge and weak/medium/full turns return control promptly', () => {
  const config = room({ width: 100, height: 100, start: { x: 0, y: 0 },
    treasure: { x: 40, y: 40 }, exit: { x: -40, y: 40 },
    enemies: [{ id: 'distant-guard', kind: 'guard', x: 30, y: 30 }] });
  const cases = [
    { power: 1 / (JOYSTICK_TUNING.travel - JOYSTICK_TUNING.deadZone), maxSeconds: 1.1, distance: [0.3, 0.5] },
    { power: 0.11, maxSeconds: 1.45, distance: [1.1, 1.4] },
    { power: 0.5, maxSeconds: 2.05, distance: [4.6, 4.95] },
    { power: 1, maxSeconds: 2.35, distance: [9.25, 9.36] },
  ];
  for (const { power, maxSeconds, distance } of cases) {
    const model = new GameModel({ rooms: [config] });
    model.shoot({ x: 0, y: 1 }, power);
    let frames = 0;
    while (model.state.phase !== 'aiming' && frames < 600) { model.step(1 / 120); frames++; }
    assert.equal(model.state.phase, 'aiming');
    assert.ok(frames / 120 < maxSeconds, `${power} power turn took ${frames / 120} real seconds`);
    assert.ok(model.state.player.y >= distance[0] && model.state.player.y <= distance[1]);
    assert.ok(Math.abs(model.state.elapsed - frames / 120) < 1e-9,
      'elapsed must count real seconds, not accelerated physics time');
  }
});

test('grip and return retain a deliberate tool-tap window even on short nudge shots', () => {
  const config = room({ width: 100, height: 100, start: { x: 0, y: 0 },
    treasure: { x: 40, y: 40 }, exit: { x: -40, y: 40 } });
  for (const tool of ['grip', 'return']) {
    for (const power of [0.03, 0.11, 0.5, 1]) {
      const model = new GameModel({ rooms: [config] }); model.equipStartingTool(tool);
      model.shoot({ x: 0, y: 1 }, power);
      // A human has half a second after release to move the finger onto the tool button.
      for (let frame = 0; frame < 30; frame++) model.step(1 / 60);
      assert.equal(model.state.phase, 'moving', `${tool} ${power}: tool window vanished too soon`);
      assert.equal(model.state.player.toolReady, true);
      const turn = model.state.turn;
      assert.equal(model.activateTool(), true);
      assert.equal(model.state.turn, turn);
      assert.equal(model.activateTool(), false);
    }
  }
  assert.ok(ACTION_PACING.tail <= 2 * ACTION_PACING.flight,
    'Low-speed playback compression must not make the rendered body accelerate as its physics speed falls');
});

test('paced flight, tools and enemy turns stay identical at 30 and 60 rendered FPS', () => {
  const config = room({ width: 100, height: 100, start: { x: 0, y: 0 },
    treasure: { x: 40, y: 40 }, exit: { x: -40, y: 40 },
    enemies: [{ id: 'distant-guard', kind: 'guard', x: 30, y: 30 }] });
  for (const tool of ['none', 'heavy', 'grip', 'return']) {
    for (const power of [0.11, 0.5, 1]) {
      const a = new GameModel({ rooms: [config] }), b = new GameModel({ rooms: [config] });
      for (const model of [a, b]) { model.equipStartingTool(tool); model.shoot({ x: 0, y: 1 }, power); }
      for (let frame = 1; frame <= 180; frame++) {
        a.step(1 / 60);
        if (frame % 2) continue;
        b.step(1 / 30);
        assert.deepEqual(a.snapshot(), b.snapshot(), `${tool} ${power}: divergence at frame ${frame}`);
        if (frame === 30 && (tool === 'grip' || tool === 'return')) {
          for (const model of [a, b]) {
            assert.equal(model.activateTool(), true);
            if (tool === 'grip') assert.equal(model.shoot({ x: 1, y: 0 }, 0.3), true);
          }
        }
      }
      assert.deepEqual(a.drainEvents(), b.drainEvents());
    }
  }
});

test('paced mid-flight saves preserve fractional timing and legacy v1 saves receive safe clock defaults', () => {
  const config = room({ width: 100, height: 100, start: { x: 0, y: 0 },
    treasure: { x: 40, y: 40 }, exit: { x: -40, y: 40 } });
  const original = new GameModel({ rooms: [config] });
  original.shoot({ x: 0, y: 1 }, 1); original.step(0.213);
  const saved = JSON.parse(JSON.stringify(original.snapshot()));
  assert.ok(saved.runtime.actionAccumulator > 0 && saved.runtime.actionAccumulator < 1);
  const restored = new GameModel({ rooms: [config], snapshot: saved });
  original.drainEvents();
  for (let i = 0; i < 100; i++) { original.step(1 / 60); restored.step(1 / 60); }
  assert.deepEqual(restored.snapshot(), original.snapshot());
  assert.deepEqual(restored.drainEvents(), original.drainEvents());

  const legacy = JSON.parse(JSON.stringify(saved));
  delete legacy.runtime.actionAccumulator; delete legacy.runtime.flightRealTime;
  const migrated = new GameModel({ rooms: [config], snapshot: legacy });
  assert.deepEqual(migrated.state, legacy.state, 'Loading old v1 must not reset the adventure');
  assert.equal(migrated.snapshot().runtime.actionAccumulator, 0);
  assert.equal(migrated.snapshot().runtime.flightRealTime, legacy.runtime.flightTime);
  settle(migrated);
  assert.equal(migrated.state.phase, 'aiming');
  assert.ok(Math.abs(migrated.state.player.y - original.state.player.y) < 1e-10);
});

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

test('optional stash is collected once without stopping flight or unlocking the exit', () => {
  const model = new GameModel({ rooms: [room({ exit: { x: 0, y: 3 },
    stashes: [{ id: 'side-loot', x: 0, y: -1, value: 80 }] })] });
  const before = model.snapshot();
  model.aim(0, 1, 0.7);
  assert.deepEqual(model.snapshot(), before, 'Aiming over optional loot must not collect it.');
  assertPreviewMatchesFlight(model, { x: 0, y: 1 }, 0.7);
  assert.ok(model.state.player.y > 2, 'Passing the stash must not terminate the shot.');
  assert.equal(model.state.phase, 'aiming');
  assert.equal(model.state.treasure.taken, false, 'Side loot is not the room key.');
  assert.equal(model.state.stashes[0].taken, true);
  assert.equal(model.state.stashCount, 1); assert.equal(model.state.stashValue, 80);
  assert.equal(model.state.score, 80);
  const events = model.drainEvents();
  assert.deepEqual(events.filter(e => e.type === 'stash'), [
    { type: 'stash', x: 0, y: -1, id: 'side-loot', amount: 80 },
  ]);
  assert.ok(events.some(e => e.type === 'exit_locked'));
  fireAt(model, 0, -3);
  assert.equal(model.state.score, 80, 'Crossing an already collected stash must not award again.');
  assert.equal(model.drainEvents().some(e => e.type === 'stash'), false);
});

test('stash pickup survives an in-flight save, accumulates across rooms, and resets with a new expedition', () => {
  const rooms = [
    room({ id: 'stash-first', treasure: { x: 0, y: -1 }, exit: { x: 0, y: 3 },
      stashes: [{ id: 'first-loot', x: 0, y: -2, value: 80 }] }),
    room({ id: 'stash-second', treasure: { x: 0, y: 1 }, exit: { x: 0, y: 4 },
      stashes: [{ id: 'second-loot', x: 0, y: -1, value: 120 }] }),
  ];
  const original = new GameModel({ rooms });
  original.shoot({ x: 0, y: 1 }, 1);
  for (let i = 0; i < 120 && !original.state.stashes[0].taken; i++) original.step(1 / 120);
  assert.equal(original.state.stashCount, 1); assert.equal(original.state.phase, 'moving');
  assert.equal(original.state.score, 80);
  original.drainEvents();
  const saved = JSON.parse(JSON.stringify(original.snapshot()));
  const restored = new GameModel({ rooms, snapshot: saved });
  settle(original); settle(restored);
  assert.deepEqual(restored.snapshot(), original.snapshot());
  assert.deepEqual(restored.drainEvents(), original.drainEvents(), 'Restoring must not replay a stash award.');
  assert.equal(restored.state.phase, 'room_clear'); assert.equal(restored.state.score, 230);
  assert.equal(restored.nextRoom('return'), true);
  assert.equal(restored.state.stashCount, 1); assert.equal(restored.state.stashValue, 80);
  assert.equal(restored.state.stashes[0].id, 'second-loot');
  assert.equal(restored.state.stashes[0].taken, false);
  fireAt(restored, 0, 4, 1);
  assert.equal(restored.state.phase, 'victory');
  assert.equal(restored.state.stashCount, 2); assert.equal(restored.state.stashValue, 200);
  assert.equal(restored.state.score, 750);
  restored.restart();
  assert.equal(restored.state.stashCount, 0); assert.equal(restored.state.stashValue, 0);
  assert.equal(restored.state.score, 0); assert.equal(restored.state.stashes[0].taken, false);
});

test('legacy v1 snapshots keep the current room free of new stash spawns and use new stashes only in the next room', () => {
  const rooms = [room({ stashes: [{ id: 'not-retroactive', x: 0, y: -1, value: 80 }] }),
    room({ id: 'next-room', stashes: [{ id: 'new-room-loot', x: 1, y: 1, value: 120 }] })];
  const legacy = new GameModel({ rooms }).snapshot();
  delete legacy.state.stashes; delete legacy.state.stashCount; delete legacy.state.stashValue;
  const restored = new GameModel({ rooms, snapshot: legacy });
  assert.deepEqual(restored.state.stashes, []);
  assert.equal(restored.state.stashCount, 0); assert.equal(restored.state.stashValue, 0);
  assert.equal(restored.state.score, legacy.state.score);
  fireAt(restored, 0, 2.6);
  assert.equal(restored.state.score, 0);
  assert.equal(restored.drainEvents().some(e => e.type === 'stash'), false);
  fireAt(restored, 4, 5); fireAt(restored, -4, 5);
  assert.equal(restored.state.phase, 'room_clear');
  assert.equal(restored.nextRoom(), true);
  assert.deepEqual(restored.state.stashes, [{ id: 'new-room-loot', x: 1, y: 1, value: 120, taken: false }]);
  assert.equal(restored.state.stashCount, 0); assert.equal(restored.state.stashValue, 0);
});

test('malformed stash snapshots are rejected without replacing the current valid game state', () => {
  const model = new GameModel({ rooms: [room({ stashes: [{ id: 'saved-loot', x: 0, y: 0, value: 80 }] })] });
  const before = model.snapshot();
  const corruptions = [
    state => { state.stashes[0].value = -80; },
    state => { state.stashes[0].x = Infinity; },
    state => { state.stashes.push({ ...state.stashes[0] }); },
    state => { state.stashes[0].taken = true; },
    state => { delete state.stashCount; },
  ];
  for (const corrupt of corruptions) {
    const saved = JSON.parse(JSON.stringify(before)); corrupt(saved.state);
    assert.throws(() => model.restore(saved), /stash/);
    assert.deepEqual(model.snapshot(), before);
  }
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
  const model = new GameModel({ rooms: [room({ start: { x: -3, y: 0 }, treasure: { x: -3, y: 0 },
    stashes: [{ id: 'rescued-loot', x: -3, y: 0, value: 80 }], enemies: [
    { id: 'archer', kind: 'archer', x: 4, y: 0, fixedAim: { x: -4, y: 0 } },
  ] })] });
  model.state.player.hp = 1;
  model.shoot({ x: -1, y: 0 }, 0); settle(model);
  assert.equal(model.state.phase, 'game_over');
  assert.equal(model.state.treasure.taken, true);
  assert.equal(model.state.stashCount, 1); assert.equal(model.state.stashValue, 80);
  assert.equal(model.state.score, 180);
  assert.equal(model.rescue(), true);
  assert.equal(model.state.phase, 'aiming');
  assert.equal(model.state.player.hp, 3);
  assert.equal(model.state.treasure.taken, true);
  assert.equal(model.state.stashes[0].taken, true);
  model.state.player.hp = 1;
  model.shoot({ x: -1, y: 0 }, 0); settle(model);
  assert.equal(model.state.phase, 'game_over');
  assert.equal(model.rescue(), false);
  assert.equal(model.state.stashCount, 1); assert.equal(model.state.stashValue, 80);
  assert.equal(model.state.score, 180, 'A rescue must preserve loot without making it collectible again.');
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
  assert.equal(model.state.stashCount, 0, 'Both authored side stashes must be optional on the established route.');
  assert.equal(model.state.stashValue, 0);
  assert.equal(model.state.score, 1065, 'Adding side routes must not alter the reward for skipping them.');
});

test('both authored side stashes are reachable through real shots in a complete expedition', () => {
  const model = new GameModel();
  const routes = [
    [[0, 1.6, 1], [0, 5.6]],
    [[0, 3, 1], [-3.85, -0.4], [-1.4, -0.4], [-1.4, 4.5], [0, 4.2], [2.9, 5.7]],
    [[0, -3], [0, 3, 1], [3, 3.6], [3, 5.8]],
    [[-3.2, -3.6], [-2.35, 0.5], [4.1, 1], [4.1, 4.5], [3.6, 4.5], [-3.5, 5.7]],
    [[3.8, -4], [4.2, 2], [2, 3.8], [0, 3.8], [0, 5.9]],
  ];
  const collected = [];
  for (let index = 0; index < routes.length; index++) {
    for (const target of routes[index]) {
      fireAt(model, ...target);
      collected.push(...model.drainEvents().filter(e => e.type === 'stash'));
    }
    assert.equal(model.state.phase, index === 4 ? 'victory' : 'room_clear');
    assert.ok(model.state.enemies.some(e => e.alive));
    if (index < 4) assert.equal(model.nextRoom('heavy'), true);
  }
  assert.deepEqual(collected.map(e => [e.id, e.amount]), [['store-side-stash', 80], ['vault-side-stash', 120]]);
  assert.equal(model.state.stashCount, 2); assert.equal(model.state.stashValue, 200);
  assert.equal(model.state.shots, 23); assert.equal(model.state.rescuesUsed, 0);
  assert.equal(model.state.player.hp, 4);
  // This route skips one ordinary enemy defeat worth 35, so its net increase
  // over the 1065-point main route is 165, despite collecting 200 in side loot.
  assert.equal(model.state.score, 1230);
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

test('optional five-spore first-room chain destroys the board and knocks the guard without unlocking the exit',()=>{
  const model=new GameModel({rooms:[ROOMS[0]]});
  assert.equal(model.state.spores.length,5);
  const preview=model.aim(-3.2,2.5,.55);
  assert.equal(preview.endpoint,'interaction');assert.equal(preview.targetId,'heart-root');
  assert.equal(model.state.spores.some(s=>s.spent),false,'Aim preview must not mutate the lattice.');
  fireAt(model,-3.2,-3,.55);
  assert.equal(model.state.spores.filter(s=>s.spent).length,5);
  assert.deepEqual(model.state.spores.map(s=>s.depth),[1,2,3,4,5]);
  assert.equal(model.state.obstacles.find(o=>o.id==='welcome-board').destroyed,true);
  assert.equal(model.state.enemies.find(e=>e.id==='court-guard').hp,1);
  assert.equal(model.state.treasure.taken,false);
  assert.equal(model.state.score,65,'Five spore pickups + wooden board.');
  assert.deepEqual(model.drainEvents().filter(e=>e.type==='spore_burst').map(e=>e.amount),[1,2,3,4,5]);
});

test('spore fuse snapshots restore without changing the chain; invalid data is rejected atomically',()=>{
  const config=room({start:{x:-3.2,y:-5.2},treasure:{x:4,y:4},exit:{x:-4,y:5},
    spores:ROOMS[0].spores,obstacles:[{id:'barrier',kind:'board',x:0,y:-1.2,w:2.1,h:.28,hp:2}]});
  const model=new GameModel({rooms:[config]});
  model.shoot({x:0,y:1},.55);
  for(let i=0;i<90&&!model.state.spores.some(s=>s.fuse>=0);i++)model.step(1/60);
  assert.ok(model.state.spores.some(s=>s.fuse>=0));
  const restored=new GameModel({rooms:[config],snapshot:model.snapshot()});
  model.drainEvents();
  for(let i=0;i<240;i++){model.step(1/60);restored.step(1/60);}
  assert.deepEqual(restored.snapshot(),model.snapshot());
  assert.equal(model.state.spores.filter(s=>s.spent).length,5);
  const corrupt=restored.snapshot();corrupt.state.spores[0].fuse='invalid';
  const before=restored.snapshot();
  assert.throws(()=>restored.restore(corrupt),/Invalid Monster Den spore snapshot/);
  assert.deepEqual(restored.snapshot(),before);
  const old=restored.snapshot();delete old.state.spores;
  assert.deepEqual(new GameModel({rooms:[config],snapshot:old}).state.spores,[]);
});

test('direct first-room path remains playable without igniting optional fungal mechanisms',()=>{
  const model=new GameModel();
  fireAt(model,0,1.6,1);
  assert.equal(model.state.spores.filter(s=>s.spent).length,0);
  fireAt(model,0,5.6);
  assert.equal(model.state.phase,'room_clear');
  assert.equal(model.state.score,165);
});

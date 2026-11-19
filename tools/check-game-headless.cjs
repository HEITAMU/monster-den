#!/usr/bin/env node
/** Exercise the real GameMain and real model JSON in Cocos 3.8.8 EmptyDevice.
 * This is lifecycle/integration evidence, never a GPU or visual approval.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const engine = process.env.COCOS_ENGINE_SOURCE;
if (!engine) throw new Error('COCOS_ENGINE_SOURCE is required.');
const { buildEngine } = require(path.join(engine, 'node_modules/@cocos/ccbuild'));
const { JSDOM } = require(path.join(engine, 'node_modules/jsdom'));
const ts = require(path.join(engine, 'node_modules/typescript'));
const napi = require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES || path.join(root, 'node_modules'), '@napi-rs/canvas'));
const out = path.join(root, '.build/game-headless');
const engineOut = path.join(root, '.build/engine-headless');
fs.mkdirSync(out, { recursive: true });
const result = { backend: 'Cocos EmptyDevice', engineVersion: '3.8.8',
  pixelValidation: false, gpuShaderCompilation: false, audibleOutputValidation: false,
  testMethod: 'Unmodified GameMain/core/platform/model code; Cocos lifecycle ticks; DOM/canvas host fixture. EmptyDevice is the only compiled graphics backend, selected by the official WebGL fallback so screen adaptation remains testable (HEADLESS mode intentionally reports 1x1). Five rooms use the documented 21-shot route through real DOM mouse input. Only the separate game-over UI branch uses a controlled snapshot.',
  errors: [], warnings: [], checkpoints: [], sourceFiles: {}, assetRequests: [] };
const record = file => {
  const buffer = fs.readFileSync(file);
  result.sourceFiles[path.relative(root, file)] = { bytes: buffer.length, sha256: crypto.createHash('sha256').update(buffer).digest('hex') };
  return buffer.toString('utf8');
};
let win, cc, dom;
const onUnhandled = error => result.errors.push(`Unhandled rejection: ${error?.stack || error}`);
process.on('unhandledRejection', onUnhandled);
(async () => {
  if (JSON.parse(fs.readFileSync(path.join(engine, 'package.json'), 'utf8')).version !== '3.8.8') throw new Error('Expected official engine 3.8.8 source.');
  if (!fs.existsSync(path.join(engineOut, 'cc.js'))) {
    const build = await buildEngine({ engine, out: engineOut, mode: 'BUILD', platform: 'HTML5', moduleFormat: 'cjs',
      targets: { chrome: '80', ios: '14' },
      features: ['base', '3d', 'animation', 'skeletal-animation', '2d', 'ui', 'graphics', 'mask', 'tween', 'audio', 'primitive', 'legacy-pipeline', 'gfx-empty'],
      compress: false, sourceMap: false, flags: { DEBUG: true, CULL_MESHOPT: true } });
    if (build.hasCriticalWarns) throw new Error('EmptyDevice diagnostic engine could not be built.');
  }
  dom = new JSDOM('<!doctype html><html><body><div id="GameDiv"><div id="Cocos3dGameContainer"><canvas id="GameCanvas" width="720" height="1280"></canvas></div></div></body></html>',
    { url: 'https://fixture.test/', pretendToBeVisual: true, runScripts: 'outside-only' });
  win = dom.window;
  const canvases = new WeakMap();
  function canvasFor(element) {
    let canvas = canvases.get(element);
    if (!canvas) { canvas = napi.createCanvas(element.width || 720, element.height || 1280); canvases.set(element, canvas); }
    if (canvas.width !== element.width) canvas.width = element.width;
    if (canvas.height !== element.height) canvas.height = element.height;
    return canvas;
  }
  win.HTMLCanvasElement.prototype.getContext = function (type) { return type === '2d' ? canvasFor(this).getContext('2d') : null; };
  win.HTMLCanvasElement.prototype.toDataURL = function (...args) { return canvasFor(this).toDataURL(...args); };
  win.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  Object.defineProperty(win, 'innerWidth', { value: 720 });
  Object.defineProperty(win, 'innerHeight', { value: 1280 });
  Object.defineProperty(win.document.documentElement, 'clientWidth', { value: 720 });
  Object.defineProperty(win.document.documentElement, 'clientHeight', { value: 1280 });
  for (const id of ['GameDiv', 'Cocos3dGameContainer', 'GameCanvas']) {
    const element = win.document.getElementById(id);
    Object.defineProperty(element, 'clientWidth', { get: () => 720 });
    Object.defineProperty(element, 'clientHeight', { get: () => 1280 });
    element.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: 720, bottom: 1280, width: 720, height: 1280 });
  }
  win.fetch = async url => {
    const pathname = new URL(url, 'https://fixture.test/').pathname;
    if (!pathname.startsWith('/resources/') && pathname !== '/vendor/uniform-chunks.json') throw new Error(`Unexpected test asset request ${pathname}`);
    const file = path.join(root, 'web', pathname);
    result.assetRequests.push(pathname);
    return { ok: fs.existsSync(file), status: fs.existsSync(file) ? 200 : 404,
      json: async () => win.JSON.parse(record(file)) };
  };
  for (const method of ['error', 'warn']) {
    const original = win.console[method].bind(win.console);
    win.console[method] = (...args) => {
      result[method === 'error' ? 'errors' : 'warnings'].push(args.map(value => value?.stack || String(value)).join(' '));
      original(...args);
    };
  }
  win.addEventListener('error', event => result.errors.push(`Window error: ${event.error?.stack || event.message}`));
  win.addEventListener('unhandledrejection', event => result.errors.push(`Window rejection: ${event.reason?.stack || event.reason}`));
  win.__monsterDenRuntime = { ready: false, errors: [], engine: 'Cocos Creator 3.8.8', platform: 'EmptyDevice integration diagnostic' };
  win.exports = {};
  win.eval(fs.readFileSync(path.join(engineOut, 'cc.js'), 'utf8'));
  cc = win.exports;
  assert.equal(cc.VERSION, '3.8.8');
  win.eval(record(path.join(root, 'web/engine-effects.js')).replace('export async function', 'async function').replaceAll('import.meta.url', '"https://fixture.test/engine-effects.js"') + '\nwindow.installPreviewEffects=installPreviewEffects;');
  cc.game.onPostSubsystemInitDelegate.add(() => win.installPreviewEffects(cc));
  await cc.game.init({ overrideSettings: {
    screen: { designResolution: { width: 720, height: 1280, policy: cc.ResolutionPolicy.FIXED_WIDTH }, frameRate: 60 },
    rendering: { renderMode: 2, customPipeline: false }, splashScreen: { totalTime: 0 },
    profiling: { showFPS: false }, assets: { preloadBundles: [], preloadAssets: [] }
  } });
  result.actualDevice = cc.director.root.device.constructor.name;
  assert.equal(result.actualDevice, 'EmptyDevice');
  const initializedMeshes = new Set(), liveMeshes = new Set();
  const initializeMesh = cc.Mesh.prototype.initialize, destroyMesh = cc.Mesh.prototype.destroy;
  cc.Mesh.prototype.initialize = function (...args) {
    initializedMeshes.add(this); liveMeshes.add(this);
    return initializeMesh.apply(this, args);
  };
  cc.Mesh.prototype.destroy = function (...args) {
    const destroyed = destroyMesh.apply(this, args);
    if (destroyed !== false) liveMeshes.delete(this);
    return destroyed;
  };
  const moduleCache = new Map();
  function loadModule(name, importer = path.join(root, 'assets/scripts/_entry.ts')) {
    if (name === 'cc') return cc;
    if (!name.startsWith('.')) throw new Error(`Unsupported external game module: ${name}`);
    let file = path.resolve(path.dirname(importer), name);
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.ts');
    else if (!file.endsWith('.ts')) file += '.ts';
    if (!file.startsWith(path.join(root, 'assets/scripts') + path.sep)) throw new Error('Module left the game script directory.');
    if (moduleCache.has(file)) return moduleCache.get(file).exports;
    const module = { exports: {} }; moduleCache.set(file, module);
    const source = ts.transpileModule(record(file), { fileName: file, reportDiagnostics: true,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, experimentalDecorators: true, useDefineForClassFields: false } });
    const errors = (source.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error);
    if (errors.length) throw new Error(errors.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')).join('\n'));
    win.eval(`(function(require,module,exports){${source.outputText}\n})\n//# sourceURL=${file}`)(next => loadModule(next, file), module, module.exports);
    return module.exports;
  }
  const { GameMain } = loadModule('./GameMain');
  const sceneData = win.JSON.parse(record(path.join(root, 'assets/Boot.scene')));
  cc.js._setClassId(sceneData[3].__type__, GameMain);
  const sceneAsset = cc.deserialize(sceneData);
  cc.director.runSceneImmediate(sceneAsset.scene);
  const tick = async (count = 1) => {
    for (let i = 0; i < count; i++) { cc.director.tick(1 / 60); await new Promise(resolve => setImmediate(resolve)); }
  };
  for (let i = 0; i < 80 && !win.__MONSTER_DEN__; i++) await tick();
  const api = win.__MONSTER_DEN__;
  assert.ok(api, 'Actual GameMain.start() did not finish and expose its ready API.');
  const controller = api.controller;
  assert.equal(sceneAsset.scene.getComponentInChildren(GameMain), controller);
  assert.equal(controller.page, 'home');
  const checkpoint = label => {
    const renderers = sceneAsset.scene.getComponentsInChildren(cc.MeshRenderer);
    const labels = sceneAsset.scene.getComponentsInChildren(cc.Label);
    const meshes = [...new Set(renderers.map(renderer => renderer.mesh).filter(Boolean))];
    const entry = { label, page: controller.page, room: api.model.state.roomIndex + 1, phase: api.model.state.phase,
      nodeMeshRenderers: renderers.length, uniqueMeshes: meshes.length, labels: labels.length,
      cameras: sceneAsset.scene.getComponentsInChildren(cc.Camera).length,
      loadedGameModules: moduleCache.size, liveMeshes: liveMeshes.size, totalCocosFrames: cc.director.getTotalFrames() };
    assert.ok(entry.nodeMeshRenderers > 10, `${label}: actual mesh hierarchy absent`);
    assert.ok(entry.labels > 3, `${label}: actual Cocos labels absent`);
    assert.equal(entry.cameras, 2, `${label}: missing 3D/UI camera`);
    for (const renderer of renderers) {
      assert.ok(renderer.mesh?.renderingSubMeshes.length, `Missing mesh: ${renderer.node.name}`);
      assert.ok(renderer.getMaterial(0)?.passes.length, `Missing material pass: ${renderer.node.name}`);
    }
    result.checkpoints.push(entry);
  };
  checkpoint('home loaded by actual async start lifecycle');
  assert.ok(Object.keys(controller.env.prefabs).length >= 8);
  assert.ok(Object.keys(controller.characters.prefabs).length >= 4);
  result.prefabs = { environment: Object.keys(controller.env.prefabs), characters: Object.keys(controller.characters.prefabs) };
  function clickLabel(text) {
    const label = sceneAsset.scene.getComponentsInChildren(cc.Label).find(label => label.string === text && label.node.activeInHierarchy);
    assert.ok(label, `UI label not found: ${text}`);
    label.node.parent.emit(cc.Node.EventType.TOUCH_END, { propagationStopped: false });
  }
  clickLabel('潜入怪物窝'); await tick(3);
  assert.equal(controller.page, 'game');
  checkpoint('home button entered first room');
  const playerBefore = { x: api.model.state.player.x, y: api.model.state.player.y };
  function mouse(type, x, y) {
    const names = { [cc.Input.EventType.MOUSE_DOWN]: 'mousedown', [cc.Input.EventType.MOUSE_MOVE]: 'mousemove', [cc.Input.EventType.MOUSE_UP]: 'mouseup' };
    const event = new win.MouseEvent(names[type], { bubbles: true, cancelable: true, clientX: x, clientY: 1280 - y,
      button: 0, buttons: type === cc.Input.EventType.MOUSE_UP ? 0 : 1 });
    win.document.getElementById('GameCanvas').dispatchEvent(event);
  }
  mouse(cc.Input.EventType.MOUSE_DOWN, 360, 560);
  mouse(cc.Input.EventType.MOUSE_MOVE, 360, 395);
  result.inputFixture = { dragging: controller.dragging, dragPower: controller.dragPower, height: controller.height,
    scaleX: cc.view.getScaleX(), scaleY: cc.view.getScaleY(), visibleSize: cc.view.getVisibleSize(),
    mouseSupported: cc.sys.hasFeature(cc.sys.Feature.EVENT_MOUSE), overlayChildren: controller.overlay.children.length,
    dragStart: { x: controller.dragStart.x, y: controller.dragStart.y }, dragNow: { x: controller.dragNow.x, y: controller.dragNow.y } };
  assert.ok(controller.dragging && controller.dragPower > .95, 'Controller input did not build a full-power aim.');
  assert.ok(controller.aimNodes.some(node => node.active), 'Native aim mesh nodes were not shown.');
  mouse(cc.Input.EventType.MOUSE_UP, 360, 395);
  assert.equal(api.model.state.shots, 1);
  const phases = new Set();
  for (let i = 0; i < 420; i++) { await tick(); phases.add(api.model.state.phase); if (i > 30 && api.model.state.phase === 'aiming') break; }
  assert.ok(Math.hypot(api.model.state.player.x - playerBefore.x, api.model.state.player.y - playerBefore.y) > .5, 'Real shot did not advance the player.');
  assert.ok(api.model.state.obstacles.find(obstacle => obstacle.kind === 'board').destroyed, 'First-room shot did not run the board collision branch.');
  result.realInputShot = { accepted: true, observedPhases: [...phases], shots: api.model.state.shots,
    movedDistance: Math.hypot(api.model.state.player.x - playerBefore.x, api.model.state.player.y - playerBefore.y), boardDestroyed: true };
  checkpoint('controller mouse aim, launch, board break, and return to aiming');
  // Use the authored core-test route, with the UI's actual minimum drag power.
  // This establishes controller/render integration, not human fun or balance.
  const routes = [
    [[0, 1.6, 1], [0, 5.6]],
    [[0, 3, 1], [-1.4, -2.5], [-1.4, 4.5], [0, 4.2], [2.9, 5.7]],
    [[0, -3], [0, 3, 1], [3, 3.6], [3, 5.8]],
    [[2, -4], [4.1, 1], [4.1, 4.5], [3.6, 4.5], [-3.5, 5.7]],
    [[3.8, -4], [4.2, 2], [2, 3.8], [0, 3.8], [0, 5.9]],
  ];
  result.route = { source: 'Documented 21-shot core regression route; all drag powers at least 11%', rooms: [] };
  for (let room = 0; room < 5; room++) {
    assert.equal(api.model.state.roomIndex, room);
    checkpoint(`room ${room + 1} actual scene, enemy prefabs and animation update`);
    for (const [targetX, targetY, explicitPower] of room === 0 ? routes[room].slice(1) : routes[room]) {
      assert.equal(api.model.state.phase, 'aiming');
      const player = api.model.state.player, dx = targetX - player.x, dy = targetY - player.y;
      const distance = Math.hypot(dx, dy), drag = 1.36 * (player.tool === 'heavy' ? 1.07 : 1), multiplier = player.tool === 'heavy' ? .96 : 1;
      const power = explicitPower ?? Math.max(.11, Math.min(1, ((distance + .17) * drag / 1.006 / multiplier - 1.9) / 10.9));
      const projectedY = dy * Math.sin(Math.atan2(24, 10)), projectedLength = Math.hypot(dx, projectedY);
      const before = api.model.state.shots;
      mouse(cc.Input.EventType.MOUSE_DOWN, 360, 560);
      mouse(cc.Input.EventType.MOUSE_MOVE, 360 - dx / projectedLength * power * 165, 560 - projectedY / projectedLength * power * 165);
      mouse(cc.Input.EventType.MOUSE_UP, 360 - dx / projectedLength * power * 165, 560 - projectedY / projectedLength * power * 165);
      assert.equal(api.model.state.shots, before + 1, `Room ${room + 1}: DOM drag was not accepted`);
      for (let frame = 0; frame < 1200; frame++) {
        await tick();
        if (['aiming', 'room_clear', 'victory', 'game_over'].includes(api.model.state.phase)) break;
      }
    }
    assert.equal(api.model.state.phase, room === 4 ? 'victory' : 'room_clear');
    assert.ok(api.model.state.enemies.some(enemy => enemy.alive));
    result.route.rooms.push({ room: room + 1, phase: api.model.state.phase, shots: api.model.state.shots,
      hp: api.model.state.player.hp, score: api.model.state.score, livingEnemies: api.model.state.enemies.filter(enemy => enemy.alive).length });
    if (room < 4) { clickLabel('重撞拳套'); await tick(3); }
  }
  assert.equal(api.model.state.shots, 21);
  assert.equal(api.model.state.rescuesUsed, 0);
  checkpoint('victory settlement UI reached by 21 actual controller shots');
  const beforeBonus = controller.save.read().progress.coins;
  clickLabel('看视频 · 加领金币'); await tick(3);
  assert.equal(controller.save.read().progress.coins, beforeBonus, 'Unavailable web ad must not award currency.');
  assert.equal(controller.adBusy, false, 'Unavailable ad must release pause state.');
  result.unavailableAd = { grantedNoReward: true, pauseReleased: true };
  const oldRunId = `diagnostic-previous-${controller.runId}`;
  const oldReceipt = controller.save.createPendingReward({ id: 'diagnostic-previous-reward', runId: oldRunId,
    placement: 'settlement_bonus', source: 'test' });
  assert.equal(oldReceipt.ok, true);
  const currentSnapshot = JSON.stringify(controller.save.getSnapshot());
  controller.applyReceipt(oldReceipt.receipt.id, 'settlement_bonus', controller.runId);
  controller.applyReceipt(oldReceipt.receipt.id, 'settlement_bonus', oldRunId);
  assert.equal(controller.save.read().progress.coins, beforeBonus, 'A previous-run receipt must not change the current wallet.');
  assert.equal(JSON.stringify(controller.save.getSnapshot()), currentSnapshot, 'A previous-run receipt must not mutate the current snapshot.');
  assert.equal(controller.save.getReward(oldRunId, 'settlement_bonus').status, 'pending', 'A rejected receipt must not be marked applied.');
  result.boundaries = { previousRunReceipt: { source: 'test fixture, no actual advertisement',
    walletUnchanged: true, snapshotUnchanged: true, receiptNotApplied: true } };
  clickLabel('回到营地'); await tick(2);
  clickLabel('查看冒险结算'); await tick(2);
  assert.equal(api.model.state.phase, 'victory');
  assert.equal(controller.save.read().progress.coins, beforeBonus, 'Reopening victory settlement must not pay the base score twice.');
  result.boundaries.terminalRestore = { victoryReopened: true, baseScoreNotPaidTwice: true };
  clickLabel('回到营地'); await tick(2);
  clickLabel('工具柜'); await tick(2);
  assert.equal(controller.page, 'tools');
  checkpoint('tool cabinet UI rendered');
  clickLabel('回到营地'); await tick(2);
  api.start(); await tick(2);
  assert.equal(api.model.state.roomIndex, 0);
  const death = api.model.snapshot(); death.state.phase = 'game_over'; death.state.player.hp = 0;
  api.model.restore(death); await tick(2);
  checkpoint('game-over UI via explicit terminal-state fixture');
  clickLabel('看视频 · 救援一次'); await tick(2);
  assert.equal(api.model.state.phase, 'game_over');
  assert.equal(api.model.state.rescuesUsed, 0);
  api.save(); controller.showHome(); await tick(1);
  clickLabel('查看冒险结算'); await tick(2);
  assert.equal(api.model.state.phase, 'game_over');
  assert.ok(sceneAsset.scene.getComponentsInChildren(cc.Label).some(label => label.string === '看视频 · 救援一次'));
  result.boundaries.terminalRestore.unsettledFailureReopened = true;
  const malformed = controller.save.saveSnapshot('diagnostic-bad-model', win.JSON.parse(JSON.stringify(
    { model: { version: 1, state: { version: 1, roomIndex: 999 }, runtime: {} }, bonus: 0, settled: false, bankedRooms: 0 })));
  assert.equal(malformed.ok, true, 'Malformed inner game data is deliberately stored in a valid save envelope.');
  const warningCount = result.warnings.length;
  controller.restoreRun(); controller.showHome(); await tick(1);
  const recoveryWarnings = result.warnings.splice(warningCount);
  assert.equal(recoveryWarnings.length, 1);
  assert.ok(recoveryWarnings[0].startsWith('Run restore failed'));
  result.expectedWarnings = recoveryWarnings;
  assert.equal(controller.save.getSnapshot(), null, 'Corrupt inner snapshot must be cleared.');
  assert.equal(api.model.state.roomIndex, 0);
  assert.equal(api.model.state.phase, 'aiming');
  assert.equal(controller.page, 'home');
  assert.notEqual(controller.runId, 'diagnostic-bad-model');
  assert.equal(win.__monsterDenRuntime.errors.length, 0, 'Save corruption must not become an asset-load failure.');
  clickLabel('潜入怪物窝'); await tick(2);
  assert.equal(controller.page, 'game');
  result.boundaries.corruptInnerSnapshot = { cleared: true, returnedToHome: true, newRunAccepted: true,
    assetFailureNotReported: true, expectedRecoveryWarning: true };
  result.save = { backend: controller.save.storage?.kind || 'DOM localStorage fixture',
    stored: win.localStorage.getItem('monster-den.save.v1') !== null };
  assert.equal(result.save.stored, true);
  cc.game.emit(cc.Game.EVENT_HIDE); await tick(1);
  assert.equal(controller.background, true);
  cc.game.emit(cc.Game.EVENT_SHOW); await tick(1);
  assert.equal(controller.background, false);
  result.visibilityLifecycle = { hidden: true, resumed: true };
  const completedFrames = cc.director.getTotalFrames();
  sceneAsset.scene.destroy(); await tick(2);
  result.teardown = { destroyed: !controller.isValid, frames: completedFrames };
  assert.equal(result.teardown.destroyed, true);
  result.meshLifecycle = { initialized: initializedMeshes.size, liveAfterSceneDestroy: liveMeshes.size,
    instrumentation: 'Counters wrap Mesh.initialize/destroy and call the original implementations without changing behavior.' };
  assert.equal(liveMeshes.size, 0, 'Runtime-created mesh buffers must be released when the owning scene is destroyed.');
  assert.equal(win.__monsterDenRuntime.errors.length, 0);
  assert.equal(result.errors.length, 0, result.errors.join('\n'));
  result.passed = true;
})().catch(error => {
  result.passed = false; result.failure = error.stack || String(error); process.exitCode = 1;
}).finally(() => {
  try { cc?.game.pause(); } catch { /* preserve original failure */ }
  dom?.window.close();
  process.off('unhandledRejection', onUnhandled);
  fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(result, null, 2));
  const { sourceFiles, ...brief } = result;
  console.log(JSON.stringify({ ...brief, sourceFileCount: Object.keys(sourceFiles).length, report: '.build/game-headless/result.json' }, null, 2));
});

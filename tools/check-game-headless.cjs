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
  testMethod: 'Unmodified GameMain/core/platform/model code; Cocos lifecycle ticks; DOM/canvas host fixture. EmptyDevice is the only compiled graphics backend, selected by the official WebGL fallback so screen adaptation remains testable (HEADLESS mode intentionally reports 1x1). Five rooms use the documented 21-shot route through the rendered fixed joystick and real DOM mouse input; a separate new run collects the second-room optional stash, then uses grip and immediately relaunches to verify phase-bound guidance. UI choices use the actual Cocos button TOUCH_END handlers. Only the separate game-over UI branch uses a controlled snapshot.',
  errors: [], warnings: [], checkpoints: [], sourceFiles: {}, assetRequests: [] };
const record = file => {
  const buffer = fs.readFileSync(file);
  result.sourceFiles[path.relative(root, file)] = { bytes: buffer.length, sha256: crypto.createHash('sha256').update(buffer).digest('hex') };
  return buffer.toString('utf8');
};
function joystickEndpoint(input, dx, dy, power) {
  const { deadZone, travel } = input.joystickTuning;
  const projectedY = dy * input.groundProjection, length = Math.hypot(dx, projectedY);
  assert.ok(length > 0, 'A joystick shot requires a nonzero direction.');
  const radius = deadZone + power * (travel - deadZone);
  const wanted = { x: dx / length * radius, y: projectedY / length * radius };
  const raw = { x: input.x + wanted.x * input.pixelX, y: input.y - wanted.y * input.pixelY };
  // MouseEvent client coordinates in this DOM host are integer CSS pixels.
  // Choose the closest reachable point and verify its actual expected power.
  const candidates = [];
  for (const x of new Set([Math.floor(raw.x), Math.ceil(raw.x)])) {
    for (const y of new Set([Math.floor(raw.y), Math.ceil(raw.y)])) {
      const local = { x: (x - input.x) / input.pixelX, y: (input.y - y) / input.pixelY };
      const distance = Math.hypot(local.x, local.y);
      if (distance <= deadZone || (power === 1 && distance < travel)) continue;
      candidates.push({ x, y, effectivePower: Math.min(1, (distance - deadZone) / (travel - deadZone)),
        error: Math.hypot(local.x - wanted.x, local.y - wanted.y) });
    }
  }
  candidates.sort((a, b) => a.error - b.error);
  assert.ok(candidates.length, 'No reachable CSS point could engage the requested joystick direction.');
  return candidates[0];
}
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
  const initializedMeshes = new Set(), liveMeshes = new Set(), meshOrigins = new Map(), meshOwners = new Map();
  const initializeMesh = cc.Mesh.prototype.initialize, destroyMesh = cc.Mesh.prototype.destroy;
  cc.Mesh.prototype.initialize = function (...args) {
    initializedMeshes.add(this); liveMeshes.add(this);
    if (!meshOrigins.has(this)) meshOrigins.set(this, { name: this.name, uuid: this.uuid || this._uuid,
      initializedAtFrame: cc.director.getTotalFrames(), initializeStack: new Error('Mesh initialization source').stack });
    return initializeMesh.apply(this, args);
  };
  cc.Mesh.prototype.destroy = function (...args) {
    const destroyed = destroyMesh.apply(this, args);
    if (destroyed !== false) liveMeshes.delete(this);
    return destroyed;
  };
  const rendererMesh = Object.getOwnPropertyDescriptor(cc.MeshRenderer.prototype, 'mesh');
  assert.ok(rendererMesh?.get && rendererMesh?.set && rendererMesh.configurable, 'Mesh ownership diagnostics require the actual renderer mesh accessor.');
  Object.defineProperty(cc.MeshRenderer.prototype, 'mesh', { ...rendererMesh, set(mesh) {
    if (mesh) {
      let owners = meshOwners.get(mesh); if (!owners) { owners = new Map(); meshOwners.set(mesh, owners); }
      if (!owners.has(this.node)) owners.set(this.node, { name: this.node?.name, uuid: this.node?.uuid,
        assignedAtFrame: cc.director.getTotalFrames(), assignmentStack: new Error('Mesh renderer assignment source').stack });
    }
    rendererMesh.set.call(this, mesh);
  } });
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
  const toolNames = { none: '工具未携带', heavy: '重撞拳套', grip: '抓停重瞄', return: '回旋折返' };
  function presentation() {
    return { phase: api.model.state.phase, tool: api.model.state.player.tool,
      toolName: controller.toolNameLabel?.string, toolStatus: controller.toolStatusLabel?.string,
      toolNameVisible: !!controller.toolNameLabel?.node?.activeInHierarchy,
      tutorialText: controller.tutorialText?.string, topHint: controller.hintLabel?.string,
      objective: controller.objectiveLabel?.string,
      objectiveVisible: !!controller.objectiveLabel?.node.activeInHierarchy,
      exitRingActive: !!controller.exitRing?.active, treasureTaken: api.model.state.treasure.taken };
  }
  function assertToolName(value, label) {
    assert.equal(value.toolName, toolNames[value.tool], `${label}: tool name changed with its phase.`);
    assert.equal(value.toolNameVisible, true, `${label}: tool name is hidden.`);
  }
  function assertDragGuidance(value, label) {
    assert.equal(value.dragging, true, `${label}: joystick is not being held.`);
    assert.match(value.tutorialText, /回中[\s\S]*取消/, `${label}: recenter/cancel instruction disappeared.`);
    assertToolName(value, label);
  }
  function observeToolPhase(phases, label) {
    const value = presentation(); assertToolName(value, label);
    phases.set(`${value.phase}:${value.toolStatus}`, { phase: value.phase, tool: value.tool,
      name: value.toolName, status: value.toolStatus, visible: value.toolNameVisible });
  }
  const checkpoint = label => {
    const renderers = sceneAsset.scene.getComponentsInChildren(cc.MeshRenderer);
    const labels = sceneAsset.scene.getComponentsInChildren(cc.Label);
    const meshes = [...new Set(renderers.map(renderer => renderer.mesh).filter(Boolean))];
    const entry = { label, page: controller.page, room: api.model.state.roomIndex + 1, phase: api.model.state.phase,
      nodeMeshRenderers: renderers.length, uniqueMeshes: meshes.length, labels: labels.length,
      activeMeshRenderers: renderers.filter(renderer => renderer.node.activeInHierarchy).length,
      homeActorVisible: controller.homeActor?.instance.root.activeInHierarchy,
      heroVisible: controller.hero?.instance.root.activeInHierarchy,
      cameras: sceneAsset.scene.getComponentsInChildren(cc.Camera).length,
      presentation: presentation(), stashCount: api.model.state.stashCount, stashValue: api.model.state.stashValue,
      loadedGameModules: moduleCache.size, liveMeshes: liveMeshes.size, totalCocosFrames: cc.director.getTotalFrames() };
    assert.ok(entry.nodeMeshRenderers > 10, `${label}: actual mesh hierarchy absent`);
    assert.ok(entry.labels > 3, `${label}: actual Cocos labels absent`);
    assert.equal(entry.cameras, 2, `${label}: missing 3D/UI camera`);
    if (controller.page === 'home' || controller.page === 'game') {
      assert.ok(entry.activeMeshRenderers > 10, `${label}: visible mesh hierarchy absent`);
      assert.equal(controller.page === 'home' ? entry.homeActorVisible : entry.heroVisible, true,
        `${label}: expected showcase/gameplay hero is hidden`);
    }
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
    const matches = label => label.string === text && label.node.activeInHierarchy;
    const overlayLabels = controller.overlay.children.length ? controller.overlay.getComponentsInChildren(cc.Label) : [];
    const label = overlayLabels.find(matches) || sceneAsset.scene.getComponentsInChildren(cc.Label).find(matches);
    assert.ok(label, `UI label not found: ${text}`);
    label.node.parent.emit(cc.Node.EventType.TOUCH_END, { propagationStopped: false });
  }
  clickLabel('潜入怪物窝'); await tick(3);
  assert.equal(controller.page, 'game');
  checkpoint('home button entered first room');
  result.firstSession = { initial: presentation() };
  assert.equal(result.firstSession.initial.objective, '撞开木栏');
  assert.equal(result.firstSession.initial.treasureTaken, false);
  assert.equal(result.firstSession.initial.exitRingActive, false, 'Exit must remain dark before the main treasure is taken.');
  assertToolName(result.firstSession.initial, 'Initial room');
  const playerBefore = { x: api.model.state.player.x, y: api.model.state.player.y };
  function mouse(type, x, y, button = 0) {
    const names = { [cc.Input.EventType.MOUSE_DOWN]: 'mousedown', [cc.Input.EventType.MOUSE_MOVE]: 'mousemove', [cc.Input.EventType.MOUSE_UP]: 'mouseup' };
    const event = new win.MouseEvent(names[type], { bubbles: true, cancelable: true, clientX: x, clientY: y,
      button, buttons: type === cc.Input.EventType.MOUSE_UP ? 0 : button === 1 ? 4 : button === 2 ? 2 : 1 });
    win.document.getElementById('GameCanvas').dispatchEvent(event);
  }
  function inputGeometry() {
    assert.ok(controller.stick?.root.activeInHierarchy, 'Visible fixed joystick is missing.');
    const canvas = win.document.getElementById('GameCanvas'), rect = canvas.getBoundingClientRect();
    // EmptyDevice has no finite render-camera projection. Derive this DOM
    // host fixture's CSS coordinates from the actual drawn UI node and view
    // adaptation; the WebGL browser check uses its real UI camera instead.
    const visible = cc.view.getVisibleSize();
    const center = { x: (controller.stick.root.position.x + visible.width / 2) * cc.view.getScaleX(),
      y: (controller.stick.root.position.y + visible.height / 2) * cc.view.getScaleY() };
    return { x: rect.left + center.x / canvas.width * rect.width, y: rect.bottom - center.y / canvas.height * rect.height,
      coordinateSource: 'Actual joystick UI-node position and Cocos view scale; EmptyDevice cannot project a render camera',
      pixelX: cc.view.getScaleX() * rect.width / canvas.width, pixelY: cc.view.getScaleY() * rect.height / canvas.height,
      groundProjection: controller.groundProjection, joystickTuning: { ...controller.joystickTuning },
      gameplayTuning: { ...controller.gameplayTuning }, rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } };
  }
  function inputState() {
    return { ...presentation(), dragging: controller.dragging, power: controller.dragPower, shots: api.model.state.shots,
      visibleDots: controller.aimNodes.filter(node => node.active).length,
      aim: { x: controller.lastAim.x, y: controller.lastAim.y },
      thumb: { x: controller.stick.thumb.position.x, y: controller.stick.thumb.position.y } };
  }
  async function fireTarget(targetX, targetY, explicitPower, shotLog) {
    const room = api.model.state.roomIndex + 1;
    assert.equal(api.model.state.phase, 'aiming');
    const player = api.model.state.player, dx = targetX - player.x, dy = targetY - player.y;
    const input = inputGeometry(), tuning = input.gameplayTuning;
    const distance = Math.hypot(dx, dy), drag = tuning.drag * (player.tool === 'heavy' ? 1.07 : 1), multiplier = player.tool === 'heavy' ? .96 : 1;
    const power = explicitPower ?? Math.max(.01, Math.min(1, ((distance + .17) * drag / 1.006 / multiplier - tuning.launchMin) / (tuning.launchMax - tuning.launchMin)));
    const end = joystickEndpoint(input, dx, dy, power), before = api.model.state.shots;
    const phases = new Map(); observeToolPhase(phases, `Room ${room} before aiming`);
    mouse(cc.Input.EventType.MOUSE_DOWN, input.x, input.y);
    mouse(cc.Input.EventType.MOUSE_MOVE, end.x, end.y); await tick(2);
    const aim = inputState(); assertDragGuidance(aim, `Room ${room} shot ${before + 1} aim`);
    assert.ok(controller.dragging && controller.aimNodes.some(node => node.active) && Math.abs(controller.dragPower - end.effectivePower) < .015,
      `Room ${room}: joystick did not produce expected power: ${JSON.stringify({ requested: power, actual: controller.dragPower, end })}`);
    const effectivePower = controller.dragPower;
    mouse(cc.Input.EventType.MOUSE_UP, end.x, end.y);
    assert.equal(api.model.state.shots, before + 1, `Room ${room}: DOM joystick push was not accepted`);
    for (let frame = 0; frame < 1200; frame++) {
      await tick(); observeToolPhase(phases, `Room ${room} shot ${before + 1}`);
      if (['aiming', 'room_clear', 'victory', 'game_over'].includes(api.model.state.phase)) break;
    }
    assert.ok(['aiming', 'room_clear', 'victory'].includes(api.model.state.phase), `Room ${room}: shot failed to return control.`);
    shotLog.push({ room, shot: api.model.state.shots, target: { x: targetX, y: targetY }, power,
      effectivePower, pointer: end, cancelHint: aim.tutorialText, toolPhases: [...phases.values()],
      phase: api.model.state.phase, hp: api.model.state.player.hp, score: api.model.state.score,
      stashCount: api.model.state.stashCount, stashValue: api.model.state.stashValue,
      player: { x: api.model.state.player.x, y: api.model.state.player.y } });
  }
  const input = inputGeometry(), { deadZone, travel } = input.joystickTuning;
  assert.ok(Number.isFinite(input.x) && Number.isFinite(input.y) && deadZone > 0 && travel > deadZone && input.groundProjection > 0,
    `Invalid fixed joystick geometry: ${JSON.stringify(input)}`);
  const assertIdle = async label => {
    await tick(3);
    const state = inputState();
    assert.equal(state.shots, 0, `${label} launched a shot.`);
    assert.equal(state.dragging, false, `${label} left the joystick held.`);
    assert.equal(state.visibleDots, 0, `${label} left aim meshes visible.`);
    return state;
  };
  mouse(cc.Input.EventType.MOUSE_DOWN, input.x, input.y);
  mouse(cc.Input.EventType.MOUSE_UP, input.x, input.y);
  const centerTap = await assertIdle('Joystick center tap');
  mouse(cc.Input.EventType.MOUSE_DOWN, input.x, input.y);
  mouse(cc.Input.EventType.MOUSE_MOVE, input.x + deadZone * .5 * input.pixelX, input.y);
  await tick(2);
  const insideDeadZone = inputState();
  assert.equal(insideDeadZone.power, 0); assert.equal(insideDeadZone.visibleDots, 0);
  assertDragGuidance(insideDeadZone, 'Sub-dead-zone aim');
  mouse(cc.Input.EventType.MOUSE_UP, input.x + deadZone * .5 * input.pixelX, input.y);
  const deadZoneRelease = await assertIdle('Sub-dead-zone release');
  mouse(cc.Input.EventType.MOUSE_DOWN, input.x, input.y);
  mouse(cc.Input.EventType.MOUSE_MOVE, input.x, input.y - travel * input.pixelY);
  await tick(2);
  const pushed = inputState();
  assert.ok(pushed.dragging && pushed.power > .98 && pushed.visibleDots > 0,
    `Joystick did not engage before recentering: ${JSON.stringify({ input, pushed })}`);
  assertDragGuidance(pushed, 'Engaged aim before recentering');
  mouse(cc.Input.EventType.MOUSE_MOVE, input.x, input.y); await tick(2);
  const recentered = inputState();
  assert.equal(recentered.power, 0); assert.equal(recentered.visibleDots, 0);
  assertDragGuidance(recentered, 'Recentered aim');
  mouse(cc.Input.EventType.MOUSE_UP, input.x, input.y);
  const recenterRelease = await assertIdle('Recentered joystick release');
  const scenePoint = { x: input.rect.x + input.rect.width * .5, y: input.rect.y + input.rect.height * .42 };
  mouse(cc.Input.EventType.MOUSE_DOWN, scenePoint.x, scenePoint.y);
  mouse(cc.Input.EventType.MOUSE_MOVE, input.x, input.y - travel * input.pixelY); await tick(2);
  const outsideStart = inputState();
  assert.equal(outsideStart.dragging, false, 'A scene-origin gesture must not acquire the joystick after moving over it.');
  mouse(cc.Input.EventType.MOUSE_UP, input.x, input.y - travel * input.pixelY);
  const sceneRelease = await assertIdle('Scene-origin drag');
  const nonPrimaryButtons = [];
  for (const [name, button] of [['right', 2], ['middle', 1]]) {
    mouse(cc.Input.EventType.MOUSE_DOWN, input.x, input.y, button); await tick(2);
    const pressed = inputState();
    assert.equal(pressed.dragging, false, `${name} mouse button started a joystick gesture: ${JSON.stringify(pressed)}`);
    mouse(cc.Input.EventType.MOUSE_MOVE, input.x, input.y - travel * input.pixelY, button); await tick(2);
    const moved = inputState();
    assert.ok(!moved.dragging && moved.power === 0 && moved.visibleDots === 0 && moved.shots === 0,
      `${name} mouse drag changed the aim: ${JSON.stringify(moved)}`);
    mouse(cc.Input.EventType.MOUSE_UP, input.x, input.y - travel * input.pixelY, button);
    const released = await assertIdle(`${name} mouse button release`);
    nonPrimaryButtons.push({ button: name, cannotAimOrLaunch: true, pressed, moved, released });
  }
  result.joystickBoundaries = { method: 'DOM MouseEvent through Cocos input; EmptyDevice host fixture', input,
    centerTapDoesNotLaunch: true, deadZoneDoesNotLaunch: true, recenterCancels: true, sceneStartRejected: true,
    nonPrimaryButtons,
    evidence: { centerTap, insideDeadZone, deadZoneRelease, pushed, recentered, recenterRelease, outsideStart, sceneRelease } };
  mouse(cc.Input.EventType.MOUSE_DOWN, input.x, input.y);
  mouse(cc.Input.EventType.MOUSE_MOVE, input.x, input.y - travel * input.pixelY);
  await tick(2);
  const firstAim = inputState(); assertDragGuidance(firstAim, 'First actual shot aim');
  result.inputFixture = { dragging: controller.dragging, dragPower: controller.dragPower, height: controller.height,
    scaleX: cc.view.getScaleX(), scaleY: cc.view.getScaleY(), visibleSize: cc.view.getVisibleSize(),
    joystick: input,
    mouseSupported: cc.sys.hasFeature(cc.sys.Feature.EVENT_MOUSE), overlayChildren: controller.overlay.children.length,
    dragStart: { x: controller.dragStart.x, y: controller.dragStart.y }, dragNow: { x: controller.dragNow.x, y: controller.dragNow.y } };
  assert.ok(controller.dragging && controller.dragPower > .95, 'Controller input did not build a full-power aim.');
  assert.ok(controller.aimNodes.some(node => node.active), 'Native aim mesh nodes were not shown.');
  mouse(cc.Input.EventType.MOUSE_UP, input.x, input.y - travel * input.pixelY);
  assert.equal(api.model.state.shots, 1);
  const phases = new Set(), firstToolPhases = new Map();
  for (let i = 0; i < 420; i++) {
    await tick(); phases.add(api.model.state.phase); observeToolPhase(firstToolPhases, 'First actual shot');
    if (i > 30 && api.model.state.phase === 'aiming') break;
  }
  assert.ok(Math.hypot(api.model.state.player.x - playerBefore.x, api.model.state.player.y - playerBefore.y) > .5, 'Real shot did not advance the player.');
  assert.ok(api.model.state.obstacles.find(obstacle => obstacle.kind === 'board').destroyed, 'First-room shot did not run the board collision branch.');
  result.realInputShot = { accepted: true, observedPhases: [...phases], shots: api.model.state.shots,
    movedDistance: Math.hypot(api.model.state.player.x - playerBefore.x, api.model.state.player.y - playerBefore.y), boardDestroyed: true };
  result.firstSession.afterFirstShot = presentation();
  assert.equal(result.firstSession.afterFirstShot.treasureTaken, true);
  assert.equal(result.firstSession.afterFirstShot.objective, '前往出口');
  assert.equal(result.firstSession.afterFirstShot.exitRingActive, true, 'Collecting the main treasure must light the exit.');
  checkpoint('controller fixed joystick aim, launch, board break, and return to aiming');
  // Use the authored core-test route with current launch tuning and fine joystick travel.
  // This establishes controller/render integration, not human fun or balance.
  const routes = [
    [[0, 1.6, 1], [0, 5.6]],
    [[0, 3, 1], [-1.4, -2.5], [-1.4, 4.5], [0, 4.2], [2.9, 5.7]],
    [[0, -3], [0, 3, 1], [3, 3.6], [3, 5.8]],
    [[2, -4], [4.1, 1], [4.1, 4.5], [3.6, 4.5], [-3.5, 5.7]],
    [[3.8, -4], [4.2, 2], [2, 3.8], [0, 3.8], [0, 5.9]],
  ];
  result.route = { source: 'Documented 21-shot core regression route; fixed joystick power may be as low as 1%', rooms: [],
    shots: [{ room: 1, shot: 1, target: { x: 0, y: 1.6 }, power: 1, effectivePower: 1,
      cancelHint: firstAim.tutorialText, toolPhases: [...firstToolPhases.values()],
      phase: api.model.state.phase, hp: api.model.state.player.hp, score: api.model.state.score,
      stashCount: api.model.state.stashCount, stashValue: api.model.state.stashValue,
      player: { x: api.model.state.player.x, y: api.model.state.player.y } }] };
  for (let room = 0; room < 5; room++) {
    assert.equal(api.model.state.roomIndex, room);
    checkpoint(`room ${room + 1} actual scene, enemy prefabs and animation update`);
    for (const [targetX, targetY, explicitPower] of room === 0 ? routes[room].slice(1) : routes[room]) {
      await fireTarget(targetX, targetY, explicitPower, result.route.shots);
    }
    assert.equal(api.model.state.phase, room === 4 ? 'victory' : 'room_clear');
    assert.ok(api.model.state.enemies.some(enemy => enemy.alive));
    assert.equal(api.model.state.stashCount, 0, `Room ${room + 1}: optional stash was collected on the established main route.`);
    assert.equal(api.model.state.stashValue, 0);
    result.route.rooms.push({ room: room + 1, phase: api.model.state.phase, shots: api.model.state.shots,
      hp: api.model.state.player.hp, score: api.model.state.score, livingEnemies: api.model.state.enemies.filter(enemy => enemy.alive).length,
      stashCount: api.model.state.stashCount, stashValue: api.model.state.stashValue });
    if (room < 4) { clickLabel('重撞拳套'); await tick(3); }
  }
  assert.equal(api.model.state.shots, 21);
  assert.equal(result.route.shots.length, 21);
  assert.equal(api.model.state.rescuesUsed, 0);
  result.firstSession.everyMainRouteAimShowsCancel = result.route.shots.every(shot => /回中[\s\S]*取消/.test(shot.cancelHint));
  assert.equal(result.firstSession.everyMainRouteAimShowsCancel, true);
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
  // This fresh run was entered by the real home button above. Do not inject
  // a room or collected state: reach the extra reward through DOM input.
  result.optionalStashRoute = { method: 'Fresh run via home UI, two first-room shots, heavy tool-card choice, six second-room DOM joystick shots', shots: [] };
  for (const [x, y, power] of routes[0]) await fireTarget(x, y, power, result.optionalStashRoute.shots);
  assert.equal(api.model.state.phase, 'room_clear');
  clickLabel('重撞拳套'); await tick(3);
  assert.equal(api.model.state.roomIndex, 1);
  const stash = api.model.state.stashes.find(item => item.id === 'store-side-stash');
  const stashVisual = controller.stashVisuals.get('store-side-stash');
  assert.ok(stash && !stash.taken && stashVisual?.instance.root.activeInHierarchy, 'Second-room stash model is missing.');
  assert.equal(stashVisual.label.string, '额外 +80');
  assert.equal(api.model.state.stashCount, 0);
  assert.equal(controller.exitRing.active, false);
  checkpoint('second room optional stash before collection');
  const stashRoute = [[0, 3, 1], [-3.85, -.4], [-1.4, -.4], [-1.4, 4.5], [0, 4.2], [2.9, 5.7]];
  for (let index = 0; index < stashRoute.length; index++) {
    const [x, y, power] = stashRoute[index]; await fireTarget(x, y, power, result.optionalStashRoute.shots);
    if (index === 1) {
      assert.equal(api.model.state.stashCount, 1); assert.equal(api.model.state.stashValue, 80);
      assert.equal(stash.taken, true); assert.equal(stashVisual.instance.root.active, false);
      assert.equal(stashVisual.label.node.active, false, 'Collected stash label must disappear.');
      assert.equal(api.model.state.treasure.taken, false, 'Optional stash must not substitute for the main treasure.');
      assert.equal(controller.exitRing.active, false, 'Optional stash must not light the main exit.');
      assert.equal(controller.objectiveLabel.string, '拿走宝物');
      result.optionalStashRoute.collected = { shot: api.model.state.shots, stashCount: api.model.state.stashCount,
        stashValue: api.model.state.stashValue, mainTreasureStillRequired: true, markerHidden: true };
    }
  }
  assert.equal(api.model.state.phase, 'room_clear'); assert.equal(api.model.state.shots, 8);
  assert.equal(api.model.state.stashCount, 1); assert.equal(api.model.state.stashValue, 80);
  assert.equal(api.model.state.rescuesUsed, 0);
  result.optionalStashRoute.completed = { phase: api.model.state.phase, shots: api.model.state.shots,
    hp: api.model.state.player.hp, score: api.model.state.score, stashCount: api.model.state.stashCount,
    stashValue: api.model.state.stashValue, rescuesUsed: api.model.state.rescuesUsed };
  checkpoint('second-room optional stash and main treasure carried through the exit');
  // Reproduce the short grip continuation while the 2.5-second stop message
  // would still be alive. Reach this room and tool through the actual card,
  // then use DOM joystick input and the real tool-button event handler.
  clickLabel('壁虎手套'); await tick(2);
  assert.equal(api.model.state.roomIndex, 2); assert.equal(api.model.state.player.tool, 'grip');
  assert.equal(api.model.state.phase, 'aiming');
  const gripPhases = new Map(); observeToolPhase(gripPhases, 'Grip regression initial aim');
  async function launchSideways(power, label) {
    const input = inputGeometry(), end = joystickEndpoint(input, 1, 0, power), before = api.model.state.shots;
    mouse(cc.Input.EventType.MOUSE_DOWN, input.x, input.y);
    mouse(cc.Input.EventType.MOUSE_MOVE, end.x, end.y); await tick(1);
    const aim = inputState(); assertDragGuidance(aim, label);
    assert.ok(Math.abs(aim.power - end.effectivePower) < .015, `${label}: joystick power did not match its CSS endpoint.`);
    mouse(cc.Input.EventType.MOUSE_UP, end.x, end.y);
    assert.equal(api.model.state.shots, before + 1); assert.equal(api.model.state.phase, 'moving');
    return { shot: api.model.state.shots, requestedPower: power, effectivePower: aim.power, pointer: end, cancelHint: aim.tutorialText };
  }
  const firstGripShot = await launchSideways(.15, 'Low-power sideways grip shot');
  await tick(1); observeToolPhase(gripPhases, 'Grip flight before tool activation');
  assert.equal(api.model.state.phase, 'moving'); assert.equal(api.model.state.player.toolReady, true);
  assert.equal(controller.toolStatusLabel.string, '现在可以点按');
  clickLabel('抓停重瞄'); await tick(1);
  assert.equal(api.model.state.phase, 'aiming'); assert.equal(api.model.state.player.toolReady, false);
  const stopped = presentation(), stoppedTurn = api.model.state.turn;
  observeToolPhase(gripPhases, 'Grip pause before immediate continuation');
  assert.match(stopped.topHint, /守卫暂不行动/, 'The regression must first display the actual grip-stop instruction.');
  const remainingTipSeconds = controller.tipTimer, stoppedAtFrame = cc.director.getTotalFrames();
  assert.ok(remainingTipSeconds > 2, 'The grip-stop instruction expired before its continuation could be tested.');
  const continuation = await launchSideways(.01, 'Immediate minimum-power grip continuation');
  let enemyPresentation;
  for (let frame = 0; frame < 300; frame++) {
    await tick(1); observeToolPhase(gripPhases, 'Grip continuation and enemy action');
    if (api.model.state.phase === 'enemies') { enemyPresentation = presentation(); break; }
  }
  assert.ok(enemyPresentation, 'The immediate grip continuation never entered the enemy phase.');
  const elapsedSeconds = (cc.director.getTotalFrames() - stoppedAtFrame) / 60;
  assert.ok(elapsedSeconds < remainingTipSeconds,
    'This regression must reach enemy action before the original grip hint would naturally time out.');
  assert.equal(api.model.state.turn, stoppedTurn, 'The grip continuation should remain part of the same turn.');
  assert.doesNotMatch(enemyPresentation.topHint, /守卫暂不行动/, 'The top hint falsely claims enemies are waiting while they act.');
  assert.doesNotMatch(enemyPresentation.tutorialText, /守卫暂不行动/, 'The lower instruction falsely claims enemies are waiting while they act.');
  assert.equal(enemyPresentation.toolName, '抓停重瞄');
  assert.equal(enemyPresentation.toolStatus, '等待敌人行动结束');
  for (let frame = 0; frame < 600 && api.model.state.phase === 'enemies'; frame++) {
    await tick(1); observeToolPhase(gripPhases, 'Grip regression enemy turn completion');
  }
  assert.equal(api.model.state.phase, 'aiming'); assert.equal(api.model.state.player.toolReady, true);
  assert.equal(controller.toolStatusLabel.string, '冲撞时可用');
  result.gripTipPhase = { method: 'Room-three grip chosen through the real tool card; DOM sideways joystick launch, Cocos tool-button TOUCH_END, immediate minimum-power DOM continuation. No state injection or direct tool API.',
    firstShot: firstGripShot, continuation, stopped, enemyPresentation,
    elapsedSeconds, originalHintSecondsRemaining: remainingTipSeconds,
    enemyPhaseReachedBeforeOriginalHintTimeout: true, stoppedHintRemovedDuringEnemies: true,
    sameTurnContinuation: true, toolPhases: [...gripPhases.values()], after: presentation() };
  checkpoint('grip immediate continuation clears the stopped-enemies hint before its timeout');
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
    unfreedMeshes: [...liveMeshes].map(mesh => ({ ...meshOrigins.get(mesh),
      owners: [...(meshOwners.get(mesh)?.values() || [])] })),
    instrumentation: 'Counters wrap Mesh.initialize/destroy; read-only creation stacks and renderer-mesh assignment metadata identify leaks. Every original method/accessor is called without changing its behavior.' };
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

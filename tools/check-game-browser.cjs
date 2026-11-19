#!/usr/bin/env node
/** Real Cocos browser acceptance. No EmptyDevice and no model-state shortcuts.
 * node tools/check-game-browser.cjs [https://your-preview.example/]
 * The default serves web/ locally. Run in a browser-capable host or CI.
 */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const requireRuntime = createRequire(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES || path.join(__dirname, '../node_modules'), 'playwright/package.json'));
const { chromium } = requireRuntime('playwright');
const root = path.resolve(__dirname, '..');
const web = path.join(root, 'web');
const output = path.join(root, '.build/game-browser');
fs.mkdirSync(output, { recursive: true });
const report = {
  test: 'Actual Cocos 3.8.8 WebGL, 21-shot main route, optional second-room stash route, persistent guidance/tool names, audio playback state and mobile touch ownership',
  method: 'Real browser frames and DOM mouse/CDP touch input. One explicitly marked DOM TouchEvent fixture checks isolated secondary-finger release, which CDP cannot express. A read-only after-update observer samples tool labels during actual shots. Game state is read for targeting and assertions, never rewritten to reach a room, reward or victory.',
  passed: false, audibleOutputValidation: false, phonePerformanceValidation: false,
  errors: [], consoleErrors: [], knownDiagnostics: [], warnings: [], failedRequests: [], checkpoints: [],
  route: { source: 'design/PLAYTEST.md; documented 21-shot route, current launch tuning and fixed joystick travel; fine power may be as low as 1%', rooms: [], shots: [] },
};
let server, browser, activePage;
// Cocos 3.8.8's official web touch adapter calls preventDefault for every
// canvas-target touch event, including a non-cancelable native touchcancel.
// Chromium reports this one ignored no-op as a console error. Scope the
// exception to our deliberate CDP cancellation, keep its full evidence, and
// require the cancel/relaunch behavioral checks before classifying it benign.
// Source: cocos-engine@3.8.8/pal/input/web/touch-input.ts, _createCallback.
const expectedTouchCancel = new WeakMap();
const TOUCH_CANCEL_INTERVENTION = 'Ignored attempt to cancel a touchcancel event with cancelable=false, for example because scrolling is in progress and cannot be interrupted.';
const routes = [
  [[0, 1.6, 1], [0, 5.6]],
  [[0, 3, 1], [-1.4, -2.5], [-1.4, 4.5], [0, 4.2], [2.9, 5.7]],
  [[0, -3], [0, 3, 1], [3, 3.6], [3, 5.8]],
  [[2, -4], [4.1, 1], [4.1, 4.5], [3.6, 4.5], [-3.5, 5.7]],
  [[3.8, -4], [4.2, 2], [2, 3.8], [0, 3.8], [0, 5.9]],
];
const toolNames = { none: '工具未携带', heavy: '重撞拳套', grip: '抓停重瞄', return: '回旋折返' };

function assertToolName(value, label) {
  assert.equal(value.toolName, toolNames[value.tool || value.player?.tool], `${label}: tool name changed with its phase.`);
  assert.equal(value.toolNameVisible, true, `${label}: tool name is hidden.`);
}

function assertDragGuidance(value, label) {
  assert.equal(value.dragging, true, `${label}: joystick is not being held.`);
  assert.match(value.tutorialText, /回中[\s\S]*取消/, `${label}: recenter/cancel instruction disappeared.`);
  assertToolName(value, label);
}

function joystickEndpoint(input, dx, dy, power) {
  const { deadZone, travel } = input.joystickTuning;
  const projectedY = dy * input.groundProjection, length = Math.hypot(dx, projectedY);
  assert.ok(length > 0, 'A joystick shot requires a nonzero direction.');
  const radius = deadZone + power * (travel - deadZone);
  const wanted = { x: dx / length * radius, y: projectedY / length * radius };
  const raw = { x: input.x + wanted.x * input.pixelX, y: input.y - wanted.y * input.pixelY };
  // Whole CSS pixels give the DOM fixture and browser a reproducible input.
  // Account for that quantization instead of asserting unavailable precision.
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

async function serve() {
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.scene': 'application/json', '.png': 'image/png', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };
  server = http.createServer((request, response) => {
    let relative;
    try { relative = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
    catch { response.writeHead(400); response.end(); return; }
    if (relative.endsWith('/')) relative += 'index.html';
    const file = path.resolve(web, '.' + relative);
    if (!file.startsWith(web + path.sep)) { response.writeHead(403); response.end(); return; }
    fs.readFile(file, (error, buffer) => {
      if (error) { response.writeHead(404); response.end(); return; }
      response.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
      response.end(buffer);
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${server.address().port}/`;
}

function observe(page, scope) {
  page.setDefaultTimeout(45000);
  page.on('pageerror', error => report.errors.push({ scope, message: error.stack || String(error) }));
  page.on('console', message => {
    if (message.location().url?.endsWith('/favicon.ico')) return;
    const entry = { scope, message: message.text(), location: message.location() };
    if (message.type() === 'error') {
      const expected = expectedTouchCancel.get(page);
      const knownSource = entry.location.url?.endsWith('/vendor/cocos-3.8.8.js')
        && new URL(entry.location.url).origin === new URL(page.url()).origin;
      if (expected && expected.entries.length === 0 && scope === 'mobile-390x844-dpr2'
        && knownSource && entry.message === TOUCH_CANCEL_INTERVENTION) {
        const diagnostic = { ...entry, originalSeverity: 'error', behaviorVerified: false,
          reason: 'Official Cocos 3.8.8 web adapter calls preventDefault on our deliberately dispatched non-cancelable native touchcancel; Chromium ignores that no-op.',
          source: 'cocos-engine@3.8.8/pal/input/web/touch-input.ts:_createCallback',
          trigger: 'CDP Input.dispatchTouchEvent(type=touchCancel, touchPoints=[])' };
        expected.entries.push(diagnostic); report.knownDiagnostics.push(diagnostic);
      } else report.consoleErrors.push(entry);
    }
    else if (message.type() === 'warning') report.warnings.push(entry);
  });
  page.on('response', response => {
    if (response.status() >= 400 && !response.url().endsWith('/favicon.ico')) report.failedRequests.push({ scope, url: response.url(), status: response.status() });
  });
  page.on('requestfailed', request => report.failedRequests.push({ scope, url: request.url(), error: request.failure()?.errorText }));
}

async function afterFrames(page, count = 3) {
  const before = await page.evaluate(() => window.cc?.director.getTotalFrames() || 0);
  await page.waitForFunction(({ before, count }) => (window.cc?.director.getTotalFrames() || 0) >= before + count, { before, count });
}

async function ready(page) {
  await page.waitForFunction(() => window.__MONSTER_DEN__ || window.__monsterDenRuntime?.errors?.length, undefined, { timeout: 90000 });
  const errors = await page.evaluate(() => window.__monsterDenRuntime?.errors || []);
  assert.equal(errors.length, 0, errors.join('\n'));
  await page.waitForFunction(() => window.__monsterDenRuntime?.ready, undefined, { timeout: 30000 });
  await afterFrames(page);
}

async function inspect(page) {
  return page.evaluate(() => {
    const c = window.cc, api = window.__MONSTER_DEN__, boot = window.__monsterDenRuntime;
    const canvas = document.querySelector('#GameCanvas'), rect = canvas?.getBoundingClientRect();
    if (!c || !api) return { ready: false, boot: boot || null, startup: document.querySelector('#startup')?.textContent };
    const device = c.director.root.device, controller = api.controller, scene = c.director.getScene();
    const gl = device.gl || device._gl, extension = gl?.getExtension('WEBGL_debug_renderer_info');
    const state = api.model.state, audio = controller.audio;
    return {
      engineVersion: c.VERSION, ready: !!boot?.ready, bootErrors: boot?.errors || [],
      device: device.constructor.name, gfxAPI: device.gfxAPI,
      isWebGL: device.gfxAPI === c.gfx.API.WEBGL || device.gfxAPI === c.gfx.API.WEBGL2,
      gpuRenderer: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : undefined,
      gpuVendor: extension ? gl.getParameter(extension.UNMASKED_VENDOR_WEBGL) : undefined,
      glError: gl?.getError(), frames: c.director.getTotalFrames(), drawCalls: device.numDrawCalls, triangles: device.numTris,
      meshRenderers: scene.getComponentsInChildren(c.MeshRenderer).length,
      activeMeshRenderers: scene.getComponentsInChildren(c.MeshRenderer).filter(renderer => renderer.node.activeInHierarchy).length,
      labels: scene.getComponentsInChildren(c.Label).length,
      activeLabels: scene.getComponentsInChildren(c.Label).filter(label => label.node.activeInHierarchy).map(label => label.string),
      page: controller.page, room: state.roomIndex + 1, phase: state.phase, shots: state.shots,
      hp: state.player.hp, score: state.score, rescuesUsed: state.rescuesUsed,
      treasureTaken: state.treasure.taken, stashCount: state.stashCount, stashValue: state.stashValue,
      stashes: state.stashes.map(stash => ({ ...stash })),
      spores: state.spores.map(spore => ({ ...spore })),
      stashVisuals: [...controller.stashVisuals].map(([id, visual]) => ({ id,
        modelVisible: visual.instance.root.activeInHierarchy, label: visual.label.string,
        labelVisible: visual.label.node.activeInHierarchy })),
      objective: controller.objectiveLabel?.string, objectiveVisible: !!controller.objectiveLabel?.node.activeInHierarchy,
      exitRingActive: !!controller.exitRing?.active,
      toolName: controller.toolNameLabel?.string, toolStatus: controller.toolStatusLabel?.string,
      toolNameVisible: !!controller.toolNameLabel?.node?.activeInHierarchy, tutorialText: controller.tutorialText?.string,
      livingEnemies: state.enemies.filter(enemy => enemy.alive).length,
      player: { x: state.player.x, y: state.player.y, tool: state.player.tool },
      visibleSize: { width: c.view.getVisibleSize().width, height: c.view.getVisibleSize().height },
      viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
      canvas: rect && { x: rect.x, y: rect.y, width: rect.width, height: rect.height, bufferWidth: canvas.width, bufferHeight: canvas.height },
      heroY: controller.hero?.instance.root.position.y,
      heroVisible: controller.hero?.instance.root.activeInHierarchy,
      homeActorVisible: controller.homeActor?.instance.root.activeInHierarchy,
      joystickVisible: controller.stick?.root.activeInHierarchy || false,
      translucentMaterials: Object.fromEntries(['matShadow', 'matDanger', 'matAim', 'matGold'].map(name => {
        const pass = controller[name]?.passes[0];
        return [name, { blend: pass?.blendState.targets[0].blend, depthWrite: pass?.depthStencilState.depthWrite }];
      })),
      dragging: controller.dragging, dragPower: controller.dragPower,
      touchTrace: window.__acceptanceTouchEvents,
      audio: audio && { ...audio.status, contextState: audio.context?.state, decodedSounds: audio.soundBuffers?.size || 0 },
      wallet: controller.save?.read().progress.coins,
    };
  });
}

async function checkpoint(page, label, filename) {
  await afterFrames(page, 2);
  const value = await inspect(page);
  report.checkpoints.push({ label, screenshot: filename, ...value });
  await page.screenshot({ path: path.join(output, filename) });
  assert.ok(value.ready && value.engineVersion === '3.8.8' && value.isWebGL && !value.device.includes('Empty') && !value.bootErrors.length,
    `Unexpected runtime at ${label}: ${JSON.stringify(value)}`);
  assert.ok(value.drawCalls > 3 && value.triangles > 100 && value.meshRenderers > 10 && value.labels > 3,
    `Incomplete 3D/UI draw at ${label}: ${JSON.stringify(value)}`);
  if (value.page === 'home' || value.page === 'game') {
    assert.ok(value.activeMeshRenderers > 10, `Visible 3D mesh hierarchy absent at ${label}`);
    assert.equal(value.page === 'home' ? value.homeActorVisible : value.heroVisible, true,
      `Expected ${value.page === 'home' ? 'home showcase actor' : 'gameplay hero'} is hidden at ${label}`);
  }
  assert.ok(value.glError === undefined || value.glError === 0, `WebGL error ${value.glError} at ${label}`);
  for (const [name, state] of Object.entries(value.translucentMaterials)) {
    assert.equal(state.blend, true, `${name}: transparent material lost blending`);
    assert.equal(state.depthWrite, false, `${name}: transparent material writes depth`);
  }
  return value;
}

async function labelPoint(page, text) {
  return page.evaluate(text => {
    const c = window.cc, controller = window.__MONSTER_DEN__.controller;
    const matches = label => label.string === text && label.node.activeInHierarchy;
    const overlayLabels = controller.overlay.children.length ? controller.overlay.getComponentsInChildren(c.Label) : [];
    const label = overlayLabels.find(matches) || c.director.getScene().getComponentsInChildren(c.Label).find(matches);
    if (!label) throw new Error(`Visible UI label is missing: ${text}`);
    const camera = controller.canvas.getComponent(c.Canvas).cameraComponent;
    const point = camera.worldToScreen(label.node.worldPosition);
    const canvas = document.querySelector('#GameCanvas'), rect = canvas.getBoundingClientRect();
    return { x: rect.left + point.x / canvas.width * rect.width, y: rect.bottom - point.y / canvas.height * rect.height };
  }, text);
}

async function clickLabel(page, text, touch = false) {
  const point = await labelPoint(page, text);
  if (touch) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
  await afterFrames(page);
}

async function inputGeometry(page) {
  return page.evaluate(() => {
    const c = window.cc, canvas = document.querySelector('#GameCanvas'), rect = canvas.getBoundingClientRect();
    const controller = window.__MONSTER_DEN__.controller;
    if (!controller.stick?.root.activeInHierarchy) throw new Error('Visible fixed joystick is missing.');
    const camera = controller.canvas.getComponent(c.Canvas).cameraComponent;
    const center = camera.worldToScreen(controller.stick.root.worldPosition);
    if (!Number.isFinite(center.x) || !Number.isFinite(center.y)) throw new Error('The real UI camera did not project the joystick center.');
    return { x: rect.left + center.x / canvas.width * rect.width, y: rect.bottom - center.y / canvas.height * rect.height,
      coordinateSource: 'Actual rendered joystick root through the UI camera to canvas CSS coordinates',
      pixelX: c.view.getScaleX() * rect.width / canvas.width,
      pixelY: c.view.getScaleY() * rect.height / canvas.height,
      groundProjection: controller.groundProjection,
      joystickTuning: { ...controller.joystickTuning }, gameplayTuning: { ...controller.gameplayTuning },
      rect: { x: rect.left, y: rect.top, width: rect.width, height: rect.height } };
  });
}

async function inputState(page) {
  return page.evaluate(() => {
    const controller = window.__MONSTER_DEN__.controller, state = window.__MONSTER_DEN__.model.state;
    return { dragging: controller.dragging, power: controller.dragPower, shots: state.shots,
      phase: state.phase, tool: state.player.tool, toolName: controller.toolNameLabel?.string,
      toolStatus: controller.toolStatusLabel?.string, toolNameVisible: !!controller.toolNameLabel?.node?.activeInHierarchy,
      tutorialText: controller.tutorialText?.string,
      visibleDots: controller.aimNodes.filter(node => node.active).length,
      aim: { x: controller.lastAim.x, y: controller.lastAim.y },
      thumb: { x: controller.stick.thumb.position.x, y: controller.stick.thumb.position.y },
      heroYaw: controller.hero.instance.root.eulerAngles.y };
  });
}

async function mouseJoystickBoundaries(page) {
  const input = await inputGeometry(page), initial = await inputState(page);
  const { deadZone, travel } = input.joystickTuning;
  assert.ok(deadZone > 0 && travel > deadZone && input.groundProjection > 0, 'Invalid fixed joystick geometry.');
  const assertIdle = async label => {
    await afterFrames(page);
    const state = await inputState(page);
    assert.equal(state.shots, initial.shots, `${label} launched a shot.`);
    assert.equal(state.dragging, false, `${label} left the joystick held.`);
    assert.equal(state.visibleDots, 0, `${label} left aim meshes visible.`);
    return state;
  };
  await page.mouse.click(input.x, input.y);
  const centerTap = await assertIdle('Joystick center tap');
  await page.mouse.click(input.x + 90 * input.pixelX, input.y);
  const rimTap = await assertIdle('Joystick outer-ring tap');
  await page.mouse.move(input.x + 90 * input.pixelX, input.y); await page.mouse.down();
  await page.mouse.move(input.x + 94 * input.pixelX, input.y, { steps: 2 }); await page.mouse.up();
  const rimJitter = await assertIdle('Outer-ring 4-unit finger jitter');
  await page.mouse.move(input.x, input.y); await page.mouse.down();
  await page.mouse.move(input.x + deadZone * .5 * input.pixelX, input.y, { steps: 3 });
  await afterFrames(page);
  const insideDeadZone = await inputState(page);
  assert.equal(insideDeadZone.power, 0, 'Sub-dead-zone motion must have zero power.');
  assert.equal(insideDeadZone.visibleDots, 0, 'Sub-dead-zone motion must not show a launch preview.');
  assertDragGuidance(insideDeadZone, 'Sub-dead-zone aim');
  await page.mouse.up();
  const deadZoneRelease = await assertIdle('Sub-dead-zone release');
  await page.mouse.move(input.x, input.y); await page.mouse.down();
  await page.mouse.move(input.x, input.y - travel * input.pixelY, { steps: 5 });
  await afterFrames(page);
  const pushed = await inputState(page);
  assert.ok(pushed.dragging && pushed.power > .98 && pushed.visibleDots > 0, 'The fixed joystick did not engage before the recenter test.');
  assertDragGuidance(pushed, 'Engaged aim before recentering');
  assert.ok(pushed.aim.y>0,'Pushing upward must target room north.');
  await afterFrames(page,24);
  const oriented=await inputState(page);
  assert.ok(Math.cos((oriented.heroYaw-180)*Math.PI/180)>.93,
    'Explorer visibly faces backwards when pushed north: '+oriented.heroYaw);
  await page.mouse.move(input.x, input.y, { steps: 5 });
  await afterFrames(page);
  const recentered = await inputState(page);
  assert.equal(recentered.power, 0, 'Returning to joystick center must clear launch power.');
  assert.equal(recentered.visibleDots, 0, 'Returning to joystick center must clear the launch preview.');
  assertDragGuidance(recentered, 'Recentered aim');
  await page.mouse.up();
  const recenterRelease = await assertIdle('Recentered joystick release');
  const scene = { x: input.rect.x + input.rect.width * .5, y: input.rect.y + input.rect.height * .42 };
  await page.mouse.move(scene.x, scene.y); await page.mouse.down();
  await page.mouse.move(input.x, input.y - travel * input.pixelY, { steps: 6 });
  await afterFrames(page);
  const outsideStart = await inputState(page);
  assert.equal(outsideStart.dragging, false, 'A gesture starting in the scene must not acquire the joystick after moving over it.');
  await page.mouse.up();
  const sceneRelease = await assertIdle('Scene-origin drag');
  const nonPrimaryButtons = [];
  for (const button of ['right', 'middle']) {
    await page.mouse.move(input.x, input.y); await page.mouse.down({ button }); await afterFrames(page);
    const pressed = await inputState(page);
    assert.equal(pressed.dragging, false, `${button} mouse button started a joystick gesture: ${JSON.stringify(pressed)}`);
    await page.mouse.move(input.x, input.y - travel * input.pixelY, { steps: 5 }); await afterFrames(page);
    const moved = await inputState(page);
    assert.ok(!moved.dragging && moved.power === 0 && moved.visibleDots === 0 && moved.shots === initial.shots,
      `${button} mouse drag changed the aim: ${JSON.stringify(moved)}`);
    await page.mouse.up({ button });
    const released = await assertIdle(`${button} mouse button release`);
    nonPrimaryButtons.push({ button, cannotAimOrLaunch: true, pressed, moved, released });
  }
  return { method: 'Real DOM mouse input at the rendered joystick center and scene', input,
    centerTapDoesNotLaunch: true, rimTapDoesNotLaunch: true, rimJitterDoesNotLaunch: true, deadZoneDoesNotLaunch: true, recenterCancels: true, sceneStartRejected: true,
    nonPrimaryButtons,
    evidence: { centerTap, rimTap, rimJitter, insideDeadZone, deadZoneRelease, pushed, recentered, recenterRelease, outsideStart, sceneRelease } };
}

async function mouseShot(page, targetX, targetY, explicitPower, captureAim = false, shotLog = report.route.shots) {
  const state = await page.evaluate(() => window.__MONSTER_DEN__.model.state);
  assert.equal(state.phase, 'aiming', `Room ${state.roomIndex + 1} is not ready for the next pointer shot.`);
  assertToolName(await inputState(page), `Room ${state.roomIndex + 1} before aiming`);
  const player = state.player, dx = targetX - player.x, dy = targetY - player.y;
  const input = await inputGeometry(page);
  const tuning = input.gameplayTuning;
  const distance = Math.hypot(dx, dy), drag = tuning.drag * (player.tool === 'heavy' ? 1.07 : 1), multiplier = player.tool === 'heavy' ? .96 : 1;
  const power = explicitPower ?? Math.max(.01, Math.min(1, ((distance + .17) * drag / 1.006 / multiplier - tuning.launchMin) / (tuning.launchMax - tuning.launchMin)));
  const end = joystickEndpoint(input, dx, dy, power);
  await page.mouse.move(input.x, input.y); await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 6 });
  await afterFrames(page, 1);
  if (captureAim) await checkpoint(page, 'first fixed-joystick push displays native aim meshes', '03-room1-aim.png');
  const actualAim = await inputState(page);
  assert.ok(actualAim.dragging && actualAim.visibleDots > 0 && Math.abs(actualAim.power - end.effectivePower) < .015,
    `Joystick push did not produce its requested aim: ${JSON.stringify({ power, actualAim, input, end })}`);
  assertDragGuidance(actualAim, `Room ${state.roomIndex + 1} shot ${state.shots + 1} aim`);
  // Observe actual rendered HUD updates. This does not call or replace any
  // game method, advance the simulation, or rewrite the model.
  await page.evaluate(({ before, expectedName }) => {
    const c = window.cc, api = window.__MONSTER_DEN__;
    const trace = { frames: 0, samples: [], mismatches: [], last: '' };
    trace.listener = () => {
      if (api.model.state.shots !== before + 1) return;
      const controller = api.controller;
      const sample = { phase: api.model.state.phase, name: controller.toolNameLabel?.string,
        status: controller.toolStatusLabel?.string, visible: !!controller.toolNameLabel?.node?.activeInHierarchy };
      trace.frames++;
      const key = JSON.stringify(sample);
      if (key !== trace.last) { trace.samples.push(sample); trace.last = key; }
      if ((sample.name !== expectedName || !sample.visible) && trace.mismatches.length < 8) trace.mismatches.push(sample);
    };
    window.__acceptanceToolTrace = trace;
    c.director.on(c.Director.EVENT_AFTER_UPDATE, trace.listener);
  }, { before: state.shots, expectedName: toolNames[state.player.tool] });
  await page.mouse.up();
  await page.waitForFunction(before => window.__MONSTER_DEN__.model.state.shots === before + 1, state.shots, { timeout: 10000 });
  await page.waitForFunction(() => ['aiming', 'room_clear', 'victory', 'game_over'].includes(window.__MONSTER_DEN__.model.state.phase), undefined, { timeout: 60000 });
  const after = await page.evaluate(() => window.__MONSTER_DEN__.model.state);
  const toolTrace = await page.evaluate(() => {
    const trace = window.__acceptanceToolTrace;
    window.cc.director.off(window.cc.Director.EVENT_AFTER_UPDATE, trace.listener);
    delete window.__acceptanceToolTrace;
    return { frames: trace.frames, samples: trace.samples, mismatches: trace.mismatches };
  });
  assert.ok(toolTrace.frames > 0, 'No actual HUD update was sampled during the shot.');
  assert.deepEqual(toolTrace.mismatches, [], `Tool name disappeared or changed during a shot: ${JSON.stringify(toolTrace)}`);
  assertToolName(await inputState(page), `Room ${state.roomIndex + 1} after shot`);
  shotLog.push({ room: after.roomIndex + 1, shot: after.shots, target: { x: targetX, y: targetY }, power,
    effectivePower: actualAim.power, pointer: end, cancelHint: actualAim.tutorialText,
    toolNameFrames: toolTrace.frames, toolPhases: toolTrace.samples,
    phase: after.phase, hp: after.player.hp, score: after.score, stashCount: after.stashCount, stashValue: after.stashValue,
    player: { x: after.player.x, y: after.player.y } });
  assert.notEqual(after.phase, 'game_over', `Documented route failed after shot ${after.shots}.`);
  return after;
}

async function musicState(page, scene) {
  await page.waitForFunction(scene => {
    const audio = window.__MONSTER_DEN__?.controller.audio;
    return audio?.status.playingScene === scene && audio.status.unlocked && !audio.status.paused && audio.context?.state === 'running';
  }, scene, { timeout: 30000 });
  const audio = (await inspect(page)).audio;
  assert.equal(audio.mode, 'web-audio');
  assert.ok(audio.decodedSounds >= 5 && audio.decodedMusicBytes > 100000, `Expected actual MP3 decode buffers: ${JSON.stringify(audio)}`);
  assert.ok(audio.activeMusicVoices >= 1 && audio.activeMusicVoices <= 2 && audio.cachedMusicScenes.length <= 2,
    `Music crossfade/cache exceeded its bound: ${JSON.stringify(audio)}`);
  return audio;
}

async function optionalStashCheck(url) {
  const context = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 1 });
  const page = await context.newPage(); activePage = page; observe(page, 'optional-stash-route');
  await page.goto(url, { waitUntil: 'load' }); await ready(page);
  await clickLabel(page, '潜入怪物窝');
  await page.waitForFunction(() => window.__MONSTER_DEN__.controller.page === 'game');
  const first = await checkpoint(page, 'first gameplay at 360×640 with initial objective and fixed joystick', '15-short-first-room.png');
  assert.equal(first.objective, '撞开木栏'); assert.equal(first.objectiveVisible, true);
  assert.equal(first.exitRingActive, false); assert.equal(first.joystickVisible, true);
  assertToolName(first, 'Short-portrait first gameplay');
  report.shortFirstGameplay = { viewport: first.viewport, objective: first.objective, objectiveVisible: first.objectiveVisible,
    exitRingActive: first.exitRingActive, joystickVisible: first.joystickVisible, screenshot: '15-short-first-room.png' };
  // Match the main route's CSS input geometry after capturing the small-screen
  // opening; every shot still computes power from its current actual position.
  await page.setViewportSize({ width: 420, height: 780 });
  await page.waitForFunction(() => Math.abs(window.__MONSTER_DEN__.controller.height - 720 * 780 / 420) < 2);
  await afterFrames(page);
  const route = report.optionalStashRoute = { method: 'Independent browser context; home UI, first-room exit, heavy tool card and six second-room joystick shots', shots: [] };
  for (const [x, y, power] of routes[0]) await mouseShot(page, x, y, power, false, route.shots);
  await page.waitForFunction(() => window.__MONSTER_DEN__.model.state.phase === 'room_clear' && window.__MONSTER_DEN__.controller.overlay.children.length > 0);
  const cards = await checkpoint(page, 'three tool choices explain mechanism and next-room use', '16-tool-choice.png');
  for (const name of ['重撞拳套', '壁虎手套', '回旋腕带']) assert.ok(cards.activeLabels.includes(name), `Tool choice missing: ${name}`);
  await clickLabel(page, '重撞拳套');
  await page.waitForFunction(() => window.__MONSTER_DEN__.model.state.roomIndex === 1);
  const before = await checkpoint(page, 'second-room optional stash and its value label before collection', '17-room2-stash.png');
  const stash = before.stashes.find(item => item.id === 'store-side-stash');
  const visual = before.stashVisuals.find(item => item.id === 'store-side-stash');
  assert.ok(stash && !stash.taken && visual?.modelVisible, 'Second-room optional stash model is not visible.');
  assert.equal(visual.label, '额外 +80'); assert.equal(visual.labelVisible, true);
  assert.equal(before.stashCount, 0); assert.equal(before.stashValue, 0); assert.equal(before.exitRingActive, false);
  const stashRoute = [[0, 3, 1], [-3.85, -.4], [-1.4, -.4], [-1.4, 4.5], [0, 4.2], [2.9, 5.7]];
  for (let index = 0; index < stashRoute.length; index++) {
    const [x, y, power] = stashRoute[index]; await mouseShot(page, x, y, power, false, route.shots);
    if (index === 1) {
      const collected = await checkpoint(page, 'optional stash collected while main treasure and locked exit remain', '18-room2-stash-collected.png');
      assert.equal(collected.stashCount, 1); assert.equal(collected.stashValue, 80);
      assert.equal(collected.stashes.find(item => item.id === 'store-side-stash').taken, true);
      const hidden = collected.stashVisuals.find(item => item.id === 'store-side-stash');
      assert.equal(hidden.modelVisible, false); assert.equal(hidden.labelVisible, false);
      assert.equal(collected.treasureTaken, false); assert.equal(collected.exitRingActive, false);
      assert.equal(collected.objective, '拿走宝物'); assert.equal(collected.objectiveVisible, true);
      route.collected = { shot: collected.shots, stashCount: collected.stashCount, stashValue: collected.stashValue,
        mainTreasureStillRequired: true, markerHidden: true, screenshot: '18-room2-stash-collected.png' };
    }
  }
  const end = await inspect(page);
  assert.equal(end.phase, 'room_clear'); assert.equal(end.shots, 8);
  assert.equal(end.stashCount, 1); assert.equal(end.stashValue, 80); assert.equal(end.rescuesUsed, 0);
  assert.ok(end.hp > 0); assert.ok(end.livingEnemies > 0);
  route.completed = { room: end.room, phase: end.phase, shots: end.shots, hp: end.hp,
    score: end.score, stashCount: end.stashCount, stashValue: end.stashValue, rescuesUsed: end.rescuesUsed };
  await page.waitForLoadState('networkidle'); await context.close(); activePage = null;
}

async function optionalSporeChainCheck(url) {
  const context=await browser.newContext({viewport:{width:420,height:780},deviceScaleFactor:1});
  const page=await context.newPage();activePage=page;observe(page,'first-room-spore-chain');
  await page.goto(url,{waitUntil:'load'});await ready(page);
  await clickLabel(page,'潜入怪物窝');
  await page.waitForFunction(()=>window.__MONSTER_DEN__.controller.page==='game');
  const initial=await checkpoint(page,'first room has five organic fungal reactors','19-room1-spore-before.png');
  assert.equal(initial.spores.length,5);
  assert.ok(initial.spores.every(spore=>!spore.spent));
  const shots=[];await mouseShot(page,-3.2,-3,.55,false,shots);
  const burst=await checkpoint(page,'left fungal bud detonates chain and breaks wood','20-room1-spore-after.png');
  assert.equal(burst.spores.filter(spore=>spore.spent).length,5,'Joystick failed to trigger the five-bud chain.');
  assert.equal(burst.treasureTaken,false);
  assert.equal(burst.exitRingActive,false);
  assert.equal(await page.evaluate(()=>window.__MONSTER_DEN__.model.state.obstacles.find(x=>x.id==='welcome-board').destroyed),true);
  assert.equal(burst.score,65);
  report.spores={method:'Independent real WebGL pointer test; no model-state injection',
    shots,score:burst.score,budsTriggered:5,woodDestroyed:true,treasureStillRequired:true,
    screenshots:['19-room1-spore-before.png','20-room1-spore-after.png']};
  await page.waitForLoadState('networkidle');await context.close();activePage=null;
}

async function activeToolNameCheck(url) {
  report.activeToolPresentation = [];
  for (const [tool, card] of [['grip', '壁虎手套'], ['return', '回旋腕带']]) {
    const context = await browser.newContext({ viewport: { width: 420, height: 780 }, deviceScaleFactor: 1 });
    const page = await context.newPage(); activePage = page; observe(page, `tool-name-${tool}`);
    await page.goto(url, { waitUntil: 'load' }); await ready(page); await clickLabel(page, '潜入怪物窝');
    const shots = [];
    for (const [x, y, power] of routes[0]) await mouseShot(page, x, y, power, false, shots);
    await page.waitForFunction(() => window.__MONSTER_DEN__.controller.overlay.children.length > 0);
    await clickLabel(page, card);
    const before = await inputState(page);
    assert.equal(before.tool, tool); assertToolName(before, `${card} selected`);
    assert.equal(before.toolStatus, '冲撞时可用');
    await mouseShot(page, 0, 3, 1, false, shots);
    const actual = shots[shots.length - 1], after = await inputState(page);
    assert.ok(actual.toolPhases.some(sample => sample.phase === 'moving' && sample.name === toolNames[tool] && sample.status === '现在可以点按'), `${card}: ready tool was not named during the actual flight.`);
    assert.ok(actual.toolPhases.some(sample => sample.phase === 'enemies' && sample.name === toolNames[tool] && sample.status === '等待敌人行动结束'), `${card}: tool name disappeared during the enemy turn.`);
    assert.equal(after.phase, 'aiming'); assert.equal(after.toolStatus, '冲撞时可用'); assertToolName(after, `${card} after enemy turn`);
    report.activeToolPresentation.push({ tool, card, enteredViaFirstRoomExit: true,
      before: { phase: before.phase, name: before.toolName, status: before.toolStatus }, actualShot: actual,
      after: { phase: after.phase, name: after.toolName, status: after.toolStatus } });
    await page.waitForLoadState('networkidle'); await context.close(); activePage = null;
  }
}

async function mobileInputCheck(url) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await context.newPage(); activePage = page; observe(page, 'mobile-390x844-dpr2');
  await page.goto(url, { waitUntil: 'load' }); await ready(page);
  await checkpoint(page, 'mobile home at 390×844 DPR2', '12-mobile-home.png');
  await clickLabel(page, '潜入怪物窝', true);
  await page.waitForFunction(() => window.__MONSTER_DEN__.controller.page === 'game');
  const initial = await inspect(page);
  assert.equal(initial.objective, '撞开木栏'); assert.equal(initial.objectiveVisible, true);
  assert.equal(initial.exitRingActive, false); assertToolName(initial, 'Mobile initial room');
  await page.evaluate(() => {
    window.__acceptanceTouchEvents = [];
    for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) document.addEventListener(type, event => {
      window.__acceptanceTouchEvents.push({ type, trusted: event.isTrusted, cancelable: event.cancelable, active: [...event.touches].map(t => t.identifier), changed: [...event.changedTouches].map(t => t.identifier) });
    }, { capture: true, passive: true });
  });
  const input = await inputGeometry(page), cdp = await context.newCDPSession(page);
  const touch = (id, x, y) => ({ id, x, y, radiusX: 5, radiusY: 5, force: 1 });
  const send = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
  const { deadZone, travel } = input.joystickTuning;
  const idleTouch = async label => {
    await afterFrames(page);
    const state = await inputState(page);
    assert.equal(state.shots, 0, `${label} launched a shot.`);
    assert.equal(state.dragging, false, `${label} left the joystick held.`);
    assert.equal(state.visibleDots, 0, `${label} left aim meshes visible.`);
    return state;
  };
  await page.touchscreen.tap(input.x, input.y);
  const centerTap = await idleTouch('Mobile joystick center tap');
  await send('touchStart', [touch(41, input.x + 90 * input.pixelX, input.y)]);
  await send('touchEnd', []);
  const rimTap = await idleTouch('Mobile outer-ring tap');
  await send('touchStart', [touch(42, input.x + 90 * input.pixelX, input.y)]);
  await send('touchMove', [touch(42, input.x + 94 * input.pixelX, input.y)]);
  await send('touchEnd', []);
  const rimJitter = await idleTouch('Mobile outer-ring 4-unit jitter');
  await send('touchStart', [touch(1, input.x, input.y)]);
  await send('touchMove', [touch(1, input.x + deadZone * .5 * input.pixelX, input.y)]);
  await afterFrames(page);
  const insideDeadZone = await inputState(page);
  assert.equal(insideDeadZone.power, 0); assert.equal(insideDeadZone.visibleDots, 0);
  assertDragGuidance(insideDeadZone, 'Mobile sub-dead-zone aim');
  await send('touchEnd', []);
  const deadZoneRelease = await idleTouch('Mobile sub-dead-zone release');
  await send('touchStart', [touch(2, input.x, input.y)]);
  await send('touchMove', [touch(2, input.x, input.y - travel * input.pixelY)]);
  await afterFrames(page);
  const pushed = await inputState(page);
  assert.ok(pushed.dragging && pushed.power > .98 && pushed.visibleDots > 0, 'Mobile joystick did not engage before recentering.');
  assertDragGuidance(pushed, 'Mobile engaged aim before recentering');
  await send('touchMove', [touch(2, input.x, input.y)]); await afterFrames(page);
  const recentered = await inputState(page);
  assert.equal(recentered.power, 0); assert.equal(recentered.visibleDots, 0);
  assertDragGuidance(recentered, 'Mobile recentered aim');
  await send('touchEnd', []);
  const recenterRelease = await idleTouch('Mobile recentered release');
  const scene = { x: input.rect.x + input.rect.width * .5, y: input.rect.y + input.rect.height * .42 };
  await send('touchStart', [touch(3, scene.x, scene.y)]);
  await send('touchMove', [touch(3, input.x, input.y - travel * input.pixelY)]); await afterFrames(page);
  const outsideStart = await inputState(page);
  assert.equal(outsideStart.dragging, false, 'Mobile scene-origin touch acquired the joystick after moving over it.');
  await send('touchEnd', []);
  const sceneRelease = await idleTouch('Mobile scene-origin drag');
  const joystickBoundaries = { method: 'Real CDP/touchscreen input; no synthetic event fixture for these checks', input,
    centerTapDoesNotLaunch: true, rimTapDoesNotLaunch: true, rimJitterDoesNotLaunch: true, deadZoneDoesNotLaunch: true, recenterCancels: true, sceneStartRejected: true,
    evidence: { centerTap, rimTap, rimJitter, insideDeadZone, deadZoneRelease, pushed, recentered, recenterRelease, outsideStart, sceneRelease } };
  const owner = touch(11, input.x, input.y);
  const ownerDragged = touch(11, input.x, input.y - travel * .8 * input.pixelY);
  const extra = touch(12, input.x + 45 * input.pixelX, input.y - 25 * input.pixelY);
  const extraMoved = touch(12, input.x - 55 * input.pixelX, input.y + 35 * input.pixelY);
  await send('touchStart', [owner]); await send('touchMove', [ownerDragged]); await afterFrames(page);
  assertDragGuidance(await inputState(page), 'Primary mobile touch aim');
  const before = await page.evaluate(() => ({ dragging: window.__MONSTER_DEN__.controller.dragging,
    aim: { x: window.__MONSTER_DEN__.controller.lastAim.x, y: window.__MONSTER_DEN__.controller.lastAim.y }, shots: window.__MONSTER_DEN__.model.state.shots }));
  assert.ok(before.dragging && before.shots === 0, 'Primary mobile touch failed to start an aim.');
  await send('touchStart', [ownerDragged, extra]);
  await send('touchMove', [ownerDragged, extraMoved]);
  await afterFrames(page);
  const steered = await page.evaluate(() => ({ dragging: window.__MONSTER_DEN__.controller.dragging,
    aim: { x: window.__MONSTER_DEN__.controller.lastAim.x, y: window.__MONSTER_DEN__.controller.lastAim.y }, shots: window.__MONSTER_DEN__.model.state.shots }));
  assert.equal(steered.dragging, true); assert.equal(steered.shots, 0);
  assert.ok(Math.abs(steered.aim.x - before.aim.x) < .01 && Math.abs(steered.aim.y - before.aim.y) < .01, 'CDP second finger redirected the primary aim.');
  // The Chromium protocol requires an empty point list for touchEnd. A
  // touchMove with one point removed does not dispatch secondary-only end.
  // Exercise that edge through the real DOM -> Cocos -> controller pipeline,
  // explicitly recording its untrusted fixture status; do not call a game API.
  const releaseFixture = await page.evaluate(({ ownerDragged, extraMoved }) => {
    const target = document.querySelector('#GameCanvas');
    const start = window.__acceptanceTouchEvents.find(event => event.type === 'touchstart' && event.active.length === 2);
    if (!start) throw new Error('CDP did not establish two actual touch identifiers.');
    const make = (identifier, point) => new Touch({ identifier, target,
      clientX: point.x, clientY: point.y, pageX: point.x, pageY: point.y, screenX: point.x, screenY: point.y,
      radiusX: 5, radiusY: 5, force: 1 });
    const primary = make(start.active[0], ownerDragged), secondary = make(start.active[1], extraMoved);
    const event = new TouchEvent('touchend', { bubbles: true, cancelable: true,
      touches: [primary], targetTouches: [primary], changedTouches: [secondary] });
    target.dispatchEvent(event);
    return { method: 'DOM TouchEvent fixture through native canvas listener and Cocos input dispatch',
      isTrusted: event.isTrusted, primaryIdentifier: primary.identifier, releasedIdentifier: secondary.identifier };
  }, { ownerDragged, extraMoved });
  await afterFrames(page);
  const after = await page.evaluate(() => ({ dragging: window.__MONSTER_DEN__.controller.dragging,
    aim: { x: window.__MONSTER_DEN__.controller.lastAim.x, y: window.__MONSTER_DEN__.controller.lastAim.y }, shots: window.__MONSTER_DEN__.model.state.shots }));
  assert.equal(after.dragging, true, 'Releasing a second finger must not release the primary shot.');
  assert.equal(after.shots, 0, 'Second-finger input caused an unintended launch.');
  assert.ok(Math.abs(after.aim.x - before.aim.x) < .01 && Math.abs(after.aim.y - before.aim.y) < .01, 'Second finger redirected the primary aim.');
  const endedExtra = await page.evaluate(() => window.__acceptanceTouchEvents.some(event => event.type === 'touchend' && !event.trusted && event.active.length === 1 && event.changed.length === 1));
  assert.equal(endedExtra, true, 'DOM fixture did not deliver a secondary-only touchend.');
  assert.equal(releaseFixture.isTrusted, false);
  assertDragGuidance(await inputState(page), 'Mobile aim after secondary-finger release');
  await checkpoint(page, 'CDP dual-touch aim; isolated release checked by marked DOM fixture', '13-mobile-aim.png');
  const cancelDiagnostics = { entries: [] };
  expectedTouchCancel.set(page, cancelDiagnostics);
  try { await send('touchCancel', []); await afterFrames(page); }
  finally { expectedTouchCancel.delete(page); }
  const cancelled = await page.evaluate(() => ({ dragging: window.__MONSTER_DEN__.controller.dragging,
    shots: window.__MONSTER_DEN__.model.state.shots, visibleAim: window.__MONSTER_DEN__.controller.aimNodes.some(node => node.active) }));
  assert.deepEqual(cancelled, { dragging: false, shots: 0, visibleAim: false });
  const nativeCancel = await page.evaluate(() => window.__acceptanceTouchEvents.findLast(event => event.type === 'touchcancel'));
  assert.ok(nativeCancel?.trusted && !nativeCancel.cancelable && nativeCancel.active.length === 0,
    'Expected native non-cancelable cancellation was not observed.');
  await send('touchStart', [touch(21, input.x, input.y)]);
  await send('touchMove', [touch(21, input.x, input.y - travel * input.pixelY)]);
  await afterFrames(page); assertDragGuidance(await inputState(page), 'Mobile relaunch aim after cancellation');
  await send('touchEnd', []);
  await page.waitForFunction(() => window.__MONSTER_DEN__.model.state.shots === 1);
  await page.waitForFunction(() => window.__MONSTER_DEN__.model.state.phase === 'aiming', undefined, { timeout: 60000 });
  const board = await page.evaluate(() => window.__MONSTER_DEN__.model.state.obstacles.find(obstacle => obstacle.kind === 'board')?.destroyed);
  assert.equal(board, true, 'A new primary touch after cancellation must launch and break the first board.');
  for (const diagnostic of cancelDiagnostics.entries) {
    diagnostic.behaviorVerified = true;
    diagnostic.evidence = { nativeCancel, aimCleared: true, cancellationDidNotLaunch: true, subsequentTouchLaunchedAndBrokeBoard: true };
  }
  const audio = await musicState(page, 'explore');
  const firstShot = await checkpoint(page, 'mobile touch launch after cancellation', '14-mobile-shot.png');
  assert.equal(firstShot.treasureTaken, true); assert.equal(firstShot.objective, '前往出口');
  assert.equal(firstShot.objectiveVisible, true); assert.equal(firstShot.exitRingActive, true);
  report.mobileInput = { viewport: '390×844', devicePixelRatio: 2, emulatedPhone: true, realPhone: false,
    joystickBoundaries,
    cdpSecondFingerCannotSteer: true, secondaryReleaseFixture: { ...releaseFixture, cannotReleasePrimaryShot: true },
    cdpCancellationDoesNotLaunch: true,
    subsequentTouchLaunches: true, firstBoardDestroyed: true, audio,
    objectiveChangesAfterMainTreasure: true, exitLightsAfterMainTreasure: true };
  report.mobileInput.touchEvents = await page.evaluate(() => window.__acceptanceTouchEvents);
  await page.waitForLoadState('networkidle');
  await cdp.detach(); await context.close(); activePage = null;
}

(async () => {
  const url = process.argv[2] || process.env.PREVIEW_URL || await serve(); report.url = url;
  const executablePath = process.env.CHROMIUM_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
  const args = ['--disable-dev-shm-usage'];
  // Software GL is explicit evidence of shader compilation, not phone GPU performance.
  if (process.env.COCOS_SOFTWARE_GL === '1') args.push('--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader');
  report.requestedSoftwareGL = process.env.COCOS_SOFTWARE_GL === '1';
  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}), args });
  report.browserVersion = browser.version();
  const context = await browser.newContext({ viewport: { width: 420, height: 780 }, deviceScaleFactor: 1 });
  const page = await context.newPage(); activePage = page; observe(page, 'desktop-route');
  await page.goto(url, { waitUntil: 'load' }); await ready(page);
  const home = await checkpoint(page, 'home actual WebGL draw', '01-home.png');
  await clickLabel(page, '潜入怪物窝');
  await page.waitForFunction(() => window.__MONSTER_DEN__.controller.page === 'game');
  const first = await checkpoint(page, 'first room before input', '02-room1.png');
  assert.equal(first.objective, '撞开木栏'); assert.equal(first.objectiveVisible, true);
  assert.equal(first.treasureTaken, false); assert.equal(first.exitRingActive, false); assertToolName(first, 'Initial room');
  report.firstSession = { initial: { objective: first.objective, objectiveVisible: first.objectiveVisible, exitRingActive: first.exitRingActive } };
  report.audio = { scope: 'Decoded assets, running AudioContext and scheduled music voices; output was not heard by a human', explore: await musicState(page, 'explore') };
  report.joystickBoundaries = await mouseJoystickBoundaries(page);
  for (let room = 0; room < routes.length; room++) {
    const before = await page.evaluate(() => window.__MONSTER_DEN__.model.state);
    assert.equal(before.roomIndex, room);
    if (room > 0) await checkpoint(page, `room ${room + 1} drawn with authored models`, `0${room + 4}-room${room + 1}.png`);
    if (room === 4) report.audio.boss = await musicState(page, 'boss');
    for (let shot = 0; shot < routes[room].length; shot++) {
      const [x, y, power] = routes[room][shot];
      await mouseShot(page, x, y, power, room === 0 && shot === 0);
      if (room === 0 && shot === 0) {
        assert.equal(await page.evaluate(() => window.__MONSTER_DEN__.model.state.obstacles.find(obstacle => obstacle.kind === 'board')?.destroyed), true);
        const obtained = await checkpoint(page, 'first shot breaks board and collects treasure', '04-room1-first-shot.png');
        assert.equal(obtained.treasureTaken, true); assert.equal(obtained.objective, '前往出口');
        assert.equal(obtained.objectiveVisible, true); assert.equal(obtained.exitRingActive, true);
        report.firstSession.afterFirstShot = { objective: obtained.objective, objectiveVisible: obtained.objectiveVisible,
          mainTreasureTaken: obtained.treasureTaken, exitRingActive: obtained.exitRingActive };
      }
    }
    const end = await inspect(page);
    assert.equal(end.phase, room === 4 ? 'victory' : 'room_clear', `Room ${room + 1} route did not reach its exit.`);
    assert.ok(end.livingEnemies > 0, `Room ${room + 1} should allow leaving living enemies behind.`);
    assert.equal(end.stashCount, 0, `Room ${room + 1}: optional stash was collected on the established main route.`);
    assert.equal(end.stashValue, 0);
    report.route.rooms.push({ room: end.room, phase: end.phase, shots: end.shots, hp: end.hp, score: end.score,
      livingEnemies: end.livingEnemies, stashCount: end.stashCount, stashValue: end.stashValue });
    if (room < routes.length - 1) {
      await page.waitForFunction(() => window.__MONSTER_DEN__.controller.overlay.children.length > 0);
      await clickLabel(page, '重撞拳套');
      await page.waitForFunction(room => window.__MONSTER_DEN__.model.state.roomIndex === room, room + 1);
    }
  }
  const victory = await checkpoint(page, 'victory reached by 21 real pointer shots', '09-victory.png');
  assert.equal(victory.shots, 21); assert.equal(victory.rescuesUsed, 0); assert.ok(victory.hp > 0);
  assert.equal(report.route.shots.length, 21); assert.equal(victory.stashCount, 0); assert.equal(victory.stashValue, 0);
  report.firstSession.everyMainRouteAimShowsCancel = report.route.shots.every(shot => /回中[\s\S]*取消/.test(shot.cancelHint));
  assert.equal(report.firstSession.everyMainRouteAimShowsCancel, true);
  assert.ok(victory.frames > home.frames + 100, 'Real Cocos frame loop did not advance through the route.');
  await clickLabel(page, '看视频 · 加领金币');
  const ad = await page.evaluate(() => ({ wallet: window.__MONSTER_DEN__.controller.save.read().progress.coins,
    busy: window.__MONSTER_DEN__.controller.adBusy, pending: window.__MONSTER_DEN__.controller.rewardPending }));
  assert.equal(ad.wallet, victory.wallet, 'Unavailable web advertisement must not award money.');
  assert.equal(ad.busy, false); assert.equal(ad.pending, false);
  report.unavailableAd = { grantedNoReward: true, pauseReleased: true, genuineAdvertisementPlayed: false };
  await clickLabel(page, '回到营地'); report.audio.camp = await musicState(page, 'camp');
  await page.waitForLoadState('networkidle');
  await page.reload({ waitUntil: 'load' }); await ready(page);
  await clickLabel(page, '查看冒险结算');
  const restored = await inspect(page);
  assert.equal(restored.phase, 'victory'); assert.equal(restored.wallet, victory.wallet);
  report.saveRestore = { actualPageReload: true, victoryReopened: true, baseRewardNotDuplicated: true, wallet: restored.wallet };
  await page.setViewportSize({ width: 360, height: 640 });
  await page.waitForFunction(() => Math.abs(window.__MONSTER_DEN__.controller.height - 1280) < 2);
  await checkpoint(page, 'victory panel at shorter 360×640 viewport', '10-short-portrait.png');
  await clickLabel(page, '回到营地'); await clickLabel(page, '工具柜');
  await checkpoint(page, 'tool cabinet at 360×640', '11-tool-cabinet.png');
  await page.waitForLoadState('networkidle');
  await context.close(); activePage = null;
  await mobileInputCheck(url);
  await optionalStashCheck(url);
  await optionalSporeChainCheck(url);
  await activeToolNameCheck(url);
  assert.equal(report.errors.length, 0, 'Browser runtime errors were captured.');
  assert.equal(report.consoleErrors.length, 0, 'Shader or browser console errors were captured.');
  assert.ok(report.knownDiagnostics.every(diagnostic => diagnostic.behaviorVerified), 'A known diagnostic lacks its required behavioral verification.');
  assert.equal(report.failedRequests.length, 0, 'Asset requests failed.');
  report.passed = true;
})().catch(async error => {
  report.failure = error.stack || String(error); process.exitCode = 1;
  if (activePage && !activePage.isClosed()) {
    try { report.failureState = await inspect(activePage); } catch (diagnostic) { report.failureDiagnostic = String(diagnostic); }
    try { await activePage.screenshot({ path: path.join(output, 'failure.png'), timeout: 10000 }); report.failureScreenshot = 'failure.png'; } catch { /* Preserve the original error. */ }
  }
}).finally(async () => {
  fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (browser) await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
});

#!/usr/bin/env node
/** Real browser/GPU acceptance for the complete game. No EmptyDevice fallback.
 * node tools/check-game-browser.cjs [https://your-preview.example/]
 * With no URL, serves web/ locally. A working installed Chromium is required.
 */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { createRequire } = require('node:module');
const requireRuntime = createRequire(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES || path.join(__dirname, '../node_modules'), 'playwright/package.json'));
const { chromium } = requireRuntime('playwright');
const root = path.resolve(__dirname, '..');
const web = path.join(root, 'web');
const output = path.join(root, '.build/game-browser');
fs.mkdirSync(output, { recursive: true });
const report = { test: 'Actual GameMain, model meshes, Cocos WebGL, native UI and pointer input',
  passed: false, errors: [], consoleErrors: [], warnings: [], failedRequests: [], checkpoints: [] };
let server, browser;
async function serve() {
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.scene': 'application/json', '.png': 'image/png' };
  server = http.createServer((request, response) => {
    let relative = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (relative.endsWith('/')) relative += 'index.html';
    const file = path.resolve(web, '.' + relative);
    if (!file.startsWith(web + path.sep)) { response.writeHead(403); response.end(); return; }
    fs.readFile(file, (error, buffer) => {
      if (error) { response.writeHead(404); response.end(); return; }
      response.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream'); response.end(buffer);
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${server.address().port}/`;
}
(async () => {
  const url = process.argv[2] || process.env.PREVIEW_URL || await serve();
  report.url = url;
  const executablePath = process.env.CHROMIUM_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
  // Optional software GL is explicit in the report and never substitutes for
  // WeChat phone measurements. Do not add sandbox/network bypass flags here.
  const args = ['--disable-dev-shm-usage'];
  if (process.env.COCOS_SOFTWARE_GL === '1') args.push('--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader');
  report.requestedSoftwareGL = process.env.COCOS_SOFTWARE_GL === '1';
  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}), args });
  const page = await browser.newPage({ viewport: { width: 420, height: 780 }, deviceScaleFactor: 1 });
  page.on('pageerror', error => report.errors.push(error.stack || String(error)));
  page.on('console', message => {
    if (message.location().url?.endsWith('/favicon.ico')) return;
    if (message.type() === 'error') report.consoleErrors.push(message.text());
    else if (message.type() === 'warning') report.warnings.push(message.text());
  });
  page.on('response', response => { if (response.status() >= 400 && !response.url().endsWith('/favicon.ico')) report.failedRequests.push({ url: response.url(), status: response.status() }); });
  page.on('requestfailed', request => report.failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__MONSTER_DEN__ || window.__monsterDenRuntime?.errors?.length, undefined, { timeout: 45000 });
  async function checkpoint(label, filename) {
    const value = await page.evaluate(() => {
      const c = window.cc, api = window.__MONSTER_DEN__, boot = window.__monsterDenRuntime;
      if (!c || !api) throw new Error(`Game is not ready: ${JSON.stringify(boot)}`);
      const device = c.director.root.device, controller = api.controller, scene = c.director.getScene();
      const gl = device.gl || device._gl;
      const extension = gl?.getExtension('WEBGL_debug_renderer_info');
      return { engineVersion: c.VERSION, ready: !!boot?.ready, bootErrors: boot?.errors || [],
        device: device.constructor.name, gfxAPI: device.gfxAPI,
        isWebGL: device.gfxAPI === c.gfx.API.WEBGL || device.gfxAPI === c.gfx.API.WEBGL2,
        gpuRenderer: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : undefined,
        glError: gl?.getError(), frames: c.director.getTotalFrames(), drawCalls: device.numDrawCalls, triangles: device.numTris,
        meshRenderers: scene.getComponentsInChildren(c.MeshRenderer).length,
        labels: scene.getComponentsInChildren(c.Label).length, page: controller.page,
        room: api.model.state.roomIndex + 1, phase: api.model.state.phase, shots: api.model.state.shots,
        visibleSize: { width: c.view.getVisibleSize().width, height: c.view.getVisibleSize().height },
        heroY: controller.hero.instance.root.position.y };
    });
    report.checkpoints.push({ label, ...value });
    if (value.engineVersion !== '3.8.8' || !value.isWebGL || value.device.includes('Empty') || value.bootErrors.length) throw new Error(`Unexpected runtime at ${label}: ${JSON.stringify(value)}`);
    if (!(value.drawCalls > 3 && value.triangles > 100 && value.meshRenderers > 10 && value.labels > 3)) throw new Error(`Incomplete 3D/UI draw at ${label}: ${JSON.stringify(value)}`);
    if (value.glError !== undefined && value.glError !== 0) throw new Error(`WebGL error ${value.glError} at ${label}`);
    await page.screenshot({ path: path.join(output, filename) });
    return value;
  }
  // Wait for a complete frame after the asynchronous model import.
  await page.waitForFunction(() => window.__monsterDenRuntime?.ready, undefined, { timeout: 10000 });
  const home = await checkpoint('home actual WebGL draw', '01-home.png');
  const button = await page.evaluate(() => {
    const c = window.cc, controller = window.__MONSTER_DEN__.controller;
    const label = c.director.getScene().getComponentsInChildren(c.Label).find(l => l.string === '潜入怪物窝' && l.node.activeInHierarchy);
    if (!label) throw new Error('Start button is missing.');
    const camera = controller.canvas.getComponent(c.Canvas).cameraComponent;
    const point = camera.worldToScreen(label.node.worldPosition);
    const canvas = document.querySelector('#GameCanvas'), rect = canvas.getBoundingClientRect();
    return { x: rect.left + point.x / canvas.width * rect.width, y: rect.bottom - point.y / canvas.height * rect.height };
  });
  await page.mouse.click(button.x, button.y);
  await page.waitForFunction(() => window.__MONSTER_DEN__.controller.page === 'game');
  const input = await page.evaluate(() => {
    const canvas = document.querySelector('#GameCanvas'), rect = canvas.getBoundingClientRect();
    return { x: rect.left + rect.width * .5, y: rect.top + rect.height * .52,
      distance: 165 * window.cc.view.getScaleY() * rect.height / canvas.height };
  });
  await page.mouse.move(input.x, input.y); await page.mouse.down();
  await page.mouse.move(input.x, input.y + input.distance, { steps: 10 });
  await checkpoint('native input aim preview', '02-aim.png');
  await page.mouse.up();
  await page.waitForFunction(() => window.__MONSTER_DEN__.model.state.shots === 1);
  await page.waitForFunction(() => window.__MONSTER_DEN__.model.state.phase === 'aiming', undefined, { timeout: 15000 });
  const game = await checkpoint('real shot and enemy turn finished', '03-game.png');
  if (!(game.frames > home.frames + 30)) throw new Error('The real Cocos frame loop did not advance.');
  const board = await page.evaluate(() => window.__MONSTER_DEN__.model.state.obstacles.find(obstacle => obstacle.kind === 'board')?.destroyed);
  if (!board) throw new Error('Pointer shot did not break the first board.');
  await page.setViewportSize({ width: 360, height: 640 });
  await page.waitForFunction(() => Math.abs(window.__MONSTER_DEN__.controller.height - 1280) < 2);
  await checkpoint('shorter portrait viewport', '04-portrait.png');
  if (report.errors.length || report.consoleErrors.length || report.failedRequests.length) throw new Error('Browser runtime, shader console or network errors were captured.');
  report.passed = true;
})().catch(error => { report.failure = error.stack || String(error); process.exitCode = 1; })
  .finally(async () => {
    fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    if (browser) await browser.close();
    if (server) await new Promise(resolve => server.close(resolve));
  });

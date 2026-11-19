#!/usr/bin/env node
/** Build the official Cocos 3.8.8 engine without modifying its source checkout. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const child = require('node:child_process');
const root = path.resolve(__dirname, '..');
const source = process.argv[2] || process.env.COCOS_ENGINE_SOURCE;
if (!source) throw new Error('Usage: node tools/build-engine.cjs /path/to/cocos-engine-v3.8.8');
const engine = path.resolve(source);
const version = JSON.parse(fs.readFileSync(path.join(engine, 'package.json'))).version;
if (version !== '3.8.8') throw new Error(`Expected engine 3.8.8, got ${version}`);
const { buildEngine } = require(path.join(engine, 'node_modules/@cocos/ccbuild'));
const features = ['base', '3d', 'animation', 'skeletal-animation', '2d', 'ui', 'graphics', 'mask', 'tween', 'audio', 'primitive', 'legacy-pipeline', 'gfx-webgl', 'gfx-webgl2'];
const output = path.join(root, '.build', 'engine');
const vendor = path.join(root, 'web', 'vendor');
(async () => {
  fs.mkdirSync(output, { recursive: true });
  fs.mkdirSync(vendor, { recursive: true });
  const result = await buildEngine({engine, out: output, platform: 'HTML5', mode: 'BUILD', moduleFormat: 'system', features, targets: {chrome: '80', ios: '14'}, flags: {DEBUG: true, CULL_MESHOPT: true}, compress: false, sourceMap: false});
  if (result.hasCriticalWarns) throw new Error('Engine compiler reported critical warnings.');
  const sourceText = fs.readFileSync(path.join(output, 'cc.js'), 'utf8');
  const {minify} = require(path.join(engine, 'node_modules/terser'));
  const minified = await minify(sourceText, {compress: {passes: 2}, mangle: true, format: {comments: false}});
  if (!minified.code) throw new Error('Engine minifier did not return JavaScript.');
  const compiled = Buffer.from('/*! Cocos Engine v3.8.8 | MIT | Cocos-Engine-LICENSE.txt */\n' + minified.code);
  fs.writeFileSync(path.join(vendor, 'cocos-3.8.8.js'), compiled);
  for (const name of ['LICENSE.md', 'LICENSE', 'LICENSE.txt']) {
    if (fs.existsSync(path.join(engine, name))) { fs.copyFileSync(path.join(engine, name), path.join(vendor, 'Cocos-Engine-LICENSE.txt')); break; }
  }
  const projectSystem = path.join(root, 'node_modules/systemjs');
  const systemRoot = fs.existsSync(projectSystem) ? projectSystem : path.join(engine, 'node_modules/systemjs');
  const systemVersion = JSON.parse(fs.readFileSync(path.join(systemRoot, 'package.json'))).version;
  if (systemVersion !== '6.15.1') throw new Error(`Expected SystemJS 6.15.1, got ${systemVersion}`);
  fs.copyFileSync(path.join(systemRoot, 'dist/system.min.js'), path.join(vendor, 'system-6.15.1.js'));
  fs.copyFileSync(path.join(systemRoot, 'LICENSE'), path.join(vendor, 'SystemJS-LICENSE.txt'));
  const chunks = Object.fromEntries(['cc-global', 'cc-local'].map(name => [name, fs.readFileSync(path.join(engine, 'editor/assets/chunks/builtin/uniforms', name + '.chunk'), 'utf8')]));
  fs.writeFileSync(path.join(vendor, 'uniform-chunks.json'), JSON.stringify(chunks));
  let sourceCommit = null;
  try { sourceCommit = child.execFileSync('git', ['-C', engine, 'rev-parse', 'HEAD'], {encoding:'utf8'}).trim(); } catch {}
  const receipt = {engine: 'Cocos Creator', version, sourceRepository: 'https://github.com/cocos/cocos-engine', sourceTag: '3.8.8', sourceCommit, builder: JSON.parse(fs.readFileSync(path.join(engine, 'node_modules/@cocos/ccbuild/package.json'))).version, features, moduleFormat: 'system', platform: 'HTML5', targets: {chrome: '80', ios: '14'}, patchedEngineSourceFiles: [], editorBuild: false, minified: true, sha256: crypto.createHash('sha256').update(compiled).digest('hex'), bytes: compiled.length};
  fs.writeFileSync(path.join(vendor, 'engine-build.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify(receipt, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });

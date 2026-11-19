#!/usr/bin/env node
/** Build the browser preview from the SAME Creator scripts and Boot.scene. */
const fs = require('node:fs');
const path = require('node:path');
const {createRequire} = require('node:module');
const root = path.resolve(__dirname, '..');
const projectRequire = createRequire(path.join(root, 'package.json'));
let ts;
try { ts = projectRequire('typescript'); }
catch (error) {
  if (!process.env.COCOS_ENGINE_SOURCE) throw new Error('Install dev dependencies, or set COCOS_ENGINE_SOURCE to the official engine checkout with its dependencies installed.');
  ts = require(path.join(process.env.COCOS_ENGINE_SOURCE, 'node_modules/typescript'));
}
const input = path.join(root, 'assets/scripts'), output = path.join(root, 'web/scripts');
const diagnostics = [];
let count = 0;
function walk(dir) {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(file); continue; }
    if (!entry.name.endsWith('.ts') || entry.name.endsWith('.d.ts')) continue;
    const result = ts.transpileModule(fs.readFileSync(file, 'utf8'), {fileName: file, reportDiagnostics: true,
      compilerOptions: {module: ts.ModuleKind.System, target: ts.ScriptTarget.ES2020, experimentalDecorators: true, useDefineForClassFields: false, sourceMap: false, importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove}});
    diagnostics.push(...(result.diagnostics || []));
    const dest = path.join(output, path.relative(input, file)).replace(/\.ts$/, '.js');
    fs.mkdirSync(path.dirname(dest), {recursive: true}); fs.writeFileSync(dest, result.outputText); count++;
  }
}
function copyAssets(source, dest) {
  if (!fs.existsSync(source)) return;
  fs.mkdirSync(dest, {recursive: true});
  for (const entry of fs.readdirSync(source, {withFileTypes: true})) {
    if (entry.name.endsWith('.meta')) continue;
    const from = path.join(source, entry.name), to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyAssets(from, to); else fs.copyFileSync(from, to);
  }
}
walk(input);
const errors = diagnostics.filter(d => d.category === ts.DiagnosticCategory.Error);
if (errors.length) { for (const d of errors) console.error(ts.flattenDiagnosticMessageText(d.messageText, '\n')); process.exit(1); }
fs.copyFileSync(path.join(root, 'assets/Boot.scene'), path.join(root, 'web/Boot.scene'));
// Rebuild this generated directory so moved/deleted assets cannot linger in Pages.
fs.rmSync(path.join(root, 'web/resources'), {recursive: true, force: true});
copyAssets(path.join(root, 'assets/resources'), path.join(root, 'web/resources'));
copyAssets(path.join(root, 'assets/models'), path.join(root, 'web/resources/models'));
for (const bundle of ['sound','music-camp','music-explore','music-boss'])
  copyAssets(path.join(root, 'assets', bundle), path.join(root, 'web/resources/audio'));
const meta = JSON.parse(fs.readFileSync(path.join(root, 'assets/scripts/GameMain.ts.meta'), 'utf8'));
const sceneMeta = JSON.parse(fs.readFileSync(path.join(root, 'assets/Boot.scene.meta'), 'utf8'));
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
fs.writeFileSync(path.join(root, 'web/build-info.json'), JSON.stringify({version: packageJson.version, engineVersion: '3.8.8', controllerUuid: meta.uuid, sceneUuid: sceneMeta.uuid, sourceScripts: count, editorBuild: false, platform: 'HTML5 source preview'}, null, 2));
console.log(`Built ${count} TypeScript modules and shared Boot.scene. This is a real Cocos runtime preview, not a Creator-editor platform package.`);

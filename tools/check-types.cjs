#!/usr/bin/env node
/** Strictly check every game TS module against the official 3.8.8 source types.
 * This does not invent a permissive `declare module 'cc'` shim. The source
 * checkout is read-only; generated files and diagnostics stay in .build.
 */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const engine = process.env.COCOS_ENGINE_SOURCE;
if (!engine) throw new Error('Set COCOS_ENGINE_SOURCE to an official cocos-engine 3.8.8 checkout with its build dependencies installed.');
const engineVersion = JSON.parse(fs.readFileSync(path.join(engine, 'package.json'), 'utf8')).version;
if (engineVersion !== '3.8.8') throw new Error(`Expected Cocos 3.8.8, found ${engineVersion}`);
const ts = require(path.join(engine, 'node_modules/typescript'));
const { StatsQuery, Modularize } = require(path.join(engine, 'node_modules/@cocos/ccbuild'));
const out = path.join(root, '.build/typecheck');
fs.mkdirSync(out, { recursive: true });
function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const name = path.join(dir, entry.name);
    return entry.isDirectory() ? files(name) : name.endsWith('.ts') ? [name] : [];
  });
}
function diagnostic(d) {
  const location = d.file && d.start !== undefined ? d.file.getLineAndCharacterOfPosition(d.start) : undefined;
  return { code: d.code, category: ts.DiagnosticCategory[d.category],
    file: d.file ? path.relative(root, d.file.fileName) : undefined,
    line: location ? location.line + 1 : undefined, column: location ? location.character + 1 : undefined,
    message: ts.flattenDiagnosticMessageText(d.messageText, '\n') };
}
(async () => {
  const query = await StatsQuery.create(engine);
  const features = JSON.parse(fs.readFileSync(path.join(root, 'web/vendor/engine-build.json'), 'utf8')).features;
  const units = query.getUnitsOfFeatures(features);
  const ccEntry = path.join(out, 'cc.ts');
  fs.writeFileSync(ccEntry, query.evaluateIndexModuleSource(units, unit => query.getFeatureUnitFile(unit).replace(/\\/g, '/').replace(/\.ts$/, '')));
  const engineConfig = ts.readConfigFile(path.join(engine, 'tsconfig.json'), ts.sys.readFile);
  if (engineConfig.error) throw new Error(ts.flattenDiagnosticMessageText(engineConfig.error.messageText, '\n'));
  const inherited = ts.parseJsonConfigFileContent(engineConfig.config, ts.sys, engine);
  const engineTypes = (inherited.options.types || []).map(file => file.startsWith('.') ? path.resolve(engine, file) : file);
  const absentEngineTypes = engineTypes.filter(file => !ts.sys.fileExists(file + '.d.ts') && !ts.sys.fileExists(file));
  const options = { ...inherited.options, strict: true, noImplicitAny: true, noEmit: true,
    target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.NodeJs,
    lib: ['lib.es2020.d.ts', 'lib.dom.d.ts'], experimentalDecorators: true, useDefineForClassFields: false,
    skipLibCheck: true, rootDir: undefined, baseUrl: engine,
    types: engineTypes.filter(file => !absentEngineTypes.includes(file)),
    paths: { ...inherited.options.paths, cc: [ccEntry] } };
  const exportMap = await new Modularize.ModuleQuery({ engine, platform: 'WEB_EDITOR', customExportConditions: ['types'] }).getExportMap();
  const host = ts.createCompilerHost(options);
  host.resolveModuleNames = (names, containingFile) => names.map(name => exportMap[name]
    ? { resolvedFileName: exportMap[name] }
    : ts.resolveModuleName(name, containingFile, options, host).resolvedModule);
  const gameFiles = files(path.join(root, 'assets/scripts'));
  const program = ts.createProgram(gameFiles, options, host);
  const checker = program.getTypeChecker();
  const projectDiagnostics = [...program.getOptionsDiagnostics(), ...program.getGlobalDiagnostics()];
  const ccImports = [];
  for (const file of gameFiles) {
    const source = program.getSourceFile(file);
    projectDiagnostics.push(...program.getSyntacticDiagnostics(source), ...program.getSemanticDiagnostics(source));
    for (const statement of source.statements) {
      if (!ts.isImportDeclaration(statement) || statement.moduleSpecifier.text !== 'cc') continue;
      for (const element of statement.importClause?.namedBindings?.elements || []) {
        const symbol = checker.getSymbolAtLocation(element.name);
        const actual = symbol && symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
        const type = actual ? checker.getTypeOfSymbolAtLocation(actual, element) : undefined;
        ccImports.push({ name: element.propertyName?.text || element.name.text,
          file: path.relative(root, file),
          declarations: (actual?.declarations || []).map(d => path.relative(engine, d.getSourceFile().fileName)),
          unresolvedOrAny: !actual || !actual.declarations?.length || !!(type?.flags & ts.TypeFlags.Any) });
      }
    }
  }
  const diagnostics = projectDiagnostics.map(diagnostic);
  const unresolvedImports = ccImports.filter(entry => entry.unresolvedOrAny);
  const result = { engineVersion, typescriptVersion: ts.version,
    typeSource: 'Official Cocos 3.8.8 TypeScript API sources, through the same ccbuild feature exports as the runtime',
    strict: true, noImplicitAny: true, files: gameFiles.map(file => path.relative(root, file)),
    diagnostics, unresolvedImports, ccImports,
    excludedEngineNativeTypePackages: absentEngineTypes.map(file => path.relative(engine, file)),
    scope: 'All project scripts. Engine implementation diagnostics and unavailable native-platform SDK declarations are not project build gates. No API shim or any-typed cc module is used.',
    passed: !diagnostics.some(d => d.category === 'Error') && unresolvedImports.length === 0 };
  fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(result, null, 2));
  for (const d of diagnostics) console.log(`${d.file || 'config'}${d.line ? `:${d.line}:${d.column}` : ''} TS${d.code}: ${d.message}`);
  if (unresolvedImports.length) console.log('Unresolved Cocos imports:', unresolvedImports);
  console.log(JSON.stringify({ passed: result.passed, files: gameFiles.length, importedCocosSymbols: ccImports.length,
    errors: diagnostics.filter(d => d.category === 'Error').length, engineVersion, typescriptVersion: ts.version, report: '.build/typecheck/result.json' }, null, 2));
  if (!result.passed) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });

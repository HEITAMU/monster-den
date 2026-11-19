const {spawnSync}=require('node:child_process');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const tsc=spawnSync('tsc',['-p','tsconfig.preview.json'],{cwd:root,stdio:'inherit'});
if(tsc.status!==0)process.exit(tsc.status||1);
const test=spawnSync(process.execPath,['--test','tests/game.test.mjs'],{cwd:root,stdio:'inherit'});
if(test.status!==0)process.exit(test.status||1);
const assets=spawnSync('python3',['tools/check-assets.py'],{cwd:root,stdio:'inherit'});
if(assets.status!==0)process.exit(assets.status||1);

#!/usr/bin/env node
/** An actual browser/GPU smoke, not a headless mock of Cocos. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {createRequire}=require('node:module');
const requireRuntime=createRequire(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES || process.cwd()+'/node_modules','playwright/package.json'));
const {chromium}=requireRuntime('playwright');
const root=path.resolve(__dirname,'../web'),output=path.resolve(__dirname,'../.build/engine-smoke');
fs.mkdirSync(output,{recursive:true});
const result={test:'Official Cocos 3.8.8 source runtime, WebGL mesh/material/tween/UI',errors:[],console:[],httpErrors:[]};
const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png','.bin':'application/octet-stream'};
const server=http.createServer((req,res)=>{let p=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!p.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}fs.readFile(p,(err,data)=>{if(err){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',mime[path.extname(p)]||'application/octet-stream');res.end(data);});});
(async()=>{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;try{
 const executablePath=process.env.CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined);
 browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{}),args:['--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:420,height:780},deviceScaleFactor:1});
 page.on('pageerror',e=>result.errors.push(e.stack||String(e)));page.on('console',m=>{if(['error','warning'].includes(m.type()))result.console.push({type:m.type(),text:m.text()});});page.on('response',r=>{if(r.status()>=400)result.httpErrors.push({url:r.url(),status:r.status()});});
 await page.goto(`http://127.0.0.1:${server.address().port}/engine-smoke.html`,{waitUntil:'load'});
 await page.waitForFunction(()=>window.__engineSmoke?.ready||window.__engineSmoke?.errors?.length,undefined,{timeout:25000});
 const state=()=>page.evaluate(()=>{const s=window.__engineSmoke;return {...s,subject:undefined,rotation:s.subject?.eulerAngles.y,frames:window.cc?.director?.getTotalFrames(),drawCalls:window.cc?.director?.root?.device?.numDrawCalls,triangles:window.cc?.director?.root?.device?.numTris};});
 result.initial=await state();await page.waitForTimeout(400);result.after=await state();
 await page.screenshot({path:path.join(output,'engine-smoke.png')});
 if(!result.after.ready||result.after.errors.length||result.errors.length)throw new Error('Runtime initialization/render failed.');
 if(!(result.after.frames>result.initial.frames))throw new Error('Cocos frame loop did not advance.');
 if(!(result.after.drawCalls>=2&&result.after.triangles>100))throw new Error('3D mesh and UI did not issue expected draw calls.');
 if(result.after.rotation===result.initial.rotation)throw new Error('Cocos tween animation did not advance.');
 result.passed=true;
}catch(error){result.failure=error.stack||String(error);process.exitCode=1;}finally{fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}})();

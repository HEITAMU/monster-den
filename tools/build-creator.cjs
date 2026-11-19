#!/usr/bin/env node
/** Invoke a real installed Creator editor; never fake an editor build. */
const fs=require('node:fs'),path=require('node:path'),child=require('node:child_process');
const root=path.resolve(__dirname,'..');
const creator=process.env.COCOS_CREATOR_388;
if(!creator||!fs.existsSync(creator))throw new Error('Set COCOS_CREATOR_388 to the executable of Cocos Creator 3.8.8. No Creator editor is bundled with this repository.');
const platform=process.argv[2]||'wechatgame';
if(!['wechatgame','web-mobile'].includes(platform))throw new Error('Supported targets: wechatgame, web-mobile');
const meta=JSON.parse(fs.readFileSync(path.join(root,'assets/Boot.scene.meta')));
const options={platform,buildPath:'project://build',debug:false,md5Cache:true,startScene:meta.uuid,scenes:[{url:'db://assets/Boot.scene',uuid:meta.uuid}],name:'Monster Den',outputName:platform,packages:{}};
if(platform==='wechatgame'){
 const appid=process.env.WECHAT_APP_ID;
 if(!appid||!/^wx[0-9a-f]{16}$/i.test(appid))throw new Error('Set WECHAT_APP_ID to the intended project AppID. A production account is never inferred from another project.');
 options.packages.wechatgame={appid,orientation:'portrait',remoteServerAddress:'',startSceneAssetBundle:false};
}
const config=path.join(root,'.build',`creator-${platform}.json`);fs.mkdirSync(path.dirname(config),{recursive:true});fs.writeFileSync(config,JSON.stringify(options,null,2));
const started=Date.now();
const result=child.spawnSync(creator,['--project',root,'--build',`configPath=${config}`],{stdio:'inherit'});
if(result.error)throw result.error;
// Cocos documents 36 as build success. A recent output is required as well.
const marker=path.join(root,'build',platform,platform==='wechatgame'?'game.json':'index.html');
const generated=fs.existsSync(marker)&&fs.statSync(marker).mtimeMs>=started-2000;
if(![0,36].includes(result.status)||!generated){console.error('Creator did not produce a verified fresh build output.',{exitCode:result.status,marker,generated});process.exitCode=1;}
else{console.log('Creator build output verified:',marker);process.exitCode=0;}

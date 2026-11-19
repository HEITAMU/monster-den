import {assetManager} from 'cc';
import {loadGameBundle} from './ResourceBundles';
import type {GameAudioOptions,MusicScene,SoundCue} from './platform/GameAudio';

/** Stable names shared by Creator bundles and the source-runtime preview. */
const VARIATIONS:Partial<Record<SoundCue,number>>={
  launch:2,stone_hit:3,wood_hit:3,wood_break:3,cabinet_push:3,
  enemy_hit:3,enemy_down:2,arrow:2,arrow_blocked:3,loot:2,danger:2,click:2,tool:2,
};

async function nativeUrls(bundleName:string,names:string[]):Promise<Record<string,string>> {
  if((globalThis as any).__monsterDenRuntime)
    return Object.fromEntries(names.map(name=>[name,`./resources/audio/${name}.mp3`]));
  const bundle=await loadGameBundle(bundleName,8000);
  return Object.fromEntries(names.map(name=>{
    const info=bundle.getInfoWithPath(name);
    if(!info)throw new Error(`Missing audio asset ${bundleName}/${name}`);
    // Query native addresses only. Loading AudioClip here would decode and cache
    // a second copy of every long score inside the Cocos WebAudio player.
    return [name,assetManager.utils.getUrlWithUuid(info.uuid,{isNative:true,nativeExt:'.mp3'})];
  }));
}

/** Audio failures stay audio failures; a late boss subpackage must not block the first room. */
export async function loadAudioCatalog(onWarning:(message:string)=>void=message=>console.warn('[MonsterDen audio]',message)):
Promise<Pick<GameAudioOptions,'resolveMusicUrl'|'assetUrls'>> {
  const cueNames=Object.entries(VARIATIONS).flatMap(([cue,count])=>Array.from({length:count!},(_,i)=>`${cue}-${i+1}`));
  let sound:Record<string,string>={};
  try{sound=await nativeUrls('sound',[...cueNames,'win','lose']);}
  catch(error){try{onWarning(`动作音效分包暂不可用，游戏仍可继续：${String((error as Error)?.message||error)}`);}catch{/* Diagnostics never block gameplay. */}}
  const assetUrls:GameAudioOptions['assetUrls']={};
  for(const cue of ['win','lose'] as const)if(sound[cue])assetUrls[cue]=sound[cue];
  for(const [cue,count] of Object.entries(VARIATIONS)){
    const variants=Array.from({length:count!},(_,i)=>sound[`${cue}-${i+1}`]).filter(Boolean);
    if(variants.length)assetUrls[cue as SoundCue]=variants;
  }
  const resolveMusicUrl=async(scene:MusicScene):Promise<string|null>=>{
    const name=`music-${scene}`;
    const files=await nativeUrls(name,[name]);
    return files[name]||null;
  };
  return {resolveMusicUrl,assetUrls};
}

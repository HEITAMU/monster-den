import {assetManager,AssetManager} from 'cc';

const pending=new Map<string,Promise<AssetManager.Bundle>>();

/** Share a bundle request when model and audio loaders start together. */
export function loadGameBundle(name:string,timeoutMs=15000):Promise<AssetManager.Bundle> {
  const ready=assetManager.getBundle(name);
  if(ready)return Promise.resolve(ready);
  const previous=pending.get(name);if(previous)return previous;
  const request=new Promise<AssetManager.Bundle>((resolve,reject)=>{
    let settled=false;
    const timer=setTimeout(()=>{if(!settled){settled=true;reject(new Error(`资源分包 ${name} 加载超时。`));}},Math.max(100,timeoutMs));
    try{
      assetManager.loadBundle(name,(error,bundle)=>{
        if(settled)return;settled=true;clearTimeout(timer);
        if(error)reject(error);else resolve(bundle);
      });
    }catch(error){settled=true;clearTimeout(timer);reject(error);}
  });
  pending.set(name,request);
  void request.then(()=>pending.delete(name),()=>pending.delete(name));
  return request;
}

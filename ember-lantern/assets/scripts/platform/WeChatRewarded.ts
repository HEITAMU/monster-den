/** Disabled-by-default ad adapter; only full video close pays out. */
export const AD_UNIT_ID=''; // Fill from WeChat Monetization console once enabled.
export class WeChatRewarded {
 private ad:any=null; private busy=false;
 get enabled():boolean{return !!AD_UNIT_ID && typeof (globalThis as any).wx?.createRewardedVideoAd==='function';}
 async show():Promise<boolean>{
  if(!this.enabled||this.busy)return false;
  const wx=(globalThis as any).wx;this.busy=true;
  try{
   if(!this.ad)this.ad=wx.createRewardedVideoAd({adUnitId:AD_UNIT_ID});
   const ad=this.ad;
   return await new Promise<boolean>((resolve)=>{
    let complete=false;
    const cleanup=()=>{ad.offClose?.(onClose);ad.offError?.(onError);this.busy=false;};
    const onClose=(res:any)=>{if(complete)return;complete=true;cleanup();resolve(res?.isEnded===true);};
    const onError=()=>{if(complete)return;complete=true;cleanup();resolve(false);};
    ad.onClose(onClose);ad.onError(onError);
    Promise.resolve(ad.show()).catch(()=>ad.load().then(()=>ad.show())).catch(onError);
   });
  }catch(e){this.busy=false;console.warn('[Ember] ad failed',e);return false;}
 }
}

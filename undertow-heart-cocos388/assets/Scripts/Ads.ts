/** Explicit opt-in rewarded WeChat ads; no fake success when unit is absent. */
export const WECHAT_REWARDED_UNIT_ID='adunit-REPLACE_WITH_YOUR_UNIT';
export type AdResult='completed'|'skipped'|'unavailable'|'error'|'busy';
export class Ads{
 private api:any=null;private pending=false;
 constructor(){const wx=(globalThis as any).wx;
  if(/^adunit-[A-Za-z0-9]{10,}$/.test(WECHAT_REWARDED_UNIT_ID)&&!WECHAT_REWARDED_UNIT_ID.includes('REPLACE')&&typeof wx?.createRewardedVideoAd==='function'){
   try{this.api=wx.createRewardedVideoAd({adUnitId:WECHAT_REWARDED_UNIT_ID});}catch(_e){}
  }
 }
 ready(){return !!this.api;}
 async watch():Promise<AdResult>{
  const ad=this.api;if(!ad)return 'unavailable';if(this.pending)return 'busy';this.pending=true;
  return new Promise<AdResult>(resolve=>{
   let settled=false;
   const stop=(value:AdResult)=>{if(settled)return;settled=true;this.pending=false;
    ad.offClose?.(close);ad.offError?.(error);resolve(value);};
   const close=(event?:{isEnded?:boolean})=>stop(event?.isEnded===true?'completed':'skipped');
   const error=()=>stop('error');
   ad.onClose(close);ad.onError?.(error);
   const show=()=>{try{Promise.resolve(ad.show()).catch(error);}catch(_e){error();}};
   Promise.resolve().then(()=>ad.load()).then(show).catch(show);
  });
 }
}

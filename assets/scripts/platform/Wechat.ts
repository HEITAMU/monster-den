import { sys } from 'cc';
declare const wx: any;
export const AD_UNITS={banner:'',rewarded:'',interstitial:''};
export const CLOUD_KEY='nine_seals_daily_v1';
export interface DailyScore {day:string; extra:number; ms:number; perfect:number;}
export interface Save {chapter:number; daily:Record<string,DailyScore>; chapters:Record<string,number>;}
export const isWechat=()=>typeof wx!=='undefined'&&typeof wx.getSystemInfoSync==='function';
export function loadSave():Save{
  const empty:Save={chapter:1,daily:{},chapters:{}};
  try{const raw=sys.localStorage.getItem('crown-save-v1');if(!raw)return empty;const v=JSON.parse(raw);return {
    chapter:Number.isInteger(v.chapter)&&v.chapter>0?Math.min(v.chapter,10000):1,
    daily:v.daily&&typeof v.daily==='object'?v.daily:{},chapters:v.chapters&&typeof v.chapters==='object'?v.chapters:{}
  };}catch(_){return empty;}
}
export function store(s:Save):void{try{sys.localStorage.setItem('crown-save-v1',JSON.stringify(s));}catch(_){}}
export function isBetter(a:DailyScore,b?:DailyScore):boolean{return !b||a.extra<b.extra||(a.extra===b.extra&&a.ms<b.ms);}
export class Wechat {
  private banner:any=null;private rewarded:any=null;private interstitial:any=null;
  private videoResolve:((value:boolean)=>void)|null=null;private lastInter=0;private day='';
  constructor(){if(!isWechat())return;
    try{wx.showShareMenu({withShareTicket:false});wx.onShareAppMessage(()=>({title:'九印王座｜今天你能比我少走几步？',query:'day='+this.day}));}catch(_){ }
    try{
      if(AD_UNITS.banner){const screen=wx.getSystemInfoSync();this.banner=wx.createBannerAd({adUnitId:AD_UNITS.banner,style:{left:0,top:screen.windowHeight-90,width:screen.windowWidth},adIntervals:45});
        this.banner.onResize((e:any)=>{this.banner.style.left=(screen.windowWidth-e.width)/2;this.banner.style.top=screen.windowHeight-e.height;});
        this.banner.onError((e:any)=>console.warn('banner error',e));}
      if(AD_UNITS.rewarded){this.rewarded=wx.createRewardedVideoAd({adUnitId:AD_UNITS.rewarded});
        this.rewarded.onClose((r:any)=>{const cb=this.videoResolve;this.videoResolve=null;if(cb)cb(Boolean(r&&r.isEnded));});
        this.rewarded.onError((e:any)=>{console.warn('reward video error',e);this.cancelVideo();});}
      if(AD_UNITS.interstitial){this.interstitial=wx.createInterstitialAd({adUnitId:AD_UNITS.interstitial});this.interstitial.onError((e:any)=>console.warn('interstitial error',e));}
    }catch(e){console.warn('ad SDK',e);}
  }
  incomingDay():string{if(!isWechat())return '';try{const s=String(wx.getLaunchOptionsSync().query?.day||'');return /^20\d{6}$/.test(s)?s:'';}catch(_){return '';}}
  setDay(day:string):void{this.day=day;}
  share(day:string,extra?:number):boolean{
    if(!isWechat())return false;this.setDay(day);
    const title=extra===0?'九印王座｜今日三关全部最优，我已登顶！':typeof extra==='number'?
      `九印王座｜今日三关仅多走${extra}步，你敢挑战吗？`:'九印王座｜你能解开今天的三重密令吗？';
    try{wx.shareAppMessage({title,query:'day='+day});return true;}catch(_){return false;}
  }
  showBanner(visible:boolean):void{if(!this.banner)return;try{if(visible)this.banner.show().catch(()=>{});else this.banner.hide();}catch(_){}}
  async hintAd():Promise<'earned'|'cancelled'|'unavailable'>{
    if(!this.rewarded||this.videoResolve)return 'unavailable';
    const viewed=await new Promise<boolean>(async resolve=>{
      this.videoResolve=resolve;
      try{await this.rewarded.show().catch(()=>this.rewarded.load().then(()=>this.rewarded.show()));}
      catch(_){this.cancelVideo();}
    });return viewed?'earned':'cancelled';
  }
  private cancelVideo():void{const cb=this.videoResolve;this.videoResolve=null;if(cb)cb(false);}
  showInterAtMilestone(clears:number):void{if(!this.interstitial||clears<1||clears%5!==0||Date.now()-this.lastInter<180000)return;
    this.lastInter=Date.now();try{this.interstitial.show().catch(()=>{});}catch(_){}}
  cloudScore(s:DailyScore):void{if(!isWechat())return;try{
    wx.setUserCloudStorage({KVDataList:[{key:CLOUD_KEY,value:`${s.day}|${s.extra}|${s.ms}|${s.perfect}`}],fail:(e:any)=>console.warn('cloud save',e)});
  }catch(e){console.warn('cloud score',e);}}
  rank(day:string):boolean{if(!isWechat())return false;try{wx.getOpenDataContext().postMessage({type:'crown:rank',key:CLOUD_KEY,day});return true;}catch(_){return false;}}
  tap():void{if(!isWechat())return;try{wx.vibrateShort({type:'light'});}catch(_){}}
  dispose():void{this.cancelVideo();try{this.banner?.destroy();this.rewarded?.destroy();this.interstitial?.destroy();}catch(_){}}
}

import { sys } from 'cc';
declare const wx: any;
export interface DailyRecord { day: string; excess: number; milliseconds: number; perfect: number; }
export interface PlayerSave { chapter: number; daily: Record<string, DailyRecord>; chapterBest: Record<string, number>; }
const SAVE_KEY = 'nine-seals-save-v1';

export const AD_CONFIG = {
  // 在微信公众平台开通流量主后填写真实广告位 ID；空字符串表示广告尚未开通。
  banner: '', rewarded: '', interstitial: '',
};
export const CLOUD_SCORE_KEY = 'nine_seals_daily_v1';
export function isWechat(): boolean { return typeof wx !== 'undefined' && typeof wx.getSystemInfoSync === 'function'; }
export function loadSave(): PlayerSave {
  const fallback: PlayerSave = { chapter: 1, daily: {}, chapterBest: {} };
  try {
    const raw = sys.localStorage.getItem(SAVE_KEY); if (!raw) return fallback;
    const data = JSON.parse(raw);
    return {
      chapter: Number.isInteger(data.chapter) && data.chapter > 0 ? Math.min(data.chapter, 9999) : 1,
      daily: data.daily && typeof data.daily === 'object' ? data.daily : {},
      chapterBest: data.chapterBest && typeof data.chapterBest === 'object' ? data.chapterBest : {},
    };
  } catch (_) { return fallback; }
}
export function saveProgress(data: PlayerSave): void {
  try { sys.localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (_) { /* storage full: no crash */ }
}
export function better(a: DailyRecord, b?: DailyRecord): boolean {
  return !b || a.excess < b.excess || (a.excess === b.excess && a.milliseconds < b.milliseconds);
}

export class WechatBridge {
  private banner: any = null;
  private reward: any = null;
  private interstitial: any = null;
  private lastInterstitial = 0;
  private shareDay = '';
  private videoPending: ((watched: boolean) => void) | null = null;

  constructor() {
    if (!isWechat()) return;
    try {
      wx.showShareMenu({ withShareTicket: false });
      wx.onShareAppMessage(() => ({
        title: '九印王座｜我已经解开今日王冠，你能用更少的步数吗？',
        imageUrl: 'share.jpg',
        query: this.shareDay ? 'day=' + this.shareDay : '',
      }));
    } catch (_) { /* unsupported devtool */ }
    try {
      if (AD_CONFIG.banner) {
        const info = wx.getSystemInfoSync();
        this.banner = wx.createBannerAd({ adUnitId: AD_CONFIG.banner, style: {
          left: 0, top: info.windowHeight - 100, width: Math.max(300, info.windowWidth),
        }, adIntervals: 45 });
        this.banner.onResize((r: any) => { this.banner.style.left = (info.windowWidth - r.width) / 2; this.banner.style.top = info.windowHeight - r.height; });
        this.banner.onError((e: any) => console.warn('[广告] banner', e));
      }
      if (AD_CONFIG.rewarded) {
        this.reward = wx.createRewardedVideoAd({ adUnitId: AD_CONFIG.rewarded });
        this.reward.onClose((res: any) => {
          const cb = this.videoPending; this.videoPending = null;
          if (cb) cb(Boolean(res && res.isEnded === true)); // Never reward for premature exit
        });
        this.reward.onError((e: any) => { console.warn('[广告] rewarded', e); this.cancelReward(); });
      }
      if (AD_CONFIG.interstitial) {
        this.interstitial = wx.createInterstitialAd({ adUnitId: AD_CONFIG.interstitial });
        this.interstitial.onError((e: any) => console.warn('[广告] interstitial', e));
      }
    } catch (e) { console.warn('[广告] platform unavailable', e); }
  }
  get incomingDay(): string {
    if (!isWechat()) return '';
    try {
      const day = String(wx.getLaunchOptionsSync().query?.day || '');
      return /^20\d{6}$/.test(day) ? day : '';
    } catch (_) { return ''; }
  }
  setShareDay(day: string): void { this.shareDay = /^20\d{6}$/.test(day) ? day : ''; }
  share(day: string, extra: number | null = null): boolean {
    if (!isWechat()) return false;
    this.setShareDay(day);
    const title = extra === null ? '来挑战《九印王座》今日密令，看看谁才是真正的解谜高手！'
      : extra === 0 ? '九印王座｜我用理论最少步数解开了三重密令，你能做到吗？'
      : `九印王座｜我今日只多用了${extra}步，敢来超越吗？`;
    try { wx.shareAppMessage({ title, imageUrl: 'share.jpg', query: 'day=' + day }); return true; }
    catch (e) { console.warn('[分享] failed', e); return false; }
  }
  showBanner(show: boolean): void {
    if (!this.banner) return;
    try { if (show) this.banner.show().catch(() => {}); else this.banner.hide(); } catch (_) { /* no-op */ }
  }
  async playHintAd(): Promise<'earned' | 'cancelled' | 'unavailable'> {
    if (!this.reward || this.videoPending) return 'unavailable';
    return new Promise(async resolve => {
      this.videoPending = ok => resolve(ok ? 'earned' : 'cancelled');
      try { await this.reward.show().catch(() => this.reward.load().then(() => this.reward.show())); }
      catch (e) { console.warn('[广告] video unavailable', e); this.cancelReward(); }
    });
  }
  private cancelReward(): void { const cb = this.videoPending; this.videoPending = null; if (cb) cb(false); }
  maybeInterstitial(campaignClears: number): void {
    if (!this.interstitial || campaignClears === 0 || campaignClears % 5 !== 0) return;
    const now = Date.now(); if (now - this.lastInterstitial < 180000) return;
    this.lastInterstitial = now;
    try { this.interstitial.show().catch(() => {}); } catch (_) { /* best effort */ }
  }
  saveDailyScore(rec: DailyRecord): void {
    if (!isWechat()) return;
    const raw = `${rec.day}|${Math.max(0, Math.trunc(rec.excess))}|${Math.max(1,Math.trunc(rec.milliseconds))}|${rec.perfect}`;
    try { wx.setUserCloudStorage({ KVDataList: [{ key: CLOUD_SCORE_KEY, value: raw }], fail: (e: any) => console.warn('[好友榜] 保存失败', e) }); }
    catch (e) { console.warn('[好友榜] SDK error', e); }
  }
  showFriends(day: string): boolean {
    if (!isWechat()) return false;
    try { wx.getOpenDataContext().postMessage({ type: 'nine_seals:rank', day, key: CLOUD_SCORE_KEY }); return true; }
    catch (e) { console.warn('[好友榜] SDK error', e); return false; }
  }
  vibrate(): void {
    if (!isWechat()) return;
    try { wx.vibrateShort({ type: 'light' }); } catch (_) { /* ignore */ }
  }
  destroy(): void {
    this.cancelReward();
    try { if (this.banner) this.banner.destroy(); if (this.reward) this.reward.destroy(); if (this.interstitial) this.interstitial.destroy(); } catch (_) {}
  }
}

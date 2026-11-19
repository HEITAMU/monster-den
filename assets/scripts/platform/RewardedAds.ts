/** Rewarded advertising, with no fabricated ad success and no dependency on Cocos. */
export type AdPlacement = 'rescue' | 'settlement_bonus' | 'tool_trial';
export type AdSource = 'wechat' | 'test' | 'none';
export type AdStatus = 'completed' | 'cancelled' | 'unavailable' | 'busy' | 'ineligible' | 'already_claimed' | 'pending_reward' | 'error' | 'disposed';
export type AdPhase = 'idle' | 'loading' | 'showing' | 'test_prompt';

export interface AdRewardReceipt {
  id: string;
  runId: string;
  placement: AdPlacement;
  source: 'wechat' | 'test';
  status: 'pending' | 'applied';
  createdAt: number;
  appliedAt?: number;
}

export interface RewardLedger {
  getReward(runId: string, placement: AdPlacement): AdRewardReceipt | null;
  createPendingReward(input: { id: string; runId: string; placement: AdPlacement; source: 'wechat' | 'test' }): {
    ok: boolean; receipt?: AdRewardReceipt; duplicate?: boolean; error?: string;
  };
}

export interface AdResult {
  status: AdStatus;
  source: AdSource;
  message: string;
  receipt?: AdRewardReceipt;
  reason?: string;
}

export interface AdRequest {
  placement: AdPlacement;
  runId: string;
  /** Required: request must be called from the player's deliberate ad-button action. */
  userInitiated: boolean;
  /** Gameplay determines whether a failed run can be rescued, or a result can be claimed. */
  eligible: boolean;
}

export interface TestAdPrompt {
  title: string;
  message: string;
  placement: AdPlacement;
  runId: string;
  choices: readonly ['complete', 'cancel', 'error'];
  /** Optional cancellation supplied by the service when it is disposed or times out. */
  signal?: any;
}

export interface RewardedAdsOptions {
  ledger: RewardLedger;
  /** Empty by default. Obtain a real ID from the game's approved WeChat account. */
  adUnitId?: string;
  environment?: any;
  /** Explicit debug opt-in. Ignored in WeChat even if true. */
  allowWebTestAds?: boolean;
  requestTestDecision?: (prompt: TestAdPrompt) => Promise<'complete' | 'cancel' | 'error'>;
  onPhaseChange?: (phase: AdPhase) => void;
  loadTimeoutMs?: number;
  closeTimeoutMs?: number;
  cooldownMs?: number;
  now?: () => number;
}

interface Session {
  id: string;
  request: AdRequest;
  source: 'wechat' | 'test';
  resolve: (result: AdResult) => void;
  settled: boolean;
  shown: boolean;
  pendingClose?: any;
  timer?: ReturnType<typeof setTimeout>;
  cleanup?: () => void;
  abortPrompt?: () => void;
}

const wxLocks = new WeakMap<object, object>();

function errorMessage(error: any): string { return String(error?.errMsg ?? error?.message ?? error ?? '未知错误'); }

/** An opt-in browser harness. It never completes itself and is always labelled as a test. */
export function createBrowserTestPrompt(environment: any = globalThis): (prompt: TestAdPrompt) => Promise<'complete' | 'cancel' | 'error'> {
  return prompt => new Promise(resolve => {
    const document = environment.document;
    if (!document?.createElement || !document.body) { resolve('error'); return; }
    const shade = document.createElement('div');
    const card = document.createElement('div');
    shade.setAttribute('role', 'dialog');
    shade.setAttribute('aria-modal', 'true');
    shade.setAttribute('aria-label', prompt.title);
    shade.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#10151dcc;display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box;font-family:system-ui,sans-serif';
    card.style.cssText = 'max-width:360px;width:100%;background:#f5edd9;color:#28251f;border:3px solid #b77c35;border-radius:22px;padding:24px;box-shadow:0 16px 60px #0008';
    const title = document.createElement('h2');
    title.textContent = prompt.title;
    title.style.cssText = 'margin:0 0 12px;font-size:20px';
    const body = document.createElement('p');
    body.textContent = prompt.message;
    body.style.cssText = 'font-size:14px;line-height:1.65';
    card.append(title, body);
    let settled = false;
    const finish = (result: 'complete' | 'cancel' | 'error') => {
      if (settled) return;
      settled = true;
      environment.removeEventListener?.('pagehide', pagehide);
      prompt.signal?.removeEventListener?.('abort', abort);
      shade.remove();
      resolve(result);
    };
    const pagehide = () => finish('cancel');
    const abort = () => finish('cancel');
    const labels = { complete: '模拟完整观看', cancel: '模拟提前关闭', error: '模拟广告出错' };
    for (const choice of prompt.choices) {
      const button = document.createElement('button');
      button.textContent = labels[choice];
      button.type = 'button';
      button.style.cssText = 'display:block;width:100%;margin-top:10px;padding:13px;border:0;border-radius:11px;font-weight:700;font-size:15px;background:#cf953f;color:#211d17;cursor:pointer';
      button.addEventListener('click', () => finish(choice), { once: true });
      card.append(button);
    }
    shade.append(card);
    document.body.append(shade);
    environment.addEventListener?.('pagehide', pagehide, { once: true });
    prompt.signal?.addEventListener?.('abort', abort, { once: true });
    if (prompt.signal?.aborted) finish('cancel');
    card.querySelector('button')?.focus();
  });
}

export class RewardedAds {
  readonly adUnitId: string;
  readonly isWechat: boolean;
  readonly testMode: boolean;
  private ledger: RewardLedger;
  private environment: any;
  private wx: any;
  private ad: any = null;
  private active: Session | null = null;
  private disposed = false;
  private phaseValue: AdPhase = 'idle';
  private onPhaseChange: (phase: AdPhase) => void;
  private requestTestDecision?: (prompt: TestAdPrompt) => Promise<'complete' | 'cancel' | 'error'>;
  private now: () => number;
  private loadTimeoutMs: number;
  private closeTimeoutMs: number;
  private cooldownMs: number;
  private lastFinishedAt = -Infinity;
  private sequence = 0;

  constructor(options: RewardedAdsOptions) {
    this.ledger = options.ledger;
    this.environment = options.environment ?? globalThis;
    this.wx = this.environment.wx;
    this.isWechat = !!this.wx;
    this.adUnitId = (options.adUnitId ?? '').trim();
    this.testMode = !this.isWechat && options.allowWebTestAds === true;
    this.onPhaseChange = options.onPhaseChange ?? (() => {});
    this.requestTestDecision = options.requestTestDecision ?? (this.testMode ? createBrowserTestPrompt(this.environment) : undefined);
    this.now = options.now ?? Date.now;
    this.loadTimeoutMs = Math.max(100, options.loadTimeoutMs ?? 15000);
    this.closeTimeoutMs = Math.max(100, options.closeTimeoutMs ?? 180000);
    this.cooldownMs = Math.max(0, options.cooldownMs ?? 700);
  }

  get phase(): AdPhase { return this.phaseValue; }
  get busy(): boolean { return !!this.active; }

  availability(): { available: boolean; source: AdSource; message: string } {
    if (this.disposed) return { available: false, source: 'none', message: '广告服务已关闭。' };
    if (this.isWechat) {
      if (!this.adUnitId) return { available: false, source: 'none', message: '正式激励广告尚未配置，暂不可观看。' };
      if (!this.wx.createRewardedVideoAd) return { available: false, source: 'none', message: '当前微信环境不支持激励广告。' };
      return { available: true, source: 'wechat', message: '观看完整广告后可领取。' };
    }
    if (this.testMode) return { available: true, source: 'test', message: '测试广告：仅模拟回调，不产生广告收益。' };
    return { available: false, source: 'none', message: '网页试玩不提供真实微信广告。' };
  }

  private setPhase(phase: AdPhase): void {
    this.phaseValue = phase;
    try { this.onPhaseChange(phase); } catch { /* A view callback must not affect reward accounting. */ }
  }

  request(request: AdRequest): Promise<AdResult> {
    if (this.disposed) return Promise.resolve({ status: 'disposed', source: 'none', message: '广告服务已关闭。' });
    if (!request.userInitiated || !request.eligible || !request.runId || !['rescue', 'settlement_bonus', 'tool_trial'].includes(request.placement)) {
      return Promise.resolve({ status: 'ineligible', source: 'none', message: '当前不符合此奖励条件。' });
    }
    if (this.active || this.now() - this.lastFinishedAt < this.cooldownMs || this.isWechat && wxLocks.has(this.wx)) {
      return Promise.resolve({ status: 'busy', source: 'none', message: '广告正在处理中，请稍候。' });
    }
    const previous = this.ledger.getReward(request.runId, request.placement);
    if (previous) {
      return Promise.resolve({
        status: previous.status === 'pending' ? 'pending_reward' : 'already_claimed', source: previous.source, receipt: previous,
        message: previous.status === 'pending' ? '上次完整观看的奖励待入账，可恢复领取。' : '本局已领取过此奖励。',
      });
    }
    const available = this.availability();
    if (!available.available) return Promise.resolve({ status: 'unavailable', source: 'none', message: available.message });
    return new Promise(resolve => {
      const session: Session = {
        id: `ad-${this.now().toString(36)}-${++this.sequence}-${Math.random().toString(36).slice(2, 8)}`,
        request: { ...request }, source: this.testMode ? 'test' : 'wechat', resolve, settled: false, shown: false,
      };
      this.active = session;
      if (session.source === 'wechat') {
        wxLocks.set(this.wx, session);
        void this.runWechat(session);
      } else {
        void this.runTest(session);
      }
    });
  }

  private armTimeout(session: Session, duration: number, reason: string): void {
    if (session.timer) clearTimeout(session.timer);
    session.timer = setTimeout(() => {
      this.finish(session, { status: 'error', source: session.source, message: '广告暂时没有响应，请稍后再试。', reason });
    }, duration);
  }

  private async runTest(session: Session): Promise<void> {
    this.setPhase('test_prompt');
    this.armTimeout(session, this.closeTimeoutMs, 'test_prompt_timeout');
    try {
      if (!this.requestTestDecision) throw new Error('没有测试广告交互界面。');
      const Controller = this.environment.AbortController ?? (globalThis as any).AbortController;
      const controller = Controller ? new Controller() : null;
      session.abortPrompt = () => controller?.abort();
      const choice = await this.requestTestDecision({
        title: '测试广告（不产生收益）',
        message: '这是网页测试工具，不是真实广告。请主动选择要测试的结果；只有“模拟完整观看”会记录测试奖励。',
        placement: session.request.placement, runId: session.request.runId, choices: ['complete', 'cancel', 'error'],
        signal: controller?.signal,
      });
      if (session.settled) return;
      if (choice === 'complete') this.complete(session);
      else if (choice === 'cancel') this.finish(session, { status: 'cancelled', source: 'test', message: '测试：提前关闭，未发放奖励。' });
      else this.finish(session, { status: 'error', source: 'test', message: '测试：广告出错，未发放奖励。', reason: 'simulated_error' });
    } catch (error) {
      this.finish(session, { status: 'error', source: 'test', message: '测试广告界面不可用，未发放奖励。', reason: errorMessage(error) });
    }
  }

  private async runWechat(session: Session): Promise<void> {
    this.setPhase('loading');
    this.armTimeout(session, this.loadTimeoutMs, 'load_timeout');
    try {
      if (!this.ad) this.ad = this.wx.createRewardedVideoAd({ adUnitId: this.adUnitId });
      const ad = this.ad;
      if (!ad?.load || !ad?.show || !ad?.onClose || !ad?.offClose || !ad?.onError || !ad?.offError) {
        throw new Error('当前广告接口不完整。');
      }
      const onLoad = () => { /* Loading success is not evidence of complete viewing. */ };
      const onError = (error: any) => {
        // load/show promise rejection handles pre-show errors; a playback error ends this attempt.
        if (session.shown) this.finish(session, { status: 'error', source: 'wechat', message: '广告播放出错，未发放奖励。', reason: errorMessage(error) });
      };
      const onClose = (result: any) => {
        if (session.settled) return;
        if (!session.shown) { session.pendingClose = result ?? null; return; }
        this.handleClose(session, result);
      };
      ad.onLoad?.(onLoad);
      ad.onError(onError);
      ad.onClose(onClose);
      session.cleanup = () => {
        ad.offLoad?.(onLoad);
        ad.offError(onError);
        ad.offClose(onClose);
      };
      await ad.load();
      if (session.settled) return;
      try { await ad.show(); }
      catch {
        if (session.settled) return;
        delete session.pendingClose;
        // One manual reload is supported by the platform; never convert a failure into a reward.
        await ad.load();
        if (session.settled) return;
        await ad.show();
      }
      if (session.settled) return;
      session.shown = true;
      this.setPhase('showing');
      this.armTimeout(session, this.closeTimeoutMs, 'close_callback_timeout');
      if (Object.prototype.hasOwnProperty.call(session, 'pendingClose')) this.handleClose(session, session.pendingClose);
    } catch (error) {
      this.finish(session, { status: 'error', source: 'wechat', message: '广告暂不可用，未发放奖励。', reason: errorMessage(error) });
    }
  }

  private handleClose(session: Session, result: any): void {
    // Modern WeChat only: missing/unknown close results fail closed, never award by assumption.
    if (result?.isEnded === true) this.complete(session);
    else this.finish(session, { status: 'cancelled', source: 'wechat', message: '广告未完整观看，未发放奖励。' });
  }

  private complete(session: Session): void {
    if (session.settled || this.active !== session) return;
    try {
      const recorded = this.ledger.createPendingReward({
        id: session.id, runId: session.request.runId, placement: session.request.placement, source: session.source,
      });
      if (!recorded.ok || !recorded.receipt) {
        this.finish(session, { status: 'error', source: session.source, message: '观看已完成，但本机存档未能写入；奖励尚未发放。', reason: recorded.error ?? 'receipt_write_failed' });
        return;
      }
      const status = recorded.duplicate ? (recorded.receipt.status === 'pending' ? 'pending_reward' : 'already_claimed') : 'completed';
      this.finish(session, {
        status, source: session.source, receipt: recorded.receipt,
        message: session.source === 'test' ? '测试观看完成，测试奖励待入账。' : '观看完成，奖励待入账。',
      });
    } catch (error) {
      this.finish(session, { status: 'error', source: session.source, message: '奖励记录失败，未重复发放。', reason: errorMessage(error) });
    }
  }

  private finish(session: Session, result: AdResult): void {
    if (session.settled) return;
    session.settled = true;
    if (session.timer) clearTimeout(session.timer);
    session.abortPrompt?.();
    try { session.cleanup?.(); } catch { /* The session guard still rejects duplicate callbacks. */ }
    if (this.isWechat && wxLocks.get(this.wx) === session) wxLocks.delete(this.wx);
    if (this.active === session) this.active = null;
    this.lastFinishedAt = this.now();
    this.setPhase('idle');
    session.resolve(result);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.active) this.finish(this.active, { status: 'disposed', source: this.active.source, message: '广告请求已结束，未额外发放奖励。' });
    // WeChat can return a global singleton; do not destroy an instance used by another subsystem.
    this.ad = null;
  }
}

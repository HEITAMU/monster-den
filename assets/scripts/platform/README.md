# Platform services

These TypeScript modules have no `cc` imports and can be used by the Cocos project and the web preview. They never call a shared-account save endpoint. Saves remain local to the current browser origin or WeChat game storage.

## SaveStore

```ts
const save = new SaveStore();
save.saveSnapshot(run.id, run);                // Check result.ok before reporting success.
const previous = save.getSnapshot<RunState>();
save.updateSettings({ muted: true });
```

The schema is versioned; future schemas are protected from downgrade overwrites. Writes preserve the last valid backup. `clear()` removes only `monster-den.save.v1` and its backup, never unrelated storage. Call it only after a deliberate reset action. Read `persistent`, `lastError` and optional `onWarning` to show storage problems honestly.

`progress.coins` defaults to `0`; `progress.startingTool` defaults to `none`. Older schema-1 saves that omit either field are upgraded in memory and written on the next successful save. Present-but-invalid values are rejected, not coerced: coins must be a nonnegative safe integer; unlocks may contain only `heavy`, `grip`, `return` without duplicates, and the selected tool must already be unlocked. Keep `UNLOCKABLE_TOOL_IDS` in sync when adding new gameplay tools. Game-specific run snapshot validation belongs to `GameModel.restore`; this generic save layer does not interpret a run's physics fields.

## RewardedAds

The real `adUnitId` defaults to empty. In WeChat that is **unavailable**, never a fake success. A real ID and the account's actual advertising permissions are required. SDK mocks verify control flow, not real ad fill, approval or revenue.

```ts
const ads = new RewardedAds({
  ledger: save,
  adUnitId: '',
  // Only explicitly enable on a labelled web test build/settings toggle:
  allowWebTestAds: false,
  onPhaseChange: phase => {
    if (phase === 'idle') void audio.resume('ad');
    else audio.pause('ad');
  },
});
const result = await ads.request({
  placement: 'rescue', runId: run.id, eligible: run.failed && !run.rescueUsed,
  userInitiated: true, // Call from the player's actual reward-button event.
});
if ((result.status === 'completed' || result.status === 'pending_reward') && result.receipt) {
  const written = save.applyRewardToSnapshot<RunState>(result.receipt.id, old => ({
    ...old, hp: 2, rescueUsed: true, failed: false,
  }));
  if (written.ok) run = save.getSnapshot<RunState>()!.state;
}
```

Do not add rewards to live state before the atomic save succeeds. At startup inspect `save.pendingRewards(currentRunId)` and settle the corresponding stored run snapshot: a crash between completed viewing and gameplay application must not require another ad. `applyReward` writes the changed gameplay state and the applied receipt in one main-key update; repeating it is a no-op. Other supported placements are `settlement_bonus` and `tool_trial`, each once per run.

Only `onClose({isEnded:true})` records a pending reward. `load`/`show` success, undefined close data, early close, errors, timeout and disposal do not grant it. Session guards, SDK lock, listener removal, cooldown and the persistent ledger defend against repeated clicks/callbacks. Save failure is exposed. Old applied receipt history is compacted to 128 entries while pending/current-run entries are retained; this is local game integrity, not a server-side anti-cheat system.

Web test mode is explicit and labelled **测试广告（不产生收益）**. Its three buttons simulate full viewing, early close and error. No timer automatically completes it; receipts retain `source:'test'`. Actual WeChat ignores this option.

## GameAudio

```ts
const audio = new GameAudio({ settings: save.read().settings });
audio.prepare();                // Generate/cache short samples on the title/loading screen.
await audio.unlock();           // First deliberate click/touch.
audio.startMusic();             // Continuous loop, not a clip that ends mid-level.
audio.play('launch');
audio.play('impact', 0.8);
audio.setSettings({ musicVolume: 0.3 });
audio.pause('ad');
await audio.resume('ad');
```

Cues: `launch`, `impact`, `break`, `loot`, `danger`, `win`, `click`. The 104 BPM four-bar score is original procedural audio. Web uses looped `AudioBufferSourceNode`; WeChat prefers `InnerAudioContext` with `loop=true` and a defensive ended handler. Generated mono WAVs are cached in `wx.env.USER_DATA_PATH` with game-specific names, or `assetUrls` can supply packaged native URLs. `prepare()` should run before combat because initial synthesis has a CPU cost. Device playback, silent-mode behavior and audio quality still require real listening on target hardware.

Pause reasons stack, so an ad finishing cannot resume audio while the app is still hidden. Visibility listeners are registered/removed by the service. `dispose()` stops sources and releases contexts/listeners.

## Validation

Run with Node 24:

```sh
node --test tests/platform.test.mjs tests/platform.audio.test.mjs
```

The tests cover save isolation/recovery, invalid data, future schema, namespaced clearing, reward transaction recovery, strict ad completion, duplicate callbacks, concurrent clicks, load/show failures, unavailable real ads, explicit browser simulation, timeout, loop configuration, mixer controls and overlapping pause reasons. They do not replace WeChat developer-tool and physical-device validation.

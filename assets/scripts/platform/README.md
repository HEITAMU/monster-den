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

Production playback uses the composed MP3 scores and material SFX files. Pass resolved URLs or a lazy music URL resolver from the integration layer; the service does not import Cocos itself. `AudioCatalog` resolves short sounds first and supplies `resolveMusicUrl(scene)` for the separate long-music bundles. A missing sound bundle returns an empty SFX catalog with a specific warning instead of rejecting the game's model-loading step.

```ts
const audio = new GameAudio({
  settings: save.read().settings,
  musicUrls: { camp: campUrl, explore: exploreUrl, boss: bossUrl },
  // Alternatively use resolveMusicUrl: async scene => aNativeUrlForThatScene.
  // The callback may load only that scene's Cocos bundle and must not decode it.
  assetUrls: sfxUrls,            // Complete cue -> URL or URL[] mapping.
  loadTimeoutMs: 8000,
  allowProceduralFallback: false,
  onWarning: message => console.warn(message),
});
await audio.prepare();          // Decode all short SFX and camp only on WebAudio.
audio.startMusic('camp');       // Records intent; first gesture is still required.
await audio.unlock();           // Call inside the player's deliberate click/touch.
void audio.preloadMusic('explore');
audio.setMusicScene('explore');  // Retains camp while explore loads, then crossfades.
audio.play('launch');
audio.play('stone_hit', 0.8);
void audio.preloadMusic('boss'); // For example, prefetch when entering room four.
audio.setMusicScene('boss');
audio.setSettings({ musicVolume: 0.3 });
audio.pause('ad');
await audio.resume('ad');
audio.dispose();                // Component destruction, not ordinary scene changes.
```

Music scenes are `camp`, `explore` and `boss`. WebAudio uses decoded file buffers and looped `AudioBufferSourceNode`s; WeChat uses two native `InnerAudioContext` players with `loop=true`. Scene changes crossfade over 0.65 seconds by default, clamped to at most 0.8 seconds. Repeated `startMusic()` calls do not restart the same score. A requested score that is still loading or unavailable leaves the current score playing; the current score also resumes correctly after an ad while a transition is pending. `stopMusic()` and `dispose()` invalidate old completion callbacks.

`prepare()` prepares only the initial scene's URL for the native WeChat backend. For WebAudio it fetches/decodes every short SFX but only the initial music scene. `preloadMusic(scene)` explicitly prepares the next score; concurrent prefetch/play requests share one URL-resolution promise. The existing home hook requests exploration music and room four requests the boss score, so a boss subpackage is not a startup dependency. At most two long music PCM buffers are retained, with the fading-out buffer released after transition; a third prefetch waits for a slot rather than decoding all three scores permanently. `status.cachedMusicScenes` and `status.decodedMusicBytes` expose this budget. These figures describe this mixer's PCM, not total browser or native decoder memory.

File fetches, decoder callbacks, lazy bundle resolution and the whole initial preparation stage have a bounded wait (default eight seconds). A stalled audio request warns and allows gameplay with the clips that are ready. Timed-out results are not accepted later, and disposal settles pending preparation rather than leaving a promise waiting for an SDK callback. Native playback failures are remembered so every gameplay tap cannot create another failing player; an explicit `preloadMusic(scene)` retries that scene. The general Cocos bundle loader has a 15-second default deadline, with eight seconds requested by the audio catalog.

Resolve Creator audio URLs without decoding an extra copy: after `assetManager.loadBundle(name)`, obtain `bundle.getInfoWithPath(path, AudioClip)`, then call `assetManager.utils.getUrlWithUuid(info.uuid, { isNative: true, nativeExt: '.mp3' })`. Browser preview URLs may be relative paths. Loading all long `AudioClip`s through Cocos WebAudio merely to read `nativeUrl` can retain additional engine-owned PCM, defeating the mixer's cache budget. Keep the MP3 extension and bundle paths consistent with the actual packaged resources.

Cues are `launch`, `stone_hit`, `wood_hit`, `wood_break`, `cabinet_push`, `enemy_hit`, `enemy_down`, `arrow`, `arrow_blocked`, `loot`, `danger`, `win`, `lose`, `click` and `tool`. Compatibility aliases `impact` and `break` map to `stone_hit` and `wood_break`. A URL array supplies material variations; immediate repeats are avoided, with a small playback-rate variation for non-tonal sounds. The default six simultaneous SFX voices are bounded, weaker cues cannot evict stronger cues, and rapid repeats are throttled per cue. Ordinary important sounds reduce music to 76% briefly; `win`/`lose` reduce it to 42% for 4.6/2.6 seconds so the entire scored phrase remains clear. A later lightweight cue cannot shorten this hold. Music then returns to its separate configured volume.

Master, music and SFX volumes are independent. Muting preserves the music transport. Missing or corrupt production files produce warnings and remain silent for that cue; they never silently switch to the earlier short synthesized loop. Legacy `synthesizeCue`/`encodeWav` utilities and generated WAV playback are available only for tests or the explicit `allowProceduralFallback: true` development option. Music/SFX authorship, sources and measurements are documented in `audio-source/`.

Pause reasons stack, so an ad finishing cannot resume audio while the app is still hidden or a native audio interruption is active. The first player gesture must unlock audio; background callbacks do not manufacture that gesture. Visibility/interruption listeners are removed on disposal, pending downloads are aborted where supported, and late decode/playback callbacks cannot revive destroyed audio. Actual device playback, volume balance, silent-mode behavior, MP3 loop seams and perceived audio quality still require listening on target phones.

## Validation

Run with Node 24:

```sh
node --test tests/platform.test.mjs tests/platform.audio.test.mjs tests/audio-catalog.test.mjs
```

The tests cover save isolation/recovery, invalid data, future schema, namespaced clearing, reward transaction recovery, strict ad completion, duplicate callbacks, concurrent clicks, load/show failures, unavailable real ads, explicit browser simulation, timeout, file-loading failures, two-score PCM budgeting, scene crossfades/looping, variants/polyphony, full-phrase ducking, mixer controls, overlapping pause reasons and stale-callback disposal. Audio decoder/native-player mocks verify control flow; they do not certify codec output, perceived sound quality, WeChat developer-tool behavior or physical-device playback.

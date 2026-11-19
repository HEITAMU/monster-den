import test from 'node:test';
import assert from 'node:assert/strict';
import { SaveStore, SAVE_KEY, SAVE_BACKUP_KEY, createStorageAdapter } from '../assets/scripts/platform/SaveStore.ts';
import { RewardedAds } from '../assets/scripts/platform/RewardedAds.ts';

const tick = () => new Promise(resolve => setImmediate(resolve));

function storageFixture() {
  const map = new Map();
  let failWrites = false;
  const storage = {
    kind: 'custom', persistent: true,
    getItem: key => map.get(key) ?? null,
    setItem(key, value) { if (failWrites) throw new Error('quota'); map.set(key, value); },
    removeItem: key => map.delete(key),
  };
  return { map, storage, failWrites: value => { failWrites = value; } };
}

function adFixture(options = {}) {
  const handlers = { close: new Set(), error: new Set(), load: new Set() };
  const stats = { load: 0, show: 0, create: 0 };
  const ad = {
    async load() { stats.load++; if (options.failLoad) throw new Error('no fill'); for (const fn of [...handlers.load]) fn(); },
    async show() { stats.show++; if (options.failShow || options.failFirstShow && stats.show === 1) throw new Error('show failed'); },
    onClose: fn => handlers.close.add(fn), offClose: fn => handlers.close.delete(fn),
    onError: fn => handlers.error.add(fn), offError: fn => handlers.error.delete(fn),
    onLoad: fn => handlers.load.add(fn), offLoad: fn => handlers.load.delete(fn),
  };
  const wx = { createRewardedVideoAd(input) { stats.create++; assert.equal(input.adUnitId, 'adunit-real-test'); return ad; } };
  return { wx, ad, stats, handlers, close: value => { for (const fn of [...handlers.close]) fn(value); }, error: value => { for (const fn of [...handlers.error]) fn(value); } };
}

function request(runId = 'run-a', placement = 'rescue') {
  return { runId, placement, eligible: true, userInitiated: true };
}

function serviceFixture(options = {}) {
  const persisted = storageFixture();
  const store = new SaveStore({ storage: persisted.storage });
  const sdk = adFixture(options);
  const service = new RewardedAds({ ledger: store, environment: { wx: sdk.wx }, adUnitId: 'adunit-real-test', cooldownMs: 0, ...options.service });
  return { persisted, store, sdk, service };
}

test('snapshot survives a new store and is returned without mutable aliases', () => {
  const { storage } = storageFixture();
  const first = new SaveStore({ storage });
  assert.equal(first.saveSnapshot('run-a', { hp: 3, seed: 91, rooms: ['start'], rescueUsed: false }).ok, true);
  const second = new SaveStore({ storage });
  assert.equal(second.read().playerId, first.read().playerId);
  const snapshot = second.getSnapshot();
  assert.equal(snapshot.state.hp, 3);
  snapshot.state.hp = 99;
  assert.equal(second.getSnapshot().state.hp, 3);
});

test('different local storage instances have independent players and progress', () => {
  const a = new SaveStore({ storage: storageFixture().storage });
  const b = new SaveStore({ storage: storageFixture().storage });
  a.saveSnapshot('one', { hp: 8 });
  assert.notEqual(a.read().playerId, b.read().playerId);
  assert.equal(b.getSnapshot(), null);
});

test('save reset clears only the two namespaced game keys', () => {
  const { storage, map } = storageFixture();
  const store = new SaveStore({ storage });
  map.set('unrelated-app.token', 'keep-me');
  store.saveSnapshot('a', { hp: 1 });
  store.saveSnapshot('a', { hp: 2 });
  assert.ok(map.has(SAVE_KEY) && map.has(SAVE_BACKUP_KEY));
  assert.equal(store.clear().ok, true);
  assert.equal(map.get('unrelated-app.token'), 'keep-me');
  assert.equal(map.has(SAVE_KEY), false);
  assert.equal(map.has(SAVE_BACKUP_KEY), false);
});

test('corrupt main save recovers the last valid backup without deleting evidence', () => {
  const { storage, map } = storageFixture();
  const store = new SaveStore({ storage });
  store.saveSnapshot('a', { hp: 1 });
  store.saveSnapshot('a', { hp: 2 });
  map.set(SAVE_KEY, '{broken');
  const recovered = new SaveStore({ storage });
  assert.equal(recovered.recoveredFromBackup, true);
  assert.equal(recovered.getSnapshot().state.hp, 1);
  assert.equal(map.get(SAVE_KEY), '{broken');
});

test('future schema is preserved and blocks downgrade writes', () => {
  const { storage, map } = storageFixture();
  const future = JSON.stringify({ schemaVersion: 99, playerId: 'future-player' });
  map.set(SAVE_KEY, future);
  const store = new SaveStore({ storage });
  assert.equal(store.readOnly, true);
  assert.equal(store.saveSnapshot('a', { hp: 4 }).ok, false);
  assert.equal(map.get(SAVE_KEY), future);
});

test('invalid or cyclic state is rejected without changing the persisted snapshot', () => {
  const { storage, map } = storageFixture();
  const store = new SaveStore({ storage });
  store.saveSnapshot('a', { hp: 4 });
  const before = map.get(SAVE_KEY);
  assert.equal(store.saveSnapshot('a', { hp: NaN }).ok, false);
  const cycle = {}; cycle.self = cycle;
  assert.equal(store.saveSnapshot('a', cycle).ok, false);
  assert.equal(map.get(SAVE_KEY), before);
});

test('settings are clamped and do not replace unrelated settings', () => {
  const store = new SaveStore({ storage: storageFixture().storage });
  store.updateSettings({ masterVolume: 20, musicVolume: -1, muted: true });
  assert.equal(store.read().settings.masterVolume, 1);
  assert.equal(store.read().settings.musicVolume, 0);
  assert.equal(store.read().settings.muted, true);
  assert.equal(store.read().settings.sfxVolume, 0.85);
});

test('fresh progress has explicit safe coin and starting-tool defaults', () => {
  const store = new SaveStore({ storage: storageFixture().storage });
  assert.equal(store.read().progress.coins, 0);
  assert.equal(store.read().progress.startingTool, 'none');
  assert.deepEqual(store.read().progress.unlockedTools, []);
});

test('legacy schema-1 saves without new progress fields migrate without erasing earned progress', () => {
  const { storage, map } = storageFixture();
  const original = new SaveStore({ storage });
  original.saveSnapshot('legacy-run', { hp: 4 });
  const legacy = JSON.parse(map.get(SAVE_KEY));
  delete legacy.progress.coins;
  delete legacy.progress.startingTool;
  legacy.progress.bestLoot = 650;
  legacy.progress.unlockedTools = ['heavy'];
  const raw = JSON.stringify(legacy);
  map.set(SAVE_KEY, raw);
  const migrated = new SaveStore({ storage });
  const progress = migrated.read().progress;
  assert.equal(progress.coins, 0);
  assert.equal(progress.startingTool, 'none');
  assert.equal(progress.bestLoot, 650);
  assert.deepEqual(progress.unlockedTools, ['heavy']);
  assert.equal(migrated.getSnapshot().runId, 'legacy-run');
  assert.equal(map.get(SAVE_KEY), raw, 'reading old saves does not perform a hidden write');
  assert.equal(migrated.updateSettings({ muted: true }).ok, true);
  assert.equal(JSON.parse(map.get(SAVE_KEY)).progress.coins, 0);
});

test('a valid unlocked loadout and integral coin balance persist', () => {
  const { storage } = storageFixture();
  const store = new SaveStore({ storage });
  assert.equal(store.update(draft => {
    draft.progress.coins = 700;
    draft.progress.unlockedTools = ['heavy', 'grip'];
    draft.progress.startingTool = 'grip';
  }).ok, true);
  const loaded = new SaveStore({ storage }).read().progress;
  assert.equal(loaded.coins, 700);
  assert.equal(loaded.startingTool, 'grip');
});

test('invalid coin mutations are rejected atomically, including nonfinite, negative and fractional values', () => {
  const { storage, map } = storageFixture();
  const store = new SaveStore({ storage });
  store.update(draft => { draft.progress.coins = 50; });
  const original = map.get(SAVE_KEY);
  for (const coins of [NaN, Infinity, -Infinity, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, '500', null]) {
    assert.equal(store.update(draft => { draft.progress.coins = coins; }).ok, false, `rejected ${String(coins)}`);
    assert.equal(map.get(SAVE_KEY), original);
    assert.equal(store.read().progress.coins, 50);
  }
});

test('malformed persisted coins or tools never reach the loaded progress', () => {
  const corruptions = [
    p => { p.coins = -50; },
    p => { p.coins = null; },
    p => { p.coins = '900'; },
    p => { p.startingTool = 'unknown-laser'; },
    p => { p.startingTool = null; },
    p => { p.startingTool = 'heavy'; p.unlockedTools = []; },
    p => { p.unlockedTools = ['heavy', 'unknown-laser']; },
    p => { p.unlockedTools = ['heavy', 'heavy']; },
  ];
  for (const corrupt of corruptions) {
    const { storage, map } = storageFixture();
    const clean = new SaveStore({ storage }).read();
    corrupt(clean.progress);
    const original = JSON.stringify(clean);
    map.set(SAVE_KEY, original);
    const store = new SaveStore({ storage });
    assert.equal(store.read().progress.coins, 0);
    assert.equal(store.read().progress.startingTool, 'none');
    assert.deepEqual(store.read().progress.unlockedTools, []);
    assert.ok(store.lastError);
    assert.equal(map.get(SAVE_KEY), original, 'invalid evidence is preserved until an explicit successful write');
  }
});

test('a corrupt balance recovers a valid legacy backup with defaulted new fields', () => {
  const { storage, map } = storageFixture();
  const seed = new SaveStore({ storage }).read();
  const backup = structuredClone(seed);
  delete backup.progress.coins; delete backup.progress.startingTool;
  backup.progress.bestLoot = 250;
  seed.progress.coins = -1;
  map.set(SAVE_KEY, JSON.stringify(seed));
  map.set(SAVE_BACKUP_KEY, JSON.stringify(backup));
  const recovered = new SaveStore({ storage });
  assert.equal(recovered.recoveredFromBackup, true);
  assert.equal(recovered.read().progress.coins, 0);
  assert.equal(recovered.read().progress.bestLoot, 250);
});

test('unknown and locked tools cannot be written as an equipped loadout', () => {
  const { storage } = storageFixture();
  const store = new SaveStore({ storage });
  assert.equal(store.update(draft => { draft.progress.startingTool = 'laser'; }).ok, false);
  assert.equal(store.update(draft => { draft.progress.startingTool = 'heavy'; }).ok, false);
  assert.equal(store.update(draft => { draft.progress.unlockedTools = ['none']; }).ok, false);
  assert.equal(store.read().progress.startingTool, 'none');
});

test('WeChat storage adapter takes priority over browser localStorage', () => {
  const map = new Map();
  const adapter = createStorageAdapter({
    wx: { getStorageSync: k => map.get(k), setStorageSync: (k, v) => map.set(k, v), removeStorageSync: k => map.delete(k) },
    localStorage: { getItem() { throw new Error('wrong backend'); } },
  });
  assert.equal(adapter.kind, 'wechat');
  adapter.setItem('game-key', 'value');
  assert.equal(adapter.getItem('game-key'), 'value');
});

test('missing persistent storage is exposed, rather than advertised as saved', () => {
  const warnings = [];
  const store = new SaveStore({ environment: {}, onWarning: m => warnings.push(m) });
  assert.equal(store.persistent, false);
  assert.match(warnings[0], /没有持久化/);
});

test('pending reward and snapshot mutation settle once across reloads', () => {
  const { storage } = storageFixture();
  const store = new SaveStore({ storage });
  store.saveSnapshot('a', { hp: 0, rescueUsed: false });
  store.createPendingReward({ id: 'receipt-a', runId: 'a', placement: 'rescue', source: 'wechat' });
  const restored = new SaveStore({ storage });
  assert.equal(restored.pendingRewards('a').length, 1);
  let applies = 0;
  const apply = state => { applies++; return { ...state, hp: 3, rescueUsed: true }; };
  assert.equal(restored.applyRewardToSnapshot('receipt-a', apply).ok, true);
  assert.equal(restored.applyRewardToSnapshot('receipt-a', apply).alreadyApplied, true);
  assert.equal(applies, 1);
  assert.equal(new SaveStore({ storage }).getSnapshot().state.hp, 3);
  assert.equal(restored.pendingRewards('a').length, 0);
});

test('failed reward application does not consume a recoverable pending receipt', () => {
  const store = new SaveStore({ storage: storageFixture().storage });
  store.saveSnapshot('a', { hp: 0 });
  store.createPendingReward({ id: 'r', runId: 'a', placement: 'rescue', source: 'test' });
  const failed = store.applyReward('r', () => { throw new Error('game state mismatch'); });
  assert.equal(failed.ok, false);
  assert.equal(store.pendingRewards().length, 1);
  assert.equal(store.getSnapshot().state.hp, 0);
});

test('a reward cannot be applied to a different run snapshot', () => {
  const store = new SaveStore({ storage: storageFixture().storage });
  store.saveSnapshot('b', { hp: 2 });
  store.createPendingReward({ id: 'r', runId: 'a', placement: 'rescue', source: 'test' });
  assert.equal(store.applyRewardToSnapshot('r', state => ({ ...state, hp: 9 })).ok, false);
  assert.equal(store.getSnapshot().state.hp, 2);
});

test('empty real ad ID is unavailable and never creates or simulates a WeChat ad', async () => {
  const sdk = adFixture();
  const store = new SaveStore({ storage: storageFixture().storage });
  const ads = new RewardedAds({ ledger: store, environment: { wx: sdk.wx }, allowWebTestAds: true });
  const result = await ads.request(request());
  assert.equal(result.status, 'unavailable');
  assert.equal(sdk.stats.create, 0);
  assert.equal(ads.testMode, false);
  assert.equal(store.pendingRewards().length, 0);
});

test('browser mode has no automatic fake reward or implicit test mode', async () => {
  const store = new SaveStore({ storage: storageFixture().storage });
  const ads = new RewardedAds({ ledger: store, environment: {} });
  assert.equal((await ads.request(request())).status, 'unavailable');
  assert.equal(store.pendingRewards().length, 0);
});

test('ad calls require explicit player action and current gameplay eligibility', async () => {
  const { service, sdk } = serviceFixture();
  assert.equal((await service.request({ ...request(), userInitiated: false })).status, 'ineligible');
  assert.equal((await service.request({ ...request(), eligible: false })).status, 'ineligible');
  assert.equal(sdk.stats.create, 0);
  service.dispose();
});

test('load/show success alone never grants rewards; only strict isEnded true does', async () => {
  const { service, sdk, store } = serviceFixture();
  const pending = service.request(request());
  await tick();
  assert.equal(service.phase, 'showing');
  assert.equal(store.pendingRewards().length, 0);
  sdk.close({ isEnded: true });
  const result = await pending;
  assert.equal(result.status, 'completed');
  assert.equal(result.source, 'wechat');
  assert.equal(store.pendingRewards().length, 1);
  assert.equal(sdk.handlers.close.size, 0);
  service.dispose();
});

for (const value of [{ isEnded: false }, undefined, {}, { isEnded: 'true' }]) {
  test(`incomplete or unknown close result does not grant: ${JSON.stringify(value)}`, async () => {
    const { service, sdk, store } = serviceFixture();
    const pending = service.request(request());
    await tick();
    sdk.close(value);
    assert.equal((await pending).status, 'cancelled');
    assert.equal(store.pendingRewards().length, 0);
    service.dispose();
  });
}

test('duplicate or late close callbacks create one receipt only', async () => {
  const { service, sdk, store } = serviceFixture();
  const pending = service.request(request());
  await tick();
  const callback = [...sdk.handlers.close][0];
  callback({ isEnded: true });
  callback({ isEnded: true });
  await pending;
  callback({ isEnded: true });
  assert.equal(store.pendingRewards().length, 1);
  const repeat = await service.request(request());
  assert.equal(repeat.status, 'pending_reward');
  assert.equal(sdk.stats.show, 1);
  service.dispose();
});

test('rapid clicks and separate service instances cannot overlap the same WeChat SDK', async () => {
  const { service, sdk, store } = serviceFixture();
  const second = new RewardedAds({ ledger: store, environment: { wx: sdk.wx }, adUnitId: 'adunit-real-test', cooldownMs: 0 });
  const pending = service.request(request());
  assert.equal((await service.request(request('other'))).status, 'busy');
  assert.equal((await second.request(request('other'))).status, 'busy');
  await tick();
  sdk.close({ isEnded: false });
  await pending;
  service.dispose(); second.dispose();
});

test('one rescue per run remains enforced after applying the reward and re-entering', async () => {
  const { service, sdk, store, persisted } = serviceFixture();
  store.saveSnapshot('run-a', { hp: 0, rescueUsed: false });
  const pending = service.request(request());
  await tick(); sdk.close({ isEnded: true });
  const first = await pending;
  store.applyRewardToSnapshot(first.receipt.id, state => ({ ...state, hp: 2, rescueUsed: true }));
  service.dispose();
  const newAds = new RewardedAds({ ledger: new SaveStore({ storage: persisted.storage }), environment: { wx: sdk.wx }, adUnitId: 'adunit-real-test', cooldownMs: 0 });
  assert.equal((await newAds.request(request())).status, 'already_claimed');
  assert.equal(sdk.stats.show, 1);
  newAds.dispose();
});

test('load failure and playback failure both leave rewards unclaimed', async () => {
  const failedLoad = serviceFixture({ failLoad: true });
  assert.equal((await failedLoad.service.request(request())).status, 'error');
  assert.equal(failedLoad.sdk.stats.show, 0);
  assert.equal(failedLoad.store.pendingRewards().length, 0);
  failedLoad.service.dispose();
  const failedPlayback = serviceFixture();
  const pending = failedPlayback.service.request(request());
  await tick(); failedPlayback.sdk.error({ errMsg: 'video unavailable' });
  assert.equal((await pending).status, 'error');
  assert.equal(failedPlayback.store.pendingRewards().length, 0);
  failedPlayback.service.dispose();
});

test('show failure retries load/show once, but still requires a complete close', async () => {
  const { service, sdk, store } = serviceFixture({ failFirstShow: true });
  const pending = service.request(request());
  await tick();
  assert.equal(sdk.stats.show, 2);
  assert.equal(sdk.stats.load, 2);
  assert.equal(store.pendingRewards().length, 0);
  sdk.close({ isEnded: true });
  assert.equal((await pending).status, 'completed');
  service.dispose();
});

test('failure to persist viewing evidence does not report a granted reward', async () => {
  const { service, sdk, store, persisted } = serviceFixture();
  const pending = service.request(request());
  await tick(); persisted.failWrites(true); sdk.close({ isEnded: true });
  assert.equal((await pending).status, 'error');
  assert.equal(store.pendingRewards().length, 0);
  service.dispose();
});

test('test mode waits for an explicit labelled choice and records test provenance', async () => {
  const store = new SaveStore({ storage: storageFixture().storage });
  let choose;
  let shownPrompt;
  const ads = new RewardedAds({ ledger: store, environment: {}, allowWebTestAds: true, cooldownMs: 0,
    requestTestDecision: prompt => { shownPrompt = prompt; return new Promise(resolve => { choose = resolve; }); },
  });
  const pending = ads.request(request());
  await tick();
  assert.match(shownPrompt.title, /测试/);
  assert.match(shownPrompt.message, /不是真实广告/);
  assert.equal(ads.phase, 'test_prompt');
  assert.equal(store.pendingRewards().length, 0);
  choose('complete');
  const result = await pending;
  assert.equal(result.status, 'completed');
  assert.equal(result.receipt.source, 'test');
  ads.dispose();
});

test('test cancel/error and disposed requests never award', async () => {
  for (const choice of ['cancel', 'error']) {
    const store = new SaveStore({ storage: storageFixture().storage });
    const ads = new RewardedAds({ ledger: store, environment: {}, allowWebTestAds: true, requestTestDecision: async () => choice });
    assert.equal((await ads.request(request())).status, choice === 'cancel' ? 'cancelled' : 'error');
    assert.equal(store.pendingRewards().length, 0);
    ads.dispose();
    assert.equal((await ads.request(request())).status, 'disposed');
  }
});

test('timeout releases the input lock without generating a reward', async () => {
  const store = new SaveStore({ storage: storageFixture().storage });
  const ads = new RewardedAds({ ledger: store, environment: {}, allowWebTestAds: true, closeTimeoutMs: 100,
    requestTestDecision: () => new Promise(() => {}),
  });
  const result = await ads.request(request());
  assert.equal(result.status, 'error');
  assert.equal(ads.busy, false);
  assert.equal(store.pendingRewards().length, 0);
  ads.dispose();
});

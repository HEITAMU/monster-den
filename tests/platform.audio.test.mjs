import test from 'node:test';
import assert from 'node:assert/strict';
import { GameAudio, synthesizeCue, encodeWav } from '../assets/scripts/platform/GameAudio.ts';

const MUSIC = { camp: '/audio/music-camp.mp3', explore: '/audio/music-explore.mp3', boss: '/audio/music-boss.mp3' };
const CUES = ['launch', 'stone_hit', 'wood_hit', 'wood_break', 'cabinet_push', 'enemy_hit', 'enemy_down', 'arrow', 'arrow_blocked', 'loot', 'danger', 'win', 'lose', 'click', 'tool'];
const ASSETS = Object.fromEntries(CUES.map(cue => [cue, [`/audio/${cue}-1.mp3`, `/audio/${cue}-2.mp3`]]));
const flush = () => new Promise(resolve => setImmediate(resolve));
function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }

function clockFixture() {
  let next = 1;
  const clock = { now: 0, tasks: new Map(), contexts: [],
    setTimeout: (fn, ms) => { const id = next++; clock.tasks.set(id, { fn, at: clock.now + ms }); return id; },
    clearTimeout: id => clock.tasks.delete(id),
    async advance(ms) {
      const target = clock.now + ms;
      const move = at => { const delta = (at - clock.now) / 1000; for (const c of clock.contexts) if (c.state === 'running') c.currentTime += delta; clock.now = at; };
      for (let count = 0; count < 10000; count++) {
        const due = [...clock.tasks].filter(([, task]) => task.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) { move(target); await flush(); return; }
        const [id, task] = due; move(task.at); clock.tasks.delete(id); task.fn(); await flush();
      }
      assert.fail('Audio timer failed to terminate.');
    },
  };
  return clock;
}
function parameter(value = 1) {
  return { value, automation: [],
    cancelScheduledValues(at) { this.automation.push(['cancel', at]); },
    setValueAtTime(value, at) { this.value = value; this.automation.push(['set', value, at]); },
    linearRampToValueAtTime(value, at) { this.value = value; this.automation.push(['ramp', value, at]); },
  };
}
function webFixture({ callbacksOnly = false } = {}) {
  const clock = clockFixture();
  const fixture = { clock, sources: [], gains: [], fetches: [], decoded: [], generated: [], warnings: [],
    failFetch: new Set(), failDecode: new Set(), delayedDecode: new Map(), contexts: [], resumeOverride: null };
  const urlIds = new Map(), idUrls = new Map();
  function decodedBuffer(url) {
    const duration = url === MUSIC.camp ? 60 : url === MUSIC.explore ? 120 : url === MUSIC.boss ? 96 : .4;
    return { id: url, duration, sampleRate: 44100, numberOfChannels: 2, length: Math.round(duration * 44100) };
  }
  class Context {
    state = 'suspended'; destination = {}; currentTime = 0;
    constructor() { fixture.contexts.push(this); clock.contexts.push(this); }
    resume() { if (fixture.resumeOverride) return fixture.resumeOverride(this); this.state = 'running'; return Promise.resolve(); }
    suspend() { this.state = 'suspended'; return Promise.resolve(); }
    close() { this.state = 'closed'; return Promise.resolve(); }
    createGain() { const gain = { gain: parameter(), connect() {}, disconnect() {} }; fixture.gains.push(gain); return gain; }
    createDynamicsCompressor() { return { threshold: parameter(), knee: parameter(), ratio: parameter(), attack: parameter(), release: parameter(), connect() {}, disconnect() {} }; }
    createBuffer(channels, length, rate) { const buffer = { id: 'explicit-procedural-fallback', length, sampleRate: rate, numberOfChannels: channels, duration: length / rate, copyToChannel() {} }; fixture.generated.push(buffer); return buffer; }
    decodeAudioData(bytes, success, failure) {
      const url = idUrls.get(new Uint32Array(bytes)[0]); fixture.decoded.push(url);
      let promise;
      if (fixture.delayedDecode.has(url)) promise = fixture.delayedDecode.get(url).promise.then(() => decodedBuffer(url));
      else promise = fixture.failDecode.has(url) ? Promise.reject(new Error('expected invalid media')) : Promise.resolve(decodedBuffer(url));
      promise.then(success, failure);
      return callbacksOnly ? undefined : promise;
    }
    createBufferSource() {
      const source = { loop: false, starts: 0, stops: 0, ends: 0, playbackRate: parameter(), onended: null,
        connect() {}, disconnect() { this.disconnected = true; },
        start() { this.starts++; }, stop() { this.stops++; this.onended?.(); }, finish() { this.ends++; this.onended?.(); } };
      fixture.sources.push(source); return source;
    }
  }
  fixture.environment = { AudioContext: Context, performance: { now: () => clock.now }, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout,
    async fetch(url) {
      fixture.fetches.push(url);
      if (!urlIds.has(url)) { const id = urlIds.size + 1; urlIds.set(url, id); idUrls.set(id, url); }
      return { ok: !fixture.failFetch.has(url), status: fixture.failFetch.has(url) ? 404 : 200,
        arrayBuffer: async () => new Uint32Array([urlIds.get(url)]).buffer };
    },
  };
  return fixture;
}
function wxFixture() {
  const clock = clockFixture(), files = new Map(), audios = [], events = {}, warnings = [];
  const wx = {
    env: { USER_DATA_PATH: '/wx-local' },
    getFileSystemManager: () => ({ accessSync(path) { if (!files.has(path)) throw new Error('missing'); }, writeFileSync: (path, bytes) => files.set(path, bytes) }),
    createInnerAudioContext() {
      const audio = { loop: false, autoplay: false, plays: 0, pauses: 0, stops: 0, destroyed: false, src: '', volume: 1, playbackRate: 1,
        endHandlers: new Set(), errorHandlers: new Set(), seeks: [],
        play() { assert.equal(this.destroyed, false); this.plays++; }, pause() { this.pauses++; }, stop() { this.stops++; },
        seek(time) { this.seeks.push(time); }, destroy() { this.destroyed = true; },
        onEnded(fn) { this.endHandlers.add(fn); }, offEnded(fn) { this.endHandlers.delete(fn); },
        onError(fn) { this.errorHandlers.add(fn); }, offError(fn) { this.errorHandlers.delete(fn); },
        ended() { for (const fn of [...this.endHandlers]) fn(); }, error(error) { for (const fn of [...this.errorHandlers]) fn(error); },
      };
      audios.push(audio); return audio;
    },
    onHide: fn => { events.hide = fn; }, onShow: fn => { events.show = fn; },
    offHide: fn => { if (events.hide === fn) delete events.hide; }, offShow: fn => { if (events.show === fn) delete events.show; },
    onAudioInterruptionBegin: fn => { events.interrupt = fn; }, onAudioInterruptionEnd: fn => { events.interruptEnd = fn; },
    offAudioInterruptionBegin: fn => { if (events.interrupt === fn) delete events.interrupt; }, offAudioInterruptionEnd: fn => { if (events.interruptEnd === fn) delete events.interruptEnd; },
  };
  return { clock, files, audios, events, warnings, wx,
    environment: { wx, performance: { now: () => clock.now }, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout } };
}
const audioFor = (fixture, extra = {}) => new GameAudio({ environment: fixture.environment, musicUrls: MUSIC, assetUrls: ASSETS,
  now: () => fixture.clock.now, random: () => .25, onWarning: message => fixture.warnings.push(message), ...extra });
async function readyMusic(fixture, audio) { await audio.prepare(); audio.startMusic(); await audio.unlock(); await flush(); await fixture.clock.advance(800); }

test('legacy synthesis remains an explicit test utility with finite bounded PCM', () => {
  for (const name of ['music', ...CUES, 'impact', 'break']) {
    const cue = synthesizeCue(name); let peak = 0;
    for (const sample of cue.samples) { assert.ok(Number.isFinite(sample)); peak = Math.max(peak, Math.abs(sample)); }
    assert.ok(peak > .01 && peak <= .881);
    const bytes = encodeWav(cue), view = new DataView(bytes);
    assert.equal(new TextDecoder().decode(new Uint8Array(bytes, 0, 4)), 'RIFF');
    assert.equal(view.getUint16(22, true), 1); assert.equal(view.getUint32(40, true), cue.samples.length * 2);
    assert.equal(Math.abs(cue.samples[0]), 0); assert.equal(Math.abs(cue.samples.at(-1)), 0);
  }
});

test('prepare decodes every file SFX but only camp music, never all three long scores', async () => {
  const f = webFixture(), audio = audioFor(f);
  await audio.prepare();
  assert.equal(audio.status.prepared, true);
  assert.deepEqual(audio.status.cachedMusicScenes, ['camp']);
  assert.equal(f.fetches.length, CUES.length * 2 + 1);
  assert.ok(f.decoded.includes(MUSIC.camp)); assert.equal(f.decoded.includes(MUSIC.explore), false); assert.equal(f.decoded.includes(MUSIC.boss), false);
  assert.equal(f.generated.length, 0); assert.equal(f.sources.length, 0); assert.equal(f.warnings.length, 0);
  await audio.prepare(); assert.equal(f.fetches.length, CUES.length * 2 + 1);
  audio.dispose();
});

test('file music waits for a gesture and scene changes remain looped after crossfade', async () => {
  const f = webFixture(), audio = audioFor(f);
  await audio.prepare(); audio.startMusic(); assert.equal(f.sources.length, 0);
  await audio.unlock(); await flush();
  const camp = f.sources[0]; assert.equal(camp.buffer.id, MUSIC.camp); assert.equal(camp.loop, true);
  audio.startMusic(); await flush(); assert.equal(f.sources.length, 1);
  await f.clock.advance(800); await audio.preloadMusic('explore'); audio.setMusicScene('explore'); await flush();
  const explore = f.sources[1]; assert.equal(explore.buffer.id, MUSIC.explore); assert.equal(explore.loop, true); assert.equal(audio.status.activeMusicVoices, 2);
  const ramps = f.gains.flatMap(g => g.gain.automation).filter(event => event[0] === 'ramp');
  assert.ok(ramps.some(event => event[1] === 0));
  await f.clock.advance(800);
  assert.equal(camp.stops, 1); assert.equal(explore.stops, 0); assert.equal(audio.status.activeMusicVoices, 1);
  assert.deepEqual(audio.status.cachedMusicScenes, ['explore']);
  explore.finish(); await flush();
  assert.equal(f.sources.at(-1).loop, true); assert.equal(f.sources.at(-1).buffer.id, MUSIC.explore);
  assert.equal(audio.status.activeMusicVoices, 1);
  audio.dispose(); assert.equal(f.clock.tasks.size, 0);
});

test('third music prefetch waits for the fading old buffer to release and keeps at most two PCM scores', async () => {
  const f = webFixture(), audio = audioFor(f); await readyMusic(f, audio);
  await audio.preloadMusic('explore'); audio.setMusicScene('explore'); await flush();
  const fetchingBoss = audio.preloadMusic('boss'); await flush();
  assert.equal(f.fetches.includes(MUSIC.boss), false);
  assert.equal(audio.status.cachedMusicScenes.length, 2);
  await f.clock.advance(800); await fetchingBoss;
  assert.deepEqual(new Set(audio.status.cachedMusicScenes), new Set(['explore', 'boss']));
  assert.ok(audio.status.decodedMusicBytes <= (120 + 96) * 44100 * 2 * 4);
  audio.setMusicScene('boss'); await flush(); await f.clock.advance(800);
  assert.equal(audio.status.playingScene, 'boss'); assert.deepEqual(audio.status.cachedMusicScenes, ['boss']);
  audio.dispose();
});

test('missing or corrupt production media warns and never silently synthesizes the old loop', async () => {
  const f = webFixture(); f.failFetch.add(MUSIC.camp); f.failDecode.add(ASSETS.stone_hit[0]); f.failDecode.add(ASSETS.stone_hit[1]);
  const audio = audioFor(f); await audio.prepare(); await audio.unlock(); audio.startMusic(); await flush();
  assert.equal(audio.status.playingScene, null); assert.equal(f.generated.length, 0); assert.equal(audio.play('stone_hit'), false);
  assert.equal(audio.play('click'), true); assert.ok(f.warnings.some(message => message.includes(MUSIC.camp)));
  assert.ok(f.warnings.some(message => message.includes('解码'))); audio.dispose();
  const absent = webFixture(), withoutFiles = audioFor(absent, { musicUrls: undefined, assetUrls: {} });
  await withoutFiles.prepare(); await withoutFiles.unlock(); withoutFiles.startMusic(); await flush();
  assert.equal(absent.sources.length, 0); assert.equal(absent.generated.length, 0);
  assert.ok(absent.warnings.some(message => message.includes('缺少正式音乐文件'))); withoutFiles.dispose();
});

test('a failed new scene keeps the current formal score and does not retry on every click', async () => {
  const f = webFixture(), audio = audioFor(f); await readyMusic(f, audio);
  f.failFetch.add(MUSIC.explore); audio.setMusicScene('explore'); await flush();
  assert.equal(audio.status.playingScene, 'camp'); assert.equal(f.sources[0].stops, 0);
  const fetches = f.fetches.length;
  audio.startMusic(); audio.startMusic(); await flush(); assert.equal(f.fetches.length, fetches);
  assert.equal(f.generated.length, 0); audio.dispose();
});

test('procedural fallback requires an explicit true option on both backends', async () => {
  const f = webFixture(), audio = audioFor(f, { musicUrls: undefined, assetUrls: {}, allowProceduralFallback: true });
  await readyMusic(f, audio); assert.equal(f.sources[0].buffer.id, 'explicit-procedural-fallback'); assert.equal(audio.play('stone_hit'), true); audio.dispose();
  const wx = wxFixture(), inner = audioFor(wx, { musicUrls: undefined, assetUrls: {}, allowProceduralFallback: true });
  await inner.prepare(); await inner.unlock(); inner.startMusic(); await flush();
  assert.ok(wx.files.size > 0); assert.ok(wx.audios[0].src.includes('explicit-fallback')); inner.dispose();
});

test('callback-only decodeAudioData implementations decode actual file buffers', async () => {
  const f = webFixture({ callbacksOnly: true }), audio = audioFor(f);
  await readyMusic(f, audio); assert.equal(f.sources[0].buffer.id, MUSIC.camp); assert.equal(audio.play('wood_hit'), true); audio.dispose();
});

test('master, music, SFX and mute remain independent mixer controls', async () => {
  const f = webFixture(), audio = audioFor(f); await audio.prepare(); await audio.unlock();
  audio.setSettings({ masterVolume: .6, musicVolume: .2, sfxVolume: .7 });
  assert.equal(f.gains[0].gain.value, .6); assert.equal(f.gains[1].gain.value, .2); assert.equal(f.gains[2].gain.value, .7);
  audio.setMuted(true); assert.equal(f.gains[0].gain.value, 0); assert.equal(audio.play('impact'), false);
  audio.setMuted(false); assert.equal(f.gains[0].gain.value, .6); audio.dispose();
});

test('material variants do not immediately repeat and cues throttle before consuming voices', async () => {
  const f = webFixture(), audio = audioFor(f); await audio.prepare(); await audio.unlock();
  assert.equal(audio.play('stone_hit'), true); const first = f.sources.at(-1).buffer.id;
  assert.equal(audio.play('impact'), false); assert.equal(f.sources.length, 1);
  await f.clock.advance(60); assert.equal(audio.play('impact'), true);
  assert.notEqual(f.sources.at(-1).buffer.id, first);
  assert.ok(f.sources.at(-1).playbackRate.value > .95 && f.sources.at(-1).playbackRate.value < 1.05);
  audio.dispose();
});

test('bounded SFX polyphony protects important cues from lower-priority impacts', async () => {
  const f = webFixture(), audio = audioFor(f, { maxConcurrentSounds: 2 }); await audio.prepare(); await audio.unlock();
  assert.equal(audio.play('stone_hit'), true); assert.equal(audio.play('wood_hit'), true);
  assert.equal(audio.status.activeSounds, 2);
  assert.equal(audio.play('danger'), true); assert.equal(audio.play('win'), true);
  await f.clock.advance(80); assert.equal(audio.play('stone_hit'), false);
  assert.equal(audio.status.activeSounds, 2); assert.equal(f.sources.filter(source => !source.stops).length, 2);
  audio.dispose();
});

test('important SFX gently duck music and restore its independent category volume', async () => {
  const f = webFixture(), audio = audioFor(f); await readyMusic(f, audio);
  assert.equal(audio.play('danger'), true);
  assert.ok(f.gains[1].gain.value < .42 && f.gains[1].gain.value > .28);
  assert.equal(f.gains[2].gain.value, .85);
  await f.clock.advance(800); assert.equal(f.gains[1].gain.value, .42); audio.dispose();
});

test('win and lose duck the entire scored phrase on both backends, and lighter cues cannot shorten it', async () => {
  for (const [cue, hold] of [['win', 4600], ['lose', 2600]]) {
    for (const f of [webFixture(), wxFixture()]) {
      const audio = audioFor(f); await readyMusic(f, audio);
      const musicLevel = () => f.gains ? f.gains[1].gain.value : f.audios[0].volume / .8;
      assert.equal(audio.play(cue), true); await f.clock.advance(600);
      assert.ok(Math.abs(musicLevel() - .42 * .42) < 1e-6);
      assert.equal(audio.play('danger'), true); await f.clock.advance(hold - 650);
      assert.ok(Math.abs(musicLevel() - .42 * .42) < 1e-6, `${cue} must remain ducked past a light cue's short hold`);
      await f.clock.advance(350); assert.ok(Math.abs(musicLevel() - .42) < 1e-6);
      audio.dispose(); assert.equal(f.clock.tasks.size, 0);
    }
  }
});

test('nested pause reasons and stale WebAudio end callbacks cannot resurrect music', async () => {
  const f = webFixture(), audio = audioFor(f); await readyMusic(f, audio);
  const first = f.sources[0], ended = first.onended;
  audio.pause('ad'); audio.pause('visibility'); assert.equal(f.gains[0].gain.value, 0);
  ended(); await flush(); assert.equal(f.sources.length, 1);
  audio.setMusicScene('boss'); await audio.preloadMusic('boss');
  assert.equal(await audio.resume('ad'), false); assert.equal(audio.play('launch'), false);
  assert.equal(await audio.resume('visibility'), true); await flush();
  assert.equal(f.sources.at(-1).buffer.id, MUSIC.boss); assert.equal(f.sources.at(-1).loop, true);
  const stale = f.sources.at(-1).onended; audio.dispose(); const count = f.sources.length;
  ended(); stale(); await flush(); assert.equal(f.sources.length, count); assert.equal(f.clock.tasks.size, 0);
});

test('decodes completing during pause or after dispose never start a new voice', async () => {
  const f = webFixture(), audio = audioFor(f); await readyMusic(f, audio);
  const explore = deferred(); f.delayedDecode.set(MUSIC.explore, explore);
  audio.setMusicScene('explore'); await flush(); audio.pause('ad');
  explore.resolve(); await flush(); assert.equal(f.sources.length, 1);
  await audio.resume('ad'); await flush(); assert.equal(audio.status.playingScene, 'explore');
  await f.clock.advance(800);
  const boss = deferred(); f.delayedDecode.set(MUSIC.boss, boss);
  const preload = audio.preloadMusic('boss'); await flush();
  audio.setMusicScene('boss'); const count = f.sources.length; audio.dispose();
  boss.resolve(); await preload; await flush();
  assert.equal(f.sources.length, count); assert.deepEqual(audio.status.cachedMusicScenes, []); assert.equal(f.clock.tasks.size, 0);
});

test('dispose also resolves a music prefetch waiting for a PCM budget slot', async () => {
  const f = webFixture(), audio = audioFor(f); await readyMusic(f, audio);
  await audio.preloadMusic('explore'); audio.setMusicScene('explore'); await flush();
  const queued = audio.preloadMusic('boss'); await flush(); audio.dispose(); await queued;
  assert.equal(f.fetches.includes(MUSIC.boss), false); assert.equal(f.clock.tasks.size, 0);
});

test('a delayed context resume cannot unlock or play after dispose', async () => {
  const f = webFixture(), gate = deferred(), audio = audioFor(f);
  await audio.prepare(); f.resumeOverride = context => gate.promise.then(() => { context.state = 'running'; });
  audio.startMusic(); const unlocking = audio.unlock(); audio.dispose(); gate.resolve();
  assert.equal(await unlocking, false); assert.equal(audio.status.unlocked, false); assert.equal(f.sources.length, 0);
});

test('a delayed context resume cannot override a newer pause', async () => {
  const f = webFixture(), gate = deferred(), audio = audioFor(f);
  await audio.prepare(); f.resumeOverride = context => gate.promise.then(() => { context.state = 'running'; });
  audio.startMusic(); const unlocking = audio.unlock(); audio.pause('visibility'); gate.resolve();
  assert.equal(await unlocking, false); assert.equal(audio.status.paused, true); assert.equal(f.gains[0].gain.value, 0);
  assert.equal(f.sources.length, 0); audio.dispose();
});

test('WeChat prepares formal URLs without synthesizing files, then crossfades two looped players', async () => {
  const f = wxFixture(), audio = audioFor(f); await audio.prepare();
  assert.equal(audio.mode, 'wechat-inner'); assert.equal(f.files.size, 0); assert.equal(f.audios.length, 0);
  await audio.unlock(); audio.startMusic(); await flush(); const camp = f.audios[0];
  assert.equal(camp.src, MUSIC.camp); assert.equal(camp.loop, true);
  await f.clock.advance(800); assert.ok(Math.abs(camp.volume - .8 * .42) < 1e-6);
  await audio.preloadMusic('explore'); assert.equal(f.audios.length, 1);
  audio.setMusicScene('explore'); await flush(); const explore = f.audios[1];
  assert.equal(explore.src, MUSIC.explore); assert.equal(explore.loop, true); assert.equal(audio.status.activeMusicVoices, 2);
  await f.clock.advance(325); assert.ok(camp.volume > 0 && explore.volume > 0);
  await f.clock.advance(475); assert.equal(camp.destroyed, true); assert.equal(audio.status.activeMusicVoices, 1);
  const plays = explore.plays; explore.ended(); assert.equal(explore.plays, plays + 1); assert.equal(explore.loop, true);
  audio.dispose(); assert.equal(f.clock.tasks.size, 0);
});

test('lazy music bundles prepare only camp and share concurrent prefetch/play requests', async () => {
  for (const f of [webFixture(), wxFixture()]) {
    const requested = [], explore = deferred();
    const audio = audioFor(f, { musicUrls: undefined, resolveMusicUrl: async scene => {
      requested.push(scene);
      if (scene === 'explore') await explore.promise;
      return MUSIC[scene];
    } });
    await readyMusic(f, audio);
    assert.deepEqual(requested, ['camp']);
    assert.equal(audio.status.playingScene, 'camp');
    const prefetch = audio.preloadMusic('explore');
    audio.setMusicScene('explore'); audio.startMusic(); await flush();
    assert.deepEqual(requested, ['camp', 'explore']);
    assert.equal(audio.status.playingScene, 'camp');
    explore.resolve(); await prefetch; await flush(); await f.clock.advance(800);
    assert.equal(audio.status.playingScene, 'explore');
    assert.equal(audio.status.activeMusicVoices, 1);
    assert.equal(requested.includes('boss'), false);
    audio.dispose(); assert.equal(f.clock.tasks.size, 0);
  }
});

test('a failed lazy boss bundle retains the playing score and requires explicit retry', async () => {
  const f = wxFixture(), requested = [];
  let failBoss = true;
  const audio = audioFor(f, { musicUrls: undefined, resolveMusicUrl: async scene => {
    requested.push(scene);
    if (scene === 'boss' && failBoss) throw new Error('expected missing boss subpackage');
    return MUSIC[scene];
  } });
  await readyMusic(f, audio);
  audio.setMusicScene('boss'); await flush();
  assert.equal(audio.status.playingScene, 'camp');
  assert.ok(f.warnings.some(message => message.includes('missing boss subpackage')));
  audio.startMusic(); await audio.unlock(); audio.startMusic(); await flush();
  assert.equal(requested.filter(scene => scene === 'boss').length, 1);
  failBoss = false; await audio.preloadMusic('boss'); audio.startMusic(); await flush();
  assert.equal(audio.status.playingScene, 'boss');
  assert.equal(requested.filter(scene => scene === 'boss').length, 2);
  assert.equal(f.files.size, 0); audio.dispose();
});

test('a hung initial native music bundle cannot leave preparation pending forever', async () => {
  const f = wxFixture(), gate = deferred();
  const audio = audioFor(f, { musicUrls: undefined, loadTimeoutMs: 100, resolveMusicUrl: () => gate.promise });
  const preparation = audio.prepare(); await flush(); await f.clock.advance(150); await preparation;
  assert.equal(audio.status.prepared, true);
  assert.ok(f.warnings.some(message => message.includes('超时')));
  gate.resolve(MUSIC.camp); await audio.unlock(); audio.startMusic(); await flush();
  assert.equal(audio.status.playingScene, null);
  assert.equal(f.audios.length, 0);
  audio.dispose(); assert.equal(f.clock.tasks.size, 0);
});

test('hung WebAudio fetches and decoders time out without blocking prepared sounds or accepting late data', async () => {
  const f = webFixture(), fetchGate = deferred(), decodeGate = deferred();
  const fetch = f.environment.fetch;
  f.environment.fetch = url => url === ASSETS.stone_hit[0] ? fetchGate.promise.then(() => fetch(url)) : fetch(url);
  f.delayedDecode.set(ASSETS.stone_hit[1], decodeGate);
  f.delayedDecode.set(MUSIC.camp, decodeGate);
  const audio = audioFor(f, { loadTimeoutMs: 100 });
  const preparation = audio.prepare(); await flush(); await f.clock.advance(150); await preparation;
  assert.equal(audio.status.prepared, true);
  await audio.unlock(); audio.startMusic(); await flush();
  assert.equal(audio.play('click'), true);
  assert.equal(audio.play('stone_hit'), false);
  assert.equal(audio.status.playingScene, null);
  fetchGate.resolve(); decodeGate.resolve(); await flush();
  assert.equal(audio.play('stone_hit'), false);
  assert.deepEqual(audio.status.cachedMusicScenes, []);
  assert.ok(f.warnings.some(message => message.includes('超时')));
  audio.dispose(); assert.equal(f.clock.tasks.size, 0);
});

test('disposing resolves hanging media preparation and ignores a later native bundle callback', async () => {
  const f = wxFixture(), gate = deferred();
  const audio = audioFor(f, { musicUrls: undefined, resolveMusicUrl: () => gate.promise });
  const preparation = audio.prepare(); await flush(); audio.dispose(); await preparation;
  gate.resolve(MUSIC.camp); await flush();
  assert.equal(f.audios.length, 0); assert.equal(f.clock.tasks.size, 0);
  assert.equal(audio.status.prepared, false); assert.equal(f.warnings.length, 0);
});

test('native playback errors do not create a new failing player on every input', async () => {
  const f = wxFixture(), audio = audioFor(f); await readyMusic(f, audio);
  f.audios[0].error({ errMsg: 'expected missing native file' });
  const count = f.audios.length;
  for (let i = 0; i < 4; i++) { await audio.unlock(); audio.startMusic(); }
  await flush(); assert.equal(f.audios.length, count);
  await audio.preloadMusic('camp'); audio.startMusic(); await flush();
  assert.equal(f.audios.length, count + 1);
  audio.dispose(); assert.equal(f.clock.tasks.size, 0);
});

test('WeChat pause during crossfade cancels old voices and interruption/ad/visibility resume independently', async () => {
  const f = wxFixture(), audio = audioFor(f); await readyMusic(f, audio);
  audio.setMusicScene('explore'); await f.clock.advance(100);
  const current = f.audios.at(-1), staleEnd = [...current.endHandlers][0];
  f.events.hide(); f.events.interrupt(); audio.pause('ad');
  const plays = current.plays; staleEnd(); await f.clock.advance(1000);
  assert.equal(current.plays, plays); assert.equal(f.audios[0].destroyed, true);
  assert.equal(await audio.resume('ad'), false); f.events.show(); await flush(); assert.equal(current.plays, plays);
  f.events.interruptEnd(); await flush(); assert.equal(current.plays, plays + 1);
  audio.dispose(); const stopped = current.plays; staleEnd(); await f.clock.advance(1000);
  assert.equal(current.plays, stopped); assert.equal(current.destroyed, true);
  assert.equal(f.events.hide, undefined); assert.equal(f.events.show, undefined); assert.equal(f.events.interrupt, undefined);
});

test('WeChat pooled SFX stay bounded and stale callbacks cannot end a newer cue in the same slot', async () => {
  const f = wxFixture(), audio = audioFor(f, { maxConcurrentSounds: 1 }); await audio.prepare(); await audio.unlock();
  assert.equal(audio.play('stone_hit'), true); const slot = f.audios[0], staleEnd = [...slot.endHandlers][0];
  await f.clock.advance(60); assert.equal(audio.play('wood_hit'), true); assert.equal(f.audios.length, 1);
  staleEnd(); assert.equal(audio.status.activeSounds, 1); assert.equal(slot.src, ASSETS.wood_hit[0]);
  audio.dispose(); const plays = slot.plays; staleEnd(); assert.equal(slot.plays, plays); assert.equal(slot.destroyed, true);
});

test('native file failures warn without creating an implicit fallback WAV', async () => {
  const f = wxFixture(), audio = audioFor(f); await readyMusic(f, audio);
  f.audios[0].error({ errMsg: 'expected missing native file' });
  assert.ok(f.warnings.some(message => message.includes('播放失败'))); assert.equal(f.files.size, 0);
  audio.dispose();
});

test('an unavailable next native score never strands the retained score paused after an ad', async () => {
  const f = wxFixture(), audio = audioFor(f, { musicUrls: { ...MUSIC, explore: '' } });
  await readyMusic(f, audio); const camp = f.audios[0];
  audio.setMusicScene('explore'); await flush();
  assert.equal(audio.status.playingScene, 'camp');
  audio.pause('ad'); const plays = camp.plays;
  await audio.resume('ad'); await flush(); await f.clock.advance(250);
  assert.equal(camp.plays, plays + 1); assert.ok(camp.volume > 0);
  assert.equal(audio.status.playingScene, 'camp'); assert.equal(camp.loop, true);
  assert.equal(f.files.size, 0); audio.dispose();
});

test('partially initialized native players release safely when assigning a file URL throws', async () => {
  const f = wxFixture(), create = f.wx.createInnerAudioContext;
  f.wx.createInnerAudioContext = () => {
    const audio = create();
    Object.defineProperty(audio, 'src', { set() { throw new Error('expected rejected native URL'); } });
    audio.offEnded = fn => { assert.equal(typeof fn, 'function'); };
    audio.offError = fn => { assert.equal(typeof fn, 'function'); };
    return audio;
  };
  const audio = audioFor(f); await audio.prepare(); await audio.unlock(); audio.startMusic(); await flush();
  assert.equal(audio.status.activeMusicVoices, 0); assert.equal(f.audios[0].destroyed, true);
  assert.equal(audio.play('stone_hit'), false); assert.equal(audio.status.activeSounds, 0);
  assert.ok(f.warnings.some(message => message.includes('rejected native URL')));
  audio.dispose(); assert.equal(f.audios.every(player => player.destroyed), true); assert.equal(f.clock.tasks.size, 0);
});

test('stopping music invalidates saved end handlers on both backends', async () => {
  for (const f of [webFixture(), wxFixture()]) {
    const audio = audioFor(f); await readyMusic(f, audio);
    const source = f.sources?.[0] || f.audios[0];
    const ended = source.onended || [...source.endHandlers][0];
    audio.stopMusic(); const count = f.sources?.length || f.audios.length, plays = source.plays;
    ended(); await flush(); await f.clock.advance(1000);
    assert.equal(f.sources?.length || f.audios.length, count); if (plays !== undefined) assert.equal(source.plays, plays);
    assert.equal(audio.status.activeMusicVoices, 0); audio.dispose();
  }
});

test('an unavailable backend reports failure without throwing or generating audio', async () => {
  const warnings = [], audio = new GameAudio({ environment: {}, onWarning: message => warnings.push(message) });
  await audio.prepare(); assert.equal(await audio.unlock(), false); assert.equal(audio.mode, 'unavailable');
  assert.equal(audio.play('launch'), false); assert.ok(warnings.length > 0); audio.dispose();
});

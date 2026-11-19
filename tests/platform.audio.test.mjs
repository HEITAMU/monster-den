import test from 'node:test';
import assert from 'node:assert/strict';
import { GameAudio, synthesizeCue, encodeWav } from '../assets/scripts/platform/GameAudio.ts';

function webFixture() {
  const sources = [];
  const gains = [];
  class Context {
    state = 'suspended'; destination = {};
    resume() { this.state = 'running'; return Promise.resolve(); }
    suspend() { this.state = 'suspended'; return Promise.resolve(); }
    close() { this.state = 'closed'; return Promise.resolve(); }
    createGain() { const gain = { gain: { value: 1 }, connect() {}, disconnect() {} }; gains.push(gain); return gain; }
    createBuffer(channels, length, rate) { return { length, sampleRate: rate, copyToChannel() {} }; }
    createBufferSource() {
      const source = { loop: false, starts: 0, stops: 0, connect() {}, disconnect() {}, start() { this.starts++; }, stop() { this.stops++; this.onended?.(); } };
      sources.push(source); return source;
    }
  }
  return { sources, gains, environment: { AudioContext: Context } };
}

function wxFixture() {
  const files = new Map();
  const audios = [];
  const events = {};
  const wx = {
    env: { USER_DATA_PATH: '/wx-local' },
    getFileSystemManager: () => ({
      accessSync(path) { if (!files.has(path)) throw new Error('missing'); },
      writeFileSync: (path, bytes) => files.set(path, bytes),
    }),
    createInnerAudioContext() {
      const audio = { loop: false, plays: 0, pauses: 0, stops: 0, destroyed: false, src: '', volume: 1,
        play() { this.plays++; }, pause() { this.pauses++; }, stop() { this.stops++; }, seek() {},
        destroy() { this.destroyed = true; }, onEnded(fn) { this.ended = fn; }, onError() {},
      };
      audios.push(audio); return audio;
    },
    onHide: fn => { events.hide = fn; }, onShow: fn => { events.show = fn; },
    offHide: fn => { if (events.hide === fn) delete events.hide; }, offShow: fn => { if (events.show === fn) delete events.show; },
  };
  return { wx, audios, files, events };
}

test('all synthesized cues are finite, bounded, and valid mono PCM WAVs', () => {
  for (const name of ['music', 'launch', 'impact', 'break', 'loot', 'danger', 'win', 'click']) {
    const cue = synthesizeCue(name);
    let peak = 0;
    for (const sample of cue.samples) { assert.ok(Number.isFinite(sample)); peak = Math.max(peak, Math.abs(sample)); }
    assert.ok(peak > 0.01 && peak <= 0.881);
    const bytes = encodeWav(cue);
    const view = new DataView(bytes);
    assert.equal(new TextDecoder().decode(new Uint8Array(bytes, 0, 4)), 'RIFF');
    assert.equal(new TextDecoder().decode(new Uint8Array(bytes, 8, 4)), 'WAVE');
    assert.equal(view.getUint16(22, true), 1);
    assert.equal(view.getUint32(40, true), cue.samples.length * 2);
    assert.equal(Math.abs(cue.samples[0]), 0);
    assert.equal(Math.abs(cue.samples.at(-1)), 0);
  }
});

test('music is explicitly looped after user unlock, never a single one-shot clip', async () => {
  const fixture = webFixture();
  const audio = new GameAudio({ environment: fixture.environment });
  audio.prepare(); audio.startMusic();
  assert.equal(fixture.sources.length, 0);
  await audio.unlock();
  assert.equal(fixture.sources.length, 1);
  assert.equal(fixture.sources[0].loop, true);
  assert.equal(fixture.sources[0].starts, 1);
  audio.startMusic();
  assert.equal(fixture.sources.length, 1);
  audio.dispose();
});

test('mute and master/category volume controls update the mixer independently', async () => {
  const fixture = webFixture();
  const audio = new GameAudio({ environment: fixture.environment });
  await audio.unlock();
  audio.setSettings({ masterVolume: 0.6, musicVolume: 0.2, sfxVolume: 0.7 });
  assert.equal(fixture.gains[0].gain.value, 0.6);
  assert.equal(fixture.gains[1].gain.value, 0.2);
  assert.equal(fixture.gains[2].gain.value, 0.7);
  audio.setMuted(true);
  assert.equal(fixture.gains[0].gain.value, 0);
  assert.equal(audio.play('impact'), false);
  audio.setMuted(false);
  assert.equal(fixture.gains[0].gain.value, 0.6);
  audio.dispose();
});

test('an ad ending cannot resume audio while the application is still hidden', async () => {
  const fixture = webFixture();
  const audio = new GameAudio({ environment: fixture.environment });
  await audio.unlock(); audio.startMusic();
  audio.pause('ad'); audio.pause('visibility');
  assert.equal(await audio.resume('ad'), false);
  assert.equal(audio.status.paused, true);
  assert.equal(audio.play('launch'), false);
  assert.equal(await audio.resume('visibility'), true);
  assert.equal(audio.status.paused, false);
  audio.dispose();
});

test('WeChat prefers InnerAudio, generates local WAVs, and loops with an ended fallback', async () => {
  const fixture = wxFixture();
  const audio = new GameAudio({ environment: { wx: fixture.wx, AudioContext() { throw new Error('wrong backend'); } } });
  assert.equal(audio.prepare(), true);
  assert.equal(audio.mode, 'wechat-inner');
  assert.ok(fixture.files.has('/wx-local/monster-den-audio-v1-music.wav'));
  await audio.unlock(); audio.startMusic();
  const music = fixture.audios[0];
  assert.equal(music.loop, true);
  const plays = music.plays;
  music.ended();
  assert.equal(music.plays, plays + 1);
  fixture.events.hide();
  assert.equal(audio.status.paused, true);
  fixture.events.show();
  assert.equal(audio.status.paused, false);
  audio.dispose();
  assert.equal(music.destroyed, true);
  assert.equal(fixture.events.hide, undefined);
});

test('stopping or disposing music cannot restart it from stale end callbacks', async () => {
  const fixture = wxFixture();
  const audio = new GameAudio({ environment: { wx: fixture.wx } });
  await audio.unlock(); audio.startMusic();
  const music = fixture.audios[0];
  audio.stopMusic();
  const stoppedPlays = music.plays;
  music.ended();
  assert.equal(music.plays, stoppedPlays);
  audio.dispose(); music.ended();
  assert.equal(music.plays, stoppedPlays);
});

test('audio without a backend reports unavailable instead of throwing', async () => {
  const warnings = [];
  const audio = new GameAudio({ environment: {}, onWarning: m => warnings.push(m) });
  assert.equal(await audio.unlock(), false);
  assert.equal(audio.mode, 'unavailable');
  assert.equal(audio.play('impact'), false);
  assert.ok(warnings.length > 0);
  audio.dispose();
});

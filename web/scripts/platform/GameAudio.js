System.register([], function (exports_1, context_1) {
    "use strict";
    var SAMPLE_RATE, AUDIO_VERSION, cueCache, GameAudio;
    var __moduleName = context_1 && context_1.id;
    function clamp(value, fallback) {
        return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
    }
    /** Deterministic composition, not a stream that can run out halfway through a level. */
    function synthesizeCue(cue, sampleRate = SAMPLE_RATE) {
        if (!Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 96000)
            throw new Error('Unsupported sample rate.');
        const beat = 60 / 104;
        const durations = { launch: 0.24, impact: 0.22, break: 0.42, loot: 0.5, danger: 0.55, win: 1.4, click: 0.08, music: beat * 16 };
        const duration = durations[cue];
        if (!duration)
            throw new Error(`Unknown audio cue: ${cue}`);
        const samples = new Float32Array(Math.ceil(duration * sampleRate));
        let randomState = 0x51ad3f19;
        const noise = () => {
            randomState ^= randomState << 13;
            randomState ^= randomState >>> 17;
            randomState ^= randomState << 5;
            return (randomState >>> 0) / 0x100000000 * 2 - 1;
        };
        const tone = (start, length, frequency, level, color = 0.18, slide = 0, soft = false) => {
            const first = Math.floor(start * sampleRate);
            const count = Math.min(Math.floor(length * sampleRate), samples.length - first);
            let phase = 0;
            for (let i = 0; i < count; i++) {
                const t = i / sampleRate;
                const fraction = i / Math.max(1, count - 1);
                const freq = frequency * Math.pow(2, slide * fraction);
                phase += 2 * Math.PI * freq / sampleRate;
                const attack = Math.min(1, t / (soft ? 0.08 : 0.003));
                const envelope = soft ? Math.sin(Math.PI * fraction) ** 1.1 : attack * Math.exp(-fraction * 6.5) * Math.min(1, (1 - fraction) * 50);
                const wave = Math.sin(phase) + color * Math.sin(phase * 2.01) + color * 0.35 * Math.sin(phase * 3.98);
                samples[first + i] += wave * envelope * level;
            }
        };
        const brush = (start, length, level, decay = 6) => {
            const first = Math.floor(start * sampleRate);
            const count = Math.min(Math.floor(length * sampleRate), samples.length - first);
            let low = 0;
            for (let i = 0; i < count; i++) {
                low = low * 0.63 + noise() * 0.37;
                samples[first + i] += low * Math.exp(-i / Math.max(1, count) * decay) * level;
            }
        };
        if (cue === 'music') {
            const chords = [[220, 261.626, 329.628], [174.614, 220, 261.626], [196, 261.626, 329.628], [196, 246.942, 293.665]];
            const bass = [110, 87.307, 130.813, 97.999];
            const pattern = [0, 2, 1, 2, 0, 1, 2, 1];
            for (let bar = 0; bar < 4; bar++) {
                const start = bar * beat * 4;
                for (const note of chords[bar])
                    tone(start, beat * 3.92, note * 0.5, 0.045, 0.08, 0, true);
                tone(start, beat * 1.65, bass[bar], 0.22, 0.15);
                tone(start + beat * 2, beat * 1.6, bass[bar], 0.18, 0.12);
                for (let step = 0; step < 8; step++) {
                    const startNote = start + step * beat * 0.5;
                    const octave = step === 3 || step === 7 ? 2 : 1;
                    tone(startNote, beat * 0.68, chords[bar][pattern[step]] * octave, step % 2 ? 0.067 : 0.105, 0.22);
                    brush(startNote, 0.032, step % 2 ? 0.025 : 0.038, 4);
                }
                for (let quarter = 0; quarter < 4; quarter++) {
                    tone(start + quarter * beat, 0.12, quarter % 2 ? 145 : 70, quarter % 2 ? 0.045 : 0.13, 0.05, -0.6);
                    if (quarter % 2)
                        brush(start + quarter * beat, 0.06, 0.055, 7);
                }
            }
        }
        else if (cue === 'launch') {
            tone(0, 0.23, 410, 0.35, 0.27, -1.45);
            tone(0.018, 0.15, 980, 0.1, 0.05, -0.9);
            brush(0.03, 0.12, 0.14, 3);
        }
        else if (cue === 'impact') {
            tone(0, 0.2, 115, 0.7, 0.3, -0.85);
            tone(0.006, 0.07, 340, 0.13, 0.4, -0.2);
            brush(0, 0.045, 0.7, 7);
        }
        else if (cue === 'break') {
            [0, 0.027, 0.061, 0.11, 0.19].forEach((start, i) => {
                brush(start, 0.045 + i * 0.012, 0.55 / (1 + i * 0.55), 6);
                tone(start, 0.16, 190 + i * 73, 0.21 / (1 + i * 0.45), 0.4, -0.25);
            });
        }
        else if (cue === 'loot') {
            [880, 1174.659, 1567.982].forEach((note, i) => tone(i * 0.06, 0.29, note, 0.22, 0.23));
            tone(0.025, 0.3, 440, 0.09, 0.1);
        }
        else if (cue === 'danger') {
            [0, 0.19].forEach(start => { tone(start, 0.25, 207.652, 0.3, 0.3); tone(start, 0.23, 220, 0.16, 0.1); });
        }
        else if (cue === 'win') {
            [523.251, 659.255, 783.991, 1046.502].forEach((note, i) => tone(i * 0.15, 0.68, note, 0.25, 0.14));
            [130.813, 261.626, 329.628].forEach(note => tone(0.45, 0.88, note, 0.1, 0.1, 0, true));
        }
        else {
            tone(0, 0.07, 620, 0.25, 0.35, -0.1);
            brush(0, 0.012, 0.11, 6);
        }
        let peak = 0;
        for (const value of samples)
            peak = Math.max(peak, Math.abs(value));
        const scale = peak > 0.88 ? 0.88 / peak : 1;
        const fade = Math.ceil(sampleRate * 0.002);
        for (let i = 0; i < samples.length; i++) {
            samples[i] *= scale * Math.min(1, i / fade, (samples.length - 1 - i) / fade);
        }
        return { samples, sampleRate, duration: samples.length / sampleRate };
    }
    exports_1("synthesizeCue", synthesizeCue);
    function cachedCue(cue) {
        let value = cueCache.get(cue);
        if (!value) {
            value = synthesizeCue(cue);
            cueCache.set(cue, value);
        }
        return value;
    }
    function encodeWav(cue) {
        const dataLength = cue.samples.length * 2;
        const buffer = new ArrayBuffer(44 + dataLength);
        const data = new DataView(buffer);
        const text = (offset, value) => { for (let i = 0; i < value.length; i++)
            data.setUint8(offset + i, value.charCodeAt(i)); };
        text(0, 'RIFF');
        data.setUint32(4, 36 + dataLength, true);
        text(8, 'WAVE');
        text(12, 'fmt ');
        data.setUint32(16, 16, true);
        data.setUint16(20, 1, true);
        data.setUint16(22, 1, true);
        data.setUint32(24, cue.sampleRate, true);
        data.setUint32(28, cue.sampleRate * 2, true);
        data.setUint16(32, 2, true);
        data.setUint16(34, 16, true);
        text(36, 'data');
        data.setUint32(40, dataLength, true);
        for (let i = 0; i < cue.samples.length; i++) {
            const value = Math.max(-1, Math.min(1, cue.samples[i]));
            data.setInt16(44 + i * 2, Math.round(value < 0 ? value * 32768 : value * 32767), true);
        }
        return buffer;
    }
    exports_1("encodeWav", encodeWav);
    return {
        setters: [],
        execute: function () {
            SAMPLE_RATE = 22050;
            AUDIO_VERSION = 'v1';
            cueCache = new Map();
            GameAudio = class GameAudio {
                constructor(options = {}) {
                    this.mode = 'uninitialized';
                    this.context = null;
                    this.masterGain = null;
                    this.musicGain = null;
                    this.sfxGain = null;
                    this.buffers = new Map();
                    this.musicSource = null;
                    this.activeSources = new Set();
                    this.innerMusic = null;
                    this.innerVoices = [];
                    this.nextVoice = 0;
                    this.pauseReasons = new Set();
                    this.lastPlayed = new Map();
                    this.unlocked = false;
                    this.musicWanted = false;
                    this.disposed = false;
                    this.environment = options.environment ?? globalThis;
                    this.wx = this.environment.wx;
                    this.urls = { ...options.assetUrls };
                    this.onWarning = options.onWarning ?? (() => { });
                    this.settingsValue = {
                        muted: options.settings?.muted === true,
                        masterVolume: clamp(options.settings?.masterVolume, 0.8),
                        musicVolume: clamp(options.settings?.musicVolume, 0.42),
                        sfxVolume: clamp(options.settings?.sfxVolume, 0.85),
                    };
                    this.onHide = () => { this.pause('visibility'); };
                    this.onShow = () => { void this.resume('visibility'); };
                    this.onVisibility = () => {
                        if (this.environment.document?.hidden)
                            this.onHide();
                        else
                            this.onShow();
                    };
                    this.wx?.onHide?.(this.onHide);
                    this.wx?.onShow?.(this.onShow);
                    this.environment.document?.addEventListener?.('visibilitychange', this.onVisibility);
                }
                get settings() { return { ...this.settingsValue }; }
                get status() {
                    return { mode: this.mode, unlocked: this.unlocked, paused: this.pauseReasons.size > 0, musicRequested: this.musicWanted };
                }
                warn(error) { try {
                    this.onWarning(`音频：${String(error?.message ?? error)}`);
                }
                catch { /* Optional diagnostics. */ } }
                init() {
                    if (this.disposed)
                        return false;
                    if (this.mode !== 'uninitialized')
                        return this.mode !== 'unavailable';
                    if (this.wx?.createInnerAudioContext && (this.urls.music || this.wx.getFileSystemManager && this.wx.env?.USER_DATA_PATH)) {
                        this.mode = 'wechat-inner';
                        return true;
                    }
                    const AudioContext = this.environment.AudioContext ?? this.environment.webkitAudioContext;
                    try {
                        this.context = AudioContext ? new AudioContext({ latencyHint: 'interactive' }) : this.wx?.createWebAudioContext?.();
                        if (!this.context?.createGain || !this.context?.createBuffer || !this.context?.createBufferSource)
                            throw new Error('当前环境没有可用音频后端。');
                        this.masterGain = this.context.createGain();
                        this.musicGain = this.context.createGain();
                        this.sfxGain = this.context.createGain();
                        this.musicGain.connect(this.masterGain);
                        this.sfxGain.connect(this.masterGain);
                        this.masterGain.connect(this.context.destination);
                        this.mode = 'web-audio';
                        this.updateVolumes();
                        return true;
                    }
                    catch (error) {
                        this.mode = 'unavailable';
                        this.warn(error);
                        return false;
                    }
                }
                sourceUrl(cue) {
                    if (this.urls[cue])
                        return this.urls[cue];
                    const fs = this.wx.getFileSystemManager();
                    const path = `${this.wx.env.USER_DATA_PATH}/monster-den-audio-${AUDIO_VERSION}-${cue}.wav`;
                    let exists = false;
                    try {
                        fs.accessSync(path);
                        exists = true;
                    }
                    catch { /* Generate this original sample once. */ }
                    if (!exists)
                        fs.writeFileSync(path, encodeWav(cachedCue(cue)));
                    this.urls[cue] = path;
                    return path;
                }
                webBuffer(cue) {
                    let buffer = this.buffers.get(cue);
                    if (!buffer) {
                        const synthesized = cachedCue(cue);
                        buffer = this.context.createBuffer(1, synthesized.samples.length, synthesized.sampleRate);
                        if (buffer.copyToChannel)
                            buffer.copyToChannel(synthesized.samples, 0);
                        else
                            buffer.getChannelData(0).set(synthesized.samples);
                        this.buffers.set(cue, buffer);
                    }
                    return buffer;
                }
                /** Call while the title/loading screen is visible to avoid generating the score during combat. */
                prepare() {
                    if (!this.init())
                        return false;
                    try {
                        if (this.mode === 'wechat-inner')
                            for (const cue of ['music', 'impact', 'launch', 'click'])
                                this.sourceUrl(cue);
                        else
                            for (const cue of ['music', 'impact', 'launch', 'click'])
                                this.webBuffer(cue);
                        return true;
                    }
                    catch (error) {
                        this.warn(error);
                        return false;
                    }
                }
                /** Invoke from the first deliberate touch/click to satisfy browser audio policies. */
                async unlock() {
                    if (!this.init())
                        return false;
                    try {
                        if (this.mode === 'web-audio' && this.pauseReasons.size === 0)
                            await this.context.resume?.();
                        this.unlocked = this.mode === 'wechat-inner' || this.context.state === 'running' || this.context.state === undefined;
                        if (this.unlocked && this.musicWanted && this.pauseReasons.size === 0)
                            this.beginMusic();
                        return this.unlocked;
                    }
                    catch (error) {
                        this.warn(error);
                        return false;
                    }
                }
                setSettings(patch) {
                    const old = this.settingsValue;
                    this.settingsValue = {
                        muted: typeof patch.muted === 'boolean' ? patch.muted : old.muted,
                        masterVolume: clamp(patch.masterVolume, old.masterVolume),
                        musicVolume: clamp(patch.musicVolume, old.musicVolume),
                        sfxVolume: clamp(patch.sfxVolume, old.sfxVolume),
                    };
                    this.updateVolumes();
                }
                setMuted(muted) { this.setSettings({ muted }); }
                updateVolumes() {
                    const settings = this.settingsValue;
                    const master = settings.muted ? 0 : settings.masterVolume;
                    if (this.masterGain)
                        this.masterGain.gain.value = master;
                    if (this.musicGain)
                        this.musicGain.gain.value = settings.musicVolume;
                    if (this.sfxGain)
                        this.sfxGain.gain.value = settings.sfxVolume;
                    if (this.innerMusic)
                        this.innerMusic.volume = master * settings.musicVolume;
                    for (const voice of this.innerVoices)
                        voice.audio.volume = master * settings.sfxVolume * voice.intensity;
                }
                startMusic() {
                    if (this.disposed)
                        return;
                    this.musicWanted = true;
                    if (this.unlocked && this.pauseReasons.size === 0)
                        this.beginMusic();
                }
                playInner(audio) {
                    const result = audio.play();
                    if (result?.catch)
                        result.catch((error) => this.warn(error));
                }
                beginMusic() {
                    if (this.disposed || !this.musicWanted || this.pauseReasons.size > 0)
                        return;
                    try {
                        if (this.mode === 'wechat-inner') {
                            if (!this.innerMusic) {
                                const audio = this.wx.createInnerAudioContext();
                                audio.src = this.sourceUrl('music');
                                audio.loop = true;
                                audio.autoplay = false;
                                audio.onError?.((error) => this.warn(error));
                                audio.onEnded?.(() => {
                                    // Defensive fallback for runtimes that emit ended at a loop boundary.
                                    if (this.musicWanted && this.unlocked && this.pauseReasons.size === 0 && !this.disposed) {
                                        audio.seek?.(0);
                                        this.playInner(audio);
                                    }
                                });
                                this.innerMusic = audio;
                                this.updateVolumes();
                            }
                            this.playInner(this.innerMusic);
                        }
                        else if (this.mode === 'web-audio' && !this.musicSource) {
                            const source = this.context.createBufferSource();
                            source.buffer = this.webBuffer('music');
                            source.loop = true;
                            source.connect(this.musicGain);
                            source.onended = () => {
                                if (this.musicSource !== source)
                                    return;
                                this.musicSource = null;
                                if (this.musicWanted && !this.disposed && this.pauseReasons.size === 0)
                                    this.beginMusic();
                            };
                            this.musicSource = source;
                            source.start();
                        }
                    }
                    catch (error) {
                        this.warn(error);
                    }
                }
                stopMusic() {
                    this.musicWanted = false;
                    const source = this.musicSource;
                    this.musicSource = null;
                    try {
                        source?.stop();
                        source?.disconnect();
                    }
                    catch { /* A completed source may already be stopped. */ }
                    try {
                        this.innerMusic?.stop();
                    }
                    catch { /* Optional backend. */ }
                }
                play(cue, intensity = 1) {
                    if (!this.unlocked || this.disposed || this.pauseReasons.size > 0 || this.settingsValue.muted)
                        return false;
                    const now = Date.now();
                    if (now - (this.lastPlayed.get(cue) ?? -Infinity) < 35)
                        return false;
                    this.lastPlayed.set(cue, now);
                    const gain = clamp(intensity, 1);
                    try {
                        if (this.mode === 'wechat-inner') {
                            let voice = this.innerVoices[this.nextVoice];
                            if (!voice) {
                                const audio = this.wx.createInnerAudioContext();
                                audio.loop = false;
                                audio.autoplay = false;
                                audio.onError?.((error) => this.warn(error));
                                voice = { audio, intensity: gain };
                                this.innerVoices.push(voice);
                            }
                            this.nextVoice = (this.nextVoice + 1) % 6;
                            voice.audio.stop();
                            voice.audio.src = this.sourceUrl(cue);
                            voice.intensity = gain;
                            voice.audio.volume = this.settingsValue.masterVolume * this.settingsValue.sfxVolume * gain;
                            this.playInner(voice.audio);
                        }
                        else if (this.mode === 'web-audio') {
                            const source = this.context.createBufferSource();
                            const volume = this.context.createGain();
                            source.buffer = this.webBuffer(cue);
                            volume.gain.value = gain;
                            source.connect(volume);
                            volume.connect(this.sfxGain);
                            this.activeSources.add(source);
                            source.onended = () => { this.activeSources.delete(source); source.disconnect(); volume.disconnect(); };
                            source.start();
                        }
                        else
                            return false;
                        return true;
                    }
                    catch (error) {
                        this.warn(error);
                        return false;
                    }
                }
                /** Reasons stack: finishing an ad must not resume audio while the app remains hidden. */
                pause(reason = 'manual') {
                    if (this.disposed)
                        return;
                    this.pauseReasons.add(reason);
                    try {
                        this.innerMusic?.pause();
                        for (const voice of this.innerVoices)
                            voice.audio.stop();
                    }
                    catch (error) {
                        this.warn(error);
                    }
                    for (const source of [...this.activeSources]) {
                        try {
                            source.stop();
                        }
                        catch { /* Already ended. */ }
                    }
                    this.activeSources.clear();
                    try {
                        const result = this.context?.suspend?.();
                        result?.catch?.((error) => this.warn(error));
                    }
                    catch (error) {
                        this.warn(error);
                    }
                }
                async resume(reason = 'manual') {
                    this.pauseReasons.delete(reason);
                    if (this.disposed || this.pauseReasons.size > 0 || !this.unlocked)
                        return false;
                    try {
                        if (this.mode === 'web-audio')
                            await this.context.resume?.();
                        if (this.musicWanted)
                            this.beginMusic();
                        return true;
                    }
                    catch (error) {
                        this.warn(error);
                        return false;
                    }
                }
                dispose() {
                    if (this.disposed)
                        return;
                    this.disposed = true;
                    this.stopMusic();
                    for (const source of this.activeSources) {
                        try {
                            source.stop();
                            source.disconnect();
                        }
                        catch { /* Already ended. */ }
                    }
                    this.activeSources.clear();
                    try {
                        this.innerMusic?.destroy();
                        for (const voice of this.innerVoices)
                            voice.audio.destroy();
                    }
                    catch { /* No audio backend. */ }
                    try {
                        const result = this.context?.close?.();
                        result?.catch?.(() => { });
                    }
                    catch { /* Already closed. */ }
                    this.wx?.offHide?.(this.onHide);
                    this.wx?.offShow?.(this.onShow);
                    this.environment.document?.removeEventListener?.('visibilitychange', this.onVisibility);
                    this.buffers.clear();
                    this.innerVoices = [];
                }
            };
            exports_1("GameAudio", GameAudio);
        }
    };
});

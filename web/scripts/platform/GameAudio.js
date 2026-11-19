System.register([], function (exports_1, context_1) {
    "use strict";
    var SCENES, SYNTH_COMPAT, PRIORITY, MIN_INTERVAL, IMPORTANT, canonicalCue, urls, SAMPLE_RATE, AUDIO_VERSION, cueCache, GameAudio;
    var __moduleName = context_1 && context_1.id;
    function clamp(value, fallback) {
        return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
    }
    /** Legacy procedural test/fallback asset. Production playback never uses it unless explicitly enabled. */
    function synthesizeCue(cue, sampleRate = SAMPLE_RATE) {
        if (!Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 96000)
            throw new Error('Unsupported sample rate.');
        const legacy = cue === 'music' ? 'music' : SYNTH_COMPAT[canonicalCue(cue)];
        const beat = 60 / 104;
        const durations = { launch: 0.24, impact: 0.22, break: 0.42, loot: 0.5, danger: 0.55, win: 1.4, click: 0.08, music: beat * 16 };
        const duration = durations[legacy];
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
        if (legacy === 'music') {
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
        else if (legacy === 'launch') {
            tone(0, 0.23, 410, 0.35, 0.27, -1.45);
            tone(0.018, 0.15, 980, 0.1, 0.05, -0.9);
            brush(0.03, 0.12, 0.14, 3);
        }
        else if (legacy === 'impact') {
            tone(0, 0.2, 115, 0.7, 0.3, -0.85);
            tone(0.006, 0.07, 340, 0.13, 0.4, -0.2);
            brush(0, 0.045, 0.7, 7);
        }
        else if (legacy === 'break') {
            [0, 0.027, 0.061, 0.11, 0.19].forEach((start, i) => {
                brush(start, 0.045 + i * 0.012, 0.55 / (1 + i * 0.55), 6);
                tone(start, 0.16, 190 + i * 73, 0.21 / (1 + i * 0.45), 0.4, -0.25);
            });
        }
        else if (legacy === 'loot') {
            [880, 1174.659, 1567.982].forEach((note, i) => tone(i * 0.06, 0.29, note, 0.22, 0.23));
            tone(0.025, 0.3, 440, 0.09, 0.1);
        }
        else if (legacy === 'danger') {
            [0, 0.19].forEach(start => { tone(start, 0.25, 207.652, 0.3, 0.3); tone(start, 0.23, 220, 0.16, 0.1); });
        }
        else if (legacy === 'win') {
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
            SCENES = ['camp', 'explore', 'boss'];
            SYNTH_COMPAT = {
                launch: 'launch', stone_hit: 'impact', wood_hit: 'impact', wood_break: 'break',
                cabinet_push: 'impact', enemy_hit: 'impact', enemy_down: 'break', arrow: 'launch',
                arrow_blocked: 'impact', loot: 'loot', danger: 'danger', win: 'win', lose: 'danger', click: 'click', tool: 'launch',
            };
            PRIORITY = {
                click: 20, stone_hit: 30, wood_hit: 30, arrow: 35, cabinet_push: 40, arrow_blocked: 45,
                enemy_hit: 50, launch: 55, wood_break: 60, enemy_down: 65, tool: 70, loot: 80, danger: 90, win: 100, lose: 100,
            };
            MIN_INTERVAL = {
                click: 55, stone_hit: 45, wood_hit: 55, arrow: 50, cabinet_push: 95, arrow_blocked: 65,
                enemy_hit: 70, launch: 90, wood_break: 90, enemy_down: 100, tool: 150, loot: 140, danger: 180, win: 700, lose: 700,
            };
            IMPORTANT = new Set(['wood_break', 'enemy_down', 'tool', 'loot', 'danger', 'win', 'lose']);
            canonicalCue = (cue) => cue === 'impact' ? 'stone_hit' : cue === 'break' ? 'wood_break' : cue;
            urls = (value) => (typeof value === 'string' ? [value] : Array.isArray(value) ? [...value] : []).filter(value => typeof value === 'string' && value.trim().length > 0);
            SAMPLE_RATE = 22050;
            AUDIO_VERSION = 'v1';
            cueCache = new Map();
            GameAudio = class GameAudio {
                constructor(options = {}) {
                    this.mode = 'uninitialized';
                    this.musicUrlLoads = new Map();
                    this.mediaWaiters = new Set();
                    this.soundUrls = {};
                    this.prefetchScene = null;
                    this.warned = new Set();
                    this.context = null;
                    this.masterGain = null;
                    this.musicGain = null;
                    this.sfxGain = null;
                    this.compressor = null;
                    this.soundBuffers = new Map();
                    this.soundLoads = new Map();
                    this.musicBuffers = new Map();
                    this.musicLoads = new Map();
                    this.musicFailures = new Set();
                    this.musicQueue = Promise.resolve();
                    this.slotWaiters = new Set();
                    this.fallbackBuffers = new Map();
                    this.fallbackUrls = new Map();
                    this.musicVoices = new Set();
                    this.currentMusic = null;
                    this.soundVoices = new Set();
                    this.innerSoundPool = [];
                    this.lastPlayed = new Map();
                    this.lastVariant = new Map();
                    this.pauseReasons = new Set();
                    this.timers = new Set();
                    this.aborts = new Set();
                    this.preparation = null;
                    this.prepared = false;
                    this.unlocked = false;
                    this.musicWanted = false;
                    this.disposed = false;
                    this.life = 0;
                    this.musicRevision = 0;
                    this.transportRevision = 0;
                    this.duckLevel = 1;
                    this.duckTarget = 1;
                    this.duckUntil = 0;
                    this.duckTimer = null;
                    this.duckFadeTimer = null;
                    this.environment = options.environment ?? globalThis;
                    this.wx = this.environment.wx;
                    this.musicUrls = { ...options.musicUrls };
                    this.resolveMusicUrl = options.resolveMusicUrl;
                    this.loadTimeoutMs = Math.max(100, Math.min(60000, Number.isFinite(options.loadTimeoutMs) ? options.loadTimeoutMs : 8000));
                    for (const [cue, value] of Object.entries(options.assetUrls || {}))
                        this.soundUrls[cue] = urls(value);
                    this.scene = options.initialMusicScene || 'camp';
                    this.crossfade = Math.max(.05, Math.min(.8, Number.isFinite(options.musicCrossfadeSeconds) ? options.musicCrossfadeSeconds : .65));
                    this.maxSounds = Math.max(1, Math.min(12, Math.floor(options.maxConcurrentSounds || 6)));
                    this.allowFallback = options.allowProceduralFallback === true;
                    this.onWarning = options.onWarning ?? (message => (this.environment.console || console).warn(message));
                    this.now = options.now ?? (() => this.environment.performance?.now?.() ?? Date.now());
                    this.random = options.random ?? Math.random;
                    this.settingsValue = { muted: options.settings?.muted === true,
                        masterVolume: clamp(options.settings?.masterVolume, .8), musicVolume: clamp(options.settings?.musicVolume, .42),
                        sfxVolume: clamp(options.settings?.sfxVolume, .85) };
                    this.onHide = () => this.pause('visibility');
                    this.onShow = () => { void this.resume('visibility'); };
                    this.onVisibility = () => this.environment.document?.hidden ? this.onHide() : this.onShow();
                    this.onInterruptionBegin = () => this.pause('interruption');
                    this.onInterruptionEnd = () => { void this.resume('interruption'); };
                    this.wx?.onHide?.(this.onHide);
                    this.wx?.onShow?.(this.onShow);
                    this.wx?.onAudioInterruptionBegin?.(this.onInterruptionBegin);
                    this.wx?.onAudioInterruptionEnd?.(this.onInterruptionEnd);
                    this.environment.document?.addEventListener?.('visibilitychange', this.onVisibility);
                }
                get settings() { return { ...this.settingsValue }; }
                get status() {
                    return { mode: this.mode, unlocked: this.unlocked, paused: this.pauseReasons.size > 0,
                        musicRequested: this.musicWanted, prepared: this.prepared, scene: this.scene,
                        playingScene: this.currentMusic?.scene || null, activeMusicVoices: this.musicVoices.size,
                        activeSounds: this.soundVoices.size, cachedMusicScenes: [...this.musicBuffers.keys()],
                        decodedMusicBytes: [...this.musicBuffers.values()].reduce((n, buffer) => n + (buffer.length || 0) * (buffer.numberOfChannels || 1) * 4, 0) };
                }
                warn(error, key) {
                    if (this.disposed)
                        return;
                    const text = String(error?.message ?? error), identity = key || text;
                    if (this.warned.has(identity))
                        return;
                    this.warned.add(identity);
                    try {
                        this.onWarning(`音频：${text}`);
                    }
                    catch { /* Diagnostics never interrupt gameplay. */ }
                }
                schedule(action, milliseconds) {
                    const schedule = this.environment.setTimeout || globalThis.setTimeout;
                    const handle = schedule.call(this.environment, () => {
                        this.timers.delete(handle);
                        if (!this.disposed)
                            action();
                    }, Math.max(0, milliseconds));
                    this.timers.add(handle);
                    return handle;
                }
                cancel(handle) {
                    if (handle === null || handle === undefined)
                        return;
                    (this.environment.clearTimeout || globalThis.clearTimeout).call(this.environment, handle);
                    this.timers.delete(handle);
                }
                waitForMedia(pending, label, onCancel) {
                    return new Promise((resolve, reject) => {
                        let settled = false, timer = null;
                        const finish = (error, value) => {
                            if (settled)
                                return;
                            settled = true;
                            this.mediaWaiters.delete(cancel);
                            this.cancel(timer);
                            if (error)
                                reject(error);
                            else
                                resolve(value);
                        };
                        const cancel = () => { onCancel?.(); finish(new Error(`${label}已取消。`)); };
                        this.mediaWaiters.add(cancel);
                        timer = this.schedule(() => { onCancel?.(); finish(new Error(`${label}超时，游戏仍可继续。`)); }, this.loadTimeoutMs);
                        pending.then(value => finish(null, value), error => finish(error));
                        if (this.disposed)
                            cancel();
                    });
                }
                canPlayMusic() { return !this.disposed && this.unlocked && this.musicWanted && this.pauseReasons.size === 0; }
                init() {
                    if (this.disposed)
                        return false;
                    if (this.mode !== 'uninitialized')
                        return this.mode !== 'unavailable';
                    if (typeof this.wx?.createInnerAudioContext === 'function') {
                        this.mode = 'wechat-inner';
                        return true;
                    }
                    try {
                        const Context = this.environment.AudioContext ?? this.environment.webkitAudioContext;
                        this.context = Context ? new Context({ latencyHint: 'interactive' }) : this.wx?.createWebAudioContext?.();
                        if (!this.context?.createGain || !this.context?.createBufferSource)
                            throw new Error('当前环境没有可用音频后端。');
                        this.masterGain = this.context.createGain();
                        this.musicGain = this.context.createGain();
                        this.sfxGain = this.context.createGain();
                        this.musicGain.connect(this.masterGain);
                        this.sfxGain.connect(this.masterGain);
                        if (this.context.createDynamicsCompressor) {
                            this.compressor = this.context.createDynamicsCompressor();
                            for (const [name, value] of Object.entries({ threshold: -10, knee: 9, ratio: 4, attack: .004, release: .12 }))
                                if (this.compressor[name])
                                    this.compressor[name].value = value;
                            this.masterGain.connect(this.compressor);
                            this.compressor.connect(this.context.destination);
                        }
                        else
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
                musicUrl(scene) {
                    const url = this.musicUrls[scene];
                    if (typeof url === 'string' && url.trim())
                        return url;
                    if (this.allowFallback && this.mode === 'wechat-inner')
                        return this.fallbackUrl('music');
                    if (!this.allowFallback)
                        this.warn(`缺少正式音乐文件：${scene}。不会自动播放旧合成循环。`, `music-missing-${scene}`);
                    return null;
                }
                resolveSceneUrl(scene) {
                    const known = this.musicUrls[scene];
                    if (typeof known === 'string' && known.trim())
                        return Promise.resolve(known);
                    if (!this.resolveMusicUrl)
                        return Promise.resolve(this.musicUrl(scene));
                    if (this.musicFailures.has(scene) || this.disposed)
                        return Promise.resolve(null);
                    const pending = this.musicUrlLoads.get(scene);
                    if (pending)
                        return pending;
                    const life = this.life;
                    const request = this.waitForMedia(Promise.resolve().then(() => this.resolveMusicUrl(scene)), `音乐 ${scene} 分包加载`).then(url => {
                        if (this.disposed || life !== this.life)
                            return null;
                        if (typeof url !== 'string' || !url.trim())
                            throw new Error(`音乐 ${scene} 分包没有可用文件。`);
                        this.musicUrls[scene] = url;
                        return url;
                    }).catch(error => {
                        if (!this.disposed) {
                            this.musicFailures.add(scene);
                            this.warn(error, `music-bundle-${scene}`);
                        }
                        return this.allowFallback && this.mode === 'wechat-inner' && !this.disposed ? this.fallbackUrl('music') : null;
                    });
                    this.musicUrlLoads.set(scene, request);
                    const clear = () => { if (this.musicUrlLoads.get(scene) === request)
                        this.musicUrlLoads.delete(scene); };
                    void request.then(clear, clear);
                    return request;
                }
                cueUrls(cue) {
                    const canonical = canonicalCue(cue);
                    return this.soundUrls[cue]?.length ? this.soundUrls[cue] : this.soundUrls[canonical]?.length ? this.soundUrls[canonical]
                        : canonical === 'stone_hit' ? this.soundUrls.impact || [] : canonical === 'wood_break' ? this.soundUrls.break || [] : [];
                }
                fallbackBuffer(cue) {
                    if (!this.allowFallback)
                        return null;
                    let buffer = this.fallbackBuffers.get(cue);
                    if (!buffer) {
                        const synthesized = cachedCue(cue);
                        buffer = this.context.createBuffer(1, synthesized.samples.length, synthesized.sampleRate);
                        if (buffer.copyToChannel)
                            buffer.copyToChannel(synthesized.samples, 0);
                        else
                            buffer.getChannelData(0).set(synthesized.samples);
                        this.fallbackBuffers.set(cue, buffer);
                    }
                    return buffer;
                }
                fallbackUrl(cue) {
                    if (!this.allowFallback)
                        return null;
                    const cached = this.fallbackUrls.get(cue);
                    if (cached)
                        return cached;
                    try {
                        if (!this.wx?.getFileSystemManager || !this.wx?.env?.USER_DATA_PATH)
                            throw new Error('明确启用的合成备用音频没有可写目录。');
                        const file = `${this.wx.env.USER_DATA_PATH}/monster-den-explicit-fallback-${AUDIO_VERSION}-${cue}.wav`;
                        const fs = this.wx.getFileSystemManager();
                        let exists = false;
                        try {
                            fs.accessSync(file);
                            exists = true;
                        }
                        catch { /* Optional development cache. */ }
                        if (!exists)
                            fs.writeFileSync(file, encodeWav(cachedCue(cue)));
                        this.fallbackUrls.set(cue, file);
                        return file;
                    }
                    catch (error) {
                        this.warn(error);
                        return null;
                    }
                }
                async decodeUrl(url) {
                    const life = this.life;
                    const Abort = this.environment.AbortController;
                    const abort = Abort ? new Abort() : null;
                    let cancelled = false;
                    if (abort)
                        this.aborts.add(abort);
                    try {
                        const buffer = await this.waitForMedia((async () => {
                            if (typeof this.environment.fetch !== 'function')
                                throw new Error('当前 WebAudio 环境不支持文件读取。');
                            const response = await this.environment.fetch(url, abort ? { signal: abort.signal } : undefined);
                            if (cancelled || this.disposed || life !== this.life)
                                return null;
                            if (!response.ok)
                                throw new Error(`HTTP ${response.status ?? 'error'}`);
                            const bytes = await response.arrayBuffer();
                            if (cancelled || this.disposed || life !== this.life)
                                return null;
                            return new Promise((resolve, reject) => {
                                let settled = false;
                                const success = (value) => { if (!settled) {
                                    settled = true;
                                    resolve(value);
                                } };
                                const failure = (error) => { if (!settled) {
                                    settled = true;
                                    reject(error);
                                } };
                                try {
                                    const pending = this.context.decodeAudioData(bytes, success, failure);
                                    if (pending?.then)
                                        pending.then(success, failure);
                                }
                                catch (error) {
                                    failure(error);
                                }
                            });
                        })(), `音频文件 ${url} 加载或解码`, () => { cancelled = true; abort?.abort(); });
                        if (cancelled || this.disposed || life !== this.life)
                            return null;
                        if (!buffer || !(buffer.duration > 0 || buffer.length > 0))
                            throw new Error('解码结果为空。');
                        return buffer;
                    }
                    catch (error) {
                        if (!this.disposed)
                            this.warn(`文件加载或解码失败：${url}（${String(error?.message || error)}）`, `load-${url}`);
                        return null;
                    }
                    finally {
                        if (abort)
                            this.aborts.delete(abort);
                    }
                }
                loadSound(url) {
                    if (this.soundBuffers.has(url))
                        return Promise.resolve(this.soundBuffers.get(url));
                    const existing = this.soundLoads.get(url);
                    if (existing)
                        return existing;
                    const request = this.decodeUrl(url).then(buffer => { if (buffer && !this.disposed)
                        this.soundBuffers.set(url, buffer); return buffer; });
                    this.soundLoads.set(url, request);
                    return request;
                }
                wakeSlots() { for (const resolve of this.slotWaiters)
                    resolve(); this.slotWaiters.clear(); }
                pruneMusicCache() {
                    const keep = new Set([...this.musicVoices].filter(voice => voice.active).map(voice => voice.scene));
                    keep.add(this.scene);
                    if (this.prefetchScene)
                        keep.add(this.prefetchScene);
                    for (const scene of this.musicBuffers.keys())
                        if (!keep.has(scene))
                            this.musicBuffers.delete(scene);
                }
                async reserveMusicSlot(scene) {
                    while (!this.disposed && this.musicBuffers.size >= 2 && !this.musicBuffers.has(scene)) {
                        const protectedScenes = new Set([...this.musicVoices].filter(voice => voice.active).map(voice => voice.scene));
                        protectedScenes.add(this.scene);
                        const evict = [...this.musicBuffers.keys()].find(key => !protectedScenes.has(key));
                        if (evict !== undefined) {
                            this.musicBuffers.delete(evict);
                            break;
                        }
                        await new Promise(resolve => this.slotWaiters.add(resolve));
                    }
                    return !this.disposed;
                }
                loadMusic(scene) {
                    if (this.musicBuffers.has(scene))
                        return Promise.resolve(this.musicBuffers.get(scene));
                    if (this.musicFailures.has(scene))
                        return Promise.resolve(null);
                    const existing = this.musicLoads.get(scene);
                    if (existing)
                        return existing;
                    const request = this.musicQueue.then(async () => {
                        if (!(await this.reserveMusicSlot(scene)))
                            return null;
                        const url = await this.resolveSceneUrl(scene);
                        let buffer = url ? await this.decodeUrl(url) : null;
                        if (!buffer && this.allowFallback && !this.disposed)
                            buffer = this.fallbackBuffer('music');
                        if (buffer && !this.disposed) {
                            this.musicBuffers.set(scene, buffer);
                            this.pruneMusicCache();
                        }
                        else if (!this.disposed)
                            this.musicFailures.add(scene);
                        return buffer;
                    }).catch(error => {
                        if (!this.disposed) {
                            this.musicFailures.add(scene);
                            this.warn(`音乐 ${scene} 准备失败：${String(error?.message || error)}`, `music-prepare-${scene}`);
                        }
                        return null;
                    });
                    this.musicQueue = request.then(() => { }, () => { });
                    this.musicLoads.set(scene, request);
                    const clear = () => { if (this.musicLoads.get(scene) === request)
                        this.musicLoads.delete(scene); };
                    void request.then(clear, clear);
                    return request;
                }
                /** Predecode every short SFX, but only the initial music scene (long PCM is expensive). */
                prepare() {
                    if (this.preparation)
                        return this.preparation;
                    if (!this.init())
                        return Promise.resolve();
                    const life = this.life;
                    this.preparation = (async () => {
                        let expired = false;
                        const work = this.mode === 'wechat-inner' ? this.resolveSceneUrl(this.scene).then(() => { }) : (async () => {
                            const queue = [...new Set(Object.values(this.soundUrls).flatMap(value => value || []))];
                            const worker = async () => { while (queue.length && !this.disposed && !expired)
                                await this.loadSound(queue.shift()); };
                            await Promise.all([worker(), worker(), worker(), worker(), this.loadMusic(this.scene).then(() => { })]);
                        })();
                        try {
                            await this.waitForMedia(work, '首屏声音准备', () => { expired = true; });
                        }
                        catch (error) {
                            this.warn(error, 'audio-prepare-timeout');
                        }
                        if (!this.disposed && life === this.life) {
                            this.prepared = true;
                            void this.syncMusic();
                        }
                    })().catch(error => { this.warn(error); });
                    return this.preparation;
                }
                /** Explicitly prefetch the next score; at most two music PCM buffers are retained. */
                async preloadMusic(scene) {
                    if (!SCENES.includes(scene) || !this.init())
                        return;
                    this.prefetchScene = scene;
                    this.musicFailures.delete(scene);
                    if (this.mode === 'wechat-inner') {
                        await this.resolveSceneUrl(scene);
                        return;
                    }
                    await this.loadMusic(scene);
                }
                setMusicScene(scene) {
                    if (this.disposed || !SCENES.includes(scene))
                        return;
                    if (this.scene !== scene) {
                        this.scene = scene;
                        this.musicRevision++;
                        this.wakeSlots();
                    }
                    if (this.canPlayMusic())
                        void this.syncMusic();
                }
                /** Call from a deliberate user gesture; resume() is invoked before the first await. */
                async unlock() {
                    if (!this.init())
                        return false;
                    void this.prepare();
                    if (this.pauseReasons.size)
                        return false;
                    const life = this.life;
                    try {
                        if (this.mode === 'web-audio')
                            await this.context.resume?.();
                        if (this.disposed || life !== this.life)
                            return false;
                        this.unlocked = this.mode === 'wechat-inner' || this.context.state === 'running' || this.context.state === undefined;
                        if (this.pauseReasons.size) {
                            this.updateVolumes();
                            void this.context?.suspend?.()?.catch?.(() => { });
                            return false;
                        }
                        this.updateVolumes(.025);
                        if (this.unlocked && this.musicWanted)
                            void this.syncMusic();
                        return this.unlocked;
                    }
                    catch (error) {
                        this.warn(error);
                        return false;
                    }
                }
                setSettings(patch) {
                    const old = this.settingsValue;
                    this.settingsValue = { muted: typeof patch.muted === 'boolean' ? patch.muted : old.muted,
                        masterVolume: clamp(patch.masterVolume, old.masterVolume), musicVolume: clamp(patch.musicVolume, old.musicVolume),
                        sfxVolume: clamp(patch.sfxVolume, old.sfxVolume) };
                    this.updateVolumes();
                }
                setMuted(muted) { this.setSettings({ muted }); }
                ramp(parameter, value, seconds = 0) {
                    if (!parameter)
                        return;
                    const now = this.context?.currentTime || 0;
                    if (parameter.cancelScheduledValues)
                        parameter.cancelScheduledValues(now);
                    if (seconds > 0 && parameter.setValueAtTime && parameter.linearRampToValueAtTime) {
                        parameter.setValueAtTime(parameter.value, now);
                        parameter.linearRampToValueAtTime(value, now + seconds);
                    }
                    else
                        parameter.value = value;
                }
                audibleMaster() { return this.settingsValue.muted || this.pauseReasons.size || !this.unlocked ? 0 : this.settingsValue.masterVolume; }
                updateVolumes(seconds = 0) {
                    if (this.disposed)
                        return;
                    const master = this.audibleMaster();
                    this.ramp(this.masterGain?.gain, master, seconds);
                    this.ramp(this.musicGain?.gain, this.settingsValue.musicVolume * this.duckLevel, seconds);
                    this.ramp(this.sfxGain?.gain, this.settingsValue.sfxVolume, seconds);
                    for (const voice of this.musicVoices)
                        if (voice.audio)
                            voice.audio.volume = clamp(master * this.settingsValue.musicVolume * this.duckLevel * this.voiceLevel(voice), 0);
                    for (const voice of this.soundVoices)
                        if (voice.audio)
                            voice.audio.volume = clamp(master * this.settingsValue.sfxVolume * voice.intensity, 0);
                }
                startMusic(scene) {
                    if (this.disposed)
                        return;
                    if (scene)
                        this.setMusicScene(scene);
                    this.musicWanted = true;
                    if (this.canPlayMusic())
                        void this.syncMusic();
                }
                voiceClock() { return this.mode === 'web-audio' ? this.context.currentTime || 0 : this.now() / 1000; }
                voiceLevel(voice) {
                    const fade = voice.fade;
                    if (!fade)
                        return voice.level;
                    const t = Math.max(0, Math.min(1, (this.voiceClock() - fade.start) / fade.duration));
                    return fade.from + (fade.to - fade.from) * t;
                }
                holdFade(voice) {
                    voice.level = this.voiceLevel(voice);
                    if (voice.fade)
                        this.cancel(voice.fade.timer);
                    voice.fade = null;
                    if (voice.gain)
                        this.ramp(voice.gain.gain, voice.level);
                }
                fadeVoice(voice, to, duration, retire = false) {
                    this.holdFade(voice);
                    const fade = { from: voice.level, to, start: this.voiceClock(), duration: Math.max(.001, duration), timer: null };
                    voice.fade = fade;
                    if (voice.gain)
                        this.ramp(voice.gain.gain, to, duration);
                    const tick = () => {
                        if (!voice.active || voice.fade !== fade || this.disposed || this.pauseReasons.size)
                            return;
                        const remaining = fade.duration - (this.voiceClock() - fade.start);
                        if (voice.audio)
                            voice.audio.volume = clamp(this.audibleMaster() * this.settingsValue.musicVolume * this.duckLevel * this.voiceLevel(voice), 0);
                        if (remaining <= .001) {
                            voice.level = to;
                            voice.fade = null;
                            if (retire)
                                this.retireMusic(voice);
                        }
                        else
                            fade.timer = this.schedule(tick, voice.audio ? Math.min(25, remaining * 1000) : Math.max(10, remaining * 1000));
                    };
                    fade.timer = this.schedule(tick, voice.audio ? 25 : duration * 1000);
                }
                retireMusic(voice) {
                    if (!voice.active)
                        return;
                    this.holdFade(voice);
                    voice.active = false;
                    this.musicVoices.delete(voice);
                    if (this.currentMusic === voice)
                        this.currentMusic = null;
                    if (voice.source) {
                        voice.source.onended = null;
                        try {
                            voice.source.stop();
                        }
                        catch { /* Already ended. */ }
                        try {
                            voice.source.disconnect();
                            voice.gain?.disconnect();
                        }
                        catch { /* Already detached. */ }
                    }
                    if (voice.audio) {
                        this.detachNativeListeners(voice);
                        try {
                            voice.audio.stop();
                        }
                        catch { /* Backend already stopped. */ }
                        try {
                            voice.audio.destroy();
                        }
                        catch { /* Backend already released. */ }
                    }
                    voice.source = null;
                    voice.gain = null;
                    voice.audio = null;
                    this.pruneMusicCache();
                    this.wakeSlots();
                }
                detachNativeListeners(voice) {
                    try {
                        if (voice.ended)
                            voice.audio?.offEnded?.(voice.ended);
                    }
                    catch { /* A partially initialized native player may already be invalid. */ }
                    try {
                        if (voice.error)
                            voice.audio?.offError?.(voice.error);
                    }
                    catch { /* Still release the player after a failed native setup. */ }
                }
                nativePlay(audio, onFailure) {
                    try {
                        const pending = audio.play();
                        pending?.catch?.((error) => { if (!this.disposed)
                            onFailure(error); });
                        return true;
                    }
                    catch (error) {
                        onFailure(error);
                        return false;
                    }
                }
                musicFailed(voice, error) {
                    if (!voice.active || this.disposed)
                        return;
                    this.warn(`音乐 ${voice.scene} 播放失败：${String(error?.errMsg || error?.message || error)}`, `music-play-${voice.scene}`);
                    this.musicFailures.add(voice.scene);
                    const wasCurrent = this.currentMusic === voice;
                    this.retireMusic(voice);
                    if (wasCurrent) {
                        const previous = [...this.musicVoices].find(candidate => candidate.active);
                        if (previous) {
                            this.currentMusic = previous;
                            this.fadeVoice(previous, 1, .2);
                        }
                    }
                }
                async syncMusic() {
                    if (!this.canPlayMusic() || !this.init())
                        return;
                    const scene = this.scene, revision = this.musicRevision, life = this.life;
                    const playing = this.currentMusic;
                    // Resume the retained score immediately, even if a different requested scene
                    // is still downloading or failed. A failed transition must not strand it paused.
                    if (playing?.active && playing.paused) {
                        playing.paused = false;
                        if (playing.audio) {
                            if (playing.atEnd)
                                playing.audio.seek?.(0);
                            playing.atEnd = false;
                            this.nativePlay(playing.audio, error => this.musicFailed(playing, error));
                        }
                        if (playing.active)
                            this.fadeVoice(playing, 1, .2);
                    }
                    if (this.currentMusic?.active && this.currentMusic.scene === scene)
                        return;
                    if (this.musicFailures.has(scene))
                        return;
                    const resource = this.mode === 'wechat-inner' ? await this.resolveSceneUrl(scene) : await this.loadMusic(scene);
                    if (!resource || !this.canPlayMusic() || life !== this.life || revision !== this.musicRevision || this.scene !== scene)
                        return;
                    if (this.currentMusic?.active && this.currentMusic.scene === scene)
                        return;
                    // A rapid third scene change never leaves three music voices alive.
                    for (const old of [...this.musicVoices])
                        if (old !== this.currentMusic)
                            this.retireMusic(old);
                    const previous = this.currentMusic;
                    const voice = { scene, source: null, gain: null, audio: null, active: true,
                        paused: false, atEnd: false, level: 0, fade: null, ended: null, error: null };
                    this.musicVoices.add(voice);
                    try {
                        if (this.mode === 'wechat-inner') {
                            const audio = this.wx.createInnerAudioContext();
                            voice.audio = audio;
                            audio.src = resource;
                            audio.loop = true;
                            audio.autoplay = false;
                            audio.volume = 0;
                            voice.error = error => this.musicFailed(voice, error);
                            voice.ended = () => {
                                if (!voice.active || this.disposed)
                                    return;
                                voice.atEnd = true;
                                if (voice !== this.currentMusic) {
                                    this.retireMusic(voice);
                                    return;
                                }
                                if (this.canPlayMusic()) {
                                    audio.seek?.(0);
                                    voice.atEnd = false;
                                    this.nativePlay(audio, error => this.musicFailed(voice, error));
                                }
                            };
                            audio.onError?.(voice.error);
                            audio.onEnded?.(voice.ended);
                            if (!this.nativePlay(audio, error => this.musicFailed(voice, error)))
                                return;
                            if (!voice.active)
                                return;
                        }
                        else {
                            const source = this.context.createBufferSource(), gain = this.context.createGain();
                            voice.source = source;
                            voice.gain = gain;
                            source.buffer = resource;
                            source.loop = true;
                            gain.gain.value = 0;
                            source.connect(gain);
                            gain.connect(this.musicGain);
                            voice.ended = () => {
                                if (!voice.active || this.disposed)
                                    return;
                                const wasCurrent = voice === this.currentMusic;
                                this.retireMusic(voice);
                                if (wasCurrent && this.canPlayMusic())
                                    void this.syncMusic();
                            };
                            source.onended = voice.ended;
                            source.start();
                        }
                        this.currentMusic = voice;
                        if (previous?.active) {
                            if (previous.paused && previous.audio) {
                                previous.paused = false;
                                this.nativePlay(previous.audio, error => this.musicFailed(previous, error));
                            }
                            this.fadeVoice(previous, 0, this.crossfade, true);
                        }
                        this.fadeVoice(voice, 1, this.crossfade);
                    }
                    catch (error) {
                        this.musicFailed(voice, error);
                    }
                }
                stopMusic() {
                    this.musicWanted = false;
                    this.musicRevision++;
                    for (const voice of [...this.musicVoices])
                        this.retireMusic(voice);
                    this.currentMusic = null;
                    this.wakeSlots();
                }
                retireSound(voice, stop = true) {
                    if (!voice.active)
                        return;
                    voice.active = false;
                    this.soundVoices.delete(voice);
                    if (voice.source) {
                        voice.source.onended = null;
                        if (stop) {
                            try {
                                voice.source.stop();
                            }
                            catch { /* Already ended. */ }
                        }
                        try {
                            voice.source.disconnect();
                            voice.gain?.disconnect();
                        }
                        catch { /* Already detached. */ }
                        voice.source = null;
                        voice.gain = null;
                    }
                    if (voice.audio) {
                        this.detachNativeListeners(voice);
                        if (stop) {
                            try {
                                voice.audio.stop();
                            }
                            catch { /* Already ended. */ }
                        }
                    }
                }
                changeDuck(to, seconds) {
                    this.cancel(this.duckFadeTimer);
                    this.duckFadeTimer = null;
                    const from = this.duckLevel, start = this.now();
                    this.duckLevel = to;
                    if (this.musicGain)
                        this.ramp(this.musicGain.gain, this.settingsValue.musicVolume * to, seconds);
                    if (this.mode !== 'wechat-inner')
                        return;
                    this.duckLevel = from;
                    const step = () => {
                        if (this.disposed || this.pauseReasons.size)
                            return;
                        const t = Math.min(1, (this.now() - start) / Math.max(1, seconds * 1000));
                        this.duckLevel = from + (to - from) * t;
                        this.updateVolumes();
                        if (t < 1)
                            this.duckFadeTimer = this.schedule(step, 25);
                        else
                            this.duckFadeTimer = null;
                    };
                    step();
                }
                duck(cue) {
                    if (!IMPORTANT.has(cue) || !this.musicWanted)
                        return;
                    const settlement = cue === 'win' || cue === 'lose';
                    const hold = cue === 'win' ? 4600 : cue === 'lose' ? 2600 : 240;
                    this.duckUntil = Math.max(this.duckUntil, this.now() + hold);
                    this.duckTarget = Math.min(this.duckTarget, settlement ? .42 : .76);
                    this.cancel(this.duckTimer);
                    this.changeDuck(this.duckTarget, .04);
                    this.duckTimer = this.schedule(() => {
                        this.duckTimer = null;
                        this.duckUntil = 0;
                        this.duckTarget = 1;
                        this.changeDuck(1, .24);
                    }, this.duckUntil - this.now());
                }
                play(cue, intensity = 1) {
                    if (!this.unlocked || this.disposed || this.pauseReasons.size || this.settingsValue.muted || !Object.prototype.hasOwnProperty.call(PRIORITY, canonicalCue(cue)))
                        return false;
                    const canonical = canonicalCue(cue), now = this.now();
                    if (now - (this.lastPlayed.get(canonical) ?? -Infinity) < MIN_INTERVAL[canonical])
                        return false;
                    const choices = this.cueUrls(cue).filter(url => this.mode === 'wechat-inner' || this.soundBuffers.has(url));
                    let index = Math.min(choices.length - 1, Math.floor(clamp(this.random(), 0) * choices.length));
                    if (choices.length > 1 && index === this.lastVariant.get(canonical))
                        index = (index + 1) % choices.length;
                    let resource = choices.length ? this.mode === 'wechat-inner' ? choices[index] : this.soundBuffers.get(choices[index]) : null;
                    if (!resource && this.allowFallback)
                        resource = this.mode === 'wechat-inner' ? this.fallbackUrl(canonical) : this.fallbackBuffer(canonical);
                    if (!resource) {
                        if (this.prepared)
                            this.warn(`音效尚未就绪或未配置：${canonical}。`, `cue-${canonical}`);
                        return false;
                    }
                    if (this.soundVoices.size >= this.maxSounds) {
                        const victim = [...this.soundVoices].sort((a, b) => a.priority - b.priority || a.started - b.started)[0];
                        if (victim.priority > PRIORITY[canonical])
                            return false;
                        this.retireSound(victim);
                    }
                    const gain = clamp(intensity, 1) * (.96 + .04 * clamp(this.random(), .5));
                    const tonal = canonical === 'win' || canonical === 'lose' || canonical === 'loot' || canonical === 'tool' || canonical === 'click';
                    const rate = tonal ? 1 : .975 + .05 * clamp(this.random(), .5);
                    let voice;
                    try {
                        if (this.mode === 'wechat-inner') {
                            voice = this.innerSoundPool.find(candidate => !candidate.active);
                            if (!voice) {
                                voice = { source: null, gain: null, audio: this.wx.createInnerAudioContext(), active: false,
                                    sequence: 0, cue: canonical, intensity: gain, priority: PRIORITY[canonical], started: now, ended: null, error: null };
                                this.innerSoundPool.push(voice);
                            }
                        }
                        else
                            voice = { source: this.context.createBufferSource(), gain: this.context.createGain(), audio: null,
                                active: false, sequence: 0, cue: canonical, intensity: gain, priority: PRIORITY[canonical], started: now, ended: null, error: null };
                        voice.active = true;
                        voice.sequence++;
                        voice.cue = canonical;
                        voice.intensity = gain;
                        voice.priority = PRIORITY[canonical];
                        voice.started = now;
                        const current = voice, sequence = voice.sequence;
                        current.ended = () => { if (current.active && current.sequence === sequence)
                            this.retireSound(current, false); };
                        current.error = error => { if (current.active && current.sequence === sequence && !this.disposed) {
                            this.warn(`音效 ${canonical} 播放失败：${String(error?.errMsg || error?.message || error)}`);
                            this.retireSound(current);
                        } };
                        this.soundVoices.add(current);
                        if (current.audio) {
                            const audio = current.audio;
                            audio.src = resource;
                            audio.loop = false;
                            audio.autoplay = false;
                            audio.volume = this.audibleMaster() * this.settingsValue.sfxVolume * gain;
                            if ('playbackRate' in audio)
                                audio.playbackRate = rate;
                            audio.onEnded?.(current.ended);
                            audio.onError?.(current.error);
                            if (!this.nativePlay(audio, current.error))
                                return false;
                            if (!current.active)
                                return false;
                        }
                        else {
                            current.source.buffer = resource;
                            current.source.loop = false;
                            if (current.source.playbackRate)
                                current.source.playbackRate.value = rate;
                            current.gain.gain.value = gain;
                            current.source.connect(current.gain);
                            current.gain.connect(this.sfxGain);
                            current.source.onended = current.ended;
                            current.source.start();
                        }
                        this.lastPlayed.set(canonical, now);
                        this.lastVariant.set(canonical, index);
                        this.duck(canonical);
                        return true;
                    }
                    catch (error) {
                        if (voice)
                            this.retireSound(voice);
                        this.warn(error);
                        return false;
                    }
                }
                /** Independent reasons stack; ending an ad must not override visibility or interruption. */
                pause(reason = 'manual') {
                    if (this.disposed)
                        return;
                    this.pauseReasons.add(reason);
                    this.transportRevision++;
                    this.cancel(this.duckTimer);
                    this.cancel(this.duckFadeTimer);
                    this.duckTimer = this.duckFadeTimer = null;
                    this.duckLevel = this.duckTarget = 1;
                    this.duckUntil = 0;
                    for (const voice of [...this.musicVoices]) {
                        if (voice !== this.currentMusic) {
                            this.retireMusic(voice);
                            continue;
                        }
                        this.holdFade(voice);
                        voice.paused = true;
                        try {
                            voice.audio?.pause();
                        }
                        catch (error) {
                            this.warn(error);
                        }
                    }
                    for (const voice of [...this.soundVoices])
                        this.retireSound(voice);
                    this.updateVolumes();
                    try {
                        this.context?.suspend?.()?.catch?.((error) => this.warn(error));
                    }
                    catch (error) {
                        this.warn(error);
                    }
                }
                async resume(reason = 'manual') {
                    this.pauseReasons.delete(reason);
                    if (this.disposed || this.pauseReasons.size || !this.unlocked)
                        return false;
                    const transport = ++this.transportRevision, life = this.life;
                    try {
                        if (this.mode === 'web-audio')
                            await this.context.resume?.();
                        if (this.disposed || life !== this.life || transport !== this.transportRevision || this.pauseReasons.size)
                            return false;
                        this.updateVolumes(.025);
                        if (this.musicWanted)
                            void this.syncMusic();
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
                    this.life++;
                    this.transportRevision++;
                    this.unlocked = false;
                    for (const cancel of [...this.mediaWaiters])
                        cancel();
                    this.stopMusic();
                    for (const voice of [...this.soundVoices])
                        this.retireSound(voice);
                    for (const voice of this.innerSoundPool) {
                        try {
                            voice.audio.destroy();
                        }
                        catch { /* Already released. */ }
                    }
                    this.innerSoundPool = [];
                    for (const timer of [...this.timers])
                        this.cancel(timer);
                    for (const abort of this.aborts) {
                        try {
                            abort.abort();
                        }
                        catch { /* Request already completed. */ }
                    }
                    this.aborts.clear();
                    this.wakeSlots();
                    try {
                        this.masterGain?.disconnect();
                        this.musicGain?.disconnect();
                        this.sfxGain?.disconnect();
                        this.compressor?.disconnect();
                    }
                    catch { /* Already detached. */ }
                    try {
                        this.context?.close?.()?.catch?.(() => { });
                    }
                    catch { /* Already closed. */ }
                    this.wx?.offHide?.(this.onHide);
                    this.wx?.offShow?.(this.onShow);
                    this.wx?.offAudioInterruptionBegin?.(this.onInterruptionBegin);
                    this.wx?.offAudioInterruptionEnd?.(this.onInterruptionEnd);
                    this.environment.document?.removeEventListener?.('visibilitychange', this.onVisibility);
                    this.soundBuffers.clear();
                    this.soundLoads.clear();
                    this.musicBuffers.clear();
                    this.musicLoads.clear();
                    this.musicFailures.clear();
                    this.musicUrlLoads.clear();
                    this.fallbackBuffers.clear();
                    this.fallbackUrls.clear();
                }
            };
            exports_1("GameAudio", GameAudio);
        }
    };
});

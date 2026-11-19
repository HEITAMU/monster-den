System.register([], function (exports_1, context_1) {
    "use strict";
    var SAVE_SCHEMA_VERSION, SAVE_KEY, SAVE_BACKUP_KEY, UNLOCKABLE_TOOL_IDS, SaveStore;
    var __moduleName = context_1 && context_1.id;
    function message(error) {
        return error instanceof Error ? error.message : String(error);
    }
    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }
    function finiteUnit(value, fallback) {
        return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
    }
    function identifier(environment = globalThis) {
        try {
            if (environment.crypto?.randomUUID)
                return environment.crypto.randomUUID();
        }
        catch { /* A local save identifier is not an authentication token. */ }
        return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    }
    function validPlacement(value) {
        return value === 'rescue' || value === 'settlement_bonus' || value === 'tool_trial';
    }
    /** Additive schema-1 migration: only absent fields receive defaults, never malformed values. */
    function withLegacyDefaults(value) {
        if (value?.schemaVersion !== SAVE_SCHEMA_VERSION || !value.progress || typeof value.progress !== 'object' || Array.isArray(value.progress))
            return value;
        if (!Object.prototype.hasOwnProperty.call(value.progress, 'coins'))
            value.progress.coins = 0;
        if (!Object.prototype.hasOwnProperty.call(value.progress, 'startingTool'))
            value.progress.startingTool = 'none';
        return value;
    }
    function validDocument(value) {
        if (!value || value.schemaVersion !== 1 || typeof value.playerId !== 'string' || !value.playerId)
            return false;
        if (!Number.isFinite(value.updatedAt) || !value.settings || !value.progress)
            return false;
        const s = value.settings;
        if (typeof s.muted !== 'boolean' || typeof s.vibration !== 'boolean')
            return false;
        if (!['masterVolume', 'musicVolume', 'sfxVolume'].every(k => Number.isFinite(s[k]) && s[k] >= 0 && s[k] <= 1))
            return false;
        const p = value.progress;
        if (typeof p !== 'object' || Array.isArray(p))
            return false;
        if (!['runsPlayed', 'runsCompleted', 'bestLoot', 'roomsCleared'].every(k => Number.isFinite(p[k]) && p[k] >= 0))
            return false;
        if (![p.unlockedTools, p.collectedTreasures].every(a => Array.isArray(a) && a.every(v => typeof v === 'string')))
            return false;
        if (!Number.isSafeInteger(p.coins) || p.coins < 0)
            return false;
        if (!p.unlockedTools.every((tool) => UNLOCKABLE_TOOL_IDS.includes(tool)) ||
            new Set(p.unlockedTools).size !== p.unlockedTools.length)
            return false;
        if (p.startingTool !== 'none' && (!UNLOCKABLE_TOOL_IDS.includes(p.startingTool) ||
            !p.unlockedTools.includes(p.startingTool)))
            return false;
        if (value.snapshot !== null && (!value.snapshot || typeof value.snapshot.runId !== 'string' || !value.snapshot.runId ||
            !Number.isFinite(value.snapshot.savedAt) || !Object.prototype.hasOwnProperty.call(value.snapshot, 'state')))
            return false;
        if (!Array.isArray(value.rewardReceipts))
            return false;
        const ids = new Set();
        const claims = new Set();
        for (const receipt of value.rewardReceipts) {
            if (!receipt || typeof receipt.id !== 'string' || !receipt.id || typeof receipt.runId !== 'string' || !receipt.runId ||
                !validPlacement(receipt.placement) || !['wechat', 'test'].includes(receipt.source) ||
                !['pending', 'applied'].includes(receipt.status) || !Number.isFinite(receipt.createdAt))
                return false;
            if (receipt.status === 'applied' && !Number.isFinite(receipt.appliedAt))
                return false;
            const key = `${receipt.runId}\u0000${receipt.placement}`;
            if (ids.has(receipt.id) || claims.has(key))
                return false;
            ids.add(receipt.id);
            claims.add(key);
        }
        return true;
    }
    function serializable(value) {
        const visit = (v, stack) => {
            if (v === null || typeof v === 'string' || typeof v === 'boolean')
                return;
            if (typeof v === 'number' && Number.isFinite(v))
                return;
            if (typeof v !== 'object' || Object.getPrototypeOf(v) !== Object.prototype && !Array.isArray(v)) {
                throw new Error('存档只接受 JSON 数据，不能包含 undefined、非有限数值或类实例。');
            }
            if (stack.has(v))
                throw new Error('存档包含循环引用。');
            stack.add(v);
            for (const child of Object.values(v))
                visit(child, stack);
            stack.delete(v);
        };
        visit(value, new Set());
    }
    function createMemoryStorage() {
        const values = new Map();
        return {
            kind: 'memory', persistent: false,
            getItem: key => values.get(key) ?? null,
            setItem: (key, value) => { values.set(key, value); },
            removeItem: key => { values.delete(key); },
        };
    }
    exports_1("createMemoryStorage", createMemoryStorage);
    /** Uses only this game's namespaced keys; never calls localStorage.clear or wx.clearStorageSync. */
    function createStorageAdapter(environment = globalThis) {
        const wx = environment.wx;
        if (wx?.getStorageSync && wx?.setStorageSync && wx?.removeStorageSync) {
            return {
                kind: 'wechat', persistent: true,
                getItem(key) {
                    const value = wx.getStorageSync(key);
                    if (value === undefined || value === null || value === '')
                        return null;
                    return typeof value === 'string' ? value : JSON.stringify(value);
                },
                setItem: (key, value) => wx.setStorageSync(key, value),
                removeItem: key => wx.removeStorageSync(key),
            };
        }
        try {
            const storage = environment.localStorage;
            if (storage?.getItem && storage?.setItem && storage?.removeItem) {
                return {
                    kind: 'web', persistent: true,
                    getItem: key => storage.getItem(key),
                    setItem: (key, value) => storage.setItem(key, value),
                    removeItem: key => storage.removeItem(key),
                };
            }
        }
        catch { /* Browser privacy modes can throw when accessing localStorage itself. */ }
        return createMemoryStorage();
    }
    exports_1("createStorageAdapter", createStorageAdapter);
    return {
        setters: [],
        execute: function () {
            /** Local-only saves. This module deliberately has no Cocos or DOM dependency. */
            exports_1("SAVE_SCHEMA_VERSION", SAVE_SCHEMA_VERSION = 1);
            exports_1("SAVE_KEY", SAVE_KEY = 'monster-den.save.v1');
            exports_1("SAVE_BACKUP_KEY", SAVE_BACKUP_KEY = `${SAVE_KEY}.backup`);
            /** Keep this registry in sync with the concrete tools offered by core/rooms.ts. */
            exports_1("UNLOCKABLE_TOOL_IDS", UNLOCKABLE_TOOL_IDS = ['heavy', 'grip', 'return']);
            SaveStore = class SaveStore {
                constructor(options = {}) {
                    this.lastError = null;
                    this.recoveredFromBackup = false;
                    this.readOnly = false;
                    this.environment = options.environment ?? globalThis;
                    this.storage = options.storage ?? createStorageAdapter(this.environment);
                    this.persistent = this.storage.persistent;
                    this.now = options.now ?? Date.now;
                    this.onWarning = options.onWarning ?? (() => { });
                    this.data = this.fresh();
                    this.refresh();
                    if (!this.persistent)
                        this.warn('当前环境没有持久化存储，离开页面后进度可能丢失。');
                }
                fresh() {
                    return {
                        schemaVersion: 1,
                        playerId: identifier(this.environment),
                        updatedAt: this.now(),
                        settings: { muted: false, masterVolume: 0.8, musicVolume: 0.42, sfxVolume: 0.85, vibration: true },
                        progress: { runsPlayed: 0, runsCompleted: 0, bestLoot: 0, roomsCleared: 0, unlockedTools: [], collectedTreasures: [], coins: 0, startingTool: 'none' },
                        snapshot: null,
                        rewardReceipts: [],
                    };
                }
                warn(text) {
                    this.lastError = text;
                    this.onWarning(text);
                }
                refresh() {
                    let raw;
                    try {
                        raw = this.storage.getItem(SAVE_KEY);
                    }
                    catch (error) {
                        this.warn(`无法读取本机存档：${message(error)}`);
                        return;
                    }
                    if (!raw)
                        return;
                    try {
                        const parsed = JSON.parse(raw);
                        if (typeof parsed?.schemaVersion === 'number' && parsed.schemaVersion > SAVE_SCHEMA_VERSION) {
                            this.readOnly = true;
                            this.warn('存档来自更新版本，当前版本不会覆盖它。');
                            return;
                        }
                        if (validDocument(withLegacyDefaults(parsed))) {
                            this.data = parsed;
                            return;
                        }
                    }
                    catch { /* Try the last known valid backup without overwriting the broken main save. */ }
                    try {
                        const backupRaw = this.storage.getItem(SAVE_BACKUP_KEY);
                        const backup = backupRaw ? withLegacyDefaults(JSON.parse(backupRaw)) : null;
                        if (validDocument(backup)) {
                            this.data = backup;
                            this.recoveredFromBackup = true;
                            this.warn('主存档损坏，已读取上一次有效备份。');
                            return;
                        }
                    }
                    catch { /* The caller receives an explicit warning below. */ }
                    this.warn('本机存档无法解析；原数据仍保留，尚未被覆盖。');
                }
                read() { this.refresh(); return clone(this.data); }
                getSnapshot() {
                    this.refresh();
                    return this.data.snapshot ? clone(this.data.snapshot) : null;
                }
                /** Mutation and receipt settlement are saved in one main-key write. */
                update(mutator) {
                    this.refresh();
                    if (this.readOnly)
                        return { ok: false, error: this.lastError ?? '存档为只读。' };
                    const draft = clone(this.data);
                    try {
                        mutator(draft);
                        draft.updatedAt = this.now();
                        serializable(draft);
                        if (!validDocument(draft))
                            throw new Error('存档字段无效。');
                        const serialized = JSON.stringify(draft);
                        if (serialized.length > 512 * 1024)
                            throw new Error('存档超过本游戏的 512 KiB 文本预算。');
                        let previous = null;
                        try {
                            previous = this.storage.getItem(SAVE_KEY);
                        }
                        catch { /* A write may still succeed. */ }
                        if (previous) {
                            try {
                                if (validDocument(withLegacyDefaults(JSON.parse(previous))))
                                    this.storage.setItem(SAVE_BACKUP_KEY, previous);
                            }
                            catch { /* A backup failure must not convert a failed main write into a successful one. */ }
                        }
                        this.storage.setItem(SAVE_KEY, serialized);
                        this.data = draft;
                        this.lastError = null;
                        return { ok: true };
                    }
                    catch (error) {
                        const errorMessage = `保存失败：${message(error)}`;
                        this.warn(errorMessage);
                        return { ok: false, error: errorMessage };
                    }
                }
                saveSnapshot(runId, state) {
                    if (!runId || typeof runId !== 'string')
                        return { ok: false, error: '缺少有效 runId。' };
                    try {
                        serializable(state);
                    }
                    catch (error) {
                        return { ok: false, error: message(error) };
                    }
                    return this.update(draft => { draft.snapshot = { runId, savedAt: this.now(), state: clone(state) }; });
                }
                clearSnapshot() { return this.update(draft => { draft.snapshot = null; }); }
                updateSettings(patch) {
                    return this.update(draft => {
                        const old = draft.settings;
                        draft.settings = {
                            muted: typeof patch.muted === 'boolean' ? patch.muted : old.muted,
                            vibration: typeof patch.vibration === 'boolean' ? patch.vibration : old.vibration,
                            masterVolume: finiteUnit(patch.masterVolume, old.masterVolume),
                            musicVolume: finiteUnit(patch.musicVolume, old.musicVolume),
                            sfxVolume: finiteUnit(patch.sfxVolume, old.sfxVolume),
                        };
                    });
                }
                getReward(runId, placement) {
                    this.refresh();
                    const receipt = this.data.rewardReceipts.find(r => r.runId === runId && r.placement === placement);
                    return receipt ? clone(receipt) : null;
                }
                /** Persist evidence of completed viewing before returning a reward to game code. */
                createPendingReward(input) {
                    this.refresh();
                    const existing = this.getReward(input.runId, input.placement);
                    if (existing)
                        return { ok: true, receipt: existing, duplicate: true };
                    const receipt = { ...input, status: 'pending', createdAt: this.now() };
                    const result = this.update(draft => {
                        if (draft.rewardReceipts.some(r => r.runId === input.runId && r.placement === input.placement))
                            throw new Error('此局奖励已记录。');
                        draft.rewardReceipts.push(receipt);
                        // Keep pending and current-run receipts; compact only old applied history.
                        if (draft.rewardReceipts.length > 128) {
                            const protectedEntries = draft.rewardReceipts.filter(r => r.status === 'pending' || r.runId === draft.snapshot?.runId);
                            const oldApplied = draft.rewardReceipts.filter(r => r.status === 'applied' && r.runId !== draft.snapshot?.runId);
                            const keepOld = Math.max(0, 128 - protectedEntries.length);
                            draft.rewardReceipts = [...(keepOld ? oldApplied.slice(-keepOld) : []), ...protectedEntries];
                        }
                    });
                    return result.ok ? { ok: true, receipt: clone(receipt), duplicate: false } : result;
                }
                pendingRewards(runId) {
                    this.refresh();
                    return clone(this.data.rewardReceipts.filter(r => r.status === 'pending' && (!runId || r.runId === runId)));
                }
                /** Commit gameplay state and mark the receipt applied together; safe to call again on reload. */
                applyReward(receiptId, apply) {
                    this.refresh();
                    const receipt = this.data.rewardReceipts.find(r => r.id === receiptId);
                    if (!receipt)
                        return { ok: false, error: '未找到已完成观看的奖励凭证。' };
                    if (receipt.status === 'applied')
                        return { ok: true, alreadyApplied: true };
                    const result = this.update(draft => {
                        const pending = draft.rewardReceipts.find(r => r.id === receiptId);
                        if (!pending || pending.status !== 'pending')
                            throw new Error('奖励状态已改变。');
                        apply(draft, clone(pending));
                        const savedReceipt = draft.rewardReceipts.find(r => r.id === receiptId);
                        if (!savedReceipt)
                            throw new Error('奖励回调不能移除凭证。');
                        savedReceipt.status = 'applied';
                        savedReceipt.appliedAt = this.now();
                        if (draft.snapshot)
                            draft.snapshot.savedAt = this.now();
                    });
                    return result;
                }
                applyRewardToSnapshot(receiptId, apply) {
                    return this.applyReward(receiptId, (draft, receipt) => {
                        if (!draft.snapshot || draft.snapshot.runId !== receipt.runId)
                            throw new Error('此奖励不属于当前存档中的一局。');
                        draft.snapshot.state = apply(clone(draft.snapshot.state), receipt);
                    });
                }
                /** The UI must obtain the player's deliberate reset action before calling this. */
                clear() {
                    try {
                        this.storage.removeItem(SAVE_KEY);
                        this.storage.removeItem(SAVE_BACKUP_KEY);
                        this.data = this.fresh();
                        this.readOnly = false;
                        this.lastError = null;
                        this.recoveredFromBackup = false;
                        return { ok: true };
                    }
                    catch (error) {
                        const errorMessage = `清除本游戏存档失败：${message(error)}`;
                        this.warn(errorMessage);
                        return { ok: false, error: errorMessage };
                    }
                }
            };
            exports_1("SaveStore", SaveStore);
        }
    };
});

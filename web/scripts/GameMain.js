System.register(["cc", "./core/index", "./platform/SaveStore", "./platform/RewardedAds", "./platform/GameAudio", "./AudioCatalog", "./ModelLibrary", "./GameUI"], function (exports_1, context_1) {
    "use strict";
    var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
        var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
        if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
        else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
        return c > 3 && r && Object.defineProperty(target, key, r), r;
    };
    var cc_1, index_1, SaveStore_1, RewardedAds_1, GameAudio_1, AudioCatalog_1, ModelLibrary_1, GameUI_1, ccclass, VERSION, GROUND, GROUND_EFFECT, TOOL_COST, HINTS, GameMain;
    var __moduleName = context_1 && context_1.id;
    return {
        setters: [
            function (cc_1_1) {
                cc_1 = cc_1_1;
            },
            function (index_1_1) {
                index_1 = index_1_1;
            },
            function (SaveStore_1_1) {
                SaveStore_1 = SaveStore_1_1;
            },
            function (RewardedAds_1_1) {
                RewardedAds_1 = RewardedAds_1_1;
            },
            function (GameAudio_1_1) {
                GameAudio_1 = GameAudio_1_1;
            },
            function (AudioCatalog_1_1) {
                AudioCatalog_1 = AudioCatalog_1_1;
            },
            function (ModelLibrary_1_1) {
                ModelLibrary_1 = ModelLibrary_1_1;
            },
            function (GameUI_1_1) {
                GameUI_1 = GameUI_1_1;
            }
        ],
        execute: function () {
            ccclass = cc_1._decorator.ccclass;
            VERSION = '0.1.1';
            GROUND = .08, GROUND_EFFECT = .105;
            TOOL_COST = { heavy: 300, grip: 450, return: 450 };
            HINTS = ['先撞开木栏，拿宝物，再去出口', '推柜子挡住箭路，绕到后面拿宝物', '撞开中间的厚木栏，去拿宝物', '拿到宝物后，向左边出口撤离', '看清冲锋方向，带走窝主的宝物'];
            GameMain = class GameMain extends cc_1.Component {
                constructor() {
                    super(...arguments);
                    this.model = new index_1.GameModel();
                    this.cameraBase = new cc_1.Vec3(0, 24, 10);
                    this.enemies = new Map();
                    this.obstacles = new Map();
                    this.treasure = null;
                    this.exitRing = null;
                    this.heroRing = null;
                    this.aimNodes = [];
                    this.aimEnd = null;
                    this.aimCaption = null;
                    this.threatNodes = new Map();
                    this.arrowNodes = new Map();
                    this.sparkMaterials = [];
                    this.sparks = [];
                    this.ready = false;
                    this.page = 'loading';
                    this.height = 1280;
                    this.time = 0;
                    this.phase = '';
                    this.runId = '';
                    this.runMeta = { bonus: 0, settled: false, bankedRooms: 0 };
                    this.dragging = false;
                    this.dragStart = new cc_1.Vec2();
                    this.dragNow = new cc_1.Vec2();
                    this.dragPower = 0;
                    this.lastAim = new cc_1.Vec2(0, 1);
                    this.activeTouchId = null;
                    this.heldMouse = false;
                    this.shake = 0;
                    this.background = false;
                    this.adBusy = false;
                    this.rewardPending = false;
                    this.overlayPhase = '';
                    this.tipTimer = 0;
                    this.tip = '';
                    this.toastNode = null;
                    this.toolButton = null;
                    this.toolGlow = null;
                    this.stepDots = [];
                    this.tutorialText = null;
                    this.lastHeight = 0;
                    this.homeHeroRotation = 0;
                    this.saveClock = 0;
                }
                async start() {
                    this.save = new SaveStore_1.SaveStore({ onWarning: m => this.toast(m) });
                    this.createScene();
                    this.drawLoading('准备探索装备…');
                    try {
                        await ModelLibrary_1.loadGameEffects();
                        const [environment, characters, audioAssets] = await Promise.all([ModelLibrary_1.loadGameJson('models/environment'), ModelLibrary_1.loadGameJson('models/characters'), AudioCatalog_1.loadAudioCatalog(message => { console.warn('[MonsterDen audio]', message); this.toast('部分音效未能加载，场景仍可继续'); })]);
                        this.audio = new GameAudio_1.GameAudio({ ...audioAssets, settings: this.save.read().settings, allowProceduralFallback: false, onWarning: message => {
                                console.warn('[MonsterDen audio]', message);
                                this.toast('声音资源暂未准备好，可重新进入重试');
                            } });
                        this.ads = new RewardedAds_1.RewardedAds({ ledger: this.save, adUnitId: '', allowWebTestAds: false, onPhaseChange: phase => {
                                this.adBusy = phase !== 'idle';
                                if (this.adBusy)
                                    this.audio.pause('ad');
                                else
                                    void this.audio.resume('ad');
                            } });
                        this.drawLoading('准备乐队与音效…');
                        await this.audio.prepare();
                        this.env = new ModelLibrary_1.ModelLibrary(environment);
                        this.characters = new ModelLibrary_1.ModelLibrary(characters);
                        this.createEffects();
                        this.ready = true;
                        this.restoreRun();
                        this.renderRoom();
                        this.showHome();
                        this.bindInput();
                        globalThis.__MONSTER_DEN__ = { controller: this, model: this.model, version: VERSION, start: () => this.startRun(),
                            getState: () => JSON.parse(JSON.stringify(this.model.state)), resume: () => this.continueRun(),
                            shoot: (x, y, p = 1) => this.model.shoot({ x, y }, p), activateTool: () => this.model.activateTool(),
                            nextRoom: (tool) => this.advance(tool), save: () => this.persist() };
                    }
                    catch (error) {
                        console.error('[MonsterDen asset load]', error);
                        this.drawLoading('场景资源加载失败\n请检查网络后重新进入');
                        const boot = globalThis.__monsterDenRuntime;
                        if (boot)
                            boot.errors.push(String(error));
                    }
                }
                createScene() {
                    this.world = new cc_1.Node('MonsterDenWorld');
                    this.world.parent = this.node;
                    this.roomWorld = new cc_1.Node('Room');
                    this.roomWorld.parent = this.world;
                    this.actorWorld = new cc_1.Node('Actors');
                    this.actorWorld.parent = this.world;
                    this.effectsWorld = new cc_1.Node('Effects');
                    this.effectsWorld.parent = this.world;
                    this.cameraNode = new cc_1.Node('AdventureCamera');
                    this.cameraNode.parent = this.node;
                    this.cameraNode.setPosition(this.cameraBase);
                    this.cameraNode.lookAt(new cc_1.Vec3(0, 0, 0));
                    this.worldCamera = this.cameraNode.addComponent(cc_1.Camera);
                    this.worldCamera.projection = cc_1.Camera.ProjectionType.ORTHO;
                    this.worldCamera.near = .1;
                    this.worldCamera.far = 100;
                    this.worldCamera.clearFlags = cc_1.Camera.ClearFlag.SOLID_COLOR;
                    this.worldCamera.clearColor = GameUI_1.rgba('#12292b');
                    this.worldCamera.visibility = cc_1.Layers.BitMask.DEFAULT;
                    this.worldCamera.priority = 0;
                    const lightNode = new cc_1.Node('WarmKey');
                    lightNode.parent = this.node;
                    lightNode.setRotationFromEuler(-55, -35, 0);
                    const light = lightNode.addComponent(cc_1.DirectionalLight);
                    light.color = GameUI_1.rgba('#ffedcf');
                    light.illuminance = 1;
                    this.canvas = new cc_1.Node('Interface');
                    this.canvas.parent = this.node;
                    this.canvas.layer = cc_1.Layers.Enum.UI_2D;
                    const transform = this.canvas.addComponent(cc_1.UITransform);
                    transform.setContentSize(720, 1280);
                    const uiCameraNode = new cc_1.Node('InterfaceCamera');
                    uiCameraNode.parent = this.canvas;
                    uiCameraNode.setPosition(0, 0, 1000);
                    const cam = uiCameraNode.addComponent(cc_1.Camera);
                    cam.projection = cc_1.Camera.ProjectionType.ORTHO;
                    cam.orthoHeight = 640;
                    cam.near = .1;
                    cam.far = 2000;
                    cam.clearFlags = cc_1.Camera.ClearFlag.DEPTH_ONLY;
                    cam.visibility = cc_1.Layers.BitMask.UI_2D;
                    cam.priority = 10;
                    const canvas = this.canvas.addComponent(cc_1.Canvas);
                    canvas.cameraComponent = cam;
                    canvas.alignCanvasWithScreen = true;
                    this.hud = GameUI_1.uiNode('HUD', this.canvas, 720, 1280);
                    this.overlay = GameUI_1.uiNode('Overlay', this.canvas, 720, 1280);
                    this.floating = GameUI_1.uiNode('Floaters', this.canvas, 720, 1280);
                    this.resize();
                }
                resize() {
                    const size = cc_1.view.getVisibleSize();
                    this.height = size.height || 1280;
                    this.lastHeight = this.height;
                    this.worldCamera.orthoHeight = 5.85 / (size.width / size.height);
                    for (const root of [this.hud, this.overlay, this.floating])
                        root.getComponent(cc_1.UITransform).setContentSize(720, this.height);
                }
                clear(node) { for (const child of [...node.children])
                    child.destroy(); node.removeAllChildren(); }
                drawLoading(text) {
                    this.clear(this.overlay);
                    GameUI_1.label(this.overlay, '撞进怪物窝', 48, 0, 90, 650, 80, GameUI_1.PALETTE.gold, true);
                    GameUI_1.label(this.overlay, text, 25, 0, -30, 620, 130, GameUI_1.PALETTE.muted);
                    GameUI_1.label(this.overlay, '正在准备完整场景', 19, 0, -130, 620, 40, GameUI_1.PALETTE.muted);
                }
                createEffects() {
                    this.matShadow = ModelLibrary_1.makeMaterial(new cc_1.Color(7, 20, 18, 255), false, true, true);
                    this.matAim = ModelLibrary_1.makeMaterial(GameUI_1.rgba('#8be3bc'), false, true, true, .6);
                    this.matDanger = ModelLibrary_1.makeMaterial(new cc_1.Color(236, 105, 78, 150), false, true, true);
                    this.matGold = ModelLibrary_1.makeMaterial(GameUI_1.rgba('#ffdb7c'), false, true, true, .8);
                    this.sparkMaterials = ['#ffe1a0', '#aaead0', '#d39b61', '#ef9b7d'].map(c => ModelLibrary_1.makeMaterial(GameUI_1.rgba(c), false, false, false, .8));
                    for (let i = 0; i < 24; i++) {
                        const node = ModelLibrary_1.meshNode('AimMark', ModelLibrary_1.discMesh(.07, .95, .8, 12), this.matAim, this.effectsWorld);
                        node.active = false;
                        this.aimNodes.push(node);
                    }
                    this.aimEnd = ModelLibrary_1.meshNode('AimEndpoint', ModelLibrary_1.ringMesh(.38, .055), this.matAim, this.effectsWorld);
                    this.aimEnd.active = false;
                    this.aimCaption = GameUI_1.label(this.floating, '', 20, 0, 0, 180, 35, GameUI_1.PALETTE.mint, true);
                    this.aimCaption.node.active = false;
                }
                instantiate(key, parent, x = 0, y = 0, scale = 1) {
                    const instance = this.env.instantiate(key, parent, scale);
                    instance.root.setPosition(x, key === 'floor' || key === 'trim' ? 0 : GROUND, -y);
                    return instance;
                }
                makeActor(key, x, y, scale) {
                    const instance = this.characters.instantiate(key, this.actorWorld, scale);
                    instance.root.setPosition(x, GROUND, -y);
                    const shadow = ModelLibrary_1.meshNode('ContactShadow', ModelLibrary_1.discMesh(1, .28, 0, 36), this.matShadow, this.actorWorld);
                    shadow.setPosition(x, GROUND_EFFECT, -y);
                    shadow.setScale(.72 * scale, 1, .5 * scale);
                    return { instance, shadow, scale, hit: 0, phase: Math.random() * 6 };
                }
                renderRoom() {
                    this.clear(this.roomWorld);
                    this.clear(this.actorWorld);
                    this.enemies.clear();
                    this.obstacles.clear();
                    for (const node of this.threatNodes.values())
                        node.destroy();
                    this.threatNodes.clear();
                    for (const node of this.arrowNodes.values())
                        node.destroy();
                    this.arrowNodes.clear();
                    this.heroRing?.destroy();
                    this.exitRing?.destroy();
                    this.clearAim();
                    const state = this.model.state;
                    this.instantiate('floor', this.roomWorld);
                    if (this.env.has('trim'))
                        this.instantiate('trim', this.roomWorld);
                    for (const o of state.obstacles) {
                        if (o.destroyed)
                            continue;
                        const key = this.env.has(o.kind) ? o.kind : 'pillar';
                        const object = this.instantiate(key, this.roomWorld, o.x, o.y);
                        this.env.fitFootprint(object, key, o.w, o.h);
                        this.obstacles.set(o.id, object);
                    }
                    this.treasure = this.instantiate('treasure', this.roomWorld, state.treasure.x, state.treasure.y, .75);
                    this.treasure.root.active = !state.treasure.taken;
                    this.instantiate('exit', this.roomWorld, state.exit.x, state.exit.y, .8);
                    this.exitRing = ModelLibrary_1.meshNode('ExitGlow', ModelLibrary_1.ringMesh(.8, .12), this.matGold, this.roomWorld);
                    this.exitRing.setPosition(state.exit.x, GROUND_EFFECT, -state.exit.y);
                    const decor = [[-5.15, -5.2, 'fern', 1.1], [-5.1, 3.8, 'fern', 1.3], [5.1, 2.8, 'fern', 1.3], [5.1, -4.8, 'mushroom', 1.2], [-5.2, 0, 'mushroom', 1], [-4.6, 6.5, 'lantern', 1], [4.7, 6.4, 'lantern', 1]];
                    for (const [x, y, key, s] of decor)
                        if (this.env.has(key))
                            this.instantiate(key, this.roomWorld, x, y, s);
                    this.hero = this.makeActor('hero', state.player.x, state.player.y, .72);
                    this.heroRing = ModelLibrary_1.meshNode('PlayerRing', ModelLibrary_1.ringMesh(.48, .065), this.matAim, this.actorWorld);
                    for (const enemy of state.enemies) {
                        if (!enemy.alive)
                            continue;
                        const key = enemy.kind === 'charger' ? 'boss' : enemy.kind;
                        this.enemies.set(enemy.id, this.makeActor(key, enemy.x, enemy.y, enemy.kind === 'boss' ? .97 : enemy.kind === 'charger' ? .58 : .66));
                        const danger = ModelLibrary_1.meshNode('EnemyIntent', this.beamMesh(), this.matDanger, this.effectsWorld);
                        this.threatNodes.set(enemy.id, danger);
                    }
                    this.phase = '';
                    this.overlayPhase = '';
                    this.shake = 0;
                }
                beamMesh() { return { positions: [-.5, 0, -.5, .5, 0, -.5, -.5, 0, .5, .5, 0, .5], normals: [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], colors: [1, 1, 1, .04, 1, 1, 1, .04, 1, 1, 1, .45, 1, 1, 1, .45], uvs: [0, 0, 1, 0, 0, 1, 1, 1], indices: [0, 2, 1, 1, 2, 3] }; }
                showHome() {
                    if (this.adBusy || this.rewardPending)
                        return;
                    this.cancelDrag();
                    this.page = 'home';
                    this.clear(this.hud);
                    this.clear(this.overlay);
                    this.overlayPhase = '';
                    this.updateMusicScene();
                    for (const t of this.threatNodes.values())
                        t.active = false;
                    const top = this.height / 2, bottom = -top;
                    GameUI_1.label(this.hud, 'MONSTER DEN', 17, 0, top - 77, 640, 32, GameUI_1.PALETTE.muted, true);
                    GameUI_1.label(this.hud, '撞进怪物窝', 53, 0, top - 134, 650, 80, GameUI_1.PALETTE.cream, true);
                    GameUI_1.label(this.hud, '撞开一条路，把宝物带出来', 23, 0, top - 192, 630, 45, GameUI_1.PALETTE.gold);
                    this.soundButton();
                    const saved = this.save.getSnapshot();
                    const savedPhase = saved?.state?.model?.state?.phase;
                    const terminal = savedPhase === 'victory' || savedPhase === 'game_over';
                    const canContinue = !!savedPhase && (!terminal || !saved.state.settled || (savedPhase === 'victory' && !saved.state.bonus));
                    const p = GameUI_1.panel(this.hud, 660, 250, 0, bottom + 176, GameUI_1.PALETTE.deep, '#738e77', 26, 246);
                    GameUI_1.button(p, canContinue ? (terminal ? '查看冒险结算' : '继续这次冒险') : '潜入怪物窝', 0, 55, 590, 76, () => canContinue ? this.continueRun() : this.startRun());
                    GameUI_1.button(p, '工具柜', -152, -42, 280, 66, () => this.showTools(), false);
                    GameUI_1.button(p, canContinue ? '重新出发' : '怎么玩', 152, -42, 280, 66, () => canContinue ? this.confirmNewRun() : this.showHelp(), false);
                    const coins = this.save.read().progress.coins || 0;
                    GameUI_1.label(p, `已带回 ${coins} 枚金币`, 21, 0, -97, 600, 35, GameUI_1.PALETTE.muted);
                    GameUI_1.label(this.hud, `首段冒险 · ${VERSION}`, 17, 0, bottom + 25, 630, 30, '#72958e');
                }
                soundButton() {
                    const muted = this.audio.settings.muted;
                    GameUI_1.button(this.hud, muted ? '静音' : '声音', 286, this.height / 2 - 54, 100, 47, () => { this.clickSound(); this.audio.setMuted(!this.audio.settings.muted); this.save.updateSettings({ muted: this.audio.settings.muted }); if (this.page === 'home')
                        this.showHome();
                    else
                        this.drawHud(); }, false);
                }
                clickSound() { void this.audio.unlock().then(() => { this.audio.startMusic(); this.audio.play('click'); }); }
                updateMusicScene() {
                    const scene = this.page === 'game' ? (this.model.state.roomIndex === 4 ? 'boss' : 'explore') : 'camp';
                    this.audio.setMusicScene(scene);
                    // Decoded music is bounded to the current and next scene; the mixer retires
                    // the previous buffer after its crossfade, including quick menu changes.
                    if (scene === 'camp')
                        void this.audio.preloadMusic('explore');
                    else if (this.model.state.roomIndex === 3)
                        void this.audio.preloadMusic('boss');
                }
                showHelp() {
                    this.clickSound();
                    this.clear(this.overlay);
                    const p = GameUI_1.panel(this.overlay, 650, 490, 0, 0, GameUI_1.PALETTE.deep);
                    GameUI_1.label(p, '带着宝物离开', 36, 0, 173, 590, 65, GameUI_1.PALETTE.gold, true);
                    GameUI_1.label(p, '在场景上按住，向后拖拽\n松手后，小兽会沿瞄准方向冲出\n\n撞柜子挡箭，撞木栏开路\n拿到宝物后，进入发光出口', 26, 0, 15, 580, 240);
                    GameUI_1.button(p, '明白了', 0, -170, 530, 72, () => { this.clickSound(); this.clear(this.overlay); });
                }
                confirmNewRun() {
                    this.clickSound();
                    this.clear(this.overlay);
                    const p = GameUI_1.panel(this.overlay, 640, 320, 0, 0, GameUI_1.PALETTE.deep);
                    GameUI_1.label(p, '开始新的冒险？', 34, 0, 94, 590, 65, GameUI_1.PALETTE.gold, true);
                    GameUI_1.label(p, '当前这局将结束，已解锁工具保留。', 24, 0, 23, 590, 55);
                    GameUI_1.button(p, '继续当前冒险', 0, -60, 540, 65, () => this.continueRun());
                    GameUI_1.button(p, '重新出发', 0, -137, 540, 50, () => this.startRun(), false);
                }
                showTools() {
                    if (this.adBusy || this.rewardPending)
                        return;
                    this.cancelDrag();
                    this.clickSound();
                    this.page = 'tools';
                    this.clear(this.hud);
                    this.clear(this.overlay);
                    const d = this.save.read();
                    this.updateMusicScene();
                    GameUI_1.label(this.hud, '探险工具柜', 43, 0, this.height / 2 - 106, 650, 75, GameUI_1.PALETTE.gold, true);
                    GameUI_1.label(this.hud, `金币 ${d.progress.coins || 0} · 开局可携带一件`, 22, 0, this.height / 2 - 163, 650, 44, GameUI_1.PALETTE.muted);
                    index_1.TOOLS.forEach((tool, i) => {
                        const p = GameUI_1.panel(this.overlay, 650, 192, 0, 190 - i * 216, GameUI_1.PALETTE.deep, '#77957d');
                        GameUI_1.label(p, tool.name, 31, -80, 54, 430, 55, GameUI_1.PALETTE.cream, true);
                        GameUI_1.label(p, tool.description, 22, -24, -2, 580, 65, GameUI_1.PALETTE.muted);
                        const unlocked = d.progress.unlockedTools.includes(tool.id), selected = d.progress.startingTool === tool.id;
                        GameUI_1.button(p, selected ? '已携带' : unlocked ? '开局携带' : `${TOOL_COST[tool.id]} 金币解锁`, 0, -61, 570, 47, () => {
                            this.clickSound();
                            const current = this.save.read();
                            if (!unlocked && (current.progress.coins || 0) < TOOL_COST[tool.id]) {
                                this.toast('带出宝物，结算后就能解锁');
                                return;
                            }
                            this.save.update(doc => { if (!doc.progress.unlockedTools.includes(tool.id)) {
                                doc.progress.coins = (doc.progress.coins || 0) - TOOL_COST[tool.id];
                                doc.progress.unlockedTools.push(tool.id);
                            } doc.progress.startingTool = tool.id; });
                            this.showTools();
                        }, !selected);
                    });
                    GameUI_1.button(this.hud, '回到营地', 0, -this.height / 2 + 85, 590, 70, () => this.showHome(), false);
                }
                startRun() {
                    if (!this.ready || this.adBusy || this.rewardPending)
                        return;
                    if (['victory', 'game_over'].includes(this.model.state.phase) && !this.runMeta.settled && !this.settle())
                        return;
                    this.cancelDrag();
                    this.clickSound();
                    this.model.restart();
                    const tool = this.save.read().progress.startingTool;
                    if (tool && this.save.read().progress.unlockedTools.includes(tool))
                        this.model.equipStartingTool(tool);
                    this.runId = `den-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                    this.runMeta = { bonus: 0, settled: false, bankedRooms: 0 };
                    this.save.update(d => { d.progress.runsPlayed++; });
                    this.page = 'game';
                    this.updateMusicScene();
                    this.renderRoom();
                    this.drawHud();
                    this.clear(this.overlay);
                    this.persist();
                }
                continueRun() { if (this.adBusy || this.rewardPending)
                    return; this.clickSound(); this.restoreRun(); this.page = 'game'; this.updateMusicScene(); this.renderRoom(); this.drawHud(); this.clear(this.overlay); }
                restoreRun() {
                    const saved = this.save.getSnapshot();
                    if (saved) {
                        try {
                            this.model.restore(saved.state.model);
                            this.runId = saved.runId;
                            this.runMeta = { bonus: saved.state.bonus || 0, settled: !!saved.state.settled, bankedRooms: saved.state.bankedRooms || 0 };
                        }
                        catch (e) {
                            console.warn('Run restore failed', e);
                            this.save.clearSnapshot();
                            this.model.restart();
                            this.runId = '';
                            this.runMeta = { bonus: 0, settled: false, bankedRooms: 0 };
                        }
                    }
                    if (!this.runId)
                        this.runId = `den-${Date.now()}`;
                    for (const receipt of this.save.pendingRewards(this.runId))
                        this.applyReceipt(receipt.id, receipt.placement);
                }
                persist() { return !!(this.ready && this.runId && this.save.saveSnapshot(this.runId, { model: this.model.snapshot(), ...this.runMeta }).ok); }
                drawHud() {
                    this.clear(this.hud);
                    this.clear(this.overlay);
                    this.overlayPhase = '';
                    const top = this.height / 2, bottom = -top;
                    GameUI_1.panel(this.hud, 672, 172, 0, top - 127, GameUI_1.PALETTE.deep, '#607d6d', 22, 243);
                    this.roomLabel = GameUI_1.label(this.hud, '', 32, -66, top - 90, 480, 53, GameUI_1.PALETTE.cream, true);
                    this.hpLabel = GameUI_1.label(this.hud, '', 29, -184, top - 143, 280, 45, GameUI_1.PALETTE.danger, true);
                    this.lootLabel = GameUI_1.label(this.hud, '', 24, 189, top - 143, 270, 45, GameUI_1.PALETTE.gold, true);
                    this.stepDots = [];
                    for (let i = 0; i < 5; i++)
                        this.stepDots.push(GameUI_1.label(this.hud, '●', 17, -66 + i * 33, top - 193, 30, 30));
                    this.soundButton();
                    GameUI_1.button(this.hud, '营地', -287, top - 42, 95, 43, () => { this.persist(); this.showHome(); }, false);
                    const dock = GameUI_1.panel(this.hud, 672, 180, 0, bottom + 138, GameUI_1.PALETTE.deep, '#6e8c79', 25, 250);
                    this.hintLabel = GameUI_1.label(dock, '', 24, 0, 48, 620, 64, GameUI_1.PALETTE.cream);
                    this.phaseLabel = GameUI_1.label(dock, '', 20, -145, -23, 330, 50, GameUI_1.PALETTE.muted);
                    this.toolButton = GameUI_1.button(dock, '使用工具', 171, -27, 275, 62, () => {
                        this.clickSound();
                        const p = this.model.state.player;
                        if (!this.model.activateTool())
                            this.showTip(p.tool === 'none' ? '带出这间的宝物，就能选一件工具' : p.tool === 'heavy' ? '重撞持续生效：撞击更强，推柜更远' : !p.toolReady ? '这回合已经用过，下一回合恢复' : '冲出去以后，再点击工具', 2);
                        else {
                            this.cancelDrag();
                            this.persist();
                        }
                    }, false);
                    this.toolButton.addComponent(cc_1.UIOpacity);
                    this.toolGlow = GameUI_1.uiNode('ToolReadyGlow', this.toolButton, 275, 62);
                    const glow = this.toolGlow.addComponent(cc_1.Graphics);
                    glow.lineWidth = 3;
                    glow.strokeColor = GameUI_1.rgba(GameUI_1.PALETTE.gold);
                    glow.roundRect(-137, -31, 274, 62, 20);
                    glow.stroke();
                    this.toolGlow.active = false;
                    this.tutorialText = GameUI_1.label(this.hud, '拖拽瞄准 · 松手出击', 20, 0, bottom + 24, 650, 35, GameUI_1.PALETTE.muted);
                    this.updateHud();
                }
                updateHud() {
                    if (this.page !== 'game' || !this.roomLabel)
                        return;
                    const s = this.model.state, p = s.player;
                    this.roomLabel.string = `${s.roomIndex + 1} / 5  ${s.roomName}`;
                    this.hpLabel.string = '♥'.repeat(p.hp) + '♡'.repeat(Math.max(0, p.maxHp - p.hp));
                    this.lootLabel.string = s.treasure.taken ? '宝物已到手' : '寻找宝物';
                    this.stepDots.forEach((l, i) => { l.color = GameUI_1.rgba(i <= s.roomIndex ? GameUI_1.PALETTE.gold : '#486961'); });
                    this.hintLabel.string = this.tipTimer > 0 ? this.tip : s.treasure.taken ? '宝物到手，前往发光出口' : HINTS[s.roomIndex];
                    this.phaseLabel.string = this.dragging ? `力度 ${Math.round(this.dragPower * 100)}%` : s.phase === 'moving' ? '正在冲撞' : s.phase === 'enemies' ? '守卫即将行动' : p.tool === 'grip' && !p.toolReady ? '抓停成功 · 再次瞄准' : `第 ${s.turn + 1} 次行动`;
                    const tool = index_1.TOOLS.find(t => t.id === p.tool);
                    const toolLabel = this.toolButton?.getComponentsInChildren(cc_1.Label)[0];
                    const activeTool = p.tool === 'grip' || p.tool === 'return', available = activeTool && p.toolReady && s.phase === 'moving';
                    if (toolLabel) {
                        toolLabel.string = !tool ? '下间房选工具' : p.tool === 'heavy' ? '重撞 · 持续生效' : !p.toolReady ? '本回合已使用' : s.phase === 'moving' ? tool.actionLabel : '冲撞时可用';
                        toolLabel.color = GameUI_1.rgba(available ? GameUI_1.PALETTE.gold : GameUI_1.PALETTE.cream);
                    }
                    if (this.toolGlow)
                        this.toolGlow.active = available;
                    const opacity = this.toolButton?.getComponent(cc_1.UIOpacity);
                    if (opacity)
                        opacity.opacity = available || p.tool === 'heavy' ? 255 : 170;
                    if (this.tutorialText) {
                        this.tutorialText.string = s.shots === 0 ? (this.dragging ? (this.dragPower > .1 ? '松手！撞开前面的木栏' : '向后拖远一点，看看前方路线') : '按住场景，向后拉，再松手') :
                            s.phase === 'enemies' ? '红色区域是守卫的攻击方向' : activeTool && available ? '工具亮起了，冲撞中可以点击使用' : s.treasure.taken ? '带宝物进出口，就能离开这一间' : '拖拽瞄准 · 松手出击';
                        this.tutorialText.color = GameUI_1.rgba(s.shots === 0 ? GameUI_1.PALETTE.gold : GameUI_1.PALETTE.muted);
                    }
                }
                showRoomClear() {
                    this.clear(this.overlay);
                    const p = GameUI_1.panel(this.overlay, 665, 720, 0, 0, GameUI_1.PALETTE.deep, '#bfa46c', 28, 252);
                    GameUI_1.label(p, '宝物带出来了', 38, 0, 294, 610, 72, GameUI_1.PALETTE.gold, true);
                    GameUI_1.label(p, '挑一件工具，进入下一间', 24, 0, 231, 600, 50, GameUI_1.PALETTE.muted);
                    index_1.TOOLS.forEach((tool, i) => {
                        const y = 115 - i * 160;
                        const card = GameUI_1.panel(p, 602, 139, 0, y, '#294647', '#829d7f', 18);
                        GameUI_1.label(card, tool.name, 28, 0, 37, 560, 45, GameUI_1.PALETTE.cream, true);
                        GameUI_1.label(card, tool.description, 21, 0, -10, 548, 61, GameUI_1.PALETTE.muted);
                        card.on(cc_1.Node.EventType.TOUCH_END, (e) => { e.propagationStopped = true; this.advance(tool.id); });
                    });
                }
                advance(tool) {
                    if (this.adBusy || this.rewardPending)
                        return false;
                    if (!this.model.nextRoom(tool))
                        return false;
                    this.clickSound();
                    this.runMeta.bankedRooms = Math.max(this.runMeta.bankedRooms, this.model.state.roomIndex);
                    this.updateMusicScene();
                    this.renderRoom();
                    this.drawHud();
                    this.clear(this.overlay);
                    this.persist();
                    return true;
                }
                settle() {
                    if (this.runMeta.settled)
                        return true;
                    const s = this.model.state;
                    this.runMeta.settled = true;
                    const result = this.save.update(d => {
                        d.progress.coins = (d.progress.coins || 0) + s.score;
                        d.progress.bestLoot = Math.max(d.progress.bestLoot, s.score);
                        if (s.phase === 'victory')
                            d.progress.runsCompleted++;
                        d.progress.roomsCleared += s.roomIndex + (s.phase === 'victory' ? 1 : 0);
                        d.snapshot = { runId: this.runId, savedAt: Date.now(), state: { model: this.model.snapshot(), ...this.runMeta } };
                    });
                    if (!result.ok) {
                        this.runMeta.settled = false;
                        this.toast('收获暂未保存，请稍后再试');
                    }
                    return result.ok;
                }
                showResult(won) {
                    this.clear(this.overlay);
                    if (won)
                        this.settle();
                    const s = this.model.state;
                    const p = GameUI_1.panel(this.overlay, 650, won ? 570 : 520, 0, 0, GameUI_1.PALETTE.deep, won ? GameUI_1.PALETTE.gold : '#bd8d72', 28, 252);
                    GameUI_1.label(p, won ? '满载而归' : '被守卫拦住了', 40, 0, won ? 215 : 188, 600, 75, won ? GameUI_1.PALETTE.gold : GameUI_1.PALETTE.danger, true);
                    GameUI_1.label(p, `带回 ${s.score + this.runMeta.bonus} 金币`, 31, 0, won ? 145 : 115, 600, 58, GameUI_1.PALETTE.cream, true);
                    GameUI_1.label(p, won ? `${s.shots} 次出手 · 5 处宝物` : '换个落点，或者先挪开挡路的柜子', 23, 0, won ? 88 : 56, 580, 58, GameUI_1.PALETTE.muted);
                    if (won) {
                        GameUI_1.button(p, '再潜入一次', 0, 5, 560, 70, () => this.startRun());
                        GameUI_1.button(p, this.runMeta.bonus ? '额外奖励已领取' : '看视频 · 加领金币', 0, -85, 560, 66, () => void this.requestAd('settlement_bonus'), false);
                        GameUI_1.button(p, '回到营地', 0, -170, 560, 60, () => this.showHome(), false);
                    }
                    else {
                        GameUI_1.button(p, '重新出发', 0, -32, 560, 70, () => { if (!this.adBusy && !this.rewardPending && this.settle())
                            this.startRun(); });
                        GameUI_1.button(p, s.rescuesUsed ? '本局救援已使用' : '看视频 · 救援一次', 0, -119, 560, 64, () => void this.requestAd('rescue'), false);
                        GameUI_1.button(p, '带回收获，返回营地', 0, -200, 560, 54, () => { if (!this.adBusy && !this.rewardPending && this.settle())
                            this.showHome(); }, false);
                    }
                }
                async requestAd(placement) {
                    if (this.rewardPending || this.adBusy)
                        return;
                    this.clickSound();
                    if (!this.persist()) {
                        this.toast('当前冒险未能保存，请稍后再试');
                        return;
                    }
                    const s = this.model.state, targetRunId = this.runId;
                    this.rewardPending = true;
                    try {
                        const result = await this.ads.request({ placement, runId: targetRunId, userInitiated: true,
                            eligible: placement === 'rescue' ? s.phase === 'game_over' && s.rescuesUsed === 0 && !this.runMeta.settled : s.phase === 'victory' && this.runMeta.settled && this.runMeta.bonus === 0 });
                        if (result.receipt && (result.status === 'completed' || result.status === 'pending_reward'))
                            this.applyReceipt(result.receipt.id, placement, targetRunId);
                        else
                            this.toast(result.message);
                    }
                    finally {
                        this.rewardPending = false;
                    }
                }
                applyReceipt(id, placement, targetRunId = this.runId) {
                    if (targetRunId !== this.runId)
                        return;
                    const result = this.save.applyReward(id, (d, receipt) => {
                        if (!d.snapshot || d.snapshot.runId !== targetRunId || receipt.runId !== targetRunId || receipt.placement !== placement)
                            throw new Error('奖励不属于当前冒险');
                        const stored = d.snapshot.state;
                        if (receipt.placement === 'rescue') {
                            if (stored.settled)
                                throw new Error('本局已结算');
                            const model = new index_1.GameModel({ snapshot: stored.model });
                            if (!model.rescue())
                                throw new Error('本局已无法救援');
                            stored.model = model.snapshot();
                        }
                        else if (receipt.placement === 'settlement_bonus') {
                            if (stored.model.state.phase !== 'victory' || !stored.settled || stored.bonus)
                                throw new Error('本局不能再次领取');
                            const amount = stored.model.state.score;
                            stored.bonus = amount;
                            d.progress.coins = (d.progress.coins || 0) + amount;
                        }
                        else
                            throw new Error('未知奖励类型');
                        d.snapshot.state = stored;
                    });
                    if (!result.ok) {
                        this.toast(result.error || '奖励暂未保存，请稍后重试');
                        return;
                    }
                    if (result.alreadyApplied)
                        return;
                    const snapshot = this.save.getSnapshot();
                    this.model.restore(snapshot.state.model);
                    this.runMeta = { bonus: snapshot.state.bonus, settled: snapshot.state.settled, bankedRooms: snapshot.state.bankedRooms };
                    if (placement === 'rescue') {
                        this.page = 'game';
                        this.clear(this.overlay);
                        this.renderRoom();
                        this.drawHud();
                    }
                    else if (this.page === 'game')
                        this.showResult(true);
                }
                bindInput() {
                    cc_1.input.on(cc_1.Input.EventType.TOUCH_START, this.touchStart, this);
                    cc_1.input.on(cc_1.Input.EventType.TOUCH_MOVE, this.touchMove, this);
                    cc_1.input.on(cc_1.Input.EventType.TOUCH_END, this.touchEnd, this);
                    cc_1.input.on(cc_1.Input.EventType.TOUCH_CANCEL, this.touchCancel, this);
                    cc_1.input.on(cc_1.Input.EventType.MOUSE_DOWN, this.mouseDown, this);
                    cc_1.input.on(cc_1.Input.EventType.MOUSE_MOVE, this.mouseMove, this);
                    cc_1.input.on(cc_1.Input.EventType.MOUSE_UP, this.mouseUp, this);
                    cc_1.game.on(cc_1.Game.EVENT_HIDE, this.onHide, this);
                    cc_1.game.on(cc_1.Game.EVENT_SHOW, this.onShow, this);
                }
                validInput(location) { const sy = location.y / cc_1.view.getScaleY(); return this.ready && this.page === 'game' && !this.background && !this.adBusy && !this.rewardPending && !this.overlay.children.length && sy > 250 && sy < this.height - 220; }
                begin(location) {
                    if (this.dragging || !this.validInput(location) || this.model.state.phase !== 'aiming')
                        return;
                    this.clickSound();
                    this.dragging = true;
                    this.dragStart.set(location);
                    this.dragNow.set(location);
                    this.dragPower = 0;
                }
                move(location) {
                    if (!this.dragging)
                        return;
                    this.dragNow.set(location);
                    const dx = (this.dragStart.x - location.x) / cc_1.view.getScaleX(), dy = (this.dragStart.y - location.y) / cc_1.view.getScaleY();
                    this.dragPower = Math.min(1, Math.sqrt(dx * dx + dy * dy) / 165);
                    this.lastAim.set(dx, dy / Math.sin(Math.atan2(24, 10)));
                    this.showAim();
                }
                release() {
                    if (!this.dragging)
                        return;
                    this.dragging = false;
                    this.clearAim();
                    if (this.dragPower > .10 && this.model.shoot({ x: this.lastAim.x, y: this.lastAim.y }, this.dragPower))
                        this.persist();
                }
                touchStart(e) { if (this.activeTouchId !== null || this.heldMouse)
                    return; const id = e.getID(); if (id === null)
                    return; this.begin(e.getLocation()); if (this.dragging)
                    this.activeTouchId = id; }
                touchMove(e) { if (this.activeTouchId === null || e.getID() !== this.activeTouchId)
                    return; this.move(e.getLocation()); }
                touchEnd(e) { if (this.activeTouchId === null || e.getID() !== this.activeTouchId)
                    return; this.move(e.getLocation()); this.activeTouchId = null; this.release(); }
                touchCancel(e) { if (this.activeTouchId === null || e.getID() !== this.activeTouchId)
                    return; this.cancelDrag(); }
                cancelDrag() { this.activeTouchId = null; this.heldMouse = false; this.dragging = false; this.dragPower = 0; this.clearAim(); }
                // Cocos synthesizes a touch before mouse events. Only use this fallback when
                // no touch claimed the gesture, so the same mouse gesture cannot fire twice.
                mouseDown(e) { if (e.getButton() !== 0 || this.activeTouchId !== null)
                    return; this.begin(e.getLocation()); this.heldMouse = this.dragging; }
                mouseMove(e) { if (this.heldMouse)
                    this.move(e.getLocation()); }
                mouseUp() { if (!this.heldMouse)
                    return; this.heldMouse = false; this.release(); }
                onHide() { this.background = true; this.cancelDrag(); this.persist(); }
                onShow() { this.background = false; }
                showAim() {
                    this.clearAim();
                    if (this.dragPower < .06)
                        return;
                    const preview = this.model.aim(this.lastAim.x, this.lastAim.y, this.dragPower);
                    for (let i = 0; i < Math.min(this.aimNodes.length, preview.points.length); i++) {
                        const at = Math.floor(i * (preview.points.length - 1) / (Math.min(this.aimNodes.length, preview.points.length) - 1 || 1)), p = preview.points[at];
                        const n = this.aimNodes[i];
                        n.active = true;
                        n.setPosition(p.x, GROUND_EFFECT + .01, -p.y);
                        n.setScale(i === 0 ? 1.3 : 1, 1, i === 0 ? 1.3 : 1);
                    }
                    const end = preview.points[preview.points.length - 1];
                    if (end && this.aimEnd && this.aimCaption) {
                        this.aimEnd.active = true;
                        this.aimEnd.setPosition(end.x, GROUND_EFFECT + .016, -end.y);
                        this.aimEnd.getComponent(cc_1.MeshRenderer).setMaterial(preview.blocked ? this.matGold : this.matAim, 0);
                        this.aimCaption.string = preview.blocked ? '碰撞点' : preview.endpoint === 'exit' ? '离开房间' : '落点';
                        this.aimCaption.color = GameUI_1.rgba(preview.blocked ? GameUI_1.PALETTE.gold : GameUI_1.PALETTE.mint);
                        const screen = this.worldCamera.worldToScreen(new cc_1.Vec3(end.x, .3, -end.y));
                        this.aimCaption.node.setPosition(screen.x / cc_1.view.getScaleX() - 360, screen.y / cc_1.view.getScaleY() - this.height / 2 + 25, 0);
                        this.aimCaption.node.active = true;
                    }
                }
                clearAim() { for (const node of this.aimNodes)
                    node.active = false; if (this.aimEnd)
                    this.aimEnd.active = false; if (this.aimCaption)
                    this.aimCaption.node.active = false; }
                update(dt) {
                    if (!this.ready)
                        return;
                    dt = Math.min(dt, .05);
                    this.time += dt;
                    if (Math.abs(cc_1.view.getVisibleSize().height - this.lastHeight) > 1) {
                        this.resize();
                        if (this.page === 'game')
                            this.drawHud();
                        else if (this.page === 'home')
                            this.showHome();
                        else
                            this.showTools();
                    }
                    if (this.background || this.adBusy)
                        return;
                    if (this.page === 'game') {
                        this.model.step(dt);
                        for (const event of this.model.drainEvents())
                            this.handleEvent(event);
                        if (this.model.state.phase !== this.phase) {
                            this.phase = this.model.state.phase;
                            this.persist();
                        }
                        if (['room_clear', 'game_over', 'victory'].includes(this.phase) && this.overlayPhase !== this.phase) {
                            this.overlayPhase = this.phase;
                            if (this.phase === 'room_clear')
                                this.showRoomClear();
                            else
                                this.showResult(this.phase === 'victory');
                        }
                        this.updateHud();
                        this.saveClock += dt;
                        if (this.saveClock > 2) {
                            this.saveClock = 0;
                            this.persist();
                        }
                    }
                    this.updateWorld(dt);
                    this.updateSparks(dt);
                    this.tipTimer = Math.max(0, this.tipTimer - dt);
                    this.shake = Math.max(0, this.shake - dt * 1.5);
                    this.cameraNode.setPosition(this.cameraBase.x + (Math.random() - .5) * this.shake * .18, this.cameraBase.y, this.cameraBase.z + (Math.random() - .5) * this.shake * .18);
                }
                animateActor(v, x, y, vx, vy, dt, isHero = false) {
                    const speed = Math.hypot(vx, vy), moving = speed > .3, phase = this.time * (moving ? 14 : 3) + v.phase;
                    const root = v.instance.root;
                    root.setPosition(x, GROUND + (moving ? .07 + Math.abs(Math.sin(phase)) * .04 : .025 + Math.sin(phase) * .025), -y);
                    if (moving)
                        root.setRotationFromEuler(0, Math.atan2(vx, -vy) * 180 / Math.PI, 0);
                    else if (this.page === 'home' && isHero)
                        root.setRotationFromEuler(0, Math.sin(this.time * .4) * 12, 0);
                    else if (isHero && this.dragging)
                        root.setRotationFromEuler(0, Math.atan2(this.lastAim.x, -this.lastAim.y) * 180 / Math.PI, 0);
                    const squat = isHero && this.dragging ? 1 - this.dragPower * .12 : 1;
                    root.setScale(v.scale * (1 + (1 - squat) * .3), v.scale * squat, v.scale * (1 + (1 - squat) * .3));
                    for (const [name, node] of v.instance.parts) {
                        const base = v.instance.baseEuler.get(name);
                        let ex = base.x, ey = base.y, ez = base.z;
                        if (name.endsWith('.head')) {
                            ex += moving ? -12 : Math.sin(phase) * 3;
                            ey += Math.sin(phase * .6) * 3;
                        }
                        else if (name.includes('.arm.')) {
                            ex += Math.sin(phase + (name.endsWith('L') ? 0 : Math.PI)) * (moving ? 32 : 4);
                            ez += (name.endsWith('L') ? 1 : -1) * (moving ? 10 : 0);
                        }
                        else if (name.includes('.leg.'))
                            ex += Math.sin(phase + (name.endsWith('L') ? Math.PI : 0)) * (moving ? 34 : 2);
                        else if (name.endsWith('.tail'))
                            ey += Math.sin(phase) * 15;
                        else if (name.endsWith('.body'))
                            ex += moving ? 12 : 0;
                        node.setRotationFromEuler(ex, ey, ez);
                    }
                    v.hit = Math.max(0, v.hit - dt);
                    if (v.hit > 0)
                        root.setPosition(x, root.position.y + Math.sin(v.hit * 35) * .08, -y);
                    v.shadow.setPosition(x, GROUND_EFFECT, -y);
                }
                updateWorld(dt) {
                    const s = this.model.state, p = s.player;
                    if (!this.hero)
                        return;
                    this.animateActor(this.hero, p.x, p.y, this.page === 'game' ? p.vx : 0, this.page === 'game' ? p.vy : 0, dt, true);
                    if (this.heroRing) {
                        this.heroRing.setPosition(p.x, GROUND_EFFECT + .01, -p.y);
                        this.heroRing.active = this.page === 'game';
                        const size = 1 + Math.sin(this.time * 3) * .04;
                        this.heroRing.setScale(size, 1, size);
                    }
                    if (this.treasure) {
                        this.treasure.root.active = !s.treasure.taken;
                        this.treasure.root.setPosition(s.treasure.x, .12 + Math.sin(this.time * 2.5) * .08, -s.treasure.y);
                    }
                    if (this.exitRing) {
                        const size = 1 + Math.sin(this.time * 3) * .07;
                        this.exitRing.setScale(size, 1, size);
                    }
                    for (const o of s.obstacles) {
                        const visual = this.obstacles.get(o.id);
                        if (visual) {
                            visual.root.active = !o.destroyed;
                            visual.root.setPosition(o.x, GROUND, -o.y);
                        }
                    }
                    for (const e of s.enemies) {
                        const v = this.enemies.get(e.id);
                        if (!v)
                            continue;
                        v.instance.root.active = e.alive;
                        v.shadow.active = e.alive;
                        if (e.alive) {
                            this.animateActor(v, e.x, e.y, e.vx, e.vy, dt);
                            if (Math.hypot(e.vx, e.vy) < .3)
                                v.instance.root.setRotationFromEuler(0, Math.atan2(e.telegraph.dx, -e.telegraph.dy) * 180 / Math.PI, 0);
                            if (this.page === 'game' && s.phase === 'enemies' && e.action === 'windup') {
                                const charge = Math.min(1, s.enemyTime / .34);
                                v.instance.root.setScale(v.scale * (1 + charge * .08), v.scale * (1 - charge * .16), v.scale * (1 + charge * .08));
                            }
                        }
                        const threat = this.threatNodes.get(e.id);
                        if (threat) {
                            const winding = s.phase === 'enemies' && !e.actionStarted;
                            threat.active = e.alive && this.page === 'game' && (['aiming', 'moving'].includes(s.phase) || winding);
                            const t = e.telegraph, range = this.threatLength(e);
                            threat.setPosition(e.x + t.dx * range * .5, GROUND_EFFECT, -e.y - t.dy * range * .5);
                            threat.setRotationFromEuler(0, Math.atan2(t.dx, -t.dy) * 180 / Math.PI, 0);
                            threat.setScale((t.width || .7) * (winding ? 1 + Math.sin(this.time * 24) * .08 : 1), 1, range);
                        }
                    }
                    const active = new Set();
                    for (const a of s.projectiles) {
                        active.add(a.id);
                        let n = this.arrowNodes.get(a.id);
                        if (!n) {
                            n = ModelLibrary_1.meshNode('Arrow', this.beamMesh(), this.matGold, this.effectsWorld);
                            this.arrowNodes.set(a.id, n);
                        }
                        n.setPosition(a.x, .48, -a.y);
                        n.setScale(.075, 1, .65);
                        n.setRotationFromEuler(0, Math.atan2(a.vx, -a.vy) * 180 / Math.PI, 0);
                    }
                    for (const [id, n] of this.arrowNodes)
                        if (!active.has(id)) {
                            n.destroy();
                            this.arrowNodes.delete(id);
                        }
                }
                threatLength(e) {
                    const t = e.telegraph;
                    let best = t.range;
                    for (const o of this.model.state.obstacles) {
                        if (o.destroyed)
                            continue;
                        let a = 0, b = t.range;
                        const origin = [e.x, e.y], dir = [t.dx, t.dy], lo = [o.x - o.w / 2, o.y - o.h / 2], hi = [o.x + o.w / 2, o.y + o.h / 2];
                        for (let i = 0; i < 2; i++) {
                            if (Math.abs(dir[i]) < 1e-7) {
                                if (origin[i] < lo[i] || origin[i] > hi[i]) {
                                    a = Infinity;
                                    break;
                                }
                            }
                            else {
                                let q = (lo[i] - origin[i]) / dir[i], r = (hi[i] - origin[i]) / dir[i];
                                if (q > r)
                                    [q, r] = [r, q];
                                a = Math.max(a, q);
                                b = Math.min(b, r);
                            }
                        }
                        if (a <= b && a >= 0)
                            best = Math.min(best, a);
                    }
                    return Math.max(.2, best);
                }
                handleEvent(e) {
                    const sounds = { shot: 'launch', bounce: 'stone_hit', board_hit: 'wood_hit', board_break: 'wood_break', cabinet_push: 'cabinet_push', enemy_hit: 'enemy_hit', enemy_down: 'enemy_down', arrow: 'arrow', arrow_blocked: 'arrow_blocked', damage: 'danger', treasure: 'loot', victory: 'win', game_over: 'lose', room_clear: 'loot', tool_used: 'tool' };
                    if (sounds[e.type])
                        this.audio.play(sounds[e.type], e.type === 'bounce' ? .4 : 1);
                    if (['board_break', 'enemy_hit', 'enemy_down', 'cabinet_push', 'arrow_blocked', 'treasure', 'damage'].includes(e.type))
                        this.burst(e.x, e.y, e.type === 'damage' ? 3 : e.type === 'treasure' ? 0 : 2, e.type === 'board_break' ? 14 : 8);
                    if (['enemy_hit', 'board_break', 'cabinet_push', 'damage'].includes(e.type)) {
                        this.shake = Math.max(this.shake, e.type === 'damage' ? .65 : .28);
                        if (e.id && this.enemies.has(e.id))
                            this.enemies.get(e.id).hit = .3;
                    }
                    if (e.type === 'treasure') {
                        this.showTip('宝物到手！去发光出口', 3);
                        this.floatText('宝物 +100', e.x, e.y, GameUI_1.PALETTE.gold);
                    }
                    if (e.type === 'damage') {
                        this.hero.hit = .4;
                        this.floatText(`-${e.amount || 1}`, e.x, e.y, GameUI_1.PALETTE.danger);
                    }
                    if (e.type === 'enemy_hit')
                        this.floatText(`-${e.amount || 1}`, e.x, e.y, GameUI_1.PALETTE.cream);
                    if (e.type === 'arrow_blocked')
                        this.showTip(this.model.state.obstacles.find(o => o.id === e.obstacleId)?.kind === 'cabinet' ? '柜子挡住了箭' : '掩体挡住了箭', 1.5);
                    if (e.type === 'exit_locked')
                        this.showTip('先拿到房间里的宝物', 2);
                    if (e.type === 'room_clear' || e.type === 'victory' || e.type === 'game_over')
                        this.persist();
                }
                showTip(text, seconds = 2) { this.tip = text; this.tipTimer = seconds; }
                floatText(text, x, y, color) {
                    const screen = this.worldCamera.worldToScreen(new cc_1.Vec3(x, 1.6, -y));
                    const ui = new cc_1.Vec3(screen.x / cc_1.view.getScaleX() - 360, screen.y / cc_1.view.getScaleY() - this.height / 2, 0);
                    const l = GameUI_1.label(this.floating, text, 30, ui.x, ui.y, 330, 65, color, true);
                    cc_1.tween(l.node).by(.75, { position: new cc_1.Vec3(0, 85, 0) }, { easing: 'quadOut' }).call(() => l.node.destroy()).start();
                }
                burst(x, y, color, count) {
                    const data = { positions: [0, .12, 0, -.05, 0, 0, .05, 0, 0, 0, 0, .045, 0, 0, -.045], normals: [0, 1, 0, -1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, -1], uvs: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], colors: new Array(20).fill(1), indices: [0, 1, 3, 0, 3, 2, 0, 2, 4, 0, 4, 1, 1, 4, 3, 2, 3, 4] };
                    for (let i = 0; i < count && this.sparks.length < 72; i++) {
                        const n = ModelLibrary_1.meshNode('ImpactShard', data, this.sparkMaterials[color], this.effectsWorld);
                        n.setPosition(x, .35, -y);
                        const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 2;
                        const life = .35 + Math.random() * .35;
                        this.sparks.push({ node: n, vx: Math.cos(a) * s, vy: 2 + Math.random() * 3, vz: Math.sin(a) * s, life, max: life });
                    }
                }
                updateSparks(dt) {
                    for (let i = this.sparks.length - 1; i >= 0; i--) {
                        const s = this.sparks[i];
                        s.life -= dt;
                        if (s.life <= 0) {
                            s.node.destroy();
                            this.sparks.splice(i, 1);
                            continue;
                        }
                        s.vy -= dt * 12;
                        s.node.setPosition(s.node.position.x + s.vx * dt, Math.max(.03, s.node.position.y + s.vy * dt), s.node.position.z + s.vz * dt);
                        s.node.setRotationFromEuler(this.time * 210, this.time * 100, i * 40);
                        s.node.setScale(s.life / s.max, s.life / s.max, s.life / s.max);
                    }
                }
                toast(message) {
                    if (!this.floating) {
                        console.warn(message);
                        return;
                    }
                    this.toastNode?.destroy();
                    const p = GameUI_1.panel(this.floating, 640, 120, 0, -this.height / 2 + 340, GameUI_1.PALETTE.deep, GameUI_1.PALETTE.gold, 20, 252);
                    GameUI_1.label(p, message, 24, 0, 0, 590, 100);
                    this.toastNode = p;
                    this.scheduleOnce(() => { if (p.isValid)
                        p.destroy(); if (this.toastNode === p)
                        this.toastNode = null; }, 3.5);
                }
                onDestroy() {
                    this.persist();
                    this.audio?.dispose();
                    this.ads?.dispose();
                    if (globalThis.__MONSTER_DEN__?.controller === this)
                        delete globalThis.__MONSTER_DEN__;
                    this.env?.dispose();
                    this.characters?.dispose();
                    for (const mat of [this.matShadow, this.matAim, this.matDanger, this.matGold, ...this.sparkMaterials])
                        mat?.destroy();
                    cc_1.input.off(cc_1.Input.EventType.TOUCH_START, this.touchStart, this);
                    cc_1.input.off(cc_1.Input.EventType.TOUCH_MOVE, this.touchMove, this);
                    cc_1.input.off(cc_1.Input.EventType.TOUCH_END, this.touchEnd, this);
                    cc_1.input.off(cc_1.Input.EventType.TOUCH_CANCEL, this.touchCancel, this);
                    cc_1.input.off(cc_1.Input.EventType.MOUSE_DOWN, this.mouseDown, this);
                    cc_1.input.off(cc_1.Input.EventType.MOUSE_MOVE, this.mouseMove, this);
                    cc_1.input.off(cc_1.Input.EventType.MOUSE_UP, this.mouseUp, this);
                    cc_1.game.off(cc_1.Game.EVENT_HIDE, this.onHide, this);
                    cc_1.game.off(cc_1.Game.EVENT_SHOW, this.onShow, this);
                }
            };
            GameMain = __decorate([
                ccclass('GameMain')
            ], GameMain);
            exports_1("GameMain", GameMain);
        }
    };
});

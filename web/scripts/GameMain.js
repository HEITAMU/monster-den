System.register(["cc", "./core/index", "./platform/SaveStore", "./platform/RewardedAds", "./platform/GameAudio", "./AudioCatalog", "./ModelLibrary", "./GameUI", "./AdventureGuide"], function (exports_1, context_1) {
    "use strict";
    var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
        var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
        if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
        else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
        return c > 3 && r && Object.defineProperty(target, key, r), r;
    };
    var cc_1, index_1, SaveStore_1, RewardedAds_1, GameAudio_1, AudioCatalog_1, ModelLibrary_1, GameUI_1, AdventureGuide_1, ccclass, VERSION, GROUND, GROUND_EFFECT, TOOL_COST, GameMain;
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
            },
            function (AdventureGuide_1_1) {
                AdventureGuide_1 = AdventureGuide_1_1;
            }
        ],
        execute: function () {
            ccclass = cc_1._decorator.ccclass;
            VERSION = '0.3.1';
            GROUND = .08, GROUND_EFFECT = .105;
            TOOL_COST = { heavy: 300, grip: 450, return: 450 };
            GameMain = class GameMain extends cc_1.Component {
                constructor() {
                    super(...arguments);
                    this.model = new index_1.GameModel();
                    this.cameraBase = new cc_1.Vec3(0, 21.55, 15.66);
                    this.cameraTarget = new cc_1.Vec3(0, -.45, .66);
                    this.homeWorld = null;
                    this.homeActor = null;
                    this.homeGuard = null;
                    this.enemies = new Map();
                    this.obstacles = new Map();
                    this.treasure = null;
                    this.exitRing = null;
                    this.heroRing = null;
                    this.objectiveRing = null;
                    this.objectiveLabel = null;
                    this.stashVisuals = new Map();
                    this.aimNodes = [];
                    this.aimEnd = null;
                    this.aimCaption = null;
                    this.threatNodes = new Map();
                    this.arrowNodes = new Map();
                    this.sparkMaterials = [];
                    this.sparks = [];
                    this.trails = [];
                    this.impacts = [];
                    this.trailClock = 0;
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
                    this.pointerStart = new cc_1.Vec2();
                    this.pointerMoved = false;
                    this.dragPower = 0;
                    this.lastAim = new cc_1.Vec2(0, 1);
                    this.activeTouchId = null;
                    this.heldMouse = false;
                    this.shake = 0;
                    this.background = false;
                    this.adBusy = false;
                    this.rewardPending = false;
                    this.stick = null;
                    this.stickOffset = new cc_1.Vec2();
                    this.stickEngaged = false;
                    this.hitStop = 0;
                    this.launchKick = 0;
                    this.inputCanvas = null;
                    this.mouseButtonGuard = null;
                    this.joystickTuning = index_1.JOYSTICK_TUNING;
                    this.gameplayTuning = index_1.TUNING;
                    this.overlayPhase = '';
                    this.tipTimer = 0;
                    this.tip = '';
                    this.tipPhase = null;
                    this.tipPriority = 0;
                    this.toastNode = null;
                    this.toolButton = null;
                    this.toolGlow = null;
                    this.stepDots = [];
                    this.tutorialText = null;
                    this.toolNameLabel = null;
                    this.toolStatusLabel = null;
                    this.lastHeight = 0;
                    this.homeHeroRotation = 0;
                    this.saveClock = 0;
                }
                get groundProjection() { return Math.sin(Math.atan2(this.cameraBase.y - this.cameraTarget.y, this.cameraBase.z - this.cameraTarget.z)); }
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
                    this.cameraNode.lookAt(this.cameraTarget);
                    this.worldCamera = this.cameraNode.addComponent(cc_1.Camera);
                    this.worldCamera.projection = cc_1.Camera.ProjectionType.ORTHO;
                    this.worldCamera.near = .1;
                    this.worldCamera.far = 100;
                    this.worldCamera.clearFlags = cc_1.Camera.ClearFlag.SOLID_COLOR;
                    this.worldCamera.clearColor = GameUI_1.rgba('#101f2b');
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
                    this.worldCamera.orthoHeight = 6.15 / (size.width / size.height);
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
                    for (let i = 0; i < 32; i++) {
                        const node = ModelLibrary_1.meshNode('AimMark', ModelLibrary_1.discMesh(.075, .95, .8, 12), this.matAim, this.effectsWorld);
                        node.active = false;
                        this.aimNodes.push(node);
                    }
                    this.aimEnd = ModelLibrary_1.meshNode('AimEndpoint', ModelLibrary_1.ringMesh(.38, .055), this.matAim, this.effectsWorld);
                    this.aimEnd.active = false;
                    this.aimCaption = GameUI_1.label(this.floating, '', 20, 0, 0, 180, 35, GameUI_1.PALETTE.mint, true);
                    this.aimCaption.node.active = false;
                    this.objectiveLabel = GameUI_1.label(this.floating, '', 21, 0, 0, 190, 36, GameUI_1.PALETTE.gold, true);
                    this.objectiveLabel.node.active = false;
                    for (let i = 0; i < 12; i++) {
                        const node = ModelLibrary_1.meshNode('DashWake', ModelLibrary_1.discMesh(1, .38, 0, 16), this.matAim, this.effectsWorld);
                        node.active = false;
                        this.trails.push({ node, life: 0 });
                    }
                    for (let i = 0; i < 4; i++) {
                        const material = ModelLibrary_1.makeMaterial(GameUI_1.rgba('#ffe0a0', 180), false, true, true);
                        const node = ModelLibrary_1.meshNode('ImpactRing', ModelLibrary_1.ringMesh(1, .11, 36), material, this.effectsWorld);
                        node.active = false;
                        this.impacts.push({ node, material, life: 0, size: 1 });
                    }
                }
                instantiate(key, parent, x = 0, y = 0, scale = 1) {
                    const instance = this.env.instantiate(key, parent, scale);
                    instance.root.setPosition(x, key === 'floor' || key === 'trim' ? 0 : GROUND, -y);
                    return instance;
                }
                makeActor(key, x, y, scale, parent = this.actorWorld) {
                    const instance = this.characters.instantiate(key, parent, scale);
                    instance.root.setPosition(x, GROUND, -y);
                    const shadow = ModelLibrary_1.meshNode('ContactShadow', ModelLibrary_1.discMesh(1, .36, 0, 36), this.matShadow, parent);
                    shadow.setPosition(x, GROUND_EFFECT, -y);
                    shadow.setScale(.72 * scale, 1, .5 * scale);
                    return { instance, shadow, scale, hit: 0, phase: Math.random() * 6 };
                }
                renderRoom() {
                    this.tip = '';
                    this.tipTimer = 0;
                    this.tipPhase = null;
                    this.tipPriority = 0;
                    this.clear(this.roomWorld);
                    this.clear(this.actorWorld);
                    this.enemies.clear();
                    this.obstacles.clear();
                    for (const stash of this.stashVisuals.values())
                        stash.label.node.destroy();
                    this.stashVisuals.clear();
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
                    for (const stash of state.stashes) {
                        const instance = this.instantiate('stash', this.roomWorld, stash.x, stash.y, 1);
                        instance.root.active = !stash.taken;
                        const text = GameUI_1.label(this.floating, `额外 +${stash.value}`, 18, 0, 0, 165, 32, GameUI_1.PALETTE.mint, true);
                        text.node.active = false;
                        this.stashVisuals.set(stash.id, { instance, label: text });
                    }
                    this.instantiate('exit', this.roomWorld, state.exit.x, state.exit.y, .8);
                    this.exitRing = ModelLibrary_1.meshNode('ExitGlow', ModelLibrary_1.ringMesh(.8, .12), this.matGold, this.roomWorld);
                    this.exitRing.setPosition(state.exit.x, GROUND_EFFECT, -state.exit.y);
                    this.exitRing.active = state.treasure.taken;
                    this.objectiveRing = ModelLibrary_1.meshNode('ObjectiveGlow', ModelLibrary_1.ringMesh(.67, .065), this.matGold, this.roomWorld);
                    const decor = [[-5.15, -5.2, 'fern', 1.1], [-5.1, 3.8, 'fern', 1.3], [5.1, 2.8, 'fern', 1.3], [5.1, -4.8, 'mushroom', 1.2], [-5.2, 0, 'mushroom', 1], [-4.6, 6.5, 'lantern', 1], [4.7, 6.4, 'lantern', 1]];
                    for (const [x, y, key, s] of decor)
                        if (this.env.has(key))
                            this.instantiate(key, this.roomWorld, x, y, s);
                    this.hero = this.makeActor('hero', state.player.x, state.player.y, .94);
                    this.heroRing = ModelLibrary_1.meshNode('PlayerRing', ModelLibrary_1.ringMesh(.48, .065), this.matAim, this.actorWorld);
                    for (const enemy of state.enemies) {
                        if (!enemy.alive)
                            continue;
                        const key = enemy.kind === 'charger' ? 'boss' : enemy.kind;
                        this.enemies.set(enemy.id, this.makeActor(key, enemy.x, enemy.y, enemy.kind === 'boss' ? 1.04 : enemy.kind === 'charger' ? .65 : .78));
                        const danger = ModelLibrary_1.meshNode('EnemyIntent', this.beamMesh(), this.matDanger, this.effectsWorld);
                        this.threatNodes.set(enemy.id, danger);
                    }
                    for (const trail of this.trails) {
                        trail.life = 0;
                        trail.node.active = false;
                    }
                    for (const impact of this.impacts) {
                        impact.life = 0;
                        impact.node.active = false;
                    }
                    this.phase = '';
                    this.overlayPhase = '';
                    this.shake = 0;
                    this.hitStop = 0;
                    this.launchKick = 0;
                }
                beamMesh() { return { positions: [-.5, 0, -.5, .5, 0, -.5, -.5, 0, .5, .5, 0, .5], normals: [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], colors: [1, 1, 1, .04, 1, 1, 1, .04, 1, 1, 1, .45, 1, 1, 1, .45], uvs: [0, 0, 1, 0, 0, 1, 1, 1], indices: [0, 2, 1, 1, 2, 3] }; }
                showHome() {
                    if (this.adBusy || this.rewardPending)
                        return;
                    this.cancelDrag();
                    this.page = 'home';
                    this.clear(this.hud);
                    this.stick = null;
                    this.clear(this.overlay);
                    this.overlayPhase = '';
                    this.createHomeSet();
                    this.updateSceneVisibility();
                    this.updateMusicScene();
                    for (const t of this.threatNodes.values())
                        t.active = false;
                    const top = this.height / 2, bottom = -top;
                    GameUI_1.label(this.hud, 'MONSTER DEN', 17, 0, top - 79, 640, 32, GameUI_1.PALETTE.mint, true);
                    GameUI_1.label(this.hud, '撞进怪物窝', 56, 0, top - 137, 650, 86, GameUI_1.PALETTE.cream, true);
                    GameUI_1.label(this.hud, '一推，一撞，带宝物回家', 23, 0, top - 197, 630, 45, GameUI_1.PALETTE.gold);
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
                    GameUI_1.label(this.hud, `摇杆试玩 · ${VERSION}`, 17, 0, bottom + 25, 630, 30, '#729caa');
                }
                createHomeSet() {
                    if (this.homeWorld)
                        return;
                    this.homeWorld = new cc_1.Node('CampDiorama');
                    this.homeWorld.parent = this.world;
                    this.instantiate('floor', this.homeWorld, 0, 0, .64);
                    if (this.env.has('trim'))
                        this.instantiate('trim', this.homeWorld, 0, 0, .64);
                    this.instantiate('exit', this.homeWorld, .7, 3.3, 1.15);
                    this.instantiate('treasure', this.homeWorld, 2.1, -1.7, 1.15);
                    this.instantiate('cabinet', this.homeWorld, -2, 1.9, .8);
                    for (const [x, y] of [[-3.1, -2.8], [3.1, 2.4]])
                        this.instantiate('fern', this.homeWorld, x, y, 1.4);
                    for (const [x, y] of [[-3.0, 3.5], [3, 3.4]])
                        this.instantiate('lantern', this.homeWorld, x, y, 1.25);
                    this.instantiate('mushroom', this.homeWorld, 3, -2.9, 1.1);
                    this.homeActor = this.makeActor('hero', -.65, -1.6, 3.2, this.homeWorld);
                    this.homeGuard = this.makeActor('guard', 2.25, 1.3, .95, this.homeWorld);
                }
                updateSceneVisibility() {
                    const active = this.page === 'game';
                    this.roomWorld.active = active;
                    this.actorWorld.active = active;
                    this.effectsWorld.active = active;
                    if (this.homeWorld)
                        this.homeWorld.active = this.page === 'home';
                    if (this.objectiveLabel)
                        this.objectiveLabel.node.active = active;
                    for (const stash of this.stashVisuals.values())
                        stash.label.node.active = false;
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
                    GameUI_1.label(p, '推动左下摇杆，沿路线瞄准\n推得越远，力度越大；松手冲撞\n回到摇杆中心再松手，可以取消\n\n拿主宝箱开门，额外钱袋可以不拿\n停下后，守卫沿红色预告方向行动', 25, 0, 15, 580, 260);
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
                    this.stick = null;
                    this.clear(this.overlay);
                    this.updateSceneVisibility();
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
                    this.updateSceneVisibility();
                    this.drawHud();
                    this.clear(this.overlay);
                    this.persist();
                }
                continueRun() { if (this.adBusy || this.rewardPending)
                    return; this.clickSound(); this.restoreRun(); this.page = 'game'; this.updateMusicScene(); this.renderRoom(); this.updateSceneVisibility(); this.drawHud(); this.clear(this.overlay); }
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
                    GameUI_1.panel(this.hud, 680, 126, 0, top - 83, GameUI_1.PALETTE.deep, '#6a8b92', 20, 246);
                    this.roomLabel = GameUI_1.label(this.hud, '', 30, 0, top - 58, 465, 48, GameUI_1.PALETTE.cream, true);
                    this.hpLabel = GameUI_1.label(this.hud, '', 27, -183, top - 111, 280, 40, GameUI_1.PALETTE.danger, true);
                    this.lootLabel = GameUI_1.label(this.hud, '', 23, 187, top - 111, 260, 40, GameUI_1.PALETTE.gold, true);
                    this.stepDots = [];
                    for (let i = 0; i < 5; i++)
                        this.stepDots.push(GameUI_1.label(this.hud, '◆', 12, -42 + i * 21, top - 111, 22, 26));
                    this.soundButton();
                    GameUI_1.button(this.hud, '营地', -287, top - 42, 95, 43, () => { this.persist(); this.showHome(); }, false);
                    GameUI_1.panel(this.hud, 682, 286, 0, bottom + 171, GameUI_1.PALETTE.deep, '#796b52', 27, 248);
                    this.hintLabel = GameUI_1.label(this.hud, '', 23, 0, bottom + 341, 654, 48, GameUI_1.PALETTE.cream);
                    this.stick = GameUI_1.joystick(this.hud, -136, bottom + 183);
                    this.stickOffset.set(0, 0);
                    this.phaseLabel = GameUI_1.label(this.hud, '', 22, 174, bottom + 250, 272, 42, GameUI_1.PALETTE.muted, true);
                    this.toolButton = GameUI_1.button(this.hud, '使用工具', 174, bottom + 173, 247, 83, () => {
                        this.clickSound();
                        const p = this.model.state.player;
                        if (!this.model.activateTool())
                            this.showTip(p.tool === 'none' ? '带出这间的宝物，就能选一件工具' : p.tool === 'heavy' ? '重撞持续生效：撞击更强，推柜更远' : !p.toolReady ? '这回合已经用过，下一回合恢复' : '冲出去以后，再点击工具', 2);
                        else {
                            this.cancelDrag();
                            this.persist();
                        }
                    }, false);
                    this.toolNameLabel = this.toolButton.getComponentsInChildren(cc_1.Label)[0];
                    this.toolNameLabel.fontSize = 26;
                    this.toolNameLabel.node.setPosition(0, 13, 0);
                    this.toolNameLabel.getComponent(cc_1.UITransform).setContentSize(227, 42);
                    this.toolStatusLabel = GameUI_1.label(this.toolButton, '', 20, 0, -20, 230, 30, GameUI_1.PALETTE.muted);
                    this.toolButton.addComponent(cc_1.UIOpacity);
                    this.toolGlow = GameUI_1.uiNode('ToolReadyGlow', this.toolButton, 247, 83);
                    const glow = this.toolGlow.addComponent(cc_1.Graphics);
                    glow.lineWidth = 3;
                    glow.strokeColor = GameUI_1.rgba(GameUI_1.PALETTE.gold);
                    glow.roundRect(-123, -41, 246, 82, 18);
                    glow.stroke();
                    this.toolGlow.active = false;
                    this.tutorialText = GameUI_1.label(this.hud, '推动摇杆 · 松手冲撞', 24, 175, bottom + 95, 282, 68, GameUI_1.PALETTE.muted);
                    this.updateHud();
                }
                updateHud() {
                    if (this.page !== 'game' || !this.roomLabel)
                        return;
                    const s = this.model.state, p = s.player;
                    this.roomLabel.string = `${s.roomIndex + 1} / 5  ${s.roomName}`;
                    this.hpLabel.string = '♥'.repeat(p.hp) + '♡'.repeat(Math.max(0, p.maxHp - p.hp));
                    this.lootLabel.string = s.treasure.taken ? '出口已开启' : '寻找主宝箱';
                    this.stepDots.forEach((l, i) => { l.color = GameUI_1.rgba(i <= s.roomIndex ? GameUI_1.PALETTE.gold : '#486961'); });
                    const guide = AdventureGuide_1.objectiveGuide(s);
                    if (this.tipPhase && this.tipPhase !== s.phase) {
                        this.tipTimer = 0;
                        this.tipPhase = null;
                        this.tipPriority = 0;
                    }
                    this.hintLabel.string = this.tipTimer > 0 ? this.tip : guide.hint;
                    this.phaseLabel.string = this.dragging ? `力度 ${Math.round(this.dragPower * 100)}%` : s.phase === 'moving' ? '正在冲撞' : s.phase === 'enemies' ? '守卫行动' : p.tool === 'grip' && !p.toolReady ? '再次瞄准' : `第 ${s.turn + 1} 次行动`;
                    const tool = AdventureGuide_1.toolPresentation(p.tool, s.phase, p.toolReady);
                    const activeTool = p.tool === 'grip' || p.tool === 'return', available = tool.active;
                    if (this.toolNameLabel) {
                        this.toolNameLabel.string = tool.name;
                        this.toolNameLabel.color = GameUI_1.rgba(available ? GameUI_1.PALETTE.gold : GameUI_1.PALETTE.cream);
                    }
                    if (this.toolStatusLabel) {
                        this.toolStatusLabel.string = tool.status;
                        this.toolStatusLabel.color = GameUI_1.rgba(available ? GameUI_1.PALETTE.gold : GameUI_1.PALETTE.muted);
                    }
                    if (this.toolGlow)
                        this.toolGlow.active = available;
                    const opacity = this.toolButton?.getComponent(cc_1.UIOpacity);
                    if (opacity)
                        opacity.opacity = available || p.tool === 'heavy' ? 255 : 170;
                    if (this.tutorialText) {
                        this.tutorialText.string = this.dragging ? (this.stickEngaged ? '松手冲撞\n回中可取消' : '回中后松手\n取消这次冲撞') :
                            s.phase === 'enemies' ? '守卫正沿\n红区进攻' : activeTool && available ? '点右侧工具\n改变这次冲撞' : p.tool === 'grip' && !p.toolReady && s.phase === 'aiming' ? '再次推杆重瞄\n守卫暂不行动' : s.treasure.taken ? (s.stashes.some(item => !item.taken) ? '可直接进入出口\n钱袋可以不拿' : '带宝物进出口') : s.roomIndex === 0 ? '推杆瞄准\n松手冲撞' : '停下后，守卫\n沿红区行动';
                        this.tutorialText.color = GameUI_1.rgba(this.dragging || available || s.shots === 0 ? GameUI_1.PALETTE.gold : GameUI_1.PALETTE.muted);
                    }
                    if (this.stick) {
                        this.stick.caption.string = this.dragging ? (this.stickEngaged ? '松手冲撞' : '回中取消') : s.phase === 'aiming' ? '推动瞄准' : '等待落定';
                        this.stick.caption.color = GameUI_1.rgba(this.stickEngaged ? GameUI_1.PALETTE.gold : GameUI_1.PALETTE.muted);
                        this.stick.glow.active = s.phase === 'aiming';
                    }
                }
                showRoomClear() {
                    this.clear(this.overlay);
                    const p = GameUI_1.panel(this.overlay, 665, 760, 0, 0, GameUI_1.PALETTE.deep, '#bfa46c', 28, 252);
                    const next = this.model.state.roomIndex + 1;
                    GameUI_1.label(p, '宝物带出来了', 36, 0, 318, 610, 62, GameUI_1.PALETTE.gold, true);
                    GameUI_1.label(p, `下一间 · ${index_1.ROOMS[next]?.name || '继续探索'}`, 26, 0, 258, 600, 45, GameUI_1.PALETTE.cream, true);
                    GameUI_1.label(p, '选择一件工具，进入下一间', 21, 0, 214, 600, 36, GameUI_1.PALETTE.muted);
                    index_1.TOOLS.forEach((tool, i) => {
                        const y = 112 - i * 164;
                        const current = this.model.state.player.tool === tool.id;
                        const card = GameUI_1.panel(p, 602, 145, 0, y, '#294647', current ? GameUI_1.PALETTE.gold : '#829d7f', 18);
                        GameUI_1.toolIcon(card, tool.id, -245, 6, 76);
                        GameUI_1.label(card, tool.name, 28, -30, 40, 365, 42, GameUI_1.PALETTE.cream, true);
                        if (current)
                            GameUI_1.label(card, '已携带', 21, 227, 40, 115, 35, GameUI_1.PALETTE.gold, true);
                        const mechanism = tool.id === 'heavy' ? '撞击更强 · 反弹较弱' : tool.id === 'grip' ? '冲撞中抓停 · 原地重瞄' : '冲撞中转向 · 朝起点折返';
                        GameUI_1.label(card, mechanism, 20, 44, -1, 480, 32, GameUI_1.PALETTE.muted);
                        GameUI_1.label(card, AdventureGuide_1.nextRoomAdvice(next, tool.id), 20, 44, -40, 480, 32, GameUI_1.PALETTE.mint);
                        card.on(cc_1.Node.EventType.TOUCH_END, (e) => { e.propagationStopped = true; this.advance(tool.id); });
                    });
                    GameUI_1.label(p, '过房恢复 1 点生命', 19, 0, -321, 590, 32, GameUI_1.PALETTE.muted);
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
                    if (tool === 'grip' || tool === 'return')
                        this.showTip(tool === 'grip' ? '冲出去后，点右侧抓停重瞄' : '冲出去后，点右侧回旋折返', 4);
                    else if (this.model.state.stashes.length)
                        this.showTip('额外钱袋可绕路拿，也可以直接过房', 4);
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
                    GameUI_1.label(p, s.stashCount ? `${s.shots} 次出手 · 额外钱袋 ${s.stashCount} 个 +${s.stashValue}` : won ? `${s.shots} 次出手 · 5 处宝物` : '换个落点，或者先挪开挡路的柜子', 23, 0, won ? 88 : 56, 580, 58, GameUI_1.PALETTE.muted);
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
                        this.updateSceneVisibility();
                        this.drawHud();
                    }
                    else if (this.page === 'game')
                        this.showResult(true);
                }
                bindInput() {
                    // Cocos 3.8.8 web synthesizes a touch for every mouse button but does not
                    // mark event.simulate. Filter non-primary DOM buttons before that adapter;
                    // native/WeChat touch input has no DOM and continues through Input below.
                    if (typeof document !== 'undefined' && typeof window !== 'undefined') {
                        this.inputCanvas = document.querySelector('canvas');
                        this.mouseButtonGuard = (event) => { if (event.button !== 0) {
                            event.preventDefault();
                            event.stopImmediatePropagation();
                        } };
                        this.inputCanvas?.addEventListener('mousedown', this.mouseButtonGuard, true);
                        this.inputCanvas?.addEventListener('contextmenu', this.mouseButtonGuard, true);
                        window.addEventListener('mouseup', this.mouseButtonGuard, true);
                    }
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
                validInput(location) {
                    if (!this.ready || this.page !== 'game' || this.background || this.adBusy || this.rewardPending || this.overlay.children.length || !this.stick)
                        return false;
                    const x = location.x / cc_1.view.getScaleX() - 360 - this.stick.root.position.x, y = location.y / cc_1.view.getScaleY() - this.height / 2 - this.stick.root.position.y;
                    return Math.hypot(x, y) <= 111;
                }
                begin(location) {
                    if (this.dragging || !this.validInput(location) || this.model.state.phase !== 'aiming')
                        return;
                    void this.audio.unlock().then(() => this.audio.startMusic());
                    this.dragging = true;
                    this.dragStart.set((this.stick.root.position.x + 360) * cc_1.view.getScaleX(), (this.stick.root.position.y + this.height / 2) * cc_1.view.getScaleY());
                    this.dragNow.set(location);
                    this.pointerStart.set(location);
                    this.pointerMoved = false;
                    this.dragPower = 0;
                    this.stickEngaged = false;
                    this.move(location);
                }
                move(location) {
                    if (!this.dragging)
                        return;
                    this.dragNow.set(location);
                    const dx = (location.x - this.dragStart.x) / cc_1.view.getScaleX(), dy = (location.y - this.dragStart.y) / cc_1.view.getScaleY(), distance = Math.hypot(dx, dy);
                    const { deadZone, travel } = this.joystickTuning, scale = distance > travel ? travel / distance : 1;
                    this.stickOffset.set(dx * scale, dy * scale);
                    // Off-centre taps and tiny finger jitter must not release an accidental shot.
                    const travelled = Math.hypot((location.x - this.pointerStart.x) / cc_1.view.getScaleX(), (location.y - this.pointerStart.y) / cc_1.view.getScaleY());
                    if (travelled >= 6)
                        this.pointerMoved = true;
                    this.stickEngaged = distance > deadZone && this.pointerMoved;
                    this.dragPower = this.stickEngaged ? Math.max(0, Math.min(1, (distance - deadZone) / (travel - deadZone))) : 0;
                    this.lastAim.set(dx, dy / this.groundProjection);
                    this.showAim();
                }
                release() {
                    if (!this.dragging)
                        return;
                    const fire = this.stickEngaged, power = this.dragPower;
                    this.dragging = false;
                    this.stickEngaged = false;
                    this.pointerMoved = false;
                    this.clearAim();
                    if (fire && this.model.shoot({ x: this.lastAim.x, y: this.lastAim.y }, power))
                        this.persist();
                    this.dragPower = 0;
                }
                touchStart(e) { if (e.simulate || this.activeTouchId !== null || this.heldMouse)
                    return; const id = e.getID(); if (id === null)
                    return; this.begin(e.getLocation()); if (this.dragging)
                    this.activeTouchId = id; }
                touchMove(e) { if (e.simulate || this.activeTouchId === null || e.getID() !== this.activeTouchId)
                    return; this.move(e.getLocation()); }
                touchEnd(e) { if (e.simulate || this.activeTouchId === null || e.getID() !== this.activeTouchId)
                    return; this.move(e.getLocation()); this.activeTouchId = null; this.release(); }
                touchCancel(e) { if (e.simulate || this.activeTouchId === null || e.getID() !== this.activeTouchId)
                    return; this.cancelDrag(); }
                cancelDrag() { this.activeTouchId = null; this.heldMouse = false; this.dragging = false; this.stickEngaged = false; this.pointerMoved = false; this.dragPower = 0; this.clearAim(); }
                // On backends that mark simulated touch, the primary mouse path owns it here.
                // The DOM guard above also covers 3.8.8 web's unmarked simulated events.
                mouseDown(e) { if (e.getButton() !== 0 || this.activeTouchId !== null)
                    return; this.begin(e.getLocation()); this.heldMouse = this.dragging; }
                mouseMove(e) { if (this.heldMouse)
                    this.move(e.getLocation()); }
                mouseUp(e) { if (!this.heldMouse)
                    return; this.move(e.getLocation()); this.heldMouse = false; this.release(); }
                onHide() { this.background = true; this.cancelDrag(); this.persist(); }
                onShow() { this.background = false; }
                showAim() {
                    this.clearAim();
                    if (!this.stickEngaged)
                        return;
                    const preview = this.model.aim(this.lastAim.x, this.lastAim.y, this.dragPower);
                    const cumulative = [0];
                    for (let i = 1; i < preview.points.length; i++)
                        cumulative.push(cumulative[i - 1] + Math.hypot(preview.points[i].x - preview.points[i - 1].x, preview.points[i].y - preview.points[i - 1].y));
                    const total = cumulative[cumulative.length - 1], count = Math.min(this.aimNodes.length, Math.max(2, Math.ceil(total / .34) + 1));
                    let segment = 1;
                    for (let i = 0; i < count && preview.points.length > 1; i++) {
                        const distance = total * i / (count - 1);
                        while (segment < cumulative.length - 1 && cumulative[segment] < distance)
                            segment++;
                        const a = preview.points[segment - 1], b = preview.points[segment], t = (distance - cumulative[segment - 1]) / (cumulative[segment] - cumulative[segment - 1] || 1);
                        const n = this.aimNodes[i];
                        n.active = true;
                        n.setPosition(a.x + (b.x - a.x) * t, GROUND_EFFECT + .01, -a.y - (b.y - a.y) * t);
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
                        this.cancelDrag();
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
                        if (this.hitStop > 0)
                            this.hitStop = Math.max(0, this.hitStop - dt);
                        else
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
                    this.launchKick = Math.max(0, this.launchKick - dt * 5);
                    this.updateWorld(dt);
                    this.updateSparks(dt);
                    this.updateStick(dt);
                    this.tipTimer = Math.max(0, this.tipTimer - dt);
                    this.shake = Math.max(0, this.shake - dt * 2.5);
                    this.cameraNode.setPosition(this.cameraBase.x + Math.sin(this.time * 75) * this.shake * .085, this.cameraBase.y, this.cameraBase.z + Math.cos(this.time * 67) * this.shake * .06);
                }
                updateStick(dt) {
                    if (!this.stick || this.page !== 'game')
                        return;
                    if (!this.dragging) {
                        const fade = Math.exp(-dt * 24);
                        this.stickOffset.multiplyScalar(fade);
                        if (this.stickOffset.length() < .05)
                            this.stickOffset.set(0, 0);
                    }
                    this.stick.thumb.setPosition(this.stickOffset.x, this.stickOffset.y, 0);
                    const angle = this.stickEngaged ? Math.atan2(this.stickOffset.y, this.stickOffset.x) * 180 / Math.PI - 90 : 0;
                    this.stick.thumb.setRotationFromEuler(0, 0, angle);
                    const g = this.stick.meter;
                    g.clear();
                    if (this.stickEngaged) {
                        g.lineWidth = 5;
                        g.strokeColor = GameUI_1.rgba(this.dragPower > .9 ? GameUI_1.PALETTE.gold : GameUI_1.PALETTE.mint, 240);
                        g.arc(0, 0, 101, Math.PI / 2, Math.PI / 2 - this.dragPower * Math.PI * 2, true);
                        g.stroke();
                    }
                    const opacity = this.stick.root.getComponent(cc_1.UIOpacity) || this.stick.root.addComponent(cc_1.UIOpacity);
                    opacity.opacity = this.model.state.phase === 'aiming' ? 255 : 165;
                    if (this.stick.glow.active)
                        this.stick.glow.setScale(1 + Math.sin(this.time * 5) * .008, 1 + Math.sin(this.time * 5) * .008, 1);
                }
                animateActor(v, x, y, vx, vy, dt, isHero = false) {
                    const speed = Math.hypot(vx, vy), moving = speed > .3, phase = this.time * (moving ? 14 : 3) + v.phase;
                    const root = v.instance.root;
                    root.setPosition(x, GROUND + (moving ? .07 + Math.abs(Math.sin(phase)) * .04 : .025 + Math.sin(phase) * .025), -y);
                    if (moving) {
                        const target = Math.atan2(vx, -vy) * 180 / Math.PI, delta = ((target - root.eulerAngles.y + 540) % 360) - 180;
                        root.setRotationFromEuler(0, root.eulerAngles.y + delta * (1 - Math.exp(-dt * 30)), 0);
                    }
                    else if (this.page === 'home' && isHero)
                        root.setRotationFromEuler(0, Math.sin(this.time * .4) * 12, 0);
                    else if (isHero && this.dragging && this.stickEngaged) {
                        const target = Math.atan2(this.lastAim.x, -this.lastAim.y) * 180 / Math.PI, delta = ((target - root.eulerAngles.y + 540) % 360) - 180;
                        root.setRotationFromEuler(0, root.eulerAngles.y + delta * (1 - Math.exp(-dt * 22)), 0);
                    }
                    const squat = isHero && this.dragging ? 1 - this.dragPower * .12 : 1;
                    const kick = isHero ? this.launchKick : 0;
                    root.setScale(v.scale * (1 + (1 - squat) * .3 - kick * .07), v.scale * (squat - kick * .09), v.scale * (1 + (1 - squat) * .3 + kick * .21));
                    for (const [name, node] of v.instance.parts) {
                        const base = v.instance.baseEuler.get(name);
                        let ex = base.x, ey = base.y, ez = base.z;
                        if (name.endsWith('.head')) {
                            ex += moving ? -12 : Math.sin(phase) * 3;
                            ey += Math.sin(phase * .6) * 3;
                        }
                        else if (name.includes('.arm.')) {
                            ex += isHero && moving ? -36 + Math.sin(phase) * 7 : Math.sin(phase + (name.endsWith('L') ? 0 : Math.PI)) * (moving ? 32 : 4);
                            ez += (name.endsWith('L') ? 1 : -1) * (moving ? 10 : 0);
                        }
                        else if (name.includes('.leg.'))
                            ex += Math.sin(phase + (name.endsWith('L') ? Math.PI : 0)) * (moving ? (isHero ? 18 : 34) : 2);
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
                    if (this.page === 'home' && this.homeActor) {
                        this.animateActor(this.homeActor, -.65, -1.6, 0, 0, dt, true);
                        if (this.homeGuard)
                            this.animateActor(this.homeGuard, 2.25, 1.3, 0, 0, dt);
                        return;
                    }
                    const s = this.model.state, p = s.player;
                    if (!this.hero)
                        return;
                    this.animateActor(this.hero, p.x, p.y, this.page === 'game' ? p.vx : 0, this.page === 'game' ? p.vy : 0, dt, true);
                    this.trailClock += dt;
                    if (this.page === 'game' && s.phase === 'moving' && Math.hypot(p.vx, p.vy) > 2.5 && this.trailClock > .045) {
                        this.trailClock = 0;
                        const trail = this.trails.find(t => t.life <= 0);
                        if (trail) {
                            trail.life = .28;
                            trail.node.active = true;
                            trail.node.setPosition(p.x, GROUND_EFFECT + .006, -p.y);
                            trail.node.setRotationFromEuler(0, Math.atan2(p.vx, -p.vy) * 180 / Math.PI, 0);
                        }
                    }
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
                        this.exitRing.active = s.treasure.taken;
                        const size = 1 + Math.sin(this.time * 3) * .07;
                        this.exitRing.setScale(size, 1, size);
                    }
                    const guide = AdventureGuide_1.objectiveGuide(s), guideVisible = this.page === 'game' && this.overlay.children.length === 0 && !['room_clear', 'victory', 'game_over'].includes(s.phase);
                    if (this.objectiveRing) {
                        this.objectiveRing.active = guideVisible && guide.stage !== 'exit';
                        this.objectiveRing.setPosition(guide.target.x, GROUND_EFFECT + .006, -guide.target.y);
                        const size = 1 + Math.sin(this.time * 3) * .055;
                        this.objectiveRing.setScale(size, 1, size);
                    }
                    if (this.objectiveLabel) {
                        this.objectiveLabel.string = guide.title;
                        const projected = this.placeWorldLabel(this.objectiveLabel, guide.target.x, guide.target.y, guide.stage === 'exit' ? 2.25 : 1.2, 12);
                        const aimOverlap = this.dragging && this.aimCaption?.node.active && Math.hypot(this.objectiveLabel.node.position.x - this.aimCaption.node.position.x, this.objectiveLabel.node.position.y - this.aimCaption.node.position.y) < 85;
                        this.objectiveLabel.node.active = guideVisible && projected && !aimOverlap;
                    }
                    for (const stash of s.stashes) {
                        const visual = this.stashVisuals.get(stash.id);
                        if (!visual)
                            continue;
                        visual.instance.root.active = !stash.taken;
                        visual.instance.root.setPosition(stash.x, GROUND + Math.sin(this.time * 2.6) * .025, -stash.y);
                        const projected = this.placeWorldLabel(visual.label, stash.x, stash.y, 1.05, 8);
                        visual.label.node.active = guideVisible && !stash.taken && projected;
                    }
                    for (const o of s.obstacles) {
                        const visual = this.obstacles.get(o.id);
                        if (visual) {
                            visual.root.active = !o.destroyed;
                            visual.root.setPosition(o.x, GROUND, -o.y);
                            if (o.kind === 'board')
                                visual.root.setRotationFromEuler(0, 0, o.hp < o.maxHp ? 5 : 0);
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
                    const sounds = { shot: 'launch', bounce: 'stone_hit', board_hit: 'wood_hit', board_break: 'wood_break', cabinet_push: 'cabinet_push', enemy_hit: 'enemy_hit', enemy_down: 'enemy_down', arrow: 'arrow', arrow_blocked: 'arrow_blocked', damage: 'danger', treasure: 'loot', stash: 'loot', victory: 'win', game_over: 'lose', room_clear: 'loot', tool_used: 'tool' };
                    if (sounds[e.type])
                        this.audio.play(sounds[e.type], e.type === 'bounce' ? .4 : 1);
                    if (e.type === 'shot') {
                        this.launchKick = 1;
                        this.burst(e.x, e.y, 1, 4);
                    }
                    if (['board_break', 'enemy_hit', 'enemy_down', 'cabinet_push', 'arrow_blocked', 'treasure', 'stash', 'damage'].includes(e.type))
                        this.burst(e.x, e.y, e.type === 'damage' ? 3 : ['treasure', 'stash'].includes(e.type) ? 0 : 2, e.type === 'board_break' ? 14 : 8);
                    if (['enemy_hit', 'board_break', 'cabinet_push', 'damage'].includes(e.type)) {
                        this.shake = Math.max(this.shake, e.type === 'damage' ? .65 : .34);
                        this.hitStop = Math.max(this.hitStop, e.type === 'damage' ? .04 : .025);
                        const impact = this.impacts.find(i => i.life <= 0);
                        if (impact) {
                            impact.life = .24;
                            impact.size = e.type === 'cabinet_push' ? .7 : .5;
                            impact.node.active = true;
                            impact.node.setPosition(e.x, GROUND_EFFECT + .02, -e.y);
                        }
                        if (e.type === 'enemy_hit' && e.id && this.enemies.has(e.id))
                            this.enemies.get(e.id).hit = .3;
                    }
                    if (e.type === 'treasure') {
                        this.showTip('宝物到手！去发光出口', 3, null, 3);
                        this.floatText('宝物 +100', e.x, e.y, GameUI_1.PALETTE.gold);
                    }
                    if (e.type === 'stash') {
                        this.showTip(`额外收获 +${e.amount || 0}，${this.model.state.treasure.taken ? '可以前往出口' : '继续找主宝箱'}`, 2.4, null, 3);
                        this.floatText(`额外金币 +${e.amount || 0}`, e.x, e.y, GameUI_1.PALETTE.mint);
                        this.persist();
                    }
                    if (e.type === 'damage') {
                        this.hero.hit = .4;
                        const attacker = this.model.state.enemies.find(enemy => enemy.id === e.id);
                        const reason = attacker?.kind === 'archer' ? '中箭' : attacker?.kind === 'boss' ? '窝主冲撞' : attacker ? '被冲撞' : '受伤';
                        this.floatText(`${reason} −${e.amount || 1}`, e.x, e.y, GameUI_1.PALETTE.danger);
                        this.showTip(attacker?.kind === 'archer' ? (this.model.state.roomIndex === 1 ? '弩箭命中：试着让柜子挡住箭路' : '弩箭命中：调整落点，避开红色箭路') : '冲撞命中：下次避开红色预告路线', 2.3, null, 4);
                    }
                    if (e.type === 'tool_used')
                        this.showTip(e.tool === 'grip' ? '已经抓停，再次推杆；守卫暂不行动' : '正在向本次出发点折返', 2.5, e.tool === 'grip' ? 'aiming' : 'moving', 2);
                    if (e.type === 'enemy_hit')
                        this.floatText(`-${e.amount || 1}`, e.x, e.y, GameUI_1.PALETTE.cream);
                    if (e.type === 'board_hit') {
                        this.burst(e.x, e.y, 2, 5);
                        this.shake = Math.max(this.shake, .14);
                        if (!this.model.state.obstacles.find(o => o.id === e.id)?.destroyed)
                            this.floatText('木栏松动', e.x, e.y, GameUI_1.PALETTE.gold);
                    }
                    if (e.type === 'arrow_blocked')
                        this.showTip(this.model.state.obstacles.find(o => o.id === e.obstacleId)?.kind === 'cabinet' ? '柜子挡住了箭' : '掩体挡住了箭', 1.5, null, 0);
                    if (e.type === 'exit_locked')
                        this.showTip('先拿到房间里的宝物', 2);
                    if (e.type === 'room_clear' || e.type === 'victory' || e.type === 'game_over')
                        this.persist();
                }
                showTip(text, seconds = 2, phase = null, priority = 1) {
                    if (this.tipTimer > 0 && this.tipPhase === phase && priority < this.tipPriority)
                        return;
                    this.tip = text;
                    this.tipTimer = seconds;
                    this.tipPhase = phase;
                    this.tipPriority = priority;
                }
                placeWorldLabel(text, x, y, height, offset = 0) {
                    const screen = this.worldCamera.worldToScreen(new cc_1.Vec3(x, height, -y));
                    const xx = screen.x / cc_1.view.getScaleX() - 360, yy = screen.y / cc_1.view.getScaleY() - this.height / 2 + offset;
                    if (!Number.isFinite(xx) || !Number.isFinite(yy))
                        return false;
                    text.node.setPosition(Math.max(-265, Math.min(265, xx)), yy, 0);
                    return true;
                }
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
                    for (const trail of this.trails) {
                        if (trail.life <= 0)
                            continue;
                        trail.life = Math.max(0, trail.life - dt);
                        const fade = trail.life / .28;
                        trail.node.active = fade > 0;
                        trail.node.setScale(.23 * fade, 1, .48 * fade);
                    }
                    for (const impact of this.impacts) {
                        if (impact.life <= 0)
                            continue;
                        impact.life = Math.max(0, impact.life - dt);
                        const fade = impact.life / .24, radius = impact.size * (2.4 - 1.4 * fade);
                        impact.node.active = fade > 0;
                        impact.node.setScale(radius, 1, radius);
                        impact.material.setProperty('mainColor', GameUI_1.rgba('#ffe0a0', Math.round(fade * 210)));
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
                    if (this.mouseButtonGuard) {
                        this.inputCanvas?.removeEventListener('mousedown', this.mouseButtonGuard, true);
                        this.inputCanvas?.removeEventListener('contextmenu', this.mouseButtonGuard, true);
                        if (typeof window !== 'undefined')
                            window.removeEventListener('mouseup', this.mouseButtonGuard, true);
                    }
                    this.inputCanvas = null;
                    this.mouseButtonGuard = null;
                    if (globalThis.__MONSTER_DEN__?.controller === this)
                        delete globalThis.__MONSTER_DEN__;
                    this.env?.dispose();
                    this.characters?.dispose();
                    for (const mat of [this.matShadow, this.matAim, this.matDanger, this.matGold, ...this.sparkMaterials, ...this.impacts.map(i => i.material)])
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

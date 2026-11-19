System.register(["cc", "./MeshCodec", "./ResourceBundles"], function (exports_1, context_1) {
    "use strict";
    var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
        var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
        if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
        else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
        return c > 3 && r && Object.defineProperty(target, key, r), r;
    };
    var cc_1, MeshCodec_1, ResourceBundles_1, editorEffects, OwnedMesh, ModelLibrary;
    var __moduleName = context_1 && context_1.id;
    async function loadGameJson(path) {
        if (globalThis.__monsterDenRuntime) {
            const version = globalThis.__monsterDenRuntime.version;
            const response = await fetch(`./resources/${path}.json${version ? `?v=${encodeURIComponent(version)}` : ''}`);
            if (!response.ok)
                throw new Error(`Resource unavailable: ${path}`);
            return response.json();
        }
        const [bundleName, ...relative] = path.split('/');
        const bundle = await ResourceBundles_1.loadGameBundle(bundleName);
        return new Promise((resolve, reject) => bundle.load(relative.join('/'), cc_1.JsonAsset, (err, asset) => err ? reject(err) : resolve(asset.json)));
    }
    exports_1("loadGameJson", loadGameJson);
    async function loadGameEffects() {
        if (globalThis.__monsterDenRuntime)
            return;
        await Promise.all(['monster-den-lit', 'monster-den-unlit'].map(name => new Promise((resolve, reject) => {
            cc_1.resources.load(`effects/${name}`, cc_1.EffectAsset, (err, asset) => { if (err)
                reject(err);
            else {
                editorEffects[name] = asset;
                resolve();
            } });
        })));
    }
    exports_1("loadGameEffects", loadGameEffects);
    function makeMaterial(color, lit = true, alpha = false, vertexColors = false, emission = 0) {
        const material = new cc_1.Material();
        const effectAsset = editorEffects[lit ? 'monster-den-lit' : 'monster-den-unlit'];
        // Base Material.overridePipelineStates is intentionally a no-op in 3.8.8.
        // Supply overrides while initializing the shared asset so real GPU passes
        // retain transparent blending and do not write invisible depth.
        material.initialize({ ...(effectAsset ? { effectAsset } : { effectName: lit ? 'monster-den/lit' : 'monster-den/unlit' }), defines: { USE_VERTEX_COLOR: vertexColors, USE_TEXTURE: false },
            ...(alpha ? { states: {
                    rasterizerState: { cullMode: cc_1.gfx.CullMode.NONE },
                    depthStencilState: { depthTest: true, depthWrite: false },
                    blendState: { targets: [{ blend: true, blendSrc: cc_1.gfx.BlendFactor.SRC_ALPHA, blendDst: cc_1.gfx.BlendFactor.ONE_MINUS_SRC_ALPHA, blendSrcAlpha: cc_1.gfx.BlendFactor.ONE, blendDstAlpha: cc_1.gfx.BlendFactor.ONE_MINUS_SRC_ALPHA }] },
                } } : {}),
        });
        material.setProperty('mainColor', color);
        material.setProperty('surfaceParams', new cc_1.Vec4(.78, .45, emission, 0));
        return material;
    }
    exports_1("makeMaterial", makeMaterial);
    function meshNode(name, data, material, parent) {
        const node = new cc_1.Node(name);
        const renderer = node.addComponent(cc_1.MeshRenderer);
        const mesh = cc_1.utils.createMesh(data);
        renderer.mesh = mesh;
        const owner = node.addComponent(OwnedMesh);
        owner.mesh = mesh;
        // Hidden nodes can be destroyed before their components ever load; Cocos
        // skips their onDestroy hook. Node destruction still releases their buffers.
        node.once(cc_1.Node.EventType.NODE_DESTROYED, owner.release, owner);
        renderer.setMaterial(material, 0);
        if (parent)
            node.parent = parent;
        return node;
    }
    exports_1("meshNode", meshNode);
    function discMesh(radius = 1, innerAlpha = .22, outerAlpha = 0, segments = 40) {
        const positions = [0, 0, 0], normals = [0, 1, 0], colors = [1, 1, 1, innerAlpha], uvs = [.5, .5], indices = [];
        for (let i = 0; i <= segments; i++) {
            const a = i / segments * Math.PI * 2;
            positions.push(Math.cos(a) * radius, 0, Math.sin(a) * radius);
            normals.push(0, 1, 0);
            colors.push(1, 1, 1, outerAlpha);
            uvs.push(Math.cos(a) * .5 + .5, Math.sin(a) * .5 + .5);
            if (i)
                indices.push(0, i + 1, i);
        }
        return { positions, normals, colors, uvs, indices };
    }
    exports_1("discMesh", discMesh);
    function ringMesh(radius = 1, width = .07, segments = 48) {
        const positions = [], normals = [], colors = [], uvs = [], indices = [];
        for (let i = 0; i <= segments; i++)
            for (let j = 0; j < 2; j++) {
                const a = i / segments * Math.PI * 2, r = radius - j * width;
                positions.push(Math.cos(a) * r, 0, Math.sin(a) * r);
                normals.push(0, 1, 0);
                colors.push(1, 1, 1, j ? .8 : .15);
                uvs.push(i / segments, j);
            }
        for (let i = 0; i < segments; i++) {
            const a = i * 2;
            indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
        }
        return { positions, normals, colors, uvs, indices };
    }
    exports_1("ringMesh", ringMesh);
    return {
        setters: [
            function (cc_1_1) {
                cc_1 = cc_1_1;
            },
            function (MeshCodec_1_1) {
                MeshCodec_1 = MeshCodec_1_1;
            },
            function (ResourceBundles_1_1) {
                ResourceBundles_1 = ResourceBundles_1_1;
            }
        ],
        execute: function () {
            editorEffects = {};
            OwnedMesh = class OwnedMesh extends cc_1.Component {
                constructor() {
                    super(...arguments);
                    this.mesh = null;
                }
                release() { this.mesh?.destroy(); this.mesh = null; }
                onDestroy() { this.release(); }
            };
            OwnedMesh = __decorate([
                cc_1._decorator.ccclass('MonsterDenOwnedMesh')
            ], OwnedMesh);
            /** Actual Blender meshes, with shared mesh buffers and independent joint nodes. */
            ModelLibrary = class ModelLibrary {
                constructor(data) {
                    this.prefabs = {};
                    this.meshes = new Map();
                    if (data?.version !== 1 || data.coordinateSystem !== 'Y_UP')
                        throw new Error('Unsupported model library');
                    this.prefabs = data.prefabs;
                    this.material = makeMaterial(new cc_1.Color(255, 255, 255, 255), true, false, true);
                    for (const [key, prefab] of Object.entries(this.prefabs))
                        prefab.nodes.forEach((part, i) => { if (part.mesh)
                            this.meshes.set(`${key}:${i}`, cc_1.utils.createMesh(MeshCodec_1.decodeMesh(part.mesh))); });
                }
                has(name) { return !!this.prefabs[name]; }
                dispose() {
                    for (const mesh of this.meshes.values())
                        mesh.destroy();
                    this.meshes.clear();
                    this.material.destroy();
                    this.prefabs = {};
                }
                instantiate(key, parent, scale = 1) {
                    const prefab = this.prefabs[key];
                    if (!prefab)
                        throw new Error(`Missing 3D prefab: ${key}`);
                    const root = new cc_1.Node(key);
                    root.parent = parent;
                    root.setScale(scale, scale, scale);
                    const parts = new Map(), baseEuler = new Map(), basePosition = new Map();
                    const nodes = prefab.nodes.map((part, i) => {
                        const node = new cc_1.Node(part.name);
                        node.setPosition(...part.position);
                        node.setRotation(new cc_1.Quat(...part.rotation));
                        node.setScale(...part.scale);
                        const mesh = this.meshes.get(`${key}:${i}`);
                        if (mesh) {
                            const renderer = node.addComponent(cc_1.MeshRenderer);
                            renderer.mesh = mesh;
                            renderer.setMaterial(this.material, 0);
                        }
                        parts.set(part.name, node);
                        baseEuler.set(part.name, node.eulerAngles.clone());
                        basePosition.set(part.name, node.position.clone());
                        return node;
                    });
                    prefab.nodes.forEach((part, i) => { nodes[i].parent = part.parent < 0 ? root : nodes[part.parent]; });
                    return { root, parts, baseEuler, basePosition };
                }
                fitFootprint(instance, key, width, depth, heightScale = 1) {
                    const b = this.prefabs[key].bounds;
                    instance.root.setScale(width / (b.max[0] - b.min[0]), heightScale, depth / (b.max[2] - b.min[2]));
                }
            };
            exports_1("ModelLibrary", ModelLibrary);
        }
    };
});

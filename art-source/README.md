# 原创美术源文件与重建说明

## 来源记录

本目录保留《撞进怪物窝》本轮制作的可编辑 Blender 源文件。运行时使用的是由这些文件对应脚本生成的三维网格、法线和顶点颜色，预览渲染图没有作为角色或场景的平面贴片进入游戏。

| 内容 | 可编辑来源 / 生成脚本 | 运行时导出 | 来源说明 |
| --- | --- | --- | --- |
| 小獾主角、菌菇守卫、长嘴蜥弩手、甲壳兽 | `characters.blend`；`tools/make-characters.py` | `assets/resources/models/characters.json` | 为本项目编写的网格轮廓、五官、护具、武器和配色；本地 Blender 建模，无导入的第三方角色模型 |
| 工坊场景、石墙、柜子、木栏、植物、宝物和出口等 | `environment.blend`；`tools/make-environment.py` | `assets/resources/models/environment.json` | 为本项目编写的程序建模脚本、雕刻式轮廓与材质；无下载的模型或贴图包 |
| 材质与导出数据 | `tools/export_mesh_library.py`；`tools/build-effect-assets.cjs` | 网格顶点颜色与 Cocos `.effect` 文件 | 本项目代码；颜色来自 Blender 材质的 `diffuse_color`，不依赖外部纹理文件 |
| 音效与环境音乐 | `assets/scripts/platform/GameAudio.ts` | 浏览器 AudioBuffer / 微信本机生成的 WAV 缓存 | 本项目程序合成的音符、包络与噪声组合，没有采样第三方录音 |

当前上述运行时美术文件没有使用外部素材市场资源、第三方角色立绘、摄影图库图片或付费生成服务的输出。项目开发工具和引擎依赖不属于本表的原创美术范围，应保留它们各自的许可证与声明。

**本说明记录来源，不声明 CC0、公有领域，也不单独向公众授予素材再分发许可。** 使用、修改和再分发应遵循仓库所有者实际选定的许可证；若仓库未指定许可证，不应把“原创制作”误读为“任何人可任意取用”。后续加入外部模型、字体、音乐或贴图时，应逐项记录原始来源、作者、许可证文件和可使用范围。

## 重建

本轮实际使用 Blender 4.3.2。以下命令从仓库根目录运行，会覆盖对应生成的 `.blend` 和 `.json`；手动修改过源文件时，应先保存需要保留的版本。

```sh
blender --background --python tools/make-characters.py
blender --background --python tools/make-environment.py
```

只重建并检查主角的命令如下。注意它会把 `characters.json` 临时导出为仅含主角，完整交付前必须再运行上面的完整角色命令。

```sh
blender --background --python tools/make-characters.py -- --hero-only
```

角色预览输出为仓库上一级 `art-preview/hero-preview.png`、`art-preview/character-lineup.png`；环境预览为 `art-preview/environment-review.png`。这些图由实际 Blender 模型和灯光渲染，用于检查轮廓、穿插、比例与材质，属于检查用输出，不是游戏运行资源。游戏内光照由 Cocos 材质决定，不会与 Blender 摄影棚渲染逐像素一致。

角色完整导出的本轮规模为：主角 8,548 三角面、守卫 6,318 三角面、弩手 5,578 三角面、窝主 7,722 三角面，共 28,166 三角面。修改几何或导出配置后，三角面数应重新统计。

## 坐标、关节与材质约定

- Blender 源模型为 Z 向上、朝向 -Y，脚底约为 Z=0。
- 导出为 Cocos 的 Y 向上、朝向 +Z；换算为 `(x, y, z) → (x, z, -y)`。
- 角色根节点名固定为 `hero`、`guard`、`archer`、`boss`。Blender 源文件中展示排列所用的根节点位移会被导出器移除。
- 可动关节采用 Empty，并标记 `md_joint=true`。节点名带角色前缀，例如 `hero.head`、`hero.arm.L`、`hero.leg.R`、`archer.weapon`、`boss.shell`。
- 每个关节下面的可见网格会合并成一个顶点着色网格。修改父子关系时需保留正确世界坐标，动画枢轴应位于头颈、肩、髋等实际关节位置。
- 导出 JSON 的每个节点包含父节点索引、局部位移、四元数 `[x,y,z,w]`、缩放，以及可选网格的 positions / normals / colors / uvs / indices。UV 当前为空白占位；材质色不是图片。
- 角色脚本中的十六进制配色先转为线性 RGB，再赋给 `diffuse_color`。导出器读取材质色，保留有限的几何细节色差；金属感、粗糙度和摄影棚灯光不作为图片烘焙进角色。
- 视觉网格与玩法碰撞范围分开维护。改变体型、柜子尺寸或木栏长度后，还需核对 Cocos 展示比例与 `core` 中的碰撞尺寸，不能只检查渲染图。

程序化生成并不免除视觉检查。重建后应检查正面、斜侧面、游戏实际俯视角，以及头部、手臂、腿部转动时的接缝和穿插，再发布更新后的运行网格。

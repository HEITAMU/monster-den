# 原创美术源文件与重建说明

更新日期：2026-11-19（北京时间）。本说明对应 **0.2.0 摇杆试玩候选**的角色与环境资源；运行验收仍须核对对应源码及资源哈希，不能沿用 0.1.1 的旧截图或测试结果。

## 来源记录

本目录保留《撞进怪物窝》本轮制作的可编辑 Blender 源文件。运行时使用的是由这些文件对应脚本生成的三维网格、法线和顶点颜色，预览渲染图没有作为角色或场景的平面贴片进入游戏。

| 内容 | 可编辑来源 / 生成脚本 | 运行时导出 | 来源说明 |
| --- | --- | --- | --- |
| 小獾主角、菌菇守卫、长嘴蜥弩手、甲壳兽 | `characters.blend`；`tools/make-characters.py` | `assets/models/characters.json` | 为本项目编写的网格轮廓、五官、护具、武器和配色；本地 Blender 建模，无导入的第三方角色模型 |
| 工坊场景、石墙、柜子、木栏、植物、宝物和出口等 | `environment.blend`；`tools/make-environment.py` | `assets/models/environment.json` | 为本项目编写的程序建模脚本、雕刻式轮廓与材质；无下载的模型或贴图包 |
| 材质与导出数据 | `tools/export_mesh_library.py`；`tools/pack_mesh_library.py`；`tools/build-effect-assets.cjs` | `q16-n8-c8-v1`顶点数据与 Cocos `.effect` 文件 | 本项目代码；颜色来自 Blender 材质的 `diffuse_color`，不依赖外部纹理文件 |
| 原创配乐与结算音乐 | `audio-source/compose_score.py`；`audio-source/midi/` | 三首完整音乐与胜利、退败 MP3 | 本项目谱面、配器与混音；乐器发声使用 GeneralUser GS 2.0.3 授权采样音源，完整来源、许可及其历史采样来源保留说明见 `audio-source/README.md`，不是全部自行录制的乐器 |
| 动作音效 | 项目的音效生成脚本；`audio-source/sfx-manifest.json` | 分材质、分力度的短 MP3 | 本项目物理启发的包络、谐振与噪声合成；具体产物记录见音效 manifest |

当前上述角色与环境模型没有使用外部素材市场资源、第三方角色立绘、摄影图库图片或付费生成服务的输出。配乐另有明确记录的第三方采样音源，不能套用模型的来源说明。项目开发工具和引擎依赖不属于本表的原创美术范围，应保留它们各自的许可证与声明。

**本说明记录来源，不声明 CC0、公有领域，也不单独向公众授予素材再分发许可。** 使用、修改和再分发应遵循仓库所有者实际选定的许可证；若仓库未指定许可证，不应把“原创制作”误读为“任何人可任意取用”。后续加入外部模型、字体、音乐或贴图时，应逐项记录原始来源、作者、许可证文件和可使用范围。

## 源文件的无损压缩

本目录当前两个 `.blend` 均由 Blender 4.3.2 使用 `compress=True` 保存。对本次实际文件运行 `file art-source/characters.blend art-source/environment.blend`，两者均识别为 **Zstandard compressed data (v0.8+), Dictionary ID: None**。它们不是旧版记录中的 gzip 文件；保留 `.blend` 扩展名，由 Blender 直接打开，无需使用者先解压。

| 文件 | 本次实际大小 | 本次容器格式 |
| --- | ---: | --- |
| `characters.blend` | 397,648 字节 | Zstandard |
| `environment.blend` | 494,064 字节 | Zstandard |

后续重建会使用所运行 Blender 版本原生支持的压缩方式，文件字节和体积可能变化，应重新检查，不能把本表当作固定大小或把旧版未压缩大小套入新文件。这是保存网格、修改器、关节、材质、灯光和场景的无损容器压缩。**源文件压缩与下面运行网格的属性量化是两件不同的事，不能都称为完全无损。**

## 0.2.0 美术调整

- 角色重新强化小獾的头脸、轮廓、装备与身体层次；守卫、弩手和窝主继续保持独立造型、关节与攻击部件。首页使用独立 `homeActor` 大号展示，场内实例按玩法所需比例显示；展示放大不改变核心碰撞半径。
- 环境改为苔藓侵入的旧宝库与怪物工坊：灰蓝大块不规则石板、暖铜木柜、金色宝物、青绿菌菇与根须。中央保持低对比，外沿增加断裂岩层、露根、碎石和角落聚簇装饰。
- 全部原有环境 prefab 键保留，`floor` 与 `trim` 仍分别合并为一个导出节点；明显凸起装饰集中在可走矩形外沿。柜子、木栏、墙和柱子继续由玩法碰撞 footprint 适配。
- 角色和环境都使用实际网格与顶点颜色，离线检查图不作为运行时贴片。当前 Blender 光照效果仍需与 Cocos 中的颜色、透明阴影和画面可读性分别核对。

## 重建

本轮实际使用 Blender 4.3.2。以下命令从仓库根目录运行，会覆盖对应生成的 `.blend` 和 `.json`；手动修改过源文件时，应先保存需要保留的版本。

```sh
blender --background --python tools/make-characters.py
blender --background --python tools/make-environment.py
```

两个命令分别完成建模、原始导出、量化打包和检查图渲染：

1. `tools/export_mesh_library.py`先把已求值网格写入`.build/raw-models/characters.json`或`.build/raw-models/environment.json`。这些中间文件保留浮点顶点属性，便于核对。
2. 建模脚本调用`tools/pack_mesh_library.py`中的`pack_library()`，将运行文件写到`assets/models/characters.json`和`assets/models/environment.json`，网格编码为`q16-n8-c8-v1`。
3. 保存启用压缩的可编辑`.blend`，渲染检查图。检查图不会进入运行网格。

若只需重新打包已有的浮点导出，无需再次建模或渲染：

```sh
python tools/pack_mesh_library.py .build/raw-models/characters.json assets/models/characters.json
python tools/pack_mesh_library.py .build/raw-models/environment.json assets/models/environment.json
```

不要将旧的浮点JSON直接覆盖到新的运行路径后省略打包步骤。手动编辑`.blend`后，应先用导出器导出所编辑的源文件，再运行打包器；直接重新运行建模脚本会从脚本重建，不能用来保留手动改动。

只重建并检查主角的命令如下。注意它会把 `characters.json` 临时导出为仅含主角，完整交付前必须再运行上面的完整角色命令。

```sh
blender --background --python tools/make-characters.py -- --hero-only
```

角色预览输出为仓库上一级 `art-preview/hero-preview.png`、`art-preview/character-lineup.png`；环境预览为 `art-preview/environment-review.png` 和 `art-preview/environment-game-angle.png`。这些图由实际 Blender 模型和灯光渲染，用于检查轮廓、穿插、比例与材质，属于检查用输出，不是游戏运行资源。环境脚本的游戏倾角图只是一种检查机位，若运行相机继续调整，应以实际 Cocos 截图核对；游戏内光照不会与 Blender 摄影棚渲染逐像素一致。

本次运行文件的实际统计如下。三角面按 `indexCount / 3` 计数，节点按导出层级统计；不是同屏实例复制后的总面数，也不是 Creator 微信包体。

| 资源 | 三角面 | 导出节点 | 打包 JSON 大小 |
| --- | ---: | ---: | ---: |
| 角色库 | 31,308 | 29 | 603,556 字节 |
| 环境库 | 59,212 | 12 | 1,567,873 字节 |

角色分项为主角 **10,832**、守卫 **6,446**、弩手 **5,684**、窝主 **8,346** 三角面。环境的 `floor` 为 5,550 面，包含外沿岩层、根须和植物的 `trim` 为 29,744 面；其余为柜子、木栏、柱子、墙、宝物、出口、蕨类、菌菇和铜灯。修改几何或导出配置后应重新统计，不把这些数字写成永久不变的预算。

## 运行网格的量化编码

`q16-n8-c8-v1`把每个节点的网格属性编码到Base64承载的二进制流中，父子关系、节点名称、局部位移、四元数、缩放及边界仍保留在JSON中。

| 数据 | 编码 | 与浮点中间文件的关系 |
| --- | --- | --- |
| 顶点位置 | 每个网格自己的范围内，3个无符号16位整数 | 每轴最大舍入误差约为该轴跨度除以131070；不进行顶点合并或重新布线 |
| 法线 | 每分量有符号8位整数 | 有小的属性量化误差，非逐位相同 |
| 顶点颜色 | RGBA各8位 | 每分量最大舍入误差约为`0.5/255`；不是图片压缩 |
| 三角形索引 | 无符号16位或32位整数 | 数值与顺序完整保留，不删三角形 |
| UV | 当前全零时省略；有非零值则写Float32 | 当前模型使用顶点颜色，全零UV可在解码时恢复 |
| 关节与节点变换 | 保留原JSON字段 | 不移除关节、不改变动画枢轴或父子关系 |

本次逐项对比当前 `.build/raw-models/` 原始导出与打包文件：所有三角形索引、节点数量、父子关系及节点变换保持一致。位置解码的最大绝对误差为角色约 `0.0000098694` 模型单位、环境约 `0.0001167915` 模型单位。法线分量最大误差约 `0.00394`，颜色分量最大误差约 `0.0019608`。这些是本次资源的量化测量，不能替代实时渲染检查。

这一步不再执行减面，也不重新生成几何；它保留当前导出器求值后的全部三角形。角色源中原有的网格修改器仍属于建模阶段，不能把“打包不减面”误读成从未使用任何建模减面处理。最终仍应检查Cocos内的高光、暗部、轮廓及动作，不能只以数值误差代替视觉验收。

## 坐标、关节与材质约定

- Blender 源模型为 Z 向上、朝向 -Y，脚底约为 Z=0。
- 导出为 Cocos 的 Y 向上、朝向 +Z；换算为 `(x, y, z) → (x, z, -y)`。
- 角色根节点名固定为 `hero`、`guard`、`archer`、`boss`。Blender 源文件中展示排列所用的根节点位移会被导出器移除。
- 可动关节采用 Empty，并标记 `md_joint=true`。节点名带角色前缀，例如 `hero.head`、`hero.arm.L`、`hero.leg.R`、`archer.weapon`、`boss.shell`。
- 每个关节下面的可见网格会合并成一个顶点着色网格。修改父子关系时需保留正确世界坐标，动画枢轴应位于头颈、肩、髋等实际关节位置。
- 导出 JSON 的每个节点包含父节点索引、局部位移、四元数 `[x,y,z,w]`、缩放。`.build/raw-models`中间网格使用positions / normals / colors / uvs / indices数组；`assets/models`运行网格使用上述`q16-n8-c8-v1`编码。UV当前全零，材质色不是图片。
- 角色与环境脚本中的十六进制配色先从 sRGB 转为线性 RGB，再赋给 `diffuse_color`。导出器读取材质色，保留有限的几何细节色差；金属感、粗糙度和摄影棚灯光不作为图片烘焙进模型。Cocos 着色器需要正确完成颜色输出，不能再次把线性值直接当作 sRGB 输出。
- 视觉网格与玩法碰撞范围分开维护。改变体型、柜子尺寸或木栏长度后，还需核对 Cocos 展示比例与 `core` 中的碰撞尺寸，不能只检查渲染图。

程序化生成并不免除视觉检查。重建后应检查正面、斜侧面、游戏实际俯视角，以及头部、手臂、腿部转动时的接缝和穿插，再发布更新后的运行网格。

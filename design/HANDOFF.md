# 《撞进怪物窝》续接记录

更新日期：2026-11-19（北京时间）。本记录对应 **0.1.1 首段可玩版**，供后续窗口从实际工程继续开发。最终发布提交、工作流总结果和最新截图以对应版本的 [验证记录](../qa/README.md) 与 GitHub Actions 产物为准，不把交接过程中某个提交的结果自动套用到后续代码。

## 1. 项目身份与已批准范围

- 独立仓库：[HEITAMU/monster-den](https://github.com/HEITAMU/monster-den)。不要与其他游戏仓库、存档、AppID 或美术混用。
- 当前网页入口：[0.1.1 试玩](https://heitamu.github.io/monster-den/web/?v=0.1.1)。`web/` 使用真实 Cocos 3.8.8 引擎，与 Creator 工程共用 TypeScript 玩法源码；它不是微信平台包。
- 本轮工作目录为 `/workspace/scratch/47c64d0088ec/monster-den`，工作分支为 `work/window2-playable`。路径和分支用于定位本轮工作，接续时仍要先核对 `git status`、远端与当前提交，保留尚未提交的有效修改。
- 引擎锁定 **Cocos Creator 3.8.8**，正式目标平台为微信小游戏。用户已批准制作，并要求音乐、音效认真完成；无需再次询问是否开始制作。

详细批准内容见 [APPROVED_SCOPE.md](APPROVED_SCOPE.md)。核心为竖屏、固定斜俯视的真实三维场景：单指向后拖拽，松手冲撞；移动、击退、破板、推柜、取宝共用这套操作。每房拿到宝物再到出口即可离开，**不要求清光敌人**。柜子的位置改变要持续影响后续通路和挡箭效果，敌人的下一次攻击方向提前显示。

已批准的第一段是一个场景主题、一名小兽、三类敌人行为、三件改变操作的工具、四间普通房和一间终点房，包含成功、失败、重进、结算和可选广告入口。当前三种基本行为是短距离守卫追撞、弩手发箭和长距离冲锋；窝主沿用更强的冲锋行为，并非已完成多阶段 Boss 系统。

角色和主要环境不得退回静态图片平移、简易线条或基础几何样机。可编辑模型、动作与实机显示都需要检查。所谓“2030 仍不过时”是追求长期玩法价值的目标，不是兼容性、留存、收入或未来画质的保证。

## 2. 0.1.1 已落入代码与资源的改进

以下是当前源码和资源具备的内容，不等于全部已通过微信手机体验验收。

| 方面 | 当前实现 | 主要位置 |
| --- | --- | --- |
| 瞄准与落点 | 预览按实际固定步长计算到静态落点，包含反弹和低速停稳；木板、柜子、敌人接触处明确截断；区分“碰撞点”“落点”“离开房间”，不再把前两秒的轨迹尾端当最终落点。预测不改变游戏状态。 | `assets/scripts/core/model.ts`、`core/types.ts`、`GameMain.ts` |
| 单指输入归属 | 拖拽绑定起始 touch ID，第二根手指不会改向或提前发射；取消、切后台会清理；鼠标与 Cocos 合成触摸之间有防重复处理。 | `assets/scripts/GameMain.ts` |
| 首次操作提示 | 底部提示随首次按住、拖拽力度、松手、获得宝物等状态变化；仍需真实新玩家验证是否不经口头说明就能理解。 | `assets/scripts/GameMain.ts` |
| 工具状态 | 重撞显示持续生效；抓停、回旋区分冲撞时可用、当前可用、本回合已使用和等待下一回合；可用时边框亮起，抓停后提示再次瞄准。 | `assets/scripts/GameMain.ts` |
| 敌人预告与受击 | 敌人蓄力时保留攻击区域，加入蓄力压身；厚木栏受损后有倾斜、木屑和反馈文字；伤害数字使用实际伤害量，挡箭提示按真实阻挡物归因。 | `assets/scripts/GameMain.ts` |
| 三维资产与渲染 | 接入关节部件模型及可编辑 Blender 源文件；运行网格使用属性量化打包；修正 Cocos 透明材质初始化状态、透明深度写入和模型颜色输出，调整俯视相机。 | `art-source/`、`assets/models/`、`ModelLibrary.ts`、`assets/resources/effects/` |
| 音乐与音效 | 营地 60 秒、探索 120 秒、窝主 96 秒三首完整配乐，胜利 4.5 秒、退败 2.5 秒短曲；32 个动作音效变体。谱面、MIDI、混音脚本、测量和音源许可均保留。 | `audio-source/`、`assets/music-*/`、`assets/sound/` |
| 音频加载与恢复 | 长音乐分场景懒加载、预取和交叉淡化；WebAudio 同时最多保留两首长音乐 PCM；限制音效并发和重复，重要音效短暂压低配乐；处理手势解锁、后台、广告和销毁。音频失败有超时与提示，不阻塞场景，也不悄悄换回简陋循环。 | `AudioCatalog.ts`、`ResourceBundles.ts`、`platform/GameAudio.ts` |
| 存档与广告 | 独立本机存档、进行中快照恢复、结算防重复、坏快照恢复；激励视频严格核验完整观看并通过凭证发奖。正式广告 ID 仍为空，网页测试广告默认关闭。 | `platform/SaveStore.ts`、`platform/RewardedAds.ts`、`GameMain.ts` |

本轮没有以瞄准修复为由改变发射速度、阻力或房间平衡。三工具目前是**单件切换**：重撞提高撞击和推柜效果但减少反弹；壁虎手套每回合抓停重瞄一次；回旋腕带每回合朝本次出发点折返一次。不要将其描述为已经具备丰富的叠加构筑。

## 3. 代码、素材与重建位置

| 位置 | 用途与续接注意 |
| --- | --- |
| `assets/Boot.scene`、`assets/scripts/GameMain.ts`、`GameUI.ts` | Creator 启动场景、三维表现、触控、界面与平台整合。 |
| `assets/scripts/core/` | 与渲染无关的确定性玩法、五房配置、碰撞、工具和快照。改关卡规则时从这里查起。 |
| `assets/scripts/ModelLibrary.ts`、`MeshCodec.ts` | 模型解码、共享网格、独立关节节点、材质及网格生命周期。 |
| `art-source/characters.blend`、`environment.blend` | 可编辑角色与环境源文件。建模脚本重跑会从脚本重建，不能用于保留手工编辑；见 [美术说明](../art-source/README.md)。 |
| `tools/make-characters.py`、`make-environment.py`、`export_mesh_library.py`、`pack_mesh_library.py` | 本地 Blender 建模与导出。当前运行数据在 `assets/models/`；中间浮点网格在 `.build/raw-models/`，不应重复打入游戏。 |
| `audio-source/compose_score.py`、`midi/`、`music-manifest.json`、`sfx-manifest.json` | 可编辑音乐谱面、音频来源和测量；动作音效生成脚本为 `tools/make-sfx.py`。见 [音频说明](../audio-source/README.md)。 |
| `assets/models/`、`assets/sound/`、`assets/music-camp/`、`assets/music-explore/`、`assets/music-boss/` | Creator 的独立 Asset Bundle。不要搬回 `assets/resources/` 形成重复资源；分目录本身不证明微信实际包体已合规。 |
| `tools/build-web.cjs`、`web/` | 把共用 TS 和运行资源输出到真实 Cocos 网页预览；不要直接修改生成的 `web/scripts/` 再遗漏源文件。 |
| `tools/build-creator.cjs`、`settings/v2/packages/builder.json` | 调用真实 Creator 3.8.8 编辑器生成平台包。构建环境与步骤见 [WECHAT_RELEASE.md](WECHAT_RELEASE.md)。 |
| `tests/`、`tools/check-types.cjs`、`check-game-headless.cjs`、`check-game-browser.cjs` | 机制、平台、音频、类型、EmptyDevice 集成和真实 WebGL 验收；各自证明范围不同。 |

节点名称、关节父子关系、碰撞代理和 `.meta` 文件不能随意删改。运行网格采用 `q16-n8-c8-v1`：它保留三角形索引与拓扑，但位置、法线、颜色有量化误差，不能声称为逐位无损；Blender 源文件的容器压缩才是另一项无损压缩。

配乐的谱面与配器为项目创作，乐器发声使用 **GeneralUser GS 2.0.3** 采样音源，由 FluidSynth 离线渲染。保留随项目记录的许可及作者对历史采样来源的说明；不能宣传成真人乐团录音、全部自行录制或 CC0 素材。

## 4. 已有验证与不能混用的证据

### 纯逻辑与集成

- `tests/core.test.mjs` 当前 **19 项通过**，其中五组新增检查覆盖完整落点、静态反弹、多类交互截断、出口提前结束，以及瞄准无副作用。平台、音频和资源测试的完整数量与结果以当次 `npm test` 输出为准。
- [PLAYTEST.md](PLAYTEST.md) 保留五房可复现路线。基准结果是 21 次发射、4 生命、1065 分、无救援，各房可留活敌人；这是确定路线，不是玩家平均成绩。
- `qa/typecheck.json` 按真实 Cocos 3.8.8 源码 API 做严格类型检查。当前报告为 13 个项目脚本、55 项 Cocos 导入、0 错误；它不证明未安装的原生 SDK 或微信构建已经验证。
- `qa/game-headless.json` 加载实际 GameMain、场景、模型与平台代码，通过输入与 Cocos 生命周期走完整五房，检查保存、结算和资源释放。使用 **EmptyDevice**，没有真实 WebGL 像素，不能用于证明着色器、手机帧率或可闻音频。

### 真实浏览器的历史节点与最终验收入口

本轮已在 **GitHub Actions 的 Chromium / SwiftShader 软件 WebGL** 环境执行真实 Cocos 帧循环、着色器、模型、UI、实际 MP3 解码与输入检查。它比 EmptyDevice 多验证了真实图形管线，但依然不是 iPhone、Android 或微信真机。

在提交 `e8b89e0` 的验收回传中，功能断言已完成，包括五房路线和移动视口触摸检查；当时总验收仍被一条 `touchcancel` 控制台介入提示阻挡：Chromium 派发不可取消的原生取消事件，官方 Cocos 3.8.8 适配器调用 `preventDefault()`，浏览器拒绝这一无效调用。**这段记录不是对最终发布提交的总通过声明。**

`tools/check-game-browser.cjs` 对该已知诊断作精确分类，并要求取消后的拖拽清理、零误发射和下一次输入恢复等行为断言同时成立；不得借此忽略其他控制台错误、资源失败或着色器错误。修订后的提交 `26c5d48` 已在[工作流 44442569356](https://github.com/HEITAMU/monster-den/actions/runs/44442569356) 重跑并总通过，完整报告保存为 [qa/game-browser.json](../qa/game-browser.json)。第二根手指单独松开的分支使用明确记录的 DOM TouchEvent 测试夹具，其余触摸分支使用 CDP；测试夹具也不能冒充手机原生输入证据。

最终浏览器结果查看 [Cocos WebGL playable acceptance 工作流](https://github.com/HEITAMU/monster-den/actions/workflows/browser.yml)，按**被测提交**取对应 artifact。输出目录为 `.build/game-browser/`，主要报告为 `result.json`，截图与浏览器记录一并保留；工作流上传的 artifact 默认保留 14 天，必要证据应及时存入仓库验证记录。不得因为工作流脚本存在、功能断言曾通过或另一个提交曾通过，就写当前版本“全部通过”。

### 尚不能宣称完成

| 项目 | 当前边界 |
| --- | --- |
| Creator 工程导入与正式微信包 | 当前环境尚无可用的 Creator 3.8.8 编辑器完成导入与微信构建记录。网页包不能改名充当微信包。 |
| 微信开发者工具与真机 | 需要真实 Creator 产物、开发者工具和 iOS/Android 微信运行记录；浏览器移动视口和 SwiftShader 不可代替。 |
| 包体、帧率、加载与发热 | Bundle 配置、资源大小和 CI 帧循环只能提供工程信息；必须测实际主包/分包、首次与缓存加载、帧时间、内存与连续游玩。 |
| 广告变现与上架 | `adUnitId` 为空；尚无本项目真实广告填充、账号资格、完整观看发奖、收入或上架审核证据。不得沿用其他项目 AppID 推定本项目已具备资格。 |
| 主观音频品质 | 原创谱面、实际音频、响度和循环边界测量已具备；是否悦耳、外放是否清楚、配乐是否疲劳及是否达到用户期待，需要完整听审与手机反馈。不能以测试通过宣称“顶级”。 |
| 长期耐玩与收入 | 当前仍是五间固定手工房，局外仅基础金币和开局工具解锁。尚无真实玩家留存或商业数据，不能保证长期可玩、复利或赚钱。 |

## 5. 下一步优先级

1. **先取得真实新玩家的首局反馈。** 使用清洁独立存档，让玩家自然操作，不提前讲最佳路线。按 [PLAYTEST.md](PLAYTEST.md) 记录第一次有效拖拽、反向拖错、目标与出口理解、受伤原因、工具使用，以及从哪次操作开始觉得拖沓或无聊。当前有动态文字提示，尚未证明它足够好用；应据观察修改，而不是先加更多教程文字。
2. **同时做手机性能与音频验证。** 分别检查首次/缓存加载、八方向拖拽、第二触点、取消、工具点击、前后台、连续五房、结算重进、音乐循环接缝与外放层次。记录设备、系统、浏览器或微信版本、构建提交、录屏及帧时间。先定位卡顿、输入丢失或音频恢复问题，再决定优化；CI 上的速度不能拿来推断手机性能。
3. **依据反馈调整动作节奏与视觉可读性。** 冲撞落定、敌人回合与工具读卡都有等待成本，模拟路线能完成不能代替真人对节奏的判断。若需要压缩低速尾段或敌人回合，必须同时检查抓停/回旋的操作窗口与瞄准一致性。
4. **首局成立后，再增加有策略差异的房间变化。** 优先考虑可选宝物路线、能被旧工具利用的新布局、不同风险与落点选择；每项都验证可解性、预告和第二种打法。当前每房免费换工具，局外开局工具主要影响第一房，长期解锁价值仍弱，应通过实际路线差异改善。不要以更多房间、随机数、数值层级或新的界面数量冒充耐玩度。
5. **微信交付按真实依赖推进。** 获得 Creator 环境后按 [WECHAT_RELEASE.md](WECHAT_RELEASE.md) 执行资源导入、正式构建、包体检查、开发者工具和真机，再接真实广告位。源码能够先完成的部分继续推进；缺少外部条件时明确停在哪一层，不虚构产包或收入。

## 6. 接手时最短检查路径

先核对仓库、分支、未提交修改、版本与现有报告对应的源码哈希，阅读本记录及 [APPROVED_SCOPE.md](APPROVED_SCOPE.md)，不要重新从概念阶段开始。

常规网页构建与检查使用 Node.js 24 或更新版本：

```sh
npm install
npm test
npm run build:web
npm run check:web
python audio-source/verify_score.py
```

`check:web` 需要可启动的 Chromium 和中文字体；本地沙箱若无法启动，使用现有 GitHub Actions 工作流，不把环境失败写成游戏通过。具备官方 Cocos 3.8.8 源码及构建依赖时，再设置 `COCOS_ENGINE_SOURCE` 执行 `npm run check:types` 和 `npm run check:game`。Creator 平台构建另需 `COCOS_CREATOR_388` 与本项目真实 `WECHAT_APP_ID`。

只修改对应源文件并重新生成派生产物；更新实测证据时写清环境、提交与验证边界。最终向用户汇报实际可玩的内容、入口和还未完成的关键环节，不把测试数量当成成品品质。

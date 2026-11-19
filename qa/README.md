# 验证记录及其边界

最新增量为 [0.4.0-alpha 首房菌核连锁验收](0.4.0-alpha.md)，对应源码 bd3cfceb，113 项项目测试和 Chromium/WebGL2 20 张截图。以下原 0.3.0/0.3.1 的静态数据不代表这一版本，按各自被测提交使用。

更新日期：2026-11-19（北京时间）。最新的增量验收为 [0.3.1 摇杆防误触与反馈](0.3.1.md)，被测运行代码是 637ca6f1，真实 WebGL 和触摸回归已经通过。以下既有静态报告与截图对应 0.3.0，不可冒充 0.3.1 的新测试。

**0.3.0 引导与绕路取宝已公开发布**：[打开试玩](https://heitamu.github.io/monster-den/web/?v=0.3.0)。项目测试、严格类型、EmptyDevice、实际 Chromium / WebGL2 以及公开部署核验均已取得本轮证据；手机硬件与正式微信环境仍需独立验证。

## 本轮结果与证据

被测和部署的运行源码为 [`cb2fbffc4afa89de849e6e4ec56b2748dc3d407e`](https://github.com/HEITAMU/monster-den/commit/cb2fbffc4afa89de849e6e4ec56b2748dc3d407e)，树为 `4e8323c0fa48e9ad809cf4fc33e4cfad170872cf`。main 已快进至该运行提交。后续文档和证据提交与运行代码分开说明，不预填未来提交号。

| 检查 | 本轮结果 | 证明范围 |
| --- | --- | --- |
| [项目测试](unit-tests.json) | 110 项通过，含核心 28 项、引导 7 项 | 规则、可选路线、快照、引导、音频和平台适配；分项已包含在总数中 |
| [严格类型](typecheck.json) | 14 个脚本、55 项 Cocos 导入、0 错误 | 对官方 Cocos 3.8.8 API，含新增 `AdventureGuide.ts` |
| [EmptyDevice 集成](game-headless.json) | 2504 帧，589 Mesh 初始化 / 退场 0 | 实际 GameMain、DOM 输入、主线五房、第二房钱袋分支、提示与存档；无 WebGL 像素 |
| [实际浏览器](game-browser.json) | [工作流 44496981910](https://github.com/HEITAMU/monster-den/actions/runs/44496981910) 成功，18 张真实截图 | Chromium 157.0.8103.0 / WebGL2 / ANGLE SwiftShader；实际图形、输入、音频解码与刷新恢复 |
| [公开部署](deployment.json) | [Pages 44498519820](https://github.com/HEITAMU/monster-den/actions/runs/44498519820) 成功；13 文件共 2,424,176 字节校验一致 | 公开入口的实际 HTTP 响应与被测文件逐字节一致 |

`unit-tests.json`、`typecheck.json`、`game-headless.json` 和 `game-browser.json` 均已更新为本轮证据。浏览器报告的 `provenance` 绑定运行提交及 37 个源文件/运行文件 SHA-256；报告按这些对象解释，不能因路径和版本名相同就沿用到未来代码。

浏览器产物 ID 为 `14516385606`，生成时间为 **2026-11-19 17:37:21（北京时间）**。原始归档 SHA-256 为 `6e659fa7f26bc51386e6827b522293e31e1018083fa3c6dd570ab0a75a973e52`。18 张截图中有 11 张保存在 [webgl/](webgl/)，其余仍随工作流产物保留。

## 实际浏览器通过范围

实际运行官方 Cocos 3.8.8 的帧循环和 WebGL2 图形管线，经 DOM 鼠标与 CDP 触摸输入操作。游戏状态用于定位与断言，不通过写入胜利或传送角色代替路线。

| 路线 | 浏览器实际结果 | 说明 |
| --- | --- | --- |
| 主线五房 | 21 发、1065 分、4 生命、0 救援、钱袋 0 | 原主路线仍可跳过钱袋，房间结束可保留活敌人 |
| 独立第二房钱袋分支 | 另起新局，首房 2 发加第二房 6 发，共 8 发；395 分、5 生命、1 袋 / 80 金币 | 验证第二房钱袋可经摇杆取得、拾取后状态正确 |

**收齐两袋的 23 发五房路线目前只有完整核心验证。** 第四房钱袋由核心完整可选路线与实际第四房场景截图覆盖，未将其写成已经完成整条双钱袋浏览器路线。

其他实际浏览器检查包括：

- 固定摇杆中心点按、死区、回中取消和场景起手不误发射，鼠标右键与中键不能瞄准或发射；坐标来自真实 UI 相机投影至画布 CSS 坐标。
- 首房状态引导与条件出口光圈、短屏布局、工具选择卡、持续工具名称和抓停/回旋阶段状态；取消提示保留。
- 390×844 / DPR 2 下，第二指不改向，原生取消不发射，取消后仍能正常冲撞。只有“单独松开第二指”分支使用明确标记 `isTrusted: false` 的 DOM TouchEvent 夹具，其余触摸分支使用 CDP 原生输入。
- 营地、探索、窝主三首实际音乐解码、AudioContext 与播放状态；实际页面刷新后恢复已结算胜利且不重复发收益；未配置广告不发奖励并解除暂停。没有实际广告播放或人耳试听结论。

### 截图复核

主代理和独立代理已复看短屏首房、工具选择、钱袋收取前后、第四房和移动端瞄准/冲撞，未发现阻挡本轮试玩的画面问题。保存截图如下：

| 画面 | 本轮实际截图 |
| --- | --- |
| 首页、首次瞄准 | [01 首页](webgl/01-home.png)、[03 首次瞄准](webgl/03-room1-aim.png) |
| 第四房、窝主房 | [07 第四房](webgl/07-room4.png)、[08 窝主房](webgl/08-room5.png) |
| 胜利结算 | [09 胜利](webgl/09-victory.png) |
| 移动端输入 | [13 瞄准](webgl/13-mobile-aim.png)、[14 冲撞](webgl/14-mobile-shot.png) |
| 短屏首房、工具卡 | [15 短屏首房](webgl/15-short-first-room.png)、[16 工具选择](webgl/16-tool-choice.png) |
| 第二房钱袋 | [17 收取前](webgl/17-room2-stash.png)、[18 收取后](webgl/18-room2-stash-collected.png) |

短屏底部操作句偏小、钱袋收取提示可能被随后“柜子挡箭”提示覆盖，列为后续真人观察项。截图复核没有认定手机触摸舒适度或新玩家理解已通过。

### 控制台与已知诊断

报告中的 `errors`、`consoleErrors`、`warnings`、`failedRequests` 均为空，`knownDiagnostics` 另保留 **1 条**精确分类的 Cocos 3.8.8 `touchcancel` 诊断：官方触摸适配器对不可取消的原生事件调用 `preventDefault()`，Chromium 忽略该无效调用。

原始严重级别、同源引擎位置、CDP 触发方式和事件数据均保留。只有消息与限定来源一致，且不可取消、瞄准已清除、取消无发射、随后触摸可正常发射并撞碎木栏等行为断言同时成立，才接受这个条目；其他运行、资源、着色器或控制台错误仍使验收失败。不能把此分类描述成“没有任何控制台诊断”。

## EmptyDevice 集成与生命周期

报告加载本轮 GameMain、玩法、平台、场景和模型，通过 Cocos 生命周期与 DOM 输入执行主线 21 发五房（1065 分、4 生命、钱袋 0），以及独立第二房钱袋分支（累计 8 发、395 分、5 生命、1 袋 / 80 金币）。

抓停后以约 1.47% 力度继续发射，0.35 秒后进入敌人阶段时，旧“守卫暂不行动”提示清除，工具名仍稳定。引导、出口光圈、状态显示、存档恢复和奖励边界的受测断言保留在报告中。

初始隐藏的 ExitGlow 曾暴露从未激活节点不调用组件 `onDestroy` 的问题，退场剩余 2 个 Mesh。`ModelLibrary.meshNode` 补充节点销毁事件的幂等释放，并保留组件销毁后，复验累计初始化 **589 个 Mesh、退场剩余 0**。这测的是释放生命周期调用，不是 GPU 显存回收量。

2504 是固定步进执行的引擎帧数。EmptyDevice 不输出游戏像素、不编译 GPU 着色器，也没有可用音频后端；不能用于测手机帧率、画质或可闻声音。类型检查只覆盖项目脚本与可用 Cocos API，不声称未安装的原生 SDK 或微信构建已验证。

## 核心与引导规则

新增核心检查覆盖钱袋只收一次、拾取不中断飞行、不代替主宝物或解锁出口；飞行中存取不重复发奖励；跨房累计、新局清零；旧快照当前房不补生成钱袋、下一房加载新配置；非法钱袋数据被拒绝且不替换当前有效状态；两袋都可通过核心发射到达。

引导 7 项检查覆盖实际木栏、主宝物与出口状态推进，取宝优先及保存世界恢复，缺失木栏和后续房间处理，查询无副作用与独立目标坐标，工具名称跨阶段保留，空工具和被动工具不邀请主动点击，以及下一房建议与后备说明。

两条核心路线都从无开局工具的新局开始，每次过房选重撞、不用救援：

| 核心路线 | 发射 | 生命 | 分数 | 钱袋 |
| --- | ---: | ---: | ---: | --- |
| 原主路线 | 21 | 4 | 1065 | 0 个、0 金币 |
| 收齐可选钱袋 | 23 | 4 | 1230 | 2 个、200 金币 |

第二房 `(-3.85, -0.4)` 为 80 金币，第四房 `(-2.35, 0.5)` 为 120 金币。可选路线比主路线净增 **165 分**：两袋增加 200，同时绕开原路线中 35 分的敌人。完整坐标见 [PLAYTEST.md](../design/PLAYTEST.md)。失败保留已有分数，旧快照当前房不补生成钱袋；不能将这套规则改写成“死亡丢钱”。

## 资源与部署

角色库为 603,556 字节、31,308 三角面、29 节点；环境库新增三维皮革金币袋，为 1,635,486 字节、62,470 三角面、13 节点、12 类。合计 **2,239,042 字节、93,778 三角面**；环境 Blender 源文件为 553,409 字节。它们是整个模型库统计，不是同屏绘制量、GPU 性能或微信实际包体。

[deployment.json](deployment.json) 记录 0.3.0 公开入口、被测与部署运行提交、工作流及各个实际 HTTP 响应哈希。13 个关键文件共 **2,424,176 字节**逐字节一致，覆盖入口、元数据、启动与改动脚本和模型。该范围是明确的关键文件核验，不等于对整个 CDN 所有文件、所有用户缓存或手机网络环境做全量认证。

## 0.2.0 历史证据

历史运行代码为 `ccfe4169`，报告归档所在提交为 `73bc27f5`。旧 [WebGL 工作流 44488941187](https://github.com/HEITAMU/monster-den/actions/runs/44488941187) 与 [Pages 工作流 44489644880](https://github.com/HEITAMU/monster-den/actions/runs/44489644880) 均成功。以下使用该提交的永久文件链接，当前 `qa/` 文件已经是新版。

| 0.2.0 历史文件 | 当时结果 |
| --- | --- |
| [项目测试](https://github.com/HEITAMU/monster-den/blob/73bc27f5/qa/unit-tests.json) | 98 项通过，核心 23 项包含在内 |
| [类型检查](https://github.com/HEITAMU/monster-den/blob/73bc27f5/qa/typecheck.json) | 13 脚本、55 导入、0 错误 |
| [EmptyDevice](https://github.com/HEITAMU/monster-den/blob/73bc27f5/qa/game-headless.json) | 1804 帧、21 发五房、425 Mesh 退场剩余 0 |
| [浏览器报告](https://github.com/HEITAMU/monster-den/blob/73bc27f5/qa/game-browser.json)、[旧截图](https://github.com/HEITAMU/monster-den/tree/73bc27f5/qa/webgl) | SwiftShader WebGL2 五房通过，工作流生成 14 张截图 |
| [部署报告](https://github.com/HEITAMU/monster-den/blob/73bc27f5/qa/deployment.json) | 11 文件、2,326,777 字节 HTTP 校验一致 |
| [节奏对照](https://github.com/HEITAMU/monster-den/blob/73bc27f5/qa/feel-comparison.json) | 0.1.1 与 0.2.0 核心时钟对比，无渲染、手机或人类试玩 |

历史节奏对照以 `7aa58e5` 为 0.1.1 基线，在 100 × 100 空房间用 120 Hz 输入时间步，保留远处守卫的敌人阶段，从发射计至下次可瞄准：

| 力度 | 0.1.1 周期 | 0.2.0 周期 |
| --- | ---: | ---: |
| 3% | 2.63 秒 | 1.01 秒 |
| 11% | 2.88 秒 | 1.25 秒 |
| 50% | 3.51 秒 | 1.84 秒 |
| 100% | 3.92 秒 | 2.16 秒 |

0.3.0 沿用主体 1.5 倍、低速尾段渐进到 3 倍、主动工具前 0.45 秒保护及 `launchMin=0.55`、`launchMax=12.8` 参数。旧时间是核心输入累计，不是 CPU 耗时或手机实测；满力度无碰撞距离约 9.305 模型单位。不把历史源文件哈希改称为本轮新测量。

## 剩余验证与复现

需要真实手机记录触摸舒适度、安全区、帧时间、加载、内存、发热、持续五房与音频试听。Creator 3.8.8 编辑器导入、正式微信构建、包体、开发者工具和微信真机，以及真实广告资格与完整观看回调，均需对应环境的独立记录。软件 WebGL、EmptyDevice 和音频播放状态不能替代这些结果。

提供官方 `cocos-engine` 3.8.8 源码及构建依赖后运行：

```sh
npm test
COCOS_ENGINE_SOURCE=/path/to/cocos-engine node tools/check-types.cjs
COCOS_ENGINE_SOURCE=/path/to/cocos-engine node tools/check-game-headless.cjs
COCOS_ENGINE_SOURCE=/path/to/cocos-engine npm run build:web
```

EmptyDevice 使用已有的 `@cocos/ccbuild`、`typescript`、`jsdom` 和 `@napi-rs/canvas`，不会自行下载或改写引擎源码。在允许启动 Chromium 的环境中运行：

```sh
npm run check:web -- https://your-preview.example/
```

不传 URL 时服务本地 `web/`，结果写入 `.build/game-browser/`。`COCOS_SOFTWARE_GL=1` 显式选择软件 WebGL，报告记录该条件。工作流为 [browser.yml](../.github/workflows/browser.yml)，产物默认保留 14 天；必要报告和截图已随本轮工程保留。源码或资源改变后，只为受影响行为和必要门槛重跑验证，不自动沿用本轮结果。

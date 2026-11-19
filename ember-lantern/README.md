# 烬灯秘境 / Ember Lantern

**Cocos Creator 3.8.8 · 微信小游戏优先 · 竖屏 · 2D 原创手绘美术 · 轻度 Roguelite 远征**

当前交付为 **0.1.0 可玩核心切片**，不是已审核、已上架的正式产品。工程包含 Cocos Creator 格式的场景和 TypeScript 组件、原创场景/角色/特效图、合成的原创音频、浏览器同规则试玩、奖励广告适配接口以及逻辑回归测试。

## 游戏怎么玩

进入秘境后，拖动左下摇杆移动，点右下的**脉冲**攻击附近怪物、照亮隐藏的灯种，点**闪避**冲刺躲开有前摇提示的攻击。脉冲耗费灯火；灯火随时间缓慢减少，收集补给后恢复。集齐本层灯种，再去上方的遗迹入口，可以撤离结算，也可以赌更高奖励进入下一层。失败时只能拿回本局奖励的 35%。回营地将灯灰永久投入灯芯容量、光焰威力和移动能力。

独立存档（`sys.localStorage`/浏览器 `localStorage`）。没有使用开发者测试存档给玩家解锁进度。

## 立即打开

1. 用 **Cocos Creator 3.8.8** 打开本目录（即含 `assets/` 和 `package.json` 的根目录）。
2. 等待素材导入完成，打开 `assets/Boot.scene`，预览/运行。
3. 需要微信包时从 Cocos **项目 → 构建发布 → 微信小游戏** 构建，并在真实账号的 `AppID` 和微信开发者工具中调试。

也有共享同一套 TypeScript 游戏规则的 **HTML5 辅助试玩**，可用以下命令：

```sh
npm install
npm test
npm run build:preview
npm run serve
# 在浏览器访问 http://localhost:39188/preview/
```

辅助试玩使用 Canvas 2D 的独立渲染器，它**不是**官方 Cocos Creator 构建产物，不能作为微信真机通过的证据。项目核心规则文件 `assets/scripts/core/LanternRules.ts` 被 Cocos 端和辅助试玩共同使用。

## 目录结构

| 目录 | 说明 |
|---|---|
| `assets/Boot.scene` | Cocos Creator 入口场景 |
| `assets/scripts/LanternGame.ts` | Cocos Creator 实际渲染、输入、音效、UI、动效 |
| `assets/scripts/core/` | 不依赖引擎的远征规则与存档类型 |
| `assets/scripts/platform/` | 存档和微信激励视频广告适配 |
| `assets/resources/art/` | 手绘风格角色、怪物、背景、道具、光效（量化优化以减小包体） |
| `assets/resources/sound/` | 原创合成环境音乐和 6 类游戏音效 |
| `preview/` | HTML5 同规则辅助试玩 |
| `tests/` | 核心状态机、奖励、移动和边界测试 |
| `tools/` | 合成声音、光效资源、素材完整性检查 |
| `docs/` | 设计约束、微信发布和验收现状 |

## 美术承诺和边界

我们选的是注重造型、色彩与光影层次的 **2D 绘本式奇幻美术**，不做几何盒子拼接的假 3D。这批角色、怪物、场景资源是 AI 辅助生成并透明分层处理的原创素材；目前采用局部位移、缩放、方向姿态切换和程序 VFX，尚未完成 Spine/逐帧整套高标准角色动画。不能据此宣称已做到最终商用品质，或保证「到 2030 年绝不过时」。

## 微信广告

`assets/scripts/platform/WeChatRewarded.ts` 的 `AD_UNIT_ID` 默认为空：**没有真实广告位和权限时，接口直接关闭，绝不伪造广告收益**。接入真实账号广告位后，视频只有回调 `isEnded === true` 才允许发放一次额外奖励；中断/失败都不发奖。其他广告位（结算插屏、营地原生广告）暂只在设计文件预留，不强制点击、不影响核心通关。

## 当前验证范围

- `npm test`：9 个核心逻辑测试通过，另有 17 个美术素材检查和 Cocos 场景脚本 UUID 关联检查。
- TypeScript 纯规则模块已编译为 ESM 给网页辅助试玩复用，网页 JS 静态语法检查通过。
- 已在 Chromium 的嵌入式资源测试模式完成 390×844 手机尺寸页面与实际操作检查：加载、出征、战场渲染、点击脉冲、收集灯种、开启出口、选择撤离、结算、返回营地均通过且未出现 JS 页面异常；测试中的音频播放由无声替身替代，**不等于验证了网络发布、音效听感或微信真机。**
- 暂未在此环境实际打开 Cocos Creator 编辑器、生成正式微信游戏包或进行微信真机验证。
- 因此需要进行 Creator 导入、构建、真机性能、广告回调权限、上架合规/资质的后续验收，不能将工程压缩包直接当作已可上架产品。

有 Python Playwright 和 Chromium 的环境还可运行 `npm run check:browser` 进行完整页面流程检查。

详见 [`docs/`](docs/)。

### GitHub 独立分支说明

首次交付放在 `HEITAMU/monster-den` 的独立分支 `game/ember-lantern-3.8.8` 里，以 `ember-lantern/` 目录存放本游戏工程，**不会修改《撞进怪物窝》主分支**。下载该目录作为独立 Cocos 项目打开；如需单独的仓库，可后续直接迁移这个目录。

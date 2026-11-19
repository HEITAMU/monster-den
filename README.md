# 撞进怪物窝 / Monster Den

原创竖屏 3D 取宝撤离小游戏，目标引擎 **Cocos Creator 3.8.8**，正式目标平台为微信小游戏。

推动底部固定摇杆瞄准，松手冲撞。推杆方向就是出手方向，推得越远力度越大；回到中心再松手即可取消。右侧按钮使用工具。移动柜子、借掩体挡箭、拿到宝物并到达出口；清光敌人不是通关条件。每局四间普通房和一间终点房。

## 当前版本：0.3.1 摇杆防误触与反馈调整

[打开 0.3.1 网页试玩](https://heitamu.github.io/monster-den/web/?v=0.3.1)

0.3.1 修复摇杆外圈点击或小幅手抖导致误发射：手指必须实际移动至少 6 设计单位，并且最终离中心超过死区才可冲撞；回中取消和单指输入归属不变。摇杆方向指示随推动方向旋转，底部操作与工具状态文字放大。宝物、额外钱袋和受伤消息优先于普通挡箭反馈。

[0.3.1 被测代码](https://github.com/HEITAMU/monster-den/commit/637ca6f1e0de4d9b95ff233a352a69e39fae37e9) 已通过 110 项项目测试、网页构建、真实 Chromium/WebGL2 五房 21 发路线，以及鼠标/CDP 外圈轻点与抖动回归；不是微信真机。证据见 [0.3.1 验收记录](qa/0.3.1.md) 和 [GitHub Actions](https://github.com/HEITAMU/monster-den/actions/runs/44506757784)。

### 0.3.0 历史玩法增补

[0.3.0 历史运行源码](https://github.com/HEITAMU/monster-den/tree/cb2fbffc4afa89de849e6e4ec56b2748dc3d407e)

本轮在固定摇杆版本上补齐首局理解与可选路线：目标提示由实际房间状态推导，第一房依次指向木栏、主宝物和出口；主宝物拿到后出口光圈才亮。工具名称持续显示，工具卡有用途说明和图标，回中取消提示全程保留；受伤反馈对应实际攻击来源，受击动作落在玩家身上。

第二房左侧加入 80 金币钱袋，第四房左侧加入 120 金币钱袋，均使用真正的三维皮革金币袋模型。钱袋可以绕路拾取，也可以直接跳过；它们不解锁出口，不改变每房“拿主宝物再到出口”的条件。原 21 发路线继续可用，核心验证另已跑通 23 发收齐两袋的路线。

**0.3.0 历史版本已验收。** 运行代码 [`cb2fbffc`](https://github.com/HEITAMU/monster-den/commit/cb2fbffc4afa89de849e6e4ec56b2748dc3d407e) 已通过 110 项项目测试、严格类型检查、EmptyDevice 集成和实际 Chromium / WebGL2 [验收工作流 44496981910](https://github.com/HEITAMU/monster-den/actions/runs/44496981910)。浏览器实走主线五房（21 发）及独立第二房钱袋支线（从新局累计 8 发），并验证工具阶段名称、摇杆边界、多指取消恢复与音频解码。

[Pages 工作流 44498519820](https://github.com/HEITAMU/monster-den/actions/runs/44498519820) 已成功；公开入口的 13 个关键文件共 2,424,176 字节，与被测文件逐字节一致，详见 [发布核验](qa/deployment.json)。完整证据、实际截图与验证范围见 [qa/README.md](qa/README.md)，续接记录见 [design/HANDOFF.md](design/HANDOFF.md)。

浏览器检查使用 Chromium / ANGLE SwiftShader 软件驱动，尚不代表手机硬件或微信真机已通过；音频解码与播放状态检查不等于人耳试听。0.2.0 历史记录保留在 [73bc27f5 的验证文档](https://github.com/HEITAMU/monster-den/blob/73bc27f5/qa/README.md)。

## 工程

- `assets/`：Creator 场景、同源 TypeScript 玩法、平台接口、3D 资源和材质。
- `art-source/`：可编辑 Blender 源文件。
- `tools/`：网格导出、同源网页预览与 Creator 平台构建脚本。
- `tests/`：游戏机制、存档与激励广告状态测试。
- `web/`：使用官方 Cocos 3.8.8 引擎源码构建的网页预览；与 Creator 共用玩法脚本和场景。

```sh
npm install
npm test
npm run build:web
npm run serve
```

正式微信包需要安装 Cocos Creator 3.8.8，并配置真实 AppID。`npm run build:wechat` 只在实际编辑器环境存在时执行构建，不会生成一个伪装成微信包的网页目录。

## 广告与存档

广告位 ID 默认留空。激励视频只有收到完整观看确认后才产生一次性奖励凭证。网页广告测试必须显式启用并标注“测试广告（不产生收益）”；它不代表微信广告权限或真实收入。每位玩家使用本机独立存档，不提交开发者存档。失败保留已经获得的分数，不设“死亡丢钱”规则。旧快照恢复时不会向正在进行的房间补生成钱袋；进入下一房后才使用新房间配置。

## 美术

角色与主要场景使用真实三维网格、关节部件和材质；不以静态角色图片平移代替动作。Blender 源文件和导出脚本随工程保存。引擎依其原有许可使用，原创游戏代码与美术的权利不因仓库公开而自动转让。


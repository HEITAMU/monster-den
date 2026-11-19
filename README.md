# 撞进怪物窝 / Monster Den

原创竖屏 3D 取宝撤离小游戏，目标引擎 **Cocos Creator 3.8.8**，正式目标平台为微信小游戏。

推动底部固定摇杆瞄准，松手冲撞。推杆方向就是出手方向，推得越远力度越大；回到中心再松手即可取消。右侧按钮使用工具。移动柜子、借掩体挡箭、拿到宝物并到达出口；清光敌人不是通关条件。每局四间普通房和一间终点房。

## 当前阶段：0.2.0 摇杆试玩

这一版加入底部固定摇杆、轻推短移和更紧凑的冲撞与停稳节奏；重做小獾探宝者与三类敌人的辨识色、灰蓝岩石宝库和铜木器物，首页独立展示动态角色。五间手工房、三种工具、取宝撤离与结算继续保留，包含三首场景配乐、两段胜负音乐和 32 个动作音效变体。

[打开 0.2.0 网页试玩](https://heitamu.github.io/monster-den/web/?v=0.2.0)

此前的 GitHub 写入阻塞已经恢复。0.2.0 被测提交 [`ccfe4169`](https://github.com/HEITAMU/monster-den/commit/ccfe4169c57e1aa2931cf65970c2ffc25ef45a6a) 已在 [工作流 44488941187](https://github.com/HEITAMU/monster-den/actions/runs/44488941187) 通过实际 Chromium / WebGL2 检查：21 次摇杆发射完成五房，覆盖固定摇杆边界、多指归属、取消后恢复、页面刷新和实际音频解码；已生成 14 张真实游戏截图，产物 ID 为 `14512167078`。

**发布记录（2026-11-19）：** 0.2.0 已公开发布并完成 HTTP 校验。被测与已部署的运行代码提交均为 `ccfe4169`；[Pages 工作流 44489644880](https://github.com/HEITAMU/monster-den/actions/runs/44489644880) 成功。入口、构建元数据、启动脚本、改动的编译脚本和两份模型共 11 个文件、2,326,777 字节，与本地逐字节一致；详见 [qa/deployment.json](qa/deployment.json)。本地 98 项测试、严格类型检查、EmptyDevice 集成和新版实际 WebGL 证据同时保留。

浏览器检查使用 **SwiftShader 软件驱动**，并非手机硬件或微信真机；音频已验证解码和播放状态，尚未经过人耳试听。具体证据与限定的 `touchcancel` 诊断见 [qa/README.md](qa/README.md)，续接记录见 [design/HANDOFF.md](design/HANDOFF.md)。

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

广告位 ID 默认留空。激励视频只有收到完整观看确认后才产生一次性奖励凭证。网页广告测试必须显式启用并标注“测试广告（不产生收益）”；它不代表微信广告权限或真实收入。每位玩家使用本机独立存档，不提交开发者存档。

## 美术

角色与主要场景使用真实三维网格、关节部件和材质；不以静态角色图片平移代替动作。Blender 源文件和导出脚本随工程保存。引擎依其原有许可使用，原创游戏代码与美术的权利不因仓库公开而自动转让。


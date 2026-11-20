# 九印王座 · Nine Seals Crown

**Cocos Creator 3.8.8 | 微信小游戏（竖屏） | Browser preview included**

九个带编号的秘印构成 3×3 棋盘。点击四个交点上的旋钮，每次让一块 2×2 区域旋转 90°。将序号恢复为 1–9，即可通关。同一个棋局有严格的最少步数；每日三题固定、人人同题，成绩按「多余步数升序 → 累计耗时升序」排行。

## 已实现

- 384 道经过完整状态 BFS 验证的关卡储备（3–10 步）；整个状态空间 9! = 362,880 状态，直径 11。
- 每日三题（理论最优分别为 5 / 7 / 9 步）、持续闯关、计时、重试、每日本地最佳、存档、最短路径提示、结算动画、动态绘制机关、音效与循环背景音乐。
- 微信分享入口，支持携带日期参数拉起同一挑战。分享不提供奖励，避免诱导转发。
- 微信好友榜：主域写云存储 `wx.setUserCloudStorage`，独立开放数据域 `wx.getFriendCloudStorage` 按同一日期显示真实好友成绩；浏览器环境不伪造好友。
- 三类广告接口：Banner（大厅、结算页）、激励视频（提示）、插屏（每五个关卡清算节点，且间隔至少 180 秒）。预设 ID 为空，未开通流量主前不调用；无广告时提供 **不计榜** 的练习提示。激励视频必须 `isEnded === true` 才授予。
- 浏览器可操作试玩 `preview/index.html`，与 Cocos 源码采用一致的棋盘运算及关卡目录。

## 打开 Cocos Creator 工程

1. 解压本项目，安装并启动 **Cocos Creator 3.8.8**，选择「添加项目」，选中本项目根目录。
2. 打开 `assets/scenes/Main.scene`。如需预览，点击顶部 **预览** 按钮。UI 由 `assets/scripts/CrownGame.ts` 动态创建，**场景内只需 Canvas + UI Camera + CrownGame 组件**。
3. 打开「项目 → 构建发布」，目标平台选 **微信小游戏**，方向选竖屏，设置你自己有权限的微信小游戏 AppID；将 `Main.scene` 设置为初始场景，并勾选「生成开放数据域工程模板」。
4. 构建后检查 `build/wechatgame/openDataContext/index.js` 是否复制了 `build-templates/wechatgame/openDataContext/index.js`；若没有，手动将本项目提供的 `index.js` 覆盖到构建结果同名文件。保持 `game.json` 对开放数据域目录的配置正确。
5. 用微信开发者工具打开 `build/wechatgame`。使用有权限的微信号真机验证分享菜单、好友关系链授权、云存储和广告回调。

**广告开通**：编辑 `assets/scripts/platform/Wechat.ts` 的 `AD_UNITS`，填入自己的三个真实广告位 ID。未填写时不会出现模拟广告或发放虚假广告奖励。实际开通资格、广告版位审核、投放限制请以微信公众平台后台为准。

**排行榜局限**：好友榜使用微信云存储字段，不等于有服务端反作弊。公开现金奖励、重竞技排行榜或大规模运营时应接入服务端校验，不应把客户端上报视为可信。当前仅适合轻量好友比较与测试。

**分享裂变方式**：分享标题带本人挑战成绩，query 携带固定日期 `day=YYYYMMDD`，好友从微信打开可挑战同一套题。未设置“分享才能解锁”或“分享领奖”等诱导流程。

**浏览器试玩**：可用静态 HTTP 服务在 `preview/` 下打开 `index.html`；无需数据库。浏览器只保存本地成绩，好友榜页面会明确标注微信真机限定。浏览器试玩是独立适配层，不是 Cocos 构建包。

**核心算法测试**：本机具有 `node`、`tsc` 时，在根目录执行 `npm test`，穷举校验全 362,880 个状态及全部关卡最少步数，并检查场景资源引用和子域脚本语法。

## 交付状态

已完成工程源码、静态试玩和核心自动测试。**没有在此环境安装 Cocos Creator 3.8.8 编辑器，也无法代替微信主体进行账号认证、广告审核、真机联调或提交上架**。正式发布前需要在真实 Creator 和微信开发者工具中完成构建、适配及真机验收；不要将源码已完成误解为已通过微信审核。

资料：<https://docs.cocos.com/creator/3.8/manual/zh/editor/publish/publish-wechatgame.html>；<https://docs.cocos.com/creator/3.8/manual/zh/editor/publish/build-open-data-context.html>

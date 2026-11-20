# 九印王座 | The Nine Seals

**Cocos Creator 3.8.8** · 微信益智竞技小游戏 · 浏览器交互试玩 · 微信好友排行榜 / 分享 / 广告接口

这不是靠随机闯关的消除游戏。玩家面对九枚编号秘印与四个交叠的 2×2 旋钮。每次点击一个旋钮，可顺时针或逆时针将相邻四枚秘印旋转 90°。目标是把布局恢复到 1–9 的标准排列。**同一局的真正最优步数由完整图搜索验证**，玩家的成绩按“超过最优的步数”优先、完成时间其次排序。

## 当前交付状态（请准确理解）

- ✅ 可运行的浏览器试玩 (`preview/index.html`，建议用本地 HTTP 服务)，与 Cocos 使用相同题库和旋转/判定规则。
- ✅ 原生 Cocos Creator 3.8.8 结构、`Main.scene`、动态 UI、动画、原创生成音效、积分/存档逻辑。
- ✅ 3 关同题每日赛；288 道深度 3–10 的独立题库；持续闯关；提示求解；荣誉勋章/最优完成提示。
- ✅ 微信主域/开放数据域接线：`setUserCloudStorage` 写成绩、`getFriendCloudStorage` 读好友成绩、`sharedCanvas` + `SubContextView` 渲染；不制造假用户。
- ✅ 分享文案、海报及携带 `day` 参数的好友挑战邀请；分享自愿，不靠强制分享解锁奖励。
- ✅ 横幅、激励视频、插屏广告接口和真实播放结束确认/展示频控；**需替换真实广告位 ID 才会出现广告**。
- ✅ 题库生成器对 362,880 个状态作完整 BFS 穷举；`node tests/verify.mjs` 对 288 道题的最优步数和解法进行复核，并检查 TypeScript、场景引用。
- ⚠️ 尚未在 *本地 Cocos Creator 编辑器 + 微信开发者工具 + 微信真机* 里完成打包验证；**不能视为已获微信审核通过或已上架**。
- ⚠️ 纯客户端分数有篡改风险，若要长期办高价值竞赛或商业赛，建议增配独立服务端签名验证和风控。

## 玩法与有竞争力的成就感

开局会显示理论最优步数，消除“是不是随机碰运气”的疑问。每天 3 道全员同题，分别由 5、7、9 步难度库选出；首要比较比数学最优解多走几步，其次才是完成秒数。达成 0 多余步即为“完美复原”，适合晒成绩而不是晒氪金。闯关模式则持续提升题目深度，个人成长与好友压分两条循环互相独立。每日题使用北京时间的自然日 (UTC+8)，同一天所有设备确定性地拿到相同题目。

**操作**：点旋钮执行旋转；切换“顺时针/逆时针”；“重新开始”清零本关；提示来自实时双向 BFS，使用提示的今日成绩不计入好友榜（无广告位时可免费使用该练习提示）。

## 工程结构

```text
assets/scenes/Main.scene             Cocos 主场景（Canvas + UI Camera + CrownGame）
assets/scripts/GameController.ts     原生界面、旋转动效、关卡流程、成绩展示
assets/scripts/core/Puzzle.ts        全部玩法规则、日期、关卡、双向 BFS 解法
assets/scripts/core/Catalog.ts       288 道经深度验证的题目
assets/scripts/platform/WechatBridge.ts  微信社交 + 三种广告 API
assets/resources/audio/*.mp3         程序生成的原创音频
build-templates/wechatgame/openDataContext/index.js  真实微信开放数据域好友榜
build-templates/wechatgame/share.jpg 分享卡片封面
preview/                           可独立体验的 HTML/CSS/JS 游戏
settings/v2/packages/project.json   720 × 1280 设计分辨率
tests/verify.mjs                   自动化校验
```

## 在浏览器试玩

环境：Node.js 或 Python 任意版本。终端进入项目根目录后执行：

```bash
python -m http.server 8765
```

浏览器访问 `http://localhost:8765/preview/`，手机用同一 Wi-Fi 网络与电脑 IPv4 地址访问。试玩只用于验证手感/机制，**不伪装拥有微信好友数据或实际广告**。

## 在 Cocos Creator 3.8.8 打开及构建

1. 安装 Creator **3.8.8**，在 Dashboard 点击“导入项目”，选择包含 `package.json` 的本目录。编辑器完成资源导入后打开 `assets/scenes/Main.scene`。
2. 先在编辑器里点击“预览”。有新增/修改脚本时检查 Console 报错及触控、音频；此项目的自动化代码检查不替代编辑器运行。
3. 在项目 `assets/scripts/platform/WechatBridge.ts` 中，将 `AD_CONFIG` 的 `banner`、`rewarded`、`interstitial` 用自己的已开通微信流量主的广告位 ID 替换。未开通时保持空字符串，避免虚假广告收益承诺。
4. 打开“项目 → 构建发布”，平台选择**微信小游戏**，填写你自己的 **AppID**，勾选**生成开放数据域工程模板**，构建。生成的 `build/wechatgame` 导入微信开发者工具。
5. **强制检查开放数据域**：生成的 `build/wechatgame/openDataContext/index.js` 应与 `build-templates/wechatgame/openDataContext/index.js` 同一版本。如果模板未被完整合并，手动覆盖该文件。微信 `game.json` 须正确指向 `openDataContext` 代码目录。
6. 在微信开发者工具/手机真机分别验证：普通/反向旋转、提示、不完整关闭激励广告、三题成绩写入/好友云成绩读取、两个互为微信好友的测试账号、分享卡携带 `day` 参数、广告窗口不挡手势区域、前后台切换及弱网。
7. 测试通过后，在微信公众平台完善小游戏类目、隐私指引、分享文案、广告接入资格和必要的备案/主体材料，再提交微信审核发布。账号能否开通广告、需要哪些认证，最终以该账号当时后台显示的资格与审核结果为准。

官方参考：
- [Cocos Creator 3.8 开放数据域](https://docs.cocos.com/creator/3.8/manual/zh/editor/publish/build-open-data-context.html)
- [Cocos Creator 微信小游戏发布](https://docs.cocos.com/creator/3.8/manual/zh/editor/publish/publish-wechatgame.html)
- [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/devtools.html)

## 真实好友榜的工作流程

微信主域记录当天 3 道题的最佳有效完成成绩，写入云 Key `nine_seals_daily_v1`。主域打开排名页时仅向开放数据域发送“榜单类型、日期、Key”，没有取好友的权限。开放数据域收到 `wx.onMessage` 后调用 `wx.getFriendCloudStorage` 读取授权好友成绩，只筛选所选日期的合法数据，在 `sharedCanvas` 渲染并由主域 `SubContextView` 显示。只显示真实微信好友；无参赛者显示空榜提示。这是微信关系链限制下的正确方法。

## 广告位

| 类型 | 放置 | 规则 |
| --- | --- | --- |
| Banner | 主界面和结果页底部 | 不压住机关；对战时隐藏 |
| 激励视频 | “提示”按钮 | `onClose` 仅 `isEnded === true` 时发放提示；关闭早了不给 |
| 插屏 | 闯关每 5 关一次的触发点 | 最短间隔 180 秒，不插在逻辑旋转与每日排行中 |

**合规原则**：任何正常关卡都可不看广告通过；分享不绑定领取提示、进度、金币或积分；广告失败时不阻塞游戏。

## 自动化检查

```bash
node tests/verify.mjs
```

校验通过只表明 **代码静态检查 + 棋盘数学可靠性 + 浏览器体验可用**。真实开放数据域 API 只能在微信环境测试，Cocos 原生运行和构建/微信真机功能仍需在本地编辑器验证。

## 隐私及权利

- 代码不上传身份证、手机号、地理位置或自建账户数据。
- 浏览器本机 `localStorage` 保存闯关进度；微信主域通过微信平台提供的云成绩 Key 保存当日相对步数与耗时，开放数据域使用微信平台授权的昵称与头像绘制好友榜；开发者仍需按微信规则完善隐私指引。
- 音频、海报、UI 图形均为本项目生成的原创素材或程序绘制，无第三方 IP 引用。
- 本仓库初稿仅用于开发演示与上架准备，不保证微信审核结果、用户留存或商业收入。

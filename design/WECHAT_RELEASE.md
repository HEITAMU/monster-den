# 微信构建与发布交接

记录日期：2026-11-19（北京时间）。以下步骤对应本仓库的 **0.3.0 源码与网页试玩**，引擎为 Cocos Creator **3.8.8**。网页验收和正式微信构建分别记录。

## 当前到哪一步

**0.2.0 已发布，先前上传阻塞已经恢复。** 发布提交为 [`73bc27f5`](https://github.com/HEITAMU/monster-den/commit/73bc27f5b66597239c8a7ea6261e3f5161a4e80b)，被测运行代码为 [`ccfe4169`](https://github.com/HEITAMU/monster-den/commit/ccfe4169c57e1aa2931cf65970c2ffc25ef45a6a)。[工作流 44488941187](https://github.com/HEITAMU/monster-den/actions/runs/44488941187) 已通过真实 Chromium / SwiftShader WebGL 检查，产物 ID 为 `14512167078`。0.2.0 的摇杆、五房、角色与环境已有该版本的实际浏览器证据；详见 [验证索引](../qa/README.md)。

**0.3.0 已通过实际 Chromium / SwiftShader WebGL 检查。** 被测运行提交为 [`cb2fbffc`](https://github.com/HEITAMU/monster-den/commit/cb2fbffc4afa89de849e6e4ec56b2748dc3d407e)，[工作流 44496981910](https://github.com/HEITAMU/monster-den/actions/runs/44496981910) 成功，产物 `14516385606` 包含报告与 18 张截图。主线五房、第二房钱袋拾取分支、工具状态和触摸边界通过；第四房钱袋由核心路线和实际场景截图覆盖，没有宣称完整两袋路线已在浏览器跑完。模型库新增 `stash` 三维皮革钱袋，与主宝物宝箱区分。下文统计来自本次 0.3.0 文件，完整证据见 [验证索引](../qa/README.md)。

当前尚未取得 Creator 3.8.8 编辑器资源导入、微信构建成功记录及可核验的微信小游戏包。`web/` 是共用玩法源码与 Cocos 引擎的 HTML5 预览，不是可直接上传的微信包。已有 SwiftShader 软件 WebGL 证据不等于手机硬件或微信真机验收；音频解码和播放状态也不等于人耳试听。

真实 `adUnitId` 仍为空，也没有本项目正式账号权限、广告填充或收入凭证。广告状态逻辑测试通过，不等于广告已开通；本地源码或构建产物完成，不等于已上传、审核或上架。下列未执行的步骤均需实际完成并留存结果。

## 1. 用 Creator 3.8.8 打开工程

1. 安装并启动 **Cocos Creator 3.8.8 编辑器**。Dashboard 是启动管理器，命令行构建需要实际编辑器可执行文件。
2. 导入本仓库根目录，即包含 `package.json`、`assets/`、`settings/` 的目录。保留资源对应的 `.meta` 文件。
3. 等待资源导入，打开 `assets/Boot.scene`。确认 `GameMain` 脚本组件正常，Console 没有脚本或自定义 `.effect` 导入错误。
4. 在编辑器预览中确认首页大号角色、角色与环境、新钱袋 `stash`，以及第一间房的固定摇杆：底部同向推动、推距定力度、松手冲撞、回中取消，右侧工具可用，场景区域不能起手。当前设计分辨率为 **720×1280 竖屏**。

编辑器资源导入是独立验证步骤。已有网页运行结果不能证明 `.scene`、`.effect` 和微信适配器已被 Creator 正确处理。

## 2. 生成真正的微信包

### 编辑器界面

打开“构建发布”，新增 **微信小游戏** 任务，使用 `Boot.scene` 作为启动场景，设备方向选择竖屏，填入**本游戏对应账号的 AppID**。AppID 与广告位 ID 是两种不同的标识。不要自动沿用其他项目的账号配置。

构建输出目录应包含 `game.json`、`project.config.json` 和实际平台代码、资源。若界面字段与下方脚本生成的任务配置有差异，先在 3.8.8 编辑器内确认有效配置，再更新脚本；不得把失败退出当作成功产包。

### 仓库构建脚本

`tools/build-creator.cjs` 读取两个环境变量：

| 变量 | 应填写内容 |
| --- | --- |
| `COCOS_CREATOR_388` | 已安装的 3.8.8 编辑器可执行文件绝对路径 |
| `WECHAT_APP_ID` | 本小游戏的实际 AppID，格式为 `wx` 加 16 位十六进制字符 |

**下面的安装路径只是示例，AppID 文本是占位内容，运行前需要替换。** 在仓库根目录执行：

Windows PowerShell：

```powershell
$env:COCOS_CREATOR_388 = 'D:\Cocos\Creator\3.8.8\CocosCreator.exe'
$env:WECHAT_APP_ID = '填写本小游戏真实AppID'
node .\tools\build-creator.cjs wechatgame
```

macOS 终端：

```sh
export COCOS_CREATOR_388="/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator"
export WECHAT_APP_ID="填写本小游戏真实AppID"
node tools/build-creator.cjs wechatgame
```

等效 npm 入口是 `npm run build:wechat`。脚本会生成 `.build/creator-wechatgame.json` 配置，再调用实际编辑器；预期输出为 `build/wechatgame/`。它要求本次构建生成新的 `build/wechatgame/game.json`，避免把旧目录误当新结果。这个文件存在仅证明产物生成，功能仍需下面的工具和真机验证。

### 本项目的 Asset Bundle 与待验包体

资源按以下目录划分为独立 Asset Bundle，微信平台按**小游戏分包**配置。三首完整音乐各占一个 Bundle，模型和短音效分别管理：

| Bundle 名称 | 资源目录 / 文件 | 用途 |
| --- | --- | --- |
| `models` | `assets/models/characters.json`、`assets/models/environment.json` | 角色及场景三维网格 |
| `sound` | `assets/sound/*.mp3` | 32 个动作音效及 `win.mp3`、`lose.mp3` 两段结算音乐 |
| `music-camp` | `assets/music-camp/music-camp.mp3` | 60 秒营地配乐 |
| `music-explore` | `assets/music-explore/music-explore.mp3` | 120 秒探索配乐 |
| `music-boss` | `assets/music-boss/music-boss.mp3` | 96 秒窝主战配乐 |

目录的 `.meta` 声明 Bundle 名称和 `bundleConfigID`，对应配置在 `settings/v2/packages/builder.json`，其中微信平台的 `compressionType` 为 `subpackage`。导入 Creator 后，应逐个选中这些目录，核对它们被识别为 Asset Bundle、Bundle 名称与表一致、微信平台配置为小游戏分包，再构建。运行代码需要先加载对应 Bundle，随后取得其中的 JSON 或 AudioClip；旧的 `resources/models`、`resources/audio` 路径不应继续加载或保留资源副本。模型初始化、营地进入、探索开始、窝主战切换，以及分包首次下载和缓存再进入，都应实际跑通。

0.3.0 的运行模型数据如下，字节数来自本次实际文件，三角面按导出索引数量统计：

| 运行资源 | 打包 JSON 大小 | 三角面 |
| --- | ---: | ---: |
| `characters.json` | 603,556 字节 | 31,308 |
| `environment.json` | 1,635,486 字节 | 62,470 |
| 合计 | 2,239,042 字节，约 2.14 MiB | 93,778 |

新增钱袋 `stash` 为单个导出节点、2,375 顶点、3,258 三角面，宽约 0.809、深约 0.624、高约 0.805 模型单位，根在脚点原点。环境库现为 12 类 prefab、13 个导出节点；原 11 类环境与角色保持不变。来源、边界及本次重新测量的量化误差见 [美术说明](../art-source/README.md)。

三首长音乐原始 MP3 本次核对为营地 960,996 字节、探索 1,921,048 字节、窝主 1,536,949 字节，分别约 **0.92、1.83、1.47 MiB**，本轮钱袋更新没有改动这些文件。以上文件大小不是 Creator 的微信主包或分包统计；93,778 面是两个模型库的总数，不是同屏实例复制后的实际绘制面数。模型的中间数据位于 `.build/raw-models/`，不应作为重复资源加入游戏。尤其不能因为模型已移入一个独立 Bundle，就推断这个分包已经满足大小要求。

**目前没有 Creator 生成的微信包、真实包体报告或微信真机验收，不能声称包体合规验证完成。** 首次正式构建后，必须检查主包、各分包和整体的实际统计及开发者工具报告；若超出当前平台要求，再调整模型数据、引擎裁剪或进一步拆包，并验证对应加载方式、缓存和更新。不要以网页构建大小或预计压缩比代替正式报告。

当前构建脚本的 `remoteServerAddress` 为空，没有配置远程资源服务。上述分包安排不意味着已经部署 CDN；如之后改成远程 Bundle，需要部署实际资源并重新验证。GitHub 的网页试玩地址也不是已配置好的微信资源服务。

## 3. 微信开发者工具与真机

1. 在微信开发者工具导入 **`build/wechatgame/`**，选择小游戏项目，核对项目 AppID。不要导入仓库根目录或 `web/`。
2. 编译后检查 Console 和资源加载：角色应为可动三维网格，场景与材质完整，首页能开始新局，第二间房的柜子能挡箭，第五间房能拿宝物撤离。
3. 使用该项目有权限的账号生成预览，在微信中用 iPhone 和 Android 分别实际运行。记录设备、系统、微信版本、构建提交与录屏。
4. 真机重点走一遍：首次与缓存启动；摇杆八方向、轻推与满推、回中取消、第二触点、场景起手被拒绝和右侧工具点击；连续进入五间房；切后台再返回；失败后重新进入；胜利结算后重新进入；音乐播放超过两分钟仍连续循环。具体路线见 [PLAYTEST.md](PLAYTEST.md)，须核对路线与本次发射调参版本一致。

若真机加载缓慢、卡顿或颜色发黑，应定位模型加载、首次音频读取与解码、自定义材质和实际帧耗时。当前 Blender 摄影棚预览不能代替微信实际画面验收。

## 4. 填入广告位并验证发奖

**当前配置位置：`assets/scripts/GameMain.ts` 中构造 `new RewardedAds(...)` 的地方。** 现在是：

```ts
new RewardedAds({
  ledger: this.save,
  adUnitId: '',
  allowWebTestAds: false,
  // onPhaseChange 等现有配置继续保留
});
```

在本游戏账号后台实际具备相应权限并取得激励视频广告位 ID 后，将空字符串替换为该广告位的真实 ID，再重建微信包。当前救援与结算加领金币共用这一广告服务；代码中的 `placement` 区分奖励用途。后续若集中到单独配置文件，应同时更新本节指向。

`WECHAT_APP_ID` 不会自动填入广告位，也不会自动开通广告权限。当前空配置在微信返回“正式激励广告尚未配置”，不会模拟成功或自动发奖。

用真实环境分别核验：完整观看、提前关闭、加载或播放错误、连续点击、同一局再次救援，以及完整观看后中断再进入。只有明确完整观看才生成奖励凭证；游戏状态与凭证核销需一起持久化。广告缺填充或返回错误时，普通游戏流程仍应能继续。

网页测试模式只能主动开启并清楚显示“测试广告（不产生收益）”。它仅检查回调与存档流程，不能写成真实广告测试结果。账号后台实际状态、真实广告展示和到账情况，需要各自的证据。

## 5. 上传前留存的实际结果

至少保存本次 Creator 构建日志、包体报告、开发者工具运行结果、两类真机录屏及广告回调结果，并标明最终源码和资源哈希。0.3.0 已有与提交 `cb2fbffc` 对应的真实 Chromium / SwiftShader WebGL 证据和源码指纹；该证据不能用于宣称 Creator 微信构建、包体合规、手机硬件或微信真机验收完成。使用最终游戏画面制作本游戏自己的头像和展示截图；不要借用其他项目素材或把 Blender 摄影棚图冒充游戏运行截图。

之后通过正确账号的开发者工具上传，再按该账号后台实际显示的要求完成后续流程。本文不猜测未查看账号的资质状态、审核结论、开通门槛或上线时间。

## 已查官方参考

- [Cocos Creator 3.8：发布到微信小游戏](https://docs.cocos.com/creator/3.8/manual/zh/editor/publish/publish-wechatgame.html)：微信构建、AppID、平台运行环境和资源管理。
- [Cocos Creator 官方下载与版本说明](https://www.cocos.com/creator-download)：取得指定编辑器版本。
- [腾讯广告：激励广告组件操作指引 PDF](https://training.tencentads.com/uploads/202406/nTROJ2vg_hpC4C1.pdf)：关闭回调与 `isEnded` 完整观看判断。该资料用于接口行为说明，不作为当前账号准入条件的证明。

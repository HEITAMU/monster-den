# 微信小游戏接入清单（目标引擎 Cocos Creator 3.8.8）

参考 [官方发布说明](https://docs.cocos.com/creator/3.8/manual/zh/editor/publish/publish-wechatgame.html) 和 [小游戏分包说明](https://docs.cocos.com/creator/3.8/manual/zh/editor/publish/subpackage.html)。

1. 在 Cocos Creator 3.8.8 打开工程、等待导入并确认入口为 `assets/Boot.scene`；先修复任何 Editor 警告。
2. 构建平台选择「微信小游戏」，方向竖屏，填**真实小游戏** AppID（不要复用其他游戏 AppID 或 Cocos 示例 ID），选择压缩与包体策略。
3. 微信小游戏主包按 4MB 限制核验；项目 `assets/resources/art/` 约 0.92 MB 还要加引擎、音频和构建资源。正式打包时须测量构建后主包；必要时使用微信分包/远程资源（资源域名校验及缓存策略）。
4. 在微信开发者工具模拟器验证 UI、触控、生命周期、网络加载；模拟器通过并不等于手机通过。
5. 真实安卓和 iPhone 多机检查：启动时间、纹理压缩、场景首次渲染、低内存重启、音频播放、帧时间、发热和横竖屏方向。
6. 配置微信广告后台的真实激励广告 ID（`WeChatRewarded.ts` 中空字符串）。仅 `isEnded === true` 发放额外奖励；提前关闭、出错、重复回调、离开小游戏、连续点击均需真机验证。
7. 发布前检查用户数据处理说明、隐私合规、备案/主体、素材著作权、广告标识及微信审核标准。没有真实后台权限不能声称已接入广告或已产生收入。

**目前未执行 Cocos Creator 编辑器构建和微信真机环节。**

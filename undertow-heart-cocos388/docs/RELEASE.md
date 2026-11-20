# 上架核验说明

**版本：** Cocos Creator 3.8.8（必须编辑器核验）。推荐竖屏 720×1280 设计分辨率。

1. Cocos Dashboard 导入后检查脚本 `UndertowGame` 组件；运行预览确认玩家收容与发射、3D 材质、UI均显示且方向正确。
2. 微信小游戏构建时填入自己的正式 AppID，设备方向 Portrait，微信开发者工具导入输出构建文件夹。不要将本仓库的源码目录当作已完成的微信包上传。
3. 广告权限由微信公众平台授予。仅真实 `adunit-...` 配置后可用。测试完整播放、提前关闭、广告错误、重复回调；奖励只在 `isEnded===true` 时发放且同一局最多复活/双倍各一次。
4. 需要完成微信小游戏官方要求的相关备案、合规及审核。个人主体是否符合所选广告功能需要以当前后台为准。
5. 用中低端 Android 和 iPhone 真机测试：帧率（建议至少 30FPS）、首次加载、触控跟手、内存使用和暂停恢复。本项目动态曲面创建使用共享网格缓存，仍需要实际性能验收。
6. 当前包体体积请以实际 Cocos 构建输出为准；微信小游戏主包常见限制 4MB，具体以微信发布文档和微信开发者工具显示为准。

官方技术文档：
- https://docs.cocos.com/creator/3.8/manual/zh/editor/publish/publish-wechatgame.html
- https://docs.cocos.com/creator/3.8/manual/zh/editor/publish/subpackage.html

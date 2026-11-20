这里是**真实微信开放数据域**，不是模拟榜。

在 Cocos Creator 3.8.8 构建微信小游戏时勾选“生成开放数据域工程模板”；
构建出的 `build/wechatgame/openDataContext/index.js` 应为此版本。若编辑器未自动复制，
将本文件夹中的 `index.js` 手动覆盖到构建结果同名目录，并确认 `game.json`
中的 `openDataContext` 指向该目录。

关系链数据只能在子域中调用 `getFriendCloudStorage`，不得回传主域；本文件只绘制 `sharedCanvas`。

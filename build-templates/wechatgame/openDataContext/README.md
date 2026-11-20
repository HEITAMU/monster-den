本文件夹是微信开放数据域源码。需要在 Cocos Creator 3.8.8 构建时勾选「生成开放数据域工程模板」，再核对/覆盖生成目录 `build/wechatgame/openDataContext/index.js`。好友关系链数据只在开放数据域访问和绘制 sharedCanvas；主域不要直接调用 getFriendCloudStorage。

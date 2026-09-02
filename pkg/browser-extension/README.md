# Lexis Web(Chrome 扩展)

在任意网页上高亮你 Obsidian **Lexis** 词库里的单词、悬停看释义。和本机的 Lexis 桥接通信,数据始终在你的 vault 里、不出本机。

## 前置:开 Lexis 桥接

1. Obsidian → Lexis 设置 → 最下面「浏览器扩展(桥接)」→ 打开**启用本地桥接**。
2. 记下**端口**(默认 12345)和**访问令牌**(点复制)。

## 装扩展

1. Chrome 地址栏进 `chrome://extensions`。
2. 右上角打开**开发者模式**。
3. 点**加载已解压的扩展程序**,选这个 `pkg/browser-extension/` 文件夹。
4. 点工具栏的 Lexis Web 图标 → 填**令牌**(端口默认就行)→ 点**测试连接**应显示已连上 → 点**同步词库**。
5. 打开任意网页,词库里的词会高亮,鼠标悬停看释义。

## 装 Firefox 版

Firefox 用的是同一份源码,manifest 不同。先构建:

```sh
sh pkg/browser-extension/scripts/build.sh
```

生成 `pkg/browser-extension/dist/firefox/`(未打包目录)和 `dist/lexis-web-firefox-<版本>.zip`。

1. Firefox 地址栏进 `about:debugging#/runtime/this-firefox`。
2. 点**临时载入附加组件**,选 `dist/firefox/manifest.json`(或选 zip)。
3. 点工具栏的 Lexis Web 图标 → 填**令牌** → 点**测试连接**。**Firefox 首次会弹框请求访问 `127.0.0.1` 的权限,必须点允许**,否则连不上本地桥接(拒绝的话再点一次测试连接会重新请求)。
4. 之后同 Chrome:同步词库 → 打开网页看高亮和悬停释义。

注意:临时附加组件在 Firefox 重启后会消失,需要重新载入;想长期安装要在 [addons.mozilla.org](https://addons.mozilla.org/developers/) 做 unlisted 签名后安装签好的 xpi。

## 说明

- **高亮**用本地缓存,Obsidian 关着也有;**悬停释义 / 同步词库**需要 Obsidian 开着且桥接启用。
- popup 的「当前网站词典」可以单独控制当前网站显示哪些词典。每个网站分别保存,不跟随 Obsidian 的词典开关,切换后页面立即更新。
- 不想在网页悬浮卡显示记忆曲线时,关闭 popup 里的「悬浮卡显示记忆曲线」。
- 词典显示开关立即生效;修改其他高亮外观后刷新网页生效。
- 颜色/线型可在 popup 里调,默认对齐 Obsidian 里的波浪线。

# Lexis Web（Chrome / Firefox 扩展）

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
- popup 的「划词弹丸位置」支持拖动预览、横纵像素偏移和重置；方向键微调，Shift + 方向键每次 10 像素。位置独立保存在此浏览器的本地存储，全站通用，不跟随 Obsidian，也不会被词库同步覆盖。修改后网页已有弹丸立即移位，不重建选区；默认仍在选区下方居中，靠近底部自动翻到上方。
- 词典显示开关立即生效;修改其他高亮外观后刷新网页生效。
- 颜色/线型可在 popup 里调,默认对齐 Obsidian 里的波浪线。
- 支持网页中的 open Shadow DOM 阅读组件，包括 Video Marker Lab 的侧边字幕和画面字幕；切换字幕、保存编辑后会重新高亮。输入框、编辑器和真正隐藏的文字不扫描，也不修改字幕轨道数据。画面划词建议先暂停，避免播放换句使选区消失。
- 字幕出处带视频时间：侧边列表取该句起始时间，画面字幕取划词时播放时间，选词后不会随播放前进而改写。YouTube、Bilibili 链接附加 `t` 参数并保留原视频/分 P；其他网站保留原链接并在标题显示时间，不保证点击能定位。不自动生成内嵌视频或区间循环播放器。
- 其他组件可以用 `data-lexis-ignore` 明确禁止扫描。封闭的 Shadow DOM、浏览器内部页面和其他扩展的独立页面不在此范围内。
- 划词出处保留公式源码：读取 KaTeX 的 TeX annotation、MathJax v2 源码脚本，以及 MathJax 已排版的 MathItem；输出 `$…$` 或 `$$…$$`，不重排网页、不改选区。MathJax 的页面适配只读取源码，没有令牌、词库数据或网络请求。页面主环境适配需要 Chrome 111+ / Firefox 128+；旧浏览器仍可读取 DOM 中保留的源码。图片公式不做 OCR，缺少原始 TeX 时不会猜公式。

## 验证

在仓库根目录运行 `npm test`、`npm run test:browser-shadow`、`npm run test:browser-math` 和 `npm run test:browser-pill-position`。浏览器测试使用隔离的 Chrome 测试页，不代替真实扩展验收；公式测试把页面和内容脚本放在不同环境，检查源码、顺序、换行及原选区不变。位置测试检查保存、恢复、重置、拖动取消、日夜窄面板与网页实时移位。

源码读取依据：[MathJax MathItem](https://docs.mathjax.org/en/latest/web/typeset.html#looking-up-the-math-on-the-page)、[内容脚本环境兼容性](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/content_scripts#world)。

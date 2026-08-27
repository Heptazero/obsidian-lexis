# Lexis for Zotero

Zotero 9 的 Lexis 阅读端。它不再实现一套词典：词库索引、卡片最终 HTML、MathJax 样式、标签/词典规则和所有写入都来自 Obsidian Lexis 的本机桥接。

## 能力

- PDF 内容流坐标自动高亮，支持同一行拆片、跨行断词、连字符换行、中英文短语。
- 缩放、翻页和 PDF.js 重绘后自动恢复高亮。
- 悬停卡片使用与浏览器端相同的隔离样式，整张卡片滚动，并直接显示 Obsidian 输出的 HTML 与公式样式。
- 卡片支持加出处、批注、标签、移动词典、删除；修改和删除位于右上角。
- Zotero 原生划词浮窗中提供 `＋ / 词典 / 🔗`，来源写入论文标题、选中文字、页码和 `zotero://open-pdf` 链接。
- Obsidian 断线时继续使用本地词库；写操作排队，恢复连接后按顺序提交。

扫描版 PDF 没有文字层时不会命中，需要先用 OCR 插件生成可选择文字。

## 构建

```sh
./scripts/build.sh
```

生成的 XPI 位于 `dist/lexis-zotero-0.1.10.xpi`。

## 安装

在 Zotero 中打开“工具 → 插件”，把 XPI 拖入窗口或从齿轮菜单选择“Install Plugin From File…”。安装后在“设置 → Lexis for Zotero”填写与浏览器扩展相同的地址、端口和桥接令牌，然后测试连接。

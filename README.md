# Lexis

把指定文件夹里的笔记标题当作单词库的 Obsidian 单词学习插件:全文高亮、悬浮释义、FSRS 间隔重复背诵、出处自动聚合、词与词根的双向关系、热力图。纯 JS、无构建步骤。

> An Obsidian vocabulary-learning plugin: treat note titles in a folder as your word bank — highlight + hover, FSRS spaced repetition, auto-collected example occurrences, typed bidirectional relations, and a review heatmap. No build step.

## 功能

- **文件夹即词库**:指定一个文件夹,里面每个笔记的标题就是一个单词(支持别名)。
- **高亮 + 悬浮**:阅读与实时预览里高亮库中出现的词,悬停看释义;颜色/线型可按标签映射。
- **FSRS 背单词**:翻卡复习,进度写进笔记 frontmatter(`lexis-*`);支持「单词→整篇」和「例句填空」两种卡面;撤销、跳过。
- **Lexis 主页**:统计 + 热力图 + 按标签/词频/随机选集合开始复习。
- **划词添加**:选中→右键/命令建单词文件,自动记录出处。
- **`​```lexis` 代码块**:在笔记里渲染遗忘曲线、分类双向相关词、出现过的地方(去重 + 可收藏)。
  - 模式:`curve` / `rel [类型]` / `occ` / `derived`(词根派生词)/ 留空=全部。
- **分类双向关系**:近义词/同根词/形近词/辨析 + 词根——只在一边写 `[[链接]]`,两边都显示。

## Installation / 安装

**From Community Plugins (recommended):** open *Settings → Community plugins → Browse*, search for **Lexis**, install, then enable.

**Manual:** download `main.js`, `manifest.json` and `styles.css` from the [latest release](https://github.com/Heptazero/obsidian-lexis/releases) into `<vault>/.obsidian/plugins/lexis/`, then enable Lexis under *Settings → Community plugins*.

> 从社区插件市场搜索 **Lexis** 安装并启用;或手动把 `main.js`、`manifest.json`、`styles.css` 放进 `<vault>/.obsidian/plugins/lexis/` 再启用。

## Usage / 用法

1. **Pick a word-bank folder.** In *Settings → Lexis*, add one or more "dictionary" folders. Every note title inside becomes a word (aliases supported).
2. **Read & hover.** Matching words are highlighted in reading/live-preview; hover to see the definition. Highlight color/style can be mapped per tag or per dictionary folder.
3. **Add words on the fly.** Select text in any note → right-click *Add to Lexis* (or use the command). The source sentence is recorded automatically as an occurrence.
4. **Review.** Open the **Lexis** home view for stats, a heatmap, and FSRS spaced-repetition review (word→note and cloze cards; undo/skip supported).
5. **In-note blocks.** Add a `​```lexis` code block to render the forgetting curve (`curve`), related words (`rel [type]`), occurrences (`occ`), or root-derived words (`derived`); leave the mode blank for all.

> 中文用法见上方「功能」一节:设置里指定词库文件夹 → 阅读时自动高亮悬浮 → 划词添加 → Lexis 主页背诵 → 笔记里用 `​```lexis` 块渲染曲线/相关词/出处。

## 隐私与本机桥接 / Privacy & local bridge

可选的配套浏览器扩展通过本机桥接通信:插件**只在自己填的端口上监听**(不对外网开放)、**token 鉴权**、**数据不出本机**。桌面端才会启动该服务(`require("http")` 在移动端缺失时自动跳过);不装扩展、不用这功能则桥接根本不启动。

> The optional companion browser extension talks to the plugin over a local bridge that listens **only on a loopback port you configure** (never exposed to the network), requires **token auth**, and **never sends your data off your machine**. The server starts on desktop only and is skipped entirely if you don't use the feature.



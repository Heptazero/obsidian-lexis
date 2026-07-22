# Lexis

An Obsidian vocabulary-learning plugin: treat note titles in a folder as your word bank — highlight + hover, FSRS spaced repetition, auto-collected example occurrences, typed bidirectional relations, and a review heatmap. No build step.

> 把指定文件夹里的笔记标题当作单词库的 Obsidian 单词学习插件:全文高亮、悬浮释义、FSRS 间隔重复背诵、出处自动聚合、词与词根的双向关系、热力图。纯 JS、无构建步骤。

## Features

- **A folder is your word bank.** Point Lexis at a folder — every note title inside becomes a word (aliases supported).
- **Highlight + hover.** Matching words are highlighted in reading and live-preview mode (including Obsidian's built-in PDF viewer); hover to see the definition. Color/style can be mapped per tag or per dictionary folder.
- **FSRS spaced repetition.** Flip cards to review; progress is written into note frontmatter (`lexis-*`). Two card styles — word→note and cloze (fill-in-the-example) — with undo and skip.
- **Lexis home view.** Stats, a review heatmap, and start a review session filtered by tag/frequency/random selection.
- **Add words on the fly.** Select text anywhere → right-click/command to create a word note; the source sentence is recorded automatically as an occurrence.
- **`​```lexis` code blocks.** Render the forgetting curve, typed bidirectional related words, or all recorded occurrences (deduped, favoritable) directly inside a note.
  - Modes: `curve` / `rel [type]` / `occ` / `derived` (root-derived words) / blank = all.
- **`​```lexis-home` / `​```lexis-heatmap` blocks.** Embed a mini Lexis home page (stats + review heatmap) — or just the heatmap — in any note; click through to open the real home view or jump straight into review.
- **Typed bidirectional relations.** Synonyms / cognates / look-alikes / usage-notes + word roots — write the `[[link]]` on one side only, it shows on both.

> - **文件夹即词库**:指定一个文件夹,里面每个笔记的标题就是一个单词(支持别名)。
> - **高亮 + 悬浮**:阅读与实时预览里高亮库中出现的词(含 Obsidian 内置 PDF 阅读器),悬停看释义;颜色/线型可按标签映射。
> - **FSRS 背单词**:翻卡复习,进度写进笔记 frontmatter(`lexis-*`);支持「单词→整篇」和「例句填空」两种卡面;撤销、跳过。
> - **Lexis 主页**:统计 + 热力图 + 按标签/词频/随机选集合开始复习。
> - **划词添加**:选中→右键/命令建单词文件,自动记录出处。
> - **`​```lexis` 代码块**:在笔记里渲染遗忘曲线、分类双向相关词、出现过的地方(去重 + 可收藏)。
>   - 模式:`curve` / `rel [类型]` / `occ` / `derived`(词根派生词)/ 留空=全部。
> - **`​```lexis-home` / `​```lexis-heatmap` 代码块**:在任意笔记里嵌一份 Lexis 主页摘要(统计+热力图),或者只放热力图;点一下就能跳到真正的主页/直接开始背诵。
> - **分类双向关系**:近义词/同根词/形近词/辨析 + 词根——只在一边写 `[[链接]]`,两边都显示。

## Installation

**From Community Plugins (recommended):** open *Settings → Community plugins → Browse*, search for **Lexis**, install, then enable.

**Manual:** download `main.js`, `manifest.json` and `styles.css` from the [latest release](https://github.com/Heptazero/obsidian-lexis/releases) into `<vault>/.obsidian/plugins/lexis/`, then enable Lexis under *Settings → Community plugins*.

> 从社区插件市场搜索 **Lexis** 安装并启用;或手动把 `main.js`、`manifest.json`、`styles.css` 放进 `<vault>/.obsidian/plugins/lexis/` 再启用。

## Usage

1. **Pick a word-bank folder.** In *Settings → Lexis*, add one or more "dictionary" folders. Every note title inside becomes a word (aliases supported).
2. **Read & hover.** Matching words are highlighted in reading/live-preview; hover to see the definition. Highlight color/style can be mapped per tag or per dictionary folder.
3. **Add words on the fly.** Select text in any note → right-click *Add to Lexis* (or use the command). The source sentence is recorded automatically as an occurrence.
4. **Review.** Open the **Lexis** home view for stats, a heatmap, and FSRS spaced-repetition review (word→note and cloze cards; undo/skip supported).
5. **In-note blocks.** Add a `​```lexis` code block to render the forgetting curve (`curve`), related words (`rel [type]`), occurrences (`occ`), or root-derived words (`derived`); leave the mode blank for all. Add a `​```lexis-home` block anywhere to embed the stats + heatmap summary, clickable through to the full home view.

> 中文用法见上方「Features」一节:设置里指定词库文件夹 → 阅读时自动高亮悬浮 → 划词添加 → Lexis 主页背诵 → 笔记里用 `​```lexis` 块渲染曲线/相关词/出处。

## Privacy & local bridge

The optional companion browser extension talks to the plugin over a local bridge that listens **only on a loopback port you configure** (never exposed to the network), requires **token auth**, and **never sends your data off your machine**. The server starts on desktop only and is skipped entirely if you don't use the feature.

> 可选的配套浏览器扩展通过本机桥接通信:插件**只在自己填的端口上监听**(不对外网开放)、**token 鉴权**、**数据不出本机**。桌面端才会启动该服务(`require("http")` 在移动端缺失时自动跳过);不装扩展、不用这功能则桥接根本不启动。

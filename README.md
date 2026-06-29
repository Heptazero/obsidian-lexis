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

## 安装

把本仓库克隆/解压到你的库 `<vault>/.obsidian/plugins/lexis/`,在 Obsidian 第三方插件里启用。

## 隐私与本机桥接 / Privacy & local bridge

可选的配套浏览器扩展通过本机桥接通信:插件**只在自己填的端口上监听**(不对外网开放)、**token 鉴权**、**数据不出本机**。桌面端才会启动该服务(`require("http")` 在移动端缺失时自动跳过);不装扩展、不用这功能则桥接根本不启动。

> The optional companion browser extension talks to the plugin over a local bridge that listens **only on `127.0.0.1:45945`**, requires **token auth**, and **never sends your data off your machine**. The server starts on desktop only and is skipped entirely if you don't use the feature.



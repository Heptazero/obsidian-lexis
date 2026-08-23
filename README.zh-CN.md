# Lexis

[English](./README.md)

Lexis 是 Obsidian 的本地优先个人词典。数据就是库里的普通 Markdown 文件，不需要账号、云服务或专有数据库。

## 功能

### 一个文件一个词条，或一个文件多个词条

- **一个文件一个词条**：指定一个或多个文件夹。每个笔记标题都是词条，也会识别 frontmatter 中的别名。
- **一个文件多个词条**：给笔记添加 `lexis-inline: true`，再写 `名字:: 批注`。适合记录小说里反复出现的人名、地名、物品和势力，不必创建大量小文件。

```md
---
lexis-inline: true
---

## 人物
叶尔达:: 画师，在不同章节使用过多个名字。
奥托:: 用笔记本保存别人会忘记的信息。
```

### 在不同阅读界面使用同一个词库

Lexis 会高亮已收录的词，悬停显示笔记。支持：

- Obsidian Markdown、实时预览和内置 PDF 阅读器
- 兼容的 epub.js EPUB 阅读器
- 通过 **Lexis Web** 支持 Chromium 浏览器
- 通过 **Lexis for Zotero** 支持 Zotero Reader

划词后可以加入指定词典、收藏出处或设为已有词条的别名。Obsidian 始终是唯一数据源；浏览器与 Zotero 通过带令牌的本机回环桥接访问数据。

### 复习仍未记住的内容

- FSRS 间隔重复：整篇笔记卡和出处填空卡
- 到期/新词统计、复习热力图、撤销、跳过、按标签选卡
- 高亮随记忆稳定度提高而渐隐
- 真实阅读中的悬停可以把较远的复习日期拉近
- 按“长期没有自然相遇”列出淘汰候选，最终决定始终由你做

## 安装

### Obsidian

在“设置 → 第三方插件 → 浏览”中搜索 **Lexis**。手动安装时，从[最新 Obsidian release](https://github.com/Heptazero/obsidian-lexis/releases/latest)下载 `main.js`、`manifest.json`、`styles.css`，放入 `<vault>/.obsidian/plugins/lexis/`。

### 浏览器插件

1. 从最新的 [`browser-v*` release](https://github.com/Heptazero/obsidian-lexis/releases?q=browser-v) 下载 `lexis-web-*.zip` 并解压。
2. 打开 `chrome://extensions`，启用“开发者模式”，选择“加载已解压的扩展程序”。
3. 在 Lexis 设置中启用“本机桥接”，把端口和访问令牌填入 Lexis Web。

开发者模式加载的 Chrome 扩展不会自动更新。新版本发布后，用新文件夹替换旧文件夹。

### Zotero 插件

1. 从最新的 [`zotero-v*` release](https://github.com/Heptazero/obsidian-lexis/releases?q=zotero-v) 下载 `lexis-zotero-*.xpi`。
2. 在 Zotero 中打开“工具 → 插件”，选择“从文件安装插件”。
3. 填入同一个本机桥接端口和令牌。

第一次手动安装后，Zotero 可以通过插件内的更新地址自动更新。

## 快速开始

1. 在“设置 → Lexis”中添加词典文件夹。
2. 阅读 Markdown、PDF 或 EPUB。命中的词会高亮，悬停显示卡片。
3. 划词加入词典；Lexis 可以把所在句子一起保存为出处。
4. 打开 Lexis 主页，复习到期词条或处理淘汰候选。

设置页可切换中文和 English。翻译按消息键集中在 `src/i18n.js`，每句中英文挨在一起；新增语言不需要在界面代码中到处找文字，也不依赖 AI 记住旧翻译的位置。

## 笔记代码块

在词条笔记中使用 `lexis` 代码块：

- `curve`：记忆保留曲线
- `rel [类型]`：分类双向关系
- `occ`：尚未收藏的出处
- `derived`：同词根派生词
- 留空：显示适用的全部区块

`lexis-home` 用于嵌入主页摘要，`lexis-heatmap` 只显示热力图。

## 为什么是个人词典

Lexis 的出发点是：**词汇是基础设施，不是学习科目。** 每进入一个领域，术语就多一层；半懂不懂的词，恰好最容易在阅读时被眼睛略过。

- **随身的词典可以成为记忆的一部分**：[Clark 与 Chalmers 的延展心智论](https://www.alice.id.tue.nl/references/clark-chalmers-1998.pdf)讨论了一个持续可得、被稳定信任的外部存储如何像回忆一样工作。Lexis 追求的就是同一个词库、悬停即查、出现在每个阅读界面。
- **高亮负责让你注意到**：文本增强研究显示，视觉增强会吸引注意，并能改善相对未增强输入的学习效果（[眼动研究](https://www.cambridge.org/core/journals/applied-psycholinguistics/article/investigating-the-effects-of-prolonged-exposure-to-textual-enhancement-on-attention-and-learning-a-preposttest-measures-eyetracking-study/AC5C9DE823DEC3613B31C260393D32A8)、[词汇与语法研究](https://www.cambridge.org/core/journals/studies-in-second-language-acquisition/article/investigating-textual-enhancement-and-captions-in-l2-grammar-and-vocabulary/EF080D9AC64C7E2BFFB90AC799C38C69)）。它不能代替记忆提取。
- **词靠反复相遇学会**：查一次只是一个事件；在真实语境中反复遇到，才逐渐变成知识。全局高亮把普通阅读变成再相遇的来源。
- **注意到不等于记住**：因此 Lexis 把注意与复习分开。高亮让术语被看见，[FSRS](https://github.com/open-spaced-repetition/fsrs4anki/wiki/ABC-of-FSRS)负责安排提取练习。

Lexis 不承诺读得更快，也不承诺不费力地学习。

## 为什么高亮会渐隐、复习会回流、词条会被淘汰

- **显著性是稀缺资源**：重复的视觉提示会逐渐失效，与界面研究中的 [banner blindness](https://en.wikipedia.org/wiki/Banner_blindness) 属于同一类现象。FSRS stability 增长后，高亮会淡向可调下限；技能内化后，辅助物应该退场。
- **悬停可能暴露回忆卡顿**：[测试效应](https://en.wikipedia.org/wiki/Testing_effect)与[合意难度](https://en.wikipedia.org/wiki/Desirable_difficulty)相关研究说明，尝试提取本身有信息量。悬停也可能只是好奇，所以 Lexis 最多把日期拉近，不把它计作复习，也不修改难度分数。
- **重要性只能从使用中显现**：添加时无法知道一个词会成为领域骨架，还是再也不会出现。Lexis 只摆出长期未相遇的证据，让你选择淘汰、留下或已掌握，从不自动裁决。
- **个人词典是只有一个读者的 OED**：[牛津英语词典](https://en.wikipedia.org/wiki/Oxford_English_Dictionary)曾依靠带日期和来源的引文卡片积累语料。Lexis 把同一种模式用于一个人的阅读史：释义和出处从真实相遇中长出来。

## 隐私与结构

- 词典数据保存在库内普通 Markdown 文件中。
- 复习状态保存在 `lexis-*` frontmatter 字段中。
- 可选桥接只监听可配置的本机回环端口，并要求令牌。
- 浏览器和 Zotero 伴侣端不会形成另一套数据库。
- 没有文字层的扫描版 PDF 无法高亮。

## 开发

仓库同时包含三个端：

- Obsidian：`src/`，构建为 `main.js`
- 浏览器：`browser-extension/`
- Zotero：`zotero-extension/`

问题与贡献请提交到 [GitHub 仓库](https://github.com/Heptazero/obsidian-lexis)。

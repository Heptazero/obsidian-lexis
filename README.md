# Lexis

A personal dictionary for Obsidian. Not just language learning: every field you enter brings its own jargon, and the words you half-know are exactly the ones your eyes skip while reading. Lexis turns a folder of notes into your personal lexicon — words, terms, names — highlighted everywhere you read (Obsidian, its PDF viewer, and via a companion extension, your browser), with hover definitions, FSRS spaced-repetition review, auto-collected occurrences, and a review heatmap. No build step.

> Obsidian 个人词典插件。不只是学外语:每进入一个领域,术语就多一层,而你半懂不懂的词恰恰是阅读时眼睛会滑过去的词。Lexis 把一个文件夹变成你的个人词库——单词、术语、人名——在你阅读的一切地方永久高亮(Obsidian、内置 PDF 阅读器,配套扩展覆盖浏览器),悬浮释义、FSRS 间隔重复、出处自动聚合、热力图。纯 JS、无构建步骤。

## Why a personal dictionary

Lexis is built on one claim: **your vocabulary is infrastructure, not a study subject.** The design leans on three lines of research and one idea from philosophy — and is honest about what each one does and does not support.

- **A dictionary that is always with you becomes part of your memory.** Clark & Chalmers' extended-mind thesis ([*The Extended Mind*, 1998](https://www.alice.id.tue.nl/references/clark-chalmers-1998.pdf)) argues that an external store which is constantly available and automatically consulted functions as memory itself, not as a tool — their example is Otto, who navigates by a notebook he trusts like recall. Lexis aims at exactly those conditions: one word bank, consulted by hover instead of lookup, present in every reading surface you use.
- **Highlighting works — for noticing.** Schmidt's [noticing hypothesis](https://en.wikipedia.org/wiki/Noticing_hypothesis) holds that you cannot acquire what you do not notice. Eye-tracking and meta-analytic work on textual input enhancement finds that visually enhanced words [consistently attract attention over time and are learned significantly better than unenhanced ones](https://www.cambridge.org/core/journals/applied-psycholinguistics/article/investigating-the-effects-of-prolonged-exposure-to-textual-enhancement-on-attention-and-learning-a-preposttest-measures-eyetracking-study/AC5C9DE823DEC3613B31C260393D32A8), with [comparable effects for vocabulary and grammar](https://www.cambridge.org/core/journals/studies-in-second-language-acquisition/article/investigating-textual-enhancement-and-captions-in-l2-grammar-and-vocabulary/EF080D9AC64C7E2BFFB90AC799C38C69).
- **Words are learned by re-encounter, not by one lookup.** The incidental-acquisition literature consistently shows that a single exposure contributes almost nothing; retention builds over repeated encounters in context. Permanent global highlighting is engineered re-encounter: every text you read becomes review material for the terms you are acquiring.
- **But noticing is not retention.** Enhancement research also finds a ceiling effect — highlighting draws the eye, it does not retrieve the memory for you. That is why review in Lexis is retrieval practice under an [FSRS](https://github.com/open-spaced-repetition/fsrs4anki/wiki/ABC-of-FSRS) schedule: spacing and testing are among the most robust effects in memory research, and they are the part a highlighter cannot do.

What Lexis deliberately does not promise: faster reading, or learning without effort.

> 「为什么是个人词典」——Lexis 的出发点只有一句话:**词汇是基础设施,不是学习科目。**四条依据,每条都说清它支持什么、不支持什么:
> - **随身的词典会成为记忆本身**:Clark & Chalmers 的延展心智论(1998)——一个随时可得、被自动信任查阅的外部存储,功能上就是记忆而非工具(Otto 的笔记本)。Lexis 追求的正是这组条件:同一个词库,悬浮即查,出现在你阅读的每个界面。
> - **高亮确实有效——对「注意到」有效**:Schmidt 的注意假说认为,注意不到的东西无法习得;文本增强的眼动与元分析研究显示,被视觉增强的词能持续吸引注意,且学习效果显著优于未增强的词。
> - **词靠反复相遇学会,不靠查一次**:偶然习得研究一致表明单次接触几乎无贡献;全局永久高亮是工程化的「再相遇」——你读的每篇文本都自动变成复习材料。
> - **但「注意到」不等于「记住」**:增强研究同样发现天花板效应——高亮只负责把眼睛拉回来,不替你提取记忆。所以 Lexis 的复习是 FSRS 调度下的提取练习(间隔 + 测试,记忆研究里最稳健的两个效应),这是高亮做不到的那一半。
>
> Lexis 明确不承诺:读得更快,或者不费力的学习。

## Why it fades, why it asks, why it eventually lets a word go

The features added after the first release answer to the same standard: be honest about what each one supports.

- **Salience is scarce, and the dictionary's job is to disappear.** A permanently highlighted word is useful precisely because it's rare on the page. Habituation to a repeated visual cue is a basic, well-documented perceptual effect — the same mechanism behind [banner blindness](https://en.wikipedia.org/wiki/Banner_blindness) in interface research. If every word you've ever added stays lit forever, the highlight stops meaning anything. Fading a word toward invisibility as its FSRS stability grows isn't a consolation prize; a prosthesis for a skill you haven't internalized should recede once you have.
- **Hovering is a failed retrieval, and a flashcard app never sees it happen.** [Testing-effect](https://en.wikipedia.org/wiki/Testing_effect) research treats the attempt to recall — not just the outcome — as the informative event; work on [desirable difficulty](https://en.wikipedia.org/wiki/Desirable_difficulty) frames a moment of friction in recall as diagnostic, not just annoying. A dedicated review app only ever observes you inside its own review session. Lexis observes the stumble in the wild, while you're actually reading, and nudges that word's schedule closer — a noisy signal (a hover can mean curiosity as easily as forgetting), which is exactly why it only ever moves a date, never a difficulty score or a review tally.
- **A word's importance can't be predicted at add-time — only re-encounter reveals it.** Some terms you add turn out to be load-bearing vocabulary in your field; others you'll never see again, and there's no way to tell which at the moment you create the note. Lexis doesn't try to guess — it waits, and treats a long silence (no natural re-encounter) as a fact worth surfacing, not a verdict. The retirement list is deliberately a court, not a judge: the algorithm only presents the evidence (how long, how often, how many citations); it never removes or auto-archives anything itself.
- **A personal dictionary is an OED with one reader.** The [Oxford English Dictionary](https://en.wikipedia.org/wiki/Oxford_English_Dictionary)'s original reading programme asked hundreds of volunteers to mail in citation slips — a dated, sourced quotation for every word they encountered — which editors then distilled into definitions. Every word note's occurrence list is the same pattern, automated for an audience of one: the dictionary isn't authored in advance, it's distilled from the encounters you actually have.

None of this promises the thresholds are right for you, or that any of these signals substitute for actually reviewing a word.

> 「为什么会渐隐、为什么要问你、为什么最终会放弃一个词」——第一版之后加的功能,守的是同一条底线:说清楚每一条到底支持什么。
> - **显著性是稀缺资源,词典的工作是消失**:一个永久高亮的词之所以有用,恰恰是因为它在页面上很稀少。对反复出现的视觉提示产生习惯化,是一种基础、有据可查的知觉效应——界面研究里的[「banner blindness」](https://en.wikipedia.org/wiki/Banner_blindness)就是同一个机制。如果你加过的每个词永远亮着,高亮就不再意味着什么。让一个词随 FSRS stability 增长渐渐淡到看不见,不是退而求其次的安慰奖;一个还没内化的技能才需要假肢,内化之后就该退场。
> - **悬停是一次失败的提取,背单词软件从来看不到这个信号**:[测试效应](https://en.wikipedia.org/wiki/Testing_effect)研究认为,有信息量的是"尝试回忆"这件事本身,不只是结果;[合意难度](https://en.wikipedia.org/wiki/Desirable_difficulty)相关工作把回忆时那一下卡顿当作诊断信号,而不只是麻烦。专门的复习软件只能在它自己的复习环节里观察你。Lexis 是在你真实阅读、当场卡壳的那一刻观察到的,顺手把这个词的排期拉近一点——这是个有噪声的信号(悬停也可能只是好奇,不一定是忘了),这正是为什么它只挪动日期,从不触碰难度分数或复习次数。
> - **一个词有多重要,添加时预测不出来,只有靠再相遇才能显影**:有些词后来会变成这个领域的骨干词汇,有些你可能再也不会遇到,建笔记那一刻没法判断是哪种。Lexis 不去猜——它只是等,把"很久没有自然相遇"当成一个值得摆出来的事实,而不是判决。淘汰列表故意做成一个法庭,而不是法官:算法只负责摆证据(多久、多少次、多少条出处),从不自动删除或归档任何东西。
> - **个人词典是只有一个读者的 OED**:[牛津英语词典](https://en.wikipedia.org/wiki/Oxford_English_Dictionary)最初的阅读计划征集数百名志愿者寄回"引文卡片"——为遇到的每个词附一句带日期、带来源的引用——编辑再据此蒸馏出释义。每个词条笔记的出处列表是同一套模式,自动化给一个人用:词典不是提前写好的,是从你自己实际经历的相遇里蒸馏出来的。
>
> 这些都不能保证:阈值是不是适合你,或者这些信号能替代真正的复习。

## Features

- **A folder is your word bank.** Point Lexis at a folder — every note title inside becomes an entry (aliases supported). English vocabulary, math jargon, or a person's name — Lexis doesn't care.
- **Highlight + hover.** Matching words are highlighted in reading and live-preview mode (including Obsidian's built-in PDF viewer); hover to see the definition. Color/style can be mapped per tag or per dictionary folder.
- **Highlight fades as you learn.** Opacity is tied to FSRS stability — new words are full-strength, well-learned words fade toward a configurable floor. **Archive** a word (via its hover card, the command palette, or right-click) to retire it from highlighting and review entirely while keeping it hoverable; mark a word **resident** to exempt it from future culling. A one-time migration command converts legacy `#熟悉` tags to archived status.
- **Encounter tracking + a culling review, not an algorithm's verdict.** Hovering, adding an occurrence, or opening a word's note all count as a real-world "encounter" (no dwell-time or scroll tracking); hovering a word due far in the future also nudges its review date closer. The Lexis home view surfaces words nobody's naturally run into in a long while as **retirement candidates** — evidence only, no scoring — and you decide per word: evict, keep, or mark mastered.
- **FSRS spaced repetition.** Flip cards to review; progress is written into note frontmatter (`lexis-*`). Two card styles — word→note and cloze (fill-in-the-occurrence) — with undo and skip.
- **Lexis home view.** Stats, a review heatmap, and start a review session filtered by tag/frequency/random selection.
- **Add words on the fly.** Select text anywhere → right-click/command to create a word note; the source sentence is recorded automatically as an occurrence.
- **`​```lexis` code blocks.** Render the forgetting curve, typed bidirectional related words, or all recorded occurrences (deduped, favoritable) directly inside a note.
  - Modes: `curve` / `rel [type]` / `occ` / `derived` (root-derived words) / blank = all.
- **`​```lexis-home` / `​```lexis-heatmap` blocks.** Embed a mini Lexis home page (stats + review heatmap) — or just the heatmap — in any note; click through to open the real home view or jump straight into review.
- **Typed bidirectional relations.** Synonyms / cognates / look-alikes / usage-notes + word roots — write the `[[link]]` on one side only, it shows on both.
- **Browser companion (optional).** A Chrome extension highlights your word bank on any web page, shows the note on hover, and sends selected words/sentences back into your vault — over a local-only bridge.

> - **文件夹即词库**:指定一个文件夹,里面每个笔记的标题就是一个词条(支持别名)——英语单词、数学术语、人名,Lexis 一视同仁。
> - **高亮 + 悬浮**:阅读与实时预览里高亮库中出现的词(含 Obsidian 内置 PDF 阅读器),悬停看释义;颜色/线型可按标签映射。
> - **高亮随记忆渐隐**:透明度跟 FSRS stability 挂钩——新词全强度,记熟的词逐渐淡到一个可调下限。悬浮卡/命令面板/右键菜单都能把一个词**归档**(退出高亮和复习,仍可悬停查),也能让一个词**常驻**以后不被淘汰。带一次性迁移命令,把旧的 `#熟悉` 标签批量转成已归档。
> - **相遇记账 + 淘汰审判,不是算法说了算**:悬停查释义、划词加出处、打开词条笔记都算一次真实的"相遇"(不追踪停留时长/滚动);悬停一个到期日很远的词还会顺手把它拉近。Lexis 主页会把长期没自然相遇过的词列成**淘汰候选**——只摆证据不打分,淘汰/留下/已掌握,你来判。
> - **FSRS 背单词**:翻卡复习,进度写进笔记 frontmatter(`lexis-*`);支持「单词→整篇」和「出处填空」两种卡面;撤销、跳过。
> - **Lexis 主页**:统计 + 热力图 + 按标签/词频/随机选集合开始复习。
> - **划词添加**:选中→右键/命令建单词文件,自动记录出处。
> - **`​```lexis` 代码块**:在笔记里渲染遗忘曲线、分类双向相关词、出现过的地方(去重 + 可收藏)。
>   - 模式:`curve` / `rel [类型]` / `occ` / `derived`(词根派生词)/ 留空=全部。
> - **`​```lexis-home` / `​```lexis-heatmap` 代码块**:在任意笔记里嵌一份 Lexis 主页摘要(统计+热力图),或者只放热力图;点一下就能跳到真正的主页/直接开始背诵。
> - **分类双向关系**:近义词/同根词/形近词/辨析 + 词根——只在一边写 `[[链接]]`,两边都显示。
> - **浏览器伴侣(可选)**:Chrome 扩展在任意网页上高亮你的词库、悬停看笔记、划词把生词/出处写回 vault——全部通过仅本机的桥接。

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

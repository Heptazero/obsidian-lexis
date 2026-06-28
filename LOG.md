# Lexis 开发日志

自建的 Obsidian 单词学习插件。**纯 JS、无构建步骤**(像你库里的 transcript-helper),你随时能改、商店更新也不会覆盖,数据全部存在你自己的 `.md` 文件里。

---

## 完整需求(来自 Hz)

1. **自定义选择文件夹**:把该文件夹下每个笔记的**标题**识别成一个单词。
2. **出现过就高亮+悬浮**:文章里出现库中的词就标记,悬停显示;**别名也算**。
3. **悬浮/卡片内容按"模板"自动生成**:不要硬编码字段,而是**自动识别笔记里的标题(`####` 段)**来展示;例如显示"引用过的地方"、"近义词"等。
4. **划词添加**:选中一个词可直接加入 → **自动在文件夹里建文件**(重名则提示);并像 EME 一样**保存划词时的出处**,显示在卡片上;这个手动出处**优先级高于**自动搜索到的出处。
5. **背单词**:间隔重复复习(FSRS),进度写进笔记 frontmatter。
6. **热力图**:复习活跃度看板。

> 交付方式:**分阶段、每阶段可独立验收**,不一口气做完。

---

## 技术选型 & 关键决策

- **纯 JS 单文件 `main.js`**,`require("obsidian")`,不引入 TS/esbuild。理由:零工具链、你能直接读改、不被更新覆盖。代价:第三方库(如 `ts-fsrs`)不能直接 `import`,需要时再内联实现或单独 vendor 一个 js。
- **数据存哪**:复习调度写进每个单词笔记的 **frontmatter**(`lexis-due / lexis-interval / ...`),不用 IndexedDB。这样数据可见、可备份、可被 dataview 查询,且跟 SR 思路一致。(对比:EME 把数据锁在 IndexedDB,这正是它没法用你笔记的原因。)
- **高亮的已知风险**:阅读模式可用 `registerMarkdownPostProcessor`(纯 obsidian API,稳)。实时预览/源码模式需要 CodeMirror6 扩展(`@codemirror/view`),在无构建插件里能否 `require` 待验证。Stage 1 先做稳的阅读模式,再攻 live preview。
- **命名**:id `lexis`(取自希腊语"词"),可随时改。

---

## 阶段路线图

- [x] **Stage 0 — 脚手架 + 文件夹→单词索引**
- [x] **Stage 1 — 高亮 + 悬浮**(阅读模式先行;别名也高亮)
- [x] **Stage 1b — 实时预览高亮 + 颜色/透明度 + 标签着色**
- [x] **Stage 2 — 悬浮卡内容升级**(按笔记标题结构 + 自动"出现过的地方"全文搜索 + 相关词)
- [x] **Stage 3 — 背单词复习视图**(FSRS 翻卡 + 打分 + 写 frontmatter)
- [x] **Stage 4 — 划词添加**(右键建文件、重名提示、记录划词出处并高优先级显示)
- [x] **Stage 5 — 热力图**(`​```lexis-heatmap` 代码块 + 复习完成屏)

---

## Stage 0 — 完成 ✅(v0.1.0)

**做了什么**
- 插件骨架:`manifest.json` + `main.js` + 设置页。
- 设置项:① 单词库文件夹(下拉选,默认 `01-word`);② 别名也算单词(开关)。
- 建立单词索引:扫描该文件夹(含子文件夹)所有 `.md`,以**文件名(标题)**为单词;若开启别名,读取 frontmatter `aliases`/`alias` 一并纳入。
- 状态栏显示 `📕 N 词 +M别名`,点击可重建。
- 命令面板:`Lexis: 重建单词索引`。
- 词库文件增/删/改时自动防抖重建(800ms)。

**怎么验收**
1. 在 Obsidian **重载/重启**(让它发现新插件) → 设置 → 第三方插件 → 启用 **Lexis**。
2. 设置 → Lexis → 单词库文件夹选 `01-word`。
3. 看右下角状态栏出现 `📕 348 词`(数字应≈你的单词数)。
4. 命令面板运行 `Lexis: 重建单词索引` → 弹出 `识别到 348 个单词` 之类的提示。
5. 关掉别名开关再开,数字应随之变化。

**没问题就继续 Stage 1。**

---

## Stage 1 — 完成 ✅(v0.1.0)

**做了什么**
- 阅读模式高亮:`registerMarkdownPostProcessor` 扫描渲染后的文本,把库中单词(含别名)包成 `.lexis-hl`,跳过代码块/链接/数学/标签,**单词笔记自身不自我高亮**。
- 匹配用一条按"长词优先"排序的正则(`\b(?:...)\b`,转义特殊字符),避免短词截断长词。
- 悬浮卡:鼠标移到高亮词 → 弹出卡片,用 `MarkdownRenderer` 渲染该单词笔记内容(去掉 frontmatter 和 dataviewjs 块);标题可点击跳转;卡片内/词上鼠标移出 200ms 后消失。
- 点击高亮词:打开对应单词笔记(Ctrl/Cmd 点击 = 新标签页)。
- 设置新增:启用高亮(开关)、高亮风格(波浪/实线/背景)。索引/设置变化后自动重渲染已打开的阅读视图。

**怎么验收**
1. 重载插件(改了 main.js 需在第三方插件里关掉再开 Lexis,或重启 Obsidian)。
2. 随便打开一篇**英文文章笔记**,切到**阅读模式**(右上角)。
3. 文章里凡是出现你 `01-word` 里有的词(及其别名),应带波浪下划线。
4. 鼠标悬停某个高亮词 → 弹出该单词笔记的卡片(能看到释义/图片)。
5. 点击高亮词 → 跳到该单词笔记。
6. 设置里切高亮风格 / 关高亮 → 阅读视图实时变化。

**已知限制(下阶段再说)**
- 目前**只在阅读模式高亮**。实时预览/源码模式需要 CodeMirror6 扩展,留到 Stage 1b 验证 `require("@codemirror/view")` 在无构建插件里是否可用。
- 大文章 + 大词库时正则匹配可能略慢,后续可换 trie 优化。

---

## Stage 1b — 完成 ✅(v0.1.0)

**做了什么**
- **实时预览(编辑模式)高亮**:用 CodeMirror6 `ViewPlugin` + `RangeSetBuilder`,只扫可视区域,装饰类 `.lexis-hl` + `data-lexis-key`,所以**悬浮/点击逻辑直接复用**。用 `editorInfoField` 判断当前文件,单词笔记自身不自我高亮。`require("@codemirror/view")` 用 try/catch 包住:不可用则自动禁用并在设置里提示。
- **可开关**:设置项「实时预览也高亮」。
- **颜色 + 透明度**:默认颜色(留空=主题强调色,或填 #hex)、透明度滑块(对 #hex 转 rgba 生效)。
- **按标签映射颜色/线型**:设置里一个文本框,每行 `标签: 颜色 [wavy|underline|background]`。匹配单词笔记的 tags(frontmatter + 正文 #标签),命中第一条规则。颜色/线型以**内联样式**写到每个高亮 span,阅读模式与实时预览统一走 `inlineStyleForEntry()`。
- 设置变化后 `refreshAllViews()`:重渲染阅读视图 + `workspace.updateOptions()` 刷新编辑器扩展。

**怎么验收**
1. 重载 Lexis(关掉再开 / 重启)。
2. 打开英文文章,留在**编辑模式(实时预览)**——也应出现高亮了。
3. 设置里关「实时预览也高亮」→ 编辑模式高亮消失,阅读模式仍在。
4. 改「默认高亮颜色」填个 `#e5534b`、拖透明度 → 高亮实时变色/变淡。
5. 标签规则填例如 `review: #2f9e44 background`,因为你的词现在都带 `review` 标签 → 所有高亮变成绿色背景。再加 `考研: #e5534b wavy` 之类按你给单词打的标签区分颜色。
6. 若设置里「实时预览也高亮」是灰的并提示不可用 → 说明这个环境 require 不到 CodeMirror,告诉我,走备选方案。

**已知限制**
- 实时预览里**暂不排除代码块/行内代码**(阅读模式已排除)。需要的话 Stage 后续用 `syntaxTree` 补。
- 大文章+大词库正则匹配可优化(trie),目前可视区域扫描已大幅降负。

---

## Stage 1c — 设置体验修缮 ✅(v0.1.0)

**修了 / 改了**
- **透明度 bug**:旧逻辑只能给 `#hex` 加 alpha,你没填颜色(用主题色变量)时无效。改用 CSS `color-mix(in srgb, <color> N%, transparent)`,**对主题色/任何颜色都生效**。
- **颜色用调色盘**:默认色和每条标签规则的颜色都换成 `addColorPicker`,不用手写 hex;默认色旁加「恢复主题色」按钮。
- **标签规则可视化**:纯文本框 → 每条一行结构化控件(标签输入 + 调色盘 + 线型下拉 + 删除),底部「+ 添加标签规则」。旧的纯文本设置自动迁移。

**怎么验收**
1. 重载 Lexis。设置 → Lexis → 高亮。
2. 拖**透明度**滑块 → 现在高亮会实时变淡(不填颜色也行)。
3. 点**默认高亮颜色**色块选色;点旁边按钮恢复主题色。
4. 「按标签着色」点 **+ 添加标签规则** → 填 `review`、选个颜色、选线型 → 你的词立刻变该色。

---

## Stage 2 — 完成 ✅(v0.1.0)

**做了什么**
- **悬浮卡按笔记自身标题结构展示**:渲染单词笔记内容(去 frontmatter / dataviewjs),并用 `compactSections()` 删掉"空段标题"(如空的 `#### 词根`),所以排版自动跟随你的模板,不硬编码字段。
- **🔗 相关词**:用 `metadataCache.resolvedLinks` 算出库内与该词互相双链的单词,列成可点链接(替代原 `#### 同根词` 里跑不起来的 dataviewjs)。
- **📍 出现过的地方**:全文搜索该词(`\bword\b`),列出包含它的句子 + 出处笔记(可点跳转),**完全不依赖双链**。结果按词缓存(`_occCache`),文件改动时清空;可设搜索范围文件夹与数量上限。异步填充,卡片先弹出再补内容。
- 设置「悬浮卡」分区:显示相关词 / 显示出现过的地方 / 出处数量上限 / 出处搜索范围。
- 顺带把**标签着色规则改成一行多个紧凑卡片**(grid + 原生组件:标签输入+调色盘+线型+删除),不再是一行一个、控件挤右边。

**怎么验收**
1. 重载 Lexis。
2. 文章里悬停一个高亮词,卡片里应看到三块:笔记内容(按你的 `####` 结构,空段已隐藏)→ 🔗 相关词 → 📍 出现过的地方(列出别的笔记里用到它的句子,可点跳转)。
3. 设置 → Lexis → 悬浮卡:把「出处搜索范围」设成 `07-material`,出处只在你材料里找(更快更相关)。
4. 「按标签着色」现在是一行两个卡片式规则。

**已知 / 取舍**
- 出处搜索是悬停时按需扫描(带缓存)。库很大时第一次悬停可能略卡;设小「出处搜索范围」最有效。后续可考虑预建倒排索引。

---

## Stage 3 — 完成 ✅(v0.2.0)

**做了什么**
- **FSRS-5 算法**(内联实现,默认 19 参数,无依赖):`initStability/initDifficulty/nextDifficulty(含 linear damping + mean reversion)/retrievability/nextRecall/nextForget/nextInterval`。简化:不做单独的"学习步骤"短期阶段,新卡首评直接进长期调度(对一词一文件够用)。
- **翻卡复习视图**(`ItemView`,脑图标 ribbon + 命令「开始背单词」):正面=单词标题 → 空格显示答案(渲染笔记内容,复用 Stage 2 的结构化渲染)→ 四个评分键「重来/较难/记得/简单」,每个键显示**预测下次间隔**;键盘 `空格 / 1234`。
- **进度写进 frontmatter**:`lexis-s`(稳定度)`lexis-d`(难度)`lexis-due`(下次)`lexis-last`(上次)`lexis-reps`/`lexis-lapses`。用 `fileManager.processFrontMatter` 安全写入,数据全在你自己文件里。
- **队列**:到期复习(按 due 升序)+ 当天新词(受「每天新词上限」限制),「重来」当轮重新排队。
- 状态栏加 `⏰N` 待复习数。复习记录写进 `reviewLog`(供 Stage 5 热力图)。
- 设置新增「背单词」区:目标保留率 / 每天新词上限 / 每轮上限 / 打开复习。

**顺手修**:设置里加/删标签规则**不再跳回顶部**(只重渲染规则区,不重建整页);恢复主题色按钮也不再整页刷新。

**怎么验收**
1. 重载 Lexis。点左侧 🧠 ribbon(或命令「开始背单词」)。
2. 出现翻卡:正面单词 → 空格看答案 → 按「记得」等评分(看按钮上预测的天数)。
3. 打开任意一个刚评过的单词文件,frontmatter 里应多出 `lexis-due / lexis-s / lexis-d ...`。
4. 状态栏显示 `⏰ 待复习数`;背完一轮显示 🎉。
5. 设置 → 背单词:调「每天新词上限」「目标保留率」,再开复习看队列变化。

**已知 / 取舍**
- 新词一次性可能很多(你 348 个都是新的)。用「每天新词上限」控制节奏(默认 20)。
- 未做学习步骤(刚学的词不会当天多次出现,除非按"重来")。需要的话后续补。

---

## 修复:评分"没反应"的真凶 = frontmatter 脏数据(非按钮 bug)

- 现象:点评分键没反应,控制台报 `YAMLParseError: Map keys must be unique ... tags: null / tags:`。
- 真因:早期批量给单词打 `review` 标签时,**239 个文件留下了重复的 `tags` 键**(`tags: null` + `tags:\n- review`),YAML 解析失败 → `processFrontMatter` 写入抛错 → 评分静默失败;同时 Obsidian 也读不了这些文件的 frontmatter。另有 2 个文件键名损坏成 `ags:`。
- 处理:全库扫描确认仅 01-word 中招;脚本合并重复键 → 再按 Hz 要求**移除全部 `review` 标签**(Lexis 用 `lexis-*` 字段,不需要 review)→ 清理 `ags:` 损坏键。最终 01-word:**0 重复 / 0 review / 0 损坏**。备份在 `/tmp/01-word-*.tgz`。
- ⚠️ 还看到报错 = 编辑器里那篇笔记是**旧内存 buffer**。**别保存它**,直接 `Cmd+R` 重载 Obsidian 重新读磁盘即可。
- 已移除按钮点击的诊断 console.log。

## Stage 3 增补(v0.2.0)
- **撤销上一个**:复习视图顶栏「↩ 撤销」按钮 + 键盘 `Z`。记录每次评分前的 frontmatter,撤销时还原(新卡则删除 `lexis-*` 字段),并回退队列位置/计数/当日复习日志;「重来」压入的重排副本也会一并弹出。
- **点单词开原文**:卡片上的单词可点击,在旁边的 markdown 叶子(没有就竖向分栏)打开该笔记原文。
- **按钮高度**:之前 CSS 被主题覆盖,改用 `!important` 强制 `min-height:64px / height:auto / inline-flex` 等,两行文字(标签+天数)完整显示。

## Stage 4 — 完成 ✅(v0.2.0)
- **右键菜单**:编辑器里选中词 → 右键「Lexis:添加到单词库 “xxx”」。
- **建文件**:在单词库文件夹建 `<词>.md`;重名 → 提示并打开已有。
- **模板**:套用「新词模板文件」(默认 `template/单词模板.md`,留空=极简骨架),支持 `{{word}} {{date}}` 占位。
- **划词出处**:把当前笔记写入 `lexis-source`(`[[路径]]`)、所在句写入 `lexis-source-text`。
- **高优先级显示**:悬浮卡里「✍️ 手动出处」排在内容之后、相关词/「📍 出现过的地方」之前。
- 设置新增「划词添加 → 新词模板文件」。
- **补充**:右键菜单只在编辑模式触发;另加命令「Lexis: 把选中的词加为单词」,阅读模式下选中也能加(可绑快捷键),会自动取选中所在句作为出处。

### 原计划(供参考)
- 触发方式(待选):① 命令「Lexis: 把选中加为单词」(可绑快捷键);② 编辑器右键菜单「添加到单词库」;③ 选中后浮动小按钮。
- 行为:取选中词 → 目标 `单词库文件夹/<词>.md`。存在 → 提示并打开;不存在 → 用模板创建 + 记录**划词出处**(当前笔记 + 该句)写进 frontmatter(如 `lexis-source: [[笔记]]` / `lexis-source-text: 句子`)。
- **手动出处优先级高于自动搜索**:悬浮卡/复习卡里「✍️ 手动出处」排在「📍 出现过的地方」之上。
- 新词模板:设置里可选一个模板笔记(留空用内置骨架,贴合 `单词模板.md`)。
- 重名:提示是否打开已有 / 取消。

## Stage 6 — 笔记内仪表盘 + 体验修缮 ✅(v0.3.0)
- **`​```lexis` 代码块**:在单词笔记里放一个 ` ```lexis ` 代码块,直接渲染【🧠 遗忘曲线 + 🔗 相关词 + 📍 出现过的地方】。用来**替代模板里那一大坨 dataviewjs**(关联文章那段可删)。
- **遗忘曲线图**:内联 SVG,按 FSRS 稳定度画 R(t) 衰减;标注目标保留率虚线、今天位置点、下次到期。新词显示"还没复习过"。
- **手动出处不再进 frontmatter**:划词添加改为把例句+出处链接写进**正文 `#### 例句`**,属性面板干净了,笔记里也直接可见。
- **悬浮卡可滚动**:修复"任意滚动就关闭"误杀卡内滚动的 bug(滚动目标在卡内则不关)。
- **例句间距**:加了间距 + 虚线分隔。
- 跳过:例句按词义 AI 分组(投入产出比低,出处本就 ≤6 条)。

## Stage 5 + 改进(v0.3.0)
- **热力图**:` ```lexis-heatmap ` 代码块(丢任意笔记)+ 复习完成屏自动显示。近 18 周网格,按当日复习次数着色,来源 `reviewLog`。
- **出处跳到具体位置**:点「↗ 出处」→ 在复用的标签页打开文章,并把光标定位/滚动到该词第一次出现处(编辑模式有效;纯阅读模式只打开)。
- **proficiency 已移除**(早前处理已带走),`frequency` 保留——符合 Hz 要求。

## Stage 7 — Lexis 主页 + 子集/排序 + 体验(v0.4.0)
- **Lexis 主页**(`graduation-cap` ribbon / 命令「打开 Lexis 主页」,默认开在**右侧栏**):统计(待复习/新词/总计)+ 热力图 + 集合选择(按标签)+ 顺序(到期/词频/随机)+「开始复习」。
- **子集/排序背诵**:`buildQueue(options)` 支持按标签筛、按 due/frequency/random 排序;复习从主页带参数启动。
- **复习卡标签 pill**:卡上单词下显示该词 tags(可点 → 只背该标签)。
- **lexis 块支持模式**:` ```lexis ` 体里写 `curve` / `occ` / `refs` / `all`(空=全部);**出现过的地方折叠**(`<details>`,默认收起)。
- **模板**:曲线块 ` ```lexis curve ` 放到了最上面;移除 `proficiency` 字段。语义关系块(同根词/近义词/形近词/辨析)原样保留。

## 修复 + 跳过(v0.4.0)
- **空格 bug**:翻面后焦点在评分按钮上,空格被浏览器当成"点击按钮"→误评分跳下一张。改为空格始终 `preventDefault`(未翻面=翻面,已翻面=不动)。
- **跳过**:顶栏「跳过 (S)」+ 键盘 `S`,把当前词排到本轮末尾。

## 收藏例句 ✅(v0.4.0)
- 悬浮卡 & lexis 块的"出现过的地方"里每条加「➕」→ 写进单词笔记 `#### 例句`(`vault.process`,无则建段)。点完显示 ✓。
- **去重**:出处自动排除已收藏进 `#### 例句` 的来源(按链接的文件名),只显示"未收藏的新出处"。
- 这样:`#### 例句`(你的精华,在 lexis 块上面)vs 出处(自动、折叠、灰)分工清晰,为后续"例句填空卡"攒料。

## occ 开关 + 填空卡(v0.5.0)
- **occ 总开关**:设置「显示出现过的地方」现在同时管住悬浮卡和 lexis 块(关了哪都不显示),只想要手写例句的人可一键关掉自动出处。
- **例句填空卡**:设置「卡片正面」= 单词→整篇 / **例句填空**。填空模式下,复习正面 = 该词 `#### 例句` 第一条挖空(`______`),背面仍是整篇笔记;没有例句的词自动退回显示单词。
- 防重复收藏:➕ 点过即变只读 ✓ + 写入前查重(同来源不重复加)。

## 分类 + 双向相关词(v0.5.0)
- `findTypedRelations(file)`:解析"出链"(本词每个 `[[link]]` 在哪个 `####` 段下)+ "入链"(其它词在哪个段下链了本词),按 近义词/同根词/形近词/辨析/相关 **分组**;跳过代码块和 frontmatter。
- **双向**:只在一边写 `[[对方]]`,两个词卡片/悬浮里都在对应分组显示对方 → 解决"一方有一方没有"。
- 悬浮卡 + lexis 块的"相关词"都改用 `renderTypedRelations`(替代旧的扁平 `findRelated`,后者保留未用)。

## 待定/提议(等 Hz 拍板)
- **替换模板里的"关联文章/同根词等"dataview**:保留 `#### 近义词` 等标题(你在那写正向链接),删掉各段下的 dataviewjs,底部放一个 ` ```lexis refs `(分类双向相关词 + 出处)。确认 ① 显示正确后再做。:把顶部「材料来源」和底部「Clippings」两段 dataviewjs 换成一个 ` ```lexis occ `(出处搜索已覆盖)。语义关系块保留。
- **收藏例句 + 区分样式**:auto 出处旁「➕」→ 写进 `#### 例句`;约定 `#### 例句`(你加的,放上面、正常 markdown 样式)vs lexis 块自动出处(折叠、灰)天然区分。
- **收藏例句**:auto 出处旁加「➕」→ 把该句+链接写进单词笔记 `#### 例句`,在笔记里自由编辑/加注/排序,卡片自动显示。(替代"按位置锚定的双向注脚",更轻)
- **子集/排序背诵**:复习支持排序(到期/词频/随机)+ 按标签或属性筛子集。
- **更新模板**:把 `单词模板.md` 的 dataviewjs 换成 ` ```lexis `,并去掉 proficiency 字段。

## 分类关系按标题 + 全量迁移(v0.5.0)
- **`rel <类型>` 模式**:` ```lexis rel 近义词 ` 只显示该类型、且**反向未回链**的关系(避免和手写正向链接重复)。`辨析` 含"相关"(未归类链接)。无内容不渲染。
- **每个关系标题下各放一个 `rel 类型` 块**(替代旧的"单块堆辨析后")。悬浮卡 / `rel`(不带类型)仍显示全部分类(正+反向并集)。
- **模板重写 + 批量迁移 350 个已有单词**:删光 dataviewjs/孤立围栏,curve 置顶,关系标题下放 `rel 类型`,底部 `#### 例句` + `occ`。用户内容(意思/词根/图/正向链接/辨析)全保留。改用逐行清栏(正则在含反引号的 dataviewjs 上会配错);备份 `/tmp/01-word-migrate-*.tgz`。
- 悬浮卡出处**不折叠**(临时卡片点开别扭);lexis 块里折叠。

## 词根双向(派生词)(v0.5.0)
- 新增 lexis 块模式 **`derived`(派生词)**:列出**所有链到本笔记的 01-word 单词**(不限段落),用于词根笔记的"关联单词"。
- 新建 **`template/词根模板.md`**(meaning + 意思 + `### 关联单词` + ` ```lexis derived `)。
- **迁移 18 个 02-root 根笔记**:dataview → `lexis derived`,保留 meaning/意思 内容。备份 `/tmp/02-root-*.tgz`。
- 双向达成:词的 `#### 词根` 写 `[[词根]]`;词根笔记里自动列出所有派生词。

## 修复:背单词背面看不到 lexis 块(v0.5.1)
- 根因:`renderNoteInto` 的 `stripForPreview` 把 ` ```lexis ` 块也删了(本为悬浮卡防重复)。复习背面因此没有近义词/出处/曲线。
- 修复:`renderNoteInto(el,file,comp,keepLexis)`,复习背面传 `keepLexis=true`(渲染 lexis 块),悬浮卡仍删(它有自己的相关词/出处)。
- 复习背面的"出现过的地方"**默认展开**(渲染后把 `details.lexis-occ-details` 的 `open` 置真;普通笔记里仍折叠)。

## 浏览器扩展 · 阶段 0:本地桥接(v0.6.0)
- 目标:做个 Chrome 扩展,在任意网页高亮词库里的词、划词加进 vault(像剪藏但双向)。浏览器碰不到本地文件,所以 Lexis 在 Obsidian 里开一个**只听 127.0.0.1 的小 HTTP 服务**当传话筒,数据始终在 `.md` 文件里、不出本机。
- 阶段划分:**0 通信地基**(本节)→ 1 拉词库+网页高亮 → 2 划词添加(带来源 URL+句子)→ 3 手动同步+离线排队 → 4 打磨(标签上色/待复习数)。
- 端口默认 **45945**;首次启用生成随机 16 字节 **token**,除 `/ping` 外所有接口校验(防别的网页乱连)。CORS 全开但 token 把门。
- 新增方法:`genToken / startBridge / stopBridge / restartBridge / handleBridge / bridgeWordList`。`onload` 里按开关启动,`onunload` 关闭。状态栏开着时显示 ` · 🌐`。
- 接口:`GET /ping`(无需 token,探测连通)、`GET /words`(token,返回 `{key,word,alias,tags,file}` 列表供高亮)。
- 设置面板新增「浏览器扩展(桥接)」:启用开关 / 端口 / 令牌(复制·重生成·重启)。
- **验收**:启用后浏览器开 `http://127.0.0.1:45945/ping` → `{"ok":true,"app":"lexis","version":"0.6.0"}`。带 token 访问 `/words` 返回词库。

## 浏览器扩展 · 阶段 1:拉词库 + 网页高亮 + 悬停释义(v0.6.0)
- 服务端新增 `GET /word?key=`:返回单词详情(`word/base/file/alias/tags/meaning/markdown`)。`meaning` 用 `extractSection` 抠「意思」段(退「意义」)。
- 新建 `browser-extension/`(Chrome MV3,无构建):
  - `manifest.json`:`storage` 权限 + `host_permissions` 指向 127.0.0.1/localhost(让后台 fetch 绕过页面 CORS/混合内容);content script 注入 `<all_urls>`。
  - `background.js`:**唯一**跟桥接通信的地方。消息 `ping/sync/detail`。`sync` 把 `/words` 存进 `chrome.storage.local`(`words` + `meta`)。
  - `content.js`:从 storage 直接读 `words`+`cfg`,建大正则(按长度降序、`\b` 边界、`i`),`TreeWalker` 扫文本节点包 `<span.lexis-web-hl>`;跳过 script/code/可编辑等;`MutationObserver` 防抖处理动态加载;悬停 → 向后台要 `detail` → 显示卡片(缓存)。`storage.onChanged` 联动重扫/取消高亮。
  - `content.css`:波浪线高亮(对齐 Obsidian),`data-lexis-style` 切 wavy/underline/background,`--lexis-web-color` 控色;悬浮卡含深色模式。
  - `popup`:填主机/端口/令牌,测试连接、同步词库、高亮开关、线型、颜色;显示缓存词数 + 上次同步时间。
  - `README.md`:装扩展步骤。
- **离线设计**:高亮吃本地缓存(Obsidian 关着也高亮);悬停释义/同步才需 Obsidian 开 + 桥接启。
- **验收**:桥接开 → 扩展填令牌 → 测试连接 OK → 同步词库 → 任意英文网页词库词带波浪线、悬停出释义卡。

## 浏览器扩展 · 阶段 1.5:悬浮卡渲染 + 跳转(v0.7.0)
- **md 渲染**:扩展里没有 ob 渲染器,改让 Lexis 端用 `MarkdownRenderer.render` 把笔记正文渲成 HTML(`bridgeRenderHtml`)再随 `/word` 发过去——真·复用 ob 那套。内部 `[[双链]]` 改写成 `obsidian://open`;`app://` 图片/嵌入在浏览器打不开,去掉。
- **可滚动**:悬浮卡正文 `max-height:52vh; overflow-y:auto`(之前漏了,长笔记翻不动)。
- **点标题跳 Obsidian**:`/ping`、`/word` 带 `vault` 名;标题做成 `obsidian://open?vault=&file=` 链接,点了在 ob 里打开该词笔记,改完即走。
- 扩展 `renderDetail` 注入 `data.html`,补 Obsidian 风格排版 CSS(标题/引用/列表/代码/内链色)。
- **反驳并推迟**:Hz 提的"网页划词给已有词加例句(来源=网址)"并进**阶段 2**——和新建词共用写入接口,避免重复造轮子。

## 浏览器扩展 · 阶段 1.6 修悬浮卡 + 阶段 2 划词/加例句(v0.8.0)
- **修:悬浮卡缺关系/出处**。`/word` 之前剥掉 ```lexis 块,导致近义词标题(只来自反向链接的)、出现过的地方都没了。新增 `bridgeExtraHtml(file,display)`:服务端直接算 `findTypedRelations`+`findOccurrences`,渲成带 `obsidian://` 链接的 HTML(出处句子加粗命中词),随 `/word` 的 `extraHtml` 发出。扩展 `renderDetail` 在正文后渲染。
- **修:标题字号比正文小**。原因:标题做成 `<a>` 后被页面的 `a{}` 样式污染。给 `.lexis-web-open` 上 `font-size:16px !important` 等,标题区改 flex 布局。
- **阶段 2 写入**:服务端 `POST /add {word,sentence,url,title}` → `bridgeAddWord`:词不在库→套模板新建,在库→插到 `#### 例句`;来源写成 `[标题](url)` 而非 `[[内链]]`;同 url 已存在则跳过(dup)。`readBody` 读 POST JSON。
- **两个入口**(Hz 拍板:不分两套、不用手选句子):
  - **悬浮卡 ➕ 例句**:对已有词,抓它在本页所在句子(`sentenceAroundSpan`,按标点切,跟「出现过的地方」一致)。
  - **划词浮动按钮**:选中文本(≤60 字/≤6 词/含字母)→ 冒出 `➕ Lexis`;点了智能判断:不在库→新建,在库→加例句(`sentenceFromSelection` 抓所在句)。
  - background 加 `add` 消息走 `POST /add`;加 `toast` 反馈。
- **验收**:悬停词→出现近义词标题 + 📍出处;点 ➕ 例句→该词笔记多一条带网址链接的例句;网页选个新词→冒 ➕ Lexis→点→`01-word` 多一篇、带来源网址。

## 浏览器扩展 · 阶段 2.1:四个修复(v0.9.0)
- **加词后自动高亮**:`doAdd` 新建成功后发 `sync` 消息重拉词库,`storage.onChanged` 自动重扫本页——不用手点同步了。
- **判重改按句子**:`bridgeAddWord` 之前用网址判重(同站不同句被误判已加)。改成 `dupKey = sentence || url`,按句子内容判。
- **标题字号**:网页 `p/div/li` 元素样式污染了 ob 渲染的正文(撑大到 ≥ 标题)。CSS 加 `.lexis-web-pop *{font-size:14px}`(类特异性>页面元素选择器)锁回,标题升到 17px !important。
- **例句插入位置 + 重复标题**:`insertExampleLine` 把例句插到「#### 例句」段末尾、`​```lexis occ​```` 之前;新建词时模板已有该段就插进去,不再在文末又加一个标题。Node 三用例验证(空段/已有例句/无段)。
- **悬浮卡按文档顺序**:重写为 `bridgeFullHtml` —— 把每个 ```lexis 块换占位符、整篇渲染保留标题与顺序,再用 `lexisBlockHtml` 回填各块(curve/rel按类型反向/occ/derived,带 obsidian:// 链接);空块连同空标题去掉。替代旧的「正文 + extraHtml 堆末尾」。`bridgePostProcess` 抽出内链改写/去 app:// 图。

## v1.0.0 修复 4 个待修问题

1. **悬浮卡标题变大**:根因是 `.lexis-web-pop-content h1~h6` 锁死在 12px(比正文 13px 还小)。改为 15px !important + 词名标题内联 18px !important。CSS `.lexis-web-pop, .lexis-web-pop * { font-size:14px }` 改为 13px,拉开对比。`.lexis-web-sec` 从 12px 提到 13px。
2. **新词不立即高亮**:`bridgeAddWord` 创建文件后 `scheduleRebuild()`(debounce 800ms) → `rebuildIndex(false)`(同步)。同时扩展端 `doAdd` 创建成功后本地即刻更新 keySet + 重编正则 + rescan,不等待 sync 来回(别名同样处理)。
3. **空段标题不显示**:`bridgeFullHtml` 渲染后遍历 h1~h6,标题之间无 textContent 且无 `.lexis-web-*` 块则删除。
4. **出处样式**:`.lexis-web-occ-src` 字号 12px→11px,`.lexis-web-occ` margin 3px→8px。

## v1.1.0 浏览器扩展增强

### popup 自动同步 + 离线排队
- popup 打开时 ping 版本号,变了就自动 sync(不用手动点)。
- `doAdd` 发送到 background 时如果网络不通(Obsidian 没开),payload 存入 `chrome.storage.local.pendingAdds` 队列。
- toast 提示「已加入离线队列(N条待同步)」。
- 每次 sync 成功后重放队列,失败的留在队列里。
- popup 底栏显示 `⏳ N 条待同步`。

### 排除标签
- Obsidian 设置页新增「排除标签」下拉框:从词库收集现有标签,选中后带此标签的单词不在网页高亮(Obsidian 内照常)。留空不排除。
- `bridgeWordList()` 响应带 `styleConfig.excludeTag`。
- 扩展 `build()` 中根据 excludeTag 过滤,排除的词存进 `excludedKeys`。
- 选中被排除的词 → pill `[取消排除]` → 删排除标签 → sync → 立即高亮。

### 标签着色规则同步
- `bridgeWordList()` 响应带 `styleConfig`:`tagRules`、`highlightColor`、`highlightOpacity`、`highlightStyle`。
- `content.js` 实现 `inlineStyleFor(key)`:与 Obsidian `inlineStyleForEntry` 完全一致,按标签匹配规则 → 颜色/线型/透明度。
- popup 新增「使用 Obsidian 标签着色」开关:
  - 开 → 使用 Obsidian 规则(标签→颜色/线型 + 全局透明度)
  - 关 → 退回扩展自己的全局颜色/线型(自定义模式可调透明度滑条)。
- 透明度仅影响高亮,不影响悬浮卡配色。

### 页面直接管理标签(POST /tag + 悬浮卡交互)
- 新增 `POST /tag {key, action:"add"|"remove", tag}` → 直接改单词 frontmatter 的 tags → `rebuildIndex(false)` + 手动 `index.set()` 兜底(metadataCache 延迟问题)。
- 悬浮卡标签 pill:排除标签红色 `.lexis-web-tag-excl`,每个标签 `×` 可删,`+` 弹出竖列可选标签列表(白底,已选的灰掉)。
- bucket 支持多选:点标签后列表不消失,标签上方实时增删 pill,bucket 内已选/未选状态实时切换。
- 标签增删后自动 sync。

### 别名多源 + aliases 归入
- `extractAliases` 现在读取 `aliases` + `alias` + 用户配置的自定义属性(逗号分隔,如 `past,forms,variants`),取并集去重。
- 设置页「别名属性名」文本输入。
- 划词 pill:选中词不在库 → `[+ 添加] [aliases]`。点 aliases 变内联 input,输原形 → 创建原形文件,选中词写入 aliases → 立即高亮。
- `injectAlias()` 统一处理新文件与已有文件的别名注入(建文件前注入到 content 字符串,避免 metadataCache 延迟)。

### 别名/标签 metadataCache 延迟兜底
- 根本问题:`vault.create/modify` 后 `rebuildIndex(false)` 读 metadataCache,有时缓存未更新。
- 统一兜底:`rebuildIndex` 后手动 `this.index.set()` 保证别名/标签立即进索引。

### 划词按钮 + 悬浮卡 UI
- pill 双段布局 `[+ 添加] [aliases]`(segmented control 一体样式)。
- 按钮文字色根据背景亮度自适应(暗底白字,亮底黑字)。emoji 加号改普通 `+`。
- 选中词已在 keySet → 不弹按钮。选中词在 excludedKeys → 弹 `[取消排除]`。
- 悬浮卡右上角 `🗑` 删除按钮(红底) → `DELETE /word` 删文件 + sync。
- 卡片最大高度 popup 可配(vh 数字输入)。
- popup 改颜色/线型/透明度 → 页面高亮即刻重扫(`storage.onChanged` 检测 style 字段变化)。
- 标签/高亮词 `cursor:pointer` 统一样式。

### 划词按钮智能定位
- 从选区右侧改为选区下方居中,超出视口放上方,左右边界裁剪。

## 修复:悬浮卡标签加/删与本地不同步(v1.0.1)
- 现象:悬浮卡加/删标签后和 Obsidian 不同步、只剩一个、删不掉。
- 根因(node 复现):`bridgeTagWord` 手写 YAML 解析两个 bug——① 读已有 tags 用 `after.search(/^[^ \t-]/m)`,字符类 `[^ \t-]` **会匹配 `\n`**,开头换行被当成列表结束 → 永远读到 0 个旧标签(→只剩一个 / 不同步);② remove 分支给 `const newContent` 重新赋值 → `TypeError` 被 catch 吞掉(→删不掉)。
- 修法:删掉整段手写解析,改用 `app.fileManager.processFrontMatter`(仓库已有先例 937/1383):规范化读 `fm.tags`(null/字符串/数组都处理)→ 加/删/去重 → 写回(空则 `delete fm.tags`,并 `delete fm.tag` 清单数键)。返回真实结果 tags + 即时刷新 index 配色。默认不再动正文行内 `#tag`。

## 修复:YouTube 字幕上滑词不弹按钮 + 高亮不稳定(扩展 v1.0.2)
- **滑词不弹按钮**:只靠 `mouseup` 触发,但 YouTube player 会吞掉内部 mouseup → onSelect 不跑。改为 `mouseup` + `selectionchange` 双触发(共用 200ms 防抖的 `scheduleSel`),selectionchange 不受 stopPropagation 影响。加守卫:焦点在自己的别名 input 里时跳过(防 input 聚焦的 selectionchange 误触发关掉浮窗)。注意:字幕播放中节点会被替换致选区丢失,暂停后选最稳。
- **高亮不稳定**:MutationObserver 原来任何变动就整页 `scan(document.body)`(400ms 防抖),YouTube 字幕高频重渲染下:整页扫慢 + 重渲染把高亮 span 冲掉要等到下次扫才回来 → 闪。改为**只扫变动的子树**(收集 addedNodes/characterData 的 root,120ms 防抖后逐个 scan),并忽略自己插入的 `.lexis-web-hl`(防自触发),observe 加 `characterData:true`。近乎即时重新高亮且不卡。

## 地基:收录范围多文件夹+标签(并集)、排除多标签(插件 v1.0.2 / 扩展 v1.0.3)
- **动机**:单一 `vocabFolder` / 单一 `excludeTag` 不够用。泛化成多选并集,作为后续(个人词典类型系统 / 每文件夹模板 / 悬浮卡选文件夹 / 跳转配置 / 滑词批注)的地基。本轮只做这层。
- **收录范围**:`vocabFolder`(单)→ `vocabFolders`(多,逗号/换行)+ 新增 `vocabTags`(按标签收录,与文件夹取并集)。
- **网页排除**:`excludeTag`(单)→ `excludeTags`(多,逗号/空格)。`styleConfig` 改发数组 `excludeTags`;扩展兼容旧 `excludeTag` 单字段兜底。"取消排除"按钮改为把该词身上命中的**全部**排除标签逐个删掉。
- **关键技巧(避免改 14 处)**:`inVocabFolder(path)` 被 14 处调用、多在热循环里只有路径。不逐点改,而是 `rebuildIndex` 顺手存 `this.vocabPaths = new Set(命中路径)`,`inVocabFolder` 改成查这个集合——**签名不变、调用点全不动**,且天然支持"按标签命中"。新增 `parseTags / vocabTagSet / inFolderScope / isVocabFile / primaryVocabFolder` 工具;`parseFolders` 分隔符加 `\n`。
- **迁移坑**:旧键 `vocabFolder/excludeTag` **不能留在 `DEFAULT_SETTINGS`**(否则 `Object.assign` 用默认值盖掉用户老值)。改在 `loadSettings` 里:`vocabFolders==null` 才从旧 `vocabFolder` 迁移、否则默认 `01-word`;`excludeTags` 同理。
- **标签变动重索引**:加 `metadataCache.on("changed")` 监听(仅配了 vocabTags 时生效,800ms 防抖),让改 frontmatter 增减标签的笔记能进/出词库。
- **设置面板**:文件夹下拉 → 文本域(多行);新增"按标签收录"文本框;排除标签下拉 → 文本框(多标签)。
- **新建词落地文件夹**:`bridgeAddWord` / `addWordFromSelection` 用 `primaryVocabFolder()`(取 vocabFolders 第一个)。

## 滑词批注(悬浮卡,插件 v1.0.3 / 扩展 v1.0.4)
- **范围**(与 Hz 对齐):只给**已有词**,入口在网页**悬浮卡**(不在划词 pill,也不动 ob 内);**纯文字、不带来源链接**;统一写进笔记的 `#### 批注` 小节。
- **写哪**:`insertExampleLine` 抽成通用 `insertUnderHeading(data, heading, line)`,批注复用它写 `#### 批注`。新建该标题时插在末尾 ```lexis``` 代码块**之前**(紧跟例句,而非落在出处热力图后);已有则追加到小节末尾。node 测过 3 种情形(新建/追加/无标题普通笔记)。
- **链路**:悬浮卡 `✎ 批注` 按钮(在"+ 例句"旁)→ 点开内联输入框(回车存/Esc 取消)→ `chrome.runtime.sendMessage({type:"note"})` → background `POST /note` → 服务端 `bridgeAnnotate`(按 key 查已有词,`vault.process` 写入,清 occ 缓存)。存完清 `detailCache` 让重新悬停拉到带新批注的渲染。
- **为何纯文字 blockquote `> text`**:批注是个人想法,不像例句要记出处;放在自己的 `#### 批注` 段里,和例句区分开。
- 兼容:`bridgeAnnotate` 接受 `note`/`text` 与 `key`/`word` 两种字段名。

## 个人词典:词典表(文件夹→模板)+ 加词选夹 + 悬浮卡文件夹标(插件 v1.0.4 / 扩展 v1.0.5)
- **动机**:不同文件夹是不同词典(word/atom/reference 只是文件夹名),各带自己的模板;网页加词能选落哪个词典;悬停知道词在哪个文件夹。
- **关键 pushback(采纳)**:**不要独立 type 字段**——文件夹本身就是词典身份。所以词典表只 `{folder, template}` 两列。
- **模型**:新增 `dicts: [{folder, template}]` 作文件夹来源的**单一真相**。新增 `dictFolders()`,`primaryVocabFolder/inFolderScope/Notice 摘要` 全改走它(不再读 vocabFolders 文本框,该值只在 loadSettings 迁移时读一次 → dicts)。
- **per-folder 模板**:`readTemplate()` 拆成 `readTemplatePath(p)`;新增 `templateForFolder(folder)`(词典行 template,空则回退全局 `newWordTemplate`)。`bridgeAddWord` 读 `payload.folder`(命中 dictFolders 才用,否则回退第一个)、`addWordFromSelection` 加可选 folder 参;两处建词都改用 `templateForFolder`。
- **ob 右键**:`dictFolders().length>1` 时,编辑器选词右键出每文件夹一项「添加“词”到 <folder>」,各自套模板;单词典保持单项。
- **扩展**:`styleConfig` 加 `dicts`(文件夹名数组,模板不出本机)。划词 pill 多词典时加文件夹下拉段(`📁 名 ▾`,点开选,默认第一个);`doAdd(word,sentence,alias,folder)` 带 folder 进 payload。`background.js` 无改(add 透传 folder)。
- **悬浮卡文件夹标**:从词条 `file` 路径取目录名,标题行加 `.lexis-web-dict` 小标,满足"知道在哪个文件夹"。
- **迁移**:旧 `vocabFolders` → dicts 每文件夹一行(template 空=用默认);`newWordTemplate` 文案改"默认模板"。设置面板"单词库文件夹"文本框 → 词典表(flex 内联样式,无新 CSS 类)。

## 个人词典迭代:pill 选夹改设置开关 + 悬浮卡点文件夹改词典 + 设置模糊匹配(插件 v1.0.5 / 扩展 v1.0.6)
- **反馈**:pill 文件夹下拉(a)默认没出现(只有 ≥2 词典且 re-sync 后才有)、(b)太挤(三段);悬浮卡文件夹小标点了没反应;设置里填路径不方便。
- **pill 选夹改成设置开关**:新增 `pillFolderPicker`(默认关),`styleConfig` 带出;content.js 改成 `styleCfg.pillFolderPicker && dicts.length>1` 才显示。默认新词进第一个词典。
- **悬浮卡点文件夹小标 → 改词典**:小标变可点(多词典时),弹文件夹列表 → 选 → `move` 消息 → `POST /move` → `bridgeMoveWord`(`app.fileManager.renameFile` 只移动文件,正文/批注/例句全留,**模板只在新建时套,不重套**)→ toast + re-sync。CSS 上 `.lexis-web-dict-click` 要 `overflow:visible`(否则 badge 的 ellipsis overflow 会裁掉下拉)。
- **设置模糊匹配**:新增 `PathSuggest extends (obsidian.AbstractInputSuggest || class{})`(缺失时降级,避免 extends undefined 崩);词典表文件夹输入挂文件夹建议、模板输入挂 md 文件建议,"默认模板"同样。`hasSuggest = !!obsidian.AbstractInputSuggest` 守卫。
- 用户当时疑惑"改词典会不会动批注/模板":澄清——移动只挪文件,内容不变;模板只影响新建。

## UI 打磨:悬浮卡改词典下拉对齐标签风格+实时刷新,设置标签/属性模糊匹配,+按钮去空行(插件 v1.0.6 / 扩展 v1.0.7)
- **悬浮卡文件夹下拉**:① 点外面不收起 → 加 document mousedown 关闭器(照搬标签下拉的 closer);② 选完会关掉悬浮卡 → 改成**实时刷新**:move 成功后 `detail` 重拉 + `renderDetail(pop, fresh)` 就地重渲(不 removePop);③ 风格统一 → 弃用自家 `.lexis-web-folderlist`,改用标签下拉的 `.lexis-web-tag-list`/`.lexis-web-tag`(主题感知、字号小、黑白统一)。`.lexis-web-dict-click` 需 `overflow:visible`。
- **设置标签/属性模糊匹配**:`PathSuggest` 加 `multi` 模式(按最后一个分隔符后的活动 token 匹配,选中后追加,已选的不再提示)。挂到:按标签收录、排除标签(multi 空格)、别名属性名(multi 逗号,词源 `metadataCache.getAllPropertyInfos`)、标签规则的标签框(单值)。标签源 = `metadataCache.getTags()` ∪ `collectVocabTags()`。
- **+ 按钮去空行**:原来 `new Setting(wrap).addButton()` 会渲染一整行空 setting-item(用户觉得怪)。改成直接 `wrap.createEl("button")`,词典表和标签规则两处都改。

## 修复:词典下拉只露一项/换夹卡片跳走/多值建议只能选一个(插件 v1.0.7 / 扩展 v1.0.8)
- **下拉只看到一项、点不动**:根因——下拉原本挂在小标 `<span>`(badge)里,被悬浮卡正文盖住,只有第一项露在标题行。改成**挂到悬浮卡根节点 `pop`** 并用 `getBoundingClientRect` 手动定位(`.lexis-web-dict-list`),彻底脱离 badge 的 flex/ellipsis/overflow 约束。
- **一换文件夹卡片就跳走/消失**:根因——move 后调 `sync` → 内容脚本 `unwrapAll()`+重扫,`currentSpan` 被拆掉,`position(pop, currentSpan)` 对着已脱离 DOM 的节点把卡片甩到角落。改成:move 成功后**只就地 patch `data.file` + `renderDetail`(不重取 detail、不调 position)**;`sync` 改后台静默(folder 不影响是否高亮);`position()` 加 `span.isConnected` 守卫。
- **模糊建议只能选一个**:`selectSuggestion` 的 multi 分支原本选完就 `close()`。改成**追加后用 `setValue` 重新触发建议、保持下拉打开并 `focus()`**,可连续点选多个(已选的自动从列表里去掉)。
- **换文件夹要不要换模板?——决定不换**:模板是建新词的脚手架,移动已有词只挪文件;重套模板会覆盖/重复正文与批注,得不偿失。批注/例句/正文一律保持原样。

## 修复:划词 pill 下拉被裁/换夹空骨架重套模板+迁批注(插件 v1.0.8 / 扩展 v1.0.9)
- **划词 pill 文件夹下拉点不开/看不见**:根因和悬浮卡同源——`.lexis-web-selpill` 有 `overflow:hidden`(为了圆角裁切分段按钮),把挂在 pill 里的 `.lexis-web-folderlist` 整个裁掉了。改成**挂到 `document.body`**、用 `getBoundingClientRect` 定位,点外面收起;`hideSelBtn` 顺手清掉游离的 folderlist。(悬浮卡的词典下拉上一版已用同法挂到 `pop` 根节点。)
- **换文件夹智能重套模板**:`bridgeMoveWord` 现在——若该词笔记是**空骨架**(`isScaffoldOnly`:去 frontmatter/代码块/批注/标题后无任何字母数字汉字)且目标词典有自己的模板,则移动后**重套新模板**;否则只挪文件(原行为)。
  - **批注一律迁移**:重套前用 `extractSection(_, "批注")` 抽出批注内容(去掉尾随 lexis 代码块),套完模板再 `insertUnderHeading` 写回。
  - **frontmatter 保留**:重套只换正文 body,**沿用原 frontmatter**(标签/别名/复习数据不丢)。
  - 新增 `splitFrontmatter` / `isScaffoldOnly`;move 返回 `reTemplated`,扩展据此提示并**重新取 detail 重渲卡片**(仍不调 position,卡片不跳走)。
- 决定:**有正文的词不会被重套**(怕覆盖),只有空骨架才套——既满足"空的就加载模板",又不毁已写内容。空文件夹=库根这种**没做**(会把整个根目录都当词库,太危险);默认模板留空仍回退到 minimalSkeleton。

## 修复:划词 pill 下拉一闪就消失(扩展 v1.0.10)
- **现象**:点 pill 上的文件夹按钮,下拉闪一下就没。**根因**:点击的 `mouseup` 会触发 `scheduleSel`(200ms)→ `onSelect`,选区没变但它仍 `hideSelBtn()` 后重建整个 pill,把刚打开的下拉拆掉(还会把已选文件夹重置回默认)。
- **修法**:pill 记下 `dataset.word`;`onSelect` 开头加守卫——**选区文本没变且 pill 已存在就直接 return**,不重建。这样在 pill 上点下拉/选文件夹都不会被自身的 mouseup 拆掉。

## 想法暂存(Hz 提出,暂不做)
- (已实现 ↑)~~**标签识别为单词**:除了扫文件夹,再支持"带某标签的笔记也算单词来源"。~~ → 本轮已做,见上"地基"。

## 下一轮路线(已与 Hz 对齐,本轮未做)
- **个人词典/类型系统**:类型=文件夹(每个纳入文件夹一种类型,各带模板/样式);加词时选文件夹即选类型即套模板。三类 word/atom/reference("网页或 ob 里任何东西"都能当词条)。
- **跳转配置**:分平台开关(桌面 / 移动 / 网页悬浮卡)→ 当前窗口 vs 新标签;移动端默认当前窗口(in-ob 看 `onClick` 的 `getLeaf`,网页看 obsidian:// 链接)。
- **滑词批注**:浮动按钮加第三个"笔"图标 → 批注写入笔记固定 `#### 批注` 区块(位置可配,默认不顶到 frontmatter 前)。
- **word 特例多给设置**:把悬浮卡现有硬编码行为(如"小节下有内容才显示")挪进设置项,默认维持现状。

## 待确认 / 备忘
- 复习算法:v3 先上 FSRS 还是先简单 SM-2?(FSRS 更准但代码多,可先 SM-2 跑通流程再换)
- 高亮颜色/样式是否复用你 hi-words 的波浪线风格,保持视觉一致。
- 热力图配色跟随主题。

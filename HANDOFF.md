# Lexis 交接文档(给接手的 AI)

> 读完这份 + `LOG.md`(开发全史,按时间顺序追加,是唯一真相)就能接着干。代码全是**纯 JS、无构建**,改完 `node --check main.js`(改了扩展就 check 对应的 `browser-extension/*.js`)即可。

## 一句话背景

用户(Hz)的 Obsidian 单词学习库在 `/Users/heptazero/Documents/2en`,自建插件 **Lexis**(`.obsidian/plugins/lexis/`,GitHub: https://github.com/Heptazero/obsidian-lexis)。当前版本:**插件 v1.1.0** / **浏览器扩展 v1.0.15**(两个 `manifest.json` 版本号独立,互不绑定)。

项目定位已经从"背单词工具"扩展为**「全方位个人词典」**——词典文件夹里的笔记标题可以是任何语言的单词、术语、概念,不局限于英语背诵这一件事。这个定位决定了很多设计取舍(比如高亮匹配必须语言无关、复习卡不该叫"例句"该叫"出处")。

## 现状总览(v1.1.0 有什么,cold-start 先看这个再去翻 LOG.md 细节)

- **文件夹即词典**:可配多个"词典"文件夹,每个笔记标题就是一个词条(支持 frontmatter `aliases` 别名)。
- **高亮**:阅读模式 + 实时预览 + Obsidian 内置 PDF 阅读器(pdf.js `.textLayer`)三处都高亮。匹配语言无关:`boundedSource(word)` 只在词首/尾是 `[A-Za-z0-9_]` 时才加 ASCII 词边界,中日韩不加(JS 原生 `\b` 只认 ASCII,不加边界会漏配非英文词)。词条笔记内文里出现**自己**的标题/别名不会高亮自己(`_selfKeysByPath`,rebuildIndex 时按文件收集),但提到别的词库词照常高亮。
- **PDF 高亮架构**:`.textLayer` 内只注入隐形 `.lexis-hl`(纯做 hover/click 事件代理,视觉上 `text-decoration:none`);真正的荧光笔矩形画在独立的 `.lexis-pdf-hl-layer` 层,**必须挂在 `.page` 下、`.textLayer` 前面**(直接 `layer.insertAdjacentElement("beforebegin", hl)`)——挂进 `.canvasWrapper`(canvas 的父容器)会导致裁切/定位跟着 canvasWrapper 走,是这轮刚修的坑,别重犯。按 `getBoundingClientRect` 逐 span 定位画矩形。
- **悬浮卡**:hover `.lexis-hl` 弹卡片,内容 = 整篇笔记按文档顺序渲染的 HTML + 相关词 + 出处列表。出处/例句预览现在**统一走 `MarkdownRenderer.render`**(不再是纯文本拼字符串),LaTeX/加粗斜体能正常显示;渲染完再用 `boldMatchesInPlace(el, word)` 把命中词包一层 `<b>`。
- **FSRS 背单词**:翻卡复习,进度写进 `lexis-*` frontmatter;两种卡面——单词→整篇 / 例句填空(cloze),cloze 卡正面现在也走 Markdown 渲染管线(以前是 `setText` 纯文本,LaTeX 显示不出来)。
- **Lexis 主页**:统计(待复习/新词/总计)+ 热力图 + 按标签/词频/随机选集合开始复习。新增两个可嵌笔记的代码块:`​```lexis-home`(统计+热力图摘要,点击跳真正主页或直接开始复习)、`​```lexis-heatmap`(只嵌热力图)。
- **划词加词**:普通笔记 + PDF 里都有"选词药丸";新词判重**统一走索引**(标题或别名任一匹配即可,不再只按拼出来的文件路径判断),避免在错文件夹里建重复文件;支持"设为别名"直接并入已有词条(`LexisAliasPicker` 模糊搜标题+别名)。
- **浏览器扩展**:`content.js` 高亮网页 + 悬浮卡。悬浮卡 HTML **由 Obsidian 端 `bridgeFullHtml` 渲染好再发过去**(扩展自己没有 MarkdownRenderer/MathJax)——发送前必须 `await finishRenderMath()` flush 一次 MathJax 排版队列,不然序列化抓到的是还没转换的公式源码,发过去就永远定格在那个状态。划词加词/设别名/批注、标签管理全部经本机桥接。

完整编年史(每个版本号改了什么、为什么、踩过什么坑)在 `LOG.md` 里,按时间顺序追加,**不要图省事跳过不读**——很多"看起来很直觉的实现"背后是踩过坑才定下来的(比如 PDF 高亮不能用行内 `text-decoration`、`\b` 不能直接用于 CJK、词典下拉必须挂 `document.body` 而不是父容器)。

## 架构(浏览器扩展这块)

浏览器扩展**碰不到本地文件**,所以:

```
Chrome 扩展  ⇄  http://127.0.0.1:<端口>  ⇄  Lexis(在 Obsidian 里跑的本地 HTTP 服务)  ⇄  vault 的 .md 文件
```

- 「服务器」只是 Lexis 在 Obsidian 内部用 Node `http` 起的、**只听 127.0.0.1** 的小服务,数据不出本机。Obsidian 一关服务就停。移动端 `require("http")` 缺失时整个桥接自动跳过,不影响其余功能。
- 端口默认可配,首次启用生成随机 **token**,除 `/ping` 外所有接口校验。
- **扩展只有 background.js 跟服务通信**(有 host_permissions,绕过页面 CORS/混合内容);content.js 直接从 `chrome.storage.local` 读词库缓存来高亮(所以 Obsidian 关着也能高亮),悬停详情/加词才需要 Obsidian 开着。

### 服务端接口(都在 `main.js` 的 `LexisPlugin` 类里,路由分发在 `startBridgeServer`)
- `GET /ping` —— 无需 token,返回 `{ok,app,version,vault}`。**改了服务端就 bump version**,用户 ping 一下看版本号变没变来判断"Obsidian 里的 Lexis 重载了没"。
- `GET /words?token=` —— 词库列表(供高亮),每个词已经算好**最终颜色/线型**(标签规则 > 词典色 > 全局兜底),扩展直接用,不用自己现算。
- `GET /word?key=&token=` —— 单词详情 `{ok,word,base,file,vault,alias,tags,meaning,markdown,html}`。`html` 是整篇笔记按文档顺序渲染的 HTML(见下「悬浮卡渲染」)。
- `DELETE /word?key=&token=` —— 删词条文件。
- `POST /add?token=` body `{word,sentence,url,title,alias?,folder?}` —— 划词加出处/加别名/新建词。**判重/查已存在统一走索引**:先按拼出来的路径找,找不到再用 `index.get(word.toLowerCase())` 兜底(标题或别名皆可命中,可能在别的词典文件夹),命中就并入那个文件,不再新建重复笔记。来源写成 `[[标题]]`(不带路径,标题在库内唯一,不需要靠路径消歧)。
- `POST /tag?token=` `{key,tag,action:"add"|"remove"}` —— 改词条 frontmatter 标签。
- `POST /note?token=` `{key,note}` —— 批注纯文字写进笔记固定 `#### 批注` 小节。
- `POST /move?token=` `{key,folder}` —— 换词典文件夹。只挪文件(`renameFile`),正文/批注/例句都保留;**只有笔记是空骨架**(去 frontmatter/代码块/批注/标题后没有任何字母数字汉字)且目标词典配了模板,才会重套模板——有内容的笔记永远不重套。

### 扩展文件(`browser-extension/`)
- `manifest.json` MV3,`storage` 权限 + `host_permissions: 127.0.0.1/localhost`。
- `background.js` —— 消息 `ping/sync/detail/add/tag/move/...`,唯一 fetch 服务的地方。`sync` 把 `/words` 存进 `chrome.storage.local`。
- `content.js` —— 从 storage 读词库建大正则(`boundedSrc` 语言无关边界、按长度降序、`i`),TreeWalker 扫文本节点包 `<span.lexis-web-hl>`;`MutationObserver` 防抖处理动态页;悬停→向 background 要 `detail`→渲染悬浮卡;`chrome.storage.onChanged` 联动重扫。划词浮动按钮「+ 添加」/「aliases」,悬浮卡「+ 例句」/「✎ 批注」,都走 `doAdd()`/对应消息。`toast()` 反馈。
- `content.css` —— 高亮样式(对齐 Obsidian,`--lexis-web-color` + `data-lexis-style`)、悬浮卡样式(深色模式)、按钮、toast。
- `popup.html/js` —— 填主机/端口/令牌,测试连接、同步词库、高亮开关/线型/颜色。

## 悬浮卡渲染(复用 Obsidian 渲染器,关键设计)

扩展里没有 Obsidian 的 `MarkdownRenderer`/MathJax,所以**在 Lexis 端渲染好 HTML 再发过去**。`bridgeFullHtml(file,display)`:
1. 把每个 ```lexis 块替换成 `@@LEXIS{i}@@` 占位符;
2. 用 `MarkdownRenderer.render` 整篇渲染(保留标题和文档顺序);
3. 用 `lexisBlockHtml()` 算出每块的 HTML(curve / rel按类型反向 / occ出处 / derived派生),回填到占位符;出处例句也走 Markdown 渲染(不是纯文本拼接);空块连同它紧挨的空标题一起删掉;
4. **`await finishRenderMath()`**——flush MathJax 排版队列,等公式真正排完版再往下走,不然序列化到的是没转换的公式源码;
5. `bridgePostProcess()` 把内部 `[[双链]]` 改写成 `obsidian://open`、去掉 `app://` 本地图片。

这样悬浮卡内容**顺序 = 用户笔记顺序**(意思→词根→同根词→近义词→…→例句→出处),且 LaTeX/格式正常显示。

## 单词笔记模板结构(`template/单词模板.md`,现状——阶段 1 会把"例句"改名"出处")
```
​```lexis
curve
​```
#### 意思
#### 词根
#### 同根词
​```lexis
rel 同根词
​```
#### 近义词
​```lexis
rel 近义词
​```
#### 形近词 / #### 辨析(同上)
#### 例句

​```lexis
occ
​```
```
关系是「只在一边写 `[[链接]]`,两边都显示」:正向手写链接在正文里渲染,`rel <类型>` 块只补**反向未回链**的。

---

## 下一步:四阶段路线图(2026-07-22 定案,尚未开工)

Hz 已经把四段完整规格写死,**每段是一次独立会话的完整 prompt,按依赖顺序做,一阶段一验收再开下一段**。设计已定案,接手的会话不应该重新讨论或"优化"这些决定——尤其是下面标出的两个高风险点。

原始 prompt 全文如下(未来直接把对应阶段整段喂给新会话即可,不用再手动拼提示词):

### 阶段 1:高亮渐隐 + 生命周期(毕业/钉住)+「例句」改名「出处」

```
先读仓库根目录的 HANDOFF.md 和 LOG.md 了解 Lexis 现状。本次任务给插件加「渐隐 + 生命周期」，并做一次文案统一。所有设计决定已定案，不要重新讨论,按规格实现:

1. 高亮渐隐:高亮强度(透明度)不再恒定,改为 FSRS 记忆状态的函数——
   - 从未复习过的新词:全强度;
   - 随该词 FSRS retrievability/stability 上升,透明度线性变淡(具体曲线你定,但必须单调,且设置里暴露「最淡不低于多少」的下限参数);
   - 状态为「已毕业」的词:完全不高亮,但悬停查询仍然可用。
   原理:高亮的功能是把眼睛拉回没掌握的词;熟词退场是为了保护显著性稀缺,防止高亮墙纸化。

2. 生命周期:frontmatter 新增 lexis-status 字段,取值 active(默认,可缺省)/ graduated;另加独立布尔 lexis-pinned。
   - 「标为已掌握(毕业)」:词条右键/命令/悬浮卡按钮触发;毕业 = 退出高亮 + 暂停 FSRS 复习队列,悬停仍可查;可手动「重新入学」恢复 active 并重置或延续 FSRS(做成二选一确认)。
   - 禁止直接修改 FSRS 内部参数(stability 等)来实现任何功能:手动干预只通过生命周期状态叠加在算法之上,FSRS 内部状态只由复习事件驱动。
   - 兼容旧习惯:提供一次性迁移命令,把带 #熟悉 标签的词批量置为 graduated。

3. 文案统一:UI、设置、悬浮卡、README 中所有「例句」改为「出处」(英文 occurrence 不变);「例句填空」卡面改名「出处填空」,机制不变。定位背景:插件已从背单词工具重新定位为「个人词典」,词条下挂的是出处(引文片段+来源),不是外语例句。

约束:纯 JS 无构建,改完 node --check;改了桥接服务端要 bump /ping 的 version;完成后按仓库惯例更新 LOG.md。
验收:新词全强度高亮;复习几轮后同一词肉眼可见变淡;点毕业后正文无高亮但悬停有卡;#熟悉 迁移命令可用。
```

### 阶段 2:相遇记账 + hover 回流

```
先读 HANDOFF.md 和 LOG.md。前置:阶段 1(渐隐+生命周期)已合入。本次给 Lexis 加「相遇记账」,并让悬停行为反哺 FSRS。设计已定案:

1. 相遇的定义(只做「强相遇」,以下三种事件,全部是现有代码路径,只加记账,不新增任何计时器/停留时长/点击深度采集):
   a. 悬停查释义(Obsidian 端 hover 与浏览器扩展端 detail 请求都算);
   b. 划词添加出处(vault 内右键与扩展 POST /add 都算);
   c. 打开词条笔记本身。
   FSRS 排期复习不算相遇(那是算法推的,不是生活遇到的)。

2. 存储:不写 frontmatter(悬停频繁,会刷花笔记 mtime 和 git 历史)。在插件 data 目录建 sidecar JSON,按词条 key 存 { hoverCount, lastEncounter(ISO 日期), encounterCount },内存攒批、防抖落盘。扩展端事件经由现有桥接汇给插件统一记账。

3. hover 回流 FSRS:悬停 = 一次失败的提取(没想起来才查)。规则:某词发生悬停时,若其 FSRS 到期日在 N 天之后,则提前到期(具体接法:作为调度提示提前 due,不允许伪造复习评分、不允许改 stability;N 默认 3,设置可调,可整体关闭该功能)。已毕业词的悬停只记账,不回流。

约束:纯 JS 无构建,node --check;服务端改动 bump /ping version;更新 LOG.md。
验收:悬停后 sidecar JSON 里对应词计数与日期变化;悬停一个远期到期词后它出现在近期复习队列;关闭开关后行为恢复;性能上高亮渲染无可感知变慢。
```

### 阶段 3:淘汰法庭(待淘汰候选列表)

```
先读 HANDOFF.md 和 LOG.md。前置:阶段 1、2 已合入(依赖 lexis-status/lexis-pinned 和 sidecar 相遇数据)。本次在 Lexis 主页加「淘汰候选」区。设计已定案——注意:不做加权评分公式,只做硬条件筛子 + 证据展示,判决权在用户:

1. 候选条件(全部满足才入列):
   - lexis-pinned 为 false 且 lexis-status 不是 graduated;
   - 入库时间 ≥ N 天(默认 90,设置可调);
   - 距上次自然相遇 ≥ N 天(取 sidecar 的 lastEncounter;从未相遇则用入库日期)。
   列表按「距上次相遇天数」降序。

2. 每个候选一行,展示证据:词名、入库日期、相遇次数、悬停次数、vault 内出处数(现有 occ 数据)、最后一次相遇日期。三个操作按钮:
   - 淘汰:归档而非删除——lexis-status 置为 retired,退出高亮与复习,词条文件保留(悬停不再触发);
   - 留下(钉住):lexis-pinned=true,永不再进候选;
   - 已掌握:走阶段 1 的毕业通道。
   支持多选批量操作。

3. 入口放 Lexis 主页,平时不打扰(不弹通知,不加角标),用户主动来看。

约束:纯 JS 无构建,node --check;更新 LOG.md。
验收:构造一个 90 天前入库、零相遇的测试词能出现在候选列;三个按钮各自生效且状态写入 frontmatter;钉住的词永久消失于候选;retired 词正文无高亮、悬停无卡、文件仍在。
```

### 阶段 4(可选):网页被动相遇 + README 设计论证补章

```
先读 HANDOFF.md 和 LOG.md。前置:阶段 1-3 已合入。两件独立小事:

1. 网页被动相遇:content.js 扫描命中词库词时(现有匹配逻辑,不新增采集),按「词 + 当天」去重记账,批量经桥接汇给插件写入 sidecar 的 encounterCount/lastEncounter。这是弱于悬停的被动信号:只证明词出现在打开过的页面上。不做停留时长、不做滚动/点击追踪。Obsidian 端同理:某词的高亮装饰在打开的文件中实际渲染时,按「词+当天」去重记一次。注意防抖与性能,记账不得拖慢渲染。

2. README 补一节设计论证(中英双语,风格对齐现有「Why a personal dictionary」一节,诚实、带文献链接、不夸大):渐隐(显著性稀缺,词典的终点是消失——延展心智的目标不是永远依赖外部存储)、hover 即失败提取(该信号 Anki 类工具拿不到,因为它们不控制阅读界面)、淘汰法庭(重要性无法预测,靠再相遇显影;算法起诉,人判决)、出处本体(OED reading programme 的 citation slips:词典由亲身相遇的引文蒸馏而成,个人词典是单人自动化的 OED)。

约束:纯 JS 无构建,node --check;服务端改动 bump /ping version;更新 LOG.md。
验收:访问含词库词的网页后 sidecar 数据变化;同一词同一天重复访问不重复计数;README 新节双语齐全、链接可点。
```

**两个高风险点(每阶段验收时重点盯)**:
- 阶段 2 的"悬停提前到期"和阶段 3 的"候选条件"最容易被执行会话自作主张改成加权评分公式或伪造复习评分——设计已经定案为硬条件筛子,不要重新讨论、不要"优化"。
- 任何阶段都**不允许直接改写 FSRS 内部参数**(stability/difficulty 等)去实现产品功能;生命周期状态(graduated/pinned/retired)只能叠加在算法结果之上,FSRS 内部状态只由真实复习事件驱动。

---

## 用户偏好(重要)
- 怕插件臃肿、怕更新覆盖魔改 → 一切纯 JS 无构建、配套自己的插件。
- 不喜欢全英文 UI → 界面用中文;但 README 面向公开发布,英文在前、中文引用在后。
- 喜欢「先讨论再动手」,欢迎被反驳(「你可以反驳我」);决策要给推荐而非罗列。
- 数据都存在自己的 `.md` 里,来源宁可写进正文也不要塞 frontmatter 属性。
- 版本号:纯 bug 修复 → PATCH(`1.0.x`);新功能 → MINOR 归零 PATCH(`1.x.0`)。一次发布可以打包多个小改动,不用一改就跳号。

## 怎么验收 / 测试
1. 改了 `main.js` → 用户**重载 Lexis**(设置→第三方插件→关再开),`http://127.0.0.1:<端口>/ping` 看 version 变了没。
2. 改了 `browser-extension/` → `chrome://extensions` **刷新↻扩展** + **刷新网页**。
3. `node --check main.js`(及改过的 ext js)必须过。
4. git:`cd .obsidian/plugins/lexis && git add <具体文件> && git commit && git push`。`data.json` 已 gitignore(含个人复习数据,别提交);别把 Syncthing 冲突文件(`data.sync-conflict-*.json`)一起 add 进去。改服务端记得 bump 两个 `manifest.json` 的 version(各自独立)。
5. 发布:`gh release create <版本号> main.js manifest.json styles.css --title ... --notes ...`(只有插件三件套进 release,浏览器扩展不打包发布,靠用户手动重载/覆盖)。

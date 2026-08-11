# Lexis 交接文档(给接手的 AI)

> 读完这份 + `LOG.md`(开发全史,按时间顺序追加,是唯一真相)就能接着干。代码全是**纯 JS、无构建**,改完 `node --check main.js`(改了扩展就 check 对应的 `browser-extension/*.js`)即可。

## 一句话背景

用户(Hz)的 Obsidian 单词学习库在 `/Users/heptazero/Documents/2en`,自建插件 **Lexis**(`.obsidian/plugins/lexis/`,GitHub: https://github.com/Heptazero/obsidian-lexis)。当前开发版本:**插件 v1.10.4** / **浏览器扩展源码 v1.0.23**(两个 `manifest.json` 版本号独立,互不绑定)。当前先在 `/Users/heptazero/Documents/my-obsidian/.obsidian/plugins/lexis-local` 接收、重构和验收；正式英文库仍停在插件 v1.6.1 / 浏览器扩展 v1.0.17，未同步本轮改动。

项目定位已经从"背单词工具"扩展为**「全方位个人词典」**——词典文件夹里的笔记标题可以是任何语言的单词、术语、概念,不局限于英语背诵这一件事。这个定位决定了很多设计取舍(比如高亮匹配必须语言无关、复习卡不该叫"例句"该叫"出处")。Zotero 阅读端 v0.1.10 已按真机诊断改为 PDF iframe 内序列化数据并打包，等待复测。

## 现状总览(v1.10.4 有什么,cold-start 先看这个再去翻 LOG.md 细节)

> 1.6.1 之后新增的内联条目、分类配色/透明度、EPUB 修复与统一悬浮卡详见 `LOG.md` 最后几节。这里保留 1.5.0 以前的设计约束，因为它们仍是当前行为的一部分。

- **文件夹即词典**:可配多个"词典"文件夹,每个笔记标题就是一个词条(支持 frontmatter `aliases` 别名)。
- **高亮**:阅读模式 + 实时预览 + Obsidian 内置 PDF 阅读器(pdf.js `.textLayer`)三处都高亮。匹配语言无关:`boundedSource(word)` 只在词首/尾是 `[A-Za-z0-9_]` 时才加 ASCII 词边界,中日韩不加(JS 原生 `\b` 只认 ASCII,不加边界会漏配非英文词)。词条笔记内文里出现**自己**的标题/别名不会高亮自己(`_selfKeysByPath`,rebuildIndex 时按文件收集),但提到别的词库词照常高亮。
- **高亮渐隐 + 生命周期(v1.2.0 新增,四阶段路线图阶段 1)**:高亮强度不再恒定,`fadeAlphaFor(entry)` 按 FSRS `stability`(不是 retrievability——后者哪怕不复习也随日历时间天天变,会让高亮"没事自己变淡/变浓")算一条 `progress = s/(s+K)` 单调曲线,新词(`cardS` 为 null)全强度,淡到设置里的 `fadeFloor` 下限为止;`rebuildIndex` 时把 `cardS`/`archived`/`pinned` 缓存进每个 index entry(标题和别名共用同一份,按文件算一次),渲染时(`inlineStyleForEntry`/PDF `scanPdfLayer`)实时读取,改设置不用重建索引。词条生命周期:frontmatter `lexis-status: archived`(归档)+ 独立布尔 `lexis-pinned`(常驻),都只叠加在 FSRS 结果之上,**从不直接改 `lexis-s/d/due` 等内部字段**(`readLifecycle`/`setArchived`/`setPinned`)。归档词的处理思路和 PDF 隐形代理层一样:`.lexis-hl` span 照样包(hover/click 事件代理不丢),`inlineStyleForEntry` 对归档词直接返回 `text-decoration:none`,视觉上完全不显示;`buildQueue`/`computeStats` 跳过归档词;`bridgeWordList` 直接不发给浏览器扩展(扩展没有渐隐/归档概念,不高亮最省事)。归档/恢复入口三处:悬浮卡按钮(`.lexis-popover-archive`)、命令面板(`archive-word`/`restore-word`/`toggle-pin-word`)、文件右键菜单;恢复是否重置 FSRS 走 `LexisRestoreModal` 二选一确认。一次性迁移命令 `migrate-familiar-tag-to-archived` 把带 `#熟悉` 标签的词批量转成归档。
- **PDF 高亮架构**:`.textLayer` 内只注入隐形 `.lexis-hl`(纯做 hover/click 事件代理,视觉上 `text-decoration:none`);真正的荧光笔矩形画在独立的 `.lexis-pdf-hl-layer` 层,**必须挂在 `.page` 下、`.textLayer` 前面**(直接 `layer.insertAdjacentElement("beforebegin", hl)`)——挂进 `.canvasWrapper`(canvas 的父容器)会导致裁切/定位跟着 canvasWrapper 走,是这轮刚修的坑,别重犯。按 `getBoundingClientRect` 逐 span 定位画矩形;已归档的词直接 `continue` 跳过,不画矩形。v1.10.4 起 PDF 扫描会先按几何位置还原视觉行，在通用单节点匹配前处理同一行跨 span、英文连字符断词、普通短语换行和中日韩换行；命中片段共用同一个 `data-lexis-key`。视觉行按水平大间距拆栏，跨行只连接同栏的相邻行，不把整页文本粗暴拼接。
- **悬浮卡**:hover `.lexis-hl` 弹卡片,内容 = 整篇笔记按文档顺序渲染的 HTML + 相关词 + 出处列表。出处预览统一走 `MarkdownRenderer.render`(不是纯文本拼字符串),LaTeX/加粗斜体能正常显示;渲染完再用 `boldMatchesInPlace(el, word)` 把命中词包一层 `<b>`。标题栏右侧有个归档/恢复按钮。
- **FSRS 背单词**:翻卡复习,进度写进 `lexis-*` frontmatter;两种卡面——单词→整篇 / 出处填空(cloze,原名"例句填空"),cloze 卡正面走 Markdown 渲染管线(不是 `setText` 纯文本)。已归档的词不进复习队列。
- **Lexis 主页**:统计(待复习/新词/总计,归档词不计入待复习/新词但计入总计)+ 热力图 + 按标签/词频/随机选集合开始复习。两个可嵌笔记的代码块:`​```lexis-home`(统计+热力图摘要,点击跳真正主页或直接开始复习)、`​```lexis-heatmap`(只嵌热力图)。
- **划词加词**:普通笔记 + PDF 里都有"选词药丸";新词判重**统一走索引**(标题或别名任一匹配即可,不再只按拼出来的文件路径判断),避免在错文件夹里建重复文件;支持"设为别名"直接并入已有词条(`LexisAliasPicker` 模糊搜标题+别名)。
- **浏览器扩展**:`content.js` 高亮网页 + 悬浮卡。悬浮卡 HTML **由 Obsidian 端 `bridgeFullHtml` 渲染好再发过去**(扩展自己没有 MarkdownRenderer/MathJax)——发送前必须 `await finishRenderMath()` flush 一次 MathJax 排版队列,不然序列化抓到的是还没转换的公式源码,发过去就永远定格在那个状态。划词加词/设别名/批注、标签管理全部经本机桥接。已归档的词不在 `/words` 列表里,扩展端完全不知道它存在。
- **Zotero 阅读端**:`zotero-extension/` 是与浏览器扩展并列的 Zotero 9 bootstrapped plugin。官方 `renderTextSelectionPopup` 承接划词操作；`ReaderController` 按成熟 Zotero 插件的顺序等待 `_internalReader._primaryView` 建立、视图与 PDF.js 初始化，再接入主/副视图。`PdfHighlighter` 从 PDF 内容流取文字与坐标，在页面上铺独立命中层，既不修改也不依赖 `.textLayer`。v0.1.10 让 PDF iframe 自己用 JSON 序列化文本项和坐标数组，再在插件沙箱内解析；诊断继续写入 `lexis-zotero-debug.json`。XPI: `zotero-extension/dist/lexis-zotero-0.1.10.xpi`。
- **文案**:笔记里的"例句"小节已改名"出处"(`#### 出处`);写入逻辑对旧笔记留下的 `#### 例句` 标题仍然识别兼容(`insertUnderHeading` 的 `legacyNames` 参数),但新建小节永远用"出处",不会自动重写用户已有笔记的标题文字。批注小节标题也做成了设置项(`annotationHeading`,可以只填文字或带级别如 `## 引用`),同样的兼容思路——`insertUnderHeading` 现在第二个参数是"完整标题行"而不是纯文字。"近义词/同根词/形近词/辨析"这套关系分类还是硬编码的固定五项(`main.js` 里搜 `KNOWN`/`order`),没做成可配置——那是一整套分类体系(用户手写在代码块参数里 + 固定展示顺序),改动量比单一标题名大得多,目前没有需求驱动就没动。
- **相遇记账 + 悬停回流(v1.3.0 新增,四阶段路线图阶段 2)**:只记"强相遇"三种事件——悬停查释义(`showPopover`/`bridgeWordDetail` 都调 `recordEncounter(file, "hover")`)、划词加出处(`addWordFromSelection`/`addExampleToWord`/`bridgeAddWord` 都调 `recordEncounter(file, "add")`)、打开词条笔记(`file-open` 工作区事件,`recordEncounter(file, "open")`)。数据存进插件 data 目录下的 `encounters.json`(跟 `data.json` 同级,已加进 `.gitignore`),不写进 frontmatter——按**文件标题**(不是命中的具体别名 key)记 `{hoverCount, encounterCount, lastEncounter}`,内存里改、`setTimeout` 防抖 1.5s 落盘(`recordEncounter`/`saveEncounters`),`onunload` 时补一次即时保存。悬停会额外触发 `hoverFeedback(file)`:如果这个词已经背过且 `lexis-due` 比设置的天数(默认 3,`hoverFeedbackDays`)还远,就把 `lexis-due` 直接拉到今天——只改 due,绝不碰 `lexis-s`/`lexis-d`,也不算一次复习(不经过 `applySchedule`);已归档的词悬停只记账不回流。两个新设置开关/滑块都在"背单词 (FSRS)"区块。`recordEncounter` 带 (词+类型) 60 秒冷却,鼠标在同一个词上短时间反复晃出晃入只算一次。
- **淘汰法庭(v1.4.0 新增,四阶段路线图阶段 3)**:Lexis 主页新增"🗑️ 淘汰候选"区,`buildRetireCandidates()` 硬条件筛子(不是加权评分):`lexis-pinned` 非 true 且不是 `archived`/`retired`,入库天数(`file.stat.ctime`)和距上次自然相遇天数(取 `encounters.json` 的 `lastEncounter`,从没相遇过就用入库日期)都要 ≥ 设置里的阈值(默认 90 天,`retireCandidateDays`,两个条件共用同一个阈值)。候选按"距上次相遇天数"降序,每行展示入库日期/相遇次数/悬停次数/出处数(`findOccurrences`)/距上次相遇天数,三个按钮:🗑️淘汰(`setRetired`,新状态值 `lexis-status: retired`)/📌留下(复用阶段 1 的 `setPinned`)/📦已掌握(复用阶段 1 的 `setArchived`),支持勾选多个批量操作。"淘汰"比"归档"更彻底:归档词还留一个隐形代理 span(悬停仍可查),淘汰词直接从 `buildMatcher()` 的匹配模式里剔除,连 span 都不包,悬停自然也不会触发——`buildQueue`/`computeStats`/`bridgeWordList` 对 `retired` 的处理和 `archived` 完全一样(都排除)。整个候选区完全被动:只有用户自己打开/刷新主页才会计算和显示,不弹通知、不加角标;阈值滑块现在主页和设置页都能调(同一个设置值,拖动主页那个会防抖 400ms 后重算候选)。
- **网页被动相遇 + README 设计论证(v1.5.0 新增,四阶段路线图阶段 4)**:高亮装饰实际渲染出来就算一次被动相遇(`passiveEncounter(file)`),按"文件+当天"去重(`_passiveSeenToday` Set),挂在 `wrapMatchesInElement`(阅读模式/PDF)和实时预览的 CodeMirror 装饰构建器(`setupLiveExtension`)这两个高亮渲染热路径上——去重检查只是一次 `Set.has`,足够便宜。浏览器扩展这边同样在 `wrap()` 里按"词+当天"去重(`passiveSeen`),攒批 2 秒防抖后经新的 `encounter` 消息类型 → `POST /encounter` → `bridgeEncounter` 批量落到服务端(离线就静默丢弃,不像 `/add` 那样排队重试,毕竟只是弱信号)。两边(浏览器 + Obsidian)都各自去重,不是叠床架屋:扩展端只挡"同一页反复扫描",挡不住"今天换个 tab 又开了同一个页面",这靠服务端按天去重的 Set 兜底。README 新增"Why it fades, why it asks, why it eventually lets a word go"一节(中英双语),分别给渐隐(banner blindness/习惯化)、悬停回流(testing effect/desirable difficulty)、淘汰法庭(重要性无法预测,算法只摆证据)、出处(OED reading programme 的 citation slips)四条设计依据配了真实可点的 Wikipedia 链接,风格和第一节"Why a personal dictionary"保持一致(诚实、每条都说清不支持什么)。

完整编年史(每个版本号改了什么、为什么、踩过什么坑)在 `LOG.md` 里,按时间顺序追加,**不要图省事跳过不读**——很多"看起来很直觉的实现"背后是踩过坑才定下来的(比如 PDF 高亮不能用行内 `text-decoration`、`\b` 不能直接用于 CJK、词典下拉必须挂 `document.body` 而不是父容器)。

## 架构(浏览器扩展这块)

浏览器扩展**碰不到本地文件**,所以:

```
Chrome 扩展  ⇄  http://127.0.0.1:<端口>  ⇄  Lexis(在 Obsidian 里跑的本地 HTTP 服务)  ⇄  vault 的 .md 文件
```

当前架构刻意保持**Obsidian 单文件发布、外部客户端按运行时拆分**：Obsidian Release 仍只交付 `main.js + manifest.json + styles.css`，不为了目录好看拆核心。`LexisPlugin` 是词典规则和写入动作的唯一真相；`LexisBridge` 只拥有 HTTP 生命周期、认证和路由；各 View/Modal/Setting 类只负责交互。浏览器由 `background.js` 统一承接桥接请求；Zotero 端按桥接、索引、PDF 适配、卡片拆成小模块，但不复制 Markdown、MathJax、词条写入或 FSRS 规则。Zotero 的 `scripts/build.sh` 只做 XPI 压缩与共享卡片 CSS 一致性检查，不转译源码。

## 自动更新（v0.1.18 起生效）

- 更新清单托管在公开仓库 `Heptazero/obsidian-lexis`（不是这个私有 vault），文件 `zotero-updates.json`（仓库根目录），`manifest.json.applications.zotero.update_url` 指向它的 raw 地址。发布新版本的完整步骤：
  1. `zotero-extension/manifest.json` 和 `scripts/build.sh` 的 `OUTPUT` 都 bump 版本号，`sh scripts/build.sh` 打包。
  2. `shasum -a 256 dist/lexis-zotero-<版本号>.xpi` 拿哈希。
  3. `gh release create zotero-v<版本号> dist/lexis-zotero-<版本号>.xpi --repo Heptazero/obsidian-lexis --title "Lexis for Zotero <版本号>" --notes "..."`（tag 必须带 `zotero-` 前缀，跟 Obsidian 插件本体的纯数字 tag 区分）。
  4. 浅克隆 `Heptazero/obsidian-lexis` 到 scratchpad，往 `zotero-updates.json` 的 `updates` 数组**新增**一条（不是覆盖，Firefox/Zotero 更新客户端会自己挑最新兼容版本），`git commit && git push`。
  5. 用 `curl` 核对 raw 地址和 release 附件都能公网访问。
- v0.1.18 是最后一次需要用户手动装 xpi 的版本，之后 Zotero 会按自己的更新检查周期自动发现新版本并安装。

## 当前待验收：Zotero 阅读端 v0.1.23（诊断版——上一版理解错了卡片消失的原因）

- v0.1.22 想解决的是"滚动 PDF 时卡片消失"，但用户纠正真正问题是：**鼠标从高亮词移到卡片本身上时，卡片就消失了**——和滚动无关。读代码没找到明显漏洞（`hover()`/`leave()`/卡片自身 mouseenter/mouseleave 时序看起来对），本版不改逻辑，只在 `leave()`/`remove()`/卡片自身 mouseenter/mouseleave 都加了日志。
- 用户需在 Zotero 9.0.6（Gecko 140.0）手动安装 `zotero-extension/dist/lexis-zotero-0.1.23.xpi`（诊断版，不发布到更新源）。安装后关闭并重新打开 PDF，把鼠标从高亮词移到卡片上，然后读 `lexis-zotero-debug.json` 这段时间的日志。
- 下一步：看诊断区分两种可能——①从没出现"卡片被 hover"日志，说明鼠标根本没进入卡片的可交互区域（定位偏移/z-index/pointer-events 问题，需要往这个方向查）；②出现了"卡片被 hover"但紧接着还是出现"卡片关闭"或"卡片移除"，说明是别处的代码路径（比如某次重扫意外调用了 `card.remove()`/`onReset`）在抢先关闭卡片，需要往调用 `remove()`/`onReset` 的地方查。**没有这份诊断证据前不要再猜着改。**
- 坐标残留的小偏差同样还需要用户提供截图或方向/幅度描述才能继续查。
- v0.1.22 已发布到更新源（`Heptazero/obsidian-lexis` 的 `zotero-updates.json` + `zotero-v0.1.22` release），后续稳定版本走这个流程；调试期间的诊断版（如本版）继续手动装，不发布。

## （历史）Zotero 阅读端 v0.1.22（卡片滚动修复；坐标残留小偏差待定位）

- v0.1.21 真机验证结果：悬浮卡能正常弹出（`cloneInto` 修复生效）；坐标缩放校正确认生效（诊断 `scaleX/scaleY` 稳定在 0.999~1.000），错位明显好转但用户反馈"还有点小问题"，具体方向/幅度未知，还没证据支撑往哪改——不要在没有截图/具体描述的情况下猜（`item.chars` 之类未验证过的 PDF.js 内部字段形状，猜错了又是一轮白跑）。
- 新反馈的卡片消失问题：用户想滚动/继续看卡片长内容时,一离开卡片就消失。根因是 `CardView` 构造时对 PDF `viewerContainer` 的 `scroll` 无条件 `remove()`——命中词锚点 span 其实没消失（PDF.js 没卸载该页），只是位置变了。已改成滚动时优先 `position(currentSpan)` 重新定位跟随锚点，只有锚点真的从 DOM 消失才关闭；另给卡片加了 `wheel` 事件 `stopPropagation` 作为 `overscroll-behavior: contain` 之外的双保险。
- 下一步：真机复测卡片滚动/PDF 翻页滚动时是否还跟着不关闭；坐标残留偏差需要用户提供截图或"往哪个方向偏、偏多少、是不是词越长偏得越多"这类具体信息才继续查——不要在没证据时又开始猜。

## （历史）Zotero 阅读端 v0.1.21（悬浮卡+缩放修复、按词典文件夹开关）

- 已通过所有 JS `node --check`、XHTML 校验、5 组单测（含更新过的 `preferences.test.js`）、共享卡片 CSS 一致性检查、XPI 打包。v0.1.20 没有发给用户测过（用户测完 v0.1.18 直接反馈了需求理解错误，v0.1.20 的功能被 v0.1.21 换掉了），所以下面列的悬浮卡/缩放修复也**都还没真机验证过**。
- 用户需在 Zotero 9.0.6（Gecko 140.0）的“工具 → 插件”更新安装 `zotero-extension/dist/lexis-zotero-0.1.21.xpi`。安装后关闭并重新打开 PDF；直接检查 profile 的 `lexis-zotero-debug.json` 即可继续定位。
- **悬浮卡根因（v0.1.18 真机诊断精确定位，待验证）**：`卡片渲染失败: Element.attachShadow: Missing required 'mode' member of ShadowRootInit.`——和 `convertToViewportRectangle` 同一类问题，`{mode:"open"}` 是 chrome 侧对象，传进内容域 `attachShadow()` 读不出字段。用 `cloneInto` 包一层修复（`card-view.js`）。
- **坐标错位根因（待验证）**：v0.1.17 加的缩放校正代码本身是对的思路，但 `view.viewport.width/height`（PDF.js 普通对象的自定义属性，非 WebIDL）从 chrome 侧直接读会被 Xray 挡成 `undefined`，落到兜底分支导致缩放系数恒为 1，等于没生效。现在读之前 `waiveXrays(view.viewport)`，并加了诊断行打印实际的 `viewportW/pageW/scaleX/scaleY`。
- **按词典文件夹开关高亮（重新设计，替换了 v0.1.20 按 PDF 文件开关那版）**：用户澄清需求是 Obsidian 那种"文件夹即词典"的概念——想控制的是"这次读文献只想高亮某个词典文件夹的词"，不是"这一篇 PDF 要不要高亮"。`disabledDicts` 存的是词典文件夹路径集合，只写本机 `Zotero.Prefs`（`extensions.lexis-zotero.disabledDicts`），不落进词条数据，不随 Zotero 账号同步、不影响 Obsidian/浏览器端。`PdfHighlighter.paintView` 里对每个匹配词用 `index.folderOf(entry.file)` 算出所属词典文件夹，按精确匹配或子文件夹前缀判断是否跳过（跳过时不计入相遇记账）。`Prefs.registerObserver` + `ReaderController.rescan()`（只重扫、不重建控制器）让已打开的 PDF 能立即响应开关。设置页从"文件列表"改成"词典文件夹列表"，靠 `plugin.js` 新增的 `listDictionaries()` 读当前已同步的词典目录。
- 下一步：真机复测——①悬浮卡是否正常弹出；②诊断里 `scaleX/scaleY` 是否变成非 1 的值、高亮框是否真的对齐了文字；③设置页能否显示词典文件夹列表（需要先点一次"测试连接"或"立即同步"让 `index` 有数据）；④勾掉某个词典文件夹后，已经打开着的 PDF 是否立即停止高亮该文件夹里的词（不用重开）。

## （历史）Zotero 阅读端 v0.1.17（高亮已跑通，在修错位与悬浮卡）

- 已通过所有 JS `node --check`、5 组单测（含 `reader-adapter.test.js`）、清单 JSON、共享卡片 CSS 一致性检查、XPI 打包。
- 用户需在 Zotero 9.0.6（Gecko 140.0）的“工具 → 插件”更新安装 `zotero-extension/dist/lexis-zotero-0.1.17.xpi`。安装后关闭并重新打开 PDF；直接检查 profile 的 `lexis-zotero-debug.json` 即可继续定位。
- **里程碑：v0.1.16 真机复测第一次打出非零状态行**（`PDF 第 1 页: items=73, matches=14, marks=14`），核心的跨沙箱调用问题被 `Components.utils.cloneInto()` 修复，高亮真的画出来了。剩两个问题：①高亮框和文字有错位；②悬停不出卡片。
- 错位修复：借鉴 Obsidian 端 `main.js` `scanPdfLayer()` 的做法——按 `.page` 实际渲染尺寸（`getBoundingClientRect()`）和 `view.viewport.width/height`（PDF.js 逻辑尺寸）的比例算出 `scaleX/scaleY`，画每个 mark 前把坐标乘上去，防止高 DPI/缩放导致换算结果和实际 CSS 像素不一致。
- 悬浮卡问题原因还不确定，本版是防御性修复 + 诊断，不是确定性修复：`.lexis-zotero-pdf-layer` 的 `z-index` 从 3 提到 1000（防止被 Zotero 自己的选区/标注层盖住抢先接管指针事件）；`mouseenter` 时记 `hover 触发: <词>`，`onHover` 包 try/catch；`CardView.show()` 拆成 `showUnsafe()` 让异步渲染过程的异常也能写进诊断，开始渲染时记 `卡片开始渲染: <词>`。
- 下一步：真机复测重点看两件事——①高亮框现在是否和文字对齐；②诊断里有没有出现 `hover 触发`/`卡片开始渲染`/`卡片渲染失败`。没出现 `hover 触发` 说明指针事件根本没送到 mark 元素（可能还是被别的层挡住，需要继续调 z-index 或换排查方向）；出现了 `hover 触发` 但没有 `卡片开始渲染`，问题就在 `card.hover()` 的延迟调度那段；出现了 `卡片渲染失败` 就直接看错误信息定位。

- 「服务器」只是 Lexis 在 Obsidian 内部用 Node `http` 起的、**只听 127.0.0.1** 的小服务,数据不出本机。Obsidian 一关服务就停。移动端 `require("http")` 缺失时整个桥接自动跳过,不影响其余功能。
- 端口默认可配,首次启用生成随机 **token**,除 `/ping` 外所有接口校验。
- **扩展只有 background.js 跟服务通信**(有 host_permissions,绕过页面 CORS/混合内容);content.js 直接从 `chrome.storage.local` 读词库缓存来高亮(所以 Obsidian 关着也能高亮),悬停详情/加词才需要 Obsidian 开着。

### 服务端接口(`LexisBridge` 负责协议和路由，`LexisPlugin` 负责具体词典动作)
- `GET /ping` —— 无需 token,返回 `{ok,app,version,vault}`。**改了服务端就 bump version**,用户 ping 一下看版本号变没变来判断"Obsidian 里的 Lexis 重载了没"。
- 除 `/ping` 外，扩展统一用 `X-Lexis-Token` 请求头认证；查询串 token 只为旧客户端兼容保留，不再作为新客户端的写法。
- `GET /words` —— 词库列表(供高亮),每个词已经算好**最终颜色/线型**(标签规则 > 词典色 > 全局兜底),扩展直接用,不用自己现算。
- `GET /word?key=` —— 单词详情 `{ok,word,base,title,subtitle,file,vault,alias,tags,meaning,markdown,html,mathCss}`。`html` 是整篇笔记按文档顺序渲染的 HTML；包含公式时 `mathCss` 带当前 CHTML 字形规则(见下「悬浮卡渲染」)。
- `DELETE /word?key=` —— 删词条文件。
- `POST /add` body `{word,sentence,url,title,alias?,folder?}` —— 划词加出处/加别名/新建词。**判重/查已存在统一走索引**:先按拼出来的路径找,找不到再用 `index.get(word.toLowerCase())` 兜底(标题或别名皆可命中,可能在别的词典文件夹),命中就并入那个文件,不再新建重复笔记。来源写成 `[[标题]]`(不带路径,标题在库内唯一,不需要靠路径消歧)。
- `POST /tag` `{key,tag,action:"add"|"remove"}` —— 改词条 frontmatter 标签。
- `POST /note` `{key,note}` —— 批注纯文字写进设置指定的小节。
- `POST /move` `{key,folder}` —— 换词典文件夹。只挪文件(`renameFile`),正文/批注/出处都保留;**只有笔记是空骨架**(去 frontmatter/代码块/批注/标题后没有任何字母数字汉字)且目标词典配了模板,才会重套模板——有内容的笔记永远不重套。

### 扩展文件(`browser-extension/`)
- `manifest.json` MV3,`storage` 权限 + `host_permissions: 127.0.0.1/localhost`。
- `background.js` —— 消息 `ping/sync/detail/add/tag/move/...`,唯一 fetch 服务的地方。`sync` 把 `/words` 存进 `chrome.storage.local`。
- `content.js` —— 从 storage 读词库建大正则(`boundedSrc` 语言无关边界、按长度降序、`i`),TreeWalker 扫文本节点包 `<span.lexis-web-hl>`;`MutationObserver` 防抖处理动态页;悬停→向 background 要 `detail`→在 Shadow DOM 中渲染悬浮卡;`chrome.storage.onChanged` 联动重扫。划词浮动按钮、悬浮卡出处/批注操作都走 `doAdd()`/对应消息。`toast()` 反馈。
- `content.css` —— 只管宿主页面里的高亮、划词药丸和 toast；不再包含悬浮卡规则。
- `popover.css` —— Shadow DOM 内的完整卡片样式。卡片外壳是唯一滚动容器；列表、标题、按钮和 MathJax 不受宿主网页 CSS 污染。
- `popup.html/js` —— 填主机/端口/令牌,测试连接、同步词库、高亮开关/线型/颜色。

## 悬浮卡渲染(复用 Obsidian 渲染器,关键设计)

扩展里没有 Obsidian 的 `MarkdownRenderer`/MathJax,所以**在 Lexis 端渲染好 HTML 再发过去**。`bridgeFullHtml(file,display)`:
1. 把每个 ```lexis 块替换成 `@@LEXIS{i}@@` 占位符;
2. 用 `MarkdownRenderer.render` 整篇渲染(保留标题和文档顺序);
3. 用 `lexisBlockHtml()` 算出每块的 HTML(curve / rel按类型反向 / occ出处 / derived派生),回填到占位符;出处例句也走 Markdown 渲染(不是纯文本拼接);空块连同它紧挨的空标题一起删掉;
4. **`await finishRenderMath()`**——flush MathJax 排版队列,等公式真正排完版再往下走,不然序列化到的是没转换的公式源码;
5. 公式存在时把 `MJX-CHTML-styles.sheet.cssRules` 作为 `mathCss` 返回，包含动态字形规则；
6. `bridgePostProcess()` 把内部 `[[双链]]` 改写成 `obsidian://open`、去掉 `app://` 本地图片。

浏览器把最终 HTML 与 `mathCss` 放进卡片自己的 Shadow DOM：**顺序 = 用户笔记顺序**，网页 CSS 进不来；整个卡片统一滚动，不再由正文猜测标题栏高度。

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

## 下一步:四阶段路线图(2026-07-22 定案;阶段 1~4 全部已落地,见下方各阶段标注和 LOG.md——路线图完整走完)

Hz 已经把四段完整规格写死,**每段是一次独立会话的完整 prompt,按依赖顺序做,一阶段一验收再开下一段**。设计已定案,接手的会话不应该重新讨论或"优化"这些决定——尤其是下面标出的两个高风险点。

原始 prompt 全文如下(未来直接把对应阶段整段喂给新会话即可,不用再手动拼提示词):

### 阶段 1:高亮渐隐 + 生命周期(毕业/钉住)+「例句」改名「出处」 —— ✅ 已完成(v1.2.0,见上面"现状总览"和 LOG.md)

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

### 阶段 2:相遇记账 + hover 回流 —— ✅ 已完成(v1.3.0,见上面"现状总览"和 LOG.md)

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

### 阶段 3:淘汰法庭(待淘汰候选列表) —— ✅ 已完成(v1.4.0,见上面"现状总览"和 LOG.md)

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

### 阶段 4(可选):网页被动相遇 + README 设计论证补章 —— ✅ 已完成(v1.5.0,见上面"现状总览"和 LOG.md)

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

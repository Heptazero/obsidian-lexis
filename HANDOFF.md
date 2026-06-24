# Lexis 浏览器扩展 — 交接文档(给接手的 AI)

> 这份文档是把当前 in-progress 的「Lexis 浏览器扩展」工作交接给另一个 AI。读完这份 + `LOG.md`(开发全史)就能直接接着干。代码全是**纯 JS、无构建**,改完 `node --check` 过即可。

## 一句话背景

用户(Hz)有个 Obsidian 单词学习库 `/Users/heptazero/Documents/2en`,自建了 Obsidian 插件 **Lexis**(在 `.obsidian/plugins/lexis/`,GitHub: https://github.com/Heptazero/obsidian-lexis)。现在在给它做一个**配套的 Chrome 扩展**(`browser-extension/`),目标:在任意网页上高亮库里的单词、悬停看释义、划词把生词/例句加回 vault。当前版本 **v0.9.0**。

## 架构(关键,务必理解)

浏览器扩展**碰不到本地文件**,所以:

```
Chrome 扩展  ⇄  http://127.0.0.1:45945  ⇄  Lexis(在 Obsidian 里跑的本地 HTTP 服务)  ⇄  vault 的 .md 文件
```

- 「服务器」只是 Lexis 在 Obsidian 内部用 Node `http` 起的、**只听 127.0.0.1** 的小服务,数据不出本机。Obsidian 一关服务就停。
- 端口默认 **45945**,首次启用生成随机 **token**,除 `/ping` 外所有接口校验。
- **扩展只有 background.js 跟服务通信**(有 host_permissions,绕过页面 CORS/混合内容);content.js 直接从 `chrome.storage.local` 读词库缓存来高亮(所以 Obsidian 关着也能高亮),悬停详情/加词才需要 Obsidian 开着。

### 服务端接口(都在 `main.js` 的 LexisPlugin 类里)
- `GET /ping` —— 无需 token,返回 `{ok,app,version,vault}`。**改了服务端就 bump version**,用户 ping 一下看版本号变没变来判断「Obsidian 里的 Lexis 重载了没」。
- `GET /words?token=` —— 词库列表 `[{key,word,alias,tags,file}]`,供高亮。
- `GET /word?key=&token=` —— 单词详情 `{ok,word,base,file,vault,alias,tags,meaning,markdown,html}`。`html` 是**整篇笔记按文档顺序渲染**的 HTML(见下「悬浮卡渲染」)。
- `POST /add?token=` body `{word,sentence,url,title}` —— 划词/加例句:词不在库→套模板新建,在库→插例句。来源写成 `[标题](url)` 而非 `[[内链]]`。按句子内容判重。

### 扩展文件(`browser-extension/`)
- `manifest.json` MV3,`storage` 权限 + `host_permissions: 127.0.0.1/localhost`。
- `background.js` —— 消息 `ping/sync/detail/add`,唯一 fetch 服务的地方。`sync` 把 `/words` 存进 `chrome.storage.local`(`words`+`meta`)。
- `content.js` —— 从 storage 读词库建大正则(`\b`边界、按长度降序、`i`),TreeWalker 扫文本节点包 `<span.lexis-web-hl>`;`MutationObserver` 防抖处理动态页;悬停→向 background 要 `detail`→渲染悬浮卡;`chrome.storage.onChanged` 联动重扫。划词浮动按钮 `➕ Lexis` + 悬浮卡 `➕ 例句`,都走 `doAdd()`→`POST /add`。`toast()` 反馈。
- `content.css` —— 高亮波浪线(对齐 Obsidian,`--lexis-web-color` + `data-lexis-style`)、悬浮卡样式(深色模式)、按钮、toast。
- `popup.html/js` —— 填主机/端口/令牌,测试连接、同步词库、高亮开关/线型/颜色。

### 悬浮卡渲染(复用 Obsidian 渲染器,关键设计)
扩展里没有 Obsidian 的 MarkdownRenderer,所以**在 Lexis 端渲染好 HTML 再发过去**。`bridgeFullHtml(file,display)`:
1. 把每个 ```lexis 块替换成 `@@LEXIS{i}@@` 占位符;
2. 用 `MarkdownRenderer.render` 整篇渲染(保留标题和文档顺序);
3. 用 `lexisBlockHtml()` 算出每块的 HTML(curve / rel按类型反向 / occ出处 / derived派生),回填到占位符;**空块连同它紧挨的空标题一起删掉**;
4. `bridgePostProcess()` 把内部 `[[双链]]` 改写成 `obsidian://open`、去掉 `app://` 本地图片。

这样悬浮卡内容**顺序 = 用户笔记顺序**(意思→词根→同根词→近义词→…→例句→出处)。

### 单词笔记模板结构(`template/单词模板.md`)
```
```lexis
curve
```
#### 意思
#### 词根
#### 同根词
```lexis
rel 同根词
```
#### 近义词
```lexis
rel 近义词
```
#### 形近词 / #### 辨析(同上)
#### 例句

```lexis
occ
```
```
关系是「只在一边写 `[[链接]]`,两边都显示」:正向手写链接在正文里渲染,`rel <类型>` 块只补**反向未回链**的。

---

## ⚠️ 4 个待修问题(已诊断根因 + 给出确切修法)

用户验收 v0.9.0 后报的,**尚未修**。按优先级:

### 1. 悬浮卡标题还是没变大
- **现象**:试了两次 CSS(`.lexis-web-pop .lexis-web-open { font-size:17px !important }`),用户说标题跟正文还是差不多大。
- **怀疑**:`content.css` 加了 `.lexis-web-pop, .lexis-web-pop * { font-size:14px }` 锁正文,理论上 `!important` 的 17px 标题应胜出。但用户仍说没变。可能:① 扩展 CSS 没真正重载(要 `chrome://extensions` 刷新↻ + 刷新网页,光刷新网页不够);② 页面有更强的 `!important` 规则压标题;③ 被 styled 的根本不是那个元素。
- **建议修法**:让用户开 DevTools 检查悬浮卡标题元素的 computed `font-size` 和命中的规则,确认到底哪条赢了。**最稳妥**:直接在 `content.js` 的 `renderDetail` 里给标题 `<a>`/容器**设内联样式** `el.style.setProperty("font-size","18px","important")`(内联 + important 几乎不可能被页面盖)。同时把正文 base 调小到 13px,拉开对比。

### 2. 添加新词没有立即高亮
- **现象**:`doAdd` 里新建成功后发了 `sync`,但新词在本页没马上高亮。
- **根因(确定)**:`bridgeAddWord` 创建文件后调的是 `this.scheduleRebuild()`,它是 **debounce 800ms** 才重建索引。而 `doAdd` 拿到响应后**立刻**发 `sync`→`/words`,此时索引还没重建,返回的词库**不含新词**。
- **确切修法**:`main.js` 的 `bridgeAddWord` 里,新建成功后把 `this.scheduleRebuild()` 换成**同步立即重建** `this.rebuildIndex(false)`(它是同步函数),这样紧接着的 `/words` 就含新词了。加例句路径(existing)不影响高亮,可不动。
- 顺带:`storage.onChanged` 重扫逻辑本身是对的(sync 写 `words`→触发重扫),只要 `/words` 数据是新的就行。

### 3. 标题下面没内容的,改回「不显示」
- **现象**:用户喜欢旧的「空段标题不显示」(旧 `renderNoteInto` 用 `compactSections` 把空段标题删了)。新的 `bridgeFullHtml` 整篇渲染、没做空段压缩,导致**意思/词根等没写内容的标题也显示**出来了。
- **注意**:`bridgeFullHtml` 已经处理了「空 lexis 块连同标题删掉」,但**没处理纯空 markdown 段标题**(如 `#### 意思` 后面什么都没写)。
- **确切修法**:`bridgeFullHtml` 在 `bridgePostProcess(div)` 前后,遍历 `div` 里的 `h1~h6`,若某标题到下一个标题之间**没有任何有内容的兄弟节点**(textContent 全空、且没有 rel/occ/curve 这类 `.lexis-web-*` 块),就把这个标题删掉。等价于把 `compactSections` 的语义在 DOM 上重做一遍。小心别误删「标题 + 只有反向关系块」的情况(那种块有内容,不该删)。

### 4. 出处样式:出处名小一点 + 每条例句间隔大一点
- **纯 CSS**,`content.css` 里:
  - `.lexis-web-occ-src { font-size: 11px; }`(现在 12px;注意要赢过 `.lexis-web-pop *` 的 14px,类特异性够,放在该规则之后即可);
  - `.lexis-web-occ { margin: 8px 0; }`(现在 3px,拉开)。
- 「出现过的地方」标题与每条出处之间也可加点 `margin-top`。

---

## 怎么验收 / 测试
1. 改了 `main.js` → 用户**重载 Lexis**(设置→第三方插件→关再开),`http://127.0.0.1:45945/ping` 看 version 变了没。
2. 改了 `browser-extension/` → `chrome://extensions` **刷新↻扩展** + **刷新网页**。
3. `node --check main.js`(及改过的 ext js)必须过。
4. git:`cd .obsidian/plugins/lexis && git add ... && git commit && git push`。`data.json` 已 gitignore(含个人复习数据,别提交)。改服务端记得 bump 两个 `manifest.json` 的 version。

## 用户偏好(重要)
- 怕插件臃肿、怕更新覆盖魔改 → 一切纯 JS 无构建、配套自己的插件。
- 不喜欢全英文 UI → 界面用中文。
- 喜欢「先讨论再动手」,欢迎被反驳(「你可以反驳我」);决策要给推荐而非罗列。
- 数据都存在自己的 `.md` 里,来源宁可写进正文也不要塞 frontmatter 属性。

## 下一步(本来要做的阶段 3)
popup 的「手动同步」优化 + 离线排队(Obsidian 关着时划的词先排队,下次同步补写)。但注意:加词现在已会自动 sync(修好 #2 后),阶段 3 可能可简化。先把上面 4 个修了再说。

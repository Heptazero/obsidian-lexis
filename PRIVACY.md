# Lexis Privacy Policy

Last updated: September 19, 2026

Lexis is a local-first personal lexicon for Obsidian. This policy covers the Lexis Obsidian plugin, the Lexis Web browser extension, and Lexis for Zotero.

## Data Lexis processes

Lexis Web may process the following data when you use its features:

- webpage text, to find and highlight entries from your local Lexis dictionary;
- the current page URL and title, when you save a selected passage as an occurrence;
- text you explicitly select, together with nearby sentence context, when you add it to Lexis;
- Lexis dictionary entries, aliases, tags, display settings, and rendered note details received from your local Obsidian plugin;
- the local bridge address, port, and access token that you enter in the extension settings.

Lexis does not collect browsing history in bulk. Page text is inspected locally in the active page and is not stored as a copy of the page. A selected passage may remain temporarily in the extension's local pending queue if Obsidian is unavailable, so it can be sent when the local bridge becomes available again.

## How data is used

The data is used only to provide Lexis features: local dictionary matching, webpage highlighting, hover cards, dictionary synchronization, and saving user-selected text into the user's Obsidian vault.

Lexis does not use this data for advertising, profiling, analytics, credit decisions, or any purpose unrelated to its single purpose as a personal lexicon.

## Storage and transmission

Lexis Web stores its settings, access token, dictionary cache, per-site display preferences, and any pending additions in the browser's local extension storage.

Communication from Lexis Web is limited to the loopback addresses `127.0.0.1` or `localhost`, using the port configured by the user. The local bridge is provided by the Lexis plugin running in Obsidian on the same device and requires the configured access token. Lexis does not operate a remote synchronization or analytics server.

Dictionary notes and review data remain ordinary files in the user's Obsidian vault. Lexis for Zotero uses the same local bridge model.

## Sharing and sale

Lexis does not sell, rent, share, or transfer user data to third parties. It does not transfer user data to external servers. Data is disclosed only to the user's own local Obsidian Lexis bridge when the user invokes or enables the relevant feature.

## Retention and deletion

Users control retention through their own browser and Obsidian data:

- removing Lexis Web clears data when the browser removes the extension's local storage;
- clearing the extension's local storage removes its cached settings, token, dictionary data, and pending additions;
- deleting or editing notes in the Obsidian vault changes or removes the corresponding Lexis data.

## Permissions

- `storage` stores local settings, the bridge token, dictionary cache, display preferences, and pending additions.
- access to webpages lets Lexis identify matching dictionary entries, draw highlights and hover cards, and respond to text selections on sites where the extension runs.
- access to `http://127.0.0.1/*` and `http://localhost/*` lets the extension communicate with the user's local Obsidian Lexis bridge.

## Changes

Material changes to this policy will be published in this repository with an updated date.

## Contact

Questions and privacy requests can be submitted through the [Lexis issue tracker](https://github.com/Heptazero/obsidian-lexis/issues).

---

# Lexis 隐私政策

更新日期：2026 年 9 月 19 日

Lexis 是 Obsidian 的本地优先个人词典。本政策适用于 Lexis Obsidian 插件、Lexis Web 浏览器扩展和 Lexis for Zotero。

## Lexis 处理的数据

Lexis Web 在提供相应功能时可能处理：

- 网页文字，用于查找和高亮本地 Lexis 词典中的词条；
- 当前网页的网址和标题，在用户把所选段落保存为出处时使用；
- 用户明确选中的文字及附近句子，在用户将其加入 Lexis 时使用；
- 从本机 Obsidian 插件取得的词条、别名、标签、显示设置和渲染后的笔记详情；
- 用户在扩展设置中填写的本机桥接地址、端口和访问令牌。

Lexis 不会批量收集浏览历史。网页文字只在当前页面本地检查，不会保存网页副本。如果 Obsidian 暂时不可用，用户明确提交的内容可能暂存在扩展的本地待同步队列中，等本机桥接恢复后发送。

## 数据用途

这些数据只用于提供 Lexis 功能：本地词典匹配、网页高亮、悬浮卡片、词典同步，以及将用户选择的文字保存到自己的 Obsidian 库。

Lexis 不会将数据用于广告、画像、分析、信贷判断或与个人词典无关的用途。

## 存储与传输

Lexis Web 在浏览器扩展的本地存储中保存设置、访问令牌、词典缓存、按网站保存的显示偏好和待同步内容。

Lexis Web 只与 `127.0.0.1` 或 `localhost` 回环地址通信，并使用用户配置的端口。这个本机桥接由同一设备上运行的 Obsidian Lexis 插件提供，并要求访问令牌。Lexis 不运营远程同步服务器或分析服务器。

词典笔记和复习数据始终是用户 Obsidian 库里的普通文件。Lexis for Zotero 使用相同的本机桥接方式。

## 共享与出售

Lexis 不出售、出租、共享或向第三方转移用户数据，也不会将用户数据传到外部服务器。只有在用户启用或调用相应功能时，数据才会发送到用户自己的本机 Obsidian Lexis 桥接。

## 保留与删除

用户通过自己的浏览器和 Obsidian 数据控制保留期限：

- 删除 Lexis Web 后，浏览器会随扩展本地存储一起清除相应数据；
- 清除扩展本地存储会删除缓存的设置、令牌、词典数据和待同步内容；
- 在 Obsidian 库中删除或修改笔记，会删除或修改对应的 Lexis 数据。

## 权限用途

- `storage`：保存本地设置、桥接令牌、词典缓存、显示偏好和待同步内容。
- 网页访问权限：识别匹配词条、绘制高亮和悬浮卡片，并响应用户在网页上的划词操作。
- `http://127.0.0.1/*` 和 `http://localhost/*`：与用户本机的 Obsidian Lexis 桥接通信。

## 政策变更

本政策如有实质性变化，会在此仓库发布并更新日期。

## 联系方式

隐私相关问题可以提交到 [Lexis Issue Tracker](https://github.com/Heptazero/obsidian-lexis/issues)。

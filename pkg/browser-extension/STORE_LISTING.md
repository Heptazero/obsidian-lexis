# Chrome Web Store listing draft

This file is the source copy for the Chrome Web Store Developer Dashboard. Keep it aligned with `manifest.json` and `PRIVACY.md`.

## Product details

- Product name: `Lexis Web`
- Primary category: `Productivity`
- Homepage URL: `https://github.com/Heptazero/obsidian-lexis`
- Support URL: `https://github.com/Heptazero/obsidian-lexis/issues`
- Privacy policy URL: `https://github.com/Heptazero/obsidian-lexis/blob/main/PRIVACY.md`

### Summary

Highlight your local Obsidian Lexis entries on webpages and save selected text back to your vault.

### Detailed description

Lexis Web brings your personal Obsidian Lexis dictionary into the browser. Known terms are highlighted directly on webpages, and their local notes appear in a hover card. Select unfamiliar text to create a new entry, save an occurrence, or attach the selection as an alias of an existing entry.

Features:

- highlight entries and aliases from your local Lexis dictionaries;
- view rendered Obsidian note content in an isolated hover card;
- add selected text and its source page to your Obsidian vault;
- choose the target dictionary and search existing entries when adding an alias;
- control dictionary visibility separately for each website;
- keep working from a local cache while Obsidian is closed.

Obsidian remains the source of truth. Lexis Web communicates only with the authenticated Lexis bridge on `127.0.0.1` or `localhost`. It has no cloud account, remote database, advertising, or analytics service.

Lexis Web requires the Lexis Obsidian plugin for synchronization and hover-card details.

## Privacy practices

### Single purpose

Lexis Web displays a user's local Obsidian Lexis dictionary on webpages and lets the user save explicitly selected webpage text to that local dictionary.

### Permission justifications

#### `storage`

Stores the user's local connection settings and token, synchronized dictionary cache, highlight appearance, per-site dictionary visibility, last selected target dictionary, hover-card size, and additions waiting for the local Obsidian bridge.

#### Host permissions for `127.0.0.1` and `localhost`

Required to synchronize with the authenticated Lexis bridge provided by the Obsidian plugin on the same computer. No requests are sent to a Lexis-operated remote server.

#### Content scripts on `<all_urls>`

Required because the extension's single purpose is to recognize and highlight the user's dictionary entries on arbitrary webpages and offer the selection action where the user reads. Page text is matched locally inside the page and is not uploaded or retained as a page copy.

### Data-use declarations

Declare the following categories because the extension can process them locally or send them to the user's local bridge:

- Website content
- Web history: the URL and title of the current page only when the user saves a selection
- User activity: user-highlighted or selected content
- Authentication information: the local bridge token stored in extension-local storage

The data is not sold, used for advertising, used for creditworthiness, or transferred to third parties. Use is limited to the extension's single purpose.

## Reviewer test instructions

Lexis Web requires the free Lexis Obsidian plugin and its local bridge for synchronization and hover-card details.

1. Install Lexis in Obsidian and enable it.
2. In `Settings -> Lexis -> Browser extension (bridge)`, enable the local bridge.
3. Copy the displayed port and access token.
4. Open the Lexis Web popup, enter the port and token, then select `Test connection` and `Sync dictionary`.
5. Open a normal webpage containing an entry from the configured Lexis dictionary. The term is highlighted and its local note appears on hover.
6. Select text on the page. Use the Lexis pill to add it, select a target dictionary, or attach it as an alias of an existing entry.

No reviewer account or remote credentials are required. The token is generated locally by the reviewer's own Obsidian installation.

## Chinese listing copy

### 简短说明

在网页中高亮本地 Obsidian Lexis 词条，并把划选文字保存回自己的知识库。

### 详细说明

Lexis Web 把你的 Obsidian Lexis 个人词典带到浏览器。已收录的词条会直接在网页中高亮，悬停即可查看本地笔记。划选陌生内容后，可以新建词条、保存出处，或将其设为已有词条的别名。

主要功能：

- 高亮本地 Lexis 词典中的词条与别名；
- 在隔离样式的悬浮卡片中查看 Obsidian 渲染内容；
- 把划选文字和来源网页保存到 Obsidian 库；
- 添加别名时模糊搜索已有词条，并选择目标词典；
- 为每个网站分别控制词典是否显示；
- Obsidian 关闭时仍可使用本地缓存进行高亮。

Obsidian 始终是唯一数据源。Lexis Web 只与 `127.0.0.1` 或 `localhost` 上带令牌验证的本机 Lexis 桥接通信，不提供云账户、远程数据库、广告或分析服务。

同步词典和显示悬浮卡片详情需要安装 Lexis Obsidian 插件。

## Required graphic assets

- Store icon: `128 x 128` PNG, already present at `icons/128.png`
- At least one screenshot: `1280 x 800` or `640 x 400`
- Small promo tile: `440 x 280` PNG or JPEG
- Optional marquee image: `1400 x 560` PNG or JPEG

Recommended screenshots:

1. webpage terms highlighted with a hover card open;
2. text-selection pill with target dictionary and alias search;
3. popup showing connection status and per-site dictionary switches.

# Lexis MN — MarginNote 4 companion

Read your Obsidian Lexis entries in MarginNote's native Title Link popup. Obsidian is the source of truth; MN stores a read-only dictionary copy.

## Install and use on iPad

1. In Obsidian, open **Lexis → MarginNote**. Confirm a vault-relative export folder and click **Export dictionary**. Optional automatic export updates the snapshot while Obsidian is running. The generated file is `lexis-marginnote.json`.
2. Make this file accessible in the iPad Files app. Download the file locally before importing; cloud availability is controlled by your file provider.
3. Open `lexis-marginnote-0.2.1.mnaddon` with MarginNote 4 and enable it. This test build is unsigned; MN may ask you to approve an uncertified addon.
4. Create a dedicated study set, add a parent card named **Lexis**, and select that card in the **main mind map**. Open the Lexis addon button and choose **Import file**. Subsequent imports reuse this parent and update the same cards.
5. In **Study set → More**, enable **Title Link** and select this mind map as a dictionary. In another study set, add it as an **external dictionary**. Matching text gets MN's native link marker; on iPad, tap it to open the card.
6. Tap **Open in Obsidian** in a card. The same vault and note must exist in Obsidian on the iPad. The addon menu also has an **Open selected card** action if MN does not activate the Markdown link directly.

If your iPad vault has a different name, open **Lexis MN → Target vault**, enter its name (for example, `myob`) and tap **Save**. This repairs existing imported return links without reimporting cards. Only the vault name changes; note paths remain vault-relative, including heading targets. **Cancel** leaves everything unchanged; clear the input and save to restore the exported vault name.

## Scope, folders and colors

- In **Obsidian → Lexis → MarginNote → Export scope**, turn off **All dictionary sources** to choose configured folders, tag sources and inline source files. Overlapping sources are combined, not duplicated. Selecting none exports an empty dictionary and makes previously imported entries inactive; their cards/comments remain.
- Ignored tags, archived and retired entries are always excluded. **Follow dictionary and inline visibility** is optional and off by default, so temporarily hiding Obsidian highlights does not remove MN keywords. The global highlight switch never controls the MN export.
- Imports now create folder branches; inline entries have an additional source-file branch. Existing flat cards move in place. **Folder grouping** can be toggled without selecting the JSON again. Branch cards have empty keyword titles, preventing folder names from becoming Title Links. Old empty branches are retained rather than deleting cards that may contain user comments.
- The export keeps each entry's original color and color label. To map an Obsidian color to MN's palette, select an imported colored card, choose its color using MN's native palette, then choose **Bind selected card color**. All entries sharing that original color use this native color on subsequent imports. Bindings are local to the device/study set.
- MN exposes palette indexes, not an arbitrary hex-color setter. Unbound card colors are left unchanged. Native PDF Title Link marker colors remain controlled by MN's dictionary settings; they are not promised to match each Lexis entry's hex color.

## Add a selection to Obsidian

Select text in an MN document using the hand tool. When MN's selection menu appears, tap the adjacent **添加到 Obsidian** button and confirm in Obsidian's Lexis window. No extra Lexis menu is needed. The draft offers an editable term, configured-dictionary folder suggestions, and the same alias search as the existing selection UI. Nothing is written until **Add**; **Cancel** leaves notes unchanged.

The shortcut sits beside the native menu rather than modifying it. It disappears when the selection closes, the document/study set changes, the window resizes or MN leaves the foreground. It appears only for a valid short text selection, not image regions. If the window has no room for the button or the native event does not fire, **Lexis MN → Add selection in Obsidian** remains available. These native menu events are used by [OhMyMN](https://github.com/ourongxing/ohmymn/blob/main/packages/ohmymn/src/jsExtension/handleReceivedEvent.ts); no OhMyMN installation is required.

This requires the updated Obsidian Lexis build on the receiving device. Set the target vault in the reading study set too. A short selected term (up to 200 characters after whitespace normalization), document title and page label travel through the `obsidian://lexis-add` URI; no local HTTP server, token, background clipboard polling or network upload is involved. Obsidian stays the source of truth. Existing terms follow the normal Lexis behavior rather than silently appending duplicate contexts.

## Plugin upgrades

**Refresh dictionary / Auto-check** update the selected JSON's entries, not the addon program. This test build still requires downloading a new `.mnaddon` and installing it over the same addon ID. Official certification and online update distribution require MarginNote's approval; see [Publishing and certification](PUBLISHING.md). No self-modifying updater is included.

[MN4 Title Link setup](https://manual.marginnote.com.cn/mn4/card-links-keyword-title-links-build/).

## Updates and data

- Titles and aliases are native semicolon-separated keywords. Ordinary entries contain the note's Markdown body; inline entries contain their annotation and a heading-based return link.
- One study set accepts one Lexis source. Reimporting does not intentionally duplicate cards: an ownership marker in each card identifies the source entry, including after MN's own notebook sync.
- The target vault preference is local to this device and study set. Future imports and update checks use it. MN may sync card bodies from another device; **Open selected card** always applies the local target vault at click time. Save the target vault again to repair synced Markdown links if devices use different vault names.
- Imported titles/body are replaced on update. Add your own MN notes as **comments**, which are not overwritten. Do not remove the hidden ownership marker from the imported body.
- Removed, retired or archived entries lose their keyword titles; their MN cards and comments are retained. Restoring an entry reuses its card. Renaming an Obsidian file changes its entry identity, so its old card becomes inactive and a new one is created.
- **Auto-check** is opt-in: it checks on foreground/open and every 30 seconds while the window is active. It uses the selected file's retained permission. Failure pauses auto-check with a visible message. Re-select the file to restore access, then enable auto-check again.
- If MN's picker imports a copy instead of retaining the original, automatic checks may read the old copy. iPad file-provider/bookmark behavior is not verified yet; manual reimport and explicit clipboard import are supported fallbacks. No background or instantaneous cross-app sync is promised.
- No web service, token or review-data sync is used. The export is a disposable plaintext snapshot, not a backup of FSRS or encounter data. Protect it like your original notes.
- Vault-local images, embedded notes and Obsidian-specific syntax are not packaged into the addon. Text, standard Markdown and MN-supported formulas are the first-version scope; complex rendering needs device verification.

## Build and verification

From the Lexis repository root:

```sh
npm run typecheck:marginnote
npm run build:marginnote
node --test tests/marginnote*.test.mjs
```

The `.mnaddon` is a ZIP containing only `main.js`, `mnaddon.json`, `icon.png`, this README and `PUBLISHING.md`. Source modules are TypeScript; native declarations describe the official [MarginNote addon APIs](https://github.com/marginnoteapp/Addon).

Automated tests cover snapshot validation, scope/ignore rules, folder regrouping, color bindings, selection drafts, shortcut placement/lifecycle/touch cleanup, explicit confirmation, target-vault repair, deterministic revisions, idempotent updates and preservation of unmanaged cards/comments. They cannot verify MN4 installation, native callbacks, Title Link refresh, bookmark access, popup Markdown or the Obsidian return link. Those checks require a real iPad.

## 中文速用

Obsidian 导出词库 → iPad 文件 App 可读取 → 安装 `.mnaddon` → MN 主脑图新建并选中一张 Lexis 父卡片 → 插件导入 → 开启标题链接并选择字典。

阅读时点击标识查看原生卡片，再通过卡片链接回到 Obsidian。iPad 库名不同：**Lexis MN → 目标 Obsidian 库名 → 填 `myob` → 保存**，已有链接会直接修正，无须重新导入。这里填库名，不是绝对路径或库内文件夹路径。

选择部分词库：**Obsidian → Lexis → MarginNote → 导出范围**；默认按真实文件夹分支，内联词条再按来源文件分支。重新导出并更新词库后，旧卡片原位移动，不重复导入。

颜色：原色保留在词条里。先在 MN 调色板给一张词条卡片设色，再点插件的**绑定当前卡片颜色**，同色词条就沿用它。MN 的 PDF 标题链接标记仍由 MN 自己控制，不能保证逐词复制 Obsidian 的原色。

划词：用手形工具选中文字 → 点击原生菜单旁的**添加到 Obsidian** → 在 Obsidian 确认词条、词典或别名 → 添加。取消选区、切文档/学习集、调整窗口或切后台后按钮消失。只展示有效的短文字选区；原来的插件菜单入口保留。接收设备也要更新 Obsidian Lexis；未确认不写笔记。

只在 Obsidian 修改正文；MN 导入卡片是展示副本，自己的补充写在评论中。自动检查需手动开启，不能保证后台实时同步。仍需 iPad 实测。

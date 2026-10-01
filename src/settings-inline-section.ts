"use strict";

import type { App } from "obsidian";
import type { InlineCategoryOccurrence } from "./types";
import type { SettingsRuntime } from "./settings-tab";

interface InlineGroup {
  id: string;
  key: string;
  name: string;
  count: number;
  children: InlineCategoryOccurrence[];
}

type AppWithSettingsModal = App & { setting?: { close(): void } };

interface InlineSettingsHost {
  app: App;
  plugin: SettingsRuntime;
  renderStats(): void;
}

interface InlineSectionContext {
  obsidian: typeof import("obsidian");
  Setting: typeof import("obsidian").Setting;
  topSection: (key: string, title: string, options?: { open?: boolean; desc?: string }) => HTMLElement;
  t: (key: string, vars?: Record<string, string | number | boolean | null | undefined>) => string;
  save: () => Promise<void>;
  refresh: () => void;
  accentHex: string;
  appearanceLabels: {
    color: string;
    opacity: string;
    style: string;
    defaultStyle: string;
    wavy: string;
    underline: string;
    background: string;
    reset: string;
    done: string;
  };
  createReorderController: typeof import("./settings-controls").createReorderController;
  moveItem: typeof import("./settings-controls").moveItem;
  addAppearanceButton: typeof import("./settings-controls").addAppearanceButton;
}

export function renderInlineSettings(this: InlineSettingsHost, context: InlineSectionContext): void {
  const { obsidian, Setting, topSection, t, save, refresh, accentHex, appearanceLabels, createReorderController, moveItem, addAppearanceButton } = context;
  const inlineSection = topSection("inline", t("settings.inline"), { desc: t("settings.inlineDesc") });
  new Setting(inlineSection).setName(t("settings.enableInline")).setDesc(t("settings.enableInlineDesc"))
    .addToggle((t) => t.setValue(this.plugin.settings.inlineEntriesEnabled).onChange(async (v) => { this.plugin.settings.inlineEntriesEnabled = v; await save(); await this.plugin.rebuildIndex(false); this.renderStats(); }));
  new Setting(inlineSection).setName(t("settings.inlineDelimiter")).setDesc(t("settings.inlineDelimiterDesc"))
    .addText((t) => t.setPlaceholder("::").setValue(this.plugin.inlineDelimiter()).onChange(async (v) => { this.plugin.settings.inlineEntryDelimiter = (v || "").trim() || "::"; await save(); await this.plugin.rebuildIndex(false); this.renderStats(); }));
  new Setting(inlineSection).setName(t("settings.inlineClassification")).setDesc(t("settings.inlineClassificationDesc"))
    .addDropdown((dropdown) => dropdown
      .addOption("heading", t("settings.classifyByHeading"))
      .addOption("file", t("settings.classifyByFile"))
      .setValue(this.plugin.settings.inlineClassificationMode)
      .onChange(async (mode) => { this.plugin.settings.inlineClassificationMode = mode === "file" ? "file" : "heading"; await save(); renderCategoryColors(); refresh(); }))
    .addExtraButton((button) => button.setIcon("refresh-cw").setTooltip(t("settings.refreshCategories")).onClick(async () => { await this.plugin.rebuildIndex(false); renderCategoryColors(); this.renderStats(); }));
  const categoryColorsWrap = inlineSection.createDiv({ cls: "lexis-inline-tree" });
  const openInlineHeading = async (node: InlineCategoryOccurrence) => {
    (this.app as AppWithSettingsModal).setting?.close();
    const leaf = this.app.workspace.getLeaf(false);
    await leaf.openFile(node.file, { active: true });
    await this.app.workspace.revealLeaf(leaf);
    const reveal = () => {
      const editor = leaf.view instanceof obsidian.MarkdownView ? leaf.view.editor : null;
      if (!editor) return;
      const position = { line: node.line, ch: 0 };
      editor.setCursor(position);
      editor.scrollIntoView({ from: position, to: position }, true);
    };
    reveal();
    window.setTimeout(reveal, 60);
  };
  const renderCategoryColors = () => {
    categoryColorsWrap.empty();
    const occurrences = this.plugin.inlineCategoryOccurrences || [];
    if (!occurrences.length) {
      categoryColorsWrap.createEl("p", { cls: "setting-item-description", text: t("settings.noInlineCategories") });
      return;
    }
    const mode = this.plugin.settings.inlineClassificationMode === "file" ? "file" : "heading";
    const groupMap = new Map<string, InlineGroup>();
    for (const node of occurrences) {
      const key = mode === "file" ? node.file.path : node.name;
      let group = groupMap.get(key);
      if (!group) {
        group = {
          id: `${mode}:${key}`,
          key,
          name: mode === "file" ? node.file.basename : node.name,
          count: 0,
          children: [],
        };
        groupMap.set(key, group);
      }
      group.count += node.count;
      group.children.push(node);
    }
    const parentOrder = mode === "file" ? this.plugin.settings.inlineFileOrder : this.plugin.settings.inlineCategoryOrder;
    const parentRank = new Map(parentOrder.map((key, index) => [key, index]));
    let groups = [...groupMap.values()].sort((a, b) => {
      const ar = parentRank.has(a.key) ? parentRank.get(a.key) : Number.MAX_SAFE_INTEGER;
      const br = parentRank.has(b.key) ? parentRank.get(b.key) : Number.MAX_SAFE_INTEGER;
      return ar - br || a.name.localeCompare(b.name);
    });
    for (const group of groups) {
      const childRank = new Map((this.plugin.settings.inlineCategoryOrderByParent[group.id] || []).map((id, index) => [id, index]));
      group.children.sort((a, b) => {
        const ar = childRank.has(a.id) ? childRank.get(a.id) : Number.MAX_SAFE_INTEGER;
        const br = childRank.has(b.id) ? childRank.get(b.id) : Number.MAX_SAFE_INTEGER;
        const aLabel = mode === "file" ? a.name : a.file.path;
        const bLabel = mode === "file" ? b.name : b.file.path;
        return ar - br || aLabel.localeCompare(bLabel) || a.line - b.line;
      });
    }
    const colors = mode === "file" ? this.plugin.settings.inlineFileColors : this.plugin.settings.inlineCategoryColors;
    const opacities = mode === "file" ? this.plugin.settings.inlineFileOpacity : this.plugin.settings.inlineCategoryOpacity;
    const visibility = mode === "file" ? this.plugin.settings.inlineFileHighlight : this.plugin.settings.inlineCategoryHighlight;
    const sourceVisibility = this.plugin.settings.inlineSourceHighlight;
    const collapsed = this.plugin.settings.inlineCollapsedGroups;
    const rootReorder = createReorderController({
      container: categoryColorsWrap,
      setIcon: obsidian.setIcon,
      label: t("settings.reorder"),
      onMove: async (from, to) => {
        groups = moveItem(groups, from, to);
        if (mode === "file") this.plugin.settings.inlineFileOrder = groups.map(({ key }) => key);
        else this.plugin.settings.inlineCategoryOrder = groups.map(({ key }) => key);
        await save();
        renderCategoryColors();
      },
    });
    groups.forEach((group, groupIndex) => {
      const enabled = visibility[group.key] !== false;
      const details = categoryColorsWrap.createEl("details", { cls: "lexis-inline-group" });
      details.open = collapsed[group.id] !== true;
      details.addEventListener("toggle", () => { void (async () => { collapsed[group.id] = !details.open; await save(); })(); });
      const summary = details.createEl("summary", { cls: "lexis-setting-row lexis-inline-group-row" });
      const chevron = summary.createSpan({ cls: "lexis-inline-chevron" });
      obsidian.setIcon(chevron, "chevron-right");
      summary.createSpan({ cls: "lexis-inline-group-name", text: group.name, attr: { title: group.key } });
      const parentControls = summary.createDiv({ cls: "lexis-inline-category-controls" });
      parentControls.addEventListener("click", (event) => event.stopPropagation());
      const countLabel = t("settings.entryCount", { count: group.count });
      parentControls.createSpan({ cls: "lexis-inline-count", text: countLabel, attr: { title: countLabel } });
      new obsidian.ToggleComponent(parentControls).setTooltip(t("settings.showGroupHighlight")).setValue(enabled)
        .onChange(async (value) => { visibility[group.key] = value; await save(); refresh(); renderCategoryColors(); });
      addAppearanceButton({
        app: this.app,
        obsidian,
        parent: parentControls,
        title: t("settings.categoryAppearance", { name: group.name }),
        labels: appearanceLabels,
        state: () => ({
          color: colors[group.key] || accentHex,
          opacity: Number(Object.prototype.hasOwnProperty.call(opacities, group.key) ? opacities[group.key] : this.plugin.settings.highlightOpacity),
        }),
        onChange: async (patch) => { if (patch.color != null) colors[group.key] = patch.color; if (patch.opacity != null) opacities[group.key] = patch.opacity; await save(); refresh(); },
        onReset: async () => { delete colors[group.key]; delete opacities[group.key]; await save(); refresh(); },
      });
      rootReorder.attach(details, groupIndex, { handleParent: summary });

      const childrenEl = details.createDiv({ cls: "lexis-inline-siblings lexis-inline-group-children" });
      const childReorder = createReorderController({
        container: childrenEl,
        setIcon: obsidian.setIcon,
        label: t("settings.reorder"),
        onMove: async (from, to) => {
          group.children = moveItem(group.children, from, to);
          this.plugin.settings.inlineCategoryOrderByParent[group.id] = group.children.map(({ id }) => id);
          await save();
          renderCategoryColors();
        },
      });
      group.children.forEach((node, childIndex) => {
        const row = childrenEl.createDiv({ cls: `lexis-setting-row lexis-inline-category-row${enabled ? "" : " is-disabled"}` });
        const label = mode === "file" ? node.name : node.file.basename;
        const link = row.createEl("button", {
          cls: "lexis-inline-category-link",
          text: label,
          attr: { type: "button", title: `${node.file.path}:${node.line + 1}` },
        });
        link.addEventListener("click", () => { void openInlineHeading(node); });
        const childControls = row.createDiv({ cls: "lexis-inline-category-controls" });
        const childCount = t("settings.entryCount", { count: node.count });
        childControls.createSpan({ cls: "lexis-inline-count", text: childCount, attr: { title: childCount } });
        new obsidian.ToggleComponent(childControls).setTooltip(t("settings.showSubsetHighlight"))
          .setValue(sourceVisibility[node.id] !== false).setDisabled(!enabled)
          .onChange(async (value) => { sourceVisibility[node.id] = value; await save(); refresh(); });
        childReorder.attach(row, childIndex);
      });
    });
  };
  renderCategoryColors();
}

"use strict";

import type { App, ColorComponent, MetadataCache, Plugin, Setting, SettingDefinitionItem, TextComponent, View } from "obsidian";
import type { TranslationVars } from "./i18n";
import type { HighlightStyle, InlineCategoryOccurrence, LexisSettings, LexisStats } from "./types";

interface SettingsRuntime extends Plugin {
  settings: LexisSettings;
  stats: LexisStats;
  inlineCategoryOccurrences: InlineCategoryOccurrence[];
  liveAvailable: boolean;
  _occCache: Map<string, unknown>;
  templateProvider: {
    templaterTemplateFor(folder: string): { path: string } | null;
  };
  bridge: {
    generateToken(): string;
    restart(): void;
  };
  t(key: string, vars?: TranslationVars): string;
  saveSettings(): Promise<void>;
  refreshAllViews(): void;
  rebuildIndex(notify?: boolean): Promise<void>;
  collectVocabTags(): string[];
  inlineDelimiter(): string;
  removeSelPill(): void;
  setupPdfHighlight(): void;
  teardownPdfHighlight(): void;
  rescanPdfLayers(): void;
  parseTags(text: string): string[];
  applyPopoverAppearance(popover: HTMLElement): void;
  applyReviewMetadataVisibility(): void;
  openReview(): Promise<void>;
}

interface SettingsTabDependencies {
  obsidian: typeof import("obsidian");
  PluginSettingTab: typeof import("obsidian").PluginSettingTab;
  Setting: typeof import("obsidian").Setting;
  Notice: typeof import("obsidian").Notice;
  TFolder: typeof import("obsidian").TFolder;
  DEFAULT_SETTINGS: Pick<LexisSettings, "occurrenceTemplate">;
  cssColorToHex: (color: string, document: Document) => string;
  addAppearanceButton: typeof import("./settings-controls").addAppearanceButton;
  createReorderController: typeof import("./settings-controls").createReorderController;
  moveItem: typeof import("./settings-controls").moveItem;
  LEXIS_HOME_VIEW: string;
  LEXIS_REVIEW_VIEW: string;
}

interface SuggestOptions {
  multi?: boolean;
  sep?: string;
}

interface InlineGroup {
  id: string;
  key: string;
  name: string;
  count: number;
  children: InlineCategoryOccurrence[];
}

type AppWithSettingsModal = App & { setting?: { close(): void } };
type RenderableView = View & { render?: () => void };
type MetadataCacheWithSuggestions = MetadataCache & {
  getTags?: () => Record<string, number>;
  getAllPropertyInfos?: () => Record<string, { name?: string }>;
};

const createSettingsTab = ({ obsidian, PluginSettingTab, Setting, Notice, TFolder, DEFAULT_SETTINGS, cssColorToHex, addAppearanceButton, createReorderController, moveItem, LEXIS_HOME_VIEW, LEXIS_REVIEW_VIEW }: SettingsTabDependencies) => {
  // 输入时模糊匹配建议。AbstractInputSuggest 在 Obsidian 1.0+ 运行时可用;
  // 缺失时 `|| class {}` 避免 extends undefined 报错,且调用处会跳过实例化。
  // opts.multi=true 时按最后一个分隔符后的"活动 token"匹配,选中后追加(用于逗号/空格分隔的标签/属性多值字段)。
  class PathSuggest extends obsidian.AbstractInputSuggest<string> {
    getItems: () => string[];
    onPick: (value: string) => void;
    multi: boolean;
    sep: string;
    inputEl: HTMLInputElement;

    constructor(app: App, inputEl: HTMLInputElement, getItems: () => string[], onPick: (value: string) => void, opts: SuggestOptions = {}) {
      super(app, inputEl);
      this.inputEl = inputEl;
      this.getItems = getItems;
      this.onPick = onPick;
      this.multi = !!(opts && opts.multi);
      this.sep = (opts && opts.sep) || " ";
    }
    _split() {
      const v = (this.inputEl && this.inputEl.value) || "";
      const m = v.match(/[^\s,，;；]*$/);
      const token = m ? m[0] : "";
      return { before: v.slice(0, v.length - token.length), token };
    }
    getSuggestions(query: string): string[] {
      let items = this.getItems();
      let q: string;
      if (this.multi) {
        const { token } = this._split();
        q = token.toLowerCase();
        const chosen = new Set(((this.inputEl && this.inputEl.value) || "").toLowerCase().split(/[\s,，;；]+/).filter(Boolean));
        items = items.filter((p) => p.toLowerCase() === token.toLowerCase() || !chosen.has(p.toLowerCase()));
      } else {
        q = (query || "").toLowerCase();
      }
      return items.filter((p) => p.toLowerCase().includes(q)).slice(0, 50);
    }
    renderSuggestion(value: string, el: HTMLElement) { el.setText(value); }
    selectSuggestion(value: string) {
      if (this.multi) {
        // 多值:把选中项追加到当前列表后,重新触发建议(列表保持打开),可以接着选下一个
        const { before } = this._split();
        const out = before + value + this.sep;
        if (this.inputEl) this.inputEl.value = out;
        if (this.onPick) this.onPick(out);
        if (typeof this.setValue === "function") this.setValue(out); // 触发 input 事件,刷新并保持下拉
        if (this.inputEl) this.inputEl.focus();
        return;
      }
      if (typeof this.setValue === "function") this.setValue(value);
      if (this.inputEl) this.inputEl.value = value;
      if (typeof this.close === "function") this.close();
      if (this.onPick) this.onPick(value);
    }
  }

  return class LexisSettingTab extends PluginSettingTab {
    declare plugin: SettingsRuntime;
    statsEl: HTMLElement | null = null;
    _colorComp: ColorComponent | null = null;
    constructor(app: App, plugin: SettingsRuntime) { super(app, plugin); this.plugin = plugin; }

    section(containerEl: HTMLElement, title: string, { open = false, desc = "" }: { open?: boolean; desc?: string } = {}): HTMLElement {
      const details = containerEl.createEl("details", { cls: "lexis-settings-section" });
      details.open = open;
      const summary = details.createEl("summary");
      summary.createSpan({ text: title });
      if (desc) summary.createSpan({ cls: "lexis-settings-section-hint", text: desc });
      return details.createDiv({ cls: "lexis-settings-section-body" });
    }

    getSettingDefinitions(): SettingDefinitionItem[] {
      return [{
        name: "Lexis",
        aliases: ["dictionary", "highlight", "review", "browser", "PDF", "词典", "高亮", "复习"],
        render: (setting: Setting) => {
          setting.settingEl.empty();
          setting.settingEl.addClass("lexis-settings-root");
          this.renderSettings(setting.settingEl);
        },
      }];
    }

    renderSettings(containerEl: HTMLElement): void {
      containerEl.empty();
      const t = (key: string, vars?: TranslationVars) => this.plugin.t(key, vars);
      const document = containerEl.ownerDocument;
      const accentHex = cssColorToHex(document.defaultView?.getComputedStyle(document.body).getPropertyValue("--text-accent") || "", document);
      const save = () => this.plugin.saveSettings();
      const refresh = () => this.plugin.refreshAllViews();
      const appearanceLabels = {
        color: t("settings.highlightColor"),
        opacity: t("settings.opacity"),
        style: t("settings.highlightStyle"),
        defaultStyle: t("common.default"),
        wavy: t("settings.wavy"),
        underline: t("settings.underline"),
        background: t("settings.background"),
        reset: t("settings.resetAppearance"),
        done: t("common.done"),
      };
      new Setting(containerEl).setName(t("settings.title")).setHeading();

      new Setting(containerEl).setName(t("language.name"))
        .addDropdown((dd) => dd.addOption("zh", t("language.zh")).addOption("en", t("language.en")).setValue(this.plugin.settings.language || "zh").onChange(async (value) => {
          this.plugin.settings.language = value === "en" ? "en" : "zh";
          await save();
          this.plugin.refreshAllViews();
          this.app.workspace.iterateAllLeaves((leaf) => {
            const type = leaf?.view?.getViewType?.();
            if (type === LEXIS_HOME_VIEW || type === LEXIS_REVIEW_VIEW) (leaf.view as RenderableView).render?.();
          });
          new Notice(t("language.reload"));
          this.update();
        }));

      const folders = this.app.vault.getAllLoadedFiles().filter((f) => f instanceof TFolder).map((f) => f.path).filter((p) => p && p !== "/").sort();
      const mdFiles = this.app.vault.getMarkdownFiles().map((f) => f.path).sort();
      const hasSuggest = !!obsidian.AbstractInputSuggest;
      const allTags = (() => {
        const s = new Set(this.plugin.collectVocabTags());
        try { const tg = (this.app.metadataCache as MetadataCacheWithSuggestions).getTags?.() || {}; for (const k in tg) s.add(k.replace(/^#/, "").toLowerCase()); } catch { /* Suggestions are optional. */ }
        return [...s].filter(Boolean).sort();
      })();
      const allProps = (() => {
        try {
          const infos = (this.app.metadataCache as MetadataCacheWithSuggestions).getAllPropertyInfos?.();
          if (infos) return Object.values(infos).map((info) => info.name).filter((name): name is string => !!name).sort();
        } catch { /* Suggestions are optional. */ }
        return [];
      })();
      const tagSuggest = (comp: TextComponent, apply: (value: string) => void | Promise<void>) => { if (hasSuggest) new PathSuggest(this.app, comp.inputEl, () => allTags, (value) => { comp.setValue(value); void apply(value); }, { multi: true }); };

      const dictSection = this.section(containerEl, t("settings.dictionary"), { open: true });
      new Setting(dictSection).setDesc(t("settings.dictionaryDesc")).setHeading();
      const dictsWrap = dictSection.createDiv();
      const renderDicts = () => {
        dictsWrap.empty();
        const reorder = createReorderController({
          container: dictsWrap,
          setIcon: obsidian.setIcon,
          label: t("settings.reorder"),
          onMove: async (from, to) => {
            this.plugin.settings.dicts = moveItem(this.plugin.settings.dicts, from, to);
            await save();
            await this.plugin.rebuildIndex(false);
            renderDicts();
          },
        });
        (this.plugin.settings.dicts || []).forEach((d, i) => {
          const row = dictsWrap.createDiv({ cls: "lexis-setting-row lexis-dictionary-row" });
          const fIn = new obsidian.TextComponent(row);
          fIn.setPlaceholder(t("settings.folderPlaceholder")).setValue(d.folder || "");
          fIn.inputEl.setCssStyles({ flex: "1" });
          const tIn = new obsidian.TextComponent(row);
          tIn.setPlaceholder(t("settings.templatePlaceholder")).setValue(d.template || "");
          tIn.inputEl.setCssStyles({ flex: "1.4" });
          const updateTemplateSource = () => {
            const match = this.plugin.templateProvider.templaterTemplateFor(d.folder);
            tIn.setDisabled(!!match);
            tIn.setValue(match ? match.path : (d.template || ""));
            tIn.inputEl.title = match ? t("settings.templaterTemplate", { path: match.path }) : "";
          };
          const onFolder = async (v: string) => { d.folder = (v || "").trim(); updateTemplateSource(); await save(); void this.plugin.rebuildIndex(false); this.renderStats(); };
          fIn.onChange(onFolder);
          const onTpl = async (v: string) => { d.template = (v || "").trim(); await save(); };
          tIn.onChange(onTpl);
          updateTemplateSource();
          if (hasSuggest) {
            new PathSuggest(this.app, fIn.inputEl, () => folders, (v) => { fIn.setValue(v); void onFolder(v); });
            new PathSuggest(this.app, tIn.inputEl, () => mdFiles, (v) => { tIn.setValue(v); void onTpl(v); });
          }
          const globalColor = this.plugin.settings.highlightColor || accentHex;
          addAppearanceButton({
            app: this.app,
            obsidian,
            parent: row,
            title: t("settings.dictionaryAppearance"),
            labels: appearanceLabels,
            state: () => ({ color: d.color || globalColor, opacity: Number(d.opacity ?? this.plugin.settings.highlightOpacity) }),
            onChange: async (patch) => { Object.assign(d, patch); await save(); refresh(); },
            onReset: async () => { delete d.color; delete d.opacity; await save(); refresh(); },
          });
          new obsidian.ExtraButtonComponent(row).setIcon("trash").setTooltip(t("settings.deleteDictionary")).onClick(async () => { this.plugin.settings.dicts.splice(i, 1); await save(); await this.plugin.rebuildIndex(false); renderDicts(); this.renderStats(); });
          reorder.attach(row, i);
        });
        const addDict = dictsWrap.createEl("button", { text: t("settings.addDictionary") });
        addDict.setCssStyles({ marginTop: "2px" });
        addDict.addEventListener("click", () => { void (async () => { this.plugin.settings.dicts.push({ folder: "", template: "" }); await save(); renderDicts(); })(); });
      };
      renderDicts();
      new Setting(dictSection).setName(t("settings.tagsAsEntries")).setDesc(t("settings.tagsAsEntriesDesc"))
        .addText((t) => {
          t.setPlaceholder("词汇 术语").setValue(this.plugin.settings.vocabTags);
          const apply = async (v: string) => { this.plugin.settings.vocabTags = v; await save(); void this.plugin.rebuildIndex(true); this.renderStats(); };
          t.onChange(apply); tagSuggest(t, apply);
        });
      new Setting(dictSection).setName(t("settings.includeAliases"))
        .addToggle((t) => t.setValue(this.plugin.settings.includeAliases).onChange(async (v) => { this.plugin.settings.includeAliases = v; await save(); await this.plugin.rebuildIndex(false); this.renderStats(); }));
      new Setting(dictSection).setName(t("settings.aliasProperties")).setDesc(t("settings.aliasPropertiesDesc"))
        .addText((t) => {
          t.setPlaceholder("Past, forms, variants").setValue(this.plugin.settings.aliasSources);
          const apply = async (v: string) => { this.plugin.settings.aliasSources = (v || "").trim(); await save(); if (this.plugin.settings.includeAliases) { void this.plugin.rebuildIndex(false); this.renderStats(); } };
          t.onChange(apply);
          if (hasSuggest) new PathSuggest(this.app, t.inputEl, () => allProps, (v) => { t.setValue(v); void apply(v); }, { multi: true, sep: "," });
        });

      const inlineSection = this.section(containerEl, t("settings.inline"), { desc: t("settings.inlineDesc") });
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

      const hlSection = this.section(containerEl, t("settings.highlight"));
      new Setting(hlSection).setName(t("settings.enableHighlight")).addToggle((toggle) => toggle.setValue(this.plugin.settings.enableHighlight).onChange(async (v) => { this.plugin.settings.enableHighlight = v; await save(); refresh(); }));
      new Setting(hlSection).setName(t("settings.livePreview")).setDesc(this.plugin.liveAvailable ? "" : t("settings.unsupported"))
        .addToggle((t) => t.setValue(this.plugin.settings.enableLivePreview).setDisabled(!this.plugin.liveAvailable).onChange(async (v) => { this.plugin.settings.enableLivePreview = v; await save(); refresh(); }));
      new Setting(hlSection).setName(t("settings.selectionPill"))
        .addToggle((t) => t.setValue(this.plugin.settings.selectionPill).onChange(async (v) => { this.plugin.settings.selectionPill = v; await save(); if (!v) this.plugin.removeSelPill(); }));
      new Setting(hlSection).setName(t("settings.pdfHighlight")).setDesc(t("settings.pdfHighlightDesc"))
        .addToggle((t) => t.setValue(this.plugin.settings.enablePdfHighlight).onChange(async (v) => { this.plugin.settings.enablePdfHighlight = v; await save(); if (v) this.plugin.setupPdfHighlight(); else { this.plugin.teardownPdfHighlight(); this.plugin.rescanPdfLayers(); } }));
      new Setting(hlSection).setName(t("settings.highlightStyle"))
        .addDropdown((dd) => dd.addOption("wavy", t("settings.wavy")).addOption("underline", t("settings.underline")).addOption("background", t("settings.background")).setValue(this.plugin.settings.highlightStyle).onChange(async (v) => { this.plugin.settings.highlightStyle = ["wavy", "underline", "background"].includes(v) ? v as HighlightStyle : "wavy"; await save(); refresh(); }));
      new Setting(hlSection).setName(t("settings.highlightColor"))
        .addColorPicker((cp) => { this._colorComp = cp; cp.setValue(this.plugin.settings.highlightColor || accentHex).onChange(async (v) => { this.plugin.settings.highlightColor = v; await save(); refresh(); }); })
        .addExtraButton((b) => b.setIcon("reset").setTooltip(t("settings.resetTheme")).onClick(async () => { this.plugin.settings.highlightColor = ""; this._colorComp?.setValue(accentHex); await save(); refresh(); }));
      new Setting(hlSection).setName(t("settings.opacity"))
        .addSlider((s) => s.setLimits(0.1, 1, 0.05).setValue(this.plugin.settings.highlightOpacity).onChange(async (v) => { this.plugin.settings.highlightOpacity = v; await save(); refresh(); }));
      new Setting(hlSection).setName(t("settings.fade")).setDesc(t("settings.fadeDesc"))
        .addToggle((t) => t.setValue(this.plugin.settings.fadeByMemory).onChange(async (v) => { this.plugin.settings.fadeByMemory = v; await save(); refresh(); }));
      new Setting(hlSection).setName(t("settings.fadeFloor"))
        .addSlider((s) => s.setLimits(0, 0.9, 0.05).setValue(this.plugin.settings.fadeFloor).onChange(async (v) => { this.plugin.settings.fadeFloor = v; await save(); refresh(); }));
      const excludeSetting = new Setting(hlSection).setName(t("settings.excludeTags")).setDesc(t("settings.excludeTagsDesc"));
      excludeSetting.settingEl.addClass("lexis-tags-setting");
      const excludeEditor = excludeSetting.controlEl.createDiv({ cls: "lexis-tag-editor" });
      const excludeChips = excludeEditor.createDiv({ cls: "lexis-tag-editor-chips" });
      const excludeAdd = excludeEditor.createDiv({ cls: "lexis-tag-editor-add" });
      const excludeInput = new obsidian.TextComponent(excludeAdd).setPlaceholder(t("settings.addExcludedTag"));
      const excludedTags = () => [...new Set(this.plugin.parseTags(this.plugin.settings.excludeTags))];
      const saveExcludedTags = async (tags: string[]) => {
        this.plugin.settings.excludeTags = tags.join(" ");
        await save();
        await this.plugin.rebuildIndex(false);
      };
      const renderExcludedTags = () => {
        excludeChips.empty();
        for (const tag of excludedTags()) {
          const chip = excludeChips.createEl("button", { cls: "lexis-tag-editor-chip", attr: { type: "button", title: t("settings.removeExcludedTag", { tag }) } });
          chip.createSpan({ text: `#${tag}` });
          chip.createSpan({ cls: "lexis-tag-editor-remove", text: "×" });
          chip.addEventListener("click", () => { void (async () => { await saveExcludedTags(excludedTags().filter((value) => value !== tag)); renderExcludedTags(); })(); });
        }
      };
      const addExcludedTags = async (raw: string) => {
        const incoming = this.plugin.parseTags(raw);
        if (!incoming.length) return;
        await saveExcludedTags([...new Set([...excludedTags(), ...incoming])]);
        excludeInput.setValue("");
        renderExcludedTags();
        excludeInput.inputEl.focus();
      };
      excludeInput.inputEl.addEventListener("keydown", (event) => {
        if (["Enter", ",", "，", ";", "；"].includes(event.key)) {
          event.preventDefault();
          void addExcludedTags(excludeInput.inputEl.value);
        } else if (event.key === "Backspace" && !excludeInput.inputEl.value) {
          const tags = excludedTags();
          if (tags.length) { tags.pop(); void saveExcludedTags(tags).then(renderExcludedTags); }
        }
      });
      new obsidian.ExtraButtonComponent(excludeAdd).setIcon("plus").setTooltip(t("settings.addExcludedTag")).onClick(() => { void addExcludedTags(excludeInput.inputEl.value); });
      if (hasSuggest) new PathSuggest(this.app, excludeInput.inputEl, () => allTags.filter((tag) => !excludedTags().includes(tag)), (value) => { void addExcludedTags(value); });
      renderExcludedTags();

      const tagColorSection = this.section(containerEl, t("settings.tagColors"));
      const rulesWrap = tagColorSection.createDiv();
      const renderRules = () => {
        rulesWrap.empty();
        const grid = rulesWrap.createDiv({ cls: "lexis-rule-grid" });
        const reorder = createReorderController({
          container: grid,
          setIcon: obsidian.setIcon,
          label: t("settings.reorder"),
          onMove: async (from, to) => {
            this.plugin.settings.tagRules = moveItem(this.plugin.settings.tagRules, from, to);
            await save();
            refresh();
            renderRules();
          },
        });
        this.plugin.settings.tagRules.forEach((rule, i) => {
          const cell = grid.createDiv({ cls: "lexis-setting-row lexis-rule" });
          const tagIn = new obsidian.TextComponent(cell).setPlaceholder(t("settings.tagPlaceholder")).setValue(rule.tag);
          const applyTag = async (v: string) => { rule.tag = (v || "").trim(); await save(); refresh(); };
          tagIn.onChange(applyTag);
          if (hasSuggest) new PathSuggest(this.app, tagIn.inputEl, () => allTags, (v) => { tagIn.setValue(v); void applyTag(v); });
          addAppearanceButton({
            app: this.app,
            obsidian,
            parent: cell,
            title: t("settings.tagAppearance"),
            labels: appearanceLabels,
            allowStyle: true,
            state: () => ({ color: rule.color || accentHex, opacity: Number(rule.opacity ?? this.plugin.settings.highlightOpacity), style: rule.style || "" }),
            onChange: async (patch) => { Object.assign(rule, patch); await save(); refresh(); },
            onReset: async () => { delete rule.color; delete rule.opacity; delete rule.style; await save(); refresh(); },
          });
          new obsidian.ExtraButtonComponent(cell).setIcon("trash").setTooltip(t("common.delete")).onClick(async () => { this.plugin.settings.tagRules.splice(i, 1); await save(); refresh(); renderRules(); });
          reorder.attach(cell, i);
        });
        const addRule = rulesWrap.createEl("button", { text: t("settings.addTagRule") });
        addRule.setCssStyles({ marginTop: "2px" });
        addRule.addEventListener("click", () => { void (async () => { this.plugin.settings.tagRules.push({ tag: "", color: accentHex, style: "" }); await save(); renderRules(); })(); });
      };
      renderRules();

      const cardSection = this.section(containerEl, t("settings.popover"));
      const preview = cardSection.createDiv({ cls: "lexis-popover lexis-popover-preview" });
      const previewScroll = preview.createDiv({ cls: "lexis-popover-scroll" });
      previewScroll.createDiv({ cls: "lexis-popover-title", text: "Yalda · 人物" });
      previewScroll.createDiv({ cls: "lexis-popover-body", text: t("settings.popoverPreview") });
      const updateCards = () => {
        this.plugin.applyPopoverAppearance(preview);
        const doc = preview.ownerDocument || document;
        doc.querySelectorAll<HTMLElement>(".lexis-popover:not(.lexis-popover-preview)").forEach((el) => this.plugin.applyPopoverAppearance(el));
      };
      updateCards();
      new Setting(cardSection).setName(t("settings.popoverFont"))
        .addSlider((s) => s.setLimits(11, 24, 1).setValue(this.plugin.settings.popoverFontSize).onChange(async (v) => { this.plugin.settings.popoverFontSize = v; updateCards(); await save(); }));
      new Setting(cardSection).setName(t("settings.hoverDelay")).setDesc(t("settings.hoverDelayDesc"))
        .addSlider((s) => s.setLimits(0, 3, 0.1).setValue((this.plugin.settings.hoverDelayMs || 0) / 1000).onChange(async (v) => { this.plugin.settings.hoverDelayMs = Math.round(v * 1000); await save(); }));
      new Setting(cardSection).setName(t("settings.showRelated")).addToggle((toggle) => toggle.setValue(this.plugin.settings.showRelated).onChange(async (v) => { this.plugin.settings.showRelated = v; await save(); }));
      new Setting(cardSection).setName(t("settings.showOccurrences")).setDesc(t("settings.showOccurrencesDesc"))
        .addToggle((t) => t.setValue(this.plugin.settings.showOccurrences).onChange(async (v) => { this.plugin.settings.showOccurrences = v; await save(); }));
      new Setting(cardSection).setName(t("settings.pdfOccurrences")).setDesc(t("settings.pdfOccurrencesDesc"))
        .addToggle((toggle) => toggle.setValue(this.plugin.settings.includePdfOccurrences !== false).onChange(async (v) => { this.plugin.settings.includePdfOccurrences = v; this.plugin._occCache.clear(); await save(); }));
      new Setting(cardSection).setName(t("settings.occurrenceLimit")).addSlider((s) => s.setLimits(1, 15, 1).setValue(this.plugin.settings.occurrenceLimit).onChange(async (v) => { this.plugin.settings.occurrenceLimit = v; await save(); this.plugin._occCache.clear(); }));
      new Setting(cardSection).setName(t("settings.occurrenceScope")).setDesc(t("settings.occurrenceScopeDesc"))
        .addText((input) => input.setPlaceholder(t("settings.wholeVault")).setValue(this.plugin.settings.occurrenceFolders).onChange(async (v) => { this.plugin.settings.occurrenceFolders = v.trim(); await save(); this.plugin._occCache.clear(); }));

      const addSection = this.section(containerEl, t("settings.selectionAdd"));
      new Setting(addSection).setName(t("settings.emptyNotePreset")).setDesc(t("settings.emptyNotePresetDesc"))
        .addDropdown((dropdown) => dropdown
          .addOption("blank", t("settings.emptyNoteBlank"))
          .addOption("occ", t("settings.emptyNoteOccurrences"))
          .setValue(this.plugin.settings.emptyNotePreset || "blank")
          .onChange(async (value) => { this.plugin.settings.emptyNotePreset = value === "occ" ? "occ" : "blank"; await save(); }));
      new Setting(addSection).setName(t("settings.defaultTemplate")).setDesc(t("settings.defaultTemplateDesc"))
        .addText((input) => {
          input.setPlaceholder("template/word.md").setValue(this.plugin.settings.newWordTemplate);
          const onTpl = async (v: string) => { this.plugin.settings.newWordTemplate = (v || "").trim(); await save(); };
          input.onChange(onTpl);
          if (hasSuggest) new PathSuggest(this.app, input.inputEl, () => mdFiles, (v) => { input.setValue(v); void onTpl(v); });
        });
      const occurrenceSetting = new Setting(addSection).setName(t("settings.occurrenceTemplate")).setDesc(t("settings.occurrenceTemplateDesc"))
        .addTextArea((input) => input
          .setPlaceholder(DEFAULT_SETTINGS.occurrenceTemplate)
          .setValue(this.plugin.settings.occurrenceTemplate ?? DEFAULT_SETTINGS.occurrenceTemplate)
          .onChange(async (v) => { this.plugin.settings.occurrenceTemplate = v; await save(); }));
      occurrenceSetting.settingEl.addClass("lexis-template-setting");
      const occurrenceTextarea = occurrenceSetting.controlEl.querySelector("textarea");
      if (occurrenceTextarea) occurrenceTextarea.rows = 4;

      const fsrsSection = this.section(containerEl, t("settings.review"));
      new Setting(fsrsSection).setName(t("settings.retention")).setDesc(t("settings.retentionDesc"))
        .addSlider((s) => s.setLimits(0.8, 0.97, 0.01).setValue(this.plugin.settings.requestRetention).onChange(async (v) => { this.plugin.settings.requestRetention = v; await save(); }));
      new Setting(fsrsSection).setName(t("settings.newLimit")).addSlider((s) => s.setLimits(0, 100, 5).setValue(this.plugin.settings.newPerDay).onChange(async (v) => { this.plugin.settings.newPerDay = v; await save(); }));
      new Setting(fsrsSection).setName(t("settings.sessionLimit")).addSlider((s) => s.setLimits(10, 500, 10).setValue(this.plugin.settings.maxReviewsPerSession).onChange(async (v) => { this.plugin.settings.maxReviewsPerSession = v; await save(); }));
      new Setting(fsrsSection).setName(t("settings.cardFront")).setDesc(t("settings.cardFrontDesc"))
        .addDropdown((dd) => dd.addOption("note", t("settings.noteCard")).addOption("cloze", t("settings.clozeCard")).setValue(this.plugin.settings.cardFront).onChange(async (v) => { this.plugin.settings.cardFront = v === "cloze" ? "cloze" : "note"; await save(); }));
      new Setting(fsrsSection).setName(t("settings.showReviewMetadata")).setDesc(t("settings.showReviewMetadataDesc"))
        .addToggle((toggle) => toggle.setValue(!!this.plugin.settings.showReviewMetadata).onChange(async (value) => {
          this.plugin.settings.showReviewMetadata = value;
          this.plugin.applyReviewMetadataVisibility();
          await save();
        }));
      new Setting(fsrsSection).setName(t("settings.ratingOffset")).setDesc(t("settings.ratingOffsetDesc"))
        .addSlider((s) => s.setLimits(0, 200, 5).setValue(this.plugin.settings.reviewBottomSpace).onChange(async (v) => { this.plugin.settings.reviewBottomSpace = v; await save(); }));
      new Setting(fsrsSection).setName(t("home.start")).addButton((b) => b.setButtonText(t("settings.openReview")).setCta().onClick(() => this.plugin.openReview()));
      new Setting(fsrsSection).setName(t("settings.hoverFeedback")).setDesc(t("settings.hoverFeedbackDesc"))
        .addToggle((t) => t.setValue(this.plugin.settings.hoverFeedback).onChange(async (v) => { this.plugin.settings.hoverFeedback = v; await save(); }));
      new Setting(fsrsSection).setName(t("settings.feedbackDays")).setDesc(t("settings.feedbackDaysDesc"))
        .addSlider((s) => s.setLimits(1, 30, 1).setValue(this.plugin.settings.hoverFeedbackDays).onChange(async (v) => { this.plugin.settings.hoverFeedbackDays = v; await save(); }));
      new Setting(fsrsSection).setName(t("settings.retireDays")).setDesc(t("settings.retireDaysDesc"))
        .addSlider((s) => s.setLimits(14, 365, 1).setValue(this.plugin.settings.retireCandidateDays).onChange(async (v) => { this.plugin.settings.retireCandidateDays = v; await save(); }));

      const bridgeSection = this.section(containerEl, t("settings.bridge"), { desc: t("settings.bridgeDesc") });
      new Setting(bridgeSection).setName(t("settings.annotationHeading")).setDesc(t("settings.annotationHeadingDesc"))
        .addText((t) => t.setPlaceholder("#### 批注").setValue(this.plugin.settings.annotationHeading).onChange(async (v) => { this.plugin.settings.annotationHeading = v; await save(); }));
      new Setting(bridgeSection).setName(t("settings.enableBridge"))
        .addToggle((t) => t.setValue(this.plugin.settings.bridgeEnabled).onChange(async (v) => {
          this.plugin.settings.bridgeEnabled = v;
          if (v && !this.plugin.settings.bridgeToken) this.plugin.settings.bridgeToken = this.plugin.bridge.generateToken();
          await save();
          this.plugin.bridge.restart();
          this.update();
        }));
      new Setting(bridgeSection).setName(t("settings.port")).setDesc(t("settings.portDesc"))
        .addText((t) => t.setValue(String(this.plugin.settings.bridgePort)).onChange(async (v) => { const n = parseInt(v, 10); if (n >= 1024 && n <= 65535) { this.plugin.settings.bridgePort = n; await save(); } }))
        .addExtraButton((b) => b.setIcon("rotate-ccw").setTooltip(t("settings.restartBridge")).onClick(() => { this.plugin.bridge.restart(); new Notice(t("notice.bridgeRestarted")); }));
      new Setting(bridgeSection).setName(t("settings.token")).setDesc(t("settings.tokenDesc"))
        .addText((input) => { input.setValue(this.plugin.settings.bridgeToken || t("settings.tokenPending")).setDisabled(true); input.inputEl.setCssStyles({ width: "260px" }); })
        .addExtraButton((b) => b.setIcon("copy").setTooltip(t("settings.copyToken")).onClick(async () => { if (this.plugin.settings.bridgeToken) { await navigator.clipboard.writeText(this.plugin.settings.bridgeToken); new Notice(t("notice.tokenCopied")); } }))
        .addExtraButton((b) => b.setIcon("refresh-cw").setTooltip(t("settings.regenerateToken")).onClick(async () => { this.plugin.settings.bridgeToken = this.plugin.bridge.generateToken(); await save(); this.plugin.bridge.restart(); this.update(); }));

      new Setting(containerEl).setName(t("settings.rebuild")).addButton((b) => b.setButtonText(t("settings.rebuildNow")).onClick(() => { void this.plugin.rebuildIndex(true); this.renderStats(); }));
      this.statsEl = containerEl.createEl("p", { cls: "lexis-stats" });
      this.renderStats();
    }

    renderStats() {
      if (!this.statsEl) return;
      const s = this.plugin.stats;
      this.statsEl.setText(this.plugin.t("settings.stats", { words: s.words, aliases: s.aliases, inline: s.inlineEntries || 0, due: s.due || 0 }));
    }
  }
};

export { createSettingsTab };

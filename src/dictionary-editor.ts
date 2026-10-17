import * as obsidian from "obsidian";
import { Modal, Notice, Setting, type App } from "obsidian";
import type { DictionarySetting, DictionarySource } from "./types";
import { dictionarySources, sourceLabel, sourcePath } from "./dictionary-sources";
import { createPathSuggest } from "./settings-suggest";
interface EditorHost {
    templateProvider: {
        templaterTemplateFor(folder: string): {
            path: string;
        } | null;
    };
    t(key: string, vars?: Record<string,string>): string;
}
export class DictionaryEditor extends Modal {
    private draft: DictionarySetting;
    private destinationEdited = false;
    private destinationSource: DictionarySource | null;
    private suggests: Array<{
        close(): void;
    }> = [];
    constructor(app: App, private host: EditorHost, row: DictionarySetting | null, private commit: (row: DictionarySetting) => Promise<void>) {
        super(app);
        this.draft = row ? structuredClone({ ...row, sources: dictionarySources(row) }) : { id: crypto.randomUUID(), name: "", sources: [{ kind: "folder", value: "" }], folder: "", template: "", highlight: true };
        this.destinationSource=this.draft.sources.find(source=>source.kind==="folder"&&sourcePath(source.value)===sourcePath(this.draft.folder)) || null;
    }
    onOpen(): void { this.setTitle(this.host.t("collection.edit")); this.render(); }
    private render(): void {
        this.suggests.forEach(suggest => suggest.close());
        this.suggests = [];
        const root = this.contentEl;
        root.empty();
        root.addClass("lexis-dictionary-editor");
        const t = (key: string) => this.host.t(key);
        const folders = this.app.vault.getAllLoadedFiles().filter(file => "children" in file).map(file => file.path).filter(path => path && path !== "/");
        const files = this.app.vault.getMarkdownFiles().map(file => file.path);
        const tags = new Set<string>();
        for (const file of this.app.vault.getMarkdownFiles()) {
            const cache = this.app.metadataCache.getFileCache(file);
            for (const value of cache?.tags || [])
                tags.add(value.tag);
            const raw: unknown = cache?.frontmatter?.tags;
            for (const value of Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(/[,，;；\s]+/) : [])
                if (typeof value === "string")
                    tags.add(`#${value.replace(/^#/, "")}`);
        }
        const Suggest = createPathSuggest(obsidian);
        const suggest = (input: HTMLInputElement, values: () => string[], pick: (value: string) => void) => {
            this.suggests.push(new Suggest(this.app, input, values, pick, { fuzzy: true }));
        };
        new Setting(root).setName(t("collection.name")).addText(input => input.setValue(this.draft.name || "").onChange(value => { this.draft.name = value; }));
        new Setting(root).setName(t("collection.sources")).setDesc(t("collection.sourcesHint")).addButton(button => {
            button.setIcon("plus").setTooltip(t("collection.addSource"));
            button.buttonEl.setAttribute("aria-label",t("collection.addSource"));
            button.onClick(() => {
                this.draft.sources.push({ kind: "folder", value: "" });
                this.render();
            });
        });
        let updateDestination = (value:string) => { this.draft.folder=value; };
        const releaseDestination = (source:DictionarySource) => {
            if(this.destinationSource!==source || this.destinationEdited) return;
            this.destinationSource=null;updateDestination("");
        };
        for (const [index, source] of this.draft.sources.entries()) {
            const row = root.createDiv({ cls: "lexis-collection-source" });
            const kind = row.createEl("button", { text: t(`collection.${source.kind}`), attr: { type: "button" } });
            if(source.kind === "file" || source.kind === "links") kind.title=t(`collection.${source.kind}Hint`);
            kind.onclick = event => {
                const menu = new obsidian.Menu();
                for (const value of ["folder", "tag", "file", "links"] as const)
                    menu.addItem(item => item.setTitle(t(`collection.${value}`)).setChecked(source.kind === value).onClick(() => { releaseDestination(source);source.kind = value; source.value = ""; this.render(); }));
                menu.showAtMouseEvent(event);
            };
            const input = new obsidian.TextComponent(row).setValue(source.kind === "tag" ? `#${source.value.replace(/^#/, "")}` : source.value);
            const apply = (value: string) => {
                if (value.startsWith("#")) {
                    releaseDestination(source);
                    source.kind = "tag";
                    kind.setText(t("collection.tag"));
                    kind.title="";
                }
                source.value = value;
                input.setValue(value);
                const folder=source.kind === "folder" ? folders.find(path=>sourcePath(path)===sourcePath(value)) : undefined;
                if(folder && !this.destinationEdited && (!this.draft.folder || this.destinationSource===source)) {this.destinationSource=source;updateDestination(folder);}
            };
            input.onChange(apply);
            suggest(input.inputEl, () => source.kind === "folder" ? folders : source.kind === "tag" ? [...tags] : files, apply);
            new obsidian.ExtraButtonComponent(row).setIcon("trash").setTooltip(t("common.delete")).onClick(() => { releaseDestination(source);this.draft.sources.splice(index, 1); this.render(); });
        }
        let refreshTemplate = () => {};
        new Setting(root).setName(t("collection.destination")).setDesc(t("collection.destinationHint")).addText(input => {
            updateDestination = (value:string) => { this.draft.folder=value; input.setValue(value); refreshTemplate(); };
            const pick = (value:string) => { this.destinationEdited=true;updateDestination(value); };
            input.setValue(this.draft.folder || "").onChange(pick);
            suggest(input.inputEl, () => folders, pick);
        });
        const template = new Setting(root).setName(t("settings.defaultTemplate"));
        template.addText(input => {
            input.setValue(this.draft.template || "").onChange(value => { this.draft.template = value; });
            suggest(input.inputEl, () => files, value => { this.draft.template = value; input.setValue(value); });
            refreshTemplate = () => {
                const managed = this.host.templateProvider.templaterTemplateFor(this.draft.folder);
                template.setDesc(managed ? this.host.t("settings.templaterTemplate",{path:managed.path}) : "");
                input.setDisabled(!!managed);
            };
        });
        refreshTemplate();
        new Setting(root).addButton(button => {
          button.setIcon("check").setTooltip(t("collection.save")).setCta();
          button.buttonEl.setAttribute("aria-label",t("collection.save"));
          button.onClick(async () => {
            const sources = dictionarySources(this.draft);
            const valid = (source: DictionarySource) => source.kind === "tag" || (source.kind === "folder" ? folders : files).some(value => value.normalize("NFC") === source.value);
            const destination = this.draft.folder.normalize("NFC");
            const destinationValid = !destination || (folders.some(path => path.normalize("NFC") === destination) && sources.some(source => source.kind === "folder" && (destination === source.value || destination.startsWith(source.value + "/"))));
            if (!sources.length || sources.length !== this.draft.sources.length || !sources.every(valid) || !destinationValid || (this.draft.template && !files.includes(this.draft.template))) {
                new Notice(t("collection.invalid"));
                return;
            }
            this.draft.sources = sources;
            delete this.draft.tag;
            if (!this.draft.name?.trim())
                this.draft.name = sources.map(sourceLabel).join(" + ");
            button.setDisabled(true);
            try {
                await this.commit(this.draft);
                this.close();
            }
            catch {
                button.setDisabled(false);
                new Notice(t("common.failed"));
            }
          });
        });
    }
    onClose(): void { this.suggests.forEach(suggest => suggest.close()); this.contentEl.empty(); }
}

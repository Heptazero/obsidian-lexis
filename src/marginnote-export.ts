import { Notice, type Plugin } from "obsidian";
import type { LexisEntry, LexisSettings } from "./types";
import type { TranslationVars } from "./i18n";
import { buildMarginNoteDictionary, marginNoteExportPath } from "./marginnote-export-data";
import { parseMarginNoteDictionary } from "./marginnote-protocol";
import { inMarginNoteScope } from "./marginnote-scope";
import { resolveDictionaries } from "./dictionary-sources";

interface ExportHost extends Plugin {
  settings: LexisSettings;
  index: Map<string, LexisEntry>;
  t(key: string, vars?: TranslationVars): string;
  rebuildIndex(notify: boolean): Promise<unknown>;
  colorForEntry?(entry: LexisEntry): string;
}

export class MarginNoteExport {
  private timer = 0;
  private writing: Promise<number> = Promise.resolve(0);
  private stopped = false;

  constructor(private host: ExportHost) {
    host.addCommand({
      id: "export-marginnote-dictionary", name: host.t("mn.exportCommand"),
      callback: async () => {
        try {
          await host.rebuildIndex(false);
          const count = await this.export();
          new Notice(host.t("mn.exported", { count, path: marginNoteExportPath(host.settings.marginNoteExportFolder) }));
        } catch (error) { this.report(error); }
      },
    });
    // Body-only edits need an export even when the vocabulary index is unchanged.
    host.registerEvent(host.app.vault.on("modify", (file) => {
      if (!host.settings.marginNoteAutoExport) return;
      if ([...host.index.values()].some((entry) => entry.file.path === file.path)) this.schedule();
    }));
    host.register(() => { this.stopped = true; window.clearTimeout(this.timer); });
  }

  schedule(): void {
    window.clearTimeout(this.timer);
    if (!this.host.settings.marginNoteAutoExport || this.stopped) return;
    this.timer = window.setTimeout(() => { void this.export().catch((error: unknown) => this.report(error)); }, 1500);
  }

  export(): Promise<number> {
    const run = this.writing.catch(() => 0).then(() => this.write());
    this.writing = run;
    return run;
  }

  private async write(): Promise<number> {
    if (this.stopped) return 0;
    const path = marginNoteExportPath(this.host.settings.marginNoteExportFolder);
    const excluded = new Set((this.host.settings.excludeTags || "").split(/[,，;；\s]+/).map((tag) => tag.replace(/^#/, "").toLowerCase()).filter(Boolean));
    const files = [...new Map([...this.host.index.values()].map(entry=>[entry.file.path,entry.file])).values()];
    const tagsByPath = new Map([...this.host.index.values()].map(entry=>[entry.file.path,entry.tags || new Set<string>()]));
    const membership = resolveDictionaries(this.host.app,this.host.settings.dicts || [],file=>tagsByPath.get(file.path),files);
    const dictionary = await buildMarginNoteDictionary(this.host.app.vault.getName(), this.host.index,
      (entry) => this.host.app.vault.cachedRead(entry.file), {
        include: (entry) => inMarginNoteScope(entry, this.host.settings.marginNoteSources, membership.paths)
          && ![...(entry.tags || [])].some((tag) => excluded.has(tag.toLowerCase()))
          && !entry.archived && !entry.retired,
        color: (entry) => this.host.colorForEntry?.(entry) || "",
      });
    if (this.stopped) return 0;
    const adapter = this.host.app.vault.adapter;
    if (await adapter.exists(path)) {
      // Refuse unrelated files; the export command owns only this format.
      const previous = parseMarginNoteDictionary(await adapter.read(path));
      if (previous.source.id !== dictionary.source.id) throw new Error(this.host.t("mn.otherSource"));
      if (previous.revision === dictionary.revision) return dictionary.entries.length;
    }
    const parts = path.split("/").slice(0, -1);
    for (let end = 1; end <= parts.length; end++) {
      const folder = parts.slice(0, end).join("/");
      if (!await adapter.exists(folder)) await adapter.mkdir(folder);
    }
    await adapter.write(path, JSON.stringify(dictionary, null, 2) + "\n");
    return dictionary.entries.length;
  }

  private report(error: unknown): void {
    new Notice(this.host.t("mn.exportFailed", { error: error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error" }));
  }
}

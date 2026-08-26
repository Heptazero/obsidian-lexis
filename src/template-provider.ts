"use strict";

import type { App, TFile as TFileInstance } from "obsidian";
import type { LexisSettings } from "./types";

type ContentTransform = (content: string) => string;

interface TemplaterFolderRule {
  folder?: string;
  template?: string;
}

interface TemplaterPlugin {
  settings?: {
    trigger_on_file_creation_mode?: string;
    folder_templates?: TemplaterFolderRule[];
  };
  templater?: {
    write_template_to_file?: (template: TFileInstance, destination: TFileInstance) => Promise<void>;
  };
}

interface PluginRegistry {
  getPlugin(id: string): TemplaterPlugin | null;
}

type AppWithPluginRegistry = App & { plugins?: PluginRegistry };

interface TemplateProviderDependencies {
  app: App;
  TFile: typeof import("obsidian").TFile;
  getSettings: () => LexisSettings;
  normalizeFolder: (folder: string) => string;
  readTemplatePath: (path: string) => Promise<string | null>;
}

interface CreateEntryOptions {
  path: string;
  folder: string;
  fallbackContent: string;
  transform?: ContentTransform;
}

function createTemplateProvider({ app, TFile, getSettings, normalizeFolder, readTemplatePath }: TemplateProviderDependencies) {
  const lexisPathFor = (folder: string): string => {
    const settings = getSettings();
    const normalized = normalizeFolder(folder);
    const row = (settings.dicts || []).find((item) => item && normalizeFolder(item.folder) === normalized);
    return (row ? (row.template || "") : (settings.newWordTemplate || "")).trim();
  };

  const templaterPlugin = (): TemplaterPlugin | null => (app as AppWithPluginRegistry).plugins?.getPlugin("templater-obsidian") ?? null;
  const templaterTemplateFor = (folder: string) => {
    const plugin = templaterPlugin();
    if (!plugin?.templater?.write_template_to_file || plugin.settings?.trigger_on_file_creation_mode !== "folder") return null;
    const rules = Array.isArray(plugin.settings.folder_templates) ? plugin.settings.folder_templates : [];
    let current = normalizeFolder(folder);
    while (current) {
      const rule = rules.find((item) => normalizeFolder(item?.folder) === current && item?.template);
      if (rule) return { plugin, path: rule.template, folder: current };
      const slash = current.lastIndexOf("/");
      current = slash < 0 ? "" : current.slice(0, slash);
    }
    return null;
  };

  const readLexis = (folder: string) => readTemplatePath(lexisPathFor(folder));

  const create = async ({ path, folder, fallbackContent, transform = (content: string) => content }: CreateEntryOptions): Promise<TFileInstance> => {
    const match = templaterTemplateFor(folder);
    if (!match) return app.vault.create(path, transform(fallbackContent));
    const templateFile = app.vault.getAbstractFileByPath(match.path);
    if (!(templateFile instanceof TFile)) return app.vault.create(path, transform(fallbackContent));
    const file = await app.vault.create(path, "");
    await match.plugin.templater.write_template_to_file(templateFile, file);
    if (app.vault.process) await app.vault.process(file, transform);
    else await app.vault.modify(file, transform(await app.vault.cachedRead(file)));
    return file;
  };

  return { create, lexisPathFor, readLexis, templaterTemplateFor };
}

export { createTemplateProvider };

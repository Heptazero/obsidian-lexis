"use strict";

function createTemplateProvider({ app, TFile, getSettings, normalizeFolder, readTemplatePath }) {
  const lexisPathFor = (folder) => {
    const settings = getSettings();
    const normalized = normalizeFolder(folder);
    const row = (settings.dicts || []).find((item) => item && normalizeFolder(item.folder) === normalized);
    return (row ? (row.template || "") : (settings.newWordTemplate || "")).trim();
  };

  const templaterPlugin = () => app.plugins?.getPlugin?.("templater-obsidian") || null;
  const templaterTemplateFor = (folder) => {
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

  const readLexis = (folder) => readTemplatePath(lexisPathFor(folder));

  const create = async ({ path, folder, fallbackContent, transform = (content) => content }) => {
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

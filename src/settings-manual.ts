import { Notice, setIcon, type Component, type MarkdownPostProcessorContext } from "obsidian";
import { createManualPreview, type ManualRuntime } from "./settings-manual-preview";
export type { ManualRuntime } from "./settings-manual-preview";

const examples = [
  { title: "manual.complete", fence: "lexis", source: "" },
  { title: "manual.curve", fence: "lexis", source: "curve" },
  { title: "manual.relations", fence: "rel", source: "" },
  { title: "manual.occurrences", fence: "lexis", source: "occ" },
  { title: "manual.derived", fence: "lexis", source: "derived" },
  { title: "manual.home", fence: "lexis-home", source: "" },
  { title: "manual.plan", fence: "lexis-home", source: "" },
  { title: "manual.heatmap", fence: "lexis-heatmap", source: "" },
] as const;
const fence = (name: string, source: string) => `\`\`\`${name}\n${source}${source ? "\n" : ""}\`\`\``;

/** Lazy examples call the production renderers with isolated data and owned lifecycle. */
export function renderSettingsManual(container: HTMLElement, host: ManualRuntime, component: Component): void {
  const t = host.t.bind(host);
  container.createEl("p", { cls: "setting-item-description", text: t("manual.description") });
  let active = true, rendered = false;
  component.register(() => { active = false; });
  const context: MarkdownPostProcessorContext = {
    sourcePath: "", docId: "lexis-settings-demo", frontmatter: null,
    addChild: (child) => { if (active) component.addChild(child); else child.unload(); },
    getSectionInfo: () => null,
  };
  const section = container.parentElement as HTMLDetailsElement;
  const render = async () => {
    if (rendered || !section.open || !active) return;
    rendered = true;
    let demo: ReturnType<typeof createManualPreview>;
    try { demo = createManualPreview(host); }
    catch (error) {
      console.warn("[Lexis] Cannot initialize syntax examples", error);
      container.createEl("p", { cls: "setting-item-description", text: t("manual.failed") });
      return;
    }
    const { preview, sourcePath, relation, relationMarkdown } = demo;
    context.sourcePath = sourcePath;
    for (const example of examples) {
      if (!active) return;
      const block = container.createDiv({ cls: "lexis-manual-example" });
      block.setAttribute("data-manual-example", example.title);
      const header = block.createDiv({ cls: "lexis-manual-heading" });
      header.createEl("h4", { text: t(example.title) });
      const source = example.fence === "rel" ? t("manual.relationType") : example.title === "manual.plan" ? `plan: ${t("manual.examplePlan")}` : example.source;
      const code = fence(example.fence, source);
      const copy = header.createEl("button", { attr: { type: "button", title: t("manual.copy"), "aria-label": t("manual.copy") } });
      setIcon(copy, "copy");
      component.registerDomEvent(copy, "click", () => { void navigator.clipboard.writeText(code).then(() => new Notice(t("manual.copied"))).catch(() => new Notice(t("manual.copyFailed"))); });
      if (example.fence === "rel") {
        block.createEl("pre").createEl("code", { text: fence("rel", t("manual.relationPlaceholder")) });
        block.createEl("p", { cls: "setting-item-description", text: t("manual.relationVariable", { example: relation.type }) });
        block.createEl("p", { cls: "setting-item-description", text: t("manual.relationFlow", { from: relation.sourceFile.name, to: relation.targetFile.name }) });
      }
      if (example.title === "manual.derived") block.createEl("p", { cls: "setting-item-description", text: t("manual.backlinksDescription") });
      const file = ["lexis", "rel"].includes(example.fence) ? "warm.md" : t("manual.exampleHomeFile");
      const notes = [{ file, path: sourcePath, markdown: code, source: example.fence === "rel" ? `rel ${source}` : source }];
      if (example.fence === "rel" || example.title === "manual.derived") notes.unshift({
        file: relation.sourceFile.name, path: relation.sourceFile.path,
        markdown: `${relationMarkdown}\n\n${fence("lexis", "rel")}`, source: "rel",
      });
      for (const note of notes) {
        if (!active) return;
        const pair = block.createDiv({ cls: "lexis-manual-pair" });
        pair.setAttribute("data-manual-file", note.file);
        const input = pair.createDiv({ cls: "lexis-manual-input" });
        input.createDiv({ cls: "lexis-manual-label", text: t("manual.writing") });
        input.createDiv({ cls: "lexis-manual-file", text: example.title === "manual.complete" || example.title === "manual.curve" ? t("manual.reviewedFile", { file: note.file }) : note.file });
        input.createEl("pre").createEl("code", { text: note.markdown });
        const result = pair.createDiv({ cls: "lexis-manual-result" });
        result.createDiv({ cls: "lexis-manual-label", text: t("manual.result") });
        const output = result.createDiv({ cls: "lexis-manual-output" });
        // Preview controls cannot navigate, save, start review or mutate data.
        output.setAttribute("inert", "");
        try {
          if (example.fence === "lexis-heatmap") preview.renderHeatmap(output);
          else if (example.fence === "lexis-home") preview.renderHomeBlock(output, note.source, { ...context, sourcePath: note.path });
          else await preview.renderLexisBlock(output, { ...context, sourcePath: note.path }, note.source);
          for (const details of output.querySelectorAll<HTMLDetailsElement>("details")) details.open = true;
        } catch { if (active) output.setText(t("manual.failed")); }
      }
    }
  };
  component.registerDomEvent(section, "toggle", () => { void render(); });
  void render();
}

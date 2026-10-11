import { Notice, setIcon, type App, type Component, type TFile } from "obsidian";
import { NoteEditConflict, NoteEditSession, splitEditableNote } from "./note-edit-session";
import { LexisQuickEditModal } from "./quick-edit-modal";
import { activePopoverEditors as editors, finishPopoverEdit } from "./popover-edit-lifecycle";

type Translate = (key: string, vars?: Record<string, string | number | boolean>) => string;
const errorMessage = (error: unknown): string => error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error";

interface PopoverEditorOptions {
  app: App;
  file: TFile;
  popover: HTMLElement;
  corner: HTMLElement;
  content: HTMLElement;
  component: Component;
  mode(): "inline" | "window";
  t: Translate;
  render: () => Promise<void>;
}

export function attachPopoverEditor(options: PopoverEditorOptions): void {
  const { app, file, popover, corner, content, component, t, render } = options;
  const button = corner.createEl("button", { cls: "lexis-popover-action", attr: { type: "button" } });
  corner.prepend(button);
  const resetButton = () => {
    setIcon(button, "pencil");
    button.setAttribute("title", t("popover.editEntry"));
    button.setAttribute("aria-label", t("popover.editEntry"));
  };
  resetButton();
  button.addEventListener("click", (event) => { void (async () => {
    event.preventDefault(); event.stopPropagation();
    if (editors.has(popover)) { await finishPopoverEdit(popover); return; }
    if (options.mode() === "window") {
      new LexisQuickEditModal(app, file, t, async () => { if (popover.isConnected) await render(); }).open();
      return;
    }
    popover.dataset.lexisEditing = "1";
    button.disabled = true;
    const load = app.vault.read(file);
    const loadingClose = async (): Promise<boolean> => {
      try { await load; } catch { return true; }
      return editors.get(popover) === loadingClose ? false : finishPopoverEdit(popover);
    };
    editors.set(popover, loadingClose);
    try {
      const parts = splitEditableNote(await load);
      if (!popover.isConnected) { editors.delete(popover); delete popover.dataset.lexisEditing; return; }
      const session = new NoteEditSession(parts.body, (transform) => app.vault.process(file, transform));
      content.empty();
      const textarea = content.createEl("textarea", { cls: "lexis-popover-editor", attr: { "aria-label": t("popover.editEntry") } });
      textarea.value = parts.body;
      const status = content.createDiv({ cls: "lexis-popover-edit-status", text: t("popover.autosave"), attr: { "role": "status" } });
      const hostWindow = popover.ownerDocument.defaultView || window;
      let timer = 0;
      let composing = false;
      let finishing: Promise<boolean> | null = null;
      const resize = () => { textarea.setCssStyles({ height: "auto" }); textarea.setCssStyles({ height: `${Math.max(100, textarea.scrollHeight)}px` }); };
      const save = async (): Promise<boolean> => {
        hostWindow.clearTimeout(timer);
        if (composing) return false;
        status.setText(t("popover.saving"));
        try { await session.flush(); status.setText(t("popover.saved")); return true; }
        catch (error) {
          status.setText(error instanceof NoteEditConflict ? t("popover.editConflict") : t("popover.readFailed", { error: errorMessage(error) }));
          return false;
        }
      };
      const finish = (): Promise<boolean> => {
        if (finishing === null) finishing = (async () => {
          if (!await save()) return false;
          // Do not tear down a draft typed while the last write was finishing.
          if (session.dirty || composing) return false;
          editors.delete(popover);
          delete popover.dataset.lexisEditing;
          resetButton();
          if (popover.isConnected) {
            try { await render(); }
            catch (error) { content.setText(t("popover.readFailed", { error: errorMessage(error) })); }
          }
          return true;
        })().finally(() => { finishing = null; });
        return finishing;
      };
      editors.set(popover, finish);
      const changed = () => {
        session.update(textarea.value); resize();
        hostWindow.clearTimeout(timer);
        if (!composing) timer = hostWindow.setTimeout(() => { void save(); }, 600);
      };
      textarea.addEventListener("input", changed);
      textarea.addEventListener("compositionstart", () => { composing = true; hostWindow.clearTimeout(timer); });
      textarea.addEventListener("compositionend", () => { composing = false; changed(); });
      textarea.addEventListener("blur", () => { void save(); });
      textarea.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && !event.isComposing) { event.preventDefault(); void finish(); }
      });
      component.register(() => { hostWindow.clearTimeout(timer); void save(); });
      setIcon(button, "check");
      button.setAttribute("title", t("common.done"));
      button.setAttribute("aria-label", t("common.done"));
      resize(); textarea.focus();
    } catch (error) {
      editors.delete(popover);
      delete popover.dataset.lexisEditing;
      new Notice(t("popover.readFailed", { error: errorMessage(error) }));
    } finally { button.disabled = false; }
  })(); });
}

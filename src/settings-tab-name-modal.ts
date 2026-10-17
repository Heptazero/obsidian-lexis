import { Modal, Setting, type App } from "obsidian";

export type SettingsTabNameResult = string | { delete: true } | null;

/** Creation and maintenance stay in one small modal; reordering stays on the tab strip. */
export function askSettingsTabName(app: App, title: string, current: string, done: string, deleteLabel?: string, deleteHint?: string): Promise<SettingsTabNameResult> {
  return new Promise((resolve) => {
    class NameModal extends Modal {
      private result: SettingsTabNameResult = null;
      onOpen(): void {
        this.setTitle(title);
        let draft = current;
        const commit = () => { if (draft.trim()) { this.result = draft.trim(); this.close(); } };
        new Setting(this.contentEl).addText((input) => {
          input.setValue(current).onChange((value) => { draft = value; });
          input.inputEl.setAttribute("aria-label", title);
          input.inputEl.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); commit(); } });
          window.setTimeout(() => { input.inputEl.focus(); input.inputEl.select(); }, 0);
        }).addButton((button) => button.setButtonText(done).setCta().onClick(commit));
        if (deleteLabel) new Setting(this.contentEl).setDesc(deleteHint || "")
          .addButton(button => { button.buttonEl.addClass("mod-warning"); button.setButtonText(deleteLabel).onClick(() => { this.result = { delete: true }; this.close(); }); });
      }
      onClose(): void { this.contentEl.empty(); resolve(this.result); }
    }
    new NameModal(app).open();
  });
}

import { Modal, Notice, setIcon, type Component } from "obsidian";
import { MaintenanceError, PluginMaintenance, type MaintenanceHost, type PluginUpdate } from "./plugin-maintenance";

interface Host extends MaintenanceHost { t(key: string, vars?: Record<string, string>): string }

function confirmUpdate(host: Host, update: PluginUpdate, owner: Component): Promise<boolean> {
  return new Promise((resolve) => {
    class UpdateModal extends Modal {
      private accepted = false;
      onOpen(): void {
        this.setTitle(host.t("maintenance.available", { version: update.version }));
        this.contentEl.createEl("p", { text: `${host.manifest.version} → ${update.version}` });
        this.contentEl.createEl("p", { text: host.t("maintenance.confirmDescription") });
        const actions = this.contentEl.createDiv({ cls: "lexis-maintenance-confirm-actions" });
        actions.createEl("button", { text: host.t("maintenance.cancel") }).onclick = () => this.close();
        actions.createEl("button", { cls: "mod-cta", text: host.t("maintenance.install") }).onclick = () => { this.accepted = true; this.close(); };
      }
      onClose(): void { this.contentEl.empty(); resolve(this.accepted); }
    }
    const modal = new UpdateModal(host.app);
    owner.register(() => modal.close()); modal.open();
  });
}

/** Keep maintenance controls outside sortable tabs and never check merely by opening settings. */
export function renderPluginMaintenance(container: HTMLElement, host: Host, owner: Component): void {
  const tools = container.createDiv({ cls: "lexis-settings-maintenance" });
  const service = new PluginMaintenance(host);
  let busy = false, active = true, installing = false;
  let status: HTMLElement;
  const setStatus = (key: string, vars: Record<string,string> = {}, detail = "") => {
    if (!active) return;
    status.setText(host.t(key,vars)); status.title = detail;
  };
  owner.register(() => { active = false; });
  const buttons: HTMLButtonElement[] = [];
  const action = (name: string, icon: string, run: () => Promise<void>) => {
    const button = tools.createEl("button", { cls: "clickable-icon", attr: { type: "button", title: host.t(name), "aria-label": host.t(name), "data-maintenance-action": name } });
    setIcon(button, icon); buttons.push(button);
    button.onclick = () => { void (async () => {
      if (busy || !active) return;
      busy = true; buttons.forEach((item) => { item.disabled = true; });
      button.setAttribute("aria-busy", "true"); setIcon(button, "loader-circle");
      try { await run(); }
      catch (error) {
        if (!active && name === "maintenance.check" && !installing) return;
        const detail = error instanceof MaintenanceError ? host.t(error.key) : error instanceof Error ? error.message : host.t("common.failed");
        if (name === "maintenance.check") setStatus(installing ? "maintenance.installFailed" : "maintenance.checkFailed",{},detail);
        new Notice(host.t("maintenance.failed", { error: detail }));
      }
      finally { busy = false; installing = false; buttons.forEach((item) => { item.disabled = false; }); button.removeAttribute("aria-busy"); setIcon(button, icon); }
    })(); };
  };
  action("maintenance.reload", "rotate-cw", async () => { await service.reload(); new Notice(host.t("maintenance.reloaded")); });
  action("maintenance.check", "download", async () => {
    setStatus("maintenance.checking");
    const update = await service.check();
    if (!active) return;
    if (!update) { setStatus("maintenance.noUpdate",{version:host.manifest.version}); return; }
    setStatus("maintenance.pendingUpdate",{version:update.version});
    if (await confirmUpdate(host, update, owner)) {
      if (!active) return;
      setStatus("maintenance.installing");
      installing = true;
      await service.install(update);
      setStatus("maintenance.updated",{version:update.version});
      new Notice(host.t("maintenance.updated", { version: update.version }));
    }
  });
  status = tools.createSpan({cls:"lexis-maintenance-status",attr:{role:"status","aria-live":"polite","aria-atomic":"true"}});
  setStatus("maintenance.unchecked",{version:host.manifest.version});
}

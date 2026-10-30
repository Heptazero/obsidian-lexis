import * as obsidian from "obsidian";
import { renderStorageSettings } from "../../src/settings-storage-section";
import { DEFAULT_SETTINGS } from "../../src/default-settings";
import { createI18n } from "../../src/i18n";
import { annotateSettingControlLayouts } from "../../src/settings-control-layout";

export async function checkStorageSettings(check: (value: unknown, message: string) => void): Promise<void> {
  const root = document.body.createDiv({ cls: "lexis-settings-root" });
  const settings = { ...DEFAULT_SETTINGS, dataFolder: "99_assets/plugin-data/lexis" };
  let moves = 0, saves = 0;
  const plugin = { settings, manifest: { id: "lexis" }, setDataFolder: async (value: string) => { settings.dataFolder = value; moves++; } };
  const app = { vault: { configDir: ".obsidian" } };
  const t = createI18n(() => "zh").t;
  renderStorageSettings.call({ app, plugin } as any, {
    obsidian, Setting: obsidian.Setting, Notice: obsidian.Notice,
    PathSuggest: class {} as any, topSection: () => root.createDiv(), t,
    save: async () => { saves++; }, folders: [], hasSuggest: false, defaultEncounterFolder: "Lexis-data",
  });
  annotateSettingControlLayouts(root);
  const [pathRow, , retentionRow] = [...root.querySelectorAll<HTMLElement>(".setting-item")];
  const path = pathRow.querySelector<HTMLInputElement>("input")!, days = retentionRow.querySelector<HTMLInputElement>("input")!;
  check(!settings.reviewRetentionConfirmed && retentionRow.textContent?.includes("自动清理尚未启用"), "existing-user retention remains pending with a visible cleanup estimate");
  check(!retentionRow.querySelector<HTMLButtonElement>('[data-icon="check"]')!.disabled, "pending retention can be confirmed without changing the proposed 90-day value");
  const input = (element: HTMLInputElement, value: string) => { element.value = value; element.dispatchEvent(new Event("input")); };
  input(path, "Other-data"); path.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", cancelable: true }));
  check(moves === 0, "editing a data folder or pressing Enter never starts a move");
  pathRow.querySelector<HTMLButtonElement>('[data-icon="undo"]')!.click();
  check(path.value === settings.dataFolder, "undo restores an unconfirmed data folder draft");
  input(days, "0");
  check(retentionRow.querySelector<HTMLButtonElement>('[data-icon="check"]')!.disabled, "invalid retention cannot be applied");
  input(days, "30");
  check(settings.reviewEventsRetentionDays === 90 && saves === 0, "retention remains a draft before explicit confirmation");
  retentionRow.querySelector<HTMLButtonElement>('[data-icon="check"]')!.click();
  await new Promise(resolve => setTimeout(resolve, 0));
  check(settings.reviewEventsRetentionDays === 30 && settings.reviewRetentionConfirmed && saves === 1, "confirming retention saves exactly once and explicitly enables age cleanup");
  check(root.scrollWidth <= root.clientWidth + 1 && document.documentElement.scrollWidth <= innerWidth,
    "storage settings fit narrow and wide viewports without horizontal overflow");
  root.remove();
}

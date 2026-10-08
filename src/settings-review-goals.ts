import { Setting } from "obsidian";
import type { TranslationVars } from "./i18n";
import type { LexisSettings } from "./types";

interface GoalSettingsHost {
  settings: LexisSettings;
  t(key: string, vars?: TranslationVars): string;
  saveSettings(): Promise<void>;
}

export function renderReviewGoalSettings(parent: HTMLElement, plugin: GoalSettingsHost): void {
  new Setting(parent).setName(plugin.t("dashboard.goalSettings")).setHeading().setDesc(plugin.t("dashboard.goalHint"));
  for (const [field, label, minimum] of [["reviewMinimumGoal", "dashboard.minimum", 0], ["reviewDailyGoal", "dashboard.goal", 1]] as const) {
    new Setting(parent).setName(plugin.t(label)).addText((input) => {
      input.inputEl.type = "number";
      input.inputEl.min = String(minimum);
      input.inputEl.max = "10000";
      input.setValue(String(plugin.settings[field])).onChange(async (value) => {
        if (!value.trim()) return;
        const count = Number(value);
        if (!Number.isInteger(count) || count < minimum || count > 10000) return;
        plugin.settings[field] = count;
        await plugin.saveSettings();
      });
    });
  }
  parent.createDiv({ cls: "lexis-dim", text: plugin.t("dashboard.countHint") });
}

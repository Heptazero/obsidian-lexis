export const SETTINGS_TABS = [
  { id: "general", label: "settings.tabGeneral", sections: ["general", "data"] },
  { id: "vocabulary", label: "settings.tabVocabulary", sections: ["dictionary", "inline", "vocabulary-rules", "templates"] },
  { id: "reading", label: "settings.tabStyle", sections: ["highlight", "popover", "occurrences"] },
  { id: "review", label: "settings.tabReview", sections: ["review"] },
  { id: "integrations", label: "settings.tabIntegrations", sections: ["bridge", "marginnote"] },
  { id: "other", label: "settings.tabOther", sections: ["mobile", "manual"] },
] as const;

export interface SettingsTabGroup { id: string; name: string }

export function settingsTabGroups(custom: SettingsTabGroup[] = [], names: Record<string, string> = {}, t: (key: string) => string): SettingsTabGroup[] {
  const groups: SettingsTabGroup[] = SETTINGS_TABS.map((tab) => ({ id: tab.id, name: names[tab.id]?.trim() || t(tab.label) }));
  for (const group of custom) if (group.id.startsWith("custom-") && group.name.trim() && !groups.some((item) => item.id === group.id)) groups.push({ id: group.id, name: group.name.trim() });
  return groups;
}

export function settingsTabForSection(key: string, assignments: Record<string, string>, groups: readonly { id: string }[] = SETTINGS_TABS): string {
  const saved = assignments[key];
  if (groups.some((tab) => tab.id === saved)) return saved;
  return SETTINGS_TABS.find((tab) => (tab.sections as readonly string[]).includes(key))?.id || "general";
}

export function reorderVisibleSections(order: readonly string[], visible: readonly string[]): string[] {
  const keys = new Set(visible);
  let index = 0;
  return order.map((key) => keys.has(key) ? visible[index++] : key);
}

import { fuzzyScore } from "./alias-search";
import { setSettingsSectionOpen } from "./settings-section";

export function matchesSettingsSearch(text: string, query: string): boolean {
  return query.trim().split(/\s+/u).every((part) => Number.isFinite(fuzzyScore(part, text)));
}

interface SearchOptions {
  container: HTMLElement;
  tabs: HTMLElement;
  panels: Map<string, HTMLElement>;
  sections: Map<string, HTMLElement>;
  activeTab(this: void): string;
  t(this: void, key: string): string;
  setIcon(this: void, element: HTMLElement, icon: string): void;
  onRefresh?(this: void): void;
}

/** Search reuses live controls; expansion is temporary, not a settings edit. */
export function createSettingsSearch({ container, tabs, panels, sections, activeTab, t, setIcon, onRefresh }: SearchOptions) {
  const search = container.createDiv({ cls: "lexis-settings-search" });
  tabs.before(search);
  setIcon(search.createSpan({ cls: "lexis-settings-search-icon" }), "search");
  const input = search.createEl("input", { type: "search", attr: { placeholder: t("settings.search"), "aria-label": t("settings.search") } });
  const clear = search.createEl("button", { cls: "lexis-settings-search-clear", attr: { type: "button", "aria-label": t("settings.clearSearch") } });
  setIcon(clear, "x");
  const empty = container.createDiv({ cls: "lexis-settings-search-empty", text: t("settings.noSearchResults"), attr: { role: "status" } });
  const folds = new Map<HTMLDetailsElement, boolean>();
  const refresh = () => {
    const query = input.value.trim();
    clear.hidden = !query; tabs.hidden = !!query;
    container.classList.toggle("is-searching", !!query);
    for (const handle of container.querySelectorAll<HTMLButtonElement>(".lexis-six-dots")) handle.disabled = !!query;
    if (!query) { for (const [section, open] of folds) setSettingsSectionOpen(section, open); folds.clear(); }
    let count = 0;
    for (const [id, panel] of panels) {
      const label = panel.querySelector<HTMLElement>(".lexis-settings-search-group-label"); label.hidden = !query;
      let matched = false;
      for (const section of sections.values()) {
        if (section.parentElement !== panel) continue;
        const found = !query || matchesSettingsSearch(`${label.textContent} ${section.textContent}`, query);
        section.hidden = !found;
        if (!found) continue;
        matched = true; count++;
        if (query) for (const fold of [section as HTMLDetailsElement, ...section.querySelectorAll<HTMLDetailsElement>("details.lexis-settings-group")]) {
          if (!folds.has(fold)) folds.set(fold, fold.open);
          setSettingsSectionOpen(fold, true);
        }
      }
      panel.hidden = query ? !matched : id !== activeTab(); panel.setAttribute("role", query ? "region" : "tabpanel");
    }
    empty.hidden = !query || count > 0;
    onRefresh?.();
  };
  const clearSearch = () => { input.value = ""; refresh(); input.focus(); };
  input.addEventListener("input", refresh);
  input.addEventListener("keydown", (event) => { if (event.key === "Escape" && input.value) { event.preventDefault(); clearSearch(); } });
  clear.addEventListener("click", clearSearch);
  refresh(); return { refresh };
}

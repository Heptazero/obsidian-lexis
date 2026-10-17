import { orderedSectionKeys } from "./settings-section-order";
import { reorderVisibleSections, settingsTabForSection, settingsTabGroups, type SettingsTabGroup } from "./settings-navigation-model";
import { createSettingsSortable } from "./settings-sortable";
import { orderSettingsGroups } from "./settings-group-order";
import { createSettingsSearch } from "./settings-search";
import type { SettingsTabNameResult } from "./settings-tab-name-modal";
export { SETTINGS_TABS, reorderVisibleSections } from "./settings-navigation-model";

interface NavigationOptions {
  activeTab: string;
  sectionOrder: unknown;
  tabOrder: unknown;
  assignments: Record<string, string>;
  groupOrder: Record<string, string[]>;
  t(this: void, key: string, vars?: Record<string, string>): string;
  onTabChange(id: string): void;
  onOrderChange(order: string[]): void;
  onTabOrderChange(order: string[]): void;
  onAssignmentsChange(assignments: Record<string, string>): void;
  onGroupOrderChange(this: void, orders: Record<string, string[]>): void;
  setIcon(this: void, element: HTMLElement, icon: string): void;
  tabNames?: Record<string, string>;
  customTabs?: SettingsTabGroup[];
  requestTabName?(current: string, deletable?: boolean): Promise<SettingsTabNameResult>;
  onGroupsChange?(names: Record<string, string>, custom: SettingsTabGroup[]): void;
}
let navigationSequence = 0;

/** Keep live controls while organizing and searching all settings. */
export function createSettingsNavigation(container: HTMLElement, sections: Map<string, HTMLElement>, options: NavigationOptions): void {
  const prefix = `lexis-settings-navigation-${++navigationSequence}`;
  const header = container.createDiv({ cls: "lexis-settings-navigation-header" }); container.before(header);
  const tabs = header.createDiv({ cls: "lexis-settings-tabs", attr: { role: "tablist", "aria-label": options.t("settings.title") } });
  let order = orderedSectionKeys([...sections.keys()], options.sectionOrder);
  let names = { ...options.tabNames };
  let custom = [...(options.customTabs || [])];
  const groups = settingsTabGroups(custom, names, options.t);
  let tabOrder = orderedSectionKeys(groups.map((tab) => tab.id), options.tabOrder);
  let assignments = { ...options.assignments };
  let active = tabOrder.includes(options.activeTab) ? options.activeTab : "general";
  const buttons = new Map<string, HTMLButtonElement>(), panels = new Map<string, HTMLElement>();
  let search: ReturnType<typeof createSettingsSearch>;
  let refreshFoldAction = () => {};
  const activate = (id: string, persist = true) => {
    const changed = active !== id; active = id;
    for (const [key, button] of buttons) { button.setAttribute("aria-selected", String(key === id)); button.tabIndex = key === id ? 0 : -1; button.parentElement.classList.toggle("is-active", key === id); }
    search?.refresh();
    const current = buttons.get(id).parentElement.getBoundingClientRect(), viewport = tabs.getBoundingClientRect();
    if (current.left < viewport.left) tabs.scrollLeft -= viewport.left - current.left;
    else if (current.right > viewport.right) tabs.scrollLeft += current.right - viewport.right;
    if (changed && persist) options.onTabChange(id);
  };
  const tabFor = (key: string) => settingsTabForSection(key, assignments, groups);
  const placeSections = () => { for (const key of order) panels.get(tabFor(key)).appendChild(sections.get(key)); };
  const addTab = tabs.createEl("button", { cls: "lexis-settings-add-tab", attr: { type: "button", "aria-label": options.t("settings.addTab"), title: options.t("settings.addTab") } });
  options.setIcon(addTab, "plus");
  const tabSort = createSettingsSortable({ container: tabs, axis: "x", handleless: true, endBoundary: addTab, label: options.t("settings.reorder"), onOrder: (ids) => { tabOrder = ids; options.onTabOrderChange(ids); } });
  const addGroup = ({ id, name }: SettingsTabGroup) => {
    const wrapper = tabs.createDiv({ cls: "lexis-settings-tab-wrapper", attr: { role: "presentation" } });
    tabs.insertBefore(wrapper, addTab);
    const button = wrapper.createEl("button", { cls: "lexis-settings-tab", text: name, attr: { type: "button", role: "tab" } });
    button.id = `${prefix}-${id}`; tabSort.attach(wrapper, button, id);
    const panel = container.createDiv({ cls: "lexis-settings-tabpanel lexis-settings-sections" });
    panel.id = `${button.id}-panel`; panel.setAttribute("role", "tabpanel"); panel.setAttribute("aria-labelledby", button.id);
    panel.createDiv({ cls: "lexis-settings-search-group-label", text: name }).hidden = true;
    button.setAttribute("aria-controls", panel.id); buttons.set(id, button); panels.set(id, panel);
    button.addEventListener("click", () => activate(id));
    button.addEventListener("keydown", (event) => {
      if (event.altKey || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const index = tabOrder.indexOf(id);
      const next = event.key === "Home" ? 0 : event.key === "End" ? tabOrder.length - 1
        : (index + (event.key === "ArrowRight" ? 1 : -1) + tabOrder.length) % tabOrder.length;
      buttons.get(tabOrder[next]).focus(); activate(tabOrder[next]);
    });
  };
  for (const id of tabOrder) addGroup(groups.find((group) => group.id === id));
  placeSections();
  const sorters = new Map<string, ReturnType<typeof createSettingsSortable>>();
  const addSorter = (id: string, panel: HTMLElement) => sorters.set(id, createSettingsSortable({ container: panel, label: options.t("settings.reorderMenu"),
    onOrder: (ids) => { order = reorderVisibleSections(order, ids); options.onOrderChange(order); },
    populateMenu: (menu, key) => {
      for (const destination of groups) if (destination.id !== tabFor(key)) {
        menu.addItem((item) => item.setTitle(options.t("settings.moveToTab", { tab: destination.name })).setIcon("folder-input").onClick(() => {
          assignments = { ...assignments, [key]: destination.id }; options.onAssignmentsChange(assignments);
          const section = sections.get(key); section.querySelector(":scope > summary > .lexis-six-dots").remove();
          placeSections(); sorters.get(destination.id).attach(section, section.querySelector<HTMLElement>(":scope > summary"), key); search.refresh();
        }));
      }
    },
  }));
  for (const [id, panel] of panels) addSorter(id, panel);
  for (const [key, section] of sections) sorters.get(tabFor(key)).attach(section, section.querySelector<HTMLElement>(":scope > summary"), key);
  orderSettingsGroups(sections, options.groupOrder, options.t("settings.reorder"), options.onGroupOrderChange);
  search = createSettingsSearch({ container, tabs, panels, sections, activeTab: () => active, t: options.t, setIcon: options.setIcon, onRefresh: () => refreshFoldAction() });
  const tools = header.createDiv({ cls: "lexis-settings-tab-tools" });
  const action = (icon: string, title: string, run: () => void) => {
    const button = tools.createEl("button", { attr: { type: "button", title: options.t(title), "aria-label": options.t(title) } });
    options.setIcon(button, icon); button.addEventListener("click", run); return button;
  };
  const rename = action("pencil", "settings.renameTab", () => { void (async () => {
    const group = groups.find((group) => group.id === active);
    const result = await options.requestTabName?.(group.name, group.id.startsWith("custom-"));
    if (!result || !header.isConnected) return;
    if (typeof result !== "string") {
      const index = groups.findIndex(item => item.id === group.id);
      if (index < 0 || !group.id.startsWith("custom-")) return;
      groups.splice(index, 1); custom = custom.filter(item => item.id !== group.id); tabOrder = tabOrder.filter(id => id !== group.id);
      const nextAssignments = Object.fromEntries(Object.entries(assignments).filter(([, id]) => id !== group.id));
      assignments = nextAssignments; placeSections();
      buttons.get(group.id)?.parentElement?.remove(); panels.get(group.id)?.remove(); buttons.delete(group.id); panels.delete(group.id); sorters.delete(group.id);
      delete names[group.id]; options.onGroupsChange?.(names, custom); options.onTabOrderChange(tabOrder); options.onAssignmentsChange(assignments);
      activate(tabOrder[0] || "general"); return;
    }
    const name = result;
    group.name = name; names = { ...names, [group.id]: name };
    custom = custom.map((item) => item.id === group.id ? { ...item, name } : item);
    buttons.get(group.id).textContent = name; panels.get(group.id).querySelector(".lexis-settings-search-group-label").textContent = name;
    options.onGroupsChange?.(names, custom); search.refresh();
  })(); });
  const visibleFolds = () => [...panels.values()].filter(panel => !panel.hidden)
    .flatMap(panel => [...panel.querySelectorAll<HTMLDetailsElement>("details.lexis-settings-section, details.lexis-settings-group")])
    .filter(details => !details.closest("[hidden]"));
  const fold = action("chevrons-up-down", "settings.expandAll", () => {
    const details = visibleFolds(), open = !details.every(item => item.open);
    for (const item of details) item.open = open;
    refreshFoldAction();
  });
  fold.dataset.settingsFold = "";
  refreshFoldAction = () => {
    const details = visibleFolds(), collapse = details.length > 0 && details.every(item => item.open);
    const label = options.t(collapse ? "settings.collapseAll" : "settings.expandAll");
    options.setIcon(fold, collapse ? "chevrons-down-up" : "chevrons-up-down");
    fold.setAttribute("aria-label", label); fold.title = label; fold.disabled = !details.length;
  };
  container.addEventListener("toggle", refreshFoldAction, true);
  tools.appendChild(rename);
  addTab.addEventListener("click", () => { void (async () => {
    const result = await options.requestTabName?.(""); if (typeof result !== "string" || !result || !header.isConnected) return;
    const name = result;
    const group = { id: `custom-${crypto.randomUUID()}`, name }; custom.push(group); groups.push(group); tabOrder.push(group.id);
    addGroup(group); tabs.appendChild(addTab); addSorter(group.id, panels.get(group.id));
    options.onGroupsChange?.(names, custom); options.onTabOrderChange(tabOrder); activate(group.id);
  })(); });
  activate(active, false);
}

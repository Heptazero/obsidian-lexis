import { createSettingsNavigation, SETTINGS_TABS } from "../../src/settings-navigation";
import { createSettingsSection, setSettingsSectionOpen } from "../../src/settings-section";
import { createReorderController } from "../../src/settings-controls";

export async function checkSettingsNavigation(root: HTMLElement, marginNote: HTMLElement, check: (value: unknown, message: string) => void, foldWrites: () => number): Promise<void> {
  const initialWrites = foldWrites();
  const host = root.createDiv({ cls: "lexis-settings-navigation" });
  const sections = new Map<string, HTMLElement>();
  const tabLabels: Record<string, string> = { "settings.tabGeneral": "常规", "settings.tabVocabulary": "词库", "settings.tabStyle": "样式", "settings.tabReview": "复习", "settings.tabIntegrations": "联动", "settings.tabOther": "其他" };
  Object.assign(tabLabels, { "settings.search": "搜索所有设置", "settings.clearSearch": "清除搜索", "settings.noSearchResults": "没有匹配的设置" });
  const sectionLabels: Record<string, string> = { general: "常规", data: "数据存储", mobile: "移动端", dictionary: "词典", inline: "内联词条", highlight: "高亮", popover: "悬浮卡片", "selection-add": "划词添加", review: "复习", bridge: "浏览器与 Zotero", marginnote: "MarginNote" };
  for (const tab of SETTINGS_TABS) for (const key of tab.sections) {
    const section = key === "marginnote" ? marginNote : createSettingsSection(host, sectionLabels[key], { level: "section" }).element;
    section.dataset.lexisSectionKey = key;
    sections.set(key, section);
  }
  const general = sections.get("general")!.querySelector<HTMLElement>(".lexis-settings-section-body")!;
  const draft = general.createEl("input", { attr: { "aria-label": "Draft path" } });
  draft.value = "Pending/folder";
  const probe = general.createDiv({ cls: "lexis-rule-grid" });
  const moves: number[][] = [];
  const reorderProbe = createReorderController({ container: probe, onMove: (from, to) => { moves.push([from, to]); } });
  const first = probe.createDiv({ text: "First entry" }), second = probe.createDiv({ text: "Second entry" });
  reorderProbe.attach(first, 0); reorderProbe.attach(second, 1);
  const probeHandle = first.querySelector<HTMLButtonElement>(".lexis-six-dots")!;
  probeHandle.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", altKey: true, bubbles: true, cancelable: true }));
  probeHandle.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", altKey: true, bubbles: true, cancelable: true }));
  check(moves.map((move) => move.join(",")).join(";") === "0,1;1,0", "dictionary adapters preserve numeric move callbacks across repeated sorting");
  const selected: string[] = [], orders: string[][] = [], tabOrders: string[][] = [], assignments: Record<string, string>[] = [], groupOrders: Record<string, string[]>[] = [];
  let nextName: string | { delete: true } = "";
  const groupChanges: Array<{ names: Record<string, string>; custom: Array<{ id: string; name: string }> }> = [];
  createSettingsNavigation(host, sections, {
    activeTab: "unknown-legacy-value", sectionOrder: ["marginnote", "data"], tabOrder: [], assignments: {}, groupOrder: {},
    t: (key, vars) => key === "settings.moveToTab" ? `Move to ${vars?.tab}` : tabLabels[key] || key,
    setIcon: (element, icon) => { element.dataset.icon=icon; element.textContent = icon === "search" ? "⌕" : "×"; },
    onTabChange: (id) => selected.push(id), onOrderChange: (order) => orders.push(order),
    onTabOrderChange: (order) => tabOrders.push(order), onAssignmentsChange: (next) => assignments.push(next), onGroupOrderChange: (next) => groupOrders.push(next),
    requestTabName: async () => nextName,
    onGroupsChange: (names, custom) => groupChanges.push({ names: { ...names }, custom: [...custom] }),
  });
  const tabs = [...root.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  const panels = [...root.querySelectorAll<HTMLElement>('[role="tabpanel"]')];
  check(tabs.length === 6 && panels.length === 6, "six task-oriented tabs cover the settings");
  check(!root.querySelector(".lexis-settings-tabs .lexis-six-dots"), "tabs have no six-dot handles");
  check(panels.filter((panel) => !panel.hidden).length === 1 && tabs[0].getAttribute("aria-selected") === "true", "unknown saved tab falls back without persisting");
  check(selected.length === 0 && orders.length === 0, "opening tab navigation does not write configuration");
  check([...sections.values()].every((section) => section.tagName === "DETAILS" && !(section as HTMLDetailsElement).open), "all top-level settings are foldable and initially collapsed");
  check([...sections.values()].every((section) => getComputedStyle(section).backgroundColor === "rgba(0, 0, 0, 0)" && getComputedStyle(section).borderRadius === "8px"), "primary frames follow the showcase without background fill");
  check([...sections.values()].every((section) => section.querySelector(".lexis-settings-section-heading > .lexis-six-dots")), "all sections reuse right-side six-dot handles");
  const arrows = [...root.querySelectorAll<HTMLElement>("summary.lexis-settings-section-heading, summary.lexis-settings-group-heading")];
  check(arrows.every((heading) => {
    const arrow = getComputedStyle(heading, "::before");
    return arrow.borderInlineStartStyle === "solid" && parseFloat(arrow.borderInlineStartWidth) > 0
      && arrow.borderTopColor === "rgba(0, 0, 0, 0)" && arrow.borderBottomColor === "rgba(0, 0, 0, 0)";
  }), "every settings disclosure uses the same solid triangle");
  for (let index = 1; index < tabs.length; index++) {
    tabs[index].click();
    check(panels[index].checkVisibility() && panels.filter((panel) => !panel.hidden).length === 1, "switching exposes exactly one panel");
    check(panels[index].getAttribute("aria-labelledby") === tabs[index].id && tabs[index].getAttribute("aria-controls") === panels[index].id, "tabs and panels retain accessible ownership");
    check(document.documentElement.scrollWidth <= window.innerWidth && root.scrollWidth <= root.clientWidth + 1, "every panel fits without page-level horizontal overflow");
  }
  tabs[0].click();
  check(draft.isConnected && draft.value === "Pending/folder", "tab switches preserve unconfirmed input drafts");
  tabs[0].click(); check(selected.length === 6, "selecting the current tab does not save again");
  tabs[0].dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true, cancelable: true }));
  check(document.activeElement === tabs[5] && !panels[5].hidden, "keyboard End activates the final tab");
  tabs[5].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }));
  check(document.activeElement === tabs[0] && !panels[0].hidden, "keyboard arrows wrap and focus the same tab");
  if (window.innerWidth <= 700) check(tabs.every((button) => button.getBoundingClientRect().height >= 44), "mobile tabs have touch-sized targets");
  tabs[4].click();
  const query = root.querySelector<HTMLInputElement>('input[type="search"]')!;
  query.value = "词库导出文件夹"; query.dispatchEvent(new Event("input", { bubbles: true }));
  check(tabs[0].closest<HTMLElement>('[role="tablist"]')!.hidden && !(marginNote as HTMLDetailsElement).hidden && (marginNote as HTMLDetailsElement).open, "search finds and expands settings across all tabs");
  query.value = "no-such-setting-xyz"; query.dispatchEvent(new Event("input", { bubbles: true }));
  check(root.querySelector<HTMLElement>(".lexis-settings-search-empty")!.checkVisibility(), "unmatched global searches have a visible empty state");
  query.value = "Pending/folder"; query.dispatchEvent(new Event("input", { bubbles: true }));
  check(root.querySelector<HTMLElement>(".lexis-settings-search-empty")!.checkVisibility(), "search excludes input values and credentials");
  query.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
  await new Promise((resolve) => setTimeout(resolve, 20));
  check(foldWrites() === initialWrites, "search expansion never writes fold preferences");
  check(!(marginNote as HTMLDetailsElement).open && panels.filter((panel) => !panel.hidden).length === 1 && draft.value === "Pending/folder", "clearing search restores folds, active tab and drafts");
  const handle = sections.get("data")!.querySelector<HTMLButtonElement>("summary > .lexis-six-dots")!;
  handle.click();
  const menu = (globalThis as any).__lexisMenus.at(-1);
  menu.items.find((item: any) => item.title === "Move to 样式").click();
  check(assignments.at(-1)?.data === "reading" && sections.get("data")!.parentElement === panels[2], "six-dot menu moves a section to another tab");
  tabs[2].click();
  const movedHandle = sections.get("data")!.querySelector<HTMLButtonElement>("summary > .lexis-six-dots")!;
  movedHandle.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", altKey: true, bubbles: true, cancelable: true }));
  check(orders.length === 1 && orders[0].includes("marginnote"), "moved sections remain sortable without losing other tab order");
  const firstTabHandle = tabs[0];
  firstTabHandle.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", altKey: true, bubbles: true, cancelable: true }));
  check(tabOrders.at(-1)?.[0] === "vocabulary", "tabs retain accessible keyboard reordering without a handle");
  const beforeCancel = orders.length;
  const rect = movedHandle.getBoundingClientRect();
  movedHandle.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 5, pointerType: "mouse", button: 0, clientX: rect.left + 5, clientY: rect.top + 5, bubbles: true }));
  movedHandle.dispatchEvent(new PointerEvent("pointermove", { pointerId: 5, pointerType: "mouse", clientX: rect.left + 20, clientY: rect.top + 40, bubbles: true, cancelable: true }));
  check(sections.get("data")!.classList.contains("is-dragging"), "desktop movement lifts the section with a placeholder");
  movedHandle.dispatchEvent(new PointerEvent("pointercancel", { pointerId: 5, pointerType: "mouse", bubbles: true }));
  check(!sections.get("data")!.classList.contains("is-dragging") && orders.length === beforeCancel, "canceled dragging restores layout without saving order");
  tabs[4].click(); setSettingsSectionOpen(marginNote as HTMLDetailsElement, true);
  const selectedRect = tabs[4].getBoundingClientRect(), barRect = tabs[4].closest<HTMLElement>('[role="tablist"]')!.getBoundingClientRect();
  check(selectedRect.left >= barRect.left - 1 && selectedRect.right <= barRect.right + 1, "the active tab stays visible within the mobile strip");
  const colorHandle = marginNote.querySelector<HTMLButtonElement>('[data-lexis-group-key="colors"] > summary > .lexis-six-dots')!;
  colorHandle.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", altKey: true, bubbles: true, cancelable: true }));
  check(groupOrders.at(-1)?.["marginnote/root"]?.join(",") === "export-scope,colors,auto", "secondary groups share reorder behavior within their hierarchy");
  const toolbar = root.querySelector<HTMLElement>(".lexis-settings-tab-tools")!;
  const fold = toolbar.querySelector<HTMLButtonElement>("[data-settings-fold]")!;
  check(toolbar.querySelectorAll("button").length===2&&toolbar.querySelectorAll("[data-settings-fold]").length===1,"expand and collapse share one icon beside the rename action");
  fold.click();
  check((marginNote as HTMLDetailsElement).open, "expand-all opens the active panel's complete function groups");
  check(fold.getAttribute("aria-label")==="settings.collapseAll"&&fold.dataset.icon==="chevrons-down-up","the same fold button switches its icon and action after expanding");
  (marginNote as HTMLDetailsElement).open=false;
  await new Promise(resolve=>setTimeout(resolve,20));
  check(fold.getAttribute("aria-label")==="settings.expandAll","manual disclosure changes keep the shared fold icon in sync");
  fold.click();fold.click();
  check(!(marginNote as HTMLDetailsElement).open, "collapse-all closes complete function groups");
  check(fold.getAttribute("aria-label")==="settings.expandAll"&&fold.dataset.icon==="chevrons-up-down","collapse switches the same control back to expand");
  tabs[0].click();
  check(fold.getAttribute("aria-label")==="settings.expandAll","switching tabs derives the fold action from the newly visible sections");
  query.value="词库导出文件夹";query.dispatchEvent(new Event("input",{bubbles:true}));
  check(fold.getAttribute("aria-label")==="settings.collapseAll","search expansion immediately updates the existing fold action");
  query.value="no-such-setting";query.dispatchEvent(new Event("input",{bubbles:true}));
  check(fold.disabled,"an empty search disables the fold control instead of acting on hidden sections");
  query.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true,cancelable:true}));
  tabs[4].click();
  nextName = "Renamed";
  toolbar.querySelector<HTMLButtonElement>('[aria-label="settings.renameTab"]')!.click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  check(tabs[4].textContent === "Renamed" && groupChanges.at(-1)?.names.integrations === "Renamed", "pencil renames the active tab without rebuilding draft inputs");
  nextName = "Extra";
  root.querySelector<HTMLButtonElement>(".lexis-settings-add-tab")!.click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  const custom = groupChanges.at(-1)?.custom.at(-1)!;
  check(custom.name === "Extra" && root.querySelectorAll('[role="tab"]').length === 7, "plus creates a persisted custom group without losing defaults");
  check(root.querySelector(".lexis-settings-tabs")?.lastElementChild?.classList.contains("lexis-settings-add-tab"), "the fixed plus stays after every sortable tab");
  check(draft.value === "Pending/folder" && draft.isConnected, "renaming and adding tabs preserve unconfirmed drafts");
  tabs[2].click();
  movedHandle.click();
  (globalThis as any).__lexisMenus.at(-1).items.find((item: any) => item.title === "Move to Extra").click();
  check(assignments.at(-1)?.data === custom.id, "custom tabs participate in section routing");
  root.querySelector<HTMLButtonElement>(`[aria-controls*="${custom.id}"]`)!.click();
  nextName = { delete: true };
  toolbar.querySelector<HTMLButtonElement>('[aria-label="settings.renameTab"]')!.click();
  await new Promise(resolve => setTimeout(resolve, 0));
  check(!root.querySelector(`[aria-controls*="${custom.id}"]`) && sections.get("data")!.parentElement === panels[0] && root.querySelector(".lexis-settings-tabs")?.lastElementChild?.classList.contains("lexis-settings-add-tab"), "pencil deletion removes only a custom tab, returns its settings to defaults and keeps plus last");
  nextName = "";
  tabs[0].click();
  const rectTab = tabs[0].getBoundingClientRect();
  tabs[0].dispatchEvent(new PointerEvent("pointerdown", { pointerId: 9, pointerType: "mouse", button: 0, clientX: rectTab.left + 5, clientY: rectTab.top + 5 }));
  check(!tabs[0].parentElement!.classList.contains("is-dragging"), "a tab click does not immediately become a drag");
  await new Promise((resolve) => setTimeout(resolve, 350));
  check(tabs[0].parentElement!.classList.contains("is-dragging"), "holding the tab itself lifts it without a six-dot handle");
  tabs[0].dispatchEvent(new PointerEvent("pointercancel", { pointerId: 9, pointerType: "mouse" }));
  check(!tabs[0].parentElement!.classList.contains("is-dragging"), "canceling a tab hold restores its layout");
  const arrowHeading = sections.get("general")!.querySelector<HTMLElement>("summary")!;
  arrowHeading.style.fontSize = "10px";
  const small = parseFloat(getComputedStyle(arrowHeading, "::before").borderInlineStartWidth);
  arrowHeading.style.fontSize = "20px";
  check(parseFloat(getComputedStyle(arrowHeading, "::before").borderInlineStartWidth) > small * 1.9, "disclosure arrows scale with title font size");
  arrowHeading.style.fontSize = "";
}

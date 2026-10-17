import { orderedSectionKeys } from "./settings-section-order";
import { createSettingsSortable } from "./settings-sortable";

export function orderSettingsGroups(sections: Map<string, HTMLElement>, saved: Record<string, string[]>, label: string,
  onOrder: (orders: Record<string, string[]>) => void): void {
  for (const [sectionKey, section] of sections) {
    const parents = new Map<HTMLElement, HTMLElement[]>();
    for (const group of section.querySelectorAll<HTMLElement>(".lexis-settings-group[data-lexis-group-key]")) {
      const parent = group.parentElement, siblings = parents.get(parent) || [];
      siblings.push(group); parents.set(parent, siblings);
    }
    for (const [parent, groups] of parents) {
      const parentGroup = parent.closest<HTMLElement>("[data-lexis-group-key]");
      const path = `${sectionKey}/${parentGroup?.dataset.lexisGroupKey || "root"}`;
      const byKey = new Map(groups.map((group) => [group.dataset.lexisGroupKey, group]));
      const order = orderedSectionKeys([...byKey.keys()], saved[path]);
      const slots = groups.map((group) => { const slot = group.ownerDocument.createComment("settings group"); group.replaceWith(slot); return slot; });
      slots.forEach((slot, index) => slot.replaceWith(byKey.get(order[index])));
      const sort = createSettingsSortable({ container: parent, label, onOrder: (ids) => { saved = { ...saved, [path]: ids }; onOrder(saved); } });
      order.forEach((key) => { const group = byKey.get(key); sort.attach(group, group.querySelector<HTMLElement>(":scope > .lexis-settings-group-heading"), key); });
    }
  }
}

import { findExactAliasTarget, rankAliasTargets, type AliasTarget } from "./alias-search";

export interface AliasComboboxController {
  close(): void;
}

interface AliasComboboxOptions {
  document: Document;
  anchor: HTMLElement;
  targets: AliasTarget[];
  initialValue: string;
  placeholder: string;
  createLabel: string;
  existingLabel(target: AliasTarget): string;
  emptyText: string;
  onCreate(value: string): void;
  onPick(target: AliasTarget): void;
  onClose(): void;
}

export function openAliasCombobox(options: AliasComboboxOptions): AliasComboboxController {
  const { document: doc, anchor, targets } = options;
  const panel = doc.body.createDiv({ cls: "lexis-alias-search" });
  panel.setAttribute("role", "combobox");
  const input = panel.createEl("input", { cls: "lexis-alias-search-input" });
  input.value = options.initialValue;
  input.placeholder = options.placeholder;
  input.setAttribute("aria-autocomplete", "list");
  const list = panel.createDiv({ cls: "lexis-alias-search-results" });
  list.setAttribute("role", "listbox");

  let closed = false;
  let activeIndex = 0;
  let primaryValue = input.value.trim();
  let exactTarget = findExactAliasTarget(targets, primaryValue);
  let matches = rankAliasTargets(targets, primaryValue, 9).filter((target) => target.id !== exactTarget?.id).slice(0, 7);

  const place = () => {
    const win = doc.defaultView || window;
    const rect = anchor.getBoundingClientRect();
    const width = Math.min(280, Math.max(220, win.innerWidth - 16));
    panel.style.width = `${width}px`;
    panel.style.left = `${Math.max(8, Math.min(rect.left, win.innerWidth - width - 8))}px`;
    const below = rect.bottom + 5;
    const height = panel.offsetHeight || 240;
    panel.style.top = `${below + height <= win.innerHeight - 8 ? below : Math.max(8, rect.top - height - 5)}px`;
  };

  const choose = (target: AliasTarget) => {
    controller.close();
    options.onPick(target);
  };

  const chooseAt = (index: number) => {
    const hasPrimary = !!primaryValue;
    if (hasPrimary && index === 0) {
      controller.close();
      if (exactTarget) options.onPick(exactTarget);
      else options.onCreate(primaryValue);
      return;
    }
    const target = matches[index - (hasPrimary ? 1 : 0)];
    if (target) choose(target);
  };

  const render = () => {
    primaryValue = input.value.trim();
    exactTarget = findExactAliasTarget(targets, primaryValue);
    matches = rankAliasTargets(targets, primaryValue, 9).filter((target) => target.id !== exactTarget?.id).slice(0, 7);
    const optionCount = matches.length + (primaryValue ? 1 : 0);
    activeIndex = Math.min(activeIndex, Math.max(0, optionCount - 1));
    list.replaceChildren();
    if (primaryValue) {
      const primary = list.createEl("button", { cls: "lexis-alias-search-result is-primary", attr: { type: "button" } });
      primary.classList.toggle("is-active", activeIndex === 0);
      primary.setAttribute("role", "option");
      primary.setAttribute("aria-selected", activeIndex === 0 ? "true" : "false");
      primary.createSpan({ text: primaryValue });
      primary.createEl("small", { text: exactTarget ? options.existingLabel(exactTarget) : options.createLabel });
      primary.addEventListener("pointerdown", (event) => event.preventDefault());
      primary.addEventListener("click", () => chooseAt(0));
    }
    if (!primaryValue && !matches.length) {
      const empty = list.createDiv({ cls: "lexis-alias-search-empty" });
      empty.textContent = options.emptyText;
    } else {
      const offset = primaryValue ? 1 : 0;
      matches.forEach((match, index) => {
        const optionIndex = index + offset;
        const row = list.createEl("button", { cls: "lexis-alias-search-result", attr: { type: "button" } });
        row.classList.toggle("is-active", optionIndex === activeIndex);
        row.setAttribute("role", "option");
        row.setAttribute("aria-selected", optionIndex === activeIndex ? "true" : "false");
        const title = row.createSpan();
        title.textContent = match.title;
        if (normalizedLabel(match.matched) !== normalizedLabel(match.title)) {
          const alias = row.createEl("small");
          alias.textContent = match.matched;
        }
        row.addEventListener("pointerdown", (event) => event.preventDefault());
        row.addEventListener("click", () => choose(match));
      });
    }
    place();
  };

  const onOutside = (event: PointerEvent) => {
    const target = event.target as Node | null;
    if (target && !panel.contains(target) && !anchor.contains(target)) controller.close();
  };

  const controller: AliasComboboxController = {
    close() {
      if (closed) return;
      closed = true;
      doc.removeEventListener("pointerdown", onOutside, true);
      panel.remove();
      options.onClose();
    },
  };

  input.addEventListener("input", () => { activeIndex = 0; render(); });
  input.addEventListener("keydown", (event) => {
    const optionCount = matches.length + (primaryValue ? 1 : 0);
    if (event.key === "ArrowDown" && optionCount) { event.preventDefault(); activeIndex = (activeIndex + 1) % optionCount; render(); }
    else if (event.key === "ArrowUp" && optionCount) { event.preventDefault(); activeIndex = (activeIndex - 1 + optionCount) % optionCount; render(); }
    else if (event.key === "Enter" && optionCount) { event.preventDefault(); chooseAt(activeIndex); }
    else if (event.key === "Escape") { event.preventDefault(); controller.close(); }
  });
  doc.addEventListener("pointerdown", onOutside, true);
  render();
  input.focus();
  input.select();
  return controller;
}

function normalizedLabel(value: string): string {
  return String(value || "").normalize("NFKC").toLowerCase().trim();
}

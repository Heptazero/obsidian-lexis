import { rankAliasTargets, type AliasTarget } from "./alias-search";

export interface AliasComboboxController {
  close(): void;
}

interface AliasComboboxOptions {
  document: Document;
  anchor: HTMLElement;
  targets: AliasTarget[];
  placeholder: string;
  emptyText: string;
  onPick(target: AliasTarget): void;
  onClose(): void;
}

export function openAliasCombobox(options: AliasComboboxOptions): AliasComboboxController {
  const { document: doc, anchor, targets } = options;
  const panel = doc.body.createDiv({ cls: "lexis-alias-search" });
  panel.setAttribute("role", "combobox");
  const input = panel.createEl("input", { cls: "lexis-alias-search-input" });
  input.placeholder = options.placeholder;
  input.setAttribute("aria-autocomplete", "list");
  const list = panel.createDiv({ cls: "lexis-alias-search-results" });
  list.setAttribute("role", "listbox");

  let closed = false;
  let activeIndex = 0;
  let matches = rankAliasTargets(targets, "");

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

  const render = () => {
    matches = rankAliasTargets(targets, input.value);
    activeIndex = Math.min(activeIndex, Math.max(0, matches.length - 1));
    list.replaceChildren();
    if (!matches.length) {
      const empty = list.createDiv({ cls: "lexis-alias-search-empty" });
      empty.textContent = options.emptyText;
    } else {
      matches.forEach((match, index) => {
        const row = list.createEl("button", { cls: "lexis-alias-search-result", attr: { type: "button" } });
        row.classList.toggle("is-active", index === activeIndex);
        row.setAttribute("role", "option");
        row.setAttribute("aria-selected", index === activeIndex ? "true" : "false");
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
    if (event.key === "ArrowDown" && matches.length) { event.preventDefault(); activeIndex = (activeIndex + 1) % matches.length; render(); }
    else if (event.key === "ArrowUp" && matches.length) { event.preventDefault(); activeIndex = (activeIndex - 1 + matches.length) % matches.length; render(); }
    else if (event.key === "Enter" && matches[activeIndex]) { event.preventDefault(); choose(matches[activeIndex]); }
    else if (event.key === "Escape") { event.preventDefault(); controller.close(); }
  });
  doc.addEventListener("pointerdown", onOutside, true);
  render();
  input.focus();
  return controller;
}

function normalizedLabel(value: string): string {
  return String(value || "").normalize("NFKC").toLowerCase().trim();
}

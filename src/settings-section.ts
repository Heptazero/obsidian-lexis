interface SettingsSectionOptions {
  level?: "section" | "group";
  collapsible?: boolean;
  open?: boolean;
  description?: string;
  onToggle?: (open: boolean) => void;
  key?: string;
}

const silentOpen = new WeakMap<HTMLDetailsElement, (open: boolean) => void>();

/** Temporary search/drag expansion must not persist user fold preferences. */
export function setSettingsSectionOpen(section: HTMLDetailsElement, open: boolean): void {
  const set = silentOpen.get(section);
  if (set) set(open);
  else section.open = open;
}

/** Hierarchy determines layout. Collapsing only changes visibility. */
export function createSettingsSection(container: HTMLElement, title: string, {
  level = "group", collapsible = true, open = false, description = "", onToggle, key,
}: SettingsSectionOptions = {}): { element: HTMLElement; heading: HTMLElement; body: HTMLElement } {
  const className = `lexis-settings-${level}`;
  const element = container.createEl(collapsible ? "details" : "div", { cls: className });
  if (key) element.dataset.lexisGroupKey = key;
  const heading = element.createEl(collapsible ? "summary" : "div", { cls: `${className}-heading` });
  const label = heading.createDiv({ cls: "lexis-settings-heading-label" });
  label.createSpan({ cls: `${className}-title`, text: title });
  if (description) label.createSpan({ cls: "lexis-settings-section-hint", text: description });
  const body = element.createDiv({ cls: `${className}-body` });
  if (collapsible) {
    const details = element as HTMLDetailsElement;
    details.open = open;
    let previous = open;
    silentOpen.set(details, (next) => { previous = next; details.open = next; });
    if (onToggle) {
      details.addEventListener("toggle", () => {
        if (previous === details.open) return;
        previous = details.open;
        onToggle(details.open);
      });
    }
  }
  return { element, heading, body };
}

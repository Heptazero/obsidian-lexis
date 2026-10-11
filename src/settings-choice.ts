import { Menu, setIcon, type Setting } from "obsidian";

export interface ChoiceOption<T extends string> { value: T; label: string }

/** Two choices toggle directly; longer lists open beside the current value. */
export function addCurrentChoice<T extends string>(
  setting: Setting,
  options: readonly ChoiceOption<T>[],
  value: T,
  onChange: (value: T) => void | Promise<void>,
): void {
  const button = setting.controlEl.createEl("button", { cls: "lexis-current-choice", attr: { type: "button" } });
  const label = button.createSpan();
  const icon = button.createSpan({ cls: "lexis-current-choice-icon" });
  setIcon(icon, options.length === 2 ? "arrow-left-right" : "chevron-down");
  if (options.length > 2) button.setAttribute("aria-haspopup", "menu");
  const render = () => {
    label.setText(options.find((option) => option.value === value)?.label || options[0]?.label || "");
    button.setAttribute("aria-label", `${setting.nameEl.textContent || ""}: ${label.textContent || ""}`);
  };
  const choose = async (next: T) => {
    if (next === value || button.disabled) return;
    const previous = value;
    value = next; render(); button.disabled = true;
    try { await onChange(next); }
    catch (error) { value = previous; render(); throw error; }
    finally { button.disabled = false; }
  };
  button.addEventListener("click", () => {
    if (options.length === 2) {
      void choose(options.find((option) => option.value !== value).value);
      return;
    }
    const menu = new Menu();
    for (const option of options) menu.addItem((item) => item
      .setTitle(option.label).setChecked(option.value === value).onClick(() => choose(option.value)));
    const rect = button.getBoundingClientRect();
    menu.showAtPosition({ x: rect.left, y: rect.bottom });
  });
  render();
  if (options.length < 2) button.disabled = true;
}

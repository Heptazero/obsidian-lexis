"use strict";

const WIDE_CONTROL_SELECTOR = 'input:not([type]), input[type="text"], input[type="number"], input[type="range"], select, textarea';

function directControl(setting: HTMLElement): HTMLElement | null {
  for (const child of setting.children) {
    if (child.instanceOf(HTMLElement) && child.classList.contains("setting-item-control")) return child;
  }
  return null;
}

export function annotateSettingControlLayouts(root: HTMLElement): void {
  for (const setting of root.querySelectorAll<HTMLElement>(".setting-item:not(.setting-item-heading)")) {
    const control = directControl(setting);
    setting.classList.toggle("lexis-setting-has-wide-control", !!control?.querySelector(WIDE_CONTROL_SELECTOR));
    setting.classList.toggle("lexis-setting-has-toggle", !!control?.querySelector(".checkbox-container"));
  }
}

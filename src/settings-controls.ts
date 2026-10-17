"use strict";
import { addCurrentChoice } from "./settings-choice";
import { createSettingsSortable } from "./settings-sortable";

import type { App } from "obsidian";
import type { HighlightStyle } from "./types";

function moveItem<T>(items: Iterable<T> | ArrayLike<T>, from: number, to: number): T[] {
  const next = Array.from(items || []);
  if (from === to || from < 0 || to < 0 || from >= next.length || to >= next.length) return next;
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

interface ReorderOptions {
  container: HTMLElement;
  onMove: (from: number, to: number) => void | Promise<void>;
  setIcon?: (element: HTMLElement, icon: string) => void;
  label?: string;
  longPressMs?: number;
}

function createReorderController({ container, onMove, label = "Reorder", longPressMs = 320 }: ReorderOptions) {
  let previous: string[] = [];
  const sorter = createSettingsSortable({
    container, label, axis: "auto", longPressMs,
    onOrder: (ids, movedId) => {
      const from = previous.indexOf(movedId), to = ids.indexOf(movedId);
      previous = ids;
      if (from >= 0 && to >= 0 && from !== to) void onMove(from, to);
    },
  });
  return {
    attach(item: HTMLElement, index: number, { handleParent = item }: { handleParent?: HTMLElement } = {}) {
      item.classList.add("lexis-sortable-item");
      handleParent.classList.add("lexis-sortable-row");
      item.dataset.lexisOrder = String(index);
      previous.push(String(index));
      sorter.attach(item, handleParent, String(index));
      handleParent.lastElementChild.classList.add("lexis-drag-handle");
    },
  };
}

interface AppearanceState {
  color: string;
  opacity: number;
  style?: HighlightStyle | "";
}

interface AppearancePatch {
  color?: string;
  opacity?: number;
  style?: HighlightStyle | "";
}

interface AppearanceLabels {
  color: string;
  opacity: string;
  style: string;
  defaultStyle: string;
  wavy: string;
  underline: string;
  background: string;
  reset: string;
  done: string;
}

interface AppearanceButtonOptions {
  app: App;
  obsidian: typeof import("obsidian");
  parent: HTMLElement;
  title: string;
  state: () => AppearanceState;
  onChange: (patch: AppearancePatch) => void | Promise<void>;
  onReset: () => void | Promise<void>;
  labels: AppearanceLabels;
  allowStyle?: boolean;
}

function addAppearanceButton({ app, obsidian, parent, title, state, onChange, onReset, labels, allowStyle = false }: AppearanceButtonOptions) {
  const button = new obsidian.ExtraButtonComponent(parent).setIcon("palette").setTooltip(title);
  const refreshButton = () => {
    const color = state().color;
    button.extraSettingsEl.setCssStyles({ color: color || "var(--text-accent)" });
  };
  button.onClick(() => {
    const modal = new obsidian.Modal(app);
    modal.onOpen = () => {
      modal.contentEl.empty();
      modal.contentEl.createEl("h3", { text: title });
      new obsidian.Setting(modal.contentEl).setName(labels.color)
        .addColorPicker((picker) => picker.setValue(state().color).onChange((color) => { void Promise.resolve(onChange({ color })).then(refreshButton); }));
      new obsidian.Setting(modal.contentEl).setName(labels.opacity)
        .addSlider((slider) => slider.setLimits(0.1, 1, 0.05).setValue(state().opacity).onChange((opacity) => { void onChange({ opacity }); }));
      if (allowStyle) {
        addCurrentChoice(new obsidian.Setting(modal.contentEl).setName(labels.style), [
          { value: "", label: labels.defaultStyle }, { value: "wavy", label: labels.wavy },
          { value: "underline", label: labels.underline }, { value: "background", label: labels.background },
        ], state().style || "", async (style) => { await onChange({ style }); });
      }
      new obsidian.Setting(modal.contentEl)
        .addButton((reset) => reset.setButtonText(labels.reset).onClick(() => { void Promise.resolve(onReset()).then(() => { refreshButton(); modal.close(); }); }))
        .addButton((done) => done.setButtonText(labels.done).setCta().onClick(() => modal.close()));
    };
    modal.open();
  });
  refreshButton();
  return button;
}

export { addAppearanceButton, createReorderController, moveItem };

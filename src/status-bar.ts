"use strict";

import type { Command, Plugin } from "obsidian";
import type { LexisSettings, LexisStats } from "./types";

type TranslationVars = Record<string, string | number | boolean>;

interface StatusBarRuntime extends Pick<Plugin, "addCommand" | "addStatusBarItem" | "registerDomEvent"> {
  settings: LexisSettings;
  stats: LexisStats;
  bridge: { running: boolean } | null;
  t(key: string, vars?: TranslationVars): string;
  saveSettings(): Promise<void>;
}

type SetIcon = (parent: HTMLElement, iconId: string) => void;

export function statusBarSummary(runtime: Pick<StatusBarRuntime, "settings" | "stats" | "bridge" | "t">): string {
  const aliasPart = runtime.settings.includeAliases && runtime.stats.aliases
    ? runtime.t("status.aliases", { count: runtime.stats.aliases })
    : "";
  const inlinePart = runtime.stats.inlineEntries
    ? runtime.t("status.inline", { count: runtime.stats.inlineEntries })
    : "";
  const duePart = runtime.stats.due ? ` · ⏰${runtime.stats.due}` : "";
  const bridgePart = runtime.bridge?.running ? " · 🌐" : "";
  return runtime.t("status.summary", {
    words: runtime.stats.words,
    aliases: aliasPart,
    inline: inlinePart,
    due: duePart,
    bridge: bridgePart,
  });
}

export class LexisStatusBar {
  private element: HTMLElement | null = null;

  constructor(private readonly plugin: StatusBarRuntime, private readonly setIcon: SetIcon) {}

  mount(): void {
    const element = this.plugin.addStatusBarItem();
    element.addClass("lexis-status-bar");
    element.setAttribute("role", "button");
    element.tabIndex = 0;
    this.element = element;
    this.plugin.registerDomEvent(element, "click", () => this.toggleExpanded());
    this.plugin.registerDomEvent(element, "keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      this.toggleExpanded();
    });
    this.plugin.addCommand(this.visibilityCommand());
    this.update();
  }

  update(): void {
    const element = this.element;
    if (!element) return;
    const visible = this.plugin.settings.statusBarVisible !== false;
    element.hidden = !visible;
    if (!visible) return;
    const summary = statusBarSummary(this.plugin);
    element.empty();
    const icon = element.createSpan({ cls: "lexis-status-bar-icon" });
    this.setIcon(icon, "book-open");
    if (this.plugin.settings.statusBarExpanded) {
      element.createSpan({ cls: "lexis-status-bar-summary", text: summary });
    }
    element.setAttribute("aria-expanded", String(!!this.plugin.settings.statusBarExpanded));
    element.setAttribute("aria-label", this.plugin.t("status.toggleDetailsAria"));
    element.setAttribute("title", summary);
  }

  setVisible(visible: boolean): void {
    this.plugin.settings.statusBarVisible = visible;
    this.update();
    void this.plugin.saveSettings();
  }

  private toggleExpanded(): void {
    this.plugin.settings.statusBarExpanded = !this.plugin.settings.statusBarExpanded;
    this.update();
    void this.plugin.saveSettings();
  }

  private visibilityCommand(): Command {
    return {
      id: "toggle-status-bar",
      name: this.plugin.t("command.toggleStatusBar"),
      callback: () => this.setVisible(this.plugin.settings.statusBarVisible === false),
    };
  }
}

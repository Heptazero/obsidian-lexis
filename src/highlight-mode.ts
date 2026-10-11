"use strict";

import type { LexisSettings } from "./types";

type HighlightModeSettings = Pick<LexisSettings, "enableHighlight" | "highlightMode">;

export function automaticHighlighting(settings: HighlightModeSettings): boolean {
  return settings.enableHighlight && settings.highlightMode !== "manual";
}

export function manualLookupEnabled(settings: HighlightModeSettings): boolean {
  return settings.enableHighlight && settings.highlightMode === "manual";
}

"use strict";

import type { LexisSettings } from "./types";

type StoredSettings = Partial<LexisSettings>;

interface LegacyMigrationResult {
  settings: StoredSettings;
  migrated: boolean;
}

function pluginFolderName(manifestDir: string | undefined, pluginId: string): string {
  return (manifestDir || pluginId).replace(/\/+$/, "").split("/").pop() || pluginId;
}

function mergeRecord(legacy: unknown, current: unknown): Record<string, unknown> {
  const left = legacy && typeof legacy === "object" && !Array.isArray(legacy) ? legacy as Record<string, unknown> : {};
  const right = current && typeof current === "object" && !Array.isArray(current) ? current as Record<string, unknown> : {};
  return { ...left, ...right };
}

function migrateLegacySettings(current: StoredSettings, legacy: StoredSettings | null): LegacyMigrationResult {
  if (!legacy || current.legacySettingsImported) return { settings: current, migrated: false };
  return {
    settings: {
      ...current,
      ...legacy,
      reviewLog: mergeRecord(legacy.reviewLog, current.reviewLog) as LexisSettings["reviewLog"],
      reviewHistory: mergeRecord(legacy.reviewHistory, current.reviewHistory) as LexisSettings["reviewHistory"],
      syntaxCardStates: mergeRecord(legacy.syntaxCardStates, current.syntaxCardStates),
      legacySettingsImported: true,
    },
    migrated: true,
  };
}

export { migrateLegacySettings, pluginFolderName };
export type { StoredSettings };

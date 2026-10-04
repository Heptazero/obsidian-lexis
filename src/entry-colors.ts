"use strict";

import type { EntryColor } from "./types";

const HEX_COLOR = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

export function resolveEntryColorToken(token: string | undefined, entries: EntryColor[] | undefined): string {
  const value = String(token || "").trim();
  if (!value) return "";
  if (HEX_COLOR.test(value)) return value;
  const key = value.toLowerCase();
  const entry = (entries || []).find((item) => String(item?.name || "")
    .split(/\s*\/\s*/)
    .some((name) => name.trim().toLowerCase() === key));
  const color = String(entry?.color || "").trim();
  return HEX_COLOR.test(color) ? color : "";
}

export function entryColorLabel(token: string | undefined): string {
  const value = String(token || "").trim();
  return value && !HEX_COLOR.test(value) ? value : "";
}

"use strict";

import type { ColorRole } from "./types";

const HEX_COLOR = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

export function resolveEntryColorToken(token: string | undefined, roles: ColorRole[] | undefined): string {
  const value = String(token || "").trim();
  if (!value) return "";
  if (HEX_COLOR.test(value)) return value;
  const key = value.toLowerCase();
  const role = (roles || []).find((item) => String(item?.name || "").trim().toLowerCase() === key);
  const color = String(role?.color || "").trim();
  return HEX_COLOR.test(color) ? color : "";
}

export function entryColorRoleLabel(token: string | undefined): string {
  const value = String(token || "").trim();
  return value && !HEX_COLOR.test(value) ? value : "";
}

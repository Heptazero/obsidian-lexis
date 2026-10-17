export interface MenuRect { x: number; y: number; width: number; height: number }

export function selectionMenuRect(value: unknown): MenuRect | null {
  if (typeof value !== "string") return null;
  const values = value.replace(/[{}]/g, "").split(",").map((part) => Number(part.trim()));
  if (values.length !== 4 || values.some((n) => !Number.isFinite(n)) || values[2] <= 0 || values[3] <= 0) return null;
  return { x: values[0], y: values[1], width: values[2], height: values[3] };
}

/** Place beside, above or below the menu without intercepting its native buttons. */
export function selectionButtonRect(menu: MenuRect, bounds: MenuRect): MenuRect | null {
  const gap = 8, inset = 12, width = 172, height = 44;
  const left = bounds.x + inset, top = bounds.y + inset;
  const right = bounds.x + bounds.width - inset, bottom = bounds.y + bounds.height - inset;
  if (right - left < width || bottom - top < height) return null;
  const clampX = (x: number) => Math.max(left, Math.min(x, right - width));
  const clampY = (y: number) => Math.max(top, Math.min(y, bottom - height));
  const candidates = [
    { x: menu.x + menu.width + gap, y: clampY(menu.y + (menu.height - height) / 2) },
    { x: menu.x - gap - width, y: clampY(menu.y + (menu.height - height) / 2) },
    { x: clampX(menu.x + (menu.width - width) / 2), y: menu.y + menu.height + gap },
    { x: clampX(menu.x + (menu.width - width) / 2), y: menu.y - gap - height },
  ];
  const point = candidates.find(({ x, y }) => x >= left && x + width <= right && y >= top && y + height <= bottom);
  return point ? { ...point, width, height } : null;
}

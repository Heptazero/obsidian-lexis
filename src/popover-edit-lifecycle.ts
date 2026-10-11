/** Closing or changing a card must settle its active editor first. */
export const activePopoverEditors = new WeakMap<HTMLElement, () => Promise<boolean>>();

export function finishPopoverEdit(popover: HTMLElement): Promise<boolean> {
  const finish = activePopoverEditors.get(popover);
  return finish ? finish() : Promise.resolve(true);
}

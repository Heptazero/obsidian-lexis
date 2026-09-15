export interface ReadingPreview {
  getScroll(): number;
  applyScroll(scroll: number): void;
  rerender(full?: boolean): void;
}

export function rerenderPreservingScroll(
  preview: ReadingPreview,
  requestFrame: (callback: FrameRequestCallback) => number,
  stillCurrent: () => boolean,
): void {
  const scroll = preview.getScroll();
  preview.rerender(true);
  requestFrame(() => {
    if (stillCurrent()) preview.applyScroll(scroll);
  });
}

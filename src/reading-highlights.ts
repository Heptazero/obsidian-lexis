export function refreshReadingHighlightsInPlace(
  root: HTMLElement,
  applyHighlights: (root: HTMLElement) => void,
): void {
  const parents = new Set<Node>();
  const highlights = Array.from(root.querySelectorAll<HTMLElement>(".lexis-hl"));

  for (const highlight of highlights) {
    if (highlight.closest(".lexis-popover")) continue;
    const parent = highlight.parentNode;
    if (parent) parents.add(parent);
    highlight.replaceWith(...Array.from(highlight.childNodes));
  }

  for (const parent of parents) parent.normalize();
  applyHighlights(root);
}

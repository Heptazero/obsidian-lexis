import type { SyntaxCardKind } from "./flashcard-syntax";

const LIST_ITEM_PREFIX = /^\s*(?:(?:>\s*)*)(?:(?:[-+*]|\d+[.)])\s+)(?:\[[ xX]\]\s+)?/;

/** Remove a note's list container from a one-line card face without changing card identity. */
export function displayedSyntaxFront(markdown: string, kind?: SyntaxCardKind): string {
  if (kind !== "inline" && kind !== "bidirectional") return markdown;
  return markdown.replace(LIST_ITEM_PREFIX, "");
}

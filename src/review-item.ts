import type { ReviewItem, SyntaxReviewMember } from "./types";

export type ClozeRevealMode = "one" | "all";

export const noteSuspensionKey = (path: string): string => `note:${path}`;
export const syntaxSuspensionKey = (id: string): string => `syntax:${id}`;

export const reviewItemSuspensionKeys = (item: ReviewItem): string[] => item.type === "note"
  ? [noteSuspensionKey(item.file.path)]
  : (item.syntax?.memberIds || []).map(syntaxSuspensionKey);

const itemForMembers = (item: ReviewItem, members: SyntaxReviewMember[], front: string): ReviewItem => ({
  ...item,
  card: members.length === 1 ? { ...members[0].card } : item.card,
  syntax: item.syntax ? {
    ...item.syntax,
    id: members.length === 1 ? members[0].id : item.syntax.id,
    memberIds: members.map((member) => member.id),
    members,
    front,
  } : undefined,
});

export const chooseClozeRevealMode = (item: ReviewItem, mode: ClozeRevealMode): { current: ReviewItem; remaining: ReviewItem[] } => {
  const syntax = item.syntax;
  const members = syntax?.kind === "cloze" ? syntax.members || [] : [];
  if (members.length < 2) return { current: item, remaining: [] };
  if (mode === "all") {
    return { current: itemForMembers(item, members, syntax?.combinedFront || syntax?.front || ""), remaining: [] };
  }
  const [current, ...rest] = members;
  return {
    current: itemForMembers(item, [current], current.front),
    remaining: rest.map((member) => itemForMembers(item, [member], member.front)),
  };
};

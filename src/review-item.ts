import type { ReviewCardState, ReviewItem, SyntaxReviewMember } from "./types";

export type ClozeRevealMode = "one" | "all";

export const noteSuspensionKey = (path: string): string => `note:${path}`;
export const syntaxSuspensionKey = (id: string): string => `syntax:${id}`;

export const reviewGroupState = (states: ReviewCardState[]): ReviewCardState => {
  if (!states.length || states.some((state) => state.s == null || !Number.isFinite(Number(state.s)))) return {};
  return [...states].sort((left, right) => String(left.due || "").localeCompare(String(right.due || "")))[0];
};

export const reviewItemKeys = (item: ReviewItem): string[] => item.type === "note"
  ? [item.file.path]
  : (item.syntax?.memberIds || []).map((id) => `syntax:${id}`);

export const restrictReviewItem = (item: ReviewItem, allowed: Set<string>): ReviewItem | null => {
  if (item.type === "note") return allowed.has(item.file.path) ? item : null;
  const ids = (item.syntax?.memberIds || []).filter((id) => allowed.has(`syntax:${id}`));
  if (!ids.length || !item.syntax) return null;
  const members = item.syntax.members?.filter((member) => ids.includes(member.id));
  if (members?.length) return itemForMembers(item, members, members.length === 1 ? members[0].front : item.syntax.combinedFront || item.syntax.front);
  return { ...item, syntax: { ...item.syntax, memberIds: ids } };
};

export const reviewItemSuspensionKeys = (item: ReviewItem): string[] => item.type === "note"
  ? [noteSuspensionKey(item.file.path)]
  : (item.syntax?.memberIds || []).map(syntaxSuspensionKey);

const itemForMembers = (item: ReviewItem, members: SyntaxReviewMember[], front: string): ReviewItem => ({
  ...item,
  card: members.length === 1 ? { ...members[0].card } : reviewGroupState(members.map((member) => member.card)),
  syntax: item.syntax ? {
    ...item.syntax,
    id: members.length === 1 ? members[0].id : item.syntax.id,
    memberIds: members.map((member) => member.id),
    members,
    front,
    clozeAnswer: members.length === 1 ? members[0].answer : undefined,
    clozeIndex: members.length === 1 ? members[0].clozeIndex : undefined,
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

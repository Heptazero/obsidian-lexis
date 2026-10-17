import type { SelectionPillAction, SelectionPillOrder } from "./types";

export const SELECTION_PILL_ORDERS: readonly SelectionPillOrder[] = [
  "add-dictionary-alias",
  "add-alias-dictionary",
  "dictionary-add-alias",
  "dictionary-alias-add",
  "alias-add-dictionary",
  "alias-dictionary-add",
];

export function selectionPillActions(order: SelectionPillOrder | undefined): SelectionPillAction[] {
  const value = order && SELECTION_PILL_ORDERS.includes(order)
    ? order
    : "add-dictionary-alias";
  return value.split("-") as SelectionPillAction[];
}

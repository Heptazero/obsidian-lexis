export function orderedSectionKeys(available: readonly string[], saved: unknown): string[] {
  const allowed = new Set(available);
  const previous: string[] = Array.isArray(saved) ? saved.filter((key): key is string => typeof key === "string") : [];
  return [...new Set([...previous, ...available])].filter((key): key is string => typeof key === "string" && allowed.has(key));
}

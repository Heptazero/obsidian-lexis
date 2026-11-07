import type { WorkspaceLeaf } from "obsidian";

export interface ManualTermDraft {
  term: string;
  aliases: string;
  definition: string;
  folder: string;
  sourceUrl: string;
}

export function webSourceUrl(value: unknown): URL | null {
  if (typeof value !== "string" || !/^https?:\/\//i.test(value.trim())) return null;
  try {
    const url = new URL(value.trim());
    return url.username || url.password ? null : url;
  } catch {
    return null;
  }
}

export function currentWebSource(leaf: WorkspaceLeaf | null): string {
  const state = leaf?.getViewState();
  if (state?.type !== "webviewer") return "";
  const viewData: unknown = state.state;
  const url = viewData && typeof viewData === "object" && "url" in viewData ? viewData.url : null;
  return webSourceUrl(url)?.href ?? "";
}

export function webSourceMarkdown(url: URL): string {
  const label = url.hostname.replaceAll("[", "\\[").replaceAll("]", "\\]");
  const destination = url.href.replaceAll("<", "%3C").replaceAll(">", "%3E");
  return `[${label}](<${destination}>)`;
}

export function termAliases(value: string, existing: unknown, term: string): string[] {
  const separator = /[,，;；\n]/;
  const all: unknown[] = Array.isArray(existing) ? existing : typeof existing === "string" ? existing.split(separator) : [existing];
  const seen = new Set([term.normalize("NFKC").toLowerCase()]);
  const aliases: string[] = [];
  for (const item of [...all, ...value.split(separator)]) {
    if (typeof item !== "string" && typeof item !== "number") continue;
    const alias = String(item).trim();
    const key = alias.normalize("NFKC").toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    aliases.push(alias);
  }
  return aliases;
}

export function appendTermContent(content: string, extra: string): string {
  return [content.trimEnd(), extra.trim()].filter(Boolean).join("\n\n") + "\n";
}

"use strict";

import type { TFile } from "obsidian";
import type { LexisEntry } from "./types";

export interface InlineEntrySyntax {
  entryDelimiter: string;
  aliasDelimiter: string;
}

export function splitInlineAliases(value: string, delimiter: string): string[] {
  const token = String(delimiter || "/").trim() || "/";
  const parts: string[] = [];
  let current = "";
  for (let index = 0; index < value.length;) {
    if (value[index] === "\\" && value.slice(index + 1, index + 1 + token.length) === token) {
      current += token;
      index += token.length + 1;
      continue;
    }
    if (value.slice(index, index + token.length) === token) {
      parts.push(current.trim());
      current = "";
      index += token.length;
      continue;
    }
    current += value[index];
    index++;
  }
  parts.push(current.trim());

  const seen = new Set<string>();
  return parts.filter((part) => {
    const key = part.toLowerCase();
    if (!part || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function parseInlineEntries(content: string, file: TFile, syntax: InlineEntrySyntax): LexisEntry[] {
  const entryDelimiter = String(syntax.entryDelimiter || "::").trim() || "::";
  const lines = String(content || "").split(/\r?\n/);
  let firstContentLine = 0;
  if (lines[0]?.trim() === "---") {
    const end = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
    if (end >= 0) firstContentLine = end + 1;
  }

  const entries: LexisEntry[] = [];
  const headingStack: { name: string; level: number; line: number }[] = [];
  let inFence = false;
  for (let lineNo = firstContentLine; lineNo < lines.length; lineNo++) {
    const line = lines[lineNo];
    if (/^\s*```/.test(line)) { inFence = !inFence; continue; }
    if (inFence) continue;
    const heading = /^\s*(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      headingStack.length = level;
      headingStack[level - 1] = { name: heading[2].trim(), level, line: lineNo };
      continue;
    }
    const at = line.indexOf(entryDelimiter);
    if (at < 0) continue;
    const left = line.slice(0, at).trim().replace(/^[-*+]\s+/, "");
    const annotation = line.slice(at + entryDelimiter.length).trim();
    if (!left || /^#/.test(left) || left.toLowerCase() === "color") continue;
    const [display, ...aliases] = splitInlineAliases(left, syntax.aliasDelimiter);
    if (!display) continue;
    const headingPath = headingStack.filter(Boolean).map((item) => ({ ...item }));
    const categories = headingPath.map((item) => item.name).reverse();
    entries.push({
      display,
      aliases,
      file,
      isAlias: false,
      tags: new Set(),
      inline: true,
      annotation,
      category: categories[0] || "",
      categories,
      headingPath,
      line: lineNo,
    });
  }
  return entries;
}

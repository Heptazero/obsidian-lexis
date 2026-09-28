type RelationBag = Record<string, unknown[]>;

export interface SectionLink {
  type: string;
  target: string;
}

export function relationHeading(text: string): string {
  return text.replace(/\s+#+\s*$/, "").replace(/^\s*\d+(?:\.\d+)*[.)、]?\s+/, "").trim().normalize("NFC");
}

export function parseSectionLinks(raw: string): SectionLink[] {
  const clean = raw.replace(/```[\s\S]*?```/g, "").replace(/^---\n[\s\S]*?\n---/, "");
  const out: SectionLink[] = [];
  let current = "相关";
  const linkRe = /\[\[([^\]\n]+)\]\]/g;
  for (const line of clean.split("\n")) {
    const heading = /^#{1,6}[ \t]+(.+?)\s*$/.exec(line);
    if (heading) { current = relationHeading(heading[1]) || "相关"; continue; }
    linkRe.lastIndex = 0;
    let match = linkRe.exec(line);
    while (match) {
      const target = match[1].split(/[|#]/, 1)[0].trim();
      if (target && line[match.index - 1] !== "!") out.push({ type: current, target });
      match = linkRe.exec(line);
    }
  }
  return out;
}

export function relationTypes(out: RelationBag, inc: RelationBag): string[] {
  const names = new Set([...Object.keys(out), ...Object.keys(inc)]);
  names.delete("相关");
  return [...names, ...(out["相关"]?.length || inc["相关"]?.length ? ["相关"] : [])];
}

export function relationBlockSource(source: string, sectionText?: string | null): string {
  const info = /(?:^|\r?\n)[ \t]*(?:`{3,}|~{3,})[ \t]*rel(?:[ \t]+([^\r\n]+))?[ \t]*(?=\r?\n|$)/i.exec(sectionText || "")?.[1];
  return `rel ${relationHeading(info || source.trim().split(/\r?\n/, 1)[0] || "")}`.trim();
}

export function replaceLexisFences(markdown: string, replace: (source: string) => string): string {
  return markdown.replace(/(^|\n)(`{3,})[ \t]*(lexis|rel)\b([^\r\n]*)\r?\n([\s\S]*?)\2[ \t]*(?=\r?\n|$)/gi,
    (_all, prefix: string, _fence: string, language: string, info: string, body: string) => {
      const source = language.toLowerCase() === "rel"
        ? relationBlockSource(body, `\`\`\`rel${info}`)
        : `${info}\n${body}`.trim();
      return `${prefix}${replace(source)}`;
    });
}

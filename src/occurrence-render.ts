/** Keep multiline quotes valid, particularly block formulas captured from the web. */
export function renderOccurrenceContent(template: string, values: Record<string, unknown>): string {
  return template.split("\n").map((line) => line.replace(/\{\{(\w+)\}\}/g, (_token: string, key: string, offset: number) => {
    const raw = values[key];
    if (!(key in values)) return _token;
    let value = typeof raw === "string" || typeof raw === "number" ? String(raw) : "";
    if (key === "sourceSuffix" && value && typeof values.sentence === "string" && /\n\$\$\s*$/.test(values.sentence)) value = `\n\n${value.trimStart()}`;
    const before = line.slice(0, offset);
    const quote = /^(\s*(?:>\s*)+)/.exec(before)?.[1];
    if (quote) value = value.replaceAll("\n", `\n${quote}`);
    return value;
  })).join("\n");
}

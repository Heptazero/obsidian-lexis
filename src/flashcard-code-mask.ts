/** Keep line and character positions while hiding Markdown code from syntax matching. */
export function maskInlineCode(lines: string[]): string[] {
  const source = lines.join("\n"), runs = [...source.matchAll(/`+/g)];
  const next = new Map<number, number>(), closing = new Array<number>(runs.length);
  for (let index = runs.length - 1; index >= 0; index--) {
    const size = runs[index][0].length;
    closing[index] = next.get(size) ?? -1; next.set(size, index);
  }
  const spans: Array<[number, number]> = [];
  for (let index = 0; index < runs.length; index++) {
    const start = runs[index].index;
    let backslashes = 0;
    for (let cursor = start - 1; cursor >= 0 && source[cursor] === "\\"; cursor--) backslashes++;
    if (backslashes % 2) continue;
    const end = closing[index];
    if (end < 0 || /\n[ \t\r]*\n/.test(source.slice(start, runs[end].index))) continue;
    spans.push([start, runs[end].index + runs[end][0].length]); index = end;
  }
  let cursor = 0, result = "";
  for (const [start, end] of spans) {
    result += source.slice(cursor, start) + source.slice(start, end).replace(/[^\r\n]/g, "\0"); cursor = end;
  }
  return (result + source.slice(cursor)).split("\n");
}

export function maskExcludedLines(markdown: string): string[] {
  const lines = markdown.split("\n");
  let fence = "", indented = false, frontmatter = lines[0]?.trim() === "---", comment = false;
  return lines.map((line, index) => {
    const trimmed = line.trim();
    if (frontmatter) { if (index > 0 && trimmed === "---") frontmatter = false; return ""; }
    // Strip quote containers only for recognizing fences, never from card content.
    const block = line.replace(/^ {0,3}(?:>[ \t]?)* {0,3}/, "");
    if (fence) {
      const close = /^(`{3,}|~{3,})[ \t\r]*$/.exec(block);
      if (close && close[1][0] === fence[0] && close[1].length >= fence.length) fence = "";
      return "";
    }
    if (/^( {4}|\t)/.test(line) && (indented || index === 0 || !lines[index - 1].trim())) { indented = true; return ""; }
    if (indented && !trimmed) return "";
    indented = false;
    const opening = /^(`{3,}|~{3,})/.exec(block);
    if (opening) { fence = opening[1]; return ""; }
    if (comment) { if (line.includes("-->")) comment = false; return ""; }
    const commentStart = line.indexOf("<!--");
    if (commentStart >= 0) { if (!line.slice(commentStart + 4).includes("-->")) comment = true; return line.slice(0, commentStart); }
    return line;
  });
}

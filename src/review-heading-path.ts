/** Input is already masked for frontmatter, code fences and comments by the syntax parser. */
export function reviewHeadingPaths(lines: string[]): string[][] {
  const stack: { level: number; title: string }[] = [];
  return lines.map((line, index) => {
    const atx = /^ {0,3}(#{1,6})[ \t]+(.+?)\s*$/.exec(line);
    const previous = lines[index - 1] || "";
    const setext = previous.trim() && !/^ {0,3}(?:#{1,6}(?:\s|$)|>|[-+*]\s|\d+[.)]\s)/.test(previous) && /^ {0,3}(=+|-+)\s*$/.exec(line);
    const level = atx ? atx[1].length : setext ? (setext[1][0] === "=" ? 1 : 2) : 0;
    const title = atx ? atx[2].replace(/[ \t]+#+[ \t]*$/, "").trim() : setext ? lines[index - 1].trim() : "";
    if (level) {
      while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
      stack.push({ level, title });
    }
    return stack.map((heading) => heading.title);
  });
}

export type SyntaxCardKind = "inline" | "bidirectional" | "block" | "cloze";

export interface FlashcardTemplates {
  inline: string;
  bidirectional: string;
  block: string;
  cloze: string;
}

export interface ParsedSyntaxCard {
  id: string;
  groupId: string;
  kind: SyntaxCardKind;
  front: string;
  back: string;
  combinedFront?: string;
  line: number;
}

const PLACEHOLDERS = {
  question: "{{question}}",
  answer: "{{answer}}",
  sideA: "{{sideA}}",
  sideB: "{{sideB}}",
};

const hashText = (value: string): string => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
};

const stableId = (filePath: string, kind: SyntaxCardKind, front: string, back: string, occurrence = 0): string => (
  `syntax-${hashText([filePath, kind, front.trim(), back.trim(), occurrence].join("\u001f"))}`
);

const betweenVariables = (template: string, left: string, right: string): string => {
  const leftIndex = template.indexOf(left);
  const rightIndex = template.indexOf(right, leftIndex + left.length);
  if (leftIndex < 0 || rightIndex < 0 || rightIndex < leftIndex) return "";
  return template.slice(leftIndex + left.length, rightIndex);
};

const maskExcludedLines = (markdown: string): string[] => {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  let fence = "";
  let frontmatter = lines[0]?.trim() === "---";
  let comment = false;
  return lines.map((line, index) => {
    const trimmed = line.trim();
    if (frontmatter) {
      if (index > 0 && trimmed === "---") frontmatter = false;
      return "";
    }
    if (fence) {
      if (trimmed.startsWith(fence)) fence = "";
      return "";
    }
    const fenceMatch = /^(```+|~~~+)/.exec(trimmed);
    if (fenceMatch) { fence = fenceMatch[1][0].repeat(fenceMatch[1].length); return ""; }
    if (comment) {
      if (line.includes("-->")) comment = false;
      return "";
    }
    const commentStart = line.indexOf("<!--");
    if (commentStart >= 0) {
      if (!line.slice(commentStart + 4).includes("-->")) comment = true;
      return line.slice(0, commentStart);
    }
    return line;
  });
};

const addCard = (
  cards: ParsedSyntaxCard[],
  counts: Map<string, number>,
  filePath: string,
  kind: SyntaxCardKind,
  front: string,
  back: string,
  line: number,
  groupSource = "",
  combinedFront?: string,
): void => {
  const base = [kind, front.trim(), back.trim()].join("\u001f");
  const occurrence = counts.get(base) || 0;
  counts.set(base, occurrence + 1);
  const id = stableId(filePath, kind, front, back, occurrence);
  cards.push({
    id,
    groupId: `group-${hashText([filePath, kind, groupSource || base, line].join("\u001f"))}`,
    kind,
    front: front.trim(),
    back: back.trim(),
    combinedFront: combinedFront?.trim(),
    line,
  });
};

export function parseSyntaxCards(markdown: string, filePath: string, templates: FlashcardTemplates): ParsedSyntaxCard[] {
  const rawLines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const lines = maskExcludedLines(markdown);
  const cards: ParsedSyntaxCard[] = [];
  const counts = new Map<string, number>();
  const consumed = new Set<number>();

  const blockBetween = betweenVariables(templates.block || "", PLACEHOLDERS.question, PLACEHOLDERS.answer);
  const blockMarker = blockBetween.trim();
  const markerOnOwnLine = /^\s*\n[\s\S]*\n\s*$/.test(blockBetween);
  if (blockMarker) {
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      let question = "";
      let answerStart = index + 1;
      let questionStart = index;
      if (markerOnOwnLine && line.trim() === blockMarker) {
        let start = index - 1;
        while (start >= 0 && lines[start].trim()) start--;
        questionStart = start + 1;
        question = rawLines.slice(questionStart, index).join("\n").trim();
      } else if (!markerOnOwnLine && line.trimEnd().endsWith(blockMarker)) {
        question = line.trimEnd().slice(0, -blockMarker.length).trim();
      } else continue;
      let answerEnd = answerStart;
      while (answerEnd < rawLines.length && rawLines[answerEnd].trim()) answerEnd++;
      const answer = rawLines.slice(answerStart, answerEnd).join("\n").trim();
      if (!question || !answer) continue;
      for (let used = questionStart; used < answerEnd; used++) consumed.add(used);
      addCard(cards, counts, filePath, "block", question, answer, questionStart, `${question}\n${answer}`);
      index = Math.max(index, answerEnd - 1);
    }
  }

  const bidirectionalDelimiter = betweenVariables(templates.bidirectional || "", PLACEHOLDERS.sideA, PLACEHOLDERS.sideB).trim();
  const inlineDelimiter = betweenVariables(templates.inline || "", PLACEHOLDERS.question, PLACEHOLDERS.answer).trim();
  for (let index = 0; index < lines.length; index++) {
    if (consumed.has(index) || !lines[index].trim()) continue;
    const line = lines[index];
    if (bidirectionalDelimiter && line.includes(bidirectionalDelimiter)) {
      const at = line.indexOf(bidirectionalDelimiter);
      const sideA = line.slice(0, at).trim();
      const sideB = line.slice(at + bidirectionalDelimiter.length).trim();
      if (sideA && sideB) {
        const group = `${sideA}${bidirectionalDelimiter}${sideB}`;
        addCard(cards, counts, filePath, "bidirectional", sideA, sideB, index, group);
        addCard(cards, counts, filePath, "bidirectional", sideB, sideA, index, group);
        consumed.add(index);
      }
      continue;
    }
    if (inlineDelimiter && line.includes(inlineDelimiter)) {
      const at = line.indexOf(inlineDelimiter);
      const question = line.slice(0, at).trim();
      const answer = line.slice(at + inlineDelimiter.length).trim();
      if (question && answer) {
        addCard(cards, counts, filePath, "inline", question, answer, index);
        consumed.add(index);
      }
    }
  }

  const clozeTemplate = templates.cloze || "";
  const answerAt = clozeTemplate.indexOf(PLACEHOLDERS.answer);
  const clozeOpen = answerAt >= 0 ? clozeTemplate.slice(0, answerAt) : "";
  const clozeClose = answerAt >= 0 ? clozeTemplate.slice(answerAt + PLACEHOLDERS.answer.length) : "";
  if (clozeOpen && clozeClose) {
    for (let index = 0; index < lines.length; index++) {
      if (!lines[index].trim()) continue;
      const source = lines[index];
      const ranges: Array<{ start: number; end: number; answer: string }> = [];
      let cursor = 0;
      while (cursor < source.length) {
        const start = source.indexOf(clozeOpen, cursor);
        if (start < 0) break;
        const contentStart = start + clozeOpen.length;
        const close = source.indexOf(clozeClose, contentStart);
        if (close < 0) break;
        const answer = source.slice(contentStart, close).trim();
        if (answer) ranges.push({ start, end: close + clozeClose.length, answer });
        cursor = close + clozeClose.length;
      }
      if (!ranges.length) continue;
      const combinedFront = ranges.reduceRight((value, range) => value.slice(0, range.start) + "[…]" + value.slice(range.end), source);
      ranges.forEach((range) => {
        const front = source.slice(0, range.start) + "[…]" + source.slice(range.end);
        addCard(cards, counts, filePath, "cloze", front, source, index, source, combinedFront);
      });
    }
  }

  return cards;
}

import { reviewHeadingPaths } from "./review-heading-path";
import { maskExcludedLines, maskInlineCode } from "./flashcard-code-mask";

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
  clozeAnswer?: string;
  clozeIndex?: number;
  line: number;
  headingPath?: string[];
}

export interface ClozeAnswerRange {
  start: number;
  end: number;
  answer: string;
}

export interface FlashcardParseOptions {
  /** In a marked inline-entry file, an identical delimiter belongs to the dictionary entry. */
  inlineEntryDelimiter?: string;
}

const PLACEHOLDERS = {
  question: "{{question}}",
  answer: "{{answer}}",
  sideA: "{{sideA}}",
  sideB: "{{sideB}}",
};

const ANSWER_MASK_OPEN = '<span class="lexis-rv-answer-mask">';
const ANSWER_MASK_CLOSE = "</span>";
const hasQuestion = (value: string): boolean => !!value.trim() && !/^(?:#{1,6}|[-+*]|\d+[.)])$/.test(value.trim());

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

export const inlineQuestionDelimiter = (template: string): string => (
  betweenVariables(template || "", PLACEHOLDERS.question, PLACEHOLDERS.answer).trim()
);

export const inlineEntryConflictsWithFlashcard = (entryDelimiter: string, template: string): boolean => {
  const entry = String(entryDelimiter || "").trim();
  return !!entry && entry === inlineQuestionDelimiter(template);
};

const wrapAnswer = (value: string): string => `${ANSWER_MASK_OPEN}${value}${ANSWER_MASK_CLOSE}`;

const delimiterIndex = (line: string, delimiter: string): number => {
  let from = 0;
  while (delimiter) {
    const at = line.indexOf(delimiter, from);
    if (at < 0) return -1;
    const standardLibraryScope = delimiter === "::" && /\bstd$/.test(line.slice(0, at)) && /^[A-Za-z_]/.test(line.slice(at + delimiter.length));
    if (!standardLibraryScope) return at;
    from = at + delimiter.length;
  }
  return -1;
};

const maskBlockLine = (line: string): string => {
  if (!line.trim()) return line;
  const table = /^(\s*\|)(.*)(\|\s*)$/.exec(line);
  if (table && !/^\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+$/.test(table[2])) {
    const cells = table[2].split("|").map((cell) => cell.trim() ? wrapAnswer(cell) : cell);
    return `${table[1]}${cells.join("|")}${table[3]}`;
  }
  const match = /^(\s*(?:(?:>\s*)*(?:(?:[-+*]|\d+[.)])\s+|#{1,6}\s+)?))(.*)$/.exec(line);
  return match ? `${match[1]}${wrapAnswer(match[2])}` : wrapAnswer(line);
};

type MaskRange = { start: number; end: number };

const applyMaskRanges = (line: string, ranges: MaskRange[]): string => {
  const ordered = [...ranges]
    .filter((range) => range.end > range.start)
    .sort((left, right) => right.start - left.start);
  let result = line;
  for (const range of ordered) result = result.slice(0, range.start) + wrapAnswer(result.slice(range.start, range.end)) + result.slice(range.end);
  return result;
};

export function maskSyntaxAnswers(markdown: string, templates: FlashcardTemplates, options: FlashcardParseOptions = {}): string {
  const rawLines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const lines = maskInlineCode(maskExcludedLines(rawLines.join("\n")));
  const output = [...rawLines];
  const fullyMasked = new Set<number>();
  const ranges = new Map<number, MaskRange[]>();
  const addRange = (line: number, start: number, end: number) => {
    const current = ranges.get(line) || [];
    current.push({ start, end });
    ranges.set(line, current);
  };

  const blockBetween = betweenVariables(templates.block || "", PLACEHOLDERS.question, PLACEHOLDERS.answer);
  const blockMarker = blockBetween.trim();
  const markerOnOwnLine = /^\s*\n[\s\S]*\n\s*$/.test(blockBetween);
  if (blockMarker) {
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      let question = "";
      let answerStart = index + 1;
      if (markerOnOwnLine && line.trim() === blockMarker) {
        let start = index - 1;
        while (start >= 0 && lines[start].trim()) start--;
        question = rawLines.slice(start + 1, index).join("\n").trim();
      } else if (!markerOnOwnLine && line.trimEnd().endsWith(blockMarker)) {
        question = rawLines[index].trimEnd().slice(0, -blockMarker.length).trim();
      } else continue;
      let answerEnd = answerStart;
      while (answerEnd < rawLines.length && rawLines[answerEnd].trim()) answerEnd++;
      if (!hasQuestion(question) || answerEnd === answerStart) continue;
      for (let answerLine = answerStart; answerLine < answerEnd; answerLine++) {
        output[answerLine] = maskBlockLine(rawLines[answerLine]);
        fullyMasked.add(answerLine);
      }
      index = Math.max(index, answerEnd - 1);
    }
  }

  const bidirectionalDelimiter = betweenVariables(templates.bidirectional || "", PLACEHOLDERS.sideA, PLACEHOLDERS.sideB).trim();
  const configuredInlineDelimiter = inlineQuestionDelimiter(templates.inline);
  const inlineDelimiter = inlineEntryConflictsWithFlashcard(options.inlineEntryDelimiter || "", templates.inline) ? "" : configuredInlineDelimiter;
  for (let index = 0; index < lines.length; index++) {
    if (fullyMasked.has(index) || !lines[index].trim()) continue;
    const line = lines[index];
    const bidirectionalAt = delimiterIndex(line, bidirectionalDelimiter);
    const inlineAt = delimiterIndex(line, inlineDelimiter);
    const delimiter = bidirectionalAt >= 0
      ? bidirectionalDelimiter
      : inlineAt >= 0 ? inlineDelimiter : "";
    if (!delimiter) continue;
    const at = delimiter === bidirectionalDelimiter ? bidirectionalAt : inlineAt;
    const answerStart = at + delimiter.length;
    const answer = rawLines[index].slice(answerStart);
    if (hasQuestion(rawLines[index].slice(0, at)) && (delimiter === bidirectionalDelimiter ? hasQuestion(answer) : answer.trim())) addRange(index, answerStart, rawLines[index].length);
  }

  const clozeTemplate = templates.cloze || "";
  const answerAt = clozeTemplate.indexOf(PLACEHOLDERS.answer);
  const clozeOpen = answerAt >= 0 ? clozeTemplate.slice(0, answerAt) : "";
  const clozeClose = answerAt >= 0 ? clozeTemplate.slice(answerAt + PLACEHOLDERS.answer.length) : "";
  if (clozeOpen && clozeClose) {
    for (let index = 0; index < lines.length; index++) {
      if (fullyMasked.has(index) || !lines[index].trim() || ranges.has(index)) continue;
      const source = lines[index];
      let cursor = 0;
      while (cursor < source.length) {
        const start = source.indexOf(clozeOpen, cursor);
        if (start < 0) break;
        const contentStart = start + clozeOpen.length;
        const close = source.indexOf(clozeClose, contentStart);
        if (close < 0) break;
        if (rawLines[index].slice(contentStart, close).trim()) addRange(index, contentStart, close);
        cursor = close + clozeClose.length;
      }
    }
  }

  for (const [index, lineRanges] of ranges) output[index] = applyMaskRanges(rawLines[index], lineRanges);
  return output.join("\n");
}

export function findClozeAnswerRanges(markdown: string, templates: FlashcardTemplates): ClozeAnswerRange[] {
  const clozeTemplate = templates.cloze || "";
  const answerAt = clozeTemplate.indexOf(PLACEHOLDERS.answer);
  if (answerAt < 0) return [];
  const clozeOpen = clozeTemplate.slice(0, answerAt);
  const clozeClose = clozeTemplate.slice(answerAt + PLACEHOLDERS.answer.length);
  if (!clozeOpen || !clozeClose) return [];
  const ranges: ClozeAnswerRange[] = [];
  const rawLines = markdown.split("\n");
  const searchable = maskInlineCode(maskExcludedLines(markdown)).map((line, index) => line.padEnd(rawLines[index].length, "\0")).join("\n");
  let cursor = 0;
  while (cursor < markdown.length) {
    const start = searchable.indexOf(clozeOpen, cursor);
    if (start < 0) break;
    const answerStart = start + clozeOpen.length;
    const close = searchable.indexOf(clozeClose, answerStart);
    if (close < 0) break;
    const answer = markdown.slice(answerStart, close).trim();
    if (answer) ranges.push({ start, end: close + clozeClose.length, answer });
    cursor = close + clozeClose.length;
  }
  return ranges;
}

export function maskClozeAnswers(markdown: string, templates: FlashcardTemplates, revealIndexes: Set<number> = new Set()): string {
  const ranges = findClozeAnswerRanges(markdown, templates);
  let result = markdown;
  for (let index = ranges.length - 1; index >= 0; index--) {
    const range = ranges[index];
    if (revealIndexes.has(index)) continue;
    const answerStart = range.start + (templates.cloze || "").indexOf(PLACEHOLDERS.answer);
    const answerEnd = range.end - ((templates.cloze || "").length - (templates.cloze || "").indexOf(PLACEHOLDERS.answer) - PLACEHOLDERS.answer.length);
    result = result.slice(0, answerStart) + `<span class="lexis-rv-answer-mask">${result.slice(answerStart, answerEnd)}</span>` + result.slice(answerEnd);
  }
  return result;
}

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

export function parseSyntaxCards(markdown: string, filePath: string, templates: FlashcardTemplates, options: FlashcardParseOptions = {}): ParsedSyntaxCard[] {
  const rawLines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const visibleLines = maskExcludedLines(rawLines.join("\n"));
  const lines = maskInlineCode(visibleLines);
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
        question = rawLines[index].trimEnd().slice(0, -blockMarker.length).trim();
      } else continue;
      let answerEnd = answerStart;
      while (answerEnd < rawLines.length && rawLines[answerEnd].trim()) answerEnd++;
      const answer = rawLines.slice(answerStart, answerEnd).join("\n").trim();
      if (!hasQuestion(question) || !answer) continue;
      for (let used = questionStart; used < answerEnd; used++) consumed.add(used);
      addCard(cards, counts, filePath, "block", question, answer, questionStart, `${question}\n${answer}`);
      index = Math.max(index, answerEnd - 1);
    }
  }

  const bidirectionalDelimiter = betweenVariables(templates.bidirectional || "", PLACEHOLDERS.sideA, PLACEHOLDERS.sideB).trim();
  const configuredInlineDelimiter = inlineQuestionDelimiter(templates.inline);
  const inlineDelimiter = inlineEntryConflictsWithFlashcard(options.inlineEntryDelimiter || "", templates.inline) ? "" : configuredInlineDelimiter;
  for (let index = 0; index < lines.length; index++) {
    if (consumed.has(index) || !lines[index].trim()) continue;
    const line = lines[index];
    const bidirectionalAt = delimiterIndex(line, bidirectionalDelimiter);
    if (bidirectionalAt >= 0) {
      const at = bidirectionalAt;
      const sideA = rawLines[index].slice(0, at).trim();
      const sideB = rawLines[index].slice(at + bidirectionalDelimiter.length).trim();
      if (hasQuestion(sideA) && hasQuestion(sideB)) {
        const group = `${sideA}${bidirectionalDelimiter}${sideB}`;
        addCard(cards, counts, filePath, "bidirectional", sideA, sideB, index, group);
        addCard(cards, counts, filePath, "bidirectional", sideB, sideA, index, group);
        consumed.add(index);
      }
      continue;
    }
    const inlineAt = delimiterIndex(line, inlineDelimiter);
    if (inlineAt >= 0) {
      const at = inlineAt;
      const question = rawLines[index].slice(0, at).trim();
      const answer = rawLines[index].slice(at + inlineDelimiter.length).trim();
      if (hasQuestion(question) && answer) {
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
        const answer = rawLines[index].slice(contentStart, close).trim();
        if (answer) ranges.push({ start, end: close + clozeClose.length, answer });
        cursor = close + clozeClose.length;
      }
      if (!ranges.length) continue;
      const original = rawLines[index];
      const combinedFront = ranges.reduceRight((value, range) => value.slice(0, range.start) + "[…]" + value.slice(range.end), original);
      ranges.forEach((range, clozeIndex) => {
        const front = original.slice(0, range.start) + "[…]" + original.slice(range.end);
        addCard(cards, counts, filePath, "cloze", front, original, index, original, combinedFront);
        cards[cards.length - 1].clozeAnswer = range.answer;
        cards[cards.length - 1].clozeIndex = clozeIndex;
      });
    }
  }

  const paths = reviewHeadingPaths(visibleLines);
  for (const card of cards) card.headingPath = paths[card.line] || [];
  return cards;
}

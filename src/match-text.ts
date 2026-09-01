const ASCII_WORD = /[A-Za-z0-9_]/;
const EAST_ASIAN = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const HORIZONTAL_SPACE = /[ \t\u00a0\u3000]/;
const OPTIONAL_MIXED_SPACE = "[ \\t\\u00a0\\u3000]*";

export const escapeRe = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const isMixedScriptBoundary = (left: string, right: string): boolean => (
  ASCII_WORD.test(left) && EAST_ASIAN.test(right)
) || (
  EAST_ASIAN.test(left) && ASCII_WORD.test(right)
);

export function compactMixedScriptSpacing(value: string): string {
  const characters = [...String(value || "")];
  let result = "";
  let previous = "";
  for (let index = 0; index < characters.length;) {
    const character = characters[index];
    if (!HORIZONTAL_SPACE.test(character)) {
      result += character;
      previous = character;
      index++;
      continue;
    }
    let end = index + 1;
    while (end < characters.length && HORIZONTAL_SPACE.test(characters[end])) end++;
    const next = characters[end] || "";
    if (!isMixedScriptBoundary(previous, next)) result += characters.slice(index, end).join("");
    index = end;
  }
  return result;
}

function flexibleMixedScriptSource(value: string): string {
  const characters = [...String(value || "")];
  let source = "";
  let previous = "";
  let boundaryAlreadyAdded = false;
  for (let index = 0; index < characters.length;) {
    const character = characters[index];
    if (HORIZONTAL_SPACE.test(character)) {
      let end = index + 1;
      while (end < characters.length && HORIZONTAL_SPACE.test(characters[end])) end++;
      const next = characters[end] || "";
      boundaryAlreadyAdded = isMixedScriptBoundary(previous, next);
      source += boundaryAlreadyAdded ? OPTIONAL_MIXED_SPACE : escapeRe(characters.slice(index, end).join(""));
      index = end;
      continue;
    }
    if (!boundaryAlreadyAdded && previous && isMixedScriptBoundary(previous, character)) source += OPTIONAL_MIXED_SPACE;
    source += escapeRe(character);
    previous = character;
    boundaryAlreadyAdded = false;
    index++;
  }
  return source;
}

export const boundedSource = (word: string): string => {
  const leftBoundary = /^[A-Za-z0-9_]/.test(word) ? "\\b" : "";
  const rightBoundary = /[A-Za-z0-9_]$/.test(word) ? "\\b" : "";
  return leftBoundary + flexibleMixedScriptSource(word) + rightBoundary;
};

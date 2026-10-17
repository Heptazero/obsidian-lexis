export interface MarginNoteCapture { word: string; sentence: string; source: string }

/** URI delivery only prepares a draft; the receiving UI owns confirmation. */
export function parseMarginNoteCapture(params: Record<string, unknown>): MarginNoteCapture {
  const word = typeof params.word === "string" ? params.word.trim() : "";
  const sentence = typeof params.sentence === "string" ? params.sentence.trim() : "";
  const source = typeof params.source === "string" ? params.source.trim() : "";
  if (!word || word.length > 200 || /[\r\n]/.test(word) || sentence.length > 4000 || source.length > 500) {
    throw new Error("划词内容无效或过长 / Invalid or oversized selection");
  }
  return { word, sentence, source };
}

export function marginNoteCaptureUri(vault: string, capture: MarginNoteCapture): string {
  if (!vault.trim()) throw new Error("请先设置目标 Obsidian 库名 / Set the target vault first");
  const safe = parseMarginNoteCapture(capture as unknown as Record<string, unknown>);
  const params = { vault: vault.trim(), ...safe };
  return "obsidian://lexis-add?" + Object.entries(params).map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join("&");
}

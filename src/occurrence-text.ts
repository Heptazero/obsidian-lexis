// Protect syntax where # is already literal or part of a destination. Only prose
// is escaped: rewriting whole notes would also break headings and PDF page links.
const HASH_TOKENS = new RegExp([
  String.raw`\\[\s\S]`,
  "(`+)(?!`)[\\s\\S]*?\\1(?!`)",
  String.raw`(~{3,})[^\n]*\n[\s\S]*?\2`,
  String.raw`\$\$[\s\S]*?\$\$|\$(?:\\[\s\S]|[^$\\\n])+\$`,
  String.raw`\[\[[^\n]*?\]\]`,
  String.raw`\]\((?:\\[\s\S]|[^()\\]|\([^()]*\))*\)`,
  String.raw`(?:https?|obsidian):\/\/[^\s<>]+`,
  "#",
].join("|"), "g");

export function escapeOccurrenceHashes(text: string): string {
  return text.replace(HASH_TOKENS, (token) => token === "#" ? "\\#" : token);
}

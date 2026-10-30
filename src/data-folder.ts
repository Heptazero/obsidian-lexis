export const DEFAULT_DATA_FOLDER = "Lexis-data";

/** Learning data must be in a visible, vault-relative, dedicated directory. */
export function dataFolder(input: string): string {
  const value = input.trim().replaceAll("\\", "/").replace(/\/+$/, "") || DEFAULT_DATA_FOLDER;
  if (value.startsWith("/") || /^[A-Za-z]:/.test(value) || /\.jsonl?$/i.test(value)
    || value.split("/").some(part => !part || part.startsWith("."))) {
    throw new Error("Use a visible vault-relative folder, not a hidden folder, file or absolute path.");
  }
  return value;
}

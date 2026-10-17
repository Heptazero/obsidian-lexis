import type { MarginNoteDictionary } from "../../../src/marginnote-protocol";

const returnLink = /^(\[在 Obsidian 打开 \/ Open in Obsidian\]\()(obsidian:\/\/open\?[^\s)]+)(\))/;

export function returnUri(body: string): string {
  return returnLink.exec(body)?.[2] || "";
}

export function vaultFromUri(uri: string): string {
  const value = /[?&]vault=([^&]*)/.exec(uri)?.[1];
  if (!value) return "";
  try { return decodeURIComponent(value); } catch { return ""; }
}

/** Keep the encoded file path, heading and all other query parameters unchanged. */
export function uriForVault(uri: string, vault: string): string {
  const name = vault.trim();
  if (!name) return uri;
  const encoded = encodeURIComponent(name);
  return /[?&]vault=/.test(uri)
    ? uri.replace(/([?&])vault=[^&]*/, (_, separator: string) => `${separator}vault=${encoded}`)
    : `${uri}&vault=${encoded}`;
}

export function retargetReturnLink(body: string, vault: string): string {
  return body.replace(returnLink, (_, before: string, uri: string, after: string) =>
    before + uriForVault(uri, vault) + after);
}

export function dictionaryForVault(snapshot: MarginNoteDictionary, vault: string): MarginNoteDictionary {
  const name = vault.trim();
  if (!name) return snapshot;
  return {
    ...snapshot,
    revision: JSON.stringify([snapshot.revision, name]),
    entries: snapshot.entries.map((entry) => ({ ...entry, uri: uriForVault(entry.uri, name) })),
  };
}

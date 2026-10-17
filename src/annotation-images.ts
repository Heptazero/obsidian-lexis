import { TFile, type App } from "obsidian";
import type { LexisSettings } from "./types";

const IMAGE_MIME: Record<string, string> = {
  avif: "image/avif",
  bmp: "image/bmp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  svg: "image/svg+xml",
  webp: "image/webp",
};

function attachmentName(file: File): string {
  const clean = file.name.replace(/[\\/:*?"<>|#[\]]/g, "-").trim();
  if (/\.[a-z0-9]+$/i.test(clean)) return clean;
  const extension = Object.entries(IMAGE_MIME).find(([, mime]) => mime === file.type)?.[0] || "png";
  return `${clean || "image"}.${extension}`;
}

export async function saveAnnotationImage(app: App, _settings: LexisSettings, wordFile: TFile, image: File): Promise<TFile> {
  const filename = attachmentName(image);
  const path = await app.fileManager.getAvailablePathForAttachment(filename, wordFile.path);
  return app.vault.createBinary(path, await image.arrayBuffer());
}

export async function vaultImageDataUrl(app: App, linkPath: string, sourcePath: string): Promise<string | null> {
  const target = String(linkPath || "").split("|")[0].trim();
  if (!target) return null;
  const file = app.metadataCache.getFirstLinkpathDest(target, sourcePath);
  if (!(file instanceof TFile)) return null;
  const mime = IMAGE_MIME[file.extension.toLowerCase()];
  if (!mime) return null;
  const bytes = await app.vault.readBinary(file);
  const view = new Uint8Array(bytes);
  let binary = "";
  for (let offset = 0; offset < view.length; offset += 0x8000) {
    binary += String.fromCharCode(...view.subarray(offset, offset + 0x8000));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

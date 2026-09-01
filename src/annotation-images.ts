import { normalizePath, TFile, type App } from "obsidian";
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

async function ensureFolder(app: App, folder: string): Promise<void> {
  let current = "";
  for (const part of normalizePath(folder).split("/").filter(Boolean)) {
    current = current ? `${current}/${part}` : part;
    if (!app.vault.getAbstractFileByPath(current)) await app.vault.createFolder(current);
  }
}

function uniquePath(app: App, folder: string, filename: string): string {
  const dot = filename.lastIndexOf(".");
  const stem = dot > 0 ? filename.slice(0, dot) : filename;
  const extension = dot > 0 ? filename.slice(dot) : "";
  let path = normalizePath(`${folder}/${filename}`);
  for (let index = 2; app.vault.getAbstractFileByPath(path); index++) {
    path = normalizePath(`${folder}/${stem} ${index}${extension}`);
  }
  return path;
}

export async function saveAnnotationImage(app: App, settings: LexisSettings, wordFile: TFile, image: File): Promise<TFile> {
  const filename = attachmentName(image);
  let path: string;
  if (settings.annotationImageLocation === "custom") {
    const folder = normalizePath(settings.annotationImageFolder || "");
    if (!folder) throw new Error("Custom annotation image folder is empty");
    await ensureFolder(app, folder);
    path = uniquePath(app, folder, filename);
  } else {
    path = await app.fileManager.getAvailablePathForAttachment(filename, wordFile.path);
  }
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

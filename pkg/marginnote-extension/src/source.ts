import { parseMarginNoteDictionary, type MarginNoteDictionary } from "../../../src/marginnote-protocol";

const prefs = () => NSUserDefaults.standardUserDefaults();
const key = (topic: string, field: string) => `lexis.mn.${topic}.${field}`;

export function preference(topic: string, field: string): unknown {
  return prefs().objectForKey(key(topic, field));
}
export function setPreference(topic: string, field: string, value: unknown): void {
  prefs().setObjectForKey(value, key(topic, field));
}

/** The public picker does not specify whether it returns a URL, path or URL array. */
export function pickedURL(value: unknown): NativeURL | null {
  if (!value) return null;
  if (Array.isArray(value)) return pickedURL(value[0]);
  if (typeof value === "string") {
    return value.startsWith("file:") ? NSURL.URLWithString(value) : NSURL.fileURLWithPath(value);
  }
  const native = value as NativeURL & NativeArray<unknown>;
  if (typeof native.objectAtIndex === "function") {
    return native.count() ? pickedURL(native.objectAtIndex(0)) : null;
  }
  if (typeof native.startAccessingSecurityScopedResource === "function") return native;
  throw new Error("MN 未返回可读取的文件地址；可先用剪贴板导入 / Unsupported file picker result");
}

export function readDictionary(url: NativeURL): MarginNoteDictionary {
  const access = url.startAccessingSecurityScopedResource();
  try {
    const text = NSString.stringWithContentsOfURL(url);
    if (text == null) throw new Error("无法读取词库，请下载文件并重新选择 / Cannot read dictionary file");
    return parseMarginNoteDictionary(String(text));
  } finally {
    if (access) url.stopAccessingSecurityScopedResource();
  }
}

export function rememberFile(topic: string, url: NativeURL): boolean {
  const access = url.startAccessingSecurityScopedResource();
  try {
    const options = Application.sharedInstance().osType === 2 ? 2048 : 0;
    const bookmark = url.bookmarkDataWithOptionsIncludingResourceValuesForKeysRelativeToURLError(options, [], null, null);
    if (!bookmark) return false;
    setPreference(topic, "bookmark", bookmark);
    return true;
  } finally {
    if (access) url.stopAccessingSecurityScopedResource();
  }
}

export function rememberedFile(topic: string): NativeURL | null {
  const bookmark = preference(topic, "bookmark");
  if (!bookmark) return null;
  const options = Application.sharedInstance().osType === 2 ? 1024 : 0;
  return NSURL.URLByResolvingBookmarkDataOptionsRelativeToURLBookmarkDataIsStaleError(bookmark, options, null, null, null);
}

export function forgetFile(topic: string): void {
  prefs().removeObjectForKey(key(topic, "bookmark"));
  setPreference(topic, "auto", false);
}

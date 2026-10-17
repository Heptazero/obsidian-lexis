type FontLoader = (url: string) => Promise<string>;
const FONT_URL = /url\(\s*(?:"([^"]+)"|'([^']+)'|([^\s)]+))\s*\)/g;

async function loadMathFont(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 3000);
  try {
    // These are app:// resources, not HTTP requests handled by requestUrl.
    const response = await window.fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error("math-font-unavailable");
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    const mime = new URL(url).pathname.endsWith(".woff2") ? "woff2" : "woff";
    return `data:font/${mime};base64,${btoa(binary)}`;
  } finally {
    window.clearTimeout(timer);
  }
}

/** Export a self-contained stylesheet, not app-only /lib/mathjax font URLs. */
export function createMathCssExporter(load: FontLoader = loadMathFont) {
  const fonts = new Map<string, Promise<string>>();
  return async (document: Document): Promise<string> => {
    const style = document.getElementById("MJX-CHTML-styles") as HTMLStyleElement | null;
    const rules = Array.from(style?.sheet?.cssRules || [], (rule) => rule.cssText);
    const replacements = new Map<string, string>();
    const base = new URL(document.baseURI);
    const sources = new Set(rules.filter((rule) => rule.startsWith("@font-face"))
      .flatMap((rule) => [...rule.matchAll(FONT_URL)].map((match) => match[1] || match[2] || match[3])));
    await Promise.all([...sources].map(async (source) => {
      const url = new URL(source, base);
      // Only read MathJax fonts shipped with this app, never arbitrary page URLs.
      if (url.protocol !== base.protocol || url.host !== base.host || !/^\/lib\/mathjax\/.*\.woff2?$/.test(url.pathname)) return;
      const key = url.href;
      const pending = fonts.get(key) ?? load(key);
      fonts.set(key, pending);
      try {
        replacements.set(source, await pending);
      } catch {
        fonts.delete(key); // A transient failure must not poison future cards.
      }
    }));
    return rules.map((rule) => rule.startsWith("@font-face")
      ? rule.replace(FONT_URL, (match, quoted: string, singleQuoted: string, bare: string) => {
        const data = replacements.get(quoted || singleQuoted || bare);
        return data ? `url("${data}")` : match;
      }) : rule).join("\n");
  };
}

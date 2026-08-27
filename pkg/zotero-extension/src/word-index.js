(function (ns) {
  const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const boundedSource = (word) => {
    const left = /^[A-Za-z0-9_]/.test(word) ? "(?<![A-Za-z0-9_])" : "";
    const right = /[A-Za-z0-9_]$/.test(word) ? "(?![A-Za-z0-9_])" : "";
    return left + escapeRegex(word) + right;
  };

  function textColorFor(background) {
    const match = /#([0-9a-f]{6})/i.exec(String(background));
    if (!match) return "#fff";
    const hex = match[1];
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return r * .299 + g * .587 + b * .114 > 160 ? "#1f2328" : "#fff";
  }

  class WordIndex {
    constructor() { this.update([], null); }

    update(words, styleConfig) {
      this.words = Array.isArray(words) ? words : [];
      this.styleConfig = styleConfig || {};
      this.entries = new Map();
      this.excluded = new Set();
      const excludedTags = new Set((this.styleConfig.excludeTags || []).map((tag) => String(tag).toLowerCase()));
      const keys = [];
      for (const raw of this.words) {
        const key = String(raw.key || raw.k || "").toLowerCase();
        if (!key || (key.length < 2 && !/[^\x00-\x7f]/.test(key))) continue;
        const entry = {
          key,
          word: raw.word || raw.w || key,
          tags: (raw.tags || raw.t || []).map((tag) => String(tag).toLowerCase()),
          file: raw.file || raw.f || "",
          color: raw.color || raw.c || "",
          opacity: raw.opacity ?? raw.o,
          visible: (raw.visible ?? raw.v) !== false,
          style: raw.wstyle || raw.s || "",
          alias: Boolean(raw.alias),
          inline: Boolean(raw.inline),
        };
        this.entries.set(key, entry);
        if (excludedTags.size && entry.tags.some((tag) => excludedTags.has(tag))) this.excluded.add(key);
        else keys.push(key);
      }
      keys.sort((a, b) => b.length - a.length || a.localeCompare(b));
      this.pattern = keys.length ? keys.map(boundedSource).join("|") : "";
    }

    regex() { return this.pattern ? new RegExp(this.pattern, "gi") : null; }
    has(key) { return this.entries.has(String(key || "").toLowerCase()) && !this.excluded.has(String(key || "").toLowerCase()); }
    isExcluded(key) { return this.excluded.has(String(key || "").toLowerCase()); }
    get(key) { return this.entries.get(String(key || "").toLowerCase()); }
    dictionaries() { return (this.styleConfig.dicts || []).filter(Boolean); }

    knownTags() {
      const tags = new Set();
      for (const entry of this.entries.values()) for (const tag of entry.tags) tags.add(tag);
      return [...tags].sort();
    }

    dictionaryColor(entry) {
      const map = this.styleConfig.dictColors || {};
      const folder = this.folderOf(entry.file);
      if (map[folder]) return map[folder];
      let result = "", length = -1;
      for (const candidate of Object.keys(map)) {
        if (candidate && (folder === candidate || folder.startsWith(candidate + "/")) && candidate.length > length) {
          result = map[candidate]; length = candidate.length;
        }
      }
      return result;
    }

    appearance(key) {
      const entry = this.get(key);
      if (!entry) return { visible: false, color: "#7c5cff", opacity: 0, style: "wavy" };
      let color = entry.color || this.dictionaryColor(entry) || this.styleConfig.highlightColor || "#7c5cff";
      let style = entry.style || this.styleConfig.highlightStyle || "wavy";
      if (!entry.color) {
        const rule = (this.styleConfig.tagRules || []).find((item) => item.tag && entry.tags.includes(String(item.tag).toLowerCase()));
        if (rule?.color) color = rule.color;
        if (rule?.style && !entry.style) style = rule.style;
      }
      const opacity = Number.isFinite(Number(entry.opacity)) ? Number(entry.opacity) : Number(this.styleConfig.highlightOpacity ?? 1);
      return { visible: entry.visible, color, opacity: Math.max(0, Math.min(1, opacity)), style };
    }

    folderOf(path) {
      const value = String(path || "");
      const index = value.lastIndexOf("/");
      return index > 0 ? value.slice(0, index) : "";
    }

    accent() { return this.styleConfig.highlightColor || "#7c5cff"; }
    accentText() { return textColorFor(this.accent()); }
  }

  ns.WordIndex = WordIndex;
  ns.boundedSource = boundedSource;
})(LexisZotero);

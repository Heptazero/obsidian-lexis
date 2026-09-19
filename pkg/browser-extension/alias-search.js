// 本地别名目标搜索：只处理同步缓存，不访问 Obsidian，也不参与悬浮卡渲染。
(() => {
  const normalized = (value) => String(value || "").normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();

  function fuzzyScore(query, value) {
    const needle = normalized(query);
    const haystack = normalized(value);
    if (!needle) return 0;
    if (haystack === needle) return 0;
    if (haystack.startsWith(needle)) return 10 + (haystack.length - needle.length) / 100;
    const containedAt = haystack.indexOf(needle);
    if (containedAt >= 0) return 20 + containedAt + (haystack.length - needle.length) / 100;

    let cursor = 0, first = -1, gaps = 0;
    for (const character of needle) {
      const foundAt = haystack.indexOf(character, cursor);
      if (foundAt < 0) return Number.POSITIVE_INFINITY;
      if (first < 0) first = foundAt;
      gaps += foundAt - cursor;
      cursor = foundAt + 1;
    }
    return 40 + first + gaps + Math.max(0, haystack.length - needle.length) / 100;
  }

  function fileTitle(path) {
    const name = String(path || "").split("/").pop() || "";
    return name.replace(/\.md$/i, "");
  }

  function collectAliasTargets(words) {
    const targets = new Map();
    for (const word of words || []) {
      if (!word?.p || word.i) continue;
      let target = targets.get(word.p);
      if (!target) {
        target = { id: word.p, title: fileTitle(word.p), terms: [], termSet: new Set() };
        targets.set(word.p, target);
      }
      if (!word.a && word.w) target.title = word.w;
      for (const term of [target.title, word.w, word.k]) {
        const key = normalized(term);
        if (!key || target.termSet.has(key)) continue;
        target.termSet.add(key);
        target.terms.push(String(term));
      }
    }
    return [...targets.values()].map(({ termSet: _termSet, ...target }) => target);
  }

  function findExactAliasTarget(targets, query) {
    const needle = normalized(query);
    if (!needle) return null;
    return (targets || []).find((target) => normalized(target.title) === needle)
      || (targets || []).find((target) => (target.terms || []).some((term) => normalized(term) === needle))
      || null;
  }

  function rankAliasTargets(targets, query, limit = 8) {
    return (targets || [])
      .map((target) => {
        let score = Number.POSITIVE_INFINITY, matched = target.title;
        for (const term of target.terms || []) {
          const candidateScore = fuzzyScore(query, term);
          if (candidateScore < score) { score = candidateScore; matched = term; }
        }
        return { ...target, score, matched };
      })
      .filter((target) => Number.isFinite(target.score))
      .sort((left, right) => left.score - right.score || left.title.localeCompare(right.title))
      .slice(0, limit);
  }

  globalThis.LexisAliasSearch = Object.freeze({ collectAliasTargets, findExactAliasTarget, fuzzyScore, rankAliasTargets });
})();

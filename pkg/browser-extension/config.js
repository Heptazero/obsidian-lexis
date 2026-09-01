// Lexis Web —— 浏览器端连接配置的唯一默认来源
(() => {
  const DEFAULT_PORT = 12345;

  function normalizePort(value) {
    const port = Number.parseInt(String(value), 10);
    return port >= 1024 && port <= 65535 ? port : DEFAULT_PORT;
  }

  function normalizeFolder(value) {
    return String(value || "").trim().replace(/^\/+|\/+$/g, "");
  }

  function dictionaryForFolder(folder, dictionaries) {
    const target = normalizeFolder(folder);
    let best = "", bestLength = -1;
    for (const value of dictionaries || []) {
      const dictionary = normalizeFolder(value);
      if (dictionary && (target === dictionary || target.startsWith(dictionary + "/")) && dictionary.length > bestLength) {
        best = dictionary;
        bestLength = dictionary.length;
      }
    }
    return best;
  }

  function isDictionaryVisible(site, folder, dictionaries, visibilityBySite) {
    const dictionary = dictionaryForFolder(folder, dictionaries);
    if (!dictionary) return true;
    return visibilityBySite?.[site]?.[dictionary] !== false;
  }

  globalThis.LexisWebConfig = Object.freeze({
    defaultConnection: Object.freeze({ host: "127.0.0.1", port: DEFAULT_PORT }),
    normalizePort,
    dictionaryForFolder,
    isDictionaryVisible,
  });
})();

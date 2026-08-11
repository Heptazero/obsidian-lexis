(function (ns) {
  const PREF = "extensions.lexis-zotero.";

  function createPlugin({ id, version, rootURI, cardCSS, readerCSS }) {
    const controllers = new Map();
    const preferenceObservers = [];
    const encounterQueue = new Set();
    let encounterTimer = null;
    let syncTimer = null;
    let index = new ns.WordIndex();

    const profile = Services.dirsvc.get("ProfD", Components.interfaces.nsIFile).path;
    const debugPath = PathUtils.join(profile, "lexis-zotero-debug.json");
    const debugLines = [];
    let debugTimer = null;
    let debugWrite = Promise.resolve();
    function saveDebug() {
      clearTimeout(debugTimer);
      debugTimer = null;
      debugWrite = debugWrite.catch(() => {}).then(() => IOUtils.writeJSON(debugPath, {
        version,
        updatedAt: new Date().toISOString(),
        lines: debugLines.slice(-200),
      }, { tmpPath: debugPath + ".tmp" }));
      return debugWrite;
    }
    const logger = (message) => {
      const line = `${new Date().toISOString()} ${message}`;
      Zotero.debug(`[Lexis Zotero] ${message}`);
      debugLines.push(line);
      clearTimeout(debugTimer);
      debugTimer = setTimeout(() => saveDebug().catch(() => {}), 120);
    };
    const bridge = new ns.BridgeClient({
      logger,
      onSnapshot(snapshot) {
        index = new ns.WordIndex();
        index.update(snapshot.words, snapshot.styleConfig);
        for (const controller of controllers.values()) {
          try { controller.updateIndex(index); }
          catch (error) { logger(`PDF 刷新排程失败: ${error.message || error}`); }
        }
      },
    });

    const enabled = () => Zotero.Prefs.get(PREF + "enabled", true) !== false;

    // 只在本机 Zotero 的 Prefs 里存"哪些词典文件夹不高亮"，不写进 item/词条数据，
    // 所以不会跟着 Zotero 账号同步到其他电脑，也不会同步进 Obsidian/浏览器端。
    function disabledDicts() {
      try { return new Set(JSON.parse(Zotero.Prefs.get(PREF + "disabledDicts", true) || "[]")); }
      catch (_error) { return new Set(); }
    }

    function queueEncounter(key) {
      encounterQueue.add(key);
      clearTimeout(encounterTimer);
      encounterTimer = setTimeout(async () => {
        const keys = [...encounterQueue]; encounterQueue.clear();
        await bridge.encounter(keys);
      }, 1600);
    }

    function ensureReader(reader) {
      if (!enabled() || !reader || (reader.type !== "pdf" && reader._type !== "pdf")) return null;
      let controller = controllers.get(reader);
      if (!controller) {
        controller = new ns.ReaderController({
          reader,
          index,
          bridge,
          cardCSS,
          readerCSS,
          disabledDicts,
          onEncounter: queueEncounter,
          onDispose(disposedReader) {
            const current = controllers.get(disposedReader);
            if (!current) return;
            controllers.delete(disposedReader);
            current.stop();
          },
          logger,
        });
        controllers.set(reader, controller);
        controller.start().catch((error) => logger(`Reader 接入失败: ${error.message || error}`));
      }
      return controller;
    }

    function attachOpenReaders() {
      for (const reader of Zotero.Reader?._readers || []) ensureReader(reader);
    }

    function stopReaders() {
      for (const controller of controllers.values()) controller.stop();
      controllers.clear();
    }

    function scheduleSync() {
      clearInterval(syncTimer);
      const minutes = Math.max(1, Math.min(60, Number(Zotero.Prefs.get(PREF + "syncMinutes", true) || 3)));
      syncTimer = setInterval(() => bridge.sync(), minutes * 60 * 1000);
    }

    function observePreferences() {
      preferenceObservers.push(Zotero.Prefs.registerObserver(PREF + "enabled", () => {
        if (enabled()) { attachOpenReaders(); bridge.sync(); }
        else stopReaders();
      }));
      for (const name of ["host", "port", "token"]) {
        preferenceObservers.push(Zotero.Prefs.registerObserver(PREF + name, () => bridge.sync()));
      }
      preferenceObservers.push(Zotero.Prefs.registerObserver(PREF + "syncMinutes", scheduleSync));
      preferenceObservers.push(Zotero.Prefs.registerObserver(PREF + "disabledDicts", () => {
        for (const controller of controllers.values()) controller.rescan();
      }));
    }

    return {
      id,
      version,
      rootURI,
      bridge,
      debugPath,

      async startup() {
        await bridge.init();
        Zotero.Reader.registerEventListener("renderToolbar", (event) => {
          ensureReader(event.reader)?.refreshViews().catch((error) => logger(`PDF 视图刷新失败: ${error.message || error}`));
        }, id);
        Zotero.Reader.registerEventListener("renderTextSelectionPopup", (event) => ensureReader(event.reader)?.renderSelection(event), id);
        await Zotero.uiReadyPromise;
        attachOpenReaders();
        observePreferences();
        scheduleSync();
        bridge.sync();
      },

      async shutdown() {
        clearInterval(syncTimer);
        clearTimeout(encounterTimer);
        if (encounterQueue.size) await bridge.encounter([...encounterQueue]);
        stopReaders();
        for (const observer of preferenceObservers) Zotero.Prefs.unregisterObserver(observer);
        preferenceObservers.length = 0;
        await bridge.save();
        await saveDebug();
      },

      async testConnection() {
        const ping = await bridge.ping();
        if (!ping?.ok) return ping;
        try {
          const words = await bridge.request("/words");
          return words?.ok ? { ok: true, vault: ping.vault, version: ping.version, count: words.count } : words;
        } catch (error) {
          return { ok: false, error: String(error.message || error), offline: true };
        }
      },

      syncNow() { return bridge.sync(); },
      listDictionaries() { return index.dictionaries(); },
    };
  }

  ns.createPlugin = createPlugin;
})(LexisZotero);

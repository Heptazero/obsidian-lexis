(function (ns) {
  const PREF = "extensions.lexis-zotero.";

  class BridgeClient {
    constructor({ onSnapshot, logger }) {
      this.onSnapshot = onSnapshot;
      this.logger = logger;
      this.snapshot = { words: [], styleConfig: null, meta: null, pending: [] };
      this.detailCache = new Map();
      const profile = Services.dirsvc.get("ProfD", Components.interfaces.nsIFile).path;
      this.cachePath = PathUtils.join(profile, "lexis-zotero-cache.json");
      this._saveChain = Promise.resolve();
    }

    config() {
      return {
        host: String(Zotero.Prefs.get(PREF + "host", true) || "127.0.0.1"),
        port: Number(Zotero.Prefs.get(PREF + "port", true) || 12345),
        token: String(Zotero.Prefs.get(PREF + "token", true) || ""),
      };
    }

    async init() {
      try {
        if (await IOUtils.exists(this.cachePath)) {
          const saved = await IOUtils.readJSON(this.cachePath);
          if (saved && Array.isArray(saved.words)) {
            this.snapshot = {
              words: saved.words,
              styleConfig: saved.styleConfig || null,
              meta: saved.meta || null,
              pending: Array.isArray(saved.pending) ? saved.pending : [],
            };
          }
        }
      } catch (error) {
        this.logger(`读取离线缓存失败: ${error.message || error}`);
      }
      this.onSnapshot(this.snapshot, { cached: true });
      return this.snapshot;
    }

    baseURL() {
      const cfg = this.config();
      return `http://${cfg.host}:${cfg.port}`;
    }

    async request(path, { method = "GET", query, body, authenticated = true } = {}) {
      const url = new URL(this.baseURL() + path);
      for (const [key, value] of Object.entries(query || {})) url.searchParams.set(key, String(value));
      const cfg = this.config();
      const headers = {};
      if (authenticated && cfg.token) headers["X-Lexis-Token"] = cfg.token;
      if (body !== undefined) headers["Content-Type"] = "application/json";
      const xhr = await Zotero.HTTP.request(method, url.toString(), {
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        responseType: "text",
        successCodes: false,
        timeout: 5000,
      });
      let data;
      try { data = JSON.parse(xhr.responseText || "{}"); }
      catch (_error) { data = { ok: false, error: `http-${xhr.status || 0}` }; }
      if (xhr.status === 401) return { ok: false, error: "bad-token" };
      return data;
    }

    async ping() {
      try { return await this.request("/ping", { authenticated: false }); }
      catch (error) { return { ok: false, error: String(error.message || error), offline: true }; }
    }

    async sync() {
      try {
        await this.flushPending();
        const data = await this.request("/words");
        if (!data?.ok) return data || { ok: false, error: "no-data" };
        this.snapshot.words = Array.isArray(data.words) ? data.words : [];
        this.snapshot.styleConfig = data.styleConfig || null;
        this.snapshot.meta = {
          count: this.snapshot.words.length,
          version: data.version,
          syncedAt: Date.now(),
        };
        this.detailCache.clear();
        await this.save();
        this.onSnapshot(this.snapshot, { cached: false });
        return { ok: true, count: this.snapshot.words.length, pending: this.snapshot.pending.length };
      } catch (error) {
        return { ok: false, error: String(error.message || error), offline: true, cached: this.snapshot.words.length };
      }
    }

    async detail(key, { refresh = false } = {}) {
      const normalized = String(key || "").toLowerCase();
      if (!refresh && this.detailCache.has(normalized)) return this.detailCache.get(normalized);
      try {
        const data = await this.request("/word", { query: { key: normalized } });
        if (data?.ok) this.detailCache.set(normalized, data);
        return data;
      } catch (error) {
        return { ok: false, error: String(error.message || error), offline: true };
      }
    }

    add(payload) { return this.mutate("/add", { method: "POST", body: payload, kind: "add", resync: true }); }
    tag(payload) { return this.mutate("/tag", { method: "POST", body: payload, kind: "tag", resync: true }); }
    note(payload) { return this.mutate("/note", { method: "POST", body: payload, kind: "note" }); }
    move(payload) { return this.mutate("/move", { method: "POST", body: payload, kind: "move", resync: true }); }
    delete(key) { return this.mutate("/word", { method: "DELETE", query: { key }, kind: "delete", resync: true }); }

    async encounter(keys) {
      if (!keys?.length) return { ok: true, recorded: 0 };
      try { return await this.request("/encounter", { method: "POST", body: { keys } }); }
      catch (_error) { return { ok: false, offline: true }; }
    }

    async mutate(path, { method, query, body, kind, resync = false }) {
      try {
        const data = await this.request(path, { method, query, body });
        if (data?.ok) {
          const key = body?.key || body?.word || query?.key;
          if (key) this.detailCache.delete(String(key).toLowerCase());
          if (resync) await this.sync();
        }
        return data;
      } catch (error) {
        const operation = { path, method, query: query || null, body: body || null, kind, queuedAt: Date.now() };
        this.snapshot.pending.push(operation);
        await this.save();
        return { ok: true, queued: true, pending: this.snapshot.pending.length, offline: true };
      }
    }

    async flushPending() {
      if (!this.snapshot.pending.length) return 0;
      const pending = this.snapshot.pending.slice();
      const remaining = [];
      for (let i = 0; i < pending.length; i++) {
        const operation = pending[i];
        try {
          const result = await this.request(operation.path, operation);
          if (!result?.ok) {
            if (result?.error === "bad-token") remaining.push(...pending.slice(i));
            continue;
          }
        } catch (_error) {
          remaining.push(...pending.slice(i));
          break;
        }
      }
      this.snapshot.pending = remaining;
      await this.save();
      return remaining.length;
    }

    save() {
      const data = {
        words: this.snapshot.words,
        styleConfig: this.snapshot.styleConfig,
        meta: this.snapshot.meta,
        pending: this.snapshot.pending,
      };
      this._saveChain = this._saveChain.catch(() => {}).then(() => IOUtils.writeJSON(this.cachePath, data, {
        tmpPath: this.cachePath + ".tmp",
      })).catch((error) => this.logger(`写入离线缓存失败: ${error.message || error}`));
      return this._saveChain;
    }
  }

  ns.BridgeClient = BridgeClient;
})(LexisZotero);

"use strict";

function createBridgeServer({ Notice }) {
  // 外部阅读端（浏览器、未来的 Zotero）只通过这条本机桥接访问 Lexis。
  // 这里负责 HTTP 生命周期与路由；词典规则和写入动作仍由 LexisPlugin 作为唯一真相处理。
  class LexisBridge {
    constructor(plugin) {
      this.plugin = plugin;
      this.server = null;
    }

    get running() { return !!this.server; }

    generateToken() {
      const bytes = new Uint8Array(16);
      (window.crypto || crypto).getRandomValues(bytes);
      return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
    }

    start() {
      if (this.server) return;
      let http;
      try { http = require("http"); } catch (_e) {}
      if (!http) { new Notice(this.plugin.t("notice.desktopBridge")); return; }
      const port = Number(this.plugin.settings.bridgePort) || 45945;
      const server = http.createServer((req, res) => {
        this.handle(req, res).catch((err) => {
          try { res.writeHead(500); res.end(String(err && err.message || err)); } catch (_e) {}
        });
      });
      server.on("error", (err) => {
        this.server = null;
        const reason = err.code === "EADDRINUSE" ? this.plugin.t("notice.portBusy", { port }) : (err.code || err.message);
        new Notice(this.plugin.t("notice.bridgeFailed", { reason }));
      });
      server.listen(port, "127.0.0.1", () => this.plugin.updateStatusBar());
      this.server = server;
    }

    stop() {
      if (!this.server) return;
      try { this.server.close(); } catch (_e) {}
      this.server = null;
      this.plugin.updateStatusBar();
    }

    restart() {
      this.stop();
      if (this.plugin.settings.bridgeEnabled) this.start();
    }

    cors() {
      return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "X-Lexis-Token, Content-Type",
        "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      };
    }

    async handle(req, res) {
      const plugin = this.plugin;
      const cors = this.cors();
      const send = (code, obj) => {
        res.writeHead(code, Object.assign({ "Content-Type": "application/json; charset=utf-8" }, cors));
        res.end(JSON.stringify(obj));
      };
      if (req.method === "OPTIONS") { res.writeHead(204, cors); res.end(); return; }
      const url = new URL(req.url, "http://127.0.0.1");
      const path = url.pathname.replace(/\/+$/, "") || "/";
      if (path === "/ping" || path === "/") return send(200, { ok: true, app: "lexis", version: plugin.manifest.version, vault: plugin.app.vault.getName() });
      const token = req.headers["x-lexis-token"] || url.searchParams.get("token") || "";
      if (!plugin.settings.bridgeToken || token !== plugin.settings.bridgeToken) return send(401, { ok: false, error: "bad-token" });
      if (path === "/words" && req.method === "GET") return send(200, plugin.bridgeWordList());
      if (path === "/word" && req.method === "GET") return send(200, await plugin.bridgeWordDetail(url.searchParams.get("key") || url.searchParams.get("w")));
      if (path === "/word" && req.method === "DELETE") return send(200, await plugin.bridgeDeleteWord(url.searchParams.get("key") || ""));
      if (path === "/add" && req.method === "POST") return send(200, await plugin.bridgeAddWord(await this.readBody(req)));
      if (path === "/tag" && req.method === "POST") return send(200, await plugin.bridgeTagWord(await this.readBody(req)));
      if (path === "/note" && req.method === "POST") return send(200, await plugin.bridgeAnnotate(await this.readBody(req)));
      if (path === "/move" && req.method === "POST") return send(200, await plugin.bridgeMoveWord(await this.readBody(req)));
      if (path === "/encounter" && req.method === "POST") return send(200, await plugin.bridgeEncounter(await this.readBody(req)));
      return send(404, { ok: false, error: "not-found" });
    }

    readBody(req) {
      return new Promise((resolve) => {
        let data = "";
        req.on("data", (chunk) => { data += chunk; if (data.length > 1e6) req.destroy(); });
        req.on("end", () => { try { resolve(JSON.parse(data || "{}")); } catch (_e) { resolve({}); } });
        req.on("error", () => resolve({}));
      });
    }
  }

  return LexisBridge;
}

module.exports = { createBridgeServer };

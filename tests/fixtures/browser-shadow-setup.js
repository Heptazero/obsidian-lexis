"use strict";

const fixtureRequests = [];
const fixtureChanges = [];
const fixtureStore = {
  cfg: { highlight: true, style: "background", color: "#00cc88" },
  styleConfig: { dicts: ["10_atom"], highlightStyle: "background", highlightOpacity: 0.3 },
  words: [{ k: "lexis", f: "10_atom", c: "#00cc88", s: "background", o: 0.3 }],
};
globalThis.chrome = {
  runtime: {
    getURL: (name) => name,
    onMessage: { addListener() {} },
    async sendMessage(message) {
      fixtureRequests.push(message);
      if (message.type === "detail") return { ok: true, word: message.key, title: message.key, html: "<p>Lexis definition</p>", vault: "test", file: "10_atom/lexis.md", tags: [] };
      if (message.type === "add") return { ok: true, created: true, word: message.payload.word, file: "10_atom/novel.md" };
      return { ok: true };
    },
  },
  storage: {
    local: {
      async get() { return fixtureStore; },
      async set(update) {
        const changes = {};
        for (const [key, value] of Object.entries(update)) {
          changes[key] = { oldValue: fixtureStore[key], newValue: value };
          fixtureStore[key] = value;
        }
        fixtureChanges.forEach((listener) => listener(changes, "local"));
      },
    },
    onChanged: { addListener: (callback) => fixtureChanges.push(callback) },
  },
};
globalThis.fetch = async (url) => ({ text: async () => fixtureCss[url] || "" });

function fixtureHost(parent, attributes = {}) {
  const host = document.createElement("div");
  for (const [key, value] of Object.entries(attributes)) host.setAttribute(key, value);
  const root = host.attachShadow({ mode: "open" });
  parent.appendChild(host);
  return { host, root };
}
document.body.innerHTML = '<p id="outside">Lexis outside</p>';
const fixturePanel = fixtureHost(document.body, { "data-video-marker-lab-panel": "" });
const fixtureOriginalSheet = new CSSStyleSheet();
fixtureOriginalSheet.replaceSync('.cue-text { color: rgb(21, 32, 43); font: 16px sans-serif; user-select: text; }');
fixturePanel.root.adoptedStyleSheets = [fixtureOriginalSheet];
fixturePanel.root.innerHTML = '<div class="cue-row" data-index="0" data-start-ms="1000"><button class="cue-time">0:01</button><div class="cue-line"><span class="cue-text" data-vml-cue-text>Lexis welcomes novel.</span><textarea hidden>Lexis original source</textarea></div></div><div hidden id="hidden">Lexis hidden</div><input value="Lexis"><div contenteditable="true">Lexis editable</div><pre>Lexis code</pre>';
const fixtureNested = fixtureHost(fixturePanel.root);
fixtureNested.root.innerHTML = "<p>Lexis nested</p>";
const fixturePlayer = document.createElement("div");
fixturePlayer.style.cssText = "position:relative;width:500px;height:160px";
const fixtureVideo = document.createElement("video");
fixtureVideo.currentTime = 83.5;
fixturePlayer.appendChild(fixtureVideo);
document.body.appendChild(fixturePlayer);
const fixtureOverlay = fixtureHost(fixturePlayer, { "data-video-marker-lab-subtitles": "" });
fixtureOverlay.host.style.cssText = "position:absolute;inset:0;z-index:40;pointer-events:none;overflow:hidden";
fixtureOverlay.root.innerHTML = '<style>.subtitle { position:absolute;top:20px;left:20px;display:flex;color:white;background:rgba(0,0,0,.78);pointer-events:none; } .subtitle-text { pointer-events:auto;user-select:text;cursor:text; } .move { pointer-events:auto;cursor:move;touch-action:none; }</style><div class="subtitle"><div class="subtitle-text" aria-hidden="true">Lexis visible screenword.</div><button class="move">Move</button></div>';
const fixtureOptOut = fixtureHost(document.body, { "data-lexis-ignore": "" });
fixtureOptOut.root.innerHTML = "<p>Lexis opted out</p>";
const fixtureClosedHost = document.createElement("div");
const fixtureClosed = fixtureClosedHost.attachShadow({ mode: "closed" });
fixtureClosed.innerHTML = "<p>Lexis closed</p>";
document.body.appendChild(fixtureClosedHost);

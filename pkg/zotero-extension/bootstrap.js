var LexisZotero = {};
var LexisZoteroPlugin;
var LexisZoteroPreferencePaneID;

function log(message) {
  Zotero.debug(`[Lexis Zotero] ${message}`);
}

function readText(uri) {
  const request = new XMLHttpRequest();
  request.open("GET", uri, false);
  request.overrideMimeType?.("text/plain");
  request.send(null);
  if (request.status && request.status >= 400) throw new Error(`无法读取 ${uri}: ${request.status}`);
  return request.responseText;
}

function install() {}

async function startup({ id, version, rootURI }) {
  await Zotero.initializationPromise;
  log(`启动 ${version}`);
  for (const file of [
    "src/bridge-client.js",
    "src/word-index.js",
    "src/pdf-highlighter.js",
    "src/card-view.js",
    "src/reader-adapter.js",
    "src/plugin.js",
  ]) Services.scriptloader.loadSubScript(rootURI + file, globalThis);

  LexisZoteroPlugin = LexisZotero.createPlugin({
    id,
    version,
    rootURI,
    cardCSS: readText(rootURI + "styles/card.css"),
    readerCSS: readText(rootURI + "styles/reader.css"),
  });
  Zotero.LexisZotero = LexisZoteroPlugin;
  await LexisZoteroPlugin.startup();

  LexisZoteroPreferencePaneID = Zotero.PreferencePanes.register({
    pluginID: id,
    src: rootURI + "preferences.xhtml",
    image: rootURI + "icons/lexis.svg",
    scripts: [rootURI + "preferences.js"],
    stylesheets: [rootURI + "preferences.css"],
  });
}

async function shutdown() {
  log("关闭");
  if (LexisZoteroPreferencePaneID && Zotero.PreferencePanes.unregister) {
    Zotero.PreferencePanes.unregister(LexisZoteroPreferencePaneID);
  }
  await LexisZoteroPlugin?.shutdown();
  if (Zotero.LexisZotero === LexisZoteroPlugin) delete Zotero.LexisZotero;
  LexisZoteroPlugin = undefined;
  LexisZoteroPreferencePaneID = undefined;
  LexisZotero = {};
}

function uninstall() {}

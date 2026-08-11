const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

let highlighterStarted = false;
const pdfWindow = {
  PDFViewerApplication: { initializedPromise: Promise.resolve() },
  addEventListener() {},
};
const outerWindow = {
  addEventListener() {},
  removeEventListener() {},
};
const context = {
  LexisZotero: {
    SelectionActions: class { updateIndex() {} render() {} },
    CardView: class { updateIndex() {} destroy() {} },
    PdfHighlighter: class {
      start() { highlighterStarted = true; }
      updateIndex() {}
      stop() {}
    },
  },
  Zotero: {
    Promise: { delay: () => Promise.resolve() },
    Items: { get: () => null },
    Libraries: { get: () => null },
  },
};
vm.createContext(context);
const source = fs.readFileSync(path.join(__dirname, "..", "src", "reader-adapter.js"), "utf8");
vm.runInContext(source, context);

(async () => {
  const reader = {
    _type: "pdf",
    _iframeWindow: outerWindow,
    _initPromise: Promise.resolve(),
    _waitForReader: async () => {},
    _internalReader: {
      _primaryView: {
        _iframeWindow: pdfWindow,
        initializedPromise: Promise.resolve(),
      },
    },
  };
  const controller = new context.LexisZotero.ReaderController({
    reader,
    index: {},
    bridge: {},
    cardCSS: "",
    readerCSS: "",
    onEncounter() {},
    onDispose() {},
    logger() {},
  });
  await controller.start();
  assert.equal(controller.views.has(pdfWindow), true);
  assert.equal(highlighterStarted, true);
  console.log("reader adapter tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

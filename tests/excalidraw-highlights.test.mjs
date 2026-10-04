import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";
import { build } from "esbuild";

const result = await build({ entryPoints: ["src/excalidraw-highlights.ts"], bundle: true, write: false, format: "esm", platform: "node" });
const moduleUrl = `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`;
const { firstExcalidrawMatch, pointInHighlightBox, sceneApiForView, sceneElementBox } = await import(moduleUrl);

test("matches a dictionary entry inside an Excalidraw text element", () => {
  const entry = { display: "格点群" };
  const index = new Map([["格点群", entry]]);
  const match = firstExcalidrawMatch("这里讨论格点群的性质", "格点群|群", (value) => value, index);
  assert.deepEqual(match, { key: "格点群", entry });
});

test("converts a scene element to a viewport box", () => {
  const box = sceneElementBox(
    { id: "a", type: "text", x: 10, y: 20, width: 30, height: 10, angle: 0.5 },
    { zoom: { value: 2 }, scrollX: 5, scrollY: -5, offsetLeft: 100, offsetTop: 50 },
  );
  assert.deepEqual(box, { left: 130, top: 80, width: 60, height: 20, angle: 0.5 });
});

test("hit testing follows a rotated highlight box", () => {
  const box = { left: 100, top: 100, width: 80, height: 20, angle: Math.PI / 2 };
  assert.equal(pointInHighlightBox(140, 135, box), true);
  assert.equal(pointInHighlightBox(175, 110, box), false);
});

test("uses the Excalidraw 2.27 view API before compatibility fallbacks", () => {
  const direct = { getAppState() {}, getSceneElements() {} };
  const fallback = { getAppState() {}, getSceneElements() {} };
  const plugin = { ea: { getAPI: () => ({ getExcalidrawAPI: () => fallback }) } };
  assert.equal(sceneApiForView({ excalidrawAPI: direct }, plugin), direct);
  assert.equal(sceneApiForView({}, plugin), fallback);
});

test("does not couple Excalidraw highlights to view-only mode", async () => {
  const source = await import("node:fs/promises").then(({ readFile }) => readFile("src/excalidraw-highlights.ts", "utf8"));
  assert.doesNotMatch(source, /!appState\.viewModeEnabled/);
});

test("hides Excalidraw overlays during pointer movement and wheel zoom", async () => {
  const source = await import("node:fs/promises").then(({ readFile }) => readFile("src/excalidraw-highlights.ts", "utf8"));
  assert.match(source, /addEventListener\("pointerdown", begin/);
  assert.match(source, /addEventListener\("wheel", wheel/);
  assert.match(source, /classList\.add\("is-interacting"\)/);
  assert.match(source, /state\.signature = ""/);
});

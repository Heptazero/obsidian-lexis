import esbuild from "esbuild";
import process from "node:process";
import { builtinModules } from "node:module";

const production = process.argv[2] === "production";
await esbuild.build({
  entryPoints: ["src/curve-controls.ts"], bundle: true, format: "iife", globalName: "LexisCurveControls",
  target: "es2021", minify: true, outfile: "pkg/browser-extension/curve-controls.js",
  banner: { js: "/* Generated from src/curve-controls.ts. Do not edit. */" },
});
await esbuild.build({
  entryPoints: ["src/selection-pill-position.ts"], bundle: true, format: "iife", globalName: "LexisPillPosition",
  target: "es2021", minify: true, outfile: "pkg/browser-extension/pill-position.js",
  banner: { js: "/* Generated from src/selection-pill-position.ts. Do not edit. */" },
});
const context = await esbuild.context({
  banner: { js: "/* Generated from TypeScript source. Edit src/, not main.js. */" },
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: [
    "obsidian",
    "electron",
    "@codemirror/autocomplete",
    "@codemirror/collab",
    "@codemirror/commands",
    "@codemirror/language",
    "@codemirror/lint",
    "@codemirror/search",
    "@codemirror/state",
    "@codemirror/view",
    "@lezer/common",
    "@lezer/highlight",
    "@lezer/lr",
    ...builtinModules,
  ],
  format: "cjs",
  target: "es2021",
  logLevel: "info",
  sourcemap: production ? false : "inline",
  treeShaking: true,
  outfile: "main.js",
});

if (production) {
  await context.rebuild();
  await context.dispose();
} else {
  await context.watch();
}

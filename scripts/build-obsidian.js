"use strict";

const path = require("node:path");
const { pathToFileURL } = require("node:url");

if (!process.argv[2]) process.argv[2] = "production";
const config = path.resolve(__dirname, "..", "esbuild.config.mjs");
import(pathToFileURL(config).href).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

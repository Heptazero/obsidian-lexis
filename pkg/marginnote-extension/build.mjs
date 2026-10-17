import { build } from "esbuild";
import { copyFile, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(await readFile(join(root, "mnaddon.json"), "utf8"));
const stage = await mkdtemp(join(tmpdir(), "lexis-marginnote-build-"));
const dist = join(root, "dist");
await mkdir(dist, { recursive: true });
const artifact = join(dist, `lexis-marginnote-${manifest.version}.mnaddon`);
try {
  await build({
    entryPoints: [join(root, "src/main.ts")], outfile: join(stage, "main.js"),
    bundle: true, format: "iife", target: "es2018", platform: "neutral", legalComments: "none",
  });
  await copyFile(join(root, "mnaddon.json"), join(stage, "mnaddon.json"));
  await copyFile(join(root, "README.md"), join(stage, "README.md"));
  await copyFile(join(root, "PUBLISHING.md"), join(stage, "PUBLISHING.md"));
  await copyFile(join(root, "../browser-extension/icons/128.png"), join(stage, "icon.png"));
  // Build a fresh archive; zip's update mode must not retain obsolete files.
  const packed = join(stage, "addon.mnaddon");
  execFileSync("zip", ["-q", packed, "main.js", "mnaddon.json", "icon.png", "README.md", "PUBLISHING.md"], { cwd: stage });
  await copyFile(packed, artifact);
  console.log(artifact);
} finally {
  // Only our freshly-created temporary build directory is removed.
  await rm(stage, { recursive: true, force: true });
}

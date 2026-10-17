import { readFile, readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

// Exercise the same MathJax bundle that renders Obsidian's bridge HTML, offline.
export async function obsidianMathJax() {
  const updates = join(homedir(), "Library/Application Support/obsidian");
  const latest = (await readdir(updates)).filter((name) => /^obsidian-[\d.]+\.asar$/.test(name)).sort((a, b) => b.localeCompare(a, undefined, {numeric:true}))[0];
  const archive = await readFile(process.env.OBSIDIAN_ASAR || (latest ? join(updates, latest) : "/Applications/Obsidian.app/Contents/Resources/obsidian.asar"));
  const header = JSON.parse(archive.subarray(16, 16 + archive.readUInt32LE(12)).toString());
  const start = 8 + archive.readUInt32LE(4);
  const read = (path) => {
    const entry = path.split("/").reduce((node, name) => node.files[name], header);
    const offset = start + Number(entry.offset);
    return archive.subarray(offset, offset + entry.size);
  };
  const math = header.files.lib.files.mathjax;
  const fonts = {};
  const walk = (node, path) => {
    for (const [name, entry] of Object.entries(node.files || {})) {
      if (entry.files) walk(entry, `${path}/${name}`);
      else if (/\.woff2?$/.test(name)) fonts[name] = `data:font/${name.endsWith('woff2') ? 'woff2' : 'woff'};base64,${read(`${path}/${name}`).toString("base64")}`;
    }
  };
  walk(math, "lib/mathjax");
  return {
    script: read(`lib/mathjax/${math.files["obsidian-mathjax.js"] ? "obsidian-mathjax.js" : "tex-chtml-full.js"}`).toString(),
    fonts,
  };
}

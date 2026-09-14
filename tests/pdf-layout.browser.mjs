import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { build } from 'esbuild';

const chrome = process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
await access(chrome);
const dir = await mkdtemp(join(tmpdir(), 'lexis-pdf-layout-'));
try {
  const bundle = await build({ entryPoints: ['tests/fixtures/pdf-layout.ts'], bundle: true, write: false, format: 'iife' });
  const css = await readFile('styles.css', 'utf8');
  // The span rules mirror the PDF.js text layer bundled in Obsidian's app.css.
  const html = `<style>${css}
    .page { position:relative; width:800px; height:150px; transform-origin:0 0; }
    .textLayer { position:absolute; inset:0; line-height:1; font:16px monospace; }
    .textLayer span,.textLayer br { color:transparent; position:absolute; white-space:pre; transform-origin:0% 0%; }
  </style><body><script>${bundle.outputFiles[0].text}</script></body>`;
  const fixture = join(dir, 'index.html');
  await writeFile(fixture, html);
  const output = await new Promise((resolve, reject) => {
    const child = spawn(chrome, ['--headless', '--disable-gpu', '--disable-background-networking', '--disable-component-update', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${join(dir, 'profile')}`, '--dump-dom', `file://${fixture}`], { stdio: ['ignore', 'pipe', 'ignore'] });
    let output = '';
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('PDF layout fixture timed out')); }, 30000);
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      output += chunk;
      if (output.includes('</html>')) {
        clearTimeout(timer);
        child.kill('SIGKILL');
        child.stdout.destroy();
        resolve(output);
      }
    });
    child.on('error', (error) => { clearTimeout(timer); reject(error); });
    child.on('exit', (code) => {
      clearTimeout(timer);
      if (!output.includes('</html>')) reject(new Error(`Chrome exited without results (${code})`));
    });
  });
  const body = output.match(/<body>(.*?)<\/body>/s)?.[1];
  assert.ok(body, 'headless browser did not return fixture results');
  const result = JSON.parse(body);
  assert.equal(result.ok, true, result.error);
  console.log(JSON.stringify(result, null, 2));
} finally {
  await rm(dir, { recursive: true, force: true });
}

import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";
import { build } from "esbuild";

async function loadModule(entryPoint) {
  const options = { entryPoints: [entryPoint], bundle: true, write: false, format: "esm", platform: "node" };
  const result = await build(options);
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
}

test("manual lookup disables ambient highlights without disabling lookup", async () => {
  const { automaticHighlighting, manualLookupEnabled } = await loadModule("src/highlight-mode.ts");
  assert.equal(automaticHighlighting({ enableHighlight: true, highlightMode: "automatic" }), true);
  assert.equal(automaticHighlighting({ enableHighlight: true, highlightMode: "manual" }), false);
  assert.equal(manualLookupEnabled({ enableHighlight: true, highlightMode: "manual" }), true);
  assert.equal(manualLookupEnabled({ enableHighlight: false, highlightMode: "manual" }), false);
});

test("quick edit preserves frontmatter and rejects a stale body", async () => {
  const { splitEditableNote, replaceEditableBody } = await loadModule("src/note-edit-session.ts");
  const original = "---\naliases:\n  - test\n---\nold body\n";
  assert.deepEqual(splitEditableNote(original), { prefix: "---\naliases:\n  - test\n---\n", body: "old body\n" });
  assert.equal(replaceEditableBody(original, "old body\n", "new body\n"), "---\naliases:\n  - test\n---\nnew body\n");
  assert.equal(replaceEditableBody(original.replace("old body", "external edit"), "old body\n", "new body\n"), null);
});

test("quick edit also supports notes without frontmatter", async () => {
  const { splitEditableNote, replaceEditableBody } = await loadModule("src/note-edit-session.ts");
  assert.deepEqual(splitEditableNote("plain\n"), { prefix: "", body: "plain\n" });
  assert.equal(replaceEditableBody("plain\n", "plain\n", "changed\n"), "changed\n");
});

test("auto-save serializes edits typed while a write is still in progress", async () => {
  const { NoteEditSession } = await loadModule("src/note-edit-session.ts");
  let current = "---\nlexis-s: 1\n---\nold";
  const writes = [];
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const session = new NoteEditSession("old", async (transform) => {
    writes.push(current);
    if (writes.length === 1) await gate;
    current = transform(current);
  });
  session.update("first");
  const saving = session.flush();
  session.update("second");
  assert.equal(session.flush(), saving, "concurrent flushes share the writer");
  current = current.replace("lexis-s: 1", "lexis-s: 2");
  release();
  await saving;
  assert.equal(current, "---\nlexis-s: 2\n---\nsecond");
  assert.equal(writes.length, 2);
  assert.equal(session.dirty, false);
});

test("body editing preserves empty frontmatter, Windows newlines, and a byte order mark", async () => {
  const { splitEditableNote, replaceEditableBody } = await loadModule("src/note-edit-session.ts");
  for (const prefix of ["---\n---\n", "---\r\naliases: test\r\n---\r\n", "\uFEFF---\n---\n"]) {
    assert.deepEqual(splitEditableNote(prefix + "old"), { prefix, body: "old" });
    assert.equal(replaceEditableBody(prefix + "old", "old", "new"), prefix + "new");
  }
});

test("auto-save does not rewrite unchanged notes", async () => {
  const { NoteEditSession } = await loadModule("src/note-edit-session.ts");
  let writes = 0;
  const session = new NoteEditSession("old", async () => { writes++; });
  await session.flush();
  session.update("old");
  await session.flush();
  assert.equal(writes, 0);
});

test("auto-save keeps a draft when another editor changed the body", async () => {
  const { NoteEditSession, NoteEditConflict } = await loadModule("src/note-edit-session.ts");
  let current = "someone else's edit";
  const session = new NoteEditSession("old", async (transform) => { current = transform(current); });
  session.update("my draft");
  await assert.rejects(session.flush(), NoteEditConflict);
  assert.equal(current, "someone else's edit");
  assert.equal(session.dirty, true);
  // A rejected writer must not permanently block retry.
  current = "old";
  await session.flush();
  assert.equal(current, "my draft");
});

test("auto-save can retry a failed disk write without losing later edits", async () => {
  const { NoteEditSession } = await loadModule("src/note-edit-session.ts");
  let current = "old";
  let fail = true;
  const session = new NoteEditSession("old", async (transform) => {
    if (fail) throw new Error("disk error");
    current = transform(current);
  });
  session.update("draft");
  await assert.rejects(session.flush(), /disk error/);
  session.update("newer draft");
  fail = false;
  await session.flush();
  assert.equal(current, "newer draft");
});

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

test("one-time migration takes maxima, never adds overlapping snapshots or guesses ambiguous notes", async () => {
  const vault = await mkdtemp(path.join(tmpdir(), "lexis-encounter-test-"));
  try {
    const plugin = path.join(vault, ".obsidian/plugins/lexis");
    await mkdir(plugin, { recursive: true });
    await mkdir(path.join(vault, "10_atom"));
    await mkdir(path.join(vault, "10_atom/sub1"));
    await mkdir(path.join(vault, "10_atom/sub2"));
    await mkdir(path.join(vault, "11_reference"));
    await writeFile(path.join(plugin, "data.json"), JSON.stringify({ dicts: [{ folder: "10_atom" }] }));
    await writeFile(path.join(vault, "10_atom/alpha.md"), "");
    await writeFile(path.join(vault, "10_atom/beta.md"), "");
    await writeFile(path.join(vault, "11_reference/beta.md"), "");
    await writeFile(path.join(vault, "10_atom/sub1/gamma.md"), "");
    await writeFile(path.join(vault, "10_atom/sub2/gamma.md"), "");
    await writeFile(path.join(plugin, "encounters.json"), JSON.stringify({
      alpha: { encounterCount: 5, hoverCount: 2, lastEncounter: "2026-09-25" },
      beta: { encounterCount: 2, hoverCount: 1, lastEncounter: "2026-09-26" },
      gamma: { encounterCount: 4, hoverCount: 1, lastEncounter: "2026-09-26" },
      missing: { encounterCount: 1, hoverCount: 0, lastEncounter: "2026-09-25" },
    }));
    await writeFile(path.join(plugin, "encounters.sync-conflict-example.json"), JSON.stringify({
      alpha: { encounterCount: 7, hoverCount: 3, lastEncounter: "2026-09-28" },
      beta: { encounterCount: 3, hoverCount: 1, lastEncounter: "2026-09-27" },
    }));
    const run = (...extra) => JSON.parse(execFileSync(process.execPath, ["scripts/migrate-encounters.mjs", "--vault", vault, ...extra], { encoding: "utf8" }));
    assert.deepEqual([run().mapped, run().ambiguous, run().unmatched], [2, 1, 1]);
    const report = run("--apply");
    assert.equal(report.sources, 2);
    assert.equal((await readdir(report.backupDir)).length, 2);
    const baseline = JSON.parse(await readFile(path.join(plugin, "encounters/baseline.json"), "utf8"));
    assert.deepEqual(baseline.entries["10_atom/alpha.md"], { encounterCount: 7, hoverCount: 3, lastEncounter: "2026-09-28" });
    assert.deepEqual(baseline.entries["10_atom/beta.md"], { encounterCount: 3, hoverCount: 1, lastEncounter: "2026-09-27" });
    assert.equal(Object.keys(baseline.entries).length, 2);
    assert.equal((await readFile(path.join(plugin, "encounters.json"), "utf8")).includes("alpha"), true);
  } finally {
    await rm(vault, { recursive: true, force: true });
  }
});
